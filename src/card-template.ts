import type { WrappedData } from './types.js'

// satori 使用 React.createElement 兼容的对象格式
type SatoriNode = {
  type: string
  props: Record<string, unknown> & { children?: (SatoriNode | string)[] | string }
}

function h(type: string, props: Record<string, unknown>, ...children: (SatoriNode | string | (SatoriNode | string)[])[]): SatoriNode {
  const flat = children.flat().filter(c => c !== null && c !== undefined)
  if (flat.length === 0) return { type, props: { ...props, style: { display: 'flex', ...(props.style as Record<string, unknown> ?? {}) } } }
  if (flat.length === 1 && typeof flat[0] === 'string') return { type, props: { ...props, children: flat[0] } }
  return { type, props: { ...props, children: flat as (SatoriNode | string)[] } }
}

// ── 颜色主题 ──
const BG = '#0f0f17'
const BG_CARD = '#1a1a2e'
const ACCENT = '#c084fc'    // 紫色
const ACCENT2 = '#60a5fa'   // 蓝色
const TEXT = '#e2e8f0'
const TEXT_DIM = '#94a3b8'
const TEXT_BRIGHT = '#ffffff'

// ── 辅助函数 ──

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toString()
}

function getPersonalityTags(data: WrappedData): string[] {
  const tags: string[] = []

  // 基于深夜数据
  if (data.lateNightCount > 100) tags.push('夜行动物')
  else if (data.lateNightCount > 30) tags.push('偶尔熬夜')

  // 基于活跃天数比例
  const ratio = data.activeDays / data.totalDays
  if (ratio > 0.8) tags.push('全勤战士')
  else if (ratio > 0.6) tags.push('持续产出')

  // 基于 prompt 长度演变
  const months = Object.keys(data.monthlyPromptLength).sort()
  if (months.length >= 2) {
    const first = data.monthlyPromptLength[months[0]]
    const last = data.monthlyPromptLength[months[months.length - 1]]
    if (last < first * 0.7) tags.push('越来越精炼')
  }

  // 基于语言
  if (data.chineseRatio > 0.9) tags.push('中文母语者')

  // 基于 prompt 量
  if (data.totalPrompts > 3000) tags.push('重度用户')
  else if (data.totalPrompts > 1000) tags.push('活跃用户')

  // 基于项目数
  if (data.topProjects.length >= 10) tags.push('多线程选手')

  // 基于关键词
  const kwSet = new Set(data.topKeywords.map(k => k.word))
  if (kwSet.has('test')) tags.push('重视测试')
  if (kwSet.has('bug') || kwSet.has('fix')) tags.push('Bug Hunter')

  return tags.slice(0, 5)
}

/** 生成小时分布热力条 */
function getHourHeatmap(data: WrappedData): { hour: number; ratio: number }[] {
  const dist = data.hourDistribution
  const max = Math.max(...Object.values(dist), 1)
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    ratio: (dist[i] ?? 0) / max,
  }))
}

function heatColor(ratio: number): string {
  if (ratio === 0) return '#1e1e3a'
  if (ratio < 0.2) return '#2d1b69'
  if (ratio < 0.4) return '#5b21b6'
  if (ratio < 0.6) return '#7c3aed'
  if (ratio < 0.8) return '#a78bfa'
  return '#c4b5fd'
}

// ── 卡片构建 ──

export function buildCard(data: WrappedData): SatoriNode {
  const tags = getPersonalityTags(data)
  const heatmap = getHourHeatmap(data)

  // 成长标签
  const firstProj = data.firstProject || '未知'
  const latestProj = data.topProjects[0]?.name || '未知'
  const growthLabel = `从「${firstProj}」到「${latestProj}」`

  // Top 3 项目
  const top3 = data.topProjects.slice(0, 3)

  // 月度 token 趋势
  const monthlyTokens = data.monthly.map(m => ({
    month: m.month.slice(5), // MM
    tokens: m.tokens,
  }))
  const maxMonthToken = Math.max(...monthlyTokens.map(m => m.tokens), 1)

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '1080px',
      height: '1920px',
      background: `linear-gradient(180deg, ${BG} 0%, #16132b 50%, ${BG} 100%)`,
      padding: '60px',
      fontFamily: 'Noto Sans SC',
      color: TEXT,
    },
  },
    // ── 头部 ──
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' } },
      h('div', { style: { fontSize: '28px', color: TEXT_DIM, letterSpacing: '8px', marginBottom: '12px' } }, 'CLAUDE WRAPPED'),
      h('div', { style: { fontSize: '52px', fontWeight: 700, color: TEXT_BRIGHT } }, data.username),
      h('div', { style: { fontSize: '22px', color: TEXT_DIM, marginTop: '8px' } },
        `${data.firstDate} — ${data.lastDate}`),
    ),

    // ── 成长标签 ──
    h('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: '40px' } },
      h('div', {
        style: {
          background: 'linear-gradient(90deg, #5b21b6, #2563eb)',
          padding: '12px 32px',
          borderRadius: '24px',
          fontSize: '24px',
          color: TEXT_BRIGHT,
        },
      }, growthLabel),
    ),

    // ── 核心数据 ──
    h('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '40px',
      },
    },
      ...[
        { label: 'Prompts', value: formatNumber(data.totalPrompts) },
        { label: 'Tokens', value: formatNumber(data.totalTokens) },
        { label: '活跃天数', value: `${data.activeDays}` },
        { label: '对话', value: `${data.totalConversations}` },
      ].map(item =>
        h('div', {
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: BG_CARD,
            borderRadius: '20px',
            padding: '28px 20px',
            width: '220px',
          },
        },
          h('div', { style: { fontSize: '44px', fontWeight: 700, color: ACCENT } }, item.value),
          h('div', { style: { fontSize: '20px', color: TEXT_DIM, marginTop: '8px' } }, item.label),
        )
      ),
    ),

    // ── Top 项目 ──
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        background: BG_CARD,
        borderRadius: '20px',
        padding: '28px 32px',
        marginBottom: '32px',
      },
    },
      h('div', { style: { fontSize: '20px', color: TEXT_DIM, marginBottom: '16px' } }, 'TOP 项目'),
      ...top3.map((p, i) =>
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            marginBottom: i < 2 ? '12px' : '0px',
          },
        },
          h('div', {
            style: {
              width: '32px', height: '32px', borderRadius: '50%',
              background: i === 0 ? ACCENT : i === 1 ? ACCENT2 : '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', fontWeight: 700, color: TEXT_BRIGHT, marginRight: '16px',
            },
          }, `${i + 1}`),
          h('div', { style: { fontSize: '26px', color: TEXT_BRIGHT, flex: '1' } }, p.name),
          h('div', { style: { fontSize: '22px', color: TEXT_DIM } }, `${p.count} prompts`),
        )
      ),
    ),

    // ── 月度趋势 ──
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        background: BG_CARD,
        borderRadius: '20px',
        padding: '28px 32px',
        marginBottom: '32px',
      },
    },
      h('div', { style: { fontSize: '20px', color: TEXT_DIM, marginBottom: '20px' } }, 'TOKEN 消耗趋势'),
      h('div', { style: { display: 'flex', alignItems: 'flex-end', height: '100px', gap: '16px' } },
        ...monthlyTokens.map(m =>
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1' } },
            h('div', { style: { fontSize: '16px', color: ACCENT, marginBottom: '8px' } }, formatNumber(m.tokens)),
            h('div', {
              style: {
                width: '100%',
                height: `${Math.max(10, (m.tokens / maxMonthToken) * 80)}px`,
                background: `linear-gradient(180deg, ${ACCENT}, #5b21b6)`,
                borderRadius: '8px 8px 0 0',
              },
            }),
            h('div', { style: { fontSize: '16px', color: TEXT_DIM, marginTop: '8px' } }, `${m.month}月`),
          )
        ),
      ),
    ),

    // ── 24 小时热力图 ──
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        background: BG_CARD,
        borderRadius: '20px',
        padding: '28px 32px',
        marginBottom: '32px',
      },
    },
      h('div', { style: { fontSize: '20px', color: TEXT_DIM, marginBottom: '16px' } }, '24 小时活跃热力'),
      h('div', { style: { display: 'flex', gap: '4px' } },
        ...heatmap.map(cell =>
          h('div', {
            style: {
              flex: '1',
              height: '40px',
              background: heatColor(cell.ratio),
              borderRadius: '4px',
            },
          }),
        ),
      ),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '8px' } },
        h('div', { style: { fontSize: '14px', color: TEXT_DIM } }, '0时'),
        h('div', { style: { fontSize: '14px', color: TEXT_DIM } }, '6时'),
        h('div', { style: { fontSize: '14px', color: TEXT_DIM } }, '12时'),
        h('div', { style: { fontSize: '14px', color: TEXT_DIM } }, '18时'),
        h('div', { style: { fontSize: '14px', color: TEXT_DIM } }, '23时'),
      ),
    ),

    // ── 人格标签 ──
    h('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '40px',
      },
    },
      ...tags.map(tag =>
        h('div', {
          style: {
            padding: '10px 24px',
            borderRadius: '20px',
            border: `1px solid ${ACCENT}`,
            fontSize: '22px',
            color: ACCENT,
          },
        }, `#${tag}`),
      ),
    ),

    // ── 底部 ──
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto' } },
      h('div', { style: { fontSize: '20px', color: TEXT_DIM, marginBottom: '8px' } }, 'npx claude-wrapped'),
      h('div', { style: { fontSize: '16px', color: '#475569' } }, `Generated on ${new Date().toISOString().slice(0, 10)}`),
    ),
  )
}
