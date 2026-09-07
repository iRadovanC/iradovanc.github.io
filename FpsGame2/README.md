# Nulový bod — Poslední signál

Arkádová 2D střílečka z první osoby. Voják zůstává na pevném stanovišti a brání vysílač po dobu 90 sekund, rozdělených do pěti stále obtížnějších vln. Hra používá čistý JavaScript, Canvas 2D a Web Audio; nemá externí knihovny, síťové služby ani povinnou instalaci.

## Spuštění

Otevřete `index.html` v aktuálním Chrome, Edge, Firefoxu nebo Safari. Všechny soubory včetně složky `assets` ponechte společně. Hra funguje offline, bez serveru. Zvuk se aktivuje po zahájení hry.

## Ovládání

- **Myš / dotyk:** přímé míření; držení spouště nebo prstu střílí automaticky.
- **Šipky / WASD:** posun zaměřovače. Hráč se nepohybuje.
- **Mezerník / Enter:** střelba; držením automatická palba.
- **R / tlačítko munice:** přebití. Druhý stisk v zeleném pásmu dokončí přebití okamžitě a přidá 25 bodů a šest posílených střel. Předčasný stisk přebití lehce prodlouží. Prázdný zásobník se přebíjí automaticky.
- **G / tlačítko granátu:** hod do aktuálního zaměřovače. Dva granáty na začátku, třetí ve třetí vlně.
- **Q / tlačítko soustředění:** zapnout nebo vypnout zpomalení nepřátel. Alternativně podržte pravé tlačítko myši. Energie se sama obnovuje; čas mise stále plyne normálně.
- **Esc / P / tlačítko pauzy:** pozastavení. Hra se také pozastaví při přepnutí okna nebo karty.
- **M / tlačítko zvuku:** ztlumení. V nastavení lze upravit hlasitost, vypnout podkres a omezit efekty.

## Pravidla

Útočníci, rychlí průzkumníci, obrněnci a létající drony mají různou výdrž, rychlost a sílu útoku. Ukazatel nad cílem se plní směrem k útoku, poslední okamžik signalizuje červené varování. Obrněncům je výhodné mířit na hlavu, dronům na svítící střed.

Eliminace v časovém okně prodlužují sérii. Každé čtyři eliminace zvýší násobič, nejvýše na ×4. Minutí, poškození hráče nebo vypršení okna sérii přeruší. Zásah hlavy při eliminaci přidává bonus. Granáty zasahují skupiny v omezeném poloměru.

Po každých osmi eliminacích se může objevit lékárnička: zasáhněte ji pro +25 zdraví a +50 bodů. Začátek další vlny doplní 12 zdraví. Dokončení operace přinese bonus za zbývající zdraví a přesnost. Zdraví je omezeno na 100.

## Ukládání

Rekord a nastavení se ukládají do `localStorage`. Původní klíč rekordu `nulovy-bod-high-score` je zachován. Nový rekord se ukládá průběžně i při ukončení kola. Uložení je místní pro daný prohlížeč a umístění hry; při blokovaném úložišti hra funguje dál a nastavení zobrazí upozornění. Rekord z lokálního serveru není sdílen s otevřením přes `file:`.

## Vývoj a ověření

- `node --test tests/core.test.cjs` — testy pravidel, zásahů, pauzy, přebíjení, granátů, zpomalení a průchodu všech pěti vln na širokém i úzkém displeji.
- `node tools/preview.cjs` — volitelný lokální náhled na adrese vypsané v terminálu. Pro běžné hraní není Node.js potřeba.

Herní pravidla jsou v `game-core.js`, ovládání a rozhraní v `game.js`, vykreslování v `renderer.js`, zvuk v `audio.js`. Zvuky i adaptivní podkres se syntetizují přímo v prohlížeči. Grafika a její prompty jsou popsány v `assets/README.md`.
