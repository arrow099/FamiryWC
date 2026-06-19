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

v1 includes live match data behind a server-side provider adapter. The browser should render our generated/cached app state, not raw ESPN/FIFA/provider responses.

Recommended live path:

```text
Vercel Cron -> /api/cron/refresh -> provider fetch -> cached app state
browser -> /api/data -> cached app state
```

Browser UI reads cached state only. Provider refresh is scheduled through Vercel Cron or authenticated server-to-server calls.
