// Boot: build the world behind the title screen, then start or continue the game.

import { Game } from './game.js';

const $ = (s) => document.querySelector(s);
const bar = $('.load-bar i');
const msg = $('.load-msg');

function fail(e) {
  console.error(e);
  msg.textContent = 'Could not start the game: ' + (e && e.message ? e.message : e) + '. WebGL is required.';
  window.__failed = true;
}

async function boot() {
  const game = new Game();
  window.__game = game;
  try {
    await game.init((m, f) => {
      msg.textContent = m;
      bar.style.width = Math.round(f * 100) + '%';
    });
  } catch (e) {
    fail(e);
    return;
  }
  $('#loading').classList.add('hidden');
  $('#title-btns').classList.remove('hidden');
  const cont = $('#btn-continue');
  if (game.hasSave()) cont.classList.remove('hidden');

  const goFull = () => {
    if (!game.input.touchMode) return;
    const el = document.documentElement;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    } catch {
      /* not allowed here */
    }
  };
  const start = (fn) => {
    game.audio.init();
    goFull();
    fn();
  };
  cont.addEventListener('click', () => start(() => game.continueGame()));
  $('#btn-new').addEventListener('click', () => {
    if (game.hasSave() && !$('#btn-new').dataset.armed) {
      $('#btn-new').dataset.armed = '1';
      $('#btn-new').textContent = 'Tap again: overwrite save';
      return;
    }
    start(() => game.newGame());
  });
  $('#btn-how').addEventListener('click', () => $('#how').classList.toggle('hidden'));
  $('#btn-how-close').addEventListener('click', () => $('#how').classList.add('hidden'));
  window.__ready = true;
  const params = new URLSearchParams(location.search);
  if (params.has('autostart')) start(() => (params.get('autostart') === 'continue' ? game.continueGame() : game.newGame()));
}

boot();
