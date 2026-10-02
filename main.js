/* 牌神擂台 — 大廳、登入、聲明、遊戲設定 ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el;
  const app = () => PK.$('#app');

  PK.DISCLAIMER = `
<div class="disclaimer">
<p class="credit">遊戲製作：Eric Hu</p>
<h4>一、使用目的</h4>
<ol><li>本平台為個人製作的撲克牌休閒遊戲合集，<b>僅供家人與親友之間娛樂使用</b>。</li>
<li>本平台不對外營業，不以任何形式公開招攬玩家。</li></ol>
<h4>二、禁止營利</h4>
<ol><li>本平台完全免費，不收取任何費用，也沒有任何付費功能。</li>
<li>禁止任何人利用本平台從事營利行為，包括：收取入場費、報名費或抽成；代為開桌、代打、代練或販售帳號；販售或轉讓遊戲內的籌碼、金幣、銘牌或任何道具；在遊戲中刊登廣告或進行商業宣傳。</li>
<li>違反以上規定的帳號，製作者有權直接停用或刪除。</li></ol>
<h4>三、虛擬籌碼說明（賭場類遊戲特別聲明）</h4>
<p>本平台內的德州撲克、二十一點、百家樂、十點半、射龍門、妞妞等遊戲，以及其他使用籌碼或金幣計分的遊戲，一律適用以下規定：</p>
<ol><li>遊戲中的籌碼與金幣<b>全部都是虛擬計分工具</b>，只用來記錄遊戲勝負和排行榜名次。</li>
<li>虛擬籌碼與金幣<b>沒有任何現金價值</b>：<b>不能</b>用現金、點數卡或任何方式購買或儲值；<b>不能</b>兌換成現金、商品、禮券或任何有價物品；<b>不能</b>在玩家之間買賣、轉讓或贈送。</li>
<li>籌碼用完時，系統會<b>免費自動補發</b>。</li>
<li><b>嚴禁將本平台用於任何形式的賭博</b>，包括私下約定以遊戲結果支付金錢或財物。</li>
<li>任何人如果違反上述規定，所產生的一切法律責任由行為人自行負責，與本平台及製作者無關。</li></ol>
<h4>四、遊戲規則說明</h4>
<ol><li>各款撲克牌玩法皆為傳統民間遊戲，規則參考台灣常見玩法整理。各地、各家庭的玩法可能略有不同，請以遊戲內的「遊戲說明」為準。</li>
<li>「狂歡模式」中的技能與特效為本平台自創的娛樂玩法，並非原本的遊戲規則。</li></ol>
<h4>五、帳號與個人資料</h4>
<ol><li>註冊時只需要玩家名稱和密碼，<b>請勿使用真實姓名</b>，也請不要使用其他網站的密碼。</li>
<li>本平台只會保存玩家名稱、遊戲成績、排行榜紀錄和銘牌，不會收集其他個人資料，也不會提供給任何第三方。</li>
<li>文字聊天紀錄只在遊戲進行時顯示，不會長期保存。</li>
<li>即時語音只會在玩家之間即時傳送，<b>不會錄音，也不會儲存</b>。</li></ol>
<h4>六、聊天與語音禮儀</h4>
<ol><li>請保持友善，禁止辱罵、騷擾、散播不實訊息或傳送不當內容。</li>
<li>如有違規行為，製作者有權停用該帳號的聊天或語音功能，或停用帳號。</li></ol>
<h4>七、未成年使用</h4>
<p>未成年人使用本平台時，請由家長陪同或在家長同意下使用，並注意遊戲時間，適度休息。</p>
<h4>八、適度遊戲</h4>
<p>遊戲雖然有趣，但請注意身體健康，避免長時間連續遊玩。</p>
<h4>九、免責聲明</h4>
<ol><li>本平台使用免費雲端主機，可能因主機休眠、維修或網路狀況而出現延遲、斷線或暫時無法使用的情況。如果因此造成遊戲中斷或資料遺失，製作者不負賠償責任。</li>
<li>製作者保留隨時修改遊戲內容、規則及本聲明的權利。</li></ol>
<h4>十、版權</h4>
<ol><li>本平台的程式、畫面設計與特效，皆為製作者 Eric Hu 原創製作。</li>
<li>背景音樂將於後續補上，屆時會另外標示來源。</li></ol>
</div>`;
  PK.showDisclaimer = () => PK.modal('📜 牌神擂台　遊戲製作聲明', PK.DISCLAIMER, null, { cls: 'wide' });

  /* ---------- 啟動 ---------- */
  async function boot() {
    document.body.append(el('div', { id: 'toasts' }));
    if (!PK.store.get('pk_agreed', false)) {
      const ok = await PK.modal('📜 牌神擂台　遊戲製作聲明', PK.DISCLAIMER + '<p class="agree-hint">請閱讀以上聲明，按「我已閱讀並同意」後開始遊戲。</p>',
        [{ text: '我已閱讀並同意', value: true, cls: 'primary big' }], { cls: 'wide', noX: true });
      if (ok) PK.store.set('pk_agreed', true);
    }
    const last = PK.store.get('pk_last', null);
    if (last && PK.OFFLINE) {
      const u = PK.store.get('pk_users', {})[last.name];
      if (u) { PK.user = Object.assign({}, u); delete PK.user.pw; return showLobby(); }
    }
    if (last && last.token && !PK.OFFLINE) {
      try { const r = await PK.api('me', { name: last.name, token: last.token }); PK.user = r.user; PK.user.token = last.token; return showLobby(); } catch (e) {}
    }
    showLogin();
  }

  /* ---------- 登入 ---------- */
  function showLogin() {
    const name = el('input', { placeholder: '玩家名稱（1～12 字）', maxlength: 12, autocomplete: 'username' });
    const pw = el('input', { placeholder: '密碼（至少 4 字）', type: 'password', autocomplete: 'current-password' });
    const msg = el('div', { class: 'login-msg' });
    const go = async (reg) => {
      PK.sfx('click'); msg.textContent = '處理中…';
      try { await PK.login(name.value, pw.value, reg); showLobby(); PK.toast('歡迎，' + PK.user.name + '！'); }
      catch (e) { msg.textContent = e.message; }
    };
    pw.addEventListener('keydown', (e) => e.key === 'Enter' && go(false));
    app().replaceChildren(el('div', { class: 'login-screen' },
      el('div', { class: 'login-cards' }, ['♠', '♥', '♣', '♦'].map((s, i) => el('div', { class: 'login-suit s' + i }, s))),
      el('h1', { class: 'logo' }, '牌神擂台'),
      el('div', { class: 'logo-sub' }, '二十款撲克牌遊戲・家人親友同樂'),
      el('div', { class: 'login-box' }, name, pw, msg,
        el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => go(false) }, '登入'), el('button', { class: 'btn', onclick: () => go(true) }, '註冊新玩家'))),
      el('div', { class: 'login-foot' }, PK.OFFLINE ? '單機試玩版　' : '', '遊戲製作：Eric Hu　', el('a', { href: '#', onclick: (e) => { e.preventDefault(); PK.showDisclaimer(); } }, '製作聲明'))));
  }

  /* ---------- 大廳 ---------- */
  let curCat = 'tw';
  function showLobby() {
    PK.current = null;
    document.body.removeAttribute('style'); document.body.className = 'lobby-body';
    const u = PK.user;
    const head = el('header', { class: 'lobby-head' },
      el('div', { class: 'brand' }, el('span', { class: 'brand-logo' }, '牌神擂台'), PK.OFFLINE ? el('span', { class: 'tag' }, '單機試玩版') : null),
      el('div', { class: 'me' },
        el('div', { class: 'avatar' }, u.name.slice(0, 1)),
        el('div', { class: 'me-info' }, el('div', { class: 'me-name' }, u.name, ' ', PK.badge(u.level)),
          el('div', { class: 'me-chips' }, '🪙 ', el('span', { 'data-chips': '' }, PK.fmt(u.chips)), el('span', { class: 'muted' }, '（虛擬計分）')))));
    const tools = el('div', { class: 'lobby-tools' },
      el('button', { class: 'btn ghost', onclick: showBoard }, '🏆 排行榜'),
      el('button', { class: 'btn ghost', onclick: showBadges }, '🎖️ 能力銘牌'),
      el('button', { class: 'btn ghost', onclick: PK.showDisclaimer }, '📜 製作聲明'),
      el('button', { class: 'btn ghost', onclick: () => { PK.muted = !PK.muted; PK.store.set('pk_muted', PK.muted); PK.toast(PK.muted ? '音效已關閉' : '音效已開啟'); } }, '🔊 音效'),
      el('button', { class: 'btn ghost', onclick: async () => { if (await PK.confirm('登出', '確定要登出嗎？')) { PK.logout(); showLogin(); } } }, '🚪 登出'));
    const tabs = el('div', { class: 'tabs' }, PK.CATS.map((c) => el('button', { class: 'tab' + (c.id === curCat ? ' on' : ''), onclick: () => { curCat = c.id; showLobby(); } }, c.name)));
    const grid = el('div', { class: 'game-grid' }, PK.GAMES.filter((g) => g.cat === curCat).map(gameCard));
    const challenge = el('div', { class: 'challenge-card', onclick: () => PK.modal('🏅 挑戰賽', '<p>挑戰賽會依照「菜鳥、入門、熟練、高手、精英、大師、宗師、牌神」八個等級，提供各式各樣的撲克牌玩法挑戰。</p><p>完成挑戰就能升級，並獲得對應顏色與特效的能力銘牌。</p><p class="muted">此功能將在後續階段開放。</p>') },
      el('div', { class: 'cc-icon' }, '🏅'), el('div', null, el('div', { class: 'cc-title' }, '挑戰賽'), el('div', { class: 'cc-sub' }, '八個等級・能力銘牌（後續開放）')));
    app().replaceChildren(el('div', { class: 'lobby' }, head, tools, challenge, tabs, grid,
      el('footer', { class: 'lobby-foot' }, '遊戲製作：Eric Hu　｜　僅供家人親友娛樂・禁止營利・籌碼為虛擬計分，嚴禁賭博')));
  }
  PK.showLobby = showLobby;

  function gameCard(g) {
    const th = g.theme;
    return el('div', { class: 'game-card', style: { background: th.bg, color: th.text, fontFamily: th.font }, onclick: () => { PK.sfx('click'); showSetup(g); } },
      el('div', { class: 'gc-deco' }, th.deco),
      el('div', { class: 'gc-icon' }, g.icon),
      el('div', { class: 'gc-name', style: { color: th.text } }, g.name),
      el('div', { class: 'gc-style', style: { background: th.accent, color: '#111' } }, g.style),
      el('div', { class: 'gc-meta' }, g.players[0] === g.players[1] ? g.players[0] + ' 人' : g.players[0] + '～' + g.players[1] + ' 人', g.casino ? '・籌碼' : ''),
      el('div', { class: 'gc-status ' + (g.ready ? 'ready' : 'dev') }, g.ready ? '可以玩' : '製作中'));
  }

  async function showBoard() {
    const list = await PK.leaderboard();
    const rows = list.map((r, i) => `<tr><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td>${escapeHtml(r.name)} <span class="badge-mini lv${r.level || 0}">${PK.LEVELS[r.level || 0].name}</span></td><td>${PK.fmt(r.chips)}</td><td>${r.wins}/${r.plays}</td></tr>`).join('');
    PK.modal('🏆 排行榜', `<table class="board"><tr><th>名次</th><th>玩家</th><th>籌碼</th><th>勝／場</th></tr>${rows || '<tr><td colspan=4>還沒有紀錄</td></tr>'}</table><p class="muted">籌碼為虛擬計分，無現金價值。${PK.OFFLINE ? '單機版只會顯示這台裝置上的玩家。' : ''}</p>`);
  }
  function showBadges() {
    const box = el('div', { class: 'badge-show' }, PK.LEVELS.map((L, i) => el('div', { class: 'badge-row' }, PK.badge(i), el('span', null, ['灰色・無特效', '綠色・微光', '藍色・水波流動', '紫色・閃電環繞', '橙色・火焰邊框', '金色・金光閃耀', '紅色・龍紋盤繞', '彩虹・全彩流光'][i]))));
    PK.modal('🎖️ 能力銘牌一覽', box);
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  PK.escapeHtml = escapeHtml;

  /* ---------- 遊戲設定（比照成語擂台：真人／電腦對戰） ---------- */
  function applyTheme(g) {
    const t = g.theme, s = document.body.style;
    document.body.className = 'game-body theme-' + g.id + ' back-' + t.back;
    s.setProperty('--bg', t.bg); s.setProperty('--felt', t.felt); s.setProperty('--accent', t.accent);
    s.setProperty('--accent2', t.accent2); s.setProperty('--text', t.text); s.setProperty('--font', t.font);
  }
  PK.applyTheme = applyTheme;

  function showSetup(g) {
    applyTheme(g);
    const cfg = PK.store.get('pk_cfg_' + g.id, { mode: 'party', ai: Math.min(3, g.players[1] - 1), diff: 1 });
    const maxAI = Math.min(4, g.players[1] - 1), minAI = Math.max(g.players[0] - 1, g.players[0] === 1 ? 0 : 1);
    cfg.ai = PK.clamp(cfg.ai, minAI, maxAI);
    const seg = (key, opts) => el('div', { class: 'seg' }, opts.map(([v, t]) => el('button', { class: 'seg-b' + (cfg[key] === v ? ' on' : ''), onclick: (e) => { PK.sfx('click'); cfg[key] = v; PK.$$('.seg-b', e.target.parentNode).forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); } }, t)));
    const aiOpts = []; for (let i = minAI; i <= maxAI; i++) aiOpts.push([i, i + ' 位']);
    const ready = !!PK.IMPL[g.id];
    app().replaceChildren(el('div', { class: 'setup' },
      el('div', { class: 'setup-top' },
        el('button', { class: 'btn ghost', onclick: showLobby }, '← 返回大廳'),
        el('button', { class: 'btn ghost', onclick: () => PK.showRules(g) }, '📖 遊戲說明')),
      el('div', { class: 'setup-hero' }, el('div', { class: 'setup-icon' }, g.icon), el('h2', null, g.name), el('div', { class: 'setup-style' }, '畫面風格：' + g.style)),
      g.casino ? el('div', { class: 'casino-strip' }, '籌碼為虛擬計分，無現金價值，嚴禁賭博') : null,
      el('div', { class: 'setup-panel' },
        el('div', { class: 'setup-row' }, el('label', null, '對戰方式'),
          el('div', { class: 'seg' }, el('button', { class: 'seg-b on' }, '🤖 電腦對戰'), el('button', { class: 'seg-b disabled', onclick: () => PK.toast('真人連線對戰（含文字聊天與即時語音）將在後續階段開放') }, '👥 真人連線'))),
        el('div', { class: 'setup-row' }, el('label', null, '遊戲模式'), seg('mode', [['classic', '經典模式'], ['party', '狂歡模式（技能＋特效）']])),
        maxAI > 0 ? el('div', { class: 'setup-row' }, el('label', null, '電腦對手'), seg('ai', aiOpts)) : null,
        el('div', { class: 'setup-row' }, el('label', null, '電腦難度'), seg('diff', [[0, '簡單'], [1, '普通'], [2, '困難']]))),
      el('button', { class: 'btn primary huge', onclick: () => {
        if (!ready) { PK.modal(g.name, `<p>「${g.name}」正在製作中，之後的階段會陸續完成。</p><p>可以先看看遊戲說明，或先試玩「十點半」。</p>`); return; }
        PK.store.set('pk_cfg_' + g.id, cfg); startGame(g, cfg);
      } }, ready ? '開始遊戲' : '製作中，敬請期待'),
      el('div', { class: 'setup-foot' }, '遊戲製作：Eric Hu')));
  }
  PK.showSetup = showSetup;

  /* ---------- 牌桌共用框架 ---------- */
  function startGame(g, cfg) {
    applyTheme(g);
    const AI_NAMES = ['阿福', '小美', '老王', '阿珠', '大雄', '春嬌', '志明', '阿嬤', '小胖', '阿德'];
    const AI_AV = ['🐵', '🐱', '🐶', '🐼', '🦊', '🐯', '🐸', '🐷'];
    const names = PK.shuffle(AI_NAMES.slice()), avs = PK.shuffle(AI_AV.slice());
    const players = [{ name: PK.user.name, isAI: false, avatar: PK.user.name.slice(0, 1), level: PK.user.level }];
    for (let i = 0; i < cfg.ai; i++) players.push({ name: names[i], isAI: true, avatar: avs[i], level: PK.randInt(0, 3) });

    const chatLog = el('div', { class: 'chat-log' });
    const chatIn = el('input', { placeholder: '輸入訊息…', maxlength: 60 });
    const sendChat = () => { const t = chatIn.value.trim(); if (!t) return; chatIn.value = ''; table.say(players[0], t); setTimeout(() => { if (Math.random() < 0.6) { const ai = PK.pick(players.filter((p) => p.isAI)); ai && table.say(ai, PK.pick(['哈哈哈', '我也這麼覺得', '專心玩牌啦！', '你今天手氣不錯喔', '👍', '等一下看我的'])); } }, PK.randInt(700, 1800)); };
    chatIn.addEventListener('keydown', (e) => e.key === 'Enter' && sendChat());
    const quick = ['好牌！', '快一點啦', '嚇死我了', '再來一局', '哈哈哈', '😭'];
    const chat = el('aside', { class: 'chat' },
      el('div', { class: 'chat-head' }, '💬 聊天', el('button', { class: 'chat-close', onclick: () => chat.classList.remove('open') }, '✕')),
      chatLog,
      el('div', { class: 'chat-quick' }, quick.map((q) => el('button', { onclick: () => { chatIn.value = q; sendChat(); } }, q))),
      el('div', { class: 'chat-in' }, chatIn, el('button', { class: 'btn primary', onclick: sendChat }, '送出')),
      el('div', { class: 'voice-row' }, el('button', { class: 'btn ghost small', onclick: () => PK.toast('即時語音將在真人連線版開放') }, '🎤 語音（連線版開放）')));

    const board = el('div', { class: 'table-area' });
    const topbar = el('div', { class: 'topbar' },
      el('button', { class: 'btn ghost small', onclick: async () => { if (await PK.confirm('離開牌桌', '確定要回到上一層嗎？本局進度不會保留。')) { table.destroy(); showSetup(g); } } }, '← 返回'),
      el('div', { class: 'tb-title' }, g.icon + ' ' + g.name, el('span', { class: 'tb-mode' }, cfg.mode === 'party' ? '狂歡模式' : '經典模式')),
      el('div', { class: 'tb-right' },
        el('span', { class: 'tb-chips' }, '🪙 ', el('span', { 'data-chips': '' }, PK.fmt(PK.user.chips))),
        el('button', { class: 'btn ghost small', onclick: () => PK.showRules(g) }, '📖'),
        el('button', { class: 'btn ghost small chat-btn', onclick: () => { chat.classList.toggle('open'); chatBtnDot.classList.remove('on'); } }, '💬', el('span', { class: 'dot' })),
      ));
    const chatBtnDot = PK.$('.dot', topbar);
    const root = el('div', { class: 'game-screen' }, topbar, g.casino ? el('div', { class: 'casino-strip' }, '籌碼為虛擬計分，無現金價值，嚴禁賭博') : null, el('div', { class: 'game-main' }, board, chat));
    app().replaceChildren(root);

    let alive = true; const timers = new Set();
    const table = {
      g, cfg, players, board, root, isParty: cfg.mode === 'party', diff: cfg.diff,
      get alive() { return alive; },
      say(p, text) {
        const line = el('div', { class: 'chat-line' + (p.isAI ? '' : ' me') }, el('b', null, p.name), '：', text);
        chatLog.append(line); chatLog.scrollTop = chatLog.scrollHeight;
        if (!chat.classList.contains('open')) chatBtnDot.classList.add('on');
        const seat = p.seatEl && PK.$('.bubble-anchor', p.seatEl);
        if (seat) { const b = el('div', { class: 'bubble' }, text); seat.replaceChildren(b); setTimeout(() => b.remove(), 2600); }
      },
      sys(text) { chatLog.append(el('div', { class: 'chat-line sys' }, text)); chatLog.scrollTop = chatLog.scrollHeight; },
      wait(ms) { return new Promise((r, j) => { const t = setTimeout(() => { timers.delete(t); alive ? r() : j(new Error('closed')); }, ms); timers.add(t); }); },
      destroy() { alive = false; timers.forEach(clearTimeout); },
      /* 座位：頭像＋名字＋銘牌，點擊可以丟表情 */
      seat(p, extra) {
        const s = el('div', { class: 'seat' + (p.isAI ? '' : ' me') },
          el('div', { class: 'bubble-anchor' }),
          el('div', { class: 'seat-av' }, p.avatar),
          el('div', { class: 'seat-name' }, p.name), PK.badge(p.level), extra || null);
        p.seatEl = s;
        if (p.isAI) s.addEventListener('click', () => table.emojiPicker(p));
        return s;
      },
      emojiPicker(target) {
        const me = players[0];
        const em = ['🍅', '❤️', '💣', '👍', '🌹', '🥚', '🍺'];
        const box = el('div', { class: 'emoji-pick' }, em.map((e) => el('button', { onclick: () => { wrap.remove(); PK.fx.throwEmoji(me.seatEl, target.seatEl, e); setTimeout(() => { if (Math.random() < 0.5) { PK.fx.throwEmoji(target.seatEl, me.seatEl, PK.pick(em)); table.say(target, PK.pick(['丟我？還你！', '哼！', '謝啦～', '😤'])); } }, 1200); } }, e)));
        const wrap = el('div', { class: 'emoji-wrap', onclick: (e) => e.target === wrap && wrap.remove() }, el('div', { class: 'emoji-title' }, '丟表情給 ' + target.name), box);
        document.body.append(wrap);
      },
    };
    table.sys('歡迎來到 ' + g.name + '！點擊對手的頭像可以丟表情。');
    PK.current = table;
    PK.IMPL[g.id].start(table).catch((e) => { if (e.message !== 'closed') { console.error(e); PK.toast('發生錯誤：' + e.message); } });
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
