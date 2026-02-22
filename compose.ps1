# WEAV AI - Docker Compose 래퍼 (Windows PowerShell)
# 사용: .\compose.ps1 up | down | build | test | migrate | logs | shell | help
# 프로젝트 루트에서 실행하세요.

param(
    [Parameter(Position = 0)]
    [string]$Command = "help"
)

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }
$InfraPath = Join-Path $ProjectRoot "infra"

function Show-Help {
    Write-Host "WEAV AI (Docker 전용)" -ForegroundColor Cyan
    Write-Host "  .\compose.ps1 up      - 인프라 기동 (postgres, redis, api, worker, nginx)"
    Write-Host "  .\compose.ps1 down    - 인프라 중지"
    Write-Host "  .\compose.ps1 build   - 이미지 빌드"
    Write-Host "  .\compose.ps1 test    - 테스트 실행 (Docker 내부에서만)"
    Write-Host "  .\compose.ps1 migrate - 마이그레이션 실행"
    Write-Host "  .\compose.ps1 logs    - api 로그"
    Write-Host "  .\compose.ps1 shell   - api 컨테이너 셸"
}

function Invoke-DockerCompose {
    param([string[]]$DockerArgs)
    Push-Location $InfraPath
    try {
        & docker compose @DockerArgs
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    finally {
        Pop-Location
    }
}

$cmd = $Command.ToLowerInvariant()
switch ($cmd) {
    "up"    { Invoke-DockerCompose -DockerArgs @("up", "-d") }
    "down"  { Invoke-DockerCompose -DockerArgs @("down") }
    "build" { Invoke-DockerCompose -DockerArgs @("build") }
    "test"  { Invoke-DockerCompose -DockerArgs @("run", "--rm", "--entrypoint", "python", "api", "manage.py", "test", "tests") }
    "migrate" { Invoke-DockerCompose -DockerArgs @("run", "--rm", "--entrypoint", "python", "api", "manage.py", "migrate") }
    "logs"  { Invoke-DockerCompose -DockerArgs @("logs", "-f", "api") }
    "shell" { Invoke-DockerCompose -DockerArgs @("run", "--rm", "--entrypoint", "sh", "api") }
    "help"  { Show-Help }
    default {
        Write-Host "알 수 없는 명령: $Command" -ForegroundColor Yellow
        Show-Help
        exit 1
    }
}
