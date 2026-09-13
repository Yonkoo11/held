/* Fetch the live 402 from our own /work so the documented challenge cannot drift from the real one.
   If it ever disagrees with the block rendered server-side, the real one wins and the page says so. */
(async () => {
  const note = document.getElementById('quotenote');
  try {
    const r = await fetch('/work', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'what does this endpoint cost' }),
    });
    if (r.status !== 402) { note.textContent = `This server answered ${r.status} rather than 402 just now.`; return; }
    const q = await r.json();
    const pre = document.getElementById('livequote');
    clear(pre);
    const text = JSON.stringify(q, null, 2);
    // Keep the payTo line marked, because it is the only line that matters.
    for (const line of text.split('\n')) {
      const isPayTo = line.includes('"payTo"');
      pre.appendChild(el(isPayTo ? 'b' : 'span', {}, [line + '\n']));
    }
    note.textContent = `Fetched live from this server a moment ago. payTo is ${q.accepts[0].payTo}; the seller's fee payer is ${(q.accepts[0].extra || {}).feePayer || 'not set'}.`;
  } catch (e) {
    note.textContent = 'Could not reach /work to fetch the live challenge. The block above is the shape it returns.';
  }
})();
