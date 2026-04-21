import type {
  RawData, WrappedData, MonthlyStats, ModelTokens,
} from './types.js'

// ── 工具函数 ──

function toDateStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10) // YYYY-MM-DD
}

function toMonthStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7) // YYYY-MM
}

function toHour(ts: number): number {
  return new Date(ts).getHours()
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

function toWeekday(ts: number): string {
  return WEEKDAYS[new Date(ts).getDay()]
}

/** 从项目路径中提取简短名称 */
function shortProjectName(projectPath: string): string {
  if (!projectPath) return '(unknown)'
  // /Users/xxx/Developer/my-project → my-project
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || projectPath
}

/** 判断是否包含中文字符 */
function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

/** 判断是否深夜 (0:00-5:00) */
function isLateNight(ts: number): boolean {
  const h = toHour(ts)
  return h >= 0 && h < 5
}

// ── 基础统计 ──

function computeBasicStats(raw: RawData) {
  const prompts = raw.prompts
  const apiCalls = raw.apiCalls

  // 排序
  const sortedPrompts = [...prompts].sort((a, b) => a.timestamp - b.timestamp)
  const sortedCalls = [...apiCalls].sort((a, b) => a.timestamp - b.timestamp)

  // 所有时间戳
  const allTimestamps = [
    ...sortedPrompts.map(p => p.timestamp),
    ...sortedCalls.map(a => a.timestamp),
  ].sort((a, b) => a - b)

  const firstTs = allTimestamps[0]
  const lastTs = allTimestamps[allTimestamps.length - 1]

  // 活跃天数（基于 prompt）
  const activeDaySet = new Set(sortedPrompts.map(p => toDateStr(p.timestamp)))

  // 总 token
  let totalTokens = 0
  for (const call of apiCalls) {
    totalTokens += call.usage.input_tokens
      + call.usage.output_tokens
      + call.usage.cache_read_input_tokens
      + call.usage.cache_creation_input_tokens
  }

  // 独立对话数（基于 sessionId）
  const sessionSet = new Set(sortedPrompts.map(p => p.sessionId).filter(Boolean))

  const totalDays = Math.ceil((lastTs - firstTs) / (1000 * 60 * 60 * 24)) + 1

  return {
    firstDate: toDateStr(firstTs),
    lastDate: toDateStr(lastTs),
    totalDays,
    activeDays: activeDaySet.size,
    totalPrompts: prompts.length,
    totalTokens,
    totalApiCalls: apiCalls.length,
    totalConversations: sessionSet.size,
    sortedPrompts,
    sortedCalls,
  }
}

// ── 月度统计 ──

function computeMonthly(raw: RawData): MonthlyStats[] {
  const monthMap = new Map<string, { prompts: number; tokens: number; apiCalls: number; days: Set<string> }>()

  for (const p of raw.prompts) {
    const m = toMonthStr(p.timestamp)
    if (!monthMap.has(m)) monthMap.set(m, { prompts: 0, tokens: 0, apiCalls: 0, days: new Set() })
    const entry = monthMap.get(m)!
    entry.prompts++
    entry.days.add(toDateStr(p.timestamp))
  }

  for (const a of raw.apiCalls) {
    const m = toMonthStr(a.timestamp)
    if (!monthMap.has(m)) monthMap.set(m, { prompts: 0, tokens: 0, apiCalls: 0, days: new Set() })
    const entry = monthMap.get(m)!
    entry.tokens += a.usage.input_tokens + a.usage.output_tokens
      + a.usage.cache_read_input_tokens + a.usage.cache_creation_input_tokens
    entry.apiCalls++
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      prompts: v.prompts,
      tokens: v.tokens,
      apiCalls: v.apiCalls,
      activeDays: v.days.size,
    }))
}

// ── 模型分布 ──

function computeModelUsage(raw: RawData): Record<string, ModelTokens> {
  const result: Record<string, ModelTokens> = {}

  for (const a of raw.apiCalls) {
    const model = a.model
    if (!result[model]) {
      result[model] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, callCount: 0 }
    }
    const m = result[model]
    m.inputTokens += a.usage.input_tokens
    m.outputTokens += a.usage.output_tokens
    m.cacheReadTokens += a.usage.cache_read_input_tokens
    m.cacheCreationTokens += a.usage.cache_creation_input_tokens
    m.totalTokens += a.usage.input_tokens + a.usage.output_tokens
      + a.usage.cache_read_input_tokens + a.usage.cache_creation_input_tokens
    m.callCount++
  }

  return result
}

// ── 时间分布 ──

function computeHourDistribution(raw: RawData): Record<number, number> {
  const dist: Record<number, number> = {}
  for (let h = 0; h < 24; h++) dist[h] = 0
  for (const p of raw.prompts) {
    dist[toHour(p.timestamp)]++
  }
  return dist
}

function computeWeekdayDistribution(raw: RawData): Record<string, number> {
  const dist: Record<string, number> = {}
  for (const d of WEEKDAYS) dist[d] = 0
  for (const p of raw.prompts) {
    dist[toWeekday(p.timestamp)]++
  }
  return dist
}

// ── 项目分布 ──

function computeProjectDistribution(raw: RawData) {
  // 总体 top 项目
  const projectCount = new Map<string, number>()
  for (const p of raw.prompts) {
    const name = shortProjectName(p.project)
    projectCount.set(name, (projectCount.get(name) ?? 0) + 1)
  }
  const topProjects = [...projectCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))

  // 月度 top 项目
  const monthlyMap = new Map<string, Map<string, number>>()
  for (const p of raw.prompts) {
    const month = toMonthStr(p.timestamp)
    const name = shortProjectName(p.project)
    if (!monthlyMap.has(month)) monthlyMap.set(month, new Map())
    const mmap = monthlyMap.get(month)!
    mmap.set(name, (mmap.get(name) ?? 0) + 1)
  }

  const monthlyProjects: Record<string, { name: string; count: number }[]> = {}
  for (const [month, mmap] of monthlyMap) {
    monthlyProjects[month] = [...mmap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }

  return { topProjects, monthlyProjects }
}

// ── 语言比例 ──

function computeLanguageRatio(raw: RawData) {
  let chineseCount = 0
  for (const p of raw.prompts) {
    if (hasChinese(p.display)) chineseCount++
  }
  const total = raw.prompts.length || 1
  return {
    chineseRatio: chineseCount / total,
    englishRatio: (total - chineseCount) / total,
  }
}

// ── 极端值 ──

function computeExtremes(raw: RawData) {
  const prompts = raw.prompts

  // 最忙的一天
  const dayCount = new Map<string, { count: number; projects: Map<string, number> }>()
  for (const p of prompts) {
    const day = toDateStr(p.timestamp)
    if (!dayCount.has(day)) dayCount.set(day, { count: 0, projects: new Map() })
    const d = dayCount.get(day)!
    d.count++
    const proj = shortProjectName(p.project)
    d.projects.set(proj, (d.projects.get(proj) ?? 0) + 1)
  }

  let busiestDay = { date: '', count: 0, topProject: '' }
  for (const [date, { count, projects }] of dayCount) {
    if (count > busiestDay.count) {
      const topProj = [...projects.entries()].sort((a, b) => b[1] - a[1])[0]
      busiestDay = { date, count, topProject: topProj?.[0] ?? '' }
    }
  }

  // 最晚的夜（0:00-5:00 之间最晚的）
  const lateNightPrompts = prompts.filter(p => isLateNight(p.timestamp))
  let latestNight = { timestamp: '', prompt: '', project: '' }
  if (lateNightPrompts.length > 0) {
    // 按小时:分钟排序，取最晚的
    const sorted = lateNightPrompts.sort((a, b) => {
      const ha = toHour(a.timestamp) * 60 + new Date(a.timestamp).getMinutes()
      const hb = toHour(b.timestamp) * 60 + new Date(b.timestamp).getMinutes()
      return hb - ha
    })
    const latest = sorted[0]
    latestNight = {
      timestamp: new Date(latest.timestamp).toISOString(),
      prompt: latest.display.slice(0, 100),
      project: shortProjectName(latest.project),
    }
  }

  // 最长的 prompt
  let longestPrompt = { text: '', length: 0, date: '' }
  for (const p of prompts) {
    if (p.display.length > longestPrompt.length) {
      longestPrompt = {
        text: p.display.slice(0, 200),
        length: p.display.length,
        date: toDateStr(p.timestamp),
      }
    }
  }

  // 第一条 prompt
  const sorted = [...prompts].sort((a, b) => a.timestamp - b.timestamp)
  const first = sorted[0]
  const firstPrompt = first
    ? { text: first.display.slice(0, 100), date: toDateStr(first.timestamp), project: shortProjectName(first.project) }
    : { text: '', date: '', project: '' }

  const firstProject = first ? shortProjectName(first.project) : ''

  return { busiestDay, latestNight, longestPrompt, firstPrompt, firstProject }
}

// ── 深夜统计 ──

function computeLateNight(raw: RawData) {
  const latePrompts = raw.prompts.filter(p => isLateNight(p.timestamp))
  const lateDays = new Set(latePrompts.map(p => toDateStr(p.timestamp)))
  return { lateNightCount: latePrompts.length, lateNightDays: lateDays.size }
}

// ── 有趣内容提取 ──

function extractInterestingContent(raw: RawData) {
  const LEARNING_KEYWORDS = ['教我', '怎么', '为什么', '什么是', '如何', '帮我理解', 'how to', 'what is', 'why', 'explain', 'teach me']
  const FRUSTRATION_KEYWORDS = ['不行', '卡住', '错了', '不对', '又挂了', '崩了', '失败', 'error', 'bug', 'broken', 'failed', 'stuck', "doesn't work", "not working"]
  const INTERESTING_PATTERNS = [/[🎉🚀🎨💡🔥❤️😂🤔]/u, /[!！]{2,}/, /[?？]{2,}/]

  const learningMoments: { date: string; text: string }[] = []
  const frustrationMoments: { date: string; text: string }[] = []
  const interestingPrompts: { date: string; text: string; project: string; reason: string }[] = []

  for (const p of raw.prompts) {
    const text = p.display
    const date = toDateStr(p.timestamp)
    const project = shortProjectName(p.project)

    // 学习时刻
    if (learningMoments.length < 15) {
      for (const kw of LEARNING_KEYWORDS) {
        if (text.toLowerCase().includes(kw.toLowerCase())) {
          learningMoments.push({ date, text: text.slice(0, 100) })
          break
        }
      }
    }

    // 挫折时刻
    if (frustrationMoments.length < 15) {
      for (const kw of FRUSTRATION_KEYWORDS) {
        if (text.toLowerCase().includes(kw.toLowerCase())) {
          frustrationMoments.push({ date, text: text.slice(0, 100) })
          break
        }
      }
    }

    // 有趣的 prompt
    if (interestingPrompts.length < 15) {
      for (const pat of INTERESTING_PATTERNS) {
        if (pat.test(text)) {
          interestingPrompts.push({ date, text: text.slice(0, 100), project, reason: '包含特殊表达' })
          break
        }
      }
    }
  }

  return { learningMoments, frustrationMoments, interestingPrompts }
}

// ── Prompt 演变 ──

function computePromptEvolution(raw: RawData) {
  // 月度平均 prompt 长度
  const monthLengths = new Map<string, { total: number; count: number }>()
  for (const p of raw.prompts) {
    const m = toMonthStr(p.timestamp)
    if (!monthLengths.has(m)) monthLengths.set(m, { total: 0, count: 0 })
    const entry = monthLengths.get(m)!
    entry.total += p.display.length
    entry.count++
  }

  const monthlyPromptLength: Record<string, number> = {}
  for (const [month, { total, count }] of monthLengths) {
    monthlyPromptLength[month] = Math.round(total / count)
  }

  // 关键词频率
  const TECH_KEYWORDS = [
    'api', 'bug', 'test', 'deploy', 'build', 'fix', 'refactor', 'component',
    'database', 'error', 'function', 'type', 'style', 'config', 'docker',
    'git', 'npm', 'react', 'vue', 'node', 'python', 'rust', 'typescript',
  ]

  const keywordCount = new Map<string, number>()
  for (const p of raw.prompts) {
    const lower = p.display.toLowerCase()
    for (const kw of TECH_KEYWORDS) {
      if (lower.includes(kw)) {
        keywordCount.set(kw, (keywordCount.get(kw) ?? 0) + 1)
      }
    }
  }

  const topKeywords = [...keywordCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }))

  return { monthlyPromptLength, topKeywords }
}

// ── 主入口 ──

export function analyze(raw: RawData): WrappedData {
  const basic = computeBasicStats(raw)
  const monthly = computeMonthly(raw)
  const modelUsage = computeModelUsage(raw)
  const hourDistribution = computeHourDistribution(raw)
  const weekdayDistribution = computeWeekdayDistribution(raw)
  const { topProjects, monthlyProjects } = computeProjectDistribution(raw)
  const { chineseRatio, englishRatio } = computeLanguageRatio(raw)
  const extremes = computeExtremes(raw)
  const lateNight = computeLateNight(raw)
  const interesting = extractInterestingContent(raw)
  const evolution = computePromptEvolution(raw)

  return {
    username: raw.username,
    firstDate: basic.firstDate,
    lastDate: basic.lastDate,
    totalDays: basic.totalDays,
    activeDays: basic.activeDays,
    totalPrompts: basic.totalPrompts,
    totalTokens: basic.totalTokens,
    totalApiCalls: basic.totalApiCalls,
    totalConversations: basic.totalConversations,
    monthly,
    modelUsage,
    hourDistribution,
    weekdayDistribution,
    topProjects,
    monthlyProjects,
    chineseRatio,
    englishRatio,
    monthlyPromptLength: evolution.monthlyPromptLength,
    topKeywords: evolution.topKeywords,
    ...extremes,
    ...lateNight,
    ...interesting,
  }
}
