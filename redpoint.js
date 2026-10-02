/* 牌神擂台 — 撿紅點（年節喜慶） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { rain: ['🧧', '紅包雨', '這回合吃到的分數加倍', 1], cracker: ['🧨', '鞭炮炸桌', '炸掉桌上一張牌', 1], dragon: ['🐉', '舞龍搶牌', '從分數最高的對手搶一張有分的牌', 1], luck: ['🍊', '大吉大利', '這回合翻牌一定吃得到', 1], lantern: ['🏮', '燈籠照路', '偷看牌堆最上面兩張', 1] };
  const match = (a, b) => (a.r <= 9 && b.r <= 9 ? a.r + b.r === 10 : a.r >= 10 && a.r === b.r);
  const pts = (c) => (c.s === 'S' && c.r === 1 ? 40 : c.s === 'H' || c.s === 'D' ? (c.r === 1 ? 20 : c.r >= 10 ? 10 : c.r) : 0);

  PK.IMPL.redpoint = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      let deck, table;
      const tableEl = el('div', { class: 'rp-table' });
      const deckEl = el('div', { class: 'deck-pile' }, [0, 1, 2].map(() => PK.cardEl(null, false)));
      const deckCnt = el('div', { class: 'rp-cnt' });
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'rp',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'rp-deck' }, deckEl, deckCnt), el('div', { class: 'rp-mid' }, info, tableEl)],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const score = (p) => p.won.reduce((a, c) => a + pts(c), 0) + (p.bonus || 0);
      const drawTable = (pickable, onPick) => tableEl.replaceChildren(...table.map((c) => {
        const e = PK.cardEl(c, true); if (pts(c)) e.classList.add('has-pts');
        if (pickable && pickable.includes(c)) { e.classList.add('playable'); e.addEventListener('click', () => onPick(c)); }
        return e;
      }));
      const show = (p) => {
        if (p === me) kit.render(me, true, { onClick: (c) => me.pick && me.pick(c), mark: (c) => me.pick && table.some((x) => match(c, x)), markCls: 'playable' });
        else p.handEl.replaceChildren(...p.cards.map(() => PK.cardEl(null, false, { small: true })));
        p.ptsEl.textContent = '🧧 ' + score(p) + ' 分';
        deckCnt.textContent = '牌堆 ' + deck.length;
      };
      const capture = async (p, c, target, fromEl) => {
        table.splice(table.indexOf(target), 1); drawTable();
        await PK.flyCard(fromEl || tableEl, p.seatEl, null, 300);
        p.won.push(c, target);
        const v = pts(c) + pts(target);
        if (p.rainTurn && v) p.bonus = (p.bonus || 0) + v;
        PK.voice.card(c, '吃' + PK.cardSpeech(target));
        if (v) {
          PK.sfx('chip'); PK.fx.burst(p.seatEl, v >= 20 ? ['🧨', '💥', '🧧', '✨'] : ['🧧', '✨'], v >= 20 ? 20 : 10);
          PK.fx.floatText(p.seatEl, '+' + (p.rainTurn ? v * 2 : v) + ' 分', '#ffd34d');
          if (v >= 40) { PK.fx.banner('大紅點！', 'gold', '+' + v); }
        } else PK.sfx('deal');
        show(p);
      };
      const toTable = async (p, c, fromEl) => { await PK.flyCard(fromEl || p.handEl, tableEl, null, 250); table.push(c); drawTable(); PK.voice.card(c); };
      const bestTarget = (c) => table.filter((x) => match(c, x)).sort((a, b) => pts(b) - pts(a))[0];

      /* 出一張手牌 */
      const playHand = async (p, c, target) => {
        p.cards.splice(p.cards.indexOf(c), 1); show(p);
        if (target) await capture(p, c, target, p.handEl); else await toTable(p, c);
      };
      /* 翻牌堆 */
      const flip = async (p) => {
        if (!deck.length) return;
        if (p.luck) {
          p.luck = false;
          let best = -1, bi = -1;
          deck.forEach((c, i) => { const tg = bestTarget(c); if (tg) { const v = pts(c) + pts(tg); if (v > best) { best = v; bi = i; } } });
          if (bi >= 0) { const [c] = deck.splice(bi, 1); deck.push(c); PK.fx.burst(deckEl, ['🍊', '✨'], 10); }
        }
        const c = deck.pop(); show(p);
        const e = PK.cardEl(c, true); e.classList.add('flip-in', 'rp-flipped');
        deckEl.append(e); await t.wait(600); e.remove();
        const tg = bestTarget(c);
        if (tg) await capture(p, c, tg, deckEl); else await toTable(p, c, deckEl);
      };
      const useSkill = async (p, k) => {
        if (!S.spend(p, k)) return;
        if (k === 'rain') { p.rainTurn = true; for (let i = 0; i < 3; i++) setTimeout(() => PK.fx.burst({ getBoundingClientRect: () => ({ left: PK.rand(0, innerWidth), top: 0, width: 0, height: 0 }) }, '🧧', 8, { up: -2, g: 0.15 }), i * 200); }
        if (k === 'cracker') {
          if (!table.length) return;
          let c;
          if (!p.isAI) { const r = await kit.ask(t, { who: p, ctrl: L.ctrl, title: '🧨 點一張要炸掉的桌上牌', secs: 20, timer: L.timer, bind: (pick) => drawTable(table, pick), cleanup: () => drawTable() }); c = r.type === 'pick' ? r.value : table[0]; }
          else c = table.slice().sort((a, b) => pts(b) - pts(a))[0];
          PK.sfx('boom'); PK.fx.burst(tableEl, ['🧨', '💥', '🔥'], 20); PK.fx.shake(tableEl, 8);
          table.splice(table.indexOf(c), 1); drawTable(); L.ctrl.replaceChildren();
        }
        if (k === 'dragon') {
          const v = ps.filter((x) => x !== p).sort((a, b) => score(b) - score(a))[0];
          const good = v.won.filter((c) => pts(c) > 0);
          if (!good.length) { if (p === me) PK.toast('對手還沒有分數牌'); return; }
          const c = good.sort((a, b) => pts(b) - pts(a))[t.diff === 0 && p.isAI ? good.length - 1 : 0];
          v.won.splice(v.won.indexOf(c), 1); p.won.push(c);
          await PK.flyCard(v.seatEl, p.seatEl, null, 400); PK.fx.burst(p.seatEl, ['🐉', '🧧'], 12);
          show(v); show(p); if (v.isAI) t.say(v, '我的紅點被搶了！');
        }
        if (k === 'luck') { p.luck = true; PK.fx.burst(p.seatEl, '🍊', 8, { g: 0, speed: 3 }); }
        if (k === 'lantern' && p === me) {
          PK.fx.peek(deckEl);
          await PK.modal('燈籠照路', el('div', { class: 'peek-show' }, el('div', null, '🏮 牌堆最上面兩張'), el('div', { class: 'row-cards' }, deck.slice(-2).reverse().map((c) => PK.cardEl(c, true)))), [{ text: '知道了', value: 1, cls: 'primary' }]);
        }
      };
      const aiTurn = async (p) => {
        await t.wait(PK.randInt(500, 850));
        if (t.isParty && Math.random() < 0.15) { const k = PK.pick(['rain', 'cracker', 'dragon', 'luck']); if (p.sk[k]) await useSkill(p, k); }
        let best = null, bv = -1;
        for (const c of p.cards) { const tg = bestTarget(c); if (tg) { const v = pts(c) + pts(tg) + (t.diff === 0 ? Math.random() * 30 : 0.5); if (v > bv) { bv = v; best = [c, tg]; } } }
        if (best) await playHand(p, best[0], best[1]);
        else {
          const risk = (c) => pts(c) * 2 + (t.diff === 2 ? p.cards.filter((x) => match(x, c)).length * -3 : 0) + Math.random();
          await playHand(p, p.cards.slice().sort((a, b) => risk(a) - risk(b))[0], null);
        }
        await t.wait(300);
        await flip(p);
      };
      const humanTurn = async (me) => {
        t.actor = me;
        while (true) {
          const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 25, skills: S, title: me.cards.some((c) => table.some((x) => match(c, x))) ? '點一張發亮的牌吃桌上的牌（也可以出別張放到桌上）' : '沒有牌可以吃，點一張牌放到桌上',
            bind: (pick) => { me.pick = pick; show(me); }, cleanup: () => { me.pick = null; show(me); } });
          if (r.type === 'closed') return;
          if (r.type === 'skill') { await useSkill(me, r.key); continue; }
          const c = r.type === 'timeout' ? me.cards[0] : r.value;
          const ms = table.filter((x) => match(c, x));
          let tg = ms[0] || null;
          if (ms.length > 1) { const r2 = await kit.ask(t, { ctrl: L.ctrl, title: '要吃桌上哪一張？', secs: 20, timer: L.timer, bind: (pick) => drawTable(ms, pick), cleanup: () => drawTable() }); tg = r2.type === 'pick' ? r2.value : ms[0]; }
          L.ctrl.replaceChildren();
          await playHand(me, c, tg);
          await t.wait(300);
          await flip(me);
          return;
        }
      };

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        deck = PK.makeDeck(); table = [];
        const hand = { 2: 12, 3: 8, 4: 6 }[n];
        ps.forEach((p) => { p.cards = deck.splice(0, hand); p.cards.sort(kit.byRank); p.won = []; p.bonus = 0; p.boxEl.classList.remove('winner'); });
        table = deck.splice(0, 4);
        ps.forEach(show); drawTable(); PK.sfx('deal');
        let cur = PK.randInt(0, n - 1);
        while (t.alive && ps.some((p) => p.cards.length)) {
          const p = ps[cur];
          if (p.cards.length) {
            kit.active(ps, p); info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
            if (p.isAI) await aiTurn(p); else await humanTurn(p);
            p.rainTurn = false;
          }
          cur = (cur + 1) % n;
        }
        kit.active(ps, null);
        const order = ps.slice().sort((a, b) => score(b) - score(a));
        order[0].boxEl.classList.add('winner');
        info.textContent = order[0].name + ' 紅點最多！';
        if (order[0] === me) PK.fx.burst(me.seatEl, ['🧧', '🧨', '🎊'], 30);
        const place = order.indexOf(me);
        if (score(me) >= 60) PK.ch.emit('rp60');
        await t.wait(800);
        await kit.settle(t, kit.rankReward(n, place), { big: place === 0, title: place === 0 ? '紅點最多，你贏了！' : '第 ' + (place + 1) + ' 名' });
        await PK.modal('本局排名', kit.ranking(t, order, (p) => score(p) + ' 分'), [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
