/* =====================================================
 * 视图：面试 —— AI 模拟面试系统启动台
 * 管理 E:\hiagent\DEMO3\TOtal 的前后端服务（:8000 / :3000）
 * 状态探测用 no-cors ping，不受后端 CORS 白名单限制
 * ===================================================== */
App.registerView({
  id: 'interview',
  title: '面试',
  icon: '🎤',
  render(root) {
    root.innerHTML = `
      <div class="view-title">🎤 AI 模拟面试系统</div>
      <div class="view-desc">整合自 E:\\hiagent\\DEMO3\\TOtal —— 大模型应用开发专场 · 47 道真题 · LangGraph 追问式面试 · Markdown 报告</div>
      <div class="grid">
        <section class="card glass span-7">
          <div class="card-head"><h2>🚦 服务状态</h2>
            <button id="ivRefresh" class="chip">↻ 刷新</button></div>
          <div id="ivStatus" class="iv-status">
            <div class="iv-svc" data-port="8000">
              <span class="iv-dot"></span>
              <div class="grow"><b>后端 FastAPI</b><small>题库检索 / 评分 / WebSocket · :8000</small></div>
              <span class="iv-state">检测中…</span>
            </div>
            <div class="iv-svc" data-port="3000">
              <span class="iv-dot"></span>
              <div class="grow"><b>前端 Vue</b><small>面试界面 · :3000</small></div>
              <span class="iv-state">检测中…</span>
            </div>
          </div>
          <div class="iv-actions">
            <button id="ivOpen" class="btn primary big">🖥 打开面试系统</button>
            <button id="ivEmbedToggle" class="btn ghost">页面内嵌预览</button>
          </div>
          <div id="ivEmbedBox" class="iv-embed hidden"></div>
        </section>

        <section class="card glass span-5">
          <div class="card-head"><h2>🛠 服务管理</h2><span class="card-sub">本机命令</span></div>
          <div class="iv-cmd">
            <code>python E:\\think\\tools\\interview.py start</code>
            <button class="chip" data-copy="python E:\\think\\tools\\interview.py start">复制</button>
            <small>一条命令启动前后端并打开浏览器</small>
          </div>
          <div class="iv-cmd">
            <code>python E:\\think\\tools\\interview.py stop</code>
            <button class="chip" data-copy="python E:\\think\\tools\\interview.py stop">复制</button>
            <small>停止两个服务</small>
          </div>
          <div class="iv-cmd">
            <code>python E:\\think\\tools\\interview.py doctor</code>
            <button class="chip" data-copy="python E:\\think\\tools\\interview.py doctor">复制</button>
            <small>环境体检（venv / 依赖 / 向量库）</small>
          </div>
          <div class="set-row" style="border:none; padding-bottom:0">
            <div class="st">演示账号<small>admin / 123123 · 报告按账号隔离</small></div>
          </div>
          <div class="set-row" style="border:none">
            <div class="st">接口文档<small>后端在运行时可访问 /docs</small></div>
            <button id="ivDocs" class="btn ghost">打开 ↗</button>
          </div>
        </section>

        <section class="card glass span-12">
          <div class="card-head"><h2>💡 这套系统能做什么</h2><span class="card-sub">FastAPI + LangGraph + Vue 3</span></div>
          <div class="iv-feats">
            <div><b>📄 简历解析</b><small>上传 PDF 或粘贴文本，自动匹配岗位</small></div>
            <div><b>🎯 LLM 应用专场题库</b><small>47 道大模型应用开发真题：RAG / Agent / 微调 / MCP…</small></div>
            <div><b>💬 追问式面试</b><small>LangGraph 人在回路：回答→评分→低分追问</small></div>
            <div><b>📊 面试报告</b><small>Markdown 总结 + 能力雷达图，可回看历史</small></div>
          </div>
        </section>
      </div>`;

    /* ---- 状态探测（首次失败自动重试一次，避免冷启动误报） ---- */
    const pingOnce = async (port) => {
      try {
        await fetch(`http://127.0.0.1:${port}/`, { mode: 'no-cors', signal: AbortSignal.timeout(2500) });
        return true;
      } catch (e) { return false; }
    };
    const ping = async (port) => (await pingOnce(port)) || (await new Promise(r => setTimeout(r, 600), pingOnce(port)));
    const check = async () => {
      const [b, f] = await Promise.all([ping(8000), ping(3000)]);
      $$('#ivStatus .iv-svc', root).forEach(row => {
        const up = row.dataset.port === '8000' ? b : f;
        row.classList.toggle('up', up);
        row.classList.toggle('down', !up);
        $('.iv-state', row).textContent = up ? '运行中' : '未启动';
      });
      const box = $('#ivEmbedBox', root);
      if (!box.classList.contains('hidden')) renderEmbed(f);
      $('#ivEmbedToggle', root).textContent = box.classList.contains('hidden') ? '页面内嵌预览' : '收起预览';
      return { b, f };
    };
    const renderEmbed = (up) => {
      const box = $('#ivEmbedBox', root);
      if (up) {
        box.innerHTML = '<iframe src="http://127.0.0.1:3000/" style="width:100%;height:680px;border:0;border-radius:14px;background:#fff" title="AI 模拟面试系统"></iframe>';
      } else {
        box.innerHTML = `<div class="empty" style="padding:40px 0">前端还没启动 —— 在命令行执行下面这条命令，等它就绪后刷新即可<br><br>
          <code style="background:rgba(127,127,127,.15);padding:6px 12px;border-radius:8px">python E:\\think\\tools\\interview.py start</code><br><br>
          <small style="color:var(--text-dim)">提示：若打开系统后接口报 404，多半是 8000 端口被其他程序占用，<br>执行 <code>python E:\\think\\tools\\interview.py status</code> 可查看占用者，start 会自动换端口规避。</small>`;
      }
    };
    check();
    $('#ivRefresh', root).onclick = () => { toast('正在检测…'); check(); };
    $('#ivOpen', root).onclick = () => window.open('http://127.0.0.1:3000/', '_blank');
    $('#ivDocs', root).onclick = () => window.open('http://127.0.0.1:8000/docs', '_blank');
    $('#ivEmbedToggle', root).onclick = async () => {
      const box = $('#ivEmbedBox', root);
      if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
        const { f } = await check();
        renderEmbed(f);
      } else {
        box.classList.add('hidden');
        $('#ivEmbedToggle', root).textContent = '页面内嵌预览';
      }
    };
    $$('[data-copy]', root).forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('已复制 📋'); }
      catch (e) { toast('复制失败，请手动选择'); }
    });
  },
});
