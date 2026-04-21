#!/usr/bin/env node
import { collect } from './collector.js'
import { analyze } from './analyzer.js'
import { generateReport } from './reporter.js'
import { generateCard } from './card.js'

async function main() {
  console.log('🎬 Claude Wrapped — 生成中...\n')

  console.log('📊 正在扫描数据...')
  const rawData = await collect()

  console.log('🔍 正在分析...')
  const analysis = analyze(rawData)

  console.log('✍️  正在生成报告（调用 Claude）...')
  const report = await generateReport(analysis)

  console.log('🖼️  正在生成一图流...')
  await generateCard(analysis)

  console.log('\n✅ 完成！')
  console.log(`   报告: ${report}`)
  console.log(`   一图流: ./claude-wrapped-card.png`)
}

main().catch(console.error)
