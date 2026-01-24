# WEAV AI 인프라 설정

Mac Mini + 외장하드 기반 프로덕션급 AI 생성 서비스 인프라입니다.

## 🏗️ 서비스 구성

- **Nginx**: 리버스 프록시 (포트 8080)
- **Django + DRF**: API 서버 (포트 8000)
- **PostgreSQL**: 데이터베이스 (User, Folder, ChatSession, Job, Artifact)
- **Redis**: Celery 브로커 및 Django 캐시
- **Celery Worker**: 비동기 AI 작업 (사용자당 최대 4건 동시)
- **MinIO**: S3 호환 파일 스토리지 (외장하드)

---

## 🚀 빠른 시작

### 1. 환경 변수

`infra/.env` 생성:

```bash
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=weavai.hub,localhost

POSTGRES_PASSWORD=your-password
REDIS_URL=redis://redis:6379/0

OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/path/to/firebase-key.json

MINIO_DATA_DIR=./minio-data
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your-password
```

### 2. MinIO 데이터 디렉터리

```bash
mkdir -p infra/minio-data
```

### 3. 서비스 시작

```bash
cd infra
docker compose up -d --build
```

### 4. 마이그레이션 (최초 1회)

```bash
docker compose run --rm --entrypoint "" api python manage.py migrate
```

### 5. 상태 확인

```bash
docker compose ps
curl http://localhost:8080/healthz
curl http://localhost:8080/api/v1/health/
```

---

## 🔧 주요 명령어

### 로그

```bash
docker compose logs -f
docker compose logs -f api
```

### 마이그레이션

```bash
docker compose run --rm --entrypoint "" api python manage.py makemigrations
docker compose run --rm --entrypoint "" api python manage.py migrate
```

### Django 쉘

```bash
docker compose run --rm --entrypoint "" api python manage.py shell
```

### 재시작

```bash
docker compose restart
docker compose restart api
```

---

## 📊 모니터링

- `GET /healthz` - Nginx
- `GET /api/v1/health/` - DB, Redis, Celery 등
- MinIO 콘솔: `http://localhost:9001`

---

## 🔒 보안

- `.env`로 비밀 관리, Git 미커밋
- 프로덕션 `DEBUG=False`
- 강한 비밀번호, 외장하드 정기 백업

---

**마지막 업데이트**: 2026-01-24
