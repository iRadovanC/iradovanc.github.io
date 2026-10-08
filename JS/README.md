# VANGUARD — výcvik a operace Tichý proud

Otevřete **Vanguard.html** v Chrome, Edge nebo Firefoxu. Soubor obsahuje obě mise, 3D knihovnu, modely s kostrou, animace, materiály i zvuk. Není potřeba internet, instalace, účet ani lokální server. Alternativně otevřete `index.html`, vedle kterého musejí zůstat `style.css`, `city.css` a `game.bundle.js`.

Klikněte na **Vstoupit do výcviku**. Prohlížeč uzamkne ukazatel myši do hry; Escape jej uvolní. Pokud prostředí uzamčení nepodporuje, pohled otáčejte tažením se stisknutým pravým tlačítkem.

Pro druhou misi vyberte v hlavním menu **02 / BAGDÁD — Tichý proud**, nastavte obtížnost a klikněte na **Spustit misi**. Během hry otevře Escape stejné menu s možností pokračovat nebo přejít do výcviku. Přepnutí mise, změna obtížnosti a restart zahajují nový průchod; rozehraná mise se na disk neukládá.

## Mise 02: Tichý proud

Fiktivní uzavřený blok Bagdádu, přibližně 64 × 94 metrů: městské ulice, boční průchody a dvory, tržiště, klinika a jižní kontrolní bod. Misi lze dokončit bez zneškodnění všech protivníků.

1. V západním dvoře obnovte napájení kliniky podržením **E** u rozvaděče (3 s).
2. V klinice zajistěte evakuační seznam ze stolu (E, 2 s).
3. Na severozápadním stanovišti zapojte rádio (E, 3 s). Zůstaňte do 12 m od něj po dobu 25 s. Mimo dosah se přenos pozastaví; úspěšný přenos přivolá evakuační tým.
4. Vraťte se k vozidlu na jižním kontrolním bodě a dokončete evakuaci (E, 2 s).

Interakci přeruší uvolnění E, vzdálení, pohyb, přebíjení nebo zásah. Aktuální úkol, vzdálenost a průběh jsou v HUD; všechny čtyři body a zbývající zásoby najdete na mapě **Tab**. Pauza a C2 zastaví boj i čas mise. Smrt nabídne restart.

Zdraví začíná na 100 a samo se neobnovuje. Lékárničky jsou malé zelené zdravotnické brašny položené na zemi a stolech; munice je ve fototexturovaných dřevěných vojenských bednách. **Krátké E** zblízka sebere jeden předmět. Zásoby jsou konečné; při plném zdraví či rezervě se předmět nespotřebuje. Rezerva pojme 240 nábojů. Zásobník má 30 nábojů, přebíjení zachovává počet zbývajících nábojů.

| Obtížnost | Hlídky | Počáteční rezerva | Zásah hráče | Lékárnička | Muniční bedna |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rekrut | 8 | 180 | 8 zdraví | +65 | +90 |
| Voják | 10 | 120 | 12 zdraví | +45 | +60 |
| Veterán | 12 | 90 | 18 zdraví | +30 | +45 |

Vyšší obtížnosti také zkracují reakční dobu a zlepšují dostřel, přesnost a rychlost protivníků. AI hlídkuje, vnímá hráče v zorném poli, slyší výstřely, prohledává poslední známou pozici, plánuje cesty kolem budov pomocí A*, přemisťuje se ke krytům a střílí dávkami s přebíjením. Budovy a kryty blokují vidění i střely. Zranění protivníci vyhledávají kryt a klekají. Zásah těla ubere 38 zdraví, zásah hlavy 100; protivníci nemají na vyšší obtížnosti více životů.

| Ovládání | Akce |
| --- | --- |
| W A S D | Pohyb vzhledem ke směru pohledu |
| Myš | Otáčení pohledu a vojáka |
| Levé tlačítko | Střelba; podržení = automatická střelba |
| Pravé tlačítko | Míření, crosshair a kamera za pravým ramenem |
| C | Přepnutí do kleku / postavení |
| Shift + W | Běh s omezenou výdrží |
| R | Přebití zásobníku, 1,645 sekundy |
| E | Bagdád: sebrat zásoby; podržet pro úkol. Výcvik: doplnit rezervu u LOGISTIKY |
| Tab | Otevření / zavření C2 |
| X | Postavení všech terčů |
| Esc | Pauza a nastavení |

Cílem výcviku je alespoň jednou zasáhnout všech 10 terčů. Dva se pohybují. Terče reagují sklopením a za 5,5 sekundy se znovu postaví. Zásah je za 100 bodů, horní zóna za 150. Nový výcvik v nastavení vynuluje skóre a vrátí operátora na start.

C2 ukazuje skutečné pozice operátora, terčů, překážek, budov a zásobování, směr pohledu, vzdálenosti, skóre a poslední zásahy. Kliknutím do mapy umístíte navigační bod; kolečkem nebo tlačítky mapu přiblížíte. Vybráním terče v seznamu mapu vycentrujete na něj. Otevření C2 pozastaví výcvik. Zeměpisné souřadnice v úvodní obrazovce jsou fiktivní označení simulace, metrická síť je lokální.

## Co je implementováno

- Three.js/WebGL 2, PBR povrchy s normálovými mapami, dynamické stíny, mlha, barevná úprava a FXAA.
- Stažený model Vanguard / Soldier z Mixamo, 49 načtených kostí ovlivňujících model, původní Idle/Walk/Run animace a plynulé míchání.
- Procedurální vrstvy nad stejnou kostrou: klek, pohyb v kleku, dvoukloubová inverzní kinematika paží, uchopení pušky, míření a trajektorie levé ruky při přebití. Tyto vrstvy nejsou stažené motion capture klipy.
- Střely s rychlostí 880 m/s, gravitací a pevnou časovou simulací 120 Hz. Kolize se testují po celé dráze každého kroku, takže střela nepřeskočí tenký terč. Zaměřovací paprsek vede z kamery, střela z hlavně; kontrola mezi ramenem a hlavní brání střelbě přes tenký kryt.
- Kolize vojáka s překážkami, odsun kamery před překážku, stopy po zásazích, částice, nábojnice a lokálně syntetizované zvuky.
- Instancovaná vegetace a sloučená statická geometrie; tři úrovně grafické kvality.

Jde o hratelný prototyp dvou misí. Budovy, vozidla a puška jsou z vlastní geometrie doplněné staženými CC0 modely a materiály; animace kleku a přebití jsou procedurální. Domy slouží jako neprůchozí kryty, hratelné jsou ulice a dvory. Balistika hráče nemá průraznost ani odrazy; nepřátelská palba používá paprsek s rozptylem a kontrolou krytu. Hra nemá multiplayer ani ukládání postupu.

## Úpravy zdrojového kódu

Hra je v čistém HTML, CSS a JavaScriptu, bez aplikačního frameworku. Three.js je lokálně zabalená 3D knihovna. Node.js je potřeba pouze při změnách zdrojů a sestavení, nikoli pro hraní.

```sh
npm install
npm run build
npm test
```

`pnpm install` lze použít se zahrnutým `pnpm-lock.yaml`; pokud pnpm vyžaduje schválení instalačního skriptu esbuild, povolte tento konkrétní balíček. `npm start` spustí volitelný náhled na `http://127.0.0.1:4173`.

`src/main.js` obsahuje herní smyčku, vstupy, kameru a střelbu. `character.js` pracuje s kostrou, `world.js` vytváří polygon, `physics.js` řeší pohyb a balistiku, `c2.js` vykresluje mapy, `foliage.js` vegetaci a `audio.js` zvuk. `scripts/build.mjs` zabalí knihovny a lokální assety do `game.bundle.js` a samostatného `Vanguard.html`.

Pro prohlížečové testy je volitelně potřeba Playwright a Chrome (`npm install --no-save playwright`). Spuštění: `node scripts/integration-check.mjs`. Testy spouštějí `file://` se zakázanou sítí a ověřují skutečné klávesové a myší vstupy. Diagnostické rozhraní je dostupné pouze po výslovném přidání `?test` k URL.

Původ a licence použitých assetů jsou v [CREDITS.md](CREDITS.md).

Nové moduly: `src/baghdad.js` staví město a rekvizity, `src/mission.js` řídí AI a postup mise, `src/mission-rules.js` obsahuje obtížnosti, zásobování, viditelnost a navigaci. `node scripts/mission-integration-check.mjs` ověřuje druhou misi v samostatném `Vanguard.html` se zakázanou sítí; `node scripts/baghdad-check.mjs` pořídí kontrolní snímky menu, hry a mapy.
