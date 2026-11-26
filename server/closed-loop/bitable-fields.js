'use strict';

const questionColumns = [
  ['scenario','自述情况'],
  ['context','情况补充'],
  ['direction','方向清晰度'],
  ['marketCeiling','收入目标与市场空间'],
  ['marketCycle','机会窗口'],
  ['marketEntry','市场切入判断'],
  ['userScenario','细分用户与场景'],
  ['demand','需求验证进展'],
  ['offer','产品与交付范围'],
  ['delivery','付款与交付进展'],
  ['acquisition','获客进展'],
  ['aiUse','AI 提效进展'],
  ['forecastDecision','预判后的投入决定'],
  ['stagePayment','付款与交付补核'],
  ['fulfillment','本单交付补核'],
  ['deliveryProof','稳定交付补核'],
  ['acquisitionProof','稳定获客补核'],
  ['occupation_type','职业身份'],
  ['years_experience','专业积累年限']
];
const scoreColumns = [
  ['direction','选方向评分'],['forecast','做预判评分'],['demand','选用户评分'],
  ['product','做产品评分'],['acquisition','获客评分'],['ai','AI 提效评分']
];
const profileKeys = new Set([
  'occupation_type','years_experience','work_mode','transferable_abilities','asset_list',
  'value_orientation','possible_business_forms','problem_solving_style',
  'growth_investment_behavior','support_preference','current_time_focus'
]);
const resultColumns = [
  ['calibrated_stage','诊断阶段'],['priority_label','优先业务环'],['priority_problem','本轮任务'],
  ['next_action','下一步行动'],['voyage_topic','航海专题']
];
const fieldSchema = [
  ['报告编号',1],['提交时间',5],['来源',1],
  ...questionColumns.map(([,name]) => [name,1]),
  ['其他补核回答',1],['其他选填资料',1],
  ...resultColumns.map(([,name]) => [name,1]),['同时处理的业务环',1],
  ['稳定交付结果',1],['稳定获客结果',1],
  ...scoreColumns.map(([,name]) => [name,2])
];

const line = value => Array.isArray(value) ? value.join('、') : typeof value === 'string' ? value.trim() : '';

function structuredFields(record) {
  const fields = {'报告编号':record.submission_id,'提交时间':Date.parse(record.timestamp)};
  const add = (name,value) => {
    const text = line(value);
    if (text) fields[name] = text;
  };
  add('来源',record.source);
  const answers = record.answer_details || {};
  for (const [key,name] of questionColumns) add(name,answers[key]?.value);
  const directKeys = new Set(questionColumns.map(([key]) => key));
  const grouped = {'其他补核回答':[],'其他选填资料':[]};
  for (const [key,answer] of Object.entries(answers)) {
    const value = line(answer?.value);
    if (!value || typeof answer.label !== 'string') continue;
    if (directKeys.has(key) && !answer.extra) continue;
    const group = grouped[profileKeys.has(key) ? '其他选填资料' : '其他补核回答'];
    if (!directKeys.has(key)) group.push(answer.label + ' · ' + value);
    if (answer.extra) group.push(answer.label + '（其他） · ' + line(answer.extra));
  }
  for (const [name,items] of Object.entries(grouped)) add(name,items.join('\n'));
  const result = record.computed;
  for (const [key,name] of resultColumns) add(name,result[key]);
  const actions = Array.isArray(result.action_path) ? result.action_path : [];
  add('同时处理的业务环',actions.find(item => item?.schedule === 'parallel')?.label);
  const milestones = Array.isArray(result.closure_milestones) ? result.closure_milestones : [];
  for (const label of ['稳定交付','稳定获客']) {
    add(label + '结果',milestones.find(item => item?.label === label)?.statusLabel);
  }
  const scores = new Map((Array.isArray(result.diagnostic_map) ? result.diagnostic_map : [])
    .filter(item => item && Number.isInteger(item.score) && item.score >= 0 && item.score <= 5)
    .map(item => [item.key,item.score]));
  for (const [key,name] of scoreColumns) {
    if (scores.has(key)) fields[name] = scores.get(key);
  }
  return fields;
}

module.exports = {fieldSchema,structuredFields};
