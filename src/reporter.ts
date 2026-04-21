import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import type { WrappedData, CallAOutput, CallBOutput, ReportJSON } from './types.js'
import { buildPromptA, buildPromptB } from './prompt.js'
import { buildAllData } from './tables.js'
import { renderMarkdownView } from './markdown.js'

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/** 根据用户真实数据生成个性化等待消息 */
function buildWaitingMessages(data: WrappedData): string[] {
  const msgs: string[] = []

  if (data.latestNight.timestamp) {
    msgs.push(`正在回忆你凌晨还在写代码的那个夜晚...`)
  }

  if (data.busiestDay.count > 0) {
    msgs.push(`正在复盘你最疯狂的一天——${data.busiestDay.date}，${data.busiestDay.count} 条 prompt...`)
  }

  const top = data.topProjects[0]
  if (top) {
    msgs.push(`正在翻阅你在 ${top.name} 上的 ${top.count} 次对话...`)
  }

  const weekdays = Object.entries(data.weekdayDistribution).sort((a, b) => b[1] - a[1])
  if (weekdays.length > 0) {
    msgs.push(`正在研究你为什么${weekdays[0][0]}特别能肝...`)
  }

  msgs.push(`正在消化你的 ${(data.totalTokens / 1e9).toFixed(1)}B tokens 使用记录...`)
  msgs.push(`正在分析 ${data.totalConversations} 场对话中的行为模式...`)

  if (data.longestStreak.days > 1) {
    msgs.push(`你曾连续 ${data.longestStreak.days} 天和 Claude 对话...`)
  }

  if (data.longestConversation.rounds > 10) {
    msgs.push(`正在回顾你在 ${data.longestConversation.project} 里那场 ${data.longestConversation.rounds} 轮的马拉松对话...`)
  }

  const monthlyArr = data.monthly
  if (monthlyArr.length >= 2) {
    const firstTpp = monthlyArr[0].tokensPerPrompt
    const lastTpp = monthlyArr[monthlyArr.length - 1].tokensPerPrompt
    if (lastTpp > firstTpp * 3) {
      msgs.push(`你的单次对话复杂度翻了 ${Math.round(lastTpp / firstTpp)} 倍，正在分析为什么...`)
    }
  }

  msgs.push('正在推断你的性格画像...')
  msgs.push('正在撰写成长轨迹...')

  if (data.firstPrompt.text) {
    const preview = data.firstPrompt.text.slice(0, 20)
    msgs.push(`还记得你的第一条消息吗——「${preview}」...`)
  }

  msgs.push('两路分析并行中，快了...')
  msgs.push('最后再检查一遍数据...')

  return msgs
}

/** 调用 claude -p 并返回原始输出 */
function callClaude(promptFile: string, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', `cat "${promptFile}" | claude -p --model ${model} --max-turns 3`], {
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    const chunks: string[] = []
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString()))
    child.stderr.on('data', () => {})

    child.on('close', (code) => {
      if (code === 0) {
        resolve(chunks.join(''))
      } else {
        reject(new Error(`claude -p 退出码: ${code}`))
      }
    })
    child.on('error', reject)
  })
}

/** 修复 Claude JSON 输出中字符串值内的未转义双引号 */
function fixJsonQuotes(raw: string): string {
  const lines = raw.split('\n')
  const fixed: string[] = []

  for (const line of lines) {
    const kvMatch = line.match(/^(\s*"[^"]*":\s*")(.*)(",?\s*)$/)
    const arrMatch = !kvMatch && line.match(/^(\s*")(.*)(",?\s*)$/)
    const match = kvMatch || arrMatch

    if (match) {
      const [, prefix, content, suffix] = match
      const fixedContent = content.replace(/(?<!\\)"/g, '\\"')
      fixed.push(prefix + fixedContent + suffix)
    } else {
      fixed.push(line)
    }
  }

  return fixed.join('\n')
}

/** 从 Claude 输出中提取 JSON（处理代码块包裹和引号问题） */
function extractJSON<T>(raw: string): T {
  let cleaned = raw.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    const fixed = fixJsonQuotes(cleaned)
    return JSON.parse(fixed)
  }
}

/** 将 callA/callB 中间结果 + 结构化数据 reshape 为目标分层 JSON */
function reshapeReport(callA: CallAOutput, callB: CallBOutput, data: WrappedData): ReportJSON {
  const dataLayer = buildAllData(data)

  return {
    share: {
      headline: callB.headline,
      opener: callB.opener,
      growthSummaries: callA.growth.map(g => g.summary),
      personalityTags: callA.personality.map(p => p.label),
      projectSummary: callA.projects.summary,
      rhythmSummary: callB.rhythm.summary,
      firstMeetingSummary: callB.firstMeeting.summary,
      secretTitles: callB.secrets.map(s => s.title),
      closing: callB.closing,
    },

    story: {
      firstMeeting: callB.firstMeeting,
      growth: callA.growth,
      personality: callA.personality,
      rhythm: callB.rhythm,
      projects: callA.projects,
      secrets: callB.secrets,
      closing: callB.closing,
    },

    data: dataLayer,

    privacy: {
      containsProjectNames: true,
      sensitiveFields: [
        'story.firstMeeting.detail',
        'story.growth[].detail',
        'story.growth[].keyQuotes',
        'story.personality[].evidence',
        'story.rhythm.detail',
        'story.projects.detail',
        'story.secrets[].body',
        'data.raw',
      ],
    },
  }
}

export async function generateReport(data: WrappedData, model: string = 'sonnet'): Promise<{ reportPath: string; reportJSON: ReportJSON }> {
  // 准备两份 prompt 文件
  const tmpA = '/tmp/claude-wrapped-prompt-a.txt'
  const tmpB = '/tmp/claude-wrapped-prompt-b.txt'
  writeFileSync(tmpA, buildPromptA(data), 'utf-8')
  writeFileSync(tmpB, buildPromptB(data), 'utf-8')

  // 等待消息 + spinner
  const messages = buildWaitingMessages(data)
  let tick = 0
  const timer = setInterval(() => {
    const spinner = SPINNER[tick % SPINNER.length]
    const msgIndex = Math.floor(tick / 30) % messages.length
    const msg = messages[msgIndex]
    const sec = Math.floor(tick * 80 / 1000)
    process.stdout.write(`\r  ${spinner} ${msg}  (${sec}s)   `)
    tick++
  }, 80)

  try {
    // 并行调用两路 Claude
    const [rawA, rawB] = await Promise.all([
      callClaude(tmpA, model),
      callClaude(tmpB, model),
    ])

    clearInterval(timer)
    process.stdout.write('\r' + ' '.repeat(80) + '\r')

    // 解析中间 JSON
    const callA = extractJSON<CallAOutput>(rawA)
    const callB = extractJSON<CallBOutput>(rawB)

    // reshape 为目标分层结构
    const reportJSON = reshapeReport(callA, callB, data)

    // 输出 report.json
    const jsonPath = './claude-wrapped-report.json'
    writeFileSync(jsonPath, JSON.stringify(reportJSON, null, 2), 'utf-8')

    // 输出 report.md（JSON 的阅读视图）
    const markdown = renderMarkdownView(reportJSON)
    const reportPath = './claude-wrapped-report.md'
    writeFileSync(reportPath, markdown, 'utf-8')

    return { reportPath, reportJSON }
  } catch (err) {
    clearInterval(timer)
    process.stdout.write('\r' + ' '.repeat(80) + '\r')
    throw err
  }
}
