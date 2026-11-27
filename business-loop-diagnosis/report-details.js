(() => {
  const api = window.ClosedLoop;
  const scored = (score, explanation) => ({score, explanation});
  const voyageCardTitle = '商业闭环诊断-上船卡';
  const scoreBasis = '分数按你选择的实际进展计算。0 分表示还没做到这一环的第一项验证。';
  const completed = a => ['completed','steady'].includes(a.delivery) || a.fulfillment === 'accepted';
  const repeatDelivery = a => a.delivery === 'steady' && a.deliveryProof === 'consistent';
  const repeatAcquisition = a => a.acquisition === 'steady' && a.acquisitionProof === 'repeat';

  function scoreDirection(a) {
    if (a.direction === 'tested') {
      if (completed(a) && a.demand === 'used') return scored(5,'已比较长期意愿、个人条件和市场线索，还拿到了真实使用反馈和付费交付。');
      return scored(4,'已比较个人条件和市场线索并选定验证方向，下一档需要真实使用和付费交付。');
    }
    if (a.direction === 'defined') {
      if (['desk','conversation'].includes(a.directionCheck)) return scored(3,'能说明对象、场景和结果，并已做过外部调查，还可以用同样的标准比较候选。');
      return scored(2,'已有可描述的候选，暂时缺少用外部证据收敛方向的记录。');
    }
    return ({
      none:scored(0,'还没选定一个愿意持续投入验证的方向。'),
      loose:scored(1,'已经有技能、兴趣或候选线索，接下来要比较自己愿意做什么、实际能投入多少。')
    })[a.direction] || scored(0,'答卷还没有能确认的候选方向。补一条方向和形成它的依据。');
  }

  function scoreDemand(a) {
    const feedback = ({
      none:scored(0,'还没和目标用户核实真实发生的场景。'),
      interest:scored(1,'获得了兴趣反馈，下一档需要对方实际遇到问题的经历。'),
      concrete:scored(2,'已问到真实发生的情况和现用办法，下一档需要用户投入时间或材料来试。'),
      trial:scored(3,'用户已经投入时间或材料试用，还需核对实际使用的结果。'),
      used:scored(4,'有人用过结果并给了反馈，下一档要看到相似付费客户有可重复的需求。')
    })[a.demand] || scored(0,'答卷还没有能确认的用户反馈。补一条目标用户实际遇到问题、如何处理的记录。');
    const evidence = feedback.score >= 2;
    if (a.userScenario === 'none') {
      return scored(evidence ? 1 : 0,(evidence ? '已有用户对话或使用记录，可用来找线索。' : '') + '你还没确定要服务哪类人、他们什么时候会需要帮助。');
    }
    if (a.userScenario === 'broad') {
      return scored(evidence ? 2 : 1,'已经有大方向。' + (evidence ? '手上也有真实反馈，可以从中找出重复出现的场景。' : '先确定一个细分用户和场景，再去核对真实需求。'));
    }
    if (a.userScenario === 'specific' && !evidence) return scored(1,'你已经写得清要服务谁和解决什么场景。接下来找一位符合条件的人核对真实经历。');
    if (a.demand === 'used' && repeatDelivery(a)) return scored(5,'已有使用反馈，多位相似付费客户也收到了约定结果，需求在相似人群中反复出现。');
    return feedback;
  }

  function scoreForecast(a) {
    const forecast = api.assessForecast(a);
    if (['direction','unstarted'].includes(forecast.decision)) return scored(0,forecast.reason);
    const verified = forecast.evidence;
    const checked = [a.marketCeiling,a.marketCycle,a.marketEntry];
    if (verified === checked.length) {
      return scored(forecast.decision === 'hold' ? 4 : 5,'三项判断都有能查到来源的依据。' + forecast.reason);
    }
    if (verified) return scored(verified + 1,'有 ' + verified + ' 项市场判断已有能查到来源的依据。' + forecast.reason);
    if (checked.includes('rough')) return scored(1,'已有初步判断。' + forecast.reason);
    return scored(0,forecast.reason);
  }

  function scoreProduct(a) {
    if (a.repeatDelivery === 'blocked') return scored(2,'上一单的范围争议或返工已经影响验收或接单。');
    if (a.fulfillment === 'dispute') return scored(2,'已有订单在交付，发生了范围争议或返工，需要先确认双方认可的验收标准。');
    if (repeatDelivery(a) && a.offer !== 'friction') return scored(5,'相似付费客户能反复收到约定结果，并有验收或使用反馈。');
    if (a.repeatDelivery === 'repeatable' || completed(a) && a.offer === 'clear') return scored(4,'已有完成的付费交付和可沿用的结果边界，下一档要核对多笔相似订单的稳定性。');
    if (a.offer === 'friction') return scored(2,'已经开始使用或交付，尚有范围、返工或耗时问题需要核对。');
    if (completed(a) || a.delivery === 'working' && a.offer === 'clear' || a.offer === 'clear' && ['trial','used'].includes(a.demand)) {
      return scored(3,'已有试用或付费交付记录。下一档需要把验收结果和可重复的交付方式对齐。');
    }
    if (a.offer === 'clear') return scored(2,'能说清结果、范围和验收，可以拿给真实用户试交付。');
    if (a.offer === 'draft') return scored(1,'已有草稿或样品，交付结果、范围和验收尚未对齐。');
    if (a.offer === 'none') return scored(0,'目前还没有服务说明或样品。');
    return scored(0,'答卷还没有能确认的产品进展。先补一份服务说明或样品，写清结果、边界和验收方式。');
  }

  function scoreAcquisition(a, axis) {
    if (axis.status === 'verify') return scored(0,'目前还没有能对得上的新客户付款和来源记录。先核对同一项服务的订单与客户来源。');
    if (repeatAcquisition(a)) return scored(5,'相近的渠道或动作已多次带来相似付费客户。');
    if (a.acquisition === 'steady' && a.acquisitionProof === 'notRepeated') {
      return scored(3,'有多位付费客户，每次获客做法不同。用相近的动作再跑一轮，验证能否带来同类客户。');
    }
    if (a.acquisition === 'steady' && a.acquisitionProof === 'incidental') {
      return scored(3,'已有付费，但集中机会、大单或老客复购还不足以证明同类新客户来源可重复。');
    }
    if (a.acquisition === 'occasional') return scored(3,'已有实际成交，来源仍零散，先验证哪些动作能带来下一位相似客户。');
    if (a.sale === 'paid') return scored(3,'最近一位目标客户实际付款，下一档要看到相近渠道持续带来成交。');
    if (a.acquisition === 'leads' || ['inquiry','quoted'].includes(a.sale)) return scored(2,'已进入咨询或报价，有机会继续核对购买决定和付费记录。');
    if (a.sale === 'reached' || completed(a) || a.delivery === 'working') return scored(1,'已经有触达或过去的付费记录，当前缺少新增付费客户。');
    return scored(0,'目前还没有从获客动作中得到有效咨询或新付费客户。');
  }

  function scoreAi(a) {
    return ({
      none:scored(0,'你目前还没选定一件要用 AI 提效的工作。'),
      untested:scored(1,'你已有一项耗时或重复的工作，还没比较过使用 AI 前后的结果。'),
      friction:scored(2,'已经试用 AI，但仍有耗时、漏项或返工，需用同类任务验证结果。'),
      blocked:scored(2,'已经观察到效率问题影响交付或获客，需验证一个局部改动能否减少耗时或返工。'),
      validated:scored(5,'已用相近任务做前后对照，能够稳定省时且结果质量达标。')
    })[a.aiUse] || scored(0,'答卷还没有能确认的提效进展。先补一次真实任务的耗时、质量或返工记录。');
  }

  const scorers = {direction:scoreDirection,forecast:scoreForecast,demand:scoreDemand,product:scoreProduct,acquisition:scoreAcquisition,ai:scoreAi};

  const strategies = {
    deliveryDispute:[
      ['先复核客户真正想解决什么','把当时的需求记录、购买理由和最新反馈放到一起。问客户这项服务要帮他完成什么任务，最后在哪个场景用，什么样的结果才算解决。记下客户确认过的一句话。'],
      ['和客户对清哪一处没达到预期','用现在的交付件逐项对照原约定。请客户指出一处具体偏差以及理想样例，你也说明原来理解的结果、范围和限制。确认哪些属于补齐原承诺，哪些需要单独协商新的范围和时间。'],
      ['调研成熟同行的交付做法','选 2～3 个服务对象和场景相近的成熟对标，查公开服务说明、样例或评价。重点比较交付物、修改次数、协作分工和验收办法，挑一项能解决本单争议的做法。'],
      ['用一个最小交付物对齐，再继续','把重做范围、客户要提供的材料、下次确认时间和验收标准写成一页双方可确认的记录。先给一小段修订结果，让客户确认后再做剩余部分。']
    ],
    deliveryActive:[
      ['核对当前承诺和待确认项','把现有约定、客户材料和当前交付件放在一起，列出已经完成、等待确认和还需提供的内容。'],
      ['和客户对齐这次的验收','围绕客户要用的真实情境，确认交付物、双方分工和最近一次确认时间。已提交的部分请客户给一条具体反馈。'],
      ['先做一个小节点','按对齐后的标准完成一小段交付并让客户确认。把客户实际使用或验收的结果留作下一单的依据。']
    ],
    reopen:[
      ['从上一单拿出三份记录','对照最初承诺、实际交付物和工时或返工记录，圈出最影响验收或占用时间的一件事。'],
      ['区分可以照做的部分和临时调整','核对相似客户能否用同一范围拿到结果。能照做就用这单去复盘来源；若争议或返工挡住下一单，就先缩小范围、明确分工和验收。'],
      ['留下一条可复查的决定','写出你接下来要验证获客还是修交付，给出上一单的一条记录作为依据。']
    ],
    direction:[
      ['先列出你想做的方向','把你想到的方向尽量列全，也可以从感兴趣的议题、做过的事、别人常请你解决的问题和看到的市场机会出发补充。给每个候选写一句你想做什么、为什么愿意持续做。'],
      ['筛出你愿意长期做的方向','先看这是不是你长期在意、也愿意持续做的事，再对照手上的资源、经验、能力、时间和精力，筛出你愿意做且现实中做得动的方向，记下每次取舍的理由。'],
      ['验证这个模式里风险最高的关键假设','选出一个一旦不成立就会改变投入决定的假设，比如目标用户是否愿意为某个结果付费。先写清看到什么证据才继续，再做一次对标调研、访谈或小规模付费测试。用结果决定继续、调整或暂缓。']
    ],
    forecast:[
      ['估算你实际上能做到多大','划定细分市场，用能触达的客户数量、购买频次和价格估一个区间，再和自己的收入目标比较。'],
      ['估算机会能持续多久','对照不同时点的需求或交易记录，估算机会还有多久。倒推验证和交付需要的时间，写下最晚什么时候要切入。'],
      ['核对能否进入并决定投入','列出主要对手和用户的替代办法。核对对手控制的渠道、信任或关键资源，再记录是推进、小试、暂缓还是换方向。']
    ],
    demand:[
      ['先圈定一个真实发生的场景','找一位最近真实遇到问题的目标用户，按角色、发生时机和触发事件确定访谈对象。'],
      ['复盘上一次是怎么做的','问什么时候发生、现在用什么办法、花了多少时间或费用、还有哪一步没解决。请对方带一份真实的记录或材料。'],
      ['根据访谈决定要不要试做','如果对方用现有办法就能解决，记下他为什么满意，再核对一个仍会反复发生、且现有办法处理不好的场景。如果对方有明确的麻烦，邀请他用真实材料做一次小试用。约定他投入什么、你做到哪一步，以及他如何判断结果比现有办法更有用。']
    ],
    product:[
      ['写清一次最小交付的使用场景','从一份真实需求或试用记录里选一个任务，明确客户交什么材料、你交什么结果，以及结果要在什么场景使用。'],
      ['请用户先确认范围和验收','用一页说明约定交付物、双方分工、到哪里结束。让对方用自己的话复述会拿到什么。'],
      ['先交一个可以核验的片段','用现有材料完成小样，请客户按约定方式确认。记录一处误解或返工，下一轮只调整这一处。']
    ],
    acquisition:[
      ['复盘一条已经发生或最近的触达','有过成交就选一笔订单，记下客户从哪来、什么时刻开始找方案、为什么选择你。尚未成交就先核对最近一次咨询或邀约。'],
      ['用同样的方法找一位相似客户','沿同一来源找一位相似客户，邀约时说清他在何时可能需要什么结果，以及能从哪一步试起。有明确咨询或报价的就继续推进原对话。'],
      ['记录反馈，定位下一处要改的地方','记录是否触达、是否进入有效咨询、是否接受范围和价格、是否付款。下一轮只调整一个影响购买决定的条件。']
    ],
    ai:[
      ['选一件真的影响经营的工作','拿最近一次实际交付或获客任务，记录原流程耗时、返工次数和最终验收标准。'],
      ['只换掉最费时的那一步','用同一份或相近材料照现有判断试一次。核对事实、来源和交付标准，记录还要人工处理的部分。'],
      ['对比是否值得保留','记录用时、漏项与返工。质量达到原要求且确实省时，再把材料和检查标准写成可复用流程。']
    ],
    stage:[
      ['只用同一项业务的记录','找最近一笔订单或一轮咨询，把付款、交付结果和客户来源放在一起。'],
      ['确定目前能确认到哪一步','区分单次成交、重复成交与稳定交付。已经有两项稳定证据时，再看是否真正开始验证新增收入模式。']
    ]
  };

  function nextSteps(a, r, market) {
    if (r.stage === 'unconfirmed') return strategies.stage;
    if (r.priorityAxis === 'product' && a.fulfillment === 'dispute') return strategies.deliveryDispute;
    if (r.priorityAxis === 'product' && a.repeatDelivery === 'blocked') return strategies.reopen;
    if (a.delivery === 'working' && r.topicKey === 'product' && a.fulfillment !== 'accepted') return strategies.deliveryActive;
    if (r.priorityAxis === 'direction' && api.forecastBlocked(a)) return [
      ['记下让原方向做不下去的原因','指出是市场撑不起目标、窗口不足，还是对手掌握了你绕不开的渠道或资源。附上支持判断的记录。'],
      ['换一个候选重新预判','暂停对原方向的新增投入，按自身条件挑一个替代候选，重新核对市场天花板、生命周期和竞争壁垒。']
    ];
    if (r.provisional) return [['核对缺少的经营记录',r.action],['更新阶段判断',r.check]];
    if (r.stage === 'repeat' || r.stage === 'scale') return [
      ['把现状落到一轮真实记录',r.action],
      ['固定本轮要验证的条件','写下这轮针对哪批客户或哪种订单、准备改变什么，保留其余条件作为参照。'],
      ['用结果决定是否继续投入',r.check]
    ];
    if (r.priorityLabel === '优先核实' && r.priorityAxis === 'product' && completed(a)) return strategies.reopen;
    if (r.priorityAxis === 'forecast' && market?.steps) return [
      ...market.steps,
      ['用证据决定下一轮投入','写下哪条依据支持推进或小试，哪条限制需要补证或暂停。']
    ];
    if (r.priorityAxis === 'demand' && api.userScenarioGap(a)) return [
      ['找一条真实线索','从你帮过的人、收到的咨询或试用记录中挑一条，写下对方是谁、什么时候遇到问题。'],
      ['写成一个细分定位','用一句话说清服务谁、对方在哪种场景需要帮助，以及希望拿到什么结果。'],
      ['找一位符合条件的人核对','请对方讲最近一次发生的事和目前的解决办法，确认你的定位是否说中了他的需要。']
    ];
    if (r.topicKey === 'review') return [['回看本轮实际经过',r.action],['保留一个下轮变量',r.check]];
    if (r.priorityAxis === 'acquisition' && ['inquiry','quoted'].includes(a.sale)) return [
      ['核对上一次沟通留下的记录','把客户的任务、原来的范围和价格、对方最后一句明确回应写在一起，定位对话停在哪里。'],
      ['推进这一笔具体咨询或报价',r.action],
      ['记录实际购买决定',r.check]
    ];
    return strategies[r.priorityAxis] || [['按当前判断做一次验证',r.action],['留下进展证据',r.check]];
  }

  const foundationKeys = ['direction','demand'];
  const hasFoundationGap = axis => axis.score < 4;
  const completedPrerequisite = {
    direction:'方向明确后', forecast:'市场预判通过后', demand:'目标用户核实后',
    product:'交付范围与验收明确后', ai:'本轮 AI 提效验证后'
  };
  const fullScore = {
    forecast:'能说清这个方向可带来的收入、机会还能持续多久、自己能不能进入，并有证据支持推进、小试或停止。',
    direction:'比较过长期意愿、自身条件与市场机会，选定一个方向，并拿到真实使用反馈和已完成的付费交付记录。',
    demand:'有明确的细分用户和场景，用户实际用过结果并给出反馈，多位相似的付费客户也验证了同一类需求和交付结果。',
    product:'相似付费客户能多次拿到约定结果，有验收或实际使用反馈，范围、返工或耗时也未形成明显交付阻碍。',
    acquisition:'相近的渠道或获客动作，已多次带来相似的新客户并实际付费。',
    ai:'用相近的真实任务做过前后对照，AI 能稳定省时，结果质量也持续达到原来的验收标准。'
  };
  const usableOffer = a => a.offer === 'clear' || api.recentlyPaid(a) || a.sale === 'paid';
  const currentCustomer = a => api.recentlyPaid(a) || ['trial','used'].includes(a.demand)
    || ['inquiry','quoted','paid'].includes(a.sale) || a.acquisition === 'leads';

  const connections = [
    ['direction','forecast','用方向圈定市场。发现硬伤就重新选方向。'],
    ['direction','demand','按方向找首批用户。反馈持续偏离时，复查方向。'],
    ['direction','product','按自身能力定交付范围。长期做不动时，复查方向。'],
    ['direction','acquisition','按方向积累同类客户，用购买反馈校准方向。'],
    ['forecast','demand','确认市场有切口，再找用户验证具体需求。'],
    ['forecast','product','按市场空间和窗口定投入。证据少时先小试。'],
    ['forecast','acquisition','先找进得去的渠道。触达受阻时复核竞争壁垒。'],
    ['demand','product','用客户愿意付费的结果定交付范围和验收。'],
    ['demand','acquisition','按购买场景选渠道和邀约理由。'],
    ['product','acquisition','带着明确结果和价格做邀约，用成交和拒绝反馈改产品。'],
    ['direction','ai','把过往项目、技能和可用时间整理成候选清单。自己核对哪些能长期做。'],
    ['forecast','ai','把市场和竞品资料整理成证据表。回到原始来源核对数字、时间和口径。'],
    ['demand','ai','从访谈里提炼触发场景、替代办法和投入意愿。回看原话确认。'],
    ['product','ai','把真实需求整理成样品、交付清单或验收表。用同一标准比较耗时和质量。'],
    ['acquisition','ai','归纳咨询记录并起草下一轮邀约。用实际回复、咨询和成交检验。']
  ];

  const keepDoing = {
    forecast:'保留预判资料和投入决定。市场或竞争变化时，复核最可能改变判断的那条依据。',
    direction:'把当前的方向和取舍理由记下来。遇到相似机会时，用同一标准决定接不接。',
    demand:'保留已验证的人群与场景，继续记录新客户为什么来、实际用到了什么。',
    product:'把范围、协作分工和验收方式沉淀成模板，用下一单核对能否沿用。',
    acquisition:'继续跑已经验证的渠道，按轮记录有效咨询、付费和实际投入。',
    ai:'保留已经省时且达标的做法。任务或验收标准变化时，重新做一次对照。'
  };

  function earlyActions(a, gaps) {
    const paid = api.recentlyPaid(a) || a.sale === 'paid';
    const foundations = gaps.map(axis => axis.key === 'direction' ? '方向' : '目标用户和场景').join('、');
    return {
      forecast:'核对市场天花板、机会窗口和主要对手的进入壁垒，再决定推进、小试、暂缓或换方向。',
      direction:currentCustomer(a)
        ? '从已有试用、订单或咨询里比较谁愿意投入、你能稳定做出什么，以及你愿不愿长期做。暂定一个更聚焦的方向，拿下一条真实反馈核对。'
        : '列出想尝试的方向，按你长期在意的事、手头资源和可投入时间筛选。对留下的方向先验证那个最可能改变取舍的假设。',
      demand:api.userScenarioGap(a) ? api.demandPlan(a).action : currentCustomer(a)
        ? '从最近一次咨询、试用或订单入手，复盘对方在哪个场景找上你、用过什么替代办法、愿意为哪个结果投入。用记录判断下一步是否还选这类人。'
        : '找一位最近遇到这件事的人，问他上次怎么处理、花了多少时间或费用，再确认是否愿意带材料试一次。',
      product:paid
        ? '照常履行已有承诺。' + (api.userScenarioGap(a) ? '下一版先用核对后的细分场景定交付结果、范围和验收。' : '结合使用反馈收窄下一版的范围，写清交付物、分工和验收，用一单确认相似客户能否拿到相同结果。')
        : '先用已核对的需求写一页小服务说明，明确给谁、交什么、怎么验收，再请一位目标用户带真实材料试做。',
      acquisition:gaps.length
        ? '有咨询就继续跟进，记录哪个客群愿意回应、试用或付款。等' + foundations + '更清楚，再用同样的方法找一位相似客户，看看对方会不会付费。'
        : '沿已成交客户的来源再联系一位相似客户。还没有付费记录时，先选一个目标用户常出现的渠道，发出具体邀约并记录是否进入咨询或付款。',
      ai:a.aiUse === 'blocked'
        ? '挑真正拖慢交付或获客的一步，用同一份材料做前后对照，记录工时、返工次数和验收质量。'
        : '选一项重复且有明确验收标准的真实任务，记下原耗时，再试 AI 是否能稳定省时并保住质量。'
    };
  }

  function forecastWork(a, forecast) {
    if (forecast.decision === 'direction') return {why:'先选定一个候选，才知道要查哪类客户、哪段机会窗口和哪些对手。',
      action:'用一句话写下候选方向服务谁、在哪种情境解决什么问题。用这个候选做市场预判。'};
    if (forecast.decision === 'stop') return {why:forecast.reason,
      action:'留存原方向做不下去的依据。换一个候选后，重新核对收入、窗口和进入条件。'};
    if (forecast.decision === 'limited') return {why:forecast.reason,
      action:'写清小试要验证的一项条件、最多投入多少时间和费用，以及看到什么结果就停止。'};
    if (forecast.decision === 'advance') return {why:'收入、机会窗口和进入条件已有判断，可以用真实用户反馈验证这个切口。',
      action:keepDoing.forecast};

    const dimensions = {
      marketCeiling:{
        none:['收入规模还没调研','用能接触的客户数、购买频次和价格估算保守收入'],
        noTarget:['还没定收入目标','先定期限和最低收入目标，再估算候选市场的收入'],
        rough:['收入有粗估，仍需核对','找同类成交价格和客户数量，把粗估改成能查到来源的收入区间']
      },
      marketCycle:{
        none:['还没判断机会窗口','对照不同时点的需求或交易记录，估算机会还能持续多久'],
        rough:['知道还有机会，最晚何时切入仍不清楚','从预计窗口结束时间倒推验证与交付所需时间，定最晚切入点']
      },
      marketEntry:{
        none:['还没核对对手和渠道','找出主要对手和用户现用的替代方案，确认有哪些客户可以接触'],
        rough:['已知道主要对手，进入条件还没核对','从一个渠道找一批能接触的目标客户，核对对手是否占住了你必须经过的渠道或资源']
      }
    };
    const questions = forecast.unresolved.map(({id,value}) => dimensions[id][value] || dimensions[id].none);
    if (!questions.length) return {why:forecast.reason,
      action:'从三项里找出最会改变投入的一条判断，回到原始资料核对。写明它成立、受限或不成立时各投入多少。'};
    const context = ['defined','tested'].includes(a.direction) ? '你已经有一个可预判的候选。' : '';
    return {
      why:context + questions.map(([gap]) => gap).join('，') + '。这些判断决定下一轮是否值得投入、投入多少。',
      action:questions.map(([,task]) => task).join('。') + '。',
      steps:questions.map(([,task],index) => ['核对' + forecast.unresolved[index].label,task + '。'])
    };
  }

  const waitFor = {
    direction:'先选定一个愿意持续验证的方向，后面的市场调查和试做才能围绕同一个候选积累证据。',
    forecast:'先确认候选市场是否值得进入，再为它投入更多时间和费用。',
    demand:'先核实目标用户和实际需要，再定产品范围或扩大触达。',
    product:'先确认能交付的结果和范围，再带着可兑现的承诺去获客。',
    ai:'先验证卡住业务的 AI 工作能否提效，再看下一步经营安排。'
  };

  function explainSchedule(item, path, result, answers, axis, forecast) {
    const primary = path.find(entry => entry.schedule === 'current');
    if (item.schedule === 'current') {
      return item.key === 'direction' && forecast.decision === 'stop'
        ? item.relationship + '方向评分反映之前选得有多清楚。本轮要解决的是原方向还能不能继续投入。'
        : item.relationship;
    }
    if (item.schedule === 'parallel') {
      const context = primary?.key === 'product' && answers.delivery === 'working'
        ? '已经承诺的付费交付照常推进。'
        : primary?.key === 'acquisition' && answers.sale === 'quoted'
          ? '已发出的报价照常跟进。'
          : '手头任务继续推进。';
      const reason = ({
        direction:forecast.decision === 'stop' ? forecast.reason : axis.explanation + waitFor.direction,
        forecast:item.relationship + '所以可以在手头任务进行时，提前为下一轮做这项核对。',
        demand:axis.explanation + waitFor.demand,
        product:axis.explanation + waitFor.product
      })[item.key];
      return context + (reason || item.relationship);
    }
    if (item.schedule === 'deferred') {
      return waitFor[item.afterKey] + (item.key === 'forecast' && item.afterKey !== 'direction' ? item.relationship : '');
    }
    if (item.timing === '阶段核实后再看') return '本轮先做「' + result.title + '」。完成这一步后，用同一项业务的记录更新本环的判断。';
    if (item.timing === '择时改进') return axis.explanation + '本轮先做「' + result.title + '」，有影响经营的记录时再安排这一环。';
    if (item.timing === '保持做法' || item.timing === '沿用并验证') {
      return item.key === 'forecast' ? item.relationship : axis.explanation + '可以沿现有做法继续，用下一次结果复核。';
    }
    return item.relationship || axis.explanation;
  }

  function actionPath(a, r, map, gaps, forecast, market) {
    const early = r.stage === 'early' && !r.provisional;
    const needsStageEvidence = r.stage === 'unconfirmed' || r.provisional;
    const actions = earlyActions(a,gaps);
    const blocked = r.stage === 'early' && forecast?.decision === 'stop';
    return map.map(axis => {
      const {key,score} = axis;
      const links = connections.flatMap(([left,right,detail]) => {
        const other = left === key ? right : right === key ? left : '';
        return other ? [[map.find(axis => axis.key === other).label,detail]] : [];
      });
      const item = (timing,action,relationship) => ({key,label:axis.label,timing,action,relationship,links,fullScore:fullScore[key]});
      if (key === r.priorityAxis) return item(r.priorityLabel,r.action,r.reason);
      if (blocked && key === 'direction') return item('待校准','用现有记录重新比较候选，先选一个值得重新预判的方向。','手头订单继续按约处理。下一轮的新投入用在换过的方向上。');
      if (key === 'forecast' && blocked) return item('回到选方向',market.action,market.why);
      if (blocked && ['demand','product','acquisition'].includes(key)) {
        const action = {
          demand:'保留原访谈和试用记录。新方向的进入条件明确后，从对应的细分人群里找一位真实用户核对需求。',
          product:'按原约定完成手头交付。等新方向的需求核实后，再定新服务的交付物、范围和验收。',
          acquisition:'照常回复已经联系的客户。新方向核实用户和可交付结果后，再选渠道做一轮触达。'
        }[key];
        return item('等新方向通过预判',action,'原方向的限制影响后续新增投入。');
      }
      if (key === 'forecast' && early) {
        const timing = score === 5 ? '保持做法'
          : {direction:'有方向后预判',advance:'沿用并验证',limited:'沿用并验证'}[forecast.decision] || '待校准';
        return item(timing,market.action,market.why);
      }
      if (score === 5) return item('保持做法',key === 'forecast' ? market.action : keepDoing[key],key === 'forecast' ? market.why : axis.explanation);
      if (needsStageEvidence) {
        return item('阶段核实后再看','回看这一环最近一条有原始记录的事实。' + axis.explanation,
          '用同一项业务的记录对照，避免把不同服务的客户、付费或交付成果混在一起判断。');
      }
      if (!early) {
        if (foundationKeys.includes(key)) {
          return item('复查现有业务','用近期真实成交和交付复查当前方向与客群假设。' + keepDoing[key],
            '用近期订单核实方向和客群是否选对，可以判断眼下要优化流程，还是先调整业务方向或服务对象。');
        }
        return item('择时改进',actions[key],'围绕已确定的本轮任务排投入。这一环有影响经营的实际证据时，再安排一轮对照。');
      }
      if (r.priorityAxis === 'forecast' && ['demand','product','acquisition'].includes(key)) {
        return item('前者清楚后再验证',actions[key],'先确认细分市场有空间、窗口尚存且能进入，再投入这个环节。');
      }
      if (gaps.some(gap => gap.key === key)) {
        const directionFirst = r.priorityAxis === 'direction' && key === 'demand' && !currentCustomer(a);
        if (directionFirst) return item('有候选后验证',actions[key],'先知道打算帮谁解决什么问题，才能找到值得访谈的人和要验证的场景。');
        const relationship = key === 'direction'
          ? '用当前任务判断方向能否长期做。如果交付一直超出时间和精力，先收窄方向再扩大服务。'
          : api.userScenarioGap(a) ? '先弄清要服务哪类人和问题在何时发生，再用同一场景的反馈确定产品范围和获客方式。'
            : '用这次试用或订单核对谁愿意为哪个结果付费。反馈持续指向别的人或场景时，先调整客群。';
        return item('待校准',actions[key],relationship);
      }
      if (score === 4) return item('沿用并验证',keepDoing[key],'已有可用依据，用下一次真实订单判断同样的做法还能不能取得相近的结果，再决定要不要调整。');
      if (key === 'ai' && a.aiUse === 'blocked') {
        return item('配合业务减阻',actions[key],'这一步已拖慢当前业务。保留相同任务和验收标准，只改一个环节，才能判断改善是否来自 AI。');
      }
      if (key === 'acquisition' && usableOffer(a) && r.priorityAxis !== 'direction') {
        return item(gaps.length ? '先积累线索' : '下一轮验证',actions[key],gaps.length
          ? '继续跟进手头机会。先用回应确认客群和购买场景，再扩大触达，才能判断哪一类获客动作值得重复。'
          : '方向和客群已有依据，可以沿相近场景重复触达，用真实咨询和付费检验渠道是否可复用。');
      }
      const relationship = {
        product:'先确认目标用户确实需要的结果，再决定第一版交付到哪一步。否则返工和不验收可能源于需求选错。',
        acquisition:'先对齐方向、目标用户和要卖的结果，才能从触达反馈中区分是渠道不合适，还是对象和服务没有对上。',
        ai:'先让真实任务和验收标准清楚，再用相近材料比较 AI 做法和原做法的耗时与质量。'
      };
      return item(key === 'ai' ? '贯穿五环' : '前者清楚后再验证',actions[key],relationship[key]);
    });
  }

  function schedulePath(path, result, a, map, gaps, forecast) {
    const primary = path.find(item => item.key === result.priorityAxis);
    const tagged = path.map(item => item === primary ? {...item,schedule:'current',role:'手头任务'} : item);
    if (!primary || result.stage !== 'early') return tagged;
    const changeDirection = forecast.decision === 'stop';
    if (result.provisional && !changeDirection) return tagged;

    const business = path.filter(item => item.key !== 'ai');
    const scores = new Map(map.map(axis => [axis.key,axis.score]));
    const needsWork = new Set(gaps.map(axis => axis.key));
    if (!['advance','limited'].includes(forecast.decision)) needsWork.add('forecast');
    if (api.userScenarioGap(a) || a.offer !== 'clear' && a.repeatDelivery !== 'repeatable' && !(scores.get('product') >= 4)) needsWork.add('product');
    if (scores.get('acquisition') !== 5) needsWork.add('acquisition');
    if (changeDirection) business.forEach(item => needsWork.add(item.key));

    const candidates = business.filter(item => item !== primary && needsWork.has(item.key));
    // For an AI priority, only the three shared business prerequisites may run alongside it.
    const cutoff = primary.key === 'ai' ? business.findIndex(item => item.key === 'product') : business.indexOf(primary);
    const first = candidates[0];
    const parallel = first && business.indexOf(first) < cutoff ? first : null;
    let preceding = parallel || primary;
    return tagged.map(item => {
      if (item === parallel) return {...item,schedule:'parallel',timing:'最优先处理',role:'同时核实'};
      if (!candidates.includes(item)) return item;
      const afterKey = preceding.key;
      const timing = completedPrerequisite[preceding.key];
      const action = item.key === 'acquisition' && !changeDirection
        ? '用核实后的客群和可交付的产品做一轮触达，记录实际回应、咨询和付款。'
        : item.action;
      preceding = item;
      return {...item,schedule:'deferred',afterKey,timing,action};
    });
  }

  function priorityItems(result) {
    return ['current','parallel'].map(schedule => result.path.find(item => item.schedule === schedule)).filter(Boolean);
  }

  function priorityOverview(result) {
    const items = priorityItems(result);
    const timing = items.every(item => item.timing === items[0]?.timing) ? items[0]?.timing : '本轮优先';
    const labels = items.map(item => item.label + (items.length > 1 ? '（' + item.role + '）' : '')).join('、');
    return [timing || '',labels];
  }

  function voyageCardDetails(result, voyage) {
    const stage = (result.provisional ? '暂按 ' : '') + (result.stageLabel || '独立工作任务') + ' · ' + result.progress;
    // The path is already in five-ring order. Keep it here so the same
    // priorities read in that order on the page, in the PNG and in Markdown.
    const items = result.path.filter(item => ['current','parallel'].includes(item.schedule));
    const businessItems = items.filter(item => item.key !== 'ai');
    const topicNames = businessItems.map(item => api.topics[item.key === 'acquisition' ? 'sales' : item.key].name);
    const boarding = [
      ['航海上船任务专题',topicNames.join('、') || voyage.name],
      ...(topicNames.length && topicNames[0] !== voyage.name ? [['首个上船专题',voyage.name]] : []),
      ['上船前准备',voyage.material],
      ['上船后首个专题的预期产出',voyage.output]
    ];
    if (result.stage === 'work') {
      return {stage,business:[],boarding,ai:[['本轮 AI 行动',result.action || voyage.task]]};
    }
    const business = businessItems.map(item => [
      item.label + ' · ' + item.timing + (items.length > 1 ? '（' + item.role + '）' : ''),
      item.schedule === 'current' ? result.title : item.action
    ]);
    const ai = result.ai ? [[result.ai.timing,result.ai.task]] : [];
    return {stage,business,boarding,ai};
  }

  function voyagePlan(a, r, map, gaps) {
    if (r.stage !== 'early' || r.provisional && !r.eligible) return null;
    const nextTopic = r.topic && r.eligible;
    const provenBase = map.length && !gaps.length && api.forecastReady(a) && (api.recentlyPaid(a) || a.sale === 'paid');
    const directionTopic = api.topics.direction;
    if (nextTopic && r.topicKey === 'forecast' && api.assessForecast(a).decision !== 'direction') {
      return {name:r.topic.name,entry:'direct',task:r.title,material:r.topic.material,output:r.topic.output,
        reason:'已有候选方向。先核对市场能做多大、窗口能持续多久、自己能否进入，再决定投入。'};
    }
    if (nextTopic && (!map.length || provenBase && !['direction','forecast'].includes(r.topicKey))) {
      return {name:r.topic.name,entry:'direct',task:r.title,material:r.topic.material,output:r.topic.output,
        reason:'已有明确方向、真实使用反馈和付费记录。可以等对应专题开放后，带着当前任务直接参加。'};
    }
    if (provenBase && !nextTopic) return null;
    if (api.forecastBlocked(a)) {
      return {name:directionTopic.name,entry:'foundation',task:'换一个方向再做预判',
        material:'带上原方向的预判依据，标出关键硬伤，再列出可以比较的替代方向。',
        output:directionTopic.output,
        reason:'当前方向已有硬伤证据。先换一个候选，再判断它的市场空间、机会窗口与竞争壁垒。',
        currentTask:r.priorityAxis !== 'direction' ? r.title : ''};
    }
    const hasDirection = map.find(axis => axis.key === 'direction')?.score >= 4;
    const hasBusiness = currentCustomer(a) || usableOffer(a) || a.offer === 'draft';
    if (hasDirection && !hasBusiness && api.forecastReady(a)) {
      return {name:directionTopic.name,entry:'foundation',task:'沿已通过预判的方向验证首批用户',
        material:'带上目前的方向说明和市场预判依据，列出能联系的首批潜在用户。',
        output:'确定一个可进入用户需求验证的方向，写清首批目标用户、使用场景和要核对的需求。',
        reason:'方向和进入条件已有依据。从同一细分市场找首批真实用户，核对是不是选对了场景。',
        currentTask:r.priorityAxis !== 'direction' ? r.title : ''};
    }
    const task = hasBusiness ? '带现有业务来校准方向和首批用户' : '比较候选方向，确定要先验证的一个方向';
    const material = hasBusiness
      ? '带上一份服务说明，或一条真实的试用、咨询或订单记录，写清对方遇到了什么、你们尝试到了哪一步。'
      : directionTopic.material;
    const reason = hasDirection
      ? api.forecastReady(a) ? '方向和市场进入条件已有依据。用现有方向核对首批用户、场景和购买理由。'
        : '方向已有一定依据。先补市场预判，确认有进入机会后，再核对首批用户和购买场景。'
      : hasBusiness ? '用手上的服务说明或客户记录先校准方向。方向明确后做市场预判，再核对首批用户。'
        : '先按你长期在意的事、能投入的条件和市场线索筛选方向，再安排一次验证，让后续选用户和做产品有依据。';
    return {name:directionTopic.name,entry:'foundation',task,material,output:directionTopic.output,reason,
      currentTask:r.priorityAxis && r.priorityAxis !== 'direction' ? r.title : ''};
  }

  function aiGuidance(a, result, map, path) {
    const axis = map.find(item => item.key === 'ai');
    const item = path.find(step => step.key === 'ai');
    if (!axis || !item) return null;
    const primary = result.priorityAxis === 'ai';
    const blocked = a.aiUse === 'blocked';
    const validated = a.aiUse === 'validated';
    const focus = map.find(item => item.key === result.priorityAxis && item.key !== 'ai');
    const use = item.links.find(([label]) => label === focus?.label)?.[1];
    const task = primary ? result.action
      : focus?.key === 'demand' && api.userScenarioGap(a)
        ? '用 AI 整理你帮过的人、收到的提问或试用记录，列出反复出现的用户和场景。用原话核对，再找一位符合的人访谈。'
      : use ? '用 AI ' + use
      : blocked ? api.aiExperiment(a)
      : validated ? keepDoing.ai
      : '用 AI 整理最近一轮的咨询、订单和交付记录，找出一处最值得改的环节。回看原始记录确认。';
    return {
      axis, primary, task, fullScore:item.fullScore,
      impact:blocked && a.aiImpact !== 'unknown' ? api.questions.aiImpact.options[a.aiImpact] : '',
      timing:primary ? result.priorityLabel : blocked ? '配合业务减阻' : validated ? '保持做法' : '随业务验证'
    };
  }

  function describeDiagnosis(reported, result) {
    const a = api.resolvedOperatingAnswers(reported);
    const map = result.map.map(axis => ({...axis,...scorers[axis.key](a,axis)}));
    const priority = map.find(axis => axis.key === result.priorityAxis);
    const stageRule = {
      early:'完成 0→1 要同时确认稳定交付和稳定获客，目前至少还有一项没验证。',
      repeat:'两项稳定性已经有证据，本轮聚焦改善现有模式。',
      scale:'主业务已具备两项稳定性，新模式也已经开始验证。',
      unconfirmed:'先核同一项业务的付款、交付和获客记录，补齐后才能确定阶段。',
      work:'本轮聚焦一项真实工作，用材料、结果和验收要求判断下一步。'
    }[result.stage];
    const reason = a.fulfillment === 'dispute' && result.priorityAxis === 'product'
      ? '这单已有付费，范围争议或返工会影响验收，也会影响下一单能否复用。先复核客户真实需求，确认交付件和双方预期的具体偏差，再决定怎么修。'
      : result.reason;
    const stageBasis = result.stageBasis && result.stageBasis.replace(/[。！？]+$/,'') + '。';
    const gaps = map.filter(axis => foundationKeys.includes(axis.key) && hasFoundationGap(axis));
    const forecast = map.length ? api.assessForecast(a) : null;
    const market = forecast && forecastWork(a,forecast);
    const current = {
      ...result, reason:result.priorityAxis === 'forecast' ? market.why : reason,
      action:result.priorityAxis === 'forecast' ? market.action : result.action
    };
    const schedule = schedulePath(actionPath(a,current,map,gaps,forecast,market),current,a,map,gaps,forecast);
    const path = schedule.map((item,index) => ({
      ...item, relationship:explainSchedule(item,schedule,current,a,map[index],forecast)
    }));
    const reasoning = [
      ['阶段怎么定',(stageBasis || '') + stageRule],
      [priority ? '为什么先看「' + priority.label + '」' : '本轮判断',current.reason]
    ];
    return {...current,map,reasoning,steps:nextSteps(a,current,market),
      path,ai:aiGuidance(a,current,map,path),voyage:voyagePlan(a,current,map,gaps)};
  }

  Object.assign(api,{describeDiagnosis,priorityItems,priorityOverview,voyageCardDetails,voyageCardTitle,scoreBasis});
})();
