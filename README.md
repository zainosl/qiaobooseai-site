# qiaobooseai-site

Published via GitHub Pages.


## 公共顶栏

14 个公开页面共用 `components/site-header.html`、`site-header.css` 与 `site-header.js`。修改入口后执行 `python3 scripts/sync-header.py`，生成静态 HTML，手机菜单、主题和键盘操作共用同一逻辑。CRM 与待办工作台保持独立。

## 文章

目录为 `articles/data.js`，正文为 `articles/content/<id>.js`。2026-11-11 同步了 10 篇 10—11 月已保存公众号草稿，按保存日期倒序，名单见 `articles/imported-wechat.json`；起盘套装领取文章不纳入本轮。配图存于 `articles/assets`。`wx-` 正文中的 HTML 来自去除脚本、事件、内联样式及微信专属组件后的可信静态内容，不接收访客 HTML。

旧内容同步脚本全量重建会保留 `wx-` 导入记录；增量水位线单独按旧来源计算，避免公众号新日期挡住旧来源更新。
