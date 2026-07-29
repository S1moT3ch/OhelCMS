const PREFIX = "ohel_cache_";
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minuti in millisecondi

/**
 * Salva un valore nella cache di localStorage con un tempo di validità (TTL).
 * @param {string} key - Chiave univoca per la risorsa
 * @param {any} data - Dati da memorizzare (verranno serializzati in JSON)
 * @param {number} [ttlMs] - Durata di validità in ms (default: 5 minuti)
 */
export const setCache = (key, data, ttlMs = DEFAULT_TTL) => {
    try {
        const item = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        };
        localStorage.setItem(PREFIX + key, JSON.stringify(item));
    } catch (err) {
        console.warn("Errore durante il salvataggio nella cache:", err);
    }
};

/**
 * Recupera un valore dalla cache se presente.
 * @param {string} key - Chiave della risorsa
 * @returns {{ data: any, isStale: boolean, timestamp: number } | null}
 */
export const getCache = (key) => {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;

        const item = JSON.parse(raw);
        const isStale = Date.now() - item.timestamp > item.ttl;

        return {
            data: item.data,
            isStale,
            timestamp: item.timestamp,
        };
    } catch (err) {
        console.warn("Errore durante la lettura dalla cache:", err);
        return null;
    }
};

/**
 * Rimuove un elemento specifico dalla cache.
 * @param {string} key 
 */
export const removeCache = (key) => {
    try {
        localStorage.removeItem(PREFIX + key);
    } catch (err) {
        console.warn("Errore durante la cancellazione dalla cache:", err);
    }
};

/**
 * Rimuove tutte le chiavi della cache che contengono il pattern specificato.
 * @param {string} pattern 
 */
export const clearCachePattern = (pattern) => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(PREFIX) && k.includes(pattern)) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (err) {
        console.warn("Errore durante la pulizia dei pattern dalla cache:", err);
    }
};

/**
 * Pulisce tutte le chiavi gestite dal cacheManager e invalida la sessione dell'utente (userProfile e authToken).
 */
export const clearAllCache = () => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(PREFIX)) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem("userProfile");
        localStorage.removeItem("authToken");
    } catch (err) {
        console.warn("Errore durante la pulizia totale della cache:", err);
    }
};
