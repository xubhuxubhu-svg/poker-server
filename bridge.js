/* 牌神擂台 — 橋牌（英式紳士俱樂部） ｜ 遊戲製作：Eric Hu */
(function () {
  const PK = window.PK, el = PK.el, kit = PK.kit, TK = PK.trick;
  const SKILLS = { tele: ['💭', '默契傳心', '知道隊友最長的花色和大牌點數', 1], scout: ['🕵️', '偵查', '看一位對手每種花色各有幾張', 1], aura: ['👑', '王者氣場', '你下一張出的牌視為大一級', 1], fire: ['🎆', '大滿貫煙火', '我方完成滿貫合約時，獎勵分數加倍', 1] };
  const ST = ['C', 'D', 'H', 'S', 'N'];
  const SN = ['♣', '♦', '♥', '♠', '無王'];
  const SNV = ['梅花', '方塊', '紅心', '黑桃', '無王'];
  const SEAT = ['南', '西', '北', '東'];
  const bidTxt = (b) => b.level + SN[b.strain];
  const bidVal = (b) => (b.level - 1) * 5 + b.strain;
  const hcp = (cs) => cs.reduce((a, c) => a + (c.r === 1 ? 4 : c.r === 13 ? 3 : c.r === 12 ? 2 : c.r === 11 ? 1 : 0), 0);
  const len = (cs, s) => cs.filter((c) => c.s === s).length;
  const balanced = (cs) => { const l = 'SHDC'.split('').map((s) => len(cs, s)); return l.every((x) => x >= 2) && l.filter((x) => x === 2).length <= 1; };
  const side = (i) => i % 2; // 0＝南北（你方）、1＝東西

  PK.IMPL.bridge = {
    skills: SKILLS,
    async start(t) {
      const ps = t.players, me = t.me, mi = ps.indexOf(me), N = ps[(mi + 2) % 4];
      const MS = mi % 2; /* 自己這一方（坐對面的兩人一隊） */
      const board = el('div', { class: 'sp-board br-board' });
      const histEl = el('div', { class: 'br-hist' });
      const L = kit.compass(t, ps, { cls: 'br', top: board, centerExtra: histEl });
      const S = kit.skills(t, SKILLS, ps, L.skillbar);
      let dealer = 3, hand = 0, contract, declarer, dummy, trump, tricks, played, auction, ctrlBy;
      const total = [0, 0];
      const drawBoard = () => board.replaceChildren(
        el('div', { class: 'sp-team us' }, contract ? '合約：' + bidTxt(contract) + (contract.dbl === 2 ? ' 再加倍' : contract.dbl ? ' 加倍' : '') + '　莊家：' + SEAT[declarer] + (side(declarer) === MS ? '（我方）' : '（對手）') : '叫牌中…'),
        el('div', { class: 'sp-team them' }, '我方吃 ' + (tricks ? tricks[MS] : 0) + ' 墩・對手吃 ' + (tricks ? tricks[1 - MS] : 0) + ' 墩　｜　總分 我方 ' + total[MS] + '・對手 ' + total[1 - MS]));
      const show = (p, onClick, mark) => {
        const i = ps.indexOf(p), open = p === me || (contract && played && played.size && i === dummy) || (ctrlBy && ctrlBy[i] === mi && contract);
        if (open) p.handEl.replaceChildren(...TK.sortHand(p.cards.slice()).map((c) => { const e = PK.cardEl(c, true, { small: p !== me }); if (mark && mark(c)) e.classList.add('playable'); if (onClick) { e.classList.add('pickable'); e.addEventListener('click', () => onClick(c)); } return e; }));
        else kit.backs(p);
        p.ptsEl.textContent = SEAT[i] + (i === dummy && contract ? '・夢家' : i === declarer && contract ? '・莊家' : '') + (p === me ? '・' + hcp(p.cards) + ' 點' : '');
      };

      /* ---------- 叫牌 ---------- */
      const highest = () => { for (let k = auction.length - 1; k >= 0; k--) if (auction[k].b) return auction[k]; return null; };
      const shown = (i) => { const out = new Set(); auction.forEach((a) => { if (a.i === i && a.b && a.b.strain < 4) out.add(a.b.strain); }); return out; };
      const est = (i) => { const mine = auction.filter((a) => a.i === i); if (!mine.length) return 7; const firstBid = mine.find((a) => a.b); if (!firstBid) return 5; const opened = !auction.slice(0, auction.indexOf(firstBid)).some((a) => a.b); return opened ? 13 : 9; };
      const aiBid = (i) => {
        const p = ps[i], cs = p.cards, h = hcp(cs), pi = (i + 2) % 4, hi = highest();
        const ourBid = auction.some((a) => a.b && side(a.i) === side(i));
        const partnerBid = auction.some((a) => a.b && a.i === pi);
        const cheapest = (strain) => { if (!hi) return { level: 1, strain }; let lvl = hi.b.level + (strain > hi.b.strain ? 0 : 1); return lvl <= 7 ? { level: lvl, strain } : null; };
        const longest = () => ['S', 'H', 'D', 'C'].map((s, k) => [len(cs, s) + (k < 2 ? 0.5 : 0), 3 - k]).sort((a, b) => b[0] - a[0])[0];
        if (!ourBid) {
          if (h >= 15 && h <= 17 && balanced(cs) && !hi) return { level: 1, strain: 4 };
          const [l, st] = longest();
          if (h >= 12 && (!hi || (Math.floor(l) >= 5 && cheapest(st) && cheapest(st).level <= 2))) return cheapest(h >= 12 && !hi ? st : st);
          if (hi && h >= 10 && Math.floor(l) >= 5 && cheapest(st) && cheapest(st).level <= 2 && side(hi.i) !== side(i)) return cheapest(st);
          if (hi && side(hi.i) !== side(i) && t.diff === 2 && h >= 16 && hi.b.level >= 3 && !hi.dbl) return 'X';
          return null;
        }
        const tot = h + est(pi);
        if (h < 6 && !partnerBid) return null;
        let strain = null;
        const pSuits = shown(pi);
        for (const s of [3, 2, 1, 0]) if (pSuits.has(s) && len(cs, ST[s]) >= 3) { strain = s; break; }
        if (strain == null) { const own = shown(i); for (const s of [3, 2, 1, 0]) if (own.has(s) && len(cs, ST[s]) >= 6) strain = s; }
        if (strain == null) strain = balanced(cs) || h >= 12 ? 4 : [...pSuits][0] != null ? [...pSuits][0] : longest()[1];
        const game = strain === 4 ? 3 : strain >= 2 ? 4 : 5;
        let target = tot >= 33 ? 6 : tot >= 25 ? game : tot >= 21 ? Math.min(game - 1, 3) : 2;
        if (t.diff === 0) target = Math.max(1, target + PK.randInt(-1, 1));
        if (hi && side(hi.i) === side(i) && hi.b.strain === strain && hi.b.level >= target) return null;
        if (hi && side(hi.i) === side(i) && hi.b.level >= target) return null;
        const c = cheapest(strain);
        return c && c.level <= target ? c : null;
      };
      const legalCall = (call, i) => {
        const hi = highest();
        if (call === 'X') return hi && side(hi.i) !== side(i) && !hi.dbl;
        if (call === 'XX') return hi && side(hi.i) === side(i) && hi.dbl === 1;
        return !hi || bidVal(call) > bidVal(hi.b);
      };
      const doCall = (i, call) => {
        const p = ps[i];
        let txt;
        if (!call) { auction.push({ i, pass: true }); txt = '不叫'; }
        else if (call === 'X' || call === 'XX') { const hi = highest(); hi.dbl = call === 'X' ? 1 : 2; auction.push({ i, dbl: call }); txt = call === 'X' ? '加倍' : '再加倍'; PK.fx.burst(p.seatEl, ['💥', '⚡'], 10); }
        else { auction.push({ i, b: call }); txt = bidTxt(call); }
        PK.fx.floatText(p.seatEl, txt, '#c9a96e');
        PK.voice.say((p === me ? '' : SEAT[i] + '，') + (call && call.level ? call.level + SNV[call.strain] : txt), { pri: 2, pitch: p.voicePitch || 1 });
        histEl.replaceChildren(...auction.slice(-8).map((a) => el('span', { class: 'br-call' + (a.b ? ' bid' : '') }, SEAT[a.i] + ' ' + (a.b ? bidTxt(a.b) : a.dbl ? (a.dbl === 'X' ? '加倍' : '再加倍') : '不叫'))));
      };
      const humanBid = async (hp) => {
        const hi0 = ps.indexOf(hp);
        while (true) {
          const hi = highest();
          const grid = el('div', { class: 'br-grid' });
          for (let lv = 1; lv <= 7; lv++) for (let s = 0; s < 5; s++) { const b = { level: lv, strain: s }; if (legalCall(b, hi0)) grid.append(el('button', { class: 'br-b s' + s, 'data-l': lv, 'data-s': s }, lv + SN[s])); }
          const sug = aiBid(hi0);
          const r = await kit.ask(t, { who: hp, ctrl: L.ctrl, timer: L.timer, secs: 60, skills: S, title: (hi ? '目前最高：' + SEAT[hi.i] + ' ' + bidTxt(hi.b) : '還沒有人叫牌') + '　你的大牌點數：' + hcp(hp.cards) + ' 點　（建議：' + (sug === 'X' ? '加倍' : sug ? bidTxt(sug) : '不叫') + '）',
            buttons: [grid, el('div', { class: 'bf-btns' }, el('button', { class: 'btn big', 'data-c': 'pass' }, '不叫'), legalCall('X', hi0) ? el('button', { class: 'btn', 'data-c': 'X' }, '加倍') : '', legalCall('XX', hi0) ? el('button', { class: 'btn', 'data-c': 'XX' }, '再加倍') : '')],
            bind: (pick) => { PK.$$('.br-b', L.ctrl).forEach((b) => b.addEventListener('click', () => pick({ level: +b.dataset.l, strain: +b.dataset.s }))); PK.$$('[data-c]', L.ctrl).forEach((b) => b.addEventListener('click', () => pick(b.dataset.c === 'pass' ? null : b.dataset.c))); } });
          if (r.type === 'closed') return undefined;
          if (r.type === 'skill') { await useSkill(hp, r.key); continue; }
          return r.type === 'timeout' ? sug : r.value;
        }
      };
      const useSkill = async (hp, k) => {
        const local = hp === me, hi = ps.indexOf(hp), pt = ps[(hi + 2) % 4];
        if (k === 'aura' && !contract) { if (local) PK.toast('出牌時才能使用'); return; }
        if (!S.spend(hp, k)) return;
        if (k === 'tele') { const l = ['S', 'H', 'D', 'C'].sort((a, b) => len(pt.cards, b) - len(pt.cards, a))[0]; PK.fx.burst(pt.seatEl, ['💭', '💞'], 10); if (local) PK.modal('默契傳心', `<p style="font-size:18px">💭 ${pt.name} 最長的花色是 <b>${PK.SUIT_NAME[l]}</b>（${len(pt.cards, l)} 張），大牌點數 <b>${hcp(pt.cards)}</b> 點。</p>`); }
        if (k === 'scout') { const o1 = (hi + 1) % 4, o2 = (hi + 3) % 4; const v = ps[await kit.choose(t, L.ctrl, '偵查哪一家？', [{ text: SEAT[o1] + '家 ' + ps[o1].name, value: o1 }, { text: SEAT[o2] + '家 ' + ps[o2].name, value: o2 }], { who: hp })]; PK.fx.peek(v.seatEl); if (local) PK.modal('偵查報告', `<p style="font-size:18px">🕵️ ${v.name}：${['S', 'H', 'D', 'C'].map((s) => PK.SUITS[s] + ' ' + len(v.cards, s) + ' 張').join('　')}</p>`); }
        if (k === 'aura') { hp.aura = true; PK.fx.burst(hp.seatEl, '👑', 8, { g: 0, speed: 3 }); }
        if (k === 'fire') { hp.fire = true; PK.fx.burst(hp.seatEl, '🎆', 8, { g: 0, speed: 3 }); }
      };

      /* ---------- 打牌 ---------- */
      const isTop = (c) => { for (let r = TK.rv(c) + 1; r <= 14; r++) if (!played.has(c.s + (r === 14 ? 1 : r))) return false; return true; };
      const aiCard = (i, plays) => {
        const p = ps[i], led = plays[0] && plays[0].c.s, opts = TK.legal(p.cards, led), rv = TK.rv;
        const low = (a) => a.slice().sort((x, y) => rv(x) - rv(y))[0], high = (a) => a.slice().sort((x, y) => rv(y) - rv(x))[0];
        if (t.diff === 0 && Math.random() < 0.4) return PK.pick(opts);
        if (!led) {
          const iDecl = side(i) === side(declarer);
          if (iDecl && trump) { const tr = opts.filter((c) => c.s === trump); const oppHasTrump = 13 - [...played].filter((x) => x[0] === trump).length - len(p.cards, trump) - len(ps[(i + 2) % 4].cards, trump) > 0; if (tr.length && oppHasTrump && isTop(high(tr))) return high(tr); }
          const tops = opts.filter((c) => c.s !== trump && isTop(c)); if (tops.length) return tops[0];
          const suits = ['S', 'H', 'D', 'C'].filter((s) => s !== trump && len(opts, s)).sort((a, b) => len(opts, b) - len(opts, a));
          return low(suits.length ? opts.filter((c) => c.s === suits[0]) : opts);
        }
        const wi = TK.winner(plays, trump), win = plays[wi];
        const partnerWin = side(ps.indexOf(win.p)) === side(i);
        const beat = (c) => TK.winner([...plays, { p, c }], trump) === plays.length;
        if (partnerWin && (isTop(win.c) || plays.length === 3 || (trump && win.c.s === trump && led !== trump))) return low(opts.filter((c) => c.s !== trump || led === trump).length ? opts.filter((c) => c.s !== trump || led === trump) : opts);
        const w = opts.filter(beat);
        if (w.length) return plays.length === 3 || t.diff < 2 ? low(w) : (isTop(high(w)) ? high(w) : low(w));
        const ns = opts.filter((c) => c.s !== trump); return low(ns.length ? ns : opts);
      };

      while (t.alive) {
        hand++; dealer = (dealer + 1) % 4;
        if (t.isParty && hand > 1) S.refill();
        const deck = PK.makeDeck();
        ps.forEach((p, i) => { p.cards = deck.slice(i * 13, i * 13 + 13); p.boxEl.classList.remove('winner'); kit.setTag(p, ''); });
        contract = null; declarer = dummy = -1; trump = null; tricks = null; played = new Set(); auction = []; ctrlBy = null; ps.forEach((p) => (p.aura = p.fire = false));
        ps.forEach((p) => show(p)); kit.clearSlots(L); drawBoard(); histEl.replaceChildren();
        /* 叫牌 */
        L.info.textContent = '叫牌開始（' + SEAT[dealer] + '家先叫）';
        let cur = dealer, passes = 0;
        while (t.alive) {
          kit.active(ps, ps[cur]);
          let call;
          if (!ps[cur].isAI) { call = await humanBid(ps[cur]); if (call === undefined) return; }
          else { await t.wait(PK.randInt(600, 1000)); call = aiBid(cur); if (call === 'X' && !legalCall('X', cur)) call = null; if (call && call.level && !legalCall(call, cur)) call = null; }
          doCall(cur, call);
          passes = call ? 0 : passes + 1;
          const anyBid = auction.some((a) => a.b);
          if ((anyBid && passes >= 3) || (!anyBid && passes >= 4)) break;
          cur = (cur + 1) % 4;
        }
        if (!t.alive) return;
        const hi = highest();
        if (!hi) { PK.fx.banner('四家都不叫', 'event', '重新發牌'); await t.wait(1500); continue; }
        contract = Object.assign({}, hi.b, { dbl: hi.dbl || 0 });
        declarer = auction.find((a) => a.b && side(a.i) === side(hi.i) && a.b.strain === contract.strain).i;
        dummy = (declarer + 2) % 4; trump = contract.strain < 4 ? ST[contract.strain] : null;
        /* 誰操作哪一手：莊家方只要有真人，就由那位真人同時操作莊家和夢家兩手 */
        const dh = [declarer, dummy].find((i) => !ps[i].isAI);
        ctrlBy = [0, 1, 2, 3].map((i) => (i === declarer || i === dummy ? (dh != null ? dh : declarer) : i));
        tricks = [0, 0]; histEl.replaceChildren();
        t.sys('叫牌過程：' + auction.map((a) => SEAT[a.i] + (a.b ? bidTxt(a.b) : a.dbl ? (a.dbl === 'X' ? '加倍' : '再加倍') : '不叫')).join('、'));
        PK.fx.banner('合約 ' + bidTxt(contract), 'gold', '莊家：' + SEAT[declarer] + '家・要吃 ' + (contract.level + 6) + ' 墩');
        drawBoard(); ps.forEach((p) => show(p));
        await t.wait(1500);
        let lead = (declarer + 1) % 4;
        for (let tr = 0; tr < 13 && t.alive; tr++) {
          const plays = [];
          for (let k = 0; k < 4; k++) {
            const i = (lead + k) % 4, p = ps[i];
            kit.active(ps, p);
            let c;
            const ci = ctrlBy[i], hp = ps[ci];
            if (!hp.isAI) {
              t.actor = hp;
              L.info.textContent = hp === me ? (i === ci ? '輪到你出牌' : '輪到你出' + SEAT[i] + '家（' + (i === dummy ? '夢家' : '莊家') + '）的牌') : '等待 ' + hp.name + ' 出牌';
              while (true) {
                const opts = TK.legal(p.cards, plays[0] && plays[0].c.s);
                const r = await kit.ask(t, { ctrl: L.ctrl, timer: L.timer, secs: 40, skills: S, title: (i !== ci ? '🃏 ' + SEAT[i] + '家：' : '') + (plays.length ? '要跟出' + PK.SUIT_NAME[plays[0].c.s] + '（沒有才能出其他牌）' : '點一張牌開始這一墩'),
                  bind: (pick) => show(p, (x) => (opts.includes(x) ? pick(x) : PK.toast('要跟出相同花色')), (x) => opts.includes(x)), cleanup: () => show(p) });
                if (r.type === 'closed') return;
                if (r.type === 'skill') { await useSkill(hp, r.key); continue; }
                c = r.type === 'timeout' ? aiCard(i, plays) : r.value; break;
              }
              if (i === ci && hp.aura) { hp.aura = false; c.boost = 1; PK.fx.burst(hp.seatEl, ['👑', '✨'], 12); }
            } else { L.info.textContent = '輪到 ' + SEAT[i] + '家 ' + p.name; await t.wait(PK.randInt(500, 850)); c = aiCard(i, plays); }
            p.cards.splice(p.cards.indexOf(c), 1); played.add(c.s + c.r);
            await kit.toSlot(L, p, i, c);
            plays.push({ p, c }); PK.voice.card(c, '', 2);
            ps.forEach((q) => show(q));
            if (trump && c.s === trump && plays[0].c.s !== trump) { PK.fx.burst(L.slotOf(p), ['⚡', '👑'], 8); PK.fx.floatText(L.slotOf(p), '王牌！', '#c9a96e'); }
          }
          const w = plays[TK.winner(plays, trump)].p, wi = ps.indexOf(w);
          tricks[side(wi)]++; drawBoard();
          PK.fx.floatText(w.seatEl, '+1 墩', '#c9a96e'); PK.sfx('chip');
          await kit.collectTrick(t, L, w);
          lead = wi;
        }
        if (!t.alive) return;
        kit.active(ps, null);
        /* 計分（無身價） */
        const ds = side(declarer), got = tricks[ds], need = contract.level + 6, m = [1, 2, 4][contract.dbl];
        let sc = 0;
        if (got >= need) {
          const tv = contract.strain === 4 ? 40 + 30 * (contract.level - 1) : (contract.strain >= 2 ? 30 : 20) * contract.level;
          const ts = tv * m;
          sc = ts + (ts >= 100 ? 300 : 50);
          if (contract.level === 6) sc += 500; if (contract.level === 7) sc += 1000;
          if (contract.level >= 6 && ps.some((q, qi) => side(qi) === ds && q.fire)) { sc += contract.level === 6 ? 500 : 1000; PK.fx.fireworks(8); }
          if (contract.dbl) sc += contract.dbl === 1 ? 50 : 100;
          const over = got - need; sc += over * (contract.dbl ? (contract.dbl === 1 ? 100 : 200) : contract.strain >= 2 ? 30 : 20);
          if (contract.level >= 6) { PK.fx.fireworks(6); PK.fx.banner(contract.level === 7 ? '大滿貫！' : '小滿貫！', 'gold'); }
          else PK.fx.banner('合約完成！', ds === MS ? 'good' : 'bad', '吃 ' + got + ' 墩');
          if (ds === MS && ts >= 100) PK.ch.emit('br_game');
        } else {
          const down = need - got;
          if (!contract.dbl) sc = -50 * down;
          else { let s = 0; for (let d = 1; d <= down; d++) s += d === 1 ? 100 : d <= 3 ? 200 : 300; sc = -s * (contract.dbl === 2 ? 2 : 1); }
          PK.fx.banner('合約失敗', ds === MS ? 'bad' : 'good', '少吃 ' + down + ' 墩');
        }
        const ours = ds === MS ? sc : -sc;
        if (sc > 0) total[ds] += sc; else total[1 - ds] += -sc;
        drawBoard();
        if (ours > 0) { me.boxEl.classList.add('winner'); N.boxEl.classList.add('winner'); }
        await t.wait(1400);
        await kit.settle(t, Math.round(ours / 5), { big: ours >= 400, title: (ours >= 0 ? '我方 +' : '我方 ') + ours + ' 分' });
        await PK.modal('本局結果', `<p>合約：<b>${bidTxt(contract)}${contract.dbl === 2 ? ' 再加倍' : contract.dbl ? ' 加倍' : ''}</b>，莊家 ${SEAT[declarer]}家</p><p>莊家方吃 ${got} 墩（需要 ${need} 墩）</p><p>本局我方 <b>${ours >= 0 ? '+' : ''}${ours}</b> 分</p><p>總分：我方 ${total[MS]}・對手 ${total[1 - MS]}</p>`, [{ text: '好', value: 1, cls: 'primary' }]);
        await kit.next(t, L.ctrl, '下一局');
      }
    },
  };
})();
