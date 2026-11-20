// ==================== SHARED: AUDIT LOG ====================
// The standalone audit page is gone, but the immutable trail is still the source of
// truth inside a gym account and on a user profile. These helpers render and inspect it.

function markReviewed(auditId) {
  const entry = AUDIT.find((a) => a.id === auditId);
  if (!entry) return;
  entry.reviewed = true;
  renderAll();
  toast(`${entry.action} marked as reviewed`, 'success');
}

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
