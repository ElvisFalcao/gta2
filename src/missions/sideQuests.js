// Random strangers who need a hand: phone snatchers, deliveries, lost dogs, lifts and bullies.

import { randomLook, LOOKS } from '../entities/humanModel.js';
import { PLACES } from './activities.js';
import { dist, rand, pick, chance, headingTo } from '../core/util.js';
import { MissionFail } from './missionSystem.js';

const NAMES = ['Thandi', 'Lerato', 'Faizel', 'Johan', 'Ayanda', 'Mandla', 'Chantelle', 'Riaan', 'Nomsa', 'Yusuf', 'Kayla', 'Bongani', 'Shireen', 'Sipho', 'Precious', 'Ruben'];
const DOGS = ['Biscuit', 'Rusk', 'Chakalaka', 'Boerie', 'Lucky', 'Simba', 'Peaches', 'Mielie'];
const ITEMS = [['koeksisters', 'gran'], ['fresh snoek', 'uncle'], ['a birthday cake', 'sister'], ['braai wood', 'cousin'], ['school books', 'little brother'], ['medicine', 'grandfather']];

let QID = 1;

function templates(g) {
  return [
    {
      key: 'snatch', title: 'Phone Snatcher', weight: 3,
      intro: (n) => [[n, 'Eish! Help! A guy just grabbed my phone and ran that way!']],
      reward: { money: 140, respect: 4 },
      async run(api, giver) {
        const g = api.g;
        const a = rand(0, Math.PI * 2);
        const o = g.grid.findOpen(giver.x + Math.cos(a) * 22, giver.z + Math.sin(a) * 22, 15) || { x: giver.x + 10, z: giver.z };
        const thief = api.ped(o.x, o.z, { kind: 'npc', look: { ...randomLook(), hat: 'beanie', hatColor: '#1d1d1f' }, ai: 'flee', health: 28, runSpeed: 6.3 });
        thief.fleeFrom = { x: g.player.x, z: g.player.z };
        thief.fleeT = 999;
        thief.noReport = true;
        api.until(() => {
          if (thief.state === 'ok' && thief.ai === 'flee') thief.fleeFrom = { x: g.player.x, z: g.player.z };
          return false;
        }).catch(() => {});
        api.failIf(() => thief.state !== 'dead' && dist(thief.x, thief.z, g.player.x, g.player.z) > 130, 'The thief got away.');
        await api.defeat([thief], 'Catch the <em>phone thief</em>!');
        const d = g.grid.findOpen(thief.x + 0.6, thief.z, 4) || thief;
        await api.collect(d.x, d.z, { text: 'Grab the <em>phone</em>.', color: '#4fc3ff' });
        api.clearFails();
        await api.goTo(giver.x, giver.z, { r: 3, text: `Return the phone to <em>${giver.name}</em>.` });
        await api.talk([[giver.name, pick(['Sho! You are a legend!', 'Thank you, thank you! My whole life is on that phone.', 'Yoh, you can run! Here, take this.'])]], { focus: giver });
      },
    },
    {
      key: 'deliver', title: 'Special Delivery', weight: 3,
      setup(q) {
        const [item, rel] = pick(ITEMS);
        q.item = item;
        q.rel = rel;
        const far = PLACES.filter((p) => dist(p.x, p.z, q.x, q.z) > 200 && dist(p.x, p.z, q.x, q.z) < 650);
        q.dest = pick(far.length ? far : PLACES);
      },
      intro: (n, q) => [[n, `Please, can you take these ${q.item} to my ${q.rel} in ${q.dest.n}? They need them now now!`]],
      reward: (q) => ({ money: Math.round(70 + dist(q.x, q.z, q.dest.x, q.dest.z) * 0.25), respect: 3 }),
      async run(api, giver, q) {
        const g = api.g;
        const o = g.grid.findOpen(q.dest.x, q.dest.z, 12);
        const who = api.ped(o.x, o.z, { kind: 'npc', ai: 'idle', anim: 'wave', invulnerable: true });
        g.player.carry = true;
        const d = dist(g.player.x, g.player.z, o.x, o.z);
        api.timer(Math.round(d / 9 + 35), `The ${q.item} didn't make it in time.`);
        await api.goTo(o.x, o.z, { r: 3.2, text: `Deliver the ${q.item} to the ${q.rel} in <em>${q.dest.n}</em>. Grab a car!`, });
        api.stopTimer();
        g.player.carry = false;
        await api.talk([['Stranger', pick(['Ah, just in time! Lekker!', `My ${q.item}! You are a star.`, 'Sharp sharp, thank you!'])]], { focus: who });
      },
    },
    {
      key: 'dog', title: 'Lost Dog', weight: 2,
      setup(q) {
        q.dog = pick(DOGS);
      },
      intro: (n, q) => [[n, `Have you seen my dog ${q.dog}? He ran off chasing a seagull and now I can't find him anywhere!`]],
      reward: { money: 110, respect: 4 },
      async run(api, giver, q) {
        const g = api.g;
        let spot = null;
        for (let i = 0; i < 10 && !spot; i++) {
          const a = rand(0, Math.PI * 2), r = rand(60, 110);
          spot = g.grid.findOpen(giver.x + Math.cos(a) * r, giver.z + Math.sin(a) * r, 10);
        }
        if (!spot) spot = { x: giver.x + 30, z: giver.z };
        const dog = api.ped(spot.x, spot.z, { kind: 'dog', ai: 'roam', homeR: 10, walkSpeed: 2.2, dogColor: pick(['#b07a45', '#3a2a1a', '#d9c7a0', '#7a7a7a']), invulnerable: true });
        const area = api.target(spot.x + rand(-20, 20), spot.z + rand(-20, 20), { color: '#4fc3ff' });
        api.objective(`Search for <em>${q.dog}</em> around the blue blip.`);
        await api.until(() => dist(g.player.x, g.player.z, dog.x, dog.z) < 14);
        api.untarget(area);
        const ar = api.arrowOn(dog, '#4fc3ff');
        await api.until(() => {
          api.objective(`There's <em>${q.dog}</em>! Walk up to him.`);
          return dist(g.player.x, g.player.z, dog.x, dog.z) < 2.5 && g.player.state === 'foot';
        });
        api.removeMarker(ar);
        g.audio.pickup();
        dog.ai = 'follow';
        dog.target = g.player;
        dog.followDist = 1.6;
        api.failIf(() => dist(dog.x, dog.z, g.player.x, g.player.z) > 90, `You lost ${q.dog} again!`);
        await api.goTo(giver.x, giver.z, { r: 3, text: `Walk <em>${q.dog}</em> back to ${giver.name}. (He won't get in a car.)` });
        await api.until(() => dist(dog.x, dog.z, giver.x, giver.z) < 4);
        await api.talk([[giver.name, `${q.dog}! You naughty boy! Thank you so much, really.`]], { focus: giver });
      },
    },
    {
      key: 'lift', title: 'Need a Lift', weight: 2,
      setup(q) {
        const far = PLACES.filter((p) => dist(p.x, p.z, q.x, q.z) > 220);
        q.dest = pick(far.length ? far : PLACES);
      },
      intro: (n, q) => [[n, `Howzit! The taxis are all full. Can you give me a lift to ${q.dest.n}? I'll pay petrol money.`]],
      reward: (q) => ({ money: Math.round(60 + dist(q.x, q.z, q.dest.x, q.dest.z) * 0.22), respect: 3 }),
      async run(api, giver, q) {
        const g = api.g;
        giver.ai = 'follow';
        giver.target = g.player;
        api.objective(`Get a <em>car</em> — ${giver.name} will hop in.`);
        await api.until(() => g.player.vehicle && dist(giver.x, giver.z, g.player.x, g.player.z) < 8);
        const car = g.player.vehicle;
        giver.rig.group.visible = false;
        giver.ai = 'idle';
        api.until(() => {
          giver.x = car.x;
          giver.z = car.z;
          return false;
        }).catch(() => {});
        api.failIf(() => car.state !== 'ok', 'The car was wrecked with your passenger inside!');
        const ne = g.roads.nearestEdge(q.dest.x, q.dest.z, { traffic: true });
        await api.goTo(ne.x, ne.z, { r: 9, vehicle: car, slow: true, text: `Drive ${giver.name} to <em>${q.dest.n}</em>.`, vehicleText: 'Get back in the <em>car</em>.' });
        g.hud.say(giver.name, pick(['Lekker driving, bru!', 'Thanks! Here is something for petrol.', 'Sharp! Next time I owe you a gatsby.']), { auto: 2.6, bark: true });
      },
    },
    {
      key: 'bullies', title: 'Skollie Trouble', weight: 2,
      intro: (n) => [[n, 'Please help! Some skollies are hassling my friend just around the corner!']],
      reward: { money: 160, respect: 5 },
      async run(api, giver) {
        const g = api.g;
        const a = rand(0, Math.PI * 2);
        const o = g.grid.findOpen(giver.x + Math.cos(a) * 30, giver.z + Math.sin(a) * 30, 15) || { x: giver.x + 15, z: giver.z };
        const victim = api.ped(o.x, o.z, { kind: 'npc', ai: 'cower', invulnerable: true });
        const n = chance(0.5) ? 2 : 3;
        const thugs = api.enemies(Array.from({ length: n }, (_, i) => [o.x + Math.cos(i * 2.1) * 2.5, o.z + Math.sin(i * 2.1) * 2.5]), { health: 45, ai: 'idle' });
        thugs.forEach((t) => (t.heading = headingTo(t.x, t.z, victim.x, victim.z)));
        await api.goTo(o.x, o.z, { r: 12, text: 'Find the <em>skollies</em> around the corner.' });
        thugs.forEach((t) => {
          t.ai = 'fight';
          t.target = g.player;
        });
        g.hud.say('Thug', pick(['Mind your own business, bru!', 'Ey! You want some too?', 'Hayibo, a hero!']), { auto: 2.4, bark: true });
        await api.defeat(thugs, 'Teach the <em>skollies</em> a lesson.');
        victim.ai = 'idle';
        await api.talk([['Stranger', 'Thank you! I thought they were going to take everything.']], { focus: victim });
      },
    },
  ];
}

export class SideQuests {
  constructor(game, sys) {
    this.game = game;
    this.sys = sys;
    this.givers = [];
    this.spawnT = 12;
    this.tpl = templates(game);
  }

  update(dt) {
    const g = this.game, p = g.player;
    // retire far or old givers
    for (const q of [...this.givers]) {
      q.age += dt;
      const d = dist(q.ped.x, q.ped.z, p.x, p.z);
      if ((d > 240 || q.age > 360) && !q.started) this.removeGiver(q);
    }
    if (!g.started || this.sys.active || p.onPlateau || g.activities.taxiActive) return;
    if (!this.sys.isDone('m1')) return;
    this.spawnT -= dt;
    if (this.spawnT > 0 || this.givers.length >= 2) return;
    this.spawnT = rand(25, 45);
    const e = g.roads.randomEdgeNear(p.x, p.z, 70, 160);
    if (!e) return;
    const from = chance(0.5) ? e.a : e.b;
    const pt = g.roads.sidewalkPoint(e, from, rand(5, Math.max(6, e.len - 5)), chance(0.5) ? 1 : -1);
    if (!g.grid.isWalkable(pt.x, pt.z) || g.grid.circleBlocked(pt.x, pt.z, 0.6)) return;
    if (this.givers.some((q) => dist(q.ped.x, q.ped.z, pt.x, pt.z) < 80)) return;
    this.addGiver(pt.x, pt.z);
  }

  addGiver(x, z) {
    const g = this.game;
    const total = this.tpl.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total, t = this.tpl[0];
    for (const tt of this.tpl) {
      r -= tt.weight;
      if (r <= 0) {
        t = tt;
        break;
      }
    }
    const name = pick(NAMES);
    const ped = g.peds.spawn(x, z, { kind: 'npc', look: randomLook(), ai: 'idle', anim: 'wave', mission: true, name, faceTarget: true, invulnerable: true });
    ped.baseAnim = 'wave';
    const q = { id: QID++, t, ped, name, x, z, age: 0, started: false };
    if (t.setup) t.setup(q);
    ped.icon = g.effects.marker(0, 0, { color: '#4fc3ff', radius: 0.01, height: 0.01, icon: '?', iconColor: '#4fc3ff', pulse: false });
    ped.icon.cyl.visible = ped.icon.ring.visible = false;
    ped.rig.group.add(ped.icon.group);
    ped.icon.group.position.set(0, 1.1, 0);
    const iid = 'side_' + q.id;
    g.interactions.add(iid, { pos: () => ped, r: 2.6, label: `? Talk to ${name}`, priority: 1, onUse: () => this.offer(q) });
    q.iid = iid;
    this.givers.push(q);
  }

  removeGiver(q, keepPed = false) {
    const g = this.game;
    g.interactions.remove(q.iid);
    if (q.ped.icon) {
      q.ped.rig.group.remove(q.ped.icon.group);
      q.ped.icon.remove();
      q.ped.icon = null;
    }
    if (!keepPed && g.peds.list.includes(q.ped)) g.peds.remove(q.ped);
    this.givers = this.givers.filter((x) => x !== q);
  }

  async offer(q) {
    const g = this.game;
    if (this.sys.active) return g.hud.toast('Finish your current job first.');
    const reward = typeof q.t.reward === 'function' ? q.t.reward(q) : q.t.reward;
    const ped = q.ped;
    q.started = true;
    this.removeGiver(q, true);
    ped.anim = null;
    ped.baseAnim = null;
    const def = {
      id: 'side_' + q.id, kind: 'side', title: q.t.title, reward,
      async run(api) {
        api.spawned.peds.push(ped);
        await api.talk(q.t.intro(q.name, q), { focus: ped, speakers: { [q.name]: ped } });
        const c = await api.choose(`${q.t.title} — reward ${reward.money ? 'R' + reward.money : ''}${reward.respect ? ` + ${reward.respect} respect` : ''}`, [{ text: 'Sure, I\'ll help.' }, { text: 'Sorry, not now.' }]);
        if (c === 1) {
          api.toast(`${q.name} looks disappointed.`);
          throw new MissionFail('ended');
        }
        ped.name = q.name;
        await q.t.run(api, ped, q);
      },
    };
    this.sys.start(def, { silent: true });
  }

  blips(out, full) {
    const p = this.game.player;
    for (const q of this.givers) {
      if (!full && dist(q.ped.x, q.ped.z, p.x, p.z) > 200) continue;
      out.push({ x: q.ped.x, z: q.ped.z, color: '#4fc3ff', letter: '?', size: 7 });
    }
  }
}
