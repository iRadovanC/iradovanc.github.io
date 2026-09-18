# Skřítek Bugísek

Vtipná hra o projektovém manažerovi, který před zákazníky prezentuje silně zabugovanou C2 aplikaci pro sledování jednotek v terénu před vojáky AČR. Čisté HTML, CSS a JavaScript, bez knihoven, balíčků, CDN, externích fontů nebo požadavků na mapové API. Veškerá grafika je lokální.

## Spuštění

Otevři `index.html` v moderním prohlížeči. Instalace ani sestavení nejsou potřeba.

Volitelný lokální server využívá pouze vestavěné moduly Node.js:

```sh
node serve.js
```

Hra pak běží na `http://localhost:4173`. Server poslouchá i na lokální síti; tablet na stejné síti může otevřít adresu počítače s portem 4173, pokud to dovoluje jeho firewall. Pro samotnou hru Node.js potřeba není. Na tabletu je nejpřehlednější orientace naležato.

## Hraní

- Přežij 90 sekund prezentace, dokonči alespoň čtyři ukázky včetně jednoho pluginu a udrž důvěru zákazníků nad nulou.
- Jednotky s APP-6 symboly vybereš na mapě, ve spodní liště nebo v pluginu Jednotky. Modré rámečky rozlišují pěší, tankovou, dělostřeleckou, průzkumnou, ženijní a spojovací četu.
- Panel pluginu zabírá celou výšku displeje a mapa mu uvolňuje místo. Překrývající se symboly se rozestoupí; tenká spojnice ukazuje jejich skutečnou polohu. Najetí kurzoru na mapu zastaví pohyb pro pohodlný výběr. Kliknutí na symbol zavře panel a otevře detail jednotky.
- Kreslení a Měření používají dva klepy na mapu. Kreslení kreslí špagety, Měření vrací banány. Vrstvy vypustí husy, Mapy zobrazí kancelář a seznam jednotek obsahuje nepojízdné kolegy z inventáře.
- Pluginové chyby napravují záchranná tlačítka v jejich panelech. Náhodné poruchy mají vlastní instrukce a časový limit. Rychlé klikání snižuje stabilitu.
- Tři nevyřešené bugy automaticky přepnou pohled na velitelské stanoviště. Nulová stabilita nebo experimentální 3D nejprve vyvolají modrou smrt. Ruční přepínání pohledů ve hře není.
- Na velitelském stanovišti odpověz na konkrétní otázku zákazníka. Dobrá odpověď získá 5,8 sekundy krytí. Spusť restart, dokud se zákazníci věnují hovoru. Tlačítkem ho lze opět přerušit. Nápadné restartování zvyšuje podezření; odhalení ubere důvěru a část postupu.
- Na obnovení máš 24 sekund. Úspěšný restart automaticky vrací hru k tabletu a zachovává postup v ukázkách. Pokud čas prezentace vyprší během krize, musíš ji nejprve vyřešit.
- Mezerník mimo tlačítka pozastaví hru. Pauza a návod zmrazí čas i obě herní fáze. Změna záložky hru automaticky pozastaví. Zvuk a omezení animací jsou volitelné.

Rekord a preference zvuku se ukládají pouze v `localStorage`. Při nedostupném úložišti hra normálně pokračuje.

## Soubory

- `index.html`: rozhraní, přístupné ovládání, dialogy a inline SVG ikony.
- `style.css`: základní tablet, mapové prvky a responzivní rozvržení.
- `presentation.css`: pluginy, PM, modrá smrt a zákaznická scéna.
- `engine.js`: pravidla hry, scénáře zákazníků, automatické přechody a skóre, nezávislé na DOM.
- `map-renderer.js`: procedurální fiktivní cvičný prostor Bugovice s vrstevnicemi, lesy, potokem, polními cestami a terénními trasami.
- `c2-presentation.js`: SVG symboly, rozestupy značek a kombinace reakcí.
- `c2.css`: vojenské postavy, symboly a celovýškový panel pluginů.
- `layout.css`: větší písmo a rozložení podle dostupné šířky a výšky okna; na desktopu displej tabletu 16:10 a zvětšený spodní panel PM. Úsporné rámy a záhlaví pro notebooky, posouvání obsahu na úzkých obrazovkách.
- `portrait.css`: fotografická hlava PM ve spodní liště i při záchraně reputace, šest výrazů a jemné pohyby podle herních událostí. V krizové scéně se mění také tělo; původní ruka při facepalmu překrývá obličej samostatnou horní vrstvou. Pauza pohyb zastaví; omezení animací ponechá statické výrazy.
- `assets/pm-photo-head.png`, `assets/pm-photo-expressions.png`: průhledný výřez hlavy z dodané fotografie a atlas šesti odvozených výrazů (3 × 2).
- `assets/pm-cutout.png`: průhledný atlas původních těl PM. Ruka a předloktí pro překrytí tváře se ořezávají ze stejného políčka, aby přesně navazovaly.
- `assets/soldiers-cutout.png`: neprůhledné postavy vojáků na průhledném pozadí. Jednotlivé pózy používají vlastní ořez a vnitřní okraj; atlas se už neprolíná s podlahou.
- `game.js`: interakce, vykreslování stavu, sprite animace a syntetizovaný zvuk přes Web Audio.
- `assets/soldiers-poses.png`: původní atlas tří vojáků AČR v pěti pózách, zachovaný jako zdroj pro průhlednou verzi. Reakce se kombinují a animují s rozdílným časováním.
- `assets/characters-white.png`: původní archivní atlas, použitý jako stylová reference.
- `assets/pm-poses.png`: PM v košili v šesti pózách, vygenerovaný imagegenem.
- `assets/desk-texture.png`: vygenerovaná textura stolu a izometrické podlahy.

Přesné prompty a způsob použití grafiky jsou v [assets/IMAGEGEN.md](assets/IMAGEGEN.md). Krizová scéna používá PNG se skutečným průhledným pozadím a normální skládání barev. Alfa uvnitř postav je normalizována na plnou neprůhlednost; jemné okraje výřezů zůstávají vyhlazené.

## Ověření

```sh
node --test tests/*.test.js
```

18 testů ověřuje rozestupy jednotek na úzkých mapách, střídání reakcí, šest různých symbolů, pluginové chyby, podmínky výhry a prohry, přechod modrá smrt → zákazníci → tablet, správné i chybné odpovědi, opakované klikání na odpovědi, odhalený restart, pozastavení, konec času během obnovy a úplné vynulování nové hry. Simulace ověřuje výhru ve 25 různých posloupnostech náhodných událostí, včetně pádu aplikace.

V prohlížeči byly ověřeny celovýškové panely všech pěti pluginů a skutečné kliknutí na všech šest jednotek při otevřeném panelu v rozměrech 1024 × 768, 768 × 1024 a 390 × 844. Prošel také výběr a sledování jednotky, měření dvěma body s opravou, modrá smrt, tři odlišné pózy zákazníků, správná odpověď a automatický návrat po restartu se zachováním postupu. Konzole byla bez chyb.

Hlášky PM, všechny jeho odpovědi, komentáře pluginů a citované názvy úkolů jsou záměrně zachované doslova, včetně původních zmínek o vozidlech. Změněny jsou popisy úkolů, rozhraní a zákaznické role. Staré interní identifikátory jednotek zůstávají kvůli návaznosti pravidel a testů.

Úprava čitelnosti a rozložení byla ověřena v Edge při dostupné ploše okna 1920 × 940, 1536 × 740, 1366 × 640 a 1280 × 600 (s rezervou pro lišty mimo obsah stránky). Displej drží poměr 16:10 i s otevřenými pluginy; spodní panel PM má přibližně 110 px. Ověřeno všech pět pluginů, kliknutí na šest jednotek, texty osmi úkolů, šest zákaznických otázek a posouvání návodu. Úzké rozvržení bylo zkontrolováno při 1024 × 668, 768 × 1024 a 390 × 844; na těchto šířkách zůstává mapa vyšší kvůli ovládání. Bez vodorovného přetékání v kontrolovaných panelech a bez chyb JavaScriptu; všech 18 testů pravidel prošlo.
