/* =====================================================
 * 视图：待办 —— 完整清单（筛选 / 完成时间 / 批量清理）
 * ===================================================== */
App.registerView({
  id: 'todos',
  title: '待办',
  icon: '✅',
  render(root) {
    root.innerHTML = `
      <div class="view-title">✅ 今日待办</div>
      <div class="view-desc">回车添加 · N 键快速聚焦 · 完成的条目会记录时间供统计页使用</div>
      <section class="card glass span-12" style="max-width:860px">
        <div class="card-head"><h2>清单</h2><span id="todoStat" class="card-sub"></span></div>
        <form id="todoForm" class="todo-form">
          <input id="todoInput" type="text" placeholder="想做点什么？回车添加" maxlength="120" autocomplete="off">
          <button type="submit" class="btn primary">添加</button>
        </form>
        <div class="todo-filters">
          <button class="chip" data-filter="all">全部</button>
          <button class="chip" data-filter="active">未完成</button>
          <button class="chip" data-filter="done">已完成</button>
          <button id="todoClearDone" class="chip ghost">清除已完成</button>
          <button id="todoClearAll" class="chip ghost">清空全部</button>
        </div>
        <ul id="todoList" class="todo-list"></ul>
      </section>`;

    const fmtTime = (ts) => {
      const d = new Date(ts);
      const tk = dateKey(d);
      const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return tk === todayKey() ? `今天 ${hm}` : `${tk.slice(5)} ${hm}`;
    };

    const render = () => {
      const list = $('#todoList', root);
      list.innerHTML = '';
      const items = S.todos.filter(t =>
        S.todoFilter === 'all' ? true : S.todoFilter === 'done' ? t.done : !t.done);
      items.sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

      if (!items.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = S.todos.length ? '这一栏没有内容 ~' : '添加第一项待办吧 ✨';
        list.appendChild(li);
      }
      for (const t of items) {
        const li = document.createElement('li');
        li.className = 'todo-item' + (t.done ? ' done' : '');
        const chk = document.createElement('button');
        chk.className = 'todo-check'; chk.textContent = '✓';
        chk.title = t.done ? '标记为未完成' : '完成';
        chk.onclick = () => {
          t.done = !t.done;
          t.completedAt = t.done ? Date.now() : null;
          save(); render(); App.updateBadges();
        };
        const span = document.createElement('span');
        span.className = 'todo-text'; span.textContent = t.text;
        li.append(chk, span);
        if (t.done && t.completedAt) {
          const tm = document.createElement('span');
          tm.className = 'todo-time'; tm.textContent = fmtTime(t.completedAt);
          li.appendChild(tm);
        }
        const del = document.createElement('button');
        del.className = 'todo-del'; del.textContent = '✕'; del.title = '删除';
        del.onclick = () => { S.todos = S.todos.filter(x => x.id !== t.id); save(); render(); App.updateBadges(); };
        li.appendChild(del);
        list.appendChild(li);
      }
      const remain = S.todos.filter(t => !t.done).length;
      $('#todoStat', root).textContent = remain ? `${remain} 项待完成` : (S.todos.length ? '全部完成 🎉' : '0 项待办');
      $$('.todo-filters .chip[data-filter]', root).forEach(b =>
        b.classList.toggle('active', b.dataset.filter === S.todoFilter));
    };

    $('#todoForm', root).onsubmit = (e) => {
      e.preventDefault();
      const text = $('#todoInput', root).value.trim();
      if (!text) return;
      S.todos.push({ id: uid(), text, done: false, created: Date.now(), completedAt: null });
      $('#todoInput', root).value = '';
      save(); render(); App.updateBadges();
    };
    $$('.todo-filters .chip[data-filter]', root).forEach(btn => {
      btn.onclick = () => { S.todoFilter = btn.dataset.filter; save(); render(); };
    });
    $('#todoClearDone', root).onclick = () => {
      const n = S.todos.filter(t => t.done).length;
      if (!n) return toast('没有已完成的项');
      S.todos = S.todos.filter(t => !t.done);
      save(); render(); App.updateBadges(); toast(`已清除 ${n} 项`);
    };
    $('#todoClearAll', root).onclick = () => {
      if (!S.todos.length) return;
      if (!confirm(`清空全部 ${S.todos.length} 条待办？`)) return;
      S.todos = [];
      save(); render(); App.updateBadges(); toast('已清空');
    };
    render();
  },
});
