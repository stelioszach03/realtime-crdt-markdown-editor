/**
 * Simple in-memory cache for API responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get cached data if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear cache entries matching a pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

export const apiCache = new ApiCache();

/**
 * Cache key generators
 */
export const cacheKeys = {
  documents: (params?: any) => `documents:${JSON.stringify(params || {})}`,
  document: (id: string) => `document:${id}`,
  currentUser: () => 'currentUser',
  documentCrdt: (id: string) => `document:${id}:crdt`,
};

/**
 * Cache TTL configurations (in milliseconds)
 */
export const cacheTTL = {
  documents: 2 * 60 * 1000,     // 2 minutes for document list
  document: 5 * 60 * 1000,      // 5 minutes for individual document
  currentUser: 10 * 60 * 1000,  // 10 minutes for user info
  documentCrdt: 30 * 1000,      // 30 seconds for CRDT state
};