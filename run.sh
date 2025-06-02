#!/bin/bash

echo "Stopping any existing servers..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 2

echo "Starting Backend server on port 8000..."
cd /home/stelios/realtime-crdt-markdown-editor/backend
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

sleep 3

echo "Starting Frontend server on port 3000..."
cd /home/stelios/realtime-crdt-markdown-editor/frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "==================================="
echo "Servers are running!"
echo "Backend API: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "==================================="
echo ""
echo "To stop servers, run: kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Keep script running
wait