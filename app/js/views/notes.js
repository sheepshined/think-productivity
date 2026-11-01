/* =====================================================
 * 视图：笔记 —— 多笔记笔记本
 * 列表 + 编辑器双栏：搜索 / 置顶 / 自动保存 / 导出 Markdown
 * ===================================================== */
App.registerView({
  id: 'notes',
  title: '笔记',
  icon: '📝',
  render(root) {
    root.innerHTML = `
      <div class="view-title">📝 笔记本</div>
      <div class="view-desc">多笔记管理 · 停手半秒自动保存 · 可导出 Markdown</div>
      <section class="card glass span-12">
        <div class="nb-wrap">
          <div class="nb-side">
            <div class="nb-search">
              <input id="nbSearch" type="text" placeholder="搜索笔记…" autocomplete="off">
              <button id="nbNew" class="btn primary" style="padding:9px 14px; flex-shrink:0">＋ 新建</button>
            </div>
            <ul id="nbList" class="nb-list"></ul>
          </div>
          <div class="nb-main" id="nbMain">
            <div class="empty" id="nbEmpty" style="margin:auto; display:none">
              还没有笔记，点左侧「＋ 新建」开始 ✨<br><br>
              面试复盘、读书摘录、周报草稿…都适合放在这里
            </div>
            <div id="nbEditor">
              <input id="nbTitle" class="nb-title" type="text" placeholder="标题" maxlength="80" autocomplete="off">
              <textarea id="nbBody" class="nb-body" placeholder="正文…支持纯文本，自动保存" spellcheck="false"></textarea>
              <div class="nb-foot">
                <span id="nbMeta"></span>
                <span class="ops">
                  <button id="nbPin" class="btn ghost">📌 置顶</button>
                  <button id="nbCopy" class="btn ghost">复制</button>
                  <button id="nbDownload" class="btn ghost">导出 .md</button>
                  <button id="nbDel" class="btn danger">删除</button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>`;

    let currentId = null;
    const $l = (s) => $(s, root);

    const getNote = (id) => S.notes.find(n => n.id === id);

    const visibleNotes = () => {
      const q = $l('#nbSearch').value.trim().toLowerCase();
      let list = S.notes;
      if (q) list = list.filter(n =>
        (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q));
      return [...list].sort((a, b) =>
        (b.pinned - a.pinned) || (b.updated - a.updated));
    };

    const fmtTime = (ts) => {
      const d = new Date(ts);
      const sameDay = dateKey(d) === todayKey();
      const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return sameDay ? `今天 ${hm}` : `${dateKey(d).slice(5)} ${hm}`;
    };

    const renderList = () => {
      const list = $l('#nbList');
      list.innerHTML = '';
      $l('#nbEmpty').style.display = S.notes.length ? 'none' : 'block';
      $l('#nbEditor').style.display = S.notes.length ? 'flex' : 'none';

      for (const n of visibleNotes()) {
        const li = document.createElement('li');
        li.className = 'nb-item' + (n.id === currentId ? ' sel' : '');
        const t = document.createElement('div');
        t.className = 'nt';
        if (n.pinned) { const p = document.createElement('span'); p.className = 'pin-ico'; p.textContent = '📌'; t.appendChild(p); }
        t.appendChild(document.createTextNode(n.title || '无标题笔记'));
        const m = document.createElement('div');
        m.className = 'nm';
        m.textContent = `${fmtTime(n.updated)} · ${(n.body || '').replace(/\s+/g, ' ').slice(0, 30) || '（空）'}`;
        li.append(t, m);
        li.onclick = () => openNote(n.id);
        list.appendChild(li);
      }
    };

    const renderMeta = () => {
      const n = getNote(currentId);
      if (!n) { $l('#nbMeta').textContent = ''; return; }
      const chars = ($l('#nbBody').value || '').length;
      $l('#nbMeta').textContent = `${chars} 字 · 更新于 ${fmtTime(n.updated)}`;
      $l('#nbPin').textContent = n.pinned ? '📌 已置顶' : '📌 置顶';
      $l('#nbPin').style.color = n.pinned ? 'var(--accent)' : '';
    };

    const openNote = (id) => {
      currentId = id;
      const n = getNote(id);
      if (!n) return;
      $l('#nbTitle').value = n.title || '';
      $l('#nbBody').value = n.body || '';
      renderList(); renderMeta();
    };

    /* 自动保存：停手 500ms 落盘，列表标题/时间同步刷新但不重排焦点 */
    let saveTimer;
    const scheduleSave = () => {
      const n = getNote(currentId);
      if (!n) return;
      n.title = $l('#nbTitle').value;
      n.body = $l('#nbBody').value;
      n.updated = Date.now();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        save();
        // 只更新对应列表项文本，避免重建列表打断输入
        const items = visibleNotes();
        const li = [...$l('#nbList').children];
        items.forEach((note, i) => {
          if (!li[i]) return;
          li[i].querySelector('.nt').lastChild.textContent = note.title || '无标题笔记';
          li[i].querySelector('.nm').textContent = `${fmtTime(note.updated)} · ${(note.body || '').replace(/\s+/g, ' ').slice(0, 30) || '（空）'}`;
        });
        renderMeta();
      }, 500);
    };
    $l('#nbTitle').addEventListener('input', scheduleSave);
    $l('#nbBody').addEventListener('input', scheduleSave);

    $l('#nbNew').onclick = () => {
      const n = { id: uid(), title: '', body: '', created: Date.now(), updated: Date.now(), pinned: false };
      S.notes.unshift(n);
      save();
      openNote(n.id);
      $l('#nbTitle').focus();
    };

    $l('#nbSearch').addEventListener('input', renderList);

    $l('#nbPin').onclick = () => {
      const n = getNote(currentId); if (!n) return;
      n.pinned = !n.pinned; n.updated = Date.now();
      save(); renderList(); renderMeta();
      toast(n.pinned ? '已置顶 📌' : '已取消置顶');
    };

    $l('#nbCopy').onclick = async () => {
      const n = getNote(currentId); if (!n) return;
      const text = (n.title ? n.title + '\n\n' : '') + (n.body || '');
      try { await navigator.clipboard.writeText(text); toast('已复制全文 📋'); }
      catch (e) { toast('复制失败'); }
    };

    $l('#nbDownload').onclick = () => {
      const n = getNote(currentId); if (!n) return;
      const name = (n.title || '笔记').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
      const blob = new Blob([(n.title ? `# ${n.title}\n\n` : '') + (n.body || '')], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('已导出 Markdown ⬇');
    };

    $l('#nbDel').onclick = () => {
      const n = getNote(currentId); if (!n) return;
      if (!confirm(`删除笔记「${n.title || '无标题'}」？不可恢复`)) return;
      S.notes = S.notes.filter(x => x.id !== n.id);
      save();
      currentId = S.notes[0]?.id || null;
      if (currentId) openNote(currentId);
      else { $l('#nbTitle').value = ''; $l('#nbBody').value = ''; renderList(); }
      toast('已删除');
    };

    currentId = S.notes[0]?.id || null;
    if (currentId) openNote(currentId);
    else renderList();
  },
});
