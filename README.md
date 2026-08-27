<p align="center">

# 🐾 desktop-pet

**多套 Electron 透明置顶桌面宠物** — 无边框铺满工作区 + 点击穿透，动画链接续播放，拖拽漫游、托盘控制一应俱全。

</p>

<p align="center">

![Electron](https://img.shields.io/badge/Electron-9cf?style=for-the-badge&logo=electron&logoColor=white&color=47848F)
![JavaScript](https://img.shields.io/badge/JavaScript-9cf?style=for-the-badge&logo=javascript&logoColor=white&color=f7df1e)
![FFmpeg](https://img.shields.io/badge/FFmpeg-9cf?style=for-the-badge&logo=ffmpeg&logoColor=white&color=007808)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-9cf?style=for-the-badge&logo=githubactions&logoColor=white&color=2088FF)

</p>

<p align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</p>

---

## 🦴 桌宠一览

| 桌宠 | 说明 | 类型 | 版本 |
| --- | --- | --- | --- |
| 🌃 **cyberpunk-lucy**（露西） | 赛博朋克系：潜入/战斗/月球漫步/数据流等 26 个动作 | 🎨 自制 | [v1.0.2](https://github.com/shuglx/desktop-pet/releases/tag/cyberpunk-lucy-v1.0.2) |
| 🐰 **yueyue**（小玥儿） | 日常陪伴系：吃喝/玩耍/时节/点击回应等多语义动作 | 🎨 自制 | [v1.0.8](https://github.com/shuglx/desktop-pet/releases/tag/yueyue-v1.0.8) |
| 🌊 **DeepSeek Doll** | 蓝鲸系萌宠：100+ 动作素材，换装/吃喝/节日/魔法特效齐全 | 🔌 移植 | [v1.0.6](https://github.com/shuglx/desktop-pet/releases/tag/deepseek-doll-v1.0.6) |

> 💡 **DeepSeek Doll** 的动画素材移植自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（MIT）。其余两只桌宠（cyberpunk-lucy / yueyue）为仓库自制。

> 🎞️ 所有桌宠的透明 `.mov` 素材，均经 ffmpeg 转码为 640×360 的 VP9 透明 webm，由电子渲染层播放。

---

## ✨ 通用特性

- 🌫️ **全屏透明覆盖层**：主进程守护常驻窗口边界；光标在宠物身上才可交互，其余位置点击穿透
- 🎬 **动画链 / 双缓冲**：空闲 · 转向 · 动作 · 点击回应 · 拖拽 · 移动按概率接续，切换无空白闪烁
- 🖱️ **点击 / 拖拽**：点按触发回应动画，5px 阈值区分点击与拖拽，松手停在原处并记忆位置
- 🏃 **屏幕漫游**：按朝向随机横移，行进朝向与动画朝向自动对齐
- 📟 **托盘菜单**：显示/隐藏 · 允许移动 | 开机自启 · 播放动作 · 退出
- 📝 **错误上报**：主/渲染进程未捕获异常写入 `pet-error.log` 并弹出提示

---

## 🚀 快速上手

以 `cyberpunk-lucy` 为例（任选一个子项目进入均可）：

```bash
cd cyberpunk-lucy
npm install
npm start          # 本地运行（--freeze 冻结漫游，便于调试）
npm run dist:win   # 打包 Windows 便携版
npm run dist:linux # 打包 Linux deb
npm run dist:mac   # 打包 macOS dmg
```

> 自带打包脚本见各子项目 `package.json`；透明素材转码脚本见 `cyberpunk-lucy/scripts/make_webm.py`。

---

## 🤖 自动化发版

推送形如 `cyberpunk-lucy-v1.2.3` 的 **tag** 即自动触发 [GitHub Actions](.github/workflows/build.yml)：

- 构建 **Windows 便携版** / **Linux deb** / **macOS dmg** 三平台安装包
- 自动创建关联的 **GitHub Release** 并附上安装包
- 多桌宠共用本仓库，按 tag 前缀（`deepseek-doll-` / `yueyue-` / `cyberpunk-lucy-`）区分构建目标

---

## 📄 许可

[MIT](LICENSE) — DeepSeek Doll 动画素材另见 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的许可。