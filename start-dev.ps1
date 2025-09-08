Write-Host "=== KMSG Buyer Service - Local Development with Nodemon ===" -ForegroundColor Green

# Select environment file
Write-Host "`n=== Select environment file ===" -ForegroundColor Yellow
$choices = @(".env.development", ".env.test", ".env.production")
for ($i=0; $i -lt $choices.Count; $i++) { 
    Write-Host "$($i+1). $($choices[$i])" 
}
$selection = Read-Host "Enter choice number"
$ENV_FILE = $choices[$selection-1]
if (-not $ENV_FILE) { 
    Write-Host "Invalid choice" -ForegroundColor Red
    exit 1 
}

$env:ENV_FILE = $ENV_FILE
Write-Host "Using $ENV_FILE" -ForegroundColor Green

# Parse environment variables
$envContent = Get-Content $ENV_FILE | Where-Object {$_ -and ($_ -notmatch "^#")}
$redisHost = ($envContent | Where-Object {$_ -match "^REDIS_HOST="}) -replace "REDIS_HOST=", ""
$redisPortLine = ($envContent | Where-Object {$_ -match "^REDIS_PORT="}) -replace "REDIS_PORT=", ""
if (-not $redisPortLine) { $redisPortLine = "6379" }
[int]$redisPort = $redisPortLine

$dbHost = ($envContent | Where-Object {$_ -match "^DB_HOST="}) -replace "DB_HOST=", ""
$dbPortLine = ($envContent | Where-Object {$_ -match "^DB_PORT="}) -replace "DB_PORT=", ""
if (-not $dbPortLine) { $dbPortLine = "3306" }
[int]$dbPort = $dbPortLine

# Get file paths from .env.development for local development
$dataFilesPath = ""
$dirBase = ""
$dirVehicle = ""
$dirBuyer = ""

if (Test-Path ".env.development") {
    $devContent = Get-Content ".env.development" | Where-Object {$_ -and ($_ -notmatch "^#")}
    $dataFilesPath = ($devContent | Where-Object {$_ -match "^DATA_FILES_PATH="}) -replace "DATA_FILES_PATH=", ""
    $dirBase = ($devContent | Where-Object {$_ -match "^DIR_BASE="}) -replace "DIR_BASE=", ""
    $dirVehicle = ($devContent | Where-Object {$_ -match "^DIR_VEHICLE="}) -replace "DIR_VEHICLE=", ""
    $dirBuyer = ($devContent | Where-Object {$_ -match "^DIR_BUYER="}) -replace "DIR_BUYER=", ""
    
    if ($dataFilesPath) {
        Write-Host "Using local file paths from .env.development" -ForegroundColor Green
        Write-Host "DATA_FILES_PATH: $dataFilesPath" -ForegroundColor Cyan
    }
}

function Test-Port {
    param([string]$hostname, [int]$port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect($hostname, $port)
        $tcp.Close()
        return $true
    } catch { 
        return $false 
    }
}

# Ensure Docker network exists
Write-Host "`n=== Setting up Docker network ===" -ForegroundColor Yellow
docker network inspect indus_buyer_net *> $null 2>&1
if ($LASTEXITCODE -ne 0) { 
    Write-Host "Creating Docker network: indus_buyer_net" -ForegroundColor Green
    docker network create indus_buyer_net | Out-Null 
}

# Handle Redis
Write-Host "`n=== Setting up Redis ===" -ForegroundColor Yellow
$useLocalRedis = $false

if ($redisHost -eq "127.0.0.1" -or $redisHost -eq "localhost" -or -not $redisHost) {
    Write-Host "Starting local Redis container..." -ForegroundColor Green
    $useLocalRedis = $true
} else {
    if (Test-Port $redisHost $redisPort) {
        Write-Host "External Redis reachable: $redisHost`:$redisPort" -ForegroundColor Green
    } else {
        Write-Host "External Redis unreachable -> fallback to local" -ForegroundColor Yellow
        $useLocalRedis = $true
    }
}

if ($useLocalRedis) {
    $env:REDIS_HOST_PORT = "6381"
    docker compose -p indus_auction_system_buyer_service -f docker-compose.yml -f docker-compose.redis.yml up -d redis
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start Redis container" -ForegroundColor Red
        exit 1
    }
    Write-Host "Redis container started on port 6381" -ForegroundColor Green
}

# Handle Database
Write-Host "`n=== Setting up Database ===" -ForegroundColor Yellow
$useLocalDb = $false

if ($dbHost -eq "127.0.0.1" -or $dbHost -eq "localhost" -or -not $dbHost) {
    Write-Host "Starting local MySQL container..." -ForegroundColor Green
    $useLocalDb = $true
} else {
    if (Test-Port $dbHost $dbPort) {
        Write-Host "External MySQL reachable: $dbHost`:$dbPort" -ForegroundColor Green
    } else {
        Write-Host "External MySQL unreachable -> fallback to local" -ForegroundColor Yellow
        $useLocalDb = $true
    }
}

if ($useLocalDb) {
    $env:MYSQL_HOST_PORT = "3308"
    docker compose -p indus_auction_system_buyer_service -f docker-compose.yml -f docker-compose.mysql.yml up -d mysql
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start MySQL container" -ForegroundColor Red
        exit 1
    }
}

# Create .env.runtime for the application
Write-Host "`n=== Creating runtime environment ===" -ForegroundColor Yellow
Copy-Item $ENV_FILE .env.runtime -Force

# Update .env.runtime with local overrides
$runtimeContent = Get-Content .env.runtime

if ($useLocalRedis) {
    $runtimeContent = $runtimeContent | ForEach-Object {
        $_ -replace '^REDIS_HOST=.*', 'REDIS_HOST=127.0.0.1' `
           -replace '^REDIS_PORT=.*', 'REDIS_PORT=6381' `
           -replace '^REDIS_TLS=.*', 'REDIS_TLS=false'
    }
    Write-Host "Updated Redis config: 127.0.0.1:6381" -ForegroundColor Green
}

if ($useLocalDb) {
    $runtimeContent = $runtimeContent | ForEach-Object {
        $_ -replace '^DB_HOST=.*', 'DB_HOST=127.0.0.1' `
           -replace '^DB_PORT=.*', 'DB_PORT=3308' `
           -replace '^DB_USER=.*', 'DB_USER=indus_app_user' `
           -replace '^DB_PASSWORD=.*', 'DB_PASSWORD=IndusProd' `
           -replace '^DB_NAME=.*', 'DB_NAME=prod_indus_db'
    }
    Write-Host "Updated DB config: 127.0.0.1:3308 with correct credentials" -ForegroundColor Green
}

# Update file paths for local development
if ($dataFilesPath) {
    $runtimeContent = $runtimeContent | ForEach-Object {
        $_ -replace '^DATA_FILES_PATH=.*', "DATA_FILES_PATH=$dataFilesPath"
    }
}
if ($dirBase) {
    $runtimeContent = $runtimeContent | ForEach-Object {
        $_ -replace '^DIR_BASE=.*', "DIR_BASE=$dirBase"
    }
}
if ($dirVehicle) {
    $runtimeContent = $runtimeContent | ForEach-Object {
        $_ -replace '^DIR_VEHICLE=.*', "DIR_VEHICLE=$dirVehicle"
    }
}
if ($dirBuyer) {
    $runtimeContent = $runtimeContent | ForEach-Object {
        $_ -replace '^DIR_BUYER=.*', "DIR_BUYER=$dirBuyer"
    }
}

$runtimeContent | Set-Content .env.runtime

# Set environment variable for Docker volume mapping
if ($dataFilesPath) {
    $env:LOCAL_DATA_FILES_PATH = $dataFilesPath
    Write-Host "Set LOCAL_DATA_FILES_PATH=$dataFilesPath for Docker volume mapping" -ForegroundColor Green
}

# Start the application with nodemon for hot reload
Write-Host "`n=== Starting application with Nodemon (Hot Reload) ===" -ForegroundColor Yellow
Write-Host "The application will automatically restart when you make code changes." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the application." -ForegroundColor Cyan

# Set environment variables for the application
$env:NODE_ENV = "development"
$env:ENV_FILE = ".env.runtime"

# Start with nodemon
Write-Host "`nStarting nodemon..." -ForegroundColor Green
npm run dev