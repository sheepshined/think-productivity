/* =====================================================
 * 视图：设置 —— 主题 / 数据 / 关于与借鉴致谢
 * ===================================================== */
App.registerView({
  id: 'settings',
  title: '设置',
  icon: '⚙️',
  render(root) {
    const todoDone = S.todos.filter(t => t.done).length;
    const city = S.settings.city;

    root.innerHTML = `
      <div class="view-title">⚙️ 设置</div>
      <div class="view-desc">所有设置即时生效并保存在本地</div>
      <div class="grid">
        <section class="card glass span-6">
          <div class="card-head"><h2>🎨 外观</h2></div>
          <div class="set-row">
            <div class="st">主题<small>暗色适合夜猫子，亮色适合白天</small></div>
            <span>
              <button class="chip ${S.theme === 'dark' ? 'active' : ''}" data-theme-set="dark">🌙 暗色</button>
              <button class="chip ${S.theme === 'light' ? 'active' : ''}" data-theme-set="light">☀️ 亮色</button>
            </span>
          </div>
        </section>

        <section class="card glass span-6">
          <div class="card-head"><h2>📍 功能入口</h2></div>
          <div class="set-row">
            <div class="st">天气城市<small>${city ? `当前：${esc(city.name)}${city.admin ? '·' + esc(city.admin) : ''}` : '未设置（天气卡在概览页）'}</small></div>
            <button class="btn ghost" data-go="overview">去概览页设置</button>
          </div>
          <div class="set-row">
            <div class="st">番茄时长<small>当前：专注 ${S.pomo.durations.work} / 小憩 ${S.pomo.durations.short} / 长休 ${S.pomo.durations.long} 分钟</small></div>
            <button class="btn ghost" data-go="focus">去专注页调整</button>
          </div>
        </section>

        <section class="card glass span-6">
          <div class="card-head"><h2>💾 数据</h2><span class="card-sub">全部仅存于本浏览器</span></div>
          <div class="set-row">
            <div class="st">备份与恢复<small>导出 JSON 文件，换电脑 / 换浏览器时导入即可</small></div>
            <span style="display:flex; gap:8px">
              <button id="setExport" class="btn ghost">导出</button>
              <button id="setImport" class="btn ghost">导入</button>
            </span>
          </div>
          <div class="set-row">
            <div class="st">当前数据量<small>${S.todos.length} 条待办（已完成 ${todoDone}）· ${S.habits.length} 个习惯 · ${S.countdowns.length} 个倒数日 · ${S.bookmarks.length} 个书签</small></div>
            <button id="setWipe" class="btn danger">清空全部</button>
          </div>
          <input type="file" id="setImportFile" accept=".json,application/json" hidden>
        </section>

        <section class="card glass span-6 credit">
          <div class="card-head"><h2>🧠 关于 THINK</h2><span class="card-sub">v2 · 2026-09-13</span></div>
          <div style="font-size:13.5px; line-height:1.9; color:var(--text-dim)">
            一个本地优先的个人工作台：零框架、零构建、零联网依赖（天气为唯一可选用联网功能）。<br>
            功能设计参考了这些优秀的开源项目，向它们致谢：
          </div>
          <ul>
            <li><a href="https://github.com/gethomepage/homepage" target="_blank" rel="noopener">gethomepage/homepage</a> ★32.5k — 书签导航、天气与信息卡的设计</li>
            <li><a href="https://github.com/glanceapp/glance" target="_blank" rel="noopener">glanceapp/glance</a> ★37k — 多卡片聚合概览布局</li>
            <li><a href="https://github.com/lissy93/dashy" target="_blank" rel="noopener">lissy93/dashy</a> ★26.4k — 书签卡片网格与多主题</li>
            <li><a href="https://github.com/super-productivity/super-productivity" target="_blank" rel="noopener">super-productivity</a> ★22k — 番茄钟 × 待办 × 统计的结合与 local-first 理念</li>
          </ul>
        </section>
      </div>`;

    $$('[data-theme-set]', root).forEach(b => b.onclick = () => {
      S.theme = b.dataset.themeSet;
      save(); App.applyTheme(); App.render('settings');
    });
    $$('[data-go]', root).forEach(b => b.onclick = () => App.go(b.dataset.go));
    $('#setExport', root).onclick = () => App.exportData();
    $('#setImport', root).onclick = () => $('#setImportFile', root).click();
    $('#setImportFile', root).addEventListener('change', (e) => {
      if (e.target.files[0]) App.importData(e.target.files[0]);
      e.target.value = '';
    });
    $('#setWipe', root).onclick = async () => {
      if (!confirm('确定清空全部数据？此操作不可恢复（建议先导出备份）')) return;
      await wipeAll();
      // 注意: 不能在 reload 前改 hash —— hashchange 会先触发 render→save() 把数据写回去
      location.reload();
    };
  },
});
