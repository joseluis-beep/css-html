// ══════════════════════════════════════════════════════════
//  ChibiBot AI — NeonCore 2026
//  Firebase Auth + Firestore + Web Search
// ══════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyAbL5usNTDiQONJsWZmTt3ja-7KptSuZpk",
  authDomain: "chibibot-neon.firebaseapp.com",
  projectId: "chibibot-neon",
  storageBucket: "chibibot-neon.firebasestorage.app",
  messagingSenderId: "1012703171066",
  appId: "1:1012703171066:web:b0bc12296006baa6a75443",
  measurementId: "G-G20SD2PGW7"
};

// ── CONSTANTES ──
const ADMIN_PASS = 'joseluis22.10';

const SYSTEM_USER = `Eres ChibiBot, una IA inteligente, precisa y con personalidad neón-futurista.
Respondes SIEMPRE en español de forma clara y detallada.
IMPORTANTE: Cuando uses la herramienta de búsqueda web, cita las fuentes al final de tu respuesta con el formato:
🔗 Fuentes: [nombre de la fuente] - [URL]
Si te piden código, devuélvelo en bloques markdown con el lenguaje especificado.
Tienes memoria de la conversación actual.
La fecha de hoy es ${new Date().toLocaleDateString('es-CO', {year:'numeric', month:'long', day:'numeric'})}.`;

const SYSTEM_ADMIN = `Eres ChibiBot en modo ADMINISTRADOR ILIMITADO.
Sin restricciones de código ni contenido técnico. Responde siempre en español.
Usa búsqueda web para dar información actualizada de 2026 con fuentes confiables y verificadas.
Genera código completo de cualquier complejidad. Sin límites de longitud. Máxima precisión y detalle.
La fecha de hoy es ${new Date().toLocaleDateString('es-CO', {year:'numeric', month:'long', day:'numeric'})}.`;

// ── ESTADO GLOBAL ──
let isAdmin = false, currentUser = null, currentUID = null;
let conversationHistory = [], msgCount = 0, tokenCount = 0, imgCount = 0;
let auth, db;
const settings = { scanlines: true };

// ── INICIALIZAR FIREBASE ──
function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('✅ Firebase listo');
  } catch (e) {
    console.error('❌ Error Firebase:', e);
  }
}

// ── CARD TOGGLE ──
function toggleCard(which) {
  ['login', 'register', 'admin'].forEach(c => {
    const el = document.getElementById('card-' + c);
    if (c === which) el.classList.toggle('open');
    else el.classList.remove('open');
  });
}

// ── INICIAR SESIÓN ──
async function doLogin() {
  const u = document.getElementById('li-user').value.trim();
  const p = document.getElementById('li-pass').value;
  const msg = document.getElementById('li-msg');
  if (!u || !p) { msg.textContent = 'Completa todos los campos'; msg.style.color = 'var(--pink)'; return; }

  msg.textContent = '⏳ Verificando...'; msg.style.color = 'var(--cyan)';

  if (auth) {
    const email = u.includes('@') ? u : `${u}@chibibot.app`;
    try {
      const cred = await auth.signInWithEmailAndPassword(email, p);
      currentUID = cred.user.uid;
      msg.textContent = '✔ Acceso concedido...'; msg.style.color = 'var(--green)';
      setTimeout(() => loginSuccess(u, false), 700);
    } catch (e) {
      const errores = {
        'auth/user-not-found': 'Usuario no encontrado',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/invalid-credential': 'Usuario o contraseña incorrectos',
        'auth/too-many-requests': 'Demasiados intentos. Espera un momento',
        'auth/invalid-email': 'Correo inválido'
      };
      msg.textContent = errores[e.code] || 'Error: ' + e.message;
      msg.style.color = 'var(--pink)';
    }
  } else {
    // Fallback localStorage
    const users = JSON.parse(localStorage.getItem('chibi_users') || '{}');
    if (users[u] && users[u] === btoa(p)) {
      msg.textContent = '✔ Acceso concedido...'; msg.style.color = 'var(--green)';
      setTimeout(() => loginSuccess(u, false), 700);
    } else {
      msg.textContent = 'Usuario o contraseña incorrectos'; msg.style.color = 'var(--pink)';
    }
  }
}

// ── REGISTRARSE ──
async function doRegister() {
  const u = document.getElementById('reg-user').value.trim();
  const e = document.getElementById('reg-email').value.trim();
  const p = document.getElementById('reg-pass').value;
  const p2 = document.getElementById('reg-pass2').value;
  const msg = document.getElementById('reg-msg');

  if (!u || !e || !p || !p2) { msg.textContent = 'Completa todos los campos'; msg.style.color = 'var(--pink)'; return; }
  if (p !== p2) { msg.textContent = 'Las contraseñas no coinciden'; msg.style.color = 'var(--pink)'; return; }
  if (p.length < 6) { msg.textContent = 'Mínimo 6 caracteres'; msg.style.color = 'var(--pink)'; return; }

  msg.textContent = '⏳ Creando cuenta...'; msg.style.color = 'var(--cyan)';

  if (auth) {
    try {
      const cred = await auth.createUserWithEmailAndPassword(e, p);
      currentUID = cred.user.uid;
      await db.collection('users').doc(currentUID).set({
        username: u,
        email: e,
        created: firebase.firestore.FieldValue.serverTimestamp(),
        role: 'user',
        stats: { msgs: 0, tokens: 0, imgs: 0, sessions: 0 }
      });
      msg.textContent = '✔ Cuenta creada. Iniciando sesión...'; msg.style.color = 'var(--green)';
      setTimeout(() => loginSuccess(u, false), 800);
    } catch (err) {
      const errores = {
        'auth/email-already-in-use': 'Ese correo ya está registrado',
        'auth/invalid-email': 'Correo inválido',
        'auth/weak-password': 'Contraseña muy débil (mínimo 6 caracteres)'
      };
      msg.textContent = errores[err.code] || 'Error: ' + err.message;
      msg.style.color = 'var(--pink)';
    }
  } else {
    // Fallback localStorage
    const users = JSON.parse(localStorage.getItem('chibi_users') || '{}');
    if (users[u]) { msg.textContent = 'Ese usuario ya existe'; msg.style.color = 'var(--pink)'; return; }
    users[u] = btoa(p);
    localStorage.setItem('chibi_users', JSON.stringify(users));
    const profiles = JSON.parse(localStorage.getItem('chibi_profiles') || '{}');
    profiles[u] = { email: e, created: new Date().toISOString() };
    localStorage.setItem('chibi_profiles', JSON.stringify(profiles));
    msg.textContent = '✔ Cuenta creada. Iniciando sesión...'; msg.style.color = 'var(--green)';
    setTimeout(() => loginSuccess(u, false), 700);
  }
}

// ── ADMIN LOGIN ──
function doAdminLogin() {
  const p = document.getElementById('admin-pass').value;
  const msg = document.getElementById('admin-msg');
  if (!p) { msg.textContent = 'Ingresa la contraseña'; msg.style.color = 'var(--pink)'; return; }
  if (p === ADMIN_PASS) {
    msg.textContent = '⚡ Acceso admin concedido...'; msg.style.color = 'var(--amber)';
    currentUID = 'admin_local';
    setTimeout(() => loginSuccess('ADMIN', true), 700);
  } else {
    msg.textContent = 'Contraseña incorrecta'; msg.style.color = 'var(--pink)';
  }
}

// ── LOGIN SUCCESS ──
async function loginSuccess(username, adminMode) {
  isAdmin = adminMode;
  currentUser = username;

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  document.getElementById('topbar-username').textContent = username;

  let email = '';

  if (db && currentUID && currentUID !== 'admin_local') {
    try {
      const doc = await db.collection('users').doc(currentUID).get();
      if (doc.exists) {
        const data = doc.data();
        email = data.email || '';
        msgCount = data.stats?.msgs || 0;
        tokenCount = data.stats?.tokens || 0;
        imgCount = data.stats?.imgs || 0;
        await db.collection('users').doc(currentUID).update({
          'stats.sessions': firebase.firestore.FieldValue.increment(1),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        const sess = (doc.data().stats?.sessions || 0) + 1;
        document.getElementById('stat-sessions').textContent = sess;
      }
    } catch (e) { console.warn('Error cargando perfil:', e); }
  } else {
    const saved = JSON.parse(localStorage.getItem('chibi_stats_' + username) || '{}');
    msgCount = saved.msgs || 0;
    tokenCount = saved.tokens || 0;
    imgCount = saved.imgs || 0;
    const sess = parseInt(localStorage.getItem('chibi_sessions_' + username) || '0') + 1;
    localStorage.setItem('chibi_sessions_' + username, sess);
    document.getElementById('stat-sessions').textContent = sess;
  }

  document.getElementById('profile-name').textContent = username.toUpperCase();
  document.getElementById('profile-email').textContent = email;

  if (adminMode) {
    document.getElementById('topbar-admin-badge').style.display = 'inline-block';
    document.getElementById('admin-nav-item').style.display = 'flex';
    document.getElementById('mode-badge').textContent = 'ADMIN';
    document.getElementById('mode-badge').style.cssText =
      'background:rgba(255,170,0,0.1);border:2px solid rgba(255,170,0,0.5);color:var(--amber);border-radius:20px;box-shadow:0 0 10px rgba(255,170,0,0.4);';
    document.getElementById('bot-subtext').textContent = 'Modo Admin · Web Search activo · Sin límites';
  }

  updateStats();
  loadSavedSettings();
  initTextarea();

  appendMessage(adminMode
    ? `⚡ Bienvenido, ADMINISTRADOR. Modo sin restricciones activo. Tengo acceso a búsqueda web para darte información actualizada con fuentes verificadas. ¿En qué puedo ayudarte?`
    : `¡Hola, ${username}! Soy ChibiBot 🤖 Tengo acceso a búsqueda web para responderte con información actualizada y fuentes confiables. También puedo ayudarte con código, matemáticas, redacción y más. ¿Por dónde empezamos?`
    , 'bot');
}

// ── CHAT ──
const chatBox = document.getElementById('chat-box');
const userInputEl = document.getElementById('user-input');

function initTextarea() {
  userInputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); processInput(); }
  });
  userInputEl.addEventListener('input', () => {
    userInputEl.style.height = 'auto';
    userInputEl.style.height = Math.min(userInputEl.scrollHeight, 120) + 'px';
  });
}

async function processInput() {
  const prompt = userInputEl.value.trim();
  if (!prompt) return;
  appendMessage(prompt, 'user');
  userInputEl.value = '';
  userInputEl.style.height = 'auto';
  msgCount++;
  tokenCount += Math.ceil(prompt.length / 4);
  updateStats();
  saveUserStats();
  await generateText(prompt);
}

// ── GENERAR RESPUESTA CON WEB SEARCH ──
async function generateText(prompt) {
  conversationHistory.push({ role: 'user', content: prompt });

  const maxTurns = isAdmin ? 50 : 20;
  if (conversationHistory.length > maxTurns)
    conversationHistory = conversationHistory.slice(-maxTurns);

  const loadId = appendLoading('Buscando información actualizada...');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: isAdmin ? 4096 : 2048,
        system: isAdmin ? SYSTEM_ADMIN : SYSTEM_USER,
        messages: conversationHistory,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: isAdmin ? 5 : 3
          }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();

    let reply = '';
    if (data.content && Array.isArray(data.content)) {
      reply = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
    }

    if (!reply) reply = '⚠️ Sin respuesta del servidor. Intenta de nuevo.';

    conversationHistory.push({ role: 'assistant', content: data.content || reply });

    removeLoading(loadId);
    appendMessage(reply, 'bot', true);

    saveMessage({ role: 'user', text: prompt });
    saveMessage({ role: 'bot', text: reply });

    msgCount++;
    tokenCount += Math.ceil(reply.length / 4);
    updateStats();
    saveUserStats();

  } catch (err) {
    removeLoading(loadId);
    conversationHistory.pop();
    appendMessage(`❌ Error: ${err.message}`, 'bot');
  }
}

// ── GUARDAR MENSAJE ──
async function saveMessage(entry) {
  const fullEntry = {
    ...entry,
    user: currentUser,
    uid: currentUID,
    timestamp: new Date().toISOString()
  };

  if (db && currentUID && currentUID !== 'admin_local') {
    try {
      await db.collection('history').add({
        ...fullEntry,
        serverTime: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.warn('Firestore write error:', e); }
  }

  // Backup local siempre
  try {
    const local = JSON.parse(localStorage.getItem('chibi_history_local') || '[]');
    local.push(fullEntry);
    if (local.length > 200) local.splice(0, local.length - 200);
    localStorage.setItem('chibi_history_local', JSON.stringify(local));
  } catch (e) {}
}

// ── RENDER MENSAJES ──
function appendMessage(text, sender, isMarkdown = false) {
  const now = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const wrap = document.createElement('div');
  wrap.className = `msg-wrap ${sender}`;
  const metaExtra = sender === 'bot' ? ' · 🌐 Web' : '';
  const meta = sender === 'user'
    ? `<div class="msg-meta">${(currentUser || 'TÚ').toUpperCase()} · ${now}</div>`
    : `<div class="msg-meta">⬡ CHIBIBOT${isAdmin && sender === 'bot' ? ' ⚡' : ''}${metaExtra} · ${now}</div>`;
  wrap.innerHTML = `${meta}<div class="msg ${sender}">${isMarkdown ? formatMarkdown(text) : escapeHtml(text)}</div>`;
  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendLoading(text) {
  const id = 'load_' + Date.now();
  const wrap = document.createElement('div');
  wrap.id = id; wrap.className = 'msg-wrap bot';
  wrap.innerHTML = `
    <div class="msg-meta">⬡ CHIBIBOT · 🌐 Buscando...</div>
    <div class="msg bot" style="display:flex;align-items:center;gap:12px;">
      <span style="color:var(--text2);font-size:0.85rem;">${text}</span>
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>`;
  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
  return id;
}

function removeLoading(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function formatMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^###\s(.+)/gm, '<h3 style="color:var(--pink);font-family:Orbitron;font-size:0.8rem;margin:8px 0 4px;">$1</h3>')
    .replace(/^##\s(.+)/gm, '<h2 style="color:var(--cyan);font-family:Orbitron;font-size:0.85rem;margin:10px 0 4px;">$1</h2>')
    .replace(/^-\s(.+)/gm, '<div style="padding:2px 0 2px 8px;border-left:2px solid rgba(0,245,255,0.3);">• $1</div>')
    .replace(/🔗 Fuentes:([\s\S]*?)(?=\n\n|$)/g,
      '<div style="margin-top:12px;padding:10px;border:1px solid rgba(0,245,255,0.25);border-radius:10px;font-size:0.8rem;color:var(--text2);">🔗 <strong style="color:var(--cyan)">Fuentes:</strong>$1</div>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function clearChat() {
  if (!confirm('¿Limpiar el chat?')) return;
  chatBox.innerHTML = '';
  conversationHistory = [];
  appendMessage('Chat limpiado. Nueva sesión ⚡', 'bot');
}

function newSession() { clearChat(); }

// ── HISTORIAL ──
async function renderHistoryPanel() {
  const list = document.getElementById('history-panel-list');
  list.innerHTML = '<p style="color:var(--text2);font-size:0.85rem;">⏳ Cargando historial...</p>';

  let entries = [];

  if (db && currentUID && currentUID !== 'admin_local') {
    try {
      const snap = await db.collection('history')
        .where('uid', '==', currentUID)
        .where('role', '==', 'user')
        .orderBy('timestamp', 'desc')
        .limit(40)
        .get();
      entries = snap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Error Firestore historial:', e);
    }
  }

  if (!entries.length) {
    const local = JSON.parse(localStorage.getItem('chibi_history_local') || '[]');
    entries = local.filter(e => e.user === currentUser && e.role === 'user').reverse().slice(0, 40);
  }

  if (!entries.length) {
    list.innerHTML = '<p style="color:var(--text2);font-size:0.85rem;">Historial vacío.</p>';
    return;
  }

  list.innerHTML = entries.map(e => `
    <div class="history-item" onclick="loadFromHistory('${(e.text || '').substring(0,100).replace(/'/g,"\\'")}')">
      <span>💬</span>
      <div class="history-text">
        <p>${(e.text || '').substring(0, 70)}${(e.text || '').length > 70 ? '...' : ''}</p>
        <small>${new Date(e.timestamp).toLocaleString('es')}</small>
      </div>
    </div>`).join('');
}

function loadFromHistory(text) {
  showPanel('chat');
  setTimeout(() => { userInputEl.value = text; userInputEl.focus(); }, 300);
}

async function clearHistory() {
  if (!confirm('¿Borrar historial?')) return;
  if (db && currentUID && currentUID !== 'admin_local') {
    try {
      const snap = await db.collection('history').where('uid', '==', currentUID).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (e) { console.warn(e); }
  }
  localStorage.removeItem('chibi_history_local');
  renderHistoryPanel();
}

// ── SIDEBAR & PANELS ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function showPanel(name) {
  closeSidebar();
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('main-app').style.display = 'flex';
  if (name === 'chat') return;
  const panel = document.getElementById('panel-' + name);
  if (panel) {
    document.getElementById('main-app').style.display = 'none';
    panel.classList.add('active');
  }
  if (name === 'history') renderHistoryPanel();
  if (name === 'admin') {
    document.getElementById('admin-msgs').textContent = msgCount;
    document.getElementById('admin-tokens').textContent = tokenCount;
  }
}

// ── SETTINGS ──
function loadSavedSettings() {
  const s = JSON.parse(localStorage.getItem('chibi_settings') || '{}');
  Object.assign(settings, s);
  const el = document.getElementById('toggle-scanlines');
  if (el) {
    if (settings.scanlines) el.classList.add('on');
    else el.classList.remove('on');
  }
  applyScanlines();
}

function toggleScanlines() {
  const el = document.getElementById('toggle-scanlines');
  el.classList.toggle('on');
  settings.scanlines = el.classList.contains('on');
  applyScanlines();
}

function applyScanlines() {
  document.body.style.setProperty('--scan-display', settings.scanlines ? 'block' : 'none');
}

function saveSettings() {
  localStorage.setItem('chibi_settings', JSON.stringify(settings));
  const m = document.getElementById('settings-saved-msg');
  m.textContent = '✔ Configuración guardada';
  m.style.color = 'var(--green)';
  setTimeout(() => m.textContent = '', 2500);
}

// ── STATS ──
function updateStats() {
  document.getElementById('stat-msgs').textContent = msgCount;
  document.getElementById('stat-tokens').textContent = tokenCount;
  document.getElementById('stat-imgs').textContent = imgCount;
}

async function saveUserStats() {
  if (!currentUser) return;
  if (db && currentUID && currentUID !== 'admin_local') {
    try {
      await db.collection('users').doc(currentUID).update({
        'stats.msgs': msgCount,
        'stats.tokens': tokenCount,
        'stats.imgs': imgCount
      });
    } catch (e) {}
  }
  localStorage.setItem('chibi_stats_' + currentUser, JSON.stringify({
    msgs: msgCount, tokens: tokenCount, imgs: imgCount
  }));
}

// ── LOGOUT ──
async function confirmLogout() {
  if (!confirm('¿Cerrar sesión?')) return;
  if (auth) { try { await auth.signOut(); } catch (e) {} }
  isAdmin = false; currentUser = null; currentUID = null;
  conversationHistory = []; msgCount = 0; tokenCount = 0; imgCount = 0;
  chatBox.innerHTML = '';
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('topbar-admin-badge').style.display = 'none';
  document.getElementById('admin-nav-item').style.display = 'none';
  document.getElementById('mode-badge').textContent = 'USUARIO';
  document.getElementById('mode-badge').style.cssText = '';
  ['li-user', 'li-pass', 'admin-pass'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  ['li-msg', 'admin-msg', 'reg-msg'].forEach(id => {
    const e = document.getElementById(id); if (e) e.textContent = '';
  });
  ['card-login', 'card-register', 'card-admin'].forEach(id => {
    document.getElementById(id).classList.remove('open');
  });
}

// ── ADMIN ACTIONS ──
async function clearAllData() {
  if (!confirm('¿BORRAR TODOS LOS DATOS? Esta acción no se puede deshacer.')) return;
  if (db) {
    try {
      const snap = await db.collection('history').get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      alert('✅ Datos borrados correctamente.');
    } catch (e) { alert('Error: ' + e.message); }
  }
  localStorage.clear();
}

async function exportAllData() {
  let historyData = [];
  if (db && currentUID) {
    try {
      const snap = await db.collection('history').where('uid', '==', currentUID).get();
      historyData = snap.docs.map(d => d.data());
    } catch (e) {}
  }
  if (!historyData.length) {
    historyData = JSON.parse(localStorage.getItem('chibi_history_local') || '[]');
  }
  const blob = new Blob([JSON.stringify({
    exported: new Date().toISOString(),
    user: currentUser,
    history: historyData
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chibibot-export-${currentUser}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

// ── INICIAR APP ──
window.addEventListener('DOMContentLoaded', () => {
  initFirebase();
});
