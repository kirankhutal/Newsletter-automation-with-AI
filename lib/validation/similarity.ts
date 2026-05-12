// lib/validation/similarity.ts
// Content similarity checker — uses embedding-based cosine similarity
// Falls back to word overlap if embedding API is unavailable

export interface SimilarityResult {
  score: number;
  method: 'embedding' | 'word-overlap';
  tooSimilar: boolean;
}

const SIMILARITY_THRESHOLD = 0.7;

async function getEmbedding(text: string): Promise<number[]> {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('LLM config not available for embedding');
  }

  // Try OpenRouter's embedding endpoint first
  const embeddingApiUrl = apiUrl.replace('/chat/completions', '/embeddings');

  const response = await fetch(embeddingApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'text-embedding-ada-002',
      input: text.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0]?.embedding || [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function wordOverlapSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1
      .toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  const words2 = new Set(
    text2
      .toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

export async function checkSimilarity(
  currentContent: string,
  previousContent: string
): Promise<SimilarityResult> {
  // Strip HTML for comparison
  const plainCurrent = currentContent.replace(/<[^>]*>/g, ' ').trim();
  const plainPrevious = previousContent.replace(/<[^>]*>/g, ' ').trim();

  // Skip check if no previous content
  if (!plainPrevious) {
    return { score: 0, method: 'word-overlap', tooSimilar: false };
  }

  try {
    // Try embedding-based similarity
    const [embeddingCurrent, embeddingPrevious] = await Promise.all([
      getEmbedding(plainCurrent),
      getEmbedding(plainPrevious),
    ]);

    if (embeddingCurrent.length > 0 && embeddingPrevious.length > 0) {
      const score = cosineSimilarity(embeddingCurrent, embeddingPrevious);
      return {
        score,
        method: 'embedding',
        tooSimilar: score >= SIMILARITY_THRESHOLD,
      };
    }
  } catch {
    console.log('Embedding API unavailable, falling back to word overlap');
  }

  // Fallback to word overlap
  const score = wordOverlapSimilarity(plainCurrent, plainPrevious);
  return {
    score,
    method: 'word-overlap',
    tooSimilar: score >= SIMILARITY_THRESHOLD,
  };
}
