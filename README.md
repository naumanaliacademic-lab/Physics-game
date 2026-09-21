# Vector Rescue — IB DP Physics A.1 Kinematics

A browser game that teaches **Theme A, topic A.1 Kinematics** (IB Physics guide,
first assessment 2025). It was built from the A.1 *Content deck* and *Teaching
deck*: the five zones are the five subtopics, in the deck's own order, and every
hinge question and "common misconceptions" row from the decks appears in the game.

**Play it:** open `index.html` in any modern browser. No build step, no install,
no network needed. Progress saves in the browser.

---

## Why a game, and not a quiz

A quiz asks a student to *state* that the area under a velocity–time graph is the
displacement. This game does not let them past a docking manoeuvre until they have
*used* that fact to park a ship. Each zone turns one subtopic into something the
student has to fly:

| Zone | Subtopic | What the student actually does |
|---|---|---|
| 1 · Beacon Run | S1 Describing motion | Flies a drone route, then files distance, displacement, average speed and average velocity — and calls "speeding up or slowing down" from the signs of *v* and *a*, against a clock. |
| 2 · Docking Sequence | S2 Motion graphs | **Builds** a three-phase velocity–time graph. The ship flies whatever they draw. Area under the graph must equal the distance to the dock; the gradients must stay inside the hull's acceleration limit. |
| 3 · Reactor Core | S3 Equations of motion | Lists *s, u, v, a, t*, spots the missing quantity, picks the booklet equation without it, then computes. Then catches a capsule in free fall by working out *when* it passes the net. |
| 4 · Launch Bay | S4 Projectile motion | Aims a rescue-line launcher: horizontal, above and below the horizontal, and over a mast. Level 1 drops a marker at the moment of firing — both hit the water together, which is the Shoot-n-Drop result. |
| 5 · Drop Zone | S5 Fluid resistance | Survives a skydive computed from real quadratic drag. They must hold the fall until the acceleration reading reaches **zero** — terminal speed — then deploy. The trace they draw by falling *is* the deck's skydiver graph. Then compares the same launch with the air on and off and completes the six-effects table. |
| Mission Alpha | Whole topic | All five hinge questions from the teaching deck, plus a sample from every subtopic. Three wrong answers ends the run. |

## The physics is real, not scripted

`js/physics.js` is the single source of truth, and every number the game shows is
computed there with **g = 9.81 m s⁻²**, as both decks specify.

* The four equations of motion appear exactly as the data booklet (page 6) prints them.
* Projectiles are solved analytically; the quadratic root is taken for launches below the horizontal.
* Fluid resistance is a genuine RK4 integration of `a = −g − (k/m)|v|v`, parameterised by terminal speed (`k/m = g/v_T²`) so that "heavier or more streamlined means a higher terminal speed" falls out of the model rather than being asserted.

Every worked answer in the decks reproduces exactly:

| Deck example | Deck answer | Game model |
|---|---|---|
| Kick, 20 m s⁻¹ at 35° | T = 2.3 s, R = 38 m, H = 6.7 m | 2.339 s, 38.3 m, 6.71 m |
| Ball off a 1.20 m bench at 3.0 m s⁻¹ | t = 0.4946 s, v = 5.7 m s⁻¹ at 58° | 0.4946 s, 5.70 m s⁻¹, 58.3° |
| Stone, 15 m s⁻¹ at 20° below, 25 m cliff | t = 1.794 s, x = 25 m, v = 27 m s⁻¹ | 1.794 s, 25.3 m, 26.8 m s⁻¹ |
| Drone parcel from 45 m at 6.0 m s⁻¹ | t = 3.03 s, x = 18 m | 3.029 s, 18.2 m |
| Golf ball with drag (deck's model) | R: 38 → 25 m, H: 6.7 → 5.3 m, T: 2.3 → 2.1 s | 25.3 m, 5.30 m, 2.07 s (v_T = 22 m s⁻¹) |

## Misconceptions as badges

Each of the ten badges is one wrong idea from the decks' *common misconceptions*
slides that the student has beaten in play — "negative acceleration means slowing
down", "the ball stops at the top", "at terminal speed no forces act", and so on.
The badge grid on the mission map is a diagnostic: a locked badge names exactly
what to re-read.

## For the teacher

* **Hinge questions.** The five hinge questions from the teaching deck are in the game verbatim, including every distractor and the reason it is wrong. They always appear in Mission Alpha, so a Mission Alpha result tells you which checkpoints a student has not cleared.
* **Setting it.** Zone *n* unlocks when zone *n−1* is cleared, so it maps onto the lesson sequence. One zone is roughly 10–20 minutes.
* **Accuracy tracking.** The mission map shows total questions answered and the percentage correct.
* **Command terms.** Questions use *calculate, determine, state, explain* as the guide defines them.

## Running and hosting

Open `index.html` directly, or serve the folder over any static host
(GitHub Pages works as-is — there is no build step and no framework).

## Layout

```
index.html          page shell and script order
css/style.css       deep-space theme, responsive down to phone width
js/engine.js        save state, XP, ranks, badges, routing
js/ui.js            DOM helpers, HUD, toasts, modals, the shared question card
js/physics.js       ALL the physics, plus the animation-loop registry
js/questions.js     question bank taken from the two decks
js/shell.js         the frame a zone runs in: brief, steps, marks, debrief
js/zone1..5.js      one subtopic each
js/finalmission.js  Mission Alpha
js/main.js          title screen, mission map, routes
```

## Credits

Physics content follows the IB Physics guide (first assessment 2025), A.1
Kinematics. Revision links on the mission map point to PhET Interactive
Simulations (University of Colorado Boulder, CC-BY 4.0) and to the BBC and
Harvard demonstrations cited in the decks.
