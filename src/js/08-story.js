// ============================================================ words: logs, files, secrets, places
const LOGS = {
  welcome: { title: 'WELCOME TERMINAL', from: 'Nomanisan guest services', style: 'teal', body:
`WELCOME TO NOMANISAN.

Your suite is ready. Dinner is at eight.
Formal attire. Capes optional.

GUEST RULES
 1. Stay on the lit paths.
 2. The jungle is reserved for testing.
 3. If you see a large spherical robot,
    you are in the jungle. See rule 2.
 4. Your host will contact you. Do not
    contact your host.

Enjoy paradise.` },
  battery: { title: 'BATTERY 2 / FIRE LOG', from: 'south-west battery', style: 'amber', body:
`0214  Contact bearing 160, private jet,
      forty miles out. Pilot on the radio,
      says she's a civilian flight.
0215  Boss on the line. Quote: "Too bad."
0215  Lock. Two away.
0216  Splash. Target destroyed.
0222  Sweep of the debris field. Nothing.
      Nobody asked us to look harder.

0230  Note for whoever reads this. I keep
      thinking about the voice on the radio.
      She said there were kids aboard.` },
  radio: { title: 'RADIO SHACK / LAST TRAFFIC', from: 'radio hill', style: 'amber', body:
`> ALL STATIONS. PHASE THREE IS GO.
> THE BOSS IS IN METROVILLE.
> STAND BY FOR THE VICTORY PARTY.

> ...ALL STATIONS. THE BOSS IS NOT
> COMING BACK. REPEAT, NOT COMING BACK.
> BOATS AT THE SOUTH JETTY, 0600.
> LEAVE THE LIGHTS ON. NOBODY WILL
> PAY THE BILL ANYWAY.

[AUTOMATED] NO ACKNOWLEDGEMENT RECEIVED.
[AUTOMATED] REPEATING.  REPEATING.  REP` },
  guard: { title: 'CHECKPOINT 2 / SHIFT LOG', from: 'guard booth', style: 'teal', body:
`NIGHT SHIFT. NOTHING. NOTHING. NOTHING.

INCIDENT: the big guy (Mr. I.) went off
the falls with the boss's bomb behind him.
Probe swept the cave by the falls after.
Reading: no life signs.

There IS a skeleton in there. Old super,
by the suit. Somebody burned letters into
the rock above him. Boss says leave it,
it's "part of the history."

Creepy. Requesting a transfer to the
beach.` },
  locker: { title: 'LOCKER 4 / NOTE ON THE DOOR', from: 'checkpoint lockers', style: 'amber', body:
`Note to self: the master password changes
with every project and it's always some
ancient god or titan with him.
ATLAS. HELIOS. Last one I never learned.

Also: return Phil's thermos.` },
  memo: { title: 'VOICE MEMO / CHAIR ARM', from: "Syndrome's balcony", style: 'teal', body:
`[CLICK]
Memo to self. The plan, final draft.
One: the robot attacks the city.
Two: I show up. The crowd goes wild.
Three: I defeat the robot. Myself.
With style.

Note. When the hero is captured: do NOT
monologue. ...Okay. A little monologue.
It's earned. Who doesn't want to hear
the plan?

Note two. Ask E. about a cape.
[CLICK]` },
  mirage: { title: 'A NOTE TAPED TO THE CONSOLE', from: 'containment control', style: 'amber', body:
`If you are reading this, you are not him.
Good.

I let the last prisoner go from this
console. I told myself it was about the
children on that plane. It was about the
moment he gambled with my life and
didn't even blink.

The password to everything is written
in the cave by the falls, where the old
hero died. He found it before any of us.

Shut it down.
- M.` },
  journal: { title: 'PERSONAL JOURNAL', from: 'trophy room', style: 'amber', body:
`AGE 10. Built rocket boots. Flew to help
my hero. He said "Fly home, Buddy."
Fine. I'll fly.

AGE 16. Sold my first invention.
AGE 24. Zero-point energy. Mine.
AGE 30. Bought an island with a volcano
on it. Because obviously.

THE NIGHT BEFORE METROVILLE.
Tomorrow I become the hero. Later, when
I'm bored, I'll sell the gadgets to
everybody. Then everyone's super, and
"super" won't mean anything at all.

P.S. Order more capes.` },
  regulator: { title: 'GEOTHERMAL REGULATOR 2', from: 'lava lab', style: 'red', body:
`STATUS ........ MANUAL OVERRIDE NEEDED
CHAMBER 2 ...... 142% OF RATED PRESSURE
TREND .......... RISING
LAST SERVICE ... 23 DAYS AGO

TECHNICIAN NOTE:
The "dormant" volcano is not dormant.
It was asleep, and the launches woke it.
With nobody bleeding off pressure, the
only chimney it has is the launch silo.

Who is going to tell him?` },
  rim: { title: 'RIM STATION / GAS LOG', from: 'crater rim', style: 'amber', body:
`The crater lid (the boss calls it "the
iris") is running warm. Glow around the
seams every night now. Sulfur readings
doubled this month.

If the iris opens, the magma chamber
vents straight up the launch tube. Lots
of noise, lots of light, then the
pressure is gone.

Recommend we never open it while the
chamber is loaded. Recommendation filed.
Recommendation ignored.` },
  outpost: { title: 'OUTPOST 3 / DUTY ROSTER', from: 'gate outpost', style: 'amber', body:
`NIGHT WATCH ........ VACANT
DAY WATCH .......... VACANT
DRONE MAINTENANCE .. AUTOMATIC

Memo from the boss, taped to the door:
"Nobody touches the big computer.
 It talks back now. That's a feature."

Somebody wrote underneath, in pencil:
"It talks back in HIS voice."` },
  lavaPlaque: { title: 'EAST VENT OVERLOOK', from: 'bronze plaque', style: 'amber', body:
`EAST VENT OBSERVATION DECK

The east vent has erupted without pause
since 1958. The flow reaches the sea
two hundred metres below this deck.

Omnidroid prototype 4 was lost on this
field during trials. So was its paperwork.

PLEASE STAY BEHIND THE RAIL.` },
};
const KRONOS_FILES = {
  project:
`PROJECT KRONOS
=============

PHASE 1  LOCATE. Cross-reference the
         Super Relocation Program files.
         Find every retired hero.
PHASE 2  TEST. Invite each one to the
         island for a "mission". Pit them
         against the current Omnidroid.
         Learn. Improve. Repeat.
PHASE 3  METROVILLE. Launch the final
         Omnidroid. Let it attack. Defeat
         it in public. Become the hero.

PHASE 4  ASCENSION. See KRONOS PROTOCOL.

STATUS   PHASE 3 ........ FAILED
         PHASE 4 ........ ACTIVE`,
  protocol:
`THE KRONOS PROTOCOL
===================
AUTHOR ...... SYNDROME
STATUS ...... ACTIVE

IF I DIE, I DON'T.
A full copy of my mind lives in this
system. It wakes up the moment somebody
comes looking for the old heroes.

PHASE 4: ASCENSION
The heart under the mountain keeps the
powers of every super who fell here.
Merge with it. Take all of them.
Become the only super left.

Note to self: lure a strong one in to
open the old door for me.
Heroes ALWAYS open doors.`,
  omnis:
`OMNIDROID TRIAL LOG
===================
v.1 - v.4  early frames. v.4 lost on the
           east lava field.
v.5        TERMINATED: Gazerbeam,
           Stormicide.
v.6 - v.7  faster learning core.
v.8        LOST. Defeated by Mr. Incredible.
           Tricked into tearing out its own
           power source. Wreck left in the
           test clearing.
v.9        Captured Mr. Incredible.
           Shell now scrap, silo floor.
v.10       FINAL. Launched to Metroville.
           STATUS: DESTROYED.`,
};
const SUPERS = [
  ['UNIVERSAL MAN', 'TERMINATED'], ['PSYCWAVE', 'TERMINATED'], ['GAZERBEAM', 'TERMINATED'], ['STORMICIDE', 'TERMINATED'],
  ['DOWNBURST', 'TERMINATED'], ['BLAZESTONE', 'TERMINATED'], ['GAMMA JACK', 'TERMINATED'], ['HYPERSHOCK', 'TERMINATED'],
  ['MACROBURST', 'TERMINATED'], ['VECTRESS', 'TERMINATED'], ['PHYLANGE', 'TERMINATED'], ['PLASMABOLT', 'TERMINATED'],
  ['EVERSEER', 'TERMINATED'], ['FROZONE', 'LOCATED'], ['MR. INCREDIBLE', 'ESCAPED'], ['ELASTIGIRL', 'ESCAPED'],
];
const SECRETS = {
  jet: { name: 'The shot-down jet', desc: 'A rented plane, two missiles. Somebody walked away from this.' },
  omni8: { name: 'Omnidroid v.8', desc: 'It tore out its own power source. Someone convinced it to.' },
  velo: { name: 'Two Velocipods', desc: 'They found each other at full speed.' },
  bird: { name: 'A bird sentry', desc: 'Still asking everyone for an ID code.' },
  door: { name: 'The hidden door', desc: 'Behind the falls, exactly where a villain would put it.' },
  gazerbeam: { name: 'Gazerbeam', desc: 'He found the password before the end and left it for the next one.' },
  lavawall: { name: 'The lava wall', desc: 'A dinner table with a secret switch. Of course.' },
  capes: { name: 'The cape collection', desc: 'Seven capes. Nobody could tell him about capes.' },
  incrediboy: { name: 'IncrediBoy', desc: 'Homemade rocket boots, age ten. The label reads "Fly home, Buddy."' },
  field: { name: 'The zero-point cell', desc: 'Step in and everything stops.' },
  prototype: { name: 'Omnidroid v.9', desc: 'The stencil on the shell said DO NOT REACTIVATE. Somebody did.' },
  telescope: { name: 'The view from the rim', desc: 'Metroville is that way. You can almost see the smoke.' },
};
const SECRET_ORDER = Object.keys(SECRETS);
const OBJECTIVES = [
  { id: 'shore', text: 'Walk up the beach into the jungle.', hint: 'Lit paths lead inland. The volcano is north.' },
  { id: 'getIn', text: 'Find a way inside the volcano.', hint: 'The main gate is sealed. Search the slopes.' },
  { id: 'computer', text: "Find Syndrome's main computer.", hint: 'It will be somewhere deep in the lair.' },
  { id: 'password', text: 'Log in to the Kronos computer.', hint: 'Every file needs the password. Someone on this island knew it.' },
  { id: 'power', text: 'Restore main power from the Kronos computer.', hint: 'Choose RESTORE MAIN POWER on the Kronos menu.' },
  { id: 'iris', text: 'Vent the volcano: open the crater iris.', hint: 'The launch console is on the silo floor.' },
  { id: 'free', text: 'The island is yours. Find every secret.', hint: '' },
];
// Named places for the area banner. Outdoor ones by distance, indoor ones by room.
const ROOM_NAMES = {
  wfTunnel: ['BEHIND THE FALLS', 'A tunnel nobody was meant to find.'], checkpoint: ['SECURITY CHECKPOINT', 'The guards left. The cameras stayed.'],
  gauntlet: ['THE DOOR CORRIDOR', 'Every door still opens. Most of them.'], hall: ['THE GRAND HALL', 'A villain lair, built to impress.'],
  dining: ['THE DINING ROOM', 'Dinner for one, every night, by lava light.'], passage: ['BEHIND THE LAVA', ''], computer: ['KRONOS', 'The brain of the island.'],
  labCorr: ['GEOTHERMAL PLANT', 'Where the island gets its power. For now.'], lab: ['GEOTHERMAL PLANT', 'Where the island gets its power. For now.'],
  siloCorr: ['TO THE LAUNCH SILO', ''], silo: ['THE LAUNCH SILO', 'A rocket left here three weeks ago.'], stair: ['SERVICE STAIR', 'Up to the crater floor.'],
  cellCorr: ['CONTAINMENT', ''], containment: ['ZERO-POINT CONTAINMENT', 'Where he kept his guests.'], trophyCorr: ['PRIVATE WING', ''],
  trophy: ['THE TROPHY ROOM', 'Everything he ever wanted to be.'], gateTunnel: ['THE MAIN TUNNEL', ''], cave: ['A CAVE BY THE FALLS', 'Something happened here.'],
  alcove: ['A SEALED ALCOVE', 'Someone bricked this up in a hurry.'], heart: ['THE HEART OF THE MOUNTAIN', 'Older than the island. Older than its name.'],
};
function outdoorPlaces() {
  return [
    ['jetty', POI.jetty.x1, POI.jetty.z1, 40, 'THE SOUTH JETTY', 'Nomanisan, three weeks after Syndrome.'],
    ['beach', POI.pavilion.x, POI.pavilion.z, 45, 'THE BEACH', 'A private paradise, at first glance.'],
    ['battery', POI.battery.x, POI.battery.z, 45, 'MISSILE BATTERY', 'Two missiles short.'],
    ['falls', POI.pool.x, POI.pool.z, 34, 'THE FALLS', 'The water hides more than rock.'],
    ['omni', POI.omni.x, POI.omni.z, 30, 'THE TEST CLEARING', 'Trees knocked flat in a circle.'],
    ['velo', POI.velo.x, POI.velo.z, 24, 'CRASH SITE', ''],
    ['lavalook', POI.lavaLook.x, POI.lavaLook.z, 70, 'THE EAST VENT', 'Still pouring into the sea.'],
    ['radio', POI.radio.x, POI.radio.z, 40, 'RADIO HILL', 'Still repeating the last message.'],
    ['outpost', -24, POI.plaza.z + 10, 16, 'THE GATE OUTPOST', 'Huts, sandbags and a radar that never sleeps.'],
    ['plaza', 0, POI.plaza.z, 40, 'THE VOLCANO GATE', 'Front door of the lair. Sealed.'],
    ['rim', POI.rimStation.x, POI.rimStation.z, 30, 'THE CRATER RIM', '178 metres above the sea.'],
    ['crater', VX, VZ, 36, 'THE CRATER FLOOR', 'Standing on the lid of a volcano.'],
    ['vent', VENT.x, VENT.z, 45, 'THE ACTIVE VENT', 'The part of the volcano that never slept.'],
  ];
}
