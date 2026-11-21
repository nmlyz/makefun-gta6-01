[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nmlyz/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nmlyz/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay — a top-down open-world crime game

An original open-world crime game. Everything — city, characters, vehicles, names, art and rules — is
original; nothing is taken from any commercial game. It plays in a desktop
browser straight from static files: no build step, no network, no libraries,
just vanilla JavaScript and a canvas.

## Play

Serve `game/` with any static file server (or run `node serve.ts` in this
repository) and open `game/index.html`. You can also just open the file in a
browser that allows local module scripts.

- **WASD / arrow keys** — walk, and drive when you are in a car
- **E** — get into the nearest car (or get out). Parked cars are a quiet
  felony; taking a moving one is a carjacking and the city notices
- **Shift** — run on foot
- **P / Esc** — pause · **Space / Enter / click** — start and restart

## The game

Neon Bay is a seeded city of 88 blocks: a road grid with lane markings and
crosswalks, roofed buildings, parks and parking lots, traffic that drives the
grid and brakes for trouble, and pedestrians who stroll the sidewalks and dive
away from fast cars.

- **Deliveries** — a glowing checkpoint is always waiting somewhere across
  town, with a countdown. Reach it for cash and score; miss it and a new one
  is posted.
- **Cash** — bundles spawn on the sidewalks. Grab them on foot or through a
  windscreen, either way they count.
- **Wanted stars** — carjackings, collisions and pedestrian strikes build
  wanted pressure, one star per notch, up to five. Police cars spawn across
  the city and hunt you: they ram a driven car and crowd a runner until the
  bust meter fills. Break their line of sight and the heat cools off.
- **Health** — hard crashes and police rams hurt. Lay low with no stars and
  you recover. At zero it is WASTED; cornered on foot, it is BUSTED.

Leave the keyboard alone and the game plays itself: the title screen runs an
attract game, an idle player is taken over by the autopilot after a few
seconds (any key takes the wheel back), and a finished run restarts on its
own. `?seed=N` pins the city and every random choice, which is also how the
screenshots in `screenshots/` were staged: `?shot=start|play|end&seed=1`
renders the title, a mid-chase delivery run, and the game-over screen,
deterministically.

## Layout

- `game/index.html` — the page
- `game/src/` — the game itself: `world.js` (city, rules, AI), `pilot.js`
  (the autopilot), `render.js` (canvas drawing, HUD, minimap), `input.js`,
  `shots.js` (screenshot scenes), `config.js` (tuning), `random.js` (the
  seeded generator), `main.js` (the loop)
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored library in
  `vendor/`
- `serve.ts` — a tiny local server for `game/` on http://localhost:8080
- `shots.json` — the screenshot scenes and their file names

## License

MIT — see `LICENSE`.
