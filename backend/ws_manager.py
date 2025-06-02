"""
WebSocket connection manager for real-time collaboration
"""
from typing import Dict, List, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import json
import asyncio
import uuid
from datetime import datetime
import models
import schemas
from crdt import SequenceCRDT, CRDTOperation
from database import get_db
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)


class LRUCache(OrderedDict):
    """Simple LRU cache implementation"""
    def __init__(self, maxsize=128):
        self.maxsize = maxsize
        super().__init__()
    
    def __setitem__(self, key, value):
        if key in self:
            self.move_to_end(key)
        super().__setitem__(key, value)
        if len(self) > self.maxsize:
            oldest = next(iter(self))
            del self[oldest]
    
    def __getitem__(self, key):
        value = super().__getitem__(key)
        self.move_to_end(key)
        return value


class ConnectionManager:
    """Manages WebSocket connections for collaborative editing"""
    
    def __init__(self):
        # Document ID -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # WebSocket -> Connection info
        self.connection_info: Dict[WebSocket, Dict] = {}
        # Document ID -> CRDT instance (with LRU cache)
        self.document_crdts: LRUCache = LRUCache(maxsize=100)
        # Document ID -> Last save timestamp
        self.last_save_times: Dict[str, datetime] = {}
        # Save debounce delay in seconds
        self.save_delay = 3.0
        # Track active save tasks
        self.save_tasks: Dict[str, asyncio.Task] = {}
        # Lock for connection cleanup
        self.cleanup_lock = asyncio.Lock()
    
    async def connect(
        self, 
        websocket: WebSocket, 
        document_id: str, 
        user: Optional[models.User],
        db: Session
    ):
        """Accept a new WebSocket connection"""
        logger.info(f"Manager.connect called for document {document_id}, user: {user.username if user else 'None'}")
        await websocket.accept()
        logger.debug("WebSocket accepted")
        
        # Initialize document connections if not exists
        if document_id not in self.active_connections:
            self.active_connections[document_id] = set()
        
        # Add connection
        self.active_connections[document_id].add(websocket)
        logger.debug(f"Added connection to document {document_id}")
        
        # Generate site ID for CRDT
        site_id = f"{user.id if user else 'guest'}_{uuid.uuid4().hex[:8]}"
        logger.debug(f"Generated site_id: {site_id}")
        
        # Store connection info
        self.connection_info[websocket] = {
            "document_id": document_id,
            "user": user,
            "site_id": site_id,
            "connected_at": datetime.utcnow()
        }
        
        # Initialize or load CRDT for document
        logger.debug(f"Initializing CRDT for document {document_id}")
        await self._initialize_document_crdt(document_id, site_id, db)
        logger.debug("CRDT initialized successfully")
        
        # Create session record
        session = models.DocumentSession(
            document_id=document_id,
            user_id=user.id if user else None,
            session_id=str(uuid.uuid4()),
            site_id=site_id,
            is_active=True
        )
        db.add(session)
        db.commit()
        logger.debug("Session record created")
        
        # Send initial document state
        logger.debug("Sending initial state")
        await self._send_initial_state(websocket, document_id)
        logger.debug("Initial state sent")
        
        # Notify other users about new connection
        await self._broadcast_presence_update(document_id, "user_joined", {
            "user_id": user.id if user else None,
            "username": user.username if user else "Guest",
            "site_id": site_id
        })
        logger.info("Connection setup completed successfully")
    
    async def disconnect(self, websocket: WebSocket, db: Session):
        """Handle WebSocket disconnection"""
        async with self.cleanup_lock:
            if websocket not in self.connection_info:
                return
            
            info = self.connection_info[websocket]
            document_id = info["document_id"]
            user = info["user"]
            site_id = info["site_id"]
            
            # Remove from active connections
            if document_id in self.active_connections:
                self.active_connections[document_id].discard(websocket)
                
                # Clean up empty document connections
                if not self.active_connections[document_id]:
                    del self.active_connections[document_id]
                    # Save final state before cleanup
                    await self._save_document_state(document_id, db)
                    # Cancel any pending save tasks
                    if document_id in self.save_tasks:
                        self.save_tasks[document_id].cancel()
                        del self.save_tasks[document_id]
                    # Note: CRDT will be automatically removed from LRU cache when space is needed
            
            # Remove connection info
            del self.connection_info[websocket]
            
            try:
                # Update session as inactive
                session = db.query(models.DocumentSession).filter(
                    models.DocumentSession.site_id == site_id,
                    models.DocumentSession.is_active == True
                ).first()
                if session:
                    session.is_active = False
                    session.last_seen = datetime.utcnow()
                    db.commit()
            except Exception as e:
                logger.error(f"Error updating session for site_id {site_id}: {e}")
                db.rollback()
            
            # Notify other users about disconnection
            try:
                await self._broadcast_presence_update(document_id, "user_left", {
                    "user_id": user.id if user else None,
                    "username": user.username if user else "Guest",
                    "site_id": site_id
                })
            except Exception as e:
                logger.error(f"Error broadcasting disconnect presence: {e}")
    
    async def handle_message(self, websocket: WebSocket, message: str, db: Session):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "operation":
                await self._handle_crdt_operation(websocket, data, db)
            elif message_type == "cursor":
                await self._handle_cursor_update(websocket, data)
            elif message_type == "presence":
                await self._handle_presence_update(websocket, data)
            else:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                }))
        
        except json.JSONDecodeError:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Invalid JSON message"
            }))
        except Exception as e:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error processing message: {str(e)}"
            }))
    
    async def _handle_crdt_operation(self, websocket: WebSocket, data: dict, db: Session):
        """Handle CRDT operation from client"""
        info = self.connection_info[websocket]
        document_id = info["document_id"]
        site_id = info["site_id"]
        
        if document_id not in self.document_crdts:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Document not initialized"
            }))
            return
        
        try:
            # Parse operation
            op_data = data.get("operation", {})
            operation = CRDTOperation.from_dict(op_data)
            
            # Apply operation to server CRDT
            crdt = self.document_crdts[document_id]
            success = crdt.apply_remote(operation)
            
            if success:
                # Broadcast to other clients
                await self._broadcast_operation(document_id, operation, exclude=websocket)
                
                # Schedule save
                self._schedule_save(document_id, db)
            else:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Failed to apply operation"
                }))
        
        except Exception as e:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Error processing operation: {str(e)}"
            }))
    
    async def _handle_cursor_update(self, websocket: WebSocket, data: dict):
        """Handle cursor position update"""
        info = self.connection_info[websocket]
        document_id = info["document_id"]
        
        cursor_data = data.get("cursor", {})
        cursor_data["site_id"] = info["site_id"]
        cursor_data["user_id"] = info["user"].id if info["user"] else None
        cursor_data["username"] = info["user"].username if info["user"] else "Guest"
        
        # Broadcast cursor update to other clients
        await self._broadcast_message(document_id, {
            "type": "cursor",
            "cursor": cursor_data
        }, exclude=websocket)
    
    async def _handle_presence_update(self, websocket: WebSocket, data: dict):
        """Handle presence update (typing indicators, etc.)"""
        info = self.connection_info[websocket]
        document_id = info["document_id"]
        
        presence_data = data.get("presence", {})
        presence_data["site_id"] = info["site_id"]
        presence_data["user_id"] = info["user"].id if info["user"] else None
        presence_data["username"] = info["user"].username if info["user"] else "Guest"
        
        # Broadcast presence update to other clients
        await self._broadcast_message(document_id, {
            "type": "presence",
            "presence": presence_data
        }, exclude=websocket)
    
    async def _initialize_document_crdt(self, document_id: str, site_id: str, db: Session):
        """Initialize or load CRDT for a document"""
        if document_id in self.document_crdts:
            return
        
        # Load document from database
        document = db.query(models.Document).filter(
            models.Document.id == document_id
        ).first()
        
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Initialize CRDT
        if document.crdt_state:
            # Load existing state
            crdt_data = json.loads(document.crdt_state)
            crdt = SequenceCRDT.from_dict(crdt_data)
        else:
            # Create new CRDT
            crdt = SequenceCRDT(site_id)
        
        self.document_crdts[document_id] = crdt
    
    async def _send_initial_state(self, websocket: WebSocket, document_id: str):
        """Send initial document state to newly connected client"""
        if document_id not in self.document_crdts:
            return
        
        crdt = self.document_crdts[document_id]
        
        await websocket.send_text(json.dumps({
            "type": "initial_state",
            "document_id": document_id,
            "crdt_state": crdt.to_dict(),
            "text": crdt.get_text()
        }))
    
    async def _broadcast_operation(
        self, 
        document_id: str, 
        operation: CRDTOperation, 
        exclude: Optional[WebSocket] = None
    ):
        """Broadcast CRDT operation to all clients in document"""
        message = {
            "type": "operation",
            "operation": operation.to_dict()
        }
        
        await self._broadcast_message(document_id, message, exclude)
    
    async def _broadcast_presence_update(
        self, 
        document_id: str, 
        event_type: str, 
        data: dict
    ):
        """Broadcast presence update to all clients in document"""
        message = {
            "type": "presence",
            "event": event_type,
            "data": data
        }
        
        await self._broadcast_message(document_id, message)
    
    async def _broadcast_message(
        self, 
        document_id: str, 
        message: dict, 
        exclude: Optional[WebSocket] = None
    ):
        """Broadcast message to all clients in document"""
        if document_id not in self.active_connections:
            return
        
        message_str = json.dumps(message)
        connections = self.active_connections[document_id].copy()
        broken_connections = []
        
        for connection in connections:
            if connection == exclude:
                continue
            
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.warning(f"Failed to send message to connection: {e}")
                # Mark connection as broken
                broken_connections.append(connection)
        
        # Clean up broken connections
        if broken_connections:
            # Get a database session for cleanup
            from database import SessionLocal
            db = SessionLocal()
            try:
                for connection in broken_connections:
                    await self.disconnect(connection, db)
            finally:
                db.close()
    
    def _schedule_save(self, document_id: str, db: Session):
        """Schedule document save with debouncing"""
        self.last_save_times[document_id] = datetime.utcnow()
        
        # Cancel existing save task if any
        if document_id in self.save_tasks:
            self.save_tasks[document_id].cancel()
        
        # Create new save task
        task = asyncio.create_task(self._delayed_save(document_id, db))
        self.save_tasks[document_id] = task
    
    async def _delayed_save(self, document_id: str, db: Session):
        """Save document after delay (debounced)"""
        try:
            await asyncio.sleep(self.save_delay)
            
            # Check if there were more recent changes
            if (document_id in self.last_save_times and 
                (datetime.utcnow() - self.last_save_times[document_id]).total_seconds() >= self.save_delay):
                await self._save_document_state(document_id, db)
        except asyncio.CancelledError:
            # Task was cancelled, that's fine
            pass
        finally:
            # Clean up task reference
            if document_id in self.save_tasks:
                del self.save_tasks[document_id]
    
    async def _save_document_state(self, document_id: str, db: Session):
        """Save current CRDT state to database"""
        if document_id not in self.document_crdts:
            return
        
        try:
            crdt = self.document_crdts[document_id]
            crdt_state_json = json.dumps(crdt.to_dict())
            
            # Check size limit (5MB)
            if len(crdt_state_json) > 5_242_880:  # 5MB in bytes
                logger.error(f"Document {document_id} CRDT state too large: {len(crdt_state_json)} bytes")
                # Clean up the CRDT to prevent memory issues
                del self.document_crdts[document_id]
                return
            
            # Update document in database
            document = db.query(models.Document).filter(
                models.Document.id == document_id
            ).first()
            
            if document:
                document.crdt_state = crdt_state_json
                document.updated_at = datetime.utcnow()
                
                # Calculate and update word count
                from routers.documents import calculate_word_count
                document.word_count = calculate_word_count(crdt_state_json)
                
                db.commit()
        
        except Exception as e:
            logger.error(f"Error saving document {document_id}: {e}")
            db.rollback()

    
    async def cleanup_stale_connections(self):
        """Periodically clean up stale connections"""
        while True:
            try:
                await asyncio.sleep(60)  # Run every minute
                
                async with self.cleanup_lock:
                    # Check all connections
                    all_websockets = list(self.connection_info.keys())
                    for ws in all_websockets:
                        try:
                            # Try to ping the connection
                            await ws.send_text(json.dumps({"type": "ping"}))
                        except Exception:
                            # Connection is stale, clean it up
                            from database import SessionLocal
                            db = SessionLocal()
                            try:
                                await self.disconnect(ws, db)
                            finally:
                                db.close()
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
    
    def get_connection_stats(self) -> dict:
        """Get statistics about current connections"""
        return {
            "total_connections": len(self.connection_info),
            "active_documents": len(self.active_connections),
            "cached_crdts": len(self.document_crdts),
            "pending_saves": len(self.save_tasks),
            "connections_by_document": {
                doc_id: len(connections) 
                for doc_id, connections in self.active_connections.items()
            }
        }


# Global connection manager instance
manager = ConnectionManager()