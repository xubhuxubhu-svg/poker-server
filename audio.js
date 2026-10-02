/* 牌神擂台 — 背景音樂與語音 ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el;

  /* ---------- 背景音樂（隨機播放） ---------- */
  const TRACKS = [
    { file: 'bgm1.mp3', title: 'Upbeat Acoustic', artist: 'The_Mountain', site: 'Pixabay' },
    { file: 'bgm2.mp3', title: 'Upbeat Upbeat Music', artist: 'Gr0za', site: 'Pixabay' },
    { file: 'bgm3.mp3', title: 'Upbeat', artist: 'Kiravale', site: 'Pixabay' },
    { file: 'bgm4.mp3', title: 'Upbeat Music Happy Commercial', artist: 'Echoes_of_Lumen', site: 'Pixabay' },
    { file: 'bgm5.mp3', title: 'Upbeat', artist: 'Alex-Morgan', site: 'Pixabay' },
    { file: 'bgm6.mp3', title: '（曲名未標示）', artist: 'StockTune', site: 'StockTune' },
  ];
  const M = (PK.music = {
    tracks: TRACKS,
    on: PK.store.get('pk_music', true),
    vol: PK.store.get('pk_music_vol', 0.35),
    cur: -1, audio: null, started: false,
  });
  const srcOf = (f) => (window.PK_BGM_DATA && window.PK_BGM_DATA[f]) || f;
  M.next = function () {
    if (!M.on) return;
    let i; do { i = Math.floor(PK.nrand() * TRACKS.length); } while (TRACKS.length > 1 && i === M.cur);
    M.cur = i;
    if (!M.audio) { M.audio = new Audio(); M.audio.addEventListener('ended', M.next); M.audio.addEventListener('error', () => setTimeout(M.next, 1500)); }
    M.audio.src = srcOf(TRACKS[i].file); M.audio.volume = M.vol;
    M.audio.play().catch(() => {});
    PK.$$('[data-nowplaying]').forEach((e) => (e.textContent = M.nowText()));
  };
  M.nowText = () => (M.cur >= 0 && M.on ? '♪ ' + TRACKS[M.cur].title + ' － ' + TRACKS[M.cur].artist : '音樂已關閉');
  M.setOn = function (v) {
    M.on = v; PK.store.set('pk_music', v);
    if (!v) { if (M.audio) M.audio.pause(); } else if (M.audio && M.cur >= 0) M.audio.play().catch(() => {}); else M.next();
    PK.$$('[data-nowplaying]').forEach((e) => (e.textContent = M.nowText()));
  };
  M.setVol = function (v) { M.vol = v; PK.store.set('pk_music_vol', v); if (M.audio) M.audio.volume = v; };
  /* 瀏覽器規定要先點一下畫面才能播放聲音 */
  const unlock = () => {
    if (M.started) return; M.started = true;
    if (M.on) M.next();
    PK.voice.unlock();
  };
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });

  /* ---------- 語音（電腦語音合成） ---------- */
  const synth = window.speechSynthesis;
  const V = (PK.voice = { on: PK.store.get('pk_voice', true), vol: PK.store.get('pk_voice_vol', 1), voice: null, ok: !!synth });
  const pickVoice = () => {
    if (!synth) return;
    const vs = synth.getVoices();
    V.voice = vs.find((v) => /zh[-_]TW/i.test(v.lang)) || vs.find((v) => /zh[-_](HK|Hant)/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang)) || null;
  };
  if (synth) { pickVoice(); synth.addEventListener && synth.addEventListener('voiceschanged', pickVoice); }
  const clean = (s) => String(s).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}⬆⬇➡⬅]/gu, '').replace(/[！!？?]+/g, '！').replace(/\s+/g, ' ').trim();
  let lastText = '', lastAt = 0;
  /* pri：1＝聊天（忙碌時略過） 2＝一般 3＝重要（插隊） */
  V.say = function (text, o) {
    o = o || {};
    if (!V.on || !synth) return;
    const s = clean(text); if (!s) return;
    const now = Date.now();
    if (s === lastText && now - lastAt < 800) return;
    lastText = s; lastAt = now;
    const pri = o.pri || 2;
    if (pri === 1 && (synth.speaking || synth.pending)) return;
    if (pri >= 3 || (synth.pending && pri >= 2)) synth.cancel();
    try {
      const u = new SpeechSynthesisUtterance(s);
      u.lang = (V.voice && V.voice.lang) || 'zh-TW'; if (V.voice) u.voice = V.voice;
      u.rate = o.rate || 1.15; u.pitch = o.pitch || 1; u.volume = V.vol;
      synth.speak(u);
    } catch (e) {}
  };
  V.unlock = () => { if (synth && V.on) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch (e) {} } };
  V.setOn = (v) => { V.on = v; PK.store.set('pk_voice', v); if (!v && synth) synth.cancel(); };
  V.stop = () => { if (synth) synth.cancel(); };
  /* 撲克牌念法：黑桃A、紅心10、鬼牌 */
  const RW = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  PK.cardSpeech = (c) => (c.joker ? '鬼牌' : PK.SUIT_NAME[c.s] + RW[c.r]);
  V.card = (c, extra, pri) => V.say(PK.cardSpeech(c) + (extra ? '，' + extra : ''), { pri: pri || 2, rate: 1.25 });
  /* 電腦對手講話：每個角色聲音高低不同 */
  V.chat = (p, text) => { if (!p.voicePitch) p.voicePitch = 0.75 + PK.nrand() * 0.75; V.say(text, { pri: 1, pitch: p.voicePitch, rate: 1.2 }); };

  /* ---------- 聲音設定視窗 ---------- */
  PK.showSound = function () {
    const row = (label, ctl) => el('div', { class: 'snd-row' }, el('label', null, label), ctl);
    const tog = (on, fn) => { const b = el('button', { class: 'tog' + (on ? ' on' : ''), onclick: () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); b.textContent = v ? '開' : '關'; fn(v); } }, on ? '開' : '關'); return b; };
    const slider = (v, fn) => { const s = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: v }); s.addEventListener('input', () => fn(+s.value)); return s; };
    const box = el('div', { class: 'snd' },
      row('🎵 背景音樂', tog(M.on, M.setOn)), row('　音樂音量', slider(M.vol, M.setVol)),
      el('div', { class: 'snd-now' }, el('span', { 'data-nowplaying': '' }, M.nowText()), el('button', { class: 'btn small ghost', onclick: () => { M.started = true; if (!M.on) M.setOn(true); M.next(); } }, '⏭ 換一首')),
      row('🗣️ 語音', tog(V.on, V.setOn)), row('　語音音量', slider(V.vol, (v) => { V.vol = v; PK.store.set('pk_voice_vol', v); })),
      el('div', { class: 'snd-now' }, el('button', { class: 'btn small ghost', onclick: () => V.say('紅心A，黑桃K，十點半！', { pri: 3 }) }, '🔈 試聽語音'),
        V.ok ? (V.voice ? el('span', { class: 'muted' }, '使用語音：' + V.voice.name) : el('span', { class: 'muted' }, '這台裝置沒有中文語音，可能無法正常發音')) : el('span', { class: 'muted' }, '這個瀏覽器不支援語音')),
      row('🔔 音效', tog(!PK.muted, (v) => { PK.muted = !v; PK.store.set('pk_muted', !v); })),
      el('h4', null, '背景音樂來源'),
      el('ol', { class: 'snd-credits' }, TRACKS.map((t) => el('li', null, `「${t.title}」　作者：${t.artist}　來源：${t.site}`))),
      el('p', { class: 'muted' }, '語音使用裝置內建的電腦語音合成，不同手機、電腦的聲音會不太一樣。'));
    return PK.modal('🔊 聲音設定', box);
  };
  PK.MUSIC_CREDITS_HTML = '<ol>' + TRACKS.map((t) => `<li>「${t.title}」　作者：${t.artist}　來源：${t.site}</li>`).join('') + '</ol>';
})();
