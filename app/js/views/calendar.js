/* =====================================================
 * 视图：日历 —— 农历月历 · 节日标注 · 日期详情
 * ===================================================== */
App.registerView({
  id: 'calendar',
  title: '日历',
  icon: '📅',
  render(root) {
    const now = new Date();
    let cur = new Date(now.getFullYear(), now.getMonth(), 1);             // 当前展示月份
    let selected = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 当前选中日期（零点）

    root.innerHTML = `
      <div class="view-title">📅 日历</div>
      <div class="view-desc">公历 / 农历对照，节日自动标注，点击任意日期查看详情</div>
      <div class="grid">
        <section class="card glass span-8">
          <div class="cal-toolbar">
            <button id="calPrev" class="btn ghost">‹</button>
            <div id="calMonth" class="cal-month-label"></div>
            <button id="calNext" class="btn ghost">›</button>
            <button id="calToday" class="chip" style="margin-left:auto">回到今天</button>
          </div>
          <div id="calGrid" class="cal-grid"></div>
        </section>
        <section class="card glass span-4" id="calDetail"></section>
      </div>`;

    const renderDetail = () => {
      const d = selected;
      const lunar = lunarInfo(d);
      const f = festivalOf(d, lunar);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((d - today) / 864e5);
      const rel = diff === 0 ? '就是今天' : diff > 0 ? `今天之后 ${diff} 天` : `${-diff} 天前`;
      const isSameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      $('#calDetail', root).innerHTML = `
        <div class="card-head"><h2>🗓 日期详情</h2><span class="card-sub">${rel}</span></div>
        <div class="cal-detail-row"><span class="k">公历</span><span>${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK_CN[d.getDay()]}</span></div>
        ${lunar ? `<div class="cal-detail-row"><span class="k">农历</span><span>${lunar.text}</span></div>` : ''}
        <div class="cal-detail-row"><span class="k">节日</span><span>${f ? '🏮 ' + esc(f) : '普通的一天'}</span></div>
        <div class="cal-detail-row"><span class="k">年内</span><span>第 ${dayOfYear(d)} 天 / ${isSameMonth ? '本月第 ' + Math.ceil(d.getDate() / 7) + ' 周' : (d.getFullYear() !== now.getFullYear() ? '其他年份' : '其他月份')}</span></div>
        <div class="cal-detail-row"><span class="k">季度</span><span>第 ${Math.floor(d.getMonth() / 3) + 1} 季度</span></div>`;
    };

    const renderCal = () => {
      $('#calMonth', root).textContent = `${cur.getFullYear()} 年 ${cur.getMonth() + 1} 月`;
      const grid = $('#calGrid', root);
      grid.innerHTML = ['一','二','三','四','五','六','日'].map(w => `<div class="cal-head-cell">${w}</div>`).join('');

      const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const start = mondayOf(first);
      const todayK = dateKey(now);
      const selK = dateKey(selected);
      const thisMonth = cur.getMonth();

      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const lunar = lunarInfo(d);
        const f = festivalOf(d, lunar);
        const isOut = d.getMonth() !== thisMonth;
        const isToday = dateKey(d) === todayK;
        const lunarText = lunar ? (lunar.monthDay === '初一' ? lunar.monthText : lunar.monthDay) : '';
        const btn = document.createElement('button');
        btn.className = 'cal-cell' + (isOut ? ' out' : '') + (isToday ? ' today' : '') +
          (dateKey(d) === selK ? ' selected' : '') + (f ? ' festival' : '');
        btn.innerHTML = `<span class="d">${d.getDate()}</span><span class="l">${esc(lunarText)}</span>${f ? `<span class="f">${esc(f)}</span>` : ''}`;
        btn.title = `${d.getMonth() + 1}月${d.getDate()}日 ${lunar ? lunar.text : ''}${f ? ' · ' + f : ''}`;
        btn.onclick = () => { selected = new Date(d); renderCal(); renderDetail(); };
        grid.appendChild(btn);
      }
      renderDetail();
    };

    $('#calPrev', root).onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1); renderCal(); };
    $('#calNext', root).onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); renderCal(); };
    $('#calToday', root).onclick = () => { cur = new Date(now.getFullYear(), now.getMonth(), 1); selected = new Date(now); renderCal(); };
    renderCal();
  },
});
