/* 牌神擂台 — 抽鬼牌（萬聖幽靈） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { eye: ['👀', '幽靈之眼', '看出鬼牌在誰手上、在哪個位置', 1], peek: ['🔍', '偷看', '先翻開下一家的一張牌看看', 2], candle: ['🕯️', '驅魔蠟燭', '這次抽到鬼牌時放回去重抽', 1], bat: ['🦇', '蝙蝠換位', '把手上的鬼牌丟給隨機一位對手', 1] };
  const isJ = (c) => !!c.joker;

  PK.IMPL.oldmaid = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      let done, pairs, eyeOn, zoneOwner = null;
      const zone = el('div', { class: 'om-zone' });
      const pileEl = el('div', { class: 'om-pile' }, '🗑️ 已配對 ', el('b', null, '0'), ' 對');
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'om',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'mid-info' }, info, pileEl), zone],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const show = (p, opt) => {
        opt = opt || {};
        if (p === me) kit.render(me, true, { sort: kit.byRank });
        else {
          const big = !!opt.pick || opt.reveal != null;
          p.handEl.replaceChildren(...p.cards.map((c, i) => {
            const e = PK.cardEl(c, false, { small: true });
            if (eyeOn && isJ(c)) e.classList.add('ghost-glow');
            if (big) e.classList.add('om-dim');
            return e;
          }));
          if (big) {
            zoneOwner = p;
            zone.replaceChildren(el('div', { class: 'om-zone-t' }, opt.pick ? '👇 點一張 ' + p.name + ' 的牌' : '🔍 ' + p.name + ' 的牌'),
              el('div', { class: 'om-zone-cards' }, p.cards.map((c, i) => {
                const e = PK.cardEl(c, opt.reveal === i);
                if (eyeOn && isJ(c)) e.classList.add('ghost-glow');
                if (opt.pick) { e.classList.add('pickable'); e.addEventListener('click', () => opt.pick(i)); }
                return e;
              })));
            zone.classList.add('on');
          } else if (zoneOwner === p) { zoneOwner = null; zone.replaceChildren(); zone.classList.remove('on'); }
        }
        p.ptsEl.textContent = p.cards.length ? p.cards.length + ' 張' : '';
      };
      const removePairs = (p) => {
        const byR = {}; let k = 0;
        p.cards.forEach((c) => { if (!isJ(c)) (byR[c.r] = byR[c.r] || []).push(c); });
        for (const r in byR) while (byR[r].length >= 2) { const [a, b] = byR[r].splice(0, 2); p.cards.splice(p.cards.indexOf(a), 1); p.cards.splice(p.cards.indexOf(b), 1); k++; }
        pairs += k; PK.$('b', pileEl).textContent = pairs; return k;
      };
      const active = () => ps.filter((p) => !done.includes(p));
      const nextOf = (p) => { let i = ps.indexOf(p); do { i = (i + 1) % n; } while (done.includes(ps[i]) && ps[i] !== p); return ps[i]; };

      /* 抽一張 */
      const take = async (p, from, idx) => {
        let c = from.cards[idx];
        if (isJ(c) && p.candle) {
          p.candle = false; PK.fx.burst(p.seatEl, ['🕯️', '✨'], 12); PK.fx.banner('驅魔蠟燭！', 'event', '鬼牌被趕回去了');
          await t.wait(700);
          const others = from.cards.map((x, i) => i).filter((i) => i !== idx);
          if (others.length) { idx = PK.pick(others); c = from.cards[idx]; }
        }
        from.cards.splice(idx, 1);
        await PK.flyCard(from.handEl, p.handEl, null, 300);
        p.cards.push(c);
        if (p === me && !isJ(c)) PK.voice.card(c);
        if (isJ(c)) {
          if (p === me) { PK.fx.flash('#6a00ff', 500); PK.fx.burst(me.handEl, ['👻', '💀', '🎃'], 20); PK.fx.banner('抽到鬼牌！', 'bad', '快想辦法送出去'); PK.sfx('lose'); }
          else if (p.isAI && PK.nrand() < 0.5) t.say(p, PK.cpick(['😱', '呃…', '沒事沒事', '嘿嘿']));
          if (from === me) { PK.fx.burst(from.seatEl, ['😌', '✨'], 8); PK.toast(p.name + ' 抽走了你的鬼牌！'); }
        }
        const k = removePairs(p);
        if (k) { if (p === me) PK.voice.say('配對！'); PK.fx.sparkle(p.handEl, '#8affc1', 20); PK.fx.floatText(p.seatEl, '配對 ×' + k, '#8affc1'); PK.sfx('chip'); }
        show(p); show(from);
        for (const q of [from, p]) if (!q.cards.length && !done.includes(q)) {
          done.push(q); q.boxEl.classList.add('winner'); kit.setTag(q, '過關', 'top');
          if (q === me) { PK.fx.fireworks(3); PK.fx.banner('安全過關！', 'good'); } else if (q.isAI) t.say(q, '我過關啦～'); else PK.fx.floatText(q.seatEl, '過關！', '#8affc1');
        }
      };
      const useSkill = async (me, k, from) => {
        if (!S.spend(me, k)) return;
        const local = me === t.me;
        if (k === 'eye' && !local) return;
        if (k === 'eye') { eyeOn = 3 * active().length; t.sys('👀 幽靈之眼持續 3 輪'); const h = ps.find((p) => p.cards.some(isJ)); PK.fx.peek(h.seatEl); t.sys(h === me ? '鬼牌在你自己手上！' : '鬼牌在 ' + h.name + ' 手上'); PK.fx.banner('鬼牌在 ' + (h === me ? '你手上' : h.name + ' 那裡'), 'event'); show(from); }
        if (k === 'candle') { me.candle = true; PK.fx.burst(me.seatEl, '🕯️', 8, { g: 0, speed: 3 }); }
        if (k === 'bat') {
          const j = me.cards.find(isJ);
          if (!j) { me.sk.bat++; if (local) { S.render(true); PK.toast('你手上沒有鬼牌'); } return; }
          const v = PK.pick(active().filter((p) => p !== me));
          me.cards.splice(me.cards.indexOf(j), 1); v.cards.splice(PK.randInt(0, v.cards.length), 0, j);
          await PK.flyCard(me.handEl, v.handEl, null, 350); PK.fx.burst(v.seatEl, ['🦇', '👻'], 14); show(me); show(v);
          if (v.isAI) t.say(v, '誰丟鬼牌給我？！'); if (v === t.me) PK.fx.banner('鬼牌飛過來了！', 'bad');
        }
        if (k === 'peek') {
          const r = await kit.ask(t, { who: me, ctrl: L.ctrl, title: '🔍 點一張要偷看的牌', secs: 15, timer: L.timer, bind: (pick) => show(from, { pick }), cleanup: () => show(from) });
          const i = r.type === 'pick' ? r.value : 0;
          PK.fx.peek(from.handEl);
          if (local) { show(from, { reveal: i }); await t.wait(1600); show(from); }
          return i;
        }
      };

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        const deck = PK.makeDeck(); deck.push(PK.regCard({ r: 0, s: 'J', id: 'JK' + PK.deckGen, joker: 'big' })); PK.shuffle(deck);
        done = []; pairs = 0; eyeOn = false;
        ps.forEach((p) => { p.cards = []; p.candle = false; p.boxEl.classList.remove('winner', 'loser'); kit.setTag(p, ''); });
        deck.forEach((c, i) => ps[i % n].cards.push(c));
        info.textContent = '先把手上的對子丟掉';
        ps.forEach((p) => { removePairs(p); show(p); });
        PK.fx.burst(pileEl, '🃏', 10); await t.wait(800);
        let cur = ps[PK.randInt(0, n - 1)];
        while (t.alive && active().length > 1) {
          if (done.includes(cur)) { cur = nextOf(cur); continue; }
          const from = nextOf(cur);
          if (from === cur) break;
          kit.active(ps, cur);
          if (eyeOn) { eyeOn--; if (!eyeOn) { ps.forEach((q) => q !== me && show(q)); t.sys('👀 幽靈之眼的效果結束了'); } }
          info.textContent = cur === me ? '從 ' + from.name + ' 手中抽一張牌' : cur.name + ' 正在抽 ' + (from === me ? '你' : from.name) + ' 的牌';
          if (!cur.isAI) {
            t.actor = cur;
            let idx = null;
            while (idx == null) {
              const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 25, skills: S, title: '點 ' + from.name + ' 的一張牌抽走',
                bind: (pick) => show(from, { pick }), cleanup: () => show(from) });
              if (r.type === 'closed') return;
              if (r.type === 'skill') { await useSkill(cur, r.key, from); continue; }
              idx = r.type === 'timeout' ? PK.randInt(0, from.cards.length - 1) : r.value;
            }
            await take(cur, from, idx);
          } else {
            from.boxEl.classList.add('being-drawn');
            await t.wait(PK.randInt(700, 1200));
            if (t.isParty && cur.cards.some(isJ) && cur.sk.bat && Math.random() < 0.3) {
              cur.sk.bat--; PK.sfx('skill'); t.say(cur, '使出「蝙蝠換位」！');
              const j = cur.cards.find(isJ), v = PK.pick(active().filter((p) => p !== cur));
              cur.cards.splice(cur.cards.indexOf(j), 1); v.cards.splice(PK.randInt(0, v.cards.length), 0, j);
              await PK.flyCard(cur.handEl, v.handEl, null, 350); PK.fx.burst(v.seatEl, ['🦇', '👻'], 14); show(cur); show(v);
              if (v === me) PK.fx.banner('鬼牌飛過來了！', 'bad');
            }
            from.boxEl.classList.remove('being-drawn');
            await take(cur, from, PK.randInt(0, from.cards.length - 1));
          }
          await t.wait(350);
          cur = nextOf(cur);
        }
        kit.active(ps, null);
        const loser = active()[0];
        loser.boxEl.classList.add('loser'); kit.setTag(loser, '鬼牌', 'bust');
        PK.fx.burst(loser.seatEl, ['👻', '💀', '🎃', '🦇'], 26); PK.fx.flash('#6a00ff', 500); PK.sfx('lose');
        PK.fx.banner(loser === me ? '你拿到最後的鬼牌！' : loser.name + ' 拿到鬼牌！', loser === me ? 'bad' : 'good');
        if (loser.isAI) t.say(loser, PK.cpick(['不～～', '怎麼又是我 😭', '下次換你們！']));
        const order = [...done, loser];
        info.textContent = loser.name + ' 輸了！';
        await t.wait(1400);
        const place = order.indexOf(me);
        await kit.settle(t, kit.rankReward(n, place), { title: place === n - 1 ? '被鬼抓到了' : '第 ' + (place + 1) + ' 名過關' });
        await PK.modal('本局排名', kit.ranking(t, order, (p) => (p === loser ? '👻 鬼牌' : '過關')), [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
