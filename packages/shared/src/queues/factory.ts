import { Queue, Worker, type JobsOptions, type Processor, type QueueOptions, type WorkerOptions } from 'bullmq';

import type { QueueJobMap } from './types';
import { createBullMqConnectionOptions } from './redis';

export interface CreateQueueFactoryOptions {
  prefix?: string;
  defaultJobOptions?: JobsOptions;
}

export function createQueueFactory<TJobs extends QueueJobMap>(factoryOptions: CreateQueueFactoryOptions = {}) {
  return {
    createQueue<K extends keyof TJobs & string>(name: K, options: Omit<QueueOptions, 'connection'> = {}) {
      return new Queue<TJobs[K], unknown, K>(name, {
        connection: createBullMqConnectionOptions(),
        prefix: factoryOptions.prefix,
        defaultJobOptions: factoryOptions.defaultJobOptions,
        ...options
      });
    },
    createWorker<K extends keyof TJobs & string>(
      name: K,
      processor: Processor<TJobs[K], unknown, K>,
      options: Omit<WorkerOptions, 'connection'> = {}
    ) {
      return new Worker<TJobs[K], unknown, K>(name, processor, {
        connection: createBullMqConnectionOptions(),
        prefix: factoryOptions.prefix,
        ...options
      });
    }
  };
}
