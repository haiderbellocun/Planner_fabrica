import OpenAI from 'openai';
import { env } from '../config/env.js';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (env.NODE_ENV !== 'production') {
      console.warn('[llmService] OPENAI_API_KEY not set, LLM disabled');
    }
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function generateChatAnswer(prompt: string, maxTokens = 600): Promise<string> {
  const client = getOpenAIClient();
  if (!client) {
    return 'El asistente aún no está configurado en el servidor (OPENAI_API_KEY no está definido).';
  }

  const model = env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'Eres Lumina, asistente de la Fábrica de Contenidos. Sigue las instrucciones del mensaje del usuario con exactitud.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
  });

  const text = response.choices[0]?.message?.content;
  return (text || 'No pude generar una respuesta en este momento.').trim();
}

