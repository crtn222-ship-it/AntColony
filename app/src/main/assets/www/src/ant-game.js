import * as THREE from "https://esm.sh/three@0.160.0";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import * as Nest from "./nest.js";
import { LANG_LIST, LANG_CODES, detectLang, pick, langName } from "./lang.js";

// ---------- موازنة اللعب (defaults + ما في main.pjs إن وجد) ----------
function pjsNum(path, fb) {
  try {
    const g = (typeof globalThis !== "undefined" && globalThis.root) ? globalThis.root : null;
    if (!g) return fb;
    let node = g;
    for (const k of path) {
      if (node == null) return fb;
      node = node[k];
    }
    if (node == null) return fb;
    if (typeof node === "number") return node;
    if (typeof node === "object" && typeof node.evaluateItem !== "undefined") {
      const v = Number(node.evaluateItem);
      return Number.isFinite(v) ? v : fb;
    }
    const v = Number(node);
    return Number.isFinite(v) ? v : fb;
  } catch { return fb; }
}
const TUNE = {
  worldHalf: 225, // عالم 450×450 — يُضبط من main.pjs أيضاً
  playerSpeed: 11,
  playerCapacity: 3,
  workerSpeed: 6.5,
  workerCapacity: 1,
  maxFoodOnGround: 90,
  hatchCostBase: 5,
  upgradeCostBase: 10,
  beetleCount: 4,
  creatureCount: 10, // كانت 16 — تخفيف الزحام البري حول العش
  startWorkers: 3,
  autoForage: 1,     // بحث تلقائي عن الطعام للعمال خارج العش (1 = مفعّل، 0 = البقاء في العش — ميزة 3.2)
  forageRange: 80,   // مدى البحث عن الطعام وإعادة استهداف أمر الجمع
  scoutSight: 110,    // مدى رؤية الكشاف (أوسع من العامل)
  forageTries: 4,    // محاولات بحث فاشلة قبل عودة العامل للعش
};
function loadTune() {
  TUNE.worldHalf = pjsNum(["antTuning", "worldHalf"], TUNE.worldHalf);
  TUNE.playerSpeed = pjsNum(["antTuning", "playerSpeed"], TUNE.playerSpeed);
  TUNE.playerCapacity = pjsNum(["antTuning", "playerCapacity"], TUNE.playerCapacity);
  TUNE.workerSpeed = pjsNum(["antTuning", "workerSpeed"], TUNE.workerSpeed);
  TUNE.workerCapacity = pjsNum(["antTuning", "workerCapacity"], TUNE.workerCapacity);
  TUNE.maxFoodOnGround = pjsNum(["antTuning", "maxFoodOnGround"], TUNE.maxFoodOnGround);
  TUNE.hatchCostBase = pjsNum(["antTuning", "hatchCostBase"], TUNE.hatchCostBase);
  TUNE.upgradeCostBase = pjsNum(["antTuning", "upgradeCostBase"], TUNE.upgradeCostBase);
  TUNE.beetleCount = pjsNum(["antTuning", "beetleCount"], TUNE.beetleCount);
  TUNE.creatureCount = pjsNum(["antTuning", "creatureCount"], TUNE.creatureCount);
  TUNE.startWorkers = pjsNum(["antTuning", "startWorkers"], TUNE.startWorkers);
  TUNE.autoForage = pjsNum(["antTuning", "autoForage"], TUNE.autoForage) !== 0;
  TUNE.forageRange = pjsNum(["antTuning", "forageRange"], TUNE.forageRange);
  TUNE.scoutSight = pjsNum(["antTuning", "scoutSight"], TUNE.scoutSight);
  TUNE.forageTries = pjsNum(["antTuning", "forageTries"], TUNE.forageTries);
}

// ---------- عناصر الواجهة ----------
const $ = (id) => document.getElementById(id);
const els = {};
["gameRoot","sceneHolder","loadingEl","topBar","statusPill","statusPillNum","vitalsPanel","storeEl","workersEl","levelEl","carriedEl","hpFill","stFill","queenFill",
 "mapWrap","minimapCtn","mapCloseBtn","mapOpenBtn","zoomCtn","zoomInBtn","zoomOutBtn","menuBtn","actionCtn","hatchBtn","hatchLbl","upgradeBtn","upgradeLbl",
 "hatchCostEl","upgradeCostEl","beastBtn","buildBtn","shopBtn","questBtn","worldBtn","worldPanel","worldBody","worldCloseBtn","wtabRegions","wtabQuests","wtabShop","beastPanel","beastCount","beastList","beastCloseBtn","typeBar",
 "typeSeedEl","typeLeafEl","typeFruitEl","typeCrumbEl","typeAmberEl","typeWorkerEl","typeSoldierEl","typeScoutEl","resBar","resSeedEl","resLeafEl","resFruitEl","resCrumbEl","resAmberEl","resWorkerEl","resSoldierEl","resScoutEl","resQueenEl","resLifeEl","resHealEl","resCrysEl","resPolEl","resMedEl","genePanel","geneTitle","geneTabs","geneTabSick","geneTabHeal","geneTabEggs","geneTabGene","geneTabUp","geneSub","geneBody","geneCloseBtn","geneOpenBtn","trainPanel","trainTitle","trainTabConv","trainTabSold","trainTabYard","trainTabUp","trainSub","trainBody","trainCloseBtn","trainOpenBtn","trainBtn","helpBtn","pauseBtn","startScreen","startPlayBtn","startHelpBtn","startWipeBtn","startSaveInfo","diffRow","diffLabel","diffBtns","diffEasyBtn","diffNormalBtn","diffHardBtn","diffBeginnerBtn","diffDesc","pausePanel","resumeBtn","settingsBtn","saveNowBtn","homeBtn","settingsPanel","setSoundBtn","setQualityBtn","setLangBtn","setVibrateBtn","setDiffBtn","setHelpBtn","setWipeBtn","setAboutBtn","setUpdateBtn","aboutPanel","aboutCloseBtn","setPrivacyBtn","privacyPanel","privacyCloseBtn","settingsCloseBtn","helpModal","helpCloseBtn","toastCtn","fadeVeil",
 "underCanvas","underBar","underBackBtn","nestHud","nestExitBtn","nestLvTxt","nestXpFill","nestRes","nestSetBtn","nestQuestBtn","nestQuestDot","nestSide","nestBattleBtn","nestWorldBtn","nestShopBtn","nestBottom","nestBuildBtn","nestUpBtn","nestTidyBtn","nestArmyBtn","nestGeneBtn","nestBackFab","nestZoom","nestZoomIn","nestZoomFit","nestZoomOut","roomPanel","roomTitle","roomDesc","roomUpgradeBtn","roomCloseBtn","archerBtn","sackBtn","casteRow","casteLbl",
 "casteWorkerBtn","casteSoldierBtn","casteScoutBtn",
 "buildMenu","buildTitle","buildList","buildCancelBtn",
  "cmdBar","selCount","cmdSelWorkBtn","cmdSelSoldBtn","cmdInjBtn","cmdHomeBtn","cmdHoldBtn","cmdClearBtn","ctxBtn","quickBar","qAtkBtn","qFolBtn",
  "hpCtn","dmgCtn","mapStack","armyBtn","nestBtn","gearBtn","setUiLayoutBtn","editResetBtn","editHiddenBtn","editHiddenCount","editHiddenList","editBanner","editDoneBtn","editTool","editSizeVal","editPlusBtn","editMinusBtn","editHideBtn","editDockBtn",
 "joyBase","joyKnob","selRect","damageFlash","centerMsg","tutBar","tutTxt","tutProg","tutSkipBtn","endPanel","endIcon","endHeading","endDesc","endStats","endPrimaryBtn","endFreeBtn","endSecondaryBtn","waveStat","waveEl","startHeading","startSub","pauseHeading","settingsHeading","aboutHeading","privacyHeading","helpHeading","mapLabel"].forEach((id) => (els[id] = $(id)));

function toast(msg) {
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = msg;
  els.toastCtn.appendChild(d);
  while (els.toastCtn.children.length > 3) els.toastCtn.firstChild.remove();
  setTimeout(() => { d.style.opacity = "0"; d.style.transition = "opacity .4s"; setTimeout(() => d.remove(), 420); }, 2300);
}
function centerMsg(msg, ms = 1600) {
  els.centerMsg.textContent = msg;
  els.centerMsg.hidden = false;
  clearTimeout(centerMsg._t);
  centerMsg._t = setTimeout(() => (els.centerMsg.hidden = true), ms);
}

// ---------- صوت محسّن (WebAudio، بدون ملفات) + موسيقى توليدية هادئة ----------
let AC = null;
let soundOn = true;
let masterGain = null;
function ac() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    if (!masterGain) {
      masterGain = AC.createGain();
      masterGain.gain.value = 0.9;
      masterGain.connect(AC.destination);
    }
    return AC;
  } catch { return null; }
}
function tone(freq = 600, dur = 0.08, type = "sine", vol = 0.12, when = 0, slideTo = null) {
  if (!soundOn) return;
  const c = ac();
  if (!c) return;
  try {
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(masterGain);
    o.start(t); o.stop(t + dur + 0.05);
  } catch { /* الصوت اختياري */ }
}
// ضجيج مرشّح (للطقات والانفجارات والخطوات) — يعطي ملمساً حقيقياً بدل الصفير
let noiseBuf = null;
function noise(dur = 0.12, vol = 0.1, when = 0, freq = 1200, q = 0.8, type = "lowpass") {
  if (!soundOn) return;
  const c = ac();
  if (!c) return;
  try {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(masterGain);
    src.start(t); src.stop(t + dur + 0.05);
  } catch { /* الصوت اختياري */ }
}
function beep(freq = 600, dur = 0.08, type = "sine", vol = 0.12, when = 0) {
  tone(freq, dur, type, vol, when);
}
const sfx = {
  pickup() { tone(680, 0.07, "sine", 0.1); tone(1020, 0.06, "sine", 0.07, 0.05); },
  harvest() { noise(0.06, 0.08, 0, 3000, 1, "highpass"); tone(760, 0.06, "triangle", 0.09, 0.02); tone(990, 0.05, "triangle", 0.07, 0.07); },
  step(alt) { noise(0.05, 0.05, 0, alt ? 500 : 420, 0.7); },
  swing() { noise(0.09, 0.09, 0, 2400, 1.2, "bandpass"); tone(320, 0.08, "sawtooth", 0.05); },
  shoot() { noise(0.05, 0.06, 0, 4200, 1.4, "highpass"); tone(1500, 0.05, "triangle", 0.05, 0, 900); },
  die() { tone(220, 0.16, "sawtooth", 0.1, 0, 70); noise(0.14, 0.1, 0.02, 700, 0.7); },
  capture() { tone(587, 0.09, "triangle", 0.12); tone(880, 0.14, "triangle", 0.12, 0.09); tone(1174, 0.16, "sine", 0.09, 0.18); },
  alarm() { for (let i = 0; i < 3; i++) { tone(196, 0.22, "square", 0.09, i * 0.3); tone(147, 0.22, "square", 0.09, i * 0.3 + 0.15); } },
  click() { tone(600, 0.045, "sine", 0.06); },
  deposit() { tone(523, 0.09, "triangle", 0.11); tone(659, 0.09, "triangle", 0.1, 0.07); tone(784, 0.14, "triangle", 0.11, 0.14); },
  hit() { noise(0.1, 0.14, 0, 900, 0.8); tone(140, 0.16, "sawtooth", 0.12, 0, 60); },
  hatch() { tone(440, 0.09, "triangle", 0.1); tone(660, 0.09, "triangle", 0.1, 0.08); tone(880, 0.14, "triangle", 0.1, 0.16); },
  level() { const seq = [523, 659, 784, 1046]; seq.forEach((f, i) => tone(f, 0.13, "triangle", 0.11, i * 0.09)); },
  victory() { const seq = [523, 659, 784, 1046, 784, 1046, 1318]; seq.forEach((f, i) => tone(f, 0.22, "triangle", 0.12, i * 0.13)); noise(0.5, 0.05, 0.2, 5000, 0.6, "highpass"); },
  defeat() { const seq = [392, 330, 262, 196]; seq.forEach((f, i) => tone(f, 0.3, "sawtooth", 0.09, i * 0.22)); },
};
// لسعة موسيقية قصيرة (نصر/هزيمة) — تعمل حتى مع كتم الموسيقى الخلفية
function musicSting(win) {
  if (!soundOn) return;
  const c = ac();
  if (!c) return;
  try {
    musNext = c.currentTime + 3; // إسكات القرعات الهادئة أثناء اللسعة
    if (win) {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, "triangle", 0.12, i * 0.14));
    } else {
      [330, 262, 208, 165].forEach((f, i) => tone(f, 0.45, "sine", 0.1, i * 0.2));
    }
  } catch {}
}
const MUS_SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];
let musNext = 0, musChordI = 0;
function musicTick() {
  if (!soundOn || !game.started || game.paused) return;
  const c = AC;
  if (!c || c.state !== "running") return;
  const now = c.currentTime;
  if (now < musNext) return;
  musNext = now + 0.42;
  try {
    if (Math.random() < 0.55) {
      const f = MUS_SCALE[(Math.random() * MUS_SCALE.length) | 0];
      tone(f, 0.5, "sine", 0.035);
      if (Math.random() < 0.25) tone(f * 2, 0.4, "sine", 0.02, 0.05);
    }
    musChordI++;
    if (musChordI % 16 === 0) {
      const roots = [110, 130.8, 98, 146.8];
      const r = roots[((musChordI / 16) | 0) % roots.length];
      tone(r, 2.2, "triangle", 0.028);
      tone(r * 1.5, 2.2, "sine", 0.02, 0.05);
    }
  } catch {}
}

// ---------- حالة اللعبة ----------
// ---------- مجسمات glb الخارجي (اختياري — بديل إجرائي عند غيابها) ----------
const Models = {};
async function loadModels() {
  let GLTFLoader = null;
  try {
    ({ GLTFLoader } = await import("https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js"));
  } catch { return; }
  const loader = new GLTFLoader();
  const jobs = ["ant", "soldier", "beetle"].map((k) => (async () => {
    try {
      const glb = await loader.loadAsync("src/models/" + k + ".glb");
      glb.scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      Models[k] = glb.scene;
      /* console.log("[models] loaded", k); */
    } catch { /* الملف غير موجود — نستخدم البديل الإجرائي */ }
  })());
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 8000))]);
}
// توحيد الحجم: الطول الأكبر = targetLen، والأقدام على الأرض، والأمام +Z
function fitModel(obj, targetLen) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const ctr = new THREE.Vector3();
  box.getCenter(ctr);
  const s = targetLen / Math.max(size.x, size.y, size.z, 0.001);
  obj.scale.setScalar(s);
  obj.position.x -= ctr.x * s;
  obj.position.z -= ctr.z * s;
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
  obj.userData.baseY = obj.position.y;
  return obj;
}

const SAVE_KEY = "ant-colony-save-v1";
const game = {
  store: 25, // عسل ابتدائي — اللاعب الجديد لا يبدأ صفراً (البند 1)
  stock: { seed: 0, leaf: 0, fruit: 0, crumb: 0 },
  capacityBonus: 0,
  level: 1,
  player: null,
  workers: [],
  soldiers: [],
  scouts: [],
  corpses: [], // جثث القتلى: تبقى واقفة كأثر على الخريطة (للجلسة فقط)
  beetles: [],
  beetleRespawnT: 0,
  creatures: [],
  allies: [],
  collection: [],
  creatureRespawnT: 0,
  enemies: [],
  colonies: [],
  shots: [], // مقذوفات أشواك الكهرمان 🏹 (عابرة — لا تُحفظ)
  xp: 0,
  stats: { food: 0, hatch: 0, kills: 0, captures: 0, upgrades: 0, amber: 0, termKills: 0, bones: 0, siegeKills: 0, waves: 0 },
  mods: {},
  regions: { meadow: true },
  quests: null,
  flags: {},
  foods: [],
  nodes: [],
  colliders: [],
  time: 0,
  shake: 0,
  lastHitAt: -99,
  respawnAt: 0,
  invulnUntil: 0,
  autoReturn: false,
  autoOn: true,
  mound: null,
  nestPulse: 0,
  arrowPivot: null,
  underground: false,
 raidCd: 0,
 militiaT: 0, // 🛡️ استنفار العمال: دفاع طارئ أثناء الغارات بلا جنود (ثوانٍ)
  wave: 0, bestWave: 0, // 🌊 الموجات اللانهائية بعد النصر (0 = قبل النصر)
  siegeT: 200, // 🪲 مؤقت خنفساء الحصار
  streak: null, ach: null, // 🔥 سلسلة الأيام + 🏆 الإنجازات (تُهيأ كسولة)
  treeZone: false, // اللاعب داخل الشجرة العتيقة؟
  _gateCd: 0, // تبريد البوابة (كان undefined فيمنع العبور أبداً — الآن يُهيأ بصفر)
  termiteMound: null, // تل النمل الأبيض (يبنى مع المنطقة)
  victory: false, // النصر: تدمير المستعمرتين معاً — تُحفظ وتمنع عودتهما
  difficulty: "normal", // 🌱😌⚔️🔥 طور الصعوبة: beginner/easy/normal/hard — تُحفظ وتُغيّر من البداية والإعدادات
  endShown: false, // لوحة النهاية ظهرت (حتى لا تتكرر)
  tutorial: null, // {step, done, active, beg} — التعليم التدريجي للاعبين الجدد (beg = الموسّع 12 خطوة لطور المبتدئ)
  tutBegDone: false, // أُكمل تعليم المبتدئ الموسّع من قبل (حتى لا يعيد نفسه عند العودة للطور)
  settings: { sound: true, quality: "high", vibrate: true, autoQ: true, ui: null, lang: "auto" },
  started: false,
  paused: false,
};
function playerCapacity() { return TUNE.playerCapacity + game.capacityBonus + Nest.storageBonus() + ((game.mods && game.mods.cap) || 0); }
function hatchCost() { return Math.max(1, Math.round((TUNE.hatchCostBase + game.workers.length * 2) * (1 - 0.15 * ((game.mods && game.mods.hatch) || 0)))); }
function upgradeCost() { return TUNE.upgradeCostBase + game.capacityBonus * 8; }
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      store: game.store, capacityBonus: game.capacityBonus, extraWorkers: Math.max(0, game.workers.length - TUNE.startWorkers),
      stock: game.stock, autoOn: game.autoOn, nest: Nest.serializeNest(),
      collection: game.collection.map((e) => ({ key: e.key, level: e.level, state: e.state === "deployed" ? "deployed" : (e.state === "dead" ? "dead" : "stored"), revives: Math.max(0, Math.min(3, e.revives == null ? 3 : e.revives | 0)) })),
      xp: game.xp, level: game.level, stats: game.stats, mods: game.mods, regions: game.regions,
      quests: game.quests ? { main: game.quests.main, mainDone: game.quests.mainDone, day: game.quests.day, dailies: game.quests.dailies } : null,
      flags: game.flags, victory: !!game.victory,
      wave: game.wave | 0, bestWave: game.bestWave | 0, streak: game.streak || null, ach: game.ach || null,
      difficulty: game.difficulty || "normal",
      tutBegDone: !!game.tutBegDone,
      tutorial: game.tutorial ? { step: game.tutorial.step | 0, done: !!game.tutorial.done, beg: !!game.tutorial.beg } : null,
      settings: { sound: game.settings.sound !== false, quality: game.settings.quality === "low" ? "low" : "high", vibrate: game.settings.vibrate !== false, autoQ: game.settings.autoQ !== false, ui: uiPrefs(), lang: game.settings.lang || "auto" },
      uidN: game.uidN || 0,
      soldierFocus: game.soldierFocus || "mix",
      pstate: game.player ? { x: +game.player.x.toFixed(1), z: +game.player.z.toFixed(1), hp: Math.round(game.player.hp), st: Math.round(game.player.st), carried: game.player.carried.slice(0, 12) } : null,
    }));
  } catch { /* خاصية اختيارية */ }
}
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!s) return 0;
    game.store = Math.max(0, Math.min(20000, Number(s.store) || 0));
    game.capacityBonus = Math.max(0, Math.min(6, Number(s.capacityBonus) || 0));
    if (s.stock) for (const k of Object.keys(KNOWN_FOODS)) {
      if (Number(s.stock[k])) game.stock[k] = Math.max(0, Math.min(500, Number(s.stock[k]) || 0));
    }
    game.xp = Math.max(0, Number(s.xp) || 0);
    game.level = Math.max(1, Math.min(99, Number(s.level) || 1));
    if (s.stats) for (const k of ["food", "hatch", "kills", "captures", "upgrades", "amber", "termKills", "centiKills", "bones", "siegeKills", "waves"]) {
      game.stats[k] = Math.max(0, Number(s.stats[k]) || 0);
    }
    if (s.mods) for (const k of ["dmg", "spd", "hp", "cap", "hatch", "mil", "archery", "sacks", "fertility"]) {
      game.mods[k] = Math.max(0, Math.min(3, Number(s.mods[k]) || 0));
    }
    if (s.regions) { game.regions = { meadow: true }; for (const k of Object.keys(s.regions)) if (s.regions[k]) game.regions[k] = true; }
    if (s.flags) game.flags = s.flags;
    if (s.victory) { game.victory = true; game.endShown = true; }
    game.wave = Math.max(0, Number(s.wave) || 0);
    game.bestWave = Math.max(0, Number(s.bestWave) || 0);
    if (s.streak && typeof s.streak === "object") game.streak = s.streak;
    if (s.ach && typeof s.ach === "object") game.ach = s.ach;
    if (["beginner", "easy", "normal", "hard"].includes(s.difficulty)) game.difficulty = s.difficulty;
    if (s.tutorial && typeof s.tutorial === "object") game.tutorial = { step: Math.max(0, s.tutorial.step | 0), done: !!s.tutorial.done, active: false, beg: !!s.tutorial.beg };
    if (s.tutBegDone) game.tutBegDone = true;
    if (s.settings) {
      if (s.settings.sound === false) game.settings.sound = false;
      if (s.settings.quality === "low") game.settings.quality = "low";
      if (s.settings.autoQ === false) game.settings.autoQ = false;
      if (s.settings.vibrate === false) game.settings.vibrate = false;
      if (s.settings.lang && (s.settings.lang === "auto" || LANG_CODES.includes(s.settings.lang))) game.settings.lang = s.settings.lang;
      if (s.settings.ui && typeof s.settings.ui === "object") game.settings.ui = s.settings.ui;
    }
    // أجهزة ضعيفة من أول تشغيل: ابدأ بجودة منخفضة (تُرفع تلقائياً لو الجهاز يتحمل)
    try {
      const freshQ = !s.settings || !s.settings.quality;
      const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
      if (freshQ && weak && game.settings.autoQ !== false) { game.settings.quality = "low"; autoLow = true; }
    } catch {}
    if (s.pstate) game._savedPlayer = s.pstate;
    game.uidN = Math.max(game.uidN || 0, Number(s.uidN) || 0);
    game.soldierFocus = (["mix", "guard", "brute", "swift"].includes(s.soldierFocus)) ? s.soldierFocus : "mix";
    game._savedQuests = (s.quests && typeof s.quests.main === "number") ? s.quests : null;
    game.autoOn = s.autoOn !== false;
    game._savedNest = s.nest || null;
    game._savedCollection = Array.isArray(s.collection) ? s.collection : null;
    return Math.max(0, Math.min(4, Number(s.extraWorkers) || 0));
  } catch { return 0; }
}

// ---------- ثلاثة: المشهد ----------
const DIFF_KEY = "ant-colony-difficulty"; // اختيار الطور يبقى حتى بعد مسح الحفظ
const DIFFS = {
  beginner: { name: "مبتدئ", icon: "🌱", ehp: 0.5, edmg: 0.45, raidN: -1, raidTimeK: 2.0, lootK: 1.5, raidLevel: 6, desc: "🌱 تعليم خطوة بخطوة (سوي كذا سوي كذا) — أعداء أليفة وغارات نادرة وغنائم سخية" },
  easy: { name: "سهل", icon: "😌", ehp: 0.65, edmg: 0.6, raidN: -1, raidTimeK: 1.6, lootK: 1.3, raidLevel: 4, desc: "أعداء أضعف وغارات متباعدة وغنائم أكبر — للاستمتاع" },
  normal: { name: "متوسط", icon: "⚔️", ehp: 1, edmg: 1, raidN: 0, raidTimeK: 1, lootK: 1, raidLevel: 4, desc: "التجربة الأصلية المتوازنة" },
  hard: { name: "صعب", icon: "🔥", ehp: 1.45, edmg: 1.4, raidN: 1, raidTimeK: 0.7, lootK: 1, raidLevel: 4, desc: "أعداء أقسى وغارات أسرع وأشرس — للمحترفين" },
};
function diffDef() { return DIFFS[game.difficulty] || DIFFS.normal; }
function setDifficulty(d, announce) {
  if (!DIFFS[d]) return;
  game.difficulty = d;
  try { localStorage.setItem(DIFF_KEY, d); } catch {}
  // 🌱 دخول المبتدئ يبدأ التعليم الموسّع (إن لم يُكمله من قبل) — والخروج منه يعيده للمختصر
  try {
    if (d === "beginner") {
      if (!game.tutBegDone && (!game.tutorial || !game.tutorial.beg || game.tutorial.done)) {
        game.tutorial = { step: 0, done: false, active: !!game.started, beg: true };
        tutRender();
      }
    } else if (game.tutorial && game.tutorial.beg && !game.tutorial.done) {
      game.tutorial = { step: Math.min(game.tutorial.step, TUT_STEPS.length - 1), done: false, active: game.tutorial.active, beg: false };
      tutRender();
    }
  } catch {}
  try { renderDiffRow(); renderSettings(); saveGame(); } catch {}
  if (announce) { sfx.click(); toast(`${t("diff_" + d)} — ${t("diff_applied")}`); }
}
function renderDiffRow() {
  try {
    for (const [id, d] of [["diffBeginnerBtn", "beginner"], ["diffEasyBtn", "easy"], ["diffNormalBtn", "normal"], ["diffHardBtn", "hard"]]) {
      if (els[id]) els[id].classList.toggle("sel", game.difficulty === d);
    }
    if (els.diffDesc) els.diffDesc.textContent = t("diff_" + game.difficulty + "_d");
  } catch {}
}
const STORE_MAX = 500; // سقف الأساس — السقف الحقيقي = الأساس + 100 لكل مستوى مخزن (يبنيه اللاعب ويطوّره)
function storeCap() { let b = 0; try { b = Nest.storageLevel() * 100; } catch {} return STORE_MAX + b; }
let renderer, scene, camera, sunLight;
let nestPos = new THREE.Vector3(0, 0, 0);
const NEST_R = 5.2;
const MOUND_R = 4.6;
const MOUND_H = 2.53;
// منطقة نظيفة حول العش: الخنافس تُطرد منها تلقائياً ولا تقترب أبداً
const NEST_CLEAN_R = 14;
// إبعاد الحياة البرية عن العش: الخنافس والمخلوقات (محايدة وعدائية) تُولد
// وتتجول خارج هذه المسافة — فقط غارات الأعداء (game.enemies) تقترب من العش
const WILD_KEEPOUT_R = 34;
const HOLE = { x: 0, z: 0.6 };
// فتحات العش الطبيعية: رئيسية + 3 جانبية (النمل يدخل ويخرج منها فعلياً)
const HOLES = [
  { x: 0, z: 0.6, r: 1.25 },
  { x: 3.6, z: 2.4, r: 0.95 },
  { x: -3.4, z: 2.0, r: 0.9 },
  { x: 0.6, z: -3.6, r: 0.85 },
];
// ساحة التدريب العسكري (سطحية قرب العش)
const YARD = { x: 10.5, z: 6.5, w: 7.5, h: 6 };
function groundY(x, z) {
  const d = Math.hypot(x - nestPos.x, z - nestPos.z);
  if (d >= MOUND_R) return 0;
  return Math.sqrt(MOUND_R * MOUND_R - d * d) * 0.55;
}
let nestRing;

function rand(a, b) { return a + Math.random() * (b - a); }
function randPos(margin = 6, minNest = 9) {
  const H = TUNE.worldHalf - margin;
  for (let i = 0; i < 40; i++) {
    const x = rand(-H, H), z = rand(-H, H);
    if (Math.hypot(x - nestPos.x, z - nestPos.z) < minNest) continue;
    let ok = true;
    for (const c of game.colliders) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + 1.2) { ok = false; break; }
    }
    if (ok) return { x, z };
  }
  return (() => {
    let x = rand(-H, H), z = rand(-H, H);
    const d = Math.hypot(x - nestPos.x, z - nestPos.z);
    if (d < minNest) {
      const a = Math.atan2(x - nestPos.x, z - nestPos.z) || rand(0, 6.28);
      x = nestPos.x + Math.sin(a) * minNest;
      z = nestPos.z + Math.cos(a) * minNest;
      x = THREE.MathUtils.clamp(x, -H, H);
      z = THREE.MathUtils.clamp(z, -H, H);
    }
    return { x, z };
  })();
}

function grassTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#7fae5f";
  g.fillRect(0, 0, 256, 256);
  // بقع طبيعية ناعمة (داكنة/فاتحة) تكسر تسطّح العشب — تُرسم مرة واحدة في النسيج فلا تكلف أداءً
  for (let i = 0; i < 30; i++) {
    const bx = Math.random() * 256, by = Math.random() * 256, br = 18 + Math.random() * 42;
    const dark = Math.random() < 0.6;
    const grad = g.createRadialGradient(bx, by, 2, bx, by, br);
    grad.addColorStop(0, dark ? "rgba(84,128,58,0.55)" : "rgba(150,196,110,0.5)");
    grad.addColorStop(1, "rgba(127,174,95,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(bx, by, br, 0, 6.29); g.fill();
  }
  for (let i = 0; i < 2600; i++) {
    const shades = ["#74a456", "#8ab968", "#6d9c50", "#93c06f", "#7fae5f"];
    g.fillStyle = shades[(Math.random() * shades.length) | 0];
    g.fillRect((Math.random() * 256) | 0, (Math.random() * 256) | 0, 2, 2 + ((Math.random() * 3) | 0));
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd0ff);
  scene.fog = new THREE.Fog(0x9fd0ff, 170, 540);

  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 900);

  const lowQ = game.settings && game.settings.quality === "low";
  renderer = new THREE.WebGLRenderer({ antialias: !lowQ });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(lowQ ? 1 : Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !lowQ;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  els.sceneHolder.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x4a6b35, 0.95));
  sunLight = new THREE.DirectionalLight(0xfff3d6, 1.6);
  sunLight.position.set(30, 48, 18);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(lowQ ? 1024 : 2048, lowQ ? 1024 : 2048);
  const S = 70; // صندوق الظل حول اللاعب فقط (الشمس تتبعه) — أوضح بكثير من تغطية الخريطة كلها
  Object.assign(sunLight.shadow.camera, { left: -S, right: S, top: S, bottom: -S, far: 140 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.9; // يمنع تموّج/وميض الظل على الأرض
  scene.add(sunLight);

  // الأرض
  const H = TUNE.worldHalf + 6;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2, H * 2, 1, 1),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // بقع ترابية
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x9a7a4d, roughness: 1 });
  for (let i = 0; i < 70; i++) {
    const p = randPos(10, 12);
    const d = new THREE.Mesh(new THREE.CircleGeometry(rand(2.5, 6), 18), dirtMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(p.x, 0.07, p.z);
    d.receiveShadow = true;
    scene.add(d);
  }

  // بقع عشبية كبيرة خافتة (تكسر تكرار النسيج على مساحة العالم)
  const blotchMats = [0x6da050, 0x8cbb6a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false }));
  for (let i = 0; i < 55; i++) {
    const p = randPos(10, 14);
    const b = new THREE.Mesh(new THREE.CircleGeometry(rand(4, 9), 16), blotchMats[i % 2]);
    b.rotation.x = -Math.PI / 2;
    b.position.set(p.x, 0.05, p.z);
    b.renderOrder = 1;
    b.receiveShadow = true;
    scene.add(b);
  }

  // عشب (Instanced) — شفرات رفيعة متدرجة متنوعة تتمايل مع النسيم
  {
    const blade = new THREE.ConeGeometry(0.055, 0.75, 5);
    blade.translate(0, 0.375, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uGrassTime;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 gip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float gsw = sin(uTime * 1.9 + gip.x * 0.7 + gip.y * 0.9) * 0.13 * smoothstep(0.0, 0.75, position.y);
        transformed.x += gsw; transformed.z += gsw * 0.6;
      #endif`);
    };
    mat.customProgramCacheKey = () => "grassWind";
    const N = (game.settings && game.settings.quality === "low") ? 3000 : 6800;
    const inst = new THREE.InstancedMesh(blade, mat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const gc = new THREE.Color();
    const greens = [0x4f8f3a, 0x5da244, 0x6fb84e, 0x478434, 0x7cc25a, 0x8fbf4d];
    for (let i = 0; i < N; i++) {
      const p = randPos(2, 5);
      e.set(rand(-0.3, 0.3), rand(0, Math.PI * 2), rand(-0.3, 0.3));
      q.setFromEuler(e);
      v.set(p.x, 0, p.z);
      const sc = rand(0.6, 1.5);
      s.set(sc * rand(0.8, 1.2), sc * rand(0.8, 1.6), sc * rand(0.8, 1.2));
      m.compose(v, q, s);
      inst.setMatrixAt(i, m);
      gc.setHex(greens[(Math.random() * greens.length) | 0]).offsetHSL(rand(-0.02, 0.02), 0, rand(-0.04, 0.04));
      inst.setColorAt(i, gc);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
  }

  // أشجار
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const leafMats = [0x3f7d2c, 0x4d8f36, 0x5da244].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
  for (let i = 0; i < 110; i++) {
    const p = randPos(8, 13);
    const t = new THREE.Group();
    const h = rand(2.2, 3.6);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, h, 7), trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    t.add(trunk);
    const lm = leafMats[i % leafMats.length];
    for (let k = 0; k < 3; k++) {
      const r = rand(1.2, 2.1);
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lm);
      f.position.set(rand(-0.8, 0.8), h + rand(-0.4, 1.2), rand(-0.8, 0.8));
      f.castShadow = true;
      t.add(f);
    }
    t.position.set(p.x, 0, p.z);
    t.rotation.y = rand(0, 6.28);
    scene.add(t);
    game.colliders.push({ x: p.x, z: p.z, r: 0.9 });
  }

  // صخور
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d8d94, roughness: 1, flatShading: true });
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x6f6f77, roughness: 1, flatShading: true });
  for (let i = 0; i < 130; i++) {
    const p = randPos(6, 10);
    const r = rand(0.4, 1.3);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), i % 2 ? rockMat : rockMat2);
    rock.position.set(p.x, r * 0.45, p.z);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    rock.scale.y = 0.7;
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
    if (r > 0.75) game.colliders.push({ x: p.x, z: p.z, r: r * 0.9 });
  }

  // أوراق وزهور وأغصان مبعثرة
  const leafCols = [0xd8a93c, 0xc96f2e, 0x7fbf4d, 0xb8452e];
  for (let i = 0; i < 440; i++) {
    const p = randPos(3, 4);
    const leaf = new THREE.Mesh(
      new THREE.CircleGeometry(rand(0.22, 0.5), 7),
      new THREE.MeshStandardMaterial({ color: leafCols[i % leafCols.length], roughness: 1, side: THREE.DoubleSide })
    );
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = rand(0, 6.28);
    leaf.position.set(p.x, 0.08, p.z);
    leaf.receiveShadow = true;
    scene.add(leaf);
  }
  for (let i = 0; i < 130; i++) {
    const p = randPos(5, 8);
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x3f7d2c }));
    stem.position.y = 0.35;
    g.add(stem);
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({ color: [0xff6b9d, 0xffd93d, 0xffffff, 0xc084fc][i % 4], roughness: 0.7 })
    );
    head.position.y = 0.75;
    head.castShadow = true;
    g.add(head);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
  }
  const twigMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
  for (let i = 0; i < 60; i++) {
    const p = randPos(6, 9);
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, rand(2, 4.5), 6), twigMat);
    twig.rotation.z = Math.PI / 2;
    twig.rotation.y = rand(0, 6.28);
    twig.position.set(p.x, 0.1, p.z);
    twig.castShadow = true;
    scene.add(twig);
    game.colliders.push({ x: p.x, z: p.z, r: 0.5 });
  }

  buildBorder();
  buildNest();
}

function buildBorder() {
  const H = TUNE.worldHalf;
  const grp = new THREE.Group();
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 1, flatShading: true });
  const step = 8;
  for (let x = -H - 1; x <= H + 1; x += step) {
    for (const z of [-H - 1, H + 1]) {
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, rand(1.4, 2), 6), stakeMat);
      stake.position.set(x + rand(-0.3, 0.3), 0.8, z);
      stake.rotation.z = rand(-0.08, 0.08);
      stake.castShadow = true;
      grp.add(stake);
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.35, 0.6), 0), stoneMat);
      st.position.set(x + 1.6, 0.25, z + rand(-0.4, 0.4));
      st.castShadow = true;
      grp.add(st);
    }
  }
  for (let z = -H - 1; z <= H + 1; z += step) {
    for (const x of [-H - 1, H + 1]) {
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, rand(1.4, 2), 6), stakeMat);
      stake.position.set(x, 0.8, z + rand(-0.3, 0.3));
      stake.castShadow = true;
      grp.add(stake);
    }
  }
  // حبل يربط الأوتاد (خط بصري للحدود)
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 1 });
  for (const [w, d, px, pz, ry] of [
    [(H + 1) * 2, 0, 0, -H - 1, 0], [(H + 1) * 2, 0, 0, H + 1, 0],
  ]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, w, 5), ropeMat);
    rope.rotation.z = Math.PI / 2;
    rope.position.set(px, 1.45, pz);
    grp.add(rope);
  }
  for (const [h, px, pz] of [[(H + 1) * 2, -H - 1, 0], [(H + 1) * 2, H + 1, 0]]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 5), ropeMat);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(px, 1.45, pz);
    grp.add(rope);
  }
  scene.add(grp);
  try { buildTreeZone(); } catch (e) { console.warn("[tree] build failed", e); }
}

function buildNest() {
  const g = new THREE.Group();
  // --- رقعة رملية طبيعية تحت العش (تربة صحراوية + بقع داكنة + حصى + أعشاب جافة) ---
  const patch = new THREE.Mesh(new THREE.CircleGeometry(9.5, 26), new THREE.MeshStandardMaterial({ color: 0xc7a06a, roughness: 1 }));
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.06;
  patch.receiveShadow = true;
  g.add(patch);
  const darkSand = new THREE.MeshStandardMaterial({ color: 0xa8814f, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2), rr = rand(2, 8.5);
    const blot = new THREE.Mesh(new THREE.CircleGeometry(rand(0.7, 2.2), 12), darkSand);
    blot.rotation.x = -Math.PI / 2;
    blot.position.set(Math.cos(a) * rr, 0.09, Math.sin(a) * rr);
    blot.receiveShadow = true;
    g.add(blot);
  }
  const pebMat = new THREE.MeshStandardMaterial({ color: 0x9a8d7a, roughness: 1, flatShading: true });
  const pebMat2 = new THREE.MeshStandardMaterial({ color: 0x7c6f5e, roughness: 1, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2), rr = rand(3, 9);
    const peb = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.12, 0.42), 0), i % 2 ? pebMat : pebMat2);
    peb.position.set(Math.cos(a) * rr, 0.1, Math.sin(a) * rr);
    peb.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    peb.scale.y = 0.6;
    peb.castShadow = peb.receiveShadow = true;
    g.add(peb);
  }
  const dryMat = new THREE.MeshStandardMaterial({ color: 0xc2a94e, roughness: 1 });
  const dryMat2 = new THREE.MeshStandardMaterial({ color: 0x9a8a3f, roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const a = rand(0, Math.PI * 2), rr = rand(5.5, 10.5);
    const tuft = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, rand(0.5, 1.1), 4), k % 2 ? dryMat : dryMat2);
      blade.position.set(rand(-0.15, 0.15), 0.35, rand(-0.15, 0.15));
      blade.rotation.set(rand(-0.35, 0.35), 0, rand(-0.35, 0.35));
      tuft.add(blade);
    }
    tuft.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    g.add(tuft);
  }
  // طرق النمل: مسارات ترابية من الفتحات للخارج
  const trailMat = new THREE.MeshStandardMaterial({ color: 0xb08c58, roughness: 1 });
  for (const h of HOLES) {
    const len = 5.5;
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, len), trailMat);
    trail.rotation.x = -Math.PI / 2;
    const a = Math.atan2(h.x, h.z);
    trail.rotation.z = -a;
    trail.position.set(h.x + Math.sin(a) * (h.r + len / 2 - 0.5), 0.07, h.z + Math.cos(a) * (h.r + len / 2 - 0.5));
    trail.receiveShadow = true;
    g.add(trail);
  }
  // --- التل: منخفض وعريض مثل أعشاش البر الحقيقية ---
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(MOUND_R * 1.1, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xbb935c, roughness: 1 })
  );
  mound.scale.set(1.05, 0.34, 1.05);
  mound.castShadow = mound.receiveShadow = true;
  g.add(mound);
  game.mound = mound;
  game.moundBaseY = 0.34;
  // حبيبات رمل على التل
  const gritMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 1 });
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), rr = rand(1, MOUND_R);
    const grit = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.1, 0.28), 0), gritMat);
    const gx = Math.cos(a) * rr, gz = Math.sin(a) * rr;
    grit.position.set(gx, Math.max(0.1, groundY(gx, gz) + 0.05), gz);
    grit.castShadow = true;
    g.add(grit);
  }
  // --- الفتحات: حفر داكنة بشفاه ترابية (النمل يدخل ويخرج منها فعلياً) ---
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x140d05, roughness: 1 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x8a5f36, roughness: 1 });
  for (const h of HOLES) {
    const hy = groundY(h.x, h.z);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(h.r, 20), holeMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(h.x, hy + 0.06, h.z);
    g.add(hole);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(h.r, h.r * 0.24, 8, 20), lipMat);
    lip.rotation.x = -Math.PI / 2;
    lip.position.set(h.x, hy + 0.04, h.z);
    lip.castShadow = true;
    g.add(lip);
  }
  nestRing = new THREE.Mesh(
    new THREE.RingGeometry(NEST_R - 0.35, NEST_R, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  nestRing.rotation.x = -Math.PI / 2;
  nestRing.position.y = 0.12;
  g.add(nestRing);
  // حد المنطقة النظيفة: حلقة خافتة تُظهر أين لا تقترب الخنافس
  const cleanRing = new THREE.Mesh(
    new THREE.RingGeometry(NEST_CLEAN_R - 0.3, NEST_CLEAN_R, 64),
    new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  cleanRing.rotation.x = -Math.PI / 2;
  cleanRing.position.y = 0.11;
  g.add(cleanRing);
  // شجيرة يابسة بدل الراية (مظهر بري طبيعي)
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x7a6a35, roughness: 1, flatShading: true });
  const bush = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const bb = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.6), 0), bushMat);
    bb.position.set(rand(-0.7, 0.7), 0.4 + rand(0, 0.5), rand(-0.7, 0.7));
    bb.castShadow = true;
    bush.add(bb);
  }
  bush.position.set(-4.6, 0, -2.6);
  g.add(bush);
  g.position.copy(nestPos);
  scene.add(g);
}

// ---------- ساحة التدريب العسكرية (سطحية قرب العش) ----------
function buildYard() {
  if (game.yard) return;
  const grp = new THREE.Group();
  const YX = YARD.x, YZ = YARD.z, YW = YARD.w, YH = YARD.h;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(YW, YH), new THREE.MeshStandardMaterial({ color: 0xb5905a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(YX, 0.08, YZ);
  floor.receiveShadow = true;
  grp.add(floor);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8a5f36, roughness: 1 });
  const hw = YW / 2, hh = YH / 2;
  for (const [cx, cz] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh], [0, -hh], [0, hh]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.1, 6), postMat);
    post.position.set(YX + cx, 0.55, YZ + cz);
    post.castShadow = true;
    grp.add(post);
  }
  for (const y of [0.45, 0.85]) {
    for (const [len, px, pz, horiz] of [[YW, YX, YZ - hh, true], [YW, YX, YZ + hh, true], [YH, YX - hw, YZ, false], [YH, YX + hw, YZ, false]]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 5), railMat);
      if (horiz) rail.rotation.z = Math.PI / 2;
      else rail.rotation.x = Math.PI / 2;
      rail.position.set(px, y, pz);
      grp.add(rail);
    }
  }
  // دميتا قش للمصارعة التجريبية
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xd9b93c, roughness: 1 });
  for (const [dx, dz] of [[-1.8, -1.2], [1.8, -1.2]]) {
    const dummy = new THREE.Group();
    const poleD = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), postMat);
    poleD.position.y = 1.1;
    dummy.add(poleD);
    const straw = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), strawMat);
    straw.position.y = 1.9;
    straw.castShadow = true;
    dummy.add(straw);
    const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), postMat);
    arms.rotation.z = Math.PI / 2;
    arms.position.y = 1.4;
    dummy.add(arms);
    dummy.position.set(YX + dx, 0, YZ + dz);
    grp.add(dummy);
  }
  // راية عسكرية
  const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), postMat);
  fpole.position.set(YX - hw, 1.3, YZ - hh);
  fpole.castShadow = true;
  grp.add(fpole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.65), new THREE.MeshStandardMaterial({ color: 0x7a1e1e, side: THREE.DoubleSide }));
  flag.position.set(YX - hw + 0.55, 2.3, YZ - hh);
  grp.add(flag);
  grp.visible = false;
  scene.add(grp);
  game.yard = { group: grp };
}
// ---------- قتال تجريبي في الساحة: مصارعة مرئية للمتدربين ----------
// ---------- نمل بري حول العش (حياة طبيعية: دخول/خروج/حمل طعام) ----------
function spawnNestAnts() {
  if (game.nestAnts && game.nestAnts.length) return;
  game.nestAnts = [];
  const cols = [0x8a3a10, 0x6b2d0c, 0x9c4a12, 0x5a2408, 0x7a3510];
  for (let i = 0; i < 12; i++) {
    const sc = rand(0.45, 0.85);
    const ant = createAnt({ body: cols[i % cols.length], dark: 0x3d1604, scale: sc });
    scene.add(ant.group);
    const hole = HOLES[(Math.random() * HOLES.length) | 0];
    const a = {
      ant, sc, x: hole.x + rand(-1, 1), z: hole.z + rand(-1, 1), yaw: rand(0, 6.28),
      tx: 0, tz: 0, state: "forage", t: rand(0, 2), carry: false, hole, grow: 1, spd: rand(2, 3.4),
    };
    const p = randForage(a);
    a.tx = p.x; a.tz = p.z;
    setCarryVisual(ant, []);
    game.nestAnts.push(a);
  }
}
function randForage(a) {
  const ang = rand(0, Math.PI * 2), rr = rand(3, 13);
  return {
    x: THREE.MathUtils.clamp((nestPos.x + a.hole.x) + Math.sin(ang) * rr, -TUNE.worldHalf, TUNE.worldHalf),
    z: THREE.MathUtils.clamp((nestPos.z + a.hole.z) + Math.cos(ang) * rr, -TUNE.worldHalf, TUNE.worldHalf),
  };
}
function nestAntsTick(dt, t) {
  if (!game.nestAnts || game.underground) return;
  for (const a of game.nestAnts) {
    const dx = a.tx - a.x, dz = a.tz - a.z;
    const dist = Math.hypot(dx, dz);
    if (a.state === "emerge") {
      a.t -= dt;
      a.grow = Math.min(1, a.grow + dt * 2);
      if (a.t <= 0) {
        a.state = "forage";
        const p = randForage(a);
        a.tx = p.x; a.tz = p.z;
        a.carry = false;
        setCarryVisual(a.ant, []);
      }
    } else if (a.state === "enter") {
      a.grow = Math.max(0.01, a.grow - dt * 2.5);
      if (a.grow <= 0.02) {
        a.hole = HOLES[(Math.random() * HOLES.length) | 0];
        a.x = nestPos.x + a.hole.x + rand(-0.3, 0.3);
        a.z = nestPos.z + a.hole.z + rand(-0.3, 0.3);
        a.tx = a.x; a.tz = a.z;
        a.state = "emerge";
        a.t = rand(0.5, 4);
        a.carry = Math.random() < 0.5;
        if (a.carry) setCarryVisual(a.ant, ["crumb"]);
      }
    } else if (dist < 0.4) {
      if (a.state === "forage") {
        if (Math.random() < 0.55) {
          a.state = "return";
          a.tx = nestPos.x + a.hole.x; a.tz = nestPos.z + a.hole.z;
          if (!a.carry && Math.random() < 0.6) { a.carry = true; setCarryVisual(a.ant, ["crumb"]); }
        } else {
          const p = randForage(a);
          a.tx = p.x; a.tz = p.z;
        }
      } else {
        a.state = "enter";
      }
    }
    if ((a.state === "forage" || a.state === "return") && dist > 0.05) {
      const want = Math.atan2(dx, dz);
      let dy = want - a.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      a.yaw += dy * Math.min(1, dt * 6);
      a.x += Math.sin(a.yaw) * a.spd * dt;
      a.z += Math.cos(a.yaw) * a.spd * dt;
      a.ant.update(dt, 0.55, t);
    } else {
      a.ant.update(dt, 0.05, t);
    }
    a.ant.group.position.set(a.x, groundY(a.x, a.z) + 0.02, a.z);
    a.ant.group.rotation.y = a.yaw;
    a.ant.group.scale.setScalar(Math.max(0.01, a.sc * a.grow));
  }
}
function trainYardTick(dt, t) {
  const has = Nest.trainLevel() > 0;
  if (game.yard) game.yard.group.visible = !game.underground && has;
  if (!has || game.underground || game.paused) return;
  const act = [];
  for (const s of game.soldiers) if (s.inTraining && !s.dying) act.push(s);
  act.forEach((s, i) => {
    const p = yardSpot(i % 3);
    const dx = p.x - s.x, dz = p.z - s.z;
    const dist = Math.hypot(dx, dz);
    s.sparT = (s.sparT == null ? rand(0.5, 1.5) : s.sparT) - dt;
    let px = YARD.x + nestPos.x + (i % 2 ? -1.8 : 1.8), pz = YARD.z + nestPos.z - 1.2;
    let best = 1e9;
    for (const o of act) {
      if (o === s) continue;
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d < best) { best = d; px = o.x; pz = o.z; }
    }
    const want = Math.atan2(px - s.x, pz - s.z);
    let dy = want - s.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    s.yaw += dy * Math.min(1, dt * 5);
    let moving = 0;
    if (dist > 0.6) { s.x += (dx / dist) * 3 * dt; s.z += (dz / dist) * 3 * dt; moving = 0.5; }
    if (s.sparT <= 0) {
      s.sparT = rand(1.2, 2.6);
      s.ant.fightT = 0.35;
      s.x += Math.sin(s.yaw) * 0.7;
      s.z += Math.cos(s.yaw) * 0.7;
      spawnBurst(s.x, 0.8, s.z, 0xd9b93c, 6, 1.5, 2);
      if (Math.random() < 0.4) spawnDmgNum(s.x, 1.8, s.z, "💪", "#ffd93d");
      moving = 0.7;
    }
    try {
      s.ant.group.position.set(s.x, groundY(s.x, s.z), s.z);
      s.ant.group.rotation.y = s.yaw;
      s.ant.update(dt, moving, t);
    } catch {}
  });
}

// ---------- نموذج النملة (أرجل متحركة بمشية ثلاثية) ----------
function makeAntMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 });
}
// حلقة ذهبية حول الصدر تميّز نمل النخبة ⭐ عن البقية
function eliteRing() {
  const r = new THREE.Mesh(
    new THREE.TorusGeometry(0.37, 0.06, 6, 18),
    new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.65, roughness: 0.3 })
  );
  r.position.set(0, 0.68, 0);
  return r;
}
function createAnt({ body = 0x7a2e12, dark = 0x4a1a08, scale = 1, model = "ant", jaw = 1, elite = false } = {}) {
  // مجسم glb خارجي إن وُجد (بحركة تمايل بسيطة بدل الأرجل الإجرائي)
  if (model && Models[model]) {
    const group = new THREE.Group();
    const m = fitModel(Models[model].clone(true), 2.4);
    group.add(m);
    if (elite) group.add(eliteRing());
    const carrySlot = new THREE.Group();
    carrySlot.position.set(0, 1.6, -0.3);
    group.add(carrySlot);
    group.scale.setScalar(scale);
    const baseY = m.userData.baseY || 0;
    return {
      group, legs: [], antennae: [], carrySlot, legTime: 0, glb: true,
      update(dt, speedRatio, t) {
        this.legTime += dt * (4 + speedRatio * 9);
        this.fightT = Math.max(0, (this.fightT || 0) - dt);
        m.position.y = baseY + Math.abs(Math.sin(this.legTime)) * 0.1 * (0.3 + speedRatio);
      },
    };
  }
  const group = new THREE.Group();
  const mat = makeAntMaterial(body);
  const darkMat = makeAntMaterial(dark);
  if (elite) group.add(eliteRing());

  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), mat);
  abdomen.scale.set(0.9, 0.8, 1.3);
  abdomen.position.set(0, 0.74, -1.05);
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), mat);
  thorax.position.set(0, 0.68, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 12), mat);
  head.position.set(0, 0.78, 0.95);
  for (const m of [abdomen, thorax, head]) { m.castShadow = true; group.add(m); }
  // خصر رفيع يفصل الأجزاء (سمة النمل)
  const waistMat = darkMat;
  for (const [y, z] of [[0.66, -0.42], [0.68, 0.48]]) {
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.34, 6), waistMat);
    waist.rotation.x = Math.PI / 2 - 0.15;
    waist.position.set(0, y, z);
    group.add(waist);
  }
  // شريط على البطن
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 14), darkMat);
  stripe.position.set(0, 0.74, -1.0);
  stripe.rotation.x = 0.25;
  stripe.scale.set(0.9, 1, 1);
  group.add(stripe);

  // عيون وفكوك
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.3 });
  const jaws = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    eye.position.set(sx * 0.27, 0.94, 1.2);
    group.add(eye);
    const jawM = new THREE.Mesh(new THREE.ConeGeometry(0.09 * jaw, 0.46 * jaw, 6), darkMat);
    jawM.position.set(sx * 0.18, 0.62, 1.44);
    jawM.rotation.x = Math.PI / 2 + 0.35;
    jawM.rotation.z = sx * -0.3;
    jawM.castShadow = true;
    group.add(jawM);
    jaws.push({ m: jawM, side: sx, baseZ: sx * -0.3 });
  }
  // قرنا الاستشعار
  const antennae = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 0.15, 1.02, 1.3);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.85, 5), darkMat);
    seg.position.y = 0.42;
    piv.add(seg);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), darkMat);
    tip.position.y = 0.86;
    piv.add(tip);
    piv.rotation.x = -0.7;
    piv.rotation.z = sx * 0.5;
    group.add(piv);
    antennae.push({ piv, side: sx, baseX: -0.7, baseZ: sx * 0.5 });
  }

  // الأرجل الست: مشية ثلاثية الأرجل (tripod gait) — الفخذ ممدود للخارج ثم الساق للأسفل
  const legs = [];
  const hipZ = [0.5, 0.02, -0.46];
  const yawBase = [0.55, 0.05, -0.55];
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.3, 0.66, hipZ[i]);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 6), darkMat);
      upper.position.y = -0.4;
      upper.castShadow = true;
      const knee = new THREE.Group();
      knee.position.y = -0.8;
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.5, 6), darkMat);
      lower.position.y = -0.25;
      lower.castShadow = true;
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), darkMat);
      foot.position.y = -0.5;
      knee.add(lower); knee.add(foot);
      hip.add(upper); hip.add(knee);
      hip.rotation.z = side * 1.25;
      knee.rotation.z = -side * 0.95;
      group.add(hip);
      // الطور: الأرجل (يسار1، يمين2، يسار3) معاً، والبقية عكسها — مشية الحشرات الحقيقية
      const phase = (i % 2 === 0 ? 0 : Math.PI) + (side < 0 ? 0 : Math.PI);
      legs.push({ hip, knee, side, yawBase: side * yawBase[i], phase, upperLen: 0.85 });
    }
  }

  // مكان حمل الطعام فوق الظهر
  const carrySlot = new THREE.Group();
  carrySlot.position.set(0, 1.15, -0.35);
  group.add(carrySlot);

  group.scale.setScalar(scale);
  return {
    group, legs, antennae, carrySlot, jaws,
    legTime: Math.random() * 10, fightT: 0,
    update(dt, speedRatio, t) {
      this.legTime += dt * (4 + speedRatio * 9);
      const amp = 0.1 + speedRatio * 0.45;
      const lift = 0.06 + speedRatio * 0.3;
      for (const L of this.legs) {
        const p = this.legTime * 2.4 + L.phase;
        const swing = Math.sin(p) * amp;
        const up = Math.max(0, Math.sin(p + Math.PI / 2)) * lift;
        L.hip.rotation.y = L.yawBase + swing;
        L.hip.rotation.z = L.side * (1.25 + up);
        L.hip.rotation.x = Math.cos(p) * amp * 0.35;
        L.knee.rotation.z = -L.side * (0.95 + up * 1.2);
        L.knee.rotation.x = Math.sin(p) * 0.18 * speedRatio;
      }
      for (const A of this.antennae) {
        A.piv.rotation.x = A.baseX + Math.sin(t * 3 + A.side) * 0.12;
        A.piv.rotation.z = A.baseZ + Math.cos(t * 2.2 + A.side * 2) * 0.1;
      }
      abdomen.position.y = 0.74 + Math.sin(this.legTime * 2.4) * 0.025 * (0.3 + speedRatio);
      // أنيميشن القتال: عضّة سريعة بالفكوك + اندفاع الرأس
      if (this.fightT > 0) {
        this.fightT = Math.max(0, this.fightT - dt);
        const k = this.fightT / 0.35;
        const snap = Math.sin(k * Math.PI);
        for (const J of this.jaws) J.m.rotation.z = J.baseZ - J.side * snap * 0.55;
        head.position.z = 0.95 + snap * 0.18;
      } else {
        for (const J of this.jaws) J.m.rotation.z = J.baseZ;
        head.position.z = 0.95;
      }
    },
  };
}

// ---------- النملة الحمراء GLB — جنود الفصيل الأحمر المتطورين (حراس/غزاة/ملكةة حمراء) ----------
// الموديل: Poly by Google (CC-BY) — يُحمّل مرة واحدة ويُستنسخ لكل وحدة حمراء (خفيف: ~1100 وجه)
let redAntProto = null, redAntLoading = false, redAntErr = null;
function ensureRedAnt() {
  if (redAntProto || redAntLoading) return;
  redAntLoading = true;
  try {
    const rurl = new URL("./models/red-ant.glb", import.meta.url).href;
    new GLTFLoader().load(rurl, (glb) => {
      try {
        const m = glb.scene;
        m.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(m);
        const size = new THREE.Vector3(); box.getSize(size);
        const c = new THREE.Vector3(); box.getCenter(c);
        const proto = new THREE.Group();
        proto.add(m);
        // الأطول أفقياً يواجه +Z (اتجاه حركة الوحدات في اللعبة)
        if (size.x > size.z) m.rotation.y = -Math.PI / 2;
        m.updateMatrixWorld(true);
        const b2 = new THREE.Box3().setFromObject(proto);
        const s2 = new THREE.Vector3(); b2.getSize(s2);
        const len = Math.max(s2.x, s2.z, 0.001);
        const k = 2.2 / len;
        m.scale.setScalar((m.scale.x || 1) * k);
        m.updateMatrixWorld(true);
        const b3 = new THREE.Box3().setFromObject(proto);
        m.position.y -= b3.min.y; // القدمان على الأرض
        m.position.x -= (b3.min.x + b3.max.x) / 2;
        m.position.z -= (b3.min.z + b3.max.z) / 2;
        proto.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        redAntProto = proto;
      } catch (e) { redAntLoading = false; /* fallback إجرائي */ }
    }, undefined, (e) => { redAntLoading = false; redAntErr = "load:" + rurl + " :: " + String((e && e.message) || e).slice(0, 160); });
  } catch (e) { redAntLoading = false; redAntErr = "ex:" + String(e).slice(0, 160); }
}
function createRedAntGLB(scale = 1) {
  if (!redAntProto) { ensureRedAnt(); return null; }
  const wrap = new THREE.Group();
  const body = redAntProto.clone(true);
  wrap.add(body);
  const carrySlot = new THREE.Group();
  carrySlot.position.set(0, 1.1, -0.3);
  wrap.add(carrySlot);
  wrap.scale.setScalar(scale);
  const st = { t: Math.random() * 10 };
  return {
    group: wrap, legs: [], antennae: [], jaws: [], carrySlot, legTime: 0, fightT: 0, isGLB: true,
    update(dt, speedRatio, t) {
      st.t += dt * (3 + speedRatio * 10);
      // مشية إجرائية (الموديل بلا عظام): تمايل + قفز خفيف، أسرع مع السرعة
      body.position.y = Math.abs(Math.sin(st.t * 2.2)) * 0.22 * (0.2 + speedRatio);
      body.rotation.z = Math.sin(st.t * 1.1) * 0.05;
      body.rotation.x = Math.sin(st.t * 2.2 + 1) * 0.03 * (0.3 + speedRatio);
      if (this.fightT > 0) {
        this.fightT = Math.max(0, this.fightT - dt);
        const k = Math.sin((this.fightT / 0.35) * Math.PI);
        body.position.z = k * 0.35;
      } else body.position.z = 0;
    },
  };
}
function setCarryVisual(ant, items) {  while (ant.carrySlot.children.length) {
    const c = ant.carrySlot.children.pop();
    ant.carrySlot.remove(c);
  }
  items.forEach((kind, i) => {
    let m;
    if (kind === "leaf") {
      m = new THREE.Mesh(new THREE.CircleGeometry(0.34, 8), new THREE.MeshStandardMaterial({ color: 0x4da33a, side: THREE.DoubleSide, roughness: 1 }));
      m.rotation.x = -0.5;
    } else if (kind === "crumb") {
      m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0x9a6a35, roughness: 1 }));
    } else {
      const carryCols = { grapes: 0x8e44ad, banana: 0xffd93d, wheat: 0xe0aa3e, corn: 0xffc93d, fruit: 0xd93b3b, nut: 0x7a4a22, bone: 0xe8e0d0, bigapple: 0xd93b3b, bigmelon: 0x2f9e44, bigpumpkin: 0xe67e22 };
      m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: carryCols[kind] || 0xe8c33a, roughness: 0.8 }));
      m.scale.set(1, 1.25, 1);
    }
    m.position.set(((i % 2) ? 0.22 : -0.22), 0.05 + Math.floor(i / 2) * 0.32, (i % 3) * 0.1);
    m.rotation.y = i * 1.1;
    m.castShadow = true;
    ant.carrySlot.add(m);
  });
}

// ---------- الطعام ----------
function foodMesh(kind) {
  let m;
  if (kind === "fruit") {
    // تفاحة: ثمرة حمراء + غصن + ورقة
    const grp = new THREE.Group();
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), new THREE.MeshStandardMaterial({ color: 0xd93b3b, roughness: 0.45 }));
    apple.castShadow = true;
    grp.add(apple);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 5), new THREE.MeshStandardMaterial({ color: 0x5b3a1e }));
    stem.position.y = 0.36;
    grp.add(stem);
    const lf = new THREE.Mesh(new THREE.CircleGeometry(0.14, 7), new THREE.MeshStandardMaterial({ color: 0x4da33a, side: THREE.DoubleSide, roughness: 1 }));
    lf.position.set(0.12, 0.42, 0);
    lf.rotation.set(-0.6, 0.4, 0);
    grp.add(lf);
    return grp;
  } else if (kind === "leaf") {
    m = new THREE.Mesh(new THREE.CircleGeometry(0.45, 9), new THREE.MeshStandardMaterial({ color: [0x4da33a, 0x6fbf3f, 0x8fd14f][(Math.random() * 3) | 0], side: THREE.DoubleSide, roughness: 1 }));
    m.rotation.x = -Math.PI / 2;
  } else if (kind === "crumb") {
    m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.32), new THREE.MeshStandardMaterial({ color: 0xa8763e, roughness: 1, flatShading: true }));
  } else if (kind === "nut") {
    // جوز الغابة: كرة بنية + قبعة
    const grp2 = new THREE.Group();
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.7 }));
    nut.scale.set(1, 1.2, 1);
    nut.castShadow = true;
    grp2.add(nut);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.12, 9), new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 1 }));
    cap.position.y = 0.3;
    grp2.add(cap);
    return grp2;
  } else if (kind === "nectar") {
    // رحيق الحديقة: زهرة وردية صغيرة
    const grp3 = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const pt = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 7), new THREE.MeshStandardMaterial({ color: 0xff6fa5, roughness: 0.6 }));
      const a = (i / 5) * Math.PI * 2;
      pt.position.set(Math.cos(a) * 0.2, 0.25, Math.sin(a) * 0.2);
      grp3.add(pt);
    }
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 7), new THREE.MeshStandardMaterial({ color: 0xffd93d, roughness: 0.6 }));
    ctr.position.y = 0.3;
    grp3.add(ctr);
    return grp3;
  } else if (kind === "shell") {
    // صدف الشاطئ: قوقعت مسطحة
    m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 9, 7), new THREE.MeshStandardMaterial({ color: 0xf5e6d0, roughness: 0.4 }));
    m.scale.set(1, 0.55, 1.25);
  } else if (kind === "mushroom") {    // فطر الصخور: ساق + قبعت
    const grp4 = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.35, 7), new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.8 }));
    stem.position.y = 0.17;
    grp4.add(stem);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.26, 9, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }));
    hd.position.y = 0.32;
    hd.castShadow = true;
    grp4.add(hd);
    return grp4;
  } else if (kind === "lifeleaf") {
    // ورقة الحياة: ورقة خضراء متوهجة بحواف ذهبية
    const grp5 = new THREE.Group();
    const lf = new THREE.Mesh(new THREE.CircleGeometry(0.5, 9), new THREE.MeshStandardMaterial({ color: 0x37e06a, emissive: 0x0a5a22, side: THREE.DoubleSide, roughness: 0.5 }));
    lf.rotation.x = -Math.PI / 2;
    lf.position.y = 0.12;
    grp5.add(lf);
    const vein = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 7), new THREE.MeshStandardMaterial({ color: 0xffd93d, emissive: 0x6a4a00 }));
    vein.position.y = 0.2;
    grp5.add(vein);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 20), new THREE.MeshBasicMaterial({ color: 0x7dff9d, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.13;
    grp5.add(halo);
    return grp5;
  } else if (kind === "healbloom") {
    // زهرة الشفاء: بتلات وردية + قلب نابض
    const grp6 = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const pt = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 7), new THREE.MeshStandardMaterial({ color: 0xff8fb5, emissive: 0x5a1030, roughness: 0.5 }));
      const a = (i / 6) * Math.PI * 2;
      pt.position.set(Math.cos(a) * 0.26, 0.22, Math.sin(a) * 0.26);
      grp6.add(pt);
    }
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfff3a0, emissive: 0x8a6a00 }));
    ctr.position.y = 0.28;
    grp6.add(ctr);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 1 }));
    st.position.y = 0.1;
    grp6.add(st);
    return grp6;
  } else if (kind === "crystal") {
    // بلورة جينية: ثماني شفاف متوهج
    const grp7 = new THREE.Group();
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), new THREE.MeshStandardMaterial({ color: 0x66e0ff, emissive: 0x0a4a6a, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.95 }));
    cr.position.y = 0.42;
    cr.castShadow = true;
    grp7.add(cr);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x5a5a6a, roughness: 0.9 }));
    base.position.y = 0.06;
    grp7.add(base);
    return grp7;
  } else if (kind === "pollen") {
    // غبار اللقاح: عنقود كرات ذهبية عائمة
    const grp8 = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (i % 2) * 0.05, 7, 7), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0x7a5a00, roughness: 0.4 }));
      s.position.set(rand(-0.25, 0.25), 0.25 + i * 0.12, rand(-0.25, 0.25));
      grp8.add(s);
    }
    return grp8;
  } else if (kind === "mednectar") {
    // رحيق طبي: قارورة زجاجية بسائل أخضر
    const grp9 = new THREE.Group();
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.5, roughness: 0.1 }));
    bot.position.y = 0.25;
    grp9.add(bot);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x37e06a, emissive: 0x0a5a22, roughness: 0.3 }));
    liq.position.y = 0.18;
    grp9.add(liq);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 1 }));
    cork.position.y = 0.5;
    grp9.add(cork);
    return grp9;
  } else if (kind === "amber") {
    // كهرمان الشجرة العتيقة: بلورات برتقالية متوهجة من صمغ الشجرة
    const grpA = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + (i === 0 ? 0.12 : 0)), new THREE.MeshStandardMaterial({ color: 0xff9f1a, emissive: 0x8a4a00, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.96 }));
      cr.position.set((i - 1) * 0.32, 0.3 + (i % 2) * 0.18, (i % 2 ? 0.15 : -0.12));
      cr.rotation.y = i * 1.1;
      cr.castShadow = true;
      grpA.add(cr);
    }
    const haloA = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 18), new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    haloA.rotation.x = -Math.PI / 2;
    haloA.position.y = 0.13;
    grpA.add(haloA);
    return grpA;
  } else if (kind === "grapes") {
    // عنقود عنب: كرات بنفسجية + غصن + ورقة
    const grpG = new THREE.Group();
    const gm1 = new THREE.MeshStandardMaterial({ color: 0x7a2fa0, roughness: 0.35 });
    const gm2 = new THREE.MeshStandardMaterial({ color: 0x9b4fc4, roughness: 0.35 });
    const spots = [[0, 0.3, 0], [0.16, 0.28, 0.06], [-0.15, 0.29, -0.05], [0.08, 0.14, -0.1], [-0.08, 0.15, 0.1], [0, 0.12, 0], [0.02, 0.44, -0.02]];
    spots.forEach((s, i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 9), i % 2 ? gm2 : gm1);
      b.position.set(s[0], s[1], s[2]);
      b.castShadow = true;
      grpG.add(b);
    });
    const gst = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 5), new THREE.MeshStandardMaterial({ color: 0x5b6e2a, roughness: 1 }));
    gst.position.y = 0.58;
    grpG.add(gst);
    const glf = new THREE.Mesh(new THREE.CircleGeometry(0.15, 7), new THREE.MeshStandardMaterial({ color: 0x4da33a, side: THREE.DoubleSide, roughness: 1 }));
    glf.position.set(0.14, 0.6, 0);
    glf.rotation.set(-0.6, 0.4, 0);
    grpG.add(glf);
    return grpG;
  } else if (kind === "banana") {
    // موزة: هلال أصفر + طرفان بنيان
    const grpB = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 8, 14, 2.3), new THREE.MeshStandardMaterial({ color: 0xffd93d, roughness: 0.5 }));
    arc.rotation.set(Math.PI / 2, 0, 0.5);
    arc.position.y = 0.18;
    arc.castShadow = true;
    grpB.add(arc);
    const tmat = new THREE.MeshStandardMaterial({ color: 0x6b4a22, roughness: 1 });
    for (const a of [0.5, 0.5 + 2.3]) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), tmat);
      tip.position.set(Math.cos(a) * 0.3, 0.18, -Math.sin(a) * 0.3);
      grpB.add(tip);
    }
    return grpB;
  } else if (kind === "wheat") {
    // سنبلة قمح: ساق + حبوب ذهبية
    const grpW = new THREE.Group();
    const stw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.85, 5), new THREE.MeshStandardMaterial({ color: 0x9a8a3a, roughness: 1 }));
    stw.position.y = 0.42;
    grpW.add(stw);
    const grm = new THREE.MeshStandardMaterial({ color: 0xe0aa3e, roughness: 0.7 });
    for (let i = 0; i < 7; i++) {
      const gr = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 7), grm);
      gr.scale.set(1, 1.7, 1);
      const side = i % 2 ? 1 : -1;
      gr.position.set(side * 0.08, 0.62 + i * 0.075, 0);
      gr.rotation.z = side * 0.5;
      gr.castShadow = true;
      grpW.add(gr);
    }
    const wtip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 7), grm);
    wtip.scale.set(1, 1.6, 1);
    wtip.position.y = 1.18;
    grpW.add(wtip);
    return grpW;
  } else if (kind === "corn") {
    // ذرة: كوز أصفر + قشر أخضر
    const grpC = new THREE.Group();
    const cob = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.55, 9), new THREE.MeshStandardMaterial({ color: 0xffc93d, roughness: 0.6 }));
    cob.position.y = 0.42;
    cob.castShadow = true;
    grpC.add(cob);
    const ccap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), new THREE.MeshStandardMaterial({ color: 0xffd93d, roughness: 0.6 }));
    ccap.position.y = 0.7;
    grpC.add(ccap);
    const husk = new THREE.MeshStandardMaterial({ color: 0x4da33a, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 5), husk);
      const a = (i / 3) * Math.PI * 2;
      h.position.set(Math.cos(a) * 0.14, 0.2, Math.sin(a) * 0.14);
      h.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      grpC.add(h);
    }
    return grpC;
  } else if (kind === "bone") {
    // عظم 🦴: عمود + عقدتان من كل طرف — غنيمة أم 44 (أكل وتطوير)
    const grpBn = new THREE.Group();
    const bmat = new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.55 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 8), bmat);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.y = 0.28;
    shaft.castShadow = true;
    grpBn.add(shaft);
    for (const ex of [-0.28, 0.28]) for (const oy of [-0.08, 0.08]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), bmat);
      knob.position.set(ex, 0.28 + oy, 0);
      knob.castShadow = true;
      grpBn.add(knob);
    }
    return grpBn;
  } else if (kind === "bigapple") {
    // 🍎 تفاحة عملاقة (وليمة 400): ثمرة حمراء ضخمة + غصن + ورقة
    const grpBA = new THREE.Group();
    const ba = new THREE.Mesh(new THREE.SphereGeometry(2.1, 14, 14), new THREE.MeshStandardMaterial({ color: 0xd93b3b, roughness: 0.4 }));
    ba.position.y = 2.1;
    ba.castShadow = true;
    grpBA.add(ba);
    const bst = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x5b3a1e }));
    bst.position.y = 4.3;
    grpBA.add(bst);
    const blf = new THREE.Mesh(new THREE.CircleGeometry(0.7, 8), new THREE.MeshStandardMaterial({ color: 0x4da33a, side: THREE.DoubleSide, roughness: 1 }));
    blf.position.set(0.6, 4.5, 0);
    blf.rotation.set(-0.6, 0.4, 0);
    grpBA.add(blf);
    const blf2 = blf.clone();
    blf2.position.set(-0.6, 4.3, 0.2);
    grpBA.add(blf2);
    return grpBA;
  } else if (kind === "bigmelon") {
    // 🍉 بطيخة عملاقة (وليمة ~450): كرة خضراء مخطط + غصن حلزوني
    const grpBM = new THREE.Group();
    const bm = new THREE.Mesh(new THREE.SphereGeometry(2.3, 14, 14), new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: 0.5 }));
    bm.scale.set(1, 0.9, 1);
    bm.position.y = 2.0;
    bm.castShadow = true;
    grpBM.add(bm);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(2.32, 8, 8, a, 0.18), new THREE.MeshStandardMaterial({ color: 0x1e6e2e, roughness: 0.6 }));
      stripe.scale.set(1, 0.9, 1);
      stripe.position.y = 2.0;
      grpBM.add(stripe);
    }
    const mst = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x5b6e2a, roughness: 1 }));
    mst.position.y = 4.1;
    mst.rotation.z = 0.4;
    grpBM.add(mst);
    return grpBM;
  } else if (kind === "bigpumpkin") {
    // 🎃 يقطين عملاق (وليمة ~500): كرة برتقالية مضلعة + ساق
    const grpBP = new THREE.Group();
    const bp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 12), new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.55, flatShading: true }));
    bp.scale.set(1, 0.82, 1);
    bp.position.y = 1.8;
    bp.castShadow = true;
    grpBP.add(bp);
    const pst = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 7), new THREE.MeshStandardMaterial({ color: 0x4a7d2c, roughness: 1 }));
    pst.position.y = 3.7;
    grpBP.add(pst);
    return grpBP;
  } else {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 9, 9), new THREE.MeshStandardMaterial({ color: 0xe8c33a, roughness: 0.75 }));
    m.scale.set(1, 1.3, 1);
  }
  m.castShadow = true;
  return m;
}
function spawnFood(x, z, kind) {
  if (!kind) {
    const r = Math.random();
    kind = r < 0.2 ? "seed" : r < 0.32 ? "leaf" : r < 0.44 ? "fruit" : r < 0.56 ? "grapes" : r < 0.66 ? "banana" : r < 0.76 ? "wheat" : r < 0.84 ? "corn" : r < 0.92 ? "crumb" : "nut";
  }
  if (x === undefined || z === undefined) {
    const p = randPos(4, 10);
    x = p.x; z = p.z;
  }
  const mesh = foodMesh(kind);
  const fy = kind === "leaf" ? 0.06 : 0.3;
  mesh.position.set(x, fy, z);
  scene.add(mesh);
  const f = { mesh, kind, x, z, bob: Math.random() * 6, baseY: fy, baseRotY: 0, flat: kind === "leaf" || kind === "lifeleaf" };
  game.foods.push(f);
  return f;
}
function removeFood(f) {
  scene.remove(f.mesh);
  const i = game.foods.indexOf(f);
  if (i >= 0) game.foods.splice(i, 1);
}

// ---------- الجسيمات (انفجارات صغيرة عند الالتقاط والإيداع) ----------
const PMAX = 260;
let pGeo = null, pPts = null;
const pPos = new Float32Array(PMAX * 3);
const pCol = new Float32Array(PMAX * 3);
const pVel = new Float32Array(PMAX * 3);
const pLife = new Float32Array(PMAX);
let pCursor = 0;
function initParticles() {
  pGeo = new THREE.BufferGeometry();
  for (let i = 0; i < PMAX; i++) pPos[i * 3 + 1] = -999;
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  pPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  pPts.frustumCulled = false;
  scene.add(pPts);
}
function spawnBurst(x, y, z, colorHex, n = 12, spread = 3, up = 4) {
  if (!pPts) return;
  if (game.settings && game.settings.quality === "low") n = Math.max(2, Math.round(n / 2));
  const c = new THREE.Color(colorHex);
  for (let k = 0; k < n; k++) {
    const i = pCursor; pCursor = (pCursor + 1) % PMAX;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
    pVel[i * 3] = Math.cos(a) * r;
    pVel[i * 3 + 1] = Math.random() * up + 1;
    pVel[i * 3 + 2] = Math.sin(a) * r;
    pLife[i] = 0.5 + Math.random() * 0.4;
  }
}
function updateParticles(dt) {
  if (!pPts) return;
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
    pVel[i * 3 + 1] -= 9 * dt;
    pPos[i * 3] += pVel[i * 3] * dt;
    pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
    pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    if (pPos[i * 3 + 1] < 0.03) { pPos[i * 3 + 1] = 0.03; pVel[i * 3 + 1] *= -0.3; }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

// ---------- عناصر تطير إلى الظهر ثم إلى العش ----------
const flyers = [];
function carrierTop(c) {
  const v = c.ant.group.position.clone();
  v.y += 1.5;
  return v;
}
function spawnFlyer(kind, from, targetFn, onDone, delay = 0) {
  if (flyers.length > 24) { if (onDone) onDone(); return; }
  const mesh = foodMesh(kind);
  mesh.position.copy(from);
  mesh.scale.setScalar(0.8);
  scene.add(mesh);
  flyers.push({ mesh, from: from.clone(), targetFn, onDone, t: -delay, dur: 0.38 });
}
function updateFlyers(dt) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    f.t += dt;
    if (f.t < 0) continue;
    const k = Math.min(1, f.t / f.dur);
    const tgt = f.targetFn();
    const e = 1 - Math.pow(1 - k, 2);
    f.mesh.position.lerpVectors(f.from, tgt, e);
    f.mesh.position.y += Math.sin(k * Math.PI) * 1.2;
    f.mesh.rotation.y += dt * 6;
    if (k >= 1) {
      scene.remove(f.mesh);
      flyers.splice(i, 1);
      if (f.onDone) f.onDone();
    }
  }
}

// ---------- مصادر الموارد (أكوام وشجيرات تُحصد تدريجياً) ----------
const NODE_KINDS = ["seed", "leaf", "fruit", "grapes", "banana", "wheat", "corn", "crumb"];
function spawnNode(x, z, kind) {
  kind = kind || NODE_KINDS[(Math.random() * NODE_KINDS.length) | 0];
  if (x === undefined || z === undefined) {
    const p = randPos(8, 14);
    x = p.x; z = p.z;
  }
  const max = kind === "fruit" ? 4 : 6;
  const g = new THREE.Group();
  const units = [];
  let collider = null;
  if (kind === "fruit") {
    // شجيرة توت تحمل ثماراً بعدد المخزون
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f7d2c, roughness: 1, flatShading: true });
    for (const [ox, oy, oz, r] of [[0, 0.8, 0, 0.9], [0.6, 0.6, 0.3, 0.6], [-0.55, 0.65, -0.2, 0.65]]) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), bushMat);
      b.position.set(ox, oy, oz);
      b.castShadow = true;
      g.add(b);
    }
    for (let i = 0; i < max; i++) {
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), new THREE.MeshStandardMaterial({ color: 0xd93b3b, roughness: 0.5 }));
      const ang = (i / max) * Math.PI * 2;
      a.position.set(Math.cos(ang) * 0.75, 0.9 + ((i % 2) * 0.35), Math.sin(ang) * 0.75);
      a.castShadow = true;
      g.add(a);
      units.push(a);
    }
    collider = { x, z, r: 1.0 };
    game.colliders.push(collider);
  } else {
    const dirt = new THREE.Mesh(new THREE.CircleGeometry(1.3, 14), new THREE.MeshStandardMaterial({ color: 0x9a7a4d, roughness: 1 }));
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.09;
    dirt.receiveShadow = true;
    g.add(dirt);
    for (let i = 0; i < max; i++) {
      const u = foodMesh(kind);
      u.position.set(rand(-0.8, 0.8), kind === "leaf" ? 0.05 : (kind === "wheat" || kind === "corn") ? 0.02 : 0.25, rand(-0.8, 0.8));
      u.rotation.y = rand(0, 6);
      g.add(u);
      units.push(u);
    }
  }
  g.position.set(x, 0, z);
  scene.add(g);
  const node = { kind, x, z, amount: max, max, group: g, units, pulse: 0, collider };
  game.nodes.push(node);
  return node;
}
// ---------- العقد النادرة (موارد المركز — في المناطق الخطيرة) ----------
const RARE_NODE_DEFS = [
  { kind: "lifeleaf", at: () => randInRect(REGIONS[1], 5) },
  { kind: "healbloom", at: () => randInRect(REGIONS[2], 5) },
  { kind: "mednectar", at: () => randInRect(REGIONS[3], 5) },
  { kind: "crystal", at: () => randInRect(REGIONS[4], 5) },
  { kind: "pollen", at: () => {
    const cs = game.colonies.filter((c) => c.alive);
    if (cs.length && Math.random() < 0.7) {
      const c = cs[(Math.random() * cs.length) | 0];
      return { x: THREE.MathUtils.clamp(c.x + rand(-10, 10), -TUNE.worldHalf, TUNE.worldHalf), z: THREE.MathUtils.clamp(c.z + rand(-10, 10), -TUNE.worldHalf, TUNE.worldHalf) };
    }
    return randInRect(REGIONS[4], 5);
  } },
];
function rareNodeCount(kind) {
  let n = 0;
  for (const nd of game.nodes) if (nd.kind === kind) n += nd.amount;
  return n;
}
function spawnRareNode(kind, x, z) {
  const max = 3;
  const g = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 22), new THREE.MeshBasicMaterial({ color: 0x7dffd0, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.13;
  g.add(halo);
  const units = [halo];
  for (let i = 0; i < max; i++) {
    const u = foodMesh(kind);
    u.position.set(rand(-0.7, 0.7), 0.3, rand(-0.7, 0.7));
    u.rotation.y = rand(0, 6);
    g.add(u);
    units.push(u);
  }
  if (x === undefined || z === undefined) {
    const def = RARE_NODE_DEFS.find((d) => d.kind === kind) || RARE_NODE_DEFS[0];
    const p = def.at();
    x = p.x; z = p.z;
  }
  g.position.set(x, 0, z);
  scene.add(g);
  const node = { kind, rare: true, x, z, amount: max, max, group: g, units, pulse: 0, collider: null };
  game.nodes.push(node);
  return node;
}
function rareTick() {
  for (const def of RARE_NODE_DEFS) {
    if (rareNodeCount(def.kind) < 4 && Math.random() < 0.5) spawnRareNode(def.kind);
  }
  while (game.nodes.filter((n) => n.rare).length > 12) {
    const i = game.nodes.findIndex((n) => n.rare);
    if (i < 0) break;
    removeNode(game.nodes[i]);
  }
}
function removeNode(n) {
  scene.remove(n.group);
  const i = game.nodes.indexOf(n);
  if (i >= 0) game.nodes.splice(i, 1);
  if (n.collider) {
    const ci = game.colliders.indexOf(n.collider);
    if (ci >= 0) game.colliders.splice(ci, 1);
  }
  spawnBurst(n.x, 0.8, n.z, 0x9a7a4d, 10, 2, 3);
}
function nearestNode(x, z, maxD = 60) {
  let best = null, bd = maxD;
  for (const n of game.nodes) {
    if (!n.amount) continue;
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// ---------- الولائم العملاقة 🍎🍉🎃: أكل كبير (400-500 🍯) يخلص وتطلع غيرها بمكان ثاني ----------
const FEAST_DEFS = [
  { kind: "bigapple", icon: "🍎", name: "تفاحة كبيرة", trips: 40, total: 400 },
  { kind: "bigmelon", icon: "🍉", name: "بطيخة كبيرة", trips: 38, total: 456 },
  { kind: "bigpumpkin", icon: "🎃", name: "يقطين كبير", trips: 34, total: 510 },
];
function feastCount() { let n = 0; for (const nd of game.nodes) if (nd.feast) n++; return n; }
function spawnFeast(kind, x, z, silent) {
  const def = FEAST_DEFS.find((d) => d.kind === kind) || FEAST_DEFS[(Math.random() * FEAST_DEFS.length) | 0];
  if (x === undefined || z === undefined) {
    const p = randPos(10, 30); // بعيد عن العش — مغامرة تستاهل
    x = p.x; z = p.z;
  }
  const g = new THREE.Group();
  const mesh = foodMesh(def.kind);
  g.add(mesh);
  // هالة ذهبية حول الوليمة + عمود نور يُرى من بعيد
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 26), new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 7, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 3.5;
  g.add(beam);
  g.position.set(x, 0, z);
  scene.add(g);
  const collider = { x, z, r: 2.4 };
  game.colliders.push(collider);
  const node = { kind: def.kind, feast: true, icon: def.icon, name: def.name, x, z, amount: def.trips, max: def.trips, per: KNOWN_FOODS[def.kind].value, total: def.total, got: 0, group: g, mesh, beam, ring, units: [], pulse: 0, collider };
  game.nodes.push(node);
  if (!silent) {
    toast(`${def.icon} ${def.name} ظهرت! (~${def.total} 🍯 — اتبع العمود الذهبي)`);
    try { sfx.level && sfx.level(); } catch {}
  }
  return node;
}
function feastTick(dt) {
  // دائماً وليمتان بالعالم — والناقص يُعوَّض بعد مهلة قصير
  game._feastT = (game._feastT || 8) - dt;
  if (game._feastT <= 0) {
    game._feastT = 8;
    if (feastCount() < 2) spawnFeast();
  }
  const t = (game.time || 0);
  for (const n of game.nodes) {
    if (!n.feast || !n.beam) continue;
    // لمعة هادئة جداً وبطيئة — بلا وميض سريع يؤذي العين
    n.beam.material.opacity = 0.09 + Math.sin(t * 0.8 + n.x) * 0.02;
    n.ring.material.opacity = 0.45 + Math.sin(t * 1.2 + n.z) * 0.08;
  }
}

// ---------- الحصاد: قطع مفردة + مصادر ----------
function enableAutoReturn() {
  if (game.autoOn && !game.autoReturn) {
    game.autoReturn = true;
    toast("🎒 الحمولة ممتلئة — عودة تلقائية للعش (اسحب للإلغاء)");
  }
}
function pickupItem(c, f, isPlayer, cap) {
  c.carried.push(f.kind);
  setCarryVisual(c.ant, c.carried);
  spawnFlyer(f.kind, f.mesh.position.clone(), () => carrierTop(c), () => { c.carryPop = 1; });
  spawnBurst(f.x, 0.5, f.z, 0xffffff, 6, 2, 3);
  removeFood(f);
  if (isPlayer) {
    sfx.pickup();
    if (c.carried.length >= cap) enableAutoReturn();
  }
}
function harvestNode(c, n, isPlayer, cap) {
  n.amount--;
  if (n.feast) {
    // وليمة عملاقة: تصغر كل حصدة بدل تفكيك القطع + عدّاد المجموع
    n.got = (n.got || 0) + (n.per || 10);
    const k = Math.max(0.15, n.amount / n.max);
    if (n.mesh) n.mesh.scale.setScalar(Math.max(0.15, k));
    if (n.mesh) n.mesh.position.y = -((1 - k) * 1.2);
  } else {
    const u = n.units.pop();
    if (u) n.group.remove(u);
  }
  n.pulse = 1;
  c.carried.push(n.kind);
  setCarryVisual(c.ant, c.carried);
  const from = new THREE.Vector3(n.x, 1.3, n.z);
  spawnFlyer(n.kind, from, () => carrierTop(c), () => { c.carryPop = 1; });
  spawnBurst(n.x, 1.1, n.z, 0xfff6c9, 6, 1.5, 2.5);
  if (n.amount <= 0) {
    removeNode(n);
    if (n.feast) {
      // خلصت — تطلع غيرها بمكان ثاني 🍎➡️🍉
      toast(`${n.icon || "🍎"} خلصت ${n.name || "الوليمة"}! (+${n.got || n.total || 400} 🍯 جمعت منها — بتطلع وحدة جديدةة بمكان ثاني)`);
      try { sfx.level && sfx.level(); } catch {}
      setTimeout(() => { try { if (feastCount() < 3) spawnFeast(); } catch {} }, 12000);
    }
  }
  if (isPlayer) {
    sfx.harvest();
    if (c.carried.length >= cap) enableAutoReturn();
  }
}
function harvestTick(c, cap, isPlayer, dt, haste = 1) {
  c.harvestCd = (c.harvestCd || 0) - dt;
  if (c.carried.length >= cap || c.harvestCd > 0) return;
  // أولاً: أقرب قطعة مفردة
  let best = null, bd = 1.8;
  for (const f of game.foods) {
    const d = Math.hypot(f.x - c.x, f.z - c.z);
    if (d < bd) { bd = d; best = f; }
  }
  if (best) {
    pickupItem(c, best, isPlayer, cap);
    c.harvestCd = 0.22;
    return;
  }
  // ثانياً: مصادر قريبة (أكوام/شجيرات)
  let bn = null, bnd = 2.6;
  for (const n of game.nodes) {
    if (!n.amount) continue;
    const d = Math.hypot(n.x - c.x, n.z - c.z) - (n.feast ? 2.2 : n.kind === "fruit" ? 1.0 : 0);
    if (d < bnd) { bnd = d; bn = n; }
  }
  if (bn) {
    harvestNode(c, bn, isPlayer, cap);
    c.harvestCd = 0.7 / haste;
  }
}

// ---------- الخنفساء (عدو) ----------
function createBeetle() {
  const g = new THREE.Group();
  if (Models.beetle) {
    // مجسم glb خارجي للخنفساء
    const m = fitModel(Models.beetle.clone(true), 2.0);
    g.add(m);
    const baseY = m.userData.baseY || 0;
    const p = randPos(8, WILD_KEEPOUT_R + 14);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x3a0d0d, side: THREE.DoubleSide, depthWrite: false }));
    const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x51ff5e, side: THREE.DoubleSide, depthWrite: false }));
    hpBg.rotation.x = hpFg.rotation.x = -Math.PI / 2;
    hpBg.visible = hpFg.visible = false;
    scene.add(hpBg); scene.add(hpFg);
    return {
      group: g, legs: [], x: p.x, z: p.z, yaw: rand(0, 6.28), speed: rand(2.4, 3.2),
      wanderT: 0, tx: p.x, tz: p.z, atkCd: 0, legT: 0,
      hp: 30, maxHp: 30, hpBg, hpFg, hitFlash: 0,
      update(dt, t) { m.position.y = baseY + Math.abs(Math.sin(t * 6)) * 0.06; },
    };
  }
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa02020, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a0d0d, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), bodyMat);
  body.scale.set(1, 0.7, 1.35);
  body.position.y = 0.6;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), darkMat);
  head.position.set(0, 0.5, 1.25);
  head.castShadow = true;
  g.add(head);
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 6), darkMat);
    horn.position.set(sx * 0.2, 0.75, 1.5);
    horn.rotation.x = 0.9;
    g.add(horn);
  }
  const legs = [];
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.6, 0.5, 0.7 - i * 0.65);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 1, 5), darkMat);
      seg.position.y = -0.5;
      hip.add(seg);
      g.add(hip);
      legs.push({ hip, side, phase: (i % 2 ? Math.PI : 0) + (side < 0 ? 0 : Math.PI) });
    }
  }
  const p = randPos(8, WILD_KEEPOUT_R + 14);
  g.position.set(p.x, 0, p.z);
  scene.add(g);
  // شريط صحة فوق الخنفساء
  const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x3a0d0d, side: THREE.DoubleSide, depthWrite: false }));
  const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x51ff5e, side: THREE.DoubleSide, depthWrite: false }));
  hpBg.rotation.x = hpFg.rotation.x = -Math.PI / 2;
  hpBg.position.y = hpFg.position.y = 1.7;
  hpBg.visible = hpFg.visible = false;
  scene.add(hpBg); scene.add(hpFg);
  return {
    group: g, legs, x: p.x, z: p.z, yaw: rand(0, 6.28), speed: rand(2.4, 3.2),
    wanderT: 0, tx: p.x, tz: p.z, atkCd: 0, legT: Math.random() * 9,
    hp: 30, maxHp: 30, hpBg, hpFg, hitFlash: 0,
    update(dt, t) {
      this.legT += dt * 7;
      for (const L of this.legs) {
        const p2 = this.legT + L.phase;
        L.hip.rotation.y = L.side * 0.5 + Math.sin(p2) * 0.45;
        L.hip.rotation.z = L.side * (0.7 + Math.max(0, Math.sin(p2 + 1.5)) * 0.35);
      }
    },
  };
}

// ---------- المخلوقات البرية والمجموعة: خنافس وعناكب ويرقات وفراشات وحشرات ----------
const CREATURE_RARITY = {
  common: { name: "شائع", color: "#8d99ae", w: 56 },
  uncommon: { name: "غير شائع", color: "#219ebc", w: 28 },
  rare: { name: "نادر", color: "#9d4edd", w: 12 },
  legendary: { name: "أسطوري", color: "#e69b00", w: 4 },
};
const CREATURE_SPECIES = {
  grub: { name: "يرقة", icon: "🐛", rarity: "common", hp: 22, dmg: 0, spd: 1.6, reward: 3, hostile: false, flees: false, flies: false, scale: 1 },
  beetle: { name: "خنفساء برية", icon: "🪲", rarity: "common", hp: 38, dmg: 6, spd: 3.2, reward: 4, hostile: true, flees: false, flies: false, scale: 1 },
  cricket: { name: "جندب", icon: "🦗", rarity: "uncommon", hp: 26, dmg: 3, spd: 7, reward: 5, hostile: false, flees: true, flies: false, scale: 1 },
  spider: { name: "عنكبوت", icon: "🕷", rarity: "uncommon", hp: 55, dmg: 9, spd: 4.4, reward: 7, hostile: true, flees: false, flies: false, scale: 1 },
  butterfly: { name: "فراشة", icon: "🦋", rarity: "uncommon", hp: 16, dmg: 0, spd: 5, reward: 6, hostile: false, flees: true, flies: true, flyH: 4, scale: 1 },
  rhino: { name: "وحيد القرن", icon: "🦏", rarity: "rare", hp: 135, dmg: 16, spd: 3.2, reward: 14, hostile: true, flees: false, flies: false, scale: 1.35 },
  monarch: { name: "فراشة ملكية", icon: "👑", rarity: "rare", hp: 48, dmg: 0, spd: 6, reward: 14, hostile: false, flees: true, flies: true, flyH: 5, scale: 1.25 },
  wolf: { name: "ذئب عملاق", icon: "🐺", rarity: "legendary", hp: 230, dmg: 22, spd: 5, reward: 30, hostile: true, flees: false, flies: false, scale: 1.7 },
  termite: { name: "نملة أبيض", icon: "🤍", rarity: "uncommon", hp: 45, dmg: 7, def: 1, spd: 5.2, reward: 0, hostile: true, flees: false, flies: false, scale: 1.1, zone: "tree", noCapture: true, dropAmber: true },
  centipede: { name: "أم أربعة وأربعين", icon: "🪱", rarity: "legendary", hp: 520, dmg: 22, def: 2, spd: 4.2, reward: 0, hostile: true, flees: false, flies: false, scale: 1.6, zone: "tree", noCapture: true },
  siege: { name: "خنفساء الحصار", icon: "🪲", rarity: "legendary", hp: 420, dmg: 18, def: 1, spd: 3.4, reward: 0, hostile: true, flees: false, flies: false, scale: 2.2, noCapture: true, noWild: true },
};
const CREATURE_MAX_LEVEL = 5;
const CREATURE_DEPLOY_CAP = 4;
function cMat(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6 }, extra || {}));
}
function cBall(r, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.scale.set(sx || 1, sy || 1, sz || 1);
  m.castShadow = true;
  return m;
}
function cLeg(mat, len, r) {
  const hip = new THREE.Group();
  const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.6, len, 5), mat);
  seg.position.y = -len / 2;
  seg.castShadow = true;
  hip.add(seg);
  return hip;
}
function scuttleLegs(legs, t, speed) {
  for (const L of legs) {
    const p = t * (speed || 1) + L.phase;
    L.hip.rotation.y = L.side * 0.5 + Math.sin(p) * 0.45;
    L.hip.rotation.z = L.side * (0.7 + Math.max(0, Math.sin(p + 1.5)) * 0.35);
  }
}
function addHpBar(g, w, y) {
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.14), new THREE.MeshBasicMaterial({ color: 0x3a0d0d, side: THREE.DoubleSide, depthWrite: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.14), new THREE.MeshBasicMaterial({ color: 0x51ff5e, side: THREE.DoubleSide, depthWrite: false }));
  bg.rotation.x = fg.rotation.x = -Math.PI / 2;
  bg.position.y = fg.position.y = y;
  bg.visible = fg.visible = false;
  scene.add(bg); scene.add(fg);
  return { bg, fg, w };
}
// مجسم + أنيميشن كل نوع (anim(dt, t, moving, c))
function buildCreatureMesh(key, sp) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const s = sp.scale || 1;
  let anim = () => {};
  if (key === "grub") {
    const m = cMat(0x7ddb4e);
    const dm = cMat(0x4a8a2a);
    const segs = [];
    for (let i = 0; i < 5; i++) {
      const b = cBall(0.42 - i * 0.05, i === 0 ? dm : m, 0, 0.35, 1.0 - i * 0.62);
      inner.add(b); segs.push(b);
    }
    // رأس داكن بعينين + نتوءات أرجل
    const hg = cBall(0.3, dm, 0, 0.4, 1.55);
    inner.add(hg);
    const eyeG = cMat(0x141414, { roughness: 0.2 });
    for (const sx of [-0.12, 0.12]) inner.add(cBall(0.06, eyeG, sx, 0.48, 1.8));
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
      const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.3, 4), dm);
      nub.position.set(side * 0.35, 0.15, 0.6 - i * 0.5);
      nub.rotation.z = side * 0.5;
      inner.add(nub);
    }
    anim = (dt, t) => {
      segs.forEach((b, i) => { b.scale.y = 1 + Math.sin(t * 6 - i * 0.9) * 0.25; });
      inner.position.y = Math.abs(Math.sin(t * 3)) * 0.06;
    };
  } else if (key === "beetle") {
    // دعسوقة 🐞: قبة حمراء منقطة + رأس أسود + خط وسط — حشرة اللاعب المفضلة
    const shell = cMat(0xc22a1e, { roughness: 0.35 });
    const blk = cMat(0x1a1a1a, { roughness: 0.5 });
    inner.add(cBall(0.85, shell, 0, 0.62, 0, 1, 0.72, 1.3));
    const headB = cBall(0.38, blk, 0, 0.5, 1.28);
    inner.add(headB);
    // خط الوسط بين الجناحين
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 1.7), blk);
    seam.position.set(0, 1.18, 0.05);
    inner.add(seam);
    // نقاط سوداء على القبة
    const spotPos = [[-0.45, 1.05, 0.55], [0.45, 1.05, 0.55], [-0.55, 0.95, -0.25], [0.55, 0.95, -0.25], [-0.35, 1.1, -0.85], [0.35, 1.1, -0.85], [0, 1.22, 0.15]];
    for (const [sx, sy, sz] of spotPos) inner.add(cBall(0.13, blk, sx, sy, sz));
    // عيون بيضاء صغيرة + قرون
    const eyeW = cMat(0xffffff, { emissive: 0x222222 });
    for (const sx of [-0.16, 0.16]) {
      inner.add(cBall(0.09, eyeW, sx, 0.62, 1.58));
      inner.add(cBall(0.045, blk, sx, 0.62, 1.66));
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), blk);
      ant.position.set(sx * 1.4, 0.85, 1.45);
      ant.rotation.x = -0.6; ant.rotation.z = sx * 2.2;
      inner.add(ant);
    }
    const legs = [];
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
      const hip = cLeg(blk, 0.9, 0.07);
      hip.position.set(side * 0.6, 0.5, 0.7 - i * 0.65);
      inner.add(hip);
      legs.push({ hip, side, phase: (i % 2 ? Math.PI : 0) + (side < 0 ? 0 : Math.PI) });
    }
    anim = (dt, t, moving, c) => {
      c.legT += dt * 7;
      scuttleLegs(legs, c.legT, 1);
      inner.position.y = Math.abs(Math.sin(t * 6)) * 0.06;
      if (c && c.attackT > 0) headB.position.y = 0.5 + Math.sin(t * 40) * 0.06;
    };
  } else if (key === "rhino") {
    // وحيد القرن: درع داكن + قرن ضخم + صدر مصفح
    const m = cMat(0x5a1a3a);
    const dm = cMat(0x2a0a1a);
    inner.add(cBall(0.85, m, 0, 0.6, 0, 1, 0.7, 1.35));
    inner.add(cBall(0.4, dm, 0, 0.5, 1.25));
    // صدر مصفح إضافي
    inner.add(cBall(0.55, dm, 0, 0.75, 0.35, 1.1, 0.6, 0.9));
    const hornLen = 1.3;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, hornLen, 6), dm);
    horn.position.set(0, 0.75 + hornLen * 0.3, 1.55);
    horn.rotation.x = 0.9;
    inner.add(horn);
    const legs = [];
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
      const hip = cLeg(dm, 1, 0.08);
      hip.position.set(side * 0.6, 0.5, 0.7 - i * 0.65);
      inner.add(hip);
      legs.push({ hip, side, phase: (i % 2 ? Math.PI : 0) + (side < 0 ? 0 : Math.PI) });
    }
    anim = (dt, t, moving, c) => {
      c.legT += dt * 7;
      scuttleLegs(legs, c.legT, 1);
      inner.position.y = Math.abs(Math.sin(t * 6)) * 0.06;
      horn.rotation.z = (c && c.attackT > 0) ? Math.sin(t * 40) * 0.15 : 0;
    };
  } else if (key === "spider" || key === "wolf") {
    const big = key === "wolf";
    const m = cMat(big ? 0x1a1a22 : 0x2a2a33);
    inner.add(cBall(0.7, m, 0, 0.7, -0.55, 1, 0.9, 1.2));
    inner.add(cBall(0.45, m, 0, 0.6, 0.5));
    const eyeM = cMat(0xff2222, { emissive: big ? 0xaa0000 : 0x550000 });
    for (const sx of [-0.15, 0.15]) inner.add(cBall(0.09, eyeM, sx, 0.75, 0.85));
    if (!big) {
      // عنكبوت: أنياب + عيون إضافية صغيرة
      for (const sx of [-0.28, 0.28]) inner.add(cBall(0.05, eyeM, sx, 0.78, 0.82));
      for (const sx of [-1, 1]) {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 5), cMat(0x0a0a0a));
        fang.position.set(sx * 0.18, 0.35, 0.85);
        fang.rotation.x = Math.PI;
        inner.add(fang);
      }
    } else {
      // ذئب: أذنان + خطم + ذيل
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), m);
        ear.position.set(sx * 0.28, 1.0, 0.45);
        inner.add(ear);
      }
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 6), cMat(0x33333d));
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, 0.55, 1.0);
      inner.add(snout);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.03, 1.1, 5), m);
      tail.position.set(0, 0.8, -1.7);
      tail.rotation.x = 1.1;
      inner.add(tail);
    }
    const legs = [];
    for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
      const hip = cLeg(m, 1.1, 0.06);
      hip.position.set(side * 0.5, 0.6, 0.6 - i * 0.42);
      inner.add(hip);
      legs.push({ hip, side, phase: (i % 2 ? Math.PI : 0) + (side < 0 ? 0 : Math.PI) });
    }
    anim = (dt, t, moving, c) => {
      c.legT += dt * (big ? 11 : 9);
      scuttleLegs(legs, c.legT, 1);
      if (c && c.pounceT > 0) inner.position.y = Math.sin((0.4 - c.pounceT) * 7.8) * 0.9;
      else inner.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.1 : 0;
    };
  } else if (key === "cricket") {
    const m = cMat(0x4a8a2a);
    const dm = cMat(0x2a5a1a);
    inner.add(cBall(0.55, m, 0, 0.6, 0, 1, 0.85, 1.5));
    inner.add(cBall(0.32, dm, 0, 0.65, 1.0));
    // عيون كبيرة + غطاءا جناحين على الظهر
    const eyeC = cMat(0x141414, { roughness: 0.2 });
    for (const sx of [-0.18, 0.18]) inner.add(cBall(0.11, eyeC, sx, 0.78, 1.2));
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 1.1), dm);
      wing.position.set(sx * 0.22, 1.0, -0.2);
      wing.rotation.y = sx * 0.12;
      inner.add(wing);
    }
    const hind = [];
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 1.1, 5), dm);
      thigh.position.set(side * 0.5, 0.8, -0.5);
      thigh.rotation.z = side * 0.9;
      thigh.rotation.x = -0.5;
      inner.add(thigh);
      hind.push(thigh);
      const hip = cLeg(dm, 0.8, 0.05);
      hip.position.set(side * 0.4, 0.5, 0.5);
      inner.add(hip);
    }
    anim = (dt, t, moving, c) => {
      if (moving) {
        c.hopT = (c.hopT || 0) + dt * 7;
        inner.position.y = Math.abs(Math.sin(c.hopT)) * 1.1;
      } else {
        inner.position.y *= 0.8;
        hind[0].rotation.x = -0.5 + Math.sin(t * 3) * 0.08;
      }
    };
  } else if (key === "termite") {
    // نمل أبيض: جسم كريمي مقسّم + رأس بني بفكوك — حشرة الشجرة العتيقة
    const cream = cMat(0xf2e6c8, { roughness: 0.85 });
    const headM = cMat(0x8a5a2a, { roughness: 0.8 });
    const segs = [];
    for (let i = 0; i < 4; i++) {
      const b = cBall(0.5 - i * 0.07, i === 3 ? headM : cream, 0, 0.5, 0.9 - i * 0.55, 1, 0.9, 1.15);
      inner.add(b); segs.push(b);
    }
    for (const side of [-1, 1]) {
      const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 5), headM);
      jaw.position.set(side * 0.22, 0.45, -0.95);
      jaw.rotation.x = -1.2;
      jaw.rotation.z = side * 0.35;
      inner.add(jaw);
      const eyeT = cMat(0x141414, { roughness: 0.2 });
      inner.add(cBall(0.08, eyeT, side * 0.14, 0.72, -0.85));
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 4), headM);
      ant.position.set(side * 0.16, 0.95, -0.75);
      ant.rotation.x = -0.5;
      ant.rotation.z = side * 0.4;
      inner.add(ant);
    }
    const legs = [];
    for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
      const hip = cLeg(cream, 0.85, 0.06);
      hip.position.set(side * 0.45, 0.45, 0.5 - i * 0.55);
      inner.add(hip);
      legs.push({ hip, side, phase: (i % 2 ? Math.PI : 0) + (side < 0 ? 0 : Math.PI) });
    }
    anim = (dt, t, moving, c) => {
      c.legT += dt * 8;
      scuttleLegs(legs, c.legT, 1);
      segs.forEach((b, i) => { b.scale.y = 0.9 + Math.sin(t * 7 - i * 0.9) * 0.18; });
      inner.position.y = Math.abs(Math.sin(t * 5)) * 0.05;
    };
  } else if (key === "centipede") {
    // أم 44 🪱: زعيم مدرّع طويل متعدد الأرجل — مطاردة العظام
    const armor = cMat(0xb34a1a, { roughness: 0.6 });
    const dark = cMat(0x5a2a0a, { roughness: 0.7 });
    const segs = [];
    for (let i = 0; i < 9; i++) {
      const b = cBall(0.5 - Math.abs(i - 2) * 0.03, i === 0 ? dark : armor, 0, 0.5, 2.2 - i * 0.55, 1, 0.85, 1.1);
      inner.add(b); segs.push(b);
    }
    // رأس بفكوك وعيون
    for (const side of [-1, 1]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 5), dark);
      fang.position.set(side * 0.25, 0.4, 2.9);
      fang.rotation.x = 1.9;
      fang.rotation.z = side * 0.3;
      inner.add(fang);
      inner.add(cBall(0.09, cMat(0x141414, { roughness: 0.2 }), side * 0.16, 0.72, 2.55));
      const feeler = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4), dark);
      feeler.position.set(side * 0.2, 0.95, 2.7);
      feeler.rotation.x = -0.9;
      feeler.rotation.z = side * 0.4;
      inner.add(feeler);
    }
    // أرجل كثيرة على الجانبين (الـ44)
    const legs = [];
    for (let i = 0; i < 9; i++) for (const side of [-1, 1]) {
      const hip = cLeg(dark, 0.8, 0.06);
      hip.position.set(side * 0.45, 0.4, 2.0 - i * 0.55);
      inner.add(hip);
      legs.push({ hip, side, phase: (i % 2 ? Math.PI : 0) + (side < 0 ? 0 : Math.PI) });
    }
    anim = (dt, t, moving, c) => {
      c.legT += dt * 9;
      scuttleLegs(legs, c.legT, 1);
      segs.forEach((b, i) => { b.scale.y = 0.85 + Math.sin(t * 8 - i * 0.8) * 0.2; });
      inner.position.y = Math.abs(Math.sin(t * 5)) * 0.06;
    };
  } else {
    // butterfly + monarch: أجنحة ترفرف وطيران
    const royal = key === "monarch";
    const wm = cMat(royal ? 0xff8c1a : 0x7db8ff, royal ? { emissive: 0x662200 } : {});
    wm.side = THREE.DoubleSide;
    const bm = cMat(0x2a2a2a);
    const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.7, 5), bm);
    bd.rotation.x = Math.PI / 2;
    bd.position.y = 0.1;
    inner.add(bd);
    const mkWing = (side) => {
      const pivot = new THREE.Group();
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.7), wm);
      w.rotation.x = -Math.PI / 2;
      w.position.x = side * 0.5;
      pivot.add(w);
      inner.add(pivot);
      return pivot;
    };
    const wl = mkWing(-1), wr = mkWing(1);
    // بقع زخرفية على الأجنحة
    const spotM = new THREE.MeshBasicMaterial({ color: royal ? 0xfff2cc : 0x1a3a6a, side: THREE.DoubleSide });
    for (const [piv, sx] of [[wl, -1], [wr, 1]]) {
      for (const [ox, oz, r] of [[0.35, 0.1, 0.14], [0.6, -0.15, 0.1]]) {
        const dot = new THREE.Mesh(new THREE.CircleGeometry(r, 8), spotM);
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(sx * ox, 0.01, oz);
        piv.add(dot);
      }
    }
    anim = (dt, t) => {
      const f = Math.sin(t * (royal ? 12 : 18)) * 0.9;
      wl.rotation.z = -0.25 - f;
      wr.rotation.z = 0.25 + f;
      inner.position.y = (sp.flyH || 4) + Math.sin(t * 2) * 0.4;
    };
  }
  g.scale.setScalar(s);
  return { group: g, inner, anim };
}
function pickWildSpecies() {
  const keys = Object.keys(CREATURE_SPECIES).filter((k) => !CREATURE_SPECIES[k].zone && !CREATURE_SPECIES[k].noWild);
  let total = 0;
  for (const k of keys) total += CREATURE_RARITY[CREATURE_SPECIES[k].rarity].w;
  let r = Math.random() * total;
  for (const k of keys) {
    r -= CREATURE_RARITY[CREATURE_SPECIES[k].rarity].w;
    if (r <= 0) return k;
  }
  return "grub";
}
function spawnCreature(forceKey, fx, fz) {
  const key = (forceKey && CREATURE_SPECIES[forceKey]) ? forceKey : pickWildSpecies();
  const sp = CREATURE_SPECIES[key];
  const built = buildCreatureMesh(key === "siege" ? "beetle" : key, sp);
  let p;
  if (fx !== undefined && fz !== undefined) p = { x: fx, z: fz };
  else if (sp.zone === "tree") p = treeRandPos();
  else p = randPos(8, WILD_KEEPOUT_R + 14); // بعيداً عن العش — لا زحام حوله
  built.group.position.set(p.x, 0, p.z);
  scene.add(built.group);
  const hb = addHpBar(built.group, 1.4 * sp.scale, 2.0 * sp.scale);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.25, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  ring.visible = false;
  built.group.add(ring);
  const c = {
    uid: nextUid(), isCreature: true, key, name: sp.name, icon: sp.icon,
    x: p.x, z: p.z, yaw: rand(0, 6.28), hp: sp.hp, maxHp: sp.hp, dmg: sp.dmg, spd: sp.spd,
    hostile: sp.hostile, flies: !!sp.flies, flyH: sp.flyH || 0, flees: !!sp.flees, def: sp.def || 0,
    treeLocked: sp.zone === "tree",
    siege: key === "siege",
    tx: p.x, tz: p.z, wanderT: 0, atkCd: 0, legT: rand(0, 9), hopT: 0, hitFlash: 0,
    pounceT: 0, attackT: 0, stunned: false, stunT: 0,
    group: built.group, inner: built.inner, anim: built.anim, hpBg: hb.bg, hpFg: hb.fg, hpW: hb.w,
    stunRing: ring, baseScale: sp.scale,
  };
  // 😌⚔️🔥 طور الصعوبة: وحوش البرية والزعماء تُولد بمقياس الطور
  if (c.hostile) { const D = diffDef(); c.hp = c.maxHp = Math.max(1, Math.round(c.hp * D.ehp)); c.dmg = Math.round(c.dmg * D.edmg); }
  game.creatures.push(c);
  if (sp.rarity === "rare") toast(`✨ مخلوق نادر ظهر: ${sp.icon} ${sp.name}!`);
  if (sp.rarity === "legendary") { centerMsg(`🐺 مخلوق أسطوري: ${sp.name}! اهزمه بسرعة!`); sfx.level(); }
  return c;
}
function removeCreature(c) {
  scene.remove(c.group);
  if (c.hpBg) scene.remove(c.hpBg);
  if (c.hpFg) scene.remove(c.hpFg);
  const i = game.creatures.indexOf(c);
  if (i >= 0) game.creatures.splice(i, 1);
}
function enemyAlive(e) {
  if (!e) return false;
  if (e.isMound) return !!e.alive;
  if (e.isCreature) return !e.stunned && game.creatures.includes(e);
  if (e.isColony) return e.alive && game.colonies.includes(e);
  if (e.kind === "enemy") return !e.dying && game.enemies.includes(e);
  return game.beetles.includes(e);
}
// ضرر موحد للأعداء مع الدرع وأرقام عائمة: مخلوق يُدوَّخ، مستعمر تُدمَّر، عدو يُقتل
function damageEnemy(e, dmg) {
  if (!e || e.hp === undefined) return;
  if (e.isCreature && e.stunned) return;
  if (e.isColony && !e.alive) return;
  if (e.isMound && !e.alive) return;
  if (e.kind === "enemy" && e.dying) return;
  const real = Math.max(1, Math.round(dmg - ((e.defV !== undefined ? e.defV : e.def) || 0)));
  e.hp -= real;
  e.hitFlash = 1;
  spawnDmgNum(e.x, e.isColony ? 8 : 1.6, e.z, real, "#ffd93d");
  spawnBurst(e.x, e.isColony ? 2.5 : 1, e.z, 0xff4444, e.isColony ? 14 : 8, e.isColony ? 5 : 2.5, 3);
  beep(e.isColony ? 120 : 220, 0.1, "square", 0.1);
  if (e.hp <= 0) {
    if (e.isCreature) stunCreature(e);
    else if (e.isColony) destroyColony(e);
    else if (e.isMound) destroyTermiteMound(e);
    else if (e.kind === "enemy") killEnemy(e);
    else killBeetle(e);
  } else if (e.isColony) {
    game.shake = Math.max(game.shake, 0.35);
  } else if (e.isMound) {
    game.shake = Math.max(game.shake, 0.3);
  }
}
function stunCreature(c) {
  if (c.stunned || !game.creatures.includes(c)) return;
  const sp = CREATURE_SPECIES[c.key];
  if (c.key === "centipede") { killCentipede(c); return; }
  if (c.key === "siege") { killSiege(c); return; }
  if (sp && sp.noCapture) { killTermite(c); return; }
  c.stunned = true;
  c.stunT = 30;
  c.hp = 0;
  c.stunRing.visible = true;
  game.stats.kills = (game.stats.kills || 0) + 1;
  addXP(2);
  spawnBurst(c.x, 1, c.z, 0xffd93d, 18, 3.5, 4);
  // جنودك يتوقفون عن ضربه وهو دائخ
  for (const s of game.soldiers) if (s.order && s.order.b === c) s.order = null;
  for (const a of game.allies) if (a.order && a.order.b === c) a.order = null;
  toast(`😵 ${c.icon} ${c.name} دائخ! انقره لأسره قبل أن يفيق (30 ث)`);
  sfx.hatch();
}
function tryCaptureTap(px, py) {
  const c = nearestStunnedAt(px, py, 44);
  if (!c) return false;
  captureCreature(c);
  return true;
}
function nearestStunnedAt(px, py, maxPx) {
  let best = null, bd = maxPx || 40;
  for (const c of game.creatures) {
    if (!c.stunned) continue;
    const p = worldToScreen(c.x, 1, c.z);
    if (!p) continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
// النمل الأبيض لا يُؤسر: يُقتل مباشرة ويُسقط كهرمان 🧡
function killTermite(c) {
  if (!game.creatures.includes(c)) return;
  removeCreature(c);
  const n = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    try { spawnFood(c.x + rand(-1.5, 1.5), c.z + rand(-1.5, 1.5), "amber"); } catch {}
  }
  game.store += 3;
  game.stats.kills = (game.stats.kills || 0) + 1;
  game.stats.termKills = (game.stats.termKills || 0) + 1;
  addXP(4);
  spawnBurst(c.x, 1, c.z, 0xff9f1a, 22, 4, 5);
  spawnDmgNum(c.x, 1.6, c.z, `+${n}🧡 +3🍯`, "#ff9f1a");
  for (const s of game.soldiers) if (s.order && s.order.b === c) s.order = null;
  for (const a of game.allies) if (a.order && a.order.b === c) a.order = null;
  toast(`🤍 قضيت على نملة أبيض! +${n}🧡`);
  sfx.die();
  saveGame();
  updateHUD();
}
// أم 44 🪱 لا تُؤسر: تُقتل و تُسقط عظاماً 🦴 (أكل + تطوير)
function killCentipede(c) {
  if (!game.creatures.includes(c)) return;
  removeCreature(c);
  const n = 2 + ((Math.random() * 2) | 0);
  for (let i = 0; i < n; i++) {
    try { spawnFood(c.x + rand(-2, 2), c.z + rand(-2, 2), "bone"); } catch {}
  }
  game.stats.kills = (game.stats.kills || 0) + 1;
  game.stats.centiKills = (game.stats.centiKills || 0) + 1;
  addXP(15);
  game.centiT = 240; // تعاود الظهور بعد 4 دقائق
  spawnBurst(c.x, 1, c.z, 0xe8e0d0, 30, 5, 6);
  spawnDmgNum(c.x, 1.8, c.z, `+${n}🦴`, "#ffffff");
  for (const s of game.soldiers) if (s.order && s.order.b === c) s.order = null;
  for (const a of game.allies) if (a.order && a.order.b === c) a.order = null;
  if (game.stats.centiKills <= 1) centerMsg("🦴 غنيمة العظام! اجمعها: أكل ومادة تطوير");
  toast(`🪱 قضيت على أم أربعة وأربعين! +${n}🦴 عظم`);
  sfx.die();
  saveGame();
  updateHUD();
}
// 🪲 انسحاب خنفساء الحصار: الحصار لا يدوم أبداً — تنسحب فتُكسر حلقة الخنق
function siegeRetreat(c, why) {
  if (!c || !game.creatures.includes(c)) return;
  removeCreature(c);
  game.siegeT = 360; // تعاود بعد 6 دقائق
  for (const s of game.soldiers) if (s.order && s.order.b === c) s.order = null;
  for (const a of game.allies) if (a.order && a.order.b === c) a.order = null;
  if (why === "full") centerMsg("🪲 شبعت خنفساء الحصار وانسحبت! ستعود بعد 6 دقائق — استعد لها");
  else centerMsg("🪲 انسحبت خنفساء الحصار بعد حصار طويل! ستعود — جهّز جيشك والرماة");
  toast("انكسر الحصار! اجمع طعاما وفقس جنودا بسرعة");
  sfx.hatch();
  saveGame();
  updateHUD();
}
// 🪲 خنفساء الحصار: زعيم حصار يقصد العش — تُقتل وتُسقط غنيمة حرب كبرى
function killSiege(c) {
  if (!game.creatures.includes(c)) return;
  removeCreature(c);
  for (let i = 0; i < 3; i++) {
    try { spawnFood(c.x + rand(-2, 2), c.z + rand(-2, 2), "bone"); } catch {}
  }
  for (let i = 0; i < 2; i++) {
    try { spawnFood(c.x + rand(-2, 2), c.z + rand(-2, 2), "amber"); } catch {}
  }
  for (let i = 0; i < 4; i++) {
    try { spawnFood(c.x + rand(-2.5, 2.5), c.z + rand(-2.5, 2.5)); } catch {}
  }
  game.store = Math.min(storeCap(), game.store + 50);
  game.stats.kills = (game.stats.kills || 0) + 1;
  game.stats.siegeKills = (game.stats.siegeKills || 0) + 1;
  addXP(40);
  game.siegeT = 360; // تعاود الظهور بعد 6 دقائق
  spawnBurst(c.x, 1, c.z, 0xe8e0d0, 40, 6, 7);
  spawnDmgNum(c.x, 1.8, c.z, "+3🦴 +2🧡 +50🍯", "#ffd93d");
  for (const s of game.soldiers) if (s.order && s.order.b === c) s.order = null;
  for (const a of game.allies) if (a.order && a.order.b === c) a.order = null;
  centerMsg("💥 سُحقت خنفساء الحصار! العش بأمان... مؤقتاً");
  sfx.die();
  saveGame();
  updateHUD();
}
// الأسر: ينضم لمجموعة اللاعب + مكافأة 🍯 حسب النوع
function captureCreature(c) {
  if (!c.stunned || !game.creatures.includes(c)) return;
  const entry = { uid: nextUid(), key: c.key, level: 1, state: "stored", revives: 3 };
  game.collection.push(entry);
  const reward = CREATURE_SPECIES[c.key].reward || 2;
  game.store += reward;
  game.stats.captures = (game.stats.captures || 0) + 1;
  addXP(5);
  removeCreature(c);
  toast(`🐾 أسرت ${c.icon} ${c.name}! +${reward} 🍯 (مجموعتك: ${game.collection.length})`);
  sfx.capture();
  saveGame();
  updateHUD();
  if (!els.beastPanel.hidden) renderBeastPanel();
}
// ---------- حلفاء المجموعة: إطلاق واستدعاء وترقية ----------
// الدبابات: الخنفساء ورفاقها الأقوياء يتحملون أكثر (صحة × ودفاع 🛡️ وحمل 🎒)
const ALLY_TANK = {
  grub: { hpK: 1.2, def: 1, carry: 2 },
  beetle: { hpK: 1.6, def: 3, carry: 3 },
  cricket: { hpK: 1.1, def: 0, carry: 2 },
  spider: { hpK: 1.3, def: 2, carry: 2 },
  butterfly: { hpK: 1.0, def: 0, carry: 1 },
  rhino: { hpK: 1.7, def: 4, carry: 4 },
  monarch: { hpK: 1.1, def: 0, carry: 1 },
  wolf: { hpK: 1.5, def: 2, carry: 2 },
  termite: { hpK: 1.2, def: 1, carry: 2 },
};
function allyTankOf(key) { return ALLY_TANK[key] || { hpK: 1, def: 0, carry: 1 }; }
function beastStats(entry) {
  const sp = CREATURE_SPECIES[entry.key];
  const tk = allyTankOf(entry.key);
  const k = 1 + 0.45 * (entry.level - 1);
  return { maxHp: Math.round(sp.hp * k * tk.hpK), dmg: Math.round(sp.dmg * (1 + 0.35 * (entry.level - 1))), spd: sp.spd, def: tk.def, carry: tk.carry };
}
function beastUpgradeCost(entry) { return 5 * entry.level; }
function deployedCount() { return game.collection.filter((e) => e.state === "deployed").length; }
function spawnAlly(entry) {
  const sp = CREATURE_SPECIES[entry.key];
  const st = beastStats(entry);
  const built = buildCreatureMesh(entry.key, sp);
  const sc = sp.scale * (1 + 0.08 * (entry.level - 1));
  built.group.scale.setScalar(sc);
  const P = game.player;
  const a = Math.random() * Math.PI * 2;
  const x = THREE.MathUtils.clamp(P.x + Math.cos(a) * 3, -TUNE.worldHalf, TUNE.worldHalf);
  const z = THREE.MathUtils.clamp(P.z + Math.sin(a) * 3, -TUNE.worldHalf, TUNE.worldHalf);
  built.group.position.set(x, 0, z);
  scene.add(built.group);
  const hb = addHpBar(built.group, 1.4 * sc, 2.0 * sc);
  if (sp.rarity === "rare" || sp.rarity === "legendary") {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.18, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.06;
    built.group.add(halo);
  }
  const ally = {
    uid: nextUid(), kind: "ally", ally: true, isCreature: false, entryUid: entry.uid,
    key: entry.key, name: sp.name, icon: sp.icon, level: entry.level,
    x, z, yaw: rand(0, 6.28), hp: st.maxHp, maxHp: st.maxHp, dmg: st.dmg, spd: st.spd,
    flies: !!sp.flies, flyH: sp.flyH || 0, flees: false, hostile: false,
    order: null, atkCd: 0, legT: rand(0, 9), hopT: 0, hitFlash: 0, pounceT: 0, attackT: 0,
    ant: { group: built.group, update: () => {} },
    group: built.group, inner: built.inner, anim: built.anim,
    hpBg: hb.bg, hpFg: hb.fg, hpW: hb.w, selRing: null, baseScale: sc, vx: 0, vz: 0,
    emergeT: 1, carried: [],
  };
  ally.base = { dmg: st.dmg, def: st.def, spd: sp.spd, maxHp: st.maxHp, scale: sc };
  // سلّة حمل فوق الظهر (تُستخدم مع setCarryVisual عبر محوّل بسيط)
  try {
    const slot = new THREE.Group();
    slot.position.set(0, (sp.flies ? (sp.flyH || 4) * 0.4 : 1.7) * sc, 0);
    built.group.add(slot);
    ally.carrySlot = slot;
    ally.ant.carrySlot = slot;
  } catch {}
  ally.gene = null; ally.mods = [];
  refreshUnitStats(ally);
  entry.state = "deployed";
  game.allies.push(ally);
  spawnBurst(x, 1, z, 0x51ff5e, 14, 3, 4);
  return ally;
}
function removeAllyEntity(a) {
  armyDesel(a);
  disposeGuardRing(a);
  scene.remove(a.group);
  if (a.hpBg) scene.remove(a.hpBg);
  if (a.hpFg) scene.remove(a.hpFg);
  const i = game.allies.indexOf(a);
  if (i >= 0) game.allies.splice(i, 1);
}
function killAlly(a) {
  spawnBurst(a.x, 1, a.z, 0xff4444, 22, 4, 5);
  sfx.hit();
  const ei = game.collection.findIndex((e) => e.uid === a.entryUid);
  if (ei >= 0) {
    const e = game.collection[ei];
    if ((e.revives | 0) > 0) {
      // إحياء ممكن: يبقى في المجموعة كقتيل قابل للإحياء (3 مرات كحد أقصى منذ الأسر)
      e.revives -= 1;
      e.state = "dead";
      toast(`💀 سقط حليفك ${a.icon} ${a.name}! أحيِه من المجموعة 🐾 (متبقي ${e.revives} إحياء)`);
    } else {
      game.collection.splice(ei, 1);
      toast(`💀 مات حليفك ${a.icon} ${a.name} نهائياً (نفدت محاولات الإحياء)!`);
    }
  }
  removeAllyEntity(a);
  saveGame();
  updateHUD();
  if (!els.beastPanel.hidden) renderBeastPanel();
}
// إحياء الحليف القتيل: يعود بنفس المستوى والجينات، وتكلفة عسل تزيد مع المستوى
function reviveCostFor(e) { return 8 + 4 * (e.level || 1); }
function reviveBeast(uid) {
  const e = game.collection.find((x) => x.uid === uid);
  if (!e || e.state !== "dead") return false;
  if (deployedCount() >= CREATURE_DEPLOY_CAP) { toast(`🐾 الحد الأقصى ${CREATURE_DEPLOY_CAP} حلفاء — استدعِ واحداً أولاً`); return false; }
  const cost = reviveCostFor(e);
  if (game.store < cost) { toast(`🍯 الإحياء يحتاج ${cost} (معك ${Math.floor(game.store)})`); return false; }
  game.store -= cost;
  spawnAlly(e);
  toast(`❤️‍🩹 عاد ${CREATURE_SPECIES[e.key].icon} ${CREATURE_SPECIES[e.key].name} للحياة! (متبقي ${e.revives | 0} إحياء)`);
  sfx.level();
  saveGame();
  updateHUD();
  renderBeastPanel();
  return true;
}
function deployBeast(uid) {
  const e = game.collection.find((x) => x.uid === uid);
  if (!e) return;
  if (e.state === "dead") { toast("💀 هذا الحليف قتيل — أحيِه بزر الإحياء ❤️‍🩹"); return; }
  if (e.state === "deployed") {
    const a = game.allies.find((x) => x.entryUid === uid);
    if (a) removeAllyEntity(a);
    e.state = "stored";
    toast(`🐾 ${CREATURE_SPECIES[e.key].icon} عاد إلى المجموعة`);
  } else {
    if (deployedCount() >= CREATURE_DEPLOY_CAP) { toast(`🐾 الحد الأقصى ${CREATURE_DEPLOY_CAP} حلفاء — استدعِ واحداً أولاً`); return; }
    spawnAlly(e);
    toast(`🐾 ${CREATURE_SPECIES[e.key].icon} ${CREATURE_SPECIES[e.key].name} يقاتل معك الآن!`);
    beep(700, 0.1, "sine", 0.1);
  }
  saveGame();
  renderBeastPanel();
}
function upgradeBeast(uid) {
  const e = game.collection.find((x) => x.uid === uid);
  if (!e || e.level >= CREATURE_MAX_LEVEL) return;
  const cost = beastUpgradeCost(e);
  if (game.store < cost) { toast(`🍯 تحتاج ${cost} للترقية`); return; }
  game.store -= cost;
  e.level += 1;
  game.stats.upgrades = (game.stats.upgrades || 0) + 1;
  const st = beastStats(e);
  const a = game.allies.find((x) => x.entryUid === uid);
  if (a) {
    a.level = e.level;
    a.base = { dmg: st.dmg, def: st.def, spd: CREATURE_SPECIES[e.key].spd, maxHp: st.maxHp, scale: CREATURE_SPECIES[e.key].scale * (1 + 0.08 * (e.level - 1)) };
    refreshUnitStats(a);
    a.group.scale.setScalar(a.baseScale);
    spawnBurst(a.x, 1, a.z, 0xffd93d, 16, 3, 4);
  }
  toast(`⬆️ ${CREATURE_SPECIES[e.key].icon} وصل للمستوى ${e.level}! ❤️${st.maxHp} ⚔️${st.dmg}`);
  sfx.level();
  saveGame();
  updateHUD();
  renderBeastPanel();
}
function restoreCollection(saved) {
  game.collection = [];
  if (!Array.isArray(saved)) return;
  let deployed = 0;
  for (const s of saved) {
    if (!s || !CREATURE_SPECIES[s.key]) continue;
    const level = Math.max(1, Math.min(CREATURE_MAX_LEVEL, Number(s.level) || 1));
    const entry = { uid: nextUid(), key: s.key, level, state: "stored", revives: Math.max(0, Math.min(3, s.revives == null ? 3 : Number(s.revives) || 0)) };
    if (s.state === "dead") entry.state = "dead"; // قتيل قابل للإحياء — لا يُنشر تلقائياً
    game.collection.push(entry);
    if (s.state === "deployed" && entry.state !== "dead" && deployed < CREATURE_DEPLOY_CAP && game.player) {
      spawnAlly(entry);
      deployed++;
    }
  }
}
// ---------- لوحة المجموعة ----------
function renderBeastPanel() {
  const list = els.beastList;
  list.innerHTML = "";
  els.beastCount.textContent = game.collection.length
    ? `لديك ${game.collection.length} مخلوقات — رقِّها وأطلقها للقتال معك (بحد أقصى ${CREATURE_DEPLOY_CAP} حلفاء)`
    : "لا مخلوقات بعد — اهزم مخلوقاً برياً بجنودك ثم انقر الدائخ 😵 لأسره!";
  const order = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
  const items = [...game.collection].sort((x, y) => {
    if ((x.state === "deployed") !== (y.state === "deployed")) return x.state === "deployed" ? -1 : 1;
    if ((x.state === "dead") !== (y.state === "dead")) return x.state === "dead" ? 1 : -1;
    return (order[CREATURE_SPECIES[x.key].rarity] || 9) - (order[CREATURE_SPECIES[y.key].rarity] || 9);
  });
  for (const e of items) {
    const sp = CREATURE_SPECIES[e.key];
    const rar = CREATURE_RARITY[sp.rarity];
    const st = beastStats(e);
    const cost = beastUpgradeCost(e);
    const maxed = e.level >= CREATURE_MAX_LEVEL;
    const isDead = e.state === "dead";
    const dep = (!isDead && e.state === "deployed") ? game.allies.find((x) => x.entryUid === e.uid) : null;
    const hpTxt = dep ? `${Math.ceil(dep.hp)}/` : "";
    const card = document.createElement("div");
    card.className = "beastCard" + (e.state === "deployed" ? " deployed" : "") + (isDead ? " dead" : "");
    card.innerHTML = `<div class="beastIco">${isDead ? "💀" : sp.icon}</div>` +
      `<div class="beastInfo"><div class="beastName">${sp.name} <span class="beastRar" style="background:${rar.color}">${rar.name}</span> <span>LV${e.level}</span>${isDead ? ' <span class="beastRar" style="background:#555">قتيل</span>' : ""}</div>` +
      `<div class="beastStats">❤️ ${hpTxt}${st.maxHp} &nbsp;⚔️ ${st.dmg} &nbsp;🛡️ ${st.def} &nbsp;🎒 ${st.carry}${isDead ? ` &nbsp;❤️‍🩹 إحياء متبقٍ: ${e.revives | 0}` : ""}</div>` +
      `<div class="beastBtns"></div></div>`;
    const btns = card.querySelector(".beastBtns");
    if (isDead) {
      const rv = document.createElement("button");
      rv.className = "beastUp";
      const rc = reviveCostFor(e);
      rv.textContent = (e.revives | 0) > 0 ? `❤️‍🩹 إحياء (${rc} 🍯)` : "نفد الإحياء";
      rv.disabled = (e.revives | 0) <= 0 || game.store < rc;
      rv.onclick = () => reviveBeast(e.uid);
      btns.appendChild(rv);
      list.appendChild(card);
      continue;
    }
    const up = document.createElement("button");
    up.className = "beastUp";
    up.textContent = maxed ? "MAX" : `⬆️ ترقية (${cost} 🍯)`;
    up.disabled = maxed || game.store < cost;
    up.onclick = () => upgradeBeast(e.uid);
    const go = document.createElement("button");
    go.className = "beastGo";
    go.textContent = e.state === "deployed" ? "📥 استدعاء" : "🚀 إطلاق";
    go.onclick = () => deployBeast(e.uid);
    btns.appendChild(up);
    btns.appendChild(go);
    list.appendChild(card);
  }
}
// أقرب عدو (خنفساء أو مخلوق عدائي أو وحدة/مستعمرة معادية) لنقطة — يستخدمه الجنود والحلفاء
function nearestEnemy(x, z, r) {
  let be = null, bd = r;
  for (const b of game.beetles) {
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bd) { bd = d; be = b; }
  }
  for (const c of game.creatures) {
    if (!c.hostile || c.stunned) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; be = c; }
  }
  for (const e of game.enemies) {
    if (e.dying) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < bd) { bd = d; be = e; }
  }
  for (const col of game.colonies) {
    if (!col.alive) continue;
    // المستعمر هدف كبير: المسافة من حافته
    const d = Math.max(0, Math.hypot(col.x - x, col.z - z) - 4.5);
    if (d < bd) { bd = d; be = col; }
  }
  // تل النمل الأبيض: هدف كبير قابل للتدمير
  {
    const mo = game.termiteMound;
    if (mo && mo.alive) {
      const d = Math.max(0, Math.hypot(mo.x - x, mo.z - z) - 4.2);
      if (d < bd) { bd = d; be = mo; }
    }
  }
  return be ? { e: be, d: bd } : null;
}
// درع الولاء: الحلفاء يتلقون نصف الضرر فقط — والدبابات تمتص بدرعها 🛡️
function hurtAlly(a, dmg, from) {
  if (!a || a.inClinic || a.inTraining) return;
  a.hp -= Math.max(1, Math.round(dmg * 0.5 - (a.def || 0)));
  spawnBurst(a.x, 1, a.z, 0xffaa00, 6, 2, 2);
  beep(150, 0.1, "square", 0.1);
  if (a.hp <= 0) killAlly(a);
}
// ---------- محاكاة المخلوقات والحلفاء ----------
function updateCreatures(dt, t) {
  const P = game.player;
  // --- البرية ---
  for (const c of [...game.creatures]) {
    c.atkCd -= dt;
    if (c.attackT > 0) c.attackT -= dt;
    if (c.pounceT > 0) c.pounceT -= dt;
    const bgy = groundY(c.x, c.z);
    if (c.stunned) {
      // دائخ: يتمايل وحلقة ذهبية نابضة
      c.stunT -= dt;
      c.group.rotation.z = Math.sin(t * 3) * 0.15;
      c.stunRing.material.opacity = 0.55 + Math.sin(t * 2) * 0.15;
      const yy = c.flies ? bgy + c.flyH * 0.4 : bgy;
      c.group.position.set(c.x, yy, c.z);
      c.anim(dt, t, false, c);
      showCreatureHp(c, bgy, true);
      if (c.stunT <= 0) {
        c.stunned = false;
        c.hp = Math.round(c.maxHp * 0.5);
        c.stunRing.visible = false;
        c.group.rotation.z = 0;
        // يهرب بعيداً بعد الإفاقة — خارج منطقة الحياة البرية عن العش
        const a = Math.atan2(c.x - P.x, c.z - P.z) + rand(-0.5, 0.5);
        c.tx = THREE.MathUtils.clamp(c.x + Math.sin(a) * 25, -TUNE.worldHalf, TUNE.worldHalf);
        c.tz = THREE.MathUtils.clamp(c.z + Math.cos(a) * 25, -TUNE.worldHalf, TUNE.worldHalf);
        if (Math.hypot(c.tx - nestPos.x, c.tz - nestPos.z) < WILD_KEEPOUT_R + 8) {
          const p2 = randPos(6, WILD_KEEPOUT_R + 8);
          c.tx = p2.x; c.tz = p2.z;
        }
        toast(`💨 ${c.icon} ${c.name} أفاق وهرب!`);
      }
      continue;
    }
    // 🪲 خنفساء الحصار: تزحف نحو العش مباشرة، تسحق المدافعين وتدك المخزن
    if (c.siege && !c.stunned) {
      // ⏳ كسر الحصار: تنسحب بعد 150ث أو بعدما تشبع (30🍯) — لا خنق أبدي
      c.siegeT = (c.siegeT == null ? 150 : c.siegeT) - dt;
      if (c.siegeT <= 0 || (c.stolen || 0) >= 30) { siegeRetreat(c, (c.stolen || 0) >= 30 ? "full" : "time"); continue; }
      const dnHole = Math.hypot(HOLE.x - c.x, HOLE.z - c.z);
      let tgt = null, td = 3.4;
      for (const s of game.soldiers) {
        if (s.dying || s.inClinic || s.inTraining) continue;
        const d = Math.hypot(s.x - c.x, s.z - c.z);
        if (d < td) { td = d; tgt = s; }
      }
      for (const a of game.allies) {
        const d = Math.hypot(a.x - c.x, a.z - c.z);
        if (d < td) { td = d; tgt = a; }
      }
      for (const w of [...game.workers, ...game.scouts]) {
        if (w.state === "inside" || w.state === "leaving" || (w.hp || 0) <= 0) continue;
        const d = Math.hypot(w.x - c.x, w.z - c.z);
        if (d < td) { td = d; tgt = w; }
      }
      let smvx = 0, smvz = 0, smoving = false;
      if (tgt) {
        if (td < 2.2) {
          if (c.atkCd <= 0) {
            c.atkCd = 1.2;
            c.attackT = 0.4; c.pounceT = 0.4;
            hurtUnit(tgt, c.dmg, c);
          }
        } else {
          const k = Math.max(0.4, td);
          smvx = ((tgt.x - c.x) / k) * c.spd; smvz = ((tgt.z - c.z) / k) * c.spd;
          smoving = true;
        }
      } else if (dnHole > 5) {
        smvx = ((HOLE.x - c.x) / dnHole) * c.spd; smvz = ((HOLE.z - c.z) / dnHole) * c.spd;
        smoving = true;
      }
      // دكّ العش: تسرق من المخزن كل ثانيتين وهي ملاصقة له
      c.ramT = (c.ramT || 0) - dt;
      if (dnHole < 7) {
        // 🛡️ بلا جنود أحياء: استنفار العمال + تلميح لمرة واحدة
        try {
          if (!game.soldiers.some((s) => !s.dying)) {
            game.militiaT = Math.max(game.militiaT || 0, 20);
            if (!c._militiaTip) { c._militiaTip = true; toast("🛡️ لا جنود أحياء! عمالك يدافعون — افقس جنوداً من ☰"); }
          }
        } catch {}
      }
      if (dnHole < 7 && c.ramT <= 0) {
        c.ramT = 2;
        const loot = Math.min(game.store, 2);
        game.store -= loot;
        c.stolen = (c.stolen || 0) + loot;
        game.shake = Math.max(game.shake, 1);
        spawnBurst(HOLE.x, 2, HOLE.z, 0xff5533, 22, 5, 6);
        spawnDmgNum(HOLE.x, 2.5, HOLE.z, `−${loot}🍯`, "#ff5d5d");
        toast("🪲 خنفساء الحصار تدك عشك! أوقفها قبل أن تفرغ المخزن!");
        sfx.hit();
        updateHUD();
      }
      c.x += smvx * dt; c.z += smvz * dt;
      collideAndClamp(c, 1.6);
      if (smoving) c.yaw = angleLerp(c.yaw, Math.atan2(smvx, smvz), 1 - Math.exp(-dt * 6));
      c.group.position.set(c.x, bgy, c.z);
      c.group.rotation.y = c.yaw;
      c.anim(dt, t, smoving, c);
      if (c.hitFlash > 0) {
        c.hitFlash = Math.max(0, c.hitFlash - dt * 5);
        c.group.position.x += rand(-1, 1) * c.hitFlash * 0.15;
      }
      showCreatureHp(c, bgy, true);
      continue;
    }
    let mvx = 0, mvz = 0, moving = false;
    const dp = Math.hypot(P.x - c.x, P.z - c.z);
    const dn = Math.hypot(c.x - nestPos.x, c.z - nestPos.z);
    const playerSafe = Math.hypot(P.x - nestPos.x, P.z - nestPos.z) < NEST_R + 2.5;
    if (c.hostile) {
      // 😴 تخدير الزعماء بالشوك: إبطاء الحركة وإضعاف الضرب (حتى 3 طبقات × 25%)
      let weakK = 1;
      if (c.key === "centipede" || c.key === "siege") {
        if (c.weakT > 0) { c.weakT -= dt; weakK = Math.pow(0.75, c.weakN || 1); if (c.weakT <= 0) c.weakN = 0; }
      }
      // أقرب هدف: اللاعب أو جندي أو حليف
      let tgt = null, td = 11;
      if (!playerSafe && !game.underground && dp < td) { tgt = P; td = dp; }
      for (const s of game.soldiers) {
        if (s.dying) continue;
        const d = Math.hypot(s.x - c.x, s.z - c.z);
        if (d < td) { td = d; tgt = s; }
      }
      for (const a of game.allies) {
        const d = Math.hypot(a.x - c.x, a.z - c.z);
        if (d < td) { td = d; tgt = a; }
      }
      if (tgt && dn > WILD_KEEPOUT_R) {
        if (td < 2) {
          if (c.atkCd <= 0) {
            c.atkCd = 1.1;
            c.attackT = 0.4; c.pounceT = 0.4;
            if (tgt === P) hurtPlayer(c.dmg * weakK, c.x, c.z);
            else if (tgt.kind === "soldier") hitSoldier(tgt, c.dmg * weakK, c);
            else hurtAlly(tgt, c.dmg * weakK, c);
          }
        } else {
          const k = Math.max(0.4, td);
          mvx = ((tgt.x - c.x) / k) * c.spd * weakK; mvz = ((tgt.z - c.z) / k) * c.spd * weakK;
          moving = true;
        }
      } else {
        // مقيّد قرب العش (لا هدف مشروع): ابتعد عنه بدل التسكع حوله
        if (dn < WILD_KEEPOUT_R + 10 && dn > 0.01) {
          const a = Math.atan2(c.x - nestPos.x, c.z - nestPos.z) + rand(-0.4, 0.4);
          c.tx = THREE.MathUtils.clamp(c.x + Math.sin(a) * 22, -TUNE.worldHalf, TUNE.worldHalf);
          c.tz = THREE.MathUtils.clamp(c.z + Math.cos(a) * 22, -TUNE.worldHalf, TUNE.worldHalf);
        }
        const w = wanderMove(c, dt);
        mvx = w.mx; mvz = w.mz; moving = w.moving;
      }
    } else if (c.flees) {
      // جبان: يهرب من أقرب نملة/لاعب
      let fd = 7, fx = 0, fz = 0;
      const all = [P, ...game.workers, ...game.soldiers, ...game.scouts, ...game.allies];
      for (const u of all) {
        if (u.kind === "soldier" && u.dying) continue;
    if (u.inTraining) continue;
        const d = Math.hypot(u.x - c.x, u.z - c.z);
        if (d < fd) { fd = d; fx = c.x - u.x; fz = c.z - u.z; }
      }
      if (fd < 7) {
        const k = Math.max(0.4, fd);
        mvx = (fx / k) * c.spd * 1.25; mvz = (fz / k) * c.spd * 1.25;
        moving = true;
      } else {
        const w = wanderMove(c, dt);
        mvx = w.mx; mvz = w.mz; moving = w.moving;
      }
    } else {
      // اليرقة: زحف بطيء عشوائي
      const w = wanderMove(c, dt, 0.5);
      mvx = w.mx; mvz = w.mz; moving = w.moving;
    }
    // إبعاد الحياة البرية عن العش: دفع قوي للخارج — فقط الغارات تقترب
    {
      const ndn = Math.hypot(c.x - nestPos.x, c.z - nestPos.z);
      if (ndn < WILD_KEEPOUT_R + 6 && ndn > 0.01) {
        const ox = (c.x - nestPos.x) / ndn, oz = (c.z - nestPos.z) / ndn;
        if (ndn < WILD_KEEPOUT_R) { mvx = ox * Math.max(c.spd, 7.5); mvz = oz * Math.max(c.spd, 7.5); moving = true; }
        else { mvx += ox * c.spd * 1.2; mvz += oz * c.spd * 1.2; const l = Math.hypot(mvx, mvz) || 1; const sp0 = Math.max(c.spd, 3); mvx = (mvx / l) * sp0; mvz = (mvz / l) * sp0; moving = true; }
      }
    }
    c.x += mvx * dt; c.z += mvz * dt;
    collideAndClamp(c, 0.8);
    if (moving) c.yaw = angleLerp(c.yaw, Math.atan2(mvx, mvz), 1 - Math.exp(-dt * 6));
    c.group.position.set(c.x, bgy, c.z);
    c.group.rotation.y = c.yaw;
    c.anim(dt, t, moving, c);
    if (c.hitFlash > 0) {
      c.hitFlash = Math.max(0, c.hitFlash - dt * 5);
      c.group.position.x += rand(-1, 1) * c.hitFlash * 0.15;
    }
    showCreatureHp(c, bgy, false);
  }
  // تجديد البرية للحفاظ على التنوع
  if (game.creatures.length < (TUNE.creatureCount || 7)) {
    game.creatureRespawnT -= dt;
    if (game.creatureRespawnT <= 0) {
      game.creatureRespawnT = 15;
      spawnCreature();
    }
  }
  // --- الحلفاء: يتبعون اللاعب ويقاتلون تلقائياً + أوامر الجيش ---
  for (const a of [...game.allies]) {
    a.atkCd -= dt;
    if (a.inClinic || a.inTraining) { hideGuardRing(a); continue; }
    if (a.gene && a.gene.regen && a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + a.gene.regen * dt);
    if (a.attackT > 0) a.attackT -= dt;
    if (a.pounceT > 0) a.pounceT -= dt;
    const bgy = groundY(a.x, a.z);
    let mvx = 0, mvz = 0, moving = false;
    if (a.order && a.order.t === "attack" && !enemyAlive(a.order.b)) a.order = { t: "guard", x: a.x, z: a.z, r: GUARD_R };
    const atkT = (a.order && a.order.t === "attack") ? a.order.b : null;
    const aggro = (a.order && a.order.t === "hold") ? 3 : (a.order && a.order.t === "guard") ? ((a.order.r || GUARD_R) + 2) : 10;
    let ne = atkT ? { e: atkT, d: Math.hypot(atkT.x - a.x, atkT.z - a.z) } : nearestEnemy(a.x, a.z, aggro);
    restHeal(a, dt, false, !ne); // مرافقة بلا قتال قريب: راحة وعلاج بطيء 🍃
    if (ne && ne.d < 2) {
      if (a.atkCd <= 0) {
        a.atkCd = 0.9;
        a.attackT = 0.4; a.pounceT = 0.4;
        // 🪲 الدعسوقة دبابة أم 44: ضرر +50% عليها
        const adb = (a.key === "beetle" && ne.e.key === "centipede") ? (a.dmg || 5) * 1.5 : (a.dmg || 5);
        if (a.key === "beetle" && ne.e.key === "centipede" && !game._centiTankTip) { game._centiTankTip = true; toast("🪲 الدعسوقة تتقدم وتمتص ضربات أم 44!"); }
        damageEnemy(ne.e, adb);
        if (a.gene && a.gene.venom && !ne.e.isColony && !ne.e.isMound) applyPoison(ne.e, a.gene.venom, 3);
      }
    } else if (ne && !(a.order && a.order.t === "hold") && guardChaseOk(a, ne.e)) {
      const k = Math.max(0.4, ne.d);
      mvx = ((ne.e.x - a.x) / k) * a.spd; mvz = ((ne.e.z - a.z) / k) * a.spd;
      moving = true;
    } else {
      const o = a.order;
      if (o && o.t === "move") {
        const d = Math.hypot(o.x - a.x, o.z - a.z);
        if (d < 1.3) a.order = null;
        else {
          const k = Math.min(1, d / 3);
          mvx = ((o.x - a.x) / d) * a.spd * k; mvz = ((o.z - a.z) / d) * a.spd * k;
          moving = true;
        }
      } else if (o && o.t === "guard") {
        // ثبات ميداني: عودة للموقع — والقتال فقط داخل النطاق (يُحسم عند المطاردة أعلاه)
        const d = Math.hypot(o.x - a.x, o.z - a.z);
        if (d > 1.5) {
          const k = Math.min(1, d / 3);
          mvx = ((o.x - a.x) / d) * a.spd * k; mvz = ((o.z - a.z) / d) * a.spd * k;
          moving = true;
        }
      } else if (!o || o.t === "follow") {
        // 🎒 جمع الحلفاء: طعام قريب ← حمل على الظهر ← إيداع في العش (الدبابات تحمل أكثر)
        let didHaul = false;
        try {
          const apCap = allyTankOf(a.key).carry || 1;
          a.carried = a.carried || [];
          const dHole = Math.hypot(a.x - HOLE.x, a.z - HOLE.z);
          if (!game.underground) {
            if (a.carried.length && dHole < 4.5) {
              const n = a.carried.length;
              a.carried = [];
              try { setCarryVisual(a.ant, a.carried); } catch {}
              game.store += n; game.stats.food = (game.stats.food || 0) + n;
              spawnBurst(HOLE.x, 1, HOLE.z, 0xe8c33a, 8, 2, 3);
              updateHUD();
            } else if (a.carried.length >= apCap && dHole >= 4.5) {
              const k = Math.max(0.5, dHole);
              mvx = ((HOLE.x - a.x) / k) * a.spd; mvz = ((HOLE.z - a.z) / k) * a.spd;
              moving = true; didHaul = true;
            } else if (a.carried.length < apCap) {
              let bf = null, bd = 4.5;
              for (const f of game.foods) {
                const d = Math.hypot(f.x - a.x, f.z - a.z);
                if (d < bd) { bd = d; bf = f; }
              }
              if (bf) {
                if (bd < 1.4) {
                  a.carried.push(bf.kind);
                  removeFood(bf);
                  try { setCarryVisual(a.ant, a.carried); } catch {}
                  spawnBurst(a.x, 1, a.z, 0xe8c33a, 4, 1.2, 2);
                } else {
                  const k = Math.max(0.4, bd);
                  mvx = ((bf.x - a.x) / k) * a.spd; mvz = ((bf.z - a.z) / k) * a.spd;
                  moving = true;
                }
                didHaul = true;
              }
            }
          }
        } catch {}
        if (!didHaul) {
        const idx = Math.max(0, game.allies.indexOf(a));
        const fa = (idx / Math.max(1, game.allies.length)) * Math.PI * 2;
        const ax2 = P.x + Math.sin(fa) * 3.2, az2 = P.z + Math.cos(fa) * 3.2;
        const d = Math.hypot(ax2 - a.x, az2 - a.z);
        if (d > 1.6) {
          const k = Math.min(1, d / 3);
          mvx = ((ax2 - a.x) / d) * a.spd * k; mvz = ((az2 - a.z) / d) * a.spd * k;
          moving = true;
        }
        }
      }
      // hold: ثبات تام
    }
    const sk = 1 - Math.exp(-dt * 6);
    a.vx += (mvx - a.vx) * sk;
    a.vz += (mvz - a.vz) * sk;
    a.x += a.vx * dt; a.z += a.vz * dt;
    collideAndClamp(a, 0.7);
    const asp = Math.hypot(a.vx, a.vz);
    if (asp > 0.4) a.yaw = angleLerp(a.yaw, Math.atan2(a.vx, a.vz), 1 - Math.exp(-dt * 8));
    a.group.position.set(a.x, bgy, a.z);
    a.group.rotation.y = a.yaw;
    a.anim(dt, t, asp > 0.5, a);
    if (!a.inClinic && !a.inTraining && a.order && a.order.t === "guard") guardRing(a, a.order.x, a.order.z, a.order.r || GUARD_R);
    else hideGuardRing(a);
    if (a.hitFlash > 0) {
      a.hitFlash = Math.max(0, a.hitFlash - dt * 5);
      a.group.position.x += rand(-1, 1) * a.hitFlash * 0.15;
    }
    showCreatureHp(a, bgy, false);
  }
}
function wanderMove(c, dt, mult) {
  c.wanderT -= dt;
  if (c.wanderT <= 0 || Math.hypot(c.tx - c.x, c.tz - c.z) < 1.5) {
    const p = c.treeLocked ? treeRandPos() : randPos(6, WILD_KEEPOUT_R + 8);
    c.tx = p.x; c.tz = p.z;
    c.wanderT = rand(3, 7);
  }
  const wx = c.tx - c.x, wz = c.tz - c.z;
  const wd = Math.max(0.3, Math.hypot(wx, wz));
  const sp = c.spd * (mult || 1);
  return { mx: (wx / wd) * sp, mz: (wz / wd) * sp, moving: true };
}
function showCreatureHp(c, bgy, force) {
  const show = force || c.hp < c.maxHp;
  c.hpBg.visible = c.hpFg.visible = show;
  if (show) {
    const y = bgy + (c.flies ? (c.flyH || 4) + 1 : 0) + 2.2;
    c.hpBg.position.set(c.x, y, c.z);
    const frac = Math.max(0.001, c.hp / c.maxHp);
    c.hpFg.scale.x = frac;
    c.hpFg.position.set(c.x - (1 - frac) * c.hpW * 0.5, y, c.z);
  }
}

// ---------- جنود المستعمرة (من ثكنة الجنود): 3 أنواع بأحجام وأشكال مختلفة ----------
const SOLDIER_VARIANTS = [
  { key: "guard", name: "حارس", icon: "🛡️", body: 0x2a2a2e, dark: 0x8f1d1d, scale: 0.95, jaw: 1.0, hp: 34, dmg: 6, def: 3, spd: 6.2 },
  { key: "brute", name: "مدرع", icon: "🦏", body: 0x4a1414, dark: 0x1a0505, scale: 1.32, jaw: 1.7, hp: 65, dmg: 11, def: 5, spd: 4.6 },
  { key: "swift", name: "مطارِد", icon: "🗡️", body: 0x8f3d10, dark: 0x3a1504, scale: 0.78, jaw: 0.85, hp: 22, dmg: 4, def: 1, spd: 8.2, desc: "صياد لصوص: ضرر ×2 ضد السارقين بحالة سرقة/هروب" },
];
function nextUid() { return (game.uidN = (game.uidN || 0) + 1); }
function spawnSoldier(gene, geneKey, forceVariant) {
  // اختيار النوع: إجباري ← تفضيل اللاعب (soldierFocus) ← تناوب الخليط
  let vi = SOLDIER_VARIANTS.findIndex((v) => v.key === forceVariant);
  if (vi < 0) {
    const f = game.soldierFocus;
    vi = (f && f !== "mix") ? SOLDIER_VARIANTS.findIndex((v) => v.key === f) : -1;
  }
  if (vi < 0) { vi = (game.soldierSpawnN || 0) % 3; game.soldierSpawnN = (game.soldierSpawnN || 0) + 1; }
  else game.soldierSpawnN = (game.soldierSpawnN || 0) + 1;
  const v = SOLDIER_VARIANTS[vi];
  const elite = !!(gene && gene.elite);
  const ant = createAnt({ body: elite ? 0x8a6d1f : v.body, dark: elite ? 0x3d2c05 : v.dark, scale: v.scale, model: "soldier", jaw: v.jaw, elite });
  const sx = HOLE.x + rand(-0.5, 0.5), sz = HOLE.z + rand(-0.5, 0.5);
  ant.group.position.set(sx, groundY(sx, sz), sz);
  ant.group.scale.setScalar(0.2);
  ant.group.visible = false; // داخل العش حتى تأمر
  scene.add(ant.group);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.28, 24),
    new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  ant.group.add(ring);
  const s = {
    uid: nextUid(), ant, kind: "soldier", variant: v.key, vname: v.name, vicon: v.icon,
    dmg: v.dmg, def: v.def, spd: v.spd, hp: v.hp, maxHp: v.hp,
    x: sx, z: sz, yaw: 0, vx: 0, vz: 0, atkCd: 0, tx: sx, tz: sz, waitT: 0,
    emergeT: 1, baseScale: v.scale, order: null, fightT: 0, dying: false, dieT: 0, selRing: null,
    inside: true, // يسكن العش — لا يخرج إلا بأمرك
  };
  s.base = { dmg: v.dmg, def: v.def, spd: v.spd, maxHp: v.hp, scale: v.scale };
  s.gene = gene || null;
  s.mods = geneKey ? [geneKey] : [];
  s.tr = { xp: 0, a: 0, d: 0, s: 0, h: 0 };
  refreshUnitStats(s);
  decorateArcher(s); // جعبة الرماية إن وُجدت
  game.soldiers.push(s);
  return s;
}
function removeSoldier(s, keepCorpse) {
  armyDesel(s);
  disposeGuardRing(s);
  if (keepCorpse) leaveCorpse(s);
  else try { scene.remove(s.ant.group); } catch {}
  const i = game.soldiers.indexOf(s);
  if (i >= 0) game.soldiers.splice(i, 1);
}

// ---------- نظام التحديد: عمال فقط (تحديد/تحريك/جمع) ----------
const army = { on: false, sel: new Set() };
const _pv = { v: null };
function worldToScreen(x, y, z) {
  try {
    _pv.v = _pv.v || new THREE.Vector3();
    _pv.v.set(x, y, z).project(camera);
    if (_pv.v.z > 1) return null;
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (_pv.v.x * 0.5 + 0.5) * r.width, y: r.top + (-_pv.v.y * 0.5 + 0.5) * r.height };
  } catch { return null; }
}
function groundPoint(px, py) {
  try {
    const r = renderer.domElement.getBoundingClientRect();
    const nx = ((px - r.left) / r.width) * 2 - 1;
    const ny = -((py - r.top) / r.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera({ x: nx, y: ny }, camera);
    const o = rc.ray.origin, d = rc.ray.direction;
    if (d.y >= -0.001) return null;
    const t = -o.y / d.y;
    if (t < 0 || t > 500) return null;
    const x = THREE.MathUtils.clamp(o.x + d.x * t, -TUNE.worldHalf, TUNE.worldHalf);
    const z = THREE.MathUtils.clamp(o.z + d.z * t, -TUNE.worldHalf, TUNE.worldHalf);
    return { x, z };
  } catch { return null; }
}
function allUnits() { return [...game.workers, ...game.soldiers, ...game.scouts, ...game.allies]; }
function unitLabel(u) {
  if (u === game.player) return "👑 القائد";
  const gb = (u.mods && u.mods.length) ? "🧬" : "";
  const el = (u.gene && u.gene.elite) ? "⭐" : "";
  const ar = (u.kind === "worker" || u.kind === "scout") && (u.armorVal > 0 || (u.gene && u.gene.def)) ? `🛡️${u.armorVal || 0}` : "";
  if (u.kind === "ally") return `${u.icon || "🐾"} ${u.name || "حليف"} LV${u.level || 1}${gb}`;
  if (u.kind === "soldier") {
    const r = TRAIN_RANKS[trainRankOf(u)] || TRAIN_RANKS[0];
    const ar = archeryLevel() > 0 ? "🏹" : "";
    return `${u.vicon || "⚔️"} ${u.vname || "جندي"} ${ar}${r.icon}${gb}${el}`;
  }
  if (u.kind === "scout") return `🔭 كشاف${ar}${gb}${el}`;
  return `🐜 عامل${ar}${gb}${el}`;
}
function armySel(u) {
  if (army.sel.has(u)) return;
  army.sel.add(u);
  if (!u.selRing) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.25, 1.5, 26),
      new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    u.ant.group.add(ring);
    u.selRing = ring;
  } else u.selRing.visible = true;
  armyRefreshBar();
}
function armyDesel(u) {
  if (!army.sel.has(u)) return;
  army.sel.delete(u);
  if (u.selRing) u.selRing.visible = false;
  armyRefreshBar();
}
function armyClearSel() {
  for (const u of [...army.sel]) armyDesel(u);
  armyRefreshBar();
}
function armyRefreshBar() {
  els.selCount.textContent = t("selected", { n: army.sel.size });
}
function selGatherers() { return [...army.sel].filter((u) => (u.kind === "worker" || u.kind === "scout")); }
// إزاحة التشكيل للفرد i من n (تُدوَّر حسب yaw)
function formationOffset(i, n, form, yaw) {
  let dx = 0, dz = 0;
  if (form === "wedge") {
    if (i > 0) { const k = Math.ceil(i / 2), sd = i % 2 ? 1 : -1; dx = sd * k * 2.0; dz = -k * 2.2; }
  } else if (form === "circle") {
    if (n > 1) { const a = (i / n) * Math.PI * 2; dx = Math.cos(a) * 3.4; dz = Math.sin(a) * 3.4; }
  } else {
    dx = (i - (n - 1) / 2) * 2.4; dz = 0;
  }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { dx: dx * c - dz * s, dz: dx * s + dz * c };
}
// مرساة المتابعة: اللاعب + إزاحة التشكيل
function followAnchor(u) {
  const fl = allUnits().filter((x) => x.order && x.order.t === "follow");
  const i = Math.max(0, fl.indexOf(u));
  const o = formationOffset(i, Math.max(1, fl.length), "line", game.player.yaw);
  return { x: game.player.x + o.dx, z: game.player.z + o.dz };
}
function orderMoveTo(units, x, z) {
  if (!units.length) return false;
  // توزيع دائري صغير حول النقطة حتى لا تتكدس النملات فوق بعضها
  units.forEach((u, i) => {
    const a = (i / Math.max(1, units.length)) * Math.PI * 2;
    const rr = units.length > 1 ? 1.6 : 0;
    u.order = {
      t: "move",
      x: THREE.MathUtils.clamp(x + Math.cos(a) * rr, -TUNE.worldHalf, TUNE.worldHalf),
      z: THREE.MathUtils.clamp(z + Math.sin(a) * rr, -TUNE.worldHalf, TUNE.worldHalf),
    };
  });
  noteDeployFor(units);
  return true;
}
// من كان داخل العش منهم سيخرج بأمرك — إشعار واحد
function noteDeployFor(units) {
  let n = 0;
  for (const u of units) {
    const o = u.order;
    if (!o || o.t === "hold") continue;
    if (u.kind === "soldier") { if (u.inside) n++; }
    else if (u.state === "inside" || u.state === "leaving") n++;
  }
  if (n) { beep(500, 0.08, "sine", 0.08); toast(`📤 ${n} يخرجون من العش بأمرك!`); }
}
// ---------- تطوير الكهرمان 🧡 (يُشترى من غرف العش) ----------
// الرماية: جنودك يطلقون أشواك الكهرمان عن بُعد (تُشترى من ثكنة الجنود)
const ARCHERY = [
  null,
  { range: 10, dmg: 4, cost: { store: 40, amber: 6 } },
  { range: 13, dmg: 7, cost: { store: 80, amber: 12 } },
  { range: 16, dmg: 11, cost: { store: 150, amber: 20 } },
];
// الأكياس: +1 سعة حمل للعمال كل مستوى (تُشترى من مسكن العمال)
const SACKS = [
  null,
  { cap: 1, cost: { store: 30, amber: 4 } },
  { cap: 2, cost: { store: 60, amber: 8 } },
  { cap: 3, cost: { store: 120, amber: 15 } },
];
function archeryLevel() { return (game.mods && game.mods.archery) || 0; }
function sacksLevel() { return (game.mods && game.mods.sacks) || 0; }
function workerCarryCap() { return TUNE.workerCapacity + sacksLevel(); }
function archeryText() {
  const lv = archeryLevel();
  if (lv >= 3) { const v = t("arch_max"); return v !== "arch_max" ? v : "🏹 الرماية قصوى ★★★ (مدى 16، ضرر 11)"; }
  const A = ARCHERY[lv + 1];
  const s = t("arch_buy", { lv: lv + 1, a: A.cost.amber, s: A.cost.store, r: A.range, d: A.dmg });
  return s !== "arch_buy" ? s : `🏹 شراء الرماية ${lv + 1}/3 (${A.cost.amber}🧡 + ${A.cost.store}🍯) — مدى ${A.range} وضرر ${A.dmg}`;
}
function sacksText() {
  const lv = sacksLevel();
  if (lv >= 3) { const v = t("sacks_max"); return v !== "sacks_max" ? v : "🎒 الأكياس قصوى ★★★ (+3 حمل)"; }
  const S = SACKS[lv + 1];
  const s = t("sacks_buy", { lv: lv + 1, a: S.cost.amber, s: S.cost.store, c: S.cap });
  return s !== "sacks_buy" ? s : `🎒 شراء الأكياس ${lv + 1}/3 (${S.cost.amber}🧡 + ${S.cost.store}🍯) — حمل العمال +${S.cap}`;
}
function buyArchery() {
  const lv = archeryLevel();
  if (lv >= 3) { toast("🏹 الرماية في المستوى الأقصى!"); return false; }
  if (Nest.soldiersLevel() <= 0) { toast("⚔️ ابنِ ثكنة الجنود أولاً"); return false; }
  const A = ARCHERY[lv + 1];
  if ((game.store || 0) < A.cost.store || (game.stock.amber || 0) < A.cost.amber) { toast(`🧡 كهرمان غير كافٍ — تحتاج ${A.cost.amber}🧡 + ${A.cost.store}🍯`); return false; }
  game.store -= A.cost.store; game.stock.amber -= A.cost.amber;
  game.mods.archery = lv + 1;
  sfx.level(); saveGame(); updateHUD();
  centerMsg(`🏹 الرماية ${lv + 1}! جنودك يطلقون أشواك الكهرمان!`);
  for (const s of game.soldiers) decorateArcher(s); // الجعبة تظهر فوراً على كل الجنود
  return true;
}
function buySacks() {
  const lv = sacksLevel();
  if (lv >= 3) { toast("🎒 الأكياس في المستوى الأقصى!"); return false; }
  if (Nest.workersLevel() <= 0) { toast("🐜 ابنِ مسكن العمال أولاً"); return false; }
  const S = SACKS[lv + 1];
  if ((game.store || 0) < S.cost.store || (game.stock.amber || 0) < S.cost.amber) { toast(`🧡 كهرمان غير كافٍ — تحتاج ${S.cost.amber}🧡 + ${S.cost.store}🍯`); return false; }
  game.store -= S.cost.store; game.stock.amber -= S.cost.amber;
  game.mods.sacks = lv + 1;
  sfx.level(); saveGame(); updateHUD();
  centerMsg(`🎒 أكياس كهرمانية! حمل العمال +${S.cap}!`);
  return true;
}
// ---------- خصوبة الملكة 👑 (تُشترى من غرفتها — تعوّض من يموت في المعارك) ----------
// كل مستوى: بيض أسرع (+50% سرعة وضع) + نمو أسرع (+15%) + حضن أوسع (+1)
const FERTILITY = [
  null,
  { cost: { store: 30, amber: 5 } },
  { cost: { store: 60, amber: 10 } },
  { cost: { store: 120, amber: 18 } },
];
function fertilityLevel() { return (game.mods && game.mods.fertility) || 0; }
function fertilityText() {
  const lv = fertilityLevel();
  if (lv >= 3) { const v = t("fert_max"); return v !== "fert_max" ? v : "👑 الخصوبة قصوى ★★★ (وضع ×2.5 ونمو +45%)"; }
  const F = FERTILITY[lv + 1];
  const s = t("fert_buy", { lv: lv + 1, a: F.cost.amber, s: F.cost.store });
  return s !== "fert_buy" ? s : `👑 خصوبة الملكة ${lv + 1}/3 (${F.cost.amber}🧡 + ${F.cost.store}🍯) — بيض أسرع وتعويض الموتى`;
}
function buyFertility() {
  const lv = fertilityLevel();
  if (lv >= 3) { toast("👑 الخصوبة في المستوى الأقصى!"); return false; }
  const F = FERTILITY[lv + 1];
  if ((game.store || 0) < F.cost.store || (game.stock.amber || 0) < F.cost.amber) { toast(`🧡 كهرمان غير كافٍ — تحتاج ${F.cost.amber}🧡 + ${F.cost.store}🍯`); return false; }
  game.store -= F.cost.store; game.stock.amber -= F.cost.amber;
  game.mods.fertility = lv + 1;
  sfx.level(); saveGame(); updateHUD();
  centerMsg(`👑 خصوبة الملكة ${lv + 1}! البيض أسرع لتعويض الموتى!`);
  return true;
}
// المظهر المميز للرماة 🏹: جعبة أشواك كهرمانية على الظهر + جوهرة صدر — تُبنى لكل مستوى رماية
function decorateArcher(s) {
  try {
    if (s._quiver) { s.ant.group.remove(s._quiver); s._quiver = null; }
    const lv = archeryLevel();
    if (!lv || !s || s.kind !== "soldier" || !s.ant || !s.ant.group) return;
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xff9f1a, emissive: lv >= 3 ? 0xcc5500 : 0x7a3d00, roughness: 0.35 });
    const n = lv + 2; // 3/4/5 أشواك حسب المستوى
    for (let i = 0; i < n; i++) {
      const th = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.95, 5), mat);
      const a = (i / n) * Math.PI * 2;
      th.position.set(Math.cos(a) * 0.34, 1.6, -1.0 + Math.sin(a) * 0.34);
      th.rotation.x = -0.9;
      th.rotation.z = Math.cos(a) * 0.5;
      th.castShadow = true;
      g.add(th);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), mat);
    gem.position.set(0, 1.08, 0.12);
    g.add(gem);
    s.ant.group.add(g);
    s._quiver = g;
  } catch {}
}
// ---------- مقذوفات أشواك الكهرمان 🏹 ----------
let thornGeo = null, thornMat = null;
function fireThorn(s, target, dmg) {
  try {
    if (!thornGeo) thornGeo = new THREE.ConeGeometry(0.13, 0.75, 5);
    if (!thornMat) thornMat = new THREE.MeshStandardMaterial({ color: 0xff9f1a, emissive: 0x9a5200, roughness: 0.3 });
    const m = new THREE.Mesh(thornGeo, thornMat);
    const y = groundY(s.x, s.z) + 1.1;
    m.position.set(s.x, y, s.z);
    scene.add(m);
    game.shots.push({ mesh: m, x: s.x, z: s.z, y, tgt: target, dmg, spd: 30, life: 2.2, lx: target.x, lz: target.z });
    s.ant.fightT = 0.35;
    s.shotCd = 1.6;
    s.yaw = Math.atan2(target.x - s.x, target.z - s.z);
    sfx.shoot();
  } catch {}
}
// الرمي بالشوك: إن كان العدو ضمن مدى الرماية وخارج الالتصاق، أطلق وثبت (لا تقترب)
function rangedTry(s, e, d) {
  const lv = archeryLevel();
  if (!lv || !e || !enemyAlive(e)) return false;
  const A = ARCHERY[lv];
  if (!A || d > A.range + 1 || (s.shotCd || 0) > 0) return false;
  fireThorn(s, e, A.dmg);
  return true;
}
function updateShots(dt) {
  if (!game.shots || !game.shots.length) return;
  for (let i = game.shots.length - 1; i >= 0; i--) {
    const sh = game.shots[i];
    sh.life -= dt;
    const alive = sh.tgt && enemyAlive(sh.tgt);
    if (alive) { sh.lx = sh.tgt.x; sh.lz = sh.tgt.z; }
    const dx = sh.lx - sh.x, dz = sh.lz - sh.z;
    const d = Math.hypot(dx, dz);
    const step = sh.spd * dt;
    try {
      sh.mesh.rotation.y = Math.atan2(dx, dz);
      sh.mesh.rotation.x = Math.PI / 2 - 0.35;
    } catch {}
    if ((alive && d <= 1.2) || sh.life <= 0 || (!alive && d < step + 0.5)) {
      try {
        if (alive && d <= 1.2) {
          damageEnemy(sh.tgt, sh.dmg * dmgMul());
          // 🏹 شوك الرماة يُخدّر الزعماء ويُضعفهم (تخدير تراكمي حتى 3 طبقات)
          if ((sh.tgt.key === "centipede" || sh.tgt.key === "siege") && !sh.tgt.stunned) {
            const first = !(sh.tgt.weakT > 0);
            sh.tgt.weakT = 6;
            sh.tgt.weakN = Math.min(3, (sh.tgt.weakN || 0) + 1);
            spawnBurst(sh.tgt.x, 1.4, sh.tgt.z, 0x7dff6a, 8, 2.5, 3);
            spawnDmgNum(sh.tgt.x, 2.4, sh.tgt.z, first ? "😴 تخدير! أبطأتها الرماية" : "😴 مخدّرة!", "#7dff6a");
            if (first && sh.tgt.key === "siege" && !game._siegeWeakTip) { game._siegeWeakTip = true; toast("🏹 الرماية تُبطئ خنفساء الحصار وتُضعفها — راكموا الطبقات!"); }
            if (first && sh.tgt.key === "centipede" && !game._centiWeakTip) { game._centiWeakTip = true; toast("🏹 أشواك الرماة تُخدّر أم 44 وتُضعفها — راكموا الرماية والطبقات!"); }
          }
          spawnBurst(sh.tgt.x, 1.2, sh.tgt.z, 0xff9f1a, 8, 2.5, 3);
        } else {
          spawnBurst(sh.lx, 0.6, sh.lz, 0xff9f1a, 4, 1.5, 2);
        }
        scene.remove(sh.mesh);
      } catch {}
      game.shots.splice(i, 1);
      continue;
    }
    if (d > 0.001) { sh.x += (dx / d) * step; sh.z += (dz / d) * step; }
    try { sh.mesh.position.set(sh.x, sh.y + Math.sin(sh.life * 9) * 0.06, sh.z); } catch {}
  }
}
// ---------- الثبات الميداني: حراسة موقع بنطاق اشتباك ضيق 📍 ----------
// الجندي الثابت يقاتل فقط ما يدخل نطاق موقعه — بلا مطاردة بعيدة (مثالي لسرقة الكهرمان من الشجرة)
const GUARD_R = 8; // نطاق الاشتباك الافتراضي حول موقع الثبات
function guardChaseOk(a, e) {
  const o = a && a.order;
  if (!o || o.t !== "guard" || !e) return true;
  return Math.hypot(e.x - o.x, e.z - o.z) <= ((o.r || GUARD_R) + 2);
}
// حلقة ذهبية تُظهر نطاق الاشتباك حول موقع الثبات
function guardRing(u, x, z, r) {
  try {
    if (!u._gring) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      scene.add(m);
      u._gring = m;
    }
    u._gring.visible = true;
    u._gring.position.set(x, 0.09, z);
    u._gring.scale.set(r, r, 1);
  } catch {}
}
function hideGuardRing(u) { try { if (u && u._gring) u._gring.visible = false; } catch {} }
function disposeGuardRing(u) { try { if (u && u._gring) { scene.remove(u._gring); u._gring = null; } } catch {} }
// ثبات هنا: المحددون (جنود/حلفاء) يحرسون أماكنهم الحالية ولا يطاردون بعيداً
function orderHold() {
  const units = [...army.sel].filter((u) => (u.kind === "soldier" && !u.dying && !u.inTraining && !u.inside) || u.kind === "ally");
  if (!units.length) { toast("📍 حدد جنوداً أو حلفاء أولاً"); return; }
  let n = 0;
  for (const u of units) {
    if (u.kind === "ally" && (u.inClinic || u.inTraining)) continue;
    if (u.inside || u.state === "inside") continue;
    u.order = { t: "guard", x: u.x, z: u.z, r: GUARD_R };
    n++;
  }
  if (!n) { toast("📍 لا وحدات متاحة (داخل العش/العلاج)"); return; }
  beep(650, 0.07, "sine", 0.09);
  toast(`📍 ${n} يثبتون هنا — يشتبكون ضمن ${GUARD_R} فقط!`);
}
// انتقاء عدو بالنقر (خنافس/مخلوقات/غزاة/مستعمرات/التل الأبيض)
function nearestEnemyAt(px, py, maxPx) {
  const R = maxPx || 30;
  let best = null, bd = R;
  const consider = (x, y, z, e) => {
    const p = worldToScreen(x, y, z);
    if (!p) return;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bd) { bd = d; best = e; }
  };
  for (const b of game.beetles) consider(b.x, 0.6, b.z, b);
  for (const c of game.creatures) { if (c.stunned) continue; consider(c.x, 1, c.z, c); }
  for (const e of game.enemies) { if (e.dying) continue; consider(e.x, 1, e.z, e); }
  for (const col of game.colonies) { if (!col.alive) continue; consider(col.x, 6, col.z, col); }
  const mo = game.termiteMound;
  if (mo && mo.alive) consider(mo.x, 2, mo.z, mo);
  return best;
}
// شريط الجيش السريع ⚔️🐜 (من الدليل): هجوم شامل على أقرب عدو + تجميع الجيش حولك — ظاهر على السطح عند وجود مقاتلين
function quickAttack() {
  if (game.underground) return;
  const fx = camFocusX(), fz = camFocusZ();
  const ne = nearestEnemy(fx, fz, 45);
  if (!ne || !ne.e) { toast("⚔️ لا عدو قريب من الكاميرا — حرّكها لمنطقة القتال"); return; }
  focusAttackAll(ne.e);
}
function quickFollow() {
  const units = [
    ...game.soldiers.filter((s) => !s.dying && !s.inTraining && !s.inClinic && !s.inside),
    ...game.allies.filter((a) => !a.inClinic && !a.inTraining),
  ];
  if (!units.length) { toast("🐜 لا مقاتلين خارج العش"); return; }
  for (const u of units) { u.order = { t: "follow" }; armySel(u); }
  beep(700, 0.08, "sine", 0.09);
  toast(`🐜 ${units.length} يتجمعون عند العش للحماية!`);
}
function updateQuickBar() {
  const bar = els.quickBar;
  if (!bar) return;
  let show = false;
  try {
    show = !game.underground && game.started && !game.paused && !isEditMode() &&
      (game.soldiers.some((s) => !s.dying && !s.inside) || game.allies.length > 0);
  } catch {}
  bar.hidden = !show;
  if (show) {
    if (!bar._wired) {
      bar._wired = true;
      els.qAtkBtn.onclick = () => quickAttack();
      els.qFolBtn.onclick = () => quickFollow();
    }
  }
}
// زر سياقي عائم 📲 (من الدليل): يعرض أنسب إجراء قرب اللاعب — أسر دائخ أو دخول العش
function updateCtxBtn() {
  const b = els.ctxBtn;
  if (!b) return;
  let txt = null, fn = null;
  try {
    if (!game.underground && game.started && !game.paused && !isEditMode()) {
      const fx = camFocusX(), fz = camFocusZ();
      let st = null, sd = 8;
      for (const c of game.creatures) {
        if (!c.stunned) continue;
        const d = Math.hypot(c.x - fx, c.z - fz);
        if (d < sd) { sd = d; st = c; }
      }
      if (st) { txt = t("ctx_capture", { x: st.icon || t("bug_word") }); fn = () => captureCreature(st); }
      else if (Math.hypot(fx - HOLE.x, fz - HOLE.z) < 9) { txt = t("ctx_enter"); fn = () => enterNest(); }
    }
  } catch {}
  if (txt) {
    b.hidden = false;
    if (b.textContent !== txt) b.textContent = txt;
    b.onclick = fn;
  } else b.hidden = true;
}
// تركيز الهجوم بالضغط المزدوج 👆👆 (نصيحة الدليل): كل المقاتلين على أخطر هدف دفعة واحدة — بلا تحديد مسبق
let lastTap = { x: 0, y: 0, t: 0 };
function focusAttackAll(e) {
  const fighters = [
    ...game.soldiers.filter((s) => !s.dying && !s.inTraining && !s.inClinic),
    ...game.allies.filter((a) => !a.inClinic && !a.inTraining),
  ];
  if (!fighters.length) { toast("⚔️ لا مقاتلين متاحين — افقس جنوداً أو أطلق حليفاً"); return false; }
  for (const u of fighters) { u.order = { t: "attack", b: e }; armySel(u); }
  const nm = (e && (e.icon || e.key)) ? `${e.icon || "⚔️"} ${e.name || e.key || "العدو"}` : "العدو";
  beep(300, 0.12, "square", 0.1);
  noteDeployFor(fighters);
  toast(`👆👆 تركيز الهجوم: ${fighters.length} يهاجمون ${nm}!`);
  return true;
}
// هجوم مقصود: مطاردة كاملة للهدف حتى يسقط (ثم ثبات مكانه)
function doAttackOrder(e) {
  const ss = [...army.sel].filter((u) => (u.kind === "soldier" && !u.dying && !u.inTraining) || u.kind === "ally");
  if (!ss.length) return false;
  for (const u of ss) u.order = { t: "attack", b: e };
  const nm = (e && (e.icon || e.key)) ? `${e.icon || "⚔️"} ${e.name || e.key || "العدو"}` : "العدو";
  beep(300, 0.12, "square", 0.1);
  noteDeployFor(ss);
  toast(`⚔️ ${ss.length} يهاجمون ${nm}!`);
  return true;
}
function issueMove(x, z) {
  const units = [...army.sel].filter((u) => !(u.kind === "soldier" && (u.dying || u.inTraining)));
  if (!units.length) { toast("🎯 حدد عمالاً أو جنوداً أولاً"); return; }
  orderMoveTo(units, x, z);
  beep(700, 0.06, "sine", 0.09);
  toast(`📍 تحركوا للنقطة! (${units.length})`);
}
// تحديد سريع: كل زر يبدّل نوعه — العمال والجنود معاً أو كلاً على حدة
function selAllWorkers() {
  const cur = [...game.workers.filter((w) => !w.inClinic && !w.inTraining), ...game.scouts.filter((w) => !w.inClinic && !w.inTraining)];
  if (cur.some((u) => army.sel.has(u))) {
    cur.forEach(armyDesel);
    beep(400, 0.06, "sine", 0.07);
    toast("🐜 ألغيت تحديد العمال");
    return;
  }
  if (!cur.length) { toast("🐜 لا عمال متاحين"); return; }
  cur.forEach(armySel);
  beep(800, 0.05, "sine", 0.07);
  toast(`🐜 حددت ${cur.length} — انقر طعاماً للجمع أو أرضاً للتحرك مباشرة`);
}
function selAllSoldiers() {
  const cur = game.soldiers.filter((s) => !s.dying && !s.inTraining);
  if (cur.some((u) => army.sel.has(u))) {
    cur.forEach(armyDesel);
    beep(400, 0.06, "sine", 0.07);
    toast("⚔️ ألغيت تحديد الجنود");
    return;
  }
  if (!cur.length) { toast("⚔️ لا جنود — افقس من الثكنة"); return; }
  cur.forEach(armySel);
  beep(800, 0.05, "sine", 0.07);
  toast(`⚔️ حددت ${cur.length} — انقر أرضاً للتحرك مباشرة`);
}
// لمسة مزدوجة على وحدة = تحديد كل وحدات نوعها (عمال/جنود/حلفاء) — بأسلوب RTS
function selectSameType(u) {
  if (!u || game.underground) return;
  armyClearSel();
  let n = 0, label = "";
  if (u.kind === "soldier") {
    const cur = game.soldiers.filter((s) => !s.dying && !s.inTraining && !s.inside);
    cur.forEach(armySel); n = cur.length; label = "⚔️ الجنود";
  } else if (u.kind === "ally") {
    const cur = game.allies.filter((a) => !a.inside && a.state !== "inside");
    cur.forEach(armySel); n = cur.length; label = "🪲 الحلفاء";
  } else {
    const cur = [...game.workers, ...game.scouts].filter((w) => !w.inClinic && !w.inTraining && !w.inside && w.state !== "inside");
    cur.forEach(armySel); n = cur.length; label = "🐜 العمال";
  }
  beep(880, 0.06, "sine", 0.08);
  toast(`${label}: حددت ${n} بلمستين — انقر: طعام=جمع، عدو=هجوم، أرض=تحرك`);
}
// تحديد المصابين فقط (عمال/كشافة/جنود/حلفاء خارج العلاج) — لتبديل سريع ثم إرسالهم للعلاج
function selAllInjured() {
  const cur = injuredUnits();
  if (!cur.length) { toast("🤕 لا مصابين خارج العلاج — جيشك سليم"); return; }
  if (cur.some((u) => army.sel.has(u))) {
    cur.forEach(armyDesel);
    beep(400, 0.06, "sine", 0.07);
    toast("🤕 ألغيت تحديد المصابين");
    return;
  }
  cur.forEach(armySel);
  beep(800, 0.05, "sine", 0.07);
  toast(`🤕 حددت ${cur.length} مصاباً — افتح 🧬 العلاج وأدخلهم الأسرّة`);
}
// أمر العودة للمنزل: المحددون (أو الجميع إن لم يكن هناك تحديد) يرجعون للعش ويدخلونه
function orderHome() {
  let targets = [...army.sel];
  if (!targets.length) {
    targets = allUnits().filter((u) => {
      if (!u || u.dying || u.inClinic || u.inTraining) return false;
      return u.kind === "soldier" ? !u.inside : (u.state !== "inside");
    });
  }
  if (!targets.length) { toast("🏠 الجميع في العش بالفعل"); return; }
  let n = 0, treeSkipped = 0;
  for (const u of targets) {
    if (u.treeZone) { treeSkipped++; continue; } // وحدات الشجرة تبقى هناك — تُعاد عبر البوابة فقط
    if (u.kind === "worker" || u.kind === "scout") {
      u.order = null; u.target = null; u.retarget = 0;
      u.state = "toNest"; u.forceHome = true; n++;
    } else if (u.kind === "soldier") {
      u.order = null; n++; // بلا أوامر: عودة تلقائية للفتح والدخول
    } else if (u.kind === "ally") {
      u.order = { t: "guard", x: HOLE.x, z: HOLE.z, r: 12 }; n++; // الحليف يحرس مدخل العش
    }
  }
  beep(600, 0.08, "sine", 0.09);
  toast(`🏠 ${n} عادوا إلى العش`);
  if (treeSkipped) toast("🌳 وحدات الشجرة تبقى هناك — اعبر البوابة بنفسك أو اطلب منها المجيء لحلقة الرجوع!");
}
function armySetMode(on) {
  army.on = on;
  els.cmdBar.hidden = !on;
  input.jx = input.jy = 0;
  if (els.armyBtn) {
    els.armyBtn.innerHTML = on ? "🎯<small>✓</small>" : "⚔️<small>جيش</small>";
    els.armyBtn.classList.toggle("on", !!on);
  }
  input.active = false;
  els.joyBase.hidden = true;
  if (!on) {
    armyClearSel();
    input.panVX = input.panVZ = 0; input.panActive = false;
    input.camPanX = 0; input.camPanZ = 0; // الكاميرا ترجع تتبع اللاعب
  } else toast("🐜⚔️ وضع الجيش: لمسة=تبديل وحدة، لمستان=تحديد نوعها، مطوّل+سحب=مربع تحديد، سحب عادي=كاميرا — ثم انقر: طعام=جمع، عدو=هجوم، أرض=تحرك — وإصبعان للنظر والتقريب");
}
function nearestUnitAt(px, py, maxPx = 28) {
  let best = null, bd = maxPx;
  // 👑 القائد معتكف في العش — لا يُنقر ولا يُحدد (القيادة من فوق فقط)
  // وضع التحديد: عمال وكشافة وجنود وحلفاء
  for (const u of [...game.workers, ...game.scouts, ...game.soldiers, ...game.allies]) {
    if (u.kind === "soldier") {
      if (u.dying || u.inTraining || u.inside) continue;
    } else {
      if (u.inTraining || u.inClinic) continue;
      if (u.inside || u.state === "inside") continue; // داخل العش: لا يُنقر — حدده بزر النوع
    }
    const p = worldToScreen(u.x, 1.2, u.z);
    if (!p) continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}
function nearestFoodAt(px, py, maxPx = 32) {
  let best = null, bd = maxPx, bt = null;
  for (const f of game.foods) {
    const p = worldToScreen(f.x, 0.4, f.z);
    if (!p) continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bd) { bd = d; best = f; }
  }
  for (const n of game.nodes) {
    if (!n.amount) continue;
    const p = worldToScreen(n.x, 1, n.z);
    if (!p) continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bd) { bd = d; best = null; bt = n; }
  }
  return best || bt;
}
// أمر جمع ذكي: العمال يجمعون، والمقاتلون المحددون معهم يرافقون حراسة
// أمر جمع: العمال يجمعون، والجنود المحددون يرافقونهم حراسة عند الطعام — والقائد يمشي لها بنفسه
function doFoodOrder(f) {
  const ws = selGatherers();
  const ss = [...army.sel].filter((u) => u.kind === "soldier" && !u.dying && !u.inTraining);
  if (army.sel.has(game.player) && f && f.x !== undefined) {
    game.player.tx = THREE.MathUtils.clamp(f.x, -TUNE.worldHalf, TUNE.worldHalf);
    game.player.tz = THREE.MathUtils.clamp(f.z, -TUNE.worldHalf, TUNE.worldHalf);
    game.autoReturn = false;
  }
  if (!ws.length && !ss.length && !army.sel.has(game.player)) { toast("🐜 حدد عمالاً ثم اضغط الطعام"); return; }
  for (const w of ws) w.order = { t: "gather", target: f };
  if (ss.length && f.x !== undefined) orderMoveTo(ss, f.x, f.z);
  beep(680, 0.07, "sine", 0.09);
  noteDeployFor([...ws, ...ss]);
  toast(ws.length ? `🌾 ${ws.length} يجمعون${ss.length ? ` + 🛡️ ${ss.length} حراسة` : ""}!` : `🛡️ ${ss.length} إلى الطعام!`);
}
function smartTap(px, py) {
  // مخلوق دائخ؟ → أسر فوري
  const st = nearestStunnedAt(px, py, 44);
  if (st) { captureCreature(st); lastTap.t = 0; return; }
  // ضغط مزدوج على عدو؟ → تركيز هجوم كل المقاتلين (أولوية قصوى)
  const now = performance.now();
  const isDouble = (now - lastTap.t < 350) && Math.hypot(px - lastTap.x, py - lastTap.y) < 44;
  lastTap = { x: px, y: py, t: now };
  if (isDouble) {
    const foe2 = nearestEnemyAt(px, py, 36);
    if (foe2 && focusAttackAll(foe2)) return;
  }
  // نقرة دقيقة على طعام؟ → الأولوية للطعام
  const fExact = nearestFoodAt(px, py, 14);
  if (fExact) { doFoodOrder(fExact); return; }
  // طعام قريب؟ → العمال المحددون يجمعون فوراً
  const f = nearestFoodAt(px, py, 32);
  if (f) { doFoodOrder(f); return; }
  // نملة عامل؟ → تبديل التحديد
  const u = nearestUnitAt(px, py, 28);
  if (u) {
    if (army.sel.has(u)) armyDesel(u);
    else { armySel(u); beep(800, 0.05, "sine", 0.07); }
    return;
  }
  // عدو؟ → المقاتلون المحددون يهاجمونه هجوماً مقصوداً (مطاردة كاملة) — والقائد وحده يقترب فقط
  const foe = nearestEnemyAt(px, py, 30);
  if (foe) {
    if (doAttackOrder(foe)) {
      if (army.sel.has(game.player)) { game.player.tx = foe.x; game.player.tz = foe.z; game.autoReturn = false; }
      return;
    }
    if (army.sel.has(game.player)) { game.player.tx = foe.x; game.player.tz = foe.z; game.autoReturn = false; toast("👑 القائد يقترب — حدد جنوداً ⚔️ للهجوم!"); return; }
  }
  // أرض؟ → أمر تحرك للمحددين (والقائد يمشي بأمر مباشر)
  const g = groundPoint(px, py);
  if (g) {
    if (army.sel.has(game.player)) {
      game.player.tx = THREE.MathUtils.clamp(g.x, -TUNE.worldHalf, TUNE.worldHalf);
      game.player.tz = THREE.MathUtils.clamp(g.z, -TUNE.worldHalf, TUNE.worldHalf);
      game.autoReturn = false;
      game._tutMoved = true;
    }
    if (army.sel.size) issueMove(g.x, g.z);
    else toast("🎯 حدد عمالاً أو جنوداً أولاً");
  }
}
// أشرطة صحة الوحدات المحددة
function updateHpBars() {
  const ctn = els.hpCtn;
  while (ctn.children.length < army.sel.size) {
    const d = document.createElement("div");
    d.className = "uhp";
    d.innerHTML = `<div class="bl"></div><div class="bar"><div class="fill"></div></div>`;
    ctn.appendChild(d);
  }
  let i = 0;
  for (const u of army.sel) {
    const d = ctn.children[i++];
    if (!d) break;
    if (u.inside || u.state === "inside" || u.inClinic || u.inTraining) { d.style.display = "none"; continue; }
    const h = (u.kind === "soldier" ? u.baseScale : 1) || 1;
    const p = worldToScreen(u.x, 1.4 + h, u.z);
    if (!p) { d.style.display = "none"; continue; }
    d.style.display = "block";
    d.style.left = p.x + "px";
    d.style.top = p.y + "px";
    d.children[0].textContent = unitLabel(u);
    const frac = Math.max(0, u.hp / (u.maxHp || 1));
    const fill = d.children[1].children[0];
    fill.style.width = `${Math.round(frac * 100)}%`;
    fill.style.background = frac > 0.5 ? "#51ff5e" : frac > 0.25 ? "#ffd93d" : "#ff4444";
  }
  while (ctn.children.length > army.sel.size) ctn.lastChild.remove();
}
function removeBeetle(b) {
  scene.remove(b.group);
  if (b.hpBg) scene.remove(b.hpBg);
  if (b.hpFg) scene.remove(b.hpFg);
  const i = game.beetles.indexOf(b);
  if (i >= 0) game.beetles.splice(i, 1);
}
function killBeetle(b) {
  spawnBurst(b.x, 0.8, b.z, 0xa02020, 20, 4, 5);
  spawnFood(b.x + 1, b.z, "crumb");
  spawnFood(b.x - 1, b.z + 0.5, "seed");
  if (Math.random() < 0.25) spawnFood(b.x + rand(-1, 1), b.z + rand(-1, 1), "lifeleaf");
  removeBeetle(b);
  game.beetleRespawnT = Math.max(game.beetleRespawnT, 25);
  game.stats.kills = (game.stats.kills || 0) + 1;
  addXP(3);
  toast("⚔️ الجنود قضوا على خنفساء! +غنائم");
  sfx.die(); sfx.level();
}
// استشهاد جندي: أنيميشن موت (سقوط + غوص) ثم إزالة
function startSoldierDeath(s) {
  if (s.dying) return;
  s.dying = true;
  s.dieT = 0;
  s.order = null;
  s.ant.fightT = 0;
  spawnBurst(s.x, 0.8, s.z, 0x8f1d1d, 16, 3, 4);
  sfx.die();
  toast(`💀 استشهد ${s.vname || "جندي"}!`);
  saveGame();
}

// ---------- نظام المعارك: مستعمرات معادية + غارات + دفاع ----------
// مستعمرتان: الظل (عادية) والحمراء (زعيمة — معركة خاصة)
const ENEMY_COLONY_DEFS = [
  { key: "shadow", name: "مستعمرة الظل", icon: "🖤", color: 0x3a2a1a, dark: 0x1a0f05, flag: 0x3a2a1a, x: -170, z: 170, hp: 250, def: 2, cap: 4, raidEvery: 150, raidN: 2, loot: 30, lootFood: 3 },
  { key: "red", name: "المستعمر الحمراء", icon: "👹", color: 0xc22a1a, dark: 0x5a0f05, flag: 0xff2222, x: 170, z: -170, hp: 650, def: 4, cap: 7, raidEvery: 120, raidN: 2, loot: 100, lootFood: 6, boss: true },
];
const ENEMY_ROLES = {
  guard: { hp: 30, dmg: 5, def: 1, spd: 6.5, scale: 0.9 },
  raider: { hp: 22, dmg: 4, def: 0, spd: 7.5, scale: 0.85 },
  redguard: { hp: 55, dmg: 9, def: 2, spd: 7, scale: 1.0 },
  redraider: { hp: 40, dmg: 7, def: 1, spd: 8, scale: 0.95 },
  boss: { hp: 320, dmg: 24, def: 4, spd: 4, scale: 1.9 },
};
function buildEnemyMound(def) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 })
  );
  m.scale.set(1, 0.5, 1);
  m.position.y = 0.2;
  m.castShadow = true;
  g.add(m);
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 16),
    new THREE.MeshBasicMaterial({ color: 0x0a0503 })
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(0, 2.12, 0.6);
  g.add(hole);
  // راية الحرب بلون المستعمر
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5, 6), cMat(0x3a2a1a));
  pole.position.set(0, 4.2, -1);
  g.add(pole);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ color: def.flag, side: THREE.DoubleSide }));
  banner.position.set(0.95, 6.0, -1);
  g.add(banner);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.4, 5.8, 36),
    new THREE.MeshBasicMaterial({ color: def.flag, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  g.add(ring);
  g.position.set(def.x, 0, def.z);
  scene.add(g);
  return { group: g, banner };
}
// أرقام ضرر عائمة
function spawnDmgNum(x, y, z, txt, color) {
  const ctn = els.dmgCtn;
  if (!ctn || ctn.children.length > 30) return;
  const p = worldToScreen(x, y, z);
  if (!p) return;
  const d = document.createElement("div");
  d.className = "dmgnum";
  d.textContent = txt;
  d.style.color = color || "#ffd93d";
  d.style.left = p.x + "px";
  d.style.top = p.y + "px";
  ctn.appendChild(d);
  setTimeout(() => d.remove(), 850);
}
// علاج الراحة البطيء 🍃 (من البداية بلا عيادة): داخل العش 2%/ث، وسطح ساكن بلا قتال 1%/ث — العيادة تبقى أسرع بكثير
function restHeal(u, dt, inNest, surfaceIdle) {
  if (!u || u.hp === undefined || u.maxHp === undefined) return;
  if (u.inClinic || u.inTraining || u.dying) return;
  if (u.hp >= u.maxHp) return;
  const rate = inNest ? 0.02 : (surfaceIdle ? 0.01 : 0);
  if (rate <= 0) return;
  u.hp = Math.min(u.maxHp, u.hp + u.maxHp * rate * dt);
  u.restFxT = (u.restFxT || 0) + dt;
  if (u.restFxT >= 7) {
    u.restFxT = 0;
    try { spawnBurst(u.x, 1.2, u.z, 0x51ff5e, 3, 1, 2); } catch {}
  }
}
// ضرر على جنودك مع الدرع + رقم عائم
function hitSoldier(s, dmg, from) {
  if (!s || s.dying) return 0;
  if (s.inClinic || s.inTraining) return 0;
  const real = Math.max(1, Math.round(dmg - (s.def || 0)));
  s.hp -= real;
  s.ant.fightT = 0.35;
  spawnDmgNum(s.x, 1.8, s.z, real, "#ff5d5d");
  if (s.hp <= 0) startSoldierDeath(s);
  return real;
}
// ضرر على العمال/الكشافة + موت وإسقاط المحمول
function hitWorker(w, dmg, from) {
  if (!w || w.hp === undefined || w.hp <= 0) return;
  if (w.inClinic || w.inTraining) return;
  if (w.state === "inside" || w.state === "leaving") return;
  // درع العمال + جينات الدفاع تمتص الضرر فعلياً
  const arm = (w.armorVal || 0) + ((w.gene && w.gene.def) || 0);
  w.hp -= Math.max(1, Math.round(dmg - arm));
  w.ant.fightT = 0.35; // أنيميشن دفاعي: عضّة فكين تحذيرية
  spawnBurst(w.x, 0.8, w.z, 0xffaa00, 8, 2, 2);
  spawnDmgNum(w.x, 1.5, w.z, Math.max(1, Math.round(dmg - arm)), "#ff9d5d");
  // دفاع النفس فقط: ردّ محدود على المهاجم — لا يترك عمله ولا يطارد أبداً
  if (from && enemyAlive(from) && (arm > 0 || (w.gene && w.gene.dmg))) {
    const retal = 1 + arm + ((w.gene && w.gene.dmg) || 0);
    damageEnemy(from, retal);
    spawnDmgNum(from.x, 1.6, from.z, "🛡️" + retal, "#9adcff");
  }
  if (w.hp <= 0) {
    for (const it of (w.carried || [])) { try { spawnFood(w.x + rand(-1, 1), w.z + rand(-1, 1), it.kind || "crumb"); } catch {} }
    spawnBurst(w.x, 0.8, w.z, 0x8a3a10, 18, 3, 4);
    toast(`🐜 قُتل ${w.kind === "scout" ? "كشاف" : "عامل"}!`);
    removeWorker(w);
  }
}
// جثة واقفة: أثر النملة القتيلة يبقى على الخريطة (بحد أقصى 30، الأقدم يُزال)
function leaveCorpse(u) {
  armyDesel(u);
  const g = u.ant.group;
  if (u.selRing) { try { g.remove(u.selRing); } catch {} u.selRing = null; }
  try {
    g.traverse((m) => {
      if (m.isMesh && m.material) {
        m.material = m.material.clone();
        if (m.material.color && m.material.color.multiplyScalar) m.material.color.multiplyScalar(0.32);
        m.material.transparent = true;
        m.material.opacity = 0.92;
      }
    });
  } catch {}
  g.rotation.z = 0.28; // ميلان خفيف — ميتة لكن واقفة
  g.visible = true;
  game.corpses.push({ group: g, x: u.x, z: u.z, kind: u.kind });
  if (game.corpses.length > 30) {
    const old = game.corpses.shift();
    try { scene.remove(old.group); } catch {}
  }
}
function removeWorker(w) {
  leaveCorpse(w);
  let i = game.workers.indexOf(w);
  if (i >= 0) game.workers.splice(i, 1);
  i = game.scouts.indexOf(w);
  if (i >= 0) game.scouts.splice(i, 1);
}
// ---------- المستعمرات المعادية ----------
function spawnColony(def) {
  const built = buildEnemyMound(def);
  const hb = addHpBar(built.group, 4.5, 7.6);
  const col = {
    uid: nextUid(), isColony: true, key: def.key, name: def.name, icon: def.icon,
    def, x: def.x, z: def.z, yaw: 0, hp: Math.round(def.hp * diffDef().ehp), maxHp: Math.round(def.hp * diffDef().ehp), defV: def.def,
    attackRange: 5.5, group: built.group, banner: built.banner,
    hpBg: hb.bg, hpFg: hb.fg, hpW: hb.w, flies: false, flyH: 0,
    alive: true, respawnT: 0, spawnT: 8, raidT: rand(110, 160), warned: false, enraged: false,
  };
  game.colonies.push(col);
  return col;
}
function buildColonies() {
  for (const def of ENEMY_COLONY_DEFS) {
    const col = spawnColony(def);
    for (let i = 0; i < def.cap; i++) spawnEnemyUnit(col, def.boss && i === 0 ? "boss" : "guard");
  }
}
function colonyUnits(col) { return game.enemies.filter((e) => e.colony === col && !e.dying); }
function spawnEnemyUnit(col, roleKey) {
  const def = col.def;
  const rk = roleKey === "guard" && def.key === "red" ? "redguard" : roleKey === "raider" && def.key === "red" ? "redraider" : roleKey;
  const r = ENEMY_ROLES[rk] || ENEMY_ROLES.guard;
  // نخبة الفصيل الأحمر بالموديل الحقيقي (GLB) — وإن لم يتحمل بعد، الإجرائي الاحتياطي
  const ant = ((def.key === "red" && (rk === "redguard" || rk === "redraider" || rk === "boss")) && createRedAntGLB(r.scale))
    || createAnt({ body: def.color, dark: def.dark, scale: r.scale, model: "soldier", jaw: 1.2 });
  const a = rand(0, Math.PI * 2);
  const sx = THREE.MathUtils.clamp(col.x + Math.sin(a) * 6, -TUNE.worldHalf, TUNE.worldHalf);
  const sz = THREE.MathUtils.clamp(col.z + Math.cos(a) * 6, -TUNE.worldHalf, TUNE.worldHalf);
  ant.group.position.set(sx, groundY(sx, sz), sz);
  ant.group.scale.setScalar(0.2);
  scene.add(ant.group);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.28, 24),
    new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  ant.group.add(ring);
  if (rk === "boss") {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.7, 26),
      new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.06;
    ant.group.add(halo);
  }
  const e = {
    uid: nextUid(), ant, kind: "enemy", role: rk, colony: col,
    name: rk === "boss" ? "الملكة الحمراء" : def.name, icon: rk === "boss" ? "👑" : def.icon,
    dmg: r.dmg, def: r.def, spd: r.spd, hp: r.hp, maxHp: r.hp,
    x: sx, z: sz, yaw: a, vx: 0, vz: 0, atkCd: 0, tx: sx, tz: sz, waitT: 0,
    emergeT: 0, baseScale: r.scale, state: "guard", target: null, loot: 0, stealT: 0,
    dying: false, dieT: 0, selRing: null,
    hpBg: null, hpFg: null, hpW: 1.6, flies: false, flyH: 0, hitFlash: 0,
  };
  const hb = addHpBar(ant.group, 1.6 * r.scale, 0);
  e.hpBg = hb.bg; e.hpFg = hb.fg; e.hpBg.visible = e.hpFg.visible = false;
  // 🌊 تقوية حامية الموجات: صحة وضرر حسب مضاعف المستعمرة
  if (col.dmgK && col.dmgK > 1) {
    e.hp = e.maxHp = Math.round(e.hp * col.dmgK);
    e.dmg = Math.round(e.dmg * (1 + (col.dmgK - 1) * 0.7));
  }
  // 😌⚔️🔥 طور الصعوبة: تقوية/تضعيف حامية المستعمرات
  { const D = diffDef(); e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * D.ehp)); e.dmg = Math.max(1, Math.round(e.dmg * D.edmg)); }
  game.enemies.push(e);
  return e;
}
function removeEnemy(e) {
  try { scene.remove(e.ant.group); } catch {}
  if (e.hpBg) scene.remove(e.hpBg);
  if (e.hpFg) scene.remove(e.hpFg);
  const i = game.enemies.indexOf(e);
  if (i >= 0) game.enemies.splice(i, 1);
}
function killEnemy(e) {
  if (e.dying) return;
  e.dying = true;
  e.dieT = 0;
  e.ant.fightT = 0;
  spawnBurst(e.x, 0.8, e.z, 0x881111, 20, 4, 5);
  sfx.die();
  // غنيمة: +2🍯 ومن كان يحمل مسروقات يسقطها طعاماً
  game.store += 2;
  spawnDmgNum(e.x, 1.6, e.z, "+2🍯", "#ffd93d");
  if (Math.random() < 0.3) spawnFood(e.x + rand(-1.5, 1.5), e.z + rand(-1.5, 1.5), Math.random() < 0.5 ? "pollen" : "crystal");
  if (e.loot > 0) {
    const n = Math.min(3, e.loot);
    for (let i = 0; i < n; i++) { try { spawnFood(e.x + rand(-1.5, 1.5), e.z + rand(-1.5, 1.5), "crumb"); } catch {} }
    if (e.state === "steal" || e.state === "return") toast("🎉 غنائم مستردة!");
  }
  game.stats.kills = (game.stats.kills || 0) + 1;
  addXP(3);
  updateHUD();
}
function destroyColony(col, silent) {
  if (!col.alive) return;
  col.alive = false;
  col.respawnT = 240;
  col.hp = 0;
  if (silent) { try { col.group.visible = false; if (col.banner) col.banner.visible = false; } catch {} return; }
  spawnBurst(col.x, 2, col.z, 0xff8833, 40, 7, 8);
  spawnBurst(col.x, 2, col.z, 0xffd93d, 30, 6, 7);
  game.shake = 1.2;
  sfx.level();
  setTimeout(() => sfx.level(), 300);
  // الحامية تهرب، والزعيمة تموت
  for (const e of [...game.enemies]) {
    if (e.colony !== col || e.dying) continue;
    if (e.role === "boss") { killEnemy(e); continue; }
    e.state = "flee";
    e.fleeT = 8;
    e.dying = false;
  }
  // رماد: سوّد التل
  try {
    col.group.traverse((o) => {
      if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.setHex(0x3a3a3a); }
    });
  } catch {}
  if (col.banner) col.banner.visible = false;
  // الغنائم (بمعامل الطور السهل)
  game.store += Math.round(col.def.loot * diffDef().lootK);
  game.flags[col.def.key + "Down"] = true;
  addXP(15);
  for (let i = 0; i < (col.def.lootFood || 3); i++) {
    try { spawnFood(col.x + rand(-4, 4), col.z + rand(-4, 4)); } catch {}
  }
  if (col.def.boss) centerMsg(`👑 سقطت المستعمر الحمراء! +${col.def.loot}🍯`);
  else centerMsg(`${col.icon} دُمّرت ${col.name}! +${col.def.loot}🍯`);
  toast(`🎉 غنائم الحرب: +${col.def.loot} 🍯 وطعام!`);
  updateHUD();
  saveGame();
  checkVictory();
  // 🌊 بعد النصر: تدمير المستعمرتين معاً = سحق موجة كاملة
  if (game.victory && (game.wave || 0) > 0 && game.colonies.length && game.colonies.every((c) => !c.alive)) waveCleared();
}
function rebuildColony(col) {
  // 🌊 بعد النصر تُعاد المستعمرات أقوى كل موجة: صحة ×(1+0.5×(موجة−1))
  if (game.victory && !(game.wave > 0)) return; // قبل بدء الموجات: مدمرتان للأبد
  const k = game.victory ? waveK(game.wave) : 1;
  const D = diffDef();
  try {
    scene.remove(col.group);
    if (col.hpBg) scene.remove(col.hpBg);
    if (col.hpFg) scene.remove(col.hpFg);
  } catch {}
  const built = buildEnemyMound(col.def);
  const hb = addHpBar(built.group, 4.5, 7.6);
  col.group = built.group;
  col.banner = built.banner;
  col.hpBg = hb.bg; col.hpFg = hb.fg;
  col.maxHp = Math.round(col.def.hp * k * D.ehp);
  col.hp = col.maxHp;
  col.dmgK = k; // مضاعف ضرر/صحة الحامية لهذه الموجة
  col.alive = true;
  col.enraged = false;
  col.spawnT = 5;
  col.raidT = Math.round(rand(100, 150) * diffDef().raidTimeK);
  for (let i = 0; i < col.def.cap; i++) spawnEnemyUnit(col, col.def.boss && i === 0 ? "boss" : "guard");
  if (game.victory) {
    centerMsg(`🌊 الموجة ${game.wave}: ${col.icon} ${col.name} عادت أقوى (+${Math.round((k - 1) * 100)}%)!`);
    sfx.alarm();
  } else {
    toast(`⚠️ ${col.icon} ${col.name} عادت للحرب!`);
    sfx.hit();
  }
}
// أقرب وحدة للاعب (لذكاء العدو)
function nearestPlayerUnit(x, z, r) {
  let best = null, bd = r;
  const P = game.player;
  if (!game.underground) {
    const d = Math.hypot(P.x - x, P.z - z);
    if (d < bd) { bd = d; best = P; }
  }
  for (const u of [...game.workers, ...game.scouts, ...game.soldiers, ...game.allies]) {
    if (u.inClinic || u.inTraining) continue;
    if (u.kind === "soldier" && u.dying) continue;
    if (u.inTraining) continue;
    if ((u.kind === "worker" || u.kind === "scout") && (u.state === "inside" || u.state === "leaving")) continue;
    const d = Math.hypot(u.x - x, u.z - z);
    if (d < bd) { bd = d; best = u; }
  }
  return best ? { u: best, d: bd } : null;
}
function hurtUnit(u, dmg, from) {
  if (!u) return;
  if (u.inClinic || u.inTraining) return;
  if (u === game.player) { hurtPlayer(dmg, u.x, u.z); return; }
  if (u.kind === "soldier") { hitSoldier(u, dmg, from); return; }
  if (u.kind === "ally") { hurtAlly(u, dmg, from); return; }
  hitWorker(u, dmg, from);
}
// ---------- محاكاة العدو والمعارك ----------
function raidFullReady() {
  // الغارات الكاملة مسموحة من المستوى (raidLevel حسب الطور: 6 للمبتدئ و4 للبقية)، أو عند امتلاك أي جندي / مركز تدريب
  if ((game.level || 1) >= (diffDef().raidLevel || 4)) return true;
  try { if (game.soldiers.some((s) => !s.dying)) return true; } catch {}
  try { if (Nest.trainLevel() > 0) return true; } catch {}
  return false;
}
function launchRaid(col) {
  // وقت هدوء عام بين الغارات + سقف للمهاجمين النشطين
  if ((game.raidCd || 0) > 0) return false;
  const active = game.enemies.filter((e) => !e.dying && (e.state === "raid" || e.state === "steal" || e.state === "return")).length;
  if (active >= 5) return false;
  const guards = colonyUnits(col).filter((e) => e.role !== "boss" && e.state === "guard");
  if (!guards.length) return false;
  // 🥷 أول غارة تحذيرية: سارق واحد فقط + تعليم الاحتماء — بلا دفاع سابق
  if (!game.flags.warnRaid) {
    game.flags.warnRaid = true;
    guards[0].state = "raid";
    guards[0].loot = 0;
    game.raidCd = Math.round(150 * diffDef().raidTimeK);
    // 🛡️ استنفار: بلا جنود — العمال يدافعون عن العش مؤقتاً
    game.militiaT = 110;
    centerMsg(`🥷 كشاف من ${col.name} يتسلل نحو مخزنك!`);
    toast("🛡️ استنفار! عمالك يدافعون مؤقتاً — حدد البقية وانقر التل لإدخالهم! وللحل الدائم: ادخل العش 🏠 واحفر غرفة ثكنة الجنود ⚔️ ثم اضبط بيض الملكة 👑 على الجنود");
    try { pingLater("nt_raid", 15, 3); } catch {} // 📢 غارة — نبّه حتى لو أغلق اللعبة بعد التحذير
    sfx.alarm();
    try { saveGame(); } catch {}
    return true;
  }
  if (!raidFullReady()) return false; // بانتظار المستوى 4 أو أول جندي
  // 🌊 غارات الموجات: مهاجم إضافي كل موجتين + معامل الطور
  const n = Math.max(1, Math.min((col.def.raidN || 2) + Math.floor((game.wave || 0) / 2) + diffDef().raidN, guards.length));
  for (let i = 0; i < n; i++) {
    guards[i].state = "raid";
    guards[i].loot = 0;
  }
  game.raidCd = Math.round(150 * diffDef().raidTimeK);
  centerMsg(`🚨 غارة من ${col.name}! دافع عن العش!`);
  sfx.alarm();
  // بلا جنود أحياء (ماتوا كلهم) — استنفار العمال مؤقتاً
  try {
    if (!game.soldiers.some((s) => !s.dying)) {
      game.militiaT = 100;
      toast("🛡️ استنفار! عمالك يدافعون عن العش حتى تبني جيشاً!");
    }
  } catch {}
  toast("⏳ هدوء مؤقت — الغارة القادمة بعد ~دقيقتين ونصف على الأقل");
  return true;
}
// ---------- العالم الثاني: بناء الشجرة العتيقة + الخشبة والبوابة 🌳 ----------
let treeGateRing = null, treeBackRing = null, gateBeam = null, backBeam = null, guideArrow = null;
let gateLabel = null, backLabel = null; // لافتتا العبور العائمتان
// رقعة أرضية عضوية: قطع ناقص + بقع حافة مكسّرة + تباين داخلي — بلا حواف حادة
function organicPatch(cx, cz, rx, rz, color, opt = {}) {
  const grp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  base.rotation.x = -Math.PI / 2;
  base.scale.set(rx, rz, 1);
  base.position.set(cx, 0.02, cz);
  base.receiveShadow = true;
  grp.add(base);
  const c = new THREE.Color(color);
  const n = opt.edge == null ? 16 : opt.edge;
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + rand(-0.2, 0.2);
    const er = rand(0.84, 1.0);
    const bx = cx + Math.cos(a) * rx * er, bz = cz + Math.sin(a) * rz * er;
    const br = rand(Math.min(rx, rz) * 0.08, Math.min(rx, rz) * 0.2);
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(br, 14),
      new THREE.MeshStandardMaterial({ color: c.clone().offsetHSL(rand(-0.015, 0.015), rand(-0.03, 0.03), rand(-0.035, 0.035)).getHex(), roughness: 1 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(bx, 0.024 + (i % 3) * 0.004, bz);
    m.receiveShadow = true;
    grp.add(m);
  }
  for (let i = 0; i < (opt.inner == null ? 6 : opt.inner); i++) {
    const a = rand(0, Math.PI * 2), rr = rand(0.1, 0.7);
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(rand(1.5, 4.5), 12),
      new THREE.MeshStandardMaterial({ color: c.clone().offsetHSL(0, 0, (i % 2 ? -1 : 1) * rand(0.02, 0.05)).getHex(), roughness: 1 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx + Math.cos(a) * rx * rr, 0.026, cz + Math.sin(a) * rz * rr);
    m.receiveShadow = true;
    grp.add(m);
  }
  scene.add(grp);
  return grp;
}
// لافتة عائمة (نص عربي على شريط) — للبوابات والمعالم
function makeTextSprite(text, scale = 1, fg = "#ffd93d") {
  const fs = 46, pad = 26;
  const cv = document.createElement("canvas");
  let cx = cv.getContext("2d");
  cx.font = `bold ${fs}px Cairo, Tahoma, Arial, sans-serif`;
  const w = Math.ceil(cx.measureText(text).width);
  cv.width = Math.max(2, w + pad * 2); cv.height = fs + pad * 2;
  cx = cv.getContext("2d");
  cx.fillStyle = "rgba(18,10,3,0.74)";
  const r = 26;
  cx.beginPath();
  cx.moveTo(r, 2);
  cx.lineTo(cv.width - r, 2); cx.quadraticCurveTo(cv.width - 2, 2, cv.width - 2, r);
  cx.lineTo(cv.width - 2, cv.height - r); cx.quadraticCurveTo(cv.width - 2, cv.height - 2, cv.width - r, cv.height - 2);
  cx.lineTo(r, cv.height - 2); cx.quadraticCurveTo(2, cv.height - 2, 2, cv.height - r);
  cx.lineTo(2, r); cx.quadraticCurveTo(2, 2, r, 2);
  cx.fill();
  cx.strokeStyle = "rgba(255,217,61,0.85)"; cx.lineWidth = 3; cx.stroke();
  cx.font = `bold ${fs}px Cairo, Tahoma, Arial, sans-serif`;
  cx.fillStyle = fg; cx.textAlign = "center"; cx.textBaseline = "middle";
  try { cx.direction = "rtl"; } catch {}
  cx.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  try { tex.colorSpace = THREE.SRGBColorSpace; } catch {}
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set((cv.width / 52) * scale, (cv.height / 52) * scale, 1);
  return sp;
}
function buildTreeZone() {
  // أرضية الجيب: رقعة ترابية عضوية بلا حواف حادة (كانت مستطيلاً مشوهاً)
  organicPatch(TREE.cx, TREE.cz, 75, 61, 0x6b4e30, { edge: 20, inner: 9 });
  for (let i = 0; i < 14; i++) {
    const p = treeRandPos();
    const r = rand(0.25, 0.6);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: 0x7d7d85, roughness: 1, flatShading: true }));
    rock.position.set(p.x, r * 0.4, p.z);
    rock.scale.y = 0.7;
    rock.castShadow = true;
    scene.add(rock);
  }
  // الجذع العملاق + التاج + الجذور
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 1 });
  const trunkMat2 = new THREE.MeshStandardMaterial({ color: 0x54331c, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 34, 12), trunkMat);
  trunk.position.set(TREE.treeX, 17, TREE.treeZ);
  trunk.castShadow = trunk.receiveShadow = true;
  scene.add(trunk);
  game.colliders.push({ x: TREE.treeX, z: TREE.treeZ, r: 14 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const root = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7, 6), trunkMat2);
    root.position.set(TREE.treeX + Math.sin(a) * 13, 1.6, TREE.treeZ + Math.cos(a) * 13);
    root.rotation.set(Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7);
    root.castShadow = true;
    scene.add(root);
  }
  const leafMats = [0x2f6b2a, 0x3f8a34, 0x4da33a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
  const canopy = [[0, 36, 0, 13], [-11, 31, 3, 9], [10, 32, -4, 10], [2, 40, 1, 8]];
  canopy.forEach(([ox, oy, oz, r], i) => {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMats[i % leafMats.length]);
    f.position.set(TREE.treeX + ox, oy, TREE.treeZ + oz);
    f.castShadow = true;
    scene.add(f);
  });
  // عناقيد كهرمان على الجذع (زينة + تلميح للمورد)
  for (let i = 0; i < 7; i++) {
    const a = rand(0, Math.PI * 2), rr = 13.2;
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.5, 0.9)), new THREE.MeshStandardMaterial({ color: 0xff9f1a, emissive: 0x8a4a00, roughness: 0.25 }));
    cr.position.set(TREE.treeX + Math.sin(a) * rr, rand(2, 12), TREE.treeZ + Math.cos(a) * rr);
    scene.add(cr);
  }
  // 🪵 الخشبة في الغابة (معبر العالم الثاني)
  {
    const g = new THREE.Group();
    const logMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
    const log = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 9, 9), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.5;
    log.position.y = 1.1;
    log.castShadow = log.receiveShadow = true;
    g.add(log);
    for (let i = -1; i <= 1; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.09, 6, 14), new THREE.MeshStandardMaterial({ color: 0x54331c, roughness: 1 }));
      ring.position.y = 1.1;
      ring.position.x = i * 3;
      ring.rotation.y = Math.PI / 2 + 0.5;
      g.add(ring);
    }
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.0, 12), new THREE.MeshBasicMaterial({ color: 0x1a0f05 }));
    hole.position.set(4.4, 1.1, 0.6);
    hole.rotation.y = Math.PI / 2 + 0.5;
    g.add(hole);
    g.position.set(-64, 0, -56);
    scene.add(g);
    game.colliders.push({ x: -64, z: -56, r: 2.4 });
  }
  // حلقتا العبور (توهج نابض)
  const mkRing = (x, z) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.7, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.12, z);
    scene.add(m);
    return m;
  };
  treeGateRing = mkRing(TREE.gateX, TREE.gateZ);
  treeBackRing = mkRing(TREE.backX, TREE.backZ);
  // عمودا نور فوق البوابتين — يُريان من بعيد في الغابة والشجرة
  const mkBeam = (x, z) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.4, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.position.set(x, 35, z);
    scene.add(m);
    return m;
  };
  gateBeam = mkBeam(TREE.gateX, TREE.gateZ);
  backBeam = mkBeam(TREE.backX, TREE.backZ);
  // لافتتا العبور العائمتان: اضغط البوابة/الخشبة أو اللافتة للدخول
  try {
    gateLabel = makeTextSprite("🌳 دخول لعالم النمل الأبيض");
    gateLabel.position.set(TREE.gateX, 8, TREE.gateZ);
    scene.add(gateLabel);
    backLabel = makeTextSprite("🌿 عودة لعالم المرج");
    backLabel.position.set(TREE.backX, 8, TREE.backZ);
    scene.add(backLabel);
  } catch (e) { console.warn("[gate] label failed", e); }
  // ذباب ناري للجو الغامض
  game.treeFlies = [];
  const flyMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  for (let i = 0; i < 12; i++) {
    const p = treeRandPos();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), flyMat);
    m.position.set(p.x, rand(1, 4), p.z);
    scene.add(m);
    game.treeFlies.push({ m, ph: rand(0, 6.28), x: p.x, z: p.z });
  }
  // تل النمل الأبيض + سكانه الأوائل + كهرمان أولي
  buildTermiteMound();
  for (let i = 0; i < 4; i++) spawnCreature("termite");
  const spots = [[-20, -200], [18, -210], [-8, -232], [25, -190]];
  for (const [sx, sz] of spots) {
    try { spawnNode(sx + rand(-2, 2), sz + rand(-2, 2), "amber"); } catch {}
  }
}
// تل النمل الأبيض: يفرّخ نملاً حتى تدمره (غنائم كهرمان)
function buildTermiteMound() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 12, 9),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.95 })
  );
  m.scale.set(1, 0.62, 1);
  m.position.y = 0.4;
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), new THREE.MeshBasicMaterial({ color: 0x2a1c10 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(0, 2.12, 0.5);
  g.add(hole);
  g.position.set(TREE.moundX, 0, TREE.moundZ);
  scene.add(g);
  const hb = addHpBar(g, 5, 5.4);
  game.termiteMound = {
    isMound: true, key: "mound", name: "تل النمل الأبيض", icon: "🤍",
    x: TREE.moundX, z: TREE.moundZ, hp: 300, maxHp: 300,
    alive: true, group: g, hpBg: hb.bg, hpFg: hb.fg, hpW: hb.w,
    spawnT: 6, respawnT: 0,
  };
}
function destroyTermiteMound(mo) {
  if (!mo.alive) return;
  mo.alive = false;
  mo.respawnT = 240;
  try { mo.group.visible = false; mo.hpBg.visible = mo.hpFg.visible = false; } catch {}
  spawnBurst(mo.x, 2, mo.z, 0xf2e6c8, 30, 5, 6);
  spawnBurst(mo.x, 2, mo.z, 0xff9f1a, 25, 5, 6);
  for (let i = 0; i < 6; i++) {
    try { spawnFood(mo.x + rand(-5, 5), mo.z + rand(-5, 5), "amber"); } catch {}
  }
  game.store += 25;
  game.stats.kills = (game.stats.kills || 0) + 1;
  addXP(10);
  sfx.level();
  game.shake = Math.max(game.shake, 0.9);
  centerMsg("🤍 دُمّر تل النمل الأبيض! +25🍯 وكهرمان!");
  toast("🧡 غنائم: كهرمان متناثر حول التل — اجمعه!");
  saveGame();
  updateHUD();
}
function rebuildTermiteMound() {
  const mo = game.termiteMound;
  if (!mo || mo.alive) return;
  try { mo.group.visible = true; } catch {}
  mo.hp = mo.maxHp;
  mo.alive = true;
  mo.spawnT = 8;
  toast("🤍 تل أبيض جديد نما في الشجرة العتيقة!");
  sfx.hit();
}
// 🚪 عبور الوحدات بأمر صريح فقط: وحدة سطحية أُمرت (تحرك/جمع) لنقطة قرب بوابة جهتها تعبر للجهة الثانية عند وصولها — الكاميرا لا تتحرك أبداً
function gateCrossTick(dt) {
  game._gateCrossT = Math.max(0, (game._gateCrossT || 0) - (dt || 0.016));
  const all = [...game.workers, ...game.scouts, ...game.soldiers, ...game.allies];
  for (const u of all) {
    try {
      if (!u || u.inside || u.state === "inside" || u.inClinic || u.inTraining || u.dying) continue;
      const o = u.order;
      if (!o || (o.t !== "move" && o.t !== "gather")) continue;
      let tx = null, tz = null;
      if (o.t === "move" && o.x != null) { tx = o.x; tz = o.z; }
      else if (o.t === "gather" && o.target && o.target.x != null) { tx = o.target.x; tz = o.target.z; }
      if (tx == null) continue;
      const gx = u.treeZone ? TREE.backX : TREE.gateX;
      const gz = u.treeZone ? TREE.backZ : TREE.gateZ;
      if (Math.hypot(tx - gx, tz - gz) > 10) continue; // الأمر ليس للبوابة — تجوال عادي قربها لا يعبر
      if (Math.hypot(u.x - gx, u.z - gz) > 3.5) continue; // لم يصل بعد
      const toTree = !u.treeZone;
      u.treeZone = toTree;
      const nx = (toTree ? TREE.backX : TREE.gateX) + rand(-2, 2);
      const nz = (toTree ? TREE.backZ : TREE.gateZ) + rand(-2, 2) + 3;
      u.x = nx; u.z = nz; u.tx = nx; u.tz = nz;
      u.target = null;
      u.order = { t: "hold" };
      if ((game._gateCrossT || 0) <= 0) {
        game._gateCrossT = 8;
        toast(toTree ? "🌳 عبرت وحدة لعالم النمل الأبيض بأمرك!" : "🌿 عادت وحدة من عالم النمل الأبيض بأمرك!");
      }
    } catch {}
  }
}
// عبور البوابة: أنت + المحددون النشطون فقط
function moveFollowers(toTree) {
  let n = 0;
  const all = [...game.workers, ...game.scouts, ...game.soldiers, ...game.allies];
  for (const u of all) {
    if (!army.sel.has(u)) continue;
    if (u.inside || u.inClinic || u.inTraining || u.dying) continue;
    u.treeZone = toTree;
    u.x = game.player.x + rand(-3, 3);
    u.z = game.player.z + rand(-3, 3);
    u.tx = u.x; u.tz = u.z;
    u.order = { t: "hold" };
    n++;
  }
  if (n) toast(`🐜 عبرت معك ${n} وحدة!`);
  return n;
}
async function treeTransit(toTree) {  if (game._gateCd > 0 || game.underground) return;
  game._gateCd = 2.5;
  await fadeTo(true);
  const P = game.player;
  P.vx = P.vz = 0;
  if (toTree) {
    game.treeZone = true;
    P.x = TREE.backX + rand(-2, 2);
    P.z = TREE.backZ + 5;
    moveFollowers(true);
    centerMsg("🌳 الشجرة العتيقة — عالم الكهرمان", 2200);
    toast("🧡 اجمع الكهرمان من أجزاء الشجرة — واحذر النمل الأبيض!");
    // 🗺️ خطة أم 44 للمبتدئ: جيش مطور + رماية + دعسوقة متقدمة
    if (game.soldiers.filter((s) => !s.dying).length < 3 || !archeryLevel()) {
      setTimeout(() => { try { toast("⚔️ خطة أم 44: 🪲 قدّم الدعسوقة لتلقي الضرب + 🏹 الرماة يُخدّرونها ويُبطئونها + ⚔️ اهجم بجنود مطورين!"); } catch {} }, 2500);
    }
  } else {
    game.treeZone = false;
    P.x = TREE.gateX + rand(-2, 2);
    P.z = TREE.gateZ + 4;
    moveFollowers(false);
    toast("🪵 عدت إلى الغابة");
  }
  try {
    camera.position.set(P.x, input.camDist * 0.85, P.z + input.camDist * 0.62);
    camera.lookAt(P.x, 0.8, P.z);
  } catch {}
  saveGame();
  await fadeTo(false);
}
// سهم ذهبي فوق اللاعب يُرشد للبوابة/التل الأبيض (يظهر عند الحاجة فقط)
function guideTick(t) {
  try {
    if (!scene || !game.started || game.underground || !game.player) { if (guideArrow) guideArrow.visible = false; return; }
    let tx = null, tz = null;
    if (game.treeZone) {
      const mo = game.termiteMound;
      if (mo && mo.alive) { tx = mo.x; tz = mo.z; }
      else { tx = TREE.backX; tz = TREE.backZ; }
    } else if (game.regions && game.regions.forest && !game.regions.tree) {
      const inForest = regionAt(camFocusX(), camFocusZ()).id === "forest";
      if (inForest || performance.now() < (game._guideUntil || 0)) { tx = TREE.gateX; tz = TREE.gateZ; }
    }
    if (tx === null) { if (guideArrow) guideArrow.visible = false; return; }
    const fx = camFocusX(), fz = camFocusZ();
    if (Math.hypot(tx - fx, tz - fz) < 7) { if (guideArrow) guideArrow.visible = false; return; }
    if (!guideArrow) {
      guideArrow = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 10), new THREE.MeshBasicMaterial({ color: 0xffd93d }));
      cone.rotation.x = Math.PI / 2;
      cone.position.z = 2.4;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 22), new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      guideArrow.add(cone); guideArrow.add(ring);
      scene.add(guideArrow);
    }
    guideArrow.visible = true;
    guideArrow.position.set(fx, 6.2 + Math.sin(t * 4) * 0.5, fz);
    guideArrow.lookAt(tx, 6.2, tz);
  } catch { /* تجاهل */ }
}
// نبض البوابات + التل + الذباب + كشف العبور — كل إطار
function treeTick(dt, t) {
  if (game._gateCd > 0) game._gateCd -= dt;
  for (const r of [treeGateRing, treeBackRing]) {
    if (!r) continue;
    try {
      const s = 1 + Math.sin(t * 1.5) * 0.05;
      r.scale.set(s, s, 1);
      r.material.opacity = 0.6 + Math.sin(t * 1.5) * 0.12;
    } catch {}
  }
  for (const b of [gateBeam, backBeam]) {
    if (!b) continue;
    try { b.material.opacity = 0.13 + Math.sin(t * 1.5) * 0.03; } catch {}
  }
  // طفو اللافتتين (توهج نابض خفيف)
  for (const lb of [gateLabel, backLabel]) {
    if (!lb) continue;
    try {
      lb.position.y = 8 + Math.sin(t * 1.6) * 0.5;
      lb.material.opacity = 0.88 + Math.sin(t * 1.6) * 0.12;
    } catch {}
  }
  guideTick(t);
  if (game.treeFlies) {
    for (const f of game.treeFlies) {
      try {
        f.m.position.x = f.x + Math.sin(t * 0.9 + f.ph) * 2;
        f.m.position.z = f.z + Math.cos(t * 0.7 + f.ph) * 2;
        f.m.position.y = 2 + Math.sin(t * 1.3 + f.ph) * 1.2;
      } catch {}
    }
  }
  // 🚪 العبور بأمر صريح فقط: الكاميرا لا تُسحب أبداً لوحدها — حدد وحداتك وانقر قرب البوابة فيذهبون ويعبرون بأمرك، أو انقر الحلقة لتدخل بنفسك
  if (game.started && !game.paused && !game.underground && (game._gateCd || 0) <= 0) {
    gateCrossTick(dt);
    if (!game.treeZone && !game._gateHint && Math.hypot(camFocusX() - TREE.gateX, camFocusZ() - TREE.gateZ) < 26) {
      game._gateHint = true;
      toast("🪵 خشبة غريبة... انقر الحلقة الذهبية للدخول بنفسك — أو حدد نملك وانقر قرب البوابة ليدخلوا بأمرك!");
    }
  }
  // 🪲 خنفساء الحصار: زعيم حصار لنهاية اللعب فقط — تظهر بعد إسقاط أول مستعمرة (إثبات القوة) ومن المستوى 8
  const siegeReady = (game.level || 1) >= 8 && !!(game.flags.shadowDown || game.flags.redDown);
  if (game.started && !game.paused && siegeReady) {
    game.siegeT = Math.max(0, (game.siegeT == null ? 200 : game.siegeT) - dt);
    const liveSiege = game.creatures.some((c) => c.key === "siege");
    if (!liveSiege && game.siegeT <= 0) {
      try {
        const a = rand(0, Math.PI * 2), R = TUNE.worldHalf - 18;
        const c = spawnCreature("siege", Math.cos(a) * R, Math.sin(a) * R);
        if (c) {
          game.siegeT = 360;
          c.siegeT = 150; c.stolen = 0; // ⏳ الحصار لا يدوم: تنسحب بعد 150ث أو بعدما تشبع
          centerMsg("🪲 خنفساء الحصار تزحف نحو عشك! 🏹 الرماة يُبطئونها — ركّز جيشك عليها");
          sfx.alarm();
        } else game.siegeT = 60;
      } catch { game.siegeT = 60; }
    }
  }
  // أم 44: زعيم متجول في عالم النمل الأبيض — واحد فقط، يعاود الظهور كل 4 دقائق
  if (game.started && !game.paused) {
    game.centiT = Math.max(0, (game.centiT || 0) - dt);
    const liveCenti = game.creatures.some((c) => c.key === "centipede");
    if (!liveCenti && game.centiT <= 0 && (game.regions || {}).tree) {
      try {
        const p = treeRandPos();
        spawnCreature("centipede", p.x, p.z);
        game.centiT = 240;
        if (!game.stats.centiKills) centerMsg("🐛 أم أربعة وأربعين ظهرت! اقتلها وخذ عظامها 🦴");
        else toast("🐛 أم أربعة وأربعين عادت للظهور!");
      } catch {}
    }
  }
  // التل: تفريخ + إعادة بناء
  const mo = game.termiteMound;
  if (!mo) return;
  if (!mo.alive) {
    mo.respawnT -= dt;
    if (mo.respawnT <= 0) rebuildTermiteMound();
    return;
  }
  showCreatureHp(mo, 0, mo.hp < mo.maxHp);
  mo.spawnT -= dt;
  if (mo.spawnT <= 0) {
    mo.spawnT = 14;
    const n = game.creatures.filter((c) => c.key === "termite").length;
    if (n < 6) {
      try { spawnCreature("termite", mo.x + rand(-4, 4), mo.z + rand(-4, 4)); } catch {}
    }
  }
}
function updateEnemies(dt, t) {
  const P = game.player;
  for (const col of game.colonies) {
    if (!col.alive) {
      if (game.victory) continue; // مدمرة للأبد بعد النصر
      col.respawnT -= dt;
      if (col.respawnT <= 0) rebuildColony(col);
      continue;
    }
    // شريط صحة المستعمر
    showCreatureHp(col, 0, col.hp < col.maxHp);
    if (col.banner) col.banner.rotation.y = Math.sin(t * 2) * 0.2;
    // تعزيز الحامية
    col.spawnT -= dt;
    if (col.spawnT <= 0) {
      col.spawnT = 20;
      if (colonyUnits(col).length < col.def.cap) {
        const e = spawnEnemyUnit(col, "guard");
        spawnBurst(col.x, 1, col.z, 0xff2222, 10, 3, 3);
      }
    }
    // الغارات على مخازن اللاعب: الأولى تحذيرية (سارق واحد)، والكاملة بعد الجاهزية
    col.raidT -= dt;
    if (col.raidT <= 0) {
      // 🌊 الموجات تتسارع: غارات أسرع كل موجة (حتى −55%) + معامل الطور
      const waveFast = game.victory ? Math.max(0.45, 1 - 0.1 * (game.wave || 1)) : 1;
      col.raidT = (col.def.raidEvery + rand(0, 20)) * waveFast * diffDef().raidTimeK;
      if ((game.raidCd || 0) > 0 || (game.level || 1) < 3) col.raidT = Math.min(col.raidT, 20);
      else if (!game.flags.warnRaid) launchRaid(col);
      else if (raidFullReady()) launchRaid(col);
      else col.raidT = 20; // بانتظار أول جندي/المستوى 4 — إعادة المحاولة قريباً
    }
    // معركة الحمراء الخاصة: هياج عند نصف الصحة
    if (col.def.boss && !col.enraged && col.hp < col.maxHp * 0.5) {
      col.enraged = true;
      const boss = game.enemies.find((e) => e.colony === col && e.role === "boss" && !e.dying);
      if (boss) { boss.dmg += 8; spawnBurst(boss.x, 1, boss.z, 0xff2222, 25, 4, 5); }
      for (let i = 0; i < 3; i++) spawnEnemyUnit(col, "redguard");
      centerMsg("👹 الملكة الحمراء غاضبة! تعزيزات!");
      sfx.hit();
    }
    if (!col.warned && col.hp < col.maxHp) {
      col.warned = true;
      if (col.def.boss) centerMsg("⚔️ معركة المستعمر الحمراء بدأت!");
    }
  }
  // --- وحدات العدو ---
  for (const e of [...game.enemies]) {
    e.atkCd -= dt;
    // أنيميشن الموت: سقوط + غوص ثم إزالة
    if (e.dying) {
      e.dieT += dt;
      const k = Math.min(1, e.dieT / 0.45);
      e.ant.group.rotation.z = k * 1.5;
      if (e.dieT > 0.5) e.ant.group.position.y = groundY(e.x, e.z) - (e.dieT - 0.5) * 1.6;
      e.ant.update(dt, 0, t + 5);
      if (e.dieT > 1.3) removeEnemy(e);
      continue;
    }
    if (e.emergeT < 1) {
      e.emergeT = Math.min(1, e.emergeT + dt * 1.1);
      e.ant.group.scale.setScalar(Math.max(0.05, e.baseScale * (0.25 + 0.75 * e.emergeT)));
    }
    const col = e.colony;
    const homeD = col ? Math.hypot(e.x - col.x, e.z - col.z) : 0;
    let mvx = 0, mvz = 0, moving = false;
    if (e.state === "flee") {
      // هروب بعد تدمير المستعمر
      e.fleeT -= dt;
      const a = Math.atan2(e.x - (col ? col.x : 0), e.z - (col ? col.z : 0));
      mvx = Math.sin(a) * (e.spd + 2); mvz = Math.cos(a) * (e.spd + 2);
      moving = true;
      if (e.fleeT <= 0) { removeEnemy(e); continue; }
    } else if (e.state === "raid" || e.state === "steal" || e.state === "return") {
      if (e.state === "raid") {
        const d = Math.hypot(HOLE.x - e.x, HOLE.z - e.z);
        const nu = nearestPlayerUnit(e.x, e.z, 2.6);
        if (nu && e.atkCd <= 0) {
          e.atkCd = 1.1;
          e.ant.fightT = 0.35;
          hurtUnit(nu.u, e.dmg, e);
        } else if (d < 2.5) {
          e.state = "steal";
          e.stealT = 0;
        } else {
          mvx = ((HOLE.x - e.x) / d) * e.spd; mvz = ((HOLE.z - e.z) / d) * e.spd;
          moving = true;
        }
      } else if (e.state === "steal") {
        e.stealT += dt;
        const nu = nearestPlayerUnit(e.x, e.z, 2.2);
        if (nu && e.atkCd <= 0) {
          e.atkCd = 1.1;
          e.ant.fightT = 0.35;
          hurtUnit(nu.u, e.dmg, e);
        }
        if (e.stealT >= 2) {
          e.stealT = 0;
          if (game.store > 0 && e.loot < 6) {
            game.store -= 1;
            e.loot += 1;
            updateHUD();
            spawnBurst(HOLE.x, 1.5, HOLE.z, 0xffd93d, 4, 1.5, 2);
          } else {
            e.state = "return";
            toast(`🥷 سارق يهرب بغنيمته! اقتله لاستردادها!`);
          }
        }
      } else {
        // عودة للديار بالمسروقات
        if (!col || !col.alive) { removeEnemy(e); continue; }
        const d = Math.max(0.4, homeD);
        if (d < 3) { removeEnemy(e); continue; }
        const nu = nearestPlayerUnit(e.x, e.z, 2.4);
        if (nu && e.atkCd <= 0) {
          e.atkCd = 1.1;
          e.ant.fightT = 0.35;
          hurtUnit(nu.u, e.dmg, e);
        } else {
          mvx = ((col.x - e.x) / d) * e.spd; mvz = ((col.z - e.z) / d) * e.spd;
          moving = true;
        }
      }
    } else {
      // حراسة: دورية حول التل + مطاردة بزمام + قتال
      const aggro = e.role === "boss" ? 16 : 12;
      const leash = e.role === "boss" ? 10 : 20;
      const nu = nearestPlayerUnit(e.x, e.z, aggro);
      if (nu && homeD < leash + nu.d) {
        if (nu.d < (e.role === "boss" ? 2.6 : 2)) {
          if (e.atkCd <= 0) {
            e.atkCd = 1.1;
            e.ant.fightT = 0.35;
            spawnBurst(nu.u.x, 1, nu.u.z, 0xff6600, 7, 2, 3);
            beep(200, 0.09, "square", 0.09);
            hurtUnit(nu.u, e.dmg, e);
          }
        } else {
          const k = Math.max(0.4, nu.d);
          mvx = ((nu.u.x - e.x) / k) * e.spd; mvz = ((nu.u.z - e.z) / k) * e.spd;
          moving = true;
        }
      } else {
        // دورية
        e.waitT -= dt;
        if (e.waitT <= 0 || Math.hypot(e.tx - e.x, e.tz - e.z) < 1.5) {
          const a = rand(0, Math.PI * 2), rr = rand(4, 9);
          e.tx = THREE.MathUtils.clamp(col.x + Math.sin(a) * rr, -TUNE.worldHalf, TUNE.worldHalf);
          e.tz = THREE.MathUtils.clamp(col.z + Math.cos(a) * rr, -TUNE.worldHalf, TUNE.worldHalf);
          e.waitT = rand(2, 5);
        }
        const wx = e.tx - e.x, wz = e.tz - e.z;
        const wd = Math.max(0.3, Math.hypot(wx, wz));
        const sp2 = Math.min(e.spd, wd * 2);
        mvx = (wx / wd) * sp2; mvz = (wz / wd) * sp2;
        moving = true;
      }
    }
    const sk = 1 - Math.exp(-dt * 6);
    e.vx += (mvx - e.vx) * sk;
    e.vz += (mvz - e.vz) * sk;
    e.x += e.vx * dt; e.z += e.vz * dt;
    collideAndClamp(e, 0.7);
    const esp = Math.hypot(e.vx, e.vz);
    if (esp > 0.4) e.yaw = angleLerp(e.yaw, Math.atan2(e.vx, e.vz), 1 - Math.exp(-dt * 8));
    e.ant.group.position.set(e.x, groundY(e.x, e.z), e.z);
    e.ant.group.rotation.y = e.yaw;
    e.ant.update(dt, Math.min(1, esp / 7), t + e.uid);
    if (e.hitFlash > 0) {
      e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
      e.ant.group.position.x += rand(-1, 1) * e.hitFlash * 0.15;
    }
    // شريط صحة العدو
    const show = e.hp < e.maxHp;
    e.hpBg.visible = e.hpFg.visible = show;
    if (show) {
      const y = groundY(e.x, e.z) + 2.2 * e.baseScale;
      e.hpBg.position.set(e.x, y, e.z);
      const frac = Math.max(0.001, e.hp / e.maxHp);
      e.hpFg.scale.x = frac;
      const w = 1.6 * e.baseScale;
      e.hpFg.position.set(e.x - (1 - frac) * w * 0.5, y, e.z);
    }
  }
}

// ---------- العالم: مناطق وموارد ومهمات ومتجر وأحداث ----------
// موارد اللعبة: 4 أساسية + 4 إقليمية بقيم مختلفة
const KNOWN_FOODS = {
  seed: { name: "بذور", icon: "🌱", value: 1 },
  leaf: { name: "ورق", icon: "🍃", value: 1 },
  fruit: { name: "توت", icon: "🍎", value: 2 },
  crumb: { name: "فتات", icon: "🍪", value: 1 },
  nut: { name: "جوز", icon: "🌰", value: 2 },
  nectar: { name: "رحيق", icon: "🌸", value: 2 },
  shell: { name: "صدف", icon: "🐚", value: 3 },
  mushroom: { name: "فطر", icon: "🍄", value: 3 },
  lifeleaf: { name: "ورقة الحياة", icon: "🌿", value: 4, rare: true },
  healbloom: { name: "زهرة الشفاء", icon: "🌺", value: 5, rare: true },
  crystal: { name: "بلورة جينية", icon: "💠", value: 6, rare: true },
  pollen: { name: "غبار اللقاح", icon: "✨", value: 7, rare: true },
  mednectar: { name: "رحيق طبي", icon: "🧪", value: 5, rare: true },
  amber: { name: "كهرمان", icon: "🧡", value: 5 },
  bone: { name: "عظم", icon: "🦴", value: 3 },
  bigapple: { name: "تفاحة كبيرة", icon: "🍎", value: 10 },
  bigmelon: { name: "بطيخة كبيرة", icon: "🍉", value: 12 },
  bigpumpkin: { name: "يقطين كبير", icon: "🎃", value: 15 },
};
// ---------- مركز العلاج والتطور الجيني 🧬 ----------
const GENE_MODS = {
  might:   { name: "قوة",   icon: "💪", unlock: 1, cost: { store: 20, crystal: 2, pollen: 1 }, time: 40,  success: 1,    desc: "هجوم +3" },
  armor:   { name: "درع",   icon: "🛡️", unlock: 2, cost: { store: 30, crystal: 3, pollen: 2 }, time: 50,  success: 1,    desc: "دفاع +3 وصحة +15" },
  speed:   { name: "سرعة",  icon: "👟", unlock: 3, cost: { store: 40, crystal: 2, pollen: 4, mednectar: 2 }, time: 60,  success: 0.9,  desc: "سرعة +25%" },
  stamina: { name: "تحمل",  icon: "⚡", unlock: 4, cost: { store: 50, healbloom: 3, mednectar: 3, pollen: 2 }, time: 70,  success: 0.9,  desc: "صحة +30 وتجدد +0.5/ث" },
  venom:   { name: "سم",    icon: "☠️", unlock: 5, cost: { store: 80, crystal: 5, pollen: 5, mednectar: 3 }, time: 90,  success: 0.75, desc: "هجمات سامة (4/ث لـ3ث)" },
  regen:   { name: "شفاء",  icon: "❤️‍🩹", unlock: 6, cost: { store: 100, healbloom: 6, mednectar: 4, pollen: 3 }, time: 100, success: 0.75, desc: "تجدد +2 صحة/ث" },
  titan:   { name: "خارق",  icon: "🌟", unlock: 7, cost: { store: 150, crystal: 8, pollen: 6, mednectar: 5 }, time: 130, success: 0.6,  desc: "هجوم+5 دفاع+4 صحة+40 حجم+25%" },
};
function geneModCostText(m) {
  const parts = [];
  if (m.cost.store) parts.push(`${m.cost.store}🍯`);
  for (const k of Object.keys(m.cost)) {
    if (k === "store") continue;
    parts.push(`${m.cost[k]}${(KNOWN_FOODS[k] || {}).icon || "❓"}`);
  }
  return parts.join(" ");
}
function canPayGene(cost) {
  if (game.store < (cost.store || 0)) return false;
  for (const k of Object.keys(cost)) {
    if (k === "store") continue;
    if ((game.stock[k] || 0) < cost[k]) return false;
  }
  return true;
}
function payGene(cost) {
  game.store -= cost.store || 0;
  for (const k of Object.keys(cost)) {
    if (k === "store") continue;
    game.stock[k] = Math.max(0, (game.stock[k] || 0) - cost[k]);
  }
}
// ---------- ترقيات الجينات العامة 🧬 (بسيطة ودائمة) ----------
// الفكرة: تطوّر مرة وحدة (5 مستويات)، والترقية تشمل جيشك الحالي + كل البيض
// الجديد تلقائياً — الملكة 👑 تبيض بيضاً مطوراً جاهزاً، بلا مشاريع ولا انتظار
const GENE_UPS = {
  atk:  { name: "هجوم الجنود", icon: "⚔️", max: 5,
    costs: [{ store: 20 }, { store: 40, shell: 2 }, { store: 70, shell: 4 }, { store: 110, crystal: 3 }, { store: 160, crystal: 6, pollen: 2 }],
    effect: "هجوم +2 لكل الجنود" },
  def:  { name: "درع الجنود", icon: "🛡️", max: 5,
    costs: [{ store: 20 }, { store: 40, mushroom: 2 }, { store: 70, mushroom: 4 }, { store: 110, crystal: 3 }, { store: 160, crystal: 6, mednectar: 2 }],
    effect: "دفاع +1 وصحة +10 لكل الجنود" },
  work: { name: "عمال أقوى", icon: "🐜", max: 5,
    costs: [{ store: 15 }, { store: 30, leaf: 3 }, { store: 55, leaf: 6 }, { store: 90, lifeleaf: 2 }, { store: 140, lifeleaf: 4, healbloom: 2 }],
    effect: "دفاع +1 وصحة +8 للعمال والكشافة" },
  bone: { name: "تسليح عظمي", icon: "🦴", max: 5,
    costs: [{ store: 30, bone: 2 }, { store: 60, bone: 4 }, { store: 110, bone: 7 }, { store: 170, bone: 11, crystal: 2 }, { store: 250, bone: 16, crystal: 4 }],
    effect: "هجوم +3 وصحة +15 لكل الجنود" },
};
function geneUpVal(key) { try { return Math.max(0, Math.min(5, (Nest.clinic().gup || {})[key] || 0)); } catch { return 0; } }
function geneUpCost(key) { const t = GENE_UPS[key]; if (!t) return null; return t.costs[Math.min(geneUpVal(key), t.max - 1)]; }
function geneUpBonus(u) {
  const b = { dmg: 0, def: 0, hp: 0 };
  if (!u) return b;
  if (u.kind === "soldier") { b.dmg += 2 * geneUpVal("atk"); b.def += geneUpVal("def"); b.hp += 10 * geneUpVal("def"); b.dmg += 3 * geneUpVal("bone"); b.hp += 15 * geneUpVal("bone"); }
  else if (u.kind === "worker" || u.kind === "scout") { b.def += geneUpVal("work"); b.hp += 8 * geneUpVal("work"); }
  return b;
}
function buyGeneUp(key) {
  const t = GENE_UPS[key];
  if (!t) return false;
  if (Nest.geneLevel() <= 0) { toast("🧬 ابنِ مركز العلاج والتطور أولاً"); return false; }
  const lv = geneUpVal(key);
  if (lv >= t.max) { toast("★ بأقصى مستوى!"); return false; }
  const cost = t.costs[lv];
  if (!canPayGene(cost)) { toast(`🧬 موارد غير كافية: ${geneModCostText({ cost })}`); return false; }
  payGene(cost);
  const cl = geneCenter();
  cl.gup = cl.gup || { atk: 0, def: 0, work: 0 };
  cl.gup[key] = lv + 1;
  for (const u of [...game.workers, ...game.soldiers, ...game.scouts]) refreshUnitStats(u);
  game.stats.upgrades = (game.stats.upgrades || 0) + 1;
  sfx.level();
  toast(`${t.icon} ${t.name} أصبح مستوى ${lv + 1}! (${t.effect}) — 👑 البيض الجديد يفقس مطوراً`);
  saveGame(); updateHUD();
  return true;
}
// ---------- طلبات النخبة ⭐ (ادفع عسل + اختار العدد = بيض ذهبي مطور) ----------
// الفكرة: تطلب عدداً معيناً من نوع ما (مثلاً 20 عاملة)، فالبيض الجاي من هذا النوع
// يتحوّل للمختبر ويفقس مطوراً بلون ذهبي مميز ⭐ — ومن يخلص العدد يرجع البيض عادياً
const ELITE_BONUS = {
  worker: { hp: 15, def: 2, size: 0.12 },
  soldier: { dmg: 4, def: 2, hp: 20, size: 0.12 },
  scout: { hp: 12, def: 2, spdK: 0.15, size: 0.1 },
};
const ELITE_COST = { worker: 3, soldier: 5, scout: 4 }; // عسل لكل نملة نخبة
const ELITE_NAME = { worker: "عمال", soldier: "جنود", scout: "كشافة" };
const ELITE_DESC = {
  worker: "صحة +15 ودفاع +2 وحجم أكبر",
  soldier: "هجوم +4 ودفاع +2 وصحة +20",
  scout: "صحة +12 ودفاع +2 وسرعة +15%",
};
let elitePick = { worker: 10, soldier: 10, scout: 10 }; // العدد المختار في الواجهة
function eliteRemain(kind) { try { return Math.max(0, Math.min(50, (geneCenter().elite || {})[kind] || 0)); } catch { return 0; } }
function eliteBonusFor(kind) { return { ...(ELITE_BONUS[kind] || {}) }; }
// تُستدعى لحظة وضع الملكة للبيضة: تحجز بيضة نخبة إن وُجد طلب لهذا النوع
function takeEliteUnit(kind) {
  try {
    const cl = geneCenter();
    cl.elite = cl.elite || { worker: 0, soldier: 0, scout: 0 };
    if ((cl.elite[kind] || 0) <= 0) return false;
    cl.elite[kind]--;
    saveGame(); updateHUD();
    return true;
  } catch { return false; }
}
function buyElite(kind, n) {
  const per = ELITE_COST[kind];
  if (!per) return false;
  if (Nest.geneLevel() <= 0) { toast("🧬 ابنِ مركز العلاج والتطور أولاً"); return false; }
  if (kind === "soldier" && !Nest.soldierUnlocked()) { toast("⚔️ ابنِ ثكنة الجنود أولاً"); return false; }
  if (kind === "scout" && !Nest.scoutUnlocked()) { toast("🔭 رقِّ الحضانة للمستوى 2 أولاً"); return false; }
  n = Math.max(1, Math.min(50, n | 0));
  const cost = n * per;
  if (game.store < cost) { toast(`🍯 تحتاج ${cost} عسل (معك ${Math.floor(game.store)})`); return false; }
  game.store -= cost;
  const cl = geneCenter();
  cl.elite = cl.elite || { worker: 0, soldier: 0, scout: 0 };
  cl.elite[kind] = Math.min(50, (cl.elite[kind] || 0) + n);
  game.stats.upgrades = (game.stats.upgrades || 0) + 1;
  sfx.level();
  const kn = ELITE_NAME[kind] || kind;
  toast(`⭐ طلب ${n} ${kn} نخبة! البيض الجاي يطلع ذهبياً 👑 — اضبط بيض الملكة على ${kn} من غرفتها`);
  saveGame(); updateHUD();
  return true;
}
function cancelElite(kind) {
  const cl = geneCenter();
  cl.elite = cl.elite || { worker: 0, soldier: 0, scout: 0 };
  const rem = cl.elite[kind] || 0;
  if (rem <= 0) return false;
  cl.elite[kind] = 0;
  game.store = Math.min(storeCap(), game.store + rem * (ELITE_COST[kind] || 0));
  toast(`❌ أُلغي طلب النخبة — استرددت ${rem * (ELITE_COST[kind] || 0)}🍯`);
  saveGame(); updateHUD();
  return true;
}
// درع العمال العام (ترقيات المركز)
function warmorVal() { return (Nest.clinic().warmor || 0); }
// إعادة حساب خصائص الوحدة من الجينات + الدرع + التدريب العسكري (تأثير فعلي على القتال)
function refreshUnitStats(u) {
  if (!u || !u.base) return;
  const g = u.gene || {};
  const tr = u.tr || {};
  const rk = trainRankOf(u);
  const gb = geneUpBonus(u);
  u.dmg = (u.base.dmg || 0) + (g.dmg || 0) + 2 * rk + (tr.a || 0) + gb.dmg;
  u.def = (u.base.def || 0) + (g.def || 0) + 2 * rk + (tr.d || 0) + gb.def;
  u.spd = (u.base.spd || 0) * (1 + (g.spdK || 0)) * (1 + 0.03 * (tr.s || 0));
  let bonus = (g.hp || 0) + 12 * trainRankOf(u) + (tr.h || 0) + gb.hp;
  if (u.kind === "worker" || u.kind === "scout") {
    u.armorVal = warmorVal() + (u.kind === "worker" ? 0 : 0);
    bonus += (u.kind === "worker" ? 8 : 4) * warmorVal();
  }
  const frac = u.maxHp ? u.hp / u.maxHp : 1;
  u.maxHp = Math.max(1, (u.base.maxHp || 10) + bonus);
  u.hp = Math.min(u.maxHp, Math.max(1, Math.round(u.maxHp * frac)));
  u.baseScale = (u.base.scale || 1) * (1 + (g.size || 0));
  try {
    if (u.ant && u.ant.group && (u.emergeT === undefined || u.emergeT >= 1)) u.ant.group.scale.setScalar(u.baseScale);
  } catch {}
}
function applyGeneKey(u, key) {
  if (!u || !GENE_MODS[key]) return false;
  u.gene = u.gene || {};
  u.mods = u.mods || [];
  const g = u.gene;
  if (key === "might") g.dmg = (g.dmg || 0) + 3;
  else if (key === "armor") { g.def = (g.def || 0) + 3; g.hp = (g.hp || 0) + 15; }
  else if (key === "speed") g.spdK = (g.spdK || 0) + 0.25;
  else if (key === "stamina") { g.hp = (g.hp || 0) + 30; g.regen = (g.regen || 0) + 0.5; }
  else if (key === "venom") g.venom = (g.venom || 0) + 4;
  else if (key === "regen") g.regen = (g.regen || 0) + 2;
  else if (key === "titan") { g.dmg = (g.dmg || 0) + 5; g.def = (g.def || 0) + 4; g.hp = (g.hp || 0) + 40; g.spdK = (g.spdK || 0) + 0.15; g.size = (g.size || 0) + 0.25; }
  if (!u.mods.includes(key)) u.mods.push(key);
  refreshUnitStats(u);
  return true;
}
// سم: ضرر مستمر يخترق الدرع — يُعالج في حلقة التحديث مع توجيه الموت الصحيح
function applyPoison(e, dps, dur) {
  if (!e || e.isColony || e.hp === undefined) return;
  if (e.kind === "enemy" && e.dying) return;
  if (e.isCreature && e.stunned) return;
  e.poison = { dps, t: Math.max((e.poison && e.poison.t) || 0, dur) };
  e.poison.dps = Math.max((e.poison && e.poison.dps) || 0, dps);
}
function tickPoison(dt) {
  const kill = (e) => {
    if (e.isCreature) { if (!e.stunned) stunCreature(e); }
    else if (e.kind === "enemy") { if (!e.dying) killEnemy(e); }
    else if (game.beetles.includes(e)) killBeetle(e);
  };
  for (const e of [...game.beetles, ...game.creatures, ...game.enemies]) {
    if (!e.poison || e.hp === undefined || e.hp <= 0) continue;
    if (e.isCreature && e.stunned) { e.poison = null; continue; }
    if (e.kind === "enemy" && e.dying) { e.poison = null; continue; }
    e.poison.t -= dt;
    e.hp -= e.poison.dps * dt;
    e.hitFlash = 1;
    if (Math.random() < dt * 6) {
      spawnBurst(e.x, 1, e.z, 0x66ff66, 3, 1.2, 2);
      spawnDmgNum(e.x, 1.6, e.z, "☠️" + Math.ceil(e.poison.dps), "#7dff5e");
    }
    if (e.hp <= 0) { e.poison = null; kill(e); }
    else if (e.poison.t <= 0) e.poison = null;
  }
}
// ---------- عمليات مركز العلاج والتطور (تكامل حقيقي مع الوحدات) ----------
function geneCenter() { return Nest.clinic(); }
function injuredUnits() {
  const out = [];
  for (const u of [...game.workers, ...game.scouts, ...game.soldiers, ...game.allies]) {
    if (u.inClinic || u.inTraining || u.dying) continue;
    if (u.hp !== undefined && u.maxHp && u.hp < u.maxHp * 0.999) out.push(u);
  }
  out.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  return out;
}
function healCostFor(u) {
  const miss = Math.max(1, (u.maxHp || 10) - (u.hp || 0));
  const serious = miss > (u.maxHp || 10) * 0.5;
  const speed = 1 + 0.15 * Nest.geneLevel();
  return {
    miss, serious,
    tTotal: Math.max(12, (miss * (serious ? 1.6 : 1.0)) / speed),
    need: serious
      ? { store: 10, lifeleaf: Math.ceil(miss / 12), healbloom: Math.ceil(miss / 20) }
      : { store: 5, lifeleaf: Math.ceil(miss / 15) },
  };
}
function healNeedText(need) {
  const parts = [`${need.store}🍯`];
  for (const k of Object.keys(need)) {
    if (k === "store") continue;
    parts.push(`${need[k]}${(KNOWN_FOODS[k] || {}).icon || "❓"}`);
  }
  return parts.join(" ");
}
function admitToClinic(u) {
  if (!u || u.inClinic || u.inTraining) return false;
  const cl = geneCenter();
  if (cl.beds.length >= Nest.geneBeds()) { toast("🛏️ كل الأسرّة مشغولة — رقِّ المركز"); return false; }
  if (cl.beds.some((b) => b.uid === u.uid)) { toast("🤕 هذه النملة قيد العلاج بالفعل"); return false; }
  const hc = healCostFor(u);
  if (!canPayGene(hc.need)) { toast(`🌿 موارد غير كافية: ${healNeedText(hc.need)}`); return false; }
  payGene(hc.need);
  u.inClinic = true;
  try { u.ant.group.visible = false; if (u.group) u.group.visible = false; } catch {}
  armyDesel(u);
  cl.beds.push({
    uid: u.uid, kind: u.kind, hp: u.hp, maxHp: u.maxHp,
    variant: u.variant || null, entryUid: u.entryUid || null,
    gene: u.gene ? { ...u.gene } : null, mods: u.mods ? [...u.mods] : [],
    tr: u.tr ? { ...u.tr } : null,
    tTotal: hc.tTotal, tLeft: hc.tTotal,
  });
  sfx.hatch();
  toast(`🛏️ ${unitLabel(u)} في العلاج (${Math.round(hc.tTotal)}ث)`);
  saveGame(); updateHUD();
  return true;
}
function findUnitByUid(uid) {
  for (const u of [...game.workers, ...game.scouts, ...game.soldiers, ...game.allies]) if (u.uid === uid) return u;
  return null;
}
// انتهاء سرير: النملة تعود لوحدتها الأصلية بصحة كاملة قرب العش
function clinicBedDone(snap) {
  let u = findUnitByUid(snap.uid);
  if (!u) {
    // أُعيد إنشاؤها (بعد تحميل حفظ): نفس النوع والجينات
    if (snap.kind === "soldier") u = spawnSoldier(snap.gene, (snap.mods && snap.mods[0]) || null);
    else if (snap.kind === "scout") u = spawnScout(snap.gene, (snap.mods && snap.mods[0]) || null);
    else if (snap.kind === "ally") {
      const entry = game.collection.find((e) => e.uid === snap.entryUid);
      if (entry && entry.state !== "deployed") { u = spawnAlly(entry); if (snap.gene && u) { u.gene = snap.gene; u.mods = snap.mods || []; refreshUnitStats(u); } }
      else return;
    }
    else u = spawnWorker(snap.gene, (snap.mods && snap.mods[0]) || null);
    if (!u) return;
    u.uid = snap.uid;
  }
  u.inClinic = false;
  if (u.tr == null && snap.tr) u.tr = { ...snap.tr };
  else if (snap.tr) u.tr = { ...snap.tr };
  if (u.kind === "soldier") refreshUnitStats(u);
  u.hp = u.maxHp;
  u.order = null;
  if (u.kind === "soldier") { u.dying = false; u.dieT = 0; }
  u.x = HOLE.x + rand(-2, 2); u.z = HOLE.z + rand(-2, 2);
  try { u.ant.group.visible = true; if (u.group) u.group.visible = true; u.ant.group.position.set(u.x, groundY(u.x, u.z), u.z); } catch {}
  spawnBurst(u.x, 1, u.z, 0x51ff5e, 16, 3, 3);
  sfx.level();
  toast(`❤️‍🩹 ${unitLabel(u)} تعافت وعادت لوحدتها!`);
  centerMsg("❤️‍🩹 اكتمل العلاج — عادت للقتال!");
  saveGame(); updateHUD();
}
function geneBonusFor(key) {
  const g = {};
  if (key === "might") g.dmg = 3;
  else if (key === "armor") { g.def = 3; g.hp = 15; }
  else if (key === "speed") g.spdK = 0.25;
  else if (key === "stamina") { g.hp = 30; g.regen = 0.5; }
  else if (key === "venom") g.venom = 4;
  else if (key === "regen") g.regen = 2;
  else if (key === "titan") { g.dmg = 5; g.def = 4; g.hp = 40; g.spdK = 0.15; g.size = 0.25; }
  return g;
}
// انتهاء حاضنة: رمي النجاح — الفشل يُبقي البيضة ويُستهلك الموارد فقط (بتحذير مسبق)
function clinicIncDone(slot) {
  const m = GENE_MODS[slot.geneKey];
  if (!m) { if (slot.egg) Nest.pushBrood({ ...slot.egg, t: 25 }); return; }
  const roll = Math.random();
  if (roll <= (m.success || 1)) {
    const bonus = geneBonusFor(slot.geneKey);
    if (slot.egg) {
      // البيضة الأصلية تُستهلك وتتحول لبالغ مطوّر فعلياً
      const kind = slot.egg.kind || "worker";
      if (!canAdd(kind)) {
        Nest.pushBrood({ ...slot.egg, gene: bonus, t: 25 });
        toast(`🥚 ${KIND_INFO[kind].name} ممتلئون — البيضة المطورة عادت للحضانة`);
      } else {
        API_spawnGeneAdult(kind, bonus, slot.geneKey);
        game.stats.hatched = (game.stats.hatched || 0) + 1;
        addXP(6);
        toast(`${m.icon} فقست نملة ${m.name} مطوّرة جينياً!`);
        centerMsg(`${m.icon} تطور جيني ناجح: ${m.name}!`);
      }
    }
    sfx.level();
  } else {
    if (slot.egg) Nest.pushBrood({ ...slot.egg, t: 25 });
    sfx.hit();
    toast(`⚠️ فشل التعديل ${m.name} (نسبة النجاح ${Math.round(m.success * 100)}%) — البيضة سليمة والموارد استُهلكت`);
  }
  saveGame(); updateHUD();
}
function API_spawnGeneAdult(kind, bonus, geneKey) {
  spawnAdult(kind, bonus, geneKey);
}
function startGeneProject(eggId, geneKey) {
  const m = GENE_MODS[geneKey];
  if (!m) return false;
  if (Nest.geneLevel() < m.unlock) { toast(`🧬 ${m.name} يحتاج مركز مستوى ${m.unlock}`); return false; }
  const cl = geneCenter();
  if (cl.inc.length >= Nest.geneInc()) { toast("🥚 كل الحاضنات مشغولة — رقِّ المركز"); return false; }
  if (!canPayGene(m.cost)) { toast(`🧬 موارد غير كافية: ${geneModCostText(m)}`); return false; }
  const egg = Nest.removeBrood(eggId);
  if (!egg) { toast("🥚 البيضة غير موجودة"); return false; }
  payGene(m.cost);
  const tTotal = m.time * (1 - 0.05 * (Nest.geneLevel() - 1));
  cl.inc.push({ id: nextUid(), kind: egg.kind || "worker", geneKey, tTotal, tLeft: tTotal, risk: 1 - m.success, egg: { id: egg.id, kind: egg.kind, stage: egg.stage, t: egg.t } });
  sfx.hatch();
  toast(`${m.icon} بدأ تطوير ${m.name} (${Math.round(tTotal)}ث${m.success < 1 ? ` — نجاح ${Math.round(m.success * 100)}%` : ""})`);
  saveGame();
  return true;
}
// ترقيات المركز: درع العمال + مختبر اليرقات
function warmorUpCost() {
  const lv = warmorVal();
  return { store: 40 + lv * 40, lifeleaf: 2 + lv * 2, healbloom: 1 + lv, crystal: lv >= 2 ? lv : 0 };
}
function buyWarmor() {
  const lv = warmorVal();
  if (lv >= 5) { toast("🛡️ درع العمال في الحد الأقصى"); return false; }
  if (Nest.geneLevel() < 3) { toast("🧬 درع العمال يحتاج مركز مستوى 3"); return false; }
  const cost = warmorUpCost();
  if (!canPayGene(cost)) { toast(`🌿 موارد غير كافية: ${geneModCostText({ cost })}`); return false; }
  payGene(cost);
  geneCenter().warmor = lv + 1;
  for (const w of [...game.workers, ...game.scouts]) { w.armorVal = warmorVal(); refreshUnitStats(w); }
  game.stats.upgrades = (game.stats.upgrades || 0) + 1;
  sfx.level();
  toast(`🛡️ درع العمال أصبح مستوى ${lv + 1}! (+8 صحة لكل عامل)`);
  saveGame(); updateHUD();
  return true;
}
function larvaUpCost() {
  const lv = geneCenter().larva || 0;
  return { store: 50 + lv * 50, healbloom: 3 + lv * 2, mednectar: 2 + lv };
}
function buyLarva() {
  const cl = geneCenter();
  if ((cl.larva || 0) >= 3) { toast("🐛 مختبر اليرقات في الحد الأقصى"); return false; }
  if (Nest.geneLevel() < 2) { toast("🧬 مختبر اليرقات يحتاج مركز مستوى 2"); return false; }
  const cost = larvaUpCost();
  if (!canPayGene(cost)) { toast("🌿 موارد غير كافية"); return false; }
  payGene(cost);
  cl.larva = (cl.larva || 0) + 1;
  game.stats.upgrades = (game.stats.upgrades || 0) + 1;
  sfx.level();
  toast(`🐛 مختبر اليرقات مستوى ${cl.larva}! (البيض الجديد أقوى)`);
  saveGame(); updateHUD();
  return true;
}
// ---------- مركز التدريب العسكري 🎖️ (نظام حقيقي: وقت + موارد + رتب فعلية) ----------
const TRAIN_RANKS = [
  { xp: 0, name: "مبتدئ", icon: "🌱" },
  { xp: 100, name: "مدرب", icon: "🎖️" },
  { xp: 250, name: "محترف", icon: "⚔️" },
  { xp: 500, name: "نخبة", icon: "🔥" },
  { xp: 900, name: "أسطوري", icon: "👑" },
];
function trainRankOf(u) {
  const xp = (u && u.tr && u.tr.xp) || 0;
  let r = 0;
  for (let i = 0; i < TRAIN_RANKS.length; i++) if (xp >= TRAIN_RANKS[i].xp) r = i;
  return r;
}
function trainRankText(u) {
  const r = TRAIN_RANKS[trainRankOf(u)] || TRAIN_RANKS[0];
  const xp = (u.tr && u.tr.xp) || 0;
  const next = TRAIN_RANKS[trainRankOf(u) + 1];
  return `${r.icon} ${r.name} (${xp} خبرة${next ? ` / ${next.xp}` : " — الأعلى"})`;
}
const TRAIN_FOCUS = {
  atk: { name: "هجوم", icon: "⚔️", time: 60, xp: 60, cost: { store: 25, crystal: 2, shell: 3 }, desc: "هجوم +1", apply: (tr) => { tr.a = (tr.a || 0) + 1; } },
  def: { name: "دفاع", icon: "🛡️", time: 70, xp: 60, cost: { store: 25, lifeleaf: 2, shell: 4 }, desc: "دفاع +1", apply: (tr) => { tr.d = (tr.d || 0) + 1; } },
  spd: { name: "سرعة", icon: "👟", time: 75, xp: 70, cost: { store: 30, nectar: 4, pollen: 2 }, desc: "سرعة +3%", apply: (tr) => { tr.s = (tr.s || 0) + 1; } },
  stm: { name: "تحمل", icon: "❤️", time: 80, xp: 70, cost: { store: 30, healbloom: 3, mushroom: 3 }, desc: "صحة قصوى +8", apply: (tr) => { tr.h = (tr.h || 0) + 8; } },
  vet: { name: "نخبة شاملة", icon: "🌟", time: 110, xp: 120, needLv: 3, cost: { store: 50, crystal: 4, pollen: 4, mushroom: 4 }, desc: "هجوم +1 ودفاع +1", apply: (tr) => { tr.a = (tr.a || 0) + 1; tr.d = (tr.d || 0) + 1; } },
};
function trainCostText(cost) {
  const parts = [];
  if (cost.store) parts.push(`${cost.store}🍯`);
  for (const k of Object.keys(cost)) {
    if (k === "store") continue;
    parts.push(`${cost[k]}${(KNOWN_FOODS[k] || {}).icon || "❓"}`);
  }
  return parts.join(" ");
}
const CONVERT_NEED = { time: 45, cost: { store: 40, crystal: 2 } };
function trainSlotsFree() { return Nest.trainSlots() - Nest.trainState().slots.length; }
function yardSpot(i) {
  return { x: nestPos.x + 9.5 + (i % 2) * 2.6, z: nestPos.z + 5.5 + Math.floor(i / 2) * 2.6 };
}
function trainPlaceAtYard(u, i) {
  const p = yardSpot(i == null ? (game.soldiers.length % 3) : i);
  u.x = p.x; u.z = p.z; u.tx = p.x; u.tz = p.z;
  u.yaw = rand(0, 6.28);
  u.emergeT = 1;
  try {
    u.ant.group.position.set(u.x, groundY(u.x, u.z), u.z);
    u.ant.group.scale.setScalar(u.baseScale || 1);
    u.ant.group.visible = true;
  } catch {}
}
// تحويل عامل إلى جندي: يستهلك العامل فعلياً + تكلفة + وقت
function convertWorkerToSoldier(uid) {
  if (Nest.trainLevel() <= 0) { toast("🎖️ ابنِ مركز التدريب العسكري أولاً"); return false; }
  const w = findUnitByUid(uid);
  if (!w || w.kind !== "worker") { toast("🐜 اختر عاملاً للتحويل"); return false; }
  if (w.inClinic || w.inTraining) { toast("🐜 هذه العاملة مشغولة"); return false; }
  if (trainSlotsFree() <= 0) { toast("🎖️ كل الساحات مشغولة — رقِّ المركز"); return false; }
  if (!canPayGene(CONVERT_NEED.cost)) { toast(`🎖️ موارد غير كافية: ${trainCostText(CONVERT_NEED.cost)}`); return false; }
  payGene(CONVERT_NEED.cost);
  for (const it of (w.carried || [])) { game.store += 1; }
  game.stats.upgrades = (game.stats.upgrades || 0) + 1;
  armyDesel(w);
  removeWorker(w);
  const slot = { id: nextUid(), mode: "conv", uid: -1, tTotal: CONVERT_NEED.time, tLeft: CONVERT_NEED.time };
  Nest.trainState().slots.push(slot);
  sfx.hatch();
  toast(`🔄 بدأ تحويل عامل إلى جندي (${CONVERT_NEED.time}ث)`);
  saveGame(); updateHUD();
  return true;
}
// بدء دورة تدريب لجندي موجود
function startTrainCycle(uid, focusKey) {
  if (Nest.trainLevel() <= 0) { toast("🎖️ ابنِ مركز التدريب العسكري أولاً"); return false; }
  const f = TRAIN_FOCUS[focusKey];
  if (!f) return false;
  if (f.needLv && Nest.trainLevel() < f.needLv) { toast(`🌟 ${f.name} يحتاج مركز مستوى ${f.needLv}`); return false; }
  const u = findUnitByUid(uid);
  if (!u || u.kind !== "soldier") { toast("⚔️ اختر جندياً للتدريب"); return false; }
  if (u.dying || u.inClinic || u.inTraining) { toast("⚔️ هذا الجندي غير متاح"); return false; }
  if (trainSlotsFree() <= 0) { toast("🎖️ كل الساحات مشغولة — رقِّ المركز"); return false; }
  if (!canPayGene(f.cost)) { toast(`🎖️ موارد غير كافية: ${trainCostText(f.cost)}`); return false; }
  payGene(f.cost);
  u.inTraining = true;
  u.order = null;
  armyDesel(u);
  const idx = Nest.trainState().slots.length;
  trainPlaceAtYard(u, idx);
  u.sparT = rand(0.5, 1.5);
  const lv = Nest.trainLevel();
  const xpGain = Math.round(f.xp * (1 + 0.15 * (lv - 1)));
  Nest.trainState().slots.push({
    id: nextUid(), mode: "train", uid: u.uid, variant: u.variant || null,
    gene: u.gene ? { ...u.gene } : null, mods: u.mods ? [...u.mods] : [], tr: u.tr ? { ...u.tr } : { xp: 0, a: 0, d: 0, s: 0, h: 0 },
    focus: focusKey, xpGain, tTotal: f.time, tLeft: f.time,
  });
  sfx.hatch();
  toast(`${f.icon} بدأ تدريب ${f.name} (${f.time}ث — +${xpGain} خبرة)`);
  saveGame(); updateHUD();
  return true;
}
// انتهاء ساحة: التحويل ينتج جندياً جديداً، والتدريب يرفع الخبرة والمهارة فعلياً
function trainSlotDone(slot) {
  if (!slot) return;
  if (slot.mode === "conv") {
    if (!canAdd("soldier")) {
      Nest.queueBrood("soldier");
      addXP(6);
      toast("⚔️ الثكنة ممتلئة — الجندي المحوَّل عاد بيضةاً للحضانة");
      centerMsg("⚔️ لا مكان — الجندي بيضة في الحضانة!");
      saveGame(); updateHUD();
      return;
    }
    const u = spawnSoldier();
    if (!u) { toast("🐜 العش ممتلئ — أفسح مكاناً"); return; }
    trainPlaceAtYard(u, 0);
    game.stats.hatched = (game.stats.hatched || 0) + 1;
    addXP(6);
    sfx.level();
    toast("🔄 عامل أصبح جندياً مبتدئاً! درّبه ليرتقي");
    centerMsg("🔄 جندي جديد انضم من التحويل!");
  } else {
    let u = findUnitByUid(slot.uid);
    if (!u) {
      // أُعيد إنشاؤه بعد تحميل حفظ: نفس النوع والجينات والتدريب السابق
      const vi = ["guard", "brute", "swift"].indexOf(slot.variant);
      const keepN = game.soldierSpawnN || 0;
      if (vi >= 0) game.soldierSpawnN = vi;
      u = spawnSoldier(slot.gene, (slot.mods && slot.mods[0]) || null);
      game.soldierSpawnN = Math.max(keepN, game.soldierSpawnN || 0);
      if (!u) return;
      u.uid = slot.uid;
      u.tr = slot.tr ? { ...slot.tr } : { xp: 0, a: 0, d: 0, s: 0, h: 0 };
    }
    const f = TRAIN_FOCUS[slot.focus];
    const oldR = trainRankOf(u);
    u.tr = u.tr || { xp: 0, a: 0, d: 0, s: 0, h: 0 };
    u.tr.xp = (u.tr.xp || 0) + (slot.xpGain || 0);
    if (f) f.apply(u.tr);
    const newR = trainRankOf(u);
    refreshUnitStats(u);
    u.inTraining = false;
    u.dying = false; u.dieT = 0;
    u.hp = u.maxHp;
    const p = { x: HOLE.x + rand(-2, 2), z: HOLE.z + rand(-2, 2) };
    u.x = p.x; u.z = p.z;
    try { u.ant.group.visible = true; u.ant.group.position.set(u.x, groundY(u.x, u.z), u.z); } catch {}
    spawnBurst(u.x, 1, u.z, 0xffd93d, 16, 3, 3);
    game.stats.upgrades = (game.stats.upgrades || 0) + 1;
    addXP(5);
    if (newR > oldR) {
      const r = TRAIN_RANKS[newR];
      sfx.level();
      toast(`${r.icon} ترقّى الجندي إلى رتبة ${r.name}! (+2⚔️ +2🛡️ +12❤️)`);
      centerMsg(`${r.icon} ترقية لرتبة ${r.name}!`);
    } else {
      sfx.deposit();
      toast(`${f ? f.icon : "🎖️"} اكتمل التدريب: ${f ? f.desc : ""} (+${slot.xpGain} خبرة)`);
    }
  }
  saveGame(); updateHUD();
}
// استعادة المتدربين بعد تحميل حفظ (الجنود لا يُحفظون كوحدات)
function restoreTrainSlots() {
  const ts = Nest.trainState();
  for (const s of ts.slots) {
    if (s.mode !== "train") continue;
    const vi = ["guard", "brute", "swift"].indexOf(s.variant);
    if (vi >= 0) game.soldierSpawnN = vi;
    const u = spawnSoldier(s.gene, (s.mods && s.mods[0]) || null);
    if (!u) continue;
    u.uid = s.uid;
    u.tr = s.tr ? { ...s.tr } : { xp: 0, a: 0, d: 0, s: 0, h: 0 };
    refreshUnitStats(u);
    u.hp = u.maxHp;
    u.inTraining = true;
    u.order = null;
    trainPlaceAtYard(u, ts.slots.indexOf(s));
  }
}
// مضاعفات اللاعب من المتجر
function pMax() { return 100 + 20 * ((game.mods && game.mods.hp) || 0); }
function dmgMul() { return 1 + 0.2 * ((game.mods && game.mods.dmg) || 0); }
// ---------- الخبرة والمستويات ----------
function xpNeed(l) { return 20 + (l - 1) * 15; }
function addXP(n) {
  if (!n) return;
  game.xp = (game.xp || 0) + n;
  let need = xpNeed(game.level || 1);
  while (game.xp >= need) {
    game.xp -= need;
    game.level = (game.level || 1) + 1;
    game.store += 8;
    game.player.hp = pMax();
    game.player.st = 100;
    need = xpNeed(game.level);
    sfx.level();
    centerMsg(`⭐ مستوى ${game.level}! +8🍯 وشفاء كامل`);
    toast(`⭐ مستوى ${game.level}! قوتك تنمو`);
  }
  updateHUD();
}
// ---------- المناطق ----------
const REGIONS = [
  { id: "meadow", name: "المروج", icon: "🌱", x0: -45, x1: 45, z0: -45, z1: 45, patch: null, kind: null, start: true },
  { id: "forest", name: "الغابة", icon: "🌲", x0: -225, x1: -45, z0: -225, z1: -45, patch: 0x3f7d33, kind: "nut", cx: -150, cz: -150 },
  { id: "garden", name: "الحديقة", icon: "🌸", x0: 45, x1: 225, z0: -225, z1: -45, patch: 0x86c95a, kind: "nectar", cx: 150, cz: -150 },
  { id: "beach", name: "الشاطئ", icon: "🏖️", x0: 45, x1: 225, z0: 45, z1: 225, patch: 0xe0cf9a, kind: "shell", cx: 150, cz: 150 },
  { id: "rocks", name: "الصخور", icon: "🪨", x0: -225, x1: -45, z0: 45, z1: 225, patch: 0x9a9aa2, kind: "mushroom", cx: -150, cz: 150 },
  { id: "tree", name: "الشجرة العتيقة", icon: "🌳", x0: -58, x1: 58, z0: -268, z1: -162, patch: null, kind: "amber", cx: 0, cz: -215 },
];
// ---------- العالم الثاني: الشجرة العتيقة 🌳 (جيب شمالي يُدخل عبر بوابة الخشبة) ----------
const TREE = {
  x0: -58, x1: 58, z0: -268, z1: -162, cx: 0, cz: -215,
  gateX: -60, gateZ: -60,      // حلقة البوابة في الغابة (العالم العادي)
  backX: 0, backZ: -172, // حلقة الرجوع داخل الشجرة
  moundX: -30, moundZ: -238,   // تل النمل الأبيض
  treeX: 0, treeZ: -252,        // جذع الشجرة العملاق
};
function inTreeRect(x, z) { return x >= TREE.x0 && x <= TREE.x1 && z >= TREE.z0 && z <= TREE.z1; }
function treeRandPos() { return { x: rand(TREE.x0 + 8, TREE.x1 - 8), z: rand(TREE.z0 + 8, TREE.z1 - 8) }; }
function isPlayerSide(ent) {
  return !!ent && (ent === game.player || ent.kind === "worker" || ent.kind === "soldier" || ent.kind === "scout" || ent.kind === "ally");
}
function regionAt(x, z) {
  for (const r of REGIONS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
  }
  return REGIONS[0];
}
function randInRect(r, m) {
  m = m || 4;
  return { x: rand(r.x0 + m, r.x1 - m), z: rand(r.z0 + m, r.z1 - m) };
}
function regionsCount() { return REGIONS.filter((r) => game.regions && game.regions[r.id]).length; }
function buildRegions() {
  for (const r of REGIONS) {
    if (!r.patch) continue;
    // رقعة عضوية بحافة مكسّرة (كانت قرصاً حاد الحواف)
    organicPatch(r.cx, r.cz, 95, 95, r.patch, { edge: 18, inner: 7 });
  }
  // الغابة: أشجار مخروطية
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 1, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 });
  for (let i = 0; i < 44; i++) {
    const p = randInRect(REGIONS[1], 6);
    const tr = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.2, 6), trunkMat);
    trunk.position.y = 0.6;
    tr.add(trunk);
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6 - k * 0.4, 1.6, 7), treeMat);
      cone.position.y = 1.6 + k * 1.1;
      cone.castShadow = true;
      tr.add(cone);
    }
    tr.position.set(p.x, 0, p.z);
    const sc = rand(0.8, 1.4);
    tr.scale.setScalar(sc);
    scene.add(tr);
  }
  // الحديقة: أزهار
  for (let i = 0; i < 50; i++) {
    const p = randInRect(REGIONS[2], 5);
    const fl = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), trunkMat);
    stem.position.y = 0.45;
    fl.add(stem);
    const cols = [0xff6fa5, 0xffd93d, 0xc77dff, 0xffffff];
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.7 })
    );
    head.position.y = 1.0;
    fl.add(head);
    fl.position.set(p.x, 0, p.z);
    scene.add(fl);
  }
  // الشاطئ: بركة ماء بحافة رملية طبيعية
  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(16.5, 26),
    new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(108, 0.022, 108);
  sand.receiveShadow = true;
  scene.add(sand);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(14, 26),
    new THREE.MeshStandardMaterial({ color: 0x3fa7d6, roughness: 0.3 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(108, 0.03, 108);
  scene.add(pond);
  // الصخور: كتل حجرية
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6f6f77, roughness: 1, flatShading: true });
  for (let i = 0; i < 34; i++) {
    const p = randInRect(REGIONS[4], 5);
    const r = rand(0.8, 2.0);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stoneMat);
    rock.position.set(p.x, r * 0.45, p.z);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    rock.scale.y = 0.75;
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
  }
}
function discoverRegion(r) {
  if (!r || game.regions[r.id]) return;
  game.regions[r.id] = true;
  game.store += 10;
  addXP(8);
  sfx.level();
  centerMsg(`${r.icon} اكتشفت ${r.name}! +10🍯`);
  toast(`${r.icon} منطقة جديدة: ${r.name} — موارد ${r.kind ? KNOWN_FOODS[r.kind].icon + " " + KNOWN_FOODS[r.kind].name : "متنوعة"}`);
  if (r.id === "forest" && game.regions && !game.regions.tree) {
    game._guideUntil = performance.now() + 90000;
    setTimeout(() => { try { toast("🪵 البوابة الذهبية قرب الخشبة في زاوية الغابة \u2014 اتبع السهم الذهبي فوق العش!"); } catch {} }, 1800);
  }
  saveGame();
  updateHUD();
}
function checkRegions() {
  if (game.underground || !game.player) return;
  const r = regionAt(camFocusX(), camFocusZ());
  if (r && !r.start && !game.regions[r.id]) discoverRegion(r);
}
function regionFoodTick() {
  if (game.foods.length > 160) return;
  for (const r of REGIONS) {
    if (!r.kind) continue;
    let n = 0;
    for (const f of game.foods) {
      if (f.kind === r.kind && f.x >= r.x0 && f.x <= r.x1 && f.z >= r.z0 && f.z <= r.z1) n++;
    }
    if (n < 12) {
      for (let i = 0; i < 2; i++) {
        const p = randInRect(r, 4);
        try { spawnFood(p.x, p.z, r.kind); } catch {}
      }
    }
  }
}
// ---------- المهمات ----------
const MAIN_QUESTS = [
  { id: "m1", name: "أول الطعام", desc: "اجمع 10 طعام", type: "food", need: 10, reward: 10 },
  { id: "m2", name: "تكبير العائلة", desc: "افقس 3 عمال جدد", type: "hatch", need: 3, reward: 12 },
  { id: "m3", name: "مستكشف الغابة", desc: "اكتشف الغابة 🌲", type: "discover", region: "forest", reward: 15 },
  { id: "m4", name: "أول دم", desc: "اهزم 5 أعداء", type: "kills", need: 5, reward: 20 },
  { id: "m5", name: "مروض الوحوش", desc: "أسر مخلوقاً 🐾", type: "captures", need: 1, reward: 25 },
  { id: "m6", name: "سقوط الظل", desc: "دمر مستعمر الظل 🖤", type: "flag", flag: "shadowDown", reward: 40 },
  { id: "m7", name: "مستكشف العالم", desc: "اكتشف كل المناطق", type: "allregions", reward: 50 },
  { id: "m8", name: "سقوط الحمراء", desc: "دمر المستعمر الحمراء 👹", type: "flag", flag: "redDown", reward: 100 },
  { id: "m9", name: "كهرمان الشجرة", desc: "اجمع 10 كهرمان 🧡 من الشجرة العتيقة", type: "amber", need: 10, reward: 60 },
  { id: "m10", name: "مبيد الأبيض", desc: "اقتل 6 نمل أبيض 🤍 في الشجرة العتيقة", type: "termKills", need: 6, reward: 100 },
];
const DAILY_POOL = [
  { id: "d_food1", name: "جامع نشيط", desc: "اجمع 15 طعام", type: "food", need: 15, reward: 12 },
  { id: "d_food2", name: "مخزون كبير", desc: "اجمع 30 طعام", type: "food", need: 30, reward: 20 },
  { id: "d_kill1", name: "صياد", desc: "اهزم 5 أعداء", type: "kills", need: 5, reward: 15 },
  { id: "d_kill2", name: "محارب", desc: "اهزم 10 أعداء", type: "kills", need: 10, reward: 25 },
  { id: "d_cap1", name: "آسر", desc: "أسر مخلوقاً", type: "captures", need: 1, reward: 12 },
  { id: "d_cap2", name: "مروض", desc: "أسر مخلوقين", type: "captures", need: 2, reward: 22 },
  { id: "d_up1", name: "مطور", desc: "اشترِ ترقيةتين", type: "upgrades", need: 2, reward: 15 },
  { id: "d_reg1", name: "مستكشف", desc: "اكتشف منطقةاً", type: "discoverAny", need: 1, reward: 20 },
  { id: "d_amber1", name: "صائد الكهرمان", desc: "اجمع 5 كهرمان 🧡", type: "amber", need: 5, reward: 15 },
  { id: "d_bone1", name: "جامع العظام", desc: "اجمع 3 عظام 🦴", type: "bones", need: 3, reward: 18 },
  { id: "d_siege1", name: "كاسر الحصار", desc: "اقتل خنفساء الحصار 🪲", type: "siegeKills", need: 1, reward: 40 },
  { id: "d_wave1", name: "صامد", desc: "اسحق موجة بعد النصر 🌊", type: "waves", need: 1, reward: 50 },
];
// 🏆 الإنجازات الدائمة (مرة واحدة — تُحفظ وتُستلم من تبويب المهمات)
const ACH = [
  { id: "a_blood", name: "أول دم 🩸", desc: "اهزم عدواً واحداً", type: "kills", need: 1, reward: 10 },
  { id: "a_hunter", name: "صياد مخضرم 🏹", desc: "اهزم 100 عدو", type: "kills", need: 100, reward: 60 },
  { id: "a_tame", name: "مروض أول 🐾", desc: "أسر مخلوقاً واحداً", type: "captures", need: 1, reward: 15 },
  { id: "a_centi", name: "قاهر أم 44 🪱", desc: "اقتل أم أربعة وأربعين", type: "centiKills", need: 1, reward: 50 },
  { id: "a_siege", name: "كاسر الحصار 🪲", desc: "اقتل خنفساء الحصار", type: "siegeKills", need: 1, reward: 60 },
  { id: "a_rich", name: "ثري المستعمرة 💰", desc: "اجمع مخزون 300🍯", type: "store", need: 300, reward: 40 },
  { id: "a_explore", name: "مستكشف العالم 🗺️", desc: "اكتشف كل المناطق", type: "allregions", reward: 50 },
  { id: "a_wave", name: "صامد الموجات 🌊", desc: "اسحق موجة واحدة بعد النصر", type: "waves", need: 1, reward: 80 },
  { id: "a_wave5", name: "أسطورة الموجات 🏆", desc: "بلغ الموجة 5", type: "bestWave", need: 5, reward: 150 },
];
function dayStr() { return new Date().toISOString().slice(0, 10); }
function statVal(type) {
  if (type === "food") return game.stats.food || 0;
  if (type === "hatch") return game.stats.hatched || 0;
  if (type === "kills") return game.stats.kills || 0;
  if (type === "captures") return game.stats.captures || 0;
  if (type === "upgrades") return game.stats.upgrades || 0;
  if (type === "amber") return game.stats.amber || 0;
  if (type === "termKills") return game.stats.termKills || 0;
  if (type === "bones") return game.stats.bones || 0;
  if (type === "siegeKills") return game.stats.siegeKills || 0;
  if (type === "waves") return game.stats.waves || 0;
  if (type === "bestWave") return game.bestWave || 0;
  if (type === "store") return Math.floor(game.store || 0);
  if (type === "centiKills") return game.stats.centiKills || 0;
  return 0;
}
function questProgress(q, start) {
  const t = q.type;
  if (t === "discover") return game.regions[q.region] ? 1 : 0;
  if (t === "allregions") return regionsCount();
  if (t === "flag") return game.flags[q.flag] ? 1 : 0;
  if (t === "level") return game.level;
  if (t === "discoverAny") return Math.max(0, regionsCount() - ((start && start.regions) || 0));
  const cur = statVal(t);
  const base = (start && start[t] !== undefined) ? start[t] : 0;
  return Math.max(0, cur - base);
}
function questNeed(q) {
  if (q.type === "discover" || q.type === "flag") return 1;
  if (q.type === "allregions") return REGIONS.length;
  return q.need || 1;
}
function ensureDailies() {
  const today = dayStr();
  if (!game.quests) game.quests = { main: 0, mainDone: false, dailies: [], day: "" };
  // 🔥 سلسلة الأيام المتتالية: تُحسب عند أول فتح كل يوم
  if (!game.streak || game.streak.last !== today) {
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const cont = !!(game.streak && game.streak.last === y);
    game.streak = { last: today, count: cont ? (game.streak.count || 0) + 1 : 1 };
  }
  if (game.quests.day === today && game.quests.dailies.length) return;
  let h = 0;
  for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const picked = [];
  let i = 0;
  while (picked.length < 3 && i < 60) {
    const q = DAILY_POOL[(h + i * 3) % DAILY_POOL.length];
    if (!picked.find((p) => p.key === q.id)) {
      picked.push({
        key: q.id, done: false, claimed: false,
        start: { food: game.stats.food || 0, kills: game.stats.kills || 0, captures: game.stats.captures || 0, upgrades: game.stats.upgrades || 0, regions: regionsCount() },
      });
    }
    i++;
  }
  game.quests.dailies = picked;
  game.quests.day = today;
}
function dailyDef(key) { return DAILY_POOL.find((q) => q.id === key); }
function checkQuests() {
  if (!game.quests) return;
  const mq = MAIN_QUESTS[game.quests.main];
  if (mq && !game.quests.mainDone && questProgress(mq) >= questNeed(mq)) {
    game.quests.mainDone = true;
    sfx.level();
    toast(`🎯 مهمة رئيسية مكتملة: ${mq.name}! استلمها من 🌍`);
    saveGame();
  }
  for (const d of game.quests.dailies) {
    if (d.done) continue;
    const def = dailyDef(d.key);
    if (def && questProgress(def, d.start) >= questNeed(def)) {
      d.done = true;
      sfx.level();
      toast(`📜 مهمة يومية مكتملة: ${def.name}! استلمها من 🌍`);
      saveGame();
    }
  }
  // 🏆 فحص الإنجازات الدائمة
  if (!game.ach) game.ach = {};
  for (const a of ACH) {
    const st = game.ach[a.id] || (game.ach[a.id] = {});
    if (!st.done && questProgress(a) >= questNeed(a)) {
      st.done = true;
      sfx.level();
      toast(`🏆 إنجاز جديد: ${a.name}! استلمه من 🌍 ← 📜`);
      saveGame();
    }
  }
}
function claimableQuests() {
  if (!game.quests) return false;
  if (game.quests.mainDone) return true;
  if (game.quests.dailies.some((d) => d.done && !d.claimed)) return true;
  if (game.ach && ACH.some((a) => game.ach[a.id] && game.ach[a.id].done && !game.ach[a.id].claimed)) return true;
  return false;
}
function claimMain() {
  const mq = MAIN_QUESTS[game.quests.main];
  if (!mq || !game.quests.mainDone) return;
  game.store += mq.reward;
  game.quests.mainDone = false;
  game.quests.main = Math.min(MAIN_QUESTS.length, game.quests.main + 1);
  addXP(10);
  sfx.level();
  centerMsg(`🎯 ${mq.name}! +${mq.reward}🍯`);
  saveGame();
  updateHUD();
  renderWorld("quests");
}
function claimDaily(idx) {
  const d = game.quests.dailies[idx];
  if (!d || !d.done || d.claimed) return;
  const def = dailyDef(d.key);
  d.claimed = true;
  // 🔥 مكافأة السلسلة: +1🍯 لكل يوم متتالٍ (حتى +7)
  const bonus = Math.min((game.streak && game.streak.count) || 0, 7);
  game.store = Math.min(storeCap(), game.store + def.reward + bonus);
  addXP(10);
  sfx.deposit();
  toast(`📜 ${def.name}! +${def.reward + bonus}🍯${bonus ? ` (سلسلة 🔥${game.streak.count})` : ""}`);
  saveGame();
  updateHUD();
  renderWorld("quests");
}
function claimAch(id) {
  const a = ACH.find((x) => x.id === id);
  if (!a || !game.ach || !game.ach[id] || !game.ach[id].done || game.ach[id].claimed) return;
  game.ach[id].claimed = true;
  game.store = Math.min(storeCap(), game.store + a.reward);
  addXP(10);
  sfx.deposit();
  toast(`🏆 ${a.name}! +${a.reward}🍯`);
  saveGame();
  updateHUD();
  renderWorld("quests");
}
// ---------- المتجر ----------
const SHOP = [
  { id: "dmg", name: "حدة الفكوك ⚔️", desc: "+20% ضرر الجنود", max: 3, costs: [{ store: 20, nut: 4 }, { store: 40, nut: 6, shell: 4 }, { store: 80, shell: 8, mushroom: 6 }] },
  { id: "spd", name: "أرجل سريعة 🥾", desc: "+8% سرعة الحركة", max: 3, costs: [{ store: 15, nectar: 4 }, { store: 35, nectar: 6, nut: 4 }, { store: 70, nut: 8, shell: 6 }] },
  { id: "hp", name: "دروع كيتين ❤️", desc: "+20 صحة قصوى", max: 3, costs: [{ store: 15, shell: 3 }, { store: 35, shell: 5, mushroom: 3 }, { store: 70, mushroom: 6, nut: 6 }] },
  { id: "cap", name: "حقيبة كبيرة 🎒", desc: "+1 سعة حمل", max: 3, costs: [{ store: 25, nut: 5 }, { store: 50, nut: 8, nectar: 5 }, { store: 90, shell: 8, mushroom: 8 }] },
  { id: "hatch", name: "حضانة متطورة 🐜", desc: "-15% تكلفة الفقس", max: 2, costs: [{ store: 30, nectar: 6 }, { store: 60, nectar: 10, mushroom: 5 }] },
  { id: "mil", name: "العقيدة العسكرية 🎖️", desc: "تقنية عسكرية تفتح مركز التدريب", max: 1, costs: [{ store: 60, nut: 8, shell: 8, mushroom: 6 }] },
];
function shopCostText(cost) {
  const parts = [];
  if (cost.store) parts.push(`${cost.store}🍯`);
  for (const k of Object.keys(cost)) {
    if (k === "store") continue;
    parts.push(`${cost[k]}${(KNOWN_FOODS[k] || {}).icon || k}`);
  }
  return parts.join(" ");
}
function canAfford(cost) {
  if (game.store < (cost.store || 0)) return false;
  for (const k of Object.keys(cost)) {
    if (k === "store") continue;
    if ((game.stock[k] || 0) < cost[k]) return false;
  }
  return true;
}
function payCost(cost) {
  game.store -= cost.store || 0;
  for (const k of Object.keys(cost)) {
    if (k === "store") continue;
    game.stock[k] = Math.max(0, (game.stock[k] || 0) - cost[k]);
  }
}
function buyShop(id) {
  const item = SHOP.find((s) => s.id === id);
  if (!item) return;
  const lvl = (game.mods && game.mods[id]) || 0;
  if (lvl >= item.max) return;
  const cost = item.costs[lvl];
  if (!canAfford(cost)) { toast("🛒 موارد غير كافية"); return; }
  payCost(cost);
  game.mods[id] = lvl + 1;
  game.stats.upgrades = (game.stats.upgrades || 0) + 1;
  addXP(5);
  sfx.hatch();
  toast(`🛒 ${item.name} → مستوى ${lvl + 1}!`);
  saveGame();
  updateHUD();
  renderWorld("shop");
}
// ---------- إعلانات Unity Ads 🎬 (جسر أندرويد — يعمل في نسخة APK فقط) ----------
const AD_REWARD_HONEY = 50;
function hasAdBridge() { try { return typeof window.UnityAdsBridge !== "undefined" && !!window.UnityAdsBridge; } catch { return false; } }
function watchRewardAd() {
  try {
    if (!hasAdBridge()) { toast(t("ad_web")); return; }
    let ready = false;
    try { ready = !!window.__unityAdReady; } catch {}
    if (!ready) { try { ready = !!window.UnityAdsBridge.isReady(); } catch {} }
    if (!ready) {
      // غير جاهز: اطلب تحميلاً جديداً الآن وأخبر اللاعب بالانتظار (تشخيص ذاتي)
      try { window.UnityAdsBridge.loadAd(); } catch {}
      try { if (window.__unityInit === "fail") { toast(t("ad_not_ready")); return; } } catch {}
      let diag = "";
      try { diag = window.UnityAdsBridge.status ? (" — " + window.UnityAdsBridge.status()) : ""; } catch {}
      toast(t("ad_loading") + diag);
      return;
    }
    window.__unityAdReady = false;
    window.UnityAdsBridge.showRewarded();
    sfx.click();
  } catch { toast(t("ad_not_ready")); }
}
window.__unityAdReady = false;
window.__unityInit = "starting"; // ok | fail — تضبطها نسخة الأندرويد
window.__unityLoadErr = ""; // آخر خطأ تحميل من الـ SDK (للتشخيص)
window.__unityReward = function (n) {
  try {
    n = Math.max(1, (n | 0) || AD_REWARD_HONEY);
    game.store = Math.min(storeCap(), (game.store || 0) + n);
    toast(t("ad_earned", { n }));
    sfx.level(); saveGame(); updateHUD();
    try { renderWorld(); } catch {}
  } catch {}
};
window.__unityAdFail = function () { try { window.__unityAdReady = false; toast(t("ad_not_ready")); } catch {} };
// ---------- 🔄 فحص النسخة الجديدةة (للنشر خارج المتجر: سايد-لود) ----------
// ملف صغير أونلاين أحدّثه مع كل إصدار: {"code":655,"name":"6.5.5","url":"..."}
// اللعبة تقارنه برقمها، فإن كانت أقدم تعرض زر التحميل. بلا إنترنت يفشل بصمت.
const GAME_VERSION_CODE = 658;
const GAME_VERSION_NAME = "6.5.8";
const UPDATE_FILE = "antcolony-version";
function updateInfoUrl() {
  try { return "https://editable.uploads.dev/file/" + (window.generatorName || "") + "/" + UPDATE_FILE; }
  catch { return ""; }
}
let pendingUpdateUrl = "", pendingUpdateName = "";
async function fetchUpdateInfo() {
  const url = updateInfoUrl();
  if (!url) return null;
  let ctl = null;
  try {
    ctl = new AbortController();
    const to = setTimeout(() => { try { ctl.abort(); } catch {} }, 10000);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !(j.code | 0)) return null;
      return j;
    } finally { clearTimeout(to); }
  } catch { return null; }
}
function openUpdateUrl() {
  try {
    if (!pendingUpdateUrl) return;
    // داخل تطبيق الأندرويد: التنقل يفتح المتصفح الخارجي للروابط الخارجية
    if (hasAdBridge()) location.href = pendingUpdateUrl;
    else window.open(pendingUpdateUrl, "_blank", "noopener");
  } catch {}
}
async function checkUpdate(manual) {
  try {
    const j = await fetchUpdateInfo();
    if (!j) { if (manual) toast(t("upd_err")); return; }
    if ((j.code | 0) > GAME_VERSION_CODE) {
      pendingUpdateName = j.name || ("v" + j.code);
      // رابط التحميل يضعه المطور بملف النسخة لاحقاً (موقعه الخاص) — فراغ يعني: تنبيه فقط بلا زر تحميل خارجي
      pendingUpdateUrl = j.url || "";
      try { localStorage.setItem("ant-colony-update", JSON.stringify({ code: j.code | 0, name: pendingUpdateName, url: pendingUpdateUrl })); } catch {}
      toast(t("upd_new", { n: pendingUpdateName }));
    } else {
      pendingUpdateUrl = ""; pendingUpdateName = "";
      try { localStorage.removeItem("ant-colony-update"); } catch {}
      if (manual) toast(t("upd_ok", { v: GAME_VERSION_NAME }));
    }
    try { renderSettings(); } catch {}
  } catch { if (manual) { try { toast(t("upd_err")); } catch {} } }
}
function restoreUpdateFlag() {
  try {
    const s = localStorage.getItem("ant-colony-update");
    if (!s) return;
    const j = JSON.parse(s);
    if ((j.code | 0) > GAME_VERSION_CODE) { pendingUpdateUrl = j.url || ""; pendingUpdateName = j.name || ("v" + j.code); }
    else localStorage.removeItem("ant-colony-update");
  } catch {}
}
function autoUpdateCheck() {
  try {
    const last = +(localStorage.getItem("ant-colony-update-ts") || 0);
    if (Date.now() - last < 24 * 3600 * 1000) return;
    try { localStorage.setItem("ant-colony-update-ts", String(Date.now())); } catch {}
  } catch {}
  checkUpdate(false);
}
// ---------- إشعارات محلية 📢 (جسر أندرويد LocalNotify — تعمل أوفلاين، بلا إذن) ----------
// العنوان ثابت (اسم اللعبة) والنص من مفاتيح nt_* — تُجدول فقط عند الحاجة
function pingLater(key, secs, id) {
  try {
    const b = window.LocalNotify; if (!b) return false;
    secs = Math.max(10, Math.min(4 * 3600, Math.round(secs || 60)));
    b.schedule(t("app_name"), t(key), secs | 0, id | 0);
    return true;
  } catch { return false; }
}
function pingCancel(id) { try { if (window.LocalNotify) window.LocalNotify.cancel(id | 0); } catch {} }
function pingCancelAll() { try { for (let i = 1; i <= 5; i++) pingCancel(i); } catch {} }
// ---------- الأحداث العشوائية ----------
let eventT = 70;
function triggerEvent() {
  const P = game.player;
  const roll = Math.random();
  if (roll < 0.3) {
    // حشرة نادرة قريبة
    const key = Math.random() < 0.5 ? "monarch" : Math.random() < 0.5 ? "rhino" : "wolf";
    const c = spawnCreature(key);
    c.x = THREE.MathUtils.clamp(P.x + rand(-12, 12), -TUNE.worldHalf, TUNE.worldHalf);
    c.z = THREE.MathUtils.clamp(P.z + rand(-12, 12), -TUNE.worldHalf, TUNE.worldHalf);
    c.tx = c.x; c.tz = c.z;
    centerMsg(`✨ ${CREATURE_SPECIES[key].icon} مخلوق نادر ظهر قربك!`);
  } else if (roll < 0.55) {
    // موجة خنافس مفاجئة
    for (let i = 0; i < 3; i++) {
      const b = createBeetle();
      b.x = THREE.MathUtils.clamp(P.x + rand(-14, 14), -TUNE.worldHalf, TUNE.worldHalf);
      b.z = THREE.MathUtils.clamp(P.z + rand(-14, 14), -TUNE.worldHalf, TUNE.worldHalf);
      b.group.position.set(b.x, 0, b.z);
      game.beetles.push(b);
    }
    centerMsg("🪲 هجوم خنافس مفاجئ! استعد!");
    sfx.hit();
  } else if (roll < 0.75) {
    // غارة مضاعفة (تخضع لوقت الهدوء العام + الجاهزية الكاملة)
    let any = false;
    if ((game.raidCd || 0) <= 0 && (game.level || 1) >= 3 && game.flags.warnRaid && raidFullReady()) {
      for (const col of game.colonies) {
        if (col.alive && colonyUnits(col).length > 2 && launchRaid(col)) any = true;
      }
    }
    if (!any) {
      for (let i = 0; i < 6; i++) { const p = randPos(4, 8); try { spawnFood(P.x + rand(-8, 8), P.z + rand(-8, 8)); } catch {} }
      toast("🌧️ مطر طعام حولك!");
    }
  } else {
    // مطر طعام
    const kinds = ["seed", "leaf", "fruit", "nut", "nectar"];
    for (let i = 0; i < 8; i++) {
      try { spawnFood(P.x + rand(-9, 9), P.z + rand(-9, 9), kinds[(Math.random() * kinds.length) | 0]); } catch {}
    }
    centerMsg("🌧️ مطر طعام! اجمع بسرعة!");
    sfx.deposit();
  }
}
// ---------- لوحة مركز العلاج والتطور 🧬 ----------
let geneTab = "sick";
function openGenePanel() {
  if (Nest.geneLevel() <= 0) { toast("🧬 ابنِ مركز العلاج والتطور أولاً"); return; }
  els.beastPanel.hidden = true;
  els.worldPanel.hidden = true;
  els.genePanel.hidden = false;
  renderGenePanel();
  sfx.click();
}
function renderGenePanel(tab) {
  if (tab) geneTab = tab;
  if (els.genePanel.hidden) return;
  const tabs = { sick: els.geneTabSick, heal: els.geneTabHeal, eggs: els.geneTabEggs, gene: els.geneTabGene, up: els.geneTabUp };
  document.querySelectorAll("#geneTabs button").forEach((b) => b.classList.remove("sel"));
  if (tabs[geneTab]) tabs[geneTab].classList.add("sel");
  const cl = geneCenter();
  const lv = Nest.geneLevel();
  const body = els.geneBody;
  body.innerHTML = "";
  els.geneSub.textContent = `🧬 مستوى ${lv}/7 — ⚔️${geneUpVal("atk")} 🛡️${geneUpVal("def")} 🐜${geneUpVal("work")} 🦴${geneUpVal("bone")} — 🛏️ ${cl.beds.length}/${Nest.geneBeds()} 🥚 ${cl.inc.length}/${Nest.geneInc()}`;
  const card = (icon, name, stats, btns) => {
    const d = document.createElement("div");
    d.className = "beastCard";
    d.innerHTML = `<div class="beastIco">${icon}</div><div class="beastInfo"><div class="beastName">${name}</div><div class="beastStats">${stats}</div><div class="beastBtns"></div></div>`;
    const bb = d.querySelector(".beastBtns");
    for (const b of btns) bb.appendChild(b);
    body.appendChild(d);
    return d;
  };
  const mkBtn = (txt, cls, fn, dis) => {
    const b = document.createElement("button");
    b.className = cls;
    b.textContent = txt;
    b.disabled = !!dis;
    b.onclick = fn;
    return b;
  };
  if (geneTab === "sick") {
    const list = injuredUnits();
    if (!list.length) {
      const d = document.createElement("div");
      d.className = "wsec";
      d.textContent = "💚 لا مصابين — جيشك بكامل صحته!";
      body.appendChild(d);
    }
    for (const u of list.slice(0, 12)) {
      const frac = Math.round((u.hp / u.maxHp) * 100);
      const serious = u.hp < u.maxHp * 0.5 ? " (خطيرة!)" : "";
      const hc = healCostFor(u);
      card(unitIcon(u), `${unitLabel(u)}`, `❤️ ${Math.round(u.hp)}/${u.maxHp} (${frac}%)${serious} — علاج: ${Math.round(hc.tTotal)}ث + ${healNeedText(hc.need)}`,
        [mkBtn("🛏️ إدخال للعلاج", "beastUp", () => { admitToClinic(u); renderGenePanel(); }, cl.beds.length >= Nest.geneBeds())]);
    }
  } else if (geneTab === "heal") {
    if (!cl.beds.length) {
      const d = document.createElement("div");
      d.className = "wsec";
      d.textContent = "🛏️ لا نمل قيد العلاج — أدخل المصابين من تبويب المصابين";
      body.appendChild(d);
    }
    for (const b of cl.beds) {
      const pct = Math.round(((b.tTotal - b.tLeft) / b.tTotal) * 100);
      const left = Math.max(0, Math.ceil(b.tLeft));
      card("🛏️", `${b.kind === "soldier" ? "⚔️ جندي" : b.kind === "scout" ? "🔭 كشاف" : b.kind === "ally" ? "🐾 حليف" : "🐜 عامل"} — يتعافى...`,
        `❤️ ${Math.round(b.hp)}/${b.maxHp} — ${pct}% (متبقٍ ${left}ث)<div class="qbar"><div style="width:${pct}%"></div></div>`, []);
    }
  } else if (geneTab === "eggs") {
    // ⭐ طلبات النخبة: ادفع عسل + اختار العدد — البيض الجاي يتحوّل للمختبر ويطلع ذهبياً، ومن يخلص العدد يرجع عادياً
    const esec = document.createElement("div");
    esec.className = "wsec";
    esec.textContent = "⭐ اطلب نخبة ذهبية — البيض الجاي من هذا النوع يفقس مطوراً بلون مميز 👑";
    body.appendChild(esec);
    for (const kind of ["worker", "soldier", "scout"]) {
      const rem = eliteRemain(kind);
      const pick = elitePick[kind] || 10;
      const per = ELITE_COST[kind] || 3;
      const kn = ELITE_NAME[kind] || kind;
      const kicon = kind === "soldier" ? "⚔️" : kind === "scout" ? "🔭" : "🐜";
      const btns = [
        mkBtn("−5", "beastGo", () => { elitePick[kind] = Math.max(5, pick - 5); renderGenePanel(); }),
        mkBtn("+5", "beastGo", () => { elitePick[kind] = Math.min(50, pick + 5); renderGenePanel(); }),
        mkBtn(`⭐ اطلب ×${pick} (${pick * per}🍯)`, "beastUp", () => { buyElite(kind, elitePick[kind] || 10); renderGenePanel(); }, game.store < pick * per),
      ];
      if (rem > 0) btns.push(mkBtn(`❌ إلغاء (استرداد ${rem * per}🍯)`, "beastGo", () => { cancelElite(kind); renderGenePanel(); }));
      card(`${kicon}⭐`, `نخبة ${kn}${rem > 0 ? ` — ⏳ متبقي ${rem}` : ""}`,
        `${ELITE_DESC[kind]} — لون ذهبي مميز${rem > 0 ? ` — اضبط بيض الملكة على ${kn} من غرفتها 👑` : ""}`,
        btns);
    }
    const brood = Nest.broodList();
    const upTotal = geneUpVal("atk") + geneUpVal("def") + geneUpVal("work") + geneUpVal("bone");
    const h = document.createElement("div");
    h.className = "wsec";
    h.textContent = `🥚 بيض الحضانة: ${brood.length}${upTotal > 0 ? " — ترقياتك العامة تشمله 🧬" : ""}`;
    body.appendChild(h);
    for (const b of brood.slice(0, 10)) {
      const stg = b.stage === "egg" ? "🥚 بيضة" : b.stage === "larva" ? "🐛 يرقة" : "🌀 شرنقة";
      const isElite = !!(b.gene && b.gene.elite);
      card(isElite ? "🧪⭐" : stg, `${b.kind === "soldier" ? "⚔️ جندي" : b.kind === "scout" ? "🔭 كشاف" : "🐜 عامل"}${isElite ? " ⭐ نخبة" : (b.gene || upTotal > 0) ? " 🧬" : ""}`,
        isElite ? "في المختبر 🧪 — سيفقس ذهبياً مطوراً 👑" : (upTotal > 0 ? "بيض مطوّر 👑 — سيفقس أقوى بفضل ترقيات الجينات" : "المرحلة تنمو تلقائياً — التطوير من تبويب 🧪 جينات"),
        []);
    }
  } else if (geneTab === "gene") {
    const hint = document.createElement("div");
    hint.className = "wsec";
    hint.textContent = "👑 الملكة تبيض بيضاً مطوراً تلقائياً — كل ترقية تشمل جيشك الحالي والبيض الجديد معاً، بلا مشاريع ولا انتظار!";
    body.appendChild(hint);
    for (const key of Object.keys(GENE_UPS)) {
      const t = GENE_UPS[key];
      const ulv = geneUpVal(key);
      const maxed = ulv >= t.max;
      let pips = "";
      for (let i = 0; i < t.max; i++) pips += i < ulv ? "●" : "○";
      const cost = maxed ? null : t.costs[ulv];
      card(t.icon, `${t.name} — ${ulv}/${t.max} ${pips}`,
        maxed ? `${t.effect} (كل مستوى) — ★ الأقصى!` : `${t.effect} (كل مستوى) — التالي: ${geneModCostText({ cost })}`,
        [mkBtn(maxed ? "MAX" : "⬆️ تطوير", "beastUp", () => { buyGeneUp(key); renderGenePanel(); }, maxed || !canPayGene(cost))]);
    }
  } else {
    const hintUp = document.createElement("div");
    hintUp.className = "wsec";
    hintUp.textContent = "💡 الترقيات الدائمة للجيش في تبويب 🧪 جينات — من هنا رقِّ المبنى فقط";
    body.appendChild(hintUp);
    // التطوير: مستوى المركز + درع العمال + مختبر اليرقات
    card("🧬", `مركز العلاج والتطور — مستوى ${lv}/7`,
      lv >= 7 ? "الحد الأقصى — كل القدرات مفتوحة!" : `الترقية تفتح: أسرّة وحاضنات وجينات جديدةة — من لوحة الغرفة 🔨`,
      [mkBtn(lv >= 7 ? "MAX" : "🔨 ترقية من لوحة الغرفة", "beastUp", () => { els.genePanel.hidden = true; Nest.focusGeneRoom(); }, lv >= 7)]);
    const wc = warmorUpCost();
    card("🛡️", `درع العمال — مستوى ${cl.warmor || 0}/5`,
      `كل مستوى: +8 صحة لكل عامل/كشاف وامتصاص أكبر — العامل يدافع عن نفسه فقط${lv < 3 ? " (يحتاج مركز 3)" : ""} — ${geneModCostText({ cost: wc })}`,
      [mkBtn((cl.warmor || 0) >= 5 ? "MAX" : "🛡️ تطوير الدرع", "beastUp", () => { buyWarmor(); renderGenePanel(); }, (cl.warmor || 0) >= 5 || lv < 3 || !canPayGene(wc))]);
    const lc = larvaUpCost();
    card("🐛", `مختبر اليرقات — مستوى ${cl.larva || 0}/3`,
      `البيض الجديد يفقس أقوى (صحة/دفاع/تجدد)${lv < 2 ? " (يحتاج مركز 2)" : ""} — ${geneModCostText({ cost: lc })}`,
      [mkBtn((cl.larva || 0) >= 3 ? "MAX" : "🐛 تطوير المختبر", "beastUp", () => { buyLarva(); renderGenePanel(); }, (cl.larva || 0) >= 3 || lv < 2 || !canPayGene(lc))]);
  }
}
function unitIcon(u) {
  if (u.kind === "soldier") return u.vicon || "⚔️";
  if (u.kind === "scout") return "🔭";
  if (u.kind === "ally") return u.icon || "🐾";
  return "🐜";
}
// اختيار البيضة أولاً ثم الجين (تدفق من تبويب البيوض)
let genePendingEgg = null;
function genePickForEgg(eggId) {
  genePendingEgg = eggId;
  renderGenePanel("gene");
  toast("🧪 اختر التعديل الجيني لهذه البيضة");
}
let geneRiskArm = null;
function genePickEgg(geneKey) {
  const eggs = Nest.broodList();
  if (!eggs.length) { toast("🥚 لا بيض في الحضانة"); return; }
  const egg = (genePendingEgg && eggs.find((b) => b.id === genePendingEgg)) || eggs[0];
  const m = GENE_MODS[geneKey];
  if (m && m.success < 1) {
    const now = performance.now();
    const same = geneRiskArm && geneRiskArm.egg === egg.id && geneRiskArm.key === geneKey && now - geneRiskArm.t < 4000;
    if (!same) {
      geneRiskArm = { egg: egg.id, key: geneKey, t: now };
      genePendingEgg = egg.id;
      toast(`⚠️ ${m.name}: نجاح ${Math.round(m.success * 100)}% — الفشل يُبقي البيضة ويستهلك الموارد — اضغط مجدداً للتأكيد`);
      renderGenePanel();
      return;
    }
    geneRiskArm = null;
  }
  genePendingEgg = null;
  if (startGeneProject(egg.id, geneKey)) renderGenePanel();
}
// ---------- لوحة مركز التدريب العسكري 🎖️ ----------
let trainTab = "conv";
function openTrainPanel() {
  if (Nest.trainLevel() <= 0) { toast("🎖️ ابنِ مركز التدريب العسكري أولاً (من العش تحت الأرض)"); return; }
  els.beastPanel.hidden = true;
  els.genePanel.hidden = true;
  els.worldPanel.hidden = true;
  els.trainPanel.hidden = false;
  renderTrain();
  sfx.click();
}
function renderTrain(tab) {
  if (tab) trainTab = tab;
  if (els.trainPanel.hidden) return;
  const tabs = { conv: els.trainTabConv, sold: els.trainTabSold, yard: els.trainTabYard, up: els.trainTabUp };
  document.querySelectorAll("#trainTabs button").forEach((b) => b.classList.remove("sel"));
  if (tabs[trainTab]) tabs[trainTab].classList.add("sel");
  const lv = Nest.trainLevel();
  const ts = Nest.trainState();
  const body = els.trainBody;
  body.innerHTML = "";
  els.trainSub.textContent = `🎖️ مستوى ${lv}/5 — ساحات ${ts.slots.length}/${Nest.trainSlots()} — الرتب حتى 👑 أسطوري`;
  const card = (icon, name, stats, btns) => {
    const d = document.createElement("div");
    d.className = "beastCard";
    d.innerHTML = `<div class="beastIco">${icon}</div><div class="beastInfo"><div class="beastName">${name}</div><div class="beastStats">${stats}</div><div class="beastBtns"></div></div>`;
    const bb = d.querySelector(".beastBtns");
    for (const b of btns) bb.appendChild(b);
    body.appendChild(d);
    return d;
  };
  const mkBtn = (txt, cls, fn, dis) => {
    const b = document.createElement("button");
    b.className = cls;
    b.textContent = txt;
    b.disabled = !!dis;
    b.onclick = fn;
    return b;
  };
  const sec = (txt) => {
    const d = document.createElement("div");
    d.className = "wsec";
    d.textContent = txt;
    body.appendChild(d);
  };
  if (trainTab === "conv") {
    sec(`🔄 حوّل عاملاً 🐜 إلى جندي ⚔️ مبتدئ — يستهلك العامل + ${trainCostText(CONVERT_NEED.cost)} + ${CONVERT_NEED.time}ث — الجنود ${countKind("soldier")}/${capFor("soldier")}`);
    // 🎖️ اختيار نوع الجندي (بدل التناوب العشوائي)
    {
      const cur = game.soldierFocus || "mix";
      const opts = [{ key: "mix", icon: "🔀", name: "خليط", hint: "تناوب تلقائي" },
        ...SOLDIER_VARIANTS.map((v) => ({ key: v.key, icon: v.icon, name: v.name, hint: `${v.hp}❤️ ${v.dmg}💥${v.desc ? " — " + v.desc : ""}` }))];
      const row = document.createElement("div");
      row.className = "beastBtns";
      row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px;";
      for (const o of opts) {
        const b = document.createElement("button");
        b.className = "beastUp";
        b.textContent = `${o.icon} ${o.name}${cur === o.key ? " ✅" : ""}`;
        b.title = o.hint;
        b.disabled = cur === o.key;
        b.onclick = () => { game.soldierFocus = o.key; saveGame(); sfx.click(); toast(`🎖️ نوع الجندي: ${o.icon} ${o.name} — ${o.hint}`); renderTrain(); };
        row.appendChild(b);
      }
      const wrap = document.createElement("div");
      wrap.className = "wsec";
      wrap.textContent = "🎖️ نوع الجنود الجدد:";
      body.appendChild(wrap);
      body.appendChild(row);
    }
    const ws = game.workers.filter((w) => !w.inClinic && !w.inTraining);
    if (!ws.length) sec("🐜 لا عمال متاحين — افقس عمالاً أولاً");
    for (const w of ws.slice(0, 8)) {
      card("🐜", `عامل — ❤️ ${Math.round(w.hp)}/${w.maxHp}`,
        `سيصبح جندياً مبتدئاً 🌱 بعد ${CONVERT_NEED.time}ث`,
        [mkBtn("🔄 تحويل لجندي", "beastUp", () => { if (convertWorkerToSoldier(w.uid)) renderTrain(); }, trainSlotsFree() <= 0 || !canAdd("soldier"))]);
    }
  } else if (trainTab === "sold") {
    const ss = game.soldiers.filter((s) => !s.dying);
    if (!ss.length) sec("⚔️ لا جنود بعد — حوّل عاملاً أو افقس جندياً من الثكنة");
    for (const s of ss.slice(0, 10)) {
      const r = TRAIN_RANKS[trainRankOf(s)];
      const xp = (s.tr && s.tr.xp) || 0;
      const next = TRAIN_RANKS[trainRankOf(s) + 1];
      const pct = next ? Math.min(100, Math.round((xp / next.xp) * 100)) : 100;
      const busy = s.inTraining ? " (يتدرب الآن ⏳)" : s.inClinic ? " (في العيادة 🛏️)" : "";
      card(s.vicon || "⚔️", `${unitLabel(s)}${busy}`,
        `${trainRankText(s)} — ⚔️${s.dmg} 🛡️${s.def} 👟${Math.round(s.spd * 10) / 10} ❤️${s.maxHp}<div class="qbar"><div style="width:${pct}%"></div></div>` +
        (s.inTraining ? "" : `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${Object.keys(TRAIN_FOCUS).map((k) => {
          const f = TRAIN_FOCUS[k];
          const lock = (f.needLv && lv < f.needLv) ? ` (م${f.needLv})` : "";
          return `<button class="beastUp" style="flex:1;padding:6px 2px;border-radius:8px;border:none;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;" data-f="${k}" ${((f.needLv && lv < f.needLv) || trainSlotsFree() <= 0) ? "disabled" : ""}>${f.icon} ${f.name}${lock}</button>`;
        }).join("")}</div>`),
        s.inTraining ? [] : [mkBtn(lv >= 3 ? "🌟 نخبة شاملة" : "⚔️ تدريب هجوم", "beastGo", () => { if (startTrainCycle(s.uid, lv >= 3 ? "vet" : "atk")) renderTrain(); }, trainSlotsFree() <= 0)]);
      const last = body.lastChild;
      if (last && !s.inTraining) {
        last.querySelectorAll("[data-f]").forEach((b) => {
          b.onclick = () => { if (startTrainCycle(s.uid, b.getAttribute("data-f"))) renderTrain(); };
        });
      }
    }
  } else if (trainTab === "yard") {
    if (!ts.slots.length) sec("⏳ لا تدريب جارٍ — ابدأ من تبويبي التحويل والجنود");
    for (const sl of ts.slots) {
      const pct = Math.round(((sl.tTotal - sl.tLeft) / sl.tTotal) * 100);
      const left = Math.max(0, Math.ceil(sl.tLeft));
      if (sl.mode === "conv") {
        card("🔄", "تحويل عامل ← جندي", `يتدرب في الساحة... ${pct}% (متبقٍ ${left}ث)<div class="qbar"><div style="width:${pct}%"></div></div>`, []);
      } else {
        const f = TRAIN_FOCUS[sl.focus];
        const u = findUnitByUid(sl.uid);
        card("⏳", `${u ? unitLabel(u) : "⚔️ جندي"} — ${f ? f.icon + " " + f.name : "تدريب"}`,
          `+${sl.xpGain} خبرة ${f ? "— " + f.desc : ""} — ${pct}% (متبقٍ ${left}ث)<div class="qbar"><div style="width:${pct}%"></div></div>`, []);
      }
    }
    sec("⚔️ المتدربون يتقاتلون تجريبياً في الساحة قرب العش — شاهدهم!");
  } else {
    card("🎖️", `مركز التدريب — مستوى ${lv}/5`,
      lv >= 5 ? "الحد الأقصى — 3 ساحات + كل التدريبات!" : "الترقية تزيد الساحات (+1 كل مستويين) وخبرة الدورات +15% — من لوحة الغرفة 🔨",
      [mkBtn(lv >= 5 ? "MAX" : "🔨 ترقية من لوحة الغرفة", "beastUp", () => { els.trainPanel.hidden = true; Nest.focusTrainRoom(); }, lv >= 5)]);
    sec("🔒 شروط الفتح: مستوى 6 + العقيدة العسكرية 🎖️ + 15 انتصاراً + 10 فقس + موارد نادرة كبيرة");
    sec("🌱 مبتدئ (0) ← 🎖️ مدرب (100) ← ⚔️ محترف (250) ← 🔥 نخبة (500) ← 👑 أسطوري (900) — كل رتبة +2⚔️ +2🛡️ +12❤️");
  }
}
// ---------- لوحة العالم والمهمات والمتجر ----------
let worldTab = "regions";
function renderWorld(tab) {
  if (tab) worldTab = tab;
  if (els.worldPanel.hidden) return;
  document.querySelectorAll("#worldTabs button").forEach((b) => b.classList.remove("sel"));
  const tb = { regions: els.wtabRegions, quests: els.wtabQuests, shop: els.wtabShop }[worldTab];
  if (tb) tb.classList.add("sel");
  const body = els.worldBody;
  body.innerHTML = "";
  if (worldTab === "regions") {
    for (const r of REGIONS) {
      const known = r.start || (game.regions && game.regions[r.id]);
      const card = document.createElement("div");
      card.className = "beastCard" + (known && !r.start ? " deployed" : "");
      const res = r.kind ? `${KNOWN_FOODS[r.kind].icon} ${KNOWN_FOODS[r.kind].name} (قيمة ${KNOWN_FOODS[r.kind].value}🍯)` : "موارد متنوعة";
      card.innerHTML = `<div class="beastIco">${known ? r.icon : "❓"}</div>` +
        `<div class="beastInfo"><div class="beastName">${known ? r.name : "؟؟؟"}</div>` +
        `<div class="beastStats">${known ? res : "اكتشفها بالدخول إليها (+10🍯)"}</div></div>`;
      if (r.id === "forest" && known && game.regions && !game.regions.tree) {
        const gb = document.createElement("div");
        gb.className = "beastBtns";
        const b = document.createElement("button");
        b.className = "beastUp";
        b.textContent = "🧭 إرشاد للبوابة الذهبية";
        b.onclick = () => { game._guideUntil = performance.now() + 90000; toast("🧭 اتبع السهم الذهبي فوق العش حتى الحلقة الذهبية قرب الخشبة!"); sfx.click(); };
        gb.appendChild(b);
        card.appendChild(gb);
      }
      body.appendChild(card);
    }
  } else if (worldTab === "quests") {
    const h = document.createElement("div");
    h.className = "wsec";
    h.textContent = `⭐ مستواك ${game.level} (${game.xp || 0}/${xpNeed(game.level)} خبرة)` + ((game.streak && game.streak.count > 1) ? ` 🔥 سلسلة ${game.streak.count} أيام` : "");
    body.appendChild(h);
    // 🌊 بطاقة الموجات اللانهائية (بعد النصر)
    if (game.victory) {
      const busy = game.colonies.some((c) => c.alive);
      const wc = document.createElement("div");
      wc.className = "beastCard deployed";
      wc.innerHTML = `<div class="beastIco">🌊</div><div class="beastInfo"><div class="beastName">الموجات اللانهائية — الحالية ${game.wave || 0} / الأفضل 🏆${game.bestWave || 0}</div>` +
        `<div class="beastStats">${busy ? "الموجة مشتعلة: دمّر المستعمرتين معاً لسحقها!" : "المستعمرتان ساقطتان — جاهز للتالية؟ (+50% قوة/موجة، غارات أسرع)"}</div><div class="beastBtns"></div></div>`;
      const wb = document.createElement("button");
      wb.className = "beastUp";
      wb.textContent = busy ? "⚔️ اقضِ عليهما أولاً" : `🌊 بدء الموجة ${(game.wave || 0) + 1}`;
      wb.disabled = busy;
      wb.onclick = () => { startNextWave(); };
      wc.querySelector(".beastBtns").appendChild(wb);
      body.appendChild(wc);
    }
    // رئيسية
    const mq = MAIN_QUESTS[game.quests.main];
    if (mq) {
      const pr = Math.min(questNeed(mq), questProgress(mq));
      const card = document.createElement("div");
      card.className = "beastCard deployed";
      card.innerHTML = `<div class="beastIco">🎯</div><div class="beastInfo"><div class="beastName">${mq.name}</div>` +
        `<div class="beastStats">${mq.desc} — ${pr}/${questNeed(mq)}</div><div class="qbar"><div style="width:${Math.round((pr / questNeed(mq)) * 100)}%"></div></div>` +
        `<div class="beastBtns"></div></div>`;
      const btns = card.querySelector(".beastBtns");
      const b = document.createElement("button");
      b.className = "beastUp";
      b.textContent = `🎁 استلام (+${mq.reward}🍯)`;
      b.disabled = !game.quests.mainDone;
      b.onclick = () => claimMain();
      btns.appendChild(b);
      body.appendChild(card);
    } else {
      const d = document.createElement("div");
      d.className = "wsec";
      d.textContent = "🏆 أنهيت كل المهمات الرئيسية! أسطورة!";
      body.appendChild(d);
    }
    // يومية
    const dh = document.createElement("div");
    dh.className = "wsec";
    dh.textContent = "📜 مهمات اليوم (تتجدد يومياً)";
    body.appendChild(dh);
    game.quests.dailies.forEach((dd, i) => {
      const def = dailyDef(dd.key);
      if (!def) return;
      const pr = Math.min(questNeed(def), questProgress(def, dd.start));
      const card = document.createElement("div");
      card.className = "beastCard" + (dd.done ? " deployed" : "");
      card.innerHTML = `<div class="beastIco">📜</div><div class="beastInfo"><div class="beastName">${def.name}</div>` +
        `<div class="beastStats">${def.desc} — ${pr}/${questNeed(def)}</div><div class="qbar"><div style="width:${Math.round((pr / questNeed(def)) * 100)}%"></div></div>` +
        `<div class="beastBtns"></div></div>`;
      const btns = card.querySelector(".beastBtns");
      const b = document.createElement("button");
      b.className = "beastUp";
      b.textContent = dd.claimed ? "✅ مُستلمت" : `🎁 استلام (+${def.reward}🍯)`;
      b.disabled = !dd.done || dd.claimed;
      b.onclick = () => claimDaily(i);
      btns.appendChild(b);
      body.appendChild(card);
    });
    // 🏆 الإنجازات الدائمة
    const ah = document.createElement("div");
    ah.className = "wsec";
    const achDone = ACH.filter((a) => game.ach && game.ach[a.id] && game.ach[a.id].done).length;
    ah.textContent = `🏆 الإنجازات (${achDone}/${ACH.length})`;
    body.appendChild(ah);
    if (!game.ach) game.ach = {};
    for (const a of ACH) {
      const st = game.ach[a.id] || {};
      const pr = Math.min(questNeed(a), questProgress(a));
      const card = document.createElement("div");
      card.className = "beastCard" + (st.done ? " deployed" : "");
      card.innerHTML = `<div class="beastIco">${st.claimed ? "✅" : st.done ? "🏆" : "🔒"}</div><div class="beastInfo"><div class="beastName">${a.name}</div>` +
        `<div class="beastStats">${a.desc} — ${pr}/${questNeed(a)}</div><div class="qbar"><div style="width:${Math.round((pr / questNeed(a)) * 100)}%"></div></div>` +
        `<div class="beastBtns"></div></div>`;
      const ab = document.createElement("button");
      ab.className = "beastUp";
      ab.textContent = st.claimed ? "✅ مُستلمت" : `🎁 استلام (+${a.reward}🍯)`;
      ab.disabled = !st.done || st.claimed;
      ab.onclick = () => claimAch(a.id);
      card.querySelector(".beastBtns").appendChild(ab);
      body.appendChild(card);
    }
  } else {
    const h = document.createElement("div");
    h.className = "wsec";
    const stockTxt = Object.keys(KNOWN_FOODS).map((k) => `${KNOWN_FOODS[k].icon}${game.stock[k] || 0}`).join(" ");
    h.textContent = `🛒 مواردك: ${game.store}🍯 ${stockTxt}`;
    body.appendChild(h);
    // 🎬 بطاقة إعلان المكافأة (Unity Ads — نسخة الأندرويد فقط)
    const adCard = document.createElement("div");
    adCard.className = "beastCard deployed";
    adCard.innerHTML = `<div class="beastIco">🎬</div><div class="beastInfo"><div class="beastName">${t("ad_watch", { n: AD_REWARD_HONEY })}</div><div class="beastBtns"></div></div>`;
    const adBtn = document.createElement("button");
    adBtn.className = "beastUp";
    adBtn.textContent = `🎬 +${AD_REWARD_HONEY}🍯`;
    adBtn.onclick = () => watchRewardAd();
    adCard.querySelector(".beastBtns").appendChild(adBtn);
    body.appendChild(adCard);
    for (const item of SHOP) {
      const lvl = (game.mods && game.mods[item.id]) || 0;
      const maxed = lvl >= item.max;
      const card = document.createElement("div");
      card.className = "beastCard" + (lvl ? " deployed" : "");
      let pips = "";
      for (let i = 0; i < item.max; i++) pips += i < lvl ? "●" : "○";
      card.innerHTML = `<div class="beastIco">${item.name.split(" ").pop()}</div><div class="beastInfo"><div class="beastName">${item.name} <span class="beastRar" style="background:#2f6b22">${pips}</span></div>` +
        `<div class="beastStats">${item.desc}</div><div class="beastBtns"></div></div>`;
      const btns = card.querySelector(".beastBtns");
      const b = document.createElement("button");
      b.className = "beastUp";
      b.textContent = maxed ? "MAX" : `شراء (${shopCostText(item.costs[lvl])})`;
      b.disabled = maxed || !canAfford(item.costs[lvl]);
      b.onclick = () => buyShop(item.id);
      btns.appendChild(b);
      body.appendChild(card);
    }
  }
}

// ---------- الإدخال: عصا تحكم باللمس + لوحة مفاتيح + تقريب ----------
const input = {
  jx: 0, jy: 0, active: false,
  keys: {},
  camDist: 30, camTarget: 30,
  camPanX: 0, camPanZ: 0, // إزاحة الكاميرا في وضع التحديد (تُطرح من موضع اللاعب)
  panVX: 0, panVZ: 0, panActive: false, // زخم الكاميرا للتحريك السلس باللمس
};
function setupInput() {
  const root = els.gameRoot || document.getElementById("gameRoot");
  const pointers = new Map();
  let panId = null, panLX = 0, panLY = 0;
  let pinchD0 = 0, pinchDist0 = 30, midLX = 0, midLY = 0;
  // مخطط اللمس: لمس+تحريك = كاميرا | لمس مطوّل (450ms) ثم سحب = مربع تحديد | لمستان على وحدة = تحديد نوعها
  let boxStart = null, boxCur = null, boxing = false;
  let lpTimer = null, lpFired = false, lpX = 0, lpY = 0; // مؤقت اللمس المطوّل
  let panning = false; // سحب الكاميرا بإصبع واحد (لمس)
  let lastTapT = 0, lastTapX = 0, lastTapY = 0; // كشف اللمسة المزدوجة
  const LONG_PRESS_MS = 450, LP_MOVE_PX = 14, DBL_MS = 350, DBL_PX = 36;
  const isTouchEv = (e) => !e.pointerType || e.pointerType !== "mouse";

  function isUI(t) { return t && t.closest && t.closest("button, #helpCard, #actionCtn, #menuBtn, #cmdBar, #mapStack, #editBanner, #editTool, #zoomCtn, #mapWrap, #mapOpenBtn, #topBar, #resBar, #beastPanel, #genePanel, #worldPanel, #roomPanel, #buildMenu, #underBar, #startScreen, #pausePanel, #settingsPanel, #aboutPanel"); }

  // تحريك الكاميرا الحرة بإصبعين + تقريب (يعمل دائماً على السطح)
  function pinchPan() {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD0 > 20) input.camTarget = THREE.MathUtils.clamp(pinchDist0 * (pinchD0 / Math.max(30, d)), 14, 150);
    if (game.player) {
      const k = input.camDist / 500, H = TUNE.worldHalf;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = mx - midLX, dy = my - midLY;
      input.camPanX = THREE.MathUtils.clamp(input.camPanX + dx * k, game.player.x - H, game.player.x + H);
      input.camPanZ = THREE.MathUtils.clamp(input.camPanZ + dy * k, game.player.z - H, game.player.z + H);
      input.panVX = dx * k * 60; input.panVZ = dy * k * 60; input.panActive = true;
      midLX = mx; midLY = my;
    }
  }
  function hideSelRect() { if (els.selRect) els.selRect.hidden = true; }
  function drawSelRect() {
    if (!els.selRect || !boxStart || !boxCur) return;
    const xa = Math.min(boxStart.x, boxCur.x), xb = Math.max(boxStart.x, boxCur.x);
    const ya = Math.min(boxStart.y, boxCur.y), yb = Math.max(boxStart.y, boxCur.y);
    const r = els.selRect;
    r.hidden = false;
    r.style.left = xa + "px"; r.style.top = ya + "px";
    r.style.width = Math.max(0, xb - xa) + "px"; r.style.height = Math.max(0, yb - ya) + "px";
  }
  // تحديد مربع RTS: كل الوحدات داخل المستطيل (عمال/كشافة/جنود/حلفاء + القائد) — يحل محل التحديد
  function selectInRect(p0, p1) {
    if (!p0 || !p1 || game.underground) return;
    const xa = Math.min(p0.x, p1.x), xb = Math.max(p0.x, p1.x);
    const ya = Math.min(p0.y, p1.y), yb = Math.max(p0.y, p1.y);
    if (xb - xa < 12 && yb - ya < 12) return;
    const cands = [...game.workers, ...game.scouts, ...game.soldiers, ...game.allies];
    const inside = [];
    for (const u of cands) {
      if (!u) continue;
      if (u.kind === "soldier" && (u.dying || u.inTraining || u.inside)) continue;
      if (u.kind && u.kind !== "soldier" && u.kind !== "ally" && (u.inTraining || u.inClinic)) continue;
      if (u.state === "inside" || u.inside) continue;
      const p = worldToScreen(u.x, 1.2, u.z);
      if (!p) continue;
      if (p.x >= xa && p.x <= xb && p.y >= ya && p.y <= yb) inside.push(u);
    }
    if (!inside.length) return; // مربع فارغ: أبقِ التحديد الحالي
    armyClearSel();
    for (const u of inside) armySel(u);
    beep(760, 0.06, "sine", 0.08);
    toast(`🎯 حددت ${inside.length} — انقر: طعام=جمع، عدو=هجوم، أرض=تحرك`);
  }
  function toggleUnitSel(u) {
    if (army.sel.has(u)) armyDesel(u);
    else { armySel(u); beep(800, 0.05, "sine", 0.07); }
  }
  root.addEventListener("pointerdown", (e) => {
    if (editMode || game.underground || isUI(e.target)) return;
    tapDownX = e.clientX; tapDownY = e.clientY; tapDownT = performance.now();
    const touch = isTouchEv(e);
    tapSingle = pointers.size === 0;
    try { root.setPointerCapture && root.setPointerCapture(e.pointerId); } catch { /* أحداث اصطناعية */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      if (touch) {
        // ابدأ مراقبة اللمس المطوّل — أي تحرك مبكر يلغيه ويصبح تحريك كاميرا
        lpX = e.clientX; lpY = e.clientY; lpFired = false; panning = false;
        boxStart = null; boxCur = null; boxing = false;
        clearTimeout(lpTimer);
        const pid = e.pointerId;
        lpTimer = setTimeout(() => {
          lpTimer = null;
          if (!pointers.has(pid) || pointers.size !== 1 || editMode || game.underground) return;
          lpFired = true;
          const pt = pointers.get(pid) || { x: lpX, y: lpY };
          boxStart = { x: pt.x, y: pt.y }; boxCur = null; boxing = false;
          try { if (game.settings.vibrate !== false && navigator.vibrate) navigator.vibrate(25); } catch {}
          beep(660, 0.05, "sine", 0.06);
          if (!game._tutBoxHint) { game._tutBoxHint = true; toast("🎯 وضع التحديد: اسحب الآن لرسم المربع حول جيشك"); }
        }, LONG_PRESS_MS);
      }
      else if (army.on) { panId = e.pointerId; panLX = e.clientX; panLY = e.clientY; }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchD0 = Math.hypot(a.x - b.x, a.y - b.y);
      pinchDist0 = input.camTarget;
      midLX = (a.x + b.x) / 2; midLY = (a.y + b.y) / 2;
      panId = null; input.panActive = true; input.panVX = input.panVZ = 0; boxing = false; hideSelRect();
      clearTimeout(lpTimer); lpTimer = null; lpFired = false; panning = false;
    }
    try { AC || (AC = new (window.AudioContext || window.webkitAudioContext)()); } catch {}
  });
  root.addEventListener("pointermove", (e) => {
    if (editMode || game.underground) return;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const touch = isTouchEv(e);
    // إصبعان: نظر حر + تقريب (دائماً)
    if (pointers.size === 2) { pinchPan(); return; }
    // اللمس بإصبع واحد: مطوّل+سحب = مربع تحديد، وغير ذلك = تحريك الكاميرا
    if (touch && pointers.size === 1) {
      if (lpTimer && Math.hypot(e.clientX - lpX, e.clientY - lpY) > LP_MOVE_PX) {
        clearTimeout(lpTimer); lpTimer = null; // تحرك مبكر: إلغاء المطوّل → كاميرا
        panning = true; input.panActive = true; input.panVX = input.panVZ = 0; panId = e.pointerId; panLX = e.clientX; panLY = e.clientY;
      }
      if (lpFired) {
        if (!boxStart) boxStart = { x: lpX, y: lpY };
        if (!boxing && Math.hypot(e.clientX - boxStart.x, e.clientY - boxStart.y) > 18) boxing = true;
        if (boxing) { boxCur = { x: e.clientX, y: e.clientY }; drawSelRect(); }
        return;
      }
      if (panning && e.pointerId === panId && game.player) {
        const k = input.camDist / 500;
        const H = TUNE.worldHalf;
        const dx = e.clientX - panLX, dy = e.clientY - panLY;
        input.camPanX = THREE.MathUtils.clamp(input.camPanX + dx * k, game.player.x - H, game.player.x + H);
        input.camPanZ = THREE.MathUtils.clamp(input.camPanZ + dy * k, game.player.z - H, game.player.z + H);
        input.panVX = dx * k * 60; input.panVZ = dy * k * 60; input.panActive = true;
        panLX = e.clientX; panLY = e.clientY;
      }
      return;
    }
    // الفأرة في وضع الجيش: السحب يحرّك الكاميرا
    if (!touch && e.pointerId === panId && game.player) {
      const k = input.camDist / 500;
      const H = TUNE.worldHalf;
      const dx = e.clientX - panLX, dy = e.clientY - panLY;
      input.camPanX = THREE.MathUtils.clamp(input.camPanX + dx * k, game.player.x - H, game.player.x + H);
      input.camPanZ = THREE.MathUtils.clamp(input.camPanZ + dy * k, game.player.z - H, game.player.z + H);
      input.panVX = dx * k * 60; input.panVZ = dy * k * 60; input.panActive = true;
      panLX = e.clientX; panLY = e.clientY;
    }
  });
  let tapDownX = 0, tapDownY = 0, tapDownT = 0, tapSingle = false;
  const endP = (e) => {
    if (editMode) { try { pointers.delete(e.pointerId); } catch {} clearTimeout(lpTimer); lpTimer = null; return; }
    const touch = isTouchEv(e);
    clearTimeout(lpTimer); lpTimer = null;
    const wasBoxing = boxing && touch;
    const wasPan = panning && touch;
    lpFired = false; panning = false;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) input.panActive = false;
    if (panId === e.pointerId) {
      panId = null;
      if (pointers.size === 1 && !touch) {
        const [id, pt] = [...pointers.entries()][0];
        panId = id; panLX = pt.x; panLY = pt.y;
      }
    }
    // سحب مربع = تحديد مجموعة RTS
    if (wasBoxing && !game.underground) {
      boxing = false; hideSelRect();
      selectInRect(boxStart, boxCur || boxStart);
      boxStart = null; boxCur = null;
      return;
    }
    boxing = false; boxStart = null; boxCur = null; hideSelRect();
    if (wasPan) return; // سحب الكاميرا ليس نقرة — لا أوامر
    // نقرة: لمسة مزدوجة على وحدة = تحديد نوعها | واحدة = تبديل | غير ذلك = أسر/عش/أمر ذكي
    if (tapSingle && !game.underground && pointers.size === 0) {
      const moved = Math.hypot(e.clientX - tapDownX, e.clientY - tapDownY);
      if (moved < 26 && performance.now() - tapDownT < 800) {
        const now = performance.now();
        const isDouble = (now - lastTapT < DBL_MS) && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < DBL_PX;
        lastTapT = now; lastTapX = e.clientX; lastTapY = e.clientY;
        const u = nearestUnitAt(e.clientX, e.clientY, 30);
        if (u && isDouble) selectSameType(u);
        else if (u) toggleUnitSel(u);
        else if (!tryCaptureTap(e.clientX, e.clientY)) { if (!tryTapNest(e.clientX, e.clientY)) { if (!tryGateTap(e.clientX, e.clientY)) smartTap(e.clientX, e.clientY); } }
      }
      tapSingle = false;
    }
  };
  root.addEventListener("pointerup", endP);
  root.addEventListener("pointercancel", endP);

  root.addEventListener("wheel", (e) => {
    if (game.underground) return;
    e.preventDefault();
    input.camTarget = THREE.MathUtils.clamp(input.camTarget * (e.deltaY > 0 ? 1.1 : 0.9), 14, 150);
  }, { passive: false });

  addEventListener("keydown", (e) => {
    input.keys[e.key.toLowerCase()] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener("keyup", (e) => { input.keys[e.key.toLowerCase()] = false; });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveGame(); if (game.started && !game.paused) togglePause(true);
      // 📢 جدولة تنبيهات ذكية عند مغادرة اللعبة (تعمل أوفلاين — بلا إذن)
      try {
        pingCancelAll();
        let jb = 0, br = 0;
        try { jb = Nest.pendingJobSecs ? Nest.pendingJobSecs() : 0; } catch {}
        try { br = Nest.pendingBroodSecs ? Nest.pendingBroodSecs() : 0; } catch {}
        if (jb > 15) pingLater("nt_build", Math.min(jb + 30, 4 * 3600), 5);
        if (br > 15) pingLater("nt_army", Math.min(br + 30, 4 * 3600), 2);
        if (game.nest && (game.nest.dormant || (game.nest.queenHp || 100) < 25)) pingLater("nt_queen", 20 * 60, 4);
        if (game.started) pingLater("nt_daily", 6 * 3600, 1);
      } catch {}
    } else {
      // رجع اللاعب — ألغِ التنبيهات المعلقة (صارت بلا معنى)
      try { pingCancelAll(); } catch {}
    }
  });

  els.zoomInBtn.onclick = () => { input.camTarget = Math.max(14, input.camTarget - 6); beep(500, 0.05, "sine", 0.06); };
  els.zoomOutBtn.onclick = () => { input.camTarget = Math.min(150, input.camTarget + 6); beep(400, 0.05, "sine", 0.06); };
  // الخريطة: إغلاق/فتح + تخصيص الواجهة (يُحفظ تلقائياً)
  els.mapCloseBtn.onclick = () => { sfx.click(); setUi({ mapHidden: true }); toast("🗺️ أُخفيت الخريطة — زر 🗺️ يُظهرها مجدداً"); };
  els.mapOpenBtn.onclick = () => { sfx.click(); setUi({ mapHidden: false }); };
  // النقر على الخريطة المصغرة يحرّك الكاميرا الحرة لتلك النقطة (مثل ألعاب المدن)
  if (els.minimapCtn) els.minimapCtn.addEventListener("click", (e) => {
    if (game.underground || !game.player) return;
    const r = els.minimapCtn.getBoundingClientRect();
    const mx = (e.clientX - r.left) / Math.max(1, r.width), mz = (e.clientY - r.top) / Math.max(1, r.height);
    let wx, wz;
    if (game.treeZone) { wx = TREE.x0 + mx * (TREE.x1 - TREE.x0); wz = TREE.z0 + mz * (TREE.z1 - TREE.z0); }
    else { const H = TUNE.worldHalf; wx = (mx - 0.5) * 2 * H; wz = (mz - 0.5) * 2 * H; }
    const H2 = TUNE.worldHalf;
    input.camPanX = THREE.MathUtils.clamp(game.player.x - wx, -H2, H2);
    input.camPanZ = THREE.MathUtils.clamp(game.player.z - wz, -H2, H2);
    sfx.click();
  });
  els.helpBtn.onclick = () => { els.helpModal.hidden = false; };
  els.helpCloseBtn.onclick = () => { els.helpModal.hidden = true; if (!game.started) els.startScreen.hidden = false; };
  els.hatchBtn.onclick = () => hatchWorker();
  els.upgradeBtn.onclick = () => buyUpgrade();
  els.menuBtn.onclick = () => { els.actionCtn.hidden = !els.actionCtn.hidden; els.menuBtn.setAttribute("aria-expanded", String(!els.actionCtn.hidden)); els.menuBtn.setAttribute("aria-label", els.actionCtn.hidden ? "فتح القائمة" : "إغلاق القائمة"); beep(els.actionCtn.hidden ? 400 : 600, 0.06, "sine", 0.07); };
  els.beastBtn.onclick = () => { els.genePanel.hidden = true; els.trainPanel.hidden = true; renderBeastPanel(); els.beastPanel.hidden = false; beep(600, 0.07, "sine", 0.08); };
  els.beastCloseBtn.onclick = () => { els.beastPanel.hidden = true; };
  els.trainBtn.onclick = () => { sfx.click(); openTrainPanel(); };
  els.trainTabConv.onclick = () => { renderTrain("conv"); sfx.click(); };
  els.trainTabSold.onclick = () => { renderTrain("sold"); sfx.click(); };
  els.trainTabYard.onclick = () => { renderTrain("yard"); sfx.click(); };
  els.trainTabUp.onclick = () => { renderTrain("up"); sfx.click(); };
  els.trainCloseBtn.onclick = () => { sfx.click(); els.trainPanel.hidden = true; };
  els.geneTabSick.onclick = () => { renderGenePanel("sick"); sfx.click(); };
  els.geneTabHeal.onclick = () => { renderGenePanel("heal"); sfx.click(); };
  els.geneTabEggs.onclick = () => { renderGenePanel("eggs"); sfx.click(); };
  els.geneTabGene.onclick = () => { renderGenePanel("gene"); sfx.click(); };
  els.geneTabUp.onclick = () => { renderGenePanel("up"); sfx.click(); };
  els.geneCloseBtn.onclick = () => { sfx.click(); els.genePanel.hidden = true; };
  els.worldBtn.onclick = () => { els.genePanel.hidden = true; els.trainPanel.hidden = true; els.worldPanel.hidden = false; renderWorld("regions"); beep(600, 0.07, "sine", 0.08); };
  els.worldCloseBtn.onclick = () => { els.worldPanel.hidden = true; };
  els.buildBtn.onclick = () => { sfx.click(); openBuild(); };
  els.shopBtn.onclick = () => { els.beastPanel.hidden = true; els.genePanel.hidden = true; els.trainPanel.hidden = true; els.worldPanel.hidden = false; renderWorld("shop"); sfx.click(); };
  els.questBtn.onclick = () => { els.beastPanel.hidden = true; els.genePanel.hidden = true; els.trainPanel.hidden = true; els.worldPanel.hidden = false; renderWorld("quests"); sfx.click(); };
  els.pauseBtn.onclick = () => { sfx.click(); togglePause(true); };
  els.resumeBtn.onclick = () => { sfx.click(); togglePause(false); };
  els.settingsBtn.onclick = () => { sfx.click(); renderSettings(); els.settingsPanel.hidden = false; };
  els.saveNowBtn.onclick = () => { saveGame(); sfx.deposit(); toast(t("saved_now")); };
  els.homeBtn.onclick = () => { sfx.click(); goHome(); };
  els.settingsCloseBtn.onclick = () => { sfx.click(); els.settingsPanel.hidden = true; };
  els.setSoundBtn.onclick = () => { game.settings.sound = game.settings.sound === false; soundOn = game.settings.sound !== false; sfx.click(); renderSettings(); saveGame(); };
  els.setQualityBtn.onclick = () => {
    // دورة من 3: تلقائية ← عالية ← منخفضة (زر واحد بدل زرين)
    const auto = game.settings.autoQ !== false;
    const low = game.settings.quality === "low";
    if (auto) { game.settings.autoQ = false; game.settings.quality = "high"; }
    else if (!low) { game.settings.quality = "low"; }
    else { game.settings.autoQ = true; autoLow = false; fpsGoodStreak = 0; }
    applyQuality(); sfx.click(); renderSettings();
  };
  if (els.tutSkipBtn) els.tutSkipBtn.onclick = () => { sfx.click(); tutSkip(); };
  els.setVibrateBtn.onclick = () => { game.settings.vibrate = game.settings.vibrate === false; sfx.click(); renderSettings(); saveGame(); };
  if (els.setLangBtn) {
    if (!els.setLangBtn.options.length) {
      try {
        for (const l of LANG_LIST) {
          const o = document.createElement("option");
          o.value = l.code; o.textContent = `${l.flag} ${l.name}`;
          els.setLangBtn.appendChild(o);
        }
      } catch {}
    }
    els.setLangBtn.onchange = () => { try { setLang(els.setLangBtn.value); } catch {} };
  }
  els.setHelpBtn.onclick = () => { sfx.click(); els.helpModal.hidden = false; };
  els.setWipeBtn.onclick = () => { armWipe(els.setWipeBtn, "🗑️ اضغط مجدداً للتأكيد"); };
  els.startPlayBtn.onclick = () => { sfx.click(); startPlay(); };
  els.setDiffBtn.onclick = () => {
    const nx = game.difficulty === "beginner" ? "easy" : game.difficulty === "easy" ? "normal" : game.difficulty === "normal" ? "hard" : "beginner";
    setDifficulty(nx, true);
  };
  for (const [bid, d] of [["diffBeginnerBtn", "beginner"], ["diffEasyBtn", "easy"], ["diffNormalBtn", "normal"], ["diffHardBtn", "hard"]]) {
    if (els[bid]) els[bid].onclick = () => { sfx.click(); game.difficulty = d; try { localStorage.setItem(DIFF_KEY, d); } catch {} renderDiffRow(); };
  }
  els.startHelpBtn.onclick = () => { sfx.click(); startHelp(); };
  els.startWipeBtn.onclick = () => { armWipe(els.startWipeBtn, "🆕 اضغط مجدداً لبدء جديد"); };
  els.wtabRegions.onclick = () => { renderWorld("regions"); beep(500, 0.05, "sine", 0.06); };
  els.wtabQuests.onclick = () => { renderWorld("quests"); beep(500, 0.05, "sine", 0.06); };
  els.wtabShop.onclick = () => { renderWorld("shop"); beep(500, 0.05, "sine", 0.06); };
  els.underBackBtn.onclick = () => exitNest();
  els.roomCloseBtn.onclick = () => { els.roomPanel.hidden = true; };
  els.buildCancelBtn.onclick = () => { els.buildMenu.hidden = true; };
  els.cmdSelWorkBtn.onclick = () => selAllWorkers();
  els.cmdSelSoldBtn.onclick = () => selAllSoldiers();
  els.cmdInjBtn.onclick = () => selAllInjured();
  els.cmdHomeBtn.onclick = () => orderHome();
  els.cmdHoldBtn.onclick = () => orderHold();
  els.cmdClearBtn.onclick = () => { armySetMode(false); toast("✖ خرجت من وضع التحديد"); };
  // زر الجيش المستقل + الترس تحت الخريطة (بدل زر القائمة القديم)
  els.armyBtn.onclick = () => {
    sfx.click();
    if (!army.on && game.underground) { toast("🕳️ أنت في العش — الجيش يُدار من السطح"); return; }
    armySetMode(!army.on);
    beep(army.on ? 700 : 400, 0.07, "sine", 0.08);
  };
  els.gearBtn.onclick = () => { sfx.click(); renderSettings(); els.settingsPanel.hidden = false; };
  els.nestBtn.onclick = () => { sfx.click(); if (game.underground) exitNest(); else enterNest(); };
  els.setUiLayoutBtn.onclick = () => { sfx.click(); renderSettings(); setEditMode(true); };
  els.editResetBtn.onclick = () => { sfx.click(); setUi({ layout: {} }); applyUILayout(); renderSettings(); toast("↩️ استُعيدت أماكن الأزرار الافتراضية"); };
  els.setAboutBtn.onclick = () => { sfx.click(); els.settingsPanel.hidden = true; els.aboutPanel.hidden = false; };
  if (els.setUpdateBtn) els.setUpdateBtn.onclick = () => {
    sfx.click();
    if (pendingUpdateUrl) openUpdateUrl();
    else if (pendingUpdateName) toast(t("upd_new", { n: pendingUpdateName }));
    else checkUpdate(true);
  };
  els.aboutCloseBtn.onclick = () => { sfx.click(); els.aboutPanel.hidden = true; els.settingsPanel.hidden = false; };
  if (els.setPrivacyBtn) els.setPrivacyBtn.onclick = () => { sfx.click(); els.settingsPanel.hidden = true; els.privacyPanel.hidden = false; };
  if (els.privacyCloseBtn) els.privacyCloseBtn.onclick = () => { sfx.click(); els.privacyPanel.hidden = true; els.settingsPanel.hidden = false; };
  // ✋ وضع التحرير باللمس (الدخول من الإعدادات مباشرة — والخروج بزر ✓ واحد)
  els.editDoneBtn.onclick = () => { sfx.click(); setEditMode(false); };
  els.editPlusBtn.onclick = () => editNudgeSize(10);
  els.editMinusBtn.onclick = () => editNudgeSize(-10);
  els.editHideBtn.onclick = () => {
    if (!editSelId) return;
    const chk = canHideWidget(editSelId, true);
    if (chk !== true) { toast(chk); return; }
    sfx.click();
    setLayout(editSelId, { hide: true });
    editSelect(null);
    renderEditHidden();
  };
  els.editDockBtn.onclick = () => {
    if (!editSelId) return;
    sfx.click();
    setLayout(editSelId, { dock: "default", x: null, y: null });
    renderEditHidden();
    editToolPlace(editSelId);
  };
  els.editHiddenBtn.onclick = () => {
    sfx.click();
    if (els.editHiddenList) els.editHiddenList.hidden = !els.editHiddenList.hidden;
  };
  wireEditGestures();
  // حفظ مواضع الأزرار الأصلية (للعودة إليها عند اختيار "مكانه الأصلي")
  for (const w of UI_WIDGETS) {
    const el = els[w.id];
    if (el && el.parentElement && !w.origParent) w.origParent = el.parentElement;
  }
  applyUILayout();
}
function keyboardVec() {
  const k = input.keys;
  let x = 0, y = 0;
  if (k["a"] || k["arrowleft"]) x -= 1;
  if (k["d"] || k["arrowright"]) x += 1;
  if (k["w"] || k["arrowup"]) y -= 1;
  if (k["s"] || k["arrowdown"]) y += 1;
  if (x || y) {
    const m = Math.hypot(x, y);
    return { x: x / m, y: y / m, kbd: true };
  }
  return null;
}

// ---------- الدخول/الخروج من العش تحت الأرض ----------
const nestRay = { ray: null };
function tryTapNest(px, py) {
  try {
    if (!game.mound || game.underground) return;
    nestRay.ray = nestRay.ray || new THREE.Raycaster();
    const r = renderer.domElement.getBoundingClientRect();
    const nx = ((px - r.left) / r.width) * 2 - 1;
    const ny = -((py - r.top) / r.height) * 2 + 1;
    nestRay.ray.setFromCamera({ x: nx, y: ny }, camera);
    const hits = nestRay.ray.intersectObject(game.mound, false);
    if (hits.length) enterNest();
  } catch { /* تجاهل */ }
}
// 👑 النقر على الحلقة الذهبية (أو الخشبة/اللافتة/جوار البوابة) يعبر بين الغابة والشجرة
const gateRay = { ray: null };
function tryGateTap(px, py) {
  try {
    if (game.underground) return false;
    const ring = !game.treeZone ? treeGateRing : treeBackRing;
    if (!ring) return false;
    gateRay.ray = gateRay.ray || new THREE.Raycaster();
    const r = renderer.domElement.getBoundingClientRect();
    const nx = ((px - r.left) / r.width) * 2 - 1;
    const ny = -((py - r.top) / r.height) * 2 + 1;
    gateRay.ray.setFromCamera({ x: nx, y: ny }, camera);
    if (gateRay.ray.intersectObject(ring, true).length) { treeTransit(!game.treeZone); return true; }
    // احتياطي كريم: الضغط على الخشبة/اللافتة/جوار البوابة (±7) يعبر أيضاً — للأصابع السميكة
    if (gateLabel && !game.treeZone && gateRay.ray.intersectObject(gateLabel, true).length) { treeTransit(true); return true; }
    if (backLabel && game.treeZone && gateRay.ray.intersectObject(backLabel, true).length) { treeTransit(false); return true; }
    const gp = groundPoint(px, py);
    if (gp) {
      const gx = game.treeZone ? TREE.backX : TREE.gateX;
      const gz = game.treeZone ? TREE.backZ : TREE.gateZ;
      if (Math.hypot(gp.x - gx, gp.z - gz) < 7.5) {
        // 🎯 عندك وحدات محددة؟ النقرة أمر لهم (يذهبون للبوابة ويعبرون بأمرك) — الكاميرا تبقى مكانها
        if (army.sel.size > 0) return false;
        treeTransit(!game.treeZone); return true;
      }
    }
  } catch { /* تجاهل */ }
  return false;
}
function fadeTo(black, ms = 350) {
  return new Promise((res) => {
    els.fadeVeil.hidden = false;
    requestAnimationFrame(() => { els.fadeVeil.style.opacity = black ? "1" : "0"; });
    setTimeout(() => { if (!black) els.fadeVeil.hidden = true; res(); }, ms);
  });
}
async function enterNest() {
  if (game.underground) return;
  game._tutEnteredNest = true;
  if (editMode) setEditMode(false, true);
  if (army.on) armySetMode(false);
  game.underground = true;
  game.autoReturn = false;
  input.jx = input.jy = 0;
  await fadeTo(true);
  els.joyBase.hidden = true;
  els.sceneHolder.style.display = "none";
  for (const id of ["mapWrap", "mapOpenBtn", "mapStack", "zoomCtn", "menuBtn", "actionCtn", "helpBtn", "helpModal", "beastPanel", "genePanel", "worldPanel", "topBar", "statusPill", "vitalsPanel", "resBar", "typeBar", "pauseBtn", "cmdBar"]) els[id].hidden = true;
  els.underCanvas.hidden = false;
  els.underBar.hidden = true;
  for (const id of ["nestHud","nestQuestBtn","nestSide","nestBottom","nestBackFab","nestZoom"]) if (els[id]) els[id].hidden = false;
  buildNestHud();
  wireNestHud();
  applyUILayout(); // يعيد إخفاء ما أخفاه اللاعب من أزرار العش
  beep(300, 0.15, "sine", 0.1);
  setTimeout(() => beep(200, 0.2, "sine", 0.1), 120);
  toast("🕳️ نزلت إلى العش تحت الأرض");
  // 🧹 تلميح لمرة واحدة للأعشاش القديمة المرتبة عشوائياً: زر الترتيب يعيدها مثل الصورة
  try {
    if (!game.flags.tidyHint && Nest.roomCount && Nest.roomCount() > 6) {
      game.flags.tidyHint = true;
      setTimeout(() => { try { toast("🧹 عشك القديم مرتب عشوائياً؟ اضغط زر 🧹 ترتيب (بالشريط السفلي) ليعيده مثل الصورة!"); } catch {} }, 2500);
    }
  } catch {}
  await fadeTo(false);
}
async function exitNest() {
  if (!game.underground) return;
  game._tutExitedNest = true; // 🌱 خطوة 7 من تعليم المبتدئ: الخروج للسطح
  if (editMode) setEditMode(false, true);
  await fadeTo(true);
  game.underground = false;
  els.underCanvas.hidden = true;
  els.underBar.hidden = true;
  for (const id of ["nestHud","nestQuestBtn","nestSide","nestBottom","nestBackFab","nestZoom"]) if (els[id]) els[id].hidden = true;
  els.roomPanel.hidden = true;
  els.buildMenu.hidden = true;
  els.beastPanel.hidden = true;
  els.genePanel.hidden = true;
  els.worldPanel.hidden = true;
  els.sceneHolder.style.display = "";
  for (const id of ["zoomCtn", "actionCtn", "helpBtn", "topBar", "statusPill", "vitalsPanel", "resBar", "pauseBtn"]) els[id].hidden = false;
  refreshMapVis();
  applyUILayout();
  onResize();
  beep(350, 0.12, "sine", 0.1);
  toast("⬆️ عدت إلى السطح");
  await fadeTo(false);
}

// ---------- الملكة تعيش داخل العش فقط (غرفتها الخاصة) — لا ملكة على السطح ----------
function nearestFood(x, z, maxD = 60) {
  let best = null, bd = maxD;
  for (const f of game.foods) {
    const d = Math.hypot(f.x - x, f.z - z);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}
// أقرب طعام صالح للجمع: قطعة مفردة أو مصدر (node) له amount — لأمر الجمع والبحث التلقائي
function nearestForage(x, z, maxD) {
  let best = null, bd = maxD;
  for (const f of game.foods) {
    const d = Math.hypot(f.x - x, f.z - z);
    if (d < bd) { bd = d; best = f; }
  }
  for (const n of game.nodes) {
    if (!n.amount) continue;
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function collideAndClamp(ent, radius) {
  // الجيب الشجري له حدوده الخاصة: المقفول شجرياً أو التابع للاعب وهو في عالمه
  const zt = !!ent && (!!ent.treeLocked || (ent.treeZone === true) || (ent === game.player ? !!game.treeZone : (!!game.treeZone && !!ent.treeZone && isPlayerSide(ent))));
  const x0 = zt ? TREE.x0 : -TUNE.worldHalf, x1 = zt ? TREE.x1 : TUNE.worldHalf;
  const z0 = zt ? TREE.z0 : -TUNE.worldHalf, z1 = zt ? TREE.z1 : TUNE.worldHalf;
  ent.x = THREE.MathUtils.clamp(ent.x, x0, x1);
  ent.z = THREE.MathUtils.clamp(ent.z, z0, z1);
  for (const c of game.colliders) {
    const dx = ent.x - c.x, dz = ent.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + radius;
    if (d < min && d > 0.001) {
      ent.x = c.x + (dx / d) * min;
      ent.z = c.z + (dz / d) * min;
    }
  }
  ent.x = THREE.MathUtils.clamp(ent.x, x0, x1);
  ent.z = THREE.MathUtils.clamp(ent.z, z0, z1);
}
function depositCarry(who, isPlayer) {
  if (!who.carried.length) return;
  const items = who.carried.slice();
  who.carried = [];
  setCarryVisual(who.ant, []);
  who.carryPop = 0;
  // أنيميشن: كل قطعة تطير من الظهر إلى فتحة العش ثم تنفجر بجسيمات
  const top = who.ant.group.position.clone();
  top.y += 1.3;
  const hole = new THREE.Vector3(nestPos.x, 1.8, nestPos.z + 0.6);
  items.forEach((kind, i) => {
    game.store += ((KNOWN_FOODS[kind] || {}).value || 1);
    game.stock[kind] = (game.stock[kind] || 0) + 1;
    spawnFlyer(kind, top.clone(), () => hole, () => {
      spawnBurst(hole.x, hole.y, hole.z, 0xffd93d, 6, 2, 2);
    }, 0.35 + i * 0.07);
  });
  game.stats.food = (game.stats.food || 0) + items.length;
  let amberGot = 0, boneGot = 0;
  for (const kind of items) {
    if (kind === "amber") amberGot++;
    if (kind === "bone") boneGot++;
  }
  if (amberGot) game.stats.amber = (game.stats.amber || 0) + amberGot;
  if (boneGot) game.stats.bones = (game.stats.bones || 0) + boneGot;
  addXP(items.length);
  game.nestPulse = 1;
  if (isPlayer) {
    sfx.deposit();
    toast(`+${items.length} 🍯 في المخزون!`);
  } else {
    sfx.pickup();
  }
  saveGame();
}
function hatchWorker() {
  const c = hatchCost();
  if (game.store < c) { toast("🍯 ليس لديك طعام كافٍ للفقس"); return; }
  if (!canAdd("worker")) { toast(kindFullText("worker")); return; }
  game.store -= c;
  spawnWorker();
  game.stats.hatched = (game.stats.hatched || 0) + 1;
  sfx.hatch();
  saveGame();
}
function buyUpgrade() {
  const c = upgradeCost();
  if (game.store < c) { toast("🍯 طعام غير كافٍ للترقية"); return; }
  if (game.capacityBonus >= 6) { toast("🎒 وصلت لأقصى سعة"); return; }
  game.store -= c;
  game.capacityBonus++;
  game.stats.upgrades = (game.stats.upgrades || 0) + 1;
  sfx.hatch();
  toast(`🎒 سعة حملك الآن ${playerCapacity()}`);
  saveGame();
}
function spawnWorker(gene, geneKey) {
  const elite = !!(gene && gene.elite);
  const ant = createAnt({ body: elite ? 0xC9962E : 0x8a3a10, dark: elite ? 0x5a3c00 : 0x3d1604, scale: 0.85, elite });
  // يبزغ من فتحة العش
  ant.group.position.set(HOLE.x + rand(-0.5, 0.5), groundY(HOLE.x, HOLE.z), HOLE.z + rand(-0.5, 0.5));
  ant.group.scale.setScalar(0.2);
  ant.group.visible = false; // يسكن العش — لا يخرج إلا بأمرك
  scene.add(ant.group);
  const w = {
    uid: nextUid(), ant, kind: "worker", x: HOLE.x, z: HOLE.z, yaw: rand(0, 6.28),
    vx: 0, vz: 0, carried: [], state: "inside", target: null,
    tx: HOLE.x, tz: HOLE.z,
    retarget: rand(0, 2), forageMiss: 0, emergeT: 1, baseScale: 0.85, insideT: 0.5,
    hp: 20, maxHp: 20, order: null, selRing: null,
  };
  w.base = { dmg: 0, def: 0, spd: TUNE.workerSpeed, maxHp: 20, scale: 0.85 };
  w.gene = gene || null;
  w.mods = geneKey ? [geneKey] : [];
  w.armorVal = warmorVal();
  refreshUnitStats(w);
  game.workers.push(w);
  return w;
}
function spawnScout(gene, geneKey) {
  const elite = !!(gene && gene.elite);
  const ant = createAnt({ body: elite ? 0xD9A521 : 0xb36a1a, dark: elite ? 0x5a3c00 : 0x5a2a08, scale: 0.8, elite });
  // الكشاف سريع يبزغ من الفتح
  ant.group.position.set(HOLE.x + rand(-0.5, 0.5), groundY(HOLE.x, HOLE.z), HOLE.z + rand(-0.5, 0.5));
  ant.group.scale.setScalar(0.2);
  ant.group.visible = false; // يسكن العش — لا يخرج إلا بأمرك
  scene.add(ant.group);
  const w = {
    uid: nextUid(), ant, kind: "scout", x: HOLE.x, z: HOLE.z, yaw: rand(0, 6.28),
    vx: 0, vz: 0, carried: [], state: "inside", target: null,
    tx: HOLE.x, tz: HOLE.z,
    retarget: rand(0, 2), forageMiss: 0, emergeT: 1, baseScale: 0.8, insideT: 0.5,
    hp: 15, maxHp: 15, order: null, selRing: null,
  };
  w.base = { dmg: 0, def: 0, spd: 7.5, maxHp: 15, scale: 0.8 };
  w.gene = gene || null;
  w.mods = geneKey ? [geneKey] : [];
  w.armorVal = warmorVal();
  refreshUnitStats(w);
  game.scouts.push(w);
  return w;
}
function totalAnts() {
  return game.workers.length + game.soldiers.length + game.scouts.length;
}
// سقف كل نوع على حدة: عمال 30 / جنود 30 / كشافة 20 (ينمو مع الغرف)
function countKind(kind) {
  return kind === "soldier" ? game.soldiers.length : kind === "scout" ? game.scouts.length : game.workers.length;
}
function capFor(kind) { return Nest.kindCap(kind); }
function canAdd(kind) { return countKind(kind) < capFor(kind); }
const KIND_INFO = { worker: { icon: "🐜", name: "العمال" }, soldier: { icon: "⚔️", name: "الجنود" }, scout: { icon: "🔭", name: "الكشافة" } };
function kindFullText(kind) {
  const k = KIND_INFO[kind] || KIND_INFO.worker;
  return `${k.icon} ${k.name} ممتلئون (${countKind(kind)}/${capFor(kind)}) — رقِّ الغرف لرفع السقف`;
}
function spawnAdult(kind, gene, geneKey) {
  if (!canAdd(kind)) return false;
  if (kind === "soldier") spawnSoldier(gene, geneKey);
  else if (kind === "scout") spawnScout(gene, geneKey);
  else spawnWorker(gene, geneKey);
  game.stats.hatched = (game.stats.hatched || 0) + 1;
  sfx.hatch();
  saveGame();
  return true;
}
function hurtPlayer(dmg, fromX, fromZ) {
  return; // 👑 لا نملة ميدانية — القائد معتكف في العش ولا يُستهدف أبداً
  if (game.underground) return; // العش آمن تماماً — لا ضرر وأنت في الداخل
  const now = game.time;
  if (now < game.invulnUntil) return;
  game.player.hp -= dmg;
  game.lastHitAt = now;
  game.shake = 0.7;
  sfx.hit();
  try { if (game.settings.vibrate !== false && navigator.vibrate) navigator.vibrate(50); } catch {}
  els.damageFlash.hidden = false;
  setTimeout(() => (els.damageFlash.hidden = true), 220);
  const dx = game.player.x - fromX, dz = game.player.z - fromZ;
  const d = Math.max(0.5, Math.hypot(dx, dz));
  game.player.vx += (dx / d) * 16;
  game.player.vz += (dz / d) * 16;
  // إسقاط جزء من المحمول
  if (game.player.carried.length) {
    const drop = game.player.carried.pop();
    setCarryVisual(game.player.ant, game.player.carried);
    spawnFood(game.player.x + rand(-1, 1), game.player.z + rand(-1, 1), drop);
    toast("💥 أسقطت طعاماً بسبب الهجوم!");
  }
  if (game.player.hp <= 0) {
    game.player.hp = pMax();
    game.player.st = 100;
    game.player.x = 2; game.player.z = 3;
    game.player.vx = game.player.vz = 0;
    game.player.carried = [];
    game.treeZone = false; // الموت يعيدك للعش في العالم العادي
    setCarryVisual(game.player.ant, []);
    game.invulnUntil = now + 3;
    centerMsg("💀 أُصبت! تعافيت في العش");
    toast("❤️ تعافيت في العش — احذر الخنافس");
  }
}

// ---------- الخريطة المصغرة ----------
let mmT = 0;
function drawMinimap() {
  const cv = els.minimapCtn;
  const g = cv.getContext("2d");
  const W = cv.width, Hh = cv.height;
  const H = TUNE.worldHalf;
  const inTree = !!game.treeZone;
  const toMap = inTree
    ? (x, z) => [((x - TREE.x0) / (TREE.x1 - TREE.x0)) * W, ((z - TREE.z0) / (TREE.z1 - TREE.z0)) * Hh]
    : (x, z) => [((x / H) * 0.5 + 0.5) * W, ((z / H) * 0.5 + 0.5) * Hh];
  g.clearRect(0, 0, W, Hh);
  g.fillStyle = inTree ? "rgba(72,52,26,.94)" : "rgba(46,80,32,.9)";
  g.fillRect(0, 0, W, Hh);
  g.strokeStyle = "#d9c08a";
  g.lineWidth = 3;
  g.strokeRect(2, 2, W - 4, Hh - 4);
  // العش (العالم العادي فقط — في الشجرة تُرسم الحلقة والتل بدلاً منه)
  if (!inTree) {
  {
    const [mx, mz] = toMap(0, 0);
    g.fillStyle = "#8a5f36";
    g.beginPath(); g.arc(mx, mz, 8, 0, 7); g.fill();
    g.fillStyle = "#ffd93d";
    g.beginPath(); g.arc(mx, mz, 3, 0, 7); g.fill();
  }
  }
  // في الشجرة: الجذع + التل الأبيض + حلقة الرجوع
  if (inTree) {
    const [tx2, tz2] = toMap(TREE.treeX, TREE.treeZ);
    g.fillStyle = "#5a3a1e";
    g.beginPath(); g.arc(tx2, tz2, 11, 0, 7); g.fill();
    g.fillStyle = "#3f8a34";
    g.beginPath(); g.arc(tx2, tz2, 13, 0, 7); g.strokeStyle = "#3f8a34"; g.lineWidth = 3; g.stroke();
    const mo = game.termiteMound;
    if (mo) {
      const [mx2, mz2] = toMap(mo.x, mo.z);
      g.fillStyle = mo.alive ? "#ffffff" : "#667";
      g.fillRect(mx2 - 4, mz2 - 4, 8, 8);
    }
    const [bx, bz] = toMap(TREE.backX, TREE.backZ);
    g.strokeStyle = "#ffd93d"; g.lineWidth = 2;
    g.beginPath(); g.arc(bx, bz, 5, 0, 7); g.stroke();
  } else {
    // بوابة الخشبة في الغابة (تلميح لاكتشاف العالم الثاني)
    const [gx, gz] = toMap(TREE.gateX, TREE.gateZ);
    g.fillStyle = "#ffd93d";
    g.beginPath(); g.arc(gx, gz, 3.5, 0, 7); g.fill();
  }
  for (const f of game.foods) {
    const [mx, mz] = toMap(f.x, f.z);
    g.fillStyle = f.kind === "leaf" ? "#6fbf3f" : f.kind === "seed" ? "#e8c33a" : f.kind === "amber" ? "#ff9f1a" : "#c98f4e";
    g.fillRect(mx - 1.5, mz - 1.5, 3, 3);
  }
  // الولائم العملاق: مربعات كبيرة نابض (أحمر/أخضر/برتقالي)
  for (const n of game.nodes) {
    if (!n.feast || !n.amount) continue;
    const [mx, mz] = toMap(n.x, n.z);
    const pl = 5 + Math.sin(performance.now() / 900 + n.x) * 1;
    g.fillStyle = n.kind === "bigapple" ? "#ff3b3b" : n.kind === "bigmelon" ? "#2f9e44" : "#ff9f1a";
    g.fillRect(mx - pl / 2, mz - pl / 2, pl, pl);
    g.strokeStyle = "#ffd93d";
    g.lineWidth = 1.5;
    g.strokeRect(mx - pl / 2, mz - pl / 2, pl, pl);
  }
  for (const w of game.workers) {
    const [mx, mz] = toMap(w.x, w.z);
    g.fillStyle = "#c97b2e";
    g.beginPath(); g.arc(mx, mz, 2.4, 0, 7); g.fill();
    if (army.sel.has(w)) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, mz, 4.5, 0, 7); g.stroke(); }
  }
  for (const s of game.scouts) {
    const [mx, mz] = toMap(s.x, s.z);
    g.fillStyle = "#4dd2ff";
    g.fillRect(mx - 2, mz - 2, 4, 4);
    if (army.sel.has(s)) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, mz, 4.5, 0, 7); g.stroke(); }
  }
  for (const b of game.beetles) {
    const [mx, mz] = toMap(b.x, b.z);
    g.fillStyle = "#ff3b3b";
    g.beginPath(); g.arc(mx, mz, 3, 0, 7); g.fill();
  }
  // المخلوقات البرية (لون الندرة) والحلفاء (أخضر)
  for (const c of game.creatures) {
    const [mx, mz] = toMap(c.x, c.z);
    g.fillStyle = (CREATURE_RARITY[CREATURE_SPECIES[c.key].rarity] || {}).color || "#fff";
    if (c.stunned) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, mz, 5, 0, 7); g.stroke(); }
    g.beginPath(); g.arc(mx, mz, 3, 0, 7); g.fill();
  }
  for (const a of game.allies) {
    const [mx, mz] = toMap(a.x, a.z);
    g.fillStyle = "#51ff5e";
    g.fillRect(mx - 2, mz - 2, 4, 4);
    if (army.sel.has(a)) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, mz, 4.5, 0, 7); g.stroke(); }
  }
  // العدو: وحدات برتقالية ومستعمرات مربعة (رمادية إن دُمّرت)
  for (const e of game.enemies) {
    const [mx, mz] = toMap(e.x, e.z);
    g.fillStyle = e.role === "boss" ? "#ff00ff" : "#ff6a00";
    g.beginPath(); g.arc(mx, mz, e.role === "boss" ? 4 : 2.6, 0, 7); g.fill();
  }
  for (const col of game.colonies) {
    const [mx, mz] = toMap(col.x, col.z);
    g.fillStyle = col.alive ? "#" + col.def.flag.toString(16).padStart(6, "0") : "#555";
    g.fillRect(mx - 4, mz - 4, 8, 8);
    if (col.alive) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.strokeRect(mx - 4, mz - 4, 8, 8); }
  }
  for (const s of game.soldiers) {
    if (s.dying) continue;
    const [mx, mz] = toMap(s.x, s.z);
    g.fillStyle = s.variant === "brute" ? "#c0392b" : s.variant === "swift" ? "#ff9f43" : "#ff8844";
    g.fillRect(mx - 2, mz - 2, 4, 4);
    if (army.sel.has(s)) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, mz, 4.5, 0, 7); g.stroke(); }
  }
  // الجثث: علامة ✕ رمادية — أثر القتلى واقف على الخريطة
  g.strokeStyle = "#9a9a9a";
  g.lineWidth = 2;
  for (const c of game.corpses) {
    const [mx, mz] = toMap(c.x, c.z);
    g.beginPath();
    g.moveTo(mx - 3, mz - 3); g.lineTo(mx + 3, mz + 3);
    g.moveTo(mx + 3, mz - 3); g.lineTo(mx - 3, mz + 3);
    g.stroke();
  }
  // (سهم القائد الأبيض حُذف — القيادة من فوق بلا نملة ميدانية)
}

// ---------- واجهة العش بأسلوب Pocket Ants (عدادات علوية + أزرار جانبية وسفلية) ----------
let nestWired = false;
function nestResDef() {
  return [
    { k: "__store", ico: "🍯", val: () => game.store, fmt: fmtNestNum },
    { k: "seed", ico: "🌱", val: () => game.stock.seed || 0, fmt: fmtNestNum },
    { k: "leaf", ico: "🍃", val: () => game.stock.leaf || 0, fmt: fmtNestNum },
    { k: "fruit", ico: "🍎", val: () => (game.stock.fruit || 0) + (game.stock.crumb || 0), fmt: fmtNestNum },
    { k: "bone", ico: "🦴", val: () => game.stock.bone || 0, fmt: fmtNestNum },
    { k: "crystal", ico: "💠", val: () => game.stock.crystal || 0, fmt: fmtNestNum },
    { k: "__honey", ico: "🍯", val: () => game.store, fmt: fmtNestNum, plain: true },
  ];
}
function fmtNestNum(n) {
  n = Math.floor(n || 0);
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
function buildNestHud() {
  if (!els.nestRes) return;
  els.nestRes.innerHTML = "";
  for (const r of nestResDef()) {
    const d = document.createElement("div");
    d.className = "nres";
    d.dataset.k = r.k;
    d.innerHTML = `<span>${r.ico}</span><b>0</b>` + (r.plain ? "" : `<button class="plus" tabindex="-1">+</button>`);
    const pb = d.querySelector(".plus");
    if (pb) pb.onclick = (e) => { e.stopPropagation(); sfx.click(); openWorldShop(); };
    els.nestRes.appendChild(d);
  }
  syncNestHud();
}
function openWorldShop() {
  els.worldPanel.hidden = false;
  try { renderWorld("shop"); } catch { toast("🛒 المتجر"); }
}
function openWorldQuests() {
  els.worldPanel.hidden = false;
  try { renderWorld("quests"); } catch { toast("📜 المهام"); }
}
function wireNestHud() {
  if (nestWired) return;
  nestWired = true;
  if (els.nestBackFab) els.nestBackFab.onclick = () => exitNest();
  if (els.nestExitBtn) els.nestExitBtn.onclick = () => { sfx.click(); exitNest(); };
  if (els.nestSetBtn) els.nestSetBtn.onclick = () => { sfx.click(); els.settingsPanel.hidden = false; };
  if (els.nestQuestBtn) els.nestQuestBtn.onclick = () => { sfx.click(); openWorldQuests(); };
  if (els.nestWorldBtn) els.nestWorldBtn.onclick = () => { sfx.click(); els.worldPanel.hidden = false; try { renderWorld("regions"); } catch {} };
  if (els.nestShopBtn) els.nestShopBtn.onclick = () => { sfx.click(); openWorldShop(); };
  if (els.nestBattleBtn) els.nestBattleBtn.onclick = () => { sfx.click(); toast("⚔️ حدد جنودك على السطح لبدء معركة — العش منطقة آمنة"); };
  if (els.nestBuildBtn) els.nestBuildBtn.onclick = () => {
    sfx.click();
    try {
      const kinds = ["storage", "nursery", "workers", "soldiers"];
      const need = kinds.find((k) => Nest.copyCount(k) < Nest.copyMax(k)) || "tunnel";
      const slot = Nest.findBuildSlot(need);
      if (!slot) { toast("🏠 العش ممتلئ — رقِّ غرفك لتكبيرها بدل بناء جديد"); return; }
      Nest.openBuildMenu(slot.x, slot.y);
      toast(`⛏️ اختر الغرفة لبنائها هنا (${need === "tunnel" ? Nest.roomName("tunnel") : Nest.roomName(need)})`);
    } catch { toast("⛏️ اضغط على تراب لامع ✨ للحفر"); }
  };
  if (els.nestUpBtn) els.nestUpBtn.onclick = () => { sfx.click(); try { Nest.focusFirstUpgrade(); } catch { toast("⬆️ اضغط على غرفة لترقيتها"); } };
  if (els.nestTidyBtn) els.nestTidyBtn.onclick = () => { sfx.click(); try { Nest.tidyNest(); } catch { toast("🧹 تعذر الترتيب الآن"); } };
  if (els.nestArmyBtn) els.nestArmyBtn.onclick = () => { sfx.click(); try { openTrainPanel(); } catch { toast("🎖️ ابنِ مركز التدريب أولاً"); } };
  if (els.nestGeneBtn) els.nestGeneBtn.onclick = () => { sfx.click(); try { openGenePanel(); } catch { toast("🧬 ابنِ مركز العلاج أولاً"); } };
}
function syncNestHud() {
  if (!els.nestHud || els.nestHud.hidden) return;
  try {
    if (els.nestLvTxt) els.nestLvTxt.textContent = `Lv.${game.level || 1}`;
    if (els.nestXpFill) {
      const xp = game.xp || 0, need = 20 + (game.level || 1) * 10;
      els.nestXpFill.style.width = `${Math.max(4, Math.min(100, (xp / need) * 100))}%`;
    }
    if (els.nestRes) {
      const defs = nestResDef();
      [...els.nestRes.children].forEach((d, i) => {
        const b = d.querySelector("b");
        if (b && defs[i]) b.textContent = defs[i].fmt(defs[i].val());
      });
    }
    if (els.nestQuestDot) els.nestQuestDot.style.display = claimableQuests() ? "flex" : "none";
  } catch {}
}

// ---------- تحديث الواجهة ----------
let hudT = 0;
function updateHUD() {
  // مؤشر سعة التخزين 📦 (من الدليل): المخزون/السعة القصوى + تنبيه الامتلاء
  if (game.store > storeCap()) game.store = storeCap();
  els.storeEl.textContent = `${game.store}/${storeCap()}`;
  if (game.store >= storeCap() && !updateHUD._fullHit) {
    updateHUD._fullHit = true;
    toast(`📦 المخزن ممتلئ (${storeCap()})! ابنِ مخازن وطوّرها لرفع السقف`);
    try { sfx.full && sfx.full(); } catch {}
  } else if (game.store < storeCap()) updateHUD._fullHit = false;
  if (game.store >= storeCap() * 0.9 && !updateHUD._fullWarned) {
    updateHUD._fullWarned = true;
    toast("📦 المخزن شبه ممتلئ! اصرف العسل في الترقيات والفقس");
  } else if (game.store < storeCap() * 0.8) updateHUD._fullWarned = false;
  for (const k of Object.keys(game.stock || {})) { if (game.stock[k] > 500) game.stock[k] = 500; }
  els.workersEl.textContent = `${totalAnts()}/${Nest.nestCap()}`;
  els.levelEl.textContent = game.level;
  // 🌊 شارة الموجة في الشريط العلوي (بعد النصر فقط)
  try {
    if (els.waveStat) {
      const show = !!game.victory;
      els.waveStat.hidden = !show;
      if (show && els.waveEl) els.waveEl.textContent = `${game.wave || 0}🏆${game.bestWave || 0}`;
    }
  } catch {}
  els.carriedEl.textContent = `${game.store}/${storeCap()}🍯`;
  // 👑 بلا نملة ميدانية: إخفاء حمل القائد وشريطي صحته وطاقته (يبقى شريط الملكة)
  if (!updateHUD._godHidden) {
    updateHUD._godHidden = true;
    try { els.carriedEl.closest(".stat").hidden = true; } catch {}
    try { els.hpFill.closest(".barRow").hidden = true; } catch {}
    try { els.stFill.closest(".barRow").hidden = true; } catch {}
  }
  try {
    const foragers = game.workers.filter((w) => w.state !== "inside" && w.state !== "leaving").length;
    if (els.statusPillNum) els.statusPillNum.textContent = foragers;
  } catch {}
  els.hpFill.style.width = `${Math.max(0, (game.player.hp / pMax()) * 100)}%`;
  els.stFill.style.width = `${Math.max(0, game.player.st)}%`;
  els.queenFill.style.width = `${Math.max(0, Math.round(game.nest.queenHp || 0))}%`;
  els.typeSeedEl.textContent = game.stock.seed || 0;
  els.typeLeafEl.textContent = game.stock.leaf || 0;
  els.typeFruitEl.textContent = game.stock.fruit || 0;
  els.typeCrumbEl.textContent = game.stock.crumb || 0;
  if (els.typeAmberEl) els.typeAmberEl.textContent = game.stock.amber || 0;
  els.typeWorkerEl.textContent = `${game.workers.length}/${capFor("worker")}`;
  els.typeSoldierEl.textContent = `${game.soldiers.length}/${capFor("soldier")}`;
  els.typeScoutEl.textContent = `${game.scouts.length}/${capFor("scout")}`;
  const hc = hatchCost(), uc = upgradeCost();
  els.hatchCostEl.textContent = hc;
  els.upgradeCostEl.textContent = uc;
  els.hatchBtn.disabled = game.store < hc || !canAdd("worker");
  els.upgradeBtn.disabled = game.store < uc || game.capacityBonus >= 6;
  els.beastBtn.textContent = game.collection.length ? `${t("beasts")}:${game.collection.length}` : t("beasts");
  els.resSeedEl.textContent = game.stock.seed || 0;
  els.resLeafEl.textContent = game.stock.leaf || 0;
  els.resFruitEl.textContent = game.stock.fruit || 0;
  els.resCrumbEl.textContent = game.stock.crumb || 0;
  if (els.resAmberEl) els.resAmberEl.textContent = game.stock.amber || 0;
  els.resWorkerEl.textContent = `${game.workers.length}/${capFor("worker")}`;
  els.resSoldierEl.textContent = `${game.soldiers.length}/${capFor("soldier")}`;
  els.resScoutEl.textContent = `${game.scouts.length}/${capFor("scout")}`;
  els.resQueenEl.textContent = Math.max(0, Math.round((game.nest && game.nest.queenHp) || 0)) + "%";
  els.resLifeEl.textContent = game.stock.lifeleaf || 0;
  els.resHealEl.textContent = game.stock.healbloom || 0;
  els.resCrysEl.textContent = game.stock.crystal || 0;
  els.resPolEl.textContent = game.stock.pollen || 0;
  els.resMedEl.textContent = game.stock.mednectar || 0;
  els.menuBtn.innerHTML = claimableQuests() ? `☰<span class="mdot">!</span>` : "☰";
  syncNestHud();
}

// ---------- الحلقة الرئيسية ----------
const clock = new THREE.Clock();
const uGrassTime = { value: 0 }; // نسيم العشب — يُحدّث كل إطار
let foodT = 0, saveT = 0, nodeT = 0, worldT = 0, geneT = 1;

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}
// 👑 القيادة من فوق: القائد معتكف في العش (مرساة الكاميرا) — مخفي وثابت ولا يُستهدف أبداً
function godAnchor() {
  if (game.treeZone) return { x: TREE.backX, z: TREE.backZ };
  return { x: HOLE.x, z: HOLE.z };
}
function parkCommander() {
  const P = game.player; if (!P) return;
  const a = godAnchor();
  P.x = a.x; P.z = a.z; P.tx = P.tz = undefined; P.vx = P.vz = 0;
  try {
    P.ant.group.position.set(P.x, groundY(P.x, P.z), P.z);
    P.ant.group.visible = false;
  } catch {}
}
// نقطة نظر الكاميرا الحرة (مرساة القائد − الإزاحة) — تُستخدم للمناطق والهجوم السريع والزر السياقي
function camFocusX() { return game.player.x - (input.camPanX || 0); }
function camFocusZ() { return game.player.z - (input.camPanZ || 0); }

function update(dt) {
  game.time += dt;
  const t = game.time;
  const P = game.player;

  // --- 👑 القيادة من فوق: القائد معتكف في العش — ثابت ومخفي ولا يجمع ولا يُستهدف ---
  parkCommander();
  // --- 🛡️ الاستنفار + التحويل التلقائي لبيض الجنود (فحص كل ثانية) ---
  slowT -= dt;
  if (slowT <= 0) {
    slowT = 1;
    if ((game.militiaT || 0) > 0) game.militiaT = Math.max(0, game.militiaT - 1);
    try {
      if (!game.flags.autoSoldierFocus && Nest.soldierUnlocked && Nest.soldierUnlocked() && Nest.eggFocus && Nest.setEggFocus) {
        if (Nest.eggFocus() === "worker" && Nest.setEggFocus("soldier"))
          toast("⚔️ ثكنة الجنود جاهزة! بيض الملكة تحوّل للجنود تلقائياً 👑");
        game.flags.autoSoldierFocus = true;
      }
    } catch {}
  }
  // WASD/الأسهم = تحريك الكاميرا الحرة على السطح (بدل تحريك النملة)
  {
    const kv2 = keyboardVec();
    if (kv2 && !game.underground && game.started && !game.paused) {
      const k = input.camDist / 500, H = TUNE.worldHalf;
      const spd = k * 240 * dt;
      input.camPanX = THREE.MathUtils.clamp(input.camPanX - kv2.x * spd, P.x - H, P.x + H);
      input.camPanZ = THREE.MathUtils.clamp(input.camPanZ - kv2.y * spd, P.z - H, P.z + H);
    }
  }

  // زخم كاميرا طبيعي بعد رفع الإصبع — يتوقف تدريجياً ولا يؤثر أثناء السحب.
  if (!input.panActive && !game.underground && game.started && !game.paused) {
    const H = TUNE.worldHalf;
    if (Math.abs(input.panVX) + Math.abs(input.panVZ) > 0.015) {
      input.camPanX = THREE.MathUtils.clamp(input.camPanX + input.panVX * dt, P.x - H, P.x + H);
      input.camPanZ = THREE.MathUtils.clamp(input.camPanZ + input.panVZ * dt, P.z - H, P.z + H);
      const damp = Math.exp(-7.5 * dt);
      input.panVX *= damp; input.panVZ *= damp;
    } else input.panVX = input.panVZ = 0;
  }

  // --- العمال (ذكاء اصطناعي بسيط: ابحث → احمل → ارجع) ---
  for (const w of [...game.workers, ...game.scouts]) {
    if (w.inClinic || w.inTraining) continue;
    if (w.gene && w.gene.regen && w.hp !== undefined && w.hp < w.maxHp) w.hp = Math.min(w.maxHp, w.hp + w.gene.regen * dt);
    const isScout = w.kind === "scout";
    const wCap = isScout ? 1 : workerCarryCap();
    const wSp = isScout ? 7.5 : TUNE.workerSpeed * Nest.workerSpeedMult();
    const wSight = isScout ? TUNE.scoutSight : TUNE.forageRange;
    w.retarget -= dt;
    const distNest = Math.hypot(w.x - nestPos.x, w.z - nestPos.z);
    // أوامر اللاعب المباشرة (تتقدم على الذكاء التلقائي)
    if (w.order && w.state !== "inside" && w.state !== "leaving") {
      w.forceHome = false; // أي أمر جديد يُلغي العودة القسرية للمنزل
      const ow = w.order;
      if (ow.t === "follow") {
        const a = followAnchor(w);
        w.tx = a.x; w.tz = a.z; w.state = "ordered"; w.target = null;
        if (w.carried.length >= wCap) w.state = "toNest";
      } else if (ow.t === "move") {
        if (w.carried.length >= wCap) w.state = "toNest";
        else {
          const dd = Math.hypot(ow.x - w.x, ow.z - w.z);
          // الوصول للنقطة = ثبات فيها (hold) لا عودة للعش: يبقى حتى أمر جديد، ويعود فقط عند الامتلاء
          if (dd < 1.3) { w.order = { t: "hold" }; }
          else { w.tx = ow.x; w.tz = ow.z; w.state = "ordered"; w.target = null; }
        }
      } else if (ow.t === "gather") {
        const tg = ow.target;
        const valid = tg && (tg.amount !== undefined ? (tg.amount > 0 && game.nodes.includes(tg)) : game.foods.includes(tg));
        if (!valid) {
          // الهدف اختفى (التُقط/نفد): أقرب بديل ضمن المدى بدل إلغاء الأمر والعودة
          const alt = w.carried.length < wCap ? nearestForage(w.x, w.z, TUNE.forageRange) : null;
          if (alt) ow.target = alt;
          else { w.order = null; w.state = "seek"; w.retarget = 0; w.forageMiss = 0; }
        }
        else if (w.carried.length >= wCap) w.state = "toNest";
        else { w.tx = tg.x; w.tz = tg.z; w.state = "ordered"; w.target = tg; }
      } else if (ow.t === "hold") {
        if (w.carried.length >= wCap) w.state = "toNest";
        else { w.tx = w.x; w.tz = w.z; w.state = "ordered"; w.target = null; }
      }
    }
    if (!w.order && w.state !== "inside" && w.state !== "leaving" &&
        (w.carried.length >= wCap || (w.carried.length && distNest < 12 && !w.target))) {
      // في الشجرة العتيقة: ابقَ واجمع بلا رجوع تلقائي (الرجوع عبر البوابة مع القائد)
      w.state = w.treeZone ? "seek" : "toNest";
      if (w.treeZone) { w.target = null; w.retarget = 0; }
    } else if (!w.order && w.state !== "inside" && w.state !== "leaving" && (w.state !== "toNest" || !w.carried.length) && !w.forceHome) {
      // بلا أوامر: بحث تلقائي خارج العش إن كان مفعّلاً في antTuning — ومن في الداخل يبقى (ميزة 3.2)
      if (TUNE.autoForage && w.carried.length < wCap && distNest > NEST_R + 2) {
        if (w.state !== "seek") { w.state = "seek"; w.target = null; w.retarget = 0; }
      } else if (w.state !== "toNest") { w.state = "toNest"; w.target = null; }
    }
    let dx = 0, dz = 0, sp = wSp;
    if (w.state === "inside") {
      // داخل العش: سكون تام حتى يأتي أمر خروج (أي أمر عدا الثبات) + علاج راحة بطيء 🍃
      restHeal(w, dt, true, false);
      w.vx *= 0.85; w.vz *= 0.85;
      w.x += (HOLE.x - w.x) * Math.min(1, dt * 6);
      w.z += (HOLE.z - w.z) * Math.min(1, dt * 6);
      w.ant.group.position.set(w.x, groundY(w.x, w.z), w.z);
      w.ant.update(dt, 0.1, t + 2);
      const ow2 = w.order;
      if (!ow2 || ow2.t === "hold") { w.insideT = 0.5; continue; }
      // بأمرك: تفريغ سريع ثم خروج من الفتح
      w.insideT = Math.min(w.insideT, 0.25);
      w.insideT -= dt;
      if (w.insideT <= 0) {
        depositCarry(w, false);
        w.ant.group.visible = true;
        w.emergeT = 0;
        w.state = "leaving";
        const a = Math.atan2(w.x - nestPos.x, w.z - nestPos.z) + rand(-0.6, 0.6);
        w.tx = THREE.MathUtils.clamp(nestPos.x + Math.cos(a) * (MOUND_R + 3), -TUNE.worldHalf, TUNE.worldHalf);
        w.tz = THREE.MathUtils.clamp(nestPos.z + Math.sin(a) * (MOUND_R + 3), -TUNE.worldHalf, TUNE.worldHalf);
        w.retarget = 0;
      }
      continue;
    }
    if (w.state === "toNest") {
      dx = HOLE.x - w.x; dz = HOLE.z - w.z;
      if (Math.hypot(dx, dz) < 1.2) {
        if (w.carried.length) depositCarry(w, false);
        if (!w.order) {
          // بلا أوامر: دخول العش والبقاء حتى تأمر
          w.state = "inside";
          w.forceHome = false; // وصل المنزل — انتهت العودة القسرية
          w.insideT = 0.5;
          w.ant.group.visible = false;
          w.target = null;
          spawnBurst(HOLE.x, MOUND_H, HOLE.z, 0x8a5f36, 6, 1.5, 2);
          continue;
        }
      }
    }
    else if (w.state === "leaving") {
      dx = w.tx - w.x; dz = w.tz - w.z;
      if (Math.hypot(dx, dz) < 1.4) { w.state = "seek"; w.retarget = 0; w.target = null; }
    }
    else if (w.state === "seek" && !w.order && TUNE.autoForage && w.carried.length < wCap && distNest > NEST_R + 2) {
      // بحث تلقائي ضمن مدى الرؤية: أقرب قطعة مفردة أو مصدر له amount — w.retarget يمنع الفحص كل إطار
      if (!w.target && w.retarget <= 0) {
        w.retarget = 1.2;
        const f = nearestForage(w.x, w.z, wSight);
        if (f) { w.target = f; w.state = "toFood"; w.forageMiss = 0; dx = f.x - w.x; dz = f.z - w.z; }
        else {
          w.forageMiss = (w.forageMiss || 0) + 1;
          if (w.forageMiss >= TUNE.forageTries) { w.forageMiss = 0; w.state = "toNest"; w.target = null; }
        }
      }
    }
    else if (w.state === "toFood" && w.target) {
      const gone = w.target.amount !== undefined
        ? (w.target.amount <= 0 || !game.nodes.includes(w.target))
        : !game.foods.includes(w.target);
      if (gone) { w.target = null; w.state = "seek"; w.retarget = 0; }
      else { dx = w.target.x - w.x; dz = w.target.z - w.z; }
    } else { dx = w.tx - w.x; dz = w.tz - w.z; if (Math.hypot(dx, dz) < 1.5 && w.state !== "ordered") { const p = randPos(4, 6); w.tx = p.x; w.tz = p.z; } }
    // 🛡️ استنفار: بلا جنود أثناء الغارة — العمال الأصحاء يشتبكون مع السارق القريب بدل الفرار
    if ((game.militiaT || 0) > 0 && !w.order && w.state !== "inside" && w.state !== "leaving" && (w.hp || 0) > (w.maxHp || 20) * 0.4) {
      let bd = 9, mt = null;
      for (const e of game.enemies) {
        if (e.dying || (e.state !== "raid" && e.state !== "steal" && e.state !== "return")) continue;
        const dd = Math.hypot(e.x - w.x, e.z - w.z);
        if (dd < bd) { bd = dd; mt = e; }
      }
      // 🪲 الاستنفار يشمل خنفساء الحصار أيضاً (دفاع أخير بلا جنود)
      if (!mt) {
        for (const cr of game.creatures) {
          if (!cr.siege || cr.stunned) continue;
          const dd = Math.hypot(cr.x - w.x, cr.z - w.z);
          if (dd < bd) { bd = dd; mt = cr; }
        }
      }
      if (mt) {
        dx = mt.x - w.x; dz = mt.z - w.z;
        w.atkCd = Math.max(0, (w.atkCd || 0) - dt);
        if (bd < 1.9) {
          dx = 0; dz = 0;
          if (w.atkCd <= 0) {
            w.atkCd = 1.1;
            w.ant.fightT = 0.35;
            damageEnemy(mt, 3);
            spawnBurst(w.x, 0.8, w.z, 0xffd93d, 6, 2, 2);
          }
        }
      }
    }
    const d = Math.hypot(dx, dz);
    let mvx = 0, mvz = 0;
    if (d > 0.15) { mvx = (dx / d) * sp; mvz = (dz / d) * sp; }
    // فصل بسيط عن النمل الآخر + هروب الكشاف من الخنافس
    for (const o of game.workers) {
      if (o === w) continue;
      const ox = w.x - o.x, oz = w.z - o.z;
      const od = Math.hypot(ox, oz);
      if (od < 1.1 && od > 0.01) { mvx += (ox / od) * 2; mvz += (oz / od) * 2; }
    }
    if (isScout) {
      for (const b of [...game.beetles, ...game.creatures.filter((c) => c.hostile && !c.stunned)]) {
        const bx = w.x - b.x, bz = w.z - b.z;
        const bd = Math.hypot(bx, bz);
        if (bd < 6 && bd > 0.01) { mvx += (bx / bd) * 9; mvz += (bz / bd) * 9; }
      }
    }
    w.vx += (mvx - w.vx) * (1 - Math.exp(-dt * 5));
    w.vz += (mvz - w.vz) * (1 - Math.exp(-dt * 5));
    w.x += w.vx * dt; w.z += w.vz * dt;
    collideAndClamp(w, 0.6);
    const ws = Math.hypot(w.vx, w.vz);
    if (ws > 0.4) w.yaw = angleLerp(w.yaw, Math.atan2(w.vx, w.vz), 1 - Math.exp(-dt * 8));
    w.ant.group.position.set(w.x, groundY(w.x, w.z), w.z);
    w.ant.group.rotation.y = w.yaw;
    w.ant.update(dt, Math.min(1, ws / wSp), t + 2);
    // بزوغ من الفتح: يكبر تدريجياً بعد الفقس
    if (w.emergeT < 1) {
      w.emergeT = Math.min(1, w.emergeT + dt * 1.1);
      w.ant.group.scale.setScalar(w.baseScale * (0.25 + 0.75 * w.emergeT));
    }
    // حصاد العامل: قطع مفردة أو من المصادر
    harvestTick(w, wCap, false, dt, isScout ? 1.2 : Nest.workerSpeedMult());
    if (w.carried.length >= wCap && w.state !== "toNest") {
      w.state = "toNest";
      w.target = null;
    }
  }

  // --- الخنافس ---
  for (const b of game.beetles) {
    b.atkCd -= dt;
    const dx = P.x - b.x, dz = P.z - b.z;
    const dp = Math.hypot(dx, dz);
    const dn = Math.hypot(b.x - nestPos.x, b.z - nestPos.z);
    const playerSafe = Math.hypot(P.x - nestPos.x, P.z - nestPos.z) < NEST_R + 2.5;
    let mx = 0, mz = 0, sp = b.speed;
    // داخل العش: الخنافس لا ترى اللاعب ولا تهاجمه أبداً — تتجول فقط
    // والحياة البرية مبعدة عن العش (WILD_KEEPOUT_R) — فقط الغارات تقترب
    if (dp < 9 && dn > WILD_KEEPOUT_R && !playerSafe && !game.underground) {
      sp = 6.4;
      mx = dx / Math.max(0.5, dp); mz = dz / Math.max(0.5, dp);
      if (dp < 1.9 && b.atkCd <= 0) {
        b.atkCd = 1.1;
        hurtPlayer(12, b.x, b.z);
      }
    } else {
      b.wanderT -= dt;
      if (b.wanderT <= 0 || Math.hypot(b.tx - b.x, b.tz - b.z) < 1.5) {
        const p = randPos(6, WILD_KEEPOUT_R + 8);
        b.tx = p.x; b.tz = p.z;
        b.wanderT = rand(3, 7);
      }
      const wx = b.tx - b.x, wz = b.tz - b.z;
      const wd = Math.max(0.3, Math.hypot(wx, wz));
      mx = wx / wd; mz = wz / wd;
    }
    // الطرد من منطقة الحياة البرية: دفع قوي للخارج حتى مسافة بعيدة عن العش
    // (الحلقة الذهبية المرئية عند NEST_CLEAN_R تبقى كما هي — فقط الغارات تتجاوزها)
    {
      const ndn = Math.hypot(b.x - nestPos.x, b.z - nestPos.z);
      if (ndn < WILD_KEEPOUT_R + 6) {
        const ox = (b.x - nestPos.x) / Math.max(0.5, ndn), oz = (b.z - nestPos.z) / Math.max(0.5, ndn);
        if (ndn < WILD_KEEPOUT_R) { mx = ox; mz = oz; sp = Math.max(sp, 7.5); }
        else { mx += ox * 1.5; mz += oz * 1.5; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
      }
    }
    b.x += mx * sp * dt; b.z += mz * sp * dt;
    collideAndClamp(b, 0.9);
    if (Math.hypot(mx, mz) > 0.01) b.yaw = angleLerp(b.yaw, Math.atan2(mx, mz), 1 - Math.exp(-dt * 6));
    const bgy = groundY(b.x, b.z);
    b.group.position.set(b.x, bgy, b.z);
    b.group.rotation.y = b.yaw;
    b.update(dt, t);
    // شريط الصحة + وميض الإصابة
    if (b.hitFlash > 0) {
      b.hitFlash = Math.max(0, b.hitFlash - dt * 5);
      b.group.position.x += rand(-1, 1) * b.hitFlash * 0.15;
    }
    const showHp = b.hp < b.maxHp;
    b.hpBg.visible = b.hpFg.visible = showHp;
    if (showHp) {
      b.hpBg.position.set(b.x, bgy + 1.7, b.z);
      const frac = Math.max(0.001, b.hp / b.maxHp);
      b.hpFg.scale.x = frac;
      b.hpFg.position.set(b.x - (1 - frac) * 0.6, bgy + 1.7, b.z);
    }
    // قتال متقارب: الخنفساء ترد على أقرب جندي أو حليف ملاصق لها
    if (!game.underground && b.atkCd <= 0) {
      let ns = null, nd = 2.3;
      for (const s of game.soldiers) {
        if (s.dying || s.inside) continue;
        const d = Math.hypot(s.x - b.x, s.z - b.z);
        if (d < nd) { nd = d; ns = s; }
      }
      for (const a of game.allies) {
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < nd) { nd = d; ns = a; }
      }
      if (ns) {
        b.atkCd = 1.1;
        if (ns.kind === "soldier") hitSoldier(ns, 8, b);
        else hurtAlly(ns, 8, b);
      }
    }
  }
  // إعادة توليد الخنافس للحفاظ على التحدي
  if (game.beetles.length < TUNE.beetleCount) {
    game.beetleRespawnT -= dt;
    if (game.beetleRespawnT <= 0) {
      game.beetleRespawnT = 20;
      game.beetles.push(createBeetle());
    }
  }

  // --- المخلوقات والحلفاء: تجول وقتال وأسر ---
  updateCreatures(dt, t);

  // --- المعارك: المستعمرات المعادية والغارات ---
  if ((game.raidCd || 0) > 0) game.raidCd = Math.max(0, game.raidCd - dt);
  updateEnemies(dt, t);

  // --- مقذوفات أشواك الكهرمان 🏹 ---
  updateShots(dt);

  // --- الجنود: أوامر اللاعب أو دوريات تلقائية + قتال + موت ---
  for (const s of [...game.soldiers]) {
    s.atkCd -= dt;
    s.shotCd = Math.max(0, (s.shotCd || 0) - dt);
    if (s.inClinic || s.inTraining) { hideGuardRing(s); continue; }
    // داخل العش: سكون حتى يأتي أمر خروج (أي أمر عدا الثبات) + علاج راحة بطيء 🍃
    if (s.inside) {
      if (s.order && s.order.t !== "hold") {
        s.inside = false;
        try { s.ant.group.visible = true; } catch {}
        s.emergeT = 0;
        s.x = HOLE.x + rand(-1, 1); s.z = HOLE.z + rand(-1, 1);
      } else { restHeal(s, dt, true, false); continue; }
    }
    // أنيميشن الموت: ميلان خفيف ثم تبقى الجثة واقفة كأثر (لا غوص ولا اختفاء)
    if (s.dying) {
      hideGuardRing(s);
      s.dieT += dt;
      const k = Math.min(1, s.dieT / 0.45);
      s.ant.group.rotation.z = k * 0.28;
      s.ant.update(dt, 0, t + 5);
      if (s.dieT > 1.0) removeSoldier(s, true);
      continue;
    }
    const spd = s.spd || 6;
    if (s.gene && s.gene.regen && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.gene.regen * dt);
    const beetleNear = (r) => {
      const ne = nearestEnemy(s.x, s.z, r);
      return ne ? { b: ne.e, d: ne.d } : null;
    };
    const strike = (b, d) => {
      const RR = b.attackRange || 1.7;
      if (d > RR) return { mx: ((b.x - s.x) / d) * spd, mz: ((b.z - s.z) / d) * spd };
      if (s.atkCd <= 0) {
        s.atkCd = 0.9;
        s.ant.fightT = 0.35;
        let sdt = (s.dmg || 6) * dmgMul();
        // 🗡️ المطارِد صياد لصوص: ضرر مضاعف ضد السارقين (سرقة/هروب/غارة)
        if (s.variant === "swift" && b && (b.state === "raid" || b.state === "steal" || b.state === "return")) {
          sdt *= 2;
          if (!game._swiftTip) { game._swiftTip = true; toast("🗡️ المطارِد يصطاد اللصوص! ضرر ×2 ضد السارقين"); }
        }
        damageEnemy(b, sdt);
        if (s.gene && s.gene.venom && !b.isColony && !b.isMound) applyPoison(b, s.gene.venom, 3);
      }
      return { mx: 0, mz: 0 };
    };
    let mvx = 0, mvz = 0;
    if (s.order && s.order.t === "hold") s.order = { t: "guard", x: s.x, z: s.z, r: 2 }; // ثبات تام (من البوابة مثلاً)
    const o = s.order;
    if (o && o.t === "move") {
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d < 1.3) s.order = { t: "guard", x: o.x, z: o.z, r: GUARD_R };
      else {
        const k = Math.min(1, d / 3);
        mvx = ((o.x - s.x) / d) * spd * k; mvz = ((o.z - s.z) / d) * spd * k;
      }
    } else if (o && o.t === "attack") {
      if (!enemyAlive(o.b)) s.order = { t: "guard", x: s.x, z: s.z, r: GUARD_R }; // سقط الهدف → ثبات مكانه
      else {
        const dd = Math.hypot(o.b.x - s.x, o.b.z - s.z);
        const RR = o.b.attackRange || 1.7;
        const A = archeryLevel() ? ARCHERY[archeryLevel()] : null;
        if (A && dd <= A.range + 1 && dd > RR + 0.6) { if (rangedTry(s, o.b, dd)) { mvx = mvz = 0; } } // رامٍ: ثبات ورمي بلا تقدم
        else { const r = strike(o.b, dd); mvx = r.mx; mvz = r.mz; }
      }
    } else if (o && o.t === "guard") {
      // ثبات ميداني: اشتباك فقط داخل نطاق الموقع (يُقاس من النقطة لا من الجندي) — بلا مطاردة بعيدة
      const lr = o.r || GUARD_R;
      const hd = Math.hypot(o.x - s.x, o.z - s.z);
      let e = null;
      const ne = nearestEnemy(s.x, s.z, lr + 6);
      if (ne && Math.hypot(ne.e.x - o.x, ne.e.z - o.z) <= lr + 2) e = { b: ne.e, d: ne.d };
      if (e) {
        const RR = e.b.attackRange || 1.7;
        const A = archeryLevel() ? ARCHERY[archeryLevel()] : null;
        if (A && e.d <= A.range + 1 && e.d > RR + 0.6) { if (rangedTry(s, e.b, e.d)) { mvx = mvz = 0; } } // رمي من الموقع بلا مطاردة
        else { const r = strike(e.b, e.d); mvx = r.mx; mvz = r.mz; }
      }
      else if (hd > 1.5) { mvx = ((o.x - s.x) / hd) * spd; mvz = ((o.z - s.z) / hd) * spd; }
      else restHeal(s, dt, false, true); // ثابت بموقعه بلا عدو: يرتاح ويتعالج ببطء 🍃
    } else if (o && o.t === "follow") {
      const a = followAnchor(s);
      const d = Math.hypot(a.x - s.x, a.z - s.z);
      if (d > 1.6) {
        const k = Math.min(1, d / 3);
        mvx = ((a.x - s.x) / d) * spd * k; mvz = ((a.z - s.z) / d) * spd * k;
      } else {
        const e = beetleNear(10);
        if (e) {
          const RR = e.b.attackRange || 1.7;
          const A = archeryLevel() ? ARCHERY[archeryLevel()] : null;
          if (A && e.d <= A.range + 1 && e.d > RR + 0.6) { if (rangedTry(s, e.b, e.d)) { mvx = mvz = 0; } }
          else { const r = strike(e.b, e.d); mvx = r.mx; mvz = r.mz; }
        }
      }
    } else {
      // بلا أوامر منك: عودة للعش والدخول — لا دوريات تلقائية
      const hx = HOLE.x - s.x, hz = HOLE.z - s.z;
      const hd = Math.hypot(hx, hz);
      if (hd < 1.4) {
        hideGuardRing(s);
        s.inside = true;
        s.x = HOLE.x; s.z = HOLE.z; s.tx = s.x; s.tz = s.z;
        try { s.ant.group.visible = false; } catch {}
      } else {
        mvx = (hx / hd) * spd; mvz = (hz / hd) * spd;
      }
    }
    const sk = 1 - Math.exp(-dt * 6);
    s.vx += (mvx - s.vx) * sk;
    s.vz += (mvz - s.vz) * sk;
    s.x += s.vx * dt; s.z += s.vz * dt;
    collideAndClamp(s, 0.6);
    const ssp = Math.hypot(s.vx, s.vz);
    if (ssp > 0.4) s.yaw = angleLerp(s.yaw, Math.atan2(s.vx, s.vz), 1 - Math.exp(-dt * 8));
    s.ant.group.position.set(s.x, groundY(s.x, s.z), s.z);
    s.ant.group.rotation.y = s.yaw;
    if (s.emergeT < 1) {
      s.emergeT = Math.min(1, s.emergeT + dt * 1.1);
      s.ant.group.scale.setScalar(s.baseScale * (0.25 + 0.75 * s.emergeT));
    }
    // حلقة نطاق الثبات (تظهر فقط أثناء الحراسة على السطح)
    if (!s.dying && !s.inside && !s.inClinic && !s.inTraining && s.order && s.order.t === "guard") guardRing(s, s.order.x, s.order.z, s.order.r || GUARD_R);
    else hideGuardRing(s);
    s.ant.update(dt, Math.min(1, ssp / 7), t + 5);
  }

  // --- تجنّب الاصطدام: دفع متبادل بين كل الوحدات (نمل + جنود + كشافة) ---
  {
    const movers = [...game.workers, ...game.scouts, ...game.soldiers.filter((s) => !s.dying)];
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], b = movers[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = 1.5;
        if (d < min && d > 0.001) {
          const push = ((min - d) / 2) * 0.6;
          const nx = dx / d, nz = dz / d;
          a.x -= nx * push; a.z -= nz * push;
          b.x += nx * push; b.z += nz * push;
        } else if (d <= 0.001) {
          a.x += rand(-0.1, 0.1); a.z += rand(-0.1, 0.1);
        }
      }
    }
  }

  // --- الطعام: طفو هادئ + تمايل خفيف (بلا دوران مروحة) ---
  for (const f of game.foods) {
    f.bob += dt * 2;
    if (!f.flat) f.mesh.rotation.y = (f.baseRotY || 0) + Math.sin(f.bob * 0.7) * 0.35;
    if (f.kind !== "leaf") f.mesh.position.y = (f.baseY || 0.3) + Math.sin(f.bob) * 0.06;
  }
  foodT -= dt;
  if (foodT <= 0) {
    foodT = 2;
    if (game.foods.length < TUNE.maxFoodOnGround) {
      spawnFood();
      if (game.foods.length < TUNE.maxFoodOnGround - 6) spawnFood();
    }
  }
  // تجديد مصادر الموارد (أكوام/شجيرات)
  nodeT -= dt;
  if (nodeT <= 0) {
    nodeT = 4;
    regionFoodTick();
    rareTick();
    feastTick(dt);
    if (game.nodes.filter((n) => !n.rare && !n.feast).length < 16) spawnNode();
  }
  // العالم: اكتشاف مناطق + أحداث عشوائية
  worldT -= dt;
  if (worldT <= 0) {
    worldT = 0.5;
    checkRegions();
    checkQuests();
  }
  tutTick(dt);
  queenStarveTick(dt);
  musicTick();
  treeTick(dt, t);
  eventT -= dt;
  if (eventT <= 0) {
    eventT = rand(70, 130);
    if (!game.underground) triggerEvent();
  }
  // محاكاة العش تحت الأرض (الحفر والبناء والحضانة تستمر دائماً)
  try { Nest.updateNest(dt); } catch { /* قبل التهيئة */ }

  // حلقة العش النابضة + نبضة الإيداع
  nestRing.material.opacity = 0.4 + Math.sin(t * 3) * 0.2;
  if (game.mound) {
    const mby = game.moundBaseY || 0.34;
    if (game.nestPulse > 0) {
      game.nestPulse = Math.max(0, game.nestPulse - dt * 2);
      const s = 1 + game.nestPulse * 0.12;
      game.mound.scale.set(1.05 * s, mby * s, 1.05 * s);
    } else {
      game.mound.scale.set(1.05, mby, 1.05);
    }
  }

  // أنيميشن: انتفاخ الحمل + جسيمات + طيران + نبض المصادر
  updateFlyers(dt);
  updateParticles(dt);
  const popK = 1 - Math.exp(-dt * 6);
  P.carryPop = Math.max(0, (P.carryPop || 0) - dt * 2.5);
  P.ant.carrySlot.scale.setScalar(1 + P.carryPop * 0.45);
  for (const w of [...game.workers, ...game.scouts]) {
    w.carryPop = Math.max(0, (w.carryPop || 0) - dt * 2.5);
    w.ant.carrySlot.scale.setScalar(1 + w.carryPop * 0.45);
  }
  for (const n of game.nodes) {
    if (n.pulse > 0) {
      n.pulse = Math.max(0, n.pulse - dt * 4);
      n.group.scale.setScalar(1 + n.pulse * 0.12);
    }
  }

  // سهم إرشادي ذهبي فوق اللاعب يشير لمدخل العش أثناء الحمل
  if (game.arrowPivot) {
    const showArrow = P.carried.length > 0;
    game.arrowPivot.visible = showArrow;
    if (showArrow) {
      game.arrowPivot.position.set(P.x, 2.4 + Math.sin(t * 4) * 0.15 + groundY(P.x, P.z), P.z);
      game.arrowPivot.rotation.y = Math.atan2(HOLE.x - P.x, HOLE.z - P.z);
    }
  }

  // --- الكاميرا: تتبع سلس + تقريب + إزاحة حرة دائمة (بلا تلاشٍ) ---
  input.camDist += (input.camTarget - input.camDist) * (1 - Math.exp(-dt * 5));
  const cd = input.camDist;
  const lead = 2.2;
  const panX = input.camPanX || 0, panZ = input.camPanZ || 0;
  const lookX = P.x - panX + P.vx * 0.12, lookZ = P.z - panZ + P.vz * 0.12 - lead * 0.3;
  const camTX = P.x - panX, camTZ = P.z - panZ + cd * 0.62;
  const camTY = cd * 0.85;
  const ck = 1 - Math.exp(-dt * 4);
  camera.position.x += (camTX - camera.position.x) * ck;
  camera.position.y += (camTY - camera.position.y) * ck;
  camera.position.z += (camTZ - camera.position.z) * ck;
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt * 2.2);
    camera.position.x += rand(-1, 1) * game.shake * 0.5;
    camera.position.y += rand(-1, 1) * game.shake * 0.35;
  }
  camera.lookAt(lookX, 0.8, lookZ);

  // متابعة الشمس للاعب حتى تبقى الظلال حادة
  sunLight.position.set(P.x + 30, 48, P.z + 18);
  sunLight.target.position.set(P.x, 0, P.z);
  sunLight.target.updateMatrixWorld();

  tickPoison(dt);
  trainYardTick(dt, t);
  nestAntsTick(dt, t);
  mmT -= dt;
  if (mmT <= 0) { mmT = game.settings.quality === "low" ? 0.5 : 0.25; drawMinimap(); }
  hudT -= dt;
  if (hudT <= 0) { hudT = 0.15; updateHUD(); updateHpBars(); updateCtxBtn(); updateQuickBar(); }
  geneT -= dt;
  if (geneT <= 0) { geneT = 1; if (!els.genePanel.hidden) renderGenePanel(); if (!els.trainPanel.hidden) renderTrain(); }
  saveT -= dt;
  if (saveT <= 0) { saveT = 5; saveGame(); }
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  uGrassTime.value += dt;
  if (game.started && !game.paused) { update(dt); fpsTick(dt); }
  if (game.underground) {
    if (game.started && !game.paused) Nest.drawNest();
  } else {
    renderer.render(scene, camera);
  }
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

// ---------- شاشات البداية والإيقاف والإعدادات (المرحلة النهائية) ----------
function openBuild() {
  if (game.underground) { toast("⛏️ اضغط على تراب لامع للحفر أو على غرفة للترقية"); return; }
  const d = Math.hypot(game.player.x - nestPos.x, game.player.z - nestPos.z);
  if (d < 14) enterNest();
  else toast("🏠 اقترب من التل البني للدخول والبناء");
}
function renderStart() {
  const has = localStorage.getItem(SAVE_KEY);
  els.startPlayBtn.textContent = has ? t("start_continue") : t("start_play");
  let info = "";
  try {
    const s = JSON.parse(has || "null");
    if (s) info = `🍯 ${s.store || 0} • 🐜 ${(s.extraWorkers || 0) + TUNE.startWorkers} • ⭐ ${s.level || 1}`;
  } catch {}
  els.startSaveInfo.textContent = info;
  els.startWipeBtn.style.display = has ? "" : "none";
  renderDiffRow();
}
function startPlay() {
  els.startScreen.hidden = true;
  els.pausePanel.hidden = true;
  try { applyQuality(true); } catch {} // تطبيق الجودة المحفوظة (ومنها lowfx للأجهزة الضعيفة)
  try { ensureRedAnt(); } catch {} // تحميل مسبق لموديل النملة الحمراء (نخبة العدو)
  if (!game.started) {
    game.started = true;
    for (const id of ["topBar", "statusPill", "vitalsPanel", "resBar", "zoomCtn", "actionCtn", "helpBtn", "pauseBtn"]) els[id].hidden = false;
    refreshMapVis();
    applyUILayout();
    updateHUD();
    drawMinimap();
    // 🎓 تعليم تدريجي للعبة جديدة تماماً (بلا حفظ سابق) — 🌱 المبتدئ يأخذ الموسّع 12 خطوة
    if (game._fresh && (!game.tutorial || !game.tutorial.done)) {
      tutStart();
      toast(game.difficulty === "beginner" ? "🌱 طور المبتدئ: سوي كذا سوي كذا — اتبع الخطوات الذهبية!" : "🎓 وضع التعليم: اتبع الخطوات الذهبية!");
    } else {
      if (game.tutorial && !game.tutorial.done) { game.tutorial.active = true; tutRender(); }
      else toast("🐜 جيشك يسكن العش — زر ⚔️ جيش (تحت الخريطة) ثم 🐜/⚔️/🤕 لتحديدهم، ولا يخرجون إلا بأمرك");
    }
  }
  game.paused = false;
}
function startHelp() { els.startScreen.hidden = true; els.helpModal.hidden = false; }
let wipeArmed = null;
function armWipe(btn, txt) {
  const now = performance.now();
  if (wipeArmed === btn && now - (wipeArmed._t || 0) < 3000) {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    location.reload();
    return;
  }
  wipeArmed = btn; btn._t = now;
  const old = btn.textContent;
  btn.textContent = txt;
  setTimeout(() => { if (btn.textContent === txt) btn.textContent = old; }, 3000);
}
function togglePause(on) {
  if (!game.started) return;
  game.paused = on;
  els.pausePanel.hidden = !on;
  if (on) saveGame();
}
function goHome() {
  game.paused = true;
  els.pausePanel.hidden = true;
  els.settingsPanel.hidden = true;
  renderStart();
  els.startScreen.hidden = false;
}
// ---------- 🏆 النصر والهزيمة + 🎓 التعليم التدريجي + ⚙️ الجودة التلقائية ----------
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function endStatsHtml() {
  let s = `<span>⏱️ ${fmtTime(game.time)}</span><span>⭐ ${game.level}</span>` +
    `<span>⚔️ ${game.stats.kills || 0}</span><span>🍯 ${Math.floor(game.store)}</span>`;
  if (game.victory) s += `<span>🌊 موجة ${(game.wave || 0)}/🏆 ${(game.bestWave || 0)}</span>`;
  return s;
}
// هل سقطت المستعمرتان معاً؟ — لحظة النصر
function checkVictory() {
  if (game.victory || game.endShown) return;
  if (!game.colonies.length) return;
  if (game.colonies.every((c) => !c.alive)) victory();
}
function victory() {
  if (game.victory && game.endShown) return;
  game.victory = true;
  game.endShown = true;
  game.wave = 0; // اللعب الحر بلا موجات حتى يبدؤها اللاعب
  // إتمام مهمات المستعمرتين تلقائياً — لكن مهمتا الشجرة تبقيان للعب الحر
  try {
    const keepFrom = Math.max(0, MAIN_QUESTS.length - 2);
    if (game.quests && game.quests.main < keepFrom) {
      game.quests.main = keepFrom;
      game.quests.mainDone = false;
    }
  } catch {}
  // إيقاف الغارات نهائياً
  game.raidCd = 99999;
  saveGame();
  try { musicSting(true); } catch {}
  sfx.victory();
  game.shake = 1.2;
  showEnd(true);
}
// ---------- 🌊 الموجات اللانهائية بعد النصر ----------
function waveK(w) { return 1 + 0.5 * Math.max(0, (w || 1) - 1); }
function startNextWave() {
  if (!game.victory) return false;
  if (game.colonies.some((c) => c.alive)) {
    toast("⚔️ الموجة الحالية ما زالت مشتعلة — دمّر المستعمرتين أولاً!");
    return false;
  }
  game.wave = (game.wave || 0) + 1;
  game.bestWave = Math.max(game.bestWave || 0, game.wave);
  game.raidCd = 0; // استئناف الغارات فوراً
  for (const col of game.colonies) rebuildColony(col);
  centerMsg(`🌊 الموجة ${game.wave} بدأت! العدو أقوى (+${Math.round((waveK(game.wave) - 1) * 100)}%)!`, 2600);
  sfx.alarm();
  saveGame();
  updateHUD();
  try { renderWorld("quests"); } catch {}
  return true;
}
function waveCleared() {
  const w = game.wave || 0;
  game.stats.waves = (game.stats.waves || 0) + 1;
  const reward = 60 + w * 30;
  game.store = Math.min(storeCap(), game.store + reward);
  addXP(25);
  game.raidCd = 99999; // هدوء حتى الموجة التالية
  centerMsg(`🌊 سُحقت الموجة ${w}! +${reward}🍯 — افتح 🌍 ← 📜 لبدء الموجة ${w + 1}`, 3000);
  toast(`🏆 أفضل موجة: ${game.bestWave}! استرح وطوّر جيشك ثم ابدأ التالية`);
  sfx.victory();
  saveGame();
  updateHUD();
  try { renderWorld("quests"); } catch {}
}
function defeat(reason) {
  if (game._defeatShown) return; // لوحة الهزيمة ظهرت (حتى لا تتكرر كل إطار)
  game._defeatShown = true;
  game.paused = true;
  try { musicSting(false); } catch {}
  sfx.defeat();
  saveGame();
  showEnd(false, reason);
}
function showEnd(win, reason) {
  game.paused = true;
  try {
    els.pausePanel.hidden = true;
    els.settingsPanel.hidden = true;
    els.helpModal.hidden = true;
    if (els.tutBar) els.tutBar.hidden = true;
    for (const id of ["roomPanel", "buildMenu", "beastPanel", "genePanel", "trainPanel", "worldPanel"]) {
      if (els[id]) els[id].hidden = true;
    }
  } catch {}
  els.endIcon.textContent = win ? "🏆" : "💀";
  els.endHeading.textContent = win ? "النصر الساحق!" : "سقطت المستعمرة...";
  els.endDesc.textContent = win
    ? "دمّرت مستعمرتي الظل 🖤 والحمراء 👹 معاً! أرض المروج كلها تحت راية نملتك. يمكنك مواصلة اللعب الحر بسلام — بلا غارات — أو بدء مستعمرة جديدة."
    : (reason || "ماتت الملكة 👑 جوعاً بعد إهمال طويل... بلا ملكة لا بيض ولا مستقبل للمستعمرة.");
  els.endStats.innerHTML = endStatsHtml();
  if (win) {
    els.endHeading.textContent = "النصر الساحق!";
    els.endDesc.textContent = "دمّرت مستعمرتي الظل 🖤 والحمراء 👹 معاً! ابدأ الموجة 1: ستعودان أقوى (+50% كل موجة، غارات أسرع وأشرس) — بلا نهاية! أو واصل اللعب الحر بسلام.";
  }
  els.endPrimaryBtn.textContent = win ? "🌊 بدء الموجة 1" : "💚 إنقاذ الملكة (نصف المخزن)";
  els.endSecondaryBtn.textContent = "🆕 مستعمرة جديدة";
  els.endSecondaryBtn.classList.add("ghost");
  els.endSecondaryBtn.classList.remove("danger");
  if (els.endFreeBtn) {
    els.endFreeBtn.hidden = !win;
    if (win) els.endFreeBtn.onclick = () => {
      sfx.click();
      els.endPanel.hidden = true;
      game.paused = false;
      toast("🌿 لعب حر: المستعمرتان مدمرتان — ابنِ إمبراطوريتك بسلام!");
    };
  }
  els.endPanel.hidden = false;
  els.endPrimaryBtn.onclick = () => {
    sfx.click();
    if (win) {
      els.endPanel.hidden = true;
      game.paused = false;
      startNextWave();
    } else {
      const cost = Math.floor(game.store / 2);
      game.store -= cost;
      if (game.nest) { game.nest.queenHp = 30; game.nest.dormant = false; game.nest.starveT = 0; game.nest.eatT = 12; }
      game.endShown = false;
      game._defeatShown = false;
      els.endPanel.hidden = true;
      game.paused = false;
      saveGame();
      sfx.hatch();
      centerMsg(`💚 عاشت الملكة! (−${cost}🍯) أطعمها باستمرار!`);
    }
  };
  els.endSecondaryBtn.onclick = () => {
    sfx.click();
    if (els.endSecondaryBtn.dataset.armed) {
      try { localStorage.removeItem(SAVE_KEY); } catch {}
      location.reload();
      return;
    }
    els.endSecondaryBtn.dataset.armed = "1";
    els.endSecondaryBtn.textContent = "⚠️ اضغط مجدداً للتأكيد";
    setTimeout(() => {
      try {
        if (els.endSecondaryBtn) { els.endSecondaryBtn.dataset.armed = ""; els.endSecondaryBtn.textContent = "🆕 مستعمرة جديدة"; }
      } catch {}
    }, 3000);
  };
}
// ---------- 🎓 التعليم التدريجي: 6 خطوات للمستعمرة الجديدة ----------
const TUT_STEPS = [
  { text: "🎯 حدد جيشك: لمستان على عامل لتحديد العمال (أو مطوّل+سحب لمربع التحديد، وWASD/الأسهم للكاميرا على الكمبيوتر)", check: () => (army.sel.size > 0), reward: 2 },
  { text: "🌱 حدد عمالك (لمستان على عامل) ثم انقر طعاماً: سيخرجون من العش ويجمعونه", check: () => ((game.player && game.player.carried.length) || (game.stats.food || 0) > 0 || game.workers.some((w) => (w.carried || []).length > 0)), reward: 3 },
  { text: "🏠 عُد إلى التل البني لإيداع الطعام (اتبع السهم الذهبي)", check: () => (game.store > 0), reward: 5 },
  { text: "🐜 افقس أول عامل من زر ☰ القائمة", check: () => (game.workers.length > TUNE.startWorkers), reward: 5 },
  { text: "🕳️ ادخل العش: اقترب من التل ثم انقره", check: () => (game.underground || game._tutEnteredNest ? true : false), reward: 5 },
  { text: "⛏️ احفر غرفة: انقر تراباً لامعاً ✨ (موضع مرتّب بجانب الممر)", check: () => (game.nest && (Object.keys(game.nest.cells || {}).length > 5 || (game.nest.jobs || []).length > 0)), reward: 10 },
];
// ---------- 🌱🎓 التعليم الموسّع لطور المبتدئ: 12 خطوة «سوي كذا سوي كذا» ----------
const TUT_BEGINNER = [
  { text: "🌱 أهلاً أيها القائد! أول شي سوي هيج: <b>المس عاملاً لمستين</b> لتحديد عمالك", check: () => (army.sel.size > 0), reward: 2 },
  { text: "🌱 عفية! هسه سوي هيج: <b>انقر أي طعام قريب</b> وخلي عمالك يجمعونه", check: () => ((game.player && game.player.carried.length) || (game.stats.food || 0) > 0 || game.workers.some((w) => (w.carried || []).length > 0)), reward: 3 },
  { text: "🏠 ممتاز! هسه سوي هيج: <b>ارجع للتل البني</b> وأودع الطعام (اتبع السهم الذهبي ➡️)", check: () => (game.store > 0), reward: 5 },
  { text: "🐜 عاشت إيدك! هسه سوي هيج: افتح <b>☰ القائمة وفقس عاملاً جديداً</b> 🐜", check: () => (game.workers.length > TUNE.startWorkers), reward: 5 },
  { text: "🕳️ زين! هسه سوي هيج: <b>اقترب من التل ثم انقره</b> لتدخل العش تحت الأرض", check: () => (game.underground || game._tutEnteredNest ? true : false), reward: 5 },
  { text: "⛏️ داخل العش: سوي هيج — <b>انقر تراباً لامعاً ✨</b> (موضع مرتّب بجانب الممر) لتحفر غرفة", check: () => (game.nest && (Object.keys(game.nest.cells || {}).length > 5 || (game.nest.jobs || []).length > 0)), reward: 10 },
  { text: "⬆️ حلو! هسه سوي هيج: اضغط <b>زر السطح ⬆️</b> وارجع فوق", check: () => (!!game._tutExitedNest), reward: 5 },
  { text: "⭐ قوي! هسه سوي هيج: افتح <b>🛒 التطوير واشترِ أي ترقية</b> (تقوّي مستعمرتك)", check: () => (game.capacityBonus > 0 || Object.values(game.mods || {}).some((v) => (v | 0) > 0)), reward: 8 },
  { text: "⚔️ صار وقت الجيش! سوي هيج: ادخل العش وافتح <b>غرفة الملكة 👑 وبدّل البيض إلى الجنود ⚔️</b>", check: () => ((game.soldiers && game.soldiers.some((s) => !s.dying)) || (Nest.eggFocus && Nest.eggFocus() !== "worker") || (game.flags && game.flags.autoSoldierFocus)), reward: 8 },
  { text: "⚔️ ممتاز! هسه سوي هيج: <b>حدد جنودك وانقر أي عدو</b> ليهجموا عليه", check: () => ((game.stats.kills || 0) > 0), reward: 10 },
  { text: "🐾 عفية بطل! هسه سوي هيج: اهزم وحشاً برياً ثم <b>انقره وهو دائخ 😵</b> لتأسره", check: () => ((game.stats.captures || 0) > 0), reward: 10 },
  { text: "⭐ أسطوري! آخر شي سوي هيج: اجمع وطوّر حتى <b>تصعد للمستوى 3</b> ⭐", check: () => ((game.level || 1) >= 3), reward: 15 },
];
function tutList() { return (game.tutorial && game.tutorial.beg) || game.difficulty === "beginner" ? TUT_BEGINNER : TUT_STEPS; }
function tutStart() {
  if (game.tutorial && game.tutorial.done) return;
  game.tutorial = { step: 0, done: false, active: true, beg: game.difficulty === "beginner" };
  saveGame();
  tutRender();
}
function tutSkip() {
  game.tutorial = { step: 0, done: true, active: false, beg: !!(game.tutorial && game.tutorial.beg) };
  if (game.tutorial.beg) game.tutBegDone = true;
  if (els.tutBar) els.tutBar.hidden = true;
  saveGame();
  toast("📖 تخطيت التعليم — بالتوفيق أيها القائد!");
}
function tutRender() {
  const tu = game.tutorial;
  if (!tu || !tu.active || tu.done) { if (els.tutBar) els.tutBar.hidden = true; return; }
  const list = tutList();
  const st = list[Math.min(tu.step, list.length - 1)];
  if (!st) { tutDone(); return; }
  if (els.tutBar) els.tutBar.hidden = false;
  if (els.tutTxt) els.tutTxt.innerHTML = st.text;
  if (els.tutProg) els.tutProg.textContent = t("step_x_y", { a: Math.min(tu.step + 1, list.length), b: list.length });
}
function tutDone() {
  const beg = !!(game.tutorial && game.tutorial.beg);
  game.tutorial = { step: tutList().length, done: true, active: false, beg };
  if (beg) game.tutBegDone = true;
  if (els.tutBar) els.tutBar.hidden = true;
  game.store += beg ? 30 : 15;
  addXP(10);
  saveGame();
  sfx.level();
  centerMsg(beg ? "🎓 خلصت تدريب المبتدئ! +30🍯 — صرت قائد حقيقي 🌱" : "🎓 أكملت التدريب! +15🍯 — أنت قائد حقيقي الآن!");
}
let tutT = 0;
let slowT = 0; // مؤقت الفحوص البطيئة (استنفار/تحويل البيض)
function tutTick(dt) {
  const tu = game.tutorial;
  if (!tu || !tu.active || tu.done) return;
  tutT -= dt;
  if (tutT > 0) return;
  tutT = 0.5;
  const list = tutList();
  const st = list[tu.step];
  if (!st) { tutDone(); return; }
  let ok = false;
  try { ok = !!st.check(); } catch { ok = false; }
  if (ok) {
    if (st.reward) { game.store += st.reward; toast(`🎓 أحسنت! +${st.reward}🍯`); }
    sfx.deposit();
    tu.step++;
    if (tu.step >= tutList().length) tutDone();
    else { saveGame(); tutRender(); }
    updateHUD();
  }
}
// ---------- 👸 جوع الملكة: إهمال طويل = موت = هزيمة ----------
let starveWarned = 0;
function queenStarveTick(dt) {
  if (!game.nest || game._defeatShown) return;
  const N = game.nest;
  if (N.dormant) {
    N.starveT = (N.starveT || 0) + dt;
    if (N.starveT > 30 && starveWarned < 1) {
      starveWarned = 1;
      centerMsg("⚠️ الملكة تحتضر جوعاً! خزّن طعاماً بسرعة!", 2500);
      toast("👑 الملكة تموت... أطعم المستعمرة!");
      sfx.alarm();
    } else if (N.starveT > 60 && starveWarned < 2) {
      starveWarned = 2;
      centerMsg("🚨 الملكة تلفظ أنفاسها الأخيرة! آخر فرصة!", 2500);
      sfx.alarm();
    } else if (N.starveT > 90) {
      starveWarned = 0;
      defeat();
    }
  } else {
    N.starveT = 0;
    starveWarned = 0;
  }
}
// ---------- ⚙️ الجودة التلقائية: خفض عند التقطيع، واستعادة عند التحسن ----------
let fpsAcc = 0, fpsN = 0, fpsT = 0, fpsGoodStreak = 0, autoLow = false;
function fpsTick(dt) {
  if (!game.started || game.paused) return;
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT < 2.5) return;
  const avg = fpsAcc / Math.max(1, fpsN);
  const fps = avg > 0 ? 1 / avg : 60;
  fpsAcc = 0; fpsN = 0; fpsT = 0;
  if (game.settings.autoQ === false) { autoLow = false; fpsGoodStreak = 0; return; }
  if (game.settings.quality !== "low" && fps < 45) {
    game.settings.quality = "low";
    autoLow = true; fpsGoodStreak = 0;
    try { applyQuality(true); } catch {}
    renderSettings();
    toast("⚙️ خُفّضت الجودة تلقائياً للحفاظ على السلاسة");
  } else if (autoLow && game.settings.quality === "low" && fps > 57) {
    fpsGoodStreak++;
    if (fpsGoodStreak >= 4) {
      game.settings.quality = "high";
      autoLow = false; fpsGoodStreak = 0;
      try { applyQuality(true); } catch {}
      renderSettings();
      toast("✨ عادت الجودة العالية — جهازك يتحمل!");
    }
  } else if (fps <= 57) {
    fpsGoodStreak = 0;
  }
}
// ---------- تخصيص الواجهة: الخريطة والإشعارات وأماكن القوائم ----------
function uiPrefs() {
  const u = (game.settings && game.settings.ui) || {};
  const defSize = (typeof innerWidth !== "undefined" && innerWidth <= 640) ? 96 : 132;
  const size = Math.round(Number(u.mapSize) || 0) || defSize;
  return {
    mapSize: Math.min(200, Math.max(72, size)),
    mapHidden: !!u.mapHidden,
    mapCorner: u.mapCorner === "left" ? "left" : "right",
    toastPos: u.toastPos === "mid" || u.toastPos === "bot" ? u.toastPos : "top",
    cmdSide: u.cmdSide === "right" ? "right" : "left",
    menuSide: u.menuSide === "left" ? "left" : "right",
    panelsTop: !!u.panelsTop,
    layout: (u.layout && typeof u.layout === "object") ? u.layout : {},
  };
}
function setUi(patch) {
  game.settings.ui = Object.assign(uiPrefs(), patch);
  applyUiPrefs();
  saveGame();
}
function applyUiPrefs() {
  const ui = uiPrefs();
  const root = els.gameRoot || document.getElementById("gameRoot");
  if (root) {
    root.classList.toggle("toastsMid", ui.toastPos === "mid");
    root.classList.toggle("toastsBot", ui.toastPos === "bot");
    root.classList.toggle("cmdLeft", ui.cmdSide === "left");
    root.classList.toggle("menuLeft", ui.menuSide === "left");
    root.classList.toggle("panelsTop", ui.panelsTop);
    root.classList.toggle("mapRight", ui.mapCorner === "right");
  }
  if (els.mapWrap) { els.mapWrap.style.width = ui.mapSize + "px"; els.mapWrap.style.height = ui.mapSize + "px"; }
  if (els.mapStack) {
    const wrap = els.mapWrap;
    const mTop = (wrap && wrap.offsetTop) || 96;
    const wrapH = (wrap && !wrap.hidden && wrap.offsetHeight) || ui.mapSize;
    els.mapStack.style.top = (mTop + wrapH + 34) + "px";
  }
  refreshMapVis();
  renderUiLabels();
}
// الخريطة ظاهرة فقط على السطح بعد بدء اللعب ما لم يُخفها اللاعب
function refreshMapVis() {
  const ui = uiPrefs();
  const surface = game.started && !game.underground;
  if (els.mapWrap) els.mapWrap.hidden = !surface || ui.mapHidden;
  if (els.mapOpenBtn) els.mapOpenBtn.hidden = !(surface && ui.mapHidden) || isUh("mapOpenBtn");
  if (els.mapStack) {
    if (!surface) els.mapStack.hidden = true;
    else {
      // إخفاء الحاوية لو فرغت (الزرّان في وضع حر) حتى لا تبقى علبة فارغة
      try {
        const hasKid = [...els.mapStack.children].some((ch) => ch && ch.hidden === false);
        els.mapStack.hidden = !hasKid;
      } catch { els.mapStack.hidden = false; }
    }
  }
  // عمود الأزرار تحت الخريطة مباشرة — يُقاس من الحجم المعروض فعلياً (قد تُصغّره CSS في الشاشات القصيرة)
  try {
    if (els.mapStack && els.mapWrap && !els.mapWrap.hidden && !els.mapStack.hidden) {
      els.mapStack.style.top = (els.mapWrap.offsetTop + els.mapWrap.offsetHeight + 34) + "px";
    }
  } catch {}
}
// ---------- 🌐 اللغات (9 لغات — تُطبق على كل الواجهة) ----------
function curLang() {
  const s = game.settings.lang;
  if (s && s !== "auto") return s;
  return detectLang();
}
function t(key, params) {
  let s = null;
  try { s = pick(curLang(), key); } catch {}
  if (s == null) s = key;
  if (params) { for (const k in params) { try { s = s.split("{" + k + "}").join(params[k]); } catch {} } }
  return s;
}
function setLang(code) {
  game.settings.lang = code;
  saveGame(); applyLang(); renderSettings(); renderStart();
  try { sfx.click(); toast(`🌐 ${langName(code)}`); } catch {}
}
function cycleLang() {
  const cur = curLang();
  const i = LANG_CODES.indexOf(cur);
  setLang(LANG_CODES[(i + 1) % LANG_CODES.length]);
}
function smallBtn(id, icon, label) {
  try { const el = els[id]; if (el) el.innerHTML = `${icon}<small>${label}</small>`; } catch {}
}
function applyLang() {
  try { document.documentElement.lang = curLang(); } catch {}
  const T = (id, key) => { try { if (els[id]) els[id].textContent = t(key); } catch {} };
  const H = (id, key) => { try { if (els[id]) els[id].innerHTML = t(key); } catch {} };
  T("startHeading", "app_name"); T("startSub", "tagline"); T("diffLabel", "diff_label");
  T("diffBeginnerBtn", "diff_beginner"); T("diffEasyBtn", "diff_easy");
  T("diffNormalBtn", "diff_normal"); T("diffHardBtn", "diff_hard");
  T("startHelpBtn", "start_help"); T("startNewBtn", "start_new"); T("startWipeBtn", "start_new");
  T("pauseHeading", "pause_title"); T("resumeBtn", "resume"); T("settingsBtn", "settings");
  T("saveNowBtn", "save_now"); T("homeBtn", "home"); T("settingsHeading", "settings_title");
  T("setUiLayoutBtn", "ui_layout"); T("setHelpBtn", "help_menu"); T("setWipeBtn", "wipe_save");
  T("setAboutBtn", "about"); T("setPrivacyBtn", "privacy"); T("settingsCloseBtn", "close");
  T("aboutHeading", "about_title"); H("aboutTxt", "about_txt"); H("aboutDesigner", "about_designer");
  T("aboutCloseBtn", "close"); T("privacyHeading", "privacy_title");
  T("privacyTxt", "privacy_txt"); T("privacyCloseBtn", "close");
  T("helpHeading", "help_title"); T("helpCloseBtn", "got_it"); T("mapLabel", "map_label");
  T("worldBtn", "world"); T("shopBtn", "shop"); T("trainBtn", "train"); T("buildBtn", "build");
  T("hatchLbl", "hatch_label"); T("upgradeLbl", "carry_label");
  T("worldTitle", "world_title"); T("wtabRegions", "tab_regions"); T("wtabQuests", "tab_quests");
  T("wtabShop", "tab_shop"); T("worldCloseBtn", "close");
  T("cmdSelWorkBtn", "cmd_workers"); T("cmdSelSoldBtn", "cmd_soldiers"); T("cmdInjBtn", "cmd_injured");
  T("cmdHomeBtn", "cmd_home"); T("cmdHoldBtn", "cmd_hold");
  T("underBackBtn", "under_back"); T("underHint", "under_hint");
  T("casteLbl", "caste_label"); T("casteWorkerBtn", "caste_worker");
  T("casteSoldierBtn", "caste_soldier"); T("casteScoutBtn", "caste_scout");
  T("geneOpenBtn", "gene_open"); T("trainOpenBtn", "train_open"); T("roomCloseBtn", "close");
  T("beastTitle", "beast_title"); T("beastCloseBtn", "close");
  T("geneTitle", "gene_title"); T("geneTabSick", "gene_sick"); T("geneTabHeal", "gene_heal");
  T("geneTabEggs", "gene_eggs"); T("geneTabGene", "gene_gene"); T("geneTabUp", "gene_up");
  T("geneCloseBtn", "close"); T("trainTitle", "train_title"); T("trainTabConv", "train_conv");
  T("trainTabSold", "train_sold"); T("trainTabYard", "train_yard"); T("trainTabUp", "train_up");
  T("trainCloseBtn", "close"); T("tutSkipBtn", "tut_skip");
  smallBtn("armyBtn", "⚔️", t("army")); smallBtn("nestBtn", "🏠", t("nest"));
  smallBtn("questBtn", "📜", t("quests")); smallBtn("nestExitBtn", "⬆️", t("surface_word"));
  smallBtn("nestBattleBtn", "⚔️", t("battle")); smallBtn("nestWorldBtn", "🌍", t("nest_world"));
  smallBtn("nestShopBtn", "🏪", t("nest_shop")); smallBtn("nestBuildBtn", "🪖", t("nest_build"));
  smallBtn("nestUpBtn", "⬆️", t("nest_upgrade")); smallBtn("nestTidyBtn", "🧹", t("nest_tidy"));
  smallBtn("nestArmyBtn", "🐜", t("nest_army")); smallBtn("nestGeneBtn", "🧬", t("nest_genes"));
  try {
    if (els.nestQuestBtn) els.nestQuestBtn.innerHTML = `📋<span id="nestQuestDot">!</span><small>${t("quests")}</small>`;
    els.nestQuestDot = document.getElementById("nestQuestDot");
  } catch {}
  try {
    if (els.nestBackFab) els.nestBackFab.innerHTML = `<span id="nestBackArr">⬆️</span><span>🐜</span><small>${t("nest_back")}</small>`;
  } catch {}
  updateMilitaryLabels();
}
function updateMilitaryLabels() {
  // يُعاد بناؤها مع كل لغة (التكلفة تُقرأ حية) — والـcost spans تُعاد بلا كسر لأن updateHUD يملؤها بعدها
  try {
    if (els.hatchBtn) els.hatchBtn.innerHTML = `🐜 ${t("hatch_label")} (<span id="hatchCostEl">${hatchCost()}</span> 🍯)`;
    if (els.upgradeBtn) els.upgradeBtn.innerHTML = `🎒 ${t("carry_label")} (<span id="upgradeCostEl">${upgradeCost()}</span> 🍯)`;
    els.hatchCostEl = document.getElementById("hatchCostEl");
    els.upgradeCostEl = document.getElementById("upgradeCostEl");
  } catch {}
}
function renderUiLabels() {
  // (أُزيلت أزرار الخريطة/الشريط من الإعدادات — تُدار من نفسها)
}
function renderSettings() {
  els.setSoundBtn.textContent = game.settings.sound === false ? t("sound_off") : t("sound_on");
  els.setQualityBtn.textContent = game.settings.autoQ !== false ? t("quality_auto") : game.settings.quality === "low" ? t("quality_low") : t("quality_high");
  els.setVibrateBtn.textContent = game.settings.vibrate === false ? t("vib_off") : t("vib_on");
  if (els.setDiffBtn) els.setDiffBtn.textContent = `${t("difficulty")}: ${t("diff_" + game.difficulty)}`;
  if (els.setLangBtn) { try { els.setLangBtn.value = curLang(); } catch {} }
  if (els.setUpdateBtn) els.setUpdateBtn.textContent = pendingUpdateName ? ("⬇️ " + pendingUpdateName) : t("upd_btn", { v: GAME_VERSION_NAME });
  renderUiLabels();
}
function applyQuality(silent) {
  try {
    const lowQ = game.settings.quality === "low";
    // lowfx: إطفاء بلور الواجهة على الأجهزة الضعيفة (يسبب تهنيج وتشوه ألوان فوق WebGL)
    try { document.getElementById("gameRoot").classList.toggle("lowfx", !!lowQ); } catch {}
    renderer.setPixelRatio(lowQ ? 1 : Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !lowQ;
    sunLight.castShadow = !lowQ;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    onResize();
  } catch {}
  saveGame();
  if (!silent) toast(game.settings.quality === "low" ? "🎨 جودة منخفضة — أداء أسرع" : "🎨 جودة عالية");
}

// ---------- 🖌️ إعدادات الأزرار والشاشة: مكان/حجم/إخفاء كل زر ----------
// كل زر قابل للتخصيص مسجّل هنا: نطاقه (سطح/عش)، الأماكن المسموحة، ومكانه الافتراضي
const UI_WIDGETS = [
  { id: "armyBtn", name: "⚔️ زر الجيش", scope: "surface", docks: ["mapstack", "default"], defDock: "mapstack", defOrd: 0 },
  { id: "nestBtn", name: "🏠 عش (دخول/خروج)", scope: "surface", docks: ["mapstack", "default"], defDock: "mapstack", defOrd: 1 },
  { id: "gearBtn", name: "⚙️ زر الضبط (الترس)", scope: "surface", docks: ["default"], defDock: "default", hideable: false, defOrd: 3 },
  { id: "menuBtn", name: "☰ زر القائمة", scope: "surface", docks: ["default", "mapstack"], defDock: "default", state: true, hideable: false },
  { id: "hatchBtn", name: "🐜 فقس عامل", scope: "surface", docks: ["menu", "mapstack", "cmdbar"], defDock: "menu", defOrd: 4 },
  { id: "upgradeBtn", name: "🎒 ترقية الحمل", scope: "surface", docks: ["menu", "mapstack", "cmdbar"], defDock: "menu", defOrd: 3 },
  { id: "buildBtn", name: "🏠 بناء", scope: "surface", docks: ["menu", "mapstack", "cmdbar"], defDock: "menu", defOrd: 6 },
  { id: "shopBtn", name: "🛒 تطوير", scope: "surface", docks: ["menu", "mapstack", "cmdbar"], defDock: "menu", defOrd: 2 },
  { id: "questBtn", name: "📜 مهمات", scope: "surface", docks: ["menu", "mapstack", "cmdbar"], defDock: "mapstack", defOrd: 2 },
  { id: "beastBtn", name: "🐾 مخلوقات", scope: "surface", docks: ["menu", "mapstack", "cmdbar"], defDock: "menu", defOrd: 1 },
  { id: "trainBtn", name: "🎖️ تدريب", scope: "surface", docks: ["menu", "mapstack", "cmdbar"], defDock: "menu", defOrd: 5 },
  { id: "worldBtn", name: "🌍 العالم", scope: "surface", docks: ["menu", "mapstack", "cmdbar"], defDock: "menu", defOrd: 0 },
  { id: "mapOpenBtn", name: "🗺️ زر الخريطة", scope: "surface", docks: ["default", "mapstack", "menu"], defDock: "default", state: true },
  { id: "zoomCtn", name: "🔍 زوم السطح", scope: "surface", docks: ["default", "mapstack"], defDock: "default", state: true },
  { id: "helpBtn", name: "؟ مساعدة", scope: "surface", docks: ["default", "mapstack", "menu"], defDock: "default", state: true },
  { id: "pauseBtn", name: "⏸️ إيقاف مؤقت", scope: "surface", docks: ["default", "mapstack"], defDock: "default", state: true, hideable: false },
  { id: "cmdBar", name: "🎯 شريط الجيش (الكل معاً)", scope: "surface", docks: ["default"], defDock: "default", hideable: false },
  { id: "cmdSelWorkBtn", name: "🐜 عمال", scope: "surface", docks: ["cmdbar", "menu", "mapstack"], defDock: "cmdbar" },
  { id: "cmdSelSoldBtn", name: "⚔️ جنود", scope: "surface", docks: ["cmdbar", "menu", "mapstack"], defDock: "cmdbar" },
  { id: "cmdInjBtn", name: "🤕 مصابون", scope: "surface", docks: ["cmdbar", "menu", "mapstack"], defDock: "cmdbar" },
  { id: "cmdHomeBtn", name: "🏠 منزل", scope: "surface", docks: ["cmdbar", "menu", "mapstack"], defDock: "cmdbar" },
  { id: "cmdHoldBtn", name: "📍 ثبات", scope: "surface", docks: ["cmdbar", "menu", "mapstack"], defDock: "cmdbar" },
  { id: "cmdClearBtn", name: "✖ خروج التحديد", scope: "surface", docks: ["cmdbar", "menu", "mapstack"], defDock: "cmdbar" },
  { id: "nestExitBtn", name: "⬆️ سطح (خروج العش)", scope: "nest", docks: ["default", "nestside", "nestbottom"], defDock: "default" },
  { id: "nestBackFab", name: "🐜 زر العودة (العش)", scope: "nest", docks: ["default", "nestside", "nestbottom"], defDock: "default" },
  { id: "nestSetBtn", name: "⚙️ إعدادات (العش)", scope: "nest", docks: ["default", "nestside", "nestbottom"], defDock: "default", hideable: false },
  { id: "nestQuestBtn", name: "📋 المهام (العش)", scope: "nest", docks: ["default", "nestside", "nestbottom"], defDock: "default" },
  { id: "nestBattleBtn", name: "⚔️ معركة (العش)", scope: "nest", docks: ["nestside", "nestbottom", "default"], defDock: "default" },
  { id: "nestWorldBtn", name: "🌍 العالم (العش)", scope: "nest", docks: ["nestside", "nestbottom", "default"], defDock: "default" },
  { id: "nestShopBtn", name: "🏪 المتجر (العش)", scope: "nest", docks: ["nestside", "nestbottom", "default"], defDock: "default" },
  { id: "nestBuildBtn", name: "🪖 بناء (العش)", scope: "nest", docks: ["nestside", "nestbottom", "default"], defDock: "default" },
  { id: "nestUpBtn", name: "⬆️ ترقية (العش)", scope: "nest", docks: ["nestside", "nestbottom", "default"], defDock: "default" },
  { id: "nestTidyBtn", name: "🧹 ترتيب (العش)", scope: "nest", docks: ["nestside", "nestbottom", "default"], defDock: "default" },
  { id: "nestArmyBtn", name: "🐜 جيش (العش)", scope: "nest", docks: ["nestside", "nestbottom", "default"], defDock: "default" },
  { id: "nestGeneBtn", name: "🧬 جينات (العش)", scope: "nest", docks: ["nestside", "nestbottom", "default"], defDock: "default" },
  { id: "nestZoom", name: "🔍 زوم العش", scope: "nest", docks: ["default", "nestside", "nestbottom"], defDock: "default" },
];
UI_WIDGETS.forEach((w, i) => { if (w.defOrd === undefined) w.defOrd = i; if (w.hideable === undefined) w.hideable = true; });
UI_WIDGETS.forEach((w) => { if (!w.docks.includes("free")) w.docks.push("free"); });
const DOCK_LABEL = { default: "📌 مكانه الأصلي", mapstack: "🗺️ تحت الخريطة", menu: "☰ داخل القائمة", cmdbar: "🎯 شريط الجيش", nestside: "↘️ الشريط الجانبي", nestbottom: "⬇️ الشريط السفلي", free: "✋ حر (تحريك باللمس)" };
// أماكن الإرساء: الحاوية الفعلية لكل اسم مكان
function dockParent(dock) {
  if (dock === "menu") return els.actionCtn;
  if (dock === "cmdbar") return els.cmdBar;
  if (dock === "mapstack") return els.mapStack;
  if (dock === "nestside") return els.nestSide;
  if (dock === "nestbottom") return els.nestBottom;
  return null;
}
function layoutStore() {
  const u = (game.settings && game.settings.ui) || {};
  return (u.layout && typeof u.layout === "object") ? u.layout : {};
}
function layoutCfg(id) {
  const w = UI_WIDGETS.find((x) => x.id === id) || {};
  const s = layoutStore()[id] || {};
  // الأزرار الأساسية (الترس/الإيقاف/القائمة/إعدادات العش) لا تُخفى أبداً —
  // أي حفظ قديم فيه hide:true يُتجاهل هنا فيُستعاد الزر فوراً
  const hide = (w.hideable === false) ? false : !!s.hide;
  return {
    dock: (s.dock && (w.docks || []).includes(s.dock)) ? s.dock : (w.defDock || "default"),
    size: Math.min(200, Math.max(50, Math.round(Number(s.size) || 100))),
    hide,
    ord: (typeof s.ord === "number") ? s.ord : (w.defOrd || 0),
    x: (typeof s.x === "number") ? Math.min(1, Math.max(0, s.x)) : null,
    y: (typeof s.y === "number") ? Math.min(1, Math.max(0, s.y)) : null,
  };
}
function isUh(id) { return layoutCfg(id).hide; }
function setLayout(id, patch) {
  const cur = layoutStore();
  cur[id] = Object.assign({}, layoutCfg(id), patch);
  setUi({ layout: cur });
  applyUILayout();
}
// حماية من حبس اللاعب: زرّا الإعدادات والخروج لا يُخفيان معاً
function canHideWidget(id, hide) {
  if (!hide) return true;
  const w = UI_WIDGETS.find((x) => x.id === id);
  if (w && w.hideable === false) return "🔒 هذا الزر أساسي ولا يمكن إخفاؤه حتى لا تفقد الوصول للإعدادات";
  if (id === "pauseBtn" && isUh("gearBtn")) return "⚙️ الترس مخفي بالفعل — أظهره أولاً حتى لا تفقد الوصول للإعدادات";
  if (id === "gearBtn" && isUh("pauseBtn")) return "⏸️ زر الإيقاف مخفي — أظهره أولاً حتى لا تفقد الوصول للإعدادات";
  if (id === "nestExitBtn" && isUh("nestBackFab")) return "🐜 زر العودة مخفي — أظهره أولاً حتى لا تُحبس في العش";
  if (id === "nestBackFab" && isUh("nestExitBtn")) return "⬆️ زر السطح مخفي — أظهره أولاً حتى لا تُحبس في العش";
  return true;
}
// تطبيق التخصيص: النقل للحاويات + الترتيب + الحجم + الإخفاء
function applyUILayout() {
  const byParent = new Map();
  for (const w of UI_WIDGETS) {
    const el = els[w.id];
    if (!el) continue;
    const c = layoutCfg(w.id);
    try { el.dataset.wid = w.id; } catch {}
    if (w.id === "cmdBar") {
      // 🎯 الشريط وحدة واحدة: الحجم/التحريك على الحاوية — ولا نمسّ hidden أبداً (اللعبة تدير ظهوره)
      try {
        el.style.zoom = (c.size && c.size !== 100) ? String(c.size / 100) : "";
        if (c.dock === "free") {
          const parent = els.gameRoot || el.parentElement;
          try { if (el.parentElement !== parent) parent.appendChild(el); } catch {}
          const fx = (c.x !== null && c.x !== undefined) ? c.x : 0.5;
          const fy = (c.y !== null && c.y !== undefined) ? c.y : 0.5;
          el.style.position = "fixed";
          el.style.left = (fx * 100) + "%";
          el.style.top = (fy * 100) + "%";
          el.style.right = "auto";
          el.style.bottom = "auto";
          el.style.margin = "0";
        } else {
          el.style.position = ""; el.style.left = ""; el.style.top = ""; el.style.right = ""; el.style.bottom = ""; el.style.margin = "";
        }
      } catch {}
      continue;
    }
    if (c.dock === "free") {
      // وضع حر: تثبيت بإحداثيات نسبية من الشاشة (يتحمل التدوير وتغير الحجم)
      let parent = els.gameRoot || el.parentElement;
      try { if (el.parentElement !== parent) parent.appendChild(el); } catch {}
      const fx = (c.x !== null && c.x !== undefined) ? c.x : 0.5;
      const fy = (c.y !== null && c.y !== undefined) ? c.y : 0.5;
      try {
        el.style.position = "fixed";
        el.style.left = (fx * 100) + "%";
        el.style.top = (fy * 100) + "%";
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.margin = "0";
        el.style.zoom = (c.size && c.size !== 100) ? String(c.size / 100) : "";
      } catch {}
      let hide = c.hide;
      if (w.scope === "nest" && !game.underground) hide = true;
      if (w.scope === "surface" && game.underground) hide = true;
      try { el.hidden = hide; } catch {}
      continue;
    }
    // الأوضاع المثبتة: تنظيف أي تثبيت حر سابق
    try { el.style.position = ""; el.style.left = ""; el.style.top = ""; el.style.right = ""; el.style.bottom = ""; el.style.margin = ""; } catch {}
    let parent = (c.dock && c.dock !== "default") ? dockParent(c.dock) : null;
    if (!parent) parent = w.origParent || el.parentElement;
    if (!parent) continue;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push({ el, ord: c.ord });
    try { el.style.zoom = (c.size && c.size !== 100) ? String(c.size / 100) : ""; } catch {}
    if (!w.state && ("hidden" in el)) {
      // أزرار العش المنفردة لا تظهر على السطح أبداً (والعكس) — حاوياتها تُدار من enterNest/exitNest
      let hide = c.hide;
      if (w.scope === "nest" && !game.underground) hide = true;
      if (w.scope === "surface" && game.underground) hide = true;
      el.hidden = hide;
    }
  }
  for (const [parent, items] of byParent) {
    items.sort((a, b) => a.ord - b.ord);
    for (const it of items) { try { parent.appendChild(it.el); } catch {} }
  }
  // عدّاد المحدد يبقى أول شريط الجيش دائماً
  if (els.selCount && els.cmdBar) { try { els.cmdBar.prepend(els.selCount); } catch {} }
  refreshMapVis();
  applySurfVis();
  // زر المساعدة ؟ ينزل تحت عمود الخريطة/الأزرار حتى لا يتداخل معه (موضعه القديم كان ثابتاً)
  try {
    const hb = els.helpBtn, ms = els.mapStack;
    if (hb && ms && layoutCfg("helpBtn").dock === "default" && !ms.hidden) {
      hb.style.top = Math.max(0, Math.round(ms.offsetTop + ms.offsetHeight + 10)) + "px";
    } else if (hb && layoutCfg("helpBtn").dock === "default") {
      hb.style.top = "";
    }
  } catch {}
}
// الأزرار ذات الظهور المشروط (تُظهرها اللعبة) — نُعيد إخفاء ما أخفاه اللاعب فقط
function applySurfVis() {
  const surface = game.started && !game.underground;
  for (const w of UI_WIDGETS) {
    if (!w.state || w.id === "mapOpenBtn") continue; // mapOpenBtn تُعالجه refreshMapVis
    const el = els[w.id];
    if (!el) continue;
    if (isUh(w.id)) el.hidden = true;
    else if (surface) el.hidden = false;
  }
}
// ---------- ✋ وضع التحرير باللمس: سحب للتحريك + قرص للتكبير + نقرة للخيارات ----------
let editMode = false;
let editSelId = null;
const editPtrs = new Map();
let editDrag = null;
let editPinch = null;
function isEditMode() { return editMode; }
function setEditMode(on, silent) {
  editMode = !!on;
  editSelId = null;
  editPtrs.clear(); editDrag = null; editPinch = null;
  try {
    const root = els.gameRoot || document.getElementById("gameRoot");
    if (root) root.classList.toggle("editing", editMode);
    if (els.editBanner) els.editBanner.hidden = !editMode;
    if (els.editTool) els.editTool.hidden = true;
    // خروج نظيف: إغلاق الإعدادات أيضاً حتى تعود للعبة مباشرة بزر ✓ واحد
    if (editMode) { if (els.settingsPanel) els.settingsPanel.hidden = true; }
    else if (els.settingsPanel && !silent) els.settingsPanel.hidden = true;
    if (editMode && els.editHiddenList) els.editHiddenList.hidden = true;
  } catch {}
  if (editMode) {
    renderEditHidden();
    toast("✋ اسحب أي زر لتحريكه • قرص بإصبعين لتكبيره وتصغيره • انقر زراً لخياراته • افتح قائمة ☰ أولاً لتسقط الأزرار فيها");
  }
  else { try { applyUILayout(); saveGame(); } catch {} }
}
// نطاق الزر (سطح/عش) لاختبار الإسقاط الصحيح
function widgetScope(wid) {
  const w = UI_WIDGETS.find((x) => x.id === wid);
  return (w && w.scope) || "surface";
}
// حاوية الإرساء تحت نقطة الإسقاط (بالنطاق الصحيح فقط، والحاوية المرئية فقط)
function dockAtPoint(x, y, scope) {
  const cands = scope === "nest"
    ? [["nestside", els.nestSide], ["nestbottom", els.nestBottom]]
    : [["menu", els.actionCtn], ["cmdbar", els.cmdBar], ["mapstack", els.mapStack]];
  for (const [dock, cont] of cands) {
    if (!cont || cont.hidden) continue;
    try {
      const r = cont.getBoundingClientRect();
      if (x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8) return dock;
    } catch {}
  }
  return null;
}
function maxOrdInDock(scope, dock) {
  let m = -1;
  for (const w of UI_WIDGETS) {
    if (w.scope === scope && layoutCfg(w.id).dock === dock) m = Math.max(m, layoutCfg(w.id).ord);
  }
  return m;
}
// قائمة الأزرار المخفية (إظهارها باللمس — لا سلايدرات)
function renderEditHidden() {
  const list = els.editHiddenList, cnt = els.editHiddenCount;
  if (!list) return;
  list.innerHTML = "";
  const hidden = UI_WIDGETS.filter((w) => layoutCfg(w.id).hide && els[w.id]);
  if (cnt) cnt.textContent = String(hidden.length);
  if (!hidden.length) {
    const d = document.createElement("div");
    d.className = "ehRow";
    const s = document.createElement("span");
    s.textContent = "لا أزرار مخفية — كل شيء ظاهر";
    d.appendChild(s);
    list.appendChild(d);
    return;
  }
  for (const w of hidden) {
    const row = document.createElement("div");
    row.className = "ehRow";
    const nm = document.createElement("span");
    nm.textContent = w.name;
    const b = document.createElement("button");
    b.textContent = "إظهار";
    b.onclick = () => {
      sfx.click();
      setLayout(w.id, { hide: false });
      renderEditHidden();
      toast(`👁 ${w.name} ظاهر الآن`);
    };
    row.appendChild(nm); row.appendChild(b);
    list.appendChild(row);
  }
}
// تموضع صندوق أدوات الزر المحدد بجانبه
function editToolPlace(wid) {
  const tool = els.editTool;
  const el = wid && els[wid];
  if (!tool || !el) { if (tool) tool.hidden = true; return; }
  tool.hidden = false;
  try {
    const r = el.getBoundingClientRect();
    const tw = 252, th = 60;
    const lx = Math.min(Math.max(6, r.left + r.width / 2 - tw / 2), Math.max(6, innerWidth - tw - 6));
    let ty = r.top - th - 8;
    if (ty < 6) ty = Math.min(Math.max(6, innerHeight - th - 6), r.bottom + 8);
    tool.style.left = lx + "px";
    tool.style.top = Math.max(6, ty) + "px";
  } catch {}
}
function editSelect(wid) {
  editSelId = wid;
  if (!wid || !els[wid]) { if (els.editTool) els.editTool.hidden = true; return; }
  try {
    els.editSizeVal.textContent = layoutCfg(wid).size + "%";
    els.editHideBtn.textContent = layoutCfg(wid).hide ? "🚫" : "👁";
  } catch {}
  editToolPlace(wid);
}
function editNudgeSize(d) {
  if (!editSelId || !els[editSelId]) return;
  sfx.click();
  const v = Math.min(200, Math.max(50, layoutCfg(editSelId).size + d));
  setLayout(editSelId, { size: v });
  try { els.editSizeVal.textContent = v + "%"; } catch {}
  editToolPlace(editSelId);
}
// إيماءات التحرير: تُربط مرة واحدة مع بقية الإدخال
function wireEditGestures() {
  if (wireEditGestures._done) return;
  wireEditGestures._done = true;
  // مانع النقرات: في وضع التحرير لا يعمل أي زر بوظيفته الأصلية (عدا لوحات التحرير)
  document.addEventListener("click", (e) => {
    if (!editMode) return;
    if (e.target && e.target.closest && e.target.closest("#uiLayoutPanel,#editBanner,#editTool")) return;
    try { e.preventDefault(); e.stopPropagation(); } catch {}
  }, true);
  document.addEventListener("pointerdown", (e) => {
    if (!editMode) return;
    if (e.target && e.target.closest && e.target.closest("#uiLayoutPanel,#editBanner,#editTool")) return;
    const wEl0 = e.target && e.target.closest ? e.target.closest("[data-wid]") : null;
    if (!wEl0 || !wEl0.dataset || !wEl0.dataset.wid || els[wEl0.dataset.wid] !== wEl0) {
      editSelect(null); // نقرة على فراغ: إلغاء التحديد
      return;
    }
    // 🎯 شريط الجيش وحدة واحدة: أي لمسة على زر مرسى فيه تُمسك الشريط كله (لا تتفكك)
    let wEl = wEl0, wid = wEl0.dataset.wid;
    if (wid !== "cmdBar" && els.cmdBar && wEl !== els.cmdBar) {
      try {
        if (els.cmdBar.contains(wEl) && layoutCfg(wid).dock === "cmdbar") { wEl = els.cmdBar; wid = "cmdBar"; }
      } catch {}
    }
    try { e.preventDefault(); } catch {}
    editPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (editPtrs.size === 1) {
      const r = wEl.getBoundingClientRect();
      editDrag = { wid, el: wEl, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, sx: e.clientX, sy: e.clientY, pinching: false };
      editSelect(wid);
    } else if (editPtrs.size === 2 && editDrag) {
      // الإصبع الثاني (حتى لو نزل خارج الزر): بدء قرص تكبير
      const [a, b] = [...editPtrs.values()];
      editPinch = { wid: editDrag.wid, el: editDrag.el, d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), size0: layoutCfg(editDrag.wid).size, v: 0 };
      editDrag.pinching = true;
    }
  }, { passive: false });
  document.addEventListener("pointermove", (e) => {
    if (!editMode || !editPtrs.has(e.pointerId)) return;
    editPtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (editPinch && editPtrs.size >= 2) {
      const [a, b] = [...editPtrs.values()];
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const v = Math.min(200, Math.max(50, Math.round(editPinch.size0 * d / editPinch.d0)));
      try { editPinch.el.style.zoom = v === 100 ? "" : String(v / 100); } catch {}
      try { els.editSizeVal.textContent = v + "%"; } catch {}
      editPinch.v = v;
      return;
    }
    if (editDrag && editDrag.el && !editDrag.pinching) {
      const ids = [...editPtrs.keys()];
      if (e.pointerId !== ids[0]) return;
      if (Math.hypot(e.clientX - editDrag.sx, e.clientY - editDrag.sy) > 10) editDrag.moved = true;
      if (!editDrag.moved) return;
      const fx = Math.min(1, Math.max(0, (e.clientX - editDrag.dx) / Math.max(1, innerWidth)));
      const fy = Math.min(1, Math.max(0, (e.clientY - editDrag.dy) / Math.max(1, innerHeight)));
      const el = editDrag.el;
      const c0 = layoutCfg(editDrag.wid);
      if (c0.dock !== "free") {
        // أول حركة: انقله للوضع الحر من مكانه الحالي بلا قفز
        const cur = layoutStore();
        cur[editDrag.wid] = Object.assign({}, c0, { dock: "free" });
        game.settings.ui = Object.assign(uiPrefs(), { layout: cur });
        try {
          const parent = els.gameRoot || el.parentElement;
          if (el.parentElement !== parent) parent.appendChild(el);
          el.style.position = "fixed"; el.style.right = "auto"; el.style.bottom = "auto"; el.style.margin = "0";
        } catch {}
      }
      try { el.style.left = (fx * 100) + "%"; el.style.top = (fy * 100) + "%"; } catch {}
      editDrag.fx = fx; editDrag.fy = fy;
      editToolPlace(editDrag.wid);
    }
  }, { passive: true });
  const endEditPtr = (e) => {
    if (!editMode) { editPtrs.clear(); editDrag = null; editPinch = null; return; }
    editPtrs.delete(e.pointerId);
    if (editPinch && editPtrs.size < 2) {
      if (editPinch.v) {
        const cur = layoutStore();
        cur[editPinch.wid] = Object.assign({}, layoutCfg(editPinch.wid), { size: editPinch.v });
        game.settings.ui = Object.assign(uiPrefs(), { layout: cur });
        saveGame();
        try { els.editSizeVal.textContent = editPinch.v + "%"; } catch {}
      }
      editPinch = null;
      if (editDrag) editDrag.pinching = false;
    }
    if (editDrag && editPtrs.size === 0) {
      if (editDrag.moved && editDrag.fx !== undefined) {
        const cur = layoutStore();
        cur[editDrag.wid] = Object.assign({}, layoutCfg(editDrag.wid), { dock: "free", x: editDrag.fx, y: editDrag.fy });
        game.settings.ui = Object.assign(uiPrefs(), { layout: cur });
        saveGame();
      }
      editDrag = null;
    }
  };
  document.addEventListener("pointerup", endEditPtr);
  document.addEventListener("pointercancel", endEditPtr);
}

// استعادة أسرّة العلاج بعد التحميل: إعادة إنشاء شاغليها مخفيين
function restoreClinicBeds() {
  const cl = geneCenter();
  for (const b of cl.beds) {
    if (b.kind === "ally") continue;
    let u = null;
    if (b.kind === "soldier") u = spawnSoldier(b.gene, (b.mods && b.mods[0]) || null);
    else if (b.kind === "scout") u = spawnScout(b.gene, (b.mods && b.mods[0]) || null);
    else u = spawnWorker(b.gene, (b.mods && b.mods[0]) || null);
    if (!u) continue;
    u.uid = b.uid;
    u.hp = Math.min(u.maxHp, b.hp);
    if (b.tr && u.kind === "soldier") { u.tr = { ...b.tr }; refreshUnitStats(u); }
    u.inClinic = true;
    try { u.ant.group.visible = false; } catch {}
  }
  for (const b of cl.beds) {
    if (b.kind !== "ally") continue;
    const u = findUnitByUid(b.uid);
    if (u) {
      u.inClinic = true;
      try { u.ant.group.visible = false; if (u.group) u.group.visible = false; } catch {}
    } else b.gone = true;
  }
  cl.beds = cl.beds.filter((b) => !b.gone);
}
// ---------- بدء التشغيل ----------
async function boot() {
  loadTune();
  try { game._fresh = !localStorage.getItem(SAVE_KEY); } catch { game._fresh = true; }
  try { const dk = localStorage.getItem(DIFF_KEY); if (DIFFS[dk]) game.difficulty = dk; } catch {}
  const extra = loadSave();
  try {
    buildWorld();
  } catch (err) {
    els.loadingEl.innerHTML = "تعذر تشغيل الرسوميات ثلاثية الأبعاد على هذا الجهاز.<br>" + String(err).slice(0, 200);
    throw err;
  }
  await loadModels();

  // النملة الرئيسية
  const ant = createAnt({ body: 0x9c3a0e, dark: 0x471a05, scale: 1.12 });
  ant.group.position.set(6, 0, 8);
  scene.add(ant.group);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.45, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  ant.group.add(ring);
  game.player = { ant, x: 6, z: 8, yaw: Math.PI, vx: 0, vz: 0, hp: 100, st: 100, carried: [], exhausted: false, harvestCd: 0, carryPop: 0 };
  parkCommander(); // 👑 اعتكاف فوري: مخفي وثابت في العش من أول إقلاع

  // سهم العودة للعش (يظهر عند حمل الطعام)
  {
    const pivot = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.7, 4),
      new THREE.MeshStandardMaterial({ color: 0xffd93d, emissive: 0x8a6a00, roughness: 0.4 })
    );
    cone.rotation.x = Math.PI / 2;
    pivot.add(cone);
    pivot.position.set(6, 2.4, 8);
    pivot.visible = false;
    scene.add(pivot);
    game.arrowPivot = pivot;
  }

  initParticles();
  buildYard();
  spawnNestAnts();
  for (let i = 0; i < 14; i++) spawnNode();
  spawnFeast("bigapple", undefined, undefined, true);
  spawnFeast(undefined, undefined, undefined, true);
  setTimeout(() => { try { toast("🍎🍉 ولائم عملاقة بالعالم! (~400-500 🍯 للوحدة — اتبع الأعمدة الذهبية)"); } catch {} }, 4000);

  // تهيئة العش تحت الأرض مبكراً (يحتاجه الحفظ/التحميل)
  Nest.initNest(game, {
    toast, sfx, saveGame, spawnWorker, spawnAdult, totalAnts, canAdd, countKind, capFor,
    t: (k, p) => t(k, p), tRaw: (k) => pick(curLang(), k),
    pingLocal: (key, secs, id) => pingLater(key, secs, id),
    workerCount: () => game.workers.length,
    openGene: () => openGenePanel(),
    openTrain: () => openTrainPanel(),
    clinicBedDone: (snap) => clinicBedDone(snap),
    clinicIncDone: (slot) => clinicIncDone(slot),
    trainSlotDone: (slot) => trainSlotDone(slot),
    buyArchery: () => buyArchery(),
    buySacks: () => buySacks(),
    archeryText: () => archeryText(),
    sacksText: () => sacksText(),
    archeryLevel: () => archeryLevel(),
    sacksLevel: () => sacksLevel(),
    buyFertility: () => buyFertility(),
    fertilityText: () => fertilityText(),
    fertilityLevel: () => fertilityLevel(),
    takeElite: (kind) => takeEliteUnit(kind),
    eliteBonus: (kind) => eliteBonusFor(kind),
  }, document.getElementById("underCanvas"));
  if (game._savedNest) {
    Nest.deserializeNest(game._savedNest);
    game._savedNest = null;
  }

  for (let i = 0; i < TUNE.startWorkers + extra; i++) spawnWorker();
  for (let i = 0; i < TUNE.beetleCount; i++) game.beetles.push(createBeetle());
  for (let i = 0; i < (TUNE.creatureCount || 7); i++) spawnCreature();
  buildColonies();
  // نصر محفوظ: لعب حر (موجة 0) = مدمرتان؛ وحفظ بنص الموجة = تُستعاد الموجة حية بمقياسها
  if (game.victory) {
    try {
      if ((game.wave || 0) > 0) {
        const k = waveK(game.wave), D = diffDef();
        for (const col of game.colonies) {
          col.maxHp = Math.round(col.def.hp * k * D.ehp);
          col.hp = col.maxHp;
          col.dmgK = k;
          for (const e of colonyUnits(col)) {
            e.hp = e.maxHp = Math.round(e.maxHp * k);
            e.dmg = Math.round(e.dmg * (1 + (k - 1) * 0.7));
          }
        }
        game.raidCd = 0;
        setTimeout(() => { try { centerMsg(`🌊 الموجة ${game.wave} مستمرة — المستعمرتان حيتان!`); } catch {} }, 2500);
      } else {
        for (const col of game.colonies) destroyColony(col, true);
        game.raidCd = 99999;
      }
    } catch {}
  }
  buildRegions();
  if (game._savedCollection) { restoreCollection(game._savedCollection); game._savedCollection = null; }
  restoreClinicBeds();
  restoreTrainSlots();
  if (game._savedQuests) { game.quests = game._savedQuests; game._savedQuests = null; }
  if (!game.quests) game.quests = { main: 0, mainDone: false, dailies: [], day: "" };
  ensureDailies();
  for (let i = 0; i < Nest.soldierCount(); i++) spawnSoldier();
  for (let i = 0; i < TUNE.maxFoodOnGround; i++) spawnFood();
  if (!game.level) game.level = 1;

  setupInput();
  addEventListener("resize", onResize);

  // وضع الكاميرا الابتدائي فوراً (بدون انزلاق من الأصل)
  camera.position.set(game.player.x, input.camDist * 0.85, game.player.z + input.camDist * 0.62);
  camera.lookAt(game.player.x, 0.8, game.player.z);

  els.loadingEl.style.display = "none";
  soundOn = game.settings.sound !== false;
  if (game._savedPlayer) {
    try {
      const sp = game._savedPlayer;
      // 👑 القيادة من فوق: الموقع القديم يُستخدم فقط لمعرفة الخريطة المحفوظة، والمحمول يتحول لمخزون
      try { if (inTreeRect(Number(sp.x) || 6, Number(sp.z) || 8)) game.treeZone = true; } catch {}
      if (Array.isArray(sp.carried) && sp.carried.length) {
        const n = sp.carried.filter((k) => KNOWN_FOODS[k]).length;
        if (n > 0) game.store = Math.min(storeCap(), game.store + n);
      }
    } catch {}
    game._savedPlayer = null;
  }
  parkCommander(); // 👑 اعتكاف بعد التحميل: لا نملة ميدانية أبداً
  camera.position.set(game.player.x, input.camDist * 0.85, game.player.z + input.camDist * 0.62);
  camera.lookAt(game.player.x, 0.8, game.player.z);
  updateHUD();
  drawMinimap();
  applyUiPrefs();
  applyLang();
  renderStart();
  renderSettings();
  els.startScreen.hidden = false;
  restoreUpdateFlag();
  clock.start();
  loop();
  autoUpdateCheck();
  setTimeout(() => {
    if (!localStorage.getItem("ant-colony-seen-help")) {
      try { localStorage.setItem("ant-colony-seen-help", "1"); } catch {}
      startPlay();
      els.helpModal.hidden = false;
    }
  }, 400);

  // كشف أول للتهيئة
  /* console.log("[ant-colony] ready"); */
  window.__colony = { game, input, TUNE, NEST_R, Nest, camera, scene, HOLES, YARD, spawnCreature, captureCreature, CREATURE_SPECIES, startPlay, togglePause, saveGame, applyQuality, renderStart, renderSettings, t, curLang, setLang, cycleLang, applyLang, admitToClinic, startGeneProject, buyWarmor, buyLarva, buyGeneUp, geneUpVal, GENE_UPS, buyElite, cancelElite, eliteRemain, eliteBonusFor, takeEliteUnit, renderGenePanel, GENE_MODS, hurtUnit, hitWorker, hitSoldier, damageEnemy, killSiege, applyPoison, findUnitByUid, injuredUnits, healCostFor, spawnWorker, spawnSoldier, spawnScout, canAdd, countKind, capFor, selAllWorkers, selAllSoldiers, selAllInjured, orderHome, orderMoveTo, noteDeployFor, openTrainPanel, renderTrain, startTrainCycle, convertWorkerToSoldier, trainSlotDone, trainRankOf, trainRankText, TRAIN_RANKS, TRAIN_FOCUS, restoreTrainSlots, openBuild, uiPrefs, applyUiPrefs, setUi, applyUILayout, layoutCfg, setLayout, canHideWidget, setEditMode, isEditMode, editToolPlace, smartTap, worldToScreen, groundPoint, selGatherers, army, spawnFood, spawnNode, removeNode, nearestForage, UI_WIDGETS, DOCK_LABEL, enterNest, exitNest, destroyColony, checkVictory, victory, startNextWave, waveCleared, waveK, claimAch, setDifficulty, diffDef, renderDiffRow, renderStart, spawnEnemyUnit, launchRaid, defeat, showEnd, tutStart, tutSkip, tutRender, fmtTime, musicTick, fpsTick, queenStarveTick, TREE, inTreeRect, treeRandPos, treeTransit, gateCrossTick, army, armySel, armyDesel, watchRewardAd, hasAdBridge, pingLater, pingCancelAll, checkUpdate, buildTreeZone, buildTermiteMound, destroyTermiteMound, rebuildTermiteMound, killTermite, orderHold, nearestEnemyAt, doAttackOrder, focusAttackAll, GUARD_R, raidFullReady, launchRaid, buyArchery, buySacks, archeryLevel, sacksLevel, buyFertility, fertilityLevel, fertilityText, fireThorn, decorateArcher, reviveBeast, beastStats, deployBeast, killAlly, spawnAlly, removeAllyEntity, restHeal, quickAttack, quickFollow };
}

boot().catch((e) => {
  console.error("[ant-colony] startup failed", e);
  const friendly = "لم نتمكن من تجهيز المستعمرة. قد تكون المشكلة مؤقتة أو بسبب إمكانيات الرسوميات في الجهاز. أعد المحاولة، وإذا استمرت المشكلة تحقق من اتصال الإنترنت.";
  if (typeof window.showColonyStartupError === "function") {
    window.showColonyStartupError(friendly);
  } else {
    const host = document.getElementById("loadingEl");
    if (host) {
      host.hidden = false;
      host.style.display = "flex";
      host.textContent = friendly;
    }
  }
});
