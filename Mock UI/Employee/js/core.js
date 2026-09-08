// ==================== STATE & UTILITIES ====================
let state = { currentPage: 'dashboard', currentCycleIndex: MOCK.currentCycleIndex, sidebarOpen: false, userMenuOpen: false, mobileMoreOpen: false, selectedReq: null, teamScheduleEdit: false };

// Demo preview state — lets the user preview every page & role in the prototype
// Defaults to showAll=true so the prototype opens with every page visible.
const DEMO = { showAll: true, role: 'branchManager' };

function hasPermission(perm) {
  const perms = MOCK.currentUser.permissions || [];
  if (perms.includes('*')) return true;
  return perms.includes(perm);
}
function hasMgmt() {
  if (DEMO.showAll) return true;
  const perms = MOCK.currentUser.permissions || [];
  return [...teamItems, ...branchItems].some(i => !i.permission || perms.includes(i.permission) || perms.includes('*'));
}

function formatDate(s) { if (!s) return '—'; return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function getGreeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function statusBadge(status) {
  const m = { 'On Time':'badge-green','Present':'badge-green','Approved':'badge-green','Valid':'badge-green','Paid':'badge-green','Completed':'badge-green','Published':'badge-blue',
    'Late':'badge-yellow','Pending':'badge-yellow','Processing':'badge-yellow','Expiring Soon':'badge-orange',
    'Absent':'badge-red','Rejected':'badge-red','Early Checkout':'badge-blue','Off':'badge-gray','Cancelled':'badge-gray','Submitted':'badge-purple','Notice Period':'badge-yellow','Draft':'badge-gray' };
  return `<span class="badge ${m[status]||'badge-gray'}">${status}</span>`;
}
const categoryIcons = {
  'Requests':'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  'Schedule':'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'Payroll':'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1',
  'Evaluations':'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  'Documents':'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  'HR Announcements':'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  'System':'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  'Attendance':'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  'Evaluations2':'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
};
function catIcon(cat) { return `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${categoryIcons[cat]||categoryIcons['System']}"/></svg>`; }
const colorMap = { green:'bg-brand-100 text-brand-600', blue:'bg-blue-100 text-blue-600', orange:'bg-orange-100 text-orange-600', red:'bg-red-100 text-red-600', yellow:'bg-yellow-100 text-yellow-600', purple:'bg-purple-100 text-purple-600' };

// ==================== SHIFT HELPERS ====================
function getShiftTemplate(id) { return MOCK.shiftTemplates.find(t => t.id === id) || MOCK.shiftTemplates.find(t => t.isOff); }
function getShiftHours(template) {
  if (!template || template.isOff || !template.start || !template.end) return 0;
  let [sh, sm] = template.start.split(':').map(Number);
  let [eh, em] = template.end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // wraps midnight
  return Math.round((mins / 60) * 10) / 10;
}
function getShiftColor(template) {
  if (!template) return { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' };
  return { bg: template.bgColor, text: template.textColor, border: template.color };
}
function generateShiftId() { return 'st-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
const SHIFT_PALETTE = ['#2563eb','#16a34a','#7c3aed','#ea580c','#0891b2','#be185d','#ca8a04','#4f46e5','#059669','#dc2626'];

// ==================== TOAST ====================
function showToast(msg, type='success') {
  const c = document.getElementById('toast-container');
  const id = 't'+Date.now();
  const ic = {success:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',error:'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',info:'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'};
  const cl = {success:'bg-brand-50 border-brand-200 text-brand-800',error:'bg-red-50 border-red-200 text-red-800',info:'bg-blue-50 border-blue-200 text-blue-800'};
  const il = {success:'text-brand-500',error:'text-red-500',info:'text-blue-500'};
  const t = document.createElement('div');
  t.id = id;
  t.className = `pointer-events-auto flex items-start gap-2 px-3 py-2 rounded-lg border shadow-lg ${cl[type]} toast-enter max-w-xs`;
  t.innerHTML = `<svg class="w-4 h-4 flex-shrink-0 mt-0.5 ${il[type]}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${ic[type]}"/></svg><p class="text-xs font-medium flex-1">${msg}</p><button onclick="document.getElementById('${id}').remove()" class="flex-shrink-0 opacity-60 hover:opacity-100"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
  c.appendChild(t);
  setTimeout(() => { const el = document.getElementById(id); if(el) el.remove(); }, 3000);
}

// ==================== MODAL ====================
function openModal(title, content, opts={}) {
  const w = opts.wide ? 'max-w-xl' : 'max-w-md';
  document.getElementById('modal-container').innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="fixed inset-0 bg-black/50"></div>
      <div class="relative bg-white rounded-xl shadow-2xl ${w} w-full max-h-[85vh] flex flex-col modal-content" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-charcoal-100 flex-shrink-0">
          <h2 class="text-sm font-semibold text-charcoal-900">${title}</h2>
          <button onclick="closeModal()" class="p-1 rounded hover:bg-charcoal-100"><svg class="w-4 h-4 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div class="overflow-y-auto px-4 py-3 flex-1">${content}</div>
        ${opts.footer ? `<div class="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-charcoal-100 flex-shrink-0">${opts.footer}</div>` : ''}
      </div>
    </div>`;
}
function closeModal(e) { if(e && e.target!==e.currentTarget) return; document.getElementById('modal-container').innerHTML=''; }

function openDrawer(title, content) {
  document.getElementById('modal-container').innerHTML = `
    <div class="fixed inset-0 z-50 modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="fixed inset-0 bg-black/50"></div>
      <div class="absolute right-0 inset-y-0 w-full max-w-sm bg-white shadow-2xl flex flex-col drawer-enter-right" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-charcoal-100 flex-shrink-0">
          <h2 class="text-sm font-semibold text-charcoal-900">${title}</h2>
          <button onclick="closeModal()" class="p-1 rounded hover:bg-charcoal-100"><svg class="w-4 h-4 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div class="overflow-y-auto px-4 py-3 flex-1">${content}</div>
      </div>
    </div>`;
}

// ==================== NAV ====================
// Slim sidebar: only core pages
const navItems = [
  {id:'dashboard',label:'Dashboard',icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'},
  {id:'schedule',label:'My Schedule',icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'},
  {id:'requests',label:'My Requests',icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'},
  {id:'attendance',label:'My Attendance',icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'},
  {id:'payroll',label:'My Payroll',icon:'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'},
  {id:'documents',label:'My Documents',icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'},
  {id:'events',label:'Events',icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm9-5l-3-3 2-2 .5.5L19 8l1 1z'},
];
// Team-scoped management pages — visible to Team Leader (and anyone granted
// team-scoped permissions). Scope is limited to the teams the user leads.
const teamItems = [
  {id:'team',label:'My Team',icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', permission:'team.view'},
  {id:'team-schedule',label:'Team Schedule',icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', permission:'schedule.view.team'},
  {id:'team-requests',label:'Team Requests',icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', permission:'requests.view.team'},
  {id:'team-performance',label:'Team Performance',icon:'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', permission:'evaluations.view.team'},
  {id:'team-updates',label:'Team Updates',icon:'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', permission:'team.manage'},
];

// Branch-wide management pages — visible to Branch Manager (and anyone granted
// gym-wide permissions). Scope is the assigned gym.
const branchItems = [
  {id:'employees',label:'Employees',icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', permission:'employees.view'},
  {id:'attendance-management',label:'Attendance Management',icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', permission:'attendance.view'},
  {id:'requests-management',label:'Requests Management',icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', permission:'requests.view'},
  {id:'shift-management',label:'Shift Management',icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zM12 14l-2 2m0 0l-2-2m2 2V8', permission:'schedule.manage'},
  {id:'recruitment',label:'Recruitment',icon:'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', permission:'recruitment.vacancy_request.create'},
  {id:'leaving',label:'Employee Leaving',icon:'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', permission:'employees.offboard'},
];
// Extra pages accessible from user dropdown
const extraPages = [
  {id:'profile',label:'My Profile',icon:'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'},
  {id:'history',label:'Employment History',icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'},
  {id:'evaluations',label:'My Evaluations',icon:'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'},
  {id:'notifications',label:'Notifications',icon:'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'},
  {id:'settings',label:'Settings',icon:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'},
];

function renderNavItems(id) {
  const c = document.getElementById(id);
  if(!c) return;
  const showAll = DEMO.showAll;
  const visibleTeam = showAll ? teamItems : teamItems.filter(i => !i.permission || hasPermission(i.permission));
  const visibleBranch = showAll ? branchItems : branchItems.filter(i => !i.permission || hasPermission(i.permission));
  let h = navItems.map(i => `<a href="javascript:void(0)" onclick="navigateTo('${i.id}')" class="nav-item ${state.currentPage===i.id?'active':''}"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${i.icon}"/></svg><span class="text-xs">${i.label}</span></a>`).join('');
  if(showAll) {
    h += '<div class="nav-section-title mt-3">Self-Service</div>' + extraPages.map(i => `<a href="javascript:void(0)" onclick="navigateTo('${i.id}')" class="nav-item ${state.currentPage===i.id?'active':''}"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${i.icon}"/></svg><span class="text-xs">${i.label}</span></a>`).join('');
  }
  if(showAll || visibleTeam.length) { h += '<div class="nav-section-title mt-3">Team</div>' + visibleTeam.map(i => `<a href="javascript:void(0)" onclick="navigateTo('${i.id}')" class="nav-item ${state.currentPage===i.id?'active':''}"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${i.icon}"/></svg><span class="text-xs">${i.label}</span></a>`).join(''); }
  if(showAll || visibleBranch.length) { h += '<div class="nav-section-title mt-3">Branch</div>' + visibleBranch.map(i => `<a href="javascript:void(0)" onclick="navigateTo('${i.id}')" class="nav-item ${state.currentPage===i.id?'active':''}"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${i.icon}"/></svg><span class="text-xs">${i.label}</span></a>`).join(''); }
  c.innerHTML = h;
}

function renderMobileMore() {
  const g = document.getElementById('mobile-more-grid');
  if(!g) return;
  const showAll = DEMO.showAll;
  const visibleTeam = showAll ? teamItems : teamItems.filter(i => !i.permission || hasPermission(i.permission));
  const visibleBranch = showAll ? branchItems : branchItems.filter(i => !i.permission || hasPermission(i.permission));
  const items = [...navItems.filter(i=>!['dashboard','schedule','requests','notifications'].includes(i.id)),...(showAll?extraPages:[]),...visibleTeam,...visibleBranch];
  g.innerHTML = items.map(i=>`<button onclick="navigateTo('${i.id}');closeMobileMore()" class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-charcoal-50"><div class="w-8 h-8 rounded-lg bg-charcoal-50 flex items-center justify-center text-charcoal-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${i.icon}"/></svg></div><span class="text-[9px] font-medium text-charcoal-700 text-center leading-tight">${i.label}</span></button>`).join('');
}

// ==================== NAVIGATION ====================
function navigateTo(page, params) {
  state.currentPage = page; state.pageParams = params||{};
  renderAll(); closeSidebar(); closeMobileMore();
  const m = document.getElementById('main-content'); if(m) m.scrollTop=0;
  const mb = document.getElementById('mobile-content'); if(mb) mb.scrollTop=0;
}
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  const s=document.getElementById('mobile-sidebar'),o=document.getElementById('mobile-sidebar-overlay');
  if(state.sidebarOpen){s.classList.remove('-translate-x-full');o.classList.remove('hidden');}else{s.classList.add('-translate-x-full');o.classList.add('hidden');}
}
function closeSidebar() { state.sidebarOpen=false; const s=document.getElementById('mobile-sidebar'),o=document.getElementById('mobile-sidebar-overlay'); if(s)s.classList.add('-translate-x-full'); if(o)o.classList.add('hidden'); }
function toggleUserMenu() { state.userMenuOpen=!state.userMenuOpen; const d=document.getElementById('user-menu-dropdown'); if(state.userMenuOpen)d.classList.remove('hidden');else d.classList.add('hidden'); }
function closeUserMenu() { state.userMenuOpen=false; const d=document.getElementById('user-menu-dropdown'); if(d)d.classList.add('hidden'); }
function toggleMobileMore() { state.mobileMoreOpen=!state.mobileMoreOpen; const m=document.getElementById('mobile-more-menu'); if(state.mobileMoreOpen){renderMobileMore();m.classList.remove('hidden');}else m.classList.add('hidden'); }
function closeMobileMore() { state.mobileMoreOpen=false; const m=document.getElementById('mobile-more-menu'); if(m)m.classList.add('hidden'); }
function handleLogout() { openModal('Confirm Logout','<p class="text-xs text-charcoal-600 mb-3">Are you sure you want to log out?</p>',{footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="showToast(\'Logged out\');closeModal();" class="btn btn-sm btn-danger">Logout</button>'}); }
document.addEventListener('click', e => { if(!e.target.closest('#user-menu-container')) closeUserMenu(); });

// ==================== DEMO PREVIEW CONTROLS ====================
// Prototype-only helpers: switch the active role and toggle "show all pages".
function updateUserUI() {
  const u = MOCK.currentUser;
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('sidebar-avatar', u.initials);
  set('sidebar-user-name', u.fullName);
  set('sidebar-user-role', u.role);
  set('header-avatar', u.initials);
  set('header-user-name', u.fullName);
  set('header-user-meta', `${u.position} · ${u.gym.name}`);
  set('menu-user-name', u.fullName);
  set('menu-user-email', u.email);
  const roleBtn = document.getElementById('demo-role-label');
  if(roleBtn) roleBtn.textContent = u.role;
  const showAllBtn = document.getElementById('demo-showall');
  if(showAllBtn) showAllBtn.classList.toggle('active', DEMO.showAll);
}

function switchRole(roleId) {
  const u = DEMO_USERS[roleId];
  if(!u) return;
  MOCK.currentUser = u;
  DEMO.role = roleId;
  // If the current page is no longer reachable, fall back to dashboard
  const pagePerms = { 'team':'team.view','team-attendance':'attendance.view.team','team-schedule':'schedule.view.team','team-requests':'requests.view.team','team-performance':'evaluations.view.team','team-updates':'team.manage','employees':'employees.view','attendance-management':'attendance.view','requests-management':'requests.view','shift-management':'schedule.manage','recruitment':'recruitment.vacancy_request.create','leaving':'employees.offboard' };
  if(pagePerms[state.currentPage] && !DEMO.showAll && !hasPermission(pagePerms[state.currentPage])) {
    state.currentPage = 'dashboard';
  }
  updateUserUI();
  renderAll();
  closeUserMenu();
  showToast(`Previewing as ${u.role}`, 'info');
}

function toggleShowAll() {
  DEMO.showAll = !DEMO.showAll;
  updateUserUI();
  renderAll();
  showToast(DEMO.showAll ? 'Showing all pages' : 'Showing pages by permission', 'info');
}

function toggleDemoRoleMenu() {
  const m = document.getElementById('demo-role-menu');
  if(m) m.classList.toggle('hidden');
}
document.addEventListener('click', e => { if(!e.target.closest('#demo-role-container')) { const m=document.getElementById('demo-role-menu'); if(m) m.classList.add('hidden'); } });
