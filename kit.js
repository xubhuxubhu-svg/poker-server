/* 牌神擂台 — 共用遊戲工具包 ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el;
  const kit = (PK.kit = {});

  kit.LINES = {
    good: ['嘿嘿', '太好了！', '運氣不錯', '看我的！', '耶！'],
    bad: ['可惡！', '唉…', '怎麼會這樣 😭', '下次再來'],
    win: ['我贏啦！', '承讓承讓', '哈哈哈～', '今天手氣真好'],
    lose: ['輸了…', '再來一局！', '下次一定贏', '😭'],
    think: ['嗯…', '讓我想想', '這張好了', '就決定是你了'],
    skill: ['看招！', '技能發動！', '嘿嘿，準備好了嗎'],
  };
  kit.say = (t, p, type, chance) => { if (p.isAI && PK.nrand() < (chance == null ? 0.5 : chance)) t.say(p, PK.cpick(kit.LINES[type])); };

  /* ---------- 玩家框 ---------- */
  kit.box = function (t, p, opt) {
    opt = opt || {};
    p.handEl = el('div', { class: 'hand' + (opt.big ? '' : ' sm') + (opt.fan ? ' fan' : '') });
    p.ptsEl = el('div', { class: 'pts' });
    p.tagEl = el('div', { class: 'tag-st' });
    p.betEl = el('div', { class: 'bet-chip' });
    p.boxEl = el('div', { class: 'pl-box ' + (opt.cls || '') },
      t.seat(p, el('div', { class: 'seat-sub' }, p.betEl)),
      el('div', { class: 'pl-cards' }, p.handEl, el('div', { class: 'pl-info' }, p.ptsEl, p.tagEl)));
    return p.boxEl;
  };
  kit.setTag = (p, txt, cls) => { p.tagEl.textContent = txt || ''; p.tagEl.className = 'tag-st ' + (cls || ''); };
  kit.active = (list, who) => list.forEach((x) => x.boxEl && x.boxEl.classList.toggle('active', x === who));

  /* 一般牌桌版面：上方（莊家或對手）、中間、下方自己 */
  kit.layout = function (t, o) {
    const ctrl = el('div', { class: 'controls' });
    const timer = el('div', { class: 'timer' }, el('div', { class: 'timer-fill' }));
    const skillbar = el('div', { class: 'skillbar' });
    const wrap = el('div', { class: 'th-wrap ' + (o.cls || '') },
      o.top ? el('div', { class: 'th-banker' }, o.top) : null,
      el('div', { class: 'th-others' }, o.others || []),
      el('div', { class: 'th-mid' }, o.mid || []),
      el('div', { class: 'th-me' }, o.me, timer, ctrl, t.isParty ? skillbar : null));
    t.board.replaceChildren(wrap);
    return { wrap, ctrl, timer, skillbar };
  };

  /* ---------- 技能 ---------- */
  /* defs = { key: [圖示, 名稱, 說明, 次數] } */
  kit.skills = function (t, defs, players, bar) {
    const S = { defs, bar, enabled: false, handler: null };
    players.forEach((p) => { p.sk = {}; for (const k in defs) p.sk[k] = defs[k][3]; });
    S.refill = () => { players.forEach((p) => { for (const k in defs) p.sk[k] = Math.max(p.sk[k], 1); }); t.sys('技能次數已補充！'); };
    S.render = (enabled, handler) => {
      if (!t.isParty || !bar) return;
      S.enabled = enabled; if (handler !== undefined) S.handler = handler;
      const me = t.me;
      bar.replaceChildren(...Object.keys(defs).map((k) => el('button', {
        class: 'skill', title: defs[k][2], disabled: !enabled || !me.sk[k] || null,
        onclick: () => { if (S.handler) S.handler(k); },
      }, el('span', { class: 'sk-i' }, defs[k][0]), el('span', { class: 'sk-n' }, defs[k][1]), el('span', { class: 'sk-c' }, '×' + me.sk[k]))));
    };
    /* 扣次數＋特效＋公告 */
    S.spend = (p, k) => {
      if (!t.isParty || !p.sk[k]) return false;
      p.sk[k]--; PK.sfx('skill'); PK.voice.say(defs[k][1] + '！', { pri: 2, pitch: p.voicePitch || 1 });
      PK.fx.sparkle(p.seatEl, '#ffe680', 30);
      PK.fx.floatText(p.seatEl, defs[k][0] + ' ' + defs[k][1], '#ffe680');
      if (p.isAI) t.say(p, '使出「' + defs[k][1] + '」！'); else t.sys((p === t.me ? '你' : p.name) + '使用了「' + defs[k][1] + '」');
      if (p === t.me) { S.render(S.enabled); if (PK.ch) PK.ch.emit('skill'); }
      return true;
    };
    return S;
  };

  /* ---------- 等待玩家操作（按鈕、技能、卡牌、時間到） ---------- */
  /* who＝這個決定是誰做的。連線時：自己的決定會傳給其他人；別人的決定會等網路傳過來 */
  kit.ask = async function (t, o) {
    const who = o.local ? null : o.who !== undefined ? o.who : t.actor;
    if (t.online && who && who.remote) {
      t._wait = t._wait || new Map();
      t._wait.set(who, o.ctrl);
      if (o.ctrl) kit.showWait(t, o.ctrl);
      if (o.skills && !o.keepSkills && !o.ctrl) o.skills.render(false, null);
      const r = await t.net.next(who.seat);
      if (window.PK_DEBUG) console.error('EVH ' + (t._dbg = (t._dbg || 0) + 1) + ' ' + who.seat + ' ' + t.net.stateHash(t));
      t._wait.delete(who);
      if (o.ctrl) kit.showWait(t, o.ctrl);
      return r;
    }
    const r = await askLocal(t, o);
    if (window.PK_DEBUG && t.online && who && !who.isAI) console.error('EVH ' + (t._dbg = (t._dbg || 0) + 1) + ' ' + who.seat + ' ' + t.net.stateHash(t));
    if (t.online && who && !who.isAI && r.type !== 'closed') t.net.send(who.seat, r);
    return r;
  };
  /* 畫面上顯示「等待某某…」（只有在自己沒有要操作的時候） */
  kit.showWait = (t, ctrl) => {
    if (ctrl._busy) return;
    const names = [...(t._wait || new Map())].filter(([, c]) => c === ctrl).map(([p]) => p.name);
    const old = PK.$('.bet-title.wait', ctrl);
    if (!names.length) { if (old && ctrl.children.length === 1) ctrl.replaceChildren(); return; }
    if (ctrl.children.length && !old) return;
    ctrl.replaceChildren(el('div', { class: 'bet-title wait' }, '⏳ 等待 ' + names.join('、') + ' …'));
  };
  const askLocal = function (t, o) {
    return new Promise((resolve) => {
      let done = false, left = o.secs || 20;
      const fill = o.timer && PK.$('.timer-fill', o.timer);
      const finish = (r) => {
        if (done) return; done = true;
        clearInterval(iv);
        if (o.timer) o.timer.classList.remove('on', 'hurry');
        if (o.ctrl) { o.ctrl._busy = false; o.ctrl.replaceChildren(); if (t.online) kit.showWait(t, o.ctrl); }
        if (o.skills) o.skills.render(false, null);
        if (o.cleanup) o.cleanup();
        resolve(r);
      };
      if (o.ctrl) o.ctrl._busy = true;
      if (o.ctrl) o.ctrl.replaceChildren(...(o.title ? [el('div', { class: 'bet-title' }, o.title)] : []),
        ...(o.buttons || []).map((b) => b.nodeType ? b : el('button', { class: 'btn ' + (b.cls || ''), disabled: b.disabled || null, onclick: () => { PK.sfx('click'); finish({ type: 'btn', value: b.value }); } }, b.text)));
      if (o.skills) o.skills.render(true, (k) => finish({ type: 'skill', key: k }));
      if (o.bind) o.bind((v) => finish({ type: 'pick', value: v }));
      if (o.timer && o.secs) o.timer.classList.add('on');
      const iv = setInterval(() => {
        if (!t.alive) return finish({ type: 'closed' });
        if (!o.secs) return;
        left -= 0.25; if (fill) fill.style.width = (left / o.secs) * 100 + '%';
        if (o.timer) o.timer.classList.toggle('hurry', left <= 5);
        if (left <= 5 && left % 1 === 0) PK.sfx('tick');
        if (left <= 0) finish({ type: 'timeout' });
      }, 250);
    });
  };
  /* 單純選一個按鈕 */
  kit.choose = (t, ctrl, title, buttons, o) => kit.ask(t, Object.assign({ ctrl, title, buttons }, o || {})).then((r) => (r.type === 'timeout' || r.type === 'closed' ? buttons[0] && buttons[0].value : r.value));
  /* 用跳出視窗做的決定（也會同步） */
  kit.modalAsk = async function (t, who, title, content, buttons, opts) {
    who = who || t.actor;
    if (t.online && who && who.remote) { const r = await t.net.next(who.seat); return r.value; }
    const v = await PK.modal(title, content, buttons, opts);
    if (t.online && who && !who.isAI) t.net.send(who.seat, { type: 'btn', value: v });
    return v;
  };
  /* 下注籌碼 */
  kit.bet = (t, ctrl, bets, title, who) => {
    const max = PK.user.chips;
    return kit.ask(t, { who, ctrl, title: title || '選擇下注（虛擬籌碼）', buttons: [el('div', { class: 'bet-row' }, bets.map((b) => el('button', { class: 'chip-btn c' + b, disabled: b > max || null, 'data-v': b }, b)))],
      bind: (pick) => PK.$$('.chip-btn', ctrl).forEach((c) => c.addEventListener('click', () => { PK.sfx('chip'); pick(+c.dataset.v); })) }).then((r) => (r.type === 'pick' ? r.value : bets[0]));
  };
  /* 下一局：只等自己按（連線時 20 秒後自動繼續） */
  kit.next = (t, ctrl, text) => kit.ask(t, { local: true, ctrl, secs: t.online ? 20 : 0, buttons: [{ text: (text || '下一局') + (t.online ? '（20 秒後自動開始）' : ''), cls: 'primary big', value: 1 }] });

  /* ---------- 結算（虛擬籌碼） ---------- */
  kit.settle = async function (t, delta, opt) {
    opt = opt || {};
    delta = Math.round(delta);
    const me = t.me;
    if (delta > 0) {
      if (opt.big) { PK.fx.fireworks(6); PK.fx.confetti(140); } else { PK.sfx('win'); PK.fx.firework(innerWidth / 2, innerHeight * 0.35); }
      PK.fx.banner(opt.title || '你贏了！', 'good', '+' + PK.fmt(delta) + ' 籌碼');
      PK.fx.coins(opt.from || null, me.seatEl, 18);
    } else if (delta < 0) {
      PK.sfx('lose'); PK.fx.banner(opt.title || '這局輸了', 'bad', PK.fmt(delta) + ' 籌碼');
    } else PK.fx.banner(opt.title || '平手', 'event', '籌碼不變');
    const refilled = PK.addChips(delta);
    PK.recordGame(t.g.id, delta > 0, delta);
    PK.saveUser();
    if (PK.ch) PK.ch.onSettle(t, delta, opt);
    if (t.online && t.net) t.net.sum(t);
    if (refilled) { await t.wait(1200); PK.toast('籌碼不足，已免費補發 1,000（虛擬計分）', 3200); }
    return delta;
  };
  /* 排名型遊戲的獎勵：第一名拿走其他人的分數 */
  kit.rankReward = (n, place) => (place === 0 ? 100 * (n - 1) : place === n - 1 ? -100 : -50);

  /* 顯示最終排名 */
  kit.ranking = function (t, order, extra) {
    const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
    const box = el('div', { class: 'rank-list' }, order.map((p, i) => el('div', { class: 'rank-row' + (p === t.me ? ' me' : '') }, el('span', { class: 'rank-m' }, medal[i]), el('span', { class: 'rank-av' }, p.avatar), el('b', null, p.name), extra ? el('span', { class: 'rank-x' }, extra(p)) : null)));
    return box;
  };

  /* ---------- 牌的小工具 ---------- */
  kit.render = (p, faceUp, opt) => {
    opt = opt || {};
    const cs = opt.sort ? p.cards.slice().sort(opt.sort) : p.cards; /* 只排序畫面上的順序，不改變真正的手牌順序（連線同步需要） */
    p.handEl.replaceChildren(...cs.map((c, i) => {
      const up = typeof faceUp === 'function' ? faceUp(c, i) : faceUp;
      const e = PK.cardEl(c, up, { small: opt.small });
      if (opt.onClick) { e.classList.add('pickable'); e.addEventListener('click', () => opt.onClick(c, i, e)); }
      if (opt.mark && opt.mark(c, i)) e.classList.add(opt.markCls || 'hint');
      return e;
    }));
  };
  kit.bySuitRank = (a, b) => ('SHDCJ'.indexOf(a.s) - 'SHDCJ'.indexOf(b.s)) || a.r - b.r;
  kit.byRank = (a, b) => a.r - b.r || ('CDHSJ'.indexOf(a.s) - 'CDHSJ'.indexOf(b.s));
})();
