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
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Totale Soci -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
            <i class="fas fa-users"></i>
          </div>
          <div>
            <div id="stat-total-users" class="text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Soci Registrati</div>
          </div>
        </div>

        <!-- Admin CMS -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
            <i class="fas fa-crown"></i>
          </div>
          <div>
            <div id="stat-admin-users" class="text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Admin con Permessi</div>
          </div>
        </div>

        <!-- Sondaggi Attivi -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
            <i class="fas fa-calendar-check"></i>
          </div>
          <div>
            <div id="stat-active-surveys" class="text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Sondaggi Attivi</div>
          </div>
        </div>

        <!-- Totale Risposte -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">
            <i class="fas fa-envelope-open-text"></i>
          </div>
          <div>
            <div id="stat-total-votes" class="text-2xl font-bold text-slate-900 leading-none">0</div>
            <div class="text-xs text-slate-500 font-medium mt-1">Schede Voto Salva</div>
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

  <!-- ================= LOGICA APPLICATIVA JAVASCRIPT ================= -->
  <script>
    let currentToken = sessionStorage.getItem("ohel_admin_token") || "";
    let cachedUsers = [];
    let cachedSurveys = [];

    window.addEventListener("DOMContentLoaded", () => {
      if (currentToken) {
        showDashboard();
        loadDashboardData();
      } else {
        showLogin();
      }
    });

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
      const btn = document.getElementById("btn-login");
      const errBox = document.getElementById("login-error");

      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Verifica in corso...</span>`;
      errBox.classList.add("hidden");

      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();

        if (data.status === "success" && data.token) {
          currentToken = data.token;
          sessionStorage.setItem("ohel_admin_token", currentToken);
          showToast("Autenticazione riuscita!");
          showDashboard();
          loadDashboardData();
        } else {
          errBox.classList.remove("hidden");
          document.getElementById("login-error-text").innerText = data.message || "Password errata.";
        }
      } catch (err) {
        errBox.classList.remove("hidden");
        document.getElementById("login-error-text").innerText = "Errore di connessione al server.";
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Accedi al Database</span><i class="fas fa-arrow-right text-xs"></i>`;
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

          // Aggiorna statistiche
          document.getElementById("stat-total-users").innerText = data.stats.totalUsers;
          document.getElementById("stat-admin-users").innerText = data.stats.adminUsers;
          document.getElementById("stat-active-surveys").innerText = data.stats.activeSurveys;
          document.getElementById("stat-total-votes").innerText = data.stats.totalVotes;

          document.getElementById("badge-users-count").innerText = cachedUsers.length;
          document.getElementById("badge-surveys-count").innerText = cachedSurveys.length;

          renderUsers(cachedUsers);
          renderSurveys();
        }
      } catch (err) {
        showToast("Impossibile caricare i dati della dashboard", true);
      }
    }

    function switchTab(tab) {
      const uBtn = document.getElementById("tab-btn-users");
      const sBtn = document.getElementById("tab-btn-surveys");
      const uContent = document.getElementById("tab-content-users");
      const sContent = document.getElementById("tab-content-surveys");

      if (tab === "users") {
        uBtn.className = "px-5 py-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 transition flex items-center gap-2";
        sBtn.className = "px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center gap-2";
        uContent.classList.remove("hidden");
        sContent.classList.add("hidden");
      } else {
        sBtn.className = "px-5 py-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 transition flex items-center gap-2";
        uBtn.className = "px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center gap-2";
        sContent.classList.remove("hidden");
        uContent.classList.add("hidden");
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
                <span class="text-[11px] text-slate-400 font-mono">${u.idGoogle || ""}</span>
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
            
            <div class="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-600">
              <span class="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <i class="fas fa-calendar-days text-slate-400"></i> ${datesCount} date configurate
              </span>
              <span class="bg-purple-50 text-purple-700 border border-purple-200/60 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5">
                <i class="fas fa-user-check text-purple-500"></i> ${votesCount} partecipanti
              </span>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <button 
              onclick="viewSurveyVotes('${s.idSondaggio}', '${s.title.replace(/'/g, "\\'")}')" 
              class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
            >
              <i class="fas fa-eye text-slate-500"></i>
              <span>Vedi Voti (${votesCount})</span>
            </button>

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
  </script>
</body>
</html>
"""

