// ==================== RECRUITMENT & HIRING ====================
let _recTab = 'overview';
let _recView = 'kanban';
let _recSearch = '';
let _recStage = 'All';
let _recVac = 'All';
let _recSel = [];
let _recWizStep = 1;

function toggleBulk(id, checked) {
  if (checked) { if (!_recSel.includes(id)) _recSel.push(id); }
  else { _recSel = _recSel.filter(x => x !== id); }
  renderAll();
}

const _stageMeta = {
  'Applied': { cls: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  'Screening': { cls: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  'Interview': { cls: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  'Offer': { cls: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  'Hired': { cls: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
};
function _stageBadge(s) { const m = _stageMeta[s]||_stageMeta.Applied; return `<span class="badge ${m.cls} text-[9px]">${s}</span>`; }
function _initials(n) { return (n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

const _candProfile = {
  'c1': { email:'mohamed.salah@mail.com', source:'LinkedIn', location:'Cairo', experience:'6 yrs — group training', education:'B.Sc. Physical Education', skills:['Group PT','HIIT','Nutrition basics'], notes:'Strong trial session. Wants evening shifts.', appliedVia:'career@revive.com' },
  'c2': { email:'nada.khaled@mail.com', source:'Referral — Omar', location:'Nasr City', experience:'3 yrs — crossfit', education:'B.Sc. Sports Science', skills:['CrossFit','Recovery','Coaching'], notes:'Good energy. Availability from Oct 1.', appliedVia:'Referral link' },
  'c3': { email:'tamer.hosny@mail.com', source:'Previous employee', location:'Heliopolis', experience:'8 yrs — competitive bodybuilding', education:'Cert. PT (ACE)', skills:['Bodybuilding','Injury prevention','Sales'], notes:'Known to the gym. Accepts current salary band.', appliedVia:'Walk-in resume' },
  'c4': { email:'salma.nagib@mail.com', source:'Reception referral', location:'Heliopolis', experience:'2 yrs — front desk hotel', education:'Diploma — Tourism', skills:['CRM','Upselling','Member care'], notes:'Fluency in English + French.', appliedVia:'OLX ad' },
  'c5': { email:'amr.diab@mail.com', source:'LinkedIn', location:'New Cairo', experience:'1 yr — cafe supervisor', education:'High school', skills:['Cash handling','Time management'], notes:'Enthusiastic, needs grooming.', appliedVia:'career@revive.com' },
  'c6': { email:'shereen.adel@mail.com', source:'Referral — Fatma', location:'6th October', experience:'5 yrs — women\'s training', education:'B.Sc. Sports Science', skills:['Women\'s bootcamp','Pilates'], notes:'Completed onboarding Sep 1.', appliedVia:'Referral link' },
  'c7': { email:'mostafa.nabil@mail.com', source:'OLX ad', location:'6th October', experience:'4 yrs — facility ops', education:'Technical diploma', skills:['Cleaning ops','Stock'], notes:'References being checked.', appliedVia:'OLX ad' },
  'c8': { email:'heba.said@mail.com', source:'Career fair', location:'Cairo', experience:'3 yrs — Pilates instructor', education:'Cert. Pilates', skills:['Pilates','Reformer'], notes:'Prefers Nasr City branch.', appliedVia:'Career fair booth' },
};

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

  const tabs = [
    {id:'overview',label:'Overview'}, {id:'vacancies',label:'Vacancies'},
    {id:'candidates',label:'Candidates'}, {id:'pipeline',label:'Pipeline'},
    {id:'interviews',label:'Interviews'}, {id:'waiting',label:'Waiting List'},
    {id:'newcomers',label:'New Comers'},
    ...(canApproveVR?[{id:'vacancy-requests',label:'Vacancy Requests'}]:[]),
  ];
  if (_recTab === 'vacancy-requests' && !canApproveVR) _recTab = 'overview';

  let body = '';
  if (_recTab === 'overview') {
    body = overviewBody(openVacancies,totalCandidates,pendingVR,totalResults());
  }
  else if (_recTab === 'vacancies') { body = vacanciesBody(canManageVac); }
  else if (_recTab === 'candidates') { body = candidatesBody(canHire, canCandidates, showAll); }
  else if (_recTab === 'pipeline') { body = pipelineBody(canHire, showAll); }
  else if (_recTab === 'interviews') { body = interviewsBody(interviewsSorted); }
  else if (_recTab === 'waiting') { body = waitingBody(); }
  else if (_recTab === 'newcomers') { body = newcomersBody(); }
  else if (_recTab === 'vacancy-requests') { body = vacancyRequestsBody(); }

  const kpiLine = `${openVacancies.length} open · ${totalCandidates} candidates · ${pendingVR.length} requests pending`;

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Recruitment & Hiring</h1><p class="text-xs text-charcoal-500 mt-0.5">${kpiLine} · ${thisWeek} interviews this week</p></div>
      ${canManageVac?`<button onclick="openNewVacancy()" class="btn btn-md btn-primary"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Create Vacancy</button>`:''}
    </div>
    <div class="flex border-b border-charcoal-100 overflow-x-auto">
      ${tabs.map(t=>`<button onclick="_recTab='${t.id}';renderAll()" class="tab-btn ${_recTab===t.id?'active':''}">${t.label}${t.id==='vacancy-requests'&&pendingVR.length?` <span class="badge badge-red text-[9px] ml-0.5">${pendingVR.length}</span>`:''}</button>`).join('')}
    </div>
    ${body}
  </div>`;
}

function totalResults() {
  return MOCK.candidates.length;
}

// ==================== OVERVIEW ====================
function overviewBody(openVacs,pendingVR,pendVRArr,candTotal) {
  const interviews = MOCK.interviews.length;
  const waiting = MOCK.waitingList.length;
  const newcomers = MOCK.newComers.filter(n=>n.progress<100).length;
  const bench = MOCK.goals.filter(g=>g.status==='On Track').length;

  const kpis = [
    ['Open Vacancies', openVacs.length, 'brand', 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z','v'+openVacs.reduce((s,v)=>s+v.headcount,0)+' headcount'],
    ['Candidates', candTotal, 'blue', 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z','in pipeline'],
    ['Interview week', interviews, 'yellow', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z','marked in calendar'],
    ['Requests pending', pendVRArr.length, 'red', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z','need sign-off'],
    ['Waiting List', waiting, 'purple', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z','on hold'],
    ['New Comers', newcomers, 'green', 'M13 7l5 5-5 5M7 7l5 5-5 5','in onboarding'],
  ];
  const col = { brand:['bg-brand-100','text-brand-600'], blue:['bg-blue-100','text-blue-600'], yellow:['bg-yellow-100','text-yellow-600'], red:['bg-red-100','text-red-600'], purple:['bg-purple-100','text-purple-600'], green:['bg-green-100','text-green-600'] };

  const funnel = [
    ['Applied', MOCK.candidates.filter(c=>['Applied','Screening','Interview','Offer','Hired'].includes(c.stage)).length],
    ['Screening', MOCK.candidates.filter(c=>['Screening','Interview','Offer','Hired'].includes(c.stage)).length],
    ['Interview', MOCK.candidates.filter(c=>['Interview','Offer','Hired'].includes(c.stage)).length],
    ['Offer', MOCK.candidates.filter(c=>['Offer','Hired'].includes(c.stage)).length],
    ['Hired', MOCK.candidates.filter(c=>c.stage==='Hired').length],
  ];
  const fMax = Math.max(...funnel.map(f=>f[1]),1);

  return `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
    ${kpis.map(([label,val,color,icon,sub],i)=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 ${i===0?'border-l-4 border-l-brand-500':''}">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-lg ${col[color][0]} flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 ${col[color][1]}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg></div>
        <div><p class="text-xl font-bold text-charcoal-900">${val}</p><p class="text-[10px] text-charcoal-500 leading-tight">${label}</p></div>
      </div>
      <p class="text-[9px] text-charcoal-400 mt-1.5">${sub}</p>
    </div>`).join('')}
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
    <!-- Funnel -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">CANDIDATE FUNNEL</p></div>
      <div class="p-3 space-y-1.5">
        ${funnel.map(([stage,n],i)=>`<div class="flex items-center gap-2">
          <span class="w-20 flex-shrink-0 text-[10px] text-charcoal-600 font-medium">${stage}</span>
          <div class="flex-1 h-6 bg-charcoal-50 rounded-md flex items-center ${i===funnel.length-1?'bg-green-50':''}" style="width:${Math.max(24, Math.round((n/fMax)*100))}%">
            <span class="mx-auto text-[10px] font-bold ${i===funnel.length-1?'text-green-700':'text-charcoal-700'}">${n}</span>
          </div>
        </div>`).join('')}
        <p class="text-[9px] text-charcoal-400 pt-1">Overall convert to hire: ${Math.round((funnel[4][1]/Math.max(funnel[0][1],1))*100)}%</p>
      </div>
    </div>

    <!-- Open vacancies -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50"><p class="bento-label">OPEN VACANCIES</p><button onclick="_recTab='vacancies';renderAll()" class="text-[10px] text-brand-600 font-semibold hover:underline">View All</button></div>
      <div class="divide-y divide-charcoal-50">${openVacs.slice(0,4).map(v=>`<div class="p-3 flex items-center justify-between gap-2" onclick="openVacancyDetail('${v.id}')" style="cursor:pointer">
        <div class="min-w-0">
          <p class="text-xs font-semibold text-charcoal-900">${v.position}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${v.gym} · ${v.headcount} position${v.headcount>1?'s':''}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="badge ${v.urgency==='High'?'badge-red':v.urgency==='Medium'?'badge-yellow':'badge-blue'} text-[9px]">${v.urgency}</span>
          <span class="text-[10px] font-bold text-brand-600">${v.candidates}</span>
        </div>
      </div>`).join('')||'<div class="p-6 text-center text-xs text-charcoal-400">No open vacancies</div>'}</div>
    </div>

    <!-- Recent candidates -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50"><p class="bento-label">RECENT CANDIDATES</p><button onclick="_recTab='candidates';renderAll()" class="text-[10px] text-brand-600 font-semibold hover:underline">All</button></div>
      <div class="divide-y divide-charcoal-50">${MOCK.candidates.slice(0,4).map(c=>`<div class="p-3 flex items-center justify-between gap-2" onclick="openCandidateDetail('${c.id}')" style="cursor:pointer">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${_initials(c.name)}</div>
          <div class="min-w-0"><p class="text-[11px] font-medium text-charcoal-900 truncate">${c.name}</p><p class="text-[10px] text-charcoal-500">${c.position}</p></div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">${_stageBadge(c.stage)}
          <span class="text-[10px] text-yellow-500">${'★'.repeat(c.rating)}${'☆'.repeat(Math.max(0,5-c.rating))}</span>
        </div>
      </div>`).join('')}</div>
    </div>
  </div>

  <!-- Vacancy requests banner -->
  ${pendVRArr.length?`<div class="grid grid-cols-2 sm:grid-cols-2 gap-2">
    ${pendVRArr.map(r=>`<div class="bg-white rounded-xl border border-yellow-200 border-l-4 border-l-yellow-400 p-3 flex items-center justify-between gap-2">
      <div class="min-w-0"><p class="text-[11px] font-semibold text-charcoal-900">${r.position} — ${r.gym}</p><p class="text-[10px] text-charcoal-500 mt-0.5">By ${r.submittedBy} · ${r.urgency} urgency</p></div>
      <div class="flex gap-1.5 flex-shrink-0">
        <button onclick="_recTab='vacancy-requests';renderAll()" class="btn btn-sm btn-primary text-[10px]">Review</button>
      </div>
    </div>`).join('')}
  </div>`:''}`;
}

// ==================== VACANCIES ====================
function vacanciesBody(canManage) {
  const vRows = MOCK.vacancies.map(v=>{
    const matched = MOCK.candidates.filter(c=>c.position===v.position);
    return { ...v, matched };
  });
  return `<div class="flex items-center justify-between mb-3">
    <p class="bento-label text-charcoal-500">VACANCY MANAGEMENT</p>
    <button onclick="showToast('Vacancy filter — simulated','info')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M6 12h12M10 20h4"/></svg>Filter</button>
  </div>
  <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
    <div class="table-responsive"><table class="data-table"><thead><tr><th>Position</th><th>Gym</th><th>Headcount</th><th>Urgency</th><th>Candidates</th><th>Status</th><th></th></tr></thead>
    <tbody>${vRows.map(v=>`<tr onclick="openVacancyDetail('${v.id}')" class="cursor-pointer">
      <td><div><p class="text-xs font-medium text-charcoal-900">${v.position}</p><p class="text-[9px] text-charcoal-400">Created ${formatDate(v.createdDate)}</p></div></td>
      <td class="text-xs">${v.gym}</td>
      <td class="text-xs font-semibold">${v.headcount}</td>
      <td class="text-xs"><span class="badge ${v.urgency==='High'?'badge-red':v.urgency==='Medium'?'badge-yellow':'badge-blue'} text-[9px]">${v.urgency}</span></td>
      <td class="text-xs">${v.matched.length} <span class="text-charcoal-300">/</span> <span class="text-charcoal-500">${v.candidates}</span></td>
      <td>${statusBadge(v.status)}</td>
      <td>${canManage?`<button onclick="event.stopPropagation();showToast('Edit vacancy — simulated')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>`:''}</td>
    </tr>`).join('')}</tbody></table></div>
  </div>
  ${!canManage?`<p class="text-[10px] text-charcoal-400 text-center">Vacancy management (create/edit/close) is hidden — you do not have <code>recruitment.vacancies.manage</code>. View-only.</p>`:''}`;
}

// ==================== CANDIDATES ====================
function candidatesBody(canHire, canCandidates, showAll) {
  let list = [...MOCK.candidates];
  if (_recSearch) list = list.filter(c=>c.name.toLowerCase().includes(_recSearch.toLowerCase())||c.position.toLowerCase().includes(_recSearch.toLowerCase()));
  if (_recStage!=='All') list = list.filter(c=>c.stage===_recStage);
  if (_recVac!=='All') list = list.filter(c=>c.position===_recVac);

  const stageOpts = ['All','Applied','Screening','Interview','Offer','Hired'];
  const vacOpts = ['All',...new Set(MOCK.candidates.map(c=>c.position))];

  const allChecked = list.length>0 && list.every(c=>_recSel.includes(c.id));

  return `<div class="space-y-2.5">
    <div class="flex flex-col sm:flex-row gap-2 flex-wrap">
      <input value="${_recSearch}" oninput="_recSearch=this.value;renderAll()" placeholder="Search candidates..." class="form-input sm:max-w-[220px]" style="padding:0.375rem 0.625rem;font-size:0.8125rem">
      <select onchange="_recStage=this.value;renderAll()" class="form-select" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem;width:auto">
        ${stageOpts.map(s=>`<option ${_recStage===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <select onchange="_recVac=this.value;renderAll()" class="form-select" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem;width:auto">
        ${vacOpts.map(v=>`<option ${_recVac===v?'selected':''}>${v}</option>`).join('')}
      </select>
      ${_recSel.length?`<button onclick="showToast(\'${_recSel.length} candidate(s) bulk-advance — simulated\');_recSel=[];renderAll();" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>Advance ${_recSel.length} selected</button>`:''}
      <span class="text-[10px] text-charcoal-400 self-center ml-auto">${list.length} of ${MOCK.candidates.length} candidates</span>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr>
        <th class="w-8"><input type="checkbox" class="rounded" ${allChecked?'checked':''} onchange="if(this.checked){_recSel=MOCK.candidates.map(c=>c.id);}else{_recSel=[];}renderAll()"></th>
        <th>Candidate</th><th>Position</th><th>Stage</th><th>Applied</th><th>Rating</th><th>Source</th><th></th></tr></thead>
      <tbody>${list.map(c=>{
        const p = _candProfile[c.id]||{};
        return `<tr onclick="openCandidateDetail('${c.id}')" class="cursor-pointer">
          <td onclick="event.stopPropagation()"><input type="checkbox" class="rounded" ${_recSel.includes(c.id)?'checked':''} onchange="toggleBulk('${c.id}',this.checked)"></td>
          <td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${_initials(c.name)}</div><div><p class="text-xs font-medium text-charcoal-900">${c.name}</p><p class="text-[9px] text-charcoal-400">${p.email||''}</p></div></div></td>
          <td class="text-xs">${c.position}</td>
          <td>${_stageBadge(c.stage)}</td>
          <td class="text-xs">${formatDate(c.appliedDate)}</td>
          <td class="text-xs text-yellow-500">${'★'.repeat(c.rating)}${'☆'.repeat(Math.max(0,5-c.rating))}</td>
          <td class="text-xs">${p.source||'—'}</td>
          <td onclick="event.stopPropagation()" class="whitespace-nowrap">
            <div class="flex gap-1">
              <button onclick="openCandidateDetail('${c.id}')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3 7a9 9 0 019-9v0a9 9 0 01-9 9v0a9 9 0 01-9-9v0a9 9 0 019-9zM12 3H8a5 5 0 014 5v0"/></svg></button>
              ${canCandidates?`<button onclick="showToast('Advanced to next stage')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></button>`:''}
              ${canHire&&(c.stage==='Offer')?`<button onclick="openHireWizard('${c.id}')" class="btn btn-sm btn-primary">Hire</button>`:''}
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:hidden">
      ${list.map(c=>{const p=_candProfile[c.id]||{};return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
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
          <button onclick="openCandidateDetail('${c.id}')" class="btn btn-sm btn-secondary flex-1 text-[10px]">Profile</button>
          ${canHire&&c.stage==='Offer'?`<button onclick="openHireWizard('${c.id}')" class="btn btn-sm btn-primary flex-1 text-[10px]">Hire</button>`:''}
        </div>
      </div>`;}).join('')||'<div class="lg:col-span-3 bg-white rounded-xl border border-charcoal-200 p-6 text-center text-xs text-charcoal-400">No candidates match your filters.</div>'}
    </div>

    ${!canCandidates?`<p class="text-[10px] text-charcoal-400 text-center">Managing candidates requires <code>recruitment.candidates.manage</code>.</p>`:''}
  </div>`;
}

// ==================== PIPELINE (KANBAN) ====================
function pipelineBody(canHire, showAll) {
  const stages = ['Applied','Screening','Interview','Offer','Hired'];
  const stageMetaColor = { Applied:'#7c3aed', Screening:'#2563eb', Interview:'#d97706', Offer:'#ea580c', Hired:'#16a34a' };
  return `<div class="flex items-center justify-between mb-2 flex-wrap gap-2">
    <div class="flex items-center gap-2">
      <select onchange="_recView=this.value;renderAll()" class="form-select" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.75rem;width:auto">
        <option value="kanban" ${_recView==='kanban'?'selected':''}>Kanban</option>
        <option value="list" ${_recView==='list'?'selected':''}>List</option>
      </select>
      <div class="hidden sm:flex items-center gap-2 text-[9px] text-charcoal-400">${stages.map(s=>`<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:${stageMetaColor[s]}"></span>${s}</span>`).join('')}</div>
    </div>
    <span class="text-[10px] text-charcoal-400">Drag or use arrows to move; HR Manager approves the final hire.</span>
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
      return `<div class="flex-1 min-w-[230px] max-w-[320px] bg-charcoal-50 rounded-xl p-2">
        <div class="flex items-center justify-between px-1 mb-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-charcoal-500 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${stageMetaColor[s]}"></span>${s}</p>
          <span class="badge badge-gray">${stageCandidates.length}</span>
        </div>
        <div class="space-y-1.5 min-h-[120px]">
          ${stageCandidates.map(c=>{
            const p=_candProfile[c.id]||{};
            return `<div class="bg-white rounded-lg border border-charcoal-200 p-2.5 shadow-sm">
              <div class="flex items-center justify-between gap-2"><p class="text-[11px] font-semibold text-charcoal-900">${c.name}</p><span class="text-[10px] text-yellow-500">${c.rating>0?'★'+c.rating:''}</span></div>
              <p class="text-[9px] text-charcoal-500">${c.position} · ${p.source||'—'}</p>
              <p class="text-[9px] text-charcoal-400 mt-1">Applied ${formatDate(c.appliedDate)}</p>
              <div class="flex items-center gap-1 mt-1.5">
                <button onclick="showToast('Moved back')" class="btn btn-sm btn-ghost text-[9px] p-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"/></svg></button>
                <button onclick="openCandidateDetail('${c.id}')" class="btn btn-sm btn-ghost text-[9px] p-1 mx-auto">View</button>
                <button onclick="showToast('Moved forward')" class="btn btn-sm btn-ghost text-[9px] p-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></button>
              </div>
              ${canHire&&s==='Offer'?`<button onclick="openHireWizard('${c.id}')" class="btn btn-sm btn-primary w-full mt-1 text-[10px]"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Hire</button>`:''}
            </div>`;
          }).join('')||`<div class="bg-white rounded-lg border border-dashed border-charcoal-200 p-3 text-center"><p class="text-[10px] text-charcoal-400">No candidates</p></div>`}
        </div>
      </div>`;
    }).join('')}
  </div>
  <p class="text-[10px] text-charcoal-400 text-center mt-2">${showAll?'Demo shows all stages. Real moves are permission-gated by candidates.manage.':'You can move candidates through stages; final Hire (ready on Offer) is reserved for HR Manager (`recruitment.hire.approve`).'}</p>`;
}

// ==================== INTERVIEWS ====================
function interviewsBody(list) {
  const statusCls = { Scheduled:'badge-blue', Invited:'badge-purple', Completed:'badge-success', Cancelled:'badge-gray', Draft:'badge-gray' };
  const grouplabels = {
    '2026-09-10': 'Tomorrow',
    '2026-09-11': 'Friday',
    '2026-09-12': 'Saturday',
    '2026-09-15': 'Tuesday',
  };
  return `<div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden lg:col-span-2">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
        <p class="bento-label">INTERVIEW SCHEDULE</p>
        <button onclick="openNewInterview()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Schedule</button>
      </div>
      <div class="divide-y divide-charcoal-50">${list.map(iv=>`<div class="p-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-11 h-11 rounded-lg bg-brand-50 border border-brand-100 flex flex-col items-center justify-center flex-shrink-0">
            <span class="text-[13px] font-bold text-brand-700 leading-none">${iv.date.split('-')[2]}</span>
            <span class="text-[8px] text-charcoal-400 uppercase">${grouplabels[iv.date]||'Sep'}</span>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-charcoal-900">${iv.candidate}</p>
            <p class="text-[10px] text-charcoal-500">${iv.position} · ${iv.gym}</p>
            <p class="text-[10px] text-charcoal-400 mt-0.5">${iv.time} · ${iv.type} · with ${iv.interviewer}${iv.room?` · ${iv.room}`:''}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class="badge ${statusCls[iv.status]||'badge-gray'} text-[9px]">${iv.status}</span>
          <button onclick="openInterviewDetail('${iv.id}')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3 7a9 9 0 019-9v0a9 9 0 01-9 9v0a9 9 0 01-9-9v0a9 9 0 019-9zM12 3H8a5 5 0 014 5v0"/></svg></button>
        </div>
      </div>`).join('')}</div>
    </div>

    <div class="space-y-3">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <p class="bento-label text-charcoal-500 mb-2">UPCOMING</p>
        <div class="space-y-2">
          ${list.filter(iv=>iv.status==='Scheduled'||iv.status==='Invited').slice(0,3).map(iv=>`<div class="flex items-center gap-2.5">
            <span class="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0"></span>
            <div class="min-w-0"><p class="text-[11px] font-medium text-charcoal-900">${iv.candidate}</p><p class="text-[9px] text-charcoal-500">${iv.date} · ${iv.time} · ${iv.type}</p></div>
          </div>`).join('')}
        </div>
      </div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <p class="bento-label text-charcoal-500 mb-2">THIS WEEK</p>
        <div class="w-full h-2 bg-charcoal-100 rounded-full"><div class="h-full bg-brand-500 rounded-full" style="width:60%"></div></div>
        <p class="text-[9px] text-charcoal-400 mt-1">3 of 5 slots used this week.</p>
      </div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <p class="bento-label text-charcoal-500 mb-2">NEED ATTENTION</p>
        <div class="space-y-2 text-[10px] text-charcoal-600">
          <p>• <strong>Nada Khaled</strong> invited — not confirmed yet.</p>
          <p>• <strong>Amr Diab</strong> interview draft — set time &amp; interviewer.</p>
        </div>
      </div>
    </div>
  </div>`;
}

// ==================== WAITING LIST ====================
function waitingBody() {
  return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
    ${MOCK.waitingList.map(w=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 border-l-4 border-l-purple-400">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${_initials(w.name)}</div>
          <div><p class="text-xs font-semibold text-charcoal-900">${w.name}</p><p class="text-[10px] text-charcoal-500">${w.position}</p></div>
        </div>
        <span class="badge badge-purple text-[9px] flex-shrink-0 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${Math.max(1,Math.round((new Date()-new Date(w.since))/86400000))}d</span>
      </div>
      <p class="text-[10px] text-charcoal-600 mt-2">${w.note}</p>
      <div class="flex items-center justify-between mt-2.5 text-[9px] text-charcoal-400"><span>${w.source} · since ${formatDate(w.since)}</span></div>
      <div class="flex gap-1.5 mt-2">
        <button onclick="showToast('Moved to pipeline')" class="btn btn-sm btn-primary flex-1 text-[10px]">Promote</button>
        <button onclick="showToast('Removed from waiting list','info')" class="btn btn-sm btn-ghost text-[10px]">Remove</button>
      </div>
    </div>`).join('')}
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
  return `<div class="space-y-1.5">
    ${MOCK.vacancyRequests.map(r=>`<div class="bg-white rounded-xl border ${r.status==='Pending'?'border-yellow-200 border-l-4 border-l-yellow-400':'border-charcoal-200'} p-3">
      <div class="flex items-center justify-between gap-2">
        <div><p class="text-xs font-semibold text-charcoal-900">${r.position} — ${r.gym}</p><p class="text-[10px] text-charcoal-500">Submitted by ${r.submittedBy} on ${formatDate(r.submittedDate)} · ${r.urgency} urgency</p></div>
        ${statusBadge(r.status)}
      </div>
      <p class="text-[10px] text-charcoal-600 mt-1.5">${r.reason}</p>
      ${r.status==='Pending'?`<div class="flex gap-1.5 mt-2">
        <button onclick="showToast('Vacancy created on approve')" class="btn btn-sm btn-primary">Approve → Create Vacancy</button>
        <button onclick="showToast('Request rejected','error')" class="btn btn-sm btn-danger-outline">Reject</button>
      </div>`:`<div class="flex gap-1.5 mt-2"><span class="badge badge-gray text-[9px]">Decided by ${MOCK.currentUser.fullName}</span></div>`}
    </div>`).join('')}
  </div>`;
}

// ==================== MODALS ====================
function openVacancyDetail(id) {
  const v = MOCK.vacancies.find(x=>x.id===id);
  if(!v) return;
  const showAll = DEMO.showAll;
  const canHire = showAll || hasPermission('recruitment.hire.approve');
  const related = MOCK.candidates.filter(c=>c.position===v.position);
  const funnel = ['Applied','Screening','Interview','Offer','Hired'].map(s=>[s, related.filter(c=>c.stage===s).length]);
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
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-600">
      Related candidates: ${related.length ? related.map(c=>c.name).join(', ') : 'none yet.'} ${canHire?'<br><span class="text-brand-700 font-semibold">You have hire authority for this vacancy.</span>':'<br><span>Hire action reserved for HR Manager (`recruitment.hire.approve`).</span>'}
    </div>
  </div>`, { footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
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
  const p = _candProfile[cid]||{};
  const timeline = [
    { t:`Applied for ${c.position}`, d:formatDate(c.appliedDate), st:'done' },
    ...(c.stage!=='Applied'?[{ t:'Screening call passed', d:'', st:'done' }]:[]),
    ...(['Interview','Offer','Hired'].includes(c.stage)?[{ t:'Technical interview scheduled', d:c.stage==='Interview'?'Pending':'Review', st:c.stage==='Interview'?'pending':'done' }]:[]),
    ...(c.stage==='Offer'?[{ t:'Offer being prepared', d:'', st:'current' }]:[]),
    ...(c.stage==='Hired'?[{ t:`Hired — starts ${formatDate(c.hiredDate)}`, d:formatDate(c.hiredDate), st:'done' }]:[]),
  ];
  openModal(`${c.name}`, `<div class="space-y-3">
    <div class="flex items-center gap-3">
      <div class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold flex-shrink-0">${_initials(c.name)}</div>
      <div>
        <div class="flex items-center gap-2"><p class="text-sm font-bold text-charcoal-900">${c.name}</p>${_stageBadge(c.stage)}</div>
        <p class="text-[11px] text-charcoal-500">${c.position} · ${c.phone}</p>
        <p class="text-[10px] text-yellow-500 mt-0.5">${'★'.repeat(c.rating)}${'☆'.repeat(Math.max(0,5-c.rating))} rating</p>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-2 text-center">
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-xs font-bold text-charcoal-900">${p.source||'—'}</p><p class="text-[8px] text-charcoal-500">Source</p></div>
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-xs font-bold text-charcoal-900">${p.experience||'—'}</p><p class="text-[8px] text-charcoal-500">Experience</p></div>
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-xs font-bold text-charcoal-900">${p.location||'—'}</p><p class="text-[8px] text-charcoal-500">Location</p></div>
    </div>
    <div>
      <p class="bento-label text-charcoal-500 mb-1">SKILLS</p>
      <div class="flex flex-wrap gap-1">${(p.skills||[]).map(s=>`<span class="badge badge-brand text-[9px]">${s}</span>`).join('')}</div>
    </div>
    <div class="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
      <p class="text-[10px] font-semibold text-yellow-800 mb-1">INTERNAL NOTES</p>
      <p class="text-[10px] text-yellow-800/80">${p.notes||'No notes yet.'}</p>
    </div>
    <div>
      <p class="bento-label text-charcoal-500 mb-2">ACTIVITY</p>
      <div class="space-y-0">
        ${timeline.map((t,i)=>`<div class="flex gap-2.5">
          <div class="flex flex-col items-center">
            <span class="w-2.5 h-2.5 rounded-full ${t.st==='done'?'bg-brand-500':t.st==='current'?'bg-yellow-500':'bg-charcoal-200'} mt-0.5 flex-shrink-0"></span>
            ${i<timeline.length-1?'<span class="w-px bg-charcoal-100 flex-1"></span>':''}
          </div>
          <div class="pb-3"><p class="text-[11px] font-medium text-charcoal-900">${t.t}</p><p class="text-[9px] text-charcoal-400">${t.d}</p></div>
        </div>`).join('')}
      </div>
    </div>
  </div>`, { wide:true, footer:`<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>${DEMO.showAll||hasPermission('recruitment.candidates.manage')?`<button onclick="showToast('Advanced to next stage');closeModal();" class="btn btn-sm btn-primary">Advance Stage</button>`:''}${DEMO.showAll||hasPermission('recruitment.hire.approve')?(c.stage==='Offer'?`<button onclick="closeModal();openHireWizard('${c.id}')" class="btn btn-sm btn-success">Hire Candidate</button>`:''):''}` });
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
    <div><label class="form-label">Candidate</label><select class="form-select">${MOCK.candidates.filter(c=>c.stage==='Interview'||c.stage==='Screening').map(c=>`<option>${c.name} — ${c.position}</option>`).join('')}</select></div>
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
        <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Gym assignment</p><select class="form-select" style="font-size:0.8125rem"><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select></div>
        <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Phone</p><p class="text-xs font-semibold text-charcoal-900">${c.phone}</p></div>
      </div>
      <div><label class="form-label">Offer letter note (optional)</label><textarea class="form-input" rows="2" placeholder="e.g. Included: uniform allowance, training budget"></textarea></div>
    </div>`;
  } else if (_recWizStep===2) {
    content = `<div class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div><label class="form-label">Salary (EGP/month)</label><input type="number" value="${c.position==='Senior Trainer'?14000:c.position==='Trainer'?10000:c.position==='Receptionist'?7500:5000}" class="form-input" required></div>
        <div><label class="form-label">Start Date</label><input type="date" value="2026-10-01" class="form-input" required></div>
        <div><label class="form-label">Contract type</label><select class="form-select"><option>Full-time</option><option>Part-time</option></select></div>
        <div><label class="form-label">Employment level</label><select class="form-select"><option>Junior</option><option>Mid</option><option>Senior</option></select></div>
      </div>
    </div>`;
  } else {
    content = `<div class="text-center py-2">
      <div class="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <p class="text-sm font-bold text-charcoal-900 mt-2">Ready to hire ${c.name.split(' ')[0]}</p>
      <p class="text-[11px] text-charcoal-500 mt-1">${c.position} will be created as an Active employee, assigned to the onboarding checklist, and the vacancy headcount decremented.</p>
    </div>`;
  }

  const footer = `<button onclick="_recWizStep=Math.max(1,_recWizStep-1); hireWizardRender('${c.id}');" class="btn btn-sm btn-secondary ${_recWizStep===1?'hidden':''}">Back</button>
    ${_recWizStep<3?`<button onclick="_recWizStep++; hireWizardRender('${c.id}');" class="btn btn-sm btn-primary">Continue</button>`:`<button onclick="showToast('Employee created from candidate');closeModal();" class="btn btn-sm btn-success">Confirm Hire</button>`}`;

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