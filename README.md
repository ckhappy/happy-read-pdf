# Happy Read PDF 🐟

> 桌面端摸鱼 PDF 阅读器 —— 老板来了，一键切换

## 为什么要用 PDF 摸鱼？

PDF 天然就是「正经文档」的代名词。一本小说打开是密密麻麻的 PDF 排版，配上深色背景，从身旁走过的人只会以为你在看技术文档。

相比浏览器网页、微博、视频 —— PDF 的阅读姿态最像在工作。**摸鱼的最高境界，不是躲，而是让别人觉得你在干活。**

## 凭什么选 Happy Read PDF？

### 老板键 —— 核心杀器

按 `Alt + `` `，瞬间从《三体》切回《年度述职报告》。一个真实的 PDF 文档作为掩护页，零延迟切换。快捷键是**全局的**，即使窗口在后台也能触发 —— 老板键按下时，窗口还会自动隐藏。

### 自由换肤，极致护眼

黑底白字、米黄底深灰字、墨绿底浅绿字……任意前景/背景色组合。像素级白→背景色、黑→前景色重映射，不破坏文字可读性。预设「原始」模式一键还原。

### 高性能渲染

- 基于 pdfjs 渲染引擎，兼容所有 PDF 格式
- GPU 缓存的 ImageBitmap 预加载，翻页零延迟
- 双 Worker 并行预加载，最高 4 并发渲染
- IndexedDB 本地缓存，打开过的 PDF 秒开
- 彩色缓存网格可视化，翻到哪里预加载到哪里

### 沉浸模式

按 `F11` 全屏，底部导航栏与文件控制自动隐藏（仅保留悬浮"退出"按钮），纯粹的阅读体验。

### 无边框窗口 + 透明度

无原生标题栏，悬停顶部显示拖拽条；鼠标按住 PDF 画布即可拖动窗口，双击最大化。`Alt+↑` / `Alt+↓` 或底部滑条调节整窗透明度，摸鱼更隐蔽。

### 其他特性

- 自适应页面宽度，窗口缩放自动跟随
- 无极缩放，记忆每个文件上次的缩放比例
- 高清/标清画质一键切换，预加载窗口范围可配置
- 右键快捷菜单：打开 PDF / 更换掩护
- 自动记忆每个文件的阅读位置
- 全键盘操作，鼠标可弃

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Alt + `` ` | 老板键（切换掩护 PDF / 隐藏窗口） |
| `F11` | 全屏 |
| `Alt + ↑` / `Alt + ↓` | 窗口透明度 ±5 |
| `←` `PageUp` | 上一页 |
| `→` `PageDown` | 下一页 |
| `Ctrl + ↑` | 放大 |
| `Ctrl + ↓` | 缩小 |
| `Ctrl + 滚轮` | 缩放 |
| `↑` `↓` | 滚动画布 |
| `Space` | 向下翻一屏 |
| `Esc` | 退出沉浸模式 |

## 技术栈

- **桌面框架**：Tauri v2（Rust 后端 + WebView 前端）
- **前端**：React 19 + TypeScript + Tailwind CSS v4
- **PDF 渲染**：pdfjs-dist
- **构建工具**：Vite

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器
npm run build    # 构建前端
npm run lint     # 代码检查
```

## 构建桌面应用

```bash
# 需要 Visual Studio Build Tools + Rust
cd src-tauri
build_app.bat    # 使用 npx tauri build 构建 EXE
```

## 致谢

Happy Read PDF 基于以下开源项目构建：

- [Tauri](https://tauri.app/) — 轻量级桌面应用框架
- [pdfjs-dist](https://github.com/mozilla/pdf.js) — Mozilla PDF 渲染引擎
- [React](https://react.dev/) — 用户界面框架
- [Tailwind CSS](https://tailwindcss.com/) — 原子化 CSS 框架
- [Vite](https://vitejs.dev/) — 前端构建工具
- [TypeScript](https://www.typescriptlang.org/) — 类型安全的 JavaScript

感谢所有开源贡献者，让摸鱼体验更丝滑。
