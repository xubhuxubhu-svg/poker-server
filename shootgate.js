/* 牌神擂台 — 射龍門（東方龍宮） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const ANTE = 20;
  const SKILLS = { widen: ['🏯', '加寬龍門', '這一射門柱也算射中', 1], pearl: ['💎', '龍珠', '偷看第三張是小（A～4）、中（5～9）還是大（10～K）', 1], redo: ['🌊', '翻江倒海', '兩根門柱重新翻', 1], tail: ['🐉', '神龍擺尾', '撞柱時不用賠', 1], bell: ['🎐', '風鈴', '射中時獎金加倍', 1] };
  const range = (r) => (r <= 4 ? '小（A～4）' : r <= 9 ? '中（5～9）' : '大（10～K）');

  PK.IMPL.shootgate = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me;
      ps.forEach((p) => (p.chips = 1000));
      let pot = 0, round = 0, deck = [];
      const potEl = el('div', { class: 'pot' }, '🏮 底池 ', el('b', null, '0'));
      const postA = el('div', { class: 'post' }), slot = el('div', { class: 'post slot' }), postB = el('div', { class: 'post' });
      const gate = el('div', { class: 'gate' }, postA, el('div', { class: 'gate-arch' }, slot), postB);
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'sg',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'sg-center' }, potEl, gate, info)],
        me: kit.box(t, me, { cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const setPot = (v) => { pot = Math.max(0, Math.round(v)); PK.$('b', potEl).textContent = PK.fmt(pot); potEl.animate([{ transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 300 }); };
      const draw = () => { if (deck.length < 6) deck = PK.makeDeck(); return deck.pop(); };
      const put = async (box, c) => { box.replaceChildren(); await PK.flyCard(potEl, box, PK.cardEl(c, true), 260); };
      let myDelta = 0;
      const pay = (p, d) => { p.chips += d; if (p === me) myDelta += d; PK.fx.floatText(p.seatEl, (d > 0 ? '+' : '') + PK.fmt(d), d > 0 ? '#7dff9a' : '#ff7b7b'); };
      const ante = async () => {
        t.sys('每人放 ' + ANTE + ' 籌碼進底池');
        for (const p of ps) { pay(p, -ANTE); PK.fx.coins(p.seatEl, potEl, 4); }
        setPot(pot + ANTE * ps.length); await t.wait(500);
      };

      const shoot = async (p) => {
        kit.active(ps, p);
        if (pot < ANTE) await ante();
        let a = draw(), b = draw();
        postA.replaceChildren(); postB.replaceChildren(); slot.replaceChildren();
        await put(postA, a); await put(postB, b);
        PK.voice.say('門柱，' + PK.cardSpeech(a) + '，跟' + PK.cardSpeech(b));
        let widen = false, tail = false, bell = false, guess = null, bet = 0;
        const desc = () => (a.r === b.r ? `兩根門柱一樣（${PK.RANK_TXT[a.r]}），猜下一張比較大或比較小` : `門柱 ${PK.RANK_TXT[Math.min(a.r, b.r)]} 和 ${PK.RANK_TXT[Math.max(a.r, b.r)]}，中間有 ${Math.max(0, Math.abs(a.r - b.r) - 1 + (widen ? 2 : 0))} 種點數`);
        info.textContent = (p === me ? '輪到你射門！' : p.name + ' 射門') + '　' + desc();
        if (!p.isAI) {
          t.actor = p;
          while (true) {
            info.textContent = (p === me ? '輪到你射門！　' : p.name + ' 射門　') + desc();
            const cap = Math.min(pot, PK.user.chips);
            const opts = [10, 50, 100, Math.floor(pot / 2 / 10) * 10, pot].filter((v, i, arr) => v > 0 && v <= cap && arr.indexOf(v) === i);
            const buttons = [{ text: '放棄', value: 0 }];
            opts.forEach((v) => buttons.push({ text: v === pot ? '全押底池 ' + v : '押 ' + v, value: v, cls: v === pot ? 'primary' : '' }));
            const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 25, skills: S, title: '要押多少？（不能超過底池）', buttons });
            if (r.type === 'closed') return;
            if (r.type === 'skill') {
              const k = r.key; S.spend(p, k);
              if (k === 'widen') { widen = true; PK.fx.burst(gate, ['🏯', '✨'], 12); gate.classList.add('wide'); }
              if (k === 'pearl') { if (deck.length < 6) deck = PK.makeDeck(); PK.fx.peek(slot); if (p === me) await PK.modal('龍珠', `<p style="font-size:20px;text-align:center">💎 第三張牌是 <b>${range(deck[deck.length - 1].r)}</b></p>`, [{ text: '知道了', value: 1, cls: 'primary' }]); }
              if (k === 'redo') { PK.fx.burst(gate, ['🌊', '💧'], 16); a = draw(); b = draw(); await put(postA, a); await put(postB, b); }
              if (k === 'tail') { tail = true; PK.fx.burst(p.seatEl, '🐉', 6, { g: 0, speed: 3 }); }
              if (k === 'bell') { bell = true; PK.fx.burst(p.seatEl, '🎐', 6, { g: 0, speed: 3 }); }
              continue;
            }
            bet = r.type === 'timeout' ? 0 : r.value;
            break;
          }
          if (bet && a.r === b.r) guess = await kit.choose(t, L.ctrl, '猜第三張比 ' + PK.RANK_TXT[a.r] + ' 大還是小？', [{ text: '比較大 ⬆', value: 'hi', cls: 'primary big' }, { text: '比較小 ⬇', value: 'lo', cls: 'big' }]);
        } else {
          await t.wait(PK.randInt(600, 1000));
          const lo = Math.min(a.r, b.r), hi = Math.max(a.r, b.r);
          let pr;
          if (a.r === b.r) { guess = a.r >= 7 ? 'lo' : 'hi'; pr = (guess === 'lo' ? a.r - 1 : 13 - a.r) / 13; }
          else pr = (hi - lo - 1) / 13;
          if (t.isParty && pr > 0.3 && pr < 0.6 && p.sk.widen && Math.random() < 0.5) { S.spend(p, 'widen'); widen = true; gate.classList.add('wide'); pr += 2 / 13; }
          const th = [0.5, 0.55, 0.6][t.diff];
          if (t.diff === 0) bet = Math.random() < 0.6 ? PK.pick([10, 50, 100]) : 0;
          else bet = pr >= th ? Math.round(pot * Math.min(1, (pr - 0.35) * (t.diff === 2 ? 2 : 1.2)) / 10) * 10 : pr > 0.4 ? 10 : 0;
          bet = Math.min(bet, pot, p.chips);
          t.say(p, bet ? '押 ' + bet + '！' + (guess ? (guess === 'hi' ? '猜大' : '猜小') : '') : '不押了，放棄');
          await t.wait(500);
        }
        if (!bet) { gate.classList.remove('wide'); kit.setTag(p, '放棄', 'stand'); await t.wait(400); return; }
        p.betEl.textContent = '🪙' + bet;
        info.textContent = '第三張…';
        const c = draw();
        const sq = PK.cardEl(null, false); slot.replaceChildren(); await PK.flyCard(potEl, slot, sq, 300);
        await t.wait(t.isParty ? 700 : 300);
        const f = PK.cardEl(c, true); f.classList.add('flip-in'); sq.replaceWith(f);
        PK.voice.card(c, '', 3);
        const lo = Math.min(a.r, b.r), hi = Math.max(a.r, b.r);
        let res;
        if (a.r === b.r) res = c.r === a.r ? (widen ? 'win' : 'post') : (c.r > a.r) === (guess === 'hi') ? 'win' : 'miss';
        else if (c.r > lo && c.r < hi) res = 'win';
        else if (c.r === lo || c.r === hi) res = widen ? 'win' : 'post';
        else res = 'miss';
        gate.classList.remove('wide');
        if (res === 'win') {
          const w = Math.min(pot, bet * (bell ? 2 : 1));
          setPot(pot - w); pay(p, w);
          PK.fx.burst(gate, ['🐉', '✨', '🪙'], 18); PK.fx.coins(potEl, p.seatEl, 14); PK.sfx('win');
          PK.fx.banner('射中！', 'gold', '+' + w);
          kit.setTag(p, '射中', 'top'); kit.say(t, p, 'good');
        } else if (res === 'post') {
          const l = tail ? 0 : bet * 2;
          PK.fx.lightning(slot); PK.fx.shake(L.wrap, 10);
          PK.fx.banner('撞柱！', 'bad', tail ? '神龍擺尾，免賠！' : '賠雙倍 ' + l);
          if (l) { pay(p, -l); setPot(pot + l); PK.fx.coins(p.seatEl, potEl, 10); }
          kit.setTag(p, '撞柱', 'bust'); kit.say(t, p, 'bad', 0.8);
        } else {
          pay(p, -bet); setPot(pot + bet); PK.sfx('lose'); PK.fx.burst(slot, ['🌊', '💦'], 12); PK.fx.coins(p.seatEl, potEl, 6);
          PK.fx.banner('射偏了', 'bad'); kit.setTag(p, '射偏', 'stand'); kit.say(t, p, 'bad');
        }
        await t.wait(1100);
      };

      while (t.alive) {
        round++; myDelta = 0;
        if (t.isParty && round > 1 && (round - 1) % 3 === 0) S.refill();
        ps.forEach((p) => { p.betEl.textContent = ''; kit.setTag(p, ''); });
        if (pot < ANTE * ps.length) await ante();
        for (const p of ps) { if (!t.alive) return; await shoot(p); }
        kit.active(ps, null);
        info.textContent = '第 ' + round + ' 輪結束';
        await kit.settle(t, myDelta, { title: myDelta > 0 ? '這輪賺到了！' : myDelta < 0 ? '這輪輸了' : '打平' });
        ps.forEach((p) => { if (p.isAI && p.chips < 50) p.chips = 1000; });
        t.sys(`第 ${round} 輪：你 ${myDelta >= 0 ? '+' : ''}${PK.fmt(myDelta)}，底池剩 ${pot}`);
        await kit.next(t, L.ctrl, '下一輪');
      }
    },
  };
})();
