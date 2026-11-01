/* =====================================================
 * 视图：复习 —— 错题本 · SM-2 间隔重复 · 面试系统联动
 * 数据来源: 面试系统 /api/reports/{id}/weak-points (低分考点)
 * ===================================================== */
App.registerView({
  id: 'review',
  title: '复习',
  icon: '🔁',
  render(root) {
    root.innerHTML = `
      <div class="view-title">🔁 错题复习</div>
      <div class="view-desc">面试答差的考点自动变成复习卡片，按 SM-2 间隔重复排期——今天该几张就清几张</div>
      <div class="grid">
        <section class="card glass span-7">
          <div class="card-head"><h2>📋 今日复习</h2><span id="rvStat" class="card-sub"></span></div>
          <div id="rvArea"></div>
        </section>

        <section class="card glass span-5">
          <div class="card-head"><h2>⬇ 从面试系统导入</h2><span class="card-sub">低分考点自动变卡片</span></div>
          <div class="set-row" style="border:none; padding-top:0">
            <div class="st">面试系统账号<small>仅保存在本机浏览器 (默认 admin)</small></div>
          </div>
          <div class="todo-form" style="margin-bottom:10px">
            <input id="rvUser" type="text" placeholder="用户名" style="flex:1">
            <input id="rvPass" type="password" placeholder="密码" style="flex:1">
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button id="rvImport" class="btn primary">导入最近报告的低分考点</button>
            <button id="rvConn" class="btn ghost">测试连接</button>
          </div>
          <div id="rvImportInfo" style="margin-top:12px; font-size:12.5px; color:var(--text-dim); line-height:1.8"></div>
          <div class="card-head sub"><h2>🔗 习惯联动</h2></div>
          <button id="rvHabit" class="btn ghost" style="width:100%">把「错题复习」加进习惯打卡</button>
          <div class="card-head sub"><h2>🗂 全部卡片</h2><span id="rvTotal" class="card-sub"></span></div>
          <ul id="rvAll" class="mini-list" style="max-height:230px; overflow-y:auto"></ul>
        </section>
      </div>`;

    const $r = (s) => root.querySelector(s);

    /* ---- 今日待复习队列 ---- */
    const dueCards = () => S.reviewCards.filter(c => (c.dueTs || 0) <= Date.now())
      .sort((a, b) => (a.dueTs || 0) - (b.dueTs || 0));

    function renderStat() {
      const due = dueCards().length;
      const tomorrow = Date.now() + 864e5;
      const upcoming = S.reviewCards.filter(c => (c.dueTs || 0) > Date.now() && (c.dueTs || 0) < tomorrow).length;
      $r('#rvStat').textContent = S.reviewCards.length
        ? `待复习 ${due} 张 · 明日到期 ${upcoming} 张 · 共 ${S.reviewCards.length} 张`
        : '还没有卡片';
      $r('#rvTotal').textContent = `${S.reviewCards.length} 张`;
    }

    function renderAll() {
      const ul = $r('#rvAll');
      ul.innerHTML = '';
      if (!S.reviewCards.length) {
        ul.innerHTML = '<li class="empty" style="display:block; padding:14px 0">导入后卡片会出现在这里</li>';
        return;
      }
      [...S.reviewCards].sort((a, b) => (a.dueTs || 0) - (b.dueTs || 0)).forEach(c => {
        const li = document.createElement('li');
        const dueTxt = (c.dueTs || 0) <= Date.now() ? 'now'
          : c.dueTs - Date.now() < 864e5 ? `${Math.ceil((c.dueTs - Date.now()) / 36e5)}h 后`
          : `${Math.round((c.dueTs - Date.now()) / 864e5)} 天后`;
        li.innerHTML = `<span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.question)}">${esc(c.question)}</span>
          <span class="streak-tag">${esc(c.category || '')} · ${dueTxt}</span>`;
        const del = document.createElement('button');
        del.className = 'todo-del'; del.textContent = '✕'; del.style.opacity = '1';
        del.title = '删除卡片';
        del.onclick = () => { S.reviewCards = S.reviewCards.filter(x => x.id !== c.id); save(); renderAll(); renderStat(); renderQueue(); };
        li.appendChild(del);
        ul.appendChild(li);
      });
    }

    /* ---- 复习卡片交互 ---- */
    let current = null, revealed = false;
    function renderQueue() {
      const area = $r('#rvArea');
      const due = dueCards();
      if (!current || !dueCards().find(c => c.id === current.id)) current = due[0] || null;
      if (!current) {
        revealed = false;
        area.innerHTML = S.reviewCards.length
          ? `<div class="empty" style="padding:36px 0">今天全部清完了 🎉<br><span style="font-size:12px">下次到期时间: ${new Date(Math.min(...S.reviewCards.map(c => c.dueTs || 8e15))).toLocaleString('zh-CN', { hour12: false })}</span></div>`
          : `<div class="empty" style="padding:36px 0">从右侧导入面试报告的低分考点，开始第一轮复习</div>`;
        return;
      }
      const c = current;
      area.innerHTML = `
        <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap">
          <span class="chip active">${esc(c.category || '未分类')}</span>
          <span class="chip">${esc(c.reportTitle || '面试报告')}</span>
          <span class="chip">得分 ${c.score}/${c.max || 10}</span>
          <span class="chip">复习 ${c.reps || 0} 次</span>
        </div>
        <div style="font-size:16px; font-weight:700; line-height:1.7; margin-bottom:14px">${esc(c.question)}</div>
        <div id="rvAnswer" style="display:${revealed ? 'block' : 'none'}">
          ${c.badPoints?.length ? `<div style="margin-bottom:10px"><b style="color:var(--danger); font-size:13px">✗ 当时暴露的问题</b>
            <ul style="margin:6px 0 0 18px; font-size:13.5px; line-height:1.8; color:var(--text)">${c.badPoints.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
          ${c.goodPoints?.length ? `<div><b style="color:var(--ok); font-size:13px">✓ 已掌握的部分</b>
            <ul style="margin:6px 0 0 18px; font-size:13.5px; line-height:1.8; color:var(--text)">${c.goodPoints.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
        </div>
        <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap">
          ${revealed ? `
            <button class="btn danger" data-g="0">😵 忘了</button>
            <button class="btn ghost" data-g="1">😅 勉强</button>
            <button class="btn primary" data-g="2">🙂 记得</button>
            <button class="btn primary" data-g="3">😎 轻松</button>`
            : `<button class="btn primary big" id="rvReveal">显示参考要点</button>`}
        </div>`;
      if (revealed) {
        $$('[data-g]', area).forEach(b => b.onclick = () => {
          scheduleCard(c, +b.dataset.g);
          save(); revealed = false; current = null;
          renderQueue(); renderStat(); renderAll();
        });
      } else {
        $r('#rvReveal').onclick = () => { revealed = true; renderQueue(); };
      }
    }

    /* ---- 导入低分考点 ---- */
    async function importWeak() {
      const info = $r('#rvImportInfo');
      S.settings.interviewAuth.username = $r('#rvUser').value.trim() || S.settings.interviewAuth.username;
      S.settings.interviewAuth.password = $r('#rvPass').value || S.settings.interviewAuth.password;
      InterviewAPI._token = null;    // 账号可能改了, 强制重登
      info.textContent = '连接面试系统…';
      try {
        const base = await InterviewAPI.login();
        const rep = await InterviewAPI.get('/api/reports');
        const reports = (rep.reports || []).slice(0, 5);
        if (!reports.length) { info.textContent = '面试系统里还没有报告，先完成一场模拟面试'; return; }
        let added = 0, skipped = 0;
        for (const r of reports) {
          const wp = await InterviewAPI.get(`/api/reports/${r.report_id}/weak-points?threshold=6`);
          if (!wp.success) continue;
          for (const it of wp.items || []) {
            const id = `${it.question_id || 'q'}@${r.report_id}`;
            if (S.reviewCards.find(c => c.id === id)) { skipped++; continue; }
            S.reviewCards.push({
              id, qid: it.question_id, question: it.question,
              category: it.category, score: it.score, max: it.max_score,
              badPoints: it.bad_points || [], goodPoints: it.good_points || [],
              reportId: r.report_id, reportTitle: wp.role_title || '面试报告',
              ease: 2.5, intervalDays: 0, reps: 0, lapses: 0,
              dueTs: Date.now(), addedAt: Date.now(),
            });
            added++;
          }
        }
        save(); renderQueue(); renderStat(); renderAll();
        info.innerHTML = `✓ 已连接 ${base} · 扫描最近 ${reports.length} 份报告<br>新增 <b style="color:var(--ok)">${added}</b> 张卡片${skipped ? ` · 跳过重复 ${skipped} 张` : ''}`;
      } catch (e) {
        info.innerHTML = `✗ ${esc(e.message)}<br>确认服务在跑: <code style="background:rgba(127,127,127,.15);padding:2px 6px;border-radius:6px">python E:\\think\\tools\\interview.py start</code>`;
      }
    }
    $r('#rvImport').onclick = importWeak;
    $r('#rvConn').onclick = async () => {
      const info = $r('#rvImportInfo');
      S.settings.interviewAuth.username = $r('#rvUser').value.trim() || S.settings.interviewAuth.username;
      S.settings.interviewAuth.password = $r('#rvPass').value || S.settings.interviewAuth.password;
      InterviewAPI._token = null;
      info.textContent = '连接中…';
      try {
        const base = await InterviewAPI.login();
        await InterviewAPI.get('/api/roles');
        info.textContent = `✓ 已连通 ${base}，账号验证通过`;
      } catch (e) {
        info.textContent = '✗ 连接失败：确认面试系统已启动、账号密码正确';
      }
    };

    /* ---- 习惯联动 ---- */
    $r('#rvHabit').onclick = () => {
      if (S.habits.find(h => h.name === '错题复习')) return toast('习惯里已经有「错题复习」了');
      if (S.habits.length >= 8) return toast('习惯最多 8 个，先删一个再加');
      S.habits.push({ id: uid(), name: '错题复习', created: Date.now() });
      save(); toast('已加入习惯打卡 🔥 今天记得来复习');
    };

    /* ---- 初始化 ---- */
    $r('#rvUser').value = S.settings.interviewAuth.username || 'admin';
    renderQueue(); renderStat(); renderAll();
  },
});
