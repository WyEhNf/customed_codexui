# Codex UI 1.3.0 集成验收

验收工作目录：`CodexUI-Integrated/staging-1.3.0/Windows-Portable`。本轮独立验收只使用生产资源、临时测试根目录和独立的无用户配置浏览器；不启动、关闭或切换用户正在使用的客户端，不读取 profile、凭据、账号或机器身份文件。

## 发布必须保留的约束

| 约束 | 验收方法 |
| --- | --- |
| 哥伦比娅、神里绫华、胡桃、纳西妲、芙宁娜、茜特拉利、米提亚、伊斯塔露、桑多涅，共九角色；没有杜林 | catalog 精确集合；全部角色包 manifest 与文件 SHA |
| 任意 UI 内可切换到任意角色，同角色可重播 | 真实 embedded-ui 组件；原有 81 条 source/destination 浏览器路线测试 |
| 每次请求只创建一次开屏，忙碌时不重入 | duplicate showOpening、switcher busy guard、DOM 计数；selection/session fixture |
| 切换过程保留原皮肤，不显示“皮肤已暂停” | coordinator 的 `prepare-switch(false)`、commit、`launch(true)` 顺序；每帧主题标志与暂停节点审计 |
| 失败回退到原包，恢复后清理 owned 覆盖层与标记 | selection 临时事务回滚/中断恢复；真实组件卸载 |
| 保留原 Codex 布局和 React 节点 | 生产 CSS/图标/材料/开屏/切换组件组合：逐节点 DOMRect、子节点引用、ARIA、草稿引用、点击保留 |
| 图标只改变已确认功能图标的绘制 | 原生 SVG fixture；正文、输入框、彩色图标、停止控件保持原样 |
| 头像框不盖住头像中心；只装饰现有头像 | material-ui 独立浏览器与透明像素检查；不创建账号头像 |
| 文本框有背景透明度，文字/控件本身不透明 | computed background alpha：composer .72、focus .80、message .64、code .88、menu/dialog .94；opacity 保持 1 |
| 开屏为独立全场景构图、保留花体签名 | 日常图与实际视频首帧差异；生产 signature 路径与可访问名称；fullScene 元数据 |
| 动态开屏为实际可解码 MP4，播放一次后释放 | SHA、ftyp、≤12 MiB；FFmpeg 多帧解码；浏览器时间推进、loop=false、到片尾、skip 后清空 src |
| reduced-motion 和解码失败使用正确场景海报 | 实际 first-frame poster，浏览器自然尺寸/可见 opacity；无视频 source |
| 局部动画没有破坏脸/手/关节 | 八个新片的 pre-encoding 指标：rawFaceMAD=0；rawProtectedMapMaxPx<1e-5 px 浮点采样容差；localWarpPixelMAD>0 |
| 桌面 codexui 有统一启动与每角色入口/恢复入口 | Setup.ps1 桌面路径约束、CodexUI.exe / --character / --restore 参数；最终安装由主代理执行 |
| 分享包没有个人状态 | package.py 排除规则；最终 ZIP 路径逐项审计与 CRC |

## 可运行命令

以下命令在 staging 根目录运行。前两条是本次新增的只读生产验收；不会连接用户客户端。

```powershell
& .\runtime\node.exe tests/production-release.test.mjs
& .\runtime\node.exe tests/production-release.browser.mjs
```

最终分享 ZIP 生成后，可给第一条命令添加 `--archive <ZIP绝对路径>`，同时检查 ZIP 内真实路径是否含 profile/state/logs/evidence/backups/machine.json/.env 等禁止文件，以及 CRC 和根完整性文件。

相关已有离线回归：

```powershell
& .\runtime\node.exe tests/selection.test.mjs
& .\runtime\node.exe tests/embedded-switcher.browser.mjs
& .\runtime\node.exe tests/seamless-switch.browser.mjs
& .\runtime\node.exe tests/character-icons.browser.mjs
& .\runtime\node.exe tests/material-ui.browser.mjs
```

使用 bundled Node，浏览器脚本默认在独立 headless Edge 上运行。可用 `PLAYWRIGHT_MODULE`、`PLAYWRIGHT_CHANNEL` 指向已安装的测试运行时。视频测试默认使用本机 `imageio_ffmpeg` 带的 FFmpeg，也支持 `FFMPEG_EXE`；ZIP 审计支持 `PYTHON_EXE`。这些依赖仅用于开发验收，不写入客户端账户数据。

## 证据与边界

- `evidence/release-qa/production-assets.json`：九角色生产资源/真实解码/局部动画/签名报告。
- `evidence/release-qa/production-browser.json`：生产组件组合、实际 MP4 播放和释放、背景 alpha、原节点/布局报告。
- `evidence/release-qa/*-opening.png`：同一独立 fixture 中的真实生产开屏画面。
- `evidence/material-ui/browser-results.json`：材质层独立九角色验收及头像透明中心验证。

浏览器 fixture 只能证实 DOM 内的生产组件行为，不能替代真实 Windows 标题栏/系统菜单、实际窗口激活、最终桌面链接点击、客户端登录状态下的端到端验收。系统持有的菜单及缺少已证实 selector 的原生账号头像没有伪造。主代理负责最终 native/live、部署和归档，并在完成后汇总结果。

## 变更说明

八个新片属于经过批准插画的参数化局部动画，包含呼吸/头发/衣料局部位移及独立环境效果，保留受保护的人脸、手部与关节区域；不是生成式视频。桑多涅保留原有视频资源。测试同时验证真实编码后的多帧像素变化，避免仅通过元数据把静态图声明为动态。

播放器验收重点包括：durationMs 从经过校验的 ledger 传播；视频 loop=false；提前进入 ready 也等待本轮片尾；18 秒上限避免永久覆盖；跳过及恢复卸载媒体；reduced-motion 和错误分支保留同一开屏首帧。
