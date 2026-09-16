# Local reference assets

这个目录只存放本机视觉复刻所需、不可提交或公开部署的参考素材。Git 只跟踪本说明文件。

本地临时字体放在 `fonts/`：

```text
.reference-assets/fonts/united_sans_medium.woff2
.reference-assets/fonts/united_sans_light.woff2
```

构建系统必须把本地参考字体与公开产物分开。United Sans 授权问题解决前，发布构建不得包含
这些文件；缺少本地字体时应明确报告参考模式不可用，不能静默生成错误的视觉基线。
