# WEAV AI

fal.ai(GPT·Gemini 채팅, Google Imagen·FLUX 이미지) 기반 채팅·이미지 생성 서비스.  
채팅/이미지 세션은 DB에 저장되며, 비동기(Celery)로 처리됩니다.

---

## 요구 사항

- **Docker**, **Docker Compose** (Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop/) 권장)
- (프론트엔드 로컬 실행 시) Node.js 18+
- [fal.ai](https://fal.ai) API 키 → **FAL_KEY**

**Windows**: PowerShell 5+ 또는 CMD에서 `compose.ps1` / `compose.cmd` 사용 시 동일하게 개발 가능합니다.  
(PowerShell에서 스크립트 실행이 막혀 있으면: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` 후 `.\compose.ps1 help` 실행)

### 환경 점검 (Mac · Windows 공통)

| 항목 | Mac / Linux | Windows |
|------|-------------|---------|
| Docker Desktop | 설치 후 `docker compose version` 확인 | 동일 |
| 환경 변수 | `infra/.env`에 `FAL_KEY` 설정 | 동일 |
| 기동 | `make up` | `.\compose.ps1 up` 또는 `compose.cmd up` |
| 테스트 | `make test` | `.\compose.ps1 test` 또는 `compose.cmd test` |
| 헬스체크 | `http://localhost:8080/api/v1/health/` → `{"status":"ok"}` | 동일 (브라우저 또는 curl) |

---

## 1. Docker 올리는 방법

모든 실행·테스트는 **Docker 기준**입니다. 프로젝트 루트에서 진행합니다.

### 1-1. 환경 변수 설정

`infra` 폴더에 `.env` 파일을 두고 다음을 설정합니다.

| 변수 | 설명 | 예시 |
|------|------|------|
| `FAL_KEY` | fal.ai API 키 (필수) | `your_fal_ai_key` |

**팀 협업 시**: 저장소에는 `.env`가 없습니다. 팀원은 `infra/.env.example`을 복사해 `infra/.env`로 만들고, **FAL_KEY** 값만 팀에서 공유받으면 됩니다. (Docker만 사용할 때는 이 파일 하나만 있으면 빌드·기동·테스트 가능. 프론트 로컬 실행 시에는 `frontend/.env.example` → `frontend/.env` 복사 후 `VITE_API_BASE_URL=http://localhost:8080` 사용.)

### 1-2. 이미지 빌드 및 서비스 기동

**macOS / Linux (Makefile):**
```bash
# 프로젝트 루트로 이동
cd ..

make build
make up
```

**Windows (PowerShell):** 프로젝트 루트에서
```powershell
.\compose.ps1 build
.\compose.ps1 up
```

**Windows (CMD):** 프로젝트 루트에서
```cmd
compose.cmd build
compose.cmd up
```

**공통 (어느 OS든):** `infra`에서 직접
```bash
cd infra
docker compose build
docker compose up -d
```

### 1-3. 기동 확인

- **API(경유)**: 브라우저에서 `http://localhost:8080/api/v1/health/` → `{"status":"ok"}` 확인 (Windows에서 `curl` 없으면 브라우저 사용)
- **서비스 목록**: `cd infra` 후 `docker compose ps` 로 postgres, redis, api, worker, nginx 모두 `Up` 인지 확인

### 1-4. 마이그레이션

`api` 컨테이너의 `entrypoint.sh`에서 **자동으로** `migrate`가 실행됩니다.  
수동으로 한 번 더 실행하려면: `make migrate` (macOS/Linux) 또는 `.\compose.ps1 migrate` / `compose.cmd migrate` (Windows)

### 1-5. 서비스 중지

**macOS / Linux:** `make down`  
**Windows:** `.\compose.ps1 down` 또는 `compose.cmd down`

---

## 2. 테스트 진행 방법

**로컬 테스트 환경은 없습니다.** 테스트는 **반드시 Docker 환경**에서만 실행합니다.

### 2-1. 테스트 실행 (권장)

서비스를 띄운 뒤, **프로젝트 루트**에서: `make test` (macOS/Linux) 또는 `.\compose.ps1 test` / `compose.cmd test` (Windows).

- `infra`로 들어가 `api` 컨테이너를 일회성으로 띄우고, 그 안에서 `python manage.py test tests`를 실행합니다.
- `tests` 패키지(헬스체크, 세션 API 등)만 실행됩니다.

### 2-2. 테스트만 실행 (서비스 미기동 상태)

`make up` 없이 테스트만 돌리려면 (DB·Redis 등이 필요하므로 **실제로는 postgres·redis가 떠 있어야** 테스트가 성공할 수 있음):

```bash
make up    # 최소한 postgres, redis, api 실행
make test  # 테스트 실행
```

또는 직접:

```bash
cd infra
docker compose run --rm api python manage.py test tests
```

### 2-3. 테스트 실패 시

- api·postgres·redis 기동 확인: `make up` / `.\compose.ps1 up`
- api 로그: `make logs` / `.\compose.ps1 logs`
- api 컨테이너 셸 접속 후 상세 로그: `make shell` / `.\compose.ps1 shell` → `python manage.py test tests -v 2`

---

## 3. 명령 요약 (macOS/Linux · Windows 동일 동작)

**프로젝트 루트**에서 실행합니다.

| 동작 | macOS / Linux | Windows (PowerShell) | Windows (CMD) |
|------|----------------|----------------------|---------------|
| 도움말 | `make help` | `.\compose.ps1 help` | `compose.cmd help` |
| 이미지 빌드 | `make build` | `.\compose.ps1 build` | `compose.cmd build` |
| 인프라 기동 | `make up` | `.\compose.ps1 up` | `compose.cmd up` |
| 인프라 중지 | `make down` | `.\compose.ps1 down` | `compose.cmd down` |
| 테스트 실행 | `make test` | `.\compose.ps1 test` | `compose.cmd test` |
| 마이그레이션 | `make migrate` | `.\compose.ps1 migrate` | `compose.cmd migrate` |
| api 로그 | `make logs` | `.\compose.ps1 logs` | `compose.cmd logs` |
| api 셸 접속 | `make shell` | `.\compose.ps1 shell` | `compose.cmd shell` |

모든 환경에서 `cd infra` 후 `docker compose ...` 로 직접 실행해도 됩니다.

---

## 4. 프론트엔드 로컬 실행 (선택)

API는 Docker로 `http://localhost:8080`에서 떠 있는 상태를 가정합니다.

`frontend` 폴더에 `.env` 파일을 두고 다음을 설정합니다.

```
VITE_API_BASE_URL=http://localhost:8080
```

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속. `/api` 요청은 Vite 프록시로 `http://localhost:8080`으로 전달됩니다.

---

## 5. 서비스 사용 방법

1. **햄버거 메뉴(☰)**  
   - **새 채팅** / **새 이미지**로 세션 생성  
   - 채팅·이미지 세션 목록에서 기존 세션 선택

2. **채팅**  
   - 모델 선택(Gemini 2.5 Flash/Pro, GPT-4o 등) 후 메시지 입력·전송  
   - 응답은 비동기 처리, 완료 시 자동 갱신

3. **이미지 생성**  
   - 모델 선택(Imagen 4, FLUX Pro v1.1 Ultra) 후 프롬프트 입력·생성  
   - 생성된 이미지는 세션별 목록에 표시

---

## 6. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/v1/health/` | 헬스체크 |
| GET | `/api/v1/sessions/` | 세션 목록 (`?kind=chat` \| `?kind=image`) |
| POST | `/api/v1/sessions/` | 세션 생성 (`kind`, `title`) |
| GET | `/api/v1/sessions/:id/` | 세션 상세 (메시지·이미지 포함) |
| POST | `/api/v1/chat/complete/` | 채팅 전송 (비동기, `session_id`, `prompt`, `model`) |
| POST | `/api/v1/chat/image/` | 이미지 생성 (비동기, `session_id`, `prompt`, `model`) |
| GET | `/api/v1/chat/job/:task_id/` | 비동기 작업 상태·결과 조회 |

---

## 7. 프로젝트 구조

| 경로 | 설명 |
|------|------|
| **backend/** | Django 4 + DRF, Celery, fal.ai 연동 |
| **backend/config/** | 설정(settings, urls, wsgi, celery) |
| **backend/apps/** | users, chats, core, ai |
| **backend/tests/** | 프로젝트 테스트 (Docker에서만 실행) |
| **frontend/** | React 19 + Vite 7 + TypeScript, Tailwind |
| **infra/** | Docker Compose (postgres, redis, api, worker, nginx) |
| **Makefile** | Docker 기준 up, down, build, test, migrate, logs, shell (macOS/Linux) |
| **compose.ps1 / compose.cmd** | Windows에서 동일 명령 (PowerShell/CMD) |
| **00_docs/** | 프로젝트 프레임워크·참고 문서 |

자세한 구성은 [00_docs/프로젝트_프레임워크.md](00_docs/프로젝트_프레임워크.md)를 참고하세요.
