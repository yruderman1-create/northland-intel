import { useState, useEffect } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEAL_TYPES = [
  'Rezoning / POD Filing', 'Land Transaction', 'Site Plan Submission',
  'Construction Permit', 'Lease-Up / Delivery', 'Developer Announcement',
  'Offering Memorandum', 'Other / General',
];
const SOURCES = [
  'County Planning Portal', 'Deed Records', 'Local Business Journals',
  'State Corporate Filings', 'Google News', 'CoStar (Public)',
  'Permit Database', 'Zoning Board Records',
];
const STORE = 'nli-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } };
const save = d => localStorage.setItem(STORE, JSON.stringify(d));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── API ──────────────────────────────────────────────────────────────────────
async function claude(system, user) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  const block = data.content?.find(b => b.type === 'text');
  return block?.text || '';
}

// ─── Research ─────────────────────────────────────────────────────────────────
async function research(deal, patch) {
  // Stagger source chips
  for (let i = 0; i < SOURCES.length; i++) {
    await sleep(420);
    patch(d => ({ ...d, sources: [...(d.sources || []), SOURCES[i]] }));
  }

  const sys = `You are a senior CRE research analyst at Northland Investment Corporation ($8B AUM, 27,000+ multifamily units). Research market signals and return ONLY valid JSON — no markdown, no preamble:
{
  "findings": [{ "source": "SOURCE", "text": "Finding text.", "highlight": true }],
  "metrics": { "units": "—", "zoning": "—", "parking": "—", "stage": "—" },
  "summary": "2-3 sentence narrative.",
  "relevance": 75,
  "angles": ["Research angle 1", "Research angle 2", "Research angle 3"]
}`;

  const usr = `Signal: ${deal.name}
Address: ${deal.address || 'N/A'}
Market: ${deal.market || 'N/A'}
Type: ${deal.type}
Notes: ${deal.notes || 'None'}

Produce 5-7 findings from varied sources. Flag competitive threats or acquisition opportunities. Include 3 specific follow-up research angles.`;

  let parsed;
  try {
    const raw = await claude(sys, usr);
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    patch(d => ({ ...d, status: 'error', error: e.message }));
    return;
  }

  patch(d => ({
    ...d,
    findings: parsed.findings || [],
    metrics: parsed.metrics || d.metrics,
    summary: parsed.summary || '',
    relevance: parsed.relevance || 0,
    angles: parsed.angles || [],
  }));

  // Email draft
  const emailSys = `Draft a Northland executive intelligence email. Rules: open "Team,", short narrative paragraphs only, wrap section labels in **asterisks**, close "Thanks, [name].", under 200 words, never mention gross SF, always surface parking ratios.`;
  const emailUsr = `Deal: ${deal.name} | Market: ${deal.market}
Summary: ${parsed.summary}
Units: ${parsed.metrics?.units} | Zoning: ${parsed.metrics?.zoning} | Parking: ${parsed.metrics?.parking} | Stage: ${parsed.metrics?.stage}
Findings: ${(parsed.findings || []).slice(0, 3).map(f => f.text).join(' | ')}`;

  try {
    const draft = await claude(emailSys, emailUsr);
    patch(d => ({ ...d, status: 'complete', draft }));
  } catch {
    patch(d => ({ ...d, status: 'complete', draft: '' }));
  }
}

// ─── N Mark SVG ───────────────────────────────────────────────────────────────
function NMark({ size = 100, color = '#FFFFFF', animate = false }) {
  const r1 = 46, r2 = 40;
  const c1 = +(2 * Math.PI * r1).toFixed(2);
  const c2 = +(2 * Math.PI * r2).toFixed(2);
  const dur = (s, d) => animate ? { strokeDasharray: s, strokeDashoffset: s, animation: `drawPath ${d}s ease ${animate}s forwards` } : {};
  const fad = d => animate ? { opacity: 0, animation: `fadeIn 0.3s ease ${animate + d}s forwards` } : {};
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r={r1} stroke={color} strokeWidth="0.6" style={dur(c1, 1.4)} />
      <circle cx="50" cy="50" r={r2} stroke={color} strokeWidth="0.35" style={dur(c2, 1.4)} />
      <path d="M30 67V33" stroke={color} strokeWidth="3.2" strokeLinecap="butt" style={dur(400, 0.3)} />
      <path d="M30 33L70 67" stroke={color} strokeWidth="3.2" strokeLinecap="butt" style={dur(400, 0.4)} />
      <path d="M70 33V67" stroke={color} strokeWidth="3.2" strokeLinecap="butt" style={dur(400, 0.3)} />
      <path d="M24 33L30 27L36 33" stroke={color} strokeWidth="0.7" fill="none" style={fad(1.1)} />
      <path d="M64 33L70 27L76 33" stroke={color} strokeWidth="0.7" fill="none" style={fad(1.1)} />
      <path d="M44 67L50 74L56 67" stroke={color} strokeWidth="0.7" fill="none" style={fad(1.1)} />
    </svg>
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────
function Splash({ onDone }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2600);
    const t2 = setTimeout(onDone, 3200);
    return () => [t1, t2].forEach(clearTimeout);
  }, []);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#080808', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: out ? 0 : 1, transition: 'opacity .6s ease', pointerEvents: 'none',
    }}>
      <NMark size={180} color="#FFFFFF" animate={0.2} />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [splash, setSplash]     = useState(true);
  const [deals, setDeals]       = useState(load);
  const [sel, setSel]           = useState(null);
  const [market, setMarket]     = useState('all');
  const [tab, setTab]           = useState('brief');
  const [modal, setModal]       = useState(false);
  const [copied, setCopied]     = useState(false);
  const [form, setForm]         = useState({ name:'', address:'', market:'', type:DEAL_TYPES[0], notes:'' });

  useEffect(() => { save(deals); }, [deals]);
  useEffect(() => {
    if (!sel) return;
    const live = deals.find(d => d.id === sel.id);
    if (live) setSel(live);
  }, [deals]);

  const markets  = [...new Set(deals.map(d => d.market).filter(Boolean))].sort();
  const filtered = market === 'all' ? deals : deals.filter(d => d.market === market);

  function patch(id, fn) {
    setDeals(prev => {
      const next = prev.map(d => d.id === id ? (typeof fn === 'function' ? fn(d) : { ...d, ...fn }) : d);
      save(next); return next;
    });
  }

  function submit() {
    if (!form.name.trim()) return;
    const nd = {
      id: Date.now().toString(), ...form,
      name: form.name.trim(), address: form.address.trim(), market: form.market.trim(), notes: form.notes.trim(),
      status: 'researching', createdAt: new Date().toISOString(),
      sources: [], findings: [], metrics: { units:'—', zoning:'—', parking:'—', stage:'—' },
      summary: '', relevance: 0, angles: [], draft: '', error: '',
    };
    setDeals(prev => { const n = [nd, ...prev]; save(n); return n; });
    setSel(nd); setTab('brief'); setModal(false);
    setForm({ name:'', address:'', market:'', type:DEAL_TYPES[0], notes:'' });
    research(nd, fn => patch(nd.id, fn));
  }

  function rerun(deal) {
    const fresh = { ...deal, status:'researching', sources:[], findings:[], summary:'', relevance:0, angles:[], draft:'', error:'' };
    patch(deal.id, fresh);
    research(fresh, fn => patch(deal.id, fn));
  }

  function del(id) {
    setDeals(prev => { const n = prev.filter(d => d.id !== id); save(n); return n; });
    if (sel?.id === id) setSel(null);
  }

  function copy(text) {
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function emailRender(text) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <span key={i} style={{ background:'rgba(26,77,26,.25)', color:'#5CB85C', fontWeight:600 }}>{p.slice(2,-2)}</span>
        : <span key={i}>{p}</span>
    );
  }

  if (splash) return <Splash onDone={() => setSplash(false)} />;

  return (
    <div style={S.app}>

      {/* Header */}
      <header style={S.hdr}>
        <div style={S.hdrL}>
          <NMark size={32} color="#FFFFFF" />
          <div>
            <div style={S.hdrName}>NORTHLAND</div>
            <div style={S.hdrSub}>Market Intelligence</div>
          </div>
        </div>
        <div style={S.hdrR}>
          {deals.filter(d=>d.status==='researching').length > 0 && (
            <div style={S.badge}>
              <span style={S.pulse}/> {deals.filter(d=>d.status==='researching').length} researching
            </div>
          )}
          <span style={S.stat}><b>{deals.length}</b> deals</span>
          <span style={S.stat}><b>{markets.length}</b> markets</span>
          <a href="https://northland.com" target="_blank" rel="noreferrer" style={S.btnGhost}>northland.com ↗</a>
          <button style={S.btnGreen} onClick={() => setModal(true)}>+ New Deal</button>
        </div>
      </header>

      {/* Sidebar */}
      <aside style={S.side}>
        <div style={S.sideTop}>
          <div style={S.sideLabel}>Markets</div>
          <Mkt label="All Markets" count={deals.length} active={market==='all'} onClick={() => setMarket('all')} />
          {markets.map(m => <Mkt key={m} label={m} count={deals.filter(d=>d.market===m).length} active={market===m} onClick={() => setMarket(m)} />)}
          {markets.length === 0 && <div style={S.sideHint}>Markets appear as you add deals.</div>}
        </div>
        <div style={S.sideBot}>
          <div style={S.sideLabel}>Pipeline</div>
          {filtered.length === 0 && <div style={S.sideHint}>No deals yet.</div>}
          {filtered.map(d => (
            <div key={d.id} style={S.drow(sel?.id===d.id)} onClick={() => { setSel(d); setTab('brief'); }}>
              <div style={S.drowName}>{d.name}</div>
              <div style={S.drowMeta}>
                <span style={{ ...S.dot, background: d.status==='complete'?'#4CAF50':d.status==='researching'?'#1A4D1A':'#555', ...(d.status==='researching'?{animation:'pulse 1s infinite'}:{}) }}/>
                {d.status==='researching'?'Researching':d.status==='complete'?'Complete':'Error'}
                {d.market && <> · {d.market}</>}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        {modal && (
          <div style={S.overlay} onClick={() => setModal(false)}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.mhdr}>
                <div style={S.mtitle}>New Deal</div>
                <button style={S.mclose} onClick={() => setModal(false)}>✕</button>
              </div>
              <Row>
                <F label="Project / Site Name *"><input style={S.inp} placeholder="e.g. 4650 Cox Road…" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></F>
                <F label="Market / Location"><input style={S.inp} placeholder="e.g. Richmond VA, Dubai…" value={form.market} onChange={e=>setForm(f=>({...f,market:e.target.value}))} /></F>
              </Row>
              <Row>
                <F label="Address / Parcel" style={{flex:2}}><input style={S.inp} placeholder="Street address or parcel ID" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} /></F>
                <F label="Deal Type"><select style={S.inp} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{DEAL_TYPES.map(t=><option key={t}>{t}</option>)}</select></F>
              </Row>
              <F label="Notes / Context" style={{marginBottom:24}}>
                <textarea style={{...S.inp,minHeight:80,resize:'vertical'}} placeholder="Developer, unit count, source, competitive concern…" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
              </F>
              <div style={{display:'flex',gap:10}}>
                <button style={S.btnGreen} onClick={submit} disabled={!form.name.trim()}>Add Deal + Research</button>
                <button style={S.btnGhost} onClick={() => setModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {!sel ? (
          <div style={S.empty}>
            <div style={{opacity:.2,marginBottom:16}}><NMark size={72} color="#FFFFFF" /></div>
            <div style={S.emptyTitle}>No Deal Selected</div>
            <div style={S.emptySub}>Add a deal and the AI will research everything publicly available — planning filings, deed records, local press, competitor activity.</div>
            <button style={S.btnGreen} onClick={() => setModal(true)}>+ New Deal</button>
          </div>
        ) : (
          <div style={S.card}>
            {/* Card header */}
            <div style={S.chdr}>
              <div>
                <div style={S.cname}>{sel.name}</div>
                <div style={S.cmeta}>{sel.address && <>{sel.address} · </>}{sel.market && <>{sel.market} · </>}Added {fmt(sel.createdAt)}</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <Chip>{sel.type}</Chip>
                <SChip status={sel.status} />
                <button style={S.xbtn} onClick={() => del(sel.id)}>✕</button>
              </div>
            </div>

            {/* Metrics */}
            <div style={S.metrics}>
              {[{l:'Units',v:sel.metrics?.units},{l:'Zoning',v:sel.metrics?.zoning},{l:'Parking',v:sel.metrics?.parking},{l:'Stage',v:sel.metrics?.stage}].map(({l,v})=>(
                <div key={l} style={S.mc}>
                  <div style={S.ml}>{l}</div>
                  <div style={{...S.mv,color:(!v||v==='—')?'var(--g3)':'var(--white)'}}>{v||'—'}</div>
                </div>
              ))}
              {sel.status==='complete'&&sel.relevance>0&&(
                <div style={{...S.mc,borderLeft:'1px solid var(--border)',paddingLeft:20}}>
                  <div style={S.ml}>Relevance</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                    <div style={{width:72,height:2,background:'var(--border2)'}}>
                      <div style={{width:`${sel.relevance}%`,height:'100%',background:'var(--green)',transition:'width 1s ease'}}/>
                    </div>
                    <span style={{...S.mv,fontSize:12}}>{sel.relevance}/100</span>
                  </div>
                </div>
              )}
            </div>

            {/* Research body */}
            <div style={S.body}>
              {/* Source chips */}
              {(sel.sources||[]).length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={S.secLabel}>Sources Scanned</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {SOURCES.map(s=>(
                      <span key={s} style={{fontFamily:'var(--mono)',fontSize:10,padding:'3px 8px',borderRadius:0,border:`1px solid ${sel.sources.includes(s)?'var(--border2)':'var(--border)'}`,color:sel.sources.includes(s)?'var(--white)':'var(--g3)',background:sel.sources.includes(s)?'var(--surface2)':'transparent',transition:'all .2s'}}>
                        {sel.sources.includes(s)?'✓ ':''}{s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sel.status==='researching'&&!sel.summary&&(
                <div style={{display:'flex',alignItems:'center',gap:10,color:'var(--g1)',fontFamily:'var(--mono)',fontSize:12,padding:'8px 0'}}>
                  <span style={{...S.pulse,background:'var(--green)'}}/> Researching across all sources…
                </div>
              )}

              {sel.summary&&(
                <div style={{marginBottom:24}}>
                  <div style={S.secLabel}>Summary</div>
                  <div style={{borderLeft:'1px solid var(--green)',paddingLeft:14,fontSize:13,color:'var(--off)',lineHeight:1.75}}>{sel.summary}</div>
                </div>
              )}

              {(sel.findings||[]).length>0&&(
                <div style={{marginBottom:24}}>
                  <div style={S.secLabel}>Findings</div>
                  {sel.findings.map((f,i)=>(
                    <div key={i} style={{borderLeft:`1px solid ${f.highlight?'var(--green)':'var(--border2)'}`,paddingLeft:12,paddingTop:8,paddingBottom:8,marginBottom:10}}>
                      <div style={{fontFamily:'var(--mono)',fontSize:9,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:f.highlight?'#5CB85C':'var(--g2)',marginBottom:4}}>{f.source}</div>
                      <div style={{fontSize:13,color:'var(--g1)',lineHeight:1.55}}>{f.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {(sel.angles||[]).length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={S.secLabel}>Follow-up Angles</div>
                  {sel.angles.map((a,i)=>(
                    <div key={i} style={{display:'flex',gap:10,fontSize:12,color:'var(--g1)',padding:'6px 10px',background:'var(--surface2)',marginBottom:4}}>
                      <span style={{color:'var(--green2)',flexShrink:0}}>→</span>{a}
                    </div>
                  ))}
                </div>
              )}

              {sel.status==='error'&&<div style={{color:'#E07070',fontSize:12,marginBottom:12,fontFamily:'var(--mono)'}}>{sel.error||'Research failed.'}</div>}
              {(sel.status==='complete'||sel.status==='error')&&(
                <button style={S.btnGhost} onClick={() => rerun(sel)}>↺ Re-run Research</button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Right panel */}
      <aside style={S.rpanel}>
        <div style={S.rtabs}>
          {[['brief','Brief'],['email','Exec Email'],['notes','Notes']].map(([id,lbl])=>(
            <button key={id} style={S.rtab(tab===id)} onClick={()=>setTab(id)}>{lbl}</button>
          ))}
        </div>
        <div style={S.rcontent}>
          {!sel?(
            <div style={{color:'var(--g2)',fontFamily:'var(--mono)',fontSize:11,lineHeight:1.8}}>Select a deal.</div>
          ):tab==='brief'?(
            <>
              {sel.status==='researching'&&<div style={{color:'var(--g2)',fontFamily:'var(--mono)',fontSize:11}}>Brief appears when research completes…</div>}
              {sel.summary&&<div style={{borderLeft:'1px solid var(--green)',paddingLeft:12,fontSize:13,color:'var(--off)',lineHeight:1.75,marginBottom:16}}>{sel.summary}</div>}
              {sel.summary&&[{l:'Market',v:sel.market},{l:'Type',v:sel.type},{l:'Units',v:sel.metrics?.units},{l:'Zoning',v:sel.metrics?.zoning},{l:'Parking',v:sel.metrics?.parking},{l:'Stage',v:sel.metrics?.stage},{l:'Relevance',v:sel.relevance?`${sel.relevance}/100`:'—'}].map(({l,v})=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',borderBottom:'1px solid var(--border)',padding:'7px 0'}}>
                  <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--g3)',textTransform:'uppercase',letterSpacing:'.08em'}}>{l}</span>
                  <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--white)'}}>{v||'—'}</span>
                </div>
              ))}
            </>
          ):tab==='email'?(
            <>
              {sel.status==='researching'&&<div style={{color:'var(--g2)',fontFamily:'var(--mono)',fontSize:11}}>Generating…</div>}
              {sel.draft&&<>
                <div style={{background:'var(--surface2)',border:'1px solid var(--border)',padding:14,fontSize:13,color:'var(--off)',lineHeight:1.8,whiteSpace:'pre-wrap',marginBottom:10}}>{emailRender(sel.draft)}</div>
                <button style={{...S.btnGhost,width:'100%',textAlign:'center'}} onClick={()=>copy(sel.draft)}>{copied?'✓ Copied':'Copy to Clipboard'}</button>
              </>}
            </>
          ):(
            <>
              <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--g3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>Notes</div>
              <div style={{fontSize:13,color:'var(--g1)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{sel.notes||<span style={{color:'var(--g3)'}}>No notes.</span>}</div>
              {sel.address&&<><div style={{...S.secLabel,marginTop:16}}>Address</div><div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--g1)'}}>{sel.address}</div></>}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────
function Mkt({ label, count, active, onClick }) {
  return (
    <button style={S.mktBtn(active)} onClick={onClick}>
      <span>{label}</span>
      <span style={S.mktCount}>{count||''}</span>
    </button>
  );
}
function F({ label, children, style }) {
  return <div style={{flex:1,display:'flex',flexDirection:'column',gap:5,...style}}><div style={S.flabel}>{label}</div>{children}</div>;
}
function Row({ children }) { return <div style={{display:'flex',gap:12,marginBottom:12}}>{children}</div>; }
function Chip({ children }) { return <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--g2)',border:'1px solid var(--border)',padding:'3px 8px'}}>{children}</span>; }
function SChip({ status }) {
  const m = { complete:{c:'#4CAF50',t:'Complete'}, researching:{c:'#1A4D1A',t:'Researching…'}, error:{c:'#8B3333',t:'Error'} }[status]||{};
  return <span style={{fontFamily:'var(--mono)',fontSize:10,color:m.c,border:`1px solid ${m.c}`,padding:'3px 8px',opacity:.9}}>{m.t}</span>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app: { display:'grid', gridTemplateColumns:'220px 1fr 300px', gridTemplateRows:'52px 1fr', height:'100vh', overflow:'hidden' },

  hdr:  { gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 20px' },
  hdrL: { display:'flex', alignItems:'center', gap:10 },
  hdrName: { fontFamily:'var(--sans)', fontWeight:600, fontSize:13, letterSpacing:'.2em', color:'var(--white)' },
  hdrSub:  { fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.14em', color:'var(--g2)', textTransform:'uppercase' },
  hdrR: { display:'flex', alignItems:'center', gap:16 },
  badge: { display:'flex', alignItems:'center', gap:7, fontFamily:'var(--mono)', fontSize:11, color:'#5CB85C' },
  stat:  { fontFamily:'var(--mono)', fontSize:11, color:'var(--g2)' },
  pulse: { display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#5CB85C', flexShrink:0, animation:'pulse 1.2s infinite' },
  dot:   { display:'inline-block', width:5, height:5, borderRadius:'50%', flexShrink:0 },

  btnGreen: { background:'var(--green)', color:'var(--white)', border:'none', fontFamily:'var(--sans)', fontSize:12, fontWeight:500, padding:'8px 16px', cursor:'pointer', letterSpacing:'.04em', transition:'background .15s' },
  btnGhost: { background:'transparent', color:'var(--g1)', border:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:11, padding:'7px 14px', cursor:'pointer', textDecoration:'none', display:'inline-block' },

  side:   { background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' },
  sideTop:{ padding:'16px 14px', borderBottom:'1px solid var(--border)' },
  sideBot:{ flex:1, overflowY:'auto', padding:'16px 14px' },
  sideLabel: { fontFamily:'var(--mono)', fontSize:9, fontWeight:600, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--g3)', marginBottom:10 },
  sideHint:  { fontFamily:'var(--mono)', fontSize:11, color:'var(--g3)', lineHeight:1.7 },
  mktBtn: a => ({ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', padding:'6px 8px', border:'none', borderLeft:`1px solid ${a?'var(--green)':'transparent'}`, background:a?'var(--surface2)':'transparent', color:a?'var(--white)':'var(--g1)', fontFamily:'var(--mono)', fontSize:12, cursor:'pointer', marginBottom:2, textAlign:'left' }),
  mktCount: { fontFamily:'var(--mono)', fontSize:10, color:'var(--g3)' },
  drow:  a => ({ padding:'8px', borderLeft:`1px solid ${a?'var(--green)':'transparent'}`, background:a?'var(--surface2)':'transparent', cursor:'pointer', marginBottom:2 }),
  drowName: { fontFamily:'var(--mono)', fontSize:11, fontWeight:500, color:'var(--white)', marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  drowMeta: { fontFamily:'var(--mono)', fontSize:10, color:'var(--g2)', display:'flex', alignItems:'center', gap:5 },

  main:  { overflowY:'auto', padding:24, background:'var(--bg)' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 },
  modal:   { background:'var(--surface)', border:'1px solid var(--border)', padding:28, width:620, maxWidth:'95vw' },
  mhdr:    { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  mtitle:  { fontFamily:'var(--serif)', fontSize:20, fontWeight:400, color:'var(--white)' },
  mclose:  { background:'none', border:'none', color:'var(--g2)', fontSize:16, cursor:'pointer' },
  flabel:  { fontFamily:'var(--mono)', fontSize:9, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--g2)' },
  inp:     { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--white)', fontFamily:'var(--mono)', fontSize:12, padding:'8px 10px', outline:'none', width:'100%', borderRadius:0 },

  empty:     { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'65vh', gap:14, textAlign:'center', padding:40 },
  emptyTitle:{ fontFamily:'var(--serif)', fontSize:22, fontWeight:400, color:'var(--white)' },
  emptySub:  { fontSize:13, color:'var(--g2)', lineHeight:1.75, maxWidth:400 },

  card:  { background:'var(--surface)', border:'1px solid var(--border)' },
  chdr:  { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'18px 20px', borderBottom:'1px solid var(--border)', gap:16 },
  cname: { fontFamily:'var(--serif)', fontSize:20, fontWeight:400, color:'var(--white)', marginBottom:5 },
  cmeta: { fontFamily:'var(--mono)', fontSize:10, color:'var(--g2)' },
  xbtn:  { background:'transparent', border:'1px solid var(--border)', color:'var(--g2)', cursor:'pointer', padding:'4px 7px', fontFamily:'var(--mono)', fontSize:11 },

  metrics: { display:'flex', alignItems:'center', background:'var(--surface2)', borderBottom:'1px solid var(--border)', padding:'0 20px' },
  mc:  { padding:'13px 20px 13px 0', marginRight:16 },
  ml:  { fontFamily:'var(--mono)', fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--g3)', marginBottom:4 },
  mv:  { fontFamily:'var(--serif)', fontSize:15, fontWeight:400 },

  body:     { padding:'20px' },
  secLabel: { fontFamily:'var(--mono)', fontSize:9, fontWeight:600, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--g3)', marginBottom:10 },

  rpanel:  { background:'var(--surface)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' },
  rtabs:   { display:'flex', borderBottom:'1px solid var(--border)' },
  rtab:  a => ({ flex:1, padding:'13px 6px', fontFamily:'var(--mono)', fontSize:9, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:a?'var(--white)':'var(--g2)', background:'transparent', border:'none', cursor:'pointer', borderBottom:`1px solid ${a?'var(--green)':'transparent'}` }),
  rcontent:{ flex:1, overflowY:'auto', padding:16 },
};
