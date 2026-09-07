# Nulový bod — Operace Šlendrián

Komická vojenská střílečka z první osoby a **pevného stanoviště**. Zůstává původních 60 sekund, osm nábojů v zásobníku a tři životy. Myš a klávesnice ovládají pouze míření; hráč ani kamera po bojišti nechodí.

Hra používá pouze HTML, CSS, Canvas 2D a Web Audio API. **Žádné externí knihovny, fonty, obrázky, zvukové soubory ani síťové požadavky.** Textury a zvuky vznikají přímo v prohlížeči.

## Spuštění

Otevřete soubor `index.html` v moderním prohlížeči (Chrome, Edge, Firefox nebo Safari). Není potřeba instalace ani lokální server. Zvuk se aktivuje po stisku tlačítka Narukovat.

## Ovládání

- Myš nebo dotyk: míření a střelba; podržení střílí opakovaně
- Šipky nebo WASD: míření
- Mezerník nebo Enter: střelba; podržení střílí opakovaně
- R nebo tlačítko Přebít: přebití (prázdný zásobník se přebije automaticky)
- Escape nebo tlačítko pauzy: pozastavení / pokračování
- M nebo tlačítko zvuku: vypnutí / zapnutí zvuku

Přepnutí okna nebo skrytí záložky hru automaticky pozastaví. Pauza zastaví i nepřátelské útoky a přebíjení. Nastavení zvuku a rekord se ukládají do `localStorage`; hra funguje i při zablokovaném úložišti nebo nedostupném zvuku.

## Co se může pokazit

- **Helmy létají:** zásah hlavy za 180 bodů doprovází kovové cinknutí, hvězdičky a odlétávající helma. Zásah těla dává 100 bodů. Každý další zásah v sérii přidává 20 bodů, nejvýše +160.
- **Nejlevnější uchazeč:** některým protivníkům se zbraň zasekne. Získáte 2,2 sekundy navíc, ale potom znovu vystřelí.
- **Výbušný guláš:** označené sudy dávají 75 bodů a vyřadí okolní nepřátele. Po 12 sekundách zásobování doplní nový sud. Kuchař je před gulášovou vlnou chráněný.
- **Náš kuchař:** bílá čepice a zelený štítek označují spojence. Nechte ho přejít pro +150 bodů; zásah stojí až 200 bodů a přeruší sérii.
- **Zásoby na deštníku:** trefte bednu pro +150 bodů, plný zásobník a jeden život (nejvýše tři). Deštník není terč.
- **Generálova inspekce:** protivníci na tři sekundy salutují. Ideální chvíle vyřešit personální situaci.
- **Polní atmosféra:** prádlo na šňůře, tank s ohnutou hlavní, zatoulaná slepice, kachnička pro štěstí, rozhlasové komentáře a lehce rozladěný pochod.

Střelba je komiksová, bez krve. Přesnost počítá úspěšné výstřely, takže ani zásah několika nepřátel jedním sudem nepřekročí 100 %.

## Pro vývoj

- `renderer.js`: kreslení scény, generování textur, postavy, zbraň a efekty. Statické pozadí se vykreslí do pomocného Canvasu pouze při změně velikosti.
- `audio.js`: syntetické výstřely, přebíjení, zásahy, rádio, prostředí a hudba. Prostorové směrování a omezení hlasitosti.
- `game.js`: herní pravidla, vstupy, události, skóre, pauza a ukládání rekordu.
- `styles.css` a `index.html`: responzivní menu, rozhraní a dotyková tlačítka.

Volitelný lokální náhled pomocí Node.js, bez instalace balíčků:

```sh
node tools/serve.cjs
```

Potom otevřete `http://127.0.0.1:4173`. Server poslouchá pouze na místním počítači.

Automatické kontroly používají vestavěné moduly Node.js:

```sh
node --test tests/game.test.cjs
```

Testy ověřují zásahy, krytí, přebíjení, pauzu, restart, bonusy, události celého kola, mobilní vykreslování, nedostupné úložiště i plánování zvuků. Vizuální vzhled a skutečný zvuk je vhodné kontrolovat také v prohlížeči.
