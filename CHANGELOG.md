# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-07-15

### Added
- Created Next.js `fan-app` client dashboards with real-time Concessions menus.
- Integrated `Stadium AI Copilot` utilizing deterministic vector embedding searches (RAG) over local policies.
- Implemented live diagnostic wait times for gates, restroom facilities, and medical support centers.
- Integrated client-side credentials bypass for default demo user credentials when database server is offline.

### Fixed
- Fixed external package module compilation errors during production build checks.
- Addressed cache keys leakage in the test environment to guarantee db reconciliation assertions pass.
- Standardized SVG elements with `aria-hidden` tags and form links for WCAG Accessibility compliance.
- Formulated centralized configurations (`pyproject.toml`) for `black`, `isort`, and `ruff` formatting engines.
