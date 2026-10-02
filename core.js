/* 牌神擂台 — 平台核心 ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = (window.PK = window.PK || {});
  PK.VERSION = '0.1.0';
  PK.OFFLINE = !!window.PK_OFFLINE || location.protocol === 'file:';

  /* ---------- 小工具 ---------- */
  PK.$ = (s, r) => (r || document).querySelector(s);
  PK.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  PK.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  };
  PK.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  PK.rand = (a, b) => a + Math.random() * (b - a);
  PK.randInt = (a, b) => Math.floor(PK.rand(a, b + 1));
  PK.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  PK.shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  PK.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PK.fmt = (n) => Math.round(n).toLocaleString('zh-TW');

  /* ---------- 儲存（瀏覽器不允許時改用暫存） ---------- */
  const mem = {};
  PK.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) {} },
  };

  /* ---------- 伺服器連線 ---------- */
  PK.api = async function (path, body) {
    const r = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || '伺服器忙碌中，請稍後再試');
    return j;
  };

  /* ---------- 玩家帳號 ---------- */
  function hashPw(name, pw) { // 單機版簡易雜湊（伺服器版另有安全加密）
    let h = 2166136261; const s = name + '::' + pw + '::pk';
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  const START_CHIPS = 1000;
  PK.newStats = () => ({ plays: 0, wins: 0, games: {}, challenge: 0 });

  PK.user = null;
  PK.login = async function (name, pw, isRegister) {
    name = (name || '').trim(); pw = pw || '';
    if (!name || name.length > 12) throw new Error('玩家名稱請輸入 1～12 個字');
    if (pw.length < 4) throw new Error('密碼至少 4 個字');
    if (!PK.OFFLINE) {
      try {
        const u = await PK.api(isRegister ? 'register' : 'login', { name, pw });
        PK.user = u.user; PK.user.token = u.token; PK.store.set('pk_last', { name, token: u.token });
        return PK.user;
      } catch (e) {
        if (String(e.message).includes('Failed to fetch')) throw new Error('無法連到伺服器，請稍後再試');
        throw e;
      }
    }
    const users = PK.store.get('pk_users', {});
    if (isRegister) {
      if (users[name]) throw new Error('這個名稱已經有人使用');
      users[name] = { name, pw: hashPw(name, pw), chips: START_CHIPS, stats: PK.newStats(), level: 0 };
    } else {
      if (!users[name]) throw new Error('找不到這位玩家，請先註冊');
      if (users[name].pw !== hashPw(name, pw)) throw new Error('密碼錯誤');
    }
    PK.store.set('pk_users', users);
    PK.store.set('pk_last', { name });
    PK.user = Object.assign({}, users[name]); delete PK.user.pw;
    return PK.user;
  };
  PK.logout = function () { PK.user = null; PK.store.del('pk_last'); };
  PK.saveUser = async function () {
    const u = PK.user; if (!u) return;
    if (!PK.OFFLINE) {
      try { await PK.api('save', { name: u.name, token: u.token, chips: u.chips, stats: u.stats, level: u.level }); } catch (e) { console.warn(e); }
      return;
    }
    const users = PK.store.get('pk_users', {});
    if (users[u.name]) { users[u.name].chips = u.chips; users[u.name].stats = u.stats; users[u.name].level = u.level; PK.store.set('pk_users', users); }
  };
  /* 籌碼：虛擬計分，用完免費補發 */
  PK.addChips = function (n) {
    PK.user.chips = Math.max(0, Math.round(PK.user.chips + n));
    let refilled = false;
    if (PK.user.chips < 10) { PK.user.chips = START_CHIPS; refilled = true; }
    PK.updateChipDisplays();
    return refilled;
  };
  PK.updateChipDisplays = () => PK.$$('[data-chips]').forEach((e) => (e.textContent = PK.fmt(PK.user.chips)));
  PK.recordGame = function (gameId, won, chipsDelta) {
    const s = PK.user.stats; s.plays++; if (won) s.wins++;
    const g = (s.games[gameId] = s.games[gameId] || { plays: 0, wins: 0, best: 0 });
    g.plays++; if (won) g.wins++; if (chipsDelta > g.best) g.best = chipsDelta;
  };
  PK.leaderboard = async function () {
    if (!PK.OFFLINE) { try { return (await PK.api('leaderboard')).list; } catch (e) { return []; } }
    const users = PK.store.get('pk_users', {});
    return Object.values(users).map((u) => ({ name: u.name, chips: u.chips, wins: u.stats.wins, plays: u.stats.plays, level: u.level || 0 }))
      .sort((a, b) => b.chips - a.chips).slice(0, 50);
  };

  /* ---------- 撲克牌 ---------- */
  PK.SUITS = { S: '♠', H: '♥', D: '♦', C: '♣' };
  PK.SUIT_NAME = { S: '黑桃', H: '紅心', D: '方塊', C: '梅花' };
  PK.RANK_TXT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  PK.makeDeck = function (opt) {
    opt = opt || {}; const d = []; const n = opt.decks || 1;
    for (let k = 0; k < n; k++) {
      for (const s of 'SHDC') for (let r = 1; r <= 13; r++) d.push({ r, s, id: k + s + r });
      if (opt.jokers) { d.push({ r: 0, s: 'J', id: k + 'JK1', joker: 'big' }); d.push({ r: 0, s: 'J', id: k + 'JK2', joker: 'small' }); }
    }
    return PK.shuffle(d);
  };
  PK.isRed = (c) => c.s === 'H' || c.s === 'D' || c.joker === 'big';
  PK.cardName = (c) => (c.joker ? (c.joker === 'big' ? '大鬼' : '小鬼') : PK.SUIT_NAME[c.s] + PK.RANK_TXT[c.r]);

  const FACE_ICON = { 11: '♞', 12: '♛', 13: '♚' };
  PK.cardEl = function (c, faceUp, opts) {
    opts = opts || {};
    const e = PK.el('div', { class: 'card' + (opts.small ? ' sm' : '') + (faceUp ? '' : ' back') });
    if (faceUp && c) {
      e.classList.add(PK.isRed(c) ? 'red' : 'black');
      if (c.joker) {
        e.innerHTML = `<div class="c-corner">JOKER</div><div class="c-mid joker">🃏</div>`;
      } else {
        const t = PK.RANK_TXT[c.r], s = PK.SUITS[c.s];
        const mid = c.r > 10 ? `<div class="c-mid face">${FACE_ICON[c.r]}</div>` : `<div class="c-mid">${s}</div>`;
        e.innerHTML = `<div class="c-corner">${t}<br>${s}</div>${mid}<div class="c-corner br">${t}<br>${s}</div>`;
      }
    } else {
      e.innerHTML = '<div class="c-back"></div>';
    }
    if (opts.hiddenMark) e.append(PK.el('div', { class: 'c-hidden-mark' }, '暗'));
    return e;
  };
  /* 發牌動畫：從來源元素飛到目標元素 */
  PK.flyCard = async function (fromEl, toEl, cardElem, ms) {
    ms = ms || 320;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const ghost = PK.cardEl(null, false); ghost.classList.add('fly');
    ghost.style.left = a.left + a.width / 2 - 28 + 'px'; ghost.style.top = a.top + a.height / 2 - 40 + 'px';
    document.body.append(ghost);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    ghost.animate([{ transform: 'translate(0,0) rotate(0) scale(.8)' }, { transform: `translate(${dx}px,${dy}px) rotate(${PK.rand(-20, 20)}deg) scale(1)` }], { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)' });
    PK.sfx('deal');
    await PK.sleep(ms);
    ghost.remove();
    if (cardElem) { toEl.append(cardElem); cardElem.classList.add('pop-in'); }
  };

  /* ---------- 音效（即時合成，背景音樂後續補上） ---------- */
  let actx = null;
  PK.muted = PK.store.get('pk_muted', false);
  function tone(freq, dur, type, vol, delay, slide) {
    if (PK.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + (delay || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function noise(dur, vol) {
    if (PK.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const b = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = actx.createBufferSource(), g = actx.createGain(); g.gain.value = vol || 0.2;
      s.buffer = b; s.connect(g); g.connect(actx.destination); s.start();
    } catch (e) {}
  }
  PK.sfx = function (n) {
    switch (n) {
      case 'deal': noise(0.06, 0.12); break;
      case 'click': tone(660, 0.06, 'triangle', 0.1); break;
      case 'chip': tone(1800, 0.05, 'square', 0.05); tone(2400, 0.05, 'square', 0.04, 0.04); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, i * 0.09)); break;
      case 'big': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, 'square', 0.08, i * 0.08)); break;
      case 'lose': tone(400, 0.4, 'sawtooth', 0.08, 0, 120); break;
      case 'bust': noise(0.35, 0.3); tone(200, 0.3, 'square', 0.08, 0, 60); break;
      case 'skill': tone(880, 0.25, 'sine', 0.12, 0, 1760); tone(1320, 0.2, 'sine', 0.08, 0.1); break;
      case 'event': [784, 988, 1175].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, i * 0.12)); break;
      case 'tick': tone(1000, 0.04, 'square', 0.05); break;
      case 'throw': tone(300, 0.2, 'sine', 0.1, 0, 900); break;
      case 'splat': noise(0.15, 0.25); break;
      case 'boom': noise(0.6, 0.4); tone(80, 0.5, 'sine', 0.3, 0, 30); break;
    }
  };

  /* ---------- 介面：提示與視窗 ---------- */
  PK.toast = function (msg, ms) {
    const t = PK.el('div', { class: 'toast' }, msg);
    (PK.$('#toasts') || document.body).append(t);
    setTimeout(() => t.classList.add('out'), ms || 2200);
    setTimeout(() => t.remove(), (ms || 2200) + 400);
  };
  PK.modal = function (title, content, buttons, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const close = (v) => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 200); resolve(v); };
      const body = PK.el('div', { class: 'modal-body' });
      if (typeof content === 'string') body.innerHTML = content; else if (content) body.append(content);
      const btns = PK.el('div', { class: 'modal-btns' },
        (buttons || [{ text: '關閉', value: true }]).map((b) => PK.el('button', { class: 'btn ' + (b.cls || ''), onclick: () => { PK.sfx('click'); close(b.value); } }, b.text)));
      const box = PK.el('div', { class: 'modal ' + (opts.cls || '') },
        PK.el('div', { class: 'modal-title' }, title, opts.noX ? null : PK.el('button', { class: 'modal-x', onclick: () => close(null), 'aria-label': '關閉' }, '✕')),
        body, btns);
      const wrap = PK.el('div', { class: 'modal-wrap' }, box);
      if (!opts.noX) wrap.addEventListener('click', (e) => { if (e.target === wrap) close(null); });
      document.body.append(wrap);
    });
  };
  PK.confirm = (title, msg) => PK.modal(title, msg, [{ text: '取消', value: false }, { text: '確定', value: true, cls: 'primary' }]);

  /* ---------- 能力銘牌 ---------- */
  PK.LEVELS = [
    { name: '菜鳥', cls: 'lv0' }, { name: '入門', cls: 'lv1' }, { name: '熟練', cls: 'lv2' }, { name: '高手', cls: 'lv3' },
    { name: '精英', cls: 'lv4' }, { name: '大師', cls: 'lv5' }, { name: '宗師', cls: 'lv6' }, { name: '牌神', cls: 'lv7' },
  ];
  PK.badge = (lv) => { const L = PK.LEVELS[PK.clamp(lv || 0, 0, 7)]; return PK.el('span', { class: 'badge ' + L.cls }, PK.el('span', { class: 'badge-txt' }, L.name)); };
})();
