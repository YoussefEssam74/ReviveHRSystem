// ==================== EMPLOYEES DIRECTORY ====================
let _empFilter = { gym: 'all', status: 'all', search: '' };
let _empSelectedId = null;

// Termination pipeline stages (BM submits → HR follows up → HR records verdict)
const _sepStages = ['Requested', 'Notice Period', 'Exit In Progress', 'Under Review', 'Completed'];
const _sepStageColors = { Requested: '#7c3aed', 'Notice Period': '#2563eb', 'Exit In Progress': '#d97706', 'Under Review': '#ea580c', Completed: '#16a34a' };

// ---- Terminations page state + helpers -------------------------------------
let _sepGym = 'all';
let _sepTab = 'workflow';
let _sepModalId = null;
const _gymColors = { 'Nasr City': '#2563eb', 'Heliopolis': '#7c3aed', '6th October': '#d97706' };
const _annualEntitlement = 21; // days per year → accrued monthly

function setSepGym(g) { _sepGym = g; renderAll(); }
function openSepTab(t) { _sepTab = t; if (_sepModalId) openSeparation(_sepModalId); }

function _gymPill(gym) {
  const c = _gymColors[gym] || '#94a3b8';
  return `<span class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap" style="background:${c}1a;color:${c};border:1px solid ${c}33"><span class="w-1.5 h-1.5 rounded-full" style="background:${c}"></span>${gym}</span>`;
}
function _noticeDaysLeft(lastDay) {
  const end = parseDisplayDate(lastDay);
  if (!end) return null;
  return Math.max(0, Math.round((end - MOCK_TODAY) / 86400000));
}
// Annual leave is per year and accrued monthly (entitlement/12). At exit the
// days actually taken are settled against the accrued balance — any days taken
// beyond the accrual are counted as ABSENT (unpaid), not annual leave.
function _leaveSettlement(s) {
  const emp = MOCK.employees.find(e => e.name === s.employee);
  const taken = (emp && emp.leaveTaken) || s.leaveTaken || 6;
  const monthly = _annualEntitlement / 12;
  const monthsElapsed = Math.min(12, Math.max(1, MOCK_TODAY.getMonth() + 1));
  const accrued = Math.floor(monthsElapsed * monthly);
  const balance = accrued - taken;
  return { entitlement: _annualEntitlement, monthly, monthsElapsed, accrued, taken, balance, overage: Math.max(0, -balance), payout: Math.max(0, balance) };
}

function renderEmployees(page='directory') {
  const showAll = DEMO.showAll;
  const canCreate = showAll || hasPermission('employees.create');
  const canBulk = showAll || hasPermission('employees.bulk_import');
  const canTransfer = showAll || hasPermission('employees.transfer');
  const canCompensate = showAll || hasPermission('employees.compensation.manage');
  const canOffboard = showAll || hasPermission('employees.offboard');
  const canRole = showAll || hasPermission('employees.role.assign');
  const canLeaveBal = showAll || hasPermission('employees.leave_balance.manage');

  let list = MOCK.employees.filter(e => e.id !== MOCK.currentUser.id);
  if (_empFilter.gym !== 'all') list = list.filter(e => e.gym === _empFilter.gym);
  if (_empFilter.status !== 'all') list = list.filter(e => e.status === _empFilter.status);
  if (_empFilter.search) list = list.filter(e => e.name.toLowerCase().includes(_empFilter.search.toLowerCase()));

  const gyms = MOCK.gymList;

  if (state.empView === 'detail' && _empSelectedId) {
    return renderEmployeeProfile(_empSelectedId);
  }

  const activeCount = MOCK.employees.filter(e=>e.status==='Active').length;
  const leaveCount = MOCK.employees.filter(e=>e.status==='On Leave').length;
  const noticeCount = MOCK.employees.filter(e=>e.status==='Notice Period').length;
  const suspCount = MOCK.employees.filter(e=>e.status==='Suspended').length;

  return `<div class="flex flex-col h-full min-h-0 gap-2">
    <!-- Row 1: Header + Views + Primary Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
      <div class="flex items-center gap-2.5">
        <div>
          <h1 class="text-sm font-bold text-charcoal-900 leading-tight">Employees</h1>
          <p class="text-[10px] text-charcoal-500">${list.length} of ${MOCK.employees.length} employees</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${canBulk?`<button onclick="openBulkImport()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Bulk Import</button>`:''}
        ${canCreate?`<button onclick="openAddEmployee()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Add Employee</button>`:''}
      </div>
    </div>

    <!-- Row 2: Compact Filters + Integrated Status Summary -->
    <div class="bg-white rounded-lg border border-charcoal-200 px-2.5 py-1.5 flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative">
          <svg class="w-3.5 h-3.5 text-charcoal-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" oninput="_empFilter.search=this.value;renderAll()" class="form-input" placeholder="Search employees..." style="padding-left:1.75rem;width:180px">
        </div>
        <select onchange="_empFilter.gym=this.value;renderAll()" class="form-select w-auto">
          <option value="all">All Gyms</option>
          ${gyms.map(g=>`<option value="${g.branch}" ${_empFilter.gym===g.branch?'selected':''}>${g.name} — ${g.branch}</option>`).join('')}
        </select>
        <select onchange="_empFilter.status=this.value;renderAll()" class="form-select w-auto">
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="On Leave">On Leave</option>
          <option value="Notice Period">Notice Period</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      <!-- Compact Status Summary Pills (zero vertical waste) -->
      <div class="hidden sm:flex items-center gap-1.5 text-[10px]">
        <span class="stat-pill"><span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span><strong class="text-brand-700">${activeCount}</strong> Active</span>
        <span class="stat-pill"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span><strong class="text-yellow-700">${leaveCount}</strong> Leave</span>
        <span class="stat-pill"><span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span><strong class="text-orange-700">${noticeCount}</strong> Notice</span>
        <span class="stat-pill"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span><strong class="text-red-700">${suspCount}</strong> Suspended</span>
      </div>
    </div>

    <!-- Desktop Table (fills 100% of remaining viewport, zero page scroll) -->
    <div class="bg-white rounded-lg border border-charcoal-200 overflow-hidden hidden lg:flex flex-col flex-1 min-h-0">
      <div class="flex-1 min-h-0 overflow-y-auto">
        <table class="data-table">
          <thead class="sticky top-0 z-10 bg-[#f9f9ff]">
            <tr><th>Employee</th><th>Position</th><th>Level</th><th>Gym</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>${list.map(e=>`<tr class="cursor-pointer hover:bg-charcoal-50/50" onclick="openEmployeeProfile('${e.id}')">
            <td><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${e.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${e.name}</p><p class="text-[9px] text-charcoal-400">${e.id}</p></div></div></td>
            <td class="text-xs">${e.position}</td>
            <td class="text-xs">${e.level}</td>
            <td class="text-xs">${e.gym}</td>
            <td>${statusBadge(e.status)}</td>
            <td><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden overflow-y-auto flex-1 min-h-0">${list.map(e=>`<div class="bg-white rounded-lg border border-charcoal-200 p-2 card-interactive" onclick="openEmployeeProfile('${e.id}')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${e.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${e.name}</p><p class="text-[10px] text-charcoal-500">${e.position} · ${e.gym}</p></div>
        </div>
        ${statusBadge(e.status)}
      </div>
    </div>`).join('')}</div>

    <!-- Subtle Lifecycle Bar (clean, compact single line) -->
    <div class="flex items-center justify-between text-[10px] text-charcoal-400 px-1 py-0.5 flex-shrink-0">
      <span>Lifecycle: ${canTransfer?'Transfer Gym · ':''}${canCompensate?'Compensation · ':''}${canOffboard?'Offboard · ':''}${canRole?'Role Assignment':''}</span>
      <span class="text-charcoal-500">${list.length} records displayed</span>
    </div>
  </div>`;
}

// ==================== TERMINATIONS (BM → HR PIPELINE) ====================
// Where it comes from: the Branch Manager submits who needs to leave → HR
// receives it in the pipeline and follows the exit steps → HR records the
// final verdict (why he left · money direction · banned or return).
function renderTerminations() {
  const showAll = DEMO.showAll;
  const canOffboard = showAll || hasPermission('employees.offboard');
  const total = MOCK.separations.length;
  const shown = _sepGym === 'all' ? total : MOCK.separations.filter(s => s.gym === _sepGym).length;
  return `<div class="flex flex-col h-full min-h-0 gap-2">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
      <div>
        <h1 class="text-sm font-bold text-charcoal-900 leading-tight">Terminations</h1>
        <p class="text-[10px] text-charcoal-500">${_sepGym==='all'?`${total} exits across all gyms`:`${shown} of ${total} exits · ${_sepGym}`} · from the Branch Manager → HR follows up → verdict.</p>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button onclick="openRequestTermination()" class="btn btn-sm btn-danger-outline" title="Branch Manager submits who needs to leave">+ Request Termination (BM)</button>
        ${canOffboard?`<button onclick="openInitiateOffboarding()" class="btn btn-sm btn-primary">+ Initiate Offboarding</button>`:''}
      </div>
    </div>
    <div class="bg-white rounded-lg border border-charcoal-200 px-2 py-1.5 flex items-center gap-1.5 flex-wrap flex-shrink-0">
      <span class="text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold mr-1">Gym</span>
      ${['all','Nasr City','Heliopolis','6th October'].map(g=>`<button onclick="setSepGym('${g}')" class="px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${_sepGym===g?'bg-charcoal-900 text-white':'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100'}">${g==='all'?'All Gyms':g}</button>`).join('')}
    </div>
    ${renderOffboarding()}
  </div>`;
}

function renderOffboarding() {
  const showAll = DEMO.showAll;
  const canOffboard = showAll || hasPermission('employees.offboard');
  const all = MOCK.separations;
  const active = _sepGym === 'all' ? all : all.filter(s => s.gym === _sepGym);
  const exitSteps = 5;

  const strip = [
    ['Requested', active.filter(s=>s.status==='Requested').length, 'text-purple-600'],
    ['Notice Period', active.filter(s=>s.status==='Notice Period').length, 'text-blue-600'],
    ['Exit In Progress', active.filter(s=>s.status==='Exit In Progress').length, 'text-yellow-600'],
    ['Under Review', active.filter(s=>s.status==='Under Review').length, 'text-orange-600'],
    ['Completed', active.filter(s=>s.status==='Completed').length, 'text-charcoal-900']
  ];

  return `<div class="flex flex-col h-full min-h-0 gap-2">
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 flex-shrink-0">
      ${strip.map((t,i)=>`<div class="stat-tile ${i===0?'border-l-4 border-l-red-500':''}"><p class="stat-value ${t[2]}">${t[1]}</p><p class="stat-label mt-0.5">${t[0]}</p></div>`).join('')}
    </div>

    <div class="flex gap-3 overflow-x-auto lg:overflow-visible flex-1 min-h-0">
      ${_sepStages.map(stage=>{
        const list = active.filter(s=>s.status===stage);
        return `<div class="w-72 min-w-[260px] flex-shrink-0 lg:flex-1 lg:flex-shrink rounded-xl border border-charcoal-200 bg-charcoal-50/50 flex flex-col min-h-0">
          <div class="flex items-center justify-between px-3 py-2 border-b border-charcoal-200 flex-shrink-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide ${stage==='Completed'?'text-green-600':'text-charcoal-500'} flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${_sepStageColors[stage]}"></span>${stage}</p>
            <span class="text-[9px] text-charcoal-500">${list.length}</span>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">${list.map(s=>_sepCard(s, stage, canOffboard)).join('')||`<div class="bg-white rounded-lg border border-dashed border-charcoal-200 p-3 text-center"><p class="text-[10px] text-charcoal-400">No exits here</p></div>`}</div>
        </div>`;
      }).join('')}
    </div>

    <div class="bg-white rounded-xl border border-brand-200 border-l-4 border-l-brand-500 p-3 flex-shrink-0">
      <p class="text-xs font-semibold text-charcoal-900">EXIT PROCESS</p>
      <p class="text-[10px] text-charcoal-500">Standard ${exitSteps}-step offboarding: Exit interview → Handover → Uniform/asset return → Access revocation → Final settlement. Annual leave is settled pro-rata (${_annualEntitlement} days/yr, accrued monthly) — days taken beyond the accrual are counted as <b class="text-red-600">absent</b>, not annual leave.</p>
    </div>
  </div>`;
}

function _sepCard(s, stage, canMove) {
  const done = s.checklist.filter(c=>c[1]).length;
  const isLast = stage === 'Completed';
  const initials = s.employee.split(' ').map(w=>w[0]).join('');
  const ls = _leaveSettlement(s);
  const daysLeft = _noticeDaysLeft(s.lastDay);
  const leaveChip = ls.overage > 0
    ? `<span class="badge badge-red text-[8px]">Leave over ${ls.overage}d → ABSENT</span>`
    : `<span class="badge badge-green text-[8px]">Leave +${ls.balance}d payout</span>`;
  return `<div class="bg-white rounded-lg border border-charcoal-200 p-2.5 shadow-sm hover:shadow-md transition-shadow">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${initials}</div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-charcoal-900 truncate">${s.employee}</p>
        <p class="text-[10px] text-charcoal-500 truncate">${s.position}</p>
      </div>
      ${_gymPill(s.gym)}
    </div>
    <div class="mt-2 rounded-lg bg-charcoal-50 p-2 space-y-1">
      <div class="flex items-center justify-between gap-2">
        <p class="text-[10px] text-purple-700 font-semibold truncate">${s.requestedBy === 'Branch Manager' ? 'BM ' : ''}${s.requestedByUser || s.requestedBy || '—'}</p>
        <span class="text-[9px] text-charcoal-400 flex-shrink-0">${s.submittedDate || ''}</span>
      </div>
      <p class="text-[10px] text-charcoal-600 truncate" title="${s.reason}">Why: ${s.reason}</p>
    </div>
    <div class="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
      <div><p class="text-[9px] uppercase text-charcoal-400">Last day</p><p class="font-medium text-charcoal-800">${s.lastDay}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">Notice</p><p class="font-medium text-charcoal-800">${daysLeft === null ? '—' : daysLeft + ' days left'}</p></div>
    </div>
    <div class="mt-1.5 flex flex-wrap gap-1">
      ${stage==='Requested' ? '<span class="badge badge-purple text-[8px]">From BM</span>' : ''}
      ${stage==='Notice Period' ? '<span class="badge badge-blue text-[8px]">Notice period</span>' : ''}
      ${leaveChip}
      ${s.verdict ? _sepVerdictChips(s) : ''}
    </div>
    <div class="mt-2 flex items-center gap-2">
      <div class="flex-1 h-1.5 bg-charcoal-100 rounded-full overflow-hidden"><div class="h-full ${isLast?'bg-green-500':stage==='Requested'?'bg-purple-500':stage==='Notice Period'?'bg-blue-500':'bg-yellow-500'} rounded-full" style="width:${s.progress}%"></div></div>
      <span class="text-[9px] text-charcoal-500">${done}/${s.checklist.length}</span>
    </div>
    <div class="mt-2 flex items-center justify-between gap-1">
      ${canMove ? `<div class="flex gap-1">
        ${stage!=='Requested'?`<button onclick="moveSeparation('${s.id}',-1)" class="btn btn-icon btn-ghost" title="Move back"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>`:''}
        ${isLast?'':`<button onclick="moveSeparation('${s.id}',1)" class="btn btn-icon btn-ghost" title="Move forward"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></button>`}
      </div>` : ''}
      <button onclick="openSeparation('${s.id}')" class="btn btn-sm btn-secondary">Manage · View data</button>
    </div>
  </div>`;
}

function moveSeparation(id, dir) {
  const s = MOCK.separations.find(x=>x.id===id); if(!s) return;
  const i = _sepStages.indexOf(s.status); if(i<0) return;
  const next = _sepStages[Math.min(_sepStages.length-1, Math.max(0, i+dir))];
  if (next === s.status) return;
  s.status = next;
  if (next === 'Completed') {
    s.progress = 100;
    s.checklist.forEach(c => c[1] = true);
  }
  renderAll();
}

function _sepVerdictChips(s) {
  const v = s.verdict; if (!v) return '';
  const d = v.settlement || { direction: 'none', amount: 0 };
  let out = [];
  if (d.direction === 'owedToEmployee') out.push(`<span class="badge badge-green text-[8px]">Pay out ${d.amount} EGP</span>`);
  else if (d.direction === 'employeeOwes') out.push(`<span class="badge badge-red text-[8px]">Owes ${d.amount} EGP</span>`);
  else out.push(`<span class="badge badge-gray text-[8px]">No balance</span>`);
  if (v.rehire && v.rehire.status === 'Banned') out.push(`<span class="badge badge-red text-[8px]">Banned</span>`);
  else if (v.rehire) out.push(`<span class="badge badge-green text-[8px]">Rehire eligible</span>`);
  return out.join(' ');
}

function _sepVerdictHTML(s, canOffboard) {
  const v = s.verdict || null;
  if (s.status === 'Completed') {
    return v ? `<div class="bg-green-50 border border-green-200 rounded-lg p-2.5">
      <div class="flex items-center justify-between gap-2"><p class="text-[10px] font-semibold text-green-800 uppercase tracking-wide">Exit Verdict</p><div class="flex flex-wrap gap-1">${_sepVerdictChips(s)}</div></div>
      <p class="text-[10px] text-green-800 mt-1">${v.finalReason}</p>
      ${v.settlement && v.settlement.note ? `<p class="text-[10px] text-green-700 mt-0.5">Settlement: ${v.settlement.note}</p>` : ''}
      ${v.rehire && v.rehire.note ? `<p class="text-[10px] text-green-700 mt-0.5">Rehire: ${v.rehire.note}</p>` : ''}
    </div>` : `<div class="bg-green-50 border border-green-200 rounded-lg p-2.5 text-center text-xs font-semibold text-green-800">Separation finalized — employee records archived.</div>`;
  }
  if (!canOffboard) return v ? `<p class="text-[10px] text-charcoal-400">Exit verdict recorded by HR.</p>` : '';
  const settle = v ? (v.settlement || { direction: 'none', amount: 0, note: '' }) : { direction: 'none', amount: 0, note: '' };
  const rehire = v ? (v.rehire || { status: 'Eligible', note: '' }) : { status: 'Eligible', note: '' };
  return `<div class="border-t border-charcoal-100 pt-2">
    <p class="text-xs font-semibold text-charcoal-900 uppercase tracking-wide">Exit Verdict — HR Record</p>
    <p class="text-[10px] text-charcoal-500 mt-0.5">Why the employee left, the final settlement (money owed vs. to pay), and rehire eligibility.</p>
    <div class="space-y-2 mt-2">
      <div><label class="form-label">Why ${s.employee.split(' ')[0]} left</label><textarea id="sep-v-reason" class="form-input" rows="2">${v ? v.finalReason : ''}</textarea></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><label class="form-label">Final Settlement</label>
          <select id="sep-v-settle" class="form-select">
            <option value="none" ${settle.direction==='none'?'selected':''}>No balance</option>
            <option value="owedToEmployee" ${settle.direction==='owedToEmployee'?'selected':''}>Company owes employee — pay out</option>
            <option value="employeeOwes" ${settle.direction==='employeeOwes'?'selected':''}>Employee owes company — deduct</option>
          </select>
        </div>
        <div><label class="form-label">Amount (EGP)</label><input id="sep-v-amount" type="number" class="form-input" value="${settle.amount}" min="0"></div>
      </div>
      <div><label class="form-label">Settlement Note</label><input id="sep-v-settle-note" class="form-input" value="${settle.note||''}" placeholder="e.g. remaining days, deductions, reference..."></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><label class="form-label">Rehire Eligibility</label>
          <select id="sep-v-rehire" class="form-select">
            <option value="Eligible" ${rehire.status==='Eligible'?'selected':''}>Eligible to return</option>
            <option value="Banned" ${rehire.status==='Banned'?'selected':''}>Banned from rehire</option>
          </select>
        </div>
        <div><label class="form-label">Rehire Note</label><input id="sep-v-rehire-note" class="form-input" value="${rehire.note||''}" placeholder="e.g. contract-role only..."></div>
      </div>
    </div>
    <div class="flex justify-end pt-2"><button onclick="saveExitVerdict('${s.id}')" class="btn btn-sm btn-primary">${v?'Update':'Record'} Exit Verdict</button></div>
  </div>`;
}

function openSeparation(id) {
  const s = MOCK.separations.find(x=>x.id===id); if(!s) return;
  _sepModalId = id;
  const canOffboard = DEMO.showAll || hasPermission('employees.offboard');
  const tabs = `<div class="flex items-center gap-1 bg-charcoal-100 rounded-lg p-0.5 w-full flex-shrink-0">
    <button onclick="openSepTab('workflow')" class="px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${_sepTab==='workflow'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500 hover:text-charcoal-700'}">Exit Workflow</button>
    <button onclick="openSepTab('employee')" class="px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${_sepTab==='employee'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500 hover:text-charcoal-700'}">Employee Data</button>
  </div>`;
  const body = (_sepTab === 'employee') ? _sepEmployeeDataHTML(s) : _sepWorkflowHTML(s, canOffboard);
  openModal(`Leaving — ${s.employee}`, `${tabs}${body}`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}

function _sepWorkflowHTML(s, canOffboard) {
  const doneCount = s.checklist.filter(c=>c[1]).length;
  const allDone = doneCount === s.checklist.length;
  const daysLeft = _noticeDaysLeft(s.lastDay);

  const items = (label, done, idx) => `<label class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5 cursor-pointer hover:bg-charcoal-100 transition-colors">
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full ${done?'bg-green-500':'bg-charcoal-300'}"></span>
      <span class="text-xs ${done?'line-through text-charcoal-400':'text-charcoal-800 font-medium'}">${label}</span>
    </div>
    <input type="checkbox" ${done?'checked':''} ${canOffboard?'':'disabled'} class="rounded border-charcoal-300 text-brand-500 w-4 h-4 cursor-pointer" onchange="toggleSepChecklist('${s.id}', ${idx}, this.checked)">
  </label>`;

  const requesterLine = s.requestedBy ? `<div class="flex items-center justify-between bg-charcoal-50 rounded-lg px-3 py-2">
    <p class="text-[10px] text-charcoal-500">${s.requestedBy==='Branch Manager'?'Requested by':s.requestedBy==='HR Manager'?'Initiated by':'Requested via'} <b class="text-charcoal-800">${s.requestedByUser||s.requestedBy}</b></p>
    ${s.submittedDate?`<span class="text-[10px] text-charcoal-500 font-medium">${s.submittedDate}</span>`:''}
  </div>` : '';

  return `<div class="space-y-3 mt-3">
    ${requesterLine}
    <div class="rounded-lg border border-charcoal-200 p-2.5">
      <div class="flex items-center justify-between gap-2"><p class="text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold">Notice period · ${s.gym}</p>${_gymPill(s.gym)}</div>
      <div class="grid grid-cols-3 gap-2 mt-1.5 text-[10px]">
        <div><p class="text-[9px] uppercase text-charcoal-400">Last working day</p><p class="font-semibold text-charcoal-800">${s.lastDay}</p></div>
        <div><p class="text-[9px] uppercase text-charcoal-400">Days left</p><p class="font-semibold text-charcoal-800">${daysLeft === null ? '—' : daysLeft}</p></div>
        <div><p class="text-[9px] uppercase text-charcoal-400">Reason</p><p class="font-semibold text-charcoal-800 truncate" title="${s.reason}">${s.reason}</p></div>
      </div>
    </div>
    <div class="flex items-center justify-between text-xs font-semibold px-1">
      <span class="text-charcoal-700">Exit Steps</span>
      <span class="${allDone?'text-green-600':'text-brand-600'}">${doneCount}/${s.checklist.length} (${s.progress}%)</span>
    </div>
    <div class="w-full h-2 bg-charcoal-100 rounded-full overflow-hidden">
      <div class="h-full ${s.status==='Completed'?'bg-green-500':'bg-brand-500'} rounded-full transition-all" style="width:${s.progress}%"></div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">${s.checklist.map((c, i)=>items(c[0], c[1], i)).join('')}</div>
    ${_sepVerdictHTML(s, canOffboard)}
    ${canOffboard && s.status !== 'Completed' ? `<div class="pt-2 flex justify-between items-center border-t border-charcoal-100">
      <span class="text-[10px] text-charcoal-500">${!allDone ? 'Complete remaining exit steps to finalize.' : !s.verdict ? 'Record the exit verdict above to finalize.' : 'All exit steps verified — finalize to archive the employee record.'}</span>
      <button onclick="finalizeSeparation('${s.id}')" class="btn btn-sm ${(allDone && s.verdict) ? 'btn-danger' : 'btn-disabled'}" ${(allDone && s.verdict) ? '' : 'disabled'}>Finalize Separation ✓</button>
    </div>` : s.status !== 'Completed' ? `<p class="text-[10px] text-charcoal-400">Requires <code>employees.offboard</code> to update checklist.</p>` : ''}
  </div>`;
}

function _sepEmployeeDataHTML(s) {
  const emp = MOCK.employees.find(e => e.name === s.employee);
  const ls = _leaveSettlement(s);
  const gross = (emp && emp.salary) || 6000;
  const firstName = s.employee.split(' ')[0];

  const overageBox = ls.overage > 0 ? `<div class="mt-2 rounded-lg bg-red-50 border border-red-200 p-2.5">
    <p class="text-[10px] font-semibold text-red-700">${firstName} took ${ls.taken} annual-leave days — but only ${ls.accrued} were accrued by ${MOCK_TODAY.getFullYear()}-month ${ls.monthsElapsed}.</p>
    <p class="text-[10px] text-red-700 mt-1"><b>${ls.overage} day(s) over the accrual are counted as ABSENT</b> (unpaid) and deducted from the final settlement — they do not count as annual leave. Already applied as the payroll deduction below — remove it there if another line already covers it.</p>
  </div>` : `<div class="mt-2 rounded-lg bg-green-50 border border-green-200 p-2.5">
    <p class="text-[10px] font-semibold text-green-700">Leave balance at exit: <b>+${ls.payout} days</b> — to be paid out with the final settlement.</p>
  </div>`;

  const historyBlock = `<div class="rounded-lg border border-charcoal-200 p-2.5">
    <p class="text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold">Employment history</p>
    <div class="mt-1.5 space-y-1.5">${[
      {type:'Joined Revive',date:`${formatDate(emp?emp.hireDate:'—')}`,detail:`Hired as ${s.position}.`},
      {type:'Status → '+(emp?emp.status:'—'),date:'Sep 9, 2026',detail:'Exit workflow opened through the Terminations pipeline.'},
    ].map(h=>`<div class="flex items-start gap-2.5 bg-charcoal-50 rounded-lg p-2">
      <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[9px] font-semibold flex-shrink-0">${h.type.split(' ')[0].slice(0,2).toUpperCase()}</div>
      <div><p class="text-xs font-medium text-charcoal-900">${h.type}</p><p class="text-[10px] text-charcoal-500">${h.date}</p><p class="text-[10px] text-charcoal-600">${h.detail}</p></div>
    </div>`).join('')}</div>
  </div>`;

  const attBlock = `<div class="rounded-lg border border-charcoal-200 p-2.5">
    <p class="text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold">Attendance — last 30 days</p>
    <div class="grid grid-cols-3 gap-2 mt-1.5">
      ${[['Present','21','text-green-600'],['Late','2','text-yellow-600'],['Absent','1','text-red-600']].map(([k,v,c])=>`<div class="bg-charcoal-50 rounded-lg py-1.5 text-center"><p class="text-base font-bold ${c}">${v}</p><p class="text-[10px] text-charcoal-500">${k}</p></div>`).join('')}
    </div>
    <p class="text-[9px] text-charcoal-400 mt-1.5">Note: any leave days over the annual accrual convert to <b class="text-red-600">absent</b> at exit — affecting attendance-based deductions.</p>
  </div>`;

  const leaveBlock = `<div class="rounded-lg border border-charcoal-200 p-2.5">
    <p class="text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold">Annual leave — settlement at exit</p>
    <p class="text-[10px] text-charcoal-600 mt-1">Annual leave is <b>${ls.entitlement} days per year</b>, accrued <b>${ls.monthly}</b> days per completed month. As of ${MOCK_TODAY.getFullYear()}-${String(MOCK_TODAY.getMonth()+1).padStart(2,'0')} (month ${ls.monthsElapsed}):</p>
    <div class="grid grid-cols-3 gap-2 mt-1.5 text-center">
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Accrued</p><p class="text-xs font-bold text-charcoal-900">${ls.accrued} d</p></div>
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Taken</p><p class="text-xs font-bold text-charcoal-900">${ls.taken} d</p></div>
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Balance</p><p class="text-xs font-bold ${ls.balance<0?'text-red-600':'text-green-600'}">${ls.balance>=0?'+':''}${ls.balance} d</p></div>
    </div>
    ${overageBox}
  </div>`;

  return `<div class="space-y-2.5 mt-3">
    <div class="flex items-center gap-2.5 bg-charcoal-50 rounded-lg p-2.5">
      <div class="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">${s.employee.split(' ').map(w=>w[0]).join('')}</div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-charcoal-900">${s.employee} <span class="text-[10px] text-charcoal-400 font-normal">${emp?emp.id:'—'}</span></p>
        <p class="text-[10px] text-charcoal-500">${s.position} · hired ${formatDate(emp?emp.hireDate:'—')} · base <b>${gross.toLocaleString()} EGP</b></p>
      </div>
      ${_gymPill(s.gym)}
      ${statusBadge(emp?emp.status:s.status)}
    </div>
    ${_payStatementHTML(s)}
    ${_sepRequestsHTML(s)}
    ${historyBlock}
    ${attBlock}
    ${leaveBlock}
    <p class="text-[9px] text-charcoal-400 text-center">All payroll edits here are audit-logged and feed the final settlement when you close the account.</p>
  </div>`;
}

// ---- Editable payroll ledger for the exit settlement -----------------------
function _ensureSepPayroll(s) {
  let pays = MOCK.payrollItems.filter(p => p.name === s.employee);
  if (!pays.length) {
    const emp = MOCK.employees.find(e => e.name === s.employee);
    const gross = (emp && emp.salary) || 6000;
    const social = Math.round(gross * 0.09);
    const rec = {
      employeeId: emp ? emp.id : 'RV-0000', name: s.employee, gym: s.gym, position: s.position,
      days: 22, overtime: 0, gross, deductions: social, net: gross - social, status: 'Draft',
      deductionLines: [{ id: 'ded-' + Date.now(), date: 'Sep 1', label: 'Social insurance share', amount: social, reason: 'Auto — social insurance', requestId: null, status: 'Accepted' }]
    };
    MOCK.payrollItems.push(rec);
    pays = [rec];
  }
  const ls = _leaveSettlement(s);
  if (ls.overage > 0 && !pays[0]._overageRemoved) {
    const p = pays[0];
    const label = 'Unpaid annual leave (absent > accrued)';
    if (!(p.deductionLines || []).some(d => d.label === label)) {
      const daily = Math.round(p.gross / 22);
      p.deductionLines.push({ id: 'ded-ovr-' + Date.now(), date: 'Sep ' + MOCK_TODAY.getDate(), label, amount: daily * ls.overage, reason: `Auto — ${ls.overage} day(s) over ${ls.accrued} accrued are absent, not annual leave`, requestId: null, status: 'Pending' });
      _recalcPay(p);
    }
  }
  return pays;
}

function _recalcPay(p) {
  p.deductions = (p.deductionLines || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  p.net = p.gross - p.deductions;
}

function _payStatementHTML(s) {
  const pays = _ensureSepPayroll(s);
  const firstName = s.employee.split(' ')[0];
  return pays.map(p => {
    const rows = (p.deductionLines || []).map(d => `<div class="flex items-center justify-between gap-2 bg-charcoal-50 rounded-lg px-2 py-1 text-[10px]">
      <div class="min-w-0 flex-1"><p class="text-xs font-medium text-charcoal-900 truncate">${d.label}</p><p class="text-[9px] text-charcoal-500 truncate">${d.reason || ''} · ${d.date}</p></div>
      <span class="flex items-center gap-2 flex-shrink-0"><b class="${d.status==='Pending'?'text-amber-600':'text-red-600'}">${d.amount} EGP</b>${statusBadge(d.status)}<button onclick="removeSepDeduction('${s.id}','${p.employeeId}','${d.id}')" class="btn btn-icon btn-ghost" title="Remove deduction"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></span>
    </div>`).join('');
    return `<div>
      <p class="flex items-center justify-between text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold"><span>Payroll · ${p.status} · ${p.position}</span><span class="text-[9px] text-brand-600 normal-case">editable by HR — audit logged</span></p>
      <div class="rounded-lg border border-charcoal-200 bg-white p-2.5 mt-1">
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg py-1.5">
            <p class="text-[9px] uppercase text-charcoal-400">Gross</p>
            <div class="flex items-center justify-center gap-1 mt-0.5"><input id="sep-gross-${p.employeeId}" type="number" class="form-input" value="${p.gross}" style="width:82px;padding:2px 6px;font-size:10px;text-align:center">
            <button onclick="updateSepGross('${s.id}','${p.employeeId}')" class="text-[9px] text-brand-600 hover:underline flex-shrink-0">apply</button></div>
          </div>
          <div class="rounded-lg py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Deductions</p><p class="text-xs font-bold text-red-600 mt-0.5">- ${p.deductions.toLocaleString()}</p></div>
          <div class="rounded-lg py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Net</p><p class="text-xs font-bold text-brand-600 mt-0.5">${p.net.toLocaleString()}</p></div>
        </div>
        <p class="text-[9px] uppercase text-charcoal-400 mt-2">Deductions (${(p.deductionLines || []).length}) — remove or add</p>
        <div class="mt-1 space-y-1">${rows || '<p class="text-[10px] text-charcoal-400 text-center py-1">No deductions</p>'}</div>
        <div class="mt-1.5 flex items-center gap-1.5">
          <input id="sep-ded-label-${p.employeeId}" class="form-input" placeholder="New deduction (e.g. ${firstName} absent leave days)" style="flex:1;padding:4px 8px;font-size:10px">
          <input id="sep-ded-amount-${p.employeeId}" type="number" class="form-input" placeholder="EGP" style="width:78px;padding:4px 8px;font-size:10px">
          <button onclick="addSepDeduction('${s.id}','${p.employeeId}')" class="btn btn-sm btn-secondary">+ Add</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function _sepRequestsHTML(s) {
  const reqs = MOCK.requests.filter(r => r.employee === s.employee);
  const firstName = s.employee.split(' ')[0];
  return `<div>
    <p class="flex items-center justify-between text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold"><span>Requests — everything for ${firstName}</span><span class="text-[9px] text-charcoal-400 normal-case">${reqs.length} total</span></p>
    <div class="rounded-lg border border-charcoal-200 bg-white p-2.5 mt-1">
      <div class="max-h-44 overflow-y-auto space-y-1">${reqs.map(r=>`<div class="flex items-center justify-between gap-2 bg-charcoal-50 rounded-lg px-2 py-1.5">
        <div class="min-w-0"><p class="text-xs font-medium text-charcoal-900 truncate">${r.type}${r.period ? ' — ' + r.period : ''}</p><p class="text-[9px] text-charcoal-500 truncate">${r.requestedDate || ''} · ${r.reason || '—'}</p></div>
        ${statusBadge(r.status)}
      </div>`).join('') || '<p class="text-[10px] text-charcoal-400 text-center py-2">No requests on file</p>'}
      </div>
      <p class="text-[9px] text-charcoal-400 mt-1.5">Resolve any <b class="text-amber-600">Pending HR Review</b> requests before finalizing — every request on file shows here so you can close the account with full context.</p>
    </div>
  </div>`;
}

function updateSepGross(sepId, payId) {
  const p = MOCK.payrollItems.find(x => x.employeeId === payId); if (!p) return;
  const v = parseFloat(document.getElementById('sep-gross-' + payId)?.value);
  if (isNaN(v) || v < 0) return;
  const before = p.net;
  p.gross = v;
  _recalcPay(p);
  const empName = (MOCK.separations.find(x => x.id === sepId) || {}).employee || p.name;
  MOCK.auditLog.unshift({ id: 'al-' + Date.now(), action: 'Settlement Edited', user: MOCK.currentUser.fullName, target: empName, detail: `Payroll gross updated → net ${before} → ${p.net} EGP`, timestamp: '2026-09-09', gym: p.gym });
  showToast(`Payroll recalculated — net ${p.net.toLocaleString()} EGP`);
  openSeparation(sepId);
  renderAll();
}

function removeSepDeduction(sepId, payId, dedId) {
  const p = MOCK.payrollItems.find(x => x.employeeId === payId); if (!p) return;
  const d = (p.deductionLines || []).find(x => x.id === dedId); if (!d) return;
  if (d.label === 'Unpaid annual leave (absent > accrued)') p._overageRemoved = true;
  p.deductionLines = p.deductionLines.filter(x => x.id !== dedId);
  _recalcPay(p);
  const empName = (MOCK.separations.find(x => x.id === sepId) || {}).employee || p.name;
  MOCK.auditLog.unshift({ id: 'al-' + Date.now(), action: 'Settlement Edited', user: MOCK.currentUser.fullName, target: empName, detail: `Deduction removed: ${d.label} (${d.amount} EGP) — net now ${p.net}`, timestamp: '2026-09-09', gym: p.gym });
  showToast(`Deduction removed — net ${p.net.toLocaleString()} EGP`);
  openSeparation(sepId);
  renderAll();
}

function addSepDeduction(sepId, payId) {
  const p = MOCK.payrollItems.find(x => x.employeeId === payId); if (!p) return;
  const label = (document.getElementById('sep-ded-label-' + payId)?.value || '').trim();
  const amount = parseFloat(document.getElementById('sep-ded-amount-' + payId)?.value);
  if (!label || isNaN(amount) || amount <= 0) { showToast('Enter a label and amount', 'error'); return; }
  p.deductionLines.push({ id: 'ded-' + Date.now(), date: 'Sep ' + MOCK_TODAY.getDate(), label, amount, reason: 'Added by HR during exit settlement', requestId: null, status: 'Pending' });
  _recalcPay(p);
  const empName = (MOCK.separations.find(x => x.id === sepId) || {}).employee || p.name;
  MOCK.auditLog.unshift({ id: 'al-' + Date.now(), action: 'Settlement Edited', user: MOCK.currentUser.fullName, target: empName, detail: `Deduction added: ${label} (${amount} EGP) — net now ${p.net}`, timestamp: '2026-09-09', gym: p.gym });
  showToast(`Deduction added — net ${p.net.toLocaleString()} EGP`);
  openSeparation(sepId);
  renderAll();
}

function saveExitVerdict(id) {
  const s = MOCK.separations.find(x=>x.id===id); if(!s) return;
  const g = x => document.getElementById(x);
  const finalReason = (g('sep-v-reason')?.value||'').trim() || s.reason;
  const dir = g('sep-v-settle')?.value || 'none';
  const amount = Math.max(0, parseFloat(g('sep-v-amount')?.value) || 0);
  const sNote = (g('sep-v-settle-note')?.value||'').trim();
  const rehireStatus = g('sep-v-rehire')?.value || 'Eligible';
  const rNote = (g('sep-v-rehire-note')?.value||'').trim();
  s.verdict = { finalReason, settlement: { direction: dir, amount, note: sNote }, rehire: { status: rehireStatus, note: rNote } };
  if (['Requested','Notice Period','Exit In Progress'].includes(s.status)) s.status = 'Under Review';
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Exit Verdict Recorded',
    user: MOCK.currentUser.fullName,
    target: s.employee,
    detail: `Verdict: ${finalReason} · Settlement ${dir} (${amount} EGP) · Rehire: ${rehireStatus}`,
    timestamp: '2026-09-09',
    gym: s.gym
  });
  closeModal();
  showToast(`Exit verdict recorded for ${s.employee}`);
  renderAll();
}

function toggleSepChecklist(sepId, idx, checked) {
  const s = MOCK.separations.find(x=>x.id===sepId); if(!s) return;
  s.checklist[idx][1] = checked;
  const done = s.checklist.filter(c=>c[1]).length;
  s.progress = Math.round((done / s.checklist.length) * 100);
  if (done > 0 && (s.status === 'Requested' || s.status === 'Notice Period')) {
    s.status = 'Exit In Progress';
  }
  openSeparation(sepId);
  renderAll();
}

function finalizeSeparation(sepId) {
  const s = MOCK.separations.find(x=>x.id===sepId); if(!s) return;
  s.status = 'Completed';
  s.progress = 100;
  s.checklist.forEach(c => c[1] = true);
  const emp = MOCK.employees.find(e => e.name === s.employee);
  if (emp) emp.status = 'Suspended';
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Employee Offboarded',
    user: MOCK.currentUser.fullName,
    target: s.employee,
    detail: `Exit checklist completed. Separation finalized (Reason: ${s.reason})`,
    timestamp: '2026-09-09',
    gym: s.gym
  });
  showToast(`Separation completed for ${s.employee}`);
  openSeparation(sepId);
  renderAll();
}

const _bmsByGym = { 'Nasr City': 'Youssef Kamal', 'Heliopolis': 'Omar Hassan', '6th October': 'Heba Ibrahim' };

function openRequestTermination() {
  const empList = MOCK.employees.filter(e => e.status !== 'Suspended' && !MOCK.separations.some(s => s.employee === e.name && s.status !== 'Completed'));
  openModal('Request Termination — Branch Manager', `<form onsubmit="event.preventDefault();submitRequestTermination();" class="space-y-3">
    <p class="text-[10px] text-charcoal-500">The Branch Manager flags who needs to leave. HR receives it in the <b class="text-purple-700">Requested</b> pipeline and follows the exit steps, then records the final verdict (reason, settlement, rehire).</p>
    <div><label class="form-label">Employee *</label>
      <select id="bm-term-emp" class="form-select" required>${empList.map(e=>`<option value="${e.name}">${e.name} (${e.position} — ${e.level} · ${e.gym})</option>`).join('')}</select>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Last Working Day *</label><input id="bm-term-last-day" type="date" class="form-input" value="2026-09-30" required></div>
      <div><label class="form-label">Termination Reason *</label>
        <select id="bm-term-reason" class="form-select"><option>Performance issues</option><option>Attendance violations</option><option>Misconduct / policy breach</option><option>Contract expiry — not renewing</option><option>Restructuring / redundancy</option></select>
      </div>
    </div>
    <div><label class="form-label">BM Notes</label><textarea id="bm-term-notes" class="form-input" rows="2" placeholder="Brief context for HR..."></textarea></div>
    <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-danger-outline">Submit to HR →</button>
    </div>
  </form>`, { wide: true });
}

function submitRequestTermination() {
  const empName = document.getElementById('bm-term-emp')?.value;
  const lastDay = document.getElementById('bm-term-last-day')?.value || '2026-09-30';
  const reason = document.getElementById('bm-term-reason')?.value || 'Performance issues';
  const notes = document.getElementById('bm-term-notes')?.value.trim() || '';
  const emp = MOCK.employees.find(e => e.name === empName);
  if (!emp) return;
  const newSep = {
    id: 'sep-' + Date.now(),
    employee: empName,
    position: `${emp.position} — ${emp.level}`,
    gym: emp.gym,
    lastDay: lastDay,
    reason: `${reason}${notes ? ` — ${notes}` : ''}`,
    requestedBy: 'Branch Manager',
    requestedByUser: _bmsByGym[emp.gym] || 'Branch Manager',
    submittedDate: 'Sep 9, 2026',
    status: 'Requested',
    progress: 0,
    checklist: [['Exit interview scheduled', false], ['Handover completed', false], ['Uniform returned', false], ['Access cards revoked', false], ['Final settlement', false]],
    verdict: null
  };
  MOCK.separations.unshift(newSep);
  MOCK.auditLog.unshift({ id:'al-'+Date.now(), action:'Termination Requested by BM', user:(_bmsByGym[emp.gym]||'Branch Manager'), target: empName, detail:`Submitted to HR (Last Day: ${lastDay}, Reason: ${reason})`, timestamp:'2026-09-09', gym: emp.gym });
  closeModal();
  showToast(`Termination requested by BM for ${empName}`);
  navigateTo('terminations');
}

function openInitiateOffboarding(preselectedEmpId) {
  const empList = MOCK.employees.filter(e => e.status !== 'Suspended');
  const targetEmp = preselectedEmpId ? MOCK.employees.find(e => e.id === preselectedEmpId) : empList[0];

  openModal('Initiate Offboarding', `<form onsubmit="event.preventDefault();submitInitiateOffboarding();" class="space-y-3">
    <div>
      <label class="form-label">Employee *</label>
      <select id="off-emp-name" class="form-select" required>
        ${empList.map(e => `<option value="${e.name}" ${targetEmp && targetEmp.id===e.id?'selected':''}>${e.name} (${e.position} · ${e.gym})</option>`).join('')}
      </select>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="form-label">Last Working Day *</label>
        <input id="off-last-day" type="date" class="form-input" value="2026-09-30" required>
      </div>
      <div>
        <label class="form-label">Separation Reason *</label>
        <select id="off-reason" class="form-select">
          <option>Resignation</option>
          <option>End of Contract</option>
          <option>Mutual Agreement</option>
          <option>Performance Termination</option>
          <option>Relocation / Personal</option>
        </select>
      </div>
    </div>
    <div>
      <label class="form-label">Handover & Exit Notes</label>
      <textarea id="off-notes" class="form-input" rows="2" placeholder="Specify handover partner, asset returns, replacement vacancy..."></textarea>
    </div>
    <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Create Offboarding Checklist →</button>
    </div>
  </form>`, { wide: true });
}

function submitInitiateOffboarding() {
  const empName = document.getElementById('off-emp-name')?.value;
  const lastDay = document.getElementById('off-last-day')?.value || '2026-09-30';
  const reason = document.getElementById('off-reason')?.value || 'Resignation';
  const notes = document.getElementById('off-notes')?.value.trim() || '';

  const emp = MOCK.employees.find(e => e.name === empName);
  if (emp) emp.status = 'Notice Period';

  const newSep = {
    id: 'sep-' + Date.now(),
    employee: empName,
    position: emp ? `${emp.position} — ${emp.level}` : 'Staff',
    gym: emp ? emp.gym : 'Nasr City',
    lastDay: lastDay,
    reason: `${reason}${notes ? ` — ${notes}` : ''}`,
    requestedBy: 'HR Manager',
    requestedByUser: MOCK.currentUser.fullName,
    submittedDate: 'Sep 9, 2026',
    status: 'Notice Period',
    progress: 0,
    checklist: [
      ['Exit interview scheduled', false],
      ['Handover completed', false],
      ['Uniform returned', false],
      ['Access cards revoked', false],
      ['Final settlement', false]
    ],
    verdict: null
  };

  MOCK.separations.unshift(newSep);
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Offboarding Initiated',
    user: MOCK.currentUser.fullName,
    target: empName,
    detail: `Offboarding initiated (Last Day: ${lastDay}, Reason: ${reason})`,
    timestamp: '2026-09-09',
    gym: emp ? emp.gym : 'Nasr City'
  });

  closeModal();
  showToast(`Offboarding initiated for ${empName}`);
  navigateTo('terminations');
  setTimeout(() => openSeparation(newSep.id), 200);
}

function openEmployeeProfile(id) {
  _empSelectedId = id;
  navigateTo('employees');
  state.empView = 'detail';
  renderAll();
}

// ==================== EMPLOYEE PROFILE ====================
function renderEmployeeProfile(id) {
  const e = MOCK.employees.find(x=>x.id===id);
  if(!e) return renderEmployees();
  const tab = state.empTab || 'personal';
  const showAll = DEMO.showAll;
  const canTransfer = showAll || hasPermission('employees.transfer');
  const canPosition = showAll || hasPermission('employees.position.change');
  const canCompensate = showAll || hasPermission('employees.compensation.manage');
  const canOffboard = showAll || hasPermission('employees.offboard');
  const canRole = showAll || hasPermission('employees.role.assign');
  const canContract = showAll || hasPermission('employees.contract.manage');
  const canDocsManage = showAll || hasPermission('employees.documents.manage');
  const canLeaveManage = showAll || hasPermission('employees.leave_balance.manage');

  const tabs = [
    {id:'personal',label:'Personal Info'}, {id:'documents',label:'Documents'},
    {id:'employment',label:'Employment History'}, {id:'attendance',label:'Attendance Summary'},
    {id:'shift',label:'Current Shift'}, {id:'requests',label:'Requests History'},
    {id:'leave',label:'Leave Balance'}, {id:'eval',label:'Evaluations History'}, {id:'payroll',label:'Payroll Snapshot'},
  ];

  let lifecycleActions = '';
  if (canTransfer) lifecycleActions += `<button onclick="showToast('Transfer Gym — simulated')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Transfer Gym</button>`;
  if (canPosition) lifecycleActions += `<button onclick="showToast('Change Position/Level — simulated')" class="btn btn-sm btn-secondary">Change Position</button>`;
  if (canRole) lifecycleActions += `<button onclick="openChangeRole('${e.id}')" class="btn btn-sm btn-secondary">Change System Role</button>`;
  if (canCompensate) lifecycleActions += `<button onclick="showToast('Manage Compensation — simulated')" class="btn btn-sm btn-secondary">Manage Compensation</button>`;
  if (canContract) lifecycleActions += `<button onclick="showToast('Manage Contract — simulated')" class="btn btn-sm btn-secondary">Manage Contract</button>`;
  if (canOffboard) lifecycleActions += `<button onclick="openInitiateOffboarding('${e.id}')" class="btn btn-sm btn-danger-outline">Offboard</button>`;

  const tabContent = {
    personal: `<div class="grid grid-cols-2 gap-2">
      ${[['Gym', e.gym],['Position', e.position],['Level', e.level],['Hire Date', formatDate(e.hireDate)],['Email', e.email],['Phone', e.phone],['Employee ID', e.id],['Base Salary', 'EGP ' + e.salary.toLocaleString()]].map(([k,v])=>`<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">${k.toUpperCase()}</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${v}</p></div>`).join('')}
    </div>`,
    documents: `<div class="space-y-2">
      ${[
        {name:'Employment Contract',cat:'Employment',status:'Valid'},
        {name:'National ID (Front & Back)',cat:'Identification',status:'Valid'},
        {name:'Personal Photo',cat:'Identification',status:'Valid'},
        {name:'First Aid Certification',cat:'Certification',status:'Expiring Soon'},
        {name:'Medical Fitness Certificate',cat:'Medical',status:'Valid'},
        {name:'Degree Certificate',cat:'Education',status:'Valid'},
      ].map(d=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
        <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center"><span class="material-icons text-sm">description</span></div><div><p class="text-xs font-medium text-charcoal-900">${d.name}</p><p class="text-[10px] text-charcoal-500">${d.cat}</p></div></div>
        ${statusBadge(d.status)}
      </div>`).join('')}
      ${canDocsManage?`<button onclick="showToast('Upload document — simulated')" class="btn btn-sm btn-secondary w-full"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0L8 8m4 4V4"/></svg>Upload Document</button>`:''}
    </div>`,
    employment: `<div class="space-y-2">
      ${[
        {type:'Position Changed',from:'Junior Trainer',to:'Trainer',date:'01 Aug 2026',detail:'Promoted based on Q2 2026 evaluation.'},
        {type:'Gym Transfer',from:'Heliopolis',to:'Nasr City',date:'01 May 2026',detail:'Requested transfer approved by HR.'},
        {type:'Joined Revive',from:null,to:null,date:'12 Jan 2026',detail:'Initial hire as Junior Trainer.'},
      ].map(h=>`<div class="flex items-start gap-3 bg-charcoal-50 rounded-lg p-2.5">
        <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${h.type.split(' ').map(w=>w[0]).join('')}</div>
        <div><p class="text-xs font-medium text-charcoal-900">${h.type}</p><p class="text-[10px] text-charcoal-500">${h.date}${h.from?` · ${h.from} → ${h.to}`:''}</p><p class="text-[10px] text-charcoal-600 mt-0.5">${h.detail}</p></div>
      </div>`).join('')}
    </div>`,
    attendance: `<div class="bg-charcoal-50 rounded-lg p-3 text-center mb-2"><p class="text-2xl font-bold text-brand-600">96.4%</p><p class="text-[10px] text-charcoal-500">Attendance Rate</p></div>
    <div class="grid grid-cols-3 gap-2 mb-2">
      ${[['Present','22','text-green-600'],['Late','2','text-yellow-600'],['Absent','1','text-red-600']].map(([k,v,c])=>`<div class="bg-white rounded-lg border border-charcoal-200 p-2 text-center"><p class="text-base font-bold ${c}">${v}</p><p class="text-[10px] text-charcoal-500">${k}</p></div>`).join('')}
    </div>
    <div class="space-y-1.5">${[['Aug 26','08:02','—','On Time'],['Aug 25','16:08','00:01','Late'],['Aug 24','—','—','Off'],['Aug 23','07:58','16:03','On Time']].map(([d,ci,co,st])=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2">
      <p class="text-xs text-charcoal-700">${d}</p><p class="text-[10px] text-charcoal-500">${ci} → ${co}</p>${statusBadge(st)}
    </div>`).join('')}</div>`,
    shift: `<div class="bg-charcoal-50 rounded-lg p-3 text-center"><p class="text-base font-bold text-charcoal-900">Morning · 08:00–16:00</p><p class="text-[10px] text-charcoal-500 mt-1">Current Week · Sep 7 – 13</p></div>
    <div class="grid grid-cols-7 gap-1 mt-3">${['M','T','W','T','F','S','S'].map((d,i)=>`<div class="rounded-lg border p-2 text-center ${i===1?'border-brand-500 bg-brand-50':''}"><p class="text-[9px] text-charcoal-400 font-semibold">${d}</p><p class="text-[10px] ${i===2?'text-charcoal-300':'text-brand-700 font-medium'} mt-1">${i===2?'OFF':i===1?'08:00':'08:00'}</p></div>`).join('')}</div>`,
    requests: `<div class="space-y-1.5">${MOCK.requests.filter(r=>r.employee===e.name).map(r=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
      <div><p class="text-xs font-medium text-charcoal-900">${r.type}</p><p class="text-[10px] text-charcoal-500">${r.requestedDate} · Submitted ${formatDate(r.submittedDate)}</p></div>${statusBadge(r.status)}
    </div>`).join('')||`<div class="bg-charcoal-50 rounded-lg p-4 text-center"><p class="text-xs text-charcoal-500">No requests found</p></div>`}</div>`,
    leave: `${canLeaveManage?`<div class="flex justify-end mb-2"><button onclick="showToast('Edit leave balance — simulated')" class="btn btn-sm btn-primary">Edit Balance</button></div>`:''}
    <div class="border${canLeaveManage?'':'-2 border-dashed border-charcoal-200 rounded-xl'} space-y-2 ${canLeaveManage?'':'p-3'}">
      ${[['Annual Leave','10','of 21 days'],['Sick Leave','3','of 10 days'],['Unpaid Leave','0','of 5 days']].map(([k,v,t])=>`<div class="bg-charcoal-50 rounded-lg p-2.5"><div class="flex items-center justify-between"><p class="text-xs font-medium text-charcoal-900">${k}</p><p class="text-xs font-bold text-brand-600">${v} <span class="text-charcoal-400 font-normal">${t}</span></p></div><div class="w-full h-1.5 bg-charcoal-200 rounded-full mt-1.5 overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:${Math.min(100,parseInt(v)*10)}%"></div></div></div>`).join('')}
    </div>
    ${!canLeaveManage?`<p class="text-[10px] text-charcoal-400 mt-2 text-center">Leave balance is <strong>view-only</strong> — you do not have <code>employees.leave_balance.manage</code>.</p>`:''}`,
    eval: `<div class="space-y-1.5">${[['Q2 2026','4.2','Exceeds'],['Q1 2026','3.8','Meets']].map(([p,s,r])=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
      <div><p class="text-xs font-medium text-charcoal-900">${p}</p><p class="text-[10px] text-charcoal-500">Score: ${s}/5</p></div>${statusBadge(r)}
    </div>`).join('')}</div>`,
    payroll: `<div class="space-y-1.5">${[['July 2026','12400'],['June 2026','12700'],['May 2026','12200']].map(([p,n])=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
      <p class="text-xs font-medium text-charcoal-900">${p}</p><p class="text-xs font-bold text-charcoal-900">EGP ${n.toLocaleString()}</p>
    </div>`).join('')}</div>`,
  }[tab];

  return `<div class="space-y-3">
    <div class="flex items-center gap-2">
      <button onclick="state.empView='directory';_empSelectedId=null;renderAll()" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>Employees</button>
      <span class="text-charcoal-300">/</span>
      <p class="text-xs text-charcoal-500">${e.name}</p>
    </div>

    <!-- Profile Header -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-semibold">${e.initials}</div>
          <div>
            <p class="text-base font-bold text-charcoal-900">${e.name} ${statusBadge(e.status)}</p>
            <p class="text-xs text-charcoal-500">${e.position} · ${e.level} · ${e.gym} · ${formatDate(e.hireDate)}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${lifecycleActions?`<div class="flex flex-wrap gap-1.5">${lifecycleActions}</div>`:`<p class="text-[10px] text-charcoal-400">No lifecycle actions granted for your role.</p>`}
        </div>
      </div>
      <div class="flex mt-3 border-b border-charcoal-100 overflow-x-auto">
        ${tabs.map(t=>`<button onclick="state.empTab='${t.id}';renderAll()" class="tab-btn ${state.empTab===t.id?'active':''}">${t.label}</button>`).join('')}
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 p-4">${tabContent}</div>
  </div>`;
}

function openChangeRole(id) {
  const e = MOCK.employees.find(x=>x.id===id);
  if(!e) return;
  const cbs = (v,l)=>`<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked class="rounded" onchange="this.closest('label').classList.toggle('opacity-40')"><span class="text-xs text-charcoal-700">${l}</span></label>`;
  openModal(`Change System Role — ${e.name}`, `<div class="space-y-3">
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      <p class="text-xs text-yellow-800">This grants or revokes system roles (e.g. Branch Manager). This is a high-trust governance action typically reserved for HR Manager.</p>
    </div>
    <div><label class="form-label">System Role</label><select class="form-select"><option value="">None (Employee)</option><option>Branch Manager</option><option>Team Leader</option></select></div>
    <div><p class="form-label">Permissions to toggle</p>
      <div class="grid grid-cols-1 gap-1.5">
        ${cbs('e','Can view team attendance')}
        ${cbs('e','Can approve team requests')}
        ${cbs('e','Can manage team schedule')}
        ${cbs('e','Can evaluate team members')}
      </div>
    </div>
  </div>`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="showToast(\'Role updated for '+e.name+'\');closeModal();" class="btn btn-sm btn-primary">Save Changes</button>' });
}

function openAddEmployee() {
  openModal('Add Employee', `<form onsubmit="event.preventDefault();submitAddEmployee();" class="space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">First Name *</label><input id="add-emp-fn" class="form-input" placeholder="e.g. Youssef" required></div>
      <div><label class="form-label">Last Name *</label><input id="add-emp-ln" class="form-input" placeholder="e.g. Essam" required></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Email *</label><input id="add-emp-email" type="email" class="form-input" placeholder="youssef@revive.com" required></div>
      <div><label class="form-label">Phone *</label><input id="add-emp-phone" class="form-input" placeholder="+20 1XX XXX XXXX" required></div>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div><label class="form-label">Position</label><select id="add-emp-pos" class="form-select"><option>Trainer</option><option>Receptionist</option><option>Cleaner</option><option>Maintenance</option><option>Branch Manager</option></select></div>
      <div><label class="form-label">Level</label><select id="add-emp-lvl" class="form-select"><option>Junior</option><option>Mid</option><option>Senior</option><option>Manager</option></select></div>
      <div><label class="form-label">Gross Salary (EGP)</label><input id="add-emp-sal" type="number" class="form-input" value="9500"></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Gym *</label><select id="add-emp-gym" class="form-select"><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select></div>
      <div><label class="form-label">Start Date *</label><input id="add-emp-date" type="date" class="form-input" value="2026-10-01" required></div>
    </div>
    <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Create Employee Record ✓</button>
    </div>
  </form>`, { wide:true });
}

function submitAddEmployee() {
  const fn = document.getElementById('add-emp-fn')?.value.trim();
  const ln = document.getElementById('add-emp-ln')?.value.trim();
  const email = document.getElementById('add-emp-email')?.value.trim();
  const phone = document.getElementById('add-emp-phone')?.value.trim();
  const pos = document.getElementById('add-emp-pos')?.value;
  const lvl = document.getElementById('add-emp-lvl')?.value;
  const gym = document.getElementById('add-emp-gym')?.value;
  const hireDate = document.getElementById('add-emp-date')?.value || new Date().toISOString().slice(0, 10);
  const salary = parseFloat(document.getElementById('add-emp-sal')?.value) || 9000;

  if (!fn || !ln || !email) {
    showToast('Name and email are required', 'error');
    return;
  }

  const fullName = `${fn} ${ln}`;
  const initials = `${fn[0]}${ln[0]}`.toUpperCase();
  const newId = 'RV-00' + (140 + MOCK.employees.length);

  const newEmp = {
    id: newId,
    name: fullName,
    position: pos,
    level: lvl,
    gym: gym,
    status: 'Active',
    initials: initials,
    hireDate: hireDate,
    salary: salary,
    phone: phone,
    email: email
  };

  MOCK.employees.push(newEmp);
  if (MOCK.dashboardStats) MOCK.dashboardStats.totalEmployees++;

  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Employee Created',
    user: MOCK.currentUser.fullName,
    target: fullName,
    detail: `New staff member onboarded as ${lvl} ${pos} at ${gym}`,
    timestamp: '2026-09-09',
    gym: gym
  });

  closeModal();
  showToast(`Employee ${fullName} created (${newId})`);
  state.empView = 'directory';
  renderAll();
}
