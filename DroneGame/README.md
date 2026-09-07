# SIGNAL — dronová arkáda

Jednoduchá hra v češtině, napsaná v čistém JavaScriptu a Canvas 2D. Bez knihoven, instalace, sestavování, obrázkových assetů, fontů z internetu nebo síťových požadavků.

## Spuštění

Otevři **index.html** v současném prohlížeči (Edge, Chrome, Firefox nebo Safari). Funguje přímo přes `file://` i z běžného statického webového serveru. Všechny tři soubory `index.html`, `styles.css` a `game.js` ponech ve stejné složce.

## Jak hrát

Za 60 sekund zachyť co nejvíce oranžových pohyblivých majáků. Dron stále letí vpřed. Zásah nastane automaticky při kontaktu; nestřílí se ani nekliká pro zásah. Po zásahu nebo po průletu kolem cíle se během krátké pauzy připraví další dron. Letka je neomezená.

Obtížnost plynule roste s uplynulým časem kola, nezávisle na počtu zásahů. První cíle se pohybují pomaleji po menší dráze; postupně zrychlují, rozšiřují pohyb do stran a přidávají nepravidelné kličkování. Pohyb se mění plynule i u právě letícího cíle. Ukazatel úrovně má čtyři stupně po 15 sekundách. Velký odpočet přímo v herní ploše zůstává viditelný i na celé obrazovce; posledních 10 sekund se zbarví oranžově a během letu jemně pulzuje.

- **Myš:** pohyb vlevo a vpravo řídí dron. Kurzor výše na ploše zrychluje, níže zpomaluje. Není potřeba držet tlačítko.
- **Šipky / WASD:** vlevo a vpravo zatáčí, nahoru zrychluje, dolů zpomaluje. Bez stisku letí dron cestovní rychlostí.
- **Dotyk / pero:** táhni po herní ploše; vodorovně řídíš, svisle měníš rychlost. Po zvednutí prstu se dron vrací k cestovní rychlosti.
- **Enter:** start a další hra; v pauze pokračování.
- **P / Escape:** pauza a pokračování.
- **M:** zapnutí nebo vypnutí syntetizovaných zvuků. Ve výchozím stavu je zvuk vypnutý.
- Ikona vpravo dole přepne herní plochu na celou obrazovku, pokud ji prohlížeč podporuje.

Při přepnutí okna nebo karty se hra automaticky pozastaví. Také Tab během letu pozastaví hru a umožní přístup k tlačítkům. V pauze čas neběží. Čas se měří nezávisle na snímkové frekvenci. Cíl, k němuž dron do vypršení limitu nedoletěl, se do minutí ani úspěšnosti nezapočítává.

Osobní rekord a nastavení zvuku se ukládají do `localStorage`. Pokud prohlížeč ukládání blokuje, hra dále funguje; rekord zůstane jen během aktuálního otevření stránky.

## Soubory

- `index.html` — přístupné rozhraní, české texty, vložené SVG ikony.
- `styles.css` — responzivní vzhled pro počítač i mobil.
- `game.js` — fyzika, ovládání, 2.5D projekce, procedurální krajina, zvuk a herní stavy.

Fyzika běží s kroky nejvýše 1/120 s a kontroluje průnik celé trajektorie mezi snímky, aby rychlý pohyb nepřeskakoval cíle. Měřítko vykreslování nemění herní pravidla. Hra respektuje systémové omezení animací u dekorativních efektů.

## Ověření

Volitelné testy herní logiky používají pouze vestavěné moduly Node.js:

```sh
node --test tests/game.test.cjs
```

Pokrývají zásahy i minutí, následný start dronu, řízení a rychlost, více současných dotyků, dosažitelnost cílů, pauzu, přesný konec časového limitu, nefunkční úložiště i nezávislost fyziky na velikosti obrazovky. Node.js je potřeba pouze pro tyto testy, nikoli pro spuštění hry.
