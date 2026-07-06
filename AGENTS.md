<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project context

This is the web companion (memory + intelligence half) of the Digital Ocarina
hardware instrument. Before building anything, read:

- **`docs/STRATEGY.md`** — the webapp's role, the three loops, Stage A/B/C +
  jam-lane deliverables. Canonical strategy lives in
  `digital-ocarina/docs/STRATEGY_THREE_LOOPS.md` (edits there only). Every
  new feature names its loop before it starts.
- **`progress.md`** (shipped) / **`todo.md`** (next) / **`docs/EVENTS.md`**
  (interaction-event schema, consent-gated).
- Model ids live in `lib/ai/provider.ts` only — check retirement dates when
  touching them (prod was down Jun 15–Jul 5 2026 on a retired id).
