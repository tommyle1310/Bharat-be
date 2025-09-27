#!/bin/bash

# KMSG Buyer-Service Auto-Deploy Script
# This script is triggered by Git webhook to automatically deploy ONLY buyer-service

set -e

echo "🚀 Starting KMSG Buyer-Service auto-deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[AUTO-DEPLOY]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[AUTO-DEPLOY]${NC} $1"
}

print_error() {
    echo -e "${RED}[AUTO-DEPLOY]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[AUTO-DEPLOY]${NC} $1"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_info "Working directory: $SCRIPT_DIR"

# Pull latest changes from Git
print_status "Pulling latest changes from Git..."
git fetch origin
git reset --hard origin/main

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Starting Docker..."
    sudo systemctl start docker
    sleep 10
fi

# Stop ONLY buyer-service containers (not other services)
print_status "Stopping buyer-service containers..."
docker-compose down || true

# Build and start ONLY buyer-service
print_status "Building and starting buyer-service..."
docker-compose up --build -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check if buyer-service is running
print_status "Checking buyer-service status..."
docker-compose ps

# Test health endpoint
print_status "Testing buyer-service health endpoint..."
if curl -f http://localhost:1310/health > /dev/null 2>&1; then
    print_status "✅ Buyer-Service auto-deployment completed successfully!"
    print_status "🌐 Buyer-Service is available at: http://localhost:1310"
    print_status "📊 Health check: http://localhost:1310/health"
else
    print_error "❌ Buyer-Service health check failed after deployment"
    print_error "Check logs with: docker-compose logs app"
    exit 1
fi

print_status "🎉 Buyer-Service auto-deployment completed!"
