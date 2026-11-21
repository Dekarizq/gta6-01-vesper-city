// missions-extra.js — story missions 11 and 12 for Sunset Kings v4.
// V3 ended at mission 10, "Eye of the Storm", crowning Mara the Sunset
// King. V4 asks what a king does the day after: the rival Tide Kings
// gang moves on the coast, and the city needs a ruler who can hold the
// beach as well as the streets.
//   11 TIDE RUNNER — a chase down the pier and boardwalk: the Tide
//     Kings stole Dario's ledger, and their runner is on the coast.
//   12 KING OF THE SUNSET — the finale: take the ledger back on the
//     pier at sunset, with the whole VCPD and the rival gang in the way,
//     then bring it home to the Sunset Garage. Finish it and the coast
//     is yours too.
// Both missions use the coast points (pier, boardwalk, boat dock) plus
// road intersections, so every step is reachable — nothing is ever
// placed inside a building or out in the sea.
import { roadCross } from './city.js';

function pt(x, z, text, kind) { return { x, z, text, kind: kind || 'goto' }; }
function cross(ix, iz, text, kind) { const p = roadCross(ix, iz); return pt(p.x, p.z, text, kind); }

export function buildExtraMissions(coast) {
  const pier = coast.points.pierEnd;
  const boardwalk = coast.points.boardwalk;
  const dock = coast.points.boatDock;
  const shack = coast.points.surfShack;
  return [
    {
      id: 11, title: 'Tide Runner', giver: 'Dario Kess', reward: 2000, respect: 220, district: 'Sunset Beach',
      intro: 'Dario: "The Tide Kings took my ledger and ran for the pier. They think the coast is theirs. Prove them wrong."',
      steps: [
        cross(5, 9, 'Reach the Harbor Docks — the runner was seen here', 'goto'),
        pt(boardwalk.x, boardwalk.z, 'Chase the runner down the Sunset Boardwalk', 'chase'),
        pt(pier.x, pier.z, 'Corner the Tide Runner at the end of the pier', 'eliminate'),
        pt(shack.x, shack.z, 'Search the Surf Shack for the dropped ledger page', 'pickup'),
      ],
    },
    {
      id: 12, title: 'King of the Sunset', giver: 'Lena Voss', reward: 4000, respect: 350, district: 'Marina District',
      intro: 'Lena: "One last run, Mara. The whole Tide Kings crew is on the pier at sunset. Take the ledger back — and take the coast."',
      steps: [
        cross(8, 8, 'Meet Lena at the Sunset Garage — gear up', 'pickup'),
        pt(dock.x, dock.z, 'Cut off the Tide Kings at the Boat Dock', 'eliminate'),
        pt(pier.x, pier.z, 'Take the ledger back on the pier at sunset', 'eliminate'),
        cross(8, 8, 'Bring the ledger home to the Sunset Garage', 'deliver'),
      ],
    },
  ];
}

// How many story missions the game has in total (10 from v3 + 2 here).
export const EXTRA_MISSION_COUNT = 2;
export const TOTAL_MISSIONS = 12;

// The finale's own reward: finishing mission 12 pays a crown bonus on
// top of the mission reward, once, in the world loop.
export const FINALE_BONUS = 1000;
export const FINALE_TITLE = 'KING OF THE SUNSET';
