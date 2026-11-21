// radio.js — four real radio stations, all procedural. No audio files,
// no network: each station is a tempo, a root note and a scale, and the
// world loop asks radioStep for the next note, which the audio engine
// plays as a short synth pluck. Switching stations with R changes the
// music immediately and the HUD shows the station name and show. The
// stations are the city's own voices: Vesper 98.1 is the warm golden-hour
// mix, Sunset FM is the fast coast-drive station, Storm Radio is the slow
// moody weather band that plays as the hurricane closes in, and v4 adds
// Coast 104.7, the beach-nights station that only sounds right with the
// windows down on the Shore boulevard.
export const RADIO_STATIONS = [
  {
    id: 'vesper', name: 'VESPER 98.1', show: 'Golden Hour Mix',
    tempo: 96, root: 220.0, scale: [0, 3, 5, 7, 10, 12],
    mood: 'warm sunset chords',
  },
  {
    id: 'sunset', name: 'SUNSET FM 101.5', show: 'Coast Drive',
    tempo: 128, root: 196.0, scale: [0, 2, 4, 7, 9, 12],
    mood: 'fast driving bass',
  },
  {
    id: 'storm', name: 'STORM RADIO 87.9', show: 'Weather Band',
    tempo: 72, root: 174.61, scale: [0, 3, 5, 6, 10, 12],
    mood: 'slow hurricane blues',
  },
  {
    id: 'coast', name: 'COAST 104.7', show: 'Beach Nights',
    tempo: 112, root: 164.81, scale: [0, 2, 3, 7, 9, 12],
    mood: 'beach night groove',
  },
  // v5: the marina's own station — slow yacht rock for the quay, the
  // fifth voice of the city, and the one the marina screenshot plays.
  {
    id: 'marina', name: 'MARINA 99.9', show: 'Yacht Rock',
    tempo: 88, root: 185.0, scale: [0, 2, 4, 5, 7, 9, 11, 12],
    mood: 'smooth marina glide',
  },
  // v6: the hurricane station — a slow minor-key storm watch for the
  // last two days, when the front is on the city and the radio is the
  // only voice telling Mara how bad it is about to get.
  {
    id: 'hurricane', name: 'HURRICANE 88.8', show: 'Storm Watch',
    tempo: 64, root: 146.83, scale: [0, 2, 3, 5, 7, 8, 10, 12],
    mood: 'slow storm-watch minor',
  },
  // v7: the island station — fast volcano rock from DJ Ash on the rim
  // hut, the loudest thing on Ember Isle, and the signal crosses the
  // water because the volcano is a very good antenna.
  {
    id: 'ember', name: 'EMBER 107.3', show: 'Volcano Rock',
    tempo: 142, root: 207.65, scale: [0, 2, 3, 5, 7, 8, 10, 12],
    mood: 'fast volcano rock',
  },
];

export function createRadio() {
  return { index: 0, beat: 0, step: 0, lastNoteAt: 0 };
}

export function currentStation(radio) {
  return RADIO_STATIONS[radio.index % RADIO_STATIONS.length];
}

export function nextStation(radio) {
  radio.index = (radio.index + 1) % RADIO_STATIONS.length;
  radio.step = 0;
  radio.beat = 0;
  return currentStation(radio);
}

export function setStation(radio, index) {
  radio.index = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
  radio.step = 0;
  radio.beat = 0;
  return currentStation(radio);
}

// Advance the station clock by dt seconds. Returns a note event
// {freq, dur} when a new beat starts, or null between beats. The melody
// walks the station scale with a fixed walk so the same station always
// sounds like itself: up two, down one, up three, repeat.
export function radioStep(radio, dt) {
  const station = currentStation(radio);
  const beatLen = 60 / station.tempo;
  radio.beat += dt;
  if (radio.beat < beatLen) return null;
  radio.beat -= beatLen;
  const walk = [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 1, 0];
  const degree = walk[radio.step % walk.length];
  radio.step += 1;
  const semitones = station.scale[degree % station.scale.length] + 12 * Math.floor(degree / station.scale.length);
  const freq = station.root * Math.pow(2, semitones / 12);
  return { freq, dur: beatLen * 0.9, station: station.id };
}

export function radioLabel(radio) {
  const s = currentStation(radio);
  return `${s.name} · ${s.show}`;
}
