# Three-Point Seat Belt

An interactive isometric figure of a three-point seat belt in a 56 km/h frontal sled test, built with the [Anatomy](https://github.com/wheresryan22/anatomy) skill.

- **Fig 1** shows the full belt path on a crash sled: retractor at the foot of the B-pillar, webbing guide, D-ring on its height adjuster, shoulder and chest run, latch plate and buckle, lap run and the anchor on the sill. A dummy rides the pulse and a string pot measures chest travel.
- **Fig 2** shows the same retractor up close: the spool, the 16-tooth ratchet, the pawl and the vehicle-sensitive ball sensor that locks it.

Both figures run on one clock. Drag across either figure to scrub through the crash, use the arrow keys (Shift for 10 ms steps), or press Space to play and pause. With reduced motion on, the figure holds still at peak belt load.

## The model

Every number the figures show comes from `model.mjs`, a small spring-damper model:

| Input | Value |
|---|---|
| Sled pulse | 25 g half-sine over 100 ms (delta-v 56 km/h) |
| Sensor ball trips | 0.45 g |
| Pawl travel to lock | 9 ms |
| Upper body on the shoulder belt | 30 kg, 60 kN/m, damping ratio 0.3, 20 mm slack |
| Pelvis on the lap belt | 25 kg, 90 kN/m, damping ratio 0.35, 10 mm slack |
| Seatback contact | 150 kN/m, 4 kN·s/m |

Results: the spool locks at 9.6 ms after 1.1 mm of free payout; the shoulder belt peaks at 10.3 kN near 70 ms, the lap belt at 8.2 kN, and the chest travels 178 mm. The model has no pretensioner, no torsion-bar load limiter and no webbing-sensitive clutch, and it moves the dummy's chest and pelvis as two translating blocks.

## Build

Needs Node.js 20.10 or later.

```sh
node build.mjs          # writes seat-belt.html (dark)
node build.mjs --light  # writes seat-belt-light.html
```

Optional checks with headless Chrome (set `CHROME_PATH`):

```sh
node scripts/capture.mjs seat-belt.html --out shot.png
node scripts/lines.mjs seat-belt.html
```

## Files

- `model.mjs`: the crash and restraint model
- `build.mjs`: geometry, painter's order, card text and the live script
- `kit/`: the Anatomy kit (MIT, see `kit/LICENSE`)
- `scripts/`: inline, capture and line-check helpers from Anatomy

## License

MIT. The kit in `kit/` and the helpers in `scripts/` are from Anatomy by wheresryan22, under its MIT license.
