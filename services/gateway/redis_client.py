import os
import json
import logging
import redis

logger = logging.getLogger("gateway")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class RedisManager:
    def __init__(self):
        self.client = None
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

# Global singleton
redis_manager = RedisManager()
