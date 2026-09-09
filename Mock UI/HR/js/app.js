// ==================== PAGE ROUTER ====================
const pageRenderers = {
  'dashboard': renderDashboard,
  'employees': renderEmployees,
  'recruitment': renderRecruitment,
  'attendance': renderAttendance,
  'schedule': renderSchedule,
  'requests': renderRequests,
  'payroll': renderPayroll,
  'evaluations': renderEvaluations,
  'reports': renderReports,
  'positions': renderPositions,
  'notifications': renderNotifications,
  'audit': renderAuditLog,
  'events': renderEvents,
  'my-access': renderMyAccess,
};

const pageTitles = {
  'dashboard': 'Dashboard',
  'employees': 'Employees',
  'recruitment': 'Recruitment & Hiring',
  'attendance': 'Attendance',
  'schedule': 'Shifts & Schedule',
  'requests': 'Requests',
  'payroll': 'Payroll',
  'evaluations': 'Evaluations',
  'reports': 'Reports & Analytics',
  'positions': 'Positions & Levels',
  'notifications': 'Notifications & Announcements',
  'audit': 'Activity / Audit Log',
  'events': 'Events',
  'my-access': 'My Access',
};

function renderAll() {
  const renderer = pageRenderers[state.currentPage];
  const html = renderer ? renderer() : '<div class="text-center py-20"><p class="text-charcoal-500">Page not found</p></div>';
  const title = pageTitles[state.currentPage] || 'Dashboard';

  const mc = document.getElementById('main-content');
  if (mc) mc.innerHTML = html;
  const mb = document.getElementById('mobile-content');
  if (mb) mb.innerHTML = html;
  const mt = document.getElementById('mobile-page-title');
  if (mt) mt.textContent = title;

  renderNavItems('sidebar-nav');
  renderNavItems('mobile-sidebar-nav');
  updateUserUI();

  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    const p = btn.getAttribute('data-page');
    if (p === state.currentPage || (p === 'more' && !['dashboard','employees','requests','notifications'].includes(state.currentPage))) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// ==================== GYM FILTER HELPER ====================
function gymFilter() {
  const sel = MOCK.currentUser.selectedGym;
  if (sel === 'all') return MOCK.employees;
  return MOCK.employees.filter(e => e.gym === sel);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  renderAll();
});
