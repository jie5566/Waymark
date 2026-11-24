# Waymark · 品牌素材包 / Brand kit

Logo 方向 L2「从雾里走出来」：一条柔和的小路连成 w，开头是淡的，越接近右上角的“今天”越清楚，对应 App 里地图上的雾慢慢散开。字标是小写 waymark，Nunito Sans Regular。

## 文件

| 文件夹 | 内容 |
|---|---|
| `svg/` | 矢量原稿，文字已转成路径，不依赖字体 |
| `png/` | 透明背景 PNG（app icon 除外，它自带底色） |
| `fonts/` | Nunito Sans 可变字体 + OFL 授权文件 |
| `favicon.ico` | 16 / 32 / 48 px 合一 |

**版本**
- `waymark-mark` 只有图形；`waymark-lockup` 图形 + waymark 字标
- 无后缀：浅色背景用（墨色 + 蓝）
- `-white`：深色背景用（白 + 浅蓝）
- `-mono` / `-mono-white`：单色，用于盖章、打印、单色场景
- `waymark-app-icon`：圆角，用于网页和展示
- `waymark-app-icon-square`：直角满版，给 iOS / Android / PWA，系统会自己裁圆角
- `favicon`：32 px 以下专用简化版，线更粗、渐变开头没那么淡、去掉蓝点外圈，小尺寸更清楚

**PNG 命名**：`-512w` 是宽 512 px，`-160h` 是高 160 px。

## 颜色

| 名称 | HEX | 用途 |
|---|---|---|
| Ink | `#1E2329` | 文字、图形主色 |
| Route Blue | `#2F5D8C` | 强调色，“今天”的点，投递 |
| Route Blue (dark) | `#8FB3DA` | 深色背景上的强调色 |
| Mist | `#F2F4F7` | 背景 |
| Muted | `#5E6670` | 次要文字 |
| Line | `#D5DAE1` | 分隔线 |
| Connect Orange | `#B4561A` | 连接 |
| Make Violet | `#6B4FA8` | 创作 |

## 字体

- 英文 / 瑞典语：**Nunito Sans**（字标用 Regular 400 小写，正文 400，标题 600）
- 中文：**Noto Sans SC / 思源黑体**
- 都是 SIL Open Font License，免费商用，可以嵌入网站和 App。

CSS：
```css
font-family: "Nunito Sans", "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
```

## 使用

- 留白：图形四周至少留出“今天”蓝点外圈直径那么宽的空间。
- 最小尺寸：完整图形不小于 24 px 高，更小的地方用 favicon 版。
- 不要拉伸、旋转、加阴影，不要改小路渐变的方向（永远是从淡到浓、通向“今天”），不要改动“今天”这个点的位置。
- 字标统一用小写 waymark；正文里提到产品名时可以写 Waymark。
- Waymark 是 Jvision 旗下的产品。需要署名时写 “a Jvision product”，放在 J logo 旁边，不和 Waymark 的 logo 并排。
