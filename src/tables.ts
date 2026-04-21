import type { WrappedData, OverviewStats, HourSlot, WeekdayStat } from './types.js'

/** 构建概览结构化数据 */
export function buildOverviewStats(data: WrappedData): OverviewStats {
  return {
    totalDays: data.totalDays,
    dateRange: `${data.firstDate} ~ ${data.lastDate}`,
    activeDays: data.activeDays,
    attendanceRate: data.activeDays / data.totalDays,
    totalPrompts: data.totalPrompts,
    totalConversations: data.totalConversations,
    totalTokens: data.totalTokens,
    totalApiCalls: data.totalApiCalls,
    longestStreak: {
      days: data.longestStreak.days,
      range: `${data.longestStreak.startDate} ~ ${data.longestStreak.endDate}`,
    },
    longestConversation: {
      rounds: data.longestConversation.rounds,
      project: data.longestConversation.project,
    },
    lateNight: {
      days: data.lateNightDays,
      count: data.lateNightCount,
    },
    chineseRatio: data.chineseRatio,
  }
}

/** 构建时段分布结构化数据 */
export function buildHourSlots(data: WrappedData): HourSlot[] {
  const hourDist = data.hourDistribution
  const slots = [
    { label: '深夜 (0-5)', hours: [0, 1, 2, 3, 4, 5] },
    { label: '上午 (9-12)', hours: [9, 10, 11, 12] },
    { label: '下午 (13-18)', hours: [13, 14, 15, 16, 17, 18] },
    { label: '晚间 (19-23)', hours: [19, 20, 21, 22, 23] },
  ]
  return slots.map(s => ({
    label: s.label,
    hours: s.hours,
    total: s.hours.reduce((sum, h) => sum + (hourDist[h] ?? 0), 0),
    peakHour: s.hours.reduce((best, h) => (hourDist[h] ?? 0) > (hourDist[best] ?? 0) ? h : best, s.hours[0]),
  }))
}

/** 构建星期分布结构化数据 */
export function buildWeekdayStats(data: WrappedData): WeekdayStat[] {
  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return weekdays.map(d => ({
    day: d,
    count: data.weekdayDistribution[d] ?? 0,
  }))
}

/** 一次性构建所有结构化数据 */
export function buildAllData(data: WrappedData) {
  return {
    overview: buildOverviewStats(data),
    monthly: data.monthly,
    hourSlots: buildHourSlots(data),
    weekdays: buildWeekdayStats(data),
    raw: data,
  }
}
