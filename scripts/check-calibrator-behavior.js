
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exitCode = 1; } else { console.log('PASS:', msg); } }
assert(html.includes('async function generateResult'), 'has generateResult function');
assert(/await\s+submitPathCheck\s*\(\s*\)\s*;\s*renderResult\s*\(\s*\)/s.test(html), 'generateResult waits for submitPathCheck before renderResult');
assert(!/renderResult\s*\(\s*\)\s*;\s*await\s+submitPathCheck/s.test(html), 'generateResult does not render before submit');
assert(html.includes('function downloadCalibrationMarkdown'), 'has markdown download function');
assert(html.includes('downloadMarkdownFile'), 'has markdown file downloader');
assert(html.includes('下载校正结果'), 'button label changed to 下载校正结果');
assert(!html.includes('复制校正结果'), 'old copy calibration result label removed');
assert(html.includes('## 用户选择信息'), 'markdown includes user choices section');
assert(html.includes('## 结果页信息'), 'markdown includes result information section');
assert(html.includes('parent_page_url'), 'payload includes parent_page_url for iframe observability');
assert(html.includes('CALIBRATOR_VERSION'), 'payload includes frontend version constant');
assert(html.includes('path_calibrator_last_payload'), 'frontend stores last payload locally');
assert(html.includes('保存编号'), 'result page shows save number');
assert(html.includes('browser_language'), 'payload includes browser language');
assert(html.includes('screen_size'), 'payload includes screen size');
assert(html.includes('timezone'), 'payload includes timezone');

process.exit(process.exitCode || 0);
