"""
FastAPI main application for the collaborative Markdown editor
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import json
import logging
import sys
import models
import auth
from database import get_db, create_tables
from routers import users, documents
from optimized_ws_manager import optimized_manager as manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Create rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per minute", "50 per second"],
    storage_uri="memory://",
)

# Create FastAPI app
app = FastAPI(
    title="Realtime Collaborative Markdown Editor",
    description="A modern, real-time collaborative Markdown editor with CRDT",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(users.router)
app.include_router(documents.router)

# Global variable to track cleanup task
cleanup_task = None

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database tables and start background tasks"""
    global cleanup_task
    logger.info("Starting application...")
    create_tables()
    logger.info("Database tables created successfully")
    logger.info("Background tasks started")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("Shutting down application...")
    global cleanup_task
    if cleanup_task:
        cleanup_task.cancel()
        logger.info("Cleanup task cancelled")
    # Save all pending documents
    from database import SessionLocal
    db = SessionLocal()
    try:
        logger.info(f"Saving {len(manager.document_crdts)} pending documents...")
        for doc_id in list(manager.document_crdts.keys()):
            await manager._save_document_state(doc_id, db)
        logger.info("All documents saved successfully")
    finally:
        db.close()

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    stats = manager.get_stats()
    return {
        "status": "healthy", 
        "service": "collaborative-markdown-editor",
        "connections": stats
    }

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
    logger.info(f"WebSocket connection attempt for document: {document_id}, token: {token[:20] if token else 'None'}...")
    user = None
    
    # Authenticate user if token provided
    if token:
        try:
            # Remove "Bearer " prefix if present (in case it's passed from header format)
            clean_token = token.replace("Bearer ", "") if token.startswith("Bearer ") else token
            logger.debug(f"Cleaned token: {clean_token[:20] if clean_token else 'None'}...")
            
            token_data = auth.verify_token(clean_token)
            logger.debug(f"Token verification result: {token_data}")
            if token_data and not token_data.username.startswith("guest_"):
                user = auth.get_user_by_username(db, token_data.username)
                logger.info(f"Found user: {user.username if user else 'None'}")
        except Exception as e:
            logger.warning(f"Token verification error: {e}")
            pass  # Allow guest access
    
    # Check if document exists and user has access
    document = db.query(models.Document).filter(
        models.Document.id == document_id
    ).first()
    
    logger.info(f"Document found: {document is not None}, is_public: {document.is_public if document else 'N/A'}")
    
    if not document:
        logger.warning("Document not found, closing connection")
        await websocket.close(code=4004, reason="Document not found")
        return
    
    # Check access permissions
    if not document.is_public and not user:
        logger.warning("Authentication required for private document")
        await websocket.close(code=4003, reason="Authentication required")
        return
    
    if not document.is_public and user and document.owner_id != user.id:
        # Check if user is a collaborator
        collaborator = db.query(models.DocumentCollaborator).filter(
            models.DocumentCollaborator.document_id == document_id,
            models.DocumentCollaborator.user_id == user.id
        ).first()
        
        if not collaborator:
            logger.warning(f"Access denied for user {user.username if user else 'None'}")
            await websocket.close(code=4003, reason="Access denied")
            return
    
    try:
        # Connect to the document room
        await manager.connect(websocket, document_id, user, db)
        
        # Handle messages
        while True:
            try:
                message = await websocket.receive_text()
                # Validate message size (limit to 1MB)
                if len(message) > 1_048_576:  # 1MB
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Message too large (max 1MB)"
                    }))
                    continue
                
                await manager.handle_message(websocket, message, db)
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}", exc_info=True)
                
                # Send error message to client
                try:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Error processing message: {str(e)}"
                    }))
                except:
                    # If we can't send error message, connection is likely broken
                    break
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error for document {document_id}: {e}", exc_info=True)
        
        # Try to send error before closing
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Connection error occurred"
            }))
        except:
            pass
    finally:
        # Disconnect from the document room
        try:
            await manager.disconnect(websocket, db)
        except Exception as e:
            logger.error(f"Error during disconnect: {e}", exc_info=True)

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