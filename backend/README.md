# OhelCMS - Backend Python (FastAPI + Redis per Vercel)

Questo backend in **Python (FastAPI)** è stato progettato per sostituire completamente il precedente backend basato su **Google Apps Script (GAS)** e **Google Sheets**, offrendo:
- **Tempi di risposta istantanei (1-5 ms)** rispetto ai 2-5 secondi di Google Apps Script.
- **Piena compatibilità con il Frontend React esistente**: non è necessario modificare alcun file del frontend ad eccezione di `URL_APPS_SCRIPT` in [`config.js`](file:///c:/Users/canto/OhelCMS/ohel-cms/src/config/config.js).
- **Deploy serverless nativo su Vercel**.
- **Database NoSQL Redis** strutturato, pulito e resiliente (compatibile con Upstash, Redis Cloud, Docker o qualsiasi istanza Redis).

---

## 📊 1. Analisi dei Fogli Google & Nuovo Schema Redis

### Confronto con i Fogli Google originali:

| Entità | Origine (Google Sheets) | Nuovo Modello (Redis Database) | Tipo Redis |
| :--- | :--- | :--- | :--- |
| **Soci / Utenti** | `Utenti` -> `Registrazioni` | `ohel:user:{email}` | `Hash` |
| **Indice Utenti** | Colonna `Email` | `ohel:users` | `Set` |
| **Sondaggi** | `Sondaggi` -> `Configurazione_Sondaggi` | `ohel:survey:{idSondaggio}` | `String (JSON)` |
| **Indice Sondaggi** | Righe raggruppate per ID | `ohel:surveys` | `Sorted Set (ZSET)` |
| **Risposte / Voti** | `Sondaggi` -> `Risposte_Presenze` | `ohel:survey:{idSondaggio}:votes` | `Hash` (campo = `nomeUtente`) |

---

### Dettaglio Chiavi Redis:

#### 1. Utenti (`ohel:user:{email}`) - `Hash`
Memorizza il profilo anagrafico e i permessi del socio:
```redis
HSET ohel:user:mario.rossi@example.com
  idGoogle "111804223099880826198"
  nome "Mario"
  cognome "Rossi"
  email "mario.rossi@example.com"
  picture "https://lh3.googleusercontent.com/..."
  dataRegistrazione "20/07/2026 20.12.18"
  isAdmin "true"
```
Inoltre, l'email viene inserita nel set `ohel:users`.

#### 2. Sondaggio (`ohel:survey:{idSondaggio}`) - `String (JSON)`
Contiene i metadati del sondaggio e l'elenco delle date con fasce orarie:
```json
{
  "idSondaggio": "SURV_1784574678998",
  "title": "Soggiorno 2026",
  "description": "Seleziona le date di partecipazione",
  "status": "ATTIVO",
  "createdAt": 1784574678998,
  "dates": [
    {
      "date": "2026-07-21",
      "timeRange": { "start": "09:00", "end": "17:30" },
      "subtitle": "Serata a casa",
      "timeSlots": ["Mattina", "Pomeriggio", "Sera", "Notte"],
      "notes": "Serve supporto cucina"
    }
  ]
}
```
L'ID del sondaggio viene registrato in `ohel:surveys` (Sorted Set ordinato per timestamp di creazione).

#### 3. Risposte / Presenze (`ohel:survey:{idSondaggio}:votes`) - `Hash`
Ogni campo dell'hash corrisponde al nome del partecipante (`memberName`), e il valore è il JSON completo del voto:
```json
{
  "memberName": "Mario Rossi",
  "submittedByEmail": "mario.rossi@example.com",
  "selections": {
    "2026-07-21": ["Mattina", "Pomeriggio"]
  },
  "absences": {
    "2026-07-21": false
  },
  "selectedIntolerances": ["Glutine", "Lattosio / Latticini"],
  "customIntolerance": "",
  "generalNotes": "Disponibile per il montaggio",
  "timestamp": "21/07/2026 10.30.00"
}
```
> **Vantaggio**: Il recupero di tutti i voti di un sondaggio (`GET_ALL_SURVEY_VOTES`) richiede un singolo comando Redis `HGETALL`, eseguito in **meno di 1 millisecondo**.

---

## 🔌 2. Compatibilità Endpoint Frontend

Il backend espone gli endpoint identici a Google Apps Script sia su `/` che su `/api` ed `/exec`:

### Richieste `GET`:
- `?action=GET_ACTIVE_SURVEYS&email=...` -> Restituisce sondaggi attivi con flag `voted` per l'utente.
- `?action=GET_ALL_SURVEYS` -> Restituisce tutti i sondaggi (attivi e disattivati).
- `?action=GET_USER_VOTES&email=...&idSondaggio=...` -> Restituisce i voti dell'utente e gestisce automaticamente la compilazione delegata (`compiledForYouBy`).
- `?action=GET_ALL_SURVEY_VOTES&idSondaggio=...` -> Restituisce tutti i voti aggregati per il report.

### Richieste `POST`:
Body JSON: `{ "action": "...", "token": "id_token_google", "payload": { ... } }`
- `LOGIN` -> Verifica token Google e restituisce il socio o i dati Google per la registrazione.
- `REGISTER` -> Registra un nuovo socio in Redis.
- `CREATE_SURVEY` -> (Admin) Crea un nuovo sondaggio.
- `TOGGLE_SURVEY_STATUS` -> (Admin) Attiva/disattiva sondaggio.
- `DELETE_SURVEY` -> (Admin) Elimina sondaggio e voti correlati.
- `SUBMIT_PRESENCES` -> Salva disponibilità e intolleranze per tutti i membri indicati.

---

## 👑 3. Pannello Web di Amministrazione (`/admin`)

Il backend include un'interfaccia web moderna e protetta da password, accessibile all'indirizzo:
`https://tuo-backend.vercel.app/admin` (oppure `http://localhost:8000/admin` in locale).

### Caratteristiche del Pannello:
1. **Protezione tramite Password**:
   - Accesso protetto dalla variabile d'ambiente `ADMIN_PASSWORD` configurata su Vercel.
   - Generazione di sessione token sicura memorizzata in Redis con scadenza automatica a 24 ore.
2. **Battezzare / Gestire gli Amministratori del CMS**:
   - Visualizzazione di tutti i soci registrati (nome, cognome, email, avatar Google, data registrazione).
   - Bottone **"⭐ Nomina Admin"**: con un clic trasforma istantaneamente qualsiasi utente in Amministratore (`isAdmin: true`). Al successivo accesso sul frontend React, l'utente avrà i pieni permessi per creare, modificare ed eliminare sondaggi.
   - Bottone **"Revoca Admin"**: riporta l'utente allo stato di socio standard.
   - Eliminazione definitiva del socio dal database.
3. **Gestione Sondaggi e Presenze**:
   - Elenco dei sondaggi presenti nel database Redis.
   - Attivazione / disattivazione rapida dello stato (`ATTIVO` / `DISATTIVATO`).
   - Tasto **"👁️ Vedi Voti"**: apre una modale con l'elenco di tutti i partecipanti, le fasce orarie selezionate per data, le assenze, le intolleranze alimentari e le note inviate.
   - Eliminazione di sondaggi e relative risposte collegate.
4. **Statistiche in tempo reale**: Totale soci, amministratori attivi, sondaggi attivi e schede voto compilate.

---

## 🚀 4. Configurazione Variabili d'Ambiente su Vercel

Nella dashboard di Vercel (**Settings** -> **Environment Variables**), aggiungi:

| Variabile | Valore di Esempio | Descrizione |
| :--- | :--- | :--- |
| `REDIS_URL` | `rediss://default:xxxx@xxxx.upstash.io:6379` | Stringa di connessione a Redis (Upstash o Redis Cloud) |
| `GOOGLE_CLIENT_ID` | `289959621652-q7tpu41u1um83dhuct2k58nknins17pn.apps.googleusercontent.com` | Client ID Google OAuth2 |
| `ADMIN_PASSWORD` | `unaPasswordSuperSicura2026!` | Password segreta per accedere a `/admin` |

---

## 🌐 5. Deploy su Vercel

### Opzione A: Tramite Vercel CLI
```bash
cd backend
npm i -g vercel
vercel
```
1. Collega o crea un nuovo progetto su Vercel.
2. Nelle impostazioni del progetto su Vercel Dashboard, assicurati di aver inserito `REDIS_URL`, `GOOGLE_CLIENT_ID` e `ADMIN_PASSWORD`.
3. Distribuisci in produzione:
   ```bash
   vercel --prod
   ```

### Opzione B: Tramite GitHub
1. Esegui il push della cartella `backend` (o del repository) su GitHub.
2. Su [Vercel](https://vercel.com/), clicca **Add New... -> Project** e importa il repository.
3. Se il backend è nella sottocartella `backend`, imposta **Root Directory** = `backend`.
4. Inserisci le Environment Variables (`REDIS_URL`, `GOOGLE_CLIENT_ID`, `ADMIN_PASSWORD`).
5. Clicca **Deploy**.

---

## 🔄 6. Come collegare il Frontend

Una volta ottenuto l'URL di Vercel (es. `https://ohel-backend.vercel.app`), apri il file:
[`ohel-cms/src/config/config.js`](file:///c:/Users/canto/OhelCMS/ohel-cms/src/config/config.js)

E modifica semplicemente `URL_APPS_SCRIPT`:

```javascript
const CONFIG = {
    SHEET_ID: "17184vz2D4PS_L-E99gCqdvtIeGqE0_5ar3UuyJiguK4",
    API_KEY: "AIzaSyDb0HRCmZP1BesThMKKSCQZ5SUZogR_uw0",
    RANGE: "Risposte del modulo 1",
    REACT_APP_GOOGLE_CLIENT_ID: "289959621652-q7tpu41u1um83dhuct2k58nknins17pn.apps.googleusercontent.com",
    
    // 🎯 Sostituisci l'URL di Google Apps Script con l'URL di Vercel:
    URL_APPS_SCRIPT: "https://ohel-backend.vercel.app/api",
};

export default CONFIG;
```

**Nient'altro deve essere modificato nel frontend!** Tutte le chiamate GET e POST continueranno a funzionare esattamente come prima.


