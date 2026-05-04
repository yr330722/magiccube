const cubeRoot = document.querySelector("#cube-root");
const moveCountEl = document.querySelector("#move-count");
const timerEl = document.querySelector("#timer");
const messageEl = document.querySelector("#message");
const scrambleBtn = document.querySelector("#scramble-btn");
const resetBtn = document.querySelector("#reset-btn");
const turnButtons = [...document.querySelectorAll("[data-move]")];

const canvas = document.createElement("canvas");
canvas.className = "cube-canvas";
cubeRoot.replaceChildren(canvas);
const ctx = canvas.getContext("2d");

const labels = {
  loaded: "\u5df2\u52a0\u8f7d\u771f\u5b9e\u65cb\u8f6c\u9b54\u65b9\u3002",
  turning: "\u5df2\u8f6c\u52a8",
  scrambling: "\u6b63\u5728\u6253\u4e71...",
  scrambled: "\u5df2\u6253\u4e71\uff0c\u5f00\u59cb\u6311\u6218\u3002",
  restoring: "\u6b63\u5728\u8fd8\u539f...",
  reset: "\u5df2\u8fd8\u539f\u3002",
  solved: "\u5b8c\u6210\uff01\u70b9\u51fb\u6253\u4e71\u518d\u6765\u4e00\u5c40\u3002",
};

const colors = {
  U: "#f6f7fb",
  D: "#ffd447",
  L: "#f07a2f",
  R: "#d93c4a",
  F: "#2cc36b",
  B: "#2f74d0",
};

const movesConfig = {
  U: { axis: "y", layer: 1, dir: -1 },
  D: { axis: "y", layer: -1, dir: 1 },
  R: { axis: "x", layer: 1, dir: -1 },
  L: { axis: "x", layer: -1, dir: 1 },
  F: { axis: "z", layer: 1, dir: -1 },
  B: { axis: "z", layer: -1, dir: 1 },
};

const faceDefs = {
  U: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  D: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  F: { n: [0, 0, 1], u: [1, 0, 0], v: [0, -1, 0] },
  B: { n: [0, 0, -1], u: [-1, 0, 0], v: [0, -1, 0] },
  R: { n: [1, 0, 0], u: [0, 0, -1], v: [0, -1, 0] },
  L: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] },
};

let stickers = [];
let moving = null;
let moves = 0;
let startedAt = null;
let timerId = null;
let yaw = -0.62;
let pitch = -0.46;
let zoom = 1;
let pointerDown = false;
let lastPointer = { x: 0, y: 0 };
let actionId = 0;
let history = [];
let busyMode = null;

function vec(x, y, z) {
  return { x, y, z };
}

function fromArray(values) {
  return vec(values[0], values[1], values[2]);
}

function clone(p) {
  return vec(p.x, p.y, p.z);
}

function add(a, b) {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

function scale(p, amount) {
  return vec(p.x * amount, p.y * amount, p.z * amount);
}

function roundPoint(p) {
  return vec(Math.round(p.x), Math.round(p.y), Math.round(p.z));
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function rotate(p, axis, angle, shouldRound = false) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  let next;

  if (axis === "x") {
    next = vec(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  } else if (axis === "y") {
    next = vec(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  } else {
    next = vec(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
  }

  return shouldRound ? roundPoint(next) : next;
}

function rotateForView(p) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  return vec(x1, p.y * cp - z1 * sp, p.y * sp + z1 * cp);
}

function setMessage(text) {
  messageEl.textContent = text;
}

function setBusy(mode) {
  busyMode = mode;
  const busy = Boolean(mode);
  document.body.classList.toggle("is-busy", busy);
  scrambleBtn.disabled = busy;
  turnButtons.forEach((button) => {
    button.disabled = busy;
  });
  resetBtn.disabled = false;
}

function updateTimer() {
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  timerEl.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60,
  ).padStart(2, "0")}`;
}

function startTimer() {
  if (startedAt) return;
  startedAt = Date.now();
  timerId = window.setInterval(updateTimer, 250);
}

function stopTimer() {
  window.clearInterval(timerId);
  timerId = null;
  startedAt = null;
  updateTimer();
}

function makeSticker(face, pos) {
  const def = faceDefs[face];
  return {
    color: face,
    pos,
    normal: fromArray(def.n),
    u: fromArray(def.u),
    v: fromArray(def.v),
    homePos: clone(pos),
    homeNormal: fromArray(def.n),
  };
}

function createSolvedCube() {
  const next = [];
  for (let a = -1; a <= 1; a += 1) {
    for (let b = -1; b <= 1; b += 1) {
      next.push(makeSticker("U", vec(a, 1, b)));
      next.push(makeSticker("D", vec(a, -1, b)));
      next.push(makeSticker("F", vec(a, b, 1)));
      next.push(makeSticker("B", vec(a, b, -1)));
      next.push(makeSticker("R", vec(1, b, a)));
      next.push(makeSticker("L", vec(-1, b, a)));
    }
  }
  return next;
}

function resizeCanvas() {
  const rect = cubeRoot.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(320, Math.floor(rect.height));

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function projectedSticker(sticker) {
  let pos = sticker.pos;
  let normal = sticker.normal;
  let u = sticker.u;
  let v = sticker.v;

  if (moving && pos[moving.axis] === moving.layer) {
    const eased = 1 - Math.pow(1 - moving.progress, 3);
    const angle = moving.dir * eased * Math.PI * 0.5;
    pos = rotate(pos, moving.axis, angle);
    normal = rotate(normal, moving.axis, angle);
    u = rotate(u, moving.axis, angle);
    v = rotate(v, moving.axis, angle);
  }

  const viewNormal = rotateForView(normal);
  if (viewNormal.z < 0.05) return null;

  const center = add(pos, scale(normal, 0.535));
  const corners = [
    add(add(center, scale(u, -0.4)), scale(v, -0.4)),
    add(add(center, scale(u, 0.4)), scale(v, -0.4)),
    add(add(center, scale(u, 0.4)), scale(v, 0.4)),
    add(add(center, scale(u, -0.4)), scale(v, 0.4)),
  ].map(rotateForView);
  const borderCorners = [
    add(add(center, scale(u, -0.48)), scale(v, -0.48)),
    add(add(center, scale(u, 0.48)), scale(v, -0.48)),
    add(add(center, scale(u, 0.48)), scale(v, 0.48)),
    add(add(center, scale(u, -0.48)), scale(v, 0.48)),
  ].map(rotateForView);
  const depth = corners.reduce((sum, p) => sum + p.z, 0) / 4;

  const highlight = moving && sticker.pos[moving.axis] === moving.layer;
  return {
    color: sticker.color,
    corners,
    borderCorners,
    depth,
    highlight,
    light: 0.68 + viewNormal.z * 0.34,
  };
}

function toScreen(p) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const size = Math.min(width, height) * 0.19 * zoom;
  const perspective = 5.8 / (5.8 - p.z);
  return {
    x: width / 2 + p.x * size * perspective,
    y: height / 2 - p.y * size * perspective,
  };
}

function polygon(points) {
  ctx.beginPath();
  const first = toScreen(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const next = toScreen(points[i]);
    ctx.lineTo(next.x, next.y);
  }
  ctx.closePath();
}

function shadeColor(hex, light) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((value >> 16) & 255) * light));
  const g = Math.min(255, Math.round(((value >> 8) & 255) * light));
  const b = Math.min(255, Math.round((value & 255) * light));
  return `rgb(${r}, ${g}, ${b})`;
}

function draw() {
  resizeCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(width * 0.42, height * 0.36, 20, width * 0.5, height * 0.48, width * 0.62);
  gradient.addColorStop(0, "rgba(44, 195, 107, 0.15)");
  gradient.addColorStop(1, "rgba(16, 18, 22, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(
    width / 2,
    height / 2 + Math.min(width, height) * 0.28,
    Math.min(width, height) * 0.2,
    24,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  const visible = stickers
    .map(projectedSticker)
    .filter(Boolean)
    .sort((a, b) => a.depth - b.depth);

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const item of visible) {
    polygon(item.borderCorners);
    ctx.fillStyle = item.highlight ? "#171d22" : "#101317";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.stroke();

    polygon(item.corners);
    ctx.fillStyle = shadeColor(colors[item.color], item.light);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.stroke();

    if (item.highlight) {
      polygon(item.corners);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();
    }
  }
}

function commitMove(axis, layer, dir) {
  for (const sticker of stickers) {
    if (sticker.pos[axis] !== layer) continue;
    sticker.pos = rotate(sticker.pos, axis, dir * Math.PI * 0.5, true);
    sticker.normal = rotate(sticker.normal, axis, dir * Math.PI * 0.5, true);
    sticker.u = rotate(sticker.u, axis, dir * Math.PI * 0.5, true);
    sticker.v = rotate(sticker.v, axis, dir * Math.PI * 0.5, true);
  }
}

function isSolved() {
  return stickers.every((sticker) => samePoint(sticker.pos, sticker.homePos) && samePoint(sticker.normal, sticker.homeNormal));
}

function turn(move, options = {}) {
  if (moving) return Promise.resolve(false);
  const base = move.replace("'", "");
  const config = movesConfig[base];
  if (!config) return Promise.resolve(false);

  const localActionId = actionId;
  const dir = move.includes("'") ? -config.dir : config.dir;
  const duration = options.duration ?? (options.silent ? 150 : 330);
  const started = performance.now();

  if (!options.silent) startTimer();
  if (!options.keepBusy) setBusy(options.busyMode ?? "turn");

  return new Promise((resolve) => {
    function step(now) {
      if (localActionId !== actionId) {
        if (moving?.actionId === localActionId) moving = null;
        if (!options.keepBusy) setBusy(null);
        draw();
        resolve(false);
        return;
      }

      moving = {
        actionId: localActionId,
        axis: config.axis,
        layer: config.layer,
        dir,
        progress: Math.min(1, (now - started) / duration),
      };
      draw();

      if (moving.progress < 1) {
        requestAnimationFrame(step);
        return;
      }

      commitMove(config.axis, config.layer, dir);
      moving = null;
      draw();
      if (options.record !== false) history.push(move);

      if (!options.silent) {
        moves += 1;
        moveCountEl.textContent = String(moves);
        setMessage(isSolved() ? labels.solved : `${labels.turning} ${move}`);
      }
      if (!options.keepBusy) setBusy(null);
      resolve(true);
    }

    requestAnimationFrame(step);
  });
}

async function scramble() {
  if (moving) return;
  actionId += 1;
  const localActionId = actionId;
  const moveNames = Object.keys(movesConfig);
  moves = 0;
  history = [];
  moveCountEl.textContent = "0";
  stopTimer();
  setBusy("scramble");
  setMessage(labels.scrambling);

  for (let i = 0; i < 20; i += 1) {
    if (localActionId !== actionId) return;
    const base = moveNames[Math.floor(Math.random() * moveNames.length)];
    const inverse = Math.random() > 0.5 ? "'" : "";
    await turn(`${base}${inverse}`, { keepBusy: true, silent: true, duration: 125 });
  }

  if (localActionId === actionId) {
    setBusy(null);
    setMessage(labels.scrambled);
  }
}

function inverseMove(move) {
  return move.includes("'") ? move.replace("'", "") : `${move}'`;
}

async function resetGame() {
  actionId += 1;
  const localActionId = actionId;
  moving = null;
  moves = 0;
  moveCountEl.textContent = "0";
  stopTimer();
  setBusy("reset");
  setMessage(labels.restoring);

  const undoMoves = history.slice().reverse().map(inverseMove);
  history = [];

  for (const move of undoMoves) {
    if (localActionId !== actionId) return;
    await turn(move, { duration: 90, keepBusy: true, record: false, silent: true });
  }

  stickers = createSolvedCube();
  moving = null;
  draw();
  setBusy(null);
  setMessage(labels.reset);
}

function onPointerDown(event) {
  pointerDown = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!pointerDown) return;
  yaw += (event.clientX - lastPointer.x) * 0.008;
  pitch += (event.clientY - lastPointer.y) * 0.006;
  lastPointer = { x: event.clientX, y: event.clientY };
  draw();
}

function onPointerUp(event) {
  pointerDown = false;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

function onWheel(event) {
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.08 : 0.08;
  zoom = Math.max(0.62, Math.min(1.65, zoom + delta));
  draw();
}

function resetView() {
  yaw = -0.62;
  pitch = -0.46;
  zoom = 1;
  draw();
}

turnButtons.forEach((button) => {
  button.addEventListener("click", () => turn(button.dataset.move));
});
scrambleBtn.addEventListener("click", scramble);
resetBtn.addEventListener("click", resetGame);
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("wheel", onWheel, { passive: false });
canvas.addEventListener("dblclick", resetView);
window.addEventListener("resize", draw);
window.addEventListener("keydown", (event) => {
  const key = event.key.toUpperCase();
  if (!movesConfig[key] || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  turn(event.shiftKey ? `${key}'` : key);
});

stickers = createSolvedCube();
draw();
setMessage(labels.loaded);
