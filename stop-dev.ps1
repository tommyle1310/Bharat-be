Write-Host "=== KMSG Buyer Service - Stop Local Development ===" -ForegroundColor Red

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

Write-Host "`n=== Stopping all containers ===" -ForegroundColor Yellow

# Stop all project containers
Write-Host "Stopping application containers..." -ForegroundColor Cyan
docker compose -p indus_auction_system_buyer_service -f docker-compose.yml down 2>$null

Write-Host "Stopping Redis container..." -ForegroundColor Cyan
docker compose -p indus_auction_system_buyer_service -f docker-compose.redis.yml down 2>$null

Write-Host "Stopping MySQL container..." -ForegroundColor Cyan
docker compose -p indus_auction_system_buyer_service -f docker-compose.mysql.yml down 2>$null

# Clean up runtime environment file
if (Test-Path ".env.runtime") {
    Write-Host "Removing .env.runtime file..." -ForegroundColor Cyan
    Remove-Item .env.runtime -Force
}

Write-Host "`n=== Checking remaining containers ===" -ForegroundColor Yellow
$remainingContainers = docker ps --filter "name=indus_auction_system_buyer_service" --format "table {{.Names}}\t{{.Status}}"
if ($remainingContainers -match "indus_auction_system_buyer_service") {
    Write-Host "Remaining containers:" -ForegroundColor Yellow
    Write-Host $remainingContainers
} else {
    Write-Host "All containers stopped successfully!" -ForegroundColor Green
}

Write-Host "`n=== Development environment stopped ===" -ForegroundColor Green
Write-Host "You can now run start-dev.ps1 again to restart the development environment." -ForegroundColor Cyan