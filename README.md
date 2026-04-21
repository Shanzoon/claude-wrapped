# Claude Wrapped

一行命令，生成你的 Claude Code 个人使用报告 + 可分享的一图流。

```bash
npx claude-wrapped
```

## 输出

- **claude-wrapped-report.md** — 深度个人画像报告《Claude 眼中的你》，包含成长轨迹、性格画像、工作节奏分析等
- **claude-wrapped-card.png** — 1080x1920 竖版分享卡片，适合发 X / 朋友圈

## 前置条件

- macOS / Linux
- 已安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 并有使用历史
- `claude` 命令可用（报告生成阶段会调用 `claude -p`）

## 原理

```
~/.claude/history.jsonl          ──┐
                                    ├─→ Node 数据引擎 ──→ WrappedData JSON
~/.claude/projects/**/*.jsonl    ──┘         │
                                             ├─→ claude -p ──→ MD 报告
                                             └─→ satori + resvg-js ──→ PNG 卡片
```

1. **数据采集**：读取本地 Claude Code 历史（prompt 记录 + 对话 JSONL），零网络请求
2. **数据分析**：纯 Node 计算统计指标、时间分布、项目分布、极端值、人格标签等
3. **报告生成**：将分析数据注入 prompt，调用 `claude -p` 生成有温度的叙事报告
4. **一图流**：用 satori（JSX → SVG）+ resvg-js（SVG → PNG）渲染分享卡片

## 隐私

- 所有数据处理在本地完成
- 报告生成通过 `claude -p` 调用你自己的 Claude，不经过第三方服务
- 不上传、不存储任何数据

## License

MIT
