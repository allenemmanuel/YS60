/* Lucky Draw Studio — shared core.
   Every design page loads this first. All names, winners and prizes live in the event database (live mode only).
   The only thing kept in the browser is the sound and music on/off preference.
   It also gives each page the same keyboard shortcuts, confetti and sound helpers. */
(function () {
  const PREF_KEY = 'ld-studio-prefs';
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

  // ---------- shared state: sound/music preferences only ----------
  function normalise(s) {
    s = s && typeof s === 'object' ? s : {};
    return { soundOn: s.soundOn !== false, musicOn: s.musicOn !== false };
  }
  let mem = null; // used when browser storage is blocked
  function load() {
    try { const raw = localStorage.getItem(PREF_KEY); if (raw !== null) return normalise(JSON.parse(raw)); } catch (e) {}
    return normalise(mem);
  }
  function store(s) { mem = s; try { localStorage.setItem(PREF_KEY, JSON.stringify(s)); } catch (e) {} }
  function save(part) { const s = Object.assign(load(), part); store(s); return s; }
  const design = document.documentElement.dataset.design || '';

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

  // Shared name roll, shown before every design's own animation. Names flicker past from the draw pool,
  // slow down at the end and fade out, so the audience sees the names before the winner is shown.
  // `until` (optional) is a promise for the draw being saved: the roll lasts at least `minMs` and until it settles.
  // Resolves with the `until` value; rejects straight away if `until` fails.
  function nameRoll(names, { accent = '#f2ead8', minMs = 2800, until = null } = {}) {
    if (!names || !names.length) return Promise.resolve(until ? until : undefined);
    if (!document.getElementById('ld-roll-style')) {
      const st = document.createElement('style'); st.id = 'ld-roll-style';
      st.textContent = `.ld-roll{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
        background:rgba(6,10,18,.72);color:var(--ld-roll-accent,#f2ead8);font-family:system-ui,sans-serif;text-align:center;pointer-events:none;
        transition:opacity .35s ease;opacity:1}
        .ld-roll.out{opacity:0}
        .ld-roll-name{font-size:min(9vw,16vh);font-weight:600;line-height:1.05;max-width:90vw;overflow-wrap:anywhere;text-wrap:balance;will-change:transform}
        .ld-roll-label{font:600 12px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;opacity:.7}`;
      document.head.appendChild(st);
    }
    const el = document.createElement('div'); el.className = 'ld-roll'; el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--ld-roll-accent', accent);
    el.innerHTML = '<div class="ld-roll-name"></div><div class="ld-roll-label">Names in the draw</div>';
    const nameEl = el.firstChild;
    document.body.appendChild(el);
    const start = performance.now(), slowFrom = minMs * 0.6;
    let settled = false, value, failure = null, timer = null;
    const wait = until ? Promise.resolve(until) : Promise.resolve(undefined);
    wait.then(v => { settled = true; value = v; }, e => { failure = e; });
    return new Promise((resolve, reject) => {
      const finish = () => {
        clearTimeout(timer);
        el.classList.add('out');
        setTimeout(() => el.remove(), 400);
        failure ? reject(failure) : resolve(value);
      };
      const tick = () => {
        nameEl.textContent = names[randInt(names.length)];
        const t = performance.now() - start;
        if (failure) return finish();
        if (settled && t >= minMs) return finish();
        // reduced motion: slower changes; otherwise a quick flicker that eases out to about 4x slower near the end
        const base = reduced ? 520 : 75;
        const slow = t > slowFrom ? 1 + ((t - slowFrom) / (minMs - slowFrom)) * 3 : 1;
        timer = setTimeout(tick, base * slow);
      };
      tick();
    });
  }

  // Standard page flow for the newer designs: Draw -> name roll -> design's own animation -> record -> New draw.
  // Expects #draw, #reset, #meta, #hint, #soundBtn and #result in the page.
  function stage({ draw, reset, accent, idleHint = 'Press Draw or Space to start', drawingHint = 'Drawing…' }) {
    const $ = id => document.getElementById(id);
    const drawBtn = $('draw'), resetBtn = $('reset'), meta = $('meta'), hint = $('hint'), soundBtn = $('soundBtn'), result = $('result');
    let state = 'idle';
    function ui() {
      const left = pool().length, ls = liveState(), isLive = ls === 'on', s = load();
      const done = Object.values(live.winners).filter(w => w && w.status === 'active').length;
      meta.textContent = `Draw ${String(done + (state === 'won' ? 0 : 1)).padStart(2, '0')} · ${left === 1 ? '1 name' : left + ' names'} in the draw${isLive ? ' · live' : ''}`;
      soundBtn.textContent = s.soundOn ? 'Sound on' : 'Sound off'; soundBtn.setAttribute('aria-pressed', String(s.soundOn));
      if (state !== 'idle') return;
      if (ls === 'checking' || ls === 'connecting') { drawBtn.disabled = true; hint.textContent = 'Connecting to the event…'; }
      else if (ls === 'error' || ls === 'not-staff') { drawBtn.disabled = true; hint.textContent = liveMessage(); }
      else if (ls === 'off') { drawBtn.disabled = true; hint.innerHTML = 'Sign in on the <a href="../index.html">hub</a> to draw.'; }
      else if (isLive && !liveNextPrize()) { drawBtn.disabled = true; hint.textContent = 'No prize left to draw. Add a prize on the designs page.'; }
      else { drawBtn.disabled = !left; hint.innerHTML = left ? idleHint : 'No eligible names left to draw.'; }
    }
    // One draw. In live mode the winner is saved to the event first, and is shown only after the server accepts it.
    async function runDraw() {
      const p = pool(); if (state !== 'idle' || !liveOn() || !p.length) return;
      audio(); state = 'busy'; busy(true); drawBtn.disabled = true; result.textContent = '';
      let w, prizeName = currentPrize();
      const rollOpts = { accent, minMs: reduced ? 1200 : 2800 };
      // The names roll while the draw is saved; the winner is shown only after the server accepts it.
      hint.textContent = 'Saving the draw…';
      try { const claim = await nameRoll(p, { ...rollOpts, until: liveDraw() }); w = claim.name; prizeName = claim.prize.name; }
      catch (e) {
        console.error(e); state = 'idle'; busy(false); ui();
        hint.textContent = e.message || 'The draw was not saved.';
        return;
      }
      hint.textContent = drawingHint;
      try { await draw(w); } catch (e) { console.error(e); }
      result.textContent = 'The winner is ' + w;
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
  const pool = () => liveOn() ? liveEligible().map(g => g.name) : [];
  const livePrizes = () => Object.entries(live.prizes).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.order - b.order);
  const liveNextPrize = () => livePrizes().find(p => live.winners[p.id]?.status !== 'active') || null;
  const currentPrize = () => liveNextPrize()?.name || '';
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
  // MAKYS-style staff gate: one shared password, checked in the browser. It keeps casual visitors out of the
  // controls only. Anyone who can view this page can read and change the event data (decision 2026-11-26).
  const STUDIO_PASSWORD = 'malam', SESSION_KEY = 'ld-staff';
  const liveInit = (async () => {
    try {
      const [dbMod, appMod] = await Promise.all([import(FB + 'firebase-database.js'), import(FB + 'firebase-app.js')]);
      const app = appMod.initializeApp(FB_CONFIG, 'ld-studio');
      live.fb = { D: dbMod, db: dbMod.getDatabase(app) };
      live.authed = true;
      if (sessionStorage.getItem(SESSION_KEY) === '1') { live.user = { uid: 'studio' }; live.isStaff = true; attachLive(); }
      notifyLive();
    } catch (e) {
      console.error(e); live.authed = true; live.error = 'Could not reach the event database. Check the internet connection.'; notifyLive();
    }
  })();
  // A hanging download (slow or blocked network) must not block the page: after 8 s, treat Firebase as unreachable.
  setTimeout(() => { if (!live.authed) { live.authed = true; live.error = 'Could not reach the event database. Please check the connection.'; notifyLive(); } }, 8000);
  async function liveSignIn(password) {
    await liveInit;
    if (!live.fb) throw Object.assign(new Error('Could not reach the event database.'), { code: 'network' });
    if (password !== STUDIO_PASSWORD) throw Object.assign(new Error('Wrong password.'), { code: 'wrong-password' });
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
    detachLive(); live.user = { uid: 'studio' }; live.isStaff = true; live.error = ''; attachLive(); notifyLive();
  }
  async function liveSignOut() {
    await liveInit;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    detachLive(); live.user = null; live.isStaff = false; live.error = ''; notifyLive();
  }

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
    const { D, db } = live.fb, E = `events/${EVENT}`, by = 'studio';
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
    const { D, db } = live.fb, E = `events/${EVENT}`, by = 'studio';
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
  async function liveAddPrize(name, counter) {
    const { D, db } = live.fb, E = `events/${EVENT}`, by = 'studio';
    const text = name.replace(/\s+/g, ' ').trim().slice(0, 200);
    const where = String(counter || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!text) return;
    const order = livePrizes().reduce((m, p) => Math.max(m, p.order), 0) + 1;
    const id = D.push(D.ref(db, `${E}/prizes`)).key;
    await D.update(D.ref(db), {
      [`${E}/prizes/${id}`]: where ? { order, name: text, counter: where } : { order, name: text },
      [`${E}/log/${D.push(D.ref(db, `${E}/log`)).key}`]: { type: 'prize-add', by, prizeId: id, detail: text, at: D.serverTimestamp() }
    });
  }

  window.LD = { DESIGNS, design, reduced, load, save, pool, randInt, pick, shuffle, ease, tween, sleep, audio, snd, confetti, fitText, chrome, busy, stage, nameRoll,
    live: { event: EVENT, onChange: onLive, state: liveState, message: liveMessage, user: () => live.user, prizes: livePrizes, nextPrize: liveNextPrize, winners: () => live.winners, guests: () => live.guests,
      signIn: liveSignIn, signOut: liveSignOut, addNames: liveAddNames, addPrize: liveAddPrize, draw: liveDraw } };
})();
