// side-jobs.js — repeatable side jobs for Sunset Kings v4. Story
// missions pay once; the city keeps paying after that. Three jobs,
// started with J (each press cycles to the next kind, or re-starts the
// one you just finished):
//   TAXI — pick up a fare on Sunset Mile and drop them at the docks.
//   DELIVERY — collect a parcel at the Harbor Docks, deliver it across
//     town before the timer runs out.
//   STREET RACE — three checkpoints down the Sunset Shore boulevard
//     against the clock; beat par time for a bonus.
// Every job pays real cash and respect, counts in the stats, and the
// race pays double when Dario's crew bonus is active. Jobs are pure
// logic; the world loop steps them and the HUD shows the live job card.
import { roadCross } from './city.js';
import { dist2, clamp } from './random.js';

export const JOB_TYPES = [
  { id: 'taxi', name: 'SUNSET CAB FARE', blurb: 'Pick up a fare, drop them off, keep the tip', pay: 120, respect: 20, timeLimit: 90 },
  { id: 'delivery', name: 'DOCK DELIVERY', blurb: 'A parcel from the docks, across town, on time', pay: 180, respect: 25, timeLimit: 75 },
  { id: 'race', name: 'SUNSET STREET RACE', blurb: 'Three checkpoints down the Shore boulevard — beat par', pay: 400, respect: 60, timeLimit: 60 },
];

export const JOB_PAY = { taxi: 120, delivery: 180, race: 400 };
export const JOB_RESPECT = { taxi: 20, delivery: 25, race: 60 };

export function createSideJobs() {
  return {
    active: null, // {type, def, stage, pickup, dropoff, checkpoints, cpIndex, startedAt, timeLeft}
    nextType: 0, // J cycles taxi -> delivery -> race -> taxi ...
    done: { taxi: 0, delivery: 0, race: 0 },
    earned: 0,
    bestRace: null, // best race time in seconds, or null
    failed: 0,
  };
}

export function jobDef(type) {
  return JOB_TYPES.find((j) => j.id === type) || JOB_TYPES[0];
}

// Fixed, reachable job spots — all on road intersections, so a job
// can never strand the player behind a building.
function jobSpots(type) {
  if (type === 'taxi') {
    return {
      pickup: roadCross(1, 1),
      // v5: the fare wants Old Town — the night market, not the docks.
      dropoff: roadCross(5, 0),
      label: 'Fare waiting on Sunset Mile',
      dropLabel: 'Drop the fare in Old Town',
    };
  }
  if (type === 'delivery') {
    return {
      pickup: roadCross(5, 9),
      // v5: the parcel goes to the Marina District fish market.
      dropoff: roadCross(9, 9),
      label: 'Collect the parcel at the Harbor Docks',
      dropLabel: 'Deliver it to the Marina District fish market',
    };
  }
  // Race: three checkpoints down the Shore boulevard (z = +27 line).
  const line = roadCross(0, 7);
  return {
    pickup: roadCross(1, 7),
    dropoff: roadCross(9, 7),
    checkpoints: [roadCross(3, 7), roadCross(6, 7), roadCross(9, 7)],
    label: 'Race start — Sunset Shore boulevard',
    dropLabel: 'Finish line at the east end',
    par: 45,
  };
}

export function startJob(jobs, type, elapsed) {
  const def = jobDef(type);
  const spots = jobSpots(def.id);
  const job = {
    type: def.id,
    def,
    stage: 'pickup',
    pickup: { x: spots.pickup.x, z: spots.pickup.z, text: spots.label },
    dropoff: { x: spots.dropoff.x, z: spots.dropoff.z, text: spots.dropLabel },
    checkpoints: spots.checkpoints || null,
    cpIndex: 0,
    startedAt: elapsed,
    timeLeft: def.timeLimit,
    par: spots.par || null,
  };
  jobs.active = job;
  return job;
}

// J cycles the job kind: taxi, delivery, race, taxi...
export function nextJobType(jobs) {
  const type = JOB_TYPES[jobs.nextType % JOB_TYPES.length].id;
  jobs.nextType += 1;
  return type;
}

export function cancelJob(jobs) {
  const job = jobs.active;
  jobs.active = null;
  return job;
}

// Step the active job. Returns events in order: 'pickup' when the
// parcel/fare is collected, 'checkpoint' for each race gate, 'done'
// with the payout, or 'expired' when the timer runs out.
export function updateJob(jobs, px, pz, dt, elapsed) {
  const job = jobs.active;
  if (!job) return [];
  const events = [];
  job.timeLeft -= dt;
  if (job.timeLeft <= 0) {
    jobs.active = null;
    jobs.failed += 1;
    events.push({ type: 'expired', job });
    return events;
  }
  const reach = (target, radius) => dist2(px, pz, target.x, target.z) < radius * radius;
  if (job.type === 'race') {
    const cp = job.checkpoints[job.cpIndex];
    if (cp && reach(cp, 10)) {
      job.cpIndex += 1;
      events.push({ type: 'checkpoint', index: job.cpIndex, total: job.checkpoints.length });
      if (job.cpIndex >= job.checkpoints.length) {
        const time = elapsed - job.startedAt;
        const parBonus = job.par && time <= job.par ? 200 : 0;
        jobs.active = null;
        jobs.done.race += 1;
        jobs.earned += job.def.pay + parBonus;
        if (jobs.bestRace === null || time < jobs.bestRace) jobs.bestRace = time;
        events.push({ type: 'done', job, pay: job.def.pay + parBonus, respect: job.def.respect, time, parBonus });
      }
    }
    return events;
  }
  if (job.stage === 'pickup' && reach(job.pickup, 9)) {
    job.stage = 'deliver';
    events.push({ type: 'pickup', job });
    return events;
  }
  if (job.stage === 'deliver' && reach(job.dropoff, 9)) {
    jobs.active = null;
    jobs.done[job.type] += 1;
    jobs.earned += job.def.pay;
    events.push({ type: 'done', job, pay: job.def.pay, respect: job.def.respect, time: elapsed - job.startedAt, parBonus: 0 });
  }
  return events;
}

// The live job target: pickup first, then dropoff, or the next race
// checkpoint — the GPS routes to this, and the HUD points at it.
export function jobTarget(jobs) {
  const job = jobs.active;
  if (!job) return null;
  if (job.type === 'race') {
    const cp = job.checkpoints[job.cpIndex];
    return cp ? { x: cp.x, z: cp.z, text: `Checkpoint ${job.cpIndex + 1}/${job.checkpoints.length}`, kind: 'checkpoint' } : null;
  }
  if (job.stage === 'pickup') return { ...job.pickup, kind: 'pickup' };
  return { ...job.dropoff, kind: 'deliver' };
}

export function jobLabel(jobs) {
  const job = jobs.active;
  if (!job) return null;
  const target = jobTarget(jobs);
  return {
    name: job.def.name,
    stage: job.stage,
    text: target ? target.text : job.def.blurb,
    timeLeft: Math.max(0, Math.ceil(job.timeLeft)),
    pay: job.def.pay,
    checkpoint: job.type === 'race' ? `${job.cpIndex}/${job.checkpoints.length}` : null,
  };
}

// Render boxes: a pulsing gold marker over the pickup, a pink beacon
// over the dropoff, and green gates for race checkpoints.
export function jobBoxes(jobs, time) {
  const job = jobs.active;
  if (!job) return [];
  const out = [];
  const pulse = 1 + Math.sin(time * 3) * 0.25;
  if (job.type === 'race') {
    for (let i = job.cpIndex; i < job.checkpoints.length; i += 1) {
      const cp = job.checkpoints[i];
      const isNext = i === job.cpIndex;
      out.push({
        x: cp.x, y: 6, z: cp.z, w: 3 * pulse, h: 12, d: 3 * pulse,
        color: isNext ? [0.3, 0.9, 0.4] : [0.5, 0.6, 0.5], yaw: 0,
      });
      out.push({
        x: cp.x, y: 2.2, z: cp.z, w: 2.4, h: 2.4, d: 2.4,
        color: isNext ? [0.4, 1, 0.5] : [0.7, 0.7, 0.7], yaw: time,
      });
    }
    return out;
  }
  const target = job.stage === 'pickup' ? job.pickup : job.dropoff;
  const color = job.stage === 'pickup' ? [1, 0.85, 0.2] : [1, 0.18, 0.53];
  out.push({ x: target.x, y: 9, z: target.z, w: 2.4 * pulse, h: 18, d: 2.4 * pulse, color, yaw: 0 });
  out.push({ x: target.x, y: 3.2 + Math.sin(time * 2) * 0.4, z: target.z, w: 2.6, h: 2.6, d: 2.6, color: [1, 0.95, 0.6], yaw: time });
  return out;
}

export function jobsSummary(jobs) {
  return {
    taxi: jobs.done.taxi,
    delivery: jobs.done.delivery,
    race: jobs.done.race,
    earned: jobs.earned,
    failed: jobs.failed,
    bestRace: jobs.bestRace,
    total: jobs.done.taxi + jobs.done.delivery + jobs.done.race,
  };
}

export function jobsSave(jobs) {
  return {
    done: { ...jobs.done },
    earned: jobs.earned,
    bestRace: jobs.bestRace,
    failed: jobs.failed,
    nextType: jobs.nextType,
  };
}

export function jobsLoad(jobs, data) {
  if (!data) return jobs;
  if (data.done) {
    for (const k of ['taxi', 'delivery', 'race']) {
      if (Number.isInteger(data.done[k])) jobs.done[k] = Math.max(0, data.done[k]);
    }
  }
  if (Number.isFinite(data.earned)) jobs.earned = Math.max(0, data.earned);
  if (Number.isFinite(data.bestRace) || data.bestRace === null) jobs.bestRace = data.bestRace;
  if (Number.isInteger(data.failed)) jobs.failed = Math.max(0, data.failed);
  if (Number.isInteger(data.nextType)) jobs.nextType = clamp(data.nextType, 0, 2);
  return jobs;
}
