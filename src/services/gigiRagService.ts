import GigiKnowledgeBase, { IGigiKnowledgeBase } from '../models/GigiKnowledgeBase';
import { logger } from '../utils/logger';

// Mock knowledge base chunks to simulate RAG when MongoDB Atlas Vector Search is not locally running
const MOCK_KNOWLEDGE_BASE = [
  {
    title: 'Managing Menstrual Cramps',
    content: 'Dysmenorrhea (period cramps) can be relieved with heat therapy (heating pad), light stretching, hydration, and over-the-counter pain relief as recommended by your doctor. Foods rich in magnesium and omega-3 fatty acids also support muscle relaxation.',
    category: 'symptoms',
    tags: ['cramps', 'pain', 'period_tips'],
  },
  {
    title: 'Understanding PCOS (Polycystic Ovary Syndrome)',
    content: 'PCOS is a common endocrine disorder causing hormonal imbalances. Symptoms include irregular cycles, weight changes, acne, and ovarian cysts. Management focuses on lifestyle, balanced nutrition, active movement, and consulting a gynaecologist for a personalized plan.',
    category: 'pcos',
    tags: ['pcos', 'irregular', 'hormones'],
  },
  {
    title: 'The Luteal Phase',
    content: 'The Luteal Phase occurs after ovulation and lasts until your next period starts. Progesterone rises, which can trigger PMS symptoms like bloating, mood changes, and breast tenderness. Rest, gentle yoga, and balanced meals help navigate this phase.',
    category: 'cycle_phases',
    tags: ['luteal', 'pms', 'bloating'],
  },
];

/**
 * Generates an embedding for query using OpenAI text-embedding-3-small API
 */
export const getQueryEmbedding = async (query: string): Promise<number[] | null> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: query,
        model: 'text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Embeddings status: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.data[0].embedding;
  } catch (err: any) {
    logger.error(`Failed to generate query embedding: ${err.message}`);
    return null;
  }
};

/**
 * Performs similarity search in MongoDB Vector database or falls back to keyword matching
 */
export const retrieveRelevantChunks = async (query: string): Promise<any[]> => {
  const queryLower = query.toLowerCase();
  
  // Try vector search if embedding is available
  const embedding = await getQueryEmbedding(query);
  if (embedding) {
    try {
      // Atlas Vector Search aggregation pipeline
      const results = await GigiKnowledgeBase.aggregate([
        {
          $vectorSearch: {
            index: 'gigi_vector_index',
            path: 'embedding',
            queryVector: embedding,
            numCandidates: 10,
            limit: 3,
          },
        },
      ]);
      if (results.length > 0) return results;
    } catch (err: any) {
      logger.error(`Atlas Vector search failed, falling back: ${err.message}`);
    }
  }

  // Fallback keyword matching against local mock index
  const matched = MOCK_KNOWLEDGE_BASE.filter(chunk => {
    return (
      chunk.tags.some(tag => queryLower.includes(tag)) ||
      chunk.title.toLowerCase().includes(queryLower) ||
      chunk.content.toLowerCase().includes(queryLower)
    );
  });

  return matched.slice(0, 3);
};
