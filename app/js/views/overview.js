/* =====================================================
 * 视图：概览 —— 时钟 · 搜索 · 天气 · 今日速览
 * ===================================================== */
App.registerView({
  id: 'overview',
  title: '概览',
  icon: '🏠',
  render(root) {
    root.innerHTML = `
      <section class="hero card glass">
        <div class="hero-left">
          <div id="greeting" class="greeting">你好</div>
          <div class="date-line">
            <span id="dateCN"></span><span class="dot">·</span>
            <span id="lunarCN"></span><span class="dot">·</span>
            <span id="festival" class="festival"></span>
          </div>
          <div class="week-progress" title="本周已过去的时间比例">
            <div class="week-bar"><div id="weekFill" class="week-fill"></div></div>
            <div id="weekLabel" class="week-label"></div>
          </div>
        </div>
        <div class="hero-right">
          <div id="clock" class="clock">00:00</div>
          <div id="clockSec" class="clock-sec">00</div>
        </div>
      </section>

      <div class="grid">
        <section class="card glass span-7">
          <div class="card-head"><h2>🔍 快速搜索</h2><span class="card-sub">输入网址直达 · 其他走百度</span></div>
          <form id="searchForm" class="searchbar">
            <input id="searchInput" type="text" placeholder="搜索或输入网址，回车打开" autocomplete="off">
            <button class="btn primary" type="submit">前往</button>
          </form>
        </section>
        <section class="card glass span-5" id="weatherCard"></section>

        <section class="card glass span-5">
          <div class="card-head"><h2>✅ 今日待办</h2><span id="ovTodoStat" class="card-sub"></span></div>
          <form id="ovTodoForm" class="todo-form">
            <input id="ovTodoInput" type="text" placeholder="想做点什么？回车添加" maxlength="120" autocomplete="off">
            <button type="submit" class="btn primary">添加</button>
          </form>
          <ul id="ovTodoList" class="mini-list"></ul>
        </section>

        <section class="card glass span-4">
          <div class="card-head"><h2>🔥 今日习惯</h2><span id="ovHabitDate" class="card-sub"></span></div>
          <div id="ovHabits" class="habit-quick"></div>
        </section>

        <section class="card glass span-3">
          <div class="card-head"><h2>🎯 最近倒数日</h2></div>
          <div id="ovCountdowns"></div>
        </section>

        <section class="card glass span-12">
          <div class="card-head sub" style="margin-top:0"><h2>💡 每日一言</h2>
            <button id="quoteNext" class="icon-btn small" title="换一句">⟳</button></div>
          <blockquote id="quoteText" class="quote">“”<footer id="quoteFrom"></footer></blockquote>
        </section>
      </div>`;

    /* ---- 时钟 ---- */
    const tickClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      $('#clock', root).textContent = `${hh}:${mm}`;
      $('#clockSec', root).textContent = String(now.getSeconds()).padStart(2, '0');
      const h = now.getHours();
      $('#greeting', root).textContent =
        h < 5 ? '夜深了，早点休息 🌙' : h < 9 ? '早上好，新的一天 ☀️' : h < 12 ? '上午好，保持专注 💡' :
        h < 14 ? '中午好，休息一下 🍱' : h < 18 ? '下午好，继续加油 ⚡' : h < 23 ? '晚上好，今天过得如何 🌆' : '夜深了，早点休息 🌙';
      $('#dateCN', root).textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK_CN[now.getDay()]}`;
      const lunar = lunarInfo(now);
      if (lunar) {
        $('#lunarCN', root).textContent = lunar.text;
        const f = festivalOf(now, lunar);
        $('#festival', root).textContent = f ? `🏮 ${f}` : '';
      }
      const mon = mondayOf(now);
      const pct = Math.min(100, (now - mon) / (7 * 864e5) * 100);
      $('#weekFill', root).style.width = pct.toFixed(1) + '%';
      $('#weekLabel', root).textContent = `本周已过 ${pct.toFixed(0)}%`;
    };
    tickClock();
    App.onTick(tickClock);

    /* ---- 快速搜索 ---- */
    $('#searchForm', root).onsubmit = (e) => {
      e.preventDefault();
      const q = $('#searchInput', root).value.trim();
      if (!q) return;
      const isUrl = /^(https?:\/\/)?([\w-]+\.)+[a-zA-Z]{2,}(\/\S*)?$/.test(q) && !q.includes(' ');
      window.open(isUrl ? (q.startsWith('http') ? q : 'https://' + q) : `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`, '_blank');
      $('#searchInput', root).value = '';
    };

    /* ---- 天气 ---- */
    const WMO = {
      0:['☀️','晴'],1:['🌤','基本晴'],2:['⛅','多云'],3:['☁️','阴'],45:['🌫','雾'],48:['🌫','雾凇'],
      51:['🌦','小毛毛雨'],53:['🌦','毛毛雨'],55:['🌧','大毛毛雨'],56:['🌧','冻毛毛雨'],57:['🌧','冻雨'],
      61:['🌧','小雨'],63:['🌧','中雨'],65:['🌧','大雨'],66:['🌧','冻雨'],67:['🌧','强冻雨'],
      71:['🌨','小雪'],73:['🌨','中雪'],75:['❄️','大雪'],77:['🌨','米雪'],
      80:['🌦','阵雨'],81:['🌧','阵雨'],82:['🌧','强阵雨'],85:['🌨','阵雪'],86:['❄️','强阵雪'],
      95:['⛈','雷阵雨'],96:['⛈','雷雨伴冰雹'],99:['⛈','强雷雨冰雹'],
    };
    const wmo = (c) => WMO[c] || ['🌡','—'];

    const renderWeather = () => {
      const card = $('#weatherCard', root);
      const city = S.settings.city;
      if (!city) {
        card.innerHTML = `
          <div class="card-head"><h2>🌤 天气</h2><span class="card-sub">Open-Meteo 免费 API</span></div>
          <div class="empty">设置一个城市，每天打开就能看到天气</div>
          <form id="cityForm" class="form-row" style="margin-top:6px">
            <input id="cityInput" type="text" placeholder="如：北京 / 上海 / Chengdu" autocomplete="off">
            <button class="btn primary" type="submit">查找</button>
          </form>
          <div id="cityResults" style="margin-top:10px"></div>`;
        $('#cityForm', card).onsubmit = async (e) => {
          e.preventDefault();
          const name = $('#cityInput', card).value.trim();
          if (!name) return;
          const box = $('#cityResults', card);
          box.innerHTML = '<div class="empty">搜索中…</div>';
          try {
            const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=zh&format=json`);
            const data = await r.json();
            const list = data.results || [];
            if (!list.length) { box.innerHTML = '<div class="empty">没找到这个城市</div>'; return; }
            box.innerHTML = list.map((c, i) =>
              `<button class="chip" data-i="${i}" style="margin:3px">${esc(c.name)}·${esc(c.admin1 || '')}·${esc(c.country || '')}</button>`).join('');
            $$('#cityResults .chip', card).forEach(btn => btn.onclick = () => {
              const c = list[+btn.dataset.i];
              S.settings.city = { name: c.name, admin: c.admin1 || '', lat: c.latitude, lon: c.longitude };
              save(); loadWeather(true);
            });
          } catch (err) { box.innerHTML = '<div class="empty">搜索失败，请检查网络</div>'; }
        };
        return;
      }
      const cached = (S.weatherCache && Date.now() - S.weatherCache.at < 30 * 60 * 1000) ? S.weatherCache.data : null;
      if (!cached) { card.innerHTML = `<div class="card-head"><h2>🌤 天气</h2></div><div class="empty">天气加载中…</div>`; return; }
      const cur = cached.current, today = cached.daily;
      const [ci, ct] = wmo(cur.weather_code);
      card.innerHTML = `
        <div class="card-head"><h2>🌤 ${esc(city.name)}${city.admin ? '·' + esc(city.admin) : ''}</h2>
          <span class="card-sub"><button id="cityReset" class="chip ghost" style="margin-right:6px">换城市</button>30 分钟缓存</span></div>
        <div class="weather-now">
          <div class="weather-icon">${ci}</div>
          <div>
            <div class="weather-temp">${Math.round(cur.temperature_2m)}°C <small>体感 ${Math.round(cur.apparent_temperature)}°</small></div>
            <div class="weather-meta">${ct} · 湿度 ${cur.relative_humidity_2m}% · 风 ${Math.round(cur.wind_speed_10m)} km/h</div>
          </div>
        </div>
        <div class="weather-daily">${today.time.slice(0, 3).map((t, i) => {
          const [di, dt] = wmo(today.weather_code[i]);
          return `<div class="weather-day">${i === 0 ? '今天' : i === 1 ? '明天' : '后天'}
            <div class="wd-icon">${di}</div>${dt}<br>${Math.round(today.temperature_2m_min[i])}° / ${Math.round(today.temperature_2m_max[i])}°</div>`;
        }).join('')}</div>`;
      $('#cityReset', card).onclick = () => { S.settings.city = null; S.weatherCache = null; save(); renderWeather(); };
    };

    const loadWeather = async (force) => {
      renderWeather();
      const city = S.settings.city;
      if (!city) return;
      const fresh = S.weatherCache && Date.now() - S.weatherCache.at < 30 * 60 * 1000;
      if (fresh && !force) { renderWeather(); return; }
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 7000);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
        const r = await fetch(url, { signal: ctl.signal });
        clearTimeout(timer);
        if (!r.ok) throw new Error(r.status);
        S.weatherCache = { at: Date.now(), data: await r.json() };
        save();
      } catch (err) {
        const card = $('#weatherCard', root);
        if (card && !S.weatherCache) {
          card.innerHTML = `<div class="card-head"><h2>🌤 天气</h2></div>
            <div class="empty">拿不到天气（可能离线了）<br><br><button id="wRetry" class="btn ghost">重试</button></div>`;
          const b = $('#wRetry', card); if (b) b.onclick = () => loadWeather(true);
          return;
        }
      }
      renderWeather();
    };
    loadWeather(false);

    /* ---- 今日待办速览 ---- */
    const renderOvTodos = () => {
      const list = $('#ovTodoList', root);
      const items = [...S.todos].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)).slice(0, 6);
      const remain = S.todos.filter(t => !t.done).length;
      $('#ovTodoStat', root).textContent = remain ? `${remain} 项待完成` : (S.todos.length ? '全部完成 🎉' : '今天还很清爽');
      list.innerHTML = items.length ? '' : '<li class="empty" style="display:block">今天想做点什么？✨</li>';
      for (const t of items) {
        const li = document.createElement('li');
        if (t.done) li.className = 'done';
        const chk = document.createElement('button');
        chk.className = 'mini-check'; chk.textContent = '✓';
        chk.onclick = () => { t.done = !t.done; t.completedAt = t.done ? Date.now() : null; save(); renderOvTodos(); App.updateBadges(); };
        const span = document.createElement('span');
        span.className = 'grow'; span.textContent = t.text;
        li.append(chk, span);
        list.appendChild(li);
      }
    };
    $('#ovTodoForm', root).onsubmit = (e) => {
      e.preventDefault();
      const text = $('#ovTodoInput', root).value.trim();
      if (!text) return;
      S.todos.push({ id: uid(), text, done: false, created: Date.now(), completedAt: null });
      $('#ovTodoInput', root).value = '';
      save(); renderOvTodos(); App.updateBadges();
    };
    renderOvTodos();

    /* ---- 今日习惯速查 ---- */
    $('#ovHabitDate', root).textContent = `${new Date().getMonth() + 1}/${new Date().getDate()}`;
    const renderOvHabits = () => {
      const box = $('#ovHabits', root);
      if (!S.habits.length) { box.innerHTML = '<div class="empty" style="display:block">还没有习惯，去「习惯」页添加</div>'; return; }
      const tk = todayKey();
      box.innerHTML = S.habits.map(h => {
        const checks = S.habitChecks[h.id] || {};
        let n = 0; const d = new Date();
        if (!checks[dateKey(d)]) d.setDate(d.getDate() - 1);
        while (checks[dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
        return `<div class="habit-quick-row">
          <button class="mini-check ${checks[tk] ? 'ok' : ''}" data-h="${h.id}" style="${checks[tk] ? 'background:linear-gradient(135deg,var(--ok),#22c55e);border-color:transparent;color:#fff' : ''}">✓</button>
          <span class="grow">${esc(h.name)}</span><span class="streak-tag">${n > 0 ? '🔥 ' + n + ' 天' : ''}</span></div>`;
      }).join('');
      $$('#ovHabits .mini-check', box).forEach(btn => btn.onclick = () => {
        const id = btn.dataset.h, tk2 = todayKey();
        S.habitChecks[id] = S.habitChecks[id] || {};
        if (S.habitChecks[id][tk2]) delete S.habitChecks[id][tk2];
        else S.habitChecks[id][tk2] = true;
        save(); renderOvHabits();
      });
    };
    renderOvHabits();

    /* ---- 最近倒数日 ---- */
    const renderOvCounts = () => {
      const box = $('#ovCountdowns', root);
      if (!S.countdowns.length) { box.innerHTML = '<div class="empty" style="display:block">还没有倒数日<br>去「倒数日」页添加 ✨</div>'; return; }
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const items = S.countdowns
        .map(c => ({ ...c, days: Math.ceil((new Date(c.date + 'T00:00:00') - today) / 864e5) }))
        .sort((a, b) => a.days - b.days).slice(0, 4);
      box.innerHTML = items.map(c => `
        <div class="count-mini">
          <span class="count-emoji">${esc(c.emoji || '📌')}</span>
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title)}</span>
          <span class="count-days ${c.days === 0 ? 'is-today' : ''}">${c.days > 0 ? 'D-' + c.days : c.days === 0 ? '就是今天' : -c.days + ' 天前'}</span>
        </div>`).join('');
    };
    renderOvCounts();

    /* ---- 每日一言 ---- */
    const QUOTES = [
      ['把每一个平凡的日子过好，就是不平凡。', ''],
      ['学而不思则罔，思而不学则殆。', '孔子'],
      ['千里之行，始于足下。', '老子'],
      ['不积跬步，无以至千里。', '荀子'],
      ['宝剑锋从磨砺出，梅花香自苦寒来。', '《警世贤文》'],
      ['业精于勤，荒于嬉；行成于思，毁于随。', '韩愈'],
      ['凡事预则立，不预则废。', '《礼记》'],
      ['路漫漫其修远兮，吾将上下而求索。', '屈原'],
      ['纸上得来终觉浅，绝知此事要躬行。', '陆游'],
      ['山重水复疑无路，柳暗花明又一村。', '陆游'],
      ['问渠那得清如许？为有源头活水来。', '朱熹'],
      ['欲穷千里目，更上一层楼。', '王之涣'],
      ['长风破浪会有时，直挂云帆济沧海。', '李白'],
      ['千磨万击还坚劲，任尔东西南北风。', '郑燮'],
      ['种一棵树最好的时间是十年前，其次是现在。', '谚语'],
      ['The secret of getting ahead is getting started.', 'Mark Twain'],
      ['Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'],
      ['Stay hungry, stay foolish.', 'Steve Jobs'],
      ['Focus is saying no to a thousand good ideas.', 'Steve Jobs'],
      ['Done is better than perfect.', 'Sheryl Sandberg'],
      ['What gets measured gets managed.', 'Peter Drucker'],
      ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
      ['Little by little, one travels far.', 'J. R. R. Tolkien'],
      ['It always seems impossible until it is done.', 'Nelson Mandela'],
      ['行动是治愈恐惧的良药。', '威廉·詹姆斯'],
      ['今天的努力，是明天的实力。', ''],
      ['不必等待炬火，此后如竟没有炬火，我便是唯一的光。', '鲁迅'],
      ['追风赶月莫停留，平芜尽处是春山。', '《华夏地说》'],
      ['慢慢来，比较快。', ''],
      ['专注做好一件事，胜过敷衍十件事。', ''],
    ];
    let qi = (dayOfYear(new Date()) * 7 + 3) % QUOTES.length;
    const showQuote = () => {
      const [t, from] = QUOTES[qi];
      $('#quoteText', root).firstChild.textContent = `“${t}”`;
      $('#quoteFrom', root).textContent = from ? `—— ${from}` : '';
    };
    showQuote();
    $('#quoteNext', root).onclick = () => { qi = (qi + 1) % QUOTES.length; showQuote(); };
  },
});
