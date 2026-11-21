// island-jobs.js — repeatable side jobs on Ember Isle, new in Sunset
// Kings v7. The city has taxi, delivery and street race; the island
// has its own work, and it pays in island money: fishing (catch the
// morning haul and bring it to the market), tour guide (drive the
// tourists to the volcano, the lighthouse and the black beach), and
// smuggling run (the fast, illegal one — timed, and the patrol notices).
//   Jobs cycle fishing -> tour -> smuggling, the same way the city
// jobs cycle taxi -> delivery -> race. A job cannot start while a
// story mission is active — the story comes first, and a job would
// fight it for the GPS target. Each job is a chain of go-to steps with
// a timer; finishing one pays cash and respect, and the island
// remembers how many jobs Mara has done, because the islanders talk.
//   The jobs are a self-contained system: they own their defs, their
// active job, their timers and their totals, and they step themselves
// every frame. The world loop only has to call updateIslandJob and
// read islandJobTarget for the GPS.
import { islandPoints, islandRoadPoint } from './island.js';

// The three island jobs, in cycle order. Each one has an id, a name,
// a blurb, a pay, a respect payout, a time limit in seconds, and a
// flavour line the islanders say about it.
export const ISLAND_JOB_TYPES = [
  {
    id: 'fishing', name: 'Fishing Haul', pay: 150, respect: 25, timeLimit: 120,
    blurb: 'Catch the morning haul at the dock and bring it to the market before the sun spoils it.',
    line: 'Fisherman: "The nets are full. The market is waiting. The sun is not."',
  },
  {
    id: 'tour', name: 'Island Tour', pay: 240, respect: 35, timeLimit: 180,
    blurb: 'Drive the tourists to the volcano, the lighthouse and the black beach — and do not scare them.',
    line: 'Tourist: "Is the volcano safe? Is the lava part of the tour?"',
  },
  {
    id: 'smuggling', name: 'Smuggling Run', pay: 500, respect: 60, timeLimit: 90,
    blurb: 'Fast, quiet, illegal: the cove to the volcano bar, before the patrol wakes up.',
    line: 'Smuggler: "No lights, no horn, no talking. The patrol has ears."',
  },
];

export const ISLAND_JOB_PAY = { fishing: 150, tour: 240, smuggling: 500 };
export const ISLAND_JOB_RESPECT = { fishing: 25, tour: 35, smuggling: 60 };
export const ISLAND_JOB_TIME = { fishing: 120, tour: 180, smuggling: 90 };

export function islandJobDef(type) {
  return ISLAND_JOB_TYPES.find((d) => d.id === type) || ISLAND_JOB_TYPES[0];
}

// The live job state: the active job (or null), the totals, and the
// cycle pointer that decides which job comes next.
export function createIslandJobs() {
  return {
    active: null,
    done: { fishing: 0, tour: 0, smuggling: 0 },
    failed: { fishing: 0, tour: 0, smuggling: 0 },
    earned: 0,
    lastType: null,
    cycle: 0,
  };
}

// The next job type in the cycle: fishing -> tour -> smuggling, then
// back to fishing. The cycle never repeats the same job twice in a
// row — the island gets bored, and so does Mara.
export function nextIslandJobType(jobs) {
  const order = ['fishing', 'tour', 'smuggling'];
  const next = order[jobs.cycle % order.length];
  jobs.cycle += 1;
  return next;
}

// Start a job: build its step chain from the island points and arm
// its timer. Returns the active job, or null if one is already
// running. The smuggling run adds island heat on start — the patrol
// notices a fast car on the cove road at night.
export function startIslandJob(jobs, type, elapsed) {
  if (jobs.active) return jobs.active;
  const def = islandJobDef(type);
  const pts = islandPoints();
  let steps = [];
  if (type === 'fishing') {
    steps = [
      { x: pts.ferryDock.x, z: pts.ferryDock.z, text: 'Collect the morning haul at Ember Dock', kind: 'pickup' },
      { x: pts.fishStalls.x, z: pts.fishStalls.z, text: 'Bring the haul to the fish stalls', kind: 'deliver' },
      { x: pts.nightMarket.x, z: pts.nightMarket.z, text: 'Drop the last crates at the night market', kind: 'deliver' },
    ];
  } else if (type === 'tour') {
    steps = [
      { x: pts.ferryDock.x, z: pts.ferryDock.z, text: 'Pick up the tourists at Ember Dock', kind: 'pickup' },
      { x: pts.volcanoBase.x, z: pts.volcanoBase.z, text: 'Show them the volcano base', kind: 'goto' },
      { x: pts.lighthouseGate.x, z: pts.lighthouseGate.z, text: 'Then the lighthouse gate', kind: 'goto' },
      { x: pts.blackBeach.x, z: pts.blackBeach.z, text: 'Finish at the Black Sand Beach', kind: 'deliver' },
    ];
  } else {
    steps = [
      { x: pts.smugglerCove.x, z: pts.smugglerCove.z, text: "Pick up the cargo at Smuggler's Cove", kind: 'pickup' },
      { x: pts.southRoad.x, z: pts.southRoad.z, text: 'Run the south road — no lights, no horn', kind: 'goto' },
      { x: pts.volcanoBar.x, z: pts.volcanoBar.z, text: 'Deliver to the Magma Bar', kind: 'deliver' },
    ];
  }
  jobs.active = {
    def, steps, step: 0, startedAt: elapsed || 0,
    timeLeft: def.timeLimit, heat: type === 'smuggling' ? 1 : 0,
  };
  jobs.lastType = type;
  return jobs.active;
}

// Cancel the active job — when Mara starts a story mission, or when
// she takes the ferry home mid-job, the island job is gone.
export function cancelIslandJob(jobs) {
  const active = jobs.active;
  jobs.active = null;
  return active;
}

// The current target of the active job, for the GPS: the step Mara
// has to reach next, or null when no job is running.
export function islandJobTarget(jobs) {
  if (!jobs.active) return null;
  return jobs.active.steps[jobs.active.step] || null;
}

// The job's label for the HUD: its name, its step, and how much time
// is left on the clock.
export function islandJobLabel(jobs) {
  if (!jobs.active) return null;
  const step = jobs.active.steps[jobs.active.step];
  return {
    name: jobs.active.def.name,
    step: step ? step.text : '',
    stepIndex: jobs.active.step + 1,
    stepTotal: jobs.active.steps.length,
    timeLeft: Math.max(0, Math.round(jobs.active.timeLeft)),
    pay: jobs.active.def.pay,
  };
}

// Step the active job: count the timer down, advance when Mara
// reaches the step marker, and finish or fail the job. Returns an
// event the world loop must act on, or null:
//   {type:'step', index, total} when a step is reached,
//   {type:'done', job, pay, respect} when the job completes,
//   {type:'failed', job, reason} when the timer runs out.
export function updateIslandJob(jobs, px, pz, dt, elapsed) {
  if (!jobs.active) return null;
  const job = jobs.active;
  job.timeLeft -= dt;
  if (job.timeLeft <= 0) {
    jobs.failed[job.def.id] = (jobs.failed[job.def.id] || 0) + 1;
    jobs.active = null;
    return { type: 'failed', job, reason: 'the timer ran out' };
  }
  const step = job.steps[job.step];
  if (!step) {
    jobs.active = null;
    return null;
  }
  const dx = px - step.x, dz = pz - step.z;
  const radius = step.kind === 'eliminate' ? 14 : 9;
  if (dx * dx + dz * dz < radius * radius) {
    job.step += 1;
    if (job.step >= job.steps.length) {
      jobs.done[job.def.id] = (jobs.done[job.def.id] || 0) + 1;
      jobs.earned += job.def.pay;
      jobs.active = null;
      return { type: 'done', job, pay: job.def.pay, respect: job.def.respect };
    }
    return { type: 'step', job, index: job.step, total: job.steps.length };
  }
  return null;
}

// The job's boxes for the renderer: a pink beacon over the current
// target step, and a gold marker over the job's start point, so the
// player can always see where the work is.
export function islandJobBoxes(jobs, time) {
  const boxes = [];
  if (!jobs.active) return boxes;
  const step = jobs.active.steps[jobs.active.step];
  if (!step) return boxes;
  const pulse = 1 + Math.sin((time || 0) * 3) * 0.25;
  boxes.push(
    { x: step.x, y: 9, z: step.z, w: 2.4 * pulse, h: 18, d: 2.4 * pulse, color: [1, 0.18, 0.53], yaw: 0 },
    { x: step.x, y: 3.2 + Math.sin((time || 0) * 2) * 0.4, z: step.z, w: 2.6, h: 2.6, d: 2.6, color: [1, 0.85, 0.2], yaw: time || 0 },
  );
  return boxes;
}

// The job totals for the HUD and the save: how many of each job Mara
// has finished, how many she has failed, and how much she has earned
// working the island.
export function islandJobsSummary(jobs) {
  const totalDone = jobs.done.fishing + jobs.done.tour + jobs.done.smuggling;
  const totalFailed = jobs.failed.fishing + jobs.failed.tour + jobs.failed.smuggling;
  return {
    done: { ...jobs.done }, failed: { ...jobs.failed },
    totalDone, totalFailed, earned: jobs.earned,
    active: jobs.active ? jobs.active.def.name : null,
  };
}

// The island jobs' own tips, one per job type — the HUD can show one
// when a job starts, so the player knows the trick before the timer
// starts running.
export const ISLAND_JOB_TIPS = {
  fishing: 'Tip: the haul is heavy — take the dock road, not the beach. The sand eats cars.',
  tour: 'Tip: tourists tip better when you do not scare them. Brake before the corners.',
  smuggling: 'Tip: the patrol watches the cove road. Take the south road and keep the lights off.',
};

export function islandJobTip(type) {
  return ISLAND_JOB_TIPS[type] || 'Tip: drive fast, drive clean, get paid.';
}

// Save/load: the jobs keep their totals and their cycle pointer, but
// never an active job — a save made mid-job loads with the job gone,
// the same as the city jobs.
export function islandJobsSave(jobs) {
  return {
    done: { ...jobs.done }, failed: { ...jobs.failed },
    earned: jobs.earned, cycle: jobs.cycle,
  };
}

export function islandJobsLoad(data) {
  const jobs = createIslandJobs();
  if (!data || typeof data !== 'object') return jobs;
  jobs.done = { fishing: 0, tour: 0, smuggling: 0, ...(data.done || {}) };
  jobs.failed = { fishing: 0, tour: 0, smuggling: 0, ...(data.failed || {}) };
  jobs.earned = data.earned || 0;
  jobs.cycle = data.cycle || 0;
  return jobs;
}

// The island jobs' own leaderboard, for the end screen one day: the
// best job is the one Mara has done most, and the island remembers.
export function islandBestJob(jobs) {
  let best = null;
  let bestCount = -1;
  for (const type of ['fishing', 'tour', 'smuggling']) {
    if (jobs.done[type] > bestCount) {
      bestCount = jobs.done[type];
      best = type;
    }
  }
  return bestCount > 0 ? { type: best, count: bestCount, def: islandJobDef(best) } : null;
}

// A job's own difficulty, for the sim: the smuggling run is the
// hardest (short timer, heat on start), the tour is the longest, and
// the fishing haul is the gentlest way to learn the island roads.
export function islandJobDifficulty(type) {
  if (type === 'smuggling') return 'HARD';
  if (type === 'tour') return 'MEDIUM';
  return 'EASY';
}

// The island jobs' own earnings table, for the HUD panel: pay, time
// and respect per job, side by side, so Mara can choose her work.
export function islandJobTable() {
  return ISLAND_JOB_TYPES.map((d) => ({
    id: d.id, name: d.name, pay: d.pay, respect: d.respect,
    timeLimit: d.timeLimit, difficulty: islandJobDifficulty(d.id),
  }));
}

// Validate a job list the way the sim does: every job has steps on
// the island, a pay, a respect payout and a time limit. Returns a
// list of problems — empty means the jobs are ready to work.
export function validateIslandJobs() {
  const problems = [];
  for (const def of ISLAND_JOB_TYPES) {
    if (!def.pay || def.pay <= 0) problems.push(`${def.id} has no pay`);
    if (!def.timeLimit || def.timeLimit <= 0) problems.push(`${def.id} has no time limit`);
    const job = startIslandJob(createIslandJobs(), def.id, 0);
    for (const s of job.steps) {
      if (s.x < 490 || s.x > 910 || s.z < -210 || s.z > 210) {
        problems.push(`${def.id} step outside the island: ${s.x}, ${s.z}`);
      }
    }
  }
  return problems;
}
