import os
import sys
import json
import urllib.parse
from typing import Optional

# Assicura che la root del backend sia nel sys.path per l'esecuzione su Vercel Serverless
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from core.redis_client import get_redis_client
from core.auth import verify_google_token
from services.users_service import (
    get_socio,
    salva_nuovo_socio,
    check_admin_permissions,
    set_user_admin_status,
    delete_user,
    get_all_soci,
)
from services.surveys_service import (
    get_active_surveys,
    get_all_surveys,
    get_survey_by_id,
    create_survey,
    update_survey,
    toggle_survey_status,
    delete_survey,
)
from services.votes_service import submit_presences, get_user_votes, get_all_survey_votes
from services.admin_service import (
    create_admin_session,
    verify_admin_session,
    delete_admin_session,
    get_admin_dashboard_data,
    is_mfa_configured,
    generate_mfa_secret,
    get_admin_mfa_secret,
    set_admin_mfa_secret,
    delete_admin_mfa_secret,
    verify_totp,
)
from services.logs_service import (
    add_log,
    get_logs,
    get_logs_count,
    clear_all_logs
)
from templates.admin_page import get_admin_html

app = FastAPI(title="OhelCMS Backend API", version="2.0.0")

# Abilita CORS per permettere chiamate da qualsiasi origine (Frontend React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def normalize_vercel_paths(request: Request, call_next):
    """
    Normalizza i percorsi generati dai rewrite di Vercel.
    Mappa i parametri route=admin e admin_action sul percorso corretto.
    """
    if request.query_params.get("route") == "admin":
        request.scope["path"] = "/admin"
    elif request.query_params.get("admin_action"):
        action = request.query_params.get("admin_action").lstrip("/")
        request.scope["path"] = f"/api/admin/{action}"
    else:
        path = request.scope.get("path", "")
        if path.startswith("/api/index.py"):
            request.scope["path"] = path[len("/api/index.py"):] or "/"
    return await call_next(request)




# ==============================================================================
# 👑 PANNELLO DI AMMINISTRAZIONE WEB (/admin)
# ==============================================================================

@app.get("/admin", response_class=HTMLResponse)
@app.get("/admin/", response_class=HTMLResponse)
@app.get("/api/admin", response_class=HTMLResponse)
@app.get("/api/admin/", response_class=HTMLResponse)
async def serve_admin_panel():
    """Restituisce la pagina web HTML del pannello di amministrazione."""
    return HTMLResponse(content=get_admin_html())


def _extract_admin_token(request: Request) -> Optional[str]:
    """Estrae il token di sessione admin dagli header Authorization o x-admin-token."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return request.headers.get("x-admin-token") or None


def get_client_ip(request: Request) -> str:
    """Estrae l'indirizzo IP del client, supportando proxy Vercel e reverse proxy standard."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return ""


@app.post("/api/admin/login")
@app.post("/admin/login")
async def admin_login(request: Request):
    """Verifica la password configurata e l'eventuale codice OTP App Authenticator."""
    try:
        data = await request.json()
        password = data.get("password", "")
        otp_code = data.get("otpCode") or data.get("otp_code") or ""
        r = get_redis_client()
        ip = get_client_ip(request)

        result = create_admin_session(r, password, otp_code)
        if not result.get("success"):
            if result.get("status") == "mfa_required":
                add_log(r, action="ADMIN_MFA_REQUESTED", description="Accesso admin: password corretta, richiesto codice App Authenticator", source="backend", user_email="admin@system", level="INFO", ip_address=ip)
                return JSONResponse(content=result, status_code=200)
            elif "OTP" in result.get("message", "") or "codice" in result.get("message", "").lower():
                add_log(r, action="ADMIN_MFA_FAILED", description=f"Accesso admin fallito: {result.get('message')}", source="backend", user_email="admin@system", level="WARNING", ip_address=ip)
                return JSONResponse(content=result, status_code=401)
            else:
                add_log(r, action="ADMIN_LOGIN_FAILED", description="Accesso admin fallito: password errata", source="backend", user_email="admin@system", level="WARNING", ip_address=ip)
                return JSONResponse(content=result, status_code=401)

        add_log(r, action="ADMIN_LOGIN_SUCCESS", description="Accesso amministratore di sistema effettuato al portale /admin", source="backend", user_email="admin@system", level="SUCCESS", ip_address=ip)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.get("/api/admin/mfa/status")
@app.get("/admin/mfa/status")
async def admin_mfa_status():
    """Verifica se l'MFA è attualmente configurata per l'amministratore."""
    try:
        r = get_redis_client()
        configured = is_mfa_configured(r)
        return JSONResponse(content={"status": "success", "mfaConfigured": configured})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.get("/api/admin/mfa/setup")
@app.get("/admin/mfa/setup")
async def admin_mfa_setup(request: Request):
    """Genera un nuovo segreto Base32 temporaneo e l'URI otpauth per la scansione QR."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        secret = generate_mfa_secret()
        otpauth_url = f"otpauth://totp/OhelCMS:Admin?secret={secret}&issuer=OhelCMS"
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={urllib.parse.quote(otpauth_url)}"

        return JSONResponse(content={
            "status": "success",
            "secret": secret,
            "otpauth": otpauth_url,
            "qrUrl": qr_url
        })
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/mfa/confirm-setup")
@app.post("/admin/mfa/confirm-setup")
async def admin_mfa_confirm_setup(request: Request):
    """Verifica il codice OTP e attiva definitivamente la MFA con App Authenticator."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        payload = await request.json()
        secret = payload.get("secret", "").strip().replace(" ", "").upper()
        otp_code = str(payload.get("otpCode", "")).strip()

        if not secret or not otp_code:
            return JSONResponse(content={"status": "error", "message": "Dati secret o codice OTP mancanti."}, status_code=400)

        if not verify_totp(otp_code, secret):
            return JSONResponse(content={"status": "error", "message": "Codice OTP non corretto. Verifica l'orario del telefono e riprova."}, status_code=400)

        set_admin_mfa_secret(r, secret)
        add_log(r, action="ADMIN_MFA_ENABLED", description="MFA con App Authenticator configurata e attivata con successo", source="backend", user_email="admin@system", level="SUCCESS", ip_address=get_client_ip(request))
        return JSONResponse(content={
            "status": "success",
            "message": "Autenticazione a due fattori con App Authenticator attivata con successo!"
        })
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/mfa/disable")
@app.post("/admin/mfa/disable")
async def admin_mfa_disable(request: Request):
    """Disattiva l'MFA in Redis previa conferma del codice OTP corrente."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        payload = await request.json()
        otp_code = str(payload.get("otpCode", "")).strip()
        secret = get_admin_mfa_secret(r)

        if not secret:
            return JSONResponse(content={"status": "error", "message": "MFA non configurata."}, status_code=400)

        if not verify_totp(otp_code, secret):
            return JSONResponse(content={"status": "error", "message": "Codice OTP errato. Impossibile disattivare la 2FA."}, status_code=400)

        delete_admin_mfa_secret(r)
        add_log(r, action="ADMIN_MFA_DISABLED", description="MFA App Authenticator disattivata dall'amministratore", source="backend", user_email="admin@system", level="WARNING", ip_address=get_client_ip(request))
        return JSONResponse(content={"status": "success", "message": "MFA disattivata con successo."})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/logout")
@app.post("/admin/logout")
async def admin_logout(request: Request):
    """Invalida il token di sessione admin."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        delete_admin_session(r, token)
        return JSONResponse(content={"status": "success", "message": "Logout eseguito."})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.get("/api/admin/dashboard")
@app.get("/admin/dashboard")
async def admin_dashboard(request: Request):
    """Restituisce tutti i soci, i sondaggi e le statistiche per il pannello admin."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        data = get_admin_dashboard_data(r)
        return JSONResponse(content=data)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/users/toggle-admin")
@app.post("/admin/users/toggle-admin")
async def admin_toggle_user_admin(request: Request):
    """
    Battezza un utente come Amministratore o ne revoca i permessi.
    Modifica 'isAdmin' direttamente nel record Redis dell'utente.
    """
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        payload = await request.json()
        email = payload.get("email")
        is_admin = bool(payload.get("isAdmin", False))

        if not email:
            return JSONResponse(content={"status": "error", "message": "Email obbligatoria."}, status_code=400)

        res = set_user_admin_status(r, email, is_admin)
        add_log(r, action="ADMIN_ROLE_CHANGE", description=f"Ruolo amministratore {'assegnato a' if is_admin else 'revocato da'} {email}", source="backend", user_email="admin@system", level="INFO", ip_address=get_client_ip(request))
        return JSONResponse(content=res)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/users/delete")
@app.post("/admin/users/delete")
async def admin_delete_user(request: Request):
    """Elimina definitivamente un socio da Redis."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        payload = await request.json()
        email = payload.get("email")
        if not email:
            return JSONResponse(content={"status": "error", "message": "Email obbligatoria."}, status_code=400)

        res = delete_user(r, email)
        add_log(r, action="ADMIN_DELETE_USER", description=f"Socio {email} eliminato definitivamente dal database", source="backend", user_email="admin@system", level="WARNING", ip_address=get_client_ip(request))
        return JSONResponse(content=res)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.get("/api/admin/surveys/{id_sondaggio}/votes")
@app.get("/admin/surveys/{id_sondaggio}/votes")
async def admin_get_survey_votes(id_sondaggio: str, request: Request):
    """Restituisce le presenze dettagliate dei membri per un dato sondaggio."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        res = get_all_survey_votes(r, id_sondaggio)
        return JSONResponse(content=res)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/surveys/toggle-status")
@app.post("/admin/surveys/toggle-status")
async def admin_toggle_survey(request: Request):
    """Attiva o disattiva un sondaggio dal pannello admin."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        payload = await request.json()
        id_sondaggio = payload.get("idSondaggio")
        new_status = payload.get("newStatus")

        res = toggle_survey_status(r, id_sondaggio, new_status)
        add_log(r, action="ADMIN_SURVEY_TOGGLE", description=f"Stato sondaggio '{id_sondaggio}' impostato su '{new_status}' dal pannello admin", source="backend", user_email="admin@system", level="INFO", ip_address=get_client_ip(request))
        return JSONResponse(content=res)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/surveys/update")
@app.post("/admin/surveys/update")
async def admin_update_survey(request: Request):
    """Modifica il contenuto, il titolo, la descrizione e le date di un sondaggio dal pannello admin."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        payload = await request.json()
        id_sondaggio = payload.get("idSondaggio")
        if not id_sondaggio:
            return JSONResponse(content={"status": "error", "message": "ID sondaggio mancante."}, status_code=400)

        res = update_survey(r, id_sondaggio, payload)
        add_log(r, action="ADMIN_SURVEY_UPDATE", description=f"Sondaggio '{id_sondaggio}' modificato dal pannello di amministrazione", source="backend", user_email="admin@system", level="SUCCESS", ip_address=get_client_ip(request))
        return JSONResponse(content=res)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/surveys/delete")
@app.post("/admin/surveys/delete")
async def admin_delete_survey_endpoint(request: Request):
    """Elimina un sondaggio e i suoi voti dal pannello admin."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        payload = await request.json()
        id_sondaggio = payload.get("idSondaggio")
        res = delete_survey(r, id_sondaggio)
        add_log(r, action="ADMIN_SURVEY_DELETE", description=f"Sondaggio '{id_sondaggio}' e relative risposte eliminati dal pannello admin", source="backend", user_email="admin@system", level="WARNING", ip_address=get_client_ip(request))
        return JSONResponse(content=res)
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


# ==============================================================================
# 📜 LOG DI SISTEMA E AUDIT (Frontend & Backend - Retention 30 giorni)
# ==============================================================================

@app.get("/api/admin/logs")
@app.get("/admin/logs")
async def admin_get_logs(
    request: Request,
    limit: int = 250,
    offset: int = 0,
    source: Optional[str] = None,
    level: Optional[str] = None,
    search: Optional[str] = None
):
    """Restituisce i log di sistema per la console di amministrazione."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        logs = get_logs(r, limit=limit, offset=offset, source_filter=source, level_filter=level, search=search)
        total = get_logs_count(r)
        return JSONResponse(content={"status": "success", "logs": logs, "total": total})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/admin/logs/clear")
@app.post("/admin/logs/clear")
async def admin_clear_logs_endpoint(request: Request):
    """Elimina tutti i log presenti nel database."""
    try:
        r = get_redis_client()
        token = _extract_admin_token(request)
        if not verify_admin_session(r, token):
            return JSONResponse(content={"status": "unauthorized", "message": "Sessione non valida."}, status_code=401)

        ip = get_client_ip(request)
        deleted = clear_all_logs(r)
        add_log(r, action="LOGS_CLEARED", description=f"Tutti i log ({deleted}) sono stati azzerati manualmente dall'amministratore", source="backend", user_email="admin@system", level="WARNING", ip_address=ip)
        return JSONResponse(content={"status": "success", "message": f"{deleted} log eliminati.", "deleted": deleted})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


@app.post("/api/logs")
@app.post("/logs")
async def client_log_endpoint(request: Request):
    """Riceve log ed eventi dal frontend React."""
    try:
        r = get_redis_client()
        data = await request.json()
        action = data.get("action", "CLIENT_EVENT")
        description = data.get("description", "")
        level = data.get("level", "INFO")
        user_email = data.get("userEmail") or data.get("email") or ""
        user_name = data.get("userName") or data.get("name") or ""
        meta = data.get("metadata", {})
        ip = get_client_ip(request)

        entry = add_log(
            r,
            action=action,
            description=description,
            source="frontend",
            user_email=user_email,
            user_name=user_name,
            level=level,
            metadata=meta,
            ip_address=ip
        )
        return JSONResponse(content={"status": "success", "log": entry})
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)


# ==============================================================================
# 🔄 ENDPOINT ORIGINALI PER IL FRONTEND REACT (Piena compatibilità Google Apps Script)
# ==============================================================================

@app.get("/")
@app.get("/api")
@app.get("/api/index")
@app.get("/exec")
async def handle_get(request: Request):
    """
    Gestione richieste GET (Lettura Dati).
    Replica esattamente il comportamento di doGet di Google Apps Script.
    """
    try:
        r = get_redis_client()
        params = request.query_params

        # Se la richiesta è per il pannello admin
        if params.get("route") == "admin":
            return HTMLResponse(content=get_admin_html())

        action = (params.get("action") or "").strip()
        user_email = (params.get("email") or "").lower().strip() or None
        id_sondaggio = (params.get("idSondaggio") or params.get("idsondaggio") or "").strip()

        # Health check / Informazioni base se non viene specificata un'azione
        if not action:
            return JSONResponse(content={
                "status": "ok",
                "message": "OhelCMS Backend API in esecuzione (sostituzione Google Apps Script)",
                "admin_panel": "/admin",
                "endpoints": ["GET_ACTIVE_SURVEYS", "GET_ALL_SURVEYS", "GET_USER_VOTES", "GET_ALL_SURVEY_VOTES"]
            })

        # 1. GET_ACTIVE_SURVEYS (Restituisce i sondaggi attivi)
        if action == "GET_ACTIVE_SURVEYS":
            surveys = get_active_surveys(r, user_email)
            return JSONResponse(content={"status": "success", "surveys": surveys})

        # 1b. GET_ALL_SURVEYS (Restituisce tutti i sondaggi, attivi e disattivati)
        if action == "GET_ALL_SURVEYS":
            surveys = get_all_surveys(r)
            return JSONResponse(content={"status": "success", "surveys": surveys})

        # 2. GET_USER_VOTES
        if action == "GET_USER_VOTES":
            res = get_user_votes(r, user_email or "", id_sondaggio)
            return JSONResponse(content=res)

        # 3. GET_ALL_SURVEY_VOTES
        if action == "GET_ALL_SURVEY_VOTES":
            res = get_all_survey_votes(r, id_sondaggio)
            return JSONResponse(content=res)

        return JSONResponse(content={"status": "error", "message": "Azione GET non riconosciuta"})

    except Exception as error:
        return JSONResponse(
            content={"status": "error", "message": f"Crash interno GET: {str(error)}"},
            status_code=200
        )


@app.post("/")
@app.post("/api")
@app.post("/api/index")
@app.post("/exec")
async def handle_post(request: Request):
    """
    Gestione richieste POST con validazione token sulle azioni sensibili.
    Replica esattamente il comportamento di doPost di Google Apps Script.
    Accetta payload JSON sia con Content-Type: application/json che text/plain.
    """
    try:
        r = get_redis_client()

        # Lettura sicura del body (gestisce sia Content-Type JSON che text/plain inviato da fetch senza header)
        raw_body = await request.body()
        if not raw_body:
            return JSONResponse(
                content={"status": "error", "message": "Body della richiesta vuoto."},
                status_code=200
            )

        try:
            request_data = json.loads(raw_body.decode("utf-8"))
        except Exception as json_err:
            return JSONResponse(
                content={"status": "error", "message": f"JSON non valido nel body: {str(json_err)}"},
                status_code=200
            )

        id_token = request_data.get("token")
        action = request_data.get("action")
        payload = request_data.get("payload", {})

        if not id_token:
            return JSONResponse(
                content={"status": "error", "message": "Autenticazione richiesta: token mancante."},
                status_code=200
            )

        # 🔒 1. VALIDAZIONE DEL TOKEN OAUTH2 TRAMITE GOOGLE
        token_auth = await verify_google_token(id_token)
        if not token_auth.get("success"):
            return JSONResponse(
                content={"status": "error", "message": f"Token non valido o scaduto: {token_auth.get('message')}"},
                status_code=200
            )

        email = token_auth.get("email", "").lower().strip()

        # --- AZIONE: LOGIN ---
        if action == "LOGIN":
            ip = get_client_ip(request)
            socio = get_socio(r, email)
            is_refresh = bool(request_data.get("isRefresh") or payload.get("isRefresh"))

            if socio:
                s_name = f"{socio.get('nome', '')} {socio.get('cognome', '')}".strip()
                # Antirimbalzo / Debounce: evita di registrare due log duplicati se la dashboard carica o React StrictMode riesegue
                debounce_key = f"ohel:login_debounce:{email}"
                if not is_refresh and r.set(debounce_key, "1", ex=45, nx=True):
                    add_log(r, action="USER_LOGIN", description=f"Accesso utente socio effettuato: {email} ({s_name})", source="backend", user_email=email, user_name=s_name, level="SUCCESS", ip_address=ip)
                return JSONResponse(content={"status": "success", "exists": True, "user": socio})
            else:
                user_info = token_auth.get("userInfo", {})
                s_name = f"{user_info.get('given_name', '')} {user_info.get('family_name', '')}".strip()
                debounce_key = f"ohel:login_debounce:{email}"
                if not is_refresh and r.set(debounce_key, "1", ex=45, nx=True):
                    add_log(r, action="USER_FIRST_AUTH", description=f"Primo accesso con account Google non ancora registrato come socio: {email}", source="backend", user_email=email, user_name=s_name, level="INFO", ip_address=ip)
                return JSONResponse(content={
                    "status": "success",
                    "exists": False,
                    "googleData": {
                        "nome": user_info.get("given_name", "") or user_info.get("name", ""),
                        "cognome": user_info.get("family_name", ""),
                        "email": email,
                        "picture": user_info.get("picture", "")
                    }
                })

        # --- AZIONE SENSIBILE: REGISTRAZIONE NUOVO UTENTE ---
        if action == "REGISTER":
            if get_socio(r, email):
                return JSONResponse(content={"status": "error", "message": "Utente già registrato"})

            user_info = token_auth.get("userInfo", {})
            google_nome = user_info.get("given_name") or user_info.get("name") or ""
            google_cognome = user_info.get("family_name") or ""
            google_picture = user_info.get("picture") or ""

            socio_payload = {
                "nome": (payload.get("nome") or google_nome).strip(),
                "cognome": (payload.get("cognome") or google_cognome).strip(),
                "email": email,
                "picture": (payload.get("picture") or google_picture).strip(),
                "dataNascita": str(payload.get("dataNascita") or payload.get("birthdate") or "").strip(),
                "telefono": str(payload.get("telefono") or "").strip(),
                "codiceFiscale": str(payload.get("codiceFiscale") or "").strip().upper(),
            }
            salva_nuovo_socio(r, socio_payload)
            s_name = f"{socio_payload.get('nome', '')} {socio_payload.get('cognome', '')}".strip()
            add_log(r, action="USER_REGISTERED", description=f"Nuovo socio registrato: {email} ({s_name})", source="backend", user_email=email, user_name=s_name, level="SUCCESS", ip_address=get_client_ip(request))
            return JSONResponse(content={"status": "success", "message": "Registrazione completata", "user": get_socio(r, email)})

        # --- AZIONE SENSIBILE ADMIN: CREAZIONE SONDAGGIO ---
        if action == "CREATE_SURVEY":
            auth_admin = check_admin_permissions(r, email)
            if not auth_admin.get("authorized"):
                return JSONResponse(content={"status": "error", "message": auth_admin.get("message")})

            socio = auth_admin.get("socio", {})
            creator_name = f"{socio.get('nome', '')} {socio.get('cognome', '')}".strip()
            id_sondaggio = create_survey(r, payload, creator_email=email, creator_name=creator_name)
            add_log(r, action="CREATE_SURVEY", description=f"Nuovo sondaggio pubblicato: '{payload.get('title', '')}' (ID: {id_sondaggio}) da {creator_name} ({email})", source="backend", user_email=email, user_name=creator_name, level="SUCCESS", ip_address=get_client_ip(request))
            return JSONResponse(content={"status": "success", "idSondaggio": id_sondaggio})

        # --- AZIONE SENSIBILE ADMIN: MODIFICA CONTENUTO SONDAGGIO ---
        if action == "UPDATE_SURVEY":
            auth_admin = check_admin_permissions(r, email)
            if not auth_admin.get("authorized"):
                return JSONResponse(content={"status": "error", "message": auth_admin.get("message")})

            id_sondaggio = payload.get("idSondaggio")
            if not id_sondaggio:
                return JSONResponse(content={"status": "error", "message": "ID sondaggio mancante per la modifica."})

            survey = get_survey_by_id(r, id_sondaggio)
            if not survey:
                return JSONResponse(content={"status": "error", "message": f"Sondaggio '{id_sondaggio}' non trovato."})

            # Verifica di sicurezza: solo chi ha pubblicato il sondaggio può modificarne il contenuto
            created_by = (survey.get("createdBy") or "").lower().strip()
            if created_by and created_by != email:
                add_log(r, action="UNAUTHORIZED_SURVEY_EDIT", description=f"Tentativo non autorizzato di modifica sondaggio '{id_sondaggio}' da {email} (autore: {created_by})", source="backend", user_email=email, level="WARNING", ip_address=get_client_ip(request))
                return JSONResponse(content={
                    "status": "error",
                    "message": "Operazione negata: puoi modificare solo i sondaggi pubblicati da te."
                })

            res = update_survey(r, id_sondaggio, payload)
            add_log(r, action="UPDATE_SURVEY", description=f"Sondaggio '{id_sondaggio}' ('{payload.get('title', '')}') modificato dall'autore {email}", source="backend", user_email=email, level="SUCCESS", ip_address=get_client_ip(request))
            return JSONResponse(content=res)

        # --- AZIONE SENSIBILE ADMIN: ATTIVA / DISATTIVATO SONDAGGIO ---
        if action == "TOGGLE_SURVEY_STATUS":
            auth_admin = check_admin_permissions(r, email)
            if not auth_admin.get("authorized"):
                return JSONResponse(content={"status": "error", "message": auth_admin.get("message")})

            id_sondaggio_target = payload.get("idSondaggio")
            new_status = payload.get("newStatus")

            if not id_sondaggio_target or not new_status:
                return JSONResponse(
                    content={"status": "error", "message": "Dati insufficienti per aggiornare lo stato."}
                )

            # Verifica di sicurezza: solo chi ha pubblicato il sondaggio può attivarne o disattivarne lo stato
            survey = get_survey_by_id(r, id_sondaggio_target)
            if survey:
                created_by = (survey.get("createdBy") or "").lower().strip()
                if created_by and created_by != email:
                    add_log(r, action="UNAUTHORIZED_STATUS_TOGGLE", description=f"Tentativo non autorizzato di cambio stato sondaggio '{id_sondaggio_target}' da {email}", source="backend", user_email=email, level="WARNING", ip_address=get_client_ip(request))
                    return JSONResponse(content={
                        "status": "error",
                        "message": "Operazione negata: solo l'amministratore che ha pubblicato il sondaggio può modificarne lo stato."
                    })

            res = toggle_survey_status(r, id_sondaggio_target, new_status)
            add_log(r, action="TOGGLE_SURVEY_STATUS", description=f"Stato sondaggio '{id_sondaggio_target}' impostato a '{new_status}' da {email}", source="backend", user_email=email, level="INFO", ip_address=get_client_ip(request))
            return JSONResponse(content=res)

        # --- AZIONE SENSIBILE ADMIN: CANCELLAZIONE SONDAGGIO E RISPOSTE ---
        if action == "DELETE_SURVEY":
            auth_admin = check_admin_permissions(r, email)
            if not auth_admin.get("authorized"):
                return JSONResponse(content={"status": "error", "message": auth_admin.get("message")})

            id_sondaggio_target = payload.get("idSondaggio")
            if not id_sondaggio_target:
                return JSONResponse(
                    content={"status": "error", "message": "ID Sondaggio mancante per l'eliminazione."}
                )

            # Verifica di sicurezza: solo chi ha pubblicato il sondaggio può eliminarlo definitivamente
            survey = get_survey_by_id(r, id_sondaggio_target)
            if survey:
                created_by = (survey.get("createdBy") or "").lower().strip()
                if created_by and created_by != email:
                    add_log(r, action="UNAUTHORIZED_DELETE", description=f"Tentativo non autorizzato di eliminazione sondaggio '{id_sondaggio_target}' da {email}", source="backend", user_email=email, level="WARNING", ip_address=get_client_ip(request))
                    return JSONResponse(content={
                        "status": "error",
                        "message": "Operazione negata: solo l'amministratore che ha pubblicato il sondaggio può eliminarlo."
                    })

            res = delete_survey(r, id_sondaggio_target)
            add_log(r, action="DELETE_SURVEY", description=f"Sondaggio '{id_sondaggio_target}' e relative risposte eliminati da {email}", source="backend", user_email=email, level="WARNING", ip_address=get_client_ip(request))
            return JSONResponse(content=res)

        # --- AZIONE SENSIBILE SOCIO: SALVATAGGIO PRESENZE / VOTO ---
        if action == "SUBMIT_PRESENCES":
            socio_corrente = get_socio(r, email)
            if not socio_corrente:
                return JSONResponse(
                    content={"status": "error", "message": "Utente non registrato nel sistema."}
                )

            res = submit_presences(r, email, payload)
            members_cnt = len(payload.get("membersData", {}))
            socio_name = f"{socio_corrente.get('nome', '')} {socio_corrente.get('cognome', '')}".strip()
            add_log(r, action="SUBMIT_PRESENCES", description=f"Preferenze/disponibilità salvate per {members_cnt} persone nel sondaggio '{payload.get('idSondaggio', '')}' da {email}", source="backend", user_email=email, user_name=socio_name, level="SUCCESS", ip_address=get_client_ip(request))
            return JSONResponse(content=res)

        # --- AZIONE: LOG DI OPERAZIONI FRONTEND ---
        if action == "LOG_CLIENT_EVENT":
            client_act = payload.get("action", "CLIENT_EVENT")
            desc = payload.get("description", "")
            lvl = payload.get("level", "INFO")
            u_name = payload.get("userName", "")
            meta = payload.get("metadata", {})
            entry = add_log(
                r,
                action=client_act,
                description=desc,
                source="frontend",
                user_email=email,
                user_name=u_name,
                level=lvl,
                metadata=meta,
                ip_address=get_client_ip(request)
            )
            return JSONResponse(content={"status": "success", "log": entry})

        # --- AZIONE ADMIN FRONTEND: ELENCO SOCI ANAGRAFICA (/soci) ---
        if action in ("GET_ALL_SOCI", "GET_SOCI", "GET_MEMBERS"):
            auth_admin = check_admin_permissions(r, email)
            if not auth_admin.get("authorized"):
                return JSONResponse(content={"status": "error", "message": auth_admin.get("message")})

            soci = get_all_soci(r)
            return JSONResponse(content={"status": "success", "soci": soci, "total": len(soci)})

        return JSONResponse(content={"status": "error", "message": "Azione POST non riconosciuta"})

    except Exception as error:
        return JSONResponse(
            content={"status": "error", "message": f"Crash interno script: {str(error)}"},
            status_code=200
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)
