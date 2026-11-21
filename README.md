# gta6-01-vesper-city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Dekarizq/gta6-01-vesper-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Dekarizq/gta6-01-vesper-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Vesper City: Golden Hour — Sunset Kings v5 — a sun-soaked open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty ($1,666 in USDC). Play as Mara Voss, getaway driver, through 12 story missions in a golden-hour coastal city under a 7-day hurricane countdown: drive and steal cars, outrun the police (wanted level 0-6, roadblocks, spike strips, the CONDOR-1 helicopter with a searchlight, and named VCPD units with RAM / PIT / PURSUIT / SPIKE / BLOCKADE tactics), fight on foot with four weapons (FISTS, VESPER 9MM, MAKO SMG, GOLDEN 12-GAUGE shotgun on a hold-Q weapon wheel), work side jobs on the Sunset Beach coast, and follow the GPS route line on the dense HUD and circular minimap. Raw WebGL, no libraries, no network requests — fully offline static files.

## Sunset Kings v5 — what v5 adds

- **Visual overhaul**: every tower now has a real facade — a grid of windows, some lit gold, some dark glass — plus roof furniture (water tanks, antennas, beacons, rooftop gardens), street lamps, street trees, billboards, benches and hydrants. The sky is alive too: clouds drift east, birds cross the sunset, and sea glints slide with the tide.
- **Two new districts**: the **Marina District** (white yachts, harbour cranes, container stacks, a lighthouse with a rotating beam, fish-market stalls) and **Old Town** (brick lanes, a night market with striped awnings and warm lamps, chimneys with drifting smoke, a church tower, clotheslines). Both read as different places, with their own palettes and HUD names.
- **Denser, more varied streets**: 22 traffic cars (was 16) and 36 pedestrians (was 26), five new car models — Sunset Viper sports car, Dune Hauler pickup, Gold Limo, City Hatch and the Vesper Bus — with real lengths, metallic paint, spoilers and roof racks. Runners and tourists join the crowd.
- **More to find**: 6 new Sun Coins in the new districts (36 total), a fifth radio station (MARINA 99.9 Yacht Rock), a CHROME garage upgrade, a seventh respect rank (VESPER LEGEND), seagull cries over the marina, and H hides the HUD for clean screenshots. Side jobs now end in the new districts: taxi fares to Old Town, deliveries to the Marina fish market.

## Sunset Kings v4 — what v4 adds

- **Weapon wheel**: hold Q and the wheel opens — FISTS, VESPER 9MM, MAKO SMG and the new GOLDEN 12-GAUGE shotgun. Point the mouse at a slot and release Q to lock it in. A quick tap of Q still starts the next story mission.
- **Missions 11–12 on the coast**: "Tide Runner" chases the rival Tide Kings down the pier and boardwalk; "King of the Sunset" is the finale on the pier at sunset, with a $1,000 crown bonus. 12 missions total.
- **Sunset Beach coast**: a wooden pier over the sunset water, a boardwalk with stalls, a boat dock with five bobbing boats, a lifeguard tower, surfers, sunbathers, and a tide that breathes in and out. The beach is a district of its own now.
- **Side jobs (J)**: repeatable taxi fares, dock deliveries and street races against the clock — paid in cash and respect, with a par-time bonus on races. NITRO (new garage upgrade) was built for the race starts.
- **Spike strips & wanted 6**: at 4+ stars, VCPD-52 (Ofc. Duarte) lays spike strips across the road ahead. A flat tyre cuts top speed and grip until Rook patches it free at the Sunset Garage. Six stars brings five cruisers at once.
- **GPS route**: a gold trail on the road and the minimap leads to the live mission step or job target, with the next turn and distance on the HUD chip. Toggle with L.
- **Save slots (K)**: three slots — slot 1 autosaves after every mission and job, slots 2–3 are your checkpoints. Cycle with K.
- **Visual polish**: warmer fog and deeper sun shading, a bigger sun halo, long sunset shadows under every car, wheels / headlights / taillights / rims on every car, an open-top Coast Cruiser convertible, and a bigger, lower CONDOR-1 with a red cheatline and a fatter searchlight.

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

Then open http://localhost:8080 in desktop Chrome. Controls: WASD/arrows drive & walk, E steal car, F/click shoot, 1/2/3/4 switch weapon, hold Q weapon wheel / tap Q mission, G Sunset Garage, R radio station (4 stations), J side job, L GPS route, K save slot, Space handbrake, Shift sprint/boost, T restart mission, M map, P pause, U mute.

---

Entered on [make.fun](https://make.fun/?ref=0gqjvf82&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards
