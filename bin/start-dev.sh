#!/usr/bin/env bash
set -e

# Development mode startup script
echo "🔧 Starting Realtime Collaborative Markdown Editor in Development Mode..."

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source .venv/bin/activate

# Set environment variables for development
export DATABASE_URL=${DATABASE_URL:-"sqlite:///./db.sqlite3"}
export SECRET_KEY=${SECRET_KEY:-"dev-secret-key-change-in-production"}
export CORS_ORIGINS=${CORS_ORIGINS:-"http://localhost:3000,http://localhost:53520,http://localhost:57625"}

# Setup database
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

# Run migrations
if [ -d "alembic/versions" ] && [ "$(ls -A alembic/versions)" ]; then
    alembic upgrade head
else
    echo "Creating initial migration..."
    alembic revision --autogenerate -m "Initial migration"
    alembic upgrade head
fi

cd ..

# Start backend in development mode
echo "🔧 Starting backend server in development mode..."
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# Start frontend in development mode
echo "🌐 Starting frontend development server..."
cd frontend
npm run dev -- --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 Development servers are running!"
echo ""
echo "📍 Frontend (Dev): http://localhost:3000"
echo "📍 Backend (Dev): http://localhost:8000"
echo "📍 API Documentation: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping development servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM
wait