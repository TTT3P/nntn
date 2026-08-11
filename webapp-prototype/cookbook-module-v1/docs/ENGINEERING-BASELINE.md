# Cookbook Engineering Baseline

## Required sources
1. AGENTS.md
2. docs/DESIGN.md
3. the active feature spec and plan
4. this engineering baseline

## Default feature loop
evidence → design/spec → plan → RED → GREEN → browser verification → independent review

## Devbook-derived rules
- One authoritative representation: never duplicate recipe/workstage/print state.
- Configuration is data: expose policy through validated domain edits, not UI-only state.
- Tracer bullet: prove the complete edit → save → reload → Work/Print path.
- DRY and ETC: prefer narrow reusable transformations over repeated conditionals.
- State coverage: test meaningful empty, partial, saved, stale, and printed states.
