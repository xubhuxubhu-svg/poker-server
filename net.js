/* 牌神擂台 — 真人連線（房間、同步、聊天、即時語音） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el;
  const N = (PK.net = { ws: null, ready: false, room: null, table: null, handlers: {} });
  let helloWait = null;

  /* ---------- 連線 ---------- */
  N.connect = function () {
    if (N.ws && (N.ws.readyState === 0 || N.ws.readyState === 1)) return helloWait;
    N.ready = false;
    helloWait = new Promise((resolve, reject) => {
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      N.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name: PK.user.name, token: PK.user.token }));
      ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'welcome') { N.ready = true; resolve(); } else if (m.t === 'error' && !N.ready) reject(new Error(m.msg)); onMsg(m); };
      ws.onclose = () => { N.ready = false; if (N.table && N.table.alive) N.table.sys('⚠️ 和伺服器的連線中斷了'); if (N.room && !N.table) PK.toast('連線中斷，請重新進入房間'); N.room = null; PK.vc.leave(true); reject(new Error('連不上伺服器')); };
    });
    return helloWait;
  };
  const tx = (m) => { if (N.ws && N.ws.readyState === 1) N.ws.send(JSON.stringify(m)); };
  N.tx = tx;

  /* ---------- 遊戲中：每位真人一個佇列，照順序取出決定 ---------- */
  N.attach = function (t) { N.table = t; N.q = {}; N.waiters = {}; N.gone = new Set(); N.sums = { mine: {}, theirs: {} }; N.warned = false; };
  N.detach = function (t) { if (N.table === t) N.table = null; };
  N.send = (seat, r) => tx({ t: 'act', seat, r: PK.pack(r) });
  N.next = (seat) => new Promise((resolve) => {
    const q = (N.q[seat] = N.q[seat] || []);
    if (q.length) return resolve(PK.unpack(q.shift()));
    if (N.gone.has(seat)) return resolve({ type: 'timeout' });
    N.waiters[seat] = (v) => resolve(v == null ? { type: 'timeout' } : PK.unpack(v));
  });
  N.chat = (text) => tx({ t: 'chat', text });
  N.emoji = (from, to, e) => tx({ t: 'emoji', from, to, e });
  N.leaveRoom = () => { tx({ t: 'leave' }); N.room = null; PK.vc.leave(); };
  /* 同步檢查：每局結算時比對大家的遊戲狀態 */
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  N.stateHash = (t) => hash(JSON.stringify(t.players.map((p) => [p.cards && p.cards.map((c) => c.id).join(','), p.hole && p.hole.map((c) => c.id).join(','), p.stack, p.score, p.total, p.got, p.tricks, p.won && p.won.length, p.covered && p.covered.length])) + '|' + PK.deckGen);
  N.sum = function (t) {
    t._sumN = (t._sumN || 0) + 1;
    const st = t.players.map((p) => [p.cards && p.cards.map((c) => c.id).join(','), p.hole && p.hole.map((c) => c.id).join(','), p.stack, p.score, p.total, p.got, p.tricks, p.won && p.won.length, p.covered && p.covered.length]);
    const raw = JSON.stringify(st) + '|' + PK.deckGen + '|' + Math.random().toFixed(6);
    const h = hash(raw);
    if (window.PK_DEBUG) console.error('SUMRAW ' + t._sumN + ' ' + raw);
    N.sums.mine[t._sumN] = h; tx({ t: 'sum', round: t._sumN, hash: h }); check(t._sumN);
  };
  const check = (round) => {
    const mine = N.sums.mine[round], th = N.sums.theirs[round];
    if (!mine || !th) return;
    for (const [name, h] of th) if (h !== mine && !N.warned) { N.warned = true; console.error('DESYNC', round, name, h, mine); if (N.table) N.table.sys('⚠️ 和 ' + name + ' 的遊戲資料不同步，建議重新開房'); }
  };

  /* ---------- 收到伺服器訊息 ---------- */
  function onMsg(m) {
    const t = N.table;
    switch (m.t) {
      case 'rooms': if (N.handlers.rooms) N.handlers.rooms(m.list); break;
      case 'room': N.room = m.room; if (N.handlers.room) N.handlers.room(m.room); PK.vc.syncMembers(m.room.members.map((x) => x.name)); break;
      case 'left': N.room = null; break;
      case 'error': PK.toast(m.msg, 3000); break;
      case 'start': if (N.handlers.start) N.handlers.start(m); break;
      case 'act': {
        const q = (N.q[m.seat] = N.q[m.seat] || []);
        if (N.waiters[m.seat]) { const w = N.waiters[m.seat]; delete N.waiters[m.seat]; w(m.r); } else q.push(m.r);
        break;
      }
      case 'gone':
        N.gone.add(m.seat);
        if (N.waiters[m.seat]) { const w = N.waiters[m.seat]; delete N.waiters[m.seat]; w(null); }
        if (t) { t.sys('👋 ' + m.name + ' 離開了，之後改由電腦自動代打'); const p = t.players[m.seat]; if (p) { p.boxEl && p.boxEl.classList.add('gone'); } }
        PK.vc.drop(m.name);
        break;
      case 'chat':
        if (t && t.alive) { const p = t.players.find((x) => x.name === m.name); if (p) t.say(p, m.text); }
        else if (N.handlers.chat) N.handlers.chat(m.name, m.text);
        break;
      case 'emoji': if (t && t.alive) { const a = t.players[m.from], b = t.players[m.to]; if (a && b) PK.fx.throwEmoji(a.seatEl, b.seatEl, m.e); } break;
      case 'sum': { const s = (N.sums.theirs[m.round] = N.sums.theirs[m.round] || new Map()); s.set(m.name, m.hash); check(m.round); break; }
      case 'x': if (t && t.alive && t.onX) t.onX(m); break;
      case 'rtc': PK.vc.signal(m.from, m.data); break;
      case 'voice': PK.vc.remoteState(m.name, m.on); break;
    }
  }

  /* ---------- 連線大廳 ---------- */
  PK.showOnline = async function (g, cfg) {
    cfg = cfg || PK.store.get('pk_cfg_' + g.id, { mode: 'party', diff: 1 });
    PK.applyTheme(g);
    const app = PK.$('#app');
    app.replaceChildren(el('div', { class: 'setup' }, el('div', { class: 'round-info' }, '連線中…')));
    try { await N.connect(); } catch (e) { app.replaceChildren(el('div', { class: 'setup' }, el('h2', null, '連不上伺服器'), el('p', null, e.message), el('button', { class: 'btn primary', onclick: () => PK.showOnline(g, cfg) }, '再試一次'), el('button', { class: 'btn', onclick: () => PK.showSetup(g) }, '返回'))); return; }
    const listEl = el('div', { class: 'ol-list' });
    const sizes = []; for (let i = Math.max(2, g.players[0]); i <= g.players[1]; i++) sizes.push(i);
    let size = PK.store.get('pk_olsize_' + g.id, Math.min(4, g.players[1]));
    if (!sizes.includes(size)) size = sizes[sizes.length - 1];
    const sizeSeg = el('div', { class: 'seg' }, sizes.map((v) => el('button', { class: 'seg-b' + (v === size ? ' on' : ''), onclick: (e) => { size = v; PK.store.set('pk_olsize_' + g.id, v); PK.$$('.seg-b', sizeSeg).forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); } }, v + ' 人')));
    const codeIn = el('input', { class: 'ol-code', placeholder: '輸入 4 位數房號', maxlength: 4, inputmode: 'numeric' });
    const renderList = (list) => listEl.replaceChildren(...(list.length ? list.map((r) => el('div', { class: 'ol-room' },
      el('div', null, el('b', null, '房號 ' + r.code), '　房主：' + r.host, el('div', { class: 'muted' }, (r.mode === 'party' ? '狂歡模式' : '經典模式') + '・' + ['簡單', '普通', '困難'][r.diff] + '・' + r.members.length + ' / ' + r.size + ' 人：' + r.members.map((x) => x.name).join('、'))),
      el('button', { class: 'btn primary', onclick: () => tx({ t: 'join', code: r.code }) }, '加入'))) : [el('div', { class: 'muted' }, '目前沒有等待中的房間，可以自己建立一個，再把房號告訴家人。')]));
    N.handlers.rooms = renderList;
    N.handlers.room = (room) => showRoom(g, room);
    N.handlers.start = (m) => startOnline(g, m);
    app.replaceChildren(el('div', { class: 'setup online' },
      el('div', { class: 'setup-top' }, el('button', { class: 'btn ghost', onclick: () => { N.handlers = {}; tx({ t: 'list', game: '' }); PK.showSetup(g); } }, '← 返回'), el('button', { class: 'btn ghost', onclick: () => PK.showRules(g) }, '📖 遊戲說明')),
      el('div', { class: 'setup-hero' }, el('div', { class: 'setup-icon' }, '👥'), el('h2', null, g.name + '・真人連線'), el('div', { class: 'setup-style' }, '和家人親友一起玩，可以文字聊天和即時語音')),
      el('div', { class: 'setup-panel' },
        el('div', { class: 'setup-row' }, el('label', null, '總人數'), sizeSeg),
        el('div', { class: 'setup-row' }, el('label', null, '模式'), el('span', null, (cfg.mode === 'party' ? '狂歡模式' : '經典模式') + '・電腦難度' + ['簡單', '普通', '困難'][cfg.diff] + '（在上一頁更改）')),
        el('div', { class: 'setup-row' }, el('button', { class: 'btn primary big', onclick: () => tx({ t: 'create', game: g.id, mode: cfg.mode, diff: cfg.diff, size }) }, '＋ 建立房間'), el('span', { class: 'muted' }, '空位會在開始時由電腦補上'))),
      el('div', { class: 'setup-panel' }, el('div', { class: 'setup-row' }, el('label', null, '用房號加入'), codeIn, el('button', { class: 'btn', onclick: () => codeIn.value.trim() && tx({ t: 'join', code: codeIn.value.trim() }) }, '加入'))),
      el('h3', { class: 'ol-h' }, '等待中的房間'), listEl,
      el('div', { class: 'setup-foot' }, '遊戲製作：Eric Hu')));
    tx({ t: 'list', game: g.id });
  };

  function showRoom(g, room) {
    if (N.table && N.table.alive) return;
    const app = PK.$('#app');
    const isHost = room.host === PK.user.name;
    const chatLog = el('div', { class: 'chat-log ol-chat' });
    const chatIn = el('input', { placeholder: '輸入訊息…', maxlength: 60 });
    const say = () => { const v = chatIn.value.trim(); if (!v) return; chatIn.value = ''; chatLog.append(el('div', { class: 'chat-line me' }, el('b', null, PK.user.name), '：', v)); tx({ t: 'chat', text: v }); };
    chatIn.addEventListener('keydown', (e) => e.key === 'Enter' && say());
    N.handlers.chat = (name, text) => { chatLog.append(el('div', { class: 'chat-line' }, el('b', null, name), '：', text)); chatLog.scrollTop = chatLog.scrollHeight; PK.voice.say(name + '說，' + text, { pri: 1 }); };
    const seats = [];
    for (let i = 0; i < room.size; i++) {
      const m = room.members[i];
      seats.push(el('div', { class: 'ol-seat' + (m ? ' filled' : ''), 'data-name': m ? m.name : '' },
        el('div', { class: 'seat-av' }, m ? m.name.slice(0, 1) : '🤖'),
        el('div', null, m ? el('b', null, m.name + (m.name === room.host ? '（房主）' : '')) : el('span', { class: 'muted' }, '空位（開始時由電腦補上）'), m ? PK.badge(m.level) : '')));
    }
    const vbox = el('div', { class: 'voice-row' }); PK.vc.mount(vbox);
    app.replaceChildren(el('div', { class: 'setup online' },
      el('div', { class: 'setup-top' }, el('button', { class: 'btn ghost', onclick: () => { N.leaveRoom(); PK.showOnline(g); } }, '← 離開房間'), el('button', { class: 'btn ghost', onclick: () => PK.showRules(g) }, '📖 遊戲說明')),
      el('div', { class: 'ol-code-big' }, '房號 ', el('b', null, room.code)),
      el('div', { class: 'muted', style: { textAlign: 'center' } }, '把房號告訴家人，他們在「' + g.name + '・真人連線」輸入房號就能加入'),
      el('div', { class: 'setup-panel' }, el('div', { class: 'ol-seats' }, seats),
        el('div', { class: 'muted' }, (room.mode === 'party' ? '狂歡模式' : '經典模式') + '・電腦難度' + ['簡單', '普通', '困難'][room.diff])),
      isHost ? el('button', { class: 'btn primary huge', onclick: () => tx({ t: 'start' }) }, '開始遊戲（' + room.members.length + ' 位真人）') : el('div', { class: 'round-info', style: { textAlign: 'center', margin: '14px 0' } }, '等待房主開始遊戲…'),
      el('div', { class: 'setup-panel' }, el('div', { class: 'chat-head' }, '💬 房間聊天'), chatLog, el('div', { class: 'chat-in' }, chatIn, el('button', { class: 'btn primary', onclick: say }, '送出')), vbox)));
  }
  function startOnline(g, m) {
    const gg = PK.GAME[m.game] || g;
    N.handlers = {};
    PK.startGame(gg, { mode: m.mode, diff: m.diff, ai: 0 }, { players: m.players, mySeat: m.mySeat, seed: m.seed, net: N });
  }

  /* ================= 即時語音（瀏覽器之間直接傳送，伺服器只負責牽線） ================= */
  const VC = (PK.vc = { joined: false, stream: null, micOn: true, peers: new Map(), others: new Set(), members: [], muted: new Set(), ui: [] });
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  let actx = null;
  VC.syncMembers = (names) => { VC.members = names; for (const n of [...VC.peers.keys()]) if (!names.includes(n)) VC.drop(n); VC.render(); };
  VC.join = async function () {
    if (VC.joined) return;
    try { VC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { VC.stream = null; PK.toast('沒有取得麥克風權限，只能聽別人說話', 3200); }
    VC.joined = true; VC.micOn = !!VC.stream;
    tx({ t: 'voice', on: true });
    for (const n of VC.others) if (PK.user.name < n) VC.call(n);
    VC.render(); PK.toast('已加入語音');
  };
  VC.leave = function (silent) {
    if (!VC.joined) return;
    VC.joined = false;
    if (!silent) tx({ t: 'voice', on: false });
    for (const n of [...VC.peers.keys()]) VC.drop(n);
    if (VC.stream) VC.stream.getTracks().forEach((tr) => tr.stop());
    VC.stream = null; VC.others.clear(); VC.render();
  };
  VC.toggleMic = () => { if (!VC.stream) { PK.toast('沒有麥克風'); return; } VC.micOn = !VC.micOn; VC.stream.getAudioTracks().forEach((tr) => (tr.enabled = VC.micOn)); VC.render(); };
  VC.remoteState = (name, on) => { if (on) { VC.others.add(name); if (VC.joined && PK.user.name < name && !VC.peers.has(name)) VC.call(name); } else { VC.others.delete(name); VC.drop(name); } VC.render(); };
  const mkPeer = (name) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = { pc, pend: [], audio: null };
    VC.peers.set(name, peer);
    if (VC.stream) VC.stream.getTracks().forEach((tr) => pc.addTrack(tr, VC.stream)); else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = (e) => { if (e.candidate) tx({ t: 'rtc', to: name, data: { cand: e.candidate } }); };
    pc.ontrack = (e) => {
      const a = new Audio(); a.autoplay = true; a.srcObject = e.streams[0] || new MediaStream([e.track]); a.muted = VC.muted.has(name); a.play().catch(() => {});
      peer.audio = a; watchTalk(name, a.srcObject);
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { PK.toast('和 ' + name + ' 的語音連不上（可能是網路限制）', 3200); } VC.render(); };
    return peer;
  };
  VC.call = async (name) => { const p = mkPeer(name); const o = await p.pc.createOffer(); await p.pc.setLocalDescription(o); tx({ t: 'rtc', to: name, data: { sdp: p.pc.localDescription } }); };
  VC.signal = async (from, d) => {
    if (!VC.joined) return;
    let p = VC.peers.get(from);
    if (d.sdp) {
      if (d.sdp.type === 'offer') { if (p) VC.drop(from); p = mkPeer(from); VC.others.add(from); await p.pc.setRemoteDescription(d.sdp); const a = await p.pc.createAnswer(); await p.pc.setLocalDescription(a); tx({ t: 'rtc', to: from, data: { sdp: p.pc.localDescription } }); }
      else if (p) await p.pc.setRemoteDescription(d.sdp);
      if (p) { for (const c of p.pend) await p.pc.addIceCandidate(c).catch(() => {}); p.pend = []; }
    } else if (d.cand && p) { if (p.pc.remoteDescription) await p.pc.addIceCandidate(d.cand).catch(() => {}); else p.pend.push(d.cand); }
    VC.render();
  };
  VC.drop = (name) => { const p = VC.peers.get(name); if (!p) return; try { p.pc.close(); } catch (e) {} if (p.audio) p.audio.srcObject = null; VC.peers.delete(name); VC.render(); };
  VC.mute = (name) => { if (VC.muted.has(name)) VC.muted.delete(name); else VC.muted.add(name); const p = VC.peers.get(name); if (p && p.audio) p.audio.muted = VC.muted.has(name); VC.render(); };
  /* 說話時頭像發光 */
  const watchTalk = (name, stream) => {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaStreamSource(stream), an = actx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        if (!VC.peers.has(name)) return;
        an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) * (v - 128);
        const talking = Math.sqrt(s / buf.length) > 6;
        const t = N.table; const pl = t && t.players.find((x) => x.name === name);
        if (pl && pl.seatEl) pl.seatEl.classList.toggle('talking', talking);
        PK.$$('.ol-seat[data-name="' + name + '"]').forEach((e) => e.classList.toggle('talking', talking));
        setTimeout(loop, 120);
      };
      loop();
    } catch (e) {}
  };
  VC.mount = (box) => { VC.ui = VC.ui.filter((b) => b.isConnected); VC.ui.push(box); VC.render(); };
  VC.render = () => {
    for (const box of VC.ui) {
      if (!VC.joined) { box.replaceChildren(el('button', { class: 'btn ghost small', onclick: VC.join }, '🎤 加入語音'), VC.others.size ? el('span', { class: 'muted' }, ' 有 ' + VC.others.size + ' 人在語音中') : ''); continue; }
      box.replaceChildren(
        el('div', { class: 'vc-row' },
          el('button', { class: 'btn small ' + (VC.micOn ? 'primary' : ''), onclick: VC.toggleMic }, VC.micOn ? '🎙️ 麥克風開' : '🔇 麥克風關'),
          el('button', { class: 'btn ghost small', onclick: () => VC.leave() }, '離開語音')),
        el('div', { class: 'vc-peers' }, [...VC.others].map((n) => { const p = VC.peers.get(n); const st = p ? p.pc.connectionState : 'new'; return el('button', { class: 'vc-peer' + (VC.muted.has(n) ? ' muted' : ''), onclick: () => VC.mute(n), title: '點一下可以靜音這個人' }, (VC.muted.has(n) ? '🔇 ' : '🔊 ') + n + (st === 'connected' ? '' : '（連線中）')); })));
    }
  };
})();
