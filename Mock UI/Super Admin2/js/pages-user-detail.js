// ==================== PAGE: USER PROFILE ====================
// A full page instead of a modal: employment record, access, permissions and the
// user's own slice of the audit trail.
function renderUserProfile() {
  const user = getUser(state.activeUserId);
  if (!user) return `<div class="card">${emptyState('User not found', 'Pick a user from the Users page.')}</div>`;

  const gym = getGym(user.gymId);
  const role = ROLES.find((r) => r.name === user.role);
  const perms = role ? role.permissions : [];
  const groupCounts = {};
  perms.forEach((key) => {
    const entry = PERMISSION_CATALOG.find((p) => p.key === key);
    const g = entry ? entry.group : 'Other';
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  });
  const userEvents = AUDIT.filter((a) => a.actor === user.name).slice(0, 6);

  return `
  <nav class="flex items-center gap-1.5 text-[10px] text-charcoal-500 mb-2 flex-wrap">
    <button onclick="navigateTo('users')" class="hover:text-brand-700 font-medium">Users</button>
    <span class="text-charcoal-300">/</span>
    <span class="text-charcoal-700 font-semibold">${esc(user.name)}</span>
  </nav>

  <div class="card p-3 mb-3">
    <div class="flex items-start gap-3 flex-wrap">
      ${avatarHtml(user, 48)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-base font-bold text-charcoal-900 leading-tight">${esc(user.name)}</h2>
          ${statusBadge(user.status)}
          <span class="badge ${user.role === 'HR Manager' ? 'badge-purple' : user.role === 'HR' ? 'badge-blue' : 'badge-gray'}">${esc(user.role)}</span>
        </div>
        <p class="text-[11px] text-charcoal-500 mt-0.5">${esc(user.email)} · ${esc(user.phone)}</p>
        <div class="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-charcoal-500">
          <button onclick="navigateTo('gym-detail',{gymId:'${user.gymId}'})" class="flex items-center gap-1 hover:text-brand-700">
            ${gymLogo(gym, 36)}
            <span>${esc(gym ? gym.name : user.gymName)} — ${esc(gym ? gym.location : '')}</span>
          </button>
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            ${esc(user.branch || '—')}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button onclick="openWorkspace('${user.gymId}','${esc(user.role)}')" class="btn btn-primary btn-sm">Enter gym as ${esc(user.role)}</button>
        <button onclick="openResetPassword('${user.id}')" class="btn btn-secondary btn-sm">Reset password</button>
        <button onclick="toggleManagerStatus('${user.id}')" class="btn ${user.status === 'Suspended' ? 'btn-success' : 'btn-danger-outline'} btn-sm">${user.status === 'Suspended' ? 'Reactivate' : 'Suspend'}</button>
      </div>
    </div>
  </div>

  <div class="grow scroll-region">
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${kpiTile('Role', esc(user.role), role ? role.type + ' role' : 'No role assigned', 'shield')}    ${kpiTile('Permissions', String(perms.length), role ? `${role.scope} scope` : '—', 'lock')}
    ${kpiTile('Last sign-in', user.lastLogin ? relativeTime(user.lastLogin) : 'Never', user.lastLogin ? formatDate(user.lastLogin) : 'Invitation pending', 'check')}
    ${kpiTile('Branch', esc(user.branch || '—'), esc(user.branchCode || 'Not assigned'), 'building')}
  </div>

  <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
    <div class="xl:col-span-2 space-y-3">
      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Employment record</p></div>
        <dl class="px-3 py-2.5 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          ${[
            ['User ID', user.id],
            ['Full name', user.name],
            ['Work email', user.email],
            ['Phone', user.phone],
            ['Gym account', gym ? `${gym.name} — ${gym.location}` : user.gymName],
            ['Branch', user.branch || '—'],
            ['Branch code', user.branchCode || '—'],
            ['Role', user.role],
            ['Permission preset', user.preset || `Standard ${user.role}`],
            ['Joined', formatDate(user.createdAt)],
            ['Created by', user.source],
            ['Account status', user.status],
          ].map(([k, v]) => `<div class="flex justify-between gap-3 py-1 border-b border-charcoal-100 last:border-0">
            <dt class="text-charcoal-500">${esc(k)}</dt>
            <dd class="font-semibold text-charcoal-800 text-right truncate">${esc(v)}</dd></div>`).join('')}
        </dl>
      </div>

      <div class="card">
        <div class="card-head">
          <p class="bento-label flex-1">Recent activity</p>
          <button onclick="navigateTo('audit')" class="btn btn-sm btn-ghost text-brand-700">Security &amp; audit →</button>
        </div>
        ${userEvents.length
          ? `<div>${userEvents.map((a) => `<div class="px-3 py-2 border-b border-charcoal-100 last:border-0 flex items-start gap-2">
              <span class="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.severity === 'critical' ? 'bg-red-500' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-charcoal-300'}"></span>
              <div class="min-w-0 flex-1">
                <p class="text-[11px] text-charcoal-700 leading-tight"><strong class="font-semibold">${esc(a.action)}</strong> · ${esc(a.target)}</p>
                <p class="text-[10px] text-charcoal-400 leading-tight mt-0.5">${relativeTime(a.ts)} · ${esc(a.category)} · ${esc(a.ip)}</p>
              </div>
              <button onclick="openAuditDetail('${a.id}')" class="text-[10px] font-semibold text-brand-700 flex-shrink-0">View</button>
            </div>`).join('')}</div>`
          : emptyState('No recorded activity for this user')}
      </div>
    </div>

    <div class="space-y-3">
      <div class="card">
        <div class="card-head">
          <p class="bento-label flex-1">Permissions from role</p>
          <span class="badge badge-brand">${perms.length}</span>
        </div>
        <div class="px-3 py-2.5 space-y-1.5">
          ${Object.keys(groupCounts).length
            ? Object.entries(groupCounts).map(([group, count]) => `<div class="flex items-center justify-between gap-2">
                <span class="text-[10px] text-charcoal-600 truncate">${esc(group)}</span>
                <span class="text-[10px] font-semibold text-charcoal-800 flex-shrink-0">${count}</span>
              </div>`).join('')
            : '<p class="text-[10px] text-charcoal-400">This role has no permissions assigned.</p>'}
        </div>
        <div class="px-3 py-2 border-t border-charcoal-100">
          <button onclick="navigateTo('access')" class="btn btn-sm btn-ghost text-brand-700 w-full">Manage roles →</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><p class="bento-label flex-1">Access details</p></div>
        <dl class="px-3 py-2.5 text-[10px] space-y-1.5">
          <div class="flex justify-between gap-2"><dt class="text-charcoal-500">Last sign-in</dt><dd class="font-semibold text-charcoal-800 text-right">${user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}</dd></div>
          <div class="flex justify-between gap-2"><dt class="text-charcoal-500">Gym scope</dt><dd class="font-semibold text-charcoal-800 text-right">${esc(gym ? gym.name : '—')}</dd></div>
          <div class="flex justify-between gap-2"><dt class="text-charcoal-500">Branch scope</dt><dd class="font-semibold text-charcoal-800 text-right">${esc(user.branch || 'All branches')}</dd></div>
        </dl>
      </div>
    </div>
  </div>
  </div>`;
}
