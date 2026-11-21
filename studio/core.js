/* Lucky Draw Studio — shared core.
   Every design page loads this first. It keeps ONE names list and ONE winners log for the whole studio
   (all pages live on the same site, so they share browser storage), picks winners fairly,
   and gives each page the same keyboard shortcuts, confetti and sound helpers. */
(function () {
  const KEY = 'ld-studio-v1';
  const SAMPLE = [
    'Wan Nur Aisyah Humaira binti Wan Mohd Kamarul Ariffin', 'Muhammad Aiman Haziq Danial bin Abdul Rahman Shah',
    'Tengku Puteri Nur Sofea Qistina binti Tengku Ahmad Shahrizal', 'Dayang Nurul Syafiqah Izzati binti Awang Mohd Kamaruddin',
    'Rajeshwaran a/l Subramaniam Pillai', 'Thanaletchumy a/p Muthukrishnan Ramasamy',
    'Mohd Firdaus Hakimi Iskandar bin Mohd Zulkarnain', 'Jessica Valerie Gimbang anak Joseph Majalap',
    'Sharifah Nur Ain Syazwani binti Syed Abdul Kadir Al-Attas', 'Abang Muhammad Faris Iskandar bin Abang Zainal Abidin',
    'Nik Nur Aqilah Damia binti Nik Mohd Azhar Hakimi', 'Kavitha Devi a/p Ganesan Arumugam',
    'Fatimah Az-Zahra Nur Iman binti Muhammad Haikal Irfan', 'Awangku Muhammad Hazwan Haziq bin Pengiran Abdul Rahim',
    'Puteri Nurul Izzah Qaisara binti Megat Mohd Shahrul Nizam', 'Datuk Seri Ahmad Faizal Hakimi bin Tan Sri Mohamed Ariffin',
    'Nur Alya Batrisyia Sofea binti Mohd Hafizuddin', 'Alvin Christopher Lojuntin Majimbun',
    'Siti Nur Farhana Athirah binti Ismail Sabri', 'Ahmad Danial Haikal Aqil bin Ahmad Faizal Hakimi',
    'Chong Wei Liang Jonathan', 'Lim Jia Hui Rachel'
  ];
  const DESIGNS = [
    { id: 'reel', title: 'Name Reel Showtime' }, { id: 'packet', title: 'Red Packet' },
    { id: 'board', title: 'Departure Board' }, { id: 'drum', title: 'Gold Drum' },
    { id: 'wheel', title: 'Fortune Wheel' }, { id: 'fireworks', title: 'Fireworks' },
    { id: 'galaxy', title: 'Galaxy Warp' }, { id: 'cards', title: 'Card Shuffle' },
    { id: 'scratch', title: 'Scratch Card' }, { id: 'lanterns', title: 'Sky Lanterns' },
    { id: 'kinabalu', title: 'Kinabalu Dawn' }, { id: 'agung', title: 'The Agung' },
    { id: 'ballot', title: 'Crystal Ballot' }, { id: 'proclamation', title: 'State Proclamation' },
    { id: 'maplight', title: 'Map of Light' }, { id: 'pinakol', title: 'Pinakol' },
    { id: 'wall', title: 'Honour Wall' }, { id: 'lamps', title: 'Lamp Relay' }, { id: 'rain', title: 'Rain Glass' },
    { id: 'orchid', title: 'Orchid Bloom' }, { id: 'sundial', title: 'Sundial' }, { id: 'foundry', title: 'Foundry' }
  ];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- shared state ----------
  function normalise(s) {
    s = s && typeof s === 'object' ? s : {};
    return {
      names: Array.isArray(s.names) ? s.names : SAMPLE.slice(),
      winners: Array.isArray(s.winners) ? s.winners : [],
      removeWinners: s.removeWinners !== false,
      soundOn: s.soundOn !== false,
      musicOn: s.musicOn !== false,
      log: Array.isArray(s.log) ? s.log : [],
      prize: typeof s.prize === 'string' ? s.prize : '',
      used: s.used && typeof s.used === 'object' ? s.used : {}
    };
  }
  let mem = null; // used when browser storage is blocked, so the page still works for this visit
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw !== null) return normalise(JSON.parse(raw)); } catch (e) {}
    return normalise(mem);
  }
  function store(s) { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  const design = document.documentElement.dataset.design || '';
  // Merge a partial update. New names in `winners` are logged with this page's design and the current prize.
  function save(part) {
    const s = load();
    if (part.winners) {
      if (!part.winners.length) { s.log = []; s.used = {}; }
      for (const w of part.winners) {
        if (!s.winners.includes(w)) {
          s.log.push({ name: w, design, prize: s.prize, at: Date.now() });
          if (design) s.used[design] = (s.used[design] || 0) + 1;
        }
      }
    }
    Object.assign(s, part);
    store(s); return s;
  }
  // In live mode the pool is the eligible guests in the event database; otherwise the demo names.
  const pool = (s = load()) => liveOn() ? liveEligible().map(g => g.name) : (s.removeWinners ? s.names.filter(n => !s.winners.includes(n)) : s.names.slice());

  // fair pick: crypto randomness, no modulo bias
  function randInt(n) {
    if (n <= 1) return 0;
    const lim = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
    try { do crypto.getRandomValues(buf); while (buf[0] >= lim); return buf[0] % n; } catch (e) { return Math.floor(Math.random() * n); }
  }
  const pick = list => list[randInt(list.length)];
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- easing + tiny tween (rAF; frame-rate independent) ----------
  const ease = {
    linear: t => t,
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    outQuint: t => 1 - Math.pow(1 - t, 5),
    outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    inOutExpo: t => t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    // critically-damped-ish spring settle, good for "landing" moments
    outSpring: t => 1 - Math.exp(-6.5 * t) * Math.cos(9 * t * (1 - t * 0.35))
  };
  function tween(dur, fn, e = ease.outCubic) {
    return new Promise(res => {
      if (reduced || dur <= 0) { fn(1, 1); return res(); }
      const t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / dur); fn(e(k), k); if (k < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
  }
  const sleep = ms => new Promise(r => setTimeout(r, reduced ? Math.min(ms, 60) : ms));

  // ---------- sound ----------
  let ac = null, master = null, noiseBuf = null;
  function audio() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = load().soundOn ? 1 : 0;
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3;
        master.connect(comp).connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  const snd = {
    get on() { return load().soundOn; },
    set(on) { save({ soundOn: on }); if (master) master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.05); },
    tone(freq, dur = 0.15, vol = 0.06, type = 'sine', when = 0) {
      if (!ac) return; const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, vol, { type = 'bandpass', freq = 1800, q = 0.8, when = 0, attack = 0.003 } = {}) {
      if (!ac) return; const t = ac.currentTime + when, src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    },
    tick(pitch = 1500) { snd.tone(pitch + Math.random() * 80, 0.04, 0.03, 'square'); },
    chime() { [[587.3, 0], [740, .12], [880, .24], [1174.7, .4], [1480, .58]].forEach(([f, d]) => { snd.tone(f, 2, 0.05, 'sine', d); snd.tone(f * 2, 1.1, 0.012, 'sine', d); }); },
    boom() {
      if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(g).connect(master); o.start(t); o.stop(t + 1.4);
      snd.noise(2.2, 0.1, { type: 'highpass', freq: 5000, q: 0.4 });
    },
    whoosh(dur = 0.9, vol = 0.05) { snd.noise(dur, vol, { type: 'bandpass', freq: 900, q: 0.5, attack: dur * 0.45 }); }
  };
  addEventListener('pointerdown', () => audio(), { once: true });
  addEventListener('keydown', () => audio(), { once: true });

  // ---------- confetti (2D overlay; any page can call it) ----------
  let cfCanvas = null, cfParts = [], cfRunning = false;
  function confetti({ count = 220, colors = ['#e8c26a', '#fff3cf', '#c4152f', '#ffffff'], x = 0.5, y = -0.05, spread = 1, power = 1 } = {}) {
    if (reduced) return;
    if (!cfCanvas) {
      cfCanvas = document.createElement('canvas');
      Object.assign(cfCanvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 40 });
      document.body.appendChild(cfCanvas);
    }
    const W = innerWidth, H = innerHeight;
    for (let i = 0; i < count; i++) {
      const a = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.9 * spread, v = (y < 0.2 ? 2 + Math.random() * 6 : 9 + Math.random() * 9) * power;
      cfParts.push({
        x: x * W + (y < 0.2 ? (Math.random() - 0.5) * W * spread : 0), y: y * H - (y < 0.2 ? Math.random() * H * 0.6 : 0),
        vx: Math.cos(a) * v * (y < 0.2 ? 0.4 : 1), vy: y < 0.2 ? Math.random() * 2 : Math.sin(a) * v,
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 10 + Math.random() * 8,
        f: Math.random() * 6.28, vf: 0.08 + Math.random() * 0.12, c: colors[i % colors.length], life: 0
      });
    }
    if (!cfRunning) { cfRunning = true; let last = performance.now(); requestAnimationFrame(function step(now) {
      const dt = Math.min(2.5, (now - last) / 16.67); last = now;
      const dpr = Math.min(devicePixelRatio, 2);
      if (cfCanvas.width !== innerWidth * dpr) { cfCanvas.width = innerWidth * dpr; cfCanvas.height = innerHeight * dpr; }
      const g = cfCanvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
      cfParts = cfParts.filter(p => p.y < innerHeight + 40 && p.life < 900);
      for (const p of cfParts) {
        p.life += dt; p.vy = Math.min(p.vy + 0.18 * dt, 3.2); p.vx *= Math.pow(0.985, dt);
        p.f += p.vf * dt; p.x += (p.vx + Math.sin(p.f) * 0.8) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.f)); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      }
      if (cfParts.length) requestAnimationFrame(step); else { cfRunning = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }); }
  }

  // ---------- fit a DOM name into its box ----------
  function fitText(el, { max = 120, min = 18 } = {}) {
    const box = el.parentElement; let lo = min, hi = max;
    el.style.fontSize = max + 'px';
    if (el.scrollWidth <= box.clientWidth && el.scrollHeight <= box.clientHeight) return max;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; el.style.fontSize = mid + 'px'; (el.scrollWidth <= box.clientWidth && el.scrollHeight <= box.clientHeight) ? lo = mid : hi = mid; }
    el.style.fontSize = lo + 'px'; return lo;
  }

  // ---------- page chrome: back link, prize label, keyboard / clicker ----------
  function chrome({ primary = [], accent = '#e8c26a' } = {}) {
    prizeLabels(); onLive(prizeLabels);
    const a = document.createElement('a');
    a.href = '../index.html'; a.className = 'ld-back'; a.textContent = '← Designs'; a.title = 'Back to all designs (H)';
    const st = document.createElement('style');
    st.textContent = `.ld-back{position:fixed;z-index:30;left:max(14px,env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));
      font:600 12px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;color:${accent};
      padding:10px 14px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid color-mix(in srgb, ${accent} 40%, transparent);opacity:.45;transition:opacity .2s}
      .ld-back:hover,.ld-back:focus-visible{opacity:1;outline:none}
      body.ld-busy .ld-back{opacity:0;pointer-events:none}`;
    document.head.appendChild(st); document.body.appendChild(a);
    // Space / Enter / clicker (PageDown, ArrowRight) presses the first visible, enabled button in `primary`
    addEventListener('keydown', e => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === 'h' || e.key === 'H') { location.href = '../index.html'; return; }
      if (e.key === 'f' || e.key === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); return; }
      if (![' ', 'Enter', 'PageDown', 'ArrowRight'].includes(e.key)) return;
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return; // the focused button handles it
      const btn = primary.map(id => document.getElementById(id)).find(b => b && !b.hidden && !b.disabled && b.offsetParent !== null);
      if (btn) { e.preventDefault(); btn.click(); }
    });
  }
  const busy = on => document.body.classList.toggle('ld-busy', !!on);

  // Log one draw (always logged, even when winners stay in the pool)
  function record(name, prize) {
    const s = load();
    s.log.push({ name, design, prize: prize !== undefined ? prize : s.prize, at: Date.now() });
    if (design) s.used[design] = (s.used[design] || 0) + 1;
    if (!s.winners.includes(name)) s.winners.push(name);
    store(s); return s;
  }

  // Standard page flow for the newer designs: Draw -> design's own animation -> record -> New draw.
  // Expects #draw, #reset, #meta, #hint, #soundBtn and #result in the page.
  function stage({ draw, reset, accent, idleHint = 'Press Draw or Space to start', drawingHint = 'Drawing…' }) {
    const $ = id => document.getElementById(id);
    const drawBtn = $('draw'), resetBtn = $('reset'), meta = $('meta'), hint = $('hint'), soundBtn = $('soundBtn'), result = $('result');
    let state = 'idle';
    function ui() {
      const s = load(), left = pool(s).length, ls = liveState(), isLive = ls === 'on';
      meta.textContent = `Draw ${String(s.log.length + (state === 'won' ? 0 : 1)).padStart(2, '0')} · ${left === 1 ? '1 name' : left + ' names'} in the draw${isLive ? ' · live' : ''}`;
      soundBtn.textContent = s.soundOn ? 'Sound on' : 'Sound off'; soundBtn.setAttribute('aria-pressed', String(s.soundOn));
      if (state !== 'idle') return;
      if (ls === 'checking' || ls === 'connecting') { drawBtn.disabled = true; hint.textContent = 'Connecting to the event…'; }
      else if (ls === 'error' || ls === 'not-staff') { drawBtn.disabled = true; hint.textContent = liveMessage(); }
      else if (isLive && !liveNextPrize()) { drawBtn.disabled = true; hint.textContent = 'No prize left to draw. Add a prize on the designs page.'; }
      else { drawBtn.disabled = !left; hint.innerHTML = left ? idleHint : (isLive ? 'No eligible names left to draw.' : 'No names left. Add names on the <a href="../index.html">designs page</a>.'); }
    }
    // One draw. In live mode the winner is saved to the event first, and is shown only after the server accepts it.
    async function runDraw() {
      const p = pool(); if (state !== 'idle' || !p.length) return;
      audio(); state = 'busy'; busy(true); drawBtn.disabled = true; result.textContent = '';
      let w, prizeName = currentPrize();
      if (liveOn()) {
        hint.textContent = 'Saving the draw…';
        try { const claim = await liveDraw(); w = claim.name; prizeName = claim.prize.name; }
        catch (e) {
          console.error(e); state = 'idle'; busy(false); ui();
          hint.textContent = e.message || 'The draw was not saved.';
          return;
        }
      } else w = pick(p);
      hint.textContent = drawingHint;
      try { await draw(w); } catch (e) { console.error(e); }
      record(w, prizeName); result.textContent = 'The winner is ' + w;
      state = 'won'; busy(false); drawBtn.hidden = true; resetBtn.hidden = false;
      hint.textContent = 'Press New draw for the next prize'; ui();
    }
    drawBtn.addEventListener('click', runDraw);
    resetBtn.addEventListener('click', async () => {
      if (state !== 'won') return; state = 'busy'; resetBtn.hidden = true;
      try { if (reset) await reset(); } catch (e) { console.error(e); }
      prizeLabels(); // pick up a prize changed on the designs page in another tab
      state = 'idle'; drawBtn.hidden = false; ui();
    });
    onLive(ui);
    soundBtn.addEventListener('click', () => { audio(); snd.set(!load().soundOn); ui(); });
    document.querySelectorAll('[data-ld-prize]').forEach(el => { el.dataset.ldDefault = el.textContent; });
    chrome({ primary: ['draw', 'reset'], accent }); ui();
    return { ui, get state() { return state; } };
  }

  // ---------- live draws: staff sign-in + the event database ----------
  // Only when a staff account is signed in. Same rules and write paths as the event app (app/src/lib/draw.ts):
  // each winner is one atomic update, and the rules reject a second win for the same prize or guest.
  const EVENT = (() => {
    const ok = v => typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v);
    let q = null; try { q = new URLSearchParams(location.search).get('event'); } catch (e) {}
    let id = q; try { if (ok(q)) localStorage.setItem('ld-event', q); else id = localStorage.getItem('ld-event'); } catch (e) {}
    return ok(id) ? id : 'ys60';
  })();
  const FB = 'https://www.gstatic.com/firebasejs/13.0.0/';
  // Public web config (same project as app/src/lib/firebase.ts). Access is controlled by the database rules.
  const FB_CONFIG = {
    apiKey: 'AIzaSyCEJbD5Md0ZX2ADT4nViQNxKn3t5d18ttA', authDomain: 'ys60-d283a.firebaseapp.com',
    databaseURL: 'https://ys60-d283a-default-rtdb.firebaseio.com', projectId: 'ys60-d283a',
    storageBucket: 'ys60-d283a.firebasestorage.app', messagingSenderId: '245526155541',
    appId: '1:245526155541:web:bac59abdb73656470f191c'
  };
  const LIVE_KEYS = ['guests', 'prizes', 'winners', 'winnerByGuest', 'settings'];
  const FIELD = { guests: 'guests', prizes: 'prizes', winners: 'winners', winnerByGuest: 'wbg', settings: 'settings' };
  const live = { fb: null, authed: false, user: null, isStaff: false, error: '', guests: {}, prizes: {}, winners: {}, wbg: {}, settings: {} };
  const liveReady = new Set(), liveUnsub = [], liveListeners = [];
  const onLive = fn => liveListeners.push(fn);
  function notifyLive() { liveListeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  function liveState() {
    if (!live.authed) return 'checking';
    if (!live.user) return 'off';
    if (live.error) return 'error';
    if (!live.isStaff) return 'not-staff';
    return liveReady.size === LIVE_KEYS.length ? 'on' : 'connecting';
  }
  const liveOn = () => liveState() === 'on';
  const liveMessage = () => live.error || (liveState() === 'not-staff' ? 'This account is not a staff account. Sign in with a staff account.' : '');
  function liveEligible() {
    const needCheckIn = live.settings.entryMode === 'checkedIn';
    return Object.entries(live.guests).filter(([id, g]) => g && !live.wbg[id] && (!needCheckIn || g.checkedIn)).map(([id, g]) => ({ id, name: g.name }));
  }
  const livePrizes = () => Object.entries(live.prizes).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.order - b.order);
  const liveNextPrize = () => livePrizes().find(p => live.winners[p.id]?.status !== 'active') || null;
  const currentPrize = () => liveOn() ? (liveNextPrize()?.name || '') : load().prize;
  function prizeLabels() {
    const pz = currentPrize();
    document.querySelectorAll('[data-ld-prize]').forEach(el => { if (!el.dataset.ldDefault) el.dataset.ldDefault = el.textContent; el.textContent = pz || el.dataset.ldDefault; });
  }

  function detachLive() {
    liveUnsub.splice(0).forEach(off => off());
    liveReady.clear();
    Object.assign(live, { guests: {}, prizes: {}, winners: {}, wbg: {}, settings: {} });
  }
  function attachLive() {
    const { D, db } = live.fb;
    live.error = '';
    for (const key of LIVE_KEYS) {
      liveUnsub.push(D.onValue(D.ref(db, `events/${EVENT}/${key}`), snap => {
        live[FIELD[key]] = snap.val() || {}; liveReady.add(key); notifyLive();
      }, () => { live.error = 'Lost the connection to the event database.'; notifyLive(); }));
    }
  }
  const liveInit = (async () => {
    try {
      const [authMod, dbMod, appMod] = await Promise.all([import(FB + 'firebase-auth.js'), import(FB + 'firebase-database.js'), import(FB + 'firebase-app.js')]);
      const app = appMod.initializeApp(FB_CONFIG, 'ld-studio');
      live.fb = { authMod, D: dbMod, db: dbMod.getDatabase(app), auth: authMod.getAuth(app) };
      authMod.onAuthStateChanged(live.fb.auth, async user => {
        detachLive(); live.user = user; live.isStaff = false; live.error = '';
        if (user) {
          try {
            const snap = await dbMod.get(dbMod.ref(live.fb.db, `staff/${user.uid}`));
            if (live.user !== user) return; // signed out or switched while checking
            live.isStaff = snap.val() === true;
          } catch (e) { if (live.user === user) live.error = 'Could not check staff access. Check the internet connection.'; }
          if (live.user === user && live.isStaff) attachLive();
        }
        live.authed = true; notifyLive();
      });
    } catch (e) {
      console.error(e); live.authed = true; live.error = 'Could not reach Firebase. Check the internet connection.'; notifyLive();
    }
  })();
  async function liveSignIn(email, password) {
    await liveInit;
    if (!live.fb) throw Object.assign(new Error('Not connected.'), { code: 'auth/network-request-failed' });
    return live.fb.authMod.signInWithEmailAndPassword(live.fb.auth, email.trim(), password);
  }
  async function liveSignOut() { await liveInit; if (live.fb) await live.fb.authMod.signOut(live.fb.auth); }

  class LiveDrawError extends Error {}
  function withTimeout(promise, ms = 15000) {
    let timer;
    const limit = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new LiveDrawError('The draw could not be confirmed by the server. Do not draw again yet: check the winners in the event app first.')), ms);
    });
    return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
  }
  // Draw the next prize without a winner. Reads fresh data, claims in one atomic update, and retries if the rules reject it.
  async function liveDraw() {
    const { D, db } = live.fb, E = `events/${EVENT}`, by = live.user.email || live.user.uid;
    const read = path => D.get(D.ref(db, `${E}/${path}`)).then(snap => snap.val() || {});
    for (let attempt = 0; attempt < 5; attempt++) {
      const [prizes, winners, guests, wbg, settings] = await Promise.all(['prizes', 'winners', 'guests', 'winnerByGuest', 'settings'].map(read));
      const next = Object.entries(prizes).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.order - b.order).find(p => winners[p.id]?.status !== 'active');
      if (!next) throw new LiveDrawError('No prize is left to draw. Add a prize first.');
      const needCheckIn = settings.entryMode === 'checkedIn';
      const eligible = Object.keys(guests).filter(id => guests[id] && !wbg[id] && (!needCheckIn || guests[id].checkedIn));
      if (!eligible.length) throw new LiveDrawError('There are no eligible names left to draw.');
      const guestId = eligible[randInt(eligible.length)], name = guests[guestId].name;
      const logKey = D.push(D.ref(db, `${E}/log`)).key;
      const paths = {
        [`${E}/winners/${next.id}`]: { guestId, name, drawnAt: D.serverTimestamp(), by, status: 'active' },
        [`${E}/winnerByGuest/${guestId}`]: next.id,
        [`${E}/public/winners/${next.id}`]: { name, prizeName: next.name, ...(next.counter ? { counter: next.counter } : {}), order: next.order, drawnAt: D.serverTimestamp() },
        [`${E}/log/${logKey}`]: { type: 'draw', by, prizeId: next.id, guestId, detail: name, at: D.serverTimestamp() }
      };
      try {
        await withTimeout(D.update(D.ref(db), paths));
        return { name, guestId, prize: next };
      } catch (err) {
        if (err instanceof LiveDrawError || !/permission.denied/i.test(String(err && err.message))) throw err;
        // someone else claimed this prize or guest first: read again and retry
      }
    }
    throw new LiveDrawError('The draw kept colliding with another draw. Please try again.');
  }
  // Add names to the event (never removes anything). Names already in the event are skipped.
  async function liveAddNames(list) {
    const { D, db } = live.fb, E = `events/${EVENT}`, by = live.user.email || live.user.uid;
    const have = new Set(Object.values(live.guests).filter(Boolean).map(g => String(g.name).toLowerCase()));
    const fresh = [...new Set(list.map(n => n.replace(/\s+/g, ' ').trim()).filter(n => n && n.length <= 120))].filter(n => !have.has(n.toLowerCase()));
    if (!fresh.length) return 0;
    const now = Date.now(), paths = {};
    for (const name of fresh) paths[`${E}/guests/${D.push(D.ref(db, `${E}/guests`)).key}`] = { name, source: 'paste', checkedIn: false, createdAt: now };
    paths[`${E}/log/${D.push(D.ref(db, `${E}/log`)).key}`] = { type: 'import', by, detail: `${fresh.length} names added from the studio`, at: D.serverTimestamp() };
    await D.update(D.ref(db), paths);
    return fresh.length;
  }
  // Add a prize at the end of the draw order.
  async function liveAddPrize(name) {
    const { D, db } = live.fb, E = `events/${EVENT}`, by = live.user.email || live.user.uid;
    const text = name.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text) return;
    const order = livePrizes().reduce((m, p) => Math.max(m, p.order), 0) + 1;
    const id = D.push(D.ref(db, `${E}/prizes`)).key;
    await D.update(D.ref(db), {
      [`${E}/prizes/${id}`]: { order, name: text },
      [`${E}/log/${D.push(D.ref(db, `${E}/log`)).key}`]: { type: 'prize-add', by, prizeId: id, detail: text, at: D.serverTimestamp() }
    });
  }

  // Designs with their own draw flow (not LD.stage) are demo-only: block their draw while live draws are on.
  function demoOnly() {
    const guard = e => {
      if (!liveOn()) return;
      if (e.type === 'click' && !(e.target.closest && e.target.closest('#draw, #spin'))) return;
      if (e.type === 'keydown' && ![' ', 'Enter', 'PageDown', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault(); e.stopImmediatePropagation();
    };
    addEventListener('click', guard, true); addEventListener('keydown', guard, true);
    let bar = null;
    onLive(() => {
      if (!liveOn()) { if (bar) bar.remove(); bar = null; return; }
      if (bar) return;
      bar = document.createElement('div'); bar.setAttribute('role', 'status');
      Object.assign(bar.style, { position: 'fixed', left: '50%', top: '14px', transform: 'translateX(-50%)', zIndex: 50, padding: '10px 16px', borderRadius: '10px', background: '#7a1220', color: '#fff', font: '600 14px/1.3 system-ui,sans-serif' });
      bar.textContent = 'Live draws are on. This design is demo-only: go back and choose another design for a real draw.';
      document.body.appendChild(bar);
    });
  }

  window.LD = { KEY, SAMPLE, DESIGNS, design, reduced, load, save, pool, randInt, pick, shuffle, ease, tween, sleep, audio, snd, confetti, fitText, chrome, busy, record, stage, demoOnly,
    live: { event: EVENT, onChange: onLive, state: liveState, message: liveMessage, user: () => live.user, prizes: livePrizes, nextPrize: liveNextPrize, winners: () => live.winners,
      signIn: liveSignIn, signOut: liveSignOut, addNames: liveAddNames, addPrize: liveAddPrize } };
})();
