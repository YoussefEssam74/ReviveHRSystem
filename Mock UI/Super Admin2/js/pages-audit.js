// ==================== PAGE: SECURITY & AUDIT ====================
// A raw event dump answers nothing. This page leads with the exceptions that need a
// decision, then the platform owner's own impersonation trail, and only then the
// complete log for investigation.
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

function renderSecurityAudit() {
  const f = state.auditFilters;
  const rows = filterAudit(f);

  const reviewQueue = AUDIT
    .filter((a) => a.severity !== 'info' && !a.reviewed)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || new Date(b.ts) - new Date(a.ts));
  const impersonations = AUDIT.filter((a) => a.action === 'Entered gym workspace');
  const failedSignIns = AUDIT.filter((a) => /sign-in/i.test(a.action) && a.severity !== 'info');
  const exports = AUDIT.filter((a) => a.category === 'Data' && /export/i.test(a.action));

  const categories = [...new Set(AUDIT.map((a) => a.category))].sort();
  const gymOptions = GYMS.map((g) => `<option value="${g.id}"${f.gym === g.id ? ' selected' : ''}>${esc(g.name)} — ${esc(g.location)}</option>`).join('');
  const catOptions = categories.map((c) => `<option value="${c}"${f.category === c ? ' selected' : ''}>${c}</option>`).join('');

  const sevOptions = [
    ['all', 'All severities', AUDIT.length],
    ['critical', 'Critical', AUDIT.filter((a) => a.severity === 'critical').length],
    ['warning', 'Warning', AUDIT.filter((a) => a.severity === 'warning').length],
    ['info', 'Info', AUDIT.filter((a) => a.severity === 'info').length],
  ].map(([key, label, count]) => `<option value="${key}"${f.severity === key ? ' selected' : ''}>${esc(label)} (${count})</option>`).join('');

  return `
  ${pageHeader(
    'Security & audit',
    `${reviewQueue.length} event${reviewQueue.length === 1 ? '' : 's'} awaiting review · ${AUDIT.length} recorded across ${GYMS.length} gyms · append-only`,
    `<button onclick="toast('Audit export queued as CSV — prototype only','info')" class="btn btn-secondary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
      Export
    </button>
    <button onclick="openAuditPolicy()" class="btn btn-secondary btn-sm">Retention policy</button>`
  )}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${kpiTile('Awaiting review', String(reviewQueue.length), `${AUDIT.filter((a) => a.severity === 'critical').length} critical in total`, 'alert', reviewQueue.some((a) => a.severity === 'critical') ? 'red' : reviewQueue.length ? 'amber' : '')}
    ${kpiTile('Workspace sessions', String(impersonations.length), 'your impersonations', 'lock')}
    ${kpiTile('Failed sign-ins', String(failedSignIns.length), failedSignIns.length ? 'possible credential attack' : 'none recorded', 'shield', failedSignIns.length ? 'amber' : '')}
    ${kpiTile('Data exports', String(exports.length), 'employee data leaving the platform', 'chart', exports.length ? 'amber' : '')}
  </div>

  <div class="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
    <div class="xl:col-span-2">${reviewQueueCard(reviewQueue)}</div>
    <div>${impersonationCard(impersonations)}</div>
  </div>

  <div class="card card-grow">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Complete trail</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${rows.length} of ${AUDIT.length} events · immutable records</p>
      </div>
      <button onclick="navigateTo('audit')" class="btn btn-sm btn-ghost text-brand-700">Reset filters</button>
    </div>
    <div class="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-charcoal-100">
      <select class="form-select form-input-sm w-auto" onchange="setAuditFilter('severity',this.value)" aria-label="Filter by severity">
        ${sevOptions}
      </select>
      <select class="form-select form-input-sm w-auto" onchange="setAuditFilter('gym',this.value)">
        <option value="all"${f.gym === 'all' ? ' selected' : ''}>All gyms</option>
        <option value="platform"${f.gym === 'platform' ? ' selected' : ''}>Platform only</option>
        ${gymOptions}
      </select>
      <select class="form-select form-input-sm w-auto" onchange="setAuditFilter('category',this.value)">
        <option value="all"${f.category === 'all' ? ' selected' : ''}>All categories</option>
        ${catOptions}
      </select>
      <div class="relative ml-auto">
        <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-charcoal-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input class="form-input form-input-sm pl-6 w-44" placeholder="Search action, actor, IP…" value="${esc(f.q)}" oninput="setAuditFilter('q',this.value)" aria-label="Search audit events">
      </div>
      ${(f.gym !== 'all' || f.category !== 'all' || f.severity !== 'all' || f.q) ? '<button onclick="resetAuditFilters()" class="btn btn-sm btn-ghost text-charcoal-500">Clear</button>' : ''}
    </div>
    ${auditTableHtml(rows, { showGym: true })}
    <div class="px-3 py-2 border-t border-charcoal-100">
      <p class="text-[10px] text-charcoal-400">Records are immutable — nothing can be edited or deleted from this trail, including by a Super Admin.</p>
    </div>
  </div>`;
}

function reviewQueueCard(queue) {
  if (!queue.length) {
    return `<div class="card h-full">
      <div class="card-head"><p class="bento-label flex-1">Needs your review</p><span class="badge badge-green">Clear</span></div>
      <div class="p-6 text-center">
        <span class="inline-flex w-9 h-9 rounded-xl bg-brand-50 text-brand-700 items-center justify-center mb-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </span>
        <p class="text-xs font-semibold text-charcoal-700">Nothing needs you right now</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Every critical and warning event has been reviewed.</p>
      </div>
    </div>`;
  }

  const rows = queue.map((a) => {
    const gym = getGym(a.gymId);
    return `<div class="px-3 py-2.5 border-b border-charcoal-100 last:border-0 flex items-start gap-2">
      <span class="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${a.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <p class="text-[11px] font-semibold text-charcoal-800 leading-tight">${esc(a.action)}</p>
          ${severityBadge(a.severity)}
        </div>
        <p class="text-[10px] text-charcoal-500 leading-snug mt-0.5">${esc(a.target)}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight mt-0.5">${esc(a.actor)} · ${esc(gym ? gym.name + ' — ' + gym.location : 'Platform')} · ${relativeTime(a.ts)} · ${esc(a.ip)}</p>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button onclick="openAuditDetail('${a.id}')" class="btn btn-sm btn-ghost text-charcoal-600">Details</button>
        <button onclick="markReviewed('${a.id}')" class="btn btn-sm btn-secondary">Reviewed</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="card h-full flex flex-col">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Needs your review</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Critical and warning events not yet acknowledged</p>
      </div>
      <span class="badge badge-red">${queue.length}</span>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto max-h-[24vh]">${rows}</div>
  </div>`;
}

function impersonationCard(sessions) {
  const rows = sessions.slice(0, 6).map((a) => {
    const gym = getGym(a.gymId);
    return `<button onclick="navigateTo('gym-detail',{gymId:'${a.gymId}'})" class="w-full text-left px-3 py-2 border-b border-charcoal-100 last:border-0 hover:bg-charcoal-50 flex items-start gap-2">
      <span class="avatar avatar-20 avatar-brand">${esc(a.initials)}</span>
      <span class="min-w-0 flex-1">
        <span class="block text-[11px] font-medium text-charcoal-700 leading-tight truncate">${esc(gym ? gym.name : 'Platform')}</span>
        <span class="block text-[10px] text-charcoal-400 leading-tight mt-0.5">${relativeTime(a.ts)} · ${esc(a.ip)}</span>
      </span>
      <svg class="w-3 h-3 text-charcoal-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
    </button>`;
  }).join('');

  return `<div class="card h-full flex flex-col">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Your workspace sessions</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Every time you acted inside a gym as its staff</p>
      </div>
      <span class="badge badge-brand">${sessions.length}</span>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto max-h-[24vh]">${rows || emptyState('No impersonation sessions recorded')}</div>
    <div class="px-3 py-2 border-t border-charcoal-100">
      <p class="text-[10px] text-charcoal-400 leading-snug">Impersonation is intentional and always logged. Sessions stay attributable to your Super Admin identity.</p>
    </div>
  </div>`;
}

function markReviewed(auditId) {
  const entry = AUDIT.find((a) => a.id === auditId);
  if (!entry) return;
  entry.reviewed = true;
  renderAll();
  toast(`${entry.action} marked as reviewed`, 'success');
}

function filterAudit(f) {
  const q = (f.q || '').toLowerCase();
  return AUDIT.filter((a) => {
    if (f.severity !== 'all' && a.severity !== f.severity) return false;
    if (f.gym === 'platform' && a.gymId) return false;
    if (f.gym !== 'all' && f.gym !== 'platform' && a.gymId !== f.gym) return false;
    if (f.category !== 'all' && a.category !== f.category) return false;
    if (q && !(`${a.action} ${a.actor} ${a.target} ${a.ip} ${a.detail}`).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

function setAuditFilter(key, value) {
  state.auditFilters[key] = value;
  const main = document.getElementById('main-content');
  const scroll = main ? main.scrollTop : 0;
  renderAll();
  if (main) main.scrollTop = scroll;
  if (key === 'q') {
    const input = main ? main.querySelector('input[placeholder="Search action, actor, IP…"]') : null;
    if (input) { input.focus(); input.setSelectionRange(value.length, value.length); }
  }
}

function resetAuditFilters() {
  state.auditFilters = { gym: 'all', category: 'all', severity: 'all', q: '' };
  renderAll();
}

// Shared by the gym detail audit tab.
function auditTableHtml(rows, opts) {
  opts = opts || {};
  const showGym = opts.showGym !== false;
  if (!rows.length) return `<div>${emptyState('No audit events match this filter', 'Try widening the gym or category.')}</div>`;

  const body = rows.map((a) => {
    const gym = getGym(a.gymId);
    return `<tr class="is-clickable" onclick="openAuditDetail('${a.id}')">
      <td class="whitespace-nowrap">
        <p class="text-[11px] font-medium text-charcoal-700 leading-tight">${formatDate(a.ts)}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight">${relativeTime(a.ts)}</p>
      </td>
      <td>
        <div class="flex items-center gap-1.5">
          <span class="avatar avatar-20 avatar-brand">${esc(a.initials)}</span>
          <div class="min-w-0">
            <p class="text-[11px] font-medium text-charcoal-800 truncate leading-tight">${esc(a.actor)}</p>
            <p class="text-[9px] text-charcoal-400 leading-tight">${esc(a.actorRole)}</p>
          </div>
        </div>
      </td>
      ${showGym ? `<td class="whitespace-nowrap">
        <span class="block text-[11px] ${gym ? 'text-charcoal-600' : 'text-charcoal-400 italic'} leading-tight">${esc(gym ? gym.name : 'Platform')}</span>
        ${gym ? `<span class="block text-[9px] text-charcoal-400 leading-tight">${esc(gym.location)}</span>` : ''}
      </td>` : ''}
      <td><span class="badge badge-gray">${esc(a.category)}</span></td>
      <td>
        <p class="text-[11px] font-semibold text-charcoal-800 leading-tight">${esc(a.action)}${a.reviewed ? ' <span class="badge badge-green">reviewed</span>' : ''}</p>
        <p class="text-[9px] text-charcoal-500 leading-tight truncate max-w-[220px]">${esc(a.target)}</p>
      </td>
      <td>${severityBadge(a.severity)}</td>
      <td class="whitespace-nowrap"><span class="font-mono text-[10px] text-charcoal-500">${esc(a.ip)}</span></td>
      <td class="text-right"><span class="text-[10px] font-semibold text-brand-700">View</span></td>
    </tr>`;
  }).join('');

  return `<div class="data-table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>When</th><th>Actor</th>${showGym ? '<th>Gym</th>' : ''}<th>Category</th><th>Action</th><th>Severity</th><th>IP address</th><th></th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function openAuditDetail(auditId) {
  const a = AUDIT.find((x) => x.id === auditId);
  if (!a) return;
  const gym = getGym(a.gymId);
  openModal({
    title: a.action,
    subtitle: `${a.id} · ${formatDateTime(a.ts)}`,
    width: 'max-w-lg',
    body: `<div class="flex items-center gap-2 mb-3 flex-wrap">
        ${severityBadge(a.severity)}
        <span class="badge badge-gray">${esc(a.category)}</span>
        ${gym ? `<span class="badge badge-brand">${esc(gym.name)} — ${esc(gym.location)}</span>` : '<span class="badge badge-purple">Platform</span>'}
        ${a.reviewed ? '<span class="badge badge-green">reviewed</span>' : ''}
      </div>
      <div class="flex items-center gap-2.5 mb-3 pb-3 border-b border-charcoal-100">
        <span class="avatar avatar-36 avatar-brand">${esc(a.initials)}</span>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-charcoal-900">${esc(a.actor)}</p>
          <p class="text-[10px] text-charcoal-500">${esc(a.actorRole)} · ${esc(a.ip)}</p>
        </div>
      </div>
      <dl class="text-[11px] divide-soft">
        ${[
          ['Record ID', a.id],
          ['Timestamp', formatDateTime(a.ts)],
          ['Target', a.target],
          ['Gym scope', gym ? `${gym.name} — ${gym.location}` : 'Platform-wide'],
          ['Category', a.category],
          ['Severity', a.severity],
          ['Source IP', a.ip],
        ].map(([k, v]) => `<div class="flex justify-between gap-3 py-1.5">
          <dt class="text-charcoal-500">${esc(k)}</dt>
          <dd class="font-semibold text-charcoal-800 text-right">${esc(v)}</dd></div>`).join('')}
      </dl>
      <div class="mt-3 rounded-lg bg-charcoal-50 border border-charcoal-200 px-3 py-2">
        <p class="text-[9px] font-bold uppercase tracking-wider text-charcoal-400 mb-1">Detail</p>
        <p class="text-[11px] text-charcoal-700 leading-relaxed">${esc(a.detail)}</p>
      </div>
      <p class="text-[10px] text-charcoal-400 mt-2">Immutable record — audit entries cannot be edited or deleted, including by a Super Admin.</p>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>
      ${a.severity !== 'info' && !a.reviewed ? `<button onclick="closeModal();markReviewed('${a.id}')" class="btn btn-sm btn-primary">Mark reviewed</button>` : ''}`,
  });
}

function openAuditPolicy() {
  openModal({
    title: 'Audit retention policy',
    width: 'max-w-md',
    body: `<dl class="text-[11px] divide-soft">
        ${[
          ['Platform events', 'Retained 7 years'],
          ['Gym-scoped events', 'Retained 3 years'],
          ['Impersonation sessions', 'Retained 7 years · always flagged'],
          ['Export packages', 'Retained 90 days'],
          ['Deletion', 'Never — append-only'],
        ].map(([k, v]) => `<div class="flex justify-between gap-3 py-1.5">
          <dt class="text-charcoal-500">${esc(k)}</dt>
          <dd class="font-semibold text-charcoal-800 text-right">${esc(v)}</dd></div>`).join('')}
      </dl>
      <p class="text-[10px] text-charcoal-400 mt-2">Policy applies to every tenant. Changing it is itself recorded as a Settings event.</p>`,
    footer: '<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>',
  });
}
