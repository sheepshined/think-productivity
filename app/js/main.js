/* =====================================================
 * THINK v2 —— 应用核心：视图注册 / 路由 / 侧边栏 / 命令面板
 * ===================================================== */
'use strict';

const App = {
  views: {},
  order: [],
  current: null,
  _tickers: [],

  registerView(def) {
    this.views[def.id] = def;
    this.order.push(def.id);
  },

  /* ---------- 路由（hash 驱动，刷新后停留在当前页） ---------- */
  go(id) {
    if (this.views[id]) location.hash = '#/' + id;
  },
  route() {
    const id = (location.hash || '').replace(/^#\//, '') || 'overview';
    this.render(this.views[id] ? id : 'overview');
  },
  render(id) {
    const root = $('#viewRoot');
    this._tickers = [];
    this.current = id;
    S.view = id; save();
    root.innerHTML = '';
    this.views[id].render(root);
    // 侧边栏高亮 + 徽标
    $$('#sideNav .side-item').forEach(b => b.classList.toggle('active', b.dataset.view === id));
    this.updateBadges();
    document.title = `${this.views[id].title} · THINK`;
    if (location.hash !== '#/' + id) history.replaceState(null, '', '#/' + id);
  },
  onTick(fn) { this._tickers.push(fn); },
  tick() {
    this._tickers.forEach(f => { try { f(); } catch (e) {} });
    const el = $('#footDate');
    if (el) {
      const now = new Date();
      el.textContent = `今天是 ${now.getFullYear()} 年的第 ${dayOfYear(now)} 天`;
    }
  },

  /* ---------- 侧边栏 ---------- */
  buildNav() {
    const groups = [
      { label: '效率', ids: ['overview', 'calendar', 'todos', 'focus', 'habits', 'review', 'notes'] },
      { label: '工具', ids: ['interview', 'countdown', 'bookmarks', 'stats'] },
      { label: '系统', ids: ['settings'] },
    ];
    const nav = $('#sideNav');
    nav.innerHTML = groups.map(g =>
      `<div class="side-section">${g.label}</div>` + g.ids.map(id => {
        const v = this.views[id];
        return `<button class="side-item" data-view="${id}" title="${v.title}">
          <span class="ico">${v.icon}</span><span>${v.title}</span>
          <span class="badge hidden" data-badge="${id}"></span></button>`;
      }).join('')
    ).join('');
    $$('#sideNav .side-item').forEach(b => b.onclick = () => this.go(b.dataset.view));
  },
  updateBadges() {
    const pending = S.todos.filter(t => !t.done).length;
    $$('[data-badge="todos"]').forEach(el => {
      el.textContent = pending;
      el.classList.toggle('hidden', !pending);
    });
  },

  /* ---------- 主题 ---------- */
  applyTheme() {
    document.documentElement.dataset.theme = S.theme;
    $('#btnTheme').textContent = S.theme === 'dark' ? '🌙' : '☀️';
  },
  toggleTheme() {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    save(); this.applyTheme();
    if (this.current === 'settings' && typeof this.views.settings.onShow === 'function') this.views.settings.onShow();
  },

  /* ---------- 数据导入导出 ---------- */
  exportData() {
    const blob = new Blob([JSON.stringify({ app: 'THINK', version: 2, exportedAt: new Date().toISOString(), ...S }, null, 2)],
      { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `think-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已导出到下载目录 ⬇');
  },
  importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object' || !Array.isArray(data.todos)) throw new Error('格式不对');
        migrate(data);
        S = mergeDefaults(structuredClone(DEFAULTS), data);
        save(); this.applyTheme(); this.route();
        toast('导入成功 ✅');
      } catch (err) { toast('导入失败：文件格式不正确'); }
    };
    reader.readAsText(file);
  },

  /* ---------- 命令面板 ---------- */
  paletteSel: 0,
  paletteItems() {
    const jump = this.order.map(id => ({
      icon: this.views[id].icon, label: `打开「${this.views[id].title}」`, hint: '页面', run: () => this.go(id),
    }));
    const actions = [
      { icon: '➕', label: '新建待办', hint: '动作', run: () => { this.go('todos'); setTimeout(() => { const i = $('#todoInput'); i && i.focus(); }, 60); } },
      { icon: '▶️', label: '开始专注（番茄钟 25 分钟）', hint: '动作', run: () => { this.go('focus'); setTimeout(() => window.__pomoStartPause && window.__pomoStartPause(), 60); } },
      { icon: '🌗', label: '切换亮 / 暗主题', hint: '动作', run: () => this.toggleTheme() },
      { icon: '⬇', label: '导出数据备份', hint: '动作', run: () => this.exportData() },
    ];
    return [...actions, ...jump];
  },
  openPalette() {
    $('#paletteMask').classList.remove('hidden');
    const input = $('#paletteInput');
    input.value = '';
    this.paletteSel = 0;
    this.renderPalette('');
    input.focus();
  },
  closePalette() { $('#paletteMask').classList.add('hidden'); },
  renderPalette(q) {
    const items = this.paletteItems().filter(it => it.label.toLowerCase().includes(q.toLowerCase()));
    this._paletteItems = items;
    const list = $('#paletteList');
    if (!items.length) { list.innerHTML = '<li class="empty">没有匹配的命令</li>'; return; }
    if (this.paletteSel >= items.length) this.paletteSel = items.length - 1;
    list.innerHTML = items.map((it, i) =>
      `<li data-i="${i}" class="${i === this.paletteSel ? 'sel' : ''}">
        <span class="pi">${it.icon}</span>${esc(it.label)}<small>${it.hint}</small></li>`).join('');
    $$('#paletteList li').forEach(li => {
      li.onclick = () => { this.closePalette(); items[+li.dataset.i].run(); };
      li.onmousemove = () => { this.paletteSel = +li.dataset.i; $$('#paletteList li').forEach(x => x.classList.toggle('sel', x === li)); };
    });
  },

  /* ---------- 启动 ---------- */
  boot() {
    this.buildNav();
    this.applyTheme();

    $('#btnTheme').onclick = () => this.toggleTheme();
    $('#btnPalette').onclick = () => this.openPalette();

    // 数据菜单
    const menu = $('#dataMenu');
    $('#btnData').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); };
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== $('#btnData')) menu.classList.add('hidden');
    });
    $('#btnExport').onclick = () => { menu.classList.add('hidden'); this.exportData(); };
    $('#btnImport').onclick = () => { menu.classList.add('hidden'); $('#importFile').click(); };
    $('#importFile').addEventListener('change', (e) => {
      if (e.target.files[0]) this.importData(e.target.files[0]);
      e.target.value = '';
    });
    $('#btnWipe').onclick = async () => {
      menu.classList.add('hidden');
      if (!confirm('确定清空全部数据？此操作不可恢复（建议先导出备份）')) return;
      await wipeAll();
      location.reload();   // 不能先改 hash: hashchange→render→save() 会把数据写回去
    };

    // 命令面板键盘交互
    const mask = $('#paletteMask');
    mask.addEventListener('click', (e) => { if (e.target === mask) this.closePalette(); });
    $('#paletteInput').addEventListener('input', (e) => { this.paletteSel = 0; this.renderPalette(e.target.value); });
    $('#paletteInput').addEventListener('keydown', (e) => {
      const items = this._paletteItems || [];
      if (e.key === 'ArrowDown') { e.preventDefault(); this.paletteSel = Math.min(items.length - 1, this.paletteSel + 1); this.renderPalette($('#paletteInput').value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.paletteSel = Math.max(0, this.paletteSel - 1); this.renderPalette($('#paletteInput').value); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[this.paletteSel]) { this.closePalette(); items[this.paletteSel].run(); } }
      else if (e.key === 'Escape') this.closePalette();
    });

    // 全局快捷键
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.openPalette(); return; }
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (!typing && e.key.toLowerCase() === 'n') {
        e.preventDefault(); this.go('todos');
        setTimeout(() => { const i = $('#todoInput'); i && i.focus(); }, 60);
      }
    });

    window.addEventListener('hashchange', () => this.route());
    this.route();
    this.tick();
    setInterval(() => this.tick(), 1000);
  },
};
