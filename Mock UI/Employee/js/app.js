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
  'team-member-profile': renderTeamMemberProfile,
  'team-attendance': renderTeam,
  'team-schedule': renderTeamSchedule,
  'team-requests': renderTeamRequests,
  'team-performance': renderTeamPerformance,
  'team-updates': renderTeamUpdates,
  'employees': renderEmployees,
  'employees-performance': renderEmployeesPerformance,
  'employee-profile': renderEmployeeProfile,
  'attendance-management': renderAttendanceManagement,
  'requests-management': renderRequestsManagement,
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
  'team-member-profile': 'Employee Profile',
  'team-attendance': 'My Team',
  'team-schedule': 'Team Schedule',
  'team-requests': 'Team Requests',
  'team-performance': 'Team Performance',
  'team-updates': 'Team Actions',
  'employees': 'Employees',
  'employees-performance': 'Employees Performance',
  'employee-profile': 'Employee Profile',
  'attendance-management': 'Attendance Management',
  'requests-management': 'Requests Management',
  'recruitment': 'Recruitment Requests',
  'leaving': 'Employee Leaving',
};

// The Team Schedule page is re-branded "Branch Schedule" for the two roles
// that get the BM's page set (Branch Manager, Team Leader) — mirrors the label
// swap done by navPools() in core.js.
function pageTitleFor(id) {
  if (id === 'team-schedule' && (MOCK.currentUser.role === 'Branch Manager' || MOCK.currentUser.role === 'Team Leader')) return 'Branch Schedule';
  return pageTitles[id] || 'Dashboard';
}

function renderAll() {
  const renderer = pageRenderers[state.currentPage];
  const html = renderer ? renderer() : '<div class="text-center py-20"><p class="text-charcoal-500">Page not found</p></div>';
  const title = pageTitleFor(state.currentPage);

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
    if (p === state.currentPage) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  // Push our records to the shared HR queue and pick up any decisions HR
  // already made while this tab was closed (silent — no toast on load).
  if (typeof branchQueueSync === 'function') branchQueueSync({ silent: true });
  updateUserUI();
  renderAll();
});