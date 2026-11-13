# qiaobooseai-site

Published via GitHub Pages.


## 公共顶栏

14 个公开页面共用 `components/site-header.html`、`site-header.css` 与 `site-header.js`。修改入口后执行 `python3 scripts/sync-header.py`，生成静态 HTML，手机菜单、主题和键盘操作共用同一逻辑。CRM 与待办工作台保持独立。

## 文章

目录为 `articles/data.js`，正文为 `articles/content/<id>.js`。2026-11-11 同步了 10 篇 10—11 月已保存公众号草稿，按保存日期倒序，名单见 `articles/imported-wechat.json`；起盘套装领取文章不纳入本轮。配图存于 `articles/assets`。`wx-` 正文中的 HTML 来自去除脚本、事件、内联样式及微信专属组件后的可信静态内容，不接收访客 HTML。

旧内容同步脚本全量重建会保留 `wx-` 导入记录；增量水位线单独按旧来源计算，避免公众号新日期挡住旧来源更新。

## 航海路演资源

`latest-event/voyage.html` 使用 `latest-event/voyage-assets/` 中带内容哈希的图片；展示预览图，点击时加载对应原始 PNG。两个头像共享同一 WebP。更新图片时使用新的哈希文件名，保留仍可能被旧页面引用的文件。部署配置对路演 HTML 启用 gzip 和重新校验，对该图片目录使用一年不可变缓存。

导出含统一顶栏、样式、脚本及全部图片的单文件离线版：

```sh
python3 scripts/export-voyage-offline.py /path/to/voyage-offline.html
```

## 图片交付优化

导入新文章后运行 `python3 scripts/optimize-public-images.py`（需要 Pillow）。
资料页与文章正文使用 `media/optimized/` 下按内容命名的 WebP；图解和二维码采用原分辨率无损压缩，头像采用高质量压缩。原始图片与查看原图链接保留。页面图片按阅读位置加载，并预留尺寸防止跳动。

发布配置对公开 HTML、CSS、JS、JSON 和 SVG 开启传输压缩与缓存校验；按内容命名的图片长期缓存，更新图片时会自动使用新地址。


## 搜索与 AI 阅读入口（2026-11-13）

新增 `/guides/` 起步指南、作者与公开案例说明；`/read/` 提供现有文章的完整静态正文。既有正文源文件不变。修改现有 `articles/data.js` / `articles/content/*.js` 或指南源 `scripts/discovery/guides.json` 后，执行：

```sh
python3 scripts/build-discovery.py
python3 scripts/check-discovery.py
```

提交生成的页面、`sitemap.xml`、`robots.txt` 和 manifest。部署也会运行构建与验证。网站地图采用公开地址白名单，不包含 CRM、待办、内部脚本或验证文件。既有文章查询地址在主站 301 到完整阅读页；未知地址返回真实 404。

`googlecde840be1546cdf3.html` 是站主 Google Search Console 验证文件，勿移除。IndexNow 验证文件名保存在 `scripts/discovery/indexnow-key-name.txt`，这是公开域名验证标记，不是私密 API 凭据。

部署后 `scripts/discovery/verify-live.py` 检查 47 个公开地址的实际内容、旧文章跳转、404 与抓取规则。部署生成 `search-verification` 工作流附件（保存 14 天）。IndexNow 提交回执只表示接收，不代表收录。

新增汇总访问日志 `/var/log/nginx/qiaoboose-discovery.log` 只记录时间、路径、状态、固定来源类别和声明的爬虫类别，不记录 IP、完整来源网址、查询参数、Cookie 或正文。用 `scripts/discovery/report-traffic.py` 从标准输入读取并汇总。统计单位是请求，不是独立访客；服务页请求不是咨询或成交。真实咨询通过来访者自述和“官网指南”备注另行确认。日志由系统现有 nginx logrotate 管理。

自动验收的所有请求（包括模拟爬虫名称的探测）都附带 `Qiaoboose-SEO-Check` 标记，汇总时单列为 `verificationRequests`。标记修正前的日志可能把模拟探测计入 `claimed-*`；这部分历史计数不能作为真实爬虫访问证据，且不能仅凭 User-Agent 判断爬虫身份。
