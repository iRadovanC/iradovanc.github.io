# Zdroje a licence

## Voják a základní animace

- Soubor: `assets/soldier.glb`.
- Zdroj: [Soldier.glb, oficiální repozitář Three.js, tag r180](https://github.com/mrdoob/three.js/blob/r180/examples/models/gltf/Soldier.glb).
- [Původní ukázka skeletální animace](https://threejs.org/examples/webgl_animation_skinning_blending.html) uvádí Mixamo jako zdroj modelu.
- Model Vanguard a klipy Idle, Walk, Run a TPose jsou použity jako vložený asset hry. [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) uvádí bezplatné použití postav a animací v osobních i komerčních videohrách. Nejde o CC0 model. Tato hra nepřevádí model ani animace pod jinou licenci; neposkytujte je samostatně jako knihovnu assetů.
- Procedurální IK, klek, přebití a herní puška jsou vytvořeny pro tento projekt.

## PBR textury

- [Forest Ground 04](https://polyhaven.com/a/forest_ground_04) — Rob Tuytel, Rico Cilliers; Poly Haven, **CC0**.
- [Asphalt 02](https://polyhaven.com/a/asphalt_02) — Rob Tuytel; Poly Haven, **CC0**.
- Použité lokální JPEG soubory jsou difuzní, OpenGL normálové a roughness mapy v rozlišení 1K. Jsou vloženy do sestaveného JavaScriptu.
- [Licence Poly Haven](https://polyhaven.com/license).

## Knihovny a ostatní obsah

- **Three.js 0.180.0**, copyright Three.js authors, licence MIT. Úplné znění je v `licenses/THREE-LICENSE.txt` a zachované licenční komentáře jsou také v sestaveném kódu.
- **esbuild 0.25.10**, licence MIT, používá se pouze při vývoji pro bundlování. Není potřeba pro spuštění hry.
- Vegetace, polygon, puška, terče, rozhraní, ikony a zvukové efekty jsou vytvořené lokálně pro tento projekt. Žádná online zvuková služba, fontová služba, CDN ani analytika se při hraní nepoužívá.

Assety staženy 20. září 2026.

## Mise 02 — Bagdád / Tichý proud

Nové assety stažené 21. září 2026 z **Poly Haven**, všechny pod **CC0 1.0 Universal**:

| Asset | Autor | Použití |
| --- | --- | --- |
| [Wooden Military Crate](https://polyhaven.com/a/wooden_military_crate) | Prabhjinder Singh | Fototexturované 3D muniční bedny a rekvizity ve dvorech |
| [Power Box 01](https://polyhaven.com/a/power_box_01) | Rico Cilliers (model a textury), Yann Kervran (rig) | Rozvaděč záložního napájení kliniky |
| [Plastered Wall 05](https://polyhaven.com/a/plastered_wall_05) | Charlotte Baglioni | Omítka domů a beton; barevně zesvětlená materiálem hry |
| [Sandstone Blocks 05](https://polyhaven.com/a/sandstone_blocks_05) | Rob Tuytel | Zdivo, sokly a obvodové zdi |

[Licenční prohlášení Poly Haven](https://polyhaven.com/license) · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Powered by Poly Haven — metadata a soubory byly získány přes veřejné API. Hra za běhu API nepoužívá.

Modely jsou uloženy jako glTF s původní geometrií a PBR mapami v `assets/models/`. Použité textury mají rozlišení 1K. Sestavení vloží všechny obrázky a buffery do výsledné offline hry. `assets/baghdad-manifest.json` uvádí konkrétní URL, autory a MD5 kontrolní součty stažených souborů; `scripts/download-baghdad-assets.ps1` stažení reprodukuje a ověřuje.

Domy, balkony, výlohy, okenice, antény, nádrže, elektroinstalace, palmy, vozidla, klinika, rádio, generátor a zdravotnické brašny jsou vlastní geometrie vytvořená pro hru. Modely nepřátel používají výše uvedený existující Mixamo Soldier s vlastními barevnými úpravami, animací zbraně a AI. Městský blok a mise jsou fiktivní, inspirované Bagdádem; nejde o geografickou rekonstrukci konkrétní čtvrti.
