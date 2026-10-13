// Fig 1: a three-point seat belt on a crash sled. Run `node build.mjs` (add --light for the light theme).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
const { iso } = k;
import * as G from "./kit/lathe.mjs";
import { kitScript } from "./scripts/inline-kit.mjs";
import { simulate, PULSE, SENSOR, CHEST, PELVIS, SPOOL_R, END } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 600;
const HEIGHT = 440;
const MM = 5; // one world unit is 5 mm

// ---------- world layout (x forward, y outboard, z up) ----------
const PLATE = { x: -156, y: -62, w: 250, d: 170, r: 8 };
const PLATE_H = 10, FOOT_H = 5;
const SILL = { x: -148, y: 64, w: 230, d: 34, r: 3 }, SILL_H = 20;
const PILLAR = { x: -94, y: 74, w: 20, d: 18, r: 3 }, PILLAR_TOP = 240;
const RISER = { x: -76, y: -34, w: 96, d: 68, r: 4 }, RISER_H = 30;
const BACK = { x: -76, y: -38, w: 16, d: 76, r: 6 }, BACK_TOP = 178;
const CUSHION = { x: -60, y: -38, w: 86, d: 76, r: 8 }, CUSHION_TOP = 46;
const HEADREST = { x: -76, y: -20, w: 14, d: 40, r: 5 };
const TOE = { x: 24, y: -32, w: 46, d: 64, r: 3 };

const PELVIS_PLAN = { x: -58, y: -22, w: 44, d: 44, r: 7 };
const CHEST_PLAN = { x: -58, y: -24, w: 32, d: 48, r: 7 };
const CHEST_Z = [76, 132];
const SHOULDER = { x: -56, y: -30, w: 26, d: 60, r: 7 };
const HEAD = [-42, 0, 174];
const HEAD_R = 14;

// retractor, bolted to the sill top in front of the pillar; spool axis along y
const SPOOL = [-59, 36];          // x, z of the spool axis
const SPOOL_Y = [74, 90];
const ROLL_R = 6;
const RATCHET_R = 7.6, RATCHET_Y = [92, 93.4], TEETH = 16;
// pawl under the ratchet: it pivots at its left end and its tip rises into the teeth
const PAWL_PIVOT = [-70.4, 28.6];
const PAWL_TIP = [-59 + 6.6 * Math.cos((205 * Math.PI) / 180), 36 + 6.6 * Math.sin((205 * Math.PI) / 180)];
const PAWL_LEN = Math.hypot(PAWL_TIP[0] - PAWL_PIVOT[0], PAWL_TIP[1] - PAWL_PIVOT[1]);
const PAWL_ON = Math.atan2(PAWL_TIP[1] - PAWL_PIVOT[1], PAWL_TIP[0] - PAWL_PIVOT[0]);
const PAWL_OFF = PAWL_ON - (40 * Math.PI) / 180;
const SENSOR_BOX = { x: -71, y: 92, w: 9, d: 8, r: 1 }, SENSOR_TOP = 24.6;
const BALL = [-67.4, 96.2, SENSOR_TOP + 1.5], BALL_R = 1.8;
const BALL_ROLL = [2.4, 0, 1.5];

// D-ring on a height adjuster on the pillar's front face
const DRING = { x: -71, y: 75, w: 2, d: 14, r: 1 }, DRING_Z = [204, 224];
const SLOT_Z = 211;

// buckle on its stalk, inboard of the seat; latch plate in it
const BUCKLE = { x: -38, y: -45, w: 10, d: 10, r: 1.6 }, BUCKLE_Z = [50, 64];
const LATCH = { x: -34.2, y: -44.6, w: 2, d: 9.2, r: 0.8 }, LATCH_Z = [64, 74];
const LAP_ANCHOR = [-30, 78];
const POT = [74, 0];
const POT_Z = 112;

const HW = 48 / MM / 2; // 48 mm webbing

// ---------- truth ----------
const sim = simulate(0.05);
const STEP = 0.5;
const rows = [];
for (let ms = 0; ms <= END + 1e-9; ms += STEP) rows.push(sim.rows[Math.round(ms / 0.05)]);
const series = {
  g: rows.map((r) => +r.g.toFixed(2)),
  chest: rows.map((r) => +(r.chest * 1000).toFixed(1)),
  pelvis: rows.map((r) => +(r.pelvis * 1000).toFixed(1)),
  payout: rows.map((r) => +(r.payout * 1000).toFixed(2)),
  shoulder: rows.map((r) => +(r.shoulder / 1000).toFixed(2)),
  lap: rows.map((r) => +(r.lap / 1000).toFixed(2)),
};
const peakAt = (key) => series[key].reduce((best, v, i) => (v > series[key][best] ? i : best), 0);
const PEAK = { chest: series.chest[peakAt("chest")], shoulder: series.shoulder[peakAt("shoulder")], lap: series.lap[peakAt("lap")], at: peakAt("shoulder") * STEP };

// ---------- camera ----------
let P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PILLAR.x, PILLAR.y, PILLAR_TOP], [PILLAR.x + PILLAR.w, PILLAR.y + PILLAR.d, PILLAR_TOP], [HEAD[0], -24, HEAD[2] + HEAD_R]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 32 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const alongY = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const alongX = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

// ---------- shared live geometry (also shipped to the page with toString) ----------
function webbing(points, normals, hw, P) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const left = [], right = [], midL = [], midR = [];
  let prev = null;
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let w = unit(cross(unit(sub(b, a)), normals[i]));
    if (prev && w[0] * prev[0] + w[1] * prev[1] + w[2] * prev[2] < 0) w = [-w[0], -w[1], -w[2]];
    prev = w;
    const off = (s) => [p[0] + w[0] * hw * s, p[1] + w[1] * hw * s, p[2] + w[2] * hw * s];
    left.push(iso(off(1), P)); right.push(iso(off(-1), P));
    midL.push(iso(off(0.42), P)); midR.push(iso(off(-0.42), P));
  });
  const poly = (pts) => pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("");
  const ring = [...left, ...right.slice().reverse()];
  return { fill: poly(ring) + "Z", weave: poly(midL) + poly(midR), left, right };
}

function beltPath(xc, xp) {
  const shoulder = [
    [-53, 82, 36], [-56, 82, 70], [-68.2, 82, 207], [-68.6, 82, SLOT_Z + 1.4],
    [-34 + xc, 25, 147.4], [-26 + xc, 17, 137], [-25.4 + xc, -12, 86], [-29, -36, 75], [-32.4, -40, 72.4],
  ];
  const shoulderN = [[1, 0, 0], [1, 0, 0], [1, 0, 0], [0.6, 0, 0.8], [0.35, 0, 0.94], [1, 0, 0.1], [1, 0, 0], [0.9, -0.3, 0], [1, 0, 0]];
  const lap = [[-32.4, -40, 71.6], [-24 + xp, -26, 64], [-13.4 + xp, -18, 62], [-13.4 + xp, 18, 62], [-26 + xp, 26, 60], [LAP_ANCHOR[0] - 4, LAP_ANCHOR[1] - 3, 28], [LAP_ANCHOR[0], LAP_ANCHOR[1], 24.6]];
  const lapN = [[1, 0, 0], [0.8, -0.5, 0.2], [1, 0, 0.25], [1, 0, 0.25], [0.7, 0.6, 0.2], [0.3, 0.4, 0.8], [0, 0, 1]];
  return { shoulder, shoulderN, lap, lapN };
}

function ratchetTeeth(turn, cx, cz, r, y, teeth, P) {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = turn + (i / teeth) * Math.PI * 2;
    const a1 = turn + ((i + 0.72) / teeth) * Math.PI * 2;
    pts.push([cx + Math.cos(a0) * (r - 1.4), y, cz + Math.sin(a0) * (r - 1.4)]);
    pts.push([cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r]);
    pts.push([cx + Math.cos(a1 + 0.0001) * (r - 1.4), y, cz + Math.sin(a1 + 0.0001) * (r - 1.4)]);
  }
  return pts.map((p, i) => { const q = iso(p, P); return (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("") + "Z";
}

function pawlShape(angle, pivot, len, y, P) {
  const [px, pz] = pivot;
  const c = Math.cos(angle), s = Math.sin(angle);
  const pt = (u, v) => iso([px + c * u - s * v, y, pz + s * u + c * v], P);
  const outline = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + (i / 12) * Math.PI; outline.push(pt(Math.cos(a) * 1.5, Math.sin(a) * 1.5)); }
  outline.push(pt(len - 1.2, -1.0), pt(len, 0.1), pt(len - 0.9, 0.7));
  const d = outline.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("") + "Z";
  // the ball's pin pushes on the pawl's underside, a third of the way out
  const lift = [px + c * len * 0.36 + s * 1.0, pz + s * len * 0.36 - c * 1.0];
  return { d, lift, liftAt: iso([lift[0], y, lift[1]], P), pin: iso([px, y, pz], P) };
}

// ---------- static art ----------
function sled() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // seat track slots in the sled floor, either side of the riser
  for (const y of [-30, 26]) out.push(L(k.planOutline({ x: -92, y, w: 120, d: 4, r: 2 }, 0, P, 3), { tone: "faint" }));
  // ruler along the inboard edge, 20 mm minor and 100 mm major ticks, zero under the chest front
  const strip = { x: -132, y: PLATE.y + 7, w: 214, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(-26 - 4 * 25, -26 + 4 * 26, 4, 5, strip.y + strip.d - 0.8, 0.6, [-2, -3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([-26, strip.y + strip.d - 0.8], [-26, strip.y + 1.4], 0.6, P), { tone: "hi" }));
  out.push(D([at([strip.x + 2.5, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2.5, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // test label plate
  const plate = { x: 54, y: -46, w: 34, d: 16, r: 1.4 };
  out.push(S(k.slabOf(plate, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([plate.x + 17, plate.y + 6.2], 0.8, P, "x"), "56 KM/H", { size: 3, tone: "mid", anchor: "middle" }));
  out.push(L(k.lineOnTop([plate.x + 6, plate.y + 10], [plate.x + 28, plate.y + 10], 0.8, P) + k.lineOnTop([plate.x + 6, plate.y + 12.4], [plate.x + 20, plate.y + 12.4], 0.8, P), { tone: "lo", free: true }));
  out.push(D([at([plate.x + 2.6, plate.y + 8, 0.8]), at([plate.x + plate.w - 2.6, plate.y + 8, 0.8])], { size: 0.4 }));
  // toe board with a ribbed tread
  out.push(S(k.slabOf(TOE, 0, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(L([0, 1, 2, 3, 4, 5, 6].map((i) => k.lineOnTop([TOE.x + 5 + i * 6, TOE.y], [TOE.x + 5 + i * 6, TOE.y + TOE.d], 4, P)).join(""), { tone: "faint" }));
  return out.join("");
}

function seat() {
  const out = [];
  out.push(S(k.slabOf(RISER, 0, RISER_H, P, 4, 0.6), { tone: "lo", inner: L(k.sideSeam(RISER, 6, P, 4), { tone: "faint" }) }));
  out.push(D([[-70, 34, 22], [-6, 34, 22], [14, 34, 22], [14, 12, 22], [14, -12, 22]].map(([x, y, z]) => at(x === 14 ? [20, y, z] : [x, y, z])), { size: 0.45 }));
  out.push(S(k.slabOf(BACK, RISER_H, BACK_TOP - RISER_H, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(BACK, 96, P, 6), { tone: "faint" }) }));
  for (const y of [-12, 12]) out.push(S(k.cylinder(HEADREST.x + 7, y, 1.5, BACK_TOP, 8, P, 14), { tone: "mid" }));
  out.push(S(k.slabOf(HEADREST, BACK_TOP + 8, 22, P, 6, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(CUSHION, RISER_H, CUSHION_TOP - RISER_H, P, 8, 1.2), { tone: "mid", inner: L(k.sideSeam(CUSHION, 38, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(CUSHION, 6), CUSHION_TOP, P, 6), { tone: "faint" }));
  return out.join("");
}

function buckle() {
  const out = [];
  // the stalk: a short steel cable in a sleeve, from the riser bracket up to the buckle
  out.push(S(k.slabOf({ x: -56, y: -40, w: 10, d: 6, r: 1 }, 18, 8, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([-51, -37, 26])], { size: 0.5 }));
  const stalk = [[-51, -37, 26], [-44, -39, 40], [-33, -40, 50]];
  const st = webbing(stalk, [[0.7, 0.7, 0], [0.7, 0.7, 0], [0.7, 0.7, 0]], 1.5, P);
  out.push(`<g class="iso-solid"><path class="iso-fill" d="${st.fill}"/><path class="iso-shade" data-shade="2" d="${st.fill}"/><path class="iso-line iso-edge" data-tone="mid" d="${st.fill}"/></g>`);
  out.push(S(k.slabOf(BUCKLE, BUCKLE_Z[0], BUCKLE_Z[1] - BUCKLE_Z[0], P, 3, 0.4), { tone: "hi", crease: "lo" }));
  out.push(S(k.slabOf({ x: -28, y: -43, w: 1, d: 6, r: 0.5 }, 57, 4.6, P, 2), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline({ x: BUCKLE.x + 2.6, y: BUCKLE.y + 1.4, w: 4.8, d: 7.2, r: 0.6 }, BUCKLE_Z[1], P, 2), { tone: "lo" }));
  return out.join("");
}

function latch() {
  const out = [];
  out.push(S(k.slabOf(LATCH, LATCH_Z[0], LATCH_Z[1] - LATCH_Z[0], P, 2, 0.3), { tone: "hi", crease: "lo" }));
  out.push(D([at([LATCH.x + LATCH.w, LATCH.y + 1.6, LATCH_Z[0] + 2]), at([LATCH.x + LATCH.w, LATCH.y + LATCH.d - 1.6, LATCH_Z[0] + 2])], { size: 0.4 }));
  return out.join("");
}

function dummyPelvis() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(PELVIS_PLAN, 4), CUSHION_TOP, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(PELVIS_PLAN, CUSHION_TOP, 24, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(PELVIS_PLAN, 58, P, 6), { tone: "faint" }) }));
  // hip joint cover on the outboard side
  out.push(S(G.disc(0, 1.4, 5, alongY(-34, 22, 58), P), { tone: "mid" }));
  out.push(D([at([-34, 23.4, 58])], { size: 0.5, tone: "hi" }));
  // legs: thighs, knee caps, shins, feet; inboard leg first
  for (const y0 of [-20, 4]) {
    const thigh = { x: -26, y: y0, w: 58, d: 16, r: 6 };
    out.push(S(k.slabOf(thigh, 48, 14, P, 6, 0.6), { tone: "mid" }));
    out.push(L(k.lineOnTop([-6, y0], [-6, y0 + 16], 62, P), { tone: "faint" }));
    out.push(S(G.disc(0, 6, 7.4, alongX(32, y0 + 8, 55), P), { tone: "mid" }));
    const shin = { x: 27, y: y0 + 1.5, w: 11, d: 13, r: 4 };
    out.push(S(k.slabOf(shin, 12, 38, P, 5, 0.5), { tone: "mid", inner: L(k.sideSeam(shin, 40, P, 5), { tone: "faint" }) }));
    out.push(S(k.slabOf({ x: 26, y: y0 + 1, w: 24, d: 14, r: 4 }, 4, 8, P, 5, 0.5), { tone: "mid" }));
  }
  return out.join("");
}

function dummyAbdomen() {
  return S(k.slabOf({ x: -56, y: -20, w: 30, d: 40, r: 6 }, 68, 10, P, 6), { tone: "lo" });
}

function dummyChest() {
  const out = [];
  const [z0, z1] = CHEST_Z;
  const ribs = [86, 96, 106, 116].map((z) => L(k.sideSeam(CHEST_PLAN, z, P, 6), { tone: "faint" })).join("");
  out.push(S(k.slabOf(CHEST_PLAN, z0, z1 - z0, P, 6, 0.8), { tone: "mid", inner: ribs }));
  // sternum plate with the string-pot eye
  out.push(S(k.slabOf({ x: -26, y: -6, w: 1.2, d: 12, r: 0.6 }, 100, 22, P, 2), { tone: "mid" }));
  out.push(D([at([-24.8, -4, 102]), at([-24.8, 4, 102]), at([-24.8, -4, 120]), at([-24.8, 4, 120])], { size: 0.4 }));
  out.push(S(k.slabOf(SHOULDER, z1, 14, P, 6, 0.8), { tone: "mid" }));
  out.push(S(G.disc(0, 1.4, 5, alongY(-43, 30, 139), P), { tone: "mid" }));
  out.push(D([at([-43, 31.4, 139])], { size: 0.5, tone: "hi" }));
  // neck: rubber discs on a cable
  out.push(S(k.cylinder(HEAD[0], 0, 6, z1 + 14, 2, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(HEAD[0], 0, 4.6, z1 + 16, 10, P, 24), { tone: "lo", inner: L(k.sideArc(HEAD[0], 0, 4.6, z1 + 19.4, P, 14) + k.sideArc(HEAD[0], 0, 4.6, z1 + 22.6, P, 14), { tone: "faint" }) }));
  out.push(S(G.sphereOf(HEAD, HEAD_R, P), { tone: "mid" }));
  // quadrant photo target on the side of the head
  const F = alongY(HEAD[0], HEAD[1] + HEAD_R, HEAD[2]);
  const tz = G.circleOf(F, 0, 4.2, P, 28);
  out.push(L(tz, { tone: "mid" }) + L(k.segment([HEAD[0] - 4.2, 14, HEAD[2]], [HEAD[0] + 4.2, 14, HEAD[2]], P) + k.segment([HEAD[0], 14, HEAD[2] - 4.2], [HEAD[0], 14, HEAD[2] + 4.2], P), { tone: "lo" }));
  return out.join("");
}

function sill() {
  const out = [];
  out.push(S(k.slabOf(SILL, 0, SILL_H, P, 3, 0.8), { tone: "lo", inner: L(k.sideSeam(SILL, 12, P, 3), { tone: "faint" }) }));
  out.push(D([-130, -110, -10, 10, 30, 50, 70].map((x) => at([x, SILL.y + SILL.d, 16])), { size: 0.4, tone: "lo" }));
  // lap anchor bracket and bolt
  out.push(S(k.slabOf({ x: LAP_ANCHOR[0] - 5, y: LAP_ANCHOR[1] - 5, w: 10, d: 10, r: 1.2 }, SILL_H, 1.4, P, 3, 0.3), { tone: "hi", crease: "lo" }));
  // pillar foot and the pillar itself, cut off at the roof rail
  out.push(S(k.slabOf(k.insetPlan(PILLAR, -3), SILL_H, 2, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf(PILLAR, SILL_H + 2, PILLAR_TOP - SILL_H - 2, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(PILLAR, 120, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PILLAR, 2.4), PILLAR_TOP, P, 3), { tone: "lo" }));
  out.push(D([60, 90, 120, 150, 180, 240].map((z) => at([PILLAR.x + PILLAR.w, PILLAR.y + PILLAR.d - 2, z])), { size: 0.45, tone: "lo" }));
  // height adjuster rail with three detent slots
  out.push(S(k.slabOf({ x: -74, y: 77.5, w: 1.4, d: 9, r: 0.5 }, 188, 48, P, 2), { tone: "mid" }));
  out.push(L([194, 200, 230].map((z) => `M${at([-72.6, 81, z]).join(" ")}L${at([-72.6, 83, z]).join(" ")}L${at([-72.6, 83, z + 2.4]).join(" ")}L${at([-72.6, 81, z + 2.4]).join(" ")}Z`).join(""), { tone: "lo" }));
  return out.join("");
}

function dringPlate() {
  const out = [];
  out.push(S(k.slabOf(DRING, DRING_Z[0], DRING_Z[1] - DRING_Z[0], P, 3, 0.3), { tone: "hi", crease: "lo" }));
  // slot through which the webbing turns
  const x = DRING.x + DRING.w;
  out.push(L(`M${at([x, 76.8, SLOT_Z - 1.4]).join(" ")}L${at([x, 87.2, SLOT_Z - 1.4]).join(" ")}L${at([x, 87.2, SLOT_Z + 1.6]).join(" ")}L${at([x, 76.8, SLOT_Z + 1.6]).join(" ")}Z`, { tone: "lo" }));
  return out.join("");
}

function dringBolt() {
  return S(G.disc(0, 2, 2.8, alongX(DRING.x + DRING.w, 82, 219.6), P), { tone: "hi", crease: "lo" }) + D([at([DRING.x + DRING.w + 2, 82, 219.6])], { size: 0.55, tone: "hi" });
}

function retractorBack() {
  const out = [];
  out.push(S(k.slabOf({ x: -70, y: 70, w: 22, d: 30, r: 1.4 }, SILL_H, 2, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(-66, 72.6, 1.6, SILL_H + 2, 1.4, P, 6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -68, y: 72, w: 18, d: 2, r: 0.6 }, SILL_H + 2, 26, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -67, y: 74, w: 4, d: 16, r: 0.6 }, 46, 2, P, 2), { tone: "mid" }));
  // wound webbing on the spool
  out.push(S(G.disc(0, SPOOL_Y[1] - SPOOL_Y[0], ROLL_R, alongY(SPOOL[0], SPOOL_Y[0], SPOOL[1]), P), { tone: "hi", lit: true, crease: "none" }));
  out.push(L(G.circleOf(alongY(SPOOL[0], SPOOL_Y[1], SPOOL[1]), 0, ROLL_R - 1.6, P, 30) + G.circleOf(alongY(SPOOL[0], SPOOL_Y[1], SPOOL[1]), 0, ROLL_R - 3.2, P, 24), { tone: "faint" }));
  return out.join("");
}

function retractorFront() {
  const out = [];
  out.push(S(k.slabOf({ x: -68, y: SPOOL_Y[1], w: 18, d: 2, r: 0.6 }, SILL_H + 2, 26, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(-66, 97.4, 1.6, SILL_H + 2, 1.4, P, 6), { tone: "mid" }));
  out.push(S(k.cylinder(-52, 97.4, 1.6, SILL_H + 2, 1.4, P, 6), { tone: "mid" }));
  // ratchet (lock) wheel on the spool end
  out.push(S(G.disc(0, RATCHET_Y[1] - RATCHET_Y[0], RATCHET_R, alongY(SPOOL[0], RATCHET_Y[0], SPOOL[1]), P), { tone: "hi", crease: "lo" }));
  out.push(D([at([SPOOL[0], RATCHET_Y[1], SPOOL[1]])], { size: 0.6, tone: "hi" }));
  // vehicle-sensitive sensor: ball in a cone cup
  out.push(S(k.slabOf(SENSOR_BOX, SILL_H + 2, SENSOR_TOP - SILL_H - 2, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.ring(BALL[0], BALL[1], 3.1, SENSOR_TOP, P, 20), { tone: "lo" }));
  // pawl pivot pin
  out.push(S(G.disc(0, 1.6, 1.1, alongY(PAWL_PIVOT[0], RATCHET_Y[0] - 0.2, PAWL_PIVOT[1]), P), { tone: "mid" }));
  return out.join("");
}

function stringPot() {
  const out = [];
  out.push(S(k.cylinder(POT[0], POT[1], 6, 0, 2, P, 24, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(POT[0], POT[1], 1.8, 2, POT_Z - 8, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: POT[0] - 6, y: -6, w: 12, d: 12, r: 2 }, POT_Z - 6, 12, P, 4, 0.5), { tone: "mid" }));
  out.push(S(G.disc(0, 1, 2.2, alongX(POT[0] - 6, 0, POT_Z), P), { tone: "mid" }));
  out.push(D([at([POT[0] + 6, -3, POT_Z + 6]), at([POT[0] + 6, 3, POT_Z + 6])], { size: 0.4 }));
  return out.join("");
}

// ---------- assemble ----------
const pawl0 = () => pawlShape(PAWL_OFF, PAWL_PIVOT, PAWL_LEN, RATCHET_Y[1] + 0.2, P);
const webSvg = (part, w) => `<g class="iso-solid" data-lit data-part="${part}"><path class="iso-fill" d="${w.fill}"/><path class="iso-top" d="${w.fill}"/><path class="iso-line" data-tone="faint" d="${w.weave}"/><path class="iso-line iso-edge" data-tone="lit" d="${w.fill}"/></g>`;
const SPOOL_RUN = [[-53, 82, 36], [-54.4, 82, 50], [-55.4, 82, 61.2]];
const SPOOL_RUN_N = [[1, 0, 0], [1, 0, 0], [1, 0, 0]];

function guide() {
  const out = [];
  out.push(S(k.slabOf({ x: PILLAR.x + PILLAR.w, y: 80, w: 15, d: 4, r: 0.8 }, 58.6, 2.4, P, 2, 0.3), { tone: "mid" }));
  const g = { x: -59.6, y: 74.6, w: 8.6, d: 14.8, r: 1.2 };
  out.push(S(k.slabOf(g, 58, 4.4, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline({ x: -57.8, y: 76.4, w: 4.6, d: 11.2, r: 0.8 }, 62.4, P, 2), { tone: "lo" }));
  return out.join("");
}

function mechanism() {
  const p = pawl0();
  return [
    retractorFront(),
    `<path class="iso-line" data-part="teeth" data-tone="hi" d="${ratchetTeeth(0, SPOOL[0], SPOOL[1], RATCHET_R, RATCHET_Y[1] + 0.05, TEETH, P)}"/>`,
    `<g class="iso-solid" data-part="pawl"><path class="iso-fill" d="${p.d}"/><path class="iso-top" d="${p.d}"/><path class="iso-line iso-edge" data-tone="hi" d="${p.d}"/></g>`,
    `<path class="iso-line" data-part="lever" data-tone="hi" d=""/>`,
    `<g data-part="lever-ends"></g>`,
    `<g data-part="ball">${S(G.sphereOf(BALL, BALL_R, P), { tone: "hi", crease: "lo" })}</g>`,
  ].join("");
}

// Fig 1: the whole sled
const P1 = P;
const belt0 = beltPath(0, 0);
const svg1 = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A three-point seat belt on a crash sled, seen from the front outboard side. A crash dummy sits on a rigid seat. Webbing runs from the retractor at the foot of the B-pillar up through a guide to the D-ring, over the outboard shoulder and diagonally across the chest to the latch plate in the buckle, then back across the pelvis to the lap anchor on the sill. As the sled stops, the dummy moves forward against the belt.",
  body: [
    sled(),
    stringPot(),
    seat(),
    buckle(),
    `<g data-part="pelvis">${dummyPelvis()}</g>`,
    `<g data-part="abdomen">${dummyAbdomen()}</g>`,
    `<g data-part="chest">${dummyChest()}</g>`,
    `<path class="iso-line" data-part="wire" data-tone="lo" d=""/>`,
    D([at([POT[0] - 7, 0, POT_Z])], { size: 0.6, tone: "mid" }),
    `<g data-part="wire-eye">${D([at([-24.6, 0, POT_Z])], { size: 0.7, tone: "hi" })}</g>`,
    sill(),
    retractorBack(),
    dringPlate(),
    webSvg("lap", webbing(belt0.lap, belt0.lapN, HW, P)),
    webSvg("shoulder", webbing(belt0.shoulder, belt0.shoulderN, HW, P)),
    `<path class="iso-line" data-tone="lo" data-part="tack" d=""/>`,
    D([at([LAP_ANCHOR[0], LAP_ANCHOR[1], 25])], { size: 0.8, tone: "hi" }),
    latch(),
    dringBolt(),
    guide(),
    mechanism(),
  ],
});

// Fig 2: the same retractor up close, cut from the sill and the pillar foot
const CUT = { x: -100, y: 64, w: 60, d: 38, r: 2 };
const STUB = 70;
P = k.fitProjection([...k.boxCorners(CUT, -6, 0), [PILLAR.x, PILLAR.y, STUB], [PILLAR.x + PILLAR.w, PILLAR.y, STUB], [-48, 100, 40]], WIDTH, 340, { pad: 20, azimuth: 56, elevation: 26 });
const P2 = P;
function section() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CUT, -6, SILL_H + 6, P)}"/>`];
  out.push(S(k.slabOf(CUT, -6, SILL_H + 6, P, 3, 0.8), { tone: "lo", inner: L(k.sideSeam(CUT, 12, P, 3), { tone: "faint" }) }));
  out.push(D([-90, -70, -50].map((x) => at([x, CUT.y + CUT.d, 16])), { size: 0.45, tone: "lo" }));
  out.push(S(k.slabOf(k.insetPlan(PILLAR, -3), SILL_H, 2, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf(PILLAR, SILL_H + 2, STUB - SILL_H - 2, P, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PILLAR, 2.4), STUB, P, 3), { tone: "lo" }));
  out.push(D([36, 52].map((z) => at([PILLAR.x + PILLAR.w, PILLAR.y + PILLAR.d - 2, z])), { size: 0.5, tone: "lo" }));
  return out.join("");
}
const svg2 = k.figureSvg({
  width: WIDTH,
  height: 340,
  label:
    "Close-up of the seat belt retractor. Webbing is wound on a spool between two steel cheeks. On the outboard end the spool carries a ratchet wheel with 16 teeth. Below it, a steel ball sits in a cone cup; when the sled decelerates past 0.45 g the ball rolls forward and up the cone, lifting a lever that swings a pawl into the ratchet teeth and stops the spool from paying out more webbing.",
  body: [section(), retractorBack(), webSvg("spool-web", webbing(SPOOL_RUN, SPOOL_RUN_N, HW, P)), guide(), mechanism()],
});
P = P1;

// ---------- live ----------
const live = `
const FIGS = [${JSON.stringify(P1)}, ${JSON.stringify(P2)}];
const SERIES = ${JSON.stringify(series)};
const STEP = ${STEP}, END = ${END}, MM = ${MM}, HW = ${HW};
const TRIP = ${sim.tripAt}, LOCK = ${sim.lockAt};
const SPOOL = ${JSON.stringify(SPOOL)}, RATCHET_R = ${RATCHET_R}, RATCHET_Y = ${JSON.stringify(RATCHET_Y)}, TEETH = ${TEETH};
const PAWL_PIVOT = ${JSON.stringify(PAWL_PIVOT)}, SENSOR_TOP = ${SENSOR_TOP}, PAWL_LEN = ${PAWL_LEN}, PAWL_ON = ${PAWL_ON}, PAWL_OFF = ${PAWL_OFF};
const BALL = ${JSON.stringify(BALL)}, BALL_R = ${BALL_R}, BALL_ROLL = ${JSON.stringify(BALL_ROLL)};
const SPOOL_R_MM = ${SPOOL_R * 1000};
const LAP_ANCHOR = ${JSON.stringify(LAP_ANCHOR)}, SLOT_Z = ${SLOT_Z};
const POT = ${JSON.stringify(POT)}, POT_Z = ${POT_Z};
const SPOOL_RUN = ${JSON.stringify(SPOOL_RUN)}, SPOOL_RUN_N = ${JSON.stringify(SPOOL_RUN_N)};
${webbing.toString()}
${beltPath.toString()}
${ratchetTeeth.toString()}
${pawlShape.toString()}
const stages = [...document.querySelectorAll(".iso-stage")];
const views = stages.map((stage, i) => {
  const svg = stage.querySelector("svg");
  const $ = (name) => svg.querySelector('[data-part="' + name + '"]');
  return { stage, svg, P: FIGS[i], readout: stage.closest(".iso-plate").querySelector("[data-readout]"), tag: stage.closest(".iso-plate").querySelector(".sb-phase"),
    pelvis: $("pelvis"), abdomen: $("abdomen"), chest: $("chest"), wire: $("wire"), eye: $("wire-eye"), lap: $("lap"), shoulder: $("shoulder"), spoolWeb: $("spool-web"), tack: $("tack"),
    teeth: $("teeth"), pawl: $("pawl"), lever: $("lever"), ends: $("lever-ends"), ball: $("ball") };
});
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sample = (key, ms) => { const f = clamp(ms, 0, END) / STEP, i = Math.floor(f), j = Math.min(i + 1, SERIES[key].length - 1); return SERIES[key][i] + (SERIES[key][j] - SERIES[key][i]) * (f - i); };
const ease = (u) => u * u * (3 - 2 * u);
const SLOW = 32;            // shown 32 times slower than real time
const HOLD = 1.6;           // seconds held at the end of a run
const PEAK_MS = ${PEAK.at};
let ms = still.matches ? PEAK_MS : 0, target = ms, playing = !still.matches, clock = 0, frame = 0, last = 0, idleTimer = 0;
const seen = new Set();
const fmt = (q) => q[0].toFixed(1) + " " + q[1].toFixed(1);
function phaseAt(t) {
  if (t < TRIP) return "free spool";
  if (t < LOCK) return "ball tripped · pawl moving";
  if (sample("shoulder", t) > 0.05) return "locked · belt loaded";
  return t < 60 ? "locked · taking up slack" : "rebound · unloaded";
}
function setWeb(el, pts, ns, P) {
  const w = webbing(pts, ns, HW, P);
  const [fill, top, weave, edge] = el.children;
  fill.setAttribute("d", w.fill); top.setAttribute("d", w.fill); weave.setAttribute("d", w.weave); edge.setAttribute("d", w.fill);
}
function lockState() {
  // the ball rolls and the pawl swings in over the sensor's travel; both stay in while the sled decelerates or the belt is loaded
  const swing = ms < TRIP ? 0 : ease(clamp((ms - TRIP) / (LOCK - TRIP), 0, 1));
  const held = sample("g", ms) > 0.2 || sample("shoulder", ms) > 0.05 ? 1 : 0;
  return ms < LOCK ? swing : held;
}
function drawRetractor(v, s) {
  const P = v.P;
  const turn = -(sample("payout", ms) / SPOOL_R_MM);
  v.teeth.setAttribute("d", ratchetTeeth(turn, SPOOL[0], SPOOL[1], RATCHET_R, RATCHET_Y[1] + 0.05, TEETH, P));
  const pawl = pawlShape(PAWL_OFF + (PAWL_ON - PAWL_OFF) * s, PAWL_PIVOT, PAWL_LEN, RATCHET_Y[1] + 0.2, P);
  for (const child of v.pawl.children) child.setAttribute("d", pawl.d);
  const bx = BALL_ROLL[0] * s, bz = BALL_ROLL[2] * s;
  v.ball.setAttribute("transform", translateAlong(P, [bx, 0, bz]));
  const top = iso([BALL[0] + bx, BALL[1], BALL[2] + bz + BALL_R], P);
  v.lever.setAttribute("d", "M" + fmt(top) + "L" + fmt(pawl.liftAt));
  v.ends.innerHTML = dotsSvg([top, pawl.liftAt, pawl.pin], { size: 0.55, tone: "hi" });
}
function drawSled(v) {
  const P = v.P;
  const xc = sample("chest", ms) / MM, xp = sample("pelvis", ms) / MM;
  v.chest.setAttribute("transform", translateAlong(P, [xc, 0, 0]));
  v.pelvis.setAttribute("transform", translateAlong(P, [xp, 0, 0]));
  v.abdomen.setAttribute("transform", translateAlong(P, [(xc + xp) / 2, 0, 0]));
  v.eye.setAttribute("transform", translateAlong(P, [xc, 0, 0]));
  v.wire.setAttribute("d", "M" + fmt(iso([POT[0] - 7, 0, POT_Z], P)) + "L" + fmt(iso([-24.6 + xc, 0, POT_Z], P)));
  const path = beltPath(xc, xp);
  setWeb(v.shoulder, path.shoulder, path.shoulderN, P);
  setWeb(v.lap, path.lap, path.lapN, P);
  // bar tacks across the sewn loop at the lap anchor, edge to edge on the webbing itself
  const lw = webbing(path.lap, path.lapN, HW, P), n = lw.left.length;
  const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  let tacks = "";
  for (const u of [0.35, 0.6]) tacks += "M" + fmt(mix(lw.left[n - 2], lw.left[n - 1], u)) + "L" + fmt(mix(lw.right[n - 2], lw.right[n - 1], u));
  v.tack.setAttribute("d", tacks);
}
let lastPhase = "";
function draw() {
  const s = lockState();
  const phase = phaseAt(ms);
  views.forEach((v, i) => {
    if (i === 0) drawSled(v);
    drawRetractor(v, s);
    const text = i === 0
      ? Math.round(ms) + " ms · " + sample("g", ms).toFixed(1) + " g · chest " + Math.max(0, sample("chest", ms)).toFixed(0) + " mm · belt " + sample("shoulder", ms).toFixed(1) + " / " + sample("lap", ms).toFixed(1) + " kN"
      : Math.round(ms) + " ms · paid out " + sample("payout", ms).toFixed(1) + " mm · webbing " + sample("shoulder", ms).toFixed(1) + " kN";
    if (v.readout.textContent !== text) v.readout.textContent = text;
    v.stage.setAttribute("aria-valuenow", String(Math.round(ms)));
    if (phase !== lastPhase) { v.stage.setAttribute("aria-valuetext", Math.round(ms) + " milliseconds, " + phase); if (v.tag) v.tag.textContent = phase; }
  });
  lastPhase = phase;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (playing) {
    clock += dt;
    const run = (END / 1000) * SLOW;
    ms = target = Math.min(END, ((clock % (run + HOLD)) / SLOW) * 1000);
  } else {
    ms = still.matches ? target : ms + (target - ms) * (1 - Math.exp(-dt / 0.16));
    if (Math.abs(target - ms) < 0.05) ms = target;
  }
  draw();
  const settled = !playing && ms === target;
  frame = seen.size && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && seen.size) { last = 0; frame = requestAnimationFrame(tick); } };
const resumeLater = () => { clearTimeout(idleTimer); if (still.matches) return; idleTimer = setTimeout(() => { playing = true; clock = (ms / 1000) * SLOW; run(); }, 3600); };
const steer = (next) => { playing = false; target = clamp(next, 0, END); resumeLater(); run(); };
const io = new IntersectionObserver((entries) => { for (const e of entries) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); } run(); }, { rootMargin: "120px 0px" });
for (const v of views) {
  const { stage, svg } = v;
  io.observe(stage);
  let dragging = false;
  const toMs = (event) => { const box = svg.getBoundingClientRect(); return clamp((event.clientX - box.left) / box.width, 0, 1) * END; };
  stage.addEventListener("pointerdown", (event) => { dragging = true; stage.setPointerCapture(event.pointerId); steer(toMs(event)); });
  stage.addEventListener("pointermove", (event) => { if (dragging || event.pointerType === "mouse") steer(toMs(event)); });
  const release = (event) => { dragging = false; try { stage.releasePointerCapture(event.pointerId); } catch (e) {} };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 2;
    let to = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + step;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - step;
    if (event.key === "Home") to = 0;
    if (event.key === "End") to = END;
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); clearTimeout(idleTimer); if (playing) { playing = false; target = ms; } else { playing = true; clock = 0; ms = 0; } run(); return; }
    if (to === null) return;
    event.preventDefault();
    steer(to);
  });
}
draw();
`;

const stageHtml = (svg, label) => `<div class="iso-stage" tabindex="0" role="slider" aria-label="${label}: arrow keys step through the crash, Shift for 10 ms, Space plays or pauses" aria-valuemin="0" aria-valuemax="${END}" aria-valuenow="0" aria-valuetext="0 milliseconds, free spool">${svg}</div><div class="sb-phase" aria-live="polite">free spool</div>`;

const fig1 = k.plateHtml({
  fig: "Fig 1",
  title: "Three-point seat belt",
  hint: "Drag to scrub",
  readout: "0 ms · 0.0 g · chest 0 mm · belt 0.0 / 0.0 kN",
  keys: [
    { mark: "lit", label: "Webbing, 48 mm: spool, guide, D-ring, shoulder, chest, latch, lap, anchor" },
    { mark: "raised", label: "Hardware: retractor, D-ring, latch plate, buckle, lap anchor" },
    { mark: "dim", label: "String pot wire: measures chest travel" },
  ],
  caption: `A 56 km/h frontal sled test, slowed 32 times. The sled stops with a ${PULSE.peak} g half-sine pulse over ${PULSE.ms} ms while the dummy carries on forward. The belt holds it at three points: the D-ring above the outboard shoulder, the buckle at the inboard hip and the lap anchor on the sill. The shoulder belt peaks at ${PEAK.shoulder.toFixed(1)} kN near ${Math.round(PEAK.at)} ms, the lap belt at ${PEAK.lap.toFixed(1)} kN, and the chest travels ${PEAK.chest.toFixed(0)} mm. Readout: time, sled deceleration, chest travel, shoulder / lap belt load.`,
  body: stageHtml(svg1, "Seat belt on a crash sled"),
});
const fig2 = k.plateHtml({
  fig: "Fig 2",
  title: "Retractor lock",
  hint: "Same clock as Fig 1",
  readout: "0 ms · paid out 0.0 mm · webbing 0.0 kN",
  keys: [
    { mark: "lit", label: "Webbing wound on the spool" },
    { mark: "raised", label: "Ratchet (16 teeth), pawl, lever and sensor ball" },
  ],
  caption: `The vehicle-sensitive lock. The ball trips at ${SENSOR.trip} g, ${sim.tripAt.toFixed(1)} ms in, rolls up its cone and lifts the lever; the pawl seats in the ratchet ${sim.lockAt.toFixed(1)} ms in, after ${series.payout.at(-1).toFixed(1)} mm of free payout. Once locked the spool cannot turn out, so every millimetre of chest travel after that comes from webbing stretch, slack and the wound roll tightening. Real retractors add a webbing-sensitive clutch and usually a pretensioner and torsion-bar load limiter; this model leaves them out. Spring-damper model: ${CHEST.m} kg on the shoulder belt, ${PELVIS.m} kg on the lap belt, ${CHEST.slack * 1000} mm slack.`,
  body: stageHtml(svg2, "Seat belt retractor"),
});
const extraCss = `<style>.iso-plate{margin-bottom:28px}.sb-phase{position:absolute;top:18px;left:50%;transform:translateX(-50%);font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-strong);white-space:nowrap;pointer-events:none}.iso-stage{cursor:ew-resize;touch-action:pan-y}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}@media (max-width:560px){.sb-phase{top:34px}}</style>`;

const file = theme === "light" ? "seat-belt-light.html" : "seat-belt.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Three-point seat belt", theme, body: extraCss + fig1 + fig2, script: kitScript() + live }));
console.log("wrote", file, "· lock", sim.lockAt.toFixed(1), "ms · peaks", PEAK);
