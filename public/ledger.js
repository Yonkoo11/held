/* Filters sit on top of the shared renderer rather than beside it. A job has to look identical
   here and on /ask, or the register stops reading as one record of the same thing. */
setJobView(100, 'all');
document.querySelectorAll('.filters button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.filters button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    setJobView(100, b.dataset.f);
  });
});

/* The page opened on a title and three pills and then a void. These are the same jobs counted,
   in display type, so the surface leads with a fact instead of a filter control. */
async function paintStrip() {
  const strip = document.getElementById('strip');
  if (!strip) return;
  let list;
  try { list = await (await fetch('/jobs')).json(); } catch { return; }
  const n = (s) => list.filter((j) => j.state === s).length;
  const heldValue = list.filter((j) => j.state === 'held')
    .reduce((t, j) => t + Number(j.amountDisplay || 0), 0);
  const sym = (list[0] && list[0].assetSymbol) || 'HBAR';
  clear(strip);
  const figs = [
    [String(list.length), 'jobs bought', false],
    [String(n('held')), 'still held', true],
    [String(n('released')), 'seller paid', false],
    [String(n('refunded')), 'buyer refunded', false],
    [`${heldValue.toFixed(2)} ${sym}`, 'waiting on a decision', false],
  ];
  for (const [v, l, accent] of figs) {
    strip.appendChild(el('div', { className: 'fig-1' }, [
      el('span', { className: `n${accent ? ' accent' : ''}` }, [v]),
      el('span', { className: 'l' }, [l]),
    ]));
  }
}
paintStrip();
setInterval(paintStrip, 12000);
