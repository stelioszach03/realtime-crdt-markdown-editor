"""
FastAPI main application for the collaborative Markdown editor
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import json
import models
import auth
from database import get_db, create_tables
from routers import users, documents
from ws_manager import manager

# Create FastAPI app
app = FastAPI(
    title="Realtime Collaborative Markdown Editor",
    description="A modern, real-time collaborative Markdown editor with CRDT",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router)
app.include_router(documents.router)

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database tables"""
    create_tables()

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "collaborative-markdown-editor"}

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Realtime Collaborative Markdown Editor API",
        "docs": "/docs",
        "health": "/health"
    }

# WebSocket endpoint for real-time collaboration
@app.websocket("/ws/{document_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    document_id: str,
    token: str = None,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for real-time document collaboration"""
    print(f"WebSocket connection attempt for document: {document_id}, token: {token[:20] if token else 'None'}...")
    user = None
    
    # Authenticate user if token provided
    if token:
        try:
            token_data = auth.verify_token(token)
            print(f"Token verification result: {token_data}")
            if token_data and not token_data.username.startswith("guest_"):
                user = auth.get_user_by_username(db, token_data.username)
                print(f"Found user: {user}")
        except Exception as e:
            print(f"Token verification error: {e}")
            pass  # Allow guest access
    
    # Check if document exists and user has access
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    print(f"Document found: {document is not None}, is_public: {document.is_public if document else 'N/A'}")
    
    if not document:
        print("Document not found, closing connection")
        await websocket.close(code=4004, reason="Document not found")
        return
    
    # Check access permissions
    if not document.is_public and not user:
        print("Authentication required for private document")
        await websocket.close(code=4003, reason="Authentication required")
        return
    
    if not document.is_public and user and document.owner_id != user.id:
        # Check if user is a collaborator
        collaborator = db.query(models.DocumentCollaborator).filter(
            models.DocumentCollaborator.document_id == document_id,
            models.DocumentCollaborator.user_id == user.id
        ).first()
        
        if not collaborator:
            print(f"Access denied for user {user.username if user else 'None'}")
            await websocket.close(code=4003, reason="Access denied")
            return
    
    try:
        # Connect to the document room
        await manager.connect(websocket, document_id, user, db)
        
        # Handle messages
        while True:
            try:
                message = await websocket.receive_text()
                await manager.handle_message(websocket, message, db)
            except WebSocketDisconnect:
                break
            except Exception as e:
                # Send error message to client
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Error processing message: {str(e)}"
                }))
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Disconnect from the document room
        await manager.disconnect(websocket, db)

# Serve frontend static files in production
if os.path.exists("../frontend/build"):
    app.mount("/assets", StaticFiles(directory="../frontend/build/assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend application"""
        # Serve index.html for all routes (SPA)
        if full_path.startswith("api/") or full_path.startswith("ws/") or full_path.startswith("docs") or full_path.startswith("redoc"):
            raise HTTPException(status_code=404, detail="Not found")
        
        file_path = f"../frontend/build/{full_path}"
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        else:
            return FileResponse("../frontend/build/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )