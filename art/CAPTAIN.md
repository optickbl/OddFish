# The Captain: replacing the stand-in

`public/models/captain.glb` is a **stand-in**: built procedurally by `art/world.py` and
posed by code in `src/three/captain.ts`. It works, but it isn't character-artist quality.
The game is set up so a proper model can drop straight in.

## Option A (recommended): a rigged model with animation clips

Export a GLB named `captain.glb` into `public/models/` containing clips with these names
(case-insensitive). The game detects them and plays them as-is, with your materials:

| Clip | When it plays | Notes |
| --- | --- | --- |
| `idle` | Home, between moments | Loop. Grumpy at rest: slow blink, tail flick. |
| `thinking` | While a question is open | Loop. Paw to chin, eyes up. |
| `happy` | Clownfish / Octopus catch, decent haul | Loop. A wave or a nod. |
| `excited` | Swordfish / Leviathan, wager armed, great haul | Loop. Arms up. |
| `shocked` | First moment of a Leviathan | Loop, readable in ~1 s. Wide eyes, open mouth. |
| `disappointed` | Old Boot, poor haul | Loop. Ears down, head low. |

Only `idle` is required; any missing mood falls back to it. Clips cross-fade over 0.35 s.

**Scale and placement:** about 1.6 units tall, feet at the origin, facing +Z (glTF/three
convention; in Blender that's facing -Y). The game scales it by 0.5 and seats it at the
stern of the boat. Keep it under ~20k triangles and ~400 KB after gltfpack.

## Option B: a static model using the existing pose code

Keep these node names (each a separate mesh, origins at the pivot) and the code will pose it:
`Head`, `EyeL`, `EyeR` (pivot at the eye centre, around (±0.175, 1.04, 0.37)), `LidL`, `LidR`
(origin at the eye centre; rotation X closes them), `Nose`, `MouthFrown`, `MouthSmile`,
`MouthO`, `Whiskers`, `EarL`, `EarR` (origin at the ear base), `Hat`, `Body`, `Chest`,
`ArmL`, `ArmR` (origin at the shoulder), `Tail` (origin at the base).
Materials named `Fur`, `Coat`, `Hat`, `HatBand`, `Visor`, `Gold`, `CatEye`, `Nose`, `Mouth`,
`Tongue`, `Whisker`, `EarInner` are replaced by the game's own; others are kept.
