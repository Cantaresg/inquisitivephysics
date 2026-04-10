/**
 * draw-history.js — Stage 5 History Card
 * Depends on: history-data.js
 * Optional: data-logger.js (graceful fallback if absent)
 *
 * Usage:
 *   const hist = DrawHistory.create(containerEl);
 *   hist.onComplete(responses => { ... });
 *   hist.start();
 *
 * Alias read from DataLogger.getAlias() if available, else 'anonymous'.
 * Same alias → same MCQ draw every time. Different aliases → different draws.
 */

const DrawHistory = (() => {

  // ── SEEDED PRNG ────────────────────────────────────────────────────────────
  function _hashAlias(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0;
    }
    return h;
  }

  function _makePRNG(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function _shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function _pick(arr, n, rng) {
    return _shuffle(arr, rng).slice(0, Math.min(n, arr.length));
  }

  // ── ALIAS ──────────────────────────────────────────────────────────────────
  function _getAlias() {
    try {
      if (typeof DataLogger !== 'undefined' && DataLogger.getAlias) {
        return DataLogger.getAlias() || 'anonymous';
      }
    } catch (e) {}
    return 'anonymous';
  }

  // ── SVG FIGURES ────────────────────────────────────────────────────────────
  const FIGURES = {
    tower: `<svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" class="hist-fig">
      <line x1="20" y1="165" x2="200" y2="165" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
      <g transform="rotate(-4,110,165)">
        <rect x="78" y="40" width="44" height="125" rx="3" fill="#1a2035" stroke="#2e3a58" stroke-width="1.5"/>
        <line x1="78" y1="70"  x2="122" y2="70"  stroke="#2e3a58" stroke-width="1"/>
        <line x1="78" y1="100" x2="122" y2="100" stroke="#2e3a58" stroke-width="1"/>
        <line x1="78" y1="130" x2="122" y2="130" stroke="#2e3a58" stroke-width="1"/>
        <rect x="72" y="32" width="56" height="12" rx="2" fill="#243050" stroke="#3a4e78" stroke-width="1"/>
        <ellipse cx="100" cy="72" rx="8" ry="6" fill="none" stroke="#2e3a58" stroke-width="1"/>
        <ellipse cx="100" cy="102" rx="8" ry="6" fill="none" stroke="#2e3a58" stroke-width="1"/>
      </g>
      <circle cx="96" cy="80" r="7" fill="#8899bb" stroke="#c77dff" stroke-width="1.2"/>
      <circle cx="118" cy="80" r="4" fill="#c8c4b8" stroke="#ffd16699" stroke-width="1"/>
      <line x1="96" y1="88" x2="96" y2="155" stroke="#c77dff44" stroke-width="1.5" stroke-dasharray="3,5"/>
      <line x1="118" y1="85" x2="118" y2="155" stroke="#ffd16644" stroke-width="1.5" stroke-dasharray="3,5"/>
      <text x="148" y="110" font-family="DM Sans,sans-serif" font-size="32" font-weight="700" fill="rgba(255,209,102,0.25)" text-anchor="middle">?</text>
      <text x="96"  y="172" font-family="DM Mono,monospace" font-size="9" fill="#c77dffaa" text-anchor="middle">heavy</text>
      <text x="118" y="172" font-family="DM Mono,monospace" font-size="9" fill="#ffd166aa" text-anchor="middle">light</text>
    </svg>`,
    ramp: `<svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" class="hist-fig">
      <line x1="10" y1="158" x2="210" y2="158" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>
      <polygon points="30,158 190,158 190,60" fill="#18243c" stroke="#3a4e78" stroke-width="1.5"/>
      <line x1="30" y1="158" x2="190" y2="60" stroke="#4a5e8c" stroke-width="2"/>
      <line x1="38" y1="158" x2="184" y2="67" stroke="#2e3e64" stroke-width="3"/>
      <circle cx="95" cy="117" r="10" fill="#8899bb" stroke="#c77dff" stroke-width="1.5"/>
      <circle cx="89" cy="112" r="3" fill="rgba(255,255,255,0.25)"/>
      <line x1="105" y1="111" x2="145" y2="89" stroke="#4df0b066" stroke-width="1.5" stroke-dasharray="4,4"/>
      <polygon points="145,89 136,90 140,98" fill="#4df0b066"/>
      <path d="M 190,158 A 30,30 0 0,0 172,131" fill="none" stroke="rgba(77,240,176,0.4)" stroke-width="1.2"/>
      <text x="175" y="150" font-family="DM Mono,monospace" font-size="10" fill="rgba(77,240,176,0.6)">30°</text>
      <text x="95" y="100" font-family="DM Mono,monospace" font-size="10" fill="rgba(77,240,176,0.55)" text-anchor="middle" transform="rotate(-27,95,100)">L</text>
      <rect x="14" y="90" width="18" height="28" rx="3" fill="#1a2035" stroke="#253450" stroke-width="1"/>
      <line x1="23" y1="118" x2="23" y2="128" stroke="#4df0b066" stroke-width="1.5"/>
      <text x="23" y="138" font-family="DM Mono,monospace" font-size="8" fill="#4df0b066" text-anchor="middle">clock</text>
    </svg>`,
    method: `<svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" class="hist-fig">
      <defs><marker id="hist-ah" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="rgba(77,240,176,0.5)"/></marker></defs>
      <circle cx="110" cy="90" r="72" fill="none" stroke="#1e2840" stroke-width="1"/>
      <circle cx="110" cy="22" r="22" fill="#1a2035" stroke="#3a4e78" stroke-width="1.5"/>
      <text x="110" y="18" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="#a8b4d0" text-anchor="middle">ISOLATE</text>
      <text x="110" y="29" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="#a8b4d0" text-anchor="middle">VARIABLE</text>
      <circle cx="185" cy="128" r="22" fill="#1a2035" stroke="#3a4e78" stroke-width="1.5"/>
      <text x="185" y="124" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="#a8b4d0" text-anchor="middle">MEASURE</text>
      <text x="185" y="135" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="#a8b4d0" text-anchor="middle">REPEAT</text>
      <circle cx="35" cy="128" r="22" fill="#1a2035" stroke="#3a4e78" stroke-width="1.5"/>
      <text x="35" y="124" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="#a8b4d0" text-anchor="middle">FIND THE</text>
      <text x="35" y="135" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="#a8b4d0" text-anchor="middle">PATTERN</text>
      <path d="M 126,38 Q 168,60 170,108" fill="none" stroke="rgba(77,240,176,0.4)" stroke-width="1.5" marker-end="url(#hist-ah)"/>
      <path d="M 163,142 Q 110,175 57,142" fill="none" stroke="rgba(77,240,176,0.4)" stroke-width="1.5" marker-end="url(#hist-ah)"/>
      <path d="M 50,108 Q 52,60 94,38" fill="none" stroke="rgba(77,240,176,0.4)" stroke-width="1.5" marker-end="url(#hist-ah)"/>
      <text x="110" y="86" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="rgba(199,125,255,0.7)" text-anchor="middle">Scientific</text>
      <text x="110" y="100" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="rgba(199,125,255,0.7)" text-anchor="middle">Method</text>
    </svg>`,
  };

  // ── CSS ────────────────────────────────────────────────────────────────────
  const CSS = `
    .hist-wrap { font-family:'DM Sans',sans-serif; color:var(--text,#eef2ff); max-width:680px; margin:0 auto; padding:24px 20px 40px; }
    .hist-progress { display:flex; align-items:center; gap:8px; margin-bottom:28px; }
    .hist-pip { width:28px; height:4px; border-radius:2px; background:var(--border,#252d42); transition:background 0.4s; }
    .hist-pip.done { background:var(--accent,#4df0b0); }
    .hist-pip.cur  { background:var(--gold,#ffd166); }
    .hist-prog-lbl { margin-left:auto; font-family:'DM Mono',monospace; font-size:0.62rem; color:var(--text-dim,#6b7a99); letter-spacing:0.08em; }
    .hist-section {
      background:var(--surface,#111520); border:1px solid var(--border,#252d42);
      border-radius:14px; padding:28px 28px 24px; margin-bottom:20px;
      opacity:0; transform:translateY(18px); pointer-events:none; visibility:hidden;
      transition:opacity 0.5s ease, transform 0.5s ease, visibility 0s 0.5s;
    }
    .hist-section.visible { opacity:1; transform:translateY(0); pointer-events:auto; visibility:visible; transition:opacity 0.5s ease, transform 0.5s ease, visibility 0s 0s; }
    .hist-tag { font-family:'DM Mono',monospace; font-size:0.62rem; letter-spacing:0.12em; font-weight:500; margin-bottom:8px; }
    .hist-heading { font-size:1.18rem; font-weight:700; color:var(--text,#eef2ff); margin-bottom:16px; line-height:1.3; }
    .hist-fig-wrap { float:right; margin:0 0 12px 20px; width:130px; }
    .hist-fig { width:100%; height:auto; display:block; }
    @media(max-width:520px){ .hist-fig-wrap{ float:none; margin:0 0 14px 0; width:100%; max-width:180px; } }
    .hist-prose { font-size:0.875rem; line-height:1.75; color:var(--text-mid,#a8b4d0); margin-bottom:20px; }
    .hist-prose p { margin:0 0 0.85em; }
    .hist-prose p:last-child { margin-bottom:0; }
    .hist-prose em { color:var(--text,#eef2ff); font-style:normal; font-weight:600; }
    .hist-clear { clear:both; }
    .hist-canvas-wrap { margin-bottom:16px; }
    .hist-canvas { width:100%; border-radius:10px; background:#0a0c12; display:block; cursor:default; }
    .hist-canvas-btns { display:flex; align-items:center; gap:10px; margin-top:8px; flex-wrap:wrap; }
    .hist-canvas-status { font-family:'DM Mono',monospace; font-size:0.72rem; color:var(--text-dim,#6b7a99); }
    .hist-mcq-gate { transition:opacity 0.4s ease, visibility 0s 0.4s; }
    .hist-mcq-gate.locked { opacity:0; pointer-events:none; visibility:hidden; }
    .hist-mcq-gate.open   { opacity:1; pointer-events:auto; visibility:visible; transition:opacity 0.4s ease, visibility 0s 0s; }
    .hist-mcq { background:var(--bg,#0a0c12); border:1.5px solid var(--border2,#2e3850); border-radius:10px; padding:16px 18px; }
    .hist-mcq-label { font-family:'DM Mono',monospace; font-size:0.6rem; letter-spacing:0.1em; color:var(--text-dim,#6b7a99); text-transform:uppercase; margin-bottom:10px; }
    .hist-mcq-prompt { font-size:0.9rem; font-weight:600; color:var(--text,#eef2ff); margin-bottom:14px; line-height:1.5; }
    .hist-opt {
      display:flex; align-items:flex-start; gap:10px;
      padding:10px 12px; border-radius:8px; margin-bottom:6px;
      border:1.5px solid var(--border2,#2e3850); background:var(--surface2,#161b28);
      cursor:pointer; transition:border-color 0.15s, background 0.15s; user-select:none;
    }
    .hist-opt:hover:not(.locked) { border-color:var(--accent,#4df0b0); background:rgba(77,240,176,0.06); }
    .hist-opt.selected { border-color:var(--accent,#4df0b0); background:rgba(77,240,176,0.10); }
    .hist-opt.locked { cursor:default; }
    .hist-opt-check { width:16px; height:16px; border-radius:4px; border:1.5px solid var(--border2,#2e3850); flex-shrink:0; margin-top:2px; display:flex; align-items:center; justify-content:center; transition:all 0.15s; background:transparent; }
    .hist-opt.selected .hist-opt-check { background:var(--accent,#4df0b0); border-color:var(--accent,#4df0b0); }
    .hist-opt-check-tick { color:#050a0a; font-size:10px; font-weight:700; display:none; }
    .hist-opt.selected .hist-opt-check-tick { display:block; }
    .hist-opt-body { flex:1; min-width:0; }
    .hist-opt-text { font-size:0.82rem; color:var(--text-mid,#a8b4d0); line-height:1.55; }
    .hist-opt.selected .hist-opt-text { color:var(--text,#eef2ff); }
    .hist-opt-divider { border:none; border-top:1px solid var(--border,#252d42); margin:10px 0; }
    .hist-freetext-wrap { display:none; padding:8px 0 2px 0; }
    .hist-freetext-wrap.open { display:block; }
    .hist-freetext { width:100%; background:var(--surface,#111520); border:1.5px solid var(--border2,#2e3850); border-radius:8px; padding:8px 10px; font-family:'DM Mono',monospace; font-size:0.76rem; color:var(--text,#eef2ff); resize:vertical; min-height:60px; outline:none; box-sizing:border-box; transition:border-color 0.15s; }
    .hist-freetext:focus { border-color:var(--purple,#c77dff); }
    .hist-freetext::placeholder { color:var(--text-dim,#6b7a99); }
    .hist-freetext-count { font-family:'DM Mono',monospace; font-size:0.6rem; color:var(--text-dim,#6b7a99); text-align:right; margin-top:4px; transition:color 0.2s; }
    .hist-freetext-count.ready { color:var(--accent,#4df0b0); }
    .hist-reveal { display:none; margin-top:8px; padding:8px 12px; border-radius:6px; font-size:0.78rem; line-height:1.6; }
    .hist-reveal.show { display:block; animation:hist-fadein 0.3s ease; }
    @keyframes hist-fadein { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
    .hist-reveal.correct { background:rgba(77,240,176,0.09); border:1px solid rgba(77,240,176,0.28); }
    .hist-reveal.wrong   { background:rgba(255,107,107,0.08); border:1px solid rgba(255,107,107,0.22); }
    .hist-reveal.missed  { background:rgba(255,209,102,0.07); border:1px solid rgba(255,209,102,0.20); }
    .hist-reveal-badge { font-family:'DM Mono',monospace; font-size:0.58rem; letter-spacing:0.1em; font-weight:600; margin-bottom:5px; }
    .hist-reveal.correct .hist-reveal-badge { color:var(--accent,#4df0b0); }
    .hist-reveal.wrong   .hist-reveal-badge { color:var(--red,#ff6b6b); }
    .hist-reveal.missed  .hist-reveal-badge { color:var(--gold,#ffd166); }
    .hist-reveal-text { color:var(--text-mid,#a8b4d0); }
    .hist-mcq-footer { margin-top:14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .hist-lock-hint { font-family:'DM Mono',monospace; font-size:0.68rem; color:var(--text-dim,#6b7a99); }
    .hist-btn { font-family:'DM Sans',sans-serif; font-size:0.82rem; font-weight:700; padding:9px 20px; border-radius:8px; cursor:pointer; transition:background 0.15s, transform 0.1s; border:1.5px solid var(--accent,#4df0b0); background:var(--accent,#4df0b0); color:#050a0a; }
    .hist-btn:hover  { background:#38d49a; }
    .hist-btn:active { transform:scale(0.97); }
    .hist-btn:disabled { opacity:0.3; cursor:not-allowed; pointer-events:none; background:transparent; color:var(--text-dim,#6b7a99); border-color:var(--border2,#2e3850); }
    .hist-btn.secondary { background:transparent; color:var(--accent,#4df0b0); border-color:var(--border2,#2e3850); }
    .hist-btn.secondary:hover { background:rgba(77,240,176,0.08); border-color:var(--accent,#4df0b0); }
    .hist-cont-btn { display:none; margin-top:14px; }
    .hist-complete { text-align:center; padding:32px 20px; background:rgba(77,240,176,0.06); border:1px solid rgba(77,240,176,0.2); border-radius:14px; display:none; margin-top:4px; }
    .hist-complete.visible { display:block; }
    .hist-complete-icon { font-size:2.4rem; margin-bottom:10px; }
    .hist-complete-title { font-size:1.1rem; font-weight:700; color:var(--accent,#4df0b0); margin-bottom:6px; }
    .hist-complete-sub { font-size:0.82rem; color:var(--text-dim,#6b7a99); line-height:1.65; white-space:pre-line; }
    .hist-source { font-family:'DM Mono',monospace; font-size:0.62rem; color:var(--text-dim,#6b7a99); margin-top:20px; line-height:1.7; }
  `;

  // ── MINI CANVAS ────────────────────────────────────────────────────────────
  function _buildMiniCanvas(onFirstPlay) {
    const ui   = HistoryData.ui;
    const wrap = document.createElement('div');
    wrap.className = 'hist-canvas-wrap';

    const cv = document.createElement('canvas');
    cv.className = 'hist-canvas'; cv.height = 300;
    wrap.appendChild(cv);

    const btnRow = document.createElement('div'); btnRow.className = 'hist-canvas-btns';
    const watchBtn = document.createElement('button');
    watchBtn.className = 'hist-btn'; watchBtn.textContent = ui.watchDropBtn;
    btnRow.appendChild(watchBtn);
    const replayBtn = document.createElement('button');
    replayBtn.className = 'hist-btn secondary'; replayBtn.textContent = ui.replayBtn; replayBtn.style.display = 'none';
    btnRow.appendChild(replayBtn);
    const status = document.createElement('span'); status.className = 'hist-canvas-status';
    btnRow.appendChild(status);
    wrap.appendChild(btnRow);

    // Physics
    const G=9.81, RHO=1.225, DROP_M=2.0, SCALE_PX=90;
    // Layout: TOP = H*0.18 = 54px, BOT = 54 + 2.0*90 = 234px — fits in 300px with 66px for landed tags
    const flat     = {mass:0.005, dragArea:0.060, Cd:1.17};
    const crumpled = {mass:0.005, dragArea:0.004, Cd:0.47};
    let rafId=null, objA, objB, simT, wobA, phase, landedTs, cdTs, cd, hasPlayed=false;

    function _accel(obj,v){ return Math.max(0,G-(0.5*RHO*obj.Cd*obj.dragArea*v*v)/obj.mass); }
    function _rk4(s,v,dt,obj){
      const a1=_accel(obj,v),v2=v+.5*dt*a1,a2=_accel(obj,v2);
      const v3=v+.5*dt*a2,a3=_accel(obj,v3),v4=v+dt*a3,a4=_accel(obj,v4);
      return{s:s+dt*(v+2*v2+2*v3+v4)/6,v:v+dt*(a1+2*a2+2*a3+a4)/6};
    }

    function _startDrop(){
      cancelAnimationFrame(rafId);
      objA={s:0,v:0,landed:false,landT:null};
      objB={s:0,v:0,landed:false,landT:null};
      simT=0; wobA=0; landedTs=null; phase='countdown'; cdTs=null; cd=ui.countdownFrom;
      status.textContent=''; watchBtn.style.display='none'; replayBtn.style.display='none';
      let last=null;
      function loop(ts){
        if(!last) last=ts;
        const wdt=Math.min((ts-last)/1000,0.033); last=ts;
        if(phase==='countdown'){
          if(!cdTs) cdTs=ts;
          cd=Math.max(0,ui.countdownFrom-Math.floor((ts-cdTs)/900));
          if(ts-cdTs>=ui.countdownFrom*900){phase='dropping';last=null;}
          _draw(ts); rafId=requestAnimationFrame(loop); return;
        }
        if(phase==='dropping'){
          const steps=10,dt=wdt/steps;
          for(let i=0;i<steps;i++){
            if(!objA.landed){const n=_rk4(objA.s,objA.v,dt,flat);objA.s=n.s;objA.v=n.v;if(objA.s>=DROP_M){objA.s=DROP_M;objA.landed=true;objA.landT=simT;}}
            if(!objB.landed){const n=_rk4(objB.s,objB.v,dt,crumpled);objB.s=n.s;objB.v=n.v;if(objB.s>=DROP_M){objB.s=DROP_M;objB.landed=true;objB.landT=simT;}}
            simT+=dt;
          }
          if(!objA.landed) wobA=Math.sin(ts*0.005)*12*(1-objA.s/DROP_M*0.5); else wobA*=0.9;
          if(objA.landed&&objB.landed&&!landedTs){landedTs=ts;phase='landed';}
        }
        if(phase==='landed'&&ts-landedTs>700){
          phase='done';
          const diff=Math.abs(objA.landT-objB.landT).toFixed(3);
          status.textContent=`Crumpled landed ${diff}s earlier — same mass, different shape`;
          replayBtn.style.display='inline-block';
          if(!hasPlayed){hasPlayed=true; if(onFirstPlay) onFirstPlay();}
        }
        _draw(ts);
        if(phase!=='done') rafId=requestAnimationFrame(loop);
      }
      rafId=requestAnimationFrame(loop);
    }

    function _draw(ts){
      const W=cv.offsetWidth||480, H=300;
      if(cv.width!==W){cv.width=W;}
      const ctx=cv.getContext('2d');
      const TOP=H*0.18, BOT=TOP+DROP_M*SCALE_PX, LA=W*0.32, LB=W*0.68;
      ctx.clearRect(0,0,W,H);
      // grid
      ctx.strokeStyle='rgba(255,255,255,0.018)'; ctx.lineWidth=1;
      for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      // ruler
      ctx.strokeStyle='rgba(77,240,176,0.15)'; ctx.setLineDash([2,5]);
      ctx.beginPath();ctx.moveTo(24,TOP);ctx.lineTo(24,BOT);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='rgba(77,240,176,0.35)';ctx.font='9px DM Mono,monospace';ctx.textAlign='right';
      for(let m=0;m<=DROP_M;m++){
        const y=TOP+m*SCALE_PX; ctx.fillText(m+'m',22,y+3);
        ctx.strokeStyle='rgba(77,240,176,0.2)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(25,y);ctx.stroke();
      }
      // platform
      ctx.fillStyle='#1e2640';
      ctx.beginPath();ctx.roundRect(W*0.14,TOP-14,W*0.72,14,3);ctx.fill();
      ctx.strokeStyle='#2e3a58';ctx.lineWidth=1;ctx.stroke();
      // lane labels — above platform
      ctx.font='10px DM Mono,monospace';ctx.textAlign='center';
      ctx.fillStyle='#ffd16699';ctx.fillText('Flat paper',LA,TOP-19);
      ctx.fillStyle='#ffd16699';ctx.fillText('Crumpled',LB,TOP-19);
      // ground
      ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(W*0.1,BOT);ctx.lineTo(W*0.9,BOT);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.04)';ctx.fillRect(W*0.1,BOT,W*0.8,4);
      // guides
      [LA,LB].forEach(x=>{ctx.strokeStyle='rgba(255,209,102,0.10)';ctx.lineWidth=1;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(x,TOP);ctx.lineTo(x,BOT);ctx.stroke();ctx.setLineDash([]);});
      // countdown overlay
      if(phase==='countdown'){
        _drawPaper(ctx,LA,TOP-4,0); _drawCrumpled(ctx,LB,TOP-4);
        ctx.save();ctx.textAlign='center';
        if(cd>0){ctx.font='700 52px DM Sans,sans-serif';ctx.fillStyle='#4df0b0';ctx.shadowColor='#4df0b044';ctx.shadowBlur=20;ctx.fillText(cd,W/2,H/2+14);}
        else{ctx.font='700 38px DM Sans,sans-serif';ctx.fillStyle='#ffd166';ctx.shadowColor='#ffd16644';ctx.shadowBlur=16;ctx.fillText('DROP!',W/2,H/2+10);}
        ctx.shadowBlur=0;ctx.restore();return;
      }
      // objects
      const yA=TOP+objA.s*SCALE_PX, yB=TOP+objB.s*SCALE_PX;
      _drawPaper(ctx,LA+wobA,yA,wobA); _drawCrumpled(ctx,LB,yB);
      if(objA.landed) _landedTag(ctx,LA,BOT,'#ffd166',objA.landT);
      if(objB.landed) _landedTag(ctx,LB,BOT,'#ffd166',objB.landT);
    }

    function _drawPaper(ctx,x,y,wob){
      ctx.save();ctx.translate(x,y);ctx.rotate(wob*0.04);
      const g=ctx.createLinearGradient(-20,-3,20,3);
      g.addColorStop(0,'#ccc8bc');g.addColorStop(0.5,'#eeeae0');g.addColorStop(1,'#ccc8bc');
      ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-20,-4,40,8,1);ctx.fill();
      ctx.strokeStyle='#b8b4a8';ctx.lineWidth=0.8;ctx.stroke();ctx.restore();
    }
    function _drawCrumpled(ctx,x,y){
      ctx.save();ctx.translate(x,y);
      const pts=[0,-10,7,-7,10,0,7,8,2,11,-5,10,-10,4,-9,-4,-4,-10];
      ctx.beginPath();ctx.moveTo(pts[0],pts[1]);
      for(let i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);
      ctx.closePath();
      const g=ctx.createRadialGradient(-2,-3,0,0,0,10);
      g.addColorStop(0,'#eae6d6');g.addColorStop(1,'#b0a898');
      ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#a09888';ctx.lineWidth=0.8;ctx.stroke();ctx.restore();
    }
    function _landedTag(ctx,x,bot,col,t){
      ctx.font='600 9px DM Mono,monospace';ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText('LANDED',x,bot+14);
      if(t!==null){ctx.font='9px DM Mono,monospace';ctx.fillStyle=col+'88';ctx.fillText(t.toFixed(3)+'s',x,bot+24);}
    }

    // idle render
    requestAnimationFrame(()=>{
      cv.width=cv.offsetWidth||480;
      const ctx=cv.getContext('2d');
      ctx.fillStyle='rgba(77,240,176,0.25)';ctx.font='12px DM Sans,sans-serif';ctx.textAlign='center';
      ctx.fillText('Click ▶ Watch the drop to begin',cv.width/2, cv.height/2);
    });

    watchBtn.addEventListener('click',_startDrop);
    replayBtn.addEventListener('click',_startDrop);
    return wrap;
  }

  // ── FACTORY ────────────────────────────────────────────────────────────────
  function create(containerEl) {
    let _onComplete = null, _onSectionReveal = null;
    let _sectionEls = [], _complete = false, _alias = 'anonymous';
    const _responses = {};

    function _injectStyles(){
      if(document.getElementById('hist-styles')) return;
      const s=document.createElement('style');s.id='hist-styles';s.textContent=CSS;document.head.appendChild(s);
    }

    function _buildDOM(){
      containerEl.innerHTML='';
      const wrap=document.createElement('div');wrap.className='hist-wrap';
      // progress
      const prog=document.createElement('div');prog.className='hist-progress';
      HistoryData.sections.forEach((_,i)=>{const p=document.createElement('div');p.className='hist-pip';p.id=`hist-pip-${i}`;prog.appendChild(p);});
      const lbl=document.createElement('div');lbl.className='hist-prog-lbl';lbl.textContent='STAGE 5 OF 5';prog.appendChild(lbl);
      wrap.appendChild(prog);
      _sectionEls=[];
      HistoryData.sections.forEach((sec,i)=>{const c=_buildCard(sec,i);wrap.appendChild(c);_sectionEls.push(c);});
      // completion
      const {icon,title,message}=HistoryData.completion;
      const banner=document.createElement('div');banner.className='hist-complete';banner.id='hist-complete';
      banner.innerHTML=`<div class="hist-complete-icon">${icon}</div><div class="hist-complete-title">${title}</div><div class="hist-complete-sub">${message}</div>`;
      wrap.appendChild(banner);
      const src=document.createElement('div');src.className='hist-source';src.innerHTML=HistoryData.footnote;wrap.appendChild(src);
      containerEl.appendChild(wrap);
    }

    function _buildCard(sec,index){
      const seed  = (_hashAlias(_alias) + index * 0x9e3779b9) >>> 0;
      const rng1  = _makePRNG(seed);
      const drawnM = _pick(sec.pool.misconceptions, sec.draw.misconceptions, rng1);
      const drawnC = _pick(sec.pool.correct,        sec.draw.correct,        rng1);
      const rng2   = _makePRNG((seed ^ 0xdeadbeef) >>> 0);
      const drawn  = _shuffle([...drawnM,...drawnC], rng2);

      const card=document.createElement('div');card.className='hist-section';card.id=`hist-section-${index}`;
      card._drawnM=drawnM.map(x=>x.id);
      card._drawnC=drawnC.map(x=>x.id);
      card._drawn=drawn;

      // tag
      const tag=document.createElement('div');tag.className='hist-tag';tag.style.color=sec.tagColor;tag.textContent=`▸ ${sec.tag}`;card.appendChild(tag);
      // heading
      const h=document.createElement('div');h.className='hist-heading';h.textContent=sec.heading;card.appendChild(h);
      // figure
      if(FIGURES[sec.figure]){const fw=document.createElement('div');fw.className='hist-fig-wrap';fw.innerHTML=FIGURES[sec.figure];card.appendChild(fw);}
      // prose
      const prose=document.createElement('div');prose.className='hist-prose';prose.innerHTML=sec.prose;card.appendChild(prose);
      card.appendChild(Object.assign(document.createElement('div'),{className:'hist-clear'}));

      // MCQ gate wrapper (locked until canvas played for sec 0)
      const gate=document.createElement('div');
      gate.className='hist-mcq-gate'+(sec.hasCanvas?' locked':'');

      // canvas
      if(sec.hasCanvas){
        const canvasWrap=_buildMiniCanvas(()=>{
          gate.classList.remove('locked');gate.classList.add('open');
        });
        card.appendChild(canvasWrap);
      }

      // MCQ
      const mcqBox=document.createElement('div');mcqBox.className='hist-mcq';
      mcqBox.appendChild(Object.assign(document.createElement('div'),{className:'hist-mcq-label',textContent:'▸ Select all that apply'}));
      mcqBox.appendChild(Object.assign(document.createElement('div'),{className:'hist-mcq-prompt',textContent:sec.prompt}));

      const selectedIds=new Set();
      const onChange=()=>_updateSubmit(index,selectedIds);

      drawn.forEach(item=>{
        const isC=sec.pool.correct.some(c=>c.id===item.id);
        mcqBox.appendChild(_buildOptionRow(item,isC,selectedIds,onChange));
      });
      mcqBox.appendChild(Object.assign(document.createElement('hr'),{className:'hist-opt-divider'}));
      HistoryData.pinnedOptions.forEach(pin=>mcqBox.appendChild(_buildPinnedRow(pin,selectedIds,onChange)));

      // footer
      const footer=document.createElement('div');footer.className='hist-mcq-footer';
      const hint=document.createElement('span');hint.className='hist-lock-hint';hint.id=`hist-hint-${index}`;hint.textContent=HistoryData.ui.submitLockHint;
      const submitBtn=document.createElement('button');submitBtn.className='hist-btn';submitBtn.id=`hist-submit-${index}`;submitBtn.textContent=HistoryData.ui.submitBtn;submitBtn.disabled=true;
      submitBtn.addEventListener('click',()=>_submitSection(index,selectedIds,drawn,sec));
      footer.appendChild(hint);footer.appendChild(submitBtn);
      mcqBox.appendChild(footer);
      gate.appendChild(mcqBox);
      card.appendChild(gate);

      // continue button
      const isLast=index===HistoryData.sections.length-1;
      const cont=document.createElement('button');cont.className='hist-btn hist-cont-btn';cont.id=`hist-cont-${index}`;
      cont.textContent=isLast?HistoryData.ui.completeBtn:HistoryData.ui.continueBtn;
      cont.addEventListener('click',()=>_advance(index));
      card.appendChild(cont);
      return card;
    }

    function _buildOptionRow(item,isCorrect,selectedIds,onChange){
      const row=document.createElement('div');row.className='hist-opt';row.dataset.id=item.id;
      const box=document.createElement('div');box.className='hist-opt-check';
      box.appendChild(Object.assign(document.createElement('span'),{className:'hist-opt-check-tick',textContent:'✓'}));
      const body=document.createElement('div');body.className='hist-opt-body';
      body.appendChild(Object.assign(document.createElement('div'),{className:'hist-opt-text',textContent:item.text}));
      const rev=document.createElement('div');rev.className='hist-reveal';rev.id=`hist-rev-${item.id}`;body.appendChild(rev);
      row.appendChild(box);row.appendChild(body);
      row.addEventListener('click',()=>{
        if(row.classList.contains('locked'))return;
        selectedIds.has(item.id)?selectedIds.delete(item.id):selectedIds.add(item.id);
        row.classList.toggle('selected',selectedIds.has(item.id));
        onChange();
      });
      return row;
    }

    function _buildPinnedRow(pin,selectedIds,onChange){
      const row=document.createElement('div');row.className='hist-opt';row.dataset.id=pin.id;
      const box=document.createElement('div');box.className='hist-opt-check';
      box.appendChild(Object.assign(document.createElement('span'),{className:'hist-opt-check-tick',textContent:'✓'}));
      const body=document.createElement('div');body.className='hist-opt-body';
      body.appendChild(Object.assign(document.createElement('div'),{className:'hist-opt-text',textContent:pin.text}));
      // free-text
      const ftWrap=document.createElement('div');ftWrap.className='hist-freetext-wrap';ftWrap.id=`hist-ft-wrap-${pin.id}`;
      const ta=document.createElement('textarea');ta.className='hist-freetext';ta.id=`hist-ft-${pin.id}`;ta.placeholder=pin.placeholder;ta.rows=3;
      const ctr=document.createElement('div');ctr.className='hist-freetext-count';ctr.id=`hist-ftc-${pin.id}`;
      if(pin.type==='none'){
        ctr.textContent=`${HistoryData.ui.noneMinChars} characters needed`;
        ta.addEventListener('input',()=>{
          const left=Math.max(0,HistoryData.ui.noneMinChars-ta.value.trim().length);
          ctr.textContent=left?`${left} more character${left===1?'':'s'} needed`:'✓ Ready';
          ctr.classList.toggle('ready',!left);
          onChange();
        });
      }
      ftWrap.appendChild(ta);ftWrap.appendChild(ctr);body.appendChild(ftWrap);
      row.appendChild(box);row.appendChild(body);
      row.addEventListener('click',()=>{
        if(row.classList.contains('locked'))return;
        const nowSelected=!selectedIds.has(pin.id);
        nowSelected?selectedIds.add(pin.id):selectedIds.delete(pin.id);
        row.classList.toggle('selected',nowSelected);
        ftWrap.classList.toggle('open',nowSelected);
        if(nowSelected)ta.focus();
        onChange();
      });
      return row;
    }

    function _updateSubmit(index,selectedIds){
      const btn=document.getElementById(`hist-submit-${index}`);
      const hint=document.getElementById(`hist-hint-${index}`);
      if(!btn)return;
      if(selectedIds.size===0){btn.disabled=true;hint.textContent=HistoryData.ui.submitLockHint;return;}
      if(selectedIds.has('NONE')){
        const ta=document.getElementById('hist-ft-NONE');
        if(ta&&ta.value.trim().length<HistoryData.ui.noneMinChars){btn.disabled=true;hint.textContent='Please describe your thinking in the text box.';return;}
      }
      btn.disabled=false;hint.textContent='';
    }

    function _submitSection(index,selectedIds,drawn,sec){
      const card=_sectionEls[index];
      card.querySelectorAll('.hist-opt').forEach(r=>r.classList.add('locked'));
      const submitBtn=document.getElementById(`hist-submit-${index}`);
      if(submitBtn)submitBtn.style.display='none';
      const hint=document.getElementById(`hist-hint-${index}`);
      if(hint)hint.textContent='';

      const correctIds=card._drawnC;
      const sel=[...selectedIds];
      const selCorrect=sel.filter(id=>correctIds.includes(id));
      const selWrong  =sel.filter(id=>card._drawnM.includes(id));
      const missed    =correctIds.filter(id=>!selectedIds.has(id));
      const addText   =document.getElementById('hist-ft-ADD_THOUGHTS')?.value.trim()||'';
      const noneText  =document.getElementById('hist-ft-NONE')?.value.trim()||'';

      _responses[index]={
        shown:drawn.map(d=>d.id), selected_correct:selCorrect,
        selected_wrong:selWrong, missed_correct:missed,
        none_selected:selectedIds.has('NONE'), none_text:noneText, add_text:addText,
      };
      try{ if(typeof DataLogger!=='undefined'&&DataLogger.log) DataLogger.log(`history_s${index}`,_responses[index]); }catch(e){}

      // cascade reveal for selected items
      let delay=0;
      drawn.forEach(item=>{
        if(!selectedIds.has(item.id)){delay+=HistoryData.ui.revealDelayMs;return;}
        const isC=sec.pool.correct.some(c=>c.id===item.id);
        setTimeout(()=>_revealItem(item,isC),delay);
        delay+=HistoryData.ui.revealDelayMs;
      });

      // missed correct nudge + show continue
      setTimeout(()=>{
        missed.forEach(id=>{
          const rev=document.getElementById(`hist-rev-${id}`);
          if(!rev||rev.classList.contains('show'))return;
          const item=[...sec.pool.correct,...sec.pool.misconceptions].find(x=>x.id===id);
          if(!item)return;
          rev.className='hist-reveal missed show';
          rev.innerHTML=`<div class="hist-reveal-badge">▸ WORTH RECONSIDERING</div><div class="hist-reveal-text">${item.explanation}</div>`;
        });
        const cont=document.getElementById(`hist-cont-${index}`);
        if(cont)cont.style.display='inline-block';
      }, delay+200);
    }

    function _revealItem(item,isCorrect){
      const rev=document.getElementById(`hist-rev-${item.id}`);
      if(!rev)return;
      rev.className=`hist-reveal ${isCorrect?'correct':'wrong'} show`;
      rev.innerHTML=`<div class="hist-reveal-badge">▸ ${isCorrect?'CORRECT':'NOT QUITE'}</div><div class="hist-reveal-text">${item.explanation}</div>`;
    }

    function _updatePips(upTo){
      HistoryData.sections.forEach((_,i)=>{
        const p=document.getElementById(`hist-pip-${i}`);if(!p)return;
        p.className='hist-pip'+(i<upTo?' done':i===upTo?' cur':'');
      });
    }

    function _revealSection(index){
      const card=_sectionEls[index];if(!card)return;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        card.classList.add('visible');
        setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'start'}),120);
      }));
      _updatePips(index);
      if(typeof _onSectionReveal==='function')_onSectionReveal(index);
    }

    function _advance(fromIndex){
      const cont=document.getElementById(`hist-cont-${fromIndex}`);
      if(cont)cont.style.display='none';
      const next=fromIndex+1;
      if(next<HistoryData.sections.length){ _revealSection(next); }
      else{
        _complete=true; _updatePips(HistoryData.sections.length);
        const banner=document.getElementById('hist-complete');
        if(banner){banner.classList.add('visible');setTimeout(()=>banner.scrollIntoView({behavior:'smooth',block:'nearest'}),150);}
        if(_onComplete)_onComplete({..._responses});
      }
    }

    function onComplete(fn){_onComplete=fn;}
    function start(){_alias=_getAlias();_injectStyles();_buildDOM();_revealSection(0);}
    function reset(){_complete=false;Object.keys(_responses).forEach(k=>delete _responses[k]);containerEl.innerHTML='';_sectionEls=[];}
    function getResponses(){return{..._responses};}

    return{onComplete,start,reset,isComplete:()=>_complete,getResponses,_setRevealHook:fn=>{_onSectionReveal=fn;},SECTION_COUNT:HistoryData.sections.length};
  }

  return{create,_hashAlias,_makePRNG,SECTION_COUNT:HistoryData?.sections?.length||3};
})();

if(typeof module!=='undefined')module.exports=DrawHistory;
