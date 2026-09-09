// ==================== REQUESTS ====================
let _reqFilter = 'pending';
let _reqTab = 'inbox';
let _reqType = 'all';

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

  let list = [];
  if (_reqTab === 'inbox') list = _reqFilter === 'pending' ? pendingHR : (_reqFilter === 'decided' ? decided : archived);
  else list = [...pendingHR, ...decided, ...archived];
  if (_reqType !== 'all') list = list.filter(r => r.type === _reqType);

  const tabs = [
    { id: 'inbox', label: 'Inbox', count: pendingHR.length },
    { id: 'all', label: 'All Requests', count: decided.length + archived.length },
  ];

  const kpi = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
    <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-red-500"><p class="text-lg font-bold text-red-600">${urgent}<span class="text-[10px] font-normal text-charcoal-400">/${pendingHR.length}</span></p><p class="text-[10px] text-charcoal-500">Urgent — Pending HR</p></div>
    <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-brand-600">${approvedThisMonth}</p><p class="text-[10px] text-charcoal-500">Approved (Sept)</p></div>
    <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-charcoal-900">${bmRejected}</p><p class="text-[10px] text-charcoal-500">BM Rejected</p></div>
    <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-yellow-600">${all.filter(r=>r.type==='Day Off').length}</p><p class="text-[10px] text-charcoal-500">Day-Off Requests</p></div>
  </div>`;

  let body = `<div class="flex items-center justify-between mb-2 flex-wrap gap-2">
    <div class="flex items-center gap-1 bg-charcoal-100 rounded-lg p-0.5">
      ${_reqTab === 'inbox' ? `
        <button onclick="_reqFilter='pending';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${_reqFilter==='pending'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">Pending HR${pendingHR.length?` <span class="badge badge-red text-[9px]">${pendingHR.length}</span>`:''}</button>
        <button onclick="_reqFilter='decided';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${_reqFilter==='decided'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">Decided</button>
        <button onclick="_reqFilter='archived';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${_reqFilter==='archived'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">Archived</button>` :
        `<button onclick="_reqFilter='pending';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${_reqFilter==='pending'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">All (with BM)</button>`}
    </div>
    <div class="flex items-center gap-1.5 flex-wrap">
      <select onchange="_reqType=this.value;renderAll()" class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.75rem">
        <option value="all">All Types</option>
        ${Object.keys(REQ_ICONS).map(t=>`<option ${_reqType===t?'selected':''}>${t}</option>`).join('')}
      </select>
      ${canDecide && pendingHR.length && _reqTab==='inbox' && _reqFilter==='pending' ? `<button onclick="showToast('All ' + ${pendingHR.length} + ' approved in bulk')" class="btn btn-sm btn-primary">Bulk Approve</button>` : ''}
    </div>
  </div>`;

  if (!list.length) {
    body += `<div class="bg-white rounded-xl border border-charcoal-200 p-8 text-center"><svg class="w-10 h-10 text-charcoal-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/></svg><p class="text-xs text-charcoal-500">No requests here.</p></div>`;
  } else {
    body += `<div class="space-y-1.5">${list.map(renderRequestCard).join('')}</div>`;
  }

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Requests</h1><p class="text-xs text-charcoal-500 mt-0.5">Day off, leave early & approvals — BM & HR flow</p></div>
      <button onclick="openNewRequest()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Request</button>
    </div>
    ${kpi}
    <div class="flex border-b border-charcoal-100">
      ${tabs.map(t => `<button onclick="_reqTab='${t.id}';renderAll()" class="tab-btn ${_reqTab===t.id?'active':''}">${t.label}${t.count ? ` <span class="badge badge-red text-[9px] ml-0.5">${t.count}</span>` : ''}</button>`).join('')}
    </div>
    ${body}
    ${!canDecide ? `<p class="text-[10px] text-charcoal-400 text-center">Final approve/reject requires <code>requests.approve</code> (HR Manager). You can view requests and BM decisions only.</p>` : ''}
  </div>`;
}

const REQ_ICONS = {
  'Day Off': 'M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'Leave Early': 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  'Late Arrival': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  'Shift Swap': 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
};

function reqUrgency(r) {
  if (r.type === 'Late Arrival' || r.type === 'Leave Early') return 'Urgent';
  if (r.bmDecision === 'Rejected') return 'Review';
  return 'Normal';
}

function urgencyTag(r) {
  const u = reqUrgency(r);
  if (u === 'Urgent') return `<span class="badge badge-red text-[9px]">Urgent</span>`;
  if (u === 'Review') return `<span class="badge badge-yellow text-[9px]">BM Rejected</span>`;
  return `<span class="badge badge-blue text-[9px]">Normal</span>`;
}

function renderRequestCard(r) {
  const showAll = DEMO.showAll;
  const canDecide = showAll || hasPermission('requests.approve');
  const pendingHire = r.status === 'Pending HR Review';

  const icon = REQ_ICONS[r.type] || 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';

  const timelineHtml = (r.timeline || []).map(step => `<div class="flex items-center gap-2">
    <span class="w-2 h-2 rounded-full ${step.done ? 'bg-brand-500' : 'bg-charcoal-200'} flex-shrink-0"></span>
    <span class="text-[10px] ${step.done ? 'text-charcoal-700' : 'text-charcoal-400'}">${step.step}</span>
    <span class="text-[9px] text-charcoal-400 ml-auto">${step.date}</span>
  </div>`).join('');

  return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-start justify-between">
      <div class="flex items-start gap-2.5">
        <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg></div>
        <div>
          <div class="flex items-center gap-2 flex-wrap"><p class="text-xs font-medium text-charcoal-900">${r.employee}</p><span class="text-[9px] text-charcoal-400">${r.gym}</span>${statusBadge(r.status)}${pendingHire?urgencyTag(r):''}</div>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${r.type} · ${r.requestedDate} · Submitted ${formatDate(r.submittedDate)}</p>
          ${r.reason ? `<p class="text-[10px] text-charcoal-600 mt-0.5">${r.reason}</p>` : ''}
        </div>
      </div>
      <div class="text-right text-[9px] text-charcoal-400 whitespace-nowrap">ID ${r.id.toUpperCase()}</div>
    </div>
    ${r.bmDecision ? `<div class="mt-2.5 bg-charcoal-50 rounded-lg p-2.5 border-l-4 ${r.bmDecision==='Approved'?'border-l-brand-500':'border-l-red-500'}">
      <p class="text-[9px] uppercase tracking-wide text-charcoal-500">BUILDING MANAGER DECISION</p>
      <p class="text-xs mt-0.5 ${r.bmDecision==='Approved'?'text-brand-700':'text-red-700'} font-medium">${r.bmDecision}${r.bmComment ? ` — ${r.bmComment}` : ''}</p>
    </div>` : ''}
    ${pendingHire && timelineHtml ? `<div class="mt-2.5 bg-charcoal-50/60 rounded-lg p-2.5 space-y-1">${timelineHtml}</div>` : ''}
    <div class="flex gap-1.5 mt-2.5 flex-wrap">
      ${pendingHire && canDecide ? `<button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-primary flex-1 min-w-[110px]">Approve</button><button onclick="openRequestDecision('${r.id}', 'reject')" class="btn btn-sm btn-danger-outline flex-1 min-w-[110px]">Reject</button>` : ''}
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

  const timeline = (r.timeline || []).map(step => `<div class="flex items-start gap-2.5">
    <div class="flex flex-col items-center"><span class="w-3 h-3 rounded-full ${step.done?'bg-brand-500':'bg-charcoal-200'} mt-0.5"></span>${step.done?'<span class="w-0.5 h-5 bg-brand-500 mt-0.5"></span>':''}</div>
    <div class="pb-3"><p class="text-xs font-medium text-charcoal-800">${step.step}</p><p class="text-[9px] text-charcoal-400">${step.date}</p></div>
  </div>`).join('');

  openModal(`Decide Request — ${r.employee}`, `<div class="space-y-3">
    <div class="flex items-center gap-2 flex-wrap"><span class="badge badge-gray text-[9px]">${r.type}</span><span class="badge badge-gray text-[9px]">${r.gym}</span>${statusBadge(r.status)}${urgencyTag(r)}</div>
    <div class="grid grid-cols-2 gap-2 bg-charcoal-50 rounded-lg p-2.5 text-[11px]">
      <div><p class="text-[9px] uppercase text-charcoal-400">Requested for</p><p class="font-medium text-charcoal-800">${r.requestedDate}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">Submitted</p><p class="font-medium text-charcoal-800">${formatDate(r.submittedDate)}</p></div>
      <div class="col-span-2"><p class="text-[9px] uppercase text-charcoal-400">Reason</p><p class="font-medium text-charcoal-800">${r.reason || '—'}</p></div>
    </div>
    <div class="bg-charcoal-50 rounded-lg p-2.5 border-l-4 ${r.bmDecision==='Approved'?'border-l-brand-500':'border-l-red-500'}">
      <p class="text-[9px] uppercase tracking-wide text-charcoal-500">BUILDING MANAGER</p>
      <p class="text-xs mt-0.5 ${r.bmDecision==='Approved'?'text-brand-700':'text-red-700'} font-medium">${r.bmDecision}${r.bmComment ? ` — ${r.bmComment}` : ''}</p>
    </div>
    <div>${timeline || '<p class="text-[10px] text-charcoal-400">No timeline yet.</p>'}</div>
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-[10px] text-yellow-800 leading-relaxed">You are the final approver. Your decision replaces the request's status and becomes visible to the employee.</div>
    <div><label class="form-label">${isReject ? 'Rejection reason' : 'Approval note (optional)'}</label><textarea class="form-input" rows="2" placeholder="${isReject ? 'Required for rejection…' : 'Optional note…'}"></textarea></div>
  </div>`, { wide: true, footer:
    `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
     <button onclick="closeModal();showToast('Request rejected · employee notified','error')" class="btn btn-sm btn-danger-outline">Reject</button>
     <button onclick="closeModal();showToast('Request approved · employee notified')" class="btn btn-sm btn-primary">Approve</button>` });
}

function openRequestDetail(id) {
  const r = MOCK.requests.find(x => x.id === id); if (!r) return;
  const canDecide = DEMO.showAll || hasPermission('requests.approve');
  const steps = (r.timeline || []).map(step => `<div class="flex items-start gap-2.5">
    <div class="flex flex-col items-center"><span class="w-3 h-3 rounded-full ${step.done?'bg-brand-500':'bg-charcoal-200'} mt-0.5"></span>${step.done?'<span class="w-0.5 h-5 bg-brand-500 mt-0.5"></span>':''}</div>
    <div class="pb-3"><p class="text-xs font-medium text-charcoal-800">${step.step}</p><p class="text-[9px] text-charcoal-400">${step.date}</p></div>
  </div>`).join('');
  openModal(`Request ${r.id.toUpperCase()} — ${r.employee}`, `<div class="space-y-3">
    <div class="flex items-center gap-2 flex-wrap"><span class="badge badge-gray text-[9px]">${r.type}</span><span class="badge badge-gray text-[9px]">${r.gym}</span>${statusBadge(r.status)}${reqUrgency(r)!=='Normal'?urgencyTag(r):''}</div>
    <p class="text-[11px] text-charcoal-600">${r.requestedDate} · Submitted ${formatDate(r.submittedDate)}</p>
    ${r.reason ? `<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[9px] uppercase tracking-wide text-charcoal-500">Reason</p><p class="text-xs mt-0.5 text-charcoal-800">${r.reason}</p></div>` : ''}
    <div class="bg-charcoal-50 rounded-lg p-2.5">
      <p class="text-[9px] uppercase tracking-wide text-charcoal-500">BUILDING MANAGER DECISION</p>
      ${r.bmDecision ? `<p class="text-xs mt-0.5 ${r.bmDecision==='Approved'?'text-brand-700':'text-red-700'} font-medium">${r.bmDecision}${r.bmComment ? ` — ${r.bmComment}` : ''}</p>` : `<p class="text-xs mt-0.5 text-charcoal-400">No BM decision recorded yet.</p>`}
    </div>
    <div>${steps || '<p class="text-[10px] text-charcoal-400">No timeline.</p>'}</div>
  </div>`, { wide: true, footer:
    `${r.status==='Pending HR Review'&&canDecide ? `<button onclick="closeModal();openRequestDecision('${r.id}')" class="btn btn-sm btn-primary">Decide</button>`:''}<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>` });
}

function openNewRequest() {
  openModal('New Request', `<form onsubmit="event.preventDefault();showToast('Request submitted to Building Manager');closeModal();" class="space-y-3">
    <div><label class="form-label">Employee</label><select class="form-select"><option>Omar Youssef</option><option>Yasmin Adel</option><option>Mohamed Adel</option></select></div>
    <div><label class="form-label">Type</label><select class="form-select"><option>Day Off</option><option>Leave Early</option><option>Late Arrival</option><option>Shift Swap</option></select></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="form-label">Date</label><input type="date" class="form-input" value="2026-09-14"></div><div><label class="form-label">End</label><input type="date" class="form-input" value="2026-09-16"></div></div>
    <div><label class="form-label">Reason</label><textarea class="form-input" rows="2" placeholder="Reason..."></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Submit Request</button></div>
  </form>`);
}