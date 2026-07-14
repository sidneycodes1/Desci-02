import OpenAI from 'openai';

import { serverEnv } from '../env/server';
import type { AITextResponse } from './types';

let openAIClient: OpenAI | null = null;

export function getOpenAIClient(apiKey = serverEnv.OPENAI_API_KEY) {
  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey });
  }

  return openAIClient;
}

export interface OpenAITextRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function generateOpenAIText(request: OpenAITextRequest): Promise<AITextResponse> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: request.model,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
    messages: [
      ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
      { role: 'user' as const, content: request.prompt }
    ]
  });

  return {
    provider: 'openai',
    model: request.model,
    text: response.choices[0]?.message?.content ?? '',
    raw: response
  };
}
