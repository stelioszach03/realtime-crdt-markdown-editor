"""
Sequence CRDT implementation using Logoot algorithm
"""
from typing import List, Dict, Any, Optional, Tuple
import random
import bisect
import json
from .node import CRDTNode, Position, CRDTOperation


class SequenceCRDT:
    """
    Sequence CRDT implementation for collaborative text editing
    Based on the Logoot algorithm for conflict-free replicated data types
    """
    
    def __init__(self, site_id: str):
        self.site_id = site_id
        self.nodes: List[CRDTNode] = []
        self.clock = 0
        
        # Add boundary nodes (beginning and end markers)
        self._add_boundary_nodes()
    
    def _add_boundary_nodes(self):
        """Add beginning and end boundary nodes"""
        # Beginning boundary node
        begin_pos = Position([0], "BEGIN")
        begin_node = CRDTNode(begin_pos, "", visible=False)
        
        # End boundary node  
        end_pos = Position([2**31 - 1], "END")
        end_node = CRDTNode(end_pos, "", visible=False)
        
        self.nodes = [begin_node, end_node]
    
    def _generate_position_between(self, pos1: Position, pos2: Position) -> Position:
        """Generate a position between two existing positions"""
        self.clock += 1
        
        # Find the depth where positions differ
        depth = 0
        while (depth < len(pos1.identifiers) and 
               depth < len(pos2.identifiers) and
               pos1.identifiers[depth] == pos2.identifiers[depth]):
            depth += 1
        
        # Create new identifier list
        new_identifiers = pos1.identifiers[:depth].copy()
        
        if depth < len(pos1.identifiers) and depth < len(pos2.identifiers):
            # Both positions have identifiers at this depth
            left_id = pos1.identifiers[depth]
            right_id = pos2.identifiers[depth]
            
            if right_id - left_id > 1:
                # There's space between the identifiers
                new_id = random.randint(left_id + 1, right_id - 1)
                new_identifiers.append(new_id)
            else:
                # No space, need to go deeper
                new_identifiers.append(left_id)
                if depth + 1 < len(pos1.identifiers):
                    # Use next level from pos1
                    new_identifiers.extend(pos1.identifiers[depth + 1:])
                
                # Add a new random identifier
                new_identifiers.append(random.randint(1, 2**16))
        
        elif depth < len(pos1.identifiers):
            # Only pos1 has identifier at this depth
            new_identifiers.extend(pos1.identifiers[depth:])
            new_identifiers.append(random.randint(1, 2**16))
        
        elif depth < len(pos2.identifiers):
            # Only pos2 has identifier at this depth
            right_id = pos2.identifiers[depth]
            if right_id > 1:
                new_id = random.randint(1, right_id - 1)
                new_identifiers.append(new_id)
            else:
                new_identifiers.append(0)
                new_identifiers.append(random.randint(1, 2**16))
        
        else:
            # Both positions end at the same depth
            new_identifiers.append(random.randint(1, 2**16))
        
        return Position(new_identifiers, f"{self.site_id}_{self.clock}")
    
    def local_insert(self, index: int, value: str) -> CRDTOperation:
        """Insert a character at the given index"""
        if index < 0 or index > self.get_visible_length():
            raise ValueError(f"Index {index} out of bounds")
        
        # Find the positions to insert between
        visible_nodes = [node for node in self.nodes if node.visible]
        
        if index == 0:
            # Insert at beginning
            pos1 = self.nodes[0].position  # BEGIN boundary
            pos2 = visible_nodes[0].position if visible_nodes else self.nodes[1].position
        elif index == len(visible_nodes):
            # Insert at end
            pos1 = visible_nodes[-1].position if visible_nodes else self.nodes[0].position
            pos2 = self.nodes[-1].position  # END boundary
        else:
            # Insert between two visible nodes
            pos1 = visible_nodes[index - 1].position
            pos2 = visible_nodes[index].position
        
        # Generate new position
        new_position = self._generate_position_between(pos1, pos2)
        new_node = CRDTNode(new_position, value, visible=True)
        
        # Insert node in sorted order
        insert_index = bisect.bisect_left(self.nodes, new_node)
        self.nodes.insert(insert_index, new_node)
        
        return CRDTOperation('insert', new_node, self.site_id)
    
    def local_delete(self, index: int) -> CRDTOperation:
        """Delete a character at the given index"""
        visible_nodes = [node for node in self.nodes if node.visible]
        
        if index < 0 or index >= len(visible_nodes):
            raise ValueError(f"Index {index} out of bounds")
        
        # Find the node to delete
        node_to_delete = visible_nodes[index]
        node_to_delete.visible = False
        
        return CRDTOperation('delete', node_to_delete, self.site_id)
    
    def apply_remote(self, operation: CRDTOperation) -> bool:
        """Apply a remote operation to the local CRDT"""
        if operation.type == 'insert':
            return self._apply_remote_insert(operation.node)
        elif operation.type == 'delete':
            return self._apply_remote_delete(operation.node)
        else:
            raise ValueError(f"Unknown operation type: {operation.type}")
    
    def _apply_remote_insert(self, node: CRDTNode) -> bool:
        """Apply a remote insert operation"""
        # Check if node already exists
        for existing_node in self.nodes:
            if existing_node.position == node.position:
                # Node already exists, update visibility
                existing_node.visible = node.visible
                return True
        
        # Insert new node in sorted order
        insert_index = bisect.bisect_left(self.nodes, node)
        self.nodes.insert(insert_index, node)
        return True
    
    def _apply_remote_delete(self, node: CRDTNode) -> bool:
        """Apply a remote delete operation"""
        # Find and mark node as deleted
        for existing_node in self.nodes:
            if existing_node.position == node.position:
                existing_node.visible = False
                return True
        
        # Node not found - this shouldn't happen in a well-formed CRDT
        return False
    
    def get_text(self) -> str:
        """Get the current text content"""
        visible_chars = [node.value for node in self.nodes if node.visible]
        return ''.join(visible_chars)
    
    def get_visible_length(self) -> int:
        """Get the length of visible text"""
        return sum(1 for node in self.nodes if node.visible)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize CRDT state to dictionary"""
        return {
            'site_id': self.site_id,
            'clock': self.clock,
            'nodes': [node.to_dict() for node in self.nodes]
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SequenceCRDT':
        """Deserialize CRDT state from dictionary"""
        crdt = cls(data['site_id'])
        crdt.clock = data['clock']
        crdt.nodes = [CRDTNode.from_dict(node_data) for node_data in data['nodes']]
        return crdt
    
    def get_operations_since(self, timestamp: int) -> List[CRDTOperation]:
        """Get operations since a given timestamp (placeholder for future implementation)"""
        # This would be used for efficient synchronization
        # For now, return empty list
        return []
    
    def merge_with(self, other_crdt: 'SequenceCRDT') -> List[CRDTOperation]:
        """Merge with another CRDT state"""
        operations = []
        
        # Find nodes that exist in other but not in self
        self_positions = {node.position for node in self.nodes}
        
        for other_node in other_crdt.nodes:
            if other_node.position not in self_positions:
                # This is a new node, create insert operation
                op = CRDTOperation('insert', other_node, other_crdt.site_id)
                self.apply_remote(op)
                operations.append(op)
            else:
                # Node exists, check if visibility changed
                for self_node in self.nodes:
                    if (self_node.position == other_node.position and 
                        self_node.visible != other_node.visible):
                        if other_node.visible:
                            op = CRDTOperation('insert', other_node, other_crdt.site_id)
                        else:
                            op = CRDTOperation('delete', other_node, other_crdt.site_id)
                        self.apply_remote(op)
                        operations.append(op)
                        break
        
        return operations