import redisClient from '../config/redis';

const CACHE_TTL = 3600; // 1 hour TTL in seconds

export const getTasksCache = async (assigneeId: string): Promise<any[] | null> => {
  // If Redis is not connected, fallback to DB
  if (!redisClient.isOpen) {
    return null;
  }

  try {
    const key = `tasks:assignee:${assigneeId}`;
    const cachedData = await redisClient.get(key);
    
    if (cachedData) {
      console.log(`🎯 Cache Hit for key: ${key}`);
      return JSON.parse(cachedData);
    }
    
    console.log(`⚡ Cache Miss for key: ${key}`);
    return null;
  } catch (err) {
    console.warn('⚠️ Error reading from Redis cache:', err);
    return null;
  }
};

export const setTasksCache = async (assigneeId: string, tasks: any[]): Promise<void> => {
  if (!redisClient.isOpen) {
    return;
  }

  try {
    const key = `tasks:assignee:${assigneeId}`;
    await redisClient.setEx(key, CACHE_TTL, JSON.stringify(tasks));
    console.log(`💾 Saved tasks list to cache under key: ${key}`);
  } catch (err) {
    console.warn('⚠️ Error writing to Redis cache:', err);
  }
};

export const invalidateTasksCache = async (assigneeId: string | null): Promise<void> => {
  if (!assigneeId || !redisClient.isOpen) {
    return;
  }

  try {
    const key = `tasks:assignee:${assigneeId}`;
    const deletedCount = await redisClient.del(key);
    if (deletedCount > 0) {
      console.log(`🧹 Cache Invalidated for key: ${key}`);
    }
  } catch (err) {
    console.warn('⚠️ Error invalidating Redis cache:', err);
  }
};
