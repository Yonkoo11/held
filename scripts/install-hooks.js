// Installs a pre-commit guard so a secret cannot become a commit even by accident.
// Run once per clone:  node scripts/install-hooks.js
//
// .gitignore stops the file you expect. This stops the one you don't — a key pasted into a README,
// a debug script, a fixture. Ignoring is a default; this is a refusal.
import fs from 'node:fs';
import path from 'node:path';

const HOOK = `#!/bin/sh
# OutcomeLock pre-commit secret guard. Installed by scripts/install-hooks.js.
# Bypass only if you are certain:  git commit --no-verify

fail=0

# 1. Never commit an environment file, whatever it is called.
names=$(git diff --cached --name-only --diff-filter=ACM | grep -E '(^|/)\\.env($|\\.)' || true)
if [ -n "$names" ]; then
  echo "BLOCKED: refusing to commit an environment file:"
  echo "$names" | sed 's/^/    /'
  echo "  -> it belongs in .gitignore, not in history."
  fail=1
fi

# 2. Never commit anything secret-shaped, in any file.
#    Matches the staged content only, and prints file and line but never the value.
hits=$(git diff --cached --no-color -U0 --diff-filter=ACM | grep -nE \\
  '302e020100300506032b657004220420[0-9a-fA-F]{64}|sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY' \\
  | cut -d: -f1 | head -5 || true)
if [ -n "$hits" ]; then
  echo "BLOCKED: staged changes contain something shaped like a private key or API key."
  echo "  -> the value is not printed here on purpose. Find it with:"
  echo "     git diff --cached"
  echo "  -> if it is real, treat it as compromised and rotate it."
  fail=1
fi

# 3. Never commit the buyer's claim tokens.
if git diff --cached --name-only --diff-filter=ACM | grep -qE 'buyer-tokens\\.json|escrow-ledger\\.json'; then
  echo "BLOCKED: refusing to commit runtime data that holds claim tokens or ledger state."
  fail=1
fi

[ "$fail" -eq 0 ] || exit 1
exit 0
`;

const dir = path.join(process.cwd(), '.git', 'hooks');
if (!fs.existsSync(dir)) {
  console.error('No .git/hooks here — is this a git repository?');
  process.exit(1);
}
const target = path.join(dir, 'pre-commit');
if (fs.existsSync(target)) {
  const existing = fs.readFileSync(target, 'utf8');
  if (!existing.includes('OutcomeLock pre-commit secret guard')) {
    fs.copyFileSync(target, `${target}.backup`);
    console.log(`Existing pre-commit hook backed up to ${target}.backup`);
  }
}
fs.writeFileSync(target, HOOK, { mode: 0o755 });
console.log('Installed pre-commit secret guard at .git/hooks/pre-commit');
console.log('Verify the whole setup with: npm run check:secrets');
