/**
 * Hook for using Web Worker for CRDT operations
 */
import { useEffect, useRef, useCallback } from 'react';

export const useCRDTWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<Map<string, (data: any) => void>>(new Map());

  useEffect(() => {
    // Only use worker in production for actual performance benefit
    if (import.meta.env.DEV) return;

    try {
      // Create worker from the worker file
      workerRef.current = new Worker(
        new URL('../utils/crdtWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event) => {
        const { type, data, error } = event.data;
        
        // Execute registered callbacks
        const callback = callbacksRef.current.get(type);
        if (callback) {
          callback(error ? { error } : data);
          callbacksRef.current.delete(type);
        }
      };

      workerRef.current.onerror = () => {
        // Silently handle worker errors
      };
    } catch {
      // Worker not available, will fall back to main thread
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const computeDiff = useCallback((
    oldText: string,
    newText: string,
    callback: (diffs: any[]) => void
  ) => {
    if (!workerRef.current) {
      // Fallback to synchronous computation
      // This is a simplified version - your actual CRDT should handle this
      callback([]);
      return;
    }

    callbacksRef.current.set('diffResult', callback);
    workerRef.current.postMessage({
      type: 'computeDiff',
      data: { oldText, newText }
    });
  }, []);

  const parseState = useCallback((
    stateString: string,
    callback: (parsed: any) => void
  ) => {
    if (!workerRef.current) {
      // Fallback to synchronous parsing
      try {
        const parsed = JSON.parse(stateString);
        callback(parsed);
      } catch {
        callback(null);
      }
      return;
    }

    callbacksRef.current.set('parseResult', callback);
    workerRef.current.postMessage({
      type: 'parseState',
      data: stateString
    });
  }, []);

  return {
    computeDiff,
    parseState,
    isWorkerAvailable: !!workerRef.current
  };
};