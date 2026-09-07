# Grafické podklady

Vytvořeno vestavěným ImageGen, 5. září 2026. Lokální soubory `outpost.png`, `rifle.png` a `operative.png`; hra je načítá bez internetového připojení. Zbraň a protivník používají PNG s alfa kanálem. Žádné cizí značky nebo převzaté herní assety.

## Prompty

### outpost.png

Use case: stylized-concept. Asset type: full-screen background for a stationary first person arcade shooter, no UI. Create a beautiful cinematic game environment of an abandoned desert communications outpost at blue-hour sunset, wide 16:9 landscape, 1536x864 or 2048x1152. Eye-level camera from a fixed defensive position looking down a spacious dusty concrete courtyard towards a distant radio tower and giant satellite dish. Strong warm amber sunset breaks through blue gray haze, muted petrol teal shadows, detailed rough concrete, industrial orange shipping containers flank extreme left and right edges, a few tiny orange practical lights, cables and rooftop aerials. Horizon and distant structures around the upper 35 percent. Broad open unoccupied ground across middle and lower image, large readable open playing area from x15-85 percent and y40-75 percent; only a few low crates near the extreme edges. The lower 25 percent is dark empty ground to place a weapon overlay. Premium hand-painted realistic 3D game concept art with crisp environment architecture, atmospheric perspective, subtle dust, dramatic yet readable lighting. No people, no weapons, no enemies, no text, no numbers, no watermarks, no HUD, no border. This is playable background art, not a screenshot.

### rifle.png

Use case: stylized-concept. Asset type: transparent foreground weapon sprite for a first person 2D shooter game. A beautifully detailed near-future military assault rifle seen from the soldier's OWN eyes, rear three-quarter first person perspective, aiming toward the upper LEFT of the image. Both gloved hands hold the gun correctly, left supporting foregrip, right trigger hand; dark olive combat sleeves extend beyond the bottom edge. Stock and receiver in lower right, barrel tip near 32 percent width and 18 percent height. Large matte graphite steel rifle with worn machined edges, amber small details, ribbed handguard, compact reflex sight with teal tinted glass. Cinematic realistic 3D game render, warm amber rim light from upper left and cool teal fill, very crisp detailed silhouette. Weapon and arms take up most of a square 1024x1024 asset with padding at left, right and top; arms meet bottom edge. Isolated on a GENUINELY TRANSPARENT background with alpha, no backdrop, no ground shadow, no muzzle flash, no particles, no text, no logo, no watermark, no interface. Aim away from viewer, never a side-profile product view.

### operative.png

Use case: stylized-concept. Asset type: enemy character sprite for a first person stationary shooter. Single full-body opposing futuristic infantry soldier, front-facing toward camera, slightly bent combat stance, holding a compact assault rifle at chest level aimed toward viewer, both boots fully visible with margin, centered and completely isolated on genuine TRANSPARENT background with alpha. Military sci-fi but grounded, no faction insignia. Worn olive-gray combat uniform, graphite segmented body armor with crisp shoulder plates, amber identification strips on shoulders, full helmet with a single bright narrow red-orange visor, tactical pouches and knee pads. High-quality realistic 3D game render with warm sunset light on left and cool teal fill on right, sharp silhouette, detailed yet readable when downscaled to 120px tall. Head occupies upper 18 percent, torso middle 40 percent, legs bottom 42 percent. Symmetrical enough for a simple hitbox. Whole figure within central 70 percent of a tall portrait image. No environment, no ground, no shadows outside the figure, no text, no logo, no UI, no muzzle flash. One character only.

Následná úprava pozadí:

Use case: background-extraction. Edit target: the attached infantry soldier sprite. Change ONLY the background. Remove the entire background including black, colored gradients, warm orange haze, blue haze, ground shadow and glow around and between the legs. Replace every background pixel with GENUINE TRANSPARENT ALPHA (not black, not checkerboard). Keep the soldier's exact pose, full body, boots, rifle, colors, size, composition, lighting, and detail unchanged. Crisp cutout silhouette, zero background halo. Output a transparent PNG asset for compositing into a game.

Finální export s alfa kanálem:

Make the background transparent. Return an RGBA PNG cutout with a real alpha channel. The pale checkerboard visible in the input is an unwanted opaque background, not transparency: REMOVE it completely, including between the legs. Isolate only the exact full-body soldier, preserving all details and position, on transparent empty pixels. No checkerboard texture. No white background. No black background. Actual transparent image like a sticker or game sprite.
