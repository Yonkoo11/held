/* One job at its own URL. The id comes from the path, so a buyer can send someone the exact thing
   they bought and that person sees the same evidence trail without an account. */
(async () => {
  const id = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
  if (!id) { set('jobSub', 'No job id in the address.'); return; }
  let j;
  try {
    const r = await fetch(`/jobs/${encodeURIComponent(id)}`);
    if (!r.ok) { set('jobTitle', 'No such job.'); set('jobSub', 'Nothing here with that id. It may have been bought from a different deployment.'); return; }
    j = await r.json();
  } catch {
    set('jobSub', 'Could not reach the service to read this job back.');
    return;
  }
  set('jobTitle', j.question.length > 78 ? j.question.slice(0, 78).trim() + '…' : j.question);
  set('jobSub', j.state === 'held'
    ? 'The money for this is still in escrow. Whoever paid for it can approve or reject it below; if nobody does, the deadline pays the seller.'
    : j.state === 'released' ? 'Escrow paid the seller for this one.'
    : j.state === 'refunded' ? 'Escrow paid the buyer back for this one.'
    : `This job is ${j.state}.`);
  $('jobs').appendChild(jobNode(j, 1));
  if (j.state === 'held') {
    soonestDeadline = j.deadline;
    setInterval(() => {
      document.querySelectorAll('.clock[data-deadline]').forEach((c) => {
        const t = c.querySelector('.t');
        if (t) t.textContent = countdown(Number(c.dataset.deadline) - Date.now());
      });
    }, 1000);
  }
})();
