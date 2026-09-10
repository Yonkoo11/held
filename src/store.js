// Job store. Deliberately a flat JSON file: the jobs are the demo's spine and being able to cat
// the file mid-demo is worth more than a database.
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'jobs.json');

function readAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function writeAll(all) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

export function put(job) {
  const all = readAll();
  all[job.id] = job;
  writeAll(all);
  return job;
}
export function get(id) { return readAll()[id] || null; }
export function list() { return Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt); }
export function patch(id, fields) {
  const job = get(id);
  if (!job) return null;
  return put({ ...job, ...fields, updatedAt: Date.now() });
}
