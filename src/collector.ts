import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { join, basename } from 'node:path'
import type { PromptEntry, ApiCallEntry, RawData } from './types.js'

const CLAUDE_DIR = join(homedir(), '.claude')

/** 解析 history.jsonl，提取用户 prompt 记录 */
async function parseHistory(): Promise<PromptEntry[]> {
  const historyPath = join(CLAUDE_DIR, 'history.jsonl')
  const prompts: PromptEntry[] = []

  const rl = createInterface({
    input: createReadStream(historyPath, 'utf-8'),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line)
      const display: string = entry.display ?? ''
      // 过滤 / 开头的命令（如 /model, /help 等）
      if (display.startsWith('/')) continue
      prompts.push({
        display,
        timestamp: entry.timestamp,
        project: entry.project ?? '',
        sessionId: entry.sessionId ?? '',
      })
    } catch {
      // 跳过解析失败的行
    }
  }

  return prompts
}

/** 递归收集目录下所有 .jsonl 文件路径 */
async function findJsonlFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(d: string) {
    const entries = await readdir(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(d, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.name.endsWith('.jsonl')) {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files
}

/** 流式扫描对话 JSONL，提取 assistant 消息的 model/usage/timestamp */
async function scanConversations(): Promise<ApiCallEntry[]> {
  const projectsDir = join(CLAUDE_DIR, 'projects')
  const jsonlFiles = await findJsonlFiles(projectsDir)
  const apiCalls: ApiCallEntry[] = []

  let processed = 0
  const total = jsonlFiles.length

  for (const file of jsonlFiles) {
    processed++
    if (processed % 100 === 0) {
      process.stdout.write(`\r  扫描对话文件: ${processed}/${total}`)
    }

    const rl = createInterface({
      input: createReadStream(file, 'utf-8'),
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        if (entry.type !== 'assistant') continue

        const msg = entry.message
        if (!msg?.usage) continue

        const usage = msg.usage
        // timestamp 可能是 ISO 字符串或数字
        const ts = typeof entry.timestamp === 'string'
          ? new Date(entry.timestamp).getTime()
          : entry.timestamp

        apiCalls.push({
          model: msg.model ?? 'unknown',
          usage: {
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
          },
          timestamp: ts,
          sessionFile: basename(file, '.jsonl'),
        })
      } catch {
        // 跳过解析失败的行
      }
    }
  }

  if (total >= 100) {
    process.stdout.write('\r' + ' '.repeat(50) + '\r')
  }

  return apiCalls
}

/** 从系统用户目录提取用户名 */
function getUsername(): string {
  return basename(homedir())
}

/** 主入口：采集所有数据并返回 RawData */
export async function collect(): Promise<RawData> {
  const [prompts, apiCalls] = await Promise.all([
    parseHistory(),
    scanConversations(),
  ])

  return {
    prompts,
    apiCalls,
    username: getUsername(),
  }
}
