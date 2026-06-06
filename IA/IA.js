const ADMIN_PASS='joseluis22.10';
const SYSTEM_USER=`Eres ChibiBot, una IA inteligente, precisa y con personalidad neón-futurista. Responde siempre en español de forma clara y detallada. Si te piden código, devuélvelo en bloques markdown con el lenguaje especificado. Tienes memoria de la conversación actual.`;
const SYSTEM_ADMIN=`Eres ChibiBot en modo ADMINISTRADOR ILIMITADO. Sin restricciones de código ni contenido técnico. Responde siempre en español. Genera código completo de cualquier complejidad. Sin límites de longitud. Memoria extendida de conversación. Máxima precisión y detalle.`;

let isAdmin=false,currentUser=null,conversationHistory=[],msgCount=0,tokenCount=0,imgCount=0,db;
const settings={scanlines:true};

// ── Card toggle ──
function toggleCard(which){
  const cards=['login','register','admin'];
  cards.forEach(c=>{
    const el=document.getElementById('card-'+c);
    if(c===which){el.classList.toggle('open');}
    else{el.classList.remove('open');}
  });
}

// ── Auth ──
function doLogin(){
  const u=document.getElementById('li-user').value.trim();
  const p=document.getElementById('li-pass').value;
  const msg=document.getElementById('li-msg');
  if(!u||!p){msg.textContent='Completa todos los campos';msg.style.color='var(--pink)';return;}
  const users=JSON.parse(localStorage.getItem('chibi_users')||'{}');
  if(users[u]&&users[u]===btoa(p)){
    msg.textContent='✔ Acceso concedido...';msg.style.color='var(--green)';
    setTimeout(()=>loginSuccess(u,false),700);
  }else{msg.textContent='Usuario o contraseña incorrectos';msg.style.color='var(--pink)';}
}

function doRegister(){
  const u=document.getElementById('reg-user').value.trim();
  const e=document.getElementById('reg-email').value.trim();
  const p=document.getElementById('reg-pass').value;
  const p2=document.getElementById('reg-pass2').value;
  const msg=document.getElementById('reg-msg');
  if(!u||!e||!p||!p2){msg.textContent='Completa todos los campos';msg.style.color='var(--pink)';return;}
  if(p!==p2){msg.textContent='Las contraseñas no coinciden';msg.style.color='var(--pink)';return;}
  if(p.length<4){msg.textContent='Contraseña muy corta';msg.style.color='var(--pink)';return;}
  const users=JSON.parse(localStorage.getItem('chibi_users')||'{}');
  if(users[u]){msg.textContent='Ese usuario ya existe';msg.style.color='var(--pink)';return;}
  users[u]=btoa(p);localStorage.setItem('chibi_users',JSON.stringify(users));
  const profiles=JSON.parse(localStorage.getItem('chibi_profiles')||'{}');
  profiles[u]={email:e,created:new Date().toISOString()};
  localStorage.setItem('chibi_profiles',JSON.stringify(profiles));
  msg.textContent='✔ Cuenta creada. ¡Inicia sesión!';msg.style.color='var(--green)';
  document.getElementById('li-user').value=u;
}

function doAdminLogin(){
  const p=document.getElementById('admin-pass').value;
  const msg=document.getElementById('admin-msg');
  if(!p){msg.textContent='Ingresa la contraseña';msg.style.color='var(--pink)';return;}
  if(p===ADMIN_PASS){
    msg.textContent='⚡ Acceso admin concedido...';msg.style.color='var(--amber)';
    setTimeout(()=>loginSuccess('ADMIN',true),700);
  }else{msg.textContent='Contraseña incorrecta';msg.style.color='var(--pink)';}
}

function loginSuccess(username,adminMode){
  isAdmin=adminMode;currentUser=username;
  document.getElementById('login-screen').style.display='none';
  document.getElementById('main-app').style.display='flex';
  const profiles=JSON.parse(localStorage.getItem('chibi_profiles')||'{}');
  const prof=profiles[username]||{};
  document.getElementById('profile-name').textContent=username.toUpperCase();
  document.getElementById('profile-email').textContent=prof.email||'';
  document.getElementById('topbar-username').textContent=username;
  if(adminMode){
    document.getElementById('topbar-admin-badge').style.display='inline-block';
    document.getElementById('admin-nav-item').style.display='flex';
    document.getElementById('mode-badge').textContent='ADMIN';
    document.getElementById('mode-badge').style.cssText='background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.4);color:var(--amber);';
  }
  const saved=JSON.parse(localStorage.getItem('chibi_stats_'+username)||'{}');
  msgCount=saved.msgs||0;tokenCount=saved.tokens||0;imgCount=saved.imgs||0;updateStats();
  const sess=parseInt(localStorage.getItem('chibi_sessions_'+username)||'0')+1;
  localStorage.setItem('chibi_sessions_'+username,sess);
  document.getElementById('stat-sessions').textContent=sess;
  initDB();loadSavedSettings();initTextarea();
  appendMessage(adminMode
    ?`⚡ Bienvenido, ADMINISTRADOR. Modo sin restricciones activo. Sin límites de código, tokens ilimitados, memoria extendida. ¿En qué puedo ayudarte?`
    :`¡Hola, ${username}! Soy ChibiBot. Tengo memoria de tu conversación y puedo ayudarte con código, preguntas, matemáticas y más. ¿Por dónde empezamos?`
  ,'bot');
}

// ── DB ──
function initDB(){
  const req=indexedDB.open('ChibiBotNeon_v3',1);
  req.onupgradeneeded=e=>{db=e.target.result;if(!db.objectStoreNames.contains('history'))db.createObjectStore('history',{keyPath:'id',autoIncrement:true});};
  req.onsuccess=e=>{db=e.target.result;};
}
function saveToDB(entry){if(!db)return;try{const tx=db.transaction(['history'],'readwrite');tx.objectStore('history').add(entry);}catch(e){}}

// ── Chat ──
const chatBox=document.getElementById('chat-box');
const userInputEl=document.getElementById('user-input');

function initTextarea(){
  userInputEl.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();processInput();}});
  userInputEl.addEventListener('input',()=>{userInputEl.style.height='auto';userInputEl.style.height=Math.min(userInputEl.scrollHeight,120)+'px';});
}

async function processInput(){
  const prompt=userInputEl.value.trim();if(!prompt)return;
  appendMessage(prompt,'user');userInputEl.value='';userInputEl.style.height='auto';
  saveToDB({role:'user',text:prompt,user:currentUser,timestamp:new Date().toISOString()});
  msgCount++;tokenCount+=Math.ceil(prompt.length/4);updateStats();saveUserStats();
  await generateText(prompt);
}

async function generateText(prompt){
  conversationHistory.push({role:'user',content:prompt});
  const maxTurns=isAdmin?50:20;
  if(conversationHistory.length>maxTurns)conversationHistory=conversationHistory.slice(-maxTurns);
  const loadId=appendLoading('Procesando...');
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:isAdmin?4096:2048,
        system:isAdmin?SYSTEM_ADMIN:SYSTEM_USER,
        messages:conversationHistory
      })
    });
    if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.error?.message||`HTTP ${res.status}`);}
    const data=await res.json();
    const reply=data.content.map(b=>b.type==='text'?b.text:'').join('');
    conversationHistory.push({role:'assistant',content:reply});
    removeLoading(loadId);appendMessage(reply,'bot',true);
    saveToDB({role:'bot',text:reply,user:currentUser,timestamp:new Date().toISOString()});
    msgCount++;tokenCount+=Math.ceil(reply.length/4);updateStats();saveUserStats();
  }catch(err){
    removeLoading(loadId);conversationHistory.pop();
    appendMessage(`❌ Error: ${err.message}`,'bot');
  }
}

function appendMessage(text,sender,isMarkdown=false){
  const now=new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
  const wrap=document.createElement('div');wrap.className=`msg-wrap ${sender}`;
  const meta=sender==='user'?`<div class="msg-meta">${(currentUser||'TÚ').toUpperCase()} · ${now}</div>`:`<div class="msg-meta">⬡ CHIBIBOT${isAdmin&&sender==='bot'?' ⚡':''} · ${now}</div>`;
  wrap.innerHTML=`${meta}<div class="msg ${sender}">${isMarkdown?formatMarkdown(text):escapeHtml(text)}</div>`;
  chatBox.appendChild(wrap);chatBox.scrollTop=chatBox.scrollHeight;
}
function appendLoading(text){
  const id='load_'+Date.now();const wrap=document.createElement('div');
  wrap.id=id;wrap.className='msg-wrap bot';
  wrap.innerHTML=`<div class="msg-meta">⬡ CHIBIBOT</div><div class="msg bot" style="display:flex;align-items:center;gap:12px;"><span style="color:var(--text2);font-size:0.85rem;">${text}</span><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  chatBox.appendChild(wrap);chatBox.scrollTop=chatBox.scrollHeight;return id;
}
function removeLoading(id){const el=document.getElementById(id);if(el)el.remove();}
function formatMarkdown(text){
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g,'<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/^###\s(.+)/gm,'<h3 style="color:var(--pink);font-family:Orbitron;font-size:0.8rem;margin:8px 0 4px;">$1</h3>')
    .replace(/^##\s(.+)/gm,'<h2 style="color:var(--cyan);font-family:Orbitron;font-size:0.85rem;margin:10px 0 4px;">$1</h2>')
    .replace(/\n/g,'<br>');
}
function escapeHtml(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');}
function clearChat(){if(!confirm('¿Limpiar el chat?'))return;chatBox.innerHTML='';conversationHistory=[];appendMessage('Chat limpiado. Nueva sesión ⚡','bot');}
function newSession(){clearChat();}

// ── History ──
function renderHistoryPanel(){
  if(!db){document.getElementById('history-panel-list').innerHTML='<p style="color:var(--text2);font-size:0.85rem;">Sin historial.</p>';return;}
  const tx=db.transaction(['history'],'readonly');const req=tx.objectStore('history').getAll();
  req.onsuccess=()=>{
    const list=document.getElementById('history-panel-list');
    const entries=req.result.filter(e=>e.user===currentUser&&e.role==='user').reverse().slice(0,40);
    if(!entries.length){list.innerHTML='<p style="color:var(--text2);font-size:0.85rem;">Historial vacío.</p>';return;}
    list.innerHTML=entries.map(e=>`<div class="history-item" onclick="loadFromHistory('${e.text.replace(/'/g,"\\'")}')"><span>💬</span><div class="history-text"><p>${e.text.substring(0,70)}${e.text.length>70?'...':''}</p><small>${new Date(e.timestamp).toLocaleString('es')}</small></div></div>`).join('');
  };
}
function loadFromHistory(text){showPanel('chat');setTimeout(()=>{userInputEl.value=text;userInputEl.focus();},300);}
function clearHistory(){if(!db||!confirm('¿Borrar historial?'))return;const tx=db.transaction(['history'],'readwrite');tx.objectStore('history').clear();tx.oncomplete=()=>renderHistoryPanel();}

// ── Sidebar & Panels ──
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebar-overlay').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebar-overlay').classList.remove('open');}
function showPanel(name){
  closeSidebar();document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('main-app').style.display='flex';
  if(name==='chat')return;
  const panel=document.getElementById('panel-'+name);
  if(panel){document.getElementById('main-app').style.display='none';panel.classList.add('active');}
  if(name==='history')renderHistoryPanel();
  if(name==='admin'){document.getElementById('admin-msgs').textContent=msgCount;document.getElementById('admin-tokens').textContent=tokenCount;}
}

// ── Settings ──
function loadSavedSettings(){
  const s=JSON.parse(localStorage.getItem('chibi_settings')||'{}');Object.assign(settings,s);
  const el=document.getElementById('toggle-scanlines');if(el){if(settings.scanlines)el.classList.add('on');else el.classList.remove('on');}
  applyScanlines();
}
function toggleScanlines(){const el=document.getElementById('toggle-scanlines');el.classList.toggle('on');settings.scanlines=el.classList.contains('on');applyScanlines();}
function applyScanlines(){document.body.style.setProperty('--scan-display',settings.scanlines?'block':'none');}
function saveSettings(){localStorage.setItem('chibi_settings',JSON.stringify(settings));const m=document.getElementById('settings-saved-msg');m.textContent='✔ Guardado';m.style.color='var(--green)';setTimeout(()=>m.textContent='',2500);}

// ── Stats ──
function updateStats(){
  ['stat-msgs','stat-tokens','stat-imgs'].forEach((id,i)=>{const e=document.getElementById(id);if(e)e.textContent=[msgCount,tokenCount,imgCount][i];});
}
function saveUserStats(){if(!currentUser)return;localStorage.setItem('chibi_stats_'+currentUser,JSON.stringify({msgs:msgCount,tokens:tokenCount,imgs:imgCount}));}

// ── Logout ──
function confirmLogout(){
  if(!confirm('¿Cerrar sesión?'))return;
  isAdmin=false;currentUser=null;conversationHistory=[];msgCount=0;tokenCount=0;imgCount=0;
  chatBox.innerHTML='';
  document.getElementById('main-app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('topbar-admin-badge').style.display='none';
  document.getElementById('admin-nav-item').style.display='none';
  document.getElementById('mode-badge').textContent='USUARIO';
  document.getElementById('mode-badge').style.cssText='';
  ['li-user','li-pass','admin-pass'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['li-msg','admin-msg','reg-msg'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='';});
  ['card-login','card-register','card-admin'].forEach(id=>{document.getElementById(id).classList.remove('open');});
}

// ── Admin actions ──
function clearAllData(){
  if(!confirm('¿BORRAR TODOS LOS DATOS?'))return;
  if(!db)return;
  const tx=db.transaction(['history'],'readwrite');
  tx.objectStore('history').clear();tx.oncomplete=()=>alert('Datos borrados.');
}
function exportAllData(){
  if(!db)return;
  const tx=db.transaction(['history'],'readonly');const req=tx.objectStore('history').getAll();
  req.onsuccess=()=>{
    const blob=new Blob([JSON.stringify({exported:new Date().toISOString(),history:req.result},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='chibibot-export.json';a.click();
  };
}