/**
 * agent_executor.js v2 — 手机端执行器 (运行于 AutoX.js / 无障碍服务)
 *
 * 电脑通过 adb 把指令 JSON 写入 /sdcard/.agent_cmd.json,
 * 本脚本每 250ms 轮询一次,用无障碍手势执行,结果写回 /sdcard/.agent_result.json
 *
 * 指令格式: {"id":"cmdxxx","actions":[{"type":"tap","x":100,"y":200}, ...]}
 * 支持动作:
 *   tap        {x, y, ms}                   点击(ms 默认 100,过短 MIUI 列表项可能无响应)
 *   longclick  {x, y, ms}                   长按(ms 默认 600)
 *   swipe      {x1,y1,x2,y2,ms}             滑动(ms 默认 500)
 *   gest       {ms, points:[[x,y],[x,y]...]} 自定义路径手势
 *   text       {value}                      向聚焦输入框输入文字(支持中文)
 *   key        {value: back|home|recents|notifications}  系统键
 *   launch     {app: "设置"}                 按应用名启动
 *   pkg        {value: "com.xxx"}           按包名启动
 *   clip       {value}                      写入剪贴板
 *   exec       {path}                       热更新:用 AutoX 引擎运行另一个脚本
 *   delay      {ms}                         等待
 *   ping                                    健康检查
 *   stop                                    退出执行器
 * 每个动作可带 after: 延迟毫秒(默认 150)
 */

auto.waitFor();

var CMD_FILE = '/sdcard/.agent_cmd.json';
var RES_FILE = '/sdcard/.agent_result.json';
var LOG_FILE = '/sdcard/.agent_log.txt';

// 清掉上一轮遗留的指令,防止新实例一启动就重放旧命令
files.write(CMD_FILE, '');
files.write(LOG_FILE, 'executor v2 started ' + new Date().toLocaleString() + '\n');
files.write(RES_FILE, JSON.stringify({ id: '', ok: true, error: '', out: ['boot v2'] }));

toastLog('执行器 v2 已启动,等待电脑指令');

var lastId = '';
var stopNow = false;

while (!stopNow) {
    try {
        if (files.exists(CMD_FILE)) {
            var raw = files.read(CMD_FILE);
            if (raw && raw.length > 2) {
                var cmd = JSON.parse(raw);
                if (cmd.id && cmd.id !== lastId) {
                    lastId = cmd.id;
                    var result = { id: cmd.id, ok: true, error: '', out: [] };
                    try {
                        var acts = cmd.actions || [];
                        for (var i = 0; i < acts.length; i++) {
                            doAction(acts[i], result.out);
                        }
                    } catch (e) {
                        result.ok = false;
                        result.error = String(e);
                    }
                    files.write(RES_FILE, JSON.stringify(result));
                    files.append(LOG_FILE, JSON.stringify(cmd) + ' => ' + JSON.stringify(result) + '\n');
                }
            }
        }
    } catch (loopErr) {
        try { files.append(LOG_FILE, 'LOOP ERR: ' + loopErr + '\n'); } catch (e2) {}
    }
    sleep(250);
}

files.append(LOG_FILE, 'executor stopped ' + new Date().toLocaleString() + '\n');
exit();

function doAction(act, out) {
    var t = act.type;
    if (t === 'tap') {
        gesture(act.ms || 100, [act.x, act.y], [act.x, act.y]);
        out.push('tap ' + act.x + ',' + act.y);
    } else if (t === 'longclick') {
        gesture(act.ms || 600, [act.x, act.y], [act.x, act.y]);
        out.push('longclick ' + act.x + ',' + act.y);
    } else if (t === 'swipe') {
        gesture(act.ms || 500, [act.x1, act.y1], [act.x2, act.y2]);
        out.push('swipe ok');
    } else if (t === 'gest') {
        var pts = act.points;
        if (!pts || pts.length < 2) throw new Error('gest 需要 2 个以上 points');
        var args = [act.ms || 500];
        for (var p = 0; p < pts.length; p++) args.push(pts[p]);
        gesture.apply(null, args);
        out.push('gest ' + pts.length + 'pts');
    } else if (t === 'text') {
        if (!setText(act.value)) throw new Error('setText 失败:没有聚焦的输入框');
        out.push('text ok');
    } else if (t === 'key') {
        var k = act.value;
        if (k === 'back') { back(); }
        else if (k === 'home') { home(); }
        else if (k === 'recents') { recents(); }
        else if (k === 'notifications') { notifications(); }
        else { throw new Error('unknown key: ' + k); }
        out.push('key ' + k);
    } else if (t === 'launch') {
        if (!app.launchApp(act.app)) throw new Error('无法启动应用: ' + act.app);
        out.push('launch ' + act.app);
    } else if (t === 'pkg') {
        if (!app.launchPackage(act.value)) throw new Error('无法启动包: ' + act.value);
        out.push('pkg ' + act.value);
    } else if (t === 'clip') {
        setClip(act.value);
        out.push('clip ok');
    } else if (t === 'exec') {
        var r = engines.execScriptFile(act.path);
        out.push('exec ' + act.path + ' -> ' + (r && r.getId ? r.getId() : '?'));
    } else if (t === 'delay') {
        sleep(act.ms || 500);
        out.push('delay ' + (act.ms || 500));
    } else if (t === 'ping') {
        out.push('pong v2 ' + device.brand + ' ' + device.model + ' android' + device.release + ' ' + device.width + 'x' + device.height);
    } else if (t === 'stop') {
        stopNow = true;
        out.push('bye');
        return;
    } else {
        throw new Error('unknown action: ' + t);
    }
    sleep(act.after || 150);
}
