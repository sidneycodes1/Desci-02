export type AIProviderName = 'openai' | 'gemini';
export type AIModelTier = 'fast' | 'balanced' | 'reasoning' | 'vision';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AITextRequest {
  prompt: string;
  systemPrompt?: string;
  provider?: AIProviderName;
  tier?: AIModelTier;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AITextResponse {
  provider: AIProviderName;
  model: string;
  text: string;
  raw?: unknown;
}

export interface AIModelMap {
  openai: Record<AIModelTier, string>;
  gemini: Record<AIModelTier, string>;
}

export interface AIServiceFactoryConfig {
  defaultProvider?: AIProviderName;
  defaultTier?: AIModelTier;
  modelMap?: Partial<AIModelMap>;
}
