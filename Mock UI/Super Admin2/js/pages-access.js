// ==================== PAGE: ROLES & PERMISSIONS ====================
// A role is a named bundle of permissions. System roles ship with the product;
// custom roles are created here and can be assigned to staff like any other role.
function renderRoles() {
  const roles = getRoles();
  const systemCount = roles.filter((r) => r.type === 'System').length;
  const customCount = roles.length - systemCount;
  const catalog = PERMISSION_CATALOG.length;

  const rows = roles.map((role) => {
    const members = role.name === 'Super Admin' ? 1 : roleMemberCount(role.name);
    const pct = Math.round((role.permissions.length / catalog) * 100);
    return `<tr>
      <td>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <p class="text-xs font-semibold text-charcoal-800 truncate leading-tight">${esc(role.name)}</p>
            ${role.type === 'Custom' ? '<span class="badge badge-purple">Custom</span>' : ''}
          </div>
          <p class="text-[10px] text-charcoal-500 leading-snug mt-0.5 max-w-[380px]">${esc(role.description)}</p>
        </div>
      </td>
      <td><span class="badge ${role.type === 'System' ? 'badge-gray' : 'badge-purple'}">${esc(role.type)}</span></td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-600">${esc(role.scope)}</td>
      <td class="w-36">
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-[11px] font-semibold text-charcoal-800">${role.permissions.length}</span>
          <span class="text-[9px] text-charcoal-400">of ${catalog}</span>
        </div>
        ${meterHtml(role.permissions.length, catalog, role.type === 'Custom' ? 'blue' : '')}
      </td>
      <td class="text-center whitespace-nowrap">
        <span class="text-xs font-semibold text-charcoal-700">${formatNumber(members)}</span>
      </td>
      <td class="text-right whitespace-nowrap">
        ${role.type === 'Custom'
          ? `<button onclick="openRoleEditor('${role.id}')" class="btn btn-sm btn-secondary">Edit</button>
             <button onclick="openRoleEditor(null,'${role.id}')" class="btn btn-sm btn-ghost text-charcoal-600">Duplicate</button>
             <button onclick="deleteRole('${role.id}')" class="btn btn-sm btn-ghost text-red-600 hover:bg-red-50">Delete</button>`
          : `<button onclick="openRoleEditor('${role.id}', null, true)" class="btn btn-sm btn-secondary">View</button>
             <button onclick="openRoleEditor(null,'${role.id}')" class="btn btn-sm btn-ghost text-charcoal-600">Duplicate</button>`}
      </td>
    </tr>`;
  }).join('');

  return `
  ${pageHeader(
    'Roles & permissions',
    `${roles.length} roles · ${systemCount} system · ${customCount} custom · ${catalog} assignable permissions`,
    `<button onclick="openRoleEditor()" class="btn btn-primary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      Create role
    </button>`
  )}

  <div class="card card-grow mb-3">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Roles</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">System roles are fixed by the product. Duplicate one to start a custom role, then adjust its permissions.</p>
      </div>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Role</th><th>Type</th><th>Scope</th><th>Permissions</th><th class="text-center">Members</th><th class="text-right">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="px-3 py-2 border-t border-charcoal-100">
      <p class="text-[10px] text-charcoal-400">Custom roles can be assigned to staff by an HR Manager inside their own gym. They never reach platform administration.</p>
    </div>
  </div>`;
}

function accessLauncherStrip() {
  const gym = getGym(state.accessGym || GYMS[0].id) || GYMS[0];
  const role = state.accessRole || 'HR Manager';
  const roleOptions = getRoles().map((r) => `<option value="${esc(r.name)}"${r.name === role ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
  const gymOptions = GYMS.map((g) => `<option value="${g.id}"${g.id === gym.id ? ' selected' : ''}>${esc(g.name)} — ${esc(g.location)}</option>`).join('');

  return `<div class="card">
    <div class="px-3 py-2.5">
      <div class="flex items-end gap-2 flex-wrap">
        <div class="flex-1 min-w-[190px]">
          <label class="form-label">Enter a gym workspace</label>
          <select class="form-select" onchange="state.accessGym=this.value;renderAll()">${gymOptions}</select>
        </div>
        <div class="min-w-[150px]">
          <label class="form-label">Act as</label>
          <select class="form-select" onchange="state.accessRole=this.value;renderAll()">${roleOptions}</select>
        </div>
        <button onclick="openWorkspace('${gym.id}','${esc(role)}')" class="btn btn-primary flex-shrink-0">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
          Open workspace
        </button>
        ${gymLogo(gym, 36)}
      </div>
      <p class="text-[10px] text-charcoal-500 leading-snug mt-1.5">Opens ${esc(gym.name)} — ${esc(gym.location)} in a new tab with ${esc(role)} visibility. Every action is attributed to you on the audit trail.</p>
    </div>
  </div>`;
}

// ==================== ROLE EDITOR ====================
function openRoleEditor(roleId, duplicateFromId, readOnly) {
  const base = roleId ? ROLES.find((r) => r.id === roleId) : duplicateFromId ? ROLES.find((r) => r.id === duplicateFromId) : null;
  const isEdit = !!roleId;
  const selected = base ? base.permissions.slice() : [];

  const groups = [];
  PERMISSION_CATALOG.forEach((p) => {
    let g = groups.find((x) => x.name === p.group);
    if (!g) { g = { name: p.group, items: [] }; groups.push(g); }
    g.items.push(p);
  });

  const groupHtml = groups.map((g, gi) => `<div class="border border-charcoal-200 rounded-lg mb-2 overflow-hidden">
      <div class="flex items-center gap-2 px-2.5 py-1.5 bg-charcoal-50 border-b border-charcoal-200">
        <p class="text-[10px] font-bold uppercase tracking-wider text-charcoal-500 flex-1">${esc(g.name)}</p>
        <span class="text-[9px] text-charcoal-400" id="role-grp-count-${gi}">0/${g.items.length}</span>
        ${readOnly ? '' : `<button type="button" onclick="roleToggleGroup(${gi},true)" class="text-[9px] font-semibold text-brand-700 hover:underline">All</button>
        <button type="button" onclick="roleToggleGroup(${gi},false)" class="text-[9px] font-semibold text-charcoal-500 hover:underline">None</button>`}
      </div>
      <div class="px-2.5 py-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1" data-group="${gi}">
        ${g.items.map((p) => `<label class="form-check">
          <input type="checkbox" value="${esc(p.key)}" data-group="${gi}" ${selected.includes(p.key) ? 'checked' : ''} ${readOnly ? 'disabled' : ''} onchange="roleUpdateCount()">
          <span class="text-[10px] leading-snug">${esc(p.label)}${p.platformOnly ? ' <span class="badge badge-purple">platform</span>' : ''}</span>
        </label>`).join('')}
      </div>
    </div>`).join('');

  openModal({
    title: readOnly ? `${base.name} role` : isEdit ? `Edit ${base.name}` : duplicateFromId ? `Duplicate ${base.name}` : 'Create role',
    subtitle: readOnly ? 'System role — fixed by the product' : 'Name the role, choose its scope, then tick the permissions it should grant',
    width: 'max-w-3xl',
    body: `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2.5">
        <div class="sm:col-span-2"><label class="form-label">Role name <span class="text-red-500">*</span></label>
          <input class="form-input" id="role-name" placeholder="e.g. Payroll Auditor" value="${esc(base && !readOnly ? (isEdit ? base.name : base.name + ' copy') : base ? base.name : '')}" ${readOnly ? 'disabled' : ''}></div>
        <div><label class="form-label">Scope</label>
          <select class="form-select" id="role-scope" ${readOnly ? 'disabled' : ''}>
            ${['All gym accounts', 'One or more gyms', 'One gym', 'One branch', 'One team', 'Own profile', 'Platform'].map((s) => `<option${base && base.scope === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select></div>
      </div>
      <div class="mb-2.5"><label class="form-label">Description</label>
        <input class="form-input" id="role-description" placeholder="What is this role responsible for?" value="${esc(base ? base.description : '')}" ${readOnly ? 'disabled' : ''}></div>

      <div class="flex items-center justify-between mb-1.5">
        <label class="form-label mb-0">Permissions</label>
        <span class="text-[10px] text-charcoal-500"><strong id="role-perm-count" class="text-charcoal-800 font-semibold">${selected.length}</strong> of ${PERMISSION_CATALOG.length} selected</span>
      </div>
      <div id="role-perm-list" class="max-h-[46vh] overflow-y-auto pr-1">${groupHtml}</div>`,
    footer: readOnly
      ? '<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>'
      : `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
         <button onclick="saveRole('${isEdit ? roleId : ''}','${duplicateFromId || ''}')" class="btn btn-sm btn-primary">${isEdit ? 'Save changes' : 'Create role'}</button>`,
  });

  roleUpdateCount();
}

function roleCheckedBoxes() {
  return Array.from(document.querySelectorAll('#role-perm-list input[type="checkbox"]'));
}

function roleToggleGroup(groupIndex, checked) {
  roleCheckedBoxes().filter((b) => b.dataset.group === String(groupIndex)).forEach((b) => { b.checked = checked; });
  roleUpdateCount();
}

function roleUpdateCount() {
  const boxes = roleCheckedBoxes();
  const checked = boxes.filter((b) => b.checked).length;
  const countEl = document.getElementById('role-perm-count');
  if (countEl) countEl.textContent = checked;

  const groups = new Set(boxes.map((b) => b.dataset.group));
  groups.forEach((gi) => {
    const inGroup = boxes.filter((b) => b.dataset.group === gi);
    const el = document.getElementById(`role-grp-count-${gi}`);
    if (el) el.textContent = `${inGroup.filter((b) => b.checked).length}/${inGroup.length}`;
  });
}

function saveRole(roleId, duplicateFromId) {
  const name = ((document.getElementById('role-name') || {}).value || '').trim();
  const scope = (document.getElementById('role-scope') || {}).value || 'One gym';
  const description = ((document.getElementById('role-description') || {}).value || '').trim();
  const permissions = roleCheckedBoxes().filter((b) => b.checked).map((b) => b.value);

  if (!name) { toast('Role name is required', 'error'); return; }
  if (!permissions.length) { toast('Select at least one permission', 'error'); return; }
  const clash = ROLES.find((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== roleId);
  if (clash) { toast('A role with that name already exists', 'error'); return; }

  if (roleId) {
    const role = ROLES.find((r) => r.id === roleId);
    const before = role.permissions.length;
    role.name = name;
    role.scope = scope;
    role.description = description || role.description;
    role.permissions = permissions;
    logAudit({
      category: 'Settings', severity: 'warning', action: 'Updated role permissions',
      target: `${role.name} · ${before} → ${permissions.length} permissions`,
      detail: `Role scope ${scope}. ${description || 'No description.'}`,
    });
    closeModal();
    renderAll();
    toast(`${role.name} updated`, 'success');
    return;
  }

  const role = {
    id: 'role-' + (ROLES.length + 1) + '-' + Date.now().toString().slice(-4),
    name,
    type: 'Custom',
    scope,
    description: description || `Custom role based on ${duplicateFromId ? (ROLES.find((r) => r.id === duplicateFromId) || {}).name : 'a blank template'}.`,
    permissions,
  };
  ROLES.push(role);
  logAudit({
    category: 'Settings', severity: 'info', action: 'Created role',
    target: `${role.name} · ${permissions.length} permissions`,
    detail: `Scope ${scope}.${duplicateFromId ? ' Duplicated from ' + (ROLES.find((r) => r.id === duplicateFromId) || {}).name + '.' : ''}`,
  });
  closeModal();
  renderAll();
  toast(`${role.name} created with ${permissions.length} permissions`, 'success');
}

function deleteRole(roleId) {
  const role = ROLES.find((r) => r.id === roleId);
  if (!role) return;
  const members = roleMemberCount(role.name);
  openModal({
    title: 'Delete this role?',
    width: 'max-w-md',
    body: `<p class="text-xs text-charcoal-600 leading-relaxed"><strong class="font-semibold">${esc(role.name)}</strong> will be removed from the permission catalog.${members ? ` <strong class="font-semibold text-red-600">${members} user(s)</strong> currently hold this role and would lose their access.` : ' No users hold this role.'}</p>
      <p class="text-[10px] text-charcoal-400 mt-2">Recorded as a Settings event on the audit trail.</p>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="confirmDeleteRole('${roleId}')" class="btn btn-sm btn-danger">Delete role</button>`,
  });
}

function confirmDeleteRole(roleId) {
  const idx = ROLES.findIndex((r) => r.id === roleId);
  if (idx < 0) return;
  const [role] = ROLES.splice(idx, 1);
  logAudit({
    category: 'Settings', severity: 'warning', action: 'Deleted role',
    target: role.name,
    detail: `Custom role removed from the catalog. ${role.permissions.length} permissions released.`,
  });
  closeModal();
  renderAll();
  toast(`${role.name} deleted`, 'error');
}
