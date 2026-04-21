import type { WrappedData } from './types.js'

/** 截断数据中的长文本字段，控制 prompt 总体积 */
function trimData(data: WrappedData): WrappedData {
  const trimmed = { ...data }

  // 截断 prompt 原文
  trimmed.interestingPrompts = data.interestingPrompts.map(p => ({
    ...p,
    text: p.text.slice(0, 80),
  }))
  trimmed.learningMoments = data.learningMoments.map(m => ({
    ...m,
    text: m.text.slice(0, 80),
  }))
  trimmed.frustrationMoments = data.frustrationMoments.map(m => ({
    ...m,
    text: m.text.slice(0, 80),
  }))
  trimmed.longestPrompt = {
    ...data.longestPrompt,
    text: data.longestPrompt.text.slice(0, 80),
  }
  trimmed.latestNight = {
    ...data.latestNight,
    prompt: data.latestNight.prompt.slice(0, 80),
  }

  return trimmed
}

export function buildPrompt(data: WrappedData): string {
  const d = trimData(data)
  const json = JSON.stringify(d, null, 2)

  // 如果仍超过 100K，进一步精简月度项目数据
  let finalJson = json
  if (json.length > 100_000) {
    const slimmed = { ...d, monthlyProjects: undefined }
    finalJson = JSON.stringify(slimmed, null, 2)
  }

  return `你是一个数据分析师，擅长从用户行为数据中洞察人物性格和成长轨迹。

以下是一位 Claude Code 用户「${d.username}」的完整使用数据统计。请基于这些数据，以第三人称视角撰写一份深度个人画像报告《Claude 眼中的 ${d.username}》。

## 要求
- 以第三人称叙述，视角是 Claude 观察这位用户
- 所有结论必须有数据支撑，引用具体 prompt 原文作为证据
- 不要泛泛而谈，要有细致入微的观察
- 语气温暖但不油腻，像一个相识已久的老友在描述你
- 输出纯 Markdown 格式
- 包含以下章节：
  1. **他/她是谁**（基于项目和 prompt 内容推断职业和身份）
  2. **数据全貌**（使用表格展示关键数字）
  3. **成长轨迹**（按月份分阶段，每阶段引用关键 prompt 和项目变化）
  4. **性格画像**（从数据中推导性格特征，每个特征给证据）
  5. **工作节奏指纹**（时段和星期分布可视化描述，发现规律）
  6. **一些细节**（有趣的、意想不到的发现，比如深夜习惯、语言偏好等）
  7. **总结**（一段有温度的概括，不超过 200 字）

## 用户数据

${finalJson}
`
}
