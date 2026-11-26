// Shared pieces for the four event pages: names.html, prizes.html, display.html, draw.html.
// Needs core.js (window.LD) loaded first. All data comes from the live event (see core.js).
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PAGES = [['index.html', 'Hub'], ['names.html', 'Names'], ['prizes.html', 'Prizes'], ['batch.html', 'Batch'], ['display.html', 'Display'], ['draw.html', 'Draw']];

// Top navigation. The status text on the right shows whether the event is connected.
function nav(active) {
  const el = $('nav');
  if (!el) return;
  el.innerHTML = `<div class="nav-links">${PAGES.map(([href, label]) => `<a href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</div>`
    + '<span class="status" id="status"></span>';
}

// Sign-in box. One shared password for all staff pages (MAKYS method). Signing in once works on every page in this tab.
function gate(el) {
  let shown = '';
  const draw = () => {
    const s = LD.live.state();
    const status = $('status');
    if (status) {
      status.textContent = s === 'on' ? 'Connected to the event' : s === 'off' ? 'Not signed in' : 'Connecting…';
      status.classList.toggle('on', s === 'on');
    }
    if (s === shown) return;
    shown = s;
    if (s === 'on') {
      el.className = 'gate on';
      el.innerHTML = `<span>Signed in to <code>${esc(LD.live.event)}</code></span><button id="signout" class="signout" type="button">Sign out</button>`;
      $('signout').onclick = () => LD.live.signOut();
    } else if (s === 'off' || s === 'error') {
      el.className = 'gate';
      el.innerHTML = `<form id="signin"><input id="pw" type="password" placeholder="Password" autocomplete="current-password" required>
        <button class="primary" type="submit">Sign in</button></form><p class="msg" id="signinMsg" role="status"></p>`;
      $('signin').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('button'); btn.disabled = true;
        try { await LD.live.signIn($('pw').value); }
        catch (err) {
          $('signinMsg').textContent = err.code === 'wrong-password' ? 'Wrong password.' : 'Could not sign in: ' + (err.message || err);
          $('signinMsg').classList.add('err'); btn.disabled = false;
        }
      });
    } else {
      el.className = 'gate';
      el.innerHTML = `<span>${s === 'not-staff' ? 'This account is not allowed here.' : 'Connecting to the event…'}</span>`;
    }
  };
  LD.live.onChange(draw);
  draw();
}

// Prize helpers, shared by prizes.html, display.html and draw.html
function prizeRows() {
  const winners = LD.live.winners();
  const next = LD.live.nextPrize();
  return LD.live.prizes().map(p => {
    const w = winners[p.id];
    const won = w && w.status === 'active';
    return { ...p, won: !!won, winner: won ? w.name : '', isNext: !!next && next.id === p.id };
  });
}
