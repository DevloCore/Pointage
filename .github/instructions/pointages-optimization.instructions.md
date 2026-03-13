---
description: "Use when working on pointages data flow, cache helper queries, Supabase sync, or history/home views. Enforce on-demand loading, date-range filtering, pagination, and cache invalidation rules."
applyTo: "src/db/**/*.js,src/composables/**/*.js,src/views/**/*.vue,src/main.js"
---
# Pointages Loading And Cache Rules

- Do not load all pointages by default with `toArray()` or unbounded `select('*')`.
- Load only what the current screen needs.
- Use date-range queries for day/week contexts.
- For "all history", use pagination or chunked loading.
- Keep the persistent local cache helper as the local cache and hydrate from Supabase on demand.
- Prefer bounded cloud preload at startup (recent window), not full table sync.
- Any write path that changes pointages must invalidate in-memory cache.
- Real-time cloud events that update local cache must also invalidate cache.
- Keep fetch helpers centralized in `src/db` and reuse them from views/composables.
- If a broader fetch is needed, justify it in code comments and keep it explicitly bounded.
