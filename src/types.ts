// 从 history.jsonl 解析的单条 prompt 记录
export interface PromptEntry {
  display: string
  timestamp: number
  project: string
  sessionId: string
}

// 从对话 JSONL 中提取的 API 调用记录
export interface ApiCallEntry {
  model: string
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens: number
    cache_creation_input_tokens: number
  }
  timestamp: number
  sessionFile: string
}

// collector 输出的原始数据
export interface RawData {
  prompts: PromptEntry[]
  apiCalls: ApiCallEntry[]
  username: string
}

// 月度统计
export interface MonthlyStats {
  month: string // YYYY-MM
  prompts: number
  tokens: number
  tokensPerPrompt: number
  apiCalls: number
  activeDays: number
}

// 模型 token 使用
export interface ModelTokens {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalTokens: number
  callCount: number
}

// analyzer 输出的完整分析数据
export interface WrappedData {
  // 基础信息
  username: string
  firstDate: string
  lastDate: string
  totalDays: number
  activeDays: number

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
  hourDistribution: Record<number, number>
  weekdayDistribution: Record<string, number>

  // 项目分布
  topProjects: { name: string; count: number }[]
  monthlyProjects: Record<string, { name: string; count: number }[]>

  // 语言
  chineseRatio: number
  englishRatio: number

  // Prompt 演变
  monthlyPromptLength: Record<string, number>

  // 关键词
  topKeywords: { word: string; count: number }[]

  // 极端值
  busiestDay: { date: string; count: number; topProject: string }
  latestNight: { timestamp: string; prompt: string; project: string }
  longestPrompt: { text: string; length: number; date: string }

  // 第一次
  firstPrompt: { text: string; date: string; project: string }
  firstTask: { text: string; date: string; project: string }
  firstProject: string

  // 连续活跃天数
  longestStreak: { days: number; startDate: string; endDate: string }

  // 最长单次对话
  longestConversation: { rounds: number; project: string; startHour: number; endHour: number; startDate: string; endDate: string }

  // 深夜统计
  lateNightCount: number
  lateNightDays: number

  // 有趣的 prompt 摘录
  interestingPrompts: { date: string; text: string; project: string; reason: string }[]

  // 学习时刻
  learningMoments: { date: string; text: string }[]

  // 挫折时刻
  frustrationMoments: { date: string; text: string }[]
}

// ── Claude 结构化输出 ──

// Call A: 分析型（成长轨迹、性格画像、项目叙事）
export interface CallAOutput {
  growth: {
    month: string
    summary: string   // 可分享：不含项目名和原文
    detail: string    // 私密：含原文引用和项目细节
    keyQuotes: string[]
  }[]
  personality: {
    label: string     // 可分享：性格标签
    evidence: string  // 私密：含原文引用
  }[]
  projects: {
    summary: string   // 可分享：项目方向概括
    detail: string    // 私密：含项目名和细节
  }
}

// Call B: 叙事型（开场、初见、节奏、细节、结尾）
export interface CallBOutput {
  headline: string    // 可分享：一句冲击力的话，不含项目名
  opener: string      // 可分享：开场白正文
  firstMeeting: {
    summary: string   // 可分享：概括性描述
    detail: string    // 私密：含原文引用
  }
  rhythm: {
    summary: string   // 可分享：作息概括
    detail: string    // 私密：具体时段描述
  }
  secrets: {
    title: string     // 可分享：有戳点但不暴露细节
    body: string      // 私密：含项目名和原文
  }[]
  closing: string     // 可分享：不含项目名
}

// ── 结构化数据表格 ──

export interface OverviewStats {
  totalDays: number
  dateRange: string           // "2026-01-04 ~ 2026-04-21"
  activeDays: number
  attendanceRate: number      // 0-1
  totalPrompts: number
  totalConversations: number
  totalTokens: number
  totalApiCalls: number
  longestStreak: { days: number; range: string }
  longestConversation: { rounds: number; project: string }
  lateNight: { days: number; count: number }
  chineseRatio: number
}

export interface HourSlot {
  label: string
  hours: number[]
  total: number
  peakHour: number
}

export interface WeekdayStat {
  day: string
  count: number
}

// ── 按展示目标分层的总报告 JSON ──

export interface ReportJSON {
  /** 可公开分享的内容：适合截图、社交卡片 */
  share: {
    headline: string            // 一句冲击力开场
    opener: string              // 开场白正文
    growthSummaries: string[]   // 每月一句概括（无项目名）
    personalityTags: string[]   // 性格标签（无项目名）
    projectSummary: string      // 项目方向概括（无项目名）
    rhythmSummary: string       // 作息概括
    firstMeetingSummary: string // 初见概括
    secretTitles: string[]      // 细节标题（有戳点但不暴露）
    closing: string             // 结尾
  }

  /** 完整叙事：含项目名、原文引用，私密阅读用 */
  story: {
    firstMeeting: { summary: string; detail: string }
    growth: {
      month: string
      summary: string
      detail: string
      keyQuotes: string[]
    }[]
    personality: { label: string; evidence: string }[]
    rhythm: { summary: string; detail: string }
    projects: { summary: string; detail: string }
    secrets: { title: string; body: string }[]
    closing: string
  }

  /** 结构化数据表格 */
  data: {
    overview: OverviewStats
    monthly: MonthlyStats[]
    hourSlots: HourSlot[]
    weekdays: WeekdayStat[]
    raw: WrappedData
  }

  /** 隐私元数据 */
  privacy: {
    containsProjectNames: boolean
    sensitiveFields: string[]
  }
}
