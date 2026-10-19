import { getLang } from './i18n-core.js'

const zh = {
  Programs: '训练计划',
  'KeyLifts program catalogue': 'KeyLifts 训练计划目录',
  '{0} KeyLifts programs': '{0} 个 KeyLifts 训练计划',
  'Search programs…': '搜索训练计划…',
  Official: '官方', Community: '社区', Source: '来源', Family: '体系', Phase: '阶段', Goal: '目标', Weeks: '周数',
  'Days per week': '每周天数', Workouts: '训练次数', 'People using it': '使用人数', 'Program details': '计划详情',
  '{0} weeks': '{0} 周', '{0} days/week': '每周 {0} 天', 'Could not load programs': '无法加载训练计划',
  'Only catalogue information is available for this community program right now.': '这个社区计划目前只有目录信息。',
  'Workout import and Start Program will be added in the next implementation step.': '训练内容导入和“开始计划”会在下一阶段加入。',
}

const zhTW = {
  Programs: '訓練計畫',
  'KeyLifts program catalogue': 'KeyLifts 訓練計畫目錄',
  '{0} KeyLifts programs': '{0} 個 KeyLifts 訓練計畫',
  'Search programs…': '搜尋訓練計畫…',
  Official: '官方', Community: '社群', Source: '來源', Family: '體系', Phase: '階段', Goal: '目標', Weeks: '週數',
  'Days per week': '每週天數', Workouts: '訓練次數', 'People using it': '使用人數', 'Program details': '計畫詳情',
  '{0} weeks': '{0} 週', '{0} days/week': '每週 {0} 天', 'Could not load programs': '無法載入訓練計畫',
  'Only catalogue information is available for this community program right now.': '這個社群計畫目前只有目錄資訊。',
  'Workout import and Start Program will be added in the next implementation step.': '訓練內容匯入和「開始計畫」會在下一階段加入。',
}

export function programText(key, ...values) {
  const pack = getLang() === 'zh-TW' ? zhTW : getLang() === 'zh' ? zh : null
  return values.reduce((text, value, index) => text.replaceAll(`{${index}}`, value), pack?.[key] || key)
}
