/* 牌神擂台 — 心臟病（漫畫爆炸） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { slow: ['🐢', '減速', '接下來 6 張翻牌速度變慢', 1], iron: ['🛡️', '鐵掌', '下一次最慢拍也不用收牌', 1], foresee: ['🎯', '預知', '接下來 5 張，會中的牌提前警告', 1], chaos: ['🌀', '混亂', '對手接下來 3 次拍桌變慢', 1], auto: ['💨', '閃電手', '下一次中牌自動搶第一拍', 1] };
  const REACT = [[700, 1300], [450, 900], [300, 650]];
  const SPEED = [1150, 950, 780];

  PK.IMPL.slap = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, n = ps.length;
      const humans = ps.filter((p) => !p.isAI);
      let pile = [], count = 1, G = {}, win = null, pendingSk = [];
      const callEl = el('div', { class: 'sl-call' }, '1');
      const centerEl = el('div', { class: 'sl-center' });
      const pileCnt = el('div', { class: 'sl-cnt' });
      const hand = el('button', { class: 'sl-hand', 'aria-label': '拍桌' }, '🖐️', el('span', null, '拍！'));
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'sl',
        others: t.others.map((p) => kit.box(t, p)),
        mid: [el('div', { class: 'sl-mid' }, el('div', { class: 'sl-callbox' }, el('div', { class: 'sl-call-t' }, '喊'), callEl), el('div', { class: 'sl-stack' }, centerEl, pileCnt), hand), info],
        me: kit.box(t, me, { cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const show = (p) => {
        p.handEl.replaceChildren(p.cards.length ? PK.cardEl(null, false, { small: p !== me }) : el('span', { class: 'muted' }, '沒牌了'));
        p.ptsEl.textContent = p.cards.length + ' 張';
      };
      const showPile = () => { centerEl.replaceChildren(...pile.slice(-3).map((c, i, a) => { const e = PK.cardEl(c, true); e.style.transform = `rotate(${(c.r * 37 % 30) - 15}deg)`; if (i === a.length - 1) e.classList.add('pop-in'); return e; })); pileCnt.textContent = pile.length ? pile.length + ' 張' : ''; };
      /* 技能隨時可以按，會在下一次翻牌時一起生效（連線時大家同步） */
      const onSkill = (k) => {
        const used = pendingSk.filter((x) => x === k).length;
        if (me.sk[k] - used <= 0) return;
        pendingSk.push(k); PK.sfx('click'); PK.fx.floatText(me.seatEl, SKILLS[k][0] + ' 準備發動', '#ffe680');
      };
      const applySkills = (h, list) => {
        for (const k of list || []) {
          if (!S.spend(h, k)) continue;
          if (k === 'slow') { G.slow = 6; PK.fx.burst(centerEl, '🐢', 10); }
          if (k === 'iron') { h.iron = true; PK.fx.burst(h.seatEl, '🛡️', 8, { g: 0, speed: 3 }); }
          if (k === 'foresee') { h.foresee = 5; if (h === me) PK.fx.peek(centerEl); }
          if (k === 'chaos') { G.chaos = 3; ps.filter((p) => p !== h).forEach((p) => { PK.fx.burst(p.seatEl, ['🌀', '💫'], 8); p.boxEl.classList.add('dizzy'); }); setTimeout(() => ps.forEach((p) => p.boxEl.classList.remove('dizzy')), 3000); }
          if (k === 'auto') { h.auto = true; PK.fx.burst(h.seatEl, '💨', 8); }
        }
      };
      const collect = async (p, why) => {
        if (!pile.length) return;
        const got = pile.length;
        PK.fx.shake(p.boxEl, 10); PK.fx.burst(p.seatEl, ['💥', '😵', '⭐'], 14);
        PK.fx.banner(why, 'bad', (p === me ? '你' : p.name) + ' 收回 ' + got + ' 張');
        await PK.flyCard(centerEl, p.handEl, null, 350);
        p.cards.unshift(...PK.shuffle(pile)); pile = []; showPile(); show(p);
        kit.say(t, p, 'bad', 0.6);
        count = 1; callEl.textContent = '1';
      };
      /* 拍桌（只記錄自己的反應時間） */
      const mySlap = () => {
        if (!t.alive) return;
        PK.sfx('splat'); hand.classList.remove('hit'); void hand.offsetWidth; hand.classList.add('hit');
        if (!win) return;
        if (win.match) { if (win.time == null) { win.time = performance.now() - win.t0; PK.fx.burst(hand, ['💥', '✋'], 8, { speed: 4 }); win.done(); } }
        else win.fs = true;
      };
      hand.addEventListener('pointerdown', (e) => { e.preventDefault(); mySlap(); });
      const key = (e) => { if (e.code === 'Space' && PK.current === t) { e.preventDefault(); mySlap(); } };
      addEventListener('keydown', key);
      /* 每翻一張牌，每位真人回報：有沒有拍、拍的時間、用了哪些技能 */
      const localWindow = (match) => new Promise((res) => {
        const w = { match, t0: performance.now(), time: null, fs: false };
        let ended = false;
        w.done = () => { if (ended) return; ended = true; win = null; res({ t: w.time, fs: w.fs, sk: pendingSk.splice(0) }); };
        win = w;
        setTimeout(w.done, match ? 2600 : SPEED[t.diff] * (G.slow ? 1.6 : 1));
      });
      const acks = (match) => Promise.all(humans.map((h) => kit.ask(t, { who: h, bind: (pick) => localWindow(match).then(pick) }).then((r) => (r.type === 'pick' ? r.value : { t: null, fs: false, sk: [] }))));

      let game = 0;
      try {
        while (t.alive) {
          game++;
          if (t.isParty && game > 1) S.refill();
          const deck = PK.makeDeck();
          ps.forEach((p) => { p.cards = []; p.iron = p.auto = false; p.foresee = 0; p.boxEl.classList.remove('winner'); kit.setTag(p, ''); });
          deck.forEach((c, i) => ps[i % n].cards.push(c));
          pile = []; count = 1; G = {}; pendingSk = []; showPile(); ps.forEach(show); callEl.textContent = '1';
          S.render(true, onSkill);
          info.textContent = '準備…'; await t.wait(600);
          for (const w of ['3', '2', '1', '開始！']) { PK.fx.banner(w, 'event'); PK.sfx('tick'); await t.wait(600); }
          let cur = PK.randInt(0, n - 1), winner = null;
          while (t.alive && !winner) {
            const p = ps[cur];
            if (!p.cards.length) { cur = (cur + 1) % n; continue; }
            kit.active(ps, p);
            info.textContent = (p === me ? '你' : p.name) + ' 翻牌';
            const c = p.cards.pop();
            const match = c.r === count;
            if (window.PK_DEBUG) console.error('EV flip ' + p.name + ' ' + c.id + ' cnt' + count);
            if (me.foresee && match) { PK.fx.flash('#ffd000', 250); PK.fx.floatText(callEl, '⚠️ 要中了！', '#ff2e2e'); await t.wait(250); }
            humans.forEach((h) => { if (h.foresee) h.foresee--; });
            await PK.flyCard(p.handEl, centerEl, null, 200);
            pile.push(c); showPile(); show(p);
            PK.voice.say(['', 'A', '二', '三', '四', '五', '六', '七', '八', '九', '十', 'J', 'Q', 'K'][count], { pri: 3, rate: 1.5, pitch: p.voicePitch || 1.1 });
            callEl.textContent = PK.RANK_TXT[count]; callEl.classList.remove('bump'); void callEl.offsetWidth; callEl.classList.add('bump');
            PK.sfx('deal');
            if (match) {
              /* 中了！大家搶拍 */
              PK.fx.flash('#fff', 200); centerEl.classList.add('match'); PK.voice.say('拍！', { pri: 3, rate: 1.5 });
              const [a, b] = REACT[t.diff];
              const aiT = new Map(ps.filter((x) => x.isAI).map((x) => [x, PK.rand(a, b) + (G.chaos ? 500 : 0)]));
              if (G.chaos) G.chaos--;
              const tms = []; for (const [x, d] of aiT) tms.push(setTimeout(() => { PK.sfx('splat'); PK.fx.burst(x.seatEl, ['✋', '💥'], 6, { speed: 4 }); x.boxEl.classList.add('slapped'); }, d));
              const res = await acks(true);
              if (window.PK_DEBUG) console.error('EV ackM ' + JSON.stringify(res));
              tms.forEach(clearTimeout); ps.forEach((x) => x.boxEl.classList.remove('slapped'));
              centerEl.classList.remove('match');
              const times = new Map(aiT);
              humans.forEach((h, i) => { applySkills(h, res[i].sk); let tt = res[i].t == null ? Infinity : res[i].t; if (h.auto) { h.auto = false; tt = 1; } times.set(h, tt); if (h !== me && tt !== Infinity) { PK.fx.burst(h.seatEl, ['✋', '💥'], 6, { speed: 4 }); } });
              const order = ps.slice().sort((x, y) => times.get(x) - times.get(y));
              let last = order[order.length - 1];
              const myT = times.get(me);
              if (myT !== Infinity && order[0] === me) { PK.fx.floatText(hand, '最快！' + Math.round(myT) + ' 毫秒', '#1e6bff'); }
              if (myT < 400) PK.ch.emit('fast');
              if (last.iron) { last.iron = false; PK.fx.banner('鐵掌護體！', 'event', last === me ? '你' : last.name); last = order[order.length - 2]; }
              await collect(last, times.get(last) === Infinity ? '沒拍到！' : '最慢！');
            } else {
              const res = await acks(false);
              if (window.PK_DEBUG) console.error('EV ack ' + JSON.stringify(res));
              humans.forEach((h, i) => applySkills(h, res[i].sk));
              if (G.slow) G.slow--;
              const wrong = humans.find((h, i) => res[i].fs);
              if (wrong && pile.length) { PK.sfx('splat'); await collect(wrong, '拍錯了！'); }
              else {
                const ai = ps.filter((x) => x.isAI).find(() => Math.random() < [0.03, 0.015, 0][t.diff]);
                if (ai && pile.length && Math.abs(c.r - count) <= 1) { PK.sfx('splat'); PK.fx.burst(ai.seatEl, '✋', 6); t.say(ai, '啊！手滑了'); await collect(ai, '拍錯了！'); }
                else count = count % 13 + 1;
              }
            }
            winner = ps.find((x) => !x.cards.length);
            cur = (cur + 1) % n;
          }
          if (!t.alive) break;
          kit.active(ps, null); S.render(false);
          winner.boxEl.classList.add('winner');
          const order = [winner, ...ps.filter((x) => x !== winner).sort((a, b) => a.cards.length - b.cards.length)];
          const place = order.indexOf(me);
          if (winner.isAI) t.say(winner, '我的牌出完啦！');
          info.textContent = winner.name + ' 獲勝！';
          await kit.settle(t, kit.rankReward(n, place), { big: place === 0, title: place === 0 ? '你贏了！' : '第 ' + (place + 1) + ' 名' });
          await PK.modal('本局排名', kit.ranking(t, order, (p) => '剩 ' + p.cards.length + ' 張'), [{ text: '好', value: 1, cls: 'primary' }]);
          await kit.next(t, L.ctrl, '再來一局');
        }
      } finally { removeEventListener('keydown', key); }
    },
  };
})();
