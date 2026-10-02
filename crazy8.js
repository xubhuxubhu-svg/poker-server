/* 牌神擂台 — 瘋狂八（糖果卡通） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { rainbow: ['🌈', '彩虹變色', '下一張出的牌可以當 8 使用', 1], freeze: ['❄️', '冰凍', '讓下一家停一回合', 2], bomb: ['🍭', '糖果炸彈', '所有對手各摸一張', 1], gift: ['🎁', '驚喜包', '把一張手牌送給對手', 1], wind: ['🔄', '大風吹', '所有人的手牌往下一家傳', 1] };

  PK.IMPL.crazy8 = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      let deck, pile, suit, dir, cur, finished, pendingSkip, rainbow;
      const drawEl = el('div', { class: 'deck-pile c8-draw' }, [0, 1, 2].map(() => PK.cardEl(null, false)));
      const topEl = el('div', { class: 'c8-top' });
      const suitEl = el('div', { class: 'c8-suit' });
      const dirEl = el('div', { class: 'c8-dir' });
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'c8',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [drawEl, topEl, el('div', { class: 'mid-info' }, info, suitEl, dirEl)],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const top = () => pile[pile.length - 1];
      const ok = (c, rb) => rb || c.r === 8 || c.s === suit || c.r === top().r;
      const nextIdx = (i, k) => { let j = i; for (let s = 0; s < (k || 1); s++) { do { j = (j + dir + n) % n; } while (finished.includes(ps[j])); } return j; };
      const show = (p) => {
        if (p === me) {
          kit.render(me, true, { sort: kit.bySuitRank, onClick: (c) => me.pick && me.pick(c), mark: (c) => me.pick && (me.giftMode || ok(c, me.rainbow)), markCls: 'playable' });
        } else {
          p.handEl.replaceChildren(...p.cards.slice(0, 8).map(() => PK.cardEl(null, false, { small: true })));
        }
        p.ptsEl.textContent = p.cards.length + ' 張';
        p.boxEl.classList.toggle('last-card', p.cards.length === 1);
      };
      const showTop = () => {
        topEl.replaceChildren(PK.cardEl(top(), true));
        suitEl.replaceChildren('目前花色：', el('b', { class: suit === 'H' || suit === 'D' ? 'red' : '' }, PK.SUITS[suit] + ' ' + PK.SUIT_NAME[suit]));
        dirEl.textContent = dir === 1 ? '出牌方向 ➡' : '出牌方向 ⬅';
      };
      const draw = async (p, k) => {
        for (let i = 0; i < (k || 1); i++) {
          if (!deck.length) { const keep = pile.pop(); deck = PK.shuffle(pile); pile = [keep]; t.sys('牌堆用完，重新洗牌'); }
          if (!deck.length) return;
          p.cards.push(deck.pop());
          await PK.flyCard(drawEl, p.handEl, null, 200); show(p);
        }
      };
      const chooseSuit = async (p) => {
        if (!p.isAI) return kit.choose(t, L.ctrl, '指定下一個花色', 'SHDC'.split('').map((s) => ({ text: PK.SUITS[s] + ' ' + PK.SUIT_NAME[s], value: s, cls: 'suit-btn s' + s })), { who: p });
        const cnt = {}; p.cards.forEach((c) => (cnt[c.s] = (cnt[c.s] || 0) + 1));
        return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || PK.pick('SHDC'.split(''));
      };
      /* 出牌與功能效果 */
      const play = async (p, c, rb) => {
        p.cards.splice(p.cards.indexOf(c), 1);
        await PK.flyCard(p.handEl, topEl, null, 260);
        pile.push(c); suit = c.s; show(p); showTop();
        PK.voice.card(c);
        if (c.r === 8 || rb) {
          suit = await chooseSuit(p); showTop();
          PK.fx.burst(topEl, ['🌈', '🍬', '🍭', '✨'], 22); PK.sfx('skill');
          PK.fx.banner(rb ? '彩虹變色！' : '瘋狂八！', 'event', '花色變成 ' + PK.SUITS[suit]);
          PK.voice.say('換成' + PK.SUIT_NAME[suit]);
        } else if (c.r === 1 && n > 2) { dir = -dir; showTop(); PK.fx.burst(topEl, '🔄', 10); PK.fx.banner('迴轉！', 'event'); }
        else if (c.r === 2) { const v = ps[nextIdx(ps.indexOf(p))]; PK.fx.burst(v.seatEl, ['💥', '🍬'], 14); PK.fx.banner('+2！', 'bad', v.name + ' 摸兩張'); PK.fx.shake(v.boxEl); await draw(v, 2); pendingSkip = true; }
        else if (c.r === 12 || (c.r === 1 && n === 2)) { const v = ps[nextIdx(ps.indexOf(p))]; PK.fx.burst(v.seatEl, ['❄️', '🧊'], 14); PK.fx.banner('跳過！', 'event', v.name + ' 停一回合'); pendingSkip = true; }
        else PK.sfx('deal');
        if (p.cards.length === 1) { PK.sfx('event'); PK.fx.banner('最後一張！', 'event', p.name); PK.fx.spotlight(p.boxEl, 1200); if (p.isAI) t.say(p, '最後一張囉～'); }
      };
      const useSkill = async (p, k) => {
        if (!S.spend(p, k)) return;
        const others = ps.filter((x) => x !== p && !finished.includes(x));
        if (k === 'rainbow') { p.rainbow = true; PK.fx.burst(p.seatEl, '🌈', 10); }
        if (k === 'freeze') { pendingSkip = true; const v = ps[nextIdx(ps.indexOf(p))]; PK.fx.burst(v.seatEl, ['❄️', '🧊'], 16); v.boxEl.classList.add('frozen'); setTimeout(() => v.boxEl.classList.remove('frozen'), 2500); }
        if (k === 'bomb') { PK.sfx('boom'); for (const v of others) { PK.fx.burst(v.seatEl, ['🍭', '🍬', '💥'], 12); await draw(v, 1); } }
        if (k === 'gift') {
          let c;
          if (!p.isAI) { const r = await kit.ask(t, { who: p, ctrl: L.ctrl, title: '🎁 點一張要送給對手的牌', secs: 20, timer: L.timer, bind: (pick) => { me.giftMode = true; me.pick = pick; show(me); }, cleanup: () => { me.giftMode = false; me.pick = null; show(me); } }); c = r.type === 'pick' ? r.value : p.cards[0]; }
          else c = p.cards.slice().sort((a, b) => (b.r === 8) - (a.r === 8))[p.cards.length - 1];
          const v = others.slice().sort((a, b) => a.cards.length - b.cards.length)[0];
          p.cards.splice(p.cards.indexOf(c), 1); v.cards.push(c);
          await PK.flyCard(p.seatEl, v.handEl, null, 300); PK.fx.burst(v.seatEl, '🎁', 8); show(p); show(v);
          if (p.isAI) t.say(p, '送你一份驚喜～');
        }
        if (k === 'wind') {
          const act = ps.filter((x) => !finished.includes(x)); const hands = act.map((x) => x.cards);
          act.forEach((x, i) => (x.cards = hands[(i - dir + act.length) % act.length]));
          PK.fx.burst(L.wrap, ['🌪️', '🍃', '🍬'], 24); PK.fx.shake(L.wrap, 6); act.forEach(show);
        }
      };

      const humanTurn = async (me) => {
        t.actor = me;
        let drew = false;
        while (true) {
          const playable = me.cards.filter((c) => ok(c, me.rainbow));
          const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 30, skills: S,
            title: playable.length ? '點一張發亮的牌出牌' : drew ? '摸到的牌不能出' : '沒有牌可以出，請摸牌',
            buttons: [drew ? { text: '過', cls: 'big', value: 'pass' } : { text: '摸牌', cls: playable.length ? 'big' : 'primary big', value: 'draw' }],
            bind: (pick) => { me.pick = (c) => ok(c, me.rainbow) ? pick(c) : PK.toast('這張不能出（要同花色、同點數或 8）'); show(me); },
            cleanup: () => { me.pick = null; show(me); } });
          if (r.type === 'closed') return;
          if (r.type === 'skill') { await useSkill(me, r.key); if (!me.cards.length) return; continue; }
          if (r.type === 'pick') { const rb = me.rainbow && r.value.r !== 8 && !(r.value.s === suit || r.value.r === top().r); if (rb) me.rainbow = false; await play(me, r.value, rb); return; }
          if (r.type === 'timeout') { if (playable.length) await play(me, playable[0]); else if (!drew) await draw(me); return; }
          if (r.value === 'draw') { await draw(me); drew = true; if (!me.cards.filter((c) => ok(c, me.rainbow)).length) { await t.wait(400); return; } continue; }
          if (r.value === 'pass') return;
        }
      };
      const aiTurn = async (p) => {
        await t.wait(PK.randInt(550, 950));
        const others = ps.filter((x) => x !== p && !finished.includes(x));
        const danger = others.some((x) => x.cards.length <= 2);
        if (t.isParty && danger && Math.random() < 0.45) { const k = PK.pick(['freeze', 'bomb']); if (p.sk[k]) await useSkill(p, k); }
        let pl = p.cards.filter((c) => ok(c));
        if (!pl.length) { await draw(p); pl = p.cards.filter((c) => ok(c)); if (!pl.length) { kit.say(t, p, 'bad', 0.3); return; } await t.wait(300); }
        let c;
        if (t.diff === 0) c = PK.pick(pl);
        else {
          const nxt = ps[nextIdx(ps.indexOf(p))];
          const score = (x) => (x.r === 8 ? -5 : 0) + (t.diff === 2 && nxt.cards.length <= 3 && (x.r === 2 || x.r === 12) ? 10 : 0) + p.cards.filter((y) => y.s === x.s).length;
          c = pl.sort((a, b) => score(b) - score(a))[0];
        }
        await play(p, c);
      };

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        deck = PK.makeDeck(); pile = []; dir = 1; finished = []; pendingSkip = false; ps.forEach((p) => (p.rainbow = false));
        ps.forEach((p) => { p.cards = []; p.boxEl.classList.remove('winner', 'last-card'); kit.setTag(p, ''); });
        const hand = n === 2 ? 7 : 5;
        info.textContent = '發牌中';
        for (let i = 0; i < hand; i++) for (const p of ps) { p.cards.push(deck.pop()); }
        ps.forEach(show); PK.sfx('deal');
        let first = deck.pop(); while (first.r === 8) { deck.unshift(first); first = deck.pop(); }
        pile.push(first); suit = first.s; showTop();
        cur = PK.randInt(0, n - 1);
        t.sys(ps[cur].name + ' 先出牌');
        while (t.alive && finished.length < 1) {
          const p = ps[cur];
          kit.active(ps, p); info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
          if (p.isAI) await aiTurn(p); else await humanTurn(p);
          if (!p.cards.length) { finished.push(p); break; }
          let k = 1; if (pendingSkip) { k = 2; pendingSkip = false; }
          cur = nextIdx(cur, k);
        }
        kit.active(ps, null);
        const winner = finished[0];
        winner.boxEl.classList.add('winner');
        const order = [winner, ...ps.filter((p) => p !== winner).sort((a, b) => a.cards.length - b.cards.length)];
        const place = order.indexOf(me);
        if (winner === me) PK.fx.confetti(160); else if (winner.isAI) t.say(winner, PK.cpick(kit.LINES.win));
        info.textContent = winner.name + ' 出完牌了！';
        await kit.settle(t, kit.rankReward(n, place), { big: place === 0, title: place === 0 ? '你贏了！' : '第 ' + (place + 1) + ' 名' });
        await PK.modal('本局排名', kit.ranking(t, order, (p) => '剩 ' + p.cards.length + ' 張'), [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
