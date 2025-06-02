"""
Optimized CRDT implementation with better memory management
"""
import json
import time
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, asdict
import hashlib
import logging

logger = logging.getLogger(__name__)

@dataclass
class CRDTNode:
    """Single character node in the CRDT sequence"""
    id: str  # Unique identifier
    char: str  # Character value
    visible: bool = True  # Is the character visible
    timestamp: float = 0  # For conflict resolution
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'CRDTNode':
        return cls(**data)


class OptimizedSequenceCRDT:
    """
    Optimized CRDT for text editing with memory management
    """
    
    def __init__(self, site_id: str):
        self.site_id = site_id
        self.sequence: List[CRDTNode] = []
        self.tombstones: Set[str] = set()  # Track deleted nodes by ID only
        self.version = 0
        self.last_compaction = time.time()
        self.compaction_threshold = 1000  # Compact after 1000 operations
        self.operations_since_compaction = 0
        
    def insert(self, position: int, char: str) -> Optional[Dict[str, Any]]:
        """Insert a character at the given position"""
        try:
            # Generate unique ID
            node_id = f"{self.site_id}:{self.version}:{position}"
            self.version += 1
            
            # Create new node
            node = CRDTNode(
                id=node_id,
                char=char,
                visible=True,
                timestamp=time.time()
            )
            
            # Find insertion point
            visible_pos = 0
            insert_idx = 0
            
            for i, n in enumerate(self.sequence):
                if visible_pos == position:
                    insert_idx = i
                    break
                if n.visible and n.id not in self.tombstones:
                    visible_pos += 1
            else:
                insert_idx = len(self.sequence)
            
            # Insert node
            self.sequence.insert(insert_idx, node)
            self.operations_since_compaction += 1
            
            # Check if compaction needed
            if self.operations_since_compaction >= self.compaction_threshold:
                self._compact()
            
            return {
                "type": "insert",
                "node": node.to_dict(),
                "position": position
            }
            
        except Exception as e:
            logger.error(f"Insert error: {e}")
            return None
    
    def delete(self, position: int) -> Optional[Dict[str, Any]]:
        """Delete character at position"""
        try:
            visible_pos = 0
            for node in self.sequence:
                if node.visible and node.id not in self.tombstones:
                    if visible_pos == position:
                        # Mark as tombstone
                        self.tombstones.add(node.id)
                        node.visible = False
                        self.operations_since_compaction += 1
                        
                        # Check if compaction needed
                        if self.operations_since_compaction >= self.compaction_threshold:
                            self._compact()
                        
                        return {
                            "type": "delete",
                            "node_id": node.id,
                            "position": position
                        }
                    visible_pos += 1
            
            return None
            
        except Exception as e:
            logger.error(f"Delete error: {e}")
            return None
    
    def apply_remote(self, operation: Dict[str, Any]) -> bool:
        """Apply operation from remote site"""
        try:
            op_type = operation.get("type")
            
            if op_type == "insert":
                node_data = operation.get("node")
                if not node_data:
                    return False
                
                # Remove 'position' field if present (from old format)
                if 'position' in node_data:
                    del node_data['position']
                
                # Ensure all required fields are present
                if 'id' not in node_data or 'char' not in node_data:
                    return False
                
                # Set defaults for optional fields
                if 'visible' not in node_data:
                    node_data['visible'] = True
                if 'timestamp' not in node_data:
                    node_data['timestamp'] = time.time()
                
                node = CRDTNode.from_dict(node_data)
                
                # Check if already exists
                if any(n.id == node.id for n in self.sequence):
                    return True  # Already applied
                
                # Find insertion position based on ID
                insert_idx = self._find_insert_position(node.id)
                self.sequence.insert(insert_idx, node)
                self.operations_since_compaction += 1
                
            elif op_type == "delete":
                node_id = operation.get("node_id")
                if not node_id:
                    # Try old format
                    node_data = operation.get("node")
                    if node_data and isinstance(node_data, dict):
                        node_id = node_data.get("id")
                
                if not node_id:
                    return False
                
                # Add to tombstones
                self.tombstones.add(node_id)
                
                # Mark node as invisible
                for node in self.sequence:
                    if node.id == node_id:
                        node.visible = False
                        break
                
                self.operations_since_compaction += 1
            
            else:
                return False
            
            # Check if compaction needed
            if self.operations_since_compaction >= self.compaction_threshold:
                self._compact()
            
            return True
            
        except Exception as e:
            logger.error(f"Apply remote error: {e}")
            return False
    
    def get_text(self) -> str:
        """Get the current text content"""
        chars = []
        for node in self.sequence:
            if node.visible and node.id not in self.tombstones:
                chars.append(node.char)
        return ''.join(chars)
    
    def _find_insert_position(self, node_id: str) -> int:
        """Find correct insertion position based on ID ordering"""
        # Simple lexicographic ordering of IDs
        for i, node in enumerate(self.sequence):
            if node_id < node.id:
                return i
        return len(self.sequence)
    
    def _compact(self):
        """Remove old tombstones to save memory"""
        try:
            current_time = time.time()
            
            # Only compact if enough time has passed
            if current_time - self.last_compaction < 60:  # Minimum 1 minute between compactions
                return
            
            # Remove very old invisible nodes (older than 5 minutes)
            cutoff_time = current_time - 300
            
            new_sequence = []
            removed_tombstones = set()
            
            for node in self.sequence:
                if node.visible or node.timestamp > cutoff_time:
                    new_sequence.append(node)
                else:
                    removed_tombstones.add(node.id)
            
            # Update sequence and tombstones
            self.sequence = new_sequence
            self.tombstones -= removed_tombstones
            
            self.last_compaction = current_time
            self.operations_since_compaction = 0
            
            logger.info(f"Compacted CRDT: removed {len(removed_tombstones)} nodes")
            
        except Exception as e:
            logger.error(f"Compaction error: {e}")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "site_id": self.site_id,
            "version": self.version,
            "sequence": [node.to_dict() for node in self.sequence],
            "tombstones": list(self.tombstones)
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OptimizedSequenceCRDT':
        """Create from dictionary"""
        crdt = cls(data["site_id"])
        crdt.version = data.get("version", 0)
        crdt.sequence = [CRDTNode.from_dict(n) for n in data.get("sequence", [])]
        crdt.tombstones = set(data.get("tombstones", []))
        return crdt
    
    def get_state_size(self) -> int:
        """Get approximate size of state in bytes"""
        return len(json.dumps(self.to_dict()))
    
    def generate_checksum(self) -> str:
        """Generate checksum of current state"""
        state_str = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.md5(state_str.encode()).hexdigest()