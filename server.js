require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // v2
const cors = require('cors');
const dns = require('dns').promises;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors()); // simple: allow Netlify origin

const PORT = process.env.PORT || 3000;
const HUNTER_KEY = process.env.HUNTER_API_KEY || '';
const CLEARBIT_KEY = process.env.CLEARBIT_API_KEY || '';
const IPINFO_TOKEN = process.env.IPINFO_TOKEN || '';
const HIBP_KEY = process.env.HIBP_API_KEY || '';

function bad(msg, code=400){ const e = new Error(msg); e.status = code; throw e; }
async function j(url, opt){ const r = await fetch(url, opt); if(!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); }

// PERSON (email or domain) via Hunter.io
app.post('/api/person', async (req,res,next)=>{
  try {
    const { query } = req.body || {};
    if(!query) bad('Missing query');

    const result = { query };
    if(!HUNTER_KEY){
      result.note = 'Set HUNTER_API_KEY to enable live data';
      return res.json(result);
    }

    if(/\S+@\S+\.\S+/.test(query)){
      const ver = await j(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(query)}&api_key=${HUNTER_KEY}`);
      result.hunterVerifier = ver.data || ver;
    } else {
      const domain = query.replace(/^https?:\/\//,'').split('/')[0];
      const find = await j(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_KEY}&limit=10`);
      result.hunterDomain = find.data || find;
    }

    res.json(result);
  } catch (e){ next(e); }
});

// EMAIL enrichment via Clearbit (optional)
app.post('/api/email', async (req,res,next)=>{
  try {
    const { email } = req.body || {};
    if(!email) bad('Missing email');
    const out = { email };

    if(CLEARBIT_KEY){
      const r = await fetch(`https://person.clearbit.com/v2/combined/find?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${CLEARBIT_KEY}` }
      });
      if(r.status === 200) out.clearbit = await r.json();
      else out.status = r.status;
    } else {
      out.note = 'Set CLEARBIT_API_KEY for enrichment';
    }

    res.json(out);
  } catch (e){ next(e); }
});

// BREACH check via HaveIBeenPwned (optional; paid key, strict rate limits)
app.post('/api/breach', async (req,res,next)=>{
  try {
    const { email } = req.body || {};
    if(!email) bad('Missing email');
    if(!HIBP_KEY) return res.json({ email, note:'Set HIBP_API_KEY to enable breach check' });

    const r = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
      headers: { 'hibp-api-key': HIBP_KEY, 'User-Agent': 'osint-pro' }
    });
    if(r.status === 404) return res.json({ email, breaches: [] });
    if(!r.ok) return res.status(r.status).json({ email, error: await r.text() });
    const breaches = await r.json();
    res.json({ email, breaches });
  } catch (e){ next(e); }
});

// DOMAIN recon: DNS + IP geolocation
app.post('/api/domain', async (req,res,next)=>{
  try {
    let { domain } = req.body || {};
    if(!domain) bad('Missing domain');
    domain = domain.replace(/^https?:\/\//,'').split('/')[0];

    const out = { domain, dns:{} };
    try{ out.dns.a = await dns.resolve4(domain); }catch{}
    try{ out.dns.aaaa = await dns.resolve6(domain); }catch{}
    try{ out.dns.mx = await dns.resolveMx(domain); }catch{}
    try{ out.dns.txt = await dns.resolveTxt(domain); }catch{}
    try{ out.dns.ns = await dns.resolveNs(domain); }catch{}

    out.ipGeo = [];
    for(const ip of (out.dns.a || []).slice(0,5)){
      if(!IPINFO_TOKEN){ out.ipGeo.push({ ip, note:'Set IPINFO_TOKEN for geo' }); continue; }
      try{
        const info = await j(`https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`);
        const [lat,lng] = (info.loc || '').split(',').map(Number);
        out.ipGeo.push({ ip, city:info.city, region:info.region, country:info.country, org:info.org, latitude:lat, longitude:lng });
      }catch(e){ out.ipGeo.push({ ip, error: e.message }); }
    }

    res.json(out);
  } catch (e){ next(e); }
});

// errors
app.use((err,req,res,next)=> res.status(err.status||500).json({ error: err.message || 'Server error' }));
app.listen(PORT, ()=> console.log(`OSINT API on :${PORT}`));
