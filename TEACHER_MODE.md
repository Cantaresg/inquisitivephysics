# Teacher Mode — Architecture Contract

All simulations that support teacher-configured sessions must follow this contract.
Common infrastructure lives in `shared/teacher/`. Sim-specific code stays inside each sim.

---

## Supabase setup (one project, shared across all sims)

Run once in the Supabase SQL editor:

```sql
create table sessions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  sim        text not null,
  config     jsonb not null,
  created_at timestamptz not null default now()
);

alter table sessions disable row level security;
```

Credentials live in **one place**: `shared/teacher/supabase-client.js`.
Every sim imports from there — never duplicate credentials.

---

## Session code format

Each sim owns a prefix. Codes are `PREFIX` + 4 unambiguous alphanumeric chars.

| Sim | Prefix | Example |
|-----|--------|---------|
| Qualitative Analysis Lab | `CHEM-` | `CHEM-K7M2` |
| Electrochemistry Lab | `EC-` | `EC-4RNB` |
| Physics (per sim) | `PHYS-` | `PHYS-2XQ9` |

---

## Common SessionConfig shape (all sims must include these fields)

```json
{
  "sim":          "chem_lab",
  "version":      1,
  "title":        "Session title",
  "teacherEmail": "teacher@school.edu",
  "googleDocsUrl": "https://docs.google.com/...",
  "createdAt":    "2026-04-24T00:00:00.000Z",
  "activities": [
    {
      "id":           "uuid",
      "title":        "Activity 1",
      "instructions": "Free text shown to students",
      "questions":    ["Q1 text", "Q2 text"]
    }
  ]
}
```

Sim-specific fields go **inside each activity object**, alongside the common fields above.

---

## Sim-specific activity fields

### chem_lab (Qualitative Analysis)
```json
{
  "allowedReagents": ["hcl_aq", "naoh_aq", "..."],
  "allowedTests":    ["flame_test", "litmus", "..."],
  "unknownConfig":   { "enabled": true, "solutions": 2, "solids": 0 }
}
```

### echem_lab (Electrochemistry) — to be defined
```json
{
  "allowedElectrodes":   [],
  "allowedElectrolytes": [],
  "allowedModes":        ["electrolysis", "galvanic"]
}
```

### physics sims — defined per sim when teacher mode is added
```json
{
  "parameters": {}
}
```

---

## Shared modules (`shared/teacher/`)

| File | Purpose |
|------|---------|
| `supabase-client.js` | Supabase singleton (credentials here, nowhere else) |
| `SessionLoader.js` | `createSession`, `loadSession`, `updateSession`, `getSessionCode()` |

## What each sim must build

### Teacher side
- A teacher HTML page that loads `<script src=".../supabase-js@2">` before the module entry
- A `SessionManager` wrapper that calls `shared/teacher/SessionLoader.js` with its own `sim` id and code prefix
- An `ActivityEditor` component that renders the common fields + sim-specific fields

### Student side
- On lab load: call `getSessionCode()` from `SessionLoader.js`, fetch config if a code is present
- `applySession(config)` — sim-specific function that restricts UI to the activity's allowed items
- Fall back to free/open mode if no session code is in the URL
- Show activity title, instructions, questions, and Google Docs link when a session is loaded
