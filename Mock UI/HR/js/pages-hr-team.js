// ==================== HR TEAM MANAGEMENT ====================
let _hrtWizStep = 1;
let _hrtWizData = {};
let _hrtSelectedTemplate = null;
let _hrtCustomPerms = new Set();
let _hrtTab = 'team';

const HR_PERM_GROUPS = [
  { key: 'Employees', perms: [
    { key: 'employees.view', label: 'View directory & profiles' },
    { key: 'employees.create', label: 'Create employee accounts' },
    { key: 'employees.edit', label: 'Edit employee info' },
    { key: 'employees.bulk_import', label: 'Bulk import (CSV)' },
    { key: 'employees.transfer', label: 'Transfer between gyms' },
    { key: 'employees.position.change', label: 'Change position/level' },
    { key: 'employees.role.assign', label: 'Assign Branch Manager role' },
    { key: 'employees.status.change', label: 'Change employment status' },
    { key: 'employees.compensation.manage', label: 'Manage compensation/salary' },
    { key: 'employees.contract.manage', label: 'Manage contracts' },
    { key: 'employees.offboard', label: 'Offboard employees' },
    { key: 'employees.documents.view', label: 'View documents' },
    { key: 'employees.documents.manage', label: 'Upload & manage documents' },
    { key: 'employees.leave_balance.manage', label: 'Edit leave balance' },
  ]},
  { key: 'Attendance & Schedule', perms: [
    { key: 'attendance.view', label: 'View attendance records' },
    { key: 'attendance.edit', label: 'Manually correct attendance' },
    { key: 'schedule.view', label: 'View shift schedules' },
    { key: 'schedule.manage', label: 'Build & publish schedules' },
  ]},
  { key: 'Requests', perms: [
    { key: 'requests.view', label: 'View employee requests' },
    { key: 'requests.approve', label: 'Final approve / reject requests' },
  ]},
  { key: 'Recruitment', perms: [
    { key: 'recruitment.view', label: 'View vacancies & candidates' },
    { key: 'recruitment.candidates.manage', label: 'Manage candidates through pipeline' },
    { key: 'recruitment.vacancies.manage', label: 'Create & close vacancies' },
    { key: 'recruitment.vacancy_request.approve', label: 'Approve vacancy requests from BM' },
    { key: 'recruitment.hire.approve', label: 'Convert candidate to employee (Hire)' },
  ]},
  { key: 'Payroll', perms: [
    { key: 'payroll.view', label: 'View payroll & payslips' },
    { key: 'payroll.edit', label: 'Edit deduction lines' },
    { key: 'payroll.approve', label: 'Approve & lock payroll run' },
  ]},
  { key: 'Evaluations', perms: [
    { key: 'evaluations.view', label: 'View forms & evaluation history' },
    { key: 'evaluations.manage', label: 'Build forms & run evaluations' },
  ]},
  { key: 'Administration', perms: [
    { key: 'positions.view', label: 'View positions catalog' },
    { key: 'positions.manage', label: 'Add/retire positions' },
    { key: 'announcements.view', label: 'View notifications & announcements' },
    { key: 'announcements.manage', label: 'Compose & send announcements' },
    { key: 'audit.view', label: 'View activity / audit log' },
    { key: 'reports.view', label: 'View reports & analytics' },
    { key: 'team.view', label: 'View HR team list' },
    { key: 'team.manage', label: 'Manage HR team & permissions' },
  ]},
];

const NAV_PAGE_MAP = {
  'employees.view': 'Employees',
  'recruitment.view': 'Recruitment & Hiring',
  'attendance.view': 'Attendance',
  'schedule.view': 'Shifts & Schedule',
  'requests.view': 'Requests',
  'payroll.view': 'Payroll',
  'evaluations.view': 'Evaluations',
  'reports.view': 'Reports & Analytics',
  'positions.view': 'Positions & Levels',
  'announcements.view': 'Notifications',
  'audit.view': 'Audit Log',
  'team.view': 'HR Team Mgmt',
};

function getVisiblePages(permSet) {
  const pages = ['Dashboard'];
  for (const [perm, page] of Object.entries(NAV_PAGE_MAP)) {
    const has = permSet instanceof Set ? permSet.has(perm) : permSet.includes(perm);
    if (has && !pages.includes(page)) pages.push(page);
  }
  pages.push('My Access');
  return pages;
}

function renderHRTeam() {
  const showAll = DEMO.showAll;
  const canManage = showAll || hasPermission('team.manage');
  if (!canManage && !(showAll || hasPermission('team.view'))) {
    return '<div class="space-y-3"><h1 class="text-base font-bold text-charcoal-900">HR Team Management</h1><div class="bg-white rounded-xl border border-charcoal-200 p-6 text-center"><p class="text-xs text-charcoal-500">You do not have permission to view the HR team (<code>team.view</code>).</p></div></div>';
  }
  const tabs = [{ id:'team',label:'HR Team' },{ id:'templates',label:'Role Templates' }];
  let body = _hrtTab==='team' ? renderHRTeamList(canManage) : renderRoleTemplates(canManage);
  return '<div class="space-y-2.5">' +
    '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
      '<div><h1 class="text-base font-bold text-charcoal-900">HR Team Management</h1>' +
      '<p class="text-xs text-charcoal-500 mt-0.5">' + MOCK.hrTeamMembers.length + ' HR staff \u00b7 ' + MOCK.currentUser.gyms.length + ' gyms under management</p></div>' +
      (canManage ? '<button onclick="openHRAccountWizard()" class="btn btn-sm btn-primary"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Create HR Account</button>' : '') +
    '</div>' +
    '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">' +
      '<div class="bg-white rounded-xl border border-charcoal-200 p-2.5 text-center border-l-4 border-l-brand-500"><p class="text-base font-bold text-brand-600">' + MOCK.hrTeamMembers.filter(m=>m.status==='Active').length + '</p><p class="text-[10px] text-charcoal-500">Active HR Staff</p></div>' +
      '<div class="bg-white rounded-xl border border-charcoal-200 p-2.5 text-center"><p class="text-base font-bold text-charcoal-900">' + MOCK.roleTemplates.length + '</p><p class="text-[10px] text-charcoal-500">Role Templates</p></div>' +
      '<div class="bg-white rounded-xl border border-charcoal-200 p-2.5 text-center"><p class="text-base font-bold text-blue-600">' + MOCK.currentUser.gyms.length + '</p><p class="text-[10px] text-charcoal-500">Gyms Under You</p></div>' +
      '<div class="bg-white rounded-xl border border-charcoal-200 p-2.5 text-center"><p class="text-base font-bold text-red-600">' + MOCK.hrTeamMembers.filter(m=>m.status==='Suspended').length + '</p><p class="text-[10px] text-charcoal-500">Suspended</p></div>' +
    '</div>' +
    '<div class="flex border-b border-charcoal-100">' + tabs.map(t=>'<button onclick="_hrtTab=\''+t.id+'\';renderAll()" class="tab-btn '+(_hrtTab===t.id?'active':'')+'">'+t.label+'</button>').join('') + '</div>' +
    body +
    (!canManage ? '<p class="text-[10px] text-charcoal-400 text-center">Creating &amp; editing HR accounts requires <code>team.manage</code> (HR Manager).</p>' : '') +
  '</div>';
}

function renderHRTeamList(canManage) {
  const colorMap = { 'HR (Default)':'badge-brand','HR-FullAccess':'badge-blue','HR-AttendanceOnly':'badge-yellow','HR-NoPayroll':'badge-purple','Custom':'badge-gray' };
  const rows = MOCK.hrTeamMembers.map(m => {
    const bc = colorMap[m.preset] || 'badge-gray';
    return '<tr class="cursor-pointer" onclick="openHRMemberDetail(\''+m.id+'\')">'+
      '<td><div class="flex items-center gap-2.5">'+
        '<div class="w-8 h-8 rounded-full '+(m.status==='Active'?'bg-brand-100 text-brand-700':'bg-charcoal-100 text-charcoal-400')+' flex items-center justify-center text-[10px] font-semibold">'+m.initials+'</div>'+
        '<div><p class="text-xs font-medium text-charcoal-900">'+m.name+'</p><p class="text-[9px] text-charcoal-400">'+m.email+'</p></div>'+
      '</div></td>'+
      '<td><span class="badge '+bc+' text-[9px]">'+m.preset+'</span></td>'+
      '<td class="text-xs">'+m.gyms.join(', ')+'</td>'+
      '<td><div class="flex items-center gap-1.5"><div class="w-16 h-1.5 bg-charcoal-100 rounded-full overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:'+Math.round((m.permissions.length/42)*100)+'%"></div></div><span class="text-[9px] text-charcoal-500">'+m.permissions.length+' perms</span></div></td>'+
      '<td>'+(m.status==='Active'?'<span class="badge badge-green text-[9px]">Active</span>':'<span class="badge badge-red text-[9px]">Suspended</span>')+'</td>'+
      '<td class="text-[10px] text-charcoal-500">'+m.lastLogin+'</td>'+
      '<td onclick="event.stopPropagation()"><div class="flex gap-1">'+
        (canManage?'<button onclick="openHRMemberEdit(\''+m.id+'\')" class="btn btn-sm btn-ghost" title="Edit Permissions"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>':'')+
        (canManage?'<button onclick="toggleHRMemberStatus(\''+m.id+'\')" class="btn btn-sm btn-ghost '+(m.status==='Active'?'text-red-600':'text-brand-600')+'" title="'+(m.status==='Active'?'Suspend':'Reactivate')+'">'+(m.status==='Active'?'Suspend':'Reactivate')+'</button>':'')+
      '</div></td>'+
    '</tr>';
  }).join('');

  const mobileCards = MOCK.hrTeamMembers.map(m=>'<div class="bg-white rounded-xl border border-charcoal-200 p-3" onclick="openHRMemberDetail(\''+m.id+'\')">'+
    '<div class="flex items-center justify-between">'+
      '<div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-full '+(m.status==='Active'?'bg-brand-100 text-brand-700':'bg-charcoal-100 text-charcoal-400')+' flex items-center justify-center text-[10px] font-semibold">'+m.initials+'</div>'+
      '<div><p class="text-xs font-medium text-charcoal-900">'+m.name+'</p><p class="text-[9px] text-charcoal-400">'+m.gyms.join(' \u00b7 ')+'</p></div></div>'+
      (m.status==='Active'?'<span class="badge badge-green text-[9px]">Active</span>':'<span class="badge badge-red text-[9px]">Suspended</span>')+
    '</div>'+
    '<div class="flex items-center justify-between mt-2 text-[10px] text-charcoal-500"><span><code>'+m.preset+'</code></span><span>'+m.permissions.length+' permissions</span></div>'+
    (canManage?'<div class="flex gap-1.5 mt-2"><button onclick="event.stopPropagation();openHRMemberEdit(\''+m.id+'\')" class="btn btn-sm btn-secondary flex-1">Edit Permissions</button><button onclick="event.stopPropagation();toggleHRMemberStatus(\''+m.id+'\')" class="btn btn-sm btn-ghost flex-1 '+(m.status==='Active'?'text-red-600':'text-brand-600')+'">'+(m.status==='Active'?'Suspend':'Reactivate')+'</button></div>':'')+
  '</div>').join('');

  return '<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">'+
    '<table class="data-table"><thead class="sticky top-0 z-10 bg-[#f9f9ff]"><tr><th>HR Staff</th><th>Role Template</th><th>Gyms</th><th>Permissions</th><th>Status</th><th>Last Login</th><th></th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table>'+
  '</div>'+
  '<div class="space-y-1.5 lg:hidden">'+mobileCards+'</div>';
}

function renderRoleTemplates(canManage) {
  const colorDot = { brand:'bg-brand-500', blue:'bg-blue-500', yellow:'bg-yellow-500', purple:'bg-purple-500' };
  const colorBadge = { brand:'badge-brand', blue:'badge-blue', yellow:'badge-yellow', purple:'badge-purple' };
  const cards = MOCK.roleTemplates.map(t=>'<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">'+
    '<div class="px-4 py-3 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">'+
      '<div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full '+(colorDot[t.color]||'bg-gray-400')+'"></span><p class="text-sm font-semibold text-charcoal-900">'+t.name+'</p></div>'+
      '<span class="badge '+(colorBadge[t.color]||'badge-gray')+' text-[9px]">'+t.permissions.length+' perms</span>'+
    '</div>'+
    '<div class="p-3 space-y-2">'+
      '<p class="text-[10px] text-charcoal-500">'+t.description+'</p>'+
      '<div class="flex flex-wrap gap-1">'+t.permissions.slice(0,6).map(p=>'<span class="badge badge-gray text-[9px]">'+p.split('.').slice(-1)[0]+'</span>').join('')+(t.permissions.length>6?'<span class="badge badge-gray text-[9px]">+' +(t.permissions.length-6)+' more</span>':'')+
      '</div><div class="flex gap-1.5 mt-1">'+
        '<button onclick="openTemplateDetail(\''+t.id+'\')" class="btn btn-sm btn-ghost flex-1">View All</button>'+
        (canManage?'<button onclick="openEditTemplateModal(\''+t.id+'\')" class="btn btn-sm btn-secondary flex-1">Edit</button>':'')+
      '</div></div></div>').join('');
  return '<div class="flex flex-col flex-1 min-h-0 gap-3">'+
    '<div class="flex items-center justify-between">'+
      '<p class="text-xs text-charcoal-500">Reusable permission bundles \u2014 apply when creating a new HR account.</p>'+
      (canManage?'<button onclick="openNewTemplateModal()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Template</button>':'')+
    '</div>'+
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">'+cards+'</div></div>';
}

// ==================== WIZARD ====================
function openHRAccountWizard() {
  _hrtWizStep=1; _hrtWizData={name:'',email:'',phone:'',gyms:[]}; _hrtCustomPerms=new Set(); _hrtSelectedTemplate=null;
  renderHRWizard();
}
function renderHRWizard() {
  const labels=['Personal Info','Gym Access','Permissions'];
  const bar = '<div class="flex items-center mb-4">'+labels.map((s,i)=>{const n=i+1,done=_hrtWizStep>n,cur=_hrtWizStep===n;return '<div class="flex items-center flex-1"><div class="flex items-center gap-1.5"><span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold '+(done?'bg-brand-500 text-white':cur?'bg-brand-100 text-brand-700 border border-brand-500':'bg-charcoal-100 text-charcoal-400')+'">'+(done?'&#10003;':n)+'</span><span class="text-[10px] font-medium '+(cur?'text-brand-700':done?'text-charcoal-700':'text-charcoal-400')+' hidden sm:block">'+s+'</span></div>'+(i<2?'<div class="flex-1 h-px mx-2 '+(done?'bg-brand-400':'bg-charcoal-100')+'"></div>':'')+'</div>';}).join('')+'</div>';
  let content='';
  if (_hrtWizStep===1) {
    content=bar+'<div class="space-y-3">'+
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">'+
        '<div><label class="form-label">Full Name *</label><input id="wiz-name" class="form-input" placeholder="e.g. Mona Hassan" value="'+_hrtWizData.name+'" required></div>'+
        '<div><label class="form-label">Email *</label><input id="wiz-email" type="email" class="form-input" placeholder="mona@revive.com" value="'+_hrtWizData.email+'" required></div>'+
      '</div>'+
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">'+
        '<div><label class="form-label">Phone</label><input id="wiz-phone" class="form-input" placeholder="+20 1XX XXX XXXX" value="'+_hrtWizData.phone+'"></div>'+
        '<div><label class="form-label">Start Date</label><input id="wiz-start" type="date" class="form-input" value="2026-10-01"></div>'+
      '</div>'+
      '<div class="bg-brand-50 border border-brand-100 rounded-lg p-2.5 text-[10px] text-brand-800">Login credentials will be auto-generated and emailed to the address above.</div>'+
      '<div class="flex justify-end gap-2 pt-1"><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="hrWizStep1Next()" class="btn btn-sm btn-primary">Next: Gym Access \u2192</button></div>'+
    '</div>';
  } else if (_hrtWizStep===2) {
    const gyms=MOCK.currentUser.gyms;
    content=bar+'<div class="space-y-3">'+
      '<p class="text-xs text-charcoal-600">Select which gyms this HR user will have access to. They will only see data from assigned gyms.</p>'+
      '<div class="space-y-2">'+gyms.map(g=>'<label class="flex items-center gap-3 p-3 border border-charcoal-200 rounded-xl cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors '+(_hrtWizData.gyms.includes(g.branch)?'border-brand-400 bg-brand-50':'')+'"><input type="checkbox" class="rounded w-4 h-4 text-brand-600" '+(_hrtWizData.gyms.includes(g.branch)?'checked':'')+' onchange="hrWizToggleGym(\''+g.branch+'\',this.checked)"><div><p class="text-xs font-medium text-charcoal-900">'+g.name+'</p><p class="text-[10px] text-charcoal-500">'+g.branch+'</p></div></label>').join('')+'</div>'+
      '<div class="flex justify-between gap-2 pt-1"><button onclick="_hrtWizStep=1;renderHRWizard()" class="btn btn-sm btn-secondary">\u2190 Back</button><button onclick="hrWizStep2Next()" class="btn btn-sm btn-primary">Next: Permissions \u2192</button></div>'+
    '</div>';
  } else {
    content=bar+buildPermStepHtml(true);
  }
  openModal(_hrtWizStep>1?'Create HR Account \u2014 '+_hrtWizData.name:'Create HR Account', content, {full:true});
}

function buildPermStepHtml(isWizard) {
  const perms=_hrtCustomPerms;
  const visiblePages=getVisiblePages(perms);
  const preview='<div class="bg-charcoal-900 rounded-xl p-3 text-white mb-3">'+
    '<p class="text-[9px] uppercase tracking-wider text-charcoal-400 mb-2">LIVE PREVIEW \u2014 Sidebar pages this user will see</p>'+
    '<div class="flex flex-wrap gap-1.5">'+visiblePages.map(p=>'<span class="px-2 py-0.5 bg-white/10 rounded-md text-[10px]">'+p+'</span>').join('')+'</div>'+
    '<p class="text-[9px] text-charcoal-400 mt-2">'+perms.size+' permissions \u00b7 '+visiblePages.length+' pages visible</p></div>';

  const tplBar='<div class="mb-3"><p class="text-[10px] text-charcoal-500 mb-1.5 font-medium">Start from a template:</p>'+
    '<div class="flex flex-wrap gap-1.5">'+
      MOCK.roleTemplates.map(t=>'<button onclick="applyHRTemplate(\''+t.id+'\')" class="px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors '+(_hrtSelectedTemplate===t.id?'border-brand-500 bg-brand-50 text-brand-700':'border-charcoal-200 text-charcoal-600 hover:border-charcoal-400')+'">'+t.name+' ('+t.permissions.length+')</button>').join('')+
      '<button onclick="applyHRTemplate(\'none\')" class="px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors '+(_hrtSelectedTemplate==='none'?'border-brand-500 bg-brand-50 text-brand-700':'border-charcoal-200 text-charcoal-600 hover:border-charcoal-400')+'">Blank</button>'+
    '</div></div>';

  const groups=HR_PERM_GROUPS.map(g=>'<div class="bg-white border border-charcoal-200 rounded-xl overflow-hidden mb-2">'+
    '<div class="px-3 py-2 bg-charcoal-50/60 border-b border-charcoal-100 flex items-center justify-between">'+
      '<p class="text-[10px] font-semibold text-charcoal-700 uppercase tracking-wide">'+g.key+'</p>'+
      '<div class="flex items-center gap-1.5"><span class="text-[9px] text-charcoal-400">'+g.perms.filter(p=>perms.has(p.key)).length+'/'+g.perms.length+'</span>'+
        '<button onclick="togglePermGroup(\''+g.key+'\',true)" class="text-[9px] text-brand-600 font-semibold hover:underline">All</button>'+
        '<button onclick="togglePermGroup(\''+g.key+'\',false)" class="text-[9px] text-charcoal-400 hover:underline">None</button>'+
      '</div></div>'+
    '<div class="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">'+
      g.perms.map(p=>'<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-charcoal-50 cursor-pointer">'+
        '<input type="checkbox" class="rounded w-3.5 h-3.5 text-brand-600" '+(perms.has(p.key)?'checked':'')+' onchange="toggleSinglePerm(\''+p.key+'\',this.checked)">'+
        '<span class="text-[11px] text-charcoal-700 leading-snug">'+p.label+'</span>'+
        '<code class="text-[8px] text-charcoal-400 ml-auto truncate max-w-[100px] hidden lg:block">'+p.key.split('.').slice(-1)[0]+'</code>'+
      '</label>').join('')+
    '</div></div>').join('');

  const footer='<div class="flex justify-between items-center gap-2 pt-2 border-t border-charcoal-100 mt-2">'+
    '<div class="flex items-center gap-2">'+
      (isWizard?'<button onclick="_hrtWizStep=2;renderHRWizard()" class="btn btn-sm btn-secondary">\u2190 Back</button>':'')+
      '<button onclick="openSaveTemplateFromWizard()" class="btn btn-sm btn-ghost text-brand-600"><svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>Save as Template</button>'+
    '</div>'+
    (isWizard?'<button onclick="finalizeHRAccount()" class="btn btn-sm btn-primary">Create Account \u2713</button>':'')+
  '</div>';

  return preview+tplBar+'<div class="space-y-0 max-h-[38vh] overflow-y-auto pr-0.5">'+groups+'</div>'+footer;
}

function hrWizStep1Next() {
  const name=document.getElementById('wiz-name')?.value.trim();
  const email=document.getElementById('wiz-email')?.value.trim();
  if (!name||!email){showToast('Name and email are required','error');return;}
  _hrtWizData.name=name; _hrtWizData.email=email; _hrtWizData.phone=document.getElementById('wiz-phone')?.value.trim()||'';
  _hrtWizStep=2; renderHRWizard();
}

function hrWizToggleGym(branch, checked) {
  if (checked){if(!_hrtWizData.gyms.includes(branch))_hrtWizData.gyms.push(branch);}
  else{_hrtWizData.gyms=_hrtWizData.gyms.filter(g=>g!==branch);}
  renderHRWizard();
}

function hrWizStep2Next() {
  if (!_hrtWizData.gyms.length){showToast('Select at least one gym','error');return;}
  if (!_hrtSelectedTemplate){_hrtSelectedTemplate=MOCK.roleTemplates[0].id;_hrtCustomPerms=new Set(MOCK.roleTemplates[0].permissions);}
  _hrtWizStep=3; renderHRWizard();
}

function applyHRTemplate(templateId) {
  _hrtSelectedTemplate=templateId;
  if (templateId==='none'){_hrtCustomPerms=new Set();}
  else{const t=MOCK.roleTemplates.find(x=>x.id===templateId);if(t)_hrtCustomPerms=new Set(t.permissions);}
  renderHRWizard();
}

function toggleSinglePerm(key,checked) {
  if(checked)_hrtCustomPerms.add(key);else _hrtCustomPerms.delete(key);
  _hrtSelectedTemplate=null;
  openModal('Create HR Account \u2014 '+_hrtWizData.name, buildStepBar()+buildPermStepHtml(true), {full:true});
}
function buildStepBar(){
  const labels=['Personal Info','Gym Access','Permissions'];
  return '<div class="flex items-center mb-4">'+labels.map((s,i)=>{const n=i+1,done=_hrtWizStep>n,cur=_hrtWizStep===n;return '<div class="flex items-center flex-1"><div class="flex items-center gap-1.5"><span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold '+(done?'bg-brand-500 text-white':cur?'bg-brand-100 text-brand-700 border border-brand-500':'bg-charcoal-100 text-charcoal-400')+'">'+(done?'&#10003;':n)+'</span><span class="text-[10px] font-medium '+(cur?'text-brand-700':done?'text-charcoal-700':'text-charcoal-400')+' hidden sm:block">'+s+'</span></div>'+(i<2?'<div class="flex-1 h-px mx-2 '+(done?'bg-brand-400':'bg-charcoal-100')+'"></div>':'')+'</div>';}).join('')+'</div>';
}

function togglePermGroup(groupKey, enable) {
  const g=HR_PERM_GROUPS.find(x=>x.key===groupKey);if(!g)return;
  g.perms.forEach(p=>{if(enable)_hrtCustomPerms.add(p.key);else _hrtCustomPerms.delete(p.key);});
  _hrtSelectedTemplate=null;
  openModal('Create HR Account \u2014 '+_hrtWizData.name, buildStepBar()+buildPermStepHtml(true), {full:true});
}

function openSaveTemplateFromWizard() {
  openModal('Save as Role Template','<div class="space-y-3"><p class="text-xs text-charcoal-600">Save the current permission set as a reusable template.</p><div><label class="form-label">Template Name *</label><input id="tpl-name" class="form-input" placeholder="e.g. HR-NoPayroll" required></div><div><label class="form-label">Description</label><textarea id="tpl-desc" class="form-input" rows="2" placeholder="Brief purpose..."></textarea></div><div class="flex justify-end gap-2"><button onclick="closeModal();renderHRWizard()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="confirmSaveTemplate()" class="btn btn-sm btn-primary">Save Template</button></div></div>');
}

function confirmSaveTemplate() {
  const name=document.getElementById('tpl-name')?.value.trim();
  if(!name){showToast('Template name required','error');return;}
  const desc=document.getElementById('tpl-desc')?.value.trim();
  const colors=['brand','blue','yellow','purple'];
  const newTpl={id:'rt-'+Date.now(),name,description:desc||name,color:colors[MOCK.roleTemplates.length%colors.length],permissions:[..._hrtCustomPerms]};
  MOCK.roleTemplates.push(newTpl);
  _hrtSelectedTemplate=newTpl.id;
  showToast('Template "'+name+'" saved \u2014 '+newTpl.permissions.length+' permissions');
  closeModal(); renderHRWizard();
}

function finalizeHRAccount() {
  if(!_hrtWizData.name){showToast('Go back and fill in personal info','error');return;}
  if(!_hrtWizData.gyms.length){showToast('Go back and select at least one gym','error');return;}
  const perms=[..._hrtCustomPerms];
  const initials=_hrtWizData.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const tpl=MOCK.roleTemplates.find(t=>t.id===_hrtSelectedTemplate);
  const newMember={id:'HRM-'+Date.now(),name:_hrtWizData.name,email:_hrtWizData.email,phone:_hrtWizData.phone,initials,role:'HR',preset:tpl?tpl.name:'Custom',gyms:_hrtWizData.gyms,status:'Active',lastLogin:'\u2014',hireDate:new Date().toISOString().slice(0,10),permissions:perms};
  MOCK.hrTeamMembers.push(newMember);
  MOCK.auditLog.unshift({id:'al-'+Date.now(),action:'HR Account Created',user:MOCK.currentUser.fullName,target:_hrtWizData.name,detail:'New HR account \u2014 '+perms.length+' permissions \u2014 '+_hrtWizData.gyms.join(', '),timestamp:'2026-09-09 '+new Date().toLocaleTimeString(),gym:_hrtWizData.gyms.join('/')});
  closeModal();
  showToast('HR account created for '+_hrtWizData.name+' \u2014 credentials sent to '+_hrtWizData.email);
  _hrtTab='team'; renderAll();
}

// ==================== VIEW / EDIT MEMBER ====================
function openHRMemberDetail(id) {
  const m=MOCK.hrTeamMembers.find(x=>x.id===id);if(!m)return;
  const visiblePages=getVisiblePages(m.permissions);
  const groupRows=HR_PERM_GROUPS.map(g=>'<div class="mb-2"><p class="text-[9px] uppercase tracking-wide text-charcoal-500 font-semibold mb-1">'+g.key+'</p><div class="flex flex-wrap gap-1">'+g.perms.map(p=>'<span class="badge '+(m.permissions.includes(p.key)?'badge-brand':'badge-gray')+' text-[9px]">'+(m.permissions.includes(p.key)?'\u2713 ':'')+p.label+'</span>').join('')+'</div></div>').join('');
  openModal(m.name+' \u2014 HR Account',
    '<div class="space-y-3">'+
      '<div class="flex items-center gap-3"><div class="w-12 h-12 rounded-full '+(m.status==='Active'?'bg-brand-100 text-brand-700':'bg-charcoal-100 text-charcoal-400')+' flex items-center justify-center text-sm font-bold">'+m.initials+'</div>'+
      '<div><p class="text-sm font-semibold text-charcoal-900">'+m.name+'</p><p class="text-xs text-charcoal-500">'+m.email+' \u00b7 '+m.phone+'</p></div></div>'+
      '<div class="grid grid-cols-2 gap-2 bg-charcoal-50 rounded-xl p-2.5 text-[11px]">'+
        '<div><p class="text-[9px] uppercase text-charcoal-400">Template</p><p class="font-medium">'+m.preset+'</p></div>'+
        '<div><p class="text-[9px] uppercase text-charcoal-400">Status</p><p class="font-medium '+(m.status==='Active'?'text-brand-700':'text-red-600')+'">'+m.status+'</p></div>'+
        '<div><p class="text-[9px] uppercase text-charcoal-400">Gyms</p><p class="font-medium">'+m.gyms.join(', ')+'</p></div>'+
        '<div><p class="text-[9px] uppercase text-charcoal-400">Last Login</p><p class="font-medium">'+m.lastLogin+'</p></div>'+
      '</div>'+
      '<div class="bg-charcoal-900 rounded-xl p-3 text-white"><p class="text-[9px] uppercase tracking-wider text-charcoal-400 mb-2">Sidebar pages visible</p><div class="flex flex-wrap gap-1.5">'+visiblePages.map(p=>'<span class="px-2 py-0.5 bg-white/10 rounded-md text-[10px]">'+p+'</span>').join('')+'</div><p class="text-[9px] text-charcoal-400 mt-1.5">'+m.permissions.length+' permissions</p></div>'+
      '<div class="max-h-[30vh] overflow-y-auto space-y-1">'+groupRows+'</div>'+
    '</div>',
    {full:true,footer:'<button onclick="closeModal();openHRMemberEdit(\''+m.id+'\')" class="btn btn-sm btn-primary">Edit Permissions</button><button onclick="closeModal();toggleHRMemberStatus(\''+m.id+'\')" class="btn btn-sm btn-'+(m.status==='Active'?'danger':'secondary')+'">'+(m.status==='Active'?'Suspend':'Reactivate')+'</button><button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>'});
}

function openHRMemberEdit(id) {
  const m=MOCK.hrTeamMembers.find(x=>x.id===id);if(!m)return;
  _hrtCustomPerms=new Set(m.permissions);
  _hrtSelectedTemplate=MOCK.roleTemplates.find(t=>t.name===m.preset)?.id||null;
  _hrtWizData={name:m.name,email:m.email,phone:m.phone,gyms:m.gyms};
  const perms=_hrtCustomPerms;
  const visiblePages=getVisiblePages(perms);
  const preview='<div class="bg-charcoal-900 rounded-xl p-3 text-white mb-3"><p class="text-[9px] uppercase tracking-wider text-charcoal-400 mb-2">LIVE PREVIEW</p><div class="flex flex-wrap gap-1.5">'+visiblePages.map(p=>'<span class="px-2 py-0.5 bg-white/10 rounded-md text-[10px]">'+p+'</span>').join('')+'</div><p class="text-[9px] text-charcoal-400 mt-1.5">'+perms.size+' permissions</p></div>';
  const tplBar='<div class="mb-3"><p class="text-[10px] text-charcoal-500 mb-1.5 font-medium">Apply a template:</p><div class="flex flex-wrap gap-1.5">'+MOCK.roleTemplates.map(t=>'<button onclick="applyEditTpl(\''+m.id+'\',\''+t.id+'\')" class="px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors '+(_hrtSelectedTemplate===t.id?'border-brand-500 bg-brand-50 text-brand-700':'border-charcoal-200 text-charcoal-600 hover:border-charcoal-400')+'">'+t.name+'</button>').join('')+'</div></div>';
  const groups=HR_PERM_GROUPS.map(g=>'<div class="bg-white border border-charcoal-200 rounded-xl overflow-hidden mb-2"><div class="px-3 py-2 bg-charcoal-50/60 border-b border-charcoal-100 flex items-center justify-between"><p class="text-[10px] font-semibold text-charcoal-700 uppercase">'+g.key+'</p><div class="flex gap-1.5"><button onclick="editMbrToggleGroup(\''+m.id+'\',\''+g.key+'\',true)" class="text-[9px] text-brand-600 hover:underline">All</button><button onclick="editMbrToggleGroup(\''+m.id+'\',\''+g.key+'\',false)" class="text-[9px] text-charcoal-400 hover:underline">None</button></div></div><div class="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">'+g.perms.map(p=>'<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-charcoal-50 cursor-pointer"><input type="checkbox" class="rounded w-3.5 h-3.5 text-brand-600" '+(perms.has(p.key)?'checked':'')+' onchange="editMbrTogglePerm(\''+m.id+'\',\''+p.key+'\',this.checked)"><span class="text-[11px] text-charcoal-700">'+p.label+'</span></label>').join('')+'</div></div>').join('');
  openModal('Edit Permissions \u2014 '+m.name, preview+tplBar+'<div class="max-h-[42vh] overflow-y-auto pr-0.5">'+groups+'</div>', {full:true, footer:'<button onclick="saveHRMemberEdit(\''+m.id+'\')" class="btn btn-sm btn-primary">Save Permissions</button><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>'});
}

function applyEditTpl(memberId, templateId) {
  _hrtSelectedTemplate=templateId;
  const t=MOCK.roleTemplates.find(x=>x.id===templateId);if(t)_hrtCustomPerms=new Set(t.permissions);
  openHRMemberEdit(memberId);
}
function editMbrTogglePerm(memberId, key, checked) {
  if(checked)_hrtCustomPerms.add(key);else _hrtCustomPerms.delete(key);
  _hrtSelectedTemplate=null; openHRMemberEdit(memberId);
}
function editMbrToggleGroup(memberId, groupKey, enable) {
  const g=HR_PERM_GROUPS.find(x=>x.key===groupKey);if(!g)return;
  g.perms.forEach(p=>{if(enable)_hrtCustomPerms.add(p.key);else _hrtCustomPerms.delete(p.key);});
  _hrtSelectedTemplate=null; openHRMemberEdit(memberId);
}
function saveHRMemberEdit(id) {
  const m=MOCK.hrTeamMembers.find(x=>x.id===id);if(!m)return;
  m.permissions=[..._hrtCustomPerms];
  const tpl=MOCK.roleTemplates.find(t=>t.id===_hrtSelectedTemplate);
  if(tpl)m.preset=tpl.name;else m.preset='Custom';
  MOCK.auditLog.unshift({id:'al-'+Date.now(),action:'HR Permissions Updated',user:MOCK.currentUser.fullName,target:m.name,detail:'Permissions updated \u2014 '+m.permissions.length+' permissions',timestamp:'2026-09-09',gym:m.gyms.join('/')});
  showToast('Permissions saved for '+m.name+' \u2014 '+m.permissions.length+' permissions');
  closeModal(); renderAll();
}

// ==================== STATUS TOGGLE ====================
function toggleHRMemberStatus(id) {
  const m=MOCK.hrTeamMembers.find(x=>x.id===id);if(!m)return;
  const newStatus=m.status==='Active'?'Suspended':'Active';
  openModal((newStatus==='Suspended'?'Suspend':'Reactivate')+' \u2014 '+m.name,
    '<div class="space-y-3">'+
      '<div class="bg-'+(newStatus==='Suspended'?'red':'brand')+'-50 border border-'+(newStatus==='Suspended'?'red':'brand')+'-100 rounded-lg p-3 text-[11px] text-'+(newStatus==='Suspended'?'red':'brand')+'-800">'+(newStatus==='Suspended'?'Suspending this account will immediately revoke <strong>'+m.name+'\'s</strong> login access.':'Reactivating <strong>'+m.name+'\'s</strong> account will restore full login access.')+'</div>'+
      '<div><label class="form-label">Reason *</label><textarea id="status-reason" class="form-input" rows="2" placeholder="Required..."></textarea></div>'+
    '</div>',
    {footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="confirmToggleStatus(\''+id+'\',\''+newStatus+'\')" class="btn btn-sm btn-'+(newStatus==='Suspended'?'danger':'primary')+'">'+(newStatus==='Suspended'?'Suspend':'Reactivate')+'</button>'});
}

function confirmToggleStatus(id, newStatus) {
  const reason=document.getElementById('status-reason')?.value.trim();
  if(!reason){showToast('Reason is required','error');return;}
  const m=MOCK.hrTeamMembers.find(x=>x.id===id);if(!m)return;
  m.status=newStatus;
  MOCK.auditLog.unshift({id:'al-'+Date.now(),action:'HR Account '+newStatus,user:MOCK.currentUser.fullName,target:m.name,detail:reason,timestamp:'2026-09-09',gym:m.gyms.join('/')});
  showToast(m.name+' '+(newStatus==='Suspended'?'suspended':'reactivated'),newStatus==='Suspended'?'error':'success');
  closeModal(); renderAll();
}

// ==================== TEMPLATE MANAGEMENT ====================
function openTemplateDetail(id) {
  const t=MOCK.roleTemplates.find(x=>x.id===id);if(!t)return;
  const groupHtml=HR_PERM_GROUPS.map(g=>'<div class="mb-2"><p class="text-[9px] uppercase tracking-wide text-charcoal-500 font-semibold mb-1">'+g.key+'</p><div class="flex flex-wrap gap-1">'+g.perms.map(p=>'<span class="badge '+(t.permissions.includes(p.key)?'badge-brand':'badge-gray')+' text-[9px]">'+(t.permissions.includes(p.key)?'\u2713 ':'')+p.label+'</span>').join('')+'</div></div>').join('');
  openModal(t.name+' \u2014 Template Details','<div class="space-y-3"><p class="text-xs text-charcoal-600">'+t.description+'</p><p class="text-[10px] text-charcoal-500">'+t.permissions.length+' permissions total</p><div class="max-h-[50vh] overflow-y-auto pr-1">'+groupHtml+'</div></div>',{full:true,footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>'});
}

function openNewTemplateModal() {
  _hrtCustomPerms=new Set(); _hrtSelectedTemplate=null;
  openModal('New Role Template',renderNewTplBody(),{full:true,footer:'<button onclick="saveNewTemplate()" class="btn btn-sm btn-primary">Save Template</button><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>'});
}
function renderNewTplBody() {
  const perms=_hrtCustomPerms;
  const groups=HR_PERM_GROUPS.map(g=>'<div class="bg-white border border-charcoal-200 rounded-xl overflow-hidden mb-2"><div class="px-3 py-2 bg-charcoal-50/60 border-b border-charcoal-100 flex items-center justify-between"><p class="text-[10px] font-semibold text-charcoal-700 uppercase">'+g.key+'</p><div class="flex gap-1.5"><button onclick="newTplGroup(\''+g.key+'\',true)" class="text-[9px] text-brand-600 hover:underline">All</button><button onclick="newTplGroup(\''+g.key+'\',false)" class="text-[9px] text-charcoal-400 hover:underline">None</button></div></div><div class="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">'+g.perms.map(p=>'<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-charcoal-50 cursor-pointer"><input type="checkbox" class="rounded w-3.5 h-3.5 text-brand-600" '+(perms.has(p.key)?'checked':'')+' onchange="newTplPerm(\''+p.key+'\',this.checked)"><span class="text-[11px] text-charcoal-700">'+p.label+'</span></label>').join('')+'</div></div>').join('');
  return '<div class="space-y-3"><div class="grid grid-cols-2 gap-3"><div><label class="form-label">Template Name *</label><input id="new-tpl-name" class="form-input" placeholder="e.g. HR-PartTime" required></div><div><label class="form-label">Description</label><input id="new-tpl-desc" class="form-input" placeholder="Brief purpose..."></div></div><div class="max-h-[45vh] overflow-y-auto pr-0.5">'+groups+'</div></div>';
}
function newTplPerm(key,checked){if(checked)_hrtCustomPerms.add(key);else _hrtCustomPerms.delete(key);openModal('New Role Template',renderNewTplBody(),{full:true,footer:'<button onclick="saveNewTemplate()" class="btn btn-sm btn-primary">Save Template</button><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>'});}
function newTplGroup(groupKey,enable){const g=HR_PERM_GROUPS.find(x=>x.key===groupKey);if(!g)return;g.perms.forEach(p=>{if(enable)_hrtCustomPerms.add(p.key);else _hrtCustomPerms.delete(p.key);});openModal('New Role Template',renderNewTplBody(),{full:true,footer:'<button onclick="saveNewTemplate()" class="btn btn-sm btn-primary">Save Template</button><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>'});}
function saveNewTemplate(){const name=document.getElementById('new-tpl-name')?.value.trim();if(!name){showToast('Template name required','error');return;}const desc=document.getElementById('new-tpl-desc')?.value.trim();const colors=['brand','blue','yellow','purple'];MOCK.roleTemplates.push({id:'rt-'+Date.now(),name,description:desc||name,color:colors[MOCK.roleTemplates.length%colors.length],permissions:[..._hrtCustomPerms]});showToast('Template "'+name+'" saved with '+_hrtCustomPerms.size+' permissions');closeModal();renderAll();}

function openEditTemplateModal(id) {
  const t=MOCK.roleTemplates.find(x=>x.id===id);if(!t)return;
  _hrtCustomPerms=new Set(t.permissions);
  const perms=_hrtCustomPerms;
  const groups=HR_PERM_GROUPS.map(g=>'<div class="bg-white border border-charcoal-200 rounded-xl overflow-hidden mb-2"><div class="px-3 py-2 bg-charcoal-50/60 border-b border-charcoal-100 flex items-center justify-between"><p class="text-[10px] font-semibold text-charcoal-700 uppercase">'+g.key+'</p><div class="flex gap-1.5"><button onclick="editTplGroup(\''+t.id+'\',\''+g.key+'\',true)" class="text-[9px] text-brand-600 hover:underline">All</button><button onclick="editTplGroup(\''+t.id+'\',\''+g.key+'\',false)" class="text-[9px] text-charcoal-400 hover:underline">None</button></div></div><div class="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">'+g.perms.map(p=>'<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-charcoal-50 cursor-pointer"><input type="checkbox" class="rounded w-3.5 h-3.5 text-brand-600" '+(perms.has(p.key)?'checked':'')+' onchange="editTplPerm(\''+t.id+'\',\''+p.key+'\',this.checked)"><span class="text-[11px] text-charcoal-700">'+p.label+'</span></label>').join('')+'</div></div>').join('');
  openModal('Edit Template \u2014 '+t.name,'<div class="space-y-3"><div><label class="form-label">Name</label><input id="edit-tpl-name" class="form-input" value="'+t.name+'"></div><div class="max-h-[45vh] overflow-y-auto pr-0.5">'+groups+'</div></div>',{full:true,footer:'<button onclick="saveEditTpl(\''+t.id+'\')" class="btn btn-sm btn-primary">Save Changes</button><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>'});
}
function editTplPerm(tplId,key,checked){if(checked)_hrtCustomPerms.add(key);else _hrtCustomPerms.delete(key);openEditTemplateModal(tplId);}
function editTplGroup(tplId,groupKey,enable){const g=HR_PERM_GROUPS.find(x=>x.key===groupKey);if(g)g.perms.forEach(p=>{if(enable)_hrtCustomPerms.add(p.key);else _hrtCustomPerms.delete(p.key);});openEditTemplateModal(tplId);}
function saveEditTpl(id){const t=MOCK.roleTemplates.find(x=>x.id===id);if(!t)return;const name=document.getElementById('edit-tpl-name')?.value.trim()||t.name;t.name=name;t.permissions=[..._hrtCustomPerms];showToast('Template "'+name+'" updated \u2014 '+t.permissions.length+' permissions');closeModal();renderAll();}
