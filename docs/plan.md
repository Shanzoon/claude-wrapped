# Claude Wrapped 实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一行 `npx claude-wrapped` 命令，读取本地 Claude Code 使用数据，生成个性化叙事报告（md）+ 可分享的一图流（png）

**Architecture:** 三层管线——Node 脚本做数据提取/统计 → `claude -p` 做叙事生成 → Node 脚本做图片渲染。npx 包发布到 npm，零安装运行。

**Tech Stack:** TypeScript, Node.js (ESM), `claude -p` (非交互模式), satori + resvg-js (SVG→PNG, 纯 JS 无 native 依赖)

---

## 项目结构

```
claude-wrapped/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # CLI 入口 + 主流程编排
│   ├── collector.ts          # 数据采集：读 history.jsonl + 对话 JSONL
│   ├── analyzer.ts           # 数据分析：统计指标 + 人格标签 + 极端值
│   ├── types.ts              # 类型定义
│   ├── prompt.ts             # 分析 prompt 模板 + 数据注入
│   ├── reporter.ts           # 调 claude -p 生成 md 报告
│   └── card.ts               # 一图流 PNG 生成
├── assets/
│   └── card-template.tsx     # satori JSX 模板
└── README.md
```

---

## 数据源说明

供开发时参考，来自当前机器的实际数据：

| 数据文件 | 路径 | 大小 | 说明 |
|---------|------|------|------|
| 用户 prompt 历史 | `~/.claude/history.jsonl` | 2.5MB, ~4900 行 | 每行一条用户输入，含 timestamp, display, project, sessionId |
| 对话完整记录 | `~/.claude/projects/**/*.jsonl` | 203MB, 612 个文件 | 含 assistant 消息的 usage 字段（精确 token 数）|
| 统计缓存 | `~/.claude/stats-cache.json` | 7.6KB | 可能过期，仅作参考，不依赖 |

### history.jsonl 单行结构
```json
{"display":"用户输入内容","pastedContents":{},"timestamp":1767465912443,"project":"/Users/xxx/project","sessionId":"uuid"}
```

### 对话 JSONL 中 assistant 消息结构（含 token）
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "usage": {
      "input_tokens": 3,
      "output_tokens": 26,
      "cache_read_input_tokens": 0,
      "cache_creation_input_tokens": 22254
    }
  },
  "timestamp": 1776736960000
}
```

---

## 阶段规划

### 阶段 1：数据引擎（P1）
> 预估 30-40 分钟 | 一个对话窗口

纯 Node 脚本，不涉及 LLM，输出一个结构化 JSON。

#### Task 1.1: 项目初始化

**Files:**
- Create: `package.json`, `tsconfig.json`, `src/types.ts`, `src/index.ts`

- [ ] **Step 1:** 初始化项目

```bash
mkdir -p claude-wrapped/src && cd claude-wrapped
npm init -y
npm install typescript tsx -D
```

- [ ] **Step 2:** 配置 package.json

关键字段：
```json
{
  "name": "claude-wrapped",
  "version": "0.1.0",
  "type": "module",
  "bin": { "claude-wrapped": "./dist/index.js" },
  "files": ["dist", "assets"]
}
```

- [ ] **Step 3:** 定义核心类型 `src/types.ts`

```typescript
export interface WrappedData {
  // 基础信息
  username: string
  firstDate: string           // 首次使用日期
  lastDate: string            // 最后使用日期
  totalDays: number           // 跨越天数
  activeDays: number          // 活跃天数

  // 总量
  totalPrompts: number
  totalTokens: number
  totalApiCalls: number
  totalConversations: number

  // 月度
  monthly: MonthlyStats[]

  // 模型分布
  modelUsage: Record<string, ModelTokens>

  // 时间节奏
  hourDistribution: Record<number, number>    // 小时 → prompt数
  weekdayDistribution: Record<string, number> // 星期 → prompt数

  // 项目分布
  topProjects: { name: string; count: number }[]
  monthlyProjects: Record<string, { name: string; count: number }[]>

  // 语言
  chineseRatio: number
  englishRatio: number

  // Prompt 演变
  monthlyPromptLength: Record<string, number> // 月→平均长度

  // 关键词
  topKeywords: { word: string; count: number }[]

  // 极端值
  busiestDay: { date: string; count: number; topProject: string }
  latestNight: { timestamp: string; prompt: string; project: string }
  longestPrompt: { text: string; length: number; date: string }

  // 第一次
  firstPrompt: { text: string; date: string; project: string }
  firstProject: string

  // 深夜统计
  lateNightCount: number      // 0-5点的 prompt 数
  lateNightDays: number       // 有深夜活动的天数

  // 有趣的 prompt 摘录（供 Claude 分析用）
  interestingPrompts: { date: string; text: string; project: string; reason: string }[]

  // 学习时刻
  learningMoments: { date: string; text: string }[]

  // 挫折时刻
  frustrationMoments: { date: string; text: string }[]
}
```

- [ ] **Step 4:** 写入 `src/index.ts` 骨架

```typescript
#!/usr/bin/env node
import { collect } from './collector.js'
import { analyze } from './analyzer.js'
import { generateReport } from './reporter.js'
import { generateCard } from './card.js'

async function main() {
  console.log('🎬 Claude Wrapped — 生成中...\n')

  const step1 = '📊 正在扫描数据...'
  console.log(step1)
  const rawData = await collect()

  const step2 = '🔍 正在分析...'
  console.log(step2)
  const analysis = analyze(rawData)

  const step3 = '✍️  正在生成报告（调用 Claude）...'
  console.log(step3)
  const report = await generateReport(analysis)

  const step4 = '🖼️  正在生成一图流...'
  console.log(step4)
  await generateCard(analysis)

  console.log('\n✅ 完成！')
  console.log(`   报告: ${report}`)
  console.log(`   一图流: ./claude-wrapped-card.png`)
}

main().catch(console.error)
```

- [ ] **Step 5:** Commit

#### Task 1.2: 数据采集器 collector.ts

**Files:**
- Create: `src/collector.ts`

从 `~/.claude/` 读取所有数据，返回原始结构。

- [ ] **Step 1:** 实现 history.jsonl 解析

读取 `~/.claude/history.jsonl`，逐行解析，提取 `{ timestamp, display, project, sessionId }`。过滤掉 `/` 开头的命令。

- [ ] **Step 2:** 实现对话 JSONL 扫描

递归扫描 `~/.claude/projects/**/*.jsonl`，从 type=assistant 的消息中提取 `{ model, usage, timestamp }`。

关键：612 个文件 203MB，需要流式读取（readline），不能全部读入内存。

- [ ] **Step 3:** 返回合并的原始数据结构

```typescript
export interface RawData {
  prompts: PromptEntry[]       // 来自 history.jsonl
  apiCalls: ApiCallEntry[]     // 来自对话 JSONL
  username: string             // 从 homedir 路径提取
}
```

- [ ] **Step 4:** 本地运行验证，确认能正确读取当前机器数据
- [ ] **Step 5:** Commit

#### Task 1.3: 分析引擎 analyzer.ts

**Files:**
- Create: `src/analyzer.ts`

纯计算，输入 RawData，输出 WrappedData。

- [ ] **Step 1:** 实现基础统计

总量、月度、时段分布、星期分布、项目分布、语言比例。

- [ ] **Step 2:** 实现极端值提取

最忙的一天、最晚的夜、最长的 prompt、第一条 prompt。

- [ ] **Step 3:** 实现有趣内容提取

通过关键词匹配提取：学习时刻（"教我"、"怎么"、"为什么"）、挫折时刻（"不行"、"卡住"、"错了"）、有趣 prompt（含表情、特殊格式等）。每类最多取 15 条。

- [ ] **Step 4:** 实现 prompt 演变分析

月度平均 prompt 长度、月度技术关键词频率。

- [ ] **Step 5:** 本地验证：运行后检查 JSON 输出是否与我们之前手动分析的数据一致
- [ ] **Step 6:** Commit

**阶段 1 验收：** 运行脚本，输出一个完整的 WrappedData JSON 文件，数据准确。

---

### 阶段 2：报告生成（P2）
> 预估 20-30 分钟 | 同一个或新的对话窗口

#### Task 2.1: Prompt 模板 prompt.ts

**Files:**
- Create: `src/prompt.ts`

- [ ] **Step 1:** 编写分析 prompt

这是产品的灵魂。prompt 结构：

```typescript
export function buildPrompt(data: WrappedData): string {
  return `
你是一个数据分析师，擅长从用户行为数据中洞察人物性格和成长轨迹。

以下是一位 Claude Code 用户「${data.username}」的完整使用数据统计。请基于这些数据，以第三人称视角撰写一份深度个人画像报告《Claude 眼中的 ${data.username}》。

## 要求
- 以第三人称叙述，视角是 Claude 观察这位用户
- 所有结论必须有数据支撑，引用具体 prompt 原文作为证据
- 不要泛泛而谈，要有细致入微的观察
- 包含以下章节：
  1. 他/她是谁（基于项目和 prompt 内容推断职业和身份）
  2. 数据全貌（使用表格展示关键数字）
  3. 成长轨迹（按月份分阶段，每阶段引用关键 prompt）
  4. 性格画像（从数据中推导性格特征，每个特征给证据）
  5. 工作节奏指纹（时段和星期分布可视化）
  6. 一些细节（有趣的、意想不到的发现）
  7. 总结（一段有温度的概括）

## 用户数据

${JSON.stringify(data, null, 2)}
`
}
```

- [ ] **Step 2:** 处理数据体积问题

WrappedData JSON 可能很大（interestingPrompts 等），需要控制在 claude -p 的输入限制内。如果超过 100K 字符，截断 prompt 原文到前 80 字符。

- [ ] **Step 3:** Commit

#### Task 2.2: 报告生成器 reporter.ts

**Files:**
- Create: `src/reporter.ts`

- [ ] **Step 1:** 实现 claude -p 调用

```typescript
import { execSync } from 'child_process'

export async function generateReport(data: WrappedData): Promise<string> {
  const prompt = buildPrompt(data)
  const tmpFile = '/tmp/claude-wrapped-prompt.txt'
  writeFileSync(tmpFile, prompt)

  const output = execSync(
    `cat "${tmpFile}" | claude -p --max-turns 1`,
    { maxBuffer: 10 * 1024 * 1024, timeout: 300_000 }
  ).toString()

  const reportPath = `./claude-wrapped-report.md`
  writeFileSync(reportPath, output)
  return reportPath
}
```

- [ ] **Step 2:** 添加进度提示（claude -p 可能需要 30-60 秒）
- [ ] **Step 3:** 本地验证：生成的 md 报告质量是否达到我们之前对话的水平
- [ ] **Step 4:** Commit

**阶段 2 验收：** `npx tsx src/index.ts` 能完整输出 md 报告，内容质量与我们之前的对话产出一致。

---

### 阶段 3：一图流（P3）
> 预估 20-30 分钟

#### Task 3.1: 一图流 PNG 生成

**Files:**
- Create: `src/card.ts`, `assets/card-template.tsx`

技术选型：用 **satori**（Vercel 出品，JSX → SVG）+ **@resvg/resvg-js**（SVG → PNG）。

优势：纯 JS，无 native 依赖，npx 友好，无需 puppeteer/canvas。

- [ ] **Step 1:** 安装依赖

```bash
npm install satori @resvg/resvg-js
```

- [ ] **Step 2:** 设计卡片布局（JSX）

竖版 1080x1920（适合手机截图分享），深色背景，内容：
- 顶部：Claude Wrapped 标题 + 用户名
- 核心数据区：总 prompt / 总 token / 活跃天数（大字）
- 成长标签："从 [第一条prompt关键词] 到 [最近项目]"
- 人格标签（基于 analyzer 的规则生成）
- 迷你时段热力图
- 底部：`npx claude-wrapped` + 日期

- [ ] **Step 3:** 实现 card.ts

```typescript
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

export async function generateCard(data: WrappedData) {
  const svg = await satori(CardTemplate(data), {
    width: 1080, height: 1920,
    fonts: [/* 内嵌一个中英文字体 */]
  })
  const png = new Resvg(svg).render().asPng()
  writeFileSync('./claude-wrapped-card.png', png)
}
```

- [ ] **Step 4:** 字体处理：内嵌一个免费中文字体（如 Noto Sans SC），打包进 npm
- [ ] **Step 5:** 本地验证：生成的 PNG 视觉效果是否达标
- [ ] **Step 6:** Commit

**阶段 3 验收：** 生成一张视觉良好、包含关键数据的 PNG，可直接发 X。

---

### 阶段 4：打包发布（P4）
> 预估 15-20 分钟

#### Task 4.1: 构建与发布

**Files:**
- Modify: `package.json`, `tsconfig.json`
- Create: `README.md`

- [ ] **Step 1:** 配置 TypeScript 构建

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  }
}
```

- [ ] **Step 2:** 配置 package.json bin 和 prepublish

```json
{
  "bin": { "claude-wrapped": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  }
}
```

- [ ] **Step 3:** 写 README.md

核心内容：一行命令 + 效果截图 + 原理说明

- [ ] **Step 4:** 本地测试 npx

```bash
npm run build
npm link
claude-wrapped   # 本地测试
npm unlink
```

- [ ] **Step 5:** 发布到 npm

```bash
npm login
npm publish
```

- [ ] **Step 6:** 验证 `npx claude-wrapped` 在全新环境可运行

**阶段 4 验收：** 任何有 Claude Code 的用户执行 `npx claude-wrapped` 即可获得完整报告 + 一图流。

---

## 时间估算总览

| 阶段 | 内容 | 预估时间 | 累计 |
|------|------|---------|------|
| P1 | 数据引擎（采集+分析） | 30-40 min | 40 min |
| P2 | 报告生成（prompt+claude调用） | 20-30 min | 70 min |
| P3 | 一图流 PNG | 20-30 min | 100 min |
| P4 | 打包发布 | 15-20 min | 120 min |

**总计：约 2 小时**（开发者执行时间，含调试）

---

## 风险点

1. **字体打包体积**：中文字体通常 5-15MB，会导致 npx 首次下载慢。缓解：用字体子集化工具裁剪到常用字符，或只在一图流中使用英文+数字（中文用 fallback）
2. **claude -p 超时**：如果数据量大，Claude 生成时间可能超过 1 分钟。缓解：给 execSync 设 5 分钟超时
3. **跨平台路径**：Windows 的 Claude Code 数据目录可能不在 `~/.claude/`。缓解：v1 先只支持 macOS/Linux
4. **satori 中文渲染**：satori 需要显式加载字体。缓解：内嵌 Noto Sans SC subset

---

## 决策备忘

- ✅ 用 `claude -p` 调用用户自己的 Claude，不需要 API key
- ✅ 数据提取用 Node 脚本（快、准、零 token），叙事生成用 Claude（有温度）
- ✅ 一图流用 satori + resvg-js（纯 JS，无 native 依赖）
- ✅ v1 只做 md 报告 + 一图流 PNG，交互式 HTML 留给 v2
- ✅ v1 只支持 macOS/Linux
- ❌ 不做问答/测试交互
- ❌ 不做后端/数据上传
