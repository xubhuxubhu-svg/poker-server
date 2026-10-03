/* 牌神擂台 — 排七（日式和風） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { seal: ['🔒', '封印', '鎖住一個花色，直到輪回你之前都不能接', 1], ink: ['🖌️', '墨汁', '蓋牌中點數最大的一張，分數減半', 1], shield: ['🌸', '櫻花護盾', '這回合不接也不蓋，直接跳過', 1], push: ['🎎', '送牌', '把一張手牌塞給下一家', 1], wave: ['🌊', '浪潮', '所有人的蓋牌重新洗亂分配', 1] };
  const ORDER = ['S', 'H', 'D', 'C'];

  PK.IMPL.sevens = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      let lines, seal;
      const boardEl = el('div', { class: 'sv-board' });
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'sv',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'sv-mid' }, info, boardEl)],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const ok = (c) => {
        if (seal && seal.suit === c.s) return false;
        if (!lines.S) return c.s === 'S' && c.r === 7;
        if (c.r === 7) return !lines[c.s];
        const l = lines[c.s];
        return !!l && (c.r === l.lo - 1 || c.r === l.hi + 1);
      };
      const score = (p) => p.covered.reduce((a, c) => a + c.r, 0) - (p.inkCut || 0);
      const drawBoard = () => boardEl.replaceChildren(...ORDER.map((s) => {
        const l = lines[s];
        const row = el('div', { class: 'sv-row' + (seal && seal.suit === s ? ' sealed' : '') + (l && l.lo === 1 && l.hi === 13 ? ' done' : '') },
          el('div', { class: 'sv-suit ' + (s === 'H' || s === 'D' ? 'red' : '') }, PK.SUITS[s]));
        const cards = el('div', { class: 'sv-cards' });
        if (!l) cards.append(el('div', { class: 'sv-slot' }, '7'));
        else for (let r = l.lo; r <= l.hi; r++) cards.append(PK.cardEl({ r, s }, true, { small: true }));
        row.append(cards);
        if (seal && seal.suit === s) row.append(el('div', { class: 'sv-lock' }, '🔒'));
        return row;
      }));
      const show = (p) => {
        if (p === me) { kit.render(me, true, { sort: kit.bySuitRank, onClick: (c) => me.pick && me.pick(c), mark: (c) => me.pick && (me.coverMode || ok(c)), markCls: me.coverMode ? 'cover-pick' : 'sv-hint' }); }
        else p.handEl.replaceChildren(...p.cards.slice(0, 7).map(() => PK.cardEl(null, false, { small: true })));
        p.ptsEl.textContent = p.cards.length + ' 張';
        kit.setTag(p, p.covered.length ? '蓋 ' + p.covered.length + ' 張' : '', 'stand');
      };
      const play = async (p, c) => {
        if (!c) return;
        p.cards.splice(p.cards.indexOf(c), 1); show(p);
        await PK.flyCard(p.handEl, boardEl, null, 260);
        if (c.r === 7) { lines[c.s] = { lo: 7, hi: 7 }; PK.fx.burst(boardEl, ['🌸', '🌸', '✨'], 14); }
        else if (c.r < 7) lines[c.s].lo = c.r; else lines[c.s].hi = c.r;
        drawBoard(); PK.voice.card(c);
        const l = lines[c.s];
        if (l.lo === 1 && l.hi === 13) { PK.fx.fireworks(3); PK.fx.banner(PK.SUIT_NAME[c.s] + '完成！', 'gold'); }
      };
      const cover = async (p, c) => {
        if (!c) return;
        p.cards.splice(p.cards.indexOf(c), 1); p.covered.push(c);
        PK.sfx('splat'); PK.fx.burst(p.seatEl, ['🖌️', '⚫', '💧'], 10); PK.voice.say('蓋牌', { pri: 2 });
        if (p !== me) kit.say(t, p, 'bad', 0.3);
        show(p);
      };
      const useSkill = async (p, k) => {
        if (!S.spend(p, k)) return;
        if (k === 'seal') {
          if (!ORDER.some((s) => lines[s])) { p.sk.seal++; if (p === me) { S.render(S.enabled); PK.toast('還沒有花色可以封印'); } return; }
          let suit;
          if (!p.isAI) suit = await kit.choose(t, L.ctrl, '要封印哪個花色？', ORDER.filter((s) => lines[s]).map((s) => ({ text: PK.SUITS[s] + ' ' + PK.SUIT_NAME[s], value: s, cls: 'suit-btn s' + s })), { who: p });
          else { const opened = ORDER.filter((s) => lines[s]); suit = opened.sort((a, b) => p.cards.filter((c) => c.s === a).length - p.cards.filter((c) => c.s === b).length)[0]; }
          if (!suit) return;
          seal = { suit, by: p }; drawBoard(); PK.fx.burst(boardEl, ['🔒', '⛓️'], 12); PK.fx.banner('封印 ' + PK.SUIT_NAME[suit], 'event');
        }
        if (k === 'ink') { if (!p.covered.length) { p.sk.ink++; if (p === me) PK.toast('還沒有蓋牌'); return; } const mx = Math.max(...p.covered.map((c) => c.r)); p.inkCut = (p.inkCut || 0) + Math.floor(mx / 2); PK.fx.burst(p.seatEl, ['🖌️', '✨'], 10); }
        if (k === 'push') {
          if (!p.cards.length) { p.sk.push++; if (p === me) S.render(S.enabled); return; }
          const nx = ps[(ps.indexOf(p) + 1) % n];
          let c;
          if (!p.isAI) { const r = await kit.ask(t, { who: p, ctrl: L.ctrl, title: '🎎 點一張要塞給 ' + nx.name + ' 的牌', secs: 20, timer: L.timer, bind: (pick) => { me.coverMode = true; me.pick = pick; show(me); }, cleanup: () => { me.coverMode = false; me.pick = null; show(me); } }); c = r.type === 'pick' ? r.value : p.cards[0]; }
          else c = p.cards.slice().sort((a, b) => b.r - a.r)[0];
          p.cards.splice(p.cards.indexOf(c), 1); nx.cards.push(c);
          await PK.flyCard(p.seatEl, nx.handEl, null, 300); PK.fx.burst(nx.seatEl, '🎎', 8); show(p); show(nx);
        }
        if (k === 'wave') {
          const all = PK.shuffle(ps.flatMap((x) => x.covered)); const cnt = ps.map((x) => x.covered.length);
          ps.forEach((x, i) => (x.covered = all.splice(0, cnt[i])));
          PK.fx.burst(L.wrap, ['🌊', '💧', '🐟'], 24); PK.fx.shake(L.wrap, 6); ps.forEach(show);
        }
      };
      /* 電腦選擇 */
      const aiPick = (p, playable) => {
        if (t.diff === 0) return PK.pick(playable);
        const has = (r, s) => p.cards.some((c) => c.r === r && c.s === s);
        const sc = (c) => {
          let s = 0, dirn = c.r === 7 ? 0 : c.r < 7 ? -1 : 1;
          if (dirn) { let r = c.r + dirn; while (r >= 1 && r <= 13 && has(r, c.s)) { s += 3; r += dirn; } if (t.diff === 2 && r >= 1 && r <= 13 && r === c.r + dirn) s -= 2; }
          else { s += p.cards.filter((x) => x.s === c.s).length - 2; }
          if (c.r === 1 || c.r === 13) s += 1;
          return s + Math.random();
        };
        return playable.sort((a, b) => sc(b) - sc(a))[0];
      };

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        lines = {}; seal = null;
        const deck = PK.makeDeck();
        ps.forEach((p) => { p.cards = []; p.covered = []; p.inkCut = 0; p.boxEl.classList.remove('winner', 'loser'); });
        deck.forEach((c, i) => ps[i % n].cards.push(c));
        ps.forEach(show); drawBoard(); PK.sfx('deal');
        let cur = ps.findIndex((p) => p.cards.some((c) => c.s === 'S' && c.r === 7));
        t.sys(ps[cur].name + ' 有黑桃 7，先出');
        while (t.alive && ps.some((p) => p.cards.length)) {
          const p = ps[cur];
          if (seal && seal.by === p) { seal = null; drawBoard(); }
          if (!p.cards.length) { cur = (cur + 1) % n; continue; }
          kit.active(ps, p); info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
          if (!p.isAI) {
            t.actor = p;
            await (async (me) => {
            while (true) {
              const playable = me.cards.filter(ok);
              me.coverMode = !playable.length;
              const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 25, skills: S,
                title: playable.length ? '點一張發亮的牌接上去' : '沒有牌可以接，點一張牌蓋起來（點數會算進分數）',
                bind: (pick) => { me.pick = pick; show(me); }, cleanup: () => { me.pick = null; show(me); } });
              if (r.type === 'closed') return;
              if (r.type === 'skill') { await useSkill(me, r.key); if (r.key === 'shield' || !me.cards.length) break; continue; }
              let c = r.value;
              if (r.type === 'timeout') c = playable[0] || me.cards.slice().sort((a, b) => a.r - b.r)[0];
              if (playable.length && !ok(c)) { if (me === t.me) PK.toast('這張不能接'); continue; }
              me.coverMode = false;
              if (playable.length) await play(me, c); else await cover(me, c);
              break;
            }
            })(p);
          } else {
            await t.wait(PK.randInt(500, 850));
            if (t.isParty && Math.random() < 0.12) { const k = PK.pick(Object.keys(SKILLS)); if (p.sk[k] && k !== 'shield' && (k !== 'seal' || Object.keys(lines).length)) await useSkill(p, k); }
            const playable2 = p.cards.filter(ok);
            if (!p.cards.length) { /* 送完了 */ }
            else if (playable2.length) await play(p, aiPick(p, playable2));
            else if (t.isParty && p.sk.shield && Math.random() < 0.5) await useSkill(p, 'shield');
            else await cover(p, p.cards.slice().sort((a, b) => a.r - b.r)[0]);
          }
          await t.wait(250);
          cur = (cur + 1) % n;
        }
        kit.active(ps, null); seal = null; drawBoard();
        const order = ps.slice().sort((a, b) => score(a) - score(b));
        order[0].boxEl.classList.add('winner');
        info.textContent = order[0].name + ' 蓋牌最少，獲勝！';
        const place = order.indexOf(me);
        await t.wait(800);
        await kit.settle(t, kit.rankReward(n, place), { big: place === 0, title: place === 0 ? '你贏了！' : '第 ' + (place + 1) + ' 名' });
        await PK.modal('本局排名（蓋牌點數越少越好）', kit.ranking(t, order, (p) => score(p) + ' 分・蓋 ' + p.covered.length + ' 張'), [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
