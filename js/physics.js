/* ==========================================================================
   physics.js — the one place the physics lives.
   Every zone calls into here, so a student who checks a number against the
   deck gets the same answer the game used.  g = 9.81 m s⁻² throughout,
   as stated on slide 1 of both decks.
   ========================================================================== */

const Physics = (() => {
  'use strict';

  const G = 9.81;

  /* ------------------------------ formatting ---------------------------- */

  /** Round to n significant figures and print without trailing noise. */
  function sig(x, n) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    const digits = n || 3;
    const rounded = Number(x.toPrecision(digits));
    if (Math.abs(rounded) >= 1e5 || (Math.abs(rounded) < 1e-3 && rounded !== 0)) {
      return rounded.toExponential(digits - 1).replace('e', ' × 10^');
    }
    return String(rounded);
  }

  const fix = (x, n) => (isFinite(x) ? x.toFixed(n === undefined ? 1 : n) : '—');
  const rad = deg => (deg * Math.PI) / 180;
  const deg = r => (r * 180) / Math.PI;

  /* ------------------------------ vectors ------------------------------- */

  const mag = (x, y) => Math.hypot(x, y);

  /** Direction of (x, y) in degrees above the +x axis, in (-180, 180]. */
  const dir = (x, y) => deg(Math.atan2(y, x));

  /** Resolve a vector given magnitude and angle above the horizontal. */
  const resolve = (m, angleDeg) => ({ x: m * Math.cos(rad(angleDeg)), y: m * Math.sin(rad(angleDeg)) });

  /* ------------------------------ suvat --------------------------------- */

  /* The four equations of motion, exactly as the data booklet lists them.
     Each takes the three quantities it needs and returns the fourth. */
  const suvat = {
    // s = ((u + v) / 2) t        — the one with no a
    sFromUVt: (u, v, t) => ((u + v) / 2) * t,
    // v = u + at                 — the one with no s
    vFromUAt: (u, a, t) => u + a * t,
    // s = ut + ½at²              — the one with no v
    sFromUAt: (u, a, t) => u * t + 0.5 * a * t * t,
    // v² = u² + 2as              — the one with no t
    vFromUAs: (u, a, s) => {
      const vsq = u * u + 2 * a * s;
      return vsq < 0 ? NaN : Math.sqrt(vsq);
    }
  };

  /**
   * Positive root of s = ut + ½at² for t, i.e. the time to reach
   * displacement s starting at u with uniform acceleration a.
   * Returns NaN when the displacement is never reached.
   */
  function timeToDisplacement(s, u, a) {
    if (Math.abs(a) < 1e-12) return Math.abs(u) < 1e-12 ? NaN : s / u;
    const disc = u * u + 2 * a * s;
    if (disc < 0) return NaN;
    const root = Math.sqrt(disc);
    const t1 = (-u + root) / a;
    const t2 = (-u - root) / a;
    const valid = [t1, t2].filter(t => t > 1e-9).sort((p, q) => p - q);
    return valid.length ? valid[0] : NaN;
  }

  /* ------------------------------ projectiles (no drag) ------------------ */

  /**
   * Analytic projectile launched at speed u, angle θ above the horizontal,
   * from height h above the landing plane.  Up is positive.
   */
  function projectile(u, angleDeg, h) {
    const height = h || 0;
    const { x: ux, y: uy } = resolve(u, angleDeg);
    // Landing: vertical displacement of -height relative to launch.
    const tFlight = timeToDisplacement(-height, uy, -G);
    const apex = uy > 0 ? (uy * uy) / (2 * G) : 0;       // above the launch point
    return {
      ux, uy,
      timeOfFlight: tFlight,
      range: ux * tFlight,
      maxHeight: height + apex,        // above the ground
      apexAboveLaunch: apex,
      timeToApex: uy > 0 ? uy / G : 0,
      landingSpeed: Math.hypot(ux, uy + -G * tFlight),
      landingAngle: dir(ux, uy - G * tFlight),
      at(t) {
        return {
          x: ux * t,
          y: height + uy * t - 0.5 * G * t * t,
          vx: ux,
          vy: uy - G * t
        };
      }
    };
  }

  /** Sampled flight path, for drawing. */
  function trajectory(u, angleDeg, h, samples) {
    const p = projectile(u, angleDeg, h);
    const n = samples || 90;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const s = p.at((p.timeOfFlight * i) / n);
      pts.push({ x: s.x, y: s.y, t: (p.timeOfFlight * i) / n, vx: s.vx, vy: s.vy });
    }
    return { path: pts, summary: p };
  }

  /* ------------------------------ fluid resistance ----------------------- */

  /*
   * Drag is modelled as quadratic in speed and opposite to the velocity:
   *     F_drag = -k |v| v,        a_drag = -(k/m) |v| v
   * Rather than ask a student for k, the model is parameterised by the
   * terminal speed vT, because at terminal speed drag balances weight:
   *     k/m = g / vT²
   * so a heavier or more streamlined body simply has a larger vT — exactly
   * the story the deck tells in S5.
   */

  function dragCoefficient(terminalSpeed) {
    return terminalSpeed > 0 ? G / (terminalSpeed * terminalSpeed) : 0;
  }

  /** Acceleration of a body at velocity (vx, vy) with drag parameter c = k/m. */
  function accelWithDrag(vx, vy, c) {
    const speed = Math.hypot(vx, vy);
    return { ax: -c * speed * vx, ay: -G - c * speed * vy };
  }

  /** One RK4 step of the 2D drag equations. Up is positive. */
  function stepDrag(state, dt, c) {
    const deriv = s => {
      const a = accelWithDrag(s.vx, s.vy, c);
      return { x: s.vx, y: s.vy, vx: a.ax, vy: a.ay };
    };
    const add = (s, d, f) => ({
      x: s.x + d.x * f, y: s.y + d.y * f, vx: s.vx + d.vx * f, vy: s.vy + d.vy * f
    });
    const k1 = deriv(state);
    const k2 = deriv(add(state, k1, dt / 2));
    const k3 = deriv(add(state, k2, dt / 2));
    const k4 = deriv(add(state, k3, dt));
    return {
      x:  state.x  + (dt / 6) * (k1.x  + 2 * k2.x  + 2 * k3.x  + k4.x),
      y:  state.y  + (dt / 6) * (k1.y  + 2 * k2.y  + 2 * k3.y  + k4.y),
      vx: state.vx + (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
      vy: state.vy + (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy)
    };
  }

  /**
   * Full flight with drag, from launch to the moment y returns to 0.
   * terminalSpeed = 0 reproduces the vacuum case exactly.
   */
  function dragFlight(u, angleDeg, h, terminalSpeed, dt) {
    const c = dragCoefficient(terminalSpeed);
    const { x: ux, y: uy } = resolve(u, angleDeg);
    const step = dt || 0.002;
    let s = { x: 0, y: h || 0, vx: ux, vy: uy };
    const path = [{ x: s.x, y: s.y, t: 0, vx: s.vx, vy: s.vy }];
    let t = 0, maxHeight = s.y, guard = 0;

    while (guard++ < 200000) {
      const next = stepDrag(s, step, c);
      t += step;
      if (next.y > maxHeight) maxHeight = next.y;
      if (next.y <= 0 && s.y > 0) {
        // Linear interpolation onto the ground for a clean landing point.
        const f = s.y / (s.y - next.y);
        const land = {
          x: s.x + (next.x - s.x) * f,
          y: 0,
          t: t - step + step * f,
          vx: s.vx + (next.vx - s.vx) * f,
          vy: s.vy + (next.vy - s.vy) * f
        };
        path.push(land);
        return {
          path,
          range: land.x,
          timeOfFlight: land.t,
          maxHeight,
          landingSpeed: Math.hypot(land.vx, land.vy),
          landingAngle: dir(land.vx, land.vy)
        };
      }
      s = next;
      path.push({ x: s.x, y: s.y, t, vx: s.vx, vy: s.vy });
    }
    return { path, range: s.x, timeOfFlight: t, maxHeight, landingSpeed: Math.hypot(s.vx, s.vy), landingAngle: dir(s.vx, s.vy) };
  }

  /* ------------------------------ graph areas ---------------------------- */

  /**
   * Signed area under a piecewise-linear velocity–time graph, i.e. the
   * displacement.  Points are [{t, v}, ...] in increasing t.
   */
  function areaUnder(points) {
    let area = 0;
    for (let i = 1; i < points.length; i++) {
      const dt = points[i].t - points[i - 1].t;
      area += ((points[i].v + points[i - 1].v) / 2) * dt;
    }
    return area;
  }

  /** Total path length, i.e. the distance: areas below the axis count positive. */
  function distanceUnder(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const [t0, v0] = [points[i - 1].t, points[i - 1].v];
      const [t1, v1] = [points[i].t, points[i].v];
      const dt = t1 - t0;
      if (dt <= 0) continue;
      if (v0 * v1 >= 0) {
        total += Math.abs(((v0 + v1) / 2) * dt);
      } else {
        // The segment crosses the axis: split it at the zero crossing.
        const tc = dt * (Math.abs(v0) / (Math.abs(v0) + Math.abs(v1)));
        total += Math.abs(v0 * tc / 2) + Math.abs(v1 * (dt - tc) / 2);
      }
    }
    return total;
  }

  return {
    G, sig, fix, rad, deg, mag, dir, resolve,
    suvat, timeToDisplacement,
    projectile, trajectory,
    dragCoefficient, accelWithDrag, stepDrag, dragFlight,
    areaUnder, distanceUnder
  };
})();

/* ==========================================================================
   Zone — animation-loop registry so navigating away always stops the physics.
   ========================================================================== */

const Zone = (() => {
  'use strict';
  let handles = [];

  /** Run fn(dtSeconds, elapsedSeconds) each frame until the screen changes. */
  function loop(fn) {
    let last = performance.now();
    let start = last;
    let alive = true;
    const tick = now => {
      if (!alive) return;
      const dt = Math.min((now - last) / 1000, 0.05);   // clamp after a tab switch
      last = now;
      fn(dt, (now - start) / 1000);
      handle.raf = requestAnimationFrame(tick);
    };
    const handle = {
      raf: requestAnimationFrame(tick),
      stop() { alive = false; cancelAnimationFrame(this.raf); }
    };
    handles.push(handle);
    return handle;
  }

  function stopAll() {
    handles.forEach(h => h.stop());
    handles = [];
  }

  return { loop, stopAll };
})();
