# Kontroly ¡Vámonos! — 8. října 2026

Kontroly proběhly ve skutečném prohlížeči Codexu nad místním HTTP serverem, nejprve nad `dist/index.html`, následně nad samostatným `vamonos.html`.

| Kontrola | Výsledek |
| --- | --- |
| Syntaxe JavaScriptu stránky, serveru a exportu | Prošlo `node --check`. |
| Shoda JavaScriptu a CSS v samostatném souboru se zdroji | Prošlo `node verify.cjs`. |
| Jedinečná HTML ID a všechny odkazy na SVG symboly | Prošlo. |
| Kompletní lokální assety; žádné externí skripty, fonty ani CSS importy | Prošlo. |
| Čudos Grande / S-LOV CBRN: objednávka → příjezd → nástup → cesta → platba | Prošlo, cena po TACO 1 790 MXN. |
| Michal Tomkos / Land Rover: celý průchod na mobilu | Prošlo, cena po TACO 1 390 MXN. |
| Sleva TACO na obě vozidla | Prošlo, −100 MXN a konfety. |
| Simulovaný chat: dotaz na platbu kartou | Prošlo, odpověď povoluje pouze pesos. |
| Zrušení během hledání a během příjezdu, následné nové objednání | Prošlo, žádný přetrvávající starý příjezd. |
| Čekání řidiče na výslovný nástup | Prošlo, cesta nezačne sama. |
| Pětihvězdičkové hodnocení Čudose a změna Michalova hodnocení po zaplacení | Prošlo, historie zobrazila 5★ a 4★. |
| Zachování obou zaplacených jízd při znovunačtení / otevření samostatné stránky | Prošlo. |
| Profily přesně dvou řidičů, jejich vozidla a mexická národnost | Prošlo. |
| Změna vyzvednutí na náměstí Svobody | Prošlo. |
| Dialog platby a jeho zavření Escape | Prošlo. |
| Výběr vozidla šipkou na klávesnici | Prošlo. |
| Přiblížení mapy a návrat na celou trasu | Prošlo, transformace 1 → 1,2 → 1. |
| Kód BOLT, kaktus, pět kliknutí na logo a Konami kód | Prošlo, odpovídající text / Fiesta. |
| Konzole prohlížeče při kontrolovaných průchodech | Bez zachycených chyb a varování. |

## Responzivita

Pro následující viewporty se ověřil skutečný render, šířka dokumentu a dosažitelnost tlačítka objednání:

- 320 × 740: bez vodorovného přetékání, objednávkové tlačítko viditelné.
- 390 × 844: mobilní mapa, navazující panel, přichycené tlačítko; kompletní Michalova jízda.
- 430 × 932: bez vodorovného přetékání, objednávkové tlačítko viditelné.
- 768 × 1024: dvousloupcové tabletové rozložení, bez přetékání.
- 1280 × 720 a 1280 × 800: samostatně posuvný objednávkový panel a stále dostupné objednání.
- 1440 × 900: celé desktopové rozhraní a mapa, bez přetékání.

Menší desktopové obrazovky používají posun uvnitř levého panelu; mobil používá běžné posouvání stránky. UI je navrženo také pro omezení pohybu, ale přepnutí systémového nastavení `prefers-reduced-motion` nebylo při QA provedeno. Rovněž nebylo samostatně ověřeno zamítnuté Web Audio či zablokované úložiště; obě chyby jsou zachyceny a volitelné funkce nemají blokovat jízdu.

`screenshots/desktop.jpg` a `screenshots/mobile.jpg` dokládají render původní verze před následující úpravou textů.

## Úprava textů na přání uživatele

Odstraněny poznámky o simulaci a fiktivnosti v hlavní stránce, metadatech, přístupných popiscích, profilech, průběhu jízdy, platbě, účtence, chatu, nápovědě, plánování a oznámeních. Nahrazeny humorem o řidičích, vojenských vozidlech, D1 a pesos. Mapový štítek nyní zní „D1 EXPRESS“.

Regenerováno `vamonos.html`, obnoveno ZIP. Prošlo `node --check dist/app.js` a `node verify.cjs`. Cílená kontrola HTML a JavaScriptu neobsahuje zbývající výrazy upozorňující na simulaci, fiktivnost, imaginární peníze nebo ukázkový režim. Chování ani rozložení se neměnilo.

Vizuální kontrola této úpravy neproběhla: otevřená karta používá protokol `file:`, který nástroj pro práci s prohlížečem blokuje. Otevřenou stránku je nutné ručně obnovit. Archiv této verze proto neobsahuje původní snímky.

## Předání

Web je dokončen jako místní soubory, samostatné HTML a ZIP. Nativní nástroje pro nasazení Sites nebyly v této relaci dostupné, proto není přidělena veřejná hostovaná adresa. Pro nasazení lze beze změn použít běžný statický hosting.
