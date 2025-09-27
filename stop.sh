#!/bin/bash

# Stop script for KMSG Backend
# Use this to stop all services

echo "🛑 Stopping KMSG Backend Services..."

# Stop all services
docker-compose down

echo "✅ All services stopped successfully!"
echo "💡 To start again, run: ./start.sh"
