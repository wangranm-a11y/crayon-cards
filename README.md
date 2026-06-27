# 蜡笔卡 · Crayon Cards

> 文字一秒变小红书图文。

把一段文字粘进去，自动切成小红书 3:4 比例的精美卡片。每张图左上角自动盖上你的「蜡笔不拿笔」昵称印章。

## 特性

- ✦ **一键生成**：粘贴文字 → 选主题 → 出图
- ✦ **5 个主题**：米色信笺 / 暗夜诗笺 / 春日卡片 / 炭笔速写 / 杂志大字
- ✦ **智能拆分**：按段落 / 句子自动分页，每张约 220 字
- ✦ **左上角印章**：自动盖你的昵称，可改
- ✦ **可选封面**：标题作为第 1 张大字
- ✦ **隐私第一**：所有处理在浏览器里完成，文字不上传任何服务器
- ✦ **PWA**：可装到手机桌面，离线可用

## 在线体验

→ https://wangranm-a11y.github.io/crayon-cards/

## 本地运行

```bash
git clone https://github.com/wangranm-a11y/crayon-cards.git
cd crayon-cards
python3 -m http.server 8765
# 打开 http://localhost:8765
```

网页端零依赖、零构建、纯静态。

## CLI / Agent 调用

安装依赖并链接本机命令：

```bash
npm install
npm link
```

生成卡片：

```bash
crayon-cards \
  --title "今天的小确幸" \
  --text "第一段正文。\n\n第二段正文。" \
  --nickname "蜡笔不拿笔" \
  --tag "读书笔记" \
  --output-dir ./out \
  --json
```

CLI 默认使用：

- 主题：`charcoal`（炭笔速写）
- 字体：`huiwen`（汇文明朝体，本地 OTF）
- 输出：1080×1440 PNG

也可以把完整配置放进 JSON，适合 agent 稳定调用：

```json
{
  "title": "今天的小确幸",
  "text": "第一段正文。\n\n第二段正文。",
  "nickname": "蜡笔不拿笔",
  "tag": "读书笔记",
  "outputDir": "./out",
  "json": true
}
```

```bash
crayon-cards --config card.json
```

CLI 会复用网页里的同一套 `cards.js` 排版和导出逻辑，输出 1080×1440 PNG；`--json` 会打印 `{ ok, count, width, height, files }`，方便 agent 继续读取结果路径。

### 汇文明朝字体

为了避免浏览器导出时远程字体加载失败，CLI 会优先使用本地 OTF：

1. `CRAYON_HUIWEN_FONT` 环境变量
2. `--huiwen-font /path/to/Huiwen-mincho.otf`
3. `/tmp/crayon-cards/Huiwen-mincho.otf`
4. `node_modules/@fontpkg/huiwen-mincho/Huiwen-mincho.otf`
5. `fonts/Huiwen-mincho.otf`

如果 `--font huiwen` 找不到本地 OTF，CLI 会直接报错，避免静默回退成宋体或其它字体。

## License

MIT · 由「蜡笔不拿笔」出品
