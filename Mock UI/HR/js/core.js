// ==================== HR STATE & UTILITIES ====================
let state = { currentPage: 'dashboard', sidebarOpen: false, userMenuOpen: false, mobileMoreOpen: false };
const DEMO = { showAll: true, role: 'hrManager' };

function hasPermission(perm) {
  const perms = MOCK.currentUser.permissions || [];
  if (perms.includes('*')) return true;
  return perms.includes(perm);
}
function formatDate(s) { if (!s) return '—'; return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function getGreeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function statusBadge(status) {
  const m = { 'On Time':'badge-green','Present':'badge-green','Approved':'badge-green','Valid':'badge-green','Paid':'badge-green','Completed':'badge-green','Published':'badge-blue','Exceeds':'badge-green','Meets':'badge-blue',
    'Late':'badge-yellow','Pending':'badge-yellow','Pending HR Review':'badge-yellow','Processing':'badge-yellow','Expiring Soon':'badge-orange','Draft':'badge-yellow','Below':'badge-red','Open':'badge-emerald',
    'Absent':'badge-red','Rejected':'badge-red','Early Checkout':'badge-blue','Off':'badge-gray','Cancelled':'badge-gray','Submitted':'badge-purple','Notice Period':'badge-yellow','On Leave':'badge-yellow','Suspended':'badge-red','Closed':'badge-gray','Sent':'badge-blue' };
  return `<span class="badge ${m[status]||'badge-gray'}">${status}</span>`;
}

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
  const w = opts.wide ? 'max-w-xl' : opts.full ? 'max-w-3xl' : 'max-w-md';
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

// ==================== NAV ====================
const mainNav = [
  {id:'dashboard',label:'Dashboard',icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'},
  {id:'employees',label:'Employees',icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', permission:'employees.view'},
  {id:'recruitment',label:'Recruitment & Hiring',icon:'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', permission:'recruitment.view'},
  {id:'attendance',label:'Attendance',icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', permission:'attendance.view'},
  {id:'schedule',label:'Shifts & Schedule',icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', permission:'schedule.manage'},
  {id:'requests',label:'Requests',icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', permission:'requests.view'},
  {id:'payroll',label:'Payroll',icon:'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', permission:'payroll.view'},
  {id:'evaluations',label:'Evaluations',icon:'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', permission:'evaluations.view'},
];
const secondaryNav = [
  {id:'reports',label:'Reports & Analytics',icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', permission:'reports.view'},
  {id:'positions',label:'Positions & Levels',icon:'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', permission:'positions.view'},
  {id:'notifications',label:'Notifications & Announcements',icon:'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', permission:'announcements.view'},
  {id:'audit',label:'Activity / Audit Log',icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', permission:'audit.view'},
  {id:'events',label:'Events',icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm9-5l-3-3 2-2 .5.5L19 8l1 1z'},
  {id:'my-access',label:'My Access',icon:'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'},
];

function renderNavItems(id) {
  const c = document.getElementById(id);
  if(!c) return;
  const showAll = DEMO.showAll;
  const visMain = showAll ? mainNav : mainNav.filter(i => !i.permission || hasPermission(i.permission));
  const visSec = showAll ? secondaryNav : secondaryNav.filter(i => !i.permission || hasPermission(i.permission));
  let h = visMain.map(i => navItemHtml(i)).join('');
  h += '<div class="nav-section-title mt-3">Administration</div>';
  h += visSec.map(i => navItemHtml(i)).join('');
  c.innerHTML = h;
}
function navItemHtml(i) {
  return `<a href="javascript:void(0)" onclick="navigateTo('${i.id}')" class="nav-item ${state.currentPage===i.id?'active':''}"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${i.icon}"/></svg><span class="text-xs">${i.label}</span></a>`;
}

function renderMobileMore() {
  const g = document.getElementById('mobile-more-grid');
  if(!g) return;
  const showAll = DEMO.showAll;
  const all = [...mainNav,...secondaryNav];
  const vis = showAll ? all : all.filter(i => !i.permission || hasPermission(i.permission));
  g.innerHTML = vis.map(i=>`<button onclick="navigateTo('${i.id}');closeMobileMore()" class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-charcoal-50"><div class="w-8 h-8 rounded-lg bg-charcoal-50 flex items-center justify-center text-charcoal-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${i.icon}"/></svg></div><span class="text-[9px] font-medium text-charcoal-700 text-center leading-tight">${i.label}</span></button>`).join('');
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
  state.currentPage = page;
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

// ==================== DEMO CONTROLS ====================
function updateUserUI() {
  const u = MOCK.currentUser;
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('sidebar-avatar', u.initials);
  set('sidebar-user-name', u.fullName);
  set('sidebar-user-role', u.role);
  set('header-avatar', u.initials);
  set('header-user-name', u.fullName);
  set('header-user-meta', `${u.position} · ${u.gyms.length} gyms`);
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
  DEMO.role = u.role;
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
