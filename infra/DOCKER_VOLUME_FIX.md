# Docker 볼륨 마운트 문제 해결 가이드

## 문제 상황

Docker Desktop for Mac에서 `/Volumes/WEAVAI_2T/minio-data` 경로를 마운트할 때 다음 에러가 발생합니다:

```
Error response from daemon: error while creating mount source path '/host_mnt/Volumes/WEAVAI_2T/minio-data': mkdir /host_mnt/Volumes/WEAVAI_2T: file exists
```

## 해결 방법

### 방법 1: Docker Desktop File Sharing 설정 (권장)

1. **Docker Desktop 열기**
2. **Settings (설정)** → **Resources** → **File Sharing** 이동
3. **`/Volumes/WEAVAI_2T`** 경로 추가
4. **Apply & Restart** 클릭
5. Docker Desktop 재시작 후 다시 시도:

```bash
cd infra
docker compose up -d
```

### 방법 2: 로컬 경로 사용 (임시 해결책)

외장하드를 사용하지 않는 경우, 로컬 경로를 사용할 수 있습니다:

1. `infra/.env` 파일 수정:
```bash
# 외장하드 대신 로컬 경로 사용
MINIO_DATA_DIR=./minio-data
```

2. 로컬 디렉토리 생성:
```bash
mkdir -p infra/minio-data
```

3. Docker Compose 실행:
```bash
cd infra
docker compose up -d
```

### 방법 3: 심볼릭 링크 사용

로컬 경로에 심볼릭 링크를 만들어 외장하드를 연결:

```bash
# 프로젝트 루트에서
ln -s /Volumes/WEAVAI_2T/minio-data ./minio-data-link

# infra/.env 수정
MINIO_DATA_DIR=../minio-data-link
```

## 확인

MinIO가 정상적으로 시작되었는지 확인:

```bash
# 컨테이너 상태 확인
docker compose ps

# MinIO 로그 확인
docker compose logs minio

# MinIO 콘솔 접속
open http://localhost:9001
```

## 참고

- Docker Desktop for Mac은 `/Volumes/` 경로를 `/host_mnt/Volumes/`로 변환합니다
- File Sharing에 경로를 추가하지 않으면 마운트가 실패할 수 있습니다
- 외장하드를 사용하는 경우 방법 1을 권장합니다
