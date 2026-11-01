# apps/api — SUMMIT 관리자 API

어드민의 인증과 모든 쓰기 작업을 처리하는 NestJS API입니다. 전체 구성은 [루트 README](../../README.md), 호출 흐름과 DB 구조는 [아키텍처 문서](../../docs/architecture.md)를 참고하세요.

## 기술 스택

| 기술 | 역할 |
| --- | --- |
| NestJS 12 | 모듈 구성, 라우팅, 전역 Guard |
| Prisma 7 + `@prisma/adapter-pg` | Supabase Postgres 직접 연결, 스키마와 마이그레이션 관리 |
| `@nestjs/jwt`, `@node-rs/argon2` | 액세스 토큰 발급과 비밀번호 해시 |
| class-validator, class-transformer | 요청 DTO 검증 |
| `@nestjs/throttler` | 요청 제한 |
| multer | 이미지 업로드 처리 |
| Vitest, supertest | 테스트 |

## 프로젝트 구조

```text
prisma/
  schema.prisma     DB 스키마
  migrations/       수작성 포함 마이그레이션
  rollback/         마이그레이션별 롤백 SQL
deploy/             Lightsail 배포 문서와 서버 구축 스크립트
src/
  main.ts           기동과 환경 값 검증
  app.module.ts     모듈 조립
  app.setup.ts      HTTP 공통 설정
  common/           CORS, 예외 필터, 공통 유틸리티
  guards/           전역 Guard
  throttling/       요청 제한
  prisma/           PrismaService
  scripts/          관리자 계정 생성
  auth/ teams/ songs/ album-cover/ youtube/ concert-content/
                    도메인 모듈
  geocoding/ storage/ revalidation/
                    외부 연동 모듈
  health/           헬스체크
```

## 도메인별 구조

도메인 모듈은 같은 구조를 따릅니다. 별도 repository 계층 없이 Service가 Prisma를 직접 호출합니다.

| 파일 | 역할 |
| --- | --- |
| `*.controller.ts` | 라우트 정의, DTO 검증 결과를 Service로 전달 |
| `*.service.ts` | CRUD와 비즈니스 로직, 트랜잭션, 재검증 호출 |
| `dto/*.dto.ts` | class-validator 요청 DTO |
| `dto/*-response.ts` | 응답 타입과 매퍼. BigInt id를 문자열로 변환 |
| `*.constants.ts` | 제한값과 오류 메시지 |

| 리소스 | 엔드포인트 | 내용 |
| --- | --- | --- |
| 인증 | `POST /auth/login`, `GET /auth/me` | 로그인, 현재 관리자 조회 |
| 헬스체크 | `GET /health`, `GET /health/db` | 서버 상태, DB 상태 |
| 팀 | `GET·POST /teams`, `PATCH /teams/reorder`, `PATCH /teams/:id`, `PUT /teams/:id/card-image` | 조회, 등록, 순서 재정렬, 수정, 카드 이미지 |
| 곡 | `GET·POST /teams/:teamId/songs`, `PATCH /songs/:id` | 팀별 조회, 등록, 수정 |
| 앨범 커버 | `GET /songs/:id/album-cover/candidates`, `PUT /songs/:id/album-cover` | iTunes 후보 검색, 선택 저장 |
| 유튜브 | `PUT·DELETE /songs/:id/youtube-url` | 영상 연결, 해제 |
| 공연 | `GET·PUT /concert`, `PUT /concert/images/:slot` | 기본 정보, 메인 이미지 |
| 공연장 | `GET·PUT /venue`, `POST /venue/geocode` | 공연장 정보, 주소 좌표 검색 |
| 일차별 공연 | `GET /performance-days`, `PUT /performance-days/:dayKey`, `PUT /performance-days/:dayKey/timetable-image` | 일차 정보, 타임 테이블 이미지 |
| 티켓 | `GET·PUT /ticket`, `PUT /ticket/images/:side` | 설명, 앞뒤 이미지 |
| 안내 섹션 | `GET·PUT /info-sections` | 요금 안내, 관람 유의사항 |

## 인증과 보안

- **기본 인증**: `GlobalGuard`가 요청 제한 후 JWT 인증 순서로 실행합니다. 새 라우트는 기본으로 인증이 필요하고, 공개 라우트는 `POST /auth/login`과 `GET /health`뿐입니다.
- **요청 제한**: 기본은 IP당 분당 300회입니다. 로그인은 5분에 5회이고, 초과하면 15분 차단합니다.
- **CORS**: 허용 목록이 비어 있으면 크로스 오리진 요청을 모두 거부합니다. 와일드카드는 쓸 수 없고, `http:` 오리진은 루프백만 허용합니다.
- **토큰**: 인증은 `Authorization` 헤더로만 처리합니다. 기본 만료는 2시간이고 refresh 토큰은 없습니다.

## 실행

```bash
cp .env.example .env
npm ci
npx prisma generate
npm run start:dev      # http://localhost:3001
npm run seed:admin     # 관리자 계정 생성
```

> `DATABASE_URL`이 가리키는 DB에 실제로 저장됩니다. 쓰기 테스트에는 별도 Supabase 프로젝트를 권장합니다. 요청 제한과 뮤텍스가 프로세스 단위이므로 같은 DB에 API 서버를 둘 이상 띄우지 않습니다.

| 환경 변수 | 필수 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | 예 | Supabase Postgres Session pooler 주소 |
| `JWT_SECRET` | 예 | 32자 이상 |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | 예 | Storage 업로드. 서버 전용 |
| `PUBLIC_SITE_URL`, `REVALIDATE_SECRET` | 예 | 공개 사이트 재검증 호출 |
| `NAVER_MAP_CLIENT_ID`, `NAVER_MAP_CLIENT_SECRET` | 예 | 네이버 Geocoding |
| `CORS_ALLOWED_ORIGINS` | 어드민 연동 시 | 로컬은 `http://localhost:3010` |
| `JWT_EXPIRES_IN`, `PORT`, `LISTEN_HOST`, `TRUST_PROXY_HOPS`, `SUPABASE_STORAGE_BUCKET` | 아니오 | 형식과 기본값은 `.env.example` 참고 |

## 테스트

```bash
npm test
```

`npm test`는 DB에 접속하지 않습니다. Prisma와 Storage를 대체 객체로 바꿔 실행하고, CI도 `DATABASE_URL` 없이 실행합니다. 로컬 부하가 높으면 일부 테스트가 5초 제한을 넘길 수 있으며, 이때는 `npx vitest run --testTimeout=30000`으로 다시 확인합니다. `test:e2e` 스크립트는 있지만 현재 e2e 테스트 파일은 없습니다.

## 마이그레이션과 배포

- 운영 DB 변경은 `npx prisma migrate deploy`만 사용합니다. `migrate dev`는 운영 DB에 쓰지 않습니다.
- API는 Vercel처럼 자동 배포되지 않습니다. 절차는 [배포 문서](deploy/README.md)를 따릅니다.
