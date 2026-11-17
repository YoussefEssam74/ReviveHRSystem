// ==================== PAGE: PLATFORM USERS ====================
// One toolbar, one table: gym on the left as a dropdown (it carries the per-gym counts),
// role and status next to it, and the search pinned to the right edge.
function renderUsers() {
  const t = platformTotals();
  const f = state.userFilters;
  const counts = roleCounts(USERS);

  const filtered = filterUsers(f);
  const limit = state.userLimit || 60;
  const shown = filtered.slice(0, limit);
  const activeUsers = USERS.filter((u) => u.status === 'Active').length;
  const suspended = USERS.filter((u) => u.status === 'Suspended').length;

  const gymOptions = [{ id: 'all', label: 'All gyms', count: t.totalUsers }]
    .concat(GYMS.map((g) => ({ id: g.id, label: `${g.name} — ${g.location}`, count: g.userCounts.total })))
    .map((g) => `<option value="${g.id}"${f.gym === g.id ? ' selected' : ''}>${esc(g.label)} (${g.count})</option>`).join('');

  const roleOptions = [['all', 'All roles', counts.total], ['HR Manager', 'HR managers', counts.hrManager], ['HR', 'HR staff', counts.hr], ['Branch Manager', 'Branch managers', counts.branchManager], ['Team Leader', 'Team leaders', counts.teamLeader], ['Employee', 'Employees', counts.employee]]
    .map(([key, label, count]) => `<option value="${key}"${f.role === key ? ' selected' : ''}>${esc(label)} (${count})</option>`).join('');

  const statusOptions = [['all', 'Any status'], ['Active', 'Active'], ['Invited', 'Invited'], ['On leave', 'On leave'], ['Suspended', 'Suspended']]
    .map(([key, label]) => `<option value="${key}"${f.status === key ? ' selected' : ''}>${esc(label)}</option>`).join('');

  const rows = shown.map((u) => {
    const gym = getGym(u.gymId);
    return `<tr class="is-clickable" onclick="navigateTo('user-detail',{userId:'${u.id}'})">
      <td>
        <div class="flex items-center gap-2">
          ${avatarHtml(u, 28)}
          <div class="min-w-0">
            <p class="text-xs font-medium text-charcoal-800 truncate leading-tight">${esc(u.name)}</p>
            <p class="text-[10px] text-charcoal-500 truncate leading-tight">${esc(u.email)}</p>
          </div>
        </div>
      </td>
      <td><span class="badge ${u.role === 'HR Manager' ? 'badge-purple' : u.role === 'HR' ? 'badge-blue' : 'badge-gray'}">${esc(u.role)}</span></td>
      <td class="min-w-0">
        <span class="block text-[11px] text-charcoal-600 truncate max-w-[170px] text-left">${esc(gym ? gym.name : u.gymName)}</span>
        <p class="text-[9px] text-charcoal-400">${esc(gym ? gym.location : '')}</p>
      </td>
      <td>${statusBadge(u.status)}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-500">${u.lastLogin ? relativeTime(u.lastLogin) : 'Never'}</td>
      <td class="text-right whitespace-nowrap">
        <button onclick="event.stopPropagation();navigateTo('user-detail',{userId:'${u.id}'})" class="btn btn-sm btn-ghost text-brand-700">View</button>
      </td>
    </tr>`;
  }).join('');

  return `
  ${pageHeader(
    'Users',
    `${formatNumber(t.totalUsers)} users across ${t.totalGyms} gym accounts · ${counts.hrManager} HR managers`,
    `<button onclick="openCreateHRManager()" class="btn btn-primary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
      Create HR manager
    </button>`
  )}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${kpiTile('Total users', formatNumber(counts.total), `${counts.employee} employees · ${counts.hr + counts.hrManager} HR staff`, 'users')}
    ${kpiTile('HR managers', String(counts.hrManager), 'one owner per gym', 'shield')}
    ${kpiTile('Active accounts', formatNumber(activeUsers), `${counts.total - activeUsers} inactive or invited`, 'check')}
    ${kpiTile('Suspended', formatNumber(suspended), suspended ? 'access blocked' : 'none suspended', 'lock', suspended ? 'amber' : '')}
  </div>

  <div class="card card-grow">
    <div class="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-charcoal-100">
      <select class="form-select form-input-sm w-auto" onchange="setUserFilter('gym',this.value)" aria-label="Filter by gym account">
        ${gymOptions}
      </select>
      <select class="form-select form-input-sm w-auto" onchange="setUserFilter('role',this.value)" aria-label="Filter by role">
        ${roleOptions}
      </select>
      <select class="form-select form-input-sm w-auto" onchange="setUserFilter('status',this.value)" aria-label="Filter by status">
        ${statusOptions}
      </select>
      ${(f.gym !== 'all' || f.role !== 'all' || f.status !== 'all' || f.q) ? '<button onclick="resetUserFilters()" class="btn btn-sm btn-ghost text-charcoal-500">Clear</button>' : ''}
      <div class="relative ml-auto w-64">
        <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-charcoal-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input class="form-input form-input-sm pl-6 w-full" placeholder="Search name or email…" value="${esc(f.q)}" oninput="setUserFilter('q',this.value)" aria-label="Search users by name or email">
      </div>
    </div>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>User</th><th>Role</th><th>Gym account</th><th>Status</th><th>Last sign-in</th><th></th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="6">${emptyState('No users match these filters', 'Try a different gym, role or search term.')}</td></tr>`}</tbody>
      </table>
    </div>

    <div class="px-3 py-2 border-t border-charcoal-100 flex items-center justify-between gap-2 flex-wrap">
      <p class="text-[10px] text-charcoal-500">Showing ${formatNumber(shown.length)} of ${formatNumber(filtered.length)} matching users${filtered.length !== counts.total ? ` · ${formatNumber(counts.total)} total` : ''}</p>
      ${filtered.length > shown.length ? `<button onclick="showMoreUsers()" class="btn btn-sm btn-secondary">Show 60 more</button>` : ''}
    </div>
  </div>`;
}

function filterUsers(f) {
  const q = f.q.toLowerCase();
  return USERS.filter((u) => {
    if (f.gym !== 'all' && u.gymId !== f.gym) return false;
    if (f.role !== 'all' && u.role !== f.role) return false;
    if (f.status !== 'all' && u.status !== f.status) return false;
    if (q && !(u.name + ' ' + u.email + ' ' + u.gymName).toLowerCase().includes(q)) return false;
    return true;
  });
}

function setUserFilter(key, value) {
  state.userFilters[key] = value;
  state.userLimit = 60;
  const main = document.getElementById('main-content');
  const scroll = main ? main.scrollTop : 0;
  renderAll();
  if (main) main.scrollTop = scroll;
  if (key === 'q') {
    const input = main ? main.querySelector('input[placeholder="Search name or email…"]') : null;
    if (input) { input.focus(); input.setSelectionRange(value.length, value.length); }
  }
}

function resetUserFilters() {
  state.userFilters = { gym: 'all', role: 'all', status: 'all', q: '' };
  state.userLimit = 60;
  renderAll();
}

function showMoreUsers() {
  state.userLimit = (state.userLimit || 60) + 60;
  renderAll();
}
