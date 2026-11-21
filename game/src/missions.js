// missions.js — the 12-mission story of the Sunset Kings (v4): Mara Voss,
// getaway driver with one week before Hurricane Ilsa drowns the city,
// works for fixer Dario Kess to buy her way out — and along the way she
// builds a crew and a reputation. Each mission is a chain of go-to steps;
// finishing one pays cash and respect, and the crew bonuses stack: Lena
// adds 10% mission cash, Rook cuts garage prices, Dario doubles streaks,
// and Kai adds 15% side-job cash once he joins on the coast.
// EVERY step sits on a road intersection (roadCross) or a named coast
// point (pier, boardwalk, boat dock), so building collision can never
// trap a target — the old (0,0) Storm Spire targets are gone. v3 mission
// 3 now ends at the Sunset Garage, mission 10 is the coronation run,
// and v4 adds missions 11-12 (see missions-extra.js): the Tide Runner
// chase down the pier, and the King of the Sunset finale on the coast.
import { roadCross } from './city.js';
import { buildExtraMissions } from './missions-extra.js';

function pt(x, z, text, kind) { return { x, z, text, kind: kind || 'goto' }; }
function cross(ix, iz, text, kind) { const p = roadCross(ix, iz); return pt(p.x, p.z, text, kind); }

export function buildMissions(city, coast) {
  const base = [
    { id: 1, title: 'First Fare', giver: 'Dario Kess', reward: 350, respect: 120,
      intro: 'Dario: "Seven days till the storm, Mara. Drive like you mean it."',
      steps: [cross(1, 1, 'Pick up the courier on Sunset Mile', 'pickup'),
              cross(8, 2, 'Drop the package at Sunset Shore', 'deliver')] },
    { id: 2, title: 'Rain Courier', giver: 'Dario Kess', reward: 500, respect: 120,
      intro: 'A rival crew is watching the docks. Take the long way, fast.',
      steps: [cross(2, 8, 'Collect the storm charts at the hospital corner', 'pickup'),
              cross(5, 9, 'Deliver them to the Harbor Docks', 'deliver')] },
    { id: 3, title: 'The Getaway', giver: 'Lena Voss', reward: 800, respect: 150,
      intro: 'Lena: "The crew hit the Glass Quarter vault. Get them out — now."',
      steps: [cross(4, 4, 'Reach the crew at the Glass Quarter corner', 'pickup'),
              cross(8, 8, 'Lose the heat, then reach the Sunset Garage', 'escape')] },
    { id: 4, title: 'Storm Chaser', giver: 'Dario Kess', reward: 650, respect: 120,
      intro: 'Drive the weather crew through the flooded south roads.',
      steps: [cross(3, 9, 'Pick up the weather crew by the harbor road', 'pickup'),
              cross(9, 1, 'Reach the Sunset Shore relay station', 'deliver')] },
    { id: 5, title: 'Rescue Run', giver: 'Lena Voss', reward: 900, respect: 150,
      intro: 'A bus is stranded on the bridge in the rising water. Go.',
      steps: [cross(5, 9, 'Reach the stranded bus on the harbor road', 'pickup'),
              cross(2, 8, 'Bring the survivors to St. Mara Hospital', 'deliver')] },
    { id: 6, title: 'The Vault Job', giver: 'Dario Kess', reward: 1400, respect: 180,
      intro: 'Quiet in, loud out. The Glass Quarter vault holds the storm fund.',
      steps: [cross(5, 5, 'Reach the Glass Quarter vault corner', 'goto'),
              cross(8, 8, 'Escape with the storm fund to the Sunset Garage', 'escape')] },
    { id: 7, title: 'Double Cross', giver: 'Rook', reward: 1100, respect: 180,
      intro: 'Rook sold you out. Take the ledger back from his crew.',
      steps: [cross(1, 1, 'Confront Rook\'s crew on Sunset Mile', 'eliminate'),
              cross(2, 1, 'Recover the ledger', 'pickup')] },
    { id: 8, title: 'Blackout', giver: 'Dario Kess', reward: 1300, respect: 180,
      intro: 'The grid is failing. Escort the repair convoy across town.',
      steps: [cross(1, 8, 'Meet the repair convoy', 'pickup'),
              cross(9, 9, 'Escort them to the east substation', 'deliver')] },
    { id: 9, title: 'The Last Ferry', giver: 'Lena Voss', reward: 1600, respect: 200,
      intro: 'One ferry leaves before the hurricane. Get Lena to the docks.',
      steps: [cross(8, 2, 'Pick up Lena at Sunset Shore', 'pickup'),
              cross(5, 9, 'Reach the last ferry at the Harbor Docks', 'deliver')] },
    { id: 10, title: 'Eye of the Storm', giver: 'Dario Kess', reward: 3000, respect: 300,
      intro: 'The final score: the storm fund, the spire, the whole city watching. Finish this and you are the Sunset King.',
      steps: [cross(4, 5, 'Reach the spire corner in the eye of the storm', 'goto'),
              cross(5, 9, 'Escape to the harbor with the fund', 'escape')] },
  ];
  // v4: missions 11-12 live on the coast — the Tide Kings move in the
  // day after the coronation, and the story continues onto the pier.
  // When no coast is passed (unit tests), the base 10 still stand.
  if (coast) return base.concat(buildExtraMissions(coast));
  return base;
}

export function createMissionState(missions) {
  return { list: missions, index: 0, step: 0, active: false, done: 0, startedAt: 0 };
}

export function currentMission(state) {
  return state.index < state.list.length ? state.list[state.index] : null;
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.step] : null;
}

// Advance when the player reaches the step marker; returns 'step' | 'done' | null.
export function updateMission(state, px, pz, dt) {
  if (!state.active) return null;
  const step = currentStep(state);
  if (!step) return null;
  const dx = px - step.x, dz = pz - step.z;
  const radius = step.kind === 'eliminate' ? 14 : 9;
  if (dx * dx + dz * dz < radius * radius) {
    state.step += 1;
    const m = currentMission(state);
    if (state.step >= m.steps.length) {
      state.active = false;
      state.done += 1;
      state.index += 1;
      state.step = 0;
      return 'done';
    }
    return 'step';
  }
  return null;
}
