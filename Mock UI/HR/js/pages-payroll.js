// ====================================================================================
// ==================== COMPACT EMPLOYEE PAYROLL & EXPENSE SETTLEMENT =================
// ====================================================================================

let _payPeriod = 'August 2026';
let _payrollView = 'overview'; // DEFAULT: Always show All Staff table first when clicking Payroll!
let _payrollGym = 'Nasr City';
let _payrollEmployeeIdValue = 'RV-00124';
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

function formatEGP(val) {
  return 'EGP ' + Number(val || 0).toLocaleString('en-US');
}

// ==================== MAIN PAGE RENDERER ====================
function renderPayroll() {
  const gym = getEffectivePayrollGym();
  const items = payrollItemsForGym(gym);

  let currentItem = items.find(i => i.employeeId === _payrollEmployeeIdValue);
  if (!currentItem && items.length > 0) {
    currentItem = items[0];
    _payrollEmployeeIdValue = currentItem.employeeId;
  }

  return `
    <div class="h-full flex flex-col font-sans text-charcoal-800 overflow-hidden">
      ${_payrollView === 'detail' && currentItem 
        ? renderPayrollSettlementSheet(currentItem, items) 
        : renderPayrollOverviewTable(items, gym)
      }
    </div>
  `;
}

// ====================================================================================
// ==================== VIEW 1: DEFAULT ALL STAFF OVERVIEW TABLE ======================
// ====================================================================================
function renderPayrollOverviewTable(items, gym) {
  const locked = payrollPeriodLocked(gym);
  const closedCount = items.filter(payrollIsReviewed).length;
  const pendingCount = items.filter(i => !payrollIsReviewed(i)).length;
  const totalNet = items.reduce((sum, i) => sum + netOf(i), 0);
  const totalGross = items.reduce((sum, i) => sum + grossOf(i), 0);

  return `
    <div class="h-full flex flex-col gap-2.5 overflow-hidden">
      <!-- COMPACT HEADER (Single line, no bloated section) -->
      <div class="flex items-center justify-between flex-shrink-0 pt-0.5">
        <div class="flex items-center gap-2">
          <h1 class="text-base font-bold text-charcoal-900 tracking-tight">Staff Payroll &amp; Expense Accounts</h1>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
            locked ? 'bg-charcoal-100 text-charcoal-700' : 'bg-brand-50 text-brand-700 border border-brand-200'
          }">
            ${locked ? '🔒 Locked' : '🟢 Open for Reconciliation'}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Gym Branch selector -->
          <select onchange="setPayrollGym(this.value)" class="form-select text-xs py-1 px-2.5 font-semibold bg-white border border-charcoal-200 rounded-lg">
            ${PAYROLL_GYMS.map(g => `<option value="${g}" ${g === gym ? 'selected' : ''}>${g} Branch</option>`).join('')}
          </select>

          <!-- Period selector -->
          <select onchange="setPayrollPeriod(this.value)" class="form-select text-xs py-1 px-2.5 font-semibold bg-white border border-charcoal-200 rounded-lg">
            ${PAYROLL_PERIODS.map(p => `<option value="${p}" ${p === _payPeriod ? 'selected' : ''}>${p}</option>`).join('')}
          </select>

          <!-- Publish Button -->
          ${closedCount === items.length && !locked && items.length > 0 ? `
            <button onclick="publishPayroll()" class="btn btn-sm btn-primary text-xs h-7 px-3 font-bold shadow-2xs">
              ✓ Publish &amp; Lock Branch
            </button>
          ` : locked ? `
            <span class="text-xs text-charcoal-500 font-semibold px-2 py-1 bg-charcoal-100 rounded-lg">Published</span>
          ` : `
            <button onclick="publishPayroll()" class="btn btn-sm btn-secondary text-xs h-7 px-2.5 opacity-60" disabled title="Reconcile all staff sheets first">
              Publish (${items.length - closedCount} pending)
            </button>
          `}
        </div>
      </div>

      <!-- 4 COMPACT STAT CARDS -->
      <div class="grid grid-cols-4 gap-2 flex-shrink-0">
        <div class="bg-white rounded-lg border border-charcoal-200 px-3 py-2 flex items-center justify-between">
          <div>
            <p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide">Total Staff</p>
            <p class="text-lg font-extrabold text-charcoal-900 leading-tight">${items.length}</p>
          </div>
          <span class="text-[10px] text-charcoal-400 font-medium">${gym}</span>
        </div>

        <div class="bg-white rounded-lg border border-charcoal-200 px-3 py-2 flex items-center justify-between">
          <div>
            <p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide">Settled &amp; Closed</p>
            <p class="text-lg font-extrabold text-emerald-600 leading-tight">${closedCount} / ${items.length}</p>
          </div>
          <span class="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
            ${items.length ? Math.round((closedCount / items.length) * 100) : 0}%
          </span>
        </div>

        <div class="bg-white rounded-lg border border-charcoal-200 px-3 py-2 flex items-center justify-between">
          <div>
            <p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide">Pending Review</p>
            <p class="text-lg font-extrabold ${pendingCount > 0 ? 'text-amber-600' : 'text-charcoal-900'} leading-tight">${pendingCount}</p>
          </div>
          <span class="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
            ${pendingCount > 0 ? 'Action Needed' : 'All Clear'}
          </span>
        </div>

        <div class="bg-white rounded-lg border border-charcoal-200 px-3 py-2 flex items-center justify-between">
          <div>
            <p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide">Net Disbursed</p>
            <p class="text-lg font-extrabold text-brand-800 leading-tight">${formatEGP(totalNet)}</p>
          </div>
          <span class="text-[10px] text-charcoal-400 font-medium">Gross: ${formatEGP(totalGross)}</span>
        </div>
      </div>

      <!-- MAIN STAFF TABLE (Fills remaining height, inner scroll only) -->
      <div class="bg-white rounded-xl border border-charcoal-200 shadow-2xs flex-1 min-h-0 flex flex-col overflow-hidden">
        <div class="px-3 py-2 border-b border-charcoal-150 flex items-center justify-between bg-charcoal-50/60 flex-shrink-0">
          <div>
            <h2 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">Branch Staff Expense &amp; Payroll Ledger</h2>
            <p class="text-[10px] text-charcoal-400">Select any employee to review their source attendance, deductions, and close their monthly account</p>
          </div>
          <span class="text-[10px] text-charcoal-500 font-semibold">${items.length} records</span>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="sticky top-0 z-10 bg-charcoal-50 border-b border-charcoal-200">
              <tr class="text-[10px] font-semibold text-charcoal-500 uppercase tracking-wider">
                <th class="py-2 px-3">Employee</th>
                <th class="py-2 px-3">Role</th>
                <th class="py-2 px-3 text-right">Base Salary</th>
                <th class="py-2 px-3 text-right">OT &amp; Bonus</th>
                <th class="py-2 px-3 text-right">Deductions</th>
                <th class="py-2 px-3 text-right">Net Final</th>
                <th class="py-2 px-3">Status</th>
                <th class="py-2 px-3 text-right">Action</th>
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
                  <tr onclick="openPayrollDetail('${it.employeeId}')" class="hover:bg-charcoal-50 cursor-pointer transition-colors">
                    <td class="py-2 px-3">
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
                    <td class="py-2 px-3 text-charcoal-600 font-medium">${it.position}</td>
                    <td class="py-2 px-3 text-right font-semibold text-charcoal-900">${formatEGP(base)}</td>
                    <td class="py-2 px-3 text-right text-emerald-600 font-semibold">+ ${formatEGP(additions)}</td>
                    <td class="py-2 px-3 text-right ${deds > 0 ? 'text-red-600' : 'text-charcoal-400'} font-semibold">
                      ${deds > 0 ? `− ${formatEGP(deds)}` : '—'}
                    </td>
                    <td class="py-2 px-3 text-right font-extrabold text-charcoal-900">${formatEGP(net)}</td>
                    <td class="py-2 px-3">
                      <span class="badge ${
                        isClosed ? 'badge-green' : pCount > 0 ? 'badge-yellow' : 'badge-blue'
                      } text-[9px] font-bold">
                        ${isClosed ? 'Closed & Settled' : pCount > 0 ? `${pCount} Actions Needed` : 'Ready to Close'}
                      </span>
                    </td>
                    <td class="py-2 px-3 text-right">
                      <button onclick="event.stopPropagation();openPayrollDetail('${it.employeeId}')" class="btn btn-sm btn-secondary text-[11px] h-6 px-2.5 text-brand-600 font-semibold hover:border-brand-300">
                        Review Sheet →
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
// ==================== VIEW 2: COMPACT EMPLOYEE SETTLEMENT SHEET =====================
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

  // Financial figures
  const base = baseSalaryOf(item);
  const bonus = bonusOf(item);
  const otHours = overtimeHoursOf(item);
  const otPay = overtimePayOf(item);
  const gross = grossOf(item);
  const approvedDeds = approvedDedTotal(item);
  const net = netOf(item);

  return `
    <div class="h-full flex flex-col gap-2 overflow-hidden">

      <!-- SINGLE COMPACT HEADER BAR (Replaces sections 1 & 2!) -->
      <div class="bg-white rounded-lg border border-charcoal-200 px-3 py-1.5 shadow-2xs flex items-center justify-between gap-3 flex-shrink-0">
        <!-- Left: Back button + Employee Switcher -->
        <div class="flex items-center gap-2 min-w-0">
          <button onclick="closePayrollDetail()" class="btn btn-sm btn-secondary text-xs h-7 px-2 flex items-center gap-1 font-semibold" title="Back to All Staff">
            ← All Staff
          </button>

          <span class="text-charcoal-300">|</span>

          <!-- Prev/Next -->
          <div class="flex items-center gap-0.5">
            <button onclick="openPayrollDetail('${prevEmp ? prevEmp.employeeId : ''}')" ${!prevEmp ? 'disabled' : ''} class="h-6 w-6 rounded bg-charcoal-100 hover:bg-charcoal-200 flex items-center justify-center text-xs text-charcoal-700 disabled:opacity-30">‹</button>
            <button onclick="openPayrollDetail('${nextEmp ? nextEmp.employeeId : ''}')" ${!nextEmp ? 'disabled' : ''} class="h-6 w-6 rounded bg-charcoal-100 hover:bg-charcoal-200 flex items-center justify-center text-xs text-charcoal-700 disabled:opacity-30">›</button>
          </div>

          <!-- Employee Dropdown Selector -->
          <select onchange="openPayrollDetail(this.value)" class="form-select text-xs font-bold py-0.5 px-2 bg-charcoal-50 border border-charcoal-200 rounded max-w-[220px] truncate">
            ${items.map(it => `
              <option value="${it.employeeId}" ${it.employeeId === item.employeeId ? 'selected' : ''}>
                ${it.name} (${it.position}) · ${payrollStatus(it)}
              </option>
            `).join('')}
          </select>

          <!-- Status badge -->
          <span class="badge ${isClosed ? 'badge-green' : pendingCount > 0 ? 'badge-yellow' : 'badge-blue'} text-[9px] font-bold">
            ${isClosed ? 'Closed & Settled' : pendingCount > 0 ? `${pendingCount} Actions Needed` : 'Ready to Close'}
          </span>
        </div>

        <!-- Right: Net Pay Callout & Main Closing Action -->
        <div class="flex items-center gap-3 flex-shrink-0">
          <div class="text-right">
            <span class="text-[9px] text-charcoal-400 font-semibold uppercase tracking-wider block">Net Final Pay</span>
            <span class="text-sm font-black text-brand-800">${formatEGP(net)}</span>
          </div>

          ${isClosed ? `
            <div class="flex items-center gap-1.5">
              <span class="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                ✓ Account Closed
              </span>
              ${!locked ? `
                <button onclick="reopenPayrollEmployee('${item.employeeId}')" class="btn btn-sm btn-secondary text-[10px] h-6 px-1.5 text-charcoal-500 hover:text-charcoal-900" title="Re-open for adjustments">
                  Edit
                </button>
              ` : ''}
            </div>
          ` : pendingCount > 0 ? `
            <button disabled class="btn btn-sm btn-secondary text-xs h-7 px-2.5 opacity-60 cursor-not-allowed" title="Approve or waive all deductions first">
              Resolve ${pendingCount} Action${pendingCount > 1 ? 's' : ''} First
            </button>
          ` : `
            <button onclick="acceptPayrollEmployee('${item.employeeId}')" class="btn btn-sm btn-primary text-xs h-7 px-3 font-bold flex items-center gap-1 shadow-2xs">
              ✓ Close &amp; Settle Account
            </button>
          `}
        </div>
      </div>

      <!-- MAIN 2-COLUMN COMPACT WORKSPACE (Fills remaining height) -->
      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-hidden">

        <!-- ==================== LEFT (7 COLS / 60%): FINANCIAL RECONCILIATION ==================== -->
        <div class="lg:col-span-7 flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5">

          <!-- CARD 1: EARNINGS & GROSS PAY -->
          <div class="bg-white rounded-lg border border-charcoal-200 p-2.5 shadow-2xs flex-shrink-0">
            <div class="flex items-center justify-between pb-1.5 border-b border-charcoal-150 mb-1.5">
              <h3 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">1. Monthly Earnings &amp; Additions</h3>
              <span class="text-xs font-extrabold text-charcoal-900">Gross: ${formatEGP(gross)}</span>
            </div>

            <div class="grid grid-cols-3 gap-2 text-xs">
              <div class="p-1.5 rounded bg-charcoal-50 border border-charcoal-100">
                <span class="text-[10px] text-charcoal-500 block">Base Contract Salary</span>
                <span class="font-bold text-charcoal-900 text-xs">${formatEGP(base)}</span>
              </div>

              <div class="p-1.5 rounded bg-charcoal-50 border border-charcoal-100">
                <span class="text-[10px] text-charcoal-500 block">Overtime (${otHours}h logged)</span>
                <span class="font-bold text-emerald-600 text-xs">+ ${formatEGP(otPay)}</span>
              </div>

              <div class="p-1.5 rounded bg-brand-50/50 border border-brand-200 flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-brand-800 block font-semibold">Bonus / Incentive</span>
                  <span class="text-[9px] text-charcoal-400">Editable</span>
                </div>
                <input type="number" min="0" step="50" value="${bonus}" 
                  onchange="commitPayrollBonus('${item.employeeId}', this.value)"
                  ${locked || isClosed ? 'disabled' : ''}
                  class="form-input text-xs h-6 w-16 text-right font-bold text-brand-900 rounded border-brand-300 py-0 px-1" />
              </div>
            </div>
          </div>

          <!-- CARD 2: DEDUCTIONS & EXPENSE RECOVERIES (THE CORE WORK) -->
          <div class="bg-white rounded-lg border border-charcoal-200 p-2.5 shadow-2xs flex flex-col flex-1 min-h-0">
            <div class="flex items-center justify-between pb-1.5 border-b border-charcoal-150 mb-2 flex-shrink-0">
              <div class="flex items-center gap-2">
                <h3 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">2. Deductions &amp; Expense Recoveries</h3>
                <span class="badge ${approvedDeds > 0 ? 'badge-red' : 'badge-gray'} text-[9px] font-bold">
                  − ${formatEGP(approvedDeds)}
                </span>
              </div>
              
              <button onclick="_showAddDeductionForm=!_showAddDeductionForm;renderAll()" ${locked || isClosed ? 'disabled' : ''} class="text-[10px] text-brand-600 hover:text-brand-800 font-bold flex items-center gap-0.5">
                ${_showAddDeductionForm ? '✕ Close Form' : '+ Add Line'}
              </button>
            </div>

            <!-- Inline Add Form if opened -->
            ${_showAddDeductionForm ? `
              <form onsubmit="savePayrollDeductionInline(event, '${item.employeeId}')" class="p-2 rounded bg-charcoal-50 border border-charcoal-200 mb-2 space-y-1.5 text-xs flex-shrink-0">
                <div class="grid grid-cols-3 gap-1.5">
                  <select name="source" class="form-select text-[11px] py-0.5 px-1.5">
                    <option value="manager">Manager Operational Charge</option>
                    <option value="biometric">Biometric Penalty</option>
                  </select>
                  <input name="reason" required placeholder="Reason / Description" class="form-input text-[11px] py-0.5 px-1.5" />
                  <div class="flex gap-1">
                    <input name="amount" type="number" min="0" step="50" required placeholder="Amount (EGP)" class="form-input text-[11px] py-0.5 px-1.5 w-full" />
                    <button type="submit" class="btn btn-sm btn-primary text-[10px] h-6 px-2 flex-shrink-0">Add</button>
                  </div>
                </div>
              </form>
            ` : ''}

            <!-- Deductions List (scrollable) -->
            <div class="space-y-1.5 overflow-y-auto flex-1 min-h-0 pr-0.5">
              ${deductions.length === 0 ? `
                <div class="py-6 text-center text-xs text-charcoal-400">
                  ✓ No deductions or expense recoveries recorded for this employee.
                </div>
              ` : deductions.map(line => {
                const isPending = line.status === 'Pending';
                const isAccepted = line.status === 'Accepted' || line.status === 'Approved';
                const isRejected = line.status === 'Rejected';
                const isBiometric = line.source === 'biometric';

                return `
                  <div class="p-2 rounded-lg border transition-all text-xs ${
                    isPending 
                      ? 'bg-amber-50/60 border-amber-200 ring-1 ring-amber-100' 
                      : isAccepted 
                        ? 'bg-charcoal-50/70 border-charcoal-200' 
                        : 'bg-gray-50 border-gray-200 opacity-50'
                  }">
                    <div class="flex items-center justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class="badge ${isBiometric ? 'badge-blue' : 'badge-purple'} text-[8px] font-bold">
                            ${isBiometric ? 'Biometric' : 'Manager'}
                          </span>
                          <span class="font-bold text-charcoal-900 truncate text-xs">${line.label || line.reason}</span>
                          <span class="text-[9px] font-semibold text-charcoal-400">· ${line.date || ''}</span>
                        </div>
                        <p class="text-[10px] text-charcoal-500 mt-0.5 truncate">${line.reason || '—'}</p>
                      </div>

                      <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="font-bold text-xs ${isRejected ? 'line-through text-charcoal-400' : 'text-red-600'}">
                          − ${formatEGP(line.amount)}
                        </span>

                        ${isPending && !locked && !isClosed ? `
                          <div class="flex items-center gap-1">
                            <button onclick="decidePayrollDeduction('${item.employeeId}', '${line.id}', true)" 
                              class="btn btn-sm btn-success h-5 px-1.5 text-[10px] font-bold">
                              Approve
                            </button>
                            <button onclick="decidePayrollDeduction('${item.employeeId}', '${line.id}', false)" 
                              class="btn btn-sm btn-secondary h-5 px-1.5 text-[10px] text-red-600 font-bold hover:bg-red-50">
                              Waive
                            </button>
                          </div>
                        ` : isAccepted ? `
                          <span class="text-[9px] text-emerald-700 font-bold bg-emerald-100 px-1 py-0.2 rounded">Approved</span>
                        ` : `
                          <span class="text-[9px] text-charcoal-400 font-bold bg-charcoal-100 px-1 py-0.2 rounded line-through">Waived</span>
                        `}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Net Calculation Summary Strip -->
            <div class="mt-2 pt-2 border-t border-charcoal-150 flex items-center justify-between text-xs flex-shrink-0">
              <span class="text-charcoal-500 font-medium">
                ${formatEGP(gross)} gross − ${formatEGP(approvedDeds)} deductions
              </span>
              <div class="flex items-center gap-1.5 font-bold">
                <span class="text-charcoal-700">Net Pay:</span>
                <span class="text-sm font-black text-brand-800">${formatEGP(net)}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- ==================== RIGHT (5 COLS / 40%): SOURCE AUDIT & EVIDENCE ==================== -->
        <div class="lg:col-span-5 flex flex-col gap-2 min-h-0 overflow-y-auto pl-0.5">

          <!-- 1. WORKING DAYS & ATTENDANCE LEDGER -->
          <div class="bg-white rounded-lg border border-charcoal-200 p-2.5 shadow-2xs flex-shrink-0">
            <div class="flex items-center justify-between pb-1 border-b border-charcoal-150 mb-1.5">
              <h3 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">Work Days &amp; Attendance Log</h3>
              <span class="text-[10px] text-charcoal-400 font-semibold">${_payPeriod}</span>
            </div>

            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div class="flex justify-between py-0.5 border-b border-charcoal-100">
                <span class="text-charcoal-500">Days Attended</span>
                <span class="font-bold text-charcoal-900">${item.days || 22} days</span>
              </div>
              <div class="flex justify-between py-0.5 border-b border-charcoal-100">
                <span class="text-charcoal-500">Weekly Offs</span>
                <span class="font-bold text-charcoal-900">4 days</span>
              </div>
              <div class="flex justify-between py-0.5 border-b border-charcoal-100">
                <span class="text-charcoal-500">Approved Leaves</span>
                <span class="font-bold text-charcoal-900">0 days</span>
              </div>
              <div class="flex justify-between py-0.5 border-b border-charcoal-100">
                <span class="text-charcoal-500">Overtime Logged</span>
                <span class="font-bold text-brand-700">${otHours} hrs</span>
              </div>
              <div class="flex justify-between py-0.5">
                <span class="text-charcoal-500">Late Arrivals</span>
                <span class="font-bold ${deductions.some(d => d.source==='biometric') ? 'text-amber-600' : 'text-charcoal-900'}">
                  1 incident
                </span>
              </div>
              <div class="flex justify-between py-0.5">
                <span class="text-charcoal-500">Unexcused Absences</span>
                <span class="font-bold text-charcoal-900">0 days</span>
              </div>
            </div>
          </div>

          <!-- 2. BIOMETRIC PUNCH EVIDENCE -->
          <div class="bg-white rounded-lg border border-charcoal-200 p-2.5 shadow-2xs flex-shrink-0">
            <div class="flex items-center justify-between pb-1 border-b border-charcoal-150 mb-1.5">
              <h3 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">Biometric Punch Proof</h3>
              <button onclick="navigateTo('attendance')" class="text-[10px] text-brand-600 hover:underline font-bold">Attendance Module →</button>
            </div>

            <div class="space-y-1 text-xs">
              <div class="p-1.5 rounded bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <p class="font-bold text-amber-900 text-[11px]">Aug 19 (Late Arrival Exception)</p>
                  <p class="text-[10px] text-charcoal-500">Punch: 08:41 In → 16:02 Out · Terminal #1</p>
                </div>
                <button onclick="openPayrollAttendanceRef('ATT-2608-0417', '${item.employeeId}')" class="btn btn-sm btn-secondary text-[9px] h-5 px-1 font-bold">
                  View Log
                </button>
              </div>

              <div class="p-1.5 rounded bg-charcoal-50 flex items-center justify-between">
                <div>
                  <p class="font-bold text-charcoal-900 text-[11px]">Sep 09 (Regular Punch)</p>
                  <p class="text-[10px] text-charcoal-400">Punch: 08:02 In → 16:00 Out · Biometric</p>
                </div>
                <span class="text-[9px] text-emerald-600 font-bold">On Time</span>
              </div>
            </div>
          </div>

          <!-- 3. LINKED REQUESTS & BM COMMENTS -->
          <div class="bg-white rounded-lg border border-charcoal-200 p-2.5 shadow-2xs flex-1 min-h-0 overflow-y-auto">
            <div class="flex items-center justify-between pb-1 border-b border-charcoal-150 mb-1.5 flex-shrink-0">
              <h3 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">Linked Employee Requests</h3>
              <span class="text-[10px] text-charcoal-400">Context for decisions</span>
            </div>

            ${payrollRequestsFor(item).length === 0 ? `
              <p class="text-xs text-charcoal-400 py-2 text-center">No leave or exception requests logged for this period.</p>
            ` : `
              <div class="space-y-1">
                ${payrollRequestsFor(item).map(req => `
                  <div class="p-1.5 rounded bg-charcoal-50 border border-charcoal-150 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-charcoal-900 text-[11px]">${req.type}</span>
                      <span class="badge ${req.status === 'Approved' ? 'badge-green' : 'badge-red'} text-[8px]">${req.status}</span>
                    </div>
                    <p class="text-[10px] text-charcoal-600 mt-0.5 truncate">${req.reason || 'No reason'}</p>
                    <p class="text-[9px] text-charcoal-400 mt-0.5">BM Decision: <b>${req.bmDecision || '—'}</b> (${req.bmComment || 'Reviewed'})</p>
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
// ==================== INTERACTIVE ACTIONS ===========================================
// ====================================================================================

function openPayrollDetail(id) {
  if (!id) return;
  _payrollEmployeeIdValue = id;
  _payrollView = 'detail';
  _showAddDeductionForm = false;
  renderAll();
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
  showToast(`Deduction added for ${item.name} (${formatEGP(amount)}).`);
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
