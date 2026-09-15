# IRON FRONT — Operace Železný úsvit

Jedna kompletní úroveň 2D realtime strategie s českým úkolovým uskupením, inspirovaná klasickými vojenskými RTS. Vlastní svět, české rozhraní, technika AČR a bezejmenný protivník se starší vojenskou estetikou.

## Spuštění

Otevřete **index.html** v aktuálním desktopovém prohlížeči. Hra funguje přímo přes `file://`, bez instalace a bez připojení k internetu. Soubory `style.css`, `game.js` a složka `assets` musí zůstat vedle HTML.

Volitelný lokální server, pokud máte Node.js:

```powershell
node tools/serve.cjs
```

Potom otevřete [http://127.0.0.1:4173](http://127.0.0.1:4173). Server používá pouze standardní knihovnu Node.js. Hra samotná Node.js nevyžaduje.

Určeno pro myš a klávesnici, doporučené rozlišení alespoň 1024 × 768. Menší výška okna zpřístupní nabídku výroby posouváním.

## Mise

Operace probíhá **někde na východě**. Zajistěte údolí a zničte nepřátelské velitelství na severovýchodě. Ztráta vlastního velitelství znamená porážku.

- Startovní základna: velitelství, elektrárna, kasárna a zpracovatelský závod.
- Startovní armáda: tři Leopardy 2A8, dva střelci BREN 2, pancéřovník Carl-Gustaf a logistická Tatra 815-7.
- Šest staveb: elektrárna, kasárna, zpracovatelský závod, vojenské depo, obranná věž, radar.
- Pět vyráběných jednotek: Střelec BREN 2, Carl-Gustaf, Leopard 2A8, Iveco LMV a Tatra 815-7. [Podklady k technice AČR](docs/technika.md).
- Ruda se těží v lomech s rovnou pracovní plochou a širokým vjezdem. Tatra ji automaticky sváží do zpracovatelského závodu; náklad přináší až 280. Další zpracovatelský závod přidá novou Tatru.
- Bilance začíná na 3 200. Částky jsou herní hodnoty pro vyvážení mise.
- Výroba staveb a jednotek má samostatné paralelní fronty. Nedostatek energie zpomalí výrobu a vypne obranné věže; radar má menší dosah.
- Nepřítel vysílá postupně silnější vlny, dokud nezničíte jeho továrnu.
- Dva mosty, hledání cest A*, mlha války, průzkum, skupiny jednotek, automatické zaměřování a útok za přesunu.
- Opravy z bilance, vrácení částky při zrušení výroby, pauza, restart, výsledky mise, přiblížení a rychlost 1×/2×.
- Volitelný procedurální zvuk přes Web Audio; zapnutí tlačítkem ♪.

Tip: nejprve postavte vojenské depo na volném místě severně od velitelství. Posilte obranu jednou věží a sestavte skupinu Leopardů. Před útokem vyberte armádu pomocí F2, stiskněte A a klikněte do nepřátelské oblasti.

## Ovládání

| Vstup | Akce |
| --- | --- |
| Levý klik / tažení | Vybrat jednotku nebo skupinu |
| Shift + klik | Přidat nebo odebrat jednotku |
| Pravý klik | Přesun, útok na nepřítele, těžba rudy |
| A a levý klik | Útok za přesunu |
| S | Zastavit |
| R | Opravit vybranou vlastní budovu |
| H | Obnovit automatickou těžbu vybraného těžebního vozu |
| F2 | Vybrat všechny bojové jednotky |
| Ctrl + 1–9 / 1–9 | Uložit / vybrat skupinu |
| Šipky / prostřední tlačítko a tažení | Posunout kameru |
| Kolečko / tlačítka + a − | Přiblížit a oddálit |
| Mezerník | Kamera k základně |
| Levý / pravý klik do minimapy | Přesun kamery / rozkaz jednotkám |
| Klik na položku ve výrobní frontě | Zrušit a vrátit částku do bilance |
| Esc | Zrušit umisťování či rozkaz, jinak pozastavit |

## Soubory a grafika

- `index.html`: rozhraní hry a ovládací prvky.
- `style.css`: responzivní vojenské rozhraní bez externích fontů.
- `game.js`: simulace, Canvas 2D renderer, ekonomika, AI, hledání cest, rozhraní a zvuk.
- `assets/terrain.png`, `assets/buildings.png`, `assets/vehicles-cz.png`, `assets/quarry.png`: originální podklady vytvořené vestavěným imagegen. [Původní prompty a použití](assets/README.md), [prompty české aktualizace](assets/czech-prompts.md).
- `tools/serve.cjs`: volitelný server ze standardní knihovny.
- `tools/check-game.cjs`, `tools/check-mission.cjs`: vývojové testy; pro hraní nejsou potřeba.
- `output/`: screenshoty z ověření.

Hra nemá runtime závislosti, nepoužívá CDN, externí knihovny, analytiku ani síťová API. Herní stav je v paměti prohlížeče; obnovení stránky zahájí novou misi.

## Ověření

Provedeno v Microsoft Edge pomocí Playwrightu dostupného ve vývojovém prostředí. Playwright není součástí hry ani podmínkou jejího spuštění.

Ověřeno: načtení všech obrázků, přímé spuštění `file://`, těžební cyklus, stavění přes UI, výroba tanku, předpoklady výroby, neplatné umístění, zpomalení při nedostatku energie, vrácení peněz, skupiny, pauza, navigace přes mosty, nepřátelské vlny, boj, vítězství, porážka, restart a zobrazení při 1440 × 960 a 1024 × 768. Bez chyb JavaScriptu v prohlížeči.

Samostatný test projde celou misi za použití pouze běžné ekonomiky, nákupů a rozkazů: zničí nepřátelské velitelství a zachová vlastní. Čas simulace lze v testu urychlit; bilance ani poškození při tomto průchodu nejsou podváděny.

Spuštění vývojových testů s dostupným Playwrightem a Edge:

```powershell
# V jiném terminálu nejprve: node tools/serve.cjs
node tools/check-game.cjs
node tools/check-mission.cjs
```

Volitelně nastavte `PLAYWRIGHT_MODULE` na cestu k již nainstalovanému modulu a `BROWSER_CHANNEL` na `chrome`, pokud používáte Chrome. Parametr `?test` zpřístupní ovládání simulace pro testy; při běžném spuštění není aktivní.
