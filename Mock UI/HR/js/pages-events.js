// ==================== EVENTS — tabbed HR action queue ====================
// One tab per kind of work item. Every tab shows only the fields that matter for
// that kind, and every action mutates the real underlying record so the item
// leaves the queue when it is dealt with.

const EVT_TODAY = '2026-09-09';

// Tab registry. `count` decides whether the tab is worth showing at all.
const EVENT_TABS = [
  { id: 'documents',   label: 'Documents',     icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', types: ['Document Expiry', 'Contract Expiry'] },
  { id: 'requests',    label: 'Requests',      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', types: ['PendingHRReview'] },
  { id: 'offboarding', label: 'Leaving',       icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', types: ['Resignation', 'Termination'] },
  { id: 'transfers',   label: 'Transfers',     icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', types: ['TransferRequest'] },
  { id: 'vacancies',   label: 'Vacancies',     icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', types: ['PendingVacancyRequest'] },
  { id: 'payroll',     label: 'Payroll',       icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', types: ['PayrollApproval'] },
];

let _evtTab = 'documents';
let _evtShowResolved = false;
let _evtGym = 'all';

// ---------------- helpers ----------------
function evtCan(perm) { return !perm || DEMO.showAll || hasPermission(perm); }
function evtEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function evtDays(iso) {
  if (!iso) return null;
  const p = String(iso).split('-').map(Number);
  if (p.length < 3 || !p[0]) return null;
  return Math.round((new Date(p[0], p[1] - 1, p[2]) - MOCK_TODAY) / 86400000);
}
// "Expired 4 days ago" / "Expires in 1 day" / "Due today"
function evtDueLabel(iso) {
  const d = evtDays(iso);
  if (d === null) return { text: evtShort(iso), tone: 'gray', days: null };
  if (d < 0) return { text: 'Expired ' + Math.abs(d) + 'd ago', tone: d <= -3 ? 'red' : 'amber', days: d };
  if (d === 0) return { text: 'Due today', tone: 'red', days: 0 };
  if (d === 1) return { text: 'Expires tomorrow', tone: 'red', days: 1 };
  if (d <= 7) return { text: 'In ' + d + ' days', tone: 'amber', days: d };
  if (d <= 30) return { text: 'In ' + d + ' days', tone: 'blue', days: d };
  return { text: 'In ' + d + ' days', tone: 'gray', days: d };
}
function evtShort(iso) {
  if (!iso) return '—';
  const p = String(iso).split('-').map(Number);
  if (p.length < 3 || !p[0]) return String(iso);
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function evtMoney(n) { return 'EGP ' + Number(n || 0).toLocaleString(); }
function evtTabs() { return EVENT_TABS.concat([{ id: 'escalations', label: 'Escalated', icon: 'M5 21v-2a3 3 0 013-3h5a3 3 0 013 3v2M10 11a4 4 0 100-8 4 4 0 000 8z' }]); }
function evtTabMeta(id) { return EVENT_TABS.find(t => t.id === id) || EVENT_TABS[0]; }

function evtVisible() {
  return (MOCK.events || [])
    .filter(e => evtCan(e.permission))
    .filter(e => _evtGym === 'all' || e.branch === _evtGym);
}
function evtInTab(id) {
  const all = evtVisible();
  if (id === 'escalations') {
    return (MOCK.actionRequests || [])
      .filter(a => a.status === 'Pending')
      .map(a => ({ _action: a, id: a.id, title: a.employee, urgency: a.actionType === 'CompensationChange' ? 'medium' : 'low' }));
  }
  const types = evtTabMeta(id).types;
  return all.filter(e => types.indexOf(e.type) >= 0);
}
function evtCounts() {
  const out = {};
  EVENT_TABS.forEach(t => {
    const rows = evtInTab(t.id);
    out[t.id] = {
      open: rows.filter(e => !e.resolved).length,
      high: rows.filter(e => !e.resolved && e.urgency === 'high').length,
      resolved: rows.filter(e => e.resolved).length
    };
  });
  const esc = (MOCK.actionRequests || []).filter(a => a.status === 'Pending');
  out.escalations = { open: esc.length, high: 0, resolved: 0 };
  return out;
}
function evtGyms() {
  const seen = [];
  (MOCK.events || []).forEach(e => { if (e.branch && seen.indexOf(e.branch) < 0) seen.push(e.branch); });
  return seen;
}

// ---------------- shared card pieces ----------------
const EVT_URG = { high: { c: 'red', dot: 'bg-red-500' }, medium: { c: 'amber', dot: 'bg-amber-400' }, low: { c: 'gray', dot: 'bg-charcoal-300' } };

function evtDue(iso, label) {
  const d = evtDueLabel(iso);
  const cls = { red: 'bg-red-50 text-red-700 border-red-200', amber: 'bg-amber-50 text-amber-800 border-amber-200', blue: 'bg-blue-50 text-blue-700 border-blue-200', gray: 'bg-charcoal-50 text-charcoal-600 border-charcoal-200' }[d.tone];
  return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-semibold ${cls}">${evtEsc(label || d.text)}</span>`;
}
function evtAvatar(name) {
  const i = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${evtEsc(i)}</span>`;
}
function evtShell(e, inner, opts) {
  opts = opts || {};
  const urg = EVT_URG[e.urgency] || EVT_URG.low;
  return `<article class="evt-card ${e.resolved ? 'is-resolved' : ''}">
    <span class="evt-urg ${urg.dot}" title="${evtEsc(e.urgency || 'low')} urgency"></span>
    <div class="evt-card-main min-w-0 flex-1">${inner}</div>
    ${e.resolved
      ? `<div class="evt-resolved">Resolved ${evtShort(e.resolvedOn)}${e.resolvedBy ? ' · ' + evtEsc(e.resolvedBy) : ''}</div>`
      : (opts.actions || '')}
  </article>`;
}
function evtResolvedBar(e) {
  if (!e.resolved) return '';
  return `<div class="evt-resolved-bar">Resolved ${evtShort(e.resolvedOn)} by ${evtEsc(e.resolvedBy || 'HR')}</div>`;
}

// ---------------- per-tab card renderers ----------------
function evtCardDocuments(e) {
  const inner = `
    <div class="flex items-start gap-2">
      ${evtAvatar(e.employee)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs font-semibold text-charcoal-900 truncate">${evtEsc(e.employee)}</span>
          <span class="badge ${e.type === 'Contract Expiry' ? 'badge-purple' : 'badge-blue'} text-[9px]">${evtEsc(e.docType)}</span>
          ${e.editableByEmployee ? '<span class="badge badge-gray text-[8px]" title="The employee can upload a replacement themselves">Employee uploads</span>' : '<span class="badge badge-orange text-[8px]" title="HR-only document — the employee cannot replace this">HR-only</span>'}
        </div>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${evtEsc(e.branch)} · <span class="font-mono text-[9px]">${evtEsc(e.docNo || '—')}</span></p>
      </div>
      <div class="flex flex-col items-end gap-1 flex-shrink-0">${evtDue(e.expiresOn || e.date)}</div>
    </div>
    <p class="evt-note">${evtEsc(e.detail)}</p>
    <p class="evt-hint"><b>Next step:</b> ${evtEsc(e.renewalPath || '—')}</p>
    ${evtResolvedBar(e)}`;

  return evtShell(e, inner, {
    actions: `<div class="evt-actions">
      <button onclick="evtOpenDocument('${e.id}')" class="btn btn-sm btn-ghost">Open employee</button>
      <button onclick="evtMarkRenewalRequested('${e.id}')" class="btn btn-sm btn-secondary">Request renewal</button>
      <button onclick="evtResolveEvent('${e.id}')" class="btn btn-sm btn-primary">Mark resolved</button>
    </div>`
  });
}

function evtCardRequests(e) {
  const canDecide = DEMO.showAll || hasPermission('requests.approve');
  const req = (MOCK.requests || []).find(r => r.id === e.requestId);
  const decided = req && req.status !== 'Pending HR Review';
  const inner = `
    <div class="flex items-start gap-2">
      ${evtAvatar(e.employee)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs font-semibold text-charcoal-900 truncate">${evtEsc(e.employee)}</span>
          <span class="badge ${e.requestType === 'Resignation' ? 'badge-red' : e.requestType === 'Day Off' ? 'badge-blue' : 'badge-yellow'} text-[9px]">${evtEsc(e.requestType)}</span>
          ${decided ? statusBadge(req.status) : ''}
        </div>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${evtEsc(e.branch)} · for <b class="text-charcoal-700">${evtEsc(e.forDate ? new Date(e.forDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')}</b> · submitted ${evtShort(e.submittedOn)}</p>
        ${e.reason ? `<p class="evt-note">"${evtEsc(e.reason)}"</p>` : ''}
      </div>
      <div class="flex flex-col items-end gap-1 flex-shrink-0">${evtDue(e.forDate, 'For ' + (e.forDate ? new Date(e.forDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'))}</div>
    </div>
    <div class="evt-bm ${e.bmDecision === 'Approved' ? 'is-ok' : 'is-no'}">
      <span class="evt-bm-k">Branch Manager</span>
      <span class="evt-bm-v">${evtEsc(e.bmDecision)}${e.bmComment ? ' — ' + evtEsc(e.bmComment) : ''}</span>
    </div>
    ${evtResolvedBar(e)}`;

  return evtShell(e, inner, {
    actions: decided ? '' : `<div class="evt-actions">
      <button onclick="openRequestDetail('${e.requestId}')" class="btn btn-sm btn-ghost">Full request</button>
      ${canDecide ? `
        <button onclick="applyRequestDecision('${e.requestId}','reject','Rejected from Events queue')" class="btn btn-sm btn-danger-outline">Reject</button>
        <button onclick="applyRequestDecision('${e.requestId}','approve','Approved from Events queue')" class="btn btn-sm btn-primary">Approve</button>` : ''}
    </div>`
  });
}

function evtCardOffboarding(e) {
  const sep = (MOCK.separations || []).find(s => s.id === e.separationId);
  const done = sep ? (sep.checklist || []).filter(c => c[1]).length : (e.checklistDone || 0);
  const total = sep ? (sep.checklist || []).length : (e.checklistTotal || 5);
  const pct = total ? Math.round(done / total * 100) : 0;
  const remaining = (sep && sep.status !== 'Completed') ? evtDays(e.lastDay) : null;
  const inner = `
    <div class="flex items-start gap-2">
      ${evtAvatar(e.employee)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs font-semibold text-charcoal-900 truncate">${evtEsc(e.employee)}</span>
          <span class="text-[10px] text-charcoal-500">${evtEsc(e.position || '')}</span>
          <span class="badge ${e.type === 'Termination' ? 'badge-red' : 'badge-purple'} text-[9px]">${evtEsc(e.type)}</span>
          ${sep ? statusBadge(sep.status) : ''}
        </div>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${evtEsc(e.branch)} · raised by ${evtEsc(e.requestedBy || 'HR')}</p>
        <p class="evt-note">${evtEsc(e.reason)}</p>
      </div>
      <div class="flex flex-col items-end gap-1 flex-shrink-0">
        ${remaining === null ? '<span class="badge badge-gray text-[9px]">Completed</span>' : evtDue(e.lastDay, 'Last day ' + evtShort(e.lastDay).replace(/, \d{4}$/, ''))}
        ${remaining !== null && remaining <= 7 && remaining >= 0 ? `<span class="text-[9px] text-red-600 font-semibold">${remaining}d to exit</span>` : ''}
      </div>
    </div>
    <div class="evt-prog">
      <div class="evt-prog-head"><span>Exit checklist</span><b>${done}/${total}</b></div>
      <div class="evt-prog-track"><span style="width:${pct}%" class="${pct === 100 ? 'is-done' : ''}"></span></div>
      ${sep && sep.checklist ? `<p class="evt-hint">${evtEsc(sep.checklist.filter(c => !c[1]).map(c => c[0]).join(' · ')) || 'All steps complete.'}</p>` : ''}
    </div>
    ${evtResolvedBar(e)}`;

  return evtShell(e, inner, {
    actions: `<div class="evt-actions">
      ${sep ? `<button onclick="openSeparation('${e.separationId}')" class="btn btn-sm btn-primary">Open exit checklist</button>` : ''}
      <button onclick="openEmployeeProfile('${e.employeeId}')" class="btn btn-sm btn-ghost">Employee profile</button>
    </div>`
  });
}

function evtCardTransfers(e) {
  const canDecide = evtCan('employees.transfer');
  const inner = `
    <div class="flex items-start gap-2">
      ${evtAvatar(e.employee)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs font-semibold text-charcoal-900 truncate">${evtEsc(e.employee)}</span>
          <span class="badge badge-blue text-[9px]">Gym transfer</span>
        </div>
        <p class="evt-move"><span>${evtEsc(e.fromGym)}</span><svg class="w-3 h-3 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m0 0l-4-4m4 4l-4 4"/></svg><span class="font-semibold text-charcoal-900">${evtEsc(e.toGym)}</span></p>
        ${e.justification ? `<p class="evt-note">${evtEsc(e.justification)}</p>` : ''}
        <p class="text-[9px] text-charcoal-400 mt-1">Raised by ${evtEsc(e.raisedBy || 'HR')} · ${evtShort(e.submittedOn || e.date)}</p>
      </div>
      <div class="flex flex-col items-end gap-1 flex-shrink-0">${evtDue(e.effectiveDate || e.date, 'Effective ' + evtShort(e.effectiveDate || e.date).replace(/, \d{4}$/, ''))}</div>
    </div>
    ${evtResolvedBar(e)}`;

  return evtShell(e, inner, {
    actions: `<div class="evt-actions">
      <button onclick="openEmployeeProfile('${e.employeeId}')" class="btn btn-sm btn-ghost">Employee profile</button>
      ${canDecide ? `
        <button onclick="evtDecideTransfer('${e.id}','reject')" class="btn btn-sm btn-danger-outline">Reject</button>
        <button onclick="evtDecideTransfer('${e.id}','approve')" class="btn btn-sm btn-primary">Approve transfer</button>` : `<span class="evt-lock">HR Manager only</span>`}
    </div>`
  });
}

function evtCardVacancies(e) {
  const canDecide = evtCan('recruitment.vacancy_request.approve');
  const vr = (MOCK.vacancyRequests || []).find(v => v.id === e.vacancyRequestId);
  const decided = vr && vr.status !== 'Pending';
  const inner = `
    <div class="flex items-start gap-2">
      <span class="evt-ico"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg></span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs font-semibold text-charcoal-900 truncate">${evtEsc(e.position)}</span>
          <span class="badge ${e.vrUrgency === 'High' ? 'badge-red' : e.vrUrgency === 'Medium' ? 'badge-yellow' : 'badge-gray'} text-[9px]">${evtEsc(e.vrUrgency)} urgency</span>
          <span class="badge badge-gray text-[9px]">${e.headcount} headcount</span>
          ${decided ? statusBadge(vr.status) : ''}
        </div>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${evtEsc(e.gym)} · submitted by ${evtEsc(e.submittedBy)} on ${evtShort(e.submittedOn)}</p>
        <p class="evt-note">${evtEsc(e.vrReason)}</p>
      </div>
      <div class="flex flex-col items-end gap-1 flex-shrink-0"><span class="evt-age">Waiting ${Math.abs(evtDays(e.date))}d</span></div>
    </div>
    ${evtResolvedBar(e)}`;

  return evtShell(e, inner, {
    actions: decided ? '' : `<div class="evt-actions">
      <button onclick="openVacancyRequestModal('${e.vacancyRequestId}')" class="btn btn-sm btn-ghost">Detail</button>
      ${canDecide ? `
        <button onclick="rejectVacancyRequest('${e.vacancyRequestId}')" class="btn btn-sm btn-danger-outline">Reject</button>
        <button onclick="quickApproveVacancy('${e.vacancyRequestId}')" class="btn btn-sm btn-primary">Approve</button>` : `<span class="evt-lock">HR Manager only</span>`}
    </div>`
  });
}

function evtCardPayroll(e) {
  const canApprove = evtCan('payroll.approve');
  const inner = `
    <div class="flex items-start gap-2">
      <span class="evt-ico"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg></span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs font-semibold text-charcoal-900">${evtEsc(e.period)} payroll</span>
          <span class="badge badge-purple text-[9px]">${evtEsc(e.gym)}</span>
        </div>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${e.headcount} employees · prepared ${evtShort(e.preparedOn)}</p>
        <div class="evt-money">
          <span><i>Gross</i><b>${evtMoney(e.grossTotal)}</b></span>
          <span><i>Net payable</i><b class="text-brand-700">${evtMoney(e.netTotal)}</b></span>
          <span><i>Pending deductions</i><b class="text-red-600">${e.pendingDeductions}</b></span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1 flex-shrink-0">${evtDue(e.date, 'Sign-off ' + evtShort(e.date).replace(/, \d{4}$/, ''))}</div>
    </div>
    ${evtResolvedBar(e)}`;

  return evtShell(e, inner, {
    actions: `<div class="evt-actions">
      <button onclick="navigateTo('payroll')" class="btn btn-sm btn-ghost">Open payroll</button>
      ${canApprove ? `<button onclick="evtApprovePayroll('${e.id}')" class="btn btn-sm btn-primary">Approve &amp; lock run</button>` : `<span class="evt-lock">Needs payroll.approve</span>`}
    </div>`
  });
}

function evtCardEscalations(item) {
  const a = item._action;
  const meta = ACTION_TYPES[a.actionType] || { label: a.actionType, perm: '' };
  const canReview = evtCan(meta.perm);
  const inner = `
    <div class="flex items-start gap-2">
      ${evtAvatar(a.employee)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs font-semibold text-charcoal-900 truncate">${evtEsc(a.employee)}</span>
          <span class="badge badge-blue text-[9px]">${evtEsc(meta.label)}</span>
          <span class="badge badge-orange text-[9px]">HR escalated</span>
        </div>
        <p class="text-[10px] text-charcoal-700 mt-0.5 font-medium">${evtEsc(actionSummary(a))}</p>
        <p class="evt-note">${evtEsc(a.justification)}</p>
        <p class="text-[9px] text-charcoal-400 mt-1">Raised by ${evtEsc(a.requestedBy)} · ${evtShort(a.submittedDate)}</p>
      </div>
    </div>`;

  return `<article class="evt-card">
    <span class="evt-urg ${EVT_URG[a.actionType === 'Offboard' ? 'high' : 'medium'].dot}"></span>
    <div class="evt-card-main min-w-0 flex-1">${inner}</div>
    <div class="evt-actions">
      <button onclick="openEmployeeProfile('${a.employeeId}')" class="btn btn-sm btn-ghost">Employee profile</button>
      ${canReview ? `
        <button onclick="rejectActionRequest('${a.id}')" class="btn btn-sm btn-danger-outline">Reject</button>
        <button onclick="approveActionRequest('${a.id}')" class="btn btn-sm btn-primary">Approve</button>` : `<span class="evt-lock">Needs ${evtEsc(meta.perm)}</span>`}
    </div>
  </article>`;
}

const EVENT_CARD = {
  documents: evtCardDocuments,
  requests: evtCardRequests,
  offboarding: evtCardOffboarding,
  transfers: evtCardTransfers,
  vacancies: evtCardVacancies,
  payroll: evtCardPayroll,
  escalations: evtCardEscalations
};

// ---------------- actions ----------------
function evtSetTab(id) { _evtTab = id; renderAll(); }
function evtSetGym(v) { _evtGym = v; renderAll(); }
function evtToggleResolved() { _evtShowResolved = !_evtShowResolved; renderAll(); }
function evtFind(id) { return (MOCK.events || []).find(e => e.id === id); }
function evtAudit(action, target, detail, gym) {
  MOCK.auditLog = MOCK.auditLog || [];
  MOCK.auditLog.unshift({ id: 'al-' + Date.now(), action, user: MOCK.currentUser.fullName, target, detail, timestamp: EVT_TODAY, gym: gym || 'All' });
}

function evtResolveEvent(id) {
  const e = evtFind(id);
  if (!e) return;
  if (e.permission && !evtCan(e.permission)) { showToast('You cannot action this item', 'error'); return; }
  e.resolved = true;
  e.resolvedOn = EVT_TODAY;
  e.resolvedBy = MOCK.currentUser.fullName;
  evtAudit('Event Resolved', e.employee || e.title, e.detail || '', e.branch);
  showToast('"' + (e.employee || e.title) + '" moved to Resolved');
  renderAll();
}
function evtReopenEvent(id) {
  const e = evtFind(id);
  if (!e) return;
  e.resolved = false; e.resolvedOn = null; e.resolvedBy = null;
  showToast('Moved back to the open queue');
  renderAll();
}
function evtOpenDocument(id) {
  const e = evtFind(id);
  if (!e || !e.employeeId) { showToast('No linked employee', 'error'); return; }
  openEmployeeProfile(e.employeeId);
}
function evtMarkRenewalRequested(id) {
  const e = evtFind(id);
  if (!e) return;
  if (e.permission && !evtCan(e.permission)) { showToast('You cannot action this item', 'error'); return; }
  MOCK.notifications = MOCK.notifications || [];
  MOCK.notifications.unshift({
    id: 'n-' + Date.now(), category: 'Document',
    title: 'Replacement requested',
    description: e.employee + ' asked for a fresh ' + e.docType + ' before ' + evtShort(e.expiresOn || e.date) + '.',
    date: EVT_TODAY + ' 09:00', read: false,
    color: e.editableByEmployee ? 'green' : 'red', link: 'events'
  });
  evtAudit('Document Renewal Requested', e.employee, e.docType + ' (' + (e.docNo || '—') + ') expires ' + evtShort(e.expiresOn || e.date), e.branch);
  showToast('Renewal requested from ' + e.employee);
  renderAll();
}
function evtDecideTransfer(id, mode) {
  const e = evtFind(id);
  if (!e) return;
  if (!evtCan('employees.transfer')) { showToast('Approving a transfer requires employees.transfer', 'error'); return; }
  const emp = (MOCK.employees || []).find(x => x.id === e.employeeId);
  if (mode === 'reject') {
    e.resolved = true; e.resolvedOn = EVT_TODAY; e.resolvedBy = MOCK.currentUser.fullName;
    evtAudit('Transfer Request Rejected', e.employee, `${e.fromGym} → ${e.toGym} rejected`, e.branch);
    showToast('Transfer request rejected', 'error');
    renderAll();
    return;
  }
  if (emp) {
    const from = emp.gym;
    emp.gym = e.toGym;
    evtAudit('Gym Transfer Executed', e.employee, `${from} → ${e.toGym} (Effective ${evtShort(e.effectiveDate || e.date)}). Approved from Events.`, e.toGym);
  }
  MOCK.events = (MOCK.events || []).filter(x => x.id !== id);
  showToast('Transfer approved — ' + e.employee + ' now at ' + e.toGym);
  renderAll();
}
function evtApprovePayroll(id) {
  const e = evtFind(id);
  if (!e) return;
  if (!evtCan('payroll.approve')) { showToast('Approving payroll requires payroll.approve', 'error'); return; }
  MOCK.events = (MOCK.events || []).filter(x => x.id !== id);
  evtAudit('Payroll Run Approved', e.period + ' — ' + e.gym, `${e.headcount} employees · net ${evtMoney(e.netTotal)} approved and locked`, e.branch);
  showToast(e.period + ' payroll for ' + e.gym + ' approved & locked');
  renderAll();
}

// ==================== RENDER ====================
function renderEvents() {
  const counts = evtCounts();
  const all = (MOCK.events || []);
  const hiddenByPerm = all.filter(e => !evtCan(e.permission)).length;
  const gyms = evtGyms();
  const meta = evtTabMeta(_evtTab);

  // Keep the selected tab valid — it can disappear when its queue empties or a
  // permission is revoked mid-session.
  if (!EVENT_TABS.some(t => t.id === _evtTab) || (_evtTab !== 'escalations' && counts[_evtTab] && counts[_evtTab].open === 0 && counts[_evtTab].resolved === 0)) {
    const next = EVENT_TABS.find(t => counts[t.id].open > 0) || EVENT_TABS[0];
    if (next.id !== _evtTab) { _evtTab = next.id; return renderEvents(); }
  }

  const tabs = evtTabs().filter(t => counts[t.id] && (counts[t.id].open > 0 || counts[t.id].resolved > 0 || t.id === 'escalations'));
  const rows = _evtTab === 'escalations'
    ? evtInTab('escalations')
    : evtInTab(_evtTab).filter(e => _evtShowResolved ? !!e.resolved : !e.resolved);

  const sortKey = _evtTab === 'escalations' ? 'submittedDate' : (_evtTab === 'transfers' ? 'effectiveDate' : 'date');
  rows.sort((a, b) => {
    const av = a[sortKey] || a.date || '', bv = b[sortKey] || b.date || '';
    return av > bv ? 1 : av < bv ? -1 : 0;
  });

  const render = EVENT_CARD[_evtTab];
  const body = rows.length
    ? `<div class="evt-list">${rows.map(render).join('')}</div>`
    : `<div class="evt-empty">
        <svg class="w-7 h-7 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="text-xs text-charcoal-600 font-medium">${_evtShowResolved ? 'Nothing resolved here yet' : 'Queue is clear'}</p>
        <p class="text-[10px] text-charcoal-400 mt-0.5">${_evtShowResolved ? 'Items you resolve will be archived on this tab.' : 'No open ' + meta.label.toLowerCase() + ' items right now.'}</p>
       </div>`;

  const resolvedAvailable = counts[_evtTab] && counts[_evtTab].resolved > 0;
  const openCount = (counts[_evtTab] ? counts[_evtTab].open : 0) + (_evtTab === 'escalations' ? 0 : 0);
  const tabHigh = counts[_evtTab] ? counts[_evtTab].high : 0;

  return `<div class="evt-shell">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 flex-shrink-0">
      <div class="min-w-0">
        <h1 class="text-sm font-bold text-charcoal-900 leading-tight">Events</h1>
        <p class="text-[10px] text-charcoal-500">HR action queue${hiddenByPerm > 0 ? ` · ${hiddenByPerm} item${hiddenByPerm > 1 ? 's' : ''} hidden by your permissions` : ''}</p>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <select onchange="evtSetGym(this.value)" class="form-select w-auto" style="height:26px;font-size:10px" aria-label="Filter events by branch">
          <option value="all" ${_evtGym === 'all' ? 'selected' : ''}>All Gyms</option>
          ${gyms.map(g => `<option value="${evtEsc(g)}" ${_evtGym === g ? 'selected' : ''}>${evtEsc(g)}</option>`).join('')}
        </select>
        ${resolvedAvailable ? `<button onclick="evtToggleResolved()" class="btn btn-sm ${_evtShowResolved ? 'btn-secondary' : 'btn-ghost'}" style="height:26px;font-size:10px">
          ${_evtShowResolved ? 'Back to open' : `View resolved (${counts[_evtTab].resolved})`}
        </button>` : ''}
      </div>
    </div>

    <div class="evt-tabs" role="tablist">
      ${tabs.map(t => {
        const c = counts[t.id] || { open: 0, high: 0, resolved: 0 };
        const active = t.id === _evtTab;
        return `<button onclick="evtSetTab('${t.id}')" class="evt-tab ${active ? 'is-active' : ''}" role="tab" aria-selected="${active}">
          <svg class="evt-tab-ico" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${t.icon}"/></svg>
          <span class="evt-tab-label">${t.label}</span>
          <span class="evt-tab-n ${c.open === 0 ? 'is-zero' : (c.high > 0 ? 'is-high' : '')}">${c.open}</span>
          ${c.high > 0 ? '<span class="evt-tab-dot" title="contains high-urgency items"></span>' : ''}
        </button>`;
      }).join('')}
    </div>

    <div class="evt-sub">
      <p class="bento-label">${meta.label.toUpperCase()}${_evtShowResolved ? ' · RESOLVED' : ''}</p>
      <p class="text-[9px] text-charcoal-500">${openCount} open${tabHigh > 0 ? ` · <b class="text-red-600">${tabHigh} high urgency</b>` : ''}${resolvedAvailable && !_evtShowResolved ? ` · ${counts[_evtTab].resolved} resolved` : ''}</p>
    </div>

    <div class="evt-body">${body}</div>
  </div>`;
}
