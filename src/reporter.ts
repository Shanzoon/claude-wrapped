import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import type { WrappedData } from './types.js'
import { buildPrompt } from './prompt.js'

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/** 根据用户真实数据生成个性化等待消息 */
function buildWaitingMessages(data: WrappedData): string[] {
  const msgs: string[] = []

  // 基于极端值
  if (data.latestNight.timestamp) {
    const time = new Date(data.latestNight.timestamp)
    const h = time.getHours().toString().padStart(2, '0')
    const m = time.getMinutes().toString().padStart(2, '0')
    msgs.push(`正在回忆你凌晨 ${h}:${m} 还在写代码的那个夜晚...`)
  }

  if (data.busiestDay.count > 0) {
    msgs.push(`正在复盘你最疯狂的一天——${data.busiestDay.date}，${data.busiestDay.count} 条 prompt...`)
  }

  // 基于项目
  const top = data.topProjects[0]
  if (top) {
    msgs.push(`正在翻阅你在 ${top.name} 上的 ${top.count} 次对话...`)
  }
  if (data.topProjects.length >= 3) {
    const p3 = data.topProjects[2]
    msgs.push(`顺便看了眼你的 ${p3.name} 项目...`)
  }

  // 基于时间节奏
  const weekdays = Object.entries(data.weekdayDistribution).sort((a, b) => b[1] - a[1])
  if (weekdays.length > 0) {
    msgs.push(`正在研究你为什么${weekdays[0][0]}特别能肝...`)
  }

  const peakHour = Object.entries(data.hourDistribution)
    .sort((a, b) => b[1] - a[1])[0]
  if (peakHour) {
    msgs.push(`发现你 ${peakHour[0]} 点最活跃，正在分析原因...`)
  }

  // 基于总量
  msgs.push(`正在消化你的 ${(data.totalTokens / 1e9).toFixed(1)}B tokens 使用记录...`)
  msgs.push(`正在分析 ${data.totalConversations} 场对话中的行为模式...`)

  // 基于深夜
  if (data.lateNightDays > 5) {
    msgs.push(`你有 ${data.lateNightDays} 个通宵夜晚，正在寻找规律...`)
  }

  // 基于性格相关
  msgs.push('正在推断你的性格画像...')
  msgs.push('正在撰写成长轨迹...')

  // 基于第一次
  if (data.firstPrompt.text) {
    const preview = data.firstPrompt.text.slice(0, 20)
    msgs.push(`还记得你的第一条消息吗——「${preview}」...`)
  }

  // 基于 prompt 演变
  const months = Object.keys(data.monthlyPromptLength).sort()
  if (months.length >= 2) {
    const first = data.monthlyPromptLength[months[0]]
    const last = data.monthlyPromptLength[months[months.length - 1]]
    if (last < first) {
      msgs.push(`你的 prompt 从平均 ${first} 字缩短到 ${last} 字，正在分析为什么...`)
    }
  }

  // 通用收尾
  msgs.push('快写完了，正在润色措辞...')
  msgs.push('最后再检查一遍数据...')

  return msgs
}

export async function generateReport(data: WrappedData): Promise<string> {
  const prompt = buildPrompt(data)
  const tmpFile = '/tmp/claude-wrapped-prompt.txt'
  writeFileSync(tmpFile, prompt, 'utf-8')

  const messages = buildWaitingMessages(data)
  let tick = 0

  // 单一 timer：spinner 每 80ms 转一帧，消息每 30 帧（~2.4s）切换
  const timer = setInterval(() => {
    const spinner = SPINNER[tick % SPINNER.length]
    const msgIndex = Math.floor(tick / 30) % messages.length
    const msg = messages[msgIndex]
    const sec = Math.floor(tick * 80 / 1000)
    process.stdout.write(`\r  ${spinner} ${msg}  (${sec}s)   `)
    tick++
  }, 80)

  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn('sh', ['-c', `cat "${tmpFile}" | claude -p --max-turns 3`], {
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

    clearInterval(timer)
    process.stdout.write('\r' + ' '.repeat(80) + '\r')

    const reportPath = './claude-wrapped-report.md'
    writeFileSync(reportPath, output, 'utf-8')
    return reportPath
  } catch (err) {
    clearInterval(timer)
    process.stdout.write('\r' + ' '.repeat(80) + '\r')
    throw err
  }
}
