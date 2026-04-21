import type { ReportJSON } from './types.js'

/** 格式化数字（千分位） */
function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/** 格式化 token 量（自动选择 M/B 单位） */
function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  return fmt(n)
}

/** 将 ReportJSON 渲染为人类可读的 Markdown（JSON 的阅读视图） */
export function renderMarkdownView(report: ReportJSON): string {
  const { share, story, data } = report
  const sections: string[] = []

  // 1. 开场
  sections.push(`# ${share.headline}\n`)
  sections.push(share.opener)

  // 2. 初见
  sections.push(`\n---\n\n## 初见\n`)
  sections.push(story.firstMeeting.detail)

  // 3. 数据全貌（从结构化数据渲染）
  const ov = data.overview
  sections.push(`\n---\n\n## 数据全貌\n`)
  sections.push(`| 指标 | 数值 |`)
  sections.push(`|------|------|`)
  sections.push(`| 使用时间 | ${ov.totalDays} 天（${ov.dateRange}）|`)
  sections.push(`| 活跃天数 | ${ov.activeDays} 天（出勤率 ${(ov.attendanceRate * 100).toFixed(1)}%）|`)
  sections.push(`| 总对话轮数 | ${fmt(ov.totalPrompts)} 次 |`)
  sections.push(`| 总会话数 | ${fmt(ov.totalConversations)} 个 |`)
  sections.push(`| 总 Token | ${fmtTokens(ov.totalTokens)} |`)
  sections.push(`| 总 API 调用 | ${fmt(ov.totalApiCalls)} 次 |`)
  sections.push(`| 最长连续活跃 | ${ov.longestStreak.days} 天（${ov.longestStreak.range}）|`)
  sections.push(`| 最长单次对话 | ${ov.longestConversation.rounds} 轮（${ov.longestConversation.project}）|`)
  sections.push(`| 深夜编程 | ${ov.lateNight.days} 天，共 ${ov.lateNight.count} 次 |`)
  sections.push(`| 中文使用率 | ${(ov.chineseRatio * 100).toFixed(1)}% |`)

  // 4. 成长轨迹
  sections.push(`\n---\n\n## 成长轨迹\n`)
  for (const stage of story.growth) {
    sections.push(`### ${stage.month}\n`)
    sections.push(stage.detail)
    if (stage.keyQuotes.length > 0) {
      sections.push('\n' + stage.keyQuotes.map(q => `> 「${q}」`).join('\n\n'))
    }
    sections.push('')
  }

  // 5. 我眼中的你
  sections.push(`\n---\n\n## 我眼中的你\n`)
  for (const trait of story.personality) {
    sections.push(`### ${trait.label}\n`)
    sections.push(trait.evidence)
    sections.push('')
  }

  // 6. 工作节奏
  sections.push(`\n---\n\n## 工作节奏\n`)
  sections.push(story.rhythm.detail)

  // 7. 月度增长表格
  sections.push(`\n---\n\n## 月度增长\n`)
  sections.push(`| 月份 | Prompts | Tokens | Tokens/Prompt | 活跃天数 |`)
  sections.push(`|------|---------|--------|---------------|----------|`)
  for (const m of data.monthly) {
    sections.push(`| ${m.month} | ${fmt(m.prompts)} | ${fmtTokens(m.tokens)} | ${fmt(m.tokensPerPrompt)} | ${m.activeDays} |`)
  }

  // 8. 时段 & 星期分布表格
  sections.push(`\n## 时段分布\n`)
  sections.push(`| 时段 | Prompts | 峰值时刻 |`)
  sections.push(`|------|---------|----------|`)
  for (const slot of data.hourSlots) {
    sections.push(`| ${slot.label} | ${fmt(slot.total)} | ${slot.peakHour}:00 |`)
  }

  sections.push(`\n## 星期分布\n`)
  sections.push(`| 星期 | Prompts |`)
  sections.push(`|------|---------|`)
  for (const wd of data.weekdays) {
    sections.push(`| ${wd.day} | ${fmt(wd.count)} |`)
  }

  // 9. 那些项目
  sections.push(`\n---\n\n## 那些项目\n`)
  sections.push(story.projects.detail)

  // 10. 偷偷记住的细节
  sections.push(`\n---\n\n## 我偷偷记住的细节\n`)
  for (const secret of story.secrets) {
    sections.push(`**${secret.title}**\n`)
    sections.push(secret.body)
    sections.push('')
  }

  // 11. 结尾
  sections.push(`\n---\n\n## 结尾\n`)
  sections.push(story.closing)

  return sections.join('\n')
}
