
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
assert(html.includes('校准结果生成时出现了问题，请重试'), 'failure page has retry wording');
assert(html.includes('下载校准报告'), 'failure page can download markdown report');
assert(!html.includes('为了避免你的校准结果丢失，需要先确认数据已经成功回收到表格中，再展示完整结果报告。请检查网络后重新提交。'), 'old failure wording removed');


assert(html.includes('const API_BASE_URLS'), 'uses multiple API base URLs');
assert(html.includes('submit_path_check',) && html.includes('attempts:5'), 'submissions retry attempts increased to 5');
assert(html.includes('api_base_url'), 'logs selected API base url');
assert(html.includes('for(const baseUrl of apiBaseUrls)'), 'tries API base URLs in sequence');
assert(html.includes('Math.min(8000'), 'uses capped exponential backoff');

process.exit(process.exitCode || 0);
