const $ = (id) => document.getElementById(id);
// Every page loads this one script and no page has all of these nodes. Writing through `set`
// rather than `$(id).textContent` is what lets /proof and /build share the header and the
// clock without each of them carrying a dead `jobs` list to keep the script from throwing.
const set = (id, v) => { const n = $(id); if (n) n.textContent = v; };

/* The claim token proves you are the buyer for a job. It is shown once, so the page keeps it.
   Per-browser only: open this elsewhere and you cannot decide on these jobs, which is the point. */
const TOKENS = 'held.tokens';
const readTokens = () => { try { return JSON.parse(localStorage.getItem(TOKENS) || '{}'); } catch { return {}; } };
function saveToken(jobId, token) {
  try { const t = readTokens(); t[jobId] = token; localStorage.setItem(TOKENS, JSON.stringify(t)); } catch {}
}

/* Everything below builds DOM nodes and sets textContent. Nothing concatenates HTML, because the
   question comes from a user and the deliverable comes from a model: both are attacker controlled. */
function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('data-')) n.setAttribute(k, v);
    else n[k] = v;
  }
  // Children may be nodes or plain strings. Strings become text nodes, never markup, so a
  // sentence that mixes prose with a link stays readable at the call site without innerHTML.
  for (const c of [].concat(children)) {
    if (!c) continue;                                   // '' and null are intentional skips
    n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  return n;
}
const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };

/* Models still emit **bold** and *italic* even when told not to. Render those as real nodes rather
   than showing the asterisks, and still never touch innerHTML, so the text stays inert. */
function prose(text) {
  const frag = document.createDocumentFragment();
  for (const line of String(text || '').split('\n')) {
    const p = el('p');
    const clean = line.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '');
    const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
    let last = 0, m;
    while ((m = re.exec(clean)) !== null) {
      if (m.index > last) p.appendChild(document.createTextNode(clean.slice(last, m.index)));
      if (m[1] !== undefined) p.appendChild(el('strong', { text: m[1] }));
      else if (m[2] !== undefined) p.appendChild(el('em', { text: m[2] }));
      else p.appendChild(el('code', { text: m[3] }));
      last = re.lastIndex;
    }
    if (last < clean.length) p.appendChild(document.createTextNode(clean.slice(last)));
    if (p.textContent.trim()) frag.appendChild(p);
  }
  return frag;
}

async function loadHealth() {
  const h = await (await fetch('/health')).json();
  const live = !h.tiers.settlement.degraded;
  set('escrow', h.escrow);
  set('escrow2', h.escrow);
  set('price', h.price);
  set('unit', h.asset.symbol);
  // /ask leads with three figures rather than a form. Same /health call, no extra request.
  set('fPrice', h.price);
  set('fUnit', `${h.asset.symbol} per question`);
  set('fWindow', h.reviewMinutes);
  set('fEscrow', h.escrow);
  set('caveat', live
    ? `${h.price} ${h.asset.symbol} a question, settled on Hedera testnet. Real transactions on a public network, paid with test funds.`
    : `${h.price} ${h.asset.symbol} a question. Running on the local stand-in, so none of this reaches Hedera.`);
  const box = $('tiers');
  clear(box);
  for (const [k, v] of Object.entries(h.tiers || {})) {
    box.appendChild(el('span', { class: 'chip', 'data-degraded': String(v.degraded), text: `${k} · ${v.label}` }));
  }
  $('foot').textContent =
    `facilitator ${h.facilitator} · fee payer ${h.feePayer} · evidence ${h.evidenceTopic} · agent ${h.agent.id}`;
}

function countdown(ms) {
  if (ms <= 0) return 'releasing';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* The wire reads off the soonest open job. With nothing held it still draws, because the diagram is
   the explanation and must not depend on there being a payment in flight. */
let soonestDeadline = null;
function paintWire() {
  const resting = soonestDeadline === null;
  const w = $('wire');
  if (!w) return;
  w.dataset.live = String(!resting);
  $('wclock').hidden = resting;
  set('wnote', resting ? 'per request, nothing in flight yet' : 'until the seller gets paid');
  if (!resting) set('wclock', countdown(soonestDeadline - Date.now()));
}

/* Expanded deliverables survive the poll. Before this, the six-second refresh silently collapsed a
   long answer the reader had opened, which looked like the page fighting them. */
const expanded = new Set();

function jobNode(j, entryNo) {
  const mine = Boolean(readTokens()[j.id]);
  const held = j.state === 'held';

  const edgeParts = [
    el('div', { class: 'amt', text: `${j.amountDisplay} ${j.assetSymbol || ''}`.trim() }),
    el('span', { class: 'state', 'data-s': j.state, text: j.state }),
  ];
  if (held) {
    edgeParts.push(el('div', { class: 'clock', 'data-deadline': String(j.deadline) }, [
      el('div', { class: 't', text: countdown(j.deadline - Date.now()) }),
      el('div', { class: 'c', text: 'left for you to decide' }),
    ]));
  }
  if (held && mine) {
    edgeParts.push(el('div', { class: 'decide' }, [
      el('button', { class: 'go', 'data-act': 'approve', 'data-id': j.id, text: 'Pay the seller' }),
      el('button', { class: 'quiet', 'data-act': 'reject', 'data-id': j.id, text: 'Refund me instead' }),
    ]));
  }

  const bodyParts = [el('div', { class: 'q', text: j.question })];
  const d = el('div', { class: 'deliverable' });
  d.appendChild(prose(j.deliverable));
  if ((j.deliverable || '').length > 620) {
    const open = expanded.has(j.id);
    if (!open) d.classList.add('clamped');
    const more = el('button', { class: 'more', type: 'button', text: open ? 'Show less' : 'Read all' });
    more.addEventListener('click', () => {
      const nowClamped = d.classList.toggle('clamped');
      if (nowClamped) expanded.delete(j.id); else expanded.add(j.id);
      more.textContent = nowClamped ? 'Read all' : 'Show less';
    });
    bodyParts.push(d, more);
  } else {
    bodyParts.push(d);
  }
  bodyParts.push(el('div', {
    class: 'byline',
    text: [j.workerTier, j.model, j.agentVersion].filter((x) => x && x !== 'none').join(' · '),
  }));

  if (!held) {
    // The reason and the transaction id are the record of this entry, so they read at full width
    // here rather than wrapping a Hedera id mid-token in the narrow ledger column.
    const tail = [j.decisionReason, j.decisionTx].filter(Boolean).join('  ·  ');
    if (tail) bodyParts.push(el('div', { class: 'outcome', text: tail }));
  } else if (!mine) {
    bodyParts.push(el('div', { class: 'outcome', text: 'someone paid for this in another browser, so only they can approve or refund it' }));
  }

  const trail = el('div', { class: 'trail' });
  for (const e of j.evidence || []) {
    trail.appendChild(el('span', {}, [
      el('b', { text: e.type }),
      document.createTextNode(' ' + new Date(e.at).toLocaleTimeString()),
    ]));
  }
  bodyParts.push(trail);

  return el('div', { class: 'row' }, [
    el('div', { class: 'no', text: String(entryNo).padStart(3, '0') }),
    el('div', {}, bodyParts),
    el('div', { class: 'edge' }, edgeParts),
  ]);
}

/* Rebuilding the list every six seconds threw away scroll position and any open answer, so only
   rebuild when something a reader can actually see has changed. */
let lastSignature = '';
/* /ask shows the most recent handful; /ledger shows everything and can filter by state. Same
   renderer either way, because a job should not look like a different object on a different page. */
let jobLimit = 8;
let jobFilter = 'all';
function setJobView(limit, filter) {
  jobLimit = limit; jobFilter = filter;
  lastSignature = '';          // the cache keys on content, so a view change has to invalidate it
  loadJobs();
}

/* The wire is the home page's signature element and the only thing on it that moves. It reads
   soonestDeadline, which used to be a side effect of rendering the job list. After the site was
   split, / has no job list, so the wire sat dead at "nothing in flight yet" even while money was
   genuinely in escrow. A page whose one live element is lying is worse than one with no live
   element, so / now fetches the deadlines it needs and nothing else. */
async function loadDeadlinesOnly() {
  if ($('jobs') || !$('wire')) return;
  try {
    const list = await (await fetch('/jobs')).json();
    const held = list.filter((j) => j.state === 'held').map((j) => j.deadline);
    soonestDeadline = held.length ? Math.min(...held) : null;
    paintWire();
  } catch { /* the wire simply stays at rest; it never invents a clock */ }
}

async function loadJobs() {
  if (!$('jobs')) return;
  const list = await (await fetch('/jobs')).json();
  const box = $('jobs');
  const pool = jobFilter === 'all' ? list : list.filter((j) => j.state === jobFilter);
  const open = list.filter((j) => j.state === 'held').length;
  set('count', pool.length
    ? `${pool.length} ${pool.length === 1 ? 'entry' : 'entries'} · ${open} open`
    : '');
  if (!pool.length) {
    soonestDeadline = null; paintWire();
    if (lastSignature !== 'empty:' + jobFilter) {
      lastSignature = 'empty:' + jobFilter;
      clear(box);
      box.appendChild(el('p', { class: 'empty', text: jobFilter === 'all'
        ? 'You have not bought anything yet. Ask the agent a question and it turns up here with a clock on it.'
        : `Nothing in that state right now.` }));
    }
    return;
  }
  const shown = pool.slice(0, jobLimit);
  const full = await Promise.all(shown.map((j) => fetch(`/jobs/${encodeURIComponent(j.id)}`).then((r) => r.json())));

  const deadlines = full.filter((j) => j.state === 'held').map((j) => j.deadline);
  soonestDeadline = deadlines.length ? Math.min(...deadlines) : null;
  paintWire();

  const signature = jobFilter + '|' + full.map((j) => `${j.id}:${j.state}:${j.decisionTx || ''}:${(j.evidence || []).length}`).join('|');
  if (signature === lastSignature) return;
  lastSignature = signature;

  clear(box);
  full.forEach((j, i) => box.appendChild(jobNode(j, pool.length - i)));
}

if ($('go')) $('go').addEventListener('click', async () => {
  const question = $('q').value.trim();
  if (!question) { $('q').focus(); return; }
  const btn = $('go');
  btn.disabled = true; btn.textContent = 'Settling on Hedera…'; $('err').hidden = true;
  try {
    const r = await fetch('/demo/buy', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error || `failed (${r.status})`);
    if (b.claimToken) saveToken(b.jobId, b.claimToken);
    $('q').value = '';
    await loadJobs();
  } catch (e) {
    set('err', e.message); if ($('err')) $('err').hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'Pay and ask';
  }
});

if ($('jobs')) $('jobs').addEventListener('click', async (ev) => {
  const b = ev.target.closest('button[data-act]');
  if (!b) return;
  const was = b.textContent;
  b.disabled = true;
  b.textContent = b.dataset.act === 'approve' ? 'Paying the seller…' : 'Refunding…';
  const res = await fetch(`/jobs/${encodeURIComponent(b.dataset.id)}/${b.dataset.act}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Job-Token': readTokens()[b.dataset.id] || '' },
    body: JSON.stringify({ reason: b.dataset.act === 'approve' ? 'looks right' : 'not what I asked for' }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    set('err', e.error || `could not ${b.dataset.act}`); if ($('err')) $('err').hidden = false;
    b.disabled = false; b.textContent = was;
  }
  await loadJobs();
});

setInterval(() => {
  document.querySelectorAll('.clock[data-deadline]').forEach((c) => {
    const t = c.querySelector('.t');
    if (t) t.textContent = countdown(Number(c.dataset.deadline) - Date.now());
  });
  if (soonestDeadline !== null && $('wclock')) set('wclock', countdown(soonestDeadline - Date.now()));
}, 1000);
if ($('jobs')) setInterval(loadJobs, 6000);
else if ($('wire')) setInterval(loadDeadlinesOnly, 6000);

loadHealth().then(() => { if ($('jobs')) loadJobs(); else loadDeadlinesOnly(); });


/* Wayfinding. Without an active state a persistent nav is just a row of links. */
(() => {
  const here = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('nav a[href]').forEach((a) => {
    const to = a.getAttribute('href').replace(/\/$/, '') || '/';
    if (to === here) { a.setAttribute('aria-current', 'page'); }
  });
})();


/* The server rejects a question over MAX_QUESTION_CHARS (2000). That limit used to be invisible:
   you could write past it, press the button, and only find out after the request failed. maxlength
   stops the overrun; this tells you it is coming, and only once you are near it. Silence until
   1600 characters, because a counter that is always on is just noise. */
(() => {
  const q = $('q'), c = $('counter');
  if (!q || !c) return;
  const LIMIT = Number(q.getAttribute('maxlength')) || 2000;
  const NEAR = Math.round(LIMIT * 0.8);
  const paint = () => {
    const n = q.value.length;
    c.textContent = `${n} / ${LIMIT}`;
    c.dataset.near = String(n >= NEAR);
    c.dataset.over = String(n >= LIMIT);
  };
  q.addEventListener('input', paint);
  paint();
})();
