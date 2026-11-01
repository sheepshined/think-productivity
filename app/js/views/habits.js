/* =====================================================
 * 视图：习惯 —— 本周打卡网格 + 连续天数
 * ===================================================== */
App.registerView({
  id: 'habits',
  title: '习惯',
  icon: '🔥',
  render(root) {
    root.innerHTML = `
      <div class="view-title">🔥 习惯打卡</div>
      <div class="view-desc">一周视图 · 今天还没打卡也不断签 · 最多 8 个习惯帮你聚焦</div>
      <section class="card glass span-12" style="max-width:920px">
        <div class="card-head"><h2>本周打卡</h2><span id="habitWeekLabel" class="card-sub"></span></div>
        <form id="habitForm" class="habit-form">
          <input id="habitInput" type="text" placeholder="想养成什么习惯？如：阅读 30 分钟、喝够 8 杯水" maxlength="60" autocomplete="off">
          <button type="submit" class="btn primary">添加</button>
        </form>
        <div id="habitTable" class="habit-table"></div>
        <div id="habitEmpty" class="empty">还没有习惯，先添加一个吧 👆</div>
      </section>`;

    const render = () => {
      const wrap = $('#habitTable', root);
      wrap.innerHTML = '';
      const today = new Date();
      const tk = todayKey();
      const mon = mondayOf(today);
      const days = [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });

      const head = document.createElement('div');
      head.className = 'habit-row head';
      head.innerHTML = '<span>习惯 / 连续天数</span>';
      days.forEach(d => {
        const s = document.createElement('span');
        s.className = 'habit-head-cell' + (dateKey(d) === tk ? ' today' : '');
        s.textContent = `周${WEEK_CN[(d.getDay() + 6) % 7]} ${d.getDate()}`;
        head.appendChild(s);
      });
      head.appendChild(document.createElement('span'));
      wrap.appendChild(head);

      $('#habitEmpty', root).style.display = S.habits.length ? 'none' : 'block';

      for (const h of S.habits) {
        const row = document.createElement('div');
        row.className = 'habit-row';
        const name = document.createElement('div');
        name.className = 'habit-name';
        name.title = h.name;
        name.appendChild(document.createTextNode(h.name));
        const checks = S.habitChecks[h.id] || {};
        const sub = document.createElement('small');
        let n = 0; const d = new Date();
        if (!checks[dateKey(d)]) d.setDate(d.getDate() - 1);
        while (checks[dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
        sub.textContent = n > 0 ? `🔥 连续 ${n} 天` : '还未开始';
        name.appendChild(sub);
        row.appendChild(name);
        days.forEach(day => {
          const k = dateKey(day);
          const cell = document.createElement('button');
          cell.className = 'habit-cell' + (checks[k] ? ' on' : '') + (k === tk ? ' today-cell' : '');
          cell.title = `${h.name} · ${k}`;
          if (k > tk) cell.disabled = true;
          cell.onclick = () => {
            S.habitChecks[h.id] = S.habitChecks[h.id] || {};
            if (S.habitChecks[h.id][k]) delete S.habitChecks[h.id][k];
            else S.habitChecks[h.id][k] = true;
            save(); render();
          };
          row.appendChild(cell);
        });
        const del = document.createElement('button');
        del.className = 'habit-del'; del.textContent = '✕'; del.title = '删除该习惯';
        del.onclick = () => {
          if (!confirm(`删除习惯「${h.name}」及其打卡记录？`)) return;
          S.habits = S.habits.filter(x => x.id !== h.id);
          delete S.habitChecks[h.id];
          save(); render();
        };
        row.appendChild(del);
        wrap.appendChild(row);
      }
      $('#habitWeekLabel', root).textContent =
        `${mon.getMonth() + 1}/${mon.getDate()} - ${days[6].getMonth() + 1}/${days[6].getDate()}`;
    };

    $('#habitForm', root).onsubmit = (e) => {
      e.preventDefault();
      const name = $('#habitInput', root).value.trim();
      if (!name) return;
      if (S.habits.length >= 8) return toast('最多 8 个习惯，聚焦最重要的事');
      S.habits.push({ id: uid(), name, created: Date.now() });
      $('#habitInput', root).value = '';
      save(); render();
    };
    render();
  },
});
