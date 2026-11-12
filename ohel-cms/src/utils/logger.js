import CONFIG from "../config/config";

/**
 * Invia un evento di log dal frontend React al backend per il registro di audit.
 * L'invio è completamente asincrono (fire-and-forget, non blocca la UI).
 * I log hanno retention garantita di 30 giorni ed auto-cancellazione.
 *
 * @param {string} action - Codice operazione (es. "CLIENT_LOGIN", "CLIENT_VOTE", "CLIENT_LOGOUT")
 * @param {string} description - Descrizione testuale dell'operazione
 * @param {Object} options - { level: "INFO"|"SUCCESS"|"WARNING"|"ERROR", userEmail, userName, metadata }
 */
export const logClientEvent = async (action, description, options = {}) => {
  try {
    const { level = "INFO", userEmail = null, userName = null, metadata = {} } = options;

    let email = userEmail;
    let name = userName;

    if (!email) {
      try {
        const storedUser = localStorage.getItem("userProfile");
        if (storedUser) {
          const u = JSON.parse(storedUser);
          email = u.email || "";
          name = `${u.nome || ""} ${u.cognome || ""}`.trim();
        }
      } catch (e) {}
    }

    const { URL_APPS_SCRIPT } = CONFIG;
    const baseApi = URL_APPS_SCRIPT.replace(/\/api\/?$/, "");
    const directLogUrl = `${baseApi}/api/logs`;

    fetch(directLogUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: (action || "CLIENT_EVENT").toUpperCase(),
        description: description || "",
        level: (level || "INFO").toUpperCase(),
        userEmail: email || "Ospite Browser",
        userName: name || "",
        metadata
      }),
      mode: "cors"
    }).catch(() => {
      // Fallback trasparente verso l'endpoint principale POST
      const token = localStorage.getItem("authToken");
      if (token) {
        fetch(URL_APPS_SCRIPT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "LOG_CLIENT_EVENT",
            token,
            payload: {
              action: (action || "CLIENT_EVENT").toUpperCase(),
              description: description || "",
              level: (level || "INFO").toUpperCase(),
              userName: name || "",
              metadata
            }
          }),
          mode: "cors"
        }).catch(() => {});
      }
    });
  } catch (err) {
    // Silenzioso: gli errori di logging non devono mai interrompere l'esperienza utente
  }
};

export default logClientEvent;

