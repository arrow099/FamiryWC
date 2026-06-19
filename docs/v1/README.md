# Famiry World Cup v1 Docs

This folder turns the discovery notes into the working plan for v1.

Read in this order:

1. `prd.md` - what we are building and what v1 includes
2. `architecture.md` - how the app is structured and deployed
3. `data-model.md` - the data contracts used by the app
4. `project-structure.md` - file, folder, and naming conventions
5. `styling.md` - visual system, responsive layout, and UI conventions

Source research remains in:

```text
docs/discovery/
```

## v1 Direction

Build a small read-only Next.js app for about 30 family/friend users.

The app starts from the bracket picks already extracted into:

```text
data/family_bracket_picks.json
```

v1 includes live match data through a browser-compatible ESPN provider adapter. React renders normalized app contracts, not raw ESPN responses.

Recommended live path:

```text
server-rendered stable picks -> dashboard
visible browser -> ESPN -> normalized in-memory matches -> active tab
```

Each visible browser fetches immediately, polls every 30 seconds, and pauses polling while hidden. Standings and leaderboard scoring are derived only while the Leaderboard tab is active.
