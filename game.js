// Memory game (10 levels) using images directly inside /assets as "000.jpg".
// - Put your 50 image files in /assets.
// - Filenames must be 3 digits, e.g. 001.jpg, 042.jpg, 300.jpg.
// - The game will auto-detect which of 001..300 exist and build levels from them.

const board = document.getElementById('board');
const hud = document.getElementById('hud');
const levelLabel = document.getElementById('levelLabel');
const pairsLabel = document.getElementById('pairsLabel');
const reloadBtn = document.getElementById('reloadBtn');
const menuBtn = document.getElementById('menuBtn');

// Intro
const introGate = document.getElementById('introGate');
const introStartBtn = document.getElementById('introStartBtn');
const introVideo = document.getElementById('introVideo');

// Menu background video
const menuVideo = document.getElementById('menuVideo');

// Audio UI (footer)
const muteBtn = document.getElementById('muteBtn');
const volumeSlider = document.getElementById('volumeSlider');

// Timer UI
const timerEl = document.getElementById('timer');

// Menu / UI
const menu = document.getElementById('menu');
const playBtn = document.getElementById('playBtn');
const muralBtn = document.getElementById('muralBtn');
const howBtn = document.getElementById('howBtn');
const secretBtn = document.getElementById('secretBtn');
const howModal = document.getElementById('howModal');
const closeHowBtn = document.getElementById('closeHowBtn');
const menuStatus = document.getElementById('menuStatus');

// Mural
const muralModal = document.getElementById('muralModal');
const muralGrid = document.getElementById('muralGrid');
const closeMuralBtn = document.getElementById('closeMuralBtn');

// Secret
const secretModal = document.getElementById('secretModal');
const closeSecretBtn = document.getElementById('closeSecretBtn');

// Level complete overlay
const completeOverlay = document.getElementById('completeOverlay');
const completeNextBtn = document.getElementById('completeNextBtn');
const completeMenuBtn = document.getElementById('completeMenuBtn');
const completeLogo = document.getElementById('completeLogo');
const finalMessage = document.getElementById('finalMessage');
const totalTimeEl = document.getElementById('totalTime');

const SECRET_GIFT_LINK = 'https://www.disturbingstories.com/083_8u8w.html';


function openSecretGift(){
  window.open(SECRET_GIFT_LINK, '_blank', 'noopener');
}

// Particles canvas
const particlesCanvas = document.getElementById('particles');

const LEVELS = 10;
const PAIRS_PER_LEVEL = 5;
const MAX_IMAGES = LEVELS * PAIRS_PER_LEVEL; // 50
const DETECT_RANGE = 300; // filenames may be between 001 and 300

// Backgrounds named like assets/bg01.jpg
const BG_RANGE = 60;

// Audio assets
const MENU_BGM_SRC = 'assets/musicmenu.mp3';
const MATCH_SFX = 'assets/parejasound01.mp3';
const COMPLETE_SFX_ALWAYS = 'assets/exitosound01.mp3';
const SUCCESS_SCAN_RANGE = 99; // supports future growth (exito01..exito99)

// In-game music tracks named like assets/music1.mp3 (and/or assets/music01.mp3)
const MUSIC_SCAN_RANGE = 99;

function pad3(n) {
  return String(n).padStart(3, '0');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error('missing'));
    img.src = src;
  });
}

function loadAudio(src) {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.preload = 'auto';
    const cleanup = () => {
      a.oncanplaythrough = null;
      a.onerror = null;
    };
    a.oncanplaythrough = () => {
      cleanup();
      resolve(src);
    };
    a.onerror = () => {
      cleanup();
      reject(new Error('missing'));
    };
    a.src = src;
  });
}

function codeFromSrc(src) {
  const m = /\/(\d{3})\.jpg$/i.exec(src);
  return m ? m[1] : null;
}

// Nota: el progreso NO se persiste. Si recargas la página, se pierde (según requerimiento).
// Mantendremos todo en memoria mientras la pestaña siga abierta.

let unlockedSet = new Set();
let completedAll = false;

// Auto-detect up to MAX_IMAGES images that exist in /assets.
// We scan 001..DETECT_RANGE with limited concurrency so it stays snappy.
async function detectAvailableImages() {
  const candidates = [];
  for (let i = 1; i <= DETECT_RANGE; i++) {
    candidates.push(`assets/${pad3(i)}.jpg`);
  }

  const found = [];
  const concurrency = 18;
  let idx = 0;

  async function worker() {
    while (idx < candidates.length && found.length < MAX_IMAGES) {
      const my = candidates[idx++];
      try {
        await loadImage(my);
        found.push(my);
      } catch (_) {
        // ignore missing files
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return found;
}

async function detectAvailableBackgrounds() {
  const candidates = [];
  for (let i = 1; i <= BG_RANGE; i++) {
    candidates.push(`assets/bg${pad2(i)}.jpg`);
  }

  const found = [];
  const concurrency = 12;
  let idx = 0;

  async function worker() {
    while (idx < candidates.length) {
      const my = candidates[idx++];
      try {
        await loadImage(my);
        found.push(my);
      } catch (_) {
        // ignore
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return found;
}

async function detectSuccessSounds() {
  const candidates = [];
  for (let i = 1; i <= SUCCESS_SCAN_RANGE; i++) {
    candidates.push(`assets/exito${pad2(i)}.mp3`);
  }
  const found = [];
  const concurrency = 8;
  let idx = 0;

  async function worker() {
    while (idx < candidates.length) {
      const my = candidates[idx++];
      try {
        await loadAudio(my);
        found.push(my);
      } catch (_) {
        // ignore
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return found;
}

async function detectGameMusicTracks() {
  // Supports both music1.mp3 .. music99.mp3 and music01.mp3 .. music99.mp3
  const candidates = [];
  for (let i = 1; i <= MUSIC_SCAN_RANGE; i++) {
    candidates.push(`assets/music${i}.mp3`);
    candidates.push(`assets/music${pad2(i)}.mp3`);
  }
  // Deduplicate
  const uniq = Array.from(new Set(candidates));
  const found = [];
  const concurrency = 8;
  let idx = 0;

  async function worker() {
    while (idx < uniq.length) {
      const my = uniq[idx++];
      try {
        await loadAudio(my);
        found.push(my);
      } catch (_) {
        // ignore
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return found;
}

function setStatus(text) {
  const el = document.getElementById('status');
  el.textContent = text;
}

function setMenuStatus(text) {
  if (menuStatus) menuStatus.textContent = text;
}

function clearBoard() {
  board.innerHTML = '';
}

function isCompletedAll() {
  return completedAll;
}

function renderMural(pool) {
  if (!muralGrid) return;
  const unlocked = unlockedSet;
  muralGrid.innerHTML = '';

  // Must be sorted numerically ascending (by filename code),
  // but the slot #50 should always be 050 (gift image) when present.
  const sorted = pool
    .slice()
    .sort((a, b) => Number(codeFromSrc(a) || 0) - Number(codeFromSrc(b) || 0));
  const idx050 = sorted.findIndex((s) => codeFromSrc(s) === '050');
  if (idx050 >= 0) {
    const [s050] = sorted.splice(idx050, 1);
    sorted.push(s050);
  }

  sorted.forEach((src) => {
    const code = codeFromSrc(src) || '???';
    const isUnlocked = unlocked.has(code);
    const is050 = code === '050';
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `muralTile ${isUnlocked ? '' : 'isLocked'} ${isUnlocked && is050 ? 'isGolden' : ''}`.trim();
    tile.disabled = !isUnlocked;

    const img = document.createElement('img');
    img.alt = isUnlocked ? `Imagen ${code}` : 'Bloqueado';
    img.loading = 'lazy';
    img.src = isUnlocked ? src : 'assets/cardback.jpg';
    tile.appendChild(img);

    const badge = document.createElement('div');
    badge.className = 'muralCode';
    badge.textContent = code;
    tile.appendChild(badge);

    if (!isUnlocked) {
      const lockTag = document.createElement('div');
      lockTag.className = 'lockTag';
      lockTag.textContent = 'BLOQUEADO';
      tile.appendChild(lockTag);
    } else {
      tile.addEventListener('click', () => {
        const url = is050
          ? 'https://www.disturbingstories.com/083_8u8w.html'
          : `https://www.disturbingstories.com/${code}.html`;
        window.open(url, '_blank', 'noopener');
      });
    }

    muralGrid.appendChild(tile);
  });
}

function openModal(modal, on) {
  if (!modal) return;
  modal.classList.toggle('isOpen', on);
  modal.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function createCard(src, cardId) {
  const btn = document.createElement('button');
  btn.className = 'card';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Card');
  btn.dataset.cardId = String(cardId);
  btn.dataset.src = src;

  const inner = document.createElement('div');
  inner.className = 'cardInner';

  const front = document.createElement('div');
  front.className = 'cardFace cardFront';

  const back = document.createElement('div');
  back.className = 'cardFace cardBack';
  const img = document.createElement('img');
  img.alt = 'Memory image';
  img.loading = 'lazy';
  img.src = src;
  back.appendChild(img);

  inner.appendChild(front);
  inner.appendChild(back);
  btn.appendChild(inner);
  return btn;
}

let allImages = [];
let gamePool = [];
let levelPools = [];
let availableBgs = [];
let levelBgs = [];
let currentLevel = 0;
let lock = false;
let firstPick = null;
let matches = 0;

let ready = false;
let playing = false;

// Level times (ms) for final scoreboard
let levelTimes = Array.from({ length: LEVELS }, () => 0);

// ---------------------------
// Audio (BGM + SFX)
// ---------------------------
let masterVolume = Number(volumeSlider?.value ?? 0.65);
let isMuted = false;
let menuBgm = null;
let gameBgm = null;
let audioUnlocked = false;

let successSounds = [];
let lastSuccessSound = null;

let gameMusicTracks = [];
let lastGameTrack = null;
let gameRunTrack = null;

function applyVolumeTo(audio) {
  if (!audio) return;
  audio.volume = isMuted ? 0 : masterVolume;
}

function updateMuteIcon() {
  if (!muteBtn) return;
  muteBtn.textContent = isMuted || masterVolume === 0 ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
}

function ensureMenuBgm() {
  if (menuBgm) return menuBgm;
  menuBgm = new Audio(MENU_BGM_SRC);
  menuBgm.loop = true;
  menuBgm.preload = 'auto';
  applyVolumeTo(menuBgm);
  return menuBgm;
}

function ensureGameBgm() {
  if (gameBgm) return gameBgm;
  gameBgm = new Audio();
  gameBgm.loop = true;
  gameBgm.preload = 'auto';
  applyVolumeTo(gameBgm);
  return gameBgm;
}

function stopAllBgm() {
  try { menuBgm?.pause(); } catch (_) {}
  try { gameBgm?.pause(); } catch (_) {}
}

function playMenuMusic() {
  const a = ensureMenuBgm();
  applyVolumeTo(a);
  try { gameBgm?.pause(); } catch (_) {}
  if (!audioUnlocked) return;
  a.play().catch(() => {});
}

function pickRandomGameTrack() {
  if (!gameMusicTracks.length) return null;
  if (gameMusicTracks.length === 1) return gameMusicTracks[0];
  let choice = null;
  let guard = 0;
  do {
    choice = gameMusicTracks[Math.floor(Math.random() * gameMusicTracks.length)];
    guard += 1;
  } while (choice === lastGameTrack && guard < 25);
  lastGameTrack = choice;
  return choice;
}

function chooseGameRunTrack(){
  gameRunTrack = pickRandomGameTrack();
  return gameRunTrack;
}

function playGameMusicForRun() {
  if (!gameRunTrack) chooseGameRunTrack();
  const track = gameRunTrack;
  const a = ensureGameBgm();
  applyVolumeTo(a);
  try { menuBgm?.pause(); } catch (_) {}
  if (!track) return;
  if (!audioUnlocked) return;
  if (a.src !== track) a.src = track;
  a.play().catch(() => {});
}

function tryStartAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    // Start the right soundtrack depending on where we are.
    if (document.body.classList.contains('hasMenu')) playMenuMusic();
    else playGameMusicForRun();
  } catch (_) {
    audioUnlocked = false;
  }
}

function playSfx(src) {
  if (isMuted || masterVolume === 0) return;
  try {
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = masterVolume;
    a.play().catch(() => {});
  } catch (_) {}
}

function pickRandomSuccessSound() {
  if (!successSounds.length) return null;
  if (successSounds.length === 1) return successSounds[0];
  let choice = null;
  let guard = 0;
  do {
    choice = successSounds[Math.floor(Math.random() * successSounds.length)];
    guard += 1;
  } while (choice === lastSuccessSound && guard < 20);
  lastSuccessSound = choice;
  return choice;
}

function playLevelCompleteSfx() {
  // Always play this one
  playSfx(COMPLETE_SFX_ALWAYS);
  // Plus one random "exitoXX.mp3" (never repeated back-to-back)
  const s = pickRandomSuccessSound();
  if (s) playSfx(s);
}

// Hook audio UI
if (volumeSlider) {
  volumeSlider.addEventListener('input', () => {
    masterVolume = Number(volumeSlider.value);
    applyVolumeTo(menuBgm);
    applyVolumeTo(gameBgm);
    applyVolumeTo(introVideo);
    updateMuteIcon();
  });
}
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    applyVolumeTo(menuBgm);
    applyVolumeTo(gameBgm);
    applyVolumeTo(introVideo);
    updateMuteIcon();
  });
}
updateMuteIcon();

// Start BGM as soon as the browser allows it (first user interaction)
window.addEventListener('pointerdown', tryStartAudio, { once: false, passive: true });

// ---------------------------
// Timer
// ---------------------------
let levelStartTs = 0;
let timerInterval = null;

function formatTime(ms) {
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function startTimer() {
  stopTimer();
  levelStartTs = performance.now();
  if (timerEl) timerEl.textContent = '00:00.0';
  timerInterval = window.setInterval(() => {
    const now = performance.now();
    const d = now - levelStartTs;
    if (timerEl) {
      timerEl.textContent = formatTime(d);
      timerEl.classList.remove('isTick');
      // force reflow to restart animation
      // eslint-disable-next-line no-unused-expressions
      timerEl.offsetWidth;
      timerEl.classList.add('isTick');
    }
  }, 100);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function stopTimerAndGetElapsedMs() {
  stopTimer();
  if (!levelStartTs) return 0;
  const elapsed = Math.max(0, performance.now() - levelStartTs);
  levelStartTs = 0;
  return elapsed;
}

function formatTotal(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------
// Intro video gate
// ---------------------------
function showIntroGate() {
  if (!introGate) return;
  introGate.classList.remove('isHidden');
  introGate.setAttribute('aria-hidden', 'false');
  // Keep menu hidden until intro ends
  if (menu) menu.style.display = 'none';
}

function hideIntroGate() {
  if (!introGate) return;
  introGate.classList.add('isHidden');
  introGate.setAttribute('aria-hidden', 'true');
}

function startIntroPlayback() {
  if (!introVideo) {
    // Fallback: if no video, just go to menu
    hideIntroGate();
    showMenu();
    return;
  }

  // This user gesture unlocks audio/video in most browsers
  tryStartAudio();
  stopAllBgm();
  try { introGate?.classList.add("isPlaying"); } catch (_) {}
  // En moviles (especialmente iOS), a veces es mas fiable iniciar el video en mute
  // y desmutear justo despues de empezar.
  try { introVideo.muted = true; } catch (_) {}

  try {
    introVideo.currentTime = 0;
  } catch (_) {}

  applyVolumeTo(introVideo);

  // Watchdog: si el video no llega a reproducirse (codec no soportado, etc.),
  // no bloqueamos al usuario en la pantalla de inicio.
  let cleared = false;
  const clearWatchdog = () => {
    if (cleared) return;
    cleared = true;
    try { introVideo.removeEventListener('playing', clearWatchdog); } catch (_) {}
    try { introVideo.removeEventListener('error', onErr); } catch (_) {}
    if (watchdog) window.clearTimeout(watchdog);
  };
  const onErr = () => {
    clearWatchdog();
    hideIntroGate();
    showMenu();
  };
  introVideo.addEventListener('playing', clearWatchdog, { once: true });
  introVideo.addEventListener('error', onErr, { once: true });
  const watchdog = window.setTimeout(() => {
    // Si no ha arrancado, entramos al menu igualmente.
    if (introVideo.paused) {
      onErr();
      return;
    }
    clearWatchdog();
  }, 1600);

  try {
    introVideo.play().then(() => {
      // Intentamos recuperar audio una vez arrancado.
      try {
        introVideo.muted = isMuted;
      } catch (_) {}
    }).catch(onErr);
  } catch (_) {
    onErr();
  }
}

function showMenu() {
  if (!menu) return;
  menu.style.display = 'flex';
  document.body.classList.add('hasMenu');

  // Menu soundtrack + menu bg video
  playMenuMusic();
  try {
    if (menuVideo) {
      menuVideo.muted = true;
      menuVideo.play().catch(() => {});
    }
  } catch (_) {}

  // Update CTA depending on whether a game is in progress
  if (playBtn) playBtn.textContent = playing ? 'CONTINUAR' : 'JUGAR';
  if (gamePool.length) renderMural(gamePool);
}

function hideMenu() {
  if (!menu) return;
  menu.style.display = 'none';
  document.body.classList.remove('hasMenu');

  // Pause menu music/video when playing
  try { menuBgm?.pause(); } catch (_) {}
  try { menuVideo?.pause(); } catch (_) {}
}

function updateHud() {
  levelLabel.textContent = String(currentLevel + 1);
  pairsLabel.textContent = `${matches}/${PAIRS_PER_LEVEL}`;
}

function flip(card, on) {
  card.classList.toggle('isFlipped', on);
}

function markMatched(card) {
  card.classList.add('isMatched');
  card.disabled = true;
}

function flashMatch(card) {
  card.classList.add('matchGlow');
  window.setTimeout(() => card.classList.remove('matchGlow'), 1000);
}

function isSameCard(a, b) {
  return a && b && a.dataset.cardId === b.dataset.cardId;
}

function startLevel(levelIndex) {
  currentLevel = levelIndex;
  matches = 0;
  firstPick = null;
  lock = false;

  clearBoard();
  hideCompleteOverlay();
  setStatus('Encuentra las 5 parejas.');

  const five = levelPools[levelIndex];
  const deck = shuffle([...five, ...five]);
  deck.forEach((src, i) => {
    const card = createCard(src, i);
    board.appendChild(card);
  });

  updateHud();

  // In-game music: one track per run (does NOT restart per level)
  if (levelIndex === 0) {
    playGameMusicForRun();
  } else {
    // Keep playing seamlessly; if it was paused for any reason, resume it.
    try {
      const a = ensureGameBgm();
      applyVolumeTo(a);
      if (audioUnlocked && a.paused) a.play().catch(() => {});
    } catch (_) {}
  }

  // Start chrono for this level
  startTimer();

  // Apply background for the level (if available)
  const bg = levelBgs[levelIndex];
  if (bg) {
    document.documentElement.style.setProperty('--levelBg', `url('${bg}')`);
  } else {
    document.documentElement.style.setProperty('--levelBg', 'none');
  }
}

function showCompleteOverlay(isLast, totalMs = 0) {
  if (!completeOverlay || !completeNextBtn) return;
  completeOverlay.classList.add('isOpen');
  completeOverlay.setAttribute('aria-hidden', 'false');

  // Default (non-final) visuals
  if (completeLogo) completeLogo.src = 'assets/complete.png';
  if (finalMessage) finalMessage.style.display = 'none';
  if (totalTimeEl) totalTimeEl.style.display = 'none';
  if (completeMenuBtn) completeMenuBtn.style.display = 'none';

  // Play completion audio: always play "exitosound01" + one random "exitoXX" (never same twice)
  playLevelCompleteSfx();

  if (!isLast) {
    completeNextBtn.textContent = 'SIGUIENTE NIVEL';
  } else {
    // FINAL: different logo + message + total time + two buttons
    if (completeLogo) completeLogo.src = 'assets/completefinal.png';
    completeNextBtn.textContent = 'VER REGALO SECRETO';
    if (completeMenuBtn) completeMenuBtn.style.display = '';
    if (finalMessage) {
      finalMessage.style.display = '';
      finalMessage.innerHTML =
        '¡ENHORABUENA! Has superado los 10 niveles, y como recompensa por llegar hasta aquí, has conseguido un acceso especial a una Story Exclusiva del Libro#4. Se trata de la Story#050, titulada "Quincuaginta"... un enigmático relato para celebrar la publicación de la story numero 50.' +
        '<br><br>' +
        'NOTA: Este acceso solo está disponible mientras tengas todas las imagenes del mural desbloqueadas.';
    }
    if (totalTimeEl) {
      totalTimeEl.style.display = '';
      totalTimeEl.textContent = `TIEMPO TOTAL: ${formatTotal(totalMs)}`;
    }
  }
}

function hideCompleteOverlay() {
  if (!completeOverlay) return;
  completeOverlay.classList.remove('isOpen');
  completeOverlay.setAttribute('aria-hidden', 'true');
}

function onCardClick(card) {
  if (lock) return;
  if (card.classList.contains('isMatched')) return;
  if (card.classList.contains('isFlipped')) return;

  flip(card, true);

  if (!firstPick) {
    firstPick = card;
    return;
  }

  if (isSameCard(firstPick, card)) return;

  const a = firstPick;
  const b = card;
  firstPick = null;

  if (a.dataset.src === b.dataset.src) {
    // Pair found: play sfx at the start of the match animation
    playSfx(MATCH_SFX);
    markMatched(a);
    markMatched(b);
    flashMatch(a);
    flashMatch(b);
    matches += 1;
    updateHud();

    if (matches === PAIRS_PER_LEVEL) {
      const isLast = currentLevel === LEVELS - 1;
      setStatus(isLast ? '¡Juego completado!' : '¡Nivel completado!');

      // Stop chrono and store time for this level
      const elapsedMs = stopTimerAndGetElapsedMs();
      levelTimes[currentLevel] = elapsedMs;
      const totalMs = levelTimes.reduce((sum, v) => sum + (Number(v) || 0), 0);
      // Unlock the 5 images used in this level inside the Mural
      const levelImgs = levelPools[currentLevel] || [];
      levelImgs.forEach((src) => {
        const code = codeFromSrc(src);
        if (code) unlockedSet.add(code);
      });

      if (isLast) {
        // Final gift: reveal secret submenu + also unlock story #50 (050.jpg)
        unlockedSet.add('050');
        completedAll = true;
        if (secretBtn) secretBtn.style.display = '';
      }

      if (gamePool.length) renderMural(gamePool);
      showCompleteOverlay(isLast, totalMs);
    }
    return;
  }

  lock = true;
  setTimeout(() => {
    flip(a, false);
    flip(b, false);
    lock = false;
  }, 650);
}

function wireEvents() {
  // Intro gate
  introStartBtn?.addEventListener('click', () => {
    if (!ready) return;
    if (introStartBtn) introStartBtn.disabled = true;
    startIntroPlayback();
  });

  introVideo?.addEventListener('ended', () => {
    hideIntroGate();
    showMenu();
  });

  board.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card || !board.contains(card)) return;
    onCardClick(card);
  });

  completeNextBtn?.addEventListener('click', () => {
    const isLast = currentLevel === LEVELS - 1;
    hideCompleteOverlay();
    if (!isLast) {
      if (currentLevel < LEVELS - 1) startLevel(currentLevel + 1);
      return;
    }
    // Last level => open the secret gift directly
    openSecretGift();
  });

  completeMenuBtn?.addEventListener('click', () => {
    hideCompleteOverlay();
    showMenu();
  });

  completeOverlay?.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.classList.contains('completeBackdrop')) {
      completeNextBtn?.click();
    }
  });

  reloadBtn.addEventListener('click', () => {
    // Simple and robust: brings back menu + re-detects assets.
    window.location.reload();
  });

  playBtn?.addEventListener('click', () => {
    if (!ready) return;
    // Start new game once; afterwards this becomes "CONTINUAR".
    if (!playing) {
      playing = true;
      // Reset level times for a fresh run
      levelTimes = Array.from({ length: LEVELS }, () => 0);
      // Pick a fresh music track for this run
      gameRunTrack = null;
      chooseGameRunTrack();
      startLevel(0);
    }
    hideMenu();
    // If we were already in a level, resume that level's music
    if (playing && board.children.length && audioUnlocked) {
      try {
        const a = ensureGameBgm();
        applyVolumeTo(a);
        a.play().catch(() => {});
      } catch (_) {}
    }
  });

  // Allow returning to the main menu at any time (without losing progress)
  menuBtn?.addEventListener('click', () => {
    if (!ready) return;
    showMenu();
  });

  muralBtn?.addEventListener('click', () => {
    if (!ready) return;
    if (gamePool.length) renderMural(gamePool);
    openModal(muralModal, true);
  });
  closeMuralBtn?.addEventListener('click', () => openModal(muralModal, false));
  muralModal?.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.close === 'true') openModal(muralModal, false);
  });

  secretBtn?.addEventListener('click', () => {
    openSecretGift();
  });
  closeSecretBtn?.addEventListener('click', () => openModal(secretModal, false));
  secretModal?.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.close === 'true') openModal(secretModal, false);
  });

  howBtn?.addEventListener('click', () => openHowModal(true));
  closeHowBtn?.addEventListener('click', () => openHowModal(false));
  howModal?.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.close === 'true') openHowModal(false);
  });

}

function openHowModal(on) {
  openModal(howModal, on);
}

function initParticles() {
  if (!particlesCanvas) return;
  const ctx = particlesCanvas.getContext('2d');
  if (!ctx) return;

  let w = 0;
  let h = 0;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const particles = [];
  // 10x more + 10x bigger (very visible)
  const COUNT = 7000;

  function resize() {
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    particlesCanvas.width = Math.floor(w * dpr);
    particlesCanvas.height = Math.floor(h * dpr);
    particlesCanvas.style.width = `${w}px`;
    particlesCanvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawn(i) {
    particles[i] = {
      x: rand(0, w),
      y: rand(0, h),
      r: rand(30, 120),
      // Much faster drift
      vx: rand(-4.8, 4.8),
      vy: rand(-10.5, -3.2),
      a: rand(0.08, 0.22),
      tw: rand(0.02, 0.06),
      ph: rand(0, Math.PI * 2),
    };
  }

  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < COUNT; i++) spawn(i);

  let t = 0;
  function tick() {
    t += 1;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.ph += p.tw;

      // wrap
      if (p.y < -10) {
        p.y = h + 10;
        p.x = rand(0, w);
      }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      const alpha = Math.max(0, Math.min(1, p.a + Math.sin(p.ph) * 0.06));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(241,242,255,1)';
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
}

async function init() {
  hud.classList.add('isLoading');
  ready = false;
  playing = false;
  setStatus('');
  setMenuStatus('Buscando imágenes y fondos en /assets...');
  clearBoard();

  try {
    // Detect images + backgrounds in parallel
    const [imgs, bgs, sfx, mus] = await Promise.all([
      detectAvailableImages(),
      detectAvailableBackgrounds(),
      detectSuccessSounds(),
      detectGameMusicTracks(),
    ]);
    allImages = imgs;
    availableBgs = bgs;
    successSounds = sfx;
    gameMusicTracks = mus;

    if (allImages.length < 2) {
      setMenuStatus('No se encontraron imágenes. Añade archivos como assets/001.jpg');
      hud.classList.remove('isLoading');
      return;
    }

    // Build up to 50 unique images for THIS SESSION.
    // Progress is intentionally not persisted: if the page reloads, the player starts from 0.
    // Special rule: if 050.jpg exists, it must only appear in level 10 (slot #50 in the mural).
    const img050 = allImages.find((s) => codeFromSrc(s) === '050') || null;
    const others = allImages.filter((s) => codeFromSrc(s) !== '050');
    const base = shuffle(others).slice(0, Math.min(MAX_IMAGES - (img050 ? 1 : 0), others.length));
    gamePool = img050 ? [...base, img050] : base.slice(0, Math.min(MAX_IMAGES, base.length));
    unlockedSet = new Set();
    completedAll = false;
    playing = false;
    levelPools = chunk(gamePool.slice(0, LEVELS * PAIRS_PER_LEVEL), PAIRS_PER_LEVEL);

    // Prepare 10 level backgrounds.
    if (availableBgs.length) {
      const shuffled = shuffle(availableBgs);
      levelBgs = [];
      for (let i = 0; i < LEVELS; i++) {
        if (shuffled[i]) {
          levelBgs.push(shuffled[i]);
        } else {
          // Not enough backgrounds; keep picking random ones until we have 10.
          levelBgs.push(availableBgs[Math.floor(Math.random() * availableBgs.length)]);
        }
      }
    } else {
      levelBgs = Array.from({ length: LEVELS }, () => null);
    }

    // Ready!
    ready = true;
    if (playBtn) playBtn.disabled = false;
    if (muralBtn) muralBtn.disabled = false;
    if (secretBtn) secretBtn.style.display = isCompletedAll() ? '' : 'none';
    setMenuStatus('© Disturbing Stories 2026 / Vianda Visual / disturbingstories.com/games');
    hud.classList.remove('isLoading');

    // Keep a default background in menu
    const bg0 = levelBgs[0];
    if (bg0) document.documentElement.style.setProperty('--levelBg', `url('${bg0}')`);

    // Start particles immediately (also visible in menu)
    initParticles();

    // Intro must run before anything else.
    // Show intro gate; once it ends, the menu becomes available.
    showIntroGate();
  } catch (err) {
    console.error(err);
    setMenuStatus('Error detectando imágenes.');
    hud.classList.remove('isLoading');
  }
}

wireEvents();
init();
