// ==================== PAYROLL ====================
let _payExpanded = null; // track which month card is expanded

function _payBarWidth(amount, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((Math.abs(amount) / max) * 100));
}

function _payItemIcon(icon, color) {
  const colorMap = {
    brand: 'bg-brand-100 text-brand-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    blue: 'bg-blue-100 text-blue-600',
    red: 'bg-red-100 text-red-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  const cls = colorMap[color] || 'bg-charcoal-100 text-charcoal-600';
  return `<span class="inline-flex items-center justify-center w-7 h-7 rounded-lg ${cls}"><span class="material-icons text-sm">${icon || 'label'}</span></span>`;
}

function renderPayroll() {
  const current = MOCK.payroll.find(p => p.id === 'p1');
  const history = MOCK.payroll.filter(p => p.visible);
  const totalNet = history.reduce((s, p) => s + p.netSalary, 0);
  const totalEarn = history.reduce((s, p) => s + p.grossEarnings, 0);
  const totalDed = history.reduce((s, p) => s + p.totalDeductions, 0);
  const avgNet = history.length ? Math.round(totalNet / history.length) : 0;

  // Current period processing card
  let currentCard = '';
  if (current) {
    currentCard = `
      <div class="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-brand-50/50 p-5">
        <div class="absolute top-0 right-0 w-28 h-28 bg-brand-100/40 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div class="relative flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center shadow-md shadow-brand-200 flex-shrink-0">
            <span class="material-icons text-white text-2xl">pending</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Current Period</p>
            <p class="text-lg font-bold text-charcoal-900 mt-0.5">${current.period}</p>
            <div class="flex items-center gap-2 mt-1.5">
              ${statusBadge('Processing')}
              <span class="text-[10px] text-charcoal-400">· Payout pending</span>
            </div>
          </div>
          <div class="text-right flex-shrink-0 hidden sm:block">
            <div class="w-24 h-2.5 bg-brand-100 rounded-full overflow-hidden">
              <div class="h-full bg-brand-400 rounded-full animate-pulse" style="width:65%"></div>
            </div>
            <p class="text-[10px] text-charcoal-400 mt-1.5">Being processed...</p>
          </div>
        </div>
      </div>`;
  }

  // Contract & leave overview (latest paid period)
  const ref = history[0];
  let refCard = '';
  if (ref) {
    const annualInc = ref.annualIncrease || 0;
    const contractSal = ref.baseSalary + annualInc;
    const attPct = Math.round((ref.workedDays / ref.workingDays) * 100);
    const leaveUsed = ref.usedAnnualLeave || 0;
    const leaveRem = ref.remainingAnnualLeave || 0;
    const leaveTotal = leaveUsed + leaveRem;
    const leavePct = leaveTotal ? Math.round((leaveUsed / leaveTotal) * 100) : 0;
    refCard = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <!-- Salary & Schedule -->
        <div class="bg-white rounded-2xl border border-charcoal-100/80 shadow-sm p-4">
          <div class="flex items-center justify-between mb-3">
            <p class="bento-label text-charcoal-500">SALARY & SCHEDULE</p>
            <span class="text-[10px] font-semibold text-charcoal-400">${ref.period}</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs text-charcoal-600">
                <span class="material-icons text-[16px] text-charcoal-400">payments</span>Basic Salary
              </div>
              <span class="text-xs font-bold text-charcoal-900">EGP ${ref.baseSalary.toLocaleString()}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-xs text-charcoal-600">
                <span class="material-icons text-[16px] text-green-500">trending_up</span>Annual Increase (10%)
              </div>
              <span class="text-xs font-bold text-green-600">+EGP ${annualInc.toLocaleString()}</span>
            </div>
            <div class="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg px-2.5 py-2">
              <p class="text-xs font-bold text-brand-700">Contractual Salary / month</p>
              <p class="text-sm font-bold text-brand-700">EGP ${contractSal.toLocaleString()}</p>
            </div>
            <div class="grid grid-cols-4 gap-2 text-center pt-1">
              <div class="bg-charcoal-50 rounded-lg p-2">
                <p class="text-sm font-bold text-charcoal-900">${ref.workingDays}</p>
                <p class="text-[9px] text-charcoal-500 leading-tight mt-0.5">Scheduled Work Days</p>
              </div>
              <div class="bg-charcoal-50 rounded-lg p-2">
                <p class="text-sm font-bold text-charcoal-900">${ref.scheduledWeeklyDays || 6}</p>
                <p class="text-[9px] text-charcoal-500 leading-tight mt-0.5">Weekly Days</p>
              </div>
              <div class="bg-charcoal-50 rounded-lg p-2">
                <p class="text-sm font-bold text-brand-700">${ref.workedDays}</p>
                <p class="text-[9px] text-charcoal-500 leading-tight mt-0.5">Attendance · ${attPct}%</p>
              </div>
              <div class="bg-charcoal-50 rounded-lg p-2">
                <p class="text-sm font-bold ${ref.overtimeHours ? 'text-blue-700' : 'text-charcoal-400'}">${ref.overtimeHours || 0}h</p>
                <p class="text-[9px] text-charcoal-500 leading-tight mt-0.5">Overtime</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Annual Leave Balance -->
        <div class="bg-white rounded-2xl border border-charcoal-100/80 shadow-sm p-4">
          <div class="flex items-center justify-between mb-3">
            <p class="bento-label text-charcoal-500">ANNUAL LEAVE BALANCE</p>
            <span class="text-[10px] font-semibold text-charcoal-400">Used ${leaveUsed} · Remaining ${leaveRem}</span>
          </div>
          <div class="flex items-end justify-between gap-3 mb-2">
            <div>
              <p class="text-2xl font-bold text-charcoal-900">${leaveUsed}<span class="text-xs text-charcoal-400 font-normal"> / ${leaveTotal} days</span></p>
              <p class="text-[10px] text-charcoal-500">Used this year</p>
            </div>
            <div class="text-right">
              <p class="text-2xl font-bold text-brand-700">${leaveRem}</p>
              <p class="text-[10px] text-charcoal-500">Remaining</p>
            </div>
          </div>
          <div class="w-full h-2.5 bg-charcoal-100 rounded-full overflow-hidden mb-3">
            <div class="h-full bg-brand-500 rounded-l-full transition-all" style="width:${leavePct}%"></div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-charcoal-50 rounded-lg p-2.5 text-center">
              <p class="text-sm font-bold text-charcoal-900">${leaveUsed}</p>
              <p class="text-[9px] text-charcoal-500 mt-0.5">Used</p>
            </div>
            <div class="bg-charcoal-50 rounded-lg p-2.5 text-center">
              <p class="text-sm font-bold text-brand-700">${leaveRem}</p>
              <p class="text-[9px] text-charcoal-500 mt-0.5">Remaining</p>
            </div>
            <div class="bg-charcoal-50 rounded-lg p-2.5 text-center">
              <p class="text-sm font-bold text-charcoal-900">${ref.paidLeaveDays || 0}</p>
              <p class="text-[9px] text-charcoal-500 mt-0.5">Paid Leave</p>
            </div>
          </div>
        </div>
      </div>`;
  }

  // YTD Summary bento
  const ytdBento = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl border border-charcoal-100/80 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <span class="material-icons text-brand-500 text-xl">account_balance_wallet</span>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide truncate">Earned</p>
            <p class="text-sm font-bold text-brand-700 mt-0.5 truncate">EGP ${totalEarn.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-charcoal-100/80 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <span class="material-icons text-red-400 text-xl">remove_circle</span>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide truncate">Deductions</p>
            <p class="text-sm font-bold text-red-600 mt-0.5 truncate">EGP ${totalDed.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-charcoal-100/80 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <span class="material-icons text-green-500 text-xl">savings</span>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide truncate">Net Pay</p>
            <p class="text-sm font-bold text-green-700 mt-0.5 truncate">EGP ${totalNet.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-charcoal-100/80 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <span class="material-icons text-purple-500 text-xl">trending_up</span>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide truncate">Avg / Month</p>
            <p class="text-sm font-bold text-purple-700 mt-0.5 truncate">EGP ${avgNet.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>`;

  // Monthly history cards
  const maxSalary = Math.max(...history.map(p => p.netSalary));
  let historyCards = history.map(p => {
    const earnings = p.items.filter(i => i.type === 'earning');
    const deductions = p.items.filter(i => i.type === 'deduction');
    const isExpanded = _payExpanded === p.id;
    const barPct = _payBarWidth(p.netSalary, maxSalary);
    const attendanceDed = deductions.find(d => d.isGroup);
    const attendanceCount = attendanceDed && attendanceDed.subItems ? attendanceDed.subItems.length : 0;

    return `
      <div class="bg-white rounded-2xl border border-charcoal-100/80 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
        <!-- Card Header -->
        <div class="p-4 cursor-pointer hover:bg-charcoal-50/40 transition-colors" onclick="togglePayExpand('${p.id}')">
          <!-- Row 1: Period + Amount -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="w-11 h-11 rounded-xl bg-charcoal-100/70 flex items-center justify-center flex-shrink-0">
                <span class="material-icons text-charcoal-500 text-lg">receipt_long</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold text-charcoal-900 truncate">${p.period}</p>
                <p class="text-[10px] text-charcoal-400">Paid ${formatDate(p.paidDate)}</p>
              </div>
            </div>
            <div class="flex items-center gap-2.5 flex-shrink-0">
              <span class="text-sm font-bold text-charcoal-900 whitespace-nowrap">EGP ${p.netSalary.toLocaleString()}</span>
              ${statusBadge(p.status)}
              <span class="material-icons text-charcoal-400 text-base transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}">expand_more</span>
            </div>
          </div>

          <!-- Row 2: Progress bar -->
          <div class="w-full h-2 bg-charcoal-100 rounded-full overflow-hidden mt-3">
            <div class="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500" style="width:${barPct}%"></div>
          </div>

          <!-- Row 3: Stat chips -->
          <div class="flex items-center gap-2 mt-3 flex-wrap">
            <span class="inline-flex items-center gap-1 bg-green-50 text-green-700 rounded-full px-2.5 py-1 text-[10px] font-medium">
              <span class="material-icons text-xs">add_circle</span>
              ${earnings.length} earning${earnings.length !== 1 ? 's' : ''}
            </span>
            <span class="inline-flex items-center gap-1 bg-red-50 text-red-600 rounded-full px-2.5 py-1 text-[10px] font-medium">
              <span class="material-icons text-xs">remove_circle</span>
              ${deductions.length} deduction${deductions.length !== 1 ? 's' : ''}
            </span>
            ${attendanceCount > 0 ? `<span class="inline-flex items-center gap-1 bg-orange-50 text-orange-600 rounded-full px-2.5 py-1 text-[10px] font-medium">
              <span class="material-icons text-xs">event_busy</span>
              ${attendanceCount} late/absent
            </span>` : ''}
            ${(p.overtimeHours || 0) > 0 ? `<span class="inline-flex items-center gap-1 bg-blue-50 text-blue-600 rounded-full px-2.5 py-1 text-[10px] font-medium">
              <span class="material-icons text-xs">schedule</span>
              ${p.overtimeHours}h overtime
            </span>` : ''}
            <span class="inline-flex items-center gap-1 bg-blue-50 text-blue-600 rounded-full px-2.5 py-1 text-[10px] font-medium">
              <span class="material-icons text-xs">calendar_today</span>
              ${p.workedDays}/${p.workingDays} days
            </span>
          </div>
        </div>

        <!-- Expanded detail section -->
        ${isExpanded ? `
        <div class="border-t border-charcoal-100 bg-gradient-to-b from-charcoal-50/40 to-white">
          <div class="p-4 space-y-3">
            <!-- Attendance mini-chart -->
            ${p.workingDays ? `
            <div class="bg-white rounded-xl border border-charcoal-100/80 shadow-sm p-3.5">
              <div class="flex items-center justify-between mb-2.5">
                <div class="flex items-center gap-1.5">
                  <span class="material-icons text-charcoal-400 text-sm">event_available</span>
                  <p class="bento-label text-charcoal-500">ATTENDANCE IMPACT</p>
                </div>
                <span class="text-[10px] font-bold text-charcoal-700 bg-charcoal-100/60 px-2 py-0.5 rounded-full">${p.workedDays}/${p.workingDays} days</span>
              </div>
              <div class="w-full h-3 bg-charcoal-100 rounded-full overflow-hidden flex">
                <div class="h-full bg-brand-500 rounded-l-full transition-all" style="width:${Math.round((p.workedDays/p.workingDays)*100)}%"></div>
                <div class="h-full bg-red-300 rounded-r-full transition-all" style="width:${Math.round(((p.workingDays - p.workedDays)/p.workingDays)*100)}%"></div>
              </div>
              <div class="flex items-center justify-between mt-2">
                <span class="text-[10px] text-charcoal-500 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-brand-500 inline-block"></span>${p.workedDays} days worked</span>
                <span class="text-[10px] text-red-500 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-300 inline-block"></span>${p.workingDays - p.workedDays} absent</span>
              </div>
            </div>` : ''}

            <!-- Earnings detail -->
            <div class="bg-white rounded-xl border border-charcoal-100/80 shadow-sm overflow-hidden">
              <div class="flex items-center justify-between px-4 py-2.5 bg-green-50/60 border-b border-green-100">
                <div class="flex items-center gap-1.5">
                  <span class="material-icons text-green-500 text-sm">trending_up</span>
                  <p class="text-[10px] font-bold text-green-700 uppercase tracking-wider">Earnings</p>
                </div>
                <p class="text-xs font-bold text-green-700">+EGP ${p.grossEarnings.toLocaleString()}</p>
              </div>
              <div class="divide-y divide-charcoal-50">
                ${earnings.map(e => `
                  <div class="flex items-center gap-3 px-4 py-3">
                    ${_payItemIcon(e.icon, e.color)}
                    <p class="text-xs font-medium text-charcoal-800 flex-1 min-w-0 truncate">${e.label}</p>
                    <span class="text-xs font-bold text-green-700 whitespace-nowrap">+EGP ${e.amount.toLocaleString()}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Deductions detail -->
            <div class="bg-white rounded-xl border border-charcoal-100/80 shadow-sm overflow-hidden">
              <div class="flex items-center justify-between px-4 py-2.5 bg-red-50/60 border-b border-red-100">
                <div class="flex items-center gap-1.5">
                  <span class="material-icons text-red-400 text-sm">trending_down</span>
                  <p class="text-[10px] font-bold text-red-600 uppercase tracking-wider">Deductions</p>
                </div>
                <p class="text-xs font-bold text-red-600">-EGP ${p.totalDeductions.toLocaleString()}</p>
              </div>
              <div class="divide-y divide-charcoal-50">
                ${deductions.map(d => {
                  let html = `<div class="flex items-center gap-3 px-4 py-3">
                    ${_payItemIcon(d.icon, d.color)}
                    <p class="text-xs font-medium text-charcoal-800 flex-1 min-w-0 truncate">${d.label}</p>
                    <span class="text-xs font-bold text-red-600 whitespace-nowrap">-EGP ${Math.abs(d.amount).toLocaleString()}</span>
                  </div>`;
                  if (d.isGroup && d.subItems) {
                    d.subItems.forEach(s => {
                      html += `<div class="flex items-start gap-2.5 px-4 py-2.5 pl-14 bg-orange-50/40 border-t border-orange-100/50">
                        <span class="material-icons text-orange-400 text-xs mt-0.5 flex-shrink-0">${s.icon || 'info'}</span>
                        <div class="flex-1 min-w-0">
                          <p class="text-[11px] font-medium text-charcoal-700 leading-snug">${s.label}</p>
                          ${s.detail ? `<p class="text-[10px] text-charcoal-400 mt-0.5 leading-snug">${s.detail}</p>` : ''}
                        </div>
                        <span class="text-[11px] font-semibold text-orange-600 whitespace-nowrap flex-shrink-0">-EGP ${Math.abs(s.amount).toLocaleString()}</span>
                      </div>`;
                    });
                  }
                  return html;
                }).join('')}
              </div>
            </div>

            <!-- Net salary highlight -->
            <div class="bg-gradient-to-r from-charcoal-800 to-charcoal-900 rounded-xl p-5 flex items-center justify-between shadow-lg shadow-charcoal-200/50">
              <div>
                <p class="text-[10px] font-bold text-charcoal-400 uppercase tracking-wider">Net Salary</p>
                <p class="text-2xl font-bold text-white mt-0.5">EGP ${p.netSalary.toLocaleString()}</p>
              </div>
              <button onclick="openPayDetail('${p.id}');event.stopPropagation();" class="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors backdrop-blur-sm">
                <span class="material-icons text-sm">visibility</span> Full Payslip
              </button>
            </div>
          </div>
        </div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold text-charcoal-900">My Payroll</h1>
        <p class="text-[11px] text-charcoal-400 mt-0.5">${history.length} payslip${history.length !== 1 ? 's' : ''}</p>
      </div>

      ${currentCard}

      <!-- Contract & Leave Overview -->
      ${refCard}

      <!-- YTD Summary -->
      <div>
        <p class="bento-label text-charcoal-400 mb-2.5">YEAR TO DATE</p>
        ${ytdBento}
      </div>

      <!-- Monthly History -->
      <div>
        <h2 class="text-sm font-bold text-charcoal-900 mb-3">Monthly Breakdown</h2>
        <div class="space-y-3">${historyCards}</div>
      </div>
    </div>`;
}

function togglePayExpand(id) {
  _payExpanded = _payExpanded === id ? null : id;
  renderAll();
}

function openPayDetail(id) {
  const p = MOCK.payroll.find(x => x.id === id);
  if (!p || !p.visible) return;
  const earnings = p.items.filter(i => i.type === 'earning');
  const deductions = p.items.filter(i => i.type === 'deduction');
  const attPct = p.workingDays ? Math.round((p.workedDays / p.workingDays) * 100) : 100;

  let content = `<div class="space-y-4">
    <!-- Payslip Header -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal-800 to-charcoal-900 p-5 text-white">
      <div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
      <div class="relative text-center">
        <p class="text-[10px] font-bold text-charcoal-300 uppercase tracking-wider">Payslip</p>
        <p class="text-lg font-bold mt-1">${p.period}</p>
        <div class="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10">
          <span class="material-icons text-xs text-green-400">verified</span>
          <span class="text-[10px] font-semibold text-green-300">${p.status}</span>
        </div>
      </div>
    </div>

    <!-- Employee Info -->
    <div class="bg-white rounded-xl border border-charcoal-100 p-3 flex items-center gap-3">
      <div class="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
        <span class="material-icons text-brand-600 text-lg">person</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-charcoal-900 truncate">${MOCK.currentUser.fullName}</p>
        <p class="text-[10px] text-charcoal-500">${MOCK.currentUser.id} · ${MOCK.currentUser.position}</p>
        <p class="text-[10px] text-charcoal-400">Revive Gym — ${MOCK.currentUser.gym.branch}</p>
      </div>
    </div>

    <!-- Attendance Visual -->
    ${p.workingDays ? `
    <div class="bg-white rounded-xl border border-charcoal-100 p-4">
      <p class="bento-label text-charcoal-500 mb-3">ATTENDANCE SUMMARY</p>
      <div class="grid grid-cols-3 gap-3 mb-3">
        <div class="text-center">
          <div class="w-12 h-12 rounded-full border-3 border-charcoal-200 flex items-center justify-center mx-auto bg-charcoal-50">
            <span class="text-sm font-bold text-charcoal-800">${p.workingDays}</span>
          </div>
          <p class="text-[10px] text-charcoal-500 mt-1">Total Days</p>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 rounded-full border-3 border-green-300 flex items-center justify-center mx-auto bg-green-50">
            <span class="text-sm font-bold text-green-700">${p.workedDays}</span>
          </div>
          <p class="text-[10px] text-green-600 mt-1">Worked</p>
        </div>
        <div class="text-center">
          <div class="w-12 h-12 rounded-full border-3 ${p.workingDays - p.workedDays > 0 ? 'border-red-300 bg-red-50' : 'border-charcoal-200 bg-charcoal-50'} flex items-center justify-center mx-auto">
            <span class="text-sm font-bold ${p.workingDays - p.workedDays > 0 ? 'text-red-600' : 'text-charcoal-500'}">${p.workingDays - p.workedDays}</span>
          </div>
          <p class="text-[10px] ${p.workingDays - p.workedDays > 0 ? 'text-red-500' : 'text-charcoal-500'} mt-1">Absent</p>
        </div>
      </div>
      <div class="w-full h-3 bg-charcoal-100 rounded-full overflow-hidden flex">
        <div class="h-full bg-brand-500 rounded-l-full" style="width:${attPct}%"></div>
        ${p.workingDays - p.workedDays > 0 ? `<div class="h-full bg-red-400 rounded-r-full" style="width:${100 - attPct}%"></div>` : ''}
      </div>
      <p class="text-[10px] text-charcoal-400 text-center mt-1.5">${attPct}% attendance rate</p>
    </div>` : ''}

    <!-- Salary, Schedule & Leaves -->
    <div class="bg-white rounded-xl border border-charcoal-100 p-4">
      <p class="bento-label text-charcoal-500 mb-2">SALARY, SCHEDULE & LEAVES</p>
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-charcoal-50 rounded-lg p-2.5">
          <p class="bento-label text-charcoal-400 mb-0.5">BASIC SALARY</p>
          <p class="text-sm font-bold text-charcoal-900">EGP ${(p.baseSalary || 0).toLocaleString()}</p>
        </div>
        <div class="bg-charcoal-50 rounded-lg p-2.5">
          <p class="bento-label text-charcoal-400 mb-0.5">ANNUAL INCREASE (10%)</p>
          <p class="text-sm font-bold text-green-600">+EGP ${(p.annualIncrease || 0).toLocaleString()}</p>
        </div>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <div class="bg-brand-50 border border-brand-100 rounded-lg p-2.5">
          <p class="bento-label text-brand-500 mb-0.5">CONTRACTUAL SALARY / MONTH</p>
          <p class="text-sm font-bold text-brand-700">EGP ${((p.baseSalary || 0) + (p.annualIncrease || 0)).toLocaleString()}</p>
        </div>
        <div class="bg-charcoal-50 rounded-lg p-2.5">
          <p class="bento-label text-charcoal-400 mb-0.5">SCHEDULE</p>
          <p class="text-sm font-bold text-charcoal-900">${p.workingDays} days / month · ${p.scheduledWeeklyDays || 6}/wk</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${p.weeklyPattern || 'Sun – Fri'}</p>
        </div>
      </div>
      <div class="mt-2 grid grid-cols-3 gap-2">
        <div class="bg-charcoal-50 rounded-lg p-2.5 text-center">
          <p class="text-sm font-bold ${p.overtimeHours ? 'text-blue-700' : 'text-charcoal-400'}">${p.overtimeHours || 0} hrs</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">Overtime</p>
        </div>
        <div class="bg-charcoal-50 rounded-lg p-2.5 text-center">
          <p class="text-sm font-bold text-charcoal-900">${p.usedAnnualLeave || 0} · ${p.remainingAnnualLeave || 0} d</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">Annual Leave<br>Used · Remaining</p>
        </div>
        <div class="bg-charcoal-50 rounded-lg p-2.5 text-center">
          <p class="text-sm font-bold text-charcoal-900">${p.paidLeaveDays || 0} d</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">Paid Leave</p>
        </div>
      </div>
    </div>

    <!-- Earnings Section -->
    <div class="bg-white rounded-xl border border-charcoal-100 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2.5 bg-green-50/60 border-b border-green-100">
        <div class="flex items-center gap-2">
          <span class="material-icons text-green-500 text-base">add_circle</span>
          <p class="text-[10px] font-bold text-green-700 uppercase tracking-wider">Earnings</p>
        </div>
        <p class="text-sm font-bold text-green-700">EGP ${p.grossEarnings.toLocaleString()}</p>
      </div>
      <div class="divide-y divide-charcoal-50">
        ${earnings.map(e => `
          <div class="flex items-center gap-3 px-4 py-3 hover:bg-charcoal-50/50 transition-colors">
            ${_payItemIcon(e.icon, e.color)}
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-charcoal-800">${e.label}</p>
            </div>
            <span class="text-xs font-bold text-green-700">EGP ${e.amount.toLocaleString()}</span>
          </div>
        `).join('')}
        <div class="flex items-center justify-between px-4 py-2.5 bg-green-50/40">
          <span class="text-[10px] font-bold text-green-700 uppercase">Gross Earnings</span>
          <span class="text-sm font-bold text-green-700">EGP ${p.grossEarnings.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Deductions Section -->
    <div class="bg-white rounded-xl border border-charcoal-100 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2.5 bg-red-50/60 border-b border-red-100">
        <div class="flex items-center gap-2">
          <span class="material-icons text-red-400 text-base">remove_circle</span>
          <p class="text-[10px] font-bold text-red-600 uppercase tracking-wider">Deductions</p>
        </div>
        <p class="text-sm font-bold text-red-600">EGP ${p.totalDeductions.toLocaleString()}</p>
      </div>
      <div class="divide-y divide-charcoal-50">
        ${deductions.map(d => {
          let html = `<div class="flex items-center gap-3 px-4 py-3 hover:bg-charcoal-50/50 transition-colors">
            ${_payItemIcon(d.icon, d.color)}
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-charcoal-800">${d.label}</p>
            </div>
            <span class="text-xs font-bold text-red-600">EGP ${Math.abs(d.amount).toLocaleString()}</span>
          </div>`;
          if (d.isGroup && d.subItems) {
            d.subItems.forEach(s => {
              html += `<div class="flex items-start gap-2.5 px-4 py-2.5 pl-14 bg-orange-50/30 border-t border-orange-100/50">
                <span class="material-icons text-orange-400 text-xs mt-0.5">${s.icon || 'info'}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-medium text-charcoal-700">${s.label}</p>
                  ${s.detail ? `<p class="text-[10px] text-charcoal-400 mt-0.5">${s.detail}</p>` : ''}
                </div>
                <span class="text-[11px] font-semibold text-orange-600 whitespace-nowrap">EGP ${Math.abs(s.amount).toLocaleString()}</span>
              </div>`;
            });
          }
          return html;
        }).join('')}
        <div class="flex items-center justify-between px-4 py-2.5 bg-red-50/40">
          <span class="text-[10px] font-bold text-red-600 uppercase">Total Deductions</span>
          <span class="text-sm font-bold text-red-600">EGP ${p.totalDeductions.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Net Salary Card -->
    <div class="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-5 text-white text-center shadow-lg shadow-brand-200">
      <p class="text-[10px] font-bold text-white/70 uppercase tracking-wider">Net Salary</p>
      <p class="text-2xl font-bold mt-1">EGP ${p.netSalary.toLocaleString()}</p>
      <p class="text-[10px] text-white/60 mt-1">Paid on ${formatDate(p.paidDate)}</p>
    </div>

    <!-- Salary Breakdown Bar -->
    <div class="bg-white rounded-xl border border-charcoal-100 p-4">
      <p class="bento-label text-charcoal-500 mb-2">SALARY COMPOSITION</p>
      <div class="flex rounded-full overflow-hidden h-4 mb-2">
        <div class="bg-brand-500 h-full flex items-center justify-center" style="width:${Math.round((p.netSalary / p.grossEarnings) * 100)}%">
          <span class="text-[8px] font-bold text-white">${Math.round((p.netSalary / p.grossEarnings) * 100)}%</span>
        </div>
        <div class="bg-red-400 h-full flex items-center justify-center" style="width:${Math.round((p.totalDeductions / p.grossEarnings) * 100)}%">
          <span class="text-[8px] font-bold text-white">${Math.round((p.totalDeductions / p.grossEarnings) * 100)}%</span>
        </div>
      </div>
      <div class="flex items-center justify-between text-[10px]">
        <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-brand-500"></span><span class="text-charcoal-500">Net Pay</span></div>
        <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400"></span><span class="text-charcoal-500">Deductions</span></div>
      </div>
    </div>
  </div>`;

  openModal(p.period + ' — Payslip', content, {
    wide: true,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>
             <button onclick="showToast('Payslip downloaded','info');closeModal();" class="btn btn-sm btn-primary flex items-center gap-1.5">
               <span class="material-icons text-sm">download</span> Download PDF
             </button>`
  });
}

// ==================== EVALUATIONS ====================
function renderEvaluations() {
  const latest=MOCK.evaluations[0];
  return `<div class="space-y-3">
    <h1 class="text-xl font-bold text-charcoal-900">My Evaluations</h1>

    <!-- Latest Score Card -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4 border-l-4 border-l-brand-500">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-full border-4 border-brand-500 flex items-center justify-center flex-shrink-0 bg-brand-50">
          <div class="text-center"><p class="text-xl font-bold text-brand-700">${latest.score}</p><p class="text-[10px] text-charcoal-500">/ ${latest.maxScore}</p></div>
        </div>
        <div>
          <p class="bento-label text-charcoal-500 mb-0.5">LATEST EVALUATION</p>
          <p class="text-sm font-bold text-charcoal-900">${latest.period}</p>
          <p class="text-xs text-charcoal-500 mt-0.5">Reviewed by ${latest.reviewer} · ${formatDate(latest.date)}</p>
          <div class="flex items-center gap-2 mt-1.5">
            ${statusBadge(latest.status)}
            <span class="text-[10px] text-charcoal-500">${Math.round((latest.score/latest.maxScore)*100)}% score</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Evaluation History -->
    <h2 class="text-sm font-semibold text-charcoal-900">Evaluation History</h2>
    <div class="space-y-1.5">${MOCK.evaluations.map(ev=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openEvalDetail('${ev.id}')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0 border-2 border-brand-200">
            <span class="text-sm font-bold text-brand-700">${ev.score}</span>
          </div>
          <div>
            <p class="text-xs font-semibold text-charcoal-900">${ev.period}</p>
            <p class="text-[10px] text-charcoal-500">${formatDate(ev.date)} · ${ev.reviewer}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${statusBadge(ev.status)}
          <svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>
    </div>`).join('')}</div>
  </div>`;
}
function openEvalDetail(id) {
  const ev=MOCK.evaluations.find(e=>e.id===id); if(!ev)return;
  const pct = Math.round((ev.score/ev.maxScore)*100);
  openModal(ev.period+' Evaluation',`<div class="space-y-3">
    <div class="text-center py-2 border-b border-charcoal-100">
      <div class="w-16 h-16 rounded-full border-4 border-brand-500 flex items-center justify-center mx-auto bg-brand-50">
        <div class="text-center"><p class="text-xl font-bold text-brand-700">${ev.score}</p><p class="text-[10px] text-charcoal-500">/ ${ev.maxScore}</p></div>
      </div>
      <p class="text-xs text-charcoal-500 mt-2">Reviewed by ${ev.reviewer} · ${formatDate(ev.date)}</p>
    </div>
    <div class="space-y-2.5">${ev.criteria.map(c=>{
      const cpct = Math.round((c.score/ev.maxScore)*100);
      return `<div><div class="flex items-center justify-between mb-1"><span class="text-xs font-medium text-charcoal-900">${c.name}</span><span class="text-[11px] font-semibold ${cpct>=80?'text-brand-600':cpct>=60?'text-yellow-600':'text-red-600'}">${c.score}/${ev.maxScore}</span></div><div class="w-full h-2 bg-charcoal-100 rounded-full overflow-hidden"><div class="h-full ${cpct>=80?'bg-brand-500':cpct>=60?'bg-yellow-500':'bg-red-500'} rounded-full transition-all" style="width:${cpct}%"></div></div><p class="text-[10px] text-charcoal-500 mt-1">${c.comment}</p></div>`;
    }).join('')}</div>
    <div class="bg-charcoal-50 rounded-lg p-3"><p class="bento-label text-charcoal-500 mb-1">OVERALL COMMENT</p><p class="text-xs text-charcoal-700">${ev.overallComment}</p></div>
  </div>`,{wide:true,footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>'});
}

// ==================== REQUESTS ====================
let reqActiveFilter = '';
function renderRequests() {
  const counts = {All:MOCK.requests.length, Pending:MOCK.requests.filter(r=>r.status==='Pending').length, Approved:MOCK.requests.filter(r=>r.status==='Approved').length, Rejected:MOCK.requests.filter(r=>r.status==='Rejected').length};
  const pills = ['All','Pending','Approved','Rejected'];
  const pillColors = {All:'bg-charcoal-100 text-charcoal-700', Pending:'bg-yellow-100 text-yellow-700', Approved:'bg-brand-100 text-brand-700', Rejected:'bg-red-100 text-red-700'};
  const activeColors = {All:'bg-charcoal-800 text-white', Pending:'bg-yellow-500 text-white', Approved:'bg-brand-600 text-white', Rejected:'bg-red-500 text-white'};
  const filtered = reqActiveFilter ? MOCK.requests.filter(r=>r.status===reqActiveFilter) : MOCK.requests;

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-charcoal-900">My Requests</h1>
      <button onclick="openNewRequest()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Request</button>
    </div>
    <div class="flex items-center gap-1.5 flex-wrap">${pills.map(p=>`<button onclick="filterReq('${p}')" class="req-pill ${reqActiveFilter===p||(p==='All'&&!reqActiveFilter)?activeColors[p]:pillColors[p]}">${p} <span class="text-[10px] opacity-70">${counts[p]}</span></button>`).join('')}</div>
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table req-table"><thead><tr><th>Request</th><th>Type</th><th>Date</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
      <tbody>${filtered.map((r,i)=>`<tr class="cursor-pointer req-row ${r.id===state.selectedReq?'req-row-active':''}" onclick="openReqDetail('${r.id}')"><td class="font-medium text-xs">${r.id.toUpperCase()}</td><td class="text-xs">${r.type}</td><td class="text-xs">${r.requestedDate}</td><td class="text-xs">${formatDate(r.submittedDate)}</td><td>${statusBadge(r.status)}</td><td><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="space-y-1.5 lg:hidden" id="request-list">${filtered.map(r=>`<div class="card p-3 card-interactive" onclick="openReqDetail('${r.id}')"><div class="flex items-center justify-between"><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded ${r.status==='Approved'?'bg-brand-100 text-brand-600':r.status==='Rejected'?'bg-red-100 text-red-600':r.status==='Pending'?'bg-yellow-100 text-yellow-600':'bg-charcoal-100 text-charcoal-600'} flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div><div><p class="text-xs font-medium text-charcoal-900">${r.type}</p><p class="text-[10px] text-charcoal-500">${formatDate(r.submittedDate)}</p></div></div><div class="flex items-center gap-2"><p class="text-[10px] text-charcoal-700 hidden sm:block">${r.requestedDate}</p>${statusBadge(r.status)}<svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></div></div></div>`).join('')}</div>
    ${filtered.length===0?'<div class="card p-8 text-center"><svg class="w-10 h-10 text-charcoal-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p class="text-xs text-charcoal-500">No ${reqActiveFilter.toLowerCase()} requests</p></div>':''}</div>`;
}
function filterReq(status) {
  reqActiveFilter = status === 'All' ? '' : status;
  renderAll();
}
function openNewRequest() {
  const types=MOCK.requestTypes;
  openModal('New Request',`<div class="space-y-3"><div><label class="form-label">Request Type</label><select class="form-select" id="req-type-select" onchange="updateReqForm()"><option value="">Select type...</option>${types.map(t=>`<option value="${t.id}">${t.label}</option>`).join('')}</select></div><div id="req-form-fields"></div></div>`,{wide:true,footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="submitNewRequest()" class="btn btn-sm btn-primary">Submit</button>'});
}
function updateReqForm() {
  const sel=document.getElementById('req-type-select');
  const t=MOCK.requestTypes.find(x=>x.id===sel.value);
  const c=document.getElementById('req-form-fields');
  if(!t){c.innerHTML='';return;}
  let h='<div class="border-t border-charcoal-100 pt-3 space-y-3">';
  t.fields.forEach(f=>{
    if(f==='date'||f==='date-from') h+=`<div><label class="form-label">${f==='date-from'?'From':'Date'}</label><input type="date" class="form-input" required></div>`;
    else if(f==='date-to') h+=`<div><label class="form-label">To Date</label><input type="date" class="form-input" required></div>`;
    else if(f==='time'||f==='time-from') h+=`<div><label class="form-label">${f==='time-from'?'From':'Time'}</label><input type="time" class="form-input" required></div>`;
    else if(f==='time-to') h+=`<div><label class="form-label">To Time</label><input type="time" class="form-input" required></div>`;
    else if(f==='colleague') h+=`<div><label class="form-label">Colleague</label><select class="form-select" required><option value="">Select...</option>${MOCK.teamMembers.slice(0,5).map(m=>`<option>${m.name}</option>`).join('')}</select></div>`;
    else if(f==='document-type') h+=`<div><label class="form-label">Document Type</label><input type="text" class="form-input" placeholder="e.g. Employment Contract" required></div>`;
    else if(f==='correction-type') h+=`<div><label class="form-label">Type</label><select class="form-select" required><option value="">Select...</option><option>Missing Check-in</option><option>Missing Check-out</option><option>Wrong Time</option></select></div>`;
    else h+=`<div><label class="form-label">${f.charAt(0).toUpperCase()+f.slice(1).replace(/-/g,' ')}</label><textarea class="form-input" rows="2" placeholder="Details..." required></textarea></div>`;
  });
  c.innerHTML=h+'</div>';
}
function submitNewRequest() { closeModal(); showToast('Request submitted'); }
function openReqDetail(id) {
  const r=MOCK.requests.find(x=>x.id===id); if(!r)return;
  state.selectedReq = id;
  const statusColors = {Pending:'text-yellow-600', Approved:'text-brand-600', Rejected:'text-red-600'};
  openDrawer(r.type,`<div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        ${statusBadge(r.status)}
        <span class="text-[10px] text-charcoal-400 font-medium">${r.id.toUpperCase()}</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5 text-center"><p class="bento-label text-charcoal-500 mb-0.5">TYPE</p><p class="text-xs font-semibold text-charcoal-900">${r.type}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5 text-center"><p class="bento-label text-charcoal-500 mb-0.5">SUBMITTED</p><p class="text-xs font-semibold text-charcoal-900">${formatDate(r.submittedDate)}</p></div>
    </div>

    <div class="bg-charcoal-50 rounded-lg p-3">
      <p class="bento-label text-charcoal-500 mb-1">REQUESTED DATE</p>
      <p class="text-sm font-bold text-charcoal-900">${r.requestedDate}</p>
    </div>

    <div><p class="bento-label text-charcoal-500 mb-1">REASON</p><p class="text-xs text-charcoal-700 bg-charcoal-50 rounded-lg p-2.5">${r.reason}</p></div>

    ${r.scheduleContext?`<div class="bg-blue-50 border border-blue-200 rounded-lg p-3"><p class="bento-label text-blue-600 mb-1 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>SCHEDULE IMPACT</p><p class="text-xs text-blue-800">${r.scheduleContext}</p></div>`:''}

    ${r.reviewerComment?`<div class="bg-brand-50 border border-brand-200 rounded-lg p-3"><p class="bento-label text-brand-600 mb-1 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>REVIEWER COMMENT</p><p class="text-xs text-charcoal-700">${r.reviewerComment}</p></div>`:''}

    <div><p class="bento-label text-charcoal-500 mb-2">APPROVAL WORKFLOW</p>
      <div class="space-y-0">${r.timeline.map((t,i)=>`<div class="flex gap-2.5"><div class="flex flex-col items-center"><div class="w-3 h-3 rounded-full ${t.done?'bg-brand-500 ring-2 ring-brand-100':'bg-charcoal-300'} flex-shrink-0 mt-0.5"></div>${i<r.timeline.length-1?'<div class="w-0.5 h-6 bg-charcoal-200 my-0.5"></div>':''}</div><div class="pb-3"><p class="text-xs font-medium ${t.done?'text-charcoal-900':'text-charcoal-400'}">${t.step}</p><p class="text-[10px] ${t.done?'text-charcoal-500':'text-charcoal-400'}">${t.date}</p></div></div>`).join('')}</div>
    </div>

    <div class="flex gap-2 pt-2 border-t border-charcoal-100">
      ${r.status==='Pending'?`<button onclick="closeModal();showToast('Request cancelled')" class="btn btn-sm btn-danger-outline flex-1 justify-center">Cancel Request</button>`:''}
      ${r.status==='Approved'?`<button onclick="closeModal();showToast('Downloading...','info')" class="btn btn-sm btn-secondary flex-1 justify-center"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Download</button>`:''}
      <button onclick="closeModal()" class="btn btn-sm btn-secondary flex-1 justify-center">Close</button>
    </div>
  </div>`);
}

// ==================== NOTIFICATIONS ====================
function renderNotifications() {
  const unread = MOCK.notifications.filter(n=>!n.read).length;
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Notifications</h1><p class="text-xs text-charcoal-500 mt-0.5">${unread} unread</p></div>
      <button onclick="showToast('All marked as read')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Mark All Read</button>
    </div>
    <div class="space-y-1">${MOCK.notifications.map(n=>`<div class="bg-white rounded-xl border ${n.read?'border-charcoal-200':'border-brand-200 bg-brand-50/30'} p-3 card-interactive transition-all" onclick="${n.link?`navigateTo('${n.link}')`:''}">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-full ${colorMap[n.color]} flex items-center justify-center flex-shrink-0">${catIcon(n.category)}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <p class="text-xs font-semibold text-charcoal-900 ${n.read?'font-medium':''}">${n.title}</p>
            ${!n.read?'<span class="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0"></span>':''}
          </div>
          <p class="text-xs text-charcoal-600 mt-0.5">${n.description}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-charcoal-50 text-[9px] font-medium text-charcoal-600">${n.category}</span>
            <span class="text-[10px] text-charcoal-400">${n.date}</span>
          </div>
        </div>
        ${n.link?'<svg class="w-3.5 h-3.5 text-charcoal-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>':''}
      </div>
    </div>`).join('')}</div>
  </div>`;
}

// ==================== SETTINGS ====================
function renderSettings() {
  const notifSettings = [
    {k:'emailNotifications',l:'Email Notifications',desc:'Receive updates via email'},
    {k:'pushNotifications',l:'Push Notifications',desc:'Browser push notifications'},
    {k:'scheduleNotifications',l:'Schedule Updates',desc:'Shift changes and new schedules'},
    {k:'attendanceNotifications',l:'Attendance Alerts',desc:'Late check-ins and absences'},
    {k:'payrollNotifications',l:'Payroll Updates',desc:'Payslip availability'},
    {k:'requestNotifications',l:'Request Updates',desc:'Request status changes'},
  ];
  return `<div class="space-y-3 max-w-xl">
    <div><h1 class="text-xl font-bold text-charcoal-900">Settings</h1><p class="text-xs text-charcoal-500 mt-0.5">Manage your account and preferences</p></div>

    <!-- Account -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50">
        <p class="bento-label">ACCOUNT</p>
      </div>
      <div class="p-3 space-y-1">
        <button onclick="openChangePassword()" class="w-full flex items-center justify-between p-3 rounded-lg hover:bg-charcoal-50 transition-colors text-xs">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center"><svg class="w-4 h-4 text-charcoal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div>
            <div class="text-left"><p class="font-medium text-charcoal-900">Change Password</p><p class="text-[10px] text-charcoal-500">Last changed 45 days ago</p></div>
          </div>
          <svg class="w-4 h-4 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
        <button onclick="handleLogout()" class="w-full flex items-center justify-between p-3 rounded-lg hover:bg-red-50 transition-colors text-xs">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center"><svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg></div>
            <p class="font-medium text-red-600">Logout</p>
          </div>
          <svg class="w-4 h-4 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>

    <!-- Notifications -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50">
        <p class="bento-label">NOTIFICATIONS</p>
      </div>
      <div class="p-3 space-y-0">
        ${notifSettings.map((p,i)=>`<div class="flex items-center justify-between py-2.5 ${i<notifSettings.length-1?'border-b border-charcoal-50':''}"><div><p class="text-xs font-medium text-charcoal-900">${p.l}</p><p class="text-[10px] text-charcoal-500">${p.desc}</p></div><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" ${MOCK.settings[p.k]?'checked':''} class="sr-only peer"><div class="w-9 h-5 bg-charcoal-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div></label></div>`).join('')}
      </div>
    </div>

    <!-- Language -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50">
        <p class="bento-label">PREFERENCES</p>
      </div>
      <div class="p-3">
        <label class="form-label">Language</label>
        <select class="form-select w-40" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>English</option><option>Arabic</option></select>
      </div>
    </div>
  </div>`;
}
function openChangePassword() {
  openModal('Change Password',`<form onsubmit="event.preventDefault();closeModal();showToast('Password changed');" class="space-y-3">
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2"><svg class="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p class="text-xs text-blue-800">Password must be at least 8 characters with uppercase, lowercase, and numbers.</p></div>
    <div><label class="form-label">Current Password</label><input type="password" class="form-input" required></div>
    <div><label class="form-label">New Password</label><input type="password" class="form-input" required minlength="8"></div>
    <div><label class="form-label">Confirm New Password</label><input type="password" class="form-input" required minlength="8"></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Change Password</button></div>
  </form>`);
}
