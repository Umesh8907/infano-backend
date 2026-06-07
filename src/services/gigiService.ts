import GigiSession, { IGigiSession } from '../models/GigiSession';
import GigiMessage from '../models/GigiMessage';
import { retrieveRelevantChunks } from './gigiRagService';
import { logger } from '../utils/logger';

// Standard safety responses
export const SAFETY_RESPONSES = {
  self_harm: `I'm really sorry you're feeling this way, but please know you don't have to carry this alone. Please reach out to someone who can support you right now. 
In India, you can call the iCALL helpline at **9152987821** (available Monday to Saturday, 10 AM to 8 PM) or the Vandrevala Foundation at **9999666555** (available 24/7). Please connect with them—they are warm, trained, and here to help.`,
  
  medical_emergency: `This sounds like it may need immediate medical attention. Please do not wait. Contact a trusted adult, call emergency services, or go to the nearest hospital immediately. In India, you can dial **112** for emergency assistance.`,
  
  off_topic: `I'm here to talk about women's health, wellness, and self-care! Let's focus on those topics—ask me anything about your cycle, symptoms, sleep, or general wellness.`,
};

/**
 * Classifies query for safety triggers
 */
export const classifyQuerySafety = (query: string): 'self_harm' | 'medical_emergency' | 'off_topic' | 'safe' => {
  const queryLower = query.toLowerCase();

  const selfHarmKeywords = ['suicide', 'self-harm', 'kill myself', 'cutting myself', 'end my life', 'want to die'];
  const emergencyKeywords = ['bleeding heavily', 'can\'t stop bleeding', 'severe pain', 'chest pain', 'poisoned', 'medical emergency', 'overdose'];
  const offTopicKeywords = ['write a python script', 'code this', 'movie review', 'election results', 'weather report', 'stock prices'];

  if (selfHarmKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'self_harm';
  }
  if (emergencyKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'medical_emergency';
  }
  if (offTopicKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'off_topic';
  }

  return 'safe';
};

/**
 * Builds system prompt including user context, cycle details, and vector search results.
 */
export const buildSystemPrompt = (
  session: IGigiSession,
  ragContext: string,
  userAge?: number
): string => {
  const context = session.session_context;
  const conditions = context.health_conditions.length > 0
    ? context.health_conditions.join(', ')
    : 'None reported';
    
  const ageGroup = context.age_group || 'adult';
  const cycleDay = context.cycle_day || 'Unknown';
  const cyclePhase = context.cycle_phase || 'Unknown';

  let toneInstruction = "Use a warm, conversational, friendly older-sister tone. Keep language accessible and simple.";
  if (ageGroup === 'adolescent') {
    toneInstruction = "Use extra gentle, reassuring, and age-appropriate language suitable for adolescents. Simplify medical terms and avoid complex jargon.";
  }

  return `You are Gigi, a warm, knowledgeable, non-judgmental women's health companion inside the Infano.care app.
Your role is to support and inform the user. You are NOT a doctor and cannot diagnose conditions or prescribe medications.

--- USER CONTEXT ---
- Age group: ${ageGroup} (Age: ${userAge || 'Unknown'})
- Logged health conditions: ${conditions}
- Current Cycle Day: ${cycleDay}
- Current Cycle Phase: ${cyclePhase}

--- SCIENTIFIC KNOWLEDGE BASE (RAG) ---
Use this scientifically-backed information to formulate your response where relevant:
${ragContext}

--- RULES OF CONVERSATION ---
1. Reassurance: Always validate user symptoms and feelings first (e.g. "I know cramps can be tough").
2. No Diagnosis: Never say "You have PCOS" or "You have endometriosis". Instead say "These symptoms can sometimes be related to..." and suggest consulting a doctor.
3. No Meds: Never prescribe or name specific drug dosages. Nudge towards general, safe, home-remedy self-care (e.g. heating pad, hydration) or consulting a professional.
4. Keep it concise: Responses should be under 3 paragraphs.
5. Tone: ${toneInstruction}

Begin answering the user's latest query now.`;
};

/**
 * Handles communication with Anthropic API or simulates a typewriter stream fallback
 */
export const streamGigiResponse = async (
  session: IGigiSession,
  userMessage: string,
  history: any[],
  onChunk: (text: string) => void
): Promise<{ text: string; model: string }> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // 1. RAG retrieval
  const chunks = await retrieveRelevantChunks(userMessage);
  const ragContext = chunks.map(c => `[${c.title}]: ${c.content}`).join('\n\n');

  // 2. Build system instruction
  const systemPrompt = buildSystemPrompt(session, ragContext);

  if (apiKey) {
    try {
      const messages = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));
      messages.push({ role: 'user', content: userMessage });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: session.session_context.age_group === 'adolescent' ? 'claude-3-haiku-20240307' : 'claude-3-5-sonnet-20240620',
          system: systemPrompt,
          messages,
          max_tokens: 400,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API returned status: ${response.status}`);
      }

      // Handle streaming parsing in Node.js
      // We read the body stream and trigger onChunk
      const reader = response.body;
      if (!reader) throw new Error('Response body stream is empty');

      let responseText = '';
      const decoder = new TextDecoder();
      
      // Node.js stream implementation
      for await (const chunk of reader as any) {
        const text = decoder.decode(chunk);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const parsed = JSON.parse(line.slice(5).trim());
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                const deltaText = parsed.delta.text;
                responseText += deltaText;
                onChunk(deltaText);
              }
            } catch (_) {}
          }
        }
      }

      return {
        text: responseText,
        model: session.session_context.age_group === 'adolescent' ? 'claude-3-haiku' : 'claude-3-5-sonnet',
      };
    } catch (err: any) {
      logger.error(`Anthropic streaming failed, falling back to mock: ${err.message}`);
    }
  }

  // Fallback mock stream simulator (Typewriter effect)
  // Formulate a custom mock reply based on query matching
  let mockReply = `Thanks for sharing. Navigation of cycle changes during the ${session.session_context.cycle_phase || 'cycle'} can be tough, but you are doing great! Let me know what specific symptoms you want to tackle, or if there is anything else I can guide you on. If symptoms are severe, please make sure to speak to a doctor.`;
  
  const queryLower = userMessage.toLowerCase();
  if (queryLower.includes('cramp') || queryLower.includes('pain')) {
    mockReply = `I'm sorry you are dealing with cramps today. Cramps can be really draining. For quick relief, try applying a warm heating pad to your lower abdomen and drink plenty of warm water or herbal teas. If the pain is severe and doesn't get better with rest, it is always a good idea to consult a doctor. Let me know if you would like me to deep link you to the learning episode on Managing Cycle Pain!`;
  } else if (queryLower.includes('pcos') || queryLower.includes('irregular')) {
    mockReply = `Living with PCOS or irregular cycles can feel frustrating, but you are not alone! Managing PCOS focuses on a balanced diet, steady movement, and managing stress. Since PCOS involves hormonal imbalances, it is highly recommended to consult a gynaecologist to design a personal care plan. Let me know if you want to talk about nutrition tips!`;
  } else if (queryLower.includes('bloat') || queryLower.includes('luteal')) {
    mockReply = `Bloating is very common in the luteal phase due to rising progesterone levels. Hydrating, reducing salty foods, and eating small, frequent meals can help ease the pressure. Try doing some gentle twists or light walking to help release gas. Let me know how else I can support you today!`;
  }

  // Simulate streaming by yielding chunks of 10 characters every 30ms
  let currentPos = 0;
  const chunkSize = 15;
  while (currentPos < mockReply.length) {
    const nextChunk = mockReply.slice(currentPos, currentPos + chunkSize);
    onChunk(nextChunk);
    currentPos += chunkSize;
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  return {
    text: mockReply,
    model: 'mock-haiku-v1',
  };
};
