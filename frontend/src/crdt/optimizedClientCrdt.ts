/**
 * Optimized client-side CRDT implementation
 */
import pako from 'pako';

export interface CRDTNode {
  id: string;
  char: string;
  visible: boolean;
  timestamp: number;
}

export interface CRDTOperation {
  type: 'insert' | 'delete';
  node?: CRDTNode;
  node_id?: string;
  position: number;
}

export interface CRDTState {
  site_id: string;
  version: number;
  sequence: CRDTNode[];
  tombstones: string[];
}

export class OptimizedClientCRDT {
  private siteId: string;
  private version: number = 0;
  private sequence: CRDTNode[] = [];
  private tombstones: Set<string> = new Set();
  private operationCallback?: (op: CRDTOperation) => void;

  constructor(siteId: string) {
    this.siteId = siteId;
  }

  /**
   * Initialize from compressed or uncompressed state
   */
  initializeFromState(data: any) {
    try {
      let state: CRDTState;
      
      if (data.compressed) {
        // Decode and decompress
        const decoded = atob(data.data);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
          bytes[i] = decoded.charCodeAt(i);
        }
        const decompressed = pako.ungzip(bytes, { to: 'string' });
        state = JSON.parse(decompressed);
      } else {
        state = data.crdt_state;
      }

      this.siteId = state.site_id;
      this.version = state.version || 0;
      this.sequence = state.sequence || [];
      this.tombstones = new Set(state.tombstones || []);
    } catch (error) {
      console.error('Failed to initialize CRDT state:', error);
      // Initialize empty state on error
      this.sequence = [];
      this.tombstones = new Set();
      this.version = 0;
    }
  }

  /**
   * Set operation callback
   */
  onOperation(callback: (op: CRDTOperation) => void) {
    this.operationCallback = callback;
  }

  /**
   * Get current text
   */
  getText(): string {
    const chars: string[] = [];
    for (const node of this.sequence) {
      if (node.visible && !this.tombstones.has(node.id)) {
        chars.push(node.char);
      }
    }
    return chars.join('');
  }

  /**
   * Apply local insert operation
   */
  localInsert(position: number, char: string): CRDTOperation | null {
    try {
      const nodeId = `${this.siteId}:${this.version}:${position}`;
      this.version++;

      const node: CRDTNode = {
        id: nodeId,
        char: char,
        visible: true,
        timestamp: Date.now()
      };

      // Find insertion index
      let visiblePos = 0;
      let insertIdx = 0;

      for (let i = 0; i < this.sequence.length; i++) {
        if (visiblePos === position) {
          insertIdx = i;
          break;
        }
        if (this.sequence[i].visible && !this.tombstones.has(this.sequence[i].id)) {
          visiblePos++;
        }
      }

      if (visiblePos < position) {
        insertIdx = this.sequence.length;
      }

      // Insert node
      this.sequence.splice(insertIdx, 0, node);

      const operation: CRDTOperation = {
        type: 'insert',
        node: node,
        position: position
      };

      // Notify callback
      if (this.operationCallback) {
        this.operationCallback(operation);
      }

      return operation;
    } catch (error) {
      console.error('Local insert error:', error);
      return null;
    }
  }

  /**
   * Apply local delete operation
   */
  localDelete(position: number): CRDTOperation | null {
    try {
      let visiblePos = 0;
      
      for (const node of this.sequence) {
        if (node.visible && !this.tombstones.has(node.id)) {
          if (visiblePos === position) {
            // Mark as tombstone
            this.tombstones.add(node.id);
            node.visible = false;

            const operation: CRDTOperation = {
              type: 'delete',
              node_id: node.id,
              position: position
            };

            // Notify callback
            if (this.operationCallback) {
              this.operationCallback(operation);
            }

            return operation;
          }
          visiblePos++;
        }
      }

      return null;
    } catch (error) {
      console.error('Local delete error:', error);
      return null;
    }
  }

  /**
   * Apply remote operation
   */
  applyRemoteOperation(operation: CRDTOperation): boolean {
    try {
      if (operation.type === 'insert') {
        const node = operation.node;
        if (!node) return false;

        // Check if already exists
        if (this.sequence.some(n => n.id === node.id)) {
          return true; // Already applied
        }

        // Find insertion position
        let insertIdx = this.findInsertPosition(node.id);
        this.sequence.splice(insertIdx, 0, node);

      } else if (operation.type === 'delete') {
        const nodeId = operation.node_id;
        if (!nodeId) return false;

        // Add to tombstones
        this.tombstones.add(nodeId);

        // Mark node as invisible
        for (const node of this.sequence) {
          if (node.id === nodeId) {
            node.visible = false;
            break;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Apply remote operation error:', error);
      return false;
    }
  }

  /**
   * Generate operations from text diff
   */
  generateOperationsFromDiff(oldText: string, newText: string): CRDTOperation[] {
    const operations: CRDTOperation[] = [];
    
    // Simple diff algorithm - can be improved
    let i = 0;
    let j = 0;
    
    while (i < oldText.length || j < newText.length) {
      if (i >= oldText.length) {
        // Insert remaining characters
        const op = this.localInsert(j, newText[j]);
        if (op) operations.push(op);
        j++;
      } else if (j >= newText.length) {
        // Delete remaining characters
        const op = this.localDelete(i);
        if (op) operations.push(op);
        i++;
      } else if (oldText[i] === newText[j]) {
        // Characters match
        i++;
        j++;
      } else {
        // Replace: delete then insert
        const deleteOp = this.localDelete(i);
        if (deleteOp) operations.push(deleteOp);
        const insertOp = this.localInsert(i, newText[j]);
        if (insertOp) operations.push(insertOp);
        i++;
        j++;
      }
    }
    
    return operations;
  }

  /**
   * Find insertion position based on ID
   */
  private findInsertPosition(nodeId: string): number {
    for (let i = 0; i < this.sequence.length; i++) {
      if (nodeId < this.sequence[i].id) {
        return i;
      }
    }
    return this.sequence.length;
  }

  /**
   * Get state for serialization
   */
  toJSON(): CRDTState {
    return {
      site_id: this.siteId,
      version: this.version,
      sequence: this.sequence,
      tombstones: Array.from(this.tombstones)
    };
  }

  /**
   * Get approximate state size
   */
  getStateSize(): number {
    return JSON.stringify(this.toJSON()).length;
  }
}