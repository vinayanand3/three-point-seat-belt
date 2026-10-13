// Three-point belt in a 56 km/h frontal sled test. Pure model: every number the figure shows comes from here.
export const G0 = 9.81;
export const PULSE = { peak: 25, ms: 100 };          // half-sine sled deceleration, g and ms: dv = 2/pi*25g*0.1s = 15.6 m/s = 56 km/h
export const SENSOR = { trip: 0.45, travel: 9 };       // vehicle-sensitive ball trips at 0.45 g; pawl takes 9 ms to seat in the ratchet
export const CHEST = { m: 30, k: 60000, zeta: 0.3, slack: 0.020 };   // upper body on the shoulder belt: kg, N/m, damping ratio, m of slack + film spool
export const PELVIS = { m: 25, k: 90000, zeta: 0.35, slack: 0.010 }; // pelvis on the lap belt
export const SEAT = { k: 150000, c: 4000 };            // seatback foam: N/m, N·s/m
export const SPOOL_R = 0.022;                          // m, wound webbing radius at the spool
export const END = 180;                                // ms simulated

export const sledG = (ms) => (ms >= 0 && ms <= PULSE.ms ? PULSE.peak * Math.sin((Math.PI * ms) / PULSE.ms) : 0);

export function simulate(stepMs = 0.05) {
  const out = [];
  const body = (p) => ({ ...p, x: 0, v: 0, c: 2 * p.zeta * Math.sqrt(p.k * p.m) });
  const ch = body(CHEST), pv = body(PELVIS);
  let tripAt = null, lockAt = null, payout = 0, dv = 0;
  const dt = stepMs / 1000;
  const force = (b, give) => {
    const stretch = b.x - b.slack - give;
    return stretch > 0 ? b.k * stretch + Math.max(0, b.c * b.v) : 0;
  };
  for (let i = 0; i * stepMs <= END + 1e-9; i++) {
    const ms = i * stepMs;
    const g = sledG(ms);
    if (tripAt === null && g >= SENSOR.trip) tripAt = ms;
    if (lockAt === null && tripAt !== null && ms >= tripAt + SENSOR.travel) lockAt = ms;
    const locked = lockAt !== null;
    // Before the pawl seats, the spool turns freely and pays out whatever webbing the chest pulls.
    if (!locked) payout = Math.max(payout, ch.x);
    const fs = force(ch, payout), fl = force(pv, 0);
    out.push({ ms, g, chest: ch.x, pelvis: pv.x, payout, shoulder: fs, lap: fl, locked, tripped: tripAt !== null && ms >= tripAt, dv });
    // relative motion in the sled frame: the sled slows, the body carries on forward
    for (const [b, f] of [[ch, fs], [pv, fl]]) {
      // the seatback and cushion stop the rebound: a stiff, well damped contact behind x = 0
      const seat = b.x < 0 ? -SEAT.k * b.x - SEAT.c * b.v : 0;
      const a = g * G0 - f / b.m + seat / b.m;
      b.v += a * dt; b.x += b.v * dt;
    }
    dv += g * G0 * dt;
  }
  return { rows: out, tripAt, lockAt };
}
