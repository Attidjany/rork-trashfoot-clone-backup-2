#!/bin/bash

echo "🚀 Starting Sports Competition App Development Environment"
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install it first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    bun install
fi

echo "🔧 Starting backend server on port 3001..."
echo "🌐 Starting frontend development server..."
echo ""
echo "Backend API will be available at: http://localhost:3001/api/"
echo "Frontend will be available at: http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Run both servers concurrently
bun run server.ts &
BACKEND_PID=$!

sleep 2

bunx rork start -p pjno48qqvxyfiw5d0brt0 --tunnel &
FRONTEND_PID=$!

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait