interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

class EmbeddingCache {
  private cache: Map<string, CacheEntry>;
  private inflight: Map<string, Promise<number[]>>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 500, ttl: number = 6 * 60 * 60 * 1000) {
    this.cache = new Map();
    this.inflight = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private getCacheKey(text: string): string {
    return text.toLowerCase().trim().slice(0, 4000);
  }

  get(text: string): number[] | null {
    const key = this.getCacheKey(text);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.embedding;
  }

  set(text: string, embedding: number[]): void {
    const key = this.getCacheKey(text);
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { embedding, timestamp: Date.now() });
  }

  async getOrCompute(
    text: string,
    compute: (text: string) => Promise<number[]>
  ): Promise<number[]> {
    const cached = this.get(text);
    if (cached) return cached;

    const key = this.getCacheKey(text);
    const inflight = this.inflight.get(key);
    if (inflight) return inflight;

    const promise = compute(text)
      .then((embedding) => {
        this.set(text, embedding);
        return embedding;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const embeddingCache = new EmbeddingCache(500, 6 * 60 * 60 * 1000);
