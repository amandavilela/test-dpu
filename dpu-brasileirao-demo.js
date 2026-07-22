(function () {
  const ticketsEl = document.querySelector('#tickets');
  const logEl = document.querySelector('#log');
  const statusEl = document.querySelector('#status');
  const loadBtn = document.querySelector('#load-btn');
  const sampleBtn = document.querySelector('#sample-btn');
  const resetBtn = document.querySelector('#reset-btn');
  const tokenInput = document.querySelector('#token');
  const badge = document.querySelector('#support-badge');
  const supportText = document.querySelector('#support-text');

  const supportsDPU = typeof Element !== 'undefined' &&
    ('streamHTML' in Element.prototype || 'appendHTML' in Element.prototype);

  if (supportsDPU) {
    badge.classList.add('native');
    supportText.textContent = 'Native DPU detected';
  } else {
    supportText.textContent = 'Fallback JS polyfill (native DPU not detected)';
  }

  const CLUB_COLORS = {
    'Flamengo': '#C8102E',
    'Palmeiras': '#006437',
    'Corinthians': '#1B1B1B',
    'São Paulo': '#C0392B',
    'Grêmio': '#0057A8',
    'Internacional': '#DA1116',
    'Atlético-MG': '#1B1B1B',
    'Cruzeiro': '#003399',
    'Fluminense': '#7A1E3C',
    'Botafogo': '#1B1B1B'
  };

  const SAMPLE_MATCHES = [
    { home: 'Flamengo', away: 'Palmeiras', date: daysFromNow(2, 16, 0) },
    { home: 'Corinthians', away: 'São Paulo', date: daysFromNow(3, 18, 30) },
    { home: 'Grêmio', away: 'Internacional', date: daysFromNow(4, 20, 0) },
    { home: 'Atlético-MG', away: 'Cruzeiro', date: daysFromNow(6, 16, 0) },
    { home: 'Fluminense', away: 'Botafogo', date: daysFromNow(7, 18, 30) }
  ];

  function daysFromNow(d, h, m) {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  }

  function log(msg) {
    const line = document.createElement('p');
    const t = new Date().toLocaleTimeString();
    line.innerHTML = `<span class="dim">[${t}]</span> ${msg}`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function clearLog() {
    logEl.innerHTML = '';
  }

  function renderSkeletons() {
    ticketsEl.innerHTML = '';

    for (let i = 0; i < 5; i++) {
      const li = document.createElement('li');
      li.className = 'ticket skeleton';
      li.id = `match-${i}`;
      li.innerHTML = `
        <span class="live-dot" aria-hidden="true"></span>
        <time class="stub">
          <span class="day">00</span>
          <span class="mon">XXX</span>
          <span class="time">00:00</span>
        </time>
        <div class="perforation" aria-hidden="true"></div>
        <div class="body" data-slot></div>
        <p class="visually-hidden match-summary">Fixture loading…</p>
      `;

      ticketsEl.appendChild(li);
    }
  }

  function initials(name) {
    return name.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }

  function svgCrest(name, color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill="${color}" />
      <text x="20" y="26" font-family="sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">${initials(name)}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  function fragmentFor(match) {
    const dt = new Date(match.date);
    const day = dt.toLocaleDateString('en-US', { day: '2-digit' });
    const mon = dt.toLocaleDateString('en-US', { month: 'short' });
    const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const iso = dt.toISOString();
    const fullDate = dt.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    const stub = `
      <span class="day">${day}</span>
      <span class="mon">${mon}</span>
      <span class="time">${time}</span>
    `;

    const body = `
      <div class="team home"><img src="${match.homeCrest}" alt="" loading="lazy" /><span class="name">${match.home}</span></div>
      <span class="vs" aria-hidden="true">VS</span>
      <div class="team away"><img src="${match.awayCrest}" alt="" loading="lazy" /><span class="name">${match.away}</span></div>
    `;

    const summary = `${match.home} vs ${match.away}, ${fullDate}`;

    return { stub, body, iso, summary };
  }

  function insertFragment(cardEl, frag, index) {
    return new Promise((resolve) => {
      const stubEl = cardEl.querySelector('.stub');
      const bodyEl = cardEl.querySelector('[data-slot]');
      const position = index + 1;

      if (typeof bodyEl.appendHTML === 'function') {
        bodyEl.appendHTML(frag.body);
        log(`fragment ${position}/5 ready → inserted via <code>appendHTML</code> (native)`);
      } else {
        bodyEl.innerHTML = frag.body;
        log(`fragment ${position}/5 ready → inserted via fallback polyfill (innerHTML)`);
      }

      cardEl.querySelector('.match-summary').textContent = frag.summary;
      stubEl.setAttribute('datetime', frag.iso);
      stubEl.innerHTML = frag.stub;
      cardEl.classList.remove('skeleton');
      cardEl.querySelector('.live-dot').classList.add('done');

      resolve();
    });
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = kind ? `status-msg ${kind}` : 'status-msg';
  }

  async function streamMatches(matches) {
    renderSkeletons();
    clearLog();
    log(`shell rendered, ${matches.length} placeholders waiting`);

    for (let i = 0; i < matches.length; i++) {
      await new Promise((r) => setTimeout(r, 450));
      const cardEl = document.querySelector(`#match-${i}`);
      const frag = fragmentFor(matches[i]);
      await insertFragment(cardEl, frag, i);
    }

    log('stream complete — all 5 fixtures inserted');
  }

  loadBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();

    if (!token) {
      setStatus('Paste a token first, or use the sample data button.', 'error');
      return;
    }

    loadBtn.disabled = true;
    setStatus('Fetching fixtures…');

    try {
      const res = await fetch(
        `https://api.football-data.org/v4/competitions/BSA/matches?status=SCHEDULED&limit=5`,
        { headers: { 'X-Auth-Token': token } }
      );

      if (!res.ok) {
        throw new Error(`API responded with ${res.status}`);
      }

      const data = await res.json();
      const matches = (data.matches || []).slice(0, 5).map((m) => ({
        home: m.homeTeam.shortName || m.homeTeam.name,
        away: m.awayTeam.shortName || m.awayTeam.name,
        homeCrest: m.homeTeam.crest,
        awayCrest: m.awayTeam.crest,
        date: m.utcDate
      }));

      if (matches.length === 0) {
        setStatus('No scheduled matches returned for this competition right now.', 'error');
        loadBtn.disabled = false;
        return;
      }

      setStatus(`Loaded ${matches.length} fixtures.`, 'ok');
      await streamMatches(matches);
    } catch (err) {
      setStatus(`Could not reach the API from here (${err.message}). Try the sample data button.`, 'error');
    }

    loadBtn.disabled = false;
  });

  sampleBtn.addEventListener('click', async () => {
    setStatus('Using sample data (generated crests).', 'ok');

    const matches = SAMPLE_MATCHES.map((m) => ({
      ...m,
      homeCrest: svgCrest(m.home, CLUB_COLORS[m.home] || '#6a6552'),
      awayCrest: svgCrest(m.away, CLUB_COLORS[m.away] || '#6a6552')
    }));

    await streamMatches(matches);
  });

  resetBtn.addEventListener('click', () => {
    ticketsEl.innerHTML = '';
    clearLog();
    setStatus('');
    tokenInput.value = '';
  });

  renderSkeletons();
})();
