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

  // Out-of-order template-for resolution requires both halves of the proposal:
  // streamed HTML insertion (streamHTML) and a parser that turns "<?start ...>"
  // into a real ProcessingInstruction node instead of a bogus comment. There is
  // no JS fallback here on purpose, this demo only shows the native behavior.
  const supportsStreamingInsertion = typeof Element !== 'undefined' && 'streamHTML' in Element.prototype;
  const supportsProcessingInstructions = detectProcessingInstructionSupport();
  const nativeOutOfOrder = supportsStreamingInsertion && supportsProcessingInstructions;

  if (nativeOutOfOrder) {
    badge.classList.add('native');
    supportText.textContent = 'Native out-of-order streaming detected';
  } else {
    supportText.textContent = 'Native DPU not supported here — nothing will stream in';
  }

  function detectProcessingInstructionSupport() {
    try {
      const doc = new DOMParser().parseFromString('<body><?start name="t"><?end></body>', 'text/html');
      const node = doc.body.firstChild;
      return !!node && node.nodeType === Node.PROCESSING_INSTRUCTION_NODE;
    } catch (err) {
      return false;
    }
  }

  // Covers everything the shell/template markup below can contain, since it all
  // flows through the same sanitized streamHTML() call.
  const cardSanitizer = typeof Sanitizer !== 'undefined'
    ? new Sanitizer({
        elements: ['template', 'li', 'time', 'div', 'span', 'p', 'img'],
        attributes: ['for', 'id', 'class', 'datetime', 'src', 'alt', 'loading', 'aria-hidden', 'style', 'tabindex']
      })
    : null;

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

  const CLUB_TLA = {
    'Flamengo': 'FLA',
    'Palmeiras': 'PAL',
    'Corinthians': 'COR',
    'São Paulo': 'SAO',
    'Grêmio': 'GRE',
    'Internacional': 'INT',
    'Atlético-MG': 'CAM',
    'Cruzeiro': 'CRU',
    'Fluminense': 'FLU',
    'Botafogo': 'BOT'
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

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = kind ? `status-msg ${kind}` : 'status-msg';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function crestFor(tla, crestUrl, color) {
    if (crestUrl) {
      return `<img src="${escapeHtml(crestUrl)}" alt="" loading="lazy" />`;
    }
    return `<div class="crest-dot" style="background-color:${escapeHtml(color)}" aria-hidden="true">${escapeHtml(tla || '')}</div>`;
  }

  function fragmentFor(match) {
    const dt = new Date(match.date);
    const day = dt.toLocaleDateString('en-US', { day: '2-digit' });
    const mon = dt.toLocaleDateString('en-US', { month: 'short' });
    const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const iso = dt.toISOString();
    const fullDate = dt.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    const home = escapeHtml(match.home);
    const away = escapeHtml(match.away);

    const stub = `<span class="day">${day}</span><span class="mon">${mon}</span><span class="time">${time}</span>`;

    const body = `<div class="team home">${crestFor(match.homeTla, match.homeCrest, match.homeColor)}<span class="name">${home}</span></div>` +
      `<span class="vs" aria-hidden="true">VS</span>` +
      `<div class="team away">${crestFor(match.awayTla, match.awayCrest, match.awayColor)}<span class="name">${away}</span></div>`;

    const summary = escapeHtml(`${match.home} vs ${match.away}, ${fullDate}`);

    return { stub, body, iso, summary };
  }

  // The shell: skeleton tickets with a marker pair per match. Everything between
  // <?start> and <?end> is fallback content, replaced in place once the matching
  // <template for> arrives — regardless of what order that happens in.
  function shellMarkup(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<li class="ticket skeleton" id="match-${i}" tabindex="0">` +
        `<span class="live-dot" aria-hidden="true"></span>` +
        `<?start name="match-${i}">` +
        `<time class="stub"><span class="day">00</span><span class="mon">XXX</span><span class="time">00:00</span></time>` +
        `<div class="perforation" aria-hidden="true"></div>` +
        `<div class="body"><span class="pending">Fixture loading…</span></div>` +
        `<p class="visually-hidden match-summary">Fixture loading…</p>` +
        `<?end>` +
        `</li>`;
    }
    return html;
  }

  function templateMarkup(index, frag) {
    return `<template for="match-${index}">` +
      `<time class="stub" datetime="${frag.iso}">${frag.stub}</time>` +
      `<div class="perforation" aria-hidden="true"></div>` +
      `<div class="body">${frag.body}</div>` +
      `<p class="visually-hidden match-summary">${frag.summary}</p>` +
      `</template>`;
  }

  function markResolved(li) {
    li.classList.remove('skeleton');
    const dot = li.querySelector('.live-dot');
    if (dot) dot.classList.add('done');
  }

  // There is no per-fragment JS callback for native resolution (that's the
  // point), so a MutationObserver is the only way to notice a marker was
  // resolved and do the purely cosmetic follow-up (skeleton shimmer, live-dot).
  function watchNativeResolution(container, total) {
    let resolvedCount = 0;
    const observer = new MutationObserver(() => {
      container.querySelectorAll('li.ticket.skeleton').forEach((li) => {
        if (li.querySelector('.pending')) return;

        markResolved(li);
        resolvedCount += 1;
        const index = li.id.split('-')[1];
        log(`match-${index} resolved → native declarative patch (out of order)`);
        if (resolvedCount === total) {
          log('stream complete — all fixtures resolved out of order');
        }
      });
    });
    observer.observe(container, { childList: true, subtree: true });
    return observer;
  }

  let activeObserver = null;

  function disconnectObserver() {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
  }

  async function runOutOfOrderStream(matches) {
    disconnectObserver();
    clearLog();

    if (!nativeOutOfOrder) {
      ticketsEl.innerHTML = shellMarkup(matches.length);
      log('native out-of-order streaming is not supported in this browser — placeholders will stay as-is. Enable chrome://flags/#enable-experimental-web-platform-features in Chrome 148+.');
      return;
    }

    const order = shuffle(matches.map((_, i) => i));
    activeObserver = watchNativeResolution(ticketsEl, matches.length);

    try {
      const writer = ticketsEl.streamHTML({ sanitizer: cardSanitizer }).getWriter();
      await writer.write(shellMarkup(matches.length));
      log(`shell streamed — ${matches.length} placeholders waiting (out of order)`);

      for (const i of order) {
        await wait(350 + Math.random() * 1200);
        await writer.write(templateMarkup(i, fragmentFor(matches[i])));
        log(`fragment for match-${i} written to stream (out-of-order patch)`);
      }

      await writer.close();
    } catch (err) {
      disconnectObserver();
      log(`streaming failed (${err.message})`);
    }
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
        homeTla: m.homeTeam.tla,
        awayTla: m.awayTeam.tla,
        date: m.utcDate
      }));

      if (matches.length === 0) {
        setStatus('No scheduled matches returned for this competition right now.', 'error');
        loadBtn.disabled = false;
        return;
      }

      setStatus(`Loaded ${matches.length} fixtures.`, 'ok');
      await runOutOfOrderStream(matches);
    } catch (err) {
      setStatus(`Could not reach the API from here (${err.message}). Try the sample data button.`, 'error');
    }

    loadBtn.disabled = false;
  });

  sampleBtn.addEventListener('click', async () => {
    setStatus('Using sample data (team-color crests).', 'ok');

    const matches = SAMPLE_MATCHES.map((m) => ({
      ...m,
      homeColor: CLUB_COLORS[m.home] || '#6a6552',
      awayColor: CLUB_COLORS[m.away] || '#6a6552',
      homeTla: CLUB_TLA[m.home],
      awayTla: CLUB_TLA[m.away]
    }));

    await runOutOfOrderStream(matches);
  });

  resetBtn.addEventListener('click', () => {
    disconnectObserver();
    ticketsEl.innerHTML = '';
    clearLog();
    setStatus('');
    tokenInput.value = '';
  });

  ticketsEl.innerHTML = shellMarkup(5);
})();
