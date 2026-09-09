// ==================== PAYROLL ====================
let _payPeriod = 'Aug 2026';
let _payStep = 2;

function renderPayroll() {
  const showAll = DEMO.showAll;
  const canEdit = showAll || hasPermission('payroll.edit');
  const canApprove = showAll || hasPermission('payroll.approve');
  const canExport = showAll || hasPermission('payroll.export');

  const payroll = MOCK.payrollItems;
  const totalGross = payroll.reduce((s, p) => s + p.gross, 0);
  const totalNet = payroll.reduce((s, p) => s + p.net, 0);
  const totalDed = payroll.reduce((s, p) => s + p.deductions, 0);
  const approved = payroll.filter(p => p.status === 'Approved').length;
  const locked = payroll.filter(p => p.status === 'Locked').length;
  const drafts = payroll.filter(p => p.status === 'Draft');

  const steps = ['Import', 'Review', 'Approve', 'Publish'];
  const stepMeta = ['Payroll data loaded', 'Review payslips', 'HR approval', 'Release for payment'];
  const lastCycleNet = MOCK.payroll.find(p => p.period === 'July 2026') ? 1295000 : totalNet;
  const monthDelta = Math.round(((totalNet - lastCycleNet) / mathMax(lastCycleNet, 1)) * 100);

  const activity = [
    { t: 'August 2026 payroll imported from biometric + HR data', when: 'Sep 5, 09:12', by: 'Mona El-Sayed' },
    { t: 'Overtime confirmed for Omar Youssef (16h)', when: 'Sep 6, 14:40', by: 'Youssef Kamal' },
    { t: '3 absent days factored for Yasmin Adel', when: 'Sep 7, 10:05', by: 'Mona El-Sayed' },
    { t: 'Deduction batch: social insurance + loans', when: 'Sep 8, 16:22', by: 'Mona El-Sayed' },
  ];

  const stepper = `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-center">
      ${steps.map((s, i) => {
        const n = i + 1;
        const done = _payStep > n;
        const cur = _payStep === n;
        return `<div class="flex items-center flex-1">
          <div class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${done ? 'bg-brand-500 text-white' : cur ? 'bg-brand-100 text-brand-700 border border-brand-500' : 'bg-charcoal-100 text-charcoal-500'}">${done ? '✓' : n}</span>
            <div><p class="text-[10px] font-semibold ${cur ? 'text-brand-700' : done ? 'text-charcoal-700' : 'text-charcoal-400'}">${s}</p><p class="text-[8px] text-charcoal-400 hidden sm:block">${stepMeta[i]}</p></div>
          </div>
          ${i < steps.length - 1 ? `<div class="flex-1 h-px mx-2 ${_payStep > n ? 'bg-brand-400' : 'bg-charcoal-100'}"></div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>`;

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Payroll</h1><p class="text-xs text-charcoal-500 mt-0.5">${_payPeriod} pay cycle · ${payroll.length} records loaded</p></div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <select class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>Aug 2026</option><option>Jul 2026</option><option>Jun 2026</option></select>
        <select class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>All Gyms</option><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select>
        ${canExport ? `<button onclick="exportPayroll()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Export</button>` : ''}
        ${canEdit ? `<button onclick="openPayrollSettings()" class="btn btn-sm btn-ghost">Settings</button>` : ''}
      </div>
    </div>

    <!-- Cycle stepper -->
    ${stepper}

    <!-- Move step buttons -->
    <div class="flex items-center gap-2">
      ${canApprove ? `<button onclick="_payStep=Math.max(1,_payStep-1);renderAll()" class="btn btn-sm btn-secondary">◀ Previous step</button>
      ${_payStep === 3 ? `<button onclick="showToast('Payroll cycle approved & published for 25th');_payStep=4;renderAll();" class="btn btn-sm btn-success">Approve & Publish Cycle</button>` : `<button onclick="_payStep=Math.min(4,_payStep+1);renderAll()" class="btn btn-sm btn-primary">Next step ▶</button>`}` : ''}
      <span class="text-[10px] text-charcoal-400">Step ${_payStep} of 4 — ${steps[_payStep - 1]}</span>
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><p class="text-lg font-bold text-brand-600">EGP ${fmtMoney(totalNet)}</p><p class="text-[10px] text-charcoal-500">Total Net Pay</p><p class="text-[9px] text-green-600 mt-0.5">▲ ${monthDelta > 0 ? monthDelta : Math.abs(monthDelta)}% vs July</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-charcoal-900">EGP ${fmtMoney(totalGross)}</p><p class="text-[10px] text-charcoal-500">Total Gross</p><p class="text-[9px] text-charcoal-400 mt-0.5">${totalDed > 0 ? `EGP ${fmtMoney(totalDed)} in deductions` : ''}</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-charcoal-900">${approved}<span class="text-[10px] font-normal text-charcoal-400">/${payroll.length}</span></p><p class="text-[10px] text-charcoal-500">Approved</p><p class="text-[9px] text-charcoal-400 mt-0.5">${drafts.length} still editable</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-green-600">${locked}</p><p class="text-[10px] text-charcoal-500">Released / Locked</p><p class="text-[9px] text-charcoal-400 mt-0.5">Payday: 25th</p></div>
    </div>

    <!-- Table + activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="lg:col-span-2 bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Gym</th><th>Days</th><th>Overtime</th><th class="text-right">Gross</th><th class="text-right">Deductions</th><th class="text-right">Net</th><th>Status</th><th></th></tr></thead>
        <tbody>${payroll.map(p => `<tr>
          <td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${p.name.split(' ').map(w => w[0]).join('')}</div><div><p class="text-xs font-medium text-charcoal-900">${p.name}</p><p class="text-[10px] text-charcoal-500">${p.employeeId}</p></div></div></td>
          <td class="text-xs">${p.gym}</td>
          <td class="text-xs">${p.days}</td>
          <td class="text-xs">${p.overtime}h</td>
          <td class="text-xs text-right font-medium text-charcoal-700">EGP ${fmtMoney(p.gross)}</td>
          <td class="text-xs text-right text-red-600">- ${fmtMoney(p.deductions)}</td>
          <td class="text-xs text-right font-bold text-charcoal-900">EGP ${fmtMoney(p.net)}</td>
          <td>${payslipStatusBadge(p.status)}</td>
          <td><div class="flex justify-end gap-1">${canEdit && p.status === 'Draft' ? `<button onclick="openPayrollEdit('${p.employeeId}')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>` : ''}<button onclick="openPayslip('${p.employeeId}')" class="btn btn-sm btn-ghost">Payslip</button></div></td>
        </tr>`).join('')}</tbody></table></div>
      </div>

      <!-- Activity feed -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">CYCLCE ACTIVITY</p></div>
        <div class="divide-y divide-charcoal-50">${activity.map(a => `<div class="p-3 flex items-start gap-2.5">
          <span class="w-2 h-2 rounded-full bg-brand-400 mt-1.5 flex-shrink-0"></span>
          <div><p class="text-[11px] text-charcoal-800 leading-snug">${a.t}</p><p class="text-[9px] text-charcoal-400 mt-0.5">${a.when} · by ${a.by}</p></div>
        </div>`).join('')}</div>
      </div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${payroll.map(p => `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${p.name.split(' ').map(w => w[0]).join('')}</div><div><p class="text-xs font-medium text-charcoal-900">${p.name}</p><p class="text-[10px] text-charcoal-500">${p.gym}</p></div></div>
        ${payslipStatusBadge(p.status)}
      </div>
      <div class="flex justify-between mt-2 text-[11px]"><span class="text-charcoal-500">Net Pay</span><span class="font-bold text-charcoal-900">EGP ${fmtMoney(p.net)}</span></div>
      <div class="flex justify-between text-[10px] text-charcoal-400"><span>Gross ${fmtMoney(p.gross)}</span><span>Deduct - ${fmtMoney(p.deductions)}</span></div>
      <div class="flex gap-1.5 mt-2">${canEdit && p.status === 'Draft' ? `<button onclick="openPayrollEdit('${p.employeeId}')" class="btn btn-sm btn-secondary flex-1 text-[10px]">Edit</button>` : ''}<button onclick="openPayslip('${p.employeeId}')" class="btn btn-sm btn-secondary flex-1 text-[10px]">Payslip</button></div>
    </div>`).join('')}</div>

    <!-- Action banner -->
    <div class="bg-white rounded-xl border border-brand-200 border-l-4 border-l-brand-500 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <p class="text-xs font-semibold text-charcoal-900">PAYROLL — ${_payPeriod}</p>
        <p class="text-[10px] text-charcoal-500">${drafts.length} draft payslips ${canEdit ? 'editable until approved.' : ''} Payments scheduled for the 25th. ${locked} of ${payroll.length} released.</p>
      </div>
      <div class="flex gap-1.5 flex-wrap">
        ${canApprove ? `<button onclick="showToast('All drafts approved')" class="btn btn-sm btn-secondary">Approve Drafts</button>` : ''}
        ${canApprove ? `<button onclick="showToast('Payroll locked & scheduled for 25th');_payStep=4;renderAll();" class="btn btn-sm btn-primary">Lock Cycle</button>` : ''}
      </div>
    </div>

    ${!canEdit ? `<p class="text-[10px] text-charcoal-400 text-center">Payroll edits require <code>payroll.edit</code> (HR Manager). View-only.</p>` : ''}
  </div>`;
}

function payslipStatusBadge(s) {
  const map = { Draft: 'badge-blue', Approved: 'badge-brand', Locked: 'badge-success' };
  return `<span class="badge ${map[s] || 'badge-gray'} text-[9px]">${s}</span>`;
}

function fmtMoney(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function mathMax(a, b) { return a > b ? a : b; }

function openPayrollEdit(id) {
  const p = MOCK.payrollItems.find(x => x.employeeId === id); if (!p) return;
  openModal(`Edit Payroll — ${p.name}`, `<form onsubmit="event.preventDefault();showToast('Payroll updated');closeModal();" class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-2.5 flex justify-between text-xs"><span class="text-charcoal-500">Gross Salary</span><span class="font-semibold text-charcoal-900">EGP ${fmtMoney(p.gross)}</span></div>
    <div><label class="form-label">Days Worked</label><input type="number" class="form-input" value="${p.days}"></div>
    <div><label class="form-label">Overtime Hours</label><input type="number" class="form-input" value="${p.overtime}"></div>
    <div><label class="form-label">Deductions (EGP)</label><input type="number" step="1" class="form-input" value="${p.deductions}"></div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-brand-50 rounded-lg p-2.5 text-center"><p class="text-[9px] text-brand-700 uppercase">Net (auto)</p><p class="text-sm font-bold text-brand-700">EGP ${fmtMoney(p.net)}</p></div>
      <div><label class="form-label">Status</label><select class="form-select"><option>Draft</option><option>Approved</option><option>Locked</option></select></div>
    </div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save</button></div>
  </form>`);
}

function openPayslip(id) {
  const p = MOCK.payrollItems.find(x => x.employeeId === id); if (!p) return;
  const allowExport = DEMO.showAll || hasPermission('payroll.export');
  const basic = p.gross;
  const otPay = Math.round(p.gross / 22 / 8 * p.overtime * 1.5);
  const total = basic + otPay - p.deductions;
  openModal(`Payslip — ${_payPeriod}`, `<div class="payslip">
    <div class="flex justify-between items-start border-b-2 border-charcoal-200 pb-3">
      <div><p class="text-base font-bold text-brand-700">REVIVE GYM</p><p class="text-[10px] text-charcoal-500">Human Resources · Payroll</p></div>
      <p class="text-[10px] font-bold text-charcoal-700">PAYSLIP<br><span class="text-charcoal-400 font-medium">${_payPeriod}</span></p>
    </div>
    <div class="grid grid-cols-2 gap-y-2 py-3 text-[11px]">
      <div><p class="text-[9px] uppercase text-charcoal-400">Employee</p><p class="font-medium text-charcoal-800">${p.name}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">ID</p><p class="font-medium text-charcoal-800">${p.employeeId}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">Gym</p><p class="font-medium text-charcoal-800">${p.gym}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">Days / OT</p><p class="font-medium text-charcoal-800">${p.days} days · ${p.overtime}h</p></div>
    </div>
    <div class="grid grid-cols-2 gap-y-1.5 border-t border-charcoal-100 py-3 text-[11px]">
      <p class="text-charcoal-500">Basic Salary</p><p class="text-right text-charcoal-800">EGP ${fmtMoney(basic)}</p>
      <p class="text-charcoal-500">Overtime (${p.overtime}h × 1.5x)</p><p class="text-right text-charcoal-800">EGP ${fmtMoney(otPay)}</p>
      <p class="text-charcoal-500 text-red-600">Deductions</p><p class="text-right text-red-600">- EGP ${fmtMoney(p.deductions)}</p>
      <div class="border-t border-charcoal-100 col-span-2 flex justify-between pt-2"><p class="font-semibold text-charcoal-900">NET PAY</p><p class="font-bold text-brand-700">EGP ${fmtMoney(total)}</p></div>
    </div>
    <div class="flex items-center justify-between border-t border-dashed border-charcoal-200 pt-3">
      <p class="text-[9px] text-charcoal-400">Sealed · Revive gyms</p>
      ${allowExport ? `<button onclick="showToast('Payslip exported as PDF')" class="btn btn-sm btn-secondary">Export PDF</button>` : ''}
    </div>
  </div>`, { wide: true, footer: '<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}

function exportPayroll() {
  openModal('Export Payroll', `<div class="space-y-3">
    <p class="text-[11px] text-charcoal-600">Export the ${_payPeriod} payroll for selected gyms as an Excel file.</p>
    <div class="flex flex-wrap gap-2 my-1">
      ${['Nasr City', 'Heliopolis', '6th October'].map(g => `<label class="flex items-center gap-1.5 bg-charcoal-50 rounded-lg p-2 cursor-pointer"><input type="checkbox" checked class="rounded"><span class="text-[10px] text-charcoal-700">${g}</span></label>`).join('')}
    </div>
    <div class="flex justify-end gap-2"><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="showToast('Payroll exported as Excel');closeModal();" class="btn btn-sm btn-primary">Export .xlsx</button></div>
  </div>`);
}

function openPayrollSettings() {
  openModal('Payroll Settings', `<form class="space-y-3" onsubmit="event.preventDefault();showToast('Settings saved');closeModal();">
    <div><label class="form-label">Pay Day (of month)</label><select class="form-select"><option>25th</option><option>1st</option><option>Last day</option></select></div>
    <div><label class="form-label">Default Overtime Rate</label><input class="form-input" value="1.5x hourly"></div>
    <div><label class="form-label">Auto-approve under threshold</label><select class="form-select"><option>Enabled</option><option>Disabled</option></select></div>
    <div><label class="form-label">Rounding</label><input class="form-input" value="Round to nearest EGP"></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Settings</button></div>
  </form>`);
}