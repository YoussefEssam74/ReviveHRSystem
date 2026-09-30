// ==================== REQUESTS ====================
let _reqFilter = 'pending';
let _reqType = 'all';
let _reqQuick = null;
const QUICK_LABELS = { urgent: 'Urgent', approved: 'Approved', bmRejected: 'BM Rejected', balance: 'Balance alerts' };

function toggleReqQuick(key) {
  _reqQuick = _reqQuick === key ? null : key;
  renderAll();
}

function adjustLeaveBal(r, delta) {
  const key = r.type === 'Day Off' ? 'dayOff' : (r.type === 'Sick Leave' ? 'sick' : null);
  if (!key) return;
  const lb = (MOCK.leaveBalances || {})[r.employee];
  if (!lb || !lb[key]) return;
  lb[key].used = Math.max(0, lb[key].used + delta);
}

function reqPaymentLabel(r) {
  if (r.status !== 'Approved') return null;
  const b = reqLeaveBalance(r); if (!b) return null;
  const p = r.payment || (b.left <= 0 ? 'unpaid' : 'paid');
  return p === 'paid' ? 'Paid' : 'Unpaid';
}

function renderRequests() {
  const showAll = DEMO.showAll;
  const canDecide = showAll || hasPermission('requests.approve');

  const all = MOCK.requests;
  const pendingHR = all.filter(r => r.status === 'Pending HR Review');
  const decided = all.filter(r => r.status !== 'Pending HR Review' && r.status !== 'Archived');
  const archived = all.filter(r => r.status === 'Archived');
  const approvedThisMonth = decided.filter(r => r.status === 'Approved').length;
  const bmRejected = all.filter(r => r.bmDecision === 'Rejected').length;
  const urgent = pendingHR.filter(r => reqUrgency(r) === 'Urgent').length;
  const balAlerts = pendingHR.filter(r => { const b = reqLeaveBalance(r); return b && b.left <= 0; }).length;

  let list;
  if (_reqQuick) {
    const alertIds = new Set(pendingHR.filter(r => { const b = reqLeaveBalance(r); return b && b.left <= 0; }).map(r => r.id));
    list = all.filter(r =>
      _reqQuick === 'urgent' ? (r.status === 'Pending HR Review' && reqUrgency(r) === 'Urgent') :
      _reqQuick === 'approved' ? r.status === 'Approved' :
      _reqQuick === 'bmRejected' ? r.bmDecision === 'Rejected' :
      alertIds.has(r.id));
  } else {
    list = _reqFilter === 'pending' ? pendingHR : (_reqFilter === 'decided' ? decided : archived);
  }
  if (_reqType !== 'all') list = list.filter(r => r.type === _reqType);

  const kpiTile = (key, value, valueCls, label, accent) => `<button onclick="toggleReqQuick('${key}')" title="Click to filter this list" class="rounded-xl border border-charcoal-200 px-2 py-1 text-center transition hover:bg-charcoal-50 ${accent || ''} ${_reqQuick === key ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white'}"><p class="text-sm font-bold leading-none ${valueCls}">${value}</p><p class="text-[9px] text-charcoal-500 mt-1 leading-none">${label}</p></button>`;
  const kpi = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
    ${kpiTile('urgent', `${urgent}<span class="text-[10px] font-normal text-charcoal-400">/${pendingHR.length}</span>`, 'text-red-600', 'Urgent — Pending HR', 'border-l-4 border-l-red-500')}
    ${kpiTile('approved', approvedThisMonth, 'text-brand-600', 'Approved (Sept)')}
    ${kpiTile('bmRejected', bmRejected, 'text-charcoal-900', 'BM Rejected')}
    ${kpiTile('balance', balAlerts, balAlerts ? 'text-red-600' : 'text-charcoal-900', 'Balance Alerts', balAlerts ? 'border-l-4 border-l-red-500' : '')}
  </div>`;

  let body = `<div class="flex items-center justify-between mb-2 flex-wrap gap-2 flex-shrink-0">
    <div class="flex items-center gap-1 bg-charcoal-100 rounded-lg p-0.5">
      <button onclick="_reqQuick=null;_reqFilter='pending';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${!_reqQuick && _reqFilter==='pending'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">Pending HR${pendingHR.length?` <span class="badge badge-red text-[9px]">${pendingHR.length}</span>`:''}</button>
      <button onclick="_reqQuick=null;_reqFilter='decided';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${!_reqQuick && _reqFilter==='decided'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">Decided${decided.length?` <span class="badge badge-gray text-[9px]">${decided.length}</span>`:''}</button>
      <button onclick="_reqQuick=null;_reqFilter='archived';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${!_reqQuick && _reqFilter==='archived'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">Archived${archived.length?` <span class="badge badge-gray text-[9px]">${archived.length}</span>`:''}</button>
    </div>
    <div class="flex items-center gap-1.5 flex-wrap">
      ${_reqQuick ? `<button onclick="toggleReqQuick('${_reqQuick}')" class="badge badge-blue text-[9px] cursor-pointer hover:opacity-75" title="Click to clear the filter">${QUICK_LABELS[_reqQuick]} ✕</button>` : ''}
      <select onchange="_reqType=this.value;renderAll()" class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.75rem">
        <option value="all">All Types</option>
        ${Object.keys(REQ_ICONS).map(t=>`<option value="${t}" ${_reqType===t?'selected':''}>${t} (${all.filter(r=>r.type===t).length})</option>`).join('')}
      </select>
      ${canDecide && pendingHR.length && _reqFilter==='pending' && !_reqQuick ? `<button onclick="bulkApproveRequests()" class="btn btn-sm btn-primary">Bulk Approve</button>` : ''}
    </div>
  </div>`;

  if (!list.length) {
    body += `<div class="bg-white rounded-xl border border-charcoal-200 p-4 text-center"><svg class="w-8 h-8 text-charcoal-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/></svg><p class="text-xs text-charcoal-500">No requests here.</p></div>`;
  } else {
    body += `<div class="space-y-1.5">${list.map(renderRequestCard).join('')}</div>`;
  }

  return `<div class="space-y-2.5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div><h1 class="text-base font-bold text-charcoal-900">Requests</h1><p class="text-xs text-charcoal-500 mt-0.5">Day off, sick leave & approvals — BM & HR flow, HR picks paid/unpaid</p></div>
      <button onclick="openNewRequest()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Request</button>
    </div>
    ${kpi}
    ${body}
    ${!canDecide ? `<p class="text-[10px] text-charcoal-400 text-center">Final approve/reject requires <code>requests.approve</code>. You can view requests and BM decisions only.</p>` : ''}
  </div>`;
}

const REQ_ICONS = {
  'Day Off': 'M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'Leave Early': 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  'Late Arrival': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  'Shift Swap': 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  'Resignation': 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  'Sick Leave': 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v8M8 12h8',
};

function reqEmp(r) { return MOCK.employees.find(e => e.name === r.employee) || null; }

function reqTenure(hireDate) {
  const h = parseDisplayDate(hireDate); if (!h) return '';
  let m = (MOCK_TODAY.getFullYear() - h.getFullYear()) * 12 + (MOCK_TODAY.getMonth() - h.getMonth());
  if (MOCK_TODAY.getDate() < h.getDate()) m--;
  if (m < 1) return '<1 mo';
  const y = Math.floor(m / 12), mo = m % 12;
  return y ? `${y}y ${mo}m` : `${mo}m`;
}

function reqRelDays(dateStr) {
  const d = parseDisplayDate(dateStr); if (!d) return null;
  const days = Math.round((d - MOCK_TODAY) / 86400000);
  if (days === 0) return { text: 'today', cls: 'text-brand-600 font-semibold' };
  if (days === 1) return { text: 'tomorrow', cls: 'text-brand-600 font-semibold' };
  if (days > 1) return { text: `in ${days} days`, cls: 'text-brand-600 font-semibold' };
  if (days === -1) return { text: 'yesterday', cls: 'text-charcoal-400' };
  return { text: `${Math.abs(days)} days ago`, cls: 'text-charcoal-400' };
}

function reqLeaveBalance(r) {
  if (r.type !== 'Day Off' && r.type !== 'Sick Leave') return null;
  const key = r.type === 'Day Off' ? 'dayOff' : 'sick';
  const lb = (MOCK.leaveBalances || {})[r.employee];
  if (!lb || !lb[key]) return null;
  const used = lb[key].used, total = lb[key].total;
  const left = Math.max(0, total - used);
  const pending = r.status === 'Pending HR Review';
  const after = pending ? left - 1 : left;
  return { used, total, left, after, pending, label: r.type === 'Day Off' ? 'Day-off balance' : 'Sick leave balance' };
}

function reqBalanceStrip(r) {
  const b = reqLeaveBalance(r); if (!b) return '';
  const pct = b.total ? Math.round((b.left / b.total) * 100) : 0;
  const zero = b.left <= 0;
  const afterZero = !zero && b.after <= 0;
  const tone = zero ? 'text-red-600' : afterZero ? 'text-yellow-600' : 'text-brand-600';
  const bar = zero ? 'bg-red-400' : afterZero ? 'bg-yellow-400' : 'bg-brand-500';
  const box = zero ? 'border-red-100 bg-red-50/60' : afterZero ? 'border-yellow-100 bg-yellow-50/60' : 'border-charcoal-200 bg-charcoal-50';
  let msg;
  if (b.pending) {
    if (zero) msg = `<span class="text-red-600 font-semibold">0 left</span> — HR sets <b>paid or unpaid</b> at approval.`;
    else if (afterZero) msg = `Approving uses the <b class="text-yellow-700">last day</b> — 0 remaining after approval.`;
    else msg = `${b.after} of ${b.total} days remaining after approval.`;
  } else if (r.status === 'Rejected') {
    msg = `Request rejected — no payment recorded.`;
  } else {
    const pay = reqPaymentLabel(r) || (zero ? 'Unpaid' : 'Paid');
    msg = pay === 'Unpaid'
      ? `Recorded as <b>unpaid</b> — payroll deduction applies.`
      : `Recorded as <b>paid</b> — deducted from the balance.`;
  }
  return `<div class="mt-2 rounded-lg border px-2.5 py-1.5 ${box}">
    <div class="flex items-center gap-2">
      <p class="text-[9px] uppercase tracking-wide text-charcoal-500 flex-shrink-0">${b.label}</p>
      <div class="flex-1 min-w-[30px] h-1.5 bg-charcoal-200 rounded-full overflow-hidden"><div class="h-full rounded-full ${bar}" style="width:${pct}%"></div></div>
      <p class="text-[10px] font-bold ${tone} flex-shrink-0">${b.left}/${b.total}${b.pending ? ` <span class="font-normal text-charcoal-400">→ ${Math.max(0, b.after)}</span>` : ''}</p>
    </div>
    ${zero || afterZero || !b.pending ? `<p class="text-[9px] mt-1 text-charcoal-600">${msg}</p>` : ''}
  </div>`;
}

function reqBalanceWarn(r) {
  const b = reqLeaveBalance(r);
  if (!b || b.left > 0 || r.status !== 'Pending HR Review') return '';
  return `<div class="bg-red-50 border border-red-200 rounded-lg p-2.5 text-[10px] text-red-800 leading-relaxed"><b>No ${b.label.toLowerCase()} left.</b> At approval choose <b>Unpaid</b> (payroll deduction) or override as <b>Paid</b>.</div>`;
}

function updateNewReqBalance() {
  const el = document.getElementById('new-req-bal'); if (!el) return;
  const name = document.getElementById('new-req-emp')?.value;
  const type = document.getElementById('new-req-type')?.value;
  if (type !== 'Day Off' && type !== 'Sick Leave') { el.innerHTML = ''; return; }
  const key = type === 'Day Off' ? 'dayOff' : 'sick';
  const lb = (MOCK.leaveBalances || {})[name];
  if (!lb || !lb[key]) { el.innerHTML = ''; return; }
  const { used, total } = lb[key];
  const left = Math.max(0, total - used);
  const tone = left <= 0 ? 'text-red-600' : left === 1 ? 'text-yellow-600' : 'text-brand-600';
  const warn = left <= 0 ? ' — no balance left · HR decides paid/unpaid' : left === 1 ? ' — this uses the last day' : ' — deducted when approved';
  el.innerHTML = `<div class="bg-charcoal-50 border border-charcoal-200 rounded-lg p-2.5"><p class="text-[9px] uppercase tracking-wide text-charcoal-500">${type === 'Day Off' ? 'Day-off' : 'Sick leave'} balance</p><p class="text-xs font-bold ${tone} mt-0.5">${left} <span class="text-charcoal-400 font-normal">of ${total} days left</span>${warn}</p></div>`;
}

function reqUrgency(r) {
  if (r.type === 'Resignation') return 'Notice';
  if (r.type === 'Late Arrival' || r.type === 'Leave Early' || r.type === 'Sick Leave') return 'Urgent';
  if (r.bmDecision === 'Rejected') return 'Review';
  return 'Normal';
}

function urgencyTag(r) {
  const u = reqUrgency(r);
  if (u === 'Notice') return `<span class="badge badge-purple text-[9px]">Notice Period</span>`;
  if (u === 'Urgent') return `<span class="badge badge-red text-[9px]">Urgent</span>`;
  if (u === 'Review') return `<span class="badge badge-yellow text-[9px]">BM Rejected</span>`;
  return `<span class="badge badge-blue text-[9px]">Normal</span>`;
}

function renderRequestCard(r) {
  const showAll = DEMO.showAll;
  const canDecide = showAll || hasPermission('requests.approve');
  const pendingHire = r.status === 'Pending HR Review';
  const decidedItem = !pendingHire && r.status !== 'Archived';
  const undoable = decidedItem && canDecide && !reqDatePassed(r);
  const final = decidedItem && reqDatePassed(r);

  const icon = REQ_ICONS[r.type] || 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';

  const timelineHtml = (r.timeline || []).length ? `<div class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 bg-charcoal-50/60 rounded-lg px-2.5 py-1.5">${r.timeline.map((step, i) => `${i ? '<span class="text-[9px] text-charcoal-300">→</span>' : ''}<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full ${step.done ? 'bg-brand-500' : 'bg-charcoal-200'} flex-shrink-0"></span><span class="text-[9px] font-medium ${step.done ? 'text-charcoal-700' : 'text-charcoal-400'}">${step.step}</span><span class="text-[8px] text-charcoal-400">${step.date}</span></span>`).join('')}</div>` : '';

  const emp = reqEmp(r);
  const initials = emp ? emp.initials : r.employee.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const rel = reqRelDays(r.requestedDate);
  const tenure = emp ? reqTenure(emp.hireDate) : '';
  const bal = reqLeaveBalance(r);

  let balCell = '';
  if (bal) {
    if (pendingHire) {
      const zero = bal.left <= 0, last = !zero && bal.after <= 0;
      balCell = `<span class="${zero ? 'text-red-600' : last ? 'text-yellow-600' : 'text-brand-600'} font-semibold">${bal.left}/${bal.total}</span> <span class="text-charcoal-500">left${zero ? ' · HR chooses paid/unpaid' : ` · ${bal.after} after approval`}</span>`;
    } else {
      const pay = reqPaymentLabel(r);
      balCell = `<span class="${bal.left <= 0 ? 'text-red-600' : 'text-brand-600'} font-semibold">${bal.left}/${bal.total}</span> <span class="text-charcoal-500">left</span>${pay ? ` <span class="badge ${pay === 'Paid' ? 'badge-green' : 'badge-red'} text-[8px]">${pay}</span>` : ''}`;
    }
  }

  const lbl = `text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold pt-px`;

  return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-start gap-2.5 min-w-0">
        <div class="relative flex-shrink-0">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-bold">${initials}</div>
          <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-charcoal-200 flex items-center justify-center"><svg class="w-2.5 h-2.5 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg></span>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap"><p class="text-xs font-medium text-charcoal-900">${r.employee}</p>${statusBadge(r.status)}${pendingHire?urgencyTag(r):''}${final?'<span class="badge badge-gray text-[9px]">Final</span>':''}</div>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${emp ? `${emp.position} · ${emp.level} · ` : ''}${r.gym}${tenure ? ` · ${tenure} tenure` : ''}</p>
        </div>
      </div>
      <div class="text-right text-[9px] text-charcoal-400 whitespace-nowrap leading-4 flex-shrink-0">ID ${r.id.toUpperCase()}${emp ? `<br><span class="text-charcoal-300">${emp.id}</span>` : ''}</div>
    </div>
    <div class="mt-2 grid grid-cols-[58px_1fr] gap-x-2 gap-y-1">
      <span class="${lbl}">Request</span>
      <span class="text-[11px] text-charcoal-800"><span class="font-semibold text-charcoal-900">${r.type}</span><span class="text-charcoal-300 mx-1">·</span>${r.requestedDate}${rel ? ` <span class="${rel.cls}">${rel.text}</span>` : ''}</span>
      <span class="${lbl}">Reason</span>
      <span class="text-[11px] text-charcoal-600">${r.reason ? `“${r.reason}”` : '—'}</span>
      ${r.bmDecision ? `<span class="${lbl}">BM</span><span class="text-[11px]"><span class="font-semibold ${r.bmDecision==='Approved'?'text-brand-700':'text-red-700'}">${r.bmDecision}</span>${r.bmComment ? ` <span class="text-charcoal-500">— ${r.bmComment}</span>` : ''}</span>` : ''}
      ${bal ? `<span class="${lbl}">Balance</span><span class="text-[11px]">${balCell}</span>` : ''}
    </div>
    ${timelineHtml}
    <div class="flex gap-1.5 mt-2.5 flex-wrap">
      ${pendingHire && canDecide ? `<button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-primary flex-1 min-w-[110px]">Approve</button><button onclick="openRequestDecision('${r.id}', 'reject')" class="btn btn-sm btn-danger-outline flex-1 min-w-[110px]">Reject</button>` : ''}
      ${undoable ? `<button onclick="openRequestDecision('${r.id}', 'undo')" class="btn btn-sm btn-danger-outline flex-1 min-w-[110px]">Undo Decision</button>` : ''}
      <button onclick="openRequestDetail('${r.id}')" class="btn btn-sm btn-ghost flex-1 min-w-[90px]">${pendingHire && !canDecide ? 'View BM Log' : 'Detail'}</button>
      ${r.status !== 'Archived' ? `<button onclick="showToast('Archived')" class="btn btn-sm btn-ghost flex-1 min-w-[90px]">Archive</button>` : `<button onclick="showToast('Restored to inbox')" class="btn btn-sm btn-ghost flex-1 min-w-[90px]">Restore</button>`}
    </div>
  </div>`;
}

function openRequestDecision(id, mode) {
  const r = MOCK.requests.find(x => x.id === id); if (!r) return;
  const canDecide = DEMO.showAll || hasPermission('requests.approve');
  if (!canDecide) { showToast('You do not have requests.approve', 'error'); return; }
  const isReject = mode === 'reject';
  const isUndo = mode === 'undo';
  if (isUndo && reqDatePassed(r)) { showToast('The requested date has passed — the decision can no longer be changed', 'error'); return; }
  const b = reqLeaveBalance(r);
  const defaultPay = b && b.left <= 0 ? 'unpaid' : 'paid';
  const title = isUndo ? 'Undo Decision' : (isReject ? 'Reject Request' : 'Approve Request');
  const undoNote = isUndo && r.payment === 'paid' ? ' The deducted balance day will be returned.' : '';
  const decisionHint = isUndo
    ? `<div class="bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-[10px] text-orange-800 leading-relaxed">This reverses the HR decision and returns the request to <b>Pending HR Review</b> so it can be decided again. The BM decision stays as is — allowed only while the requested date hasn&apos;t passed.${undoNote}</div>`
    : '<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-[10px] text-yellow-800 leading-relaxed">You are the final approver. Your decision becomes visible to the employee. While the requested date hasn&apos;t passed, HR can still <b>undo</b> the decision from the Decided list.</div>';

  const timeline = (r.timeline || []).map(step => `<div class="flex items-start gap-2.5">
    <div class="flex flex-col items-center"><span class="w-3 h-3 rounded-full ${step.done?'bg-brand-500':'bg-charcoal-200'} mt-0.5"></span>${step.done?'<span class="w-0.5 h-5 bg-brand-500 mt-0.5"></span>':''}</div>
    <div class="pb-3"><p class="text-xs font-medium text-charcoal-800">${step.step}</p><p class="text-[9px] text-charcoal-400">${step.date}</p></div>
  </div>`).join('');

  const applyBtn = isUndo
    ? `<button onclick="applyRequestDecision('${r.id}','undo',document.getElementById('req-note').value)" class="btn btn-sm btn-primary">Undo & Return to Review</button>`
    : isReject
      ? `<button onclick="applyRequestDecision('${r.id}','reject',document.getElementById('req-note').value)" class="btn btn-sm btn-danger-outline">Reject</button>`
      : `<button onclick="applyRequestDecision('${r.id}','approve',document.getElementById('req-note').value)" class="btn btn-sm btn-primary">Approve</button>`;

  const payBlock = (!isReject && !isUndo && b) ? `<div class="bg-charcoal-50 rounded-lg p-2.5">
    <p class="text-[9px] uppercase tracking-wide text-charcoal-500">Payment</p>
    <div class="flex items-center gap-4 mt-1.5 flex-wrap">
      <label class="flex items-center gap-1.5 text-[11px] text-charcoal-700 cursor-pointer"><input type="radio" name="req-payment" value="paid" class="accent-brand-600" ${defaultPay==='paid'?'checked':''}> Paid — deduct from balance</label>
      <label class="flex items-center gap-1.5 text-[11px] text-charcoal-700 cursor-pointer"><input type="radio" name="req-payment" value="unpaid" class="accent-brand-600" ${defaultPay==='unpaid'?'checked':''}> Unpaid — payroll deduction</label>
    </div>
  </div>` : '';

  openModal(`${title} — ${r.employee}`, `<div class="space-y-3">
    <div class="flex items-center gap-2 flex-wrap"><span class="badge badge-gray text-[9px]">${r.type}</span><span class="badge badge-gray text-[9px]">${r.gym}</span>${statusBadge(r.status)}${urgencyTag(r)}</div>
    <div class="grid grid-cols-2 gap-2 bg-charcoal-50 rounded-lg p-2.5 text-[11px]">
      <div><p class="text-[9px] uppercase text-charcoal-400">Requested for</p><p class="font-medium text-charcoal-800">${r.requestedDate}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">Submitted</p><p class="font-medium text-charcoal-800">${formatDate(r.submittedDate)}</p></div>
      <div class="col-span-2"><p class="text-[9px] uppercase text-charcoal-400">Reason</p><p class="font-medium text-charcoal-800">${r.reason || '—'}</p></div>
    </div>
    ${reqBalanceStrip(r)}
    ${reqBalanceWarn(r)}
    ${payBlock}
    <div class="bg-charcoal-50 rounded-lg p-2.5 border-l-4 ${r.bmDecision==='Approved'?'border-l-brand-500':'border-l-red-500'}">
      <p class="text-[9px] uppercase tracking-wide text-charcoal-500">BUILDING MANAGER</p>
      <p class="text-xs mt-0.5 ${r.bmDecision==='Approved'?'text-brand-700':'text-red-700'} font-medium">${r.bmDecision}${r.bmComment ? ` — ${r.bmComment}` : ''}</p>
    </div>
    <div>${timeline || '<p class="text-[10px] text-charcoal-400">No timeline yet.</p>'}</div>
    ${decisionHint}
    <div><label class="form-label">${isReject ? 'Rejection reason' : isUndo ? 'Undo note (optional)' : 'Approval note (optional)'}</label><textarea id="req-note" class="form-input" rows="2" placeholder="${isReject ? 'Required for rejection…' : isUndo ? 'Why is this decision being undone?…' : 'Optional note…'}"></textarea></div>
  </div>`, { wide: true, footer:
    `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>${applyBtn}` });
}

function applyRequestDecision(id, mode, note) {
  const r = MOCK.requests.find(x => x.id === id); if (!r) return;
  const canDecide = DEMO.showAll || hasPermission('requests.approve');
  if (!canDecide) { showToast('You do not have requests.approve', 'error'); return; }
  if (mode === 'undo') {
    if (reqDatePassed(r)) { showToast('The requested date has passed — the decision can no longer be changed', 'error'); return; }
    if (r.payment === 'paid') adjustLeaveBal(r, -1);
    const tl = r.timeline || [];
    while (tl.length && /^HR (Approved|Rejected)/.test(tl[tl.length - 1].step)) tl.pop();
    if (!tl.some(s => s.step === 'HR Review' && !s.done)) tl.push({ step: 'HR Review', date: 'Pending', done: false });
    r.status = 'Pending HR Review';
    r.hrDecision = null;
    r.hrComment = '';
    r.payment = null;
    closeModal();
    showToast('Decision undone — request returned to Pending HR');
    renderAll();
    return;
  }
  if (mode === 'approve') {
    const b = reqLeaveBalance(r);
    const payEl = document.querySelector('input[name="req-payment"]:checked');
    r.payment = b ? (payEl ? payEl.value : (b.left > 0 ? 'paid' : 'unpaid')) : null;
    if (b && r.payment === 'paid') adjustLeaveBal(r, 1);
    r.status = 'Approved';
    r.hrDecision = 'Approved';
    r.hrComment = note || '';
    r.timeline.push({ step: 'HR Approved', date: 'Sep 9, 2026 · Now', done: true });
    showToast(r.payment === 'unpaid' ? 'Request approved · unpaid (payroll deduction)' : r.payment === 'paid' ? 'Request approved · paid (balance deducted)' : 'Request approved · employee notified');
    if (r.type === 'Resignation') {
      const emp = MOCK.employees.find(e => e.name === r.employee);
      if (emp) emp.status = 'Notice Period';
      closeModal();
      renderAll();
      openModal('Resignation Approved — Start Offboarding?', `<div class="space-y-3">
        <div class="bg-brand-50 border border-brand-200 rounded-lg p-3 text-xs text-brand-800">
          <strong>${r.employee}'s</strong> resignation has been approved for <strong>${r.requestedDate}</strong>.
          <p class="mt-1 text-[11px] text-brand-700">Would you like to initiate the exit & separation checklist (handover, uniform return, settlement) now?</p>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button onclick="closeModal()" class="btn btn-sm btn-secondary">Later</button>
          <button onclick="closeModal();triggerOffboardingFromRequest('${r.employee}','${r.gym}','${r.requestedDate}','${(r.reason||'Resignation').replace(/'/g, "\\'")}')" class="btn btn-sm btn-primary">Start Offboarding Checklist →</button>
        </div>
      </div>`);
      return;
    }
  } else {
    r.status = 'Rejected';
    r.hrDecision = 'Rejected';
    r.hrComment = note || '';
    r.payment = null;
    r.timeline.push({ step: 'HR Rejected', date: 'Sep 9, 2026 · Now', done: true });
    showToast('Request rejected · employee notified', 'error');
  }
  closeModal();
  renderAll();
}

function triggerOffboardingFromRequest(empName, gym, lastDay, reason) {
  let sep = MOCK.separations.find(s => s.employee === empName);
  const emp = MOCK.employees.find(e => e.name === empName);
  if (emp) emp.status = 'Notice Period';
  if (!sep) {
    sep = {
      id: 'sep-' + Date.now(),
      employee: empName,
      position: emp ? `${emp.position} — ${emp.level}` : 'Staff',
      gym: gym,
      lastDay: lastDay,
      reason: reason || 'Resignation',
      requestedBy: 'Resignation — BM approved',
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
    MOCK.separations.unshift(sep);
    MOCK.auditLog.unshift({
      id: 'al-' + Date.now(),
      action: 'Offboarding Initiated',
      user: MOCK.currentUser.fullName,
      target: empName,
      detail: `Separation workflow created from approved resignation (Last Day: ${lastDay})`,
      timestamp: '2026-09-09',
      gym: gym
    });
  }
  showToast(`Offboarding initiated for ${empName}`);
  navigateTo('terminations');
  setTimeout(() => openSeparation(sep.id), 200);
}

function openRequestDetail(id) {
  const r = MOCK.requests.find(x => x.id === id); if (!r) return;
  const canDecide = DEMO.showAll || hasPermission('requests.approve');
  const undoable = (r.status === 'Approved' || r.status === 'Rejected') && canDecide && !reqDatePassed(r);
  const steps = (r.timeline || []).map(step => `<div class="flex items-start gap-2.5">
    <div class="flex flex-col items-center"><span class="w-3 h-3 rounded-full ${step.done?'bg-brand-500':'bg-charcoal-200'} mt-0.5"></span>${step.done?'<span class="w-0.5 h-5 bg-brand-500 mt-0.5"></span>':''}</div>
    <div class="pb-3"><p class="text-xs font-medium text-charcoal-800">${step.step}</p><p class="text-[9px] text-charcoal-400">${step.date}</p></div>
  </div>`).join('');
  openModal(`Request ${r.id.toUpperCase()} — ${r.employee}`, `<div class="space-y-3">
    <div class="flex items-center gap-2 flex-wrap"><span class="badge badge-gray text-[9px]">${r.type}</span><span class="badge badge-gray text-[9px]">${r.gym}</span>${statusBadge(r.status)}${reqUrgency(r)!=='Normal'?urgencyTag(r):''}</div>
    <p class="text-[11px] text-charcoal-600">${r.requestedDate} · Submitted ${formatDate(r.submittedDate)}</p>
    ${r.reason ? `<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[9px] uppercase tracking-wide text-charcoal-500">Reason</p><p class="text-xs mt-0.5 text-charcoal-800">${r.reason}</p></div>` : ''}    ${reqBalanceStrip(r)}
    ${reqBalanceWarn(r)}    <div class="bg-charcoal-50 rounded-lg p-2.5">
      <p class="text-[9px] uppercase tracking-wide text-charcoal-500">BUILDING MANAGER DECISION</p>
      ${r.bmDecision ? `<p class="text-xs mt-0.5 ${r.bmDecision==='Approved'?'text-brand-700':'text-red-700'} font-medium">${r.bmDecision}${r.bmComment ? ` — ${r.bmComment}` : ''}</p>` : `<p class="text-xs mt-0.5 text-charcoal-400">No BM decision recorded yet.</p>`}
    </div>
    ${r.hrDecision ? `<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[9px] uppercase tracking-wide text-charcoal-500">HR FINAL DECISION</p><p class="text-xs mt-0.5 ${r.hrDecision==='Approved'?'text-brand-700':'text-red-700'} font-medium">${r.hrDecision}${reqPaymentLabel(r) ? ` <span class="badge ${reqPaymentLabel(r)==='Paid'?'badge-green':'badge-red'} text-[9px]">${reqPaymentLabel(r)}</span>` : ''}${r.hrComment ? ` — ${r.hrComment}` : ''}</p></div>` : ''}
    <div>${steps || '<p class="text-[10px] text-charcoal-400">No timeline.</p>'}</div>
  </div>`, { wide: true, footer:
    `${r.status==='Pending HR Review'&&canDecide ? `<button onclick="closeModal();openRequestDecision('${r.id}')" class="btn btn-sm btn-primary">Decide</button>`:''}${undoable ? `<button onclick="closeModal();openRequestDecision('${r.id}','undo')" class="btn btn-sm btn-danger-outline">Undo Decision</button>`:''}<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>` });
}

function bulkApproveRequests() {
  const canDecide = DEMO.showAll || hasPermission('requests.approve');
  if (!canDecide) { showToast('You do not have requests.approve', 'error'); return; }
  const list = MOCK.requests.filter(r => r.status === 'Pending HR Review');
  const alerts = list.filter(r => { const b = reqLeaveBalance(r); return b && b.left <= 0; });
  if (alerts.length) {
    openModal('Bulk Approve — Balance Check', `<div class="space-y-3">
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-[11px] text-red-800 leading-relaxed"><b>${alerts.length} of ${list.length} pending requests</b> have no leave balance left. Approving them records those days as <b>unpaid (payroll deduction applies)</b>.</div>
      <div class="space-y-1">${alerts.map(r => `<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2"><p class="text-[11px] text-charcoal-800">${r.employee} — ${r.type}</p><span class="badge badge-red text-[9px]">0 days left</span></div>`).join('')}</div>
      <p class="text-[10px] text-charcoal-400">Review them one by one, or approve everything including the unpaid days.</p>
    </div>`, { wide: true, footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Review individually</button><button onclick="closeModal();doBulkApprove()" class="btn btn-sm btn-primary">Approve all ${list.length}</button>` });
    return;
  }
  doBulkApprove();
}

function doBulkApprove() {
  const list = MOCK.requests.filter(r => r.status === 'Pending HR Review');
  list.forEach(r => {
    const b = reqLeaveBalance(r);
    r.payment = b ? (b.left > 0 ? 'paid' : 'unpaid') : null;
    if (b && r.payment === 'paid') adjustLeaveBal(r, 1);
    r.status = 'Approved';
    r.hrDecision = 'Approved';
    r.hrComment = 'Bulk approved';
    r.timeline.push({ step: 'HR Approved', date: 'Sep 9, 2026 · Now', done: true });
  });
  showToast(`All ${list.length} approved in bulk`);
  renderAll();
}

function openNewRequest() {
  openModal('New Request', `<form onsubmit="event.preventDefault();submitNewRequest();" class="space-y-3">
    <div><label class="form-label">Employee</label><select id="new-req-emp" class="form-select" onchange="updateNewReqBalance()">${MOCK.employees.map(e=>`<option value="${e.name}">${e.name} (${e.gym})</option>`).join('')}</select></div>
    <div><label class="form-label">Type</label><select id="new-req-type" class="form-select" onchange="updateNewReqBalance()"><option>Day Off</option><option>Sick Leave</option><option>Leave Early</option><option>Late Arrival</option><option>Shift Swap</option><option>Resignation</option></select></div>
    <div id="new-req-bal"></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="form-label">Date</label><input id="new-req-date" type="date" class="form-input" value="2026-09-14"></div><div><label class="form-label">End / Last Day</label><input id="new-req-end" type="date" class="form-input" value="2026-09-16"></div></div>
    <div><label class="form-label">Reason</label><textarea id="new-req-reason" class="form-input" rows="2" placeholder="Reason..."></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Submit Request</button></div>
  </form>`);
  updateNewReqBalance();
}

function submitNewRequest() {
  const empName = document.getElementById('new-req-emp')?.value;
  const type = document.getElementById('new-req-type')?.value;
  const date = document.getElementById('new-req-date')?.value;
  const reason = document.getElementById('new-req-reason')?.value || '';
  const emp = MOCK.employees.find(e => e.name === empName);
  const newReq = {
    id: 'r' + (MOCK.requests.length + 1),
    employee: empName,
    gym: emp ? emp.gym : 'Nasr City',
    type: type,
    submittedDate: new Date().toISOString().slice(0, 10),
    requestedDate: date || 'Sep 15, 2026',
    status: 'Pending HR Review',
    bmDecision: 'Approved',
    bmComment: 'Submitted via HR portal',
    reason: reason,
    timeline: [
      { step: 'Submitted', date: 'Just now', done: true },
      { step: 'BM Approved', date: 'Auto-verified', done: true },
      { step: 'HR Review', date: 'Pending', done: false }
    ]
  };
  MOCK.requests.unshift(newReq);
  showToast(`Request created for ${empName}`);
  closeModal();
  renderAll();
}