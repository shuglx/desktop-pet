/* ============================================================
   pet-window.js — 独立桌宠窗口适配层（全屏覆盖层架构）
   窗口 = 铺满工作区的透明置顶层，视口即屏幕。pet.js 的
   移动 / 漫游 / 拖拽 / 点击全部按浏览器原逻辑运行，无需覆盖。
   本层只做三件事：
   1. 点击穿透切换：光标在宠物身体上 → 可交互；否则 → 穿透
   2. 指针捕获丢失兜底：避免拖拽卡死在可交互态
   3. 错误上报（写 pet-error.log）
   依赖 window.petHost（preload 注入）。
   ============================================================ */
(() => {
  const host = window.petHost;

  /* ---------- 测试模式：#freeze 冻结漫游，宠物停在默认位置 ---------- */
  if (location.hash === '#freeze') {
    pet.tryMove = () => false;
    pet.pickNext = function () { this.anim = this.IDLE; this.switchTo(this.IDLE, true); };
  }

  /* ---------- 托盘“允许移动”开关：false 时跳过移动动画 ---------- */
  if (typeof host.onAllowMove === 'function') {
    host.onAllowMove((val) => {
      pet.allowMove = !!val;
      if (!pet.allowMove) pet.stopMove(); // 关闭时立即停掉正在进行的移动
    });
  }

  /* ---------- 托盘“播放动作”：手动播放指定动画 ---------- */
  if (typeof host.onPlay === 'function') {
    host.onPlay((name) => pet.playOnce(name));
  }

  /* ---------- 点击穿透切换 ---------- */
  let ignoring = null;   // 当前是否处于穿透态
  const cursor = { x: -1, y: -1 };
  const dragging = () => !!(pet.drag && pet.drag.active);
  const overHit = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest && el.closest('.pet-hit'));
  };
  const scheduleIgnore = () => {
    const want = !overHit(cursor.x, cursor.y);
    if (want !== ignoring) { ignoring = want; host.setIgnore(want); }
  };
  window.addEventListener('mousemove', (e) => {
    cursor.x = e.clientX; cursor.y = e.clientY;
    if (dragging()) return; // 拖拽中保持可交互，避免打断
    scheduleIgnore();
  });
  window.addEventListener('mouseup', () => { if (!dragging()) scheduleIgnore(); });

  /* ---------- 指针捕获丢失兜底：合成事件结束拖拽 ---------- */
  const endDragSafe = () => {
    if (!dragging()) return;
    pet.pUp({
      clientX: cursor.x,
      clientY: cursor.y,
      currentTarget: { classList: { remove() {} } }, // 合成 target，兼容 pet.pUp 内部调用
    });
  };
  window.addEventListener('pointerup', endDragSafe);
  window.addEventListener('pointercancel', endDragSafe);
  window.addEventListener('blur', endDragSafe);

  /* ---------- 渲染层错误上报（写 pet-error.log） ---------- */
  window.addEventListener('error', (e) => {
    host.logError('JS错误: ' + e.message + ' @ ' + (e.filename || '?') + ':' + (e.lineno || 0));
  });
  window.addEventListener('unhandledrejection', (e) => {
    host.logError('未处理Promise拒绝: ' + ((e.reason && e.reason.message) || e.reason));
  });

  /* ---------- 挂载桌宠（pet.js 原始逻辑） ---------- */
  pet.mount();
  // 初始：等窗口/动画就绪后评估一次穿透（默认穿透态已由主进程设置）
  setTimeout(scheduleIgnore, 600);
  setTimeout(scheduleIgnore, 1500);

  /* ---------- 测试模式：上报宠物位置（自动化拖拽测试读取） ---------- */
  if (location.hash === '#freeze') {
    const report = () => {
      if (pet.root) host.logError('diag: petRoot ' + JSON.stringify(pet.root.getBoundingClientRect()));
    };
    setTimeout(report, 800);
    const origPUp = pet.pUp.bind(pet);
    pet.pUp = function (e) { origPUp(e); setTimeout(report, 50); };
  }
})();
