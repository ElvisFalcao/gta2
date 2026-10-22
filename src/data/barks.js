// Street dialogue ("barks") for the voice system. Every line has a stable id; a recorded
// clip for it lives at assets/voice/<voice>/<id>.ogg and replaces the text-to-speech placeholder.
// Lines are [id, text] or [id, text, english gloss] for Afrikaans / Kaaps / isiXhosa lines
// (the gloss is shown as the subtitle). `node tools/voice-script.mjs` turns this file into the
// recording script for the voice actors.
//
// PLEASE have native speakers check the Kaaps, Afrikaans and isiXhosa before recording.

// Voice profiles. pitch / rate only shape the text-to-speech placeholder.
export const VOICES = {
  aunty: { label: 'Aunty (older woman)', female: true, pitch: 1.1, rate: 0.95 },
  sisi: { label: 'Sisi (young woman)', female: true, pitch: 1.3, rate: 1.06 },
  oom: { label: 'Oom / Tata (older man)', female: false, pitch: 0.75, rate: 0.9 },
  bra: { label: 'Bra (young man)', female: false, pitch: 1.0, rate: 1.08 },
  thug: { label: 'Gang member', female: false, pitch: 0.85, rate: 1.1 },
  cop: { label: 'SAPS officer', female: false, pitch: 0.9, rate: 1.0 },
};
export const CIV_VOICES = ['aunty', 'sisi', 'oom', 'bra'];
const MEN = ['oom', 'bra'];

// Named characters (mission barks go through hud.say with these names).
export const CHARACTER_VOICES = {
  Kyle: 'bra', Zanele: 'sisi', 'Auntie Noma': 'aunty', Noma: 'aunty', 'Bra Vusi': 'oom', Vusi: 'oom',
  'Aunty Rashieda': 'aunty', Rashieda: 'aunty', Pieter: 'oom', Jade: 'sisi', Steyn: 'oom', 'Victor Steyn': 'oom',
  Thug: 'thug', Guard: 'thug', Jackal: 'thug', Cop: 'cop', Officer: 'cop', Police: 'cop',
  Passenger: null, Stranger: null, // null: pick a civilian voice from the name
};

// category: { voices, lines, area? (only in these districts), cooldown (s, per category) }
export const BARKS = {
  greet: {
    voices: CIV_VOICES,
    cooldown: 6,
    lines: [
      ['greet_howzit', 'Howzit!'],
      ['greet_howzit_bru', 'Howzit, bru.'],
      ['greet_sharp', 'Sharp sharp!'],
      ['greet_molo', 'Molo, bhuti!', 'Hello, brother!'],
      ['greet_molweni', 'Molweni!', 'Hello everyone!'],
      ['greet_unjani', 'Unjani?', 'How are you?'],
      ['greet_hoesit', 'Hoesit, my bru?', "How's it, my friend?"],
      ['greet_goeie_more', 'Goeie môre!', 'Good morning!'],
      ['greet_lekker_day', 'Lekker day, hey?'],
      ['greet_hat', "Nice hat, my bra!"],
      ['greet_sizwe', "Ey, aren't you that oke from the posters?"],
      ['greet_cousin', 'Ah, my cousin! Long time!'],
      ['greet_eita', 'Eita!'],
      ['greet_heita', 'Heita, grootman!', 'Hey, big man!'],
      ['greet_aunty_baby', "Shame, you look hungry, my baby.", null, ['aunty']],
      ['greet_oom_youngster', 'Môre, jong. Behave yourself, hey.', 'Morning, young man. Behave yourself.', ['oom']],
    ],
  },
  ambient: {
    voices: CIV_VOICES,
    cooldown: 4,
    lines: [
      ['amb_loadshedding', 'Eish, load shedding again tonight. Stage four!'],
      ['amb_taxi_late', 'This taxi is just now-now. Which now-now? I\'m going to be late.'],
      ['amb_just_now', 'I\'ll do it just now, man, relax.'],
      ['amb_wind', 'This south-easter, hey! The Cape Doctor is working overtime.'],
      ['amb_braai', 'Braai at my place Saturday. Bring your own meat.'],
      ['amb_phone_airtime', 'Hello? Hello? Eish, my airtime is finished.'],
      ['amb_bokke', 'Did you see the Bokke on Saturday? Lekker!'],
      ['amb_stormers', 'Stormers this year, I\'m telling you.'],
      ['amb_rent', 'Rent in this town, hey. Haai, it\'s too much.'],
      ['amb_mountain', 'Tablecloth is on the mountain. Weather is changing.'],
      ['amb_gatsby', 'I could murder a Gatsby right now.'],
      ['amb_robot', 'That robot on Strand Street has been broken for a week.'],
      ['amb_hayibo', 'Hayibo! Did you hear what happened?', 'No way! Did you hear what happened?'],
      ['amb_ja_nee', 'Ja nee. That\'s life.', 'Yes, well. That\'s life.'],
      ['amb_aikona', 'Aikona, not today.', 'No way, not today.'],
      ['amb_mayor', 'This mayor thing, everybody is talking about it.'],
      ['amb_silverleaf', 'Silverleaf wants to buy the whole city, I\'m telling you.'],
      ['amb_noma', 'Auntie Noma is the only one who listens to us.'],
      ['amb_kos', 'Wat gaan ons vanaand eet?', 'What are we eating tonight?'],
      ['amb_eish_tired', 'Eish, I\'m tired, man.'],
    ],
  },
  ambientNight: {
    voices: CIV_VOICES,
    cooldown: 6,
    lines: [
      ['night_go_home', 'It\'s late, let\'s go home, man.'],
      ['night_cold', 'Brrr, it\'s cold tonight.'],
      ['night_stars', 'Look at the lights on the mountain.'],
      ['night_careful', 'Walk on the lit side, hey. Be careful.'],
      ['night_uber', 'Where is this Uber? It says two minutes for ten minutes!'],
      ['night_lekker_lag', 'Ag, that was lekker. Same time next week?', 'Oh, that was great. Same time next week?'],
    ],
  },
  bumped: {
    voices: CIV_VOICES,
    cooldown: 2,
    lines: [
      ['bump_watch', 'Ey, watch where you\'re going!'],
      ['bump_sorry', 'Sorry, sorry!'],
      ['bump_ag_man', 'Ag, man!', 'Oh, come on!'],
      ['bump_jislaaik', 'Jislaaik! Careful!', 'Geez! Careful!'],
      ['bump_eish', 'Eish, my toes!'],
      ['bump_pasop', 'Pas op, jong!', 'Watch out, boy!'],
      ['bump_rush', 'What\'s the rush, bru?'],
      ['bump_hayi', 'Hayi bo, wena!', 'Hey, you!'],
      ['bump_manners', 'Where are your manners?', null, ['aunty', 'oom']],
      ['bump_excuse', 'Excuse me! Do you mind?'],
    ],
  },
  nearMiss: {
    voices: CIV_VOICES,
    cooldown: 2,
    lines: [
      ['miss_mal', 'Is jy mal?!', 'Are you crazy?!'],
      ['miss_learn_drive', 'Learn to drive, man!'],
      ['miss_license', 'Who gave you a licence?!'],
      ['miss_slow_down', 'Slow down, you maniac!'],
      ['miss_yoh', 'Yoh! Yoh! Yoh!'],
      ['miss_pavement', 'This is a pavement, not a road!'],
      ['miss_taxi', 'You drive like a taxi, bru!'],
      ['miss_almost', 'You almost killed me!'],
      ['miss_hhayi', 'Hhayi! Uyaphambana?', 'Hey! Are you crazy?'],
      ['miss_my_word', 'My word!', null, ['aunty', 'oom']],
    ],
  },
  honked: {
    voices: CIV_VOICES,
    cooldown: 3,
    lines: [
      ['honk_relax', 'Relax, man, I\'m walking!'],
      ['honk_horn', 'Ja, ja, we heard your horn!'],
      ['honk_where', 'Where must I go? Fly?'],
      ['honk_patience', 'Patience, bru!'],
      ['honk_toot', 'Toot toot yourself!'],
      ['honk_suka', 'Suka!', 'Get lost!'],
      ['honk_hoot', 'Don\'t hoot at me, I\'m not a taxi!'],
      ['honk_jirre', 'Jirre, nou toet hy!', 'Lord, now he\'s hooting!'],
    ],
  },
  hurt: {
    voices: CIV_VOICES,
    cooldown: 1.5,
    lines: [
      ['hurt_eina', 'Eina!', 'Ouch!'],
      ['hurt_why', 'Why?! What did I do?'],
      ['hurt_help', 'Help! Somebody help!'],
      ['hurt_police', 'I\'m calling the police!'],
      ['hurt_maye', 'Maye babo!', 'Oh my goodness!'],
      ['hurt_crazy', 'This guy is crazy!'],
      ['hurt_nooit', 'Nooit, man!', 'No way, man!'],
      ['hurt_mama', 'Yho, mama!'],
    ],
  },
  fightBack: {
    voices: MEN,
    cooldown: 3,
    lines: [
      ['fight_come', 'You want to fight? Come!'],
      ['fight_wrong_guy', 'You picked the wrong guy, bru!'],
      ['fight_ek_sal', 'Ek sal jou wys!', 'I\'ll show you!'],
      ['fight_soft', 'You think I\'m soft?'],
    ],
  },
  witness: {
    voices: CIV_VOICES,
    cooldown: 3,
    lines: [
      ['wit_run', 'Run! Run!'],
      ['wit_fight', 'Fight! Fight!'],
      ['wit_police', 'Somebody call the police!'],
      ['wit_hayi', 'Hayi, this one is mad!', 'No, this one is mad!'],
      ['wit_oh_my', 'Oh my word!'],
      ['wit_phone', 'I\'m filming this!'],
      ['wit_hardloop', 'Hardloop!', 'Run!'],
      ['wit_leave', 'Leave him alone!'],
      ['wit_not_again', 'Not again, man. Every day!'],
      ['wit_baleka', 'Balekani!', 'Run, everyone!'],
    ],
  },
  wanted: {
    voices: CIV_VOICES,
    cooldown: 6,
    lines: [
      ['want_thats_him', 'That\'s him! That\'s the guy!'],
      ['want_over_here', 'Officer! Over here!'],
      ['want_on_tv', 'Ey, you were on the news, bru!'],
      ['want_trouble', 'You\'re in big trouble, my friend.'],
      ['want_hide', 'They\'re looking for you! Go, go!'],
      ['want_dont_look', 'Don\'t look at him, just keep walking.'],
    ],
  },
  carjacked: {
    voices: CIV_VOICES,
    cooldown: 2,
    lines: [
      ['jack_my_car', 'My car! That\'s my car!'],
      ['jack_insured', 'Take it, take it! It\'s insured!'],
      ['jack_payments', 'I still have payments on that!'],
      ['jack_thief', 'Thief! Stop him!'],
      ['jack_kar', 'My kar! Bring terug my kar!', 'My car! Bring back my car!'],
      ['jack_imoto', 'Imoto yam!', 'My car!'],
    ],
  },
  beach: {
    voices: CIV_VOICES,
    cooldown: 6,
    lines: [
      ['beach_cold', 'The water is freezing, bru! Ice cold!'],
      ['beach_sunscreen', 'Did you bring the sunscreen?'],
      ['beach_waves', 'Lekker waves today.'],
      ['beach_wind', 'Sand in my sandwich again!'],
      ['beach_atlantic', 'Atlantic side? No thanks, I\'m going to Muizenberg.'],
      ['beach_ice_cream', 'Ice cream! Who wants ice cream?'],
      ['beach_tan', 'I\'m not burning, I\'m tanning.'],
      ['beach_shark', 'Shark spotter flag is green. We\'re fine.'],
    ],
  },
  food: {
    voices: CIV_VOICES,
    cooldown: 6,
    lines: [
      ['food_gatsby', 'One full house Gatsby, extra chips!'],
      ['food_slap', 'Slap chips with vinegar, please.', 'Soft chips with vinegar, please.'],
      ['food_bunny', 'This bunny chow is hot hot!'],
      ['food_koeksister', 'Koeksisters, fresh this morning!'],
      ['food_shisa', 'The meat at the shisa nyama is ready!'],
      ['food_vetkoek', 'Vetkoek and mince, R15!', 'Fat cakes and mince, R15!'],
      ['food_samoosa', 'Samoosas! Get your samoosas!'],
      ['food_hungry', 'Is it ready yet? I\'m starving.'],
    ],
  },
  taxiRank: {
    voices: MEN,
    cooldown: 4,
    lines: [
      ['rank_kaapstad', 'Kaapstad! Kaapstad! Kaapstad!', 'Cape Town! Cape Town!'],
      ['rank_wynberg', 'Wynberg! Wynberg! One more seat!'],
      ['rank_langa', 'Langa, Langa! Siyahamba!', 'Langa! We\'re leaving!'],
      ['rank_bellville', 'Bellville! Bellville!'],
      ['rank_one_seat', 'One seat left! Squeeze in, sisi!'],
      ['rank_change', 'Pass the money forward, please!'],
      ['rank_khaya', 'Khayelitsha! Last one!'],
      ['rank_kom_kom', 'Kom, kom, kom! Ons ry!', 'Come, come! We\'re going!'],
    ],
  },
  langa: {
    voices: CIV_VOICES,
    area: ['Langa'],
    cooldown: 6,
    lines: [
      ['langa_ndiyabulela', 'Ndiyabulela, mntase.', 'Thank you, my sibling.'],
      ['langa_soccer', 'Who\'s playing at the field today?'],
      ['langa_kunjani', 'Kunjani namhlanje?', 'How is it today?'],
      ['langa_sharp', 'Sharp, sizobonana.', 'Sharp, see you later.'],
      ['langa_mama', 'Mama is cooking umngqusho tonight.', 'Mama is cooking samp and beans tonight.'],
      ['langa_ubuntu', 'Umntu ngumntu ngabantu.', 'A person is a person through other people.'],
    ],
  },
  boKaap: {
    voices: CIV_VOICES,
    area: ['Bo-Kaap'],
    cooldown: 6,
    lines: [
      ['bk_houses', 'They want to buy our houses, but we\'re not selling.'],
      ['bk_mos', 'Ja, ons is mos hier gebore.', 'Yes, we were born here, you know.'],
      ['bk_koeksister', 'Aunty Rashieda\'s koeksisters are the best in the Cape.'],
      ['bk_paint', 'Pink or green this year? I can\'t decide.'],
      ['bk_lekker_bly', 'Lekker bly, hoor!', 'Take care, okay!'],
      ['bk_mosque', 'I\'ll see you after prayers.'],
    ],
  },
  gangTaunt: {
    voices: ['thug'],
    cooldown: 3,
    lines: [
      ['gang_wrong_hood', 'You\'re in the wrong place, laaitie!'],
      ['gang_get_him', 'Get him, boys!'],
      ['gang_jackal', 'The Jackal sends his regards!'],
      ['gang_moer', 'Ek gaan jou moer, jong!', 'I\'m going to beat you up!'],
      ['gang_hero', 'Look at this hero!'],
      ['gang_come', 'Come here, come here!'],
      ['gang_voetsek', 'Voetsek!', 'Get lost!'],
      ['gang_steyn', 'Steyn pays us well, bru. Nothing personal.'],
    ],
  },
  gangHurt: {
    voices: ['thug'],
    cooldown: 2,
    lines: [
      ['ganghurt_eina', 'Eina! You\'ll pay for that!'],
      ['ganghurt_lucky', 'Lucky shot!'],
      ['ganghurt_back', 'Back off, back off!'],
      ['ganghurt_okay', 'Okay okay, enough!'],
      ['ganghurt_jislaaik', 'Jislaaik, this oke can fight!'],
      ['ganghurt_retreat', 'Let\'s go, let\'s go!'],
    ],
  },
  copChase: {
    voices: ['cop'],
    cooldown: 4,
    lines: [
      ['cop_stop', 'Stop! Police!'],
      ['cop_saps', 'SAPS! On the ground!'],
      ['cop_hands', 'Hands where I can see them!'],
      ['cop_dont_run', 'Don\'t make me run, it\'s hot today!'],
      ['cop_suspect', 'Suspect on foot, heading north!'],
      ['cop_backup', 'Control, we need backup!'],
      ['cop_staan', 'Staan stil!', 'Stand still!'],
      ['cop_easy', 'We can do this the easy way, my friend.'],
      ['cop_yima', 'Yima!', 'Stop!'],
      ['cop_station', 'You\'re coming to Caledon Square with me.'],
    ],
  },
  copHurt: {
    voices: ['cop'],
    cooldown: 2,
    lines: [
      ['cophurt_assault', 'That\'s assaulting an officer!'],
      ['cophurt_officer_down', 'Officer down! Officer down!'],
      ['cophurt_big_mistake', 'Big mistake, my friend.'],
      ['cophurt_eish', 'Eish! Now you\'re in trouble!'],
    ],
  },
};

// Stable id for a free-text line (mission barks spoken through hud.say), shared with the script tool.
export function lineIdFor(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'x_' + (h >>> 0).toString(36);
}
