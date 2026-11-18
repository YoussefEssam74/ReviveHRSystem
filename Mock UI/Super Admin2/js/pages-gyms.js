// ==================== PAGE: GYM ACCOUNTS ====================
// The account list is a table, not cards: a platform owner compares many gyms at once
// and needs to sort by users, revenue, renewal and status.
const gymUserView = { role: 'all', q: '', branch: 'all' };

function defaultGymSort() {
  return { key: 'name', dir: 'asc' };
}

function setGymSort(key) {
  const cur = state.gymSort || defaultGymSort();
  state.gymSort = { key, dir: cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc' };
  renderAll();
}

function gymSortValue(gym, key) {
  switch (key) {
    case 'plan': return getPlan(gym.planId).name;
    case 'branches': return gym.branches;
    case 'users': return gym.userCounts.total;
    case 'seats': return gym.seatLimit ? gym.userCounts.total / gym.seatLimit : -1;
    case 'mrr': return gym.mrr;
    case 'renews': return gym.renewsOn;
    case 'status': return gym.status;
    default: return `${gym.name} ${gym.location}`;
  }
}

function renderGyms() {
  const f = state.gymFilters;
  const sort = state.gymSort || defaultGymSort();
  const q = f.q.toLowerCase();

  let visible = GYMS.filter((g) => {
    if (f.status !== 'all' && g.status !== f.status) return false;
    if (f.plan !== 'all' && g.planId !== f.plan) return false;
    if (q && !(g.name + ' ' + g.location + ' ' + g.code).toLowerCase().includes(q)) return false;
    return true;
  });

  visible = visible.slice().sort((a, b) => {
    const av = gymSortValue(a, sort.key);
    const bv = gymSortValue(b, sort.key);
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const statusOptions = ['all', 'Active', 'Trial', 'Payment overdue', 'Suspended'].map((s) => {
    const count = s === 'all' ? GYMS.length : GYMS.filter((g) => g.status === s).length;
    return `<option value="${s}"${f.status === s ? ' selected' : ''}>${esc(s === 'all' ? 'All statuses' : s)} (${count})</option>`;
  }).join('');

  const filtered = f.status !== 'all' || f.plan !== 'all' || f.q;

  const rows = visible.map((gym) => {
    const renewIn = daysBetween(PLATFORM.today, gym.renewsOn);

    return `<tr class="is-clickable" onclick="navigateTo('gym-detail',{gymId:'${gym.id}'})">
      <td>
        <div class="flex items-center gap-2 min-w-0">
          ${gymLogo(gym, 36)}
          <div class="min-w-0">
            <p class="text-xs font-semibold text-charcoal-800 truncate leading-tight">${esc(gym.name)}</p>
            <p class="text-[10px] text-charcoal-500 truncate leading-tight">${esc(gym.location)}, ${esc(gym.city)} · ${esc(gym.code)}</p>
          </div>
        </div>
      </td>
      <td>${planBadge(gym.planId)}</td>
      <td class="text-center whitespace-nowrap">
        <span class="text-xs font-semibold text-charcoal-700">${gym.branches}</span>
      </td>
      <td class="text-right whitespace-nowrap">
        ${gym.mrr ? `<span class="text-xs font-semibold text-charcoal-800">${formatMoney(gym.mrr)}</span>` : '<span class="text-[10px] text-blue-600 font-medium">Trial</span>'}
      </td>
      <td class="whitespace-nowrap">
        <span class="text-[11px] text-charcoal-600">${formatDate(gym.renewsOn)}</span>
        <p class="text-[9px] ${renewIn <= 14 ? 'text-amber-600 font-semibold' : 'text-charcoal-400'}">${renewIn < 0 ? 'expired' : 'in ' + renewIn + ' days'}</p>
      </td>
      <td>${statusBadge(gym.status)}</td>
      <td class="text-right whitespace-nowrap">
        <button onclick="event.stopPropagation();navigateTo('gym-detail',{gymId:'${gym.id}'})" class="btn btn-sm btn-secondary">Open</button>
        <button onclick="event.stopPropagation();toggleGymStatus('${gym.id}')" class="btn btn-sm btn-ghost ${gym.status === 'Suspended' ? 'text-brand-700' : 'text-red-600 hover:bg-red-50'}">${gym.status === 'Suspended' ? 'Restore' : 'Suspend'}</button>
      </td>
    </tr>`;
  }).join('');

  return `
  ${pageHeader(
    'Gym accounts',
    `${GYMS.length} subscribed gyms · ${formatNumber(platformTotals().totalUsers)} users · ${formatMoney(platformTotals().mrr)} MRR`,
    `<button onclick="startGymWizard()" class="btn btn-primary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      Create gym account
    </button>`
  )}

  <div class="card card-grow">
    <div class="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-charcoal-100">
      <select class="form-select form-input-sm w-auto" onchange="setGymFilter('status',this.value)" aria-label="Filter by status">
        ${statusOptions}
      </select>
      <select class="form-select form-input-sm w-auto" onchange="setGymFilter('plan',this.value)">
        <option value="all"${f.plan === 'all' ? ' selected' : ''}>All plans</option>
        ${PLANS.map((p) => `<option value="${p.id}"${f.plan === p.id ? ' selected' : ''}>${p.name}</option>`).join('')}
      </select>
      <div class="relative ml-auto">
        <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-charcoal-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input class="form-input form-input-sm pl-6 w-44" placeholder="Search gyms…" value="${esc(f.q)}" oninput="setGymFilter('q',this.value)" aria-label="Search gym accounts">
      </div>
      ${filtered ? '<button onclick="resetGymFilters()" class="btn btn-sm btn-ghost text-charcoal-500">Clear</button>' : ''}
    </div>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th class="th-sort ${sort.key === 'name' ? 'sorted' : ''}" onclick="setGymSort('name')">Gym account ${sortIndicator(sort.key, 'name', sort.dir)}</th>
          <th class="th-sort ${sort.key === 'plan' ? 'sorted' : ''}" onclick="setGymSort('plan')">Plan ${sortIndicator(sort.key, 'plan', sort.dir)}</th>
          <th class="th-sort text-center ${sort.key === 'branches' ? 'sorted' : ''}" onclick="setGymSort('branches')">Branches ${sortIndicator(sort.key, 'branches', sort.dir)}</th>
          <th class="th-sort text-right ${sort.key === 'mrr' ? 'sorted' : ''}" onclick="setGymSort('mrr')">MRR ${sortIndicator(sort.key, 'mrr', sort.dir)}</th>
          <th class="th-sort ${sort.key === 'renews' ? 'sorted' : ''}" onclick="setGymSort('renews')">Renews ${sortIndicator(sort.key, 'renews', sort.dir)}</th>
          <th class="th-sort ${sort.key === 'status' ? 'sorted' : ''}" onclick="setGymSort('status')">Status ${sortIndicator(sort.key, 'status', sort.dir)}</th>
          <th class="text-right">Actions</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="7">${emptyState('No gym accounts match these filters', 'Try clearing the search or status filter.')}</td></tr>`}</tbody>
      </table>
    </div>

    <div class="px-3 py-2 border-t border-charcoal-100 flex items-center justify-between gap-2 flex-wrap">
      <p class="text-[10px] text-charcoal-500">Showing ${visible.length} of ${GYMS.length} gym accounts</p>
      <p class="text-[10px] text-charcoal-400">Click any row to open the account</p>
    </div>
  </div>`;
}

function setGymFilter(key, value) {
  state.gymFilters[key] = value;
  const main = document.getElementById('main-content');
  const scroll = main ? main.scrollTop : 0;
  renderAll();
  if (main) main.scrollTop = scroll;
  if (key === 'q') {
    const input = main ? main.querySelector('input[placeholder="Search gyms…"]') : null;
    if (input) { input.focus(); input.setSelectionRange(value.length, value.length); }
  }
}

function resetGymFilters() {
  state.gymFilters = { status: 'all', plan: 'all', q: '' };
  renderAll();
}

// ==================== PAGE: GYM DETAIL ====================
function renderGymDetail() {
  const gym = getGym(state.activeGymId);
  if (!gym) return `<div class="card">${emptyState('Gym account not found')}</div>`;

  const users = getGymUsers(gym.id);
  const hrStaff = getGymHrStaff(gym.id);
  const invoices = getInvoices(gym.id);
  const audit = getGymAudit(gym.id);
  const plan = getPlan(gym.planId);
  const renewIn = daysBetween(PLATFORM.today, gym.renewsOn);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'branches', label: 'Branches', count: gym.branchList.length },
    { id: 'employees', label: 'Employees', count: users.length },
    { id: 'managers', label: 'HR staff', count: hrStaff.length },
    { id: 'billing', label: 'Billing', count: invoices.length },
    { id: 'audit', label: 'Audit', count: audit.length },
  ].map((tab) => `<button class="tab-btn ${state.gymTab === tab.id ? 'active' : ''}" onclick="setGymTab('${tab.id}')">
      ${esc(tab.label)}${tab.count != null ? `<span class="tab-count">${tab.count}</span>` : ''}
    </button>`).join('');

  return `
  <nav class="flex items-center gap-1.5 text-[10px] text-charcoal-500 mb-2">
    <button onclick="navigateTo('gyms')" class="hover:text-brand-700 font-medium">Gym accounts</button>
    <span class="text-charcoal-300">/</span>
    <span class="text-charcoal-700 font-semibold">${esc(gym.name)} — ${esc(gym.location)}</span>
  </nav>

  <div class="card p-3 mb-3">
    <div class="flex items-start gap-3 flex-wrap">
      ${gymLogo(gym, 56)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-base font-bold text-charcoal-900 leading-tight">${esc(gym.name)}</h2>
          ${statusBadge(gym.status)}
          ${planBadge(gym.planId)}
          <span class="badge badge-gray">${esc(gym.code)}</span>
        </div>
        <p class="text-[11px] text-charcoal-500 mt-0.5">${esc(gym.location)}, ${esc(gym.city)} · ${gym.branches} ${gym.branches > 1 ? 'branches' : 'branch'} · ${formatNumber(gym.userCounts.total)} users</p>
        <div class="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-charcoal-500">
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            ${esc(gym.contact.email)}
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            ${esc(gym.contact.phone)}
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            ${esc(gym.contact.name)}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button onclick="openWorkspace('${gym.id}','HR Manager')" class="btn btn-primary btn-sm">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
          Enter workspace
        </button>
        <button onclick="openAssignHR('${gym.id}')" class="btn btn-secondary btn-sm">Assign HR staff</button>
        <button onclick="openChangePlan('${gym.id}')" class="btn btn-secondary btn-sm">Change plan</button>
        <button onclick="toggleGymStatus('${gym.id}')" class="btn ${gym.status === 'Suspended' ? 'btn-success' : 'btn-danger-outline'} btn-sm">
          ${gym.status === 'Suspended' ? 'Restore account' : 'Suspend'}
        </button>
      </div>
    </div>
    ${gym.status === 'Payment overdue' ? `<div class="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
      <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      <p class="text-[10px] text-amber-800 leading-relaxed"><strong class="font-semibold">Payroll is blocked.</strong> Invoice ${esc((invoices.find((i) => i.status === 'Overdue') || {}).id || '')} is overdue. Restore access once payment clears.</p>
    </div>` : ''}
    ${gym.status === 'Trial' ? `<div class="mt-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 flex items-start gap-2">
      <svg class="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="text-[10px] text-blue-800 leading-relaxed"><strong class="font-semibold">Trial ends in ${renewIn} days</strong> (${formatDate(gym.renewsOn)}). Convert to a paid plan to avoid suspending the workspace.</p>
    </div>` : ''}
  </div>

  <div class="border-b border-charcoal-200 mb-3 flex items-center gap-1 overflow-x-auto flex-shrink-0">${tabs}</div>

  <div class="grow scroll-region">
  ${state.gymTab === 'overview' ? gymOverviewTab(gym, users, plan) : ''}
  ${state.gymTab === 'branches' ? gymBranchesTab(gym) : ''}
  ${state.gymTab === 'employees' ? gymEmployeesTab(gym, users) : ''}
  ${state.gymTab === 'managers' ? gymHrStaffTab(gym, hrStaff) : ''}
  ${state.gymTab === 'billing' ? gymBillingTab(gym, plan, invoices) : ''}
  ${state.gymTab === 'audit' ? gymAuditTab(gym, audit) : ''}
  </div>`;
}

function setGymTab(tab) {
  state.gymTab = tab;
  renderAll();
}

function gymOverviewTab(gym, users, plan) {
  const counts = roleCounts(users);
  const roles = [
    { label: 'HR staff', value: counts.hr },
    { label: 'Branch managers', value: counts.branchManager },
    { label: 'Team leaders', value: counts.teamLeader },
    { label: 'Employees', value: counts.employee },
  ];
  const max = Math.max(...roles.map((r) => r.value), 1);
  const roleRows = roles.map((r) => `<div class="bar-row">
      <span class="bar-label">${esc(r.label)}</span>
      <div class="meter"><div class="meter-fill" style="width:${Math.round((r.value / max) * 100)}%"></div></div>
      <span class="bar-value">${r.value}</span>
    </div>`).join('');

  const pct = gym.seatLimit ? Math.round((counts.total / gym.seatLimit) * 100) : 0;

  return `<div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
    <div class="xl:col-span-2 space-y-3">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${statTile({ label: 'Total users', value: formatNumber(counts.total), sub: `${counts.employee} employees`, accent: true })}
        ${statTile({ label: 'HR staff', value: counts.hr, sub: 'assigned to this gym' })}
        ${statTile({ label: 'Attendance', value: gym.attendanceRate + '%', sub: 'last 30 days' })}
        ${statTile({ label: 'Seats used', value: gym.seatLimit ? `${pct}%` : formatNumber(counts.total), sub: gym.seatLimit ? `${counts.total} of ${gym.seatLimit}` : 'no seat cap' })}
      </div>

      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Users by role</p>
          <button onclick="setGymTab('employees')" class="btn btn-sm btn-ghost text-brand-700">All employees →</button></div>
        <div class="px-3 py-2.5 space-y-2">${roleRows}</div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="flex-1 min-w-0">
            <p class="bento-label">Attendance activity · 14 days</p>
            <p class="text-[10px] text-charcoal-500 mt-0.5">Kiosk check-ins recorded at this gym</p>
          </div>
          ${sparkline(gym.activity, gym.status === 'Payment overdue' ? 'red' : '')}
        </div>
        <div class="px-3 py-2.5">
          <div class="flex items-end gap-1 h-16">
            ${gym.activity.map((v) => {
              const pctHeight = Math.max(4, Math.round((v / Math.max(...gym.activity)) * 100));
              return `<div class="flex-1 rounded-t-sm ${gym.status === 'Payment overdue' ? 'bg-red-300' : 'bg-brand-300'}" style="height:${pctHeight}%" title="${v} check-ins"></div>`;
            }).join('')}
          </div>
          <div class="flex items-center justify-between mt-1.5 text-[9px] text-charcoal-400">
            <span>${gym.activity.length} days ago</span>
            <span>${gym.activity.reduce((a, b) => a + b, 0)} total check-ins</span>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Account facts</p></div>
        <dl class="px-3 py-2.5 text-[11px] space-y-1.5">
          ${[
            ['Plan', plan.name],
            ['Billing cycle', gym.billingCycle],
            ['Subscribed on', formatDate(gym.subscribedOn)],
            ['Renews on', formatDate(gym.renewsOn)],
            ['Monthly value', gym.mrr ? formatMoney(gym.mrr) : 'Trial — no charge'],
            ['Payroll status', gym.payrollStatus],
            ['Last activity', relativeTime(gym.lastActivity)],
          ].map(([k, v]) => `<div class="flex justify-between gap-3">
            <dt class="text-charcoal-500">${esc(k)}</dt>
            <dd class="font-semibold text-charcoal-800 text-right">${esc(v)}</dd>
          </div>`).join('')}
        </dl>
      </div>

      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Account health</p>
          <span class="badge ${gym.health >= 85 ? 'badge-green' : gym.health >= 65 ? 'badge-amber' : 'badge-red'}">${gym.health}/100</span></div>
        <div class="px-3 py-2.5 space-y-2">
          ${meterHtml(gym.health, 100, gym.health >= 85 ? '' : gym.health >= 65 ? 'amber' : 'red')}
          <p class="text-[10px] text-charcoal-500 leading-relaxed">${gym.health >= 85
            ? 'Healthy account — active usage, current subscription and no unresolved alerts.'
            : gym.health >= 65
              ? 'Monitor this account — usage is trending down or an administrative item is outstanding.'
              : 'At risk — payment or access issues are blocking the gym from operating normally.'}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Super Admin actions</p></div>
        <div class="p-2 space-y-1.5">
          <button onclick="openWorkspace('${gym.id}','HR Manager')" class="btn btn-secondary btn-sm w-full justify-start">Enter workspace as HR Manager</button>
          <button onclick="openAssignHR('${gym.id}')" class="btn btn-secondary btn-sm w-full justify-start">Assign HR staff to this gym</button>
          <button onclick="setGymTab('audit')" class="btn btn-secondary btn-sm w-full justify-start">Review gym audit trail</button>
        </div>
      </div>
    </div>
  </div>`;
}

function gymBranchesTab(gym) {
  const totalStaff = gym.userCounts.total;

  const rows = gym.branchList.map((branch, index) => {
    const staff = getBranchStaff(gym.id, branch.name);
    const counts = roleCounts(staff);
    return `<tr class="is-clickable" onclick="openBranchStaff('${gym.id}', ${index})">
      <td class="min-w-0">
        <p class="text-xs font-semibold text-charcoal-800 truncate leading-tight">${esc(branch.name)}</p>
        <p class="text-[10px] text-charcoal-500 truncate leading-tight">${esc(branch.area)}</p>
      </td>
      <td class="whitespace-nowrap"><span class="badge badge-gray font-mono">${esc(branch.code)}</span></td>
      <td class="min-w-0"><span class="block text-[11px] text-charcoal-600 truncate max-w-[190px]">${esc(branch.address)}</span></td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-600">${esc(branch.phone)}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-700">${esc(branch.manager)}</td>
      <td class="whitespace-nowrap">
        <span class="text-xs font-semibold text-charcoal-800">${staff.length}</span>
        <p class="text-[9px] text-charcoal-400 leading-tight">${counts.employee} emp · ${counts.teamLeader} TL · ${counts.branchManager} mgr</p>
      </td>
      <td class="text-right whitespace-nowrap">
        <button onclick="event.stopPropagation();openBranchStaff('${gym.id}', ${index})" class="btn btn-sm btn-ghost text-brand-700">View staff</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="card">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Branches</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${gym.branchList.length} ${gym.branchList.length === 1 ? 'site' : 'sites'} at ${esc(gym.name)} — every branch belongs to this account, and staff are scoped to the branch they work in.</p>
      </div>
      <button onclick="openBranchEditor('${gym.id}')" class="btn btn-primary btn-sm">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add branch
      </button>
    </div>
    ${gym.branchList.length
      ? `<div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Branch</th><th>Code</th><th>Address</th><th>Phone</th><th>Manager</th><th>Staff</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
      : `<div>${emptyState('No branches yet', 'Add the first branch for this gym account.')}</div>`}
    <div class="px-3 py-2 border-t border-charcoal-100">
      <p class="text-[10px] text-charcoal-500">${gym.branchList.length} branches · ${formatNumber(totalStaff)} staff assigned · click a row to see its people</p>
    </div>
  </div>`;
}

function openBranchStaff(gymId, index) {
  const gym = getGym(gymId);
  const branch = gym && gym.branchList[index];
  if (!branch) return;
  gymUserView.branch = branch.name;
  gymUserView.role = 'all';
  gymUserView.q = '';
  state.gymTab = 'employees';
  renderAll();
}

function gymEmployeesTab(gym, users) {
  const q = gymUserView.q.toLowerCase();
  const branchFilter = gymUserView.branch || 'all';

  const filtered = users.filter((u) => {
    if (branchFilter !== 'all' && u.branch !== branchFilter) return false;
    if (gymUserView.role !== 'all' && u.role !== gymUserView.role) return false;
    if (q && !(u.name + ' ' + u.email).toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = roleCounts(users);

  const roleOptions = [
    ['all', 'All roles', counts.total],
    ['HR', 'HR staff', counts.hr],
    ['Branch Manager', 'Branch managers', counts.branchManager],
    ['Team Leader', 'Team leaders', counts.teamLeader],
    ['Employee', 'Employees', counts.employee],
  ].map(([key, label, count]) => `<option value="${key}"${gymUserView.role === key ? ' selected' : ''}>${esc(label)} (${count})</option>`).join('');

  const branchOptions = [{ name: 'all', label: 'All branches', count: users.length }]
    .concat(gym.branchList.map((b) => ({ name: b.name, label: b.name, count: getBranchStaff(gym.id, b.name).length })))
    .map((b) => `<option value="${esc(b.name)}"${branchFilter === b.name ? ' selected' : ''}>${esc(b.label)} (${b.count})</option>`).join('');

  const rows = filtered.map((u) => `<tr class="is-clickable" onclick="navigateTo('user-detail',{userId:'${u.id}'})">
      <td>
        <div class="flex items-center gap-2">
          ${avatarHtml(u, 28)}
          <div class="min-w-0">
            <p class="text-xs font-medium text-charcoal-800 truncate leading-tight">${esc(u.name)}</p>
            <p class="text-[10px] text-charcoal-500 truncate leading-tight">${esc(u.email)}</p>
          </div>
        </div>
      </td>
      <td><span class="badge badge-gray">${esc(u.role)}</span></td>
      <td class="min-w-0">
        <span class="block text-[11px] text-charcoal-600 truncate max-w-[170px]">${esc(u.branch || '—')}</span>
        <p class="text-[9px] text-charcoal-400">${esc(u.branchCode || '')}</p>
      </td>
      <td>${statusBadge(u.status)}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-500">${u.lastLogin ? relativeTime(u.lastLogin) : 'Never'}</td>
      <td class="text-right whitespace-nowrap">
        <button onclick="event.stopPropagation();navigateTo('user-detail',{userId:'${u.id}'})" class="btn btn-sm btn-ghost text-brand-700">View</button>
      </td>
    </tr>`).join('');

  return `<div class="card">
    <div class="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-charcoal-100">
      <div class="relative flex-1 min-w-[180px]">
        <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-charcoal-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input class="form-input form-input-sm pl-6 w-full" placeholder="Search this gym…" value="${esc(gymUserView.q)}" oninput="setGymUserQ(this.value)" aria-label="Search people in this gym">
      </div>
      <select class="form-select form-input-sm w-auto" onchange="setGymUserRole(this.value)" aria-label="Filter by role">
        ${roleOptions}
      </select>
      <select class="form-select form-input-sm w-auto" onchange="setGymBranch(this.value)" aria-label="Filter by branch">
        ${branchOptions}
      </select>
      <span class="text-[10px] text-charcoal-400 whitespace-nowrap">${filtered.length} of ${users.length}</span>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Employee</th><th>Role</th><th>Branch</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6">${emptyState('No employees match this filter', 'Try another branch or role.')}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="px-3 py-2 border-t border-charcoal-100 flex items-center justify-between gap-2 flex-wrap">
      <p class="text-[10px] text-charcoal-500">Showing ${filtered.length} of ${users.length} people in this gym</p>
      <button onclick="navigateTo('users',{userFilter:{gym:'${gym.id}'}})" class="btn btn-sm btn-ghost text-brand-700">Open in platform users →</button>
    </div>
  </div>`;
}

function setGymBranch(branchName) { gymUserView.branch = branchName; renderAll(); }
function setGymUserRole(role) { gymUserView.role = role; renderAll(); }
function setGymUserQ(q) {
  gymUserView.q = q;
  const main = document.getElementById('main-content');
  const scroll = main ? main.scrollTop : 0;
  renderAll();
  if (main) main.scrollTop = scroll;
  const input = main ? main.querySelector('input[placeholder="Search this gym…"]') : null;
  if (input) { input.focus(); input.setSelectionRange(q.length, q.length); }
}

function openBranchEditor(gymId) {
  const gym = getGym(gymId);
  if (!gym) return;
  const plan = getPlan(gym.planId);
  const atLimit = plan.branchLimit && gym.branchList.length >= plan.branchLimit;
  openModal({
    title: 'Add branch',
    subtitle: `${esc(gym.name)} — ${esc(gym.location)} · ${plan.name} allows ${plan.branchLimit || 'unlimited'} branches`,
    width: 'max-w-md',
    body: atLimit
      ? `<div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p class="text-[11px] text-amber-800 leading-relaxed">This gym already uses all <strong class="font-semibold">${plan.branchLimit}</strong> branches on the ${plan.name} plan. Upgrade the plan before adding another branch.</p>
        </div>`
      : `<div class="space-y-2.5">
          <div><label class="form-label">Branch name <span class="text-red-500">*</span></label>
            <input class="form-input" id="br-name" placeholder="e.g. Smouha"></div>
          <div class="grid grid-cols-2 gap-2">
            <div><label class="form-label">Area</label><input class="form-input" id="br-area" placeholder="e.g. Smouha"></div>
            <div><label class="form-label">Phone</label><input class="form-input" id="br-phone" placeholder="+20 100 000 0000"></div>
          </div>
          <div><label class="form-label">Address</label><input class="form-input" id="br-address" placeholder="Street, district"></div>
          <div><label class="form-label">Branch manager</label><input class="form-input" id="br-manager" placeholder="e.g. Hany Darwish"></div>
        </div>`,
    footer: atLimit
      ? `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>
         <button onclick="closeModal();openChangePlan('${gym.id}')" class="btn btn-sm btn-primary">Change plan</button>`
      : `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
         <button onclick="saveBranch('${gym.id}')" class="btn btn-sm btn-primary">Add branch</button>`,
  });
}

function saveBranch(gymId) {
  const gym = getGym(gymId);
  if (!gym) return;
  const name = ((document.getElementById('br-name') || {}).value || '').trim();
  if (!name) { toast('Branch name is required', 'error'); return; }
  if (gym.branchList.some((b) => b.name.toLowerCase() === name.toLowerCase())) { toast('That branch already exists', 'error'); return; }

  const area = ((document.getElementById('br-area') || {}).value || '').trim() || gym.location;
  const phone = ((document.getElementById('br-phone') || {}).value || '').trim() || '—';
  const address = ((document.getElementById('br-address') || {}).value || '').trim() || '—';
  const manager = ((document.getElementById('br-manager') || {}).value || '').trim() || 'Unassigned';
  const code = `${gym.code}-${gym.branchList.length + 1}`;

  gym.branchList.push({ code, name, area, address, phone, manager });
  gym.branches = gym.branchList.length;

  logAudit({
    gymId: gym.id, category: 'Gym', severity: 'info', action: 'Added branch',
    target: `${name} · ${gymLabel(gym)}`,
    detail: `Branch ${code} created. Account now runs ${gym.branches} branches.`,
  });
  closeModal();
  state.gymTab = 'branches';
  renderAll();
  toast(`${name} added to ${gym.name}`, 'success');
}

function gymHrStaffTab(gym, hrStaff) {
  const rows = hrStaff.map((u) => {
    const gyms = gymsForUser(u);
    return `<tr class="is-clickable" onclick="navigateTo('user-detail',{userId:'${u.id}'})">
      <td>
        <div class="flex items-center gap-2">
          ${avatarHtml(u, 28)}
          <div class="min-w-0">
            <p class="text-xs font-semibold text-charcoal-800 truncate leading-tight">${esc(u.name)}</p>
            <p class="text-[10px] text-charcoal-500 truncate leading-tight">${esc(u.email)}</p>
          </div>
        </div>
      </td>
      <td class="min-w-0">
        <span class="block text-[11px] text-charcoal-700 truncate max-w-[220px]">${gyms.map((g) => esc(g.name + ' — ' + g.location)).join(', ')}</span>
        <p class="text-[9px] text-charcoal-400">${gyms.length} gym${gyms.length === 1 ? '' : 's'} assigned</p>
      </td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-600">${esc(u.branch || '—')}</td>
      <td>${statusBadge(u.status)}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-500">${u.lastLogin ? relativeTime(u.lastLogin) : 'Never'}</td>
      <td class="text-right whitespace-nowrap">
        <button onclick="event.stopPropagation();navigateTo('user-detail',{userId:'${u.id}'})" class="btn btn-sm btn-ghost text-brand-700">View</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="card">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">HR staff with access to this gym</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">HR Managers already reach every gym. Only HR staff need assigning — and one person can hold several gyms.</p>
      </div>
      <button onclick="openAssignHR('${gym.id}')" class="btn btn-primary btn-sm">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Assign HR staff
      </button>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Person</th><th>Gym access</th><th>Primary branch</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6">${emptyState('No HR staff assigned to this gym', 'Assign an HR account so this gym has operational cover.')}</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

function openAssignHR(gymId) {
  const gym = getGym(gymId);
  if (!gym) return;
  const hrStaff = USERS.filter((u) => u.role === 'HR');
  openModal({
    title: 'Assign HR staff',
    subtitle: `${gym.name} — ${gym.location} · one person can hold several gyms`,
    width: 'max-w-lg',
    body: `<div id="assign-hr-list" class="border border-charcoal-200 rounded-lg px-2.5 py-2 max-h-[46vh] overflow-y-auto">
        ${hrStaff.map((u) => `<label class="form-check py-0.5">
          <input type="checkbox" value="${u.id}" ${(u.gymIds || []).includes(gymId) ? 'checked' : ''}>
          <span class="text-[10px] leading-snug flex-1 min-w-0">${esc(u.name)}
            <span class="block text-[9px] text-charcoal-400">${esc(u.email)} · currently in ${(u.gymIds || []).length} gym${(u.gymIds || []).length === 1 ? '' : 's'}</span>
          </span>
        </label>`).join('')}
      </div>
      <p class="text-[10px] text-charcoal-400 mt-2">Removing a person revokes their access to this gym only; other gyms are untouched. Every change is logged as a User event.</p>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="saveHrAssignment('${gymId}')" class="btn btn-sm btn-primary">Save assignment</button>`,
  });
}

function saveHrAssignment(gymId) {
  const gym = getGym(gymId);
  if (!gym) return;
  const boxes = Array.from(document.querySelectorAll('#assign-hr-list input[type="checkbox"]'));
  const selected = boxes.filter((b) => b.checked).map((b) => b.value);
  let added = 0;
  let removed = 0;

  USERS.filter((u) => u.role === 'HR').forEach((u) => {
    const ids = u.gymIds || [];
    const has = ids.includes(gymId);
    const should = selected.includes(u.id);
    if (should && !has) {
      u.gymIds = ids.concat([gymId]);
      added += 1;
      logAudit({
        gymId, category: 'User', severity: 'info', action: 'Assigned HR to gym',
        target: `${u.name} · ${gymLabel(gym)}`,
        detail: `HR access granted. Account now covers ${u.gymIds.length} gym${u.gymIds.length === 1 ? '' : 's'}.`,
      });
    } else if (!should && has) {
      u.gymIds = ids.filter((id) => id !== gymId);
      removed += 1;
      logAudit({
        gymId, category: 'User', severity: 'warning', action: 'Removed HR from gym',
        target: `${u.name} · ${gymLabel(gym)}`,
        detail: `HR access revoked for this gym. Account still covers ${u.gymIds.length} gym${u.gymIds.length === 1 ? '' : 's'}.`,
      });
    }
  });

  closeModal();
  renderAll();
  toast(`HR assignment saved — ${added} added, ${removed} removed`, 'success');
}

function gymBillingTab(gym, plan, invoices) {
  const rows = invoices.map((inv) => `<tr>
      <td class="font-medium text-charcoal-800">${esc(inv.id)}</td>
      <td>${esc(inv.period)}</td>
      <td>${inv.amount ? formatMoney(inv.amount) : '<span class="text-charcoal-400">Trial</span>'}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-500">${formatDate(inv.issued)}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-500">${inv.paid ? formatDate(inv.paid) : '—'}</td>
      <td>${inv.status === 'Paid' ? '<span class="badge badge-green">Paid</span>' : inv.status === 'Overdue' ? '<span class="badge badge-red">Overdue</span>' : '<span class="badge badge-blue">Trial</span>'}</td>
    </tr>`).join('');

  return `<div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
    <div class="xl:col-span-2 space-y-3">
      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Invoices</p>
          <button onclick="toast('Invoice export queued — prototype only','info')" class="btn btn-sm btn-secondary">Export</button></div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Invoice</th><th>Period</th><th>Amount</th><th>Issued</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6">${emptyState('No invoices yet')}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Current plan</p>${planBadge(gym.planId)}</div>
        <div class="px-3 py-2.5">
          <p class="text-lg font-bold text-charcoal-900">${gym.mrr ? formatMoney(gym.mrr) : 'Trial'}<span class="text-[10px] font-medium text-charcoal-400">${gym.mrr ? ' / month' : ''}</span></p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${esc(plan.tagline)}</p>
          <div class="mt-2 space-y-1">
            ${plan.features.map((f) => `<div class="flex items-start gap-1.5 text-[10px] text-charcoal-600">
              <svg class="w-2.5 h-2.5 text-brand-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
              ${esc(f)}
            </div>`).join('')}
          </div>
          <button onclick="openChangePlan('${gym.id}')" class="btn btn-secondary btn-sm w-full mt-2.5">Change plan</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Seats</p></div>
        <div class="px-3 py-2.5">
          <div class="flex items-end justify-between mb-1">
            <p class="text-lg font-bold text-charcoal-900">${formatNumber(gym.userCounts.total)}</p>
            <p class="text-[10px] text-charcoal-500">${gym.seatLimit ? 'of ' + gym.seatLimit + ' seats' : 'unlimited'}</p>
          </div>
          ${meterHtml(gym.userCounts.total, gym.seatLimit || gym.userCounts.total, gym.seatLimit && gym.userCounts.total / gym.seatLimit >= 0.9 ? 'amber' : '')}
          <p class="text-[10px] text-charcoal-500 mt-1.5">${gym.seatLimit ? `${Math.max(0, gym.seatLimit - gym.userCounts.total)} seats remaining` : 'No seat cap on Enterprise'}</p>
        </div>
      </div>
    </div>
  </div>`;
}

function gymAuditTab(gym, audit) {
  return `<div class="card">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Audit trail · ${esc(gym.name)} — ${esc(gym.location)}</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Every action recorded inside this gym, including your own Super Admin sessions.</p>
      </div>
      <button onclick="navigateTo('audit')" class="btn btn-sm btn-secondary">Platform audit →</button>
    </div>
    ${auditTableHtml(audit, { showGym: false })}
  </div>`;
}

// ==================== GYM ACTIONS ====================
function toggleGymStatus(gymId) {
  const gym = getGym(gymId);
  if (!gym) return;
  const suspending = gym.status !== 'Suspended';
  openModal({
    title: suspending ? 'Suspend this gym account?' : 'Restore this gym account?',
    width: 'max-w-md',
    body: `<p class="text-xs text-charcoal-600 leading-relaxed">${suspending
      ? `<strong class="font-semibold">${esc(gym.name)} — ${esc(gym.location)}</strong> will lose sign-in and payroll access immediately. No data is deleted — the account can be restored at any time.`
      : `<strong class="font-semibold">${esc(gym.name)} — ${esc(gym.location)}</strong> will regain full workspace access for every user on the account.`}</p>
      <p class="text-[10px] text-charcoal-400 mt-2">This action is written to the platform audit trail.</p>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="confirmGymStatus('${gym.id}')" class="btn btn-sm ${suspending ? 'btn-danger' : 'btn-success'}">${suspending ? 'Suspend account' : 'Restore account'}</button>`,
  });
}

function confirmGymStatus(gymId) {
  const gym = getGym(gymId);
  if (!gym) return;
  const suspending = gym.status !== 'Suspended';
  gym.status = suspending ? 'Suspended' : 'Active';
  logAudit({
    gymId, category: 'Gym', severity: suspending ? 'warning' : 'info',
    action: suspending ? 'Suspended gym account' : 'Restored gym account',
    target: gymLabel(gym),
    detail: suspending ? 'Account suspended from the Super Admin console. Sign-in and payroll blocked.' : 'Account restored to Active.',
  });
  closeModal();
  renderAll();
  toast(`${gym.name} — ${gym.location} ${suspending ? 'suspended' : 'restored'}`, suspending ? 'error' : 'success');
}

function openChangePlan(gymId) {
  const gym = getGym(gymId);
  if (!gym) return;
  const cards = PLANS.map((p) => `<button class="plan-card ${gym.planId === p.id ? 'selected' : ''}" onclick="confirmChangePlan('${gym.id}','${p.id}')">
      <div class="flex items-center justify-between">
        <p class="text-xs font-bold text-charcoal-900">${p.name}</p>
        <p class="text-[11px] font-semibold text-charcoal-700">${formatMoney(p.price)}<span class="text-[9px] font-normal text-charcoal-400">/mo</span></p>
      </div>
      <p class="text-[10px] text-charcoal-500 mt-0.5">${esc(p.tagline)}</p>
      <p class="text-[9px] text-charcoal-400 mt-1">${p.seatLimit ? p.seatLimit + ' seats' : 'Unlimited seats'} · ${p.branchLimit ? p.branchLimit + ' branch' + (p.branchLimit > 1 ? 'es' : '') : 'Unlimited branches'}</p>
    </button>`).join('');
  openModal({
    title: 'Change subscription plan',
    subtitle: `${esc(gym.name)} — ${esc(gym.location)} · currently ${getPlan(gym.planId).name}`,
    width: 'max-w-lg',
    body: `<div class="space-y-1.5">${cards}</div>
      <p class="text-[10px] text-charcoal-400 mt-2">Plan changes are logged as a Billing event and take effect immediately in the prototype.</p>`,
    footer: '<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>',
  });
}

function confirmChangePlan(gymId, planId) {
  const gym = getGym(gymId);
  const plan = getPlan(planId);
  if (!gym) return;
  const before = getPlan(gym.planId).name;
  gym.planId = planId;
  gym.seatLimit = plan.seatLimit;
  gym.mrr = gym.status === 'Trial' ? 0 : plan.price;
  logAudit({
    gymId, category: 'Billing', severity: 'info', action: 'Changed subscription plan',
    target: `${gymLabel(gym)} · ${before} → ${plan.name}`,
    detail: `Plan changed from ${before} to ${plan.name}. Monthly value is now ${formatMoney(gym.mrr)}.`,
  });
  closeModal();
  renderAll();
  toast(`${gym.name} moved to ${plan.name}`, 'success');
}

function openResetPassword(userId) {
  const user = USERS.find((u) => u.id === userId);
  if (!user) return;
  openModal({
    title: 'Reset password',
    subtitle: `${esc(user.name)} · ${esc(user.email)}`,
    width: 'max-w-md',
    body: `<p class="text-xs text-charcoal-600 leading-relaxed">A one-time reset link will be emailed to <strong class="font-semibold">${esc(user.email)}</strong>. The user must set a new password before their next sign-in.</p>
      <p class="text-[10px] text-charcoal-400 mt-3">The user is signed out of every device and must set a new password at next sign-in.</p>
      <label class="form-check mt-1.5"><input type="checkbox" checked> Revoke all active sessions now</label>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="confirmResetPassword('${user.id}')" class="btn btn-sm btn-primary">Send reset link</button>`,
  });
}

function confirmResetPassword(userId) {
  const user = USERS.find((u) => u.id === userId);
  if (!user) return;
  logAudit({
    gymId: user.gymId, category: 'Access', severity: 'warning', action: 'Reset user password',
    target: `${user.name} · ${user.gymName}`,
    detail: 'Temporary password issued by a Super Admin. Forced change at next sign-in; active sessions revoked.',
  });
  closeModal();
  renderAll();
  toast(`Reset link sent to ${user.email}`, 'success');
}

// ==================== CREATE GYM WIZARD ====================
const WIZARD_STEPS = ['Gym details', 'Subscription', 'HR access', 'Review'];

function startGymWizard() {
  state.wizard = {
    step: 0,
    data: {
      name: '', location: '', city: '', email: '', phone: '', logoUrl: null,
      planId: 'growth', billingCycle: 'Monthly', trial: true,
      hrIds: [], decideLater: false,
    },
  };
  renderGymWizard();
}

function wizardSet(field, value) {
  if (!state.wizard) return;
  state.wizard.data[field] = value;
}

function wizardToggleHr(userId, checked) {
  if (!state.wizard) return;
  const ids = state.wizard.data.hrIds;
  const i = ids.indexOf(userId);
  if (checked && i < 0) ids.push(userId);
  if (!checked && i >= 0) ids.splice(i, 1);
  wizardUpdateHrCount();
}

function wizardUpdateHrCount() {
  const el = document.getElementById('wz-hr-count');
  if (el && state.wizard) el.textContent = `· ${state.wizard.data.hrIds.length} selected`;
}

function wizardToggleHrRow(row, userId) {
  const box = row.querySelector('input[type="checkbox"]');
  if (!box) return;
  box.checked = !box.checked;
  wizardToggleHr(userId, box.checked);
}

function wizardFilterHr(q) {
  const term = (q || '').toLowerCase();
  document.querySelectorAll('#wz-hr-body tr').forEach((tr) => {
    tr.style.display = !term || (tr.dataset.search || '').indexOf(term) >= 0 ? '' : 'none';
  });
}

function wizardSetDecideLater(checked) {
  if (!state.wizard) return;
  state.wizard.data.decideLater = checked;
  if (checked) state.wizard.data.hrIds = [];
  const picker = document.getElementById('wz-hr-picker');
  if (picker) picker.style.display = checked ? 'none' : '';
  document.querySelectorAll('#wz-hr-body input[type="checkbox"]').forEach((b) => { b.checked = false; });
  wizardUpdateHrCount();
}

function wizardLogo(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) { toast('Choose an image file', 'error'); return; }
  const reader = new FileReader();
  reader.onload = () => { wizardSet('logoUrl', reader.result); renderGymWizard(); };
  reader.readAsDataURL(file);
}

function wizardClearLogo() {
  wizardSet('logoUrl', null);
  renderGymWizard();
}

function renderGymWizard() {
  if (!state.wizard) return;
  const w = state.wizard;
  const d = w.data;
  const stepper = WIZARD_STEPS.map((label, i) => `
    <div class="step ${i === w.step ? 'active' : i < w.step ? 'done' : ''}">
      <span class="step-dot">${i < w.step ? '✓' : i + 1}</span>
      <span class="hidden sm:inline">${esc(label)}</span>
    </div>${i < WIZARD_STEPS.length - 1 ? '<span class="step-line"></span>' : ''}`).join('');

  let body = '';
  let footer = '';

  if (w.step === 0) {
    const preview = d.logoUrl
      ? `<span class="gym-logo gym-logo-44" style="background-image:url('${d.logoUrl}');background-size:cover;background-position:center;color:transparent">.</span>`
      : `<span class="gym-logo gym-logo-44">${esc(initialsOf(d.name || 'Gym'))}</span>`;
    body = `<div class="space-y-2.5">
      <div class="flex items-center gap-2.5">
        ${preview}
        <div class="flex-1 min-w-0">
          <label class="form-label">Gym logo</label>
          <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" class="form-input" onchange="wizardLogo(this)" aria-label="Upload gym logo">
          <p class="form-hint">Square PNG, JPG or SVG. Falls back to the gym initials.</p>
        </div>
        ${d.logoUrl ? '<button type="button" onclick="wizardClearLogo()" class="btn btn-sm btn-ghost text-charcoal-500 flex-shrink-0">Remove</button>' : ''}
      </div>
      <div><label class="form-label">Gym name <span class="text-red-500">*</span></label>
        <input class="form-input" id="wz-name" placeholder="e.g. Iron House Gym" value="${esc(d.name)}" oninput="wizardSet('name',this.value)"></div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="form-label">Branch / area <span class="text-red-500">*</span></label>
          <input class="form-input" placeholder="e.g. Smouha" value="${esc(d.location)}" oninput="wizardSet('location',this.value)"></div>
        <div><label class="form-label">City</label>
          <input class="form-input" placeholder="e.g. Alexandria" value="${esc(d.city)}" oninput="wizardSet('city',this.value)"></div>
      </div>
      <div><label class="form-label">Billing contact email <span class="text-red-500">*</span></label>
        <input class="form-input" type="email" placeholder="accounts@gym.com" value="${esc(d.email)}" oninput="wizardSet('email',this.value)"></div>
      <div><label class="form-label">Contact phone</label>
        <input class="form-input" placeholder="+20 100 000 0000" value="${esc(d.phone)}" oninput="wizardSet('phone',this.value)"></div>
      <p class="form-hint">The account starts empty. You can assign HR staff in step 3 — they add everyone else.</p>
    </div>`;
    footer = `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="wizardNext()" class="btn btn-sm btn-primary">Continue</button>`;
  }

  if (w.step === 1) {
    const planCards = PLANS.map((p) => `<button class="plan-card ${d.planId === p.id ? 'selected' : ''}" onclick="wizardPlan('${p.id}')">
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold text-charcoal-900">${p.name}</p>
          <p class="text-[11px] font-semibold text-charcoal-700">${formatMoney(p.price)}<span class="text-[9px] font-normal text-charcoal-400">${cycleLabel(p)}</span></p>
        </div>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${esc(p.tagline)}</p>
        <p class="text-[9px] text-charcoal-400 mt-1">${p.seatLimit ? p.seatLimit + ' seats' : 'Unlimited seats'} · ${p.branchLimit ? p.branchLimit + ' branch' + (p.branchLimit > 1 ? 'es' : '') : 'Unlimited branches'}</p>
      </button>`).join('');

    body = `<div class="space-y-1.5 mb-2.5">${planCards}</div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="form-label">Billing cycle</label>
          <select class="form-select" onchange="wizardSet('billingCycle',this.value)">
            <option${d.billingCycle === 'Monthly' ? ' selected' : ''}>Monthly</option>
            <option${d.billingCycle === 'Annual' ? ' selected' : ''}>Annual</option>
          </select></div>
        <div><label class="form-label">Start date</label>
          <input class="form-input" value="${formatDate(PLATFORM.today)}" disabled></div>
      </div>
      <label class="form-check mt-2.5"><input type="checkbox" ${d.trial ? 'checked' : ''} onchange="wizardSet('trial',this.checked);renderGymWizard()"> Start with a 14-day free trial</label>
      <div class="rounded-lg bg-charcoal-50 border border-charcoal-200 px-3 py-2 mt-2.5 flex items-center justify-between">
        <span class="text-[10px] text-charcoal-500">${d.trial ? 'Trial — no charge for 14 days' : 'Monthly recurring'}</span>
        <span class="text-xs font-bold text-charcoal-800">${d.trial ? 'EGP 0' : formatMoney(getPlan(d.planId).price)}</span>
      </div>`;
    footer = `<button onclick="wizardBack()" class="btn btn-sm btn-secondary">Back</button>
      <button onclick="wizardNext()" class="btn btn-sm btn-primary">Continue</button>`;
  }

  if (w.step === 2) {
    const hrStaff = USERS.filter((u) => u.role === 'HR');
    const candidateRows = hrStaff.map((u) => {
      const home = getGym(u.gymId);
      const gymCount = (u.gymIds || []).length;
      const search = `${u.name} ${u.email} ${home ? home.name + ' ' + home.location : ''} ${u.branch || ''}`.toLowerCase();
      return `<tr class="is-clickable" data-search="${esc(search)}" onclick="wizardToggleHrRow(this,'${u.id}')">
        <td class="w-6">
          <input type="checkbox" value="${u.id}" ${d.hrIds.includes(u.id) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="wizardToggleHr('${u.id}',this.checked)" aria-label="Assign ${esc(u.name)}">
        </td>
        <td class="min-w-0">
          <div class="flex items-center gap-1.5">
            ${avatarHtml(u, 24)}
            <div class="min-w-0">
              <p class="text-[11px] font-semibold text-charcoal-800 truncate leading-tight">${esc(u.name)}</p>
              <p class="text-[9px] text-charcoal-400 truncate leading-tight">${esc(u.email)}</p>
            </div>
          </div>
        </td>
        <td class="min-w-0">
          <span class="block text-[10px] text-charcoal-600 truncate max-w-[150px]">${esc(home ? home.name + ' — ' + home.location : 'No home gym')}</span>
          <p class="text-[9px] text-charcoal-400 truncate max-w-[150px]">${esc(u.branch || '—')}</p>
        </td>
        <td class="whitespace-nowrap"><span class="badge ${gymCount > 1 ? 'badge-purple' : 'badge-gray'}">${gymCount} gym${gymCount === 1 ? '' : 's'}</span></td>
        <td>${statusBadge(u.status)}</td>
        <td class="whitespace-nowrap text-[10px] text-charcoal-500">${u.lastLogin ? relativeTime(u.lastLogin) : 'Never'}</td>
      </tr>`;
    }).join('');

    body = `<div class="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 mb-2.5">
        <p class="text-[10px] text-brand-800 leading-relaxed">HR Managers already reach every gym account. Only <strong class="font-semibold">HR staff</strong> are assigned to gyms, and one person can hold several. <strong class="font-semibold">This step is optional</strong> — an HR Manager can decide and assign the right people later from the gym account.</p>
      </div>
      <label class="form-check mb-2"><input type="checkbox" ${d.decideLater ? 'checked' : ''} onchange="wizardSetDecideLater(this.checked)"> Decide later — leave HR assignment to an HR Manager</label>
      <div id="wz-hr-picker" style="${d.decideLater ? 'display:none' : ''}">
        <div class="rounded-lg border border-charcoal-200 overflow-hidden">
          <div class="px-2.5 py-1.5 border-b border-charcoal-200 flex items-center gap-2">
            <p class="text-[9px] font-bold uppercase tracking-wider text-charcoal-400 flex-1">Candidates <span id="wz-hr-count" class="text-charcoal-600 normal-case font-semibold">· ${d.hrIds.length} selected</span></p>
            <input class="form-input form-input-sm w-40" placeholder="Filter name or gym…" oninput="wizardFilterHr(this.value)" aria-label="Filter HR candidates">
          </div>
          <div class="max-h-[32vh] overflow-y-auto">
            <table class="data-table">
              <thead><tr><th class="w-6"></th><th>Person</th><th>Home gym</th><th>Gyms</th><th>Status</th><th>Last sign-in</th></tr></thead>
              <tbody id="wz-hr-body">${candidateRows}</tbody>
            </table>
          </div>
        </div>
        <p class="form-hint">Pick who should cover this gym now, or skip it — nothing is assigned unless you tick someone.</p>
      </div>`;
    footer = `<button onclick="wizardBack()" class="btn btn-sm btn-secondary">Back</button>
      <button onclick="wizardNext()" class="btn btn-sm btn-primary">Review</button>`;
  }

  if (w.step === 3) {
    const plan = getPlan(d.planId);
    const assigned = USERS.filter((u) => d.hrIds.includes(u.id)).map((u) => u.name);
    body = `<dl class="text-[11px] divide-soft">
        ${[
          ['Gym', `${d.name || '—'} — ${d.location || '—'}${d.city ? ', ' + d.city : ''}`],
          ['Logo', d.logoUrl ? 'Uploaded' : 'Initials'],
          ['Billing contact', d.email || '—'],
          ['Phone', d.phone || '—'],
          ['Plan', `${plan.name} · ${d.trial ? '14-day trial' : formatMoney(plan.price) + '/month'}`],
          ['Billing cycle', d.billingCycle],
          ['Seat limit', plan.seatLimit ? plan.seatLimit + ' seats' : 'Unlimited'],
          ['HR staff', d.decideLater ? 'Left to an HR Manager' : (assigned.length ? assigned.join(', ') : 'None assigned')],
        ].map(([k, v]) => `<div class="flex justify-between gap-3 py-1.5">
          <dt class="text-charcoal-500">${esc(k)}</dt>
          <dd class="font-semibold text-charcoal-800 text-right">${esc(v)}</dd></div>`).join('')}
      </dl>
      <p class="text-[10px] text-charcoal-400 mt-2">Creating the account writes a Gym event to the platform audit trail${assigned.length ? ', plus one User event per assigned HR staff member' : ''}. HR assignment can be done later from the gym's HR staff tab.</p>`;
    footer = `<button onclick="wizardBack()" class="btn btn-sm btn-secondary">Back</button>
      <button onclick="submitGymWizard()" class="btn btn-sm btn-primary">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        Create gym account
      </button>`;
  }

  updateModal({
    title: 'Create gym account',
    subtitle: 'Provision a tenant, its subscription and its HR access in one flow',
    width: 'max-w-2xl',
    body: `<div class="stepper mb-3 flex-wrap gap-y-1.5">${stepper}</div>${body}`,
    footer,
  });
}

function wizardPlan(planId) {
  wizardSet('planId', planId);
  renderGymWizard();
}

function wizardBack() {
  if (!state.wizard) return;
  state.wizard.step = Math.max(0, state.wizard.step - 1);
  renderGymWizard();
}

function wizardNext() {
  if (!state.wizard) return;
  const d = state.wizard.data;
  if (state.wizard.step === 0) {
    if (!d.name.trim() || !d.location.trim() || !d.email.trim()) {
      toast('Gym name, branch and billing email are required', 'error');
      return;
    }
  }
  state.wizard.step = Math.min(WIZARD_STEPS.length - 1, state.wizard.step + 1);
  renderGymWizard();
}

function submitGymWizard() {
  const d = state.wizard.data;
  const plan = getPlan(d.planId);
  const id = 'gym-' + (GYMS.length + 1);
  const initials = (d.name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'GY');
  const code = initials + '-' + (d.location.slice(0, 2).toUpperCase() || 'NA');
  const domain = (d.email.split('@')[1] || 'gym.com').toLowerCase();
  const renews = new Date(new Date(PLATFORM.today).getTime() + (d.trial ? 14 : 365) * 86400000).toISOString().slice(0, 10);
  const assignedHr = d.decideLater ? [] : USERS.filter((u) => d.hrIds.includes(u.id));

  const gym = {
    id, code, name: d.name.trim(), location: d.location.trim(), city: d.city.trim() || '—',
    logo: initials, logoUrl: d.logoUrl || null, domain,
    status: d.trial ? 'Trial' : 'Active', planId: d.planId,
    seatLimit: plan.seatLimit, branches: 1,
    branchList: [{ code: code + '-1', name: `${d.location.trim()} Club`, area: d.location.trim(), address: '—', phone: d.phone.trim() || '—', manager: assignedHr.length ? assignedHr[0].name : 'Unassigned' }],
    subscribedOn: PLATFORM.today.slice(0, 10), renewsOn: renews,
    billingCycle: d.trial ? 'Trial · 14 days' : d.billingCycle,
    mrr: d.trial ? 0 : plan.price,
    contact: { name: assignedHr.length ? assignedHr[0].name : 'Unassigned', email: d.email.trim(), phone: d.phone.trim() || '—' },
    health: 70, attendanceRate: 0, payrollStatus: 'Not started',
    lastActivity: PLATFORM.today,
    userCounts: { total: 0, hrManager: 0, hr: 0, branchManager: 0, teamLeader: 0, employee: 0 },
    activity: new Array(14).fill(0),
  };
  GYMS.unshift(gym);

  assignedHr.forEach((u) => {
    u.gymIds = (u.gymIds || []).concat([id]);
    logAudit({
      gymId: id, category: 'User', severity: 'info', action: 'Assigned HR to gym',
      target: `${u.name} · ${gymLabel(gym)}`,
      detail: `HR access granted. Account now covers ${u.gymIds.length} gym${u.gymIds.length === 1 ? '' : 's'}.`,
    });
  });

  logAudit({
    gymId: id, category: 'Gym', severity: 'info', action: 'Created gym account',
    target: gymLabel(gym),
    detail: `Provisioned on ${plan.name}${d.trial ? ' (14-day trial)' : ' at ' + formatMoney(plan.price) + '/month'}. Seat limit ${plan.seatLimit || 'unlimited'}. ${assignedHr.length} HR staff assigned.`,
  });

  state.wizard = null;
  state.activeGymId = id;
  state.gymTab = 'overview';
  state.currentPage = 'gym-detail';
  renderAll();
  toast(`${gym.name} created${assignedHr.length ? ` with ${assignedHr.length} HR staff assigned` : ''}`, 'success');
}
