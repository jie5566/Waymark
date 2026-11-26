# Waymark · 求职地图

一个 Jvision 产品。框架 v0.1。

一个记录求职过程、让你“看见自己走过的路”的小 App。手机和电脑都能用，界面支持中文、英文、瑞典语。

## 结构

```
index.html              App 外壳（顶栏、地图、记录、回看、手机底部标签栏）
styles.css              样式；冷色调；≥900px 宽为电脑布局（左地图 + 右侧栏）
config.js               填 AI 接口地址；留空 = 演示模式（不接 AI）
js/i18n.js              三语文案（英文和瑞典语上线前请母语者校对）
js/store.js             数据：先存本机浏览器，设好访问口令后同步到 Cloudflare D1（欧盟区）
js/map.js               用代码生成的地形、迷雾和地图元素
js/ai.js                调用后端；未配置时用内置的简单回复
js/app.js               对话、草稿卡片、每周回看
js/jobs.js              今日发现：每天从 Platsbanken 挑几个贴合的职位，“我申请了”直接进入记录对话
worker/jobs.js          后端：每天定时抓取、AI 分析、打分（见 worker/README.md）
worker/index.js         后端（Cloudflare Worker）：保管 Gemini 密钥，读取职位链接，返回结构化的记录草稿；云同步；删除全部数据
worker/usage.js         AI 用量记录（每次调用的 token 数）和每日上限
worker/companies.js     关注的公司：识别招聘系统（Teamtailor / Greenhouse / Lever / Ashby），读官网职位
```

## 数据怎么流动

1. 你在“记录”里贴链接或打字。
2. 前端把消息、最近的对话、已有的区域和本周数字发给 Cloudflare Worker。
3. Worker 尝试读取链接页面（需要登录的页面读不到，AI 会改为直接问公司和岗位），再调用 Gemini，要求它按固定的 JSON 格式返回：一句回复、0–3 个快捷回答、若干条记录草稿。
4. 草稿出现在对话上方的卡片里，可以直接点文字修改，确认“保存”后才算数，地图随之生长。

## 后端设置（Cloudflare）

Worker 在每次推送到 `main` 后由 Cloudflare 自动部署，详见 `worker/README.md`。在 Cloudflare 后台设置：

- `GEMINI_API_KEY`（秘密变量）：Gemini 密钥，只存在服务器上，绝对不要放进前端代码。
- `APP_TOKEN`（秘密变量，**必须设置**）：访问口令。没有设置时 Worker 拒绝所有请求，这样 AI 额度不会被别人用掉。
- 可选：`GEMINI_MODEL`、`ALLOWED_ORIGIN`（默认 `https://jie5566.github.io`）、`DAILY_AI_LIMIT`（每天最多几次 AI 对话，默认 150）。

设置 → AI 用量 里可以看到今天和本月的调用次数和 token 数。

## 本地运行 / 发布

- 本地：在这个文件夹里运行 `python3 -m http.server 8000`，打开 http://localhost:8000
- 发布：整个文件夹可以直接放到 GitHub Pages、Netlify 或 Vercel，没有构建步骤。
- 手机上用浏览器打开后，“添加到主屏幕”就像一个 App。

## 下一步可以做的

- 记录的状态更新（面试、offer）入口，次要层级
- “帮我列出该找谁”：根据 JD 生成要找的角色和 LinkedIn 搜索链接
- 每周回看用 AI 写一段总结
- 云端同步（登录后多设备共享数据）
- 语音输入
