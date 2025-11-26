

interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

class EmbeddingCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 60 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private getCacheKey(text: string): string {
    return text.toLowerCase().trim();
  }

  get(text: string): number[] | null {
    const key = this.getCacheKey(text);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.embedding;
  }

  set(text: string, embedding: number[]): void {
    const key = this.getCacheKey(text);

    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
export const embeddingCache = new EmbeddingCache(100, 60 * 60 * 1000);

