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

// ── 颜色主题（Claude 品牌色） ──
const BG = '#FAF6F1'          // 奶白色背景
const BG_CARD = '#EDE8E0'     // 浅暖灰卡片
const ACCENT = '#D97757'      // 赤陶橙
const ACCENT2 = '#C4613E'     // 深赤陶
const TEXT = '#1A1A1A'         // 主文字
const TEXT_DIM = '#8B7355'     // 暖棕辅助
const TEXT_BRIGHT = '#1A1A1A'  // 深色标题

// ── 辅助函数 ──

/** 带千分位的数字格式化（用于大字冲击） */
function formatWithCommas(n: number): string {
  return n.toLocaleString('en-US')
}

function getPersonalityTags(data: WrappedData): string[] {
  const tags: string[] = []

  if (data.lateNightCount > 100) tags.push('夜行动物')
  else if (data.lateNightCount > 30) tags.push('偶尔熬夜')

  const ratio = data.activeDays / data.totalDays
  if (ratio > 0.8) tags.push('全勤战士')
  else if (ratio > 0.6) tags.push('持续产出')

  const months = Object.keys(data.monthlyPromptLength).sort()
  if (months.length >= 2) {
    const first = data.monthlyPromptLength[months[0]]
    const last = data.monthlyPromptLength[months[months.length - 1]]
    if (last < first * 0.7) tags.push('越来越精炼')
  }

  if (data.chineseRatio > 0.9) tags.push('中文母语者')

  if (data.totalPrompts > 3000) tags.push('重度用户')
  else if (data.totalPrompts > 1000) tags.push('活跃用户')

  if (data.longestStreak.days >= 14) tags.push('连续作战')
  else if (data.longestStreak.days >= 7) tags.push('周连胜')

  if (data.topProjects.length >= 10) tags.push('多线程选手')

  const kwSet = new Set(data.topKeywords.map(k => k.word))
  if (kwSet.has('test')) tags.push('重视测试')
  if (kwSet.has('bug') || kwSet.has('fix')) tags.push('Bug Hunter')

  return tags.slice(0, 5)
}

/** 从 timestamp 提取时间 "HH:MM AM" */
function extractTime(ts: string): string {
  const d = new Date(ts)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

// ── 背景数据层 ──

/** 24h 时段分布 → 垂直条纹背景 */
function buildHourStripes(data: WrappedData): SatoriNode {
  const dist = data.hourDistribution
  const max = Math.max(...Object.values(dist), 1)
  const bars = Array.from({ length: 24 }, (_, i) => (dist[i] ?? 0) / max)

  return h('div', {
    style: {
      position: 'absolute',
      top: '0', left: '0', width: '1080px', height: '1920px',
      display: 'flex',
    },
  },
    ...bars.map(ratio =>
      h('div', {
        style: {
          flex: '1',
          height: '100%',
          background: ACCENT,
          opacity: ratio * 0.18, // 最深 18% 透明度
        },
      }),
    ),
  )
}

/** 星期分布 → 左边缘 7 个横条 */
function buildWeekdayBars(data: WrappedData): SatoriNode {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const values = days.map(d => data.weekdayDistribution[d] ?? 0)
  const max = Math.max(...values, 1)

  return h('div', {
    style: {
      position: 'absolute',
      top: '0', left: '0', width: '1080px', height: '1920px',
      display: 'flex',
      flexDirection: 'column',
    },
  },
    ...values.map(v =>
      h('div', {
        style: {
          flex: '1',
          width: `${Math.max(2, (v / max) * 100)}%`,
          background: ACCENT2,
          opacity: 0.1,
          borderRadius: '0 8px 8px 0',
        },
      }),
    ),
  )
}

// ── 卡片构建 ──

export function buildCard(data: WrappedData): SatoriNode {
  const tags = getPersonalityTags(data)
  const firstProj = data.firstProject || '未知'
  const latestProj = data.topProjects[0]?.name || '未知'

  const latestTime = extractTime(data.latestNight.timestamp)
  const busiestCount = data.busiestDay.count

  return h('div', {
    style: {
      display: 'flex',
      position: 'relative',
      width: '1080px',
      height: '1920px',
      background: BG,
      fontFamily: 'Noto Sans SC',
      color: TEXT,
    },
  },

    // ── 背景层：数据纹理 ──
    buildHourStripes(data),
    buildWeekdayBars(data),

    // ── 前景内容层 ──
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: '80px 72px',
      },
    },

      // ═══════════════════════════════════════
      // 第一层：情绪冲击（50%）
      // ═══════════════════════════════════════
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '1',
        },
      },
        h('div', { style: { fontSize: '32px', color: TEXT_DIM, marginBottom: '48px' } },
          `Claude 眼中的 ${data.username}`),

        h('div', { style: { fontSize: '128px', fontWeight: 700, color: TEXT_BRIGHT, lineHeight: '1' } },
          `${data.totalDays}`),
        h('div', { style: { fontSize: '40px', color: TEXT_DIM, marginTop: '16px', marginBottom: '56px' } },
          '天'),

        h('div', { style: { fontSize: '72px', fontWeight: 700, color: ACCENT, lineHeight: '1' } },
          formatWithCommas(data.totalPrompts)),
        h('div', { style: { fontSize: '36px', color: TEXT_DIM, marginTop: '16px' } },
          '次对话'),

        h('div', { style: { fontSize: '24px', color: TEXT_DIM, marginTop: '48px' } },
          `${data.firstDate} — ${data.lastDate}`),
      ),

      // ═══════════════════════════════════════
      // 第二层：个人叙事（30%）
      // ═══════════════════════════════════════
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '48px 0',
          borderTop: `1px solid ${BG_CARD}`,
          borderBottom: `1px solid ${BG_CARD}`,
        },
      },
        h('div', { style: { fontSize: '30px', color: TEXT, marginBottom: '48px' } },
          `从「${firstProj}」一路走到「${latestProj}」`),

        h('div', {
          style: {
            display: 'flex',
            width: '100%',
            justifyContent: 'space-around',
          },
        },
          h('div', {
            style: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
          },
            h('div', { style: { fontSize: '20px', color: TEXT_DIM, marginBottom: '12px' } }, '最晚的一夜'),
            h('div', { style: { fontSize: '40px', fontWeight: 700, color: ACCENT } }, latestTime),
          ),

          h('div', {
            style: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
          },
            h('div', { style: { fontSize: '20px', color: TEXT_DIM, marginBottom: '12px' } }, '最忙的一天'),
            h('div', { style: { fontSize: '40px', fontWeight: 700, color: ACCENT } }, `${busiestCount} 条`),
          ),

          h('div', {
            style: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
          },
            h('div', { style: { fontSize: '20px', color: TEXT_DIM, marginBottom: '12px' } }, '连续打卡'),
            h('div', { style: { fontSize: '40px', fontWeight: 700, color: ACCENT } }, `${data.longestStreak.days} 天`),
          ),
        ),
      ),

      // ═══════════════════════════════════════
      // 第三层：标签 + 引导（20%）
      // ═══════════════════════════════════════
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0.4',
          paddingTop: '40px',
        },
      },
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

        h('div', { style: { fontSize: '28px', fontWeight: 700, color: ACCENT, marginBottom: '12px' } },
          `你和 Claude 的 ${data.totalDays} 天`),
        h('div', { style: { fontSize: '18px', color: TEXT_DIM } },
          'npx @shanzoon/claude-wrapped'),
      ),
    ),
  )
}
