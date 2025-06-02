#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Realtime CRDT Markdown Editor...${NC}"

# Change to project directory
cd "$(dirname "$0")"

# Kill any existing processes
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "vite.*--port 3000" 2>/dev/null
sleep 2

# Activate virtual environment
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
else
    echo -e "${RED}Virtual environment not found. Run './run.sh setup' first.${NC}"
    exit 1
fi

# Export environment variables
export DATABASE_URL="sqlite:///./db.sqlite3"
export SECRET_KEY="dev-secret-key-change-in-production"
export CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
export PYTHONUNBUFFERED=1

# Start backend with proper error handling
echo -e "${GREEN}Starting backend server...${NC}"
cd backend
python -m uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level info \
    --reload-dir . \
    2>&1 | tee backend.log &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo -e "${YELLOW}Waiting for backend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}Backend started successfully!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Backend failed to start. Check backend/backend.log for errors.${NC}"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

# Start frontend
echo -e "${GREEN}Starting frontend server...${NC}"
cd frontend
npm run dev -- --host 0.0.0.0 --port 3000 2>&1 | tee frontend.log &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo -e "${YELLOW}Waiting for frontend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}Frontend started successfully!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Frontend failed to start. Check frontend/frontend.log for errors.${NC}"
        kill $BACKEND_PID 2>/dev/null
        kill $FRONTEND_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}=== Application is running! ===${NC}"
echo -e "Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "Backend API: ${GREEN}http://localhost:8000${NC}"
echo -e "API Docs: ${GREEN}http://localhost:8000/docs${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "${YELLOW}Logs: backend/backend.log and frontend/frontend.log${NC}"
echo ""

# Function to handle shutdown
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    sleep 2
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Monitor processes
while true; do
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${RED}Backend crashed! Check backend/backend.log for errors.${NC}"
        kill $FRONTEND_PID 2>/dev/null
        exit 1
    fi
    
    # Check if frontend is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}Frontend crashed! Check frontend/frontend.log for errors.${NC}"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    
    sleep 5
done