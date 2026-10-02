/* 牌神擂台 — 二十一點（復古賭城） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const cv = (c) => (c.r >= 10 ? 10 : c.r);
  const total = (cards) => { let s = 0, a = 0; cards.forEach((c) => { s += cv(c); if (c.r === 1) a++; }); while (a > 0 && s + 10 <= 21) { s += 10; a--; } return s; };
  const soft = (cards) => { let s = 0, a = 0; cards.forEach((c) => { s += cv(c); if (c.r === 1) a++; }); return a > 0 && s + 10 <= 21; };
  const isBJ = (cards) => cards.length === 2 && total(cards) === 21;
  const BETS = [10, 50, 100, 200, 500];
  const SKILLS = { peek: ['🔮', '水晶球', '看到下一張牌', 2], swap: ['🔄', '換牌術', '把最後一張換掉', 1], shield: ['🛡️', '保險盾', '本局輸了只輸一半', 1], fountain: ['💸', '金幣噴泉', '本局拿到 21 點時額外多贏 1 倍', 1], xray: ['👁️', '透視莊家', '看莊家的暗牌', 1] };

  PK.IMPL.blackjack = {
    skills: SKILLS,
    async start(t) {
      const dealer = { name: '荷官', isAI: true, avatar: '🎩', level: 5, cards: [] };
      const ps = t.players, me = t.me;
      ps.forEach((p) => { p.chips = 1000; });
      let deck = [], round = 0, initial = false;
      const shoe = el('div', { class: 'deck-pile' }, [0, 1, 2].map(() => PK.cardEl(null, false)));
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        top: kit.box(t, dealer, { cls: 'banker-box' }),
        others: t.others.map((p) => kit.box(t, p)),
        mid: [shoe, el('div', { class: 'mid-info' }, info, el('div', { class: 'event-box' }, '莊家 17 點以上停牌・黑傑克賠 1.5 倍'))],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const draw = () => { if (deck.length < 15) { deck = PK.makeDeck({ decks: 4 }); t.sys('重新洗牌'); } return deck.pop(); };

      /* 畫面 */
      const showDealer = (reveal) => {
        dealer.handEl.replaceChildren(...dealer.cards.map((c, i) => { const e = PK.cardEl(c, i !== 1 || reveal || dealer.xray, { small: true }); if (i === 1 && !reveal && dealer.xray) e.classList.add('peeked'); return e; }));
        dealer.ptsEl.textContent = dealer.cards.length ? (reveal ? total(dealer.cards) + ' 點' : '明牌 ' + total([dealer.cards[0]]) + ' 點') : '';
      };
      const showP = (p) => {
        const big = p === me;
        p.handEl.replaceChildren(...p.hands.map((h, hi) => el('div', { class: 'hand-group' + (p.cur === hi && p.hands.length > 1 ? ' cur' : '') }, h.cards.map((c) => PK.cardEl(c, true, { small: !big })))));
        p.ptsEl.textContent = p.hands.map((h) => total(h.cards) + (soft(h.cards) && total(h.cards) < 21 ? '(軟)' : '')).join(' ／ ');
        const st = p.hands.map((h) => ({ bust: '爆牌', bj: '黑傑克', stand: '停牌', dbl: '加倍' }[h.st] || '')).filter(Boolean).join('・');
        kit.setTag(p, st, p.hands.some((h) => h.st === 'bj') ? 'top' : p.hands.every((h) => h.st === 'bust') ? 'bust' : 'stand');
        p.betEl.textContent = p.hands.length ? '🪙' + p.hands.map((h) => h.bet).join('+') + (p.shield ? ' 🛡️' : '') + (p.fountain ? ' 💸' : '') : '';
      };
      const deal = async (p, hi, up) => {
        const c = draw();
        const target = p === dealer ? dealer.handEl : (PK.$$('.hand-group', p.handEl)[hi] || p.handEl);
        await PK.flyCard(shoe, target, null, 240);
        if (p === dealer) { dealer.cards.push(c); showDealer(false); } else { p.hands[hi].cards.push(c); showP(p); }
        if (!initial && (p !== dealer || dealer.cards.length > 2)) PK.voice.card(c, p === dealer ? '' : total(p.hands[hi].cards) + '點');
        return c;
      };
      const judge = (p, h) => {
        const s = total(h.cards);
        if (s > 21) { h.st = 'bust'; PK.sfx('bust'); PK.fx.burst(p.handEl, ['💥', '🎲', '💢'], 14); PK.fx.shake(p.boxEl, 8); if (p === me) PK.fx.banner('爆牌！', 'bad', s + ' 點'); else kit.say(t, p, 'bad'); return true; }
        if (s === 21) { if (h.st !== 'dbl') h.st = 'stand'; PK.sfx('win'); PK.fx.sparkle(p.handEl, '#ffd700', 40); if (p === me) PK.fx.banner('21 點！', 'gold'); return true; }
        return h.st === 'dbl';
      };

      /* 玩家回合 */
      const humanTurn = async (me) => {
        t.actor = me;
        for (let hi = 0; hi < me.hands.length; hi++) {
          me.cur = hi; showP(me);
          const h = me.hands[hi];
          if (h.cards.length === 1) { await deal(me, hi); if (h.splitAce) { h.st = 'stand'; continue; } }
          if (h.st) continue;
          while (!h.st) {
            const canDbl = h.cards.length === 2;
            const canSplit = me.hands.length === 1 && h.cards.length === 2 && cv(h.cards[0]) === cv(h.cards[1]);
            const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 25, skills: S, buttons: [
              { text: '要牌', cls: 'primary big', value: 'hit' }, { text: '停牌', cls: 'big', value: 'stand' },
              { text: '加倍', value: 'dbl', disabled: !canDbl }, { text: '分牌', value: 'split', disabled: !canSplit }] });
            if (r.type === 'closed') return;
            if (r.type === 'timeout' || r.value === 'stand') { h.st = 'stand'; break; }
            if (r.type === 'skill') { await useSkill(me, r.key, h, hi); continue; }
            if (r.value === 'hit') { await deal(me, hi); judge(me, h); }
            if (r.value === 'dbl') { h.bet *= 2; h.st = 'dbl'; PK.fx.coins(me.seatEl, null, 10); await deal(me, hi); judge(me, h); }
            if (r.value === 'split') {
              const c2 = h.cards.pop(); me.hands.push({ cards: [c2], bet: h.bet, st: '', splitAce: c2.r === 1 }); h.splitAce = c2.r === 1;
              PK.sfx('skill'); PK.fx.burst(me.handEl, ['✂️', '✨'], 10); showP(me);
              await deal(me, hi);
              if (h.splitAce) { h.st = 'stand'; break; }
            }
            showP(me);
          }
          showP(me);
        }
        me.cur = -1; showP(me);
      };
      const useSkill = async (p, k, h, hi) => {
        if (!S.spend(p, k)) return;
        if (k === 'peek') {
          const c = deck[deck.length - 1];
          if (p === me) { PK.fx.peek(shoe); await PK.modal('水晶球', el('div', { class: 'peek-show' }, el('div', null, '🔮 下一張牌是'), PK.cardEl(c, true)), [{ text: '知道了', value: 1, cls: 'primary' }]); }
          return c;
        }
        if (k === 'swap') {
          if (h.cards.length < 3) { p.sk.swap++; if (p === me) PK.toast('要先拿到第三張牌才能換'); return; }
          deck.unshift(h.cards.pop()); PK.fx.burst(p.handEl, ['🌀', '✨'], 10); showP(p); await t.wait(250); await deal(p, hi);
          judge(p, h);
        }
        if (k === 'shield') { p.shield = true; PK.fx.burst(p.seatEl, '🛡️', 8, { g: 0, speed: 3 }); }
        if (k === 'fountain') { p.fountain = true; PK.fx.coins(p.seatEl, null, 10); }
        if (k === 'xray') { if (p === me) { dealer.xray = true; showDealer(false); t.sys('莊家的暗牌是 ' + PK.cardName(dealer.cards[1])); } PK.fx.peek(dealer.handEl); }
        showP(p);
      };
      const aiTurn = async (p) => {
        const h = p.hands[0];
        if (t.isParty && Math.random() < 0.15) await useSkill(p, 'shield', h, 0);
        while (!h.st) {
          await t.wait(PK.randInt(450, 800));
          const s = total(h.cards), up = cv(dealer.cards[0]) === 1 ? 11 : cv(dealer.cards[0]);
          let act;
          if (t.diff === 0) act = s < PK.randInt(13, 17) ? 'hit' : 'stand';
          else if (t.diff === 1) act = s < 17 ? 'hit' : 'stand';
          else act = soft(h.cards) ? (s <= 17 ? 'hit' : 'stand') : s <= 11 ? (h.cards.length === 2 && s >= 10 && up < 10 ? 'dbl' : 'hit') : s <= 16 && up >= 7 ? 'hit' : s === 12 && up <= 3 ? 'hit' : 'stand';
          if (act === 'stand') { h.st = 'stand'; kit.say(t, p, 'think', 0.3); break; }
          if (act === 'dbl') { h.bet *= 2; h.st = 'dbl'; t.say(p, '加倍！'); }
          await deal(p, 0);
          if (t.isParty && total(h.cards) > 21 && p.sk.swap && h.cards.length >= 3 && Math.random() < 0.6) { await useSkill(p, 'swap', h, 0); continue; }
          judge(p, h);
        }
        showP(p);
      };

      /* 每一局 */
      while (t.alive) {
        round++;
        if (t.isParty && round > 1 && (round - 1) % 5 === 0) S.refill();
        dealer.cards = []; dealer.xray = false; showDealer(false); dealer.ptsEl.textContent = '';
        ps.forEach((p) => { p.hands = []; p.shield = p.fountain = false; p.cur = -1; p.boxEl.classList.remove('winner'); showP(p); kit.setTag(p, ''); });
        info.textContent = '第 ' + round + ' 局・請下注';
        const bets = await Promise.all(ps.map((p) => (p.isAI ? PK.pick(BETS.slice(0, 4)) : kit.bet(t, L.ctrl, BETS, null, p))));
        ps.forEach((p, i) => (p.hands = [{ cards: [], bet: bets[i], st: '' }]));
        ps.forEach(showP);
        info.textContent = '發牌中';
        initial = true;
        for (let k = 0; k < 2; k++) { for (const p of ps) await deal(p, 0); await deal(dealer); }
        initial = false;
        PK.voice.say('你的牌，' + me.hands[0].cards.map(PK.cardSpeech).join('、') + '，' + total(me.hands[0].cards) + '點');
        ps.forEach((p) => { const h = p.hands[0]; if (isBJ(h.cards)) { h.st = 'bj'; showP(p); PK.fx.sparkle(p.handEl, '#ffd700', 40); if (p === me) { PK.fx.banner('黑傑克！', 'gold', '賠 1.5 倍'); PK.fx.fireworks(3); PK.ch.emit('bj'); } else if (p.isAI) t.say(p, '黑傑克！'); else PK.fx.floatText(p.seatEl, '黑傑克！', '#ffd700'); } });
        for (const p of ps) {
          if (p.hands[0].st) continue;
          kit.active([dealer, ...ps], p);
          info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
          if (p.isAI) await aiTurn(p); else await humanTurn(p);
        }
        /* 莊家 */
        kit.active([dealer, ...ps], dealer); info.textContent = '荷官亮牌';
        await t.wait(400); showDealer(true); PK.voice.say('荷官' + total(dealer.cards) + '點'); await t.wait(700);
        const anyAlive = ps.some((p) => p.hands.some((h) => h.st !== 'bust'));
        while (anyAlive && (total(dealer.cards) < 17)) { await deal(dealer); showDealer(true); await t.wait(400); }
        const ds = total(dealer.cards), dBJ = isBJ(dealer.cards);
        if (ds > 21) { PK.sfx('bust'); PK.fx.burst(dealer.handEl, ['💥', '🎩'], 16); PK.fx.banner('莊家爆牌！', 'good'); }
        else if (dBJ) PK.fx.banner('莊家黑傑克', 'bad');
        /* 結算 */
        info.textContent = '結算'; kit.active([dealer, ...ps], null);
        let myDelta = 0, myBig = false;
        for (const p of ps) {
          let d = 0;
          for (const h of p.hands) {
            const s = total(h.cards);
            let k;
            if (h.st === 'bust') k = -1;
            else if (h.st === 'bj') k = dBJ ? 0 : 1.5;
            else if (dBJ) k = -1;
            else if (ds > 21 || s > ds) k = 1;
            else if (s === ds) k = 0;
            else k = -1;
            if (k > 0 && p.fountain && s === 21) k += 1;
            if (k < 0 && p.shield) k = -0.5;
            d += h.bet * k;
            if (p === me && k >= 1.5) myBig = true;
          }
          d = Math.round(d); p.chips += d;
          PK.fx.floatText(p.seatEl, (d > 0 ? '+' : '') + PK.fmt(d), d > 0 ? '#7dff9a' : d < 0 ? '#ff7b7b' : '#fff');
          if (d > 0) { p.boxEl.classList.add('winner'); PK.fx.coins(dealer.seatEl, p.seatEl, 10); kit.say(t, p, 'win', 0.4); }
          if (p === me) myDelta = d;
          await t.wait(200);
        }
        await kit.settle(t, myDelta, { big: myBig, title: myDelta > 0 ? '你贏了！' : myDelta < 0 ? '這局輸了' : '平手退回' });
        ps.forEach((p) => { if (p.isAI && p.chips < 10) p.chips = 1000; });
        t.sys(`第 ${round} 局：你 ${myDelta >= 0 ? '+' : ''}${PK.fmt(myDelta)}，莊家 ${ds > 21 ? '爆牌' : ds + ' 點'}`);
        await kit.next(t, L.ctrl);
      }
    },
  };
})();
