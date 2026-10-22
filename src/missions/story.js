// The story: Sizwe wakes up on Camps Bay beach with no memory and slowly uncovers
// how Silverleaf Developments tried to buy the Mother City.

import * as THREE from 'three';
import { POI } from '../world/mapData.js';
import { LOOKS, randomLook } from '../entities/humanModel.js';
import { ChaseDriver, RouteDriver } from '../systems/vehicles.js';
import { dist, rand, pick, chance, headingTo } from '../core/util.js';
import { makePosterBoard, POSTER_SPOTS } from './activities.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const touch = (api) => api.g.input.touchMode && !api.g.input.usingGamepad;
const pad = (api) => api.g.input.usingGamepad;

function bark(api, who, text, sec = 2.6) {
  api.g.hud.say(who, text, { auto: sec, bark: true });
}

function shot(api, pos, look, speed = 2, snap = false) {
  const rig = api.g.cameraRig;
  rig.setShot(pos, look, speed);
  if (snap) {
    rig.first = false;
    rig.pos.copy(pos);
    rig.look.copy(look);
  }
}

/** Show a riddle; reveal a hint, then the marker, if the player struggles. */
async function riddle(api, { text, hint, x, z, r = 6, plateau = false }) {
  const g = api.g;
  api.objective(text);
  let t = 0, stage = 0, mk = null, tg = null;
  try {
    await api.until((dt) => {
      t += dt;
      if (stage === 0 && t > 35) {
        stage = 1;
        api.toast(hint, '', 9000);
        api.objective(`${text}<br><span style="font-size:12px;opacity:.8">${hint}</span>`);
      }
      if (stage === 1 && t > 70) {
        stage = 2;
        api.toast('Sizwe has a feeling… the spot is marked on your map.', '', 5000);
        mk = api.marker(x, z, { color: '#ffd400', radius: 2, y: plateau ? 230 : 0 });
        tg = api.target(x, z, { color: '#ffd400' });
      }
      const p = g.player;
      return dist(p.x, p.z, x, z) < r && p.state === 'foot';
    });
  } finally {
    if (mk) api.removeMarker(mk);
    if (tg) api.untarget(tg);
  }
}

function crowd(api, cx, cz, n, r, anims = ['cheer', null, 'talk'], faceX, faceZ) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), d = rand(1.5, r);
    const p = api.ped(cx + Math.cos(a) * d, cz + Math.sin(a) * d, { kind: 'npc', look: randomLook(), ai: 'idle', anim: pick(anims), faceTarget: false, invulnerable: true });
    if (faceX !== undefined) p.heading = headingTo(p.x, p.z, faceX, faceZ);
    out.push(p);
  }
  return out;
}

/** Passengers walk to the vehicle and get in. */
async function board(api, peds, v) {
  for (const p of peds) {
    p.ai = 'goto';
    p.goal = { x: v.x, z: v.z, run: false };
  }
  let t = 0;
  await api.until((dt) => (t += dt) > 6 || peds.every((p) => dist(p.x, p.z, v.x, v.z) < v.halfL + 1.5 || p.removeMe));
  for (const p of peds) if (api.g.peds.list.includes(p)) api.g.peds.remove(p);
}

function findRoadPoint(api, x, z) {
  const ne = api.g.roads.nearestEdge(x, z, { traffic: true });
  return ne ? { x: ne.x, z: ne.z, edge: ne.edge } : { x, z };
}

export const STORY = [
  // ===================================================================== 1
  {
    id: 'm1', title: 'Wake Up, Mother City', where: 'Camps Bay', blurb: 'Sizwe wakes up on Camps Bay beach with no memory.',
    respect: 0, after: [], reward: { respect: 5, money: 150 },
    async run(api) {
      const g = api.g, p = g.player;
      g.cutscene = true;
      g.hud.show(false);
      api.lock(true);
      p.anim = { mode: 'sunbathe' };
      shot(api, V3(140, 95, -640), V3(-40, 110, 300), 0.3, true);
      await g.hud.fade(false, 1200);
      g.hud.banner('CAPE TOWN', 'The Mother City — 07:00', 'title-card', 3400);
      await api.wait(3.8);
      shot(api, V3(-430, 60, 140), V3(-560, 0, 250), 0.35);
      await api.wait(3.0);
      shot(api, V3(-570, 12, 262), V3(-592, 0.6, 252), 0.6);
      await api.wait(2.6);
      const kyle = api.ped(POI.kyle.x, POI.kyle.z, { kind: 'npc', look: LOOKS.kyle, name: 'Kyle', ai: 'idle', invulnerable: true });
      kyle.heading = headingTo(kyle.x, kyle.z, p.x, p.z);
      p.anim = null;
      g.hud.show(true);
      g.cutscene = false;
      await api.talk([
        ['Kyle', "Howzit bru! You've been lying on my beach since sunrise. You okay?"],
        ['SIZWE', 'Where… where am I?'],
        ['Kyle', "Camps Bay, my bru. Cape Town — the Mother City! You don't remember?"],
        ['SIZWE', 'I remember… nothing. Just my name. Sizwe.'],
        ['Kyle', 'Eish. Check your phone, maybe it helps.'],
      ], { focus: kyle, speakers: { Kyle: kyle } });
      await api.phone('Unknown number', ['The lion keeps the key.', "Don't trust the Jackal's table.", '— S']);
      api.clue('msg', 'A strange message', "“The lion keeps the key. Don't trust the Jackal's table.” Signed “S”… from me?");
      await api.talk([
        ['SIZWE', '“The lion keeps the key”? What does that even mean?'],
        ['Kyle', 'No idea, bru. But my cousin Zanele runs the bootcamp on the Sea Point promenade. She knows everybody.'],
        ['Kyle', "Take my bakkie, it's parked on the sand. And drop this cooler box with her, ne? I'll fetch the bakkie later."],
      ], { focus: kyle, speakers: { Kyle: kyle } });
      api.toast(pad(api) ? '<b>Left stick</b> to walk · hold <b>A</b> to sprint · <b>right stick</b> to look around.' : touch(api) ? 'Drag on the <b>left</b> of the screen to walk. Drag on the <b>right</b> to look around.' : '<b>WASD</b> to walk · <b>Shift</b> to sprint · drag the mouse to look around.', '', 7000);
      const bk = POI.kyleBakkie;
      const bakkie = api.vehicle('bakkie', bk.x, bk.z, bk.h, { color: '#ecf0f1', label: "Kyle's Bakkie" });
      api.failIf(() => bakkie.state !== 'ok', "You wrecked Kyle's bakkie!");
      await api.enterVehicle(bakkie, `Get in <em>Kyle's bakkie</em>. ${pad(api) ? '(press <b>Y</b>)' : touch(api) ? '(tap <b>CAR</b>)' : '(press <b>F</b>)'}`);
      api.toast(pad(api) ? '<b>RT</b> gas · <b>LT</b> brake &amp; reverse · <b>left stick</b> steer · <b>RB</b> handbrake.' : touch(api) ? '<b>GAS</b> and <b>BRAKE</b> are on the right (hold BRAKE to reverse). Steer with the stick on the left.' : '<b>W/S</b> gas &amp; brake · <b>A/D</b> steer · <b>Space</b> handbrake.', '', 8000);
      api.toast('Follow the <b style="color:#d48cff">purple route</b> on the minimap. South Africans drive on the <b>left</b>!', '', 8000);
      const zan = api.ped(POI.zanele.x, POI.zanele.z, { kind: 'npc', look: LOOKS.zanele, name: 'Zanele', ai: 'idle', anim: 'talk', invulnerable: true });
      const stop = findRoadPoint(api, -503, -158);
      await api.goTo(stop.x, stop.z, { r: 9, vehicle: bakkie, text: 'Drive to <em>Zanele</em> at the Sea Point promenade.', vehicleText: "Get back in <em>Kyle's bakkie</em>." });
      await api.goTo(zan.x + 1.5, zan.z, { r: 2.6, text: `Get out ${pad(api) ? '(<b>Y</b>)' : touch(api) ? '(<b>EXIT</b>)' : '(<b>F</b>)'} and talk to <em>Zanele</em>.` });
      await api.talk([
        ['Zanele', "Yoh! Kyle's bakkie? And my cooler box! Thanks, sweetie. Who are you?"],
        ['SIZWE', "Sizwe. I'm… new here. I think."],
        ['Zanele', "New? Hmm. I'm sure I've seen you before. Last week, right here — you were asking people questions."],
        ['Zanele', "Anyway, I'm Zanele. Shout if you need anything. And I might need a strong guy around here…"],
      ], { focus: zan, speakers: { Zanele: zan } });
      bakkie.mission = false;
      api.keep = [bakkie];
      api.flag('kyleBakkieFree');
    },
  },

  // ===================================================================== 2
  {
    id: 'm2', title: 'Promenade Problems', where: 'Sea Point', blurb: 'The Jackal crew is snatching phones on the promenade.',
    respect: 0, after: ['m1'], reward: { respect: 10, money: 200 },
    giver: { x: POI.zanele.x, z: POI.zanele.z, h: Math.PI / 2, look: LOOKS.zanele, name: 'Zanele', anim: 'talk', letter: 'Z', mx: POI.zanele.x + 1.8, mz: POI.zanele.z },
    async run(api, zan) {
      const g = api.g;
      await api.talk([
        ['Zanele', 'Sizwe! Perfect timing. Those Jackal boys are back — orange bandanas, the lot.'],
        ['Zanele', "They've been snatching phones from my bootcamp ladies down by the Green Point lighthouse."],
        ['Zanele', "Three of them. Go sort them out — but don't be a hero, ne?"],
      ], { focus: zan, speakers: { Zanele: zan } });
      api.toast(pad(api) ? 'Press <b>B</b> repeatedly for a 3-hit combo — the third hit is a kick.' : touch(api) ? 'Tap <b>PUNCH</b> repeatedly for a 3-hit combo — the third hit is a kick.' : 'Press <b>J</b> (or click) to punch. Keep pressing for a 3-hit combo.', '', 7000);
      const pn = POI.promenadeNorth;
      await api.goTo(pn.x, pn.z, { r: 16, text: 'Find the <em>Jackal crew</em> near the Green Point lighthouse.' });
      const thugs = api.enemies([[pn.x - 4, pn.z - 3], [pn.x + 3, pn.z - 6], [pn.x + 1, pn.z + 5]], { health: 42 });
      const victim = api.ped(pn.x + 6, pn.z + 1, { kind: 'npc', ai: 'cower', invulnerable: true });
      bark(api, 'Thug', 'Ey! Who invited you, laaitie?');
      await api.defeat(thugs, 'Beat up the <em>Jackal crew</em>.');
      const last = thugs[thugs.length - 1];
      victim.ai = 'idle';
      bark(api, 'Stranger', 'Shame, thank you!');
      const drop = g.grid.findOpen(last.x + 0.8, last.z, 6) || { x: last.x, z: last.z };
      await api.collect(drop.x, drop.z, { text: 'Grab the <em>stolen phones</em>.', color: '#4fc3ff' });
      api.clue('card', 'Silverleaf business card', 'A Jackal thug dropped it: SILVERLEAF DEVELOPMENTS — Victor Steyn, CEO. Why would street thugs carry a CEO\'s card?');
      await api.goTo(zan.x + 1.5, zan.z, { r: 3, text: 'Take the phones back to <em>Zanele</em>.' });
      await api.talk([
        ['Zanele', "Sho! You've got hands, my friend! The ladies will be so happy."],
        ['Zanele', 'Wait… one of them dropped this. Silverleaf Developments — Victor Steyn.'],
        ['Zanele', 'Funny thing, Sizwe. Last week you were here asking about Silverleaf. With a little notebook. Like a reporter.'],
        ['SIZWE', 'A reporter? Me?'],
        ['Zanele', "Use my outdoor gym whenever you like — it's free. And go see Auntie Noma at City Hall. She's running for mayor against Silverleaf's money. She needs a guy like you."],
      ], { focus: zan, speakers: { Zanele: zan } });
    },
  },

  // ===================================================================== 3
  {
    id: 'm3', title: 'Poster Campaign', where: 'Grand Parade, City Centre', blurb: 'Help Auntie Noma put up campaign posters before the evening news.',
    respect: 15, after: ['m2'], reward: { respect: 15, money: 300 },
    giver: { x: POI.noma.x, z: POI.noma.z, h: Math.PI, look: LOOKS.noma, name: 'Auntie Noma', anim: 'talk', letter: 'N', mx: POI.noma.x, mz: POI.noma.z + 2 },
    onPass(g) {
      g.state.flags.postersUp = true;
      g.activities.refresh();
    },
    async run(api, noma) {
      const g = api.g;
      await api.talk([
        ['Auntie Noma', "So you're the young man Zanele phoned me about. Molo, Sizwe! I'm Nomvula Dlamini — but everybody calls me Auntie Noma."],
        ['Auntie Noma', "I'm running for Mayor of Cape Town. Silverleaf Developments is spending millions to put their puppet in this office instead."],
        ['Auntie Noma', "I can't afford billboards. But I have posters, and I have a good feeling about you."],
        ['Auntie Noma', 'Put up five posters around the city before the evening news. Hamba! Go, go, go!'],
      ], { focus: noma, speakers: { 'Auntie Noma': noma } });
      const spots = POSTER_SPOTS.map((s) => ({ ...s, ...(g.grid.findOpen(s.x, s.z, 6) || s) }));
      api.timer(420, 'The evening news started without your posters.');
      let done = 0;
      const boards = [];
      const place = async (s) => {
        await api.goTo(s.x, s.z, { r: 3, text: `Put up a poster at <em>${s.n}</em>. (${done}/5)` });
        await api.hold(s.x, s.z, { r: 3, label: 'Put up poster', holdText: 'Putting up poster…', text: `Hold ${pad(api) ? '<b>LB</b>' : touch(api) ? '<b>ACTION</b>' : '<b>E</b>'} to put up the poster.`, time: 1.4, marker: false });
        const b = makePosterBoard();
        b.position.set(s.x, 0, s.z);
        b.rotation.y = g.player.heading + Math.PI;
        api.mesh(b);
        boards.push({ b, s });
        g.audio.pickup();
      };
      for (let i = 0; i < 3; i++) {
        await place(spots[i]);
        done++;
        api.counter(`Posters ${done}/5`);
      }
      // twist: vandals on Long Street
      await api.phone('Auntie Noma', ["Sizwe! Someone's ripping down our poster on Long Street!", 'Go! Quickly!']);
      const ls = spots[0];
      const first = boards.find((x) => x.s === ls);
      if (first) first.b.visible = false;
      const vandals = api.enemies([[ls.x + 2, ls.z + 3], [ls.x + 1, ls.z - 4]], { health: 40 });
      await api.goTo(ls.x, ls.z, { r: 16, text: 'Stop the <em>vandals</em> on Long Street!' });
      bark(api, 'Thug', 'Steyn pays double for every Noma poster, bru!');
      await api.defeat(vandals, 'Stop the <em>vandals</em>!');
      api.clue('vandals', 'Paid vandals', 'The poster vandals wore Jackal crew bandanas. One shouted: “Steyn pays double for every Noma poster!”');
      await api.hold(ls.x, ls.z, { r: 3, label: 'Fix poster', holdText: 'Fixing poster…', text: 'Put the <em>Long Street</em> poster back up.', time: 1.2 });
      if (first) first.b.visible = true;
      for (let i = 3; i < 5; i++) {
        await place(spots[i]);
        done++;
        api.counter(`Posters ${done}/5`);
      }
      api.stopTimer();
      api.counter(null);
      await api.phone('Auntie Noma', ['Sharp sharp, Sizwe! The whole city is talking about us.', 'Bra Vusi from the taxi association wants a word. Find him at the station taxi rank.']);
    },
  },

  // ===================================================================== 4
  {
    id: 'm4', title: 'Taxi Talks', where: 'Station Taxi Rank', blurb: "Negotiate with Bra Vusi to stop Silverleaf's taxi strike.",
    respect: 35, after: ['m3'], reward: { respect: 15, money: 400 },
    giver: { x: POI.vusi.x, z: POI.vusi.z, h: Math.PI, look: LOOKS.vusi, name: 'Bra Vusi', letter: 'V', mx: POI.vusi.x, mz: POI.vusi.z + 2 },
    async run(api, vusi) {
      const g = api.g;
      await api.talk([
        ['Bra Vusi', "Heh! So you're Auntie Noma's boy. Sit, sit. Listen here, mfana."],
        ['Bra Vusi', 'Silverleaf promised the association a brand-new taxi rank — if we strike on the night of the big debate.'],
        ['Bra Vusi', 'No taxis, no crowd, no votes for Noma. So tell me: why should I call it off?'],
      ], { focus: vusi, speakers: { 'Bra Vusi': vusi } });
      const c = await api.choose('Convince Bra Vusi:', [
        { text: 'Noma grew up in Langa. She knows what drivers really need.' },
        { text: "Here's R300 for your trouble. Call off the strike.", disabled: g.state.money < 300, disabledReason: "You don't have R300." },
        { text: "Call it off, or I'll sort you out myself." },
      ]);
      g.state.choices.vusi = c;
      if (c === 0) {
        await api.talk([['Bra Vusi', 'Hmm. She did fix the potholes on Washington Street… Okay, okay. Talk is cheap, but you speak with respect.']], { focus: vusi, speakers: { 'Bra Vusi': vusi } });
        api.bonus(0, 3);
      } else if (c === 1) {
        g.addMoney(-300);
        await api.talk([['Bra Vusi', "Money talks, mfana. But money doesn't drive a taxi."]], { focus: vusi, speakers: { 'Bra Vusi': vusi } });
      } else {
        await api.talk([['Bra Vusi', 'Hayibo! Boys — teach this laaitie some manners!']], { focus: vusi, speakers: { 'Bra Vusi': vusi } });
        const marshals = api.enemies([[vusi.x - 4, vusi.z + 3], [vusi.x + 4, vusi.z + 3], [vusi.x, vusi.z + 6]], { look: LOOKS.marshal, health: 45 });
        vusi.ai = 'cower';
        await api.defeat(marshals, 'Fend off the <em>taxi marshals</em>.');
        vusi.ai = 'idle';
        await api.goTo(vusi.x, vusi.z + 1.8, { r: 3, text: 'Talk to <em>Bra Vusi</em> again.' });
        await api.talk([['Bra Vusi', "Okay! Okay! You've got guts, I'll give you that. But guts don't fill a taxi."]], { focus: vusi, speakers: { 'Bra Vusi': vusi } });
        api.bonus(0, -3);
      }
      await api.talk([['Bra Vusi', 'My driver Themba is sick today. Take his taxi and do the Langa run: three stops, then the Langa rank. On time, ne? Then we talk.']], { focus: vusi, speakers: { 'Bra Vusi': vusi } });
      const taxi = api.vehicle('minibus', 132, -322, Math.PI / 2, { stripe: '#27ae60', label: "Themba's Taxi" });
      api.failIf(() => taxi.state !== 'ok', "You wrecked Themba's taxi.");
      await api.enterVehicle(taxi, "Get in <em>Themba's taxi</em>.");
      api.timer(270, 'The passengers gave up on you.');
      const stops = [
        { n: 'Darling Street', road: [300, -153], wait: [300, -157] },
        { n: 'Victoria Road, Woodstock', road: [390, -217], wait: [390, -213] },
        { n: 'Observatory', road: [385, 3], wait: [385, 6.5] },
      ];
      let carried = 0;
      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        const w = g.grid.findOpen(s.wait[0], s.wait[1], 5) || { x: s.wait[0], z: s.wait[1] };
        const pax = [api.ped(w.x, w.z, { kind: 'npc', ai: 'idle', anim: 'wave', invulnerable: true }), api.ped(w.x + 1.2, w.z, { kind: 'npc', ai: 'idle', invulnerable: true })];
        await api.goTo(s.road[0], s.road[1], { r: 8, vehicle: taxi, slow: true, text: `Pick up passengers at <em>${s.n}</em>. Stop next to them.`, vehicleText: "Get back in <em>Themba's taxi</em>." });
        api.lock(true);
        await board(api, pax, taxi);
        api.lock(false);
        carried += 2;
        api.counter(`Passengers ${carried}/6`);
        g.audio.cash();
      }
      await api.goTo(POI.langaRank.x, POI.langaRank.z, { r: 12, vehicle: taxi, slow: true, text: 'Take the passengers to the <em>Langa taxi rank</em>.', vehicleText: "Get back in <em>Themba's taxi</em>." });
      api.stopTimer();
      api.counter(null);
      const v2 = api.ped(POI.langaRank.x + 4, POI.langaRank.z + 4, { kind: 'npc', look: LOOKS.vusi, ai: 'idle', invulnerable: true });
      await api.goTo(v2.x, v2.z, { r: 3.5, text: 'Talk to <em>Bra Vusi</em>.' });
      await api.talk([
        ['Bra Vusi', 'Sharp sharp! Right on time. You drive like a real taxi man, heh heh.'],
        ['Bra Vusi', 'Okay. The strike is off — the taxis will run on debate night.'],
        ['Bra Vusi', "And Sizwe… Silverleaf's men are pressuring the Bo-Kaap families to sell their homes. Go see Aunty Rashieda on Wale Street."],
      ], { focus: v2, speakers: { 'Bra Vusi': v2 } });
      api.clue('taxi', 'The taxi bribe', 'Bra Vusi: Silverleaf offered the taxi association a new rank in exchange for a strike on debate night.');
      taxi.mission = false;
      api.keep = [taxi];
    },
  },

  // ===================================================================== 5
  {
    id: 'm5', title: 'Deeds of the Bo-Kaap', where: 'Bo-Kaap', blurb: "Recover the Bo-Kaap title deeds from Silverleaf's Woodstock yard.",
    respect: 50, after: ['m4'], reward: { respect: 15, money: 500 },
    giver: { x: POI.rashieda.x, z: POI.rashieda.z, h: 0, look: LOOKS.rashieda, name: 'Aunty Rashieda', letter: 'R', mx: POI.rashieda.x, mz: POI.rashieda.z + 2.2 },
    onPass(g) {
      g.state.flags.safehouse = true;
      g.activities.refresh();
      g.hud.toast("Safehouse unlocked: <b>Rashieda's spare room</b> in the Bo-Kaap. Save your game there.", 'good', 7000);
    },
    async run(api, rash) {
      const g = api.g;
      await api.talk([
        ['Aunty Rashieda', 'Assalamu alaikum, my child. Come, have a koeksister — you look like you need one.'],
        ['Aunty Rashieda', "Silverleaf men came yesterday with papers. They say my house — my grandmother's house — belongs to them now!"],
        ['Aunty Rashieda', 'They stole the old title deeds for the whole street. I saw their bakkie drive off to their yard in Woodstock.'],
        ['SIZWE', "Don't worry, Aunty. I'll bring them back."],
      ], { focus: rash, speakers: { 'Aunty Rashieda': rash } });
      const gate = POI.silverleafGate;
      await api.goTo(gate.x, gate.z + 7, { r: 11, text: 'Go to the <em>Silverleaf yard</em> in Woodstock.' });
      const guards = api.enemies([[466, -178], [486, -176], [458, -190, { weapon: 'bat' }], [494, -186, { weapon: 'bat' }]], { look: LOOKS.guard, health: 60 });
      bark(api, 'Guard', 'Private property! Voetsek!');
      await api.defeat(guards, 'Deal with the <em>Silverleaf guards</em>.');
      await api.collect(486, -195.4, { text: 'Search the <em>site office</em> for the deeds.', shape: 'folder', color: '#ffd400' });
      await api.memory('A laminated card slides out of the folder: SIZWE MAHLANGU — INVESTIGATIVE JOURNALIST, CAPE HERALD. A flash: a dark office, a man in a grey suit… “Make the journalist disappear.”');
      api.clue('badge', 'My press badge', "I'm Sizwe Mahlangu, investigative journalist at the Cape Herald. I was investigating Silverleaf when I “disappeared”.");
      api.clue('deeds', 'Stolen title deeds', 'Silverleaf stole the original title deeds for a whole Bo-Kaap street to force the families out.');
      api.toast('Silverleaf reinforcements are coming!', 'warn');
      // two SUVs come hunting
      const spawns = [[430, -100], [520, -260]];
      for (const [x, z] of spawns) {
        const rp = findRoadPoint(api, x, z);
        const v = api.vehicle('suv', rp.x, rp.z, 0, { color: '#14171b', label: 'Silverleaf SUV', healthMul: 0.6 });
        v.driver = 'npc';
        v.ai = new ChaseDriver(g, v, g.player, { speedMul: 0.85 });
      }
      api.g.player.carry = false;
      await api.goTo(rash.x, rash.z + 2.2, { r: 3.5, text: 'Bring the deeds back to <em>Aunty Rashieda</em> in the Bo-Kaap.' });
      await api.talk([
        ['Aunty Rashieda', "Shukran, Sizwe! You're a blessing. Every family on this street will sleep tonight."],
        ['SIZWE', 'Aunty… I found this with the deeds. My press badge. I was a journalist. Investigating Silverleaf.'],
        ['Aunty Rashieda', 'A journalist! Then you were close to something big, my boy. Close enough that they wanted you gone.'],
        ['Aunty Rashieda', "There's a little room upstairs, above the shop. It's yours now. Rest there, save your strength."],
      ], { focus: rash, speakers: { 'Aunty Rashieda': rash } });
    },
  },

  // ===================================================================== 6
  {
    id: 'm6', title: "The Lion's Key", where: 'Your safehouse, Bo-Kaap', blurb: 'Solve your own riddles to find the hidden Silverleaf ledger.',
    respect: 70, after: ['m5'], reward: { respect: 15, money: 500 },
    giver: { x: POI.safehouse.x, z: POI.safehouse.z + 1, letter: 'S', mx: POI.safehouse.x, mz: POI.safehouse.z + 1.5 },
    async run(api) {
      const g = api.g;
      await api.memory("Under the bed upstairs, taped to the boards: your old notebook. The last page reads: “Backup of the Silverleaf ledger hidden. Three riddles. Only I would know.”");
      api.clue('notebook', 'My notebook', 'I hid a backup of the Silverleaf ledger and left myself three riddles to find it.');
      const gun = POI.noonGun;
      await riddle(api, { text: 'Riddle 1: <em>“Where the city\'s oldest voice speaks every day at noon.”</em>', hint: "Hint: it's a cannon on Signal Hill, just above the Bo-Kaap.", x: gun.x, z: gun.z + 3, r: 9 });
      await api.hold(gun.x + 2.5, gun.z + 2, { r: 2.2, label: 'Search cannon', holdText: 'Searching…', text: 'Search around the <em>Noon Gun</em>.', time: 1.6, anim: 'poster' });
      await api.talk([['SIZWE', 'A note, wedged in the cannon\'s wheel: “Where twelve stone brothers watch the sun go down — ask the man in red and yellow.”']]);
      const kyle = api.ped(POI.kyle.x, POI.kyle.z, { kind: 'npc', look: LOOKS.kyle, ai: 'idle', invulnerable: true });
      await riddle(api, { text: 'Riddle 2: <em>“Where twelve stone brothers watch the sun go down — ask the man in red and yellow.”</em>', hint: 'Hint: the Twelve Apostles tower over Camps Bay beach. Lifeguards wear red and yellow…', x: kyle.x, z: kyle.z, r: 4 });
      await api.talk([
        ['Kyle', 'Sizwe, bru! Funny thing — weeks ago a guy who looked exactly like you left a parcel with me.'],
        ['Kyle', "He said: “Only give this to me when I come back confused.” I thought he was joking!"],
        ['SIZWE', "That guy was me. What's inside?"],
        ['Kyle', 'Just a note. Something about a lion. Here, bru.'],
        ['SIZWE', '“At the lion\'s feet, where the trail begins.”'],
      ], { focus: kyle, speakers: { Kyle: kyle } });
      const th = POI.trailhead;
      await riddle(api, { text: 'Riddle 3: <em>“At the lion\'s feet, where the trail begins.”</em>', hint: "Hint: the Lion's Head trail starts at Kloof Nek, between Lion's Head and Table Mountain.", x: th.x, z: th.z, r: 10 });
      await api.hold(th.x, th.z - 4.5, { r: 2.4, label: 'Dig under sign', holdText: 'Digging…', text: 'Dig under the <em>trail sign</em>.', time: 2.2, anim: 'poster' });
      g.audio.pickup();
      api.clue('usb', 'THE KEY', "A USB drive labelled “THE KEY”: a backup of Silverleaf's secret ledger. Encrypted.");
      api.toast('Headlights on Kloof Nek — the Jackal crew followed you!', 'warn');
      const rp = findRoadPoint(api, th.x + 30, th.z + 50);
      const van = api.vehicle('suv', rp.x, rp.z, 0, { color: '#2a2d33', label: 'Jackal SUV', healthMul: 0.7 });
      van.driver = 'npc';
      van.ai = new ChaseDriver(g, van, g.player, { speedMul: 0.8 });
      const thugs = api.enemies([[th.x + 8, th.z + 6], [th.x - 7, th.z + 7], [th.x + 2, th.z + 10, { weapon: 'bat' }], [th.x - 3, th.z + 12]], { health: 50 });
      bark(api, 'Thug', "Hand over the drive, journalist!");
      api.objective('Fight off the <em>Jackal crew</em> — or escape!');
      await api.until(() => thugs.every((t) => t.state === 'dead') || dist(g.player.x, g.player.z, th.x, th.z) > 170);
      await api.goTo(POI.safehouse.x, POI.safehouse.z + 1.5, { r: 3, text: 'Take the drive back to your <em>safehouse</em> in the Bo-Kaap.' });
      await api.talk([['SIZWE', "It's locked. Password protected. Eish… so close."]]);
      await api.phone('Auntie Noma', ['Sizwe, someone inside Silverleaf wants to talk. An accountant — Pieter.', 'He will only meet at the top of Table Mountain. Take the cableway when you are ready.']);
    },
  },

  // ===================================================================== 7
  {
    id: 'm7', title: 'Cable Car Confidential', where: 'Table Mountain Cableway', blurb: 'Meet a Silverleaf whistle-blower on top of Table Mountain.',
    respect: 90, after: ['m6'], reward: { respect: 15, money: 600 },
    giver: { x: POI.cableLower.x, z: POI.cableLower.z - 6, letter: 'C', mx: POI.cableLower.x, mz: POI.cableLower.z - 6 },
    async run(api) {
      const g = api.g;
      await api.talk([['SIZWE', "Pieter from Silverleaf is waiting up top. Let's ride."]]);
      await g.activities.rideCable(true, api);
      const pt = POI.pieter;
      const pieter = api.ped(pt.x, pt.z, { kind: 'npc', look: LOOKS.pieter, ai: 'idle', onPlateau: true, exact: true, invulnerable: false, health: 70 });
      await api.goTo(pt.x, pt.z, { r: 3.5, plateau: true, text: 'Meet <em>Pieter</em> at the viewpoint.' });
      api.lock(true);
      shot(api, V3(POI.viewpoint.x + 4, 237, POI.viewpoint.z - 4), V3(80, 10, -230), 1.2);
      await api.wait(3.5);
      await api.talk([
        ['Pieter', "You're Mahlangu. The journalist. You vanished three weeks ago. Steyn's men took you."],
        ['Pieter', "They drugged you and dumped you on Camps Bay beach. You don't remember? Lucky for them."],
        ['Pieter', "I can give you the password to the ledger. But if Victor Steyn finds out, I'm finished. What can you offer me?"],
      ], { focus: pieter, speakers: { Pieter: pieter } });
      const opts = [
        { text: 'Protection. Auntie Noma will get you a lawyer and witness protection.', ok: "…Okay. I believe her. She's the only honest politician in this city." },
        { text: "Fame. You'll be the hero of my front-page story.", ok: null, no: "I don't want to be famous, I want to be ALIVE!" },
        { text: "The truth. Your kids deserve a city that isn't for sale.", ok: "…My daughter lives in the Bo-Kaap. You're right." },
      ];
      let left = [...opts];
      for (;;) {
        const i = await api.choose('Convince Pieter:', left.map((o) => ({ text: o.text })));
        const o = left[i];
        if (o.ok) {
          await api.talk([['Pieter', o.ok]], { focus: pieter });
          break;
        }
        await api.talk([['Pieter', o.no]], { focus: pieter });
        left = left.filter((x) => x !== o);
      }
      await api.talk([['Pieter', 'The password is TABLECLOTH. Like the cloud on the mountain. Steyn thinks he is funny.']], { focus: pieter });
      api.clue('ledger', "Silverleaf's ledger", 'Password TABLECLOTH. Payments for poster vandals, the taxi strike, the stolen deeds — and “removing the journalist”. Signed V. Steyn.');
      api.toast("Steyn's men came up on the last cable car!", 'warn');
      pieter.ai = 'cower';
      const top = POI.cableTop;
      const thugs = api.enemies([[top.x + 4, top.z - 2, { onPlateau: true, exact: true }], [top.x - 3, top.z - 3, { onPlateau: true, exact: true }], [top.x + 8, top.z + 1, { onPlateau: true, exact: true, weapon: 'bat' }], [top.x, top.z - 6, { onPlateau: true, exact: true }]], { health: 50 });
      thugs[1].target = pieter;
      thugs[3].target = pieter;
      api.protect(pieter, 'Pieter');
      await api.defeat(thugs, 'Protect <em>Pieter</em> from Steyn\'s thugs!');
      pieter.ai = 'follow';
      pieter.target = g.player;
      await api.goTo(top.x, top.z, { r: 3, plateau: true, text: 'Take the cable car down with <em>Pieter</em>.' });
      pieter.rig.group.visible = false;
      await g.activities.rideCable(false, api);
      pieter.onPlateau = false;
      const lw = g.grid.findOpen(POI.cableLower.x + 2, POI.cableLower.z - 8, 8);
      pieter.x = lw.x;
      pieter.z = lw.z;
      pieter.rig.group.visible = true;
      pieter.ai = 'follow';
      const noma = api.ped(POI.noma.x, POI.noma.z, { kind: 'npc', look: LOOKS.noma, ai: 'idle', invulnerable: true });
      // Pieter rides along in whatever the player drives
      let aboard = null;
      api.until(() => {
        const p = g.player;
        if (!aboard && p.vehicle && dist(pieter.x, pieter.z, p.x, p.z) < 7) {
          aboard = p.vehicle;
          pieter.rig.group.visible = false;
          pieter.ai = 'idle';
          api.toast('Pieter got in.');
        }
        if (aboard) {
          pieter.x = aboard.x;
          pieter.z = aboard.z;
          if (p.vehicle !== aboard) {
            const o = g.grid.findOpen(aboard.x + aboard.right.x * -2.5, aboard.z + aboard.right.z * -2.5, 6) || { x: aboard.x, z: aboard.z + 3 };
            pieter.x = o.x;
            pieter.z = o.z;
            pieter.rig.group.visible = true;
            pieter.ai = 'follow';
            aboard = null;
          }
        }
        return false;
      }).catch(() => {});
      await api.goTo(POI.noma.x, POI.noma.z + 4, { r: 9, text: 'Take <em>Pieter</em> to Auntie Noma at <em>City Hall</em>. Grab a car — he\'ll hop in.' });
      await api.until(() => dist(pieter.x, pieter.z, noma.x, noma.z) < 14 || aboard);
      if (aboard) {
        pieter.rig.group.visible = true;
        const o = g.grid.findOpen(noma.x - 2, noma.z + 2, 6);
        pieter.x = o.x;
        pieter.z = o.z;
      }
      pieter.ai = 'idle';
      await api.goTo(noma.x, noma.z + 1.8, { r: 3.5, text: 'Talk to <em>Auntie Noma</em>.' });
      await api.talk([
        ['Auntie Noma', "Pieter, you're safe now. My lawyers are waiting inside."],
        ['Auntie Noma', "Sizwe — with this ledger we can finish Silverleaf at the debate. Come back when you're ready. It's going to be a show!"],
      ], { focus: noma, speakers: { 'Auntie Noma': noma } });
    },
  },

  // ===================================================================== 8
  {
    id: 'm8', title: 'Debate Night', where: 'Grand Parade, City Centre', blurb: 'Expose Victor Steyn live on stage.',
    respect: 110, after: ['m7'], reward: { respect: 20, money: 800 }, next: 'm9',
    giver: { x: POI.noma.x, z: POI.noma.z, h: Math.PI, look: LOOKS.noma, name: 'Auntie Noma', anim: 'talk', letter: 'N', mx: POI.noma.x, mz: POI.noma.z + 2 },
    async run(api, noma) {
      const g = api.g, p = g.player;
      await api.talk([['Auntie Noma', "Tonight's the night. Victor Steyn will lie through his teeth. You have the evidence, Sizwe. Stand with me and counter every lie."]], { focus: noma, speakers: { 'Auntie Noma': noma } });
      await g.hud.fade(true, 700);
      g.env.hours = 19.6;
      g.population.enabled = false;
      g.peds.clearNonMission();
      const stage = { x: 215, z: -256 };
      if (!noma) noma = api.ped(stage.x + 5, stage.z, { kind: 'npc', look: LOOKS.noma, ai: 'idle', exact: true, invulnerable: true });
      noma.x = stage.x + 5;
      noma.z = stage.z;
      noma.heading = 0;
      const victor = api.ped(stage.x - 5, stage.z, { kind: 'npc', look: LOOKS.victor, ai: 'idle', exact: true, invulnerable: true });
      victor.heading = 0;
      victor.anim = 'talk';
      const podium = new THREE.Group();
      const pm = new THREE.MeshLambertMaterial({ color: '#2a3f6b' });
      for (const dx of [-5, 5]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.15, 0.6), pm);
        b.position.set(stage.x + dx, 0.58, stage.z + 0.9);
        podium.add(b);
      }
      const st = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 5), new THREE.MeshLambertMaterial({ color: '#5a3d22' }));
      st.position.set(stage.x, 0.2, stage.z);
      podium.add(st);
      api.mesh(podium);
      crowd(api, 215, -240, 14, 10, ['cheer', null, null, 'talk'], stage.x, stage.z);
      p.place(stage.x, stage.z + 7, Math.PI);
      api.lock(true);
      shot(api, V3(stage.x + 8, 6, stage.z + 16), V3(stage.x, 1.6, stage.z), 2, true);
      await g.hud.fade(false, 700);
      await api.talk([
        ['Reporter', 'Good evening, Cape Town! Live from the Grand Parade — the mayoral debate!'],
        ['Victor Steyn', 'Thank you, thank you. Cape Town deserves a mayor who builds. Silverleaf builds tomorrow, today!'],
      ], { keepLocked: true });
      let crowdMeter = 50;
      api.counter(`CROWD ${crowdMeter}%`);
      const rounds = [
        { claim: 'Silverleaf builds homes for the people! We would NEVER force a family out of their home.', right: 'Show the stolen Bo-Kaap title deeds', wrong: ['Show the Silverleaf business card', 'Talk about the taxi strike'], line: "Then why were Aunty Rashieda's title deeds locked in your Woodstock yard, Mr Steyn?" },
        { claim: "Noma's campaign is chaos — even her own supporters tear down her posters!", right: 'The vandals were Jackal crew, paid by Steyn', wrong: ['Show the press badge', 'Mention the cable car'], line: "Those vandals wore Jackal crew bandanas — and they said Steyn pays double for every poster." },
        { claim: 'The taxi industry backs ME. They were ready to strike against Noma!', right: 'Silverleaf bribed the taxi association', wrong: ['Show the stolen deeds', 'Talk about the gym'], line: 'Bra Vusi told me himself: you promised them a new rank if they struck. They said no.' },
        { claim: 'And who is this so-called journalist? Nobody has ever heard of him!', right: 'Show your Cape Herald press badge', wrong: ['Show the business card', 'Say nothing'], line: 'Sizwe Mahlangu, Cape Herald. Three weeks ago your men made me disappear. Surprise — I am back.' },
      ];
      for (const r of rounds) {
        await api.talk([['Victor Steyn', r.claim]], { keepLocked: true });
        const options = [r.right, ...r.wrong].map((t) => ({ text: t }));
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]];
        }
        const pickI = await api.choose('Counter his claim with evidence:', options);
        api.lock(true);
        if (options[pickI].text === r.right) {
          crowdMeter = Math.min(100, crowdMeter + 15);
          await api.talk([['SIZWE', r.line], ['Crowd', 'Ooooh! 👏👏👏']], { keepLocked: true });
        } else {
          crowdMeter -= 20;
          await api.talk([['SIZWE', `Uh… ${options[pickI].text.toLowerCase()}?`], ['Victor Steyn', 'Ha! You see? The so-called journalist has nothing!']], { keepLocked: true });
        }
        api.counter(`CROWD ${crowdMeter}%`);
        if (crowdMeter <= 10) {
          api.fail('The crowd turned against you.');
          return;
        }
      }
      await api.talk([
        ['SIZWE', "And it's all in here — Silverleaf's ledger. Every bribe, every threat. Signed: V. Steyn."],
        ['Crowd', 'STEYN OUT! STEYN OUT! STEYN OUT!'],
        ['Victor Steyn', '…This debate is OVER.'],
      ], { keepLocked: true });
      api.counter(null);
      g.population.enabled = true;
    },
  },

  // ===================================================================== 9
  {
    id: 'm9', title: 'Run, Jackal, Run', where: 'City Centre', blurb: 'Chase Victor Steyn down before he escapes.',
    respect: 0, after: ['m8'], auto: true, reward: { respect: 30, money: 2000 },
    async run(api) {
      const g = api.g, p = g.player;
      g.env.hours = Math.max(g.env.hours, 19.6);
      g.population.enabled = true;
      p.place(205, -236, 0);
      const car = api.vehicle('sports', 200, -232, Math.PI / 2, { color: '#f6d32d', label: "Noma's Nephew's Sports Car" });
      // Victor's SUV
      const R = g.roads;
      const start = R.nearestEdge(222, -220, { traffic: true });
      const sp = R.lanePoint(start.edge, start.edge.a, start.edge.len * 0.6);
      const suv = api.vehicle('suv', sp.x, sp.z, Math.atan2(sp.dx, sp.dz), { color: '#14171b', label: "Steyn's SUV", healthMul: 0.5 });
      suv.driver = 'npc';
      const legs = [[222, -220], [520, -80], [680, 160], [250, 0], [-40, -150], [-120, -290], [-300, -417], [10, -390]];
      let path = [];
      for (let i = 0; i + 1 < legs.length; i++) {
        const a = R.nearestNode(legs[i][0], legs[i][1], { traffic: true }).id, b = R.nearestNode(legs[i + 1][0], legs[i + 1][1], { traffic: true }).id;
        const seg = R.path(a, b, { traffic: true }) || [a, b];
        path = path.length ? path.concat(seg.slice(1)) : seg;
      }
      let escaped = false;
      const drv = new RouteDriver(g, suv, path, { speed: 23, onArrive: () => (escaped = true) });
      drv.points = drv.buildPoints();
      drv.points.push({ x: 186, z: -400 }, { x: 186, z: -460 }, { x: 166, z: -468 });
      suv.ai = drv;
      await api.talk([['Auntie Noma', "He's getting away! Sizwe, take my nephew's car — GO!"]]);
      api.failIf(() => escaped, 'Victor Steyn escaped by helicopter.');
      let lastNear = g.time;
      api.failIf(() => {
        if (dist(p.x, p.z, suv.x, suv.z) < 280) lastNear = g.time;
        return g.time - lastNear > 8;
      }, 'Victor Steyn got away.');
      const a = api.arrowOn(suv, '#ff3b3b');
      const tg = api.target(suv.x, suv.z, { color: '#ff3b3b', entity: suv });
      api.objective('Chase <em>Victor Steyn</em>! Ram his SUV until it breaks down.');
      api.counter(`SUV ${Math.round((suv.health / suv.maxHealth) * 100)}%`);
      await api.until(() => {
        api.counter(`SUV ${Math.max(0, Math.round(((suv.health - 25) / (suv.maxHealth - 25)) * 100))}%`);
        if (suv.health <= 25) {
          suv.invulnerable = true;
          return true;
        }
        return false;
      });
      suv.ai = null;
      suv.driver = null;
      api.removeMarker(a);
      api.untarget(tg);
      api.counter(null);
      g.effects.smoke(suv.x, 1.5, suv.z, 10, 0.3);
      // Victor and his bodyguards bail out
      const r = suv.right;
      const victor = api.ped(suv.x - r.x * 2.6, suv.z - r.z * 2.6, { kind: 'npc', look: LOOKS.victor, ai: 'flee', health: 40, runSpeed: 5.2 });
      victor.fleeFrom = { x: p.x, z: p.z };
      victor.fleeT = 999;
      victor.noReport = true;
      const guards = api.enemies([[suv.x + r.x * 2.6, suv.z + r.z * 2.6], [suv.x + r.x * 3.5 + 2, suv.z + r.z * 3.5]], { look: LOOKS.guard, health: 55 });
      bark(api, 'Victor Steyn', 'Get him! I pay you to protect me!');
      api.failIf(() => dist(victor.x, victor.z, p.x, p.z) > 150, 'Victor Steyn got away on foot.');
      await api.defeat([victor, ...guards], 'Take down the <em>bodyguards</em> and catch <em>Victor Steyn</em>!');
      victor.revive(10);
      victor.ai = 'cower';
      victor.invulnerable = true;
      // friendly police arrive
      const cop1 = api.ped(victor.x + 3, victor.z + 2, { kind: 'npc', look: LOOKS.police, ai: 'idle', invulnerable: true });
      const cop2 = api.ped(victor.x - 3, victor.z + 2, { kind: 'npc', look: LOOKS.police, ai: 'idle', invulnerable: true });
      cop1.heading = headingTo(cop1.x, cop1.z, victor.x, victor.z);
      cop2.heading = headingTo(cop2.x, cop2.z, victor.x, victor.z);
      await api.goTo(victor.x, victor.z, { r: 3.2, text: 'Confront <em>Victor Steyn</em>.' });
      await api.talk([
        ['Victor Steyn', 'You think this changes anything? This city is ALWAYS for sale.'],
        ['SIZWE', 'Not anymore, Steyn. Not anymore.'],
      ], { focus: victor });
      api.clearFails();
      await g.hud.fade(true, 900);
      g.hud.banner('ELECTION DAY', 'Auntie Noma wins by a landslide!', 'title-card', 3600);
      g.env.hours = 11;
      const stage = { x: 215, z: -256 };
      api.cleanup([car]);
      const noma = api.ped(stage.x, stage.z, { kind: 'npc', look: LOOKS.noma, ai: 'idle', exact: true, anim: 'cheer', invulnerable: true });
      crowd(api, 215, -240, 14, 10, ['cheer', 'cheer', null], stage.x, stage.z);
      p.place(stage.x + 1, stage.z + 5, Math.PI);
      await api.wait(1.2);
      await g.hud.fade(false, 900);
      g.effects.confetti(stage.x, 3, stage.z, 160);
      await api.wait(1.5);
      noma.anim = 'talk';
      await api.talk([
        ['Auntie Noma', 'Sizwe! We did it! The Mother City belongs to its people again.'],
        ['Auntie Noma', 'You know… this city needs people like you. Have you ever thought about running for ward councillor?'],
        ['SIZWE', 'Me? A politician? Eish…'],
        ['Auntie Noma', 'Think about it. Come see me when you are ready. Until then — enjoy your city, Sizwe.'],
      ], { focus: noma });
    },
  },

  // ===================================================================== 10
  {
    id: 'm10', title: 'Vote Sizwe!', where: 'Grand Parade, City Centre', blurb: 'Run for ward councillor: win over four communities, then give the speech of your life.',
    respect: 150, after: ['m9'], reward: { respect: 50, money: 5000 },
    giver: { x: POI.noma.x, z: POI.noma.z, h: Math.PI, look: LOOKS.noma, name: 'Auntie Noma', anim: 'talk', letter: 'N', mx: POI.noma.x, mz: POI.noma.z + 2 },
    onPass(g) {
      g.state.flags.councillor = true;
    },
    async run(api, noma) {
      const g = api.g;
      await api.talk([
        ['Auntie Noma', 'The Ward 77 by-election is next week, Councillor-to-be! Visit four communities, listen to the people, and win their support.'],
        ['Auntie Noma', 'Then give your big speech right here at the Grand Parade. You need at least 60% support.'],
      ], { focus: noma, speakers: { 'Auntie Noma': noma } });
      let support = 0;
      api.counter('SUPPORT 0%');
      const addSupport = (n) => {
        support += n;
        api.counter(`SUPPORT ${support}%`);
        api.toast(`Support +${n}%`, 'good');
      };
      // --- Langa
      const sn = POI.shisaNyama;
      const bheki = api.ped(sn.x - 4, sn.z + 2, { kind: 'npc', look: LOOKS.bheki, ai: 'idle', invulnerable: true });
      await api.goTo(bheki.x, bheki.z + 1.5, { r: 3.5, text: 'Visit <em>Uncle Bheki</em> at the shisa nyama in Langa.' });
      await api.talk([['Uncle Bheki', 'Molweni, young man. Our streetlights on Bunga Avenue have been broken for months. Promises, promises…']], { focus: bheki });
      const c1 = await api.choose('What do you say?', [{ text: "I'll fix them myself. Right now." }, { text: "Vote for me and I'll fix them after the election." }]);
      if (c1 === 0) {
        const lights = [[610, 244], [650, 236], [700, 244]];
        for (let i = 0; i < lights.length; i++) {
          const o = g.grid.findOpen(lights[i][0], lights[i][1], 6);
          await api.hold(o.x, o.z, { r: 2.4, label: 'Fix streetlight', holdText: 'Fixing…', text: `Fix the broken <em>streetlights</em> on Bunga Ave (${i}/3).`, time: 1.5 });
          g.effects.sparks(o.x, 5, o.z, 14);
        }
        await api.talk([['Uncle Bheki', 'Hayi! A politician who actually works! You have my vote, and my whole street.']]);
        addSupport(25);
      } else {
        await api.talk([['Uncle Bheki', "That's what they all say, my boy."]]);
        addSupport(10);
      }
      // --- Woodstock
      const wm = POI.woodstockMural;
      const jade = api.ped(wm.x + 2, wm.z + 3, { kind: 'npc', look: LOOKS.jade, ai: 'idle', invulnerable: true });
      await api.goTo(jade.x, jade.z + 1.5, { r: 3.5, text: 'Meet <em>Jade</em>, the muralist in Woodstock.' });
      await api.talk([['Jade', 'Hey! Paint with me? This wall needs some community love. Every artist in Woodstock is watching.']], { focus: jade });
      const c2 = await api.choose('Jade asks:', [{ text: 'Hand me a spray can!' }, { text: "Sorry, I'm too busy campaigning." }]);
      if (c2 === 0) {
        for (let i = 0; i < 3; i++) {
          const o = g.grid.findOpen(wm.x - 3 + i * 3, wm.z + 1, 4);
          await api.hold(o.x, o.z, { r: 2.2, label: 'Spray paint', holdText: 'Painting…', text: `Help paint the <em>mural</em> (${i}/3).`, time: 1.3, anim: 'poster' });
          g.effects.sparks(o.x, 2, o.z, 10, [Math.random(), Math.random(), 1]);
        }
        await api.talk([['Jade', 'Lekker! That might be the best mural in Woodstock. The artists are with you!']]);
        addSupport(25);
      } else {
        await api.talk([['Jade', "Oh. Okay. Typical politician…"]]);
        addSupport(5);
      }
      // --- Sea Point
      const zan = api.ped(POI.zanele.x, POI.zanele.z, { kind: 'npc', look: LOOKS.zanele, ai: 'idle', invulnerable: true });
      await api.goTo(zan.x + 1.5, zan.z, { r: 3.5, text: "Join <em>Zanele</em>'s bootcamp in Sea Point." });
      await api.talk([['Zanele', 'Councillor Sizwe! Beat the bootcamp record — 10 reps in 15 seconds — and my whole class will vote for you!']], { focus: zan });
      const ok = await g.activities.liftGame({ reps: 10, time: 15, title: 'BOOTCAMP RECORD', api });
      if (ok) {
        await api.talk([['Zanele', "YOH! New record! Ladies, we're voting Sizwe!"]]);
        addSupport(25);
      } else {
        await api.talk([['Zanele', "Shame, so close! Okay, a few of us will still vote for you."]]);
        addSupport(10);
      }
      // --- Bo-Kaap
      const rash = api.ped(POI.rashieda.x, POI.rashieda.z, { kind: 'npc', look: LOOKS.rashieda, ai: 'idle', invulnerable: true });
      await api.goTo(rash.x, rash.z + 2.2, { r: 3.5, text: 'Visit <em>Aunty Rashieda</em> in the Bo-Kaap.' });
      await api.talk([['Aunty Rashieda', 'Sizwe! Deliver these koeksisters to three neighbours before they get cold. Then the whole Bo-Kaap knows your name.']], { focus: rash });
      const homes = [[-120, -186], [-200, -186], [-110, -100]].map(([x, z]) => g.grid.findOpen(x, z, 8));
      let delivered = 0;
      let cold = false;
      api.timer(100, '', () => (cold = true));
      for (const h of homes) {
        if (cold) break;
        const nb = api.ped(h.x, h.z, { kind: 'npc', ai: 'idle', anim: 'wave', invulnerable: true });
        const t = api.target(nb.x, nb.z, { color: '#ffd400' });
        api.objective(`Deliver <em>koeksisters</em> to the neighbours (${delivered}/3).`);
        await api.until(() => cold || dist(g.player.x, g.player.z, nb.x, nb.z) < 3);
        api.untarget(t);
        if (cold) break;
        delivered++;
        g.audio.pickup();
        api.toast(`Koeksisters delivered (${delivered}/3)`);
      }
      api.stopTimer();
      if (delivered === 3) {
        await api.talk([['Aunty Rashieda', 'Still warm! You are a good boy, Sizwe. The Bo-Kaap is behind you.']]);
        addSupport(25);
      } else {
        await api.talk([['Aunty Rashieda', 'Cold koeksisters… ag, shame. Still, they know you tried.']]);
        addSupport(10);
      }
      // --- speech
      const stage = { x: 215, z: -256 };
      await api.goTo(stage.x, stage.z + 7, { r: 5, text: 'Go to the <em>Grand Parade</em> for your big speech.' });
      await g.hud.fade(true, 600);
      g.env.hours = 18;
      crowd(api, 215, -240, 14, 10, ['cheer', null, 'talk'], stage.x, stage.z);
      g.player.place(stage.x, stage.z + 1, 0);
      api.lock(true);
      shot(api, V3(stage.x - 7, 4, stage.z - 7), V3(stage.x, 1.6, stage.z + 2), 2, true);
      await g.hud.fade(false, 600);
      const rounds = [
        { q: 'Open your speech:', o: [['Molo, Cape Town! Sawubona! Goeie naand! Good evening!', 6], ['Vote for me, I am basically famous now.', -5], ['Ahem… hello. Is this mic on?', 0]] },
        { q: 'Your big promise:', o: [['Homes for families — never for sale to the highest bidder.', 6], ['Free gatsbies for everybody!', 3], ['More parking at the Waterfront.', 0]] },
        { q: 'Close it out:', o: [['This city belongs to all of us. Ubuntu — I am because we are.', 6], ['Remember: Sizwe for Councillor!', 3], ['Okay… bye.', -5]] },
      ];
      for (const r of rounds) {
        const i = await api.choose(r.q, r.o.map(([t]) => ({ text: t })));
        api.lock(true);
        const [t, pts] = r.o[i];
        await api.talk([['SIZWE', t], ['Crowd', pts > 4 ? 'YEBO! 👏👏👏' : pts > 0 ? '*polite laughter*' : '*awkward silence*']], { keepLocked: true });
        support += pts;
        api.counter(`SUPPORT ${support}%`);
      }
      api.counter(null);
      if (support < 60) {
        api.fail(`Only ${support}% support. Campaign harder and try again!`);
        return;
      }
      g.effects.confetti(stage.x, 3, stage.z, 160);
      g.hud.banner(`SIZWE WINS WARD 77!`, `${Math.min(99, support)}% of the vote`, 'title-card', 4200);
      await api.wait(4.4);
      await api.talk([
        ['Auntie Noma', 'Councillor Sizwe Mahlangu! I knew it the day Zanele phoned me.'],
        ['SIZWE', 'From waking up on a beach with no memory… to this. Only in the Mother City.'],
      ], { keepLocked: true });
      g.hud.banner('THE END… FOR NOW', 'Keep exploring the Mother City!', 'title-card', 5000);
    },
  },
];
