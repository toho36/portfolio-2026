**P1′ doporučuji přepracovat a použít. Headline bych zvolil b).** GameOnVB umožňuje ukázat konkrétní vlastní odpovědnost a propojení veřejného rozhraní s provozem systému. Posouzení vychází z plánu, předchozí kritiky a obsahových souborů; implementaci backendu ani lokální průchod jsem neověřoval. Soubory jsem neměnil.

Pro HR je příběh „vypsání → přihlášení → platba → účast“ srozumitelný. Tech lead potřebuje navíc vidět **souvislost mezi stavy a původ změn**. Čtyři screenshoty samy o sobě backend ani integraci neprokazují. Veřejný [GameOnVB](https://gameonvb.cz/) poskytuje podpůrný kontext skutečného produktu: zobrazuje termíny a obsazenost.

Každý krok musí sledovat **tentýž termín a od registrace téhož demo hráče**:

| Krok | Co přesně ukázat | Jednořádkové vysvětlení |
|---|---|---|
| **1. Vypsání termínu** | Skutečnou administraci: konkrétní datum, kapacitu, vazbu na opakovanou událost a uložený otevřený stav. Samotný vyplněný formulář nestačí. | „Systém ukládá termín a kapacitu pro následné registrace.“ |
| **2. Registrace hráče** | Veřejnou stránku stejného termínu, potvrzenou registraci demo hráče a odpovídající změnu obsazenosti podle skutečných pravidel produktu. | „Registrace propojuje hráče s termínem a aktualizuje dostupnost míst.“ |
| **3. Spárování platby** | Platební instrukce s QR a referencí, následně skutečný administrativní záznam propojující příchozí transakci s touto registrací; stav před/po a dostupnou auditní stopu. | „Příchozí bankovní transakce se páruje s konkrétní registrací.“ |
| **4. Docházka** | Stejného hráče v seznamu účastníků, akci organizátora a uložený výsledek docházky. Platba a účast musí zůstat rozlišitelné. | „Organizátor ukládá docházku k existující registraci.“ |

Tyto věty jsou návrhy k ověření při pořizování podkladů, nikoli závěr auditu kódu.

**Nejcitlivější je krok 3.** QR kód představuje platební instrukci; integraci dokládá až zpracování příchozí transakce. Použijte demo vstup pro skutečný párovací mechanismus a přesně označte, kde simulace začíná. Ruční přepnutí databázového příznaku nebo kliknutí na „zaplaceno“ nelze prezentovat jako automatické párování. Vedle trvalého štítku **“Reconstruction with demo data”** proto podle skutečnosti doplňte například “Simulated bank input”. Pokud mechanismus nelze doložit, zúžit tvrzení na správu plateb.

Falešně budou působit překreslené obrazovky, nesouvisející záznamy, inscenované potvrzení úspěchu a vynechaný původ platby. Nudně budou působit čtyři podobné tabulky, drobný text a popisky typu „robustní backend“. Každý výřez má ukázat jednu změnu a její praktický důsledek.

**Šest sekund je vhodných pro přehled, příliš málo pro čtení čtyř obrazovek a vysvětlení.** Doporučuji čtyři přímo volitelné kroky; tlačítko spustí krátký průchod, Pauza/Pokračovat zůstává dostupné a konec ponechá čitelný souhrn. Mobil potřebuje vlastní výřezy. Reduced-motion přepíná úplné stavy bez animace.

Lepší alternativa při nedostatečné čitelnosti: statická dvojice **veřejná registrace → spárovaná platba v administraci**, celý čtyřkrokový průchod až v detailu projektu. Souvislý screencast bych do hera nedával; obtížněji se prohlíží vlastním tempem.

SolidPixels může fungovat čistě textově, ale **pouhá položka zaměstnavatele nestačí**. Zachoval bych rozšířený detail v rejstříku:

- Kontext: týmová práce na CMS a klientských webech.
- Vlastní příspěvek: frontend, backend a integrace; jasně oddělit osobní práci od výsledku týmu.
- Jeden zveřejnitelný příklad: problém → vlastní změna → způsob ověření, bez domyšlených metrik.
- Odkaz na povolený veřejný výstup nebo schválenou referenci, pokud existují.

Z plánu tím odpadají také výřezy a zvětšování SolidPixels UI. Screenshot není podmínkou důvěryhodnosti; přesné připsání odpovědnosti ano.

Z headline kandidátů bych seřadil **b → f → e**. Všechny fungují s věcnou rolí a nepotřebují vysvětlení sloganu.

1. **b) Nejlepší celkově:** přirozená věta, která přesně připravuje návštěvníka na GameOnVB panel.

   Hoang Viet To  
   Software Developer  
   **I build web platforms and the systems behind them.**  
   At SolidPixels, I work across CMS, frontend, backend and third-party integrations; GameOnVB is my own full-stack product.

2. **f) Nejlepší pro technické publikum:** přesné vymezení rozsahu, trochu méně osobní.

   Hoang Viet To  
   Software Developer  
   **Production web software, from interface to integration.**  
   I work independently and in teams, building CMS features, public interfaces, backend logic and third-party integrations.

3. **e) Nejčitelnější pro nábor:** okamžitě sděluje specializaci i pracovní kontext, ale opakuje význam role.

   Hoang Viet To  
   Software Developer  
   **Full-stack web development, alone or in a team.**  
   My work spans the SolidPixels CMS and client sites, plus GameOnVB, my own full-stack event platform.

a) stále staví na obecném příslibu standardů; c) naznačuje nedoloženou dlouhodobou udržovatelnost; d) a h) příliš zužují profil na editory; g) nechává nejdůležitější část práce neurčitou.

{"p1":"REWORK","p1_steps":["Uložený otevřený termín s kapacitou a opakováním","Potvrzená veřejná registrace stejného demo hráče","Transakce spárovaná s registrací, s označeným demo vstupem","Uložená docházka stejného hráče"],"headline_top3":["I build web platforms and the systems behind them.","Production web software, from interface to integration.","Full-stack web development, alone or in a team."],"recommended_hero":{"headline":"I build web platforms and the systems behind them.","line":"At SolidPixels, I work across CMS, frontend, backend and third-party integrations; GameOnVB is my own full-stack product."}}