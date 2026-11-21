// island-radio.js — EMBER 107.3 Volcano Rock, the island's own
// radio station, new in Sunset Kings v7. Vesper City has six stations;
// Ember Isle has one, and it is the loudest thing on the island: a
// fast volcano-rock station run by DJ Ash, who broadcasts from a hut
// on the volcano rim and reads the lava report like other DJs read
// the weather. The station is procedural like all the others — a
// tempo, a root note and a scale, played as synth plucks — and the
// world loop asks it for the next note the same way it asks every
// other station. Switching to EMBER with R works anywhere: the
// signal crosses the water, because the volcano is a very good
// antenna.
//   The station's own voice is DJ Ash. She talks between songs about
// the volcano, the ferry, the fishermen, and the one rule of the
// island: if the lava moves, the music stops. The DJ lines in this
// file are the station's script — the HUD can show one when the
// station changes, and the sim can read them all without ever
// touching an audio file.
export const EMBER_STATION = {
  id: 'ember', name: 'EMBER 107.3', show: 'Volcano Rock',
  tempo: 142, root: 207.65, scale: [0, 2, 3, 5, 7, 8, 10, 12],
  mood: 'fast volcano rock',
};

// The island station's own DJ: Ash, broadcasting from the rim hut,
// who has been on the air for six years and has never once played a
// slow song during an eruption.
export const EMBER_DJ = {
  name: 'DJ Ash',
  hut: 'Volcano Rim Hut',
  yearsOnAir: 6,
  signoff: 'This is Ash on EMBER 107.3. If the lava moves, the music stops.',
};

// DJ Ash's lines, by hour of the island day: the morning show, the
// afternoon drive, the night shift, and the eruption broadcast that
// only plays when the lava pulse is high.
export const EMBER_DJ_LINES = {
  morning: [
    "Ash: \"Good morning, Ember Isle. The volcano slept in. So did I.\"",
    "Ash: \"Fishing report: the nets are full, the gulls are louder than the radio.\"",
    "Ash: \"The ferry is on time. The ferry is always on time. The ferry is the only thing on time.\"",
    "Ash: \"If you can hear me from the black beach, the tide is coming in. Walk faster.\"",
    "Ash: \"Today's lava report: orange, slow, and minding its own business.\"",
  ],
  afternoon: [
    "Ash: \"Afternoon drive on the volcano road. Windows down, lava on the left.\"",
    "Ash: \"Tourists: the volcano is not a photo opportunity. It is a volcano.\"",
    "Ash: \"The resort pool is full, the market is loud, and the island is awake.\"",
    "Ash: \"Traffic report: one goat on the north road. The goat has right of way.\"",
    "Ash: \"If your car smells like sulphur, that is normal. If it smells like burning, that is also normal.\"",
  ],
  night: [
    "Ash: \"Night shift on Ember Isle. The lighthouse is sweeping and the bar is full.\"",
    "Ash: \"The black beach at night is beautiful and completely empty. Wonder why.\"",
    "Ash: \"To the fishermen already out: the sea is calm, the stars are out, and the volcano is watching.\"",
    "Ash: \"Last ferry has gone. If you are still here, you live here now.\"",
    "Ash: \"Night request line is open. No slow songs. Never slow songs.\"",
  ],
  eruption: [
    "Ash: \"The lava is moving. I repeat: the lava is moving. The music is NOT stopping.\"",
    "Ash: \"If you can see the glow from your window, you are too close. Move.\"",
    "Ash: \"Eruption broadcast: stay off the north road, stay off the rim, stay loud.\"",
    "Ash: \"The volcano is singing along. It has a terrible voice.\"",
  ],
};

// A DJ line for a given part of the day and a step index — the HUD
// can ask for one when the station changes, and the sim can read them
// all to prove the script is real.
export function emberDjLine(partOfDay, index) {
  const lines = EMBER_DJ_LINES[partOfDay] || EMBER_DJ_LINES.afternoon;
  return lines[(index || 0) % lines.length];
}

// Which part of the day it is on the island, from the weather clock:
// morning before noon, afternoon until dusk, night after dark, and
// eruption whenever the lava pulse is high enough to matter.
export function emberPartOfDay(dayT, lavaPulse) {
  if (lavaPulse > 0.85) return 'eruption';
  if (dayT < 0.3) return 'morning';
  if (dayT < 0.7) return 'afternoon';
  return 'night';
}

// The station's own melody walk: the same fixed walk every station
// uses, so the island station always sounds like itself — up two,
// down one, up three, repeat, over the volcano-rock scale.
export const EMBER_MELODY_WALK = [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 1, 0];

// The next note of the station, from a step index: the frequency the
// audio engine plays as a synth pluck, and the beat length it lasts.
export function emberNextNote(stepIndex) {
  const degree = EMBER_MELODY_WALK[stepIndex % EMBER_MELODY_WALK.length];
  const semitones = EMBER_STATION.scale[degree % EMBER_STATION.scale.length]
    + 12 * Math.floor(degree / EMBER_STATION.scale.length);
  const freq = EMBER_STATION.root * Math.pow(2, semitones / 12);
  return { freq, dur: (60 / EMBER_STATION.tempo) * 0.9, station: EMBER_STATION.id };
}

// The station's label for the HUD: name, show and DJ, the way every
// other station labels itself.
export function emberRadioLabel() {
  return `${EMBER_STATION.name} · ${EMBER_STATION.show} · ${EMBER_DJ.name}`;
}

// The island station's own request line: what the listeners ask for,
// and what Ash says back. The requests are the island talking about
// itself, one song at a time.
export const EMBER_REQUESTS = [
  { from: 'Fisherman at the dock', song: 'Net Full of Gold', reply: "Ash: \"For the dock crew. The nets are full and so is this song.\"" },
  { from: 'Tourist at the resort', song: 'Volcano Sunset', reply: "Ash: \"For the resort. The sunset is free, the song is not.\"" },
  { from: 'Smuggler at the cove', song: 'No Lights Tonight', reply: "Ash: \"No comment. Next song.\"" },
  { from: 'Keeper at the lighthouse', song: 'Beam Me Home', reply: "Ash: \"For the keeper. The light is on because of you.\"" },
  { from: 'Barman at the Magma Bar', song: 'Lava on the Rocks', reply: "Ash: \"For the bar. Neat, no ice. The volcano provides the ice.\"" },
  { from: 'Mara Voss', song: 'King of Ember', reply: "Ash: \"For the King. The island is listening.\"" },
];

// A request by index, for the HUD to show when the station plays it.
export function emberRequest(index) {
  return EMBER_REQUESTS[(index || 0) % EMBER_REQUESTS.length];
}

// The station's own schedule: what plays when, from the morning show
// to the night shift, so the island always knows what is on the air.
export const EMBER_SCHEDULE = [
  { slot: '06:00', show: 'Morning Lava Report', host: 'DJ Ash' },
  { slot: '09:00', show: 'Fishing Hour', host: 'DJ Ash' },
  { slot: '12:00', show: 'Volcano Rock Lunch', host: 'DJ Ash' },
  { slot: '15:00', show: 'Afternoon Drive', host: 'DJ Ash' },
  { slot: '18:00', show: 'Golden Hour Rock', host: 'DJ Ash' },
  { slot: '21:00', show: 'Night Shift', host: 'DJ Ash' },
  { slot: '00:00', show: 'Lava Watch', host: 'DJ Ash' },
];

// The show on air right now, from the in-game day time (0..1).
export function emberShowNow(dayT) {
  const hour = Math.floor(dayT * 24);
  if (hour < 9) return EMBER_SCHEDULE[0];
  if (hour < 12) return EMBER_SCHEDULE[1];
  if (hour < 15) return EMBER_SCHEDULE[2];
  if (hour < 18) return EMBER_SCHEDULE[3];
  if (hour < 21) return EMBER_SCHEDULE[4];
  if (hour < 24) return EMBER_SCHEDULE[5];
  return EMBER_SCHEDULE[6];
}

// The station's own volume rule: louder at night, quieter in the
// morning, and silent during an eruption — when the lava moves, the
// island listens to the volcano instead.
export function emberVolume(dayT, lavaPulse) {
  if (lavaPulse > 0.85) return 0;
  if (dayT >= 0.7) return 1.0;
  if (dayT < 0.3) return 0.6;
  return 0.8;
}

// The island station's own sign-off, spoken at the end of every
// broadcast hour — the line the whole island knows by heart.
export function emberSignoff() {
  return EMBER_DJ.signoff;
}

// The station's own history, for the title screen one day: how a
// volcano-rock station ended up on a volcano, and why it never left.
export const EMBER_STATION_HISTORY = [
  'EMBER 107.3 started in a fishing hut with a stolen transmitter.',
  'DJ Ash took over the rim hut six years ago and never left.',
  'The station has broadcast through three eruptions and one ferry strike.',
  'The volcano is the antenna. The island is the audience.',
  'If the lava moves, the music stops. It has never stopped.',
];

// The station's own summary for tests: tempo, scale, DJ, and how
// many lines the script holds.
export function emberStationSummary() {
  const lines = Object.values(EMBER_DJ_LINES).reduce((n, arr) => n + arr.length, 0);
  return {
    id: EMBER_STATION.id, name: EMBER_STATION.name, show: EMBER_STATION.show,
    tempo: EMBER_STATION.tempo, dj: EMBER_DJ.name, djLines: lines,
    requests: EMBER_REQUESTS.length, shows: EMBER_SCHEDULE.length,
  };
}

// The station's own top songs: the ten tracks the island asks for
// most, with the artists the fishermen argue about at the dock.
export const EMBER_TOP_SONGS = [
  { rank: 1, title: 'Volcano Sunset', artist: 'The Magma Tones', weeks: 12 },
  { rank: 2, title: 'Net Full of Gold', artist: 'Dockside Choir', weeks: 9 },
  { rank: 3, title: 'Black Sand Boogie', artist: 'Ash and the Embers', weeks: 8 },
  { rank: 4, title: 'Lighthouse Beam', artist: 'The Keepers', weeks: 7 },
  { rank: 5, title: 'Ferry Home', artist: 'Old Tomas and the Tides', weeks: 6 },
  { rank: 6, title: 'No Lights Tonight', artist: 'The Smugglers', weeks: 5 },
  { rank: 7, title: 'King of Ember', artist: 'Mara Voss', weeks: 4 },
  { rank: 8, title: 'Lava on the Rocks', artist: 'The Magma Bar Band', weeks: 4 },
  { rank: 9, title: 'Palm Grove Shuffle', artist: 'The Tourists', weeks: 3 },
  { rank: 10, title: 'Eruption Watch', artist: 'DJ Ash', weeks: 2 },
];

// A top song by rank, for the HUD countdown the station runs every
// hour on the hour.
export function emberTopSong(rank) {
  return EMBER_TOP_SONGS.find((s) => s.rank === rank) || EMBER_TOP_SONGS[0];
}

// DJ Ash's festival lines — the extra script for the Lava Festival,
// when the whole island is dancing and the radio is the band.
export const EMBER_FESTIVAL_LINES = [
  "Ash: \"Festival night! The market is dancing and the volcano is just watching.\"",
  "Ash: \"If you are not dancing, you are working. If you are working, stop.\"",
  "Ash: \"The fish is fresh, the music is loud, and the lava is calm. Perfect night.\"",
  "Ash: \"To the couple at the resort: congratulations. To everyone else: dance.\"",
  "Ash: \"Festival request line is open. No slow songs. I said what I said.\"",
];

// DJ Ash's storm lines — the extra script for the hurricane front,
// when the island is listening to the radio instead of the sea.
export const EMBER_STORM_LINES = [
  "Ash: \"Storm front on the island. The ferry is tied up. The volcano is not.\"",
  "Ash: \"If your roof is loose, tie it down. If your boat is loose, tie it down twice.\"",
  "Ash: \"The lighthouse is sweeping and the rain is coming sideways. Stay inside.\"",
  "Ash: \"To the fishermen already out: come home. The sea is not joking today.\"",
  "Ash: \"Storm watch continues. The music continues. The island continues.\"",
];

// A festival or storm line by index, for the HUD to show when the
// island is celebrating or bracing.
export function emberFestivalLine(index) {
  return EMBER_FESTIVAL_LINES[(index || 0) % EMBER_FESTIVAL_LINES.length];
}

export function emberStormLine(index) {
  return EMBER_STORM_LINES[(index || 0) % EMBER_STORM_LINES.length];
}

// The station's own jingle: the four notes it plays at the top of
// every hour, so the island always knows what time it is.
export const EMBER_JINGLE = [0, 4, 7, 12];

// The jingle as frequencies, for the audio engine to play.
export function emberJingleFreqs() {
  return EMBER_JINGLE.map((s) => EMBER_STATION.root * Math.pow(2, s / 12));
}
