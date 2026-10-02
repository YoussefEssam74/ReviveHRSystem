// ==================== RECRUITMENT & HIRING ====================
let _recTab = 'candidates';
let _recView = 'kanban';
let _recSearch = '';
let _recStage = 'All';
let _recVac = 'All';
let _recSel = [];
let _recWizStep = 1;
let _recCandTab = 'active';   // active | hired | waiting | rejected | blocked
let _ivFilter = 'all';        // all | pending | completed | cancelled
let _vrTab = 'pending';       // pending | approved | rejected | all
let _vacSelCand = null;       // selected candidate in the vacancy action panel
let _ivMonth = '2026-09';   // interviews calendar month (YYYY-MM)
let _ivDay = '2026-09-10';  // selected calendar day
let _waStep = 1;            // waiting-list assign wizard step
let _waTerms = null;        // terms captured across assign steps
let _waCtx = null;          // { wid, vacId } assign context

function toggleBulk(id, checked) {
  if (checked) { if (!_recSel.includes(id)) _recSel.push(id); }
  else { _recSel = _recSel.filter(x => x !== id); }
  renderAll();
}

const _stageMeta = {
  'Applied': { cls: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  'Screening': { cls: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  'First Interview': { cls: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  'Second Interview': { cls: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  'Accepted': { cls: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  'Rejected': { cls: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  'Hired': { cls: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500' },
};
const _pipStages = ['Applied','Screening','First Interview','Second Interview','Accepted','Rejected','Hired'];
const _pipColors = { Applied:'#7c3aed', Screening:'#2563eb', 'First Interview':'#d97706', 'Second Interview':'#ea580c', Accepted:'#16a34a', Rejected:'#ef4444', Hired:'#0d9488' };
function _stageBadge(s) { const m = _stageMeta[s]||_stageMeta.Applied; return `<span class="badge ${m.cls} text-[9px]">${s}</span>`; }
function _initials(n) { return (n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function _evalStars(r) { if(!r||!(r>0)) return '<span class="text-[9px] text-charcoal-300">N/A</span>'; return `<span class="text-[10px] text-yellow-500">${'★'.repeat(Math.min(5,Math.round(r||0)))}${'☆'.repeat(Math.max(0,5-Math.round(r||0)))}</span>`; }
function _formLine(c) { const f=c.form||{}; return `Applied ${formatDate(c.appliedDate)} · ${f.shift||'Any'} shift` + (f.salaryExp?` · ${f.salaryExp.toLocaleString()} EGP expected`:''); }
function _matchingVacancies(position) {
  const open = MOCK.vacancies.filter(v=>v.status==='Open');
  const p = String(position||'').toLowerCase().trim();
  if (!p) return [];
  // partial match: 'Trainer' also matches an open 'Senior Trainer' seat
  return open.filter(v => { const vp = v.position.toLowerCase(); return vp === p || vp.includes(p) || p.includes(vp); });
}
function _gymOptions(sel) { return ['Nasr City','Heliopolis','6th October'].map(g=>`<option ${sel===g?'selected':''}>${g}</option>`).join(''); }

function candidatesControlsHTML() {
  const n = st => MOCK.candidates.filter(st).length;
  const groups = [
    ['active', 'In Process', n(c => !c.blocked && ['Applied','Screening','First Interview','Second Interview','Accepted'].includes(c.stage)), 'badge-blue'],
    ['rejected', 'Rejected', n(c => !c.blocked && c.stage === 'Rejected'), 'badge-red'],
  ];
  const sub = groups.map(([k, label, cnt, cls]) => `<button onclick="_recCandTab='${k}';renderAll()" class="tab-btn ${_recCandTab===k?'active':''}" style="padding:0.3rem 0.6rem;font-size:10px">${label}${cnt?` <span class="badge ${cls} text-[8px]">${cnt}</span>`:''}</button>`).join('');
  const view = _recCandTab==='active' ? `<span class="w-px h-4 bg-charcoal-300 mx-0.5 flex-shrink-0"></span><button onclick="_recView='kanban';renderAll()" class="tab-btn ${_recView==='kanban'?'active':''}" style="padding:0.3rem 0.5rem;font-size:10px" title="Board view">&#9638;</button><button onclick="_recView='list';renderAll()" class="tab-btn ${_recView==='list'?'active':''}" style="padding:0.3rem 0.5rem;font-size:10px" title="Table view">&#9776;</button>` : '';
  return `<div class="inline-flex items-center gap-0.5 flex-wrap ml-auto">${sub}${view}</div>`;
}

function renderRecruitment() {
  const showAll = DEMO.showAll;
  const canApproveVR = showAll || hasPermission('recruitment.vacancy_request.approve');
  const canManageVac = showAll || hasPermission('recruitment.vacancies.manage');
  const canHire = showAll || hasPermission('recruitment.hire.approve');
  const canCandidates = showAll || hasPermission('recruitment.candidates.manage');

  const openVacancies = MOCK.vacancies.filter(v=>v.status==='Open');
  const totalCandidates = MOCK.candidates.length;
  const pendingVR = MOCK.vacancyRequests.filter(r=>r.status==='Pending');
  const interviewsSorted = [...MOCK.interviews].sort((a,b)=> (a.date+b.time> b.date+b.time?1:-1));
  const thisWeek = interviewsSorted.filter(iv => (iv.date >= '2026-09-10' && iv.date <= '2026-09-16')).length;

  // Tab notice badges: pending / uncompleted / new items per tab (replaces the overview stat tiles)
  const _badge = (n, cls) => n > 0 ? ` <span class="badge ${cls} text-[9px]">${n}</span>` : '';
  const newApps = MOCK.candidates.filter(c => !c.blocked && c.stage === 'Applied').length;
  const pendingIv = MOCK.interviews.filter(iv => ['Scheduled','Invited','Draft'].includes(iv.status)).length;
  const incompleteNc = MOCK.newComers.filter(n => n.progress < 100).length;

  const tabs = [
    {id:'candidates',label:'Candidates',b:_badge(newApps,'badge-blue')},
    {id:'overview',label:'Summary'},
    {id:'interviews',label:'Interviews',b:_badge(pendingIv,'badge-yellow')},
    {id:'newcomers',label:'New Comers',b:_badge(incompleteNc,'badge-green')},
    {id:'vacancies',label:'Vacancies',b:_badge(openVacancies.length,'badge-brand')},
  ];
  const _navPages = ['candidates','overview','interviews','newcomers','vacancies','waiting','vacancy-requests'];
  if (!_navPages.includes(_recTab)) _recTab = 'candidates';
  if (_recTab === 'vacancy-requests' && !canApproveVR) _recTab = 'candidates';

  let body = '';
  if (_recTab === 'overview') {
    body = overviewBody(openVacancies,totalCandidates,pendingVR,totalResults());
  }
  else if (_recTab === 'vacancies') { body = vacanciesBody(canManageVac); }
  else if (_recTab === 'candidates') { body = candidatesBody(canHire, canCandidates, showAll); }
  else if (_recTab === 'interviews') { body = interviewsBody(interviewsSorted); }
  else if (_recTab === 'waiting') { body = waitingBody(); }
  else if (_recTab === 'newcomers') { body = newcomersBody(); }
  else if (_recTab === 'vacancy-requests') { body = vacancyRequestsBody(); }

  const kpiLine = `${openVacancies.length} open · ${totalCandidates} candidates · ${pendingVR.length} requests pending`;

  return `<div class="space-y-2.5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div><h1 class="text-base font-bold text-charcoal-900">Recruitment & Hiring</h1><p class="text-xs text-charcoal-500 mt-0.5">${kpiLine} · ${thisWeek} interviews this week</p></div>
      ${canManageVac && _recTab==='vacancies'?`<button onclick="openNewVacancy()" class="btn btn-sm btn-primary" style="height:23px;font-size:10px;padding:0 8px"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Create Vacancy</button>`:''}
    </div>
    <div class="flex items-center justify-between gap-2 flex-wrap bg-charcoal-100 rounded-xl p-1 border border-charcoal-200">
      <div class="inline-flex flex-wrap items-center gap-1">
        ${tabs.map(t=>`<button onclick="_recTab='${t.id}';renderAll()" class="tab-btn ${_recTab===t.id?'active':''}">${t.label}${t.b||''}</button>`).join('')}
      </div>
      ${_recTab==='candidates'?candidatesControlsHTML():''}
    </div>
    <div>${body}</div>
  </div>`;
}

function totalResults() {
  return MOCK.candidates.length;
}

// ==================== OVERVIEW ====================
function overviewBody(openVacs,pendingVR,pendVRArr,candTotal) {
  return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
    ${waitingMatchHTML()}
    ${openVacs.length?`<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50"><p class="bento-label">OPEN VACANCIES</p><button onclick="_recTab='vacancy-requests';renderAll()" class="text-[10px] text-brand-600 font-semibold hover:underline">Manage</button></div>
      <div class="divide-y divide-charcoal-50">${openVacs.map(v=>`<div class="p-3 flex items-center justify-between gap-2" onclick="openVacancyAction('${v.id}')" style="cursor:pointer">
        <div class="min-w-0">
          <p class="text-xs font-semibold text-charcoal-900">${v.position}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${v.gym} · ${v.headcount} position${v.headcount>1?'s':''}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="badge ${v.urgency==='High'?'badge-red':v.urgency==='Medium'?'badge-yellow':'badge-blue'} text-[9px]">${v.urgency}</span>
          <span class="text-[10px] font-bold text-brand-600">${v.candidates}<span class="text-charcoal-400 font-normal"> app</span></span>
        </div>
      </div>`).join('')}</div>
    </div>`:''}
  </div>`;
}

// ==================== PIPELINE BOARD ====================
function pipelineBoardHTML(openVacs) {
  return `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden flex flex-col flex-1 min-h-0">
    <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50 flex-shrink-0">
      <p class="bento-label">HIRING PIPELINE</p>
      <div class="hidden md:flex items-center gap-2.5 text-[9px] text-charcoal-500">${_pipStages.map(s=>`<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:${_pipColors[s]}"></span>${s}</span>`).join('')}</div>
    </div>
    <div class="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
      <div class="flex items-stretch gap-2 p-2.5 min-w-[900px]">
        ${_pipStages.map(stage=>{
          const list = MOCK.candidates.filter(c=>c.stage===stage);
          return `<div class="flex-1 min-w-[190px] max-w-[240px] bg-charcoal-50 rounded-xl p-2 flex flex-col ${stage==='Rejected'?'bg-red-50/50':''}">
            <div class="flex items-center justify-between px-1 mb-1.5 flex-shrink-0">
              <p class="text-[10px] font-semibold uppercase tracking-wide ${stage==='Rejected'?'text-red-500':'text-charcoal-500'} flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${_pipColors[stage]}"></span>${stage}</p>
              <span class="badge badge-gray">${list.length}</span>
            </div>
            <div class="space-y-1.5 min-h-[80px] flex-1 overflow-y-auto pr-0.5 candidate-scroll">
              ${list.map(c=>_pipelineCard(c, stage)).join('')||`<div class="bg-white rounded-lg border border-dashed border-charcoal-200 p-3 text-center"><p class="text-[10px] text-charcoal-400">No candidates</p></div>`}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="px-3 py-2 border-t border-charcoal-100 text-[9px] text-charcoal-400 flex-shrink-0">Pipeline follows Applied → Screening → 1st / 2nd interview → decision. Accepted candidates either match an open vacancy or join the Waiting List below for later assignment.</div>
  </div>`;
}

function _pipelineCard(c, stage) {
  const f = c.form||{};
  let detailRows = '';
  if (stage==='Applied') {
    detailRows = `<p class="text-[9px] text-charcoal-500">${f.source||'—'} · ${f.gymPref||'—'}</p><p class="text-[9px] text-charcoal-500">${f.expYears||'?'} yrs exp · ${_formLine(c)}</p>`;
  } else if (stage==='Screening') {
    detailRows = c.screen ? `<p class="text-[9px] text-charcoal-500">Screened by <b>${c.screen.by}</b> · ${formatDate(c.screen.date)}</p><div class="flex items-center gap-1.5 mt-0.5">${_evalStars(c.screen.eval)}<span class="badge ${c.screen.verdict==='Pass'?'badge-success':'badge-red'} text-[8px]">${c.screen.verdict}</span></div>` : `<p class="text-[9px] text-charcoal-400">Screening pending</p>`;
  } else if (stage==='First Interview') {
    const iv=c.iv1;
    detailRows = iv ? `<p class="text-[9px] text-charcoal-500">With <b>${iv.by}</b> · ${iv.date} · ${iv.type}</p>${iv.verdict==='Scheduled'||iv.verdict==='Invited'?`<span class="badge badge-blue text-[8px]">${iv.verdict}</span>`:`<div class="flex items-center gap-1.5 mt-0.5">${_evalStars(iv.eval)}<span class="badge ${iv.verdict==='Pass'?'badge-success':'badge-red'} text-[8px]">${iv.verdict}</span></div>`}` : `<p class="text-[9px] text-charcoal-400">Not scheduled</p>`;
  } else if (stage==='Second Interview') {
    const iv=c.iv2;
    detailRows = iv ? `<p class="text-[9px] text-charcoal-500">With <b>${iv.by}</b> · ${iv.date} · ${iv.type}</p>${iv.verdict==='Scheduled'||iv.verdict==='Invited'?`<span class="badge badge-blue text-[8px]">${iv.verdict}</span>`:`<div class="flex items-center gap-1.5 mt-0.5">${_evalStars(iv.eval)}<span class="badge ${iv.verdict==='Pass'?'badge-success':'badge-red'} text-[8px]">${iv.verdict}</span></div>`}` : `<p class="text-[9px] text-charcoal-400">Not scheduled</p>`;
  } else if (stage==='Accepted') {
    const d=c.decision;
    const m=_matchingVacancies(c.position);
    detailRows = `<p class="text-[9px] text-charcoal-500">By <b>${d?d.by:'—'}</b> · ${d?formatDate(d.date):''}${d&&d.note?` — ${d.note}`:''}</p>${m.length?`<p class="text-[9px] text-brand-700">Matches: ${m.map(v=>v.position+' @ '+v.gym).join(', ')}</p>`:''}`;
  } else if (stage==='Rejected') {
    detailRows = `<p class="text-[9px] text-red-600">${c.rejectReason||'—'}</p><p class="text-[9px] text-charcoal-400">Rejected ${formatDate(c.rejectedDate)} by ${c.rejectedBy||'—'}</p>`;
  } else if (stage==='Hired') {
    detailRows = `<p class="text-[9px] text-charcoal-500">Starts ${formatDate(c.hiredDate)}</p>`;
  }
  return `<div class="bg-white rounded-lg border ${stage==='Rejected'?'border-red-100':'border-charcoal-200'} p-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onclick="openCandidateDetail('${c.id}')">
    <div class="flex items-center justify-between gap-2">
      <p class="text-[11px] font-semibold text-charcoal-900 truncate">${c.name}</p>
      ${c.rating?`<span class="text-[10px] text-yellow-500 flex-shrink-0">${'★'.repeat(c.rating)}</span>`:''}
    </div>
    <p class="text-[9px] text-charcoal-500 mb-1">${c.position}</p>
    ${detailRows}
    <div class="flex justify-end mt-1.5"><span class="text-[8px] text-brand-600 font-semibold uppercase">View details →</span></div>
  </div>`;
}

// ==================== WAITING LIST + MATCH ====================
function waitingMatchHTML() {
  const entries = MOCK.waitingList;
  const canCandidates = DEMO.showAll || hasPermission('recruitment.candidates.manage');
  return `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden flex flex-col min-h-0">
    <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
      <p class="bento-label">WAITING LIST — AWAITING MATCH</p>
      <button onclick="_recTab='waiting';renderAll()" class="text-[10px] text-brand-600 font-semibold hover:underline">View All</button>
    </div>
    <div class="divide-y divide-charcoal-50 flex-1 min-h-0 overflow-y-auto">
      ${entries.map(w=>{
        const matches=_matchingVacancies(w.position||'');
        return `<div class="p-3">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${_initials(w.name)}</div>
              <div class="min-w-0"><p class="text-[11px] font-medium text-charcoal-900 truncate">${w.name}</p><p class="text-[9px] text-charcoal-500">${w.position||'Any'} · since ${formatDate(w.since)}</p></div>
            </div>
            <span class="text-[9px] text-charcoal-400 flex-shrink-0">${w.source||'—'}</span>
          </div>
          <div class="flex flex-wrap gap-1 mt-1.5">${(w.skills||[]).map(s=>`<span class="badge badge-purple text-[8px]">${s}</span>`).join('')}</div>
          <p class="text-[9px] text-charcoal-600 mt-1">${w.note||''}</p>
          <div class="flex items-center justify-between gap-2 mt-2">
            <div class="min-w-0">
              ${matches.length?`<p class="text-[9px] text-brand-700 font-semibold">✓ Match: ${matches.map(v=>v.position+' @ '+v.gym).join(', ')}</p>`:`<p class="text-[9px] text-charcoal-400">No open vacancy for this role yet.</p>`}
            </div>
            ${canCandidates?`<button onclick="assignWaitingToGym('${w.id}')" class="btn btn-sm btn-primary flex-shrink-0">Assign to Gym</button>`:''}
          </div>
        </div>`;
      }).join('')||'<div class="p-6 text-center text-xs text-charcoal-400">Waiting list empty</div>'}
    </div>
  </div>`;
}

function assignWaitingToGym(wid, vacId) {
  const w = MOCK.waitingList.find(x=>x.id===wid); if(!w) return;
  let matches = _matchingVacancies(w.position||'');
  if (vacId) { const only = MOCK.vacancies.find(x=>x.id===vacId && x.status==='Open'); if (only) matches = [only]; }
  const target = matches[0] || null;
  if(!target) { showToast('No open matching position - create a vacancy first','info'); return; }
  _waCtx = { wid, vacId: target.id };
  _waStep = 1;
  _waTerms = null;
  renderAssignWaitingModal();
}

function waCaptureStep() {
  const g = id => document.getElementById(id);
  _waTerms = _waTerms || {};
  if (g('assign-vac')) _waTerms.pos = g('assign-vac').value;
  if (g('assign-gym')) _waTerms.gym = g('assign-gym').value;
  if (g('assign-start')) _waTerms.start = g('assign-start').value;
  if (g('wa-salary')) {
    _waTerms.salary = Number(g('wa-salary').value) || 8000;
    _waTerms.increase = Number(g('wa-increase').value) || 0;
    _waTerms.leave = Number(g('wa-leave').value) || 21;
    _waTerms.email = g('wa-email').value || '';
    _waTerms.pass = g('wa-pass').value || 'Revive@2026';
    _waTerms.role = g('wa-role').value || 'Emp';
    _waTerms.level = g('wa-level') ? g('wa-level').value : 'Junior';
  }
}

function renderAssignWaitingModal() {
  const w = MOCK.waitingList.find(x=>x.id===_waCtx.wid); if(!w) return;
  const matches = _matchingVacancies(w.position||'');
  const target = matches.find(v=>v.id===_waCtx.vacId) || matches[0] || null;
  if (!target) { showToast('No open matching position - create a vacancy first','info'); return; }
  const canHire = DEMO.showAll || hasPermission('recruitment.hire.approve');
  if (!canHire) { openModal(`Assign ${w.name}`, `<div class="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-[11px] text-yellow-800">Hiring and assigning require <code>recruitment.hire.approve</code>.</div>`, { footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' }); return; }

  const steps = ['Assignment','Terms','Confirm'];
  let content, footer;

  if (_waStep===1) {
    const vacField = matches.length > 1
      ? `<div class="bg-charcoal-50 rounded-lg p-2.5 col-span-2"><p class="text-[10px] text-charcoal-500">Matching open positions - pick the exact seat</p><select id="assign-vac" class="form-select" style="font-size:0.8125rem;width:100%">${matches.map(m=>`<option value="${m.position}" ${m.id===_waCtx.vacId?'selected':''}>${m.position} - ${m.gym} (${m.headcount} seat${m.headcount>1?'s':''}, ${m.urgency} urgency)</option>`).join('')}</select></div>`
      : `<div class="bg-charcoal-50 rounded-lg p-2.5 col-span-2"><p class="text-[10px] text-charcoal-500">Matching open position</p><p class="text-xs font-semibold text-charcoal-900">${target.position} - ${target.gym} | ${target.headcount} seat${target.headcount>1?'s':''} | ${target.urgency} urgency</p></div>`;
    content = `<div class="space-y-3">
      <div class="bg-purple-50 border border-purple-100 rounded-lg p-3 text-[11px] text-purple-800">Assigning ${w.name} (${w.position||'Any role'}) - he already passed the whole interview pipeline; this converts him into an active hire and starts onboarding.</div>
      <div class="grid grid-cols-2 gap-2">
        ${vacField}
        <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Gym</p><select id="assign-gym" class="form-select" style="font-size:0.8125rem;width:100%">${_gymOptions((_waTerms&&_waTerms.gym)||target.gym)}</select></div>
      </div>
      <div><label class="form-label">Start date</label><input id="assign-start" type="date" value="${(_waTerms&&_waTerms.start)||'2026-10-01'}" class="form-input"></div>
    </div>`;
    footer = `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="waCaptureStep();_waStep=2;renderAssignWaitingModal();" class="btn btn-sm btn-primary">Continue &rarr; Terms</button>`;
  } else if (_waStep===2) {
    const roleOpts = [...new Set(['Emp','Team Leader','Branch Manager','HR', ...(MOCK.roleTemplates||[]).map(t=>t.name)])];
    const defEmail = w.name.toLowerCase().replace(/\s+/g,'.')+'@revive.com';
    content = `<div class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div><label class="form-label">Salary (EGP/month)</label><input type="number" id="wa-salary" value="${(_waTerms&&_waTerms.salary)||8000}" class="form-input" required></div>
        <div><label class="form-label">Annual increase %</label><input type="number" id="wa-increase" value="${(_waTerms&&_waTerms.increase!=null)?_waTerms.increase:7}" min="0" max="50" class="form-input" required></div>
        <div><label class="form-label">Annual leave days</label><input type="number" id="wa-leave" value="${(_waTerms&&_waTerms.leave!=null)?_waTerms.leave:21}" min="0" class="form-input" required></div>
        <div><label class="form-label">Employment level</label><select id="wa-level" class="form-select">${['Junior','Mid','Senior'].map(l=>`<option ${(_waTerms&&_waTerms.level===l)?'selected':''}>${l}</option>`).join('')}</select></div>
        <div><label class="form-label">Work email</label><input type="email" id="wa-email" value="${(_waTerms&&_waTerms.email)||defEmail}" class="form-input" required></div>
        <div><label class="form-label">Initial password</label><input type="text" id="wa-pass" value="${(_waTerms&&_waTerms.pass)||'Revive@2026'}" class="form-input font-mono" required></div>
        <div class="col-span-2"><label class="form-label">System role</label><select id="wa-role" class="form-select">${roleOpts.map(r=>`<option value="${r}" ${(_waTerms&&_waTerms.role===r)||(!_waTerms&&r==='Emp')?'selected':''}>${r}</option>`).join('')}</select></div>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-[10px] text-blue-800"><b>Face-ID:</b> the attendance photo is <b>not taken here</b> - the employee is enrolled at the branch by their <b>Branch Manager</b> at the Attendance Station on the first day.</div>
    </div>`;
    footer = `<button onclick="waCaptureStep();_waStep=1;renderAssignWaitingModal();" class="btn btn-sm btn-secondary">Back</button><button onclick="waCaptureStep();_waStep=3;renderAssignWaitingModal();" class="btn btn-sm btn-primary">Continue &rarr; Confirm</button>`;
  } else {
    const t = _waTerms || {};
    content = `<div class="text-center py-2">
      <div class="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <p class="text-sm font-bold text-charcoal-900 mt-2">Ready to hire ${w.name}</p>
      <div class="grid grid-cols-2 gap-2 mt-3 text-left">
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Position / Gym</p><p class="text-[11px] font-semibold text-charcoal-900">${t.pos||target.position} @ ${t.gym||target.gym}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Start date</p><p class="text-[11px] font-semibold text-charcoal-900">${t.start||'2026-10-01'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Salary / increase</p><p class="text-[11px] font-semibold text-charcoal-900">${(t.salary||8000).toLocaleString()} EGP Â· ${t.increase!=null?t.increase:7}% / yr</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Leave / level</p><p class="text-[11px] font-semibold text-charcoal-900">${t.leave||21} days Â· ${t.level||'Junior'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Email</p><p class="text-[11px] font-semibold text-charcoal-900 break-all">${t.email||w.name.toLowerCase().replace(/\s+/g,'.')+'@revive.com'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Role / password</p><p class="text-[11px] font-semibold text-charcoal-900">${t.role||'Emp'} Â· ${t.pass||'Revive@2026'}</p></div>
      </div>
      <p class="text-[10px] text-charcoal-400 mt-2">Creates the employee account with all data above, decrements the vacancy headcount and starts the onboarding checklist.</p>
    </div>`;
    footer = `<button onclick="waCaptureStep();_waStep=2;renderAssignWaitingModal();" class="btn btn-sm btn-secondary">Back</button><button onclick="confirmWaitingAssign('${w.id}','${(t.pos&&t.pos)||target.position}')" class="btn btn-sm btn-success">Confirm Hire &amp; Create Employee</button>`;
  }

  const stepperHtml = `<div class="flex items-center gap-1.5">
    ${steps.map((sl,i)=>{
      const n=i+1; const cur=_waStep===n; const done=_waStep>n;
      return `<div class="flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${done?'bg-brand-500 text-white':cur?'bg-brand-100 text-brand-700 border border-brand-500':'bg-charcoal-100 text-charcoal-500'}">${done?'&#10003;':n}</span>
        <span class="text-[9px] font-medium ${cur?'text-brand-700':done?'text-charcoal-700':'text-charcoal-400'}">${sl}</span>
      </div>${n<steps.length?'<div class="flex-1 h-px bg-charcoal-100"></div>':''}`;
    }).join('')}
  </div>`;

  openModal(`Assign ${w.name} - Hiring Steps`, `<div class="space-y-3">${stepperHtml}${content}</div>`, { wide:true, footer });
}

function confirmWaitingAssign(wid, position) {
  const w = MOCK.waitingList.find(x=>x.id===wid); if(!w) return;
  const t = _waTerms || {};
  position = document.getElementById('assign-vac')?.value || t.pos || position;
  const gym = document.getElementById('assign-gym')?.value || t.gym || 'Nasr City';
  const start = document.getElementById('assign-start')?.value || t.start || '2026-10-01';
  const salary = t.salary || 8000;
  const annualIncrease = (t.increase != null) ? t.increase : 0;
  const leaveDays = t.leave || 21;
  const level = t.level || 'Junior';
  const email = t.email || (w.name.toLowerCase().replace(/\s+/g, '.') + '@revive.com');
  const password = t.pass || 'Revive@2026';
  const role = t.role || 'Emp';
  _waTerms = null;
  const initials = w.name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
  const newEmp = { id:'EMP-'+Math.floor(Math.random()*900+100), name:w.name, initials, position, level, gym, status:'Active', startDate:start, phone:'-', email, password, role, annualIncrease, leaveDays, nationalId:'-', contractType:'Full-time', salary, daysOff:leaveDays, daysUsed:0, documents:[], medicalHistory:[], notes:`Assigned from recruitment waiting list on Sep 9, 2026. Terms: ${salary} EGP/mo, ${annualIncrease}% annual increase, ${leaveDays} leave days, role ${role}. Face-ID enrollment pending at branch (Branch Manager).` };
  MOCK.employees.push(newEmp);
  MOCK.newComers.unshift({ id:'NC-'+Date.now(), name:w.name, position:position+' - '+level, startDate:start, progress:0, checklist:[['ID & contract signed',false],['Uniform issued',false],['System access created',false],['Branch tour completed',false],['Welcome meeting with BM',false]] });
  MOCK.auditLog.unshift({ id:'al-'+Date.now(), action:'Waiting-list candidate assigned to gym', user:MOCK.currentUser.fullName, target:w.name, detail:position+' @ '+gym+' | '+salary+' EGP | role '+role, timestamp:'2026-09-09 '+new Date().toLocaleTimeString(), gym });
  MOCK.waitingList = MOCK.waitingList.filter(x=>x.id!==wid);
  closeModal();
  showToast(w.name+' hired at '+gym+' - employee account created with all terms', 'success');
  renderAll();
}

// ==================== VACANCY ACTION PANEL (overview quick actions) ====================
function openVacancyAction(vacId) {
  const vac = MOCK.vacancies.find(v=>v.id===vacId); if(!vac) return;
  const canHire = DEMO.showAll || hasPermission('recruitment.hire.approve');
  const matched = MOCK.candidates.filter(c => c.position === vac.position && !c.blocked && c.stage !== 'Hired' && c.stage !== 'Rejected');
  const waitingMatch = MOCK.waitingList.filter(w => _matchingVacancies(w.position||'').some(v => v.id === vac.id));
  _vacSelCand = matched.some(c=>c.id===_vacSelCand) ? _vacSelCand : (matched[0] ? matched[0].id : null);
  const bm = MOCK.employees.find(e => e.position === 'Branch Manager' && e.gym === vac.gym);
  const srcReq = MOCK.vacancyRequests.find(r => r.position === vac.position && r.gym === vac.gym);
  const requestedBy = vac.requestedBy || (srcReq ? srcReq.submittedBy : null) || (bm ? bm.name : '-');
  const offerSalary = vac.salary || (srcReq && srcReq.salary) || (vac.position.includes('Trainer') ? 14000 : vac.position === 'Receptionist' ? 7500 : vac.position === 'Cleaner' ? 5000 : 6000);
  const offerShift = vac.shift || (srcReq && srcReq.shift) || 'Morning';
  const gymInfo = MOCK.gymList.find(g => g.branch === vac.gym);
  openModal(`${vac.position} — ${vac.gym}`, `<div class="space-y-3">
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Open seats</p><p class="text-xs font-semibold text-charcoal-900">${vac.headcount} seat${vac.headcount>1?'s':''} · ${vac.status}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Urgency / pipeline</p><p class="text-xs font-semibold text-charcoal-900">${vac.urgency} · ${vac.candidates} applicant${vac.candidates===1?'':'s'}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Requested by</p><p class="text-xs font-semibold text-charcoal-900">${requestedBy}${bm && requestedBy === bm.name ? ' (Branch Manager)' : ''}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Gym / branch</p><p class="text-xs font-semibold text-charcoal-900">${gymInfo ? gymInfo.name + ' — ' + vac.gym : vac.gym}</p><p class="text-[9px] text-charcoal-500 mt-0.5">Branch manager: ${bm ? bm.name : '-'}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Expected salary</p><p class="text-xs font-semibold text-charcoal-900">${offerSalary.toLocaleString()} EGP</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Shift</p><p class="text-xs font-semibold text-charcoal-900">${offerShift} shift</p></div>
    </div>

    <div>
      <p class="bento-label text-charcoal-500 mb-1.5">WAITING LIST — ASSIGN DIRECTLY TO THIS SEAT</p>
      ${waitingMatch.length ? waitingMatch.map(w=>`<div class="bg-purple-50 border border-purple-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
        <div class="min-w-0"><p class="text-[11px] font-semibold text-charcoal-900">${w.name}</p><p class="text-[9px] text-charcoal-500">${(w.skills||[]).join(' · ')} — waiting since ${formatDate(w.since)}</p></div>
        ${canHire?`<button onclick="closeModal();assignWaitingToGym('${w.id}','${vac.id}')" class="btn btn-sm btn-primary flex-shrink-0">Assign to this seat</button>`:''}
      </div>`).join('') : '<p class="text-[10px] text-charcoal-400">No waiting-list candidate matches this position.</p>'}
    </div>

    <div>
      <p class="bento-label text-charcoal-500 mb-1.5">MATCHED CANDIDATES — CLICK TO SELECT, THEN HIRE BESIDE CLOSE</p>
      <div class="space-y-1.5">
      ${matched.length ? matched.map(c => { const f = c.form||{}; return `<div class="border rounded-lg p-2.5 cursor-pointer transition-all ${_vacSelCand===c.id?'border-brand-500 ring-1 ring-brand-300 bg-brand-50/40':'border-charcoal-200'}" onclick="_vacSelCand='${c.id}';openVacancyAction('${vac.id}')">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${_initials(c.name)}</div>
            <div class="min-w-0"><p class="text-[11px] font-semibold text-charcoal-900">${c.name}</p><p class="text-[9px] text-charcoal-500">${f.source||'-'} · ${f.expYears||'?'} yrs · expected ${f.salaryExp?f.salaryExp.toLocaleString():'-'} EGP · ${c.phone}</p></div>
          </div>
          <span class="text-[10px] text-yellow-500 flex-shrink-0">${'★'.repeat(c.rating)}${'☆'.repeat(Math.max(0,5-c.rating))}</span>
        </div>
        <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
          ${_stageBadge(c.stage)}
          ${c.screen?`<span class="badge ${c.screen.verdict==='Pass'?'badge-success':'badge-red'} text-[8px]">Screen: ${c.screen.verdict} ${c.screen.eval}/5</span>`:''}
          ${c.iv1?`<span class="badge ${c.iv1.verdict==='Pass'?'badge-success':'badge-blue'} text-[8px]">IV1: ${c.iv1.verdict}</span>`:''}
          ${c.iv2?`<span class="badge ${c.iv2.verdict==='Pass'?'badge-success':'badge-blue'} text-[8px]">IV2: ${c.iv2.verdict}</span>`:''}
        </div>
        <div class="flex gap-1.5 mt-2">
          <button onclick="event.stopPropagation();closeModal();openCandidateDetail('${c.id}')" class="btn btn-sm btn-secondary flex-1">Full data &amp; reviews</button>
          <span class="text-[9px] text-charcoal-400 self-center">${_vacSelCand===c.id?'&#10003; Selected — use the Hire button beside Close':'click card to select'}</span>
        </div>
      </div>`; }).join('') : '<p class="text-[10px] text-charcoal-400">No active candidate for this position yet.</p>'}
      </div>
    </div>
    ${canHire?'':'<p class="text-[10px] text-charcoal-400">Hiring and assigning require <code>recruitment.hire.approve</code>.</p>'}
  </div>`, { wide:true, footer:`<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>${canHire && _vacSelCand ? `<button onclick="hireFromVacancy('${_vacSelCand}','${vac.id}')" class="btn btn-sm btn-primary">Hire ${(MOCK.candidates.find(x=>x.id===_vacSelCand)||{}).name || ''} — Create Account</button>` : ''}` });
}

function hireFromVacancy(cid, vacId) {
  const c = MOCK.candidates.find(x=>x.id===cid); if(!c) return;
  const vac = MOCK.vacancies.find(v=>v.id===vacId); if(!vac) return;
  if (!(DEMO.showAll || hasPermission('recruitment.hire.approve'))) { showToast('Hire requires recruitment.hire.approve','error'); return; }
  const f = c.form || {};
  const reviews = [
    c.screen ? `Screening ${c.screen.verdict} (${c.screen.eval}/5) by ${c.screen.by}` : null,
    c.iv1 ? `1st interview ${c.iv1.verdict} - ${c.iv1.by}` : null,
    c.iv2 ? `2nd interview ${c.iv2.verdict} - ${c.iv2.by}` : null,
    c.decision ? `Decision ${c.decision.verdict} by ${c.decision.by}` : null,
  ].filter(Boolean).join(' | ');
  const level = c.rating >= 4 ? 'Senior' : c.rating >= 3 ? 'Mid' : 'Junior';
  const initials = c.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  MOCK.employees.push({
    id: 'EMP-' + Math.floor(Math.random()*900+100),
    name: c.name, initials, position: vac.position, level, gym: vac.gym, status: 'Active',
    startDate: '2026-10-01', phone: c.phone,
    email: f.email || c.name.toLowerCase().replace(/\s+/g,'.')+'@revive.com',
    nationalId: '-', contractType: 'Full-time',
    salary: f.salaryExp || 8000, daysOff: 21, daysUsed: 0,
    skills: f.skills || [], education: f.education || '-', languages: f.languages || [],
    documents: [], medicalHistory: [],
    notes: `Hired from vacancy "${vac.position}" @ ${vac.gym}. Applied ${formatDate(c.appliedDate)} via ${f.source||'-'} - ${reviews}`,
    interviewReviews: reviews, source: 'Recruitment',
  });
  c.stage = 'Hired'; c.hiredDate = '2026-10-01';
  c.decision = c.decision || { by: MOCK.currentUser.fullName, date: '2026-09-09', verdict: 'Accepted', note: 'Hired from vacancy action panel.' };
  vac.headcount = Math.max(0, (vac.headcount||1) - 1);
  if (vac.headcount <= 0) vac.status = 'Closed';
  MOCK.newComers.unshift({ id:'NC-'+Date.now(), name:c.name, position:vac.position+' — '+level, startDate:'2026-10-01', progress:0, checklist:[['ID & contract signed',false],['Uniform issued',false],['System access created',false],['Branch tour completed',false],['Welcome meeting with BM',false]] });
  MOCK.auditLog.unshift({ id:'al-'+Date.now(), action:'Hired from vacancy action panel', user:MOCK.currentUser.fullName, target:c.name, detail:`${vac.position} @ ${vac.gym} - application + interview data carried into employee record`, timestamp:'2026-09-09 '+new Date().toLocaleTimeString(), gym:vac.gym });
  closeModal();
  showToast(`${c.name} hired as ${vac.position} @ ${vac.gym} — account created with full application & interview data.`, 'success');
  renderAll();
}

// ==================== VACANCIES ====================
function vacanciesBody(canManage) {
  const vRows = MOCK.vacancies.map(v=>{
    const matched = MOCK.candidates.filter(c=>c.position===v.position);
    return { ...v, matched };
  });
  return `<div class="flex items-center justify-between mb-3 flex-shrink-0">
    <p class="bento-label text-charcoal-500">VACANCY MANAGEMENT</p>
    <button onclick="showToast('Vacancy filter — simulated','info')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M6 12h12M10 20h4"/></svg>Filter</button>
  </div>
  <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
    <table class="data-table"><thead class="sticky top-0 z-10 bg-[#f9f9ff]"><tr><th>Position</th><th>Gym</th><th>Headcount</th><th>Urgency</th><th>Candidates</th><th>Status</th><th></th></tr></thead>
    <tbody>${vRows.map(v=>`<tr onclick="openVacancyDetail('${v.id}')" class="cursor-pointer">
      <td><div><p class="text-xs font-medium text-charcoal-900">${v.position}</p><p class="text-[9px] text-charcoal-400">Created ${formatDate(v.createdDate)}</p></div></td>
      <td class="text-xs">${v.gym}</td>
      <td class="text-xs font-semibold">${v.headcount}</td>
      <td class="text-xs"><span class="badge ${v.urgency==='High'?'badge-red':v.urgency==='Medium'?'badge-yellow':'badge-blue'} text-[9px]">${v.urgency}</span></td>
      <td class="text-xs">${v.matched.length} <span class="text-charcoal-300">/</span> <span class="text-charcoal-500">${v.candidates}</span></td>
      <td>${statusBadge(v.status)}</td>
      <td>${canManage?`<button onclick="event.stopPropagation();showToast('Edit vacancy — simulated')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>`:''}</td>
    </tr>`).join('')}</tbody></table>
  </div>
  ${!canManage?`<p class="text-[10px] text-charcoal-400 text-center">Vacancy management (create/edit/close) is hidden — you do not have <code>recruitment.vacancies.manage</code>. View-only.</p>`:''}`;
}

// ==================== CANDIDATES ====================
function candidatesBody(canHire, canCandidates, showAll) {
  const groups = {
    active:   { label: 'In Process', list: MOCK.candidates.filter(c => !c.blocked && ['Applied','Screening','First Interview','Second Interview','Accepted'].includes(c.stage)) },
    rejected: { label: 'Rejected', list: MOCK.candidates.filter(c => !c.blocked && c.stage === 'Rejected') },
  };
  if (!groups[_recCandTab]) _recCandTab = 'active';
  const subBar = `<div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200 flex-shrink-0">
    ${Object.entries(groups).map(([k, g]) => `<button onclick="_recCandTab='${k}';renderAll()" class="tab-btn ${_recCandTab === k ? 'active' : ''}" style="padding:0.3rem 0.7rem">${g.label}${g.list.length ? ` <span class="badge ${k === 'hired' ? 'badge-success' : (k === 'rejected' || k === 'blocked') ? 'badge-red' : k === 'waiting' ? 'badge-purple' : 'badge-blue'} text-[9px] ml-0.5">${g.list.length}</span>` : ''}</button>`).join('')}
  </div>`;
  const viewToggle = _recCandTab === 'active' ? `<div class="inline-flex items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200 flex-shrink-0">
    <button onclick="_recView='kanban';renderAll()" class="tab-btn ${_recView==='kanban'?'active':''}" style="padding:0.3rem 0.7rem">&#9638; Board</button>
    <button onclick="_recView='list';renderAll()" class="tab-btn ${_recView==='list'?'active':''}" style="padding:0.3rem 0.7rem">&#9776; Table</button>
  </div>` : '';
  const headBar = `<div class="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
    ${subBar}${viewToggle}
  </div>`;

  let list = [...groups[_recCandTab].list];
  if (_recSearch) list = list.filter(c=>c.name.toLowerCase().includes(_recSearch.toLowerCase())||c.position.toLowerCase().includes(_recSearch.toLowerCase()));
  if (_recCandTab === 'active' && _recStage!=='All') list = list.filter(c=>c.stage===_recStage);
  if (_recVac!=='All') list = list.filter(c=>c.position===_recVac);

  const stageOpts = ['All',..._pipStages];
  const vacOpts = ['All',...new Set(MOCK.candidates.map(c=>c.position))];
  const emptyMsg = { active:'No candidates in process right now.', hired:'Nobody hired yet.', rejected:'No rejected candidates.', blocked:'No blocked candidates. Block someone from their row to stop re-applications.' }[_recCandTab] || 'Nothing here.';

  const allChecked = list.length>0 && list.every(c=>_recSel.includes(c.id));

  // BOARD view: Candidates owns the pipeline (Summary only summarizes)
  if (_recCandTab === 'active' && _recView === 'kanban') {
    const stages = ['Applied','Screening','First Interview','Second Interview','Accepted'];
    return `<div class="flex flex-col flex-1 min-h-0 gap-3">
      <div class="flex items-stretch gap-3 pb-1 overflow-x-auto" style="height:calc(100vh - 233px);min-h-[320px]">
        ${stages.map(s => {
          const col = list.filter(c=>c.stage===s);
          return `<div class="flex-1 min-w-[185px] max-w-[340px] bg-white rounded-xl border border-charcoal-200 overflow-hidden flex flex-col">
            <div class="px-3 py-2.5 flex items-center justify-between border-b-2" style="border-bottom-color:${_pipColors[s]}">
              <p class="text-[11px] font-bold uppercase tracking-wide text-charcoal-800 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background:${_pipColors[s]}"></span>${s}</p>
              <span class="badge badge-gray">${col.length}</span>
            </div>
            <div class="space-y-2.5 p-2.5 min-h-[80px] flex-1 overflow-y-auto candidate-scroll">${col.map(c=>_pipelineCard(c,s)).join('')||`<div class="bg-charcoal-50 rounded-lg border border-dashed border-charcoal-300 p-4 text-center"><p class="text-[10px] text-charcoal-400">No candidates in this stage</p></div>`}</div>
          </div>`;
        }).join('')}
      </div>
      <p class="text-[10px] text-charcoal-400">Board = stage-by-stage pipeline overview. Use Table view for full candidate management.</p>
    </div>`;
  }

  return `<div class="flex flex-col flex-1 min-h-0 gap-2.5">
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <table class="data-table">
        <thead class="sticky top-0 z-10 bg-[#f9f9ff]"><tr>
          <th class="w-8"><input type="checkbox" class="rounded" ${allChecked?'checked':''} onchange="if(this.checked){_recSel=MOCK.candidates.map(c=>c.id);}else{_recSel=[];}renderAll()"></th>
          <th>Candidate</th><th>Position</th><th>Stage</th><th>Applied</th><th>Rating</th><th>Source</th><th></th></tr></thead>
        <tbody>${list.map(c=>{
          const p = c.form||{};
          return `<tr onclick="openCandidateDetail('${c.id}')" class="cursor-pointer">
            <td onclick="event.stopPropagation()"><input type="checkbox" class="rounded" ${_recSel.includes(c.id)?'checked':''} onchange="toggleBulk('${c.id}',this.checked)"></td>
            <td><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${_initials(c.name)}</div><div><p class="text-xs font-medium text-charcoal-900">${c.name}</p><p class="text-[9px] text-charcoal-400">${p.email||''}</p></div></div></td>
            <td class="text-xs">${c.position}</td>
            <td>${_stageBadge(c.stage)}</td>
            <td class="text-xs">${formatDate(c.appliedDate)}</td>
            <td class="text-xs text-yellow-500">${'★'.repeat(c.rating)}${'☆'.repeat(Math.max(0,5-c.rating))}</td>
            <td class="text-xs">${p.source||'—'}</td>
            <td onclick="event.stopPropagation()" class="whitespace-nowrap">
              <div class="flex gap-1">
                <button onclick="openCandidateDetail('${c.id}')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3 7a9 9 0 019-9v0a9 9 0 01-9 9v0a9 9 0 01-9-9v0a9 9 0 019-9zM12 3H8a5 5 0 014 5v0"/></svg></button>
                ${canCandidates&&!c.blocked?`<button onclick="showToast('Advanced to next stage')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></button>`:''}
                ${canCandidates&&c.stage!=='Hired'&&!c.blocked?`<button onclick="_setCandidateBlock('${c.id}', true)" class="btn btn-sm btn-ghost text-red-500 font-bold" title="Block candidate from hiring">Block</button>`:''}
                ${canHire&&(c.stage==='Accepted')?`<button onclick="openHireWizard('${c.id}')" class="btn btn-sm btn-primary">Hire</button>`:''}
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:hidden flex-shrink-0">
      ${list.map(c=>{const p=c.form||{};return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${_initials(c.name)}</div>
          <div class="min-w-0 flex-1"><p class="text-xs font-medium text-charcoal-900 truncate">${c.name}</p><p class="text-[10px] text-charcoal-500">${c.position}</p></div>
          ${_stageBadge(c.stage)}
        </div>
        <div class="flex items-center justify-between mt-2 text-[10px] text-charcoal-500">
          <span class="text-yellow-500">${'★'.repeat(c.rating)}${'☆'.repeat(Math.max(0,5-c.rating))}</span>
          <span>${formatDate(c.appliedDate)}</span>
        </div>
        <div class="flex gap-1.5 mt-2">
          <button onclick="openCandidateDetail('${c.id}')" class="btn btn-sm btn-secondary flex-1">Profile</button>
          ${canHire&&c.stage==='Accepted'?`<button onclick="openHireWizard('${c.id}')" class="btn btn-sm btn-primary flex-1">Hire</button>`:''}
        </div>
      </div>`;}).join('')||'<div class="lg:col-span-3 bg-white rounded-xl border border-charcoal-200 p-6 text-center text-xs text-charcoal-400">${emptyMsg}</div>'}
    </div>

    ${!canCandidates?`<p class="text-[10px] text-charcoal-400 text-center flex-shrink-0">Managing candidates requires <code>recruitment.candidates.manage</code>.</p>`:''}
  </div>`;
}

function _setCandidateBlock(cid, blocked) {
  const c = MOCK.candidates.find(x=>x.id===cid); if(!c) return;
  c.blocked = blocked;
  if (blocked) c.blockReason = c.blockReason || 'Blocked manually by HR';
  showToast(blocked ? c.name+' blocked from hiring' : c.name+' restored to the pipeline', 'info');
  renderAll();
}

// ==================== PIPELINE (KANBAN) ====================
function pipelineBody(canHire, showAll) {
  const stages = _pipStages;
  return `<div class="flex items-center justify-between mb-2 flex-wrap gap-2">
    <div class="flex items-center gap-2">
      <select onchange="_recView=this.value;renderAll()" class="form-select" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.75rem;width:auto">
        <option value="kanban" ${_recView==='kanban'?'selected':''}>Kanban</option>
        <option value="list" ${_recView==='list'?'selected':''}>List</option>
      </select>
      <div class="hidden sm:flex items-center gap-2 text-[9px] text-charcoal-400">${stages.map(s=>`<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:${_pipColors[s]}"></span>${s}</span>`).join('')}</div>
    </div>
    <span class="text-[10px] text-charcoal-400">Move candidates forward; final hire is reserved for HR Manager.</span>
  </div>`;

  if (_recView==='list') {
    const rows = MOCK.candidates.map(c=>`<tr>
      <td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${_initials(c.name)}</div><p class="text-xs font-medium text-charcoal-900">${c.name}</p></div></td>
      <td class="text-xs">${c.position}</td>
      <td>${_stageBadge(c.stage)}</td>
      <td class="text-[10px] text-charcoal-500">${formatDate(c.appliedDate)}</td>
      <td class="whitespace-nowrap">
        <div class="flex gap-1 items-center">
          <button onclick="showToast('Moved back')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"/></svg></button>
          <span class="text-[9px] text-charcoal-400">${c.stage}</span>
          <button onclick="showToast('Moved forward')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></button>
        </div>
      </td>
    </tr>`).join('');
    return `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden"><div class="table-responsive"><table class="data-table"><thead><tr><th>Candidate</th><th>Position</th><th>Stage</th><th>Applied</th><th>Move</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  return `<div class="flex items-start gap-2 overflow-x-auto pb-1">
    ${stages.map((s,si)=>{
      const stageCandidates = MOCK.candidates.filter(c=>c.stage===s);
      const prevStage = stages[si-1]||null;
      const nextStage = s==='Rejected'||s==='Hired'?null:stages[si+1]||null;
      return `<div class="flex-1 min-w-[230px] max-w-[320px] bg-charcoal-50 rounded-xl p-2 ${s==='Rejected'?'bg-red-50/50':''}">
        <div class="flex items-center justify-between px-1 mb-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide ${s==='Rejected'?'text-red-500':'text-charcoal-500'} flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${_pipColors[s]}"></span>${s}</p>
          <span class="badge badge-gray">${stageCandidates.length}</span>
        </div>
        <div class="space-y-1.5 min-h-[120px]">
          ${stageCandidates.map(c=>{
            const appliedMs=new Date(c.appliedDate).getTime();
            const daysSince=Math.floor((new Date('2026-09-09').getTime()-appliedMs)/86400000);
            const isStale=daysSince>5 && s!=='Hired' && s!=='Rejected';
            const nextActionLabel={Applied:'Schedule screening',Screening:'Schedule 1st interview','First Interview':'Schedule 2nd interview','Second Interview':'Make decision',Accepted:'Match vacancy / hire',Rejected:'',Hired:''}[s]||'';
            return `<div class="bg-white rounded-lg border ${isStale?'border-red-200':'border-charcoal-200'} p-2.5 shadow-sm">
              <div class="flex items-center justify-between gap-2">
                <p class="text-[11px] font-semibold text-charcoal-900">${c.name}</p>
                ${isStale?`<span class="badge badge-red text-[8px] flex items-center gap-0.5"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${daysSince}d</span>`:`<span class="text-[10px] text-yellow-500">${c.rating>0?'★'+c.rating:''}</span>`}
              </div>
              <p class="text-[9px] text-charcoal-500">${c.position} · ${(c.form||{}).source||'—'}</p>
              ${isStale?`<p class="text-[9px] text-red-500 font-medium mt-0.5">⚠ Overdue · Next: ${nextActionLabel}</p>`:`<p class="text-[9px] text-brand-600 mt-0.5">${nextActionLabel}</p>`}
              <div class="flex items-center gap-1 mt-1.5">
                ${prevStage&&s!=='Rejected'?`<button onclick="advanceCandidate('${c.id}','${prevStage}')" class="btn btn-icon btn-ghost" title="Move to ${prevStage}"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"/></svg></button>`:'<span class="w-6"></span>'}
                <button onclick="openCandidateDetail('${c.id}')" class="btn btn-icon btn-ghost mx-auto">View</button>
                ${nextStage?`<button onclick="advanceCandidate('${c.id}','${nextStage}')" class="btn btn-icon btn-ghost" title="Move to ${nextStage}"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></button>`:'<span class="w-6"></span>'}
              </div>
              ${canHire&&s==='Accepted'?`<button onclick="openHireWizard('${c.id}')" class="btn btn-sm btn-primary w-full mt-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Hire</button>`:''}
            </div>`;
          }).join('')||`<div class="bg-white rounded-lg border border-dashed border-charcoal-200 p-3 text-center"><p class="text-[10px] text-charcoal-400">No candidates</p></div>`}
        </div>
      </div>`;
    }).join('')}
  </div>
  <p class="text-[10px] text-charcoal-400 text-center mt-2">${showAll?'Demo shows all stages. Real moves are permission-gated by candidates.manage.':'You can move candidates through stages; final Hire (ready on Accepted) is reserved for HR Manager.'}</p>`;
}

function advanceCandidate(cid, newStage) {
  const c=MOCK.candidates.find(x=>x.id===cid);
  if(!c) return;
  if(!_pipStages.includes(newStage)) return;
  const oldStage=c.stage;
  c.stage=newStage;
  if(newStage==='Second Interview' && !c.iv2) c.iv2={ date:'2026-09-16', by:'Mona El-Sayed', type:'Panel', verdict:'Scheduled', eval:null, room:'HQ — Boardroom' };
  showToast(c.name+' moved: '+oldStage+' → '+newStage);
  renderAll();
}

// ==================== INTERVIEWS ====================
function interviewsBody(list) {
  const statusCls = { Scheduled:'badge-blue', Invited:'badge-purple', Completed:'badge-success', Cancelled:'badge-gray', Draft:'badge-gray' };
  const isPending = s => ['Scheduled','Invited','Draft'].includes(s);
  const counts = {
    all: list.length,
    pending: list.filter(iv=>isPending(iv.status)).length,
    completed: list.filter(iv=>iv.status==='Completed').length,
    cancelled: list.filter(iv=>iv.status==='Cancelled').length,
  };
  const filtered = _ivFilter==='all' ? list
    : _ivFilter==='pending' ? list.filter(iv=>isPending(iv.status))
    : _ivFilter==='completed' ? list.filter(iv=>iv.status==='Completed')
    : list.filter(iv=>iv.status==='Cancelled');
  const pendingList = list.filter(iv=>isPending(iv.status));
  const weekIvs = list.filter(iv=>iv.date>='2026-09-10'&&iv.date<='2026-09-16');
  const weekDone = weekIvs.filter(iv=>iv.status==='Completed').length;
  const attention = [
    ...list.filter(iv=>iv.status==='Draft').map(iv=>`<p>&bull; <strong>${iv.candidate}</strong> - draft: still needs time and interviewer.</p>`),
    ...list.filter(iv=>iv.status==='Invited').map(iv=>`<p>&bull; <strong>${iv.candidate}</strong> - invited, not confirmed yet.</p>`),
    ...list.filter(iv=>iv.status==='Scheduled'&&iv.date<'2026-09-09').map(iv=>`<p>&bull; <strong>${iv.candidate}</strong> - date passed, update the result.</p>`),
  ];
  const chip = (k,l)=>`<button onclick="_ivFilter='${k}';renderAll()" class="tab-btn ${_ivFilter===k?'active':''}" style="padding:0.25rem 0.55rem;font-size:10px">${l}${counts[k]?` <span class="text-[9px] opacity-80">${counts[k]}</span>`:''}</button>`;

  const [cy, cm] = _ivMonth.split('-').map(Number);
  const monthLabel = new Date(cy, cm-1, 1).toLocaleString('en-US', { month:'long' }) + ' ' + cy;
  const firstDow = new Date(cy, cm-1, 1).getDay();
  const daysIn = new Date(cy, cm, 0).getDate();
  const cells = [];
  for (let i2=0;i2<firstDow;i2++) cells.push(null);
  for (let d=1; d<=daysIn; d++) cells.push(_ivMonth + '-' + String(d).padStart(2,'0'));
  const dayList = filtered.filter(iv=>iv.date===_ivDay);
  const dayPend = dayList.filter(iv=>isPending(iv.status));

  return `<div class="flex flex-col gap-3" style="height:calc(100vh - 205px);min-h-[430px]">
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-3 flex-1 min-h-0">

      <div class="lg:col-span-3 flex flex-col gap-3 min-h-0">
        <div class="bg-white rounded-xl border border-charcoal-200 shadow-2xs overflow-hidden flex-1 min-h-0 flex flex-col">
          <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between gap-2 flex-wrap bg-brand-50/60">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center flex-shrink-0"><span class="material-icons text-[17px]">event_note</span></span>
              <div class="min-w-0">
                <p class="text-xs font-bold text-charcoal-900 truncate">${formatDate(_ivDay)}</p>
                <p class="text-[10px] text-charcoal-500">${dayList.length} interview${dayList.length===1?'':'s'}${dayPend.length?` &middot; ${dayPend.length} pending`:''}</p>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-wrap">
              ${chip('all','All')}${chip('pending','Pending')}${chip('completed','Completed')}${chip('cancelled','Cancelled')}
              <button onclick="openNewInterview()" class="btn btn-sm btn-primary ml-1" style="height:24px;font-size:10px"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Schedule</button>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-charcoal-50">
            ${dayList.map(iv=>{
              const cand = MOCK.candidates.find(x=>x.name===iv.candidate);
              return `<div class="p-3 flex items-center justify-between gap-3 hover:bg-charcoal-50/60 transition-colors">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-14 h-12 rounded-lg bg-brand-50 border border-brand-100 flex flex-col items-center justify-center flex-shrink-0">
                  <span class="text-[13px] font-bold text-brand-700 leading-none">${iv.time.split(':')[0]}</span>
                  <span class="text-[9px] font-bold text-brand-600 leading-none">:${iv.time.split(':')[1]}</span>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-charcoal-900">${iv.candidate}${cand?` <span class="text-[10px] text-yellow-500">${'&#9733;'.repeat(Math.min(5,cand.rating||0))}${'&#9734;'.repeat(Math.max(0,5-(cand.rating||0)))}</span>`:''}</p>
                  <p class="text-[10px] text-charcoal-500">${iv.position} | ${iv.gym}${cand?` &middot; ${cand.stage}`:''}</p>
                  <p class="text-[10px] text-charcoal-400 mt-0.5">${iv.time} | ${iv.type} | with ${iv.interviewer}${iv.room?` | ${iv.room}`:''}</p>
                </div>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                ${isPending(iv.status)?`<button onclick="markInterviewDone('${iv.id}')" class="btn btn-sm btn-secondary font-bold" title="Mark as completed">&#10003; Done</button>`:''}
                <span class="badge ${statusCls[iv.status]||'badge-gray'} text-[9px]">${iv.status}</span>
                <button onclick="openInterviewDetail('${iv.id}')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3 7a9 9 0 019-9v0a9 9 0 01-9 9v0a9 9 0 019-9v0a9 9 0 019-9zM12 3H8a5 5 0 014 5v0"/></svg></button>
              </div>
            </div>`;
            }).join('') || `<div class="p-8 text-center"><p class="text-xs text-charcoal-400 mb-2">No interviews on this day.</p><button onclick="openNewInterview()" class="btn btn-sm btn-primary">Schedule one</button></div>`}
          </div>
        </div>

        <div class="bg-white rounded-xl border border-charcoal-200 shadow-2xs flex-shrink-0 overflow-hidden">
          <div class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-charcoal-100">
            <div class="p-3">
              <p class="bento-label text-charcoal-500 mb-2">UPCOMING (${counts.pending})</p>
              <div class="space-y-1.5 max-h-[104px] overflow-y-auto pr-1">
                ${pendingList.slice(0,4).map(iv=>`<div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ${iv.status==='Draft'?'bg-amber-500':'bg-brand-500'} flex-shrink-0"></span><div class="min-w-0"><p class="text-[10px] font-medium text-charcoal-900 truncate">${iv.candidate}</p><p class="text-[9px] text-charcoal-500">${iv.date.slice(5)} ${iv.time} &middot; ${iv.status}</p></div></div>`).join('') || '<p class="text-[10px] text-charcoal-400">Nothing pending.</p>'}
              </div>
            </div>
            <div class="p-3">
              <p class="bento-label text-charcoal-500 mb-2">THIS WEEK</p>
              <div class="w-full h-2 bg-charcoal-100 rounded-full"><div class="h-full bg-brand-500 rounded-full" style="width:${weekIvs.length?Math.round(weekDone/weekIvs.length*100):0}%"></div></div>
              <p class="text-[9px] text-charcoal-400 mt-1.5">${weekDone} of ${weekIvs.length} interviews completed this week.</p>
              <p class="text-[9px] text-charcoal-400">${counts.all} total &middot; ${counts.pending} pending &middot; ${counts.completed} done</p>
            </div>
            <div class="p-3">
              <p class="bento-label text-charcoal-500 mb-2">NEED ATTENTION (${attention.length})</p>
              <div class="space-y-1.5 text-[10px] text-charcoal-600 max-h-[104px] overflow-y-auto pr-1">
                ${attention.join('') || '<p class="text-charcoal-400">All confirmed and up to date.</p>'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="lg:col-span-2 bg-white rounded-xl border border-charcoal-200 shadow-2xs overflow-hidden flex flex-col min-h-0">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
          <div class="flex items-center gap-1.5">
            <button onclick="shiftIvMonth(-1)" class="btn btn-sm btn-secondary" style="height:24px;padding:0 9px" title="Previous month">&lsaquo;</button>
            <p class="text-xs font-bold text-charcoal-900">${monthLabel}</p>
            <button onclick="shiftIvMonth(1)" class="btn btn-sm btn-secondary" style="height:24px;padding:0 9px" title="Next month">&rsaquo;</button>
          </div>
          <button onclick="_ivMonth='2026-09';_ivDay='2026-09-10';renderAll()" class="text-[10px] text-brand-600 font-semibold hover:underline">Today</button>
        </div>
        <div class="p-3 flex-1 min-h-0 flex flex-col">
          <div class="grid grid-cols-7 gap-1.5">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span class="text-[9px] font-bold text-charcoal-400 uppercase text-center pb-1">${d}</span>`).join('')}</div>
          <div class="grid grid-cols-7 gap-1.5 flex-1 content-start">
            ${cells.map(date=>{
              if (!date) return `<div class="min-h-[54px]"></div>`;
              const dayIvs = filtered.filter(iv=>iv.date===date);
              const sel = date===_ivDay;
              const dn = Number(date.split('-')[2]);
              return `<button onclick="_ivDay='${date}';renderAll()" class="rounded-lg p-1.5 min-h-[54px] w-full flex flex-col items-center justify-center gap-1 border transition-all ${sel?'border-brand-500 bg-brand-50 ring-1 ring-brand-300':dayIvs.length?'border-charcoal-200 bg-white hover:border-brand-400':'border-transparent bg-charcoal-50/60 hover:bg-charcoal-100'}">
                <span class="text-[11px] font-semibold ${dayIvs.length?'text-charcoal-900':'text-charcoal-400'}">${dn}</span>
                <span class="flex gap-0.5 flex-wrap justify-center items-center min-h-[6px]">
                  ${dayIvs.slice(0,4).map(iv=>`<span class="w-1.5 h-1.5 rounded-full ${iv.status==='Completed'?'bg-brand-500':iv.status==='Invited'?'bg-purple-500':iv.status==='Draft'?'bg-amber-400':'bg-blue-500'}" title="${iv.candidate} ${iv.time}"></span>`).join('')}${dayIvs.length>4?`<span class="text-[8px] font-bold text-charcoal-500">+${dayIvs.length-4}</span>`:''}
                </span>
              </button>`;
            }).join('')}
          </div>
          <div class="mt-2 pt-2 border-t border-charcoal-100 flex items-center gap-3 flex-wrap text-[9px] text-charcoal-500">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span>Scheduled</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple-500"></span>Invited</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span>Draft</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-brand-500"></span>Done</span>
          </div>
        </div>
      </div>

    </div>
  </div>`;
}

function shiftIvMonth(delta) {
  let [y, m] = _ivMonth.split('-').map(Number);
  m += delta;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  _ivMonth = y + '-' + String(m).padStart(2,'0');
  if (!_ivDay.startsWith(_ivMonth)) _ivDay = _ivMonth + '-01';
  renderAll();
}

function markInterviewDone(id) {
  const iv = MOCK.interviews.find(x=>x.id===id); if(!iv) return;
  iv.status = 'Completed';
  showToast(iv.candidate + ' - interview marked completed','success');
  renderAll();
}

// ==================== WAITING LIST ====================
function waitingBody() {
  const canCandidates = DEMO.showAll || hasPermission('recruitment.candidates.manage');
  return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
    ${MOCK.waitingList.map(w=>{
      const matches = _matchingVacancies(w.position||'');
      return `<div class="bg-white rounded-xl border border-charcoal-200 p-3 border-l-4 border-l-purple-400">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${_initials(w.name)}</div>
          <div><p class="text-xs font-semibold text-charcoal-900">${w.name}</p><p class="text-[10px] text-charcoal-500">${w.position||'Any role'}</p></div>
        </div>
        <span class="badge badge-purple text-[9px] flex-shrink-0 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${Math.max(1,Math.round((new Date()-new Date(w.since))/86400000))}d</span>
      </div>
      <div class="flex flex-wrap gap-1 mt-1.5">${(w.skills||[]).map(s=>`<span class="badge badge-purple text-[8px]">${s}</span>`).join('')}</div>
      <p class="text-[10px] text-charcoal-600 mt-2">${w.note}</p>
      ${matches.length
        ? `<div class="mt-2 space-y-1">${matches.map(m=>`<div class="bg-green-50 border border-green-100 rounded-lg p-2 flex items-center justify-between gap-2">
            <div class="min-w-0"><p class="text-[9px] text-green-800 font-semibold truncate">&#10003; Open position: ${m.position} — ${m.gym}</p>
            <p class="text-[8px] text-green-700">${m.headcount} seat${m.headcount>1?'s':''} · ${m.urgency} urgency · ${m.candidates} applicant${m.candidates===1?'':'s'}</p></div>
            <span class="badge badge-success text-[8px] flex-shrink-0">OPEN</span>
          </div>`).join('')}</div>`
        : `<div class="mt-2 bg-charcoal-50 border border-dashed border-charcoal-200 rounded-lg p-2"><p class="text-[9px] text-charcoal-500 font-medium">No open position for ${w.position} yet — cannot assign blindly.</p><p class="text-[8px] text-charcoal-400 mt-0.5">Create a vacancy first; this card lights up automatically.</p></div>`}
      <div class="flex items-center justify-between mt-2.5 text-[9px] text-charcoal-400"><span>${w.source} · since ${formatDate(w.since)}</span></div>
      <div class="flex gap-1.5 mt-2">
        ${canCandidates?(matches.length
          ? `<button onclick="assignWaitingToGym('${w.id}')" class="btn btn-sm btn-primary flex-1">Assign to Open Position</button>`
          : `<button class="btn btn-sm btn-secondary flex-1 opacity-50 cursor-not-allowed" disabled title="No open position matches ${w.position} — create a vacancy first">Assign to Open Position</button>`):''}
        <button onclick="showToast('Removed from waiting list','info')" class="btn btn-sm btn-ghost">Remove</button>
      </div>
    </div>`;
    }).join('')}
  </div>`;
}

// ==================== NEW COMERS ====================
function newcomersBody() {
  return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
    ${MOCK.newComers.map(n=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${_initials(n.name)}</div>
          <div class="min-w-0"><p class="text-xs font-semibold text-charcoal-900">${n.name}</p><p class="text-[10px] text-charcoal-500">${n.position} · Starts ${formatDate(n.startDate)}</p></div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0"><div class="w-20 h-1.5 bg-charcoal-100 rounded-full overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:${n.progress}%"></div></div><span class="text-[10px] font-bold text-brand-600">${n.progress}%</span></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">${n.checklist.map(([item,done])=>`<label class="flex items-center gap-2 cursor-pointer bg-charcoal-50 rounded-lg p-2"><input type="checkbox" ${done?'checked':''} class="rounded" onchange="showToast('Checklist updated')"><span class="text-[10px] text-charcoal-700 ${done?'line-through text-charcoal-400':''}">${item}</span></label>`).join('')}</div>
    </div>`).join('')}
  </div>`;
}

// ==================== VACANCY REQUESTS ====================
function vacancyRequestsBody() {
  const all = MOCK.vacancyRequests;
  const groups = {
    pending:  { label:'Pending',  cls:'badge-yellow',  list: all.filter(r=>r.status==='Pending') },
    approved: { label:'Approved', cls:'badge-success', list: all.filter(r=>r.status==='Approved') },
    rejected: { label:'Rejected', cls:'badge-red',     list: all.filter(r=>r.status==='Rejected') },
  };
  if (!groups[_vrTab]) _vrTab = 'pending';
  const subBar = `<div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200 mb-2">
    ${Object.entries(groups).map(([k,g])=>`<button onclick="_vrTab='${k}';renderAll()" class="tab-btn ${_vrTab===k?'active':''}" style="padding:0.3rem 0.7rem">${g.label}${g.list.length?` <span class="badge ${g.cls} text-[9px] ml-0.5">${g.list.length}</span>`:''}</button>`).join('')}
  </div>`;
  const list = groups[_vrTab].list;
  return subBar + `<div class="space-y-1.5">
    ${list.map(r=>`<div class="bg-white rounded-xl border ${r.status==='Pending'?'border-yellow-200 border-l-4 border-l-yellow-400':'border-charcoal-200'} p-3">
      <div class="flex items-center justify-between gap-2">
        <div><p class="text-xs font-semibold text-charcoal-900">${r.position} — ${r.gym}</p><p class="text-[10px] text-charcoal-500">Submitted by ${r.submittedBy} on ${formatDate(r.submittedDate)} · ${r.urgency} urgency</p></div>
        ${statusBadge(r.status)}
      </div>
      <p class="text-[10px] text-charcoal-600 mt-1.5">${r.reason}</p>
      ${r.status==='Pending'?`<div class="flex gap-1.5 mt-2">
        <button onclick="approveVacancyRequest('${r.id}')" class="btn btn-sm btn-primary">Approve → Create Vacancy</button>
        <button onclick="rejectVacancyRequest('${r.id}')" class="btn btn-sm btn-danger-outline">Reject</button>
      </div>`:`<div class="flex items-center gap-1.5 mt-2 flex-wrap">
        <button onclick="reopenVacancyRequest('${r.id}')" class="btn btn-sm btn-secondary" title="Reopen this request to change the decision">Edit again — re-open</button>
        <span class="badge badge-gray text-[9px]">Decided by ${r.decidedBy || MOCK.currentUser.fullName}</span>
      </div>`}
    </div>`).join('') || `<div class="bg-white rounded-xl border border-dashed border-charcoal-200 p-6 text-center text-xs text-charcoal-400">No ${groups[_vrTab].label.toLowerCase()} requests.</div>`}
  </div>`;
}

function reopenVacancyRequest(rid) {
  const r = MOCK.vacancyRequests.find(x=>x.id===rid); if(!r) return;
  const wasApproved = r.status === 'Approved';
  r.status = 'Pending';
  r.decidedBy = undefined;
  let note = 're-opened for review';
  if (wasApproved) {
    // withdraw the vacancy this approval created, as long as nobody applied yet
    const vac = MOCK.vacancies.find(v => v.position === r.position && v.gym === r.gym && v.status === 'Open' && !v.candidates);
    if (vac) { MOCK.vacancies = MOCK.vacancies.filter(v => v.id !== vac.id); note += ' · its open vacancy was withdrawn (no applicants yet)'; }
    else { note += ' · linked vacancy kept (already has applicants)'; }
  }
  showToast(`${r.position} — ${note}`, 'info');
  renderAll();
}

// ==================== MODALS ====================
function openVacancyDetail(id) {
  const v = MOCK.vacancies.find(x=>x.id===id);
  if(!v) return;
  const showAll = DEMO.showAll;
  const canHire = showAll || hasPermission('recruitment.hire.approve');
  const related = MOCK.candidates.filter(c=>c.position===v.position);
  const staff = MOCK.employees.filter(e => { const vp = (v.position||'').toLowerCase(); const ep = (e.position||'').toLowerCase(); return ep === vp || vp.includes(ep) || ep.includes(vp); });
  const funnel = _pipStages.filter(s=>s!=='Rejected').map(s=>[s, related.filter(c=>c.stage===s).length]);
  const fMax = Math.max(...funnel.map(f=>f[1]),1);
  openModal(`${v.position}`, `<div class="space-y-3">
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Gym</p><p class="text-xs font-semibold text-charcoal-900">${v.gym}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Headcount</p><p class="text-xs font-semibold text-charcoal-900">${v.headcount}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Urgency</p><p class="text-xs font-semibold text-charcoal-900">${v.urgency}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Status</p>${statusBadge(v.status)}</div>
    </div>
    <div>
      <p class="bento-label text-charcoal-500 mb-2">FUNNEL FOR THIS ROLE</p>
      <div class="space-y-1.5">${funnel.map(([s,n])=>`<div class="flex items-center gap-2">
        <span class="w-20 flex-shrink-0 text-[10px] text-charcoal-600">${s}</span>
        <div class="flex-1 h-5 bg-charcoal-50 rounded-md" style="width:${Math.max(18,Math.round((n/Math.max(fMax,1))*100))}%"><span class="ml-2 text-[9px] font-bold text-charcoal-700 leading-5">${n}</span></div>
      </div>`).join('')}</div>
    </div>
    <div>
      <p class="bento-label text-charcoal-500 mb-1.5">EMPLOYEES UNDER THIS POSITION (${staff.length})</p>
      ${staff.length ? `<div class="space-y-1.5">${staff.map(e=>`<div class="border border-charcoal-200 rounded-lg p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:border-brand-300 transition-colors" onclick="closeModal();openEmployeeProfile('${e.id}')">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${e.initials || _initials(e.name)}</div>
          <div class="min-w-0"><p class="text-[11px] font-semibold text-charcoal-900">${e.name} <span class="text-charcoal-400 font-normal">· ${e.id}</span></p><p class="text-[9px] text-charcoal-500">${e.gym} · ${e.level || '—'} · ${e.status} · ${e.phone}</p></div>
        </div>
        <span class="text-[9px] text-brand-600 font-semibold flex-shrink-0">Entire data →</span>
      </div>`).join('')}</div>` : '<p class="text-[10px] text-charcoal-400">No employee holds this position yet.</p>'}
    </div>
    <div>
      <p class="bento-label text-charcoal-500 mb-1.5">CANDIDATES UNDER THIS POSITION (${related.length})</p>
      ${related.length ? `<div class="space-y-1.5">${related.map(c=>`<div class="border border-charcoal-200 rounded-lg p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:border-brand-300 transition-colors" onclick="closeModal();openCandidateDetail('${c.id}')">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${_initials(c.name)}</div>
          <div class="min-w-0"><p class="text-[11px] font-semibold text-charcoal-900">${c.name}</p><p class="text-[9px] text-charcoal-500">${(c.form||{}).source || '—'} · applied ${formatDate(c.appliedDate)} · ${(c.form||{}).salaryExp ? (c.form.salaryExp).toLocaleString()+' EGP expected' : '—'}</p></div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">${_stageBadge(c.stage)}<span class="text-[10px] text-yellow-500">${'★'.repeat(c.rating)}${'☆'.repeat(Math.max(0,5-c.rating))}</span></div>
      </div>`).join('')}</div>` : '<p class="text-[10px] text-charcoal-400">No candidates for this position yet.</p>'}}
      <p class="text-[9px] text-charcoal-400 mt-1.5">${canHire?'You have hire authority for this vacancy.':'Hire action reserved for HR Manager (recruitment.hire.approve).'}</p>
    </div>
  </div>`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}

function openNewVacancy() {
  openModal('New Vacancy', `<form onsubmit="event.preventDefault();showToast('Vacancy created');closeModal();" class="space-y-3">
    <div><label class="form-label">Position Title</label><select class="form-select"><option>Senior Trainer</option><option>Trainer</option><option>Receptionist</option><option>Cleaner</option><option>Maintenance</option></select></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Gym</label><select class="form-select"><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select></div>
      <div><label class="form-label">Headcount</label><input type="number" min="1" value="1" class="form-input" required></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Urgency</label><select class="form-select"><option>Low</option><option>Medium</option><option>High</option></select></div>
      <div><label class="form-label">Recruitment source</label><select class="form-select"><option>Job board</option><option>Referral</option><option>Social media</option><option>Walk-in</option></select></div>
    </div>
    <div><label class="form-label">Job Description</label><textarea class="form-input" rows="3" placeholder="Role description, key responsibilities..."></textarea></div>
    <div class="bg-brand-50 border border-brand-100 rounded-lg p-2.5 text-[10px] text-brand-800">New vacancy requests go to the previous <strong>vacancy request</strong> workflow unless created directly by HR.</div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Create Vacancy</button></div>
  </form>`);
}

function openCandidateDetail(cid) {
  const c = MOCK.candidates.find(x=>x.id===cid);
  if(!c) return;
  const f = c.form||{};

  const ivBlock = (iv, title) => `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
    <p class="bento-label text-charcoal-500 mb-2">${title}</p>
    ${iv?`<div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Interviewer</p><p class="text-[11px] font-semibold text-charcoal-900">${iv.by}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Date</p><p class="text-[11px] font-semibold text-charcoal-900">${iv.date} · ${iv.type}</p></div>
      <div class="col-span-2 bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Evaluation</p>
        <div class="flex items-center gap-2 mt-0.5">${_evalStars(iv.eval)}<span class="badge ${iv.verdict==='Pass'?'badge-success':(iv.verdict==='Fail'?'badge-red':'badge-blue')} text-[9px]">${iv.verdict}</span>${iv.room?`<span class="text-[9px] text-charcoal-400">${iv.room}</span>`:''}</div>
      </div>
      ${iv.notes?`<div class="col-span-2 bg-yellow-50 border border-yellow-100 rounded-lg p-2"><p class="text-[9px] font-semibold text-yellow-800">NOTES</p><p class="text-[10px] text-yellow-800/80 mt-0.5">${iv.notes}</p></div>`:''}
    </div>
    <button type="button" onclick="const d=this.nextElementSibling;d.classList.toggle('hidden');this.innerHTML=d.classList.contains('hidden')?'Show more data &#9662;':'Show less &#9652;'" class="btn btn-sm btn-ghost text-brand-700 font-bold mt-1.5" style="height:22px;font-size:10px">Show more data &#9662;</button>
    <div class="hidden mt-1.5 bg-charcoal-50 rounded-lg p-2.5 space-y-1 text-[10px] text-charcoal-600">
      <p><b>Round:</b> ${title} · <b>Interviewer:</b> ${iv.by}</p>
      <p><b>When &amp; where:</b> ${formatDate(iv.date)}${iv.time?` at ${iv.time}`:''}${iv.room?` · ${iv.room}`:''} · <b>Format:</b> ${iv.type}</p>
      <p><b>Evaluation score:</b> ${iv.eval?`${iv.eval} / 5`: 'not graded yet'} · <b>Verdict:</b> ${iv.verdict}</p>
      <p><b>Interviewer comments:</b> ${iv.notes||'No comments recorded for this round.'}</p>
      <p class="text-charcoal-400"><b>Candidate expectations:</b> ${f.salaryExp?f.salaryExp.toLocaleString()+' EGP':'—'} · ${f.availability||'—'} · ${f.shift||'Any'} shift</p>
    </div>`:`<p class="text-[10px] text-charcoal-400">Not scheduled yet.</p>`}
  </div>`;

  const screenBlock = c.screen?`<div class="bg-white rounded-xl border border-charcoal-200 p-3">
    <p class="bento-label text-charcoal-500 mb-2">SCREENING</p>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Screened by</p><p class="text-[11px] font-semibold text-charcoal-900">${c.screen.by}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Date</p><p class="text-[11px] font-semibold text-charcoal-900">${formatDate(c.screen.date)}</p></div>
      <div class="col-span-2 bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Evaluation</p><div class="flex items-center gap-2 mt-0.5">${_evalStars(c.screen.eval)}<span class="badge ${c.screen.verdict==='Pass'?'badge-success':'badge-red'} text-[9px]">${c.screen.verdict}</span></div></div>
      ${c.screen.notes?`<div class="col-span-2 bg-yellow-50 border border-yellow-100 rounded-lg p-2"><p class="text-[9px] font-semibold text-yellow-800">NOTES</p><p class="text-[10px] text-yellow-800/80 mt-0.5">${c.screen.notes}</p></div>`:''}
    </div>
    <button type="button" onclick="const d=this.nextElementSibling;d.classList.toggle('hidden');this.innerHTML=d.classList.contains('hidden')?'Show more data &#9662;':'Show less &#9652;'" class="btn btn-sm btn-ghost text-brand-700 font-bold mt-1.5" style="height:22px;font-size:10px">Show more data &#9662;</button>
    <div class="hidden mt-1.5 bg-charcoal-50 rounded-lg p-2.5 space-y-1 text-[10px] text-charcoal-600">
      <p><b>Screened by:</b> ${c.screen.by} · <b>Date:</b> ${formatDate(c.screen.date)}</p>
      <p><b>Score:</b> ${c.screen.eval} / 5 · <b>Verdict:</b> ${c.screen.verdict}</p>
      <p><b>Full comments:</b> ${c.screen.notes||'No comments recorded.'}</p>
      <p><b>Next step:</b> ${c.stage==='Applied'?'schedule the screening call':'already past screening — see interview rounds below'}</p>
      <p class="text-charcoal-400"><b>Expectations:</b> ${f.salaryExp?f.salaryExp.toLocaleString()+' EGP':'—'} · ${f.availability||'—'} · ${f.education||'—'}</p>
    </div>
  </div>`:'';

  const decisionBlock = c.decision?`<div class="bg-white rounded-xl border border-charcoal-200 p-3">
    <p class="bento-label text-charcoal-500 mb-2">FINAL DECISION</p>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Decision</p><p class="text-[11px] font-semibold ${c.decision.verdict==='Accepted'?'text-green-700':'text-red-700'}">${c.decision.verdict}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">By / date</p><p class="text-[11px] font-semibold text-charcoal-900">${c.decision.by} · ${formatDate(c.decision.date)}</p></div>
      ${c.decision.note?`<div class="col-span-2 bg-purple-50 border border-purple-100 rounded-lg p-2"><p class="text-[9px] font-semibold text-purple-800">NOTE</p><p class="text-[10px] text-purple-800/80 mt-0.5">${c.decision.note}</p></div>`:''}
    </div>
  </div>`:(c.stage==='Rejected'?`<div class="bg-white rounded-xl border border-red-100 p-3">
    <p class="bento-label text-red-500 mb-2">REJECTED</p>
    <p class="text-[10px] text-red-600">${c.rejectReason||''}</p>
    <p class="text-[9px] text-charcoal-400 mt-1">Rejected ${formatDate(c.rejectedDate)} by ${c.rejectedBy}</p>
  </div>`:'');

  const vacancyMatch = (c.stage==='Accepted'||c.stage==='Hired')?(()=>{
    const m=_matchingVacancies(c.position);
    return m.length?`<div class="bg-green-50 border border-green-100 rounded-lg p-2.5"><p class="text-[9px] font-semibold text-green-800">MATCHING OPEN VACANCY</p><p class="text-[11px] text-green-800 mt-0.5">${m.map(v=>v.position+' — '+v.gym).join(' · ')}</p></div>`:`<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[9px] text-charcoal-500">No open vacancy for this role right now — candidate can join the waiting list.</p></div>`;
  })():'';

  const timeline = [
    { t:`Applied for ${c.position}`, d:formatDate(c.appliedDate), st:'done' },
    ...(c.screen?[{ t:'Screening passed', d:formatDate(c.screen.date)+' · by '+c.screen.by, st:'done' }]:[]),
    ...(c.iv1?[{ t: c.iv1.verdict==='Scheduled'||c.iv1.verdict==='Invited' ? '1st interview scheduled' : '1st interview '+c.iv1.verdict, d:c.iv1.verdict==='Scheduled'||c.iv1.verdict==='Invited'?c.iv1.date:c.iv1.date+' · '+_evalStars(c.iv1.eval), st: c.iv1.verdict==='Pass'?'done':(c.iv1.verdict==='Fail'?'current':'pending') }]:[]),
    ...(c.iv2?[{ t: c.iv2.verdict==='Scheduled'||c.iv2.verdict==='Invited' ? '2nd interview scheduled' : '2nd interview '+c.iv2.verdict, d:c.iv2.date + (c.iv2.verdict==='Pass'?' · '+_evalStars(c.iv2.eval):''), st: c.iv2.verdict==='Pass'?'done':(c.iv2.verdict==='Fail'?'current':'pending') }]:[]),
    ...(c.decision?[{ t:`Decision: ${c.decision.verdict}`, d:formatDate(c.decision.date)+' · by '+c.decision.by, st:'done' }]:[]),
    ...(c.stage==='Hired'?[{ t:`Hired — starts ${formatDate(c.hiredDate)}`, d:formatDate(c.hiredDate), st:'done' }]:[]),
  ];

  openModal(`${c.name}`, `<div class="space-y-3">
    <div class="flex items-center gap-3">
      <div class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold flex-shrink-0">${_initials(c.name)}</div>
      <div>
        <div class="flex items-center gap-2 flex-wrap"><p class="text-sm font-bold text-charcoal-900">${c.name}</p>${_stageBadge(c.stage)}</div>
        <p class="text-[11px] text-charcoal-500">${c.position} · ${c.phone}</p>
        <p class="text-[10px] text-yellow-500 mt-0.5">${'★'.repeat(c.rating)}${'☆'.repeat(Math.max(0,5-c.rating))} rating</p>
      </div>
    </div>

    ${c.stage==='Accepted' ? (()=>{ const mv=_matchingVacancies(c.position); return `<div class="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <div class="min-w-0"><p class="text-xs font-bold text-green-800">Passed every interview — Accepted</p>
      <p class="text-[11px] text-green-700 mt-0.5">Same state as the Waiting List: the whole interview pipeline is complete — he is just waiting for an open ${c.position} position${mv.length?`. Open now: ${mv.map(v=>v.position+' @ '+v.gym).join(', ')}`:' (no open seat yet — he can sit in the Waiting List until one opens)'}.</p></div>
    </div>`; })() : ''}

    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <p class="bento-label text-charcoal-500 mb-2">APPLICATION FORM</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Email</p><p class="text-[10px] font-semibold text-charcoal-900 break-all">${f.email||'—'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Source</p><p class="text-[10px] font-semibold text-charcoal-900">${f.source||'—'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Preferred gym</p><p class="text-[10px] font-semibold text-charcoal-900">${f.gymPref||'—'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Experience</p><p class="text-[10px] font-semibold text-charcoal-900">${f.expYears?f.expYears+' yrs':(f.experience||'—')}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Education</p><p class="text-[10px] font-semibold text-charcoal-900">${f.education||'—'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Shift</p><p class="text-[10px] font-semibold text-charcoal-900">${f.shift||'—'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Salary expectation</p><p class="text-[10px] font-semibold text-charcoal-900">${f.salaryExp?f.salaryExp.toLocaleString()+' EGP':'—'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Availability</p><p class="text-[10px] font-semibold text-charcoal-900">${f.availability||'—'}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2"><p class="text-[9px] text-charcoal-500">Languages</p><p class="text-[10px] font-semibold text-charcoal-900">${(f.languages||[]).join(', ')||'—'}</p></div>
      </div>
      <div class="mt-2"><p class="text-[9px] text-charcoal-500 mb-1">SKILLS</p><div class="flex flex-wrap gap-1">${(f.skills||[]).map(s=>`<span class="badge badge-brand text-[9px]">${s}</span>`).join('')||'<span class="text-[10px] text-charcoal-400">—</span>'}</div></div>
    </div>

    ${screenBlock}
    ${c.iv1?ivBlock(c.iv1,'FIRST INTERVIEW'):''}
    ${c.iv2?ivBlock(c.iv2,'SECOND INTERVIEW'):''}
    ${decisionBlock}
    ${vacancyMatch}
    ${c.stage==='Accepted'?`<div class="flex gap-2"><button onclick="closeModal();openHireWizard('${c.id}')" class="btn btn-sm btn-primary flex-1">Hire Now</button><button onclick="closeModal();_recTab='waiting';renderAll()" class="btn btn-sm btn-secondary flex-1">Send to Waiting List</button></div>`:''}

    <div>
      <p class="bento-label text-charcoal-500 mb-2">ACTIVITY</p>
      <div class="space-y-0">
        ${timeline.map((t,i)=>`<div class="flex gap-2.5">
          <div class="flex flex-col items-center">
            <span class="w-2.5 h-2.5 rounded-full ${t.st==='done'?'bg-brand-500':t.st==='current'?'bg-red-500':'bg-charcoal-200'} mt-0.5 flex-shrink-0"></span>
            ${i<timeline.length-1?'<span class="w-px bg-charcoal-100 flex-1"></span>':''}
          </div>
          <div class="pb-3"><p class="text-[11px] font-medium text-charcoal-900">${t.t}</p><p class="text-[9px] text-charcoal-400">${t.d}</p></div>
        </div>`).join('')}
      </div>
    </div>
  </div>`, { wide:true, footer:`<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>${c.blocked ? `<button onclick="closeModal();_setCandidateBlock('${c.id}', false)" class="btn btn-sm btn-success font-bold">Restore to pipeline</button>` : `${c.stage!=='Hired'&&(DEMO.showAll||hasPermission('recruitment.candidates.manage'))?`<button onclick="closeModal();_setCandidateBlock('${c.id}', true)" class="btn btn-sm btn-ghost text-red-500 font-bold">Block</button>`:''}${c.stage!=='Hired' ? ((DEMO.showAll||hasPermission('recruitment.hire.approve')) ? `<button onclick="closeModal();openHireWizard('${c.id}')" class="btn btn-sm btn-primary">Hire — Salary, Terms &amp; Account →</button>` : `<span class="text-[10px] text-charcoal-400">Hiring requires recruitment.hire.approve</span>`) : `<span class="badge badge-success text-[9px]">Hired ${formatDate(c.hiredDate)}</span>`}`}` });
}

function _nextStage(s) {
  const i=_pipStages.indexOf(s);
  if(s==='Rejected'||s==='Hired') return s;
  return _pipStages[Math.min(i+1,_pipStages.length-1)];
}

function openInterviewDetail(id) {
  const iv = MOCK.interviews.find(x=>x.id===id);
  if(!iv) return;
  openModal(`Interview — ${iv.candidate}`, `<div class="space-y-3">
    <div class="flex items-center gap-3"><div class="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">${_initials(iv.candidate)}</div><div><p class="text-sm font-bold text-charcoal-900">${iv.candidate}</p><p class="text-[11px] text-charcoal-500">${iv.position} · ${iv.gym}</p></div></div>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Date &amp; time</p><p class="text-xs font-semibold text-charcoal-900">${formatDate(iv.date)} · ${iv.time}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Format / Location</p><p class="text-xs font-semibold text-charcoal-900">${iv.type}${iv.room?` — ${iv.room}`:''}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Interviewer</p><p class="text-xs font-semibold text-charcoal-900">${iv.interviewer}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Status</p><p class="text-xs font-semibold text-charcoal-900">${iv.status}</p></div>
    </div>
    <div class="border-t border-charcoal-100 pt-2 flex items-center justify-between">
      <button onclick="showToast('Reminder sent to candidate')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Send Reminder</button>
      <button onclick="showToast('Interview feedback logged')" class="btn btn-sm btn-primary">Complete</button>
    </div>
  </div>`, { footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>' });
}

function openNewInterview() {
  openModal('Schedule Interview', `<form onsubmit="event.preventDefault();showToast('Interview scheduled');closeModal();" class="space-y-3">
    <div><label class="form-label">Candidate</label><select class="form-select">${MOCK.candidates.filter(c=>['First Interview','Second Interview','Screening'].includes(c.stage)).map(c=>`<option>${c.name} — ${c.position}</option>`).join('')}</select></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Date</label><input type="date" class="form-input" value="2026-09-14"></div>
      <div><label class="form-label">Time</label><input type="time" class="form-input" value="11:00"></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Type</label><select class="form-select"><option>On-site</option><option>Video</option></select></div>
      <div><label class="form-label">Interviewer</label><select class="form-select"><option>Youssef Kamal</option><option>Omar Youssef</option><option>Hana Mostafa</option></select></div>
    </div>
    <div><label class="form-label">Location / Link</label><input class="form-input" placeholder="Meet link or room name"></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Schedule</button></div>
  </form>`);
}

// ==================== HIRE WIZARD ====================
let _hwTerms = null;   // hire terms carried across wizard steps
function hwCaptureStep() {
  const g = id => document.getElementById(id);
  _hwTerms = _hwTerms || {};
  if (g('hw-gym')) _hwTerms.gym = g('hw-gym').value;
  if (g('hw-salary')) {
    _hwTerms.salary = Number(g('hw-salary').value) || 10000;
    _hwTerms.annualIncrease = Number(g('hw-increase').value) || 0;
    _hwTerms.leaveDays = Number(g('hw-leave').value) || 21;
    _hwTerms.startDate = g('hw-start').value || '2026-10-01';
    _hwTerms.level = g('hw-level').value || 'Junior';
    _hwTerms.email = g('hw-email').value || '';
    _hwTerms.password = g('hw-pass').value || 'Revive@2026';
    _hwTerms.role = g('hw-role').value || 'Emp';
  }
}

function openHireWizard(cid) {
  const c = MOCK.candidates.find(x=>x.id===cid);
  if(!c) return;
  _recWizStep = 1;
  hireWizardRender(cid);
}

function hireWizardRender(cid) {
  const c = MOCK.candidates.find(x=>x.id===cid);
  if(!c) return;
  const steps = ['Review','Offer','Confirm'];
  const canHire = DEMO.showAll || hasPermission('recruitment.hire.approve');
  if(!canHire) return openModal(`Hire — ${c.name}`, `<div class="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-[11px] text-yellow-800">Hire authority NOT granted. You can manage candidates through stages, but the final convert-to-employee step is performed by an HR Manager (permission: <code>recruitment.hire.approve</code>).</div>`, { footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });

  const f = c.form || {};
  let content;
  if (_recWizStep===1) {
    content = `<div class="space-y-3">
      <div class="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-start gap-2">
        <svg class="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="text-xs text-brand-800">Converting candidate to Employee creates their full HR profile, assigns an employee ID and begins the onboarding checklist. This action is audit-logged.</p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Candidate</p><p class="text-xs font-semibold text-charcoal-900">${c.name}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Position</p><p class="text-xs font-semibold text-charcoal-900">${c.position}</p></div>
        <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Gym assignment</p><select id="hw-gym" class="form-select" style="font-size:0.8125rem">${['Nasr City','Heliopolis','6th October'].map(g=>`<option ${_hwTerms && _hwTerms.gym===g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Phone</p><p class="text-xs font-semibold text-charcoal-900">${c.phone}</p></div>
      </div>
      <div><label class="form-label">Offer letter note (optional)</label><textarea class="form-input" rows="2" placeholder="e.g. Included: uniform allowance, training budget"></textarea></div>
    </div>`;
  } else if (_recWizStep===2) {
    const roleOpts = [...new Set(['Emp','Team Leader','Branch Manager','HR', ...(MOCK.roleTemplates||[]).map(t=>t.name)])];
    content = `<div class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div><label class="form-label">Salary (EGP/month)</label><input type="number" id="hw-salary" value="${(_hwTerms && _hwTerms.salary) || f.salaryExp || (c.position==='Senior Trainer'?14000:c.position==='Trainer'?10000:c.position==='Receptionist'?7500:5000)}" class="form-input" required></div>
        <div><label class="form-label">Annual increase %</label><input type="number" id="hw-increase" value="${(_hwTerms && _hwTerms.annualIncrease!=null) ? _hwTerms.annualIncrease : 7}" min="0" max="50" class="form-input" required></div>
        <div><label class="form-label">Annual leave days</label><input type="number" id="hw-leave" value="${(_hwTerms && _hwTerms.leaveDays!=null) ? _hwTerms.leaveDays : 21}" min="0" class="form-input" required></div>
        <div><label class="form-label">Start Date</label><input type="date" id="hw-start" value="${(_hwTerms && _hwTerms.startDate) || '2026-10-01'}" class="form-input" required></div>
        <div><label class="form-label">Contract type</label><select id="hw-contract" class="form-select"><option>Full-time</option><option>Part-time</option></select></div>
        <div><label class="form-label">Employment level</label><select id="hw-level" class="form-select">${['Junior','Mid','Senior'].map(l=>`<option ${(_hwTerms && _hwTerms.level) ? (_hwTerms.level===l?'selected':'') : (((c.rating>=4&&l==='Senior')||(c.rating===3&&l==='Mid')||(c.rating<3&&l==='Junior'))?'selected':'')}>${l}</option>`).join('')}</select></div>
        <div><label class="form-label">Work email</label><input type="email" id="hw-email" value="${(_hwTerms && _hwTerms.email) || f.email || c.name.toLowerCase().replace(/\s+/g,'.')+'@revive.com'}" class="form-input" required></div>
        <div><label class="form-label">Initial password</label><input type="text" id="hw-pass" value="${(_hwTerms && _hwTerms.password) || 'Revive@2026'}" class="form-input font-mono" required></div>
        <div class="col-span-2"><label class="form-label">System role</label><select id="hw-role" class="form-select">${roleOpts.map(r=>`<option value="${r}" ${(_hwTerms && _hwTerms.role===r) || (!_hwTerms && r==='Emp')?'selected':''}>${r}</option>`).join('')}</select></div>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-[10px] text-blue-800"><b>Face-ID:</b> the attendance photo is <b>not taken here</b> — the employee is enrolled at the branch by their <b>Branch Manager</b> at the Attendance Station on the first day.</div>
    </div>`;
  } else {
    content = `<div class="text-center py-2">
      <div class="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <p class="text-sm font-bold text-charcoal-900 mt-2">Ready to hire ${c.name.split(' ')[0]}</p>
      <p class="text-[11px] text-charcoal-500 mt-1">${c.position} will be created as an Active employee, assigned to the onboarding checklist, and the vacancy headcount decremented.</p>
    </div>`;
  }

  const footer = `<button onclick="hwCaptureStep();_recWizStep=Math.max(1,_recWizStep-1); hireWizardRender('${c.id}');" class="btn btn-sm btn-secondary ${_recWizStep===1?'hidden':''}">Back</button>
    ${_recWizStep<3?`<button onclick="hwCaptureStep();_recWizStep++; hireWizardRender('${c.id}');" class="btn btn-sm btn-primary">Continue</button>`:`<button onclick="confirmHireCandidate('${c.id}')" class="btn btn-sm btn-success">Confirm Hire &amp; Create Employee</button>`}`;

  const stepperHtml = `<div class="flex items-center gap-1.5">
    ${steps.map((sl,i)=>{
      const n=i+1; const cur=_recWizStep===n; const done=_recWizStep>n;
      return `<div class="flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${done?'bg-brand-500 text-white':cur?'bg-brand-100 text-brand-700 border border-brand-500':'bg-charcoal-100 text-charcoal-500'}">${done?'✓':n}</span>
        <span class="text-[9px] font-medium ${cur?'text-brand-700':done?'text-charcoal-700':'text-charcoal-400'}">${sl}</span>
      </div>${n<steps.length?'<div class="flex-1 h-px bg-charcoal-100"></div>':''}`;
    }).join('')}
  </div>`;

  openModal(`Hire — ${c.name}`, `<div class="space-y-3">
    ${stepperHtml}
    ${content}
  </div>`, { wide:true, footer });
}

function confirmHireCandidate(cid) {
  const c = MOCK.candidates.find(x=>x.id===cid); if(!c) return;
  const f = c.form||{};
  const g = id => document.getElementById(id);
  const t = _hwTerms || {};
  const gym = t.gym || g('hw-gym')?.value || 'Nasr City';
  const salary = t.salary || Number(g('hw-salary')?.value) || 10000;
  const annualIncrease = (t.annualIncrease!=null) ? t.annualIncrease : (Number(g('hw-increase')?.value) || 0);
  const leaveDays = t.leaveDays || Number(g('hw-leave')?.value) || 21;
  const startDate = t.startDate || g('hw-start')?.value || '2026-10-01';
  const level = t.level || g('hw-level')?.value || 'Junior';
  const email = t.email || g('hw-email')?.value || (f.email || c.name.toLowerCase().replace(/\s+/g,'.')+'@revive.com');
  const password = t.password || g('hw-pass')?.value || 'Revive@2026';
  const role = t.role || g('hw-role')?.value || 'Emp';
  _hwTerms = null;
  // Mark candidate as Hired
  c.stage = 'Hired';
  c.hiredDate = '2026-10-01';
  c.decision = c.decision || { by: MOCK.currentUser.fullName, date: '2026-09-09', verdict: 'Accepted', note: 'Hired on Oct 1.' };
  // Create employee record
  const initials = c.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const newEmp = {
    id: 'EMP-' + Math.floor(Math.random()*900+100),
    name: c.name,
    initials,
    position: c.position,
    level,
    gym,
    status: 'Active',
    startDate,
    phone: c.phone,
    email,
    password,
    role,
    annualIncrease,
    leaveDays,
    nationalId: '—',
    contractType: 'Full-time',
    salary,
    daysOff: leaveDays,
    daysUsed: 0,
    documents: [],
    medicalHistory: [],
    notes: `Hired from recruitment pipeline on Sep 9, 2026. Terms: ${salary} EGP/mo, ${annualIncrease}% annual increase, ${leaveDays} leave days, role ${role}. Face-ID enrollment pending at branch (Branch Manager).`,
  };
  MOCK.employees.push(newEmp);
  // Add to new comers with onboarding checklist
  MOCK.newComers.unshift({
    id: 'NC-'+Date.now(),
    name: c.name,
    position: c.position + ' — ' + level,
    startDate,
    progress: 0,
    checklist: [
      ['ID & contract signed', false],
      ['Uniform issued', false],
      ['System access created', false],
      ['Branch tour completed', false],
      ['Welcome meeting with BM', false],
    ],
  });
  // Audit log
  MOCK.auditLog.unshift({ id:'al-'+Date.now(), action:'Employee Hired from Recruitment', user:MOCK.currentUser.fullName, target:c.name, detail:'Candidate converted to employee — '+c.position, timestamp:'2026-09-09 '+new Date().toLocaleTimeString(), gym:'Nasr City' });
  closeModal();
  showToast(c.name + ' hired! Employee profile created + onboarding checklist started.', 'success');
  _recTab = 'newcomers';
  renderAll();
}