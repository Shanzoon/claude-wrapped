import type {
  RawData, WrappedData, MonthlyStats, ModelTokens,
} from './types.js'

// ── 工具函数 ──

/** 本地日期 YYYY-MM-DD */
function toDateStr(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 本地月份 YYYY-MM */
function toMonthStr(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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
      tokensPerPrompt: v.prompts > 0 ? Math.round(v.tokens / v.prompts) : 0,
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
      timestamp: `${toDateStr(latest.timestamp)} ${String(toHour(latest.timestamp)).padStart(2, '0')}:${String(new Date(latest.timestamp).getMinutes()).padStart(2, '0')}`,
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

  // 第一条真正的任务（跳过问候和测试消息）
  const GREETINGS = ['你好', '你好呀', '嗨', '在吗', 'hello', 'hi', 'hey', 'test', '测试']
  const firstReal = sorted.find(p => {
    if (p.display.trim().length < 10) return false
    const lower = p.display.trim().toLowerCase()
    if (GREETINGS.some(g => lower === g)) return false
    if (shortProjectName(p.project) === raw.username) return false
    return true
  })
  const firstTask = firstReal
    ? { text: firstReal.display.slice(0, 100), date: toDateStr(firstReal.timestamp), project: shortProjectName(firstReal.project) }
    : firstPrompt // 兜底：如果全是问候，就用 firstPrompt

  return { busiestDay, latestNight, longestPrompt, firstPrompt, firstTask, firstProject }
}

// ── 深夜统计 ──

function computeLateNight(raw: RawData) {
  const latePrompts = raw.prompts.filter(p => isLateNight(p.timestamp))
  const lateDays = new Set(latePrompts.map(p => toDateStr(p.timestamp)))
  return { lateNightCount: latePrompts.length, lateNightDays: lateDays.size }
}

// ── 连续活跃天数 ──

function computeLongestStreak(raw: RawData) {
  const days = [...new Set(raw.prompts.map(p => toDateStr(p.timestamp)))].sort()
  if (days.length === 0) return { days: 0, startDate: '', endDate: '' }

  let best = { days: 1, startDate: days[0], endDate: days[0] }
  let cur = { days: 1, startDate: days[0], endDate: days[0] }

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]).getTime()
    const curr = new Date(days[i]).getTime()
    if (curr - prev === 86400000) {
      cur.days++
      cur.endDate = days[i]
    } else {
      cur = { days: 1, startDate: days[i], endDate: days[i] }
    }
    if (cur.days > best.days) best = { ...cur }
  }

  return best
}

// ── 最长单次对话 ──

function computeLongestConversation(raw: RawData) {
  const sessions = new Map<string, { count: number; project: string; timestamps: number[] }>()

  for (const p of raw.prompts) {
    if (!p.sessionId) continue
    if (!sessions.has(p.sessionId)) {
      sessions.set(p.sessionId, { count: 0, project: shortProjectName(p.project), timestamps: [] })
    }
    const s = sessions.get(p.sessionId)!
    s.count++
    s.timestamps.push(p.timestamp)
  }

  let best = { rounds: 0, project: '', startHour: 0, endHour: 0, startDate: '', endDate: '' }
  for (const [, s] of sessions) {
    if (s.count > best.rounds) {
      s.timestamps.sort((a, b) => a - b)
      best = {
        rounds: s.count,
        project: s.project,
        startHour: toHour(s.timestamps[0]),
        endHour: toHour(s.timestamps[s.timestamps.length - 1]),
        startDate: toDateStr(s.timestamps[0]),
        endDate: toDateStr(s.timestamps[s.timestamps.length - 1]),
      }
    }
  }

  return best
}

// ── 有趣内容提取 ──

/** 返回 ISO 周标识，如 "2026-W02" */
function weekKey(date: string): string {
  const d = new Date(date)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * 从候选列表中按限流策略选取，不满 15 条则逐轮放宽（每周+1，每月+1）。
 * 基础限额：每周 2 条、每月 4 条、总计 15 条。
 */
function selectWithRateLimit<T extends { date: string }>(candidates: T[], limit = 15): T[] {
  const selected: T[] = []
  const used = new Set<number>()

  for (let maxPerWeek = 2, maxPerMonth = 4; selected.length < limit; maxPerWeek++, maxPerMonth++) {
    const weekCounts = new Map<string, number>()
    const monthCounts = new Map<string, number>()
    // 重建已选条目的计数
    for (const item of selected) {
      const wk = weekKey(item.date)
      const mo = item.date.slice(0, 7)
      weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1)
      monthCounts.set(mo, (monthCounts.get(mo) ?? 0) + 1)
    }

    let added = false
    for (let i = 0; i < candidates.length && selected.length < limit; i++) {
      if (used.has(i)) continue
      const wk = weekKey(candidates[i].date)
      const mo = candidates[i].date.slice(0, 7)
      if ((weekCounts.get(wk) ?? 0) >= maxPerWeek) continue
      if ((monthCounts.get(mo) ?? 0) >= maxPerMonth) continue
      selected.push(candidates[i])
      used.add(i)
      weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1)
      monthCounts.set(mo, (monthCounts.get(mo) ?? 0) + 1)
      added = true
    }
    if (!added) break // 候选已耗尽，无需继续放宽
  }

  return selected
}

function extractInterestingContent(raw: RawData) {
  const LEARNING_KEYWORDS = ['教我', '怎么', '为什么', '什么是', '如何', '帮我理解', 'how to', 'what is', 'why', 'explain', 'teach me']
  const FRUSTRATION_KEYWORDS = ['不行', '卡住', '错了', '不对', '又挂了', '崩了', '失败', 'error', 'bug', 'broken', 'failed', 'stuck', "doesn't work", "not working"]
  // 情绪型 emoji（排除日志/工具型：🔄📝✗❯✅⚙️🔧📦🔍⏳▶️🛑📊🔗➡️）
  const EMOTION_EMOJI = /[🎉🚀🎨💡🔥❤️😂🤔😭😱🥳🤯😤😅💀🙏👍🎯🏆💪🤡😈]/u
  const INTERESTING_PATTERNS = [EMOTION_EMOJI, /[!！]{2,}/, /[?？]{2,}/]
  // 日志粘贴特征：以引号/日志前缀开头，或以常见日志 emoji 开头
  const LOG_PREFIX = /^[""\u201c]|^[\s]*[\d]{2,4}[:\-/]|^[🔄📝✗❯✅⚙️🔧📦🔍⏳▶️🛑📊🔗➡️=]/u

  const learningCandidates: { date: string; text: string }[] = []
  const frustrationCandidates: { date: string; text: string }[] = []
  const interestingCandidates: { date: string; text: string; project: string; reason: string }[] = []
  const seenTexts = new Set<string>()

  for (const p of raw.prompts) {
    const text = p.display
    const trimmed = text.slice(0, 100)
    const date = toDateStr(p.timestamp)
    const project = shortProjectName(p.project)

    // 同文本去重
    if (seenTexts.has(trimmed)) continue
    seenTexts.add(trimmed)

    for (const kw of LEARNING_KEYWORDS) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        learningCandidates.push({ date, text: trimmed })
        break
      }
    }
    for (const kw of FRUSTRATION_KEYWORDS) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        frustrationCandidates.push({ date, text: trimmed })
        break
      }
    }
    // interesting：额外过滤日志粘贴
    if (!LOG_PREFIX.test(text.trimStart())) {
      for (const pat of INTERESTING_PATTERNS) {
        if (pat.test(text)) {
          interestingCandidates.push({ date, text: trimmed, project, reason: '包含特殊表达' })
          break
        }
      }
    }
  }

  return {
    learningMoments: selectWithRateLimit(learningCandidates),
    frustrationMoments: selectWithRateLimit(frustrationCandidates),
    interestingPrompts: selectWithRateLimit(interestingCandidates),
  }
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
  const longestStreak = computeLongestStreak(raw)
  const longestConversation = computeLongestConversation(raw)
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
    longestStreak,
    longestConversation,
    ...lateNight,
    ...interesting,
  }
}
