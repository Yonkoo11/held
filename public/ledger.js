/* Filters sit on top of the shared renderer rather than beside it. A job has to look identical
   here and on /ask, or the register stops reading as one record of the same thing. */
setJobView(100, 'all');
document.querySelectorAll('.filters button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.filters button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    setJobView(100, b.dataset.f);
  });
});
