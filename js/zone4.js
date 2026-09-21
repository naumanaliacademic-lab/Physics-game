/* ==========================================================================
   zone4.js — S4 Projectile motion: "Launch Bay"
   A rescue-line launcher. Horizontal and vertical motion are independent, so
   level 1 fires a line AND drops a marker at the same instant: they hit the
   water together, which is the Shoot-n-Drop demonstration from the deck.
   Task 1  Four launches — horizontal, above, below the horizontal, and over a wall.
   Task 2  Flight check.
   ========================================================================== */

const Zone4 = (() => {
  'use strict';
  const el = UI.el;
  const ACCENT = '#5ce08a';
  const G = Physics.G;

  const META = {
    id: 'z4',
    tag: 'Zone 4 · S4',
    name: 'Launch Bay',
    subtitle: 'Projectiles: two columns, one clock',
    accent: ACCENT,
    steps: 2,
    praise: 'Every line on target. Resolve, two columns, time from the vertical.',
    revise: 'Re-read S4 steps 4–7: resolve the launch velocity, write a horizontal and a vertical column, and let the time link them.',
    recap: [
      'a<sub>x</sub> = 0 so v<sub>x</sub> is constant; a<sub>y</sub> = g downwards the whole flight.',
      'Time is the only quantity the two columns share — usually find it from the vertical.',
      'At the top v<sub>y</sub> = 0 but v = v<sub>x</sub>, and a is still g downwards.',
      '45° gives the greatest range only on level ground with no air resistance.'
    ]
  };

  /* ------------------------------ levels --------------------------------- */

  const LEVELS = [
    {
      name: 'Line to the raft',
      brief: 'A raft is adrift below the cliff. Fire the rescue line <strong>horizontally</strong> from the cliff edge so it lands on the raft. A marker is released from your hand at the same instant — watch when it lands.',
      height: 30, angle: 0, angleLocked: true,
      speedRange: [4, 30], targetX: null, tol: 2.2,
      showDrop: true,
      question: s => ({
        type: 'num', badge: 'independence',
        stem: `The line was fired horizontally at <strong>${Physics.sig(s.u, 3)} m s⁻¹</strong> from <strong>${s.h} m</strong> up. Calculate the <strong>time of flight</strong>.`,
        answer: s.flight.timeOfFlight, unit: 's', tol: 0.04,
        hint: 'Use the vertical column only. u_y = 0.',
        work: `Vertical (down positive): ${s.h} = ½ × 9.81 × t²\nt = √(${(2 * s.h).toFixed(1)} / 9.81) = ${Physics.sig(s.flight.timeOfFlight, 3)} s\n`
            + `The marker, dropped from rest, takes exactly the same time — the horizontal speed changes nothing.`
      })
    },
    {
      name: 'Over the ridge',
      brief: 'A stranded team is on flat ground across the valley. Launch <strong>above the horizontal</strong> from ground level and land the pack on their marker.',
      height: 0, angle: 40, angleLocked: false, angleRange: [10, 80],
      speedRange: [8, 35], targetX: null, tol: 2.5,
      question: s => ({
        type: 'num',
        stem: `You launched at <strong>${Physics.sig(s.u, 3)} m s⁻¹</strong>, <strong>${s.angle}°</strong> above the horizontal. Calculate the <strong>maximum height</strong> reached.`,
        answer: s.flight.maxHeight, unit: 'm', tol: 0.05,
        hint: 'Resolve u_y = u sin θ, then use v_y = 0 at the top.',
        work: `u_y = ${Physics.sig(s.u, 3)} sin ${s.angle}° = ${Physics.sig(s.flight.uy, 3)} m s⁻¹\n`
            + `0 = u_y² − 2gH  →  H = ${Physics.sig(s.flight.uy, 3)}² / 19.62 = ${Physics.sig(s.flight.maxHeight, 3)} m`
      })
    },
    {
      name: 'Down to the deck',
      brief: 'The pad is at the foot of the tower. Launch <strong>below the horizontal</strong> — the vertical motion now starts with a downward component, so the time needs the quadratic formula.',
      height: 25, angle: -20, angleLocked: false, angleRange: [-55, -5],
      speedRange: [6, 28], targetX: null, tol: 2.2,
      question: s => ({
        type: 'num',
        stem: `Launched at <strong>${Physics.sig(s.u, 3)} m s⁻¹</strong>, <strong>${Math.abs(s.angle)}° below</strong> the horizontal, from <strong>${s.h} m</strong> up. Calculate the <strong>speed on landing</strong>.`,
        answer: s.flight.landingSpeed, unit: 'm s⁻¹', tol: 0.05,
        hint: 'Find v_y at landing, then recombine: v = √(v_x² + v_y²).',
        work: `v_x = ${Physics.sig(s.flight.ux, 3)} m s⁻¹ (constant)\n`
            + `v_y at landing = ${Physics.sig(Math.abs(s.flight.uy) + G * s.flight.timeOfFlight, 3)} m s⁻¹ downwards\n`
            + `v = √(v_x² + v_y²) = ${Physics.sig(s.flight.landingSpeed, 3)} m s⁻¹, at ${Physics.sig(Math.abs(s.flight.landingAngle), 2)}° below the horizontal`
      })
    },
    {
      name: 'Clear the mast',
      brief: 'A mast stands between you and the landing zone. The pack must pass <strong>over</strong> the mast and still land on the marker. Two conditions, one launch.',
      height: 0, angle: 55, angleLocked: false, angleRange: [20, 80],
      speedRange: [10, 40], targetX: null, tol: 3.0,
      obstacle: true,
      question: s => ({
        type: 'mcq', badge: 'topofflight',
        stem: 'At the highest point of that flight, what was the pack doing?',
        options: [
          { text: `Moving at ${Physics.sig(s.flight.ux, 2)} m s⁻¹ horizontally, accelerating at 9.81 m s⁻² downwards` },
          { text: 'Momentarily at rest, with zero acceleration', why: 'Only v<sub>y</sub> is zero. The horizontal velocity never changed, and gravity never switched off.' },
          { text: `Moving at ${Physics.sig(s.u, 2)} m s⁻¹ horizontally`, why: 'That is the full launch speed. At the top only the horizontal component remains: u cos θ.' },
          { text: 'Momentarily at rest, accelerating at 9.81 m s⁻² downwards', why: 'v<sub>y</sub> = 0, but v<sub>x</sub> = u cos θ is unchanged, so the pack is still moving.' }
        ],
        answer: 0,
        work: `v_x = u cos θ = ${Physics.sig(s.u, 3)} cos ${s.angle}° = ${Physics.sig(s.flight.ux, 3)} m s⁻¹, constant all flight.\n`
            + `At the top v_y = 0, so v = v_x. The acceleration is g downwards everywhere.`
      })
    }
  ];

  /** Choose a target the player can actually reach with the sliders given. */
  function placeTarget(level) {
    const [sMin, sMax] = level.speedRange;
    const angle = level.angleLocked ? level.angle : (level.angleRange[0] + level.angleRange[1]) / 2;
    const near = Physics.projectile(sMin * 1.25, angle, level.height).range;
    const far = Physics.projectile(sMax * 0.85, angle, level.height).range;
    const lo = Math.min(near, far), hi = Math.max(near, far);
    const x = lo + Math.random() * (hi - lo);
    return Math.max(6, Math.round(x * 2) / 2);
  }

  /* ------------------------------ rendering ------------------------------ */

  function makeView(level, targetX, obstacle) {
    const maxX = Math.max(targetX * 1.25, 30);
    const maxY = Math.max(level.height + 20, 30);
    return { maxX, maxY };
  }

  function drawScene(ctx, w, h, opts) {
    const { level, targetX, view, path, marker, projectilePos, dropPos, strobe, obstacle } = opts;
    const pad = { l: 34, r: 18, t: 18, b: 34 };
    const X = mx => pad.l + (mx / view.maxX) * (w - pad.l - pad.r);
    const Y = my => h - pad.b - (my / view.maxY) * (h - pad.t - pad.b);

    ctx.clearRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a1424');
    sky.addColorStop(1, '#050a12');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Distance scale along the ground
    ctx.strokeStyle = 'rgba(36,52,79,.8)';
    ctx.fillStyle = '#5f7190';
    ctx.font = '10px ui-monospace, monospace';
    ctx.lineWidth = 1;
    const step = view.maxX > 120 ? 20 : view.maxX > 60 ? 10 : 5;
    const yStep = view.maxY > 120 ? 20 : view.maxY > 60 ? 10 : 5;
    for (let m = 0; m <= view.maxX; m += step) {
      ctx.beginPath(); ctx.moveTo(X(m), pad.t); ctx.lineTo(X(m), Y(0)); ctx.stroke();
    }
    for (let m = 0; m <= view.maxY; m += yStep) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(m)); ctx.lineTo(w - pad.r, Y(m)); ctx.stroke();
    }

    // Ground and the launch platform
    ctx.fillStyle = '#16233b';
    ctx.fillRect(pad.l, Y(0), w - pad.l - pad.r, h - pad.b - Y(0) + 20);
    if (level.height > 0) {
      ctx.fillStyle = '#1d2c48';
      ctx.fillRect(pad.l, Y(level.height), X(4) - pad.l, Y(0) - Y(level.height));
    }

    // Scale labels go on last, so the ground fill cannot bury them.
    ctx.fillStyle = '#5f7190';
    ctx.font = '10px ui-monospace, monospace';
    for (let m = 0; m <= view.maxX; m += step) ctx.fillText(`${m}`, X(m) - 5, h - pad.b + 14);
    for (let m = yStep; m <= view.maxY; m += yStep) ctx.fillText(`${m}`, 4, Y(m) + 3);

    // Mast obstacle
    if (obstacle) {
      ctx.fillStyle = '#ff6b81';
      ctx.fillRect(X(obstacle.x) - 3, Y(obstacle.height), 6, Y(0) - Y(obstacle.height));
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.fillText(`${obstacle.height} m`, X(obstacle.x) - 12, Y(obstacle.height) - 6);
    }

    // Target marker
    ctx.fillStyle = '#ffc24a';
    ctx.beginPath();
    ctx.moveTo(X(targetX), Y(0));
    ctx.lineTo(X(targetX) - 8, Y(0) - 14);
    ctx.lineTo(X(targetX) + 8, Y(0) - 14);
    ctx.closePath(); ctx.fill();
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillText(`${targetX} m`, X(targetX) - 14, Y(0) - 20);

    // Flight path so far
    if (path && path.length > 1) {
      ctx.strokeStyle = 'rgba(92,224,138,.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
      ctx.stroke();
    }

    // Strobe dots: equal horizontal gaps, growing vertical gaps (deck slides 104–105)
    if (strobe) {
      strobe.forEach(p => {
        ctx.fillStyle = '#2fd6c3';
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,194,74,.55)';
        ctx.fillRect(X(p.x) - 1, Y(p.y), 2, Y(0) - Y(p.y));
      });
    }

    // The projectile, and the simultaneously dropped marker
    if (dropPos) {
      ctx.fillStyle = '#a98bff';
      ctx.beginPath(); ctx.arc(X(1.5), Y(dropPos.y), 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(169,139,255,.45)';
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(1.5), Y(dropPos.y)); ctx.lineTo(X(view.maxX), Y(dropPos.y)); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (projectilePos) {
      ctx.fillStyle = '#e8eef8';
      ctx.beginPath(); ctx.arc(X(projectilePos.x), Y(projectilePos.y), 6, 0, Math.PI * 2); ctx.fill();
    }

    // Launcher
    ctx.strokeStyle = '#93a4c0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(level.height));
    ctx.lineTo(X(0) + 20 * Math.cos(Physics.rad(opts.aim)), Y(level.height) - 20 * Math.sin(Physics.rad(opts.aim)));
    ctx.stroke();

    ctx.fillStyle = '#5f7190';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText('x / m', w - pad.r - 24, h - 8);
  }

  /* ------------------------------ task 1 --------------------------------- */

  function launches(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(0, 2);

      let level = 0, marks = 0;
      const MAX = LEVELS.length * 2;

      function startLevel() {
        if (level >= LEVELS.length) { run.award(marks, MAX); resolve(); return; }
        const L = LEVELS[level];
        run.clear();
        run.brief(`Launch ${level + 1} of ${LEVELS.length} — <strong>${L.name}.</strong> ${L.brief}`);

        const targetX = placeTarget(L);
        const obstacle = L.obstacle
          ? { x: Math.round(targetX * 0.45), height: Math.round(Physics.projectile((L.speedRange[0] + L.speedRange[1]) / 2, 50, 0).maxHeight * 0.45) }
          : null;
        const view = makeView(L, targetX);

        const { cnv, ctx, w, h } = UI.canvas(560, 360);
        run.stage.append(el('div.canvas-wrap', null, cnv));
        const readouts = UI.readout({
          ux: { label: 'uₓ = u cos θ' },
          uy: { label: 'u_y = u sin θ' },
          T:  { label: 'time of flight' },
          R:  { label: 'predicted range' }
        });
        run.stage.append(readouts.wrap);

        const panel = el('div.panel');
        run.side.append(panel);

        const speed = UI.slider({
          label: 'Launch speed u', min: L.speedRange[0], max: L.speedRange[1], step: 0.5,
          value: (L.speedRange[0] + L.speedRange[1]) / 2, unit: 'm s⁻¹', onInput: refresh
        });
        const angle = L.angleLocked ? null : UI.slider({
          label: 'Launch angle θ', min: L.angleRange[0], max: L.angleRange[1], step: 1,
          value: L.angle, unit: '°', onInput: refresh
        });

        let attempts = 0, firing = false, shot = null, lastStrobe = null;
        const status = el('div.chips');
        const fireBtn = el('button.btn.btn--primary.btn--wide.mt', { type: 'button', onClick: fire }, '🎯 Fire');

        panel.append(
          el('div.eyebrow', null, `Launch bay ${level + 1} of ${LEVELS.length}`),
          el('p.small', { html: `Target at <strong>${targetX} m</strong>, from a launch height of <strong>${L.height} m</strong>.${obstacle ? ` The mast is <strong>${obstacle.height} m</strong> tall at <strong>${obstacle.x} m</strong>.` : ''} Land within <strong>±${L.tol} m</strong>.` }),
          status,
          speed.wrap,
          angle ? angle.wrap : el('p.small.muted', { html: 'Angle locked at <strong>0°</strong> — a horizontal launch.' }),
          fireBtn
        );

        function currentAim() {
          return { u: speed.value, angle: angle ? angle.value : L.angle };
        }

        function refresh() {
          const { u, angle: th } = currentAim();
          const f = Physics.projectile(u, th, L.height);
          readouts.set('ux', `${Physics.fix(f.ux, 2)} m s⁻¹`);
          readouts.set('uy', `${Physics.fix(f.uy, 2)} m s⁻¹`);
          readouts.set('T', `${Physics.fix(f.timeOfFlight, 2)} s`);
          readouts.set('R', shot ? `${Physics.fix(shot.flight.range, 1)} m` : '—');
          status.innerHTML = '';
          status.append(el('span.chip', null, `attempt ${attempts + 1}`));
          if (attempts > 0 && shot) {
            const miss = shot.flight.range - targetX;
            status.append(el('span.chip.chip--gold', null, miss > 0 ? `last shot ${Physics.sig(miss, 2)} m long` : `last shot ${Physics.sig(-miss, 2)} m short`));
          }
          if (!firing) {
            // Keep the last strobe on screen so the cadet can study the shot.
            drawScene(ctx, w, h, { level: L, targetX, view, aim: th, obstacle, path: null, strobe: lastStrobe, projectilePos: null, dropPos: null });
          }
        }

        function fire() {
          if (firing) return;
          firing = true;
          attempts++;
          lastStrobe = null;
          fireBtn.disabled = true;
          const { u, angle: th } = currentAim();
          const flight = Physics.projectile(u, th, L.height);
          shot = { u, angle: th, h: L.height, flight };

          const path = [];
          let t = 0;
          // Did the pack pass over the mast?  Only meaningful if it got that far.
          const clearedMast = !obstacle
            || flight.range < obstacle.x
            || flight.at(obstacle.x / flight.ux).y > obstacle.height;
          const anim = Zone.loop(dt => {
            t = Math.min(t + dt * 0.85, flight.timeOfFlight);
            const p = flight.at(t);
            path.push({ x: p.x, y: p.y });
            const drop = L.showDrop ? { y: Math.max(0, L.height - 0.5 * G * t * t) } : null;
            drawScene(ctx, w, h, {
              level: L, targetX, view, aim: th, obstacle,
              path, projectilePos: p, dropPos: drop
            });
            readouts.set('R', `${Physics.fix(p.x, 1)} m`);
            if (t >= flight.timeOfFlight) {
              anim.stop();
              firing = false;
              land(flight, clearedMast, th);
            }
          });
        }

        function land(flight, clearedMast, th) {
          const miss = flight.range - targetX;
          const onTarget = Math.abs(miss) <= L.tol && clearedMast;

          // Strobe the finished path: equal horizontal steps, growing vertical ones.
          lastStrobe = [];
          for (let t = 0; t <= flight.timeOfFlight + 1e-9; t += flight.timeOfFlight / 12) lastStrobe.push(flight.at(t));

          refresh();
          fireBtn.disabled = false;

          if (!onTarget) {
            const why = (!clearedMast && flight.range >= obstacle.x)
              ? `The pack struck the mast. It needs more height at x = ${obstacle.x} m — try a steeper angle or more speed.`
              : (miss > 0
                ? `Overshot by ${Physics.sig(miss, 2)} m. ${L.angleLocked ? 'The angle is fixed, so the only lever is the launch speed: range = u\u2093 \u00d7 T, and T is set entirely by the drop height.' : 'Less speed, or an angle further from 45\u00b0, shortens the range.'}`
                : `${Physics.sig(-miss, 2)} m short. ${L.angleLocked ? 'The time of flight cannot change \u2014 only u\u2093 can. Increase the launch speed.' : 'More speed, or an angle nearer 45\u00b0, lengthens it.'}`);
            UI.modal('Missed', el('div', null,
              el('p', { html: why }),
              el('p.small.muted', { html: `That shot: u<sub>x</sub> = ${Physics.sig(flight.ux, 3)} m s⁻¹, u<sub>y</sub> = ${Physics.sig(flight.uy, 3)} m s⁻¹, time of flight ${Physics.sig(flight.timeOfFlight, 3)} s, range = u<sub>x</sub> × T = ${Physics.sig(flight.range, 3)} m.` })
            ), [{ label: 'Re-aim', primary: true }]);
            return;
          }

          // On target. Award, then ask the question that tests the maths behind it.
          const firstTry = attempts === 1;
          marks++;
          Game.addXp(firstTry ? 110 : 70);
          if (L.showDrop) Game.awardBadge('independence');

          const body = el('div', null,
            el('p', { html: `Landed <strong>${Physics.sig(Math.abs(miss), 2)} m</strong> from the marker${firstTry ? ' — first attempt.' : `, on attempt ${attempts}.`}` })
          );
          if (L.showDrop) {
            body.append(el('p.small.muted', { html: `The dropped marker (violet) hit the water at the <strong>same instant</strong>, ${Physics.sig(flight.timeOfFlight, 3)} s after release. Horizontal speed does nothing to the vertical motion — that is the Shoot-n-Drop result.` }));
          }
          body.append(el('p.small.muted', { html: 'The teal dots are a strobe at equal time intervals: equal horizontal gaps (v<sub>x</sub> constant), growing vertical gaps (v<sub>y</sub> increasing).' }));

          UI.modal('On target ✓', body, [{ label: 'Log the shot ▶', primary: true, onClick: () => askQuestion(shot) }]);
        }

        function askQuestion(s) {
          const slot = el('div');
          panel.append(el('div.eyebrow.mt', null, 'Shot analysis'), slot);
          fireBtn.disabled = true;
          UI.ask(slot, L.question(s), ({ correct }) => {
            if (correct) { marks++; Game.addXp(45); }
            level++;
            setTimeout(startLevel, 200);
          });
          slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        refresh();
      }

      startLevel();
    });
  }

  /* ------------------------------ zone entry ----------------------------- */

  async function render(root) {
    const run = Shell.zone(root, META);
    await launches(run);

    run.clear();
    run.setStep(1, 2);
    run.brief('Task 2 — <strong>Flight check.</strong> The projectile traps, straight from the deck.');
    run.stage.append(el('div.panel', null,
      el('div.eyebrow', null, 'The method never changes'),
      el('ul.tight', { html: `
        <li>Resolve: u<sub>x</sub> = u cos θ, u<sub>y</sub> = u sin θ.</li>
        <li>Write two columns, horizontal and vertical.</li>
        <li>Get the time from the vertical column, then use it horizontally.</li>
        <li>Recombine at the end: v = √(v<sub>x</sub>² + v<sub>y</sub>²), tan θ = v<sub>y</sub>/v<sub>x</sub>.</li>` })
    ));

    const qs = Questions.sample(Questions.banks.s4, 5);
    const correct = await Shell.askAll(run.side, qs, { title: 'Licence check', xp: 30 });
    run.award(correct, qs.length);
    run.setStep(2, 2);
    await run.finish();
  }

  return { META, render };
})();
