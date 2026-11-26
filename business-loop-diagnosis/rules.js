(() => {
  const api = window.ClosedLoop;
  const { questions:q, issueLabels, stageLabels, isWork, independent, recentlyPaid } = api;
  const fact = (id, a) => q[id]?.options?.[a[id]] || '';
  const known = value => Boolean(value && value !== 'unknown');
  const validContext = value => String(value || '').trim();
  const newModel = a => ['testing','running'].includes(a.expansion);
  const steadyDelivery = a => a.delivery === 'steady' && a.deliveryProof === 'consistent';
  const steadyAcquisition = a => a.acquisition === 'steady' && a.acquisitionProof === 'repeat';
  const userScenarioGap = a => ['none','broad'].includes(a.userScenario);
  const hasDemand = a => ['concrete','trial','used'].includes(a.demand);
  const isSalesIssue = a => ['reach','sales'].includes(a.issue);
  const isQuote = a => a.sale === 'quoted' && isSalesIssue(a);
  const knownUnstableAcquisition = a => ['none','occasional','leads'].includes(a.acquisition)
    || a.acquisition === 'steady' && a.acquisitionProof === 'incidental';
  const businessSurvey = a => !a.issue && !independent(a);
  const directionSet = a => ['defined','tested'].includes(a.direction);
  const forecastTopics = [['marketCeiling','市场天花板'],['marketCycle','机会窗口'],['marketEntry','竞争壁垒']];
  const forecastFields = forecastTopics.map(([key]) => q[key]);
  const businessFields = [q.direction,...forecastFields,q.userScenario,q.demand,q.offer,q.delivery,q.acquisition,q.aiUse];
  const startedForecast = a => forecastTopics.some(([key]) => known(a[key]) && !['none','noTarget'].includes(a[key]));
  const marketToAssess = a => directionSet(a) || ['trial','used'].includes(a.demand)
    || ['trial','working','completed','steady'].includes(a.delivery);
  const forecastSubject = a => marketToAssess(a) || startedForecast(a);
  const documented = new Set(['clear','viable','limited','blocked','inconclusive','evidence']);
  const forecastRules = [
    ['换方向','有可核对的硬伤就先暂停新增投入，回到选方向。已经承诺的交付按约完成。'],
    ['暂缓、先补证','还需要核对市场证据或投入条件时，补齐再决定。'],
    ['小规模验证','三项都有明确依据，至少一项只支持有限机会。用小测试验证那项限制，再决定是否加码。'],
    ['推进到选用户','三项都支持进入。用真实用户反馈继续验证付费需求。']
  ];
  const forecastScoring = '三项都没有初步判断是 0 分，至少一项有初步判断是 1 分。1～2 项有清楚且可核对的判断分别是 2～3 分。三项都已有明确判断时，先补证据是 4 分，已有推进、小试或换方向的决定是 5 分。';

  function assessForecast(a) {
    const checks = forecastTopics.map(([id,label]) => ({id,label,value:a[id]}));
    const pendingChecks = checks.filter(row => !['clear','viable','limited','blocked'].includes(row.value));
    const evidence = checks.filter(row => documented.has(row.value)).length;
    const names = rows => rows.map(row => row.label).join('、');
    const result = (decision,label,reason) => ({decision,label,reason,rules:forecastRules,scoring:forecastScoring,evidence,
      unresolved:pendingChecks});
    const proposed = a.forecastDecision;
    const clearChecks = checks.filter(row => row.value === 'clear');
    const hasClearAnswer = clearChecks.length > 0;
    const incomeNext = a.marketCeiling === 'noTarget' ? '先写下自己的收入目标，再估算这个方向能带来多少收入。' : '';
    const useStoredDecision = hasClearAnswer || checks.some(row => row.value === 'evidence');
    if (!forecastSubject(a)) return result('direction','先定方向','你还没选定要预判的方向，三项市场调查都还没开始。先写清服务谁、在什么场景给出什么结果，再开始预判。');
    const barriers = checks.filter(row => row.value === 'blocked');
    if (barriers.length || useStoredDecision && proposed === 'stop') {
      const reason = barriers.length ? names(barriers) + '已有明确硬伤。'
        : clearChecks.length ? '你在核对' + names(clearChecks) + '后，确认存在一项会让原方向做不下去的限制。'
        : '你已确认原方向存在难以跨过的市场限制。';
      return result('stop','换方向',reason + '先暂停新增投入，换一个候选再预判。');
    }
    if (!startedForecast(a)) return result('unstarted','还没开始预判',incomeNext || '你的市场天花板、机会窗口和竞争壁垒三项还没有初步判断。先选定同一个候选或现有业务，逐项核对后再决定投入方式。');
    if (useStoredDecision && evidence === checks.length && ['advance','limited'].includes(proposed)) {
      return proposed === 'limited'
        ? result('limited','小规模验证','三项已有可核对的判断，你选择先小试。明确测试规模、要验证的条件和什么时候停止，再决定是否加码。')
        : result('advance','推进到选用户','三项已有可核对的判断，你选择推进。接下来验证真实用户的付费需求。');
    }
    if (pendingChecks.length) return result('hold','暂缓、先补证','还需要核对' + names(pendingChecks) + '，才能判断是否值得新增投入。' + incomeNext);
    if (hasClearAnswer) return result('hold','暂缓、先补证','三项已有初步结论。先复核最可能改变投入决定的那条依据，再继续。');
    const limits = checks.filter(row => row.value === 'limited');
    if (limits.length) return result('limited','小规模验证',names(limits) + '有依据支持小切口。先做可停止的小测试，观察这一条件能否成立。');
    return result('advance','推进到选用户','市场空间能覆盖目标，窗口足以验证和回收投入，也已有可进入的客户切口。接下来验证真实用户的付费需求。');
  }

  const forecastBlocked = a => assessForecast(a).decision === 'stop';
  const forecastReady = a => ['advance','limited'].includes(assessForecast(a).decision);
  const conflictingPayment = a => ['idea','trial'].includes(a.delivery)
    && (['steady','occasional'].includes(a.acquisition) || a.sale === 'paid');
  function resolvedOperatingAnswers(a) {
    if (!conflictingPayment(a)) return a;
    if (a.stagePayment === 'unpaid') {
      return {...a,acquisition:'none',acquisitionProof:undefined,sale:undefined};
    }
    const delivery = {paid:'working',completed:'completed'}[a.stagePayment];
    return delivery ? {...a,delivery} : a;
  }
  const outstandingDelivery = a => a.fulfillment === 'dispute'
    || a.delivery === 'working' && a.fulfillment !== 'accepted';
  const completedWithUnstableAcquisition = a => a.delivery === 'completed' && knownUnstableAcquisition(a);
  const repeatDeliveryCheck = a => completedWithUnstableAcquisition(a) && a.offer !== 'clear';

  const topics = {
    direction: { name:'找方向', material:'整理一段做过的真实经历，列出你想比较的方向和各自的依据。', output:'选定一条值得进一步做市场预判、验证真实用户需求的方向，写清服务谁、在哪个场景解决什么问题。', guide:['从职业经验找到可试方向','career-to-business'] },
    forecast: { name:'做预判', material:'一个候选方向，以及能回查的市场和竞争资料。', output:'一页预判，写清市场天花板、生命周期、竞争壁垒，以及推进、小试、暂缓或换方向的依据。', guide:['一人公司起步指南','start'] },
    demand: { name:'找需求', material:'一份设想或草稿，以及一位能联系的目标用户。', output:'一份真实场景访谈记录，以及下一条需要验证的需求。', guide:['验证需求的方法','validate-demand'] },
    product: { name:'做产品', material:'一份需求记录、试用材料，或发生返工的交付样例。', output:'一份范围、分工与验收清楚的最小交付。', guide:['写出可出售的小服务','small-service-template'] },
    sales: { name:'卖产品', material:'一份服务说明、一段咨询或报价记录，或上一单的获客经过。', output:'一次面向合适客户的真实邀约、报价或跟进，以及对方的回应。', guide:['找到你的第一批客户','first-customers'] },
    review: { name:'复盘总结', material:'一轮触达、报价、交付或放弃的记录。', output:'一项值得保留或调整的做法，以及下一轮要测试的变量。', guide:['整理真实案例与证据','case-evidence'] },
    writing: { name:'AI 写作', material:'一段实际要使用的文字、一份原始素材和验收要求。', output:'一段对真实受众可用的文字和一条可复用的检查标准。', guide:['用真实任务练习 AI 工作流程','ai-workflow'] },
    research: { name:'AI 调研', material:'一个待做的决定、一份已有资料或一条来源线索。', output:'一页可回查的证据，说明哪条结果会影响判断。', guide:['用真实任务练习 AI 工作流程','ai-workflow'] },
    selfTask: { name:'自提工作任务', material:'一份真实工作材料及当前做法和耗时。', output:'一次前后对照，留下耗时、漏项和返工记录。' }
  };

  function stage(reported) {
    const a = resolvedOperatingAnswers(reported);
    const current = assessStage(a);
    if (a !== reported && current.basis) {
      current.basis = '已按你确认的实际付款和交付情况判断阶段。' + current.basis;
    }
    return current;
  }

  function assessStage(a) {
    if (independent(a)) return { key:'work', progress:'当前工作' };
    const stableDelivery = steadyDelivery(a);
    const stableAcquisition = steadyAcquisition(a);
    if (conflictingPayment(a)) {
      return { key:'unconfirmed', progress:'交易与交付证据待核', check:'核对同一项业务的真实付款和交付。你的获客回答与交付回答指向了不同进展。' };
    }
    if (!stableDelivery && (['idea','trial','working','completed'].includes(a.delivery) || a.delivery === 'steady' && a.deliveryProof === 'variable')) {
      const deliveryBasis = ['idea','trial'].includes(a.delivery)
        ? '当前业务还没有真实付费交付'
        : [fact('delivery',a),known(a.fulfillment) ? fact('fulfillment',a) : fact('deliveryProof',a)].filter(Boolean).join('，');
      const acquisitionBasis = knownUnstableAcquisition(a) ? fact('acquisitionProof',a) || fact('acquisition',a) : '';
      return { key:'early', progress:{
        idea:directionSet(a) || a.offer === 'draft' ? '已有服务设想' : '正在形成方向',
        trial:['trial','used'].includes(a.demand) ? '已有真实试用' : '已开始试水',
        working:a.fulfillment === 'accepted' ? '已有付费与交付' : '已有真实购买，正在交付',
        completed:'有过付费交付', steady:'多次交付，稳定性待改善'
      }[a.delivery], basis:[deliveryBasis,acquisitionBasis].filter(Boolean).join('。') + '。' };
    }
    if (knownUnstableAcquisition(a)) {
      return { key:'early', progress:stableDelivery ? '已能稳定交付，获客尚不稳定' : '获客尚不稳定',
        basis:stableDelivery ? '相似客户已能稳定拿到交付结果。还没看到同样的方法持续带来新付费客户。' : fact('acquisitionProof',a) || fact('acquisition',a) };
    }
    if (stableDelivery && stableAcquisition) {
      if (newModel(a) && validContext(a.newMode)) {
        return { key:'scale', progress:'稳定主业务已在验证新增收入模式',
          basis:'已有多轮相似付费客户和稳定交付，你也描述了一项正在尝试的新模式。' };
      }
      return { key:'repeat', progress:'正在经营和扩大已有模式',
        basis:'相近的获客方式已多次带来同类付费客户，交付也有稳定验收或使用反馈。' };
    }
    const acquisitionCheck = '回看最近几笔同类客户的订单，记录来源、实际付款和获客动作，核对相近动作能否重复带来新付费客户。';
    const deliveryCheck = '回看同一项业务最近几笔付费订单的交付物、验收或使用反馈，核对相似客户是否都能拿到约定结果。';
    if (stableDelivery || stableAcquisition || recentlyPaid(a) || a.sale === 'paid') {
      return {
        key:'early', provisional:true, verifyAxis:stableDelivery ? 'acquisition' : 'product',
        progress:stableDelivery ? '已能稳定交付，还没用同样的方法再找一批客户'
          : stableAcquisition ? '已能稳定获客，尚未按同一标准对照交付' : '已有付费记录，还没验证相似客户能否拿到同样的结果',
        basis:stableDelivery ? '相似客户已稳定拿到交付结果。' + (fact('acquisitionProof',a) || '下一轮复查获客能否重复。')
          : stableAcquisition ? '相似客户已多次通过相近方式成交。' + (fact('deliveryProof',a) || '下一轮复查交付结果能否重复。')
          : '已经有真实付费，先核实相似客户能不能拿到同样的结果。',
        check:stableDelivery ? acquisitionCheck : deliveryCheck
      };
    }
    return { key:'unconfirmed', progress:'经营证据待核', check:deliveryCheck };
  }

  function stageFields(a) {
    const fields = [q.delivery];
    if (a.delivery === 'steady') fields.push(q.deliveryProof);
    if (a.delivery) fields.push(q.acquisition);
    if (a.acquisition === 'steady') fields.push(q.acquisitionProof);
    if (steadyDelivery(a) && steadyAcquisition(a)) {
      fields.push(q.expansion);
      if (newModel(a)) fields.push(q.newMode);
    }
    if (a.delivery && a.acquisition) fields.push(q.stageNote);
    return fields;
  }

  function evidenceFields(a) {
    if (businessSurvey(a)) return businessFollowUps(a);
    const current = stage(a).key;
    if (current === 'work') return a.issue
      ? [q.task,q.use,q.workInput,q.workFriction,q.workNote]
      : [q.use,q.workInput,q.workFriction,q.workNote];
    if (current === 'scale') return [q.expansionRisk];
    if (current === 'repeat') return [q.optimize,q.optimizeNote];
    if (current === 'unconfirmed') return [q.record];
    if (a.delivery === 'working' || (a.issue === 'delivery' && recentlyPaid(a))) {
      return [q.fulfillment,q.record];
    }
    if (steadyDelivery(a) && knownUnstableAcquisition(a) && !['sales','review'].includes(a.issue)) {
      return [q.sale,q.record];
    }
    const fields = [q.direction];
    if (['direction','compare'].includes(a.issue) || ['none','loose'].includes(a.direction)) {
      fields.push(q.experience,q.objective);
    }
    if (['compare','forecast'].includes(a.issue) || a.direction === 'defined' && a.issue === 'other') {
      fields.push(q.risk,q.riskNote);
    }
    if (a.direction === 'defined' || ['product','demand','reach','sales','delivery','review'].includes(a.issue) || isWork(a)) {
      fields.push(q.demand,q.offer);
    }
    if (isSalesIssue(a) || a.issue === 'review' || a.offer === 'clear') {
      fields.push(q.sale);
      if (a.sale === 'quoted') {
        fields.push(q.reply);
        if (a.reply === 'date') fields.push(q.quoteDate);
      }
    }
    if (a.issue === 'execution') fields.push(q.barrier);
    if (isWork(a) && a.direction === 'defined' && (hasDemand(a) || a.offer === 'clear')) {
      fields.push(q.task,q.workInput,q.workFriction,q.workNote);
    }
    fields.push(q.record);
    return fields;
  }

  function plan(key,title,reason,action,check,next = '') {
    return { key,title,reason,action,check,next };
  }

  function reviewPlan() {
    return plan('review','从这一轮记录里找出最影响结果的一步',
      '你已经做过一轮尝试，可以把当时的选择、客户回应和实际投入放在一起看。',
      '按时间写下这轮从触达、报价到购买、拒绝或交付的经过。圈出发生变化最明显的一步。',
      '找出一条记录支持你的解释，并确定下次只调整哪一个变量。');
  }

  function workPlan(a) {
    if (a.workInput === 'none' || !known(a.workInput)) {
      return plan(null,'先找到一份能比较的真实工作材料',
        '目前还缺可直接试做的输入，先把任务缩到一段能够验收的工作。',
        '挑一份真实要用的输入，记下现在怎样做、花多久和交付给谁。',
        '能拿同一份材料比较原有做法和改进后的结果。');
    }
    const kind = a.workType || (isWork(a) ? a.issue : 'efficiency');
    const work = {
      writing:['用真实素材完成一段能使用的文字','选一小段，先写清读者、用途和必须保留的事实，再让 AI 给一版草稿。','按事实、语气和读者能否使用检查草稿，记录改到可用的时间。'],
      research:['做一页能回到出处的调研证据','选一个会改变决定的问题，用已有资料和 AI 列出证据。每条再回到原始出处检查。','能说清哪条可信证据改变了选择，以及还有什么不能判断。'],
      efficiency:['用一段真实工作验证能省下多少时间','先记录原有步骤和耗时，选一个费时环节换一种做法，用相近的材料再做一次。','比较实际耗时、漏项和返工。质量达到要求后再考虑复用。']
    }[kind];
    const topic = kind === 'efficiency' ? 'selfTask' : kind;
    return plan(topic,work[0],fact('workFriction',a) || '你带来了实际工作及可以试做的材料。',work[1],work[2]);
  }

  function repeatPlan(a) {
    const item = {
      reach:['核对哪条现有渠道能带来更多有效咨询','挑一轮可比较的获客记录，核对从这个渠道来的客户是什么情境，有多少真进入有效咨询。','用同样的方法再做一轮，记录带来了多少符合条件的咨询、花了多少时间和费用。'],
      sales:['找出从有效咨询到付款最常停住的一步','选同一批咨询，逐条核对范围、报价、最后回应和付款，把最常见的断点标出来。','给出一个最值得先改的变量，并能在下一批对话里用同口径比较。'],
      capacity:['先核对现有交付还能承接多少订单','回看最近同类订单的实际工时、返工和延期，算一遍在现有质量要求下每周能稳定接几单。','能按实际工时和返工作出一版承接量估计，再决定是否加大获客。'],
      margin:['先核对同类订单的实际单笔收益','挑一笔有代表性的订单，列出实收、外部费用和完整投入时间，检查哪一项最影响收益。','能说清优先该改哪种范围、价格或做法，并准备下一单对照。']
    }[a.optimize];
    const reason = {
      reach:'你能重复带来付费客户，但近期有效咨询不足。先核对现有渠道能否多带来匹配的咨询，再决定要不要开新渠道。',
      sales:'你已经有有效咨询，但有客户停在付款之前。先找出常见的成交断点，才能决定该改范围、报价还是跟进方式。',
      capacity:'你的近期记录显示交付时间紧或可承接量有限。先核对还能稳定接几单，再决定要不要增加获客投入。',
      margin:'你选了投入或成本压低单笔收益。先算清已有订单最花钱、最耗时的是哪一项，才能判断该改价格、范围还是做法。'
    }[a.operations];
    return plan(null,item?.[0] || '先选一个现有业务的经营问题',
      reason || '现有获客和交付已具备可重复的证据，可以集中改善同一模式下的一处表现。',
      item?.[1] || '从有效咨询、付款、交付容量和单笔收益中选一项，回看一轮真实记录。',
      item?.[2] || '找出一项下一轮能用同样标准比较的结果。');
  }

  function scalePlan(a) {
    const item = {
      demand:['先验证谁愿意为新增服务实际付费','在能接触到的客户中找一类已有真实需要的人，提出有周期、范围、价格的试点。','记录实际接受、付款或拒绝的理由，再决定是否投入开发。'],
      pricing:['先验证新增模式按什么条件收费','围绕一个真实客户与明确结果提出一份价格和付款周期，留出真实购买决定。','得到实际付款或具体拒绝理由，再改一个主要变量。'],
      delivery:['先验证新增模式的交付成本和容量','只选一个范围清楚的试点，估算完整投入，再记录实际工时和返工以及它对原业务的影响。','能说清一单成本、主业务受影响程度和继续做的容量上限。'],
      reach:['先验证能否触达一批新增模式的合适客户','选择一条现有资产能支持的渠道，给遇到真实问题的人发一轮具体邀约。','记录触达人数、与需求匹配的回应，和是否有下一步购买动作。']
    }[a.expansionRisk];
    const reason = {
      none:'你的主业务已有稳定获客和交付，新模式目前只查过资料或比较过方案。先找真实买家验证购买意愿，再决定是否投入。',
      planned:'你已写出试点方案，下一步发给一位目标买家，核对对方是否愿意为这个结果投入。',
      interest:'你已经接触了潜在买家，对方表达过兴趣，但还没接受付费试点。先用真实购买决定判断是否值得投入。',
      paid:'你的新模式已经收到试点付款。接下来要核对一单的交付成本和承接量，判断这项收入能否在不挤占主业务的情况下延续。'
    }[a.expansionEvidence];
    return plan(null,item?.[0] || '先验证一条会改变新模式投入的假设',
      reason || '已有稳定主业务，眼下的关键是看新增模式能否形成可持续的收入。',
      item?.[1] || '把新模式写成一份小试点，写清客户、结果、范围、价格和可投入的成本，再找真实对象核对。',
      item?.[2] || '得到一条真实回应或投入记录，据此决定继续、调整或暂缓。');
  }

  function quotePlan(a) {
    const replies = {
      date:['按约定时间跟进这笔报价','把后续跟进安排在' + (validContext(a.quoteDate) || '双方约定的时间') + '。届时确认对方的决定，以及是否需要补一条信息。','在约定时间后记录是否接受、暂缓或需要补充。'],
      detail:['补清对方追问的交付范围','针对对方追问的结果或范围补一份相关小样或明确边界，约对方确认。','能确认对方是否理解交付，以及还有哪项信息影响购买。'],
      budget:['核实预算顾虑背后的购买条件','问清是总额、付款节奏，还是这件事眼下不够急，再确定是否有适配的范围。','记录一项明确的预算或时点约束。'],
      declined:['用本次拒绝决定下一次要验证什么','为这单收尾。对方愿意说明时，记录暂缓或拒绝的具体理由。','决定下一次换对象、改方案，还是先验证一条前提。'],
      silent:['做一次简短确认，结束对这笔报价的猜测','隔合适的时间发一次确认，问对方还在考虑，还是需要你补一条信息。','留下回应。没有回应时记录本次结束，找下一位合适客户。'],
      unknown:['先核对报价后的最后回应','把最近一份报价和紧接着的对话放在一起，核对对方最后说了什么，以及有没有约回复时间。','确认一条明确反馈，或确认没有回应也没有约定。']
    }[a.reply || 'unknown'];
    const response = {
      date:'对方约好了明确的答复时间。按约跟进能直接确认对方的购买决定。',
      detail:'对方还在追问结果或范围。先补清这项信息，才能判断它是否挡住了购买。',
      budget:'对方提到了预算、付款节奏或时点。先弄清具体约束，再判断这笔报价还有没有推进空间。',
      declined:'对方已经明确暂缓或拒绝。这次的原因可以帮你判断下一轮要改客群还是改服务。',
      silent:'对方还没回应，也没约答复时间。一次简短确认能帮你判断是否值得继续跟进。'
    }[a.reply];
    return plan('sales',replies[0],
      '你已经给过明确的范围和价格。' + (response || '还需要核对报价后的最后回应，才能决定是跟进、补信息还是收尾。'),
      replies[1],replies[2]);
  }

  function fulfillmentPlan() {
    return plan('product','先履行这一单的交付承诺',
      '已经发生真实付款。此时最优先把交付边界和客户能得到的结果对齐。',
      '拿出当前约定，和客户确认交付物、双方分工、下一节点和验收办法。已交件的先约一次确认。',
      '客户确认本轮交付范围和最近的验收节点。');
  }

  function acquisitionPlan(a) {
    const reason = a.delivery === 'completed'
      ? '你已经做完过付费订单。' + (a.repeatDelivery === 'repeatable'
        ? '上一单达到了约定结果，现有做法还能用于相似客户。'
        : '现有服务的交付结果、范围和验收已经说得清。') + '客源还不稳定，先试试原来的方法能不能再带来一位相似的付费客户。'
      : '你已经能稳定交付，近期新付费客户仍时有时无。';
    return plan('sales','验证一条能重复带来相似客户的路径',
      reason,
      '挑一单典型成交，找出客户从哪里来、何时需要你、为什么买。以同一场景和相近范围接触下一位相似客户。',
      '留下一次真实触达与购买反馈，核对原来的来源和购买理由能否重复。');
  }

  function demandPlan(a) {
    if (userScenarioGap(a)) {
      const broad = a.userScenario === 'broad';
      return plan('demand',broad ? '先把大领域缩成一个细分用户场景' : '先选一类能接触的用户和一个具体场景',
        (broad ? '你已经选了大方向，用户身份和问题发生的情境还没收窄。' : '你还没有明确要服务哪类人，以及对方什么时候会需要帮助。')
          + (hasDemand(a) ? '手上的对话或试用可以帮你找出重复出现的场景。' : '选一个近期有机会接触到的人和场景，再去核对真实需求。'),
        broad ? '从这个大领域里挑一类能联系到的人。写下他们在什么情况下遇到什么问题，希望得到什么结果，再找一位真人核对。'
          : '回看自己帮过的人、被问过的问题或一次试用，圈出一类能联系到的人和一个具体问题，再问对方上次是怎么处理的。',
        '写下一类人、一个发生情境和一个期望结果，并记录一条来自真实用户的佐证。',
        '确认这个细分场景后，用用户需要的结果定交付范围，再决定去哪里找下一位同类用户。');
    }
    return plan('demand','先核对目标用户的真实需求场景',
      '你还没和目标用户核实真实发生的场景。找一位近期确实遇到这件事的人，了解对方为什么需要解决、现在怎么解决。',
      '找一位符合条件的人，听他讲上一次遇到这件事是什么时候、怎么处理、花了什么代价。',
      '带回一条真实经历和一条当前做法，决定要继续核对哪个需求。',
      '确认具体需求后，再定第一版服务范围。');
  }

  function productPlan(a) {
    const demand = {
      concrete:'目标用户已经讲过问题发生的情境和现用办法。',
      trial:'已经有用户愿意投入时间或拿自己的材料试用。',
      used:'已经有用户用过结果，并给了使用反馈。'
    }[a.demand];
    const delivery = {
      none:'你还没有服务说明或样品。',
      draft:'你已经有想法或草稿，但服务结果和边界还没对齐。',
      friction:'你也填了试用或交付中存在范围、返工或耗时问题。'
    }[a.offer];
    const reason = (demand || '手头已有一次具体尝试。') + (delivery || '')
      + '先做一次结果、范围和验收都清楚的试交付，才能用真实反馈判断下一版服务该保留什么、调整什么。';
    return plan('product','先把服务做成范围清楚的一次试交付',
      reason,
      '拿已有用户材料写一版最小交付，说明要交什么、到哪一步结束、怎么判断完成。请提出问题的人确认。',
      '对方能复述会拿到什么，并认可验收方式或愿意拿材料再试一次。');
  }

  function firstCustomerPlan(a) {
    if (businessSurvey(a) && !recentlyPaid(a) && ['none','reached'].includes(a.sale)) {
      return plan('sales','从一个能接触目标用户的地方找首位客户',
        '已有可试的服务，近期还没有合适的客户进入咨询。',
        '从你能接触的一个社群、转介绍关系或已有渠道入手，找一位近期遇到类似问题的人，发一条写清能提供的结果和下一步的邀约。',
        '留下对方的真实回应，确认是对象不匹配、时机不合适，还是对方愿意继续聊。');
    }
    return plan('sales',a.sale === 'inquiry' ? '把咨询推进到一次明确报价' : '向一位合适的客户明确邀约',
      a.sale === 'inquiry' ? '你已经有真实咨询，下一步要得到购买决定需要明确范围和价格。'
        : '已有能试的交付或付费记录，可以用同一场景面向下一位相似客户收集购买反馈。',
      a.sale === 'inquiry' ? '把交付结果、范围和价格放进同一条报价，请客户反馈是否继续。'
        : '挑一位发生过同类问题的人，发一条包含结果和下一步的具体邀约。',
      '留下对方的接受、暂缓、拒绝或约定回复时间，并记录影响判断的一项原因。');
  }

  function directionStartPlan(a, title) {
    const clue = {
      asked:'有人问过你类似问题，可以把它当作一条候选线索。',
      made:'你做过类似的事，可以从这段经历里找候选方向。',
      used:'有人用过你做出的结果，可以回看哪一部分值得继续做。'
    }[a.experience] || '';
    const progress = a.direction === 'loose'
      ? '你已有一些候选线索，还没选定哪一条值得持续投入。'
      : '你还没选出一个自己认同、愿意持续投入验证的方向。';
    return plan('direction',title,
      progress + '方向没定，遇到困难就容易停下或换题，后续的预判和试做也难以积累证据。' + clue,
      '从做过的事和长期关心的问题里列出候选，再按意愿、能力、资源和每周能投入的时间筛选。先选定一个方向，写清为什么愿意做、能投入多久，再验证最可能改变取舍的假设。',
      '选出一个愿意持续验证的方向，写下选择和投入的依据，并明确看到什么证据时会继续、调整或换方向。');
  }

  function earlyPlan(a) {
    if (outstandingDelivery(a)) return fulfillmentPlan();
    if (a.issue === 'review' && (recentlyPaid(a) || known(a.sale) && a.sale !== 'none')) return reviewPlan();
    if (isQuote(a)) return quotePlan(a);
    if (steadyDelivery(a) && knownUnstableAcquisition(a)) return acquisitionPlan(a);
    if (a.fulfillment === 'accepted' && a.issue === 'delivery') return reviewPlan();
    if (a.direction === 'unknown' && !hasDemand(a) && !recentlyPaid(a)) {
      return plan(null,'先核对这项服务要帮谁解决什么',
        '目前缺一个能核对的人或场景，补上这条事实后更容易判断是方向还是需求。',
        '写下一个正在考虑的服务对象和一段真实经历，或拿一份最近的用户对话重新填写。',
        '能说出谁在哪个情境下需要怎样的结果。');
    }
    if (['none','loose'].includes(a.direction) && !hasDemand(a) && !recentlyPaid(a)) {
      return directionStartPlan(a,'先找到一个可以尝试的服务方向');
    }
    if (a.direction === 'defined' && (known(a.risk) && a.risk !== 'none' || a.issue === 'compare' && !hasDemand(a))) {
      const risk = a.risk === 'other' ? validContext(a.riskNote) : fact('risk',a);
      return plan('forecast','先验证会影响投入决定的前提',
        risk && known(a.risk) && a.risk !== 'none' ? '已有具体候选，这项条件需要核对。' + risk
          : '已有具体候选，可以用真实的触达条件、替代办法或投入成本来比较。',
        '写清哪个前提不成立就暂缓，优先做一次成本最低的核对，例如接触一位目标用户或确认他能用的替代办法。',
        '得到一条可以改变选择的证据，并明确继续、收窄还是暂缓。');
    }
    if (a.demand === 'unknown' && !recentlyPaid(a)) {
      return plan(null,'先确认最近一次目标用户反馈',
        '当前缺少足以区分需求与产品问题的证据。',
        '回看一条真实反馈，确认对方有没有说上一次怎么解决、投入过时间，或带了自己的材料来试。',
        '能区分口头兴趣、真实经历与实际试用。');
    }
    if (!hasDemand(a) && !recentlyPaid(a)) return demandPlan(a);
    if (a.offer === 'friction' || a.offer !== 'clear' && !recentlyPaid(a)) return productPlan(a);
    if (isWork(a) && validContext(a.task)) return workPlan(a);
    if (recentlyPaid(a) && !isSalesIssue(a) && a.offer !== 'clear') return reviewPlan();
    return firstCustomerPlan(a);
  }

  function businessFollowUps(reported) {
    const a = resolvedOperatingAnswers(reported);
    const fields = stageFields(reported).filter(field => ![q.delivery,q.acquisition,q.stageNote].includes(field));
    const clearTopics = forecastTopics.filter(([key]) => a[key] === 'clear');
    if (clearTopics.length) {
      const topics = clearTopics.map(([,label]) => label).join('、');
      const examples = {marketCeiling:'可达到的收入低于你的最低目标',marketCycle:'来不及验证或回收投入',marketEntry:'关键客户或渠道进不去'};
      const hint = '你在前面给出了明确判断的是「' + topics + '」。做不下去的限制包括' + clearTopics.map(([key]) => examples[key]).join('、') + '。';
      const field = clearTopics.length === forecastTopics.length ? q.forecastDecision : {
        ...q.forecastDecision,
        label:'根据你对「' + topics + '」的判断，是否已经发现会让这个方向做不下去的限制？',
        options:{hold:'目前没发现这样的限制，先补齐其他项',stop:'已经确认存在这样的限制，先暂停新增投入并换方向'}
      };
      fields.unshift({...field,hint});
    }
    if (conflictingPayment(reported)) {
      if (reported.sale === 'paid') fields.push(q.sale);
      fields.push(q.stagePayment);
      if (a === reported) return [...fields,q.record];
    }
    const current = stage(a);
    if (current.key === 'repeat' && a.expansion && !newModel(a)) fields.push(q.operations);
    else if (current.key === 'scale' || current.key === 'repeat' && newModel(a)) fields.push(q.expansionEvidence);
    else if (current.key === 'early') {
      const checkRepeat = repeatDeliveryCheck(a);
      if (checkRepeat) fields.push(q.repeatDelivery);
      else if (a.delivery === 'working' || a.offer === 'friction' && recentlyPaid(a)) fields.push(q.fulfillment);
      if (!outstandingDelivery(a) && (!checkRepeat || a.repeatDelivery === 'repeatable')) {
        if (['none','loose'].includes(a.direction) && !hasDemand(a) && !recentlyPaid(a)) fields.push(q.experience);
        if (a.direction === 'defined' && a.demand === 'none' && !recentlyPaid(a)) fields.push(q.directionCheck);
        if (a.acquisition === 'leads' || a.offer === 'clear' && ['none','unknown'].includes(a.acquisition)) {
          fields.push(q.sale);
          if (a.sale === 'quoted') {
            fields.push(q.reply);
            if (a.reply === 'date') fields.push(q.quoteDate);
          }
        }
      }
    }
    if (a.aiUse === 'blocked' && businessPriority(a,current).key === 'selfTask') fields.push(q.aiImpact);
    return fields.length ? [...new Set([...fields,q.record])] : fields;
  }

  const axisLabels = {direction:'选方向', forecast:'做预判', demand:'选用户', product:'做产品', acquisition:'获客', ai:'AI 提效'};
  const statusLabels = {done:'已落实', progress:'已有进展', gap:'有明确缺口', verify:'证据待核实', waiting:'暂未到这一步'};
  const topicAxes = {direction:'direction', forecast:'forecast', demand:'demand', product:'product', sales:'acquisition', review:'product', selfTask:'ai'};
  const missingEvidence = {
    direction:'还缺一个可对照的候选方向，以及选择这个方向的依据。',
    forecast:'还缺市场天花板、生命周期或竞争壁垒的记录。',
    demand:'还缺目标用户最近一次遇到问题、怎么处理的记录。',
    product:'还没有确认服务结果、范围和验收方式。',
    acquisition:'还缺一轮可核对的客户来源、回应或真实付款记录。',
    ai:'还缺一次能比较耗时、返工或结果质量的真实任务记录。'
  };

  function businessMap(a, stageKey) {
    const repeat = stageKey === 'repeat';
    const scale = stageKey === 'scale';
    const forecast = assessForecast(a);
    const productOperation = repeat && ['capacity','margin'].includes(a.operations);
    const acquisitionOperation = repeat && ['reach','sales'].includes(a.operations);
    const direction = !known(a.direction) ? 'verify' : a.direction === 'tested' ? 'done'
      : directionSet(a) && a.directionCheck !== 'none' ? 'progress' : 'gap';
    const demand = !known(a.demand) ? 'verify'
      : userScenarioGap(a) ? 'gap' : a.demand === 'used' ? 'done' : hasDemand(a) ? 'progress'
      : a.demand === 'none' && !directionSet(a) ? 'waiting' : 'gap';
    const product = outstandingDelivery(a) || productOperation ? 'gap'
      : repeatDeliveryCheck(a) ? {repeatable:'progress',blocked:'gap'}[a.repeatDelivery] || 'verify'
      : a.offer === 'clear' ? (steadyDelivery(a) || a.fulfillment === 'accepted' ? 'done' : 'progress')
      : !known(a.offer) ? 'verify' : a.offer === 'none' && !hasDemand(a) && !recentlyPaid(a) ? 'waiting' : 'gap';
    const acquisition = conflictingPayment(a) || !known(a.acquisition) ? 'verify'
      : acquisitionOperation ? 'gap' : steadyAcquisition(a) ? 'done'
      : a.acquisition === 'none' && a.offer !== 'clear' && !known(a.sale) && !recentlyPaid(a) ? 'waiting' : 'gap';
    const ai = !known(a.aiUse) ? 'verify' : a.aiUse === 'validated' ? 'done'
      : a.aiUse === 'none' ? 'waiting' : 'gap';

    const axis = (key, status, field, note) => ({
      key, label:axisLabels[key], status, statusLabel:statusLabels[status],
      evidence:note || (known(a[field]) ? fact(field,a) : '') || missingEvidence[key]
    });
    return [
      axis('direction',direction,'direction',a.directionCheck === 'none' ? '已经有具体候选，还缺一次外部调查来检验。' : ''),
      axis('forecast', !forecastSubject(a) ? 'waiting' : forecast.decision === 'stop' ? 'gap'
        : ['advance','limited'].includes(forecast.decision) ? 'done' : forecast.decision === 'unstarted' ? 'waiting' : 'progress',null,forecast.reason),
      scale && a.expansionEvidence !== 'paid'
        ? axis('demand',known(a.expansionEvidence) ? 'gap' : 'verify','expansionEvidence','新模式的付费需求待验证。' + (fact('expansionEvidence',a) || ''))
        : axis('demand',demand,'demand',userScenarioGap(a) ? fact('userScenario',a) : ''),
      axis('product',product,'offer',outstandingDelivery(a)
        ? '这单已付款。' + (fact('fulfillment',a) || '还需确认交付和验收。')
        : repeatDeliveryCheck(a) ? (known(a.repeatDelivery) ? fact('repeatDelivery',a) : '有过付费交付。还需要核对上一单的验收结果和现有做法能否复用。')
        : productOperation ? fact('operations',a) : scale && a.expansionEvidence === 'paid' ? fact('expansionEvidence',a) : ''),
      axis('acquisition',acquisition,'acquisition',conflictingPayment(a) ? '付款与获客记录有出入，需要核对是不是同一项业务。'
        : acquisitionOperation ? fact('operations',a)
        : a.acquisition === 'steady' && !known(a.acquisitionProof) ? missingEvidence.acquisition
        : fact('acquisitionProof',a) || (known(a.sale) ? fact('sale',a) : '')),
      axis('ai',ai,'aiUse',known(a.aiImpact) ? fact('aiImpact',a) : '')
    ];
  }

  function closureMilestones(a) {
    const delivery = steadyDelivery(a) ? 'done' : !known(a.delivery) || a.delivery === 'steady' && !known(a.deliveryProof) ? 'verify' : 'gap';
    const acquisition = conflictingPayment(a) ? 'verify' : steadyAcquisition(a) ? 'done' : knownUnstableAcquisition(a) || a.acquisitionProof === 'notRepeated' ? 'gap' : 'verify';
    return [
      { label:'稳定交付',status:delivery,statusLabel:statusLabels[delivery],
        evidence:fact('deliveryProof',a) || fact('delivery',a) || '需要核对近期真实付款、交付和验收。' },
      { label:'稳定获客',status:acquisition,statusLabel:statusLabels[acquisition],
        evidence:conflictingPayment(a) ? '获客与付款答案有出入，需要核对同一项业务。'
          : fact('acquisitionProof',a) || fact('acquisition',a) || '需要核对相近方式是否重复带来付费客户。' }
    ];
  }

  function verifyPlan(axis, title, reason, action, check) {
    return {...plan(null,title,reason,action,check),axis,verification:true};
  }

  function businessPriority(a, current) {
    if (current.key === 'unconfirmed') {
      const axis = conflictingPayment(a) || steadyDelivery(a) || known(a.delivery) && !known(a.acquisition) ? 'acquisition' : 'product';
      const title = !conflictingPayment(a) && axis === 'acquisition' ? '先核对新付费客户从哪里来' : '先核对这项业务的付款与交付记录';
      return verifyPlan(axis,title,
        conflictingPayment(a)
          ? '交付回答里还没有实际付款，获客或购买进展里却有付费记录。先核清两处是否说的是同一项业务，才能确定阶段。'
          : '目前的付款、客户来源或交付记录还不完整。先核对同一项业务的真实记录，才能确定阶段。',
        current.check,'确认同一项业务的真实付款、交付或获客记录，再更新诊断。');
    }
    if (current.provisional && !outstandingDelivery(a) && !forecastBlocked(a)) {
      const acquisition = current.verifyAxis === 'acquisition';
      return verifyPlan(current.verifyAxis,
        acquisition ? '先核对获客能否稳定带来付费' : '先核对相似客户能否稳定拿到约定的结果',
        current.basis,current.check,
        acquisition ? '比较最近几次找客户的记录，看看相近的做法能否多次带来同类付费客户。'
          : '用付费订单的验收或使用记录，确认相似客户是否都能拿到约定结果。');
    }
    if (current.key === 'scale') {
      if (a.expansionEvidence === 'quoted') {
        return {...plan(null,'先跟进新模式已经报出的试点价格',
          '试点已经有范围和价格，下一条有用的证据是对方的购买决定。',
          '找最近收到试点报价的人，确认是否接受。若暂缓或拒绝，问清是范围、价格还是付款时点影响了选择。',
          '记录实际付款或一个明确的暂缓、拒绝理由，再决定下一轮调整什么。'),axis:'demand'};
      }
      const risk = {none:'demand',planned:'demand',interest:'demand',paid:'delivery'}[a.expansionEvidence];
      return {...scalePlan({...a,expansionRisk:risk}),axis:risk === 'delivery' ? 'product' : 'demand',verification:!risk};
    }
    if (outstandingDelivery(a)) return fulfillmentPlan();
    if (current.key === 'early' && forecastBlocked(a)) {
      return plan('direction','根据预判结果重新选方向',
        assessForecast(a).reason,
        '记下阻止进入的具体证据，暂缓对这一方向新增投入。回到候选清单，换一个有条件进入的方向再做预判。',
        '能说明为什么放下原方向，并选出一个可以用市场证据重新判断的候选。');
    }
    if (repeatDeliveryCheck(a) && a.repeatDelivery !== 'repeatable') {
      if (a.repeatDelivery === 'blocked') {
        return plan('product','先修复影响验收或接下一单的交付问题',
          '你已经完成过付费订单，客源也不稳定。上一单的范围争议或反复返工已经影响验收或接单。先修好这个具体问题，下一次触达类似客户时才有一份能接得住的服务。',
          '拿上一单的约定、实际交付和返工记录，找出最影响验收或占用时间的一项。先把这一项的范围和验收标准说清，再用上一单材料试做一次。',
          '能说明下一位相似客户会拿到什么，且能用可承受的投入按约交付，再验证获客。');
      }
      return verifyPlan('product','先核对上一单能否按相近范围再交付',
        '你做完过付费订单，之前每单都临时定范围。用上一单的验收和工时确认，现有做法能否用在下一位相似客户身上。',
        '回看上一单的约定、客户验收和实际工时。如果客户按约验收，且你能用现有方式服务一个相似客户，下一步验证获客来源；如果范围或返工已经拖住验收或接单，先修这一处。',
        '有一笔订单的交付记录能支持下一步先做哪件事。');
    }
    if (current.key === 'repeat' && ['reach','sales','capacity','margin'].includes(a.operations)) {
      const axis = ['reach','sales'].includes(a.operations) ? 'acquisition' : 'product';
      return {...repeatPlan({...a,optimize:a.operations}),axis};
    }
    if (a.sale === 'quoted' && (a.offer === 'clear' || recentlyPaid(a) || hasDemand(a))) return quotePlan(a);
    if (steadyDelivery(a) && knownUnstableAcquisition(a)) return acquisitionPlan(a);

    const paid = recentlyPaid(a) || a.sale === 'paid';
    if (current.key === 'early' && !paid && marketToAssess(a) && startedForecast(a) && !forecastReady(a)) {
      return plan('forecast','先预判这个方向值不值得投入',
        assessForecast(a).reason,
        (a.marketCeiling === 'noTarget' ? '先写下自己的收入目标。' : '') + '估算这个细分市场能带来多少收入，判断机会能持续多久、最晚何时切入，再核对主要对手控制了哪些客户和渠道。',
        '给出有可核对依据的投入决定。若有难以解决的硬伤，回到选方向。若有可进入的空间，再验证首批用户。');
    }
    if (!paid && !hasDemand(a) && !directionSet(a)) {
      if (!known(a.direction)) {
        return verifyPlan('direction','先核对一个可能的方向',
          '还没有可以核对的方向信息，暂时无法区分方向与需求的问题。',
          '找一份你做过的工作，或记录一个候选方向，写出谁可能因为它得到什么结果。',
          '能写清一类人、一个发生情境，以及你能提供的结果。');
      }
      return directionStartPlan(a,'先比较候选，收敛一个值得验证的方向');
    }
    if (!paid && !startedForecast(a) && a.directionCheck === 'none' && a.demand === 'none') {
      return plan('forecast','先调查这个方向值不值得继续投入',
        '你已经说得清一个候选方向，目前还没有查过市场或接触潜在用户。',
        '找两个同类解决办法，核对服务对象、购买场景和替代选择。再找一位潜在用户确认这个场景是否实际发生。',
        '拿到一条能支持继续、收窄或暂缓的外部证据。');
    }
    if (!paid && !known(a.demand)) {
      return verifyPlan('demand','先核对一条真实用户反馈',
        '现有回答还不足以判断，当前更缺用户需求还是产品边界。',
        '回看一次目标用户的对话，确认对方是否讲过上一次发生的事、投入过时间，或带材料来试过。',
        '能区分口头兴趣、真实经历与实际试用。');
    }
    if (!paid && !hasDemand(a)) return demandPlan(a);
    if (current.key === 'early' && userScenarioGap(a) && a.offer !== 'friction') return demandPlan(a);
    if (!completedWithUnstableAcquisition(a) && (a.offer === 'friction' || ['none','draft'].includes(a.offer))) return productPlan(a);
    if (a.aiUse === 'blocked' && (a.offer === 'clear' || paid)) {
      return plan('selfTask','先处理拖慢经营任务的重复工作',
        (known(a.aiImpact) ? fact('aiImpact',a) + '。' : '重复耗时或返工已影响客户交付或获客。')
          + '先用同一验收标准比较这一步改前改后的耗时和质量，才能判断能不能缓解眼下的业务卡点。',
        aiExperiment(a),
        '检查是否节省实际时间，交付结果是否仍符合原来的验收要求。');
    }
    if (current.key === 'repeat') {
      const review = repeatPlan({});
      if (a.operations === 'steady') {
        review.reason = fact('operations',a) + '。用同一轮咨询和订单比较，选一个能提升现有模式的指标。';
      }
      return {...review,verification:true};
    }
    if (completedWithUnstableAcquisition(a) && a.sale !== 'inquiry') return acquisitionPlan(a);
    if (!known(a.offer) && !paid) {
      return verifyPlan('product','先核对手头的服务能不能试交付',
        '需求已有线索，目前还不清楚是否有范围和验收明确的版本。',
        '拿一份现有说明或样品，写清客户拿到的结果、做到哪一步结束、怎么验收。',
        '能判断是否已具备拿给一位真实用户试做的条件。');
    }
    return firstCustomerPlan(a);
  }

  function aiExperiment(a) {
    return ({
      manual:'拿一份近期真实材料，把整理、录入或搬运这一步交给 AI。沿用原来的验收标准，对照两次耗时。',
      rework:'回看最近一次返工，把最常改的一项要求写成检查标准。用同一份材料让 AI 重做一版，比较返工次数和修改时间。',
      sources:'挑最近一份待核材料，让 AI 标出每条结论的出处和缺项。回到原始材料复查，记录核对时间和漏项。',
      mixed:'把最近一单的整理、修改和复核分别计时。先用 AI 改最耗时的一步，再按原有标准核对质量和用时。'
    })[a.aiImpact] || '选最近一次受影响的工作，记下原有耗时、返工和验收要求。用相近材料，把最重复的一步交给 AI，再做一次对照。';
  }

  const ordinaryFactIds = [
    ['近期经过','record'],['补充事实','stageNote'],['方向进展','direction'],['经验线索','experience'],
    ['待核风险','risk'],['细分用户场景','userScenario'],['目标用户反馈','demand'],['交付边界','offer'],['销售进展','sale'],['客户回应','reply'],
    ['交付进展','delivery'],['实际履约','fulfillment'],['上一单是否能复用','repeatDelivery'],['交付结果','deliveryProof'],
    ['获客记录','acquisition'],['获客稳定性','acquisitionProof'],['补核付款与交付','stagePayment'],['执行阻碍','barrier'],
    ['方向调研','directionCheck'],['市场天花板','marketCeiling'],['市场生命周期','marketCycle'],['竞争壁垒','marketEntry'],
    ['预判后的投入决定','forecastDecision'],['AI 提效进展','aiUse'],['影响进度的工作','aiImpact']
  ];

  function diagnose(reported) {
    const current = stage(reported);
    const a = resolvedOperatingAnswers(reported);
    const key = current.key;
    let answer;
    const map = businessSurvey(a) ? businessMap(a,key) : [];
    if (map.length) answer = businessPriority(a,current);
    else if (key === 'early') answer = earlyPlan(a);
    else if (key === 'repeat') answer = repeatPlan(a);
    else if (key === 'scale') answer = scalePlan(a);
    else if (key === 'work') answer = workPlan(a);
    else answer = plan(null,'先补一条能确认经营阶段的真实记录',
      '现在的资料还不足以确认业务是否已稳定获客和交付。',current.check,
      '确认同一项业务的真实付款、交付或客户来源，再更新诊断。');

    if (isWork(a) && !independent(a) && answer.key && !['writing','research','selfTask'].includes(answer.key) && key === 'early') {
      answer.next = answer.next || '完成这一步后，把真实材料交给 AI 辅助整理，再用本轮的验收标准核对。';
    }
    if (a.barrier === 'time' && key === 'early') {
      answer.next = '时间有限时，先留出一个短时段，只整理一件材料或联系一位真实对象。';
    }
    const ids = key === 'work' ? [['本次工作','task'],['已有材料','workInput'],['遇到的阻碍','workFriction'],['验收要求','workNote']]
      : key === 'scale' ? [['交付','deliveryProof'],['获客','acquisitionProof'],['新收入模式','newMode'],['试点反馈','expansionEvidence'],['细分用户场景','userScenario'],['待核风险','expansionRisk']]
      : key === 'repeat' ? [['交付','deliveryProof'],['获客','acquisitionProof'],['近期表现','operations'],['细分用户场景','userScenario'],['补充记录','record'],['近期表现','optimizeNote']]
      : ordinaryFactIds;
    const priorityEvidence = {
      direction:['experience','direction'], forecast:['risk','direction'], demand:['record','demand','offer'],
      product:['fulfillment','repeatDelivery','demand','offer'], sales:['reply','sale','acquisition','repeatDelivery'], review:['record','fulfillment','sale']
    }[answer.key] || [];
    const ordered = [...ids.filter(([,id]) => priorityEvidence.includes(id)),
      ...ids.filter(([,id]) => !priorityEvidence.includes(id))];
    const evidence = ordered.flatMap(([label,id]) => {
      const value = known(reported[id]) ? fact(id,reported) || validContext(reported[id]) : '';
      return value ? [{ label,value }] : [];
    });
    const topic = topics[answer.key] || null;
    const priorityAxis = map.length ? answer.axis || topicAxes[answer.key] || '' : '';
    const priorityLabel = answer.verification ? '优先核实' : '最优先处理';
    const standaloneTopic = ['writing','research','selfTask'].includes(answer.key);
    const eligible = key === 'early' && Boolean(topic) && !standaloneTopic;
    const help = Array.isArray(a.support_preference) ? a.support_preference : [];
    let service = '';
    const directionFirst = ['direction','forecast'].includes(answer.key);
    if (eligible) {
      if (a.helpMode === 'ongoing') service = directionFirst ? 'direction' : 'ongoing';
      else if (['consult','task'].includes(a.helpMode)) service = a.helpMode;
      else if (!a.helpMode && help.some(x => /陪我|边做边调整/.test(x))) service = directionFirst ? 'direction' : 'ongoing';
      else if (!a.helpMode && help.some(x => /路径|具体反馈|减少试错/.test(x))) service = 'consult';
    }
    return {
      stage:key, stageLabel:stageLabels[key] || '', provisional:Boolean(current.provisional),
      progress:current.progress, stageBasis:current.basis || '',
      title:answer.title, reason:answer.reason, action:answer.action, check:answer.check, next:answer.next,
      evidence, topic, topicKey:answer.key, eligible, service, map, priorityAxis, priorityLabel,
      closure:map.length ? closureMilestones(a) : [],
      selected:issueLabels[a.issue || a.workType] || '一人公司经营诊断'
    };
  }

  Object.assign(api,{ topics, stage, stageFields, evidenceFields, diagnose, resolvedOperatingAnswers, businessFields, userScenarioGap, demandPlan, assessForecast, forecastBlocked, forecastReady, aiExperiment });
})();
