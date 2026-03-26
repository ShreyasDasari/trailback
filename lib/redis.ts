import { Redis } from '@upstash/redis'

// Create a singleton Redis instance
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Helper functions for common operations

/**
 * Cache a value with optional expiration
 */
export async function cacheSet(key: string, value: unknown, expirationSeconds?: number) {
  if (expirationSeconds) {
    return redis.set(key, value, { ex: expirationSeconds })
  }
  return redis.set(key, value)
}

/**
 * Get a cached value
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  return redis.get<T>(key)
}

/**
 * Delete a cached value
 */
export async function cacheDelete(key: string) {
  return redis.del(key)
}

/**
 * Increment a counter (useful for rate limiting)
 */
export async function incrementCounter(key: string, expirationSeconds?: number) {
  const count = await redis.incr(key)
  if (expirationSeconds && count === 1) {
    await redis.expire(key, expirationSeconds)
  }
  return count
}

/**
 * Rate limiter - returns true if request is allowed
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const key = `ratelimit:${identifier}`
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  // Use a sliding window rate limiter
  const count = await redis.incr(key)
  
  if (count === 1) {
    // First request, set expiration
    await redis.expire(key, windowSeconds)
  }

  const ttl = await redis.ttl(key)
  const reset = now + (ttl * 1000)

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    reset,
  }
}

/**
 * Store session data
 */
export async function setSession(sessionId: string, data: unknown, expirationSeconds = 86400) {
  return redis.set(`session:${sessionId}`, data, { ex: expirationSeconds })
}

/**
 * Get session data
 */
export async function getSession<T>(sessionId: string): Promise<T | null> {
  return redis.get<T>(`session:${sessionId}`)
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string) {
  return redis.del(`session:${sessionId}`)
}

/**
 * Cache event data for faster timeline loading
 */
export async function cacheUserEvents(userId: string, events: unknown[], expirationSeconds = 60) {
  return redis.set(`events:${userId}`, events, { ex: expirationSeconds })
}

/**
 * Get cached user events
 */
export async function getCachedUserEvents<T>(userId: string): Promise<T | null> {
  return redis.get<T>(`events:${userId}`)
}

/**
 * Invalidate user events cache (call after new events are created)
 */
export async function invalidateUserEventsCache(userId: string) {
  return redis.del(`events:${userId}`)
}
