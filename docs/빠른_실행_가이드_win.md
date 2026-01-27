# WEAV-AI Windows 빠른 실행 가이드

이 문서는 Windows 환경에서 프로젝트를 로컬 실행하는 방법을 단계별로 설명한다.
권장 환경은 Windows 11 + Docker Desktop + WSL2이다.

---

## 0. 준비 사항

필수 설치
- Docker Desktop (WSL2 기반)
- Node.js 18 이상
- Git

권장
- WSL2 (Ubuntu)
- PowerShell 7

---

## 1. 저장소 클론

PowerShell 또는 WSL에서 실행한다.

```bash
git clone <your-repo-url>
cd WEAV-AI
```

---

## 2. 환경변수 설정

### 2-1) infra/.env

`infra/.env`를 생성한다.

```bash
copy infra\.env.example infra\.env
```

필수 값
- `SECRET_KEY`
- `POSTGRES_PASSWORD`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_KEY_PATH`

Firebase 키 파일 경로 예시
- 프로젝트 루트에 `backend\firebase-admin.json` 저장
- `FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/app/firebase-admin.json`

주의
- Windows 경로(`C:\...`)가 아니라 **컨테이너 내부 경로**(`/app/...`)를 사용해야 한다.

---

### 2-2) frontend/.env

`frontend/.env` 생성

```bash
copy frontend\.env.example frontend\.env
```

필수 값
- `VITE_API_BASE_URL=http://localhost:8080`
- Firebase 관련 키들

---

## 3. Docker Desktop 설정 (중요)

Docker Desktop에서 아래를 확인한다.
- WSL2 활성화
- 프로젝트 폴더가 공유되었는지 확인

공유가 안 되면 컨테이너에서 파일을 못 읽는다.

---

## 4. 인프라 실행

PowerShell에서 실행

```bash
cd infra
docker compose up -d --build
```

상태 확인

```bash
docker compose ps
curl http://localhost:8080/healthz
curl http://localhost:8080/api/v1/health/
```

---

## 5. 마이그레이션

PowerShell에서 실행

```bash
cd ..
docker compose -f infra\docker-compose.yml run --rm -v "${PWD}\backend:/app" --entrypoint "" api python manage.py migrate
```

WSL 사용 시

```bash
cd /mnt/c/Users/<you>/Documents/GitHub/WEAV-AI
docker compose -f infra/docker-compose.yml run --rm -v "$(pwd)/backend:/app" --entrypoint "" api python manage.py migrate
```

---

## 6. 프론트 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저 접속
- `http://localhost:3000`

---

## 7. 로그인 테스트

1) 구글 로그인
2) 네트워크 탭에서 `/api/v1/auth/verify-firebase-token/` 200 확인
3) 이후 `/api/v1/chats/folders/` 200 확인

---

## 자주 발생하는 문제

### 1) Firebase Admin SDK 오류 (500)
원인: 컨테이너가 키 파일을 못 읽음
해결: `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` 확인 + 컨테이너 재시작

### 2) 401 Unauthorized
원인: JWT 발급 실패
해결: 먼저 `/auth/verify-firebase-token/` 200 확인

### 3) Docker 볼륨 마운트 실패
원인: Docker Desktop 공유 설정 문제
해결: Docker Desktop에서 해당 폴더 공유 확인

---
