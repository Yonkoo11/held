/* /proof — read Hedera directly from the visitor's browser.
 *
 * Deliberately no Held server in this path. The point of the page is that a reader can verify the
 * claims without trusting us, and a page that proxied the mirror node through our own API would
 * prove nothing: we would still be the one telling them what happened. The only thing fetched from
 * us is /health, and only to learn WHICH account and topic to go and look at.
 *
 * Chainlink's proof-of-reserve page is the anti-pattern this is written against. It sells on-chain
 * verifiability using partner logos and executive quotes, and shows no chain data at all. */

const MIRROR = 'https://testnet.mirrornode.hedera.com';
const SCAN = 'https://hashscan.io/testnet';
const hbar = (tinybars) => (tinybars / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
const when = (consensus) => new Date(Number(String(consensus).split('.')[0]) * 1000);

const ago = (d) => {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const link = (href, text, cls = 'ext') =>
  el('a', { className: cls, href, target: '_blank', rel: 'noopener noreferrer' }, [text]);

async function mirror(path) {
  const r = await fetch(MIRROR + path, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`mirror node returned ${r.status}`);
  return r.json();
}

function fail(node, err) {
  clear(node);
  node.appendChild(el('p', { className: 'loading' }, [
    `Could not reach Hedera's mirror node just now (${err.message}). `,
    'That is the public network, not this service. Reload in a moment.',
  ]));
}

/* Each evidence line says what happened in the product's own words. The topic carries the type;
   this turns it into something a reader who has never seen the code can follow. */
const MEANING = {
  paid: 'a buyer paid, and the money landed in escrow',
  delivered: 'the agent produced the answer and it went to the buyer',
  'escrow-scheduled': 'the deadline release was scheduled on Hedera',
  'schedule-failed': 'scheduling the deadline release did not succeed',
  released: 'escrow paid the seller',
  refunded: 'escrow paid the buyer back',
};

async function paintAccount(escrow) {
  $('escLink').href = `${SCAN}/account/${escrow}`;
  $('escLink').textContent = escrow;
  const a = await mirror(`/api/v1/accounts/${escrow}?limit=1`);
  set('bal', hbar(a.balance.balance));
}

async function paintTransactions(escrow) {
  const node = $('txs');
  const d = await mirror(`/api/v1/transactions?account.id=${escrow}&limit=9&order=desc`);
  clear(node);
  const rows = (d.transactions || []).filter((t) => t.name === 'CRYPTOTRANSFER');
  if (!rows.length) {
    node.appendChild(el('p', { className: 'loading' }, ['No transfers on this account yet.']));
    return;
  }
  for (const t of rows) {
    // The escrow account's own leg of the transfer is the only one that says what happened to it.
    const leg = (t.transfers || []).find((x) => x.account === escrow);
    if (!leg) continue;
    const into = leg.amount > 0;
    const d0 = when(t.consensus_timestamp);
    node.appendChild(el('div', { className: 'row' }, [
      el('span', { className: 'k' }, [d0.toISOString().replace('T', ' ').slice(0, 19)]),
      el('span', { className: 'v' }, [
        el('span', { className: `amt ${into ? 'in' : 'out'}` }, [`${into ? '+' : '−'}${hbar(Math.abs(leg.amount))} HBAR`]),
        el('span', { className: 'why' }, [
          into ? 'paid in by a buyer, now held' : 'released out of escrow',
          t.result === 'SUCCESS' ? '' : ` · ${t.result}`,
        ]),
      ]),
      el('span', { className: 't' }, [link(`${SCAN}/transaction/${t.transaction_id}`, 'HashScan'), ' ', ago(d0)]),
    ]));
  }
}

/* Sixteen loose rows read as noise. A job's lifecycle is four lines and belongs together, so the
   log groups by job: you see how many jobs completed and what each one did, not a wall of events. */
async function paintLog(topicId) {
  const node = $('log');
  set('topId', topicId);
  $('topLink').href = `${SCAN}/topic/${topicId}`;
  const d = await mirror(`/api/v1/topics/${topicId}/messages?limit=60&order=desc`);
  clear(node);
  const msgs = d.messages || [];
  if (!msgs.length) { node.appendChild(el('p', { className: 'loading' }, ['Nothing on the topic yet.'])); return; }

  const byJob = new Map();
  for (const m of msgs) {
    let ev; try { ev = JSON.parse(atob(m.message)); } catch { continue; }
    if (!byJob.has(ev.jobId)) byJob.set(ev.jobId, { id: ev.jobId, at: when(m.consensus_timestamp), steps: [], seq: m.sequence_number });
    const g = byJob.get(ev.jobId);
    g.steps.unshift({ type: ev.type, degraded: ev.degraded });
    if (when(m.consensus_timestamp) > g.at) g.at = when(m.consensus_timestamp);
  }

  let shown = 0;
  const outcome = { released: 0, refunded: 0, open: 0 };
  for (const g of byJob.values()) {
    const last = g.steps[g.steps.length - 1];
    if (last && last.type === 'released') outcome.released++;
    else if (last && last.type === 'refunded') outcome.refunded++;
    else outcome.open++;
    if (shown++ >= 8) continue;
    node.appendChild(el('div', { className: 'jobgroup' }, [
      el('div', { className: 'h' }, [
        'job ',
        el('a', { href: `/job/${g.id}` }, [String(g.id).slice(0, 8)]),
        el('span', { className: 'ago' }, [ago(g.at)]),
      ]),
      el('div', { className: 'steps' }, g.steps.map((st) =>
        el('span', { className: `step ${st.type}` }, [el('i', {}, []), MEANING[st.type] || st.type]))),
    ]));
  }

  // The strip in the hero band: scale contrast, and every figure is counted from the topic itself.
  const strip = $('counts');
  if (strip) {
    clear(strip);
    const figs = [
      [byJob.size, 'jobs on this topic', false],
      [outcome.released, 'ended with the seller paid', true],
      [outcome.refunded, 'ended with the buyer refunded', false],
      [msgs.length, 'consensus messages read', false],
    ];
    for (const [n, label, accent] of figs) {
      strip.appendChild(el('div', { className: 'fig-1' }, [
        el('span', { className: `n${accent ? ' accent' : ''}` }, [String(n)]),
        el('span', { className: 'l' }, [label]),
      ]));
    }
  }
}

(async () => {
  let h;
  try {
    h = await (await fetch('/health')).json();
  } catch {
    $('txs').textContent = 'Could not read this service’s /health to find out which account to check.';
    return;
  }

  // Never present local sample data as chain data. If evidence is not on HCS, say so plainly and
  // do not draw a consensus log at all.
  const onChain = h.tiers && h.tiers.evidence && h.tiers.evidence.name === 'hcs';
  if (!onChain) {
    const n = $('degraded');
    n.className = 'notice';
    n.hidden = false;
    clear(n);
    n.appendChild(el('b', {}, ['This deployment is not writing evidence to Hedera right now. ']));
    n.appendChild(document.createTextNode(
      'It is on a local stand-in tier, so there is no consensus topic to read and nothing below ' +
      'would be independently verifiable. The page says so rather than showing you a file from our own disk.'));
    ['txs', 'log'].forEach((id) => { const x = $(id); if (x) clear(x); });
    return;
  }

  paintAccount(h.escrow).catch(() => set('bal', '—'));
  paintTransactions(h.escrow).catch((e) => fail($('txs'), e));
  paintLog(h.evidenceTopic).catch((e) => fail($('log'), e));
})();
