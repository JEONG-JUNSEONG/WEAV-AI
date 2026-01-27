# WEAV-AI

AI 기반 콘텐츠 생성 플랫폼. 사용자가 목표를 입력하면 AI가 작업 단계를 계획하고, 단계별로 적합한 모델을 선택해 텍스트/이미지/비디오를 생성합니다.

---

##  프로젝트 개요

**WEAV-AI**는 AI 기반 콘텐츠 생성 플랫폼입니다. 사용자가 프로젝트 목표를 입력하면 AI가 자동으로 작업 단계를 계획하고, 각 단계에 맞는 AI 모델을 선택하여 텍스트, 이미지, 비디오를 생성할 수 있습니다.

### 핵심 기능

-  **AI 기반 프로젝트 계획**: 사용자 목표 분석 → 단계별 작업 계획 생성
-  **멀티 모델 채팅**: OpenAI GPT, Google Gemini 등 다양한 모델 지원
-  **이미지 생성**: DALL-E 3 기반 (비동기 Jobs API)
-  **비디오 생성**: SORA, VEO (비동기 Jobs API)
-  **폴더·채팅 DB 저장**: 로그인 후 작업 내용 DB 유지, 로그아웃·재로그인 시 복원
-  **다크/라이트 모드**: 사용자 맞춤형 테마 지원
-  **Google 로그인**: Firebase 인증 + 백엔드 JWT + **사용자·멤버십 DB 저장**
-  **비로그인 둘러보기**: 화면은 모두 공개, 기능 사용 시 로그인/멤버십 유도

---

##  아키텍처

```
사용자 (브라우저)
    ↓
Cloudflare Tunnel (프로덕션)
    ↓
Nginx (리버스 프록시, 포트 8080)
    ↓
┌─────────────┬─────────────┐
│  Django API │  React App  │
│  (포트 8000)│  (포트 3000)│
└──────┬──────┴─────────────┘
       │
       ├── PostgreSQL (데이터베이스)
       ├── Redis (캐시/작업 큐)
       ├── Celery (비동기 작업, 사용자당 최대 4건 동시)
       └── MinIO (파일 저장소)
```

---

##  기술 스택

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
- **OpenAI**: GPT-4o-mini (텍스트), DALL-E 3 (이미지), Sora 2 (비디오)
- **Google Gemini**: Gemini 1.5 Flash/Pro (텍스트), Gemini 2.5 Flash Image (이미지, Nano Banana)

---

##  빠른 시작

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
# PortOne (결제창용, 공개 식별자)
VITE_PORTONE_STORE_ID=...
VITE_PORTONE_CHANNEL_KEY=...
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

# Billing (PortOne)
USE_PORTONE=True
USE_STRIPE=False
PORTONE_API_SECRET=...
PORTONE_WEBHOOK_SECRET=...
FRONTEND_URL=http://localhost:3000
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
cd frontend
npm install
npm run dev
```

> 배포 환경에서는 `frontend/.env`의 `VITE_API_BASE_URL`을 실제 API 도메인으로 설정하세요.

### 5. 접속

- 프론트엔드: `http://localhost:3000`
- 백엔드 API: `http://localhost:8080/api/v1/`
- MinIO 콘솔: `http://localhost:9001`

---

##  주요 API 엔드포인트

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

### 결제 (PortOne, 일회 30일권)
- `GET /api/v1/billing/plans/` - 플랜 목록
- `POST /api/v1/billing/payment/prepare/` - 결제 준비 (SDK 파라미터 반환)
- `POST /api/v1/billing/payment/complete/` - 결제 완료 검증 및 멤버십 반영
- `POST /api/v1/billing/webhook/` - PortOne 웹훅

---

##  현재 진행 상황

###  완료 (프로덕션 준비 완료)
- **프론트엔드**: React + TypeScript, 채팅/폴더 UI, 다크/라이트 모드, 비로그인 둘러보기
- **인증**: Google 로그인 (Firebase + JWT), 사용자·멤버십 DB 저장
- **멤버십**: 커스텀 User 모델 (free/standard/premium), 만료일 관리, 프리미엄 기능 체크
- **데이터 저장**: 채팅·폴더 DB 저장 (PostgreSQL), 로그아웃 후 재로그인 시 복원
- **AI 작업**: Jobs API (비동기 Celery), 사용자당 최대 4건 동시 처리, 폴링 지원
- **AI 모델**:
  - **텍스트**: OpenAI GPT-4o-mini, Google Gemini 1.5 Flash/Pro
  - **이미지**: OpenAI DALL-E 3, Google Gemini 2.5 Flash Image (Nano Banana) 
  - **비디오**: OpenAI Sora 2 (API 공개 시 자동 동작)
- **결제**: PortOne 일회 30일권, `/pricing` 페이지, prepare/complete/webhook, Celery 자동복구
- **인프라**: Docker Compose (infra), PostgreSQL, Redis, MinIO, Nginx (resolver + 변수), Celery Worker
- **보안**: AI Gateway (백엔드 라우팅), API 키 서버 전용, 멤버십 기반 프리미엄 기능 제한

###  향후 계획
- 정기결제 (빌링키 + Celery Beat)
- Rate Limit / Quota 강화
- 실시간 작업 진행률 UI (선택)

---

##  보안

- AI API 키는 백엔드 전용 (프론트 노출 금지)
- Firebase ID Token 검증 후 JWT 발급
- 채팅·폴더·Jobs 모두 **사용자별 DB 분리**
- HTTPS (Cloudflare Tunnel)

---

##  문서

- [배포 가이드](./docs/배포_가이드.md) - Cloudflare Tunnel 배포
- [프로젝트 문서](./docs/프로젝트_문서.md) - 상세 기술 문서
- [결제 (PortOne)](./docs/결제_구현_가이드.md) - Billing MVP 설정 및 플로우
- [빠른 시작](./docs/빠른_시작_가이드.md) - 바로 실행하는 단계별 가이드
- [테스트 로드맵](./docs/테스트_로드맵.md) - 구조 변경 후 점검 절차
- [Windows 빠른 실행](./docs/빠른_실행_가이드_win.md) - Windows 환경 실행 가이드
- [백엔드 README](./backend/README.md) - 백엔드 설정
- [인프라 README](./infra/README.md) - 인프라 설정

---

**마지막 업데이트**: 2026-01-24  
**프로젝트 상태**: 프로덕션 준비 완료 
