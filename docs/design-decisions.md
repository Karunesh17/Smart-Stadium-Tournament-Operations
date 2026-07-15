# Design Decisions - Smart Stadium Platform

This document logs critical technical design decisions, trade-offs, and design patterns.

---

## 🏎️ Next.js Webpack Modules Resolution
- **Decision:** Push `node_modules` paths directly to Webpack `resolve.modules` list inside Next config.
- **Rationale:** Standard module systems (such as modularize-imports) throw resolution warnings when parsing nested monorepo packages (e.g. `libs/shared-ui`). Modifying Webpack's resolution directories guarantees clean absolute path mapping without triggering loader lint errors.

---

## 🔒 Session-Based JWT Security
- **Decision:** Authenticate via JWT tokens embedded in HTTP-only, Secure, SameSite cookies.
- **Rationale:** Passing auth tokens in local storage exposes client applications to Cross-Site Scripting (XSS). Securing tokens behind HTTP-only cookies keeps keys hidden from JavaScript runtimes, blocking XSS exploit vectors.

---

## 🔄 SQLite Concurrent Transactions
- **Decision:** Wrap concessions purchase checkout queries inside strict SQLite engine transactions (`db.begin()` / `db.commit()`).
- **Rationale:** High-occupancy stadium environments trigger thousands of checkout requests concurrently. Unchecked database updates allow stock values to drop below zero (double-booking). Forcing transaction isolation rolls back failed operations cleanly.

---

## 🔌 Simulated Fallbacks (Render Sleeps)
- **Decision:** Embed simulated dictionary caching inside the Redis Client, and static user fallbacks in Login logic.
- **Rationale:** Public platforms (such as Render) purge state databases and Redis caches during service sleep periods. Adding memory fallbacks guarantees the application remains fully functional even when backing infrastructure restarts.
