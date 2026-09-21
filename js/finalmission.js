/* ==========================================================================
   finalmission.js — "Mission Alpha", the whole-topic run.
   The five hinge questions from the teaching deck, plus a sample from every
   subtopic.  Three hull breaches and the run ends — so it rewards the cadet
   who has actually retired the misconceptions, not one who guesses.
   ========================================================================== */

const FinalMission = (() => {
  'use strict';
  const el = UI.el;
  const ACCENT = '#a98bff';

  const META = {
    id: 'final',
    tag: 'Mission Alpha',
    name: 'The Big Question',
    subtitle: 'How can we predict where a moving object will be, and when?',
    accent: ACCENT,
    steps: 1,
    requires: ['z1', 'z2', 'z3', 'z4', 'z5']
  };

  const HULL = 3;

  function buildPaper() {
    // The five hinge questions always appear — they are the checkpoints the
    // teaching deck says to clear before moving on.
    const paper = Questions.hinges();
    ['s1', 's2', 's3', 's4', 's5'].forEach(key => {
      const rest = Questions.banks[key].filter(q => q.tag !== 'HINGE');
      paper.push(...Questions.sample(rest, 1));
    });
    return Questions.sample(paper, paper.length);   // shuffle
  }

  function render(root) {
    const run = Shell.zone(root, META);
    const paper = buildPaper();
    let i = 0, correct = 0, hull = HULL;

    run.brief('Every subtopic, one paper. Three hull breaches and the mission ends — so take the time to reason, not to guess.');

    const hullChips = el('div.chips');
    const slot = el('div');
    const summary = el('div.panel', null,
      el('div.eyebrow', null, 'Topic summary'),
      el('ul.tight', { html: `
        <li><strong>Describe</strong> — displacement, velocity and acceleration are vectors; gradients and areas read the graphs.</li>
        <li><strong>Predict</strong> — uniform acceleration only: the four equations, with a stated sign convention.</li>
        <li><strong>Two dimensions</strong> — apply them separately to the components, linked by the time.</li>
        <li><strong>Limits</strong> — with fluid resistance the simple model overestimates height, range and time.</li>` })
    );
    run.stage.append(summary);
    run.side.append(el('div.panel', null, el('div.eyebrow', null, 'Paper'), hullChips, slot));

    function drawHull() {
      hullChips.innerHTML = '';
      hullChips.append(
        el('span.chip.chip--on', null, `Q ${Math.min(i + 1, paper.length)} of ${paper.length}`),
        el('span.chip' + (hull > 1 ? '.chip--gold' : ''), null, `hull ${'▮'.repeat(hull)}${'▯'.repeat(HULL - hull)}`),
        el('span.chip', null, `${correct} correct`)
      );
    }

    function next() {
      drawHull();
      if (hull <= 0 || i >= paper.length) { finish(); return; }
      UI.ask(slot, paper[i], ({ correct: ok }) => {
        if (ok) { correct++; Game.addXp(50); } else { hull--; }
        i++;
        next();
      });
    }

    function finish() {
      const answered = i;
      const stars = Shell.starsFor(correct, paper.length);
      run.award(correct, paper.length);
      const passed = correct >= 8 && hull > 0;
      if (passed) Game.awardBadge('commander');

      const body = el('div');
      body.append(el('div.stars-big', null, UI.stars(stars, 5)));
      body.append(el('p.center', { html: hull > 0
        ? `<strong>${correct} of ${paper.length}</strong> correct.`
        : `Hull breached after ${answered} questions — <strong>${correct}</strong> correct.` }));
      body.append(el('p', { html: passed
        ? 'Mission Alpha cleared. You can describe motion, predict it, extend it to two dimensions, and say exactly where the simple model stops being true.'
        : 'Not cleared this time. Go back to the zone whose ideas cost you the hull — the debrief lists what to re-read.' }));

      const missed = paper.slice(0, answered).filter((q, k) => q.tag === 'HINGE');
      if (missed.length) {
        body.append(el('p.small.muted', { html: 'The hinge questions in this paper are the five checkpoints from the teaching deck. If any of them caught you, that subtopic is where to go next.' }));
      }

      UI.modal(passed ? '🎖️ Mission Alpha cleared' : 'Mission Alpha', body, [
        { label: 'Back to map', primary: true, onClick: () => Game.go('map') },
        { label: 'Run it again', onClick: () => Game.go('zone', { id: 'final' }) }
      ]);
      Game.finishZone('final', { stars, score: correct });
    }

    next();
  }

  return { META, render };
})();
