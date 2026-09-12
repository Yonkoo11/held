// Job store. Deliberately a flat JSON file: the jobs are the demo's spine and being able to cat the
// file mid-demo is worth more than a database.
//
// `transition` is the only way a job's state may change, and it is deliberately synchronous from
// read to write. Node runs one request handler at a time between awaits, so a synchronous
// compare-and-set cannot interleave with another request. Putting an `await` inside it would
// reintroduce exactly the double-release race this exists to prevent.
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'jobs.json');

function readAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function writeAll(all) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  fs.renameSync(tmp, FILE);          // atomic on POSIX: never leaves a half-written jobs file
}

export function put(job) {
  const all = readAll();
  all[job.id] = job;
  writeAll(all);
  return job;
}
export function get(id) { return readAll()[id] || null; }
export function list() { return Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt); }

/**
 * Atomically move a job from one of `from` into `to`. Returns { ok, job } or { ok: false, reason }.
 * Callers must claim a job with this BEFORE moving any money, and only then perform the transfer.
 */
export function transition(id, from, to, fields = {}) {
  const all = readAll();
  const job = all[id];
  if (!job) return { ok: false, reason: 'no such job', status: 404 };
  const allowed = Array.isArray(from) ? from : [from];
  if (!allowed.includes(job.state)) {
    return { ok: false, reason: `job is already ${job.state}`, status: 409 };
  }
  all[id] = { ...job, ...fields, state: to, updatedAt: Date.now() };
  writeAll(all);
  return { ok: true, job: all[id] };
}

/** Update fields on a job WITHOUT touching its state. State changes must use `transition`. */
export function patch(id, fields) {
  const all = readAll();
  const job = all[id];
  if (!job) return null;
  const { state, ...safe } = fields;          // state is the state machine's business, not this
  all[id] = { ...job, ...safe, updatedAt: Date.now() };
  writeAll(all);
  return all[id];
}
