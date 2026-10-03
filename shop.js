/* 牌神擂台 — 技能商店（虛擬金幣） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el;
  const PRICE = (PK.SKILL_PRICE = 80); /* 遊戲中直接加購一次技能 */
  const PACKS = [
    { id: 't1', n: 1, price: 80, name: '技能券 ×1', note: '' },
    { id: 't5', n: 5, price: 350, name: '技能券 ×5', note: '省 50' },
    { id: 't12', n: 12, price: 750, name: '技能券 ×12', note: '省 210・最划算' },
    { id: 't30', n: 30, price: 1700, name: '技能券 ×30', note: '省 700・大禮包' },
  ];
  const inv = () => { const s = PK.user.stats; s.items = s.items || {}; s.items.ticket = s.items.ticket || 0; return s.items; };
  PK.tickets = () => (PK.user ? inv().ticket : 0);
  const pay = (price) => {
    if (PK.user.chips < price) return false;
    PK.user.chips -= price; PK.updateChipDisplays(); return true;
  };

  /* 遊戲中技能用完時：用技能券或金幣再買一次。回傳 true＝買成功 */
  PK.buySkill = async function (icon, name) {
    const tk = PK.tickets(), chips = PK.user.chips;
    const v = await PK.modal('🛒 加購技能', el('div', { class: 'shop-buy' },
      el('div', { class: 'shop-buy-sk' }, icon + ' ' + name),
      el('p', null, '這個技能的次數用完了，要再買 1 次嗎？'),
      el('p', { class: 'muted' }, '你有 🎟️ 技能券 ' + tk + ' 張・🪙 ' + PK.fmt(chips) + ' 金幣（虛擬計分）')),
    [
      { text: '取消', value: 0, cls: 'ghost' },
      ...(tk ? [{ text: '🎟️ 用 1 張技能券', value: 'tk', cls: 'primary' }] : []),
      { text: '🪙 花 ' + PRICE + ' 金幣', value: 'coin', cls: tk ? '' : 'primary', disabled: chips < PRICE },
    ]);
    if (v === 'tk' && inv().ticket > 0) { inv().ticket--; PK.saveUser(); PK.sfx('chip'); return true; }
    if (v === 'coin' && pay(PRICE)) { PK.saveUser(); PK.sfx('chip'); return true; }
    return false;
  };

  /* 買了但時間已經到、用不到：退回 1 張技能券 */
  PK.refundSkill = () => { inv().ticket++; PK.saveUser(); PK.toast('來不及使用，已退回 1 張技能券 🎟️', 2600); };

  /* 大廳的商店畫面 */
  PK.showShop = function () {
    document.body.removeAttribute('style'); document.body.className = 'lobby-body';
    const chipsEl = el('b', { 'data-chips': '' }, PK.fmt(PK.user.chips));
    const tkEl = el('b', null, PK.tickets());
    const refresh = () => { tkEl.textContent = PK.tickets(); chipsEl.textContent = PK.fmt(PK.user.chips); PK.$$('.shop-item .btn').forEach((b) => (b.disabled = PK.user.chips < +b.dataset.p || null)); };
    const buy = async (pk) => {
      if (!(await PK.confirm('確認購買', '用 ' + PK.fmt(pk.price) + ' 金幣買「' + pk.name + '」？（虛擬金幣，沒有任何現金價值）'))) return;
      if (!pay(pk.price)) { PK.toast('金幣不夠'); return; }
      inv().ticket += pk.n; PK.saveUser(); refresh();
      PK.sfx('win'); PK.fx.coins(null, tkEl, 12); PK.fx.floatText(tkEl, '+' + pk.n, '#ffe680');
      PK.voice.say('購買成功', { pri: 2 });
    };
    PK.$('#app').replaceChildren(el('div', { class: 'lobby' },
      el('div', { class: 'setup-top' }, el('button', { class: 'btn ghost', onclick: PK.showLobby }, '← 返回大廳')),
      el('div', { class: 'shop-hero' }, el('h2', null, '🛒 技能商店'),
        el('div', { class: 'shop-wallet' }, el('span', null, '🪙 金幣 ', chipsEl), el('span', null, '🎟️ 技能券 ', tkEl, ' 張'))),
      el('div', { class: 'shop-how' },
        el('h3', null, '怎麼用？'),
        el('ol', null,
          el('li', null, '選「狂歡模式」開始遊戲，每局一開始每個技能都有免費次數。'),
          el('li', null, '某個技能用完時，按鈕會變成「🛒 加購」，點一下就能用 1 張技能券（或直接花 ' + PRICE + ' 金幣）再用一次。'),
          el('li', null, '技能券 20 款遊戲通用，可以先在這裡買起來，一次買越多越便宜。'))),
      el('div', { class: 'shop-grid' }, PACKS.map((pk) => el('div', { class: 'shop-item' },
        el('div', { class: 'shop-ic' }, '🎟️'.repeat(Math.min(3, Math.ceil(pk.n / 5)) || 1)),
        el('div', { class: 'shop-name' }, pk.name),
        pk.note ? el('div', { class: 'shop-note' }, pk.note) : null,
        el('button', { class: 'btn primary', 'data-p': pk.price, disabled: PK.user.chips < pk.price || null, onclick: () => buy(pk) }, '🪙 ' + PK.fmt(pk.price))))),
      el('p', { class: 'muted shop-foot' }, '金幣與技能券都是虛擬計分，僅供家人娛樂，不能兌換現金或任何實物，也不能用真錢購買。')));
  };
})();
