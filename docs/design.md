# Design — AI Smart Stadium Operations Platform

**[Guessing] disclosure:** the research source contains no UI/UX direction whatsoever — no colors, components, or layout guidance. Everything in this document is a reasonable design-system proposal consistent with the four role-based dashboards named in `architecture.md`, not something extracted from source material. Treat specific hex values and spacing numbers as a starting proposal for the design team to ratify, not a locked spec.

## Design Philosophy

An operations platform used during live events must prioritize legibility under time pressure over decoration. The design leans into a dark-first, high-contrast interface — appropriate for both a dim stadium concourse and a security control room — with color reserved almost entirely for status signaling (stock levels, crowd density, incident severity) rather than branding flourish.

## Design Principles

1. **Status before style** — color communicates state (normal/warning/critical) consistently across every dashboard.
2. **One glance, one decision** — every dashboard's primary view should let its role answer "do I need to act right now?" without scrolling.
3. **Real-time is visible, not just present** — live-updating data (crowd counts, stock, tasks) is always paired with a subtle "last updated" or live-pulse indicator so users trust the freshness of what they see.
4. **Consistent chrome, role-specific content** — navigation, spacing, and components are shared (`/libs/shared-ui` per `rules.md`); only the content differs per role.
5. **Accessible by default** — sufficient contrast and non-color-only status signaling (icons/text alongside color) for colorblind users in a security-critical context.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#0B0E14` | App background (dark theme default) |
| `--bg-surface` | `#151922` | Card/panel surfaces |
| `--bg-elevated` | `#1E2430` | Modals, dropdowns |
| `--border-subtle` | `#2A3140` | Card borders, dividers |
| `--text-primary` | `#F2F4F8` | Primary text |
| `--text-secondary` | `#8B93A7` | Secondary/meta text |
| `--accent-primary` | `#4C8DFF` | Primary actions, links, active nav |
| `--status-ok` | `#2ECC71` | Normal stock, low crowd density, done tasks |
| `--status-warning` | `#F5A623` | Low stock, moderate density, in-progress tasks |
| `--status-critical` | `#E5484D` | Stockout, high density, high/critical incidents |
| `--ai-accent` | `#9B6DFF` | AI Copilot surfaces, distinguishing AI content from system data |

## Typography

- **Typeface**: Inter (or system UI font stack fallback) for all UI text — chosen for high legibility at small sizes on dashboard-dense screens.
- **Monospace**: JetBrains Mono for IDs, timestamps, and raw counts where alignment matters.
- **Scale**: `12 / 14 / 16 / 20 / 24 / 32` px, mapped to `caption / body-sm / body / h3 / h2 / h1`.
- **Weight**: 400 for body text, 600 for headings and status labels, 700 reserved for critical alerts only.

## Spacing System

4px base unit: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`. Cards use 16px internal padding; dashboard grid gutters use 24px; section breaks use 48px.

## Grid

12-column responsive grid. Desktop dashboards use a 3-panel layout (nav rail, main content, contextual sidebar); tablet collapses to 2 panels; mobile collapses to a single scrollable column with a bottom tab bar (see Mobile Layout).

## Components

### Buttons
Primary (`--accent-primary` fill), Secondary (outline, `--border-subtle`), Destructive (`--status-critical` fill, used for e.g. "cancel shift" or "delete item"). All buttons: 8px corner radius, 40px height for primary actions, 32px for compact/inline actions.

### Cards
`--bg-surface` background, `--border-subtle` 1px border, 12px corner radius, 16px padding. A card's top-right corner may host a status dot (ok/warning/critical) when the card represents a monitorable entity (item stock, area density, incident).

### Forms
Labels above inputs (never placeholder-as-label). Inputs: `--bg-elevated` background, `--border-subtle` border, `--accent-primary` border on focus. Inline validation errors appear below the field in `--status-critical` text, never as a modal interrupt for simple validation.

### Tables
Zebra-free (rely on `--border-subtle` row dividers, not alternating background, to reduce visual noise). Sticky header row. Sortable columns indicated with a subtle chevron. Row-level status indicated via a leading color bar, not full-row tinting.

### Charts
Line charts for time-series (crowd density over time, sales velocity), bar charts for comparative data (revenue per vendor), and a single donut chart reserved for task-status breakdown. Chart colors always map to the status palette where the data represents a status (never arbitrary rainbow palettes).

### Sidebar
Icon + label navigation, collapsible to icon-only on smaller viewports. Active item indicated by `--accent-primary` left border + tinted background, not just icon color change (accessibility principle).

### Navigation
Top bar: venue/event name, role badge, notification bell (real-time alert count), AI Copilot quick-access icon (`--ai-accent`). Persistent across all four dashboards for consistency.

### Dashboard Layout
Nav rail (left, 240px) → Main content (fluid) → Contextual panel (right, 320px, collapsible) — used for AI Copilot chat, incident detail, or task detail without navigating away from the main view.

## Role Based UI

### Vendor Dashboard
Primary view: item grid with stock level and status dot per item, a "record sale" quick-action per item, and a price-change indicator (arrow + delta) when Pricing Service updates a price. Secondary panel: recent sales feed and AI Copilot restock suggestions.

### Admin Dashboard
Primary view: cross-module KPI summary cards (active incidents, current crowd status by zone, vendor stockout count, open staff tasks). Drill-down links into each domain's own dashboard.

### Staff Dashboard
Primary view: "my shift" card (start/end time, location) and "my tasks" list, sorted open → in-progress → done, with a single-tap status-advance control. No cross-staff visibility by default (privacy/simplicity).

### Security Dashboard
Primary view: venue map with per-area heatmap overlay (color-mapped to the status palette) and a live incident feed. Selecting an area or incident opens the contextual right panel with detail and escalation controls.

### Analytics Dashboard
Primary view: time-range selector at top, followed by four chart clusters — Sales Trends, Crowd Trends, Staff Utilization, Incident Frequency — each a card containing one primary chart and a small KPI delta vs. the prior period.

## User Flows

**Vendor records a sale:** Vendor Dashboard → tap item card → quantity stepper → confirm → stock updates in place, status dot recolors if crossing a threshold, price indicator updates if Pricing Service recalculates.

**Security responds to an incident:** Security Dashboard → incident feed shows new entry with severity badge → tap to open detail panel → view auto-assigned staff task (if escalated) or manually assign → mark acknowledged.

**Staff completes a task:** Staff Dashboard → task list → tap task → status advances open → in-progress → done, each transition confirmed with a lightweight toast, not a blocking dialog.

**Any role queries the AI Copilot:** tap AI icon in top bar → contextual right panel opens with chat → response streams in with source attribution chips beneath grounded claims.

## Wireframes (ASCII)

### Vendor Dashboard (Desktop)
```
+------------------------------------------------------------+
| [Logo]  Vendor: Priya's Merch     🔔3      [AI Copilot 🤖] |
+---------+----------------------------------------+---------+
| Nav     |  Items                                 | Recent  |
| - Items |  +--------+ +--------+ +--------+       | Sales   |
| - Sales |  | Shirt  | | Cap    | | Poster |       | ------- |
| - AI    |  | ●OK    | | ●WARN  | | ●CRIT  |       | Shirt x2|
|         |  | 42 left| | 8 left | | 0 left |       | Cap  x1 |
|         |  | [Sell] | | [Sell] | | [Sell] |       | ...     |
+---------+----------------------------------------+---------+
```

### Security Dashboard (Desktop)
```
+------------------------------------------------------------+
| [Logo]  Security: Gate 3 Team     🔔5      [AI Copilot 🤖] |
+---------+----------------------------------------+---------+
| Nav     |  Venue Heatmap                         | Incident|
| - Map   |   [Zone A ●OK] [Zone B ●WARN]           | Feed    |
| - Feed  |   [Zone C ●CRIT] [Zone D ●OK]           | ------- |
| - AI    |                                         | Medical |
|         |                                         | Zone C  |
|         |                                         | HIGH    |
+---------+----------------------------------------+---------+
```

## Mobile Layout

Single-column, bottom tab bar (Home / Tasks-or-Items / Alerts / AI). Contextual panel becomes a full-screen modal sheet rather than a side panel. Status dots and delta indicators remain identical to desktop for consistency of meaning.

## Desktop Layout

Three-panel layout described in Dashboard Layout above, minimum supported viewport width 1280px, fluid up to ultra-wide with a max-content-width cap (1600px) to avoid excessive line lengths on charts and tables.

## Accessibility

- Minimum contrast ratio 4.5:1 for body text against its background at all times.
- Status is never color-only: every status dot pairs with a text label or icon (per Design Principles).
- All interactive elements reachable and operable via keyboard; focus states use a visible `--accent-primary` outline.
- Real-time-updating regions use `aria-live="polite"` so screen readers announce changes without interrupting the current task.

## Dark Theme

Dark is the default and primary theme (per Design Philosophy — control-room and concourse legibility). A light theme is not specified in scope; if added later, it should invert surfaces while keeping the status palette (`ok/warning/critical`) identical for muscle-memory consistency.

## Responsive Rules

- Breakpoints: `mobile <640px`, `tablet 640–1024px`, `desktop >1024px`.
- Nav rail collapses to icon-only at tablet, to a bottom tab bar at mobile.
- Contextual right panel becomes an on-demand modal below desktop width.
- Tables degrade to stacked card lists below tablet width rather than horizontal scroll, to avoid hidden columns during time-sensitive use.

## Animations

Minimal and functional only: 150ms ease-out for hover/focus states, 200ms for panel open/close, a subtle pulse animation on live-updating status dots (crowd density, stock) to reinforce real-time freshness without being distracting. No decorative page-transition animation — this is an operational tool, not a marketing site.

## Design Tokens

Tokens are defined once in `/libs/shared-ui/tokens.ts` (color, spacing, typography scale, radius, shadow) and consumed by all four apps via Tailwind CSS theme extension, per `rules.md` Frontend Rules — no per-app token duplication.

## Icons

A single consistent icon set (e.g., Lucide) used across all dashboards. Status severity always paired with a distinct icon shape in addition to color (circle = ok, triangle = warning, octagon = critical) for accessibility.

## Empty States

- **Vendor, no items yet**: illustration-free, text-first prompt — "No items yet — add your first item to start tracking sales."
- **Staff, no tasks**: "You're all caught up. New tasks will appear here in real time."
- **Security, no active incidents**: "No active incidents. Crowd levels are within normal range." (paired with the current overall status, not a blank screen).

## Loading States

Skeleton placeholders (not spinners) for card grids and tables, matching the shape of the eventual content, to reduce layout shift. The AI Copilot uses a distinct "thinking" indicator (per `rules.md` Performance Rules budget) rather than a generic spinner, to set expectation that generation is in progress.

## Error States

Inline, non-blocking error banners at the top of the affected panel (not a full-screen error page) for recoverable errors (failed fetch, WebSocket disconnect with auto-retry indicator). Full-screen error states reserved for unauthenticated/unauthorized access only.

## Cross-References
- Component/service data these screens display: see `architecture.md`.
- Feature scope these flows implement: see `prd.md`.
- Shared component/token rules: see `rules.md`.
- Delivery order of these UI surfaces: see `phases.md`.
