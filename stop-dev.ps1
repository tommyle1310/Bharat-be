Write-Host "=== Select environment file ==="
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
Write-Host "Using $ENV_FILE"

Write-Host "===Stopping Redis & MySQL containers..."
docker-compose down
