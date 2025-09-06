#!/bin/bash

# KMSG Buyer-Service Master Script
# One script to rule them all! 🎯

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[KMSG]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[KMSG]${NC} $1"; }
print_error() { echo -e "${RED}[KMSG]${NC} $1"; }
print_info() { echo -e "${BLUE}[KMSG]${NC} $1"; }

# Show help
show_help() {
    echo "🎯 KMSG Buyer-Service Master Script"
    echo ""
    echo "Usage: ./kmsg.sh [command]"
    echo ""
    echo "Commands:"
    echo "  setup     - First time setup (run once)"
    echo "  start     - Start the service"
    echo "  stop      - Stop the service"
    echo "  restart   - Restart the service"
    echo "  logs      - View logs"
    echo "  status    - Check status"
    echo "  deploy    - Manual deployment"
    echo "  webhook   - Test webhook"
    echo "  help      - Show this help"
    echo ""
    echo "Examples:"
    echo "  ./kmsg.sh setup    # First time setup"
    echo "  ./kmsg.sh start    # Start service"
    echo "  ./kmsg.sh logs     # View logs"
}

# Setup function
setup() {
    print_status "Setting up KMSG Buyer-Service..."
    
    # Make scripts executable
    chmod +x *.sh
    
    # Create .env if not exists
    if [ ! -f .env ]; then
        print_status "Creating .env file..."
        cat > .env << EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=4000
DB_HOST=mysql
DB_PORT=3306
DB_USER=kmsguser
DB_PASSWORD=kmsgpass
DB_NAME=kmsgdb
DB_CONN_LIMIT=20
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false
CORS_ORIGIN=*
DATA_FILES_PATH=/app/data-files
PUBLIC_URL=/public
DATA_FILES_URL=/data-files
WEBHOOK_PORT=3001
WEBHOOK_SECRET=$(openssl rand -hex 32)
EOF
    fi
    
    # Start webhook (stop old one first if exists)
    print_status "Starting webhook..."
    pm2 stop kmsg-buyer-webhook 2>/dev/null || true
    pm2 delete kmsg-buyer-webhook 2>/dev/null || true
    pm2 start deploy-webhook.js --name "kmsg-buyer-webhook" --env production
    pm2 save
    
    # Install Docker if not installed
    if ! command -v docker &> /dev/null; then
        print_status "Installing Docker..."
        sudo apt-get update
        sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io
        sudo usermod -aG docker $USER
        print_status "Docker installed! You may need to log out and back in for group changes to take effect."
    fi
    
    # Install Docker Compose if not installed
    if ! command -v docker-compose &> /dev/null; then
        print_status "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
    
    # Deploy service
    print_status "Deploying service..."
    ./deploy.sh
    
    print_status "✅ Setup complete!"
    print_info "🌐 Service: http://$(curl -s ifconfig.me):4000"
    print_info "🎣 Webhook: http://$(curl -s ifconfig.me):3001/deploy"
}

# Start function
start() {
    print_status "Starting buyer-service..."
    if docker-compose ps | grep -q "Up"; then
        print_warning "Services are already running. Restarting..."
        docker-compose restart
    else
        print_status "Starting services..."
        docker-compose up -d
    fi
    sleep 10
    print_status "✅ Services started! Backend available at: http://localhost:4000"
}

# Stop function
stop() {
    print_status "Stopping buyer-service..."
    docker-compose down
    print_status "✅ All services stopped successfully!"
}

# Restart function
restart() {
    print_status "Restarting buyer-service..."
    docker-compose down
    docker-compose up -d
    sleep 10
    print_status "✅ Services restarted! Backend available at: http://localhost:4000"
}

# Logs function
logs() {
    print_status "Showing logs..."
    docker-compose logs -f
}

# Status function
status() {
    print_status "Checking status..."
    echo ""
    print_info "📊 PM2 Status:"
    pm2 status
    echo ""
    print_info "🐳 Docker Status:"
    docker-compose ps
    echo ""
    print_info "🌐 Health Check:"
    curl -s http://localhost:4000/health | jq . 2>/dev/null || curl -s http://localhost:4000/health
}

# Deploy function
deploy() {
    print_status "Manual deployment..."
    ./deploy.sh
}

# Webhook test function
webhook() {
    print_status "Testing webhook..."
    WEBHOOK_URL="http://localhost:3001/deploy"
    SECRET=$(grep WEBHOOK_SECRET .env | cut -d'=' -f2)
    
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"ref\": \"refs/heads/main\", \"secret\": \"$SECRET\"}"
}

# Main script logic
case "${1:-help}" in
    setup)
        setup
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    deploy)
        deploy
        ;;
    webhook)
        webhook
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
