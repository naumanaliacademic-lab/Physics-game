/* ==========================================================================
   zone3.js — S3 Equations of motion: "Reactor Core"
   Task 1  Equation select — list s,u,v,a,t; the quantity you neither have nor
           want tells you which of the four booklet equations to fire.
   Task 2  Capsule catch  — free fall with a sign convention, under a clock.
   Task 3  Flight check.
   ========================================================================== */

const Zone3 = (() => {
  'use strict';
  const el = UI.el;
  const ACCENT = '#ffc24a';
  const G = Physics.G;

  const META = {
    id: 'z3',
    tag: 'Zone 3 · S3',
    name: 'Reactor Core',
    subtitle: 'The four equations of motion, sign conventions and free fall',
    accent: ACCENT,
    steps: 3,
    praise: 'Core stable. You pick the right equation before you touch the calculator.',
    revise: 'Re-read S3 steps 4–6: list s, u, v, a, t, find the quantity that is missing, and pick the equation without it.',
    recap: [
      'The equations apply to <strong>uniform acceleration</strong> along a straight line only.',
      'Missing t → v² = u² + 2as.  Missing s → v = u + at.  Missing v → s = ut + ½at².  Missing a → s = ((u+v)/2)t.',
      'State a positive direction and keep it: with up positive, a = −9.81 m s⁻² for the whole flight.',
      'At the highest point v = 0 but a is still g downwards.'
    ]
  };

  /* The four equations exactly as the data booklet prints them (page 6). */
  const EQUATIONS = [
    { id: 'noA', text: 's = ((u + v)/2) t', missing: 'a' },
    { id: 'noS', text: 'v = u + at',        missing: 's' },
    { id: 'noV', text: 's = ut + ½at²',     missing: 'v' },
    { id: 'noT', text: 'v² = u² + 2as',     missing: 't' }
  ];

  const SYMBOL = {
    s: { name: 'displacement', unit: 'm' },
    u: { name: 'initial velocity', unit: 'm s⁻¹' },
    v: { name: 'final velocity', unit: 'm s⁻¹' },
    a: { name: 'acceleration', unit: 'm s⁻²' },
    t: { name: 'time', unit: 's' }
  };

  const SCENARIOS = [
    { text: 'A rescue shuttle accelerates uniformly along a straight launch rail.', sign: 'Forward is positive.' },
    { text: 'A supply pod fires its retro-thrusters and slows uniformly on a straight approach.', sign: 'Direction of travel is positive.', braking: true },
    { text: 'A maglev sled accelerates uniformly down a straight track.', sign: 'Forward is positive.' },
    { text: 'A survey rover brakes uniformly to a stop on a straight run.', sign: 'Direction of travel is positive.', braking: true }
  ];

  /** Build a fully consistent s, u, v, a, t set, then hide one and ask for another. */
  function makeProblem() {
    for (let attempt = 0; attempt < 80; attempt++) {
      const scenario = Questions.pick(SCENARIOS);
      const t = 2 + Math.floor(Math.random() * 9);                        // 2–10 s
      let u, a;
      if (scenario.braking) {
        u = 8 + Math.floor(Math.random() * 20);                           // 8–27
        a = -(u / t) * (Math.random() < 0.5 ? 1 : 0.6);                   // stops, or slows a lot
      } else {
        u = Math.random() < 0.4 ? 0 : 2 + Math.floor(Math.random() * 12);
        a = 0.5 + Math.floor(Math.random() * 8) * 0.5;                    // 0.5–4.0
      }
      a = Math.round(a * 4) / 4;
      const v = Physics.suvat.vFromUAt(u, a, t);
      const s = Physics.suvat.sFromUAt(u, a, t);
      if (v < 0 || s <= 1) continue;                                      // keep it physical and readable

      // Hide one quantity; ask for another; the other three are given.
      const order = ['s', 'v', 'a', 't'];
      const missing = Questions.pick(order);
      const target = Questions.pick(order.filter(k => k !== missing));
      const values = { s, u, v, a, t };
      const given = ['u', ...order.filter(k => k !== missing && k !== target)];
      if (given.some(k => !isFinite(values[k]))) continue;

      return { scenario, values, missing, target, given, equation: EQUATIONS.find(e => e.missing === missing) };
    }
    // Deterministic fallback: the specimen-paper car from slide 81.
    return {
      scenario: { text: 'A car decelerates uniformly until it stops.', sign: 'Direction of travel is positive.' },
      values: { s: 32, u: 16, v: 0, a: -4, t: 4 },
      missing: 't', target: 's', given: ['u', 'v', 'a'],
      equation: EQUATIONS.find(e => e.missing === 't')
    };
  }

  function dataTable(problem) {
    const rows = ['s', 'u', 'v', 'a', 't'].map(k => {
      const known = problem.given.includes(k);
      const wanted = k === problem.target;
      const value = known ? `${Physics.sig(problem.values[k], 3)} ${SYMBOL[k].unit}` : (wanted ? '= ?' : 'not given');
      const style = wanted ? 'color:#ffc24a;font-weight:700' : (known ? '' : 'color:#5f7190');
      return `<tr><td class="num" style="${style}">${k}</td><td style="${style}">${SYMBOL[k].name}</td><td class="num" style="${style}">${value}</td></tr>`;
    }).join('');
    return el('table.data', { html: `<tr><th>Symbol</th><th>Quantity</th><th>Value</th></tr>${rows}` });
  }

  /* ------------------------------ task 1 --------------------------------- */

  function equationSelect(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(0, 3);
      run.brief('Task 1 — <strong>Equation select.</strong> Three of the five quantities are on the console and one is wanted. The fifth — the one you neither have nor want — tells you which equation to fire.');

      const ROUNDS = 3;
      let round = 0, marks = 0;
      const MAX = ROUNDS * 2;

      function nextRound() {
        if (round >= ROUNDS) { run.award(marks, MAX); resolve(); return; }
        const p = makeProblem();
        run.clear();

        run.stage.append(el('div.panel', null,
          el('div.eyebrow', null, `Core cycle ${round + 1} of ${ROUNDS}`),
          el('p', { html: `<strong>${p.scenario.text}</strong> ${p.scenario.sign}` }),
          dataTable(p),
          el('p.small.muted.mt.mb0', { html: `Find the <strong>${SYMBOL[p.target].name}</strong>. Notice which row says <em>not given</em>.` })
        ));

        const slot = el('div');
        run.side.append(el('div.panel', null, el('div.eyebrow', null, 'Step 1 — choose the equation'), slot));

        const options = EQUATIONS.map(eq => ({
          text: `<code>${eq.text}</code>`,
          why: `This one contains <strong>${eq.missing}</strong>, which is not given here.`
        }));
        const answerIndex = EQUATIONS.findIndex(e => e.id === p.equation.id);
        options[answerIndex].why = undefined;

        UI.ask(slot, {
          type: 'mcq',
          badge: 'chooser',
          stem: `Which equation gets you to <strong>${p.target}</strong> in one step?`,
          options,
          answer: answerIndex,
          work: `${p.missing} is the quantity you neither have nor want, so choose the equation without ${p.missing}:\n${p.equation.text}`
        }, ({ correct }) => {
          if (correct) { marks++; Game.addXp(30); }
          askValue(p);
        });
      }

      function askValue(p) {
        const slot = el('div');
        run.side.append(el('div.panel', null, el('div.eyebrow', null, 'Step 2 — get the number'), slot));
        const answer = p.values[p.target];
        UI.ask(slot, {
          type: 'num',
          stem: `Now calculate <strong>${p.target}</strong>, the ${SYMBOL[p.target].name}.`,
          answer, unit: SYMBOL[p.target].unit, tol: 0.03, absTol: 0.02,
          hint: `Substitute into ${p.equation.text} — signs included.`,
          work: workingFor(p)
        }, ({ correct }) => {
          if (correct) { marks++; Game.addXp(35); }
          round++;
          setTimeout(nextRound, 250);
        });
      }

      function workingFor(p) {
        const V = p.values;
        const n = k => Physics.sig(V[k], 3);
        const lines = [`Using ${p.equation.text}:`];
        switch (p.equation.id) {
          case 'noT': lines.push(`${n('v')}² = ${n('u')}² + 2(${n('a')})(${n('s')})`); break;
          case 'noS': lines.push(`${n('v')} = ${n('u')} + (${n('a')})(${n('t')})`); break;
          case 'noV': lines.push(`${n('s')} = (${n('u')})(${n('t')}) + ½(${n('a')})(${n('t')})²`); break;
          case 'noA': lines.push(`${n('s')} = ((${n('u')} + ${n('v')})/2)(${n('t')})`); break;
        }
        lines.push(`→ ${p.target} = ${Physics.sig(V[p.target], 3)} ${SYMBOL[p.target].unit}`);
        return lines.join('\n');
      }

      nextRound();
    });
  }

  /* ------------------------------ task 2: capsule catch ------------------ */

  /**
   * A supply capsule is launched straight up from a platform.  The cadet must
   * work out WHEN it will pass a catch net on the way down, then arm the net.
   * Up is positive; a = −g for the whole flight, including at the top.
   */
  function capsuleCatch(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(1, 3);
      run.brief('Task 2 — <strong>Capsule catch.</strong> Take <strong>up as positive</strong>, so a = −9.81 m s⁻² for the whole flight. Work out the answer on paper, arm the net, and watch the capsule prove you right.');

      const ROUNDS = 3;
      let round = 0, marks = 0;

      function makeDrop() {
        const u = 12 + Math.floor(Math.random() * 14);        // 12–25 m s⁻¹ up
        const launchHeight = 0;
        const apex = (u * u) / (2 * G);
        // Net somewhere between a third and three-quarters of the way up.
        const netHeight = Math.round((apex * (0.35 + Math.random() * 0.4)) * 2) / 2;
        // Times when the capsule is at netHeight: up first, then down.
        const disc = Math.sqrt(u * u - 2 * G * netHeight);
        const tUp = (u - disc) / G;
        const tDown = (u + disc) / G;
        return { u, launchHeight, apex, netHeight, tUp, tDown, tApex: u / G, total: (2 * u) / G };
      }

      function nextRound() {
        if (round >= ROUNDS) { run.award(marks, ROUNDS * 2); resolve(); return; }
        const D = makeDrop();
        run.clear();

        const { cnv, ctx, w, h } = UI.canvas(400, 420);
        run.stage.append(el('div.canvas-wrap', null, cnv));
        const readouts = UI.readout({
          t: { label: 'clock' }, y: { label: 'height' }, v: { label: 'velocity' }, a: { label: 'acceleration', value: '−9.81 m s⁻²' }
        });
        run.stage.append(readouts.wrap);

        let simT = 0, running = false, armedAt = null, caught = false;
        const topOfScale = D.apex * 1.18;

        function draw() {
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = '#050a12'; ctx.fillRect(0, 0, w, h);
          const groundY = h - 40;
          const Y = metres => groundY - (metres / topOfScale) * (groundY - 30);

          // Platform and height scale
          ctx.strokeStyle = '#24344f'; ctx.lineWidth = 1;
          ctx.fillStyle = '#5f7190'; ctx.font = '11px ui-monospace, monospace';
          for (let m = 0; m <= topOfScale; m += 5) {
            ctx.beginPath(); ctx.moveTo(52, Y(m)); ctx.lineTo(w - 14, Y(m)); ctx.stroke();
            ctx.fillText(`${m} m`, 10, Y(m) + 4);
          }
          ctx.fillStyle = '#16233b';
          ctx.fillRect(52, groundY, w - 66, 40);

          // Catch net
          ctx.strokeStyle = armedAt !== null ? '#5ce08a' : ACCENT;
          ctx.lineWidth = 3;
          ctx.setLineDash(armedAt !== null ? [] : [6, 5]);
          ctx.beginPath(); ctx.moveTo(w / 2 - 44, Y(D.netHeight)); ctx.lineTo(w / 2 + 44, Y(D.netHeight)); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = armedAt !== null ? '#5ce08a' : ACCENT;
          ctx.font = '700 11px ui-monospace, monospace';
          ctx.fillText(`NET  ${D.netHeight} m`, w / 2 + 50, Y(D.netHeight) + 4);

          // Capsule
          const y = D.u * simT - 0.5 * G * simT * simT;
          const v = D.u - G * simT;
          const cy = Y(Math.max(0, y));
          ctx.fillStyle = caught ? '#5ce08a' : '#e8eef8';
          ctx.beginPath(); ctx.arc(w / 2, cy, 9, 0, Math.PI * 2); ctx.fill();
          // Velocity arrow: shows v reversing while a never does.
          if (running && !caught) {
            ctx.strokeStyle = '#2fd6c3'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(w / 2, cy); ctx.lineTo(w / 2, cy - v * 2.2); ctx.stroke();
          }

          readouts.set('t', `${Physics.fix(simT, 2)} s`);
          readouts.set('y', `${Physics.fix(Math.max(0, y), 1)} m`);
          readouts.set('v', `${Physics.fix(v, 1)} m s⁻¹`);
        }

        draw();

        const qPanel = el('div.panel');
        run.side.append(qPanel);

        // Step 1: the apex — the classic "v = 0 but a = g" check.
        const apexSlot = el('div');
        qPanel.append(el('div.eyebrow', null, `Catch ${round + 1} of ${ROUNDS} — step 1`), apexSlot);
        UI.ask(apexSlot, {
          type: 'num',
          badge: 'topofflight',
          stem: `The capsule leaves the platform at <strong>${D.u} m s⁻¹ upwards</strong>. Calculate its <strong>maximum height</strong> above the platform.`,
          answer: D.apex, unit: 'm', tol: 0.03,
          hint: 'At the top v = 0. No time is given, so which equation has no t?',
          work: `v² = u² + 2as with v = 0, a = −9.81:\n0 = ${D.u}² + 2(−9.81)s\ns = ${D.u * D.u} / 19.62 = ${Physics.sig(D.apex, 3)} m\nAt that instant v = 0 but a is still 9.81 m s⁻² downwards.`
        }, ({ correct }) => {
          if (correct) { marks++; Game.addXp(35); }
          askNetTime();
        });

        function askNetTime() {
          const slot = el('div');
          qPanel.append(el('div.eyebrow.mt', null, 'Step 2 — arm the net'), slot);
          UI.ask(slot, {
            type: 'num',
            stem: `The net sits at <strong>${D.netHeight} m</strong>. At what time after launch does the capsule pass it <strong>on the way down</strong>?`,
            answer: D.tDown, unit: 's', tol: 0.03, absTol: 0.03,
            hint: 'Use s = ut + ½at² with s = the net height. Two roots: the larger one is the way down.',
            work: `${D.netHeight} = ${D.u}t − 4.905t²\n4.905t² − ${D.u}t + ${D.netHeight} = 0\nt = ${Physics.sig(D.tUp, 3)} s (going up) or t = ${Physics.sig(D.tDown, 3)} s (coming down)\nThe net is armed for the larger root.`
          }, ({ correct }) => {
            if (correct) { marks++; Game.addXp(45); }
            armedAt = D.tDown;
            runCatch();
          });
        }

        function runCatch() {
          running = true;
          const btn = el('button.btn.btn--primary.btn--wide.mt', { type: 'button', disabled: true }, 'Launching…');
          qPanel.append(btn);
          const anim = Zone.loop(dt => {
            simT += dt * 0.9;
            const y = D.u * simT - 0.5 * G * simT * simT;
            if (armedAt !== null && simT >= armedAt && !caught) {
              caught = true;
              simT = armedAt;
              anim.stop();
              draw();
              btn.disabled = false;
              btn.textContent = round < ROUNDS - 1 ? 'Next catch ▶' : 'Finish task ▶';
              btn.onclick = () => { round++; nextRound(); };
              UI.toast('Capsule caught ✓', 1800);
              return;
            }
            if (y < 0) { anim.stop(); }
            draw();
          });
        }
      }

      nextRound();
    });
  }

  /* ------------------------------ zone entry ----------------------------- */

  async function render(root) {
    const run = Shell.zone(root, META);
    await equationSelect(run);
    await capsuleCatch(run);

    run.clear();
    run.setStep(2, 3);
    run.brief('Task 3 — <strong>Flight check.</strong>');
    run.stage.append(el('div.panel', null,
      el('div.eyebrow', null, 'Data booklet, page 6'),
      el('table.data', { html: `
        <tr><th>Equation</th><th>Leaves out</th></tr>
        <tr><td class="num">s = ((u + v)/2) t</td><td class="num">a</td></tr>
        <tr><td class="num">v = u + at</td><td class="num">s</td></tr>
        <tr><td class="num">s = ut + ½at²</td><td class="num">v</td></tr>
        <tr><td class="num">v² = u² + 2as</td><td class="num">t</td></tr>` }),
      el('p.small.muted.mt.mb0', { html: 'The booklet gives magnitudes only — <strong>you</strong> supply the signs.' })
    ));

    const qs = Questions.sample(Questions.banks.s3, 4);
    const correct = await Shell.askAll(run.side, qs, { title: 'Licence check', xp: 30 });
    run.award(correct, qs.length);
    run.setStep(3, 3);
    await run.finish();
  }

  return { META, render };
})();
