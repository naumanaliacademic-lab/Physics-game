/* ==========================================================================
   engine.js — save state, progression, routing.
   Everything the player earns lives in one object persisted to localStorage.
   ========================================================================== */

const Game = (() => {
  'use strict';

  const SAVE_KEY = 'vector-rescue.save.v1';

  const RANKS = [
    { xp: 0,    name: 'Cadet' },
    { xp: 350,  name: 'Pilot 3rd Class' },
    { xp: 800,  name: 'Pilot 2nd Class' },
    { xp: 1400, name: 'Pilot 1st Class' },
    { xp: 2100, name: 'Flight Officer' },
    { xp: 3000, name: 'Rescue Commander' }
  ];

  /* Badges are awarded for beating a named misconception from the decks,
     so a student can see exactly which wrong idea they have retired. */
  const BADGES = {
    pathfinder:   { icon: '🧭', name: 'Pathfinder',    desc: 'Distance is path length; displacement is the change in position.' },
    signmaster:   { icon: '±',  name: 'Sign Master',   desc: 'Negative acceleration means "towards negative", not "slowing down".' },
    gradient:     { icon: '📈', name: 'Gradient Eye',  desc: 'Read velocity from a tangent, not from value ÷ time.' },
    areahunter:   { icon: '🔷', name: 'Area Hunter',   desc: 'Area under v–t is displacement; below the axis counts negative.' },
    chooser:      { icon: '🎛️', name: 'Equation Picker', desc: 'Pick the suvat equation that leaves out the quantity you do not have.' },
    topofflight:  { icon: '🔝', name: 'Top of Flight', desc: 'At the highest point v = 0 but a = g downwards.' },
    independence: { icon: '🎯', name: 'Independence',  desc: 'Horizontal and vertical motion are independent.' },
    terminal:     { icon: '🪂', name: 'Terminal',      desc: 'At terminal speed forces balance — the resultant force is zero.' },
    dragaware:    { icon: '🌬️', name: 'Drag Aware',    desc: 'With drag: lower peak, shorter range, asymmetric path.' },
    commander:    { icon: '🎖️', name: 'Commander',     desc: 'Cleared Mission Alpha, the full A.1 rescue exam.' }
  };

  const defaultSave = () => ({
    name: 'Pilot',
    xp: 0,
    zones: {},          // id -> { stars, best, cleared }
    badges: {},         // id -> true
    seen: {},           // misconception cards already shown
    totalCorrect: 0,
    totalAnswered: 0
  });

  let save = defaultSave();

  /* ------------------------------ persistence --------------------------- */

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) save = Object.assign(defaultSave(), JSON.parse(raw));
    } catch (err) {
      // Private browsing or blocked storage: play on with an in-memory save.
      save = defaultSave();
    }
    return save;
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) { /* storage unavailable — progress stays for this session */ }
  }

  function reset() {
    save = defaultSave();
    persist();
  }

  /* ------------------------------ progression --------------------------- */

  function rank() {
    let r = RANKS[0];
    for (const candidate of RANKS) if (save.xp >= candidate.xp) r = candidate;
    return r;
  }

  function nextRank() {
    return RANKS.find(r => r.xp > save.xp) || null;
  }

  function addXp(amount) {
    const before = rank().name;
    save.xp = Math.max(0, save.xp + amount);
    persist();
    const after = rank().name;
    if (after !== before) UI.toast(`Promoted to ${after}!`, 2600);
    UI.syncHud();
    return save.xp;
  }

  function awardBadge(id) {
    if (!BADGES[id] || save.badges[id]) return false;
    save.badges[id] = true;
    persist();
    UI.toast(`${BADGES[id].icon} Badge unlocked — ${BADGES[id].name}`, 3000);
    return true;
  }

  function recordAnswer(correct) {
    save.totalAnswered++;
    if (correct) save.totalCorrect++;
    persist();
  }

  /** Stars are a 0–5 rating of a zone run; only an improvement is stored. */
  function finishZone(zoneId, { stars, score }) {
    const prev = save.zones[zoneId] || { stars: 0, best: 0, cleared: false };
    save.zones[zoneId] = {
      stars: Math.max(prev.stars, stars),
      best: Math.max(prev.best, score),
      cleared: prev.cleared || stars > 0
    };
    persist();
    UI.syncHud();
    return save.zones[zoneId];
  }

  function zoneState(zoneId) {
    return save.zones[zoneId] || { stars: 0, best: 0, cleared: false };
  }

  function totalStars() {
    return Object.values(save.zones).reduce((sum, z) => sum + (z.stars || 0), 0);
  }

  /** A zone unlocks when the one before it has been cleared. */
  function isUnlocked(zone, allZones) {
    if (!zone.requires) return true;
    return zone.requires.every(id => zoneState(id).cleared);
  }

  /* ------------------------------ routing ------------------------------- */

  const routes = {};
  let current = null;

  function route(name, renderFn) { routes[name] = renderFn; }

  function go(name, params) {
    const render = routes[name];
    if (!render) { console.warn('No route:', name); return; }
    current = name;
    if (typeof Zone !== 'undefined') Zone.stopAll();
    const screen = document.getElementById('screen');
    screen.innerHTML = '';
    document.getElementById('hud').hidden = (name === 'title');
    window.scrollTo(0, 0);
    render(screen, params || {});
    UI.syncHud();
  }

  return {
    BADGES, RANKS,
    load, persist, reset,
    get save() { return save; },
    rank, nextRank, addXp, awardBadge, recordAnswer,
    finishZone, zoneState, totalStars, isUnlocked,
    route, go,
    get current() { return current; }
  };
})();
