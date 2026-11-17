// ==================== PAGE: HR MANAGER ACCOUNTS ====================
// Six accounts to watch, so this is a table with the fields that actually decide
// whether a gym is covered: owner, preset, status and last sign-in.
function renderHRManagers() {
  const managers = getHRManagers();
  const active = managers.filter((m) => m.status === 'Active').length;
  const suspended = managers.filter((m) => m.status === 'Suspended').length;
  const invited = managers.filter((m) => m.status === 'Invited').length;
  const gymsWithout = GYMS.filter((g) => !managers.some((m) => m.gymId === g.id));

  const rows = managers.map((m) => {
    const gym = getGym(m.gymId);
    return `<tr class="is-clickable" onclick="navigateTo('user-detail',{userId:'${m.id}'})">
      <td>
        <div class="flex items-center gap-2">
          ${avatarHtml(m, 28)}
          <div class="min-w-0">
            <p class="text-xs font-semibold text-charcoal-800 truncate leading-tight">${esc(m.name)}</p>
            <p class="text-[10px] text-charcoal-500 truncate leading-tight">${esc(m.email)}</p>
          </div>
        </div>
      </td>
      <td>
        <div class="flex items-center gap-1.5">
          ${gymLogo(gym, 36)}
          <div class="min-w-0">
            <button onclick="event.stopPropagation();navigateTo('gym-detail',{gymId:'${m.gymId}'})" class="text-[11px] font-medium text-charcoal-700 hover:text-brand-700 hover:underline truncate leading-tight block text-left">${esc(gym ? gym.name : '—')}</button>
            <p class="text-[10px] text-charcoal-400 truncate leading-tight">${esc(gym ? gym.location + ' · ' + gym.code : '')}</p>
          </div>
        </div>
      </td>
      <td><span class="badge badge-purple">${esc((m.preset || 'HR Manager').replace('HR Manager — ', ''))}</span></td>
      <td>${statusBadge(m.status)}</td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-500">${m.lastLogin ? relativeTime(m.lastLogin) : 'Never'}</td>
      <td class="text-right whitespace-nowrap">
        <button onclick="event.stopPropagation();openWorkspace('${m.gymId}','HR Manager')" class="btn btn-sm btn-primary">Enter</button>
        <button onclick="event.stopPropagation();openResetPassword('${m.id}')" class="btn btn-sm btn-ghost text-charcoal-600">Reset</button>
        <button onclick="event.stopPropagation();toggleManagerStatus('${m.id}')" class="btn btn-sm btn-ghost ${m.status === 'Suspended' ? 'text-brand-700' : 'text-red-600 hover:bg-red-50'}">${m.status === 'Suspended' ? 'Restore' : 'Suspend'}</button>
      </td>
    </tr>`;
  }).join('');

  return `
  ${pageHeader(
    'HR manager accounts',
    `${managers.length} accounts · ${active} active${suspended ? ` · ${suspended} suspended` : ''}${invited ? ` · ${invited} awaiting invite` : ''}`,
    `<button onclick="openCreateHRManager()" class="btn btn-primary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
      Create HR manager account
    </button>`
  )}

  <div class="card card-grow mb-3">
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Manager</th>
          <th>Gym account</th>
          <th>Preset</th>
          <th>Status</th>
          <th>Last sign-in</th>
          <th class="text-right">Actions</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="6">${emptyState('No HR manager accounts yet', 'Create one when you provision a gym.')}</td></tr>`}</tbody>
      </table>
    </div>
    <div class="px-3 py-2 border-t border-charcoal-100 flex items-center justify-between gap-2 flex-wrap">
      <p class="text-[10px] text-charcoal-500">${managers.length} accounts · one owner per gym account</p>
      <p class="text-[10px] ${gymsWithout.length ? 'text-amber-600 font-semibold' : 'text-charcoal-400'}">
        ${gymsWithout.length ? `${gymsWithout.length} gym(s) without an owner: ${gymsWithout.map((g) => g.name + ' — ' + g.location).join(', ')}` : 'Every gym account has an owner'}
      </p>
    </div>
  </div>

  ${accessLauncherStrip()}`;
}

// ==================== CREATE HR MANAGER ====================
function openCreateHRManager(preselectGymId) {
  const gymOptions = GYMS.map((g) => `<option value="${g.id}"${(preselectGymId || state.activeGymId) === g.id ? ' selected' : ''}>${esc(g.name)} — ${esc(g.location)}</option>`).join('');
  openModal({
    title: 'Create HR manager account',
    subtitle: 'The account owner for one gym — the only role you can provision below Super Admin',
    width: 'max-w-lg',
    body: `<form id="hrm-form" class="space-y-2.5" onsubmit="return false">
      <div><label class="form-label">Gym account <span class="text-red-500">*</span></label>
        <select class="form-select" id="hrm-gym">${gymOptions}</select></div>
      <div><label class="form-label">Full name <span class="text-red-500">*</span></label>
        <input class="form-input" id="hrm-name" placeholder="e.g. Hoda Kamel"></div>
      <div><label class="form-label">Work email <span class="text-red-500">*</span></label>
        <input class="form-input" id="hrm-email" type="email" placeholder="name@gym.com"></div>
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
      <p class="text-[10px] text-charcoal-400">The account is written to the audit trail as a User event and counts against the gym's seat limit.</p>
    </form>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="submitCreateHRManager('${preselectGymId || ''}')" class="btn btn-sm btn-primary">Create account</button>`,
  });
}

function submitCreateHRManager(preselectGymId) {
  const gymId = (document.getElementById('hrm-gym') || {}).value || preselectGymId;
  const name = ((document.getElementById('hrm-name') || {}).value || '').trim();
  const email = ((document.getElementById('hrm-email') || {}).value || '').trim();
  const phone = ((document.getElementById('hrm-phone') || {}).value || '').trim();
  const preset = (document.getElementById('hrm-preset') || {}).value || 'HR Manager — Full';
  const invite = !!(document.getElementById('hrm-invite') || {}).checked;
  const gym = getGym(gymId);

  if (!gym) { toast('Select a gym account', 'error'); return; }
  if (!name) { toast('Full name is required', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid work email', 'error'); return; }
  if (USERS.some((u) => u.email.toLowerCase() === email.toLowerCase())) { toast('That email already belongs to a user', 'error'); return; }
  if (gym.seatLimit && gym.userCounts.total >= gym.seatLimit) {
    toast(`${gym.name} has no seats left — raise the seat limit first`, 'error');
    return;
  }

  const user = {
    id: 'RV-' + String(400 + USERS.length).padStart(5, '0'),
    name,
    initials: initialsOf(name),
    email,
    phone: phone || '—',
    role: 'HR Manager',
    avatar: 'avatar-purple',
    gymId: gym.id,
    gymName: `${gym.name} — ${gym.location}`,
    status: invite ? 'Invited' : 'Active',
    lastLogin: null,
    createdAt: PLATFORM.today.slice(0, 10),
    preset,
    source: 'Super Admin',
  };
  USERS.unshift(user);
  gym.userCounts.hrManager += 1;
  gym.userCounts.total += 1;

  logAudit({
    gymId: gym.id, category: 'User', severity: 'info', action: 'Created HR Manager account',
    target: `${name} · ${gymLabel(gym)}`,
    detail: `Preset ${preset}. ${invite ? 'Activation invite emailed.' : 'Invite withheld.'}`,
  });

  closeModal();
  renderAll();
  toast(`HR manager account created for ${gym.name}`, 'success');
}

function toggleManagerStatus(userId) {
  const user = USERS.find((u) => u.id === userId);
  if (!user) return;
  const suspending = user.status !== 'Suspended';
  openModal({
    title: suspending ? 'Suspend this HR manager?' : 'Restore this HR manager?',
    width: 'max-w-md',
    body: `<p class="text-xs text-charcoal-600 leading-relaxed"><strong class="font-semibold">${esc(user.name)}</strong> (${esc(user.email)}) ${suspending
      ? 'will be signed out and blocked from the gym workspace. Their data and permissions are preserved.'
      : 'will regain access to the gym workspace with the same preset.'}</p>
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
    gymId: user.gymId, category: 'Access', severity: suspending ? 'warning' : 'info',
    action: suspending ? 'Suspended HR Manager account' : 'Restored HR Manager account',
    target: `${user.name} · ${user.gymName}`,
    detail: suspending ? 'Account suspended by a Super Admin. Active sessions revoked.' : 'Account restored with the previous permission preset.',
  });
  closeModal();
  renderAll();
  toast(`${user.name} ${suspending ? 'suspended' : 'restored'}`, suspending ? 'error' : 'success');
}
