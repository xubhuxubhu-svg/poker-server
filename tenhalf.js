/* 牌神擂台 — 十點半（古風茶樓） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit;
  const val = (c) => (c.r >= 11 ? 0.5 : c.r);
  const sum = (cards) => cards.reduce((a, c) => a + val(c), 0);
  const fp = (x) => { const i = Math.floor(x); return x - i ? (i ? i + '點半' : '半點') : i + '點'; };
  const BETS = [10, 50, 100, 200, 500];
  const SKILLS = { peek: ['🔮', '卜卦', '預先看到下一張牌', 2], swap: ['🔄', '換牌術', '把最後拿到的一張換掉', 2], charm: ['🧿', '護身符', '本局爆牌只輸一半', 1], dbl: ['💰', '加倍符', '本局輸贏都加倍', 1], spy: ['👁️', '窺莊', '偷看莊家的暗牌', 1] };
  const EVENTS = [
    { id: 'rain', name: '紅包雨', desc: '本局贏家獎金加倍！', emoji: '🧧' },
    { id: 'god', name: '財神到', desc: '每人獲得 50 籌碼！', emoji: '💰' },
    { id: 'plus', name: '加一點局', desc: '本局上限變成十一點半！', emoji: '🍵' },
  ];
  const LINES = {
    hit: ['再來一張！', '拚了！', '要牌～', '應該不會爆吧…'],
    stand: ['我停了', '夠了夠了', '這樣就好', '停牌！'],
    bust: ['啊～爆了！', '茶杯都碎了…', '早知道就停了 😭', '可惡！'],
    win: ['嘿嘿，贏了', '今天手氣真好', '謝謝莊家～', '耶！'],
    big: ['太神啦！', '哈哈哈發財了（虛擬的）', '看到了沒！'],
    lose: ['下一局再來', '唉…', '莊家好強'],
  };

  PK.IMPL.tenhalf = {
    skills: SKILLS,
    async start(t) {
      const party = t.isParty;
      const banker = { name: '莊家', isAI: true, avatar: '🎎', level: 5, cards: [], banker: true };
      const ps = t.players, me = t.me;
      ps.forEach((p) => Object.assign(p, { chips: 1000, cards: [], bet: 0, status: '', mult: 1, charm: false, spied: false }));
      let deck = [], L = 10.5, event = null, roundNo = 0;

      /* ---------- 版面 ---------- */
      const pile = el('div', { class: 'deck-pile' }, [0, 1, 2].map(() => PK.cardEl(null, false)));
      const evBox = el('div', { class: 'event-box' });
      const roundInfo = el('div', { class: 'round-info' });
      const LY = kit.layout(t, {
        top: kit.box(t, banker, { cls: 'banker-box' }),
        others: t.others.map((p) => kit.box(t, p)),
        mid: [pile, el('div', { class: 'mid-info' }, roundInfo, evBox)],
        me: kit.box(t, me, { big: true, cls: 'me-box' }),
      });
      const S = kit.skills(t, SKILLS, ps, LY.skillbar);

      const show = (p, revealAll) => {
        p.handEl.replaceChildren(...p.cards.map((c, i) => {
          const hidden = i === 0;
          const faceUp = !hidden || revealAll || p === me || (p.banker && me.spied);
          const e = PK.cardEl(c, faceUp, { small: p !== me, hiddenMark: hidden && faceUp && !revealAll });
          if (p.banker && me.spied && hidden && !revealAll) e.classList.add('peeked');
          return e;
        }));
        info(p, revealAll);
      };
      const info = (p, revealAll) => {
        if (!p.cards.length) { p.ptsEl.textContent = ''; p.tagEl.textContent = ''; p.betEl.textContent = p.bet ? '🪙' + p.bet : ''; return; }
        const full = sum(p.cards), vis = sum(p.cards.slice(1));
        p.ptsEl.textContent = p === me || revealAll || p.status === 'bust' ? fp(full) : p.cards.length < 2 ? '暗牌一張' : '明牌 ' + fp(vis);
        p.tagEl.textContent = { bust: '爆牌', five: '五龍', top: fp(L), stand: '停牌', play: '' }[p.status] || '';
        p.tagEl.className = 'tag-st ' + p.status;
        p.betEl.textContent = p.banker ? '' : p.bet ? '🪙' + p.bet + (p.mult > 1 ? ' ×2' : '') + (p.charm ? ' 🧿' : '') : '';
      };
      const all = () => [banker, ...ps];
      const draw = async (p, hidden) => {
        const c = deck.pop();
        p.cards.push(c);
        const ce = PK.cardEl(c, !hidden || p === me, { small: p !== me, hiddenMark: hidden && p === me });
        await PK.flyCard(pile, p.handEl, ce, 280);
        show(p);
        if (!hidden) PK.voice.card(c, p === me ? fp(sum(p.cards)) : '');
        return c;
      };

      /* ---------- 技能效果（所有裝置都會執行同樣的步驟） ---------- */
      const useSkill = async (p, k) => {
        if (!S.spend(p, k)) return false;
        if (k === 'peek') {
          const c = deck[deck.length - 1];
          if (p === me) {
            PK.fx.peek(pile);
            await PK.modal('卜卦', el('div', { class: 'peek-show' }, el('div', null, '🔮 卜卦結果：下一張牌是'), PK.cardEl(c, true), el('div', { class: 'peek-pts' }, '（' + fp(val(c)) + '）')), [{ text: '知道了', value: 1, cls: 'primary' }]);
          }
          return c;
        }
        if (k === 'swap') {
          deck.unshift(p.cards.pop());
          PK.fx.burst(p.handEl, ['🌀', '✨'], 10);
          show(p);
          await t.wait(250);
          await draw(p, false);
        }
        if (k === 'charm') { p.charm = true; PK.fx.burst(p.seatEl, '🧿', 8, { g: 0, speed: 3 }); }
        if (k === 'dbl') { p.mult = 2; PK.fx.coins(p.seatEl, null, 12); PK.fx.floatText(p.seatEl, '輸贏加倍', '#ffd166'); }
        if (k === 'spy') {
          p.spied = true;
          if (p === me) { show(banker); t.sys('莊家的暗牌是 ' + PK.cardName(banker.cards[0])); }
          PK.fx.peek(banker.handEl);
        }
        info(p);
        return true;
      };

      /* 判斷手牌狀態 */
      const judge = async (p) => {
        const s = sum(p.cards);
        if (s > L) {
          p.status = 'bust'; show(p);
          PK.sfx('bust'); PK.fx.burst(p.handEl, ['🍵', '💥', '🫖', '💢'], 16); PK.fx.shake(p.boxEl, 10);
          if (p === me) PK.fx.banner('爆牌！', 'bad', fp(s)); else if (p.isAI) t.say(p, PK.cpick(LINES.bust));
          return true;
        }
        if (p.cards.length >= 5) {
          p.status = 'five'; show(p);
          PK.sfx('big'); PK.fx.burst(p.handEl, ['🐉', '✨', '🏮'], 20); PK.fx.flash('#ffd36b', 400);
          PK.fx.banner('五龍！', 'gold', (p === me ? '' : p.name + '・') + '五張不爆・贏三倍');
          if (p === me) PK.ch.emit('th_five');
          return true;
        }
        if (s === L) {
          p.status = 'top'; show(p);
          PK.sfx('win'); PK.fx.sparkle(p.handEl, '#ffd700', 40);
          if (p === me) { PK.fx.banner(fp(L) + '！', 'gold', '贏兩倍'); PK.ch.emit('th_top'); } else if (p.isAI) t.say(p, fp(L) + '！嘿嘿');
          return true;
        }
        return false;
      };
      const afterDraw = async (p) => {
        const s = sum(p.cards);
        if (s > L && party && p.sk.swap) {
          const v = await kit.modalAsk(t, p, '快爆牌了！', `<p>目前 ${fp(s)}，超過${fp(L)}了！</p><p>要使用「🔄 換牌術」把最後一張換掉嗎？（剩 ${p.sk.swap} 次）</p>`, [{ text: '算了', value: 0 }, { text: '使用換牌術', value: 1, cls: 'primary' }], { noX: true });
          if (v) { await useSkill(p, 'swap'); return afterDraw(p); }
        }
        return judge(p);
      };

      /* ---------- 真人回合（自己的或連線家人的） ---------- */
      const humanTurn = async (p) => {
        t.actor = p;
        while (true) {
          const r = await kit.ask(t, { ctrl: LY.ctrl, timer: LY.timer, secs: 20, skills: S, buttons: [{ text: '要牌', cls: 'primary big', value: 'hit' }, { text: '停牌', cls: 'big', value: 'stand' }] });
          if (r.type === 'closed') return;
          if (r.type === 'timeout' || r.value === 'stand') { p.status = 'stand'; info(p); return; }
          if (r.type === 'skill') {
            if (r.key === 'swap' && p.cards.length < 2) { if (p === me) PK.toast('暗牌不能換，要先拿一張明牌'); continue; }
            await useSkill(p, r.key);
            if (r.key === 'swap' && (await afterDraw(p))) return;
            continue;
          }
          await draw(p, false);
          if (await afterDraw(p)) return;
        }
      };

      const aiTurn = async (p) => {
        await t.wait(PK.randInt(500, 900));
        if (party && Math.random() < 0.15 && p.sk.charm) await useSkill(p, 'charm');
        while (true) {
          const s = sum(p.cards);
          let want;
          if (t.diff === 0) want = s < PK.rand(5, 8.5);
          else if (t.diff === 1) want = s <= 6.5 || (p.cards.length === 4 && s <= 8);
          else {
            const rest = deck.length, safe = deck.filter((c) => s + val(c) <= L).length, pb = 1 - safe / rest;
            want = (pb < 0.4 && s < L - 1.5) || (p.cards.length === 4 && pb < 0.55);
          }
          if (party && t.diff > 0 && p.sk.peek && s >= 6 && s < 9 && Math.random() < 0.4) {
            const nx = await useSkill(p, 'peek'); want = s + val(nx) <= L; await t.wait(400);
          }
          if (!want) { p.status = 'stand'; info(p); t.say(p, PK.cpick(LINES.stand)); break; }
          if (PK.nrand() < 0.3) t.say(p, PK.cpick(LINES.hit));
          await draw(p, false);
          await t.wait(350);
          if (sum(p.cards) > L && party && p.sk.swap && Math.random() < 0.6) { await useSkill(p, 'swap'); await t.wait(300); }
          if (await judge(p)) break;
          if (party && p.sk.dbl && sum(p.cards) >= 9 && Math.random() < 0.6) await useSkill(p, 'dbl');
          await t.wait(PK.randInt(450, 800));
        }
      };

      /* ---------- 莊家 ---------- */
      const bankerTurn = async () => {
        kit.active(all(), banker);
        roundInfo.textContent = '莊家亮牌';
        await t.wait(500);
        const back = PK.$('.card', banker.handEl);
        if (back) back.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }, { transform: 'rotateY(0)' }], { duration: 500 });
        await t.wait(250); show(banker, true); PK.voice.say('莊家暗牌，' + PK.cardSpeech(banker.cards[0]) + '，共' + fp(sum(banker.cards))); await t.wait(900);
        const alive = ps.filter((p) => p.status !== 'bust');
        if (!alive.length) { t.say(banker, '大家都爆了，我就不補了'); return; }
        const target = t.diff === 2 ? 7.5 : 7;
        while (sum(banker.cards) < target || (t.diff === 2 && sum(banker.cards) < 9 && alive.every((p) => p.status === 'five' || p.status === 'top' || sum(p.cards.slice(1)) > sum(banker.cards)))) {
          await draw(banker, false); show(banker, true); await t.wait(450);
          if (sum(banker.cards) > L || banker.cards.length >= 5) break;
        }
        const s = sum(banker.cards);
        if (s > L) { banker.status = 'bust'; PK.sfx('bust'); PK.fx.burst(banker.handEl, ['🍵', '💥', '🫖'], 18); PK.fx.shake(banker.boxEl, 12); PK.fx.banner('莊家爆牌！', 'good'); }
        else if (banker.cards.length >= 5) { banker.status = 'five'; PK.fx.banner('莊家五龍', 'bad'); }
        else if (s === L) { banker.status = 'top'; PK.fx.banner('莊家' + fp(L), 'bad'); }
        else banker.status = 'stand';
        show(banker, true);
      };

      /* ---------- 結算 ---------- */
      const rank = (p) => (p.status === 'bust' ? -1 : p.status === 'five' ? 100 : p.status === 'top' ? 50 : sum(p.cards));
      const settle = async () => {
        roundInfo.textContent = '結算';
        const br = rank(banker);
        const results = ps.map((p) => {
          const r = rank(p);
          let k;
          if (r === -1) k = -1;
          else if (r === 100) k = br === 100 ? -1 : 3;
          else if (r === 50) k = br >= 50 ? -1 : 2;
          else if (br === -1) k = 1;
          else k = r > br && br < 50 ? 1 : -1;
          const delta = Math.round(k > 0 ? p.bet * p.mult * k * (event && event.id === 'rain' ? 2 : 1) : -p.bet * p.mult * (p.charm ? 0.5 : 1));
          p.chips += delta;
          return { p, k, delta };
        });
        for (const { p, k, delta } of results) {
          show(p, true);
          if (delta > 0) {
            PK.fx.coins(banker.seatEl, p.seatEl, Math.min(30, 8 + k * 6));
            PK.fx.floatText(p.seatEl, '+' + PK.fmt(delta), '#7dff9a');
            p.boxEl.classList.add('winner');
            if (p.isAI) t.say(p, PK.cpick(k >= 2 ? LINES.big : LINES.win));
          } else {
            PK.fx.floatText(p.seatEl, PK.fmt(delta), '#ff7b7b');
            if (p.isAI && PK.nrand() < 0.5) t.say(p, PK.cpick(LINES.lose));
          }
          await t.wait(260);
        }
        const mine = results.find((x) => x.p === me);
        await kit.settle(t, mine.delta, { big: mine.k >= 2 && mine.delta > 0, from: banker.seatEl });
        ps.forEach((p) => { if (p.isAI && p.chips < 10) p.chips = 1000; });
        t.sys(`第 ${roundNo} 局：你 ${mine.delta >= 0 ? '+' : ''}${PK.fmt(mine.delta)}，莊家 ${banker.status === 'bust' ? '爆牌' : fp(sum(banker.cards))}`);
      };

      /* ---------- 每一局 ---------- */
      while (t.alive) {
        roundNo++;
        deck = PK.makeDeck(); L = 10.5; event = null;
        all().forEach((p) => { p.cards = []; p.status = ''; p.bet = 0; p.mult = 1; p.charm = false; p.spied = false; p.boxEl.classList.remove('winner'); show(p); });
        evBox.replaceChildren(); kit.active(all(), null);
        if (party && (roundNo - 1) % 5 === 0 && roundNo > 1) S.refill();

        /* 隨機事件 */
        if (party && Math.random() < 0.35) {
          event = PK.pick(EVENTS);
          PK.sfx('event'); PK.fx.banner(event.emoji + ' ' + event.name, 'event', event.desc);
          evBox.append(el('div', { class: 'event-tag' }, event.emoji + ' ' + event.name + '：' + event.desc));
          if (event.id === 'rain') { for (let i = 0; i < 4; i++) setTimeout(() => PK.fx.burst({ getBoundingClientRect: () => ({ left: PK.crand(0, innerWidth), top: 0, width: 0, height: 0 }) }, '🧧', 8, { up: -2, g: 0.15 }), i * 200); }
          if (event.id === 'god') { ps.forEach((p) => { p.chips += 50; PK.fx.coins(null, p.seatEl, 8); }); PK.addChips(50); }
          if (event.id === 'plus') L = 11.5;
          await t.wait(1400);
        }

        roundInfo.textContent = '第 ' + roundNo + ' 局・請下注';
        const bets = await Promise.all(ps.map((p) => (p.isAI ? Math.min(p.chips, PK.pick(BETS.slice(0, t.diff === 2 ? 5 : 4))) : kit.bet(t, LY.ctrl, BETS, null, p))));
        ps.forEach((p, i) => { p.bet = bets[i]; info(p); });

        roundInfo.textContent = '發牌中';
        for (const p of [...ps, banker]) { await draw(p, true); await t.wait(80); }
        for (const p of ps) { if (sum(p.cards) === L) await judge(p); }

        for (const p of ps) {
          if (p.status) continue;
          kit.active(all(), p); p.status = 'play';
          roundInfo.textContent = p === me ? '輪到你了' : '輪到 ' + p.name;
          if (p.isAI) await aiTurn(p); else await humanTurn(p);
          if (p.status === 'play') p.status = 'stand';
          info(p);
          await t.wait(300);
        }
        await bankerTurn();
        await t.wait(500);
        await settle();
        kit.active(all(), null);
        await kit.next(t, LY.ctrl);
      }
    },
  };
})();
