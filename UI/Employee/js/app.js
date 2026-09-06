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
  'team-overview': renderTeamOverview,
  'team-requests': renderTeamRequests,
  'team-attendance': renderTeamAttendance,
  'team-schedule': renderTeamSchedule,
  'shift-assignment': renderShiftAssignment,
  'team-followup': renderTeamFollowup,
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
  'team-overview': 'Team Overview',
  'team-requests': 'Team Requests',
  'team-attendance': 'Team Attendance',
  'team-schedule': 'Team Schedule',
  'shift-assignment': 'Shift Assignment',
  'team-followup': 'Team Follow-up',
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
  renderAll();
});