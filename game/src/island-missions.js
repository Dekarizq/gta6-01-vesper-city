// island-missions.js — story missions 16, 17, 18, 19 and 20 for
// Sunset Kings v7. Vesper City crowned Mara King of Vesper in mission
// 15, but a king who only holds one city is a king with a ferry
// problem: across the water, Ember Isle runs its own game, its own
// crew — the Ember Kings — and its own volcano, and the island's
// fixer, Old Tomas, has been waiting for a driver who can outrun a
// lava flow. The island arc plays entirely on Ember Isle: the ferry
// in, the volcano, the black beach, the lighthouse, and a finale that
// only opens when Mara owns an island business at level 2 and holds
// 3,000 respect — a ruler who cannot hold the island shops cannot
// hold the island.
//   16 EMBER LANDING — the ferry in, the village, the first job.
//   17 VOLCANO RUN — the lava road, the rim, the bar.
//   18 BLACK SAND — the beach, the smugglers, the lighthouse.
//   19 FERRY HEIST — the Ember Kings hit the ferry; take it back.
//   20 KING OF EMBER — the finale: hold the volcano, the resort and
//     the dock against the Ember Kings, then bring the crown home.
// Every step sits on an island road, a named island point, or a
// business spot, so building collision can never trap a target —
// nothing is ever placed inside a building, in the lava, or out in
// the sea. The steps reuse the island's own road grid, not the city's.
import { islandPoints, islandRoadPoint } from './island.js';

function pt(x, z, text, kind) { return { x, z, text, kind: kind || 'goto' }; }
function road(ix, iz, text, kind) { const p = islandRoadPoint(ix, iz); return pt(p.x, p.z, text, kind); }

// The gate for the island finale: an island business at level 2 and
// 3,000 respect. Returns {ok, missing} — missing names what Mara
// still needs, so the game can tell her instead of refusing silently.
export function islandGateMet(islandBusiness, respectPoints) {
  const maxLevel = islandBusiness ? islandMaxLevelOf(islandBusiness) : 0;
  const missing = [];
  if (maxLevel < 2) missing.push('an island business at level 2 (press B near a FOR SALE board on Ember Isle)');
  if (respectPoints < 3000) missing.push(`3,000 respect (you have ${respectPoints})`);
  return { ok: missing.length === 0, missing };
}

// Local max-level reader, kept here so this module never imports the
// whole island-business system just to ask one question.
function islandMaxLevelOf(islandBusiness) {
  let best = 0;
  const owned = (islandBusiness && islandBusiness.owned) || {};
  for (const id of Object.keys(owned)) {
    const lvl = owned[id] && owned[id].level;
    if (Number.isInteger(lvl)) best = Math.max(best, lvl);
  }
  return best;
}

// The five island missions. Each one carries a giver, a reward, a
// respect payout, an intro line the fixer speaks when Mara starts it,
// a brief the HUD can show, an outro the game reads when it ends, and
// a chain of steps the player drives or walks. The dialogue is the
// island talking: Old Tomas is dry, Lena is impatient, Dario is
// already counting the money.
export function buildIslandMissions(island) {
  const pts = island ? island.points : islandPoints();
  return [
    {
      id: 16, title: 'Ember Landing', giver: 'Old Tomas', reward: 2200, respect: 220,
      district: 'Ember Isle',
      intro: 'Old Tomas: "So the King of Vesper finally takes the ferry. The island eats kings, girl — walk the village first, then we will talk."',
      brief: 'Mara steps off the ferry onto Ember Isle for the first time. Old Tomas, the island fixer, wants her to learn the island on foot before she drives it: walk the dock plaza, meet the fishermen in the village square, and report to the night market — the island is watching her, and it has not decided whether it likes her yet.',
      outro: 'The village nods as Mara passes and the market sellers call her by name. Old Tomas almost smiles: "You walk like you belong here. Tomorrow, you drive like it."',
      steps: [
        pt(pts.ferryDock.x, pts.ferryDock.z, 'Step off the ferry at Ember Dock', 'goto'),
        pt(pts.villageSquare.x, pts.villageSquare.z, 'Meet the fishermen in Fisher Village', 'pickup'),
        pt(pts.fishStalls.x, pts.fishStalls.z, 'Buy the morning catch at the fish stalls', 'pickup'),
        pt(pts.nightMarket.x, pts.nightMarket.z, 'Report to Old Tomas at the night market', 'deliver'),
      ],
    },
    {
      id: 17, title: 'Volcano Run', giver: 'Old Tomas', reward: 3200, respect: 260,
      district: 'Ember Isle',
      intro: 'Old Tomas: "The volcano is restless and the bar at its foot owes me money. Drive the north road, take the rim, and bring the takings down — fast, before the lava decides to move."',
      brief: 'The Magma Bar sits at the foot of the volcano, and its takings are overdue. Mara drives the north road to the volcano base, climbs to the rim road for the view the tourists pay for, collects the bar takings, and brings them down to the church before the volcano reminds everyone it is still awake.',
      outro: 'The bar money is safe and the volcano, for once, stays where it is. Old Tomas counts the notes twice: "You drive like the lava is behind you. Keep it that way."',
      steps: [
        pt(pts.northRoad.x, pts.northRoad.z, 'Take the north road toward the volcano', 'goto'),
        pt(pts.volcanoBase.x, pts.volcanoBase.z, 'Reach the volcano base trail', 'goto'),
        pt(pts.volcanoRim.x, pts.volcanoRim.z, 'Climb to the volcano rim', 'goto'),
        pt(pts.volcanoBar.x, pts.volcanoBar.z, 'Collect the Magma Bar takings', 'pickup'),
        pt(pts.church.x, pts.church.z, 'Bring the takings to St. Ember Church', 'deliver'),
      ],
    },
    {
      id: 18, title: 'Black Sand', giver: 'Lena Voss', reward: 3600, respect: 280,
      district: 'Ember Isle',
      intro: 'Lena: "The smugglers use the black beach at night and the lighthouse keeper is paid to look away. Go down there, find their cove, and make the lighthouse see again."',
      brief: "Smugglers run the black-sand beach after dark, and the lighthouse keeper has been paid to look the other way. Lena sends Mara to the beach to find the smugglers cove, cut their boat loose at the dive shop, and climb to the lighthouse to relight the beam — the island own light, back on.",
      outro: 'The smugglers boat drifts out with the tide and the lighthouse beam sweeps the beach again. Lena grins in the dark: "The island sees you now, Mara. That is worth more than money."',
      steps: [
        pt(pts.blackBeach.x, pts.blackBeach.z, 'Reach the Black Sand Beach', 'goto'),
        pt(pts.smugglerCove.x, pts.smugglerCove.z, "Find the smugglers cove", 'pickup'),
        pt(pts.diveShop.x, pts.diveShop.z, 'Cut their boat loose at the dive shop', 'eliminate'),
        pt(pts.lighthouseGate.x, pts.lighthouseGate.z, 'Climb to the lighthouse gate', 'goto'),
        pt(pts.lighthouse.x, pts.lighthouse.z, 'Relight the Ember Light', 'deliver'),
      ],
    },
    {
      id: 19, title: 'Ferry Heist', giver: 'Dario Kess', reward: 4200, respect: 300,
      district: 'Ember Isle',
      intro: 'Dario: "The Ember Kings just hit the ferry — my money, my boat, my afternoon. Get to the dock, chase their speedboat to the resort, and take back what is mine."',
      brief: "The Ember Kings — the island own crew — have hit the ferry and taken Dario's money. Mara races to the dock, chases their speedboat along the south road to the resort, corners their lookout at the palm grove, and takes the money back to the dock before the next ferry sails.",
      outro: 'The money is back on the ferry and the Ember Kings are swimming home. Dario is already counting: "They hit my boat, Mara. Nobody hits my boat."',
      steps: [
        pt(pts.ferryDock.x, pts.ferryDock.z, 'Reach Ember Dock — the ferry was hit', 'goto'),
        pt(pts.southRoad.x, pts.southRoad.z, 'Chase the speedboat down the south road', 'goto'),
        pt(pts.resort.x, pts.resort.z, 'Corner the lookout at the Ember Resort', 'eliminate'),
        pt(pts.palmGrove.x, pts.palmGrove.z, 'Search the palm grove for the stash', 'pickup'),
        pt(pts.ferryDock.x, pts.ferryDock.z, 'Bring the money back to Ember Dock', 'deliver'),
      ],
    },
    {
      id: 20, title: 'King of Ember', giver: 'Old Tomas', reward: 8000, respect: 500,
      district: 'Ember Isle',
      intro: 'Old Tomas: "The Ember Kings are coming for the volcano, the resort and the dock — all of it, tonight. Hold the island, Mara. Hold all of it, and the crown is yours."',
      brief: 'The finale. The Ember Kings move on the whole island at once: the volcano rim, the resort, the night market and the dock. Mara must hold the rim, defend the resort, rally the market, and bring the crown home to the ferry — the island, the city and the storm, all in one night. Only a ruler who owns an island business at level 2 and holds 3,000 respect can even start it.',
      outro: 'The volcano glows, the resort lights come on, and the dock is quiet. Old Tomas bows his head: "Two cities, one crown. You are the King of Ember, Mara — and the hurricane can come now."',
      steps: [
        pt(pts.volcanoRim.x, pts.volcanoRim.z, 'Hold the volcano rim against the Ember Kings', 'eliminate'),
        pt(pts.resortPool.x, pts.resortPool.z, 'Defend the Ember Resort pool terrace', 'eliminate'),
        pt(pts.nightMarket.x, pts.nightMarket.z, 'Rally the night market', 'pickup'),
        pt(pts.church.x, pts.church.z, 'Ring the church bell — the island is yours', 'goto'),
        pt(pts.ferryDock.x, pts.ferryDock.z, 'Bring the crown home to Ember Dock', 'deliver'),
      ],
    },
  ];
}

// The island arc's own summary: how many island missions exist, what
// the finale needs, and what Mara earns for finishing the whole arc.
export function islandArcSummary() {
  return {
    missions: 5,
    firstId: 16,
    lastId: 20,
    finaleTitle: 'King of Ember',
    finaleGate: 'Island business level 2 + 3,000 respect',
    totalReward: 2200 + 3200 + 3600 + 4200 + 8000,
    totalRespect: 220 + 260 + 280 + 300 + 500,
  };
}

// The dialogue lines the island missions speak when Mara reaches a
// step — short, in character, and cheap to show in the dialog panel.
export const ISLAND_DIALOGUE = {
  16: [
    'Old Tomas: "Walk slow. The island watches strangers."',
    'Fisherman: "The catch is good today. The volcano is quiet."',
    'Seller: "Fresh fish, king. First day on the island is free."',
  ],
  17: [
    'Old Tomas: "The north road is lava-hot. Drive it anyway."',
    'Barman: "The takings are under the bar. The lava stays outside."',
    'Priest: "The church keeps the money. The volcano keeps the rest."',
  ],
  18: [
    'Lena: "The beach is black for a reason. Watch the tide."',
    'Diver: "Their boat is tied at my shop. Cut it loose."',
    'Keeper: "The light is out because someone paid me. Relight it."',
  ],
  19: [
    'Dario: "My money. My boat. My afternoon. Get it back."',
    'Lookout: "The Ember Kings do not run. We swim."',
    'Tourist: "Is this part of the tour? This is the best tour."',
  ],
  20: [
    'Old Tomas: "Hold the rim. Hold the resort. Hold the dock."',
    'Ember King: "The island was ours before you took the ferry."',
    'Mara: "Then the island is mine now. Tell the volcano."',
  ],
};

// A dialogue line for a mission step, by mission id and step index —
// the world loop can ask for one when a step completes.
export function islandDialogueLine(missionId, stepIndex) {
  const lines = ISLAND_DIALOGUE[missionId] || [];
  if (lines.length === 0) return null;
  return lines[stepIndex % lines.length];
}

// The island missions' own district names, so the HUD and the GPS
// can say "Ember Isle" instead of the city district under the ferry.
export function islandMissionDistrict(mission) {
  return (mission && mission.district) || 'Ember Isle';
}

// How far Mara has come through the island arc, as a fraction — the
// HUD can show it as a progress bar next to the mission card.
export function islandArcProgress(missionsState) {
  const done = (missionsState && missionsState.done) || 0;
  const islandDone = Math.max(0, Math.min(5, done - 15));
  return { done: islandDone, total: 5, fraction: islandDone / 5 };
}

// The island finale bonus, paid once when mission 20 completes —
// bigger than the city finale, because the island is further away
// and the Ember Kings hit harder.
export const ISLAND_FINALE_BONUS = 5000;

// The respect bonus for finishing the whole island arc, on top of
// the per-mission respect — the crown is worth more than the jobs.
export const ISLAND_ARC_RESPECT = 400;

// Check whether a mission id belongs to the island arc (16-20) —
// the world loop uses this to decide which finale bonus to pay and
// which gate to check before starting a mission.
export function isIslandMission(mission) {
  return !!mission && mission.id >= 16 && mission.id <= 20;
}

// The island missions' step kinds, for the sim and the tests: which
// steps are go-to, which are pickups, which are deliveries, which
// are eliminations, and which are escapes.
export function islandMissionKinds(mission) {
  const kinds = {};
  for (const s of mission.steps || []) {
    kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  }
  return kinds;
}

// Validate an island mission list the way the sim does: every mission
// has an id, a title, a giver, steps with coordinates on the island,
// and a reward. Returns a list of problems — empty means the arc is
// ready to drive.
export function validateIslandMissions(missions) {
  const problems = [];
  if (!Array.isArray(missions) || missions.length !== 5) {
    problems.push(`expected 5 island missions, got ${Array.isArray(missions) ? missions.length : 'none'}`);
    return problems;
  }
  for (const m of missions) {
    if (!m.id || m.id < 16 || m.id > 20) problems.push(`mission with bad id: ${m.id}`);
    if (!m.title) problems.push(`mission ${m.id} has no title`);
    if (!m.giver) problems.push(`mission ${m.id} has no giver`);
    if (!Array.isArray(m.steps) || m.steps.length === 0) problems.push(`mission ${m.id} has no steps`);
    for (const s of m.steps || []) {
      if (!Number.isFinite(s.x) || !Number.isFinite(s.z)) problems.push(`mission ${m.id} has a step without coordinates`);
      if (s.x < 490 || s.x > 910 || s.z < -210 || s.z > 210) problems.push(`mission ${m.id} step outside the island: ${s.x}, ${s.z}`);
    }
    if (!m.brief) problems.push(`mission ${m.id} has no brief`);
    if (!m.outro) problems.push(`mission ${m.id} has no outro`);
  }
  return problems;
}

// The island arc's own reward table: what each mission pays, in cash
// and respect, side by side, so Mara can see the whole arc before
// she takes the ferry.
export const ISLAND_MISSION_REWARDS = [
  { id: 16, title: 'Ember Landing', reward: 2200, respect: 220 },
  { id: 17, title: 'Volcano Run', reward: 3200, respect: 260 },
  { id: 18, title: 'Black Sand', reward: 3600, respect: 280 },
  { id: 19, title: 'Ferry Heist', reward: 4200, respect: 300 },
  { id: 20, title: 'King of Ember', reward: 8000, respect: 500 },
];

// The island arc's own outro lines: what the island says when Mara
// finishes the whole arc, one line per islander who watched her do it.
export const ISLAND_ARC_OUTRO_LINES = [
  'Old Tomas: "Two cities, one crown. The island is yours."',
  'Lena: "The island sees you now, Mara. That is worth more than money."',
  'Dario: "My money, my boat, my island. All yours, apparently."',
  'Fisherman: "The catch is good today. The King is home."',
  'Keeper: "The light is on, the beam is sweeping, and the King is home."',
];

// An outro line by index, for the end screen one day.
export function islandArcOutroLine(index) {
  return ISLAND_ARC_OUTRO_LINES[(index || 0) % ISLAND_ARC_OUTRO_LINES.length];
}
