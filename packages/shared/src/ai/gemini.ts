import { getServerEnv } from '../env/server';
import type { AITextResponse } from './types';

export interface GeminiTextRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function generateGeminiText(request: GeminiTextRequest): Promise<AITextResponse> {
  const env = getServerEnv();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: request.systemPrompt
          ? {
              parts: [{ text: request.systemPrompt }],
            }
          : undefined,
        contents: [
          {
            role: 'user',
            parts: [{ text: request.prompt }],
          },
        ],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text =
    payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

  return {
    provider: 'gemini',
    model: request.model,
    text,
    raw: payload,
  };
}
