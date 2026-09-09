// ==================== DASHBOARD ====================
function renderGymSelector() {
  const u = MOCK.currentUser;
  return `<div class="relative">
    <select onchange="setGymFilter(this.value)" class="form-select" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem;width:auto">
      <option value="all">All my gyms</option>
      ${u.gyms.map(g => `<option value="${g.id}" ${u.selectedGym===g.id?'selected':''}>${g.name} — ${g.branch}</option>`).join('')}
    </select>
  </div>`;
}
function setGymFilter(id) {
  const u = MOCK.currentUser;
  u.selectedGym = id;
  renderAll();
  showToast(id==='all' ? 'Showing all assigned gyms' : 'Gym filter applied', 'info');
}

function renderDashboard() {
  const u = MOCK.currentUser;
  const s = MOCK.dashboardStats;
  const pendingHR = MOCK.requests.filter(r=>r.status==='Pending HR Review').length;
  const pendingVacancy = MOCK.vacancyRequests.filter(r=>r.status==='Pending').length;
  const expiringDocs = MOCK.events.filter(e=>e.type==='Document Expiry').length;
  const unlock = () => `<svg class="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>`;
  const trendUp = `<span class="badge badge-success text-[9px]"><svg class="w-2.5 h-2.5 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l5-5m0 0l5 5M7 7l5 5 5-5"/></svg>+${MOCK.notifications.filter(n=>!n.read).length+2}%</span>`;

  const kpiRows = [
    ['Total Employees', s.totalEmployees, 'brand', 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', '+4 this month'],
    ['Pending Requests', pendingHR, 'yellow', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', 'awaiting HR'],
    ['Open Vacancies', s.openVacancies, 'blue', 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', `${MOCK.vacancies.filter(v=>v.status==='Open').length} actively hiring`],
    ['Today\'s Attendance', s.todayAttendance+'%', 'green', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', 'vs 91% last week'],
    ['Shift Cycles', s.shiftCyclesActive, 'purple', 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', '1 draft pending'],
  ];
  const kpiColors = { brand:['bg-brand-100','text-brand-600'], yellow:['bg-yellow-100','text-yellow-600'], blue:['bg-blue-100','text-blue-600'], green:['bg-green-100','text-green-600'], purple:['bg-purple-100','text-purple-600'], red:['bg-red-100','text-red-600'] };

  const attTrend = [88, 91, 84, 93, 76, 89, s.todayAttendance];
  const attLabels = ['W1','W2','W3','W4','W5','W6','Now'];
  const attMax = 100;

  const criticalAlerts = [
    { icon:'bg-yellow-100 text-yellow-700', label:'Requests pending HR review', desc:`${pendingHR} request${pendingHR>1?'s':''} approved by Branch Managers awaiting final decision.`, cta:'Review', click:`navigateTo('requests')`, live:true, ordinal:1 },
    { icon:'bg-yellow-100 text-yellow-700', label:'Vacancy requests pending approval', desc:`${pendingVacancy} Branch Manager request${pendingVacancy>1?'s':''} awaiting HR sign-off.`, cta:'Approve', click:`navigateTo('recruitment')`, live:pendingVacancy>0, ordinal:2 },
    { icon:'bg-red-100 text-red-700', label:'Stalled candidates', desc:'3 candidates in Interview stage without update for 5+ days.', cta:'View', click:`navigateTo('recruitment')`, live:true, ordinal:3 },
    { icon:'bg-orange-100 text-orange-700', label:'Shift cycle ending soon', desc:'Sep 3 – Sep 12 cycle still in draft. Publish before Sep 12.', cta:'Schedule', click:`navigateTo('schedule')`, live:true, ordinal:4 },
    { icon:'bg-red-100 text-red-700', label:`${expiringDocs} document${expiringDocs>1?'s':''} expiring`, desc:'First Aid Certification expiring within 3 days.', cta:'Docs', click:`navigateTo('events')`, live:true, ordinal:5 },
  ].filter(a=>a.live).sort((a,b)=>a.ordinal-b.ordinal);

  const quickActions = [
    ['employees','Add Employee','M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'],
    ['recruitment','New Vacancy','M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'],
    ['requests','Decide Requests','M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'],
    ['payroll','Review Payroll','M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'],
    ['notifications','Compose Announcement','M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z'],
    ['schedule','Build Schedule','M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'],
  ];

  const branchCmp = MOCK.gymList.map(g => {
    const att = 78 + Math.round(Math.random()*18);
    const pend = MOCK.requests.filter(r=>r.gym===g.branch && r.status==='Pending HR Review').length;
    return { ...g, att, pend };
  });

  const hiringGoal = MOCK.vacancies.filter(v=>v.status==='Open').reduce((s,v)=>s+v.headcount,0);
  const hiredBudgets = 14; // total headcount approved for the quarter
  const hiringPct = Math.min(100, Math.round((hiredBudgets-hiringGoal)/mathMax(hiredBudgets,1)*100));

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-charcoal-900">${getGreeting()}, ${u.firstName} 👋</h1>
        <p class="text-xs text-charcoal-500 mt-0.5 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          ${u.position} &middot; ${u.gyms.length} assigned gyms &middot; Wednesday, September 9
        </p>
      </div>
      ${renderGymSelector()}
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-2">
      ${kpiRows.map(([label,val,color,icon,sub],i)=>{
        const c = kpiColors[color];
        return `<div class="bg-white rounded-xl border border-charcoal-200 p-3 ${i===0?'border-l-4 border-l-brand-500':''}">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-lg ${c[0]} flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 ${c[1]}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg></div>
            <div class="min-w-0">
              <p class="text-xl font-bold text-charcoal-900 cursor-pointer" onclick="${label==='Total Employees'?`navigateTo('employees')`:label==='Pending Requests'?`navigateTo('requests')`:label==='Open Vacancies'?`navigateTo('recruitment')`:''}">${val}</p>
              <p class="text-[10px] text-charcoal-500 leading-tight">${label}</p>
            </div>
          </div>
          <p class="text-[9px] text-charcoal-400 mt-1.5 flex items-center gap-1">${trendUp}<span class="text-charcoal-400">${sub}</span></p>
        </div>`;
      }).join('')}
    </div>

    <!-- Hiring goal strip -->
    <div class="bg-white rounded-xl border border-brand-200 overflow-hidden">
      <div class="px-4 py-2.5 bg-brand-50/60 border-b border-brand-100 flex items-center justify-between">
        <p class="bento-label text-brand-800"><svg class="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Q3 HIRING GOAL</p>
        <span class="text-[10px] font-semibold text-brand-700">${hiringPct}% filled</span>
      </div>
      <div class="p-3">
        <div class="w-full h-2 bg-brand-100 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full" style="width:${hiringPct}%"></div></div>
        <div class="flex justify-between text-[10px] text-charcoal-500 mt-2">
          <span><strong class="text-charcoal-800">${hiredBudgets-hiringGoal}</strong> open positions / ${hiredBudgets} targeted</span>
          <span class="text-brand-600 font-semibold cursor-pointer" onclick="navigateTo('recruitment')">View hiring pipeline →</span>
        </div>
      </div>
    </div>

    <!-- Alerts + Trend + Quick actions -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <!-- Action required -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
          <p class="bento-label flex items-center gap-1.5 text-red-700"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>ACTION REQUIRED</p>
          <span class="badge badge-red text-[9px]">${criticalAlerts.length}</span>
        </div>
        <div class="divide-y divide-charcoal-50">
          ${criticalAlerts.map(a=>`<div class="p-3 flex items-center justify-between gap-2">
            <div class="flex items-start gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-lg ${a.icon} flex items-center justify-center flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
              <div class="min-w-0">
                <p class="text-[11px] font-medium text-charcoal-900 leading-snug">${a.label}</p>
                <p class="text-[10px] text-charcoal-600 mt-0.5">${a.desc}</p>
              </div>
            </div>
            <button onclick="${a.click}" class="btn btn-sm btn-secondary text-[10px] flex-shrink-0">${a.cta}</button>
          </div>`).join('')}
          ${criticalAlerts.length===0?`<div class="p-6 text-center"><p class="text-xs text-charcoal-400">No pending actions. 🎉</p></div>`:''}
        </div>
      </div>

      <!-- Attendance trend -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
          <p class="bento-label">ATTENDANCE TREND</p>
          <span class="badge badge-brand text-[9px]">${s.todayAttendance}% now</span>
        </div>
        <div class="p-3">
          <div class="flex items-end gap-2 h-36">
            ${attTrend.map((pct,i)=>{
              const pctH = Math.round((pct/attMax)*100);
              return `<div class="flex-1 flex flex-col items-center gap-1 justify-end h-full">
                <span class="text-[8px] text-charcoal-400">${pct}%</span>
                <div class="w-full rounded-t-md ${i===attTrend.length-1?'bg-gradient-to-t from-brand-500 to-brand-300':'bg-brand-200'}" style="height:${pctH}%"></div>
                <span class="text-[8px] text-charcoal-400">${attLabels[i]}</span>
              </div>`;
            }).join('')}
          </div>
          <div class="flex items-center justify-between mt-3 pt-2 border-t border-charcoal-100 text-[10px] text-charcoal-500">
            <span>${MOCK.attendanceRecords.filter(r=>r.status==='Absent').length} absent today</span>
            ${hasPermission('attendance.view')||DEMO.showAll?`<button onclick="navigateTo('attendance')" class="text-brand-600 font-semibold">Attendance →</button>`:''}
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <p class="bento-label text-charcoal-500 mb-2">QUICK ACTIONS</p>
        <div class="grid grid-cols-2 gap-1.5">
          ${quickActions.map(([page,label,icon])=>`<button onclick="navigateTo('${page}')" class="btn btn-sm btn-secondary justify-start"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg>${label}</button>`).join('')}
          ${hasPermission('employees.bulk_import')||DEMO.showAll?`<button onclick="openBulkImport()" class="btn btn-sm btn-secondary justify-start"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Bulk Import</button>`:''}
        </div>
      </div>
    </div>

    <!-- Branch comparison + recent requests -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <!-- Branch comparison -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">BRANCH OVERVIEW</p></div>
        <div class="p-3 space-y-2.5">
          ${branchCmp.map(g=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0"></span>
              <div class="min-w-0"><p class="text-[11px] font-semibold text-charcoal-900 truncate">Revive Gym — ${g.branch}</p><p class="text-[9px] text-charcoal-500">${g.employees} employees</p></div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-[10px] font-bold text-brand-600">${g.att}% att</span>
              ${g.pend?`<span class="badge badge-yellow text-[9px]">${g.pend} pend</span>`:''}
            </div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Recent requests (permission-gated) -->
      ${hasPermission('requests.view')||DEMO.showAll?`<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden lg:col-span-2">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
          <p class="bento-label">RECENT REQUESTS AWAITING DECISION</p>
          <button onclick="navigateTo('requests')" class="text-[10px] text-brand-600 font-semibold hover:underline">View All</button>
        </div>
        <div class="divide-y divide-charcoal-50">
          ${MOCK.requests.filter(r=>r.status==='Pending HR Review').slice(0,4).map(r=>`<div class="p-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${r.employee.split(' ').map(w=>w[0]).join('')}</div>
              <div class="min-w-0">
                <p class="text-[11px] font-medium text-charcoal-900">${r.employee} — ${r.type}</p>
                <p class="text-[10px] text-charcoal-500 truncate">${r.gym} · ${r.requestedDate} · BM: ${r.bmDecision}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-primary text-[10px]">Decide</button>
              ${statusBadge(r.status)}
            </div>
          </div>`).join('')}
        </div>
      </div>`:''}
    </div>
  </div>`;
}

function openBulkImport() {
  openModal('Bulk Import Employees', `<div class="space-y-3">
    <div class="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="text-xs text-brand-800">Import employees in bulk from a CSV file. Required columns: First Name, Last Name, Email, Position, Level, Gym, Start Date. <strong>HR Manager</strong> access only.</p>
    </div>
    <div class="border-2 border-dashed border-charcoal-300 rounded-xl p-8 text-center">
      <svg class="w-10 h-10 text-charcoal-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
      <p class="text-xs text-charcoal-600">Drag & drop your CSV file here, or</p>
      <button type="button" onclick="showToast('File import simulated')" class="btn btn-sm btn-primary mt-2">Browse Files</button>
      <p class="text-[10px] text-charcoal-400 mt-2">Download template CSV</p>
    </div>
  </div>`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="showToast(\'Import queued — 14 records\');closeModal();" class="btn btn-sm btn-primary">Start Import</button>' });
}