# WEAV-AI

AI 기반 콘텐츠 생성 플랫폼. 사용자가 목표를 입력하면 AI가 작업 단계를 계획하고, 단계별로 적합한 모델을 선택해 텍스트/이미지/비디오를 생성합니다.

---

## 🎯 프로젝트 개요

**WEAV-AI**는 AI 기반 콘텐츠 생성 플랫폼입니다. 사용자가 프로젝트 목표를 입력하면 AI가 자동으로 작업 단계를 계획하고, 각 단계에 맞는 AI 모델을 선택하여 텍스트, 이미지, 비디오를 생성할 수 있습니다.

### 핵심 기능

- 🤖 **AI 기반 프로젝트 계획**: 사용자 목표 분석 → 단계별 작업 계획 생성
- 💬 **멀티 모델 채팅**: OpenAI GPT, Google Gemini 등 다양한 모델 지원
- 🎨 **이미지 생성**: DALL-E 3 기반 (비동기 Jobs API)
- 🎬 **비디오 생성**: SORA, VEO (비동기 Jobs API)
- 📁 **폴더·채팅 DB 저장**: 로그인 후 작업 내용 DB 유지, 로그아웃·재로그인 시 복원
- 🎨 **다크/라이트 모드**: 사용자 맞춤형 테마 지원
- 🔐 **Google 로그인**: Firebase 인증 + 백엔드 JWT + **사용자·멤버십 DB 저장**
- 👀 **비로그인 둘러보기**: 화면은 모두 공개, 기능 사용 시 로그인/멤버십 유도

---

## 🏗️ 아키텍처

```
사용자 (브라우저)
    ↓
Cloudflare Tunnel (프로덕션)
    ↓
Nginx (리버스 프록시, 포트 8080)
    ↓
┌─────────────┬─────────────┐
│  Django API │  React App  │
│  (포트 8000)│  (포트 5173)│
└──────┬──────┴─────────────┘
       │
       ├── PostgreSQL (데이터베이스)
       ├── Redis (캐시/작업 큐)
       ├── Celery (비동기 작업, 사용자당 최대 4건 동시)
       └── MinIO (파일 저장소)
```

---

## 🛠️ 기술 스택

### 프론트엔드
- React 18 + TypeScript + Vite
- React Router DOM
- Tailwind CSS
- Firebase Auth (Google 로그인)
- Sonner (Toast 알림)

### 백엔드
- Django 4.2.7 + Django REST Framework
- PostgreSQL 15
- Redis 7
- Celery 5.3.4
- MinIO (S3 호환)
- Firebase Admin SDK (토큰 검증)

### AI 서비스
- OpenAI: GPT-4o-mini, DALL-E 3, SORA
- Google Gemini: Gemini 1.5 Flash, Gemini 3 Pro

---

## 🚀 빠른 시작

### 1. 환경 변수 설정

#### 프론트엔드 (`.env`)
```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=http://localhost:8080
```

#### 백엔드 (`infra/.env`)
```bash
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# 데이터베이스
POSTGRES_PASSWORD=your-password

# Redis (API·Worker 공통)
REDIS_URL=redis://redis:6379/0

# AI API 키
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/path/to/firebase-key.json

# MinIO
MINIO_DATA_DIR=./minio-data
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your-password
```

### 2. 백엔드 실행

```bash
cd infra
docker compose up -d
```

### 3. 마이그레이션 (최초 1회)

```bash
cd infra
docker compose run --rm --entrypoint "" api python manage.py migrate
```

### 4. 프론트엔드 실행

```bash
npm install
npm run dev
```

### 5. 접속

- 프론트엔드: `http://localhost:5173`
- 백엔드 API: `http://localhost:8080/api/v1/`
- MinIO 콘솔: `http://localhost:9001`

---

## 📡 주요 API 엔드포인트

### 인증
- `POST /api/v1/auth/verify-firebase-token/` - Firebase 토큰 검증, JWT 발급, **사용자·멤버십 DB 저장**
- `POST /api/v1/auth/token/refresh/` - JWT 토큰 갱신
- `GET /api/v1/auth/profile/` - 사용자 프로필·멤버십 조회

### 채팅·폴더 (인증 필수)
- `GET /api/v1/chats/folders/` - 폴더 목록
- `POST /api/v1/chats/folders/` - 폴더 생성
- `GET/PUT/DELETE /api/v1/chats/folders/<uuid>/` - 폴더 상세
- `GET /api/v1/chats/chats/?folder=<uuid>` - 채팅 목록 (폴더별 또는 최근)
- `POST /api/v1/chats/chats/` - 채팅 생성
- `GET/PUT/DELETE /api/v1/chats/chats/<uuid>/` - 채팅 상세

### AI 작업 (인증 필수, 비동기)
- `GET /api/v1/jobs/` - 내 작업 목록
- `POST /api/v1/jobs/` - 작업 생성 → **202 + job_id** (Celery 비동기, 사용자당 최대 4건 동시)
- `GET /api/v1/jobs/<job_id>/` - 작업 상태·결과 조회 (폴링용)

---

## 📊 현재 진행 상황

### ✅ 완료
- 프론트엔드 UI/UX (채팅, 폴더, 테마, 비로그인 둘러보기)
- Google 로그인 (Firebase + JWT), **로그인 시 사용자 DB 저장**
- **커스텀 User + 멤버십** (free/standard/premium, API 키 상태)
- **채팅·폴더 DB 저장** (chats 앱), 로그아웃 후 재로그인 시 유지
- **Jobs 사용자 연결** · 목록/조회 API, **비동기 Celery 처리 (사용자당 최대 4건)**
- 이미지/비디오 생성 → Jobs API 비동기 + 폴링
- **멤버십 확인 · 결제 유도 모달** (검정 화면 없이 유도)
- **로그아웃 시 빈 페이지** 이동, 상태 초기화
- OpenAI 텍스트 생성, DALL-E 3 / SORA 연동 (Jobs 경유)
- Redis 캐시·Celery 브로커, MinIO 파일 저장

### 🔄 진행 중
- Gemini API 연동 (코드 작성 완료, 운영 테스트)
- 실시간 작업 진행률 UI (선택)

### 📋 예정
- 결제 시스템 (Stripe), `/pricing` 페이지
- Rate Limit / Quota 강화

---

## 🔒 보안

- AI API 키는 백엔드 전용 (프론트 노출 금지)
- Firebase ID Token 검증 후 JWT 발급
- 채팅·폴더·Jobs 모두 **사용자별 DB 분리**
- HTTPS (Cloudflare Tunnel)

---

## 📚 문서

- [배포 가이드](./DEPLOYMENT_GUIDE.md) - Cloudflare Tunnel 배포
- [프로젝트 문서](./PROJECT_DOCUMENTATION.md) - 상세 기술 문서
- [백엔드 README](./backend/README.md) - 백엔드 설정
- [인프라 README](./infra/README.md) - 인프라 설정

---

**마지막 업데이트**: 2026-01-24
