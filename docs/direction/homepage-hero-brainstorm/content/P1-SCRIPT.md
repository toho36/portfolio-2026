# P1′ GameOnVB — from event to attendance (T0a, 2026-10-10)

Stav: zachyceno z lokální izolované instance GameOnVB (SpacetimeDB modul `voleyevents-audit-p1demo`, Next.js admin + veřejná stránka) s jednorázovými demo daty. Jeden termín, jeden hráč ve všech krocích. Produkce nepoužita. Čeká na schválení majitelem.

Trvalý štítek: **Reconstruction with demo data**. Fakta: [P1-FACTS.md](P1-FACTS.md).

Demo data: termín „Čtvrteční volejbal — demo“ (22. 10. 2026 19:00, Demo hala, Praha, kapacita 12, 150 Kč), hráč „Demo Player“ (`demo-player@example.test`), organizátor `demo-organizer@example.test`. Účet příjemce v demo instanci přepsán na smyšlený `123456789/0100` (výchozí účet z repa se nesmí ukázat). Plátce `000000-1111111111/0300`.

Poznámka k UI: screenshoty jsou česky (produkt je česky). Portfolio je anglicky — popisky kroků v panelu budou anglicky, screenshoty zůstávají originální.

## Step 1 — Event opens

- Assets: `p1-assets/step1-desktop.png`, `p1-assets/step1-mobile.png` (admin seznam akcí).
- What the system does: “The organizer saves an event with capacity and an open registration state; the change is written to the audit log.” — P1-FACTS řádek 1 (`admin_create_event`, audit `event.create`).
- Before → after: žádný termín → „Čtvrteční volejbal — demo“, kapacita 12, stav **Otevřeno**.
- Nesmí tvrdit „recurring series“.

## Step 2 — Player registers

- Assets: `p1-assets/step2-before-desktop.png` (0 / 12), `p1-assets/step2-desktop.png`, `p1-assets/step2-crop.png`, `p1-assets/step2-mobile.png`.
- What the system does: “Registration holds a place immediately and the public page updates occupancy.” — P1-FACTS řádek 2 (`create_checkout_batch`, `compute_occupied`).
- Before → after: Kapacita **0 / 12** → **1 / 12**, „Rezervovaní — čeká na platbu (1): Demo Player“, místo drženo 24 h.

## Step 3a — Payment instruction (součást kroku 2/3)

- Assets: `p1-assets/step3a-crop.png` (+ QR a VS ve `step2-crop.png` / `step2-desktop.png`).
- What the system does: “The player gets a QR payment with a unique variable symbol.” — P1-FACTS řádek 3a (`buildSpaydPayload`).
- Stav: 150 Kč, VS **1000000002**, účet 123456789/0100 (demo).

## Step 3 — Payment matched

- Assets: `p1-assets/step3-payments-desktop.png`, `p1-assets/step3-payments-mobile.png` (Příchozí platby: DEMO PLAYER, 150 Kč, VS 1000000002, **Spárovaná**), `p1-assets/step3-event-desktop.png`, `p1-assets/step3-event-crop.png` (účastník **Spárováno**, Tržby 150 Kč banka).
- What the system does: “An incoming bank transaction is matched to the registration by variable symbol and amount; the registration is confirmed.” — P1-FACTS řádek 3b (`ingest_bank_transaction`).
- Štítek navíc: **Simulated bank input** (transakce `demo-fio-tx-0001` vložena přímo do skutečného reduceru `ingest_bank_transaction` místo Fio API; párování a potvrzení provedl skutečný kód).
- Before → after: Příchozí platby prázdné → 1 spárovaná; registrace `confirmed`; Čeká na platbu 0.

## Step 4 — Attendance resolved

- Assets: `p1-assets/step4-desktop.png`, `p1-assets/step4-crop.png`, `p1-assets/step4-mobile.png`.
- What the system does: “The organizer records attendance against the same registration, with an audit entry.” — P1-FACTS řádek 4 (`admin_set_attended`).
- Before → after: Dorazili **0** → **1** (klik „Dorazil“ v check-in pohledu; `attended_at` uloženo).

## Pro T3

- Crop soubory jsou hrubé; finální výřezy pro panel (desktop i mobil) udělá T3 z plných screenshotů (2× DPR).
- Na žádném screenshotu není skutečná osoba, e-mail ani účet. Kontrolováno textem stránky při snímání (hledán výchozí účet z repa).
