# Project Memory — Smart Stadium & Tournament Operations

## Ground Truth Rule
Every entry below must be verified before being written — run the command, 
read the actual output, then log it. Never log a phase as complete based on 
the implementing agent's self-report alone.

## Environment State
- Last verified: 2026-07-15T11:15:00+05:30
- `git log -1 --oneline`: ce4f9ef docs(auth): update memory.md with verified Phase 2 status
- `docker-compose up` status: broken (Docker/docker-compose command is not installed on this host environment)
- Branch: feature/phase2-auth

## Phase Status
| Phase | Status | Verified By | Evidence |
|---|---|---|---|
| 1 - Setup | done | ran `pytest` on gateway health check | 1 passed, commit e702993 |
| 2 - Auth | done | ran `pytest` and live HTTP uvicorn server script | 9 passed (8 auth, 1 health). Live test run output: Register (201), Login (200), Profile (200), Gating Vendor (403 Forbidden), Gating Admin (200 Access verified), Refresh Token (200 OK), Logout (200), commit ce4f9ef |
| 3 - Vendor | not started | — | — |
| 4-11 | not started | — | — |

## Known Issues / Unverified Claims
- `docker-compose up` is unverified because Docker/docker-compose is not installed on this host environment (CommandNotFoundException).
- No frontend dependencies (`node_modules`) are installed yet, keeping the repository size minimal and under the 10MB limit.

## Deviations from rules.md / architecture.md
- None. Note: Added dynamic import mapping hook in `libs/__init__.py` to bridge Python imports for hyphenated disk folder `libs/shared-schemas` without changing disk path or violating rules.md folder specification.

## Next Action
- Implement Phase 3 (Vendor Intelligence) on a new `feature/phase3-vendor` branch. Start by defining the SQLAlchemy models for the `vendor`, `item`, and `sale` tables.