# SUMMIT API 배포 절차 (Lightsail)

관리자 API(`apps/api`)를 운영 서버에 반영하는 절차입니다.

> **Vercel과 달리 자동 배포되지 않습니다.** `main`/`develop`에 머지하면 관리자 프론트(`apps/admin`)와 공개 사이트는 Vercel이 자동으로 배포하지만, API는 아래 절차로 **직접** 갱신해야 합니다.
> 갱신을 빠뜨리면 프론트만 새 버전이 되어 새 API 호출이 404 또는 CORS 오류로 실패합니다 (2026-10-27 work05 배포 때 실제로 발생).

## 서버 구성

| 항목 | 값 |
| --- | --- |
| 인스턴스 | AWS Lightsail, Ubuntu 24.04 LTS, 1GB RAM, 서울 (고정 IP `52.78.163.181`) |
| 도메인 | `https://api.summit-concert.live` (Caddy가 HTTPS 처리 후 `127.0.0.1:3001`로 프록시) |
| 코드 위치 | `/opt/summit-api/repo/apps/api` (`develop` 브랜치, `apps/api`만 sparse checkout) |
| 환경 변수 | `/opt/summit-api/.env` (root 전용, 권한 600) |
| 실행 사용자 | `summit` (로그인 불가 시스템 계정) |
| 서비스 | systemd `summit-api` → `node dist/main.js` |

`/opt/summit-api`는 `summit` 사용자 전용 폴더(권한 750)입니다. `ubuntu` 계정으로는 `cd`할 수 없으므로 **`cd` 대신 `sudo` + 전체 경로**로 명령을 실행합니다.

## 배포 전 확인

1. **배포할 코드가 `develop`에 머지됐는지** — 서버는 `develop` 브랜치를 받아옵니다
2. **DB 마이그레이션이 운영 DB에 적용됐는지** — 이번 변경에 `apps/api/prisma/migrations/` 추가가 있으면, 코드 배포 전에 운영 DB에 먼저 적용합니다
   - 적용은 `prisma migrate deploy`만 사용합니다. **`migrate dev`는 운영 DB에 절대 쓰지 않습니다**
   - 적용 여부 확인: Supabase SQL에서 `select migration_name, finished_at from _prisma_migrations order by started_at desc limit 3;`
3. **새 필수 환경 변수가 있는지** — `apps/api/.env.example`에 새 변수가 생겼다면 서버 `.env`에 먼저 넣습니다. **필수 값이 없으면 서버가 기동하지 않아 API 전체가 멈춥니다**
   ```bash
   sudo nano /opt/summit-api/.env
   ```

## 배포 절차

### 1. 서버 접속

Lightsail 콘솔 → 인스턴스 → **"SSH를 사용하여 연결"** (브라우저 터미널)

> **붙여넣기 주의**: 브라우저 터미널에서 명령을 붙여넣으면 앞뒤에 `^[[200~ … ~`가 붙어 `command not found`가 날 수 있습니다. 직접 타이핑하거나, 접속 직후 아래를 한 번 입력하면 그 세션에서는 정상적으로 붙여넣어집니다.
> ```bash
> bind 'set enable-bracketed-paste off'
> ```

### 2. 코드 갱신 + 빌드

방법 A — 스크립트 (권장, 여러 번 실행해도 안전)

```bash
sudo bash /opt/summit-api/repo/apps/api/deploy/setup-lightsail.sh
```

마지막에 `🎉 서버 구축 스크립트 완료`가 나오면 성공입니다. 5단계 로그의 `코드 준비 완료 — 커밋 …`에서 받아온 커밋을 확인합니다. 기존 `.env`는 덮어쓰지 않습니다.

방법 B — 직접 실행 (스크립트가 없거나 실패할 때)

```bash
# 저장소 확인
sudo ls /opt/summit-api/repo/apps/api

# 최신 코드 받기 + 커밋 확인
sudo -u summit -H git -C /opt/summit-api/repo pull --ff-only origin develop
sudo -u summit -H git -C /opt/summit-api/repo log -1 --oneline

# 의존성 설치 + Prisma 클라이언트 생성 + 빌드 (1GB RAM이라 몇 분 걸림)
sudo -u summit -H bash -c 'cd /opt/summit-api/repo/apps/api && npm ci --no-audit --no-fund && DATABASE_URL=postgresql://localhost:5432/placeholder npx prisma generate && npm run build'
```

`DATABASE_URL`의 값은 실제 접속 정보가 아닌 자리표시 값입니다. `prisma generate`는 DB에 접속하지 않지만 설정 로드 시 값이 필요해서 넣습니다.

### 3. 재시작

빌드만으로는 반영되지 않습니다. **반드시 재시작합니다.**

```bash
sudo systemctl restart summit-api
sudo systemctl status summit-api
```

- `Active: active (running) since …`의 **시각이 방금 시각**이어야 합니다 (재시작 명령이 실제로 실행됐는지 확인)
- 로그 끝에 `Nest application successfully started`, `127.0.0.1:3001`이 보여야 합니다
- 기동 실패 시 원인 확인: `journalctl -u summit-api -n 50` (환경 변수 누락·형식 오류가 대부분)

## 배포 후 확인 (로컬 PC에서)

```bash
# 서버 생존
curl -s -o /dev/null -w "%{http_code}\n" https://api.summit-concert.live/health   # 200

# CORS: 허용 오리진과 메서드
curl -s -o /dev/null -D - -X OPTIONS https://api.summit-concert.live/auth/login \
  -H "Origin: https://admin.summit-concert.live" \
  -H "Access-Control-Request-Method: DELETE" | grep -i "access-control-allow"
```

- `Access-Control-Allow-Origin: https://admin.summit-concert.live`가 있어야 합니다
- `Access-Control-Allow-Methods`가 `apps/api/src/common/cors.ts`의 `methods`와 같아야 합니다 — 다르면 옛 코드가 돌고 있는 것입니다
- 새로 추가한 라우트를 토큰 없이 호출하면 **401**이어야 합니다. **404면 옛 코드**입니다 (예: `curl -s -o /dev/null -w "%{http_code}\n" https://api.summit-concert.live/concert`)

이어서 `https://admin.summit-concert.live`에 로그인해 이번에 바뀐 기능을 직접 확인합니다.

## 문제 해결

| 증상 | 원인 | 조치 |
| --- | --- | --- |
| 관리자 로그인 시 "서버에 연결할 수 없습니다", 콘솔에 `No 'Access-Control-Allow-Origin' header` | Vercel **배포별 URL**(`summit-concert-admin-<해시>-….vercel.app`)로 접속함. CORS 허용 목록에 없음 | `https://admin.summit-concert.live`로 접속. 배포별 URL은 해시가 매번 바뀌므로 `CORS_ALLOWED_ORIGINS`에 추가하지 않음 |
| 로그인은 되는데 새 화면만 404·CORS 오류 | API가 옛 코드 | 위 배포 절차 2~3 진행 |
| `cd: Permission denied` / `No such file or directory` | `/opt/summit-api`는 `summit` 전용이라 `ubuntu`로 접근 불가 | `sudo` + 전체 경로 사용 |
| `^[[200~…: command not found` | 브라우저 터미널 붙여넣기 문제 | 직접 타이핑 또는 `bind 'set enable-bracketed-paste off'` |
| 재시작 후 서비스가 계속 재시작됨 | 필수 환경 변수 누락·형식 오류 | `journalctl -u summit-api -n 50`로 변수명 확인 → `.env` 수정 → 재시작 |
| `*** System restart required ***` | OS 커널 업데이트 안내 (API와 무관) | 여유 있을 때 `sudo reboot` (재부팅 후 `summit-api`·`caddy`는 자동 시작) |

## 최초 서버 구축

새 인스턴스를 처음 구축할 때도 `setup-lightsail.sh`를 사용합니다. 방화벽·DNS·비밀값 입력 등 스크립트가 하지 않는 작업은 스크립트 상단 주석과 완료 시 출력되는 "남은 작업"을 따릅니다.
