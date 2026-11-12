"""
Template HTML/CSS/JS per la Dashboard Amministratore di OhelCMS
==============================================================
Completamente autonomo, reattivo e moderno con Tailwind CSS.
Include autenticazione a password, gestione soci, promozione admin,
gestione sondaggi e consultazione voti.
"""

def get_admin_html() -> str:
    return """<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OhelCMS - Pannello Amministrazione</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
          },
          colors: {
            brand: {
              50: '#eef2ff',
              100: '#e0e7ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
            }
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .fade-in { animation: fadeIn 0.25s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col">

  <!-- ================= NOTIFICHE TOAST ================= -->
  <div id="toast" class="fixed top-5 right-5 z-50 transform transition-all duration-300 translate-y-[-100px] opacity-0 pointer-events-none flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white font-medium text-sm">
    <i id="toast-icon" class="fas fa-check-circle text-lg"></i>
    <span id="toast-msg">Operazione completata</span>
  </div>

  <!-- ================= 1. VISTA LOGIN ================= -->
  <div id="view-login" class="flex-1 flex items-center justify-center p-4">
    <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xl w-full max-w-md p-8 fade-in">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-brand-100">
          <i class="fas fa-shield-halved text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">OhelCMS Admin Portal</h1>
        <p class="text-slate-500 text-sm mt-1">Pannello di controllo e gestione database Redis</p>
      </div>

      <div id="login-error" class="hidden mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2">
        <i class="fas fa-circle-exclamation text-rose-500 text-sm"></i>
        <span id="login-error-text">Password non corretta.</span>
      </div>

      <form id="form-login" onsubmit="handleLogin(event)" class="space-y-5">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Password Amministratore</label>
          <div class="relative">
            <input 
              type="password" 
              id="input-password" 
              required 
              placeholder="Inserisci la password di amministrazione..." 
              class="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition"
            >
            <button type="button" onclick="togglePasswordVis()" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <i id="eye-icon" class="fas fa-eye text-sm"></i>
            </button>
          </div>
          <p class="text-[11px] text-slate-400 mt-2">Configurata nella variabile d'ambiente <code>ADMIN_PASSWORD</code> su Vercel.</p>
        </div>

        <!-- Gruppo Campo Codice MFA Authenticator -->
        <div id="mfa-field-group" class="hidden space-y-1 fade-in">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600">Codice App Authenticator (2FA)</label>
            <span class="text-[10px] text-brand-600 font-medium">6 cifre temporanee</span>
          </div>
          <input 
            type="text" 
            id="input-otp" 
            maxlength="6" 
            inputmode="numeric" 
            pattern="[0-9]*" 
            placeholder="es. 123456" 
            autocomplete="one-time-code"
            class="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-base tracking-widest text-center font-mono font-bold transition"
          >
          <p class="text-[11px] text-slate-400">Inserisci il codice mostrato su Google Authenticator o Microsoft Authenticator.</p>
        </div>

        <button 
          type="submit" 
          id="btn-login"
          class="w-full py-3.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
        >
          <span>Accedi al Database</span>
          <i class="fas fa-arrow-right text-xs"></i>
        </button>
      </form>
    </div>
  </div>

  <!-- ================= 2. VISTA DASHBOARD ================= -->
  <div id="view-dashboard" class="hidden flex-1 flex flex-col">
    <!-- Topbar -->
    <header class="bg-white border-b border-slate-200/80 sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center font-bold text-base border border-brand-100">
            <i class="fas fa-cube"></i>
          </div>
          <div>
            <span class="font-bold text-slate-900 text-base leading-none block">OhelCMS</span>
            <span class="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Backend Redis Online
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <button id="btn-mfa-badge" onclick="openMfaSetupModal()" class="px-3 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200">
            <i id="mfa-badge-icon" class="fas fa-shield-halved text-slate-500"></i>
            <span id="mfa-badge-text">2FA Authenticator</span>
          </button>
          <button onclick="loadDashboardData()" class="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5">
            <i class="fas fa-arrows-rotate"></i>
            <span class="hidden sm:inline">Aggiorna Dati</span>
          </button>
          <button onclick="handleLogout()" class="px-3.5 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-lg transition flex items-center gap-1.5">
            <i class="fas fa-right-from-bracket"></i>
            <span>Esci</span>
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
      
      <!-- Sezione Statistiche Rapide -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <!-- Totale Soci -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
            <i class="fas fa-users"></i>
          </div>
          <div>
            <div id="stat-total-users" class="text-xl sm:text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Soci Registrati</div>
          </div>
        </div>

        <!-- Admin CMS -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shrink-0">
            <i class="fas fa-crown"></i>
          </div>
          <div>
            <div id="stat-admin-users" class="text-xl sm:text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Admin CMS</div>
          </div>
        </div>

        <!-- Sondaggi Attivi -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
            <i class="fas fa-calendar-check"></i>
          </div>
          <div>
            <div id="stat-active-surveys" class="text-xl sm:text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Sondaggi Attivi</div>
          </div>
        </div>

        <!-- Totale Risposte -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg shrink-0">
            <i class="fas fa-envelope-open-text"></i>
          </div>
          <div>
            <div id="stat-total-votes" class="text-xl sm:text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Schede Voto</div>
          </div>
        </div>

        <!-- Log Attività (30gg) -->
        <div onclick="switchTab('logs')" class="cursor-pointer hover:border-brand-500/50 transition bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-3.5 col-span-2 sm:col-span-1">
          <div class="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg shrink-0">
            <i class="fas fa-clock-rotate-left"></i>
          </div>
          <div>
            <div id="stat-total-logs" class="text-xl sm:text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Log (30 giorni)</div>
          </div>
        </div>
      </div>

      <!-- Barra di Navigazione Tab -->
      <div class="flex items-center gap-2 border-b border-slate-200">
        <button onclick="switchTab('users')" id="tab-btn-users" class="px-5 py-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 transition flex items-center gap-2">
          <i class="fas fa-user-gear"></i>
          <span>Gestione Soci & Admin</span>
          <span id="badge-users-count" class="ml-1.5 px-2 py-0.5 text-xs bg-brand-50 text-brand-700 rounded-full font-bold">0</span>
        </button>
        <button onclick="switchTab('surveys')" id="tab-btn-surveys" class="px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center gap-2">
          <i class="fas fa-list-check"></i>
          <span>Sondaggi & Presenze</span>
          <span id="badge-surveys-count" class="ml-1.5 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-bold">0</span>
        </button>
        <button onclick="switchTab('logs')" id="tab-btn-logs" class="px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center gap-2">
          <i class="fas fa-clock-rotate-left"></i>
          <span>Log Attività</span>
          <span id="badge-logs-count" class="ml-1.5 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-bold">0</span>
        </button>
      </div>

      <!-- ================= CONTENUTO TAB 1: GESTIONE SOCI ================= -->
      <section id="tab-content-users" class="space-y-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Elenco Soci dell'Associazione</h2>
            <p class="text-xs text-slate-500">Promuovi un socio ad Amministratore per consentirgli di creare e gestire i sondaggi nel Frontend React.</p>
          </div>
          <div class="relative w-full sm:w-72">
            <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
              type="text" 
              id="search-users" 
              oninput="filterUsers()" 
              placeholder="Cerca per nome, email..." 
              class="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            >
          </div>
        </div>

        <!-- Tabella Soci -->
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th class="px-5 py-3.5">Socio</th>
                  <th class="px-5 py-3.5">Email</th>
                  <th class="px-5 py-3.5">Data Registrazione</th>
                  <th class="px-5 py-3.5">Ruolo CMS</th>
                  <th class="px-5 py-3.5 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody id="users-table-body" class="divide-y divide-slate-100">
                <!-- Generato dinamicamente via JS -->
              </tbody>
            </table>
          </div>
          <div id="users-empty" class="hidden p-8 text-center text-slate-400 text-sm">
            <i class="fas fa-user-slash text-2xl mb-2 block"></i>
            Nessun socio trovato.
          </div>
        </div>
      </section>

      <!-- ================= CONTENUTO TAB 2: SONDAGGI ================= -->
      <section id="tab-content-surveys" class="hidden space-y-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Sondaggi e Presenze</h2>
            <p class="text-xs text-slate-500">Visualizza i sondaggi nel db Redis, attiva/disattiva e ispeziona tutte le preferenze espresse.</p>
          </div>
          <div class="flex items-center gap-2">
            <select id="filter-survey-status" onchange="renderSurveys()" class="text-xs rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500">
              <option value="ALL">Tutti gli stati</option>
              <option value="ATTIVO">Solo Attivi</option>
              <option value="DISATTIVATO">Solo Disattivati</option>
            </select>
          </div>
        </div>

        <div id="surveys-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Card sondaggi generate via JS -->
        </div>

        <div id="surveys-empty" class="hidden p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
          <i class="fas fa-calendar-xmark text-3xl mb-2 block"></i>
          Nessun sondaggio presente nel database.
        </div>
      </section>

      <!-- ================= CONTENUTO TAB 3: LOG ATTIVITÀ (RETENTION 30 GG) ================= -->
      <section id="tab-content-logs" class="hidden space-y-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-slate-900">Registro Attività e Audit (Frontend & Backend)</h2>
              <span class="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                <i class="fas fa-history text-[10px]"></i> Auto-cancellazione 30 gg
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">Tracciamento cronologico di accessi, modifiche ai sondaggi, votazioni e operazioni amministrative.</p>
          </div>
          
          <div class="flex flex-wrap items-center gap-2">
            <div class="relative w-full sm:w-56">
              <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input 
                type="text" 
                id="search-logs" 
                oninput="filterLogs()" 
                placeholder="Cerca azione, utente, IP..." 
                class="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
              >
            </div>
            <select id="filter-logs-source" onchange="filterLogs()" class="text-xs rounded-xl border border-slate-300 px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-500">
              <option value="ALL">Tutte le sorgenti</option>
              <option value="backend">Solo Backend ⚙️</option>
              <option value="frontend">Solo Frontend 🌐</option>
            </select>
            <select id="filter-logs-level" onchange="filterLogs()" class="text-xs rounded-xl border border-slate-300 px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-500">
              <option value="ALL">Tutti i livelli</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
            <button onclick="fetchLogs()" title="Ricarica Log" class="p-2 text-xs font-semibold text-slate-600 hover:text-brand-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 px-3">
              <i class="fas fa-rotate"></i>
              <span class="hidden sm:inline">Aggiorna</span>
            </button>
            <button onclick="clearAllLogs()" title="Svuota tutti i log" class="p-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition flex items-center gap-1.5 px-3">
              <i class="fas fa-trash-can"></i>
              <span class="hidden sm:inline">Svuota</span>
            </button>
          </div>
        </div>

        <!-- Tabella Log -->
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th class="px-4 py-3.5 whitespace-nowrap">Data / Ora</th>
                  <th class="px-4 py-3.5 whitespace-nowrap">Sorgente</th>
                  <th class="px-4 py-3.5 whitespace-nowrap">Livello</th>
                  <th class="px-4 py-3.5 whitespace-nowrap">Azione</th>
                  <th class="px-4 py-3.5 whitespace-nowrap">Utente / IP</th>
                  <th class="px-4 py-3.5">Dettagli Operazione</th>
                </tr>
              </thead>
              <tbody id="logs-table-body" class="divide-y divide-slate-100">
                <!-- Generato dinamicamente via JS -->
              </tbody>
            </table>
          </div>
          <div id="logs-empty" class="hidden p-12 text-center text-slate-400 text-sm">
            <i class="fas fa-clock-rotate-left text-3xl mb-2 block"></i>
            Nessun evento registrato nella finestra di 30 giorni.
          </div>
          <div class="p-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span id="logs-counter">Visualizzati 0 log</span>
            <span class="text-slate-400">Politica di retention: eliminazione automatica oltre 30 giorni (TTL Redis)</span>
          </div>
        </div>
      </section>

    </main>
  </div>

  <!-- ================= MODALE DETTAGLIO VOTI ================= -->
  <div id="modal-votes" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200 fade-in">
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 id="modal-survey-title" class="text-base font-bold text-slate-900">Dettaglio Presenze Sondaggio</h3>
          <p id="modal-survey-subtitle" class="text-xs text-slate-500">ID: SURV_123456</p>
        </div>
        <button onclick="closeVotesModal()" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition">
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>

      <div id="modal-votes-content" class="p-6 overflow-y-auto divide-y divide-slate-100 space-y-4">
        <!-- Schede voti generate via JS -->
      </div>

      <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex justify-end">
        <button onclick="closeVotesModal()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition">
          Chiudi
        </button>
      </div>
    </div>
  </div>

  <!-- ================= MODALE MODIFICA SONDAGGIO ================= -->
  <div id="modal-edit-survey" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 fade-in">
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 id="modal-edit-title" class="text-base font-bold text-slate-900">Modifica Sondaggio</h3>
          <p id="modal-edit-id" class="text-xs text-slate-500 font-mono">ID: SURV_123456</p>
        </div>
        <button onclick="closeEditSurveyModal()" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition">
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>

      <form id="form-edit-survey" onsubmit="submitEditSurvey(event)" class="p-6 overflow-y-auto space-y-4">
        <input type="hidden" id="edit-survey-id">

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Titolo Sondaggio / Periodo *</label>
          <input 
            type="text" 
            id="edit-survey-title" 
            required 
            class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
          >
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Descrizione / Note per i soci</label>
          <textarea 
            id="edit-survey-desc" 
            rows="2" 
            class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Stato</label>
            <select id="edit-survey-status" class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="ATTIVO">ATTIVO</option>
              <option value="DISATTIVATO">DISATTIVATO</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Autore / Pubblicato Da</label>
            <input type="text" id="edit-survey-creator" disabled class="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-500 outline-none">
          </div>
        </div>

        <!-- Sezione Date -->
        <div class="pt-3 border-t border-slate-200">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <i class="fas fa-calendar-days text-brand-600"></i> Date Configurate (<span id="edit-dates-count">0</span>)
            </h4>
            <button 
              type="button" 
              onclick="addEditDateRow()" 
              class="px-2.5 py-1 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition flex items-center gap-1"
            >
              <i class="fas fa-plus text-[10px]"></i> Aggiungi Data
            </button>
          </div>

          <div id="edit-dates-list" class="space-y-3">
            <!-- Righe date generate via JS -->
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button 
            type="button" 
            onclick="closeEditSurveyModal()" 
            class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition"
          >
            Annulla
          </button>
          <button 
            type="submit" 
            id="btn-save-edit-survey" 
            class="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-500/20 transition flex items-center gap-1.5"
          >
            <i class="fas fa-save text-xs"></i>
            <span>Salva Modifiche</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- ================= MODALE CONFIGURAZIONE 2FA / AUTHENTICATOR ================= -->
  <div id="modal-mfa-setup" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col border border-slate-200 fade-in">
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-sm font-bold border border-brand-100">
            <i class="fas fa-shield-halved"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 leading-tight">Configura App Authenticator (2FA)</h3>
            <p class="text-[11px] text-slate-500">Google Authenticator, Microsoft Authenticator o 1Password</p>
          </div>
        </div>
        <button onclick="closeMfaSetupModal()" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition">
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>

      <div class="p-6 space-y-4">
        <!-- Passaggio 1: QR Code -->
        <div class="text-center">
          <span class="text-xs font-bold text-slate-700 block mb-1">Passo 1: Inquadra il QR Code con l'app</span>
          <p class="text-[11px] text-slate-400 mb-3">Apri l'app Authenticator sul tuo smartphone e inquadra:</p>
          <div class="inline-block p-2 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-sm">
            <img id="mfa-qr-img" class="w-44 h-44 rounded-xl mx-auto" alt="QR Code MFA" src="">
          </div>
        </div>

        <!-- Chiave Manuale alternativa -->
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div class="flex items-center justify-between text-[11px] text-slate-600 mb-1">
            <span class="font-semibold">Oppure inserisci la chiave manualmente:</span>
            <button type="button" onclick="copyMfaSecret()" class="text-brand-600 hover:text-brand-800 font-bold flex items-center gap-1 text-[10px]">
              <i class="fas fa-copy"></i> Copia
            </button>
          </div>
          <code id="mfa-secret-text" class="text-xs font-mono font-bold text-slate-800 tracking-wider block select-all break-all text-center bg-white px-2 py-1.5 rounded-lg border border-slate-200"></code>
        </div>

        <!-- Passaggio 2: Conferma codice -->
        <div class="pt-2 border-t border-slate-100">
          <label class="block text-xs font-bold text-slate-700 mb-1 text-center">Passo 2: Inserisci il codice a 6 cifre mostrato sull'app</label>
          <input 
            type="text" 
            id="mfa-setup-code" 
            maxlength="6" 
            inputmode="numeric" 
            pattern="[0-9]*" 
            placeholder="123456" 
            class="w-full text-center tracking-widest font-mono text-lg font-bold px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
          >
        </div>
      </div>

      <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-between">
        <button 
          type="button"
          id="btn-disable-mfa" 
          onclick="disableMfa()" 
          class="hidden px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition"
        >
          Disattiva 2FA
        </button>
        <div class="flex items-center gap-2 ml-auto">
          <button type="button" onclick="closeMfaSetupModal()" class="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition">
            Annulla
          </button>
          <button 
            type="button"
            id="btn-confirm-mfa" 
            onclick="confirmMfaSetup()" 
            class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-500/20 transition flex items-center gap-1.5"
          >
            <i class="fas fa-check"></i>
            <span>Verifica & Attiva 2FA</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ================= LOGICA APPLICATIVA JAVASCRIPT ================= -->
  <script>
    let currentToken = sessionStorage.getItem("ohel_admin_token") || "";
    let cachedUsers = [];
    let cachedSurveys = [];
    let cachedLogs = [];

    window.addEventListener("DOMContentLoaded", () => {
      if (currentToken) {
        showDashboard();
        loadDashboardData();
      } else {
        showLogin();
        checkMfaInitialStatus();
      }
    });

    async function checkMfaInitialStatus() {
      try {
        const res = await fetch("/api/admin/mfa/status");
        const data = await res.json();
        if (data.status === "success" && data.mfaConfigured) {
          document.getElementById("mfa-field-group").classList.remove("hidden");
        }
      } catch (e) {}
    }

    function togglePasswordVis() {
      const inp = document.getElementById("input-password");
      const icon = document.getElementById("eye-icon");
      if (inp.type === "password") {
        inp.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        inp.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
      }
    }

    function showToast(msg, isError = false) {
      const toast = document.getElementById("toast");
      const toastMsg = document.getElementById("toast-msg");
      const toastIcon = document.getElementById("toast-icon");

      toastMsg.innerText = msg;
      toast.className = `fixed top-5 right-5 z-50 transform transition-all duration-300 translate-y-0 opacity-100 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white font-medium text-sm ${
        isError ? "bg-rose-600" : "bg-emerald-600"
      }`;
      toastIcon.className = isError ? "fas fa-circle-exclamation text-lg" : "fas fa-check-circle text-lg";

      setTimeout(() => {
        toast.classList.replace("translate-y-0", "translate-y-[-100px]");
        toast.classList.replace("opacity-100", "opacity-0");
      }, 3500);
    }

    function showLogin() {
      document.getElementById("view-login").classList.remove("hidden");
      document.getElementById("view-dashboard").classList.add("hidden");
    }

    function showDashboard() {
      document.getElementById("view-login").classList.add("hidden");
      document.getElementById("view-dashboard").classList.remove("hidden");
    }

    async function handleLogin(e) {
      e.preventDefault();
      const pwd = document.getElementById("input-password").value;
      const otp = (document.getElementById("input-otp").value || "").trim();
      const btn = document.getElementById("btn-login");
      const errBox = document.getElementById("login-error");
      const mfaGroup = document.getElementById("mfa-field-group");

      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Verifica in corso...</span>`;
      errBox.classList.add("hidden");

      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd, otpCode: otp })
        });
        const data = await res.json();

        if (data.status === "mfa_required") {
          mfaGroup.classList.remove("hidden");
          const otpInput = document.getElementById("input-otp");
          otpInput.required = true;
          otpInput.focus();
          btn.innerHTML = `<span>Conferma Codice & Accedi</span><i class="fas fa-shield-halved text-xs"></i>`;
          showToast("Inserisci il codice temporaneo a 6 cifre dall'App Authenticator", false);
          return;
        }

        if (data.status === "success" && data.token) {
          currentToken = data.token;
          sessionStorage.setItem("ohel_admin_token", currentToken);
          showToast("Autenticazione riuscita!");
          mfaGroup.classList.add("hidden");
          document.getElementById("input-otp").value = "";
          showDashboard();
          loadDashboardData();
        } else {
          errBox.classList.remove("hidden");
          document.getElementById("login-error-text").innerText = data.message || "Credenziali errate.";
        }
      } catch (err) {
        errBox.classList.remove("hidden");
        document.getElementById("login-error-text").innerText = "Errore di connessione al server.";
      } finally {
        btn.disabled = false;
        if (!document.getElementById("mfa-field-group").classList.contains("hidden")) {
          btn.innerHTML = `<span>Conferma Codice & Accedi</span><i class="fas fa-shield-halved text-xs"></i>`;
        } else {
          btn.innerHTML = `<span>Accedi al Database</span><i class="fas fa-arrow-right text-xs"></i>`;
        }
      }
    }

    async function handleLogout() {
      try {
        await fetch("/api/admin/logout", {
          method: "POST",
          headers: { "Authorization": `Bearer ${currentToken}` }
        });
      } catch (e) {}
      sessionStorage.removeItem("ohel_admin_token");
      currentToken = "";
      showToast("Sessione chiusa.");
      showLogin();
    }

    async function loadDashboardData() {
      try {
        const res = await fetch("/api/admin/dashboard", {
          headers: { "Authorization": `Bearer ${currentToken}` }
        });
        const data = await res.json();

        if (data.status === "unauthorized") {
          handleLogout();
          return;
        }

        if (data.status === "success") {
          cachedUsers = data.users || [];
          cachedSurveys = data.surveys || [];
          cachedLogs = data.logs || [];

          // Aggiorna statistiche
          document.getElementById("stat-total-users").innerText = data.stats.totalUsers;
          document.getElementById("stat-admin-users").innerText = data.stats.adminUsers;
          document.getElementById("stat-active-surveys").innerText = data.stats.activeSurveys;
          document.getElementById("stat-total-votes").innerText = data.stats.totalVotes;
          const statTotalLogsEl = document.getElementById("stat-total-logs");
          if (statTotalLogsEl) {
            statTotalLogsEl.innerText = data.stats.totalLogs !== undefined ? data.stats.totalLogs : cachedLogs.length;
          }

          document.getElementById("badge-users-count").innerText = cachedUsers.length;
          document.getElementById("badge-surveys-count").innerText = cachedSurveys.length;
          document.getElementById("badge-logs-count").innerText = data.stats.totalLogs !== undefined ? data.stats.totalLogs : cachedLogs.length;

          renderUsers(cachedUsers);
          renderSurveys();
          renderLogs(cachedLogs);

          if (data.mfa) {
            updateMfaBadge(data.mfa.active, data.mfa.enforcedByEnv);
          }
        }
      } catch (err) {
        showToast("Impossibile caricare i dati della dashboard", true);
      }
    }

    function switchTab(tab) {
      const uBtn = document.getElementById("tab-btn-users");
      const sBtn = document.getElementById("tab-btn-surveys");
      const lBtn = document.getElementById("tab-btn-logs");
      const uContent = document.getElementById("tab-content-users");
      const sContent = document.getElementById("tab-content-surveys");
      const lContent = document.getElementById("tab-content-logs");

      [uBtn, sBtn, lBtn].forEach(b => {
        if (b) b.className = "px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center gap-2";
      });
      [uContent, sContent, lContent].forEach(c => {
        if (c) c.classList.add("hidden");
      });

      if (tab === "users") {
        uBtn.className = "px-5 py-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 transition flex items-center gap-2";
        uContent.classList.remove("hidden");
      } else if (tab === "surveys") {
        sBtn.className = "px-5 py-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 transition flex items-center gap-2";
        sContent.classList.remove("hidden");
      } else if (tab === "logs") {
        lBtn.className = "px-5 py-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 transition flex items-center gap-2";
        lContent.classList.remove("hidden");
        if (!cachedLogs || !cachedLogs.length) {
          fetchLogs();
        }
      }
    }

    function renderLogs(logs) {
      const tbody = document.getElementById("logs-table-body");
      const empty = document.getElementById("logs-empty");
      const counter = document.getElementById("logs-counter");
      tbody.innerHTML = "";

      if (!logs || !logs.length) {
        empty.classList.remove("hidden");
        if (counter) counter.innerText = "Nessun log trovato";
        return;
      }
      empty.classList.add("hidden");
      if (counter) counter.innerText = `Visualizzati ${logs.length} log (ultimi 30 giorni)`;

      logs.forEach(lg => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/70 transition";

        // Sorgente
        const isFrontend = (lg.source || "").toLowerCase() === "frontend";
        const sourceBadge = isFrontend
          ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200"><i class="fas fa-globe text-[9px]"></i>Frontend</span>`
          : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"><i class="fas fa-server text-[9px]"></i>Backend</span>`;

        // Livello
        const lvl = (lg.level || "INFO").toUpperCase();
        let lvlBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">${lvl}</span>`;
        if (lvl === "SUCCESS") {
          lvlBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">SUCCESS</span>`;
        } else if (lvl === "WARNING") {
          lvlBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">WARN</span>`;
        } else if (lvl === "ERROR") {
          lvlBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">ERROR</span>`;
        }

        // Utente / IP
        const userDisplay = lg.userName ? `${lg.userName} <span class="text-slate-400">(${lg.userEmail})</span>` : lg.userEmail;
        const ipDisplay = lg.ip ? `<span class="text-[10px] font-mono text-slate-400 block">${lg.ip}</span>` : "";

        tr.innerHTML = `
          <td class="px-4 py-3 whitespace-nowrap font-mono text-slate-600">${lg.timestamp || ""}</td>
          <td class="px-4 py-3 whitespace-nowrap">${sourceBadge}</td>
          <td class="px-4 py-3 whitespace-nowrap">${lvlBadge}</td>
          <td class="px-4 py-3 whitespace-nowrap"><code class="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px] font-semibold">${lg.action || ""}</code></td>
          <td class="px-4 py-3 whitespace-nowrap">
            <span class="font-medium text-slate-800 block">${userDisplay}</span>
            ${ipDisplay}
          </td>
          <td class="px-4 py-3 text-slate-700 max-w-md break-words">${lg.description || ""}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function filterLogs() {
      const q = (document.getElementById("search-logs").value || "").toLowerCase().trim();
      const source = (document.getElementById("filter-logs-source").value || "ALL").toLowerCase();
      const level = (document.getElementById("filter-logs-level").value || "ALL").toUpperCase();

      const filtered = cachedLogs.filter(lg => {
        if (source !== "all" && (lg.source || "").toLowerCase() !== source) return false;
        if (level !== "ALL" && (lg.level || "INFO").toUpperCase() !== level) return false;
        if (q) {
          const match = (lg.description || "").toLowerCase().includes(q)
            || (lg.action || "").toLowerCase().includes(q)
            || (lg.userEmail || "").toLowerCase().includes(q)
            || (lg.userName || "").toLowerCase().includes(q)
            || (lg.ip || "").toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });

      renderLogs(filtered);
    }

    async function fetchLogs() {
      try {
        const res = await fetch("/api/admin/logs?limit=300", {
          headers: { "Authorization": `Bearer ${currentToken}` }
        });
        const data = await res.json();
        if (data.status === "success" && Array.isArray(data.logs)) {
          cachedLogs = data.logs;
          document.getElementById("badge-logs-count").innerText = data.total !== undefined ? data.total : cachedLogs.length;
          filterLogs();
          showToast("Log aggiornati con successo!");
        } else {
          showToast(data.message || "Impossibile recuperare i log", true);
        }
      } catch (err) {
        showToast("Errore di rete nel recupero dei log", true);
      }
    }

    async function clearAllLogs() {
      if (!confirm("ATTENZIONE: Sei sicuro di voler eliminare definitivamente tutti i log registrati nel database? L'operazione non può essere annullata.")) {
        return;
      }
      try {
        const res = await fetch("/api/admin/logs/clear", {
          method: "POST",
          headers: { "Authorization": `Bearer ${currentToken}` }
        });
        const data = await res.json();
        if (data.status === "success") {
          showToast(data.message || "Log eliminati con successo!");
          cachedLogs = [];
          document.getElementById("badge-logs-count").innerText = "0";
          renderLogs([]);
        } else {
          showToast(data.message || "Errore nella cancellazione dei log", true);
        }
      } catch (err) {
        showToast("Errore di rete durante l'eliminazione dei log", true);
      }
    }

    function renderUsers(users) {
      const tbody = document.getElementById("users-table-body");
      const empty = document.getElementById("users-empty");
      tbody.innerHTML = "";

      if (!users.length) {
        empty.classList.remove("hidden");
        return;
      }
      empty.classList.add("hidden");

      users.forEach(u => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/70 transition";

        const isAdmin = !!u.isAdmin;
        const initials = `${(u.nome || "?")[0]}${(u.cognome || "")[0] || ""}`.toUpperCase();
        const avatarHtml = u.picture 
          ? `<img src="${u.picture}" alt="" class="w-8 h-8 rounded-full object-cover border border-slate-200">`
          : `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-xs">${initials}</div>`;

        tr.innerHTML = `
          <td class="px-5 py-3.5">
            <div class="flex items-center gap-3">
              ${avatarHtml}
              <div>
                <span class="font-bold text-slate-900 block text-sm">${u.nome} ${u.cognome}</span>
              </div>
            </div>
          </td>
          <td class="px-5 py-3.5 text-slate-600 font-mono text-[11px]">${u.email}</td>
          <td class="px-5 py-3.5 text-slate-500">${u.dataRegistrazione || "-"}</td>
          <td class="px-5 py-3.5">
            ${isAdmin 
              ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60"><i class="fas fa-crown text-[10px]"></i> AMMINISTRATORE</span>` 
              : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Socio Standard</span>`
            }
          </td>
          <td class="px-5 py-3.5 text-right">
            <div class="flex items-center justify-end gap-2">
              <button 
                onclick="toggleAdminStatus('${u.email}', ${!isAdmin})" 
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  isAdmin 
                    ? "bg-amber-100 hover:bg-amber-200 text-amber-800" 
                    : "bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                }"
                title="${isAdmin ? 'Revoca permessi da Amministratore' : 'Battezza come Amministratore del CMS'}"
              >
                <i class="fas ${isAdmin ? 'fa-user-minus' : 'fa-crown'} text-[11px]"></i>
                <span>${isAdmin ? 'Revoca Admin' : '⭐ Nomina Admin'}</span>
              </button>
              <button 
                onclick="deleteUser('${u.email}')" 
                class="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition flex items-center justify-center"
                title="Elimina socio"
              >
                <i class="fas fa-trash-can text-xs"></i>
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    function filterUsers() {
      const q = document.getElementById("search-users").value.toLowerCase().trim();
      const filtered = cachedUsers.filter(u => 
        (u.nome || "").toLowerCase().includes(q) ||
        (u.cognome || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
      renderUsers(filtered);
    }

    async function toggleAdminStatus(email, makeAdmin) {
      const actionName = makeAdmin ? "nominare Amministratore" : "revocare i permessi di Amministratore a";
      if (!confirm(`Sei sicuro di voler ${actionName} l'utente ${email}?`)) return;

      try {
        const res = await fetch("/api/admin/users/toggle-admin", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`
          },
          body: JSON.stringify({ email: email, isAdmin: makeAdmin })
        });
        const data = await res.json();
        if (data.status === "success") {
          showToast(data.message);
          loadDashboardData();
        } else {
          showToast(data.message || "Errore durante l'operazione", true);
        }
      } catch (err) {
        showToast("Errore di rete", true);
      }
    }

    async function deleteUser(email) {
      if (!confirm(`ATTENZIONE: Sei sicuro di voler eliminare definitivamente il socio ${email} dal database?`)) return;

      try {
        const res = await fetch("/api/admin/users/delete", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`
          },
          body: JSON.stringify({ email: email })
        });
        const data = await res.json();
        if (data.status === "success") {
          showToast(data.message);
          loadDashboardData();
        } else {
          showToast(data.message || "Errore durante l'eliminazione", true);
        }
      } catch (err) {
        showToast("Errore di rete", true);
      }
    }

    function renderSurveys() {
      const container = document.getElementById("surveys-container");
      const empty = document.getElementById("surveys-empty");
      const filter = document.getElementById("filter-survey-status").value;

      container.innerHTML = "";
      const filtered = cachedSurveys.filter(s => filter === "ALL" || s.status === filter);

      if (!filtered.length) {
        empty.classList.remove("hidden");
        return;
      }
      empty.classList.add("hidden");

      filtered.forEach(s => {
        const isAttivo = s.status === "ATTIVO";
        const datesCount = (s.dates || []).length;
        const votesCount = s.votesCount || 0;

        const card = document.createElement("div");
        card.className = "bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition";

        card.innerHTML = `
          <div>
            <div class="flex items-start justify-between gap-3 mb-2">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isAttivo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-500'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${isAttivo ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                ${s.status}
              </span>
              <span class="text-[11px] font-mono text-slate-400">${s.idSondaggio}</span>
            </div>
            <h3 class="text-base font-bold text-slate-900 leading-snug">${s.title}</h3>
            <p class="text-xs text-slate-500 mt-1 line-clamp-2">${s.description || "Nessuna descrizione specificata."}</p>
            
            <div class="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <span class="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <i class="fas fa-calendar-days text-slate-400"></i> ${datesCount} date configurate
              </span>
              <span class="bg-purple-50 text-purple-700 border border-purple-200/60 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5">
                <i class="fas fa-user-check text-purple-500"></i> ${votesCount} partecipanti
              </span>
              <span class="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5">
                <i class="fas fa-user-pen text-emerald-600"></i> ${s.createdByName || s.createdBy || 'Sistema'}
              </span>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <button 
                onclick="viewSurveyVotes('${s.idSondaggio}', '${s.title.replace(/'/g, "\\'")}')" 
                class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
              >
                <i class="fas fa-eye text-slate-500"></i>
                <span>Voti (${votesCount})</span>
              </button>
              <button 
                onclick="openEditSurveyModal('${s.idSondaggio}')" 
                class="px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-xl border border-brand-200/70 transition flex items-center gap-1.5"
              >
                <i class="fas fa-pen-to-square text-brand-600"></i>
                <span>Modifica</span>
              </button>
            </div>

            <div class="flex items-center gap-2">
              <button 
                onclick="toggleSurveyStatus('${s.idSondaggio}', '${isAttivo ? 'DISATTIVATO' : 'ATTIVO'}')" 
                class="px-3 py-2 text-xs font-semibold rounded-xl transition border ${
                  isAttivo 
                    ? 'border-amber-200 text-amber-700 hover:bg-amber-50' 
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }"
              >
                ${isAttivo ? 'Disattiva' : 'Attiva'}
              </button>
              <button 
                onclick="deleteSurvey('${s.idSondaggio}')" 
                class="w-8 h-8 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition flex items-center justify-center"
                title="Elimina sondaggio"
              >
                <i class="fas fa-trash-can text-xs"></i>
              </button>
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    async function toggleSurveyStatus(idSondaggio, newStatus) {
      try {
        const res = await fetch("/api/admin/surveys/toggle-status", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`
          },
          body: JSON.stringify({ idSondaggio: idSondaggio, newStatus: newStatus })
        });
        const data = await res.json();
        if (data.status === "success") {
          showToast(data.message);
          loadDashboardData();
        } else {
          showToast(data.message || "Errore aggiornamento stato", true);
        }
      } catch (err) {
        showToast("Errore di rete", true);
      }
    }

    async function deleteSurvey(idSondaggio) {
      if (!confirm(`ATTENZIONE: Eliminando il sondaggio ${idSondaggio} cancellerai definitivamente anche tutte le preferenze e risposte associate. Continuare?`)) return;

      try {
        const res = await fetch("/api/admin/surveys/delete", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`
          },
          body: JSON.stringify({ idSondaggio: idSondaggio })
        });
        const data = await res.json();
        if (data.status === "success") {
          showToast(data.message);
          loadDashboardData();
        } else {
          showToast(data.message || "Errore eliminazione sondaggio", true);
        }
      } catch (err) {
        showToast("Errore di rete", true);
      }
    }

    async function viewSurveyVotes(idSondaggio, title) {
      document.getElementById("modal-survey-title").innerText = title;
      document.getElementById("modal-survey-subtitle").innerText = `ID Sondaggio: ${idSondaggio}`;
      const content = document.getElementById("modal-votes-content");
      content.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin text-lg mb-2 block"></i>Caricamento voti da Redis...</div>`;
      document.getElementById("modal-votes").classList.remove("hidden");

      try {
        const res = await fetch(`/api/admin/surveys/${encodeURIComponent(idSondaggio)}/votes`, {
          headers: { "Authorization": `Bearer ${currentToken}` }
        });
        const data = await res.json();

        if (data.status === "success" && data.dataByMember) {
          const members = Object.keys(data.dataByMember);
          if (!members.length) {
            content.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Nessun membro ha ancora espresso preferenze per questo sondaggio.</div>`;
            return;
          }

          content.innerHTML = "";
          members.forEach(mName => {
            const m = data.dataByMember[mName];
            const div = document.createElement("div");
            div.className = "pt-3 first:pt-0";

            let selectionsHtml = "";
            const selDates = Object.keys(m.selections || {});
            if (selDates.length) {
              selectionsHtml = selDates.map(d => {
                const isAbs = m.absences && m.absences[d];
                if (isAbs) {
                  return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 text-rose-700 text-[11px] font-medium border border-rose-200/60"><i class="fas fa-xmark"></i> ${d}: ASSENTE</span>`;
                }
                const slots = (m.selections[d] || []).join(", ");
                return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-[11px] font-medium"><i class="fas fa-clock text-slate-400"></i> ${d}: ${slots || 'Presente'}</span>`;
              }).join(" ");
            } else {
              selectionsHtml = `<span class="text-slate-400 italic text-xs">Nessuna data selezionata</span>`;
            }

            const intol = (m.selectedIntolerances || []).filter(x => x && x !== "Nessuna").join(", ");

            div.innerHTML = `
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="font-bold text-slate-900 text-sm">${mName}</h4>
                  <p class="text-[11px] text-slate-400 font-mono">Inviato da: ${m.submittedByEmail || 'N/D'}</p>
                </div>
              </div>

              <div class="mt-2.5 flex flex-wrap gap-1.5">
                ${selectionsHtml}
              </div>

              ${intol ? `
                <div class="mt-2 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200/60 flex items-center gap-1.5">
                  <i class="fas fa-wheat-awn text-amber-600"></i>
                  <span><strong>Intolleranze / Dieta:</strong> ${intol}</span>
                </div>
              ` : ''}

              ${m.generalNotes ? `
                <div class="mt-2 text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-start gap-1.5">
                  <i class="fas fa-note-sticky text-slate-400 mt-0.5"></i>
                  <span><strong>Note:</strong> ${m.generalNotes}</span>
                </div>
              ` : ''}
            `;
            content.appendChild(div);
          });
        }
      } catch (err) {
        content.innerHTML = `<div class="p-8 text-center text-rose-500 text-xs">Errore nel caricamento dei voti.</div>`;
      }
    }

    function closeVotesModal() {
      document.getElementById("modal-votes").classList.add("hidden");
    }

    let editingDates = [];

    function openEditSurveyModal(idSondaggio) {
      const s = cachedSurveys.find(x => x.idSondaggio === idSondaggio);
      if (!s) return;

      document.getElementById("edit-survey-id").value = s.idSondaggio;
      document.getElementById("modal-edit-id").innerText = "ID: " + s.idSondaggio;
      document.getElementById("edit-survey-title").value = s.title || "";
      document.getElementById("edit-survey-desc").value = s.description || "";
      document.getElementById("edit-survey-status").value = s.status || "ATTIVO";
      document.getElementById("edit-survey-creator").value = s.createdByName ? `${s.createdByName} (${s.createdBy || ''})` : (s.createdBy || 'Sistema');

      editingDates = (s.dates || []).map(d => ({
        date: d.date || "",
        startTime: (d.timeRange && d.timeRange.start) || "08:00",
        endTime: (d.timeRange && d.timeRange.end) || "20:00",
        subtitle: d.subtitle || "",
        timeSlots: Array.isArray(d.timeSlots) ? d.timeSlots.join(", ") : (d.timeSlots || ""),
        notes: d.notes || ""
      }));

      renderEditDates();
      document.getElementById("modal-edit-survey").classList.remove("hidden");
    }

    function closeEditSurveyModal() {
      document.getElementById("modal-edit-survey").classList.add("hidden");
    }

    function renderEditDates() {
      const container = document.getElementById("edit-dates-list");
      document.getElementById("edit-dates-count").innerText = editingDates.length;
      container.innerHTML = "";

      if (!editingDates.length) {
        container.innerHTML = `<div class="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">Nessuna data impostata. Clicca su "+ Aggiungi Data" per inserirne una.</div>`;
        return;
      }

      editingDates.forEach((d, idx) => {
        const row = document.createElement("div");
        row.className = "p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative";
        row.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-700">Opzione Data #${idx + 1}</span>
            <button type="button" onclick="removeEditDateRow(${idx})" class="text-rose-500 hover:text-rose-700 text-xs px-2 py-0.5 rounded hover:bg-rose-50 transition">
              <i class="fas fa-trash-can mr-1"></i> Rimuovi
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label class="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Data</label>
              <input type="date" value="${d.date}" onchange="updateEditDate(${idx}, 'date', this.value)" class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-brand-500">
            </div>
            <div>
              <label class="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Orario Inizio</label>
              <input type="time" value="${d.startTime}" onchange="updateEditDate(${idx}, 'startTime', this.value)" class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-brand-500">
            </div>
            <div>
              <label class="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Orario Fine</label>
              <input type="time" value="${d.endTime}" onchange="updateEditDate(${idx}, 'endTime', this.value)" class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-brand-500">
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Sottotitolo (opzionale)</label>
              <input type="text" placeholder="es. Mattina pulizie" value="${d.subtitle || ''}" oninput="updateEditDate(${idx}, 'subtitle', this.value)" class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-brand-500">
            </div>
            <div>
              <label class="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Fasce Orarie (separate da virgola)</label>
              <input type="text" placeholder="es. Mattina, Pomeriggio, Sera" value="${d.timeSlots || ''}" oninput="updateEditDate(${idx}, 'timeSlots', this.value)" class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-brand-500">
            </div>
          </div>
          <div>
            <label class="block text-[10px] uppercase font-semibold text-slate-500 mb-0.5">Note Specifiche (opzionali)</label>
            <input type="text" placeholder="es. Si richiede puntualità" value="${d.notes || ''}" oninput="updateEditDate(${idx}, 'notes', this.value)" class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-brand-500">
          </div>
        `;
        container.appendChild(row);
      });
    }

    function addEditDateRow() {
      editingDates.push({
        date: "",
        startTime: "08:00",
        endTime: "20:00",
        subtitle: "",
        timeSlots: "Mattina, Pomeriggio, Sera",
        notes: ""
      });
      renderEditDates();
    }

    function removeEditDateRow(idx) {
      if (editingDates.length <= 1) {
        if (!confirm("Rimuovere questa data configurata?")) return;
      }
      editingDates.splice(idx, 1);
      renderEditDates();
    }

    function updateEditDate(idx, key, val) {
      if (editingDates[idx]) {
        editingDates[idx][key] = val;
      }
    }

    async function submitEditSurvey(e) {
      e.preventDefault();
      const idSondaggio = document.getElementById("edit-survey-id").value;
      const title = document.getElementById("edit-survey-title").value.trim();
      const description = document.getElementById("edit-survey-desc").value.trim();
      const status = document.getElementById("edit-survey-status").value;
      const btn = document.getElementById("btn-save-edit-survey");

      if (!title) {
        showToast("Il titolo è obbligatorio", true);
        return;
      }

      const formattedDates = editingDates.map(d => ({
        date: d.date,
        timeRange: { start: d.startTime, end: d.endTime },
        subtitle: d.subtitle || "",
        timeSlots: d.timeSlots ? d.timeSlots.split(",").map(x => x.trim()).filter(Boolean) : [],
        notes: d.notes || ""
      }));

      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Salvataggio...</span>`;

      try {
        const res = await fetch("/api/admin/surveys/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`
          },
          body: JSON.stringify({
            idSondaggio: idSondaggio,
            title: title,
            description: description,
            status: status,
            dates: formattedDates
          })
        });

        const data = await res.json();
        if (data.status === "success") {
          showToast("Sondaggio modificato con successo!");
          closeEditSurveyModal();
          loadDashboardData();
        } else {
          showToast(data.message || "Errore durante il salvataggio", true);
        }
      } catch (err) {
        showToast("Errore di connessione", true);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-save text-xs"></i><span>Salva Modifiche</span>`;
      }
    }

    let currentMfaSetupSecret = "";
    let isCurrentMfaActive = false;

    function updateMfaBadge(active, byEnv) {
      isCurrentMfaActive = active;
      const btn = document.getElementById("btn-mfa-badge");
      const icon = document.getElementById("mfa-badge-icon");
      const txt = document.getElementById("mfa-badge-text");

      if (active) {
        btn.className = "px-3 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 hover:bg-emerald-100";
        icon.className = "fas fa-shield-check text-emerald-600";
        txt.innerText = byEnv ? "2FA Attiva (Env)" : "2FA Attiva";
      } else {
        btn.className = "px-3 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200/70 hover:bg-amber-100 animate-pulse";
        icon.className = "fas fa-shield-halved text-amber-600";
        txt.innerText = "Configura 2FA";
      }
    }

    async function openMfaSetupModal() {
      document.getElementById("mfa-setup-code").value = "";
      const disableBtn = document.getElementById("btn-disable-mfa");

      if (isCurrentMfaActive) {
        disableBtn.classList.remove("hidden");
      } else {
        disableBtn.classList.add("hidden");
      }

      try {
        const res = await fetch("/api/admin/mfa/setup", {
          headers: { "Authorization": `Bearer ${currentToken}` }
        });
        const data = await res.json();
        if (data.status === "success") {
          currentMfaSetupSecret = data.secret;
          document.getElementById("mfa-secret-text").innerText = data.secret;
          document.getElementById("mfa-qr-img").src = data.qrUrl;
          document.getElementById("modal-mfa-setup").classList.remove("hidden");
        } else {
          showToast(data.message || "Errore inizializzazione 2FA", true);
        }
      } catch (err) {
        showToast("Errore di rete", true);
      }
    }

    function closeMfaSetupModal() {
      document.getElementById("modal-mfa-setup").classList.add("hidden");
    }

    function copyMfaSecret() {
      if (currentMfaSetupSecret) {
        navigator.clipboard.writeText(currentMfaSetupSecret);
        showToast("Chiave segreta copiata negli appunti!");
      }
    }

    async function confirmMfaSetup() {
      const code = document.getElementById("mfa-setup-code").value.trim();
      if (!code || code.length !== 6) {
        showToast("Inserisci il codice a 6 cifre generato dall'app", true);
        return;
      }

      const btn = document.getElementById("btn-confirm-mfa");
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Verifica...</span>`;

      try {
        const res = await fetch("/api/admin/mfa/confirm-setup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`
          },
          body: JSON.stringify({
            secret: currentMfaSetupSecret,
            otpCode: code
          })
        });

        const data = await res.json();
        if (data.status === "success") {
          showToast("🎉 Autenticazione a due fattori attivata con successo!");
          closeMfaSetupModal();
          loadDashboardData();
        } else {
          showToast(data.message || "Codice errato", true);
        }
      } catch (e) {
        showToast("Errore durante la verifica", true);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check"></i><span>Verifica & Attiva 2FA</span>`;
      }
    }

    async function disableMfa() {
      const code = prompt("Inserisci il codice a 6 cifre dall'App Authenticator per confermare la disattivazione:");
      if (!code) return;

      try {
        const res = await fetch("/api/admin/mfa/disable", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`
          },
          body: JSON.stringify({ otpCode: code.trim() })
        });
        const data = await res.json();
        if (data.status === "success") {
          showToast("2FA disattivata.");
          closeMfaSetupModal();
          loadDashboardData();
        } else {
          showToast(data.message || "Codice non corretto", true);
        }
      } catch (e) {
        showToast("Errore durante l'operazione", true);
      }
    }
  </script>
</body>
</html>
"""

