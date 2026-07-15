# Workflow Pipelines - Smart Stadium Operations

This document details the functional pipelines, decision flows, and routing workflows of the Smart Stadium platform.

## 📈 Concessions Dynamic Pricing Workflow

The pricing engine runs calculations every time a catalog page is loaded or checked out:

```
[ Catalog Read Request ]
          │
          ▼
[ Calculate Sales Velocity ] ──► (Count sales in 5-minute rolling window)
          │
          ▼
[ Check Scarcity Level ] ────► (Calculate stock remaining percentage)
          │
          ▼
[ Apply Surge Rules ] ───────► (Calculate multiplier: 1.0x to 2.5x max limit)
          │
          ▼
[ Check Cooldown Limits ] ───► (Cooldown constraints prevent sudden price drops)
          │
          ▼
[ Return Surged Price ]
```

---

## 🚨 Incident Routing & Dispatch Pipeline

Crowd density tracking is processed through the risk management engine to allocate field tasks:

```
[ BLE Sensor Telemetry ] ──► (Crowd density spikes above thresholds)
                                      │
                                      ▼
                        [ Evaluate Severity Rating ]
                        ──► High Density: Task Auto-Triggered
                        ──► Critical Density: Incident Logged
                                      │
                                      ▼
                        [ Dispatch Incident Route ]
                        ──► Auto-Assign task to nearest active staff
                        ──► Notify security dashboards via WebSockets
```

---

## 🤖 Stadium AI Copilot Workflow

The chat routing logic for user requests utilizes localized vector search grounding:

```
[ Fan Query Input ]
          │
          ▼
[ Semantic Query Match ] ──► (Query embedded via Sha256 deterministically)
          │
          ▼
[ Qdrant Vector Search ] ──► (Cosine distance check over policies data)
          │
          ├─────────────────────────┐
          ▼ (Score >= 0.7)          ▼ (Score < 0.7)
[ Grounded policy found ]     [ No policy matches threshold ]
          │                         │
          ▼                         ▼
[ Inject policy context ]     [ Local Fallback Search RAG ]
          │                         │
          ├─────────────────────────┘
          ▼
[ Generate Response ] ───────► (Calculate answer + confidence rating)
```
