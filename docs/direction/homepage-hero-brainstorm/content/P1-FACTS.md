# P1′ GameOnVB lifecycle — ověřená fakta (T0a, 2026-10-10)

Zdroj: read-only audit repa `/Users/vitek/main/GitHub/voleyevents` (Explore subagent), klíčové řádky ověřeny ručně (`ingest_bank_transaction`, `admin_create_event`, `admin_set_attended`, `compute_occupied`, `create_checkout_batch`). Cesty `M/` = `spacetimedb/voleyevents-module/src/`.

Stack: SpacetimeDB 2.8.3 (Rust module), Astro site s React částmi (`site/`), Cloudflare Workers (fio-poller, magic-link, …). Legacy Next.js `src/app` volá stejné reducery.

| Krok | Verdikt | Co dělá systém | Důkaz |
|---|---|---|---|
| 1. Event opens | PARTIAL — jednotlivé termíny, žádný model série | Organizátor uloží termín s kapacitou, rezervou a stavem Open/Closed; zapíše se audit `event.create`. „Opakování“ = kopie termínu na nové datum. | `M/reducers/admin.rs:887` `admin_create_event`, `:946` status, `:971` audit; `:1230` `admin_copy_event`; `M/tables/event.rs:30–33`; UI `site/src/lib/admin-events-browser.ts:352`, `/admin/events/new` |
| 2. Player registers | EXISTS | Veřejná registrace vytvoří checkout batch, který hned drží místo; obsazenost = Pending/Claimed + Confirmed; veřejná stránka ukazuje „occupied / capacity“. | `M/reducers/user.rs:3070` `create_checkout_batch`; `M/capacity.rs:21` `compute_occupied`, `:188` capacity check; `M/views.rs:280` `public_event_occupancy`; `site/src/lib/detail-public-state.ts:72`; route `/r/:slug` |
| 3a. QR instrukce | EXISTS | Hráč dostane SPAYD QR s variabilním symbolem pro batch / registraci. | `src/lib/spayd.ts:27` `buildSpaydPayload`; `site/src/components/RegistrationCheckoutView.tsx:273`; `M/payment_instruction.rs:446` |
| 3b. Automatické párování | EXISTS | Worker `fio-poller` (cron) stahuje transakce z Fio API; reducer `ingest_bank_transaction` je idempotentně zapíše do append-only `bank_tx_log` a páruje podle VS + částky na batch / registraci / intent; nespárované jdou do admin fronty. | `workers/fio-poller/src/poll.ts:97,219`; `M/reducers/system.rs:864` `ingest_bank_transaction`, párování `:964–1148`, `insert_unmatched :1544` |
| 3c. Ruční vyrovnání + audit | EXISTS | Admin může platbu vyrovnat i ručně; každá změna je idempotentní a v auditu. | `M/reducers/admin.rs:12284` `admin_mark_bank_paid`, `:5036` `admin_resolve_unmatched`; tabulky `admin_audit_log`, `bank_tx_log`, `payment_correction` |
| 4. Attendance resolved | EXISTS | Organizátor označí docházku u registrace; uloží se `attended_at` a audit s předchozí hodnotou. | `M/reducers/admin.rs:8503` `admin_set_attended`, `:8089` transition, `:8103`, `:8127`; UI `site/src/lib/admin-roster-browser.ts:1526`, `/admin/events/:id/participants` |

## Důsledky pro texty P1

- Krok 1 NESMÍ říkat „recurring series“. Povoleno: „Organizer opens an event with capacity“; volitelně „…or copies a previous one to a new date“.
- Krok 3 SMÍ říkat „automatically matched by variable symbol and amount“ — jen pokud demo použije skutečný `ingest_bank_transaction` (seed `scripts/seed-dev-scenarios.mjs:683` nebo fio-sim). Štítek „Simulated bank input“ povinný. Ruční `admin_mark_bank_paid` se nesmí vydávat za automatické párování.
- Krok 4: „Attendance is recorded against the registration, with an audit entry.“

## Lokální demo (bez produkce)

- Izolovaný lokální modul: `bash scripts/dev-reseed.sh` (`voleyevents-audit-<runid>`, temp data dir, volný port); admin `scripts/dev-seed-user.mjs <email> --admin`; scénáře `scripts/seed-dev-scenarios.mjs`.
- Seed skripty odmítnou Maincloud / `voleyevents-prod` bez `SEED_DESTRUCTIVE_APPROVAL`. Produkce se v tomto úkolu nepoužívá vůbec.
