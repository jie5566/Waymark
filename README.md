# Waymark · 求职地图

一个 Jvision 产品。框架 v0.1。

一个记录求职过程、让你“看见自己走过的路”的小 App。手机和电脑都能用，界面支持中文、英文、瑞典语。

## 结构

```
index.html              App 外壳（顶栏、地图、记录、回看、手机底部标签栏）
styles.css              样式；冷色调；≥900px 宽为电脑布局（左地图 + 右侧栏）
config.js               填 AI 接口地址；留空 = 演示模式（不接 AI）
js/i18n.js              三语文案（英文和瑞典语上线前请母语者校对）
js/store.js             数据：只存在本机浏览器（localStorage），隐私友好
js/map.js               用代码生成的地形、迷雾和地图元素
js/ai.js                调用后端；未配置时用内置的简单回复
js/app.js               对话、草稿卡片、每周回看
js/jobs.js              今日发现：每天从 Platsbanken 挑几个贴合的职位，“我申请了”直接进入记录对话
worker/jobs.js          后端：每天定时抓取、AI 分析、打分（见 worker/README.md）
worker/companies.js     关注的公司：识别招聘系统（Teamtailor / Greenhouse / Lever / Ashby），读官网职位
supabase/functions/ai-followup/index.ts
                        后端：保管 Gemini 密钥，读取职位链接，返回结构化的记录草稿
```

## 数据怎么流动

1. 你在“记录”里贴链接或打字。
2. 前端把消息、最近的对话、已有的区域和本周数字发给 Supabase 函数。
3. 函数尝试读取链接页面（需要登录的页面读不到，AI 会改为直接问公司和岗位），再调用 Gemini，要求它按固定的 JSON 格式返回：一句回复、0–3 个快捷回答、若干条记录草稿。
4. 草稿出现在对话上方的卡片里，可以直接点文字修改，确认“保存”后才算数，地图随之生长。

## 接上 Gemini（大约 15 分钟）

需要：Supabase 账号、[Supabase CLI](https://supabase.com/docs/guides/cli)、一个 Gemini API 密钥（在 Google AI Studio 里创建）。

```bash
# 1. 登录并关联项目（把 <project-ref> 换成你的项目 ID）
supabase login
supabase link --project-ref <project-ref>

# 2. 把 Gemini 密钥存成后端的秘密变量（只存在服务器上，不会进浏览器）
supabase secrets set GEMINI_API_KEY=你的密钥
# 可选：换模型，默认 gemini-3.6-flash
supabase secrets set GEMINI_MODEL=gemini-3.6-flash

# 3. 部署函数
supabase functions deploy ai-followup
```

然后在 `config.js` 里填：

```js
AI_URL: "https://<project-ref>.supabase.co/functions/v1/ai-followup",
SUPABASE_ANON_KEY: "<项目的 publishable / anon key>",
```

publishable（anon）key 可以放在浏览器里，Gemini 密钥绝对不要放进前端代码。

正式上线前，建议在函数的秘密变量里设置 `ALLOWED_ORIGIN` 为你的网址，并在 Supabase 里加上调用频率限制，防止别人盗用你的额度。

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
