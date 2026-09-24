// language: JavaScript (ESM), file: lib/redis.js
import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();