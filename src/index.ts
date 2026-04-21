#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { collect } from './collector.js'
import { analyze } from './analyzer.js'
import { generateReport } from './reporter.js'
import { generateCard } from './card.js'

async function chooseModel(): Promise<string> {
  console.log('🎬 Claude Wrapped\n')
  console.log('选择生成报告的模型:\n')
  console.log('  1) sonnet — 速度快，性价比高（推荐）')
  console.log('  2) opus   — 分析更深度，费用较高\n')

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  return new Promise((resolve) => {
    rl.question('请输入 1 或 2（默认 1）: ', (answer) => {
      rl.close()
      const choice = answer.trim()
      if (choice === '2' || choice.toLowerCase() === 'opus') {
        resolve('opus')
      } else {
        resolve('sonnet')
      }
    })
  })
}

async function main() {
  const model = await chooseModel()

  console.log(`\n— 使用模型: ${model} —\n`)

  console.log('📊 正在扫描数据...')
  const rawData = await collect()

  console.log('🔍 正在分析...')
  const analysis = analyze(rawData)

  console.log('✍️  正在生成报告（调用 Claude）...')
  const report = await generateReport(analysis, model)

  console.log('🖼️  正在生成一图流...')
  await generateCard(analysis)

  console.log('\n✅ 完成！')
  console.log(`   报告: ${report}`)
  console.log(`   一图流: ./claude-wrapped-card.png`)
}

main().catch(console.error)
