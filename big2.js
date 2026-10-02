/* 牌神擂台 — 大老二（霓虹街機） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { eye: ['👁️', '透視眼', '偷看一位對手 3 張手牌', 1], swap: ['🔄', '換一張', '用一張手牌和下一家隨機交換', 1], shield: ['🛡️', '免罰金牌', '本局輸了只扣一半', 1], skip: ['⏩', '跳過令', '讓下一家這一輪被迫跳過', 1] };
  const SU = { C: 0, D: 1, H: 2, S: 3 };
  const vv = (c) => (c.r + 10) % 13; // 3 最小 … A、2 最大
  const pw = (c) => vv(c) * 4 + SU[c.s];
  const FIVE = ['', '順子', '葫蘆', '鐵支', '同花順'];
  const RW = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  /* 順子大小：23456 最大（13）、A2345 第二（12），其餘 10JQKA（11）…34567（4）；不是順子回傳 0 */
  const strRank = (vs) => {
    const k = vs.join();
    if (k === '0,1,2,3,12') return 13;
    if (k === '0,1,2,11,12') return 12;
    return vs[4] - vs[0] === 4 && vs[4] <= 11 && new Set(vs).size === 5 ? vs[4] : 0;
  };
  /* 判斷牌型 */
  const classify = (cs) => {
    if (cs.length === 1) return { type: 1, key: pw(cs[0]), name: '單張' };
    if (cs.length === 2) return vv(cs[0]) === vv(cs[1]) ? { type: 2, key: Math.max(...cs.map(pw)), name: '對子' } : null;
    if (cs.length !== 5) return null;
    const cnt = {}; cs.forEach((c) => (cnt[vv(c)] = (cnt[vv(c)] || 0) + 1));
    const g = Object.entries(cnt).map(([v, n]) => [n, +v]).sort((a, b) => b[0] - a[0]);
    const vs = cs.map(vv).sort((a, b) => a - b);
    const flush = cs.every((c) => c.s === cs[0].s);
    const sr = strRank(vs);
    const straight = g.length === 5 && sr > 0;
    const topC = cs.slice().sort((a, b) => pw(b) - pw(a))[0];
    const skey = sr * 4 + SU[topC.s]; // 先比順子大小，再比最大那張的花色
    if (straight && flush) return { type: 5, rank: 4, key: skey, name: '同花順' };
    if (g[0][0] === 4) return { type: 5, rank: 3, key: g[0][1], name: '鐵支' };
    if (g[0][0] === 3 && g[1][0] === 2) return { type: 5, rank: 2, key: g[0][1], name: '葫蘆' };
    if (straight) return { type: 5, rank: 1, key: skey, name: '順子' };
    return null;
  };
  const isBomb = (x) => x.type === 5 && x.rank >= 3; // 鐵支（同花順比鐵支更大）可以壓任何牌型
  const beats = (a, b) => !b || (isBomb(a) && b.type !== 5) || (a.type === b.type && (a.type === 5 ? a.rank > b.rank || (a.rank === b.rank && a.key > b.key) : a.key > b.key));
  const combos = (arr, k) => { const out = []; const go = (s, cur) => { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); } }; go(0, []); return out; };
  /* 列出手牌所有可以出的組合 */
  const allPlays = (hand) => {
    const out = hand.map((c) => [c]);
    const byV = {}; hand.forEach((c) => (byV[vv(c)] = byV[vv(c)] || []).push(c));
    for (const v in byV) if (byV[v].length >= 2) combos(byV[v], 2).forEach((x) => out.push(x));
    const seqs = []; for (let s = 0; s <= 7; s++) seqs.push([s, s + 1, s + 2, s + 3, s + 4]);
    seqs.push([11, 12, 0, 1, 2], [12, 0, 1, 2, 3]);
    for (const seq of seqs) {
      let lists = []; for (const v of seq) { if (!byV[v]) { lists = null; break; } lists.push(byV[v]); }
      if (!lists) continue;
      let prod = [[]]; for (const l of lists) { const np = []; for (const p of prod) for (const c of l) { np.push([...p, c]); if (np.length > 120) break; } prod = np; }
      prod.forEach((x) => out.push(x));
    }
    const vals = Object.keys(byV);
    for (const v of vals) if (byV[v].length >= 3) for (const tri of combos(byV[v], 3)) for (const w of vals) if (w !== v && byV[w].length >= 2) { out.push([...tri, ...byV[w].slice(0, 2)]); }
    for (const v of vals) if (byV[v].length === 4) { const k = hand.filter((c) => vv(c) !== +v).sort((a, b) => pw(a) - pw(b))[0]; if (k) out.push([...byV[v], k]); }
    return out.map((cs) => ({ cs, cb: classify(cs) })).filter((x) => x.cb);
  };
  const isC3 = (c) => c.r === 3 && c.s === 'C';

  PK.IMPL.big2 = {
    skills: SKILLS,
    _test: { classify: (cs) => classify(cs), beats: (a, b) => beats(a, b), allPlays: (h) => allPlays(h) },
    async start(t) {
      const ps = t.players, me = t.me;
      const L = kit.compass(t, ps, { cls: 'b2' });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      let last, passes, first, skipNext;
      const show = (p, sel, onClick) => {
        if (p === me) {
          me.handEl.replaceChildren(...me.cards.slice().sort((a, b) => pw(a) - pw(b)).map((c) => { const e = PK.cardEl(c, true); if (sel && sel.has(c)) e.classList.add('selected'); if (onClick) { e.classList.add('pickable'); e.addEventListener('click', () => onClick(c)); } return e; }));
        } else kit.backs(p);
        p.ptsEl.textContent = p.cards.length + ' 張';
        p.boxEl.classList.toggle('last-card', p.cards.length === 1);
      };
      const idx = (p) => ps.indexOf(p);
      const play = async (p, cs) => {
        const cb = classify(cs);
        cs.forEach((c) => p.cards.splice(p.cards.indexOf(c), 1));
        cs.sort((a, b) => pw(a) - pw(b));
        kit.clearSlots(L);
        await kit.toSlot(L, p, idx(p), cs);
        show(p); last = { p, cb, cs }; passes = 0; first = false;
        if (p === me && cb.type === 5 && cb.rank >= 3) PK.ch.emit('b2bomb');
        kit.setTag(p, '');
        if (cb.type === 5) {
          if (cb.rank === 4) { PK.fx.flash('#ff2bd6', 400); PK.fx.fireworks(3); PK.fx.banner('同花順！', 'gold'); }
          else if (cb.rank === 3) { PK.sfx('boom'); PK.fx.shake(L.wrap, 12); PK.fx.burst(L.center, ['💣', '💥', '🔥'], 22); PK.fx.banner('鐵支！', 'event'); }
          else { PK.fx.burst(L.center, cb.rank === 2 ? ['🏠', '✨'] : ['🌈', '⚡'], 14); PK.fx.banner(cb.name + '！', 'event'); }
        } else {
          if (cs.some((c) => c.r === 2)) { PK.fx.flash('#00f0ff', 250); PK.fx.burst(L.center, ['⚡', '✨'], 12); }
          PK.voice.say(cb.type === 1 ? PK.cardSpeech(cs[0]) : '對' + RW[vv(cs[0])], { pri: 2, pitch: p.voicePitch || 1 });
          PK.sfx('deal');
        }
        if (p.cards.length === 1) { PK.sfx('event'); PK.fx.banner('剩一張！', 'event', p === me ? '你' : p.name); PK.fx.spotlight(p.boxEl, 1300); }
      };
      const pass = (p) => { passes++; kit.setTag(p, '過', 'stand'); PK.fx.floatText(p.seatEl, '過', '#00f0ff'); PK.voice.say('過', { pri: 1, pitch: p.voicePitch || 1 }); };
      /* 電腦出牌 */
      const aiChoose = (p) => {
        const opts = allPlays(p.cards).filter((x) => (!first || x.cs.some(isC3)) && beats(x.cb, last && last.cb));
        if (!opts.length) return null;
        const nx = ps[(idx(p) + 1) % 4];
        const danger = ps.some((q) => q !== p && q.cards.length <= 3);
        if (t.diff === 0) return Math.random() < 0.2 && last ? null : PK.pick(opts).cs;
        const inPair = (c) => p.cards.filter((x) => vv(x) === vv(c)).length >= 2;
        const cost = (x) => {
          let s = x.cb.type === 5 ? x.cb.rank * 60 + x.cb.key : x.cb.key;
          if (!last) s -= x.cs.length * 25;
          if (x.cb.type === 1 && inPair(x.cs[0]) && t.diff === 2) s += 20;
          if (!last && x.cb.type === 1 && nx.cards.length === 1) s += 200 - x.cb.key * 2;
          return s;
        };
        opts.sort((a, b) => cost(a) - cost(b));
        const pickd = opts[0];
        const uses2 = pickd.cs.some((c) => c.r === 2) || (pickd.cb.type === 5 && pickd.cb.rank >= 3);
        if (last && uses2 && !danger && p.cards.length > 5 && Math.random() < [0, 0.4, 0.7][t.diff]) return null;
        return pickd.cs;
      };
      const useSkill = async (p, k) => {
        if (!S.spend(p, k)) return;
        if (k === 'eye') {
          if (p.isAI) return;
          const v = ps[await kit.choose(t, L.ctrl, '要偷看誰？', ps.filter((q) => q !== p).map((q) => ({ text: q.avatar + ' ' + q.name, value: ps.indexOf(q) })), { who: p })];
          const three = PK.shuffle(v.cards.slice()).slice(0, 3).sort((a, b) => pw(a) - pw(b));
          PK.fx.peek(v.handEl);
          if (p === me) await PK.modal('透視眼', el('div', { class: 'peek-show' }, el('div', null, '👁️ ' + v.name + ' 手上有'), el('div', { class: 'row-cards' }, three.map((c) => PK.cardEl(c, true)))), [{ text: '知道了', value: 1, cls: 'primary' }]);
        }
        if (k === 'swap') {
          const nx = ps[(idx(p) + 1) % 4];
          let c;
          if (!p.isAI) { const r = await kit.ask(t, { who: p, ctrl: L.ctrl, title: '🔄 點一張要換出去的牌', secs: 20, timer: L.timer, bind: (pick) => show(me, null, pick), cleanup: () => show(me) }); c = r.type === 'pick' ? r.value : p.cards[0]; }
          else c = p.cards.slice().sort((a, b) => pw(a) - pw(b))[0];
          if (isC3(c) && first) { p.sk.swap++; if (p === me) PK.toast('梅花 3 不能換'); show(p); return; }
          const d = nx.cards.splice(PK.randInt(0, nx.cards.length - 1), 1)[0];
          p.cards.splice(p.cards.indexOf(c), 1); p.cards.push(d); nx.cards.push(c);
          PK.fx.burst(p.seatEl, '🔄', 8); PK.fx.burst(nx.seatEl, '🔄', 8); show(p); show(nx); L.ctrl.replaceChildren();
          if (p === me) PK.voice.say('換到' + PK.cardSpeech(d));
        }
        if (k === 'shield') { p.shield = true; PK.fx.burst(p.seatEl, '🛡️', 8, { g: 0, speed: 3 }); }
        if (k === 'skip') { skipNext = ps[(idx(p) + 1) % 4]; PK.fx.burst(skipNext.seatEl, ['⏩', '🚫'], 12); }
      };
      const humanTurn = (me) => new Promise((resolve) => {
        t.actor = me;
        const sel = new Set(); let hintI = -1, pick = null;
        const box = el('div', { class: 'bf-ctrl' });
        const render = () => {
          show(me, sel, (c) => { if (sel.has(c)) sel.delete(c); else sel.add(c); PK.sfx('click'); render(); });
          const cs = [...sel], cb = classify(cs);
          const okk = cb && beats(cb, last && last.cb) && (!first || cs.some(isC3));
          box.replaceChildren(
            el('div', { class: 'bet-title' }, first ? '第一手要包含梅花 3' : last ? `要壓過：${last.cb.name}（${last.p === me ? '你' : last.p.name}）` : '你可以出任何牌型'),
            el('div', { class: 'bf-btns' },
              el('button', { class: 'btn primary big', disabled: !okk || null, onclick: () => pick && pick({ act: 'play', cs }) }, cb ? '出 ' + cb.name : sel.size ? '牌型不對' : '出牌'),
              el('button', { class: 'btn big', disabled: !last || null, onclick: () => pick && pick({ act: 'pass' }) }, '過'),
              el('button', { class: 'btn', onclick: () => {
                const opts = allPlays(me.cards).filter((x) => (!first || x.cs.some(isC3)) && beats(x.cb, last && last.cb)).sort((a, b) => (a.cb.type === 5 ? a.cb.rank * 60 : 0) + a.cb.key - ((b.cb.type === 5 ? b.cb.rank * 60 : 0) + b.cb.key));
                if (!opts.length) { PK.toast('沒有壓得過的牌，只能過'); return; }
                hintI = (hintI + 1) % opts.length; sel.clear(); opts[hintI].cs.forEach((c) => sel.add(c)); render();
              } }, '💡 提示'),
              el('button', { class: 'btn', onclick: () => { sel.clear(); render(); } }, '取消')));
        };
        const go = async () => {
          const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 40, skills: S, buttons: [box], bind: (pk) => { pick = pk; render(); }, cleanup: () => show(me) });
          if (r.type === 'closed') return resolve(null);
          if (r.type === 'skill') { await useSkill(me, r.key); return go(); }
          if (r.type === 'timeout') { const cs = aiChoose(me); return resolve(cs ? { act: 'play', cs } : { act: 'pass' }); }
          resolve(r.value);
        };
        go();
      });

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        const deck = PK.makeDeck();
        ps.forEach((p, i) => { p.cards = deck.slice(i * 13, i * 13 + 13); p.shield = false; p.boxEl.classList.remove('winner', 'loser'); kit.setTag(p, ''); show(p); });
        last = null; passes = 0; first = true; skipNext = null; kit.clearSlots(L);
        let cur = ps.findIndex((p) => p.cards.some(isC3)), winner = null;
        L.info.textContent = (ps[cur] === me ? '你' : ps[cur].name) + ' 有梅花 3，先出';
        PK.sfx('deal');
        while (t.alive && !winner) {
          const p = ps[cur];
          if (last && passes >= 3) { last = null; passes = 0; kit.clearSlots(L); ps.forEach((q) => kit.setTag(q, '')); PK.fx.floatText(p.seatEl, '輪到你自由出牌', '#00f0ff'); }
          kit.active(ps, p); L.info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
          if (skipNext === p && last) { skipNext = null; await t.wait(500); pass(p); PK.fx.banner('被跳過！', 'event', p === me ? '你' : p.name); cur = (cur + 1) % 4; continue; }
          if (skipNext === p) skipNext = null;
          if (!p.isAI) {
            const r = await humanTurn(p);
            if (!r) return;
            if (r.act === 'play') await play(p, r.cs); else pass(p);
          } else {
            await t.wait(PK.randInt(600, 1100));
            if (t.isParty && Math.random() < 0.08) { const k = PK.pick(['shield', 'skip', 'swap']); if (p.sk[k]) await useSkill(p, k); }
            const cs = aiChoose(p);
            if (cs) await play(p, cs); else pass(p);
            if (cs && Math.random() < 0.15) kit.say(t, p, 'good', 1);
          }
          if (!p.cards.length) winner = p;
          cur = (cur + 1) % 4;
          await t.wait(250);
        }
        if (!t.alive) return;
        kit.active(ps, null);
        winner.boxEl.classList.add('winner');
        PK.fx.banner((winner === me ? '你' : winner.name) + ' 出完了！', winner === me ? 'gold' : 'event');
        const pen = (p) => { const n = p.cards.length; let v = n >= 13 ? n * 3 : n >= 10 ? n * 2 : n; return p.shield ? Math.ceil(v / 2) : v; };
        let sum = 0; ps.forEach((p) => { if (p !== winner) { p.pts = -pen(p); sum += pen(p); p.handEl.replaceChildren(...p.cards.sort((a, b) => pw(a) - pw(b)).map((c) => PK.cardEl(c, true, { small: p !== me }))); } });
        winner.pts = sum;
        ps.forEach((p) => PK.fx.floatText(p.seatEl, (p.pts > 0 ? '+' : '') + p.pts + ' 分', p.pts > 0 ? '#7dff9a' : '#ff7b7b'));
        await t.wait(1200);
        await kit.settle(t, me.pts * 5, { big: winner === me, title: winner === me ? '你贏了！' : '扣 ' + -me.pts + ' 分' });
        const order = ps.slice().sort((a, b) => b.pts - a.pts);
        await PK.modal('本局結果', kit.ranking(t, order, (p) => (p.pts > 0 ? '+' : '') + p.pts + ' 分・剩 ' + p.cards.length + ' 張'), [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
