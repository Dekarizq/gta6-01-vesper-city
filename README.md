# gta6-01-vesper-city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Dekarizq/gta6-01-vesper-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Dekarizq/gta6-01-vesper-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Vesper City: Golden Hour — Sunset Kings — a sun-soaked open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty ($1,666 in USDC). Play as Mara Voss, getaway driver, through 10 story missions in a golden-hour coastal city under a 7-day hurricane countdown: drive and steal cars, outrun the police (wanted level 0-5, roadblocks, the CONDOR-1 helicopter with a searchlight, and named VCPD units with RAM / PIT / PURSUIT tactics), fight on foot with three weapons (FISTS, VESPER 9MM, MAKO SMG), and follow the dense HUD and circular minimap. Raw WebGL, no libraries, no network requests — fully offline static files.

## Sunset Kings — what v3 adds

- **Sunset Garage**: drive into the garage yard (south-east corner, gold sign) and press G. Buy ENGINE, ARMOUR and TYRES upgrades with real cash — they change top speed, acceleration, grip and how long a car lasts before it burns. Rook the mechanic cuts prices 15% once he joins.
- **Carjacking**: press E next to any car. Driven cars pay respect and wanted; every stolen car is named, from the Vesper S to the Storm King muscle car.
- **Radio**: press R to switch between three procedural stations — VESPER 98.1 Golden Hour Mix, SUNSET FM 101.5 Coast Drive, STORM RADIO 87.9 Weather Band. All music is synthesized WebAudio, no files, no network.
- **Respect & crew**: earn respect from missions, carjackings, Sun Coins and explosions. Climb STREET ROOKIE → SUNSET RUNNER → COAST DRIVER → GOLDEN HOUR LEGEND → SUNSET KING, and recruit Lena Voss, Rook and Dario Kess — each with a real bonus.
- **Cars that burn and explode**: shoot or ram a car enough and it catches fire, then blows up into a smoking wreck that stays on the road. Explosions pay respect and raise the heat.

## Sun Coins — the golden-hour side hunt

24 golden Sun Coins hide at named crossings across the city, from Sunset Mile to Surfer's corner. Drive or walk over one to pocket it — the HUD chip counts them (☀ SUN COINS n/24), and the nearest one is always a short drive away. Grab coins quickly to build a Sun Streak: every 6th chained coin pays a $50 streak bonus. Collect all 24 in one in-game day and Dario pays a $500 bonus. At dawn the coins are hidden again, so the hunt resets every morning. Progress saves with the game.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Controls: WASD/arrows drive & walk, E steal car, F/click shoot, 1/2/3 switch weapon, G Sunset Garage, R radio station, Space handbrake, Shift sprint/boost, Q mission, T restart mission, M map, P pause, U mute.

---

Entered on [make.fun](https://make.fun/?ref=0gqjvf82&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards
