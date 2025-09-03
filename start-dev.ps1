Write-Host "🚀 Starting Redis & MySQL containers..."
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Redis (6379) and MySQL (3306) are now running."
    Write-Host "👉 You can now run: npm run dev"
} else {
    Write-Host "❌ Failed to start containers."
}
