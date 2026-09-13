/* Fetch the live 402 from our own /work so the documented challenge cannot drift from the real one.
   The pane beside the prose is the actual response body, not a transcription of one. */
(async () => {
  const note = document.getElementById('quotenote');
  const pre = document.getElementById('livequote');
  try {
    const r = await fetch('/work', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'what does this endpoint cost' }),
    });
    if (r.status !== 402) { note.textContent = `answered ${r.status}, not 402`; return; }
    const q = await r.json();
    clear(pre);
    for (const line of JSON.stringify(q, null, 2).split('\n')) {
      // payTo is the only line that matters, so it is the only line that is marked.
      pre.appendChild(el(line.includes('"payTo"') ? 'b' : 'span', {}, [line + '\n']));
    }
    const a = q.accepts[0];
    note.textContent = `live · payTo ${a.payTo}, seller ${(a.extra || {}).feePayer || 'n/a'}`;
  } catch {
    note.textContent = 'could not reach /work';
  }
})();
