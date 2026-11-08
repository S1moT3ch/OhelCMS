import urllib.request
import urllib.parse
import json
from typing import Dict, Any
from core.config import GOOGLE_CLIENT_ID

async def verify_google_token(id_token: str) -> Dict[str, Any]:
    """
    Verifica la validità dell'idToken chiamando l'endpoint Google OAuth2 tokeninfo.
    Replica esattamente la logica dell'helper Google Apps Script verifyGoogleToken.
    Utilizza urllib standard library (nessuna dipendenza esterna richiesta).
    """
    if not id_token:
        return {"success": False, "message": "Autenticazione richiesta: token mancante."}

    try:
        url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + urllib.parse.quote(id_token)
        req = urllib.request.Request(url, headers={"User-Agent": "OhelCMS-Backend/1.0"})
        
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                content = resp.read().decode("utf-8")
                user_info = json.loads(content)
        except urllib.error.HTTPError as http_err:
            try:
                err_content = http_err.read().decode("utf-8")
                user_info = json.loads(err_content)
            except Exception:
                user_info = {"error": f"HTTP {http_err.code}"}

        if user_info.get("error") or user_info.get("error_description"):
            error_msg = user_info.get("error_description") or user_info.get("error", "Token non valido o scaduto")
            return {"success": False, "message": error_msg}

        email = user_info.get("email")
        if not email:
            return {"success": False, "message": "Email non trovata all'interno del token Google."}

        aud = user_info.get("aud")
        if GOOGLE_CLIENT_ID and aud != GOOGLE_CLIENT_ID:
            return {"success": False, "message": "Client ID del token non corrisponde all'applicazione."}

        return {
            "success": True,
            "email": email.lower().strip(),
            "userInfo": user_info
        }
    except Exception as err:
        return {"success": False, "message": f"Errore durante la verifica del token: {str(err)}"}
