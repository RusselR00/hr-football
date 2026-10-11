/* eslint-disable -- generated CommonJS file (Node hook), maintained in agentic-engineering-governance/repo-kit; not application code */
// governance-kit 1.1.0 — portable PreToolUse guard for this repository (generated from
// agentic-engineering-governance/claude-config/hooks/{lib,guard}.js — do not edit here).
// Enforces: no credential-file access, no hard-coded secrets, no force-push / hook bypass / curl|sh,
// human approval for push, merge, deploy, infra, destructive SQL and new dependencies, and a secret
// scan of staged changes before every commit.
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os'); const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');
// Machine-level governance installed? Then it already enforces + logs; step aside so a human is never asked twice.
// (GOVERNANCE_FORCE_PORTABLE is only read by the kit's own test script.)
try { if (!process.env.GOVERNANCE_FORCE_PORTABLE && fs.existsSync(path.join(os.homedir(), '.claude', 'hooks', 'guard.js'))) process.exit(0); } catch {}
// Shared helpers for the governance hooks (guard.js, audit.js, session.js).
// Canonical source: ~/.claude/governance/claude-config/hooks/  (version-controlled)
// Installed copy:   ~/.claude/hooks/  (written by claude-config/install.ps1 — never edit the copy)






const VERSION = '2.1.1';
// GOVERNANCE_DIR is honoured only so the test scripts can write to a temporary folder; Claude Code
// launches hooks with its own environment, which agent shell commands cannot alter.
const GOV_DIR = process.env.GOVERNANCE_DIR || path.join(os.homedir(), '.claude', 'governance');

// High-confidence secret patterns. Kept conservative so normal code is not blocked.
const SECRET_PATTERNS = [
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['AWS secret key', /aws_secret_access_key\s*[=:]\s*["']?[A-Za-z0-9\/+]{40}/i],
  ['Private key', /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_\-]{30,}/],
  ['OpenAI key', /\bsk-(proj-)?[A-Za-z0-9_\-]{32,}/],
  ['Stripe live key', /\b(sk|rk)_live_[A-Za-z0-9]{20,}/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_\-]{35}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['DB URL with password', /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|mssql|amqp):\/\/[^\s:@\/]+:[^\s@\/]{3,}@/i],
  ['Generic secret assignment', /\b(password|passwd|secret|api_?key|access_?token|auth_?token|client_?secret|private_?key)\s*[=:]\s*["'][^"'\s$\{]{12,}["']/i],
];

function findSecrets(text) {
  if (!text) return [];
  const hits = [];
  for (const [name, re] of SECRET_PATTERNS) if (re.test(text)) hits.push(name);
  return hits;
}

function redact(text) {
  if (text === undefined || text === null) return text;
  let out = String(text);
  for (const [, re] of SECRET_PATTERNS) out = out.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), '[REDACTED]');
  return out;
}

// Files an agent must never read or modify. Templates (.env.example etc.) are allowed.
const SECRET_FILE = /(^|[\\\/])(\.env(\.(?!example$|sample$|template$|dist$)[\w.-]+)?|\.envrc|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|[^\\\/]+\.(pem|key|p12|pfx|jks|keystore|ppk)|credentials(\.json)?|\.netrc|\.pgpass|\.npmrc|\.pypirc|secrets?\.(ya?ml|json|toml)|terraform\.tfstate(\.backup)?)$/i;
const SECRET_DIR = /(^|[\\\/])(\.ssh|\.aws|\.gnupg|\.azure|\.kube|\.docker)([\\\/]|$)/i;
// Plain-text credential notes (e.g. in a notes vault). Add more names here if needed.
const SECRET_NOTE = /(^|[\\\/])(creds?|credentials?|passwords?|user[ _-]?id[ _-]?pass(words?)?|logins?)\.(md|txt|docx?|xlsx?|csv)$/i;

function isSecretPath(p) {
  if (!p) return false;
  const norm = String(p).replace(/["']/g, '');
  if (/\.pub$/i.test(norm)) return false; // public keys are fine
  if (/[\\\/]\.claude[\\\/]\.credentials\.json$/i.test(norm)) return true;
  return SECRET_FILE.test(norm) || SECRET_DIR.test(norm) || SECRET_NOTE.test(norm);
}

// Evidence the agent must never alter (tamper-evidence). Reading is fine.
const EVIDENCE_PATH = /[\\\/]\.claude[\\\/]governance[\\\/](audit|sessions)([\\\/]|$)/i;
function isEvidencePath(p) { return !!p && EVIDENCE_PATH.test(String(p).replace(/["']/g, '')); }

// The agent's own controls: installed hooks, settings, managed policy. Deny.
const CONTROL_PATH = /([\\\/]\.claude[\\\/](settings\.json|hooks[\\\/]|CLAUDE\.md$)|[\\\/]ClaudeCode[\\\/]managed-settings(\.json|\.d[\\\/]))/i;
function isControlPath(p) { return !!p && CONTROL_PATH.test(String(p).replace(/["']/g, '')); }
// Canonical sources of the controls: changes need a human (ask).
const CONTROL_SOURCE_PATH = /[\\\/]\.claude[\\\/]governance[\\\/](claude-config|repo-kit)([\\\/]|$)/i;
function isControlSourcePath(p) { return !!p && CONTROL_SOURCE_PATH.test(String(p).replace(/["']/g, '')); }

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

// Append one JSONL line to ~/.claude/governance/<subdir>/YYYY-MM-DD.jsonl
function appendLog(subdir, entry) {
  try {
    for (const k of Object.keys(entry)) if (entry[k] === undefined || entry[k] === null || entry[k] === '') delete entry[k];
    const dir = path.join(GOV_DIR, subdir);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, entry.ts.slice(0, 10) + '.jsonl'), JSON.stringify(entry) + '\n');
  } catch {}
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd: cwd || process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  } catch { return ''; }
}

// Repository identity for a working directory (empty object outside git).
function gitContext(cwd) {
  if (!cwd) return {};
  const top = git(['rev-parse', '--show-toplevel'], cwd);
  if (!top) return {};
  return {
    repo: top,
    remote: git(['remote', 'get-url', 'origin'], cwd) || undefined,
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) || undefined,
    head: git(['rev-parse', '--short', 'HEAD'], cwd) || undefined,
  };
}

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const trunc = (s, n = 2000) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : s);

const L = { VERSION, GOV_DIR, SECRET_PATTERNS, findSecrets, redact, isSecretPath, isEvidencePath, isControlPath, isControlSourcePath, readStdin, appendLog, git, gitContext, sha256, trunc };

L.appendLog = () => {}; // portable: no machine log
// PreToolUse guard: enforces the agent execution controls of the governance framework
// OUTSIDE the model's own instructions. Decisions: deny (hard block) or ask (human approval).
// Every deny/ask decision is itself logged to ~/.claude/governance/audit/ as evidence.
// Canonical source: ~/.claude/governance/claude-config/hooks/guard.js



const input = L.readStdin();
const tool = input.tool_name || '';
const ti = input.tool_input || {};
const cwd = input.cwd || process.cwd();

function decide(decision, reason, extra) {
  L.appendLog('audit', Object.assign({
    ts: new Date().toISOString(), session: input.session_id, cwd: input.cwd, event: 'PreToolUse',
    tool, decision, reason, tool_use_id: input.tool_use_id, permission_mode: input.permission_mode,
  }, extra || {}));
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: `[governance] ${reason}` },
  }));
  process.exit(0);
}

// ---- File tools -------------------------------------------------------------
if (['Read', 'Edit', 'Write', 'NotebookEdit', 'MultiEdit'].includes(tool)) {
  const p = ti.file_path || ti.notebook_path || '';
  const writes = tool !== 'Read';
  if (L.isSecretPath(p)) decide('deny', `Access to credential/secret file blocked: ${p}. Use a secrets manager or a .env.example template instead.`, { file: p });
  if (writes && L.isEvidencePath(p)) decide('deny', `Audit evidence is append-only and written by hooks: ${p}.`, { file: p });
  if (writes && L.isControlPath(p)) decide('deny', `The agent must not modify its own controls (${p}). Ask the user to change claude-config and run install.ps1.`, { file: p });
  if (writes && L.isControlSourcePath(p)) decide('ask', `Changing a governance control source (${p}) needs human approval.`, { file: p });
  const content = [ti.content, ti.new_string, ti.new_source, ...(Array.isArray(ti.edits) ? ti.edits.map(e => e.new_string) : [])].filter(Boolean).join('\n');
  const hits = L.findSecrets(content);
  if (hits.length) decide('deny', `Refusing to write what looks like a hard-coded secret (${hits.join(', ')}). Load it from env/secrets manager instead.`, { file: p });
  process.exit(0);
}

// ---- Shell tools ------------------------------------------------------------
if (tool !== 'Bash' && tool !== 'PowerShell') process.exit(0);
const cmd = String(ti.command || '');
const c = cmd.replace(/\s+/g, ' ');
const WRITE_OP = /(>>?|\brm\b|\bdel\b|\berase\b|\bRemove-Item\b|\bri\b|\bsed\s+-i|\btruncate\b|\btee\b|\bmv\b|\bmove\b|\bSet-Content\b|\bOut-File\b|\bClear-Content\b|\bAdd-Content\b|\bcp\b|\bcopy\b|\bCopy-Item\b|\bgit\s+(rm|checkout|restore|reset|clean|filter-branch|update-ref|reflog expire|gc)\b)/i;

// Hard blocks (Critical — never autonomous)
const DENY = [
  [/\bgit\s+push\b[^|;&]*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)/i, 'Force-push is blocked. Push a new commit or ask the human to do it.'],
  [/--no-verify\b|\bgit\s+commit\b[^|;&]*\s-n\b|core\.hooksPath|hooks\.allow|--no-gpg-sign/i, 'Bypassing git hooks is blocked.'],
  [/\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(\/|~|\$HOME|\/c\/?|[A-Za-z]:[\\\/]?)(\s|$)/i, 'Recursive delete of a root/home directory is blocked.'],
  [/Remove-Item\b[^|;]*-Recurse[^|;]*\s(['"]?[A-Za-z]:\\?['"]?|~|\$HOME|\$env:USERPROFILE)(\s|$)/i, 'Recursive delete of a root/home directory is blocked.'],
  [/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b|\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|]*\|\s*(iex|Invoke-Expression)\b/i, 'Piping a downloaded script into a shell is blocked. Download, review, then run.'],
  // Credential files named as a path token (".env" must not be preceded by a word char, so `process.env` is fine).
  [/\b(cat|type|less|more|head|tail|bat|Get-Content|gc|sed|awk|grep|rg|strings|base64|xxd|od|cp|scp|copy|Copy-Item|code|notepad|start)\b[^|;&]*?((?<![\w-])\.env\b(?!\.(example|sample|template|dist)\b)(\.[\w.-]+)?|(?<![\w-])\.envrc\b|\bid_(rsa|ed25519|ecdsa|dsa)\b(?!\.pub)|\S\.pem\b|\S\.p12\b|\S\.pfx\b|\.aws[\\\/]credentials|\.ssh[\\\/]|\.claude[\\\/]\.credentials\.json|(?<![\w-])\.netrc\b|(?<![\w-])\.pgpass\b|terraform\.tfstate|(?<![\w-])(creds?|credentials?|passwords?|user[ _-]?id[ _-]?pass)\.(md|txt)\b)/i, 'Reading/copying credential files from the shell is blocked.'],
  [/(^|[;&|(]\s*)(printenv|env)\s*($|\||>)|\b(Get-ChildItem|gci|ls|dir)\s+env:|(^|[;&|]\s*)set\s*$/i, 'Dumping the full environment (may expose secrets) is blocked. Echo the specific non-secret variable you need.'],
  [/\b(chmod\s+-R\s+777|icacls\b[^|;]*\/grant\s+Everyone)/i, 'World-writable permission changes are blocked.'],
  [/\b(Set-MpPreference|netsh\s+advfirewall|Set-ExecutionPolicy\s+(Unrestricted|Bypass)\s*(-Scope\s+(LocalMachine|MachinePolicy|UserPolicy))?\s*$|reg\s+(add|delete)\s+HKLM|schtasks\s+\/create)/i, 'Modifying system security settings or persistence is blocked.'],
  [/[\\\/]\.claude[\\\/]governance[\\\/](audit|sessions)\b/i, 'Audit evidence is append-only; the agent must not modify or delete it.', (s) => WRITE_OP.test(s)],
  [/([\\\/]\.claude[\\\/](settings\.json|hooks[\\\/]|CLAUDE\.md)|ClaudeCode[\\\/]managed-settings)/i, 'The agent must not modify its own controls. Ask the user to change claude-config and run install.ps1.', (s) => WRITE_OP.test(s)],
];
for (const [re, why, extraTest] of DENY) if (re.test(c) && (!extraTest || extraTest(c))) decide('deny', why, { command: L.trunc(L.redact(cmd), 500) });

// Secret scan before any agent commit. The commit may target another directory (`cd x && git commit`,
// `git -C x commit`), so every candidate directory named in the command is scanned, not just the session cwd.
function commitDirs(text, fallback) {
  const toWin = (p) => p.replace(/^["']|["']$/g, '').replace(/^\/([a-z])\//i, (m, d) => d.toUpperCase() + ':/');
  const dirs = new Set([fallback]);
  for (const m of text.matchAll(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/gi)) dirs.add(toWin(m[1]));
  for (const m of text.matchAll(/(?:^|[;&|(]\s*)cd\s+("[^"]+"|'[^']+'|\S+)/gi)) dirs.add(toWin(m[1]));
  return [...dirs].filter(d => !/\$|%/.test(d)).map(d => require('path').resolve(fallback, d));
}
if (/\bgit\b[^|;&]*\bcommit\b/i.test(c)) {
  let diff = '';
  for (const dir of commitDirs(cmd, cwd)) {
    try { diff += execSync('git diff --cached -U0 --no-color', { cwd: dir, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}
  }
  const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  const files = diff.split('\n').filter(l => l.startsWith('+++ b/')).map(l => l.slice(6));
  const badFiles = files.filter(L.isSecretPath);
  const hits = L.findSecrets(added);
  if (badFiles.length || hits.length) {
    decide('deny', `Secret scan failed on staged changes — ${[...hits, ...badFiles.map(f => 'secret file: ' + f)].join('; ')}. Unstage/remove, then rotate the credential if it was ever real.`, { command: L.trunc(L.redact(cmd), 500) });
  }
  let hasGitleaks = true;
  try { execSync('gitleaks version', { stdio: 'ignore' }); } catch { hasGitleaks = false; }
  if (hasGitleaks) {
    try { execSync('gitleaks git --staged --no-banner --redact', { cwd, stdio: 'ignore' }); }
    catch (e) { if (e && e.status === 1) decide('deny', 'gitleaks found secrets in staged changes. Run `gitleaks git --staged -v` to see them.', { command: L.trunc(L.redact(cmd), 500) }); }
  }
}

// Human approval required (High/Critical side effects)
const ASK = [
  [/\bgit\s+push\b/i, 'Pushing code leaves this machine.'],
  [/\bgit\s+(merge|rebase)\b[^|;&]*\b(main|master|prod|production|release)\b/i, 'Changing a protected branch.'],
  [/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|branch\s+-D|checkout\s+--\s|restore\s+--source|filter-branch|filter-repo)/i, 'Discards work or rewrites history irreversibly.'],
  [/\bgh\s+(pr\s+merge|release\s+create|repo\s+(delete|edit|create|archive|rename)|secret|variable|api\s+(-X|--method)\s*(POST|PUT|PATCH|DELETE))/i, 'GitHub write action.'],
  [/\b(ssh|scp|sftp|rsync)\b/i, 'Remote host access (possibly production).'],
  [/\baws\s+(?!(\S+\s+)?(describe|list|get)-|s3\s+ls\b|sts\s+get-caller-identity|configure\s+list)/i, 'AWS write/admin action.'],
  [/\b(terraform|tofu|pulumi|cdk)\s+(apply|destroy|deploy|up|import)\b|\bsam\s+deploy\b|\bserverless\s+deploy\b/i, 'Infrastructure change.'],
  [/\b(kubectl|helm)\s+(apply|delete|create|replace|patch|scale|rollout|install|upgrade|uninstall)\b/i, 'Cluster change.'],
  [/\b(docker|podman)\s+(push|login)\b|\b(npm|pnpm|yarn)\s+publish\b|\b(twine|cargo)\s+(upload|publish)\b/i, 'Publishing an artifact.'],
  [/\b(vercel|netlify|fly|railway|heroku|firebase|wrangler|amplify|eb)\b[^|;&]*(\bdeploy\b|--prod\b|\bpublish\b|\bpromote\b)/i, 'Deployment.'],
  [/\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\w+\s*(;|$|"|'))/i, 'Destructive SQL.'],
  [/\b(prisma\s+migrate\s+(deploy|reset)|drizzle-kit\s+(push|drop)|npm\s+run\s+db:(push|migrate|seed)|alembic\s+downgrade|rails\s+db:(drop|reset)|knex\s+migrate:rollback|flyway\s+(clean|migrate))\b/i, 'Database schema/data change — confirm it targets a development database.'],
  [/\b(psql|mysql|mongosh|sqlcmd|redis-cli)\b(?![^|;&]*\b(localhost|127\.0\.0\.1|::1)\b)[^|;&]*\s(-h|--host|-S)\s/i, 'Connecting to a non-local database.'],
  [/\b(pip|pip3|uv\s+pip|uv|npm|pnpm|yarn|bun|gem|cargo|go)\s+(install|add|i)\s+(?!(?:[^|;&]*\s)?(-r|-e|--requirement|--editable)\s)(-{1,2}[\w-]+\s+)*[@\w][\w@.\/:^~=<>-]*/i, 'Adding a new dependency — verify publisher and pin the version.'],
  [/\b(winget|choco|scoop)\s+install\b|\bnpx\s+(-y|--yes)\b/i, 'Installing/executing third-party software.'],
  [/[\\\/]\.claude[\\\/]governance[\\\/](claude-config|repo-kit)\b/i, 'Changing a governance control source needs human approval.', (s) => WRITE_OP.test(s)],
];
for (const [re, why, extraTest] of ASK) if (re.test(c) && (!extraTest || extraTest(c))) decide('ask', why, { command: L.trunc(L.redact(cmd), 500) });

process.exit(0);

