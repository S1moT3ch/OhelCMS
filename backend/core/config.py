import os
import re

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Redis Configuration - Pulizia automatica dell'URL (gestisce anche comandi redis-cli incollati per errore)
_raw_redis_url = os.getenv("REDIS_URL", "redis://localhost:6379").strip().strip('"').strip("'")

_match_u = re.search(r'-u\s+([^\s]+)', _raw_redis_url)
if _match_u:
    _raw_redis_url = _match_u.group(1).strip().strip('"').strip("'")
elif "redis-cli" in _raw_redis_url:
    for token in _raw_redis_url.split():
        if "://" in token or "upstash.io" in token or ":6379" in token:
            _raw_redis_url = token.strip().strip('"').strip("'")
            break

if _raw_redis_url.startswith("https://"):
    _raw_redis_url = "rediss://" + _raw_redis_url[8:]
elif _raw_redis_url.startswith("http://"):
    _raw_redis_url = "redis://" + _raw_redis_url[7:]

# Upstash richiede obbligatoriamente connessione TLS (rediss://)
if "upstash.io" in _raw_redis_url and _raw_redis_url.startswith("redis://"):
    _raw_redis_url = "rediss://" + _raw_redis_url[8:]

if _raw_redis_url and not (_raw_redis_url.startswith("redis://") or _raw_redis_url.startswith("rediss://")):
    if "upstash.io" in _raw_redis_url or "cloud.redislabs.com" in _raw_redis_url:
        REDIS_URL = f"rediss://{_raw_redis_url}"
    else:
        REDIS_URL = f"redis://{_raw_redis_url}"
else:
    REDIS_URL = _raw_redis_url





# Google OAuth2 Client ID
GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "289959621652-q7tpu41u1um83dhuct2k58nknins17pn.apps.googleusercontent.com"
)

# Google Sheets Configuration (for migration from Sheets to Redis)
GOOGLE_SHEETS_API_KEY = os.getenv(
    "GOOGLE_SHEETS_API_KEY",
    "AIzaSyDb0HRCmZP1BesThMKKSCQZ5SUZogR_uw0"
)
ID_FILE_SONDAGGI = os.getenv("ID_FILE_SONDAGGI", "17B8_YGTFu3Ui20mZ5dH0PWkd8Bh7lF1O98ZYqAAZib8")
ID_FILE_REGISTRAZIONI = os.getenv("ID_FILE_REGISTRAZIONI", "1HPcdyQ8ILxyzXsJnN6HeCfWetM9r_N8xQds3TDvXP_Q")

# Redis Key Prefixes
REDIS_PREFIX_USER = "ohel:user:"
REDIS_KEY_USERS = "ohel:users"
REDIS_PREFIX_SURVEY = "ohel:survey:"
REDIS_KEY_SURVEYS = "ohel:surveys"
REDIS_PREFIX_ADMIN_SESSION = "ohel:admin:session:"

# Password Amministratore Backend (configurabile su Vercel Environment Variables)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ohelAdmin2026!")
