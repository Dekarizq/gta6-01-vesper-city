// missions-arc.js — story missions 13, 14 and 15 for Sunset Kings v6.
// V5 ended at mission 12, "King of the Sunset", crowning Mara on the
// pier. V6 asks what a king does when the hurricane itself arrives:
// the storm front is on the city, the Tide Kings are back, and holding
// Vesper City takes more than a fast car. The arc plays in the two new
// districts and on the coast, and it is gated: the finale, "King of
// Vesper", only opens when Mara owns a level-2 business and holds
// 2,000 respect — a ruler who only steals never holds a city, so the
// game makes her prove she can hold one first.
//   13 STORM WARNING — the hurricane front hits the Marina: warn the
//     lighthouse keeper, tie the boats down, and get the warning to
//     the Harbor Docks before the surge.
//   14 NIGHT MARKET — Lena's takings are in Old Town and the VCPD
//     tail is on her: collect the money, hide it at the church, and
//     lose the tail in the north lanes.
//   15 KING OF VESPER — the finale: hold the Spire, the Marina and
//     the pier against the Tide Kings in the storm, then bring the
//     crown home to the Sunset Garage. Finish it and the city is yours.
// Every step sits on a road intersection, a coast point, a business
// spot or a district landmark, so building collision can never trap a
// target — nothing is ever placed inside a building or out in the sea.
import { roadCross } from './city.js';

function pt(x, z, text, kind) { return { x, z, text, kind: kind || 'goto' }; }
function cross(ix, iz, text, kind) { const p = roadCross(ix, iz); return pt(p.x, p.z, text, kind); }

// The gate for the finale: a level-2 business and 2,000 respect.
// Returns {ok, missing} — missing names what Mara still needs, so the
// game can tell her instead of silently refusing.
export function arcGateMet(business, respectPoints) {
  const maxLevel = business ? businessMaxLevelOf(business) : 0;
  const missing = [];
  if (maxLevel < 2) missing.push('a level-2 business (press B near a FOR SALE board)');
  if (respectPoints < 2000) missing.push(`2,000 respect (you have ${respectPoints})`);
  return { ok: missing.length === 0, missing };
}

// Local max-level reader, kept here so this module never imports the
// whole business system just to ask one question.
function businessMaxLevelOf(business) {
  let best = 0;
  const owned = (business && business.owned) || {};
  for (const id of Object.keys(owned)) {
    const lvl = owned[id] && owned[id].level;
    if (Number.isInteger(lvl)) best = Math.max(best, lvl);
  }
  return best;
}

export function buildArcMissions(city, coast) {
  const pier = coast ? coast.points.pierEnd : { x: -20, z: 300 };
  const dock = coast ? coast.points.boatDock : { x: 110, z: 280 };
  const boardwalk = coast ? coast.points.boardwalk : { x: 60, z: 250 };
  const marina = (city.landmarks || []).find((l) => l.id === 'marina') || { x: 180, z: 200 };
  const oldtown = (city.landmarks || []).find((l) => l.id === 'oldtown') || { x: 0, z: -200 };
  return [
    {
      id: 13, title: 'Storm Warning', giver: 'Dario Kess', reward: 2500, respect: 250, district: 'Marina District',
      intro: 'Dario: "The front is here, Mara. The surge comes with the tide — warn the lighthouse, tie the boats down, and get the word to the docks."',
      brief: 'The hurricane front is on the Marina. Before the surge, warn the lighthouse keeper, tie the boats down at the dock, and carry the warning to the Harbor Docks — the city cannot lose its harbour before the storm even lands.',
      outro: 'The Marina is warned and the boats are tied down. Dario nods: "The harbour holds — because you ran, Mara."',
      steps: [
        pt(marina.x, marina.z, 'Reach the Marina — the storm surge is coming', 'goto'),
        pt(238, 288, 'Warn the lighthouse keeper before the beam dies', 'pickup'),
        pt(dock.x, dock.z, 'Tie the boats down at the Boat Dock', 'deliver'),
        cross(8, 9, 'Carry the warning to the Harbor Docks', 'deliver'),
      ],
    },
    {
      id: 14, title: 'Night Market', giver: 'Lena Voss', reward: 2800, respect: 260, district: 'Old Town',
      intro: 'Lena: "The market takings are in Old Town and the VCPD tail is on me. Collect the money, hide it at the church, and lose them in the north lanes."',
      brief: 'Lena is carrying the night market takings through Old Town with a VCPD tail behind her. Meet her at the edge of the district, collect the money from the stalls, hide it at the church safe house, and lose the tail in the north lanes.',
      outro: 'The takings are safe behind the church door and the tail is gone. Lena laughs: "Old Town keeps its own, Mara — and now it keeps yours too."',
      steps: [
        cross(2, 1, 'Meet Lena at the edge of Old Town', 'pickup'),
        pt(-75, -198, 'Collect the night market takings from the stalls', 'pickup'),
        pt(0, -232, 'Hide the takings at the church safe house', 'deliver'),
        cross(5, 1, 'Lose the VCPD tail in the north lanes', 'escape'),
      ],
    },
    {
      id: 15, title: 'King of Vesper', giver: 'Dario Kess', reward: 5000, respect: 400, district: 'Vesper City',
      intro: 'Dario: "The Tide Kings are back in the storm, Mara. Hold the Spire, hold the Marina, finish it on the pier — and the whole city is yours."',
      brief: 'The finale. The Tide Kings came back with the storm to take the city while it is drowning. Hold the Storm Spire, hold the Marina, finish them on the pier at sunset, and bring the crown home to the Sunset Garage.',
      outro: 'The storm breaks over a city that is still yours. Dario raises a glass: "Fifteen jobs, one hurricane — and the crown stays in Vesper. King of Vesper, Mara."',
      steps: [
        cross(4, 5, 'Reach the Storm Spire — the whole city is watching', 'goto'),
        pt(marina.x, marina.z, 'Hold the Marina against the Tide Kings', 'eliminate'),
        pt(pier.x, pier.z, 'Finish it on the pier at sunset', 'eliminate'),
        cross(8, 8, 'Bring the crown home to the Sunset Garage', 'deliver'),
      ],
    },
  ];
}

// How many story missions the arc adds (12 from v5 + 3 here = 15).
export const ARC_MISSION_COUNT = 3;
export const TOTAL_MISSIONS = 15;

// The arc finale's own reward: finishing mission 15 pays a crown
// bonus on top of the mission reward, once, in the world loop.
export const ARC_FINALE_BONUS = 2000;
export const ARC_FINALE_TITLE = 'KING OF VESPER';

// The arc's story beats, for the HUD and the dossier: one line each,
// in order, so the game can say where Mara is in the story.
export const ARC_BEATS = [
  'The storm front hits the Marina.',
  'The night market takings are in Old Town.',
  'Hold the Spire, the Marina and the pier — and the city is yours.',
];

// The arc mission brief by id — the paragraph the title screen and
// the mission panel show before Mara starts, so the player knows the
// stakes of 13, 14 and 15 before driving into them.
export function arcMissionBrief(id) {
  const all = [
    { id: 13, brief: 'The hurricane front is on the Marina. Warn the lighthouse, tie the boats down, and carry the warning to the docks before the surge.' },
    { id: 14, brief: 'Lena is carrying the night market takings through Old Town with a VCPD tail behind her. Collect, hide, and lose the tail.' },
    { id: 15, brief: 'The finale: hold the Spire, the Marina and the pier against the Tide Kings in the storm, then bring the crown home.' },
  ];
  const found = all.find((m) => m.id === id);
  return found ? found.brief : '';
}

// The arc mission outro by id — the line the game shows when the
// mission completes, the payoff for the brief.
export function arcMissionOutro(id) {
  const all = [
    { id: 13, outro: 'The Marina is warned and the boats are tied down. The harbour holds — because you ran.' },
    { id: 14, outro: 'The takings are safe behind the church door and the tail is gone. Old Town keeps its own.' },
    { id: 15, outro: 'The storm breaks over a city that is still yours. King of Vesper.' },
  ];
  const found = all.find((m) => m.id === id);
  return found ? found.outro : '';
}
