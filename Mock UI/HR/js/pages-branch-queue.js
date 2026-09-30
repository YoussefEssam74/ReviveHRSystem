// ==================== BRANCH QUEUE ====================
// Items the Branch Manager portal (Mock UI/Employee/index.html) sends over
// through the shared BranchBridge store: deductions, warning notices and bonus
// proposals — all waiting on an HR decision (features.md §9/§10).
// Approving a deduction/bonus lands it directly in that employee's payroll.

let _bqFilter = 'all';

function branchQueueItems() {
  if (typeof BranchBridge === 'undefined') return [];
  return BranchBridge.read().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function branchQueuePending() {
  if (typeof BranchBridge === 'undefined') return [];
  return BranchBridge.pending();
}

function branchQueueKindBadge(kind) {
  const cls = kind === 'Deduction' ? 'badge-yellow' : kind === 'Bonus' ? 'badge-green' : 'badge-red';
  return `<span class="badge ${cls}">${kind}</span>`;
}

// Audit entries use the mock clock (2026-09-09) + wall-clock time.
function branchStamp() {
  const y = MOCK_TODAY.getFullYear();
  const m = String(MOCK_TODAY.getMonth() + 1).padStart(2, '0');
  const d = String(MOCK_TODAY.getDate()).padStart(2, '0');
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function branchPayrollFor(item) {
  return (MOCK.payrollItems || []).find(p => p.name === item.employee) || null;
}

// ---- Decisions --------------------------------------------------------------
function approveBranchItem(id) {
  applyBranchDecision(id, 'Approved', '');
}

function declineBranchItem(id) {
  const item = typeof BranchBridge !== 'undefined' ? BranchBridge.byId(id) : null;
  if (!item) { showToast('Item not found', 'error'); return; }
  openModal('Decline ' + item.kind.toLowerCase(), `
    <div class="space-y-3">
      <div class="bg-charcoal-50 border border-charcoal-150 rounded-xl p-3">
        <div class="flex items-center gap-2 mb-1">
          ${branchQueueKindBadge(item.kind)}
          <span class="text-xs font-bold text-charcoal-900">${item.employee}</span>
        </div>
        <p class="text-[11px] text-charcoal-600">${item.title}${item.amount ? ' · ' + formatEGP(item.amount) : ''}</p>
        <p class="text-[10px] text-charcoal-400 mt-0.5">Sent by ${item.issuedBy || 'Branch Manager'} · ${item.gym || '—'} · ${formatDate(item.date)}</p>
      </div>
      <div class="bg-red-50 border border-red-100 rounded-lg p-2.5 text-[10px] text-red-700 leading-relaxed">
        Declining returns the item to the Branch Manager with your reason. Nothing is applied to payroll or the employee record.
      </div>
      <div>
        <label class="form-label">Reason for declining <span class="text-red-500">*</span></label>
        <textarea id="bq-note" class="form-input" rows="3" placeholder="e.g. Amount exceeds branch budget — resubmit with area manager approval"></textarea>
      </div>
    </div>`, {
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
             <button onclick="confirmDeclineBranchItem('${item.id}')" class="btn btn-sm btn-primary">Decline item</button>`
  });
}

function confirmDeclineBranchItem(id) {
  const ta = document.getElementById('bq-note');
  const note = ta ? ta.value.trim() : '';
  if (!note) { showToast('A reason is required to decline', 'error'); return; }
  applyBranchDecision(id, 'Rejected', note);
}

// Records the decision in the shared store, applies side effects, audits it.
function applyBranchDecision(id, decision, note) {
  if (typeof BranchBridge === 'undefined') { showToast('Bridge not loaded', 'error'); return; }
  const item = BranchBridge.byId(id);
  if (!item) { showToast('Item not found', 'error'); return; }
  if (item.status !== 'Pending HR') { showToast('This item was already decided', 'info'); return; }

  BranchBridge.decide(id, decision, MOCK.currentUser.fullName, note || '');

  // --- Side effects: approved money moves into payroll ---
  let payrollMsg = '';
  const p = branchPayrollFor(item);
  if (decision === 'Approved' && p) {
    if (item.kind === 'Deduction') {
      const already = (p.deductionLines || []).some(l => l.branchRef === id);
      if (!already) {
        p.deductionLines.push({
          id: 'bl-' + id,
          date: item.date || '2026-09-09',
          label: 'Branch deduction',
          amount: Number(item.amount) || 0,
          reason: (item.title || 'Branch manager deduction') + (item.note ? ' — ' + item.note : ''),
          source: 'manager', attendanceRef: null, requestId: null,
          branchRef: id, status: 'Accepted'
        });
        payrollSyncTotals(p);
        payrollMsg = ` ${formatEGP(item.amount)} applied to ${item.employee}'s payroll.`;
      }
    } else if (item.kind === 'Bonus') {
      const already = (p.relatedBonusRefs || []).includes(id);
      if (!already) {
        p.bonus = bonusOf(p) + (Number(item.amount) || 0);
        p.relatedBonusRefs = (p.relatedBonusRefs || []).concat(id);
        payrollSyncTotals(p);
        payrollMsg = ` ${formatEGP(item.amount)} added to ${item.employee}'s payroll.`;
      }
    }
    // Warnings are filed to the employee record — no payroll effect.
  }

  // --- Audit trail (Activity / Audit Log page) ---
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Branch ' + item.kind + ' ' + decision,
    user: MOCK.currentUser.fullName,
    target: item.employee,
    detail: (item.title || item.kind) + (item.amount ? ' — EGP ' + item.amount : '') +
            ' · sent by ' + (item.issuedBy || 'Branch Manager') + (note ? ' · ' + note : ''),
    timestamp: branchStamp(),
    gym: item.gym || 'All'
  });

  closeModal();
  showToast(`${item.kind} for ${item.employee} ${decision.toLowerCase()}${payrollMsg}`,
    decision === 'Approved' ? 'success' : 'info');
  renderAll();
}

// ---- Page renderer ----------------------------------------------------------
function renderBranchQueue() {
  const items = branchQueueItems();
  const pending = items.filter(i => i.status === 'Pending HR');
  const nDed = items.filter(i => i.kind === 'Deduction').length;
  const nWarn = items.filter(i => i.kind === 'Warning').length;
  const nBonus = items.filter(i => i.kind === 'Bonus').length;

  let shown = items;
  if (_bqFilter === 'pending') shown = pending;
  else if (_bqFilter === 'deductions') shown = items.filter(i => i.kind === 'Deduction');
  else if (_bqFilter === 'warnings') shown = items.filter(i => i.kind === 'Warning');
  else if (_bqFilter === 'bonuses') shown = items.filter(i => i.kind === 'Bonus');

  const tab = (id, label, n) => `<button onclick="_bqFilter='${id}';renderAll()" class="px-2.5 py-1 rounded-md font-medium transition-all ${_bqFilter===id?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600 hover:text-charcoal-900'}">${label} (${n})</button>`;

  return `
  <div class="h-full flex flex-col gap-2.5 overflow-hidden font-sans text-charcoal-800">

    <!-- Header -->
    <div class="flex items-center justify-between flex-shrink-0 pt-0.5">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-base font-bold text-charcoal-900 tracking-tight">Branch Manager Submissions</h1>
          <span class="badge badge-purple">Live link</span>
        </div>
        <p class="text-[11px] text-charcoal-500 mt-0.5">Deductions, warnings & bonuses sent from the Branch portal — decided here, applied automatically.</p>
      </div>
      <div class="flex items-center gap-2">
        ${pending.length ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">${pending.length} waiting on you</span>` : ''}
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="flex items-center gap-1 bg-charcoal-100/70 p-1 rounded-lg flex-shrink-0 w-fit text-[11px]">
      ${tab('all', 'All', items.length)}
      ${tab('pending', 'Pending', pending.length)}
      ${tab('deductions', 'Deductions', nDed)}
      ${tab('warnings', 'Warnings', nWarn)}
      ${tab('bonuses', 'Bonuses', nBonus)}
    </div>

    <!-- List -->
    <div class="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
      ${shown.length === 0 ? `
        <div class="py-14 text-center">
          <svg class="w-10 h-10 mx-auto mb-3 text-charcoal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <p class="text-xs font-semibold text-charcoal-600">${items.length === 0 ? 'No submissions yet' : 'Nothing matches this filter'}</p>
          <p class="text-[11px] text-charcoal-400 mt-1 max-w-sm mx-auto">${items.length === 0
            ? 'When a Branch Manager issues a deduction, warning or bonus in their portal, it lands here the moment they press “Send to HR”.'
            : 'Switch back to <b>All</b> to see every submission.'}</p>
        </div>
      ` : shown.map(i => {
        const isPending = i.status === 'Pending HR';
        return `
        <div class="bg-white rounded-xl border border-charcoal-200 shadow-2xs p-3 hover:border-charcoal-300 transition-all">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                ${branchQueueKindBadge(i.kind)}
                <h3 class="text-xs font-bold text-charcoal-900">${i.employee}</h3>
                ${statusBadge(isPending ? 'Pending' : i.status)}
                ${i.gym ? `<span class="text-[9px] text-charcoal-400 font-medium">📍 ${i.gym}</span>` : ''}
              </div>
              <p class="text-[11px] text-charcoal-700 font-medium">${i.title || '—'}${i.amount ? ` · <span class="font-bold">${formatEGP(i.amount)}</span>` : ''}</p>
              <p class="text-[10px] text-charcoal-400 mt-0.5">Sent by <b>${i.issuedBy || 'Branch Manager'}</b> · ${formatDate(i.date)}${i.id ? ' · #' + i.id : ''}</p>
              ${i.note ? `<p class="text-[10px] text-charcoal-500 bg-charcoal-50 border border-charcoal-150 rounded-lg p-2 mt-1.5 leading-relaxed">📝 ${i.note}</p>` : ''}
              ${!isPending && i.decidedBy ? `
                <p class="text-[10px] mt-1.5 ${i.status === 'Approved' ? 'text-green-700' : 'text-red-600'} font-medium">
                  ✓ ${i.status} by <b>${i.decidedBy}</b>${i.decidedNote ? ' — ' + i.decidedNote : ''}
                </p>` : ''}
            </div>
            ${isPending ? `
              <div class="flex flex-col gap-1.5 flex-shrink-0">
                <button onclick="approveBranchItem('${i.id}')" class="btn btn-sm btn-success text-[11px] h-7 px-3">Approve</button>
                <button onclick="declineBranchItem('${i.id}')" class="btn btn-sm btn-secondary text-[11px] h-7 px-3 text-charcoal-500 hover:text-red-600">Decline</button>
              </div>` : ''}
          </div>
          ${isPending && i.kind === 'Deduction' ? `<p class="text-[9px] text-charcoal-400 mt-2 border-t border-charcoal-100 pt-1.5">Approving adds EGP ${i.amount || 0} to ${i.employee}'s payroll as an accepted manager deduction.</p>` : ''}
          ${isPending && i.kind === 'Bonus' ? `<p class="text-[9px] text-charcoal-400 mt-2 border-t border-charcoal-100 pt-1.5">Approving adds EGP ${i.amount || 0} to ${i.employee}'s payroll bonus.</p>` : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- Footer -->
    <div class="px-3 py-1.5 bg-charcoal-50/60 border border-charcoal-150 rounded-lg flex items-center justify-between text-[10px] text-charcoal-400 flex-shrink-0">
      <span>Linked to the Branch Manager portal — decisions sync back to their “Awaiting HR” badge instantly.</span>
      <button onclick="navigateTo('payroll')" class="text-brand-600 hover:text-brand-800 font-semibold">Payroll →</button>
    </div>
  </div>`;
}

// Re-apply persisted HR decisions to payroll after a reload (MOCK resets on
// every load, the bridge does not). Idempotent via branchRef / relatedBonusRefs.
function branchQueueRehydratePayroll() {
  branchQueueItems().forEach(item => {
    if (item.status !== 'Approved') return;
    const p = branchPayrollFor(item);
    if (!p) return;
    if (item.kind === 'Deduction' && !(p.deductionLines || []).some(l => l.branchRef === item.id)) {
      p.deductionLines.push({
        id: 'bl-' + item.id, date: item.date || '2026-09-09', label: 'Branch deduction',
        amount: Number(item.amount) || 0,
        reason: (item.title || 'Branch manager deduction') + (item.note ? ' — ' + item.note : ''),
        source: 'manager', attendanceRef: null, requestId: null,
        branchRef: item.id, status: 'Accepted'
      });
      payrollSyncTotals(p);
    } else if (item.kind === 'Bonus' && !(p.relatedBonusRefs || []).includes(item.id)) {
      p.bonus = bonusOf(p) + (Number(item.amount) || 0);
      p.relatedBonusRefs = (p.relatedBonusRefs || []).concat(item.id);
      payrollSyncTotals(p);
    }
  });
}
branchQueueRehydratePayroll();

// ---- Recruitment (vacancy) bridge → HR -------------------------------------
// Pulls vacancy requests created in the Branch Manager portal into
// MOCK.vacancyRequests so they appear in the recruitment tab, the dashboard
// "Vacancies" actions and the nav badge. Idempotent: existing ids are skipped.
function vacancyBridgeImportHr() {
  if (typeof VacancyBridge === 'undefined') return [];
  const created = [];
  VacancyBridge.read().forEach(e => {
    if ((MOCK.vacancyRequests || []).some(v => v.id === e.id)) return;
    const decided = e.status === 'Approved' || e.status === 'Rejected';
    const vr = {
      id: e.id,
      position: e.position || 'Open Role',
      gym: e.gym || 'Nasr City',
      urgency: e.urgency || 'Medium',
      status: decided ? e.status : 'Pending',
      submittedBy: e.requestedBy || 'Branch Manager',
      submittedDate: e.date || '2026-09-06',
      reason: e.reason || '',
      headcount: Number(e.count) || 1,
      department: e.department || '',
      source: 'branch',
      decidedBy: decided ? (e.decidedBy || 'HR') : null
    };
    MOCK.vacancyRequests.unshift(vr);
    created.push(vr);
    vacancyRehydrateOpen(vr);
  });
  return created;
}

// Reload-safe: an already-approved branch request must still have its open
// vacancy card. Skips when a matching open vacancy (or branchRef) exists.
function vacancyRehydrateOpen(vr) {
  if (vr.status !== 'Approved') return;
  const dup = (MOCK.vacancies || []).some(v =>
    (v.branchRef && v.branchRef === vr.id) ||
    (v.position === vr.position && v.gym === vr.gym && v.status === 'Open'));
  if (dup) return;
  MOCK.vacancies.unshift({
    id: 'v-' + Date.now().toString(36),
    position: vr.position, gym: vr.gym, headcount: vr.headcount || 1,
    urgency: vr.urgency || 'Medium', status: 'Open',
    createdDate: '2026-09-09', candidates: 0, applied: 0, postedDate: '2026-09-09',
    branchRef: vr.id
  });
}

vacancyBridgeImportHr(); // silent initial import — runs before first render
let _vqLastCount = (MOCK.vacancyRequests || []).length;

// Live link: fires when the Branch Manager portal pushes a new request.
function vacancyBridgeHrRefresh() {
  const created = vacancyBridgeImportHr();
  if (_vqLastCount !== null && created.length) {
    showToast(`Branch Manager sent ${created.length} vacancy request${created.length > 1 ? 's' : ''} for review`, 'info');
  }
  _vqLastCount = (MOCK.vacancyRequests || []).length;
  if (typeof state !== 'undefined' && ['dashboard', 'recruitment'].includes(state.currentPage)) renderAll();
}

// ---- Live link --------------------------------------------------------------
// Re-render when the Branch Manager portal pushes/changes the queue.
let _bqLastCount = null;
function branchQueueRefresh() {
  const n = branchQueuePending().length;
  if (_bqLastCount !== null && n > _bqLastCount) {
    showToast(`Branch Manager sent ${n - _bqLastCount} item${n - _bqLastCount > 1 ? 's' : ''} for review`, 'info');
  }
  _bqLastCount = n;
  if (typeof state !== 'undefined' && ['dashboard', 'branch-queue'].includes(state.currentPage)) renderAll();
}
if (typeof BranchBridge !== 'undefined') {
  BranchBridge.onChange(branchQueueRefresh);
  window.addEventListener('focus', branchQueueRefresh);
  _bqLastCount = branchQueuePending().length; // baseline — only future pushes toast
}
if (typeof VacancyBridge !== 'undefined') {
  VacancyBridge.onChange(vacancyBridgeHrRefresh);
  window.addEventListener('focus', vacancyBridgeHrRefresh);
}
