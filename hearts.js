/* 牌神擂台 — 傷心小棧（情人節粉嫩） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit, TK = PK.trick;
  const SKILLS = { cupid: ['💘', '邱比特之箭', '把你吃到的一張紅心射給指定對手', 1], bandage: ['🩹', 'OK 繃', '你下一次吃到的墩不算分', 1], letter: ['💌', '情書交換', '用一張手牌和一位對手隨機交換', 1], choc: ['🍫', '巧克力', '這局你吃到黑桃 Q 只算 5 分', 1], moon: ['🌙', '射月預告', '這局射月成功時，對手各加 52 分', 1] };
  const isQS = (c) => c.s === 'S' && c.r === 12;
  const is2C = (c) => c.s === 'C' && c.r === 2;
  const DIRS = [['左邊', 1], ['右邊', 3], ['對面', 2], ['不傳牌', 0]];

  PK.IMPL.hearts = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me;
      const L = kit.compass(t, ps, { cls: 'hz' });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      let broken, firstTrick, hand = 0;
      ps.forEach((p) => (p.total = 0));
      const pts = (p, c) => (c.s === 'H' ? 1 : isQS(c) ? (p.choc ? 5 : 13) : 0);
      const show = (p, sel, onClick, mark) => {
        if (p === me) {
          me.handEl.replaceChildren(...TK.sortHand(me.cards.slice()).map((c) => { const e = PK.cardEl(c, true); if (sel && sel.has(c)) e.classList.add('selected'); if (mark && mark(c)) e.classList.add('playable'); if (onClick) { e.classList.add('pickable'); e.addEventListener('click', () => onClick(c)); } return e; }));
        } else kit.backs(p);
        p.ptsEl.textContent = '本局 ' + p.got + '・總 ' + p.total;
      };
      const legal = (p, led) => {
        let h = p.cards;
        if (!led) {
          if (firstTrick) return h.filter(is2C);
          const nh = h.filter((c) => c.s !== 'H'); return broken || !nh.length ? h : nh;
        }
        const f = h.filter((c) => c.s === led); if (f.length) return f;
        if (firstTrick) { const safe = h.filter((c) => c.s !== 'H' && !isQS(c)); if (safe.length) return safe; }
        return h;
      };
      const aiCard = (p, plays) => {
        const opts = legal(p, plays[0] && plays[0].c.s);
        if (t.diff === 0) return PK.pick(opts);
        const led = plays[0] && plays[0].c.s;
        const rv = TK.rv;
        if (!led) {
          const hasQ = p.cards.some(isQS);
          const cnt = (s) => p.cards.filter((c) => c.s === s).length;
          const sc = (c) => rv(c) + (isQS(c) ? 60 : 0) + (c.s === 'S' && hasQ ? 12 : 0) + (c.s === 'S' && !hasQ && rv(c) < 12 && t.diff === 2 ? -4 : 0) + (t.diff === 2 ? cnt(c.s) : 0) + (c.s === 'H' ? 3 : 0);
          return opts.sort((a, b) => sc(a) - sc(b))[0];
        }
        if (opts[0].s === led) {
          const win = plays[TK.winner(plays)].c;
          const trickPts = plays.reduce((a, x) => a + (x.c.s === 'H' ? 1 : isQS(x.c) ? 13 : 0), 0);
          const under = opts.filter((c) => rv(c) < rv(win));
          if (led === 'S' && opts.some(isQS) && rv(win) > 12) return opts.find(isQS);
          if (under.length) return under.sort((a, b) => rv(b) - rv(a))[0];
          if (plays.length === 3 && trickPts === 0) { const nq = opts.filter((c) => !isQS(c)); return (nq.length ? nq : opts).sort((a, b) => rv(b) - rv(a))[0]; }
          const nq = opts.filter((c) => !isQS(c));
          return (nq.length ? nq : opts).sort((a, b) => (t.diff === 2 ? rv(b) - rv(a) : rv(a) - rv(b)))[0];
        }
        const q = opts.find(isQS); if (q) return q;
        const hs = opts.filter((c) => c.s === 'H'); if (hs.length) return hs.sort((a, b) => rv(b) - rv(a))[0];
        return opts.sort((a, b) => rv(b) - rv(a))[0];
      };
      const aiPass = (p) => p.cards.slice().sort((a, b) => {
        const sc = (c) => (isQS(c) ? 100 : 0) + (c.s === 'S' && TK.rv(c) > 12 && p.cards.filter((x) => x.s === 'S').length < 4 ? 60 : 0) + TK.rv(c) * (c.s === 'H' ? 2 : 1);
        return sc(b) - sc(a);
      }).slice(0, 3);
      const useSkill = async (p, k) => {
        const local = p === me, opp = ps.filter((q) => q !== p).map((q) => ({ text: q.avatar + ' ' + q.name, value: ps.indexOf(q) }));
        if (k === 'cupid') {
          const h = p.taken.find((c) => c.s === 'H'); if (!h) { if (local) PK.toast('你還沒有吃到紅心'); return; }
          const v = ps[await kit.choose(t, L.ctrl, '把紅心射給誰？', opp, { who: p })];
          S.spend(p, k); p.taken.splice(p.taken.indexOf(h), 1); v.taken.push(h); p.got--; v.got++;
          PK.fx.throwEmoji(p.seatEl, v.seatEl, '💘'); show(p); show(v); if (v.isAI) t.say(v, '誰射我？！');
        }
        if (k === 'bandage') { S.spend(p, k); p.bandage = true; PK.fx.burst(p.seatEl, '🩹', 8, { g: 0, speed: 3 }); }
        if (k === 'choc') { S.spend(p, k); p.choc = true; PK.fx.burst(p.seatEl, '🍫', 8, { g: 0, speed: 3 }); }
        if (k === 'moon') { S.spend(p, k); p.moonBonus = true; PK.fx.burst(p.seatEl, '🌙', 8, { g: 0, speed: 3 }); }
        if (k === 'letter') {
          const v = ps[await kit.choose(t, L.ctrl, '和誰交換？', opp, { who: p })];
          const r = await kit.ask(t, { who: p, ctrl: L.ctrl, title: '💌 點一張要送出去的牌', secs: 20, timer: L.timer, bind: (pick) => show(me, null, pick), cleanup: () => show(me) });
          const c = r.type === 'pick' ? r.value : p.cards[0];
          S.spend(p, k);
          const d = v.cards.splice(PK.randInt(0, v.cards.length - 1), 1)[0];
          p.cards.splice(p.cards.indexOf(c), 1); p.cards.push(d); v.cards.push(c);
          PK.fx.throwEmoji(p.seatEl, v.seatEl, '💌'); show(p); show(v); if (local) PK.voice.say('換到' + PK.cardSpeech(d));
        }
      };
      /* 傳牌：每位真人各自選 3 張（同時進行） */
      const humanPass = async (h, dn) => {
        const sel = new Set(); let pick = null; const box = el('div', { class: 'bf-ctrl' });
        const render = () => { show(me, sel, (c) => { if (sel.has(c)) sel.delete(c); else if (sel.size < 3) sel.add(c); render(); }); box.replaceChildren(el('div', { class: 'bet-title' }, '選 3 張牌傳給' + dn + '（' + sel.size + '/3）'), el('button', { class: 'btn primary big', disabled: sel.size !== 3 || null, onclick: () => pick && pick([...sel]) }, '傳牌')); };
        const r = await kit.ask(t, { who: h, ctrl: L.ctrl, timer: L.timer, secs: 40, buttons: [box], bind: (pk) => { pick = pk; render(); }, cleanup: () => show(me) });
        return r.type === 'pick' ? r.value : aiPass(h);
      };
      while (t.alive) {
        hand++;
        if (t.isParty && hand > 1) S.refill();
        const deck = PK.makeDeck();
        ps.forEach((p, i) => { p.cards = deck.slice(i * 13, i * 13 + 13); p.taken = []; p.got = 0; p.bandage = p.choc = p.moonBonus = false; p.boxEl.classList.remove('winner'); kit.setTag(p, ''); show(p); });
        broken = false; firstTrick = true; kit.clearSlots(L);
        /* 傳牌 */
        const [dn, off] = DIRS[(hand - 1) % 4];
        if (off) {
          L.info.textContent = '選 3 張牌傳給' + dn;
          const hum = await Promise.all(ps.filter((p) => !p.isAI).map((h) => humanPass(h, dn)));
          if (!t.alive) return;
          let hi = 0;
          const gifts = ps.map((p) => (p.isAI ? aiPass(p) : hum[hi++]));
          ps.forEach((p, i) => gifts[i].forEach((c) => p.cards.splice(p.cards.indexOf(c), 1)));
          ps.forEach((p, i) => ps[(i + off) % 4].cards.push(...gifts[i]));
          PK.fx.burst(L.center, ['💌', '💕'], 14); PK.sfx('deal');
          const got = gifts[(ps.indexOf(me) + 4 - off) % 4];
          ps.forEach((p) => show(p));
          PK.voice.say('收到' + got.map(PK.cardSpeech).join('、'));
          const sortedMe = TK.sortHand(me.cards.slice());
          me.handEl.querySelectorAll('.card').forEach((e, i) => { if (got.includes(sortedMe[i])) e.classList.add('selected'); });
          await t.wait(1600); show(me);
        }
        let lead = ps.findIndex((p) => p.cards.some(is2C));
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
                const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 30, skills: S, title: plays.length ? '要跟出' + PK.SUIT_NAME[plays[0].c.s] + '（沒有才能出別的）' : '點一張牌開始這一墩',
                  bind: (pick) => show(me, null, (x) => (opts.includes(x) ? pick(x) : PK.toast('這張現在不能出')), (x) => opts.includes(x)), cleanup: () => show(me) });
                if (r.type === 'closed') return;
                if (r.type === 'skill') { await useSkill(p, r.key); continue; }
                c = r.type === 'timeout' ? aiCard(p, plays) : r.value; break;
              }
            } else { await t.wait(PK.randInt(450, 800)); c = aiCard(p, plays); }
            p.cards.splice(p.cards.indexOf(c), 1); show(p);
            await kit.toSlot(L, p, (lead + k) % 4, c);
            plays.push({ p, c }); PK.voice.card(c, '', 2);
            if (c.s === 'H' && !broken) { broken = true; PK.fx.burst(L.center, ['💔', '💗'], 14); PK.fx.banner('紅心破了！', 'event'); }
            if (isQS(c)) { PK.fx.flash('#000', 300); PK.fx.burst(L.center, ['♠️', '👸', '💀'], 14); }
          }
          const wi = TK.winner(plays), w = plays[wi].p;
          let tp = plays.reduce((a, x) => a + pts(w, x.c), 0);
          if (w.bandage && tp) { w.bandage = false; PK.fx.burst(w.seatEl, '🩹', 10); PK.fx.floatText(w.seatEl, 'OK 繃！0 分', '#7b5cff'); tp = 0; }
          else { w.taken.push(...plays.map((x) => x.c)); w.got += tp; }
          if (plays.some((x) => isQS(x.c)) && tp >= 5) { PK.fx.burst(w.seatEl, ['💔', '💔', '😭'], 18); PK.fx.banner('黑桃 Q！', 'bad', (w === me ? '你' : w.name) + ' 吃到 ' + (w.choc ? 5 : 13) + ' 分'); if (w.isAI) t.say(w, '我的心碎了 💔'); }
          else if (tp) PK.fx.floatText(w.seatEl, '+' + tp + ' 分', '#ff4d6d');
          await kit.collectTrick(t, L, w);
          show(w);
          firstTrick = false; lead = ps.indexOf(w);
        }
        if (!t.alive) return;
        kit.active(ps, null);
        /* 射月 */
        const moon = ps.find((p) => p.taken.filter((c) => c.s === 'H').length === 13 && p.taken.some(isQS));
        if (moon) { const v = moon.moonBonus ? 52 : 26; ps.forEach((p) => (p.got = p === moon ? 0 : v)); if (moon === me) PK.ch.emit('moon'); PK.fx.fireworks(6); PK.fx.banner('射月成功！', 'gold', (moon === me ? '你' : moon.name) + ' 吃下全部，其他人各 +' + v); await t.wait(1500); }
        ps.forEach((p) => { p.total += p.got; show(p); });
        const order = ps.slice().sort((a, b) => a.got - b.got);
        order[0].boxEl.classList.add('winner');
        const place = order.indexOf(me);
        L.info.textContent = '第 ' + hand + ' 局結束';
        await kit.settle(t, kit.rankReward(4, place), { big: place === 0, title: place === 0 ? '吃到最少分！' : '第 ' + (place + 1) + ' 名・吃到 ' + me.got + ' 分' });
        const over = ps.some((p) => p.total >= 100);
        await PK.modal(over ? '有人超過 100 分，整場結束！' : '本局結果', kit.ranking(t, over ? ps.slice().sort((a, b) => a.total - b.total) : order, (p) => '本局 ' + p.got + ' 分・總 ' + p.total + ' 分'), [{ text: '好', value: 1, cls: 'primary' }]);
        if (over) ps.forEach((p) => (p.total = 0));
        await kit.next(t, L.ctrl, '下一局');
      }
    },
  };
})();
