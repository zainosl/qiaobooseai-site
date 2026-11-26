'use strict';

const {structuredFields} = require('../bitable-fields.js');

const allowedOrigins = new Set(['https://qiaoboose.com','https://www.qiaoboose.com']);
const feishuBase = 'https://open.feishu.cn/open-apis';
const tableId = 'tblyMFvP8p0K8hIY';
const fieldName = '文本';
const maxBytes = 64 * 1024;
const submissionPattern = /^cl1_([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const object = value => value && typeof value === 'object' && !Array.isArray(value);

function send(res,status,body) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) {
    const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > maxBytes) return null;
    return JSON.parse(text);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= maxBytes) chunks.push(chunk);
  }
  if (size > maxBytes) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function formatRecord(record) {
  const {submission_id,timestamp,source,utm_source,utm_campaign,frontend_version,answers,answer_labels,answer_details,computed} = record;
  const {calibrated_stage,priority_problem,voyage_topic} = computed;
  return [
    '报告编号 · ' + submission_id,
    '提交时间 · ' + timestamp,
    '来源 · ' + (source || '商业闭环诊断'),
    '当前阶段 · ' + calibrated_stage,
    '本轮行动 · ' + priority_problem,
    ...(voyage_topic ? ['航海专题 · ' + voyage_topic] : []),
    '',
    '答卷与诊断数据',
    JSON.stringify({submission_id,timestamp,source,utm_source,utm_campaign,frontend_version,answers,answer_labels,answer_details,computed})
  ].join('\n');
}

async function feishuRequest(path,{body,token,signal}) {
  const headers = {'Content-Type':'application/json'};
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(feishuBase + path,{method:'POST',headers,body:JSON.stringify(body),signal});
  return response.json();
}

async function saveRecord(fields,clientToken) {
  const {FEISHU_APP_ID,FEISHU_APP_SECRET,FEISHU_BITABLE_APP_TOKEN} = process.env;
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_BITABLE_APP_TOKEN) throw new Error('missing_config');
  const signal = AbortSignal.timeout(9500);
  const access = await feishuRequest('/auth/v3/tenant_access_token/internal',{
    body:{app_id:FEISHU_APP_ID,app_secret:FEISHU_APP_SECRET},signal
  });
  if (access.code !== 0 || !access.tenant_access_token) {
    throw new Error('feishu_auth_' + (Number(access.code) || 'unavailable'));
  }
  const path = '/bitable/v1/apps/' + encodeURIComponent(FEISHU_BITABLE_APP_TOKEN) + '/tables/' + tableId + '/records';
  const options = {token:access.tenant_access_token,signal};
  const creation = await feishuRequest(path + '?client_token=' + clientToken,{
    ...options,body:{fields}
  });
  if (creation.code === 0 && creation.data?.record?.record_id) return creation.data.record.record_id;
  throw new Error('feishu_write_' + (Number(creation.code) || 'unavailable'));
}

module.exports = async function handleSubmission(req,res) {
  const origin = req.headers.origin;
  if (!allowedOrigins.has(origin)) return send(res,403,{ok:false,error:'origin_denied'});
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    return res.writeHead(204).end();
  }
  if (req.method !== 'POST') return send(res,405,{ok:false,error:'method_not_allowed'});
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    return send(res,400,{ok:false,error:'invalid_content_type'});
  }
  if (Number(req.headers['content-length']) > maxBytes) return send(res,413,{ok:false,error:'too_large'});
  let record;
  try {
    record = await readBody(req);
  } catch {
    return send(res,400,{ok:false,error:'invalid_json'});
  }
  if (record === null) return send(res,413,{ok:false,error:'too_large'});
  const clientToken = typeof record?.submission_id === 'string' && record.submission_id.match(submissionPattern)?.[1];
  if (!clientToken || !Number.isFinite(Date.parse(record.timestamp))
    || !object(record.answers) || !object(record.answer_labels) || !object(record.computed)
    || typeof record.computed.calibrated_stage !== 'string' || typeof record.computed.priority_problem !== 'string'
    || !/^closed-loop-v\d+$/.test(record.frontend_version)) {
    return send(res,422,{ok:false,error:'invalid_submission'});
  }
  try {
    const id = await saveRecord({[fieldName]:formatRecord(record),...structuredFields(record)},clientToken);
    return send(res,200,{ok:true,submission_id:record.submission_id,record_id:id});
  } catch (error) {
    const code = /^(missing_config|feishu_(?:auth|write)_(?:\d+|unavailable))$/.test(error.message) ? error.message : 'feishu_unavailable';
    console.warn('[closed-loop]',record.submission_id,code);
    return send(res,502,{ok:false,error:'storage_unavailable'});
  }
};
