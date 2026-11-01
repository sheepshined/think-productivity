/* =====================================================
 * 视图：倒数日 —— 重要日子倒计时 / 纪念日
 * ===================================================== */
App.registerView({
  id: 'countdown',
  title: '倒数日',
  icon: '🎯',
  render(root) {
    root.innerHTML = `
      <div class="view-title">🎯 倒数日</div>
      <div class="view-desc">考试、假期、生日、发版日…… 重要的日子都值得被看见</div>
      <div class="grid">
        <section class="card glass span-12">
          <div id="countGrid" class="count-grid"></div>
          <form id="countForm" class="form-row">
            <input id="countEmoji" class="emoji-in" type="text" placeholder="🎉" maxlength="4" autocomplete="off">
            <input id="countTitle" type="text" placeholder="事件名称，如：期末考试" maxlength="40" autocomplete="off">
            <input id="countDate" type="date" required>
            <button type="submit" class="btn primary">添加</button>
          </form>
        </section>
      </div>`;

    const paint = () => {
      const grid = $('#countGrid', root);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const items = S.countdowns
        .map(c => ({ ...c, days: Math.ceil((new Date(c.date + 'T00:00:00') - today) / 864e5) }))
        .sort((a, b) => a.days - b.days);

      if (!items.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1; display:block">下面添加第一个倒数日吧 ✨</div>';
        return;
      }
      grid.innerHTML = items.map(c => {
        const days = c.days;
        const label = days > 0 ? `D-${days}` : days === 0 ? '就是今天' : `${-days} 天前`;
        const when = days > 0 ? `${c.date} · 还有 ${days} 天` : days === 0 ? `就是今天（${c.date}）` : `${c.date} · 已过 ${-days} 天`;
        return `<div class="card glass count-card">
          <button class="cx" data-id="${c.id}" title="删除">✕</button>
          <div class="ce">${esc(c.emoji || '📌')}</div>
          <div class="ct">${esc(c.title)}</div>
          <div class="cd ${days === 0 ? 'is-today' : ''}">${label}</div>
          <div class="cw">${when}</div>
        </div>`;
      }).join('');
      $$('#countGrid .cx', root).forEach(b => b.onclick = () => {
        S.countdowns = S.countdowns.filter(x => x.id !== b.dataset.id);
        save(); paint();
      });
    };

    $('#countForm', root).onsubmit = (e) => {
      e.preventDefault();
      const title = $('#countTitle', root).value.trim();
      const date = $('#countDate', root).value;
      if (!title || !date) return;
      S.countdowns.push({
        id: uid(), title, date,
        emoji: $('#countEmoji', root).value.trim() || '📌',
        created: Date.now(),
      });
      $('#countTitle', root).value = '';
      $('#countEmoji', root).value = '';
      save(); paint();
    };

    // 日期输入默认值：今天
    $('#countDate', root).value = todayKey();
    paint();
  },
});
