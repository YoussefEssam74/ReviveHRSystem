// ====================================================================================
// ==================== REDESIGNED EMPLOYEE PAYROLL & EXPENSE SETTLEMENT ====================
// ====================================================================================

let _payPeriod = 'August 2026';
let _payrollView = 'detail'; // 'detail' for Employee Settlement Sheet, 'overview' for All Staff Table
let _payrollGym = 'Nasr City';
let _payrollEmployeeIdValue = 'RV-00124'; // Default to Ahmed Mohamed
let _showAddDeductionForm = false;

const PAYROLL_GYMS = ['Nasr City', 'Heliopolis', '6th October'];
const PAYROLL_PERIODS = ['August 2026', 'July 2026', 'June 2026'];

// Sync with active topbar gym if applicable
function getEffectivePayrollGym() {
  const u = MOCK.currentUser;
  if (u && u.selectedGym && u.selectedGym !== 'all') {
    const g = (u.gyms || []).find(gym => gym.id === u.selectedGym);
    if (g) return g.branch;
  }
  return _payrollGym;
}

function payrollItemsForGym(gym) {
  const targetGym = gym || getEffectivePayrollGym();
  return (MOCK.payrollItems || []).filter(item => item.gym === targetGym);
}

function payrollPeriodRecord() {
  return (MOCK.payroll || []).find(r => r.period === _payPeriod) || { period: _payPeriod, status: 'Open', locked: false, publishedGyms: [] };
}

function payrollPeriodLocked(gym) {
  const r = payrollPeriodRecord();
  return !!r.locked || (r.publishedGyms || []).includes(gym || getEffectivePayrollGym());
}

// Math and calculation helpers
function baseSalaryOf(item) { return Number(item.baseSalary !== undefined ? item.baseSalary : item.gross || 0); }
function bonusOf(item) { return Number(item.bonus || 0); }
function overtimeHoursOf(item) { return Number(item.overtime || 0); }
function overtimePayOf(item) { 
  // Standard overtime: (Base / 22 / 8) * 1.5 * overtimeHours
  const base = baseSalaryOf(item);
  const hourly = (base / 176) * 1.5;
  return Math.round(hourly * overtimeHoursOf(item));
}
function grossOf(item) { return baseSalaryOf(item) + bonusOf(item) + overtimePayOf(item); }

function approvedDedTotal(item) {
  return (item.deductionLines || [])
    .filter(line => line.status === 'Accepted' || line.status === 'Approved')
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function pendingDedTotal(item) {
  return (item.deductionLines || [])
    .filter(line => line.status === 'Pending')
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function allDedTotal(item) {
  return (item.deductionLines || [])
    .filter(line => line.status !== 'Rejected')
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function netOf(item) {
  return grossOf(item) - approvedDedTotal(item);
}

function pendingCountOf(item) {
  return (item.deductionLines || []).filter(line => line.status === 'Pending').length;
}

function payrollSyncTotals(item) {
  item.gross = grossOf(item);
  item.deductions = approvedDedTotal(item);
  item.net = netOf(item);
}

function payrollStatus(item) {
  if (payrollPeriodLocked(item && item.gym)) return 'Closed';
  if (item && (item.status === 'Reviewed' || item.status === 'Approved' || item.status === 'Locked' || item.reviewed)) {
    return 'Closed';
  }
  if (pendingCountOf(item) > 0) return 'Needs Attention';
  return 'Ready to Close';
}

function payrollIsReviewed(item) {
  return payrollStatus(item) === 'Closed';
}

function payrollAllReviewed(items) {
  return items.length > 0 && items.every(payrollIsReviewed);
}

function payrollEmployeeRecord(item) {
  return (MOCK.employees || []).find(e => e.id === item.employeeId) || null;
}

function payrollRequestsFor(item) {
  const ids = new Set(item.relatedRequestIds || []);
  (item.deductionLines || []).forEach(line => { if (line.requestId) ids.add(line.requestId); });
  return (MOCK.requests || []).filter(r => ids.has(r.id) || r.employee === item.name);
}

function payrollAttendanceRows(item) {
  const exceptions = (MOCK.attendanceExceptions || []).filter(r => r.employeeId === item.employeeId).map(r => ({
    id: r.id, date: r.date, title: r.exception, detail: r.detail,
    firstIn: r.firstIn, lastOut: r.lastOut, device: r.device, kind: 'exception', status: 'Exception'
  }));
  const board = (MOCK.attendanceRecords || []).filter(r => r.employeeId === item.employeeId).map(r => ({
    id: `BOARD-${r.date}`, date: r.date, title: r.status, detail: r.notes || (r.shift ? `Shift ${r.shift}` : ''),
    firstIn: r.checkIn, lastOut: r.checkOut, device: r.source, kind: 'board', status: r.status
  }));
  return exceptions.concat(board).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function formatEGP(val) {
  return 'EGP ' + Number(val || 0).toLocaleString('en-US');
}

// ==================== MAIN PAGE RENDERER ====================
function renderPayroll() {
  const gym = getEffectivePayrollGym();
  const items = payrollItemsForGym(gym);

  // Ensure current employee exists
  let currentItem = items.find(i => i.employeeId === _payrollEmployeeIdValue);
  if (!currentItem && items.length > 0) {
    currentItem = items[0];
    _payrollEmployeeIdValue = currentItem.employeeId;
  }

  return `
    <div class="space-y-3 font-sans text-charcoal-800 pb-12 max-w-7xl mx-auto">
      <!-- TOP CONTROLS & SCOPE HEADER -->
      ${renderPayrollTopHeader(gym, items)}

      <!-- CONDITIONAL VIEW: DETAIL SETTLEMENT SHEET vs ALL STAFF TABLE -->
      ${_payrollView === 'detail' && currentItem 
        ? renderPayrollSettlementSheet(currentItem, items) 
        : renderPayrollOverviewTable(items, gym)
      }
    </div>
  `;
}

// ==================== TOP CONTROLS HEADER ====================
function renderPayrollTopHeader(gym, items) {
  const locked = payrollPeriodLocked(gym);
  const closedCount = items.filter(payrollIsReviewed).length;
  const totalCount = items.length;

  return `
    <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-base font-bold text-charcoal-900 tracking-tight">Monthly Payroll &amp; Expense Settlement</h1>
          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
            locked ? 'bg-charcoal-100 text-charcoal-700' : 'bg-brand-50 text-brand-700 border border-brand-200'
          }">
            ${locked ? '🔒 Period Locked' : '🟢 Open for Reconciliation'}
          </span>
        </div>
        <p class="text-[11px] text-charcoal-500 mt-0.5">
          Verify attendance exceptions, reconcile manager expense charges, and close employee monthly accounts.
        </p>
      </div>

      <!-- Scope Selectors & View Toggle -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- View Toggle Pills -->
        <div class="flex items-center bg-charcoal-100 p-0.5 rounded-lg text-xs font-semibold">
          <button onclick="_payrollView='detail';renderAll()" class="px-2.5 py-1 rounded-md transition-all ${
            _payrollView === 'detail' ? 'bg-white text-charcoal-900 shadow-2xs font-bold' : 'text-charcoal-600 hover:text-charcoal-900'
          }">
            📄 Employee Sheet
          </button>
          <button onclick="_payrollView='overview';renderAll()" class="px-2.5 py-1 rounded-md transition-all ${
            _payrollView === 'overview' ? 'bg-white text-charcoal-900 shadow-2xs font-bold' : 'text-charcoal-600 hover:text-charcoal-900'
          }">
            📋 All Staff (${totalCount})
          </button>
        </div>

        <!-- Branch Selector -->
        <div class="flex items-center gap-1.5 text-xs">
          <select onchange="setPayrollGym(this.value)" class="form-select text-xs py-1 px-2.5 font-semibold bg-white border border-charcoal-200 rounded-lg">
            ${PAYROLL_GYMS.map(g => `<option value="${g}" ${g === gym ? 'selected' : ''}>${g} Branch</option>`).join('')}
          </select>
        </div>

        <!-- Period Selector -->
        <div class="flex items-center gap-1.5 text-xs">
          <select onchange="setPayrollPeriod(this.value)" class="form-select text-xs py-1 px-2.5 font-semibold bg-white border border-charcoal-200 rounded-lg">
            ${PAYROLL_PERIODS.map(p => `<option value="${p}" ${p === _payPeriod ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  `;
}

// ====================================================================================
// ==================== DETAILED EMPLOYEE SETTLEMENT SHEET ============================
// ====================================================================================
function renderPayrollSettlementSheet(item, items) {
  const employee = payrollEmployeeRecord(item);
  const locked = payrollPeriodLocked(item.gym);
  const status = payrollStatus(item);
  const isClosed = status === 'Closed';
  const pendingCount = pendingCountOf(item);
  const deductions = item.deductionLines || [];
  const currentIndex = items.findIndex(i => i.employeeId === item.employeeId);
  const prevEmp = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextEmp = currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  // Calculation figures
  const base = baseSalaryOf(item);
  const bonus = bonusOf(item);
  const otHours = overtimeHoursOf(item);
  const otPay = overtimePayOf(item);
  const gross = grossOf(item);
  const approvedDeds = approvedDedTotal(item);
  const net = netOf(item);

  return `
    <div class="space-y-3">

      <!-- 1. EMPLOYEE SELECTOR & APPROVAL FLOW STRIP -->
      <div class="bg-white rounded-xl border border-charcoal-200 p-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <!-- Switcher Dropdown & Arrows -->
        <div class="flex items-center gap-2 min-w-0">
          <div class="flex items-center gap-1">
            <button onclick="openPayrollDetail('${prevEmp ? prevEmp.employeeId : ''}')" ${!prevEmp ? 'disabled' : ''} class="btn btn-sm btn-secondary h-7 w-7 p-0 flex items-center justify-center disabled:opacity-30" title="Previous Staff">
              ←
            </button>
            <button onclick="openPayrollDetail('${nextEmp ? nextEmp.employeeId : ''}')" ${!nextEmp ? 'disabled' : ''} class="btn btn-sm btn-secondary h-7 w-7 p-0 flex items-center justify-center disabled:opacity-30" title="Next Staff">
              →
            </button>
          </div>

          <div class="min-w-0">
            <select onchange="openPayrollDetail(this.value)" class="form-select text-xs font-bold py-1 px-2.5 bg-charcoal-50 border border-charcoal-200 rounded-lg text-charcoal-900 truncate">
              ${items.map(it => {
                const pCount = pendingCountOf(it);
                const tag = it.status === 'Reviewed' || it.status === 'Locked' ? '✓ Closed' : pCount > 0 ? `⚠️ ${pCount} Pending` : 'Ready to Close';
                return `<option value="${it.employeeId}" ${it.employeeId === item.employeeId ? 'selected' : ''}>${it.name} (${it.position}) · ${tag}</option>`;
              }).join('')}
            </select>
          </div>
          <span class="text-[11px] text-charcoal-400 font-medium">(${currentIndex + 1} of ${items.length})</span>
        </div>

        <!-- Approval Workflow Status Badges -->
        <div class="flex items-center gap-2">
          <!-- Step 1: Branch Manager -->
          <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span class="font-bold">BM Signed-off</span>
          </div>

          <span class="text-charcoal-300">→</span>

          <!-- Step 2: HR Reconciliation -->
          <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg ${
            isClosed 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : pendingCount > 0 
                ? 'bg-amber-50 border border-amber-200 text-amber-800' 
                : 'bg-blue-50 border border-blue-200 text-blue-800'
          } text-[11px]">
            ${isClosed ? `
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              <span class="font-bold">HR Account Closed</span>
            ` : pendingCount > 0 ? `
              <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              <span class="font-bold">${pendingCount} Pending Decision${pendingCount > 1 ? 's' : ''}</span>
            ` : `
              <span class="font-bold">Ready to Close</span>
            `}
          </div>
        </div>
      </div>

      <!-- 2. EMPLOYEE IDENTITY COMPACT STRIP -->
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
            ${item.initials || 'EM'}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-charcoal-900">${item.name}</h2>
              <span class="badge badge-brand text-[10px] font-mono">${item.employeeId}</span>
              <span class="badge ${item.employmentStatus === 'Active' ? 'badge-green' : 'badge-yellow'} text-[10px]">
                ${item.employmentStatus || 'Active'}
              </span>
            </div>
            <p class="text-xs text-charcoal-500 mt-0.5">
              ${item.position} · ${item.gym} Branch · Hired: ${employee && employee.hireDate ? employee.hireDate : '2025-01-15'}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-4 text-xs border-t md:border-t-0 md:border-l border-charcoal-150 pt-2 md:pt-0 md:pl-4">
          <div>
            <span class="text-[10px] text-charcoal-400 uppercase tracking-wider font-semibold block">Base Contract</span>
            <span class="text-sm font-extrabold text-charcoal-900">${formatEGP(base)}</span>
          </div>
          <div>
            <span class="text-[10px] text-charcoal-400 uppercase tracking-wider font-semibold block">Settlement Period</span>
            <span class="text-xs font-bold text-charcoal-700">${_payPeriod}</span>
          </div>
        </div>
      </div>

      <!-- 3. MAIN SETTLEMENT 2-COLUMN WORKSPACE -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">

        <!-- ==================== LEFT COLUMN (7 COLS / 60%): SETTLEMENT & DEDUCTIONS ==================== -->
        <div class="lg:col-span-7 space-y-3">

          <!-- CARD A: EARNINGS & ADDITIONS -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3.5 shadow-2xs">
            <div class="flex items-center justify-between pb-2 border-b border-charcoal-150 mb-2.5">
              <div>
                <h3 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">1. Monthly Earnings &amp; Additions</h3>
                <p class="text-[11px] text-charcoal-400">Base contract salary plus overtime and bonuses</p>
              </div>
              <span class="badge badge-green text-[10px] font-bold">Gross: ${formatEGP(gross)}</span>
            </div>

            <div class="space-y-2 text-xs">
              <div class="flex items-center justify-between py-1 px-2 rounded-lg bg-charcoal-50">
                <span class="text-charcoal-600 font-medium">Base Contract Salary</span>
                <span class="font-bold text-charcoal-900">${formatEGP(base)}</span>
              </div>

              <div class="flex items-center justify-between py-1 px-2 rounded-lg bg-charcoal-50">
                <div>
                  <span class="text-charcoal-600 font-medium">Overtime Hours Pay</span>
                  <span class="text-[10px] text-charcoal-400 block">${otHours} hrs logged</span>
                </div>
                <span class="font-bold text-charcoal-900">+ ${formatEGP(otPay)}</span>
              </div>

              <!-- Editable Bonus Row -->
              <div class="flex items-center justify-between py-1.5 px-2 rounded-lg bg-brand-50/40 border border-brand-200">
                <div>
                  <span class="font-semibold text-brand-900">Performance Bonus / Incentive</span>
                  <span class="text-[10px] text-charcoal-400 block">Editable by HR Manager</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <input type="number" min="0" step="50" value="${bonus}" 
                    onchange="commitPayrollBonus('${item.employeeId}', this.value)"
                    ${locked || isClosed ? 'disabled' : ''}
                    class="form-input text-xs h-7 w-20 text-right font-bold text-brand-900 rounded border-brand-300" />
                  <span class="text-xs font-bold text-brand-700">EGP</span>
                </div>
              </div>

              <!-- Subtotal Row -->
              <div class="flex items-center justify-between pt-1 px-2 font-bold text-charcoal-900 border-t border-charcoal-150">
                <span>Total Gross Pay</span>
                <span class="text-sm font-extrabold text-charcoal-900">${formatEGP(gross)}</span>
              </div>
            </div>
          </div>

          <!-- CARD B: DEDUCTIONS & EXPENSE ACCOUNT RECOVERIES (THE CORE RECONCILIATION) -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3.5 shadow-2xs">
            <div class="flex items-center justify-between pb-2 border-b border-charcoal-150 mb-2.5">
              <div>
                <h3 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">2. Deductions &amp; Expense Recoveries</h3>
                <p class="text-[11px] text-charcoal-400">Review and decide each penalty or expense line</p>
              </div>
              <div class="text-right">
                <span class="badge ${approvedDeds > 0 ? 'badge-red' : 'badge-gray'} text-[10px] font-bold">
                  − ${formatEGP(approvedDeds)}
                </span>
              </div>
            </div>

            <!-- List of Deduction Lines -->
            ${deductions.length === 0 ? `
              <div class="py-6 text-center text-xs text-charcoal-400 border border-dashed border-charcoal-200 rounded-lg">
                ✓ No deductions or expense recoveries recorded for this employee.
              </div>
            ` : `
              <div class="space-y-2">
                ${deductions.map(line => {
                  const isPending = line.status === 'Pending';
                  const isAccepted = line.status === 'Accepted' || line.status === 'Approved';
                  const isRejected = line.status === 'Rejected';
                  const isBiometric = line.source === 'biometric';

                  return `
                    <div class="p-2.5 rounded-lg border transition-all ${
                      isPending 
                        ? 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-100' 
                        : isAccepted 
                          ? 'bg-charcoal-50/60 border-charcoal-200' 
                          : 'bg-gray-50 border-gray-200 opacity-60'
                    }">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="badge ${isBiometric ? 'badge-blue' : 'badge-purple'} text-[9px] font-bold">
                              ${isBiometric ? 'Biometric Attendance' : 'Manager Recovery'}
                            </span>
                            <span class="text-xs font-bold text-charcoal-900">${line.label || line.reason}</span>
                            
                            <!-- Status Tag -->
                            <span class="text-[10px] font-bold ${
                              isPending ? 'text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded' :
                              isAccepted ? 'text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded' :
                              'text-red-700 bg-red-100 px-1.5 py-0.2 rounded line-through'
                            }">
                              ${isPending ? 'Decision Required' : isAccepted ? 'Approved' : 'Waived / Rejected'}
                            </span>
                          </div>

                          <p class="text-[11px] text-charcoal-600 mt-1">${line.reason || '—'}</p>

                          <div class="flex items-center gap-3 text-[10px] text-charcoal-400 mt-1 flex-wrap">
                            <span>Date: <b>${line.date || '—'}</b></span>
                            ${line.attendanceRef ? `
                              <span>Ref: <button onclick="openPayrollAttendanceRef('${line.attendanceRef}', '${item.employeeId}')" class="text-brand-600 hover:underline font-bold">${line.attendanceRef}</button></span>
                            ` : ''}
                          </div>
                        </div>

                        <!-- Amount & Action Controls -->
                        <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span class="text-xs font-bold ${isRejected ? 'line-through text-charcoal-400' : 'text-red-600'}">
                            − ${formatEGP(line.amount)}
                          </span>

                          ${isPending && !locked && !isClosed ? `
                            <div class="flex items-center gap-1 mt-0.5">
                              <button onclick="decidePayrollDeduction('${item.employeeId}', '${line.id}', true)" 
                                class="btn btn-sm btn-success h-6 px-2 text-[11px] shadow-2xs font-semibold" title="Approve this charge">
                                Approve
                              </button>
                              <button onclick="decidePayrollDeduction('${item.employeeId}', '${line.id}', false)" 
                                class="btn btn-sm btn-secondary h-6 px-2 text-[11px] text-red-600 hover:bg-red-50 font-semibold" title="Waive / reject this charge">
                                Waive
                              </button>
                            </div>
                          ` : isAccepted && !locked && !isClosed ? `
                            <button onclick="decidePayrollDeduction('${item.employeeId}', '${line.id}', false)" 
                              class="text-[10px] text-charcoal-400 hover:text-red-600 hover:underline">
                              Change to Waive
                            </button>
                          ` : isRejected && !locked && !isClosed ? `
                            <button onclick="decidePayrollDeduction('${item.employeeId}', '${line.id}', true)" 
                              class="text-[10px] text-charcoal-400 hover:text-emerald-600 hover:underline">
                              Restore to Approve
                            </button>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}

            <!-- INLINE ADD DEDUCTION FORM TOGGLE -->
            <div class="mt-3 pt-2.5 border-t border-charcoal-150">
              ${!_showAddDeductionForm ? `
                <button onclick="_showAddDeductionForm=true;renderAll()" ${locked || isClosed ? 'disabled' : ''} class="text-xs text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1">
                  <span>+ Add Manual Deduction / Expense Charge</span>
                </button>
              ` : `
                <form onsubmit="savePayrollDeductionInline(event, '${item.employeeId}')" class="bg-charcoal-50 p-2.5 rounded-lg border border-charcoal-200 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-charcoal-800">Add Deduction / Recovery Line</span>
                    <button type="button" onclick="_showAddDeductionForm=false;renderAll()" class="text-xs text-charcoal-400 hover:text-charcoal-700">✕ Cancel</button>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label class="block text-[10px] font-semibold text-charcoal-500 mb-0.5">Source Type</label>
                      <select name="source" class="form-select text-xs py-1 px-2 w-full">
                        <option value="manager">Manager Operational Charge</option>
                        <option value="biometric">Biometric Attendance Penalty</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[10px] font-semibold text-charcoal-500 mb-0.5">Reason / Description</label>
                      <input name="reason" required placeholder="e.g. Lost locker key / damaged tool" class="form-input text-xs py-1 px-2 w-full" />
                    </div>
                    <div>
                      <label class="block text-[10px] font-semibold text-charcoal-500 mb-0.5">Amount (EGP)</label>
                      <input name="amount" type="number" min="0" step="50" required placeholder="150" class="form-input text-xs py-1 px-2 w-full" />
                    </div>
                  </div>
                  <div class="flex justify-end gap-2 pt-1">
                    <button type="button" onclick="_showAddDeductionForm=false;renderAll()" class="btn btn-sm btn-secondary text-xs h-7 px-2">Cancel</button>
                    <button type="submit" class="btn btn-sm btn-primary text-xs h-7 px-3">Add Charge</button>
                  </div>
                </form>
              `}
            </div>
          </div>

          <!-- CARD C: FINAL MONTHLY SETTLEMENT & ACCOUNT CLOSING -->
          <div class="bg-brand-50/60 rounded-xl border border-brand-200 p-4 shadow-2xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span class="text-[10px] uppercase tracking-wider font-extrabold text-brand-800 block">Final Monthly Settlement</span>
                <div class="flex items-baseline gap-2 mt-0.5">
                  <span class="text-2xl font-black text-brand-900">${formatEGP(net)}</span>
                  <span class="text-xs text-charcoal-500">
                    (${formatEGP(gross)} gross − ${formatEGP(approvedDeds)} deductions)
                  </span>
                </div>
              </div>

              <!-- Close Account Action Button -->
              <div>
                ${isClosed ? `
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-xs">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                      Account Closed &amp; Settled
                    </span>
                    ${!locked ? `
                      <button onclick="reopenPayrollEmployee('${item.employeeId}')" class="btn btn-sm btn-secondary text-xs h-8 px-2 text-charcoal-600 hover:text-charcoal-900" title="Re-open this employee's account for edits">
                        Re-open
                      </button>
                    ` : ''}
                  </div>
                ` : pendingCount > 0 ? `
                  <div class="text-right">
                    <button disabled class="btn btn-sm btn-secondary text-xs h-8 px-3 opacity-60 cursor-not-allowed">
                      Resolve ${pendingCount} Decisions First
                    </button>
                    <span class="block text-[10px] text-amber-700 mt-0.5 font-medium">Decide Approve/Waive on all lines above</span>
                  </div>
                ` : `
                  <button onclick="acceptPayrollEmployee('${item.employeeId}')" class="btn btn-sm btn-primary text-xs h-9 px-4 font-bold shadow-xs flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    Close &amp; Approve Account for ${_payPeriod}
                  </button>
                `}
              </div>
            </div>
          </div>

        </div>

        <!-- ==================== RIGHT COLUMN (5 COLS / 40%): SOURCE AUDIT EVIDENCE ==================== -->
        <div class="lg:col-span-5 space-y-3">

          <!-- 1. WORKING DAYS & ATTENDANCE LEDGER -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3.5 shadow-2xs">
            <div class="flex items-center justify-between pb-2 border-b border-charcoal-150 mb-2.5">
              <div>
                <h3 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Working Days &amp; Leaves</h3>
                <p class="text-[10px] text-charcoal-400">${_payPeriod} · 31 Days Cycle</p>
              </div>
              <span class="badge badge-gray text-[10px] font-bold">22 Paid Days</span>
            </div>

            <table class="w-full text-xs">
              <tbody class="divide-y divide-charcoal-100">
                <tr><td class="py-1 text-charcoal-600">Working Days Attended</td><td class="py-1 text-right font-bold text-charcoal-900">${item.days || 22} days</td></tr>
                <tr><td class="py-1 text-charcoal-600">Weekly Scheduled Offs</td><td class="py-1 text-right font-bold text-charcoal-900">4 days</td></tr>
                <tr><td class="py-1 text-charcoal-600">Annual Leave Taken</td><td class="py-1 text-right font-bold text-charcoal-900">0 days</td></tr>
                <tr><td class="py-1 text-charcoal-600">Sick / Medical Leave</td><td class="py-1 text-right font-bold text-charcoal-900">0 days</td></tr>
                <tr><td class="py-1 text-charcoal-600">Overtime Logged</td><td class="py-1 text-right font-bold text-brand-700">${otHours} hrs</td></tr>
                <tr>
                  <td class="py-1 text-charcoal-600">Late Arrivals Count</td>
                  <td class="py-1 text-right font-bold ${deductions.some(d => d.source==='biometric') ? 'text-amber-600' : 'text-charcoal-900'}">
                    1 incident
                  </td>
                </tr>
                <tr><td class="py-1 text-charcoal-600">Unexcused Absences</td><td class="py-1 text-right font-bold text-charcoal-900">0 days</td></tr>
              </tbody>
            </table>
          </div>

          <!-- 2. BIOMETRIC ATTENDANCE PUNCHES PROOF -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3.5 shadow-2xs">
            <div class="flex items-center justify-between pb-2 border-b border-charcoal-150 mb-2">
              <div>
                <h3 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Biometric Punch Proof</h3>
                <p class="text-[10px] text-charcoal-400">Punches logged for this month</p>
              </div>
              <button onclick="navigateTo('attendance')" class="text-[11px] text-brand-600 hover:underline font-semibold">Attendance Log →</button>
            </div>

            <div class="space-y-1.5 text-xs">
              <div class="p-2 rounded-lg bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span class="font-bold text-amber-900">Aug 19 (Late Arrival)</span>
                  </div>
                  <p class="text-[10px] text-charcoal-500 mt-0.5">Punch: 08:41 In → 16:02 Out · Terminal #1</p>
                </div>
                <button onclick="openPayrollAttendanceRef('ATT-2608-0417', '${item.employeeId}')" class="btn btn-sm btn-secondary text-[10px] h-6 px-1.5">
                  Verify Log
                </button>
              </div>

              <div class="p-2 rounded-lg bg-charcoal-50 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="font-bold text-charcoal-900">Sep 09 (On Time)</span>
                  </div>
                  <p class="text-[10px] text-charcoal-400 mt-0.5">Punch: 08:02 In → 16:00 Out · Biometric</p>
                </div>
                <span class="text-[10px] text-emerald-600 font-bold">On Time</span>
              </div>
            </div>
          </div>

          <!-- 3. RELATED REQUESTS & DECISIONS -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3.5 shadow-2xs">
            <div class="flex items-center justify-between pb-2 border-b border-charcoal-150 mb-2">
              <div>
                <h3 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Linked Employee Requests</h3>
                <p class="text-[10px] text-charcoal-400">Context for leave and deductions</p>
              </div>
              <button onclick="navigateTo('requests')" class="text-[11px] text-brand-600 hover:underline font-semibold">View All →</button>
            </div>

            ${payrollRequestsFor(item).length === 0 ? `
              <p class="text-xs text-charcoal-400 py-3 text-center">No leave or exception requests logged for this period.</p>
            ` : `
              <div class="space-y-1.5">
                ${payrollRequestsFor(item).map(req => `
                  <div class="p-2 rounded-lg bg-charcoal-50 border border-charcoal-100 flex items-start justify-between gap-2 text-xs">
                    <div>
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-charcoal-900">${req.type}</span>
                        <span class="badge ${req.status === 'Approved' ? 'badge-green' : 'badge-red'} text-[9px]">${req.status}</span>
                      </div>
                      <p class="text-[10px] text-charcoal-500 mt-0.5">${req.reason || 'No reason'}</p>
                      <p class="text-[9px] text-charcoal-400 mt-0.5">BM Decision: <b>${req.bmDecision || '—'}</b> (${req.bmComment || 'Reviewed'})</p>
                    </div>
                    <button onclick="openRequestDetail('${req.id}')" class="btn btn-sm btn-secondary text-[10px] h-6 px-1.5 flex-shrink-0">
                      View
                    </button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>

      </div>

    </div>
  `;
}

// ====================================================================================
// ==================== ALL STAFF OVERVIEW TABLE VIEW =================================
// ====================================================================================
function renderPayrollOverviewTable(items, gym) {
  const locked = payrollPeriodLocked(gym);
  const closedCount = items.filter(payrollIsReviewed).length;
  const pendingCount = items.filter(i => !payrollIsReviewed(i)).length;
  const totalNet = items.reduce((sum, i) => sum + netOf(i), 0);
  const totalGross = items.reduce((sum, i) => sum + grossOf(i), 0);

  return `
    <div class="space-y-3">
      <!-- 4 KPI SUMMARY TILES -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs">
          <span class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wider block">Total Staff In Branch</span>
          <p class="text-xl font-extrabold text-charcoal-900 mt-1">${items.length}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${gym} Branch</p>
        </div>

        <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs">
          <span class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wider block">Accounts Closed</span>
          <p class="text-xl font-extrabold text-emerald-600 mt-1">${closedCount} / ${items.length}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${items.length ? Math.round((closedCount/items.length)*100) : 0}% reconciled</p>
        </div>

        <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs">
          <span class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wider block">Pending HR Review</span>
          <p class="text-xl font-extrabold ${pendingCount > 0 ? 'text-amber-600' : 'text-charcoal-900'} mt-1">${pendingCount}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">Need approval/closing</p>
        </div>

        <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs">
          <span class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wider block">Total Net Payroll</span>
          <p class="text-xl font-extrabold text-brand-800 mt-1">${formatEGP(totalNet)}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">Gross: ${formatEGP(totalGross)}</p>
        </div>
      </div>

      <!-- MAIN TABLE CARD -->
      <div class="bg-white rounded-xl border border-charcoal-200 shadow-2xs overflow-hidden">
        <div class="p-3 border-b border-charcoal-150 flex items-center justify-between bg-charcoal-50/60">
          <div>
            <h3 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Staff Payroll Ledger</h3>
            <p class="text-[10px] text-charcoal-400">Click any row to open their monthly closing sheet</p>
          </div>

          <div class="flex items-center gap-2">
            ${closedCount === items.length && !locked ? `
              <button onclick="publishPayroll()" class="btn btn-sm btn-primary text-xs h-7 px-3 font-bold">
                ✓ Publish &amp; Lock Branch Payroll
              </button>
            ` : locked ? `
              <span class="badge badge-gray text-xs">🔒 Period Published &amp; Locked</span>
            ` : `
              <button onclick="publishPayroll()" class="btn btn-sm btn-secondary text-xs h-7 px-3 opacity-60" disabled title="Close all employee sheets before publishing">
                Publish &amp; Lock (${items.length - closedCount} pending)
              </button>
            `}
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-charcoal-150 bg-charcoal-50/40 text-[10px] font-semibold text-charcoal-500 uppercase tracking-wider">
                <th class="py-2.5 px-3">Employee</th>
                <th class="py-2.5 px-3">Position</th>
                <th class="py-2.5 px-3 text-right">Base</th>
                <th class="py-2.5 px-3 text-right">Bonus / OT</th>
                <th class="py-2.5 px-3 text-right">Deductions</th>
                <th class="py-2.5 px-3 text-right">Net Final</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-charcoal-100">
              ${items.map(it => {
                const isClosed = payrollIsReviewed(it);
                const pCount = pendingCountOf(it);
                const base = baseSalaryOf(it);
                const additions = bonusOf(it) + overtimePayOf(it);
                const deds = approvedDedTotal(it);
                const net = netOf(it);

                return `
                  <tr onclick="openPayrollDetail('${it.employeeId}')" class="hover:bg-charcoal-50 cursor-pointer transition-colors ${
                    it.employeeId === _payrollEmployeeIdValue ? 'bg-brand-50/30' : ''
                  }">
                    <td class="py-2.5 px-3">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg bg-charcoal-100 text-charcoal-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                          ${it.initials || 'EM'}
                        </div>
                        <div>
                          <p class="font-bold text-charcoal-900 text-xs">${it.name}</p>
                          <p class="text-[10px] text-charcoal-400 font-mono">${it.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td class="py-2.5 px-3 text-charcoal-600 font-medium">${it.position}</td>
                    <td class="py-2.5 px-3 text-right font-semibold text-charcoal-900">${formatEGP(base)}</td>
                    <td class="py-2.5 px-3 text-right text-emerald-600 font-semibold">+ ${formatEGP(additions)}</td>
                    <td class="py-2.5 px-3 text-right ${deds > 0 ? 'text-red-600' : 'text-charcoal-400'} font-semibold">
                      ${deds > 0 ? `− ${formatEGP(deds)}` : '—'}
                    </td>
                    <td class="py-2.5 px-3 text-right font-extrabold text-charcoal-900">${formatEGP(net)}</td>
                    <td class="py-2.5 px-3">
                      <span class="badge ${
                        isClosed ? 'badge-green' : pCount > 0 ? 'badge-yellow' : 'badge-blue'
                      } text-[10px] font-bold">
                        ${isClosed ? 'Closed & Settled' : pCount > 0 ? `${pCount} Decisions Needed` : 'Ready to Close'}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      <button onclick="event.stopPropagation();openPayrollDetail('${it.employeeId}')" class="btn btn-sm btn-secondary text-[11px] h-6 px-2 text-brand-600 font-semibold">
                        Open Sheet →
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ====================================================================================
// ==================== INTERACTIVE PAYROLL ACTIONS ===================================
// ====================================================================================

function openPayrollDetail(id) {
  if (!id) return;
  _payrollEmployeeIdValue = id;
  _payrollView = 'detail';
  _showAddDeductionForm = false;
  renderAll();
  const main = document.getElementById('main-content');
  if (main) main.scrollTop = 0;
}

function closePayrollDetail() {
  _payrollView = 'overview';
  renderAll();
}

function setPayrollGym(gym) {
  _payrollGym = gym;
  const items = payrollItemsForGym(gym);
  if (items.length > 0) {
    _payrollEmployeeIdValue = items[0].employeeId;
  }
  renderAll();
}

function setPayrollPeriod(period) {
  _payPeriod = period;
  renderAll();
}

function decidePayrollDeduction(empId, lineId, accept) {
  if (payrollPeriodLocked()) { showToast('This period is locked', 'error'); return; }
  const item = (MOCK.payrollItems || []).find(i => i.employeeId === empId);
  if (!item) return;
  const line = (item.deductionLines || []).find(l => l.id === lineId);
  if (!line) return;

  line.status = accept ? 'Accepted' : 'Rejected';
  line.decidedAt = new Date().toISOString();
  payrollSyncTotals(item);
  renderAll();
  showToast(accept ? `Deduction of ${formatEGP(line.amount)} approved` : `Deduction of ${formatEGP(line.amount)} waived`);
}

function commitPayrollBonus(empId, rawVal) {
  const item = (MOCK.payrollItems || []).find(i => i.employeeId === empId);
  if (!item) return;
  item.bonus = Math.max(0, Number(rawVal) || 0);
  payrollSyncTotals(item);
  renderAll();
  showToast(`Bonus updated to ${formatEGP(item.bonus)}. Net pay recalculated.`);
}

function savePayrollDeductionInline(e, empId) {
  e.preventDefault();
  if (payrollPeriodLocked()) { showToast('Period is locked', 'error'); return; }
  const item = (MOCK.payrollItems || []).find(i => i.employeeId === empId);
  if (!item) return;

  const form = e.target;
  const data = new FormData(form);
  const amount = Math.max(0, Number(data.get('amount')) || 0);
  const reason = String(data.get('reason') || '').trim();
  const source = data.get('source') === 'biometric' ? 'biometric' : 'manager';

  if (!reason || !amount) {
    showToast('Please specify reason and amount', 'error');
    return;
  }

  const newLine = {
    id: `dn-${item.employeeId}-${Date.now()}`,
    label: reason,
    reason: reason,
    source: source,
    date: new Date().toISOString().slice(0, 10),
    amount: amount,
    status: 'Pending',
    attendanceRef: source === 'biometric' ? 'ATT-MANUAL' : ''
  };

  item.deductionLines = item.deductionLines || [];
  item.deductionLines.push(newLine);
  item.status = 'Draft';
  item.reviewed = false;
  payrollSyncTotals(item);
  _showAddDeductionForm = false;
  renderAll();
  showToast(`Deduction added for ${item.name} (${formatEGP(amount)}). Decision pending.`);
}

function acceptPayrollEmployee(id) {
  if (payrollPeriodLocked()) { showToast('Period is locked', 'error'); return; }
  const item = (MOCK.payrollItems || []).find(i => i.employeeId === id);
  if (!item) return;

  if (pendingCountOf(item) > 0) {
    showToast('Please resolve all pending deductions before closing this account', 'error');
    return;
  }

  item.status = 'Reviewed';
  item.reviewed = true;
  item.reviewedAt = new Date().toISOString();
  payrollSyncTotals(item);
  showToast(`✓ Monthly payroll & expense account closed for ${item.name}! Net Pay: ${formatEGP(netOf(item))}`);
  renderAll();
}

function reopenPayrollEmployee(id) {
  if (payrollPeriodLocked()) { showToast('Period is locked', 'error'); return; }
  const item = (MOCK.payrollItems || []).find(i => i.employeeId === id);
  if (!item) return;

  item.status = 'Draft';
  item.reviewed = false;
  payrollSyncTotals(item);
  showToast(`Account re-opened for edits: ${item.name}`);
  renderAll();
}

function publishPayroll() {
  const gym = getEffectivePayrollGym();
  const items = payrollItemsForGym(gym);
  if (!payrollAllReviewed(items)) {
    const remaining = items.filter(i => !payrollIsReviewed(i)).length;
    showToast(`${remaining} employee account(s) still need to be reviewed and closed before publishing.`, 'error');
    return;
  }

  openModal('Publish &amp; Lock Branch Payroll', `
    <div class="space-y-3 text-xs">
      <p class="text-charcoal-700">
        You are about to publish and lock the payroll for <b>${gym} Branch</b> for the period <b>${_payPeriod}</b>.
      </p>
      <div class="bg-charcoal-50 p-3 rounded-lg border border-charcoal-200">
        <div class="flex justify-between py-1"><span>Total Employees:</span> <b>${items.length}</b></div>
        <div class="flex justify-between py-1"><span>All Accounts Settled:</span> <b class="text-emerald-600">Yes (100%)</b></div>
        <div class="flex justify-between py-1 border-t border-charcoal-200 pt-1 font-bold">
          <span>Total Net Disbursed:</span> <b>${formatEGP(items.reduce((s, i) => s + netOf(i), 0))}</b>
        </div>
      </div>
      <p class="text-charcoal-500 text-[11px]">
        Locking will finalize all deduction decisions and make records read-only.
      </p>
    </div>
  `, {
    footer: `
      <button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="confirmPublishPayroll()" class="btn btn-sm btn-primary">Publish and Lock Period</button>
    `
  });
}

function confirmPublishPayroll() {
  const gym = getEffectivePayrollGym();
  const items = payrollItemsForGym(gym);
  let record = (MOCK.payroll || []).find(r => r.period === _payPeriod);
  if (!record) {
    record = { period: _payPeriod, status: 'Open', locked: false, publishedGyms: [] };
    MOCK.payroll.push(record);
  }
  record.publishedGyms = record.publishedGyms || [];
  if (!record.publishedGyms.includes(gym)) record.publishedGyms.push(gym);

  const allGymsPublished = PAYROLL_GYMS.every(g => record.publishedGyms.includes(g));
  record.status = allGymsPublished ? 'Published' : 'Partially Published';
  record.locked = allGymsPublished;

  items.forEach(it => {
    it.status = 'Locked';
    it.reviewed = true;
  });

  closeModal();
  renderAll();
  showToast(`Payroll published and locked for ${gym} (${_payPeriod})!`);
}

function openPayrollAttendanceRef(ref, empId) {
  const item = (MOCK.payrollItems || []).find(i => i.employeeId === empId);
  const log = (MOCK.attendanceExceptions || []).find(r => r.id === ref);
  const record = log || { id: ref, date: '2026-08-19', exception: 'Late arrival penalty (Biometric)', detail: 'Check-in was logged at 08:41 (41 min past shift start). Terminal: Nasr City Entrance #1', firstIn: '08:41', lastOut: '16:02', device: 'Terminal #1' };

  openModal('Biometric Punch Audit Trail', `
    <div class="space-y-3 text-xs">
      <div class="bg-charcoal-50 p-3 rounded-xl border border-charcoal-200">
        <div class="flex items-center justify-between">
          <span class="badge badge-blue text-[10px] font-bold">Biometric Punch Record</span>
          <span class="font-mono text-[10px] text-charcoal-500">${ref}</span>
        </div>
        <p class="font-bold text-charcoal-900 text-sm mt-1.5">${item ? item.name : 'Employee'}</p>
        <p class="text-[11px] text-charcoal-500">${item ? item.position : ''} · ${item ? item.gym : ''}</p>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between py-1 border-b border-charcoal-150">
          <span class="text-charcoal-500">Record Date:</span>
          <b>${record.date}</b>
        </div>
        <div class="flex justify-between py-1 border-b border-charcoal-150">
          <span class="text-charcoal-500">Punch In / Out:</span>
          <b>${record.firstIn} → ${record.lastOut}</b>
        </div>
        <div class="flex justify-between py-1 border-b border-charcoal-150">
          <span class="text-charcoal-500">Terminal Source:</span>
          <b>${record.device || 'Entrance Biometric Terminal'}</b>
        </div>
        <div class="py-1">
          <span class="text-charcoal-500 block mb-1">System Exception Notes:</span>
          <div class="p-2 rounded bg-amber-50 text-amber-900 text-[11px] border border-amber-200 font-medium">
            ${record.detail || record.exception}
          </div>
        </div>
      </div>
    </div>
  `, {
    footer: '<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close Audit</button>'
  });
}
