/* 牌神擂台 — 吹牛（海盜酒館） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { lens: ['🔍', '測謊鏡', '偷看上一家打出的其中一張牌', 2], cannon: ['💣', '大砲轟炸', '下次抓到說謊時，對方再多收你 3 張牌', 1], flag: ['☠️', '黑旗', '你下一次出的牌沒人能抓', 1], hide: ['🏝️', '藏寶', '把一張選好的手牌直接藏起來（丟掉）', 1] };
  const NUM = ['', '一', '兩', '三', '四'];
  const RW = PK.RANK_TXT;

  PK.IMPL.bluff = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      let pile, last, claim;
      const pileEl = el('div', { class: 'bf-pile' });
      const claimEl = el('div', { class: 'bf-claim' });
      const revealEl = el('div', { class: 'bf-reveal' });
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'bf',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'bf-mid' }, pileEl, el('div', { class: 'mid-info' }, info, claimEl), revealEl)],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const show = (p, sel, onClick) => {
        if (p === me) {
          me.handEl.replaceChildren(...me.cards.slice().sort(kit.byRank).map((c) => { const e = PK.cardEl(c, true); if (sel && sel.has(c)) e.classList.add('selected'); if (onClick) { e.classList.add('pickable'); e.addEventListener('click', () => onClick(c)); } return e; }));
        } else p.handEl.replaceChildren(...p.cards.slice(0, 8).map(() => PK.cardEl(null, false, { small: true })));
        p.ptsEl.textContent = p.cards.length + ' 張';
      };
      const drawPile = () => {
        pileEl.replaceChildren(...pile.slice(-5).map((c, i) => { const e = PK.cardEl(null, false); e.style.transform = `rotate(${(i * 23) % 30 - 15}deg) translate(${i * 2}px,${-i * 2}px)`; return e; }), el('div', { class: 'bf-cnt' }, pile.length ? pile.length + ' 張' : '空'));
        claimEl.textContent = last ? `${last.p === me ? '你' : last.p.name}：${NUM[last.count]}張 ${RW[last.rank]}` : claim ? '這一輪喊 ' + RW[claim] : '新的一輪，自由喊點數';
      };
      const play = async (p, cards, rank) => {
        cards.forEach((c) => p.cards.splice(p.cards.indexOf(c), 1));
        show(p);
        await PK.flyCard(p.handEl, pileEl, null, 260);
        pile.push(...cards); claim = rank;
        last = { p, cards, rank, count: cards.length, flag: p.flagArmed };
        p.flagArmed = false;
        drawPile();
        PK.voice.say(NUM[cards.length] + '張' + (rank === 1 ? 'A' : RW[rank]), { pri: 2, pitch: p.voicePitch || 1 });
        if (last.flag) { PK.fx.burst(pileEl, ['☠️', '🏴‍☠️'], 10); PK.fx.floatText(pileEl, '黑旗保護', '#e8b04a'); }
      };
      /* 抓！ */
      const call = async (caller) => {
        const L0 = last;
        PK.sfx('boom'); PK.fx.banner('抓！', 'event', (caller === me ? '你' : caller.name) + ' 抓 ' + (L0.p === me ? '你' : L0.p.name));
        PK.fx.burst(caller.seatEl, ['💣', '💥'], 12); PK.fx.shake(L.wrap, 6);
        await t.wait(700);
        revealEl.replaceChildren(...L0.cards.map((c) => { const e = PK.cardEl(c, true); e.classList.add('flip-in'); if (c.r !== L0.rank) e.classList.add('lie'); return e; }));
        PK.voice.say(L0.cards.map(PK.cardSpeech).join('、'), { pri: 2, rate: 1.3 });
        await t.wait(1300);
        const lie = L0.cards.some((c) => c.r !== L0.rank);
        const taker = lie ? L0.p : caller;
        if (lie) { PK.fx.burst(L0.p.seatEl, ['☠️', '🏴‍☠️', '💥'], 22); PK.fx.banner('說謊被抓到！', 'good', (L0.p === me ? '你' : L0.p.name) + ' 收下全部的牌'); kit.say(t, L0.p, 'bad', 0.8); if (caller.isAI) t.say(caller, PK.pick(['就知道你在吹牛！', '抓到了吧～', '哈哈哈'])); }
        else { PK.fx.burst(caller.seatEl, ['😱', '💦'], 14); PK.fx.banner('冤枉啊！', 'bad', '是真的！' + (caller === me ? '你' : caller.name) + ' 收下全部的牌'); if (L0.p.isAI) t.say(L0.p, PK.pick(['我說的是實話！', '嘿嘿，冤枉我了吧', '誠實的海盜'])); }
        await t.wait(900);
        await PK.flyCard(pileEl, taker.handEl, null, 380);
        taker.cards.push(...pile);
        if (lie && caller.cannon) {
          caller.cannon = false;
          const extra = PK.shuffle(caller.cards.slice()).slice(0, 3);
          extra.forEach((c) => caller.cards.splice(caller.cards.indexOf(c), 1)); taker.cards.push(...extra);
          PK.fx.burst(taker.seatEl, ['💣', '🔥', '💥'], 20); PK.fx.banner('大砲轟炸！', 'event', '再多送 ' + extra.length + ' 張'); show(caller);
        }
        pile = []; last = null; claim = null; revealEl.replaceChildren();
        show(taker); drawPile();
        return lie ? caller : L0.p; // 下一輪由沒收牌的人開始
      };
      /* 電腦判斷要不要抓 */
      const aiWantsCall = (p) => {
        if (!last || last.p === p || last.flag) return false;
        const mine = p.cards.filter((c) => c.r === last.rank).length;
        if (mine + last.count > 4) return true;
        let pr = [0.12, 0.18, 0.22][t.diff] + 0.12 * (last.count - 1) + 0.1 * mine + (mine + last.count === 4 ? 0.2 : 0);
        if (!last.p.cards.length) pr = t.diff === 2 ? 1 : 0.8;
        return Math.random() < pr;
      };
      const aiPlay = async (p) => {
        let rank = claim;
        if (!rank) { const cnt = {}; p.cards.forEach((c) => (cnt[c.r] = (cnt[c.r] || 0) + 1)); rank = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
        const have = p.cards.filter((c) => c.r === rank).slice(0, 4);
        let cards = have.slice();
        const others = p.cards.filter((c) => c.r !== rank);
        if (!cards.length) cards = PK.shuffle(others.slice()).slice(0, Math.random() < 0.3 && others.length > 1 ? 2 : 1);
        else if (cards.length < 4 && others.length && Math.random() < [0.1, 0.22, 0.3][t.diff]) cards.push(PK.pick(others));
        if (t.isParty && cards.some((c) => c.r !== rank) && p.sk.flag && Math.random() < 0.4) { S.spend(p, 'flag'); p.flagArmed = true; }
        await play(p, cards, rank);
        if (Math.random() < 0.25) t.say(p, PK.pick(['真的啦～', '相信我', '嘿嘿', '這次是實話']));
      };
      const humanTurn = (me) => new Promise((resolve) => {
        t.actor = me;
        const local = me === t.me;
        const sel = new Set(); let rank = claim;
        const canCall = !!(last && last.p !== me && !last.flag);
        const box = el('div', { class: 'bf-ctrl' });
        let pick = null;
        const render = () => {
          show(me, sel, (c) => { if (sel.has(c)) sel.delete(c); else if (sel.size < 4) sel.add(c); else PK.toast('最多出 4 張'); PK.sfx('click'); render(); });
          const ranks = claim ? null : el('div', { class: 'bf-ranks' }, RW.slice(1).map((w, i) => el('button', { class: 'rk' + (rank === i + 1 ? ' on' : ''), onclick: () => { rank = i + 1; render(); } }, w)));
          box.replaceChildren(
            el('div', { class: 'bet-title' }, claim ? `這一輪要喊「${RW[claim]}」，選 1～4 張牌蓋著出（可以吹牛）` : '你開新的一輪：先選要喊的點數，再選 1～4 張牌'),
            ranks || '',
            el('div', { class: 'bf-btns' },
              el('button', { class: 'btn primary big', disabled: !(sel.size && rank) || null, onclick: () => pick && pick({ act: 'play', cards: [...sel], rank }) }, sel.size && rank ? `出 ${sel.size} 張，喊「${RW[rank]}」` : '出牌'),
              canCall ? el('button', { class: 'btn big call-btn', onclick: () => pick && pick({ act: 'call' }) }, '🏴‍☠️ 抓！') : null));
        };
        const go = async () => {
          const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 35, skills: S, buttons: [box], bind: (pk) => { pick = pk; render(); }, cleanup: () => show(me) });
          if (r.type === 'closed') return resolve(null);
          if (r.type === 'skill') {
            const k = r.key;
            if (k === 'lens') { if (!last || last.p === me) { if (local) PK.toast('現在沒有可以偷看的牌'); return go(); } S.spend(me, k); const c = PK.pick(last.cards); PK.fx.peek(pileEl); if (local) await PK.modal('測謊鏡', el('div', { class: 'peek-show' }, el('div', null, `🔍 ${last.p.name} 打出的其中一張是`), PK.cardEl(c, true)), [{ text: '知道了', value: 1, cls: 'primary' }]); }
            if (k === 'cannon') { S.spend(me, k); me.cannon = true; PK.fx.burst(me.seatEl, '💣', 8, { g: 0, speed: 3 }); }
            if (k === 'flag') { S.spend(me, k); me.flagArmed = true; PK.fx.burst(me.seatEl, '☠️', 8, { g: 0, speed: 3 }); }
            if (k === 'hide') {
              if (me.cards.length <= 1) { if (local) PK.toast('最後一張不能藏'); return go(); }
              const r2 = await kit.ask(t, { ctrl: L.ctrl, title: '🏝️ 點一張要藏起來（丟掉）的牌', secs: 20, timer: L.timer, bind: (pk) => show(me, null, pk), cleanup: () => show(me) });
              const c = r2.type === 'pick' ? r2.value : me.cards[0];
              S.spend(me, k); sel.delete(c); me.cards.splice(me.cards.indexOf(c), 1); PK.fx.burst(me.seatEl, ['🏝️', '💰'], 10);
            }
            return go();
          }
          if (r.type === 'timeout') { const c = me.cards.find((x) => x.r === (rank || me.cards[0].r)) || me.cards[0]; return resolve({ act: 'play', cards: [c], rank: rank || c.r }); }
          resolve(r.value);
        };
        go();
      });

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        const deck = PK.makeDeck();
        ps.forEach((p) => { p.cards = []; p.cannon = p.flagArmed = false; p.boxEl.classList.remove('winner'); });
        deck.forEach((c, i) => ps[i % n].cards.push(c));
        pile = []; last = null; claim = null; ps.forEach((p) => show(p)); drawPile(); revealEl.replaceChildren();
        let cur = PK.randInt(0, n - 1), winner = null;
        while (t.alive && !winner) {
          const p = ps[cur];
          kit.active(ps, p); info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
          let act;
          if (!p.isAI) act = await humanTurn(p);
          else { await t.wait(PK.randInt(700, 1200)); act = aiWantsCall(p) ? { act: 'call' } : { act: 'play' }; }
          if (!act) return;
          if (act.act === 'call') {
            const starter = await call(p);
            if (!starter.cards.length) { winner = starter; break; }
            cur = ps.indexOf(starter);
            continue;
          }
          /* 上一家已經出完牌，這家選擇不抓 → 上一家獲勝 */
          if (last && !last.p.cards.length) { winner = last.p; break; }
          if (!p.isAI) await play(p, act.cards, act.rank); else await aiPlay(p);
          if (!p.cards.length) { PK.fx.banner('最後一手！', 'event', (p === me ? '你' : p.name) + ' 出完了，會被抓嗎？'); }
          cur = (cur + 1) % n;
        }
        if (!t.alive) return;
        kit.active(ps, null);
        winner.boxEl.classList.add('winner');
        const order = [winner, ...ps.filter((x) => x !== winner).sort((a, b) => a.cards.length - b.cards.length)];
        const place = order.indexOf(me);
        if (winner.isAI) t.say(winner, '哈哈，我出完了！');
        info.textContent = winner.name + ' 獲勝！';
        await kit.settle(t, kit.rankReward(n, place), { big: place === 0, title: place === 0 ? '你贏了！' : '第 ' + (place + 1) + ' 名' });
        await PK.modal('本局排名', kit.ranking(t, order, (p) => '剩 ' + p.cards.length + ' 張'), [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
