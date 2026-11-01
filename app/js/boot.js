/* 启动入口：恢复数据 → 注册 PWA → 启动应用 */
(async () => {
  // IndexedDB 恢复: localStorage 被清空时从镜像快照还原。
  // 加超时竞速 —— IDB 被其他标签页阻塞时最多等 1.5 秒, 绝不阻塞应用启动。
  try {
    await Promise.race([
      restoreFromIdb(),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) {}

  // PWA: 仅 http(s) 环境注册 (file:// 双击打开时跳过)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* PWA 不可用不影响功能 */ }
  }

  App.boot();
})();

