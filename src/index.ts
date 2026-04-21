#!/usr/bin/env node
import { collect } from './collector.js'
import { analyze } from './analyzer.js'
import { generateReport } from './reporter.js'
import { generateCard } from './card.js'

function parseArgs(): { model: string } {
  const args = process.argv.slice(2)
  let model = 'sonnet' // 默认 sonnet，省钱

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      const val = args[i + 1].toLowerCase()
      if (val === 'opus' || val === 'sonnet') {
        model = val
      } else {
        console.error(`❌ 不支持的模型: ${args[i + 1]}，可选: opus, sonnet`)
        process.exit(1)
      }
      i++
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Claude Wrapped — 生成你的 Claude Code 个人使用报告

用法:
  npx @shanzoon/claude-wrapped [选项]

选项:
  --model <opus|sonnet>  选择生成报告的模型（默认: sonnet）
                         opus  - 更深度的分析，费用较高
                         sonnet - 性价比之选，推荐大多数用户
  -h, --help             显示帮助信息
`)
      process.exit(0)
    }
  }

  return { model }
}

async function main() {
  const { model } = parseArgs()

  console.log(`🎬 Claude Wrapped — 生成中...（模型: ${model}）\n`)

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
