export type QueueJobMap = Record<string, unknown>;

export interface QueueFactoryOptions {
  prefix?: string;
}

export interface DefaultQueueJobs {
  'content.ingest': {
    sourceId: string;
    sourceType: 'database' | 'ipfs' | 'manual';
    payload: string;
  };
  'content.index': {
    sourceId: string;
    collectionId?: string;
  };
  'ai.generate': {
    prompt: string;
    provider?: 'openai' | 'gemini';
    model?: string;
  };
  'storage.upload': {
    fileName: string;
    contentType?: string;
  };
  'blockchain.sync': {
    chainId: number;
    fromBlock: number;
    toBlock?: number;
  };
}
