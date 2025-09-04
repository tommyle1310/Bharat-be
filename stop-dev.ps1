Write-Host "===Stopping Redis & MySQL containers..."

# Danh sách container cần stop
$containers = "redis-local","mysql-local"

foreach ($c in $containers) {
    # Kiểm tra container có đang chạy không
    $running = docker ps -q -f name=$c
    if ($running) {
        docker stop $c
        docker rm $c
        Write-Host "===Stopped and removed container $c"
    } else {
        Write-Host "===Container $c is not running"
    }
}

Write-Host "===All containers processed"
