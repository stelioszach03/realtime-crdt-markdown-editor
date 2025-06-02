/**
 * Web Worker for heavy CRDT operations
 * Offloads CPU-intensive operations from the main thread
 */

// Simple diff algorithm optimized for performance
function computeDiff(oldText: string, newText: string): Array<{type: 'insert' | 'delete', pos: number, char: string}> {
  const diffs: Array<{type: 'insert' | 'delete', pos: number, char: string}> = [];
  
  // Fast path for common cases
  if (oldText === newText) return diffs;
  
  const oldLen = oldText.length;
  const newLen = newText.length;
  
  // Handle simple append
  if (newText.startsWith(oldText)) {
    for (let i = oldLen; i < newLen; i++) {
      diffs.push({ type: 'insert', pos: i, char: newText[i] });
    }
    return diffs;
  }
  
  // Handle simple delete from end
  if (oldText.startsWith(newText)) {
    for (let i = newLen; i < oldLen; i++) {
      diffs.push({ type: 'delete', pos: newLen, char: oldText[i] });
    }
    return diffs;
  }
  
  // Find common prefix
  let prefixLen = 0;
  while (prefixLen < Math.min(oldLen, newLen) && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }
  
  // Find common suffix
  let suffixLen = 0;
  while (
    suffixLen < Math.min(oldLen - prefixLen, newLen - prefixLen) &&
    oldText[oldLen - 1 - suffixLen] === newText[newLen - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  
  // Calculate the middle section that differs
  const oldMiddleEnd = oldLen - suffixLen;
  const newMiddleEnd = newLen - suffixLen;
  
  // Delete old middle section
  for (let i = oldMiddleEnd - 1; i >= prefixLen; i--) {
    diffs.push({ type: 'delete', pos: prefixLen, char: oldText[i] });
  }
  
  // Insert new middle section
  for (let i = prefixLen; i < newMiddleEnd; i++) {
    diffs.push({ type: 'insert', pos: i, char: newText[i] });
  }
  
  return diffs;
}

// Message handler for the worker
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'computeDiff':
      const { oldText, newText } = data;
      const diffs = computeDiff(oldText, newText);
      self.postMessage({ type: 'diffResult', data: diffs });
      break;
      
    case 'parseState':
      // Parse CRDT state in worker thread
      try {
        const parsed = JSON.parse(data);
        self.postMessage({ type: 'parseResult', data: parsed });
      } catch (error) {
        self.postMessage({ type: 'parseError', error: 'Failed to parse state' });
      }
      break;
  }
});

export {}; // Make this a module