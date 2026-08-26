'use strict';
/* ============================================================
   preload.js — 渲染进程 → 主进程 的桌宠桥
   ============================================================ */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petHost', {
  // 点击穿透切换（true=穿透，光标不在宠物身上）
  setIgnore: (ignore) => ipcRenderer.send('pet:setIgnore', ignore),
  // 渲染层错误上报（写 pet-error.log）
  logError: (msg) => ipcRenderer.send('pet:log', msg),
  quit: () => ipcRenderer.send('pet:quit'),
  // 托盘“允许移动”开关变化（false 时跳过移动动画）
  onAllowMove: (cb) => ipcRenderer.on('pet:allowMove', (_e, val) => cb(val)),
  // 托盘“播放动作”：主进程指定播放某个动画
  onPlay: (cb) => ipcRenderer.on('pet:play', (_e, name) => cb(name)),
});