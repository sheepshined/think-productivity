/* =====================================================
 * 视图：导航 —— 常用网站书签墙（借鉴 gethomepage / Dashy）
 * ===================================================== */
App.registerView({
  id: 'bookmarks',
  title: '导航',
  icon: '🧭',
  render(root) {
    /* 按名字哈希取一组好看的颜色 */
    const COLORS = [
      'linear-gradient(135deg,#6366f1,#8b5cf6)', 'linear-gradient(135deg,#0ea5e9,#22d3ee)',
      'linear-gradient(135deg,#10b981,#5eead4)', 'linear-gradient(135deg,#f59e0b,#f97316)',
      'linear-gradient(135deg,#ec4899,#f472b6)', 'linear-gradient(135deg,#8b5cf6,#ec4899)',
      'linear-gradient(135deg,#14b8a6,#0ea5e9)', 'linear-gradient(135deg,#ef4444,#f97316)',
    ];
    const colorOf = (name) => {
      let h = 0;
      for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
      return COLORS[h % COLORS.length];
    };

    root.innerHTML = `
      <div class="view-title">🧭 导航</div>
      <div class="view-desc">常用网站一屏直达 · 点击卡片打开，悬停可删除</div>
      <section class="card glass span-12">
        <div id="bmGrid" class="bm-grid"></div>
        <form id="bmForm" class="form-row">
          <input id="bmName" type="text" placeholder="网站名称，如：哔哩哔哩" maxlength="30" autocomplete="off">
          <input id="bmUrl" type="text" placeholder="网址，如：bilibili.com" autocomplete="off">
          <button type="submit" class="btn primary">添加</button>
        </form>
      </section>`;

    const paint = () => {
      const grid = $('#bmGrid', root);
      if (!S.bookmarks.length) {
        grid.innerHTML = '<div class="empty" style="display:block">还没有收藏，下面添加第一个 ✨<br>试试 B站 / 知乎 / GitHub / 邮箱</div>';
        return;
      }
      grid.innerHTML = '';
      for (const b of S.bookmarks) {
        const a = document.createElement('a');
        a.className = 'bm-card';
        a.href = b.url;
        a.target = '_blank';
        a.rel = 'noopener';
        const ico = document.createElement('div');
        ico.className = 'bm-ico';
        ico.style.background = colorOf(b.name);
        // 在线时显示站点图标，失败回退首字母色块
        const img = document.createElement('img');
        img.alt = '';
        try { img.src = `https://www.google.com/s2/favicons?sz=64&domain=${new URL(b.url).hostname}`; } catch (e) {}
        img.onerror = () => img.remove();
        const letter = document.createElement('span');
        letter.textContent = b.name.trim().charAt(0).toUpperCase();
        ico.append(letter, img);
        const bt = document.createElement('div');
        bt.className = 'bt';
        const name = document.createElement('b'); name.textContent = b.name;
        const host = document.createElement('span');
        try { host.textContent = new URL(b.url).hostname.replace(/^www\./, ''); } catch (e) { host.textContent = b.url; }
        bt.append(name, host);
        const del = document.createElement('button');
        del.className = 'bx'; del.textContent = '✕'; del.title = '删除';
        del.onclick = (e) => { e.preventDefault(); e.stopPropagation(); S.bookmarks = S.bookmarks.filter(x => x.id !== b.id); save(); paint(); };
        a.append(ico, bt, del);
        grid.appendChild(a);
      }
    };

    $('#bmForm', root).onsubmit = (e) => {
      e.preventDefault();
      const name = $('#bmName', root).value.trim();
      let url = $('#bmUrl', root).value.trim();
      if (!name || !url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (!/^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(url)) return toast('网址格式不太对');
      S.bookmarks.push({ id: uid(), name, url, created: Date.now() });
      $('#bmName', root).value = '';
      $('#bmUrl', root).value = '';
      save(); paint();
    };

    paint();
  },
});
