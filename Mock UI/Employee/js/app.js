// ==================== PAGE ROUTER ====================
const pageRenderers = {
  'dashboard': renderDashboard,
  'profile': renderProfile,
  'documents': renderDocuments,
  'history': renderHistory,
  'attendance': renderAttendance,
  'schedule': renderSchedule,
  'payroll': renderPayroll,
  'evaluations': renderEvaluations,
  'requests': renderRequests,
  'notifications': renderNotifications,
  'settings': renderSettings,
  'team': renderTeam,
  'team-attendance': renderTeam,
  'team-schedule': renderTeamSchedule,
  'team-requests': renderTeamRequests,
  'team-performance': renderTeamPerformance,
  'team-updates': renderTeamUpdates,
  'employees': renderEmployees,
  'attendance-management': renderAttendanceManagement,
  'requests-management': renderRequestsManagement,
  'shift-management': renderShiftManagement,
  'recruitment': renderRecruitment,
  'leaving': renderLeaving,
};

const pageTitles = {
  'dashboard': 'Dashboard',
  'profile': 'My Profile',
  'documents': 'My Documents',
  'history': 'Employment History',
  'attendance': 'My Attendance',
  'schedule': 'My Schedule',
  'payroll': 'My Payroll',
  'evaluations': 'My Evaluations',
  'requests': 'My Requests',
  'notifications': 'Notifications',
  'settings': 'Settings',
  'team': 'My Team',
  'team-attendance': 'My Team',
  'team-schedule': 'Team Schedule',
  'team-requests': 'Team Requests',
  'team-performance': 'Team Performance',
  'team-updates': 'Team Updates',
  'employees': 'Employees',
  'attendance-management': 'Attendance Management',
  'requests-management': 'Requests Management',
  'shift-management': 'Shift Management',
  'recruitment': 'Recruitment Requests',
  'leaving': 'Employee Leaving',
};

function renderAll() {
  const renderer = pageRenderers[state.currentPage];
  const html = renderer ? renderer() : '<div class="text-center py-20"><p class="text-charcoal-500">Page not found</p></div>';
  const title = pageTitles[state.currentPage] || 'Dashboard';

  // Desktop
  const mc = document.getElementById('main-content');
  if (mc) mc.innerHTML = html;

  // Mobile
  const mb = document.getElementById('mobile-content');
  if (mb) mb.innerHTML = html;

  // Mobile page title
  const mt = document.getElementById('mobile-page-title');
  if (mt) mt.textContent = title;

  // Nav
  renderNavItems('sidebar-nav');
  renderNavItems('mobile-sidebar-nav');

  // Header user info (role switcher may have changed the active user)
  updateUserUI();

  // Mobile bottom nav active
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    const p = btn.getAttribute('data-page');
    if (p === state.currentPage || (p === 'more' && !['dashboard','schedule','requests','notifications'].includes(state.currentPage))) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  renderAll();
});