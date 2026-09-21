/* ==========================================================================
   questions.js — the question bank, taken from the two A.1 decks.
   The five HINGE questions and every "common misconception" row appear here,
   because those are the ideas the decks say to check before moving on.
   ========================================================================== */

const Questions = (() => {
  'use strict';

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /** Fisher–Yates, then take n. Leaves the source bank untouched. */
  function sample(arr, n) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(n, copy.length));
  }

  /* ------------------------------ S1: describing motion ------------------ */

  const s1 = [
    {
      type: 'mcq',
      tag: 'HINGE',
      badge: 'pathfinder',
      stem: 'A runner completes one <strong>full lap</strong> of a 400 m track in 80 s. What is her <strong>average velocity</strong>?',
      options: [
        { text: 'Zero' },
        { text: '5.0 m s⁻¹', why: 'That is her average <em>speed</em> — distance ÷ time. Velocity uses displacement.' },
        { text: '5.0 m s⁻¹ in the direction she faces at the finish', why: 'That uses the direction at one instant, not the average over the whole lap.' },
        { text: 'It cannot be found without a direction', why: 'Zero displacement gives zero velocity, and zero needs no direction.' }
      ],
      answer: 0,
      work: 'One full lap → she finishes where she started → displacement = 0.\naverage velocity = displacement ÷ time = 0 ÷ 80 = 0'
    },
    {
      type: 'mcq',
      badge: 'signmaster',
      stem: 'Take right as positive. A trolley moves <strong>left</strong> and has a <strong>positive</strong> acceleration. Is it speeding up or slowing down?',
      options: [
        { text: 'Slowing down' },
        { text: 'Speeding up', why: 'v is negative and a is positive — opposite signs, so the trolley is slowing.' },
        { text: 'Moving at constant speed', why: 'A non-zero acceleration always changes the velocity.' },
        { text: 'It reverses instantly', why: 'It slows first, and only then could it reverse.' }
      ],
      answer: 0,
      work: 'Same signs → speeding up.  Opposite signs → slowing down.\nHere v < 0 and a > 0, so the trolley slows down.'
    },
    {
      type: 'mcq',
      stem: 'Can the <strong>average speed</strong> of a journey ever be <strong>less than</strong> the magnitude of its average velocity?',
      options: [
        { text: 'No — distance ≥ |displacement|, and both are divided by the same time' },
        { text: 'Yes, if the object turns back on itself', why: 'Turning back makes the distance <em>larger</em>, so the average speed grows, not shrinks.' },
        { text: 'Yes, on a circular path', why: 'On a circle the distance is far larger than the displacement, so average speed is larger.' },
        { text: 'Only if the object stops part way', why: 'Stopping adds time to both, and never makes the distance smaller than the displacement.' }
      ],
      answer: 0,
      work: 'distance ≥ |displacement| always.\nThey are equal only for straight-line motion without turning back.'
    },
    {
      type: 'mcq',
      stem: "A car's speedometer reads 50 km h⁻¹. This reading is:",
      options: [
        { text: 'an instantaneous speed' },
        { text: 'an average speed', why: 'It shows the value at this moment, and it changes as the driver brakes.' },
        { text: 'an instantaneous velocity', why: 'The dial gives no direction, so it cannot be a velocity.' },
        { text: 'an average velocity', why: 'No direction and not averaged over the journey.' }
      ],
      answer: 0,
      work: '50 km h⁻¹ = 50 000 ÷ 3600 = 14 m s⁻¹, at this instant, with no direction given.'
    },
    {
      type: 'mcq',
      badge: 'signmaster',
      stem: 'A car travels at a <strong>constant speed</strong> around a roundabout. Which statement is correct?',
      options: [
        { text: 'Its velocity changes, so it is accelerating' },
        { text: 'Its velocity is constant, so it is not accelerating', why: 'The direction of travel keeps changing, and velocity includes direction.' },
        { text: 'Its acceleration is zero because the speed is constant', why: 'Acceleration is the rate of change of <em>velocity</em>, not of speed.' },
        { text: 'Its displacement is constant', why: 'The car keeps moving, so its position — and its displacement — keeps changing.' }
      ],
      answer: 0,
      work: 'A change of direction at constant speed is still a change of velocity,\nso there is an acceleration (towards the centre).'
    },
    {
      type: 'num',
      stem: 'A cyclist rides 3.0 km east, then 4.0 km west, in 20 minutes. Calculate the <strong>magnitude of the average velocity</strong>, in m s⁻¹.',
      answer: 1000 / 1200,
      unit: 'm s⁻¹',
      tol: 0.04,
      hint: 'Net displacement first, then convert km → m and minutes → s.',
      work: 'Displacement = 3.0 − 4.0 = −1.0 km = 1000 m west\ntime = 20 × 60 = 1200 s\n|average velocity| = 1000 ÷ 1200 = 0.83 m s⁻¹ west'
    },
    {
      type: 'num',
      stem: 'A car speeds up from 12 m s⁻¹ to 30 m s⁻¹ in 6.0 s. Calculate its <strong>acceleration</strong>.',
      answer: 3.0,
      unit: 'm s⁻²',
      work: 'a = Δv / Δt = (30 − 12) / 6.0 = 3.0 m s⁻²'
    },
    {
      type: 'num',
      stem: 'Convert <strong>72 km h⁻¹</strong> into m s⁻¹.',
      answer: 20,
      unit: 'm s⁻¹',
      work: '72 × 1000 ÷ 3600 = 20 m s⁻¹'
    }
  ];

  /* ------------------------------ S2: motion graphs ---------------------- */

  const s2 = [
    {
      type: 'mcq',
      tag: 'HINGE',
      badge: 'areahunter',
      stem: 'A trolley\'s velocity falls steadily from <strong>+6.0 m s⁻¹ at t = 0</strong> to <strong>−6.0 m s⁻¹ at t = 4.0 s</strong>. What is its <strong>displacement</strong> after 4.0 s?',
      options: [
        { text: '0' },
        { text: '12 m', why: 'That is the <em>distance</em> — the two areas added as sizes.' },
        { text: '24 m', why: 'That treats the graph as a rectangle, 6 × 4.' },
        { text: '−12 m', why: 'That counts only the area below the axis.' }
      ],
      answer: 0,
      work: 'Above the axis: ½ × 2.0 × 6.0 = +6.0 m\nBelow the axis: ½ × 2.0 × 6.0 = −6.0 m\nDisplacement = +6.0 − 6.0 = 0   (distance = 12 m)'
    },
    {
      type: 'mcq',
      badge: 'gradient',
      stem: 'On a <strong>displacement–time</strong> graph, how do you find the <strong>instantaneous velocity</strong> at t = 2.0 s?',
      options: [
        { text: 'Draw a tangent at t = 2.0 s and find its gradient' },
        { text: 'Divide the displacement at 2.0 s by 2.0 s', why: 'That gives the <em>average</em> velocity from the start, not the value at that instant.' },
        { text: 'Read the value on the y-axis', why: 'The y-value is the displacement, not the velocity.' },
        { text: 'Find the area under the graph up to 2.0 s', why: 'Area under an s–t graph has units m s, which is not a useful quantity.' }
      ],
      answer: 0,
      work: 'Gradient of a tangent = instantaneous velocity.\nA chord between two points would give the average velocity over that interval.'
    },
    {
      type: 'mcq',
      badge: 'gradient',
      stem: 'A <strong>flat, horizontal line</strong> on a <strong>velocity–time</strong> graph at v = 8 m s⁻¹ means the body is:',
      options: [
        { text: 'moving at a constant 8 m s⁻¹, with zero acceleration' },
        { text: 'stopped', why: 'Stopped is a flat line at <em>v = 0</em>. This line sits at 8 m s⁻¹.' },
        { text: 'accelerating uniformly', why: 'A constant gradient that is not zero would be uniform acceleration; this gradient is zero.' },
        { text: 'at a constant position', why: 'It is moving, so its position keeps changing.' }
      ],
      answer: 0,
      work: 'Gradient of v–t = acceleration = 0, so the velocity is constant at 8 m s⁻¹.'
    },
    {
      type: 'mcq',
      badge: 'areahunter',
      stem: 'An object moving at 2.0 m s⁻¹ accelerates at 1.5 m s⁻² for 4.0 s. The area under its <strong>acceleration–time</strong> graph is 6.0. What does the 6.0 represent?',
      options: [
        { text: 'The change in velocity, so the final velocity is 8.0 m s⁻¹' },
        { text: 'The final velocity, 6.0 m s⁻¹', why: 'The area gives the <em>change</em> in velocity. You still have to add the initial velocity.' },
        { text: 'The displacement, 6.0 m', why: 'Area under a–t has units m s⁻² × s = m s⁻¹, a velocity, not a displacement.' },
        { text: 'The average velocity', why: 'Area under a–t is always a change in velocity, Δv.' }
      ],
      answer: 0,
      work: 'Area = a × t = 1.5 × 4.0 = 6.0 m s⁻¹ = Δv\nv = u + Δv = 2.0 + 6.0 = 8.0 m s⁻¹'
    },
    {
      type: 'mcq',
      stem: 'A displacement–time graph is a smooth hill shape. What does this tell you?',
      options: [
        { text: 'The body moved away, slowed, stopped, then came back — the graph is not a picture of the path' },
        { text: 'The body physically travelled over a hill', why: 'An s–t graph shows position against <em>time</em>, not a map of the route.' },
        { text: 'The body accelerated the whole time at a constant rate', why: 'The gradient falls to zero and then goes negative, so the velocity is changing sign.' },
        { text: 'The body was stationary at the peak for a long time', why: 'It is at rest for one instant only, where the gradient is zero.' }
      ],
      answer: 0,
      work: 'Gradient = velocity: positive, falling to zero at the peak, then negative.\nAn s–t graph is never a picture of the path.'
    },
    {
      type: 'num',
      badge: 'gradient',
      stem: 'On a displacement–time graph, the tangent drawn at t = 2.0 s passes through (1.0 s, 0 m) and (4.5 s, 7.0 m). Determine the <strong>instantaneous velocity</strong> at t = 2.0 s.',
      answer: 2.0,
      unit: 'm s⁻¹',
      work: 'gradient = Δy / Δx = (7.0 − 0) / (4.5 − 1.0) = 7.0 / 3.5 = 2.0 m s⁻¹'
    },
    {
      type: 'num',
      badge: 'areahunter',
      stem: 'A bus starts from rest, speeds up uniformly to 12 m s⁻¹ in 6.0 s, holds 12 m s⁻¹ for 10 s, then slows uniformly to rest in 4.0 s. Determine the total <strong>displacement</strong>.',
      answer: 180,
      unit: 'm',
      hint: 'The whole shape is a trapezium: ½(a + b) × h.',
      work: '½ × 6.0 × 12 = 36 m;  10 × 12 = 120 m;  ½ × 4.0 × 12 = 24 m\nTotal = 180 m   (check: ½(10 + 20) × 12 = 180 m ✓)'
    },
    {
      type: 'num',
      stem: 'A cyclist speeds up from 4.0 m s⁻¹ to 10 m s⁻¹ over 4.0 s. Determine the <strong>acceleration</strong>.',
      answer: 1.5,
      unit: 'm s⁻²',
      work: 'a = (10 − 4.0) / 4.0 = 1.5 m s⁻²  (the gradient of the v–t line)'
    }
  ];

  /* ------------------------------ S3: equations of motion ---------------- */

  const s3 = [
    {
      type: 'mcq',
      tag: 'HINGE',
      badge: 'topofflight',
      stem: 'A ball is thrown vertically upwards; air resistance is negligible. What is its <strong>acceleration at the highest point</strong>?',
      options: [
        { text: 'Zero', why: 'That confuses v = 0 with a = 0. Gravity never switches off.' },
        { text: '9.81 m s⁻² upwards', why: 'Nothing pushes the ball up after it leaves the hand — only weight acts.' },
        { text: '9.81 m s⁻² downwards' },
        { text: 'It changes direction at the top', why: 'The <em>velocity</em> changes direction; the acceleration does not.' }
      ],
      answer: 2,
      work: 'Only weight acts, so a = g = 9.81 m s⁻² downwards for the whole flight.\nThe v–t graph is a single straight line: one constant gradient.'
    },
    {
      type: 'mcq',
      badge: 'chooser',
      stem: 'A car has u = 16 m s⁻¹ and decelerates at 4.0 m s⁻² until it stops. <strong>Which equation</strong> should you use to find the distance?',
      options: [
        { text: 'v² = u² + 2as — no time is given or wanted' },
        { text: 's = ut + ½at²', why: 'This needs t, which you have not been given.' },
        { text: 'v = u + at', why: 'This has no s in it, so it cannot give you a distance directly.' },
        { text: 's = ((u + v)/2)t', why: 'This also needs t.' }
      ],
      answer: 0,
      work: 'List s, u, v, a, t. Here t is the one quantity missing and unwanted,\nso pick the equation without t: v² = u² + 2as\n0 = 16² + 2(−4.0)s  →  s = 256 / 8.0 = 32 m'
    },
    {
      type: 'mcq',
      badge: 'signmaster',
      stem: 'A stone is thrown <strong>up</strong> from a cliff and lands in the sea 30 m <strong>below</strong> the launch point. Taking up as positive, what are s and a for the whole flight?',
      options: [
        { text: 's = −30 m, a = −9.81 m s⁻² throughout' },
        { text: 's = +30 m, a = −9.81 m s⁻²', why: 'The stone finishes <em>below</em> where it started, so with up positive s is negative.' },
        { text: 's = −30 m, a = +9.81 m s⁻² going up then −9.81 m s⁻² coming down', why: 'g does not change sign. Only the velocity changes sign.' },
        { text: 's = −30 m, a = 0 at the top', why: 'a = g at every point, including the top.' }
      ],
      answer: 0,
      work: 'Choose up positive and keep it for the whole problem.\nFinishing below the start → s = −30 m.  a = −9.81 m s⁻² throughout.'
    },
    {
      type: 'mcq',
      stem: 'When do the four equations of motion apply?',
      options: [
        { text: 'Only when the acceleration is uniform, along a straight line' },
        { text: 'To any motion at all', why: 'They are derived from a straight v–t line, so they need constant acceleration.' },
        { text: 'Only to free fall', why: 'They apply to any uniformly accelerated straight-line motion, not just free fall.' },
        { text: 'Whenever the velocity is constant', why: 'They work then too, but that is only the special case a = 0.' }
      ],
      answer: 0,
      work: 'Uniform acceleration only. With drag the acceleration changes,\nso use graphs or data instead.'
    },
    {
      type: 'num',
      badge: 'chooser',
      stem: 'A cyclist accelerates uniformly from 2.0 m s⁻¹ to 8.0 m s⁻¹ over 30 m. Determine the <strong>acceleration</strong>.',
      answer: 1.0,
      unit: 'm s⁻²',
      hint: 'No time is given — which equation leaves t out?',
      work: 'v² = u² + 2as:  8.0² = 2.0² + 2a(30)\n64 = 4.0 + 60a  →  a = 1.0 m s⁻²'
    },
    {
      type: 'num',
      stem: 'A stone is dropped from rest from a bridge and hits the water 2.5 s later. Calculate the <strong>height of the bridge</strong>. (g = 9.81 m s⁻²)',
      answer: 30.66,
      unit: 'm',
      tol: 0.03,
      work: 's = ut + ½at² = 0 + ½ × 9.81 × 2.5² = 31 m'
    },
    {
      type: 'num',
      badge: 'topofflight',
      stem: 'A ball is thrown straight up at 20 m s⁻¹. Calculate its <strong>maximum height</strong>. (g = 9.81 m s⁻²)',
      answer: 20.39,
      unit: 'm',
      tol: 0.03,
      hint: 'At the top, v = 0.',
      work: 'v² = u² + 2as with v = 0:  0 = 20² − 2(9.81)s\ns = 400 / 19.62 = 20 m'
    },
    {
      type: 'num',
      stem: 'A train at 25 m s⁻¹ brakes uniformly and stops in 500 m. Calculate the <strong>magnitude of its acceleration</strong>.',
      answer: 0.625,
      unit: 'm s⁻²',
      tol: 0.03,
      work: 'v² = u² + 2as:  0 = 25² + 2a(500)\na = −625 / 1000 = −0.63 m s⁻², i.e. a deceleration of 0.63 m s⁻²'
    }
  ];

  /* ------------------------------ S4: projectiles ------------------------ */

  const s4 = [
    {
      type: 'mcq',
      tag: 'HINGE',
      badge: 'independence',
      stem: 'Two balls roll off the <strong>same bench</strong>, one at 4 m s⁻¹ and one at 8 m s⁻¹. Air resistance is negligible. Which statement is correct?',
      options: [
        { text: 'Both reach the floor at the same time' },
        { text: 'The faster ball takes half as long', why: 'Horizontal speed has no effect on the vertical motion.' },
        { text: 'The faster ball takes twice as long', why: 'A longer path does not mean a longer time here — the fall is what sets the time.' },
        { text: 'The faster ball lands first because it has more speed overall', why: 'Only the vertical part of the motion decides the time.' }
      ],
      answer: 0,
      work: 'Same height, both with uy = 0 and a = g → the same time to fall.\nThe faster ball simply lands twice as far away.'
    },
    {
      type: 'mcq',
      badge: 'topofflight',
      stem: 'A ball is kicked at 20 m s⁻¹, 35° above the horizontal. What is its <strong>velocity at the highest point</strong>?',
      options: [
        { text: '16 m s⁻¹ horizontally' },
        { text: 'Zero — it stops at the top', why: 'Only the <em>vertical</em> component is zero. The ball is still moving horizontally.' },
        { text: '11 m s⁻¹ vertically', why: 'That is uy at launch; at the top vy = 0.' },
        { text: '20 m s⁻¹ horizontally', why: 'The horizontal component is u cos 35° = 16 m s⁻¹, not the full 20 m s⁻¹.' }
      ],
      answer: 0,
      work: 'vx = u cos 35° = 20 × 0.819 = 16.4 m s⁻¹ (constant all flight)\nvy = 0 at the top, so v = 16 m s⁻¹ horizontally.'
    },
    {
      type: 'mcq',
      badge: 'independence',
      stem: 'With no fluid resistance, what happens to a projectile\'s <strong>horizontal velocity</strong> during the flight?',
      options: [
        { text: 'It stays constant — there is no horizontal force' },
        { text: 'It decreases steadily', why: 'That happens only when there is drag. In a vacuum, no horizontal force means no horizontal acceleration.' },
        { text: 'It decreases going up and increases coming down', why: 'That describes the <em>vertical</em> component.' },
        { text: 'It increases, because gravity speeds the ball up', why: 'Gravity acts straight down, so it changes only the vertical component.' }
      ],
      answer: 0,
      work: 'ax = 0, so vx = ux for the whole flight. Only vy changes.'
    },
    {
      type: 'mcq',
      stem: 'A drone flies horizontally at 6.0 m s⁻¹ and releases a parcel. Where is the drone when the parcel lands?',
      options: [
        { text: 'Directly above the parcel' },
        { text: 'Behind the parcel', why: 'Both keep the same horizontal velocity of 6.0 m s⁻¹, so neither gets ahead.' },
        { text: 'Ahead of the parcel', why: 'The parcel keeps the drone\'s horizontal velocity when released.' },
        { text: 'It depends on the height of release', why: 'Both cover the same horizontal distance in the same time, at any height.' }
      ],
      answer: 0,
      work: 'The parcel starts with the drone\'s horizontal velocity and keeps it (no drag).\nBoth travel 6.0 m every second, so the drone stays directly above.'
    },
    {
      type: 'mcq',
      stem: 'Is it true that <strong>45° always gives the greatest range</strong>?',
      options: [
        { text: 'No — only on level ground with no air resistance' },
        { text: 'Yes, always', why: 'Launch from a height, or add drag, and the best angle drops below 45°.' },
        { text: 'No — the best angle is always 60°', why: 'There is no single best angle; it depends on the launch height and on drag.' },
        { text: 'Yes, because the components are equal there', why: 'Equal components only maximise the range in the special level, drag-free case.' }
      ],
      answer: 0,
      work: 'Level ground, no drag → 45°.\nFrom a height, or with drag, the optimum angle is less than 45°.'
    },
    {
      type: 'num',
      badge: 'independence',
      stem: 'A ball rolls off a bench 1.20 m high at 3.0 m s⁻¹ horizontally. Calculate the <strong>time to reach the floor</strong>. (g = 9.81 m s⁻²)',
      answer: 0.4946,
      unit: 's',
      tol: 0.04,
      hint: 'Use the vertical column only: uy = 0.',
      work: 'Vertical (down positive): 1.20 = ½ × 9.81 × t²\nt² = 0.2447  →  t = 0.49 s\nThe 3.0 m s⁻¹ plays no part in this.'
    },
    {
      type: 'num',
      stem: 'A ball is launched from level ground at 12 m s⁻¹, 60° above the horizontal. Determine the <strong>range</strong>. (g = 9.81 m s⁻²)',
      answer: 12.71,
      unit: 'm',
      tol: 0.04,
      hint: 'Resolve, find the time of flight from the vertical, then use it horizontally.',
      work: 'ux = 12 cos 60° = 6.0 m s⁻¹;  uy = 12 sin 60° = 10.4 m s⁻¹\nT = 2uy / g = 2 × 10.39 / 9.81 = 2.12 s\nR = ux T = 6.0 × 2.12 = 13 m'
    },
    {
      type: 'num',
      stem: 'A stone is thrown at 15 m s⁻¹, <strong>20° below</strong> the horizontal, from a 25 m cliff. Calculate the <strong>time to reach the ground</strong>. (g = 9.81 m s⁻²)',
      answer: 1.794,
      unit: 's',
      tol: 0.04,
      hint: 'Down positive: 25 = 5.13t + 4.905t². Use the quadratic formula and keep the positive root.',
      work: 'uy = 15 sin 20° = 5.13 m s⁻¹ downwards\n25 = 5.13t + 4.905t²  →  4.905t² + 5.13t − 25 = 0\nt = 1.79 s (positive root)'
    }
  ];

  /* ------------------------------ S5: fluid resistance ------------------- */

  const s5 = [
    {
      type: 'mcq',
      tag: 'HINGE',
      badge: 'terminal',
      stem: 'A skydiver is falling at a constant <strong>terminal speed</strong>. What is the <strong>resultant force</strong> on her?',
      options: [
        { text: 'Zero' },
        { text: 'Equal to her weight, downwards', why: 'Weight is one of the forces acting, not the resultant of them all.' },
        { text: 'Upwards, because drag is now larger than weight', why: 'That is true just after the parachute opens, not at terminal speed.' },
        { text: 'Small and downwards, to keep her moving', why: 'No resultant force is needed to keep moving at constant velocity.' }
      ],
      answer: 0,
      work: 'Constant velocity → a = 0 → resultant force = 0.\nWeight and drag both act; they are balanced (drag = weight).'
    },
    {
      type: 'mcq',
      badge: 'terminal',
      stem: 'A skydiver falling at terminal speed <strong>opens her parachute</strong>. In which direction does she <strong>accelerate</strong>?',
      options: [
        { text: 'Upwards — she is slowing down while still moving down' },
        { text: 'Downwards', why: 'She is slowing, so the acceleration opposes her downward velocity.' },
        { text: 'She does not accelerate', why: 'Drag suddenly exceeds weight, so there is a resultant force.' },
        { text: 'She moves upwards', why: 'She keeps moving <em>down</em> — just more slowly. Velocity and acceleration are different things.' }
      ],
      answer: 0,
      work: 'The larger area makes drag > weight, so the resultant force is upwards.\nShe decelerates until drag falls back to equal her weight: a new, lower terminal speed.'
    },
    {
      type: 'mcq',
      badge: 'dragaware',
      stem: 'Compared with the same launch in a vacuum, fluid resistance makes a projectile\'s <strong>time of flight</strong>:',
      options: [
        { text: 'shorter overall, because the peak is lower' },
        { text: 'longer, because the descent is slower', why: 'The descent is slower, but the much lower peak wins: the total is shorter.' },
        { text: 'unchanged, because drag is horizontal only', why: 'Drag acts opposite to the <em>whole</em> velocity, so it has a vertical component too.' },
        { text: 'longer, because drag holds it up', why: 'On the way up drag acts <em>downwards</em>, adding to weight.' }
      ],
      answer: 0,
      work: 'Going up: drag and weight both act down → slows faster → lower peak.\nA lower peak gives a shorter total flight, even though the descent itself is slower.'
    },
    {
      type: 'mcq',
      badge: 'dragaware',
      stem: 'A ball is thrown straight up in air (drag not negligible). What is the magnitude of its acceleration <strong>at the highest point</strong>?',
      options: [
        { text: 'Exactly g, because v = 0 there so drag = 0' },
        { text: 'Greater than g', why: 'That is true on the way <em>up</em>, where drag and weight both act downwards.' },
        { text: 'Less than g', why: 'That is true on the way <em>down</em>, where drag opposes weight.' },
        { text: 'Zero', why: 'v = 0 at the top, but the weight still acts, so the acceleration is g.' }
      ],
      answer: 0,
      work: 'Drag grows with speed, so at v = 0 there is no drag.\nUp: |a| > g.   At the top: |a| = g exactly.   Down: |a| < g.'
    },
    {
      type: 'mcq',
      stem: 'A feather and a stone are dropped together <strong>in air</strong>. Why does the feather reach terminal speed much sooner?',
      options: [
        { text: 'It has a small weight and a large area, so drag equals its weight at a low speed' },
        { text: 'It is lighter, so gravity pulls it less and it accelerates more slowly', why: 'Without air, both accelerate at g regardless of mass. It is the drag-to-weight ratio that matters.' },
        { text: 'Air pushes it upwards from the start', why: 'At release v = 0, so drag = 0 for both. Drag only grows as they speed up.' },
        { text: 'Feathers are not affected by gravity', why: 'Weight acts on the feather too; it is simply balanced by drag at a very low speed.' }
      ],
      answer: 0,
      work: 'Terminal speed is where drag = weight.\nA small weight and a large area means that balance happens at a low speed, reached quickly.'
    },
    {
      type: 'mcq',
      badge: 'dragaware',
      stem: 'With drag, how does the <strong>shape of the trajectory</strong> change?',
      options: [
        { text: 'The peak is lower and the descent is steeper — no longer a symmetric parabola' },
        { text: 'It stays a symmetric parabola, just smaller', why: 'Drag makes the descent take longer than the ascent, so the two halves no longer match.' },
        { text: 'The peak shifts past the halfway point', why: 'The peak comes <em>earlier</em> than halfway, because the ascent is the faster half.' },
        { text: 'It becomes a straight line', why: 'It stays curved; only the symmetry is lost.' }
      ],
      answer: 0,
      work: 'Up: drag + weight → steeper slowing → lower, earlier peak.\nDown: drag opposes weight → |a| < g → a longer, steeper descent.'
    },
    {
      type: 'mcq',
      stem: 'Two skydivers have the <strong>same shape and area</strong>, but one is heavier. Whose terminal speed is higher?',
      options: [
        { text: 'The heavier one — more drag is needed to balance a larger weight' },
        { text: 'The lighter one', why: 'A smaller weight is balanced by drag at a lower speed, so the lighter one is slower.' },
        { text: 'They are the same, because g is the same', why: 'g sets the acceleration at release, not the terminal speed.' },
        { text: 'It cannot be decided without knowing the height', why: 'Terminal speed does not depend on the drop height.' }
      ],
      answer: 0,
      work: 'Terminal speed is where drag = weight, and drag grows with speed,\nso a larger weight needs a larger speed to be balanced.'
    },
    {
      type: 'mcq',
      stem: 'Why do the four equations of motion <strong>fail</strong> once drag matters?',
      options: [
        { text: 'The acceleration is no longer uniform' },
        { text: 'Because drag is a vector', why: 'Weight is a vector too — the problem is that drag changes with speed.' },
        { text: 'Because g changes with height', why: 'Near the Earth\'s surface g is taken as constant. The issue is the drag force.' },
        { text: 'They do not fail — you just add a drag term', why: 'The equations are derived assuming a constant a; there is no drag term to add.' }
      ],
      answer: 0,
      work: 'As v rises, drag rises, so the resultant force and the acceleration change.\nThe equations assume constant a, so use graphs or a numerical model instead.'
    }
  ];

  const banks = { s1, s2, s3, s4, s5 };

  /** The five hinge questions, used by the final mission. */
  function hinges() {
    return Object.values(banks).map(bank => bank.find(q => q.tag === 'HINGE')).filter(Boolean);
  }

  return { banks, sample, pick, hinges };
})();
