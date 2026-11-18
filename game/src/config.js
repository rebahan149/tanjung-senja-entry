'use strict';
/* TANJUNG SENJA: LAST LIGHT — shared configuration, seeded RNG and game state.
   Everything in this project is original: the city, people, story and art
   were invented for this game. */

// ---------------------------------------------------------------- RNG ----
// mulberry32: small deterministic PRNG so screenshot modes are repeatable.
let _rngState = 123456789;
function seedRNG(seed) {
  _rngState = (seed >>> 0) || 1;
}
function RNG() {
  _rngState |= 0; _rngState = (_rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randRange(a, b) { return a + RNG() * (b - a); }
function randInt(a, b) { return Math.floor(randRange(a, b + 1)); }
function randPick(arr) { return arr[Math.floor(RNG() * arr.length) % arr.length]; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ------------------------------------------------------------- Layout ----
// Streets form a grid. Street centres sit on multiples of PITCH; blocks of
// BLOCK metres sit between them. West is -x (the sea), east is +x.
const PITCH = 54;          // distance between neighbouring street centres
const ROAD = 15;           // road width
const BLOCK = PITCH - ROAD; // 39 m building blocks
const GRID = 3;            // streets run from -GRID..GRID in both axes
const CITY_EDGE = GRID * PITCH + ROAD / 2 + 6; // ~175, kerb of the outer ring
const BEACH_X0 = -252;     // west edge of the sand
const BEACH_X1 = -CITY_EDGE - 4; // east edge of the sand (meets the city)
const WATER_X = BEACH_X0 - 4;    // water starts here and runs west

function streetCoord(i) { return i * PITCH; }
function blockCenter(i) { return (i + 0.5) * PITCH; } // i in -3..2

// Named places. Coordinates are world metres (x east, z south).
const PLACES = {
  harbourOffice: { x: -150, z: -140, name: 'Kantor Pelabuhan Lama' },
  gudang9:       { x: -135, z: -81,  name: 'Gudang 9' },
  pasarSenja:    { x: 27,   z: -27,  name: 'Pasar Senja' },
  pasarSouth:    { x: 81,   z: 27,   name: 'Pasar Senja Selatan' },
  pantai:        { x: -190, z: 110,  name: 'Pantai Senja' },
  lighthouse:    { x: -228, z: 196,  name: 'Mercusuar Tanjung' },
  safehouse:     { x: 96,   z: 128,  name: 'Rumah Aman Bukit Cahaya' },
  garage:        { x: 128,  z: 84,   name: 'Bengkel Cahaya' },
  tvTower:       { x: 135,  z: -135, name: 'Menara TV Senja' },
  policeStation: { x: -20,  z: 168,  name: 'Kantor Polisi Tanjung Senja' },
  clinic:        { x: 60,   z: -160, name: 'Klinik Pusat Kota' },
  raceStart:     { x: 108,  z: -54,  name: 'Start Balap — Pusat Kota' },
  larasKiosk:    { x: -96,  z: -150, name: 'Kios Laras' },
};

// -------------------------------------------------------------- State ----
const G = {
  mode: 'boot',           // title | playing | paused | busted | wasted | ended | shot
  shotMode: null,         // 'start' | 'play' | 'chase' | 'end' when ?shot= is set
  time: 17 * 60 + 35,     // in-game clock, minutes; the game lives at sunset
  money: 120,
  health: 100,
  wanted: 0,              // 0..5, fractional internally
  bustedMeter: 0,
  unseenTimer: 0,
  jobIndex: 0,            // next job to run (0-based); 9 == story finished
  hasPistol: false,
  shells: {},             // shell id -> true once collected
  shellsFound: 0,
  taxiFares: 0,
  raceBest: 0,
  stats: { jobsDone: 0, carsStolen: 0, earned: 0, bustedCount: 0, wastedCount: 0 },
  freeRoam: false,
  playerPos: { x: -140, z: -120 },
  muted: false,
};

const SAVE_KEY = 'tanjung-senja-last-light-save-v1';

function saveGame() {
  try {
    const data = {
      money: G.money, jobIndex: G.jobIndex, hasPistol: G.hasPistol,
      shells: G.shells, shellsFound: G.shellsFound, stats: G.stats,
      taxiFares: G.taxiFares, raceBest: G.raceBest,
      px: People.player.mesh.position.x, pz: People.player.mesh.position.z,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage may be unavailable; saving is best-effort */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function applySave(d) {
  if (!d) return false;
  G.money = d.money | 0; G.jobIndex = d.jobIndex | 0;
  G.hasPistol = !!d.hasPistol; G.shells = d.shells || {};
  G.shellsFound = d.shellsFound | 0; G.stats = d.stats || G.stats;
  G.taxiFares = d.taxiFares | 0; G.raceBest = d.raceBest | 0;
  if (typeof d.px === 'number') G.playerPos = { x: d.px, z: d.pz };
  return true;
}
