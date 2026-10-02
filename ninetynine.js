/* 牌神擂台 — 九九（太空科幻） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { hole: ['🕳️', '黑洞', '總和直接歸零', 1], freeze: ['⏳', '時間凍結', '讓下一家停一回合', 1], radar: ['🛰️', '雷達', '看到下一家的所有手牌', 1], meteor: ['🌠', '流星雨', '所有人隨機換掉一張手牌', 1], portal: ['🛸', '傳送門', '和下一家隨機交換一張牌', 1] };
  const isSpecial = (c) => c.r === 4 || c.r === 5 || c.r === 10 || c.r === 11 || c.r === 12 || c.r === 13 || (c.r === 1 && c.s === 'S');
  /* 一張牌可以造成的結果：[{ total, label, choice }] */
  const outcomes = (c, tot) => {
    if (c.r === 1 && c.s === 'S') return [{ total: 0, label: '歸零' }];
    if (c.r === 4) return [{ total: tot, label: '迴轉', rev: true }];
    if (c.r === 5) return [{ total: tot, label: '指定', pick: true }];
    if (c.r === 11) return [{ total: tot, label: 'PASS' }];
    if (c.r === 13) return [{ total: 99, label: '變 99' }];
    if (c.r === 10) return [{ total: tot + 10, label: '+10' }, { total: Math.max(0, tot - 10), label: '-10' }].filter((o) => o.total <= 99);
    if (c.r === 12) return [{ total: tot + 20, label: '+20' }, { total: Math.max(0, tot - 20), label: '-20' }].filter((o) => o.total <= 99);
    return [{ total: tot + c.r, label: '+' + c.r }].filter((o) => o.total <= 99);
  };

  PK.IMPL.ninetynine = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      let deck, used, total, dir, cur, skip, radarOn;
      const meter = el('div', { class: 'nn-meter' }, el('div', { class: 'nn-fill' }));
      const totEl = el('div', { class: 'nn-total' }, '0');
      const lastEl = el('div', { class: 'c8-top nn-last' });
      const info = el('div', { class: 'round-info' });
      const drawEl = el('div', { class: 'deck-pile' }, [0, 1, 2].map(() => PK.cardEl(null, false)));
      const L = kit.layout(t, {
        cls: 'nn',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [drawEl, el('div', { class: 'nn-center' }, totEl, meter, info), lastEl],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const setTotal = (v) => {
        total = v; totEl.textContent = v;
        const f = PK.$('.nn-fill', meter); f.style.width = Math.min(100, (v / 99) * 100) + '%';
        meter.className = 'nn-meter' + (v >= 90 ? ' danger' : v >= 70 ? ' warn' : '');
        totEl.className = 'nn-total' + (v >= 90 ? ' danger' : '');
        totEl.animate([{ transform: 'scale(1.4)' }, { transform: 'none' }], { duration: 300 });
      };
      const show = (p) => {
        if (p === me) kit.render(me, true, { onClick: (c) => me.pick && me.pick(c), mark: (c) => me.pick && outcomes(c, total).length, markCls: 'playable' });
        else p.handEl.replaceChildren(...p.cards.map((c) => PK.cardEl(c, !!(radarOn === p), { small: true })));
        p.ptsEl.textContent = p.out ? '' : p.cards.length + ' 張';
      };
      const draw = async (p) => {
        if (!deck.length) { deck = PK.shuffle(used); used = []; t.sys('牌堆用完，重新洗牌'); }
        if (!deck.length) return;
        p.cards.push(deck.pop()); await PK.flyCard(drawEl, p.handEl, null, 200); show(p);
      };
      const nextIdx = (i) => { let j = i; do { j = (j + dir + n) % n; } while (ps[j].out); return j; };

      const play = async (p, c, o, target) => {
        p.cards.splice(p.cards.indexOf(c), 1); show(p);
        await PK.flyCard(p.handEl, lastEl, null, 250);
        lastEl.replaceChildren(PK.cardEl(c, true)); used.push(c);
        const before = total; setTotal(o.total);
        PK.voice.card(c, o.total + '');
        PK.fx.floatText(lastEl, o.label, '#3ef0ff');
        if (c.r === 13) { PK.fx.flash('#ff2a2a', 400); PK.fx.banner('99！', 'bad', '下一家危險了'); PK.sfx('boom'); }
        else if (c.r === 1 && c.s === 'S') { PK.fx.burst(totEl, ['🌀', '🕳️', '✨'], 18); PK.fx.banner('歸零！', 'event'); PK.sfx('skill'); }
        else if (o.rev) { dir = -dir; PK.fx.burst(lastEl, '🔄', 10); PK.fx.banner('迴轉！', 'event'); }
        else if (c.r === 11) { PK.fx.banner('PASS', 'event'); }
        else if (o.pick) { PK.fx.burst(target.seatEl, ['🎯', '🚀'], 12); PK.fx.banner('指定 ' + target.name, 'event'); }
        else PK.sfx('deal');
        if (o.total < before - 5 && c.r !== 1) PK.fx.burst(totEl, '⬇️', 6);
        await draw(p);
      };
      /* 電腦選牌 */
      const aiChoose = (p) => {
        const opts = [];
        p.cards.forEach((c) => outcomes(c, total).forEach((o) => opts.push({ c, o })));
        if (!opts.length) return null;
        if (t.diff === 0) return PK.pick(opts);
        const sc = ({ c, o }) => {
          let s = 0;
          if (isSpecial(c)) s -= total < 75 ? 30 : 0;
          if (c.r === 13) s += total >= 85 ? 25 : -40;
          if (!isSpecial(c)) s += o.total < 99 ? c.r : -50;
          if (o.total <= total) s += total >= 85 ? 20 : -10;
          if (t.diff === 2 && o.total >= 92 && o.total < 99) s += 8;
          return s + Math.random() * 3;
        };
        return opts.sort((a, b) => sc(b) - sc(a))[0];
      };
      const useSkill = async (p, k) => {
        if (!S.spend(p, k)) return;
        const nx = ps[nextIdx(ps.indexOf(p))];
        if (k === 'hole') { setTotal(0); PK.fx.burst(totEl, ['🕳️', '🌀', '⭐'], 24); PK.fx.flash('#3a0066', 400); }
        if (k === 'freeze') { skip = true; PK.fx.burst(nx.seatEl, ['⏳', '❄️'], 14); }
        if (k === 'radar') { if (p === me) { radarOn = nx; show(nx); } PK.fx.peek(nx.handEl); }
        if (k === 'meteor') { PK.fx.burst(L.wrap, ['🌠', '☄️', '✨'], 26); for (const q of ps.filter((x) => !x.out && x.cards.length)) { used.push(q.cards.splice(PK.randInt(0, q.cards.length - 1), 1)[0]); show(q); await draw(q); } }
        if (k === 'portal' && p.cards.length && nx.cards.length) {
          const a = p.cards.splice(PK.randInt(0, p.cards.length - 1), 1)[0], b = nx.cards.splice(PK.randInt(0, nx.cards.length - 1), 1)[0];
          p.cards.push(b); nx.cards.push(a); PK.fx.burst(p.seatEl, '🛸', 8); PK.fx.burst(nx.seatEl, '🛸', 8); show(p); show(nx);
        }
      };

      const humanTurn = async (me) => {
        t.actor = me;
        while (true) {
          const can = me.cards.some((c) => outcomes(c, total).length);
          if (!can) return 'dead';
          const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 25, skills: S, title: '點一張發亮的牌出牌（總和不能超過 99）',
            bind: (pick) => { me.pick = (c) => outcomes(c, total).length ? pick(c) : PK.toast('出這張會超過 99！'); show(me); }, cleanup: () => { me.pick = null; show(me); } });
          if (r.type === 'closed') return;
          if (r.type === 'skill') { await useSkill(me, r.key); continue; }
          let c = r.value;
          if (r.type === 'timeout') c = me.cards.find((x) => outcomes(x, total).length);
          const os = outcomes(c, total);
          let o = os[0], target = null;
          if (os.length > 1) o = os[await kit.choose(t, L.ctrl, '要加還是減？', os.map((x, i) => ({ text: x.label + ' → ' + x.total, value: i, cls: 'big' })))];
          if (o.pick) {
            const cand = ps.filter((x) => !x.out && x !== me);
            const id = await kit.choose(t, L.ctrl, '指定下一位出牌的人', cand.map((x) => ({ text: x.avatar + ' ' + x.name, value: ps.indexOf(x) })));
            target = ps[id];
          }
          await play(me, c, o, target);
          return target ? { target } : 'ok';
        }
      };

      let game = 0;
      while (t.alive) {
        game++;
        if (t.isParty && game > 1) S.refill();
        deck = PK.makeDeck(); used = []; dir = 1; skip = false; radarOn = null;
        ps.forEach((p) => { p.cards = []; p.out = false; p.boxEl.classList.remove('winner', 'loser'); kit.setTag(p, ''); });
        setTotal(0); lastEl.replaceChildren(); info.textContent = '發牌中';
        for (let i = 0; i < 5; i++) ps.forEach((p) => p.cards.push(deck.pop()));
        ps.forEach(show); PK.sfx('deal');
        cur = PK.randInt(0, n - 1); t.sys(ps[cur].name + ' 先出牌');
        let loser = null;
        while (t.alive && !loser) {
          const p = ps[cur];
          kit.active(ps, p); info.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
          let target = null, dead = false;
          if (!p.isAI) {
            const r = await humanTurn(p);
            if (r === 'dead') dead = true; else if (r && r.target) target = r.target;
          } else {
            await t.wait(PK.randInt(400, 750));
            if (t.isParty && total >= 80 && Math.random() < 0.5) { if (p.sk.hole) await useSkill(p, 'hole'); else if (p.sk.freeze) await useSkill(p, 'freeze'); }
            const ch = aiChoose(p);
            if (!ch) dead = true;
            else {
              if (ch.o.pick) { const cand = ps.filter((x) => !x.out && x !== p); const hum = cand.find((x) => !x.isAI); target = t.diff === 2 && hum ? hum : PK.pick(cand); }
              kit.say(t, p, 'think', 0.2);
              await play(p, ch.c, ch.o, target);
            }
          }
          if (radarOn && p === me) { const r = radarOn; radarOn = null; show(r); }
          if (dead) {
            loser = p; p.boxEl.classList.add('loser');
            PK.sfx('boom'); PK.fx.burst(p.seatEl, ['💥', '🚀', '🔥'], 24); PK.fx.shake(L.wrap, 12); PK.fx.flash('#ff3030', 400);
            PK.fx.banner('爆炸！', 'bad', p.name + ' 出什麼牌都會超過 99');
            p.handEl.replaceChildren(...p.cards.map((c) => PK.cardEl(c, true, { small: p !== me })));
            break;
          }
          if (target) cur = ps.indexOf(target);
          else { cur = nextIdx(cur); if (skip) { skip = false; PK.fx.floatText(ps[cur].seatEl, '⏳ 停一回合', '#3ef0ff'); cur = nextIdx(cur); } }
        }
        kit.active(ps, null);
        ps.filter((p) => p !== loser).forEach((p) => { p.boxEl.classList.add('winner'); if (p !== me) kit.say(t, p, 'win', 0.4); });
        info.textContent = loser.name + ' 爆掉了！';
        const d = loser === me ? -100 : 100;
        await t.wait(1200);
        await kit.settle(t, d, { title: loser === me ? '你爆掉了！' : '你活下來了！' });
        await kit.next(t, L.ctrl, '再來一局');
      }
    },
  };
})();
