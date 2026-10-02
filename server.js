/* 牌神擂台 伺服器 ｜ 遊戲製作：Eric Hu
   網頁、帳號登入、成績保存、排行榜、真人連線房間、文字聊天、語音信令。 */
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '100kb' }));
/* 所有檔案都放在同一層，只開放網頁需要的檔案（伺服器程式不會被看到） */
const PRIVATE = new Set(['server.js', 'build.py', 'package.json', 'package-lock.json', 'README.md']);
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/:file', (req, res, next) => {
  const f = req.params.file;
  if (PRIVATE.has(f) || !/^[\w.-]+\.(html|css|js|png|jpg|jpeg|gif|webp|svg|mp3|ogg|wav|ico|json)$/i.test(f)) return next();
  res.sendFile(path.join(__dirname, f), (err) => err && next());
});

/* 資料庫：有設定 DATABASE_URL 就用 Neon（與成語擂台、麻將共用），沒有就暫存在記憶體 */
let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}
const memDB = new Map();
async function init() {
  if (!pool) { console.log('沒有設定 DATABASE_URL，資料只暫存在記憶體'); return; }
  await pool.query(`CREATE TABLE IF NOT EXISTS poker_users (
    name TEXT PRIMARY KEY, salt TEXT NOT NULL, pw_hash TEXT NOT NULL, token TEXT,
    chips INTEGER NOT NULL DEFAULT 1000, level INTEGER NOT NULL DEFAULT 0,
    stats JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`);
}
async function getUser(name) {
  if (!pool) return memDB.get(name) || null;
  const r = await pool.query('SELECT * FROM poker_users WHERE name=$1', [name]);
  return r.rows[0] || null;
}
async function putUser(u) {
  if (!pool) { memDB.set(u.name, u); return; }
  await pool.query(`INSERT INTO poker_users (name,salt,pw_hash,token,chips,level,stats) VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (name) DO UPDATE SET token=$4,chips=$5,level=$6,stats=$7,updated_at=now()`,
    [u.name, u.salt, u.pw_hash, u.token, u.chips, u.level, JSON.stringify(u.stats)]);
}
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const pub = (u) => ({ name: u.name, chips: u.chips, level: u.level, stats: u.stats });
const newStats = () => ({ plays: 0, wins: 0, games: {}, challenge: 0 });
const bad = (res, msg, code) => res.status(code || 400).json({ error: msg });

app.post('/api/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim(), pw = String(req.body.pw || '');
    if (!name || name.length > 12) return bad(res, '玩家名稱請輸入 1～12 個字');
    if (pw.length < 4) return bad(res, '密碼至少 4 個字');
    if (await getUser(name)) return bad(res, '這個名稱已經有人使用');
    const salt = crypto.randomBytes(12).toString('hex');
    const u = { name, salt, pw_hash: hash(pw, salt), token: crypto.randomBytes(24).toString('hex'), chips: 1000, level: 0, stats: newStats() };
    await putUser(u);
    res.json({ user: pub(u), token: u.token });
  } catch (e) { console.error(e); bad(res, '伺服器錯誤', 500); }
});
app.post('/api/login', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim(), pw = String(req.body.pw || '');
    const u = await getUser(name);
    if (!u) return bad(res, '找不到這位玩家，請先註冊');
    if (u.pw_hash !== hash(pw, u.salt)) return bad(res, '密碼錯誤');
    u.token = crypto.randomBytes(24).toString('hex');
    await putUser(u);
    res.json({ user: pub(u), token: u.token });
  } catch (e) { console.error(e); bad(res, '伺服器錯誤', 500); }
});
async function auth(req, res) {
  const u = await getUser(String(req.body.name || ''));
  if (!u || !u.token || u.token !== req.body.token) { bad(res, '請重新登入', 401); return null; }
  return u;
}
app.post('/api/me', async (req, res) => { try { const u = await auth(req, res); if (u) res.json({ user: pub(u) }); } catch (e) { bad(res, '伺服器錯誤', 500); } });
app.post('/api/save', async (req, res) => {
  try {
    const u = await auth(req, res); if (!u) return;
    const chips = Math.max(0, Math.min(1e9, Math.round(Number(req.body.chips) || 0)));
    u.chips = chips < 10 ? 1000 : chips; // 虛擬籌碼用完免費補發
    if (req.body.stats && typeof req.body.stats === 'object') u.stats = req.body.stats;
    if (Number.isInteger(req.body.level)) u.level = Math.max(0, Math.min(7, req.body.level));
    await putUser(u);
    res.json({ ok: true });
  } catch (e) { console.error(e); bad(res, '伺服器錯誤', 500); }
});
app.get('/api/leaderboard', async (req, res) => {
  try {
    let list;
    if (!pool) list = [...memDB.values()];
    else list = (await pool.query('SELECT name,chips,level,stats FROM poker_users ORDER BY chips DESC LIMIT 50')).rows;
    list = list.map((u) => ({ name: u.name, chips: u.chips, level: u.level, wins: (u.stats || {}).wins || 0, plays: (u.stats || {}).plays || 0 }))
      .sort((a, b) => b.chips - a.chips).slice(0, 50);
    res.json({ list });
  } catch (e) { console.error(e); bad(res, '伺服器錯誤', 500); }
});
app.get('/healthz', (req, res) => res.send('ok'));

/* ================= 真人連線：房間、遊戲同步、聊天、語音信令 ================= */
const http = require('http');
const { WebSocketServer } = require('ws');
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map();
const AI_NAMES = ['阿福', '小美', '老王', '阿珠', '大雄', '春嬌', '志明', '阿嬤', '小胖', '阿德'];
const AI_AV = ['🐵', '🐱', '🐶', '🐼', '🦊', '🐯', '🐸', '🐷'];
const TEAM = new Set(['spades', 'bridge']);
const send = (ws, m) => { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); } catch (e) {} };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const roomInfo = (r) => ({ code: r.code, game: r.game, mode: r.mode, diff: r.diff, size: r.size, host: r.host, started: r.started, members: r.members.map((m) => ({ name: m.name, level: m.level })) });
const listFor = (game) => [...rooms.values()].filter((r) => r.game === game && !r.started).map(roomInfo);
const pushList = (game) => wss.clients.forEach((c) => { if (c.lobbyGame === game && !c.room) send(c, { t: 'rooms', list: listFor(game) }); });
const toRoom = (r, m, except) => r.members.forEach((x) => { if (x.ws !== except) send(x.ws, m); });

function leaveRoom(ws) {
  const r = ws.room; if (!r) return;
  ws.room = null;
  const i = r.members.findIndex((m) => m.ws === ws);
  if (i < 0) return;
  if (!r.started) {
    r.members.splice(i, 1);
    if (!r.members.length) rooms.delete(r.code);
    else { if (r.host === ws.name) r.host = r.members[0].name; toRoom(r, { t: 'room', room: roomInfo(r) }); }
  } else {
    const m = r.members[i]; m.ws = null; m.gone = true;
    toRoom(r, { t: 'gone', seat: m.seat, name: m.name });
    if (r.members.every((x) => x.gone)) rooms.delete(r.code);
  }
  pushList(r.game);
}

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', async (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    try {
      if (m.t === 'hello') {
        const u = await getUser(String(m.name || ''));
        if (!u || !u.token || u.token !== m.token) return send(ws, { t: 'error', msg: '請重新登入' });
        ws.name = u.name; ws.level = u.level || 0;
        return send(ws, { t: 'welcome' });
      }
      if (!ws.name) return send(ws, { t: 'error', msg: '請先登入' });
      const r = ws.room;
      switch (m.t) {
        case 'list': ws.lobbyGame = String(m.game); send(ws, { t: 'rooms', list: listFor(ws.lobbyGame) }); break;
        case 'create': {
          leaveRoom(ws);
          let code; do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(code));
          const nr = { code, game: String(m.game), mode: m.mode === 'classic' ? 'classic' : 'party', diff: Math.max(0, Math.min(2, m.diff | 0)), size: Math.max(1, Math.min(6, m.size | 0)), host: ws.name, started: false, members: [{ name: ws.name, level: ws.level, ws }] };
          rooms.set(code, nr); ws.room = nr;
          send(ws, { t: 'room', room: roomInfo(nr) }); pushList(nr.game); break;
        }
        case 'join': {
          const jr = rooms.get(String(m.code));
          if (!jr) return send(ws, { t: 'error', msg: '找不到這個房間' });
          if (jr.started) return send(ws, { t: 'error', msg: '這個房間已經開始遊戲了' });
          if (jr.members.length >= jr.size) return send(ws, { t: 'error', msg: '房間已經滿了' });
          if (jr.members.some((x) => x.name === ws.name)) return send(ws, { t: 'error', msg: '你已經在這個房間裡' });
          leaveRoom(ws);
          jr.members.push({ name: ws.name, level: ws.level, ws }); ws.room = jr;
          toRoom(jr, { t: 'room', room: roomInfo(jr) }); pushList(jr.game); break;
        }
        case 'leave': leaveRoom(ws); send(ws, { t: 'left' }); break;
        case 'start': {
          if (!r || r.started || r.host !== ws.name) return;
          const n = r.size, hs = r.members.length;
          const order = TEAM.has(r.game) && n === 4 ? (hs === 2 ? [0, 2] : hs === 3 ? [0, 1, 2] : [0, 1, 2, 3]) : r.members.map((_, i) => i);
          const players = Array(n).fill(null);
          r.members.forEach((x, i) => { x.seat = order[i]; players[order[i]] = { name: x.name, level: x.level }; });
          const names = shuffle(AI_NAMES.filter((x) => !r.members.some((y) => y.name === x))), avs = shuffle(AI_AV.slice());
          let k = 0; for (let i = 0; i < n; i++) if (!players[i]) { players[i] = { name: names[k], ai: true, avatar: avs[k], level: Math.floor(Math.random() * 4) }; k++; }
          r.started = true; r.seed = Math.floor(Math.random() * 4294967295);
          r.members.forEach((x) => send(x.ws, { t: 'start', seed: r.seed, players, mySeat: x.seat, game: r.game, mode: r.mode, diff: r.diff }));
          pushList(r.game); break;
        }
        case 'act': { if (!r || !r.started) return; const me = r.members.find((x) => x.ws === ws); if (!me || me.seat !== m.seat) return; toRoom(r, { t: 'act', seat: m.seat, r: m.r }, ws); break; }
        case 'chat': { if (!r) return; const me = r.members.find((x) => x.ws === ws); toRoom(r, { t: 'chat', name: ws.name, seat: me && me.seat, text: String(m.text || '').slice(0, 60) }, ws); break; }
        case 'emoji': case 'sum': case 'x': { if (!r) return; const me = r.members.find((x) => x.ws === ws); toRoom(r, Object.assign({}, m, { seat: me && me.seat, name: ws.name }), ws); break; }
        case 'rtc': { if (!r) return; const to = r.members.find((x) => x.name === m.to); if (to) send(to.ws, { t: 'rtc', from: ws.name, data: m.data }); break; }
        case 'voice': {
          if (!r) return; const me = r.members.find((x) => x.ws === ws); if (me) me.voice = !!m.on;
          toRoom(r, { t: 'voice', name: ws.name, on: !!m.on }, ws);
          if (m.on) r.members.forEach((x) => { if (x.ws !== ws && x.voice && !x.gone) send(ws, { t: 'voice', name: x.name, on: true }); });
          break;
        }
      }
    } catch (e) { console.error(e); }
  });
  ws.on('close', () => leaveRoom(ws));
});
setInterval(() => wss.clients.forEach((ws) => { if (!ws.alive) return ws.terminate(); ws.alive = false; try { ws.ping(); } catch (e) {} }), 25000);

const PORT = process.env.PORT || 3000;
init().then(() => server.listen(PORT, () => console.log('牌神擂台 伺服器啟動：' + PORT))).catch((e) => { console.error(e); process.exit(1); });
