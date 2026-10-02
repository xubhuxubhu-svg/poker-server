/* 牌神擂台 — 黑桃王（黑色爵士） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit, TK = PK.trick;
  const SKILLS = { sax: ['🎷', '薩克斯風', '這局我方叫墩成功時分數加倍', 1], summon: ['♠️', '王牌召喚', '指定一張手牌，出牌時當成黑桃（王牌）', 1], owl: ['🌙', '夜貓', '偷看隊友的手牌', 1], improv: ['🎤', '即興', '修改一次自己的叫墩數', 1] };

  PK.IMPL.spades = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me;
      const team = (p) => ps.indexOf(p) % 2; // 坐對面的兩人一隊
      const mi = ps.indexOf(me), MT = team(me), OT = 1 - MT;
      const partner = (p) => ps[(ps.indexOf(p) + 2) % 4];
      const tot = [0, 0];
      const board = el('div', { class: 'sp-board' });
      const L = kit.compass(t, ps, { cls: 'sp', top: board });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      let broken, played, hand = 0, dealer = 3;
      const drawBoard = () => {
        const tb = (k) => ps.filter((p) => team(p) === k).reduce((a, p) => a + (p.bid > 0 ? p.bid : 0), 0);
        const tt = (k) => ps.filter((p) => team(p) === k && p.bid !== 0).reduce((a, p) => a + p.tricks, 0);
        board.replaceChildren(
          el('div', { class: 'sp-team us' }, '🎷 我方（你＋' + partner(me).name + '）', el('b', null, ' 叫 ' + tb(MT) + '・吃 ' + tt(MT)), el('span', null, '　總分 ' + tot[MT])),
          el('div', { class: 'sp-team them' }, '🎺 對手（' + ps[(mi + 1) % 4].name + '＋' + ps[(mi + 3) % 4].name + '）', el('b', null, ' 叫 ' + tb(OT) + '・吃 ' + tt(OT)), el('span', null, '　總分 ' + tot[OT])));
      };
      const show = (p, onClick, mark) => {
        if (p === me) { me.handEl.replaceChildren(...TK.sortHand(me.cards.slice()).map((c) => { const e = PK.cardEl(c, true); if (c.asTrump) e.classList.add('as-trump'); if (mark && mark(c)) e.classList.add('playable'); if (onClick) { e.classList.add('pickable'); e.addEventListener('click', () => onClick(c)); } return e; })); }
        else if (p.reveal) p.handEl.replaceChildren(...TK.sortHand(p.cards.slice()).map((c) => PK.cardEl(c, true, { small: true })));
        else kit.backs(p);
        p.ptsEl.textContent = p.bid == null ? '' : (p.bid === 0 ? '叫 0（零墩）' : '叫 ' + p.bid) + '・吃 ' + p.tricks;
      };
      const legal = (p, led) => { if (led) return TK.legal(p.cards, led); const ns = p.cards.filter((c) => c.s !== 'S'); return broken || !ns.length ? p.cards.slice() : ns; };
      const estimate = (p) => {
        let e = 0;
        for (const s of 'SHDC') {
          const cs = p.cards.filter((c) => c.s === s).map(TK.rv).sort((a, b) => b - a);
          if (cs.includes(14)) e += 1;
          if (cs.includes(13) && cs.length >= 2) e += s === 'S' ? 1 : 0.8;
          if (cs.includes(12) && cs.length >= 3) e += s === 'S' ? 0.7 : 0.35;
          if (s === 'S' && cs.length > 3) e += (cs.length - 3) * 0.8;
          if (s !== 'S' && p.cards.filter((c) => c.s === 'S').length >= 3) e += cs.length === 0 ? 0.8 : cs.length === 1 ? 0.4 : 0;
        }
        return e;
      };
      /* 這張牌是不是目前這個花色最大的（記牌） */
      const isTop = (c) => { for (let r = TK.rv(c) + 1; r <= 14; r++) { const rr = r === 14 ? 1 : r; if (!played.has(c.s + rr)) return false; } return true; };
      const aiCard = (p, plays) => {
        const led = plays[0] && plays[0].c.s;
        const opts = legal(p, led);
        if (t.diff === 0) return PK.pick(opts);
        const rv = TK.rv, low = (a) => a.slice().sort((x, y) => rv(x) - rv(y))[0], high = (a) => a.slice().sort((x, y) => rv(y) - rv(x))[0];
        const nil = p.bid === 0;
        if (!led) {
          if (nil) return low(opts);
          const tops = opts.filter((c) => c.s !== 'S' && isTop(c)); if (tops.length) return tops[0];
          const sp = opts.filter((c) => c.s === 'S'); if (broken && sp.length >= 4 && t.diff === 2) return high(sp);
          const ns = opts.filter((c) => c.s !== 'S'); return low(ns.length ? ns : opts);
        }
        const wi = TK.winner(plays, 'S'), win = plays[wi].c, winP = plays[wi].p;
        const partnerWin = team(winP) === team(p) && winP !== p;
        const beat = (c) => TK.winner([...plays, { p, c }], 'S') === plays.length;
        if (nil) { const lose = opts.filter((c) => !beat(c)); return lose.length ? high(lose) : low(opts); }
        if (partnerWin && (isTop(win) || win.s === 'S' && led !== 'S' || plays.length === 3)) { const ns = opts.filter((c) => c.s !== 'S' || led === 'S'); return low(ns.length ? ns : opts); }
        const winners = opts.filter(beat);
        if (winners.length) { const myBidLeft = ps.filter((q) => team(q) === team(p) && q.bid > 0).reduce((a, q) => a + q.bid, 0) - ps.filter((q) => team(q) === team(p) && q.bid !== 0).reduce((a, q) => a + q.tricks, 0); if (myBidLeft > 0 || t.diff < 2) return low(winners); }
        const ns = opts.filter((c) => c.s !== 'S'); return low(ns.length ? ns : opts);
      };

      while (t.alive) {
        hand++; dealer = (dealer + 1) % 4;
        if (t.isParty && hand > 1) S.refill();
        const deck = PK.makeDeck();
        ps.forEach((p, i) => { p.cards = deck.slice(i * 13, i * 13 + 13); p.bid = null; p.tricks = 0; p.reveal = false; p.boxEl.classList.remove('winner'); kit.setTag(p, ''); show(p); });
        broken = false; played = new Set(); ps.forEach((p) => (p.sax = false)); kit.clearSlots(L); drawBoard();
        /* 叫墩 */
        for (let k = 1; k <= 4 && t.alive; k++) {
          const p = ps[(dealer + k) % 4];
          kit.active(ps, p); L.info.textContent = (p === me ? '你' : p.name) + ' 叫墩';
          if (!p.isAI) {
            const sug = Math.max(1, Math.round(estimate(p)));
            const r = await kit.ask(t, { who: p, ctrl: L.ctrl, timer: L.timer, secs: 40, title: '你預計能吃幾墩？（建議 ' + sug + ' 墩，0＝零墩挑戰：一墩都不吃）', buttons: [el('div', { class: 'bf-ranks' }, Array.from({ length: 14 }, (_, i) => el('button', { class: 'rk' + (i === sug ? ' on' : ''), 'data-v': i }, i)))],
              bind: (pick) => PK.$$('.bf-ranks .rk', L.ctrl).forEach((b) => b.addEventListener('click', () => pick(+b.dataset.v))) });
            if (r.type === 'closed') return;
            p.bid = r.type === 'timeout' ? sug : r.value;
          } else {
            await t.wait(PK.randInt(500, 900));
            const e = estimate(p);
            p.bid = t.diff === 2 && e < 0.6 && !p.cards.some((c) => c.s === 'S' && TK.rv(c) > 10) ? 0 : Math.max(1, Math.round(e + (t.diff === 0 ? PK.rand(-1, 1) : 0)));
          }
          PK.voice.say((p === me ? '' : p.name + '，') + (p.bid === 0 ? '零墩' : '叫' + p.bid + '墩'), { pri: 2, pitch: p.voicePitch || 1 });
          PK.fx.floatText(p.seatEl, p.bid === 0 ? '零墩！' : '叫 ' + p.bid, '#d4af37');
          show(p); drawBoard();
        }
        /* 出牌 */
        let lead = (dealer + 1) % 4;
        for (let tr = 0; tr < 13 && t.alive; tr++) {
          const plays = [];
          for (let k = 0; k < 4; k++) {
            const p = ps[(lead + k) % 4];
            kit.active(ps, p); L.info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
            let c;
            if (!p.isAI) {
              t.actor = p;
              while (true) {
                const opts = legal(p, plays[0] && plays[0].c.s);
                const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 30, skills: S, title: plays.length ? '要跟出' + PK.SUIT_NAME[plays[0].c.s] + '，沒有才能出黑桃或其他牌' : broken ? '點一張牌開始這一墩' : '黑桃還沒出現過，不能用黑桃開頭',
                  bind: (pick) => show(me, (x) => (opts.includes(x) ? pick(x) : PK.toast('這張現在不能出')), (x) => opts.includes(x)), cleanup: () => show(me) });
                if (r.type === 'closed') return;
                if (r.type === 'skill') {
                  const k2 = r.key;
                  if (k2 === 'sax') { S.spend(p, k2); p.sax = true; PK.fx.burst(p.seatEl, ['🎷', '🎶'], 12); }
                  if (k2 === 'owl') { S.spend(p, k2); const pt = partner(p); if (p === me) { pt.reveal = true; show(pt); setTimeout(() => { pt.reveal = false; show(pt); }, 5000); } PK.fx.peek(pt.handEl); }
                  if (k2 === 'summon') { const rr = await kit.ask(t, { ctrl: L.ctrl, title: '♠️ 點一張要變成王牌的牌', secs: 20, timer: L.timer, bind: (pick) => show(me, pick, (y) => y.s !== 'S'), cleanup: () => show(me) }); const x = rr.type === 'pick' ? rr.value : null; if (!x || x.s === 'S') { if (p === me && x) PK.toast('黑桃本來就是王牌'); continue; } S.spend(p, k2); x.asTrump = true; PK.fx.burst(p.handEl, ['♠️', '✨'], 12); }
                  if (k2 === 'improv') { const nb = await kit.choose(t, L.ctrl, '改叫幾墩？', Array.from({ length: 14 }, (_, i) => ({ text: '' + i, value: i }))); S.spend(p, k2); p.bid = nb; show(p); drawBoard(); }
                  continue;
                }
                c = r.type === 'timeout' ? aiCard(p, plays) : r.value; break;
              }
            } else {
              await t.wait(PK.randInt(450, 800));
              if (t.isParty && Math.random() < 0.05 && p.sk.summon) { const x = p.cards.find((y) => y.s !== 'S' && TK.rv(y) > 11); if (x) { S.spend(p, 'summon'); x.asTrump = true; } }
              c = aiCard(p, plays);
            }
            p.cards.splice(p.cards.indexOf(c), 1); show(p); played.add(c.s + c.r);
            await kit.toSlot(L, p, (lead + k) % 4, c);
            plays.push({ p, c }); PK.voice.card(c, '', 2);
            if ((c.s === 'S' || c.asTrump) && !broken) { broken = true; PK.fx.burst(L.center, ['♠️', '🎷'], 12); PK.fx.banner('黑桃出現了！', 'event'); }
            if (c.asTrump) { PK.fx.burst(L.slotOf(p), ['♠️', '✨'], 10); PK.fx.floatText(L.slotOf(p), '王牌召喚！', '#d4af37'); }
          }
          const w = plays[TK.winner(plays, 'S')].p;
          w.tricks++;
          PK.fx.floatText(w.seatEl, '+1 墩', '#d4af37'); PK.sfx('chip');
          await kit.collectTrick(t, L, w);
          show(w); drawBoard();
          if (w.bid === 0 && w.tricks === 1) { PK.fx.burst(w.seatEl, ['💥', '😱'], 12); PK.fx.banner('零墩失敗！', 'bad', w === me ? '你' : w.name); }
          lead = ps.indexOf(w);
        }
        if (!t.alive) return;
        kit.active(ps, null);
        /* 計分 */
        const res = [0, 1].map((k) => {
          const mem = ps.filter((p) => team(p) === k);
          const bid = mem.reduce((a, p) => a + (p.bid > 0 ? p.bid : 0), 0), got = mem.filter((p) => p.bid !== 0).reduce((a, p) => a + p.tricks, 0);
          let sc = bid ? (got >= bid ? bid * 10 + (got - bid) : -bid * 10) : 0;
          mem.forEach((p) => { if (p.bid === 0) sc += p.tricks === 0 ? 100 : -100; });
          if (mem.some((p) => p.sax) && sc > 0) { sc *= 2; mem.forEach((p) => PK.fx.burst(p.seatEl, ['🎷', '🎶', '🎵'], 20)); }
          return { bid, got, sc };
        });
        tot[0] += res[0].sc; tot[1] += res[1].sc; drawBoard();
        const R = res[MT], O = res[OT];
        const made = R.bid ? R.got >= R.bid : true;
        if (R.bid && made) PK.ch.emit('sp_made');
        ps.forEach((p) => { if (res[team(p)].sc > 0) p.boxEl.classList.add('winner'); });
        PK.fx.banner(made ? '我方叫墩成功！' : '我方叫墩失敗', made ? 'good' : 'bad', `叫 ${R.bid}・吃 ${R.got}`);
        await t.wait(1400);
        await kit.settle(t, R.sc * 2, { big: R.sc >= 100, title: (R.sc >= 0 ? '我方 +' : '我方 ') + R.sc + ' 分' });
        const over = tot.some((x) => x >= 500);
        await PK.modal(over ? '有隊伍到達 500 分，整場結束！' : '本局結果', `<p>我方（你＋${partner(me).name}）：叫 ${R.bid}、吃 ${R.got}，本局 <b>${R.sc}</b> 分，總分 <b>${tot[MT]}</b></p><p>對手（${ps[(mi + 1) % 4].name}＋${ps[(mi + 3) % 4].name}）：叫 ${O.bid}、吃 ${O.got}，本局 <b>${O.sc}</b> 分，總分 <b>${tot[OT]}</b></p>`, [{ text: '好', value: 1, cls: 'primary' }]);
        if (over) { tot[0] = tot[1] = 0; drawBoard(); }
        await kit.next(t, L.ctrl, '下一局');
      }
    },
  };
})();
