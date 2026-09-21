/* ==========================================================================
   shell.js — the frame every zone runs inside: header, brief, step counter,
   score, and the end-of-zone debrief.  Zones are written as async functions
   that await one step at a time.
   ========================================================================== */

const Shell = (() => {
  'use strict';
  const el = UI.el;

  /** 0–5 stars from a fraction of the available marks. */
  function starsFor(score, max) {
    if (max <= 0) return 0;
    const pct = score / max;
    if (pct >= 0.95) return 5;
    if (pct >= 0.85) return 4;
    if (pct >= 0.70) return 3;
    if (pct >= 0.55) return 2;
    if (pct > 0)     return 1;
    return 0;
  }

  /**
   * Build the zone frame.  Returns a runner:
   *   run.brief(html)        — mission text under the title
   *   run.stage              — the element a step draws into
   *   run.side               — the right-hand column (controls, questions)
   *   run.setStep(i, n)      — progress dots
   *   run.award(points, max) — record marks as they are earned
   *   run.finish()           — show the debrief and save
   */
  function zone(root, meta) {
    const state = { score: 0, max: 0, step: 0, steps: meta.steps || 1 };

    const stepWrap = el('div');
    const head = el('div.panel', { style: { borderLeft: `4px solid ${meta.accent}` } },
      el('div.spread', null,
        el('div', null,
          el('div.eyebrow', { style: { color: meta.accent } }, meta.tag),
          el('h1', { style: { fontSize: '1.6rem', marginBottom: '2px' } }, meta.name),
          el('p.small.muted.mb0', null, meta.subtitle)
        ),
        stepWrap
      ),
      el('div', { id: 'zoneBrief' })
    );

    const stage = el('div');
    const side = el('div');
    const layout = el('div.stage', null, stage, side);

    root.append(head, layout);

    const scoreCell = el('span.chip.chip--gold', null, '0 marks');
    const setStep = (i, n) => {
      state.step = i; state.steps = n;
      stepWrap.innerHTML = '';
      stepWrap.append(el('div.row', null,
        el('span.small.muted', null, `Task ${Math.min(i + 1, n)} of ${n}`),
        UI.dots(n, k => (k < i ? 'done' : k === i ? 'now' : '')),
        scoreCell
      ));
    };
    setStep(0, state.steps);

    const run = {
      stage, side, meta, state,
      brief(html) {
        const node = UI.$('#zoneBrief', head);
        node.innerHTML = '';
        node.append(el('p.small.muted.mt.mb0', { html }));
      },
      setStep,
      award(points, max) {
        state.score += points;
        state.max += max;
        scoreCell.textContent = `${state.score} / ${state.max} marks`;
      },
      /** Replace the stage and side content for a new task. */
      clear() { stage.innerHTML = ''; side.innerHTML = ''; },
      finish() { return debrief(run); }
    };
    return run;
  }

  /** Ask a list of questions in the given container; resolves with marks won. */
  function askAll(container, questions, opts) {
    const options = opts || {};
    return new Promise(resolve => {
      let i = 0, correct = 0;
      const slot = el('div');
      const head = el('div.spread.mb0', null,
        el('div.eyebrow', null, options.title || 'Flight check'),
        UI.dots(questions.length, () => '')
      );
      container.append(el('div.panel', null, head, slot));

      const redraw = () => {
        head.lastChild.replaceWith(UI.dots(questions.length, k =>
          k < i ? (marks[k] ? 'done' : 'miss') : k === i ? 'now' : ''));
      };
      const marks = [];

      const next = () => {
        if (i >= questions.length) { resolve(correct); return; }
        redraw();
        const q = questions[i];
        UI.ask(slot, q, ({ correct: ok }) => {
          marks[i] = ok;
          if (ok) { correct++; Game.addXp(options.xp || 25); }
          i++;
          if (options.onAnswer) options.onAnswer(ok, i, questions.length);
          next();
        });
      };
      next();
    });
  }

  /** End-of-zone screen: stars, marks, XP bonus and what to revise. */
  function debrief(run) {
    return new Promise(resolve => {
      const { score, max } = run.state;
      const stars = starsFor(score, max);
      const prev = Game.zoneState(run.meta.id);
      const improved = stars > prev.stars;
      const bonus = stars * 40;
      Game.addXp(bonus);
      Game.finishZone(run.meta.id, { stars, score });

      const body = el('div');
      body.append(el('div.stars-big', null, UI.stars(stars, 5)));
      body.append(el('p.center', null,
        `${score} of ${max} marks  ·  +${bonus} XP bonus`,
        improved && prev.stars > 0 ? el('span', null, ' · new best!') : null
      ));

      if (stars >= 4) {
        body.append(el('p', { html: run.meta.praise || 'Zone secured. The next mission is open.' }));
      } else {
        body.append(el('p', { html: `<strong>Worth another run.</strong> ${run.meta.revise || ''}` }));
      }

      if (run.meta.recap) {
        const list = el('ul.tight');
        run.meta.recap.forEach(line => list.append(el('li', { html: line })));
        body.append(el('h3.mt', null, 'Remember'), list);
      }

      UI.modal('Mission debrief', body, [
        { label: 'Back to map', primary: true, onClick: () => { Game.go('map'); resolve(stars); } },
        { label: 'Run it again', onClick: () => { Game.go('zone', { id: run.meta.id }); resolve(stars); } }
      ]);
    });
  }

  return { zone, askAll, starsFor, debrief };
})();
