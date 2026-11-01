/* =====================================================
 * THINK · 个人工作台 v2 —— 状态与工具层
 * 本地优先 · 零依赖 · 数据存于 localStorage
 * ===================================================== */
'use strict';

/* ---------- 存储（带 v1→v2 迁移） ---------- */
const KEY = 'think.v1';
const DEFAULTS = {
  version: 2,
  theme: 'dark',
  view: 'overview',
  todos: [],             // {id, text, done, created, completedAt}
  todoFilter: 'all',
  habits: [],            // {id, name, created}
  habitChecks: {},       // {habitId: {'2026-09-13': true}}
  note: '',
  notes: [],             // {id, title, body, created, updated, pinned} v2.1 笔记本
  reviewCards: [],       // v2.2 错题本: {id, question, category, score, badPoints, goodPoints,
                         //              reportId, reportTitle, ease, intervalDays, reps, dueTs, lapses, addedAt}
  pomo: {
    mode: 'work',
    todayDate: '', todayCount: 0,
    history: {},         // {'2026-09-13': 3} 番茄钟历史
    durations: { work: 25, short: 5, long: 15 },
  },
  countdowns: [],        // {id, title, date:'2026-10-01', emoji:'🎉', created}
  bookmarks: [],         // {id, name, url, created}
  settings: {
    city: null,          // {name, lat, lon} 天气城市
    interviewAuth: { username: 'admin', password: '123123' },  // 面试系统本机账号, 仅存本地
  },
  weatherCache: null,    // {at: ts, data: {...}}
};

function migrate(raw) {
  // v1 → v2：番茄钟今日计数并入历史，其余字段原样保留
  if (raw && raw.pomo && raw.pomo.todayDate && raw.pomo.todayCount) {
    raw.pomo.history = raw.pomo.history || {};
    raw.pomo.history[raw.pomo.todayDate] = raw.pomo.todayCount;
  }
  // v2 → v2.1：旧的单条便签升级为笔记本的第一条笔记
  if (raw && typeof raw.note === 'string' && raw.note.trim() && !Array.isArray(raw.notes)) {
    raw.notes = [{
      id: 'migrated', title: '速记便签（迁移）', body: raw.note,
      created: Date.now(), updated: Date.now(), pinned: false,
    }];
  }
  return raw;
}

let S = load();

/* 递归合并默认值：旧版本数据里缺失的子字段用默认值补齐（浅合并会让 v1 的 pomo 覆盖掉 v2 新增的 durations/history） */
function mergeDefaults(base, raw) {
  const out = { ...base };
  for (const k of Object.keys(raw)) {
    const r = raw[k], b = base[k];
    if (r && typeof r === 'object' && !Array.isArray(r) && b && typeof b === 'object' && !Array.isArray(b)) {
      out[k] = mergeDefaults(b, r);
    } else {
      out[k] = r;
    }
  }
  return out;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      migrate(raw);
      return mergeDefaults(structuredClone(DEFAULTS), raw);
    }
  } catch (e) { /* 数据损坏时回退默认 */ }
  return structuredClone(DEFAULTS);
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(S));
  scheduleIdbMirror();
}

/* ---------- IndexedDB 镜像 (v2.2) ----------
 * localStorage 写满/被清时, IndexedDB 里还有一份完整快照可恢复;
 * 每次落盘 2 秒后异步镜像一次, 不阻塞 UI。 */
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('think-db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // 旧连接阻塞升级/打开时不能永久挂起（否则启动流程会被卡住）
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
}
function idbPut(key, val) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  }));
}
function idbGet(key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const req = db.transaction('kv').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  }));
}
let _idbTimer;
function scheduleIdbMirror() {
  clearTimeout(_idbTimer);
  _idbTimer = setTimeout(() => { try { idbPut(KEY, JSON.parse(JSON.stringify(S))); } catch (e) {} }, 2000);
}
async function restoreFromIdb() {
  try {
    if (localStorage.getItem(KEY)) return false;      // 本地已有数据, 无需恢复
    const snap = await idbGet(KEY);
    if (snap && typeof snap === 'object') {
      migrate(snap);
      S = mergeDefaults(structuredClone(DEFAULTS), snap);
      localStorage.setItem(KEY, JSON.stringify(S));   // 写回本地, 恢复主存储
      return true;
    }
  } catch (e) {}
  return false;
}

/* 彻底清空: localStorage + IndexedDB 镜像一起清, 否则下次启动数据会从镜像"复活" */
async function wipeAll() {
  clearTimeout(_idbTimer);
  AudioKit.stopNoise();
  try { localStorage.removeItem(KEY); } catch (e) {}
  try {
    const db = await idbOpen();
    await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(KEY);
      tx.oncomplete = resolve; tx.onerror = resolve; tx.onabort = resolve;
    });
  } catch (e) {}
}

/* ---------- 面试系统 API 客户端 (v2.2) ----------
 * 自动探测后端端口 (8001/8000/8002, 与 interview.py 的规避顺序一致),
 * 账号取 S.settings.interviewAuth, 401 自动重登一次。 */
const InterviewAPI = {
  _token: null,
  _base: null,
  async login() {
    const auth = S.settings.interviewAuth || {};
    for (const base of ['http://127.0.0.1:8001', 'http://127.0.0.1:8000', 'http://127.0.0.1:8002']) {
      try {
        const r = await fetch(`${base}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: auth.username, password: auth.password }),
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) continue;
        const d = await r.json();
        if (d.token || d.access_token) {
          this._token = d.token || d.access_token;
          this._base = base;
          return base;
        }
      } catch (e) { /* 试下一个端口 */ }
    }
    throw new Error('连不上面试系统 (8001/8000/8002 都不通或账号错误)');
  },
  async get(path) {
    if (!this._token) await this.login();
    let r = await fetch(`${this._base}${path}`, {
      headers: { Authorization: `Bearer ${this._token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 401) {           // token 过期/被吊销 → 重登重试一次
      await this.login();
      r = await fetch(`${this._base}${path}`, {
        headers: { Authorization: `Bearer ${this._token}` },
        signal: AbortSignal.timeout(12000),
      });
    }
    return r.json();
  },
  baseUrl() { return this._base; },
};

/* ---------- SM-2 间隔复习调度 (v2.2 错题本) ---------- */
// grade: 0=忘了 1=勉强 2=记得 3=轻松
function scheduleCard(card, grade) {
  const MIN_EF = 1.3, MAX_EF = 2.8;
  if (grade === 0) {
    card.reps = 0;
    card.lapses = (card.lapses || 0) + 1;
    card.intervalDays = 0;
    card.dueTs = Date.now() + 10 * 60e3;              // 10 分钟后再来
    card.ease = Math.max(MIN_EF, (card.ease || 2.5) - 0.2);
  } else {
    const ef = card.ease || 2.5;
    let interval;
    if (card.reps === 0) interval = grade === 1 ? 1 : grade === 2 ? 1 : 3;
    else if (card.reps === 1) interval = grade === 1 ? 3 : grade === 2 ? 6 : 8;
    else interval = Math.round((card.intervalDays || 1) * (grade === 1 ? ef * 0.7 : grade === 2 ? ef : ef * 1.25));
    card.intervalDays = Math.max(grade === 1 ? 1 : 1, Math.min(interval, 365));
    card.reps = (card.reps || 0) + 1;
    card.ease = Math.min(MAX_EF, Math.max(MIN_EF,
      ef + (grade === 1 ? -0.14 : grade === 2 ? 0 : 0.1)));
    card.dueTs = Date.now() + card.intervalDays * 864e5;
  }
  return card;
}

/* ---------- 微型工具 ---------- */
const $ = (s, root) => (root || document).querySelector(s);
const $$ = (s, root) => [...(root || document).querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

/* ---------- 日期工具 ---------- */
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function todayKey() { return dateKey(new Date()); }
function dayOfYear(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
function mondayOf(d) {
  const m = new Date(d); m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((d.getDay() + 6) % 7));
  return m;
}
const WEEK_CN = ['日','一','二','三','四','五','六'];

/* ---------- 农历（浏览器内置中国历法换算，已对表验证） ---------- */
const LUNAR_MONTHS = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const MONTH_NAME_MAP = { '正':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'冬':11,'腊':12,'十一':11,'十二':12 };
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const ZODIAC = '鼠牛虎兔龙蛇马羊猴鸡狗猪';

function lunarDayName(d) {
  const a = ['初','十','廿','三'], b = ['一','二','三','四','五','六','七','八','九','十'];
  if (d === 10) return '初十';
  if (d === 20) return '二十';
  if (d === 30) return '三十';
  return a[Math.floor((d - 1) / 10)] + b[(d - 1) % 10];
}

const _lunarFmt = (typeof Intl !== 'undefined')
  ? new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { year: 'numeric', month: 'long', day: 'numeric' })
  : null;

function lunarInfo(date) {
  if (!_lunarFmt) return null;
  try {
    const parts = {};
    for (const p of _lunarFmt.formatToParts(date)) parts[p.type] = p.value;
    const monthStr = (parts.month || '').trim();
    const leap = /闰|閏|bis/.test(monthStr);
    const core = monthStr.replace(/闰|閏|bis/g, '').replace(/月/g, '');
    const monthNum = /^\d+$/.test(core) ? parseInt(core, 10) : MONTH_NAME_MAP[core];
    const dayNum = parseInt(parts.day, 10);
    if (!monthNum || !dayNum) return null;

    let gz = null, zodiac = null;
    if (parts.yearName && parts.yearName.length >= 2) {
      gz = parts.yearName;
      const bi = BRANCHES.indexOf(gz[1]);
      if (bi >= 0) zodiac = ZODIAC[bi];
    } else if (parts.year && /^\d+$/.test(parts.year)) {
      const y = parseInt(parts.year, 10);
      gz = STEMS[(y - 4) % 10] + BRANCHES[(y - 4) % 12];
      zodiac = ZODIAC[(y - 4) % 12];
    }
    const yearText = gz ? `${gz}年${zodiac ? '(' + zodiac + ')' : ''}` : '';
    return {
      text: `${yearText} ${leap ? '闰' : ''}${LUNAR_MONTHS[monthNum - 1]}月${lunarDayName(dayNum)}`.trim(),
      monthText: `${leap ? '闰' : ''}${LUNAR_MONTHS[monthNum - 1]}月`,
      monthDay: `${leap ? '闰' : ''}${lunarDayName(dayNum)}`,
      md: `${monthNum}-${dayNum}`,
      gzYear: gz,
    };
  } catch (e) { return null; }
}

const FESTIVALS_SOLAR = { '1-1':'元旦','2-14':'情人节','3-8':'妇女节','3-12':'植树节','5-1':'劳动节','5-4':'青年节','6-1':'儿童节','7-1':'建党节','8-1':'建军节','9-10':'教师节','10-1':'国庆节','12-24':'平安夜','12-25':'圣诞节' };
const FESTIVALS_LUNAR = { '1-1':'春节','1-15':'元宵节','2-2':'龙抬头','5-5':'端午节','7-7':'七夕','7-15':'中元节','8-15':'中秋节','9-9':'重阳节','12-8':'腊八节' };
function festivalOf(date, lunar) {
  const solar = FESTIVALS_SOLAR[`${date.getMonth() + 1}-${date.getDate()}`];
  if (solar) return solar;
  return lunar ? (FESTIVALS_LUNAR[lunar.md] || null) : null;
}

/* ---------- 番茄钟提示音 / 白噪音（Web Audio 合成） ---------- */
const AudioKit = {
  ctx: null,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  beep(freqs) {
    const ctx = this.ensure(); if (!ctx) return;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.28;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + 0.3);
    });
  },
  /* 白噪音: kind = white | brown | rain */
  noise: null,
  noiseKind: null,
  startNoise(kind, volume) {
    this.stopNoise();
    const ctx = this.ensure(); if (!ctx) return false;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') data[i] = w * 0.5;
      else { // brown / rain 以棕噪音为底
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.2;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    if (kind === 'white') { filter.type = 'highpass'; filter.frequency.value = 800; }
    else if (kind === 'brown') { filter.type = 'lowpass'; filter.frequency.value = 900; }
    else { filter.type = 'lowpass'; filter.frequency.value = 1400; } // rain
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    // 雨声：低频起伏，模拟阵势
    let lfo = null, lfoGain = null;
    if (kind === 'rain') {
      lfo = ctx.createOscillator(); lfoGain = ctx.createGain();
      lfo.frequency.value = 0.18; lfoGain.gain.value = volume * 0.35;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
    }
    this.noise = { src, gain, lfo };
    this.noiseKind = kind;
    return true;
  },
  setNoiseVolume(v) { if (this.noise) this.noise.gain.gain.value = v; },
  stopNoise() {
    if (!this.noise) return;
    try { this.noise.src.stop(); if (this.noise.lfo) this.noise.lfo.stop(); } catch (e) {}
    this.noise = null;
    this.noiseKind = null;
  },
};
