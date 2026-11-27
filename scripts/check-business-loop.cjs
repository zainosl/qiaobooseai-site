'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const {webcrypto} = require('node:crypto');
const {structuredFields} = require('../server/closed-loop/bitable-fields.js');

const root = path.resolve(__dirname,'../business-loop-diagnosis');
const location = new URL('https://qiaoboose.com/business-loop-diagnosis/');
const window = {location};
window.parent = window;
const scope = vm.createContext({
  window,location,crypto:webcrypto,URLSearchParams,screen:{width:390,height:844},
  navigator:{userAgent:'QA',language:'zh-CN'},document:{querySelector:() => null,referrer:''},
  getComputedStyle:() => ({getPropertyValue:() => '#ffffff'})
});
for (const file of ['questions.js','rules.js','report-details.js','transport.js','report-graphics.js']) {
  vm.runInContext(readFileSync(path.join(root,file),'utf8'),scope,{filename:file});
}
const api = window.ClosedLoop;
const report = answers => api.describeDiagnosis(answers,api.diagnose(answers));
const keys = ['direction','forecast','demand','product','acquisition','ai'];
const baseline = {
  scope:'business',scenario:'exploring',direction:'defined',marketCeiling:'rough',marketEntry:'rough',
  marketCycle:'rough',userScenario:'specific',demand:'trial',offer:'draft',delivery:'trial',acquisition:'steady',aiUse:'none'
};

test('付款冲突先核实同一项业务，再按需要补问获客证据',() => {
  for (const decision of [undefined,'unpaid','paid','completed']) {
    const facts = {...baseline,stagePayment:decision};
    const fields = Array.from(api.evidenceFields(facts),field => field.id);
    assert.ok(fields.includes('stagePayment'));
    if (!decision || decision === 'unpaid') assert.ok(!fields.includes('acquisitionProof'));
    else assert.ok(fields.indexOf('acquisitionProof') > fields.indexOf('stagePayment'));
    if (decision === 'unpaid') {
      const result = report({...facts,acquisitionProof:'repeat'});
      assert.equal(result.map.find(axis => axis.key === 'acquisition').score,0);
      assert.notEqual(result.closure[1].status,'done');
    }
  }
});

test('旧版答卷也能按实际业务环入库',() => {
  const result = report(baseline);
  const record = api.transport.prepare(baseline,result,null);
  const axis = result.map.find(row => row.key === result.priorityAxis);
  assert.equal(record.computed.priority_label,axis.label);
  record.computed.priority_label = result.priorityLabel;
  assert.equal(structuredFields(record)['优先业务环'],axis.label);
  const legacy = {timestamp:record.timestamp,computed:{priority_label:'做产品'}};
  assert.equal(structuredFields(legacy)['优先业务环'],'做产品');
});

test('零分与单轴非零在雷达图上按实际坐标绘制',() => {
  for (const scores of [[0,0,0,0,0],[3,0,0,0,0]]) {
    let points = [], fills = [];
    const ctx = {beginPath(){points=[];},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},
      fill(){fills.push(points.slice());},setTransform(){},clearRect(){},closePath(){},arc(){},stroke(){},fillText(){}};
    api.drawRadar({getContext:() => ctx,width:960,height:700},scores.map(score => ({score,label:'环节'})));
    assert.equal(fills[0].length,5);
    for (const [i,point] of fills[0].entries()) assert.equal(Math.round(Math.hypot(point[0]-240,point[1]-177)),scores[i]*22);
  }
});

test('2400 份按界面实际分支作答的模拟答卷贯穿诊断、上船卡和入库',() => {
  let seed = 27112026;
  function choose(items) {
    seed = (Math.imul(1664525,seed) + 1013904223) >>> 0;
    return items[Math.floor(seed / 0x100000000 * items.length)];
  }
  const stages = new Set(), priorities = new Set();
  for (let i = 0; i < 2400; i++) {
    const a = {scope:'business'};
    for (const field of [api.questions.scenario,...api.businessFields]) a[field.id] = choose(Object.keys(field.options));
    // Reserve a portion for mature businesses, which are less likely under uniform sampling.
    if (i % 6 === 0) Object.assign(a,{delivery:'steady',acquisition:'steady',deliveryProof:'consistent',acquisitionProof:'repeat'});
    for (let n = 0; n < 25; n++) {
      const missing = api.evidenceFields(a).find(field => field.required && !a[field.id]);
      if (!missing) break;
      a[missing.id] = missing.options ? choose(Object.keys(missing.options)) : '模拟新模式，已联系目标客户';
    }
    assert.ok(api.evidenceFields(a).every(field => !field.required || a[field.id]));
    const result = report(a);
    stages.add(result.stage);
    if (result.priorityAxis) priorities.add(result.priorityAxis);
    assert.deepEqual(Array.from(result.map,x => x.key),keys);
    const current = result.path.filter(row => row.schedule === 'current');
    assert.equal(current.length,result.priorityAxis ? 1 : 0);
    if (current.length) assert.equal(current[0].key,result.priorityAxis);
    else assert.ok(result.title && result.action && result.check);
    assert.ok(result.path.filter(row => row.schedule === 'parallel').length <= 1);
    for (const row of result.path) {
      const seen = new Set([row.key]);
      let next = row.afterKey;
      while (next) {
        assert.ok(!seen.has(next)); seen.add(next);
        const parent = result.path.find(item => item.key === next);
        assert.ok(parent); next = parent.afterKey;
      }
    }
    const payload = api.transport.prepare(a,result,result.voyage);
    const columns = structuredFields(payload);
    assert.equal(columns['优先业务环'],current[0]?.label);
    for (const axis of result.map) {
      assert.ok(Number.isInteger(axis.score) && axis.score >= 0 && axis.score <= 5);
      assert.equal(columns[axis.label + '评分'],axis.score);
    }
    for (const field of api.evidenceFields(a)) {
      if (a[field.id]) assert.equal(payload.answer_details[field.id].value,field.options?.[a[field.id]] || a[field.id]);
    }
    if (result.voyage) {
      const card = api.voyageCardDetails(result,result.voyage);
      assert.ok(card.stage && card.boarding.length);
    }
    if (['repeat','scale'].includes(result.stage)) assert.ok(result.closure.every(item => item.status === 'done'));
  }
  assert.deepEqual([...stages].sort(),['early','repeat','scale']);
  assert.deepEqual([...priorities].sort(),[...keys].sort());
});
