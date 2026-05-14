export type SummaryItemForSimilarity = {
  id: string
  url: string
  summary: string
  title?: string
  tags?: Array<{ id: string; name: string; color: string }>
}

const similarityCache = new Map<string, number>()
const CACHE_KEY_SEPARATOR = '|||'
const CACHE_LIMIT = 2000

function rememberSimilarity(text1: string, text2: string, value: number) {
  if (similarityCache.size >= CACHE_LIMIT) {
    const firstKey = similarityCache.keys().next().value
    if (firstKey) similarityCache.delete(firstKey)
  }
  const [first, second] = [text1, text2].sort()
  similarityCache.set(`${first}${CACHE_KEY_SEPARATOR}${second}`, value)
}

function getCachedSimilarity(text1: string, text2: string): number | undefined {
  const [first, second] = [text1, text2].sort()
  return similarityCache.get(`${first}${CACHE_KEY_SEPARATOR}${second}`)
}

export function __clearSimilarityCacheForTesting() {
  similarityCache.clear()
}

async function fetchBatchSimilarities(
  selectedText: string,
  candidateTexts: string[]
): Promise<number[]> {
  if (candidateTexts.length === 0) return []

  const response = await fetch('/api/ai/embeddings/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: selectedText, candidates: candidateTexts }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Batch similarity API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const arr: number[] = Array.isArray(data.similarities) ? data.similarities : []
  if (arr.length !== candidateTexts.length) {
    throw new Error('Batch similarity returned mismatched length')
  }
  return arr
}

function prepareTextForComparison(item: SummaryItemForSimilarity): string {
  const title = item.title || ''
  const summary = item.summary || ''
  const summaryPreview = summary.length > 500 ? summary.substring(0, 500) + '...' : summary
  return `${title} ${summaryPreview}`.trim()
}

function applyTagBoost(
  aiSimilarity: number,
  selected: SummaryItemForSimilarity,
  candidate: SummaryItemForSimilarity
): number {
  let score = aiSimilarity * 0.95
  if (aiSimilarity > 0.2 && selected.tags && candidate.tags && selected.tags.length > 0) {
    const sharedTagCount = selected.tags.filter(tag =>
      candidate.tags?.some(ctag => ctag.id === tag.id)
    ).length
    const tagScore = sharedTagCount / Math.max(selected.tags.length, candidate.tags?.length || 1)
    score += tagScore * 0.04
  }
  return Math.min(1, Math.max(0, score))
}

export async function calculateRelevanceScore(
  selected: SummaryItemForSimilarity,
  candidate: SummaryItemForSimilarity
): Promise<number> {
  const selectedText = prepareTextForComparison(selected)
  const candidateText = prepareTextForComparison(candidate)

  if (selectedText.length < 10 || candidateText.length < 10) return 0

  const cached = getCachedSimilarity(selectedText, candidateText)
  if (cached !== undefined) {
    return applyTagBoost(cached, selected, candidate)
  }

  try {
    const [similarity] = await fetchBatchSimilarities(selectedText, [candidateText])
    rememberSimilarity(selectedText, candidateText, similarity)
    return applyTagBoost(similarity, selected, candidate)
  } catch (error) {
    console.error('Failed to calculate AI similarity:', error)
    return 0
  }
}

export type RelatedSummaryWithScore<T extends SummaryItemForSimilarity> = {
  item: T
  score: number
}

export async function findRelatedSummaries<T extends SummaryItemForSimilarity>(
  selected: T,
  allSummaries: T[],
  limit: number = 5,
  minSimilarity: number = 0.25
): Promise<RelatedSummaryWithScore<T>[]> {
  const candidates = allSummaries.filter(item => item.id !== selected.id)
  if (candidates.length === 0) return []

  const selectedText = prepareTextForComparison(selected)
  if (selectedText.length < 10) return []

  const candidateTexts = candidates.map(prepareTextForComparison)

  const cachedScores = new Map<number, number>()
  const toFetch: { index: number; text: string }[] = []
  candidateTexts.forEach((text, i) => {
    if (text.length < 10) {
      cachedScores.set(i, 0)
      return
    }
    const cached = getCachedSimilarity(selectedText, text)
    if (cached !== undefined) {
      cachedScores.set(i, cached)
    } else {
      toFetch.push({ index: i, text })
    }
  })

  let fetched: number[] = []
  if (toFetch.length > 0) {
    try {
      fetched = await fetchBatchSimilarities(
        selectedText,
        toFetch.map((t) => t.text)
      )
      toFetch.forEach((t, i) => {
        rememberSimilarity(selectedText, t.text, fetched[i])
      })
    } catch (error) {
      console.error('Failed batch similarity:', error)
      return []
    }
  }

  const scored: RelatedSummaryWithScore<T>[] = candidates.map((item, i) => {
    let raw = cachedScores.get(i)
    if (raw === undefined) {
      const idx = toFetch.findIndex((t) => t.index === i)
      raw = idx >= 0 ? fetched[idx] : 0
    }
    return { item, score: applyTagBoost(raw, selected, item) }
  })

  return scored
    .filter((s) => s.score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export const findRelatedSummariesWithAI = findRelatedSummaries
