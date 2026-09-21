/* ==========================================================================
   zone5.js — S5 Fluid resistance: "Drop Zone"
   Task 1  Skydive   — a real quadratic-drag integration. Reach terminal speed,
           then deploy: the v–t trace the cadet draws by falling IS the graph
           from the deck's worked example (points A to E).
   Task 2  Air on/off — the same launch in a vacuum and in air, then the
           six-effects table from the deck.
   Task 3  Flight check.
   ========================================================================== */

const Zone5 = (() => {
  'use strict';
  const el = UI.el;
  const ACCENT = '#ff6b81';
  const G = Physics.G;

  const META = {
    id: 'z5',
    tag: 'Zone 5 · S5',
    name: 'Drop Zone',
    subtitle: 'Fluid resistance: terminal speed and what drag does to a projectile',
    accent: ACCENT,
    steps: 3,
    praise: 'Safe landings all round. You can argue about forces, not just numbers.',
    revise: 'Re-read S5 steps 1–7: drag opposes velocity and grows with speed, terminal speed is where drag = weight, and the equations of motion no longer apply.',
    recap: [
      'Drag opposes the velocity and grows with speed. At release v = 0, so drag = 0 and a = g.',
      'Terminal speed: drag = weight, resultant force = 0, a = 0 — but both forces still act.',
      'Just after the parachute opens the acceleration is <strong>upwards</strong> while she still moves down.',
      'With drag: lower peak, shorter range, shorter time of flight, lower landing speed, asymmetric path.'
    ]
  };

  /* ------------------------------ task 1: the skydive -------------------- */

  const JUMP = {
    startHeight: 3000,      // m, a realistic exit altitude
    freeFallTerminal: 55,   // m s⁻¹, belly-to-earth
    chuteTerminal: 5.5,     // m s⁻¹, canopy open
    safeLanding: 7.0,       // m s⁻¹
    timeScale: 3,           // simulated seconds per real second while falling
    fastScale: 60           // once the canopy transient is over, skip the drift
  };

  function skydive(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(0, 3);
      run.brief('Task 1 — <strong>The jump.</strong> Fall until the acceleration reading drops to <strong>zero</strong> — that is terminal speed, where drag has grown to balance weight. Then deploy, and land at no more than 7 m s⁻¹.');

      const sceneC = UI.canvas(240, 400);
      const graphC = UI.canvas(300, 400);
      run.stage.append(el('div.row', { style: { gap: '10px', alignItems: 'stretch' } },
        el('div.canvas-wrap', { style: { flex: '0 0 auto' } }, sceneC.cnv),
        el('div.canvas-wrap', { style: { flex: '1 1 220px' } }, graphC.cnv)
      ));
      const readouts = UI.readout({
        t: { label: 'time' }, y: { label: 'altitude' }, v: { label: 'speed' }, a: { label: 'acceleration' }
      });
      run.stage.append(readouts.wrap);

      const panel = el('div.panel');
      run.side.append(panel);

      const state = {
        y: JUMP.startHeight, v: 0, t: 0,
        deployed: false, deployT: null, deployV: null, landed: false,
        reachedTerminal: false, maxSpeed: 0,
        trace: []
      };

      let c = Physics.dragCoefficient(JUMP.freeFallTerminal);

      const deployBtn = el('button.btn.btn--gold.btn--wide', { type: 'button', onClick: deploy }, '🪂 Deploy parachute');
      const status = el('div.chips');
      panel.append(
        el('div.eyebrow', null, 'Jump console'),
        el('p.small', { html: `Exit altitude <strong>${JUMP.startHeight} m</strong>. Free-fall terminal speed for this suit is about <strong>${JUMP.freeFallTerminal} m s⁻¹</strong>; under canopy it is about <strong>${JUMP.chuteTerminal} m s⁻¹</strong>. Land at <strong>≤ ${JUMP.safeLanding} m s⁻¹</strong>.` }),
        status,
        deployBtn,
        el('p.small.muted.mt.mb0', { html: 'Watch the acceleration reading, not the clock: it starts at 9.81 m s⁻² and falls towards zero as drag builds.' })
      );

      function deploy() {
        if (state.deployed || state.landed) return;
        state.deployed = true;
        state.deployT = state.t;
        state.deployV = Math.abs(state.v);
        c = Physics.dragCoefficient(JUMP.chuteTerminal);
        deployBtn.disabled = true;
        deployBtn.textContent = '🪂 Canopy open';
      }

      function chips() {
        status.innerHTML = '';
        status.append(
          el('span.chip' + (state.reachedTerminal ? '.chip--on' : ''), null,
            state.reachedTerminal ? 'terminal speed reached ✓' : 'terminal speed not yet reached'),
          el('span.chip' + (state.deployed ? '.chip--gold' : ''), null,
            state.deployed ? `deployed at ${Physics.fix(state.deployT, 1)} s` : 'canopy stowed')
        );
      }

      function drawScene() {
        const { ctx, w, h } = sceneC;
        ctx.clearRect(0, 0, w, h);
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#0d1c33');
        sky.addColorStop(1, '#050a12');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

        const groundY = h - 26;
        const Y = m => groundY - (m / JUMP.startHeight) * (groundY - 24);

        ctx.fillStyle = '#16233b';
        ctx.fillRect(0, groundY, w, 26);
        ctx.strokeStyle = 'rgba(36,52,79,.9)';
        ctx.fillStyle = '#5f7190';
        ctx.font = '10px ui-monospace, monospace';
        for (let m = 0; m <= JUMP.startHeight; m += 500) {
          ctx.beginPath(); ctx.moveTo(40, Y(m)); ctx.lineTo(w, Y(m)); ctx.stroke();
          ctx.fillText(`${m}`, 6, Y(m) + 4);
        }

        const py = Y(Math.max(0, state.y));
        const px = w / 2 + 14;
        // Canopy
        if (state.deployed) {
          ctx.strokeStyle = '#ffc24a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py - 22, 17, Math.PI, 0); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px - 17, py - 22); ctx.lineTo(px, py - 6);
          ctx.lineTo(px + 17, py - 22); ctx.stroke();
        }
        // Jumper
        ctx.fillStyle = state.landed ? '#5ce08a' : '#e8eef8';
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();

        // Force arrows: weight always, drag growing with speed.
        const speed = Math.abs(state.v);
        const terminal = state.deployed ? JUMP.chuteTerminal : JUMP.freeFallTerminal;
        const dragLen = 46 * Math.min(1.4, (speed * speed) / (terminal * terminal));
        forceArrow(ctx, px + 34, py, 46, '#ff6b81', 'W');
        if (dragLen > 2) forceArrow(ctx, px + 34, py, -dragLen, '#2fd6c3', 'drag');
      }

      function forceArrow(ctx, x, y, len, colour, label) {
        // len > 0 points down (weight), len < 0 points up (drag)
        ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
        const s = Math.sign(len);
        ctx.beginPath();
        ctx.moveTo(x, y + len);
        ctx.lineTo(x - 6, y + len - s * 9);
        ctx.lineTo(x + 6, y + len - s * 9);
        ctx.fill();
        ctx.font = '700 10px ui-monospace, monospace';
        ctx.fillText(label, x + 8, y + len / 2);
      }

      function drawGraph() {
        const { ctx, w, h } = graphC;
        const pts = state.trace.map(p => ({ t: p.t, v: p.speed }));
        if (pts.length < 2) {
          ctx.fillStyle = '#050a12'; ctx.fillRect(0, 0, w, h);
          return;
        }
        const tMax = Math.max(20, Math.ceil(pts[pts.length - 1].t / 10) * 10);
        Zone2.drawVT(ctx, w, h, pts, {
          tMax, vMin: 0, vMax: JUMP.freeFallTerminal * 1.15, colour: '#2fd6c3', shade: false
        });
        // Terminal-speed guide lines make "a = 0" visible as a flat trace.
        const pad = { l: 52, r: 16, t: 22, b: 36 };
        const Y = v => h - pad.b - (v / (JUMP.freeFallTerminal * 1.15)) * (h - pad.t - pad.b);
        ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,194,74,.7)';
        ctx.beginPath(); ctx.moveTo(pad.l, Y(JUMP.freeFallTerminal)); ctx.lineTo(w - pad.r, Y(JUMP.freeFallTerminal)); ctx.stroke();
        ctx.strokeStyle = 'rgba(92,224,138,.7)';
        ctx.beginPath(); ctx.moveTo(pad.l, Y(JUMP.chuteTerminal)); ctx.lineTo(w - pad.r, Y(JUMP.chuteTerminal)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffc24a'; ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('free-fall terminal', pad.l + 4, Y(JUMP.freeFallTerminal) - 5);
        ctx.fillStyle = '#5ce08a';
        ctx.fillText('canopy terminal', pad.l + 4, Y(JUMP.chuteTerminal) - 5);
      }

      const anim = Zone.loop(dt => {
        if (!state.landed) {
          // Watch the canopy transient at normal pace, then fast-forward the drift.
          const settled = state.deployed && (state.t - state.deployT) > 5;
          const simStep = Math.min(dt, 0.05) * (settled ? JUMP.fastScale : JUMP.timeScale);
          const sub = Math.max(1, Math.ceil(simStep / 0.01));
          for (let i = 0; i < sub; i++) {
            const next = Physics.stepDrag({ x: 0, y: state.y, vx: 0, vy: state.v }, simStep / sub, c);
            state.y = next.y; state.v = next.vy;
            state.t += simStep / sub;
            if (state.y <= 0) { state.y = 0; state.landed = true; break; }
          }
          const speed = Math.abs(state.v);
          state.maxSpeed = Math.max(state.maxSpeed, speed);
          if (!state.deployed && speed >= JUMP.freeFallTerminal * 0.99) state.reachedTerminal = true;
          if (state.trace.length === 0 || state.t - state.trace[state.trace.length - 1].t > 0.15) {
            state.trace.push({ t: state.t, speed, a: Math.abs(Physics.accelWithDrag(0, state.v, c).ay) });
          }
        }

        const a = Physics.accelWithDrag(0, state.v, c).ay;
        readouts.set('t', `${Physics.fix(state.t, 1)} s`);
        readouts.set('y', `${Physics.fix(Math.max(0, state.y), 0)} m`);
        readouts.set('v', `${Physics.fix(Math.abs(state.v), 1)} m s⁻¹`);
        readouts.set('a', `${Physics.fix(Math.abs(a), 2)} m s⁻²`);
        chips();
        drawScene();
        drawGraph();

        if (state.landed) { anim.stop(); deployBtn.disabled = true; finishJump(); }
      });

      function finishJump() {
        const landingSpeed = Math.abs(state.v);
        const safe = landingSpeed <= JUMP.safeLanding;
        let marks = 0;
        if (safe) marks++;
        if (state.reachedTerminal) marks++;
        if (safe) { Game.addXp(90); Game.awardBadge('terminal'); }

        const body = el('div');
        body.append(el('p', { html: safe
          ? `Landed at <strong>${Physics.fix(landingSpeed, 1)} m s⁻¹</strong> — a safe landing.`
          : `Landed at <strong>${Physics.fix(landingSpeed, 1)} m s⁻¹</strong>. That is above the ${JUMP.safeLanding} m s⁻¹ limit${state.deployed ? ' — the canopy opened too late to reach its terminal speed.' : ' — the canopy never opened.'}` }));
        if (!state.reachedTerminal) {
          body.append(el('p.small.muted', { html: 'You deployed before the acceleration reading reached zero, so you never actually reached free-fall terminal speed. Try holding the fall until a = 0.' }));
        }
        body.append(el('p.small.muted', { html: `Peak speed <strong>${Physics.fix(state.maxSpeed, 1)} m s⁻¹</strong>${state.deployed ? `, canopy opened at <strong>${Physics.fix(state.deployT, 1)} s</strong> while falling at ${Physics.fix(state.deployV, 1)} m s⁻¹` : ''}. At terminal speed, weight and drag are equal and opposite: the resultant force is zero, so a = 0 — but both forces are still there.` }));

        run.award(marks, 2);

        UI.modal(safe ? 'Safe landing ✓' : 'Hard landing', body, [
          { label: 'Read the trace ▶', primary: true, onClick: () => askAboutJump(state) }
        ]);
      }

      function askAboutJump(s) {
        const qs = [
          {
            type: 'mcq', badge: 'terminal',
            stem: `While you were falling at a steady ${Physics.fix(JUMP.freeFallTerminal, 0)} m s⁻¹ — the flat part of your trace — what was the <strong>resultant force</strong> on you?`,
            options: [
              { text: 'Zero: drag had grown until it balanced your weight' },
              { text: 'Equal to your weight, downwards', why: 'Weight is one of the two forces acting, not the resultant of both.' },
              { text: 'Upwards, because drag had become larger than weight', why: 'That is what happens just after the canopy opens, not at a steady terminal speed.' },
              { text: 'Small and downwards, to keep you falling', why: 'Constant velocity needs no resultant force at all.' }
            ],
            answer: 0,
            work: 'Constant velocity → a = 0 → resultant force = 0.\nThe flat trace is the direct evidence: no change in velocity.'
          },
          {
            type: 'mcq', badge: 'terminal',
            stem: 'In the instant <strong>after</strong> your canopy opened, which way did you <strong>accelerate</strong>, and which way did you <strong>move</strong>?',
            options: [
              { text: 'Accelerated upwards, moved downwards' },
              { text: 'Accelerated downwards, moved downwards', why: 'Your speed dropped sharply, so the acceleration opposed your motion — it pointed up.' },
              { text: 'Accelerated upwards, moved upwards', why: 'You kept falling. Slowing down while moving down is not the same as moving up.' },
              { text: 'Neither — the forces balanced immediately', why: 'The trace falls steeply after deployment, so there was a large resultant force for a while.' }
            ],
            answer: 0,
            work: 'The canopy\'s large area makes drag ≫ weight, so the resultant force is upwards.\nYou keep moving down, but slow rapidly, until drag falls back to equal weight at the new, lower terminal speed.'
          },
          {
            type: 'mcq',
            stem: 'At the very start of the jump, when your speed was still zero, what was your acceleration?',
            options: [
              { text: '9.81 m s⁻² downwards, because drag = 0 at v = 0' },
              { text: 'Zero, because you had not started moving', why: 'Your weight acts from the first instant, so you accelerate from the first instant.' },
              { text: 'Less than 9.81 m s⁻², because air was already resisting', why: 'Drag grows with speed. At v = 0 there is no drag at all.' },
              { text: 'Greater than 9.81 m s⁻²', why: 'Nothing pushes you down harder than your own weight.' }
            ],
            answer: 0,
            work: 'Drag depends on speed, and the speed was zero, so drag was zero.\nResultant force = weight → a = g = 9.81 m s⁻² downwards. That is why the trace starts at its steepest.'
          }
        ];

        run.side.innerHTML = '';
        Shell.askAll(run.side, qs, { title: 'Jump debrief', xp: 35 }).then(correct => {
          run.award(correct, qs.length);
          resolve();
        });
      }
    });
  }

  /* ------------------------------ task 2: air on / air off ---------------- */

  /* The golf ball from the deck: 20 m s⁻¹ at 35°.  A terminal speed of
     22 m s⁻¹ reproduces the deck's model figures (range 38 m → 25 m,
     height 6.7 m → 5.3 m, time 2.3 s → 2.1 s). */
  const BALL = { u: 20, angle: 35, terminal: 22 };

  function airOnOff(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(1, 3);
      run.brief('Task 2 — <strong>Air on, air off.</strong> The same launch, twice: once in a vacuum, once in air. Compare the two paths, then complete the six-effects table.');

      const vac = Physics.trajectory(BALL.u, BALL.angle, 0, 160);
      const air = Physics.dragFlight(BALL.u, BALL.angle, 0, BALL.terminal, 0.002);

      const { cnv, ctx, w, h } = UI.canvas(560, 330);
      run.stage.append(el('div.canvas-wrap', null, cnv));

      let reveal = 0;
      const anim = Zone.loop(dt => {
        reveal = Math.min(1, reveal + dt * 0.35);
        drawCompare(ctx, w, h, vac, air, reveal);
      });

      run.stage.append(el('div.panel.mt', null,
        el('div.eyebrow', null, `Launch: ${BALL.u} m s⁻¹ at ${BALL.angle}° above the horizontal`),
        el('table.data', { html: `
          <tr><th>Quantity</th><th>Vacuum</th><th>In air</th></tr>
          <tr><td>Range</td><td class="num">${Physics.sig(vac.summary.range, 3)} m</td><td class="num">${Physics.sig(air.range, 3)} m</td></tr>
          <tr><td>Maximum height</td><td class="num">${Physics.sig(vac.summary.maxHeight, 3)} m</td><td class="num">${Physics.sig(air.maxHeight, 3)} m</td></tr>
          <tr><td>Time of flight</td><td class="num">${Physics.sig(vac.summary.timeOfFlight, 3)} s</td><td class="num">${Physics.sig(air.timeOfFlight, 3)} s</td></tr>
          <tr><td>Landing speed</td><td class="num">${Physics.sig(vac.summary.landingSpeed, 3)} m s⁻¹</td><td class="num">${Physics.sig(air.landingSpeed, 3)} m s⁻¹</td></tr>` }),
        el('p.small.muted.mt.mb0', { html: 'These are the deck\'s model figures: the same launch loses about a third of its range once the air is switched on.' })
      ));

      /* The six-effects table from the deck, as a set of dropdowns. */
      const ROWS = [
        { q: 'Maximum height', a: 'smaller', why: 'Going up, drag and weight both act downwards, so the ball slows faster and peaks lower.' },
        { q: 'Range', a: 'smaller', why: 'Drag has a backwards horizontal component, so v<sub>x</sub> falls and less ground is covered.' },
        { q: 'Time of flight', a: 'smaller', why: 'The descent is slower, but the much lower peak wins: the total is shorter.' },
        { q: 'Horizontal velocity during the flight', a: 'no longer constant', why: 'Without drag v<sub>x</sub> never changes. With drag it decreases throughout, so it is no longer constant.' },
        { q: 'Landing speed', a: 'smaller', why: 'Energy is transferred to the air, so the ball lands more slowly than it was launched.' },
        { q: 'Acceleration during the flight', a: 'no longer constant', why: 'Greater than g going up, exactly g at the top where v = 0, less than g coming down.' }
      ];
      const OPTIONS = ['smaller', 'larger', 'no longer constant'];

      const selects = [];
      const rowsHtml = el('tbody');
      ROWS.forEach((row, i) => {
        const sel = el('select', { 'aria-label': row.q });
        sel.append(el('option', { value: '' }, '— choose —'));
        OPTIONS.forEach(o => sel.append(el('option', { value: o }, o)));
        selects.push(sel);
        const verdict = el('td');
        const tr = el('tr', null, el('td', { html: row.q }), el('td', null, sel), verdict);
        row.verdictCell = verdict;
        rowsHtml.append(tr);
      });

      const checkBtn = el('button.btn.btn--primary.btn--wide.mt', { type: 'button', onClick: check }, 'Submit the table');
      run.side.append(el('div.panel', null,
        el('div.eyebrow', null, 'Six effects of fluid resistance'),
        el('p.small.muted', { html: 'Compared with the same launch in a vacuum, each quantity becomes:' }),
        el('table.data', null, el('thead', { html: '<tr><th>Quantity</th><th>In air it is…</th><th></th></tr>' }), rowsHtml),
        checkBtn
      ));

      function check() {
        let correct = 0;
        ROWS.forEach((row, i) => {
          const given = selects[i].value;
          const ok = given === row.a;
          if (ok) correct++;
          selects[i].disabled = true;
          row.verdictCell.innerHTML = '';
          row.verdictCell.append(el('span', { style: { color: ok ? '#5ce08a' : '#ff6b81', fontWeight: '700' } }, ok ? '✓' : '✗'));
          if (!ok) {
            row.verdictCell.append(el('div.small.muted', { html: `<strong>${row.a}</strong> — ${row.why}` }));
          }
        });
        checkBtn.disabled = true;
        Game.recordAnswer(correct >= 5);
        Game.addXp(correct * 25);
        if (correct >= 5) Game.awardBadge('dragaware');
        run.award(correct, ROWS.length);
        anim.stop();
        reveal = 1;
        drawCompare(ctx, w, h, vac, air, 1);

        UI.modal('Table checked', el('div', null,
          el('p', { html: `<strong>${correct} of ${ROWS.length}</strong> correct.` }),
          el('p.small.muted', { html: 'Drag opposes the velocity and grows with speed, so the horizontal and vertical motions are no longer independent — and the four equations of motion no longer apply.' })
        ), [{ label: 'Continue ▶', primary: true, onClick: resolve }]);
      }
    });
  }

  function drawCompare(ctx, w, h, vac, air, reveal) {
    const pad = { l: 40, r: 18, t: 20, b: 34 };
    const maxX = Math.max(vac.summary.range, air.range) * 1.08;
    const maxY = Math.max(vac.summary.maxHeight, air.maxHeight) * 1.35;
    const X = m => pad.l + (m / maxX) * (w - pad.l - pad.r);
    const Y = m => h - pad.b - (m / maxY) * (h - pad.t - pad.b);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050a12'; ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(36,52,79,.8)'; ctx.lineWidth = 1;
    ctx.fillStyle = '#5f7190'; ctx.font = '10px ui-monospace, monospace';
    for (let m = 0; m <= maxX; m += 5) {
      ctx.beginPath(); ctx.moveTo(X(m), pad.t); ctx.lineTo(X(m), Y(0)); ctx.stroke();
      if (m % 10 === 0) ctx.fillText(`${m}`, X(m) - 5, h - pad.b + 14);
    }
    for (let m = 0; m <= maxY; m += 2) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(m)); ctx.lineTo(w - pad.r, Y(m)); ctx.stroke();
    }
    ctx.fillStyle = '#16233b';
    ctx.fillRect(pad.l, Y(0), w - pad.l - pad.r, h - pad.b - Y(0) + 14);

    const drawPath = (pts, colour, dash, upTo) => {
      ctx.strokeStyle = colour; ctx.lineWidth = 2.6; ctx.setLineDash(dash);
      ctx.beginPath();
      const n = Math.max(2, Math.floor(pts.length * upTo));
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        if (i === 0) ctx.moveTo(X(p.x), Y(p.y)); else ctx.lineTo(X(p.x), Y(p.y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const head = pts[Math.min(n - 1, pts.length - 1)];
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.arc(X(head.x), Y(head.y), 5, 0, Math.PI * 2); ctx.fill();
    };

    drawPath(vac.path, '#ffc24a', [7, 5], reveal);
    drawPath(air.path, '#2fd6c3', [], reveal);

    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillStyle = '#ffc24a'; ctx.fillText('vacuum — symmetric parabola', pad.l + 6, pad.t + 12);
    ctx.fillStyle = '#2fd6c3'; ctx.fillText('in air — lower peak, steeper descent', pad.l + 6, pad.t + 28);
    ctx.fillStyle = '#5f7190'; ctx.fillText('x / m', w - pad.r - 26, h - 8);
  }

  /* ------------------------------ zone entry ----------------------------- */

  async function render(root) {
    const run = Shell.zone(root, META);
    await skydive(run);
    await airOnOff(run);

    run.clear();
    run.setStep(2, 3);
    run.brief('Task 3 — <strong>Flight check.</strong> Fluid resistance is examined qualitatively — these are the explanations that earn the marks.');
    run.stage.append(el('div.panel', null,
      el('div.eyebrow', null, 'S5 key ideas'),
      el('ul.tight', { html: `
        <li>Drag opposes the velocity and <strong>grows with speed</strong>; at v = 0 there is none.</li>
        <li>Falling: resultant = weight − drag, so a falls as v rises.</li>
        <li>Terminal speed: drag = weight, resultant = 0, a = 0 — both forces still act.</li>
        <li>Going up |a| > g; at the top |a| = g; coming down |a| < g.</li>
        <li>The equations of motion do not apply, because a is not uniform.</li>` })
    ));

    const qs = Questions.sample(Questions.banks.s5, 5);
    const correct = await Shell.askAll(run.side, qs, { title: 'Licence check', xp: 30 });
    run.award(correct, qs.length);
    run.setStep(3, 3);
    await run.finish();
  }

  return { META, render };
})();
