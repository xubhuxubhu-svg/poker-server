/* 牌神擂台 — 妞妞（草原牧場） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const SKILLS = { swap: ['🌾', '換草料', '換掉一張手牌', 1], rope: ['🤠', '套牛繩', '偷看莊家的一張牌', 1], milk: ['🥛', '牛奶護盾', '本局輸了只賠一半', 1], king: ['🐂', '牛魔王', '本局贏的倍率再加 1 倍', 1] };
  const BETS = [10, 50, 100, 200];
  const NAMES = ['沒牛', '牛一', '牛二', '牛三', '牛四', '牛五', '牛六', '牛七', '牛八', '牛九', '牛牛', '五花牛', '炸彈', '五小牛'];
  const v = (c) => (c.r >= 10 ? 10 : c.r);
  const SU = { S: 4, H: 3, D: 2, C: 1 };
  const top = (cs) => cs.slice().sort((a, b) => b.r - a.r || SU[b.s] - SU[a.s])[0];
  /* 判斷牌型：{ rank, three:[三張湊十] } */
  const evalHand = (cs) => {
    const cnt = {}; cs.forEach((c) => (cnt[c.r] = (cnt[c.r] || 0) + 1));
    if (cs.every((c) => c.r < 5) && cs.reduce((a, c) => a + c.r, 0) <= 10) return { rank: 13, three: [] };
    if (Object.values(cnt).some((x) => x === 4)) return { rank: 12, three: [] };
    if (cs.every((c) => c.r >= 11)) return { rank: 11, three: [] };
    let best = { rank: 0, three: [] };
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++) {
      if ((v(cs[i]) + v(cs[j]) + v(cs[k])) % 10) continue;
      const rest = cs.filter((_, x) => x !== i && x !== j && x !== k);
      const m = (v(rest[0]) + v(rest[1])) % 10 || 10;
      if (m > best.rank) best = { rank: m, three: [cs[i], cs[j], cs[k]] };
    }
    return best;
  };
  const mult = (rank) => (rank >= 11 ? 5 : rank === 10 ? 3 : rank >= 7 ? 2 : 1);
  const beats = (a, b) => { const ea = evalHand(a), eb = evalHand(b); if (ea.rank !== eb.rank) return ea.rank > eb.rank; const ta = top(a), tb = top(b); return ta.r !== tb.r ? ta.r > tb.r : SU[ta.s] > SU[tb.s]; };

  PK.IMPL.niuniu = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me;
      const banker = { name: '牧場主', isAI: true, avatar: '🤠', level: 5, cards: [] };
      ps.forEach((p) => (p.chips = 1000));
      let round = 0;
      const deckEl = el('div', { class: 'deck-pile' }, [0, 1, 2].map(() => PK.cardEl(null, false)));
      const info = el('div', { class: 'round-info' });
      const L = kit.layout(t, {
        cls: 'nu',
        top: kit.box(t, banker, { cls: 'banker-box' }),
        others: t.others.map((p) => kit.box(t, p)),
        mid: [deckEl, el('div', { class: 'mid-info' }, info, el('div', { class: 'event-box' }, '牛七～牛九 2 倍・牛牛 3 倍・特殊牌型 5 倍'))],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      const show = (p, reveal) => {
        const big = p === me;
        const e = p.open ? evalHand(p.cards) : null;
        p.handEl.replaceChildren(...p.cards.map((c, i) => {
          const up = p.open || (p === me && i < 4) || (p.peekIdx === i);
          const ce = PK.cardEl(c, up, { small: !big });
          if (e && e.three.includes(c)) ce.classList.add('nu-three');
          if (p.peekIdx === i && !p.open) ce.classList.add('peeked');
          return ce;
        }));
        p.ptsEl.textContent = e ? NAMES[e.rank] : '';
        p.tagEl.className = 'tag-st ' + (e ? (e.rank >= 10 ? 'top' : e.rank >= 7 ? 'five' : e.rank === 0 ? 'bust' : 'stand') : '');
        p.tagEl.textContent = e ? '×' + mult(e.rank) : '';
        if (p.betEl && !p.banker) p.betEl.textContent = p.bet ? '🪙' + p.bet + (p.king ? ' 🐂' : '') + (p.milk ? ' 🥛' : '') : '';
      };
      banker.banker = true;
      const reveal = async (p, slow) => {
        if (slow) { const last = PK.$$('.card', p.handEl)[4]; if (last) { last.classList.add('squeeze'); await t.wait(900); } }
        p.open = true; show(p);
        const e = evalHand(p.cards);
        PK.voice.say((p === me ? '' : p.name + '，') + NAMES[e.rank], { pri: 2, pitch: p.voicePitch || 1 });
        if (p === me && e.rank >= 10) PK.ch.emit('niuniu');
        if (e.rank >= 11) { PK.fx.flash('#ffd700', 400); PK.fx.banner(NAMES[e.rank] + '！', 'gold', '5 倍'); PK.fx.fireworks(3); }
        else if (e.rank === 10) { PK.fx.burst(p.handEl, ['🐂', '🐄', '🐃', '💨'], 22, { speed: 9 }); PK.fx.shake(L.wrap, 8); PK.sfx('big'); if (p === me || p === banker) PK.fx.banner('牛牛！', 'gold', '3 倍'); }
        else if (e.rank >= 7) { PK.fx.burst(p.handEl, ['🐮', '✨'], 10); PK.sfx('win'); }
        else if (e.rank === 0) { PK.fx.burst(p.handEl, '💨', 6); }
        if (p === me && e.rank < 10) PK.fx.banner(NAMES[e.rank], e.rank >= 7 ? 'good' : e.rank === 0 ? 'bad' : 'event');
        await t.wait(p === me ? 1100 : 600);
      };

      while (t.alive) {
        round++;
        if (t.isParty && round > 1 && (round - 1) % 5 === 0) S.refill();
        const deck = PK.makeDeck();
        [banker, ...ps].forEach((p) => { p.cards = []; p.open = false; p.peekIdx = -1; p.bet = 0; p.king = p.milk = false; p.boxEl.classList.remove('winner'); show(p); });
        info.textContent = '第 ' + round + ' 局・請下注';
        const bets = await Promise.all(ps.map((p) => (p.isAI ? PK.pick(BETS) : kit.bet(t, L.ctrl, BETS, null, p))));
        ps.forEach((p, i) => (p.bet = bets[i]));
        ps.forEach((p) => show(p));
        info.textContent = '發牌中';
        for (let k = 0; k < 5; k++) for (const p of [...ps, banker]) { p.cards.push(deck.pop()); await PK.flyCard(deckEl, p.handEl, null, 140); show(p); }
        PK.voice.say('你的四張牌，' + me.cards.slice(0, 4).map(PK.cardSpeech).join('、'));
        /* 技能用的牌和位置先決定好（多人同時操作時才不會互相影響） */
        ps.forEach((p) => { if (!p.isAI) { p.swapCard = deck.pop(); p.ropeIdx = PK.randInt(0, 4); } });
        /* 開牌前：每位真人可以用技能（同時進行） */
        info.textContent = '看看你的四張牌，準備開牌';
        const humanPre = async (hp) => {
          while (t.alive) {
            const r = await kit.ask(t, { who: hp, ctrl: L.ctrl, timer: L.timer, secs: 25, skills: S, buttons: [{ text: '開牌！', cls: 'primary big', value: 1 }] });
            if (r.type !== 'skill') break;
            const k = r.key;
            if (k === 'swap') {
              const r2 = await kit.ask(t, { who: hp, ctrl: L.ctrl, title: '🌾 點一張要換掉的牌（第五張還蓋著也可以換）', secs: 20, timer: L.timer, bind: (pick) => me.handEl.querySelectorAll('.card').forEach((e, i) => { e.classList.add('playable'); e.addEventListener('click', () => pick(i)); }), cleanup: () => show(me) });
              const c = r2.type === 'pick' ? r2.value : 0;
              S.spend(hp, k); hp.cards[c] = hp.swapCard;
              PK.fx.burst(hp.handEl, ['🌾', '🌀'], 12); show(hp); if (c < 4 && hp === me) PK.voice.card(hp.cards[c]);
            }
            if (k === 'rope') { S.spend(hp, k); const idx = hp.ropeIdx; if (hp === me) { banker.peekIdx = idx; show(banker); t.sys('莊家有一張 ' + PK.cardName(banker.cards[idx])); } PK.fx.burst(banker.seatEl, '🤠', 8); }
            if (k === 'milk') { S.spend(hp, k); hp.milk = true; show(hp); }
            if (k === 'king') { S.spend(hp, k); hp.king = true; show(hp); PK.fx.burst(hp.seatEl, ['🐂', '🔥'], 12); }
          }
        };
        await Promise.all(ps.filter((p) => !p.isAI).map(humanPre));
        if (!t.alive) return;
        if (t.isParty) ps.filter((p) => p.isAI).forEach((p) => { if (Math.random() < 0.2 && p.sk.king) { S.spend(p, 'king'); p.king = true; show(p); } else if (Math.random() < 0.15 && p.sk.milk) { S.spend(p, 'milk'); p.milk = true; show(p); } });
        info.textContent = '開牌';
        for (const p of ps) await reveal(p, t.isParty && p === me);
        info.textContent = '牧場主開牌'; kit.active([banker, ...ps], banker);
        await reveal(banker, true);
        kit.active([banker, ...ps], null);
        const be = evalHand(banker.cards);
        let myD = 0, myBig = false;
        for (const p of ps) {
          const pe = evalHand(p.cards);
          let d;
          if (beats(p.cards, banker.cards)) d = p.bet * (mult(pe.rank) + (p.king ? 1 : 0));
          else d = -p.bet * mult(be.rank) * (p.milk ? 0.5 : 1);
          d = Math.round(d); p.chips += d;
          PK.fx.floatText(p.seatEl, (d > 0 ? '+' : '') + PK.fmt(d), d > 0 ? '#7dff9a' : '#ff7b7b');
          if (d > 0) { p.boxEl.classList.add('winner'); PK.fx.coins(banker.seatEl, p.seatEl, 8); kit.say(t, p, 'win', 0.4); }
          if (p === me) { myD = d; myBig = pe.rank >= 10 && d > 0; }
          await t.wait(250);
        }
        await kit.settle(t, myD, { big: myBig, title: myD > 0 ? '贏過牧場主！' : '輸給牧場主' });
        ps.forEach((p) => { if (p.isAI && p.chips < 10) p.chips = 1000; });
        t.sys(`第 ${round} 局：你 ${NAMES[evalHand(me.cards).rank]}，莊家 ${NAMES[be.rank]}，${myD >= 0 ? '+' : ''}${PK.fmt(myD)}`);
        await kit.next(t, L.ctrl);
      }
    },
  };
})();
