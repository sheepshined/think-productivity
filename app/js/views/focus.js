/* =====================================================
 * 视图：专注 —— 番茄钟（可自定义时长 / 历史计入统计）+ 白噪音
 * 计时状态放在模块级：切换页面、去别的页面逛一圈再回来，计时不丢
 * ===================================================== */
'use strict';

/* 模块级番茄钟状态（页面刷新后按结束时间重建，依然准确） */
const Pomo = {
  running: false,
  endAt: 0,
  remain: null,     // null = 尚未初始化
  timer: null,
  ui: null,         // 当前 DOM 引用，切页后重建
};

App.registerView({
  id: 'focus',
  title: '专注',
  icon: '🍅',
  render(root) {
    const D = () => S.pomo.durations;
    const MODES = () => ({ work: D().work * 60, short: D().short * 60, long: D().long * 60 });
    const RING_C = 2 * Math.PI * 54;
    if (Pomo.remain == null) Pomo.remain = MODES()[S.pomo.mode];

    root.innerHTML = `
      <div class="view-title">🍅 专注</div>
      <div class="view-desc">按真实时间戳计时 · 切换页面、关掉浏览器再回来都不会乱 · 每完成 1 个计入统计</div>
      <div class="grid">
        <section class="card glass span-7">
          <div class="pomo-tabs">
            <button class="chip" data-mode="work">专注 ${D().work}</button>
            <button class="chip" data-mode="short">小憩 ${D().short}</button>
            <button class="chip" data-mode="long">长休 ${D().long}</button>
          </div>
          <div class="focus-wrap">
            <div>
              <div class="ring-wrap" id="ringWrap">
                <svg viewBox="0 0 120 120" class="ring">
                  <circle cx="60" cy="60" r="54" class="ring-bg"/>
                  <circle cx="60" cy="60" r="54" class="ring-fg" id="ringFg"/>
                </svg>
                <div class="ring-text">
                  <div id="pomoTime" class="pomo-time">25:00</div>
                  <div id="pomoState" class="pomo-state">准备开始</div>
                </div>
              </div>
              <div class="pomo-btns">
                <button id="pomoStart" class="btn primary big">▶ 开始专注</button>
                <button id="pomoReset" class="btn ghost">↺</button>
              </div>
            </div>
            <div class="noise-panel">
              <div class="card-head"><h2>🎧 白噪音</h2><span class="card-sub">纯合成 · 无音频文件</span></div>
              <div class="noise-chips">
                <button class="chip" data-noise="white">白噪音</button>
                <button class="chip" data-noise="brown">棕噪音</button>
                <button class="chip" data-noise="rain">雨声</button>
                <button class="chip" data-noise="off">关闭</button>
              </div>
              <div class="vol-row">🔈 <input id="noiseVol" type="range" min="0" max="100" value="35"> 🔊</div>
              <div class="dur-row">
                时长设置：
                专注 <input id="durWork" type="number" min="5" max="120" value="${D().work}"> 分 ·
                小憩 <input id="durShort" type="number" min="1" max="30" value="${D().short}"> 分 ·
                长休 <input id="durLong" type="number" min="5" max="60" value="${D().long}"> 分
              </div>
              <div class="dur-row">今日已完成 <b id="pomoCount" style="color:var(--accent)">0</b> 个 🍅 · 累计 <b id="pomoTotal" style="color:var(--accent)">0</b> 个</div>
            </div>
          </div>
        </section>
        <section class="card glass span-5">
          <div class="card-head"><h2>📖 番茄工作法小抄</h2></div>
          <div style="font-size:13.5px; line-height:2; color:var(--text-dim)">
            1. 挑一件最重要的事，写下要完成到什么程度<br>
            2. 专注 25 分钟，期间只做这一件事<br>
            3. 铃响后休息 5 分钟，站起来走走<br>
            4. 每做满 4 个，来一次 15 分钟长休息<br><br>
            <span style="color:var(--text)">提示：计时按「结束时刻」计算，去别的页面逛一圈、甚至关掉浏览器，回来时该结束就结束，该剩多少剩多少。</span>
          </div>
        </section>
      </div>`;

    const ui = {
      root,
      time: $('#pomoTime', root), state: $('#pomoState', root), fg: $('#ringFg', root),
      ringWrap: $('#ringWrap', root), startBtn: $('#pomoStart', root), count: $('#pomoCount', root), total: $('#pomoTotal', root),
    };
    Pomo.ui = ui;
    const isBreak = () => S.pomo.mode !== 'work';

    const renderPomo = () => {
      const u = Pomo.ui; if (!u || !document.body.contains(u.root)) return;
      const total = MODES()[S.pomo.mode];
      const remain = Pomo.running ? Math.max(0, Math.round((Pomo.endAt - Date.now()) / 1000)) : Pomo.remain;
      const mm = String(Math.floor(remain / 60)).padStart(2, '0');
      const ss = String(remain % 60).padStart(2, '0');
      u.time.textContent = `${mm}:${ss}`;
      u.fg.style.strokeDashoffset = (RING_C * (1 - remain / total)).toFixed(1);
      u.ringWrap.classList.toggle('break', isBreak());
      u.state.textContent = Pomo.running
        ? (isBreak() ? '休息中，放松一下 ☕' : '专注中，不要停 🎯')
        : (remain === total ? '准备开始' : '已暂停');
      u.startBtn.textContent = Pomo.running ? '⏸ 暂停' : (remain === total ? '▶ 开始专注' : '▶ 继续');
      document.body.classList.toggle('pomo-running', Pomo.running);
      const tk = todayKey();
      u.count.textContent = S.pomo.history[tk] || 0;
      u.total.textContent = Object.values(S.pomo.history).reduce((a, b) => a + b, 0);
      if (Pomo.running) document.title = `${mm}:${ss} · ${isBreak() ? '休息' : '专注'} — THINK`;
    };
    ui.render = renderPomo;

    const finish = () => {
      Pomo.running = false;
      if (Pomo.timer) { clearInterval(Pomo.timer); Pomo.timer = null; }
      document.title = 'THINK · 个人工作台';
      if (!isBreak()) {
        const tk = todayKey();
        S.pomo.history[tk] = (S.pomo.history[tk] || 0) + 1;
        const n = S.pomo.history[tk];
        setMode(n % 4 === 0 ? 'long' : 'short', false);
        AudioKit.beep([880, 880, 1320]);
        toast(`🍅 完成！休息一下吧${n % 4 === 0 ? '（第 ' + Math.ceil(n / 4) + ' 轮结束，来个长休息）' : ''}`);
      } else {
        setMode('work', false);
        AudioKit.beep([660, 440]);
        toast('休息结束，开始下一轮专注 💪');
      }
      Pomo.remain = MODES()[S.pomo.mode];
      save(); renderPomo();
    };

    const setMode = (mode, doRender = true) => {
      S.pomo.mode = mode;
      $$('.pomo-tabs .chip', root).forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      Pomo.running = false; Pomo.remain = MODES()[mode];
      if (Pomo.timer) { clearInterval(Pomo.timer); Pomo.timer = null; }
      save();
      if (doRender) renderPomo();
    };

    const startPause = () => {
      AudioKit.ensure();
      if (Pomo.running) {
        Pomo.remain = Math.max(0, Math.round((Pomo.endAt - Date.now()) / 1000));
        Pomo.running = false;
        if (Pomo.timer) { clearInterval(Pomo.timer); Pomo.timer = null; }
        document.title = 'THINK · 个人工作台';
      } else {
        if (Pomo.remain <= 0) Pomo.remain = MODES()[S.pomo.mode];
        Pomo.endAt = Date.now() + Pomo.remain * 1000;
        Pomo.running = true;
        // 独立心跳：无论在哪个页面都继续走，到点即结算
        if (Pomo.timer) clearInterval(Pomo.timer);
        Pomo.timer = setInterval(() => {
          if (!Pomo.running) return;
          renderPomo();
          if (Math.round((Pomo.endAt - Date.now()) / 1000) <= 0) finish();
        }, 250);
      }
      save(); renderPomo();
    };
    window.__pomoStartPause = startPause;   // 命令面板用

    $('#pomoStart', root).onclick = startPause;
    $('#pomoReset', root).onclick = () => {
      Pomo.running = false; Pomo.remain = MODES()[S.pomo.mode];
      if (Pomo.timer) { clearInterval(Pomo.timer); Pomo.timer = null; }
      document.title = 'THINK · 个人工作台';
      renderPomo();
    };
    $$('.pomo-tabs .chip', root).forEach(b => b.onclick = () => setMode(b.dataset.mode));

    /* ---- 白噪音（切换页面也继续播放，回到本页恢复选中态） ---- */
    const chips = $$('.noise-chips .chip', root);
    const reflect = () => {
      const kind = AudioKit.noiseKind || 'off';
      chips.forEach(x => x.classList.toggle('active', x.dataset.noise === kind));
    };
    chips.forEach(b => b.onclick = () => {
      if (b.dataset.noise === 'off') { AudioKit.stopNoise(); reflect(); return; }
      const ok = AudioKit.startNoise(b.dataset.noise, (+$('#noiseVol', root).value) / 100);
      if (!ok) toast('浏览器未能启动音频');
      reflect();
    });
    $('#noiseVol', root).oninput = (e) => AudioKit.setNoiseVolume((+e.target.value) / 100);
    reflect();

    /* ---- 时长自定义 ---- */
    ['#durWork', '#durShort', '#durLong'].forEach(sel => {
      $(sel, root).onchange = () => {
        const clamp = (v, lo, hi, dft) => Math.min(hi, Math.max(lo, +v || dft));
        Object.assign(S.pomo.durations, {
          work: clamp($('#durWork', root).value, 5, 120, 25),
          short: clamp($('#durShort', root).value, 1, 30, 5),
          long: clamp($('#durLong', root).value, 5, 60, 15),
        });
        save();
        toast('时长已更新，重新选择模式生效');
      };
    });

    $$('.pomo-tabs .chip', root).forEach(b => b.classList.toggle('active', b.dataset.mode === S.pomo.mode));
    renderPomo();
  },
});
