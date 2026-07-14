import { serverEnv } from '../env/server';
import type { AIModelMap, AIProviderName, AIModelTier } from './types';

export const defaultAiModelMap: AIModelMap = {
  openai: {
    fast: serverEnv.OPENAI_DEFAULT_MODEL,
    balanced: serverEnv.OPENAI_DEFAULT_MODEL,
    reasoning: serverEnv.OPENAI_REASONING_MODEL,
    vision: serverEnv.OPENAI_DEFAULT_MODEL
  },
  gemini: {
    fast: serverEnv.GEMINI_DEFAULT_MODEL,
    balanced: serverEnv.GEMINI_DEFAULT_MODEL,
    reasoning: serverEnv.GEMINI_DEFAULT_MODEL,
    vision: serverEnv.GEMINI_DEFAULT_MODEL
  }
};

export function selectModel(
  provider: AIProviderName,
  tier: AIModelTier,
  overrides: Partial<AIModelMap> = {}
) {
  const providerMap = overrides[provider] ?? defaultAiModelMap[provider];
  return providerMap[tier];
}
