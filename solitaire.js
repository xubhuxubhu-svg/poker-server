/* 牌神擂台 — 經典接龍（森林療癒） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { hint: ['🐝', '螢火蟲提示', '顯示一步可以走的牌', 3], undo: ['⏪', '時光倒流', '收回上一步', 3], fly: ['🦋', '蝴蝶', '把收牌區需要的下一張牌直接送過去', 1], wind: ['🍃', '森林之風', '把牌堆和翻開的牌重新洗過', 1] };
  const FS = ['S', 'H', 'D', 'C'];
  const red = (c) => c.s === 'H' || c.s === 'D';

  PK.IMPL.solitaire = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me;
      let stock, waste, found, tab, hist, moves, startAt, ended;
      const boardEl = el('div', { class: 'so-board' });
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'so',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'so-wrap' }, info, boardEl)],
        me: kit.box(t, me, { cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const snap = () => JSON.stringify({ stock, waste, found, tab });
      const save = () => { hist.push(snap()); if (hist.length > 80) hist.shift(); };
      const total = () => FS.reduce((a, s) => a + found[s].length, 0);
      const canFound = (c) => found[c.s].length === c.r - 1;
      const canTab = (c, col) => { const top = col[col.length - 1]; return !top ? c.r === 13 : top.up && red(top) !== red(c) && top.r === c.r + 1; };
      const flipTop = (col) => { const top = col[col.length - 1]; if (top && !top.up) { top.up = true; return true; } return false; };

      /* ---------- 畫面 ---------- */
      let hintSel = null;
      const render = () => {
        const cardNode = (c, up, onClick, hint) => { const e = PK.cardEl(c, up); if (onClick) e.addEventListener('click', (ev) => { ev.stopPropagation(); onClick(); }); if (hint) e.classList.add('hint'); return e; };
        const stockEl = el('div', { class: 'so-slot so-stock', onclick: () => act(drawStock) }, stock.length ? cardNode(null, false, () => act(drawStock), hintSel === 'stock') : el('span', null, '↻'));
        const w = waste[waste.length - 1];
        const wasteEl = el('div', { class: 'so-slot' }, w ? cardNode(w, true, () => act(() => autoMove('w')), hintSel === 'w') : '');
        const fEls = FS.map((s) => { const f = found[s]; return el('div', { class: 'so-slot so-found ' + (s === 'H' || s === 'D' ? 'red' : '') }, f.length ? PK.cardEl(f[f.length - 1], true) : el('span', null, PK.SUITS[s])); });
        const cols = tab.map((col, ci) => {
          const ce = el('div', { class: 'so-col', onclick: () => {} });
          let y = 0;
          col.forEach((c, i) => {
            const e = cardNode(c, c.up, c.up ? () => act(() => autoMove('t', ci, i)) : null, hintSel && hintSel[0] === ci && hintSel[1] === i);
            e.style.top = y + 'px'; ce.append(e);
            y += c.up ? upGap : downGap;
          });
          ce.style.height = 'calc(var(--card-h) + ' + y + 'px)';
          return ce;
        });
        boardEl.replaceChildren(el('div', { class: 'so-top' }, stockEl, wasteEl, el('div', { class: 'so-gap' }), ...fEls), el('div', { class: 'so-tab' }, cols));
        me.ptsEl.textContent = '收牌 ' + total() + ' / 52';
        me.tagEl.textContent = '步數 ' + moves;
      };
      let upGap = 22, downGap = 9;
      const sizeGaps = () => { const m = innerWidth < 760; upGap = m ? 17 : 24; downGap = m ? 7 : 10; };

      /* ---------- 動作 ---------- */
      let busy = false;
      const act = (fn) => { if (busy || ended) return; hintSel = null; const before = snap(); const okk = fn(); if (okk) { hist.push(before); moves++; PK.sfx('deal'); } render(); checkWin(); };
      const drawStock = () => {
        if (stock.length) { const c = stock.pop(); c.up = true; waste.push(c); return true; }
        if (!waste.length) return false;
        stock = waste.reverse().map((c) => ((c.up = false), c)); waste = []; return true;
      };
      const toFound = (c) => { found[c.s].push(c); PK.fx.sparkle(boardEl.querySelector('.so-found') || boardEl, '#ffd166', 12); if (c.r === 13) { PK.fx.burst(boardEl, ['🍃', '🌸', '✨'], 16); PK.fx.banner(PK.SUIT_NAME[c.s] + '完成！', 'gold'); } };
      const autoMove = (src, ci, i) => {
        if (src === 'w') {
          const c = waste[waste.length - 1]; if (!c) return false;
          if (canFound(c)) { waste.pop(); toFound(c); return true; }
          const tgt = pickCol([c]); if (tgt < 0) { nope(); return false; }
          waste.pop(); tab[tgt].push(c); return true;
        }
        const col = tab[ci], stack = col.slice(i);
        if (stack.length === 1 && canFound(stack[0])) { col.pop(); toFound(stack[0]); flipTop(col); return true; }
        const tgt = pickCol(stack, ci); if (tgt < 0) { nope(); return false; }
        if (i === 0 && stack[0].r === 13 && !tab[tgt].length) { nope(); return false; }
        col.splice(i); tab[tgt].push(...stack); if (flipTop(col)) PK.fx.burst(boardEl, '🍂', 4); return true;
      };
      const pickCol = (stack, from) => {
        const order = tab.map((_, k) => k).filter((k) => k !== from).sort((a, b) => (tab[b].length ? 1 : 0) - (tab[a].length ? 1 : 0));
        for (const k of order) if (canTab(stack[0], tab[k])) return k;
        return -1;
      };
      const nope = () => { PK.sfx('lose'); PK.fx.shake(boardEl, 4); };
      /* 找一步提示 */
      const findHint = () => {
        const w = waste[waste.length - 1];
        for (let ci = 0; ci < 7; ci++) { const c = tab[ci][tab[ci].length - 1]; if (c && c.up && canFound(c)) return [ci, tab[ci].length - 1]; }
        if (w && canFound(w)) return 'w';
        for (let ci = 0; ci < 7; ci++) { const col = tab[ci]; const i = col.findIndex((c) => c.up); if (i < 0) continue; if (i === 0 && col[0].r === 13) continue; for (let k = 0; k < 7; k++) if (k !== ci && canTab(col[i], tab[k])) return [ci, i]; }
        if (w && pickCol([w]) >= 0) return 'w';
        if (stock.length || waste.length) return 'stock';
        return null;
      };
      const checkWin = () => {
        if (total() === 52 && !ended) { ended = 'win'; resolveEnd && resolveEnd('win'); }
        else if (!stock.length && !waste.length && tab.every((col) => col.every((c) => c.up)) && total() < 52) autoBtn.disabled = false;
      };
      const autoBtn = el('button', { class: 'btn primary', disabled: true, onclick: async () => {
        busy = true; autoBtn.disabled = true;
        while (total() < 52 && t.alive) {
          let moved = false;
          for (const col of tab) { const c = col[col.length - 1]; if (c && canFound(c)) { col.pop(); toFound(c); moved = true; break; } }
          render(); PK.sfx('deal'); if (!moved) break; await PK.sleep(90);
        }
        busy = false; checkWin();
      } }, '✨ 自動完成');
      let resolveEnd = null;

      /* ---------- 技能 ---------- */
      const onSkill = (k, buy) => {
        if (ended || busy) return;
        if (buy) me.sk[k] = (me.sk[k] || 0) + 1;
        if (k === 'undo' && !hist.length) { PK.toast('沒有可以收回的步驟'); return; }
        if (!S.spend(me, k)) return;
        if (k === 'hint') { hintSel = findHint(); if (!hintSel) PK.toast('沒有可以走的步了，試試其他技能'); else if (hintSel === 'stock') PK.toast('翻牌堆看看'); render(); PK.fx.burst(boardEl, '🐝', 6, { g: 0, speed: 3 }); }
        if (k === 'undo') { const s = JSON.parse(hist.pop()); stock = s.stock; waste = s.waste; found = s.found; tab = s.tab; moves++; render(); PK.fx.burst(boardEl, '⏪', 6); }
        if (k === 'fly') {
          const cand = FS.map((s) => ({ r: found[s].length + 1, s })).filter((x) => x.r <= 13);
          let done = false;
          for (const need of cand.sort((a, b) => a.r - b.r)) {
            const eq = (c) => c.r === need.r && c.s === need.s;
            let i = stock.findIndex(eq); if (i >= 0) { save(); found[need.s].push(Object.assign(stock.splice(i, 1)[0], { up: true })); done = true; break; }
            i = waste.findIndex(eq); if (i >= 0 && i === waste.length - 1) { save(); found[need.s].push(waste.pop()); done = true; break; }
            for (const col of tab) { const j = col.findIndex(eq); if (j >= 0 && (!col[j].up || j === col.length - 1)) { save(); const [c] = col.splice(j, 1); c.up = true; found[need.s].push(c); flipTop(col); done = true; break; } }
            if (done) break;
          }
          if (!done) { me.sk.fly++; PK.toast('需要的牌現在拿不到'); }
          else PK.fx.burst(boardEl, ['🦋', '✨'], 14);
          render(); checkWin();
        }
        if (k === 'wind') { save(); const cs = stock.concat(waste); for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(PK.nrand() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; } stock = cs.map((c) => ((c.up = false), c)); waste = []; PK.fx.burst(boardEl, ['🍃', '🍂', '🌿'], 20); render(); }
      };

      /* ---------- 對手（同一副牌競速）：電腦的速度在開局時就決定好，連線的家人回報自己的進度 ---------- */
      const rivals = ps.filter((p) => p !== me);
      const elapsed = () => (Date.now() - startAt) / 1000;
      const aiProg = (p, e) => Math.min(p.cap, Math.floor(e * p.speed));
      const tick = () => {
        const e = elapsed();
        for (const p of rivals) {
          if (p.isAI) {
            const pr = aiProg(p, e);
            if (pr !== p.prog) p.prog = pr;
            if (!p.done && !p.stuck && p.prog >= p.cap) {
              if (p.cap >= 52) { p.done = true; p.fin = 52 / p.speed; PK.fx.burst(p.seatEl, ['🏁', '🎉'], 14); PK.fx.banner(p.name + ' 完成了！', 'event'); t.say(p, '我完成啦！'); }
              else { p.stuck = true; kit.setTag(p, '卡住了', 'bust'); t.say(p, PK.cpick(['卡住了…', '沒步可以走了 😭', '這副牌好難'])); }
            }
          }
          p.ptsEl.textContent = p.done ? '完成！' : '收牌 ' + (p.prog || 0) + ' / 52';
          if (p.barEl) p.barEl.style.width = ((p.done ? 52 : p.prog || 0) / 52) * 100 + '%';
        }
      };
      let lastSent = -1;
      const report = (extra) => { if (!t.online) return; const pr = total(); if (!extra && pr === lastSent) return; lastSent = pr; t.net.tx(Object.assign({ t: 'x', k: 'so', g: game, prog: pr }, extra || {})); };
      t.onX = (m) => {
        if (m.k !== 'so' || m.g !== game) return;
        const p = ps[m.seat]; if (!p || p === me) return;
        p.prog = m.prog;
        if (m.fin != null && !p.done) { p.done = true; p.fin = m.fin; PK.fx.burst(p.seatEl, ['🏁', '🎉'], 14); PK.fx.banner(p.name + ' 完成了！', 'event'); }
        if (m.quit) { p.stuck = true; kit.setTag(p, '放棄了', 'stand'); }
        tick();
      };

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        sizeGaps();
        const deck = PK.makeDeck();
        stock = []; waste = []; found = { S: [], H: [], D: [], C: [] }; tab = [[], [], [], [], [], [], []]; hist = []; moves = 0; ended = null; hintSel = null; lastSent = -1;
        for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) { const c = deck.pop(); c.up = i === j; tab[j].push(c); }
        stock = deck.map((c) => ((c.up = false), c));
        rivals.forEach((p) => {
          p.prog = 0; p.done = p.stuck = false; p.fin = null; kit.setTag(p, '');
          if (p.isAI) {
            const solveP = [0.35, 0.55, 0.75][t.diff];
            p.cap = Math.random() < solveP ? 52 : PK.randInt(14, 46);
            p.speed = [0.18, 0.27, 0.38][t.diff] * PK.rand(0.6, 1.4);
          }
          p.handEl.replaceChildren(el('div', { class: 'so-bar' }, (p.barEl = el('div', { class: 'so-bar-fill' }))));
          p.ptsEl.textContent = '收牌 0 / 52';
        });
        ps.forEach((p) => p.boxEl.classList.remove('winner'));
        me.handEl.replaceChildren();
        info.textContent = ps.length > 1 ? '大家拿到完全相同的牌局，比誰先完成！' : '把所有牌依花色從 A 排到 K 收到右上角';
        render();
        startAt = Date.now();
        const iv = setInterval(() => { if (!t.alive) return clearInterval(iv); if (!ended) { tick(); report(); } }, 1000);
        S.render(true, onSkill);
        const giveUp = el('button', { class: 'btn', onclick: async () => { if (await PK.confirm('放棄', '確定要放棄這一局嗎？')) { ended = 'quit'; resolveEnd && resolveEnd('quit'); } } }, '🏳️ 放棄這局');
        L.ctrl.replaceChildren(autoBtn, giveUp);
        const res = await new Promise((r) => (resolveEnd = r));
        clearInterval(iv); S.render(false); L.ctrl.replaceChildren();
        if (!t.alive) return;
        const E = elapsed(), secs = Math.round(E);
        report(res === 'win' ? { fin: E } : { quit: true });
        tick();
        me.prog = total(); me.done = res === 'win'; me.fin = res === 'win' ? E : null;
        const all = [me, ...rivals];
        const fin = all.filter((p) => p.done && p.fin != null && p.fin <= E + 0.001).sort((a, b) => a.fin - b.fin);
        const rest = all.filter((p) => !fin.includes(p)).sort((a, b) => (b.prog || 0) - (a.prog || 0));
        const order = [...fin, ...rest];
        if (res === 'win') {
          me.boxEl.classList.add('winner');
          PK.fx.burst(boardEl, ['🂡', '🃁', '🂱', '🃑', '🍃', '✨'], 40, { speed: 10 }); PK.fx.confetti(160);
          info.textContent = `完成！用了 ${Math.floor(secs / 60)} 分 ${secs % 60} 秒、${moves} 步`;
          PK.ch.emit('sol');
        } else info.textContent = '這局放棄了';
        const n = ps.length, place = order.indexOf(me);
        const reward = n === 1 ? (res === 'win' ? 200 : -50) : kit.rankReward(n, place);
        await t.wait(800);
        await kit.settle(t, reward, { big: res === 'win' && place === 0, title: res === 'win' ? (place === 0 ? '第一個完成！' : '完成！第 ' + (place + 1) + ' 名') : '放棄這局' });
        if (n > 1) await PK.modal('本局排名', kit.ranking(t, order, (p) => (fin.includes(p) ? '完成 ' + Math.round(p.fin) + ' 秒' : '收牌 ' + (p.prog || 0))), [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
