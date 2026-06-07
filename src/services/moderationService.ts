import { logger } from '../utils/logger';

export interface IModerationResult {
  flagged: boolean;
  score: any;
  reason?: string;
}

const PROFANITY_BLOCKLIST = [
  'harass', 'kill yourself', 'suicide', 'abuse', 'hate you',
  // standard placeholders for demonstration
];

/**
 * Validates text content using OpenAI Moderation API (when key available)
 * or falls back to a local pattern-matching heuristic blocklist.
 */
export const checkContentModeration = async (text: string): Promise<IModerationResult> => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: text }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Moderation API returned status: ${response.status}`);
      }

      const data = await response.json() as any;
      const result = data.results[0];

      if (result.flagged) {
        // Find categories that triggered the flag
        const triggered = Object.entries(result.categories)
          .filter(([_, val]) => val === true)
          .map(([key]) => key);
          
        return {
          flagged: true,
          score: result.category_scores,
          reason: `Violates policies: ${triggered.join(', ')}`,
        };
      }

      return {
        flagged: false,
        score: result.category_scores,
      };
    } catch (err: any) {
      logger.error(`OpenAI Moderation API execution failure, falling back to local filter: ${err.message}`);
    }
  }

  // Local fallback heuristic blocklist check
  const textLower = text.toLowerCase();
  const matchedKeyword = PROFANITY_BLOCKLIST.find(word => textLower.includes(word));

  if (matchedKeyword) {
    return {
      flagged: true,
      score: { local_filter: 1.0 },
      reason: `Flagged by local moderation filter (matched keyword: "${matchedKeyword}")`,
    };
  }

  return {
    flagged: false,
    score: { local_filter: 0.0 },
  };
};
