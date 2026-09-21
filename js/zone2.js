/* ==========================================================================
   zone2.js — S2 Motion graphs: "Docking Sequence"
   The cadet does not answer questions about a graph — the cadet *builds* the
   graph, and the ship flies whatever they draw.
     area under v–t = displacement,  gradient of v–t = acceleration.
   Task 1  Docking   — shape a three-phase v–t profile to hit a dock exactly.
   Task 2  Telemetry — read gradients and areas off a graph the ship flew.
   Task 3  Flight check.
   ========================================================================== */

const Zone2 = (() => {
  'use strict';
  const el = UI.el;
  const ACCENT = '#a98bff';

  const META = {
    id: 'z2',
    tag: 'Zone 2 · S2',
    name: 'Docking Sequence',
    subtitle: 'Motion graphs: gradients give rates, areas give changes',
    accent: ACCENT,
    steps: 3,
    praise: 'Docking clamps engaged. You can read a graph and fly one.',
    revise: 'Re-read S2 steps 1–6: gradient of v–t is acceleration, area under v–t is displacement, and area below the axis is negative.',
    recap: [
      'Gradient of s–t = velocity; use a <strong>tangent</strong> for an instantaneous value.',
      'Gradient of v–t = acceleration.  Area under v–t = displacement.',
      'Area under a–t = <strong>change</strong> in velocity, so add u to get v.',
      'Area below the time axis counts as negative displacement.'
    ]
  };

  /* ------------------------------ graph drawing -------------------------- */

  /**
   * Draw a velocity–time graph.  points = [{t, v}, ...].
   * opts: { tMax, vMin, vMax, shade, title, marker:{t,v} }
   */
  function drawVT(ctx, w, h, points, opts) {
    const o = opts || {};
    const pad = { l: 52, r: 16, t: 22, b: 36 };
    const tMax = o.tMax || Math.max(1, points[points.length - 1].t);
    const vMax = o.vMax !== undefined ? o.vMax : Math.max(1, ...points.map(p => p.v)) * 1.15;
    const vMin = o.vMin !== undefined ? o.vMin : Math.min(0, ...points.map(p => p.v)) * 1.15;
    const X = t => pad.l + (t / tMax) * (w - pad.l - pad.r);
    const Y = v => h - pad.b - ((v - vMin) / (vMax - vMin)) * (h - pad.t - pad.b);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050a12';
    ctx.fillRect(0, 0, w, h);

    // Gridlines
    const tStep = niceStep(tMax), vStep = niceStep(vMax - vMin);
    ctx.strokeStyle = 'rgba(36,52,79,.9)';
    ctx.fillStyle = '#5f7190';
    ctx.font = '11px ui-monospace, monospace';
    ctx.lineWidth = 1;
    for (let t = 0; t <= tMax + 1e-9; t += tStep) {
      ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), h - pad.b); ctx.stroke();
      ctx.fillText(String(+t.toFixed(2)), X(t) - 8, h - pad.b + 15);
    }
    for (let v = Math.ceil(vMin / vStep) * vStep; v <= vMax + 1e-9; v += vStep) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(String(+v.toFixed(2)), 8, Y(v) + 4);
    }

    // Shaded area under the curve: teal above the axis, rose below.
    if (o.shade !== false) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const negative = (a.v + b.v) / 2 < 0;
        ctx.fillStyle = negative ? 'rgba(255,107,129,.20)' : 'rgba(47,214,195,.16)';
        ctx.beginPath();
        ctx.moveTo(X(a.t), Y(0));
        ctx.lineTo(X(a.t), Y(a.v));
        ctx.lineTo(X(b.t), Y(b.v));
        ctx.lineTo(X(b.t), Y(0));
        ctx.closePath();
        ctx.fill();
      }
    }

    // Axes
    ctx.strokeStyle = '#93a4c0';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l, Y(0)); ctx.lineTo(w - pad.r, Y(0)); ctx.stroke();

    // The line itself
    ctx.strokeStyle = o.colour || ACCENT;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.v)) : ctx.moveTo(X(p.t), Y(p.v))));
    ctx.stroke();

    if (o.marker) {
      ctx.fillStyle = '#ffc24a';
      ctx.beginPath(); ctx.arc(X(o.marker.t), Y(o.marker.v), 6, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#93a4c0';
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.fillText('v / m s⁻¹', 8, 14);
    ctx.fillText('t / s', w - pad.r - 26, h - 8);
    return { X, Y };
  }

  function niceStep(span) {
    const raw = span / 6;
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  }

  /* ------------------------------ task 1: docking ------------------------ */

  const LEVELS = [
    { target: 120, aMax: 3.0, tMax: 30, vCap: 14, dockSpeed: 0.0, note: 'Routine approach to Beacon Station.' },
    { target: 250, aMax: 2.0, tMax: 42, vCap: 16, dockSpeed: 0.0, note: 'Heavier load: the hull will not take more than 2.0 m s⁻².' },
    { target: 400, aMax: 2.5, tMax: 45, vCap: 20, dockSpeed: 0.0, note: 'Long run, tight clock. Cruise pays for itself.' }
  ];

  function docking(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(0, 3);
      run.brief('Task 1 — <strong>Docking sequence.</strong> Shape the ship\'s velocity–time graph so that the <strong>area under it</strong> equals the distance to the dock, and so the ship arrives at rest. The <strong>gradient</strong> of each sloping part is the acceleration — go over the hull limit and the clamps shear off.');

      let level = 0, marks = 0;

      const { cnv, ctx, w, h } = UI.canvas(540, 300);
      const shipCanvas = UI.canvas(540, 110);
      run.stage.append(
        el('div.canvas-wrap', null, cnv),
        el('div.canvas-wrap.mt', null, shipCanvas.cnv)
      );
      const readouts = UI.readout({
        area:  { label: 'Area = s' },
        a1:    { label: 'Gradient a₁' },
        a3:    { label: 'Gradient a₃' },
        time:  { label: 'Total time' }
      });
      run.stage.append(readouts.wrap);

      const panel = el('div.panel');
      run.side.append(panel);

      let sliders, flying = null, status;

      function profile() {
        const v = sliders.v.value, t1 = sliders.t1.value, t2 = sliders.t2.value, t3 = sliders.t3.value;
        return [
          { t: 0, v: 0 },
          { t: t1, v },
          { t: t1 + t2, v },
          { t: t1 + t2 + t3, v: 0 }
        ];
      }

      function analyse() {
        const pts = profile();
        const v = sliders.v.value, t1 = sliders.t1.value, t3 = sliders.t3.value;
        const total = pts[3].t;
        return {
          pts,
          displacement: Physics.areaUnder(pts),
          a1: t1 > 0 ? v / t1 : (v > 0 ? Infinity : 0),
          a3: t3 > 0 ? -v / t3 : (v > 0 ? -Infinity : 0),
          totalTime: total
        };
      }

      function refresh() {
        const L = LEVELS[level];
        const a = analyse();
        readouts.set('area', `${Physics.sig(a.displacement, 4)} m`);
        readouts.set('a1', isFinite(a.a1) ? `${Physics.fix(a.a1, 2)} m s⁻²` : '∞');
        readouts.set('a3', isFinite(a.a3) ? `${Physics.fix(a.a3, 2)} m s⁻²` : '−∞');
        readouts.set('time', `${Physics.fix(a.totalTime, 1)} s`);

        const missBy = a.displacement - L.target;
        const okDist = Math.abs(missBy) <= Math.max(2, L.target * 0.01);
        const okAcc = Math.abs(a.a1) <= L.aMax + 1e-9 && Math.abs(a.a3) <= L.aMax + 1e-9;
        const okTime = a.totalTime <= L.tMax + 1e-9;

        status.innerHTML = '';
        status.append(
          chip(`distance ${okDist ? '✓' : (missBy > 0 ? `${Physics.sig(missBy, 2)} m long` : `${Physics.sig(-missBy, 2)} m short`)}`, okDist),
          chip(`a ≤ ${L.aMax} m s⁻² ${okAcc ? '✓' : '✗'}`, okAcc),
          chip(`t ≤ ${L.tMax} s ${okTime ? '✓' : '✗'}`, okTime)
        );
        launchBtn.disabled = !!flying;
        drawVT(ctx, w, h, a.pts, { tMax: L.tMax, vMax: L.vCap * 1.1, vMin: 0, colour: ACCENT });
        if (!flying) drawShip(0, 0);
        return { a, okDist, okAcc, okTime, ok: okDist && okAcc && okTime };
      }

      function chip(text, on) {
        return el('span.chip' + (on ? '.chip--on' : ''), null, text);
      }

      function drawShip(x, v) {
        const L = LEVELS[level];
        const c = shipCanvas.ctx, W = shipCanvas.w, H = shipCanvas.h;
        c.clearRect(0, 0, W, H);
        c.fillStyle = '#050a12'; c.fillRect(0, 0, W, H);

        const trackY = H / 2 + 6;
        const left = 40, right = W - 60;
        const px = left + Math.max(0, Math.min(1.15, x / L.target)) * (right - left);

        // Dock
        c.strokeStyle = '#24344f'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(left, trackY); c.lineTo(right, trackY); c.stroke();
        c.fillStyle = '#ffc24a';
        c.fillRect(right - 3, trackY - 22, 6, 44);
        c.font = '600 11px ui-monospace, monospace';
        c.fillText('DOCK', right - 16, trackY - 30);
        c.fillStyle = '#5f7190';
        c.fillText(`${L.target} m`, left, trackY + 34);

        // Ship
        c.fillStyle = Math.abs(x - L.target) < 2 ? '#5ce08a' : '#e8eef8';
        c.beginPath();
        c.moveTo(px + 15, trackY);
        c.lineTo(px - 11, trackY - 9);
        c.lineTo(px - 11, trackY + 9);
        c.closePath(); c.fill();
        if (v > 0.2) {                      // exhaust plume while thrusting
          c.fillStyle = 'rgba(47,214,195,.7)';
          c.beginPath();
          c.moveTo(px - 11, trackY - 4);
          c.lineTo(px - 11 - Math.min(22, v * 1.6), trackY);
          c.lineTo(px - 11, trackY + 4);
          c.closePath(); c.fill();
        }
        c.fillStyle = '#93a4c0';
        c.font = '600 11px ui-monospace, monospace';
        c.fillText(`x = ${Physics.fix(x, 1)} m   v = ${Physics.fix(v, 1)} m s⁻¹`, left, 18);
      }

      /** Fly the profile the player drew, integrating it exactly. */
      function launch() {
        const L = LEVELS[level];
        const check = refresh();
        const a = check.a;
        if (flying) return;

        flying = { t: 0 };
        launchBtn.disabled = true;
        const anim = Zone.loop(dt => {
          flying.t += dt * 1.6;
          const t = Math.min(flying.t, a.totalTime);
          const vNow = velocityAt(a, t);
          const xNow = Physics.areaUnder(clipProfile(a.pts, t));
          drawVT(ctx, w, h, a.pts, { tMax: L.tMax, vMax: L.vCap * 1.1, vMin: 0, colour: ACCENT, marker: { t, v: vNow } });
          drawShip(xNow, vNow);
          if (t >= a.totalTime) {
            anim.stop();
            flying = null;
            settle(check, xNow);
          }
        });
      }

      function settle(check, finalX) {
        const L = LEVELS[level];
        const err = finalX - L.target;
        if (check.ok) {
          marks++;
          Game.addXp(90);
          Game.awardBadge('areahunter');
          UI.modal('Docked ✓', el('div', null,
            el('p', { html: `Clamps engaged with <strong>${Physics.sig(Math.abs(err), 2)} m</strong> to spare.` }),
            el('p.small.muted', { html: `The area under your graph was ${Physics.sig(check.a.displacement, 4)} m — that area <em>is</em> the displacement. Your gradients were ${Physics.fix(check.a.a1, 2)} and ${Physics.fix(check.a.a3, 2)} m s⁻², both inside the ${L.aMax} m s⁻² hull limit.` })
          ), [{ label: level < LEVELS.length - 1 ? 'Next approach ▶' : 'Finish task ▶', primary: true, onClick: nextLevel }]);
        } else {
          const reasons = [];
          if (!check.okDist) reasons.push(err > 0 ? `you overshot by ${Physics.sig(err, 2)} m — the area under your graph is too big` : `you stopped ${Physics.sig(-err, 2)} m short — the area under your graph is too small`);
          if (!check.okAcc) reasons.push(`a gradient exceeded ${L.aMax} m s⁻² — make that sloping section last longer`);
          if (!check.okTime) reasons.push(`the run took ${Physics.fix(check.a.totalTime, 1)} s, over the ${L.tMax} s limit`);
          UI.modal('Approach aborted', el('div', null,
            el('p', { html: `Because ${reasons.join(', and ')}.` }),
            el('p.small.muted', { html: 'Area of the whole shape = ½·t₁·v + t₂·v + ½·t₃·v. Adjust and try again — attempts are free.' })
          ), [{ label: 'Adjust profile', primary: true }]);
          refresh();
        }
      }

      function nextLevel() {
        level++;
        if (level >= LEVELS.length) {
          run.award(marks, LEVELS.length);
          resolve();
          return;
        }
        buildControls();
      }

      function buildControls() {
        const L = LEVELS[level];
        panel.innerHTML = '';
        status = el('div.chips');
        sliders = {
          v:  UI.slider({ label: 'Cruise velocity v', min: 0, max: L.vCap, step: 0.5, value: Math.min(8, L.vCap), unit: 'm s⁻¹', onInput: refresh }),
          t1: UI.slider({ label: 'Speed-up time t₁', min: 0, max: 20, step: 0.5, value: 5, unit: 's', onInput: refresh }),
          t2: UI.slider({ label: 'Cruise time t₂',   min: 0, max: 30, step: 0.5, value: 5, unit: 's', onInput: refresh }),
          t3: UI.slider({ label: 'Slow-down time t₃', min: 0, max: 20, step: 0.5, value: 5, unit: 's', onInput: refresh })
        };
        panel.append(
          el('div.eyebrow', null, `Approach ${level + 1} of ${LEVELS.length}`),
          el('p.small', { html: `<strong>${L.note}</strong><br>Dock at <strong>${L.target} m</strong>. Hull limit <strong>${L.aMax} m s⁻²</strong>. Finish inside <strong>${L.tMax} s</strong>, at rest.` }),
          status,
          sliders.v.wrap, sliders.t1.wrap, sliders.t2.wrap, sliders.t3.wrap,
          launchBtn
        );
        refresh();
      }

      const launchBtn = el('button.btn.btn--primary.btn--wide', { type: 'button', onClick: launch }, '🚀 Fly this profile');
      buildControls();
    });
  }

  /** Velocity at time t on a piecewise-linear profile. */
  function velocityAt(a, t) {
    const pts = a.pts;
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i].t) {
        const span = pts[i].t - pts[i - 1].t;
        if (span <= 0) return pts[i].v;
        const f = (t - pts[i - 1].t) / span;
        return pts[i - 1].v + (pts[i].v - pts[i - 1].v) * f;
      }
    }
    return pts[pts.length - 1].v;
  }

  /** The profile truncated at time t, so its area is the displacement so far. */
  function clipProfile(pts, t) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].t <= t) { out.push(pts[i]); continue; }
      const prev = pts[i - 1];
      if (!prev) break;
      const f = (t - prev.t) / (pts[i].t - prev.t);
      out.push({ t, v: prev.v + (pts[i].v - prev.v) * f });
      break;
    }
    if (out.length < 2) out.push({ t, v: pts[0].v });
    return out;
  }

  /* ------------------------------ task 2: telemetry ---------------------- */

  /** A three-phase graph whose last phase may dip below the axis. */
  function makeTelemetry() {
    const v1 = 2 * (2 + Math.floor(Math.random() * 6));        // 4–14
    const t1 = 2 + Math.floor(Math.random() * 4);              // 2–5
    const t2 = 2 + Math.floor(Math.random() * 6);              // 2–7
    const t3 = 2 + Math.floor(Math.random() * 4);
    const dipsBelow = Math.random() < 0.5;
    const v3 = dipsBelow ? -v1 / 2 : 0;
    const pts = [
      { t: 0, v: 0 },
      { t: t1, v: v1 },
      { t: t1 + t2, v: v1 },
      { t: t1 + t2 + t3, v: v3 }
    ];
    return { pts, v1, t1, t2, t3, v3 };
  }

  function telemetry(run) {
    return new Promise(resolve => {
      run.clear();
      run.setStep(1, 3);
      run.brief('Task 2 — <strong>Telemetry.</strong> This is the graph the ship actually flew. Read it: gradients give accelerations, areas give displacements. Watch for any part below the axis.');

      const T = makeTelemetry();
      const { cnv, ctx, w, h } = UI.canvas(540, 340);
      drawVT(ctx, w, h, T.pts, {});
      run.stage.append(el('div.canvas-wrap', null, cnv));

      const tEnd = T.pts[3].t;
      const s = Physics.areaUnder(T.pts);
      const d = Physics.distanceUnder(T.pts);
      const a1 = T.v1 / T.t1;
      const a3 = (T.v3 - T.v1) / T.t3;

      run.stage.append(el('div.panel.mt', null,
        el('div.eyebrow', null, 'Flight phases'),
        el('table.data', { html: `
          <tr><th>Phase</th><th>From</th><th>To</th><th>v at start</th><th>v at end</th></tr>
          <tr><td>1</td><td class="num">0 s</td><td class="num">${T.t1} s</td><td class="num">0</td><td class="num">${T.v1}</td></tr>
          <tr><td>2</td><td class="num">${T.t1} s</td><td class="num">${T.t1 + T.t2} s</td><td class="num">${T.v1}</td><td class="num">${T.v1}</td></tr>
          <tr><td>3</td><td class="num">${T.t1 + T.t2} s</td><td class="num">${tEnd} s</td><td class="num">${T.v1}</td><td class="num">${T.v3}</td></tr>` })
      ));

      const qs = [
        {
          type: 'num', badge: 'gradient',
          stem: 'Determine the <strong>acceleration in phase 1</strong>.',
          answer: a1, unit: 'm s⁻²', tol: 0.03,
          hint: 'Gradient = Δv / Δt.',
          work: `a = Δv/Δt = (${T.v1} − 0) / ${T.t1} = ${Physics.sig(a1, 3)} m s⁻²`
        },
        {
          type: 'num', badge: 'gradient',
          stem: 'Determine the <strong>acceleration in phase 3</strong>. Include the sign.',
          answer: a3, unit: 'm s⁻²', tol: 0.03, absTol: 0.05,
          work: `a = (${T.v3} − ${T.v1}) / ${T.t3} = ${Physics.sig(a3, 3)} m s⁻²\nNegative means "directed in the negative direction", not automatically "slowing".`
        },
        {
          type: 'num', badge: 'areahunter',
          stem: 'Determine the <strong>total displacement</strong> over the whole ' + tEnd + ' s.',
          answer: s, unit: 'm', tol: 0.03,
          hint: T.v3 < 0 ? 'Part of phase 3 is below the axis — that area is negative.' : 'Split it into a triangle, a rectangle and a triangle.',
          work: `Phase 1: ½ × ${T.t1} × ${T.v1} = ${Physics.sig(T.t1 * T.v1 / 2, 3)} m\n`
              + `Phase 2: ${T.t2} × ${T.v1} = ${Physics.sig(T.t2 * T.v1, 3)} m\n`
              + `Phase 3: ${Physics.sig(((T.v1 + T.v3) / 2) * T.t3, 3)} m${T.v3 < 0 ? '  (the part below the axis is negative)' : ''}\n`
              + `Total displacement = ${Physics.sig(s, 4)} m`
        },
        {
          type: 'num',
          stem: 'Determine the <strong>average velocity</strong> for the whole flight.',
          answer: s / tEnd, unit: 'm s⁻¹', tol: 0.04,
          work: `average velocity = total displacement ÷ total time = ${Physics.sig(s, 4)} ÷ ${tEnd} = ${Physics.sig(s / tEnd, 3)} m s⁻¹`
              + (T.v3 < 0 ? `\nNote the distance is ${Physics.sig(d, 4)} m, which is larger — areas below the axis add to the distance but subtract from the displacement.` : '')
        }
      ];

      Shell.askAll(run.side, qs, { title: 'Telemetry read-out', xp: 30 }).then(correct => {
        run.award(correct, qs.length);
        resolve();
      });
    });
  }

  /* ------------------------------ zone entry ----------------------------- */

  async function render(root) {
    const run = Shell.zone(root, META);
    await docking(run);
    await telemetry(run);

    run.clear();
    run.setStep(2, 3);
    run.brief('Task 3 — <strong>Flight check.</strong> The graph-reading traps that catch most candidates.');
    run.stage.append(el('div.panel', null,
      el('div.eyebrow', null, 'S2 key ideas'),
      el('ul.tight', { html: `
        <li>An s–t graph is <strong>not a picture of the path</strong>.</li>
        <li>Instantaneous velocity = gradient of the <strong>tangent</strong>.</li>
        <li>Area under v–t = displacement; below the axis it is negative.</li>
        <li>Area under a–t = <strong>Δv</strong>; add u to get v.</li>
        <li>A flat v–t line means constant velocity, not stopped.</li>` })
    ));

    const qs = Questions.sample(Questions.banks.s2, 4);
    const correct = await Shell.askAll(run.side, qs, { title: 'Licence check', xp: 30 });
    run.award(correct, qs.length);
    run.setStep(3, 3);
    await run.finish();
  }

  return { META, render, drawVT };
})();
