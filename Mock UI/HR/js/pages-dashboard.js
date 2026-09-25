// ====================================================================================
// ==================== REVIVE HR SYSTEM — DASHBOARD (REACT + SHADCN SPEC) =============
// ====================================================================================
// Design System: Modern Corporate Minimalism
// Primary color: #16A34A (green), used sparingly for primary actions/accents
// Spacing: 8px grid | Radii: 4px small, 8px cards, 12px containers | Shadows: soft, ambient
// Supports: HR Manager (Full) vs HR Regular (Narrower & Gated) variants + RTL Arabic

let _dashVariant = 'manager'; // 'manager' | 'specialist'
let _isRTL = false;          // false (LTR) | true (RTL)

function setDashboardVariant(v) {
  _dashVariant = v;
  // Sync mock user role
  if (v === 'manager') {
    switchRole('hrManager');
  } else {
    switchRole('hr');
  }
}

function toggleDashboardRTL() {
  _isRTL = !_isRTL;
  renderAll();
  showToast(_isRTL ? 'تم تفعيل واجهة اللغة العربية (RTL)' : 'Switched to English (LTR)', 'info');
}

function setGymFilter(id) {
  MOCK.currentUser.selectedGym = id;
  renderAll();
  showToast(id === 'all' ? (_isRTL ? 'عرض جميع الفروع' : 'Showing all assigned gyms') : (_isRTL ? `تم تحديد الفرع: ${id}` : `Branch filtered`), 'info');
}

// ==================== OPERATIONAL ACTION MODALS ====================
function openStalledCandidateModal() {
  const c = MOCK.candidates.find(x => x.name.includes('Ahmed Karim')) || MOCK.candidates[0];
  openModal(_isRTL ? 'مراجعة المرشح المتعطل في المقابلة' : 'Action Required: Stalled Candidate Review', `
    <div class="space-y-4">
      <div class="bg-red-50/70 border border-red-200 rounded-lg p-3 text-xs flex items-start gap-2.5">
        <span class="badge badge-red font-bold flex-shrink-0">${_isRTL ? 'مطلوب إجراء فوري' : 'Action Required'}</span>
        <div>
          <p class="font-bold text-red-900">${_isRTL ? 'تجاوز فترة الانتظار (6 أيام بدون تحديث)' : 'Stalled for 6 days in 2nd Interview stage (SLA: 3 days)'}</p>
          <p class="text-red-700 text-[11px] mt-0.5">${_isRTL ? 'تم الانتهاء من المقابلة الفنية بنجاح ولكن لم يتم اتخاذ قرار نهائي أو تحديد موعد للمقابلة الإدارية.' : 'Candidate passed technical screening with 4.8/5 rating. Branch manager awaiting final corporate HR sign-off.'}</p>
        </div>
      </div>

      <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-neutral-900 text-sm">${c.name}</span>
          <span class="badge badge-purple text-[10px]">${c.position} · Nasr City</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
          <p>Phone: <b>${c.phone || '+20 101 234 5678'}</b></p>
          <p>Expected Salary: <b>EGP 13,000</b></p>
          <p>Interviewer: <b>Youssef Kamal (BM)</b></p>
          <p>Rating: <b class="text-amber-600">4.8 / 5.0 ★</b></p>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-neutral-100">
        <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">${_isRTL ? 'إلغاء' : 'Cancel'}</button>
        <button onclick="advanceCandidateStage('${c.id}', 'Rejected');closeModal();" class="btn btn-sm btn-danger text-xs">${_isRTL ? 'رفض المرشح' : 'Reject'}</button>
        <button onclick="advanceCandidateStage('${c.id}', 'Accepted');closeModal();" class="btn btn-sm btn-primary text-xs">${_isRTL ? 'الموافقة وإصدار العرض' : 'Approve & Send Job Offer'}</button>
      </div>
    </div>
  `, { wide: false });
}

function openAttendanceExceptionsModal() {
  openModal(_isRTL ? 'معالجة استثناءات الحضور المعلقة' : 'Action Required: Unresolved Attendance Issues', `
    <div class="space-y-3">
      <div class="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs flex items-start gap-2.5">
        <span class="badge badge-yellow font-bold flex-shrink-0">${_isRTL ? 'مطلوب اتخاذ إجراء' : 'Action Required'}</span>
        <div>
          <p class="font-bold text-amber-900">${_isRTL ? '4 استثناءات حضور غير محلولة (فرع مصر الجديدة)' : '4 Unresolved exceptions yesterday at Heliopolis'}</p>
          <p class="text-amber-800 text-[11px] mt-0.5">${_isRTL ? '3 حالات خروج بدون بصمة انصراف + 1 غياب غير مبرر في الوردية المسائية.' : '3 missing check-outs from evening shift and 1 unexcused absence requiring HR classification before payroll lock.'}</p>
        </div>
      </div>

      <div class="space-y-2 text-xs">
        <div class="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
          <div>
            <p class="font-bold text-neutral-900">Yasmin Adel (Trainer)</p>
            <p class="text-[11px] text-neutral-500">Missing check-out · Scheduled 16:00–00:00</p>
          </div>
          <button onclick="showToast('Marked as standard checkout');this.parentElement.remove();" class="btn btn-sm btn-secondary text-xs px-2.5">Resolve</button>
        </div>
        <div class="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
          <div>
            <p class="font-bold text-neutral-900">Tarek Nabil (Receptionist)</p>
            <p class="text-[11px] text-neutral-500">Missing check-out · Scheduled 16:00–00:00</p>
          </div>
          <button onclick="showToast('Marked as standard checkout');this.parentElement.remove();" class="btn btn-sm btn-secondary text-xs px-2.5">Resolve</button>
        </div>
        <div class="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
          <div>
            <p class="font-bold text-neutral-900">Mona Said (Senior Coach)</p>
            <p class="text-[11px] text-neutral-500">Unexcused Absence · Shift 08:00–16:00</p>
          </div>
          <button onclick="showToast('Classified as Approved Sick Leave');this.parentElement.remove();" class="btn btn-sm btn-secondary text-xs px-2.5">Apply Leave</button>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-neutral-100">
        <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">${_isRTL ? 'إغلاق' : 'Close'}</button>
        <button onclick="showToast('All 4 exceptions resolved');closeModal();" class="btn btn-sm btn-primary text-xs">${_isRTL ? 'تسوية وتأكيد الجميع' : 'Resolve All 4 Exceptions'}</button>
      </div>
    </div>
  `, { wide: false });
}

function openPendingSlaRequestsModal() {
  const reqs = MOCK.requests.filter(r => r.status === 'Pending HR Review').slice(0, 2);
  openModal(_isRTL ? 'طلبات الإجازات المتجاوزة للمهلة' : 'Action Required: Requests Pending Beyond Threshold', `
    <div class="space-y-3">
      <div class="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs flex items-start gap-2.5">
        <span class="badge badge-yellow font-bold flex-shrink-0">${_isRTL ? 'مهلة تجاوزت 48 ساعة' : 'Over 48h SLA'}</span>
        <div>
          <p class="font-bold text-amber-900">${_isRTL ? 'طلبين يوم راحة بانتظار اعتماد الإدارة العامة' : '2 Day-off requests pending beyond 48-hour SLA'}</p>
          <p class="text-amber-800 text-[11px] mt-0.5">${_isRTL ? 'تمت موافقة مدير الفرع مسبقاً وتنتظر توقيع الموارد البشرية.' : 'Branch Manager approved on Monday. Employee is awaiting final confirmation for upcoming weekend.'}</p>
        </div>
      </div>

      <div class="space-y-2 text-xs">
        ${reqs.map(r => `
          <div class="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-neutral-900">${r.employee}</span>
                <span class="badge badge-gray text-[9px]">${r.gym}</span>
              </div>
              <p class="text-[11px] text-neutral-500 mt-0.5">Requested Date: <b>${r.requestedDate}</b> · Reason: ${r.reason || 'Personal'}</p>
            </div>
            <div class="flex gap-1.5">
              <button onclick="quickApproveRequest('${r.id}');closeModal();" class="btn btn-sm btn-primary text-xs h-7 px-2.5">${_isRTL ? 'اعتماد' : 'Approve'}</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-neutral-100">
        <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">${_isRTL ? 'إلغاء' : 'Cancel'}</button>
        <button onclick="showToast('Approved all overdue requests');closeModal();" class="btn btn-sm btn-primary text-xs">${_isRTL ? 'اعتماد جميع الطلبات المتأخرة' : 'Approve All Overdue'}</button>
      </div>
    </div>
  `, { wide: false });
}

function openPublishCycleModal() {
  openModal(_isRTL ? 'اعتماد ونشر جدول الوردية القادم' : 'Action Required: Next Shift Cycle Not Published', `
    <div class="space-y-3.5">
      <div class="bg-red-50/70 border border-red-200 rounded-lg p-3 text-xs flex items-start gap-2.5">
        <span class="badge badge-red font-bold flex-shrink-0">${_isRTL ? 'عاجل' : 'Critical'}</span>
        <div>
          <p class="font-bold text-red-900">${_isRTL ? 'دورة الورديات الحالية تنتهي خلال 3 أيام' : 'Current Shift Cycle #18 ends in 3 days (Sep 12)'}</p>
          <p class="text-red-700 text-[11px] mt-0.5">${_isRTL ? 'الدورة القادمة (#19) لا تزال مسودة. لم يتم إرسال الجداول للمدربين والموظفين.' : 'Next Cycle #19 (Sep 13 – Sep 22) is drafted by Branch Managers but not published by Corporate HR.'}</p>
        </div>
      </div>

      <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-neutral-900">Cycle #19 (Sep 13 – Sep 22, 2026)</span>
          <span class="badge badge-yellow text-[10px]">Draft — 142 Shifts</span>
        </div>
        <p class="text-[11px] text-neutral-600">Covering: <b>Nasr City (58)</b> · <b>Heliopolis (45)</b> · <b>6th October (39)</b></p>
        <div class="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium">
          <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          Zero staffing conflicts detected across all 3 gym locations.
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-neutral-100">
        <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">${_isRTL ? 'مراجعة الجدول أولاً' : 'Review Schedule First'}</button>
        <button onclick="showToast('Cycle #19 successfully published to all gyms!');closeModal();" class="btn btn-sm btn-primary text-xs">${_isRTL ? 'نشر وإشعار الموظفين الآن' : 'Publish & Broadcast Schedule'}</button>
      </div>
    </div>
  `, { wide: false });
}

// ====================================================================================
// ==================== MAIN DASHBOARD RENDERER (SHADCN / TAILWIND) ====================
// ====================================================================================
function renderDashboard() {
  const isMgr = _dashVariant === 'manager';
  const u = MOCK.currentUser;

  // Gym filter context
  const selectedGymObj = u.selectedGym !== 'all' ? u.gyms.find(g => g.id === u.selectedGym) : null;
  const gymBranch = selectedGymObj ? selectedGymObj.branch : null;

  // Scoped datasets
  const allStaff = isMgr ? MOCK.employees : MOCK.employees.filter(e => e.gym !== '6th October');
  const staffFiltered = gymBranch ? allStaff.filter(e => e.gym === gymBranch) : allStaff;
  
  const allPendingReqs = isMgr ? MOCK.requests.filter(r => r.status === 'Pending HR Review') : MOCK.requests.filter(r => r.status === 'Pending HR Review' && r.gym !== '6th October');
  const pendingReqsFiltered = gymBranch ? allPendingReqs.filter(r => r.gym === gymBranch) : allPendingReqs;

  const allVacancies = isMgr ? MOCK.vacancies.filter(v => v.status === 'Open') : MOCK.vacancies.filter(v => v.status === 'Open' && v.gym !== '6th October');
  const vacanciesFiltered = gymBranch ? allVacancies.filter(v => v.gym === gymBranch) : allVacancies;

  const todayAttendancePct = isMgr ? 91 : 93;
  const daysInCycle = 3;

  // RTL localization dictionary
  const t = {
    title: _isRTL ? 'نظام ريفايف لإدارة الموارد البشرية' : 'Revive HR System',
    greeting: _isRTL ? `مرحباً، ${u.firstName}` : `Good morning, ${u.firstName}`,
    roleBadge: isMgr ? (_isRTL ? 'مدير الموارد البشرية (صلاحيات كاملة)' : 'HR Manager · Full Access') : (_isRTL ? 'أخصائي موارد بشرية (مقيد الصلاحيات)' : 'HR Specialist · Scoped Access'),
    subtitle: isMgr ? (_isRTL ? 'نظرة تشغيلية شاملة لكافة الفروع والإجراءات العاجلة' : 'Multi-Gym Operational Command & Urgent Action Feed') : (_isRTL ? 'متابعة الفروع المسندة والمهام المصرح بها' : 'Assigned Gyms Operational Dashboard & To-Do Feed'),
    
    // Switcher controls
    variantLabel: _isRTL ? 'نمط الواجهة:' : 'Dashboard Variant:',
    btnMgr: _isRTL ? 'مدير HR (شامل)' : 'HR Manager (Full)',
    btnSpec: _isRTL ? 'أخصائي HR (مقيد)' : 'HR Regular (Scoped)',
    langToggle: _isRTL ? 'English (LTR)' : 'العربية (RTL)',

    // Summary Card Labels
    kpiEmployees: _isRTL ? 'إجمالي الموظفين' : 'Total Employees',
    kpiEmployeesSub: _isRTL ? '+4 هذا الشهر' : '+4 this month',
    
    kpiRequests: _isRTL ? 'الطلبات المعلقة' : 'Pending Requests',
    kpiRequestsSub: _isRTL ? 'بانتظار المراجعة' : 'Awaiting review',
    
    kpiVacancies: _isRTL ? 'الوظائف الشاغرة' : 'Open Vacancies',
    kpiVacanciesSub: _isRTL ? '2 توظيف عاجل' : '2 actively hiring',
    
    kpiAttendance: _isRTL ? 'حضور اليوم' : "Today's Attendance",
    kpiAttendanceSub: _isRTL ? 'معدل الحضور بالفرع' : '128 / 140 on-site',
    
    kpiCycle: _isRTL ? 'الأيام المتبقية بالدورة' : 'Days in Shift Cycle',
    kpiCycleSub: _isRTL ? 'تنتهي خلال 3 أيام' : 'Cycle #18 ends Sep 12',

    // Action Feed
    feedTitle: _isRTL ? 'قائمة المتابعة والإجراءات العاجلة' : 'Action Required · Follow-up Feed',
    feedSub: _isRTL ? 'مهام وقرارات تشغيلية تتطلب اعتماد الموارد البشرية' : 'Operational items requiring immediate HR action',
    actionBadge: _isRTL ? 'مطلوب اتخاذ إجراء' : 'Action Required',
    btnReview: _isRTL ? 'مراجعة' : 'Review',

    // Quick links
    linksTitle: _isRTL ? 'الوصول السريع للأقسام' : 'Quick Access Modules',
    linksSub: isMgr ? (_isRTL ? 'كافة أقسام النظام مصرح بها' : 'Direct access to all 9 modules') : (_isRTL ? 'الأقسام المصرح لك بها فقط (بدون أيقونات قفل)' : 'Only authorized modules render'),
  };

  // 1. ALL SUMMARY CARDS CONFIGURATION
  // In HR regular variant: Any card tied to a permission the user lacks simply DOES NOT RENDER (no placeholder, no lock icon)
  const summaryCards = [
    {
      id: 'emp',
      permission: 'employees.view',
      title: t.kpiEmployees,
      val: staffFiltered.length,
      sub: t.kpiEmployeesSub,
      actionTag: null,
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      onClick: `navigateTo('employees')`
    },
    {
      id: 'req',
      permission: 'requests.view',
      title: t.kpiRequests,
      val: pendingReqsFiltered.length,
      sub: t.kpiRequestsSub,
      actionTag: _isRTL ? 'مطلوب إجراء' : 'Needs Action',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      onClick: `openPendingSlaRequestsModal()`
    },
    {
      id: 'vac',
      permission: 'recruitment.view',
      title: t.kpiVacancies,
      val: vacanciesFiltered.length,
      sub: t.kpiVacanciesSub,
      actionTag: _isRTL ? '2 شاغر عاجل' : '2 Urgent',
      icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
      onClick: `navigateTo('recruitment')`
    },
    {
      id: 'att',
      permission: 'attendance.view',
      title: t.kpiAttendance,
      val: `${todayAttendancePct}%`,
      sub: t.kpiAttendanceSub,
      actionTag: _isRTL ? '3 استثناءات' : '3 Exceptions',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      onClick: `openAttendanceExceptionsModal()`
    },
    {
      id: 'cycle',
      permission: 'schedule.manage',
      title: t.kpiCycle,
      val: `${daysInCycle} Days`,
      sub: t.kpiCycleSub,
      actionTag: _isRTL ? 'مسودة قادمة' : 'Draft Pending',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      onClick: `openPublishCycleModal()`
    }
  ];

  // Filter cards strictly by permission (no placeholder, no lock icon)
  const visibleCards = summaryCards.filter(c => !c.permission || hasPermission(c.permission));

  // 2. FOLLOW-UP / ALERTS FEED ITEMS (Action Required)
  const allAlerts = [
    {
      id: 'alert-cand',
      gym: 'Nasr City',
      title: _isRTL ? 'مرشح معلق في المقابلة: أحمد كريم' : 'Stalled Candidate: Ahmed Karim (Senior Coach)',
      desc: _isRTL ? 'معلق في مرحلة المقابلة الثانية منذ 6 أيام بدون قرار نهائي (تجاوز مهلة 3 أيام).' : 'In 2nd Interview stage with no update for 6 days (SLA: 3 days). Panel scorecard complete.',
      badge: t.actionBadge,
      badgeColor: 'bg-red-50 text-red-700 border-red-200',
      actionBtn: _isRTL ? 'مراجعة المرشح' : 'Review Candidate',
      onClick: 'openStalledCandidateModal()',
      priority: 1
    },
    {
      id: 'alert-att',
      gym: 'Heliopolis',
      title: _isRTL ? '4 استثناءات حضور غير محلولة' : '4 Unresolved Attendance Exceptions',
      desc: _isRTL ? '3 حالات خروج بدون بصمة + 1 غياب غير مبرر أمس بفرع مصر الجديدة.' : '3 missing check-outs and 1 unexcused absence yesterday at Heliopolis evening shift.',
      badge: t.actionBadge,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      actionBtn: _isRTL ? 'تسوية الحضور' : 'Resolve Attendance',
      onClick: 'openAttendanceExceptionsModal()',
      priority: 2
    },
    {
      id: 'alert-req',
      gym: 'Nasr City',
      title: _isRTL ? 'طلبات إجازات معلقة تجاوزت 48 ساعة' : '2 Day-Off Requests Pending Beyond SLA',
      desc: _isRTL ? 'عمرو خالد وكريم حسن — اعتمدها مدير الفرع وبانتظار الموافقة النهائية للموارد البشرية.' : 'Amr Khaled & Karim Hassan — Branch Manager approved 3 days ago; awaiting corporate HR sign-off.',
      badge: t.actionBadge,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      actionBtn: _isRTL ? 'اعتماد الطلبات' : 'Approve Requests',
      onClick: 'openPendingSlaRequestsModal()',
      priority: 3
    },
    {
      id: 'alert-cycle',
      gym: 'All Branches',
      title: _isRTL ? 'دورة الورديات تنتهي خلال 3 أيام — لم يُنشر الجدول القادم' : 'Shift Cycle Ending Soon With No Next Cycle',
      desc: _isRTL ? 'دورة #18 تنتهي في 12 سبتمبر؛ جدول الدورة #19 لا يزال مسودة وغير معتمد للموظفين.' : 'Cycle #18 ends in 3 days; Cycle #19 (Sep 13 – Sep 22) is drafted but not yet published to branch staff.',
      badge: t.actionBadge,
      badgeColor: 'bg-red-50 text-red-700 border-red-200',
      actionBtn: _isRTL ? 'مراجعة ونشر' : 'Publish Schedule',
      onClick: 'openPublishCycleModal()',
      priority: 4
    }
  ];

  // Scoped alerts: In HR regular variant, only show alerts for assigned gyms
  const visibleAlerts = allAlerts.filter(a => {
    if (a.gym === 'All Branches') return true;
    if (gymBranch && a.gym !== gymBranch) return false;
    if (!isMgr && a.gym === '6th October') return false; // Not assigned to Sarah
    return true;
  });

  // 3. QUICK-LINK MODULE TILES
  // All 9 modules in full system. In regular HR variant, missing permission modules simply DO NOT RENDER.
  const allModules = [
    { id: 'employees', name: _isRTL ? 'الموظفين' : 'Employees', sub: _isRTL ? 'دليل 142 موظف' : '142 Staff Directory', perm: 'employees.view', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'recruitment', name: _isRTL ? 'التوظيف والمقابلات' : 'Recruitment & Hiring', sub: _isRTL ? '7 شواغر · 12 مرشح' : '7 Open · 12 Pipeline', perm: 'recruitment.view', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
    { id: 'attendance', name: _isRTL ? 'سجلات الحضور' : 'Attendance', sub: _isRTL ? 'حضور اليوم 91%' : '91% Present Today', perm: 'attendance.view', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'schedule', name: _isRTL ? 'الورديات والجداول' : 'Shifts & Schedule', sub: _isRTL ? 'دورة #18 نشطة' : 'Cycle #18 Active', perm: 'schedule.manage', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'requests', name: _isRTL ? 'طلبات الموظفين' : 'Requests', sub: _isRTL ? '5 طلبات معلقة' : '5 Awaiting Review', perm: 'requests.view', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'payroll', name: _isRTL ? 'المرتبات والخصومات' : 'Payroll', sub: _isRTL ? 'إغلاق دورة أغسطس' : 'August Processing', perm: 'payroll.approve', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'evaluations', name: _isRTL ? 'تقييم الأداء' : 'Evaluations', sub: _isRTL ? 'دورة Q3 الدورية' : 'Q3 Cycle Pending', perm: 'evaluations.view', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
    { id: 'reports', name: _isRTL ? 'التقارير والتحليلات' : 'Reports & Analytics', sub: _isRTL ? 'مؤشرات أداء الفروع' : 'Branch Performance', perm: 'reports.view', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'positions', name: _isRTL ? 'المسميات والمستويات' : 'Positions & Levels', sub: _isRTL ? '18 رتبة ومستوى' : '18 Role Grades', perm: 'positions.manage', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' }
  ];

  // In HR regular variant, if a permission is absent, the module is simply omitted (NO lock, NO placeholder)
  const visibleModules = allModules.filter(m => hasPermission(m.perm));

  // Layout width styling: Manager is full width, Regular is narrower
  const containerClass = isMgr ? 'w-full' : 'max-w-4xl mx-auto';

  return `
  <div dir="${_isRTL ? 'rtl' : 'ltr'}" class="space-y-6 font-sans text-neutral-800 ${containerClass} pb-8">

    <!-- ==================== TOP VARIANT & LOCALIZATION SWITCHER BAR ==================== -->
    <div class="bg-white rounded-xl border border-neutral-200/80 p-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-neutral-500 uppercase tracking-wider">${t.variantLabel}</span>
        <div class="flex items-center bg-neutral-100 p-0.5 rounded-lg text-xs">
          <button onclick="setDashboardVariant('manager')" class="px-3 py-1 rounded-md font-medium transition-all ${isMgr ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900'}">
            ${t.btnMgr}
          </button>
          <button onclick="setDashboardVariant('specialist')" class="px-3 py-1 rounded-md font-medium transition-all ${!isMgr ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900'}">
            ${t.btnSpec}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <!-- Arabic / English RTL Toggle -->
        <button onclick="toggleDashboardRTL()" class="btn btn-sm btn-secondary text-xs h-7 px-2.5 flex items-center gap-1.5 border-neutral-200 hover:border-neutral-300">
          <svg class="w-3.5 h-3.5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
          <span>${t.langToggle}</span>
        </button>

        <!-- Gym Scope Indicator -->
        <div class="flex items-center gap-1 bg-neutral-100 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-700">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>${u.gyms.length} ${isMgr ? (_isRTL ? 'فروع عامة' : 'Assigned Gyms') : (_isRTL ? 'فروع مصرحة' : 'Scoped Gyms')}</span>
        </div>
      </div>
    </div>

    <!-- ==================== HEADER ROW ==================== -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-xl font-bold text-neutral-900 tracking-tight">${t.greeting}</h1>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            ${t.roleBadge}
          </span>
        </div>
        <p class="text-xs text-neutral-500 mt-1">${t.subtitle}</p>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="exportMonthlyHRReport()" class="btn btn-sm btn-secondary text-xs h-8 px-3 shadow-xs flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>${_isRTL ? 'تصدير التقرير' : 'Export Report'}</span>
        </button>
      </div>
    </div>

    <!-- ==================== 1. SUMMARY CARDS ROW (ACTION-ORIENTED) ==================== -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      ${visibleCards.map(c => `
        <div onclick="${c.onClick}" class="bg-white rounded-lg border border-neutral-200/80 p-3.5 hover:border-emerald-600 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-neutral-500">${c.title}</span>
            <div class="w-7 h-7 rounded bg-neutral-50 flex items-center justify-center text-neutral-500 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${c.icon}"/></svg>
            </div>
          </div>
          <div class="mt-3">
            <p class="text-2xl font-bold text-neutral-900 leading-tight">${c.val}</p>
            <div class="flex items-center justify-between mt-1 text-[11px]">
              <span class="text-neutral-500 truncate">${c.sub}</span>
              ${c.actionTag ? `
                <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                  ${c.actionTag}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- ==================== 2. FOLLOW-UP / ALERTS FEED (ACTION REQUIRED) ==================== -->
    <div class="bg-white rounded-xl border border-neutral-200/80 overflow-hidden shadow-xs">
      
      <!-- Feed Header -->
      <div class="px-4 py-3 border-b border-neutral-150 bg-neutral-50/60 flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-bold text-neutral-900">${t.feedTitle}</h2>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
              ${visibleAlerts.length} ${_isRTL ? 'إجراء عاجل' : 'Urgent'}
            </span>
          </div>
          <p class="text-xs text-neutral-500 mt-0.5">${t.feedSub}</p>
        </div>

        <span class="text-xs text-neutral-400 font-medium hidden sm:inline-block">${_isRTL ? 'مرتبة حسب الأولوية' : 'Sorted by SLA priority'}</span>
      </div>

      <!-- Feed Rows -->
      <div class="divide-y divide-neutral-100">
        ${visibleAlerts.length === 0 ? `
          <div class="p-8 text-center text-xs text-neutral-400">
            ${_isRTL ? 'لا توجد إجراءات عاجلة معلقة في الوقت الحالي.' : 'All clear! No urgent action items pending.'}
          </div>
        ` : visibleAlerts.map(a => `
          <div class="p-4 hover:bg-neutral-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${a.badgeColor}">
                  ${a.badge}
                </span>
                <h3 class="text-xs font-bold text-neutral-900">${a.title}</h3>
                <span class="badge badge-gray text-[10px] font-medium">${a.gym}</span>
              </div>
              <p class="text-xs text-neutral-600 mt-1">${a.desc}</p>
            </div>

            <!-- Action Button -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <button onclick="${a.onClick}" class="btn btn-sm btn-primary text-xs h-8 px-3.5 font-semibold shadow-xs">
                ${a.actionBtn}
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="px-4 py-2 bg-neutral-50/50 border-t border-neutral-150 flex items-center justify-between text-xs text-neutral-400">
        <span>${_isRTL ? 'كل تنبيه يتيح المراجعة واتخاذ القرار الفوري بضغطة زر واحدة' : 'Every alert triggers an in-place operational modal for instant sign-off'}</span>
        <button onclick="navigateTo('requests')" class="text-emerald-700 hover:text-emerald-900 font-semibold">${_isRTL ? 'عرض جميع المعاملات ←' : 'View Full Operational Inbox →'}</button>
      </div>
    </div>

    <!-- ==================== 3. QUICK-LINK TILES INTO MODULES ==================== -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-neutral-900">${t.linksTitle}</h2>
          <p class="text-xs text-neutral-500">${t.linksSub}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
        ${visibleModules.map(m => `
          <div onclick="navigateTo('${m.id}')" class="bg-white rounded-lg border border-neutral-200/80 p-3.5 hover:border-emerald-600 hover:shadow-xs transition-all cursor-pointer group flex items-start gap-3">
            <div class="w-9 h-9 rounded bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-200 transition-colors flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${m.icon}"/></svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-neutral-900 group-hover:text-emerald-700 transition-colors truncate">${m.name}</p>
              <p class="text-[11px] text-neutral-500 mt-0.5 truncate">${m.sub}</p>
            </div>
            <svg class="w-3.5 h-3.5 text-neutral-300 group-hover:text-emerald-600 transition-colors self-center flex-shrink-0 ${_isRTL ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </div>
        `).join('')}
      </div>
    </div>

  </div>
  `;
}