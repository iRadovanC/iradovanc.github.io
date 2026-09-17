# Ještě jeden meeting

Česká kancelářská hra o hlavním programátorovi Márovi, pátečním releasu a biologických limitech multitaskingu. V kanceláři potkáš ředitele Petera i věčně nespokojeného Zbyška, který se pohybuje mezi místnostmi a průběžně kontroluje, jestli už je všechno hotové.

## Spuštění

Otevři **index.html** v moderním prohlížeči. Hra funguje i offline a nepotřebuje instalaci, sestavení, knihovny, externí fonty ani připojení k internetu.

Volitelný lokální náhled: `node server.js`, potom `http://localhost:4173`. Node je potřeba pouze pro tento pomocný server a automatické testy, ne pro hru.

## Pravidla

- Směna trvá od 09:00 do 17:00. Jedna reálná sekunda odpovídá 1,5 herní minuty; celá směna trvá 5 minut a 20 sekund bez pauz.
- Vytvoř 100 % kódu, v QA sniž počet bugů na **2 nebo méně** a ve stejné místnosti zvol **Nasadit do produkce**. Nasazení trvá čtyři sekundy a musí skončit před koncem směny.
- Psaní kódu přidává i bugy. Refaktor a pomoc kolegy kód vylepšují, QA opraví až šest bugů za jednu činnost.
- Káva přidává energii, ale zvyšuje stres i náplň močáku. Voda doplňuje hydrataci a také potřebuje místo. Sušenka je nouzový oběd.
- Plný močák způsobí trapný incident: −18 důvěry a +22 stresu. Hra pokračuje. Na WC můžeš provést `flush()`.
- Nulová energie, nulová hydratace, nulová důvěra nebo stres na 100 % ukončí směnu předčasně. Pohovka doplní trochu energie a výrazně sníží stres.
- Meetingy jsou v 10:00, 13:00 a 15:30. Do meetingu lze vstoupit od 18 minut před začátkem do 36 minut po něm. V místnosti je nutné spustit činnost; samotná přítomnost nestačí. Za účast dostaneš +9 důvěry, za absenci −16. Zahájený meeting může doběhnout za hranici okna.
- Řediteli můžeš občas reportovat optimismus. Další report je možný nejdříve za 60 herních minut. Náhodné kancelářské události mění stres, kód, bugy či důvěru.
- Volba **Rychlé činnosti** je standardně zapnutá: po zvolení činnosti se její průběh odsimuluje, herní hodiny viditelně přeskočí o potřebný čas a výsledek se projeví okamžitě. Po vypnutí probíhá činnost v reálném čase a lze ji přerušit.
- Čas při čtení pravidel stojí. Přepnutí do jiného okna hru pozastaví; pokračuješ tlačítkem přehrávání nebo mezerníkem.
- Nedokončená činnost nepřináší bonus. Přesun do jiné místnosti ji zruší.
- Nejlepší bodové skóre se ukládá do lokální paměti prohlížeče. Neodesílají se žádná data.

## Ovládání

Klikni na popisek místnosti nebo na její plochu. Postava dojde po vyznačené trase a nabídne činnosti. **E** znovu otevře nabídku, **mezerník** pozastaví nebo obnoví směnu.

| Klávesa | Místnost |
| --- | --- |
| 1 | Tvoje kancelář |
| 2 | Zasedačka |
| 3 | Ředitelna |
| 4 | Kolegové |
| 5 | Kuchyňka |
| 6 | WC |
| 7 | QA testbed |
| 8 | Pohovka |

Tlačítka v pravém dolním rohu mapy přibližují zobrazení a přepínají popisky. **Herní režim** v záhlaví přizpůsobí hru výšce desktopového okna; po startu z pravidel se zapne automaticky. Zvuk je volitelný; zapíná se notou v záhlaví a vytváří jej Web Audio API.

## Soubory

- `index.html` — rozhraní a dialogy.
- `style.css` — responzivní styl pro desktop i mobil.
- `game.js` — samostatný herní model, navigace, Canvas postavy a obsluha rozhraní. Aktuálně vyvíjená aplikace je nastavena jedinou konstantou `CURRENT_APP`.
- `assets/office.png` — izometrické prostředí vytvořené vestavěným Imagegen.
- `assets/PROMPT.md` — finální prompt použitý pro generování prostředí.
- `tests/game.test.js` — ověření průchodnosti místností, akcí, pauzy, meetingů, potřeb, nasazení a vítězného průchodu celou hrou.

Testy spustíš příkazem `node --test tests/game.test.js tests/deploy.test.js`. Používají pouze standardní moduly Node.js. Ověřují i odmítnutí nasazení dokončeného po 17:00 nebo nasazení, během kterého QA najde nové bugy.
