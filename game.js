(() => {
  'use strict';

  // ---------- Config ----------
  const SAVE_KEY = 'chronosExpress.save.v1';
  const MIN_POPUP_SECONDS = 5;          // don't show the popup for very short absences
  const MAX_OFFLINE_SECONDS = Infinity; // set e.g. 8 * 3600 to cap offline earnings
  const TAP_VALUE = 1;
  const CAR = { baseCost: 15, growth: 1.15, ticketsPerSecond: 1 };

  // ---------- State ----------
  const state = { tickets: 0, cars: 0, lastSeen: Date.now() };

  const $ = (id) => document.getElementById(id);
  const el = {
    balance: $('balance'), rate: $('rate'), engine: $('engine'), train: $('train'),
    buyCar: $('buy-car'), carCost: $('car-cost'), owned: $('owned'),
    welcome: $('welcome'), awayTime: $('away-time'), awayEarned: $('away-earned'),
    welcomeClose: $('welcome-close'),
  };

  // ---------- Derived values ----------
  const ticketsPerSecond = () => state.cars * CAR.ticketsPerSecond;
  const carCost = () => Math.ceil(CAR.baseCost * Math.pow(CAR.growth, state.cars));

  // ---------- Formatting ----------
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  function fmt(n) {
    if (n < 1000) return Math.floor(n).toLocaleString();
    const tier = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
    return (n / Math.pow(1000, tier)).toFixed(2) + SUFFIXES[tier];
  }
  function fmtDuration(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h && `${h}h`, (h || m) && `${m}m`, `${s}s`].filter(Boolean).join(' ');
  }

  // ---------- Save / load ----------
  function save() {
    state.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      state.tickets = Number(d.tickets) || 0;
      state.cars = Math.max(0, Math.floor(Number(d.cars)) || 0);
      state.lastSeen = Number(d.lastSeen) || Date.now();
    } catch (e) { /* corrupt save: start fresh */ }
  }

  // ---------- Offline idle calculator ----------
  function claimOfflineTickets() {
    const now = Date.now();
    let seconds = Math.floor((now - state.lastSeen) / 1000);
    if (!(seconds > 0)) { state.lastSeen = now; return; } // clock moved backwards or no time passed
    seconds = Math.min(seconds, MAX_OFFLINE_SECONDS);

    const earned = seconds * ticketsPerSecond();
    state.tickets += earned;
    save(); // also resets lastSeen to now

    if (seconds >= MIN_POPUP_SECONDS && earned > 0) {
      el.awayTime.textContent = fmtDuration(seconds);
      el.awayEarned.textContent = fmt(earned);
      el.welcome.hidden = false;
      el.welcomeClose.focus();
    }
  }

  // ---------- Rendering ----------
  function render() {
    el.balance.textContent = fmt(state.tickets);
    el.rate.textContent = fmt(ticketsPerSecond());
    el.owned.textContent = state.cars;
    el.carCost.textContent = fmt(carCost());
    el.buyCar.disabled = state.tickets < carCost();
  }

  function floatText(x, y, text) {
    const f = document.createElement('div');
    f.className = 'float';
    f.textContent = text;
    f.style.left = x - 12 + 'px';
    f.style.top = y - 24 + 'px';
    document.body.appendChild(f);
    f.addEventListener('animationend', () => f.remove());
  }

  // ---------- Actions ----------
  el.engine.addEventListener('click', (e) => {
    state.tickets += TAP_VALUE;
    // Keyboard clicks report 0,0, so fall back to the button's centre
    const r = el.engine.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top;
    floatText(x, y, '+' + TAP_VALUE);
    el.train.classList.add('bump');
    setTimeout(() => el.train.classList.remove('bump'), 80);
    render();
  });

  el.buyCar.addEventListener('click', () => {
    const cost = carCost();
    if (state.tickets < cost) return;
    state.tickets -= cost;
    state.cars += 1;
    save();
    render();
  });

  el.welcomeClose.addEventListener('click', () => { el.welcome.hidden = true; });

  // ---------- Game loop ----------
  let lastTick = Date.now();
  setInterval(() => {
    if (document.hidden) return; // time away is credited by the offline calculator
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    if (dt > 0) state.tickets += ticketsPerSecond() * dt;
    render();
  }, 100);

  setInterval(() => { if (!document.hidden) save(); }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      save();
    } else {
      claimOfflineTickets();
      lastTick = Date.now();
      render();
    }
  });
  window.addEventListener('pagehide', save);

  // ---------- Init ----------
  load();
  claimOfflineTickets();
  render();

  // ---------- PWA ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
