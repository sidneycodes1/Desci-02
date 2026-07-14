import IORedis, { type RedisOptions } from 'ioredis';

import { serverEnv } from '../env/server';

let redisClient: IORedis | null = null;

export function createRedisRetryStrategy(times: number) {
  return Math.min(times * 50, 2_000);
}

export function createRedisOptions(overrides: RedisOptions = {}): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: createRedisRetryStrategy,
    ...overrides
  };
}

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new IORedis(serverEnv.REDIS_URL, createRedisOptions());
  }

  return redisClient;
}

export function createRedisClient(overrides: RedisOptions = {}) {
  return new IORedis(serverEnv.REDIS_URL, createRedisOptions(overrides));
}

export function createBullMqConnectionOptions() {
  const connectionUrl = new URL(serverEnv.REDIS_URL);

  return {
    host: connectionUrl.hostname,
    port: connectionUrl.port ? Number(connectionUrl.port) : 6379,
    username: connectionUrl.username || undefined,
    password: connectionUrl.password || undefined,
    db: connectionUrl.pathname ? Number(connectionUrl.pathname.replace('/', '') || '0') : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: createRedisRetryStrategy
  } as const;
}
