#!/usr/bin/env bash
set -e

# Realtime Collaborative Markdown Editor
# Professional all-in-one script for setup and running

# Script metadata
SCRIPT_VERSION="1.0.0"
PROJECT_NAME="Realtime Collaborative Markdown Editor"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# Unicode symbols
CHECK_MARK="✅"
CROSS_MARK="❌"
ARROW="→"
ROCKET="🚀"
PACKAGE="📦"
DATABASE="🗄️"
WRENCH="🔧"
GLOBE="🌐"
PARTY="🎉"
STOP="🛑"
WARNING="⚠️"
INFO="ℹ️"

# Helper functions
print_header() {
    echo ""
    echo -e "${BOLD}${CYAN}=================================================================================${NC}"
    echo -e "${BOLD}${CYAN}   $PROJECT_NAME ${NC}"
    echo -e "${BOLD}${CYAN}=================================================================================${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}${ARROW}${NC} $1"
}

print_success() {
    echo -e "${GREEN}${CHECK_MARK}${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}${WARNING}${NC} $1"
}

print_error() {
    echo -e "${RED}${CROSS_MARK}${NC} $1"
}

print_info() {
    echo -e "${CYAN}${INFO}${NC} $1"
}

show_usage() {
    print_header
    echo -e "${BOLD}Usage:${NC}"
    echo "  ./run.sh [command]"
    echo ""
    echo -e "${BOLD}Commands:${NC}"
    echo "  setup      - Install dependencies and configure the project"
    echo "  dev        - Start in development mode (hot reload)"
    echo "  prod       - Start in production mode"
    echo "  start      - Start in production mode (alias for prod)"
    echo "  help       - Show this help message"
    echo ""
    echo -e "${BOLD}Examples:${NC}"
    echo "  ./run.sh setup    # First time setup"
    echo "  ./run.sh dev      # Development with hot reload"
    echo "  ./run.sh prod     # Production deployment"
    echo ""
}

# Check system requirements
check_requirements() {
    local has_errors=false
    
    print_status "Checking system requirements..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        echo "    Please install Python 3.10+ from https://python.org"
        has_errors=true
    else
        PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        PYTHON_VERSION_NUM=$(python3 -c 'import sys; print(f"{sys.version_info.major}{sys.version_info.minor:02d}")')
        
        if [[ "$PYTHON_VERSION_NUM" -lt "310" ]]; then
            print_error "Python 3.10+ required (found: Python $PYTHON_VERSION)"
            has_errors=true
        else
            print_success "Python $PYTHON_VERSION"
        fi
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "    Please install Node.js 16+ from https://nodejs.org"
        has_errors=true
    else
        NODE_VERSION=$(node --version | sed 's/v//')
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
        
        if [[ "$NODE_MAJOR" -lt "16" ]]; then
            print_error "Node.js 16+ required (found: Node.js $NODE_VERSION)"
            has_errors=true
        else
            print_success "Node.js $NODE_VERSION"
        fi
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        has_errors=true
    else
        NPM_VERSION=$(npm --version)
        print_success "npm $NPM_VERSION"
    fi
    
    if [ "$has_errors" = true ]; then
        echo ""
        print_error "System requirements not met. Please install missing dependencies."
        exit 1
    fi
}

# Setup function
setup_project() {
    print_header
    echo -e "${ROCKET} ${BOLD}Setting up $PROJECT_NAME${NC}"
    echo ""
    
    check_requirements
    
    # Create virtual environment
    print_status "Creating Python virtual environment..."
    if [ -d ".venv" ]; then
        print_warning "Virtual environment exists, recreating..."
        rm -rf .venv
    fi
    python3 -m venv .venv
    print_success "Virtual environment created"
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Upgrade pip
    print_status "Upgrading pip..."
    pip install --upgrade pip > /dev/null 2>&1
    print_success "pip upgraded"
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    pip install -r requirements.txt
    if [ $? -eq 0 ]; then
        print_success "Backend dependencies installed"
    else
        print_error "Failed to install backend dependencies"
        exit 1
    fi
    cd ..
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    if [ $? -eq 0 ]; then
        print_success "Frontend dependencies installed"
    else
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
    
    # Build frontend
    print_status "Building frontend for production..."
    npm run build
    if [ $? -eq 0 ]; then
        print_success "Frontend built successfully"
    else
        print_error "Failed to build frontend"
        exit 1
    fi
    cd ..
    
    # Setup database
    print_status "Setting up database..."
    cd backend
    python -c "
from database import engine, Base
from models import User, Document, DocumentCollaborator, DocumentSession
Base.metadata.create_all(bind=engine)
print('Database initialized')
" 2>/dev/null
    
    if [ -d "alembic/versions" ] && [ "$(ls -A alembic/versions 2>/dev/null)" ]; then
        alembic upgrade head > /dev/null 2>&1
    else
        alembic revision --autogenerate -m "Initial migration" > /dev/null 2>&1
        alembic upgrade head > /dev/null 2>&1
    fi
    print_success "Database configured"
    cd ..
    
    echo ""
    print_success "${PARTY} Setup completed successfully!"
    echo ""
    print_info "Next steps:"
    echo "   • Run './run.sh dev' for development mode"
    echo "   • Run './run.sh prod' for production mode"
    echo ""
}

# Start development mode
start_dev() {
    print_header
    echo -e "${WRENCH} ${BOLD}Starting in Development Mode${NC}"
    echo ""
    
    # Check if setup has been run
    if [ ! -d ".venv" ]; then
        print_error "Project not set up. Run './run.sh setup' first."
        exit 1
    fi
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Kill any existing processes on our ports
    print_status "Checking for existing processes..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
    
    # Set development environment variables
    export DATABASE_URL="sqlite:///./db.sqlite3"
    export SECRET_KEY="dev-secret-key-change-in-production"
    export CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
    
    # Start backend
    print_status "Starting backend server..."
    cd backend
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload \
        --limit-max-requests 1000 \
        --timeout-keep-alive 5 &
    BACKEND_PID=$!
    cd ..
    
    sleep 3
    
    # Start frontend
    print_status "Starting frontend development server..."
    cd frontend
    npm run dev -- --host 0.0.0.0 --port 3000 &
    FRONTEND_PID=$!
    cd ..
    
    echo ""
    print_success "${PARTY} Development servers are running!"
    echo ""
    echo -e "${GLOBE} Frontend: ${BOLD}http://localhost:3000${NC}"
    echo -e "${PACKAGE} Backend API: ${BOLD}http://localhost:8000${NC}"
    echo -e "${DATABASE} API Docs: ${BOLD}http://localhost:8000/docs${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
    
    # Cleanup function
    cleanup() {
        echo ""
        print_status "${STOP} Stopping development servers..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        print_success "All services stopped"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
    
    # Keep the script running in background if requested
    if [[ "${2:-}" == "--detach" ]] || [[ "${2:-}" == "-d" ]]; then
        echo ""
        echo -e "${INFO} Running in detached mode. PIDs: Backend=$BACKEND_PID, Frontend=$FRONTEND_PID"
        echo -e "${INFO} To stop: kill $BACKEND_PID $FRONTEND_PID"
        disown $BACKEND_PID
        disown $FRONTEND_PID
    else
        wait
    fi
}

# Start production mode
start_prod() {
    print_header
    echo -e "${ROCKET} ${BOLD}Starting in Production Mode${NC}"
    echo ""
    
    # Check if setup has been run
    if [ ! -d ".venv" ]; then
        print_error "Project not set up. Run './run.sh setup' first."
        exit 1
    fi
    
    # Check if frontend build exists
    if [ ! -d "frontend/dist" ] && [ ! -d "frontend/build" ]; then
        print_error "Frontend build not found. Run './run.sh setup' first."
        exit 1
    fi
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Kill any existing processes
    print_status "Checking for existing processes..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
    
    # Set production environment variables
    export DATABASE_URL=${DATABASE_URL:-"sqlite:///./db.sqlite3"}
    export SECRET_KEY=${SECRET_KEY:-"your-secret-key-change-in-production"}
    export CORS_ORIGINS=${CORS_ORIGINS:-"http://localhost:3000"}
    
    # Start backend
    print_status "Starting backend server..."
    cd backend
    uvicorn main:app --host 0.0.0.0 --port 8000 \
        --workers 4 \
        --limit-max-requests 1000 \
        --timeout-keep-alive 5 \
        --access-log &
    BACKEND_PID=$!
    cd ..
    
    sleep 3
    
    # Check if backend is running
    if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
        print_warning "Backend health check failed, but continuing..."
    fi
    
    # Start frontend
    print_status "Starting frontend server..."
    cd frontend
    
    # Determine build directory
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
    elif [ -d "build" ]; then
        BUILD_DIR="build"
    else
        print_error "No build directory found"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    npx serve -s $BUILD_DIR -l 3000 &
    FRONTEND_PID=$!
    cd ..
    
    echo ""
    print_success "${PARTY} Production servers are running!"
    echo ""
    echo -e "${GLOBE} Frontend: ${BOLD}http://localhost:3000${NC}"
    echo -e "${PACKAGE} Backend API: ${BOLD}http://localhost:8000${NC}"
    echo -e "${DATABASE} API Docs: ${BOLD}http://localhost:8000/docs${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
    
    # Cleanup function
    cleanup() {
        echo ""
        print_status "${STOP} Stopping production servers..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        print_success "All services stopped"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
    
    # Keep the script running in background if requested
    if [[ "${2:-}" == "--detach" ]] || [[ "${2:-}" == "-d" ]]; then
        echo ""
        echo -e "${INFO} Running in detached mode. PIDs: Backend=$BACKEND_PID, Frontend=$FRONTEND_PID"
        echo -e "${INFO} To stop: kill $BACKEND_PID $FRONTEND_PID"
        disown $BACKEND_PID
        disown $FRONTEND_PID
    else
        wait
    fi
}

# Main script logic
case "${1:-help}" in
    setup)
        setup_project
        ;;
    dev|development)
        start_dev
        ;;
    prod|production|start)
        start_prod
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac