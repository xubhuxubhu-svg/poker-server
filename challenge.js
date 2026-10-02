/* 牌神擂台 — 挑戰賽與能力銘牌 ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el;
  const CH = (PK.ch = {});
  const st = () => { const s = PK.user.stats; s.ch = s.ch || { ev: {}, streak: 0, best: 0, nw: 0, hw: 0, skills: 0, online: 0 }; s.ch.ev = s.ch.ev || {}; return s; };
  const gamesPlayed = (s) => Object.keys(s.games || {}).length;
  const gamesWon = (s) => Object.values(s.games || {}).filter((g) => g.wins > 0).length;
  const ev = (k) => (s) => s.ch.ev[k] || 0;
  /* [編號, 說明, 目前進度, 需要, 前往的遊戲] */
  const T = (id, text, cur, need, go) => ({ id, text, cur, need, go });
  CH.LEVELS = [
    null,
    { tasks: [T('p3', '完成 3 局任何遊戲', (s) => s.plays, 3), T('w1', '贏 1 局', (s) => s.wins, 1), T('g3', '玩過 3 款不同的遊戲', gamesPlayed, 3), T('sk3', '在狂歡模式使用 3 次技能', (s) => s.ch.skills, 3, 'tenhalf')] },
    { tasks: [T('w5', '總共贏 5 局', (s) => s.wins, 5), T('g6', '玩過 6 款不同的遊戲', gamesPlayed, 6), T('th_top', '十點半：剛好拿到「十點半」', ev('th_top'), 1, 'tenhalf'), T('rp60', '撿紅點：一局拿到 60 分以上', ev('rp60'), 1, 'redpoint')] },
    { tasks: [T('nw5', '在「普通」以上難度贏 5 局', (s) => s.ch.nw, 5), T('bj', '二十一點：拿到黑傑克', ev('bj'), 1, 'blackjack'), T('b2bomb', '大老二：打出鐵支或同花順', ev('b2bomb'), 1, 'big2'), T('ol1', '和家人真人連線玩 1 局', (s) => s.ch.online, 1)] },
    { tasks: [T('hw3', '在「困難」難度贏 3 局', (s) => s.ch.hw, 3), T('nn', '妞妞：拿到牛牛以上', ev('niuniu'), 1, 'niuniu'), T('shot', '十三支：打槍一次', ev('shot'), 1, 'thirteen'), T('fast', '心臟病：0.4 秒內拍到桌子', ev('fast'), 1, 'slap')] },
    { tasks: [T('hw10', '在「困難」難度贏 10 局', (s) => s.ch.hw, 10), T('g20', '20 款遊戲全部玩過', gamesPlayed, 20), T('st5', '連續贏 5 局', (s) => s.ch.best, 5), T('hd', '德州撲克：用葫蘆以上贏得底池', ev('hd_big'), 1, 'holdem')] },
    { tasks: [T('br', '橋牌：我方完成成局合約', ev('br_game'), 1, 'bridge'), T('sp3', '黑桃王：我方叫墩成功 3 次', ev('sp_made'), 3, 'spades'), T('sol', '經典接龍：完成 1 局', ev('sol'), 1, 'solitaire'), T('gin', '金拉米：喊出「金」', ev('gin'), 1, 'ginrummy')] },
    { tasks: [T('hw30', '在「困難」難度贏 30 局', (s) => s.ch.hw, 30), T('gw20', '20 款遊戲每一款都至少贏 1 局', gamesWon, 20), T('five', '十點半：拿到五龍', ev('th_five'), 1, 'tenhalf'), T('moon', '傷心小棧射月，或十三支全壘打', (s) => (s.ch.ev.moon || 0) + (s.ch.ev.homer || 0), 1, 'hearts')] },
  ];
  const DESC = ['剛加入牌桌的新朋友', '學會基本玩法', '熟悉各種遊戲', '能和電腦一較高下', '牌技精湛的精英', '技術全面的大師', '橋牌、接龍都難不倒', '撲克牌之神'];
  const progress = (lv) => { const s = st(); return CH.LEVELS[lv].tasks.map((t) => ({ t, cur: Math.min(t.need, t.cur(s) || 0) })); };
  const levelDone = (lv) => progress(lv).every((x) => x.cur >= x.t.need);

  /* ---------- 紀錄 ---------- */
  CH.emit = (name, n) => { if (!PK.user) return; const s = st(); s.ch.ev[name] = (s.ch.ev[name] || 0) + (n || 1); PK.saveUser(); check(); };
  CH.onSettle = (t, delta) => {
    const s = st();
    if (delta > 0) { s.ch.streak++; s.ch.best = Math.max(s.ch.best, s.ch.streak); if (t.diff >= 1) s.ch.nw++; if (t.diff === 2) s.ch.hw++; } else if (delta < 0) s.ch.streak = 0;
    if (t.online) s.ch.online++;
    PK.saveUser(); check();
  };
  let busy = false;
  const check = async () => {
    if (busy) return; busy = true;
    try {
      while ((PK.user.level || 0) < 7 && levelDone((PK.user.level || 0) + 1)) {
        PK.user.level = (PK.user.level || 0) + 1;
        PK.saveUser();
        await celebrate(PK.user.level);
      }
    } finally { busy = false; }
  };
  const celebrate = async (lv) => {
    const L = PK.LEVELS[lv];
    PK.fx.fireworks(8); PK.fx.confetti(200); PK.sfx('big');
    PK.voice.say('恭喜升級！你現在是' + L.name, { pri: 3 });
    const b = PK.badge(lv); b.classList.add('badge-huge');
    await PK.modal('🎉 恭喜升級！', el('div', { class: 'lvup' }, el('div', { class: 'lvup-ring' }, b), el('div', { class: 'lvup-name' }, L.name), el('p', null, DESC[lv]), el('p', { class: 'muted' }, '新的能力銘牌會顯示在大廳、排行榜和牌桌上')), [{ text: '太棒了！', value: 1, cls: 'primary big' }], { cls: 'lvup-modal' });
    PK.$$('.me-name .badge').forEach((x) => x.replaceWith(PK.badge(lv)));
    if (PK.$('.ch-list')) CH.show();
  };

  /* ---------- 挑戰賽畫面 ---------- */
  CH.show = function () {
    const lv = PK.user.level || 0;
    document.body.removeAttribute('style'); document.body.className = 'lobby-body';
    const cards = PK.LEVELS.map((L, i) => {
      const state = i <= lv ? 'done' : i === lv + 1 ? 'now' : 'lock';
      const body = i === 0 ? el('p', { class: 'muted' }, '每位玩家一開始的等級') : el('div', { class: 'ch-tasks' }, progress(i).map(({ t, cur }) => el('div', { class: 'ch-task' + (cur >= t.need ? ' ok' : '') },
        el('div', { class: 'ch-tt' }, (cur >= t.need ? '✅ ' : '⬜ ') + t.text),
        el('div', { class: 'ch-bar' }, el('div', { class: 'ch-fill', style: { width: (cur / t.need) * 100 + '%' } })),
        el('div', { class: 'ch-num' }, cur + ' / ' + t.need,
          t.go && state !== 'done' && cur < t.need ? el('button', { class: 'btn small primary', onclick: () => PK.showSetup(PK.GAME[t.go]) }, '前往挑戰') : ''))));
      return el('div', { class: 'ch-card ' + state },
        el('div', { class: 'ch-head' }, PK.badge(i), el('div', null, el('div', { class: 'ch-name' }, L.name + (state === 'done' ? '　✔ 已達成' : state === 'now' ? '　▶ 挑戰中' : '　🔒')), el('div', { class: 'muted' }, DESC[i]))),
        body);
    });
    PK.$('#app').replaceChildren(el('div', { class: 'lobby' },
      el('div', { class: 'setup-top' }, el('button', { class: 'btn ghost', onclick: PK.showLobby }, '← 返回大廳')),
      el('div', { class: 'ch-hero' }, el('h2', null, '🏅 挑戰賽'), el('div', null, '目前等級：', PK.badge(lv)), el('p', { class: 'muted' }, '完成同一個等級的 4 項挑戰，就能升到下一級，拿到新的能力銘牌。進度會自動記錄，玩任何遊戲都算數。')),
      el('div', { class: 'ch-list' }, cards)));
    const now = PK.$('.ch-card.now'); if (now) setTimeout(() => now.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  };
})();
