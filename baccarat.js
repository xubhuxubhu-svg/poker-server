/* 牌神擂台 — 百家樂（金色宮殿） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const bv = (c) => (c.r >= 10 ? 0 : c.r);
  const pts = (cards) => cards.reduce((a, c) => a + bv(c), 0) % 10;
  const SIDE = { P: '閒', B: '莊', T: '和' };
  const PAY = { P: 1, B: 0.95, T: 8 };
  const BETS = [10, 50, 100, 200, 500];
  const SKILLS = { peek: ['🤏', '偷看', '下注前偷看閒家第一張牌', 1], regret: ['🔁', '反悔', '看到前四張牌後改押另一邊', 1], shield: ['🛡️', '金盾', '本局押錯退回一半', 1], gold: ['🌟', '天牌金光', '押中天牌（8 或 9 點）時獎金加倍', 1], dbl: ['💰', '加倍', '開牌前把下注加倍', 1] };

  PK.IMPL.baccarat = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me;
      const history = [];
      let round = 0;
      const zone = (k) => {
        const z = { k, hand: el('div', { class: 'hand bac-hand' }), pt: el('div', { class: 'bac-pt' }), cards: [] };
        z.el = el('div', { class: 'bac-zone bac-' + k }, el('div', { class: 'bac-title' }, k === 'P' ? '閒 家' : '莊 家'), z.hand, z.pt);
        return z;
      };
      const P = zone('P'), B = zone('B');
      const road = el('div', { class: 'bac-road' });
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'bac',
        top: el('div', { class: 'bac-table' }, P.el, el('div', { class: 'bac-vs' }, 'VS'), B.el),
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'mid-info' }, info, el('div', { class: 'event-box' }, '閒贏 1 倍・莊贏 0.95 倍・和贏 8 倍')), road],
        me: kit.box(t, me, { cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const drawRoad = () => road.replaceChildren(el('div', { class: 'road-title' }, '路單'), el('div', { class: 'road-grid' }, history.slice(-36).map((h) => el('span', { class: 'road-dot r' + h }, SIDE[h]))));
      drawRoad();
      const showZone = (z, n) => { z.pt.textContent = n == null ? '' : n + ' 點'; };
      const flip = async (z, c, slow) => {
        const e = PK.cardEl(null, false);
        await PK.flyCard(L.wrap, z.hand, e, 260);
        if (slow) {
          e.classList.add('squeeze'); PK.sfx('tick');
          await t.wait(900);
        }
        const f = PK.cardEl(c, true); f.classList.add('flip-in'); e.replaceWith(f);
        z.cards.push(c); showZone(z, pts(z.cards));
        PK.voice.say((z.k === 'P' ? '閒，' : '莊，') + PK.cardSpeech(c), { rate: 1.3 });
      };

      while (t.alive) {
        round++;
        if (t.isParty && round > 1 && (round - 1) % 5 === 0) S.refill();
        const deck = PK.makeDeck({ decks: 2 });
        [P, B].forEach((z) => { z.cards = []; z.hand.replaceChildren(); showZone(z); z.el.classList.remove('win'); });
        ps.forEach((p) => { p.side = null; p.bet = 0; p.shield = p.gold = false; p.betEl.textContent = ''; kit.setTag(p, ''); p.boxEl.classList.remove('winner'); });
        info.textContent = '第 ' + round + ' 局・選擇要押哪一邊';
        /* 每位真人各自選邊、下注（同時進行） */
        const humanBet = async (hp) => {
          let side;
          while (!side) {
            const r = await kit.ask(t, { who: hp, ctrl: L.ctrl, title: '押哪一邊？', skills: S, buttons: [{ text: '押 閒', cls: 'side-P big', value: 'P' }, { text: '押 和', cls: 'side-T big', value: 'T' }, { text: '押 莊', cls: 'side-B big', value: 'B' }] });
            if (r.type === 'closed') return;
            if (r.type === 'timeout') { side = 'B'; break; }
            if (r.type === 'skill') {
              if (r.key !== 'peek') { if (hp === me) PK.toast('這個技能要在開牌時使用'); continue; }
              S.spend(hp, 'peek');
              if (hp === me) await PK.modal('偷看', el('div', { class: 'peek-show' }, el('div', null, '🤏 閒家第一張牌是'), PK.cardEl(deck[deck.length - 1], true)), [{ text: '知道了', value: 1, cls: 'primary' }]);
            } else side = r.value;
          }
          hp.side = side;
          hp.bet = await kit.bet(t, L.ctrl, BETS, '押「' + SIDE[side] + '」多少？（虛擬籌碼）', hp);
        };
        const showBet = (p) => { p.betEl.textContent = p.side ? '押' + SIDE[p.side] + ' 🪙' + p.bet + (p.shield ? ' 🛡️' : '') + (p.gold ? ' 🌟' : '') : ''; };
        await Promise.all(ps.filter((p) => !p.isAI).map(humanBet));
        if (!t.alive) return;
        ps.filter((p) => p.isAI).forEach((p) => {
          const last = history[history.length - 1];
          p.side = t.diff === 2 && last && last !== 'T' && Math.random() < 0.6 ? last : PK.pick(['P', 'B', 'P', 'B', 'T']);
          p.bet = PK.pick(BETS.slice(0, 4));
          if (PK.nrand() < 0.4) t.say(p, '我押' + SIDE[p.side] + '！');
        });
        ps.forEach(showBet);
        info.textContent = '開牌';
        const slow = t.isParty;
        await flip(P, deck.pop()); await flip(B, deck.pop()); await flip(P, deck.pop(), slow); await flip(B, deck.pop(), slow);
        PK.voice.say(`閒${pts(P.cards)}點，莊${pts(B.cards)}點`);
        /* 開牌中可用技能（每位真人各自決定） */
        if (t.isParty) {
          const humanSkill = async (hp) => {
            while (true) {
              const r = await kit.ask(t, { who: hp, ctrl: L.ctrl, title: `閒 ${pts(P.cards)} 點 vs 莊 ${pts(B.cards)} 點`, skills: S, buttons: [{ text: '繼續開牌', cls: 'primary big', value: 1 }], secs: 15, timer: L.timer });
              if (r.type !== 'skill') break;
              const k = r.key;
              if (k === 'peek') { if (hp === me) PK.toast('偷看要在下注前使用'); continue; }
              if (k === 'regret') { const opts = ['P', 'B', 'T'].filter((x) => x !== hp.side); const ns = await kit.choose(t, L.ctrl, '改押哪一邊？', opts.map((x) => ({ text: '改押 ' + SIDE[x], value: x, cls: 'side-' + x })), { who: hp }); S.spend(hp, 'regret'); hp.side = ns; PK.fx.burst(hp.seatEl, '🔁', 8); }
              if (k === 'shield') { S.spend(hp, 'shield'); hp.shield = true; PK.fx.burst(hp.seatEl, '🛡️', 8, { g: 0, speed: 3 }); }
              if (k === 'gold') { S.spend(hp, 'gold'); hp.gold = true; }
              if (k === 'dbl') { S.spend(hp, 'dbl'); hp.bet *= 2; PK.fx.coins(hp.seatEl, null, 10); }
              showBet(hp);
            }
          };
          await Promise.all(ps.filter((p) => !p.isAI).map(humanSkill));
          if (!t.alive) return;
          ps.filter((p) => p.isAI).forEach((p) => { if (Math.random() < 0.2 && p.sk.shield) { S.spend(p, 'shield'); p.shield = true; showBet(p); } });
        }
        /* 補牌規則 */
        let p = pts(P.cards), b = pts(B.cards), natural = p >= 8 || b >= 8;
        if (natural) { PK.fx.banner('天牌！', 'gold', (p >= 8 ? '閒 ' + p : '莊 ' + b) + ' 點'); PK.fx.flash('#ffd700', 400); await t.wait(800); }
        else {
          let p3 = null;
          if (p <= 5) { info.textContent = '閒家補牌'; await t.wait(400); p3 = deck.pop(); await flip(P, p3, slow); }
          b = pts(B.cards);
          let bd;
          if (p3 == null) bd = b <= 5;
          else { const v = bv(p3); bd = b <= 2 || (b === 3 && v !== 8) || (b === 4 && v >= 2 && v <= 7) || (b === 5 && v >= 4 && v <= 7) || (b === 6 && (v === 6 || v === 7)); }
          if (bd) { info.textContent = '莊家補牌'; await t.wait(400); await flip(B, deck.pop(), slow); }
        }
        p = pts(P.cards); b = pts(B.cards);
        const res = p > b ? 'P' : b > p ? 'B' : 'T';
        history.push(res); drawRoad();
        info.textContent = res === 'T' ? `和局！${p} 比 ${b}` : `${SIDE[res]}贏！${p} 比 ${b}`;
        PK.voice.say(res === 'T' ? `${p}比${b}，和局` : `${p}比${b}，${SIDE[res]}贏`, { pri: 3 });
        if (res !== 'T') { (res === 'P' ? P : B).el.classList.add('win'); PK.fx.sparkle((res === 'P' ? P : B).el, '#ffd700', 40); }
        else PK.fx.burst(L.wrap, ['🤝', '✨'], 16);
        await t.wait(700);
        let myD = 0;
        for (const q of ps) {
          let d;
          if (q.side === res) d = q.bet * PAY[res] * (q.gold && natural ? 2 : 1);
          else if (res === 'T') d = 0;
          else d = -q.bet * (q.shield ? 0.5 : 1);
          d = Math.round(d);
          PK.fx.floatText(q.seatEl, (d > 0 ? '+' : '') + PK.fmt(d), d > 0 ? '#7dff9a' : d < 0 ? '#ff7b7b' : '#fff');
          if (d > 0) { q.boxEl.classList.add('winner'); kit.say(t, q, 'win', 0.4); } else if (d < 0) kit.say(t, q, 'bad', 0.3);
          if (q === me) myD = d;
        }
        await kit.settle(t, myD, { big: myD > 0 && (res === 'T' || natural), title: myD > 0 ? '押中了！' : myD < 0 ? '押錯了' : '和局退回' });
        t.sys(`第 ${round} 局：${SIDE[res]}${res === 'T' ? '局' : '贏'}（閒 ${p}・莊 ${b}），你 ${myD >= 0 ? '+' : ''}${PK.fmt(myD)}`);
        await kit.next(t, L.ctrl);
      }
    },
  };
})();
