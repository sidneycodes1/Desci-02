import type { AITextResponse } from '../ai';
import type { Logger } from '../monitoring';

export interface DatabaseService {
  kind: 'database';
  name: 'supabase';
}

export interface BlockchainService {
  kind: 'blockchain';
  name: 'wagmi';
}

export interface StorageService {
  kind: 'storage';
  name: 'pinata';
}

export interface AIService {
  kind: 'ai';
  name: 'openai' | 'gemini';
  generateText(prompt: string): Promise<AITextResponse>;
}

export interface MonitoringService {
  kind: 'monitoring';
  logger: Logger;
}

export interface QueueService {
  kind: 'queue';
}

export interface ServiceRegistry {
  database?: DatabaseService;
  blockchain?: BlockchainService;
  storage?: StorageService;
  ai?: AIService;
  monitoring?: MonitoringService;
  queues?: QueueService;
}
