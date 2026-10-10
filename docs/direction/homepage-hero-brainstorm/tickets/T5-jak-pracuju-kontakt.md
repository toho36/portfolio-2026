# T5 — Jak pracuju + Kontakt (Sol)

Závisí na: T2, T0. Paralelně s T3, T4, T5a jen v nezávislém klonu.

## Smí měnit
`src/home/landing/practice/` (komponenty, CSS, testy).

## Specifikace
- Jak pracuju: odstavec z T0 (max. 60 slov). Goal Loop jako jeden doložitelný příklad: statická řada bran (Plan, Critique, Build, Check, Review, Verdict) s odkazem na `/goal-loop`. Bez simulace běhu (časování v `posterTimelines.ts` je inscenace, ne záznam).
- Volitelný jediný pohyb: při prvním vstupu do viewportu se řada bran jednou vykreslí zleva (max. 600 ms celkem). Pak klid.
- Kontakt: znovu použít logiku `ContactPoster` z `src/pages/Home.tsx` a `src/home/contactForm.ts` (import, ne kopie logiky). Nový vzhled podle tokenů T2. E-mail a CV viditelné i bez formuláře.
- Potvrzení odeslání = skutečný výsledek `sendContact`, ne animace úspěchu předem.

## Kritéria přijetí
- Formulář: validace, fokus na první chybu, rate limit, honeypot — beze změny chování (existující testy `src/home/contactForm.test.ts` musí dál procházet).
- Reduced-motion: řada bran bez vykreslení.
- Screenshoty 1440 a 390, chybový a odeslaný stav formuláře (odeslání mockované v testu, ne skutečné).

## Kontroly
`npm run check`, `npx vitest run src/home/landing/practice src/home/contactForm.test.ts`.
