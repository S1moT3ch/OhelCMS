import redis
from core.config import REDIS_URL

_redis_pool = None

def get_redis_client() -> redis.Redis:
    """
    Restituisce un'istanza del client Redis configurata con connection pool.
    Supporta sia redis:// che rediss:// (TLS per Upstash o Redis Cloud).
    """
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5
        )
    return redis.Redis(connection_pool=_redis_pool)

