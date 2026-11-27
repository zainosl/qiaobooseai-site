(() => {
  const api = window.ClosedLoop;
  const version = 'closed-loop-v4';
  const live = location.protocol === 'https:' && ['qiaoboose.com','www.qiaoboose.com'].includes(location.hostname);
  const submitUrl = document.querySelector('meta[name="closed-loop-submit-url"]')?.content.trim();
  const id = prefix => {
    if (globalThis.crypto?.randomUUID) return prefix + crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = bytes[6] & 15 | 64;
    bytes[8] = bytes[8] & 63 | 128;
    const hex = Array.from(bytes,byte => byte.toString(16).padStart(2,'0')).join('');
    return prefix + hex.replace(/^(........)(....)(....)(....)/,'$1-$2-$3-$4-');
  };
  const delay = ms => new Promise(resolve => setTimeout(resolve,ms));

  function metadata() {
    const params = new URLSearchParams(location.search);
    let parentUrl = '';
    if (window.parent !== window) {
      try { parentUrl = window.parent.location.href; } catch {}
    }
    return {
      debug_id:id('cld_'), timestamp:new Date().toISOString(),
      source:params.get('source') || params.get('utm_source') || 'closed-loop-v1',
      utm_source:params.get('utm_source') || '', utm_campaign:params.get('utm_campaign') || '',
      page_url:location.href, parent_page_url:parentUrl, referrer:document.referrer,
      user_agent:navigator.userAgent, browser_language:navigator.language,
      screen_size:screen.width + 'x' + screen.height,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
      frontend_version:version, site_commit:version
    };
  }

  function prepare(answers, result, voyage) {
    const data = metadata();
    const stage = result.stageLabel || '独立工作';
    const appointmentAvailable = ['consult','task'].includes(result.service);
    const focus = answers.current_time_focus || [];
    const fields = {...api.questions,...Object.fromEntries([...api.profileFields,...api.evidenceFields(answers)].map(field => [field.id,field]))};
    const answerDetails = Object.fromEntries(Object.entries(answers).flatMap(([key,value]) => {
      const field = fields[key];
      if (!field || key === 'scope') return [];
      const label = option => field.options?.[option] ?? option;
      return [[key,{
        label:field.label,value:Array.isArray(value) ? value.map(label) : label(value),
        ...(field.extraKey && answers[field.extraKey] ? {extra:answers[field.extraKey]} : {})
      }]];
    }));
    return {
      ...data, client_debug_id:data.debug_id, submission_id:id('cl1_'),
      answers:{
        ...answers, primary_question:[result.selected], desired_outcome_label:answers.goal || answers.use || '',
        desired_outcome:answers.goal || answers.use || '',
        stage_self_select:api.stageLabels[answers.stageSelf] || ''
      },
      answer_labels:Object.fromEntries(Object.values(answerDetails).map(answer => [answer.label,answer.value])),
      answer_details:answerDetails,
      computed:{
        occupation_type:answers.occupation_type || '',
        calibrated_stage:stage, diagnostic_stage:result.stage, stage_provisional:result.provisional,
        diagnostic_version:version, progress:result.progress,
        blocker_type:result.topic?.name || result.title,
        priority_problem:result.title, diagnosis_reason:result.reason,
        diagnosis_reasoning:result.reasoning, action_steps:result.steps,
        diagnostic_map:result.map, priority_axis:result.priorityAxis,
        priority_label:result.map.find(axis => axis.key === result.priorityAxis)?.label || '',
        action_path:result.path,
        closure_milestones:result.closure,
        stage_basis:result.stageBasis, evidence:result.evidence,
        next_action:result.action, recommended_check_point:result.check,
        voyage_topic:voyage?.name || '', voyage_eligible:Boolean(voyage), voyage_entry:voyage?.entry || '',
        current_action_focus:focus, execution_focus:focus,
        desired_stage_result:answers.goal || answers.use || '',
        cta_type:appointmentAvailable ? 'P1_RESULT_CONFIRM' : 'P3_SAVE_REPORT',
        user_segment:appointmentAvailable ? 'P1' : 'P3',
        consultation_recommended:appointmentAvailable
      }
    };
  }

  function submissionError(code) {
    return Object.assign(new Error(code),{code});
  }

  async function submit(record) {
    if (!live) return {ok:true,record_id:'preview-' + record.submission_id,preview:true};
    if (navigator.onLine === false) throw submissionError('offline');
    if (!submitUrl?.startsWith('https://')) throw submissionError('notConfigured');
    const body = JSON.stringify(record);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await delay(1000);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(),12000);
      try {
        const response = await fetch(submitUrl,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body,signal:controller.signal
        });
        if ([400,409,413,422].includes(response.status)) throw submissionError('rejected');
        if (response.ok) {
          const receipt = await response.json();
          if (receipt?.ok === true && receipt.submission_id === record.submission_id
            && typeof receipt.record_id === 'string' && receipt.record_id.trim()) return receipt;
        }
      } catch (error) {
        if (error.code === 'rejected') throw error;
        if (navigator.onLine === false) throw submissionError('offline');
      } finally {
        clearTimeout(timeout);
      }
    }
    throw submissionError('unconfirmed');
  }

  api.transport = {live,prepare,submit};
})();
