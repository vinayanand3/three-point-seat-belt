// The retractor on its own: rewind spring, wound roll, and both locks.
// Pure model. Fig 2 shows only numbers that come from here.
//
// Wound roll: webbing 1.1 mm thick, 2000 mm stored, on an 11 mm core, so the roll is 28.7 mm in radius when stowed.
// Paying out length p shrinks the roll: r(p)^2 = r0^2 - t*p/pi, and the spool turns theta(p) = (2*pi/t)*(r0 - r(p)).
// Rewind spring: a flat spiral (clock) spring. Its torque rises linearly with the turns it is wound: M = M0 + k*theta.
// The webbing pulls back with F = M / r: the roll gets smaller as webbing comes out, so the pull rises for two reasons.

export const WEB = { t: 1.1, stored: 2000, core: 11 };          // mm
export const SPRING = { M0: 0.0574, k: 0.0015 };                 // N·m, N·m/rad: 2.0 N stowed
export const WEBBING_LOCK = { g: 1.5, swing: 12 };               // webbing acceleration that swings the flyweight out (g); ms for the flyweight to swing out and seat the pawl
export const VEHICLE_LOCK = { g: 0.45, travel: 9 };              // ball trips at 0.45 g, pawl seats 9 ms later
export const UNLOCK = { back: 3 };                               // mm of rewind that frees the pawl once the load is gone
export const BRAKE_G = 0.8;                                      // hard braking, for the vehicle-sensitive lock
const G0 = 9806.65;                                              // mm/s^2

const R0 = Math.sqrt(WEB.core ** 2 + (WEB.t * WEB.stored) / Math.PI);
export const rollRadius = (p) => Math.sqrt(Math.max(WEB.core ** 2, R0 ** 2 - (WEB.t * p) / Math.PI));
export const spoolTurn = (p) => ((2 * Math.PI) / WEB.t) * (R0 - rollRadius(p));
export const springForce = (p) => (SPRING.M0 + SPRING.k * spoolTurn(p)) / (rollRadius(p) / 1000);
export const STOWED_R = R0;

const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// The script, in display seconds. `slow` is how many times slower than real time a segment is shown.
export const SEGMENTS = [
  { id: "stowed", name: "Stowed", from: 0, to: 0.7, slow: 1 },
  { id: "pull", name: "Pull out", from: 0.7, to: 2.3, slow: 1 },
  { id: "letgo", name: "Let go", from: 2.3, to: 3.0, slow: 1 },
  { id: "worn", name: "Buckled", from: 3.0, to: 3.6, slow: 1 },
  { id: "jerk", name: "Jerk", from: 3.6, to: 5.4, slow: 15 },
  { id: "release", name: "Release", from: 5.4, to: 6.3, slow: 1 },
  { id: "brake", name: "Brake", from: 6.3, to: 8.5, slow: 10 },
  { id: "release", name: "Release", from: 8.5, to: 9.4, slow: 1 },
  { id: "stow", name: "Stow", from: 9.4, to: 11.2, slow: 1 },
  { id: "rest", name: "Stowed", from: 11.2, to: 12.0, slow: 1 },
];
export const LENGTH = SEGMENTS[SEGMENTS.length - 1].to;
export const WORN = 520, OUT = 600, DIP = 6;

// What the occupant, or the hand, asks for: webbing out (mm) at real time ms inside a segment.
function wanted(id, ms, realLength) {
  switch (id) {
    case "stowed": case "rest": return 0;
    case "pull": return OUT * smooth(ms / realLength);
    case "letgo": return OUT - (OUT - WORN) * smooth(ms / realLength);
    case "worn": case "brake": return WORN;
    case "jerk": {
      // a yank at 3 g of webbing acceleration for 40 ms, then held where the lock stopped it
      const a = (3 * G0) / 1e6;                                    // mm/ms^2
      const tt = Math.min(ms, 40);
      return WORN + 0.5 * a * tt * tt;
    }
    // the pull goes away, the spring winds back a few millimetres of slack, then the occupant settles
    case "release": return WORN - DIP * Math.sin(Math.PI * smooth(ms / realLength));
    case "stow": return WORN * (1 - smooth(ms / realLength));
    default: return 0;
  }
}

export const brakeG = (ms) => (ms < 0 ? 0 : ms < 60 ? BRAKE_G * smooth(ms / 60) : ms < 150 ? BRAKE_G : ms < 190 ? BRAKE_G * (1 - smooth((ms - 150) / 40)) : 0);

export function simulate(stepS = 0.002) {
  const rows = [];
  let p = 0, fly = 0, ball = 0, locked = false, holdAt = 0;
  let segId = null, w1 = 0, w2 = 0, lean = 0, leanV = 0, flyOn = false;
  for (let i = 0; i * stepS <= LENGTH + 1e-9; i++) {
    const t = i * stepS;
    const seg = SEGMENTS.find((s) => t >= s.from && t < s.to) || SEGMENTS[SEGMENTS.length - 1];
    const realLength = ((seg.to - seg.from) / seg.slow) * 1000;
    const ms = ((t - seg.from) / seg.slow) * 1000;
    const dt = (stepS / seg.slow) * 1000;                          // real ms per step
    let want = wanted(seg.id, ms, realLength);
    let sled = 0;
    if (seg.id === "brake") {
      sled = brakeG(ms);
      // the occupant leans into the belt; until the belt holds, the webbing follows the chest
      const acc = (sled * G0) / 1e6;
      leanV += acc * dt; lean += leanV * dt;
      if (locked) { leanV = 0; lean = Math.min(lean, holdAt - WORN); }
      want += lean;
    } else { lean = 0; leanV = 0; }
    if (seg !== segId) { segId = seg; w1 = want; w2 = want; }
    const webG = Math.max(0, (((want - 2 * w1 + w2) / (dt * dt)) * 1e6) / G0);
    w2 = w1; w1 = want;

    // webbing-sensitive: the flyweight lags the spool when the webbing accelerates out faster than 1.5 g
    if (webG > WEBBING_LOCK.g && want > p) flyOn = true;
    // vehicle-sensitive: the ball rolls up its cone once the car decelerates past 0.45 g
    const ballOn = sled >= VEHICLE_LOCK.g || (ball > 0 && sled > 0.2);
    fly = Math.min(1, Math.max(0, fly + (flyOn ? 1 : -1) * (dt / WEBBING_LOCK.swing)));
    ball = Math.min(1, Math.max(0, ball + (ballOn ? 1 : -1) * (dt / VEHICLE_LOCK.travel)));
    if (!locked && (fly >= 1 || ball >= 1)) { locked = true; holdAt = p; }
    const pawl = locked ? 1 : Math.max(fly, ball);

    // the spool: free, it follows what is asked; locked, it cannot pay out more
    const next = locked ? Math.min(want, holdAt) : want;
    // once the pull is gone and the spring has wound back a few mm, the pawl drops out
    if (locked && want < holdAt - UNLOCK.back && !ballOn) { locked = false; flyOn = false; }
    if (!locked && seg.id === "release") flyOn = false;
    if (seg.id !== "jerk") flyOn = false;
    p = next;
    const held = locked && want > p + 0.05;
    rows.push({ t, seg: seg.id, ms, p, F: springForce(p), r: rollRadius(p), turn: spoolTurn(p), fly, pawl, ball, locked, held, sled, webG, slow: seg.slow });
  }
  return rows;
}
