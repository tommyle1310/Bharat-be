Write-Host "=== Select environment file ==="
$choices = @(".env.development", ".env.test", ".env.production")
for ($i=0; $i -lt $choices.Count; $i++) { Write-Host "$($i+1). $($choices[$i])" }
$selection = Read-Host "Enter choice number"
$ENV_FILE = $choices[$selection-1]
if (-not $ENV_FILE) { Write-Host "Invalid choice" -ForegroundColor Red; exit 1 }

$env:ENV_FILE = $ENV_FILE
Write-Host "Using $ENV_FILE"

# Parse env
$envContent = Get-Content $ENV_FILE | Where-Object {$_ -and ($_ -notmatch "^#")}
$redisHost = ($envContent | Where-Object {$_ -match "^REDIS_HOST="}) -replace "REDIS_HOST=", ""
$redisPortLine = ($envContent | Where-Object {$_ -match "^REDIS_PORT="}) -replace "REDIS_PORT=", ""
if (-not $redisPortLine) { $redisPortLine = "6379" }
[int]$redisPort = $redisPortLine

$dbHost    = ($envContent | Where-Object {$_ -match "^DB_HOST="}) -replace "DB_HOST=", ""
$dbPortLine = ($envContent | Where-Object {$_ -match "^DB_PORT="}) -replace "DB_PORT=", ""
if (-not $dbPortLine) { $dbPortLine = "3306" }
[int]$dbPort = $dbPortLine

function Test-Port {
    param([string]$hostname, [int]$port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect($hostname, $port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

# DB external only (không spin mysql)
if ($dbHost -and $dbHost -ne "127.0.0.1" -and $dbHost -ne "localhost") {
    if (Test-Port $dbHost $dbPort) {
        Write-Host "External MySQL reachable: $dbHost`:$dbPort"
    } else {
        Write-Host "WARNING: Cannot reach external MySQL $dbHost`:$dbPort" -ForegroundColor Yellow
    }
}

if ($dbHost -eq "127.0.0.1" -or $dbHost -eq "localhost" -or -not $dbHost) {
    Write-Host "Starting local MySQL container on host port $dbPort..."
    docker network inspect kmsg_buyer_net *> $null 2>&1
    if ($LASTEXITCODE -ne 0) { docker network create kmsg_buyer_net | Out-Null }

    $env:DB_PORT = "$dbPort"
    docker compose -p kmsg-buyer -f docker-compose.yml -f docker-compose.mysql.yml up -d mysql-local

    # update runtime env
    Copy-Item $ENV_FILE .env.runtime -Force
    (Get-Content .env.runtime) `
        | ForEach-Object {
            $_ -replace '^DB_HOST=.*', 'DB_HOST=mysql-local' `
               -replace '^DB_PORT=.*', 'DB_PORT=3306'
        } | Set-Content .env.runtime
    $useRuntimeEnv = $true
}


# Redis: nếu local thì spin redis-local, và tạo .env.runtime để app trỏ tới redis-local
$useRuntimeEnv = $false
if ($redisHost -eq "127.0.0.1" -or $redisHost -eq "localhost" -or -not $redisHost) {
    Write-Host "Starting local Redis container on host port $redisPort..."
    docker network inspect kmsg_buyer_net *> $null 2>&1
    if ($LASTEXITCODE -ne 0) { docker network create kmsg_buyer_net | Out-Null }

    # start redis-local via compose (để cùng network)
    $env:REDIS_PORT = "$redisPort"
    docker compose -p kmsg-buyer -f docker-compose.yml -f docker-compose.redis.yml up -d redis-local

    # tạo .env.runtime
    Copy-Item $ENV_FILE .env.runtime -Force
    (Get-Content .env.runtime) `
        | ForEach-Object {
            $_ -replace '^REDIS_HOST=.*', 'REDIS_HOST=redis-local' `
               -replace '^REDIS_PORT=.*', 'REDIS_PORT=6379' `
               -replace '^REDIS_TLS=.*',  'REDIS_TLS=false'
          } | Set-Content .env.runtime
    $useRuntimeEnv = $true
} else {
    # external redis → test; nếu fail thì fallback local
    if (Test-Port $redisHost $redisPort) {
        Write-Host "External Redis reachable: $redisHost`:$redisPort"
    } else {
        Write-Host "External Redis unreachable -> fallback to local" -ForegroundColor Yellow
        docker network inspect kmsg_buyer_net *> $null 2>&1
        if ($LASTEXITCODE -ne 0) { docker network create kmsg_buyer_net | Out-Null }
        $env:REDIS_PORT = "$redisPort"
        docker compose -p kmsg-buyer -f docker-compose.yml -f docker-compose.redis.yml up -d redis-local

        Copy-Item $ENV_FILE .env.runtime -Force
        (Get-Content .env.runtime) `
            | ForEach-Object {
                $_ -replace '^REDIS_HOST=.*', 'REDIS_HOST=redis-local' `
                   -replace '^REDIS_PORT=.*', 'REDIS_PORT=6379' `
                   -replace '^REDIS_TLS=.*',  'REDIS_TLS=false'
              } | Set-Content .env.runtime
        $useRuntimeEnv = $true
    }
}

Write-Host "=== Starting app container with ENV_FILE=$ENV_FILE ==="
if ($useRuntimeEnv) {
    $env:ENV_FILE = ".env.runtime"
}
docker compose -p kmsg-buyer -f docker-compose.yml up -d app

Write-Host "=== Running containers (filtered) ==="
docker ps --filter "name=kmsg-buyer-backend" --filter "name=kmsg-redis-local"
