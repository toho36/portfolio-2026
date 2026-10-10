# T7 — QA brána (Sol + nezávislé review)

Závisí na: T6.

## Smí měnit
Jen opravy nalezených chyb v souborech z T6. Každá oprava vypsaná v RESULT.md.

## Kontroly
- Přístupnost: průchod klávesnicí celou stránkou, viditelný fokus, kontrast (měřený), `aria-live` u P1 a Screen Switch.
- Pohyb: časové osy pro P1, výměnu v Rejstříku, detail SolidPixels, Screen Switch. Ověřit, že nikdy neběží dvě dominantní animace a po skončení není aktivní rAF. Skryté okno cmux zkontrolovat (`visibilityState`).
- Reduced-motion: všechny stavy dosažitelné bez přechodů.
- Výkon (produkční build, `vite preview`): LCP < 2.0 s, CLS < 0.05 na desktopu; na 390 bez horizontálního přetečení. Měření zapsat i s metodou.
- Viewporty z _COMMON, screenshoty všech sekcí.
- Bez WebGL: stránka nezávisí na WebGL (ověřit vypnutím).
- Nezávislé review: Astra (read-only) nad screenshoty, časovými osami a diffem. Verdikt do RESULT.md.

## Kritéria přijetí
Všechny kontroly PASS, nebo vypsané výjimky schválené majitelem. Nic, co nebylo spuštěno, se nehlásí jako PASS.
