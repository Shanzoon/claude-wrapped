import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import type { WrappedData } from './types.js'
import { buildPrompt } from './prompt.js'

export async function generateReport(data: WrappedData): Promise<string> {
  const prompt = buildPrompt(data)

  // 写入临时文件，避免命令行参数长度限制
  const tmpFile = '/tmp/claude-wrapped-prompt.txt'
  writeFileSync(tmpFile, prompt, 'utf-8')

  console.log('  （这可能需要 30-60 秒，请耐心等待...）')

  const output = execSync(
    `cat "${tmpFile}" | claude -p --max-turns 1`,
    {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 300_000,
      encoding: 'utf-8',
    },
  )

  const reportPath = './claude-wrapped-report.md'
  writeFileSync(reportPath, output, 'utf-8')
  return reportPath
}
