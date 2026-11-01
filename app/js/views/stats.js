/* =====================================================
 * 视图：统计 —— 番茄柱状图 / 习惯热力图 / 待办完成趋势
 * （灵感：GitHub contributions heatmap、Super Productivity 统计）
 * ===================================================== */
App.registerView({
  id: 'stats',
  title: '统计',
  icon: '📊',
  render(root) {
    root.innerHTML = `
      <div class="view-title">📊 统计</div>
      <div class="view-desc">数据都来自你的真实使用记录，看着它们长起来很有成就感</div>
      <div class="grid">
        <div class="span-3 card glass" style="text-align:center">
          <div class="stat-big" id="stPomoToday">0<small>个</small></div>
          <div class="card-sub">今日番茄 🍅</div>
        </div>
        <div class="span-3 card glass" style="text-align:center">
          <div class="stat-big" id="stPomoAll">0<small>个</small></div>
          <div class="card-sub">累计番茄 🍅</div>
        </div>
        <div class="span-3 card glass" style="text-align:center">
          <div class="stat-big" id="stTodoDone">0<small>件</small></div>
          <div class="card-sub">累计完成待办 ✅</div>
        </div>
        <div class="span-3 card glass" style="text-align:center">
          <div class="stat-big" id="stHabitBest">0<small>天</small></div>
          <div class="card-sub">最长连续打卡 🔥</div>
        </div>

        <section class="card glass span-7">
          <div class="card-head"><h2>🍅 近 14 天专注</h2><span class="card-sub">每天完成的番茄数</span></div>
          <div id="chartPomo" class="bar-chart"></div>
        </section>
        <section class="card glass span-5">
          <div class="card-head"><h2>✅ 近 7 天完成待办</h2><span class="card-sub">按完成时间统计</span></div>
          <div id="chartTodo" class="bar-chart"></div>
        </section>
        <section class="card glass span-12">
          <div class="card-head"><h2>🔥 习惯热力图</h2><span class="card-sub">最近 5 周 · 越亮越勤</span></div>
          <div id="chartHabit" class="heat"></div>
        </section>
        <section class="card glass span-12">
          <div class="card-head"><h2>🎤 面试成长曲线</h2>
            <span style="display:flex; gap:8px; align-items:center">
              <span class="card-sub">最近 5 场模拟面试</span>
              <button id="ivRefreshStats" class="chip">↻ 拉取</button>
            </span></div>
          <div id="ivGrowth" class="empty" style="display:block; padding:18px 0">点击「拉取」从面试系统读取历史报告（需服务在运行）</div>
        </section>
      </div>`;

    /* 顶部数字 */
    const tk = todayKey();
    $('#stPomoToday', root).firstChild.textContent = S.pomo.history[tk] || 0;
    $('#stPomoAll', root).firstChild.textContent = Object.values(S.pomo.history).reduce((a, b) => a + b, 0);
    $('#stTodoDone', root).firstChild.textContent = S.todos.filter(t => t.done).length;

    /* 最长连续打卡（全部习惯里最长的单条 streak） */
    let best = 0;
    for (const h of S.habits) {
      const checks = S.habitChecks[h.id] || {};
      let n = 0; const d = new Date();
      if (!checks[dateKey(d)]) d.setDate(d.getDate() - 1);
      while (checks[dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
      best = Math.max(best, n);
    }
    $('#stHabitBest', root).firstChild.textContent = best;

    /* 近 N 天序列（ oldest → 今天 ） */
    const lastNDays = (n) => [...Array(n)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
      return d;
    });

    /* 番茄 14 天柱状图 */
    const drawBars = (el, values, labels) => {
      const max = Math.max(1, ...values);
      el.innerHTML = values.map((v, i) => `
        <div class="bar-col ${v === 0 ? 'zero' : ''}" title="${labels[i]}：${v}">
          <span class="bv">${v || ''}</span>
          <div class="bar" style="height:${Math.max(2, v / max * 100)}%"></div>
          <span class="bl">${labels[i]}</span>
        </div>`).join('');
    };
    const d14 = lastNDays(14);
    drawBars($('#chartPomo', root),
      d14.map(d => S.pomo.history[dateKey(d)] || 0),
      d14.map(d => `${d.getMonth() + 1}/${d.getDate()}`));

    /* 待办近 7 天（按 completedAt） */
    const d7 = lastNDays(7);
    const todoVals = d7.map(d => {
      const k0 = dateKey(d);
      return S.todos.filter(t => t.completedAt && dateKey(new Date(t.completedAt)) === k0).length;
    });
    drawBars($('#chartTodo', root), todoVals, d7.map(d => `${d.getMonth() + 1}/${d.getDate()}`));

    /* 习惯热力图：每行 35 格 */
    const d35 = lastNDays(35);
    const todayTs = new Date(); todayTs.setHours(0, 0, 0, 0);
    const heat = $('#chartHabit', root);
    if (!S.habits.length) {
      heat.innerHTML = '<div class="empty" style="display:block">还没有习惯数据</div>';
    } else {
      heat.innerHTML = S.habits.map(h => {
        const checks = S.habitChecks[h.id] || {};
        const cells = d35.map(d => {
          const k = dateKey(d);
          const on = checks[k];
          const future = d > todayTs;
          return `<div class="heat-cell ${on ? 'l3' : ''} ${future ? 'future' : ''}" title="${h.name} · ${k}${on ? ' ✓' : ''}"></div>`;
        }).join('');
        return `<div class="heat-row"><span class="hn" title="${esc(h.name)}">${esc(h.name)}</span><div class="heat-cells">${cells}</div></div>`;
      }).join('');
    }

    /* =====================================================
     * 面试成长曲线 (v2.2): 雷达叠加 + 均分趋势
     * 数据来自面试系统 /api/reports + /api/reports/{id}/radar
     * ===================================================== */
    const IV_DIMS = [
      ['accuracy', '准确'], ['completeness', '完整'], ['depth', '深度'], ['clarity', '表达'],
    ];
    const IV_COLORS = ['#5eead4', '#818cf8', '#f472b6', '#fbbf24', '#4ade80'];

    function renderIvGrowth(reports) {
      const box = $('#ivGrowth', root);
      if (!reports.length) {
        box.className = 'empty';
        box.style.display = 'block';
        box.textContent = '面试系统里还没有报告';
        return;
      }
      box.className = 'iv-growth';
      box.style.display = 'grid';
      box.style.gridTemplateColumns = 'minmax(240px, 340px) 1fr';
      box.style.gap = '24px';
      box.style.alignItems = 'center';

      // ---- 雷达叠加 (SVG, 4 维) ----
      const cx = 130, cy = 125, R = 92;
      const angle = (i) => (Math.PI * 2 * i) / IV_DIMS.length - Math.PI / 2;
      const pt = (i, v) => `${cx + Math.cos(angle(i)) * R * (v / 10)},${cy + Math.sin(angle(i)) * R * (v / 10)}`;
      let rings = '';
      for (const frac of [0.25, 0.5, 0.75, 1]) {
        const pts = IV_DIMS.map((_, i) => pt(i, 10 * frac)).join(' ');
        rings += `<polygon points="${pts}" fill="none" stroke="var(--ring-track)" stroke-width="1"/>`;
      }
      const labels = IV_DIMS.map(([key, label], i) => {
        const lx = cx + Math.cos(angle(i)) * (R + 16), ly = cy + Math.sin(angle(i)) * (R + 16);
        return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="var(--text-dim)">${label}</text>`;
      }).join('');
      let polys = '', legend = '';
      reports.forEach((r, idx) => {
        const color = IV_COLORS[idx % IV_COLORS.length];
        const vals = IV_DIMS.map(([k]) => r.dimensions[k] ?? 0);
        polys += `<polygon points="${vals.map((v, i) => pt(i, v)).join(' ')}" fill="${color}22" stroke="${color}" stroke-width="1.8"/>`
          + vals.map((v, i) => `<circle cx="${pt(i, v).split(',')[0]}" cy="${pt(i, v).split(',')[1]}" r="2.6" fill="${color}"/>`).join('');
        legend += `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-dim)">
          <span style="width:10px;height:10px;border-radius:3px;background:${color}"></span>${r.label}</span>`;
      });
      // ---- 均分趋势条 ----
      const trend = reports.slice().reverse().map((r, i) => `
        <div class="bar-col" title="${r.label}: 均分 ${r.avg}/10">
          <span class="bv">${r.avg}</span>
          <div class="bar" style="height:${Math.max(3, r.avg / 10 * 100)}%;max-width:44px;background:linear-gradient(180deg,${IV_COLORS[i % IV_COLORS.length]},${IV_COLORS[i % IV_COLORS.length]}55)"></div>
          <span class="bl">${r.date}</span>
        </div>`).join('');

      box.innerHTML = `
        <div style="text-align:center">
          <svg viewBox="0 0 260 250" style="width:100%;max-width:300px">${rings}${polys}${labels}</svg>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:4px">${legend}</div>
        </div>
        <div>
          <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">场均得分走势 (满分 10)</div>
          <div class="bar-chart" style="height:130px">${trend}</div>
        </div>`;
    }

    $('#ivRefreshStats', root).onclick = async () => {
      const box = $('#ivGrowth', root);
      box.className = 'empty'; box.style.display = 'block';
      box.textContent = '连接面试系统并读取报告…';
      try {
        const rep = await InterviewAPI.get('/api/reports');
        const reports = (rep.reports || []).slice(0, 5);
        const detailed = [];
        for (const r of reports) {
          const d = await InterviewAPI.get(`/api/reports/${r.report_id}/radar`);
          if (!d.success) continue;
          const meta = d.radar || {};
          const ts = String(meta.timestamp || '');
          detailed.push({
            dimensions: meta.dimensions || {},
            avg: Math.round((meta.avg_score || 0) * 10) / 10,
            label: `${(meta.timestamp || '').slice(4, 6)}/${(meta.timestamp || '').slice(6, 8)} ${(meta.role_title || '').slice(0, 9)}`,
            date: `${ts.slice(4, 6)}/${ts.slice(6, 8)}`,
          });
        }
        renderIvGrowth(detailed);
      } catch (e) {
        box.textContent = '✗ ' + e.message;
      }
    };
  },
});
