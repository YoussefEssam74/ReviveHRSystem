// ==================== EMPLOYEES DIRECTORY ====================
let _empFilter = { gym: 'all', status: 'all', search: '' };
let _empSelectedId = null;

function renderEmployees(page='directory') {
  const showAll = DEMO.showAll;
  const canCreate = showAll || hasPermission('employees.create');
  const canBulk = showAll || hasPermission('employees.bulk_import');
  const canTransfer = showAll || hasPermission('employees.transfer');
  const canCompensate = showAll || hasPermission('employees.compensation.manage');
  const canOffboard = showAll || hasPermission('employees.offboard');
  const canRole = showAll || hasPermission('employees.role.assign');
  const canLeaveBal = showAll || hasPermission('employees.leave_balance.manage');

  let list = MOCK.employees.filter(e => e.id !== MOCK.currentUser.id);
  if (_empFilter.gym !== 'all') list = list.filter(e => e.gym === _empFilter.gym);
  if (_empFilter.status !== 'all') list = list.filter(e => e.status === _empFilter.status);
  if (_empFilter.search) list = list.filter(e => e.name.toLowerCase().includes(_empFilter.search.toLowerCase()));

  const gyms = MOCK.gymList;

  if (page === 'detail' && _empSelectedId) {
    return renderEmployeeProfile(_empSelectedId);
  }
  if (page === 'offboarding') {
    return renderOffboarding();
  }

  const viewTabs = `<div class="flex items-center gap-1 bg-charcoal-100 rounded-lg p-0.5">
    <button onclick="state.empView='directory';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${state.empView!=='offboarding'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">Directory</button>
    ${canOffboard?`<button onclick="state.empView='offboarding';renderAll()" class="px-3 py-1.5 rounded-md text-[10px] font-medium ${state.empView==='offboarding'?'bg-white shadow-sm text-charcoal-900':'text-charcoal-500'}">Offboarding & Separations</button>`:''}
  </div>`;

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div>
          <h1 class="text-xl font-bold text-charcoal-900">Employees</h1>
          <p class="text-xs text-charcoal-500 mt-0.5">${state.empView==='offboarding'?`${MOCK.separations.filter(s=>s.status!=='Completed').length} active separations · ${MOCK.separations.length} total`:`${list.length} of ${MOCK.employees.length} employees`}</p>
        </div>
        ${viewTabs}
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${canBulk?`<button onclick="openBulkImport()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Bulk Import</button>`:''}
        ${canCreate&&state.empView!=='offboarding'?`<button onclick="openAddEmployee()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Add Employee</button>`:''}
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl border border-charcoal-200 px-3 py-2 flex items-center gap-3 flex-wrap">
      <div class="relative">
        <svg class="w-4 h-4 text-charcoal-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" oninput="_empFilter.search=this.value;renderAll()" class="form-input" placeholder="Search employees..." style="padding:0.375rem 0.625rem 0.375rem 2rem;font-size:0.8125rem;width:200px">
      </div>
      <select onchange="_empFilter.gym=this.value;renderAll()" class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem">
        <option value="all">All Gyms</option>
        ${gyms.map(g=>`<option value="${g.branch}" ${_empFilter.gym===g.branch?'selected':''}>${g.name} — ${g.branch}</option>`).join('')}
      </select>
      <select onchange="_empFilter.status=this.value;renderAll()" class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem">
        <option value="all">All Statuses</option>
        <option value="Active">Active</option>
        <option value="On Leave">On Leave</option>
        <option value="Notice Period">Notice Period</option>
        <option value="Suspended">Suspended</option>
      </select>
    </div>

    <!-- Stats strip -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-brand-600">${MOCK.employees.filter(e=>e.status==='Active').length}</p><p class="text-[10px] text-charcoal-500">Active</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-yellow-600">${MOCK.employees.filter(e=>e.status==='On Leave').length}</p><p class="text-[10px] text-charcoal-500">On Leave</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-orange-600">${MOCK.employees.filter(e=>e.status==='Notice Period').length}</p><p class="text-[10px] text-charcoal-500">Notice Period</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-red-600">${MOCK.employees.filter(e=>e.status==='Suspended').length}</p><p class="text-[10px] text-charcoal-500">Suspended</p></div>
    </div>

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Position</th><th>Level</th><th>Gym</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(e=>`<tr class="cursor-pointer hover:bg-charcoal-50/50" onclick="openEmployeeProfile('${e.id}')">
        <td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${e.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${e.name}</p><p class="text-[10px] text-charcoal-500">${e.id}</p></div></div></td>
        <td class="text-xs">${e.position}</td>
        <td class="text-xs">${e.level}</td>
        <td class="text-xs">${e.gym}</td>
        <td>${statusBadge(e.status)}</td>
        <td><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td>
      </tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${list.map(e=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openEmployeeProfile('${e.id}')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${e.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${e.name}</p><p class="text-[10px] text-charcoal-500">${e.position} · ${e.gym}</p></div>
        </div>
        ${statusBadge(e.status)}
      </div>
    </div>`).join('')}</div>

    <!-- Permission hint for lifecycle actions -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-[11px] text-charcoal-500 leading-relaxed">
      <span class="font-semibold text-charcoal-700">Lifecycle actions:</span>
      ${canTransfer?'· Transfer Gym':'<span class="text-charcoal-300">· Transfer Gym (hidden — not granted)</span>'}
      ${canCompensate?'· Manage Compensation':'<span class="text-charcoal-300">· Manage Compensation (hidden — not granted)</span>'}
      ${canOffboard?'· Offboard':'<span class="text-charcoal-300">· Offboard (hidden — not granted)</span>'}
      ${canRole?'· Change System Role':'<span class="text-charcoal-300">· Change System Role (hidden — not granted)</span>'}
      ${canLeaveBal?'· Edit Leave Balance':'<span class="text-charcoal-300">· Leave Balance (view-only — not granted)</span>'}
    </div>
  </div>`;
}

// ==================== OFFBOARDING & SEPARATIONS ====================
function renderOffboarding() {
  const showAll = DEMO.showAll;
  const canOffboard = showAll || hasPermission('employees.offboard');
  const active = MOCK.separations;
  const inProgress = active.filter(s => s.status !== 'Completed').length;
  const completed = MOCK.separations.filter(s => s.status === 'Completed').length;
  const exitSteps = 5;

  const sepBadge = s => s.status === 'Completed' ? 'badge-success' : s.status === 'Notice Period' ? 'badge-blue' : s.status === 'Terminated' ? 'badge-red' : 'badge-yellow';

  return `<div class="space-y-3">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-red-500"><p class="text-lg font-bold text-red-600">${MOCK.separations.filter(s=>s.status==='Notice Period').length}</p><p class="text-[10px] text-charcoal-500">Notice Period</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-yellow-600">${MOCK.separations.filter(s=>s.status==='In Progress').length}</p><p class="text-[10px] text-charcoal-500">Checklist In Progress</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-orange-600">${MOCK.separations.filter(s=>s.status==='In Review').length}</p><p class="text-[10px] text-charcoal-500">In Review / Litigation</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-charcoal-900">${completed}</p><p class="text-[10px] text-charcoal-500">Completed YTD</p></div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Gym</th><th>Last Day</th><th>Reason</th><th>Status</th><th>Exit Checklist</th><th></th></tr></thead>
      <tbody>${active.map(s=>{
        const done = s.checklist.filter(c=>c[1]).length;
        return `<tr>
          <td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-semibold">${s.employee.split(' ').map(w=>w[0]).join('')}</div><div><p class="text-xs font-medium text-charcoal-900">${s.employee}</p><p class="text-[10px] text-charcoal-500">${s.position}</p></div></div></td>
          <td class="text-xs">${s.gym}</td>
          <td class="text-xs font-semibold text-charcoal-800">${s.lastDay}</td>
          <td class="text-xs text-charcoal-600 max-w-[180px] truncate">${s.reason}</td>
          <td>${sepBadge(s)}</td>
          <td><div class="flex items-center gap-2"><div class="w-20 h-1.5 bg-charcoal-100 rounded-full overflow-hidden"><div class="h-full ${s.status==='Completed'?'bg-green-500':s.status==='Notice Period'?'bg-brand-500':'bg-yellow-500'} rounded-full" style="width:${s.progress}%"></div></div><span class="text-[9px] text-charcoal-500">${done}/${s.checklist.length}</span></div></td>
          <td><button onclick="openSeparation('${s.id}')" class="btn btn-sm btn-secondary text-[10px]">Manage</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>
    </div>

    <div class="space-y-1.5 lg:hidden">${active.map(s=>{
      const done = s.checklist.filter(c=>c[1]).length;
      return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <div class="flex items-center justify-between"><div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-semibold">${s.employee.split(' ').map(w=>w[0]).join('')}</div><div><p class="text-xs font-medium text-charcoal-900">${s.employee}</p><p class="text-[10px] text-charcoal-500">${s.position} · ${s.gym}</p></div></div>${sepBadge(s)}</div>
        <div class="flex justify-between text-[10px] text-charcoal-500 mt-2"><span>Last day ${s.lastDay}</span><span>${done}/${s.checklist.length} steps</span></div>
        <div class="w-full h-1.5 bg-charcoal-100 rounded-full mt-1.5 overflow-hidden"><div class="h-full ${s.status==='Completed'?'bg-green-500':'bg-yellow-500'} rounded-full" style="width:${s.progress}%"></div></div>
        <div class="flex justify-end mt-2"><button onclick="openSeparation('${s.id}')" class="btn btn-sm btn-secondary text-[10px]">Manage Checklist</button></div>
      </div>`;
    }).join('')}</div>

    <div class="bg-white rounded-xl border border-brand-200 border-l-4 border-l-brand-500 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div><p class="text-xs font-semibold text-charcoal-900">EXIT PROCESS</p><p class="text-[10px] text-charcoal-500">Standard ${exitSteps}-step offboarding: Exit interview → Handover → Uniform/asset return → Access revocation → Final settlement.</p></div>
      ${canOffboard?`<button onclick="showToast('Initiate offboarding — simulated')" class="btn btn-sm btn-primary">+ Initiate Offboarding</button>`:''}
    </div>
  </div>`;
}

function openSeparation(id) {
  const s = MOCK.separations.find(x=>x.id===id); if(!s) return;
  const canOffboard = DEMO.showAll || hasPermission('employees.offboard');
  const items = (label, done) => `<label class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5 cursor-pointer"><span class="text-xs text-charcoal-800">${label}</span><input type="checkbox" ${done?'checked':''} ${canOffboard?'':'disabled'} class="rounded border-charcoal-300 text-brand-500 w-4 h-4" onchange="this.closest('label').classList.toggle('opacity-50')"></label>`;
  openModal(`Offboarding — ${s.employee}`, `<div class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-3 grid grid-cols-2 gap-y-1.5 text-[11px]">
      <div><p class="text-[9px] uppercase text-charcoal-400">Position</p><p class="font-medium text-charcoal-800">${s.position}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">Gym</p><p class="font-medium text-charcoal-800">${s.gym}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">Last Day</p><p class="font-medium text-charcoal-800">${s.lastDay}</p></div>
      <div><p class="text-[9px] uppercase text-charcoal-400">Reason</p><p class="font-medium text-charcoal-800">${s.reason}</p></div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">${s.checklist.map(c=>items(c[0],c[1])).join('')}</div>
    ${canOffboard?`<div class="pt-1 flex justify-end"><button onclick="showToast('Final settlement calculated & exit completed');closeModal();" class="btn btn-sm btn-danger-outline">Finalize Separation</button></div>`:`<p class="text-[10px] text-charcoal-400">You cannot modify this checklist — requires <code>employees.offboard</code>. Use the toggles only if your role grants it.</p>`}
  </div>`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}

function openEmployeeProfile(id) {
  _empSelectedId = id;
  navigateTo('employees');
  state.empView = 'detail';
  renderAll();
}

// ==================== EMPLOYEE PROFILE ====================
function renderEmployeeProfile(id) {
  const e = MOCK.employees.find(x=>x.id===id);
  if(!e) return renderEmployees();
  const tab = state.empTab || 'personal';
  const showAll = DEMO.showAll;
  const canTransfer = showAll || hasPermission('employees.transfer');
  const canPosition = showAll || hasPermission('employees.position.change');
  const canCompensate = showAll || hasPermission('employees.compensation.manage');
  const canOffboard = showAll || hasPermission('employees.offboard');
  const canRole = showAll || hasPermission('employees.role.assign');
  const canContract = showAll || hasPermission('employees.contract.manage');
  const canDocsManage = showAll || hasPermission('employees.documents.manage');
  const canLeaveManage = showAll || hasPermission('employees.leave_balance.manage');

  const tabs = [
    {id:'personal',label:'Personal Info'}, {id:'documents',label:'Documents'},
    {id:'employment',label:'Employment History'}, {id:'attendance',label:'Attendance Summary'},
    {id:'shift',label:'Current Shift'}, {id:'requests',label:'Requests History'},
    {id:'leave',label:'Leave Balance'}, {id:'eval',label:'Evaluations History'}, {id:'payroll',label:'Payroll Snapshot'},
  ];

  let lifecycleActions = '';
  if (canTransfer) lifecycleActions += `<button onclick="showToast('Transfer Gym — simulated')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Transfer Gym</button>`;
  if (canPosition) lifecycleActions += `<button onclick="showToast('Change Position/Level — simulated')" class="btn btn-sm btn-secondary">Change Position</button>`;
  if (canRole) lifecycleActions += `<button onclick="openChangeRole('${e.id}')" class="btn btn-sm btn-secondary">Change System Role</button>`;
  if (canCompensate) lifecycleActions += `<button onclick="showToast('Manage Compensation — simulated')" class="btn btn-sm btn-secondary">Manage Compensation</button>`;
  if (canContract) lifecycleActions += `<button onclick="showToast('Manage Contract — simulated')" class="btn btn-sm btn-secondary">Manage Contract</button>`;
  if (canOffboard) lifecycleActions += `<button onclick="showToast('Offboard (Exit Form) — simulated')" class="btn btn-sm btn-danger-outline">Offboard</button>`;

  const tabContent = {
    personal: `<div class="grid grid-cols-2 gap-2">
      ${[['Gym', e.gym],['Position', e.position],['Level', e.level],['Hire Date', formatDate(e.hireDate)],['Email', e.email],['Phone', e.phone],['Employee ID', e.id],['Base Salary', 'EGP ' + e.salary.toLocaleString()]].map(([k,v])=>`<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">${k.toUpperCase()}</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${v}</p></div>`).join('')}
    </div>`,
    documents: `<div class="space-y-2">
      ${[
        {name:'Employment Contract',cat:'Employment',status:'Valid'},
        {name:'National ID (Front & Back)',cat:'Identification',status:'Valid'},
        {name:'Personal Photo',cat:'Identification',status:'Valid'},
        {name:'First Aid Certification',cat:'Certification',status:'Expiring Soon'},
        {name:'Medical Fitness Certificate',cat:'Medical',status:'Valid'},
        {name:'Degree Certificate',cat:'Education',status:'Valid'},
      ].map(d=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
        <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center"><span class="material-icons text-sm">description</span></div><div><p class="text-xs font-medium text-charcoal-900">${d.name}</p><p class="text-[10px] text-charcoal-500">${d.cat}</p></div></div>
        ${statusBadge(d.status)}
      </div>`).join('')}
      ${canDocsManage?`<button onclick="showToast('Upload document — simulated')" class="btn btn-sm btn-secondary w-full"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0L8 8m4 4V4"/></svg>Upload Document</button>`:''}
    </div>`,
    employment: `<div class="space-y-2">
      ${[
        {type:'Position Changed',from:'Junior Trainer',to:'Trainer',date:'01 Aug 2026',detail:'Promoted based on Q2 2026 evaluation.'},
        {type:'Gym Transfer',from:'Heliopolis',to:'Nasr City',date:'01 May 2026',detail:'Requested transfer approved by HR.'},
        {type:'Joined Revive',from:null,to:null,date:'12 Jan 2026',detail:'Initial hire as Junior Trainer.'},
      ].map(h=>`<div class="flex items-start gap-3 bg-charcoal-50 rounded-lg p-2.5">
        <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${h.type.split(' ').map(w=>w[0]).join('')}</div>
        <div><p class="text-xs font-medium text-charcoal-900">${h.type}</p><p class="text-[10px] text-charcoal-500">${h.date}${h.from?` · ${h.from} → ${h.to}`:''}</p><p class="text-[10px] text-charcoal-600 mt-0.5">${h.detail}</p></div>
      </div>`).join('')}
    </div>`,
    attendance: `<div class="bg-charcoal-50 rounded-lg p-3 text-center mb-2"><p class="text-2xl font-bold text-brand-600">96.4%</p><p class="text-[10px] text-charcoal-500">Attendance Rate</p></div>
    <div class="grid grid-cols-3 gap-2 mb-2">
      ${[['Present','22','text-green-600'],['Late','2','text-yellow-600'],['Absent','1','text-red-600']].map(([k,v,c])=>`<div class="bg-white rounded-lg border border-charcoal-200 p-2 text-center"><p class="text-lg font-bold ${c}">${v}</p><p class="text-[10px] text-charcoal-500">${k}</p></div>`).join('')}
    </div>
    <div class="space-y-1.5">${[['Aug 26','08:02','—','On Time'],['Aug 25','16:08','00:01','Late'],['Aug 24','—','—','Off'],['Aug 23','07:58','16:03','On Time']].map(([d,ci,co,st])=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2">
      <p class="text-xs text-charcoal-700">${d}</p><p class="text-[10px] text-charcoal-500">${ci} → ${co}</p>${statusBadge(st)}
    </div>`).join('')}</div>`,
    shift: `<div class="bg-charcoal-50 rounded-lg p-3 text-center"><p class="text-xl font-bold text-charcoal-900">Morning · 08:00–16:00</p><p class="text-[10px] text-charcoal-500 mt-1">Current Week · Sep 7 – 13</p></div>
    <div class="grid grid-cols-7 gap-1 mt-3">${['M','T','W','T','F','S','S'].map((d,i)=>`<div class="rounded-lg border p-2 text-center ${i===1?'border-brand-500 bg-brand-50':''}"><p class="text-[9px] text-charcoal-400 font-semibold">${d}</p><p class="text-[10px] ${i===2?'text-charcoal-300':'text-brand-700 font-medium'} mt-1">${i===2?'OFF':i===1?'08:00':'08:00'}</p></div>`).join('')}</div>`,
    requests: `<div class="space-y-1.5">${MOCK.requests.filter(r=>r.employee===e.name).map(r=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
      <div><p class="text-xs font-medium text-charcoal-900">${r.type}</p><p class="text-[10px] text-charcoal-500">${r.requestedDate} · Submitted ${formatDate(r.submittedDate)}</p></div>${statusBadge(r.status)}
    </div>`).join('')||`<div class="bg-charcoal-50 rounded-lg p-4 text-center"><p class="text-xs text-charcoal-500">No requests found</p></div>`}</div>`,
    leave: `${canLeaveManage?`<div class="flex justify-end mb-2"><button onclick="showToast('Edit leave balance — simulated')" class="btn btn-sm btn-primary">Edit Balance</button></div>`:''}
    <div class="border${canLeaveManage?'':'-2 border-dashed border-charcoal-200 rounded-xl'} space-y-2 ${canLeaveManage?'':'p-3'}">
      ${[['Annual Leave','10','of 21 days'],['Sick Leave','3','of 10 days'],['Unpaid Leave','0','of 5 days']].map(([k,v,t])=>`<div class="bg-charcoal-50 rounded-lg p-2.5"><div class="flex items-center justify-between"><p class="text-xs font-medium text-charcoal-900">${k}</p><p class="text-xs font-bold text-brand-600">${v} <span class="text-charcoal-400 font-normal">${t}</span></p></div><div class="w-full h-1.5 bg-charcoal-200 rounded-full mt-1.5 overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:${Math.min(100,parseInt(v)*10)}%"></div></div></div>`).join('')}
    </div>
    ${!canLeaveManage?`<p class="text-[10px] text-charcoal-400 mt-2 text-center">Leave balance is <strong>view-only</strong> — you do not have <code>employees.leave_balance.manage</code>.</p>`:''}`,
    eval: `<div class="space-y-1.5">${[['Q2 2026','4.2','Exceeds'],['Q1 2026','3.8','Meets']].map(([p,s,r])=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
      <div><p class="text-xs font-medium text-charcoal-900">${p}</p><p class="text-[10px] text-charcoal-500">Score: ${s}/5</p></div>${statusBadge(r)}
    </div>`).join('')}</div>`,
    payroll: `<div class="space-y-1.5">${[['July 2026','12400'],['June 2026','12700'],['May 2026','12200']].map(([p,n])=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
      <p class="text-xs font-medium text-charcoal-900">${p}</p><p class="text-xs font-bold text-charcoal-900">EGP ${n.toLocaleString()}</p>
    </div>`).join('')}</div>`,
  }[tab];

  return `<div class="space-y-3">
    <div class="flex items-center gap-2">
      <button onclick="state.empView='directory';_empSelectedId=null;renderAll()" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>Employees</button>
      <span class="text-charcoal-300">/</span>
      <p class="text-xs text-charcoal-500">${e.name}</p>
    </div>

    <!-- Profile Header -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-semibold">${e.initials}</div>
          <div>
            <p class="text-base font-bold text-charcoal-900">${e.name} ${statusBadge(e.status)}</p>
            <p class="text-xs text-charcoal-500">${e.position} · ${e.level} · ${e.gym} · ${formatDate(e.hireDate)}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${lifecycleActions?`<div class="flex flex-wrap gap-1.5">${lifecycleActions}</div>`:`<p class="text-[10px] text-charcoal-400">No lifecycle actions granted for your role.</p>`}
        </div>
      </div>
      <div class="flex mt-3 border-b border-charcoal-100 overflow-x-auto">
        ${tabs.map(t=>`<button onclick="state.empTab='${t.id}';renderAll()" class="tab-btn ${state.empTab===t.id?'active':''}">${t.label}</button>`).join('')}
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 p-4">${tabContent}</div>
  </div>`;
}

function openChangeRole(id) {
  const e = MOCK.employees.find(x=>x.id===id);
  if(!e) return;
  const cbs = (v,l)=>`<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked class="rounded" onchange="this.closest('label').classList.toggle('opacity-40')"><span class="text-xs text-charcoal-700">${l}</span></label>`;
  openModal(`Change System Role — ${e.name}`, `<div class="space-y-3">
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      <p class="text-xs text-yellow-800">This grants or revokes system roles (e.g. Branch Manager). This is a high-trust governance action typically reserved for HR Manager.</p>
    </div>
    <div><label class="form-label">System Role</label><select class="form-select"><option value="">None (Employee)</option><option>Branch Manager</option><option>Team Leader</option></select></div>
    <div><p class="form-label">Permissions to toggle</p>
      <div class="grid grid-cols-1 gap-1.5">
        ${cbs('e','Can view team attendance')}
        ${cbs('e','Can approve team requests')}
        ${cbs('e','Can manage team schedule')}
        ${cbs('e','Can evaluate team members')}
      </div>
    </div>
  </div>`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="showToast(\'Role updated for '+e.name+'\');closeModal();" class="btn btn-sm btn-primary">Save Changes</button>' });
}

function openAddEmployee() {
  openModal('Add Employee', `<form onsubmit="event.preventDefault();showToast(\'Employee added\');closeModal();" class="space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">First Name</label><input class="form-input" required></div>
      <div><label class="form-label">Last Name</label><input class="form-input" required></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Email</label><input type="email" class="form-input" required></div>
      <div><label class="form-label">Phone</label><input class="form-input" required></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Position</label><select class="form-select"><option>Trainer</option><option>Receptionist</option><option>Cleaner</option><option>Maintenance</option></select></div>
      <div><label class="form-label">Level</label><select class="form-select"><option>Junior</option><option>Mid</option><option>Senior</option></select></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Gym</label><select class="form-select"><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select></div>
      <div><label class="form-label">Start Date</label><input type="date" class="form-input" required></div>
    </div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Employee</button></div>
  </form>`, { wide:true });
}
