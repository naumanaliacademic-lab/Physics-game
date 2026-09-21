/* ==========================================================================
   ui.js — DOM helpers, HUD sync, toasts, modals and the shared question card.
   Every zone asks questions through UI.ask() so feedback is consistent.
   ========================================================================== */

const UI = (() => {
  'use strict';

  /* ------------------------------ DOM helpers --------------------------- */

  /** el('div.panel', {id:'x'}, child, 'text') — tiny hyperscript. */
  function el(spec, attrs, ...children) {
    const [tagPart, ...classes] = String(spec).split('.');
    const node = document.createElement(tagPart || 'div');
    if (classes.length) node.className = classes.join(' ');
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    } else if (attrs !== undefined && attrs !== null) {
      children.unshift(attrs);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ------------------------------ HUD ----------------------------------- */

  function syncHud() {
    const rank = Game.rank();
    const next = Game.nextRank();
    $('#hudRank').textContent = rank.name;
    $('#hudName').textContent = Game.save.name;
    $('#hudXpText').textContent = `${Game.save.xp} XP`;
    const floor = rank.xp;
    const ceil = next ? next.xp : rank.xp + 1;
    const pct = next ? ((Game.save.xp - floor) / (ceil - floor)) * 100 : 100;
    $('#hudXpFill').style.width = `${Math.max(3, Math.min(100, pct))}%`;
    $('#hudStars').textContent = stars(Math.min(5, Math.round(Game.totalStars() / 5)), 5);
  }

  function stars(filled, total) {
    return '★'.repeat(Math.max(0, filled)) + '☆'.repeat(Math.max(0, total - filled));
  }

  /* ------------------------------ Toast --------------------------------- */

  let toastTimer = null;
  function toast(message, ms) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.add('toast--on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('toast--on'), ms || 1800);
  }

  /* ------------------------------ Modal --------------------------------- */

  /** actions: [{ label, primary, onClick }] — onClick runs after the close. */
  function modal(title, bodyNode, actions) {
    const box = $('#modal');
    $('#modalTitle').textContent = title;
    const body = $('#modalBody');
    body.innerHTML = '';
    body.append(bodyNode instanceof Node ? bodyNode : el('p', { html: String(bodyNode) }));
    const bar = $('#modalActions');
    bar.innerHTML = '';
    (actions || [{ label: 'Continue', primary: true }]).forEach(a => {
      bar.append(el('button.btn' + (a.primary ? '.btn--primary' : ''), {
        type: 'button',
        onClick: () => { closeModal(); if (a.onClick) a.onClick(); }
      }, a.label));
    });
    box.hidden = false;
  }

  function closeModal() { $('#modal').hidden = true; }

  /* ------------------------------ Controls ------------------------------ */

  /** A labelled slider that reports its live value. Returns {wrap, input}. */
  function slider({ label, min, max, step, value, unit, format, onInput }) {
    const val = el('span.ctrl__val');
    const input = el('input', { type: 'range', min, max, step, value });
    const show = () => {
      const v = parseFloat(input.value);
      val.textContent = (format ? format(v) : v) + (unit ? ` ${unit}` : '');
    };
    input.addEventListener('input', () => { show(); if (onInput) onInput(parseFloat(input.value)); });
    show();
    const wrap = el('div.ctrl', null,
      el('div.ctrl__head', null, el('span.ctrl__label', null, label), val),
      input
    );
    return { wrap, input, get value() { return parseFloat(input.value); } };
  }

  function readout(cells) {
    const wrap = el('div.readout');
    const refs = {};
    for (const [key, spec] of Object.entries(cells)) {
      const v = el('span.readout__v', null, spec.value !== undefined ? spec.value : '—');
      refs[key] = v;
      wrap.append(el('div.readout__cell', null, el('span.readout__k', null, spec.label), v));
    }
    return { wrap, set: (key, text) => { if (refs[key]) refs[key].textContent = text; } };
  }

  function dots(total, stateFn) {
    const wrap = el('div.progress-dots');
    for (let i = 0; i < total; i++) {
      const s = stateFn ? stateFn(i) : '';
      wrap.append(el('span.dot' + (s ? '.dot--' + s : '')));
    }
    return wrap;
  }

  /* ------------------------------ Question card -------------------------- */

  /**
   * Render one question and resolve with { correct, question }.
   *   mcq: { type:'mcq', stem, options:[{text, why}], answer, work, badge }
   *   num: { type:'num', stem, answer, unit, tol, work, badge, hint }
   * `tol` is a relative tolerance (default 2%), with an absolute floor so
   * answers near zero still work.
   */
  function ask(container, q, onDone) {
    container.innerHTML = '';
    const card = el('div');
    card.append(el('div.q__stem', { html: q.stem }));

    const feedbackSlot = el('div');
    let answered = false;

    const settle = (correct, chosenWhy) => {
      if (answered) return;
      answered = true;
      Game.recordAnswer(correct);
      if (correct && q.badge) Game.awardBadge(q.badge);

      const fb = el('div.feedback' + (correct ? '.feedback--right' : '.feedback--wrong'));
      fb.append(el('div.feedback__title', null, correct ? '✓ Correct' : '✗ Not quite'));
      if (!correct && chosenWhy) fb.append(el('div', { html: chosenWhy }));
      if (q.work) fb.append(el('div.feedback__work', null, q.work));
      feedbackSlot.append(fb);

      const next = el('button.btn.btn--primary.mt', {
        type: 'button',
        onClick: () => onDone({ correct, question: q })
      }, 'Continue ▶');
      feedbackSlot.append(next);
      next.focus();
    };

    if (q.type === 'num') {
      const input = el('input', {
        type: 'text', inputmode: 'decimal', placeholder: 'your answer',
        'aria-label': 'Answer'
      });
      const check = () => {
        const given = parseFloat(String(input.value).replace(/[^0-9eE+\-.]/g, ''));
        if (!isFinite(given)) { toast('Type a number first'); return; }
        const tol = q.tol !== undefined ? q.tol : 0.02;
        const slack = Math.max(Math.abs(q.answer) * tol, Math.abs(q.answer) * 0.005 + 1e-9, q.absTol || 0);
        const correct = Math.abs(given - q.answer) <= slack;
        input.disabled = true; goBtn.disabled = true;
        settle(correct, `The accepted answer is <strong>${Physics.sig(q.answer, 3)} ${q.unit || ''}</strong>.`);
      };
      const goBtn = el('button.btn.btn--primary', { type: 'button', onClick: check }, 'Check');
      input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
      card.append(el('div.numin', null, input, q.unit ? el('span.numin__unit', null, q.unit) : null, goBtn));
      if (q.hint) card.append(el('p.small.muted.mt', { html: `Hint: ${q.hint}` }));
      setTimeout(() => input.focus(), 30);
    } else {
      const opts = el('div.opts');
      q.options.forEach((opt, i) => {
        const btn = el('button.opt', { type: 'button' },
          el('span.opt__key', null, 'ABCD'[i] || String(i + 1)),
          el('span', { html: opt.text })
        );
        btn.addEventListener('click', () => {
          if (answered) return;
          const correct = i === q.answer;
          [...opts.children].forEach((child, j) => {
            child.disabled = true;
            if (j === q.answer) child.classList.add('opt--right');
            else if (j === i) child.classList.add('opt--wrong');
          });
          settle(correct, opt.why);
        });
        opts.append(btn);
      });
      card.append(opts);
    }

    card.append(feedbackSlot);
    container.append(card);
  }

  /* ------------------------------ Canvas -------------------------------- */

  /**
   * A crisp canvas sized in CSS pixels; the context is pre-scaled for the
   * device pixel ratio so 1 unit of drawing = 1 CSS pixel.
   */
  function canvas(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cnv = el('canvas', { width: Math.round(width * dpr), height: Math.round(height * dpr) });
    cnv.style.aspectRatio = `${width} / ${height}`;
    const ctx = cnv.getContext('2d');
    ctx.scale(dpr, dpr);
    cnv.logicalWidth = width;
    cnv.logicalHeight = height;
    return { cnv, ctx, w: width, h: height };
  }

  return { el, $, syncHud, stars, toast, modal, closeModal, slider, readout, dots, ask, canvas };
})();
