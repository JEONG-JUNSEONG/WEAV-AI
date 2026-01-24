# WEAV-AI 프로젝트 문서

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [아키텍처](#아키텍처)
3. [기술 스택](#기술-스택)
4. [프로젝트 구조](#프로젝트-구조)
5. [설치 및 실행](#설치-및-실행)
6. [환경 변수 설정](#환경-변수-설정)
7. [API 엔드포인트](#api-엔드포인트)
8. [주요 기능](#주요-기능)
9. [데이터베이스 구조](#데이터베이스-구조)
10. [보안 정책](#보안-정책)
11. [현재 진행 상황](#현재-진행-상황)
12. [최적화 및 코드 품질](#최적화-및-코드-품질)
13. [디버그 설정 원복 체크리스트](#디버그-설정-원복-체크리스트)
14. [향후 계획](#향후-계획)

---

## 🎯 프로젝트 개요

**WEAV-AI**는 AI 기반 콘텐츠 생성 플랫폼입니다. 사용자가 프로젝트 목표를 입력하면 AI가 자동으로 작업 단계를 계획하고, 각 단계에 맞는 AI 모델을 선택하여 텍스트, 이미지, 비디오를 생성할 수 있습니다.

### 핵심 기능
- 🤖 **AI 기반 프로젝트 계획**: 사용자 목표를 분석하여 단계별 작업 계획 생성
- 💬 **멀티 모델 채팅**: OpenAI GPT, Google Gemini 등 다양한 AI 모델 지원
- 🎨 **이미지 생성**: DALL-E 3 (비동기 Jobs API)
- 🎬 **비디오 생성**: SORA, VEO (비동기 Jobs API)
- 📁 **폴더·채팅 DB 저장**: 로그인 후 작업 내용 DB 유지, 로그아웃·재로그인 시 복원
- 🎨 **다크/라이트 모드**: 사용자 맞춤형 테마 지원
- 🔐 **사용자·멤버십 DB**: 로그인 시 User 저장, 멤버십( free/standard/premium ) 확인
- 👀 **비로그인 둘러보기**: 화면 공개, 기능 사용 시 로그인/멤버십 유도 모달

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자 (브라우저)                        │
└───────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Tunnel (프로덕션)                      │
│              - TLS/SSL 종단 (Termination)                   │
│              - 외부 접근 라우팅                              │
└───────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (리버스 프록시)                        │
│                    - 포트: 8080                              │
│                    - 내부 HTTP 프록시                        │
│                    - 라우팅 (/api → Django)                 │
│                    - 업로드 크기 제한                        │
└───────────────────────┬─────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│   Django + DRF    │          │   React + Vite    │
│   (백엔드 API)     │          │   (프론트엔드)      │
│   - 포트: 8000    │          │   - 포트: 5173    │
└─────────┬─────────┘          └──────────────────┘
          │
          ├─── PostgreSQL (데이터베이스)
          ├─── Redis (캐시/작업 큐)
          ├─── Celery (비동기 작업)
          └─── MinIO (파일 저장소)
```

### 서비스 구성

1. **프론트엔드 (React + TypeScript + Vite)**
   - 사용자 인터페이스
   - 실시간 채팅
   - 파일 관리
   - 테마 설정
   - **중요**: AI API 키는 절대 포함하지 않음

2. **백엔드 (Django + Django REST Framework)**
   - RESTful API 제공
   - AI 서비스 연동 (서버 사이드만)
   - 작업 관리
   - 인증/인가

3. **데이터베이스 (PostgreSQL)**
   - **User** (커스텀, 멤버십·API 키 상태)
   - **Folder / ChatSession** (chats 앱, 사용자별)
   - **Job / Artifact** (jobs 앱, 사용자 연결)
   - 생성물 메타데이터

4. **캐시/큐 (Redis)**
   - 세션 캐싱
   - Celery 작업 큐

5. **비동기 작업 (Celery)**
   - AI 이미지/비디오 생성 (Jobs API 연동)
   - **사용자당 최대 4건 동시 처리**, 초과 시 429
   - 파일 업로드/다운로드, 배치 작업

6. **파일 저장소 (MinIO)**
   - 생성된 이미지/비디오 저장
   - 외장 하드 마운트 지원
   - S3 호환 API

7. **리버스 프록시 (Nginx)**
   - 내부 HTTP 프록시
   - 라우팅 처리
   - 업로드 크기 제한
   - **참고**: SSL/TLS는 프로덕션에서 Cloudflare에서 종단됨

---

## 🛠️ 기술 스택

### 프론트엔드
- **React 18**: UI 프레임워크
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구
- **React Router DOM**: 라우팅
- **Tailwind CSS**: 스타일링
- **Sonner**: Toast 알림
- **React Markdown**: 마크다운 렌더링
- **React Syntax Highlighter**: 코드 하이라이팅
- **Lucide React**: 아이콘

### 백엔드
- **Django 4.2.7**: 웹 프레임워크
- **Django REST Framework**: API 프레임워크
- **PostgreSQL 15**: 관계형 데이터베이스
- **Redis 7**: 캐시/메시지 브로커
- **Celery 5.3.4**: 비동기 작업 큐
- **Gunicorn**: WSGI 서버
- **MinIO**: S3 호환 객체 저장소
- **Nginx**: 리버스 프록시
- **Pydantic 2.x**: 스키마 검증 (v2 호환: `pattern`, `field_validator` 사용)

### AI 서비스
- **OpenAI API**: GPT-4o-mini (Responses API), DALL-E 3, SORA
  - **API 엔드포인트**: `/v1/responses` (Responses API 기준)
  - **인증**: `Authorization: Bearer $OPENAI_API_KEY`
  - **참고**: [OpenAI Responses API 문서](https://platform.openai.com/docs/guides/responses)
- **Google Gemini API**: Gemini 1.5 Flash, Gemini 3 Pro
  - **Python SDK**: `google-genai` (PyPI 패키지명)
  - **공식 문서**: [python-genai 문서](https://googleapis.github.io/python-genai/)
  - **참고**: 
    - 레거시 Python SDK(`google-generativeai`)는 deprecated/아카이브됨, `google-genai` 사용 필수
    - `google-genai`는 early release 단계로 API 변경 가능성이 있음
    - **프로덕션에서는 버전을 고정(pin)하고, 업데이트 시 회귀 테스트를 수행** 권장

### 인프라
- **Docker & Docker Compose**: 컨테이너화
- **Cloudflare Tunnel**: 외부 접근 (프로덕션, TLS 종단)

---

## 📁 프로젝트 구조

**⚠️ 중요: Django 앱 경로 표기 단일화 (재발 방지)**

Django 앱은 다음 경로로 고정되어 있으며, `INSTALLED_APPS`, `import path`, `urls include path`도 이 기준으로만 작성합니다:

- `weavai.apps.core` → `backend/weavai/apps/core/`
- `weavai.apps.storage` → `backend/weavai/apps/storage/`
- `weavai.apps.ai` → `backend/weavai/apps/ai/` (모듈, INSTALLED_APPS 미등록)
- `jobs` → `backend/jobs/` (INSTALLED_APPS: `'jobs'`)
- `users` → `backend/users/` (INSTALLED_APPS: `'users'`)

> **경로 불일치는 실제 500 장애의 원인이 되었으므로, 배포/리팩터링 시 최우선 점검 대상입니다.**

**중요 참고사항:**
- `backend/weavai/apps/jobs/` 디렉토리는 삭제됨 (중복 제거 완료, 2026-01-23)
- 실제 사용: `backend/jobs/` (INSTALLED_APPS: `'jobs'`)
- Celery 작업 경로: `jobs.tasks.cleanup_old_jobs` (not `apps.jobs.tasks`)
- Storage import: `weavai.apps.storage.s3` (not `apps.storage.s3`)

```
WEAV-AI/
├── backend/                    # Django 백엔드
│   ├── weavai/                 # Django 프로젝트 설정
│   │   ├── settings.py        # 설정 파일
│   │   ├── urls.py            # URL 라우팅
│   │   ├── config_celery.py  # Celery 설정
│   │   └── apps/              # Django 앱들 (weavai.apps.*)
│   │       ├── core/          # 핵심 기능 (헬스체크)
│   │       │   └── urls.py    # INSTALLED_APPS: 'weavai.apps.core'
│   │       ├── storage/        # 파일 저장소 관리
│   │       │   ├── s3.py      # S3/MinIO 클라이언트
│   │       │   └── urls.py    # INSTALLED_APPS: 'weavai.apps.storage'
│   │       └── ai/            # AI 서비스 클라이언트 모듈
│   │           ├── router.py  # AI 라우터 (Provider Adapter)
│   │           ├── openai_client.py
│   │           ├── gemini_client.py
│   │           ├── schemas.py # Pydantic 스키마 (v2 호환)
│   │           └── errors.py  # 에러 처리
│   ├── jobs/                   # AI 작업 앱 (INSTALLED_APPS: 'jobs')
│   │   ├── models.py           # Job, Artifact 모델
│   │   ├── views.py            # API 뷰
│   │   ├── serializers.py
│   │   ├── tasks.py            # Celery 작업 (jobs.tasks.*)
│   │   └── urls.py             # URL: include('jobs.urls')
│   ├── users/                  # 사용자 인증 (INSTALLED_APPS: 'users')
│   ├── ai_services/           # AI 서비스 모듈 (레거시)
│   ├── payments/              # 결제 시스템
│   ├── requirements.txt       # Python 의존성
│   ├── Dockerfile             # 백엔드 이미지
│   └── entrypoint.sh          # 컨테이너 시작 스크립트
│
├── infra/                      # 프로덕션 인프라 설정 (권장)
│   ├── docker-compose.yml     # 프로덕션 Docker Compose
│   ├── nginx/                  # 프로덕션 Nginx 설정
│   │   └── conf.d/
│   │       └── weavai.conf
│   └── scripts/                # 초기화 스크립트
│
└── [레거시/로컬 개발용 파일]
    ├── backend/docker-compose.yml  # 로컬 개발용 (선택사항)
    ├── backend/nginx/              # 로컬 개발용 (선택사항)
    └── backend/Dockerfile.backend # 로컬 개발용 (선택사항)

**레거시/로컬 개발용 파일**

다음 파일들은 **로컬 개발 환경에서만 사용**되며, 프로덕션에서는 `infra/` 디렉토리의 설정을 사용합니다:

- `backend/docker-compose.yml` - 로컬 개발용 Docker Compose (선택사항)
- `backend/nginx/` - 로컬 개발용 Nginx 설정 (선택사항)
- `backend/Dockerfile.backend` - 로컬 개발용 Dockerfile (선택사항)

**프로덕션 배포 시**: `infra/docker-compose.yml`과 `infra/nginx/`를 사용하세요.

```
WEAV-AI/
├── backend/                    # Django 백엔드
│   ├── weavai/                 # Django 프로젝트 설정
│   │   ├── settings.py        # 설정 파일
│   │   ├── urls.py            # URL 라우팅
│   │   ├── config_celery.py  # Celery 설정
│   │   └── apps/              # Django 앱들 (weavai.apps.*)
│   │       ├── core/          # 핵심 기능 (헬스체크)
│   │       ├── storage/        # 파일 저장소 관리
│   │       └── ai/            # AI 서비스 클라이언트 모듈
│   ├── jobs/                   # AI 작업 앱 (INSTALLED_APPS: 'jobs')
│   ├── users/                  # 사용자 인증
│   ├── requirements.txt       # Python 의존성
│   ├── Dockerfile             # 백엔드 이미지
│   └── entrypoint.sh          # 컨테이너 시작 스크립트
│
├── src/                        # React 프론트엔드
│   ├── components/            # React 컴포넌트
│   │   ├── auth/              # 인증 (LoginView, ProtectedRoute)
│   │   ├── chat/              # 채팅 UI
│   │   ├── gallery/           # 미디어 갤러리
│   │   ├── layout/            # 레이아웃
│   │   ├── membership/        # 멤버십 유도 모달
│   │   ├── settings/          # 설정 모달
│   │   └── ui/                # UI 컴포넌트
│   ├── contexts/              # React Context
│   │   ├── AuthContext.tsx    # 인증·userInfo(멤버십)
│   │   ├── ChatContext.tsx    # 채팅 (chatApi 연동)
│   │   ├── FolderContext.tsx  # 폴더 (chatApi 연동)
│   │   └── ThemeContext.tsx   # 테마
│   ├── services/              # API 서비스
│   │   ├── aiService.ts       # AI (Jobs 비동기+폴링)
│   │   ├── apiClient.ts       # JWT·API 공통
│   │   ├── chatApi.ts         # 채팅·폴더 API
│   │   ├── userService.ts     # 사용자·JWT
│   │   └── firebase.ts        # Firebase 인증
│   ├── hooks/                 # 커스텀 훅
│   ├── constants/             # 상수 정의
│   └── types.ts               # TypeScript 타입
│
├── infra/                      # 인프라 설정
│   ├── docker-compose.yml     # Docker Compose 설정
│   ├── nginx/                  # Nginx 설정
│   │   └── conf.d/
│   │       └── weavai.conf
│   └── scripts/                # 초기화 스크립트
│
├── dist/                       # 빌드 결과물
├── package.json                # 프론트엔드 의존성
├── vite.config.ts              # Vite 설정
└── README.md                   # 프로젝트 README
```

---

## 🚀 설치 및 실행

### 사전 요구사항
- Docker & Docker Compose
- Node.js 18+ (프론트엔드 개발용)
- Python 3.12+ (백엔드 개발용, 선택사항)

### 1. 저장소 클론
```bash
git clone <repository-url>
cd WEAV-AI
```

### 2. 환경 변수 설정

#### 백엔드 환경 변수 (`backend/.env`)
```bash
# Django 설정
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# 데이터베이스 (Docker 컨테이너 내부 기준)
POSTGRES_DB=weavai
POSTGRES_USER=weavai_user
POSTGRES_PASSWORD=your-password
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis (Docker 컨테이너 내부 기준)
REDIS_URL=redis://redis:6379/0

# AI 서비스 API 키 (절대 프론트엔드에 노출 금지)
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...
OPENAI_TEXT_MODEL=gpt-4o-mini
GEMINI_TEXT_MODEL=gemini-1.5-flash

# MinIO 스토리지 (Docker 컨테이너 내부 기준)
AWS_ACCESS_KEY_ID=weavai_app_key
AWS_SECRET_ACCESS_KEY=weavai_app_secret
AWS_STORAGE_BUCKET_NAME=weavai-files
AWS_S3_ENDPOINT_URL=http://minio:9000
```

#### 인프라 환경 변수 (`infra/.env`)
```bash
# Docker Compose에서 사용하는 환경 변수
SECRET_KEY=your-secret-key
POSTGRES_PASSWORD=your-password

# MinIO Root 자격증명 (관리자용)
MINIO_ROOT_USER=weavai_admin
MINIO_ROOT_PASSWORD=your-strong-random-password

# MinIO 앱 자격증명 (Django용)
MINIO_ACCESS_KEY=weavai_app_key
MINIO_SECRET_KEY=weavai_app_secret

# AI 서비스 API 키
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...
OPENAI_TEXT_MODEL=gpt-4o-mini
GEMINI_TEXT_MODEL=gemini-1.5-flash
AI_PROVIDER_DEFAULT=openai
MAX_TEXT_CHARS=8000
MAX_OUTPUT_TOKENS=1024
```

#### 프론트엔드 환경 변수 (`.env`)
```bash
# Firebase 인증 (프로덕션용)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# API 엔드포인트
VITE_API_BASE_URL=http://localhost:8080

# ⚠️ 절대 금지: AI API 키를 VITE_ 접두사로 넣는 것
# VITE_OPENAI_API_KEY=...  ❌ 금지
# VITE_GEMINI_API_KEY=...  ❌ 금지
```

### 3. 백엔드 실행 (Docker Compose)

```bash
cd infra
docker compose up -d
```

이 명령은 다음 서비스들을 시작합니다:
- PostgreSQL (데이터베이스)
- Redis (캐시/큐)
- MinIO (파일 저장소)
- Django API (Gunicorn)
- Celery Worker (비동기 작업)
- Nginx (리버스 프록시)

### 4. 데이터베이스 마이그레이션

```bash
cd infra
docker compose run --rm --entrypoint "" api python manage.py migrate
```
> API 컨테이너 기본 entrypoint가 Gunicorn이므로, 마이그레이션 시 `--entrypoint ""`로 override.

### 5. 프론트엔드 실행

```bash
# 개발 모드
npm install
npm run dev

# 프로덕션 빌드
npm run build
```

### 6. 접속

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:8080/api/v1/
- **MinIO 콘솔**: http://localhost:9001
- **Django Admin**: http://localhost:8080/admin/

---

## 🔧 환경 변수 설정

### 필수 환경 변수

#### Django 설정
- `SECRET_KEY`: Django 시크릿 키 (보안 필수, 랜덤 문자열)
- `DEBUG`: 디버그 모드 (프로덕션에서는 False)
- `ALLOWED_HOSTS`: 허용된 호스트 목록

#### 데이터베이스

**Docker 컨테이너 내부 기준 (권장)**
```bash
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=weavai
POSTGRES_USER=weavai_user
POSTGRES_PASSWORD=your-password
```

**호스트에서 직접 실행할 때 (개발용)**
```bash
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=weavai
POSTGRES_USER=weavai_user
POSTGRES_PASSWORD=your-password
```

#### Redis

**Docker 컨테이너 내부 기준 (권장)**
```bash
REDIS_URL=redis://redis:6379/0
```

**호스트에서 직접 실행할 때 (개발용)**
```bash
REDIS_URL=redis://127.0.0.1:6379/0
```

#### AI 서비스
- `OPENAI_API_KEY`: OpenAI API 키 (필수)
- `GEMINI_API_KEY`: Google Gemini API 키 (선택)
- `OPENAI_TEXT_MODEL`: 기본 텍스트 모델 (기본값: gpt-4o-mini)
- `GEMINI_TEXT_MODEL`: 기본 Gemini 모델 (기본값: gemini-1.5-flash)
- `AI_PROVIDER_DEFAULT`: 기본 AI 제공자 (기본값: openai)
- `MAX_TEXT_CHARS`: 최대 입력 길이 (기본값: 8000)
- `MAX_OUTPUT_TOKENS`: 최대 출력 토큰 (기본값: 1024)

**⚠️ 보안 주의사항**
- 모든 AI API 키는 **백엔드에서만** 사용
- 프론트엔드 `.env`에 `VITE_OPENAI_API_KEY` 또는 `VITE_GEMINI_API_KEY`를 넣는 것은 **절대 금지**
- 모든 AI 호출은 Django 백엔드를 통해 프록시 처리

#### 파일 저장소 (MinIO)

**MinIO 자격증명 정책 (중요)**

> ⚠️ **MinIO Root 자격증명 경고**
> - `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`는 루트(관리자) 계정입니다.
> - **기본값 `minioadmin`은 프로덕션에서 절대 사용 금지** (긴 랜덤 비밀번호 권장).
> - 애플리케이션용 Access/Secret Key는 **별도 정책/유저로 분리**하세요.

MinIO는 두 가지 계정 레벨을 사용합니다:

1. **Root 계정** (관리자용)
   - `MINIO_ROOT_USER`: MinIO 관리자 사용자명
   - `MINIO_ROOT_PASSWORD`: MinIO 관리자 비밀번호 (길고 랜덤하게 설정)
   - **기본값 `minioadmin` 사용 금지** (보안 위험)
   - 용도: MinIO 콘솔 접근, 버킷 생성/삭제 등 관리 작업

2. **앱 계정** (Django용)
   - `MINIO_ACCESS_KEY`: Django 앱 전용 액세스 키
   - `MINIO_SECRET_KEY`: Django 앱 전용 시크릿 키
   - 최소 권한으로 발급하여 사용 권장
   - 용도: 파일 업로드/다운로드

**Docker 컨테이너 내부 기준 (권장)**
```bash
# MinIO Root (관리자)
MINIO_ROOT_USER=weavai_admin
MINIO_ROOT_PASSWORD=your-strong-random-password

# MinIO 앱 자격증명 (Django용)
AWS_ACCESS_KEY_ID=weavai_app_key
AWS_SECRET_ACCESS_KEY=weavai_app_secret
AWS_STORAGE_BUCKET_NAME=weavai-files
AWS_S3_ENDPOINT_URL=http://minio:9000
```

**호스트에서 직접 실행할 때 (개발용)**
```bash
AWS_S3_ENDPOINT_URL=http://127.0.0.1:9000
```

**MinIO 보안 권장사항**
- Root 비밀번호는 최소 32자 이상의 랜덤 문자열 사용
- 오브젝트는 기본적으로 Private으로 설정
- Presigned URL로만 임시 접근 허용 (기본 만료: 1시간 권장)
- **시크릿 관리**: 가능하면 Docker secrets/파일 기반 시크릿으로 전환
  - 환경변수(`export`)는 `docker inspect` 같은 경로로 평문 노출될 수 있음
  - 프로덕션에서는 K8s Secret, Docker Secret, 파일 기반 시크릿 사용 권장
- 참고: [MinIO 보안 모범 사례](https://min.io/docs/minio/linux/administration/identity-access-management/policy-based-access-control.html)

---

## 📡 API 엔드포인트

### 헬스 체크
```http
GET /api/v1/health/
```

**응답:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-23T08:29:15.818495+00:00",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "django": "healthy",
    "celery": "unknown"
  }
}
```

### AI 작업 생성 (OpenAI - Responses API 기준)

**우리 백엔드 API 호출:**
```http
POST /api/v1/jobs/
Content-Type: application/json

{
  "provider": "openai",
  "model_id": "gpt-4o-mini",
  "arguments": {
    "input_text": "Tell me a joke",
    "system_prompt": "You are a helpful assistant.",
    "temperature": 0.7,
    "max_output_tokens": 1000
  },
  "store_result": true
}
```

**응답 (OpenAI Responses API 형식):**
```json
{
  "id": "0b392abe-317e-4219-83cc-e764119b5c5f",
  "status": "COMPLETED",
  "result": {
    "provider": "openai",
    "model": "gpt-4o-mini-2024-07-18",
    "text": "Why do programmers prefer dark mode?\n\nBecause light attracts bugs!",
    "usage": {
      "prompt_tokens": 25,
      "completion_tokens": 12,
      "total_tokens": 37
    },
    "finish_reason": "stop"
  },
  "message": "AI 작업이 성공적으로 완료되었습니다."
}
```

**참고**: 
- OpenAI Responses API는 OpenAI가 권장하는 최신 인터페이스입니다. 이 문서의 모든 OpenAI 예시는 Responses API 기준으로 작성되었습니다.
- **OpenAI API 직접 호출 예시** (참고용, 실제로는 백엔드를 통해 호출):
```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "input": "Tell me a joke."
  }'
```
- Streaming이 필요한 경우: `"stream": true` 옵션 추가

### AI 작업 생성 (Gemini - Google GenAI SDK 기준)

**우리 백엔드 API 호출:**
```http
POST /api/v1/jobs/
Content-Type: application/json

{
  "provider": "gemini",
  "model_id": "gemini-1.5-flash",
  "arguments": {
    "input_text": "Hello, AI!",
    "system_prompt": "You are a helpful assistant.",
    "temperature": 0.7,
    "max_output_tokens": 1000
  },
  "store_result": true
}
```

**참고**: 
- Gemini API는 **Google GenAI SDK (`google-genai`)**를 사용합니다.
- 레거시 Python SDK는 deprecated/아카이브되었으므로 사용하지 않습니다.
- 공식 문서: [python-genai 문서](https://googleapis.github.io/python-genai/)

### 작업 조회 (폴링용)
```http
GET /api/v1/jobs/{job_id}/
Authorization: Bearer <JWT>
```
- `status`: `IN_QUEUE` | `IN_PROGRESS` | `COMPLETED` | `FAILED`
- `COMPLETED` 시 `result` (type, url/text 등) 포함

### 작업 목록 (사용자별)
```http
GET /api/v1/jobs/
Authorization: Bearer <JWT>
```

### 채팅·폴더 (인증 필수)
- `GET/POST /api/v1/chats/folders/` - 폴더 목록/생성
- `GET/PUT/DELETE /api/v1/chats/folders/<uuid>/` - 폴더 상세
- `GET /api/v1/chats/chats/?folder=<uuid>` - 채팅 목록 (폴더별 또는 최근)
- `POST /api/v1/chats/chats/` - 채팅 생성
- `GET/PUT/DELETE /api/v1/chats/chats/<uuid>/` - 채팅 상세

### 인증
- `POST /api/v1/auth/verify-firebase-token/` - Firebase 토큰 검증, JWT 발급, **User·멤버십 DB 저장**
- `GET /api/v1/auth/profile/` - 프로필·멤버십 조회

---

## ✨ 주요 기능

### 1. AI 기반 프로젝트 계획
사용자가 프로젝트 목표를 입력하면 AI가 자동으로:
- 작업 단계 분해
- 각 단계에 적합한 AI 모델 선택
- 추천 프롬프트 생성

**예시:**
```
사용자 입력: "안전하게 월 200만원씩 받을 수 있는 미국 배당주 포트폴리오"

AI 생성 결과:
1. 투자자금 역산 및 투자 전략 수립 (GPT-4)
2. 종목 선정 및 월 배당 로드맵 구성 (Gemini)
```

### 2. 멀티 모델 채팅
- **OpenAI GPT**: 고품질 텍스트 생성 (Responses API 사용)
- **Google Gemini**: 빠른 응답, 비용 효율적 (Google GenAI SDK 사용)
- **DALL-E 3**: 고품질 이미지 생성
- **SORA/VEO**: 비디오 생성 (준비 중)

### 3. 폴더 기반 관리
- 프로젝트별 폴더 생성
- 각 폴더 내 다중 채팅 세션
- 생성물 자동 분류 및 저장

### 4. 테마 시스템
- 다크/라이트 모드 전환
- 포인트 컬러 커스터마이징
- 실시간 테마 적용

### 5. 에러 처리
- Error Boundary로 앱 안정성 확보
- Toast 알림으로 사용자 피드백
- 상세한 에러 로깅

---

## 🗄️ 데이터베이스 구조

### User 모델 (커스텀, `users.User`, `AUTH_USER_MODEL`)
- `username`: Firebase UID
- `email`, `first_name`, `last_name`, `photo_url`
- **멤버십**: `membership_type` (free/standard/premium), `membership_expires_at`
- **API 키 상태**: `has_openai_key`, `has_gemini_key`
- `last_login_at`
- `is_membership_active`, `can_use_premium_features` (property)

### Folder / ChatSession (chats 앱)
- **Folder**: `user`, `name`, `type`, `created_at`
- **ChatSession**: `user`, `folder`(nullable), `title`, `messages`(JSON), `model_id`, `system_instruction`, `recommended_prompts`(JSON), `last_modified`, `created_at`

### Job 모델
- `user` (FK, 사용자 연결), `status` (IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED)
- `provider`, `model_id`, `arguments`, `result_json`, `error`, `created_at`, `updated_at`

### Artifact 모델
- `job` (FK), `kind` (text/image/video/file), `s3_key`, `text_content`, `presigned_url`, `mime_type`, `size_bytes`, `created_at`

---

## 🔒 보안 정책

### OpenAI API 키 보안 원칙

**절대 금지 (클라이언트 유출):**
- ❌ `VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY` 등 **클라이언트 번들에 포함되는 키 주입**
  - **이유**: Vite의 `VITE_*` 환경변수는 빌드 시 번들에 주입되어 클라이언트 코드에 노출됩니다. 브라우저 개발자 도구에서 누구나 확인 가능합니다.
- ❌ 브라우저/앱(클라이언트)에서 OpenAI/Gemini API를 직접 호출
- ❌ 클라이언트 사이드 코드에서 AI API 키를 하드코딩하는 것

**올바른 방법 (서버-사이드 프록시):**
- ✅ 모든 AI 키는 **백엔드(Django) 환경변수/Secret**로만 주입
- ✅ 프론트엔드는 `/api/v1/jobs/` 같은 **우리 백엔드 엔드포인트만 호출**
- ✅ 환경 변수는 `.env` 파일로 관리하고 Git에 커밋하지 않음

### API 남용 방지 및 비용 관리 (운영 필수)

**서버-사이드 프록시를 사용할 때 반드시 필요한 보안 조치:**

1. **인증 필수**
   - `/api/v1/jobs/`는 **인증된 유저만 호출 가능**
   - JWT 토큰 또는 최소한 임시 토큰/비밀키 검증 필수
   - 인증 없이 호출 시 `401 Unauthorized` 반환

2. **Rate Limit / Quota 강제**
   - 유저별 Rate Limit 적용 (예: 분당 N회, 시간당 M회)
   - 일일 토큰 사용량 제한 (Quota)
   - 일일 작업 수 제한
   - 초과 시 `429 Too Many Requests` 반환

3. **모델 Allowlist**
   - `model_id`는 **서버 측 Allowlist로만 허용**
   - 클라이언트가 임의 모델을 호출하지 못하도록 제한
   - 허용되지 않은 모델 요청 시 `400 Bad Request` 반환

4. **파라미터 상한 적용**
   - `max_output_tokens`, `max_text_chars`는 **서버가 최종 상한 적용**
   - 클라이언트 입력값을 그대로 신뢰하지 않고 서버 측 검증/제한
   - 상한 초과 시 자동으로 상한값으로 조정 또는 `400 Bad Request` 반환

**API 남용 방지 근거:**
- OpenAI/Gemini API는 사용량 기반 과금이므로 남용 시 비용 폭발 위험
- 클라이언트에서 직접 호출 시 악의적/실수로 인한 대량 요청 가능
- 서버 측 검증으로 비용 및 보안 리스크 최소화

**API 키 보안 근거:**
- OpenAI 공식 문서: [API 키 보안 가이드](https://platform.openai.com/docs/guides/production-best-practices/api-keys)
- OpenAI는 "브라우저/모바일 앱 같은 클라이언트에 API 키를 배포하지 말 것"을 명시
- Vite 공식 문서: `VITE_*` 접두사 환경변수는 클라이언트 번들에 포함됨

### Gemini API 키 보안 원칙

- OpenAI와 동일한 보안 원칙 적용
- 모든 Gemini API 호출은 백엔드에서만 수행

### 데이터 보안
- ✅ **JWT 인증**: 사용자 인증 토큰
- ✅ **HTTPS**: 프로덕션 환경에서 SSL/TLS 적용 (Cloudflare에서 종단)
- ✅ **CORS 설정**: 허용된 도메인만 접근 가능
- ✅ **MinIO 보안**: Root 비밀번호 강화, Presigned URL 사용

### 운영 기본값 (권장)

**파일 저장소 (MinIO)**
- Presigned URL 기본 만료: **1시간** (3600초)
- 파일은 기본적으로 **Private**으로 설정
- 업로드 사이즈 제한: 서버 측에서 최대 크기 제한 (예: 100MB)
- 허용 확장자: 서버 측 Allowlist로 제한 (예: 이미지: jpg, png, webp / 비디오: mp4, webm)

**Celery 비동기 작업**
- Retry 정책: 실패 시 최대 3회 재시도
- Backoff 정책: 지수 백오프 (1초 → 2초 → 4초)
- 비디오/장시간 작업: 타임아웃 설정 (예: 10분)
- 작업 큐 분리: 텍스트/이미지/비디오 작업을 별도 큐로 분리

**AI 모델 통합 구조 (Provider Adapter)**

`weavai/apps/ai/`는 Provider별 어댑터(OpenAI/Gemini/FAL)를 동일한 인터페이스로 감싸고, Jobs는 공통 Job/Artifact 스키마로만 처리합니다.

- **AI Router** (`router.py`): Provider와 모델 타입에 따라 적절한 클라이언트로 라우팅
- **Provider Adapters**: 
  - `openai_client.py`: OpenAI API 클라이언트
  - `gemini_client.py`: Google Gemini API 클라이언트
- **공통 스키마**: `schemas.py`에서 요청/응답 스키마 통일
- **에러 처리**: `errors.py`에서 Provider별 에러를 공통 형식으로 변환
- **Jobs 앱**: Provider와 무관하게 Job/Artifact 모델로 결과 저장

### Nginx 보안 설정

**proxy_intercept_errors 동작:**
- **정의**: 업스트림(예: Django)이 300+ 상태 코드를 응답했을 때, 그 응답을 그대로 내보낼지 vs Nginx가 가로채서 `error_page`로 처리할지를 결정합니다.
- **기본값**: `off` (Nginx 공식 기본값, 업스트림 응답을 그대로 전달)
- `proxy_intercept_errors on`: 업스트림(예: Django)의 4xx/5xx 본문을 Nginx가 가로채 `error_page`로 대체할 수 있음
- `proxy_intercept_errors off`: 업스트림 에러 바디/헤더를 그대로 보이게 함
- **디버그 중**: `off`로 두어 Django의 상세한 에러 메시지 확인 (에러가 가려지지 않음)
- **프로덕션**: 운영 정책에 따라 `on` 또는 `off` 선택

---

## 📊 현재 진행 상황

### ✅ 완료된 기능

#### 프론트엔드
- [x] React + TypeScript + Vite, 다크/라이트 모드, 채팅·폴더 UI
- [x] **비로그인 둘러보기**: 화면 공개, 기능 사용 시 로그인/멤버십 유도 (검정 화면 없음)
- [x] **로그아웃 시 빈 페이지** 이동, 채팅 상태 초기화
- [x] 채팅·폴더 **DB 연동** (chatApi), 디바운스 저장
- [x] **MembershipModal** (로그인/멤버십 업그레이드 유도), ModelSelector/ChatInput 멤버십 체크
- [x] 이미지/비디오 생성 → **Jobs 비동기 + 폴링** (aiService)
- [x] Error Boundary, Toast, React Router, Context API

#### 백엔드
- [x] **커스텀 User** (`users.User`) + 멤버십 (free/standard/premium), API 키 상태
- [x] **chats 앱**: Folder, ChatSession, 사용자별 CRUD API
- [x] **Jobs 사용자 연결**: `GET/POST /jobs/`, `GET /jobs/<id>/`, **Celery 비동기**, 사용자당 최대 4건 동시, 429 초과 시
- [x] Redis 캐시·Celery 브로커, MinIO, Nginx, Docker Compose
- [x] Firebase 토큰 검증 → JWT + **User·멤버십 DB 저장**

#### 인프라
- [x] Docker, Docker Compose, Nginx, 마이그레이션, 헬스체크

### 🔄 진행 중

- [ ] Gemini API 연동 (코드 완료, 운영 테스트)
- [ ] 실시간 작업 진행률 UI (선택)

### 📋 향후 계획

- [ ] 결제 (Stripe), `/pricing` 페이지
- [ ] Rate Limit / Quota 강화
- [ ] 파일 업로드/다운로드, 프로덕션 배포 (Cloudflare Tunnel)

---

## 🔧 디버그 설정 원복 체크리스트

디버깅 중에 활성화한 임시 설정들을 **반드시 원복**해야 합니다.

### 백엔드 설정 (`backend/weavai/settings.py`)

- [ ] `DEBUG = False` (프로덕션에서는 반드시 False)
- [ ] `DEBUG_PROPAGATE_EXCEPTIONS = False` (디버그 완료 후 제거)
- [ ] `LOGGING` 설정: 프로덕션에 맞게 조정 (민감 정보 로깅 제거)

### Docker Compose 설정 (`infra/docker-compose.yml`)

- [ ] `api` 서비스의 `ports` 섹션 제거 (디버그용 포트 바인딩)
  ```yaml
  # 제거할 부분:
  ports:
    - "127.0.0.1:8000:8000"
  ```

### Nginx 설정 (`infra/nginx/conf.d/weavai.conf`)

- [ ] `proxy_intercept_errors` 설정 검토
  - 디버그 중: `proxy_intercept_errors off` (Django 에러 확인용)
  - 프로덕션: 운영 정책에 따라 `on` 또는 `off` 선택
  - **근거**: `on`이면 300+ 응답을 Nginx가 error_page로 가로채서 커스텀 에러 페이지로 대체

### Gunicorn 로그 설정 (`backend/entrypoint.sh`)

- [ ] 프로덕션에서는 `--log-level info` 사용 (디버그용 `debug` 제거)
- [ ] `--capture-output` 유지 (표준 출력 캡처는 유지해도 됨)

### 환경 변수

- [ ] `.env` 파일이 Git에 커밋되지 않았는지 확인
- [ ] 실제 API 키가 테스트 키로 교체되지 않았는지 확인

---

## 🧹 최적화 및 코드 품질

### 완료된 최적화 작업

#### 1. 프로젝트 구조 정리
- ✅ `backend/weavai/apps/jobs/` 중복 디렉토리 삭제
- ✅ 실제 사용 경로 명확화 (`backend/jobs/` 사용)
- ✅ 레거시 파일 문서화 (README 업데이트)

#### 2. 코드 정리
- ✅ 사용하지 않는 import 제거
  - `backend/jobs/models.py`: `MinValueValidator`, `MaxValueValidator`
  - `backend/jobs/views.py`: `generics`, `ReadOnlyModelViewSet`, `get_object_or_404`, `action`, `settings`
  - `backend/weavai/apps/ai/openai_client.py`: `json`
- ✅ 레거시 코드 주석 처리 (FAL.ai 관련 코드)
- ✅ Pydantic v2 호환성 수정
  - `regex` → `pattern` 변경
  - `validator` → `field_validator` 변경
  - `@classmethod` 데코레이터 추가

#### 3. 경로 수정 및 검증
- ✅ Celery 작업 경로: `apps.jobs.tasks` → `jobs.tasks`
- ✅ Storage import: `apps.storage.s3` → `weavai.apps.storage.s3`
- ✅ 모든 import 경로 테스트 및 검증 완료

#### 4. 테스트 결과
- ✅ Django 시스템 체크: 통과 (0 issues)
- ✅ Python 문법 검사: 통과
- ✅ 모든 import 경로: 정상 작동
- ✅ Job app_label: `jobs` (올바른 앱 레이블)

---

## 🧪 테스트

### API 테스트

#### 헬스 체크
```bash
curl http://localhost:8080/api/v1/health/
```

#### OpenAI 텍스트 생성 (Responses API)
```bash
# 우리 백엔드 API를 통한 호출 (권장)
curl -X POST http://localhost:8080/api/v1/jobs/ \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model_id": "gpt-4o-mini",
    "arguments": {
      "input_text": "Tell me a joke",
      "system_prompt": "You are a helpful assistant."
    }
  }'

# OpenAI API 직접 호출 예시 (참고용, 실제로는 백엔드 사용)
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "input": "Tell me a joke."
  }'
```

#### Gemini 텍스트 생성 (Google GenAI SDK)
```bash
# 우리 백엔드 API를 통한 호출 (권장)
curl -X POST http://localhost:8080/api/v1/jobs/ \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "model_id": "gemini-1.5-flash",
    "arguments": {
      "input_text": "Hello, AI!"
    }
  }'
```

---

## 🧹 최적화 및 코드 품질

### 완료된 최적화 작업

#### 1. 프로젝트 구조 정리
- ✅ `backend/weavai/apps/jobs/` 중복 디렉토리 삭제
- ✅ 실제 사용 경로 명확화 (`backend/jobs/` 사용)
- ✅ 레거시 파일 문서화 (README 업데이트)

#### 2. 코드 정리
- ✅ 사용하지 않는 import 제거
  - `backend/jobs/models.py`: `MinValueValidator`, `MaxValueValidator`
  - `backend/jobs/views.py`: `generics`, `ReadOnlyModelViewSet`, `get_object_or_404`, `action`, `settings`
  - `backend/weavai/apps/ai/openai_client.py`: `json`
- ✅ 레거시 코드 주석 처리 (FAL.ai 관련 코드)
- ✅ Pydantic v2 호환성 수정
  - `regex` → `pattern` 변경
  - `validator` → `field_validator` 변경
  - `@classmethod` 데코레이터 추가

#### 3. 경로 수정 및 검증
- ✅ Celery 작업 경로: `apps.jobs.tasks` → `jobs.tasks`
- ✅ Storage import: `apps.storage.s3` → `weavai.apps.storage.s3`
- ✅ 모든 import 경로 테스트 및 검증 완료

#### 4. 테스트 결과
- ✅ Django 시스템 체크: 통과 (0 issues)
- ✅ Python 문법 검사: 통과
- ✅ 모든 import 경로: 정상 작동
- ✅ Job app_label: `jobs` (올바른 앱 레이블)

---

## 🐛 문제 해결

### 일반적인 문제

#### 1. 컨테이너가 시작되지 않음
```bash
# 로그 확인
docker compose logs api

# 컨테이너 재시작
docker compose restart api
```

#### 2. 데이터베이스 연결 실패
```bash
# PostgreSQL 상태 확인
docker compose ps postgres

# 데이터베이스 재시작
docker compose restart postgres
```

#### 3. API 키 인증 실패
```bash
# 환경 변수 확인 (컨테이너 내부)
docker compose exec api python -c "import os; print('OPENAI:', bool(os.getenv('OPENAI_API_KEY')))"

# .env 파일 확인
cat infra/.env | grep OPENAI_API_KEY

# 주의: backend/.env와 infra/.env 모두 확인 필요
```

#### 4. 마이그레이션 오류
```bash
# 마이그레이션 재생성
docker compose exec api python manage.py makemigrations

# 마이그레이션 적용
docker compose exec api python manage.py migrate
```

#### 5. Nginx가 Django 에러를 가로채는 경우
```bash
# Nginx 설정 확인
cat infra/nginx/conf.d/weavai.conf | grep proxy_intercept_errors

# 디버그 중에는 off로 설정
# proxy_intercept_errors off;
```

---

## 📚 추가 자료

### 관련 문서
- [Django 공식 문서](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [React 공식 문서](https://react.dev/)
- [OpenAI API 문서](https://platform.openai.com/docs)
- [OpenAI Responses API](https://platform.openai.com/docs/guides/responses)
- [Google Gemini API 문서](https://ai.google.dev/docs)
- [Google GenAI SDK (python-genai) 공식 문서](https://googleapis.github.io/python-genai/)
- [Google GenAI SDK GitHub](https://github.com/google/generative-ai-python)
- [MinIO 보안 모범 사례](https://min.io/docs/minio/linux/administration/identity-access-management/policy-based-access-control.html)

### 프로젝트 내 문서
- `README.md`: 기본 프로젝트 정보
- `SecretValue_Setting.md`: 환경 변수 설정 가이드
- `Project_Preview.md`: 프로젝트 미리보기

---

## 👥 기여 가이드

### 코드 스타일
- **Python**: PEP 8 준수
- **TypeScript**: ESLint 규칙 준수
- **커밋 메시지**: 명확하고 설명적인 메시지 작성

### 브랜치 전략
- `main`: 프로덕션 배포용
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발 브랜치

### 보안 체크리스트
- [ ] AI API 키가 프론트엔드에 포함되지 않았는지 확인
- [ ] `.env` 파일이 Git에 커밋되지 않았는지 확인
- [ ] 디버그 설정이 프로덕션에 반영되지 않았는지 확인

---

## 📝 변경 이력

### 2026-01-24
- ✅ **사용자·멤버십 DB**: 커스텀 User (`users.User`), `membership_type`(free/standard/premium), `membership_expires_at`, `has_openai_key`/`has_gemini_key`, `photo_url`, `last_login_at`
- ✅ **채팅·폴더 DB 저장**: `chats` 앱 (Folder, ChatSession), 사용자별 CRUD API, 프론트 chatApi 연동
- ✅ **Jobs 사용자 연결·비동기**: Job `user` FK, `GET/POST /jobs/`, `GET /jobs/<id>/`, Celery `run_ai_job`, 사용자당 최대 4건 동시, 429 초과 시
- ✅ **비로그인 둘러보기**: ProtectedRoute 제거, 화면 공개, 기능 사용 시 MembershipModal 유도
- ✅ **멤버십 유도 모달**: 비로그인→로그인, 로그인+무료→업그레이드 유도 (검정 화면 없음)
- ✅ **로그아웃 시 빈 페이지**: Sidebar 로그아웃 → `resetChat`, `navigate(/)`
- ✅ 이미지/비디오 생성 → Jobs API 비동기 + 프론트 폴링

### 2026-01-23
- ✅ OpenAI 텍스트 생성 API 연동 완료 (Responses API 기준)
- ✅ Jobs API 기본 구조 완성
- ✅ Artifact 모델 개선 (텍스트 지원)
- ✅ 다크/라이트 모드 구현
- ✅ AI 기반 폴더 생성 기능
- ✅ 추천 프롬프트 기능
- ✅ 보안 정책 문서화 (API 키 보안 원칙)
  - VITE_* 금지 이유 명확화 (클라이언트 번들 유출 설명)
  - 서버-사이드 프록시 패턴 강조
  - **API 남용 방지 정책 추가** (인증, Rate Limit, Allowlist, 상한 적용)
- ✅ MinIO 자격증명 정책 정규화
  - Root 계정 기본값(minioadmin) 경고 강화
  - Root/App 계정 분리 명확화
  - 파일 기반 시크릿 관리 권장사항 추가
- ✅ 환경 변수 컨테이너/호스트 분리
- ✅ 디버그 설정 원복 체크리스트 추가
- ✅ OpenAI Responses API 예시 완전 고정 (인증 헤더 포함)
- ✅ Gemini SDK 명시 (google-genai, python-genai 문서 링크)
  - Early release 주의사항 및 버전 고정 권장 추가
- ✅ Nginx proxy_intercept_errors 설명 정확화 (기본값 off 명시)
- ✅ **프로젝트 구조/앱 경로 표기 단일화** (INSTALLED_APPS 경로 불일치 재발 방지)
- ✅ **운영 기본값 섹션 추가** (Presigned URL 만료, Celery retry/backoff, 업로드 제한)
- ✅ **AI 모델 통합 구조 설명 추가** (Provider Adapter 패턴)
- ✅ **프로젝트 최적화 작업 완료**
  - `backend/weavai/apps/jobs/` 중복 디렉토리 삭제
  - 사용하지 않는 import 제거 (MinValueValidator, MaxValueValidator, generics, ReadOnlyModelViewSet 등)
  - 레거시 코드 정리 (FAL.ai 관련 코드 주석 처리)
  - Pydantic v2 호환성 수정 (regex → pattern, validator → field_validator)
  - 경로 수정 (apps.jobs.tasks → jobs.tasks, apps.storage.s3 → weavai.apps.storage.s3)
  - 레거시 파일 문서화 (README 업데이트)
  - 모든 import 경로 테스트 및 검증 완료

### 2026-01-22
- ✅ Django 앱 구조 정리
- ✅ Docker Compose 인프라 구성
- ✅ 데이터베이스 마이그레이션 완료

---

## 📞 문의

프로젝트 관련 문의사항이 있으시면 이슈를 등록해주세요.

---

**마지막 업데이트**: 2026-01-24  
**문서 버전**: 2.4 (사용자·멤버십·채팅·Jobs DB·비동기·UX 최신화 반영)
