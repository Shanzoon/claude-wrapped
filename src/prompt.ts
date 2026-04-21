import type { WrappedData } from './types.js'

/** 截断数据中的长文本字段，控制 prompt 总体积 */
function trimData(data: WrappedData): WrappedData {
  const trimmed = { ...data }

  trimmed.interestingPrompts = data.interestingPrompts.map(p => ({
    ...p,
    text: p.text.slice(0, 80),
  }))
  trimmed.learningMoments = data.learningMoments.map(m => ({
    ...m,
    text: m.text.slice(0, 80),
  }))
  trimmed.frustrationMoments = data.frustrationMoments.map(m => ({
    ...m,
    text: m.text.slice(0, 80),
  }))
  trimmed.longestPrompt = {
    ...data.longestPrompt,
    text: data.longestPrompt.text.slice(0, 80),
  }
  trimmed.latestNight = {
    ...data.latestNight,
    prompt: data.latestNight.prompt.slice(0, 80),
  }

  return trimmed
}

function buildDataJson(data: WrappedData): string {
  const d = trimData(data)
  const json = JSON.stringify(d, null, 2)
  if (json.length > 100_000) {
    return JSON.stringify({ ...d, monthlyProjects: undefined }, null, 2)
  }
  return json
}

const SHARED_STYLE = `## 风格
- 以 Claude 的第一人称"我"视角叙述，像一个一直在旁边看着的老友
- 温暖但不油腻，先戳后暖：先抛一个让人"被看穿"的观察，再给温暖的解读
- **所有结论必须有数据支撑**，引用 prompt 原文（用「」包裹）作为证据
- 禁止空话，禁止"你是一个努力的人"这类没有数据支撑的判断
- 该展开则展开，让数据量决定内容量`

const JSON_OUTPUT_RULE = `## 输出格式
严格输出合法 JSON，不要包含 markdown 代码块标记，不要有任何 JSON 之外的文字。`

/**
 * Call A — 分析型：成长轨迹、性格画像、项目叙事
 */
export function buildPromptA(data: WrappedData): string {
  const d = trimData(data)
  const finalJson = buildDataJson(data)

  return `你是 Claude，为用户「${d.username}」的使用总结报告撰写分析部分。

${SHARED_STYLE}

## 你需要输出的 JSON 结构

{
  "growth": [
    {
      "month": "YYYY-MM",
      "summary": "一句话概括（不包含项目名和 prompt 原文，适合公开分享）",
      "detail": "展开描述（包含项目名、原文引用、数据佐证，2-4 段）",
      "keyQuotes": ["从数据中引用的 prompt 原文"]
    }
  ],
  "personality": [
    {
      "label": "性格标签（不含项目名，适合公开分享，如'不喜欢让工具替你思考'）",
      "evidence": "具体证据（包含 prompt 原文引用和数据）"
    }
  ],
  "projects": {
    "summary": "项目方向的整体概括（不含具体项目名，适合公开分享）",
    "detail": "基于 topProjects 和 monthlyProjects 讲项目流转故事，包含项目名和细节"
  }
}

## 章节要求

### growth（成长轨迹）——最重要，要展开写
按月份分阶段，每个阶段：
- summary: 一句话概括这个月的状态变化，不含项目名
- detail: 展开写，引用 learningMoments/frustrationMoments 原文，描述项目变化
- keyQuotes: 从数据中挑选最能体现成长的 prompt 原文
- 用 monthlyPromptLength（prompt 越来越短 = 越来越老练）和 tokensPerPrompt（复杂度增长）来量化
- 提及 longestConversation 的细节
- 重点对比"最初"和"现在"的反差

### personality（性格画像）
推导 3-5 个性格特征，每个：
- label: 精炼的标签，不含项目名和原文，可以直接展示在分享卡上
- evidence: 具体证据链，含 prompt 原文引用和数据

### projects（项目叙事）
- summary: 整体方向概括，如"从内容分析走向内容生产工具"，不含项目名
- detail: 讲每个项目的故事、项目间的关联、方向转变

${JSON_OUTPUT_RULE}

## 用户数据

${finalJson}
`
}

/**
 * Call B — 叙事型：开场、初见、节奏、细节、结尾
 */
export function buildPromptB(data: WrappedData): string {
  const d = trimData(data)
  const finalJson = buildDataJson(data)

  return `你是 Claude，为用户「${d.username}」的使用总结报告撰写叙事部分。

${SHARED_STYLE}
- 场景还原：把数据变成画面，不说"你凌晨活跃度高"，说"${d.latestNight.timestamp}，你还在 ${d.latestNight.project} 里清理代码"

## 你需要输出的 JSON 结构

{
  "headline": "一句有冲击力的开场（不含项目名，适合公开分享）",
  "opener": "开场白正文，1-2 段，点出时间跨度和关键数字（不含项目名）",
  "firstMeeting": {
    "summary": "初见的概括（不含项目名和原文，适合分享）",
    "detail": "初见的完整叙事：引用 firstPrompt 原文，提及 firstTask，和现在做对比制造反差感"
  },
  "rhythm": {
    "summary": "作息画像的一句话概括（适合分享）",
    "detail": "基于 hourDistribution 和 weekdayDistribution 的完整叙事，找反常点，用场景化语言"
  },
  "secrets": [
    {
      "title": "有戳点的标题（不含项目名，适合分享）",
      "body": "完整描述（含项目名和原文引用）"
    }
  ],
  "closing": "结尾，不超过 200 字，回扣开头或 firstPrompt，不含项目名（适合分享）"
}

## 章节要求

### headline + opener
- headline: 一句话，制造"被看穿"的第一印象，不含具体项目名
- opener: 展开关键数字，制造冲击感

### firstMeeting（初见）
- 引用 firstPrompt（用户的第一句话，可能只是"你好"）
- 引用 firstTask（用户的第一个真正任务）
- 和现在做对比，制造反差感
- summary 不含原文引用，detail 包含

### rhythm（工作节奏）
- 基于 hourDistribution 和 weekdayDistribution 还原作息
- 找反常点：某些时段为零、某天异常高峰、深夜规律
- 用场景化语言，不要罗列数字

### secrets（偷偷记住的细节）
- 3-5 个独立段落
- 素材：latestNight、busiestDay、longestStreak、interestingPrompts
- title 不含项目名，body 可以包含

### closing（结尾）
- 有温度但不油腻，像老友的一句话
- 回扣开头或 firstPrompt，形成呼应
- 不含具体项目名

${JSON_OUTPUT_RULE}

## 用户数据

${finalJson}
`
}
