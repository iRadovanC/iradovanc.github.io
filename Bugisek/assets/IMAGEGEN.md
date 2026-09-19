# Grafika vygenerovaná imagegenem

## Učebna v režimu Zachraň reputaci

Taktická tabule je ve scéně posunutá blíž ke středu a tvoří pozadí za postavami. Vpravo stojí rádio jako samostatná vrstva na novém izometrickém učitelském stolku; oddělené vrstvy zachovávají přesnou podobu rádia a umožňují nezávislé responzivní umístění.

- `assets/harryk-personal-radio-isometric.png` — věrná úprava původního rádia, pouze s větším a čitelnějším nápisem `HARRYK`.
- `assets/classroom-table-isometric.png` — prázdný izometrický stolek s průhledným pozadím.

Oba soubory vznikly vestavěným `image_gen.imagegen`. Původní rádio zůstává v projektu beze změny. Použité prompty:

### Rádio HARRYK

> Use case: text-localization / precise-object-edit. Asset type: production transparent PNG prop for an existing isometric 3D game. Input image: edit target — the supplied military personal radio with wired hand microphone. Primary request: change ONLY the small front label from "HARRYS" to the exact text "HARRYK". Make the new HARRYK lettering substantially larger, bold, high-contrast warm ivory/white, and clearly readable even when the full asset is displayed small. Fit it naturally on the same upper olive-green front face above the display. Spell exactly H-A-R-R-Y-K. Constraints: preserve the radio, antenna, knobs, screen, keypad, casing wear, microphone, cable, lighting, colors, camera angle, composition, proportions, silhouette and pixel dimensions as faithfully as possible. Keep genuine alpha transparency everywhere outside the prop. Do not add a table or any other object in this asset. No background, no glow, no frame, no watermark, no other text. Change only the label.

### Izometrický stolek

> Use case: stylized-concept. Asset type: production transparent PNG prop for an existing isometric 3D classroom scene. Primary request: one compact empty classroom demonstration table / teacher's side table, shown in orthographic isometric three-quarter view from slightly above. The tabletop must be visibly deep and angled in true isometric perspective so a radio can later be composited standing on its right half. Style/medium: premium friendly stylized realistic 3D game render, tactile materials, matching a military classroom: worn olive-green painted metal frame and legs, warm medium-brown laminated wood tabletop with subtly scuffed edges. Composition: entire table fully visible and centered, generous transparent padding, tabletop broad and unobstructed, no chair. Lighting/mood: soft warm studio lighting from upper left, understated contact shadow only directly beneath the feet. Constraints: genuine alpha-transparent background; no objects on the table; no radio; no characters; no text; no labels; no wall or room; no floor plane; no frame; no watermark. Crisp readable silhouette at small game-prop size.

## Krizová scéna: průhledné výřezy a vrstvený PM

Aktuální vykreslení vojáků používá `assets/soldiers-cutout.png` (971 × 1620, RGBA) a tělo PM používá vyčištěnou variantu `assets/pm-cutout-clean.png` (1536 × 1024, RGBA). Zdrojové atlasy vytvořil vestavěný `image_gen.imagegen`; původní soubory zůstávají zachované.

Generované PNG soubory PM obsahovaly mimo siluety množství velmi slabě průhledných pixelů původního pozadí. Produkční varianty `pm-cutout-clean.png`, `pm-photo-head-clean.png` a `pm-photo-expressions-clean.png` proto zachovávají původní RGB pixely a souřadnice, ale normalizují pouze alfa kanál: zbytky pozadí jsou plně průhledné, vnitřek postav plně neprůhledný a úzký přechod na hranách zůstává vyhlazený. Tím nevzniká obdélníkový závoj ani odlišná textura v místě, kde CSS odřezává původní kreslenou hlavu.

Postavy se už nevykreslují s `mix-blend-mode: multiply`. SVG filtr normalizuje alfa kanál: prázdné pozadí zůstává průhledné, vnitřek postav je plně neprůhledný a hrany zůstávají vyhlazené. Atlas vojáků má nepravidelné rozestupy, proto `soldierSprite` v `c2-presentation.js` používá hranice řad 0, 324, 644, 950, 1264 a 1620 px a explicitní SVG ořez každé řady. Osmiprocentní vnitřní okraj chrání vlasy, ruce a boty před oříznutím. Explicitní ořez brání i zobrazení bot sousední řady v prázdném okraji.

Manažer v režimu Zachraň reputaci používá původních šest póz těla, existující fotografický atlas mimiky a samostatnou horní vrstvu. Vrstva ruky při facepalmu je přesný CSS polygonový výřez z téhož políčka `pm-cutout.png`, nikoli nově překreslená ruka. Překrývá tělo i fotografickou hlavu; při kontaktu ruky s čelem je pohyb hlavy vypnutý. Obdobně se v nervózní póze před tváří vykreslují ruce s tabletem. Původní kreslená hlava je pod fotografií odstraněna úzkou, ostře ohraničenou eliptickou maskou. Celý výřez zůstává schovaný pod neprůhlednou částí fotografie a končí nad límcem, takže nevzniká světlý kruh a tělo si zachovává krk, klíční kosti i košili. Spodní lišta si ponechává pevné tělo a sdílí výraz s krizovou scénou. Pauza i omezení animací platí pro oba avatary.

Ověřeno všech 15 póz vojáků a všech 6 póz PM, včetně ruky nad obličejem; šest zákaznických otázek na 1920 × 940, 1366 × 640, 1280 × 600, 1024 × 668, 768 × 1024 a 390 × 844 bez oříznutí mluvící bubliny. Vojáci mají `opacity: 1` a normální skládání barev. Použité prompty:

### Vojáci — transparentní atlas

> Edit target: the supplied game sprite atlas of three Czech soldiers in five poses. Use case background-extraction and precise-object-edit. Produce a production RGBA PNG with a strict THREE columns by FIVE rows of equal SQUARE cells, portrait overall aspect ratio 3:5. Keep all fifteen original characters, outfits, faces, props, identities and emotions: columns commander/male with moustache, adult female with long straight hair, male signals specialist with glasses; rows neutral, approval, facepalm, shock, despair. Fix spacing: every COMPLETE character including all hair, raised hands and boots must be strictly inside its own cell, centered horizontally, feet on same baseline 90% down each cell, with at least 7% cell height EMPTY transparent margin above the highest hair/hand and 7% below boots. No sprite may overlap a cell boundary. Preserve each original pose, no missing or additional people. Remove the white background completely using genuine alpha transparency. All skin, faces, hair, fabric, boots, glasses frames and hands must be solid OPAQUE, no translucent characters, no floor showing through them. Alpha zero outside silhouettes, antialias only the narrow silhouette edges. No floor shadows, no glow, no grid lines, no captions. Preserve source appearance faithfully, do not change outfits or face expressions. The goal is clean opaque cutouts with consistent safe grid geometry for CSS animation.

### PM — transparentní těla

> Use case background-extraction. Edit target is this 1536x1024 THREE-column TWO-row project-manager sprite atlas. Keep its exact canvas dimensions, all six original characters, pose coordinates, size, clothing, heads, hands, tablet and shoes UNCHANGED. Only remove the entire white background and all floor/contact shadows, producing actual RGBA transparency (alpha zero outside silhouettes). Inside each person, all skin, shirt fabric, pants, tablet and hair must be fully opaque, alpha 255. Preserve white highlights in the clothing, do not make highlights transparent. Retain the raised hand and forearm on the forehead of the top-right facepalm pose exactly at its original location. No redesign, no new poses, no movement/recentering, no added margins, no text, no checkerboard pixels. This is an exact-coordinate cutout atlas for layering a replacement face beneath the existing hand.

## Fotografická tvář PM ve spodní liště

Zdroj: fotografie `1658392827731.jpg` dodaná uživatelem. Použit vestavěný `image_gen.imagegen`, nikoli CLI/API fallback. Výsledná PNG byla zkopírována do projektu bez změny pixelů. Ověřen RGBA formát a nulová alfa v pozadí. Barevné hodnoty ve zcela průhledných pixelech atlasu se ve hře nezobrazují.

- `assets/pm-photo-head-clean.png`: 1254 × 1254, produkční samostatná hlava s původním úsměvem; bez košile, pozadí a zbytkového alfa závoje.
- `assets/pm-photo-expressions-clean.png`: 1536 × 1024, produkční atlas šesti výrazů 3 × 2 s vyčištěnou alfou. Jde o generované varianty výrazu, nikoli o další skutečné fotografie.

CSS skládá hlavu na první pózu původního těla. Původní kreslená hlava těla je odříznuta pomocí `clip-path`; průhledná fotografická hlava se pohybuje samostatně. Nahrazen je pouze avatar ve spodní liště. Výrazy spouštějí chyby, opravy a průběžné hlášky; pohyby zastaví pauza i omezení animací. Následují použité prompty.

### Výřez hlavy

> Use case: background-extraction / identity-preserve. Edit target: the attached portrait photograph. Produce ONE production PNG game asset: a precisely isolated cutout of this exact man's HEAD only, including all hair, glasses, both ears, beard, chin and a very short neck stump. Remove the entire room background and ALL shirt, shoulders and torso. Preserve the man's real photographic identity, actual photographed smiling expression, black rectangular glasses, hair, beard and skin texture faithfully. Do not turn him into a cartoon or beautify/reinvent him. Straighten the modest head tilt slightly so the chin is centered under the forehead. Center the entire head in a square canvas, occupying about 85% of canvas height, leaving clean transparent padding all around. Genuine alpha-transparent background, no white background, no checkerboard pixels, no outlines, no shadow, no text. Clean antialiased edges around hair, ears and beard. This head will be attached to a small comedic game character body.

### Atlas výrazů

> Use case: identity-preserve. Asset type: ONE transparent PNG facial-expression sprite atlas for a comedy game. Reference: the exact photographic head cutout attached. Preserve this same recognizable real man's photographic face, black rectangular eyeglasses, short dark hair, ginger-brown short beard, skin tone and proportions. Create a strict THREE columns by TWO rows sheet, 1536x1024 if possible, six equal SQUARE cells. Each cell contains only his entire isolated head, hair, ears, beard, tiny neck stump, no body, no shoulders, no hands. Frontal consistent angle, same head center and scale in all six cells. The full head height is 85% of each cell, with safe transparent margins on every side. EXACT expressions in reading order: top-left friendly confident smile matching reference; top-middle comic nervous forced toothy grin with worried raised eyebrows and one subtle sweat bead; top-right shocked wide eyes and rounded open mouth as software crashes; bottom-left comic embarrassed eye-roll with lips pursed; bottom-middle suspicious sideways eye glance and sly tight-lipped half-smile; bottom-right delighted relieved laugh, eyes softly narrowed. These are humorous variations of the SAME photo-real face, not drawn or 3D cartoon substitutes. No changes to glasses design. All six heads separate and completely inside their equal cells, carefully aligned for instant frame swapping. Genuine alpha transparency everywhere outside head silhouettes. No solid backdrop, no checkerboard pixels, no text, no frame lines, no shadows, no props.

### Finální úprava atlasu

> Use case: background-extraction. Edit the provided 3x2 six-head sprite atlas. Keep ALL six faces and their expressions, positions, sizes, photographic details, glasses, hair, beard and the exact 1536x1024 canvas/grid UNCHANGED. Remove the entire cloudy brown/black/pink backdrop AND every glow/halo/shadow around each head. Output six precisely cut-out heads on actual alpha transparency, alpha ZERO in every pixel outside the head silhouettes. The heads themselves should be fully opaque. Do not use semi-transparent shaded background, checkerboard, black, white or any backdrop. Only antialias the immediate hair/skin silhouette edge. Preserve six clean disconnected head cutouts with clear transparent gaps between them. No other edits, no text.

## C2 / AČR — aktuální zákazníci

Soubor `assets/soldiers-poses.png` vznikl vestavěným `image_gen.imagegen`, s původním atlasem jako stylovou referencí. Byl zkopírován do projektu beze změny pixelů. Rozložení 3 sloupce × 5 řad: velitel, mladá dospělá operátorka C2 s dlouhými rovnými vlasy, spojař; řady: neutrální, souhlas, facepalm, úděs, zhroucení. Vykreslení a kombinování řídí `c2.css` a `c2-presentation.js`. PM a jeho grafika zůstávají původní.

Finální prompt:

```text
Use case: stylized-concept. Asset type: production sprite atlas for an existing humorous Czech 3D game.
Reference image: use ONLY its premium friendly clay animated film rendering style, proportions and tactile materials. Replace its civilian characters with THREE ADULT CZECH ARMY SOLDIERS. No goblin. Do not include the civilian project manager.
Create a portrait 1536 x 2560 image, STRICT THREE COLUMNS AND FIVE ROWS, 15 equally spaced full body sprites in 512 x 512 square cells. Each body entirely inside its own cell, head-to-boots with generous white margins. The exact same three characters repeat in their columns in every row:
COLUMN 1: stout middle aged Czech army commander, short receding brown hair, brown moustache, expressive face.
COLUMN 2: clearly ADULT young woman soldier age 24, LONG STRAIGHT dark brown hair worn loose below shoulders, visible in ALL FIVE poses, NOT curly, NOT tied up, warm expressive face.
COLUMN 3: slim adult male army signals specialist age 28, short neat brown hair, round glasses.
All wear matching Czech woodland camouflage field jackets and trousers in green/brown/black, brown combat boots, a small Czech flag patch on upper sleeve (blue triangle, white upper stripe, red lower stripe). No helmets, no weapons. Consistent identity and outfit from row to row.
ROW 1: attentive neutral listening, each relaxed but different: commander hands behind back; woman one hand on belt; specialist arms at sides.
ROW 2: cheerful approval, commander broad amused grin clapping at chest height; woman smiling thumbs up with one hand; specialist delighted modest clapping to the side. Different silhouettes.
ROW 3: comic exasperated FACEPALM. Commander palm covers eyes and other hand on hip; woman right palm on forehead eyes closed other arm hanging; specialist pinches bridge of nose and folds other arm. Not mirrored copies.
ROW 4: comic SHOCK AND DREAD. Commander recoils backwards mouth open, palms outward; woman both hands at cheeks and eyes wide; specialist pulls at his collar and raises one eyebrow in horror. Distinct silhouettes.
ROW 5: comic DESPAIR / WILTING. Commander bent forward hands on knees in disbelief; woman slumps shoulders and covers lower face with one hand while looking upward; specialist squats with elbows on knees and holds his head. ALL remain fully inside their cells.
Orthographic three quarter view, slightly from above, readable large faces. Entire background perfectly solid pure white #FFFFFF, no gradient, no grid, no text, no captions, no scenery, no floor or shadow outside characters. Equal cell geometry is critical for CSS background positioning. Make ALL 15 sprites, exactly 3 columns and 5 rows.
```

## Původní grafika

Použit byl vestavěný nástroj `image_gen.imagegen`, nikoli API/CLI fallback. Finální textury jsou součástí projektu a nejsou načítané z externí služby.

Finální soubory:

- `C:/Users/Radovan/source/repos/Codex/Bugisek/assets/characters-white.png` — atlas 4 × 3, neutrální postavy, potlesk, facepalm. Hra používá tři lidské zákazníky; skřítek z původního konceptu není prezentujícím PM.
- `C:/Users/Radovan/source/repos/Codex/Bugisek/assets/pm-poses.png` — atlas 3 × 2, projektový manažer v košili bez saka. Prezentace, nervozita, facepalm, vysvětlování, restart za zády, úleva.
- `C:/Users/Radovan/source/repos/Codex/Bugisek/assets/desk-texture.png` — textura stolu a podlahy.

Atlas zákazníků vznikl z původního generování a následné úpravy pozadí. Pokus o průhledné pozadí nezachoval požadovaný výsledek; vybranou finální verzí je bílé pozadí, které se ve hře prolíná pomocí CSS. Obrázky nebyly programově překreslovány.

## Zákazníci — původní prompt

> Use case: stylized-concept. Asset type: production game character sprite atlas for a humorous Czech tablet game called Skřítek Bugísek. Create a single 1536x1024 landscape image with a strict 4-column by 3-row grid, exactly 12 evenly spaced full-body character sprites, every sprite centered in its own equal 384x341 cell, consistent character scale, ample transparent margin. Transparent background, no visible grid, no text, no captions. Stylized 3D clay animated movie look with realistic tactile fabric, warm light, subtle feet shadows, orthographic isometric three-quarter view. Column 1: mischievous tiny green software goblin with large ears, orange knit beanie, cream hoodie and dark overalls. Column 2: female dispatcher with curly dark hair, teal sweater and tan trousers. Column 3: middle-aged moustached male manager in pale shirt, rust tie and brown trousers. Column 4: young male IT technician, round glasses, mustard hoodie, dark trousers. Row 1 all four standing curious/neutral with open visible faces. Row 2 same four characters joyfully clapping, beaming, celebratory poses. Row 3 same four characters doing exaggerated comic facepalm with one hand at forehead, exasperated body language. Each character complete head to feet, never cropped, no objects held. High-end friendly game art, crisp silhouettes, consistent outfits between rows. Arrange the grid precisely for direct CSS sprite-sheet use.

## Zákazníci — finální úprava

Vstup: původní atlas postav; editace vestavěným imagegenem.

> Change the backdrop completely. The entire background MUST be solid, completely flat pure white #FFFFFF, like isolated e-commerce product photos. Remove ALL brown, grey, gold gradients, halos, lights, shadows and any studio backdrop. White background in every pixel that is not a character. Keep the original twelve full-body characters in a precise four columns by three rows sprite sheet. Do NOT keep any aspect of the current backdrop. This output will be used with CSS multiply blending on a pale green floor, so the backdrop must be pure uniform white. Preserve the same funny goblin and 3 human characters with their neutral, clapping and facepalm poses, consistent clothes and scale. Dimensions 1536 by 1024.

## Projektový manažer — finální prompt

> Use case: stylized-concept. Asset type: production 3D game character sprite sheet on a completely solid pure white #FFFFFF backdrop (no gradients, no floor, no shadows outside characters). Strict 3-column by 2-row grid, 6 full-body sprites, evenly spaced centered in equal square cells. Image dimensions 1536x1024. Same single character in every cell: slightly chubby young adult Czech project manager, short brown hair, stubble, expressive face, PALE BLUE rolled-sleeve button-down SHIRT, NO JACKET, NO BLAZER, no suit, no tie, dark tan chinos, casual brown shoes. He holds a dark tablet. Isometric orthographic view from slightly above, three-quarter view. Premium humorous 3D animated movie art with realistic fabric and skin, warm natural colors, exaggerated readable funny emotions. Top row left: confidently presenting tablet; top row middle: sweating profusely and smiling nervously while hiding the tablet screen; top row right: hand on forehead, mortified by a software crash. Bottom row left: explaining with raised finger and theatrical reassuring grin while holding tablet low; bottom row middle: subtly tapping tablet behind his back, sneaky sideways look; bottom row right: relieved delighted thumbs-up with tablet tucked under arm. Preserve outfit and proportions exactly throughout all poses. Whole body contained in each cell with generous white margins. Absolutely flat white background everywhere outside sprites, no text or labels.

## Materiál stolu a podlahy — finální prompt

> Use case: stylized-concept. Asset type: seamless material texture for a humorous stylized realistic 3D tablet game. Create a completely flat top-down orthographic scan of pale desaturated sage green and warm cream desktop linoleum, delicately tactile, soft paper fibers and very subtle speckles. Entire image is just one uninterrupted uniform material surface, no objects, no characters, no furniture, no text, no shadows, no scene, no vignetting, no perspective. Low contrast, light pale pastel sage beige (#e2e5d3), fine elegant natural grain visible at full resolution. Square 1024x1024. Tileable edges. High quality game background texture that can also be used as an isometric office floor.
