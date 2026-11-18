// ==================== PAGE: HR MANAGER ACCOUNTS ====================
// HR Managers are a *platform* role: every account reaches every gym account, so they
// are not attached to a gym. Only HR staff are assigned to gyms — and to several at once.
function renderHRManagers() {
  const managers = getHRManagers();
  const active = managers.filter((m) => m.status === 'Active').length;
  const suspended = managers.filter((m) => m.status === 'Suspended').length;
  const invited = managers.filter((m) => m.status === 'Invited').length;
  const hrStaff = USERS.filter((u) => u.role === 'HR');
  const multiGym = hrStaff.filter((u) => (u.gymIds || []).length > 1).length;

  const rows = managers.map((m) => `<tr class="is-clickable" onclick="navigateTo('user-detail',{userId:'${m.id}'})">
      <td>
        <div class="flex items-center gap-2">
          ${avatarHtml(m, 28)}
          <div class="min-w-0">
            <p class="text-xs font-semibold text-charcoal-800 truncate leading-tight">${esc(m.name)}</p>
            <p class="text-[10px] text-charcoal-500 truncate leading-tight">${esc(m.email)}</p>
          </div>
        </div>
      </td>
      <td><span class="badge badge-brand">All ${GYMS.length} gym accounts</span></td>
      <td><span class="badge badge-purple">${esc((m.preset || 'HR Manager').replace('HR Manager — ', ''))}</span></td>
      <td>${statusBadge(m.status)}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-500">${m.lastLogin ? relativeTime(m.lastLogin) : 'Never'}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-500">${formatDate(m.createdAt)}</td>
      <td class="text-right whitespace-nowrap">
        <button onclick="event.stopPropagation();openResetPassword('${m.id}')" class="btn btn-sm btn-ghost text-charcoal-600">Reset</button>
        <button onclick="event.stopPropagation();toggleManagerStatus('${m.id}')" class="btn btn-sm btn-ghost ${m.status === 'Suspended' ? 'text-brand-700' : 'text-red-600 hover:bg-red-50'}">${m.status === 'Suspended' ? 'Restore' : 'Suspend'}</button>
      </td>
    </tr>`).join('');

  return `
  ${pageHeader(
    'HR manager accounts',
    `${managers.length} accounts · ${active} active${suspended ? ` · ${suspended} suspended` : ''}${invited ? ` · ${invited} awaiting invite` : ''} · each reaches all ${GYMS.length} gyms`,
    `<button onclick="openCreateHRManager()" class="btn btn-primary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
      Create HR manager account
    </button>`
  )}

  <div class="card card-grow mb-3">
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Manager</th>
          <th>Scope</th>
          <th>Preset</th>
          <th>Status</th>
          <th>Last sign-in</th>
          <th>Created</th>
          <th class="text-right">Actions</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="7">${emptyState('No HR manager accounts yet', 'Create one to give a person HR access to every gym.')}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="px-3 py-2 border-t border-charcoal-100 flex items-center justify-between gap-2 flex-wrap">
      <p class="text-[10px] text-charcoal-500">${managers.length} platform accounts · unscoped by gym</p>
      <p class="text-[10px] text-charcoal-400">${multiGym} HR staff ${multiGym === 1 ? 'is' : 'are'} assigned to more than one gym</p>
    </div>
  </div>

  ${accessLauncherStrip()}`;
}

// ==================== CREATE HR MANAGER ====================
function openCreateHRManager() {
  openModal({
    title: 'Create HR manager account',
    subtitle: 'An HR Manager reaches every gym account — no gym assignment needed',
    width: 'max-w-lg',
    body: `<form id="hrm-form" class="space-y-2.5" onsubmit="return false">
      <div><label class="form-label">Full name <span class="text-red-500">*</span></label>
        <input class="form-input" id="hrm-name" placeholder="e.g. Hoda Kamel"></div>
      <div><label class="form-label">Work email <span class="text-red-500">*</span></label>
        <input class="form-input" id="hrm-email" type="email" placeholder="name@revivehr.com"></div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="form-label">Phone</label>
          <input class="form-input" id="hrm-phone" placeholder="+20 100 000 0000"></div>
        <div><label class="form-label">Permission preset</label>
          <select class="form-select" id="hrm-preset">
            <option>HR Manager — Full</option>
            <option>HR Manager — Standard</option>
          </select></div>
      </div>
      <label class="form-check"><input type="checkbox" id="hrm-invite" checked> Email an activation invite now</label>
      <p class="text-[10px] text-charcoal-400">The account gets HR access to all ${GYMS.length} gym accounts at once. Recorded as a User event on the audit trail.</p>
    </form>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="submitCreateHRManager()" class="btn btn-sm btn-primary">Create account</button>`,
  });
}

function submitCreateHRManager() {
  const name = ((document.getElementById('hrm-name') || {}).value || '').trim();
  const email = ((document.getElementById('hrm-email') || {}).value || '').trim();
  const phone = ((document.getElementById('hrm-phone') || {}).value || '').trim();
  const preset = (document.getElementById('hrm-preset') || {}).value || 'HR Manager — Full';
  const invite = !!(document.getElementById('hrm-invite') || {}).checked;

  if (!name) { toast('Full name is required', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid work email', 'error'); return; }
  if (USERS.some((u) => u.email.toLowerCase() === email.toLowerCase())) { toast('That email already belongs to a user', 'error'); return; }

  USERS.push({
    id: 'RV-' + String(9000 + USERS.length),
    name,
    initials: initialsOf(name),
    email,
    phone: phone || '—',
    role: 'HR Manager',
    avatar: 'avatar-purple',
    gymId: null,
    gymIds: GYMS.map((g) => g.id),
    gymName: 'All gym accounts',
    branch: 'All gyms',
    branchCode: '—',
    status: invite ? 'Invited' : 'Active',
    lastLogin: null,
    createdAt: PLATFORM.today.slice(0, 10),
    preset,
    source: 'Super Admin',
  });

  logAudit({
    category: 'User', severity: 'info', action: 'Created HR Manager account',
    target: `${name} · all gym accounts`,
    detail: `Preset ${preset}. ${invite ? 'Activation invite emailed.' : 'Invite withheld.'} Scope covers all ${GYMS.length} gyms.`,
  });

  closeModal();
  renderAll();
  toast(`${name} now has HR access to all ${GYMS.length} gyms`, 'success');
}

function toggleManagerStatus(userId) {
  const user = USERS.find((u) => u.id === userId);
  if (!user) return;
  const suspending = user.status !== 'Suspended';
  openModal({
    title: suspending ? 'Suspend this HR manager?' : 'Restore this HR manager?',
    width: 'max-w-md',
    body: `<p class="text-xs text-charcoal-600 leading-relaxed"><strong class="font-semibold">${esc(user.name)}</strong> (${esc(user.email)}) ${suspending
      ? `will be signed out and lose HR access to all ${GYMS.length} gym accounts. Their data and permissions are preserved.`
      : `will regain HR access to all ${GYMS.length} gym accounts with the same preset.`}</p>
      <p class="text-[10px] text-charcoal-400 mt-2">Logged to the platform audit trail as an Access event.</p>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="confirmManagerStatus('${userId}')" class="btn btn-sm ${suspending ? 'btn-danger' : 'btn-success'}">${suspending ? 'Suspend account' : 'Restore account'}</button>`,
  });
}

function confirmManagerStatus(userId) {
  const user = USERS.find((u) => u.id === userId);
  if (!user) return;
  const suspending = user.status !== 'Suspended';
  user.status = suspending ? 'Suspended' : 'Active';
  logAudit({
    category: 'Access', severity: suspending ? 'warning' : 'info',
    action: suspending ? 'Suspended HR Manager account' : 'Restored HR Manager account',
    target: user.gymId ? `${user.name} · ${user.gymName}` : `${user.name} · platform`,
    detail: suspending ? 'Account suspended by a Super Admin. Active sessions revoked.' : 'Account restored with the previous permission preset.',
  });
  closeModal();
  renderAll();
  toast(`${user.name} ${suspending ? 'suspended' : 'restored'}`, suspending ? 'error' : 'success');
}
