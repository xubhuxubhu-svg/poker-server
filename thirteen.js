/* 牌神擂台 — 十三支（武俠擺陣） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { sword: ['🗡️', '劍氣', '這局打槍時每位對手再多拿 1 分', 1], bell: ['🛡️', '金鐘罩', '這局被打槍時不加倍', 1], scout: ['👁️', '探子', '偷看一位對手擺好的牌', 1], swap: ['🔄', '乾坤挪移', '用一張手牌和剩下的牌隨機交換', 1] };
  const N5 = ['散牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '鐵支', '同花順'];
  const N3 = ['散牌', '一對', '', '三條'];
  const ROWN = ['頭道', '中道', '尾道'], SIZE = [3, 5, 5];
  const hv = (c) => (c.r === 1 ? 14 : c.r);
  /* 牌型評估：回傳 [牌型, 比大小用的點數…] */
  const ev = (cs) => {
    const vals = cs.map(hv).sort((a, b) => b - a);
    const cnt = {}; vals.forEach((v) => (cnt[v] = (cnt[v] || 0) + 1));
    const groups = Object.entries(cnt).map(([v, c]) => [c, +v]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const tb = groups.flatMap(([c, v]) => Array(c).fill(v));
    if (cs.length === 3) return [groups[0][0] === 3 ? 3 : groups[0][0] === 2 ? 1 : 0, ...tb];
    const flush = cs.every((c) => c.s === cs[0].s);
    const uniq = [...new Set(vals)];
    let st = 0;
    if (uniq.length === 5) { if (uniq[0] - uniq[4] === 4) st = uniq[0]; else if (uniq.join() === '14,5,4,3,2') st = 5; }
    if (st && flush) return [8, st];
    if (groups[0][0] === 4) return [7, ...tb];
    if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...tb];
    if (flush) return [5, ...vals];
    if (st) return [4, st];
    if (groups[0][0] === 3) return [3, ...tb];
    if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...tb];
    if (groups[0][0] === 2) return [1, ...tb];
    return [0, ...vals];
  };
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y ? 1 : -1; } return 0; };
  const valid = (rows) => cmp(ev(rows[2]), ev(rows[1])) >= 0 && cmp(ev(rows[1]), ev(rows[0])) >= 0;
  const nameOf = (cs) => (cs.length === 3 ? N3[ev(cs)[0]] : N5[ev(cs)[0]]);
  const val = (e, row) => (row === 0 ? (e[0] === 3 ? 7 : e[0] * 2.2) : e[0] * (row === 1 ? 1.15 : 1)) + (e[1] || 0) / 15;
  const combos = (arr, k) => { const out = []; const go = (s, cur) => { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); } }; go(0, []); return out; };
  /* 自動擺牌：找分數最高的合法擺法 */
  const arrange = (cards, noise) => {
    let best = null, bs = -1e9;
    for (const tail of combos(cards, 5)) {
      const et = ev(tail); const rest = cards.filter((c) => !tail.includes(c));
      for (const mid of combos(rest, 5)) {
        const em = ev(mid); if (cmp(et, em) < 0) continue;
        const head = rest.filter((c) => !mid.includes(c)); const eh = ev(head); if (cmp(em, eh) < 0) continue;
        const s = val(eh, 0) + val(em, 1) + val(et, 2) + (noise ? Math.random() * noise : 0);
        if (s > bs) { bs = s; best = [head, mid, tail]; }
      }
    }
    return best.map((r) => r.slice().sort((a, b) => hv(b) - hv(a)));
  };

  PK.IMPL.thirteen = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      const info = el('div', { class: 'round-info' });
      const arrEl = el('div', { class: 'th13-arr' });
      const L = kit.layout(t, {
        cls: 'th13',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'mid-info' }, info)],
        me: el('div', { class: 'th13-me' }, kit.box(t, me, { cls: 'me-box' }), arrEl),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const showRows = (p, rows, hide) => {
        p.handEl.replaceChildren(el('div', { class: 'th13-rows' }, rows.map((r, i) => el('div', { class: 'th13-row', 'data-row': i }, r.map((c) => PK.cardEl(c, !hide, { small: p !== me })), hide ? '' : el('span', { class: 'th13-name' }, nameOf(r))))));
      };
      /* 玩家擺牌 */
      const humanArrange = (me) => new Promise((resolve) => {
        const local = me === t.me;
        let rows = [[], [], []], pool = me.cards.slice().sort((a, b) => hv(b) - hv(a) || a.s.localeCompare(b.s)), target = 0;
        let pick = null;
        const ui = el('div', { class: 'th13-ui' });
        const render = () => {
          const full = rows.every((r, i) => r.length === SIZE[i]);
          const ok = full && valid(rows);
          ui.replaceChildren(
            ...rows.map((r, i) => el('div', { class: 'th13-slot' + (target === i ? ' on' : ''), onclick: () => { target = i; render(); } },
              el('div', { class: 'th13-lab' }, ROWN[i] + '（' + SIZE[i] + '）', r.length === SIZE[i] ? el('b', null, ' ' + nameOf(r)) : ''),
              el('div', { class: 'th13-cards' }, r.map((c) => { const e = PK.cardEl(c, true); e.classList.add('pickable'); e.addEventListener('click', (ev2) => { ev2.stopPropagation(); rows[i].splice(rows[i].indexOf(c), 1); pool.push(c); pool.sort((a, b) => hv(b) - hv(a)); PK.sfx('click'); render(); }); return e; }),
                Array.from({ length: SIZE[i] - r.length }, () => el('div', { class: 'th13-empty' }))))),
            el('div', { class: 'th13-pool' }, pool.map((c) => { const e = PK.cardEl(c, true); e.classList.add('pickable'); e.addEventListener('click', () => {
              let ti = target; if (rows[ti].length >= SIZE[ti]) ti = rows.findIndex((r, i) => r.length < SIZE[i]); if (ti < 0) return;
              pool.splice(pool.indexOf(c), 1); rows[ti].push(c); rows[ti].sort((a, b) => hv(b) - hv(a)); if (rows[ti].length === SIZE[ti]) { const nx = rows.findIndex((r, i) => r.length < SIZE[i]); if (nx >= 0) target = nx; } PK.sfx('click'); render(); }); return e; })),
            full && !ok ? el('div', { class: 'th13-warn' }, '⚠️ 倒水了！要「尾道 ≥ 中道 ≥ 頭道」') : '',
            el('div', { class: 'bf-btns' },
              el('button', { class: 'btn', onclick: () => { rows = arrange(me.cards); pool = []; target = 0; PK.sfx('skill'); PK.fx.burst(ui, ['🌪️', '✨'], 10); render(); } }, '🌪️ 智能擺牌'),
              el('button', { class: 'btn', onclick: () => { pool = me.cards.slice().sort((a, b) => hv(b) - hv(a)); rows = [[], [], []]; target = 0; render(); } }, '清除'),
              el('button', { class: 'btn primary big', disabled: !full || null, onclick: async () => { if (!ok && !(await PK.confirm('倒水', '這樣擺會「倒水」直接全輸，確定嗎？'))) return; pick && pick(rows); } }, '確定擺好')));
        };
        const go = async () => {
          const r = await kit.ask(t, { who: me, ctrl: arrEl, timer: L.timer, secs: 120, skills: S, buttons: [ui], bind: (pk) => { pick = pk; render(); } });
          if (r.type === 'closed') return resolve(null);
          if (r.type === 'timeout') return resolve(rows.every((x, i) => x.length === SIZE[i]) && valid(rows) ? rows : arrange(me.cards));
          if (r.type === 'skill') {
            const k = r.key;
            if (k === 'swap') {
              if (!me.swapCard) { if (local) PK.toast('四個人玩時沒有剩下的牌可以換'); return go(); }
              const r2 = await kit.ask(t, { who: me, ctrl: arrEl, title: '🔄 點一張要換掉的牌', secs: 30, timer: L.timer, buttons: [el('div', { class: 'th13-pool' }, me.cards.map((x) => { const e = PK.cardEl(x, true); e.classList.add('playable'); e.dataset.id = x.id; return e; }))], bind: (pk) => PK.$$('.th13-pool .card', arrEl).forEach((e) => e.addEventListener('click', () => pk(PK.CARDS.get(e.dataset.id)))) });
              const c = r2.type === 'pick' ? r2.value : me.cards[0];
              S.spend(me, k);
              const nc = me.swapCard; me.swapCard = null;
              me.cards[me.cards.indexOf(c)] = nc;
              rows = rows.map((r) => r.filter((x) => x !== c)); pool = me.cards.filter((x) => !rows.flat().includes(x)).sort((a, b) => hv(b) - hv(a));
              PK.fx.burst(me.seatEl, ['🔄', '✨'], 10); if (local) PK.voice.say('換到' + PK.cardSpeech(nc));
            } else if (k === 'scout') {
              const opp = ps.filter((p) => p.isAI);
              if (!opp.length) { if (local) PK.toast('只能偷看電腦的牌'); return go(); }
              const v = opp.length === 1 ? opp[0] : ps[await kit.choose(t, arrEl, '要偷看誰的牌？', opp.map((p) => ({ text: p.avatar + ' ' + p.name, value: ps.indexOf(p) })), { who: me })];
              S.spend(me, k); PK.fx.peek(v.seatEl);
              if (local) await PK.modal('探子回報', el('div', { class: 'th13-rows' }, v.rows.map((r, i) => el('div', { class: 'th13-row' }, el('span', { class: 'th13-name' }, ROWN[i]), r.map((c) => PK.cardEl(c, true, { small: true })), el('span', { class: 'th13-name' }, nameOf(r))))), [{ text: '知道了', value: 1, cls: 'primary' }]);
            } else { S.spend(me, k); if (k === 'sword') me.sword = true; if (k === 'bell') me.bell = true; PK.fx.burst(me.seatEl, SKILLS[k][0], 8, { g: 0, speed: 3 }); }
            return go();
          }
          resolve(r.value);
        };
        go();
      });

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        const deck = PK.makeDeck();
        ps.forEach((p) => { p.cards = deck.splice(0, 13); p.rows = null; p.sword = p.bell = false; p.score = 0; p.boxEl.classList.remove('winner', 'loser'); kit.setTag(p, ''); p.ptsEl.textContent = ''; });
        const leftover = deck;
        me.handEl.replaceChildren();
        ps.filter((p) => p.isAI).forEach((p) => {
          p.rows = t.diff === 0 ? (Math.random() < 0.08 ? [p.cards.slice(0, 3), p.cards.slice(3, 8), p.cards.slice(8)] : arrange(p.cards, 3)) : arrange(p.cards, t.diff === 1 ? 0.8 : 0);
          if (t.isParty && Math.random() < 0.25) { const k = PK.pick(['sword', 'bell']); if (p.sk[k]) { S.spend(p, k); p[k] = true; } }
          showRows(p, p.rows, true); p.ptsEl.textContent = '擺牌中…';
        });
        PK.sfx('deal'); info.textContent = '把 13 張牌分成三道：頭道 3 張、中道 5 張、尾道 5 張';
        PK.voice.say('請擺牌');
        setTimeout(() => ps.filter((p) => p.isAI).forEach((p) => { p.ptsEl.textContent = '擺好了'; }), 2500);
        ps.forEach((p) => { if (!p.isAI) { p.swapCard = leftover.length ? leftover.pop() : null; if (p !== me) p.ptsEl.textContent = '擺牌中…'; } });
        me.boxEl.style.display = 'none';
        const humanRows = await Promise.all(ps.filter((p) => !p.isAI).map(async (p) => { const r = await humanArrange(p); if (r && p !== me) p.ptsEl.textContent = '擺好了'; return r; }));
        me.boxEl.style.display = '';
        if (!t.alive || humanRows.some((r) => !r)) return;
        ps.filter((p) => !p.isAI).forEach((p, i) => (p.rows = humanRows[i]));
        arrEl.replaceChildren();
        showRows(me, me.rows, false);
        /* 比牌 */
        const foul = new Map(ps.map((p) => [p, !valid(p.rows)]));
        info.textContent = '比牌！';
        PK.fx.banner('開牌比大小！', 'event');
        await t.wait(1000);
        const res = {}; ps.forEach((a) => ps.forEach((b) => { if (a !== b) res[a.name + '>' + b.name] = [0, 0, 0]; }));
        for (let ri = 0; ri < 3; ri++) {
          info.textContent = '比' + ROWN[ri];
          ps.forEach((p) => { if (p !== me) showRows(p, p.rows.map((r, i) => (i <= ri ? r : r)), false); PK.$$('.th13-row', p.handEl).forEach((e, i) => e.classList.toggle('lit', i === ri)); });
          PK.voice.say(ROWN[ri] + '，' + ps.map((p) => (p === me ? '你' : p.name) + nameOf(p.rows[ri])).join('，'), { pri: 2, rate: 1.3 });
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
            const a = ps[i], b = ps[j];
            let w = foul.get(a) && foul.get(b) ? 0 : foul.get(a) ? -1 : foul.get(b) ? 1 : cmp(ev(a.rows[ri]), ev(b.rows[ri]));
            res[a.name + '>' + b.name][ri] = w; res[b.name + '>' + a.name][ri] = -w;
          }
          ps.forEach((p) => { const s = ps.filter((q) => q !== p).reduce((acc, q) => acc + res[p.name + '>' + q.name][ri], 0); PK.fx.floatText(p.seatEl, (s > 0 ? '+' : '') + s, s > 0 ? '#7dff9a' : s < 0 ? '#ff7b7b' : '#fff'); });
          PK.sfx('deal'); PK.fx.burst(L.wrap, ['⚔️'], 6, { g: 0, speed: 4 });
          await t.wait(1600);
        }
        /* 計分：打槍加倍、全壘打再加倍 */
        const shots = [], pair = {};
        ps.forEach((a) => ps.forEach((b) => {
          if (a === b) return;
          const r = res[a.name + '>' + b.name]; let s = r[0] + r[1] + r[2];
          const shot = r.every((x) => x === 1);
          if (shot) { s = b.bell ? s : s * 2; if (a.sword) s += 1; shots.push([a, b]); }
          else if (r.every((x) => x === -1)) { s = a.bell ? s : s * 2; if (b.sword) s -= 1; }
          a.score += s; pair[a.name + '>' + b.name] = s;
        }));
        const homers = n >= 3 ? ps.filter((a) => ps.every((b) => b === a || res[a.name + '>' + b.name].every((x) => x === 1))) : [];
        for (const [a, b] of shots) {
          PK.sfx('boom'); PK.fx.burst(b.seatEl, ['🗡️', '💥', '⚔️'], 16); PK.fx.shake(b.boxEl, 10);
          PK.fx.banner('打槍！', 'event', (a === me ? '你' : a.name) + ' 三道全贏 ' + (b === me ? '你' : b.name));
          if (a === me) PK.ch.emit('shot');
          await t.wait(1200);
        }
        for (const h of homers) { ps.forEach((b) => { if (b !== h) { const v = pair[h.name + '>' + b.name]; h.score += v; b.score -= v; } }); if (h === me) PK.ch.emit('homer'); PK.fx.fireworks(5); PK.fx.banner('全壘打！', 'gold', (h === me ? '你' : h.name) + ' 通殺全場'); await t.wait(1500); }
        ps.forEach((p) => { if (foul.get(p)) kit.setTag(p, '倒水', 'bust'); p.ptsEl.textContent = (p.score > 0 ? '+' : '') + p.score + ' 分'; if (p.score > 0) p.boxEl.classList.add('winner'); });
        const order = ps.slice().sort((a, b) => b.score - a.score);
        info.textContent = order[0].name + ' 這局最高分！';
        await kit.settle(t, me.score * 30, { big: homers.includes(me) || shots.some(([a]) => a === me), title: me.score > 0 ? '贏了 ' + me.score + ' 分！' : me.score < 0 ? '輸了 ' + -me.score + ' 分' : '打平' });
        await PK.modal('本局結果', kit.ranking(t, order, (p) => (p.score > 0 ? '+' : '') + p.score + ' 分'), [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
