// نظام العش تحت الأرض — مقطع جانبي، حفر وبناء حقيقي على شبكة.
// لا يستورد من ant-game (تُمرَّر الواجهات عبر initNest).

export const COLS = 12;
export const ROWS = 9;

export const ROOM_DEFS = {
  tunnel:   { name: "ممر",          icon: "↔️", build: 5,  up: [],               max: 1, desc: "يربط الغرف بالشبكة" },
  queen:    { name: "غرفة الملكة",  icon: "👑", build: 0,  up: [20, 35, 60, 100], max: 5, desc: "غرفة الملكة الخاصة: تكبر مع كل ترقية" },
  storage:  { name: "مخزن الطعام",  icon: "🍯", build: 12, up: [20, 32, 48, 70],  max: 5, copies: 10, desc: "نسخ حتى 10: كل مستوى مجموع يرفع سقف المخزون +100 (بجانب سرعة الحمل)" },
  nursery:  { name: "حضانة البيض",  icon: "🥚", build: 15, up: [24, 38, 55, 80],  max: 5, copies: 8, desc: "نسخ حتى 8: مجموع المستويات يسرّع النمو ويرفع سقف الكشافة" },
  workers:  { name: "مسكن العمال",  icon: "🐜", build: 12, up: [20, 32, 48, 70],  max: 5, copies: 10, desc: "نسخ حتى 10: كل ترقية تزيد عدد العمال وسرعتهم" },
  soldiers: { name: "ثكنة الجنود",  icon: "⚔️", build: 20, up: [30, 45, 65, 95],  max: 5, copies: 8, desc: "نسخ حتى 8: مجموع المستويات يسرّع نمو الجنود ويرفع سقفهم" },
  train:    { name: "مركز التدريب العسكري", icon: "🎖️", build: 100, up: [120, 180, 260, 400], max: 5, desc: "تدريب الجنود وتحويل العمال — بشروط فتح صارمة" },
  gene:     { name: "مركز العلاج والتطور", icon: "🧬", build: 40, up: [60, 90, 130, 180, 240, 320], max: 7, desc: "علاج المصابين + ترقيات دائمة للجيش (الملكة تبيض بيضاً مطوراً) — 7 مستويات" },
  entrance: { name: "مدخل العش",    icon: "🕳️", build: 0,  up: [],               max: 1, desc: "الصلة بالسطح" },
};

// ---------- النسخ المتعددة (الغرف الاقتصادية والعسكرية فقط) ----------
// كل أرقام النظام هنا: حد النسخ + سقوف التأثيرات حتى لا تنكسر الموازنة
export const COPYABLE_KINDS = ["storage", "nursery", "workers", "soldiers"];
export const COPY_MAX = { storage: 10, nursery: 8, workers: 10, soldiers: 8 }; // المساكن والمخازن حتى 10 — العلاج والتدريب غرفة واحدة فقط
export const copyMax = (kind) => COPY_MAX[kind] || 8;
export const COPY_TUNING = {
  maxCopies: 10,  // الحد الأقصى العام (الأعلى بين الأنواع)
  storageCap: 5, // سقف سعة الحمل = قيمة غرفة مخزن واحدة بأقصى مستوى
  speedCap: 2.5, // سقف مضاعف سرعة العمال (غرفة واحدة قصوى = 1.75)
  growthCap: 3,  // سقف تسريع النمو (حضانة/ثكنة) — غرفة واحدة قصوى = 2.25
  broodCap: 24,  // سقف الحضن الكلي (غرفة واحدة قصوى = 17)
};
export const isCopyable = (kind) => COPYABLE_KINDS.includes(kind);
// تكلفة بناء النسخة رقم n = التكلفة الأساسية × n (linear) — والترقية لكل نسخة على حدة بجدولها الحالي
export const copyBuildCost = (kind, num) => (ROOM_DEFS[kind] ? ROOM_DEFS[kind].build : 0) * Math.max(1, num);
// احتياج البناء الكامل (عسل + مواد إن وُجدت مستقبلاً — تُضرب في n أيضاً)
export function buildNeedFor(kind, num) {
  const def = ROOM_DEFS[kind];
  const n = Math.max(1, num || 1);
  return { store: (def ? def.build : 0) * n, rares: {} };
}

const NURSERY_SECS = [0, 150, 110, 75, 50, 35];
const DIG_SECS = { tunnel: 6, build: 12, upgrade: 8 };

let G = null;      // game
let API = null;    // {toast, sfx, saveGame, spawnWorker}
// ---------- 🌐 أسماء الغرف حسب اللغة (fallback عربي) ----------
function NT(key, params) {
  try {
    if (API && API.t) { const v = API.t(key, params || {}); if (v != null && v !== key) return v; }
  } catch {}
  return null;
}
export function roomName(kind) {
  const v = NT("room_" + kind);
  if (v) return v;
  const d = ROOM_DEFS[kind];
  return d ? d.name : kind;
}
export function roomDesc(kind) {
  const v = NT("room_" + kind + "_d");
  if (v) return v;
  const d = ROOM_DEFS[kind];
  return d ? d.desc : "";
}
let cv = null, ctx = null;
let soilCv = null;
let selected = null;
let parts = [];
let hatchFx = [];
let queenMove = false;
const QUEEN_MOVE_COST = 5;

function key(x, y) { return x + "," + y; }
function cellAt(x, y) { return G.nest.cells[key(x, y)] || null; }
function jobAt(x, y) { return G.nest.jobs.find((j) => j.x === x && j.y === y) || null; }
function inGrid(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }
function isNetwork(c) { return !!c; }

export function roomLevel(kind) {
  // الأنواع القابلة للتكرار: مجموع مستويات كل النسخ (بدل الأعلى) — الملكة والفريدة تبقى بالأعلى
  if (isCopyable(kind)) {
    let sum = 0;
    for (const k in G.nest.cells) {
      const c = G.nest.cells[k];
      if (c.kind === kind) sum += (c.level || 1);
    }
    return sum;
  }
  let lv = 0;
  for (const k in G.nest.cells) {
    const c = G.nest.cells[k];
    if (c.kind === kind) lv = Math.max(lv, c.level);
  }
  return lv;
}
// خلايا نوع ما مرتبة برقم النسخة + أعمال الحفر الجارية له (تحجز أرقامها مسبقاً)
export function cellsOf(kind) {
  return Object.values(G.nest.cells).filter((c) => c.kind === kind).sort((a, b) => (a.num || 1) - (b.num || 1));
}
export function jobsOf(kind) {
  return (G.nest.jobs || []).filter((j) => j.kind === kind && !j.isUpgrade);
}
export function usedNums(kind) {
  const s = new Set();
  for (const c of cellsOf(kind)) s.add(c.num || 1);
  for (const j of jobsOf(kind)) if (j.num) s.add(j.num);
  return s;
}
// أصغر رقم غير مستخدم (1..maxCopies) — يُعاد استخدام رقم النسخة المحذوفة تلقائياً
export function nextNum(kind) {
  const used = usedNums(kind);
  return nextNumLike(used, copyMax(kind));
}
function nextNumLike(used, lim) {
  const L = lim || COPY_TUNING.maxCopies;
  for (let n = 1; n <= L; n++) if (!used.has(n)) return n;
  return null;
}
export const copyCount = (kind) => cellsOf(kind).length + jobsOf(kind).length;
export const queenLevel = () => roomLevel("queen");
export const storageLevel = () => roomLevel("storage");
export const workersLevel = () => roomLevel("workers");
export const soldiersLevel = () => roomLevel("soldiers");
export const nurseryLevel = () => roomLevel("nursery");
// التأثيرات تُحسب من مجموع مستويات النسخ (انظر roomLevel) مع سقوف صارمة حتى لا تنكسر الموازنة:
// - سعة المخزن: المجموع بحد STORAGE_CAP (= قيمة غرفة واحدة قصوى)
// - سقوف الأنواع: محكومة بـ MAX_* (الإجمالي 80 كما كان) مهما زاد المجموع
// - سرعة العمال: 1 + 15% لكل مستوى مجموع، بحد SPEED_CAP
export const workerCap = () => Math.min(MAX_WORKERS, 5 + queenLevel() * 2 + workersLevel() * 3);
export const soldierCap = () => Math.min(MAX_SOLDIERS, 2 + queenLevel() * 2 + soldiersLevel() * 4);
export const scoutCap = () => Math.min(MAX_SCOUTS, 2 + queenLevel() + nurseryLevel() * 3);
// سقف كل نوع: عمال 30 / جنود 30 / كشافة 20 (ينمو مع الغرف حتى الحد)
export const MAX_WORKERS = 60, MAX_SOLDIERS = 40, MAX_SCOUTS = 30;
export const kindCap = (kind) => kind === "soldier" ? soldierCap() : kind === "scout" ? scoutCap() : workerCap();
// السعة الإجمالية للعرض فقط (مجموع الأنواع)
export const nestCap = () => workerCap() + soldierCap() + scoutCap();
export const geneLevel = () => roomLevel("gene");
export const trainLevel = () => roomLevel("train");
// خصوبة الملكة 👑 (تطوير كهرماني من غرفتها): 0-3 — تُقرأ من API أو من الحفظ مباشرة
export const fertilityLevel = () => {
  try { if (API && API.fertilityLevel) { const v = API.fertilityLevel() | 0; if (v > 0) return Math.min(3, v); } } catch {}
  return Math.max(0, Math.min(3, (G && G.mods && G.mods.fertility) | 0));
};
// نسبة النقص في الجيش (0 ممتلئ .. 1 ممسوح): تُسرّع الملكة تعويض الموتى تلقائياً
function deficitRatio() {
  try {
    const kinds = ["worker", "soldier", "scout"];
    let miss = 0, tot = 0;
    for (const k of kinds) {
      const cap = (API && API.capFor) ? API.capFor(k) : (k === "soldier" ? 30 : k === "scout" ? 20 : 30);
      const n = (API && API.countKind) ? API.countKind(k) : 0;
      miss += Math.max(0, cap - n); tot += Math.max(1, cap);
    }
    return tot > 0 ? Math.max(0, Math.min(1, miss / tot)) : 0;
  } catch { return 0; }
}
// مضاعف سرعة الوضع من الخصوبة (+50%/مستوى) ومن التعويض التلقائي (حتى +60% عند الجيش الممسوح)
export const layBoost = () => (1 + 0.5 * fertilityLevel()) * (1 + 0.6 * deficitRatio());
// مضاعف سرعة النمو من الخصوبة (+15%/مستوى) ومن التعويض (+30% كحد أقصى)
export const growthBoost = () => (1 + 0.15 * fertilityLevel()) * (1 + 0.3 * deficitRatio());
// الحضانة تسرّع الملكة أيضاً (+15% سرعة وضع/مستوى مجموع) — التطوير يشمل الملكة والحاضنة معاً
export const nurseryLayMult = () => 1 + 0.15 * nurseryLevel();
// إيقاع البيض الفعلي بالثواني: بطيء بالبداية (~52ث) ولا يسرع إلا بالتطوير (ملكة/حضانة/خصوبة/تعويض)
export const layIntervalSec = () => (60 / (1 + 0.35 * (queenLevel() - 1))) / nurseryLayMult() / layBoost();
// سعة التدريب المتزامن تنمو مع مستوى المركز
export const trainSlots = () => (trainLevel() >= 4 ? 3 : trainLevel() >= 2 ? 2 : 1);
export function trainState() {
  if (!G.nest.train) G.nest.train = { slots: [] };
  if (!Array.isArray(G.nest.train.slots)) G.nest.train.slots = [];
  return G.nest.train;
}
// شروط فتح مركز التدريب (صارمة — تُقرأ من حالة اللعبة الحية)
export function trainUnlock() {
  const missing = [];
  const lv = G.level || 1;
  if (lv < 6) missing.push(NT("tr_level", { cur: lv }) || `مستوى المستعمرة 6 (حالياً ${lv})`);
  if (!((G.mods && G.mods.mil) >= 1)) missing.push(NT("tr_mil") || "التقنية العسكرية 🎖️ (من متجر التطوير 🛒)");
  const kills = ((G.stats && G.stats.kills) || 0);
  if (kills < 15) missing.push(NT("tr_kills", { cur: kills }) || `15 انتصاراً (حالياً ${kills})`);
  const hat = ((G.stats && G.stats.hatched) || 0);
  if (hat < 10) missing.push(NT("tr_hatch", { cur: hat }) || `فقس 10 نملات (حالياً ${hat})`);
  return { ok: missing.length === 0, missing };
}
export function trainBuildNeed() { return { store: ROOM_DEFS.train.build, rares: { crystal: 6, shell: 8, mushroom: 8, pollen: 4 } }; }
const TRAIN_UP_RICH = { 2: { lifeleaf: 0, healbloom: 0, crystal: 4, pollen: 0, mednectar: 0, shell: 6, mushroom: 0 }, 3: { lifeleaf: 0, healbloom: 6, crystal: 8, pollen: 0, mednectar: 0, shell: 0, mushroom: 8 }, 4: { lifeleaf: 0, healbloom: 0, crystal: 12, pollen: 0, mednectar: 8, shell: 0, mushroom: 10 }, 5: { lifeleaf: 0, healbloom: 0, crystal: 18, pollen: 10, mednectar: 12, shell: 0, mushroom: 0 } };
export function trainUpNeed(toLevel) {
  const r = { ...(TRAIN_UP_RICH[toLevel] || {}) };
  for (const k of Object.keys(r)) if (!r[k]) delete r[k];
  return { store: ROOM_DEFS.train.up[toLevel - 2], rares: r };
}
export function larvaBonus() {
  const lv = clinic().larva || 0;
  if (lv >= 3) return { hp: 20, def: 2, regen: 0.5 };
  if (lv === 2) return { hp: 12, def: 1 };
  if (lv === 1) return { hp: 6 };
  return null;
}
export const geneBeds = () => Math.min(4, 1 + ((geneLevel() / 2) | 0));
export const geneInc = () => (geneLevel() >= 5 ? 3 : geneLevel() >= 2 ? 2 : 1);
export function clinic() {
  if (!G.nest.clinic) G.nest.clinic = { beds: [], inc: [], warmor: 0, larva: 0, gup: { atk: 0, def: 0, work: 0 }, elite: { worker: 0, soldier: 0, scout: 0 } };
  return G.nest.clinic;
}
export const RARE_INFO = {
  lifeleaf: { name: "ورقة الحياة", icon: "🌿" },
  healbloom: { name: "زهرة الشفاء", icon: "🌺" },
  crystal: { name: "بلورة جينية", icon: "💠" },
  pollen: { name: "غبار اللقاح", icon: "✨" },
  shell: { name: "صدف", icon: "🐚" },
  mushroom: { name: "فطر", icon: "🍄" },
  nut: { name: "جوز", icon: "🌰" },
  nectar: { name: "رحيق", icon: "🌸" },
  mednectar: { name: "رحيق طبي", icon: "🧪" },
};
const GENE_UP_NEED = {
  2: { store: 60, rares: { lifeleaf: 4 } },
  3: { store: 90, rares: { lifeleaf: 6, healbloom: 3 } },
  4: { store: 130, rares: { lifeleaf: 8, healbloom: 5, crystal: 2 } },
  5: { store: 180, rares: { healbloom: 8, crystal: 4, pollen: 2 } },
  6: { store: 240, rares: { crystal: 7, pollen: 4, mednectar: 3 } },
  7: { store: 320, rares: { crystal: 10, pollen: 6, mednectar: 5 } },
};
export function geneUpNeed(toLevel) { return GENE_UP_NEED[toLevel] || null; }
export function raresText(rares) {
  return Object.keys(rares || {}).map((k) => `${rares[k]}${(RARE_INFO[k] || {}).icon || "❓"}`).join(" ");
}
export function hasRares(rares) {
  for (const k of Object.keys(rares || {})) if ((G.stock[k] || 0) < rares[k]) return false;
  return true;
}
function payRares(rares) {
  for (const k of Object.keys(rares || {})) G.stock[k] = Math.max(0, (G.stock[k] || 0) - rares[k]);
}
export function geneBuildNeed() { return { store: ROOM_DEFS.gene.build, rares: { lifeleaf: 3, healbloom: 2 } }; }
export function broodList() { return G.nest.brood || []; }
// ---------- أوقات معلقة للتنبيهات المحلية 📢 (ثواني لعب تقديرية) ----------
export function pendingJobSecs() {
  let m = 0;
  try {
    for (const j of (G.nest.jobs || [])) {
      const r = Math.max(0, (j.dur || 0) - (j.t || 0));
      if (r > 0 && (!m || r < m)) m = r;
    }
  } catch {}
  return Math.ceil(m);
}
export function pendingBroodSecs() {
  let m = 0;
  try {
    for (const b of (G.nest.brood || [])) {
      const r = Math.max(0, b.t || 0);
      if (r > 0 && (!m || r < m)) m = r;
    }
  } catch {}
  return Math.ceil(m);
}
export function removeBrood(id) {
  const i = (G.nest.brood || []).findIndex((b) => b && b.id === id);
  if (i < 0) return null;
  return G.nest.brood.splice(i, 1)[0];
}
export function pushBrood(entry) {
  G.nest.brood.push(entry);
  API.saveGame();
}
// بيضة بمعرّف صحيح (للجنود العائدين من التحويل عند امتلاء الثكنة)
export function queueBrood(kind, gene) {
  const entry = { id: (G.nest.broodId = (G.nest.broodId || 0) + 1), kind, stage: "egg", t: 25, ready: false, gene: gene || null };
  G.nest.brood.push(entry);
  API.saveGame();
  return entry;
}
export const storageBonus = () => Math.min(COPY_TUNING.storageCap, storageLevel());
export const workerSpeedMult = () => Math.min(COPY_TUNING.speedCap, 1 + 0.15 * workersLevel());
// عدد الجنود الابتدائي عند بدء اللعب — من المجموع لكن بحد السقف حتى لا يتجاوزه بعد إعادة التحميل
export const soldierCount = () => Math.min(soldierCap(), soldiersLevel());
export const soldierUnlocked = () => soldiersLevel() > 0;
export const scoutUnlocked = () => nurseryLevel() >= 2;
export const broodMax = () => Math.min(COPY_TUNING.broodCap, 2 + queenLevel() * 2 + nurseryLevel() * 2 + fertilityLevel() * 2);
export const nurserySecs = () => NURSERY_SECS[Math.min(nurseryLevel(), 5)] || 0;

function hasBuiltNeighbor(x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const c = inGrid(x + dx, y + dy) ? cellAt(x + dx, y + dy) : null;
    return !!c;
  });
}
// أول موضع حر من المواضع المرتبة (ممر مركزي + جوانب متباعدة مثل الصورة) — تُقبل خلايا الممرات للتحويل لغرف
// تُستخدم عند بناء نسخة جديدة + لمواضع الأشباح
// taken: مجموعة "x,y" محجوزة مسبقاً (أعمال جارية/أشباح) — تُتجاهل
export function findBuildSlot(kind, taken) {
  const tk = taken || new Set();
  for (const [sx, sy] of NEST_SLOTS) {
    const kk = sx + "," + sy;
    if (tk.has(kk) || jobAt(sx, sy)) continue;
    const c = cellAt(sx, sy);
    if (c && c.kind !== "tunnel") continue;
    if (roomNeighbor(sx, sy, null)) continue;
    return { x: sx, y: sy };
  }
  // احتياطي (العش ممتلئ تقريباً): أي خانة حرة متصلة بلا غرف مجاورة — خارج عمود الممر
  const q = findQueen() || { x: 6, y: 0 };
  const seen = new Set([q.x + "," + q.y]);
  const queue = [[q.x, q.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, kk = nx + "," + ny;
      if (!inGrid(nx, ny) || seen.has(kk)) continue;
      seen.add(kk);
      const c = cellAt(nx, ny);
      if (c) { if (c.x !== SHAFT_X) queue.push([nx, ny]); continue; }
      if (jobAt(nx, ny) || tk.has(kk) || ny === 8) continue;
      if (roomNeighbor(nx, ny, null)) continue;
      return { x: nx, y: ny };
    }
  }
  return null;
}

export function serializeNest() {
  return {
    cells: Object.values(G.nest.cells).map((c) => ({ x: c.x, y: c.y, kind: c.kind, level: c.level, num: c.num || 1 })),
    jobs: G.nest.jobs.map((j) => ({ ...j })),
    nurseT: G.nest.nurseT || 0,
    focus: G.nest.focus || "worker",
    queenHp: G.nest.queenHp == null ? 100 : G.nest.queenHp,
    starveT: G.nest.starveT || 0,
    brood: (G.nest.brood || []).map((b) => ({ ...b })),
    eatT: G.nest.eatT || 0,
    layT: G.nest.layT == null ? 12 : G.nest.layT,
    dormant: !!G.nest.dormant,
    broodId: G.nest.broodId || 0,
    viewZ: G.nest.viewZ == null ? null : clampZ(G.nest.viewZ),
    clinic: G.nest.clinic ? {
      beds: G.nest.clinic.beds.map((b) => ({ kind: b.kind, uid: b.uid, hp: b.hp, maxHp: b.maxHp, variant: b.variant || null, entryUid: b.entryUid || null, gene: b.gene ? { ...b.gene } : null, tr: b.tr ? { ...b.tr } : null, tTotal: b.tTotal, tLeft: b.tLeft })),
      inc: G.nest.clinic.inc.map((s) => ({ id: s.id, kind: s.kind, geneKey: s.geneKey, tTotal: s.tTotal, tLeft: s.tLeft, risk: s.risk, egg: s.egg ? { ...s.egg } : null })),
      warmor: G.nest.clinic.warmor || 0,
      larva: G.nest.clinic.larva || 0,
      gup: { atk: (G.nest.clinic.gup && G.nest.clinic.gup.atk) || 0, def: (G.nest.clinic.gup && G.nest.clinic.gup.def) || 0, work: (G.nest.clinic.gup && G.nest.clinic.gup.work) || 0 },
      elite: { worker: (G.nest.clinic.elite && G.nest.clinic.elite.worker) || 0, soldier: (G.nest.clinic.elite && G.nest.clinic.elite.soldier) || 0, scout: (G.nest.clinic.elite && G.nest.clinic.elite.scout) || 0 },
    } : null,
    train: G.nest.train ? {
      slots: G.nest.train.slots.map((s) => ({ id: s.id, mode: s.mode, uid: s.uid, variant: s.variant || null, gene: s.gene ? { ...s.gene } : null, mods: s.mods ? [...s.mods] : [], tr: s.tr ? { ...s.tr } : null, focus: s.focus || null, xpGain: s.xpGain || 0, bonus: s.bonus ? { ...s.bonus } : null, tTotal: s.tTotal, tLeft: s.tLeft })),
    } : null,
  };
}
export function deserializeNest(d) {
  if (!d || !Array.isArray(d.cells)) return false;
  G.nest.cells = {};
  // التوافق مع الحفظ القديم: خلايا بلا num تُعطى 1 — والتكرارات/الخارج عن النطاق تُصحح لأصغر رقم حر
  const seen = {};
  for (const c of d.cells) {
    if (inGrid(c.x, c.y) && ROOM_DEFS[c.kind]) {
      let num = Math.max(1, Math.min(COPY_TUNING.maxCopies, Number(c.num) || 1));
      seen[c.kind] = seen[c.kind] || new Set();
      if (seen[c.kind].has(num)) {
        num = nextNumLike(seen[c.kind]);
      }
      seen[c.kind].add(num);
      G.nest.cells[key(c.x, c.y)] = { x: c.x, y: c.y, kind: c.kind, level: Math.max(1, Math.min(ROOM_DEFS[c.kind].max || 5, c.level || 1)), num };
    }
  }
  G.nest.jobs = Array.isArray(d.jobs) ? d.jobs.filter((j) => inGrid(j.x, j.y) && ROOM_DEFS[j.kind]).map((j) => {
    const jj = { ...j };
    // الحفر الجاري يحفظ رقمه المخصص — والقديم بلا رقم يُعطى أصغر رقم حر (فلا تتكرر الأرقام بعد التحميل)
    if (!jj.isUpgrade) {
      let num = Math.max(1, Math.min(COPY_TUNING.maxCopies, Number(jj.num) || 0));
      seen[jj.kind] = seen[jj.kind] || new Set();
      if (!num || seen[jj.kind].has(num)) num = nextNumLike(seen[jj.kind], copyMax(jj.kind));
      seen[jj.kind].add(num);
      jj.num = num;
    }
    return jj;
  }) : [];
  G.nest.nurseT = Number(d.nurseT) || 0;
  G.nest.focus = ["worker", "soldier", "scout"].includes(d.focus) ? d.focus : "worker";
  G.nest.queenHp = d.queenHp == null ? 100 : Math.max(0, Math.min(100, Number(d.queenHp)));
  G.nest.starveT = Math.max(0, Number(d.starveT) || 0);
  G.nest.brood = Array.isArray(d.brood) ? d.brood.filter((b) => b && ["egg", "larva", "pupa"].includes(b.stage)) : [];
  G.nest.eatT = Number(d.eatT) || 0;
  G.nest.layT = d.layT == null ? 12 : Number(d.layT);
  G.nest.dormant = !!d.dormant;
  G.nest.broodId = Math.max(G.nest.broodId || 0, Number(d.broodId) || 0);
  G.nest.viewZ = d.viewZ == null ? null : clampZ(d.viewZ);
  G.nest.clinic = d.clinic && Array.isArray(d.clinic.beds) ? {
    beds: d.clinic.beds.filter((b) => b && b.uid != null),
    inc: Array.isArray(d.clinic.inc) ? d.clinic.inc.filter((s) => s && s.id != null) : [],
    warmor: Math.max(0, Math.min(5, Number(d.clinic.warmor) || 0)),
    larva: Math.max(0, Math.min(3, Number(d.clinic.larva) || 0)),
    gup: {
      atk: Math.max(0, Math.min(5, Number(d.clinic.gup && d.clinic.gup.atk) || 0)),
      def: Math.max(0, Math.min(5, Number(d.clinic.gup && d.clinic.gup.def) || 0)),
      work: Math.max(0, Math.min(5, Number(d.clinic.gup && d.clinic.gup.work) || 0)),
    },
    elite: {
      worker: Math.max(0, Math.min(50, Number(d.clinic.elite && d.clinic.elite.worker) || 0)),
      soldier: Math.max(0, Math.min(50, Number(d.clinic.elite && d.clinic.elite.soldier) || 0)),
      scout: Math.max(0, Math.min(50, Number(d.clinic.elite && d.clinic.elite.scout) || 0)),
    },
  } : { beds: [], inc: [], warmor: 0, larva: 0 };
  G.nest.train = d.train && Array.isArray(d.train.slots) ? {
    slots: d.train.slots.filter((s) => s && s.id != null),
  } : { slots: [] };
  return Object.keys(G.nest.cells).length > 0;
}

function prebuilt() {
  G.nest.cells = {};
  G.nest.jobs = [];
  G.nest.nurseT = 0;
  const put = (x, y, kind, level = 1, num = 1) => { G.nest.cells[key(x, y)] = { x, y, kind, level, num }; };
  // عش مرتّب مثل الصورة: ممر مركزي عمودي + غرف كبيرة على الجانبين + قصر الملكة معزولاً في الأسفل
  put(6, 0, "entrance");
  for (let y = 1; y <= 7; y++) put(6, y, "tunnel");
  put(6, 8, "queen", 1);
  put(5, 1, "storage", 1);
  put(7, 1, "nursery", 1);
  put(5, 3, "workers", 1);
}
// ---------- التخطيط المرتب (مثل الصورة): ممر مركزي + غرف جانبية متباعدة + ملكة معزولة ----------
export const SHAFT_X = 6; // عمود الممر المركزي
// مواضع الغرف بالترتيب: ملاصقة للممر أولاً (صفوف فردية متباعدة)، ثم حلقة خارجية — لا تتداخل حتى بأقصى مستوى
export const NEST_SLOTS = [
  [5, 1], [7, 1], [5, 3], [7, 3], [5, 5], [7, 5],
  [3, 2], [9, 2], [3, 4], [9, 4], [3, 6], [9, 6],
  [1, 2], [11, 2], [1, 4], [11, 4], [1, 6], [11, 6],
  [3, 1], [9, 1], [3, 3], [9, 3], [3, 5], [9, 5],
  [1, 1], [11, 1], [1, 3], [11, 3], [1, 5], [11, 5], [1, 7], [11, 7],
  [3, 7], [9, 7],
];
// هل تجاور الخلية غرفة (وليس ممراً)؟ — التباعد يمنع التداخل
function roomNeighbor(x, y, ignoreK) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const c = inGrid(x + dx, y + dy) ? cellAt(x + dx, y + dy) : null;
    if (c && c.kind !== "tunnel" && c.kind !== "entrance" && key(x + dx, y + dy) !== ignoreK) return true;
  }
  return false;
}
// وصلة أفقية من الغرفة إلى الممر المركزي: تُملأ الخلايا الفارغة فقط بممرات (الغرف والممرات الموجودة تُحترم)
function ensureShaftLink(x, y) {
  if (y === 8 || x === SHAFT_X) return;
  const step = x < SHAFT_X ? 1 : -1;
  for (let cx = x; cx !== SHAFT_X; cx += step) {
    const tx = cx + step;
    if (tx === SHAFT_X || !inGrid(tx, y)) break;
    if (cellAt(tx, y) || jobAt(tx, y)) continue;
    G.nest.cells[key(tx, y)] = { x: tx, y, kind: "tunnel", level: 1, num: 1 };
  }
}

// ---------- أدوات رسم عضوية (لا مربعات بشرية — فقاعات ترابية محفورة) ----------
function shadeHex(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
// مسار فقاعة غير منتظمة بحواف متموجة (شكل الغرف المحفورة فعلياً)
function blobPath(g, cx, cy, r, seed, wob = 0.16, lobes = 13, squash = 0.9) {
  // تجويف محفور في التربة: حواف غير منتظمة بزوايا خفيفة (مش فقاعات ولا دوائر تامة)
  const pts = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const k = 1 + (hash2(seed, i, 7) - 0.5) * 2 * wob;
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * squash]);
  }
  g.beginPath();
  g.moveTo((pts[0][0] + pts[lobes - 1][0]) / 2, (pts[0][1] + pts[lobes - 1][1]) / 2);
  for (let i = 0; i < lobes; i++) {
    const p = pts[i], q = pts[(i + 1) % lobes];
    g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  g.closePath();
}
// ---------- ثوابت تخطيط العش (كل أرقام الرسم هنا — الكسور من حجم الخانة) ----------
// القواعد: غرف كبيرة عضوية (العادية نصف قطرها ≈ 0.44 من الخانة ≈ 40px، والملكةة 0.55 ≈ 50px)،
// المراكز على الشبكة لكن الغرف الكبيرة قد تتلامس قليلاً مثل أعشاش The Ants المرجعية — بلا تداخل حاد
export const NEST_LAY = {
  maxR: 1.02,     // نصف القطر الأقصى لأي غرفة (كسر من الخانة) — الغرف تملأ خانتها مثل الصورة
  levelStep: 0.085, // زيادة نصف القطر لكل مستوى فوق الأول: م1 ≈ 0.62 ← م5 ≈ 0.96
  haloR: 0.95,     // نصف قطر الهالة/الظل الأقصى (داخل الخانة)
  // أنصاف أقطار أساسية لكل نوع (كسر من الخانة — القطر = ×2)
  baseR: { queen: 0.80, nursery: 0.62, storage: 0.62, gene: 0.62, soldiers: 0.62, train: 0.62, workers: 0.62, entrance: 0.30, tunnel: 0.15 },
  squash: 0.72,   // الغرف بيضاوية عريضة مثل الصورة (عرض > ارتفاع)
  nameMinPx: 44,  // أقل حجم خلية تُرسم فيه اللافتة وسطر المستوى (أصغر = أيقونات وأرقام فقط)
  btnMinPx: 52,   // أقل حجم خلية يُرسم فيه زر الترقية
  tunnelW: 0.50,  // عرض النفق الخارجي (كسر من الخانة) — عريض مثل الصورة
};
export function chamberRadius(c, cell) {
  const base = (NEST_LAY.baseR[c.kind] != null ? NEST_LAY.baseR[c.kind] : 0.30);
  return cell * Math.min(NEST_LAY.maxR, base + NEST_LAY.levelStep * (((c.level || 1) - 1)));
}

// ---------- التهيئة ----------
export function initNest(game, api, canvas) {
  G = game;
  API = api;
  cv = canvas;
  ctx = cv.getContext("2d");
  G.nest = G.nest || { cells: {}, jobs: [], nurseT: 0 };
  if (G.nest.focus === undefined) G.nest.focus = "worker";
  if (G.nest.queenHp === undefined) G.nest.queenHp = 100;
  if (!Array.isArray(G.nest.brood)) G.nest.brood = [];
  if (G.nest.eatT === undefined) G.nest.eatT = 0;
  if (G.nest.layT === undefined) G.nest.layT = 12;
  if (G.nest.layAnim === undefined) G.nest.layAnim = 0;
  if (G.nest.queenMunchT === undefined) G.nest.queenMunchT = 0; // انميشن قضم الملكة للطعام 👑
  // ترحيل لمرة واحدة: زوم الحفظ القديم (≤3.5) كان لمقياس 60 — نرجعه للافتراضي الضخم الجديد
  if (G.nest.viewZ != null && G.nest.viewZ <= 3.51) G.nest.viewZ = null;
  if (G.nest.dormant === undefined) G.nest.dormant = false;
  if (Object.keys(G.nest.cells).length === 0 && G.nest.jobs.length === 0) prebuilt();
  buildSoil();
  // إيماءات العرض: سحب للتحريك، قرصة/عجلة للتقريب، نقرة قصيرة للتفاعل
  const nptrs = new Map();
  let ntap = null, npinch = null, nsaveT = null;
  const nestSaveSoon = () => { clearTimeout(nsaveT); nsaveT = setTimeout(() => { try { API.saveGame(); } catch {} }, 700); };
  cv.addEventListener("pointerdown", (e) => {
    if (!G.underground) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch {}
    nptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (nptrs.size === 1) ntap = { t: performance.now(), moved: 0 };
    else { ntap = null; const [a, b] = [...nptrs.values()]; npinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: viewZ() }; }
  });
  cv.addEventListener("pointermove", (e) => {
    const p = nptrs.get(e.pointerId);
    if (!p || !G.underground) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (nptrs.size === 1) {
      view.px += dx; view.py += dy; normalizePan();
      if (ntap) ntap.moved += Math.abs(dx) + Math.abs(dy);
    } else if (nptrs.size === 2) {
      const [a, b] = [...nptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (npinch && npinch.d > 24 && d > 10) {
        setZoom(npinch.z * d / npinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2, false);
        nestSaveSoon();
      }
    }
  });
  const nend = (e) => {
    nptrs.delete(e.pointerId);
    if (!G.underground) { if (!nptrs.size) { ntap = null; npinch = null; } return; }
    if (nptrs.size === 0 && ntap) {
      const quick = performance.now() - ntap.t < 600 && ntap.moved < 14;
      ntap = null;
      if (quick) {
        const r = cv.getBoundingClientRect();
        handleTap(e.clientX - r.left, e.clientY - r.top);
      } else nestSaveSoon();
    }
    if (nptrs.size < 2) npinch = null;
  };
  cv.addEventListener("pointerup", nend);
  cv.addEventListener("pointercancel", nend);
  cv.addEventListener("wheel", (e) => {
    if (!G.underground) return;
    e.preventDefault();
    setZoom(viewZ() * (e.deltaY > 0 ? 0.88 : 1.14), e.clientX, e.clientY, false);
    nestSaveSoon();
  }, { passive: false });
  // أزرار التقريب والملاءمة
  const zin = document.getElementById("nestZoomIn"), zout = document.getElementById("nestZoomOut"), zfit = document.getElementById("nestZoomFit");
  const zc = () => { const r = cv.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.4]; };
  if (zin) zin.onclick = () => { const [x, y] = zc(); setZoom(viewZ() * 1.25, x, y); API.sfx.click(); };
  if (zout) zout.onclick = () => { const [x, y] = zc(); setZoom(viewZ() / 1.25, x, y); API.sfx.click(); };
  if (zfit) zfit.onclick = () => { try { fitGridView(); } catch { resetNestView(); } API.sfx.click(); API.toast("🔍 عرض كامل للشبكة — قرّب لرؤية الأسماء"); };
  addEventListener("resize", buildSoil);
  // زر نقل الملكة + إلغاء وضع النقل عند إغلاق اللوحات
  const qmBtn = document.getElementById("queenMoveBtn");
  if (qmBtn) qmBtn.onclick = () => startQueenMove();
  const rcBtn = document.getElementById("roomCloseBtn");
  if (rcBtn) rcBtn.addEventListener("click", () => { cancelQueenMove(); });
  const ubBtn = document.getElementById("underBackBtn");
  if (ubBtn) ubBtn.addEventListener("click", () => { cancelQueenMove(); });
}

// ---------- نقل الملكة لغرفة أخرى داخل العش ----------
function findQueen() {
  for (const k in G.nest.cells) if (G.nest.cells[k].kind === "queen") return G.nest.cells[k];
  return null;
}
export function queenMoveActive() { return queenMove; }
export function cancelQueenMove(silent) {
  if (!queenMove) return;
  queenMove = false;
  const hint = document.getElementById("underHint");
  if (hint) hint.textContent = "اضغط على تراب لامع للحفر";
  const mb = document.getElementById("queenMoveBtn");
  if (mb && !silent) { mb.disabled = false; }
}
function startQueenMove() {
  const q = findQueen();
  if (!q) return;
  if (queenMove) { cancelQueenMove(); openPanel(q); return; }
  queenMove = true;
  document.getElementById("roomPanel").hidden = true;
  document.getElementById("underHint").textContent = `🚚 الصف السفلي فقط: اختر خلية فارغة بالصف السفلي (معزل الملكة 👑) لنقلها (${QUEEN_MOVE_COST} 🍯) — أو غرفتها للإلغاء`;
  API.toast("🚚 اختر مكان الغرفة الجديدة للملكة — بالصف السفلي فقط");
}
function moveQueenTo(x, y) {
  const q = findQueen();
  if (!q) { cancelQueenMove(); return; }
  if (y !== 8) { API.toast("👑 غرفة الملكة بالصف السفلي فقط — معزولة مثل الصورة"); return; }
  if (roomNeighbor(x, y, key(q.x, q.y))) { API.toast("👑 المكان ضيق — رتّب العش 🧹 أولاً لعزل الملكة"); return; }
  if (G.store < QUEEN_MOVE_COST) {
    API.toast("🍯 نقل الملكة يحتاج 5 طعام");
    cancelQueenMove();
    openPanel(q);
    return;
  }
  G.store -= QUEEN_MOVE_COST;
  delete G.nest.cells[key(q.x, q.y)];
  G.nest.cells[key(q.x, q.y)] = { x: q.x, y: q.y, kind: "tunnel", level: 1, num: 1 };
  G.nest.cells[key(x, y)] = { x, y, kind: "queen", level: q.level, num: q.num || 1 };
  // وصلة الصف السفلي إلى الممر المركزي
  const step = x < SHAFT_X ? 1 : -1;
  for (let cx = x; cx !== SHAFT_X; cx += step) {
    const tx = cx + step;
    if (tx === SHAFT_X || !inGrid(tx, 8)) break;
    if (cellAt(tx, 8) || jobAt(tx, 8)) continue;
    G.nest.cells[key(tx, 8)] = { x: tx, y: 8, kind: "tunnel", level: 1, num: 1 };
  }
  queenMove = false;
  document.getElementById("underHint").textContent = "اضغط على تراب لامع للحفر";
  selected = { x, y };
  API.saveGame();
  API.sfx.level();
  API.toast("👑 انتقلت الملكة إلى غرفتها الجديدة!");
  openPanel(G.nest.cells[key(x, y)]);
}
// 🧹 ترتيب العش مثل الصورة: ممر مركزي + غرف على الجوانب + ملكة معزولة — يحافظ على الأنواع والمستويات والأرقام
export function tidyNest() {
  if ((G.nest.jobs || []).length) { API.toast("⏳ انتظر انتهاء الحفر والترقيات ثم رتّب العش"); return false; }
  const rooms = Object.values(G.nest.cells).filter((c) => c.kind !== "tunnel" && c.kind !== "entrance" && c.kind !== "queen");
  const kord = { storage: 0, nursery: 1, workers: 2, soldiers: 3, gene: 4, train: 5 };
  rooms.sort((a, b) => ((kord[a.kind] == null ? 9 : kord[a.kind]) - (kord[b.kind] == null ? 9 : kord[b.kind])) || ((a.num || 1) - (b.num || 1)));
  const queen = findQueen();
  G.nest.cells = {};
  const put = (x, y, kind, level = 1, num = 1) => { G.nest.cells[key(x, y)] = { x, y, kind, level, num }; };
  put(6, 0, "entrance");
  for (let y = 1; y <= 7; y++) put(6, y, "tunnel");
  put(6, 8, "queen", queen ? queen.level : 1, queen ? (queen.num || 1) : 1);
  let si = 0;
  const leftovers = [];
  for (const r of rooms) {
    while (si < NEST_SLOTS.length) {
      const c = cellAt(NEST_SLOTS[si][0], NEST_SLOTS[si][1]);
      if (!c || c.kind === "tunnel") break;
      si++;
    }
    if (si >= NEST_SLOTS.length) { leftovers.push(r); continue; }
    const [sx, sy] = NEST_SLOTS[si++];
    put(sx, sy, r.kind, r.level, r.num || 1);
    ensureShaftLink(sx, sy);
  }
  // الزائد عن المواضع (نادر): أقرب فراغ متباعد بلا غرف مجاورة
  for (const r of leftovers) {
    const s = findBuildSlot(r.kind);
    if (!s) break;
    put(s.x, s.y, r.kind, r.level, r.num || 1);
    ensureShaftLink(s.x, s.y);
  }
  G.nest.dots = [];
  try {
    const t0 = carrierTargets();
    if (G.nest.carriers) for (const c of G.nest.carriers) {
      c.path = [];
      const f = carrierTargets().food || t0.food;
      if (f) { c.fx = f.x; c.fy = f.y; }
    }
  } catch {}
  parts.length = 0; hatchFx.length = 0;
  selected = null; cancelQueenMove(true);
  try {
    document.getElementById("roomPanel").hidden = true;
    document.getElementById("buildMenu").hidden = true;
  } catch {}
  API.saveGame();
  API.sfx.level();
  API.toast("🧹 ترتّب العش مثل الصورة: ممر بالنص وغرف كبيرة على الجوانب والملكةة معزولة! 👑");
  return true;
}
// إلغاء حفر/ترقية جارٍ مع استرداد كامل للموارد (عسل + نادر) — ثقة اللاعب أولاً
export function cancelJob(x, y) {
  const i = (G.nest.jobs || []).findIndex((j) => j.x === x && j.y === y);
  if (i < 0) return false;
  const [j] = G.nest.jobs.splice(i, 1);
  try {
    const p = j.paid || null;
    if (p) {
      if (p.store) G.store = (G.store || 0) + p.store;
      for (const k of Object.keys(p.rares || {})) G.stock[k] = Math.min(500, (G.stock[k] || 0) + p.rares[k]);
    } else {
      // توافق قديم: استرداد تقديري
      const def = ROOM_DEFS[j.kind];
      if (def) G.store = Math.min(500, (G.store || 0) + (j.isUpgrade ? (def.up[(j.toLevel || 2) - 2] || 0) : def.build));
    }
  } catch {}
  try { API.saveGame(); API.sfx.click(); } catch {}
  API.toast("↩️ أُلغي العمل واستُردت الموارد كاملة!");
  try { document.getElementById("roomPanel").hidden = true; } catch {}
  selected = null;
  return true;
}
function openJobPanel(j) {
  const panel = document.getElementById("roomPanel");
  try { document.getElementById("buildMenu").hidden = true; } catch {}
  const def = ROOM_DEFS[j.kind] || { name: j.kind, icon: "⛏️" };
  const pct = Math.round((j.t / Math.max(1, j.dur)) * 100);
  const num = (j.num ? " #" + j.num : "");
  const what = j.isUpgrade ? ("🔨 ترقية " + def.name + " → م" + j.toLevel) : ("⛏️ حفر " + def.name + num);
  document.getElementById("roomTitle").textContent = what + " (" + pct + "%)";
  let payTxt = "";
  try {
    const p = j.paid;
    if (p && (p.store || Object.keys(p.rares || {}).length)) {
      payTxt = " — الاسترداد: " + (p.store || 0) + " 🍯" + (p.rares ? (" " + raresText(p.rares)) : "");
    }
  } catch {}
  document.getElementById("roomDesc").textContent = "العمل جارٍ... " + pct + "% — الإلغاء يعيد لك كل ما دفعته." + payTxt;
  try {
    document.getElementById("casteRow").hidden = true;
    for (const id of ["queenMoveBtn", "fertBtn", "geneOpenBtn", "trainOpenBtn", "archerBtn", "sackBtn"]) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
  } catch {}
  const upBtn = document.getElementById("roomUpgradeBtn");
  upBtn.disabled = false;
  upBtn.textContent = "❌ إلغاء العمل واسترداد الموارد";
  upBtn.onclick = () => { cancelJob(j.x, j.y); };
  panel.hidden = false;
}
export function roomCount() {
  try { return Object.values(G.nest.cells).filter((c) => c.kind !== "tunnel" && c.kind !== "entrance").length; }
  catch { return 0; }
}

// ---------- عاملات الداخل: يحملن الطعام للملكة والبيض للحضانة ----------
function carrierTargets() {
  const cells = Object.values(G.nest.cells);
  const food = cells.find((c) => c.kind === "storage") || cells.find((c) => c.kind === "entrance");
  const queen = findQueen();
  const nurse = cells.find((c) => c.kind === "nursery") || queen;
  return { food, queen, nurse };
}
function bfsPath(sx, sy, tx, ty) {
  if (!inGrid(tx, ty) || !cellAt(tx, ty)) return [];
  if (sx === tx && sy === ty) return [];
  const prev = new Map();
  const q = [[sx, sy]];
  prev.set(sx + "," + sy, null);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + "," + ny;
      if (!inGrid(nx, ny) || !cellAt(nx, ny) || prev.has(k)) continue;
      prev.set(k, [x, y]);
      if (nx === tx && ny === ty) {
        const path = [[nx, ny]];
        let cur = [x, y];
        while (cur) { path.unshift(cur); cur = prev.get(cur[0] + "," + cur[1]); }
        return path.slice(1);
      }
      q.push([nx, ny]);
    }
  }
  return [];
}
function updateCarriers(dt) {
  const t0 = carrierTargets();
  if (!t0.food || !t0.queen || !t0.nurse) return;
  const want = Math.min(4, 1 + queenLevel());
  const arr = G.nest.carriers || (G.nest.carriers = []);
  while (arr.length < want) arr.push({ fx: t0.food.x + (Math.random() - 0.5) * 0.3, fy: t0.food.y + (Math.random() - 0.5) * 0.3, path: [], leg: "toQueen", has: "food", sp: 0.85 + Math.random() * 0.3 });
  if (arr.length > want) arr.length = want;
  for (const c of arr) {
    const cx = Math.round(c.fx), cy = Math.round(c.fy);
    if (!c.path.length) {
      const t = carrierTargets();
      if (c.leg === "toQueen") {
        if (cx === t.queen.x && cy === t.queen.y) {
          // تسليم الطعام للملكةة: صحة + تقريب موعد البيضة + انميشن القضم
          G.nest.queenHp = Math.min(100, (G.nest.queenHp || 0) + 3);
          G.nest.layT = Math.max(0, (G.nest.layT || 0) - 1.5);
          G.nest.queenMunchT = 1;
          c.leg = "toNurse";
          c.has = (G.nest.brood && G.nest.brood.length) ? "egg" : null;
          c.path = bfsPath(cx, cy, t.nurse.x, t.nurse.y);
        } else {
          c.has = "food";
          c.path = bfsPath(cx, cy, t.queen.x, t.queen.y);
        }
      } else if (c.leg === "toNurse") {
        if (cx === t.nurse.x && cy === t.nurse.y) {
          // إيداع البيضة في مكانها المخصص: تسريع نمو أصغر حضنة
          if (c.has === "egg" && G.nest.brood.length) {
            let b = G.nest.brood[0];
            for (const x of G.nest.brood) if (x.t < b.t) b = x;
            b.t = Math.max(0.5, b.t - 4);
          }
          c.leg = "toFood";
          c.has = null;
          c.path = bfsPath(cx, cy, t.food.x, t.food.y);
        } else {
          c.path = bfsPath(cx, cy, t.nurse.x, t.nurse.y);
        }
      } else {
        if (cx === t.food.x && cy === t.food.y) {
          c.leg = "toQueen";
          c.has = "food";
          c.path = bfsPath(cx, cy, t.queen.x, t.queen.y);
        } else {
          c.has = null;
          c.path = bfsPath(cx, cy, t.food.x, t.food.y);
        }
      }
    }
    if (c.path.length) {
      const [nx, ny] = c.path[0];
      const dx = nx - c.fx, dy = ny - c.fy;
      const d = Math.hypot(dx, dy);
      const step = 2.4 * (c.sp || 1) * dt;
      if (d <= step + 0.02) { c.fx = nx; c.fy = ny; c.path.shift(); }
      else { c.fx += (dx / d) * step; c.fy += (dy / d) * step; }
    }
  }
}

function buildSoil() {
  soilCv = document.createElement("canvas");
  const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight);
  soilCv.width = w; soilCv.height = h;
  const g = soilCv.getContext("2d");
  // تربة دافئة فاتحة مثل الصورة (بني رملي — لا سواد)
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#7d5c36");
  grad.addColorStop(0.35, "#6b4a29");
  grad.addColorStop(0.7, "#4e3319");
  grad.addColorStop(1, "#38220f");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // تبقيع كبير ناعم (تفاوت التربة الطبيعية)
  for (let i = 0; i < 40; i++) {
    const cols = ["rgba(96,62,32,.20)", "rgba(30,16,6,.22)", "rgba(122,84,46,.14)", "rgba(16,8,3,.25)"];
    g.fillStyle = cols[(Math.random() * cols.length) | 0];
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 130, 26 + Math.random() * 80, Math.random() * 3, 0, 7);
    g.fill();
  }
  // صخور مدفونة: كتل رمادية-بنية بحواف مضيئة
  for (let i = 0; i < 46; i++) {
    const px = Math.random() * w, py = Math.random() * h;
    const rx = 5 + Math.random() * 16, ry = 4 + Math.random() * 11, rot = Math.random() * 3;
    g.save(); g.translate(px, py); g.rotate(rot);
    const tones = ["#5c4a36", "#4a3826", "#6b5844", "#3c2d1d"];
    g.fillStyle = tones[(Math.random() * tones.length) | 0];
    g.beginPath();
    for (let k = 0; k <= 7; k++) {
      const a2 = (k / 7) * Math.PI * 2;
      const rr0 = 1 + (hash2(i, k, 77) - 0.5) * 0.5;
      const vx = Math.cos(a2) * rx * rr0, vy = Math.sin(a2) * ry * rr0;
      if (k === 0) g.moveTo(vx, vy); else g.lineTo(vx, vy);
    }
    g.closePath(); g.fill();
    g.fillStyle = "rgba(220,190,150,.18)";
    g.beginPath(); g.ellipse(-rx * 0.25, -ry * 0.35, rx * 0.4, ry * 0.32, 0, 0, 7); g.fill();
    g.restore();
  }
  // شقوق داكنة متعرجة (تشققات الترب)
  g.strokeStyle = "rgba(10,5,2,.5)";
  g.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    let px = Math.random() * w, py = Math.random() * h;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath(); g.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      px += (Math.random() - 0.5) * 90; py += (Math.random() - 0.5) * 70;
      g.lineTo(px, py);
    }
    g.stroke();
  }
  // حبيبات دقيق كثيف (ملمس ترابي)
  for (let i = 0; i < 2200; i++) {
    const shades = ["#3a2410", "#54331a", "#2a1708", "#5f3d20", "#453019"];
    g.fillStyle = shades[(Math.random() * shades.length) | 0];
    const s = 1.5 + Math.random() * 4;
    g.fillRect(Math.random() * w, Math.random() * h, s, s * 0.7);
  }
  // حصى صغير بلمع
  for (let i = 0; i < 40; i++) {
    const px = Math.random() * w, py = Math.random() * h;
    const rx = 3 + Math.random() * 7, ry = 2 + Math.random() * 5;
    g.fillStyle = "#57503f";
    g.beginPath(); g.ellipse(px, py, rx, ry, Math.random() * 3, 0, 7); g.fill();
    g.fillStyle = "rgba(215,200,175,.3)";
    g.beginPath(); g.ellipse(px - rx * 0.25, py - ry * 0.3, rx * 0.45, ry * 0.4, 0, 0, 7); g.fill();
  }
  // جذور نازلة من السطح
  g.strokeStyle = "rgba(70,45,25,.5)";
  g.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const sx = Math.random() * w;
    let px = sx, py = 0;
    g.lineWidth = 2 + Math.random() * 2;
    g.beginPath(); g.moveTo(px, py);
    const segs = 3 + ((Math.random() * 3) | 0);
    for (let k = 0; k < segs; k++) {
      px += (Math.random() - 0.5) * 46;
      py += h * (0.08 + Math.random() * 0.14);
      g.quadraticCurveTo(px + (Math.random() - 0.5) * 30, py - 20, px, py);
    }
    g.stroke();
  }
  // ظل حواف (فينييت) أقوى لعمق المشهد
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(5,2,0,.6)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  // (بلا طبقات أفقية — تربة مرقشة مثل الصورة)
}

//  (خلية افتراضية كبيرة 60px) ----------
const NEST_DEF_CELL = 600; // العش ضخم (600px للخانة) — الغرف متباعدة والملكةة بقصرها الخاص
let view = { px: 0, py: 0 };
function clampZ(z) { return Math.min(24, Math.max(0.5, Number(z) || 1)); }
function viewZ() { return (G && G.nest && G.nest.viewZ == null) ? defZoom() : clampZ(G.nest.viewZ); }
function defZoom() {
  try {
    const b = metricsBase(1);
    return b.base < NEST_DEF_CELL ? Math.min(3.5, NEST_DEF_CELL / b.base) : 1;
  } catch { return 1; }
}
function metricsBase(z) {
  const r = cv.getBoundingClientRect();
  const W = Math.max(2, r.width), H = Math.max(2, r.height);
  const topPad = Math.max(96, Math.min(150, H * 0.24));
  const botPad = Math.max(72, Math.min(100, H * 0.18));
  const base = Math.max(14, Math.min((W - 8) / COLS, (H - topPad - botPad) / ROWS, 68));
  const cell = Math.max(12, Math.min(640, base * z));
  const q = findQueen();
  const fx = q ? q.x + 0.5 : COLS / 2, fy = q ? q.y + 0.5 : ROWS / 2;
  return { W, H, cell, base, topPad, botPad, baseOx: W / 2 - fx * cell, baseOy: H * 0.40 - fy * cell };
}
// ---------- التفاعل ----------
function gridMetrics() {
  const b = metricsBase(viewZ());
  const gridW = b.cell * COLS, gridH = b.cell * ROWS;
  let ox = b.baseOx + view.px, oy = b.baseOy + view.py;
  const m = 80;
  if (gridW > b.W) ox = Math.min(m, Math.max(b.W - gridW - m, ox));
  else ox = (b.W - gridW) / 2;
  if (gridH > b.H - 160) oy = Math.min(b.H - 140, Math.max(120 - gridH, oy));
  else oy = Math.min(b.H - gridH - 60, Math.max(b.topPad - 40, oy));
  return { W: b.W, H: b.H, cell: b.cell, ox, oy };
}
function normalizePan() {
  const m = gridMetrics();
  const b = metricsBase(viewZ());
  view.px += m.ox - (b.baseOx + view.px);
  view.py += m.oy - (b.baseOy + view.py);
}
// تقريب حول نقطة شاشة مع تثبيتها (إصبع القرصة/عجلة الفأرة/الأزرار)
function setZoom(nz, sx, sy, save = true) {
  nz = clampZ(nz);
  const r = cv.getBoundingClientRect();
  const px = (sx == null ? r.left + r.width / 2 : sx) - r.left;
  const py = (sy == null ? r.top + r.height * 0.4 : sy) - r.top;
  const m = gridMetrics();
  const gx = (px - m.ox) / m.cell, gy = (py - m.oy) / m.cell;
  G.nest.viewZ = nz;
  const b = metricsBase(nz);
  view.px = px - (b.baseOx + gx * b.cell);
  view.py = py - (b.baseOy + gy * b.cell);
  normalizePan();
  if (save) { try { API.saveGame(); } catch {} }
}
function resetNestView(save = true) {
  G.nest.viewZ = null;
  view.px = 0; view.py = 0;
  if (save) { try { API.saveGame(); } catch {} }
}
// ملاءمة الشبكة كاملة على الشاشة (زر ⤢) — عرض افتراضي يُظهر كل العش دفعة واحدة
export function fitGridView(save = true) {
  G.nest.viewZ = 1;
  view.px = 0; view.py = 0;
  normalizePan();
  if (save) { try { API.saveGame(); } catch {} }
}
function cellFromPoint(px, py) {
  const { cell, ox, oy } = gridMetrics();
  const x = Math.floor((px - ox) / cell);
  const y = Math.floor((py - oy) / cell);
  return inGrid(x, y) ? { x, y } : null;
}

function handleTap(px, py) {
  const hit = cellFromPoint(px, py);
  const panel = document.getElementById("roomPanel");
  const menu = document.getElementById("buildMenu");
  if (!hit) { selected = null; panel.hidden = true; return; }
  const { x, y } = hit;
  const c = cellAt(x, y);
  const job = jobAt(x, y);
  // وضع نقل الملكة: الصف السفلي فقط (معزلها) — أو غرفتها للإلغاء
  if (queenMove) {
    if (job) {
      const pct = Math.round((job.t / job.dur) * 100);
      API.toast(job.isUpgrade ? `🔨 الترقية جارية... ${pct}%` : `⛏️ الحفر جارٍ... ${pct}%`);
      return;
    }
    if (c) {
      if (c.kind === "queen") { cancelQueenMove(); openPanel(c); }
      else API.toast("🚚 الصف السفلي الفارغ فقط — أو غرفة الملكة للإلغاء");
      return;
    }
    if (y === 8 && (!c || c.kind === "tunnel")) moveQueenTo(x, y);
    else if (y === 8) API.toast("🚚 الصف السفلي الفارغ فقط — أو غرفة الملكة للإلغاء");
    else API.toast("🚚 غرفة الملكة بالصف السفلي فقط 👑");
    return;
  }
  if (job) {
    selected = { x, y };
    openJobPanel(job);
    return;
  }
  if (c) {
    selected = { x, y };
    if (c.kind === "tunnel" || c.kind === "entrance") {
      panel.hidden = true;
      API.toast(c.kind === "entrance" ? "🕳️ مدخل العش — منه نزلت إلى هنا" : "↔️ ممر يربط الغرف بالشبكة");
    } else {
      // زر الترقية ↑ على الخانة — ترقية مباشرة دون فتح اللوحة
      const m = gridMetrics();
      const ub = upgradeBadgePos(c, m.ox + x * m.cell, m.oy + y * m.cell, m.cell);
      if (ub && Math.hypot(px - ub.bx, py - ub.by) <= ub.r + 6) {
        requestUpgrade(c);
      } else {
        openPanel(c);
      }
    }
    return;
  }
  if (hasBuiltNeighbor(x, y)) {
    selected = { x, y };
    openBuildMenu(x, y);
  } else if (lastGhosts.some((g) => g.x === x && g.y === y)) {
    // موضع مرتّب مضيء ✨ (قد يكون بعيداً عن الشبكة — الوصلة تُبنى تلقائياً)
    selected = { x, y };
    openBuildMenu(x, y);
  } else {
    API.toast("⛏️ احفر في تراب ملاصق للأنفاق فقط");
  }
}

function costStr(n) { return `${n} 🍯`; }

export function openBuildMenu(x, y) {
  const menu = document.getElementById("buildMenu");
  const list = document.getElementById("buildList");
  list.innerHTML = "";
  const title = document.getElementById("buildTitle");
  title.textContent = NT("build_title") || `⛏️ حفر خلية جديدة`;
  const order = ["tunnel", "storage", "nursery", "workers", "soldiers", "train", "gene"];
  for (const kind of order) {
    const def = ROOM_DEFS[kind];
    const exists = roomLevel(kind) > 0 && kind !== "tunnel";
    if (kind === "train") {
      const need = trainBuildNeed();
      const un = trainUnlock();
      const ok = !exists && un.ok && G.store >= need.store && hasRares(need.rares);
      const gb = document.createElement("button");
      gb.className = "buildOpt";
      gb.disabled = !ok;
      const reason = exists ? (NT("built_done") || "مبني ✓") : !un.ok ? ("🔒 " + un.missing.join(" + ")) : roomDesc(kind);
      gb.innerHTML = `<span class="boIcon">${def.icon}</span>` +
        `<span class="boTxt"><b>${roomName(kind)}</b><small>${reason}</small></span>` +
        `<span class="boCost">${need.store}🍯 ${raresText(need.rares)}</span>`;
      if (ok) gb.onclick = () => startTrainDig(x, y);
      list.appendChild(gb);
      continue;
    }
    if (kind === "gene") {
      const need = geneBuildNeed();
      const ok = !exists && G.store >= need.store && hasRares(need.rares);
      const gb = document.createElement("button");
      gb.className = "buildOpt";
      gb.disabled = !ok;
      gb.innerHTML = `<span class="boIcon">${def.icon}</span>` +
        `<span class="boTxt"><b>${roomName(kind)}</b><small>${exists ? (NT("built_done") || "مبنية ✓") : roomDesc(kind)}</small></span>` +
        `<span class="boCost">${need.store}🍯 ${raresText(need.rares)}</span>`;
      if (ok) gb.onclick = () => startGeneDig(x, y);
      list.appendChild(gb);
      continue;
    }
    // الأنواع القابلة للتكرار: زر البناء يفتح دائماً ما لم تصل للحد — يعرض النسخ والتكلفة التالية
    if (isCopyable(kind)) {
      const mx = copyMax(kind);
      const count = copyCount(kind);
      const full = count >= mx;
      const num = full ? null : nextNum(kind);
      const need = full ? null : buildNeedFor(kind, num);
      const afford = !full && G.store >= need.store;
      const b = document.createElement("button");
      b.className = "buildOpt";
      b.disabled = full || !afford;
      const sub = full ? (NT("copies_done", { c: count, m: mx }) || `مكتمل ${count}/${mx} ✓`) :
        (afford ? `${roomDesc(kind)}` : (NT("need_honey", { n: need.store, h: Math.floor(G.store) }) || `تحتاج ${need.store} 🍯 (معك ${Math.floor(G.store)})`));
      b.innerHTML = `<span class="boIcon">${def.icon}</span>
        <span class="boTxt"><b>${roomName(kind)} — ${NT("copies_word") || "النسخ"}: ${count}/${mx}</b><small>${sub}</small></span>
        <span class="boCost">${full ? "—" : costStr(need.store) + (num > 1 ? ` (#${num})` : "")}</span>`;
      if (!full && afford) {
        b.onclick = () => startDig(x, y, kind, 1, false);
      }
      list.appendChild(b);
      continue;
    }
    const cost = def.build;
    const affordable = G.store >= cost && !exists;
    const b = document.createElement("button");
    b.className = "buildOpt";
    b.disabled = !affordable;
    b.innerHTML = `<span class="boIcon">${def.icon}</span>
      <span class="boTxt"><b>${roomName(kind)}</b><small>${exists ? (NT("built_done") || "مبنية ✓") : roomDesc(kind)}</small></span>
      <span class="boCost">${costStr(cost)}</span>`;
    if (!exists) {
      b.onclick = () => startDig(x, y, kind, 1, false);
    }
    list.appendChild(b);
  }
  menu.hidden = false;
  document.getElementById("roomPanel").hidden = true;
}

// طلب ترقية غرفة: يخصم التكلفة ويبدأ مهمة الترقية — يُستخدم من لوحة الغرفة ومن زر ↑ على الخانة
// يرجع true إن بدأت الترقية فعلاً (مع تنبيه مناسب في كل الحالات)
export function requestUpgrade(c) {
  const live = cellAt(c.x, c.y) || c;
  const def = ROOM_DEFS[live.kind];
  if (!def || (live.level || 1) >= (def.max || 5)) { API.toast("★ هذه الغرفة بأقصى مستوى!"); return false; }
  if (jobAt(live.x, live.y)) { API.toast("🔨 ترقية جارية هنا أصلاً..."); return false; }
  if (live.kind === "gene") {
    const need = geneUpNeed(live.level + 1);
    if (G.store < need.store || !hasRares(need.rares)) { API.toast("🧬 موارد نادرة غير كافية للترقية"); return false; }
    G.store -= need.store;
    payRares(need.rares);
    G.nest.jobs.push({ x: live.x, y: live.y, kind: live.kind, toLevel: live.level + 1, isUpgrade: true, t: 0, dur: DIG_SECS.upgrade + live.level * 2, paid: { store: need.store, rares: { ...need.rares } } });
  } else if (live.kind === "train") {
    const need = trainUpNeed(live.level + 1);
    if (G.store < need.store || !hasRares(need.rares)) { API.toast("🎖️ موارد نادرة غير كافية للترقية"); return false; }
    G.store -= need.store;
    payRares(need.rares);
    G.nest.jobs.push({ x: live.x, y: live.y, kind: live.kind, toLevel: live.level + 1, isUpgrade: true, t: 0, dur: DIG_SECS.upgrade + live.level * 3, paid: { store: need.store, rares: { ...need.rares } } });
  } else {
    const cost = def.up[live.level - 1];
    if (G.store < cost) { API.toast("🍯 طعام غير كافٍ"); return false; }
    G.store -= cost;
    G.nest.jobs.push({ x: live.x, y: live.y, kind: live.kind, toLevel: live.level + 1, isUpgrade: true, t: 0, dur: DIG_SECS.upgrade, paid: { store: cost, rares: {} } });
  }
  API.saveGame();
  API.sfx.hatch();
  return true;
}

export function openPanel(c) {
  const def = ROOM_DEFS[c.kind];
  const panel = document.getElementById("roomPanel");
  document.getElementById("buildMenu").hidden = true;
  const effect = effectText(c);
  const tag = isCopyable(c.kind) ? ` #${c.num || 1}` : "";
  document.getElementById("roomTitle").textContent = `${def.icon} ${roomName(c.kind)}${tag} — ${NT("level_word") || "مستوى"} ${c.level}`;
  document.getElementById("roomDesc").textContent = effect;
  // اختيار نوع البيض في غرفة الملكة
  const casteRow = document.getElementById("casteRow");
  const qmvBtn = document.getElementById("queenMoveBtn");
  if (c.kind === "queen") {
    casteRow.hidden = false;
    const focus = G.nest.focus || "worker";
    const bw = document.getElementById("casteWorkerBtn");
    const bs = document.getElementById("casteSoldierBtn");
    const bc = document.getElementById("casteScoutBtn");
    const sLock = !soldierUnlocked(), cLock = !scoutUnlocked();
    bw.classList.toggle("sel", focus === "worker");
    bs.classList.toggle("sel", focus === "soldier");
    bc.classList.toggle("sel", focus === "scout");
    bw.onclick = () => { G.nest.focus = "worker"; API.saveGame(); openPanel(cellAt(c.x, c.y) || c); };
    bs.onclick = () => {
      if (sLock) { API.toast("⚔️ ابنِ ثكنة الجنود أولاً لفتح بيض الجنود"); return; }
      G.nest.focus = "soldier"; API.saveGame(); openPanel(cellAt(c.x, c.y) || c);
    };
    bc.onclick = () => {
      if (cLock) { API.toast("🔭 رقِّ الحضانة للمستوى 2 لفتح بيض الكشاف"); return; }
      G.nest.focus = "scout"; API.saveGame(); openPanel(cellAt(c.x, c.y) || c);
    };
    bs.style.opacity = sLock ? 0.45 : 1;
    bc.style.opacity = cLock ? 0.45 : 1;
    if (qmvBtn) {
      qmvBtn.hidden = false;
      qmvBtn.disabled = false;
      qmvBtn.textContent = NT("queen_move", { n: QUEEN_MOVE_COST }) || `🚚 نقل الملكة لمكان آخر (${QUEEN_MOVE_COST} 🍯)`;
    }
    const fertBtn = document.getElementById("fertBtn");
    if (fertBtn) {
      fertBtn.hidden = false;
      fertBtn.textContent = API.fertilityText ? API.fertilityText() : "👑 خصوبة الملكة";
      fertBtn.onclick = () => { if (API.buyFertility && API.buyFertility()) openPanel(cellAt(c.x, c.y) || c); else if (API.fertilityText) fertBtn.textContent = API.fertilityText(); };
    }
  } else {
    casteRow.hidden = true;
    if (qmvBtn) qmvBtn.hidden = true;
    const fertBtn0 = document.getElementById("fertBtn");
    if (fertBtn0) fertBtn0.hidden = true;
  }
  const geneBtn = document.getElementById("geneOpenBtn");
  if (c.kind === "gene") {
    if (geneBtn) {
      geneBtn.hidden = false;
      geneBtn.onclick = () => { panel.hidden = true; API.openGene(); };
    }
  } else if (geneBtn) geneBtn.hidden = true;
  const trainBtn = document.getElementById("trainOpenBtn");
  if (c.kind === "train") {
    if (trainBtn) {
      trainBtn.hidden = false;
      trainBtn.onclick = () => { panel.hidden = true; API.openTrain(); };
    }
  } else if (trainBtn) trainBtn.hidden = true;
  const archerBtn = document.getElementById("archerBtn");
  if (c.kind === "soldiers") {
    if (archerBtn) {
      archerBtn.hidden = false;
      archerBtn.textContent = API.archeryText ? API.archeryText() : "🏹 تطوير الرماية";
      archerBtn.onclick = () => { if (API.buyArchery && API.buyArchery()) openPanel(cellAt(c.x, c.y) || c); else if (API.archeryText) archerBtn.textContent = API.archeryText(); };
    }
  } else if (archerBtn) archerBtn.hidden = true;
  const sackBtn = document.getElementById("sackBtn");
  if (c.kind === "workers") {
    if (sackBtn) {
      sackBtn.hidden = false;
      sackBtn.textContent = API.sacksText ? API.sacksText() : "🎒 تطوير الأكياس";
      sackBtn.onclick = () => { if (API.buySacks && API.buySacks()) openPanel(cellAt(c.x, c.y) || c); else if (API.sacksText) sackBtn.textContent = API.sacksText(); };
    }
  } else if (sackBtn) sackBtn.hidden = true;
  const upBtn = document.getElementById("roomUpgradeBtn");
  const maxed = c.level >= def.max;
  if (maxed) {
    upBtn.disabled = true;
    upBtn.textContent = NT("max_level") || "المستوى الأقصى ★★★";
  } else {
    const needTxt = c.kind === "gene" ? (() => { const nd = geneUpNeed(c.level + 1); return `${nd.store}🍯 ${raresText(nd.rares)}`; })()
      : c.kind === "train" ? (() => { const nd = trainUpNeed(c.level + 1); return `${nd.store}🍯 ${raresText(nd.rares)}`; })()
      : costStr(def.up[c.level - 1]);
    upBtn.disabled = false;
    upBtn.textContent = NT("upgrade_to", { n: c.level + 1, c: needTxt }) || `🔨 ترقية للمستوى ${c.level + 1} (${needTxt})`;
    upBtn.onclick = () => {
      if (requestUpgrade(c)) {
        panel.hidden = true;
        document.getElementById("buildMenu").hidden = true;
      } else {
        openPanel(cellAt(c.x, c.y) || c);
      }
    };
  }
  panel.hidden = false;
}

function effectText(c) {
  switch (c.kind) {
    case "queen": {
      const hp = Math.round(G.nest.queenHp || 0);
      const st = NT(G.nest.dormant ? "q_dying" : G.store > 0 ? "q_full" : "q_hungry")
        || (G.nest.dormant ? "تحتضر (أطعمها!)" : G.store > 0 ? "مشبعة" : "جائعة!");
      const sizeName = NT("qsize_" + c.level) || (["", "صغيرة", "واسعة", "كبيرة", "ضخمة", "إمبراطورية"][c.level] || "");
      const fert = fertilityLevel();
      const tempo = Math.max(1, Math.round(layIntervalSec()));
      const compPct = Math.round((layBoost() / (1 + 0.5 * fert) - 1) * 100);
      const compTxt = compPct > 2 ? (NT("eff_comp", { p: compPct }) || ` + تعويض الموتى ${compPct}%`) : "";
      const s = NT("eff_queen", { size: sizeName, lv: c.level, w: workerCap(), s: soldierCap(), c: scoutCap(), hp, st, tm: tempo, f: fert, lay: nurseryLayMult().toFixed(2), comp: compTxt, b: G.nest.brood.length, m: broodMax() });
      if (s) return s;
      return `غرفة ${sizeName} (مستوى ${c.level}/5) تكبر مع كل ترقية 👑 — تعيش الملكة هنا فقط ولا تخرج للسطح أبداً — السعة: 🐜 ${workerCap()} / ⚔️ ${soldierCap()} / 🔭 ${scoutCap()} — صحتها ${hp}% (${st}) — بيضة كل ~${tempo} ث (خصوبة ${fert}/3 + حضانة ×${nurseryLayMult().toFixed(2)}${compTxt}) — حضن ${G.nest.brood.length}/${broodMax()} — انقلها بزر النقل 🚚 لأي مكان ملاصق`;
    }
    case "storage": {
      const s = NT("eff_storage", { lv: c.level, tot: storageLevel(), bonus: storageLevel() * 100, cap: 500 + storageLevel() * 100, carry: storageBonus() });
      if (s) return s;
      return `هذه النسخة مستوى ${c.level} — المجموع ${storageLevel()} (سقف المخزون +${storageLevel() * 100} = ${500 + storageLevel() * 100} 🍯) — سعة حملك = الأساس + ${storageBonus()}`;
    }
    case "nursery": {
      const n = G.nest.brood.length, m = broodMax();
      const s = NT("eff_nursery", { lv: c.level, tot: nurseryLevel(), g: Math.round((Math.min(COPY_TUNING.growthCap, 0.7 + 0.25 * nurseryLevel()) - 1) * 100), gcap: Math.round((COPY_TUNING.growthCap - 1) * 100), lay: nurseryLayMult().toFixed(2), n, m, cap: scoutCap(), max: MAX_SCOUTS });
      if (s) return s;
      return `هذه النسخة مستوى ${c.level} — المجموع ${nurseryLevel()} (نمو +${Math.round((Math.min(COPY_TUNING.growthCap, 0.7 + 0.25 * nurseryLevel()) - 1) * 100)}% بحد ${Math.round((COPY_TUNING.growthCap - 1) * 100)}% + تبييض الملكة ×${nurseryLayMult().toFixed(2)}) — حضن: ${n}/${m} — سقف الكشافة ${scoutCap()}/${MAX_SCOUTS} 🔭`;
    }
    case "workers": {
      const s = NT("eff_workers", { lv: c.level, tot: workersLevel(), sp: workerSpeedMult().toFixed(2), spcap: COPY_TUNING.speedCap, cap: workerCap(), max: MAX_WORKERS, sk: (G.mods && G.mods.sacks) || 0 });
      if (s) return s;
      return `هذه النسخة مستوى ${c.level} — المجموع ${workersLevel()} (سرعة ×${workerSpeedMult().toFixed(2)} بحد ×${COPY_TUNING.speedCap}) — سقف العمال ${workerCap()}/${MAX_WORKERS} 🐜 — 🎒 أكياس كهرمانية +${(G.mods && G.mods.sacks) || 0}/3 حمل`;
    }
    case "soldiers": {
      const s = NT("eff_soldiers", { lv: c.level, tot: soldiersLevel(), g: soldiersLevel() * 25, gcap: Math.round((COPY_TUNING.growthCap - 1) * 100), cap: soldierCap(), max: MAX_SOLDIERS, ar: (G.mods && G.mods.archery) || 0 });
      if (s) return s;
      return `هذه النسخة مستوى ${c.level} — المجموع ${soldiersLevel()} (نمو +${soldiersLevel() * 25}% بحد ${Math.round((COPY_TUNING.growthCap - 1) * 100)}%) — سقف الجنود ${soldierCap()}/${MAX_SOLDIERS} ⚔️ — 🏹 رماية ${(G.mods && G.mods.archery) || 0}/3`;
    }
    case "gene": {
      const s = NT("eff_gene", { lv: c.level, beds: geneBeds(), inc: geneInc() });
      if (s) return s;
      return `🧬 مركز المستوى ${c.level}/7 — أسرّة ${geneBeds()} 🛏️ — حاضنات ${geneInc()} 🥚 — ترقيات تفتح جينات أقوى`;
    }
    case "train": {
      const st = trainState();
      const s = NT("eff_train", { lv: c.level, u: st.slots.length, sl: trainSlots() });
      if (s) return s;
      return `🎖️ مركز المستوى ${c.level}/5 — ساحات متزامنة ${st.slots.length}/${trainSlots()} — الرتب: 🌱 مبتدئ ← 🎖️ مدرب ← ⚔️ محترف ← 🔥 نخبة ← 👑 أسطوري`;
    }
    default: return "";
  }
}

export function focusGeneRoom() {
  const cell = Object.values(G.nest.cells).find((cc) => cc.kind === "gene");
  if (!cell) { API.toast("🧬 ابنِ مركز العلاج والتطور أولاً"); return false; }
  selected = { x: cell.x, y: cell.y };
  openPanel(cell);
  return true;
}
export function focusTrainRoom() {
  const cell = Object.values(G.nest.cells).find((cc) => cc.kind === "train");
  if (!cell) { API.toast("🎖️ ابنِ مركز التدريب العسكري أولاً"); return false; }
  selected = { x: cell.x, y: cell.y };
  openPanel(cell);
  return true;
}
// نوع بيض الملكة (للتحويل التلقائي عند جهوزية الثكنة)
export function eggFocus() { return G.nest.focus || "worker"; }
export function setEggFocus(kind) {
  if (!["worker", "soldier", "scout"].includes(kind)) return false;
  if ((kind === "soldier" && !soldierUnlocked()) || (kind === "scout" && !scoutUnlocked())) return false;
  G.nest.focus = kind;
  return true;
}
function startGeneDig(x, y) {
  if (roomLevel("gene") > 0) { API.toast("🧬 المركز مبني — واحدة فقط!"); return; }
  const need = geneBuildNeed();
  if (G.store < need.store || !hasRares(need.rares)) { API.toast("🧬 موارد نادرة غير كافية للمركز"); return; }
  if (!inGrid(x, y) || jobAt(x, y)) return;
  const tapped = cellAt(x, y);
  if ((tapped && tapped.kind !== "tunnel") || !hasBuiltNeighbor(x, y)) { API.toast("⛏️ احفر في تراب ملاصق للأنفاق فقط"); return; }
  const slot = findBuildSlot("gene");
  if (!slot) { API.toast("🏠 العش ممتلئ — رقِّ غرفك لتكبيرها"); return; }
  x = slot.x; y = slot.y;
  G.store -= need.store;
  payRares(need.rares);
  G.nest.jobs.push({ x, y, kind: "gene", toLevel: 1, isUpgrade: false, t: 0, dur: DIG_SECS.build + 8, paid: { store: need.store, rares: { ...need.rares } } });
  document.getElementById("buildMenu").hidden = true;
  API.saveGame();
  API.sfx.pickup();
  API.toast(`🧬 بدأ بناء ${ROOM_DEFS.gene.name}!`);
}
function startTrainDig(x, y) {
  const need = trainBuildNeed();
  const un = trainUnlock();
  if (roomLevel("train") > 0) { API.toast("🎖️ المركز مبني — واحد فقط!"); return; }
  if (!un.ok) { API.toast((NT("tr_locked") || "🎖️ المركز مقفل: ") + un.missing.join(" + ")); return; }
  if (!inGrid(x, y) || jobAt(x, y)) return;
  const tapped = cellAt(x, y);
  if ((tapped && tapped.kind !== "tunnel") || !hasBuiltNeighbor(x, y)) { API.toast("⛏️ احفر في تراب ملاصق للأنفاق فقط"); return; }
  const slot = findBuildSlot("train");
  if (!slot) { API.toast("🏠 العش ممتلئ — رقِّ غرفك لتكبيرها"); return; }
  x = slot.x; y = slot.y;
  if (G.store < need.store || !hasRares(need.rares)) { API.toast("🎖️ موارد نادرة غير كافي للمركز"); return; }
  G.store -= need.store;
  payRares(need.rares);
  G.nest.jobs.push({ x, y, kind: "train", toLevel: 1, isUpgrade: false, t: 0, dur: DIG_SECS.build + 14, paid: { store: need.store, rares: { ...need.rares } } });
  document.getElementById("buildMenu").hidden = true;
  API.saveGame();
  API.sfx.pickup();
  API.toast(`🎖️ بدأ بناء ${ROOM_DEFS.train.name}!`);
}
export function startDig(x, y, kind, toLevel, isUpgrade) {
  const def = ROOM_DEFS[kind];
  if (!def) return false;
  if (!inGrid(x, y) || jobAt(x, y)) return false;
  const tapped = cellAt(x, y);
  if (kind === "tunnel") {
    if (tapped) return false; // الممر موجود أصلاً
  } else if (tapped && tapped.kind !== "tunnel") return false;
  if (!hasBuiltNeighbor(x, y)) { API.toast("⛏️ احفر في تراب ملاصق للأنفاق فقط"); return false; }
  // الغرف تُبنى في مواضعها المرتبة فقط (ممر مركزي + جوانب مثل الصورة) — والممرات تُحفر بحرية
  if (kind !== "tunnel") {
    if (y === 8) { API.toast("👑 حرم الملكة معزولة — الغرف للصفوف العليا فقط"); return false; }
    const slot = findBuildSlot(kind);
    if (!slot) { API.toast("🏠 العش ممتلئ — رقِّ غرفك لتكبيرها بدل بناء جديد"); return false; }
    const sc = cellAt(slot.x, slot.y);
    if ((sc && sc.kind !== "tunnel") || jobAt(slot.x, slot.y)) { API.toast("⛏️ كل المواضع محجوزة حالياً"); return false; }
    x = slot.x; y = slot.y;
  }
  // النسخ المتعددة: الرقم الأصغر الحر + التكلفة × n — والحد الأقصى يمنع التاسعة
  let num = 1;
  let cost = def.build;
  if (isCopyable(kind)) {
    num = nextNum(kind);
    if (!num) { const mx2 = copyMax(kind); API.toast(`🏠 ${def.name} مكتمل ${mx2}/${mx2} — رقِّ غرفك لتكبيرها`); return false; }
    const need = buildNeedFor(kind, num);
    cost = need.store;
  }
  if (G.store < cost) { API.toast(`🍯 بناء ${def.name} #${num} يحتاج ${cost} (معك ${Math.floor(G.store)})`); return false; }
  G.store -= cost;
  const dur = kind === "tunnel" ? DIG_SECS.tunnel : DIG_SECS.build;
  G.nest.jobs.push({ x, y, kind, toLevel, isUpgrade: false, t: 0, dur, num, paid: { store: cost, rares: {} } });
  document.getElementById("buildMenu").hidden = true;
  API.saveGame();
  API.sfx.pickup();
  API.toast(isCopyable(kind) ? `⛏️ بدأ حفر ${def.name} #${num} (${cost} 🍯)!` : `⛏️ بدأ حفر ${ROOM_DEFS[kind].name}!`);
  return true;
}

// ---------- المحاكاة ----------
export function updateNest(dt) {
  // تقدّم الحفر والبناء
  for (let i = G.nest.jobs.length - 1; i >= 0; i--) {
    const j = G.nest.jobs[i];
    j.t += dt;
    if (j.t >= j.dur) {
      G.nest.jobs.splice(i, 1);
      if (j.isUpgrade) {
        const c = cellAt(j.x, j.y);
        if (c) {
          c.level = j.toLevel;
          const tag = isCopyable(c.kind) ? ` #${c.num || 1}` : "";
          API.toast(`${ROOM_DEFS[c.kind].icon} ${ROOM_DEFS[c.kind].name}${tag} أصبح مستوى ${c.level}!`);
          API.sfx.level();
        }
      } else {
        // النسخة تحتفظ برقمها المحجوز — والحفر القديم بلا رقم يُعطى أصغر رقم حر
        let num = Number(j.num) || null;
        if (!num && isCopyable(j.kind)) num = nextNum(j.kind) || 1;
        G.nest.cells[key(j.x, j.y)] = { x: j.x, y: j.y, kind: j.kind, level: 1, num: num || 1 };
        ensureShaftLink(j.x, j.y); // وصلة أفقية للممر المركزي حتى تبقى الشبكة واحدة مرتبة
        const tag = isCopyable(j.kind) ? ` #${num || 1}` : "";
        API.toast(`${ROOM_DEFS[j.kind].icon} اكتمل حفر ${ROOM_DEFS[j.kind].name}${tag}!`);
        API.sfx.level();
      }
      API.saveGame();
      try { if (document.hidden && API.pingLocal) API.pingLocal("nt_build", 30, 5); } catch {} // 📢 البناء اكتمل واللاعب خارج اللعبة
    }
  }
  // ---------- مركز العلاج والتطور: أسرّة شفاء وحاضنات جينية بتوقيت حقيقي ----------
  if (geneLevel() > 0) {
    const cl = clinic();
    for (let i = cl.beds.length - 1; i >= 0; i--) {
      const b = cl.beds[i];
      b.tLeft -= dt;
      if (b.tLeft <= 0) {
        cl.beds.splice(i, 1);
        try { API.clinicBedDone(b); } catch {}
        API.saveGame();
      }
    }
    for (let i = cl.inc.length - 1; i >= 0; i--) {
      const s = cl.inc[i];
      s.tLeft -= dt;
      if (s.tLeft <= 0) {
        cl.inc.splice(i, 1);
        try { API.clinicIncDone(s); } catch {}
        API.saveGame();
      }
    }
  }
  // ---------- مركز التدريب العسكري: ساحات تدريب بتوقيت حقيقي ----------
  if (trainLevel() > 0) {
    const ts = trainState();
    for (let i = ts.slots.length - 1; i >= 0; i--) {
      const s = ts.slots[i];
      s.tLeft -= dt;
      if (s.tLeft <= 0) {
        ts.slots.splice(i, 1);
        try { API.trainSlotDone(s); } catch {}
        API.saveGame();
      }
    }
  }
  // ---------- الملكة والتكاثر: إطعام، وضع بيض، نمو المراحل ----------
  G.nest.eatT -= dt;
  if (G.nest.eatT <= 0) {
    const gentle = (G.time || 0) < 300 || (G.level || 1) <= 2;
    G.nest.eatT = gentle ? 24 : 12;
    if (G.store > 0) {
      G.store -= 1;
      G.nest.queenHp = Math.min(100, (G.nest.queenHp || 0) + 6);
      if (G.nest.dormant && G.nest.queenHp > 30) {
        G.nest.dormant = false;
        API.toast("👑 الملكة استعادت عافيتها وعادت لوضع البيض!");
      }
    }
  }
  if (G.store <= 0) {
    G.nest.queenHp = Math.max(0, (G.nest.queenHp || 0) - dt * 1.5);
    if (G.nest.queenHp <= 0 && !G.nest.dormant) {
      G.nest.dormant = true;
      API.toast("⚠️ الملكة تحتضر جوعاً! خزّن طعاماً لإنقاذها");
      API.sfx.hit();
      try { if (document.hidden && API.pingLocal) API.pingLocal("nt_queen", 120, 4); } catch {} // 📢 الملكة تحتضر واللاعب خارج اللعبة
    }
  }
  // الملكة تبيض أسرع مع تطوير الخصوبة 👑 + تطوير الحضانة 🥚 + تعويض تلقائي عند نقص الجيش (من يموت يُعوَّض) — بطيئة بالبداية عمداً
  const layInterval = layIntervalSec();
  G.nest.layT -= dt;
  if (G.nest.layT <= 0) {
    G.nest.layT = layInterval;
    if (!G.nest.dormant && (G.nest.queenHp || 0) > 20 && G.nest.brood.length < broodMax() && G.store >= 2) {
      let kind = G.nest.focus || "worker";
      if (kind === "soldier" && !soldierUnlocked()) kind = "worker";
      if (kind === "scout" && !scoutUnlocked()) kind = "worker";
      G.store -= 2;
      // طلبات النخبة ⭐: البيضة الجاية من هذا النوع تتحوّل للمختبر وتفقس مطورة بلون مميز — ومن يخلص العدد يرجع عادياً
      let eg = larvaBonus();
      try {
        if (API && API.takeElite && API.takeElite(kind)) {
          const eb = (API.eliteBonus && API.eliteBonus(kind)) || {};
          eg = { ...(eg || {}), ...eb, elite: true };
        }
      } catch {}
      G.nest.brood.push({ id: (G.nest.broodId = (G.nest.broodId || 0) + 1), kind, stage: "egg", t: 25, ready: false, gene: eg });
      G.nest.layAnim = 1;
      API.sfx.pickup();
    }
  }
  if (G.nest.layAnim > 0) G.nest.layAnim = Math.max(0, G.nest.layAnim - dt * 1.5);
  if (G.nest.queenMunchT > 0) G.nest.queenMunchT = Math.max(0, G.nest.queenMunchT - dt * 1.8);
  // نمو المراحل: بيضة ← يرقة ← شرنقة ← بالغ (بطيء بالبداية 0.7، والتسريع من مجموع الحضانات بحد growthCap + الخصوبة 👑 + التعويض التلقائي — لازم تطوير للسرعة)
  const growth = Math.min(COPY_TUNING.growthCap, 0.7 + 0.25 * nurseryLevel()) * growthBoost();
  for (let i = G.nest.brood.length - 1; i >= 0; i--) {
    const b = G.nest.brood[i];
    let sp = growth;
    if (b.kind === "soldier") sp *= Math.min(COPY_TUNING.growthCap, 1 + 0.25 * soldiersLevel());
    b.t -= dt * sp;
    if (b.t > 0) continue;
    if (b.stage === "egg") { b.stage = "larva"; b.t = 30; }
    else if (b.stage === "larva") { b.stage = "pupa"; b.t = 35; }
    else {
      if (API.canAdd ? API.canAdd(b.kind) : API.totalAnts() < nestCap()) {
        G.nest.brood.splice(i, 1);
        const hb = Object.values(G.nest.cells).find((r) => r.kind === "nursery") || Object.values(G.nest.cells).find((r) => r.kind === "queen");
        if (hb) hatchFx.push({ x: hb.x, y: hb.y, t: 0 });
        API.spawnAdult(b.kind, b.gene);
        try { if (document.hidden && API.pingLocal) API.pingLocal("nt_army", 60, 2); } catch {} // 📢 جيشك جاهز واللاعب خارج اللعبة
      } else {
        b.t = 3;
        b.ready = true;
      }
    }
  }
  // جسيمات الغبار
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt;
  }
  // عاملات الداخل: طعام للملكة وبيض للحضانة
  try { updateCarriers(dt); } catch { /* قبل اكتمال الشبكة */ }
  // ومضات الفقس (بيضة تفقس: حلقة بيضاء + قشور تتطاير)
  for (let i = hatchFx.length - 1; i >= 0; i--) {
    hatchFx[i].t += dt;
    if (hatchFx[i].t > 0.9) hatchFx.splice(i, 1);
  }
  // نمل يتحرك في الأنفاق بعدد العمال (حياة داخل العش)
  const dots = G.nest.dots || (G.nest.dots = []);
  const want = Math.max(1, Math.min(5, API.workerCount()));
  while (dots.length < want) {
    // النمل الجوال لا يدخل غرفة الملكة المعزولة — فقط عاملات الطعام والبيض يخدمنها
    const ks = Object.keys(G.nest.cells).filter((k) => G.nest.cells[k].kind !== "queen");
    if (!ks.length) break;
    const c = G.nest.cells[ks[(Math.random() * ks.length) | 0]];
    dots.push({ fx: c.x, fy: c.y, tx: c.x, ty: c.y, sp: 1.6 + Math.random() * 1.2 });
  }
  if (dots.length > want) dots.length = want;
  for (const d of dots) {
    const dx = d.tx - d.fx, dy = d.ty - d.fy;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.08) {
      const cur = cellAt(d.tx, d.ty);
      const opts = [];
      if (cur) {
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          // غرفة الملكة معزولة عن التجوال — فقط العاملات (طعام/بيض) تدخلها
          const nc = cellAt(cur.x + ox, cur.y + oy);
          if (nc && nc.kind !== "queen") opts.push([cur.x + ox, cur.y + oy]);
        }
      }
      if (opts.length) {
        const [nx, ny] = opts[(Math.random() * opts.length) | 0];
        d.tx = nx; d.ty = ny;
      } else { d.fx = d.tx; d.fy = d.ty; }
    } else {
      const step = (d.sp * dt) / Math.max(0.01, dist);
      d.fx += dx * Math.min(1, step);
      d.fy += dy * Math.min(1, step);
    }
  }
  // غبار مستمر فوق مواقع الحفر
  for (const j of G.nest.jobs) {
    if (Math.random() < dt * 8 && parts.length < 120) {
      const { cell, ox, oy } = gridMetrics();
      parts.push({
        x: ox + j.x * cell + Math.random() * cell,
        y: oy + j.y * cell + Math.random() * cell * 0.5,
        vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40,
        life: 0.6 + Math.random() * 0.4, r: 2 + Math.random() * 3,
      });
    }
  }
}

// ---------- الرسم ----------
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const CHAMBER_SAND = {
  queen: "#e8b489", storage: "#dfb96f", nursery: "#e8cf9a",
  workers: "#d9b77c", soldiers: "#d8a878", gene: "#bfe8d8", train: "#cbb36a", tunnel: "#c9a06f", entrance: "#e8cf9a",
};
// نقش ثابت لكل خلية (حصى رملي لا يتغير بين الإطارات)
function hash2(x, y, i) {
  let h = (x * 374761393 + y * 668265263 + i * 974711) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// نقش الحصى الرملي يُرسم الآن داخل الفقاعات مباشرة

function drawNestSky(W, oy, cell, ox) {
  const skyH = oy - 8;
  if (skyH <= 0) return;
  const now = performance.now() / 1000;
// سقف ترابي داكن — العش تحت الأرض بالكامل (مثل الصورة: لا سماء زرقاء)
  const sg = ctx.createLinearGradient(0, 0, 0, skyH);
  sg.addColorStop(0, "#241408");
  sg.addColorStop(1, "#3a2210");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, skyH);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = i % 2 ? "rgba(15,8,3,.55)" : "rgba(135,95,55,.35)";
    ctx.beginPath();
    ctx.arc(hash2(i, 3, 61) * W, hash2(i, 5, 62) * skyH, 1 + hash2(i, 7, 63) * 4, 0, 7);
    ctx.fill();
  }
  // شريط ترابي داكن (حافة المقطع)
  ctx.fillStyle = "#2e1c0d";
  ctx.fillRect(0, skyH - 4, W, 12);
  ctx.fillStyle = "#170c04";
  ctx.fillRect(0, skyH + 8, W, 4);
  
  let ex = W / 2;
  for (const k in (G.nest.cells || {})) {
    const c = G.nest.cells[k];
    if (c.kind === "entrance") { ex = ox + (c.x + 0.5) * cell; break; }
  }
  const mw = Math.max(70, cell * 2.6), mh = Math.max(40, skyH * 0.55);
  const my = skyH - 2;
  const mg = ctx.createLinearGradient(0, my - mh, 0, my + 8);
  mg.addColorStop(0, "#a4713e");
  mg.addColorStop(1, "#5d3a1e");
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.ellipse(ex, my + 6, mw / 2, mh * 0.62, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "rgba(60,35,15,.5)";
  for (let i = 0; i < 14; i++) {
    const px = ex - mw / 2 + hash2(i, 7, 3) * mw;
    const py = my - hash2(i, 7, 4) * mh * 0.6;
    ctx.beginPath();
    ctx.arc(px, py, 2 + hash2(i, 7, 5) * 3, 0, 7);
    ctx.fill();
  }
  // فتحة المدخل الداكنة
  const ew = Math.max(26, cell * 0.62), eh = Math.max(22, cell * 0.5);
  ctx.fillStyle = "#120903";
  ctx.beginPath();
  ctx.ellipse(ex, my - 2, ew / 2, eh / 2, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(255,220,160,.15)";
  ctx.beginPath();
  ctx.ellipse(ex, my - eh * 0.22, ew * 0.32, eh * 0.2, 0, 0, 7);
  ctx.fill();
  // نمل على السطح يمشي حول التل
  for (let i = 0; i < 7; i++) {
    const px = ex + Math.sin(now * (0.3 + (i % 3) * 0.15) + i * 2.4) * (mw * 0.55 + (i % 2) * 30);
    const py = my - 4 - (i % 3) * 8 - hash2(i, 3, 8) * 14;
    drawMiniAnt(px, py, 2.2 + (i % 3) * 0.5, Math.cos(now * 0.5 + i) > 0 ? 0.2 : Math.PI - 0.2);
  }
  }

// خلايا التلميح المرتبة: أشباح الأنواع الناقصة + الموضع التالي لكل نوع قابل للتكرار (تحت الحد) — بلا دوائر عشوائية
export function slotHintCells() {
  const out = [];
  const used = new Set();
  for (const kind of ["storage", "nursery", "workers", "soldiers", "train", "gene"]) {
    if (roomLevel(kind) > 0 && !isCopyable(kind)) continue;
    if (isCopyable(kind) && copyCount(kind) >= copyMax(kind)) continue;
    const s = findBuildSlot(kind, used);
    if (!s) continue;
    const k = s.x + "," + s.y;
    if (used.has(k)) continue;
    used.add(k);
    out.push({ x: s.x, y: s.y, kind, level: 1 });
    if (out.length >= 6) break;
  }
  return out;
}
// معاينة شبح للغرف غير المبنيةة — من المواضع المرتبة فقط
function ghostPreviews() {
  const missing = new Set(["storage", "nursery", "workers", "soldiers", "train", "gene"].filter((k) => roomLevel(k) <= 0));
  return slotHintCells().filter((s) => missing.has(s.kind)).slice(0, 4);
}

export function focusFirstUpgrade() {
  const cells = Object.values(G.nest.cells).filter((c) => c.kind !== "tunnel" && c.kind !== "entrance");
  cells.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const cand = cells.find((c) => c.level < (ROOM_DEFS[c.kind].max || 5));
  if (!cand) { API.toast("★ كل الغرف بأقصى مستوى!"); return; }
  selected = { x: cand.x, y: cand.y };
  openPanel(cand);
  API.toast(`⬆️ ${ROOM_DEFS[cand.kind].name} — جاهزة للترقية`);
}

export function drawNest() {
  if (!ctx || !G.underground) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  const W = r.width, H = r.height;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (soilCv) ctx.drawImage(soilCv, 0, 0, W, H);

  const { cell, ox, oy } = gridMetrics();
  const cx = (x) => ox + x * cell;
  const cy = (y) => oy + y * cell;

  // الممرات: خطوط داكنة سميكة تحت الغرف، تتوقف عند حافة كل غرفة ولا تعبرها
  // تُرسم فقط بين خليتين متجاورتين مبنيتين (شبكة الممرات الفعلية في بيانات اللعبة)
  const tunnelSeg = (x1, y1, x2, y2, r1, r2, seed) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sx = x1 + ux * r1, sy = y1 + uy * r1;
    const ex = x2 - ux * r2, ey = y2 - uy * r2;
    if ((ex - sx) * ux + (ey - sy) * uy <= 2) return;
    const off = (hash2(seed, 5, 9) - 0.5) * cell * 0.3;
    const qx = (sx + ex) / 2 - uy * off;
    const qy = (sy + ey) / 2 + ux * off;
    const wMain = Math.max(14, cell * 0.52);
    ctx.lineCap = "round";
    // حافة حجرية فاتحة (تربة مكشوفة حول النفق مثل الصورة)
    ctx.strokeStyle = "#c7a06a";
    ctx.lineWidth = wMain;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(qx, qy, ex, ey);
    ctx.stroke();
    // جوف النفق الداكن
    ctx.strokeStyle = "#2a1a0c";
    ctx.lineWidth = wMain * 0.66;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(qx, qy, ex, ey);
    ctx.stroke();
    // لمعة سفلية خفيفة (عمق)
    ctx.strokeStyle = "rgba(190,150,100,.35)";
    ctx.lineWidth = wMain * 0.22;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(qx, qy, ex, ey);
    ctx.stroke();
    // حصى على حافتي النفق (تفتت الحفر)
    const n = Math.max(6, (len / Math.max(20, cell * 0.12)) | 0);
    for (let i = 0; i <= n; i++) {
      const tt = i / n;
      const ix = (1 - tt) * (1 - tt) * sx + 2 * (1 - tt) * tt * qx + tt * tt * ex;
      const iy = (1 - tt) * (1 - tt) * sy + 2 * (1 - tt) * tt * qy + tt * tt * ey;
      for (const sd of [-1, 1]) {
        if (hash2(seed, i, sd + 5) < 0.35) continue;
        const px = ix + -uy * sd * wMain * (0.5 + hash2(seed, i, sd) * 0.25);
        const py = iy + ux * sd * wMain * (0.5 + hash2(seed, i, sd + 2) * 0.25);
        ctx.fillStyle = ((i + sd) % 2) ? "rgba(20,10,4,.85)" : "rgba(122,84,48,.8)";
        ctx.beginPath();
        ctx.arc(px, py, 0.8 + hash2(seed, i, sd + 7) * Math.max(1.2, cell * 0.02), 0, 7);
        ctx.fill();
      }
    }
  };
  
  for (const k in G.nest.cells) {
    const c = G.nest.cells[k];
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (!inGrid(nx, ny)) continue;
      const n2 = cellAt(nx, ny);
      if (!n2) continue;
      tunnelSeg(cx(c.x) + cell / 2, cy(c.y) + cell / 2, cx(nx) + cell / 2, cy(ny) + cell / 2,
        chamberRadius(c, cell) * 0.92, chamberRadius(n2, cell) * 0.92, c.x * 17 + c.y * 41);
    }
  }

  // عمود المدخل: بئر محفورة نحو السطح مع شعاع ضوء نازل
  for (const k in G.nest.cells) {
    const c = G.nest.cells[k];
    if (c.kind !== "entrance") continue;
    const ex = cx(c.x) + cell / 2;
    const top = oy - 52, bot = top + 52 + cell * 0.3;
    // هالة ضوء السطح
    const glow = ctx.createRadialGradient(ex, top, 4, ex, top, cell * 1.1);
    glow.addColorStop(0, "rgba(255,240,200,.85)");
    glow.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(ex - cell, top - cell, cell * 2, cell * 2);
    // جدار البئر
    ctx.fillStyle = "#241408";
    rr(ctx, ex - cell * 0.2, top, cell * 0.4, bot - top, 8);
    ctx.fill();
    // شعاع ضوء داخل البئر
    const beam = ctx.createLinearGradient(0, top, 0, bot);
    beam.addColorStop(0, "rgba(255,240,200,.75)");
    beam.addColorStop(1, "rgba(255,240,200,.08)");
    ctx.fillStyle = beam;
    rr(ctx, ex - cell * 0.11, top, cell * 0.22, bot - top, 6);
    ctx.fill();
    ctx.fillStyle = "#8a6a42";
    rr(ctx, ex - cell * 0.2, bot - 8, cell * 0.4, 8, 4);
    ctx.fill();
    ctx.font = `${Math.round(cell * 0.3)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText("⬆️", ex, top + 22);
    ctx.fillStyle = "#ffe9bd";
    ctx.font = "bold 11px Tahoma";
    ctx.fillText("السطح", ex, top - 6);
  }

  // السماء والسطح (تل + مدخل + زينة) فوق التربة
  drawNestSky(W, oy, cell, ox);

  // الغرف
  barSpots = [];
  for (const k in G.nest.cells) {
    const c = G.nest.cells[k];
    drawChamber(c, cx(c.x), cy(c.y), cell, false);
  }
  // أشباح الغرف غير المبنيةة (مقفللة 🔒 مثل الصورة)
  try {
    lastGhosts = slotHintCells();
    const ghosts = ghostPreviews();
    for (const gh of ghosts) {
      drawChamber(gh, cx(gh.x), cy(gh.y), cell, true);
    }
  } catch { lastGhosts = []; }
  // أعمال الحفر والترقية
  for (const j of G.nest.jobs) {
    drawJob(j, cx(j.x), cy(j.y), cell);
  }
  // ومضات الفقس: حلقة بيضاء تتوسع + قشور تتطاير
  for (const h of hatchFx) {
    const hx = cx(h.x) + cell / 2, hy = cy(h.y) + cell / 2;
    const k = h.t / 0.9;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy, cell * (0.2 + k * 0.6), 0, 7);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (let si = 0; si < 6; si++) {
      const a = (si / 6) * Math.PI * 2 + h.x;
      const d = cell * (0.15 + k * 0.55);
      ctx.beginPath();
      ctx.arc(hx + Math.cos(a) * d, hy + Math.sin(a) * d, cell * 0.05 * (1 - k * 0.5), 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  // نمل حي يمشي في الأنفاق: بطن + صدر + رأس + أرجل متموجة
  const dots = G.nest.dots || [];
  const nowMs = performance.now();
  for (const d of dots) {
    const px = ox + (d.fx + 0.5) * cell;
    const py = oy + (d.fy + 0.5) * cell;
    const ang = Math.atan2(d.ty - d.fy, d.tx - d.fx);
    const u = cell * 0.07;
    const wig = Math.sin(nowMs / 110 + (d.fx + d.fy) * 9);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = "#241408";
    ctx.beginPath();
    ctx.ellipse(-u * 1.6, 0, u * 1.7, u * 1.1, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(u * 0.4, 0, u * 1.0, u * 0.8, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(u * 1.7, 0, u * 0.75, 0, 7);
    ctx.fill();
    // أرجل
    ctx.strokeStyle = "#241408";
    ctx.lineWidth = Math.max(1, u * 0.28);
    for (let li = -1; li <= 1; li++) {
      ctx.beginPath();
      ctx.moveTo(li * u * 0.9, 0);
      ctx.lineTo(li * u * 0.9 + u * 0.5, u * (1.5 + wig * 0.5 * li));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(li * u * 0.9, 0);
      ctx.lineTo(li * u * 0.9 + u * 0.5, -u * (1.5 - wig * 0.5 * li));
      ctx.stroke();
    }
    ctx.restore();
  }

  // عاملات الداخل: نملات مفصلة تحمل 🌾 للملكةة و🥚 للحضانة
  const carriers = G.nest.carriers || [];
  for (const cd of carriers) {
    const px = ox + (cd.fx + 0.5) * cell;
    const py = oy + (cd.fy + 0.5) * cell;
    const ang = cd.path.length ? Math.atan2(cd.path[0][1] - cd.fy, cd.path[0][0] - cd.fx) : 0;
    const u = cell * 0.088;
    const cwig = Math.sin(nowMs / 90 + cd.fx * 5);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = "#2b1408";
    ctx.beginPath();
    ctx.ellipse(-u * 1.5, 0, u * 1.6, u * 1.05, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(u * 0.4, 0, u * 0.95, u * 0.75, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(u * 1.6, 0, u * 0.7, 0, 7);
    ctx.fill();
    // قرنا استشعار
    ctx.strokeStyle = "#2b1408";
    ctx.lineWidth = Math.max(1, u * 0.22);
    ctx.beginPath();
    ctx.moveTo(u * 2.1, u * 0.25);
    ctx.lineTo(u * 2.9, u * (0.9 + cwig * 0.2));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(u * 2.1, -u * 0.25);
    ctx.lineTo(u * 2.9, -u * (0.9 - cwig * 0.2));
    ctx.stroke();
    // أرجل سريعة
    ctx.lineWidth = Math.max(1, u * 0.26);
    for (let li = -1; li <= 1; li++) {
      ctx.beginPath();
      ctx.moveTo(li * u * 0.8, 0);
      ctx.lineTo(li * u * 0.8 + u * 0.45, u * (1.6 + cwig * 0.5 * li));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(li * u * 0.8, 0);
      ctx.lineTo(li * u * 0.8 + u * 0.45, -u * (1.6 - cwig * 0.5 * li));
      ctx.stroke();
    }
    ctx.restore();
    if (cd.has) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = `${Math.round(cell * 0.24)}px serif`;
      ctx.fillText(cd.has === "food" ? "🌾" : "🥚", px, py - cell * 0.13);
      ctx.restore();
    }
  }
  // فتحات البناء: دائرة متقطعة + "+" + أقل تكلفة — فقط على المواضع المرتبة (بلا فوضى دوائر)
  {
    const ghosts = new Set();
    try { for (const gh of ghostPreviews()) ghosts.add(gh.x + "," + gh.y); } catch {}
    let hints = [];
    try { hints = slotHintCells(); } catch {}
    const minCost = Math.min(ROOM_DEFS.tunnel.build, ROOM_DEFS.storage.build, ROOM_DEFS.nursery.build, ROOM_DEFS.workers.build, ROOM_DEFS.soldiers.build);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const hcell of hints) {
      {
        const x = hcell.x, y = hcell.y;
        const ex = cellAt(x, y);
        if ((ex && ex.kind !== "tunnel") || jobAt(x, y)) continue;
        if (ghosts.has(x + "," + y)) continue;
        const px = cx(x) + cell / 2, py = cy(y) + cell / 2;
        const sr = Math.max(7, cell * 0.30);
        const pulse = 0.5 + Math.sin(performance.now() / 400 + x * 2 + y) * 0.2;
        ctx.strokeStyle = `rgba(255, 217, 61, ${pulse})`;
        ctx.lineWidth = Math.max(2, cell * 0.045);
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(px, py, sr, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
        if (cell >= 30) {
          ctx.fillStyle = `rgba(255, 233, 189, ${0.55 + pulse * 0.4})`;
          ctx.font = `900 ${Math.round(cell * 0.3)}px Tahoma`;
          ctx.fillText("+", px, py - (cell >= 44 ? cell * 0.13 : 0));
          if (cell >= 44) {
            ctx.font = `900 ${Math.max(9, Math.round(cell * 0.13))}px Tahoma`;
            ctx.fillText(`بناء ${minCost}🍯`, px, py + cell * 0.24);
          }
        }
      }
    }
    ctx.restore();
  }

  // التحديد: إطار أبيض داخل الخانة (لا يتجاوز حدودها)
  if (selected && inGrid(selected.x, selected.y)) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 3;
    rr(ctx, cx(selected.x) + 3, cy(selected.y) + 3, cell - 6, cell - 6, 10);
    ctx.stroke();
    ctx.restore();
  }

  // جسيمات الغبار
  ctx.fillStyle = "#c9a06f";
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
    ctx.fillStyle = "#c9a06f";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// توزيع الحضن: بجانب الملكة بيضات ضعف مستواها (2 ثم 4... حتى 10 — أكثر من 8 بالترقيات)، والباقي في الحضانات (4 لكل غرفة)
function queenEggCount() { return Math.min((G.nest.brood || []).length, Math.max(2, queenLevel() * 2)); }
function broodForRoom(c) {
  const all = G.nest.brood || [];
  if (c.kind === "queen") return all.slice(0, queenEggCount());
  const rest = all.slice(queenEggCount());
  const nurses = Object.values(G.nest.cells)
    .filter((r) => r.kind === "nursery")
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const idx = nurses.indexOf(c);
  if (idx < 0) return [];
  return rest.slice(idx * 4, idx * 4 + 4);
}

// رسم مرحلة نمو واحدة (تتحرك!)
function drawBrood(b, bx, by, s, n) {
  const now = performance.now() / 1000;
  ctx.save();
  ctx.textAlign = "center";
  if (b.stage === "egg") {
    // بيضة بيضاء تنبض
    const p = 1 + Math.sin(now * 3 + b.id) * 0.12;
    ctx.globalAlpha = 0.9 + Math.sin(now * 3 + b.id) * 0.1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(bx, by, s * 0.7 * p, s * p, 0, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(190,160,110,.8)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(bx - s * 0.2, by - s * 0.25, s * 0.18, s * 0.22, 0, 0, 7);
    ctx.fill();
  } else if (b.stage === "larva") {
    // يرقة تتلوى: 4 حلقات بموجة متحركة
    ctx.fillStyle = "#f3e3c2";
    ctx.strokeStyle = "#c9a86f";
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      const off = Math.sin(now * 7 + b.id + k * 1.3) * s * 0.35;
      const px = bx + (k - 1.5) * s * 0.75;
      ctx.beginPath();
      ctx.arc(px, by + off, s * (0.42 - k * 0.04), 0, 7);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#8a5a2a";
    ctx.beginPath();
    ctx.arc(bx + s * 1.35, by + Math.sin(now * 7 + b.id + 4) * s * 0.35, s * 0.22, 0, 7);
    ctx.fill();
  } else {
    // شرنقة بنية تهتز كلما اقترب الفقس، وتلمع ذهبياً عند انتظار مكان
    const prog = 1 - Math.min(1, (b.t || 1) / 35);
    ctx.translate(bx, by);
    ctx.rotate(Math.sin(now * (2 + prog * 6) + b.id) * 0.12 * (0.3 + prog));
    ctx.fillStyle = "#8a5f36";
    ctx.strokeStyle = b.ready ? "#ffd93d" : "#5d3d1d";
    ctx.lineWidth = b.ready ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.65, s, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,235,190,.5)";
    ctx.lineWidth = 1.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, k * s * 0.45);
      ctx.quadraticCurveTo(0, k * s * 0.45 + s * 0.15, s * 0.4, k * s * 0.45);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// الملكة الكبيرة: بطن مخطط بالذهب ينبض + تاج متوهج + ندوب أجنحة + وسادة مخملية،
// تقضم الطعام (انحناءة + فتات) وتضع بيضة أمامك — تكبر مع مستوى الغرفة
function drawQueenBig(x, y, cell, level = 1) {
  const now = performance.now() / 1000;
  const gs = 1 + 0.12 * (level - 1);
  const cxp = x + cell / 2, cyp = y + cell * 0.52;
  const breathe = 1 + Math.sin(now * 2.2) * 0.1;
  const munch = Math.min(1, G.nest.queenMunchT || 0);
  const dip = munch * Math.sin(now * 30) * cell * 0.008;
  const weak = G.nest.dormant;
  ctx.save();
  ctx.globalAlpha = weak ? 0.55 + Math.sin(now * 5) * 0.15 : 1;
  ctx.translate(cxp, cyp + dip);
  ctx.scale(gs * 0.72, gs * 0.72); // الملكة كبيرة ظاهرة في قصرها مثل الصورة 👑
  ctx.translate(-cxp, -cyp);
  // وسادة مخملية ملكية تحتها
  ctx.fillStyle = weak ? "#3a3a3a" : "#7a1e2e";
  ctx.beginPath();
  ctx.ellipse(cxp - cell * 0.05, cyp + cell * 0.16, cell * 0.34, cell * 0.13, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = weak ? "#222" : "#d9a83f";
  ctx.lineWidth = 2;
  ctx.stroke();
  // البطن الكبير المخطط بالذهب (ينبض)
  ctx.fillStyle = weak ? "#5a5a5a" : "#7a2e1a";
  ctx.beginPath();
  ctx.ellipse(cxp - cell * 0.16, cyp, cell * 0.2 * breathe, cell * 0.14, -0.2, 0, 7);
  ctx.fill();
  ctx.strokeStyle = "#3d1508";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = weak ? "rgba(150,150,150,.5)" : "rgba(255,215,80,.8)";
  ctx.lineWidth = 2;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(cxp - cell * 0.3, cyp + k * cell * 0.05);
    ctx.quadraticCurveTo(cxp - cell * 0.16, cyp + k * cell * 0.05 + cell * 0.03, cxp - cell * 0.03, cyp + k * cell * 0.05);
    ctx.stroke();
  }
  // ندوب الأجنحة — الملكة الحقيقية تفقد أجنحتها بعد التأسيس
  ctx.fillStyle = weak ? "rgba(140,140,140,.5)" : "rgba(255,250,235,.55)";
  ctx.beginPath();
  ctx.ellipse(cxp + cell * 0.02, cyp - cell * 0.09, cell * 0.07, cell * 0.035, -0.5, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cxp + cell * 0.12, cyp - cell * 0.09, cell * 0.07, cell * 0.035, 0.5, 0, 7);
  ctx.fill();
  // الصدر والرأس
  ctx.fillStyle = weak ? "#555" : "#8a3a12";
  ctx.beginPath(); ctx.arc(cxp + cell * 0.08, cyp, cell * 0.09, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cxp + cell * 0.22, cyp - cell * 0.02, cell * 0.1, 0, 7); ctx.fill();
  // العيون
  ctx.fillStyle = "#141414";
  ctx.beginPath(); ctx.arc(cxp + cell * 0.25, cyp - cell * 0.05, cell * 0.025, 0, 7); ctx.fill();
  // التاج (يتوهج بقوة لحظة القضم 👑)
  const glow = 0.5 + Math.sin(now * 3) * 0.2 + munch * 0.6;
  ctx.save();
  ctx.shadowColor = "#ffd93d";
  ctx.shadowBlur = 12 * glow + 6;
  ctx.fillStyle = "#ffd93d";
  ctx.strokeStyle = "#8a6a00";
  ctx.lineWidth = 1.5;
  const ty = cyp - cell * 0.17;
  ctx.beginPath();
  ctx.moveTo(cxp + cell * 0.13, ty);
  ctx.lineTo(cxp + cell * 0.13, ty - cell * 0.07);
  ctx.lineTo(cxp + cell * 0.17, ty - cell * 0.03);
  ctx.lineTo(cxp + cell * 0.21, ty - cell * 0.08);
  ctx.lineTo(cxp + cell * 0.25, ty - cell * 0.03);
  ctx.lineTo(cxp + cell * 0.29, ty - cell * 0.07);
  ctx.lineTo(cxp + cell * 0.29, ty);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore(); // نهاية توهج التاج
  // الأرجل الست تتحرك
  ctx.strokeStyle = weak ? "#333" : "#3d1508";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    for (const sd of [-1, 1]) {
      const wig = Math.sin(now * 5 + i * 2 + sd) * cell * 0.02;
      ctx.beginPath();
      ctx.moveTo(cxp + cell * (0.02 + i * 0.07), cyp + sd * cell * 0.06);
      ctx.lineTo(cxp + cell * (0.02 + i * 0.07) + cell * 0.1, cyp + sd * cell * 0.17 + wig);
      ctx.stroke();
    }
  }
  // بيضة لحظة الوضع
  if (G.nest.layAnim > 0) {
    ctx.globalAlpha = G.nest.layAnim;
    ctx.fillStyle = "#fdf6e3";
    ctx.beginPath();
    ctx.ellipse(cxp - cell * 0.16, cyp + cell * 0.2 * (1 - G.nest.layAnim) + cell * 0.05, cell * 0.05, cell * 0.065, 0, 0, 7);
    ctx.fill();
    ctx.globalAlpha = weak ? 0.55 : 1;
  }
  // فتات الطعام يتطاير لحظة القضم
  if (munch > 0) {
    ctx.fillStyle = `rgba(232,195,61,${0.85 * munch})`;
    for (let fi = 0; fi < 3; fi++) {
      const fa = now * 6 + fi * 2.1;
      const fr = cell * 0.16 * (1 - munch * 0.5);
      ctx.beginPath();
      ctx.arc(cxp + cell * 0.28 + Math.cos(fa) * fr, cyp + cell * 0.02 + Math.sin(fa * 1.3) * fr * 0.6, cell * 0.02, 0, 7);
      ctx.fill();
    }
  }
  ctx.restore();
}

// أسماء قصيرة للافتات (تطابق الصورة المرجعية)
const SHORT_NAMES = {
  storage: "مخزن الطعام", nursery: "حضانة البيض", workers: "مسكن العمال",
  soldiers: "ثكنة الجنود", queen: "غرفة الملكة", train: "مركز التدريب",
  gene: "مركز العلاج", tunnel: "ممر", entrance: "المدخل",
};
// موضع زر الترقية ↑ (الزاوية السفلى اليمنى داخل الخانة) — يُستخدم للرسم واللمس معاً
// يرجع null إن كان الزر مخفياً (تصغير شديد/أقصى مستوى/عمل جارٍ)
export function upgradeBadgePos(c, x, y, cell) {
  if (c.kind === "tunnel" || c.kind === "entrance") return null;
  if (cell < NEST_LAY.btnMinPx) return null;
  if ((c.level || 1) >= (ROOM_DEFS[c.kind].max || 5)) return null;
  if (jobAt(c.x, c.y)) return null;
  const R = chamberRadius(c, cell);
  const cx0 = x + cell / 2, cy0 = y + cell / 2;
  const r = Math.max(10, Math.min(56, Math.round(cell * 0.16)));
  return { bx: cx0 + R * 0.75, by: cy0 + R * 0.75, r };
}
function drawUpgradeBadge(bx, by, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, 7);
  const gg = ctx.createLinearGradient(bx - r, by - r, bx + r, by + r);
  gg.addColorStop(0, "#4be37a");
  gg.addColorStop(1, "#1d8a3d");
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${Math.round(r * 1.1)}px Tahoma`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("↑", bx, by + 1);
  ctx.restore();
}
function fmtRemain(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}ث`;
  return `${(sec / 60) | 0}:${String(sec % 60).padStart(2, "0")}`;
}
// لافتة الاسم: شريط صغير أعلى الخانة — يُقص النص إن طال بدل أن يُخفى (لا إخفاء أبداً)
function fitText(text, maxW, font) {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxW) return text;
  const ell = "…";
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ctx.measureText(text.slice(0, mid) + ell).width <= maxW) lo = mid + 1;
    else hi = mid;
  }
  return text.slice(0, Math.max(0, lo - 1)) + ell;
}
// مواضع اللافتات المرسومة هذا الإطار (لمنع التداخل) — تُصفّر مع كل رسمة
let barSpots = [];
// آخر الأشباح المعروضة (مواضع مرتبة قابلة للنقر حتى لو بعيدة عن الشبكة)
let lastGhosts = [];
function drawNameBar(cx0, topY, cw, cell, name, icon, locked) {
  const bh = Math.max(15, Math.min(84, Math.round(cell * 0.26)));
  const fs = Math.max(9, Math.min(40, Math.round(bh * 0.52)));
  const font = `900 ${fs}px Tahoma`;
  const raw = locked ? `🔒 ${name}` : `${icon} ${name}`;
  const label = fitText(raw, cw - 10, font);
  const bw = Math.min(cw - 2, ctx.measureText(label).width + 12);
  const bx = cx0 - bw / 2, by = topY;
  // منع تداخل اللافتات: إن اصطدمت بلافتة مرسومة هذا الإطار تُتجاهل (الترتيب أولاً)
  for (const s of barSpots) {
    if (Math.abs(s.x - cx0) < (s.w + bw) / 2 - 2 && Math.abs(s.y - (by + bh / 2)) < (s.h + bh) / 2 - 2) return 0;
  }
  barSpots.push({ x: cx0, y: by + bh / 2, w: bw, h: bh });
  ctx.save();
  ctx.fillStyle = "rgba(15,8,3,.55)";
  rr(ctx, bx + 1.5, by + 2, bw, bh, 7);
  ctx.fill();
  const grd = ctx.createLinearGradient(0, by, 0, by + bh);
  grd.addColorStop(0, "#6e4a26");
  grd.addColorStop(0.5, "#4e3013");
  grd.addColorStop(1, "#3a2210");
  ctx.fillStyle = grd;
  rr(ctx, bx, by, bw, bh, 7);
  ctx.fill();
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 1.5;
  rr(ctx, bx, by, bw, bh, 7);
  ctx.stroke();
  ctx.fillStyle = "#ffe9bd";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx0, by + bh / 2 + 1);
  ctx.restore();
  return bh;
}
// شارة رقم النسخة #N — زاوية الغرفة اليسرى العليا دائماً
function drawNumBadge(cx0, cy0, R, cell, num) {
  if (!num || num <= 1) return;
  const fs = Math.max(9, Math.min(22, Math.round(cell * 0.11)));
  ctx.save();
  ctx.font = `900 ${fs}px Tahoma`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(25,12,4,.85)";
  const tx = cx0 - R * 0.9, ty = cy0 - R * 0.55;
  ctx.strokeText("#" + num, tx, ty);
  ctx.fillStyle = "rgba(245,230,196,.9)";
  ctx.fillText("#" + num, tx, ty);
  ctx.restore();
}
// نملة صغيرة للزينة (سطح/جنود مصطفون)
function drawMiniAnt(px, py, s, ang, col = "#2b1408") {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(-s * 1.5, 0, s * 1.5, s, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 1.5, 0, s * 0.7, 0, 7);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1, s * 0.3);
  for (let li = -1; li <= 1; li++) {
    ctx.beginPath();
    ctx.moveTo(li * s * 0.7, 0);
    ctx.lineTo(li * s * 0.7, s * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(li * s * 0.7, 0);
    ctx.lineTo(li * s * 0.7, -s * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}
// راية حرب حمراء للثكنة والتدريب
function drawBanner(px, py, h, glyph = "🐜") {
  ctx.save();
  ctx.strokeStyle = "#3a2210";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - h);
  ctx.stroke();
  ctx.fillStyle = "#a02020";
  ctx.beginPath();
  ctx.moveTo(px, py - h);
  ctx.lineTo(px + h * 0.42, py - h * 0.85);
  ctx.lineTo(px, py - h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffd93d";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = `${Math.round(h * 0.32)}px serif`;
  ctx.textAlign = "center";
  ctx.fillText(glyph, px + h * 0.14, py - h * 0.78);
  ctx.restore();
}
// ديكور داخلي لكل نوع غرفة (يُرسم مقصوصاً داخل الفقاعة)
function drawRoomInterior(c, cx0, cy0, R, cell) {
  const now = performance.now() / 1000;
  ctx.save();
  if (c.kind === "storage") {
    // رفوف خشبية + أكوام بذور وتفاح أحمر
    ctx.fillStyle = "#5d3a1a";
    ctx.fillRect(cx0 - R * 0.8, cy0 + R * 0.1, R * 1.6, R * 0.12);
    ctx.fillRect(cx0 - R * 0.8, cy0 + R * 0.5, R * 1.6, R * 0.1);
    // كومة محصول: تلة رملي تتوسطه البذور مثل الصورة
    ctx.fillStyle = "#8a5f2e";
    ctx.beginPath();
    ctx.ellipse(cx0, cy0 + R * 0.42, R * 0.62, R * 0.3, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,230,170,.25)";
    ctx.beginPath();
    ctx.ellipse(cx0 - R * 0.15, cy0 + R * 0.32, R * 0.35, R * 0.14, -0.3, 0, 7);
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      const px = cx0 - R * 0.7 + hash2(c.x, i, 21) * R * 1.4;
      const py = cy0 + R * 0.02 + hash2(c.x, i, 22) * R * 0.08;
      ctx.fillStyle = i % 3 ? "#e8c33d" : "#d8a020";
      ctx.beginPath();
      ctx.ellipse(px, py, cell * 0.05, cell * 0.07, 0, 0, 7);
      ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const px = cx0 - R * 0.65 + hash2(c.x, i, 23) * R * 1.3;
      const py = cy0 + R * 0.38 + hash2(c.x, i, 24) * R * 0.08;
      ctx.fillStyle = "#c22";
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.075, 0, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.beginPath();
      ctx.arc(px - cell * 0.02, py - cell * 0.02, cell * 0.02, 0, 7);
      ctx.fill();
    }
  } else if (c.kind === "nursery" || c.kind === "workers") {
    // فراش ورقي + بيض
    ctx.fillStyle = "rgba(255,250,235,.25)";
    ctx.beginPath();
    ctx.ellipse(cx0, cy0 + R * 0.5, R * 0.7, R * 0.22, 0, 0, 7);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const px = cx0 - R * 0.5 + hash2(c.y, i, 31) * R;
      const py = cy0 + R * 0.42 + Math.sin(now * 2 + i) * 1.5;
      ctx.fillStyle = "#fffdf4";
      ctx.beginPath();
      ctx.ellipse(px, py, cell * 0.055, cell * 0.075, 0, 0, 7);
      ctx.fill();
    }
    if (c.kind === "workers") {
      for (let i = 0; i < 3; i++) drawMiniAnt(cx0 - R * 0.4 + i * R * 0.4, cy0 - R * 0.35, cell * 0.045, Math.sin(now + i) * 0.4);
    }
  } else if (c.kind === "soldiers") {
    drawBanner(cx0 - R * 0.7, cy0 + R * 0.3, R * 0.9, "⚔️");
    drawBanner(cx0 + R * 0.35, cy0 + R * 0.3, R * 0.9, "🐜");
    for (let i = 0; i < 4; i++) drawMiniAnt(cx0 - R * 0.45 + i * R * 0.3, cy0 + R * 0.45, cell * 0.05, 0, "#1d0d04");
  } else if (c.kind === "train") {
    drawBanner(cx0 - R * 0.75, cy0 + R * 0.2, R * 0.8, "🎖️");
    drawBanner(cx0 + R * 0.4, cy0 + R * 0.2, R * 0.8, "🎯");
    // دمى تدريب متقاطعة
    ctx.strokeStyle = "#8a6a42";
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      const px = cx0 + i * R * 0.35, py = cy0 + R * 0.35;
      ctx.beginPath();
      ctx.moveTo(px - R * 0.12, py - R * 0.3);
      ctx.lineTo(px + R * 0.12, py + R * 0.25);
      ctx.moveTo(px + R * 0.12, py - R * 0.3);
      ctx.lineTo(px - R * 0.12, py + R * 0.25);
      ctx.stroke();
    }
    for (let i = 0; i < 2; i++) drawMiniAnt(cx0 - R * 0.3 + i * R * 0.6, cy0 - R * 0.3 + Math.sin(now * 3 + i * 2) * 2, cell * 0.05, i ? 0.5 : -0.5, "#1d0d04");
  } else if (c.kind === "gene") {
    // حاضنة زرقاء متوهجةة + شاشات
    const pl = 0.5 + Math.sin(now * 3 + c.x) * 0.3;
    ctx.fillStyle = `rgba(40,200,220,${0.25 + pl * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(cx0, cy0 + R * 0.1, R * 0.4, R * 0.45, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#7de8f0";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = `rgba(120,255,220,${0.6 + pl * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const yy = cy0 - R * 0.25 + (i / 10) * R * 0.7;
      const xx = cx0 + Math.sin(i * 1.2 + now * 2) * R * 0.15;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.fillStyle = "#0e2e3a";
    ctx.fillRect(cx0 - R * 0.9, cy0 - R * 0.5, R * 0.35, R * 0.3);
    ctx.fillStyle = `rgba(120,255,220,${0.5 + pl * 0.4})`;
    ctx.fillRect(cx0 - R * 0.85, cy0 - R * 0.45, R * 0.25, R * 0.2);
  }
  ctx.restore();
}

// رقم عائم ذهبي فوق الغرف: مخزون/حضن/جنود — مثل أرقام الموارد في الصورة
function chamberCount(c) {
  try {
    if (c.kind === "nursery") return (G.nest.brood || []).length;
    if (c.kind === "queen") return queenEggCount();
    if (c.kind === "storage") return Math.floor(G.store || 0);
    if (API && API.countKind) {
      if (c.kind === "soldiers") return API.countKind("soldier");
      if (c.kind === "workers") return API.countKind("worker");
    }
  } catch {}
  return null;
}
function drawCountBadge(c, cx0, cy0, R, cell, ghost) {
  if (ghost || cell < 40) return;
  if (c.kind === "tunnel" || c.kind === "entrance" || c.kind === "gene" || c.kind === "train") return;
  const v = chamberCount(c);
  if (v == null) return;
  const fs = Math.max(14, Math.min(64, Math.round(R * 0.42)));
  const label = v >= 1000 ? ((v / 1000).toFixed(v >= 10000 ? 0 : 1) + "K") : ("" + v);
  ctx.save();
  ctx.font = "900 " + fs + "px Tahoma";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const ny = cy0 - R - fs * 0.55;
  ctx.lineWidth = Math.max(3, fs * 0.18);
  ctx.strokeStyle = "rgba(25,12,4,.9)";
  ctx.strokeText(label, cx0, ny);
  ctx.fillStyle = "#f5e6c4";
  ctx.fillText(label, cx0, ny);
  ctx.restore();
}
function drawChamber(c, x, y, cell, ghost) {
  const def = ROOM_DEFS[c.kind];
  const cx0 = x + cell / 2, cy0 = y + cell / 2;
  const seed = c.x * 31 + c.y * 57 + (c.kind === "tunnel" ? 3 : 11);
  const R = chamberRadius(c, cell);
  ctx.save();
  ctx.globalAlpha = ghost ? 0.5 : 1;
  // توهج المستوى: هالة دافئة حول الغرف المطورة (مقيّدة داخل الخانة)
  if (c.kind !== "tunnel" && c.kind !== "entrance" && !ghost && c.level >= 2) {
    const haloR = Math.min(R * 1.15, cell * NEST_LAY.haloR);
    blobPath(ctx, cx0, cy0, haloR, seed, 0.13);
    ctx.fillStyle = c.level >= 4 ? "rgba(255,217,61,.20)" : "rgba(255,235,190,.10)";
    ctx.fill();
    if (c.level >= 4) {
      blobPath(ctx, cx0, cy0, haloR * 0.94, seed, 0.13);
      ctx.strokeStyle = "rgba(255,217,61,.8)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  // ---- تجويف محفور في التربة (ظل عميق + حافة مفتتة + أرضية رملية) ----
  const CUT = Math.min(R, cell * 0.9);
  const lift = Math.max(1.5, cell * 0.03);
  const SQ = 0.8;
  // غرفة الملكة معزولة: خندق ترابي داكن + خاتم ذهبي (لا يدخلها إلا عاملات الطعام والبيض)
  if (c.kind === "queen" && !ghost) {
    blobPath(ctx, cx0, cy0 + lift, CUT * 1.30, seed, 0.2, 13, SQ);
    ctx.fillStyle = "rgba(12,6,2,.62)";
    ctx.fill();
    blobPath(ctx, cx0, cy0, CUT * 1.16, seed, 0.18, 13, SQ);
    ctx.strokeStyle = "rgba(217,168,63,.85)";
    ctx.lineWidth = Math.max(2, cell * 0.03);
    ctx.setLineDash([cell * 0.09, cell * 0.05]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // 1) حافة حجرية فاتحة سميك (تربة مكشوفة حول الكهف مثل الصورة تماماً)
  blobPath(ctx, cx0, cy0 + lift, CUT * 1.24, seed, 0.22, 11, SQ);
  ctx.fillStyle = "#c7a06a";
  ctx.fill();
  blobPath(ctx, cx0, cy0 + lift * 0.4, CUT * 1.16, seed, 0.22, 11, SQ);
  ctx.fillStyle = "#a87f4c";
  ctx.fill();
  // 2) جوف الكهف الداكن
  blobPath(ctx, cx0, cy0, CUT * 1.0, seed, 0.22, 11, SQ);
  ctx.fillStyle = "#2a1a0c";
  ctx.fill();
  // 3) أرضية الكهف: تدرج داكن دافئ (المحتويات الفاتحة تبرز فوقه مثل الصورة)
  blobPath(ctx, cx0, cy0, CUT * 0.9, seed, 0.22, 11, SQ);
  const grd = ctx.createLinearGradient(0, cy0 - CUT, 0, cy0 + CUT);
  grd.addColorStop(0, "#4a2f18");
  grd.addColorStop(0.5, "#33200f");
  grd.addColorStop(1, "#1c1006");
  ctx.fillStyle = grd;
  ctx.fill();
  // 4) حبيبات رملي داخل التجويف (مقصوص على الشكل)
  ctx.save();
  blobPath(ctx, cx0, cy0, CUT * 0.9, seed, 0.3, 11, SQ);
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    const px = cx0 - CUT + hash2(seed, i, 1) * CUT * 2;
    const py = cy0 - CUT + hash2(seed, i, 2) * CUT * 2;
    ctx.fillStyle = i % 3 ? "rgba(70,44,22,.25)" : "rgba(255,236,190,.20)";
    ctx.beginPath();
    ctx.arc(px, py, 0.5 + hash2(seed, i, 3) * Math.max(0.8, cell * 0.01), 0, 7);
    ctx.fill();
  }
  ctx.restore();
  if (c.kind !== "tunnel") {
    drawRoomInterior(c, cx0, cy0, R, cell);
    ctx.textAlign = "center";
    // الرقم الكبير فوق كل غرف (مثل الصورة) — أما الاسم والترقية ففقط للمحدد
    drawCountBadge(c, cx0, cy0, R, cell, ghost);
      const isSel = !!(selected && selected.x === c.x && selected.y === c.y);
      const showText = isSel && cell >= NEST_LAY.nameMinPx;
    if (c.kind !== "tunnel" && c.kind !== "entrance") {
      const locked = !!(ghost && c.kind === "train" && !trainUnlock().ok);
      if (showText || ghost) {
        // اللافتة مدمجة: الاسم + #N + المستوى/★ في شريط واحد مرتب (بدل سطر مستوى منفصل يتداخل)
        const maxed = c.level >= def.max;
        const lvBit = (locked || ghost) ? "" : (maxed ? " ★" : ` • م${c.level}`);
        const nm = (isCopyable(c.kind) ? `${SHORT_NAMES[c.kind] || def.name} #${c.num || 1}` : (SHORT_NAMES[c.kind] || def.name)) + lvBit;
        drawNameBar(cx0, y + 3, cell, cell, nm, def.icon, locked || ghost);
      }
      if (!ghost && isCopyable(c.kind)) drawNumBadge(cx0, cy0, R, cell, c.num);
      if (showText && locked) {
        ctx.save();
        ctx.fillStyle = "#ffb3a0";
        ctx.font = `900 ${Math.max(9, Math.round(cell * 0.14))}px Tahoma`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🔒 مقفل", cx0, cy0 + R * 0.38);
        ctx.restore();
      }
      const ub = (!ghost && isSel) ? upgradeBadgePos(c, x, y, cell) : null;
      if (ub) drawUpgradeBadge(ub.bx, ub.by, ub.r);
    }
    // حضن حقيقي: بيض/يرقات/شرانق تنمو أمام عينك
    if (c.kind === "nursery" || c.kind === "queen") {
      const items = broodForRoom(c);
      const n = items.length;
      items.forEach((b, i) => {
        const bx = cx0 + R * 1.1 * (n === 1 ? 0 : (i / (n - 1) - 0.5));
        const by = cy0 + (c.kind === "nursery" ? -R * 0.55 : R * 0.62);
        drawBrood(b, bx, by, cell * 0.11, n);
      });
    }
    if (c.kind === "queen") {
      drawQueenBig(x, y, cell, c.level);
    } else if (c.kind === "soldiers") {
      ctx.font = `${Math.round(cell * 0.2)}px serif`;
      ctx.fillText("🛡️".repeat(Math.min(3, c.level)), cx0, cy0 - R * 0.52);
    } else if (c.kind === "train") {
      // ساحة تدريب: دمى قش + شريط إشغال الساحات
      const pl = 0.5 + Math.sin((G.time || 0) * 2.2 + c.y) * 0.25;
      ctx.save();
      ctx.strokeStyle = `rgba(160,120,20,${0.4 + pl * 0.4})`;
      ctx.lineWidth = 3;
      blobPath(ctx, cx0, cy0, R * 0.8, seed, 0.14);
      ctx.stroke();
      ctx.font = `${Math.round(cell * 0.2)}px serif`;
      ctx.fillText("🎯", cx0 - R * 0.42, cy0 - R * 0.35);
      ctx.fillText("🗡️", cx0 + R * 0.42, cy0 - R * 0.35);
      const ts = trainState();
      ctx.fillStyle = "#7a5b00";
      ctx.font = `bold ${Math.max(9, Math.round(cell * 0.15))}px Tahoma`;
      ctx.fillText(`مشغول ${ts.slots.length}/${trainSlots()} 🎖️`, cx0, cy0 + R * 0.42);
      ctx.restore();
    } else if (c.kind === "gene") {
      // توهج طبي + أسرّة + حاضنات تنبض
      const pl = 0.5 + Math.sin((G.time || 0) * 3 + c.x) * 0.25;
      ctx.save();
      ctx.strokeStyle = `rgba(20,180,140,${pl})`;
      ctx.lineWidth = 3;
      blobPath(ctx, cx0, cy0, R * 0.8, seed, 0.14);
      ctx.stroke();
      ctx.font = `${Math.round(cell * 0.2)}px serif`;
      ctx.fillText("🛏️", cx0 - R * 0.42, cy0 - R * 0.35);
      ctx.fillText("🥚", cx0 + R * 0.42, cy0 - R * 0.35);
      const cl = clinic();
      ctx.fillStyle = "#0e6e5c";
      ctx.font = `bold ${Math.max(9, Math.round(cell * 0.15))}px Tahoma`;
      ctx.fillText(`${cl.beds.length}/${geneBeds()} 🛏️ ${cl.inc.length}/${geneInc()} 🥚`, cx0, cy0 + R * 0.42);
      ctx.restore();
    }
  } else {
    // عقدة نفق: انتفاخ صغير يمهد التقاطعات فقط (الممر نفسه رفيع محفور)
    blobPath(ctx, cx0, cy0, R, seed, 0.18);
    ctx.fillStyle = "#c79f66";
    ctx.fill();
  }
  if (c.kind === "entrance") {
    ctx.textAlign = "center";
    ctx.font = `${Math.round(cell * 0.3)}px serif`;
    ctx.fillText("⬆️", cx0, cy0 + cell * 0.1);
  }
  ctx.restore();
}

function drawJob(j, x, y, cell) {
  const def = ROOM_DEFS[j.kind];
  const pct = Math.min(1, j.t / j.dur);
  const cx0 = x + cell / 2, cy0 = y + cell / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!j.isUpgrade) {
    // حفر جارٍ: حفرة صغيرة + حلقة تقدم + الوقت المتبقي — كلها داخل الخانة ولا تحجب شيئاً
    const hy = cy0 - cell * 0.08;
    const jr = Math.max(6, cell * 0.20);
    ctx.fillStyle = "#2e1a0c";
    ctx.beginPath(); ctx.arc(cx0, hy, jr, 0, 7); ctx.fill();
    ctx.fillStyle = "#6e4a26";
    ctx.beginPath(); ctx.arc(cx0, hy, jr * 0.68, 0, 7); ctx.fill();
    const ringR = jr + 5;
    ctx.lineWidth = Math.max(3, cell * 0.05);
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.beginPath(); ctx.arc(cx0, hy, ringR, 0, 7); ctx.stroke();
    ctx.strokeStyle = "#ffd93d";
    ctx.beginPath(); ctx.arc(cx0, hy, ringR, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); ctx.stroke();
    if (cell >= 30) {
      const tag = `${def.icon}${(isCopyable(j.kind) && j.num ? ` #${j.num}` : "")} ⏳ ${fmtRemain(j.dur - j.t)}`;
      ctx.font = `900 ${Math.max(9, Math.round(cell * 0.15))}px Tahoma`;
      const tw = ctx.measureText(tag).width + 12;
      ctx.fillStyle = "rgba(15,8,3,.72)";
      rr(ctx, cx0 - tw / 2, hy + ringR + 3, tw, Math.max(15, cell * 0.2), 6);
      ctx.fill();
      ctx.fillStyle = "#ffe9bd";
      ctx.fillText(tag, cx0, hy + ringR + 3 + Math.max(15, cell * 0.2) / 2 + 1);
    }
  } else {
    const c = cellAt(j.x, j.y);
    if (c) drawChamber(c, x, y, cell, false);
    // ترقية جارية: حلقة تقدم حول الغرفة (مقيّدة داخل الخانة) + الوقت المتبقي أسفل الخانة
    const R = c ? chamberRadius(c, cell) : cell * 0.3;
    const ringR = Math.min(R + 5, cell * NEST_LAY.haloR);
    ctx.lineWidth = Math.max(3, cell * 0.05);
    ctx.strokeStyle = "rgba(0,0,0,.45)";
    ctx.beginPath(); ctx.arc(cx0, cy0, ringR, 0, 7); ctx.stroke();
    ctx.strokeStyle = "#4be37a";
    ctx.beginPath(); ctx.arc(cx0, cy0, ringR, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); ctx.stroke();
    if (cell >= 30) {
      const tag = `⏳ ${fmtRemain(j.dur - j.t)}`;
      ctx.font = `900 ${Math.max(9, Math.round(cell * 0.14))}px Tahoma`;
      const tw = ctx.measureText(tag).width + 12, bh = Math.max(14, cell * 0.18);
      const by = y + cell - bh - 3;
      ctx.fillStyle = "rgba(15,8,3,.72)";
      rr(ctx, cx0 - tw / 2, by, tw, bh, 6);
      ctx.fill();
      ctx.fillStyle = "#c9ffd9";
      ctx.fillText(tag, cx0, by + bh / 2 + 1);
    }
  }
  ctx.restore();
}
