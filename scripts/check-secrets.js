// Checks that the local secrets file cannot leak. Run it any time:  npm run check:secrets
//
// It never prints the contents of anything. It reports shapes, counts and permissions only, so it
// is safe to run with the output visible to somebody else.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ENV_NAME = process.env.ENV_FILE || '.env';
const ENV_PATH = path.join(process.cwd(), ENV_NAME);

let fail = 0, warn = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => { fail++; console.log(`  FAIL  ${m}`); };
const meh = (m) => { warn++; console.log(`  warn  ${m}`); };

// Argument arrays, never a shell string: ENV_FILE comes from the environment and would otherwise
// be interpolated straight into a shell by a script whose entire purpose is not leaking things.
const git = (...args) => {
  try { return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return null; }
};

console.log(`\nSecret hygiene for ${ENV_NAME}\n`);

// 1. Does it exist, and can only its owner read it?
if (!fs.existsSync(ENV_PATH)) {
  meh(`${ENV_NAME} does not exist yet — nothing to leak, nothing to run with either`);
} else {
  const mode = fs.statSync(ENV_PATH).mode & 0o777;
  if (mode === 0o600) ok(`${ENV_NAME} is chmod 600 (owner read/write only)`);
  else bad(`${ENV_NAME} is chmod ${mode.toString(8)} — should be 600. Fix: chmod 600 ${ENV_NAME}`);
}

// 2. Git must ignore it, and must not already be tracking it.
const ignored = git('check-ignore', ENV_NAME) !== null;
if (ignored) ok(`git ignores ${ENV_NAME}`);
else bad(`git does NOT ignore ${ENV_NAME} — add it to .gitignore before committing anything`);

const tracked = git('ls-files', '--error-unmatch', ENV_NAME);
if (tracked) bad(`${ENV_NAME} is TRACKED BY GIT. Remove it: git rm --cached ${ENV_NAME}`);
else ok(`${ENV_NAME} is not tracked`);

// 3. Has anything secret-shaped ever been committed? Checks history, not just the working tree.
const PATTERNS = [
  ['Hedera DER private key', /302e020100300506032b657004220420[0-9a-f]{64}/i],
  ['Anthropic key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI key', /\bsk-[A-Za-z0-9]{32,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['private key block', /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
];

const trackedFiles = (git('ls-files') || '').split('\n').filter(Boolean);
let hitsInTree = 0;
for (const f of trackedFiles) {
  let body = '';
  try { body = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const [label, re] of PATTERNS) {
    if (re.test(body)) { bad(`${label} pattern found in tracked file ${f}`); hitsInTree++; }
  }
}
if (hitsInTree === 0) ok(`no secret-shaped strings in ${trackedFiles.length} tracked files`);

const history = git('log', '-p', '--all', '--no-color') || '';
let hitsInHistory = 0;
for (const [label, re] of PATTERNS) {
  if (re.test(history)) { bad(`${label} pattern appears somewhere in git history`); hitsInHistory++; }
}
if (hitsInHistory === 0) ok('no secret-shaped strings anywhere in git history');

// 4. The guard that stops a mistake becoming a commit.
const hook = path.join(process.cwd(), '.git', 'hooks', 'pre-commit');
if (fs.existsSync(hook) && (fs.statSync(hook).mode & 0o111)) ok('pre-commit secret guard is installed and executable');
else bad('no executable pre-commit hook — run: node scripts/install-hooks.js');

// 5. Values that are filled in, reported as shapes only.
if (fs.existsSync(ENV_PATH)) {
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='));
  const filled = lines.filter((l) => l.split('=').slice(1).join('=').trim());
  console.log(`\n  ${filled.length} of ${lines.length} settings have a value. Names only:`);
  for (const l of lines) {
    const k = l.split('=')[0].trim();
    const v = l.split('=').slice(1).join('=').trim();
    const secret = /KEY$/.test(k);
    const shown = !v ? '(empty)' : secret ? `(set, ${v.length} chars, not shown)` : v;
    console.log(`    ${k.padEnd(22)} ${shown}`);
  }
}

console.log(`\n${fail} failed, ${warn} warnings\n`);
process.exit(fail ? 1 : 0);
