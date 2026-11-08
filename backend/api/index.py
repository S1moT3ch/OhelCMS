import os
import sys
import json
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
)
from services.surveys_service import (
    get_active_surveys,
    get_all_surveys,
    create_survey,
    toggle_survey_status,
    delete_survey,
)
from services.votes_service import submit_presences, get_user_votes, get_all_survey_votes
from services.admin_service import (
    create_admin_session,
    verify_admin_session,
    delete_admin_session,
    get_admin_dashboard_data,
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


@app.post("/api/admin/login")
@app.post("/admin/login")
async def admin_login(request: Request):
    """Verifica la password configurata e rilascia il token di sessione admin."""
    try:
        data = await request.json()
        password = data.get("password", "")
        r = get_redis_client()

        session_token = create_admin_session(r, password)
        if not session_token:
            return JSONResponse(
                content={"status": "error", "message": "Password non corretta."},
                status_code=401
            )

        return JSONResponse(content={"status": "success", "token": session_token})
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
        return JSONResponse(content=res)
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
            socio = get_socio(r, email)
            if socio:
                return JSONResponse(content={"status": "success", "exists": True, "user": socio})
            else:
                user_info = token_auth.get("userInfo", {})
                return JSONResponse(content={
                    "status": "success",
                    "exists": False,
                    "googleData": {
                        "idGoogle": user_info.get("sub", ""),
                        "nome": user_info.get("given_name", ""),
                        "cognome": user_info.get("family_name", ""),
                        "email": email,
                        "picture": user_info.get("picture", "")
                    }
                })

        # --- AZIONE SENSIBILE: REGISTRAZIONE NUOVO UTENTE ---
        if action == "REGISTER":
            if get_socio(r, email):
                return JSONResponse(content={"status": "error", "message": "Utente già registrato"})
            salva_nuovo_socio(r, payload)
            return JSONResponse(content={"status": "success", "message": "Registrazione completata"})

        # --- AZIONE SENSIBILE ADMIN: CREAZIONE SONDAGGIO ---
        if action == "CREATE_SURVEY":
            auth_admin = check_admin_permissions(r, email)
            if not auth_admin.get("authorized"):
                return JSONResponse(content={"status": "error", "message": auth_admin.get("message")})

            id_sondaggio = create_survey(r, payload)
            return JSONResponse(content={"status": "success", "idSondaggio": id_sondaggio})

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

            res = toggle_survey_status(r, id_sondaggio_target, new_status)
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

            res = delete_survey(r, id_sondaggio_target)
            return JSONResponse(content=res)

        # --- AZIONE SENSIBILE SOCIO: SALVATAGGIO PRESENZE / VOTO ---
        if action == "SUBMIT_PRESENCES":
            socio_corrente = get_socio(r, email)
            if not socio_corrente:
                return JSONResponse(
                    content={"status": "error", "message": "Utente non registrato nel sistema."}
                )

            res = submit_presences(r, email, payload)
            return JSONResponse(content=res)

        return JSONResponse(content={"status": "error", "message": "Azione POST non riconosciuta"})

    except Exception as error:
        return JSONResponse(
            content={"status": "error", "message": f"Crash interno script: {str(error)}"},
            status_code=200
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)
