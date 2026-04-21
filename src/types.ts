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
  firstProject: string

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
