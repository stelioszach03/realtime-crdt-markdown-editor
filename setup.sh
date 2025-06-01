#!/usr/bin/env bash
set -e

# Realtime Collaborative Markdown Editor - Setup Script
echo "🚀 Setting up Realtime Collaborative Markdown Editor..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Check Python version
print_status "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed or not in PATH"
    echo "Please install Python 3.10 or higher from https://python.org"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_VERSION_NUM=$(python3 -c 'import sys; print(f"{sys.version_info.major}{sys.version_info.minor:02d}")')

if [[ "$PYTHON_VERSION_NUM" -lt "310" ]]; then
    print_error "Python 3.10+ is required. Found: Python $PYTHON_VERSION"
    echo "Please upgrade Python to version 3.10 or higher"
    exit 1
fi

print_success "Python $PYTHON_VERSION found"

# Check Node.js and npm
print_status "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    echo "Please install Node.js 16+ from https://nodejs.org"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

if [[ "$NODE_MAJOR" -lt "16" ]]; then
    print_error "Node.js 16+ is required. Found: Node.js $NODE_VERSION"
    echo "Please upgrade Node.js to version 16 or higher"
    exit 1
fi

print_success "Node.js $NODE_VERSION found"

# Create virtual environment
print_status "Creating Python virtual environment..."
if [ -d ".venv" ]; then
    print_warning "Virtual environment already exists. Removing old one..."
    rm -rf .venv
fi

python3 -m venv .venv
print_success "Virtual environment created"

# Activate virtual environment
print_status "Activating virtual environment..."
source .venv/bin/activate
print_success "Virtual environment activated"

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
print_success "pip upgraded"

# Install backend dependencies
print_status "Installing backend dependencies..."
if [ ! -f "backend/requirements.txt" ]; then
    print_error "backend/requirements.txt not found"
    exit 1
fi

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
if [ ! -f "frontend/package.json" ]; then
    print_error "frontend/package.json not found"
    exit 1
fi

cd frontend
npm install
if [ $? -eq 0 ]; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

# Build frontend for production
print_status "Building frontend for production..."
npm run build
if [ $? -eq 0 ]; then
    print_success "Frontend built successfully"
else
    print_error "Failed to build frontend"
    exit 1
fi
cd ..

# Set up database
print_status "Setting up database..."
cd backend

# Create database if it doesn't exist
if [ ! -f "db.sqlite3" ]; then
    print_status "Creating database..."
    python -c "
from database import engine, Base
from models import User, Document, DocumentCollaborator, DocumentSession
Base.metadata.create_all(bind=engine)
print('Database created successfully!')
" 2>/dev/null
    if [ $? -eq 0 ]; then
        print_success "Database created"
    else
        print_warning "Database creation had issues, but continuing..."
    fi
else
    print_success "Database already exists"
fi

# Initialize Alembic if not already done
if [ ! -d "alembic/versions" ] || [ -z "$(ls -A alembic/versions 2>/dev/null)" ]; then
    print_status "Initializing database migrations..."
    alembic revision --autogenerate -m "Initial migration" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_success "Initial migration created"
    else
        print_warning "Migration creation had issues, but continuing..."
    fi
fi

# Run migrations
print_status "Running database migrations..."
alembic upgrade head > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "Database migrations completed"
else
    print_warning "Migration had issues, but continuing..."
fi

cd ..

# Make scripts executable
print_status "Making scripts executable..."
chmod +x bin/start.sh
chmod +x bin/start-dev.sh
print_success "Scripts are now executable"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Run 'source .venv/bin/activate' to activate the virtual environment"
echo "   2. Run 'bin/start.sh' to start the application"
echo "   3. Or run 'bin/start-dev.sh' for development mode"
echo ""
echo "📍 URLs (after starting):"
echo "   • Frontend: http://localhost:3000"
echo "   • Backend API: http://localhost:8000"
echo "   • API Documentation: http://localhost:8000/docs"
echo ""
print_success "Ready to collaborate! 🚀"