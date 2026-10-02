/* 牌神擂台 — 四方牌桌與吃墩共用工具 ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const TK = (PK.trick = {});
  TK.rv = (c) => (c.r === 1 ? 14 : c.r);
  TK.SORT = ['S', 'H', 'C', 'D'];
  TK.sortHand = (cs) => cs.sort((a, b) => TK.SORT.indexOf(a.s) - TK.SORT.indexOf(b.s) || TK.rv(b) - TK.rv(a));
  TK.legal = (hand, led) => { if (!led) return hand.slice(); const f = hand.filter((c) => c.s === led); return f.length ? f : hand.slice(); };
  /* 這一墩誰贏：plays = [{ p, c }] */
  TK.winner = (plays, trump) => {
    const led = plays[0].c.s; let best = 0;
    const pw = (c) => (trump && (c.s === trump || c.asTrump) ? 100 : c.s === led ? 0 : -100) + TK.rv(c) + (c.boost || 0);
    plays.forEach((x, i) => { if (pw(x.c) > pw(plays[best].c)) best = i; });
    return best;
  };

  /* 四方座位：ps[0]=南（你）、ps[1]=西、ps[2]=北、ps[3]=東，順時針出牌 */
  kit.compass = function (t, ps, o) {
    o = o || {};
    const POS = ['s', 'w', 'n', 'e'];
    const mi = ps.indexOf(t.me); /* 自己永遠坐在下方 */
    const disp = ps.map((_, d) => ps[(mi + d) % 4]);
    const boxes = disp.map((p, i) => kit.box(t, p, { big: i === 0, cls: (i === 0 ? 'me-box ' : '') + 'cp-' + POS[i] }));
    const slots = POS.map((k) => el('div', { class: 'cp-slot cp-slot-' + k }));
    const info = el('div', { class: 'round-info cp-info' });
    const center = el('div', { class: 'cp-center' }, slots, el('div', { class: 'cp-mid' }, info, o.centerExtra || ''));
    const ctrl = el('div', { class: 'controls' });
    const timer = el('div', { class: 'timer' }, el('div', { class: 'timer-fill' }));
    const skillbar = el('div', { class: 'skillbar' });
    const wrap = el('div', { class: 'th-wrap cp-wrap ' + (o.cls || '') },
      o.top || '',
      el('div', { class: 'cp-grid' }, el('div', { class: 'cp-n' }, boxes[2]), el('div', { class: 'cp-w' }, boxes[1]), center, el('div', { class: 'cp-e' }, boxes[3])),
      el('div', { class: 'th-me' }, boxes[0], timer, ctrl, t.isParty ? skillbar : null));
    t.board.replaceChildren(wrap);
    const pos = (p) => (ps.indexOf(p) - mi + 4) % 4;
    return { wrap, ctrl, timer, skillbar, slots, info, center, pos, slotOf: (p) => slots[pos(p)] };
  };
  /* 出一張（或多張）牌到自己前方 */
  kit.toSlot = async function (L, p, idx, cards, faceUp) {
    cards = Array.isArray(cards) ? cards : [cards];
    if (L.pos) idx = L.pos(p);
    await PK.flyCard(p.handEl, L.slots[idx], null, 230);
    L.slots[idx].replaceChildren(...cards.map((c) => { const e = PK.cardEl(c, faceUp !== false); e.classList.add('pop-in'); return e; }));
  };
  kit.clearSlots = (L) => L.slots.forEach((s) => s.replaceChildren());
  /* 收墩動畫 */
  kit.collectTrick = async function (t, L, winner) {
    await t.wait(700);
    L.slots.forEach((s) => s.classList.add('collect'));
    await PK.flyCard(L.center, winner.seatEl, null, 300);
    L.slots.forEach((s) => { s.classList.remove('collect'); s.replaceChildren(); });
  };
  /* AI 手牌（蓋著） */
  kit.backs = (p, n) => p.handEl.replaceChildren(...Array.from({ length: Math.min(n == null ? p.cards.length : n, 13) }, () => PK.cardEl(null, false, { small: true })));
})();
