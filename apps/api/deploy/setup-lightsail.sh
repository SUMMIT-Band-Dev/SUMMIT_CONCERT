#!/usr/bin/env bash
# =============================================================================
# SUMMIT API — Lightsail 서버 초기 구축 스크립트 (work02-7d)
#
# 대상: Ubuntu 24.04 LTS / 1GB RAM / Seoul (고정 IP 52.78.163.181)
# 실행: sudo bash setup-lightsail.sh
#
# 하는 일
#   0. 사전 점검 (root 권한, OS)
#   1. 스왑 2GB 확보 (1GB RAM에서 npm ci / nest build OOM 방지)
#   2. Node.js 24.x 설치 (NodeSource — CI의 node-version: 24.x와 맞춤)
#   3. Caddy 설치 (공식 apt 저장소)
#   4. 실행 전용 사용자 + /opt/summit-api 디렉토리 구조 생성
#   5. develop 브랜치의 apps/api만 sparse checkout으로 받아오기
#   6. 의존성 설치 + Prisma 클라이언트 생성 + 빌드
#   7. .env 템플릿 생성 (값은 비워 둠, 권한 600)
#   8. systemd 유닛 등록 (enable만, 시작은 .env 입력 후 수동)
#   9. Caddyfile 작성 + 검증 + 재적용
#
# 하지 않는 일
#   - 비밀값 입력 (DATABASE_URL, JWT_SECRET 등은 서버에서 직접 입력)
#   - 방화벽 설정 (Lightsail 콘솔 Networking 탭에서 직접 확인/설정)
#   - API 서비스 시작 (.env가 비어 있으면 기동 시 에러로 재시작 루프에 빠지므로)
#
# 여러 번 실행해도 안전하도록(idempotent) 작성함 — 이미 된 단계는 건너뛴다.
# =============================================================================

set -Eeuo pipefail

# ── 설정값 ────────────────────────────────────────────────────────────────────
APP_USER="summit"
APP_ROOT="/opt/summit-api"
REPO_DIR="${APP_ROOT}/repo"
API_DIR="${REPO_DIR}/apps/api"
ENV_FILE="${APP_ROOT}/.env"
REPO_URL="https://github.com/SUMMIT-Band-Dev/SUMMIT_CONCERT.git"
BRANCH="develop"
SERVICE_NAME="summit-api"
API_DOMAIN="api.summit-concert.live"
API_PORT="3001"
NODE_MAJOR="24"
SWAP_FILE="/swapfile"
SWAP_SIZE="2G"

# ── 출력 헬퍼 ─────────────────────────────────────────────────────────────────
CURRENT_STEP="(시작 전)"
step() { CURRENT_STEP="$1"; echo; echo "=============================================================="; echo "▶ $1"; echo "=============================================================="; }
ok()   { echo "  ✅ $1"; }
info() { echo "  ℹ️  $1"; }
warn() { echo "  ⚠️  $1"; }

# 어느 단계에서 실패했는지 바로 알 수 있게 한다
trap 'echo; echo "❌ 실패: [${CURRENT_STEP}] (line ${LINENO}) — 위 로그를 확인하세요. 스크립트는 다시 실행해도 안전합니다."; exit 1' ERR

# 실행 사용자 권한으로 명령 실행 (npm 캐시 등이 APP_ROOT 아래에 생기도록 -H)
as_app() { sudo -u "${APP_USER}" -H "$@"; }

# =============================================================================
step "0/9 사전 점검"
# =============================================================================
if [[ "${EUID}" -ne 0 ]]; then
  echo "  ❌ root 권한이 필요합니다. 'sudo bash $0' 로 실행하세요."
  exit 1
fi
ok "root 권한 확인"

. /etc/os-release
if [[ "${ID}" != "ubuntu" || "${VERSION_ID}" != "24.04" ]]; then
  warn "Ubuntu 24.04가 아닙니다 (${PRETTY_NAME}). 계속 진행하지만 결과를 확인하세요."
else
  ok "OS: ${PRETTY_NAME}"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git debian-keyring debian-archive-keyring apt-transport-https
ok "기본 패키지 설치 완료 (curl, gnupg, git 등)"

# =============================================================================
step "1/9 스왑 ${SWAP_SIZE} 확보"
# =============================================================================
if swapon --show | grep -q "${SWAP_FILE}"; then
  ok "스왑이 이미 활성화되어 있음 — 건너뜀"
else
  if [[ ! -f "${SWAP_FILE}" ]]; then
    fallocate -l "${SWAP_SIZE}" "${SWAP_FILE}"
    chmod 600 "${SWAP_FILE}"
    mkswap "${SWAP_FILE}"
  fi
  swapon "${SWAP_FILE}"
  grep -q "^${SWAP_FILE} " /etc/fstab || echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
  ok "스왑 활성화 완료"
fi
free -h

# =============================================================================
step "2/9 Node.js ${NODE_MAJOR}.x 설치 (NodeSource)"
# =============================================================================
if command -v node >/dev/null 2>&1 && [[ "$(node -v)" == v${NODE_MAJOR}.* ]]; then
  ok "Node.js $(node -v) 이미 설치됨 — 건너뜀"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
  ok "Node.js 설치 완료"
fi
if [[ "$(node -v)" != v${NODE_MAJOR}.* ]]; then
  echo "  ❌ Node 버전이 ${NODE_MAJOR}.x가 아닙니다: $(node -v)"
  exit 1
fi
info "node $(node -v) / npm $(npm -v) / 경로 $(command -v node)"

# =============================================================================
step "3/9 Caddy 설치 (공식 apt 저장소)"
# =============================================================================
if command -v caddy >/dev/null 2>&1; then
  ok "Caddy 이미 설치됨 ($(caddy version | head -n1)) — 건너뜀"
else
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
  ok "Caddy 설치 완료 ($(caddy version | head -n1))"
fi
systemctl is-active --quiet caddy && ok "caddy 서비스 실행 중" || warn "caddy 서비스가 실행 중이 아님 (9단계에서 다시 시도)"

# =============================================================================
step "4/9 실행 사용자(${APP_USER}) + ${APP_ROOT} 디렉토리 구조 생성"
# =============================================================================
if id -u "${APP_USER}" >/dev/null 2>&1; then
  ok "사용자 ${APP_USER} 이미 존재 — 건너뜀"
else
  # 로그인 불가 시스템 계정. 홈을 APP_ROOT로 두어 npm 캐시도 이 아래에 생기게 한다
  useradd --system --home-dir "${APP_ROOT}" --shell /usr/sbin/nologin "${APP_USER}"
  ok "시스템 사용자 ${APP_USER} 생성"
fi
mkdir -p "${APP_ROOT}"
chown "${APP_USER}:${APP_USER}" "${APP_ROOT}"
chmod 750 "${APP_ROOT}"
ok "${APP_ROOT} 준비 완료"
# 최종 구조:
#   /opt/summit-api/
#     .env          ← 비밀값 (root:root 600, systemd가 root 권한으로 읽음)
#     repo/         ← sparse checkout (apps/api만)
#       apps/api/   ← WorkingDirectory

# =============================================================================
step "5/9 코드 받아오기 (${BRANCH} 브랜치, apps/api만)"
# =============================================================================
if [[ -d "${REPO_DIR}/.git" ]]; then
  info "기존 저장소 발견 — 최신 ${BRANCH}로 갱신"
  as_app git -C "${REPO_DIR}" fetch origin "${BRANCH}"
  as_app git -C "${REPO_DIR}" checkout "${BRANCH}"
  as_app git -C "${REPO_DIR}" pull --ff-only origin "${BRANCH}"
else
  # blob 필터 + sparse checkout으로 apps/api 외 파일은 내려받지 않는다
  as_app git clone --filter=blob:none --no-checkout --branch "${BRANCH}" "${REPO_URL}" "${REPO_DIR}"
  as_app git -C "${REPO_DIR}" sparse-checkout set apps/api
  as_app git -C "${REPO_DIR}" checkout "${BRANCH}"
fi
if [[ ! -f "${API_DIR}/package.json" ]]; then
  echo "  ❌ ${API_DIR}/package.json 이 없습니다. sparse checkout을 확인하세요."
  exit 1
fi
ok "코드 준비 완료 — 커밋 $(as_app git -C "${REPO_DIR}" log -1 --format='%h %s')"

# 포트 바인딩 확인: main.ts가 127.0.0.1에 바인딩하지 않으면 3001이 모든 인터페이스에 열린다.
# Lightsail 방화벽에서 3001을 열지 않으면 외부 노출은 막히지만, 방어선이 하나뿐이 된다.
if grep -q "parseListenHost" "${API_DIR}/src/main.ts"; then
  ok "main.ts 루프백 바인딩 확인"
else
  warn "main.ts가 127.0.0.1에 바인딩하지 않습니다 (0.0.0.0:${API_PORT}로 열림)."
  warn "바인딩 PR 머지 후 이 스크립트를 다시 실행하세요. 그 전까지 Lightsail 방화벽에서 ${API_PORT}를 절대 열지 마세요."
fi

# =============================================================================
step "6/9 의존성 설치 + Prisma 클라이언트 생성 + 빌드"
# =============================================================================
cd "${API_DIR}"
info "npm ci (1GB RAM이라 몇 분 걸릴 수 있음)"
as_app npm ci --no-audit --no-fund
ok "npm ci 완료"

# prisma.config.ts가 로드 시 DATABASE_URL 값을 요구하지만 generate는 DB에 접속하지 않는다.
# CI와 같은 방식으로 자리표시 값만 준다 (실제 접속 정보 아님)
as_app env DATABASE_URL="postgresql://localhost:5432/placeholder" npx prisma generate
ok "Prisma 클라이언트 생성 완료"

as_app npm run build
if [[ ! -f "${API_DIR}/dist/main.js" ]]; then
  echo "  ❌ 빌드 산출물 dist/main.js 가 없습니다."
  exit 1
fi
ok "빌드 완료 (dist/main.js)"

# =============================================================================
step "7/9 .env 템플릿 생성 (${ENV_FILE}, 권한 600)"
# =============================================================================
if [[ -f "${ENV_FILE}" ]]; then
  ok ".env 이미 존재 — 덮어쓰지 않음"
else
  # 비밀값은 비워 둔다. 비밀이 아닌 기본값만 채운다.
  # 각 변수의 상세 설명은 ${API_DIR}/.env.example 참조
  cat > "${ENV_FILE}" <<EOF
# SUMMIT API 운영 환경 변수 — 값은 서버에서 직접 입력 (이 파일은 root만 읽을 수 있음)
# 변수별 상세 설명: ${API_DIR}/.env.example

# [필수·비밀] Supabase Session pooler URL (포트 5432)
DATABASE_URL=

# [필수·비밀] 32자 이상. 생성: node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=
JWT_EXPIRES_IN=2h

# 서버 (Caddy가 127.0.0.1:${API_PORT}로 프록시)
PORT=${API_PORT}
# Caddy 한 대 뒤 = 1
TRUST_PROXY_HOPS=1
# 관리자 프론트 오리진 (https, 콤마 구분, 끝 슬래시 금지). 비우면 크로스 오리진 전부 거부
CORS_ALLOWED_ORIGINS=

# [필수·비밀] Supabase Storage
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SUPABASE_STORAGE_BUCKET=team-cards

# [필수·비밀] 배치 전용 Cloud 프로젝트의 YouTube Data API 키 (프론트 키 재사용 금지)
YOUTUBE_BATCH_API_KEY=
EOF
  ok ".env 템플릿 생성 (값 비어 있음)"
fi
chown root:root "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
ok "권한 확인: $(stat -c '%U:%G %a' "${ENV_FILE}")"

# =============================================================================
step "8/9 systemd 유닛 등록 (${SERVICE_NAME}.service)"
# =============================================================================
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=SUMMIT API (NestJS)
After=network-online.target
Wants=network-online.target
# .env 누락 등으로 기동이 계속 실패하면 60초에 5회 이후 재시도를 멈춘다
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${API_DIR}
# systemd가 root 권한으로 읽은 뒤 환경 변수로 주입한다 (앱 사용자는 파일 자체를 읽지 못함)
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
ExecStart=$(command -v node) dist/main.js

# 자동 재시작
Restart=always
RestartSec=5

# 로그는 journald로 (journalctl -u ${SERVICE_NAME})
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# 하드닝 — 앱은 파일을 쓰지 않는다 (업로드는 multer memoryStorage)
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
ok "${SERVICE_NAME}.service 등록 + 부팅 시 자동 시작 설정 (아직 시작하지 않음)"

# =============================================================================
step "9/9 Caddyfile 작성 (${API_DOMAIN} → 127.0.0.1:${API_PORT})"
# =============================================================================
CADDYFILE="/etc/caddy/Caddyfile"
if [[ -f "${CADDYFILE}" ]] && ! grep -q "${API_DOMAIN}" "${CADDYFILE}"; then
  cp "${CADDYFILE}" "${CADDYFILE}.bak.$(date +%Y%m%d%H%M%S)"
  info "기존 Caddyfile 백업 완료"
fi
cat > "${CADDYFILE}" <<EOF
# SUMMIT API — 자동 HTTPS (Let's Encrypt) + 리버스 프록시
# 인증서 발급 조건: ${API_DOMAIN} A 레코드 → 이 서버 IP, 80/443 인바운드 허용
${API_DOMAIN} {
	encode zstd gzip
	reverse_proxy 127.0.0.1:${API_PORT}
}
EOF
caddy fmt --overwrite "${CADDYFILE}"
caddy validate --config "${CADDYFILE}" --adapter caddyfile
ok "Caddyfile 문법 검증 통과"
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy
systemctl is-active --quiet caddy
ok "Caddy 재적용 완료"

# =============================================================================
trap - ERR
echo
echo "=============================================================="
echo "🎉 서버 구축 스크립트 완료"
echo "=============================================================="
cat <<EOF

남은 작업 (직접 진행):

[1] 방화벽 — Lightsail 콘솔 > 인스턴스 > Networking 탭에서 확인/설정
    - IPv4 규칙: SSH(22), HTTP(80), HTTPS(443)만 허용
    - ${API_PORT}은 열지 않는다 (Caddy만 외부에 노출)
    - IPv6 방화벽 규칙도 같은 기준으로 확인

[2] DNS — ${API_DOMAIN} A 레코드 → 52.78.163.181
    - DNS가 적용되기 전에는 Caddy 인증서 발급이 실패하고 재시도한다 (정상)
    - 확인: journalctl -u caddy -f

[3] 비밀값 입력 — sudo nano ${ENV_FILE}
    필수: DATABASE_URL, JWT_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY, YOUTUBE_BATCH_API_KEY
    확인: CORS_ALLOWED_ORIGINS (관리자 프론트 https 오리진)
    미리 채워진 값: JWT_EXPIRES_IN=2h, PORT=${API_PORT}, TRUST_PROXY_HOPS=1, SUPABASE_STORAGE_BUCKET=team-cards

[4] API 시작 + 확인
    sudo systemctl start ${SERVICE_NAME}
    sudo systemctl status ${SERVICE_NAME}
    journalctl -u ${SERVICE_NAME} -f
    sudo ss -ltnp | grep ${API_PORT}     # 127.0.0.1:${API_PORT} 이어야 함 (0.0.0.0/*이면 바인딩 PR 미반영)
    curl -I https://${API_DOMAIN}

코드 갱신 시: 이 스크립트를 다시 실행한 뒤 sudo systemctl restart ${SERVICE_NAME}
EOF
