<!-- governance-kit 1.1.0 — AI-assisted change review record. Every section is audit evidence; keep it honest. -->

## What and why
<!-- Ticket / requirement reference and the business purpose -->
- Ticket / request:
- Summary:

## Risk classification
<!-- Low: docs, isolated tests, small refactors · Medium: features, fixes, integrations · High: auth/authz, personal or confidential data, DB schema, infra, CI/CD, dependency upgrades · Critical: production data writes, destructive migrations, security controls, production deploys -->
- Risk: **Low / Medium / High / Critical** — reason:

## Agent provenance
- Tool / model: Claude Code / `<model id>` (or "none — written by hand")
- Agent session id(s): `<from the Agent-Session commit trailer or ~/.claude/governance/sessions>`
- Evidence record (High/Critical): `~/.claude/governance/evidence/<project>/<date>-<slug>.md`

## Verification
| Check | Result |
|---|---|
| Typecheck / lint (Checks workflow) | pass / fail / n/a |
| Tests (unit / integration; negative + authorization tests for High) | pass / fail / not run — why |
| Secret scan (gitleaks) | pass / fail |
| Static analysis (semgrep) | pass / fail |
| Dependency audit (npm audit, production deps) | pass / fail / exception recorded |
| Manual review of the full diff for secrets, injection, missing authz, unintended changes | done by: |

## Exceptions / skipped checks
<!-- none, or: which check, why, risk accepted by (name, role, date), expiry -->
- none

## Release and rollback (High/Critical or anything that deploys)
- Deploys to:
- Rollback plan:

## Reviewer checklist
- [ ] I understand what the code does (access control, data handling, external side effects), not just that scanners passed
- [ ] Scope matches the ticket; no unrelated or unexplained changes
- [ ] No secrets, personal data or production endpoints added
- [ ] New dependencies justified and pinned
