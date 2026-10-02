/* 牌神擂台 — 德州撲克（拉斯維加斯） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { spot: ['🔦', '聚光燈', '這局你加注時，對手更容易被嚇跑', 1], mind: ['🧠', '讀心', '看出每位對手現在的心情（牌好不好）', 2], swap: ['🃏', '換手牌', '翻牌前換掉一張手牌', 1], dice: ['🎲', '幸運骰', '下一張公共牌翻兩張，留對你比較好的', 1], guard: ['🛡️', '保底', '這局輸了退回一半下注', 1] };
  const SB = 10, BB = 20, BUY = 1000;
  const HN = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '四條', '同花順', '同花大順'];
  const hv = (c) => (c.r === 1 ? 14 : c.r);
  const ev5 = (cs) => {
    const vals = cs.map(hv).sort((a, b) => b - a), cnt = {}; vals.forEach((v) => (cnt[v] = (cnt[v] || 0) + 1));
    const g = Object.entries(cnt).map(([v, c]) => [c, +v]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const tb = g.flatMap(([c, v]) => Array(c).fill(v)), flush = cs.every((c) => c.s === cs[0].s), u = [...new Set(vals)];
    let st = 0; if (u.length === 5) { if (u[0] - u[4] === 4) st = u[0]; else if (u.join() === '14,5,4,3,2') st = 5; }
    if (st && flush) return [st === 14 ? 9 : 8, st];
    if (g[0][0] === 4) return [7, ...tb];
    if (g[0][0] === 3 && g[1][0] === 2) return [6, ...tb];
    if (flush) return [5, ...vals];
    if (st) return [4, st];
    if (g[0][0] === 3) return [3, ...tb];
    if (g[0][0] === 2 && g[1][0] === 2) return [2, ...tb];
    if (g[0][0] === 2) return [1, ...tb];
    return [0, ...vals];
  };
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y ? 1 : -1; } return 0; };
  const C7 = []; (function () { for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) C7.push([a, b]); })();
  const best = (cs) => { if (cs.length < 5) return null; let bb = null, bc = null; const idx = cs.length === 7 ? C7 : null; const sets = idx ? idx.map(([a, b]) => cs.filter((_, i) => i !== a && i !== b)) : cs.length === 6 ? cs.map((_, i) => cs.filter((__, j) => j !== i)) : [cs]; for (const s of sets) { const e = ev5(s); if (!bb || cmp(e, bb) > 0) { bb = e; bc = s; } } return { e: bb, cards: bc }; };
  /* 勝率估算（蒙地卡羅） */
  const equity = (hole, board, nOpp, sims, known) => {
    const used = new Set([...hole, ...board, ...(known || [])].map((c) => c.id));
    const pool = PK.makeDeck().filter((c) => !used.has(c.id));
    let win = 0;
    for (let s = 0; s < sims; s++) {
      PK.shuffle(pool); let k = 0;
      const bd = board.concat(pool.slice(k, k + 5 - board.length)); k += 5 - board.length;
      const mine = best(hole.concat(bd)).e; let res = 1;
      for (let o = 0; o < nOpp; o++) { const oe = best(pool.slice(k, k + 2).concat(bd)).e; k += 2; const c = cmp(mine, oe); if (c < 0) { res = 0; break; } if (c === 0) res = Math.min(res, 0.5); }
      win += res;
    }
    return win / sims;
  };

  PK.IMPL.holdem = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      ps.forEach((p) => (p.stack = BUY));
      let board, deck, pot, dealer = -1, handNo = 0, curBet, minRaise;
      const boardEl = el('div', { class: 'hd-board' });
      const potEl = el('div', { class: 'pot' }, '💰 底池 ', el('b', null, '0'));
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'hd',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'sg-center' }, potEl, boardEl, info)],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const live = () => ps.filter((p) => !p.folded);
      const setPot = () => { pot = ps.reduce((a, p) => a + p.contrib, 0); PK.$('b', potEl).textContent = PK.fmt(pot); };
      const show = (p, reveal) => {
        p.handEl.replaceChildren(...(p.hole || []).map((c) => PK.cardEl(c, p === me || reveal, { small: p !== me })));
        p.ptsEl.textContent = '🪙 ' + PK.fmt(p.stack);
        p.betEl.textContent = (ps.indexOf(p) === dealer ? 'Ⓓ ' : '') + (p.bet ? '下注 ' + p.bet : '');
        kit.setTag(p, p.folded ? '棄牌' : p.allin ? '全下' : p.mood || '', p.folded ? 'stand' : p.allin ? 'top' : '');
        p.boxEl.classList.toggle('folded', !!p.folded);
      };
      const showBoard = () => boardEl.replaceChildren(...[0, 1, 2, 3, 4].map((i) => (board[i] ? PK.cardEl(board[i], true) : el('div', { class: 'hd-empty' }))));
      const put = (p, amt) => { amt = Math.min(amt, p.stack); p.stack -= amt; p.bet += amt; p.contrib += amt; if (!p.stack) p.allin = true; setPot(); show(p); if (amt) PK.fx.coins(p.seatEl, potEl, Math.min(10, 2 + Math.floor(amt / 50))); return amt; };
      const say = (p, txt) => { PK.fx.floatText(p.seatEl, txt, '#ffc93c'); PK.voice.say((p === me ? '' : p.name + '，') + txt, { pri: 2, pitch: p.voicePitch || 1 }); };
      const act = (p, a, amt) => {
        const toCall = curBet - p.bet;
        if (a === 'fold') { p.folded = true; say(p, '棄牌'); }
        else if (a === 'call') { if (toCall <= 0) say(p, '過牌'); else { put(p, toCall); say(p, p.allin ? '全下！' : '跟注 ' + toCall); } }
        else if (a === 'raise') {
          const target = Math.min(p.bet + p.stack, amt);
          const raiseBy = target - curBet;
          put(p, target - p.bet);
          if (raiseBy >= minRaise) minRaise = raiseBy;
          if (target > curBet) curBet = target;
          say(p, p.allin ? '全下！' : '加注到 ' + target);
        }
        if (p.allin && a !== 'fold') { PK.fx.spotlight(p.boxEl, 1500); PK.fx.banner('全下！', 'gold', p === me ? '你' : p.name); PK.sfx('big'); }
        show(p);
      };
      /* 電腦決策 */
      const aiDecide = (p) => {
        const toCall = curBet - p.bet, opp = live().length - 1;
        const eq = equity(p.hole, board, opp, [60, 120, 200][t.diff]);
        p.eq = eq;
        const odds = toCall / (pot + toCall || 1), scared = ps.some((h) => h.spotOn && !h.folded) && toCall > BB * 2 ? 0.12 : 0;
        const r = Math.random();
        const raiseTo = (mult) => curBet + Math.max(minRaise, Math.round((pot * mult) / 10) * 10);
        if (t.diff === 0) { if (toCall && eq < 0.35 && r < 0.4) return ['fold']; if (r < 0.12) return ['raise', raiseTo(0.5)]; return ['call']; }
        const strong = 0.5 + 0.25 / Math.max(1, opp) + scared;
        if (eq > strong + 0.2) return r < 0.7 ? ['raise', t.diff === 2 && board.length === 5 && eq > 0.85 ? p.bet + p.stack : raiseTo(0.75)] : ['call'];
        if (eq > strong) return r < 0.35 ? ['raise', raiseTo(0.5)] : ['call'];
        if (eq + 0.05 >= odds + scared) return ['call'];
        if (!toCall) return t.diff === 2 && r < 0.1 ? ['raise', raiseTo(0.5)] : ['call'];
        return t.diff === 2 && r < 0.06 ? ['raise', raiseTo(0.6)] : ['fold'];
      };
      /* 一輪下注 */
      const bettingRound = async (startIdx) => {
        let order = []; for (let k = 0; k < n; k++) order.push(ps[(startIdx + k) % n]);
        let need = new Set(order.filter((p) => !p.folded && !p.allin));
        if (need.size <= 1 && order.filter((p) => !p.folded && !p.allin).every((p) => p.bet >= curBet)) return;
        let i = 0;
        while (need.size && live().length > 1 && t.alive) {
          const p = order[i % n]; i++;
          if (!need.has(p)) continue;
          need.delete(p);
          if (p.folded || p.allin) continue;
          kit.active(ps, p); info.textContent = p === me ? '輪到你了' : p.name + ' 思考中…';
          const before = curBet;
          if (!p.isAI) {
            t.actor = p;
            await (async (me) => {
            while (true) {
              const toCall = curBet - me.bet;
              const minTo = curBet + minRaise, potTo = curBet + Math.max(minRaise, Math.round((pot + toCall) / 10) * 10), all = me.bet + me.stack;
              const btn = [{ text: '棄牌', value: ['fold'] }, { text: toCall ? '跟注 ' + Math.min(toCall, me.stack) : '過牌', value: ['call'], cls: 'primary big' }];
              if (all > curBet) {
                if (minTo < all) btn.push({ text: '加注到 ' + minTo, value: ['raise', minTo] });
                if (potTo > minTo && potTo < all) btn.push({ text: '加到底池 ' + potTo, value: ['raise', potTo] });
                btn.push({ text: '全下 ' + all, value: ['raise', all], cls: 'allin-btn' });
              }
              const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 30, skills: S, title: toCall ? '要跟 ' + toCall + ' 嗎？' : '沒有人下注', buttons: btn });
              if (r.type === 'closed') return;
              if (r.type === 'skill') { await useSkill(me, r.key); continue; }
              const a = r.type === 'timeout' ? (toCall ? ['fold'] : ['call']) : r.value;
              act(me, a[0], a[1]); break;
            }
            })(p);
          } else {
            await t.wait(PK.randInt(700, 1300));
            const [a, amt] = aiDecide(p); act(p, a, amt);
            if (a === 'raise' && Math.random() < 0.3) kit.say(t, p, 'good', 1);
          }
          if (curBet > before) need = new Set(order.filter((q) => q !== p && !q.folded && !q.allin));
        }
      };
      const useSkill = async (hp, k) => {
        const local = hp === me;
        if (k === 'swap' && board.length) { if (local) PK.toast('只能在翻牌前換手牌'); return; }
        if (!S.spend(hp, k)) return;
        if (k === 'spot') { hp.spotOn = true; PK.fx.spotlight(hp.boxEl, 1500); }
        if (k === 'mind') ps.filter((p) => p !== hp).forEach((p) => { if (p.folded) return; const e = equity(p.hole, board, live().length - 1, 80); if (local) { p.mood = e > 0.6 ? '😎 很有自信' : e > 0.4 ? '🙂 普通' : '😰 很緊張'; show(p); PK.fx.peek(p.seatEl); } });
        if (k === 'swap') { const i = await kit.choose(t, L.ctrl, '換哪一張？', hp.hole.map((c, i) => ({ text: PK.cardName(c), value: i })), { who: hp }); deck.unshift(hp.hole[i]); hp.hole[i] = deck.pop(); show(hp); PK.fx.burst(hp.handEl, ['🃏', '✨'], 10); if (local) PK.voice.say('換到' + PK.cardSpeech(hp.hole[i])); }
        if (k === 'dice') { hp.dice = true; PK.fx.burst(hp.seatEl, '🎲', 8, { g: 0, speed: 3 }); }
        if (k === 'guard') { hp.guard = true; PK.fx.burst(hp.seatEl, '🛡️', 8, { g: 0, speed: 3 }); }
      };
      const deal = async (k, name) => {
        deck.pop();
        for (let i = 0; i < k; i++) {
          let c = deck.pop();
          const dp = ps.find((p) => p.dice && !p.folded);
          if (dp) {
            dp.dice = false; const c2 = deck.pop();
            const s1 = best(dp.hole.concat(board, [c])) || { e: [0] }, s2 = best(dp.hole.concat(board, [c2])) || { e: [0] };
            const e1 = board.length + 1 >= 3 ? s1.e : [0, hv(c)], e2 = board.length + 1 >= 3 ? s2.e : [0, hv(c2)];
            if (cmp(e2, e1) > 0) { deck.unshift(c); c = c2; } else deck.unshift(c2);
            PK.fx.burst(boardEl, ['🎲', '✨'], 12); PK.fx.floatText(boardEl, '幸運骰！', '#ffc93c');
          }
          board.push(c); showBoard(); PK.sfx('deal'); await t.wait(220);
        }
        PK.voice.say(name + '，' + board.slice(-k).map(PK.cardSpeech).join('、'), { pri: 2 });
        ps.forEach((p) => { p.bet = 0; p.mood = ''; show(p); }); curBet = 0; minRaise = BB;
        await t.wait(500);
      };

      while (t.alive) {
        handNo++;
        if (t.isParty && handNo > 1 && (handNo - 1) % 5 === 0) S.refill();
        ps.forEach((p) => { if (p.stack < BB) { p.stack = BUY; if (p !== me) t.sys(p.name + ' 重新買入 ' + BUY); } });
        dealer = (dealer + 1) % n;
        deck = PK.makeDeck(); board = []; showBoard();
        ps.forEach((p) => { p.hole = []; p.bet = 0; p.contrib = 0; p.folded = p.allin = false; p.mood = ''; p.boxEl.classList.remove('winner'); });
        ps.forEach((p) => { p.spotOn = p.dice = p.guard = false; p.startStack = p.stack; });
        const sbI = n === 2 ? dealer : (dealer + 1) % n, bbI = (sbI + 1) % n;
        curBet = 0; minRaise = BB; setPot();
        put(ps[sbI], SB); put(ps[bbI], BB); curBet = BB;
        info.textContent = '第 ' + handNo + ' 局・發牌';
        for (let k = 0; k < 2; k++) for (let i = 1; i <= n; i++) { const p = ps[(dealer + i) % n]; p.hole.push(deck.pop()); await PK.flyCard(potEl, p.handEl, null, 140); show(p); }
        PK.voice.say('你的手牌，' + me.hole.map(PK.cardSpeech).join('、'));
        await bettingRound((bbI + 1) % n);
        const streets = [[3, '翻牌'], [1, '轉牌'], [1, '河牌']];
        for (const [k, nm] of streets) {
          if (!t.alive || live().length <= 1) break;
          info.textContent = nm;
          await deal(k, nm);
          if (live().filter((p) => !p.allin).length >= 2) await bettingRound((dealer + 1) % n);
        }
        if (!t.alive) return;
        while (board.length < 5 && live().length > 1) { board.push(deck.pop()); showBoard(); await t.wait(400); }
        kit.active(ps, null);
        /* 攤牌與分池 */
        const lv = live();
        const results = new Map(ps.map((p) => [p, 0]));
        if (lv.length === 1) { results.set(lv[0], pot); info.textContent = (lv[0] === me ? '你' : lv[0].name) + ' 贏得底池（其他人都棄牌）'; }
        else {
          info.textContent = '攤牌！';
          const hands = new Map(lv.map((p) => [p, best(p.hole.concat(board))]));
          lv.forEach((p) => { show(p, true); kit.setTag(p, HN[hands.get(p).e[0]], 'stand'); });
          PK.voice.say(lv.map((p) => (p === me ? '你' : p.name) + HN[hands.get(p).e[0]]).join('，'), { pri: 3, rate: 1.25 });
          await t.wait(1500);
          const levels = [...new Set(lv.map((p) => p.contrib))].sort((a, b) => a - b);
          let prev = 0;
          for (const lvAmt of levels) {
            const part = ps.reduce((a, p) => a + Math.max(0, Math.min(p.contrib, lvAmt) - prev), 0);
            const elig = lv.filter((p) => p.contrib >= lvAmt);
            let top = []; for (const p of elig) { if (!top.length) top = [p]; else { const c = cmp(hands.get(p).e, hands.get(top[0]).e); if (c > 0) top = [p]; else if (c === 0) top.push(p); } }
            top.forEach((p) => results.set(p, results.get(p) + Math.floor(part / top.length)));
            prev = lvAmt;
          }
          const bestHand = Math.max(...lv.map((p) => hands.get(p).e[0]));
          if (bestHand >= 7) { PK.fx.fireworks(5); PK.fx.banner(HN[bestHand] + '！', 'gold'); }
        }
        for (const [p, v] of results) if (v > 0) { p.stack += v; p.boxEl.classList.add('winner'); PK.fx.coins(potEl, p.seatEl, 16); PK.fx.floatText(p.seatEl, '+' + PK.fmt(v), '#7dff9a'); if (p !== me) kit.say(t, p, 'win', 0.5); }
        pot = 0; PK.$('b', potEl).textContent = '0';
        ps.forEach((p) => show(p, lv.length > 1 && !p.folded));
        ps.forEach((p) => { const d = p.stack - p.startStack; if (d < 0 && p.guard) { const back = Math.floor(-d / 2); p.stack += back; PK.fx.burst(p.seatEl, '🛡️', 10); if (p === me) t.sys('保底退回 ' + back); show(p, lv.length > 1 && !p.folded); } });
        const delta = me.stack - me.startStack;
        if (delta > 0 && lv.length > 1 && best(me.hole.concat(board)).e[0] >= 6) PK.ch.emit('hd_big');
        await t.wait(900);
        await kit.settle(t, delta, { big: delta >= 300, title: delta > 0 ? '贏得底池！' : delta < 0 ? '這局輸了' : '打平' });
        await kit.next(t, L.ctrl, '下一局');
      }
    },
  };
})();
