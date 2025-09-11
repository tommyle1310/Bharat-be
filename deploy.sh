#!/bin/bash

# KMSG Backend Deployment Script
# This script sets up and runs the KMSG backend on EC2

set -e

echo "🚀 Starting KMSG Backend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p data-files
mkdir -p public/uploads

# Set proper permissions
print_status "Setting permissions..."
chmod 755 data-files
chmod 755 public/uploads

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    print_warning ".env not found. Creating from template..."
    cat > .env << EOF
# KMSG Backend Environment Configuration
NODE_ENV=production
HOST=0.0.0.0
PORT=1310

# Database Configuration
DB_HOST=mysql
DB_PORT=3306
DB_USER=kmsguser
DB_PASSWORD=kmsgpass
DB_NAME=kmsgdb
DB_CONN_LIMIT=20

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false

# CORS Configuration
CORS_ORIGIN=*

# Static Files Configuration
DATA_FILES_PATH=/app/data-files
PUBLIC_URL=/public
DATA_FILES_URL=/data-files
EOF
    print_status "Created .env file with default settings"
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose down || true

# Remove old images to force rebuild
print_status "Removing old images..."
docker-compose down --rmi all || true

# Build and start services
print_status "Building and starting services..."
docker-compose up --build -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check if services are running
print_status "Checking service status..."
docker-compose ps

# Test health endpoint
print_status "Testing health endpoint..."
if curl -f http://localhost:1310/health > /dev/null 2>&1; then
    print_status "✅ Health check passed! Backend is running successfully."
    print_status "🌐 Backend is available at: http://localhost:1310"
    print_status "📊 Health check: http://localhost:1310/health"
else
    print_error "❌ Health check failed. Check logs with: docker-compose logs app"
    exit 1
fi

print_status "🎉 Deployment completed successfully!"
print_status "To view logs: docker-compose logs -f"
print_status "To stop services: docker-compose down"
print_status "To restart services: docker-compose restart"
