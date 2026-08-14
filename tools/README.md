# 内容库工具

内容全部放在 `data/` 目录的 JSON 文件里。新增内容后跑两个命令：

1. `node tools/build-index.js` —— 重新生成 `data/index.json`（清单、条数、id 索引）并做结构检查
2. `node tools/build-embed.js` —— 生成内嵌数据包，保证双击 `index.html` 也能离线使用
3. `node tools/build-bundle.js` —— 改过 `js/` 代码后运行，重新打包成浏览器直接运行的脚本

然后刷新页面即可看到新内容（部署到服务器时也只需重新发布 `data/` 和 `js/embedded-data.js`）。

## 新增一条内容的字段要求

- `id`：唯一，建议格式 `类别前缀-四位序号`（如 `ANM-0001`）
- `category`：必须等于文件名对应的类别 key（见 `tools/build-index.js` 里的 CATS）
- `factual_type`：FACT / HISTORY / SCIENCE / OPINION / THOUGHT_EXPERIMENT / COUNTERFACTUAL / FICTION / LEGEND / HUMOR / QUESTION / TASK
- `rarity`：COMMON / UNCOMMON / RARE / VERY_RARE / SECRET / MYTHIC
- `layers.teaser`：必填，一句话（≤40 字）
- `layers.why` / `layers.deep`：可选，分层展开内容
- 事实类（SCIENCE / FACT / HISTORY）尽量填 `source.name` 与 `source.confidence`
- 虚构类必须 `factual_type: "FICTION"` 或 `"LEGEND"`，绝不冒充事实
