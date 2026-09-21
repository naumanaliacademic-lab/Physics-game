/* ==========================================================================
   main.js — title screen, mission map, and the routes that tie them together.
   ========================================================================== */

(() => {
  'use strict';
  const el = UI.el;

  const ZONES = [Zone1, Zone2, Zone3, Zone4, Zone5];
  const ALL = [...ZONES, FinalMission];
  const byId = id => ALL.find(z => z.META.id === id);

  /* Each zone opens once the one before it has been cleared. */
  ZONES.forEach((z, i) => { if (i > 0) z.META.requires = [ZONES[i - 1].META.id]; });

  const SKILLS = {
    z1: 'distance vs displacement · speed vs velocity · the sign of a',
    z2: 'gradients · tangents · areas · uniform and non-uniform acceleration',
    z3: 'the four equations · sign conventions · free fall',
    z4: 'components · two columns · time of flight, range, max height',
    z5: 'drag · terminal speed · the six effects on a projectile',
    final: 'every subtopic, including all five hinge questions'
  };

  /* ------------------------------ title ---------------------------------- */

  Game.route('title', root => {
    const nameInput = el('input', { type: 'text', maxlength: 24, value: Game.save.name === 'Pilot' ? '' : Game.save.name, placeholder: 'e.g. Amara' });

    const start = () => {
      const given = nameInput.value.trim();
      Game.save.name = given || 'Pilot';
      Game.persist();
      Game.go('map');
    };
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

    root.append(
      el('div.title', null,
        el('div.title__logo', null, 'VECTOR RESCUE'),
        el('p.title__sub', { html: 'IB DP Physics · Theme A · <strong>A.1 Kinematics</strong><br>Five zones, one question: where will it be, and when?' }),
        el('div.panel.title__card', null,
          el('div.eyebrow', null, 'Cadet registration'),
          el('p.small.muted', { html: 'You are a rescue pilot in training. Each zone teaches one subtopic by making you fly it — plot a route, build a velocity–time graph, pick the right equation, aim a launcher, survive a skydive.' }),
          el('label.field', null, el('span', null, 'Call sign'), nameInput),
          el('button.btn.btn--primary.btn--wide', { type: 'button', onClick: start }, 'Begin training ▶'),
          el('p.small.muted.mt.mb0', { html: `Take <strong>g = 9.81 m s⁻²</strong> throughout, exactly as the deck does. Progress saves in this browser.` })
        ),
        Game.save.xp > 0 ? el('p.small.muted.mt', { html: `Welcome back — ${Game.save.xp} XP, ${Game.totalStars()} stars so far.` }) : null
      )
    );
  });

  /* ------------------------------ mission map ---------------------------- */

  Game.route('map', root => {
    const cleared = ZONES.filter(z => Game.zoneState(z.META.id).cleared).length;

    root.append(el('div.spread', null,
      el('div', null,
        el('div.eyebrow', null, 'Mission map'),
        el('h1', { style: { marginBottom: '2px' } }, 'A.1 Kinematics'),
        el('p.muted.mb0', { html: 'Five zones follow the five subtopics of the deck, in order.' })
      ),
      el('div.center', null,
        el('div', { style: { font: '700 1.6rem ui-monospace,monospace', color: '#2fd6c3' } }, `${cleared}/5`),
        el('div.small.muted', null, 'zones cleared')
      )
    ));

    const grid = el('div.map-grid.mt');
    ALL.forEach(mod => {
      const m = mod.META;
      const st = Game.zoneState(m.id);
      const unlocked = Game.isUnlocked(m, ALL);
      const card = el('button.zone-card', {
        type: 'button',
        disabled: !unlocked,
        style: { '--accent': m.accent },
        onClick: () => Game.go('zone', { id: m.id })
      },
        el('span.zone-card__tag', { style: { color: m.accent } }, m.tag),
        el('span.zone-card__name', null, m.name),
        el('span.zone-card__sub', null, m.subtitle),
        el('span.zone-card__skills', null, SKILLS[m.id] || ''),
        el('span.zone-card__foot', null,
          el('span.zone-card__stars', null, UI.stars(st.stars, 5)),
          el('span.zone-card__best', null, st.cleared ? `best ${st.best}` : (unlocked ? 'not flown' : 'locked'))
        ),
        !unlocked ? el('span.zone-card__lock', null, '🔒') : null
      );
      grid.append(card);
    });
    root.append(grid);

    /* Badges: one per misconception retired. */
    const badges = el('div.badge-grid');
    Object.entries(Game.BADGES).forEach(([id, b]) => {
      const on = !!Game.save.badges[id];
      badges.append(el('div.badge' + (on ? '.badge--on' : ''), null,
        el('span.badge__icon', null, b.icon),
        el('span.badge__name', null, b.name),
        el('span.badge__desc', { html: on ? b.desc : 'Locked' })
      ));
    });

    const answered = Game.save.totalAnswered;
    const accuracy = answered ? Math.round((Game.save.totalCorrect / answered) * 100) : 0;

    root.append(el('div.panel.mt', null,
      el('div.spread', null,
        el('div.eyebrow', null, 'Misconceptions retired'),
        el('span.small.muted', null, answered ? `${Game.save.totalCorrect}/${answered} answered correctly · ${accuracy}%` : 'no questions answered yet')
      ),
      el('p.small.muted', { html: 'Each badge is one wrong idea from the deck\'s "common misconceptions" slides that you have now beaten.' }),
      badges
    ));

    root.append(el('div.panel', null,
      el('div.eyebrow', null, 'Revision links from the deck'),
      el('table.data', { html: `
        <tr><th>Resource</th><th>Use it for</th></tr>
        <tr><td><a href="https://phet.colorado.edu/sims/cheerpj/moving-man/latest/moving-man.html" target="_blank" rel="noopener">PhET: The Moving Man</a></td><td>S2 motion graphs</td></tr>
        <tr><td><a href="https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_en.html" target="_blank" rel="noopener">PhET: Projectile Motion</a></td><td>S4 and S5</td></tr>
        <tr><td><a href="https://www.youtube.com/watch?v=E43-CfukEgs" target="_blank" rel="noopener">BBC: the world's biggest vacuum chamber</a></td><td>S3 free fall</td></tr>
        <tr><td><a href="https://www.youtube.com/watch?v=zMF4CD7i3hg" target="_blank" rel="noopener">Harvard: Shoot-n-Drop</a></td><td>S4 independence of motions</td></tr>` }),
      el('p.small.muted.mt.mb0', null, 'PhET Interactive Simulations, University of Colorado Boulder (CC-BY 4.0).'),
      el('div.btn-row.mt', null,
        el('button.btn.btn--sm.btn--ghost', {
          type: 'button',
          onClick: () => UI.modal('Reset progress?', 'This clears your XP, stars and badges on this device. It cannot be undone.', [
            { label: 'Reset everything', primary: true, onClick: () => { Game.reset(); Game.go('title'); } },
            { label: 'Keep my progress' }
          ])
        }, 'Reset progress')
      )
    ));
  });

  /* ------------------------------ zone dispatch -------------------------- */

  Game.route('zone', (root, params) => {
    const mod = byId(params.id);
    if (!mod) { Game.go('map'); return; }
    if (!Game.isUnlocked(mod.META, ALL)) { UI.toast('Clear the zone before it first.'); Game.go('map'); return; }
    Promise.resolve(mod.render(root)).catch(err => {
      console.error(err);
      UI.toast('Something went wrong in that zone — back to the map.');
      Game.go('map');
    });
  });

  /* ------------------------------ boot ----------------------------------- */

  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) Game.go(nav.getAttribute('data-nav'));
  });

  Game.load();
  Game.go(Game.save.xp > 0 ? 'map' : 'title');
})();
