# Project Memory — Smart Stadium & Tournament Operations

## Ground Truth Rule
Every entry below must be verified before being written — run the command, 
read the actual output, then log it. Never log a phase as complete based on 
the implementing agent's self-report alone.

## Environment State
- Last verified: 2026-07-15T11:10:00+05:30
- `git log -1 --oneline`: 469549b feat(auth): implement user registration, login, refresh tokens, rbac gates and login pages
- `docker-compose up` status: broken (Docker/docker-compose command is not installed on this host: "docker : The term 'docker' is not recognized as the name of a cmdlet...")
- Branch: feature/phase2-auth

## Phase Status
| Phase | Status | Verified By | Evidence |
|---|---|---|---|
| 1 - Setup | done | ran `pytest` on gateway health check | 1 passed, commit e702993 |
| 2 - Auth | done | ran `pytest` integration test suite | 8 passed, commit 469549b |
| 3 - Vendor | not started | — | — |
| 4-11 | not started | — | — |

## Known Issues / Unverified Claims
- `docker-compose up` is unverified because Docker/docker-compose is not installed on this host environment (CommandNotFoundException).
- No frontend dependencies (`node_modules`) are installed yet, keeping the repository size minimal and under the 10MB limit.

## Deviations from rules.md / architecture.md
- None. Note: Added dynamic import mapping hook in `libs/__init__.py` to bridge Python imports for hyphenated disk folder `libs/shared-schemas` without changing disk path or violating rules.md folder specification.

## Next Action
- Implement Phase 3 (Vendor Intelligence) on a new `feature/phase3-vendor` branch. Start by defining the SQLAlchemy models for the `vendor`, `item`, and `sale` tables.