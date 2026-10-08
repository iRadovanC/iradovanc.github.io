# ¡Vámonos!

Responzivní a interaktivní parodie aplikace pro objednání odvozu. Čisté HTML, CSS a JavaScript, bez frameworků, knihoven, instalace závislostí, externích fontů nebo síťových služeb.

## Spuštění

Otevřete `vamonos.html` přímo v moderním prohlížeči: obsahuje celou aplikaci v jediném souboru. Alternativně lze otevřít `dist/index.html` se sousedními soubory CSS a JavaScriptu. Vše funguje i bez internetu. Pro místní HTTP náhled lze v této složce spustit:

```powershell
node server.cjs
```

Náhled: http://localhost:4173. Server poslouchá pouze na místním počítači. Volitelný port určuje proměnná prostředí `VAMONOS_PORT`.

K nasazení na běžný statický hosting stačí obsah složky `dist/`:

- `index.html` — celá stránka, vlastní vektorová vozidla, profily, ikony a mapa.
- `styles.css` — rozložení pro mobily, tablety a počítače, animace a omezení pohybu.
- `app.js` — stavový průběh jízdy, mapové interakce, simulovaný chat, platba, historie a easter eggy.
- `favicon.svg` — vlastní ikona aplikace.

Po úpravě zdrojů lze obnovit samostatný HTML soubor příkazem `node package.cjs`.

## Co aplikace umí

- Pevná meziměstská trasa Brno → Lipník nad Bečvou, se třemi místy vyzvednutí v Brně.
- Přesně dva fiktivní mexičtí řidiči: Michal Tomkos s vojenským Land Roverem a Čudos Grande s armádním S-LOV CBRN.
- Výběr auta, profily řidičů a plánovaný čas. Plánování je pouze součást UI; simulace začíná po objednání.
- Hledání řidiče, jeho animovaný příjezd, čekání na nástup, animovaná cesta a doručení do cíle.
- Cena 1 490 / 1 890 MXN, případně sleva 100 MXN s kódem TACO. Ceny, vzdálenost a časy jsou fiktivní odhady.
- Výhradně virtuální platba v hotovosti v mexických pesos, účtenka, hodnocení a historie posledních 20 zaplacených jízd.
- Historie v `localStorage` pouze na zařízení uživatele, s možností smazání. Nedostupné úložiště nebrání jízdě.
- Simulovaný chat s odpověďmi na témata karty, tacos, čekání a CBRN; zvuk klaksonu pouze po kliknutí.
- Bezplatné zrušení hledání, příjezdu nebo rozjeté simulace, bez zbylých časovačů.
- Přiblížení, oddálení a vycentrování vlastní SVG mapy.
- Ovládání klávesnicí, přístupné dialogy, pojmenovaná tlačítka a respektování `prefers-reduced-motion`.

Příjezd trvá přibližně 9 sekund a jízda 24 sekund. Animace přeruší postup v neaktivní kartě a po návratu pokračuje; čekání na nástup se neomezuje. Žádná objednávka, zpráva ani platba se skutečně neodesílá.

## Vtípky a easter eggy

Rozhraní neupozorňuje na fiktivnost ani na simulaci. Hlášky, pomocné texty a přístupné popisky drží humor uvnitř světa aplikace: řidiči, vojenská výbava, Morava a hotovost v pesos. Technický popis chování zůstává v této dokumentaci.

- `TACO` v tajném kódu: −100 MXN a konfety. `PESOS`, `BOLT`, `UBER` a `GRANDE` mají vlastní odpovědi.
- Pět kliknutí na logo během krátké chvíle: režim Fiesta.
- Kaktus na mapě: mexický dispečer na Erasmu.
- Kód ↑ ↑ ↓ ↓ ← → ← → B A: vtip o vojenském konvoji.
- Kliknutí na cíl připomene, že do Cancúnu vozový park zatím nejezdí.
- „Terminál? Ten máme jen vojenský.“
- Land Rover má „dvě okénka a víru“ místo klimatizace. Čudosův filtr zvládne všechno kromě špatného playlistu a cen benzínu.

## Původ grafiky a omezení

Všechna vozidla, portréty, ikony, favicon i ilustrační mapa jsou původní SVG vytvořená pro tuto aplikaci. Nepoužívají se cizí fotografie, skutečné portréty ani loga Boltu nebo Uberu. Ilustrace vozidel jsou stylizované, nikoli přesné technické modely. S Boltem, Uberem ani skutečnou přepravní službou není aplikace spojena.

Mapa je schematická a nenabízí skutečnou navigaci, dopravní informace ani výpočet trasy. Aplikace nevyžaduje GPS ani přístup k mikrofonu. Rozhraní používá nativní `dialog`, SVG, Web Audio a běžné moderní API prohlížečů.

## Ověření

Průběžná kontrola: `node --check dist/app.js` a `node --check server.cjs`.
Výsledky funkčních a vizuálních kontrol jsou v `QA.md`.
