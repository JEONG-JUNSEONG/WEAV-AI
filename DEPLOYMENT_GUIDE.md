# WEAV-AI 프로덕션 배포 가이드

## 🚀 Cloudflare Tunnel을 통한 배포

### 사전 준비사항

1. **도메인**: `weavai.hub` 도메인 등록 및 Cloudflare에 추가
2. **로컬 서버**: `localhost:8080`에서 Nginx가 실행 중이어야 함
3. **Cloudflare Tunnel CLI**: 설치 필요

---

## 1단계: Cloudflare Tunnel 설치 및 로그인

```bash
# macOS에서 설치
brew install cloudflared

# Cloudflare에 로그인 (브라우저가 열림)
cloudflared tunnel login
```

로그인 후 인증 파일이 `~/.cloudflared/cert.pem`에 저장됩니다.

---

## 2단계: Tunnel 생성

```bash
# weavai.hub용 터널 생성
cloudflared tunnel create weavai

# 생성 확인
cloudflared tunnel list
```

터널이 생성되면 `~/.cloudflared/<tunnel-id>.json` 파일이 생성됩니다.

---

## 3단계: Tunnel 설정 파일 생성

`~/.cloudflared/config.yml` 파일을 생성하거나 수정:

```yaml
tunnel: weavai
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  # 메인 도메인 → 로컬 Nginx
  - hostname: weavai.hub
    service: http://localhost:8080
  
  # www 서브도메인도 같은 서비스로
  - hostname: www.weavai.hub
    service: http://localhost:8080
  
  # 기본 (나머지 모든 요청)
  - service: http_status:404
```

**중요**: `<tunnel-id>`를 실제 터널 ID로 교체하세요.

---

## 4단계: DNS 레코드 설정

### 방법 1: CLI로 자동 설정 (권장)

```bash
# weavai.hub 메인 도메인
cloudflared tunnel route dns weavai weavai.hub

# www 서브도메인 (선택사항)
cloudflared tunnel route dns weavai www.weavai.hub
```

### 방법 2: Cloudflare 대시보드에서 수동 설정

1. Cloudflare 대시보드 → `weavai.hub` 도메인 선택
2. DNS → Records → "Add record"
3. 설정:
   - **Type**: `CNAME`
   - **Name**: `weavai.hub` (또는 `@`)
   - **Target**: `<tunnel-id>.cfargotunnel.com`
   - **Proxy status**: `Proxied` (주황색 구름 아이콘)
   - **TTL**: `Auto`
4. "Save" 클릭

---

## 5단계: 로컬 서버 실행 확인

```bash
# infra 디렉토리로 이동
cd infra

# Docker Compose로 서비스 시작
docker compose up -d

# Nginx 헬스체크
curl http://localhost:8080/healthz
# 응답: "ok"
```

---

## 6단계: Tunnel 실행

### 임시 실행 (테스트용)

```bash
cloudflared tunnel run weavai
```

### 영구 실행 (서비스로 등록)

```bash
# macOS에서 서비스로 등록
sudo cloudflared service install

# 서비스 시작
sudo launchctl load /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
```

---

## 7단계: 프론트엔드 빌드 및 배포

### 프론트엔드 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 디렉토리에 생성됩니다.

### Nginx 설정 업데이트

`infra/nginx/conf.d/weavai.conf` 파일에 프론트엔드 서빙 설정 추가:

```nginx
server {
    listen 80;
    server_name weavai.hub www.weavai.hub localhost;

    # 프론트엔드 정적 파일 서빙
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # API 요청은 Django로 프록시
    location /api/ {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 헬스체크
    location /healthz {
        access_log off;
        return 200 "ok\n";
        add_header Content-Type text/plain;
    }
}
```

---

## 8단계: 연결 확인

```bash
# 로컬에서 확인
curl http://localhost:8080/healthz
curl http://localhost:8080/api/v1/health/

# 외부에서 확인 (DNS 전파 후)
curl https://weavai.hub/healthz
curl https://weavai.hub/api/v1/health/
```

---

## 9단계: 프로덕션 환경 변수 설정

`infra/.env` 파일에 다음 설정이 포함되어 있어야 합니다:

```bash
# Django 설정
DEBUG=False
SECRET_KEY=<강력한-랜덤-문자열>
ALLOWED_HOSTS=weavai.hub,www.weavai.hub

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/path/to/firebase-key.json

# AI API 키
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# MinIO (외장하드 경로)
MINIO_DATA_DIR=/Volumes/WEAVAI_2T/minio-data
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=<강력한-비밀번호>

# PostgreSQL
POSTGRES_PASSWORD=<강력한-비밀번호>

# Redis (API·Worker 공통)
REDIS_URL=redis://redis:6379/0
```

---

## 🔧 문제 해결

### Tunnel이 연결되지 않음

```bash
# Tunnel 로그 확인
cloudflared tunnel run weavai --loglevel debug

# 설정 파일 확인
cat ~/.cloudflared/config.yml
```

### DNS 전파 지연

- DNS 변경 후 전파까지 최대 24시간 소요 (보통 몇 분~몇 시간)
- `dig weavai.hub` 명령어로 현재 DNS 레코드 확인

### 502 Bad Gateway

- 로컬 서버(`localhost:8080`)가 실행 중인지 확인
- Nginx 로그 확인: `docker compose logs nginx`

---

## 📝 체크리스트

배포 전 확인사항:

- [ ] Cloudflare Tunnel 설치 및 로그인 완료
- [ ] Tunnel 생성 완료
- [ ] `~/.cloudflared/config.yml` 설정 완료
- [ ] DNS 레코드 설정 완료 (CNAME 추가)
- [ ] 로컬 서버 실행 중 (`docker compose up -d`)
- [ ] 프론트엔드 빌드 완료 (`npm run build`)
- [ ] Nginx 설정 업데이트 완료
- [ ] 프로덕션 환경 변수 설정 완료
- [ ] Tunnel 실행 중
- [ ] 외부 접근 테스트 완료 (`https://weavai.hub`)

---

**마지막 업데이트**: 2026-01-24 (문서 통일)
