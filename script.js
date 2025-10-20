// Point to your backend (Railway or Netlify proxy)
const API_BASE = ""; // if using Netlify proxy below; otherwise set to "https://YOUR-RAILWAY.up.railway.app"

async function postJSON(path, body){
  const r = await fetch(`${API_BASE}${path}`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(body||{})
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

// PERSON (Hunter)
async function searchPerson(){
  const input = document.getElementById('personInput').value.trim();
  const out = document.getElementById('personResults');
  if(!input){ out.innerHTML = warn('Enter email/username/phone'); return; }
  out.innerHTML = '🔍 Searching...';
  try{
    const data = await postJSON('/api/person', { query: input });
    out.innerHTML = pre(data);
  }catch(e){ out.innerHTML = err(e.message); }
}

// USERNAME (simple existence checks client-side are noisy; start with server later)
async function trackUsername(){
  const u = document.getElementById('usernameInput').value.replace('@','').trim();
  const out = document.getElementById('usernameResults');
  if(!u){ out.innerHTML = warn('Enter username'); return; }
  // For now, piggyback Hunter domain search for u.com or just echo
  out.innerHTML = pre({ username:u, note:'Add server-side trackers as needed' });
}

// EMAIL (Clearbit)
async function verifyEmail(){
  const email = document.getElementById('emailInput').value.trim();
  const out = document.getElementById('emailResults');
  if(!email){ out.innerHTML = warn('Enter email'); return; }
  out.innerHTML = '✅ Verifying...';
  try{
    const data = await postJSON('/api/email', { email });
    out.innerHTML = pre(data);
  }catch(e){ out.innerHTML = err(e.message); }
}

// DOMAIN (DNS + geo)
async function reconDomain(){
  const domain = document.getElementById('domainInput').value.trim();
  const out = document.getElementById('domainResults');
  if(!domain){ out.innerHTML = warn('Enter domain'); return; }
  out.innerHTML = '🔎 Recon...';
  try{
    const data = await postJSON('/api/domain', { domain });
    out.innerHTML = pre(data);
  }catch(e){ out.innerHTML = err(e.message); }
}

// helpers
function pre(obj){ return `<pre style="white-space:pre-wrap">${escapeHTML(JSON.stringify(obj,null,2))}</pre>`; }
function warn(t){ return `<p style="color:#ffb020">${t}</p>`; }
function err(t){ return `<p style="color:#ff4757">Error: ${escapeHTML(t)}</p>`; }
function escapeHTML(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
