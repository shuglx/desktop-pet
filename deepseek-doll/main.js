'use strict';
/* ============================================================
   DeepSeek Doll 独立桌宠 · 主进程（全屏覆盖层架构）
   - 一个铺满主屏工作区的透明置顶窗口，永不移动/改尺寸
     （规避 Win10 透明窗口在高 DPI 下 setPosition 会损坏
      位置/尺寸的 Chromium 缺陷）
   - 窗口默认整体点击穿透，光标移到宠物身上时由渲染层
     切换为可交互
   - 宠物的移动/漫游/拖拽全部发生在窗口内部（DOM），
     与浏览器版 pet.js 逻辑完全一致
   ============================================================ */
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;
let allowMove = true; // 托盘开关：允许移动（默认开启），关闭时跳过移动动画

/* ---------- 全部动画（与 src/pet/*.webm 一一对应，顺序供托盘“播放动作”菜单展示） ---------- */
const IDLE = '待机呼吸休闲';
const TURN = '东张西望';
const ACTS = [
  // 日常/互动
  '超大伸懒腰', '悠闲哼歌', '哈欠连天', '打瞌睡被惊醒', '原地小憩沉眠',
  '原地专心玩魔方', '原地敲击桌面互动', '原地重力下蹲压缩', '原地跳跃抓碎头顶物品',
  '原地蹲下玩玩具汽车', '偷吃零食被抓住', '玩游戏气急败坏', '被吓一跳',
  '小幅度原地360度旋转展示', '鲸鱼吐泡泡特效', '女仆屈膝礼仪', '荡秋千',
  '骑木马', '抽陀螺', '吹笛子', '踢毽子', '下五子棋', '三球抛接', '凭空生花',
  '扑克魔术', '撸猫', '萌化小幽灵', '蝴蝶蜜蜂环绕头顶开花', '玩水枪',
  // 换装 / 休闲
  '整体换装试色', '照镜子', '优雅女仆舞', '轻快摇摆舞', '可爱宅舞', '吹气球',
  '摇扇纳凉', '轻快记录',
  // 吃喝
  '吃早餐', '吃午餐', '吃晚餐', '吃白饭', '吃冰淇淋融化', '吃西瓜', '大口吃零食',
  '吃Token', '吃年糕', '吃青团', '吃汤圆', '吃粽子', '吃饺子', '吃糖葫芦',
  '吃长寿面', '吃重阳糕', '吃大闸蟹', '吃腊八粥', '晨间刷牙',
  // 节日 / 场景
  '动物环绕', '深度思考碎碎念', '写代码', '放风筝', '被落叶淹没', '蓝鲸现世',
  '用鲸鱼尾巴拍打地面', '小提琴演奏', '堆雪人', '中秋赏月吃月饼', '放河灯',
  '放孔明灯', '放烟花', '变鸽子', '插茱萸赏菊', '穿针乞巧', '拆礼物', '收红包',
  '写福字', '装点圣诞树', '讨糖南瓜灯', '舞狮头', '涮火锅', '是啊，吃什么',
];
const CLICKS = [
  '点击回应-开心跃动', '点击回应-害羞惊讶', '点击回应-傲娇生气',
  '点击回应-挠痒咯咯笑', '点击回应-元气挥手',
];
const DRAG = '被鼠标拖拽悬空反馈';
const MOVES = ['螃蟹走路', '原地漂浮踏步', '原地左转奔跑'];
const ALL_ANIMS = [IDLE, TURN, ...ACTS, ...CLICKS, DRAG, ...MOVES];

/* ---------- 错误日志：任何未捕获异常都写入文件并弹窗，方便定位 ---------- */
function logPath() {
  const base = process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('userData');
  return path.join(base, 'pet-error.log');
}
function log(line) {
  try { fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${line}\n`); } catch (e) { console.error(line); }
}
process.on('uncaughtException', (err) => {
  const msg = 'Uncaught: ' + ((err && err.stack) || err);
  log(msg);
  console.error(msg);
  try { dialog.showErrorBox('DeepSeek Doll 桌宠出错', msg + '\n\n详细日志: ' + logPath()); } catch (e) {}
});

/* ---------- 测试模式：--freeze / PET_FREEZE=1 冻结漫游，宠物停在默认位置 ---------- */
const FREEZE = process.env.PET_FREEZE === '1' || process.argv.includes('--freeze');

/* ---------- 托盘图标：优先使用 src/logo.png，加载失败回退代码绘制 ---------- */
function makeTrayImage() {
  try {
    const img = nativeImage.createFromPath(path.join(__dirname, 'src', 'logo.png'));
    if (!img.isEmpty() && img.getSize().width > 0) return img.resize({ width: 32, height: 32 });
  } catch (e) { log('tray logo load failed: ' + e.message); }
  const WHALE = [
    '....######......',
    '..##########....',
    '.############...',
    '.############...',
    '###############.',
    '###############.',
    '######o###o###..',
    '####..#####..##.',
    '###.....####..##',
    '##........#....#',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ];
  const S = 32;
  const scale = S / WHALE[0].length; // 2x 放大
  const buf = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    const row = WHALE[Math.floor(y / scale)] || '................';
    for (let x = 0; x < S; x++) {
      const c = row[Math.floor(x / scale)] || '.';
      const i = (y * S + x) * 4;
      if (c === '#') {
        buf[i] = 0xe1; buf[i + 1] = 0xd0; buf[i + 2] = 0x4d; buf[i + 3] = 0xff; // BGRA 青色
      } else if (c === 'o') {
        buf[i] = 0xff; buf[i + 1] = 0xff; buf[i + 2] = 0xff; buf[i + 3] = 0xff; // 白眼
      } else {
        buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: S, height: S });
}

/* ---------- 尺寸守卫：窗口必须始终铺满工作区，任何漂移立即恢复 ---------- */
function fitToWorkArea(reason) {
  if (!win || win.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea;
  const b = win.getBounds();
  if (b.x !== wa.x || b.y !== wa.y || b.width !== wa.width || b.height !== wa.height) {
    log(`bounds drift (${reason}): ${JSON.stringify(b)} -> ${JSON.stringify(wa)}`);
    win.setBounds(wa);
  }
}

/* ---------- 创建覆盖层窗口 ---------- */
function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    x: wa.x,
    y: wa.y,
    width: wa.width,
    height: wa.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    focusable: true,           // forward 转发需要窗口可聚焦（不可聚焦时穿透转发会失效）
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  // 默认整体点击穿透（转发 mousemove 供渲染层判断光标位置）
  win.setIgnoreMouseEvents(true, { forward: true });
  // 渲染进程报错写入日志（兼容新版单对象 / 旧版多参数两种事件签名）
  win.webContents.on('console-message', (e, level, message) => {
    const lvl = (e && typeof e === 'object' && 'level' in e) ? e.level : level;
    const msg = (e && typeof e === 'object' && 'message' in e) ? e.message : message;
    if (lvl >= 2) log('[renderer] ' + msg);
  });
  win.webContents.on('render-process-gone', (_e, details) => log('[renderer gone] ' + JSON.stringify(details)));
  win.loadFile(path.join(__dirname, 'src', 'index.html'), FREEZE ? { hash: 'freeze' } : {});
  win.webContents.once('did-finish-load', () => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('pet:allowMove', allowMove);
  });
  win.once('ready-to-show', () => {
    win.show();
    log('displays: ' + JSON.stringify(screen.getAllDisplays().map(d => ({ id: d.id, bounds: d.bounds, scale: d.scaleFactor, workArea: d.workArea }))));
    log('window bounds: ' + JSON.stringify(win.getBounds()) + (FREEZE ? ' [FROZEN]' : ''));
  });
  win.on('closed', () => { win = null; });
  // 定期 + 显示器变化时校正窗口边界
  setInterval(() => fitToWorkArea('guard'), 2000);
  screen.on('display-metrics-changed', () => setTimeout(() => fitToWorkArea('display-metrics-changed'), 300));
}

/* ---------- IPC：点击穿透切换 / 日志 / 退出 ---------- */
ipcMain.on('pet:setIgnore', (_e, ignore) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});
ipcMain.on('pet:log', (_e, msg) => log('[renderer] ' + msg));
ipcMain.on('pet:quit', () => app.quit());

/* ---------- 托盘 ---------- */
function playAnim(name) {
  if (!win || win.isDestroyed()) return;
  if (!win.isVisible()) win.show(); // 隐藏状态下播放：先显示
  win.webContents.send('pet:play', name);
}
function createTray() {
  tray = new Tray(makeTrayImage());
  tray.setToolTip('DeepSeek Doll 桌宠');
  const menu = Menu.buildFromTemplate([
    {
      label: '显示桌宠',
      type: 'checkbox',
      checked: true,
      click: (mi) => {
        if (!win) return;
        if (mi.checked) {
          win.show();
          win.setIgnoreMouseEvents(true, { forward: true }); // 显示后先恢复穿透，由渲染层按光标位置切换
        } else {
          win.hide();
        }
      },
    },
    {
      label: '允许移动',
      type: 'checkbox',
      checked: allowMove,
      click: (mi) => {
        allowMove = mi.checked;
        // 及时同步给渲染层；关闭时由渲染层停止正在进行的移动
        if (win && !win.isDestroyed()) win.webContents.send('pet:allowMove', allowMove);
      },
    },
    {
      label: '开机启动',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (mi) => { try { app.setLoginItemSettings({ openAtLogin: mi.checked }); } catch (e) { console.error(e); } },
    },
    {
      label: '播放动作',
      submenu: ALL_ANIMS.map(name => ({ label: name, click: () => playAnim(name) })),
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => {
    if (win && win.isVisible()) win.hide();
    else if (win) win.show();
  });
}

/* ---------- 生命周期：单实例 + 托盘常驻 ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (!win.isVisible()) win.show();
      win.setIgnoreMouseEvents(true, { forward: true });
    }
  });
  app.whenReady().then(() => {
    createWindow();
    createTray();
  });
  // 桌宠常驻托盘：关窗不退出
  app.on('window-all-closed', () => {});
}
