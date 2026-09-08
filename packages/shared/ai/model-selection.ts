import { getServerEnv } from '../env/server';
import type { AIModelMap, AIProviderName, AIModelTier } from './types';

let _cachedDefaultAiModelMap: AIModelMap | null = null;

export function getDefaultAiModelMap(): AIModelMap {
  if (!_cachedDefaultAiModelMap) {
    const env = getServerEnv();
    _cachedDefaultAiModelMap = {
      openai: {
        fast: env.OPENAI_DEFAULT_MODEL,
        balanced: env.OPENAI_DEFAULT_MODEL,
        reasoning: env.OPENAI_REASONING_MODEL,
        vision: env.OPENAI_DEFAULT_MODEL,
      },
      gemini: {
        fast: env.GEMINI_DEFAULT_MODEL,
        balanced: env.GEMINI_DEFAULT_MODEL,
        reasoning: env.GEMINI_DEFAULT_MODEL,
        vision: env.GEMINI_DEFAULT_MODEL,
      },
    };
  }
  return _cachedDefaultAiModelMap;
}

// Backwards compatibility — lazy getter, does not throw at import time
export const defaultAiModelMap: AIModelMap = new Proxy({} as AIModelMap, {
  get(_target, prop) {
    return (getDefaultAiModelMap() as unknown as Record<string | symbol, unknown>)[prop as string];
  },
}) as AIModelMap;

export function resetDefaultAiModelMapCache(): void {
  _cachedDefaultAiModelMap = null;
}

export function selectModel(
  provider: AIProviderName,
  tier: AIModelTier,
  overrides: Partial<AIModelMap> = {}
) {
  const baseMap = _cachedDefaultAiModelMap ?? getDefaultAiModelMap();
  const providerMap = overrides[provider] ?? baseMap[provider];
  return providerMap[tier];
}
