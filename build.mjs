// Fig 1: a three-point seat belt on a crash sled. Run `node build.mjs` (add --light for the light theme).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
const { iso } = k;
import * as G from "./kit/lathe.mjs";
import { kitScript } from "./scripts/inline-kit.mjs";
import { simulate, PULSE, SENSOR, CHEST, PELVIS, SPOOL_R, END } from "./model.mjs";
import * as RT from "./retractor.mjs";

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
const ROLL_R = 5.0;            // wound roll with a belted occupant (520 mm out), see retractor.mjs
const RATCHET_R = 8.4, RATCHET_Y = [92, 93.4], TEETH = 16;
// pawl under the ratchet: it pivots at its left end and its tip rises into the teeth
const PAWL_PIVOT = [-70.4, 28.6];
const PAWL_TIP = [-59 + (RATCHET_R - 1.0) * Math.cos((205 * Math.PI) / 180), 36 + (RATCHET_R - 1.0) * Math.sin((205 * Math.PI) / 180)];
const PAWL_LEN = Math.hypot(PAWL_TIP[0] - PAWL_PIVOT[0], PAWL_TIP[1] - PAWL_PIVOT[1]);
const PAWL_ON = Math.atan2(PAWL_TIP[1] - PAWL_PIVOT[1], PAWL_TIP[0] - PAWL_PIVOT[0]);
const PAWL_OFF = PAWL_ON - (48 * Math.PI) / 180;
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
    [-54, 82, 36], [-56, 82, 70], [-68.2, 82, 207], [-68.6, 82, SLOT_Z + 1.4],
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
const shapeSvg = (part, d, tone = "hi", lit = false) => `<g class="iso-solid"${lit ? " data-lit" : ""} data-part="${part}"><path class="iso-fill" d="${d}"/><path class="iso-top" d="${d}"/><path class="iso-line iso-edge" data-tone="${lit ? "lit" : tone}" d="${d}"/></g>`;

// rewind spring cassette and webbing-sensitive flyweight, on the lock end of the spool
const CASSETTE = { y: [RATCHET_Y[1], RATCHET_Y[1] + 2.2], r: 5.5, rIn: 4.9 };
const SPIRAL_Y = CASSETTE.y[0] + 0.45;
const SPRING_TURNS = 3.5;                 // coils in the cassette when stowed (the preload)
const FLY = { r: 6.3, a0: 1.9, span: 1.05, w: 1.1, swing: 0.42 };

// ---------- shared live geometry, part 2 ----------
function hull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of pts.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
function polyD(pts, closed) {
  return pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("") + (closed ? "Z" : "");
}
// a round body lying along y (a wound roll): its silhouette and its outboard end face
function rollY(cx, cz, r, y0, y1, P) {
  const ring = (y) => { const out = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; out.push(iso([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], P)); } return out; };
  const near = ring(y1);
  return { fill: polyD(hull(ring(y0).concat(near)), true), end: polyD(near, true) };
}
// the webbing between two rolls: the cross tangent that leaves roll 1 on its +x side
function crossTangent(c1, r1, c2, r2) {
  const dx = c2[0] - c1[0], dz = c2[1] - c1[1], dd = dx * dx + dz * dz, s = r1 + r2;
  const h = Math.sqrt(Math.max(0, dd - s * s));
  let best = null;
  for (const sign of [1, -1]) {
    const nx = (s * dx - sign * h * dz) / dd, nz = (s * dz + sign * h * dx) / dd;
    const t1 = [c1[0] + r1 * nx, c1[1] + r1 * nz], t2 = [c2[0] - r2 * nx, c2[1] - r2 * nz];
    if (!best || t1[0] > best.t1[0]) best = { t1, t2, n: [-nz, nx] };
  }
  return best;
}
function spiralOf(turn, cx, cz, y, rIn, rOut, base, P) {
  const wound = turn / (Math.PI * 2);
  const coils = base + wound, gamma = 0.8 + 0.5 * Math.min(1, wound / 3.6);
  const pts = [], n = Math.round(coils * 56);
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = Math.PI / 2 - Math.PI * 2 * coils * (1 - u);
    const r = rIn + (rOut - rIn) * Math.pow(u, gamma);
    pts.push(iso([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], P));
  }
  const inner = Math.PI / 2 - Math.PI * 2 * coils;
  const slotA = iso([cx + Math.cos(inner) * rIn, y, cz + Math.sin(inner) * rIn], P), slotB = iso([cx - Math.cos(inner) * rIn, y, cz - Math.sin(inner) * rIn], P);
  return { d: polyD(pts, false), slot: polyD([slotA, slotB], false) };
}
function flyweightOf(turn, swing, cx, cz, y, fw, P) {
  // an arc-shaped weight pinned near one end; it rides round with the spool and, lagging, swings its free end out
  const spin = fw.a0 - turn;
  const pin = [Math.cos(spin) * fw.r, Math.sin(spin) * fw.r];
  const local = [];
  for (let i = 0; i <= 10; i++) { const a = spin + (i / 10) * fw.span; local.push([Math.cos(a) * (fw.r + fw.w / 2), Math.sin(a) * (fw.r + fw.w / 2)]); }
  for (let i = 10; i >= 0; i--) { const a = spin + (i / 10) * fw.span; local.push([Math.cos(a) * (fw.r - fw.w / 2), Math.sin(a) * (fw.r - fw.w / 2)]); }
  const rot = -swing * fw.swing, c = Math.cos(rot), s = Math.sin(rot);
  const moved = local.map(([x, z]) => { const dx = x - pin[0], dz = z - pin[1]; return iso([cx + pin[0] + dx * c - dz * s, y, cz + pin[1] + dx * s + dz * c], P); });
  return { d: polyD(moved, true), pin: iso([cx + pin[0], y, cz + pin[1]], P) };
}
function dialTicks(angle, cx, cz, y, r, count, P) {
  let minor = "", major = "";
  for (let i = 0; i < count; i++) {
    const a = angle + (i / count) * Math.PI * 2, long = i % 6 === 0;
    const a0 = iso([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], P), a1 = iso([cx + Math.cos(a) * (r - (long ? 2.2 : 1.2)), y, cz + Math.sin(a) * (r - (long ? 2.2 : 1.2))], P);
    const seg = "M" + a0[0].toFixed(1) + " " + a0[1].toFixed(1) + "L" + a1[0].toFixed(1) + " " + a1[1].toFixed(1);
    if (long) major += seg; else minor += seg;
  }
  return { minor, major };
}

function guide() {
  const out = [];
  out.push(S(k.slabOf({ x: PILLAR.x + PILLAR.w, y: 80, w: 15, d: 4, r: 0.8 }, 58.6, 2.4, P, 2, 0.3), { tone: "mid" }));
  const g = { x: -59.6, y: 74.6, w: 8.6, d: 14.8, r: 1.2 };
  out.push(S(k.slabOf(g, 58, 4.4, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline({ x: -57.8, y: 76.4, w: 4.6, d: 11.2, r: 0.8 }, 62.4, P, 2), { tone: "lo" }));
  return out.join("");
}

function retractorBase() {
  const out = [];
  out.push(S(k.slabOf({ x: -70, y: 70, w: 22, d: 30, r: 1.4 }, SILL_H, 2, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(-66, 72.6, 1.6, SILL_H + 2, 1.4, P, 6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -68, y: 72, w: 18, d: 2, r: 0.6 }, SILL_H + 2, 26, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -67, y: 74, w: 4, d: 16, r: 0.6 }, 46, 2, P, 2), { tone: "mid" }));
  return out.join("");
}

function lockEnd(open) {
  // on the outboard end: ratchet teeth, the flyweight, then the spring cassette over the spool centre
  const out = [];
  out.push(`<path class="iso-line" data-part="teeth" data-tone="hi" d="${ratchetTeeth(0, SPOOL[0], SPOOL[1], RATCHET_R, RATCHET_Y[1] + 0.05, TEETH, P)}"/>`);
  const fw = flyweightOf(0, 0, SPOOL[0], SPOOL[1], RATCHET_Y[1] + 0.1, FLY, P);
  out.push(shapeSvg("fly", fw.d, "hi"));
  out.push(`<g data-part="fly-pin">${D([fw.pin], { size: 0.5, tone: "hi" })}</g>`);
  const F = alongY(SPOOL[0], CASSETTE.y[0], SPOOL[1]);
  if (!open) {
    out.push(S(G.disc(0, CASSETTE.y[1] - CASSETTE.y[0], CASSETTE.r, F, P), { tone: "mid" }));
    out.push(D([at([SPOOL[0], CASSETTE.y[1], SPOOL[1]])], { size: 0.5, tone: "mid" }));
    return out.join("");
  }
  // the cassette with its cover cut away: wall, the dark well inside, and the spring seen through the opening
  out.push(S(G.disc(0, CASSETTE.y[1] - CASSETTE.y[0], CASSETTE.r, F, P), { tone: "mid" }));
  const mouth = G.circleOf(alongY(SPOOL[0], CASSETTE.y[1], SPOOL[1]), 0, CASSETTE.rIn, P, 48);
  out.push(`<path class="iso-shade" data-shade="0" d="${mouth}"/>`);
  out.push(`<clipPath id="cassette-mouth"><path d="${mouth}"/></clipPath><g clip-path="url(#cassette-mouth)">`);
  out.push(`<path class="iso-line" data-tone="faint" d="${G.circleOf(alongY(SPOOL[0], SPIRAL_Y - 0.05, SPOOL[1]), 0, CASSETTE.rIn, P, 48)}"/>`);
  const sp = spiralOf(0, SPOOL[0], SPOOL[1], SPIRAL_Y, 0.9, CASSETTE.rIn, SPRING_TURNS, P);
  out.push(`<path class="iso-line" data-part="spiral" data-tone="hi" d="${sp.d}"/>`);
  out.push(L(G.circleOf(alongY(SPOOL[0], SPIRAL_Y, SPOOL[1]), 0, 0.9, P, 20), { tone: "hi" }));
  out.push(`<path class="iso-line" data-part="arbor" data-tone="mid" d="${sp.slot}"/>`);
  out.push(`</g>`);
  out.push(L(mouth, { tone: "mid" }));
  return out.join("");
}

function sensorParts() {
  const p = pawl0();
  return [
    shapeSvg("pawl", p.d, "hi"),
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
    retractorFront(),
    lockEnd(false),
    sensorParts(),
  ],
});

// Fig 2: the retractor on a test bench; a pull drum plays the occupant
const BENCH = { x: -86, y: 56, w: 70, d: 50, r: 5 }, BENCH_H = 8;
const FIXTURE = { x: -76, y: 66, w: 32, d: 38, r: 2 };
const DRUM = [-31, 56], DRUM_CORE = 30, DRUM_Y = [74, 90], FLANGE_R = 9.2;
const DIAL = { y: [96.4, 97.2], r: 6.8 };
const r2 = (mm) => mm / MM;
P = k.fitProjection(
  [...k.boxCorners(BENCH, -BENCH_H - 4, 0), [DRUM[0], 62, DRUM[1] + FLANGE_R], [DRUM[0] + FLANGE_R, DIAL.y[1], DRUM[1]], [-71, 100, 20], [-59, 96, 36 + RATCHET_R]],
  WIDTH,
  420,
  { pad: 16, azimuth: 56, elevation: 26 },
);
const P2 = P;
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -BENCH_H - 4, BENCH_H + 4, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BENCH, 12))) {
    out.push(S(k.cylinder(x, y, 5, -BENCH_H - 4, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 3.8, -BENCH_H - 2.6, 2.6, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BENCH, -BENCH_H, BENCH_H, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(BENCH, -3, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 4), 0, P), { tone: "lo" }));
  const screws = k.corners(BENCH, 6);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // fixture block the retractor bolts to, at the height it sits in the car
  out.push(S(k.slabOf(FIXTURE, 0, SILL_H, P, 3, 0.8), { tone: "lo", inner: L(k.sideSeam(FIXTURE, 10, P, 3), { tone: "faint" }) }));
  out.push(D([-70, -50].map((x) => at([x, FIXTURE.y + FIXTURE.d, 15])), { size: 0.45, tone: "lo" }));
  return out.join("");
}
function drumBack() {
  const out = [];
  // the pull motor sits on the drum's axis, behind the inboard upright
  out.push(S(k.slabOf({ x: -37, y: 60, w: 12, d: 7, r: 1 }, 0, DRUM[1] - 7, P, 2, 0.3), { tone: "mid" }));
  out.push(S(G.disc(0, 9, 6.6, alongY(DRUM[0], 60, DRUM[1]), P), { tone: "mid", inner: L(G.arcOf(alongY(DRUM[0], 60, DRUM[1]), 4.5, 6.6, P), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: -34, y: 69, w: 6, d: 3, r: 0.8 }, 0, DRUM[1], P, 2, 0.3), { tone: "mid" }));
  out.push(S(G.disc(0, 1, FLANGE_R, alongY(DRUM[0], DRUM_Y[0] - 1, DRUM[1]), P), { tone: "mid" }));
  return out.join("");
}
function drumFront() {
  const out = [];
  out.push(S(G.disc(0, 1, FLANGE_R, alongY(DRUM[0], DRUM_Y[1], DRUM[1]), P), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -34, y: 92, w: 6, d: 3, r: 0.8 }, 0, DRUM[1], P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([DRUM[0], 95, 8]), at([DRUM[0], 95, DRUM[1] - 10])], { size: 0.45, tone: "lo" }));
  out.push(S(G.disc(0, 1.4, 3.4, alongY(DRUM[0], 95, DRUM[1]), P), { tone: "mid" }));
  out.push(S(G.disc(0, DIAL.y[1] - DIAL.y[0], DIAL.r, alongY(DRUM[0], DIAL.y[0], DRUM[1]), P), { tone: "hi", crease: "lo" }));
  const t = dialTicks(0, DRUM[0], DRUM[1], DIAL.y[1] + 0.02, DIAL.r - 0.4, 24, P);
  out.push(L(G.circleOf(alongY(DRUM[0], DIAL.y[1] + 0.02, DRUM[1]), 0, DIAL.r - 0.4, P, 56), { tone: "lo" }));
  out.push(`<path class="iso-line" data-part="dial-minor" data-tone="lo" data-free="end" d="${t.minor}"/><path class="iso-line" data-part="dial-major" data-tone="hi" data-free="end" d="${t.major}"/>`);
  out.push(D([at([DRUM[0], DIAL.y[1], DRUM[1]])], { size: 0.6, tone: "hi" }));
  return out.join("");
}
const roll0 = rollY(SPOOL[0], SPOOL[1], r2(RT.STOWED_R), SPOOL_Y[0], SPOOL_Y[1], P);
const droll0 = rollY(DRUM[0], DRUM[1], r2(DRUM_CORE), DRUM_Y[0], DRUM_Y[1], P);
const tan0 = crossTangent(SPOOL, r2(RT.STOWED_R), DRUM, r2(DRUM_CORE));
const strip0 = webbing([[tan0.t1[0], 82, tan0.t1[1]], [tan0.t2[0], 82, tan0.t2[1]]], [[tan0.n[0], 0, tan0.n[1]], [tan0.n[0], 0, tan0.n[1]]], HW, P);
const svg2 = k.figureSvg({
  width: WIDTH,
  height: 420,
  label:
    "A seat belt retractor on a test bench. Webbing is wound on a spool between two steel cheeks and runs up to a motor-driven pull drum that stands in for the occupant. On the outboard end of the spool are a 16-tooth lock wheel, a flyweight riding on it, and the rewind spring cassette with its cover cut away to show the flat spiral spring. Below, a steel ball sits in a cone cup next to a pawl. Pulling webbing out winds the spring tighter; letting go, the spring winds it back. A sudden yank swings the flyweight out, and hard braking rolls the ball up its cone; either one drives the pawl into the lock wheel.",
  body: [
    bench(),
    drumBack(),
    retractorBase(),
    shapeSvg("roll", roll0.fill, "hi", true).replace("</g>", `<path class="iso-line" data-part="roll-end" data-tone="faint" d="${roll0.end}"/></g>`),
    webSvg("drum-web", strip0),
    shapeSvg("drum-roll", droll0.fill, "hi", true),
    retractorFront(),
    lockEnd(true),
    sensorParts(),
    drumFront(),
  ],
});
P = P1;

// ---------- live ----------
const rtRows = RT.simulate(0.002);
const RT_STEP = 0.01;
const pick = (t) => rtRows[Math.min(rtRows.length - 1, Math.round(t / 0.002))];
const RT_SERIES = { p: [], F: [], r: [], turn: [], fly: [], pawl: [], ball: [], lock: [] };
for (let t = 0; t <= RT.LENGTH + 1e-9; t += RT_STEP) {
  const row = pick(t);
  RT_SERIES.p.push(+row.p.toFixed(2)); RT_SERIES.F.push(+row.F.toFixed(3)); RT_SERIES.r.push(+row.r.toFixed(3)); RT_SERIES.turn.push(+row.turn.toFixed(4));
  RT_SERIES.fly.push(+row.fly.toFixed(3)); RT_SERIES.pawl.push(+row.pawl.toFixed(3)); RT_SERIES.ball.push(+row.ball.toFixed(3)); RT_SERIES.lock.push(row.locked ? 1 : 0);
}
const RT_SEGS = RT.SEGMENTS.map(({ id, name, from, to, slow }) => ({ id, name, from, to, slow }));
const RT_STILL = 3.6 + 0.4; // reduced motion: hold on the jerk, locked by the flyweight

const live = `
const SERIES = ${JSON.stringify(series)};
const STEP = ${STEP}, END = ${END}, MM = ${MM}, HW = ${HW};
const SPOOL = ${JSON.stringify(SPOOL)}, SPOOL_Y = ${JSON.stringify(SPOOL_Y)}, RATCHET_R = ${RATCHET_R}, RATCHET_Y = ${JSON.stringify(RATCHET_Y)}, TEETH = ${TEETH};
const PAWL_PIVOT = ${JSON.stringify(PAWL_PIVOT)}, PAWL_LEN = ${PAWL_LEN}, PAWL_ON = ${PAWL_ON}, PAWL_OFF = ${PAWL_OFF};
const BALL = ${JSON.stringify(BALL)}, BALL_R = ${BALL_R}, BALL_ROLL = ${JSON.stringify(BALL_ROLL)};
const SPOOL_R_MM = ${SPOOL_R * 1000};
const LAP_ANCHOR = ${JSON.stringify(LAP_ANCHOR)}, SLOT_Z = ${SLOT_Z};
const POT = ${JSON.stringify(POT)}, POT_Z = ${POT_Z};
const FLY = ${JSON.stringify(FLY)}, CASSETTE = ${JSON.stringify(CASSETTE)}, SPIRAL_Y = ${SPIRAL_Y}, SPRING_TURNS = ${SPRING_TURNS};
const DRUM = ${JSON.stringify(DRUM)}, DRUM_CORE = ${DRUM_CORE}, DRUM_Y = ${JSON.stringify(DRUM_Y)}, DIAL = ${JSON.stringify(DIAL)}, WEB_T = ${RT.WEB.t};
const RT_SERIES = ${JSON.stringify(RT_SERIES)}, RT_STEP = ${RT_STEP}, RT_LENGTH = ${RT.LENGTH}, RT_SEGS = ${JSON.stringify(RT_SEGS)}, RT_STILL = ${RT_STILL};
${webbing.toString()}
${beltPath.toString()}
${ratchetTeeth.toString()}
${pawlShape.toString()}
${hull.toString()}
${polyD.toString()}
${rollY.toString()}
${crossTangent.toString()}
${spiralOf.toString()}
${flyweightOf.toString()}
${dialTicks.toString()}
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (u) => u * u * (3 - 2 * u);
const fmt = (q) => q[0].toFixed(1) + " " + q[1].toFixed(1);
const lerpIn = (arr, f) => { const i = Math.floor(f), j = Math.min(i + 1, arr.length - 1); return arr[i] + (arr[j] - arr[i]) * (f - i); };
const sample = (key, ms) => lerpIn(SERIES[key], clamp(ms, 0, END) / STEP);
const rt = (key, t) => lerpIn(RT_SERIES[key], clamp(t, 0, RT_LENGTH) / RT_STEP);
const rtAt = (key, t) => RT_SERIES[key][Math.round(clamp(t, 0, RT_LENGTH) / RT_STEP)];

function partsOf(stage) {
  const svg = stage.querySelector("svg");
  const plate = stage.closest(".iso-plate");
  const out = { stage, svg, readout: plate.querySelector("[data-readout]"), tag: plate.querySelector(".sb-phase") };
  svg.querySelectorAll("[data-part]").forEach((el) => { out[el.dataset.part] = el; });
  return out;
}
function setShape(el, d) { for (const child of el.children) if (child.tagName === "path" && !child.dataset.part) child.setAttribute("d", d); }
function setWeb(el, w) {
  const [fill, top, weave, edge] = el.children;
  fill.setAttribute("d", w.fill); top.setAttribute("d", w.fill); weave.setAttribute("d", w.weave); edge.setAttribute("d", w.fill);
}
function drawPawlAndBall(v, P, pawlPos, ballPos) {
  const pawl = pawlShape(PAWL_OFF + (PAWL_ON - PAWL_OFF) * pawlPos, PAWL_PIVOT, PAWL_LEN, RATCHET_Y[1] + 0.2, P);
  setShape(v.pawl, pawl.d);
  const bx = BALL_ROLL[0] * ballPos, bz = BALL_ROLL[2] * ballPos;
  v.ball.setAttribute("transform", translateAlong(P, [bx, 0, bz]));
  const top = iso([BALL[0] + bx, BALL[1], BALL[2] + bz + BALL_R], P);
  // the pin rides on the ball; it reaches the pawl only as far as the ball has lifted it
  const reach = pawlShape(PAWL_OFF + (PAWL_ON - PAWL_OFF) * ballPos, PAWL_PIVOT, PAWL_LEN, RATCHET_Y[1] + 0.2, P).liftAt;
  v["lever"].setAttribute("d", "M" + fmt(top) + "L" + fmt(reach));
  v["lever-ends"].innerHTML = dotsSvg(pawlPos > ballPos + 0.02 ? [top, reach, pawl.liftAt, pawl.pin] : [top, reach, pawl.pin], { size: 0.55, tone: "hi" });
}

// one clock per figure: plays a looping script, follows drag and keys, holds still under reduced motion
function clockFor(v, { length, slowAt, still: stillAt, draw, markers }) {
  let t = still.matches ? stillAt : 0, target = t, playing = !still.matches, frame = 0, last = 0, idle = 0, visible = false;
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (playing) { t += dt; if (t > length) t = 0; target = t; }
    else { t = still.matches ? target : t + (target - t) * (1 - Math.exp(-dt / 0.16)); if (Math.abs(target - t) < 0.002) t = target; }
    draw(t);
    frame = visible && !(!playing && t === target) ? requestAnimationFrame(tick) : 0;
  }
  const later = () => { clearTimeout(idle); if (!still.matches) idle = setTimeout(() => { playing = true; run(); }, 3600); };
  const steer = (next) => { playing = false; target = clamp(next, 0, length); later(); run(); };
  const play = (from) => { clearTimeout(idle); t = target = from; playing = !still.matches; if (still.matches) draw(t); run(); };
  new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(v.stage);
  let dragging = false;
  const toT = (event) => { const box = v.svg.getBoundingClientRect(); return clamp((event.clientX - box.left) / box.width, 0, 1) * length; };
  v.stage.addEventListener("pointerdown", (event) => { dragging = true; v.stage.setPointerCapture(event.pointerId); steer(toT(event)); });
  v.stage.addEventListener("pointermove", (event) => { if (dragging || event.pointerType === "mouse") steer(toT(event)); });
  const release = (event) => { dragging = false; try { v.stage.releasePointerCapture(event.pointerId); } catch (e) {} };
  v.stage.addEventListener("pointerup", release);
  v.stage.addEventListener("pointercancel", release);
  v.stage.addEventListener("keydown", (event) => {
    const step = (event.shiftKey ? 10 : 2) * slowAt(target);
    let to = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + step;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - step;
    if (event.key === "Home") to = 0;
    if (event.key === "End") to = length;
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); clearTimeout(idle); if (playing) { playing = false; target = t; } else play(t >= length ? 0 : t); run(); return; }
    if (to === null) return;
    event.preventDefault();
    steer(to);
  });
  draw(t);
  return { play };
}

// ---- Fig 1: the sled ----
const v1 = partsOf(document.querySelectorAll(".iso-stage")[0]);
const P1 = ${JSON.stringify(P1)};
function phase1(ms) {
  if (ms < ${sim.tripAt}) return "free spool";
  if (ms < ${sim.lockAt}) return "ball tripped · pawl moving";
  if (sample("shoulder", ms) > 0.05) return "locked · belt loaded";
  return ms < 60 ? "locked · taking up slack" : "rebound · unloaded";
}
let said1 = "";
function draw1(ms) {
  const P = P1;
  const xc = sample("chest", ms) / MM, xp = sample("pelvis", ms) / MM;
  v1.chest.setAttribute("transform", translateAlong(P, [xc, 0, 0]));
  v1.pelvis.setAttribute("transform", translateAlong(P, [xp, 0, 0]));
  v1.abdomen.setAttribute("transform", translateAlong(P, [(xc + xp) / 2, 0, 0]));
  v1["wire-eye"].setAttribute("transform", translateAlong(P, [xc, 0, 0]));
  v1.wire.setAttribute("d", "M" + fmt(iso([POT[0] - 7, 0, POT_Z], P)) + "L" + fmt(iso([-24.6 + xc, 0, POT_Z], P)));
  const path = beltPath(xc, xp);
  setWeb(v1.shoulder, webbing(path.shoulder, path.shoulderN, HW, P));
  const lw = webbing(path.lap, path.lapN, HW, P), n = lw.left.length;
  setWeb(v1.lap, lw);
  const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  let tacks = "";
  for (const u of [0.35, 0.6]) tacks += "M" + fmt(mix(lw.left[n - 2], lw.left[n - 1], u)) + "L" + fmt(mix(lw.right[n - 2], lw.right[n - 1], u));
  v1.tack.setAttribute("d", tacks);
  // the retractor in the car: free until the ball trips, then held
  const swing = ms < ${sim.tripAt} ? 0 : ease(clamp((ms - ${sim.tripAt}) / (${sim.lockAt} - ${sim.tripAt}), 0, 1));
  const held = sample("g", ms) > 0.2 || sample("shoulder", ms) > 0.05 ? 1 : 0;
  const s = ms < ${sim.lockAt} ? swing : held;
  const turn = sample("payout", ms) / SPOOL_R_MM;
  v1.teeth.setAttribute("d", ratchetTeeth(-turn, SPOOL[0], SPOOL[1], RATCHET_R, RATCHET_Y[1] + 0.05, TEETH, P));
  drawPawlAndBall(v1, P, s, s);
  const text = Math.round(ms) + " ms · " + sample("g", ms).toFixed(1) + " g · chest " + Math.max(0, sample("chest", ms)).toFixed(0) + " mm · belt " + sample("shoulder", ms).toFixed(1) + " / " + sample("lap", ms).toFixed(1) + " kN";
  if (v1.readout.textContent !== text) v1.readout.textContent = text;
  const phase = phase1(ms);
  v1.stage.setAttribute("aria-valuenow", String(Math.round(ms)));
  if (phase !== said1) { said1 = phase; v1.tag.textContent = phase; v1.stage.setAttribute("aria-valuetext", Math.round(ms) + " milliseconds, " + phase); }
}
// the sled clock runs in milliseconds of crash time, shown 32 times slower
const SLOW = 32, HOLD = 1.6;
const SLED_LEN = (END / 1000) * SLOW + HOLD;
clockFor(v1, { length: SLED_LEN, slowAt: () => SLOW / 1000, still: (${PEAK.at} / 1000) * SLOW, draw: (t) => draw1(Math.min(END, (t / SLOW) * 1000)) });

// ---- Fig 2: the retractor on its bench ----
const v2 = partsOf(document.querySelectorAll(".iso-stage")[1]);
const P2 = ${JSON.stringify(P2)};
const segAt = (t) => RT_SEGS.find((s) => t >= s.from && t < s.to) || RT_SEGS[RT_SEGS.length - 1];
const chips = [...document.querySelectorAll("[data-seg]")];
let said2 = "";
function draw2(t) {
  const P = P2;
  const p = rt("p", t), r = rt("r", t), turn = rt("turn", t), fly = rt("fly", t), pawl = rt("pawl", t), ball = rt("ball", t), locked = rtAt("lock", t);
  const rs = r / MM, rd = Math.sqrt(DRUM_CORE * DRUM_CORE + (WEB_T * p) / Math.PI) / MM;
  const roll = rollY(SPOOL[0], SPOOL[1], rs, SPOOL_Y[0], SPOOL_Y[1], P);
  setShape(v2.roll, roll.fill); v2["roll-end"].setAttribute("d", roll.end);
  setShape(v2["drum-roll"], rollY(DRUM[0], DRUM[1], rd, DRUM_Y[0], DRUM_Y[1], P).fill);
  const tan = crossTangent(SPOOL, rs, DRUM, rd);
  setWeb(v2["drum-web"], webbing([[tan.t1[0], 82, tan.t1[1]], [tan.t2[0], 82, tan.t2[1]]], [[tan.n[0], 0, tan.n[1]], [tan.n[0], 0, tan.n[1]]], HW, P));
  // the spool turns with every millimetre paid out; the drum turns the other way as it takes the webbing up
  v2.teeth.setAttribute("d", ratchetTeeth(-turn, SPOOL[0], SPOOL[1], RATCHET_R, RATCHET_Y[1] + 0.05, TEETH, P));
  const fw = flyweightOf(turn, fly, SPOOL[0], SPOOL[1], RATCHET_Y[1] + 0.1, FLY, P);
  setShape(v2.fly, fw.d); v2["fly-pin"].innerHTML = dotsSvg([fw.pin], { size: 0.5, tone: "hi" });
  const sp = spiralOf(turn, SPOOL[0], SPOOL[1], SPIRAL_Y, 0.9, CASSETTE.rIn, SPRING_TURNS, P);
  v2.spiral.setAttribute("d", sp.d); v2.arbor.setAttribute("d", sp.slot);
  const drumTurn = ((2 * Math.PI) / WEB_T) * (rd * MM - DRUM_CORE);
  const ticks = dialTicks(drumTurn, DRUM[0], DRUM[1], DIAL.y[1] + 0.02, DIAL.r - 0.4, 24, P);
  v2["dial-minor"].setAttribute("d", ticks.minor); v2["dial-major"].setAttribute("d", ticks.major);
  drawPawlAndBall(v2, P, pawl, ball);
  const seg = segAt(t);
  const by = seg.id === "jerk" ? "webbing lock" : "vehicle lock";
  const state = locked ? by : pawl > 0.02 ? (seg.id === "jerk" ? "flyweight out" : "ball rolling") : "free";
  const phase = seg.name + " · " + state + (seg.slow > 1 ? " · ×" + seg.slow + " slow" : "");
  const text = p.toFixed(0) + " mm out · rewind " + rt("F", t).toFixed(1) + " N · roll Ø" + (2 * r).toFixed(0) + " mm";
  if (v2.readout.textContent !== text) v2.readout.textContent = text;
  v2.stage.setAttribute("aria-valuenow", t.toFixed(1));
  if (phase !== said2) {
    said2 = phase; v2.tag.textContent = phase; v2.stage.setAttribute("aria-valuetext", phase);
    chips.forEach((chip) => chip.setAttribute("aria-pressed", chip.dataset.seg === seg.id ? "true" : "false"));
  }
}
const clock2 = clockFor(v2, { length: RT_LENGTH, slowAt: () => 0.025, still: RT_STILL, draw: draw2 });
chips.forEach((chip) => chip.addEventListener("click", () => { const seg = RT_SEGS.find((s) => s.id === chip.dataset.seg); clock2.play(seg.from); v2.stage.focus({ preventScroll: true }); }));
`;

const stageHtml = (svg, label, max, text) => `<div class="iso-stage" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="0" aria-valuetext="${text}">${svg}</div><div class="sb-phase" aria-live="polite">${text}</div>`;

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
  caption: `A 56 km/h frontal sled test, slowed 32 times. The sled stops with a ${PULSE.peak} g half-sine pulse over ${PULSE.ms} ms while the dummy carries on forward. The belt holds it at three points: the D-ring above the outboard shoulder, the buckle at the inboard hip and the lap anchor on the sill. The retractor's ball trips at ${SENSOR.trip} g and the spool locks ${sim.lockAt.toFixed(1)} ms in, after ${series.payout.at(-1).toFixed(1)} mm of payout. The shoulder belt peaks at ${PEAK.shoulder.toFixed(1)} kN near ${Math.round(PEAK.at)} ms, the lap belt at ${PEAK.lap.toFixed(1)} kN, and the chest travels ${PEAK.chest.toFixed(0)} mm. Readout: time, sled deceleration, chest travel, shoulder / lap belt load. Spring-damper model: ${CHEST.m} kg on the shoulder belt, ${PELVIS.m} kg on the lap belt; no pretensioner or load limiter.`,
  body: stageHtml(svg1, "Seat belt on a crash sled: arrow keys step through the crash, Shift for 10 ms, Space plays or pauses", Math.round(SLED_LEN_FOR_ARIA()), "free spool"),
});
function SLED_LEN_FOR_ARIA() { return END; }

const F0 = RT.springForce(0), FW = RT.springForce(RT.WORN), FO = RT.springForce(RT.OUT);
const jerkLock = rtRows.find((r) => r.seg === "jerk" && r.locked), brakeLock = rtRows.find((r) => r.seg === "brake" && r.locked);
const chipsHtml = `<div class="sb-modes" role="group" aria-label="Play one step">${["pull", "letgo", "jerk", "brake", "stow"].map((id) => `<button type="button" class="sb-chip" data-seg="${id}" aria-pressed="false">${RT.SEGMENTS.find((s) => s.id === id).name}</button>`).join("")}</div>`;
const fig2 = k.plateHtml({
  fig: "Fig 2",
  title: "Inside the retractor",
  hint: "Drag to scrub",
  readout: `0 mm out · rewind ${F0.toFixed(1)} N · roll Ø${(2 * RT.STOWED_R).toFixed(0)} mm`,
  keys: [
    { mark: "lit", label: "Webbing: wound on the spool, pulled by the drum" },
    { mark: "raised", label: "Lock end: lock wheel, flyweight, pawl, ball sensor, spring cassette" },
    { mark: "dim", label: "Test bench: pull drum and dial stand in for the occupant" },
  ],
  caption: `The retractor in one cycle, from stowed to stowed. Pull out: the spool pays out webbing and winds the flat spiral spring tighter, so the rewind pull grows from ${F0.toFixed(1)} N stowed to ${FO.toFixed(1)} N at ${RT.OUT} mm out; the roll also shrinks from ${(2 * RT.STOWED_R).toFixed(0)} to ${(2 * RT.rollRadius(RT.OUT)).toFixed(0)} mm across, which raises the pull for the same spring torque. Let go: the spring takes the slack back, leaving ${FW.toFixed(1)} N on a buckled occupant. Jerk: webbing accelerating out faster than ${RT.WEBBING_LOCK.g} g leaves the flyweight behind; it swings out and steers the pawl in, locking after ${(jerkLock.p - RT.WORN).toFixed(1)} mm. Brake: at ${RT.VEHICLE_LOCK.g} g the ball rolls up its cone and lifts the pawl, locking after ${(brakeLock.p - RT.WORN).toFixed(1)} mm. Either lock holds while loaded and lets go once the spring winds back ${RT.UNLOCK.back} mm. Stow: the spring winds everything back in. Real retractors usually put the spring cassette on the other end of the spool; here it is drawn on the lock end with its cover cut away so both show. Readout: webbing out, rewind pull, roll diameter.`,
  body: stageHtml(svg2, "Seat belt retractor on a test bench: arrow keys step through the cycle, Space plays or pauses, or pick a step below", RT.LENGTH, "Stowed · free") + chipsHtml,
});

const extraCss = `<style>.iso-plate{margin-bottom:28px}.sb-phase{position:absolute;top:33px;left:50%;transform:translateX(-50%);font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--anatomy-strong);white-space:nowrap;pointer-events:none}.iso-stage{cursor:ew-resize;touch-action:pan-y}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}.sb-modes{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:14px}.sb-chip{font:inherit;font-family:var(--anatomy-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-text);background:transparent;border:1px solid var(--anatomy-lo);padding:6px 10px;cursor:pointer}.sb-chip:hover{border-color:var(--anatomy-mid);color:var(--anatomy-strong)}.sb-chip[aria-pressed="true"]{border-color:var(--anatomy-hi);color:var(--anatomy-strong)}.sb-chip:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}@media (max-width:560px){.sb-phase{top:36px;font-size:9.5px}}</style>`;

const file = theme === "light" ? "seat-belt-light.html" : "seat-belt.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Three-point seat belt", theme, body: extraCss + fig1 + fig2, script: kitScript() + live }));
console.log("wrote", file, "· sled lock", sim.lockAt.toFixed(1), "ms · jerk lock +", (jerkLock.p - RT.WORN).toFixed(1), "mm · brake lock +", (brakeLock.p - RT.WORN).toFixed(1), "mm");
