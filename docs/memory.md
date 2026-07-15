# Project Memory — Smart Stadium & Tournament Operations

## Ground Truth Rule
Every entry below must be verified before being written — run the command, 
read the actual output, then log it. Never log a phase as complete based on 
the implementing agent's self-report alone.

## Environment State
- Last verified: <date/time>
- `git log -1 --oneline`: <actual output>
- `docker-compose up` status: <working / broken, and why>
- Branch: <name>

## Phase Status
| Phase | Status | Verified By | Evidence |
|---|---|---|---|
| 1 - Setup | done | ran `docker-compose up`, hit `/health` | 200 response, commit a1b2c3d |
| 2 - Auth | done | ran integration test suite | 14/14 pass, commit d4e5f6g |
| 3 - Vendor | in-progress | N/A | see Known Issues |
| 4-11 | not started | — | — |

## Known Issues / Unverified Claims
- <anything the previous agent said was done but you haven't personally confirmed>

## Deviations from rules.md / architecture.md
- <any place the actual code differs from the spec docs, and why — 
  spec drift not logged here is spec drift the next agent won't know about>

## Next Action
- Exact next step, phrased as a command or file to open, not a vague "continue Phase 3"