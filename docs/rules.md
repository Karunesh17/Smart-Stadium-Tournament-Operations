# Rules — AI Smart Stadium Operations Platform

These rules are binding for all contributors and all AI coding sessions. No placeholder code, no TODOs left in merged code, no fabricated data.

## Coding Standards

- **Python (backend)**: PEP 8, enforced via `ruff` + `black`. Type hints required on all function signatures. Pydantic models for every request/response body — no raw dicts across service boundaries.
- **TypeScript (frontend)**: strict mode enabled (`"strict": true`). No `any` without an inline justification comment. ESLint + Prettier enforced pre-commit.
- Every function has a single responsibility; if a service function exceeds ~40 lines, extract helpers.
- No magic numbers/strings — extract to named constants (e.g., severity thresholds, JWT TTLs).

## Folder Structure

```
/smart-stadium
  /apps
    /fan-app          (Next.js)
    /staff-app        (Next.js)
    /vendor-app       (Next.js)
    /security-dashboard (Next.js)
  /services
    /gateway
    /auth
    /vendor
    /inventory
    /pricing
    /staff
    /crowd
    /risk
    /notification
    /ai
    /analytics
  /libs
    /shared-schemas   (Pydantic models shared across services)
    /shared-ui        (shared React components/design tokens)
  /infra
    docker-compose.yml
    /migrations
  /docs
    architecture.md
    phases.md
    prd.md
    rules.md
    design.md
    memory.md
```

## Naming Conventions

- **Database tables**: `snake_case`, singular (`user`, `vendor`, `item`) — matches ER diagram in `architecture.md`.
- **API routes**: `kebab-case` plural resource nouns (`/api/v1/staff-tasks` unless already established as `/api/v1/staff/tasks` per `architecture.md` — existing contract takes precedence over convention).
- **React components**: `PascalCase` (`VendorDashboard.tsx`).
- **Python modules/functions**: `snake_case`. Classes: `PascalCase`.
- **Redis channels**: `domain.event` (`stock.updated`, `price.updated`, `incident.created`).
- **Environment variables**: `SCREAMING_SNAKE_CASE`, prefixed by service (`AUTH_JWT_SECRET`, `AI_GEMINI_API_KEY`).

## Git Workflow

- `main` is always deployable. No direct commits to `main`.
- All work happens on feature branches, merged via pull request with at least one review.
- CI (lint + test) must pass before merge.

## Branch Strategy

- `main` — production-deployable.
- `develop` — integration branch for the current phase.
- `feature/<phase>-<short-description>` (e.g., `feature/phase3-vendor-sales-endpoint`).
- `hotfix/<description>` branched directly from `main` for production incidents.

## Commit Convention

Conventional Commits format: `<type>(<scope>): <description>`.
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
Example: `feat(pricing): add demand-velocity recalculation on stock.updated`.

## API Standards

- All endpoints versioned under `/api/v1/`.
- Request/response bodies validated via Pydantic on the backend and a matching TypeScript type on the frontend (generated from the OpenAPI schema where possible, not hand-duplicated).
- Consistent error shape: `{ "detail": string, "code": string }`.
- Idempotent GET/PUT; POST reserved for creation and non-idempotent actions.
- Pagination required on any list endpoint that can exceed 50 rows.

## Error Handling

- No bare `except:` in Python — catch specific exceptions.
- All service-layer exceptions map to a typed `HTTPException` at the router boundary; internal exceptions never leak stack traces to the client.
- Frontend: every API call wrapped in try/catch with a user-visible, non-technical error state (see `design.md` Error States).

## Logging

- Structured JSON logging in all backend services (`timestamp`, `service`, `level`, `message`, `context`).
- No PII or raw sensor data ever logged (consistent with `architecture.md` Security & Compliance).
- AI Service logs every query, retrieved document IDs, and response for evaluation — never the raw Gemini API key or user credentials.

## Testing

- Minimum 80% coverage on business-logic modules (pricing heuristic, severity scoring, stock-decrement transaction).
- Every cross-service flow in `architecture.md` Sequence Diagrams has a corresponding integration test.
- Load test required for concurrent-sale and concurrent-crowd-ingestion paths before Phase 11 (per `phases.md` Phase 10).

## Security Rules

- RBAC enforced server-side only; client-side role checks are UX convenience, never the security boundary.
- JWTs: 15-minute access token, 7-day rotating refresh token, httpOnly + Secure + SameSite=Strict cookies.
- All secrets in environment variables or a secrets manager — never committed to the repo.
- Rate limiting applied per-role at the Gateway, with stricter limits on `/sales`, `/incidents`, and `/chat`.

## Database Rules

- Every schema change is a versioned migration — no manual production schema edits.
- Foreign keys always explicit; cascade behavior documented in the migration (per `architecture.md` Constraints).
- Stock-decrement and sale-insert happen in a single transaction — never as two separate writes.
- No raw crowd sensor identifiers persisted, ever (privacy constraint, non-negotiable).

## Frontend Rules

- Shared design tokens and components live in `/libs/shared-ui` — no per-app duplication of buttons/cards/forms.
- Every role-specific dashboard consumes the same underlying API contracts; no dashboard bypasses the Gateway.
- Real-time updates via the shared WebSocket client in `/libs/shared-ui`, not ad hoc per-app socket handling.

## Backend Rules

- Each service owns its own database tables; cross-service reads happen through that service's API, not direct cross-schema SQL (Analytics Service is the documented exception, per `architecture.md`, and must be reviewed if it grows write access).
- No service calls Gemini directly except the AI Service.
- All inter-service async communication goes through Redis pub/sub channels defined in Naming Conventions above.

## AI Rules

- The AI Service is the only component permitted to call the Gemini API.
- Every AI Copilot response that makes a factual claim about vendor/stadium data must be backed by a retrieved document — no ungrounded factual claims about stadium-specific data.
- Conversation memory (Redis short-term, Postgres long-term) never stores more than what's needed for the current session's continuity — no indefinite raw transcript retention without an explicit retention policy.

## Prompt Engineering Rules

- System prompts are versioned in code (not edited ad hoc in production) so behavior changes are reviewable.
- Prompts must explicitly instruct the model to prefer retrieved context over prior knowledge for stadium-specific facts.
- No prompt may instruct the model to fabricate data if retrieval returns nothing — the correct behavior is to say the information isn't available.

## RAG Rules

- Every ingested document is chunked with source metadata (`source`, `section`, `updated_at`) — never embedded anonymously.
- Vector collections are partitioned by document type (per `architecture.md` AI Architecture) — cross-collection queries must be an explicit, deliberate choice, not a default.
- Stale documents (superseded SOPs, old pricing policy) must be removed or flagged, not left silently competing with current documents in retrieval.

## Documentation Rules

- `architecture.md`, `rules.md`, `design.md` are updated in the same PR as any change that contradicts them.
- `memory.md` is updated only with stable, durable facts — never sprint-status or TODOs (per `memory.md` own constraints).
- Every new service or table gets an entry in the relevant `architecture.md` section before merge.

## Performance Rules

- Real-time events (stock, price, crowd, incident, task) must propagate within single-digit seconds end-to-end (non-functional requirement, `prd.md`).
- Expensive cross-table analytics queries must be reviewed for indexing/materialized-view needs before shipping (see `phases.md` Phase 9 risk).
- AI Copilot latency budget: retrieval + generation should stream a first token within ~2 seconds under normal load; anything slower requires a visible "thinking" state.

## Review Checklist

- [ ] Types/schemas defined for all new request/response bodies.
- [ ] RBAC applied server-side on new/changed routes.
- [ ] Migration included for any schema change, with indexes/constraints per `architecture.md`.
- [ ] No secrets, PII, or raw sensor data in logs or commits.
- [ ] Tests added/updated for new business logic.
- [ ] Relevant docs (`architecture.md`, `design.md`) updated if behavior changed.
- [ ] No placeholder code, TODOs, or fake data left in the diff.

## Definition of Done

A feature is done when: it matches its phase's acceptance criteria in `phases.md`, passes CI (lint, type-check, tests), has been reviewed and approved, has updated documentation where applicable, and has no known regressions in the sequence-diagram flows it touches.

## Coding Best Practices

- Prefer composition over inheritance in both Python and TypeScript.
- Keep business logic out of route handlers — handlers validate input, call a service function, and shape the response.
- Avoid premature abstraction; only extract a shared library once a pattern repeats across two or more services.

## Architecture Rules

- No new service is added outside the eleven defined in `architecture.md` Microservices without an update to that document first.
- Any new cross-service dependency must be reflected in the `architecture.md` Service Diagram in the same PR.
- Redis pub/sub is the only sanctioned async communication mechanism for MVP — introducing Kafka or another broker requires an explicit architecture-document revision and rationale.

## Absolutely No Placeholder Code

Every function merged to `develop` or `main` must be fully implemented against its acceptance criteria. Stub functions, `pass`-only bodies, `// TODO: implement`, and mocked-but-unwired UI states are not acceptable in merged code — they belong only in an explicitly labeled draft PR.

## Cross-References
- Services and boundaries these rules govern: see `architecture.md`.
- Phase-by-phase application of Definition of Done: see `phases.md`.
- Design-token and component rules referenced above: see `design.md`.
