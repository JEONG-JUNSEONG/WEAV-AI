# WEAV AI - Docker 기준 실행·테스트
# 로컬 테스트 환경 없음. 모든 테스트는 Docker에서만 실행합니다.

.PHONY: help up down build test migrate logs shell

help:
	@echo "WEAV AI (Docker 전용)"
	@echo "  make up      - 인프라 기동 (postgres, redis, api, worker, nginx)"
	@echo "  make down    - 인프라 중지"
	@echo "  make build   - 이미지 빌드"
	@echo "  make test    - 테스트 실행 (Docker 내부에서만)"
	@echo "  make migrate - 마이그레이션 실행"
	@echo "  make logs    - api 로그"
	@echo "  make shell   - api 컨테이너 셸"

up:
	cd infra && docker compose up -d

down:
	cd infra && docker compose down

build:
	cd infra && docker compose build

test:
	cd infra && docker compose run --rm --entrypoint python api manage.py test tests

migrate:
	cd infra && docker compose run --rm --entrypoint python api manage.py migrate

logs:
	cd infra && docker compose logs -f api

shell:
	cd infra && docker compose run --rm --entrypoint sh api
