#!/bin/bash
cd /home/stelios/realtime-crdt-markdown-editor/backend
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000