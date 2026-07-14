import { serverEnv } from '../env/server';
import { selectModel } from './model-selection';
import { generateGeminiText } from './gemini';
import { generateOpenAIText } from './openai';
import type {
  AIModelMap,
  AIModelTier,
  AIProviderName,
  AIServiceFactoryConfig,
  AITextRequest,
  AITextResponse
} from './types';

export function createAIServiceFactory(config: AIServiceFactoryConfig = {}) {
  const defaultProvider: AIProviderName = config.defaultProvider ?? 'openai';
  const defaultTier = config.defaultTier ?? 'balanced';
  const modelMap: Partial<AIModelMap> = config.modelMap ?? {};

  return {
    resolveModel(provider: AIProviderName, tier: AIModelTier = defaultTier) {
      return selectModel(provider, tier, modelMap);
    },
    async generateText(request: AITextRequest): Promise<AITextResponse> {
      const provider = request.provider ?? defaultProvider;
      const tier = request.tier ?? defaultTier;
      const model = request.model ?? selectModel(provider, tier, modelMap);

      if (provider === 'gemini') {
        return generateGeminiText({
          model,
          prompt: request.prompt,
          systemPrompt: request.systemPrompt,
          temperature: request.temperature,
          maxTokens: request.maxTokens
        });
      }

      return generateOpenAIText({
        model: model || serverEnv.OPENAI_DEFAULT_MODEL,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxTokens: request.maxTokens
      });
    }
  };
}
