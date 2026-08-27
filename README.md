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
| **cyberpunk-lucy**（露西） | 赛博朋克系：潜入/战斗/月球漫步/数据流等 26 个动作 | 🎨 自制 | [v1.0.2](https://github.com/shuglx/desktop-pet/releases/tag/cyberpunk-lucy-v1.0.2) |
| **yueyue**（小玥儿） | 日常陪伴系：吃喝/玩耍/时节/点击回应等多语义动作 | 🎨 自制 | [v1.0.8](https://github.com/shuglx/desktop-pet/releases/tag/yueyue-v1.0.8) |
| **DeepSeek Doll** | 蓝鲸系萌宠：100+ 动作素材，换装/吃喝/节日/魔法特效齐全 | 🔌 移植 | [v1.0.6](https://github.com/shuglx/desktop-pet/releases/tag/deepseek-doll-v1.0.6) |

> 💡 **DeepSeek Doll** 的动画素材移植自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（MIT）。其余两只桌宠（cyberpunk-lucy / yueyue）为仓库自制。

> 🎞️ 所有桌宠的透明 `.mov` 素材，均经 ffmpeg 转码为 640×360 的 VP9 透明 webm，由电子渲染层播放。

---

## 🎬 效果预览

以下 GIF 为各桌宠代表性动作的透明预览（320×180，9/16）。透明部分显示为页面底色，实际 webm 素材播放时全透明。

### cyberpunk-lucy

| 待机 | 点击回应 | 小憩 |
| --- | --- | --- |
| ![待机呼吸](cyberpunk-lucy/assets/preview/01-待机呼吸-基准待机.gif) | ![别扭害羞](cyberpunk-lucy/assets/preview/05-点击回应-别扭害羞.gif) | ![低重力漂浮睡](cyberpunk-lucy/assets/preview/10-小憩-低重力漂浮睡.gif) |
| ![望月转身](cyberpunk-lucy/assets/preview/03-待机-待机·望月转身.gif) | ![摸头反应](cyberpunk-lucy/assets/preview/08-点击回应-摸头反应.gif) | ![深潜梦魇](cyberpunk-lucy/assets/preview/11-小憩-深潜梦魇.gif) |

| 特殊 | 移动 | 战斗 | 拖拽 |
| --- | --- | --- | --- |
| ![月球漫步](cyberpunk-lucy/assets/preview/12-特殊-月球漫步低-重力轻跳.gif) | ![横向行走](cyberpunk-lucy/assets/preview/19-移动-横向行走·都会漫步.gif) | ![黑客骇入](cyberpunk-lucy/assets/preview/22-战斗·黑客骇入攻击.gif) | ![悬空吊起](cyberpunk-lucy/assets/preview/24-拖拽·悬空吊起反应.gif) |
| ![数据流环绕](cyberpunk-lucy/assets/preview/15-特殊-数据流环绕.gif) | | |

### yueyue

| 吃什么 | 小动作 | 待机 & 转向 |
| --- | --- | --- |
| ![吃晚餐](yueyue/assets/preview/吃什么-吃晚餐.gif) | ![超大伸懒腰](yueyue/assets/preview/小动作-超大伸懒腰.gif) | ![待机呼吸休闲](yueyue/assets/preview/待机&转向-待机呼吸休闲.gif) |
| | | ![东张西望](yueyue/assets/preview/待机&转向-东张西望.gif) |

| 玩耍 | 点击回应 | 移动 | 春节 |
| --- | --- | --- | --- |
| ![优雅女仆舞](yueyue/assets/preview/玩耍-优雅女仆舞.gif) | ![元气挥手](yueyue/assets/preview/点击回应-元气挥手.gif) | ![原地漂浮踏步](yueyue/assets/preview/移动-原地漂浮踏步.gif) | ![放烟花](yueyue/assets/preview/春节-放烟花.gif) |

| 拖拽 |
| --- |
| ![悬空反馈](yueyue/assets/preview/拖拽-悬空反馈.gif) |

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