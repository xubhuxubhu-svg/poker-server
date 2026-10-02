/* 牌神擂台 — 金拉米（美式咖啡館） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { coffee: ['☕', '咖啡提神', '多摸一張牌，這回合要丟兩張', 1], peek: ['👀', '偷瞄', '看一位對手的三張手牌', 2], dessert: ['🧁', '甜點獎勵', '這局「金」的獎勵加倍', 1], stop: ['🛑', '暫停', '輪回你之前，對手都不能敲桌', 1] };
  const dv = (c) => Math.min(c.r, 10);
  /* 找出最好的組牌方式：散牌點數最少 */
  const solve = (cards) => {
    const n = cards.length, melds = [];
    const byR = {}; cards.forEach((c, i) => (byR[c.r] = byR[c.r] || []).push(i));
    for (const r in byR) { const g = byR[r]; if (g.length >= 3) { for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) for (let c = b + 1; c < g.length; c++) melds.push((1 << g[a]) | (1 << g[b]) | (1 << g[c])); if (g.length === 4) melds.push(g.reduce((m, i) => m | (1 << i), 0)); } }
    for (const s of 'SHDC') {
      const idx = cards.map((c, i) => [c, i]).filter(([c]) => c.s === s).sort((a, b) => a[0].r - b[0].r);
      for (let a = 0; a < idx.length; a++) { let m = 1 << idx[a][1], len = 1; for (let b = a + 1; b < idx.length && idx[b][0].r === idx[b - 1][0].r + 1; b++) { m |= 1 << idx[b][1]; len++; if (len >= 3) melds.push(m); } }
    }
    const memo = new Map();
    const go = (used) => {
      if (memo.has(used)) return memo.get(used);
      let i = 0; while (i < n && used & (1 << i)) i++;
      if (i === n) return { d: 0, m: [] };
      let r0 = go(used | (1 << i)); let best = { d: r0.d + dv(cards[i]), m: r0.m };
      for (const m of melds) if (m & (1 << i) && !(m & used)) { const r = go(used | m); if (r.d < best.d) best = { d: r.d, m: [m, ...r.m] }; }
      memo.set(used, best); return best;
    };
    const b = go(0);
    const inM = b.m.reduce((a, m) => a | m, 0);
    return { dead: b.d, melds: b.m.map((m) => cards.filter((_, i) => m & (1 << i))), loose: cards.filter((_, i) => !(inM & (1 << i))) };
  };
  const bestDiscard = (cards, ban) => { let best = null; for (const c of cards) { if (c === ban) continue; const d = solve(cards.filter((x) => x !== c)).dead; if (!best || d < best.d || (d === best.d && dv(c) > dv(best.c))) best = { c, d }; } return best; };

  PK.IMPL.ginrummy = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      let stock, disc, stopBy, turnNo;
      const stockEl = el('div', { class: 'deck-pile gr-stock' }, [0, 1, 2].map(() => PK.cardEl(null, false)));
      const discEl = el('div', { class: 'gr-disc' });
      const cntEl = el('div', { class: 'rp-cnt' });
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'gr',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'rp-deck' }, stockEl, cntEl), discEl, el('div', { class: 'mid-info' }, info)],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const showDisc = () => { const c = disc[disc.length - 1]; discEl.replaceChildren(c ? PK.cardEl(c, true) : el('div', { class: 'so-slot' }, '棄牌')); cntEl.textContent = '牌堆 ' + stock.length; };
      const show = (p, reveal, sel, onClick) => {
        const sv = solve(p.cards);
        if (p === me || reveal) {
          const groups = [...sv.melds.map((m) => ({ m: true, cs: m.sort((a, b) => a.r - b.r) })), { m: false, cs: sv.loose.sort(kit.bySuitRank) }];
          p.handEl.replaceChildren(...groups.filter((g) => g.cs.length).map((g, gi) => el('div', { class: 'gr-group' + (g.m ? ' meld m' + (gi % 4) : '') }, g.cs.map((c) => { const e = PK.cardEl(c, true, { small: p !== me }); if (sel === c) e.classList.add('selected'); if (onClick) { e.classList.add('pickable'); e.addEventListener('click', () => onClick(c)); } return e; }))));
          p.ptsEl.textContent = '散牌 ' + sv.dead + ' 點';
        } else { p.handEl.replaceChildren(...p.cards.map(() => PK.cardEl(null, false, { small: true }))); p.ptsEl.textContent = p.cards.length + ' 張'; }
        return sv;
      };
      const drawFrom = async (p, src) => {
        const c = src === 'disc' ? disc.pop() : stock.pop();
        await PK.flyCard(src === 'disc' ? discEl : stockEl, p.handEl, null, 250);
        p.cards.push(c); showDisc();
        if (src === 'disc') PK.voice.say((p === me ? '' : p.name) + '撿' + PK.cardSpeech(c), { pri: 2 }); else if (p === me) PK.voice.card(c);
        return c;
      };
      const discard = async (p, c) => {
        p.cards.splice(p.cards.indexOf(c), 1); show(p);
        await PK.flyCard(p.handEl, discEl, null, 250);
        disc.push(c); showDisc(); PK.voice.card(c);
      };

      /* 玩家回合 */
      const humanTurn = async (me) => {
        t.actor = me;
        let picked = null;
        while (!picked) {
          const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 30, skills: S, title: '摸一張：點牌堆，或點棄牌堆撿上一家丟的牌',
            buttons: [{ text: '摸牌堆', value: 'stock', cls: 'primary' }, { text: '撿棄牌', value: 'disc', disabled: !disc.length }],
            bind: (pick) => { stockEl.onclick = () => pick('stock'); discEl.onclick = () => disc.length && pick('disc'); }, cleanup: () => { stockEl.onclick = discEl.onclick = null; } });
          if (r.type === 'closed') return;
          if (r.type === 'skill') { await skill(me, r.key, true); continue; }
          picked = r.type === 'timeout' ? 'stock' : r.value;
        }
        const got = await drawFrom(me, picked);
        let need = 1 + (me.extra || 0); me.extra = 0;
        while (need > 0) {
          let sel = null;
          const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 30, skills: S, title: need > 1 ? '咖啡時間：還要丟 ' + need + ' 張' : '點一張要丟掉的牌',
            buttons: [el('div', { class: 'gr-btns' })],
            bind: (pick) => {
              const box = PK.$('.gr-btns', L.ctrl);
              const upd = () => {
                show(me, false, sel, (c) => { if (picked === 'disc' && c === got) { PK.toast('剛撿的牌不能馬上丟'); return; } sel = c; PK.sfx('click'); upd(); });
                const dAfter = sel ? solve(me.cards.filter((x) => x !== sel)).dead : null;
                const canKnock = sel && need === 1 && dAfter <= 10 && !(stopBy && stopBy !== me);
                box.replaceChildren(
                  el('button', { class: 'btn big', disabled: !sel || null, onclick: () => pick({ c: sel, knock: false }) }, sel ? '丟出 ' + PK.cardName(sel) : '先點一張牌'),
                  el('button', { class: 'btn primary big', disabled: !canKnock || null, onclick: () => pick({ c: sel, knock: true }) }, dAfter === 0 ? '丟出並喊「金」！' : canKnock ? '丟出並敲桌（散牌 ' + dAfter + ' 點）' : '敲桌（散牌要 10 點以下）'));
              };
              upd();
            }, cleanup: () => show(me) });
          if (r.type === 'closed') return;
          if (r.type === 'skill') { if ((await skill(me, r.key, false)) === 'drew') need++; continue; }
          const choice = r.type === 'timeout' ? { c: bestDiscard(me.cards, picked === 'disc' ? got : null).c, knock: false } : r.value;
          await discard(me, choice.c); need--;
          if (choice.knock) return 'knock';
        }
      };
      const skill = async (hp, k, drawPhase) => {
        const local = hp === me;
        if (k === 'coffee' && drawPhase) { if (local) PK.toast('先摸牌，再喝咖啡'); return; }
        if (!S.spend(hp, k)) return;
        if (k === 'coffee') { PK.fx.burst(hp.seatEl, ['☕', '✨'], 10); if (stock.length > 2) { await drawFrom(hp, 'stock'); show(hp); return 'drew'; } }
        if (k === 'peek') {
          const opp = ps.filter((p) => p !== hp);
          const v = opp.length === 1 ? opp[0] : ps[await kit.choose(t, L.ctrl, '要偷瞄誰？', opp.map((p) => ({ text: p.avatar + ' ' + p.name, value: ps.indexOf(p) })), { who: hp })];
          PK.fx.peek(v.handEl);
          const three = PK.shuffle(v.cards.slice()).slice(0, 3);
          if (local) await PK.modal('偷瞄', el('div', { class: 'peek-show' }, el('div', null, '👀 ' + v.name + ' 手上有'), el('div', { class: 'row-cards' }, three.map((c) => PK.cardEl(c, true)))), [{ text: '知道了', value: 1, cls: 'primary' }]);
        }
        if (k === 'dessert') { hp.dessert = true; PK.fx.burst(hp.seatEl, '🧁', 8, { g: 0, speed: 3 }); }
        if (k === 'stop') { stopBy = hp; PK.fx.burst(L.wrap, ['🛑', '✋'], 12); PK.fx.banner('暫停！', 'event', (local ? '' : hp.name + '：') + '對手不能敲桌'); }
      };
      const aiTurn = async (p) => {
        await t.wait(PK.randInt(600, 1000));
        const top = disc[disc.length - 1];
        let take = false;
        if (top) {
          const now = bestDiscard(p.cards).d;
          const withTop = bestDiscard([...p.cards, top], top).d;
          take = t.diff === 0 ? Math.random() < 0.3 : withTop < now - (t.diff === 2 ? 0 : 1);
        }
        const got = await drawFrom(p, take ? 'disc' : 'stock'); show(p);
        await t.wait(450);
        const bd = bestDiscard(p.cards, take ? got : null);
        const c = t.diff === 0 && Math.random() < 0.35 ? PK.pick(p.cards.filter((x) => x !== got)) : bd.c;
        await discard(p, c);
        const dead = solve(p.cards).dead;
        const th = [8, 7, 4][t.diff];
        const knock = !(stopBy && stopBy !== p) && dead <= 10 && (dead === 0 || dead <= th || (turnNo > 6 * n && dead <= 10) || (t.diff === 0 && Math.random() < 0.5));
        if (t.isParty && dead <= 3 && p.sk.dessert && Math.random() < 0.5) { S.spend(p, 'dessert'); p.dessert = true; }
        if (t.isParty && !knock && Math.random() < 0.08 && p.sk.stop) { S.spend(p, 'stop'); stopBy = p; PK.fx.banner(p.name + '：暫停！', 'event'); }
        return knock ? 'knock' : null;
      };

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        const deck = PK.makeDeck(); disc = []; stopBy = null; turnNo = 0;
        ps.forEach((p) => { p.cards = deck.splice(0, 10); p.dessert = false; p.extra = 0; p.boxEl.classList.remove('winner', 'loser'); kit.setTag(p, ''); });
        stock = deck; disc.push(stock.pop());
        ps.forEach((p) => show(p)); showDisc(); PK.sfx('deal');
        let cur = PK.randInt(0, n - 1), knocker = null;
        while (t.alive && !knocker) {
          if (stock.length <= 2) break;
          const p = ps[cur]; turnNo++;
          if (stopBy === p) { stopBy = null; }
          kit.active(ps, p); info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
          const r = p.isAI ? await aiTurn(p) : await humanTurn(p);
          if (r === 'knock') knocker = p;
          cur = (cur + 1) % n;
        }
        if (!t.alive) return;
        kit.active(ps, null);
        const pts = new Map(ps.map((p) => [p, 0]));
        if (!knocker) {
          info.textContent = '牌堆快沒了，這局流局';
          PK.fx.banner('流局', 'event');
          ps.forEach((p) => show(p, true));
        } else {
          const dk = solve(knocker.cards).dead, gin = dk === 0;
          PK.sfx(gin ? 'big' : 'boom');
          PK.fx.burst(knocker.seatEl, gin ? ['🥇', '☕', '✨', '🎉'] : ['☕', '💥'], 22); PK.fx.shake(L.wrap, 8);
          PK.fx.banner(gin ? '金！' : '敲桌！', gin ? 'gold' : 'event', (knocker === me ? '你' : knocker.name) + '・散牌 ' + dk + ' 點');
          ps.forEach((p) => show(p, true));
          await t.wait(1400);
          const lines = [];
          for (const o of ps) {
            if (o === knocker) continue;
            const d = solve(o.cards).dead;
            if (gin) { const v = d + (knocker.dessert ? 50 : 25); pts.set(knocker, pts.get(knocker) + v); pts.set(o, pts.get(o) - v); lines.push(`${knocker.name} 從 ${o.name} 拿 ${v} 分（金）`); }
            else if (dk < d) { const v = d - dk; pts.set(knocker, pts.get(knocker) + v); pts.set(o, pts.get(o) - v); lines.push(`${knocker.name} 從 ${o.name} 拿 ${v} 分`); }
            else { const v = dk - d + 25; pts.set(o, pts.get(o) + v); pts.set(knocker, pts.get(knocker) - v); lines.push(`${o.name} 反殺！拿 ${v} 分`); PK.fx.banner('反殺！', 'event', o.name + ' 散牌更少'); }
          }
          lines.forEach((l) => t.sys(l));
          info.textContent = (knocker === me ? '你' : knocker.name) + (gin ? ' 喊金！' : ' 敲桌');
          if (gin && knocker === me) PK.ch.emit('gin');
        }
        ps.forEach((p) => { const v = pts.get(p); PK.fx.floatText(p.seatEl, (v > 0 ? '+' : '') + v + ' 分', v > 0 ? '#7dff9a' : v < 0 ? '#ff7b7b' : '#fff'); if (v > 0) p.boxEl.classList.add('winner'); });
        await t.wait(900);
        const myPts = pts.get(me);
        await kit.settle(t, myPts * 3, { big: myPts >= 25, title: myPts > 0 ? '這局贏了 ' + myPts + ' 分' : myPts < 0 ? '這局輸了 ' + -myPts + ' 分' : '這局打平' });
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
