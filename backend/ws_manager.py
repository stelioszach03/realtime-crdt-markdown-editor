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


class ConnectionManager:
    """Manages WebSocket connections for collaborative editing"""
    
    def __init__(self):
        # Document ID -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # WebSocket -> Connection info
        self.connection_info: Dict[WebSocket, Dict] = {}
        # Document ID -> CRDT instance
        self.document_crdts: Dict[str, SequenceCRDT] = {}
        # Document ID -> Last save timestamp
        self.last_save_times: Dict[str, datetime] = {}
        # Save debounce delay in seconds
        self.save_delay = 3.0
    
    async def connect(
        self, 
        websocket: WebSocket, 
        document_id: str, 
        user: Optional[models.User],
        db: Session
    ):
        """Accept a new WebSocket connection"""
        print(f"Manager.connect called for document {document_id}, user: {user.username if user else 'None'}")
        await websocket.accept()
        print("WebSocket accepted")
        
        # Initialize document connections if not exists
        if document_id not in self.active_connections:
            self.active_connections[document_id] = set()
        
        # Add connection
        self.active_connections[document_id].add(websocket)
        print(f"Added connection to document {document_id}")
        
        # Generate site ID for CRDT
        site_id = f"{user.id if user else 'guest'}_{uuid.uuid4().hex[:8]}"
        print(f"Generated site_id: {site_id}")
        
        # Store connection info
        self.connection_info[websocket] = {
            "document_id": document_id,
            "user": user,
            "site_id": site_id,
            "connected_at": datetime.utcnow()
        }
        
        # Initialize or load CRDT for document
        print(f"Initializing CRDT for document {document_id}")
        await self._initialize_document_crdt(document_id, site_id, db)
        print("CRDT initialized successfully")
        
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
        print("Session record created")
        
        # Send initial document state
        print("Sending initial state")
        await self._send_initial_state(websocket, document_id)
        print("Initial state sent")
        
        # Notify other users about new connection
        await self._broadcast_presence_update(document_id, "user_joined", {
            "user_id": user.id if user else None,
            "username": user.username if user else "Guest",
            "site_id": site_id
        })
        print("Connection setup completed successfully")
    
    async def disconnect(self, websocket: WebSocket, db: Session):
        """Handle WebSocket disconnection"""
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
                # Clean up CRDT instance
                if document_id in self.document_crdts:
                    del self.document_crdts[document_id]
        
        # Remove connection info
        del self.connection_info[websocket]
        
        # Update session as inactive
        session = db.query(models.DocumentSession).filter(
            models.DocumentSession.site_id == site_id,
            models.DocumentSession.is_active == True
        ).first()
        if session:
            session.is_active = False
            session.last_seen = datetime.utcnow()
            db.commit()
        
        # Notify other users about disconnection
        await self._broadcast_presence_update(document_id, "user_left", {
            "user_id": user.id if user else None,
            "username": user.username if user else "Guest",
            "site_id": site_id
        })
    
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
        
        for connection in connections:
            if connection == exclude:
                continue
            
            try:
                await connection.send_text(message_str)
            except Exception:
                # Connection is broken, remove it
                self.active_connections[document_id].discard(connection)
                if connection in self.connection_info:
                    del self.connection_info[connection]
    
    def _schedule_save(self, document_id: str, db: Session):
        """Schedule document save with debouncing"""
        self.last_save_times[document_id] = datetime.utcnow()
        
        # Create background task for delayed save
        asyncio.create_task(self._delayed_save(document_id, db))
    
    async def _delayed_save(self, document_id: str, db: Session):
        """Save document after delay (debounced)"""
        await asyncio.sleep(self.save_delay)
        
        # Check if there were more recent changes
        if (document_id in self.last_save_times and 
            (datetime.utcnow() - self.last_save_times[document_id]).total_seconds() >= self.save_delay):
            await self._save_document_state(document_id, db)
    
    async def _save_document_state(self, document_id: str, db: Session):
        """Save current CRDT state to database"""
        if document_id not in self.document_crdts:
            return
        
        try:
            crdt = self.document_crdts[document_id]
            crdt_state_json = json.dumps(crdt.to_dict())
            
            # Update document in database
            document = db.query(models.Document).filter(
                models.Document.id == document_id
            ).first()
            
            if document:
                document.crdt_state = crdt_state_json
                document.updated_at = datetime.utcnow()
                db.commit()
        
        except Exception as e:
            print(f"Error saving document {document_id}: {e}")
            db.rollback()


# Global connection manager instance
manager = ConnectionManager()