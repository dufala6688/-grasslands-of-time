(() => {
  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");

  const MAX_COWS = 7;
  const MAX_SHEEP = 7;
  const DOG_NEED = MAX_COWS + MAX_SHEEP;
  const COW_BIRTH = 10;
  const SHEEP_BIRTH = 8;
  const EAT_MS = 3000;
  const GRASS_EVERY = 5000;
  const GRASS_PER_WAVE = 2;
  const GRASS_CAP = 15;
  const DRAG_THRESHOLD = 8;
  const NEAR_GRASS = 62;
  const EAT_RANGE = 46;
  const ANIMAL_MAX_SPEED = 168;
  const IDLE_MAX_SPEED = 58;
  const ANIMAL_FRICTION = 2.6;
  const WANDER_ACCEL = 42;
  const SEPARATION = 130;
  const EDGE_PUSH = 150;
  const NAP_EVERY = 10;
  const NAP_HOLD = 5;
  const DOG_MAX_SPEED = 270;
  const DOG_ACCEL = 520;
  const DOG_FRICTION = 4.4;
  const DOG_ARRIVE = 26;
  const FAN_RANGE = 210;
  const FAN_HALF = (78 * Math.PI) / 180;
  const FAN_FORWARD = 430;
  const FAN_LATERAL = 260;

  const SPR = {
    scene: new Image(),
    cow: {},
    sheep: {},
    dog: {},
    grass: [],
  };
  SPR.scene.src = "assets/scene.png";
  for (const name of ["idle", "walk1", "walk2", "eat1", "eat2", "eat3", "drag", "jump", "sleep"]) {
    SPR.cow[name] = new Image();
    SPR.cow[name].src = `assets/sprites/cow_${name}.png`;
    SPR.sheep[name] = new Image();
    SPR.sheep[name].src = `assets/sprites/sheep_${name}.png`;
  }
  for (const name of ["idle", "walk1", "walk2", "walk3", "walk4", "herd", "land", "sit1", "sit2"]) {
    SPR.dog[name] = new Image();
    SPR.dog[name].src = `assets/sprites/dog_${name}.png`;
  }
  for (let i = 1; i <= 3; i++) {
    const im = new Image();
    im.src = `assets/sprites/grass${i}.png`;
    SPR.grass.push(im);
  }

  const ui = {
    hud: document.getElementById("hud"),
    cowMeter: document.getElementById("cow-meter"),
    sheepMeter: document.getElementById("sheep-meter"),
    unlockMeter: document.getElementById("unlock-meter"),
    cowFrac: document.getElementById("cow-frac"),
    sheepFrac: document.getElementById("sheep-frac"),
    unlockFrac: document.getElementById("unlock-frac"),
    grassCount: document.getElementById("grass-count"),
    restart: document.getElementById("restart"),
    help: document.getElementById("help"),
    sound: document.getElementById("sound"),
    leisure: document.getElementById("leisure"),
    collapse: document.getElementById("collapse"),
    panelWrap: document.getElementById("panel-wrap"),
    splash: document.getElementById("splash"),
    start: document.getElementById("start"),
    overlay: document.getElementById("overlay"),
    helpWrap: document.getElementById("help-wrap"),
    confirmWrap: document.getElementById("confirm-wrap"),
    helpOk: document.getElementById("help-ok"),
    confirmNo: document.getElementById("confirm-no"),
    confirmYes: document.getElementById("confirm-yes"),
    bgm: document.getElementById("bgm"),
    eat: document.getElementById("eat-sfx"),
  };

  const state = {
    w: 0,
    h: 0,
    dpr: 1,
    meadowTop: 0,
    playing: false,
    cows: [],
    sheep: [],
    grasses: [],
    hearts: [],
    bits: [],
    dog: null,
    cowProg: 0,
    sheepProg: 0,
    grassTimer: 0,
    nextId: 1,
    pointer: { x: 0, y: 0, down: false },
    drag: null,
    clouds: [],
    wind: 0,
    gust: 0,
    last: 0,
    napTimer: 0,
    lastInteract: 0,
    leisure: false,
    muted: false,
    helpThen: null,
  };

  let audioCtx = null;
  let crunchBuf = null;
  let crunchWait = 0;

  function audio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function crunchBuffer(ac) {
    if (crunchBuf && crunchBuf.sampleRate === ac.sampleRate) return crunchBuf;
    const n = Math.floor(ac.sampleRate * 0.12);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const env = Math.pow(1 - i / n, 1.6);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    crunchBuf = buf;
    return buf;
  }

  function playCrunch() {
    if (state.muted) return;
    try {
      const ac = audio();
      const t = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = crunchBuffer(ac);
      src.playbackRate.value = rand(0.85, 1.35);
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = rand(1400, 2200);
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = rand(2200, 5200);
      bp.Q.value = rand(2.4, 6);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      src.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(ac.destination);
      src.start(t);
      src.stop(t + 0.1);
    } catch (_) {}
  }

  function updateChew() {
    const eat = ui.eat;
    if (!eat) return;
    const chewing = !state.muted && allAnimals().some((a) => a.eating);
    if (chewing) {
      eat.volume = 0.35;
      if (eat.paused) eat.play().catch(() => {});
    } else if (!eat.paused) {
      eat.pause();
      eat.currentTime = 0;
    }
  }

  function rid() {
    return state.nextId++;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function len(x, y) {
    return Math.hypot(x, y) || 0;
  }

  // Normalized on the full scene painting. Traced from the red pasture outline.
  const WALK = [
    [0.36, 0.06, 0.5],
    [0.4, 0.06, 0.6],
    [0.44, 0.06, 0.72],
    [0.48, 0.06, 0.84],
    [0.52, 0.06, 0.91],
    [0.62, 0.055, 0.94],
    [0.74, 0.055, 0.945],
    [0.82, 0.065, 0.945],
    [0.86, 0.1, 0.94],
    [0.89, 0.2, 0.92],
    [0.91, 0.3, 0.88],
  ];

  function layoutScene() {
    const im = SPR.scene;
    const iw = readyImg(im) ? im.naturalWidth : 2048;
    const ih = readyImg(im) ? im.naturalHeight : 1280;
    const scale = Math.max(state.w / iw, state.h / ih);
    state.scene = {
      x: (state.w - iw * scale) / 2,
      y: (state.h - ih * scale) / 2,
      w: iw * scale,
      h: ih * scale,
      scale,
    };
    state.meadowTop = state.scene.y + state.scene.h * WALK[0][0];
  }

  function pace() {
    const w = state.scene ? state.scene.w : state.w || 1500;
    return Math.max(0.55, w / 1500);
  }

  function fanRange() {
    return FAN_RANGE;
  }

  function screenToNorm(x, y) {
    const s = state.scene || { x: 0, y: 0, w: state.w || 1, h: state.h || 1 };
    return { x: (x - s.x) / s.w, y: (y - s.y) / s.h };
  }

  function normToScreen(nx, ny) {
    const s = state.scene || { x: 0, y: 0, w: state.w || 1, h: state.h || 1 };
    return { x: s.x + nx * s.w, y: s.y + ny * s.h };
  }

  function walkSpan(ny) {
    if (ny < WALK[0][0] || ny > WALK[WALK.length - 1][0]) return null;
    let i = 0;
    while (i < WALK.length - 2 && WALK[i + 1][0] < ny) i++;
    const a = WALK[i];
    const b = WALK[i + 1];
    const t = (ny - a[0]) / (b[0] - a[0] || 1);
    return { l: a[1] + (b[1] - a[1]) * t, r: a[2] + (b[2] - a[2]) * t };
  }

  function persp(y) {
    const n = screenToNorm(0, y).y;
    const depth = clamp((n - WALK[0][0]) / (WALK[WALK.length - 1][0] - WALK[0][0]), 0, 1);
    return 0.5 + depth * 0.85;
  }

  function meadowBounds() {
    const top = normToScreen(0.5, WALK[0][0]);
    const bot = normToScreen(0.5, WALK[WALK.length - 1][0]);
    const left = normToScreen(0.05, 0.7);
    const right = normToScreen(0.95, 0.7);
    return { left: left.x, right: right.x, top: top.y, bottom: bot.y };
  }

  function meadowCenter() {
    const b = meadowBounds();
    return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
  }

  function onScreen(p) {
    const pad = 28;
    return p.x >= pad && p.x <= state.w - pad && p.y >= pad && p.y <= state.h - pad;
  }

  function randomMeadowPos() {
    for (let i = 0; i < 40; i++) {
      const ny = rand(WALK[0][0] + 0.03, WALK[WALK.length - 1][0] - 0.025);
      const span = walkSpan(ny);
      if (!span || span.r - span.l < 0.12) continue;
      const nx = rand(span.l + 0.03, span.r - 0.03);
      const p = normToScreen(nx, ny);
      if (onScreen(p)) return p;
    }
    const ny = rand(0.5, 0.84);
    const span = walkSpan(ny) || { l: 0.2, r: 0.8 };
    return normToScreen(rand(span.l + 0.04, span.r - 0.04), ny);
  }

  function clampToWalk(x, y) {
    let n = screenToNorm(x, y);
    const y0 = WALK[0][0] + 0.02;
    const y1 = WALK[WALK.length - 1][0] - 0.02;
    n.y = clamp(n.y, y0, y1);
    const span = walkSpan(n.y);
    if (span) n.x = clamp(n.x, span.l + 0.02, span.r - 0.02);
    const p = normToScreen(n.x, n.y);
    const pad = 28;
    return {
      x: clamp(p.x, pad, Math.max(pad, state.w - pad)),
      y: clamp(p.y, pad, Math.max(pad, state.h - pad)),
    };
  }

  function makeAnimal(type, x, y) {
    const heading = rand(0, Math.PI * 2);
    return {
      id: rid(),
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      r: type === "cow" ? 58 : 36,
      eating: null,
      eatT: 0,
      approach: null,
      bob: rand(0, Math.PI * 2),
      heading,
      wanderT: rand(0, 2),
      wanderA: heading,
      wanderTx: x,
      wanderTy: y,
      hold: 0,
      walk: rand(36, 62),
      speedMul: rand(0.82, 1.18),
      jump: 0,
      lift: 0,
      nap: 0,
    };
  }

  function inMeadow(x, y) {
    const n = screenToNorm(x, y);
    const span = walkSpan(n.y);
    if (!span) return false;
    return n.x >= span.l + 0.02 && n.x <= span.r - 0.02;
  }

  function spawnGrass() {
    if (state.grasses.length >= GRASS_CAP) return;
    let p = null;
    for (let i = 0; i < 16; i++) {
      const q = randomMeadowPos();
      const fixed = clampToWalk(q.x, q.y);
      if (inMeadow(fixed.x, fixed.y) && onScreen(fixed)) {
        p = fixed;
        break;
      }
    }
    if (!p) return;
    state.grasses.push({
      id: rid(),
      x: p.x,
      y: p.y,
      sway: rand(0, Math.PI * 2),
      scale: rand(0.86, 1.12),
      kind: Math.floor(rand(0, 3)),
    });
  }

  function atCap() {
    return state.cows.length >= MAX_COWS && state.sheep.length >= MAX_SHEEP;
  }

  function maybeSpawnDog() {
    if (state.leisure || state.dog) return;
    if (state.cows.length + state.sheep.length < DOG_NEED) return;
    const p = randomMeadowPos(80);
    state.dog = {
      x: p.x,
      y: state.meadowTop - 70,
      vx: 0,
      vy: 80,
      tx: p.x,
      ty: p.y,
      heading: Math.PI,
      bob: 0,
      born: 0,
      pose: "landing",
      idle: 0,
      ripple: 0,
    };
    for (const a of allAnimals()) pickWanderTarget(a);
  }

  function reset() {
    state.cows = [];
    state.sheep = [];
    state.grasses = [];
    state.hearts = [];
    state.bits = [];
    state.dog = null;
    state.cowProg = 0;
    state.sheepProg = 0;
    state.grassTimer = 0;
    state.nextId = 1;
    state.drag = null;
    state.napTimer = 0;
    crunchWait = 0;
    const spots = starterSpots(4);
    state.cows.push(makeAnimal("cow", spots[0].x, spots[0].y), makeAnimal("cow", spots[1].x, spots[1].y));
    state.sheep.push(makeAnimal("sheep", spots[2].x, spots[2].y), makeAnimal("sheep", spots[3].x, spots[3].y));
    spawnGrass();
    spawnGrass();
    updateHud();
  }

  function flashMeter(el) {
    if (!el) return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    window.setTimeout(() => el.classList.remove("flash"), 1400);
  }

  function unlockProgress() {
    const cowBorn = Math.max(0, Math.min(MAX_COWS, state.cows.length) - 2);
    const sheepBorn = Math.max(0, Math.min(MAX_SHEEP, state.sheep.length) - 2);
    const cowEats = cowBorn * COW_BIRTH + (state.cows.length >= MAX_COWS ? 0 : state.cowProg);
    const sheepEats = sheepBorn * SHEEP_BIRTH + (state.sheep.length >= MAX_SHEEP ? 0 : state.sheepProg);
    const need = (MAX_COWS - 2) * COW_BIRTH + (MAX_SHEEP - 2) * SHEEP_BIRTH;
    return clamp((cowEats + sheepEats) / need, 0, 1);
  }

  function paintSegs(id, filled, total) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.children.length !== total) {
      el.innerHTML = "";
      for (let i = 0; i < total; i++) el.appendChild(document.createElement("i"));
    }
    for (let i = 0; i < total; i++) el.children[i].className = i < filled ? "on" : "";
  }

  function updateHud() {
    const cows = clamp(state.cows.length, 0, MAX_COWS);
    const sheep = clamp(state.sheep.length, 0, MAX_SHEEP);
    const head = clamp(cows + sheep, 0, DOG_NEED);
    const cowFull = cows >= MAX_COWS;
    const sheepFull = sheep >= MAX_SHEEP;
    const cowGrass = clamp(cowFull ? COW_BIRTH : state.cowProg, 0, COW_BIRTH);
    const sheepGrass = clamp(sheepFull ? SHEEP_BIRTH : state.sheepProg, 0, SHEEP_BIRTH);
    paintSegs("cow-segs", cowGrass, COW_BIRTH);
    paintSegs("sheep-segs", sheepGrass, SHEEP_BIRTH);
    paintSegs("unlock-segs", head, DOG_NEED);
    ui.cowFrac.textContent = `${cowGrass}/${COW_BIRTH}`;
    ui.sheepFrac.textContent = `${sheepGrass}/${SHEEP_BIRTH}`;
    ui.unlockFrac.textContent = `${head}/${DOG_NEED}`;
    const grass = document.getElementById("grass-count");
    const cowN = document.getElementById("cow-count");
    const sheepN = document.getElementById("sheep-count");
    const dogN = document.getElementById("dog-count");
    if (grass) grass.textContent = `x${state.grasses.length}`;
    if (cowN) cowN.textContent = `${cows}/${MAX_COWS}`;
    if (sheepN) sheepN.textContent = `${sheep}/${MAX_SHEEP}`;
    if (dogN) dogN.textContent = `x${state.dog ? 1 : 0}`;
  }

  function remapXY(x, y, prev) {
    const nx = (x - prev.x) / prev.w;
    const ny = (y - prev.y) / prev.h;
    return { x: state.scene.x + nx * state.scene.w, y: state.scene.y + ny * state.scene.h };
  }

  function resize() {
    const prev = state.scene;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    canvas.style.width = `${state.w}px`;
    canvas.style.height = `${state.h}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    layoutScene();
    if (prev && prev.w > 0) {
      const move = (ent) => {
        const p = remapXY(ent.x, ent.y, prev);
        ent.x = p.x;
        ent.y = p.y;
        if (ent.wanderTx != null) {
          const t = remapXY(ent.wanderTx, ent.wanderTy, prev);
          ent.wanderTx = t.x;
          ent.wanderTy = t.y;
        }
        if (ent.tx != null) {
          const t = remapXY(ent.tx, ent.ty, prev);
          ent.tx = t.x;
          ent.ty = t.y;
        }
      };
      for (const a of allAnimals()) move(a);
      for (const g of state.grasses) move(g);
      if (state.dog) move(state.dog);
    }
    if (!state.clouds.length) {
      for (let i = 0; i < 6; i++) {
        state.clouds.push({
          x: rand(0, state.w),
          y: rand(24, state.meadowTop * 0.55),
          s: rand(0.7, 1.35),
          v: rand(4, 12),
        });
      }
    }
  }

  function allAnimals() {
    return state.cows.concat(state.sheep);
  }

  function hitAnimal(x, y) {
    const list = allAnimals();
    let best = null;
    let bestD = 1e9;
    for (const a of list) {
      const s = persp(a.y);
      const d = len(a.x - x, a.y - y);
      const reach = (a.type === "cow" ? 72 : 46) * s;
      if (d < reach && d < bestD) {
        best = a;
        bestD = d;
      }
    }
    return best;
  }

  function nearestGrass(x, y, range) {
    let best = null;
    let bestD = range;
    for (const g of state.grasses) {
      const d = len(g.x - x, g.y - y);
      if (d < bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  }

  function applyFriction(ent, friction, dt) {
    const damp = Math.exp(-friction * dt);
    ent.vx *= damp;
    ent.vy *= damp;
  }

  function clampSpeed(ent, max) {
    const s = len(ent.vx, ent.vy);
    if (s > max) {
      ent.vx = (ent.vx / s) * max;
      ent.vy = (ent.vy / s) * max;
    }
  }

  function bounceInMeadow(ent) {
    const beforeX = ent.x;
    const beforeY = ent.y;
    const fixed = clampToWalk(ent.x, ent.y);
    const hitX = Math.abs(fixed.x - beforeX) > 0.75;
    const hitY = Math.abs(fixed.y - beforeY) > 0.75;
    if (hitX) ent.vx *= 0.2;
    if (hitY) ent.vy *= 0.2;
    ent.x = fixed.x;
    ent.y = fixed.y;
    if (hitX || hitY) {
      ent.edgeHit = true;
      const ix = fixed.x - beforeX;
      const iy = fixed.y - beforeY;
      const id = len(ix, iy) || 1;
      ent.vx += (ix / id) * 12;
      ent.vy += (iy / id) * 10;
    }
  }

  function faceHeading(ent) {
    if (ent.face == null) ent.face = -1;
    if (ent.faceHold > 0) return;
    if ((ent.faceFlipCool || 0) > 0) return;
    if ((ent.stuckTime || 0) > 0.1) return;
    const need = state.leisure ? 14 : 3.2;
    let want = null;
    if (ent.vx > need) want = 1;
    else if (ent.vx < -need) want = -1;
    else {
      const aimX = ent.pose === "run" && ent.tx != null ? ent.tx : ent.wanderTx;
      const aimNeed = state.leisure ? 90 : 36;
      const moving = Math.abs(ent.vx) > (state.leisure ? 6 : 2.2);
      if (moving && aimX != null && Math.abs(aimX - ent.x) > aimNeed) {
        want = aimX > ent.x ? 1 : -1;
      }
    }
    if (want == null || want === ent.face) return;
    ent.face = want;
    ent.faceHold = state.leisure ? 1.35 : 0.35;
    ent.faceFlipCool = state.leisure ? 1.25 : 0.2;
  }

  function shouldFlip(ent) {
    faceHeading(ent);
    return ent.face === 1;
  }

  function edgeSteer(a) {
    const n = screenToNorm(a.x, a.y);
    const span = walkSpan(n.y);
    const margin = 0.04;
    let ax = 0;
    let ay = 0;
    if (!span) {
      const y0 = WALK[0][0];
      const y1 = WALK[WALK.length - 1][0];
      const n = screenToNorm(a.x, a.y);
      const ny = clamp(n.y, y0 + 0.02, y1 - 0.02);
      const back = walkSpan(ny);
      const nx = back ? clamp(n.x, back.l + 0.02, back.r - 0.02) : n.x;
      const backP = normToScreen(nx, ny);
      return { ax: (backP.x - a.x) * 1.1, ay: (backP.y - a.y) * 1.1 };
    }
    if (n.x < span.l + margin) ax += ((span.l + margin - n.x) / margin) * EDGE_PUSH;
    if (n.x > span.r - margin) ax -= ((n.x - (span.r - margin)) / margin) * EDGE_PUSH;
    const y0 = WALK[0][0];
    const y1 = WALK[WALK.length - 1][0];
    if (n.y < y0 + margin) ay += ((y0 + margin - n.y) / margin) * EDGE_PUSH;
    if (n.y > y1 - margin) ay -= ((n.y - (y1 - margin)) / margin) * EDGE_PUSH;
    return { ax, ay };
  }

  function centerMeadowPos() {
    for (let i = 0; i < 24; i++) {
      const ny = rand(0.56, 0.74);
      const span = walkSpan(ny);
      if (!span) continue;
      const mid = (span.l + span.r) / 2;
      const half = Math.min(0.1, (span.r - span.l) * 0.18);
      const p = normToScreen(rand(mid - half, mid + half), ny);
      if (onScreen(p)) return p;
    }
    return normToScreen(0.48, 0.66);
  }

  function starterSpots(n) {
    const spots = [];
    for (let i = 0; i < n; i++) {
      let p = centerMeadowPos();
      for (let k = 0; k < 16; k++) {
        const q = centerMeadowPos();
        if (spots.every((s) => len(s.x - q.x, s.y - q.y) > 120)) {
          p = q;
          break;
        }
      }
      spots.push(p);
    }
    return spots;
  }

  function spawnBeside(parent, type) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const depth = Math.random() < 0.5 ? 1 : -1;
    const gapX = (parent.type === "cow" ? 70 : 48) + (type === "cow" ? 58 : 40);
    const gapY = (type === "sheep" ? 78 : 96) * depth;
    const baby = makeAnimal(type, parent.x + side * gapX, parent.y + gapY);
    bounceInMeadow(baby);
    if (Math.abs(baby.y - parent.y) < 36) baby.y = parent.y + depth * 52;
    bounceInMeadow(baby);
    return baby;
  }

  function puffHeart(a) {
    state.hearts.push({ x: a.x, y: a.y - 28, t: 0 });
  }

  function grassBits(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      state.bits.push({
        x,
        y,
        vx: Math.cos(a) * rand(20, 70),
        vy: Math.sin(a) * rand(10, 40) - 40,
        t: 0,
        life: rand(0.35, 0.7),
        c: Math.random() > 0.5 ? "#7ec85a" : "#d7e38a",
      });
    }
  }

  function finishEat(a) {
    const g = a.eating;
    a.eating = null;
    a.eatT = 0;
    a.approach = null;
    if (!g) return;
    const idx = state.grasses.findIndex((x) => x.id === g.id);
    if (idx >= 0) state.grasses.splice(idx, 1);
    puffHeart(a);
    if (state.leisure) {
      updateHud();
      return;
    }
    if (a.type === "cow") {
      if (state.cows.length < MAX_COWS) {
        state.cowProg += 1;
        if (state.cowProg >= COW_BIRTH) {
          flashMeter(document.getElementById("cow-segs"));
          state.cows.push(spawnBeside(a, "cow"));
          state.cowProg = 0;
        }
      }
    } else if (state.sheep.length < MAX_SHEEP) {
      state.sheepProg += 1;
      if (state.sheepProg >= SHEEP_BIRTH) {
        flashMeter(document.getElementById("sheep-segs"));
        state.sheep.push(spawnBeside(a, "sheep"));
        state.sheepProg = 0;
      }
    }
    maybeSpawnDog();
    updateHud();
  }

  function startEat(a, grass) {
    if (state.dog && !state.leisure) return;
    if (a.eating) return;
    const g = grass || nearestGrass(a.x, a.y, EAT_RANGE);
    if (!g) return;
    if (allAnimals().some((o) => o !== a && ((o.eating && o.eating.id === g.id) || (o.approach && o.approach.id === g.id)))) {
      return;
    }
    a.eating = g;
    a.eatT = 0;
    a.approach = null;
    a.nap = 0;
    a.vx = 0;
    a.vy = 0;
    crunchWait = 0;
    playCrunch();
  }

  function beginApproach(a, g) {
    if (state.dog && !state.leisure) return;
    if (!g || a.eating) return;
    if (allAnimals().some((o) => o !== a && ((o.eating && o.eating.id === g.id) || (o.approach && o.approach.id === g.id)))) {
      return;
    }
    a.approach = g;
  }

  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function stirWind(x, y) {
    state.gust = 1;
    for (const g of state.grasses) {
      const d = len(g.x - x, g.y - y);
      if (d < 220) g.sway += 1.4;
    }
  }

  function noteInteract() {
    state.lastInteract = 0;
    for (const a of allAnimals()) a.nap = 0;
  }

  function sendDog(p) {
    if (!state.dog || state.dog.pose === "landing") return;
    const dest = clampToWalk(p.x, p.y);
    const d = state.dog;
    d.tx = dest.x;
    d.ty = dest.y;
    d.pose = "run";
    d.idle = 0;
    const dx = dest.x - d.x;
    const dy = dest.y - d.y;
    const dist = len(dx, dy) || 1;
    // Face the new click immediately — never keep old facing and moonwalk.
    if (Math.abs(dx) > 4) {
      d.face = dx > 0 ? 1 : -1;
      d.faceHold = 0.4;
      d.faceFlipCool = 0;
    }
    d.heading = Math.atan2(dy, dx);
    d.wanderTx = dest.x;
    d.wanderTy = dest.y;
    // Drop velocity against the new target so the dog accelerates forward.
    const toward = (d.vx * dx + d.vy * dy) / dist;
    if (toward < 8) {
      d.vx = (dx / dist) * Math.max(40, Math.abs(toward) * 0.2);
      d.vy = (dy / dist) * Math.max(40, Math.abs(toward) * 0.2);
    }
  }

  function meadowCruise() {
    return Math.max(state.w, 800) / 300;
  }

  function softRadius(ent) {
    const p = persp(ent.y || state.h * 0.7);
    if (ent.type === "cow") return 34 * p;
    if (ent.type === "sheep") return 20 * p;
    return 24 * p;
  }

  function nearEdge(a) {
    const n = screenToNorm(a.x, a.y);
    const span = walkSpan(n.y);
    if (!span) return true;
    const y0 = WALK[0][0];
    const y1 = WALK[WALK.length - 1][0];
    return (
      n.x < span.l + 0.06 ||
      n.x > span.r - 0.06 ||
      n.y < y0 + 0.05 ||
      n.y > y1 - 0.05
    );
  }

  function slideAlongEdge(a) {
    const n = screenToNorm(a.x, a.y);
    const span = walkSpan(n.y);
    if (!span) return;
    const y0 = WALK[0][0];
    const y1 = WALK[WALK.length - 1][0];
    let ix = 0;
    let iy = 0;
    if (n.x < span.l + 0.07) ix = 1;
    else if (n.x > span.r - 0.07) ix = -1;
    if (n.y < y0 + 0.05) iy = 1;
    else if (n.y > y1 - 0.05) iy = -1;
    if (!ix && !iy) return;
    const tx = iy === 0 ? 0 : -iy;
    const ty = ix === 0 ? 0 : ix;
    let sign = a.vx * tx + a.vy * ty;
    if (Math.abs(sign) < 12) sign = a.id % 2 === 0 ? 1 : -1;
    else sign = Math.sign(sign);
    a.vx += tx * sign * 46 + ix * 22;
    a.vy += ty * sign * 46 + iy * 16;
  }

  function nearCorner(a) {
    const n = screenToNorm(a.x, a.y);
    const span = walkSpan(n.y);
    if (!span) return false;
    const y0 = WALK[0][0];
    const y1 = WALK[WALK.length - 1][0];
    const side = n.x < span.l + 0.085 || n.x > span.r - 0.085;
    const vert = n.y < y0 + 0.075 || n.y > y1 - 0.075;
    return side && vert;
  }

  // Corner piles: slide along wall + soft inland, personal side so herd fans out.
  function cornerSideSpread(a, speed) {
    const n = screenToNorm(a.x, a.y);
    const span = walkSpan(n.y);
    if (!span) return { x: 0, y: 0 };
    const y0 = WALK[0][0];
    const y1 = WALK[WALK.length - 1][0];
    let ix = 0;
    let iy = 0;
    if (n.x < span.l + 0.09) ix = 1;
    else if (n.x > span.r - 0.09) ix = -1;
    if (n.y < y0 + 0.08) iy = 1;
    else if (n.y > y1 - 0.08) iy = -1;
    if (!ix && !iy) return { x: 0, y: 0 };
    const tx = iy === 0 ? 0 : -iy;
    const ty = ix === 0 ? 0 : ix;
    const sign = a.id % 2 === 0 ? 1 : -1;
    return {
      x: tx * sign * speed * 0.95 + ix * speed * 0.55,
      y: ty * sign * speed * 0.95 + iy * speed * 0.4,
    };
  }

  // Surrounded: retarget open pasture and peel forward/up-down (no reverse).
  function steerOutOfSurround(a, others, speed) {
    if (a.surroundCool > 0) return null;
    const squeezed = crowdSqueeze(a, others) >= 5;
    const boxed = isSurrounded(a, others);
    if (!squeezed && !boxed) return null;
    const spot = state.leisure ? pickLeisureFarOpen(a) : pickNearbyOpen(a);
    a.wanderTx = spot.x;
    a.wanderTy = spot.y;
    a.wanderT = rand(7, 13);
    a.hold = 0;
    a.surroundCool = 1.5;
    a.lastProg = len(spot.x - a.x, spot.y - a.y);
    const dx = spot.x - a.x;
    const dy = spot.y - a.y;
    const d = len(dx, dy) || 1;
    const want = dx >= 0 ? 1 : -1;
    if (want !== a.face && !(a.faceHold > 0) && !(a.faceFlipCool > 0)) {
      a.face = want;
      a.faceHold = 1.2;
      a.faceFlipCool = 1.05;
    }
    const faceFwd = a.face >= 0 ? 1 : -1;
    return {
      x: faceFwd * speed * 0.72 + (dx / d) * speed * 0.2,
      y: clamp((dy / d) * speed * 0.88, -speed * 0.92, speed * 0.92),
    };
  }

  function localCrowd(a, radius) {
    let n = 0;
    for (const o of allAnimals()) {
      if (o === a) continue;
      if (len(a.x - o.x, a.y - o.y) < radius) n++;
    }
    return n;
  }

  function pickLeisureFarOpen(a) {
    const mates = allAnimals();
    const personal = ((a.id * 47) % 628) / 100;
    const spanW = Math.max(state.w, 800);
    const minTravel = spanW * 0.24;
    let best = null;
    let bestScore = -Infinity;

    let cx = 0;
    let cy = 0;
    let cn = 0;
    for (const o of mates) {
      cx += o.x;
      cy += o.y;
      cn++;
    }
    if (cn > 0) {
      cx /= cn;
      cy /= cn;
    }

    // Four-quadrant personal sector preference.
    const quad = a.id % 4;
    const preferNx = quad === 0 || quad === 3 ? 0.28 : 0.72;
    const preferNy = quad === 0 || quad === 1 ? 0.58 : 0.78;

    for (let i = 0; i < 72; i++) {
      let p;
      if (i < 48) {
        p = randomMeadowPos();
      } else {
        const ang = personal + ((i - 48) / 24) * Math.PI * 2;
        const dist = rand(spanW * 0.28, spanW * 0.58);
        p = clampToWalk(a.x + Math.cos(ang) * dist, a.y + Math.sin(ang) * dist * 0.72);
      }
      if (!inMeadow(p.x, p.y)) continue;
      const travel = len(p.x - a.x, p.y - a.y);
      if (travel < minTravel) continue;
      const n = screenToNorm(p.x, p.y);
      const clear = edgeClearance(n.x, n.y);
      if (clear < 0.04) continue;

      // Open-space weight: fewer mates within 80px → higher score (zero = full).
      let near80 = 0;
      let nearest = Infinity;
      for (const o of mates) {
        if (o === a) continue;
        const d = len(p.x - o.x, p.y - o.y);
        if (d < nearest) nearest = d;
        if (d < 80) near80++;
      }
      const openScore = 1 - Math.min(1, near80 / 4);

      // Scatter weight: farther from herd center is better.
      const awayHerd = cn > 0 ? len(p.x - cx, p.y - cy) : travel;
      const scatterScore = Math.min(1, awayHerd / (spanW * 0.45));

      // Sector match (four quadrants).
      const sectorScore =
        1 -
        Math.min(1, Math.hypot(n.x - preferNx, (n.y - preferNy) * 1.2) / 0.55);

      // Distance band: boost mid range 30%~60% screen width.
      const ratio = travel / spanW;
      let distScore = 0;
      if (ratio >= 0.3 && ratio <= 0.6) distScore = 1;
      else if (ratio < 0.3) distScore = ratio / 0.3;
      else distScore = Math.max(0, 1 - (ratio - 0.6) / 0.35);

      let score =
        openScore * 4.2 +
        scatterScore * 3.1 +
        sectorScore * 2.4 +
        distScore * 2.8 +
        Math.min(clear, 0.14) * 2.2 +
        nearest * 0.01;
      score += Math.sin(n.y * 16 + personal) * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) return best;

    // Fallback: extend forward along facing ~1/3 screen — never 90px local hop.
    const faceAng = a.face >= 0 ? 0 : Math.PI;
    const fwd = clampToWalk(
      a.x + Math.cos(faceAng) * spanW * (1 / 3),
      a.y + Math.sin(faceAng + ((a.id % 2) - 0.5) * 0.35) * spanW * 0.12
    );
    if (inMeadow(fwd.x, fwd.y) && len(fwd.x - a.x, fwd.y - a.y) >= minTravel * 0.7) return fwd;
    for (let k = 0; k < 32; k++) {
      const p = randomMeadowPos();
      if (inMeadow(p.x, p.y) && len(p.x - a.x, p.y - a.y) >= minTravel * 0.8) return p;
    }
    return fwd;
  }

  // Leisure overlay only: depenetrate / near-sep / arrive slow — does not rewrite base motion.
  function leisureMoveOverlay(a, others, speed) {
    if (!state.leisure) return;
    // 1) Collision depenetration (highest priority).
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      const dx = a.x - o.x;
      const dy = a.y - o.y;
      const d = len(dx, dy);
      const diam = bodyRadius(a) + bodyRadius(o);
      if (d >= diam || d < 0.001) continue;
      const push = (diam - d) * 0.5;
      const nx = dx / d;
      const ny = dy / d;
      a.x += nx * push;
      a.y += ny * push;
      const closing = a.vx * -nx + a.vy * -ny;
      if (closing > 0) {
        a.vx += nx * closing;
        a.vy += ny * closing;
      }
    }

    // 2) Near-neighbor separation bias within 60px.
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      const dx = a.x - o.x;
      const dy = a.y - o.y;
      const d = len(dx, dy);
      if (d >= 60 || d < 0.001) continue;
      const w = (60 - d) / 60;
      sx += (dx / d) * w;
      sy += (dy / d) * w;
      sw += w;
    }
    if (sw > 0) {
      sx /= sw;
      sy /= sw;
      const sm = len(sx, sy) || 1;
      a.vx += (sx / sm) * speed * 0.35;
      a.vy += (sy / sm) * speed * 0.35;
    }

    // 3) Arrive slowdown within 15px of wander target.
    if (a.wanderTx != null) {
      const td = len(a.wanderTx - a.x, a.wanderTy - a.y);
      if (td < 15) {
        const minV = speed * 0.12;
        const k = td / 15;
        a.vx *= k;
        a.vy *= k;
        if (len(a.vx, a.vy) < minV) {
          a.vx = 0;
          a.vy = 0;
        }
      }
    }
  }

  function aimLeisureFar(a) {
    const spot = pickLeisureFarOpen(a);
    a.wanderTx = spot.x;
    a.wanderTy = spot.y;
    a.wanderT = rand(12, 22);
    a.hold = 0;
    a.stuck = 0;
    a.lastProg = len(spot.x - a.x, spot.y - a.y);
    a.edgeHit = false;
    const dx = spot.x - a.x;
    if (Math.abs(dx) > 24) {
      const want = dx > 0 ? 1 : -1;
      if (a.face !== want) {
        a.face = want;
        a.faceHold = 1.15;
        a.faceFlipCool = 1;
      }
    }
    return spot;
  }

  function pickNearbyOpen(a) {
    const mates = allAnimals();
    const personal = ((a.id * 47) % 628) / 100;
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 40; i++) {
      const ang = personal + (i / 40) * Math.PI * 2;
      const dist = rand(48, 150);
      const raw = { x: a.x + Math.cos(ang) * dist, y: a.y + Math.sin(ang) * dist };
      const p = clampToWalk(raw.x, raw.y);
      if (!inMeadow(p.x, p.y)) continue;
      const travel = len(p.x - a.x, p.y - a.y);
      if (travel < 32 || travel > 170) continue;
      const n = screenToNorm(p.x, p.y);
      const clear = edgeClearance(n.x, n.y);
      let crowd = 0;
      for (const o of mates) {
        if (o === a) continue;
        const d = len(p.x - o.x, p.y - o.y);
        if (d < 95) crowd += (95 - d) / 95;
      }
      let score = -crowd * 2.8 + Math.min(clear, 0.12) * 5;
      score += Math.sin(ang * 2.3 + a.id) * 0.35;
      if (state.dog && state.dog.pose !== "landing") {
        const dd = len(p.x - state.dog.x, p.y - state.dog.y);
        if (dd < 100) score -= (100 - dd) / 55;
      }
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) return best;
    const fallback = clampToWalk(a.x + Math.cos(personal) * 90, a.y + Math.sin(personal) * 90);
    return fallback;
  }

  function aimInlandWander(a) {
    const mates = allAnimals();
    const personal = ((a.id * 53) % 628) / 100;
    const spanW = Math.max(state.w, 800);
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 40; i++) {
      const ang = personal + (i / 40) * Math.PI * 2;
      const dist = rand(spanW * 0.16, spanW * 0.38);
      const raw = { x: a.x + Math.cos(ang) * dist, y: a.y + Math.sin(ang) * dist * 0.65 };
      const p = clampToWalk(raw.x, raw.y);
      if (!inMeadow(p.x, p.y)) continue;
      const travel = len(p.x - a.x, p.y - a.y);
      if (travel < spanW * 0.1) continue;
      const n = screenToNorm(p.x, p.y);
      const clear = edgeClearance(n.x, n.y);
      if (clear < 0.055) continue;
      let crowd = 0;
      for (const o of mates) {
        if (o === a) continue;
        const d = len(p.x - o.x, p.y - o.y);
        if (d < 110) crowd += (110 - d) / 110;
      }
      let score = clear * 12 - crowd * 1.6 + travel * 0.01;
      score += Math.sin(ang * 1.9 + a.id) * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) best = state.leisure ? pickLeisureFarOpen(a) : pickNearbyOpen(a);
    a.wanderTx = best.x;
    a.wanderTy = best.y;
    a.wanderT = rand(7, 14);
    a.hold = 0;
    a.stuck = 0;
    a.lastProg = len(best.x - a.x, best.y - a.y);
    a.edgeHit = false;
    const dx = best.x - a.x;
    const dy = best.y - a.y;
    const d = len(dx, dy) || 1;
    a.face = dx >= 0 ? 1 : -1;
    a.faceHold = 1.1;
    a.faceFlipCool = 0.9;
    const cruise = meadowCruise() * (a.speedMul || 1) * (state.leisure ? 2.8 : 1);
    a.vx = (dx / d) * cruise;
    a.vy = (dy / d) * cruise * 0.7;
    return best;
  }

  function aimNearbyOpen(a) {
    const spot = state.leisure ? pickLeisureFarOpen(a) : pickNearbyOpen(a);
    a.wanderTx = spot.x;
    a.wanderTy = spot.y;
    a.wanderT = state.leisure ? rand(9, 18) : rand(5, 11);
    a.hold = state.leisure ? 0 : rand(0.2, 0.7);
    a.stuck = 0;
    a.lastProg = len(spot.x - a.x, spot.y - a.y);
    a.edgeHit = false;
    return spot;
  }

  function edgeClearance(nx, ny) {
    const span = walkSpan(ny);
    if (!span) return 0;
    const y0 = WALK[0][0];
    const y1 = WALK[WALK.length - 1][0];
    return Math.min(nx - span.l, span.r - nx, ny - y0, y1 - ny);
  }

  function pickWanderTarget(a) {
    if (state.leisure) {
      aimLeisureFar(a);
      return;
    }
    if (nearEdge(a) || a.edgeHit) {
      aimInlandWander(a);
      return;
    }
    const here = screenToNorm(a.x, a.y);
    const mates = allAnimals();
    const edged = nearEdge(a) || a.edgeHit;
    a.edgeHit = false;
    let chosen = null;
    let best = -Infinity;
    const personal = ((a.id * 47) % 628) / 100;
    for (let i = 0; i < 48; i++) {
      const p = randomMeadowPos();
      const n = screenToNorm(p.x, p.y);
      const travel = Math.hypot((n.x - here.x) * 1.35, n.y - here.y);
      if (travel < 0.08 || travel > 0.38) continue;
      let score = travel * 2.6;
      score += Math.min(edgeClearance(n.x, n.y), 0.14) * 6;
      score += Math.sin(n.x * 20 + personal) * 0.4;
      let crowd = 0;
      for (const o of mates) {
        if (o === a) continue;
        const nd = len(p.x - o.x, p.y - o.y);
        if (nd < 110) crowd += (110 - nd) / 110;
      }
      if (state.dog && !state.leisure) {
        const dd = len(p.x - state.dog.x, p.y - state.dog.y);
        if (dd < 140) score -= (140 - dd) / 140 * 1.8;
      }
      score -= crowd * 1.2;
      if (score > best) {
        best = score;
        chosen = p;
      }
    }
    if (!chosen) chosen = pickNearbyOpen(a);
    a.wanderTx = chosen.x;
    a.wanderTy = chosen.y;
    a.stuck = 0;
    a.lastProg = len(chosen.x - a.x, chosen.y - a.y);
    const dist = Math.max(90, a.lastProg);
    a.wanderT = dist / (meadowCruise() * (a.speedMul || 1)) + rand(2, 6);
    a.hold = edged ? 0 : rand(0.2, 0.8);
  }

  function keepInside(ax, ay, a) {
    const n = screenToNorm(a.x, a.y);
    const span = walkSpan(n.y);
    if (!span) return { ax, ay };
    const y0 = WALK[0][0];
    const y1 = WALK[WALK.length - 1][0];
    let ix = 0;
    let iy = 0;
    if (n.x < span.l + 0.08) ix = 1;
    else if (n.x > span.r - 0.08) ix = -1;
    if (n.y < y0 + 0.06) iy = 1;
    else if (n.y > y1 - 0.06) iy = -1;
    if (!ix && !iy) return { ax, ay };
    const out = ax * -ix + ay * -iy;
    if (out > 0) {
      ax += ix * out;
      ay += iy * out;
    }
    const tx = iy === 0 ? 0 : -iy;
    const ty = ix === 0 ? 0 : ix;
    const tangent = ax * tx + ay * ty;
    if (Math.abs(tangent) < 80) {
      const sign = Math.abs(a.vx * tx + a.vy * ty) < 8 ? (a.id % 2 === 0 ? 1 : -1) : Math.sign(a.vx * tx + a.vy * ty);
      ax += tx * sign * 90;
      ay += ty * sign * 90;
    }
    ax += ix * 36;
    ay += iy * 24;
    return { ax, ay };
  }

  function softAvoid(a, vx, vy) {
    const base = meadowCruise() * 1.1;
    let ox = 0;
    let oy = 0;
    const bodies = allAnimals();
    if (state.dog && state.dog.pose !== "landing") bodies.push(state.dog);
    for (const o of bodies) {
      if (o === a) continue;
      let dx = a.x - o.x;
      let dy = a.y - o.y;
      let d = len(dx, dy);
      const want = softRadius(a) + softRadius(o) + 8 + (o.nap > 0 ? 22 : 0);
      if (d >= want) continue;
      if (d < 0.5) {
        const ang = ((a.id * 17 + (o.id || 3) * 11) % 628) / 100;
        dx = Math.cos(ang);
        dy = Math.sin(ang) * 0.7;
        d = 1;
      }
      const t = (want - d) / want;
      const soft = t * t * base;
      ox += (dx / d) * soft;
      oy += (dy / d) * soft * 0.65;
    }
    return { x: ox, y: oy };
  }

  function hopAnimal(a) {
    if (a.eating || a.approach) return;
    a.nap = 0;
    a.jump = 1;
    grassBits(a.x, a.y + 10);
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("pointerdown", (e) => {
    if (!state.playing) return;
    const p = toWorld(e);
    state.pointer.x = p.x;
    state.pointer.y = p.y;
    state.pointer.down = true;
    const a = hitAnimal(p.x, p.y);
    if (e.button === 2) {
      noteInteract();
      if (a) hopAnimal(a);
      else stirWind(p.x, p.y);
      return;
    }
    noteInteract();
    if (a && !a.eating && !a.approach) {
      state.drag = {
        animal: a,
        ox: p.x - a.x,
        oy: p.y - a.y,
        sx: p.x,
        sy: p.y,
        lx: a.x,
        ly: a.y,
        lt: performance.now(),
        moved: false,
      };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
      return;
    }
    if (state.dog && !state.leisure && state.dog.pose !== "landing") {
      sendDog(p);
      return;
    }
    stirWind(p.x, p.y);
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = toWorld(e);
    state.pointer.x = p.x;
    state.pointer.y = p.y;
    if (!state.drag) return;
    const d = len(p.x - state.drag.sx, p.y - state.drag.sy);
    if (d > DRAG_THRESHOLD) state.drag.moved = true;
    if (state.drag.moved) {
      const a = state.drag.animal;
      const nx = p.x - state.drag.ox;
      const ny = p.y - state.drag.oy;
      const afterDog = state.dog && !state.leisure;
      if (afterDog) {
        const now = performance.now();
        const step = Math.max(0.008, (now - (state.drag.lt || now)) / 1000);
        let vx = (nx - a.x) / step;
        let vy = (ny - a.y) / step;
        const sp = len(vx, vy);
        const cap = 240;
        if (sp > cap) {
          vx = (vx / sp) * cap;
          vy = (vy / sp) * cap;
        }
        a.vx = vx;
        a.vy = vy;
        if (Math.abs(vx) > 3.2) {
          a.face = vx > 0 ? 1 : -1;
          a.faceHold = 0.4;
        }
        state.drag.lt = now;
        state.drag.lx = a.x;
        state.drag.ly = a.y;
      } else {
        a.vx = 0;
        a.vy = 0;
      }
      a.x = nx;
      a.y = ny;
      a.lift = 1;
      bounceInMeadow(a);
    }
  });

  function endPointer(e) {
    const p = toWorld(e);
    state.pointer.down = false;
    if (state.drag) {
      const a = state.drag.animal;
      const moved = state.drag.moved;
      const afterDog = state.dog && !state.leisure;
      a.lift = 0;
      if (moved) {
        a.stuckTime = 0;
        a.flipHits = 0;
        a.hold = 0;
        if (afterDog) {
          a.faceHold = Math.max(a.faceHold || 0, 0.55);
          const dest = clampToWalk(a.x + a.vx * 0.45, a.y + a.vy * 0.45);
          a.wanderTx = dest.x;
          a.wanderTy = dest.y;
          a.wanderT = rand(6, 14);
        } else {
          a.vx = 0;
          a.vy = 0;
          const g = nearestGrass(a.x, a.y, NEAR_GRASS);
          if (g) beginApproach(a, g);
        }
      } else if (afterDog && state.dog.pose !== "landing") {
        sendDog(p);
      } else {
        startEat(a);
      }
      state.drag = null;
    }
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", () => {
    state.pointer.down = false;
    if (state.drag) {
      const a = state.drag.animal;
      a.lift = 0;
      if (state.drag.moved && !(state.dog && !state.leisure)) {
        a.vx = 0;
        a.vy = 0;
      }
      if (state.drag.moved && state.dog && !state.leisure) {
        a.faceHold = Math.max(a.faceHold || 0, 0.45);
        a.stuckTime = 0;
        a.flipHits = 0;
      }
      state.drag = null;
    }
  });

  function closeOverlay() {
    ui.overlay.classList.add("hidden");
    ui.overlay.hidden = true;
    ui.helpWrap.classList.add("hidden");
    ui.confirmWrap.classList.add("hidden");
    const then = state.helpThen;
    state.helpThen = null;
    if (then) then();
  }

  function showHelp(then) {
    state.helpThen = then || null;
    ui.confirmWrap.classList.add("hidden");
    ui.helpWrap.classList.remove("hidden");
    ui.overlay.hidden = false;
    ui.overlay.classList.remove("hidden");
  }

  function showConfirm() {
    state.helpThen = null;
    ui.helpWrap.classList.add("hidden");
    ui.confirmWrap.classList.remove("hidden");
    ui.overlay.hidden = false;
    ui.overlay.classList.remove("hidden");
  }

  function setMuted(on) {
    state.muted = on;
    ui.sound.classList.toggle("muted", on);
    ui.sound.classList.toggle("on", !on);
    if (on) {
      ui.bgm.pause();
      if (ui.eat && !ui.eat.paused) {
        ui.eat.pause();
        ui.eat.currentTime = 0;
      }
    }
    else if (state.playing) {
      ui.bgm.volume = 0.45;
      ui.bgm.play().catch(() => {});
    }
  }

  function setLeisure(on) {
    state.leisure = on;
    ui.leisure.classList.toggle("on", on);
    ui.leisure.setAttribute("aria-pressed", on ? "true" : "false");
    if (on) {
      for (const a of allAnimals()) pickWanderTarget(a);
    } else {
      maybeSpawnDog();
    }
  }

  function beginPlay() {
    ui.splash.classList.add("hidden");
    ui.splash.hidden = true;
    ui.hud.hidden = false;
    state.playing = true;
    audio();
    setMuted(false);
    reset();
  }

  ui.start.addEventListener("click", () => {
    audio();
    ui.splash.classList.add("hidden");
    ui.splash.hidden = true;
    showHelp(beginPlay);
  });

  ui.help.addEventListener("click", () => showHelp());
  ui.helpOk.addEventListener("click", () => closeOverlay());
  ui.restart.addEventListener("click", () => showConfirm());
  ui.confirmNo.addEventListener("click", () => closeOverlay());
  ui.confirmYes.addEventListener("click", () => {
    closeOverlay();
    reset();
  });
  ui.sound.addEventListener("click", () => setMuted(!state.muted));
  ui.leisure.addEventListener("click", () => setLeisure(!state.leisure));
  ui.collapse.addEventListener("click", () => {
    ui.panelWrap.classList.toggle("collapsed");
    ui.collapse.title = ui.panelWrap.classList.contains("collapsed") ? "展开进度" : "收起进度";
  });

  function updateDog(dt) {
    const d = state.dog;
    if (!d) return;
    if (d.faceHold > 0) d.faceHold -= dt;
    if (d.faceFlipCool > 0) d.faceFlipCool -= dt;
    if (state.leisure) {
      d.pose = "sit";
      d.bob += dt * 5.5;
      d.vx = 0;
      d.vy = 0;
      return;
    }
    d.bob += dt * (d.pose === "sit" ? 5.5 : 8);
    d.ripple = Math.max(0, d.ripple - dt);
    const landY = d.ty;
    if (d.pose === "landing") {
      d.born = Math.min(1, d.born + dt * 1.2);
      d.vy += 520 * dt;
      d.y += d.vy * dt;
      if (d.y >= landY) {
        d.y = landY;
        d.vy = 0;
        d.pose = "stand";
        d.idle = 0;
        d.ripple = 0.8;
      }
      return;
    }

    const dx = d.tx - d.x;
    const dy = d.ty - d.y;
    const dist = len(dx, dy);
    if (dist > DOG_ARRIVE) {
      d.pose = "run";
      d.idle = 0;
      const arrive = Math.min(1, dist / 90);
      const ax = (dx / dist) * DOG_ACCEL * arrive;
      const ay = (dy / dist) * DOG_ACCEL * arrive;
      d.vx += ax * dt;
      d.vy += ay * dt;
      // Face toward the click target while running — no reverse slide.
      if (Math.abs(dx) > 8) {
        const want = dx > 0 ? 1 : -1;
        if (d.face !== want) {
          d.face = want;
          d.faceHold = 0.3;
          d.faceFlipCool = 0;
        }
      } else if (Math.abs(d.vx) > 18) {
        d.face = d.vx > 0 ? 1 : -1;
      }
      // Kill sideways reverse component relative to facing.
      if (d.face === 1 && d.vx < 0) d.vx *= 0.25;
      if (d.face === -1 && d.vx > 0) d.vx *= 0.25;
      d.heading = Math.atan2(dy, dx);
      d.ripple = 0.9;
    } else {
      if (d.pose === "run") {
        d.pose = "stand";
        for (const a of allAnimals()) pickWanderTarget(a);
      }
      d.idle += dt;
      if (d.idle >= 5) d.pose = "sit";
      faceHeading(d);
    }

    applyFriction(d, DOG_FRICTION, dt);
    clampSpeed(d, d.pose === "run" ? DOG_MAX_SPEED : 70);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    bounceInMeadow(d, 16);
    if (d.pose === "run" && (nearEdge(d) || d.edgeHit)) {
      // Leave the wall toward the click instead of sticking / skating along it.
      const ix = d.tx - d.x;
      const iy = d.ty - d.y;
      const id = len(ix, iy) || 1;
      d.vx += (ix / id) * 55;
      d.vy += (iy / id) * 40;
      d.edgeHit = false;
      if (Math.abs(ix) > 8) {
        d.face = ix > 0 ? 1 : -1;
        d.faceHold = 0.35;
      }
    }
    if (len(d.vx, d.vy) > 12) d.heading = Math.atan2(d.vy, d.vx);
  }

  function fanDrive(a, dog) {
    const fx = Math.cos(dog.heading);
    const fy = Math.sin(dog.heading);
    const px = -fy;
    const py = fx;
    let rx = a.x - dog.x;
    let ry = a.y - dog.y;
    const dist = len(rx, ry);
    const range = fanRange();
    if (dist > range || dist < 1) return { ax: 0, ay: 0 };
    rx /= dist;
    ry /= dist;
    const ahead = rx * fx + ry * fy;
    const ang = Math.acos(clamp(ahead, -1, 1));
    if (ang > FAN_HALF) {
      const behind = Math.max(0, -ahead);
      return { ax: px * Math.sign(rx * px + ry * py || 1) * 70 * behind, ay: py * Math.sign(rx * px + ry * py || 1) * 70 * behind };
    }
    const falloff = 1 - dist / range;
    const side = rx * px + ry * py;
    const sideSign = side >= 0 ? 1 : -1;
    const spread = FAN_LATERAL * falloff * (0.35 + Math.abs(side));
    const push = FAN_FORWARD * falloff * (0.45 + ahead);
    const moving = Math.min(1, len(dog.vx, dog.vy) / 90);
    const poseMul = dog.pose === "run" ? 1 : dog.pose === "stand" ? 0.08 : 0.04;
    const idleBoost = poseMul * (0.55 + moving * 0.7);
    return {
      ax: (fx * push + px * sideSign * spread) * idleBoost,
      ay: (fy * push + py * sideSign * spread) * idleBoost,
    };
  }

  function bodyRadius(ent) {
    const p = persp(ent.y);
    return (ent.type === "cow" ? 50 : 28) * p;
  }

  function headOnPair(a, o) {
    const dx = o.x - a.x;
    const dy = o.y - a.y;
    const d = len(dx, dy);
    if (d < 0.8) return false;
    const gap = (bodyRadius(a) + bodyRadius(o)) * 1.08;
    if (d > gap) return false;
    const av = len(a.vx || 0, a.vy || 0);
    const ov = len(o.vx || 0, o.vy || 0);
    if (av < 0.6 || ov < 0.6) return false;
    const oppose = (a.vx * o.vx + a.vy * o.vy) / (av * ov);
    if (oppose > -0.3) return false;
    const closing = (a.vx * dx + a.vy * dy) / (av * d);
    return closing > 0.3;
  }

  function isSurrounded(a, others) {
    let blocked = 0;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      for (const o of others) {
        if (o === a || o.standWait > 0) continue;
        if (o.type !== "cow" && o.type !== "sheep") continue;
        if (o.eating || o.nap > 0) continue;
        const ox = o.x - a.x;
        const oy = o.y - a.y;
        const dist = len(ox, oy);
        if (dist > bodyRadius(a) + bodyRadius(o) + 28) continue;
        if (ox * dx + oy * dy > dist * 0.45) {
          blocked++;
          break;
        }
      }
    }
    return blocked >= 6;
  }

  function openSteer(a, others) {
    const step = meadowCruise() * (a.speedMul || 1);
    let best = null;
    let bestScore = 0.2;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + (a.id % 5) * 0.15;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      let score = 1;
      for (const o of others) {
        if (o === a || o.standWait > 0) continue;
        if (o.type !== "cow" && o.type !== "sheep") continue;
        const ox = o.x - a.x;
        const oy = o.y - a.y;
        const dist = len(ox, oy);
        const ahead = ox * dx + oy * dy;
        const reach = bodyRadius(a) + bodyRadius(o) + 30;
        if (ahead > 0 && dist < reach) score -= 1 - dist / reach;
      }
      const probe = clampToWalk(a.x + dx * 42, a.y + dy * 42);
      if (!inMeadow(probe.x, probe.y)) score -= 1.4;
      if (score > bestScore) {
        bestScore = score;
        best = { x: dx * step, y: dy * step };
      }
    }
    return best;
  }

  function holdStill(a, others) {
    if (clusterHasWaiter(a, others)) return;
    // Normal slow approach must not freeze — only true overlap deadlock.
    if (crowdSqueeze(a, others) < 5 && crowdCount(a, others) < 2) return;
    if (state.leisure && crowdSqueeze(a, others) < 4) return;
    a.standWait = rand(2, 3);
    a.vx = 0;
    a.vy = 0;
  }

  function applyFaceYield(a, others, dt) {
    a.faceYield = false;
    let partner = null;
    let best = Infinity;
    for (const o of others) {
      if (o === a || o.standWait > 0 || o.eating || o.nap > 0) continue;
      if (o.passTick !== state.tick) continue;
      if (!headOnPair(a, o)) continue;
      const d = len(a.x - o.x, a.y - o.y);
      if (d < best) {
        best = d;
        partner = o;
      }
    }
    if (!partner) return false;
    if (a.standCool > 0 || isSurrounded(a, others)) {
      if (!(a.standCool > 0)) holdStill(a, others);
      return true;
    }
    const open = openSteer(a, others);
    if (!open) {
      holdStill(a, others);
      return true;
    }
    const blend = 1 - Math.exp(-3 * dt);
    a.yieldX = (a.yieldX || 0) + (open.x - (a.yieldX || 0)) * blend;
    a.yieldY = (a.yieldY || 0) + (open.y - (a.yieldY || 0)) * blend;
    const nx = partner.x - a.x;
    const ny = partner.y - a.y;
    const nd = len(nx, ny) || 1;
    let vx = a.vx * 0.35 + a.yieldX * 0.65;
    let vy = a.vy * 0.35 + a.yieldY * 0.65;
    const into = vx * (nx / nd) + vy * (ny / nd);
    if (into > 0) {
      vx -= (nx / nd) * into;
      vy -= (ny / nd) * into;
    }
    const sp = len(vx, vy);
    const cap = meadowCruise() * 1.35;
    if (sp > cap) {
      vx = (vx / sp) * cap;
      vy = (vy / sp) * cap;
    }
    a.vx = vx;
    a.vy = vy;
    a.faceYield = sp < 1.2;
    return false;
  }

  function sepNeighbors(a, others) {
    const list = [];
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      if (o.standWait > 0 || a.standWait > 0) continue;
      if (headOnPair(a, o)) continue;
      let dx = a.x - o.x;
      let dy = a.y - o.y;
      const real = len(dx, dy);
      const gap = bodyRadius(a) + bodyRadius(o);
      if (real >= gap) continue;
      let d = real;
      if (d < 0.8) {
        const ang = ((a.id * 13 + o.id * 7) % 628) / 100;
        dx = Math.cos(ang);
        dy = Math.sin(ang) * 0.8;
        d = len(dx, dy);
      }
      list.push({ dx, dy, d, gap, real });
    }
    list.sort((p, q) => p.real - q.real);
    return list;
  }

  function sepRankWeight(i) {
    if (i < 2) return 1;
    if (i === 2) return 0.2;
    return 0.06;
  }

  function smoothBoid(a, others, dt) {
    let wx = 0;
    let wy = 0;
    const near = sepNeighbors(a, others);
    for (let i = 0; i < near.length; i++) {
      const o = near[i];
      const t = (o.gap - Math.min(o.d, o.gap)) / o.gap;
      const s = t * t * (3 - 2 * t);
      const mag = 78 * s * sepRankWeight(i);
      wx += (o.dx / o.d) * mag;
      wy += (o.dy / o.d) * mag * 0.85;
    }
    const wm = len(wx, wy);
    if (wm > 96) {
      wx = (wx / wm) * 96;
      wy = (wy / wm) * 96;
    }
    const blend = 1 - Math.exp(-2.6 * dt);
    a.sepX = (a.sepX || 0) + (wx - (a.sepX || 0)) * blend;
    a.sepY = (a.sepY || 0) + (wy - (a.sepY || 0)) * blend;
    return { x: a.sepX, y: a.sepY };
  }

  function easeApart(a, others) {
    let ox = 0;
    let oy = 0;
    const near = sepNeighbors(a, others);
    for (let i = 0; i < near.length; i++) {
      const o = near[i];
      const pen = o.gap - Math.min(o.d, o.gap);
      const w = Math.min(pen * 0.045, 0.9) * sepRankWeight(i);
      ox += (o.dx / o.d) * w;
      oy += (o.dy / o.d) * w * 0.85;
    }
    const m = len(ox, oy);
    if (m > 1.35) {
      ox = (ox / m) * 1.35;
      oy = (oy / m) * 1.35;
    }
    a.x += ox;
    a.y += oy;
  }

  function easeApartSoft(a, others) {
    const ease = a.sepEase == null ? 1 : a.sepEase;
    if (ease >= 0.98) {
      easeApart(a, others);
      return;
    }
    const x = a.x;
    const y = a.y;
    easeApart(a, others);
    a.x = x + (a.x - x) * ease;
    a.y = y + (a.y - y) * ease;
  }

  function nearMate(a, others) {
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      if (len(a.x - o.x, a.y - o.y) < bodyRadius(a) + bodyRadius(o) + 8) return true;
    }
    return false;
  }

  function watchJitter(a, others, dt) {
    const near = nearMate(a, others);
    const prevS = len(a.prevVx || 0, a.prevVy || 0);
    const nowS = len(a.vx, a.vy);
    const dot = (a.prevVx || 0) * a.vx + (a.prevVy || 0) * a.vy;
    if (near && prevS > 2.2 && nowS > 2.2 && dot < 0) a.sepFlips = (a.sepFlips || 0) + 1;
    a.prevVx = a.vx;
    a.prevVy = a.vy;
    a.sepWindow = (a.sepWindow || 0) + dt;
    if (a.lockX == null) {
      a.lockX = a.x;
      a.lockY = a.y;
    }
    if (a.sepWindow >= 0.5) {
      const travel = len(a.x - a.lockX, a.y - a.lockY);
      if (near && (a.sepFlips || 0) >= 3 && travel < 16) {
        a.sepLock = 0.75;
        if (!(a.nudgeT > 0)) {
          a.nudgeAng = rand(0, Math.PI * 2);
          a.nudgeT = 0.9;
        }
      }
      const pen = crowdSqueeze(a, others);
      // True deadlock only: overlapping + direction flicker + almost no travel.
      if (crowdCount(a, others) >= 2 && (a.sepFlips || 0) >= 3 && travel < 10 && pen > 5) {
        beginCrowdWait(a, others);
      }
      a.sepWindow = 0;
      a.sepFlips = 0;
      a.lockX = a.x;
      a.lockY = a.y;
    }
    if (a.sepLock > 0) a.sepLock -= dt;
    if (a.nudgeT > 0) a.nudgeT -= dt;
    const target = a.sepLock > 0 ? 0.34 : 1;
    const blend = 1 - Math.exp(-3.2 * dt);
    const ease = a.sepEase == null ? 1 : a.sepEase;
    a.sepEase = ease + (target - ease) * blend;
  }

  function pickOpenEscape(a) {
    let best = { x: 0, y: 0 };
    let bestScore = -Infinity;
    const mates = allAnimals();
    const personal = ((a.id * 47) % 628) / 100;
    for (let i = 0; i < 16; i++) {
      const ang = personal + (i / 16) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const probe = clampToWalk(a.x + dx * 72, a.y + dy * 72);
      const moved = len(probe.x - a.x, probe.y - a.y);
      if (moved < 8) continue;
      let score = moved;
      const n = screenToNorm(probe.x, probe.y);
      score += Math.min(edgeClearance(n.x, n.y), 0.16) * 420;
      for (const o of mates) {
        if (o === a) continue;
        const nd = len(probe.x - o.x, probe.y - o.y);
        if (nd < 110) score -= (110 - nd) * 0.7;
      }
      if (state.dog && state.dog.pose !== "landing") {
        const d0 = len(a.x - state.dog.x, a.y - state.dog.y);
        const d1 = len(probe.x - state.dog.x, probe.y - state.dog.y);
        score += (d1 - d0) * 1.5;
      }
      if (!inMeadow(probe.x, probe.y)) score -= 50;
      if (score > bestScore) {
        bestScore = score;
        best = { x: (probe.x - a.x) / moved, y: (probe.y - a.y) / moved };
      }
    }
    if (bestScore === -Infinity) {
      return { x: Math.cos(personal), y: Math.sin(personal) };
    }
    return best;
  }

  // Dog-pressure corner/jam burst only: short personal shove away from dog+edge, then normal Boids.
  function dogPressureEscape(a, others, dt) {
    if (!state.dog || state.leisure || state.dog.pose === "landing") {
      a.dogBurstT = 0;
      a.dogPressT = 0;
      return;
    }
    if (a.eating || a.approach || a.nap > 0) {
      a.dogBurstT = 0;
      a.dogPressT = 0;
      return;
    }
    if (state.drag && state.drag.animal === a) {
      a.dogBurstT = 0;
      a.dogPressT = 0;
      return;
    }

    if (a.dogBurstCool > 0) a.dogBurstCool -= dt;

    const dog = state.dog;
    const dogDist = len(a.x - dog.x, a.y - dog.y);
    const dogNear = dogDist < bodyRadius(a) + dogRadius(dog) + 118;
    let peers = 0;
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      if (len(a.x - o.x, a.y - o.y) < bodyRadius(a) + bodyRadius(o) + 20) peers++;
    }
    const edged = nearEdge(a) || a.edgeHit;
    const jammed = len(a.vx, a.vy) < meadowCruise() * 0.9;
    const pressured = dogNear && peers >= 1 && (edged || jammed);

    if (a.dogBurstT > 0) {
      a.dogBurstT -= dt;
      if ((!edged && dogDist > 132) || dogDist > 175 || a.dogBurstT <= 0) {
        a.dogBurstT = 0;
        return;
      }
    } else {
      if (pressured) a.dogPressT = (a.dogPressT || 0) + dt;
      else a.dogPressT = Math.max(0, (a.dogPressT || 0) - dt * 1.4);

      const need = edged ? 0.18 : 0.36;
      if ((a.dogPressT || 0) < need || a.dogBurstCool > 0) return;
      a.dogBurstT = 0.48;
      a.dogBurstCool = 0.95;
      a.dogPressT = 0;
    }

    let ax = a.x - dog.x;
    let ay = a.y - dog.y;
    let ad = len(ax, ay) || 1;
    ax /= ad;
    ay /= ad;
    const side = ((a.id % 5) - 2) * 0.28;
    const cs = Math.cos(side);
    const sn = Math.sin(side);
    let rx = ax * cs - ay * sn;
    let ry = ax * sn + ay * cs;
    const open = pickOpenEscape(a);
    rx = rx * 0.62 + open.x * 0.38;
    ry = ry * 0.62 + open.y * 0.38;
    const rd = len(rx, ry) || 1;
    rx /= rd;
    ry /= rd;

    const cruise = meadowCruise();
    const push = cruise * (edged ? 1.85 : 1.55);
    a.vx = a.vx * 0.28 + rx * push;
    a.vy = a.vy * 0.28 + ry * push;
    const slip = edged ? 6.5 : 5;
    const fixed = clampToWalk(a.x + rx * slip, a.y + ry * slip);
    a.x = fixed.x;
    a.y = fixed.y;
    const cap = cruise * 2.05;
    const sp = len(a.vx, a.vy);
    if (sp > cap) {
      a.vx = (a.vx / sp) * cap;
      a.vy = (a.vy / sp) * cap;
    }
    if (!(a.faceHold > 0) && Math.abs(rx) > 0.22) {
      a.face = rx > 0 ? 1 : -1;
      a.faceHold = 0.5;
    }
    a.flipHits = 0;
    a.stuckTime = 0;
  }

  // Local collision deadlock only: tiny side-step to break opposing vectors, then Boids resume.
  function microBreakDeadlock(a, others, dt) {
    if (a.deadlockCool > 0) {
      a.deadlockCool -= dt;
      return;
    }
    if (a.eating || a.approach || a.nap > 0) {
      a.deadlockT = 0;
      return;
    }
    if (state.drag && state.drag.animal === a) {
      a.deadlockT = 0;
      return;
    }
    if (!(state.dog || state.leisure)) {
      a.deadlockT = 0;
      return;
    }

    const speed = len(a.vx, a.vy);
    let nearest = null;
    let nearestD = Infinity;
    let nearN = 0;
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      if (o.eating || o.nap > 0) continue;
      const d = len(a.x - o.x, a.y - o.y);
      const gap = bodyRadius(a) + bodyRadius(o) + 16;
      if (d >= gap) continue;
      nearN++;
      if (d < nearestD) {
        nearestD = d;
        nearest = o;
      }
    }

    const cruise = meadowCruise();
    const verySlow = speed < cruise * 0.55;
    const wobble = (a.flipHits || 0) >= 1 && speed < cruise * 1.05;
    if (nearN >= 1 && (verySlow || wobble)) {
      a.deadlockT = (a.deadlockT || 0) + dt;
    } else {
      a.deadlockT = Math.max(0, (a.deadlockT || 0) - dt * 1.6);
      return;
    }

    const need = state.dog && !state.leisure ? 0.32 : 0.5;
    if ((a.deadlockT || 0) < need) return;

    // Per-animal outward fan so stuck pairs peel apart instead of sharing one path.
    let ang = ((a.id * 97) % 628) / 100 + rand(-0.55, 0.55);
    if (nearest) {
      const away = Math.atan2(a.y - nearest.y, a.x - nearest.x);
      const side = a.id % 2 === 0 ? 0.6 : -0.6;
      ang = away + side + rand(-0.2, 0.2);
    }

    const step = 9 + (a.id % 5);
    const fixed = clampToWalk(a.x + Math.cos(ang) * step, a.y + Math.sin(ang) * step);
    a.x = fixed.x;
    a.y = fixed.y;
    const impulse = cruise * (0.5 + (a.id % 3) * 0.06);
    a.vx += Math.cos(ang) * impulse;
    a.vy += Math.sin(ang) * impulse;
    if (!(a.faceHold > 0) && Math.abs(Math.cos(ang)) > 0.28) {
      a.face = Math.cos(ang) >= 0 ? 1 : -1;
      a.faceHold = 0.4;
    }
    a.deadlockT = 0;
    a.deadlockCool = 0.8;
    a.flipHits = 0;
    a.stuckTime = 0;
  }

  function softUnstick(a, dt) {
    if (a.faceHold > 0) a.faceHold -= dt;
    if (a.faceFlipCool > 0) a.faceFlipCool -= dt;
    const speed = len(a.vx, a.vy);
    const angle = Math.atan2(a.vy, a.vx);
    let flip = Math.abs(angle - (a.lastAngle || 0));
    if (flip > Math.PI) flip = Math.PI * 2 - flip;
    a.lastAngle = angle;

    const cruise = meadowCruise();
    // Leisure slow roam is normal — softUnstick only for true L/R flicker deadlock.
    const crawlMax = state.leisure ? cruise * 0.18 : cruise * 0.5;
    const dogNear =
      state.dog &&
      state.dog.pose !== "landing" &&
      len(a.x - state.dog.x, a.y - state.dog.y) < bodyRadius(a) + dogRadius(state.dog) + 96;
    const edged = nearEdge(a) || a.edgeHit;

    if (a.lockOx == null) {
      a.lockOx = a.x;
      a.lockOy = a.y;
    }

    const moveNeed = state.leisure ? 4 : 12;
    const moved = len(a.x - a.lockOx, a.y - a.lockOy);
    const trulySlow = speed < crawlMax;
    const barelyMoved = moved < moveNeed;

    if (trulySlow && barelyMoved) {
      a.stuckStill = (a.stuckStill || 0) + dt;
      a.stuckTime = (a.stuckTime || 0) + dt;
      if (flip > Math.PI / 3) a.flipHits = (a.flipHits || 0) + 1;
    } else {
      a.stuckStill = 0;
      a.stuckTime = 0;
      a.flipHits = 0;
      a.lockOx = a.x;
      a.lockOy = a.y;
      return;
    }

    const flickerStuck = (a.stuckStill || 0) > 1.05 && (a.flipHits || 0) >= 4;
    const dogCorner = edged && dogNear && (a.stuckStill || 0) > 0.55;
    const edgeStuck = edged && (a.stuckStill || 0) > 1.1 && (a.flipHits || 0) >= 2;
    const openStuck = (a.stuckStill || 0) > 1.25 && (a.flipHits || 0) >= 3;

    // Leisure: ONLY sustained in-place L/R flicker — never hold, never zero wander speed.
    let fire = false;
    if (state.leisure) fire = flickerStuck;
    else fire = flickerStuck || dogCorner || edgeStuck || openStuck;
    if (!fire) return;
    a.hold = 0;

    if (state.leisure) {
      const open = pickOpenEscape(a);
      const push = cruise * 0.85;
      // Additive peel only — keep existing wander velocity.
      a.vx += open.x * push;
      a.vy += open.y * push;
      const faceFwd = a.face >= 0 ? 1 : -1;
      if (faceFwd * a.vx < 0) a.vx = faceFwd * Math.abs(a.vx) * 0.3 + faceFwd * cruise * 0.45;
      a.stuckTime = 0;
      a.stuckStill = 0;
      a.flipHits = 0;
      a.lockOx = a.x;
      a.lockOy = a.y;
      return;
    }

    const spot = aimNearbyOpen(a);
    a.hold = 0;
    const dx = spot.x - a.x;
    const dy = spot.y - a.y;
    const d = len(dx, dy) || 1;
    const matesNear = localCrowd(a, 95);
    const sepFirst = matesNear >= 2 ? 0.4 : 1;
    const push = cruise * (dogCorner ? 1.35 : edgeStuck ? 1.15 : 1) * sepFirst;
    a.vx += (dx / d) * push;
    a.vy += (dy / d) * push;
    if (!(a.faceHold > 0)) {
      a.face = dx >= 0 ? 1 : -1;
      a.faceHold = 0.85;
      a.faceFlipCool = 0.7;
    }
    a.stuckTime = 0;
    a.stuckStill = 0;
    a.flipHits = 0;
    a.lockOx = a.x;
    a.lockOy = a.y;
  }

  function settleStall(a, vx, vy, sep) {
    const sp = len(vx, vy);
    const sepMag = len(sep.x, sep.y);
    const stalled = (a.sepLock > 0 && sp < 8) || (sepMag > 18 && sp < 1.8) || (a.faceYield && sp < 1.6);
    if (!stalled) return { x: vx, y: vy };
    if (!(a.nudgeT > 0)) {
      a.nudgeAng = rand(0, Math.PI * 2);
      a.nudgeT = 0.9;
    }
    const n = meadowCruise() * 0.4;
    return {
      x: vx + Math.cos(a.nudgeAng) * n,
      y: vy + Math.sin(a.nudgeAng) * n,
    };
  }

  function crowdCount(a, others) {
    let n = 0;
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      if (len(a.x - o.x, a.y - o.y) <= bodyRadius(a) + bodyRadius(o) + 14) n++;
    }
    return n;
  }

  function surroundScore(a, others) {
    return crowdCount(a, others) * 2 + crowdSqueeze(a, others);
  }

  function beginCrowdWait(a, others) {
    if (a.crowdWait > 0) return;
    if (clusterHasWaiter(a, others)) return;
    const n = crowdCount(a, others);
    if (n < 2) return;
    const pen = crowdSqueeze(a, others);
    if (pen < 5) return;
    // Outer animals keep moving; only the most enclosed one waits 2–3s.
    const mine = surroundScore(a, others);
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      if (len(a.x - o.x, a.y - o.y) > bodyRadius(a) + bodyRadius(o) + 40) continue;
      if (surroundScore(o, others) > mine + 0.8) return;
    }
    a.crowdWait = rand(2, 3);
    a.crowdHoldN = n;
  }

  function clusterHasWaiter(a, others) {
    const seen = {};
    const stack = [a];
    seen[a.id] = true;
    while (stack.length) {
      const cur = stack.pop();
      for (const o of others) {
        if (o === cur || seen[o.id]) continue;
        if (o.type !== "cow" && o.type !== "sheep") continue;
        const reach = bodyRadius(cur) + bodyRadius(o) + 48;
        if (len(cur.x - o.x, cur.y - o.y) > reach) continue;
        if (o.crowdWait > 0) return true;
        seen[o.id] = true;
        stack.push(o);
      }
    }
    return false;
  }

  function crowdSqueeze(a, others) {
    let pen = 0;
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      const d = len(a.x - o.x, a.y - o.y);
      const gap = bodyRadius(a) + bodyRadius(o);
      if (d < gap) pen += gap - d;
    }
    return pen;
  }

  function stepCrowdWait(a, others, dt) {
    if (!(a.crowdWait > 0)) return false;
    a.crowdWait -= dt;
    const n = crowdCount(a, others);
    const thinned = n < 2;
    const timeout = a.crowdWait <= 0;
    const pen = crowdSqueeze(a, others);
    if (pen > 8) a.crowdSqueeze = (a.crowdSqueeze || 0) + dt;
    else a.crowdSqueeze = 0;
    const pressed = (a.crowdSqueeze || 0) > 0.45;
    if (thinned || timeout || pressed) {
      a.crowdWait = 0;
      a.crowdSqueeze = 0;
      if (timeout && !thinned) {
        a.crowdSlip = rand(0, Math.PI * 2);
        a.crowdSlipT = 0.55;
      }
      if (state.leisure) {
        aimLeisureFar(a);
        a.hold = 0;
      }
      return false;
    }
    const prevEdge = a.edgeHit;
    const sep = smoothBoid(a, others, dt);
    const dogSep = smoothDogSep(a, dt);
    a.vx = sep.x * 0.32 + dogSep.x * 0.28;
    a.vy = sep.y * 0.32 + dogSep.y * 0.28;
    clampSpeed(a, meadowCruise() * 5);
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    easeApart(a, others);
    easeFromDog(a);
    bounceInMeadow(a);
    if (!prevEdge) a.edgeHit = false;
    return true;
  }

  function addCrowdSlip(a, vx, vy, dt) {
    if (!(a.crowdSlipT > 0)) return { x: vx, y: vy };
    a.crowdSlipT -= dt;
    const k = Math.max(a.crowdSlipT, 0) / 0.55;
    const n = meadowCruise() * 0.42 * k;
    return {
      x: vx + Math.cos(a.crowdSlip) * n,
      y: vy + Math.sin(a.crowdSlip) * n,
    };
  }

  function dogRadius(dog) {
    return 34 * persp(dog.y);
  }

  function smoothDogSep(a, dt) {
    const dog = state.dog;
    const blend = 1 - Math.exp(-2.2 * dt);
    if (!dog || dog.pose === "landing") {
      a.dogSepX = (a.dogSepX || 0) * (1 - blend);
      a.dogSepY = (a.dogSepY || 0) * (1 - blend);
      return { x: a.dogSepX, y: a.dogSepY };
    }
    let dx = a.x - dog.x;
    let dy = a.y - dog.y;
    let d = len(dx, dy);
    const gap = bodyRadius(a) + dogRadius(dog);
    const reach = gap + 72;
    let wx = 0;
    let wy = 0;
    if (d < reach) {
      if (d < 0.8) {
        const ang = ((a.id * 19) % 628) / 100;
        dx = Math.cos(ang);
        dy = Math.sin(ang) * 0.8;
        d = len(dx, dy);
      }
      const t = (reach - d) / reach;
      const s = t * t * (3 - 2 * t);
      const mag = 58 * s;
      wx = (dx / d) * mag;
      wy = (dy / d) * mag;
    }
    a.dogSepX = (a.dogSepX || 0) + (wx - (a.dogSepX || 0)) * blend;
    a.dogSepY = (a.dogSepY || 0) + (wy - (a.dogSepY || 0)) * blend;
    return { x: a.dogSepX, y: a.dogSepY };
  }

  function easeFromDog(a) {
    const dog = state.dog;
    if (!dog || dog.pose === "landing") return;
    let dx = a.x - dog.x;
    let dy = a.y - dog.y;
    let d = len(dx, dy);
    const gap = bodyRadius(a) + dogRadius(dog);
    if (d >= gap) return;
    if (d < 0.8) {
      const ang = ((a.id * 19) % 628) / 100;
      dx = Math.cos(ang);
      dy = Math.sin(ang) * 0.8;
      d = len(dx, dy);
    }
    const w = Math.min((gap - d) * 0.035, 1);
    a.x += (dx / d) * w;
    a.y += (dy / d) * w;
  }

  function stripTowardDog(ax, ay, a) {
    const dog = state.dog;
    if (!dog || dog.pose === "landing") return { ax, ay };
    const dx = dog.x - a.x;
    const dy = dog.y - a.y;
    const d = len(dx, dy);
    const reach = bodyRadius(a) + dogRadius(dog) + 80;
    if (d >= reach || d < 1) return { ax, ay };
    const nx = dx / d;
    const ny = dy / d;
    const toward = ax * nx + ay * ny;
    if (toward <= 0) return { ax, ay };
    const t = (reach - d) / reach;
    const s = t * t * (3 - 2 * t);
    const cut = toward * 0.62 * s;
    return { ax: ax - nx * cut, ay: ay - ny * cut };
  }

  function flockSteer(a, others, dt) {
    const sense = 128;
    let n = 0;
    let svx = 0;
    let svy = 0;
    let cx = 0;
    let cy = 0;
    for (const o of others) {
      if (o === a) continue;
      if (o.type !== "cow" && o.type !== "sheep") continue;
      if (len(o.x - a.x, o.y - a.y) > sense) continue;
      n++;
      svx += o.vx;
      svy += o.vy;
      cx += o.x;
      cy += o.y;
    }
    const density = clamp((n - 1) / 4, 0, 1);
    const alignKeep = 1 - density * 0.86;
    const own = meadowCruise() * (a.speedMul || 1);
    let wx = 0;
    let wy = 0;
    if (n > 0) {
      const nv = len(svx, svy);
      if (nv > 2) {
        wx += (svx / nv) * own * 0.3 * alignKeep;
        wy += (svy / nv) * own * 0.3 * alignKeep;
      }
      if (density > 0.12) {
        let sx = a.x - cx / n;
        let sy = a.y - cy / n;
        const sd = len(sx, sy);
        if (sd < 1) {
          const ang = ((a.id * 17) % 628) / 100;
          sx = Math.cos(ang);
          sy = Math.sin(ang) * 0.85;
        } else {
          sx /= sd;
          sy /= sd;
        }
        wx += sx * own * (2.4 + density * 5.2) * density;
        wy += sy * own * (2.4 + density * 5.2) * density;
      }
    }
    const blend = 1 - Math.exp(-2.2 * dt);
    a.flockX = (a.flockX || 0) + (wx - (a.flockX || 0)) * blend;
    a.flockY = (a.flockY || 0) + (wy - (a.flockY || 0)) * blend;
    return { x: a.flockX, y: a.flockY };
  }

  function updateAnimal(a, dt, others) {
    faceHeading(a);
    a.bob += dt * 3.2;
    a.jump = Math.max(0, a.jump - dt * 1.8);
    a.lift = state.drag && state.drag.animal === a ? 1 : Math.max(0, a.lift - dt * 4);
    if (state.drag && state.drag.animal === a) return;

    if (state.dog && !state.leisure && state.dog.pose !== "landing") {
      const dogDist = len(a.x - state.dog.x, a.y - state.dog.y);
      if (dogDist < 155) {
        a.nap = 0;
        a.standWait = 0;
        a.crowdWait = 0;
        if (a.eating || a.approach) {
          a.eating = null;
          a.approach = null;
          a.eatT = 0;
          aimNearbyOpen(a);
          a.hold = 0;
        }
      }
    }

    if (a.nap > 0) {
      if (state.dog && !state.leisure && state.dog.pose !== "landing") {
        if (len(a.x - state.dog.x, a.y - state.dog.y) < 95) {
          a.nap = 0;
        }
      }
      if (a.nap > 0) {
        a.nap -= dt;
        a.vx = 0;
        a.vy = 0;
        return;
      }
    }

    if (a.approach && !a.eating) {
      const g = a.approach;
      const still = state.grasses.some((x) => x.id === g.id);
      if (!still) {
        a.approach = null;
      } else {
        const dx = g.x - a.x;
        const dy = g.y + 8 - a.y;
        const d = len(dx, dy);
        if (d < 14) startEat(a, g);
        else {
          a.x += dx * Math.min(1, dt * 5);
          a.y += dy * Math.min(1, dt * 5);
        }
        return;
      }
    }

    if (a.eating) {
      a.eatT += dt * 1000;
      const g = a.eating;
      a.x += (g.x - a.x) * Math.min(1, dt * 6);
      a.y += (g.y + 10 - a.y) * Math.min(1, dt * 6);
      if (a.eatT >= EAT_MS) finishEat(a);
      return;
    }

    a.passTick = state.tick;
    if (a.standCool > 0) a.standCool -= dt;
    if (a.standWait > 0) {
      a.standWait -= dt;
      const free = !isSurrounded(a, others);
      if (free || a.standWait <= 0) {
        a.standWait = 0;
        if (!free) a.standCool = 0.35;
      } else {
        a.vx = 0;
        a.vy = 0;
        return;
      }
    }

    if (stepCrowdWait(a, others, dt)) return;

    let ax = 0;
    let ay = 0;
    const herding = state.dog && !state.leisure && state.dog.pose === "run";
    const roam = state.dog || state.leisure;
    if (herding) a.hold = 0;

    if (roam && !herding) {
      if (state.leisure) a.hold = 0;
      if (a.hold > 0 && !nearEdge(a) && localCrowd(a, 100) < 2) {
        a.hold -= dt;
        a.vx = 0;
        a.vy = 0;
        return;
      }
      a.hold = 0;
      if (a.openCool > 0) a.openCool -= dt;
      if (a.surroundCool > 0) a.surroundCool -= dt;
      const crowded = localCrowd(a, 100) >= 2;
      const edged = nearEdge(a) || a.edgeHit;
      if (crowded && !state.leisure) {
        a.crowdAim = (a.crowdAim || 0) + dt;
        if (a.crowdAim > 0.5 && !(a.openCool > 0)) {
          aimNearbyOpen(a);
          a.openCool = 1.8;
          a.crowdAim = 0;
          a.hold = 0;
        }
      } else {
        a.crowdAim = 0;
      }
      if (a.edgeHit || (edged && !(a.openCool > 0))) {
        aimInlandWander(a);
        a.openCool = 1.2;
        a.edgeHit = false;
      }
      let dx = a.wanderTx - a.x;
      let dy = a.wanderTy - a.y;
      let d = len(dx, dy);
      a.wanderT -= dt;
      // Leisure: commit until near target (~15px) or timer; overlay handles arrive slowdown.
      const arriveR = state.leisure ? 15 : 36;
      if (a.wanderT <= 0 || d < arriveR) {
        pickWanderTarget(a);
        dx = a.wanderTx - a.x;
        dy = a.wanderTy - a.y;
        d = len(dx, dy);
        if (d < 1) return;
      }
      if (state.leisure && localCrowd(a, 60) >= 3) {
        a.clumpT = (a.clumpT || 0) + dt;
        if (a.clumpT >= 2) {
          aimLeisureFar(a);
          a.clumpT = 0;
          a.hold = 0;
          dx = a.wanderTx - a.x;
          dy = a.wanderTy - a.y;
          d = len(dx, dy) || 1;
        }
      } else {
        a.clumpT = 0;
      }
      const speed = meadowCruise() * (a.speedMul || 1) * (state.leisure ? 2.85 : 1);
      if (a.lastProg == null) a.lastProg = d;
      if (d < a.lastProg - 6) {
        a.lastProg = d;
        a.stuck = 0;
      } else a.stuck = (a.stuck || 0) + dt;
      if (a.stuck > 3.2) {
        if (state.leisure) aimLeisureFar(a);
        else aimNearbyOpen(a);
        a.hold = 0;
        a.stuck = 0;
        dx = a.wanderTx - a.x;
        dy = a.wanderTy - a.y;
        d = len(dx, dy) || 1;
      }
      const dirx = dx / d;
      const diry = dy / d;
      watchJitter(a, others, dt);
      // Leisure always keeps wander pull; dog-mode crowded uses sep-first.
      const sepFirst = crowded && !state.leisure;
      let vx;
      let vy;
      const peel = state.leisure ? steerOutOfSurround(a, others, speed) : null;
      if (peel) {
        vx = peel.x;
        vy = peel.y;
        dx = a.wanderTx - a.x;
        dy = a.wanderTy - a.y;
        d = len(dx, dy) || 1;
      } else if (sepFirst) {
        vx = 0;
        vy = 0;
      } else if (state.leisure) {
        // Forward walk + small vertical adjust toward open (no reverse slide).
        if (!(a.faceHold > 0) && !(a.faceFlipCool > 0) && Math.abs(dx) > 48) {
          const want = dx > 0 ? 1 : -1;
          if (want !== a.face) {
            a.face = want;
            a.faceHold = 1.35;
            a.faceFlipCool = 1.25;
          }
        }
        const faceFwd = a.face >= 0 ? 1 : -1;
        vx = faceFwd * speed * 0.82 + Math.max(-0.15, Math.min(0.15, dirx * faceFwd)) * speed * 0.18 * faceFwd;
        vy = clamp(diry * speed * 0.62, -speed * 0.8, speed * 0.8);
      } else {
        vx = dirx * speed;
        vy = diry * speed;
      }
      if (edged) {
        const open = pickOpenEscape(a);
        vx += open.x * speed * 0.45;
        vy += open.y * speed * 0.45;
      }
      if (nearCorner(a)) {
        const side = cornerSideSpread(a, speed);
        vx += side.x;
        vy += side.y;
        const faceFwd = a.face >= 0 ? 1 : -1;
        if (faceFwd * vx < speed * 0.25) vx = faceFwd * speed * 0.55;
        if (!(a.faceHold > 0) && Math.abs(vx) > speed * 0.35) {
          a.face = vx > 0 ? 1 : -1;
          a.faceHold = 0.9;
          a.faceFlipCool = 0.85;
        }
      }
      const avoid = softAvoid(a, vx, vy);
      vx += avoid.x * 0.45;
      vy += avoid.y * 0.45;
      if (!sepFirst) {
        if (!state.leisure) {
          const forward = vx * dirx + vy * diry;
          const minFwd = speed * 0.5;
          if (forward < minFwd) {
            vx += dirx * (minFwd - forward);
            vy += diry * (minFwd - forward);
          }
        } else {
          const faceFwd = a.face >= 0 ? 1 : -1;
          if (faceFwd * vx < speed * 0.4) vx = faceFwd * speed * 0.65;
          vy = clamp(vy, -speed * 0.85, speed * 0.85);
        }
      }
      const sp = len(vx, vy);
      const capMul = sepFirst ? 1.15 : state.leisure ? 1.25 : 1.35;
      if (sp > speed * capMul) {
        vx = (vx / sp) * speed * capMul;
        vy = (vy / sp) * speed * capMul;
      }
      const sep = smoothBoid(a, others, dt);
      const dogSep = smoothDogSep(a, dt);
      const flock = flockSteer(a, others, dt);
      const ease = a.sepEase == null ? 1 : a.sepEase;
      const sepMul = sepFirst ? 0.78 : state.leisure ? 0.34 : 0.42;
      const flockX = state.leisure ? flock.x * 0.22 : flock.x;
      const flockY = state.leisure ? flock.y * 0.4 : flock.y;
      vx += sep.x * sepMul * ease + dogSep.x * 0.3 + flockX;
      vy += sep.y * sepMul * ease + dogSep.y * 0.3 + flockY;
      if (state.leisure) {
        const faceFwd = a.face >= 0 ? 1 : -1;
        // Separation may shove sideways/back — keep forward bias, allow vertical peel.
        if (faceFwd * vx < speed * 0.28) vx = faceFwd * speed * 0.5 + vx * 0.2;
        vy = clamp(vy, -speed * 0.95, speed * 0.95);
      }
      const settled = settleStall(a, vx, vy, sep);
      a.vx = settled.x;
      a.vy = settled.y;
      if (state.leisure) {
        const faceFwd = a.face >= 0 ? 1 : -1;
        if (faceFwd * a.vx < 0) a.vx = faceFwd * Math.abs(a.vx) * 0.25 + faceFwd * speed * 0.45;
      }
      if (applyFaceYield(a, others, dt) && a.standWait > 0) return;
      const slipped = addCrowdSlip(a, a.vx, a.vy, dt);
      a.vx = slipped.x;
      a.vy = slipped.y;
      if (state.leisure) {
        const faceFwd = a.face >= 0 ? 1 : -1;
        if (faceFwd * a.vx < 0) a.vx = faceFwd * speed * 0.4;
        a.hold = 0;
      }
      softUnstick(a, dt);
      microBreakDeadlock(a, others, dt);
      dogPressureEscape(a, others, dt);
      faceHeading(a);
      if (state.leisure) leisureMoveOverlay(a, others, speed);
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      easeApartSoft(a, others);
      easeFromDog(a);
      bounceInMeadow(a);
      if (a.edgeHit) {
        aimInlandWander(a);
      }
      return;
    }

    if (roam) {
      a.wanderT -= dt;
      const dx = a.wanderTx - a.x;
      const dy = a.wanderTy - a.y;
      const d = len(dx, dy);
      if (a.wanderT <= 0 || d < 28 || a.edgeHit) {
        a.edgeHit = false;
        pickWanderTarget(a);
      } else {
        const pull = stripTowardDog(
          (dx / Math.max(d, 1)) * WANDER_ACCEL * 0.55,
          (dy / Math.max(d, 1)) * WANDER_ACCEL * 0.55,
          a
        );
        ax += pull.ax;
        ay += pull.ay;
      }
    } else {
      a.vx = 0;
      a.vy = 0;
      return;
    }

    const edge = edgeSteer(a);
    ax += edge.ax * (herding ? 0.35 : 1);
    ay += edge.ay * (herding ? 0.35 : 1);

    if (herding) {
      const fade = 1 - Math.exp(-2.2 * dt);
      a.flockX = (a.flockX || 0) * (1 - fade);
      a.flockY = (a.flockY || 0) * (1 - fade);
      const fan = fanDrive(a, state.dog);
      const loose = stripTowardDog(fan.ax, fan.ay, a);
      const kept = keepInside(loose.ax, loose.ay, a);
      ax += kept.ax;
      ay += kept.ay;
      const avoid = softAvoid(a, a.vx, a.vy);
      ax += avoid.x * 1.4;
      ay += avoid.y * 1.4;
    } else if (!roam) {
      ax *= 0.2;
      ay *= 0.2;
      applyFriction(a, 8, dt);
    }

    const sep = smoothBoid(a, others, dt);
    const dogSep = smoothDogSep(a, dt);
    watchJitter(a, others, dt);
    const ease = a.sepEase == null ? 1 : a.sepEase;
    ax += sep.x * ease + dogSep.x;
    ay += sep.y * ease + dogSep.y;

    a.vx += ax * dt;
    a.vy += ay * dt;
    applyFriction(a, ANIMAL_FRICTION, dt);
    const cap =
      (herding ? ANIMAL_MAX_SPEED : (a.walk || IDLE_MAX_SPEED) * (state.leisure ? 0.36 : 0.5)) * pace();
    clampSpeed(a, cap);
    const settled = settleStall(a, a.vx, a.vy, sep);
    a.vx = settled.x;
    a.vy = settled.y;
    if (applyFaceYield(a, others, dt) && a.standWait > 0) return;
    const slipped = addCrowdSlip(a, a.vx, a.vy, dt);
    a.vx = slipped.x;
    a.vy = slipped.y;
    softUnstick(a, dt);
    microBreakDeadlock(a, others, dt);
    dogPressureEscape(a, others, dt);
    faceHeading(a);
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    easeApartSoft(a, others);
    easeFromDog(a);
    bounceInMeadow(a);
    if (herding && a.edgeHit) {
      a.edgeHit = false;
      slideAlongEdge(a);
    } else if (a.edgeHit && roam) {
      a.edgeHit = false;
      pickWanderTarget(a);
    }
  }

  function update(dt) {
    state.wind += dt + state.gust * dt * 4;
    state.gust = Math.max(0, state.gust - dt * 1.4);
    if (!state.leisure && !atCap() && state.grasses.length < GRASS_CAP) {
      state.grassTimer += dt * 1000;
      while (state.grassTimer >= GRASS_EVERY && state.grasses.length < GRASS_CAP) {
        state.grassTimer -= GRASS_EVERY;
        for (let i = 0; i < GRASS_PER_WAVE; i++) spawnGrass();
        updateHud();
      }
    } else {
      state.grassTimer = 0;
    }

    for (const c of state.clouds) {
      c.x += c.v * dt;
      if (c.x > state.w + 80) {
        c.x = -80;
        c.y = rand(24, state.meadowTop * 0.55);
      }
    }

    const herd = allAnimals();
    state.tick = (state.tick || 0) + 1;
    state.lastInteract += dt;
    state.napTimer += dt;
    if (state.napTimer >= NAP_EVERY) {
      state.napTimer = 0;
      const pool = herd.filter(
        (a) => !a.eating && !a.approach && a.nap <= 0 && !(state.drag && state.drag.animal === a)
      );
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      const n = Math.min(2, pool.length);
      for (let i = 0; i < n; i++) pool[i].nap = NAP_HOLD;
    }
    for (const a of herd) updateAnimal(a, dt, herd);
    updateDog(dt);
    updateChew(dt);

    for (const h of state.hearts) h.t += dt;
    state.hearts = state.hearts.filter((h) => h.t < 1.1);
    for (const b of state.bits) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 90 * dt;
    }
    state.bits = state.bits.filter((b) => b.t < b.life);
  }

  function readyImg(im) {
    return im && im.complete && im.naturalWidth > 0;
  }

  function drawScene() {
    if (!state.scene) layoutScene();
    ctx.fillStyle = "#74b56f";
    ctx.fillRect(0, 0, state.w, state.h);
    const im = SPR.scene;
    if (!readyImg(im)) return;
    const s = state.scene;
    ctx.drawImage(im, s.x, s.y, s.w, s.h);
  }

  function drawSprite(img, x, y, scale, flip, rot) {
    if (!readyImg(img)) return;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(img, -dw / 2, -dh + 8, dw, dh);
    ctx.restore();
  }

  function animalFrame(a) {
    const set = SPR[a.type];
    if (a.lift > 0.35) return set.drag;
    if (a.jump > 0.12) return set.jump;
    if (a.nap > 0) return set.sleep;
    if (a.eating) {
      const f = 1 + Math.floor((a.eatT / 220) % 3);
      return set["eat" + f] || set.eat1;
    }
    if (a.approach) return set.eat1;
    if (len(a.vx, a.vy) > 3) {
      const f = 1 + (Math.floor(a.bob * 2.2) % 2);
      return set["walk" + f] || set.idle;
    }
    return set.idle;
  }

  function drawGrassTuft(g) {
    const near =
      state.drag &&
      len(state.drag.animal.x - g.x, state.drag.animal.y - g.y) < NEAR_GRASS;
    const s = persp(g.y) * g.scale * 0.32;
    if (near) {
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.x, g.y, NEAR_GRASS * persp(g.y), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const img = SPR.grass[g.kind] || SPR.grass[0];
    const sway = Math.sin(state.wind * 1.6 + g.sway) * (0.08 + state.gust * 0.2);
    drawSprite(img, g.x, g.y, s, false, sway);
  }

  function drawProgress(x, y, t, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();
    ctx.restore();
  }

  function drawAnimal(a) {
    const bounce = a.jump * -14;
    const s = persp(a.y) * (a.type === "cow" ? 0.56 : 0.28);
    const flip = shouldFlip(a);
    drawSprite(animalFrame(a), a.x, a.y + bounce, s, flip);
    if (a.eating) drawProgress(a.x, a.y - 40 * persp(a.y), clamp(a.eatT / EAT_MS, 0, 1), "#c48a4a");
  }

  function drawDog() {
    const d = state.dog;
    if (!d) return;
    const s = persp(d.y) * 0.42;
    const flip = shouldFlip(d);
    const runFrames = ["walk1", "walk2", "walk3", "herd", "walk4"];
    let frame = SPR.dog.idle;
    if (d.pose === "landing") frame = SPR.dog.land;
    else if (d.pose === "sit") frame = Math.floor(d.bob) % 2 === 0 ? SPR.dog.sit1 : SPR.dog.sit2;
    else if (d.pose === "run" || len(d.vx, d.vy) > 16) {
      frame = SPR.dog[runFrames[Math.floor(d.bob * 1.7) % runFrames.length]] || SPR.dog.walk1;
    }
    drawSprite(frame, d.x, d.y, s, flip);
  }

  function drawHeart(h) {
    const k = h.t / 1.1;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.translate(h.x, h.y - k * 28);
    ctx.scale(0.7 + k * 0.2, 0.7 + k * 0.2);
    ctx.fillStyle = "#e58a8a";
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-12, -4, -7, -14, 0, -8);
    ctx.bezierCurveTo(7, -14, 12, -4, 0, 6);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, state.w, state.h);
    drawScene();

    const drawables = [];
    for (const g of state.grasses) drawables.push({ y: g.y, draw: () => drawGrassTuft(g) });
    for (const a of state.cows) drawables.push({ y: a.y, id: a.id, draw: () => drawAnimal(a) });
    for (const a of state.sheep) drawables.push({ y: a.y, id: a.id, draw: () => drawAnimal(a) });
    if (state.dog) drawables.push({ y: state.dog.y, id: 0, draw: drawDog });
    for (const h of state.hearts) drawables.push({ y: h.y, draw: () => drawHeart(h) });
    for (const b of state.bits) {
      drawables.push({
        y: b.y,
        draw: () => {
          ctx.fillStyle = b.c;
          ctx.globalAlpha = 1 - b.t / b.life;
          ctx.fillRect(b.x, b.y, 3, 5);
          ctx.globalAlpha = 1;
        },
      });
    }
    drawables.sort((a, b) => {
      const dy = a.y - b.y;
      if (Math.abs(dy) < 16) return (a.id || 0) - (b.id || 0);
      return dy;
    });
    for (const d of drawables) d.draw();
  }

  function frame(t) {
    if (!state.last) state.last = t;
    let dt = (t - state.last) / 1000;
    state.last = t;
    dt = Math.min(dt, 0.05);
    if (state.playing) update(dt);
    else {
      state.wind += dt * 0.35;
      for (const c of state.clouds) {
        c.x += c.v * dt;
        if (c.x > state.w + 80) c.x = -80;
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  window.__pasture = {
    forceLateGame() {
      if (!state.playing) beginPlay();
      while (state.cows.length < MAX_COWS) {
        const p = randomMeadowPos();
        state.cows.push(makeAnimal("cow", p.x, p.y));
      }
      while (state.sheep.length < MAX_SHEEP) {
        const p = randomMeadowPos();
        state.sheep.push(makeAnimal("sheep", p.x, p.y));
      }
      maybeSpawnDog();
      updateHud();
    },
  };
})();

