export type SummaryItemForSimilarity = {
  id: string
  url: string
  summary: string
  title?: string
  tags?: Array<{ id: string; name: string; color: string }>
}

const similarityCache = new Map<string, number>()
const CACHE_KEY_SEPARATOR = '|||'

function getCacheKey(text1: string, text2: string): string {
  const [first, second] = [text1, text2].sort()
  return `${first}${CACHE_KEY_SEPARATOR}${second}`
}

async function calculateAIEmbeddingSimilarity(
  text1: string,
  text2: string
): Promise<number> {
  const cacheKey = getCacheKey(text1, text2)
  if (similarityCache.has(cacheKey)) {
    return similarityCache.get(cacheKey)!
  }

  try {
    const response = await fetch('/api/ai/embeddings/similarity', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text1, text2 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const similarity = data.similarity || 0

    similarityCache.set(cacheKey, similarity)

    return similarity
  } catch (error) {
    console.error('Error calculating AI embedding similarity:', error);
    throw error;
  }
}


function prepareTextForComparison(item: SummaryItemForSimilarity): string {
  const title = item.title || '';
  const summary = item.summary || '';
  const summaryPreview = summary.length > 500 ? summary.substring(0, 500) + '...' : summary;

  return `${title} ${summaryPreview}`.trim();
}

export async function calculateRelevanceScore(
  selected: SummaryItemForSimilarity,
  candidate: SummaryItemForSimilarity
): Promise<number> {
  const selectedText = prepareTextForComparison(selected);
  const candidateText = prepareTextForComparison(candidate);

  if (selectedText.length < 10 || candidateText.length < 10) {
    return 0;
  }

  let aiSimilarity = 0;
  try {
    aiSimilarity = await calculateAIEmbeddingSimilarity(selectedText, candidateText);
  } catch (error) {
    console.error('Failed to calculate AI similarity:', error);
    return 0;
  }

  let score = aiSimilarity * 0.95;

  if (aiSimilarity > 0.2 && selected.tags && candidate.tags && selected.tags.length > 0) {
    const sharedTagCount = selected.tags.filter(tag =>
      candidate.tags?.some(ctag => ctag.id === tag.id)
    ).length;
    const tagScore = sharedTagCount / Math.max(selected.tags.length, candidate.tags?.length || 1);
    score += tagScore * 0.04;
  }


  return Math.min(1, Math.max(0, score));
}

export type RelatedSummaryWithScore<T extends SummaryItemForSimilarity> = {
  item: T;
  score: number;
}

export async function findRelatedSummaries<T extends SummaryItemForSimilarity>(
  selected: T,
  allSummaries: T[],
  limit: number = 5,
  minSimilarity: number = 0.25
): Promise<RelatedSummaryWithScore<T>[]> {

  const candidates = allSummaries.filter(item => item.id !== selected.id);

  if (candidates.length === 0) return [];

  const scoredSummaries = await Promise.all(
    candidates.map(async (item) => {
      const score = await calculateRelevanceScore(selected, item);
      return { item, score };
    })
  );

  const filtered = scoredSummaries
    .filter(scored => scored.score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return filtered;
}

export const findRelatedSummariesWithAI = findRelatedSummaries;

