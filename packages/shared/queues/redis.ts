import IORedis, { type RedisOptions } from 'ioredis';

import { getServerEnv } from '../env/server';

let redisClient: IORedis | null = null;

export function createRedisRetryStrategy(times: number) {
  return Math.min(times * 50, 2_000);
}

export function createRedisOptions(overrides: RedisOptions = {}): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: createRedisRetryStrategy,
    ...overrides,
  };
}

export function getRedisClient() {
  if (!redisClient) {
    const env = getServerEnv();
    redisClient = new IORedis(env.REDIS_URL, createRedisOptions());
  }

  return redisClient;
}

export function createRedisClient(overrides: RedisOptions = {}) {
  const env = getServerEnv();
  return new IORedis(env.REDIS_URL, createRedisOptions(overrides));
}

export function createBullMqConnectionOptions() {
  const env = getServerEnv();
  const connectionUrl = new URL(env.REDIS_URL);

  return {
    host: connectionUrl.hostname,
    port: connectionUrl.port ? Number(connectionUrl.port) : 6379,
    username: connectionUrl.username || undefined,
    password: connectionUrl.password || undefined,
    db: connectionUrl.pathname ? Number(connectionUrl.pathname.replace('/', '') || '0') : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: createRedisRetryStrategy,
  } as const;
}
