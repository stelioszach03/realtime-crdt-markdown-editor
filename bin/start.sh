#!/usr/bin/env bash
set -e

# Realtime Collaborative Markdown Editor - Start Script
echo "🚀 Starting Realtime Collaborative Markdown Editor..."

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source .venv/bin/activate

# Check if backend dependencies are installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "❌ Backend dependencies not found. Please run setup.sh first."
    exit 1
fi

# Check if frontend build exists
if [ ! -d "frontend/build" ] && [ ! -d "frontend/dist" ]; then
    echo "❌ Frontend build not found. Please run setup.sh first."
    exit 1
fi

# Set environment variables
export DATABASE_URL=${DATABASE_URL:-"sqlite:///./db.sqlite3"}
export SECRET_KEY=${SECRET_KEY:-"your-secret-key-change-in-production"}
export CORS_ORIGINS=${CORS_ORIGINS:-"http://localhost:3000,http://localhost:53520,http://localhost:57625"}

# Create database if it doesn't exist
echo "🗄️  Setting up database..."
cd backend
if [ ! -f "db.sqlite3" ]; then
    echo "Creating database..."
    python -c "
from database import engine, Base
from models import User, Document, DocumentCollaborator, DocumentSession
Base.metadata.create_all(bind=engine)
print('Database created successfully!')
"
fi

# Run database migrations
echo "Running database migrations..."
if [ -d "alembic/versions" ] && [ "$(ls -A alembic/versions)" ]; then
    alembic upgrade head
else
    echo "No migrations found, creating initial migration..."
    alembic revision --autogenerate -m "Initial migration"
    alembic upgrade head
fi

cd ..

# Start backend server
echo "🔧 Starting backend server on port 8000..."
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if backend is running
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Backend started successfully!"

# Start frontend server
echo "🌐 Starting frontend server on port 3000..."
cd frontend

# Check which build directory exists
if [ -d "build" ]; then
    BUILD_DIR="build"
elif [ -d "dist" ]; then
    BUILD_DIR="dist"
else
    echo "❌ No build directory found"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Start static file server
npx serve -s $BUILD_DIR -l 3000 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 2

echo ""
echo "🎉 Realtime Collaborative Markdown Editor is now running!"
echo ""
echo "📍 Frontend: http://localhost:3000"
echo "📍 Backend API: http://localhost:8000"
echo "📍 API Documentation: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait