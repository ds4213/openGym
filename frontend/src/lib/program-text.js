import { getLang } from './i18n-core.js'

const zh = {
  Programs: '训练计划',
  'KeyLifts program catalogue': 'KeyLifts 训练计划目录',
  '{0} KeyLifts programs': '{0} 个 KeyLifts 训练计划',
  'Search programs…': '搜索训练计划…',
  Official: '官方', Community: '社区', Source: '来源', Family: '体系', Phase: '阶段', Goal: '目标', Weeks: '周数',
  'Days per week': '每周天数', Workouts: '训练次数', 'People using it': '使用人数', 'Program details': '计划详情',
  Filters: '筛选', Level: '等级', Category: '类别', 'Clear all filters': '清除全部筛选',
  Beginner: '初级', Intermediate: '中级', Advanced: '高级',
  '{0} weeks': '{0} 周', '{0} days/week': '每周 {0} 天', 'Could not load programs': '无法加载训练计划',
  'Only catalogue information is available for this community program right now.': '这个社区计划目前只有目录信息。',
  'Workout import and Start Program will be added in the next implementation step.': '训练内容导入和“开始计划”会在下一阶段加入。',
  Discover: '发现', Recommended: '推荐', Popular: '热门', 'New discoveries': '新发现', 'Build muscle': '增肌', Strength: '力量',
  'Community programs': '社区计划', 'Browse all': '浏览全部', 'All goals': '全部目标', Conditioning: '体能', 'Fat loss': '减脂',
  'Most popular': '最热门', Newest: '最新', 'A–Z': 'A–Z', '{0} programs': '{0} 个计划', '{0} people': '{0} 人使用',
  'Complete official programs for a strong start': '适合稳步开始的完整官方计划',
  'Most used by the KeyLifts community': 'KeyLifts 社区使用人数最多的计划',
  'Recently shared with the community': '社区最近分享的计划',
  'Programs focused on size and hypertrophy': '专注肌肉增长与增肌训练',
  'Programs focused on getting stronger': '专注提升力量的训练计划',
}

const zhTW = {
  Programs: '訓練計畫',
  'KeyLifts program catalogue': 'KeyLifts 訓練計畫目錄',
  '{0} KeyLifts programs': '{0} 個 KeyLifts 訓練計畫',
  'Search programs…': '搜尋訓練計畫…',
  Official: '官方', Community: '社群', Source: '來源', Family: '體系', Phase: '階段', Goal: '目標', Weeks: '週數',
  'Days per week': '每週天數', Workouts: '訓練次數', 'People using it': '使用人數', 'Program details': '計畫詳情',
  Filters: '篩選', Level: '等級', Category: '類別', 'Clear all filters': '清除全部篩選',
  Beginner: '初級', Intermediate: '中級', Advanced: '高級',
  '{0} weeks': '{0} 週', '{0} days/week': '每週 {0} 天', 'Could not load programs': '無法載入訓練計畫',
  'Only catalogue information is available for this community program right now.': '這個社群計畫目前只有目錄資訊。',
  'Workout import and Start Program will be added in the next implementation step.': '訓練內容匯入和「開始計畫」會在下一階段加入。',
  Discover: '探索', Recommended: '推薦', Popular: '熱門', 'New discoveries': '新發現', 'Build muscle': '增肌', Strength: '力量',
  'Community programs': '社群計畫', 'Browse all': '瀏覽全部', 'All goals': '全部目標', Conditioning: '體能', 'Fat loss': '減脂',
  'Most popular': '最熱門', Newest: '最新', 'A–Z': 'A–Z', '{0} programs': '{0} 個計畫', '{0} people': '{0} 人使用',
  'Complete official programs for a strong start': '適合穩步開始的完整官方計畫',
  'Most used by the KeyLifts community': 'KeyLifts 社群使用人數最多的計畫',
  'Recently shared with the community': '社群最近分享的計畫',
  'Programs focused on size and hypertrophy': '專注肌肉增長與增肌訓練',
  'Programs focused on getting stronger': '專注提升力量的訓練計畫',
}

export function programText(key, ...values) {
  const pack = getLang() === 'zh-TW' ? zhTW : getLang() === 'zh' ? zh : null
  return values.reduce((text, value, index) => text.replaceAll(`{${index}}`, value), pack?.[key] || key)
}
