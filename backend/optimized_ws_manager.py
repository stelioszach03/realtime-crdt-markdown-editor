"""
Optimized WebSocket connection manager with better memory management
"""
from typing import Dict, Set, Optional, List
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import json
import asyncio
import uuid
from datetime import datetime
import logging
from collections import defaultdict
import gzip
import base64

import models
from crdt.optimized_crdt import OptimizedSequenceCRDT
from database import get_db

logger = logging.getLogger(__name__)

class OptimizedConnectionManager:
    """Optimized WebSocket connection manager"""
    
    def __init__(self):
        # Document ID -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        # WebSocket -> Connection info
        self.connection_info: Dict[WebSocket, Dict] = {}
        # Document ID -> CRDT instance (limited cache)
        self.document_crdts: Dict[str, OptimizedSequenceCRDT] = {}
        # Document ID -> Last save timestamp
        self.last_save_times: Dict[str, datetime] = {}
        # Save debounce delay in seconds
        self.save_delay = 5.0
        # Track active save tasks
        self.save_tasks: Dict[str, asyncio.Task] = {}
        # Connection pool limits
        self.max_connections_per_document = 50
        self.max_total_connections = 500
        # CRDT cache limits
        self.max_cached_crdts = 20
        self.max_crdt_size = 1_048_576  # 1MB
        
    async def connect(
        self, 
        websocket: WebSocket, 
        document_id: str, 
        user: Optional[models.User],
        db: Session
    ):
        """Accept a new WebSocket connection with limits"""
        try:
            # Check connection limits
            total_connections = sum(len(conns) for conns in self.active_connections.values())
            if total_connections >= self.max_total_connections:
                await websocket.close(code=4008, reason="Server at capacity")
                return
            
            if len(self.active_connections[document_id]) >= self.max_connections_per_document:
                await websocket.close(code=4009, reason="Too many connections to document")
                return
            
            await websocket.accept()
            logger.info(f"WebSocket accepted for document {document_id}")
            
            # Add connection
            self.active_connections[document_id].add(websocket)
            
            # Generate site ID
            site_id = f"{user.id if user else 'guest'}_{uuid.uuid4().hex[:8]}"
            
            # Store connection info
            self.connection_info[websocket] = {
                "document_id": document_id,
                "user": user,
                "site_id": site_id,
                "connected_at": datetime.utcnow()
            }
            
            # Initialize CRDT
            await self._initialize_document_crdt(document_id, site_id, db)
            
            # Send initial state (compressed if large)
            await self._send_initial_state(websocket, document_id)
            
            # Notify others
            await self._broadcast_user_joined(document_id, user, site_id, exclude=websocket)
            
            logger.info(f"Connection established for document {document_id}")
            
        except Exception as e:
            logger.error(f"Connection error: {e}")
            await websocket.close(code=4000, reason="Connection error")
    
    async def disconnect(self, websocket: WebSocket, db: Session):
        """Handle WebSocket disconnection"""
        try:
            if websocket not in self.connection_info:
                return
            
            info = self.connection_info[websocket]
            document_id = info["document_id"]
            user = info["user"]
            site_id = info["site_id"]
            
            # Remove connection
            self.active_connections[document_id].discard(websocket)
            
            # Clean up empty document connections
            if not self.active_connections[document_id]:
                del self.active_connections[document_id]
                # Save final state
                await self._save_document_state(document_id, db)
                # Cancel pending save task
                if document_id in self.save_tasks:
                    self.save_tasks[document_id].cancel()
                    del self.save_tasks[document_id]
                # Remove from cache if it's getting too large
                if document_id in self.document_crdts:
                    crdt = self.document_crdts[document_id]
                    if crdt.get_state_size() > self.max_crdt_size:
                        del self.document_crdts[document_id]
            
            # Remove connection info
            del self.connection_info[websocket]
            
            # Notify others
            await self._broadcast_user_left(document_id, user, site_id)
            
            logger.info(f"Connection closed for document {document_id}")
            
        except Exception as e:
            logger.error(f"Disconnect error: {e}")
    
    async def handle_message(self, websocket: WebSocket, message: str, db: Session):
        """Handle incoming WebSocket message"""
        try:
            # Parse message
            data = json.loads(message)
            msg_type = data.get("type")
            
            if msg_type == "operation":
                await self._handle_operation(websocket, data, db)
            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif msg_type == "request_state":
                await self._send_current_state(websocket)
            else:
                logger.warning(f"Unknown message type: {msg_type}")
        
        except json.JSONDecodeError:
            logger.error("Invalid JSON message")
        except Exception as e:
            logger.error(f"Message handling error: {e}")
    
    async def _handle_operation(self, websocket: WebSocket, data: dict, db: Session):
        """Handle CRDT operation"""
        try:
            info = self.connection_info[websocket]
            document_id = info["document_id"]
            
            if document_id not in self.document_crdts:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Document not initialized"
                }))
                return
            
            crdt = self.document_crdts[document_id]
            operation = data.get("operation")
            
            # Apply operation
            if crdt.apply_remote(operation):
                # Broadcast to others
                await self._broadcast_operation(document_id, operation, exclude=websocket)
                
                # Schedule save
                self._schedule_save(document_id, db)
                
                # Check CRDT size
                if crdt.get_state_size() > self.max_crdt_size:
                    logger.warning(f"Document {document_id} exceeding size limit")
                    await self._compact_document(document_id, db)
            else:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Failed to apply operation"
                }))
        
        except Exception as e:
            logger.error(f"Operation handling error: {e}")
    
    async def _initialize_document_crdt(self, document_id: str, site_id: str, db: Session):
        """Initialize or load CRDT for document"""
        try:
            # Check cache limit
            if len(self.document_crdts) >= self.max_cached_crdts:
                # Remove least recently used
                oldest_id = next(iter(self.document_crdts))
                await self._save_document_state(oldest_id, db)
                del self.document_crdts[oldest_id]
            
            if document_id in self.document_crdts:
                return
            
            # Load from database
            document = db.query(models.Document).filter(
                models.Document.id == document_id
            ).first()
            
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            # Initialize CRDT
            if document.crdt_state:
                try:
                    crdt_data = json.loads(document.crdt_state)
                    crdt = OptimizedSequenceCRDT.from_dict(crdt_data)
                except Exception as e:
                    logger.error(f"Failed to load CRDT state: {e}")
                    crdt = OptimizedSequenceCRDT(site_id)
            else:
                crdt = OptimizedSequenceCRDT(site_id)
            
            self.document_crdts[document_id] = crdt
            
        except Exception as e:
            logger.error(f"CRDT initialization error: {e}")
            raise
    
    async def _send_initial_state(self, websocket: WebSocket, document_id: str):
        """Send initial document state (compressed if needed)"""
        try:
            if document_id not in self.document_crdts:
                return
            
            crdt = self.document_crdts[document_id]
            state_dict = crdt.to_dict()
            state_json = json.dumps(state_dict)
            
            # Compress if large
            if len(state_json) > 10240:  # 10KB
                compressed = gzip.compress(state_json.encode())
                encoded = base64.b64encode(compressed).decode()
                
                await websocket.send_text(json.dumps({
                    "type": "initial_state",
                    "document_id": document_id,
                    "compressed": True,
                    "data": encoded,
                    "text": crdt.get_text()[:1000]  # Send first 1000 chars for quick display
                }))
            else:
                await websocket.send_text(json.dumps({
                    "type": "initial_state",
                    "document_id": document_id,
                    "compressed": False,
                    "crdt_state": state_dict,
                    "text": crdt.get_text()
                }))
                
        except Exception as e:
            logger.error(f"Failed to send initial state: {e}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Failed to load document"
            }))
    
    async def _send_current_state(self, websocket: WebSocket):
        """Send current state on request"""
        try:
            info = self.connection_info[websocket]
            document_id = info["document_id"]
            await self._send_initial_state(websocket, document_id)
        except Exception as e:
            logger.error(f"Failed to send current state: {e}")
    
    async def _broadcast_operation(
        self, 
        document_id: str, 
        operation: dict, 
        exclude: Optional[WebSocket] = None
    ):
        """Broadcast operation to all connections"""
        message = json.dumps({
            "type": "operation",
            "operation": operation
        })
        
        await self._broadcast_message(document_id, message, exclude)
    
    async def _broadcast_user_joined(
        self, 
        document_id: str, 
        user: Optional[models.User], 
        site_id: str,
        exclude: Optional[WebSocket] = None
    ):
        """Broadcast user joined event"""
        message = json.dumps({
            "type": "user_joined",
            "user_id": user.id if user else None,
            "username": user.username if user else "Guest",
            "site_id": site_id
        })
        
        await self._broadcast_message(document_id, message, exclude)
    
    async def _broadcast_user_left(
        self, 
        document_id: str, 
        user: Optional[models.User], 
        site_id: str
    ):
        """Broadcast user left event"""
        message = json.dumps({
            "type": "user_left",
            "user_id": user.id if user else None,
            "username": user.username if user else "Guest",
            "site_id": site_id
        })
        
        await self._broadcast_message(document_id, message)
    
    async def _broadcast_message(
        self, 
        document_id: str, 
        message: str, 
        exclude: Optional[WebSocket] = None
    ):
        """Broadcast message to all connections"""
        if document_id not in self.active_connections:
            return
        
        broken_connections = []
        
        for connection in self.active_connections[document_id]:
            if connection == exclude:
                continue
            
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send message: {e}")
                broken_connections.append(connection)
        
        # Clean up broken connections
        if broken_connections:
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
        
        # Cancel existing save task
        if document_id in self.save_tasks:
            self.save_tasks[document_id].cancel()
        
        # Create new save task
        task = asyncio.create_task(self._delayed_save(document_id, db))
        self.save_tasks[document_id] = task
    
    async def _delayed_save(self, document_id: str, db: Session):
        """Save document after delay"""
        try:
            await asyncio.sleep(self.save_delay)
            await self._save_document_state(document_id, db)
        except asyncio.CancelledError:
            pass
        finally:
            if document_id in self.save_tasks:
                del self.save_tasks[document_id]
    
    async def _save_document_state(self, document_id: str, db: Session):
        """Save current CRDT state to database"""
        try:
            if document_id not in self.document_crdts:
                return
            
            crdt = self.document_crdts[document_id]
            state_json = json.dumps(crdt.to_dict())
            
            # Check size
            if len(state_json) > 5_242_880:  # 5MB
                logger.error(f"Document {document_id} too large to save")
                return
            
            # Update database
            document = db.query(models.Document).filter(
                models.Document.id == document_id
            ).first()
            
            if document:
                document.crdt_state = state_json
                document.updated_at = datetime.utcnow()
                db.commit()
                logger.info(f"Saved document {document_id}")
                
        except Exception as e:
            logger.error(f"Save error: {e}")
            db.rollback()
    
    async def _compact_document(self, document_id: str, db: Session):
        """Compact document CRDT to reduce size"""
        try:
            if document_id not in self.document_crdts:
                return
            
            crdt = self.document_crdts[document_id]
            crdt._compact()
            
            # Save compacted state
            await self._save_document_state(document_id, db)
            
            # Notify clients to refresh
            await self._broadcast_message(
                document_id,
                json.dumps({"type": "refresh_required"})
            )
            
        except Exception as e:
            logger.error(f"Compaction error: {e}")
    
    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "total_connections": sum(len(conns) for conns in self.active_connections.values()),
            "active_documents": len(self.active_connections),
            "cached_crdts": len(self.document_crdts),
            "pending_saves": len(self.save_tasks),
            "connections_by_document": {
                doc_id: len(conns) 
                for doc_id, conns in self.active_connections.items()
            }
        }

# Global instance
optimized_manager = OptimizedConnectionManager()