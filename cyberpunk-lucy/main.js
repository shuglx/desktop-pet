'use strict';
/* ============================================================
   cyberpunk-lucy 独立桌宠 · 主进程（全屏覆盖层架构，移植自 yueyue）
   - 一个铺满主屏工作区的透明置顶窗口，永不移动/改尺寸
   - 窗口默认整体点击穿透，光标移到宠物身上时由渲染层切换为可交互
   - 宠物的移动/漫游/拖拽全部发生在窗口内部（DOM）
   ============================================================ */
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;
let allowMove = true; // 托盘开关：允许移动（默认开启），关闭时跳过移动动画

/* ---------- 全部动画（与 src/pet/*.webm 一一对应） ---------- */
const IDLE = '01-待机呼吸-基准待机';
const TURN = '03-待机-待机·望月转身';
const ACTS = [
  // 待机/小憩
  '02-待机-黑客潜行态',
  '09-小憩-抱膝打盹', '10-小憩-低重力漂浮睡', '11-小憩-深潜梦魇',
  // 特殊
  '12-特殊-月球漫步低-重力轻跳', '13-特殊-月球超梦-背靠背望地球',
  '14-特殊-偷芯片彩蛋', '15-特殊-数据流环绕',
  '16a-特殊-初见回眸·霓虹背影', '16b-特殊-吃棒棒糖',
  '17-特殊-火箭升空·月下之约', '18-特殊·吞云吐雾·天台烟客',
  // 战斗
  '21a-战斗·双手单分子线攻击', '21b-战斗·单手单分子线攻击',
  '22-战斗·黑客骇入攻击', '23-战斗·持枪速击',
];
const CLICKS = [
  '04-点击回应-从容愉悦', '05-点击回应-别扭害羞',
  '06-点击回应-义眼警告', '07-点击回应-小恶魔调笑', '08-点击回应-摸头反应',
];
const DRAG = '24-拖拽·悬空吊起反应';
const MOVES = ['19-移动-横向行走·都会漫步', '20-移动-横向奔跑·任务急行'];
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
  try { dialog.showErrorBox('cyberpunk-lucy 桌宠出错', msg + '\n\n详细日志: ' + logPath()); } catch (e) {}
});

/* ---------- 测试模式：--freeze / PET_FREEZE=1 冻结漫游，宠物停在默认位置 ---------- */
const FREEZE = process.env.PET_FREEZE === '1' || process.argv.includes('--freeze');

/* ---------- 托盘图标：优先使用 src/logo.png，加载失败回退代码绘制 ---------- */
// macOS 菜单栏图标：按标准尺寸提供 1x(16px)/2x(32px) 模板图，系统自动按深浅色渲染
function makeMacTrayImage() {
  const img = nativeImage.createEmpty();
  const one = nativeImage.createFromPath(path.join(__dirname, 'src', 'logo-mac.png'));
  const two = nativeImage.createFromPath(path.join(__dirname, 'src', 'logo-mac@2x.png'));
  if (!one.isEmpty()) img.addRepresentation({ scaleFactor: 1, buffer: one.toPNG() });
  if (!two.isEmpty()) img.addRepresentation({ scaleFactor: 2, buffer: two.toPNG() });
  if (img.isEmpty()) throw new Error('no mac tray representation');
  img.setTemplateImage(true);
  return img;
}
function makeTrayImage() {
  try {
    // macOS 菜单栏用模板图（按 1x/2x 双档位，避免过大/发糊）；Windows/Linux 保持彩色 logo 不变
    if (process.platform === 'darwin') return makeMacTrayImage();
    const img = nativeImage.createFromPath(path.join(__dirname, 'src', 'logo.png'));
    if (!img.isEmpty() && img.getSize().width > 0) return img.resize({ width: 32, height: 32 });
  } catch (e) { log('tray logo load failed: ' + e.message); }
  const S = 32;
  const buf = Buffer.alloc(S * S * 4);
  // 兜底：实心圆点
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const d = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5);
      if (d <= S / 2 - 1) { buf[i] = 0xff; buf[i + 1] = 0x98; buf[i + 2] = 0x40; buf[i + 3] = 0xff; }
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
  tray.setToolTip('cyberpunk-lucy 桌宠');
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