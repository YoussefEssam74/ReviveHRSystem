// ==================== EMPLOYEES DIRECTORY ====================
let _empFilter = { gym: 'all', status: 'all', search: '' };
let _empSelectedId = null;

// Termination flow: BM request → HR approves & schedules the exit interview →
// HR completes the exit interview form (ratings) → exit steps, verdict and
// settlement run in progress → completed/archived.
const _sepStages = ['Requested', 'Exit Interview', 'Exit In Progress', 'Completed'];
const _sepStageColors = { 'Requested': '#7c3aed', 'Exit Interview': '#2563eb', 'Exit In Progress': '#d97706', 'Completed': '#16a34a' };

// ---- Terminations page state + helpers -------------------------------------
let _sepGym = 'all';
let _sepPageTab = 'requests';   // requests | interview | progress | completed
let _sepModalId = null;
const _gymColors = { 'Nasr City': '#2563eb', 'Heliopolis': '#7c3aed', '6th October': '#d97706' };
const _annualEntitlement = 21; // days per year → accrued monthly

const _sepPageTabs = [
  { id: 'requests', label: 'Requests' },
  { id: 'interview', label: 'Exit interview' },
  { id: 'progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
];

function setSepGym(g) { _sepGym = g; renderAll(); }
function setSepPageTab(t) { _sepPageTab = t; renderAll(); }

function _sepStatusKey(s) {
  // Older records may still carry the previous offboarding statuses.
  if (s.status === 'Notice Period' || s.status === 'Under Review') return 'Exit In Progress';
  return s.status;
}
function _sepInterview(s) {
  return s.exitInterview || { decision: 'Pending', scheduledFor: '', time: '', interviewer: '', note: '', conductedOn: '', rating: null, performanceRating: null, feedback: '' };
}
function _sepAttr(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function _sepInTab(s, tab) {
  const st = _sepStatusKey(s);
  if (tab === 'requests') return st === 'Requested';
  if (tab === 'interview') return st === 'Exit Interview';
  if (tab === 'progress') return st === 'Exit In Progress';
  if (tab === 'completed') return st === 'Completed';
  return true;
}
function _sepStatusPill(status) {
  const c = _sepStageColors[status] || '#94a3b8';
  return `<span class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap" style="background:${c}1a;color:${c};border:1px solid ${c}33"><span class="w-1.5 h-1.5 rounded-full" style="background:${c}"></span>${status}</span>`;
}
function _sepStars(n) {
  if (!n) return '<span class="text-charcoal-300 text-[10px]">—</span>';
  return `<span class="text-amber-500 text-[11px] tracking-tight">${'★'.repeat(n)}<span class="text-charcoal-200">${'★'.repeat(5 - n)}</span></span> <span class="text-[9px] text-charcoal-400">${n}/5</span>`;
}
function _sepRatingInput(name, value) {
  return `<div class="flex items-center gap-1">${[1, 2, 3, 4, 5].map(n => `
    <label class="cursor-pointer">
      <input type="radio" name="${name}" value="${n}" class="peer sr-only" ${Number(value) === n ? 'checked' : ''}>
      <span class="w-7 h-7 flex items-center justify-center rounded-md border border-charcoal-200 bg-white text-[10px] font-bold text-charcoal-500 peer-checked:bg-amber-50 peer-checked:border-amber-400 peer-checked:text-amber-700 transition-colors">${n}</span>
    </label>`).join('')}</div>`;
}

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
  // HR preset: no direct lifecycle perms, but employees.request_action renders the same
  // buttons as "Request [Action]" → creates an EmployeeActionRequest for the HR Manager.
  const canRequestAction = showAll || hasPermission('employees.request_action');

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
  // Candidates blocked from hiring (block action lives in Candidates, managed here)
  const blockedList = (typeof MOCK.candidates !== 'undefined') ? MOCK.candidates.filter(c=>c.blocked) : [];

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
        ${canBulk?`<button onclick="openBulkImport()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Bulk Import</button>`
          :(canRequestAction?`<button onclick="openActionRequest('BulkImport')" class="btn btn-sm btn-secondary" title="Bulk imports are executed by an HR Manager — raise a request instead."><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Request Bulk Import</button>`:'')}
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

    <!-- Blocked from hiring (candidates blocked by HR) -->
    <div class="bg-white rounded-lg border ${blockedList.length?'border-l-4 border-l-red-400':'border-charcoal-200'} overflow-hidden flex-shrink-0">
      <div class="px-3 py-1.5 border-b border-charcoal-100 flex items-center justify-between gap-2 bg-charcoal-50/50">
        <p class="bento-label text-charcoal-500">BLOCKED FROM HIRING${blockedList.length?` (${blockedList.length})`:''}</p>
        <span class="text-[9px] text-charcoal-400">Blocked by HR · Restore re-opens hiring</span>
      </div>
      <div class="divide-y divide-charcoal-50 max-h-[150px] overflow-y-auto">
        ${blockedList.length ? blockedList.map(c=>`
        <div class="px-3 py-2 flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${(c.name||'').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div>
            <div class="min-w-0">
              <p class="text-xs font-medium text-charcoal-900">${c.name} <span class="text-[9px] text-charcoal-400 font-normal">· ${c.position}</span></p>
              <p class="text-[9px] text-charcoal-400">${c.blockReason || 'Blocked manually by HR'}${c.stage?` · was ${c.stage}`:''}</p>
            </div>
          </div>
          <div class="flex gap-1.5 flex-shrink-0">
            <button onclick="openCandidateDetail('${c.id}')" class="btn btn-sm btn-ghost text-[10px]">Profile</button>
            <button onclick="_setCandidateBlock('${c.id}', false)" class="btn btn-sm btn-success text-[10px]">Restore</button>
          </div>
        </div>`).join('') : `<div class="px-3 py-3 text-center text-[11px] text-charcoal-400">Nobody is blocked right now. Use <b>Block</b> on a candidate's row in Candidates to prevent re-applications.</div>`}
      </div>
    </div>

    <!-- Subtle Lifecycle Bar (clean, compact single line) -->
    <div class="flex items-center justify-between text-[10px] text-charcoal-400 px-1 py-0.5 flex-shrink-0">
      <span>Lifecycle: ${[
        canTransfer?'Transfer Gym':canRequestAction?'Request Transfer':null,
        canCompensate?'Compensation':canRequestAction?'Request Compensation':null,
        canOffboard?'Offboard':canRequestAction?'Request Offboard':null,
        canRole?'Role Assignment':canRequestAction?'Request Role':null,
      ].filter(Boolean).join(' · ') || 'View only'}</span>
      <span class="text-charcoal-500">${list.length} records displayed</span>
    </div>
  </div>`;
}

// ==================== TERMINATIONS (BM → HR EXIT FILE) ====================
function renderTerminations() {
  const showAll = DEMO.showAll;
  const canOffboard = showAll || hasPermission('employees.offboard');
  const canRequestAction = showAll || hasPermission('employees.request_action');
  const all = MOCK.separations.filter(s => s.status !== 'Declined');
  const scoped = _sepGym === 'all' ? all : all.filter(s => s.gym === _sepGym);
  const counts = {};
  _sepPageTabs.forEach(t => { counts[t.id] = scoped.filter(s => _sepInTab(s, t.id)).length; });
  const rows = scoped.filter(s => _sepInTab(s, _sepPageTab))
    .slice()
    .sort((a, b) => String(a.lastDay).localeCompare(String(b.lastDay)));
  const tabLabel = (_sepPageTabs.find(t => t.id === _sepPageTab) || {}).label || 'Requests';

  return `<div class="flex flex-col h-full min-h-0 gap-2">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
      <div>
        <h1 class="text-sm font-bold text-charcoal-900 leading-tight">Terminations</h1>
        <p class="text-[10px] text-charcoal-500">${counts.requests} request${counts.requests === 1 ? '' : 's'} awaiting you · ${counts.interview} exit interview${counts.interview === 1 ? '' : 's'} · ${counts.progress} in progress${_sepGym === 'all' ? '' : ' · ' + _sepGym}</p>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button onclick="openRequestTermination()" class="btn btn-sm btn-danger-outline" title="Branch Manager submits who needs to leave">+ Request Termination (BM)</button>
        ${canOffboard ? `<button onclick="openInitiateOffboarding()" class="btn btn-sm btn-primary">+ Initiate Offboarding</button>`
          : (canRequestAction ? `<button onclick="openActionRequest('Offboard')" class="btn btn-sm btn-danger-outline" title="Offboarding is executed by an HR Manager — raise a request instead.">+ Request Offboard</button>` : '')}
      </div>
    </div>

    <div class="bg-white rounded-lg border border-charcoal-200 px-2 py-1.5 flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
      <div class="flex items-center gap-1 bg-charcoal-100 rounded-lg p-0.5 flex-wrap">
        ${_sepPageTabs.map(t => `<button onclick="setSepPageTab('${t.id}')" class="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${_sepPageTab === t.id ? 'bg-white shadow-sm text-charcoal-900 font-bold' : 'text-charcoal-500 hover:text-charcoal-700'}">${t.label}${counts[t.id] ? ` <span class="badge ${_sepPageTab === t.id ? 'badge-brand' : 'badge-gray'} text-[9px]">${counts[t.id]}</span>` : ''}</button>`).join('')}
      </div>
      <div class="flex items-center gap-1 flex-wrap">
        ${['all', 'Nasr City', 'Heliopolis', '6th October'].map(g => `<button onclick="setSepGym('${g}')" class="px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${_sepGym === g ? 'bg-charcoal-900 text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100'}">${g === 'all' ? 'All gyms' : g}</button>`).join('')}
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden flex flex-col flex-1 min-h-0">
      <div class="px-3 py-2 border-b border-charcoal-150 bg-charcoal-50/60 flex items-center justify-between gap-2 flex-shrink-0">
        <div class="min-w-0">
          <p class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">${tabLabel} <span class="text-charcoal-400 font-semibold">· ${rows.length}</span></p>
          <p class="text-[10px] text-charcoal-400 truncate">${_sepPageTab === 'requests' ? 'Approve the BM request and schedule the exit interview.'
            : _sepPageTab === 'interview' ? 'Run the exit interview, complete the form and rate the employee.'
            : _sepPageTab === 'progress' ? 'Exit steps, verdict, salary data, pending requests and the annual-leave settlement.'
            : 'Archived exits with the final verdict and settlement.'}</p>
        </div>
        <span class="badge badge-gray text-[9px] flex-shrink-0">${_sepGym === 'all' ? 'All branches' : _sepGym}</span>
      </div>
      <div class="flex-1 min-h-0 overflow-auto">
        <table class="data-table" style="min-width:${_sepPageTab === 'progress' ? 1000 : _sepPageTab === 'completed' ? 980 : 880}px">
          <thead class="sticky top-0 z-10 bg-[#f9f9ff]">${_sepTableHead(_sepPageTab)}</thead>
          <tbody>
            ${rows.length ? rows.map(s => _sepRow(s, _sepPageTab, canOffboard)).join('')
              : `<tr><td colspan="${_sepCols(_sepPageTab)}"><div class="py-10 text-center"><svg class="w-8 h-8 mx-auto mb-2 text-charcoal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p class="text-xs text-charcoal-500">Nothing in ${tabLabel}${_sepGym === 'all' ? '' : ' for ' + _sepGym}.</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 px-3 py-2 flex-shrink-0">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-1.5 flex-wrap">
          <p class="text-[9px] font-bold uppercase tracking-wide text-charcoal-400 mr-1">Exit process</p>
          ${['Request approved', 'Exit interview', 'Exit steps & verdict', 'Completed'].map((st, i) => `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-4 h-4 rounded-full bg-charcoal-100 text-charcoal-500 text-[8px] font-bold flex items-center justify-center">${i + 1}</span>
              <span class="text-[10px] text-charcoal-600 font-medium">${st}</span>
              ${i < 3 ? `<svg class="w-3 h-3 text-charcoal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>` : ''}
            </span>`).join('')}
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[9px] text-charcoal-400">Leave beyond the accrual → <b class="text-red-600">absent</b></span>
          <span class="text-charcoal-200">|</span>
          <button onclick="navigateTo('employees')" class="text-[9px] font-semibold text-brand-600 hover:text-brand-800">Employee directory →</button>
        </div>
      </div>
    </div>
  </div>`;
}

function _sepCols(tab) {
  return tab === 'progress' || tab === 'completed' ? 7 : 6;
}

function _sepTableHead(tab) {
  const base = '<th>Employee</th><th>Gym</th>';
  if (tab === 'requests') return `<tr>${base}<th>Requested by</th><th>Reason</th><th>Last day</th><th class="text-right">Actions</th></tr>`;
  if (tab === 'interview') return `<tr>${base}<th>Interview slot</th><th>Interviewer</th><th>Rating</th><th class="text-right">Actions</th></tr>`;
  if (tab === 'progress') return `<tr>${base}<th>Exit steps</th><th>Verdict</th><th>Salary · net</th><th>Leave balance</th><th class="text-right">Actions</th></tr>`;
  return `<tr>${base}<th>Completed</th><th>Verdict</th><th>Settlement</th><th>Rehire</th><th class="text-right">Actions</th></tr>`;
}

function _sepEmployeeCell(s) {
  const initials = s.employee.split(' ').map(w => w[0]).join('');
  return `<td><div class="flex items-center gap-2">
    <div class="w-7 h-7 rounded-full bg-red-50 border border-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">${initials}</div>
    <div class="min-w-0">
      <p class="text-xs font-semibold text-charcoal-900 truncate">${s.employee}</p>
      <p class="text-[9px] text-charcoal-400 truncate">${s.position}</p>
    </div>
  </div></td>`;
}

function _sepRow(s, tab, canOffboard) {
  const daysLeft = _noticeDaysLeft(s.lastDay);
  const ei = _sepInterview(s);
  const canDecide = canOffboard || s.requestedBy === 'Branch Manager';
  const open = `openSeparation('${s.id}')`;

  if (tab === 'requests') {
    return `<tr class="cursor-pointer hover:bg-charcoal-50/60" onclick="${open}">
      ${_sepEmployeeCell(s)}
      <td>${_gymPill(s.gym)}</td>
      <td><p class="text-[10px] font-medium text-charcoal-800 truncate">${s.requestedByUser || 'Branch Manager'}${s.requestedBy === 'Branch Manager' ? ' (BM)' : ''}</p><p class="text-[9px] text-charcoal-400">${s.submittedDate || '—'}</p></td>
      <td style="max-width:230px"><p class="text-[10px] text-charcoal-700 truncate" title="${_sepAttr(s.reason)}">${s.reason}</p></td>
      <td><p class="text-[10px] font-semibold text-charcoal-800 whitespace-nowrap">${formatDate(s.lastDay)}</p><p class="text-[9px] whitespace-nowrap ${daysLeft !== null && daysLeft <= 7 ? 'text-red-600 font-semibold' : 'text-charcoal-400'}">${daysLeft === null ? '—' : daysLeft + ' days left'}</p></td>
      <td class="text-right whitespace-nowrap">
        ${canDecide ? `<button onclick="event.stopPropagation();${open}" class="btn btn-sm btn-primary text-[10px] h-7 px-2">Approve & schedule</button>
        <button onclick="event.stopPropagation();declineSeparationRequest('${s.id}')" class="btn btn-sm btn-secondary text-[10px] h-7 px-2 ml-1">Decline</button>` : `<button onclick="event.stopPropagation();${open}" class="btn btn-sm btn-secondary text-[10px] h-7 px-2">Review</button>`}
      </td>
    </tr>`;
  }

  if (tab === 'interview') {
    return `<tr class="cursor-pointer hover:bg-charcoal-50/60" onclick="${open}">
      ${_sepEmployeeCell(s)}
      <td>${_gymPill(s.gym)}</td>
      <td><p class="text-[10px] font-semibold text-charcoal-800 whitespace-nowrap">${ei.scheduledFor ? formatDate(ei.scheduledFor) : 'Not scheduled'}</p><p class="text-[9px] text-charcoal-400">${ei.time || '—'}</p></td>
      <td class="text-[10px] text-charcoal-700">${ei.interviewer || '—'}</td>
      <td>${ei.decision === 'Completed' ? _sepStars(ei.rating) : '<span class="badge badge-yellow text-[9px]">Not rated</span>'}</td>
      <td class="text-right whitespace-nowrap"><button onclick="event.stopPropagation();${open}" class="btn btn-sm btn-primary text-[10px] h-7 px-2">Open interview form</button></td>
    </tr>`;
  }

  if (tab === 'progress') {
    const done = s.checklist.filter(c => c[1]).length;
    const pay = (MOCK.payrollItems || []).find(p => p.name === s.employee);
    const ls = _leaveSettlement(s);
    return `<tr class="cursor-pointer hover:bg-charcoal-50/60" onclick="${open}">
      ${_sepEmployeeCell(s)}
      <td>${_gymPill(s.gym)}</td>
      <td>
        <div class="flex items-center gap-1.5 min-w-[92px]">
          <div class="flex-1 h-1.5 bg-charcoal-100 rounded-full overflow-hidden"><div class="h-full rounded-full bg-amber-500" style="width:${s.progress}%"></div></div>
          <span class="text-[9px] text-charcoal-500 whitespace-nowrap">${done}/${s.checklist.length}</span>
        </div>
      </td>
      <td>${s.verdict ? '<span class="badge badge-green text-[9px]">Recorded</span>' : '<span class="badge badge-yellow text-[9px]">Required</span>'}</td>
      <td><p class="text-[10px] font-semibold text-charcoal-800 whitespace-nowrap">${pay ? pay.net.toLocaleString() + ' EGP' : '—'}</p><p class="text-[9px] text-charcoal-400">${pay ? 'net · ' + pay.status : 'no payroll'}</p></td>
      <td>${ls.balance >= 0 ? `<span class="badge badge-green text-[9px] whitespace-nowrap">+${ls.balance}d payout</span>` : `<span class="badge badge-red text-[9px] whitespace-nowrap">${Math.abs(ls.balance)}d absent</span>`}</td>
      <td class="text-right whitespace-nowrap"><button onclick="event.stopPropagation();${open}" class="btn btn-sm btn-primary text-[10px] h-7 px-2">Open exit file</button></td>
    </tr>`;
  }

  const settle = s.verdict ? (s.verdict.settlement || null) : null;
  const settleTxt = !settle ? '—' : settle.direction === 'owedToEmployee' ? `Pay ${settle.amount} EGP` : settle.direction === 'employeeOwes' ? `Owes ${settle.amount} EGP` : 'No balance';
  const rehire = s.verdict && s.verdict.rehire ? s.verdict.rehire.status : '—';
  return `<tr class="cursor-pointer hover:bg-charcoal-50/60" onclick="${open}">
    ${_sepEmployeeCell(s)}
    <td>${_gymPill(s.gym)}</td>
    <td><p class="text-[10px] font-semibold text-charcoal-800 whitespace-nowrap">${s.completedOn ? formatDate(s.completedOn) : formatDate(s.lastDay)}</p><p class="text-[9px] text-green-600">Archived</p></td>
    <td><div class="flex flex-wrap gap-1">${_sepVerdictChips(s) || '<span class="text-[10px] text-charcoal-400">—</span>'}</div></td>
    <td class="text-[10px] text-charcoal-700 whitespace-nowrap">${settleTxt}</td>
    <td>${rehire === 'Banned' ? '<span class="badge badge-red text-[9px]">Banned</span>' : rehire === 'Eligible' ? '<span class="badge badge-green text-[9px]">Eligible</span>' : '<span class="text-[10px] text-charcoal-400">—</span>'}</td>
    <td class="text-right whitespace-nowrap"><button onclick="event.stopPropagation();${open}" class="btn btn-sm btn-secondary text-[10px] h-7 px-2">View file</button></td>
  </tr>`;
}

// ---- Step 1: approve the BM request and schedule the exit interview --------
function approveSeparationRequest(id) {
  const s = MOCK.separations.find(x => x.id === id); if (!s || _sepStatusKey(s) !== 'Requested') return;
  const date = document.getElementById('sep-sched-date')?.value || '';
  const time = document.getElementById('sep-sched-time')?.value || '';
  const interviewer = (document.getElementById('sep-sched-interviewer')?.value || '').trim();
  if (!date) { showToast('Pick an exit-interview date first', 'error'); return; }
  s.status = 'Exit Interview';
  s.exitInterview = { ..._sepInterview(s), decision: 'Scheduled', scheduledFor: date, time, interviewer, note: '' };
  const emp = MOCK.employees.find(e => e.name === s.employee);
  if (emp && emp.status === 'Active') emp.status = 'Notice Period';
  MOCK.auditLog.unshift({ id: 'al-' + Date.now(), action: 'Termination Request Approved', user: MOCK.currentUser.fullName, target: s.employee, detail: `Request approved — exit interview scheduled ${date}${time ? ' ' + time : ''} with ${interviewer || 'HR'}`, timestamp: '2026-09-09', gym: s.gym });
  showToast(`Exit interview scheduled for ${s.employee}`);
  openSeparation(id);
  renderAll();
}

function declineSeparationRequest(id) {
  const s = MOCK.separations.find(x => x.id === id); if (!s) return;
  openModal('Decline termination request', `
    <div class="space-y-3">
      <div class="bg-charcoal-50 border border-charcoal-150 rounded-xl p-3">
        <p class="text-xs font-bold text-charcoal-900">${s.employee} <span class="text-[10px] text-charcoal-400 font-normal">· ${s.position}</span></p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${s.gym} · requested by ${s.requestedByUser || 'Branch Manager'} · last day ${formatDate(s.lastDay)}</p>
        <p class="text-[10px] text-charcoal-600 mt-1">Reason given: ${s.reason}</p>
      </div>
      <div class="bg-red-50 border border-red-100 rounded-lg p-2.5 text-[10px] text-red-700 leading-relaxed">
        Declining closes this request and returns it to the Branch Manager with your note. The employee record is not changed.
      </div>
      <div><label class="form-label">Reason for declining *</label>
        <textarea id="sep-decline-reason" class="form-input" rows="2" placeholder="e.g. not enough evidence, employee agreed a transfer instead..."></textarea>
      </div>
    </div>`,
    { footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="confirmDeclineSeparation('${s.id}')" class="btn btn-sm btn-danger">Decline request</button>` });
}

function confirmDeclineSeparation(id) {
  const s = MOCK.separations.find(x => x.id === id); if (!s) return;
  const reason = (document.getElementById('sep-decline-reason')?.value || '').trim();
  if (!reason) { showToast('Add a reason for the Branch Manager', 'error'); return; }
  s.status = 'Declined';
  s.declinedReason = reason;
  MOCK.auditLog.unshift({ id: 'al-' + Date.now(), action: 'Termination Request Declined', user: MOCK.currentUser.fullName, target: s.employee, detail: `BM termination request declined — ${reason}`, timestamp: '2026-09-09', gym: s.gym });
  closeModal();
  showToast(`Request for ${s.employee} declined`);
  renderAll();
}

// ---- Step 2: complete the exit interview form + ratings --------------------
function saveExitInterviewForm(id) {
  const s = MOCK.separations.find(x => x.id === id); if (!s) return;
  if (!(DEMO.showAll || hasPermission('employees.offboard') || s.requestedBy === 'Branch Manager')) {
    showToast('Requires employees.offboard permission', 'error'); return;
  }
  const ei = _sepInterview(s);
  const conductedOn = document.getElementById('sep-ei-date')?.value || '';
  const interviewer = (document.getElementById('sep-ei-interviewer')?.value || '').trim();
  const rating = Number(document.querySelector('input[name="sep-ei-rating"]:checked')?.value || 0);
  const performanceRating = Number(document.querySelector('input[name="sep-ei-perf"]:checked')?.value || 0);
  const feedback = (document.getElementById('sep-ei-feedback')?.value || '').trim();
  if (!conductedOn) { showToast('Pick the date the interview was conducted', 'error'); return; }
  if (!rating) { showToast('Rate the exit interview (1–5)', 'error'); return; }
  s.exitInterview = { ...ei, decision: 'Completed', conductedOn, interviewer, rating, performanceRating: performanceRating || null, feedback };
  s.status = 'Exit In Progress';
  s.checklist[0][1] = true;
  s.progress = Math.round((s.checklist.filter(c => c[1]).length / s.checklist.length) * 100);
  MOCK.auditLog.unshift({ id: 'al-' + Date.now(), action: 'Exit Interview Completed', user: MOCK.currentUser.fullName, target: s.employee, detail: `Exit interview rated ${rating}/5 · performance ${performanceRating || '—'}/5${feedback ? ' · ' + feedback : ''}`, timestamp: '2026-09-09', gym: s.gym });
  showToast(`Exit interview completed for ${s.employee}`);
  openSeparation(id);
  renderAll();
}

// ---- Exit file modal ------------------------------------------------------
function openSeparation(id) {
  const s = MOCK.separations.find(x => x.id === id); if (!s) return;
  _sepModalId = id;
  // BM→HR handoff cases are NOT gated by employees.offboard — HR completes the
  // exit file for terminations the Branch Manager initiated.
  const canOffboard = DEMO.showAll || hasPermission('employees.offboard') || s.requestedBy === 'Branch Manager';
  const st = _sepStatusKey(s);
  const daysLeft = _noticeDaysLeft(s.lastDay);
  const initials = s.employee.split(' ').map(w => w[0]).join('');

  const header = `<div class="flex items-center justify-between gap-3 rounded-xl border border-charcoal-200 bg-gradient-to-r from-charcoal-50 via-white to-white p-3">
    <div class="flex items-center gap-2.5 min-w-0">
      <div class="w-10 h-10 rounded-full bg-red-50 border border-red-100 text-red-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">${initials}</div>
      <div class="min-w-0">
        <p class="text-sm font-bold text-charcoal-900 truncate">${s.employee}</p>
        <p class="text-[10px] text-charcoal-500 truncate">${s.position} · ${s.gym}</p>
        <div class="flex items-center gap-1 mt-1 flex-wrap">${_sepStatusPill(st)}</div>
      </div>
    </div>
    <div class="text-right flex-shrink-0">
      <p class="text-[9px] font-semibold uppercase tracking-wide text-charcoal-400">Last working day</p>
      <p class="text-xs font-bold text-charcoal-900">${formatDate(s.lastDay)}</p>
      <p class="text-[10px] ${daysLeft !== null && daysLeft <= 7 && st !== 'Completed' ? 'text-red-600 font-semibold' : 'text-charcoal-500'}">${st === 'Completed' ? 'Archived' : daysLeft === null ? '—' : daysLeft === 0 ? 'Last day today' : daysLeft + ' days left'}</p>
    </div>
  </div>`;

  openModal(`Exit file — ${s.employee}`, `${header}${_sepFileHTML(s, canOffboard)}`, { full: true, footer: '<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}

function _sepFileHTML(s, canOffboard) {
  const st = _sepStatusKey(s);
  const blocks = [];
  if (st === 'Requested') blocks.push(_sepRequestDecisionHTML(s, canOffboard));
  if (st === 'Exit Interview') blocks.push(_sepInterviewFormHTML(s, canOffboard));
  if (st === 'Exit In Progress' || st === 'Completed') blocks.push(_sepInterviewSummaryHTML(s));
  if (st === 'Exit In Progress') {
    blocks.push(_sepChecklistHTML(s, canOffboard));
    blocks.push(_sepVerdictHTML(s, canOffboard));
  }
  if (st === 'Completed') blocks.push(_sepCompletedHTML(s));
  blocks.push(_sepSalaryHTML(s));
  blocks.push(_sepRequestsHTML(s));
  blocks.push(_sepLeaveHTML(s));
  if (st === 'Exit In Progress' || st === 'Completed') {
    blocks.push(`<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">${_sepHistoryHTML(s)}${_sepAttendanceHTML(s)}</div>`);
  }
  const finalize = (st === 'Exit In Progress' && canOffboard) ? _sepFinalizeHTML(s) : '';
  return `<div class="space-y-2.5 mt-2.5">${blocks.join('')}${finalize}</div>`;
}

function _sepRequestDecisionHTML(s, canOffboard) {
  const defDate = new Date(MOCK_TODAY.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  return `<div class="rounded-xl border border-purple-200 bg-purple-50/40 p-3">
    <div class="flex items-start justify-between gap-2 flex-wrap">
      <div class="min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-wide text-purple-700">Step 1 — BM termination request</p>
        <p class="text-[11px] text-charcoal-700 mt-0.5"><b>${s.requestedByUser || 'Branch Manager'}</b> asked to end the contract on <b>${formatDate(s.lastDay)}</b>.</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Reason: ${s.reason}</p>
      </div>
      <span class="badge badge-purple text-[9px] flex-shrink-0">Needs your decision</span>
    </div>
    ${canOffboard ? `
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3">
      <div><label class="form-label">Interview date *</label><input id="sep-sched-date" type="date" class="form-input" value="${defDate}"></div>
      <div><label class="form-label">Time</label><input id="sep-sched-time" type="time" class="form-input" value="11:00"></div>
      <div class="sm:col-span-2"><label class="form-label">Interviewer</label><input id="sep-sched-interviewer" class="form-input" value="${_sepAttr(MOCK.currentUser.fullName)}"></div>
    </div>
    <div class="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
      <button onclick="declineSeparationRequest('${s.id}')" class="btn btn-sm btn-secondary text-charcoal-500 hover:text-red-600">Decline request</button>
      <button onclick="approveSeparationRequest('${s.id}')" class="btn btn-sm btn-primary">Approve & schedule exit interview</button>
    </div>` : `<p class="text-[10px] text-charcoal-400 mt-2">Requires <code>employees.offboard</code> to decide this request.</p>`}
  </div>`;
}

function _sepInterviewFormHTML(s, canOffboard) {
  const ei = _sepInterview(s);
  const conducted = ei.conductedOn || ei.scheduledFor || '';
  return `<div class="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
    <div class="flex items-start justify-between gap-2 flex-wrap">
      <div class="min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-wide text-blue-700">Step 2 — Exit interview form</p>
        <p class="text-[10px] text-charcoal-500">${ei.scheduledFor ? `Scheduled ${formatDate(ei.scheduledFor)}${ei.time ? ' · ' + ei.time : ''}` : 'Not scheduled yet'} · interviewer ${ei.interviewer || '—'}</p>
      </div>
      <span class="badge badge-blue text-[9px] flex-shrink-0">Awaiting interview</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2.5">
      <div><label class="form-label">Conducted on</label><input id="sep-ei-date" type="date" class="form-input" value="${conducted}" ${canOffboard ? '' : 'disabled'}></div>
      <div class="sm:col-span-2"><label class="form-label">Interviewer</label><input id="sep-ei-interviewer" class="form-input" value="${_sepAttr(ei.interviewer || MOCK.currentUser.fullName)}" ${canOffboard ? '' : 'disabled'}></div>
      <div><label class="form-label">Interview rating</label>${_sepRatingInput('sep-ei-rating', ei.rating)}</div>
      <div><label class="form-label">Employee performance rating</label>${_sepRatingInput('sep-ei-perf', ei.performanceRating)}</div>
    </div>
    <div class="mt-2"><label class="form-label">Feedback — why they are leaving, what to improve</label>
      <textarea id="sep-ei-feedback" class="form-input" rows="3" ${canOffboard ? '' : 'disabled'} placeholder="Exit interview notes...">${ei.feedback || ''}</textarea>
    </div>
    ${canOffboard ? `<div class="flex justify-end mt-2"><button onclick="saveExitInterviewForm('${s.id}')" class="btn btn-sm btn-primary">Complete exit interview</button></div>` : ''}
  </div>`;
}

function _sepInterviewSummaryHTML(s) {
  const ei = _sepInterview(s);
  if (ei.decision === 'Waived') {
    return `<div class="rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700">Exit interview — waived</p>
        <span class="badge badge-gray text-[9px]">No interview</span>
      </div>
      <p class="text-[10px] text-charcoal-500 mt-1">${ei.note || 'No exit interview was conducted.'}</p>
    </div>`;
  }
  return `<div class="rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700">Exit interview — completed</p>
      <div class="flex items-center gap-2 text-[10px] flex-wrap">
        <span class="text-charcoal-500">Interview ${_sepStars(ei.rating)}</span>
        <span class="text-charcoal-200">|</span>
        <span class="text-charcoal-500">Performance ${_sepStars(ei.performanceRating)}</span>
      </div>
    </div>
    <p class="text-[10px] text-charcoal-500 mt-1">${ei.conductedOn ? 'Conducted ' + formatDate(ei.conductedOn) : ''}${ei.interviewer ? (ei.conductedOn ? ' · ' : '') + ei.interviewer : ''}</p>
    ${ei.feedback ? `<p class="text-[11px] text-charcoal-700 mt-1.5">${ei.feedback}</p>` : ''}
  </div>`;
}

function _sepChecklistHTML(s, canOffboard) {
  const doneCount = s.checklist.filter(c => c[1]).length;
  const allDone = doneCount === s.checklist.length;
  return `<div class="rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700">Exit steps</p>
      <span class="text-[10px] font-bold ${allDone ? 'text-green-600' : 'text-brand-600'}">${doneCount}/${s.checklist.length} · ${s.progress}%</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
      ${s.checklist.map((c, i) => `<label class="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${c[1] ? 'border-green-200 bg-green-50/50' : 'border-charcoal-150 bg-charcoal-50/60 hover:border-brand-300'}">
        <span class="flex items-center gap-2 min-w-0">
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${c[1] ? 'bg-green-500 text-white' : 'bg-white border border-charcoal-300 text-transparent'}">✓</span>
          <span class="text-[11px] truncate ${c[1] ? 'line-through text-charcoal-400' : 'text-charcoal-800 font-medium'}">${c[0]}</span>
        </span>
        <input type="checkbox" ${c[1] ? 'checked' : ''} ${canOffboard ? '' : 'disabled'} class="rounded border-charcoal-300 text-brand-500 w-4 h-4 cursor-pointer" onchange="toggleSepChecklist('${s.id}', ${i}, this.checked)">
      </label>`).join('')}
    </div>
  </div>`;
}

function _sepVerdictHTML(s, canOffboard) {
  const v = s.verdict || null;
  const firstName = s.employee.split(' ')[0];
  if (!canOffboard) return v ? `<p class="text-[10px] text-charcoal-400">Exit verdict recorded by HR.</p>` : '';
  const settle = v ? (v.settlement || { direction: 'none', amount: 0, note: '' }) : { direction: 'none', amount: 0, note: '' };
  const rehire = v ? (v.rehire || { status: 'Eligible', note: '' }) : { status: 'Eligible', note: '' };
  return `<div class="rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-start justify-between gap-2 flex-wrap">
      <div>
        <p class="text-[10px] font-bold text-charcoal-900 uppercase tracking-wide">Exit verdict — HR record</p>
        <p class="text-[10px] text-charcoal-500">Why ${firstName} left, the final settlement direction, and rehire eligibility.</p>
      </div>
      ${v ? '<span class="badge badge-green text-[9px]">Recorded</span>' : '<span class="badge badge-yellow text-[9px]">Required before finalize</span>'}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
      <div class="sm:col-span-2"><label class="form-label">Why ${firstName} left</label><textarea id="sep-v-reason" class="form-input" rows="2">${v ? v.finalReason : ''}</textarea></div>
      <div><label class="form-label">Final settlement</label>
        <select id="sep-v-settle" class="form-select">
          <option value="none" ${settle.direction === 'none' ? 'selected' : ''}>No balance</option>
          <option value="owedToEmployee" ${settle.direction === 'owedToEmployee' ? 'selected' : ''}>Company owes employee — pay out</option>
          <option value="employeeOwes" ${settle.direction === 'employeeOwes' ? 'selected' : ''}>Employee owes company — deduct</option>
        </select>
      </div>
      <div><label class="form-label">Amount (EGP)</label><input id="sep-v-amount" type="number" class="form-input" value="${settle.amount}" min="0"></div>
      <div class="sm:col-span-2"><label class="form-label">Settlement note</label><input id="sep-v-settle-note" class="form-input" value="${_sepAttr(settle.note || '')}" placeholder="e.g. remaining days, deductions, reference..."></div>
      <div><label class="form-label">Rehire eligibility</label>
        <select id="sep-v-rehire" class="form-select">
          <option value="Eligible" ${rehire.status === 'Eligible' ? 'selected' : ''}>Eligible to return</option>
          <option value="Banned" ${rehire.status === 'Banned' ? 'selected' : ''}>Banned from rehire</option>
        </select>
      </div>
      <div><label class="form-label">Rehire note</label><input id="sep-v-rehire-note" class="form-input" value="${_sepAttr(rehire.note || '')}" placeholder="e.g. contract-role only..."></div>
    </div>
    <div class="flex justify-end mt-2.5"><button onclick="saveExitVerdict('${s.id}')" class="btn btn-sm btn-primary">${v ? 'Update' : 'Record'} exit verdict</button></div>
  </div>`;
}

function _sepCompletedHTML(s) {
  const v = s.verdict;
  if (!v) return `<div class="rounded-xl border border-green-200 bg-green-50/70 p-3 text-center text-xs font-semibold text-green-800">Separation finalized — employee records archived.</div>`;
  return `<div class="rounded-xl border border-green-200 bg-green-50/70 p-3">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <p class="text-[10px] font-bold uppercase tracking-wide text-green-800">Exit verdict — archived</p>
      <div class="flex flex-wrap gap-1">${_sepVerdictChips(s)}</div>
    </div>
    <p class="text-[11px] text-green-800 mt-1">${v.finalReason}</p>
    ${v.settlement && v.settlement.note ? `<p class="text-[10px] text-green-700 mt-0.5">Settlement: ${v.settlement.note}</p>` : ''}
    ${v.rehire && v.rehire.note ? `<p class="text-[10px] text-green-700 mt-0.5">Rehire: ${v.rehire.note}</p>` : ''}
  </div>`;
}

function _sepFinalizeHTML(s) {
  const allDone = s.checklist.every(c => c[1]);
  return `<div class="flex items-center justify-between gap-2 rounded-xl border border-charcoal-200 bg-charcoal-50/60 px-3 py-2">
    <span class="text-[10px] text-charcoal-500">${!allDone ? 'Complete the remaining exit steps to finalize.' : !s.verdict ? 'Record the exit verdict to finalize.' : 'All exit steps verified — finalize to archive the employee record.'}</span>
    <button onclick="finalizeSeparation('${s.id}')" class="btn btn-sm ${(allDone && s.verdict) ? 'btn-danger' : 'btn-disabled'}" ${(allDone && s.verdict) ? '' : 'disabled'}>Finalize separation ✓</button>
  </div>`;
}

function _sepSalaryHTML(s) {
  return `<div class="space-y-1.5">
    <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700 px-0.5">Salary data</p>
    ${_payStatementHTML(s)}
  </div>`;
}

function _sepHistoryHTML(s) {
  const emp = MOCK.employees.find(e => e.name === s.employee);
  return `<div class="rounded-xl border border-charcoal-200 p-3">
    <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700">Employment history</p>
    <div class="mt-2 space-y-1.5">${[
      { type: 'Joined Revive', date: `${formatDate(emp ? emp.hireDate : '—')}`, detail: `Hired as ${s.position}.` },
      { type: 'Status → ' + (emp ? emp.status : '—'), date: 'Sep 9, 2026', detail: 'Exit workflow opened through Terminations.' },
    ].map(h => `<div class="flex items-start gap-2.5 bg-charcoal-50 rounded-lg p-2">
      <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[9px] font-semibold flex-shrink-0">${h.type.split(' ')[0].slice(0, 2).toUpperCase()}</div>
      <div><p class="text-xs font-medium text-charcoal-900">${h.type}</p><p class="text-[10px] text-charcoal-500">${h.date}</p><p class="text-[10px] text-charcoal-600">${h.detail}</p></div>
    </div>`).join('')}</div>
  </div>`;
}

function _sepAttendanceHTML() {
  return `<div class="rounded-xl border border-charcoal-200 p-3">
    <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700">Attendance — last 30 days</p>
    <div class="grid grid-cols-3 gap-2 mt-2">
      ${[['Present', '21', 'text-green-600'], ['Late', '2', 'text-yellow-600'], ['Absent', '1', 'text-red-600']].map(([k, v, c]) => `<div class="bg-charcoal-50 rounded-lg py-1.5 text-center"><p class="text-base font-bold ${c}">${v}</p><p class="text-[10px] text-charcoal-500">${k}</p></div>`).join('')}
    </div>
    <p class="text-[9px] text-charcoal-400 mt-1.5">Any leave days over the annual accrual convert to <b class="text-red-600">absent</b> at exit — affecting attendance-based deductions.</p>
  </div>`;
}

function _sepLeaveHTML(s) {
  const ls = _leaveSettlement(s);
  const firstName = s.employee.split(' ')[0];
  const overageBox = ls.overage > 0 ? `<div class="mt-2 rounded-lg bg-red-50 border border-red-200 p-2.5">
    <p class="text-[10px] font-semibold text-red-700">${firstName} took ${ls.taken} annual-leave days — but only ${ls.accrued} were accrued by ${MOCK_TODAY.getFullYear()}-month ${ls.monthsElapsed}.</p>
    <p class="text-[10px] text-red-700 mt-1"><b>${ls.overage} day(s) over the accrual are counted as ABSENT</b> (unpaid) and deducted from the final settlement — they do not count as annual leave. Already applied as the payroll deduction above — remove it there if another line already covers it.</p>
  </div>` : `<div class="mt-2 rounded-lg bg-green-50 border border-green-200 p-2.5">
    <p class="text-[10px] font-semibold text-green-700">Leave balance at exit: <b>+${ls.payout} days</b> — the company owes ${firstName} this payout with the final settlement.</p>
  </div>`;
  return `<div class="rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700">Annual leave settlement</p>
      ${ls.balance >= 0
        ? `<span class="badge badge-green text-[9px]">Company owes ${firstName} ${ls.balance} day${ls.balance === 1 ? '' : 's'}</span>`
        : `<span class="badge badge-red text-[9px]">${firstName} owes the company ${Math.abs(ls.balance)} day${Math.abs(ls.balance) === 1 ? '' : 's'}</span>`}
    </div>
    <p class="text-[10px] text-charcoal-600 mt-1">Annual leave is <b>${ls.entitlement} days per year</b>, accrued <b>${ls.monthly}</b> days per completed month. As of ${MOCK_TODAY.getFullYear()}-${String(MOCK_TODAY.getMonth() + 1).padStart(2, '0')} (month ${ls.monthsElapsed}):</p>
    <div class="grid grid-cols-3 gap-2 mt-2 text-center">
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Accrued</p><p class="text-xs font-bold text-charcoal-900">${ls.accrued} d</p></div>
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Taken</p><p class="text-xs font-bold text-charcoal-900">${ls.taken} d</p></div>
      <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Balance</p><p class="text-xs font-bold ${ls.balance < 0 ? 'text-red-600' : 'text-green-600'}">${ls.balance >= 0 ? '+' : ''}${ls.balance} d</p></div>
    </div>
    ${overageBox}
  </div>`;
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

function moveSeparation(id, dir) {
  const s = MOCK.separations.find(x => x.id === id); if (!s) return;
  const i = _sepStages.indexOf(s.status); if (i < 0) return;
  const next = _sepStages[Math.min(_sepStages.length - 1, Math.max(0, i + dir))];
  if (next === s.status) return;
  s.status = next;
  if (next === 'Completed') {
    s.progress = 100;
    s.checklist.forEach(c => c[1] = true);
  }
  renderAll();
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
    const rows = (p.deductionLines || []).map(d => `<div class="flex items-center justify-between gap-2 bg-white rounded-lg border border-charcoal-100 px-2 py-1 text-[10px]">
      <div class="min-w-0 flex-1"><p class="text-xs font-medium text-charcoal-900 truncate">${d.label}</p><p class="text-[9px] text-charcoal-500 truncate">${d.reason || ''} · ${d.date}</p></div>
      <span class="flex items-center gap-2 flex-shrink-0"><b class="${d.status==='Pending'?'text-amber-600':'text-red-600'}">${d.amount} EGP</b>${statusBadge(d.status)}<button onclick="removeSepDeduction('${s.id}','${p.employeeId}','${d.id}')" class="btn btn-icon btn-ghost" title="Remove deduction"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></span>
    </div>`).join('');
    return `<div class="rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700">Final settlement — payroll</p>
          <p class="text-[10px] text-charcoal-500">${p.position} · gross editable by HR — audit logged</p>
        </div>
        ${statusBadge(p.status)}
      </div>
      <div class="grid grid-cols-3 gap-2 text-center mt-2.5">
        <div class="rounded-lg border border-charcoal-150 bg-charcoal-50/60 py-1.5">
          <p class="text-[9px] uppercase text-charcoal-400">Gross</p>
          <div class="flex items-center justify-center gap-1 mt-0.5"><input id="sep-gross-${p.employeeId}" type="number" class="form-input" value="${p.gross}" style="width:82px;padding:2px 6px;font-size:10px;text-align:center">
          <button onclick="updateSepGross('${s.id}','${p.employeeId}')" class="text-[9px] text-brand-600 hover:underline flex-shrink-0">apply</button></div>
        </div>
        <div class="rounded-lg border border-charcoal-150 bg-charcoal-50/60 py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Deductions</p><p class="text-xs font-bold text-red-600 mt-0.5">- ${p.deductions.toLocaleString()}</p></div>
        <div class="rounded-lg border border-charcoal-150 bg-charcoal-50/60 py-1.5"><p class="text-[9px] uppercase text-charcoal-400">Net</p><p class="text-xs font-bold text-brand-600 mt-0.5">${p.net.toLocaleString()}</p></div>
      </div>
      <p class="text-[9px] font-semibold uppercase tracking-wide text-charcoal-400 mt-2.5">Deductions (${(p.deductionLines || []).length}) — remove or add</p>
      <div class="mt-1 space-y-1">${rows || '<p class="text-[10px] text-charcoal-400 text-center py-1">No deductions</p>'}</div>
      <div class="mt-1.5 flex items-center gap-1.5">
        <input id="sep-ded-label-${p.employeeId}" class="form-input" placeholder="New deduction (e.g. ${firstName} absent leave days)" style="flex:1;padding:4px 8px;font-size:10px">
        <input id="sep-ded-amount-${p.employeeId}" type="number" class="form-input" placeholder="EGP" style="width:78px;padding:4px 8px;font-size:10px">
        <button onclick="addSepDeduction('${s.id}','${p.employeeId}')" class="btn btn-sm btn-secondary">+ Add</button>
      </div>
    </div>`;
  }).join('');
}

function _sepRequestsHTML(s) {
  const reqs = MOCK.requests.filter(r => r.employee === s.employee);
  const firstName = s.employee.split(' ')[0];
  return `<div class="rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-[10px] font-bold uppercase tracking-wide text-charcoal-700">Requests — ${firstName}</p>
      <span class="badge badge-gray text-[9px]">${reqs.length} total</span>
    </div>
    <div class="mt-2 max-h-44 overflow-y-auto space-y-1">${reqs.map(r=>`<div class="flex items-center justify-between gap-2 bg-charcoal-50 rounded-lg px-2 py-1.5">
      <div class="min-w-0"><p class="text-xs font-medium text-charcoal-900 truncate">${r.type}${r.period ? ' — ' + r.period : ''}</p><p class="text-[9px] text-charcoal-500 truncate">${r.requestedDate || ''} · ${r.reason || '—'}</p></div>
      ${statusBadge(r.status)}
    </div>`).join('') || '<p class="text-[10px] text-charcoal-400 text-center py-2">No requests on file</p>'}
    </div>
    <p class="text-[9px] text-charcoal-400 mt-1.5">Resolve any <b class="text-amber-600">Pending HR Review</b> requests before finalizing — every request on file shows here so you can close the account with full context.</p>
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
  openSeparation(id);
  renderAll();
}

function toggleSepChecklist(sepId, idx, checked) {
  const s = MOCK.separations.find(x=>x.id===sepId); if(!s) return;
  s.checklist[idx][1] = checked;
  const done = s.checklist.filter(c=>c[1]).length;
  s.progress = Math.round((done / s.checklist.length) * 100);
  if (s.status === 'Notice Period') s.status = 'Exit In Progress'; // legacy records
  openSeparation(sepId);
  renderAll();
}

function finalizeSeparation(sepId) {
  const s = MOCK.separations.find(x=>x.id===sepId); if(!s) return;
  s.status = 'Completed';
  s.completedOn = '2026-09-09';
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

// ==================== EMPLOYEE ACTION REQUESTS (HR → HR MANAGER ESCALATION) ====================
// HR holds employees.request_action but NOT employees.transfer / compensation.manage /
// role.assign / offboard / bulk_import. The same buttons render as "Request [Action]",
// create an EmployeeActionRequest (proposedDetails + justification), and the HR Manager
// reviews them in the Events queue — Approve auto-executes, Reject closes with a comment.
function canRequestActions() {
  return DEMO.showAll || hasPermission('employees.request_action');
}

function openRequestTransfer(empId) {
  if (!canRequestActions()) {
    showToast('Requires employees.request_action permission', 'error'); return;
  }
  const e = MOCK.employees.find(x => x.id === empId);
  if (!e) return;
  const myGyms = (MOCK.currentUser.gyms || []).map(g => g.branch);
  const targetGyms = myGyms.filter(g => g !== e.gym);

  openModal('Request Transfer — ' + e.name, `<form onsubmit="event.preventDefault();submitTransferRequest('${e.id}');" class="space-y-3">
    <p class="text-[10px] text-charcoal-500">Transfers are executed by an <b class="text-brand-700">HR Manager</b>. Submitting raises an action request that appears in their <b>Events</b> queue — the employee is not moved until they approve it.</p>
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px]">
      <div class="flex justify-between"><span class="text-charcoal-500">Employee</span><span class="font-bold text-charcoal-900">${e.name}</span></div>
      <div class="flex justify-between mt-1"><span class="text-charcoal-500">Current Gym</span><span class="font-bold text-charcoal-900">${e.gym}</span></div>
      <div class="flex justify-between mt-1"><span class="text-charcoal-500">Position</span><span class="font-bold text-charcoal-900">${e.position} — ${e.level}</span></div>
    </div>
    <div><label class="form-label">Target Gym *</label>
      <select id="trf-target" class="form-select" required>${targetGyms.map(g=>`<option value="${g}">${g} Branch</option>`).join('')}</select>
    </div>
    <div><label class="form-label">Effective Date *</label><input id="trf-date" type="date" class="form-input" value="2026-10-01" required></div>
    <div><label class="form-label">Justification *</label><textarea id="trf-reason" class="form-input" rows="2" required placeholder="e.g. Relocation, staff shortage, personal request..."></textarea></div>
    <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Submit Request →</button>
    </div>
  </form>`, { wide: true });
}

function submitTransferRequest(empId) {
  if (!canRequestActions()) {
    showToast('Requires employees.request_action permission', 'error'); return;
  }
  const e = MOCK.employees.find(x => x.id === empId);
  const target = document.getElementById('trf-target')?.value;
  const date = document.getElementById('trf-date')?.value || '2026-10-01';
  const reason = document.getElementById('trf-reason')?.value.trim();
  if (!e || !reason) { showToast('Please provide a justification', 'error'); return; }

  MOCK.actionRequests = MOCK.actionRequests || [];
  MOCK.actionRequests.unshift({
    id: 'ar-' + Date.now(),
    employeeId: e.id, employee: e.name, position: `${e.position} — ${e.level}`,
    actionType: 'Transfer',
    proposedDetails: { fromGym: e.gym, toGym: target, effectiveDate: date },
    justification: reason,
    requestedBy: MOCK.currentUser.fullName, status: 'Pending',
    submittedDate: '2026-09-09'
  });

  MOCK.auditLog = MOCK.auditLog || [];
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(), action: 'Transfer Requested',
    user: MOCK.currentUser.fullName, target: e.name,
    detail: `${e.gym} → ${target} (Effective ${date}). Justification: ${reason}`,
    timestamp: '2026-09-09', gym: e.gym
  });

  closeModal();
  showToast(`Transfer request raised for ${e.name} — awaiting HR Manager approval`);
  renderAll();
}

// Generic escalation modal for CompensationChange / RoleAssign / Offboard / BulkImport
function openActionRequest(type, empId) {
  if (!canRequestActions()) { showToast('Requires employees.request_action permission', 'error'); return; }
  const meta = ACTION_TYPES[type];
  if (!meta) return;

  if (type === 'BulkImport') {
    openModal('Request Bulk Import', `<form onsubmit="event.preventDefault();submitActionRequest('BulkImport');" class="space-y-3">
      <p class="text-[10px] text-charcoal-500">Bulk imports are executed by an <b class="text-brand-700">HR Manager</b>. Submitting queues the file for review — no records are added until they approve it.</p>
      <div><label class="form-label">File / Records to import *</label><input id="ar-source" class="form-input" placeholder="e.g. new_hires_sep2026.csv — 12 rows" required></div>
      <div><label class="form-label">Justification *</label><textarea id="ar-just" class="form-input" rows="2" required placeholder="Why do these records need to be imported?"></textarea></div>
      <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
        <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-sm btn-primary">Submit Request →</button>
      </div>
    </form>`, { wide: true });
    return;
  }

  const empList = MOCK.employees.filter(e => e.status !== 'Suspended');
  const e = empId ? MOCK.employees.find(x => x.id === empId) : empList[0];
  if (!e) return;
  const empSelect = (disabled) => `<select id="ar-emp" class="form-select" ${disabled ? 'disabled' : ''}>${empList.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${x.name} (${x.position} — ${x.level} · ${x.gym})</option>`).join('')}</select>`;

  let fields = '';
  if (type === 'CompensationChange') {
    fields = `
      <div><label class="form-label">Employee *</label>${empSelect(!!empId)}</div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Current Salary</label><input class="form-input" value="EGP ${e.salary.toLocaleString()}" disabled></div>
        <div><label class="form-label">Proposed Salary (EGP) *</label><input id="ar-salary" type="number" class="form-input" value="${e.salary}" min="0" required></div>
      </div>
      <div><label class="form-label">Effective Date *</label><input id="ar-effdate" type="date" class="form-input" value="2026-10-01" required></div>`;
  } else if (type === 'RoleAssign') {
    fields = `
      <div><label class="form-label">Employee *</label>${empSelect(!!empId)}</div>
      <div><label class="form-label">System Role *</label><select id="ar-role" class="form-select"><option value="">None (Employee)</option><option>Branch Manager</option><option>Team Leader</option></select></div>
      <p class="text-[10px] text-charcoal-500">This grants or revokes system roles — a high-trust governance action executed by the HR Manager.</p>`;
  } else if (type === 'Offboard') {
    fields = `
      <div><label class="form-label">Employee *</label>${empSelect(!!empId)}</div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Last Working Day *</label><input id="ar-lastday" type="date" class="form-input" value="2026-09-30" required></div>
        <div><label class="form-label">Separation Reason *</label><select id="ar-reason" class="form-select"><option>Resignation</option><option>End of Contract</option><option>Mutual Agreement</option><option>Performance Termination</option><option>Relocation / Personal</option></select></div>
      </div>`;
  }

  openModal(`Request ${meta.label} — ${e.name}`, `<form onsubmit="event.preventDefault();submitActionRequest('${type}');" class="space-y-3">
    <p class="text-[10px] text-charcoal-500">${meta.label} requires <code>${meta.perm}</code> (HR Manager). Submitting raises an action request — nothing changes on the employee record until they approve it.</p>
    ${fields}
    <div><label class="form-label">Justification *</label><textarea id="ar-just" class="form-input" rows="2" required placeholder="Why is this action needed?"></textarea></div>
    <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Submit Request →</button>
    </div>
  </form>`, { wide: true });
}

function submitActionRequest(type) {
  if (!canRequestActions()) { showToast('Requires employees.request_action permission', 'error'); return; }
  const meta = ACTION_TYPES[type];
  if (!meta) return;
  const just = document.getElementById('ar-just')?.value.trim();
  const empSel = document.getElementById('ar-emp');
  const e = empSel ? MOCK.employees.find(x => x.id === empSel.value) : null;
  if (type !== 'BulkImport' && !e) { showToast('Please choose an employee', 'error'); return; }
  if (!just) { showToast('Please provide a justification', 'error'); return; }

  let proposedDetails = {}, summary = '';
  if (type === 'CompensationChange') {
    const newSalary = parseFloat(document.getElementById('ar-salary')?.value);
    const eff = document.getElementById('ar-effdate')?.value || '2026-10-01';
    if (!newSalary) { showToast('Please enter the proposed salary', 'error'); return; }
    proposedDetails = { currentSalary: e.salary, newSalary, effectiveDate: eff };
    summary = `Salary EGP ${e.salary.toLocaleString()} → EGP ${newSalary.toLocaleString()} (Effective ${eff})`;
  } else if (type === 'RoleAssign') {
    const role = document.getElementById('ar-role')?.value || 'None (Employee)';
    proposedDetails = { systemRole: role };
    summary = `System role → ${role}`;
  } else if (type === 'Offboard') {
    const lastDay = document.getElementById('ar-lastday')?.value || '2026-09-30';
    const reason = document.getElementById('ar-reason')?.value || 'Resignation';
    proposedDetails = { lastDay, reason };
    summary = `Last day ${lastDay} · Reason: ${reason}`;
  } else if (type === 'BulkImport') {
    const source = document.getElementById('ar-source')?.value.trim();
    if (!source) { showToast('Please describe the file / records', 'error'); return; }
    proposedDetails = { source };
    summary = source;
  }

  MOCK.actionRequests = MOCK.actionRequests || [];
  MOCK.actionRequests.unshift({
    id: 'ar-' + Date.now(),
    employeeId: e ? e.id : null,
    employee: e ? e.name : 'Bulk records',
    position: e ? `${e.position} — ${e.level}` : '—',
    actionType: type,
    proposedDetails, justification: just,
    requestedBy: MOCK.currentUser.fullName, status: 'Pending',
    submittedDate: '2026-09-09'
  });

  MOCK.auditLog = MOCK.auditLog || [];
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(), action: `${meta.label} Requested`,
    user: MOCK.currentUser.fullName, target: e ? e.name : 'Bulk import',
    detail: `${summary}. Justification: ${just}`,
    timestamp: '2026-09-09', gym: e ? e.gym : 'All'
  });

  closeModal();
  showToast(`${meta.label} request raised — awaiting HR Manager approval`);
  renderAll();
}

// Direct bulk import (employees.bulk_import — HR Manager)
function openBulkImport() {
  if (!(DEMO.showAll || hasPermission('employees.bulk_import'))) {
    showToast('Bulk import requires employees.bulk_import (HR Manager)', 'error'); return;
  }
  openModal('Bulk Import Employees', `<form onsubmit="event.preventDefault();submitBulkImport();" class="space-y-3">
    <p class="text-[10px] text-charcoal-500">Upload a CSV of employee records. Duplicate Employee IDs and malformed rows are skipped automatically.</p>
    <div class="border-2 border-dashed border-charcoal-200 rounded-xl p-6 text-center">
      <svg class="w-8 h-8 text-charcoal-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0L8 8m4 4V4"/></svg>
      <p class="text-xs text-charcoal-500 mt-2">Drop <code>employees.csv</code> here or <span class="text-brand-600 font-semibold cursor-pointer">browse</span></p>
      <p class="text-[10px] text-charcoal-400 mt-1">Columns: name, email, position, level, gym, salary</p>
    </div>
    <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Import Records →</button>
    </div>
  </form>`, { wide: true });
}

function submitBulkImport() {
  if (!(DEMO.showAll || hasPermission('employees.bulk_import'))) {
    showToast('Bulk import requires employees.bulk_import (HR Manager)', 'error'); return;
  }
  MOCK.auditLog = MOCK.auditLog || [];
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(), action: 'Bulk Import', user: MOCK.currentUser.fullName,
    target: 'employees.csv', detail: 'CSV import completed — records added',
    timestamp: '2026-09-09', gym: 'All'
  });
  closeModal();
  showToast('Bulk import completed — records added');
  renderAll();
}

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
    exitInterview: { decision: 'Pending', scheduledFor: '', time: '', interviewer: '', note: '', conductedOn: '', rating: null, performanceRating: null, feedback: '' },
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
    status: 'Exit Interview',
    progress: 0,
    checklist: [
      ['Exit interview scheduled', false],
      ['Handover completed', false],
      ['Uniform returned', false],
      ['Access cards revoked', false],
      ['Final settlement', false]
    ],
    exitInterview: { decision: 'Pending', scheduledFor: '', time: '', interviewer: '', note: '', conductedOn: '', rating: null, performanceRating: null, feedback: '' },
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
  // HR (no direct lifecycle perms) holds employees.request_action — the same buttons
  // render as "Request [Action]" and raise an EmployeeActionRequest for the HR Manager.
  const canRequestAction = showAll || hasPermission('employees.request_action');

  const tabs = [
    {id:'personal',label:'Personal Info'}, {id:'documents',label:'Documents'},
    {id:'employment',label:'Employment History'}, {id:'attendance',label:'Attendance Summary'},
    {id:'shift',label:'Current Shift'}, {id:'requests',label:'Requests History'},
    {id:'leave',label:'Leave Balance'}, {id:'eval',label:'Evaluations History'}, {id:'payroll',label:'Payroll Snapshot'},
  ];

  let lifecycleActions = '';
  if (canTransfer) lifecycleActions += `<button onclick="showToast('Transfer Gym — simulated')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Transfer Gym</button>`;
  else if (canRequestAction) lifecycleActions += `<button onclick="openRequestTransfer('${e.id}')" class="btn btn-sm btn-secondary" title="Transfers are executed by an HR Manager. Raise a request instead."><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Request Transfer</button>`;
  if (canPosition) lifecycleActions += `<button onclick="showToast('Change Position/Level — simulated')" class="btn btn-sm btn-secondary">Change Position</button>`;
  if (canRole) lifecycleActions += `<button onclick="openChangeRole('${e.id}')" class="btn btn-sm btn-secondary">Change System Role</button>`;
  else if (canRequestAction) lifecycleActions += `<button onclick="openActionRequest('RoleAssign','${e.id}')" class="btn btn-sm btn-secondary" title="Role assignment is executed by an HR Manager. Raise a request instead.">Request Role Assign</button>`;
  if (canCompensate) lifecycleActions += `<button onclick="showToast('Manage Compensation — simulated')" class="btn btn-sm btn-secondary">Manage Compensation</button>`;
  else if (canRequestAction) lifecycleActions += `<button onclick="openActionRequest('CompensationChange','${e.id}')" class="btn btn-sm btn-secondary" title="Compensation changes are executed by an HR Manager. Raise a request instead.">Request Compensation</button>`;
  if (canContract) lifecycleActions += `<button onclick="showToast('Manage Contract — simulated')" class="btn btn-sm btn-secondary">Manage Contract</button>`;
  if (canOffboard) lifecycleActions += `<button onclick="openInitiateOffboarding('${e.id}')" class="btn btn-sm btn-danger-outline">Offboard</button>`;
  else if (canRequestAction) lifecycleActions += `<button onclick="openActionRequest('Offboard','${e.id}')" class="btn btn-sm btn-danger-outline" title="Offboarding is executed by an HR Manager. Raise a request instead.">Request Offboard</button>`;

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
      <div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200 mt-3">
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
