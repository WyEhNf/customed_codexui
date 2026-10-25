# 1.4.0 美术细节验收

这次补齐真实导航栏左下角的用户头像框、设置页面导航图标、中文及 CodeX 开屏艺术字、人物后方完整淡框底纹，并为米提亚制作独立的安静书房开屏。

保留原 Codex 布局、React 节点、头像内容、控件事件与可访问名称。头像框中心透明，跟随实际头像位置；设置图标在 data-settings-panel-slug 标记的导航内识别，保留各图标原本几何。配置头像 URL、用户名称和身份数据均不写入分享包。

中文和 CodeX 的艺术字体转为受限的几何轮廓资源，无需在接收机器安装相关字体，也不分发字体文件。原角色英文花体签名不变。几何经过大小、命令、坐标边界与 SHA 校验。

日常背景层顺序为底色、完整淡框底纹、具有自身淡出遮罩的人物；人物来源保持原有版本，淡框不会被全画幅遮罩抹掉。桑多涅保留原有背景。

米提亚新开屏为内置 imagegen 依据既有形象参考制作的独立静坐场景；日常 M1 原图保留。新片仍为 9 秒、1080p、30fps 的插画局部动画，脸、手与关节受保护，动效只包含轻微衣发运动、窗外细雪和灯光，没有大轨道、掌心魔法球与强闪光。

可在运行目录执行：

```powershell
& .\runtime\node.exe tests/avatar-settings.browser.mjs
& .\runtime\node.exe tests/opening-lettering.browser.mjs
& .\runtime\node.exe tests/workspace-frame.test.mjs
& .\runtime\node.exe tests/refinement-1.4.test.mjs
& .\runtime\node.exe tests/production-release.test.mjs
& .\runtime\node.exe tests/production-release.browser.mjs
```

独立浏览器与资源检查记录在 evidence/avatar-settings、opening-lettering、workspace-frame、refinement、release-qa；真实受管客户端的验收另记在 evidence/live-release-1.4.0.json。浏览器 fixture 不代替 Windows 原生窗口或系统菜单验收。实际用户头像不会作为截图或素材打入分享包。
