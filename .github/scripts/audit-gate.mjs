#!/usr/bin/env node
// governance-kit 1.1.0 — npm audit gate (ES module, so the repository's own ESLint rules apply cleanly).
// Reads npm-audit.json (npm audit --omit=dev --json) and fails when a HIGH/CRITICAL vulnerability in a
// production dependency is not covered by a non-expired, approved exception in .security-exceptions.json:
//   { "dependencies": [ { "package": "next", "advisory": "GHSA-xxxx", "reason": "...", "approved_by": "Name, role", "expires": "2026-12-31" } ] }
// A written, time-boxed, named risk acceptance is the only way past this gate (framework §5/§6).
import fs from 'node:fs';

let audit = {};
try { audit = JSON.parse(fs.readFileSync('npm-audit.json', 'utf8')); } catch (e) { console.error('npm-audit.json missing or invalid:', e.message); process.exit(1); }
let exceptions = { dependencies: [] };
try { exceptions = JSON.parse(fs.readFileSync('.security-exceptions.json', 'utf8')); } catch { /* no exceptions file */ }

const today = new Date().toISOString().slice(0, 10);
const accepted = new Map();
for (const e of exceptions.dependencies || []) {
  const valid = e.package && e.reason && e.approved_by && e.expires && e.expires >= today;
  if (valid) accepted.set(e.package, e);
}

// npm 7+ format: { vulnerabilities: { name: {...} } }. pnpm audit (npm 6 format): { advisories: { id: {...} } }.
let rows;
if (audit.advisories && !audit.vulnerabilities) {
  const byPkg = new Map();
  for (const a of Object.values(audit.advisories)) {
    const cur = byPkg.get(a.module_name);
    const sev = a.severity;
    const order0 = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
    if (!cur || (order0[sev] ?? 9) < (order0[cur.severity] ?? 9)) byPkg.set(a.module_name, { name: a.module_name, severity: sev, fix: a.patched_versions && a.patched_versions !== '<0.0.0' ? 'yes' : 'no', via: a.url || a.title || '', exception: accepted.get(a.module_name) });
  }
  rows = [...byPkg.values()];
} else {
  const vulns = Object.values(audit.vulnerabilities || {});
  rows = vulns.map(v => ({
    name: v.name,
    severity: v.severity,
    fix: v.fixAvailable ? 'yes' : 'no',
    via: (v.via || []).map(x => (typeof x === 'string' ? x : (x.url || x.title || ''))).filter(Boolean).slice(0, 2).join('; '),
    exception: accepted.get(v.name),
  }));
}
const vulns = rows;
const order = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
rows.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9) || a.name.localeCompare(b.name));
const gate = rows.filter(r => (r.severity === 'critical' || r.severity === 'high') && !r.exception);

const count = (sev) => rows.filter(r => r.severity === sev).length;
let md = '### npm audit — production dependencies\n\n';
md += `Total: ${vulns.length} (critical ${count('critical')}, high ${count('high')}, moderate ${count('moderate')}, low ${count('low')})\n\n`;
if (rows.length) {
  md += '| Package | Severity | Fix available | Advisory | Exception |\n|---|---|---|---|---|\n';
  for (const r of rows) md += `| ${r.name} | ${r.severity} | ${r.fix} | ${r.via} | ${r.exception ? `accepted by ${r.exception.approved_by} until ${r.exception.expires}` : ''} |\n`;
}
md += `\n**Gate:** ${gate.length} unaccepted high/critical production vulnerabilit${gate.length === 1 ? 'y' : 'ies'} → **${gate.length ? 'FAIL' : 'PASS'}**\n`;
if (gate.length) md += '\nFix with `npm audit fix` / an upgrade, or record a time-boxed risk acceptance in `.security-exceptions.json` (needs `reason`, `approved_by`, `expires`).\n';

try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY || 'audit-summary.md', md); } catch { /* summary unavailable locally */ }
console.log(md);
process.exit(gate.length ? 1 : 0);
