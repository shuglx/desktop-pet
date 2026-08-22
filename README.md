# desktop-pet · 桌宠制作仓库

这是一个用于制作「桌面宠物」的仓库，集中管理多个透明置顶桌面宠物子项目（Electron 技术栈）。

## 子项目

| 子项目 | 说明 |
| --- | --- |
| [deepseek-doll](./deepseek-doll) | **DeepSeek Doll 独立桌宠**：透明置顶桌面宠物，全屏覆盖层架构，复用 pet.js 动画链 + 100+ webm 动画素材 |

其余目录为预留占位，后续补充。

## deepseek-doll 快速上手

```bash
cd deepseek-doll
npm install
npm start          # 本地运行
npm run dist:win   # 打包 Windows 便携版（deepseek-doll-<version>-x64.exe）
```

特性：

- 全屏透明置顶覆盖层，主进程维护窗口边界
- 动画链 / 双缓冲切换 / 点击拖拽 / 屏幕漫游
- 托盘菜单：显示/隐藏、**允许移动**开关（默认开，关闭后跳过移动动画）、开机自启、退出
- 绿色版便携 exe，无需安装

## 说明

- 打包产物输出到 `dist/` / `dist-build/`，为中间产物，不入库（见各子项目 `.gitignore`）
- 开机自启通过 Electron `app.setLoginItemSettings` 写入当前用户注册表启动项