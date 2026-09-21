/* ==========================================================================
   zone1.js — S1 Describing motion: "Beacon Run"
   The cadet flies a rescue drone between beacons and files a flight log.
   Task 1  Flight recorder — distance vs displacement, speed vs velocity.
   Task 2  Sign duel       — speeding up or slowing down, from the signs.
   Task 3  Flight check    — questions from the S1 bank.
   ========================================================================== */

const Zone1 = (() => {
  'use strict';
  const el = UI.el;
  const ACCENT = '#2fd6c3';

  const META = {
    id: 'z1',
    tag: 'Zone 1 · S1',
    name: 'Beacon Run',
    subtitle: 'Describing motion: position, displacement, speed, velocity, acceleration',
    accent: ACCENT,
    steps: 3,
    praise: 'Flight logs accepted. Navigation systems trust your readings.',
    revise: 'Re-read S1 steps 2–7: displacement is a change in position, and the sign of a tells you a direction, not "slowing down".',
    recap: [
      'Distance is the path length (scalar); displacement is the change in position (vector).',
      'Average speed = distance ÷ time.  Average velocity = displacement ÷ time.',
      'Same signs for v and a → speeding up.  Opposite signs → slowing down.',
      'A direction needs a reference: "32° west of north", not just "32°".'
    ]
  };

  /* ------------------------------ flight generation ---------------------- */

  const COMPASS = {
    N: { dx: 0, dy: 1, name: 'north' },
    S: { dx: 0, dy: -1, name: 'south' },
    E: { dx: 1, dy: 0, name: 'east' },
    W: { dx: -1, dy: 0, name: 'west' }
  };

  /** A 3-leg flight with a non-zero, non-degenerate net displacement. */
  function makeFlight() {
    for (let attempt = 0; attempt < 60; attempt++) {
      const pattern = Questions.pick([['N', 'W', 'S'], ['E', 'N', 'W'], ['N', 'E', 'S'], ['W', 'S', 'E'], ['E', 'S', 'W']]);
      const legs = pattern.map(dirKey => ({
        dir: dirKey,
        length: 10 * (2 + Math.floor(Math.random() * 11))   // 20–120 m
      }));
      let x = 0, y = 0, distance = 0;
      legs.forEach(leg => {
        x += COMPASS[leg.dir].dx * leg.length;
        y += COMPASS[leg.dir].dy * leg.length;
        distance += leg.length;
      });
      const displacement = Math.hypot(x, y);
      if (displacement < 25 || Math.abs(x) < 10 || Math.abs(y) < 10) continue;
      const time = 10 * (3 + Math.floor(Math.random() * 10));  // 30–120 s
      return { legs, x, y, distance, displacement, time };
    }
    // Fallback: the drone example from slide 23 of the content deck.
    return {
      legs: [{ dir: 'N', length: 120 }, { dir: 'W', length: 50 }, { dir: 'S', length: 40 }],
      x: -50, y: 80, distance: 210, displacement: Math.hypot(50, 80), time: 60
    };
  }

  /** Compass bearing of the net displacement, phrased the way the deck does. */
  function bearingText(x, y) {
    const ns = y >= 0 ? 'north' : 'south';
    const ew = x >= 0 ? 'east' : 'west';
    const angleFromNS = Physics.deg(Math.atan2(Math.abs(x), Math.abs(y)));
    return `${Physics.sig(angleFromNS, 2)}° ${ew} of ${ns}`;
  }

  /* ------------------------------ drawing -------------------------------- */

  function drawFlight(ctx, w, h, flight, progress) {
    const pad = 34;
    const pts = [{ x: 0, y: 0 }];
    let cx = 0, cy = 0;
    flight.legs.forEach(leg => {
      cx += COMPASS[leg.dir].dx * leg.length;
      cy += COMPASS[leg.dir].dy * leg.length;
      pts.push({ x: cx, y: cy });
    });

    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 40), spanY = Math.max(maxY - minY, 40);
    const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
    const ox = pad + (w - 2 * pad - spanX * scale) / 2 - minX * scale;
    const oy = h - pad - (h - 2 * pad - spanY * scale) / 2 + minY * scale;
    const X = mx => ox + mx * scale;
    const Y = my => oy - my * scale;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050a12';
    ctx.fillRect(0, 0, w, h);

    // Grid at 10 m spacing, so the scale is readable.
    ctx.strokeStyle = 'rgba(36,52,79,.8)';
    ctx.lineWidth = 1;
    for (let gx = Math.floor(minX / 10) * 10; gx <= maxX + 10; gx += 10) {
      ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), h); ctx.stroke();
    }
    for (let gy = Math.floor(minY / 10) * 10; gy <= maxY + 10; gy += 10) {
      ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(w, Y(gy)); ctx.stroke();
    }

    // Compass rose
    ctx.fillStyle = '#5f7190';
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.fillText('N ↑', 10, 18);
    ctx.fillText('E →', 10, 32);
    ctx.fillText('10 m grid', 10, h - 10);

    // The route actually flown: this length is the DISTANCE.
    const totalLen = flight.distance;
    let walked = totalLen * progress;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    let head = { x: 0, y: 0 };
    for (let i = 1; i < pts.length; i++) {
      const segLen = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (walked >= segLen) {
        ctx.lineTo(X(pts[i].x), Y(pts[i].y));
        head = pts[i];
        walked -= segLen;
      } else {
        const f = segLen > 0 ? walked / segLen : 0;
        head = {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f
        };
        ctx.lineTo(X(head.x), Y(head.y));
        walked = 0;
        break;
      }
    }
    ctx.stroke();

    // The straight start-to-finish arrow: this is the DISPLACEMENT.
    if (progress > 0.995) {
      ctx.strokeStyle = '#ffc24a';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      ctx.lineTo(X(flight.x), Y(flight.y));
      ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(Y(flight.y) - Y(0), X(flight.x) - X(0));
      ctx.fillStyle = '#ffc24a';
      ctx.beginPath();
      ctx.moveTo(X(flight.x), Y(flight.y));
      ctx.lineTo(X(flight.x) - 11 * Math.cos(ang - 0.4), Y(flight.y) - 11 * Math.sin(ang - 0.4));
      ctx.lineTo(X(flight.x) - 11 * Math.cos(ang + 0.4), Y(flight.y) - 11 * Math.sin(ang + 0.4));
      ctx.fill();
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillText('displacement', X(flight.x / 2) + 8, Y(flight.y / 2) - 6);
    }

    // Beacons and drone
    pts.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#5ce08a' : '#24344f';
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#e8eef8';
    ctx.beginPath(); ctx.arc(X(head.x), Y(head.y), 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ACCENT;
    ctx.beginPath(); ctx.arc(X(head.x), Y(head.y), 3.5, 0, Math.PI * 2); ctx.fill();
  }

  /* ------------------------------ task 1 --------------------------------- */

  function flightRecorder(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(0, 3);
      run.brief('Task 1 — <strong>Flight recorder.</strong> The drone flies its route, then mission control wants the log filled in. Watch the teal trail (the path it flew) and the gold arrow (start to finish).');

      const flight = makeFlight();
      const { cnv, ctx, w, h } = UI.canvas(540, 380);
      const legText = flight.legs.map(l => `${l.length} m ${COMPASS[l.dir].name}`).join(', then ');

      run.stage.append(
        el('div.canvas-wrap', null, cnv),
        el('div.panel.mt', null,
          el('div.eyebrow', null, 'Flight plan'),
          el('p.mb0', { html: `The drone flies <strong>${legText}</strong>. The flight takes <strong>${flight.time} s</strong>.` })
        )
      );

      let progress = 0;
      const anim = Zone.loop(dt => {
        progress = Math.min(1, progress + dt * 0.45);
        drawFlight(ctx, w, h, flight, progress);
      });

      const qs = [
        {
          type: 'num',
          stem: 'Log the <strong>distance</strong> travelled.',
          answer: flight.distance, unit: 'm', tol: 0.01,
          badge: 'pathfinder',
          hint: 'Add up the length of every leg.',
          work: `distance = ${flight.legs.map(l => l.length).join(' + ')} = ${flight.distance} m`
        },
        {
          type: 'num',
          stem: 'Log the <strong>magnitude of the displacement</strong>.',
          answer: flight.displacement, unit: 'm', tol: 0.02,
          badge: 'pathfinder',
          hint: 'Find the net movement east–west and north–south first, then use Pythagoras.',
          work: `net: ${Math.abs(flight.x)} m ${flight.x >= 0 ? 'east' : 'west'} and ${Math.abs(flight.y)} m ${flight.y >= 0 ? 'north' : 'south'}\n`
              + `s = √(${Math.abs(flight.x)}² + ${Math.abs(flight.y)}²) = ${Physics.sig(flight.displacement, 3)} m\n`
              + `direction: ${bearingText(flight.x, flight.y)}`
        },
        {
          type: 'num',
          stem: 'Log the <strong>average speed</strong>.',
          answer: flight.distance / flight.time, unit: 'm s⁻¹', tol: 0.02,
          work: `average speed = distance ÷ time = ${flight.distance} ÷ ${flight.time} = ${Physics.sig(flight.distance / flight.time, 3)} m s⁻¹`
        },
        {
          type: 'num',
          stem: 'Log the <strong>magnitude of the average velocity</strong>.',
          answer: flight.displacement / flight.time, unit: 'm s⁻¹', tol: 0.02,
          work: `average velocity = displacement ÷ time = ${Physics.sig(flight.displacement, 3)} ÷ ${flight.time}\n`
              + `= ${Physics.sig(flight.displacement / flight.time, 3)} m s⁻¹ at ${bearingText(flight.x, flight.y)}`
        }
      ];

      Shell.askAll(run.side, qs, { title: 'Flight log', xp: 30 }).then(correct => {
        anim.stop();
        run.award(correct, qs.length);
        resolve();
      });
    });
  }

  /* ------------------------------ task 2 --------------------------------- */

  /** Quick-fire: given the signs of v and a, is the craft speeding up? */
  function signDuel(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(1, 3);
      run.brief('Task 2 — <strong>Sign duel.</strong> Take <strong>right as positive</strong>. The thruster reading gives the acceleration. Call it before the timer runs out: is the craft speeding up or slowing down?');

      const ROUNDS = 8;
      const TIME_LIMIT = 6;
      let round = 0, correct = 0, timeLeft = TIME_LIMIT, locked = false;

      const { cnv, ctx, w, h } = UI.canvas(540, 300);
      const timerBar = el('div.hud__xpbar', { style: { height: '10px' } }, el('div.hud__xpfill', { style: { width: '100%', transition: 'none' } }));
      const scoreLine = el('p.small.muted.mb0');
      run.stage.append(el('div.canvas-wrap', null, cnv), el('div.mt', null, timerBar), el('div.mt', null, scoreLine));

      let current = null;
      const feedback = el('div');
      const btnUp = el('button.btn.btn--wide', { type: 'button', onClick: () => answer(true) }, '⏩ Speeding up');
      const btnDown = el('button.btn.btn--wide', { type: 'button', onClick: () => answer(false) }, '⏪ Slowing down');
      run.side.append(el('div.panel', null,
        el('div.eyebrow', null, 'Call it'),
        el('p.small.muted', null, 'Rule from S1 step 7: same signs → speeding up; opposite signs → slowing down.'),
        el('div.btn-row', null, btnUp, btnDown),
        feedback
      ));

      function newRound() {
        const v = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 12));
        const a = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.floor(Math.random() * 8) * 0.5);
        current = { v, a, speedingUp: v * a > 0 };
        timeLeft = TIME_LIMIT;
        locked = false;
        btnUp.disabled = btnDown.disabled = false;
        feedback.innerHTML = '';
        scoreLine.textContent = `Round ${round + 1} of ${ROUNDS} — ${correct} correct`;
      }

      function answer(saidSpeedingUp) {
        if (locked || !current) return;
        locked = true;
        btnUp.disabled = btnDown.disabled = true;
        const ok = saidSpeedingUp === current.speedingUp;
        if (ok) { correct++; Game.addXp(20); }
        Game.recordAnswer(ok);
        if (ok && correct >= 6) Game.awardBadge('signmaster');

        const vs = current.v > 0 ? 'positive' : 'negative';
        const as = current.a > 0 ? 'positive' : 'negative';
        feedback.innerHTML = '';
        feedback.append(el('div.feedback' + (ok ? '.feedback--right' : '.feedback--wrong'), null,
          el('div.feedback__title', null, ok ? '✓ Correct' : '✗ Not quite'),
          el('div', { html: `v is ${vs} and a is ${as} — <strong>${vs === as ? 'same' : 'opposite'} signs</strong>, so the craft is <strong>${current.speedingUp ? 'speeding up' : 'slowing down'}</strong>.` })
        ));

        setTimeout(() => {
          round++;
          if (round >= ROUNDS) {
            anim.stop();
            run.award(correct, ROUNDS);
            resolve();
          } else {
            newRound();
          }
        }, 1500);
      }

      function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#050a12';
        ctx.fillRect(0, 0, w, h);
        if (!current) return;

        const midY = h / 2;
        // Axis with the positive direction spelled out.
        ctx.strokeStyle = '#24344f';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(30, midY + 46); ctx.lineTo(w - 30, midY + 46); ctx.stroke();
        ctx.fillStyle = '#5f7190';
        ctx.font = '600 12px ui-monospace, monospace';
        ctx.fillText('− negative', 34, midY + 66);
        ctx.fillText('positive +', w - 106, midY + 66);

        // Craft
        const cx = w / 2;
        ctx.fillStyle = '#e8eef8';
        ctx.beginPath();
        ctx.moveTo(cx + (current.v > 0 ? 26 : -26), midY);
        ctx.lineTo(cx - (current.v > 0 ? 18 : -18), midY - 13);
        ctx.lineTo(cx - (current.v > 0 ? 18 : -18), midY + 13);
        ctx.closePath(); ctx.fill();

        // Velocity arrow (teal) sized by |v|
        arrow(ctx, cx, midY - 46, Math.sign(current.v) * (34 + Math.abs(current.v) * 7), ACCENT, `v = ${current.v > 0 ? '+' : ''}${current.v} m s⁻¹`);
        // Acceleration arrow (gold) sized by |a|
        arrow(ctx, cx, midY + 100, Math.sign(current.a) * (34 + Math.abs(current.a) * 14), '#ffc24a', `a = ${current.a > 0 ? '+' : ''}${current.a.toFixed(1)} m s⁻²`);
      }

      function arrow(c, x, y, len, colour, label) {
        c.strokeStyle = colour; c.fillStyle = colour; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke();
        const s = Math.sign(len);
        c.beginPath();
        c.moveTo(x + len, y);
        c.lineTo(x + len - s * 13, y - 8);
        c.lineTo(x + len - s * 13, y + 8);
        c.fill();
        c.font = '700 13px ui-monospace, monospace';
        c.fillText(label, x - 60, y - 16);
      }

      newRound();
      const anim = Zone.loop(dt => {
        if (!locked) {
          timeLeft -= dt;
          if (timeLeft <= 0) { answer(!current.speedingUp); }  // time out counts as wrong
        }
        timerBar.firstChild.style.width = `${Math.max(0, (timeLeft / TIME_LIMIT) * 100)}%`;
        timerBar.firstChild.style.background = timeLeft < 2 ? '#ff6b81' : 'linear-gradient(90deg,#17806f,#2fd6c3)';
        draw();
      });
    });
  }

  /* ------------------------------ zone entry ----------------------------- */

  async function render(root) {
    const run = Shell.zone(root, META);
    await flightRecorder(run);
    await signDuel(run);

    run.clear();
    run.setStep(2, 3);
    run.brief('Task 3 — <strong>Flight check.</strong> Mission control asks the questions that decide whether you keep your licence.');
    run.stage.append(el('div.panel', null,
      el('div.eyebrow', null, 'S1 key ideas'),
      el('ul.tight', { html: `
        <li>Position needs an <strong>origin</strong> and a <strong>positive direction</strong>.</li>
        <li>Displacement = final position − initial position.</li>
        <li>Speed uses distance; velocity uses displacement and needs a direction.</li>
        <li>A speedometer shows an <strong>instantaneous speed</strong>.</li>
        <li>Constant speed round a bend is still <strong>accelerating</strong>.</li>` })
    ));

    const qs = Questions.sample(Questions.banks.s1, 4);
    const correct = await Shell.askAll(run.side, qs, { title: 'Licence check', xp: 30 });
    run.award(correct, qs.length);
    run.setStep(3, 3);
    await run.finish();
  }

  return { META, render };
})();
