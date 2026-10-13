# Three-Point Seat Belt

An interactive isometric figure of a three-point seat belt in a 56 km/h frontal sled test, built with the [Anatomy](https://github.com/wheresryan22/anatomy) skill.

- **Fig 1** shows the full belt path on a crash sled: retractor at the foot of the B-pillar, webbing guide, D-ring on its height adjuster, shoulder and chest run, latch plate and buckle, lap run and the anchor on the sill. A dummy rides the pulse and a string pot measures chest travel.
- **Fig 2** takes the same retractor onto a test bench, where a motor-driven pull drum plays the occupant. It runs one full cycle: pull out, let go, a sudden jerk, hard braking and stow. You see the flat spiral rewind spring wind and unwind in its cassette (cover cut away), the wound roll shrink and grow, the flyweight swing out for the webbing-sensitive lock, and the ball roll up its cone for the vehicle-sensitive lock. Buttons under the figure jump to each step.

Each figure has its own clock. Drag across a figure to scrub, use the arrow keys (Shift for bigger steps), or press Space to play and pause. With reduced motion on, Fig 1 holds still at peak belt load and Fig 2 holds on the webbing lock.

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

### The retractor (`retractor.mjs`)

| Input | Value |
|---|---|
| Webbing | 1.1 mm thick, 2000 mm stored on an 11 mm core (28.7 mm roll radius stowed) |
| Rewind spring | torque 0.0574 N·m stowed, rising 0.0015 N·m per radian wound |
| Webbing-sensitive lock | flyweight trips above 1.5 g of webbing acceleration, seats the pawl in 12 ms |
| Vehicle-sensitive lock | ball trips at 0.45 g, seats the pawl in 9 ms; braking pulse 0.8 g |
| Release | the pawl drops once the load is gone and the spring winds back 3 mm |

The spool turns theta = (2 pi / t)(r0 - r) as webbing pays out, so the rewind pull F = M / r rises for two reasons: the spring winds tighter and the roll gets smaller. Results: 2.0 N stowed, 3.4 N on a buckled occupant (520 mm out), 3.7 N at 600 mm out; a 3 g yank locks after 2.2 mm and 0.8 g braking after 1.2 mm. Real retractors usually put the spring cassette on the other end of the spool; the figure draws it on the lock end so both show.

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

- `model.mjs`: the crash and restraint model (Fig 1)
- `retractor.mjs`: the retractor's spring, roll and lock model (Fig 2)
- `build.mjs`: geometry, painter's order, card text and the live script
- `kit/`: the Anatomy kit (MIT, see `kit/LICENSE`)
- `scripts/`: inline, capture and line-check helpers from Anatomy

## License

MIT. The kit in `kit/` and the helpers in `scripts/` are from Anatomy by wheresryan22, under its MIT license.
