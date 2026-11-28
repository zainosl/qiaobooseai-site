(() => {
  'use strict';

  const {
    questions:q, profileFields, businessFields, evidenceFields, diagnose, describeDiagnosis, priorityItems, priorityOverview, voyageCardDetails, voyageCardTitle, scoreBasis, drawRadar, voyageImage, transport
  } = window.ClosedLoop;
  const app = document.getElementById('app');
  const pendingKey = 'closed-loop-pending-report-v4';
  const state = { screen:'home', answers:{}, record:null, result:null, snapshot:null, receipt:null, failure:null, reviewEditing:false, profileOpen:false };
  const html = value => String(value ?? '').replace(/[&<>"']/g, ch =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
  const string = value => String(value ?? '').trim();
  const md = value => String(value ?? '').replace(/[&<>]/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;'})[ch])
    .replace(/[\\`*_[\]|]/g, '\\$&').replace(/\r?\n/g, ' ');
  const workOpen = new Set(document.querySelector('meta[name="closed-loop-work-topics-open"]').content.split(',').map(string).filter(Boolean));
  const stepOrder = ['issue','stage','evidence','profile','confirm'];
  const stepTitles = {issue:'了解你的情况',stage:'核对五环进展',evidence:'核对会影响结论的事实',profile:'补充用户信息（选填）',confirm:'确认并生成'};
  const stepLabels = ['当前情况','五环进展','补核事实','选填资料','确认生成'];
  const entryProblems = [
    ['01 · 选方向','干了这么多年想出来单干，脑子里有好几个方向都觉得能做，越想越不知道先押哪一个。'],
    ['02 · 做预判','好不容易看中一个方向，又怕市场太小或红利已过，投入几个月才发现根本赚不到钱。'],
    ['03 · 选用户','觉得大家应该都需要，发了不少内容却没人真正买单，说不清到底谁会为我掏钱。'],
    ['04 · 做产品','有专业能力，但不知道怎么包装成能直接卖的服务，交付做到哪一步才算结束。'],
    ['05 · 获客','服务和方案都准备好了，但客户从哪来全靠缘分，不知道下一单要靠什么动作拿到。']
  ];
  const cases = [
    {
      user:'用户 A**', role:'8 年互联网运营', focus:'方向取舍',
      quote:'“手头三个方向我都做过，听起来都合理，但拖了半年一个都没真正启动。”',
      problem:'方向分散、精力被拉扯，迟迟定不下主线。',
      outcome:'按「谁在什么情境下会买什么」重新拆解并排序，当场收敛出 1 条主线，2 周内约到首批付费意向访谈。'
    },
    {
      user:'用户 B**', role:'内容与视觉创作者', focus:'需求验证',
      quote:'“市场上图文故事很火，我也会做，但一直搞不清到底谁会为整包服务掏钱。”',
      problem:'想直接做整包服务，但没核实真实买方是谁。',
      outcome:'沿 14 个真实成品倒查付款关系，发现大多为机构内部制作，整包买方尚不成立；及时止损，转向验证单点需求。'
    },
    {
      user:'用户 C**', role:'独立知识博主', focus:'内容获客',
      quote:'“文章每周都在发，阅读和咨询却没起色，根本不知道该改选题、改写法还是换方向。”',
      problem:'长期写泛话题引流，内容和真实付费问题脱节。',
      outcome:'停掉泛科普，锁定目标客户眼下最痛的 1 个具体问题重做选题，发完当周就收到精准私信咨询。'
    },
    {
      user:'用户 D**', role:'独立咨询师', focus:'AI 提效',
      quote:'“知识库攒了一大堆，AI 工具买了好几个，但一到真干活还是用不上。”',
      problem:'工具与个人方法论断层，每次提问都要从零调教。',
      outcome:'梳理出核心任务的「方法调用路径 + 验收标准」，把高频整理流程接入 AI，单次准备时间直接压减一半以上。'
    }
  ];
  let voyagePreview = null;

  document.querySelector('#footer-note').textContent = transport.live
    ? '乔不不斯 · 一人公司商业闭环诊断'
    : '本地试用 · 结果在当前设备生成';

  function button(label, action, extra = '') {
    return `<button type="button" class="btn ${extra}" data-action="${action}">${label}</button>`;
  }

  function startButton() {
    const hasDraft = Object.keys(state.answers).length > 0;
    const label = hasDraft ? '继续我的诊断' : '开始我的诊断';
    return button(label + ' <span aria-hidden="true">→</span>','start','primary')
      + (hasDraft ? button('重新开始','restart') : '');
  }

  function caseSection() {
    return `<section class="entry-cases" aria-labelledby="case-title">
      <div class="entry-wrap">
        <div class="entry-cases-heading">
          <div>
            <h2 id="case-title">真实诊断案例</h2>
            <p>来自过往一对一诊断与共创实战，用户身份已做匿名处理。</p>
          </div>
        </div>
        <ul class="case-grid" aria-label="真实诊断案例">
          ${cases.map(item => `<li>
            <article class="case-card">
              <p class="case-byline"><strong>${item.user}<em>${item.role}</em></strong><span>${item.focus}</span></p>
              <blockquote class="case-quote">${item.quote}</blockquote>
              <dl class="case-facts">
                <div><dt>核心卡点</dt><dd>${item.problem}</dd></div>
                <div><dt>诊断后的变化</dt><dd>${item.outcome}</dd></div>
              </dl>
            </article>
          </li>`).join('')}
        </ul>
        <div class="entry-actions entry-cases-actions">
          ${startButton()}
        </div>
      </div>
    </section>`;
  }

  function home() {
    return `<div class="entry-page">
      <div class="entry-hero-band">
        <section class="entry-hero entry-wrap" aria-labelledby="page-title">
          <div class="entry-hero-copy">
            <h1 id="page-title" tabindex="-1"><span>一人公司</span><span>商业闭环诊断</span></h1>
            <div class="entry-promise">
              <p class="entry-promise-lead">聚焦 0～1 商业闭环，从 6 个关键维度系统拆解你的业务现状：</p>
              <ul class="entry-loop-pills" aria-label="诊断维度">
                <li>选方向</li><li>做预判</li><li>选用户</li><li>做产品</li><li>获客</li><li>AI 提效贯穿五环</li>
              </ul>
              <p class="entry-promise-result">帮你<strong>看清当前最关键的卡点，给出能直接落地的下一步建议。</strong></p>
            </div>
            <section class="entry-fit" aria-labelledby="fit-title">
              <h2 id="fit-title">适合谁</h2>
              <ul><li>有专业经验，想转型做知识服务的职场人</li><li>收入还不稳定的知识服务 IP、教练和咨询师</li></ul>
            </section>
            <div class="entry-actions">
              ${startButton()}
              <p>免费诊断 · 约 3–5 分钟出完整报告</p>
            </div>
          </div>
          <aside class="entry-person" aria-labelledby="entry-person-name">
            <img src="./portrait-hero.webp" width="818" height="1280" alt="乔不不斯的照片" fetchpriority="high">
            <div class="entry-person-profile">
              <div class="entry-person-head">
                <h2 id="entry-person-name">乔不不斯</h2>
                <span class="person-mbti">ISTP</span>
              </div>
              <ul>
                <li>8 年 AI 大厂产品负责人</li>
                <li>AI Native 一人公司实践者</li>
                <li>转型 3 个月第一单变现</li>
              </ul>
              <div class="entry-person-purpose">
                <h3>我做什么</h3>
                <p>帮本来能创造更大价值的职场人和知识服务老师，找准方向，再把方向做成产品、获客、完成变现。</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
      <section class="entry-problems entry-wrap" aria-labelledby="problems-title">
        <div class="entry-section-head">
          <h2 id="problems-title">你是不是也卡在这里？</h2>
          <p>如果你正处在下面任意一种状态，先别盲目继续忙，看看眼下真正卡在哪一环。</p>
        </div>
        <ul class="entry-problem-rows">${entryProblems.map(([label,problem]) => `<li>
          <span class="problem-tag">${label}</span>
          <strong>${problem}</strong>
        </li>`).join('')}</ul>
      </section>
      <section class="entry-contents" aria-labelledby="contents-title">
        <div class="entry-wrap">
          <h2 id="contents-title">做完诊断，你会拿到什么？</h2>
          <dl>
            <div>
              <span class="content-step" aria-hidden="true">01</span>
              <dt>定位当前最大缺口</dt>
              <dd>结合你目前的经营阶段，给选方向、做预判、选用户、做产品、获客和 AI 提效逐项打分，一眼看出哪一环最拖进度。</dd>
            </div>
            <div>
              <span class="content-step" aria-hidden="true">02</span>
              <dt>明确这轮的优先顺序</dt>
              <dd>基于你已经做过的尝试和真实反馈，说清为什么眼下该先补这一环，避免在不该花精力的地方空转。</dd>
            </div>
            <div>
              <span class="content-step" aria-hidden="true">03</span>
              <dt>一套能直接落地的动作</dt>
              <dd>拆出具体的下一步执行步骤，以及做完后怎么判断到底有没有推进，同时提供 AI 提效的最小尝试建议。</dd>
            </div>
          </dl>
        </div>
      </section>
      ${caseSection()}
    </div>`;
  }

  const activeFields = (screen, a) => {
    if (screen === 'issue') return [q.scenario,q.context];
    if (screen === 'stage') return businessFields;
    if (screen === 'evidence') return evidenceFields(a).map(field => {
      const hint = {
        deliveryProof:'你填写了多次付费交付。这里确认相似客户能否稳定收到约定的结果。',
        acquisitionProof:'你填写了持续成交。这里确认相似的渠道或动作能否重复带来付费客户。',
        stagePayment:'前面两道题的付款记录有出入。请以同一项服务的实际付款和交付为准。',
        fulfillment:'你填写了已有付费交付或遇到交付摩擦。这里核对客户是否验收，以及有没有返工或争议。',
        repeatDelivery:'你已经做完过付费订单，客源还不稳定。上一单的验收和实际投入，能帮助判断接下来先修交付，还是先验证获客。',
        sale:a.acquisition === 'leads' ? '你填写了有持续咨询。这里核对最近一位目标客户具体停在哪一步。'
          : '你填写了有可试的服务。这里补核最近一次触达有没有推进。',
        experience:'方向还没收敛。这里找一条能用来比较候选方向的真实经历。',
        directionCheck:'你已经有具体候选，但还没接触到目标用户。这里核对你做过哪些外部调查。',
        reply:'你已发出明确报价。客户的最后一次回应能决定下一步是澄清、跟进还是收尾。',
        expansion:'稳定交付和稳定获客都有了依据。这里看你是否已经在尝试新的收入模式。',
        newMode:'你填写了已在尝试新模式。这里记录它面向谁、提供什么，以及推进到了哪一步。',
        expansionEvidence:'用最近一次真实反馈，确定新模式当前优先验证什么。',
        operations:'同一模式能稳定运作后，最近的订单或咨询记录可以指出下一处改善机会。',
        aiImpact:'你填写了重复耗时或返工已经拖慢业务。这里核对具体卡在哪一步，方便给出对照方案。',
        record:'可以补充上面选项没有涵盖的一次真实尝试和结果。'
      }[field.id];
      return hint ? {...field,hint} : field;
    });
    return screen === 'profile' ? profileFields : [];
  };

  function surveySteps(a) {
    const coreComplete = activeFields('stage',a).every(field => string(a[field.id]));
    return coreComplete && !evidenceFields(a).length ? stepOrder.filter(screen => screen !== 'evidence') : stepOrder;
  }

  function snapshot() {
    const a = state.answers;
    const result = { scope:'business' };
    for (const screen of stepOrder) {
      for (const item of activeFields(screen,a)) {
        const value = a[item.id];
        if (Array.isArray(value) ? value.length : string(value)) result[item.id] = value;
        if (item.extraKey && (Array.isArray(value) ? value.includes('其他') : value === '其他')) {
          if (string(a[item.extraKey])) result[item.extraKey] = string(a[item.extraKey]);
        }
      }
    }
    return result;
  }

  const coreAnswerKeys = new Set([q.scenario,q.context,...businessFields].map(field => field.id));

  function discardHiddenFollowUps() {
    // Removing an obsolete answer may make further dependent questions disappear.
    while (true) {
      const visible = new Set(evidenceFields(state.answers).map(field => field.id));
      const obsolete = Object.keys(state.answers).filter(key => q[key] && !coreAnswerKeys.has(key) && !visible.has(key));
      if (!obsolete.length) return;
      for (const key of obsolete) delete state.answers[key];
    }
  }

  function renderField(item) {
    const { id, label, options, type, hint, required, rows, extra, extraKey, max, optionExamples } = item;
    const value = state.answers[id] || '';
    if (type === 'text') {
      const input = rows > 1
        ? `<textarea id="field-${id}" name="${id}" class="control" rows="${rows}" maxlength="400">${html(value)}</textarea>`
        : `<input id="field-${id}" name="${id}" class="control" maxlength="160" value="${html(value)}">`;
      return `<div data-field="${id}"><label class="field-title" for="field-${id}">${label}${required ? '' : ' <small>选填</small>'}</label>
        ${input}${hint ? `<p class="note field-hint">${hint}</p>` : ''}</div>`;
    }
    const active = Array.isArray(value) ? value : [value];
    return `<fieldset data-field="${id}" ${max ? `data-max="${max}"` : ''}><legend>${html(label)}</legend>
      ${hint ? `<p class="note field-hint">${html(hint)}</p>` : ''}
      <div class="options">${Object.entries(options).map(([key,caption]) => `<label class="option">
        <input type="${type}" name="${id}" value="${html(key)}" ${active.includes(key) ? 'checked' : ''}><span>${html(caption)}${optionExamples?.[key] ? `<small class="option-example">${html(optionExamples[key])}</small>` : ''}</span>
      </label>`).join('')}</div>
      ${extra ? `<div class="extra-field" ${active.includes('其他') ? '' : 'hidden'}>
        <label for="field-${extraKey}">${html(extra)} <small>选填</small></label>
        <input id="field-${extraKey}" name="${extraKey}" class="control" maxlength="160" value="${html(state.answers[extraKey] || '')}"></div>` : ''}
    </fieldset>`;
  }

  const stageFieldGroups = [
    { key:'direction', index:'01', title:'选方向', desc:'确认你目前准备尝试的业务方向清晰到哪一步', ids:['direction'] },
    { key:'forecast', index:'02', title:'做预判', desc:'评估市场收入空间、机会窗口与进入门槛', ids:['marketCeiling','marketCycle','marketEntry'] },
    { key:'demand', index:'03', title:'选用户', desc:'确认细分人群、场景与真实需求反馈', ids:['userScenario','demand'] },
    { key:'product', index:'04', title:'做产品与交付', desc:'确认服务范围、验收标准与实际付款交付情况', ids:['offer','delivery'] },
    { key:'acquisition', index:'05', title:'获客', desc:'确认新付费客户目前的来源与稳定性', ids:['acquisition'] },
    { key:'ai', index:'06', title:'AI 提效', desc:'确认目前是否有适合用 AI 提效的具体工作', ids:['aiUse'] }
  ];

  function renderStageGroups(fields) {
    const byId = new Map(fields.map(field => [field.id, field]));
    return stageFieldGroups.map(group => {
      const items = group.ids.map(id => byId.get(id)).filter(Boolean);
      if (!items.length) return '';
      return `<section class="stage-field-group" data-group="${group.key}">
        <header class="stage-group-head">
          <span class="stage-group-num">${group.index}</span>
          <div>
            <h2>${group.title}</h2>
            <p>${group.desc}</p>
          </div>
          <span class="stage-group-count">${items.length} 题</span>
        </header>
        <div class="stage-group-fields">${items.map(renderField).join('')}</div>
      </section>`;
    }).join('');
  }

  function syncFields() {
    if (state.screen === 'stage') return;
    const fields = activeFields(state.screen,state.answers);
    const expected = new Set(fields.map(field => field.id));
    const container = app.querySelector('#question-fields');
    const active = document.activeElement;
    const existing = new Map([...container.children].map(node => [node.dataset.field,node]));
    [...container.children].filter(node => !expected.has(node.dataset.field)).forEach(node => node.remove());
    fields.forEach((field,index) => {
      let node = existing.get(field.id);
      const before = container.children[index];
      if (!node) {
        const template = document.createElement('template');
        template.innerHTML = renderField(field);
        node = template.content.firstElementChild;
      } else if (field.type === 'radio') {
        for (const input of node.querySelectorAll('input[type="radio"]')) {
          input.checked = input.value === state.answers[field.id];
        }
      }
      if (node !== before) container.insertBefore(node,before || null);
    });
    if (active?.isConnected && document.activeElement !== active) active.focus({preventScroll:true});
  }

  function answerText(field, a) {
    const value = a[field.id];
    if (!field.options) return string(value);
    const selected = Array.isArray(value) ? value : [value];
    return selected.filter(Boolean).map(key => field.options[key] || '').filter(Boolean).join('、');
  }

  function summaryRows(rows) {
    const filled = rows.filter(([,value]) => value);
    return filled.length ? `<dl class="summary-rows">${filled.map(([label,value]) =>
      `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`).join('')}</dl>` : '';
  }

  function interimSummary() {
    const a = snapshot();
    const profileNames = {
      occupation_type:'职业与身份',years_experience:'专业积累',work_mode:'工作状态',
      transferable_abilities:'可迁移能力',asset_list:'业务基础',value_orientation:'目前看重的事',
      possible_business_forms:'考虑的业务形态',problem_solving_style:'遇到卡点时的做法',
      growth_investment_behavior:'过去一年的投入',support_preference:'支持偏好',current_time_focus:'当前时间投入'
    };
    const background = activeFields('profile',a).flatMap(field => [
      [profileNames[field.id],answerText(field,a)],
      ...(field.extraKey && a[field.extraKey] ? [[field.extra,a[field.extraKey]]] : [])
    ]).filter(([,value]) => value);
    const facts = [
      ['选方向',q.direction],['市场天花板',q.marketCeiling],['机会窗口',q.marketCycle],['竞争壁垒',q.marketEntry],
      ['细分用户场景',q.userScenario],['选用户',q.demand],['做产品',q.offer],['付款与交付',q.delivery],['获客',q.acquisition],['AI 提效',q.aiUse]
    ].map(([label,field]) => [label,answerText(field,a)]);
    const detailNames = {
      deliveryProof:'交付稳定性',acquisitionProof:'获客稳定性',stagePayment:'补核付款与交付',
      fulfillment:'该单交付情况',repeatDelivery:'上一单是否能复用',sale:'最近客户进展',reply:'报价后回应',quoteDate:'约定答复时间',
      experience:'已有经历',directionCheck:'已做的外部调查',record:'最近做过的事',
      expansion:'收入模式',newMode:'正在验证的新模式',operations:'现有经营记录',expansionEvidence:'新模式反馈',
      aiImpact:'影响进度的工作',forecastDecision:'预判后的投入决定'
    };
    const details = activeFields('evidence',a)
      .map(field => [detailNames[field.id] || field.label,answerText(field,a)])
      .filter(([,value]) => value);
    const section = (title,rows,screen,empty = '') => {
      const action = empty && !rows.length ? '补充' : '修改';
      return `<section class="card confirm-summary">
        <div class="confirm-heading"><h2>${title}</h2>
          <button type="button" class="review-edit" data-action="review-${screen}" aria-label="${action}${title}">${action}</button>
        </div>${summaryRows(rows) || (empty ? `<p class="note">${empty}</p>` : '')}
      </section>`;
    };
    return [
      section('当前情况',[['当前情况',answerText(q.scenario,a)],['情况补充',a.context]],'issue'),
      section('五环进展与 AI 提效',facts,'stage'),
      ...(details.length ? [section('补核事实',details,'evidence')] : []),
      section('选填资料',background,'profile','未补充，可直接生成报告。')
    ].join('');
  }

  function fieldComplete(field) {
    const value = state.answers[field.id];
    return field.type === 'radio' ? Object.hasOwn(field.options,value) : Boolean(string(value));
  }

  function firstIncompleteStep(steps) {
    return steps.find(step => activeFields(step,state.answers).some(field => field.required !== false && !fieldComplete(field)));
  }

  function questionProgress() {
    const required = activeFields(state.screen,state.answers).filter(item => item.required !== false);
    return required.length ? '本步必答 ' + required.filter(fieldComplete).length + ' / ' + required.length : '';
  }

  function updateQuestionProgress() {
    const progress = app.querySelector('#question-progress');
    const text = questionProgress();
    if (progress && progress.textContent !== text) progress.textContent = text;
  }

  function formScreen() {
    const screen = state.screen;
    const steps = surveySteps(state.answers);
    const activeList = activeFields(screen,state.answers);
    const fields = screen === 'stage' ? renderStageGroups(activeList) : activeList.map(renderField).join('');
    const currentIndex = steps.indexOf(screen);
    const tip = {
      issue:'先选一项最接近你的情况，也可以补充自己的描述。',
      stage:'按同一项业务最近发生的情况回答。还没尝试过的环节，按实际进展选就可以。',
      evidence:'根据你前面的回答，补充几项会影响判断的事实。',
      profile:'这一步可以跳过。愿意补充的话，可以帮助我们更了解你的背景，减少后续沟通时重复询问个人情况的时间。',
      confirm:'确认以下内容后，就可以生成诊断报告。'
    }[screen];
    const questions = `<div id="question-fields" class="form-card">${fields}</div>`;
    const action = screen === 'confirm' ? '生成诊断报告'
      : screen === 'profile' || state.reviewEditing ? '前往确认生成' : '下一步';
    return `<section class="narrow survey" data-screen="${screen}">
      <ol class="progress" aria-label="诊断进度" style="--steps:${steps.length}">${steps.map((step,i) =>
        `<li ${i === currentIndex ? 'aria-current="step"' : i < currentIndex ? 'class="done"' : ''}>${stepLabels[stepOrder.indexOf(step)]}</li>`).join('')}</ol>
      <h1 class="page-title" tabindex="-1" id="page-title">${stepTitles[screen]}</h1>
      <p class="form-intro">${tip}</p>
      <form id="quiz" novalidate>
        ${screen === 'confirm' ? interimSummary() : screen === 'profile'
          ? `<details class="profile-fields" ${state.profileOpen ? 'open' : ''}><summary><span class="when-closed">展开选填资料</span><span class="when-open">收起选填资料</span></summary>${questions}</details>`
          : `<section class="question-panel">${questions}</section>`}
        ${screen === 'confirm' ? `<p class="note save-hint">${transport.live ? '生成时会提交填写内容，用于诊断记录和本轮服务跟进。' : '本地试用在当前设备生成报告。'}</p>` : ''}
        <div class="form-advance">
          <p class="error form-message" id="error" role="alert"></p>
          <div class="form-foot">${button(screen === 'issue' ? '返回首页' : '上一步','back')}
            <span id="question-progress" class="question-progress" aria-live="polite">${questionProgress()}</span>
            <button type="submit" class="btn primary">${action}</button>
          </div>
        </div>
      </form>
    </section>`;
  }

  function activeVoyage(r) {
    if (r.voyage) return r.voyage;
    if (r.topic && workOpen.has(r.topicKey)) {
      return {name:r.topic.name,task:r.title,material:r.topic.material,output:r.topic.output};
    }
    return null;
  }

  function voyageBaseline(result, voyage) {
    const details = voyageCardDetails(result,voyage);
    return `<div class="voyage-card-content">
      <h3>上船前的诊断基线</h3>
      <p class="voyage-stage">当前阶段 <strong>${html(details.stage)}</strong></p>
      ${result.map.length ? `<section class="voyage-scores">
        <h4>上船前评分</h4>
        <div class="diagnostic-charts voyage-charts">
          <div>${scoreBars(result,'voyage-score-bars')}</div>
          ${radarFigure(result,'voyage-score-radar')}
        </div>
      </section>` : ''}
      ${details.business.length ? `<section class="voyage-tasks"><h4>业务环行动</h4>${summaryRows(details.business)}</section>` : ''}
      <section class="voyage-tasks"><h4>航海任务</h4>${summaryRows(details.boarding)}</section>
      ${details.ai.length ? `<section class="voyage-tasks"><h4>AI 提效行动</h4>${summaryRows(details.ai)}</section>` : ''}
    </div>`;
  }

  function renderCard(voyage) {
    const r = state.result;
    return `<section class="card voyage-card" aria-labelledby="voyage-title">
      <header class="voyage-intro">
        <div>
          <h2 id="voyage-title">带着这份诊断上船</h2>
          <p>用三个月完成一人公司的 0～1，把五环逐步做到标准。</p>
        </div>
        <a class="btn primary" href="#voyage-form">开始制作上船卡 <span aria-hidden="true">↓</span></a>
      </header>
      <p>请先把卡保存好，开船时会收取上船卡。三个月后用同样的标准再测一次，对照五环业务与 AI 提效的进展。</p>
      <a class="voyage-link" href="https://qiaoboose.com/latest-event/voyage.html" target="_blank" rel="noopener">查看航海详细介绍 <span aria-hidden="true">↗</span></a>
      ${voyageBaseline(r,voyage)}
      <form id="voyage-form">
        <label class="field-title" for="card-name">你的名字 <small>必填</small></label>
        <input id="card-name" class="control" name="name" type="text" maxlength="40" autocomplete="name" required>
        <label class="field-title" for="card-problem">补充你现在最担心或者还有疑问的问题 <small>选填</small></label>
        <textarea class="control" id="card-problem" name="problem" rows="2" maxlength="180"></textarea>
        <p id="voyage-hint" class="note">先生成带日期和评分的图片，核对预览后再下载。</p>
        <div class="actions"><button class="btn primary" type="submit" aria-describedby="voyage-hint">制作上船卡</button><span id="voyage-status" role="status"></span></div>
      </form>
      <section class="voyage-output" aria-labelledby="voyage-preview-title" hidden>
        <h3 id="voyage-preview-title" tabindex="-1">确认上船卡</h3>
        <img class="voyage-preview" alt="${html(voyageCardTitle)}预览">
        <div class="actions">
          <a class="btn primary" id="voyage-png" download>确认并下载 PNG</a>
        </div>
      </section>
    </section>`;
  }

  function evidenceList(items) {
    if (!items.length) return '';
    return '<ul class="checklist">' + items.map(({label,value}) =>
      '<li><b>' + html(label) + '</b><span>' + html(value) + '</span></li>'
    ).join('') + '</ul>';
  }

  const businessStages = [
    { key:'early', label:'0→1', title:'跑通第一个商业闭环', boundary:'选方向并做市场预判，再验证用户、产品和获客。稳定交付和稳定获客都得到验证后，进入 1→10。' },
    { key:'repeat', label:'1→10', title:'放大已经跑通的模式', boundary:'已经能稳定获客和交付，接下来在现有模式里提高有效咨询、成交、承接量或单笔收益。' },
    { key:'scale', label:'10→100', title:'验证新的收入模式', boundary:'已有稳定的主业务，同时已经开始比较、接触客户或试点新的收入模式，继续验证新模式能否带来收入。' }
  ];

  function statusBadge(item) {
    const symbols = {done:'✓',progress:'◐',gap:'!',verify:'?',waiting:'–'};
    return `<span class="diagnostic-status" data-status="${item.status}"><span aria-hidden="true">${symbols[item.status]}</span>${html(item.statusLabel)}</span>`;
  }

  function stageOverview(result) {
    return `<section class="card business-stages" aria-labelledby="business-stages-title">
      <h3 id="business-stages-title">经营阶段</h3>
      <ol class="stage-cards">
        ${businessStages.map(item => `<li ${result.stage === item.key ? 'aria-current="step"' : ''}>
          <div class="stage-card-heading"><strong>${item.label}</strong>${result.stage === item.key ? `<span>${result.provisional ? '暂按这里' : '你在这'}</span>` : ''}</div>
          <h4>${item.title}</h4>
          <p class="stage-card-desc">${html(item.boundary)}</p>
        </li>`).join('')}
      </ol>
    </section>`;
  }

  function scoreText(axis) {
    return axis.score + ' / 5';
  }

  function scoreBand(score) {
    if (score <= 2) return 'low';
    return score < 5 ? 'mid' : 'full';
  }

  function diagnosticTiming(result) {
    const prefix = result.stage === 'scale' ? '新模式 · ' : '';
    return new Map(priorityItems(result).map(item => [item.key,prefix + item.timing]));
  }

  function scoreBars(result, id, showTiming = false) {
    const timingByKey = showTiming ? diagnosticTiming(result) : new Map();
    return `<ul class="score-bars" id="${id}" aria-label="五环业务与 AI 提效评分">
      ${result.map.map(axis => `<li data-score-band="${scoreBand(axis.score)}" ${axis.key === 'ai' ? 'data-ai' : ''} ${axis.score === 0 ? 'data-zero' : ''} ${timingByKey.has(axis.key) ? 'data-priority' : ''}>
        <div class="score-bar-heading"><strong>${showTiming
          ? `<a class="score-link" href="#${executionTarget(axis.key)}">${html(axis.label)} <span aria-hidden="true">↘</span></a>`
          : html(axis.label + (axis.key === 'ai' ? ' · 贯穿五环' : ''))}</strong>
        ${timingByKey.has(axis.key) ? `<span class="diagnostic-priority">${html(timingByKey.get(axis.key))}</span>` : ''}
        <span class="score-value">${scoreText(axis)}</span></div>
        <div class="score-track" aria-hidden="true">
          ${Array.from({length:5},(_,i) => i < axis.score ? '<span class="filled"></span>' : '<span></span>').join('')}
        </div>
      </li>`).join('')}
    </ul>`;
  }

  function radarFigure(result, id) {
    const businessAxes = result.map.filter(axis => axis.key !== 'ai');
    return `<figure id="${id}">
      <canvas class="score-radar" width="960" height="700" role="img"
        aria-label="五环雷达图，${html(businessAxes.map(axis => axis.label + ' ' + scoreText(axis)).join('，'))}"></canvas>
    </figure>`;
  }

  function diagnosticCharts(result) {
    return `<div class="diagnostic-charts">
        <div>${scoreBars(result,'score-bars',true)}</div>
        ${radarFigure(result,'score-radar')}
      </div>`;
  }

  function radarAxes(result) {
    const priorities = diagnosticTiming(result);
    return result.map.filter(axis => axis.key !== 'ai').map(axis => ({...axis,isPriority:priorities.has(axis.key)}));
  }

  function diagnosticMap(result) {
    return `<section class="card diagnostic-map" aria-labelledby="diagnostic-map-title">
      <h3 id="diagnostic-map-title">经营诊断图谱</h3>
      ${diagnosticCharts(result)}
      ${result.stage === 'scale' ? '<p class="note">图谱的分数来自主业务。新增收入模式的优先事项根据实际试点反馈判断。</p>' : ''}
      <p class="note">${html(scoreBasis)}</p>
      <div class="closure-check">
        <h4>完成 0→1 的两个门槛</h4>
        <p>相似客户能稳定拿到约定结果，相近的获客方式也能重复带来真实付费，两项都落实才算完成 0→1。</p>
        <ul>${result.closure.map(item => `<li><div><strong>${html(item.label)}</strong>${statusBadge(item)}</div><p>${html(item.evidence)}</p></li>`).join('')}</ul>
      </div>
    </section>`;
  }

  function reportAppendix(result) {
    if (!result.map.length && !result.evidence?.length) return '';
    return `<section class="card report-appendix" id="report-appendix" aria-labelledby="report-appendix-title">
      <h3 id="report-appendix-title">附录：分数依据与原始回答</h3>
      <details class="evidence-more"><summary>展开核对各项分数依据和原始回答</summary>
        ${result.map.length ? summaryRows(result.map.map(axis => [axis.label + ' · ' + scoreText(axis),axis.explanation])) : ''}
        ${evidenceList(result.evidence)}
      </details>
    </section>`;
  }

  function drawReportRadar() {
    const charts = app.querySelectorAll('.score-radar');
    if (!charts.length) return;
    const axes = radarAxes(state.result);
    charts.forEach(canvas => drawRadar(canvas,axes));
  }

  function scheduleAttributes(item) {
    return {current:'data-current',parallel:'data-parallel',deferred:'data-deferred'}[item.schedule] || '';
  }

  function reportPriorityRole() {
    return '';
  }

  function reportSummaryPriorities(result) {
    const items = priorityItems(result);
    if (!items.length) return '';
    return `<ul class="summary-priorities" aria-label="本轮优先环节">${items.map(item => `<li>
      <span class="diagnostic-priority">${html(item.timing)}</span>
      <strong>${html(item.label)}</strong>
    </li>`).join('')}</ul>`;
  }

  function pathReasonLabel(item) {
    return {current:'为什么先做',parallel:'为什么并行',deferred:'为什么排在后面'}[item.schedule] || '为什么这样安排';
  }

  function reportPath(result) {
    const renderItem = item => {
      const axis = result.map.find(axis => axis.key === item.key);
      return `<li ${scheduleAttributes(item)}>
      <div class="path-item-heading"><h4>${html(item.label)}</h4><span class="path-timing">${html(item.timing)}</span></div>
      <div class="path-detail">
        <h5>${pathReasonLabel(item)}</h5>
        <p>${html(item.relationship)}</p>
        <h5>怎么做</h5>
        <p>${html(item.action)}</p>
      </div>
      <div class="path-links">
        <h5>与其他环节的关系</h5>
        ${summaryRows(item.links.filter(([label]) => label !== 'AI 提效'))}
      </div>
      <div class="path-score">
        <span data-score-band="${scoreBand(axis.score)}">当前 <strong>${scoreText(axis)}</strong></span>
        <p><strong>5 分标准</strong> ${html(item.fullScore)}</p>
      </div>
    </li>`;
    };
    return `<section class="report-path" aria-labelledby="report-path-title">
      <h3 id="report-path-title">五环行动计划</h3>
      <ol class="path-list">${result.path.filter(item => item.key !== 'ai').map(renderItem).join('')}</ol>
    </section>`;
  }

  function mainExecution(result) {
    return `
      <p>${html(result.action)}</p>
      <ol class="action-steps">${result.steps.map(([label,detail]) => `<li><h5>${html(label)}</h5><p>${html(detail)}</p></li>`).join('')}</ol>
      <div class="report-check"><h5>做到什么算有进展</h5><p>${html(result.check)}</p></div>
      ${result.next ? `<p class="report-next">${html(result.next)}</p>` : ''}`;
  }

  function reportAi(result) {
    const ai = result.ai;
    return `<section class="card report-ai" ${ai.primary ? 'data-current' : ''} aria-labelledby="report-ai-title">
      <header class="report-ai-heading"><h3 id="report-ai-title">AI 提效</h3>
        <span class="path-timing">${html(ai.timing)}</span>
        <span class="ai-score-pill" data-score-band="${scoreBand(ai.axis.score)}">当前进度 <strong>${scoreText(ai.axis)}</strong></span>
      </header>
      <div class="report-ai-overview">
        <div class="ai-verdict-box">
          <h4>你现在需要用 AI 提效吗？</h4>
          <p class="ai-verdict-headline">${html(ai.verdict.need)}</p>
          <p>${html(ai.verdict.summary)}</p>
          <p class="note"><strong>现状判断：</strong>${html(ai.axis.explanation)}${ai.impact ? ' 这次卡在：' + html(ai.impact) + '。' : ''}</p>
        </div>
        <div class="ai-try-box">
          <h4>你可以先从这个尝试开始</h4>
          ${ai.primary ? `<p><strong>为什么优先做：</strong>${html(result.reason)}</p>${mainExecution(result)}` : `<p class="ai-try-lead">${html(ai.task)}</p><p class="note"><strong>做到什么算有效：</strong>${html(ai.fullScore)}</p>`}
        </div>
      </div>
    </section>`;
  }

  function executionTarget(key) {
    return key === 'ai' ? 'report-ai-title' : 'execution-' + key;
  }

  function reportExecution(result) {
    const items = result.path.filter(item => item.key !== 'ai');
    const flowBar = items.length ? `<ol class="execution-flow" aria-label="五环先后顺序">${items.map((item,index) => `
      <li ${scheduleAttributes(item)}>
        <a href="#${executionTarget(item.key)}" class="flow-node">
          <span class="flow-num">${index + 1}</span>
          <strong class="flow-label">${html(item.label)}</strong>
          <span class="flow-timing">${html(item.timing)}</span>
        </a>
      </li>`).join('')}</ol>` : '';
    const executionItem = (item,index) => `<li class="execution-item" ${scheduleAttributes(item)} id="${executionTarget(item.key)}">
      <div class="execution-heading"><span class="execution-number" aria-hidden="true">${index + 1}</span>
        <h4>${html(item.label)}</h4><span class="path-timing">${html(item.timing)}</span></div>
      <div class="execution-body">${item.key === result.priorityAxis ? mainExecution(result) : `<p>${html(item.action)}</p>`}</div>
    </li>`;
    return `<section class="card report-execution" aria-labelledby="report-execution-title">
      <h3 id="report-execution-title">现在怎么做</h3>
      ${flowBar}
      ${result.priorityAxis ? '' : `<div class="execution-item" data-current><h4>${html(result.title)}</h4>${mainExecution(result)}</div>`}
      ${items.length ? `<ol class="execution-list" aria-label="按五环业务流程排列">${items.map(executionItem).join('')}</ol>` : ''}
    </section>`;
  }

  function report() {
    const r = state.result;
    const a = state.snapshot;
    const note = a.task || a.context || (r.stage === 'scale' ? a.newMode : '');
    const headline = r.stageLabel || (r.stage === 'work' ? '工作诊断' : '');
    const voyage = activeVoyage(r);
    return `<article class="narrow report">
      <section class="card summary" aria-labelledby="page-title">
        <div class="summary-lead">
          <h1 class="page-title" tabindex="-1" id="page-title">诊断总结</h1>
          <h2 class="summary-conclusion">${html(r.title)}</h2>
          ${reportSummaryPriorities(r)}
          ${note ? `<p class="result-context">${html(note)}</p>` : ''}
        </div>
        <div class="summary-aside">
          <p class="summary-label">当前阶段</p>
          <div class="result-meta"><span class="stage-tag">${html((r.provisional ? '暂按 ' : '') + headline)}</span><span>${html(r.progress)}</span></div>
        </div>
      </section>
      <nav class="report-contents" aria-label="报告目录">
        ${r.map.length ? '<a href="#diagnostic-map-title">查看评分</a><a href="#report-path-title">五环行动</a>' : ''}
        <a href="#report-execution-title">执行步骤</a>
        ${r.ai ? '<a href="#report-ai-title">AI 提效</a>' : ''}
        ${voyage ? '<a href="#voyage-form">上船卡</a>' : ''}
        ${r.map.length || r.evidence?.length ? '<a href="#report-appendix">分数依据附录</a>' : ''}
        <a href="#report-download">下载报告</a>
      </nav>
      <section class="report-detail" aria-labelledby="report-detail-title">
      <h2 id="report-detail-title" class="sr-only">诊断详细报告</h2>
        ${r.map.length ? `<div class="report-overview">${stageOverview(r)}${diagnosticMap(r)}</div>` : ''}
        ${r.map.length ? reportPath(r) : ''}
        ${reportExecution(r)}
        ${r.ai ? reportAi(r) : ''}
      </section>
      ${voyage ? renderCard(voyage) : ''}
      ${reportAppendix(r)}
      <div class="actions report-actions" id="report-download">
        ${button('下载完整诊断报告','download','primary')}
        ${button('重新开始','restart')}
      </div>
      ${state.receipt?.preview ? '<p class="note save-hint">本地试用 · 可下载本次结果。</p>' : ''}
    </article>`;
  }

  function operation() {
    if (state.screen === 'loading') {
      const status = transport.live ? '正在保存你的答卷并整理诊断报告，生成大约需要几秒钟，请耐心等待，不要关闭或刷新网页。' : '正在整理诊断报告，生成大约需要几秒钟，请耐心等待，不要关闭或刷新网页。';
      return `<section class="card narrow operation" aria-labelledby="page-title">
        <span class="operation-spinner" aria-hidden="true"></span>
        <h1 class="page-title" tabindex="-1" id="page-title">正在生成诊断报告</h1>
        <p id="report-save-status" role="status">${status}</p>
        <p class="operation-stay-tip">请保持当前页面打开，生成完成后会自动展示完整报告。</p>
        <ol class="operation-steps"><li>核对经营阶段</li><li>找出本轮优先事项</li><li>整理下一步行动</li></ol>
      </section>`;
    }
    const copy = {
      offline:['网络已断开','答卷还在。连上网络后可以重试，也可以先下载报告。'],
      rejected:['这份答卷暂时无法保存','答卷还在。可以返回检查填写内容，或先下载报告。'],
      notConfigured:['提交暂时不可用','答卷还在。你可以先下载报告。'],
      interrupted:['上次提交尚未确认','已恢复上次答卷。可以继续保存，也可以先下载报告。'],
      generation:['暂时没能生成诊断报告','答卷还在。可以再生成一次，也可以返回检查填写内容。'],
      unconfirmed:['暂未确认保存成功','答卷还在。可以重试保存，也可以先下载报告。']
    }[state.failure];
    const canDownload = state.record && state.result;
    return `<section class="card narrow operation" aria-labelledby="page-title">
      <h1 class="page-title" tabindex="-1" id="page-title">${copy[0]}</h1><p>${copy[1]}</p>
      ${canDownload ? `<p class="note">报告编号 · ${html(state.record.submission_id)}</p>` : ''}
      <div class="actions">
        ${['rejected','notConfigured'].includes(state.failure) ? '' : button(canDownload ? '重试保存' : '重新生成报告','retry','primary')}
        ${canDownload ? button('下载完整诊断报告','download') : ''}
        ${button('返回修改','edit',['rejected','notConfigured'].includes(state.failure) ? 'primary' : '')}
      </div>
    </section>`;
  }

  function render(screen) {
    clearVoyagePreview();
    state.screen = screen;
    app.innerHTML = screen === 'home' ? home() : screen === 'report' ? report()
      : ['error','loading'].includes(screen) ? operation() : formScreen();
    if (screen === 'report') drawReportRadar();
    app.querySelector('#page-title')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
    if (screen !== 'loading') rememberSession();
  }

  function clearPending() {
    try { sessionStorage.removeItem(pendingKey); } catch {}
  }

  function restoreScreen() {
    try {
      const pending = JSON.parse(sessionStorage.getItem(pendingKey));
      if (!pending || typeof pending !== 'object') return 'home';
      if (pending.record?.submission_id && pending.snapshot) {
        state.snapshot = pending.snapshot;
        state.result = describeDiagnosis(state.snapshot,diagnose(state.snapshot));
        state.record = pending.record;
        const receipt = pending.receipt;
        const matches = receipt?.ok === true && typeof receipt.record_id === 'string' && receipt.record_id.trim()
          && (receipt.submission_id === state.record.submission_id
            || !transport.live && receipt.preview && receipt.record_id === 'preview-' + state.record.submission_id);
        state.receipt = matches ? receipt : null;
      }
      state.answers = {...(pending.answers || state.snapshot)};
      state.reviewEditing = Boolean(pending.reviewEditing);
      state.profileOpen = Boolean(pending.profileOpen);
      if (pending.screen === 'home') return 'home';
      if (stepOrder.includes(pending.screen)) {
        const preceding = stepOrder.slice(0,stepOrder.indexOf(pending.screen));
        return firstIncompleteStep(preceding) || pending.screen;
      }
      if (pending.screen === 'report' && state.receipt) return 'report';
      if (state.record) {
        state.failure = ['rejected','notConfigured','offline','unconfirmed'].includes(pending.failure) ? pending.failure : 'interrupted';
        return 'error';
      }
      return Object.keys(state.answers).length ? 'issue' : 'home';
    } catch {
      reset();
      return 'home';
    }
  }

  function rememberSession() {
    if (state.screen === 'home' && !Object.keys(state.answers).length) return;
    const {screen,answers,snapshot,record,receipt,failure,reviewEditing,profileOpen} = state;
    try { sessionStorage.setItem(pendingKey,JSON.stringify({screen,answers,snapshot,record,receipt,failure,reviewEditing,profileOpen})); } catch {}
  }

  function reset() {
    clearPending();
    Object.assign(state,{ answers:{}, record:null, result:null, snapshot:null, receipt:null, failure:null, reviewEditing:false, profileOpen:false });
  }

  async function saveReport(retry = false) {
    if (state.screen === 'loading') return;
    render('loading');
    let slowMessage;
    try {
      const latest = retry && state.record ? state.snapshot : snapshot();
      if (!state.record || JSON.stringify(latest) !== JSON.stringify(state.snapshot)) {
        state.record = null;
        state.result = null;
        state.receipt = null;
        state.snapshot = latest;
        state.result = describeDiagnosis(state.snapshot,diagnose(state.snapshot));
        state.record = transport.prepare(state.snapshot,state.result,activeVoyage(state.result));
      }
      if (state.receipt) {
        render('report');
        return;
      }
      state.failure = null;
      rememberSession();
      const wait = 3000 + Math.floor(Math.random() * 12001);
      slowMessage = setTimeout(() => {
        app.querySelector('#report-save-status').textContent = '保存比平时慢一些。答卷还在，请稍等。';
      },18000);
      const minimumWait = new Promise(resolve => setTimeout(resolve,wait));
      [state.receipt] = await Promise.all([transport.submit(state.record),minimumWait]);
      render('report');
    } catch (error) {
      state.failure = state.record ? (['offline','rejected','unconfirmed','notConfigured'].includes(error.code) ? error.code : 'unconfirmed') : 'generation';
      render('error');
    } finally {
      clearTimeout(slowMessage);
    }
  }

  function markdownAnswers(answers, submitted) {
    const sections = stepOrder.flatMap((screen,index) => {
      const rows = activeFields(screen,answers).flatMap(field => {
        const entry = submitted?.[field.id];
        const value = entry?.value ?? answerText(field,answers);
        const extra = entry?.extra ?? answers[field.extraKey];
        return [
          [entry?.label || field.label,Array.isArray(value) ? value.join('、') : value],
          ...(field.extraKey && extra ? [[field.extra,extra]] : [])
        ].filter(([,answer]) => string(answer));
      });
      if (!rows.length) return [];
      return ['### ' + stepLabels[index], '',
        ...rows.flatMap(([label,value]) => [
          '**' + md(label) + '**', '',
          ...String(value).split(/\r\n|\r|\n/).map(line =>
            '> ' + md(line).replace(/([#!~+.=-])/g, '\\$1')),
          ''
        ])];
    });
    return sections.length ? ['## 用户填写数据', '', ...sections] : [];
  }

  function markdown(voyage = null) {
    const r = state.result;
    const a = state.snapshot;
    const businessPath = r.path.filter(item => item.key !== 'ai');
    const priorities = priorityItems(r);
    const timingText = item => item.timing + (priorities.length > 1 && item.role ? ' · ' + item.role : '');
    const mainTask = [md(r.action), '',
      ...r.steps.map(([label,detail],i) => (i + 1) + '. **' + md(label) + '** ' + md(detail)),
      '', '验收 · ' + md(r.check), ...(r.next ? ['',md(r.next)] : [])];
    const ai = r.ai;
    const aiPriority = priorities.find(item => item.key === 'ai');
    const aiNotes = ai ? ['### AI 提效 · ' + md(aiPriority ? timingText(aiPriority) : ai.timing), '',
      '当前 · ' + md(scoreText(ai.axis)) + '。' + md(ai.axis.explanation),
      ...(ai.impact ? ['这次卡在 · ' + md(ai.impact)] : []),
      '5 分标准 · ' + md(ai.fullScore), '',
      '#### 优先做什么', '', ...(ai.primary ? ['为什么先做 · ' + md(r.reason),'',...mainTask] : [md(ai.task)]), ''] : [];
    const lines = [
      '# 一人公司商业闭环诊断', '',
      '报告编号 · ' + state.record.submission_id,
      '生成时间 · ' + new Date(state.record.timestamp).toLocaleString('zh-CN'),
      '当前阶段 · ' + (r.provisional ? '暂按 ' : '') + (r.stageLabel || '独立工作') + ' · ' + r.progress,
      '本次问题 · ' + md(r.selected), ''
    ];
    if (a.context || a.task || a.newMode) lines.push('本次情境 · ' + md(a.task || a.context || a.newMode), '');
    lines.push('## 诊断总结', '', md(r.title), '');
    if (priorities.length) lines.push(priorityOverview(r).map(md).join(' · '),'');
    lines.push('## 诊断详细报告', '');
    if (r.map.length) {
      const timingByKey = diagnosticTiming(r);
      lines.push('### 经营阶段定位', '', ...businessStages.map(item =>
        '- ' + item.label + ' · ' + item.title + (item.key === r.stage ? r.provisional ? ' · 暂按此阶段' : ' · 当前阶段' : '') + '。' + item.boundary), '',
        '### 经营诊断图谱', '',
        ...r.map.map(axis =>
        '- ' + md(axis.label + (axis.key === 'ai' ? ' · 贯穿五环' : '')) + ' · ' + md(scoreText(axis)) +
        (timingByKey.has(axis.key) ? ' · ' + md(timingByKey.get(axis.key)) : '') + '。' + md(axis.explanation)), '',
        '**本轮行动** · ' + md(r.title), '', md(scoreBasis), '',
        '### 完成 0→1 的两个门槛', '', ...r.closure.map(item =>
          '- ' + md(item.label) + ' · ' + md(item.statusLabel) + '。' + md(item.evidence)), '');
      if (r.stage === 'scale') lines.push('图谱分数来自主业务，新增收入模式的优先事项根据试点反馈判断。','');
      lines.push('### 五环行动计划', '', ...businessPath.flatMap(item => [
        '- **' + md(item.label) + ' · ' + md(timingText(item)) + '**',
        '  - ' + pathReasonLabel(item) + ' · ' + md(item.relationship),
        '  - 怎么做 · ' + md(item.action),
        '  - 当前 · ' + md(scoreText(r.map.find(axis => axis.key === item.key))),
        '  - 5 分标准 · ' + md(item.fullScore),
        ...item.links.filter(([label]) => label !== 'AI 提效').map(([label,detail]) => '  - 与' + md(label) + '的关系 · ' + md(detail))
      ]), '');
    }
    lines.push('### 现在怎么做', '');
    if (!r.priorityAxis) lines.push('#### ' + md(r.title), '', ...mainTask, '');
    for (const [index,item] of businessPath.entries()) {
      lines.push('#### ' + (index + 1) + ' ' + md(item.label) + ' · ' + md(timingText(item)), '',
        ...(item.key === r.priorityAxis ? mainTask : [md(item.action)]), '');
    }
    lines.push(...aiNotes);
    const boarding = activeVoyage(r);
    if (boarding) {
      const details = voyageCardDetails(r,boarding);
      lines.push(voyage ? '## ' + md(voyageCardTitle) : '## 上船前的诊断基线', '', '当前阶段 · ' + md(details.stage), '');
      if (r.map.length) lines.push('### 上船前评分', '', ...r.map.map(axis => '- ' + md(axis.label) + ' · ' + md(scoreText(axis))), '');
      if (details.business.length) lines.push('### 业务环行动', '', ...details.business.map(([label,value]) => '- ' + md(label) + ' · ' + md(value)), '');
      lines.push('### 航海任务', '', ...details.boarding.map(([label,value]) => '- ' + md(label) + ' · ' + md(value)), '');
      if (details.ai.length) lines.push('### AI 提效行动', '', ...details.ai.map(([label,value]) => '- ' + md(label) + ' · ' + md(value)), '');
      if (voyage) {
        lines.push('姓名 · ' + md(voyage.name), '基线日期 · ' + md(voyage.baselineDate));
        if (voyage.problem) lines.push('最担心或仍有疑问的问题 · ' + md(voyage.problem));
        lines.push('', '先保存这张卡，开船时提交。三个月后用同样的标准比较五环业务和 AI 提效得分。');
      }
    }
    lines.push(...markdownAnswers(a,state.record.answer_details));
    return lines.join('\n') + '\n';
  }

  function download() {
    if (!state.record) return;
    const url = URL.createObjectURL(new Blob([markdown(voyagePreview?.values)], {type:'text/markdown;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = '一人公司商业闭环诊断-' + state.record.submission_id + '.md';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  function clearVoyagePreview() {
    if (!voyagePreview) return;
    URL.revokeObjectURL(voyagePreview.url);
    voyagePreview = null;
  }

  async function generateVoyage(form) {
    const voyage = activeVoyage(state.result);
    if (!voyage || form.dataset.generating) return;
    const input = new FormData(form);
    const values = Object.fromEntries(Array.from(input,([key,value]) => [key,string(value)]));
    const status = form.querySelector('#voyage-status');
    if (!values.name) {
      status.textContent = '请填写用于上船卡的名字。';
      form.elements.namedItem('name').focus();
      return;
    }
    values.baselineDate = new Intl.DateTimeFormat('zh-CN',{
      timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'
    }).format(new Date(state.record.timestamp));
    const submit = form.querySelector('button[type=submit]');
    form.dataset.generating = 'true';
    submit.disabled = true;
    const output = form.nextElementSibling;
    output.hidden = true;
    clearVoyagePreview();
    status.textContent = '正在生成上船卡预览…';
    try {
      const blob = await voyageImage(state.result,voyage,{...values,reference:state.record.submission_id});
      if (!form.isConnected || [...input].some(([name,value]) => form.elements.namedItem(name).value !== value)) return;
      const imageLink = output.querySelector('#voyage-png');
      voyagePreview = {values,url:URL.createObjectURL(blob)};
      imageLink.href = voyagePreview.url;
      imageLink.download = voyageCardTitle + '-' + state.record.submission_id + '.png';
      output.querySelector('img').src = voyagePreview.url;
      output.hidden = false;
      status.textContent = '预览已生成。请核对图片后再下载。';
      output.querySelector('#voyage-preview-title').focus();
    } catch {
      if (form.isConnected) status.textContent = '生成失败，请再试一次。';
    } finally {
      delete form.dataset.generating;
      submit.disabled = false;
    }
  }

  window.addEventListener('qiaoboosi:themechange',drawReportRadar);

  app.addEventListener('toggle', event => {
    if (event.target.matches('.profile-fields')) {
      state.profileOpen = event.target.open;
      rememberSession();
    }
  },true);

  app.addEventListener('input', event => {
    const control = event.target;
    if (control.form?.id === 'quiz' && ['text','textarea'].includes(control.type)) {
      state.answers[control.name] = control.value;
      if (control.getAttribute('aria-invalid') === 'true' && string(control.value)) {
        control.removeAttribute('aria-invalid');
        control.removeAttribute('aria-describedby');
        app.querySelector('#error').textContent = '';
      }
      updateQuestionProgress();
      rememberSession();
    }
    const form = control.form;
    if (form?.id === 'voyage-form' && (voyagePreview || form.dataset.generating)) {
      form.nextElementSibling.hidden = true;
      clearVoyagePreview();
      form.querySelector('#voyage-status').textContent = '信息已修改，请重新生成预览。';
    }
  });

  app.addEventListener('change', event => {
    const control = event.target;
    if (control.form?.id !== 'quiz' || !['radio','checkbox'].includes(control.type)) return;
    const error = app.querySelector('#error');
    const key = control.name;
    const group = control.closest('fieldset[data-field]');
    const invalid = group.querySelector('[aria-invalid]');
    invalid?.removeAttribute('aria-invalid');
    invalid?.removeAttribute('aria-describedby');
    if (!app.querySelector('[aria-invalid]')) error.textContent = '';
    if (control.type === 'checkbox') {
      const choices = [...group.querySelectorAll('input:checked')].map(node => node.value);
      if (group.dataset.max && choices.length > Number(group.dataset.max)) {
        control.checked = false;
        error.textContent = '此题最多选择 ' + group.dataset.max + ' 项。';
        return;
      }
      state.answers[key] = choices;
    } else {
      if (state.answers[key] !== control.value) {
        const children = {
          direction:['directionCheck','experience'], demand:['directionCheck','experience'],
          marketCeiling:['forecastDecision'], marketCycle:['forecastDecision'], marketEntry:['forecastDecision'],
          offer:['fulfillment','repeatDelivery','sale','reply','quoteDate','stagePayment'],
          delivery:['deliveryProof','fulfillment','repeatDelivery','sale','reply','quoteDate','stagePayment'],
          acquisition:['acquisitionProof','repeatDelivery','sale','reply','quoteDate','stagePayment'],
          acquisitionProof:['repeatDelivery'],
          stagePayment:['fulfillment','repeatDelivery','reply','quoteDate','aiImpact'],
          aiUse:['aiImpact'],
          expansion:['newMode','expansionEvidence','operations'],
          repeatDelivery:['sale','reply','quoteDate'], sale:['reply','quoteDate','stagePayment'], reply:['quoteDate']
        }[key] || [];
        children.forEach(id => { delete state.answers[id]; });
      }
      state.answers[key] = control.value;
    }
    discardHiddenFollowUps();
    if (group?.querySelector('.extra-field')) {
      const choice = state.answers[key];
      group.querySelector('.extra-field').hidden = !(Array.isArray(choice) ? choice.includes('其他') : choice === '其他');
      if (group.querySelector('.extra-field').hidden) {
        const extra = group.querySelector('.extra-field input');
        extra.value = '';
        delete state.answers[extra.name];
      }
    }
    if (state.screen !== 'confirm') syncFields();
    updateQuestionProgress();
    rememberSession();
  });

  app.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.id === 'voyage-form') {
      void generateVoyage(event.target);
      return;
    }
    if (event.target.id !== 'quiz') return;
    const screen = state.screen;
    const a = state.answers;
    const error = document.getElementById('error');
    const missing = activeFields(screen,a).find(item => item.required !== false && !fieldComplete(item));
    if (missing) {
      error.textContent = '请先回答「' + missing.label + '」';
      const control = app.querySelector('[data-field="' + missing.id + '"] :is(input,textarea)');
      control?.setAttribute('aria-invalid','true');
      control?.setAttribute('aria-describedby','error');
      control?.focus();
      return;
    }
    if (screen === 'confirm') {
      const incomplete = firstIncompleteStep(['issue','stage','evidence']);
      if (incomplete) {
        state.reviewEditing = true;
        render(incomplete);
        return;
      }
    }
    if (state.reviewEditing && screen !== 'confirm') {
      const nextRequired = firstIncompleteStep(['issue','stage','evidence']);
      if (!nextRequired) state.reviewEditing = false;
      render(nextRequired || 'confirm');
      return;
    }
    switch (screen) {
      case 'issue': render('stage'); break;
      case 'stage': render(evidenceFields(a).length ? 'evidence' : 'profile'); break;
      case 'evidence': render('profile'); break;
      case 'profile': render('confirm'); break;
      case 'confirm': void saveReport(); break;
    }
  });

  document.addEventListener('click', event => {
    if (state.screen === 'loading' && event.target.closest('a[href]')) {
      event.preventDefault();
      return;
    }
    const trigger = event.target.closest('button[data-action]');
    if (!trigger || state.screen === 'loading') return;
    const action = trigger.dataset.action;
    if (state.screen === 'confirm' && action.startsWith('review-')) {
      state.reviewEditing = true;
      if (action === 'review-profile') state.profileOpen = true;
      render(action.slice('review-'.length));
      return;
    }
    switch (action) {
      case 'start': render('issue'); break;
      case 'restart': reset(); render('issue'); break;
      case 'back': {
        const steps = surveySteps(state.answers);
        render(steps[steps.indexOf(state.screen) - 1] || 'home');
        break;
      }
      case 'retry': void saveReport(true); break;
      case 'download': download(); break;
      case 'edit': render(state.screen === 'error' ? 'confirm' : 'issue'); break;
    }
  });

  const restored = restoreScreen();
  if (restored !== 'home') render(restored);
  else {
    app.innerHTML = home();
  }
})();
