#!/usr/bin/env python3
# governance-kit 1.1.0 — semgrep gate: fail on ERROR-severity findings, summarise the rest.
import json, os, sys

try:
    with open("semgrep.json", encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:  # noqa: BLE001
    print(f"semgrep.json missing or invalid: {e}")
    sys.exit(1)

results = data.get("results", [])
errors = [r for r in results if r.get("extra", {}).get("severity") == "ERROR"]
warnings = [r for r in results if r.get("extra", {}).get("severity") == "WARNING"]
scan_errors = data.get("errors", [])

md = "### Semgrep (p/default + p/secrets)\n\n"
md += f"Findings: {len(results)} ({len(errors)} ERROR, {len(warnings)} WARNING); scan errors: {len(scan_errors)}\n\n"
for r in errors[:50]:
    md += f"- **{r.get('check_id')}** `{r.get('path')}:{r.get('start', {}).get('line')}` — {r.get('extra', {}).get('message', '')[:160]}\n"
if warnings:
    md += f"\n<details><summary>{len(warnings)} warnings</summary>\n\n"
    for r in warnings[:100]:
        md += f"- {r.get('check_id')} `{r.get('path')}:{r.get('start', {}).get('line')}`\n"
    md += "\n</details>\n"
md += f"\n**Gate:** {len(errors)} ERROR-severity finding(s) → **{'FAIL' if errors else 'PASS'}**\n"

try:
    with open(os.environ.get("GITHUB_STEP_SUMMARY", "semgrep-summary.md"), "a", encoding="utf-8") as f:
        f.write(md)
except Exception:  # noqa: BLE001
    pass
print(md)
sys.exit(1 if errors else 0)
