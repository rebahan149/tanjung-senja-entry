[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rebahan149/tanjung-senja-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rebahan149/tanjung-senja-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Tanjung Senja: Last Light

An original open-world crime game built for the make.fun bounty
[**Make GTA 6**](https://make.fun/bounty/gta6-01) — a sunset harbour city,
on foot and by car, with traffic, police, a wanted system, nine story jobs
and a name to clear. Everything here — city, characters, vehicles, story,
art and music — was invented for this game.

## The story

Bima, a harbour launch pilot in the fictional Indonesian port city of
Tanjung Senja, has been framed for a phantom smuggling run that never
appeared on any manifest. Laras, a fixer who holds the one copy of the real
harbour ledger, offers him a way out: work **nine jobs** across the city —
a document run, market debts, tailing a warehouse truck, a hot delivery, a
witness rescue, a guarded warehouse raid, a decoy convoy, a lighthouse
signal, and a final five-star dash to the TV Senja tower — and the ledger
clears his name on live television.

## Features

- **A full 3D city** (three.js): a ~12×12-block road grid with five named
  districts — Pelabuhan Lama harbour (cranes, containers, warehouses),
  Pasar Senja market (canvas-canopy stalls), Pantai Senja beach and
  promenade, Bukit Cahaya housing hill, and the Pusat Kota downtown towers
  with the Menara TV Senja mast. Sunset gradient sky, warm directional
  light with shadows, fog, an animated sea, sand beach, palms and glowing
  street lamps.
- **On foot**: third-person follow camera with drag-look, sprint, fists,
  and a pistol (picked up in job 6) with raycast shooting and muzzle flash.
- **Driving**: five box-built vehicles (hatchback, sedan, taksi, pickup,
  truck), parked cars to take, traffic AI that follows lanes, turns at
  intersections and stops for obstacles, arcade physics, building and
  car-to-car collisions, and carjacking (the driver bails and runs — and
  the police notice).
- **Pedestrians** stroll the sidewalks, flee gunshots and crashes, and
  getting hit by a car raises your wanted level.
- **Wanted system 0–5 stars**: crimes raise it, police cars spawn and ram,
  roadblocks appear at 3 stars, a spotlight **helicopter** joins at 4+,
  a busted meter fills when the police corner you, and heat decays when
  you break line of sight. **Bengkel Cahaya** garage clears your wanted
  level for a fee.
- **BUSTED** and **WASTED** screens with fines and respawns at the police
  station / clinic; health regenerates when the heat is off.
- **Nine story jobs** with dialogue, plus side content: **taxi fares**,
  a six-checkpoint **street race**, and **10 hidden golden shells**
  (kerang emas) worth cash.
- **HUD**: money, in-game clock, wanted stars, busted meter, health bar,
  live objective with distance, mission banners, speedometer, radio
  station toast — and a **live minimap** with roads, sea, mission marker,
  police blips, garage and safehouse icons.
- **Synthesized audio** (WebAudio, no files): three radio stations with
  distinct generated loops — *Senja FM* (mellow pop), *Koplo Pantura*
  (dangdut-koplo beat), *Pelabuhan Blues* — an engine hum tied to speed,
  police sirens, and punch / crash / pickup / cash / gunshot effects.
- **Menus & save**: title screen with story intro, New Game / Continue,
  pause, an ending screen with full stats and free-roam continue, and
  `localStorage` saves (money, job progress, shells, position).
- **Deterministic screenshot modes** (`?shot=start|play|chase|end&seed=1`)
  that stage fixed scenes with a seeded RNG: the title vista, on foot in
  Pasar Senja, a four-star helicopter chase, and the ending screen.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse drag | Move camera |
| Shift | Sprint |
| E or F | Enter / exit car |
| Mouse click | Punch (or fire the pistol once you have it) |
| R | Cycle radio station (while driving) |
| P / Esc | Pause |
| M | Mute |
| Enter / click | Advance dialogue |

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080
# then open http://localhost:8080 in a desktop browser
```

No build step and no network requests: the game is plain scripts under
`game/` plus a vendored copy of three.js.

## Screenshots

The four images in `screenshots/` are real renders of the game's own code,
produced by serving the game and capturing the deterministic shot modes
with a headless browser, e.g.:

```sh
node serve.ts --port 8093 &
chrome --headless --screenshot=out.png "http://localhost:8093/?shot=chase&seed=1"
```

`shots.json` at the repository root lists the four shots and their query
strings. The images are then resized to 1024 px wide JPEGs.

## Tech notes

- `game/lib/three.min.js` is the three.js r160 UMD build, vendored
  unchanged. three.js is © its authors and used under the **MIT licence**
  (see https://github.com/mrdoob/three.js/blob/dev/LICENSE).
- All game code (`game/src/*.js`, plain scripts loaded in dependency
  order, no modules, no build) and all art/music were written for this
  entry. Building textures (lit windows), the sky gradient and glow
  sprites are generated on canvas at runtime; all sound is synthesized
  with WebAudio.
- `main.ts` (kit plumbing, unchanged) copies `game/` and `screenshots/`
  to the output directory and writes `dossier.json` via the vendored
  `vendor/makefun-game.ts` library.
