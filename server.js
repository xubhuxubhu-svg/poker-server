/* 牌神擂台 伺服器 ｜ 遊戲製作：Eric Hu
   第 1 階段：網頁、帳號登入、成績保存、排行榜。
   真人連線、文字聊天、即時語音會在後續階段加入。 */
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

const PORT = process.env.PORT || 3000;
init().then(() => app.listen(PORT, () => console.log('牌神擂台 伺服器啟動：' + PORT))).catch((e) => { console.error(e); process.exit(1); });
