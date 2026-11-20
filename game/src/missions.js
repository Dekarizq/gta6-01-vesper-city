// missions.js — the 10-mission story of Vesper City: Mara Voss, a getaway
// driver with one week before Hurricane Ilsa drowns the city, works for fixer
// Dario Kess to buy her way out. Each mission is a chain of go-to steps;
// finishing one pays cash and unlocks the next.
import { citySize } from './city.js';

function pt(x, z, text, kind) { return { x, z, text, kind: kind || 'goto' }; }

export function buildMissions(city) {
  const S = city.size / 2;
  const L = city.landmarks;
  const byId = (id) => L.find((l) => l.id === id);
  return [
    { id: 1, title: 'First Fare', giver: 'Dario Kess', reward: 350,
      intro: 'Dario: "Seven days till the storm, Mara. Drive like you mean it."',
      steps: [pt(byId('neonmile').x, byId('neonmile').z, 'Pick up the courier on Neon Mile', 'pickup'),
              pt(byId('rainmarket').x, byId('rainmarket').z, 'Drop the package at Rainmarket', 'deliver')] },
    { id: 2, title: 'Rain Courier', giver: 'Dario Kess', reward: 500,
      intro: 'A rival crew is watching the docks. Take the long way, fast.',
      steps: [pt(-S + 40, S - 40, 'Collect the storm charts at the hospital', 'pickup'),
              pt(byId('harbor').x, byId('harbor').z, 'Deliver them to the Harbor Docks', 'deliver')] },
    { id: 3, title: 'The Getaway', giver: 'Lena Voss', reward: 800,
      intro: 'Lena: "The crew hit the Glass Quarter vault. Get them out — now."',
      steps: [pt(0, 0, 'Reach the crew at the Storm Spire', 'pickup'),
              pt(byId('garage').x, byId('garage').z, 'Lose the heat, then reach the Vesper Garage', 'escape')] },
    { id: 4, title: 'Storm Chaser', giver: 'Dario Kess', reward: 650,
      intro: 'Drive the weather crew through the flooded south roads.',
      steps: [pt(byId('harbor').x + 20, byId('harbor').z - 30, 'Pick up the weather crew', 'pickup'),
              pt(S - 50, -S + 50, 'Reach the Rainmarket relay station', 'deliver')] },
    { id: 5, title: 'Rescue Run', giver: 'Lena Voss', reward: 900,
      intro: 'A bus is stranded on the bridge in the rising water. Go.',
      steps: [pt(0, S - 20, 'Reach the stranded bus on the harbor road', 'pickup'),
              pt(byId('hospital').x, byId('hospital').z, 'Bring the survivors to St. Mara Hospital', 'deliver')] },
    { id: 6, title: 'The Vault Job', giver: 'Dario Kess', reward: 1400,
      intro: 'Quiet in, loud out. The Glass Quarter vault holds the storm fund.',
      steps: [pt(20, 20, 'Reach the Glass Quarter vault', 'goto'),
              pt(byId('garage').x, byId('garage').z, 'Escape with the storm fund', 'escape')] },
    { id: 7, title: 'Double Cross', giver: 'Rook', reward: 1100,
      intro: 'Rook sold you out. Take the ledger back from his crew.',
      steps: [pt(-S + 60, -S + 60, 'Confront Rook\'s crew on Neon Mile', 'eliminate'),
              pt(byId('neonmile').x, byId('neonmile').z, 'Recover the ledger', 'pickup')] },
    { id: 8, title: 'Blackout', giver: 'Dario Kess', reward: 1300,
      intro: 'The grid is failing. Escort the repair convoy across town.',
      steps: [pt(-S + 50, S - 50, 'Meet the repair convoy', 'pickup'),
              pt(S - 60, S - 60, 'Escort them to the east substation', 'deliver')] },
    { id: 9, title: 'The Last Ferry', giver: 'Lena Voss', reward: 1600,
      intro: 'One ferry leaves before the hurricane. Get Lena to the docks.',
      steps: [pt(byId('rainmarket').x, byId('rainmarket').z, 'Pick up Lena at Rainmarket', 'pickup'),
              pt(byId('harbor').x, byId('harbor').z, 'Reach the last ferry at the Harbor Docks', 'deliver')] },
    { id: 10, title: 'Eye of the Storm', giver: 'Dario Kess', reward: 3000,
      intro: 'The final score: the storm fund, the spire, the whole city watching.',
      steps: [pt(0, 0, 'Reach the Storm Spire in the eye of the storm', 'goto'),
              pt(byId('harbor').x, byId('harbor').z, 'Escape to the harbor with the fund', 'escape')] },
  ];
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
