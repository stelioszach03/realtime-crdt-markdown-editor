/**
 * Client-side CRDT implementation for collaborative text editing
 * Mirrors the backend Sequence CRDT (Logoot algorithm)
 */

export interface Position {
  identifiers: number[];
  site_id: string;
}

export interface CRDTNode {
  position: Position;
  value: string;
  visible: boolean;
}

export interface CRDTOperation {
  type: 'insert' | 'delete';
  node: CRDTNode;
  origin: string;
}

export class ClientSequenceCRDT {
  private siteId: string;
  private nodes: CRDTNode[] = [];
  private clock: number = 0;
  private operationQueue: CRDTOperation[] = [];

  constructor(siteId: string) {
    this.siteId = siteId;
    this.addBoundaryNodes();
  }

  private addBoundaryNodes(): void {
    // Beginning boundary node
    const beginPos: Position = { identifiers: [0], site_id: "BEGIN" };
    const beginNode: CRDTNode = { position: beginPos, value: "", visible: false };

    // End boundary node
    const endPos: Position = { identifiers: [2**31 - 1], site_id: "END" };
    const endNode: CRDTNode = { position: endPos, value: "", visible: false };

    this.nodes = [beginNode, endNode];
  }

  private comparePositions(pos1: Position, pos2: Position): number {
    // Compare identifier lists first
    const minLen = Math.min(pos1.identifiers.length, pos2.identifiers.length);
    
    for (let i = 0; i < minLen; i++) {
      if (pos1.identifiers[i] < pos2.identifiers[i]) return -1;
      if (pos1.identifiers[i] > pos2.identifiers[i]) return 1;
    }
    
    // If all compared identifiers are equal, shorter list comes first
    if (pos1.identifiers.length !== pos2.identifiers.length) {
      return pos1.identifiers.length - pos2.identifiers.length;
    }
    
    // If identifier lists are identical, compare site_id
    return pos1.site_id.localeCompare(pos2.site_id);
  }

  private generatePositionBetween(pos1: Position, pos2: Position): Position {
    this.clock++;
    
    // Find the depth where positions differ
    let depth = 0;
    while (
      depth < pos1.identifiers.length &&
      depth < pos2.identifiers.length &&
      pos1.identifiers[depth] === pos2.identifiers[depth]
    ) {
      depth++;
    }
    
    // Create new identifier list
    const newIdentifiers = pos1.identifiers.slice(0, depth);
    
    if (depth < pos1.identifiers.length && depth < pos2.identifiers.length) {
      // Both positions have identifiers at this depth
      const leftId = pos1.identifiers[depth];
      const rightId = pos2.identifiers[depth];
      
      if (rightId - leftId > 1) {
        // There's space between the identifiers
        const newId = Math.floor(Math.random() * (rightId - leftId - 1)) + leftId + 1;
        newIdentifiers.push(newId);
      } else {
        // No space, need to go deeper
        newIdentifiers.push(leftId);
        if (depth + 1 < pos1.identifiers.length) {
          // Use next level from pos1
          newIdentifiers.push(...pos1.identifiers.slice(depth + 1));
        }
        
        // Add a new random identifier
        newIdentifiers.push(Math.floor(Math.random() * 65536) + 1);
      }
    } else if (depth < pos1.identifiers.length) {
      // Only pos1 has identifier at this depth
      newIdentifiers.push(...pos1.identifiers.slice(depth));
      newIdentifiers.push(Math.floor(Math.random() * 65536) + 1);
    } else if (depth < pos2.identifiers.length) {
      // Only pos2 has identifier at this depth
      const rightId = pos2.identifiers[depth];
      if (rightId > 1) {
        const newId = Math.floor(Math.random() * (rightId - 1)) + 1;
        newIdentifiers.push(newId);
      } else {
        newIdentifiers.push(0);
        newIdentifiers.push(Math.floor(Math.random() * 65536) + 1);
      }
    } else {
      // Both positions end at the same depth
      newIdentifiers.push(Math.floor(Math.random() * 65536) + 1);
    }
    
    return {
      identifiers: newIdentifiers,
      site_id: `${this.siteId}_${this.clock}`
    };
  }

  private findInsertIndex(node: CRDTNode): number {
    let left = 0;
    let right = this.nodes.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.comparePositions(this.nodes[mid].position, node.position) < 0) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  }

  localInsert(index: number, value: string): CRDTOperation {
    const visibleNodes = this.nodes.filter(node => node.visible);
    
    if (index < 0 || index > visibleNodes.length) {
      throw new Error(`Index ${index} out of bounds`);
    }
    
    // Find the positions to insert between
    let pos1: Position, pos2: Position;
    
    if (index === 0) {
      // Insert at beginning
      pos1 = this.nodes[0].position; // BEGIN boundary
      pos2 = visibleNodes.length > 0 ? visibleNodes[0].position : this.nodes[this.nodes.length - 1].position;
    } else if (index === visibleNodes.length) {
      // Insert at end
      pos1 = visibleNodes.length > 0 ? visibleNodes[visibleNodes.length - 1].position : this.nodes[0].position;
      pos2 = this.nodes[this.nodes.length - 1].position; // END boundary
    } else {
      // Insert between two visible nodes
      pos1 = visibleNodes[index - 1].position;
      pos2 = visibleNodes[index].position;
    }
    
    // Generate new position
    const newPosition = this.generatePositionBetween(pos1, pos2);
    const newNode: CRDTNode = {
      position: newPosition,
      value,
      visible: true
    };
    
    // Insert node in sorted order
    const insertIndex = this.findInsertIndex(newNode);
    this.nodes.splice(insertIndex, 0, newNode);
    
    const operation: CRDTOperation = {
      type: 'insert',
      node: newNode,
      origin: this.siteId
    };
    
    return operation;
  }

  localDelete(index: number): CRDTOperation {
    const visibleNodes = this.nodes.filter(node => node.visible);
    
    if (index < 0 || index >= visibleNodes.length) {
      throw new Error(`Index ${index} out of bounds`);
    }
    
    // Find the node to delete
    const nodeToDelete = visibleNodes[index];
    nodeToDelete.visible = false;
    
    const operation: CRDTOperation = {
      type: 'delete',
      node: nodeToDelete,
      origin: this.siteId
    };
    
    return operation;
  }

  applyRemote(operation: CRDTOperation): boolean {
    if (operation.type === 'insert') {
      return this.applyRemoteInsert(operation.node);
    } else if (operation.type === 'delete') {
      return this.applyRemoteDelete(operation.node);
    } else {
      throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private applyRemoteInsert(node: CRDTNode): boolean {
    // Check if node already exists
    for (const existingNode of this.nodes) {
      if (this.comparePositions(existingNode.position, node.position) === 0) {
        // Node already exists, update visibility
        existingNode.visible = node.visible;
        return true;
      }
    }
    
    // Insert new node in sorted order
    const insertIndex = this.findInsertIndex(node);
    this.nodes.splice(insertIndex, 0, { ...node });
    return true;
  }

  private applyRemoteDelete(node: CRDTNode): boolean {
    // Find and mark node as deleted
    for (const existingNode of this.nodes) {
      if (this.comparePositions(existingNode.position, node.position) === 0) {
        existingNode.visible = false;
        return true;
      }
    }
    
    // Node not found - this shouldn't happen in a well-formed CRDT
    return false;
  }

  getText(): string {
    return this.nodes
      .filter(node => node.visible)
      .map(node => node.value)
      .join('');
  }

  getVisibleLength(): number {
    return this.nodes.filter(node => node.visible).length;
  }

  // Queue operations when offline
  queueOperation(operation: CRDTOperation): void {
    this.operationQueue.push(operation);
  }

  // Get queued operations for sync
  getQueuedOperations(): CRDTOperation[] {
    return [...this.operationQueue];
  }

  // Clear operation queue after successful sync
  clearQueue(): void {
    this.operationQueue = [];
  }

  // Serialize state for persistence or sync
  toJSON(): any {
    return {
      siteId: this.siteId,
      clock: this.clock,
      nodes: this.nodes.map(node => ({
        position: node.position,
        value: node.value,
        visible: node.visible
      }))
    };
  }

  // Deserialize state from JSON
  static fromJSON(data: any): ClientSequenceCRDT {
    const crdt = new ClientSequenceCRDT(data.siteId);
    crdt.clock = data.clock;
    crdt.nodes = data.nodes.map((nodeData: any) => ({
      position: nodeData.position,
      value: nodeData.value,
      visible: nodeData.visible
    }));
    return crdt;
  }

  // Get character index from CRDT position (for cursor mapping)
  getIndexFromPosition(position: Position): number {
    const visibleNodes = this.nodes.filter(node => node.visible);
    
    for (let i = 0; i < visibleNodes.length; i++) {
      if (this.comparePositions(visibleNodes[i].position, position) === 0) {
        return i;
      }
    }
    
    return -1; // Position not found
  }

  // Get CRDT position from character index (for cursor mapping)
  getPositionFromIndex(index: number): Position | null {
    const visibleNodes = this.nodes.filter(node => node.visible);
    
    if (index < 0 || index >= visibleNodes.length) {
      return null;
    }
    
    return visibleNodes[index].position;
  }

  // Merge with another CRDT state (for conflict resolution)
  mergeWith(otherCrdt: ClientSequenceCRDT): CRDTOperation[] {
    const operations: CRDTOperation[] = [];
    
    // Find nodes that exist in other but not in self
    const selfPositions = new Set(
      this.nodes.map(node => JSON.stringify(node.position))
    );
    
    for (const otherNode of otherCrdt.nodes) {
      const positionKey = JSON.stringify(otherNode.position);
      
      if (!selfPositions.has(positionKey)) {
        // This is a new node, create insert operation
        const op: CRDTOperation = {
          type: 'insert',
          node: otherNode,
          origin: otherCrdt.siteId
        };
        this.applyRemote(op);
        operations.push(op);
      } else {
        // Node exists, check if visibility changed
        for (const selfNode of this.nodes) {
          if (
            this.comparePositions(selfNode.position, otherNode.position) === 0 &&
            selfNode.visible !== otherNode.visible
          ) {
            const op: CRDTOperation = {
              type: otherNode.visible ? 'insert' : 'delete',
              node: otherNode,
              origin: otherCrdt.siteId
            };
            this.applyRemote(op);
            operations.push(op);
            break;
          }
        }
      }
    }
    
    return operations;
  }

  // Additional methods for DocumentRoom integration

  /**
   * Get the current CRDT state for persistence
   */
  getState(): any {
    return this.toJSON();
  }

  /**
   * Load CRDT state from persistence
   */
  loadState(state: any): void {
    this.clock = state.clock || 0;
    this.nodes = (state.nodes || []).map((nodeData: any) => ({
      position: nodeData.position,
      value: nodeData.value,
      visible: nodeData.visible
    }));
  }

  /**
   * Apply a remote operation (alias for applyRemote)
   */
  applyRemoteOperation(operation: CRDTOperation): boolean {
    return this.applyRemote(operation);
  }

  /**
   * Generate operations from text diff (for editor integration)
   */
  generateOperationsFromDiff(oldText: string, newText: string): CRDTOperation[] {
    const operations: CRDTOperation[] = [];
    
    // Simple diff algorithm - find insertions and deletions
    let oldIndex = 0;
    let newIndex = 0;
    
    while (oldIndex < oldText.length || newIndex < newText.length) {
      if (oldIndex >= oldText.length) {
        // Insertion at end
        const char = newText[newIndex];
        const op = this.localInsert(oldIndex, char);
        operations.push(op);
        newIndex++;
        oldIndex++;
      } else if (newIndex >= newText.length) {
        // Deletion at end
        const op = this.localDelete(oldIndex);
        operations.push(op);
        oldIndex++;
      } else if (oldText[oldIndex] === newText[newIndex]) {
        // Characters match, continue
        oldIndex++;
        newIndex++;
      } else {
        // Characters differ - check if it's insertion or deletion
        if (newIndex + 1 < newText.length && oldText[oldIndex] === newText[newIndex + 1]) {
          // Insertion
          const char = newText[newIndex];
          const op = this.localInsert(oldIndex, char);
          operations.push(op);
          newIndex++;
          oldIndex++;
        } else if (oldIndex + 1 < oldText.length && oldText[oldIndex + 1] === newText[newIndex]) {
          // Deletion
          const op = this.localDelete(oldIndex);
          operations.push(op);
          oldIndex++;
        } else {
          // Replacement (delete + insert)
          const deleteOp = this.localDelete(oldIndex);
          operations.push(deleteOp);
          
          const char = newText[newIndex];
          const insertOp = this.localInsert(oldIndex, char);
          operations.push(insertOp);
          
          oldIndex++;
          newIndex++;
        }
      }
    }
    
    return operations;
  }

  /**
   * Apply a local operation (no-op since operations are applied during generation)
   */
  applyLocalOperation(_operation: CRDTOperation): void {
    // Operation is already applied in generateOperationsFromDiff
    // This method exists for consistency with the interface
  }

  /**
   * Insert text at position and return operations
   */
  insertText(position: number, text: string): CRDTOperation[] {
    const operations: CRDTOperation[] = [];
    for (let i = 0; i < text.length; i++) {
      const op = this.localInsert(position + i, text[i]);
      operations.push(op);
    }
    return operations;
  }

  /**
   * Delete text range and return operations
   */
  deleteText(start: number, length: number): CRDTOperation[] {
    const operations: CRDTOperation[] = [];
    for (let i = 0; i < length; i++) {
      const op = this.localDelete(start);
      operations.push(op);
    }
    return operations;
  }
}