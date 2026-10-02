/* 牌神擂台 — 共用特效系統 ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK;
  const fx = (PK.fx = {});
  let cv, ctx, parts = [], running = false;

  function ensure() {
    if (cv) return;
    cv = PK.el('canvas', { id: 'fx-canvas' });
    document.body.append(cv);
    ctx = cv.getContext('2d');
    const rs = () => { const d = window.devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    rs(); addEventListener('resize', rs);
  }
  function loop() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.life -= 1; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const a = Math.min(1, p.life / p.fade);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.emoji) { ctx.font = p.size + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.emoji, 0, 0); }
      else if (p.shape === 'rect') { ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      else if (p.shape === 'line') { ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 3, -p.vy * 3); ctx.stroke(); }
      else { ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = p.glow || 0; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function add(p) {
    ensure();
    parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 0.98, rot: 0, vr: 0, size: 4, life: 60, fade: 20, color: '#fff' }, p));
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  const center = (el) => { if (!el) return { x: innerWidth / 2, y: innerHeight / 2 }; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  fx.center = center;
  const COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c', '#ffffff'];

  /* 煙火 */
  fx.firework = function (x, y, colors, n) {
    colors = colors || COLORS; n = n || 60;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, s = PK.rand(2, 6); add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.06, drag: 0.97, size: PK.rand(1.5, 3), color: PK.pick(colors), glow: 10, life: PK.randInt(50, 80), fade: 30 }); }
  };
  fx.fireworks = async function (count) {
    PK.sfx('big');
    for (let i = 0; i < (count || 5); i++) { fx.firework(PK.rand(innerWidth * 0.15, innerWidth * 0.85), PK.rand(innerHeight * 0.15, innerHeight * 0.5)); await PK.sleep(220); }
  };
  /* 彩帶 */
  fx.confetti = function (n) {
    for (let i = 0; i < (n || 120); i++) add({ x: PK.rand(0, innerWidth), y: PK.rand(-80, -10), vx: PK.rand(-1.5, 1.5), vy: PK.rand(1, 4), g: 0.04, drag: 0.99, shape: 'rect', size: PK.rand(6, 11), vr: PK.rand(-0.2, 0.2), color: PK.pick(COLORS), life: PK.randInt(120, 200), fade: 40 });
  };
  /* 金幣噴發：從某元素噴到另一元素 */
  fx.coins = function (fromEl, toEl, n) {
    const a = center(fromEl), b = toEl ? center(toEl) : null;
    PK.sfx('chip');
    for (let i = 0; i < (n || 18); i++) {
      setTimeout(() => {
        if (b) { const t = PK.randInt(35, 50); add({ emoji: '🪙', size: 22, x: a.x + PK.rand(-20, 20), y: a.y + PK.rand(-10, 10), vx: (b.x - a.x) / t, vy: (b.y - a.y) / t - 4, g: 8 / t, drag: 1, life: t, fade: 6, vr: 0.2 }); }
        else add({ emoji: '🪙', size: 22, x: a.x, y: a.y, vx: PK.rand(-5, 5), vy: PK.rand(-9, -4), g: 0.35, life: 70, fade: 20, vr: 0.2 });
      }, i * 35);
    }
  };
  /* 表情爆裂（茶杯碎、愛心飛、炸彈爆等） */
  fx.burst = function (el, emoji, n, opt) {
    const c = center(el); opt = opt || {};
    for (let i = 0; i < (n || 14); i++) { const a = PK.rand(0, Math.PI * 2), s = PK.rand(2, opt.speed || 7); add({ emoji: Array.isArray(emoji) ? PK.pick(emoji) : emoji, size: PK.rand(16, opt.size || 30), x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opt.up || 2), g: opt.g == null ? 0.2 : opt.g, life: PK.randInt(40, 70), fade: 20, vr: PK.rand(-0.2, 0.2) }); }
  };
  fx.sparkle = function (el, color, n) {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < (n || 24); i++) add({ x: PK.rand(r.left, r.right), y: PK.rand(r.top, r.bottom), vx: PK.rand(-0.5, 0.5), vy: PK.rand(-2, -0.5), size: PK.rand(1.5, 3), color: color || '#ffe680', glow: 12, life: PK.randInt(30, 60), fade: 20 });
  };
  /* 震動 */
  fx.shake = function (el, power) {
    el = el || document.body; power = power || 8;
    el.animate([0, 1, 2, 3, 4, 5, 6].map((i) => ({ transform: i === 6 ? 'none' : `translate(${PK.rand(-power, power)}px,${PK.rand(-power, power)}px)` })), { duration: 380 });
  };
  /* 全螢幕閃光 */
  fx.flash = function (color, ms) {
    const f = PK.el('div', { class: 'fx-flash', style: { background: color || '#fff' } });
    document.body.append(f);
    f.animate([{ opacity: 0.75 }, { opacity: 0 }], { duration: ms || 450, easing: 'ease-out' }).onfinish = () => f.remove();
  };
  /* 大字標語 */
  fx.banner = function (text, style, sub) {
    const b = PK.el('div', { class: 'fx-banner ' + (style || '') }, PK.el('div', { class: 'fx-banner-main' }, text), sub ? PK.el('div', { class: 'fx-banner-sub' }, sub) : null);
    document.body.append(b);
    setTimeout(() => b.classList.add('out'), 1500);
    setTimeout(() => b.remove(), 2000);
  };
  /* 閃電 */
  fx.lightning = function (el) {
    const c = center(el); PK.sfx('boom'); fx.flash('#e0f0ff', 300);
    let x = c.x, y = 0;
    const seg = []; while (y < c.y) { const nx = x + PK.rand(-30, 30), ny = y + PK.rand(20, 45); seg.push([x, y, nx, ny]); x = nx; y = ny; }
    const s = PK.el('div', { class: 'fx-svg' });
    s.innerHTML = `<svg width="100%" height="100%"><polyline points="${seg.map((p) => p[0] + ',' + p[1]).join(' ')} ${c.x},${c.y}" fill="none" stroke="#fff" stroke-width="4" style="filter:drop-shadow(0 0 8px #8cf)"/></svg>`;
    document.body.append(s); setTimeout(() => s.remove(), 260);
    fx.burst(el, '⚡', 8);
  };
  /* 光環聚焦 */
  fx.spotlight = function (el, ms) {
    el.classList.add('fx-spot'); setTimeout(() => el.classList.remove('fx-spot'), ms || 1500);
  };
  /* 透視眼：短暫顯示秘密資訊 */
  fx.peek = function (el) { fx.burst(el, '👁️', 6, { g: 0, speed: 3 }); fx.sparkle(el, '#9be7ff', 20); };
  /* 丟表情 */
  fx.throwEmoji = function (fromEl, toEl, emoji) {
    const a = center(fromEl), b = center(toEl);
    PK.sfx('throw');
    const t = 32;
    add({ emoji, size: 36, x: a.x, y: a.y, vx: (b.x - a.x) / t, vy: (b.y - a.y) / t - 6, g: 12 / t, drag: 1, life: t, fade: 1, vr: 0.3 });
    setTimeout(() => {
      const hit = { '🍅': ['🍅', '💦'], '❤️': ['❤️', '💕', '💖'], '💣': ['💥', '🔥', '💨'], '👍': ['👍', '✨'], '🌹': ['🌹', '🌸'], '🥚': ['🥚', '🍳'], '🍺': ['🍺', '🫧'] }[emoji] || [emoji];
      if (emoji === '💣') { PK.sfx('boom'); fx.shake(toEl, 10); } else PK.sfx('splat');
      fx.burst(toEl, hit, 14);
      if (emoji === '🍅' || emoji === '🥚') { toEl.classList.add('fx-splat'); setTimeout(() => toEl.classList.remove('fx-splat'), 1600); }
    }, (t * 1000) / 60);
  };
  /* 浮動文字（+100 之類） */
  fx.floatText = function (el, text, color) {
    const c = center(el);
    const f = PK.el('div', { class: 'fx-float', style: { left: c.x + 'px', top: c.y + 'px', color: color || '#ffd166' } }, text);
    document.body.append(f); setTimeout(() => f.remove(), 1400);
  };
})();
