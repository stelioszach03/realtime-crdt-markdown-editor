"""
CRDT Node implementation for Sequence CRDT (Logoot algorithm)
"""
from typing import List, Any, Dict, Optional
import json
from dataclasses import dataclass, asdict


@dataclass
class Position:
    """Represents a position in the CRDT sequence"""
    identifiers: List[int]
    site_id: str
    
    def __lt__(self, other: 'Position') -> bool:
        """Compare positions for ordering"""
        if not isinstance(other, Position):
            return NotImplemented
        
        # Compare identifier lists first
        min_len = min(len(self.identifiers), len(other.identifiers))
        
        for i in range(min_len):
            if self.identifiers[i] < other.identifiers[i]:
                return True
            elif self.identifiers[i] > other.identifiers[i]:
                return False
        
        # If all compared identifiers are equal, shorter list comes first
        if len(self.identifiers) != len(other.identifiers):
            return len(self.identifiers) < len(other.identifiers)
        
        # If identifier lists are identical, compare site_id
        return self.site_id < other.site_id
    
    def __eq__(self, other: 'Position') -> bool:
        """Check if positions are equal"""
        if not isinstance(other, Position):
            return NotImplemented
        return (self.identifiers == other.identifiers and 
                self.site_id == other.site_id)
    
    def __hash__(self) -> int:
        """Make Position hashable"""
        return hash((tuple(self.identifiers), self.site_id))
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Position':
        """Create Position from dictionary"""
        return cls(**data)


@dataclass
class CRDTNode:
    """Represents a character node in the CRDT sequence"""
    position: Position
    value: str
    visible: bool = True
    
    def __lt__(self, other: 'CRDTNode') -> bool:
        """Compare nodes based on their positions"""
        if not isinstance(other, CRDTNode):
            return NotImplemented
        return self.position < other.position
    
    def __eq__(self, other: 'CRDTNode') -> bool:
        """Check if nodes are equal"""
        if not isinstance(other, CRDTNode):
            return NotImplemented
        return self.position == other.position
    
    def __hash__(self) -> int:
        """Make CRDTNode hashable"""
        return hash(self.position)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'position': self.position.to_dict(),
            'value': self.value,
            'visible': self.visible
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CRDTNode':
        """Create CRDTNode from dictionary"""
        return cls(
            position=Position.from_dict(data['position']),
            value=data['value'],
            visible=data.get('visible', True)
        )


class CRDTOperation:
    """Represents a CRDT operation (insert or delete)"""
    
    def __init__(self, op_type: str, node: CRDTNode, origin: str):
        self.type = op_type  # 'insert' or 'delete'
        self.node = node
        self.origin = origin  # site_id of the originating client
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'type': self.type,
            'node': self.node.to_dict(),
            'origin': self.origin
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CRDTOperation':
        """Create CRDTOperation from dictionary"""
        return cls(
            op_type=data['type'],
            node=CRDTNode.from_dict(data['node']),
            origin=data['origin']
        )