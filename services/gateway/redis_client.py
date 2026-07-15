import os
import json
import logging
import redis

logger = logging.getLogger("gateway")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class RedisManager:
    def __init__(self):
        self.client = None
        self.local_cache = {}  # Local cache fallback when Redis is offline
        try:
            self.client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
            # Ping Redis to test connection
            self.client.ping()
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.warning(f"Could not connect to Redis at {REDIS_URL}: {e}. Running with Redis simulated fallback.")
            self.client = None

    def publish(self, channel: str, message: dict) -> bool:
        serialized = json.dumps(message)
        if self.client:
            try:
                self.client.publish(channel, serialized)
                logger.info(f"Published event to Redis channel '{channel}': {serialized}")
                return True
            except Exception as e:
                logger.error(f"Failed to publish to Redis channel '{channel}': {e}")
        
        # Log fallback simulation
        logger.info(f"[SIMULATED REDIS PUBLISH] Channel '{channel}': {serialized}")
        return False

    def get(self, key: str) -> str | None:
        if self.client:
            try:
                return self.client.get(key)
            except Exception as e:
                logger.error(f"Failed to get key '{key}' from Redis: {e}")
        
        # Fallback to local in-memory dict cache
        return self.local_cache.get(key)

    def set(self, key: str, value: str, ex: int | None = None) -> bool:
        if self.client:
            try:
                self.client.set(key, value, ex=ex)
                return True
            except Exception as e:
                logger.error(f"Failed to set key '{key}' in Redis: {e}")
        
        # Fallback to local in-memory dict cache
        self.local_cache[key] = value
        return True

# Global singleton
redis_manager = RedisManager()

