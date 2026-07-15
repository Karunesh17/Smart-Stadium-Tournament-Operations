# System Architecture - AI-Smart Stadium Operations

The Smart Stadium Platform is built as a modular monorepo that integrates multi-tier microservices with role-specific Next.js frontend applications, utilizing a FastAPI gateway, Redis cache layer, and Qdrant local Vector database.

```
+-----------------------------------------------------------------------------------+
|                              Next.js Frontend Apps                                |
|   /fan-app        /vendor-app        /staff-app    /security-dashboard            |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         FastAPI HTTP & WebSockets Gateway                         |
|   /api/v1/auth    /api/v1/vendors    /api/v1/items    /api/v1/crowd               |
|   /api/v1/staff   /api/v1/incidents  /api/v1/pricing  /api/v1/chat    /analytics  |
+-----------------------------------------------------------------------------------+
       |                   |                   |                     |
       v                   v                   v                     v
+--------------+    +--------------+    +--------------+      +---------------------+
| SQLite/Post  |    | Redis PubSub |    | Redis Cache  |      | Qdrant Client Vector|
| SQL Database |    | WebSocket Hub|    | Layer (KPIs) |      | Local memory db     |
+--------------+    +--------------+    +--------------+      +---------------------+
```

## 🏗️ Architectural Layers

### 1. Unified Gateway API Router
All REST and WebSocket requests pass through a central FastAPI Gateway app (`services/gateway/main.py`), which:
- Mounts individual subservice routers dynamically.
- Enforces HTTP middleware (performance tracking and structured log formatting).
- Resolves Role-Based Access Control (RBAC) via dependency injection token filters.

### 2. Caching & Message Brokering
- **Redis Cache:** Aggregated event statistics and concessions catalog items are cached to reduce SQLite/Postgres database transaction load.
- **Redis Pub/Sub:** Domain events (such as crowd spikes and auto-tasks) are published to a Redis channel and broadcasted instantly to client devices via WebSockets.

### 3. Database Layer
- Enforces transactions to prevent race conditions during heavy concession purchases.
- Maintains strict foreign key relations between concessions `Item` and transaction `Sale` tables.

### 4. Grounded AI Copilot Vector Space
- Local `Qdrant` in-memory database seeds policy configurations on startup.
- Matches fan queries utilizing cosine similarity calculations.
