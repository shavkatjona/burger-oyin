(() => {
  'use strict';

  // ---------- Sozlamalar ----------

  const GAME_SECONDS = 60;
  const MAX_LIVES = 3;
  const POINTS_PER_ITEM = 10;
  const BONUS_PER_LAYER = 10;
  const BEST_KEY = 'burger-yig:best';
  const SOUND_KEY = 'burger-yig:sound';
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const TEXT_FONT = 'Nunito,"Baloo 2",ui-rounded,"Segoe UI",system-ui,-apple-system,Roboto,sans-serif';

  const TYPES = {
    bun: { name: 'Non', emoji: '🍞' },
    patty: { name: 'Kotlet', emoji: '🥩' },
    cheese: { name: 'Pishloq', emoji: '🧀' },
    lettuce: { name: 'Salat', emoji: '🥬' },
    tomato: { name: 'Pomidor', emoji: '🍅' },
    pepper: { name: 'Qalampir', emoji: '🌶️' },
  };
  const FILLINGS = ['patty', 'cheese', 'lettuce', 'tomato'];
  const FOODS = ['bun', ...FILLINGS];

  // Burger qatlamlarining balandligi (view.layerH ga nisbatan)
  const LAYER_HEIGHT = { bunBottom: 1.0, bunTop: 1.7, patty: 1.05, cheese: 0.42, lettuce: 0.6, tomato: 0.55 };

  // ---------- DOM ----------

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    score: $('score'),
    time: $('time'),
    timePill: $('timePill'),
    lives: $('lives'),
    order: $('order'),
    orderNo: $('orderNo'),
    orderList: $('orderList'),
    pauseBtn: $('pauseBtn'),
    soundBtn: $('soundBtn'),
    startScreen: $('startScreen'),
    pauseScreen: $('pauseScreen'),
    overScreen: $('overScreen'),
    startBtn: $('startBtn'),
    resumeBtn: $('resumeBtn'),
    restartBtn: $('restartBtn'),
    bestStart: $('bestStart'),
    bestOver: $('bestOver'),
    finalScore: $('finalScore'),
    finalBurgers: $('finalBurgers'),
    overTitle: $('overTitle'),
    overEmoji: $('overEmoji'),
    newRecord: $('newRecord'),
    safeProbe: $('safeProbe'),
  };

  // localStorage yopiq bo'lishi mumkin (maxfiy rejim va h.k.) — o'yin baribir ishlaydi.
  const storage = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, String(value)); } catch { /* e'tiborsiz */ }
    },
  };

  // ---------- Yordamchilar ----------

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- Holat ----------

  let W = 0;
  let H = 0;
  let DPR = 1;
  const view = { plateW: 0, plateH: 0, plateY: 0, tableY: 0, layerH: 0, itemSize: 0 };

  const state = {
    mode: 'menu', // menu | playing | paused | over
    score: 0,
    lives: MAX_LIVES,
    elapsed: 0,
    burgers: 0,
    order: [],
    step: 0,
    stack: [],
    items: [],
    particles: [],
    popups: [],
    served: null,
    spawnTimer: 0,
    lastSpawnX: -1,
    shake: 0,
    flash: 0,
    plateX: 0,
    targetX: null,
    keys: { left: false, right: false },
    best: Number(storage.get(BEST_KEY)) || 0,
    sound: storage.get(SOUND_KEY) !== 'off',
  };

  // ---------- O'lcham ----------

  function resize() {
    const prevW = W;
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    const safeBottom = ui.safeProbe.offsetHeight || 0;
    const tableH = clamp(H * 0.13, 64, 120) + safeBottom;
    view.tableY = H - tableH;
    view.plateW = clamp(W * 0.28, 105, 190);
    view.plateH = view.plateW * 0.16;
    view.plateY = view.tableY + Math.min(tableH * 0.3, 34);
    view.layerH = clamp(H * 0.028, 10, 20);
    view.itemSize = Math.round(clamp(Math.min(W, H) * 0.11, 42, 72));

    state.plateX = prevW ? (state.plateX / prevW) * W : W / 2;
    state.plateX = clamp(state.plateX, view.plateW / 2, W - view.plateW / 2);
    spriteCache.clear();
  }

  // ---------- Buyurtma ----------

  function makeOrder(burgersDone) {
    const count = Math.min(5, 1 + burgersDone);
    const fillings = [];
    for (let i = 0; i < count; i++) {
      let t;
      do { t = pick(FILLINGS); } while (t === fillings[i - 1]);
      fillings.push(t);
    }
    if (burgersDone === 0) fillings[0] = 'patty';
    return ['bun', ...fillings, 'bun'];
  }

  function newOrder() {
    state.order = makeOrder(state.burgers);
    state.step = 0;
    state.stack = [];
    renderOrder();
    ui.order.classList.remove('flash');
    void ui.order.offsetWidth;
    ui.order.classList.add('flash');
  }

  function renderOrder() {
    ui.orderNo.textContent = '#' + (state.burgers + 1);
    ui.orderList.textContent = '';
    state.order.forEach((type, i) => {
      const li = document.createElement('li');
      if (i < state.step) li.className = 'done';
      else if (i === state.step) li.className = 'next';
      li.innerHTML = `<span class="em">${TYPES[type].emoji}</span><span class="nm">${TYPES[type].name}</span>` +
        (i < state.step ? '<span class="ck">✔</span>' : '');
      li.title = `${i + 1}. ${TYPES[type].name}`;
      ui.orderList.appendChild(li);
    });
  }

  // ---------- HUD ----------

  const hudCache = { score: -1, time: -1, lives: -1 };

  function renderHud(force) {
    const time = Math.ceil(Math.max(0, GAME_SECONDS - state.elapsed));
    if (force || hudCache.score !== state.score) {
      ui.score.textContent = state.score;
      if (!force) bump(ui.score.parentElement);
      hudCache.score = state.score;
    }
    if (force || hudCache.time !== time) {
      ui.time.textContent = time;
      ui.timePill.classList.toggle('warn', time <= 10 && state.mode === 'playing');
      hudCache.time = time;
    }
    if (force || hudCache.lives !== state.lives) {
      ui.lives.textContent = '❤️'.repeat(Math.max(0, state.lives)) + '🤍'.repeat(MAX_LIVES - Math.max(0, state.lives));
      if (!force) bump(ui.lives);
      hudCache.lives = state.lives;
    }
  }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  // ---------- Ovoz ----------

  let audio = null;

  function unlockAudio() {
    if (audio || !state.sound) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { audio = new AC(); } catch { audio = null; }
  }

  function tone(freq, duration, { type = 'sine', volume = 0.12, delay = 0, slide = 0 } = {}) {
    if (!state.sound || !audio) return;
    if (audio.state === 'suspended') audio.resume();
    const t0 = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const sfx = {
    good: () => { tone(620, 0.09, { type: 'triangle' }); tone(930, 0.12, { type: 'triangle', delay: 0.06 }); },
    bad: () => tone(220, 0.3, { type: 'sawtooth', volume: 0.08, slide: 0.5 }),
    done: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { type: 'triangle', delay: i * 0.08 })),
    over: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, { type: 'triangle', delay: i * 0.15 })),
  };

  function setSound(on) {
    state.sound = on;
    storage.set(SOUND_KEY, on ? 'on' : 'off');
    ui.soundBtn.textContent = on ? '🔊' : '🔇';
    ui.soundBtn.setAttribute('aria-label', on ? 'Ovozni oʻchirish' : 'Ovozni yoqish');
    if (on) unlockAudio();
  }

  // ---------- O'yin oqimi ----------

  function showScreen(name) {
    ui.startScreen.classList.toggle('hidden', name !== 'start');
    ui.pauseScreen.classList.toggle('hidden', name !== 'pause');
    ui.overScreen.classList.toggle('hidden', name !== 'over');
  }

  function startGame() {
    if (state.mode === 'playing') return;
    unlockAudio();
    Object.assign(state, {
      mode: 'playing',
      score: 0,
      lives: MAX_LIVES,
      elapsed: 0,
      burgers: 0,
      items: [],
      particles: [],
      popups: [],
      served: null,
      spawnTimer: 0.5,
      lastSpawnX: -1,
      shake: 0,
      flash: 0,
      plateX: W / 2,
      targetX: null,
    });
    newOrder();
    renderHud(true);
    showScreen(null);
    ui.pauseBtn.disabled = false;
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    state.keys.left = state.keys.right = false;
    showScreen('pause');
    ui.resumeBtn.focus({ preventScroll: true });
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    showScreen(null);
  }

  function endGame(reason) {
    if (state.mode !== 'playing') return;
    state.mode = 'over';
    state.keys.left = state.keys.right = false;
    const isRecord = state.score > state.best;
    if (isRecord) {
      state.best = state.score;
      storage.set(BEST_KEY, state.best);
    }
    renderHud(true);
    ui.timePill.classList.remove('warn');
    ui.pauseBtn.disabled = true;

    ui.overEmoji.textContent = reason === 'lives' ? '💔' : '⏰';
    ui.overTitle.textContent = reason === 'lives' ? 'Jonlar tugadi!' : 'Vaqt tugadi!';
    ui.finalScore.textContent = state.score;
    ui.finalBurgers.textContent = state.burgers;
    ui.bestOver.textContent = state.best;
    ui.bestStart.textContent = state.best;
    ui.newRecord.classList.toggle('hidden', !(isRecord && state.score > 0));
    if (isRecord && state.score > 0) confetti(W / 2, H * 0.3, 80);
    sfx.over();

    // Tasodifiy bosish darhol qayta boshlab yubormasligi uchun qisqa kutish.
    ui.restartBtn.disabled = true;
    setTimeout(() => {
      showScreen('over');
      setTimeout(() => {
        ui.restartBtn.disabled = false;
        ui.restartBtn.focus({ preventScroll: true });
      }, 450);
    }, 350);
  }

  // ---------- Mexanika ----------

  function difficulty() {
    return clamp(state.elapsed / GAME_SECONDS, 0, 1);
  }

  function spawnItem() {
    const d = difficulty();
    const need = state.order[state.step];
    const pepperChance = lerp(0.1, 0.22, d);
    const r = Math.random();
    let type;
    if (r < pepperChance) type = 'pepper';
    else if (r < pepperChance + 0.42) type = need;
    else type = pick(FOODS.filter((t) => t !== need));

    const size = view.itemSize;
    let x;
    let tries = 0;
    do {
      x = rand(size * 0.6, W - size * 0.6);
    } while (Math.abs(x - state.lastSpawnX) < size * 1.3 && ++tries < 8);
    state.lastSpawnX = x;

    state.items.push({
      type,
      x,
      y: -size,
      vy: H * lerp(0.3, 0.55, d) * rand(0.85, 1.15),
      rot: rand(-0.4, 0.4),
      vr: rand(-1.6, 1.6),
      size,
      dead: false,
    });
  }

  function layerHeight(type, index) {
    if (type === 'bun') return (index === 0 ? LAYER_HEIGHT.bunBottom : LAYER_HEIGHT.bunTop) * view.layerH;
    return LAYER_HEIGHT[type] * view.layerH;
  }

  function stackHeight(stack) {
    return stack.reduce((sum, type, i) => sum + layerHeight(type, i), 0);
  }

  function catchItem(item) {
    item.dead = true;
    const y = view.plateY - stackHeight(state.stack);
    const need = state.order[state.step];

    if (item.type === 'pepper') return hurt(item.x, y, 'Achchiq! 🌶️');
    if (item.type !== need) return hurt(item.x, y, 'Notoʻgʻri!');

    state.stack.push(item.type);
    state.step++;
    state.score += POINTS_PER_ITEM;
    popup(state.plateX, y - 20, '+' + POINTS_PER_ITEM, '#2bb673');
    sparkle(state.plateX, y, 10);
    sfx.good();

    if (state.step >= state.order.length) completeBurger();
    else renderOrder();
  }

  function hurt(x, y, text) {
    state.lives--;
    state.shake = 0.35;
    state.flash = 1;
    popup(x, y - 20, text, '#ef476f');
    burst(x, y, '#ef476f', 14);
    sfx.bad();
    if (navigator.vibrate) {
      try { navigator.vibrate(90); } catch { /* e'tiborsiz */ }
    }
    if (state.lives <= 0) endGame('lives');
  }

  function completeBurger() {
    const bonus = state.order.length * BONUS_PER_LAYER;
    state.score += bonus;
    state.burgers++;
    state.served = { stack: state.stack.slice(), x: state.plateX, t: 0 };
    popup(state.plateX, view.plateY - stackHeight(state.stack) - 50, `Mazali! +${bonus}`, '#ff7a1a', 1.4);
    confetti(state.plateX, view.plateY - stackHeight(state.stack), 40);
    sfx.done();
    newOrder();
  }

  // ---------- Effektlar ----------

  function popup(x, y, text, color, scale = 1) {
    state.popups.push({ x: clamp(x, 70, W - 70), y, text, color, scale, t: 0 });
  }

  function sparkle(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI, Math.PI * 2);
      const s = rand(80, 220);
      state.particles.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, t: 0, color: '#fff7b0', r: rand(2, 4) });
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 200);
      state.particles.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45, t: 0, color, r: rand(2, 5) });
    }
  }

  const CONFETTI = ['#ff7a1a', '#ffd23f', '#2bb673', '#ef476f', '#118ab2', '#9b5de5'];

  function confetti(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const s = rand(180, 520);
      state.particles.push({
        kind: 'paper', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.9, 1.5), t: 0,
        color: pick(CONFETTI), w: rand(5, 9), h: rand(8, 14), rot: rand(0, 6), vr: rand(-8, 8),
      });
    }
  }

  // ---------- Yangilash ----------

  function update(dt) {
    state.elapsed += dt;

    // Tarelka harakati
    const keySpeed = Math.max(W * 1.2, 500);
    const dir = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
    if (dir) {
      state.targetX = null;
      state.plateX += dir * keySpeed * dt;
    } else if (state.targetX !== null) {
      state.plateX += (state.targetX - state.plateX) * (1 - Math.exp(-dt * 22));
    }
    state.plateX = clamp(state.plateX, view.plateW / 2, W - view.plateW / 2);

    // Yangi masalliqlar
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnItem();
      state.spawnTimer = lerp(0.95, 0.5, difficulty()) * rand(0.8, 1.2);
    }

    // Tushayotgan masalliqlar va ushlash
    const catchY = view.plateY - stackHeight(state.stack);
    const reach = view.plateW / 2;
    for (const item of state.items) {
      if (item.dead) continue;
      item.y += item.vy * dt;
      item.rot += item.vr * dt;
      const half = item.size * 0.38;
      if (
        item.y + half >= catchY &&
        item.y - half <= catchY + view.layerH * 1.2 &&
        Math.abs(item.x - state.plateX) <= reach
      ) {
        catchItem(item);
        if (state.mode !== 'playing') break;
      }
      if (item.y - item.size > H) item.dead = true;
    }
    state.items = state.items.filter((it) => !it.dead);

    if (state.mode === 'playing' && state.elapsed >= GAME_SECONDS) {
      state.elapsed = GAME_SECONDS;
      endGame('time');
    }
  }

  function updateEffects(dt) {
    for (const p of state.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'paper' ? 700 : 400) * dt;
      if (p.kind === 'paper') {
        p.vx *= 1 - 1.5 * dt;
        p.rot += p.vr * dt;
      }
    }
    state.particles = state.particles.filter((p) => p.t < p.life);

    for (const p of state.popups) {
      p.t += dt;
      p.y -= 50 * dt;
    }
    state.popups = state.popups.filter((p) => p.t < 0.9);

    if (state.served) {
      state.served.t += dt / 0.7;
      if (state.served.t >= 1) state.served = null;
    }

    state.shake = Math.max(0, state.shake - dt);
    state.flash = Math.max(0, state.flash - dt * 3.5);
  }

  // ---------- Chizish ----------

  const spriteCache = new Map();

  function sprite(type, size) {
    const key = type + ':' + size;
    let c = spriteCache.get(key);
    if (c) return c;
    const px = Math.ceil(size * 1.3 * DPR);
    c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    const mid = px / 2;

    // Orqa doira — emoji har qanday fonda yaxshi ko'rinsin
    g.beginPath();
    g.arc(mid, mid, px * 0.42, 0, Math.PI * 2);
    if (type === 'pepper') {
      g.fillStyle = 'rgba(239, 71, 111, 0.28)';
      g.fill();
      g.lineWidth = Math.max(2, px * 0.035);
      g.setLineDash([px * 0.08, px * 0.06]);
      g.strokeStyle = 'rgba(200, 20, 60, 0.85)';
      g.stroke();
    } else {
      g.fillStyle = 'rgba(255, 255, 255, 0.6)';
      g.fill();
    }

    g.font = `${Math.round(size * 0.78 * DPR)}px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(TYPES[type].emoji, mid, mid + px * 0.03);
    spriteCache.set(key, c);
    return c;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }

  function drawTable() {
    const y = view.tableY;
    const grad = ctx.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0, '#d9884a');
    grad.addColorStop(1, '#b0612b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, W, H - y);
    ctx.fillStyle = '#f2a766';
    ctx.fillRect(0, y, W, 6);
    ctx.strokeStyle = 'rgba(120, 60, 20, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const ly = y + ((H - y) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(W, ly);
      ctx.stroke();
    }
  }

  function drawPlate(x) {
    const w = view.plateW;
    const h = view.plateH;
    const y = view.plateY;
    ctx.fillStyle = 'rgba(80, 35, 10, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.7, w * 0.52, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8f1ff';
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.25, w / 2, h * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.12, w * 0.36, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9cc3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.25, w / 2 - 3, h * 0.62 - 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Bitta burger qatlamini chizadi; pastki chegarasi yBottom.
  function drawLayer(type, index, cx, yBottom, baseW) {
    const L = view.layerH;
    const h = layerHeight(type, index);
    const top = yBottom - h;

    if (type === 'bun' && index === 0) {
      const w = baseW * 0.92;
      ctx.fillStyle = '#e39a3b';
      roundRect(cx - w / 2, top, w, h, [h * 0.3, h * 0.3, h * 0.6, h * 0.6]);
      ctx.fill();
      ctx.fillStyle = '#f7c46c';
      roundRect(cx - w / 2, top, w, h * 0.4, h * 0.25);
      ctx.fill();
    } else if (type === 'bun') {
      const w = baseW * 0.95;
      ctx.fillStyle = '#e8962f';
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, yBottom);
      ctx.bezierCurveTo(cx - w / 2, top - h * 0.15, cx + w / 2, top - h * 0.15, cx + w / 2, yBottom);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.18, top + h * 0.35, w * 0.16, h * 0.14, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6dc';
      const seeds = [[-0.25, 0.45], [-0.05, 0.3], [0.15, 0.4], [0.3, 0.6], [0.02, 0.6], [-0.35, 0.7]];
      for (const [sx, sy] of seeds) {
        ctx.beginPath();
        ctx.ellipse(cx + sx * w, top + sy * h, Math.max(1.5, L * 0.16), Math.max(1, L * 0.09), sx, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'patty') {
      const w = baseW * 0.98;
      ctx.fillStyle = '#6b3519';
      roundRect(cx - w / 2, top, w, h, h * 0.45);
      ctx.fill();
      ctx.fillStyle = '#8a4a26';
      roundRect(cx - w / 2 + 3, top + 2, w - 6, h * 0.35, h * 0.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(40, 15, 5, 0.45)';
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.arc(cx - w * 0.38 + (w * 0.76 * i) / 6, top + h * (i % 2 ? 0.6 : 0.75), Math.max(1, L * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'cheese') {
      const w = baseW * 0.98;
      ctx.fillStyle = '#ffc928';
      ctx.fillRect(cx - w / 2, top, w, h);
      ctx.beginPath();
      for (const fx of [-0.3, 0.05, 0.32]) {
        const dx = cx + fx * w;
        ctx.moveTo(dx - L * 0.45, yBottom - 0.5);
        ctx.lineTo(dx, yBottom + L * 0.55);
        ctx.lineTo(dx + L * 0.45, yBottom - 0.5);
      }
      ctx.fill();
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(cx - w / 2, top, w, Math.max(1, h * 0.35));
    } else if (type === 'lettuce') {
      const w = baseW * 1.06;
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      const waves = 8;
      ctx.moveTo(cx - w / 2, top + h * 0.3);
      for (let i = 0; i <= waves; i++) {
        const x = cx - w / 2 + (w * i) / waves;
        ctx.quadraticCurveTo(x - w / waves / 2, yBottom + h * 0.45, x, top + h * 0.3);
      }
      ctx.lineTo(cx + w / 2, top);
      ctx.lineTo(cx - w / 2, top);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7ed957';
      roundRect(cx - w / 2, top, w, h * 0.45, h * 0.2);
      ctx.fill();
    } else if (type === 'tomato') {
      const w = baseW * 0.9;
      const sliceW = w / 2 - 2;
      for (const sx of [cx - w / 4 - 1, cx + w / 4 + 1]) {
        ctx.fillStyle = '#e63946';
        roundRect(sx - sliceW / 2, top, sliceW, h, h / 2);
        ctx.fill();
        ctx.fillStyle = '#ff8a8f';
        roundRect(sx - sliceW / 2 + 4, top + h * 0.25, sliceW - 8, h * 0.4, h * 0.2);
        ctx.fill();
      }
    }
    return h;
  }

  function drawStack(stack, cx, yBottom) {
    let y = yBottom;
    stack.forEach((type, i) => {
      y -= drawLayer(type, i, cx, y, view.plateW * 0.82);
    });
  }

  function drawNextBadge() {
    const need = state.order[state.step];
    if (!need) return;
    const r = Math.max(14, view.itemSize * 0.32);
    let bx = state.plateX + view.plateW / 2 + r * 0.6;
    if (bx + r > W - 4) bx = state.plateX - view.plateW / 2 - r * 0.6;
    const by = view.plateY - r * 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const s = r * 1.9;
    ctx.drawImage(sprite(need, Math.round(s)), bx - (s * 1.3) / 2, by - (s * 1.3) / 2, s * 1.3, s * 1.3);
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (state.shake > 0) {
      const k = state.shake * 22;
      ctx.translate(rand(-k, k), rand(-k, k));
    }

    drawTable();

    if (state.served) {
      const t = state.served.t;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      const sx = state.served.x + t * W * 0.15;
      const sy = view.plateY - t * H * 0.35;
      ctx.translate(sx, sy);
      ctx.scale(1 - t * 0.4, 1 - t * 0.4);
      drawStack(state.served.stack, 0, 0);
      ctx.restore();
    }

    drawPlate(state.plateX);
    drawStack(state.stack, state.plateX, view.plateY);
    if (state.mode === 'playing' || state.mode === 'paused') drawNextBadge();

    for (const item of state.items) {
      const img = sprite(item.type, item.size);
      const s = item.size * 1.3;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rot);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }

    for (const p of state.particles) {
      ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
      ctx.fillStyle = p.color;
      if (p.kind === 'paper') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of state.popups) {
      const size = Math.round(clamp(W * 0.05, 20, 30) * p.scale * (p.t < 0.15 ? 0.6 + p.t * 2.7 : 1));
      ctx.globalAlpha = clamp(1.6 - p.t * 1.8, 0, 1);
      ctx.font = `900 ${size}px ${TEXT_FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (state.flash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(239, 71, 111, 0)');
      g.addColorStop(1, `rgba(239, 71, 111, ${0.55 * state.flash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Asosiy sikl ----------

  let lastTime = 0;

  function frame(now) {
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;
    if (state.mode === 'playing') update(dt);
    if (state.mode !== 'paused') updateEffects(dt);
    renderHud(false);
    render();
    requestAnimationFrame(frame);
  }

  // ---------- Boshqaruv ----------

  function pointerX(e) {
    const rect = canvas.getBoundingClientRect();
    return e.clientX - rect.left;
  }

  function onPointer(e) {
    if (state.mode !== 'playing') return;
    if (e.target.closest && e.target.closest('button')) return;
    state.targetX = pointerX(e);
  }

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });

  const LEFT_KEYS = ['ArrowLeft', 'a', 'A', 'ф', 'Ф'];
  const RIGHT_KEYS = ['ArrowRight', 'd', 'D', 'в', 'В'];

  window.addEventListener('keydown', (e) => {
    if (LEFT_KEYS.includes(e.key)) {
      state.keys.left = true;
      e.preventDefault();
    } else if (RIGHT_KEYS.includes(e.key)) {
      state.keys.right = true;
      e.preventDefault();
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (state.mode === 'playing') pauseGame();
      else if (state.mode === 'paused') resumeGame();
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Fokusdagi tugma o'zi ishlaydi
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (state.mode === 'menu') startGame();
      else if (state.mode === 'over' && !ui.restartBtn.disabled && !ui.overScreen.classList.contains('hidden')) startGame();
      else if (state.mode === 'paused') resumeGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (LEFT_KEYS.includes(e.key)) state.keys.left = false;
    if (RIGHT_KEYS.includes(e.key)) state.keys.right = false;
  });

  ui.startBtn.addEventListener('click', startGame);
  ui.restartBtn.addEventListener('click', startGame);
  ui.resumeBtn.addEventListener('click', resumeGame);
  ui.pauseBtn.addEventListener('click', () => (state.mode === 'playing' ? pauseGame() : resumeGame()));
  ui.soundBtn.addEventListener('click', () => setSound(!state.sound));

  // Boshqa oynaga o'tilganda avtomatik pauza
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener('blur', () => {
    state.keys.left = state.keys.right = false;
    pauseGame();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));

  // ---------- Ishga tushirish ----------

  resize();
  setSound(state.sound);
  ui.bestStart.textContent = state.best;
  ui.pauseBtn.disabled = true;
  state.order = makeOrder(0);
  renderOrder();
  renderHud(true);
  requestAnimationFrame(frame);

  // Sinov uchun: ?debug manzili bilan ichki holatga kirish mumkin.
  if (/[?&]debug\b/.test(location.search)) {
    window.__burger = { state, view, startGame, endGame, pauseGame, resumeGame, newOrder };
  }
})();
