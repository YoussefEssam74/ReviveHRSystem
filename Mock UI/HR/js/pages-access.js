// ==================== REPORTS & ANALYTICS ====================
let _repPeriod = '30d';
let _repTab = 'overview';
function setRepTab(t) { _repTab = t; renderAll(); }
function setRepPeriod(p) { _repPeriod = p; renderAll(); }

// ==================== REPORT PANEL DRILL-DOWN ====================
// Every bento panel on Reports & Analytics opens a detail modal built from the
// same snapshot the grid renders from (REPORT_DATA, refreshed on every
// renderReports call). The modal reuses the exact style vocabulary of the app —
// stat-tile KPIs, data-table rows, badge, bento-label, btn — so nothing about
// the grid's own look changes.
let REPORT_DATA = null;

function repCan(perm) { return DEMO.showAll || hasPermission(perm); }

// Compact money for KPI tiles: 145250 -> "145K"
function repMoneyK(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1e3) return Math.round(v / 1e3) + 'K';
  return String(v);
}

function repKpi(label, val, sub) {
  return `<div class="stat-tile px-2.5 py-2">
    <p class="text-sm font-extrabold text-charcoal-900 leading-none truncate" title="${val}">${val}</p>
    <p class="text-[9px] text-charcoal-500 mt-1 truncate">${label}</p>
    ${sub ? `<p class="text-[9px] text-charcoal-400 mt-1 truncate">${sub}</p>` : ''}
  </div>`;
}
function repKpiRow(items) { return `<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">${items.join('')}</div>`; }
function repSection(title) { return `<p class="bento-label text-charcoal-500 mt-3 mb-1.5">${title}</p>`; }
function repNote(html) { return `<p class="text-[10px] text-charcoal-400 leading-snug mt-2">${html}</p>`; }

function repTable(cols, rows, empty) {
  if (!rows.length) return `<p class="text-xs text-charcoal-400 text-center py-5">${empty || 'No records to show.'}</p>`;
  return `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
    <table class="data-table">
      <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

// Permission-gated footer/inline action button — renders nothing when denied.
function repAct(label, onclick, perm, cls) {
  if (perm && !repCan(perm)) return '';
  return `<button onclick="${onclick}" class="btn btn-sm ${cls || 'btn-secondary'}">${label}</button>`;
}

function resolveReportException(id) {
  if (!repCan('attendance.edit')) { showToast('Requires attendance.edit', 'error'); return; }
  const x = (MOCK.attendanceExceptions || []).find(e => e.id === id);
  if (!x) return;
  x.resolved = true;
  renderAll();
  showToast(`Exception ${id} resolved & audit-logged`);
}

function openReportPanel(key) {
  const D = REPORT_DATA;
  const def = D && REPORT_PANELS[key];
  if (!def) { showToast('Open Reports & Analytics to load panel data', 'info'); return; }
  const spec = def(D);
  openModal(spec.title, spec.body, {
    full: true,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>${spec.actions || ''}`,
  });
}

const REPORT_PANELS = {
  // ---------------- OVERVIEW ----------------
  'hc-gym': D => ({
    title: 'Headcount by Gym',
    body:
      repKpiRow([
        repKpi('Total headcount', D.headcount, `${D.topGyms.length} gyms`),
        repKpi('Largest gym', D.topGyms[0] ? D.topGyms[0].employees : 0, D.topGyms[0] ? D.topGyms[0].branch : '—'),
        repKpi('Directory', D.EMP.length, 'profiles loaded'),
        repKpi('Active', D.activeEmps, `${Math.round(D.activeEmps / mathMax(D.EMP.length, 1) * 100)}% of directory`),
      ]) +
      repTable(['Gym', 'Headcount', 'Share', 'Directory', 'Active', 'Flagged'],
        D.topGyms.map(g => {
          const recs = D.EMP.filter(e => e.gym === g.branch);
          const act = recs.filter(e => e.status === 'Active').length;
          return [g.branch, g.employees, `${Math.round(g.employees / mathMax(D.headcount, 1) * 100)}%`, recs.length, act, recs.length - act];
        })) +
      repNote('Headcount is the official branch roster; <b>Directory</b> counts the employee profiles loaded in this prototype.'),
    actions:
      repAct('Open Employees', "closeModal();navigateTo('employees')", 'employees.view', 'btn-primary') +
      repAct('Open Attendance', "closeModal();navigateTo('attendance')", 'attendance.view'),
  }),

  'att-trend': D => ({
    title: 'Attendance Trend',
    body:
      repKpiRow([
        repKpi('This week', D.attRate + '%', `${D.presentDays}/${D.scheduled} days`),
        repKpi('Punctuality', D.punctuality + '%', `${D.onTime} on time`),
        repKpi('Late', D.lateRecs, 'today'),
        repKpi('Absent', D.absentRecs, 'today'),
      ]) +
      repTable(['Week', 'Rate', 'Change'],
        D.attTrend.map((pct, i) => {
          const prev = i ? D.attTrend[i - 1] : null;
          const d = prev === null ? null : pct - prev;
          return [D.attDays[i], `${pct}%`, d === null ? '—' : `${d >= 0 ? '+' : ''}${d} pts`];
        })) +
      repNote('Rate = days worked ÷ days scheduled. “Off” days are not scheduled, so they are excluded from the denominator.'),
    actions:
      repAct('Open Attendance', "closeModal();navigateTo('attendance')", 'attendance.view', 'btn-primary') +
      repAct('Manual Entry', "closeModal();openManualEntry()", 'attendance.manual_entry'),
  }),

  'funnel': D => ({
    title: 'Recruitment Funnel',
    body:
      repKpiRow([
        repKpi('Applicants', D.CAN.length, 'total'),
        repKpi('Hired', D.hired, `${D.convRate}% conversion`),
        repKpi('Open vacancies', D.openVac.length, `${D.vacSlots} seats`),
        repKpi('Apps / vacancy', D.appsPerVac, 'average load'),
      ]) +
      repTable(['Stage', 'Candidates', '% of applicants', 'Drop-off'],
        D.funnel.map((f, i) => {
          const prev = i ? D.funnel[i - 1].n : f.n;
          return [f.stage, f.n, `${Math.round(f.n / mathMax(D.CAN.length, 1) * 100)}%`, i === 0 ? '—' : `${prev - f.n}`];
        })) +
      repNote('Stages are cumulative — a candidate is counted in every stage they have reached so far.'),
    actions:
      repAct('Open Recruitment', "closeModal();navigateTo('recruitment')", 'recruitment.view', 'btn-primary') +
      repAct('New Vacancy', "openNewVacancy()", 'recruitment.vacancies.manage'),
  }),

  'dept-mix': D => ({
    title: 'Department Mix',
    body:
      repKpiRow([
        repKpi('Departments', D.deptDist.length, 'role families'),
        repKpi('Mapped staff', D.deptTotal, 'across gyms'),
        repKpi('Largest', D.deptDist[0] ? D.deptDist[0].label : '—', D.deptDist[0] ? `${D.deptDist[0].val} staff` : ''),
        repKpi('Positions', D.POS.length, `${D.totalSlots} slots`),
      ]) +
      repTable(['Department', 'Headcount', 'Share', 'Positions', 'Slots'],
        D.deptDist.map(d => {
          const pos = D.POS.filter(p => p.department === d.label);
          return [d.label, d.val, `${Math.round(d.val / mathMax(D.deptTotal, 1) * 100)}%`, pos.length, pos.reduce((s, p) => s + p.headcount, 0)];
        })) +
      repNote('Department mix is derived from role families across all branches.'),
    actions:
      repAct('Open Positions', "closeModal();navigateTo('positions')", 'positions.view', 'btn-primary') +
      repAct('Open Employees', "closeModal();navigateTo('employees')", 'employees.view'),
  }),

  'req-vol': D => {
    const pend = D.REQ.filter(r => r.status === 'Pending HR Review');
    const types = [...new Set(D.REQ.map(r => r.type))];
    return {
      title: 'Request Volume',
      body:
        repKpiRow([
          repKpi('Pending', D.reqPending, 'awaiting HR review'),
          repKpi('Approved', D.reqApproved, `${D.reqRate}% approval rate`),
          repKpi('Rejected', D.reqRejected, 'final'),
          repKpi('Total', D.REQ.length, `${types.length} types`),
        ]) +
        repTable(['Type', 'Total', 'Pending', 'Approved', 'Rejected'],
          types.map(t => {
            const list = D.REQ.filter(r => r.type === t);
            return [t, list.length,
              list.filter(r => r.status === 'Pending HR Review').length,
              list.filter(r => r.status === 'Approved').length,
              list.filter(r => r.status === 'Rejected').length];
          })) +
        (pend.length
          ? repSection('NEEDS YOUR DECISION') +
            repTable(['Employee', 'Type', 'Gym', 'Requested for', 'Action'],
              pend.map(r => [r.employee, r.type, r.gym, r.requestedDate,
                repCan('requests.approve')
                  ? `<button onclick="openRequestDecision('${r.id}','approve')" class="btn btn-sm btn-primary">Review</button>`
                  : statusBadge(r.status)]))
          : repNote('Nothing is waiting for HR review.')),
      actions: repAct('Open Requests Inbox', "closeModal();navigateTo('requests')", 'requests.view', 'btn-primary'),
    };
  },

  'payroll-cost': D => {
    const pend = D.PAY.flatMap(p => (p.deductionLines || []).filter(l => l.status === 'Pending').map(l => ({ p, l })));
    return {
      title: 'Payroll Cost',
      body:
        repKpiRow([
          repKpi('Gross', repMoneyK(D.gross), 'per cycle'),
          repKpi('Net', repMoneyK(D.net), 'take-home'),
          repKpi('Deductions', repMoneyK(D.deds), `${Math.round(D.deds / mathMax(D.gross, 1) * 100)}% of gross`),
          repKpi('Overtime', D.otHrs + ' h', repMoneyK(D.otPay)),
        ]) +
        repTable(['Component', 'Amount', '% of gross'],
          [
            ['Gross pay', formatEGP(D.gross), '100%'],
            ['Deductions', formatEGP(D.deds), `${Math.round(D.deds / mathMax(D.gross, 1) * 100)}%`],
            [`Overtime (${D.otHrs} h)`, formatEGP(D.otPay), `${Math.round(D.otPay / mathMax(D.gross, 1) * 100)}%`],
            ['Net pay', formatEGP(D.net), `${Math.round(D.net / mathMax(D.gross, 1) * 100)}%`],
          ]) +
        (pend.length
          ? repSection(`PENDING DEDUCTIONS (${pend.length})`) +
            repTable(['Employee', 'Line', 'Amount', 'Action'],
              pend.map(({ p, l }) => [
                p.name, l.label, formatEGP(l.amount),
                repCan('payroll.edit')
                  ? `<span class="flex gap-1 justify-end">
                      <button onclick="decidePayrollDeduction('${p.employeeId}','${l.id}',true);openReportPanel('payroll-cost')" class="btn btn-sm btn-primary">Accept</button>
                      <button onclick="decidePayrollDeduction('${p.employeeId}','${l.id}',false);openReportPanel('payroll-cost')" class="btn btn-sm btn-danger-outline">Waive</button>
                    </span>`
                  : `<span class="badge badge-yellow">Pending</span>`,
              ]))
          : repNote('No deduction lines are waiting for a decision.')),
      actions: repAct('Open Payroll', "closeModal();navigateTo('payroll')", 'payroll.view', 'btn-primary'),
    };
  },

  // ---------------- WORKFORCE ----------------
  'hc-trend': D => ({
    title: 'Headcount Trend',
    body:
      repKpiRow([
        repKpi('Now', D.headcount, 'employees'),
        repKpi('YTD change', `+${D.headcount - D.headcountTrend[0]}`, `since ${D.hcMonths[0]}`),
        repKpi('Avg / month', `+${((D.headcount - D.headcountTrend[0]) / mathMax(D.headcountTrend.length - 1, 1)).toFixed(1)}`, 'net growth'),
        repKpi('Branches', D.topGyms.length, 'gyms'),
      ]) +
      repTable(['Month', 'Headcount', 'Change', 'Growth'],
        D.headcountTrend.map((hc, i) => {
          const prev = i ? D.headcountTrend[i - 1] : null;
          if (prev === null) return [D.hcMonths[i], hc, '—', '—'];
          const c = hc - prev;
          const g = Math.round((c / mathMax(prev, 1)) * 100);
          return [D.hcMonths[i], hc, `${c >= 0 ? '+' : ''}${c}`, `${g >= 0 ? '+' : ''}${g}%`];
        })),
    actions:
      repAct('Open Employees', "closeModal();navigateTo('employees')", 'employees.view', 'btn-primary') +
      repAct('Open Positions', "closeModal();navigateTo('positions')", 'positions.view'),
  }),

  'status-mix': D => {
    const flagged = D.EMP.filter(e => e.status !== 'Active');
    return {
      title: 'Status Mix',
      body:
        repKpiRow([
          repKpi('Active', D.byStatus.Active, `${Math.round(D.byStatus.Active / mathMax(D.EMP.length, 1) * 100)}%`),
          repKpi('On Leave', D.byStatus['On Leave'], 'away'),
          repKpi('Notice Period', D.byStatus['Notice Period'], 'departing'),
          repKpi('Attrition risk', D.attritionRisk, 'notice + suspended'),
        ]) +
        repTable(['Status', 'Employees', 'Share'],
          Object.entries(D.byStatus).map(([k, v]) => [k, v, `${Math.round(v / mathMax(D.EMP.length, 1) * 100)}%`])) +
        (flagged.length
          ? repSection('FLAGGED EMPLOYEES') +
            repTable(['Employee', 'Position', 'Gym', 'Status', 'Action'],
              flagged.map(e => [e.name, e.position, e.gym, statusBadge(e.status),
                repCan('employees.view')
                  ? `<button onclick="closeModal();openEmployeeProfile('${e.id}')" class="btn btn-sm btn-secondary">Profile</button>`
                  : '']))
          : ''),
      actions: repAct('Open Employees', "closeModal();navigateTo('employees')", 'employees.view', 'btn-primary'),
    };
  },

  'tenure': D => {
    const longest = [...D.EMP].sort((a, b) => new Date(a.hireDate) - new Date(b.hireDate)).slice(0, 5);
    return {
      title: 'Tenure Distribution',
      body:
        repKpiRow([
          repKpi('Avg tenure', D.avgTenure + ' mo', `${D.EMP.length} staff`),
          repKpi('2 yr +', D.tenureBuckets[3].val, 'longest serving'),
          repKpi('1 – 2 yr', D.tenureBuckets[2].val, 'established'),
          repKpi('< 6 mo', D.tenureBuckets[0].val, 'newest hires'),
        ]) +
        repTable(['Tenure bucket', 'Employees', 'Share'],
          D.tenureBuckets.map(b => [b.label, b.val, `${Math.round(b.val / mathMax(D.EMP.length, 1) * 100)}%`])) +
        repSection('LONGEST SERVING') +
        repTable(['Employee', 'Gym', 'Hired', 'Tenure'],
          longest.map(e => [e.name, e.gym, formatDate(e.hireDate), `${D.monthsSince(e.hireDate)} mo`])),
      actions: repAct('Open Employees', "closeModal();navigateTo('employees')", 'employees.view', 'btn-primary'),
    };
  },

  'level-mix': D => ({
    title: 'Level Mix',
    body:
      repKpiRow(D.byLevel.map(l => repKpi(l.label, l.val, `${Math.round(l.val / mathMax(D.EMP.length, 1) * 100)}% of staff`))) +
      repTable(['Level', 'Employees', 'Share', 'Avg salary'],
        D.byLevel.map(l => {
          const list = D.EMP.filter(e => e.level === l.label);
          const avg = list.length ? Math.round(list.reduce((s, e) => s + (e.salary || 0), 0) / list.length) : 0;
          return [l.label, l.val, `${Math.round(l.val / mathMax(D.EMP.length, 1) * 100)}%`, list.length ? formatEGP(avg) : '—'];
        })) +
      repNote('Average salary is calculated from the loaded employee profiles per level.'),
    actions:
      repAct('Open Positions', "closeModal();navigateTo('positions')", 'positions.view', 'btn-primary') +
      repAct('Open Employees', "closeModal();navigateTo('employees')", 'employees.view'),
  }),

  'fill-rates': D => ({
    title: 'Position Fill Rates',
    body:
      repKpiRow([
        repKpi('Approved slots', D.totalSlots, `${D.POS.length} positions`),
        repKpi('Filled', D.totalFilled, `${Math.round(D.totalFilled / mathMax(D.totalSlots, 1) * 100)}% fill`),
        repKpi('Open', D.totalSlots - D.totalFilled, 'seats to hire'),
        repKpi('Critical (< 80%)', D.posRows.filter(p => p.fill < 80).length, 'understaffed roles'),
      ]) +
      repTable(['Position', 'Department', 'Filled', 'Headcount', 'Open', 'Fill rate'],
        D.posRows.map(p => [
          p.title, p.department, p.active, p.headcount, p.open,
          `<span class="badge ${p.fill >= 95 ? 'badge-green' : p.fill >= 80 ? 'badge-yellow' : 'badge-red'}">${p.fill}%</span>`,
        ])) +
      repNote(`${D.totalFilled}/${D.totalSlots} slots filled across ${D.POS.length} positions.`),
    actions:
      repAct('Manage Positions', "closeModal();navigateTo('positions')", 'positions.manage', 'btn-primary') +
      repAct('Start Hiring', "closeModal();navigateTo('recruitment')", 'recruitment.view'),
  }),

  'offboarding': D => ({
    title: 'Offboarding Pipeline',
    body:
      repKpiRow([
        repKpi('Open exits', D.sepOpen, 'not completed'),
        repKpi('Total cases', D.SEP.length, 'in pipeline'),
        repKpi('Non-rehirable', D.banned, 'rehire banned'),
        repKpi('In notice', D.sepByStage[1].val, 'serving notice'),
      ]) +
      repTable(['Stage', 'Cases'], D.sepByStage.map(s => [s.label, s.val])) +
      repSection('CASES') +
      repTable(['Employee', 'Gym', 'Last day', 'Status', 'Action'],
        D.SEP.map(s => [s.employee, s.gym, formatDate(s.lastDay), statusBadge(s.status),
          repCan('employees.view')
            ? `<button onclick="closeModal();navigateTo('terminations');setTimeout(()=>openSeparation('${s.id}'),150)" class="btn btn-sm btn-secondary">Open</button>`
            : ''])),
    actions: repAct('Open Terminations', "closeModal();navigateTo('terminations')", 'employees.view', 'btn-primary'),
  }),

  // ---------------- ATTENDANCE & HIRING ----------------
  'today-att': D => ({
    title: "Today's Attendance Split",
    body:
      repKpiRow([
        repKpi('On time', D.onTime, `${Math.round(D.onTime / mathMax(D.REC.length, 1) * 100)}%`),
        repKpi('Late', D.lateRecs, 'needs review'),
        repKpi('Absent', D.absentRecs, 'no check-in'),
        repKpi('Off', D.offRecs, 'not scheduled'),
      ]) +
      repTable(['Employee', 'Gym', 'Shift', 'Check-in', 'Status', 'Action'],
        D.REC.map(r => [r.name, r.gym, r.shift, r.checkIn || '—', statusBadge(r.status),
          repCan('attendance.edit')
            ? `<button onclick="openAttendanceCorrection('${r.employeeId}')" class="btn btn-sm btn-secondary">Correct</button>`
            : ''])) +
      repNote(`${D.biometricPct}% captured via biometric · ${D.REC.length - D.REC.filter(r => r.source === 'Biometric').length} manual entries.`),
    actions:
      repAct('Open Attendance', "closeModal();navigateTo('attendance')", 'attendance.view', 'btn-primary') +
      repAct('Manual Entry', "closeModal();openManualEntry()", 'attendance.manual_entry'),
  }),

  'att-exceptions': D => ({
    title: 'Attendance Exceptions',
    body:
      repKpiRow([
        repKpi('Unresolved', D.EXP.length, 'requiring review'),
        repKpi('Exception types', D.exByType.length, 'categories'),
        repKpi('Top type', D.exByType[0] ? D.exByType[0].label : '—', D.exByType[0] ? `${D.exByType[0].val} cases` : ''),
        repKpi('Biometric', D.biometricPct + '%', 'capture rate'),
      ]) +
      repTable(['Date', 'Employee', 'Exception', 'Device', 'Action'],
        D.EXP.map(x => {
          const emp = D.EMP.find(e => e.id === x.employeeId);
          return [formatDate(x.date), emp ? emp.name : x.employeeId, x.exception, x.device,
            repCan('attendance.edit')
              ? `<button onclick="resolveReportException('${x.id}');openReportPanel('att-exceptions')" class="btn btn-sm btn-primary">Resolve</button>`
              : ''];
        }), 'No unresolved exceptions.') +
      repNote('Resolving marks the exception reviewed and audit-logged; the record stays in the attendance history.'),
    actions: repAct('Open Attendance', "closeModal();navigateTo('attendance')", 'attendance.view', 'btn-primary'),
  }),

  'open-vacs': D => ({
    title: 'Open Vacancies',
    body:
      repKpiRow([
        repKpi('Open vacancies', D.openVac.length, 'live postings'),
        repKpi('Seats to fill', D.vacSlots, 'headcount slots'),
        repKpi('Applicants', D.CAN.length, `${D.appsPerVac} per vacancy`),
        repKpi('High urgency', D.openVac.filter(v => v.urgency === 'High').length, 'priority roles'),
      ]) +
      repTable(['Position', 'Gym', 'Seats', 'Candidates', 'Urgency', 'Posted', 'Action'],
        D.openVac.map(v => [v.position, v.gym, v.headcount, v.candidates,
          `<span class="badge ${v.urgency === 'High' ? 'badge-red' : v.urgency === 'Medium' ? 'badge-yellow' : 'badge-gray'}">${v.urgency}</span>`,
          formatDate(v.createdDate),
          repCan('recruitment.view')
            ? `<button onclick="openVacancyDetail('${v.id}')" class="btn btn-sm btn-secondary">Pipeline</button>`
            : '']),
        'No open vacancies.'),
    actions:
      repAct('Open Recruitment', "closeModal();navigateTo('recruitment')", 'recruitment.view', 'btn-primary') +
      repAct('New Vacancy', "openNewVacancy()", 'recruitment.vacancies.manage'),
  }),

  'cand-stage': D => ({
    title: 'Candidates by Stage',
    body:
      repKpiRow([
        repKpi('Applicants', D.CAN.length, 'total'),
        repKpi('Hired', D.hired, `${D.convRate}% conversion`),
        repKpi('In interviews', D.CAN.filter(c => c.stage.includes('Interview')).length, 'active'),
        repKpi('Rejected', D.CAN.filter(c => c.stage === 'Rejected').length, 'closed'),
      ]) +
      repTable(['Stage', 'Candidates', '% of applicants'],
        D.funnel.map(f => [f.stage, f.n, `${Math.round(f.n / mathMax(D.CAN.length, 1) * 100)}%`])) +
      repSection('CANDIDATES') +
      repTable(['Name', 'Position', 'Stage', 'Rating', 'Action'],
        D.CAN.map(c => [c.name, c.position, c.stage, `${c.rating}/5`,
          repCan('recruitment.view')
            ? `<button onclick="openCandidateDetail('${c.id}')" class="btn btn-sm btn-secondary">Open</button>`
            : ''])),
    actions: repAct('Open Recruitment', "closeModal();navigateTo('recruitment')", 'recruitment.view', 'btn-primary'),
  }),

  'vac-reqs': D => {
    const vrs = MOCK.vacancyRequests || [];
    const canApprove = repCan('recruitment.vacancy_request.approve');
    return {
      title: 'Vacancy Requests',
      body:
        repKpiRow([
          repKpi('Pending', vrs.filter(v => v.status === 'Pending').length, 'awaiting decision'),
          repKpi('Approved', vrs.filter(v => v.status === 'Approved').length, 'vacancy opened'),
          repKpi('High urgency', vrs.filter(v => v.urgency === 'High').length, 'priority'),
          repKpi('Total', vrs.length, 'requests'),
        ]) +
        (vrs.length
          ? `<div class="space-y-2">${vrs.map(v => `
              <div class="bg-charcoal-50 rounded-lg px-3 py-2.5 border border-charcoal-200">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-charcoal-900 truncate">${v.position} — ${v.gym}</p>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <span class="badge ${v.urgency === 'High' ? 'badge-red' : v.urgency === 'Medium' ? 'badge-yellow' : 'badge-gray'} text-[9px]">${v.urgency}</span>
                    <span class="badge ${v.status === 'Pending' ? 'badge-yellow' : 'badge-green'} text-[9px]">${v.status}</span>
                  </div>
                </div>
                <p class="text-[10px] text-charcoal-500 mt-1">${v.reason || '—'}</p>
                <p class="text-[9px] text-charcoal-400 mt-0.5">Submitted by ${v.submittedBy} · ${formatDate(v.submittedDate)}</p>
                ${v.status === 'Pending' && canApprove ? `<div class="flex justify-end gap-1.5 mt-2">
                  <button onclick="openVacancyRequestModal('${v.id}')" class="btn btn-sm btn-secondary">Details</button>
                  <button onclick="rejectVacancyRequest('${v.id}');openReportPanel('vac-reqs')" class="btn btn-sm btn-danger-outline">Decline</button>
                  <button onclick="approveVacancyRequest('${v.id}');openReportPanel('vac-reqs')" class="btn btn-sm btn-primary">Approve</button>
                </div>` : ''}
              </div>`).join('')}</div>`
          : `<p class="text-xs text-charcoal-400 text-center py-6">No vacancy requests.</p>`),
      actions: repAct('Open Recruitment', "closeModal();navigateTo('recruitment')", 'recruitment.view', 'btn-primary'),
    };
  },

  'punctuality': D => {
    const worked = D.REC.filter(r => ['On Time', 'Late', 'Absent'].includes(r.status));
    return {
      title: 'Punctuality Score',
      body:
        repKpiRow([
          repKpi('Punctuality', D.punctuality + '%', `${D.onTime} of ${D.presentDays} on time`),
          repKpi('On time', D.onTime, 'today'),
          repKpi('Late', D.lateRecs, 'today'),
          repKpi('Absent', D.absentRecs, 'today'),
        ]) +
        `<div class="bg-white rounded-xl border border-charcoal-200 px-3 py-2.5">
          <div class="flex items-center justify-between mb-1.5">
            <p class="bento-label text-charcoal-500">TODAY'S SCORE</p>
            <p class="text-lg font-extrabold ${D.punctuality >= 90 ? 'text-emerald-600' : D.punctuality >= 75 ? 'text-amber-600' : 'text-red-600'} leading-none">${D.punctuality}%</p>
          </div>
          <div class="w-full h-1.5 bg-charcoal-100 rounded-full overflow-hidden">
            <div class="h-full ${D.punctuality >= 90 ? 'bg-emerald-500' : D.punctuality >= 75 ? 'bg-amber-400' : 'bg-red-500'} rounded-full" style="width:${D.punctuality}%"></div>
          </div>
          <p class="text-[9px] text-charcoal-400 mt-1.5">Punctuality = on-time check-ins ÷ worked days (${D.presentDays} worked).</p>
        </div>` +
        repSection('LATE / ABSENT TODAY') +
        repTable(['Employee', 'Gym', 'Shift', 'Check-in', 'Status', 'Action'],
          worked.filter(r => r.status !== 'On Time').map(r => [r.name, r.gym, r.shift, r.checkIn || '—', statusBadge(r.status),
            repCan('attendance.edit')
              ? `<button onclick="openAttendanceCorrection('${r.employeeId}')" class="btn btn-sm btn-secondary">Correct</button>`
              : '']),
          'Everyone checked in on time today.'),
      actions:
        repAct('Open Attendance', "closeModal();navigateTo('attendance')", 'attendance.view', 'btn-primary') +
        repAct('Manual Entry', "closeModal();openManualEntry()", 'attendance.manual_entry'),
    };
  },
};

function renderReports() {
  const canView = DEMO.showAll || hasPermission('reports.view');
  if (!canView) return `<div class="space-y-3"><h1 class="text-base font-bold text-charcoal-900">Reports & Analytics</h1><div class="bg-white rounded-xl border border-charcoal-200 p-6 text-center"><p class="text-xs text-charcoal-500">You do not have permission to view reports (<code>reports.view</code>).</p></div></div>`;

  const EMP = MOCK.employees || [];
  const REC = MOCK.attendanceRecords || [];
  const EXP = (MOCK.attendanceExceptions || []).filter(x => !x.resolved);
  const REQ = MOCK.requests || [];
  const CAN = MOCK.candidates || [];
  const POS = MOCK.positions || [];
  const PAY = MOCK.payrollItems || [];
  const VAC = MOCK.vacancies || [];
  const SEP = MOCK.separations || [];
  const REF = new Date('2026-09-09');   // matches the mock "today"

  // ---------- Headcount ----------
  const headcount = MOCK.gymList.reduce((s, g) => s + g.employees, 0);
  const byStatus = {
    Active: EMP.filter(e => e.status === 'Active').length,
    'On Leave': EMP.filter(e => e.status === 'On Leave').length,
    'Notice Period': EMP.filter(e => e.status === 'Notice Period').length,
    Suspended: EMP.filter(e => e.status === 'Suspended').length,
  };
  const activeEmps = byStatus.Active;
  const attritionRisk = byStatus['Notice Period'] + byStatus.Suspended;

  // ---------- Attendance ----------
  const cRec = st => REC.filter(r => r.status === st).length;
  const onTime = cRec('On Time'), lateRecs = cRec('Late'), absentRecs = cRec('Absent'), offRecs = cRec('Off');
  // Attendance rate = days actually worked ÷ days actually scheduled.
  // "Off" days are not scheduled, so they must not drag the rate down.
  const scheduled = REC.length - offRecs;
  const presentDays = onTime + lateRecs;
  const attRate = Math.round((presentDays / mathMax(scheduled, 1)) * 100);
  const punctuality = Math.round((onTime / mathMax(presentDays, 1)) * 100);
  const attTrend = [88, 91, 84, 93, 76, 89, attRate];
  const attDays = ['W1','W2','W3','W4','W5','W6','Now'];

  const exByType = Object.entries(EXP.reduce((a, x) => { a[x.exception] = (a[x.exception] || 0) + 1; return a; }, {}))
    .map(([label, val]) => ({ label, val }))
    .sort((a, b) => b.val - a.val);
  const exMax = mathMax(...exByType.map(x => x.val), 1);
  const biometricPct = Math.round((REC.filter(r => r.source === 'Biometric').length / mathMax(REC.length, 1)) * 100);

  // ---------- Payroll cost ----------
  const gross = PAY.reduce((s, p) => s + (p.gross || 0), 0);
  const deds = PAY.reduce((s, p) => s + (p.deductions || 0), 0);
  const net = PAY.reduce((s, p) => s + (p.net || 0), 0);
  const otHrs = PAY.reduce((s, p) => s + (p.overtime || 0), 0);
  const otPay = PAY.reduce((s, p) => s + (p.overtime || 0) * 60, 0); // 1 EGP/hr → 60 EGP/hr assumed rate
  const pendingDeds = PAY.flatMap(p => p.deductionLines || []).filter(l => l.status === 'Pending');
  const pendingDedsAmt = pendingDeds.reduce((s, l) => s + (l.amount || 0), 0);
  const pendingPayroll = PAY.filter(p => p.status === 'Pending HR Review' || p.status === 'Draft').length;

  // ---------- Tenure buckets (derived from real hire dates) ----------
  const monthsSince = d => Math.max(0, Math.round((REF - new Date(d)) / 2629800000));
  const tenureBuckets = [
    { label: '< 6 mo',  test: m => m < 6,    color: '#94a3b8' },
    { label: '6–12 mo', test: m => m >= 6 && m < 12,  color: '#d97706' },
    { label: '1–2 yr',  test: m => m >= 12 && m < 24, color: '#2563eb' },
    { label: '2 yr+',   test: m => m >= 24,  color: '#006c49' },
  ].map(b => ({ ...b, val: EMP.filter(e => b.test(monthsSince(e.hireDate))).length }));
  const avgTenure = Math.round(EMP.reduce((s, e) => s + monthsSince(e.hireDate), 0) / mathMax(EMP.length, 1));
  const tenureMax = mathMax(...tenureBuckets.map(t => t.val), 1);

  // ---------- Levels / positions ----------
  const levelOrder = ['Junior', 'Mid', 'Senior', 'Manager'];
  const byLevel = levelOrder.map(l => ({ label: l, val: EMP.filter(e => e.level === l).length }));
  const levelMax = mathMax(...byLevel.map(l => l.val), 1);
  const posRows = POS.map(p => ({ ...p, open: mathMax(p.headcount - p.active, 0), fill: Math.round((p.active / mathMax(p.headcount, 1)) * 100) }))
    .sort((a, b) => a.fill - b.fill);
  const totalSlots = POS.reduce((s, p) => s + p.headcount, 0);
  const totalFilled = POS.reduce((s, p) => s + p.active, 0);

  // ---------- Requests ----------
  const reqByType = ['Day Off', 'Leave Early', 'Late Arrival', 'Shift Swap'].map(t => ({ label: t, val: REQ.filter(r => r.type === t).length }));
  const reqMax = mathMax(...reqByType.map(r => r.val), 1);
  const reqPending = REQ.filter(r => r.status === 'Pending HR Review').length;
  const reqApproved = REQ.filter(r => r.status === 'Approved').length;
  const reqRejected = REQ.filter(r => r.status === 'Rejected').length;
  const reqRate = Math.round((reqApproved / mathMax(REQ.length, 1)) * 100);

  // ---------- Recruiting ----------
  const order = ['Applied','Screening','First Interview','Second Interview','Accepted','Hired'];
  const atLeast = stage => CAN.filter(c => order.indexOf(c.stage) >= order.indexOf(stage)).length;
  const funnel = order.map(s => ({ stage: s, n: atLeast(s) }));
  const funnelMax = mathMax(...funnel.map(f => f.n), 1);
  const hired = funnel[funnel.length - 1].n;
  const convRate = Math.round((hired / mathMax(CAN.length, 1)) * 100);
  const openVac = VAC.filter(v => v.status === 'Open');
  const vacSlots = openVac.reduce((s, v) => s + (v.headcount || 0), 0);
  const appsPerVac = Math.round(CAN.length / mathMax(openVac.length, 1));

  // ---------- Offboarding ----------
  const sepStages = ['Requested', 'Notice Period', 'Exit In Progress', 'Under Review', 'Completed'];
  const sepByStage = sepStages.map((s, i) => ({ label: s, val: SEP.filter(x => x.status === s).length, color: ['#7c3aed','#2563eb','#d97706','#ea580c','#16a34a'][i] }));
  const sepOpen = SEP.filter(s => s.status !== 'Completed').length;
  const banned = SEP.filter(s => s.verdict && s.verdict.rehire && /banned/i.test(s.verdict.rehire.status)).length;

  // ---------- Department mix (conic gradient built CORRECTLY) ----------
  const deptDist = [
    { label: 'Training',  val: 58, color: '#006c49' },
    { label: 'Front Desk', val: 24, color: '#2563eb' },
    { label: 'Facilities',  val: 22, color: '#d97706' },
    { label: 'Management', val: 4,  color: '#7c3aed' },
  ];
  const deptTotal = deptDist.reduce((s, d) => s + d.val, 0);
  let acc = 0;
  // each stop must be "<color> <start>% <end>%" — joining objects was the old bug
  const donutStops = deptDist.map(d => {
    const start = acc;
    acc += (d.val / deptTotal) * 100;
    return `${d.color} ${start.toFixed(1)}% ${acc.toFixed(1)}%`;
  }).join(', ');

  const headcountTrend = [128, 131, 134, 137, 139, 141, headcount];
  const hcMonths = ['Mar','Apr','May','Jun','Jul','Aug','Now'];
  const topGyms = [...MOCK.gymList].sort((a, b) => b.employees - a.employees);

  // ---------- Render helpers ----------
  // PANEL_OPEN is a prefix (no closing ">") so panel() can append the
  // click-to-open attributes while the split at the bottom still matches.
  const PANEL_OPEN = '<div class="bg-white rounded-xl border border-charcoal-200 flex flex-col min-h-0 overflow-hidden';
  const panel = (title, body, right = '', key = '') => `${PANEL_OPEN}${key ? ' cursor-pointer hover:border-brand-300 hover:shadow-sm transition' : ''}"${key ? ` onclick="openReportPanel('${key}')"` : ''} title="${key ? 'Click for details & actions' : ''}">
    <div class="px-3 py-1.5 border-b border-charcoal-100 bg-charcoal-50/50 flex items-center justify-between gap-2 flex-shrink-0">
      <p class="bento-label truncate">${title}</p>${right}
    </div>
    <div class="p-2.5 flex-1 min-h-0 overflow-y-auto">${body}</div>
  </div>`;

  const bar = (label, val, maxVal, color = 'bg-brand-500', right = '') => `<div>
    <div class="flex items-center justify-between text-[9px] leading-tight mb-0.5">
      <span class="text-charcoal-600 truncate">${label}</span>
      <span class="text-charcoal-800 font-semibold ml-2 flex-shrink-0">${right || val}</span>
    </div>
    <div class="w-full h-1 bg-charcoal-100 rounded-full overflow-hidden">
      <div class="h-full ${color} rounded-full" style="width:${Math.round((val / mathMax(maxVal, 1)) * 100)}%"></div>
    </div>
  </div>`;

  // Compact footnote used at the bottom of several panels.
  const note = html => `<p class="text-[9px] text-charcoal-400 leading-snug mt-1.5 pt-1.5 border-t border-charcoal-100">${html}</p>`;

  // Compact money for tight KPI tiles: 145,250 -> "145K"
  const moneyK = n => {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(v) >= 1e3) return Math.round(v / 1e3) + 'K';
    return String(v);
  };

  const kpi = (label, val, sub, icon, tint, accent, size) => `<div class="stat-tile ${accent ? 'stat-tile-accent' : ''} px-2.5 py-2">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-lg ${tint[0]} flex items-center justify-center flex-shrink-0">
        <svg class="w-3.5 h-3.5 ${tint[1]}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg>
      </div>
      <div class="min-w-0">
        <p class="${size || 'text-base'} font-extrabold text-charcoal-900 leading-none truncate" title="${val}">${val}</p>
        <p class="text-[9px] text-charcoal-500 mt-0.5 truncate">${label}</p>
      </div>
    </div>
    <p class="text-[9px] text-charcoal-400 mt-1 truncate">${sub}</p>
  </div>`;

  const T = { brand:['bg-brand-100','text-brand-600'], green:['bg-green-100','text-green-600'], blue:['bg-blue-100','text-blue-600'], red:['bg-red-100','text-red-600'], amber:['bg-amber-100','text-amber-600'], purple:['bg-purple-100','text-purple-600'] };
  const ICON = {
    users:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    check:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    chart:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    money:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    warn:'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
    clock:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    briefcase:'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    trend:'M13 7h8m0 0v8m0-8L11 3M4 17V7a2 2 0 012-2h3m4 12h6',
  };

  // ---------- Views ----------
  const viewOverview = () => `
    ${panel('HEADCOUNT BY GYM', topGyms.map(g => bar(g.branch, g.employees, headcount, 'bg-brand-500', `${g.employees} · ${Math.round(g.employees/headcount*100)}%`)).join('')
      + `<div class="border-t border-charcoal-100 pt-1.5 mt-1.5 flex items-center justify-between text-[10px]"><span class="font-semibold text-charcoal-800">Total</span><span class="font-bold text-brand-700">${headcount}</span></div>`, '', 'hc-gym')}
    ${panel('ATTENDANCE TREND', `<div class="flex items-end gap-1.5 h-full min-h-[100px]">
        ${attTrend.map((pct, i) => `<div class="flex-1 flex flex-col items-center gap-1 justify-end h-full">
          <span class="text-[8px] text-charcoal-400">${pct}%</span>
          <div class="w-full rounded-t ${i === attTrend.length - 1 ? 'bg-brand-500' : 'bg-brand-200'}" style="height:${pct}%"></div>
          <span class="text-[8px] text-charcoal-400">${attDays[i]}</span>
        </div>`).join('')}
      </div>`, `<span class="badge badge-brand text-[9px]">${attRate}% · ${presentDays}/${scheduled} days</span>`, 'att-trend')}
    ${panel('RECRUITMENT FUNNEL', funnel.map(f => bar(f.stage, f.n, funnelMax, 'bg-purple-400', `${f.n} · ${Math.round(f.n/mathMax(CAN.length,1)*100)}%`)).join(''),
      `<span class="badge badge-gray text-[9px]">${convRate}% convert</span>`, 'funnel')}
    ${panel('DEPARTMENT MIX', `<div class="flex items-center gap-3 h-full">
        <div class="relative w-24 h-24 rounded-full flex-shrink-0" style="background:conic-gradient(${donutStops})">
          <div class="absolute inset-[14px] bg-white rounded-full flex flex-col items-center justify-center">
            <p class="text-sm font-extrabold text-charcoal-900 leading-none">${deptTotal}</p>
            <p class="text-[8px] text-charcoal-400 mt-0.5">total</p>
          </div>
        </div>
        <div class="space-y-1.5 flex-1 min-w-0">${deptDist.map(d => `<div class="flex items-center gap-1.5 text-[10px]">
          <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${d.color}"></span>
          <span class="text-charcoal-600 flex-1 truncate">${d.label}</span>
          <span class="font-bold text-charcoal-900">${d.val}</span>
          <span class="text-charcoal-400 w-8 text-right">${Math.round(d.val/deptTotal*100)}%</span>
        </div>`).join('')}</div>
      </div>`, '', 'dept-mix')}
    ${panel('REQUEST VOLUME', reqByType.map(r => bar(r.label, r.val, reqMax, 'bg-blue-500')).join('')
      + `<div class="grid grid-cols-3 gap-1.5 mt-1.5 pt-1.5 border-t border-charcoal-100 text-center leading-none">
          <div><p class="text-xs font-bold text-yellow-600">${reqPending}</p><p class="text-[9px] text-charcoal-400 mt-0.5">Pending</p></div>
          <div><p class="text-xs font-bold text-emerald-600">${reqApproved}</p><p class="text-[9px] text-charcoal-400 mt-0.5">Approved</p></div>
          <div><p class="text-xs font-bold text-red-600">${reqRejected}</p><p class="text-[9px] text-charcoal-400 mt-0.5">Rejected</p></div>
        </div>`, `<span class="badge badge-gray text-[9px]">${reqRate}% approved</span>`, 'req-vol')}
    ${panel('PAYROLL COST', `
        <div class="grid grid-cols-2 gap-1.5">
          <div class="bg-charcoal-50 rounded-lg px-2 py-1.5 leading-none"><p class="text-[9px] text-charcoal-400">Gross</p><p class="text-xs font-bold text-charcoal-900 mt-0.5">${formatEGP(gross)}</p></div>
          <div class="bg-charcoal-50 rounded-lg px-2 py-1.5 leading-none"><p class="text-[9px] text-charcoal-400">Net</p><p class="text-xs font-bold text-brand-700 mt-0.5">${formatEGP(net)}</p></div>
          <div class="bg-charcoal-50 rounded-lg px-2 py-1.5 leading-none"><p class="text-[9px] text-charcoal-400">Deductions</p><p class="text-xs font-bold text-orange-600 mt-0.5">${formatEGP(deds)}</p></div>
          <div class="bg-charcoal-50 rounded-lg px-2 py-1.5 leading-none"><p class="text-[9px] text-charcoal-400">Overtime</p><p class="text-xs font-bold text-charcoal-900 mt-0.5">${otHrs} h</p></div>
        </div>
        ${note(`Deductions are <strong class="text-orange-600">${Math.round(deds/mathMax(gross,1)*100)}%</strong> of gross · <strong class="text-orange-600">${pendingDeds.length}</strong> line${pendingDeds.length===1?'':'s'} (${formatEGP(pendingDedsAmt)}) await approval`)}`, '', 'payroll-cost')}
  `;

  const viewWorkforce = () => `
    ${panel('HEADCOUNT TREND', `<div class="flex items-end gap-1.5 h-full min-h-[100px]">
        ${headcountTrend.map((hc, i) => `<div class="flex-1 flex flex-col items-center gap-1 justify-end h-full">
          <span class="text-[8px] text-charcoal-400">${hc}</span>
          <div class="w-full rounded-t bg-blue-400" style="height:${Math.round((hc / mathMax(headcount, 1)) * 100)}%"></div>
          <span class="text-[8px] text-charcoal-400">${hcMonths[i]}</span>
        </div>`).join('')}
      </div>`, `<span class="badge badge-blue text-[9px]">+${headcount - headcountTrend[0]} YTD</span>`, 'hc-trend')}
    ${panel('STATUS MIX', Object.entries(byStatus).map(([k, v]) =>
        bar(k, v, mathMax(...Object.values(byStatus), 1),
          k === 'Active' ? 'bg-emerald-500' : k === 'On Leave' ? 'bg-amber-400' : k === 'Notice Period' ? 'bg-orange-500' : 'bg-red-500', `${v} · ${Math.round(v/mathMax(EMP.length,1)*100)}%`)
      ).join('')
      + note(`<strong class="text-red-600">${attritionRisk}</strong> employee${attritionRisk===1?'':'s'} flagged for attrition risk (notice + suspended)`), '', 'status-mix')}
    ${panel('TENURE DISTRIBUTION', tenureBuckets.map(t => bar(t.label, t.val, tenureMax, '', t.val)).join('')
      + note(`Average tenure <strong class="text-charcoal-700">${avgTenure} months</strong> across ${EMP.length} staff`), '', 'tenure')}
    ${panel('LEVEL MIX', byLevel.map(l => bar(l.label, l.val, levelMax, 'bg-brand-500', `${l.val} · ${Math.round(l.val/mathMax(EMP.length,1)*100)}%`)).join(''), '', 'level-mix')}
    ${panel('POSITION FILL RATES', posRows.map(p => {
        const c = p.fill >= 95 ? 'bg-emerald-500' : p.fill >= 80 ? 'bg-amber-400' : 'bg-red-400';
        return bar(p.title, p.fill, 100, c, `${p.active}/${p.headcount} · ${p.open} open`);
      }).join('')
      + note(`${totalFilled}/${totalSlots} slots filled · <strong class="text-amber-600">${totalSlots-totalFilled} open</strong> across ${POS.length} positions`), '', 'fill-rates')}
    ${panel('OFFBOARDING PIPELINE', sepByStage.map(s => bar(s.label, s.val, mathMax(...sepByStage.map(x=>x.val), 1), '', s.val)).join('')
      + note(`<strong class="text-charcoal-700">${sepOpen}</strong> open exit${sepOpen===1?'':'s'} · <strong class="text-red-600">${banned}</strong> marked non-rehirable`), '', 'offboarding')}
  `;

  const viewHiring = () => `
    ${panel('TODAY\'S ATTENDANCE SPLIT', ['On Time','Late','Absent','Off'].map((s, i) => {
        const v = [onTime, lateRecs, absentRecs, offRecs][i];
        return bar(s, v, mathMax(...[onTime, lateRecs, absentRecs, offRecs], 1),
          ['bg-emerald-500','bg-amber-400','bg-red-500','bg-charcoal-300'][i], v);
      }).join('')
      + note(`${biometricPct}% captured via biometric · ${REC.length - REC.filter(r=>r.source==='Biometric').length} manual`), '', 'today-att')}
    ${panel('ATTENDANCE EXCEPTIONS', exByType.map(x => bar(x.label, x.val, exMax, 'bg-red-400', x.val)).join('')
      + note(`<strong class="text-red-600">${EXP.length}</strong> unresolved exception${EXP.length===1?'':'s'} requiring review`), '', 'att-exceptions')}
    ${panel('OPEN VACANCIES', openVac.length ? openVac.map(v => bar(`${v.position} — ${v.gym}`, v.candidates, mathMax(...openVac.map(x=>x.candidates), 1),
        v.urgency === 'High' ? 'bg-red-400' : v.urgency === 'Medium' ? 'bg-amber-400' : 'bg-blue-400', `${v.candidates} apps`)).join('')
        : '<p class="text-[10px] text-charcoal-400 text-center py-4">No open vacancies</p>',
        `<span class="badge badge-gray text-[9px]">${vacSlots} slots</span>`, 'open-vacs')}
    ${panel('CANDIDATES BY STAGE', funnel.map(f => bar(f.stage, f.n, funnelMax, 'bg-purple-400', f.n)).join(''),
      `<span class="badge badge-gray text-[9px]">${CAN.length} · ${hired} hired</span>`, 'cand-stage')}
    ${panel('VACANCY REQUESTS', (MOCK.vacancyRequests || []).map(v => `
        <div class="bg-charcoal-50 rounded-lg px-2 py-1.5 mb-1">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[10px] font-semibold text-charcoal-900 truncate">${v.position} — ${v.gym}</p>
            <div class="flex items-center gap-1 flex-shrink-0">
              <span class="badge ${v.urgency === 'High' ? 'badge-red' : v.urgency === 'Medium' ? 'badge-yellow' : 'badge-gray'} text-[8px]">${v.urgency || 'Normal'}</span>
              <span class="badge ${v.status === 'Pending' ? 'badge-yellow' : 'badge-green'} text-[8px]">${v.status}</span>
            </div>
          </div>
          <p class="text-[9px] text-charcoal-500 mt-0.5 truncate">${v.reason || '—'}</p>
          <p class="text-[9px] text-charcoal-400 mt-0.5">${v.submittedBy || 'Branch Manager'}</p>
        </div>`).join('') || '<p class="text-[10px] text-charcoal-400 text-center py-4">No pending requests</p>', '', 'vac-reqs')}
    ${panel('PUNCTUALITY SCORE', `<div class="text-center py-0.5">
          <p class="text-3xl font-extrabold ${punctuality >= 90 ? 'text-emerald-600' : punctuality >= 75 ? 'text-amber-600' : 'text-red-600'} leading-none">${punctuality}%</p>
          <p class="text-[9px] text-charcoal-400 mt-1">of ${presentDays} worked days on time</p>
        </div>
        <div class="w-full h-1.5 bg-charcoal-100 rounded-full overflow-hidden mt-2">
          <div class="h-full ${punctuality >= 90 ? 'bg-emerald-500' : punctuality >= 75 ? 'bg-amber-400' : 'bg-red-500'} rounded-full" style="width:${punctuality}%"></div>
        </div>
        <div class="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-charcoal-100 text-center leading-none">
          <div><p class="text-xs font-bold text-emerald-600">${onTime}</p><p class="text-[9px] text-charcoal-400 mt-0.5">On time</p></div>
          <div><p class="text-xs font-bold text-amber-600">${lateRecs}</p><p class="text-[9px] text-charcoal-400 mt-0.5">Late</p></div>
          <div><p class="text-xs font-bold text-red-600">${absentRecs}</p><p class="text-[9px] text-charcoal-400 mt-0.5">Absent</p></div>
        </div>`, '', 'punctuality')}
  `;

  // Snapshot for the drill-down modals (openReportPanel). Refreshed on every
  // render so action buttons always see the latest mock data.
  REPORT_DATA = { EMP, REC, EXP, REQ, CAN, POS, PAY, VAC, SEP, headcount, byStatus, activeEmps, attritionRisk,
    onTime, lateRecs, absentRecs, offRecs, scheduled, presentDays, attRate, punctuality, attTrend, attDays,
    exByType, exMax, biometricPct, gross, deds, net, otHrs, otPay, pendingDeds, pendingDedsAmt, pendingPayroll,
    monthsSince, tenureBuckets, avgTenure, byLevel, posRows, totalSlots, totalFilled,
    reqByType, reqMax, reqPending, reqApproved, reqRejected, reqRate,
    funnel, funnelMax, hired, convRate, openVac, vacSlots, appsPerVac,
    sepStages, sepByStage, sepOpen, banned, deptDist, deptTotal,
    headcountTrend, hcMonths, topGyms };

  const views = { overview: viewOverview, workforce: viewWorkforce, hiring: viewHiring };
  // Each view emits 6 panels. panel() is never nested, so splitting on its
  // opening-tag prefix safely recovers the individual panels for the 2x3 grid.
  const panels = (views[_repTab] || viewOverview)()
    .split(PANEL_OPEN).filter(s => s.trim()).map(s => PANEL_OPEN + s);

  const kpis = [
    kpi('Headcount', headcount, `across ${MOCK.gymList.length} gyms`, ICON.users, T.brand, true),
    kpi('Active', activeEmps, `${Math.round(activeEmps/mathMax(EMP.length,1)*100)}% of staff`, ICON.check, T.green),
    kpi('Attendance', attRate + '%', `${punctuality}% punctuality`, ICON.chart, T.blue),
    kpi('Payroll / mo', 'EGP ' + moneyK(gross), `${moneyK(net)} net · ${otHrs} h OT`, ICON.money, T.purple, false, 'text-sm'),
    kpi('Attrition Risk', attritionRisk, `${byStatus['Notice Period']} notice · ${byStatus.Suspended} susp.`, ICON.warn, T.red),
    kpi('Open Roles', openVac.length, `${vacSlots} seats to fill`, ICON.briefcase, T.amber),
    kpi('Avg Tenure', avgTenure + ' mo', `${tenureBuckets[tenureBuckets.length-1].val} senior 2yr+`, ICON.clock, T.brand),
    kpi('Pending Reqs', reqPending, `${pendingDeds.length} payroll deductions`, ICON.trend, T.blue),
  ];

  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'workforce', label: 'Workforce' },
    { id: 'hiring',    label: 'Attendance & Hiring' },
  ];

  return `<div class="flex flex-col h-full min-h-0 gap-2">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
      <div><h1 class="text-base font-bold text-charcoal-900 leading-tight">Reports &amp; Analytics</h1>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Live from ${EMP.length} employees · ${REQ.length} requests · ${CAN.length} candidates</p></div>
      <div class="flex items-center gap-1.5">
        <select onchange="setRepPeriod(this.value)" class="form-select w-auto" style="padding:0.3125rem 2rem 0.3125rem 0.5rem;font-size:0.75rem">
          <option value="30d" ${_repPeriod==='30d'?'selected':''}>Last 30 days</option>
          <option value="90d" ${_repPeriod==='90d'?'selected':''}>Last 90 days</option>
          <option value="ytd" ${_repPeriod==='ytd'?'selected':''}>Year to date</option>
        </select>
        <button onclick="showToast('Report exported as CSV')" class="btn btn-sm btn-secondary h-7 px-2 text-[11px]"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Export</button>
      </div>
    </div>

    <!-- KPI strip: 8 compact tiles, one row -->
    <div class="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-1.5 flex-shrink-0">${kpis.join('')}</div>

    <!-- Tab strip -->
    <div class="flex items-center gap-1 border-b border-charcoal-200 flex-shrink-0">
      ${tabs.map(t => `<button onclick="setRepTab('${t.id}')" class="px-3 py-1.5 text-[11px] font-semibold rounded-t-lg transition-colors ${_repTab===t.id ? 'bg-brand-600 text-white' : 'text-charcoal-500 hover:bg-charcoal-100'}">${t.label}</button>`).join('')}
    </div>

    <!-- 2 rows x 3 panels; each row flexes to share the available height -->
    <div class="grid grid-rows-2 gap-2 flex-1 min-h-0">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 min-h-0">${panels.slice(0, 3).join('')}</div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 min-h-0">${panels.slice(3, 6).join('')}</div>
    </div>
  </div>`;
}

// ==================== POSITIONS & LEVELS ====================
function renderPositions() {
  const canManage = DEMO.showAll || hasPermission('positions.manage');
  const positions = MOCK.positions;
  const totalOpen = positions.reduce((s, p) => s + Math.max(0, p.headcount - p.active), 0);
  return `<div class="space-y-2.5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div><h1 class="text-base font-bold text-charcoal-900">Positions & Levels</h1><p class="text-xs text-charcoal-500 mt-0.5">${positions.length} positions · ${positions.reduce((s, p) => s + p.headcount, 0)} headcount slots · ${totalOpen} currently open</p></div>
      ${canManage ? `<button onclick="showToast('Position creation — simulated')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Position</button>` : ''}
    </div>
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <table class="data-table">
        <thead class="sticky top-0 z-10 bg-[#f9f9ff]"><tr><th>Position</th><th>Department</th><th>Levels</th><th>Created</th><th>Filled</th><th>Open</th><th>Fill rate</th><th></th></tr></thead>
      <tbody>${positions.map(p => {
        const fill = Math.round((p.active / mathMax(p.headcount, 1)) * 100);
        const open = p.headcount - p.active;
        return `<tr>
          <td class="text-xs font-medium text-charcoal-900">${p.title}</td>
          <td class="text-xs"><span class="badge badge-gray text-[9px]">${p.department}</span></td>
          <td class="text-[10px]">${p.levels.map(l => `<span class="badge badge-brand text-[9px]">${l}</span>`).join(' ')}</td>
          <td class="text-xs">${p.headcount}</td>
          <td class="text-xs">${p.active}</td>
          <td class="text-xs font-bold ${open > 0 ? 'text-amber-600' : 'text-green-600'}">${open}</td>
          <td><div class="flex items-center gap-2"><div class="w-16 h-1.5 bg-charcoal-100 rounded-full"><div class="h-full bg-brand-500 rounded-full" style="width:${fill}%"></div></div><span class="text-[9px] text-charcoal-500">${fill}%</span></div></td>
          <td>${canManage ? `<button onclick="showToast('Position edited — simulated')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:hidden flex-shrink-0">
      ${positions.map(p => `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <div class="flex items-center justify-between"><p class="text-sm font-semibold text-charcoal-900">${p.title}</p><span class="badge badge-gray text-[9px]">${p.department}</span></div>
        <div class="flex flex-wrap gap-1 mt-2">${p.levels.map(l => `<span class="badge badge-brand text-[9px]">${l}</span>`).join('')}</div>
        <div class="flex justify-between items-center mt-3 bg-charcoal-50 rounded-lg p-2">
          <div class="text-center flex-1"><p class="text-sm font-bold text-charcoal-900">${p.headcount}</p><p class="text-[9px] text-charcoal-500">Created</p></div>
          <div class="w-px h-8 bg-charcoal-200"></div>
          <div class="text-center flex-1"><p class="text-sm font-bold text-charcoal-900">${p.active}</p><p class="text-[9px] text-charcoal-500">Filled</p></div>
          <div class="w-px h-8 bg-charcoal-200"></div>
          <div class="text-center flex-1"><p class="text-sm font-bold ${(p.headcount - p.active) > 0 ? 'text-amber-600' : 'text-green-600'}">${p.headcount - p.active}</p><p class="text-[9px] text-charcoal-500">Open</p></div>
        </div>
      </div>`).join('')}
    </div>
    ${!canManage ? `<p class="text-[10px] text-charcoal-400 text-center flex-shrink-0">Position management requires <code>positions.manage</code> (HR Manager). View-only.</p>` : ''}
  </div>`;
}

// ==================== NOTIFICATIONS & ANNOUNCEMENTS ====================
let _notifTab = 'notifications';

function renderNotifications() {
  const canManage = DEMO.showAll || hasPermission('announcements.manage');
  const notifs = [...MOCK.notifications].sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1));
  const unread = MOCK.notifications.filter(n => !n.read).length;
  const colorMap = { yellow: 'bg-yellow-100 text-yellow-700', green: 'bg-emerald-100 text-emerald-700', blue: 'bg-blue-100 text-blue-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700' };

  let body;
  if (_notifTab === 'notifications') {
    body = `<div class="flex items-center justify-between mb-2">
      <p class="text-xs text-charcoal-500">${unread} unread notifications</p>
      <button onclick="showToast('All marked as read')" class="btn btn-sm btn-ghost text-brand-600">Mark all read</button>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">${notifs.map(n => `<div class="bg-white rounded-xl border border-charcoal-200 p-3 flex items-start gap-3 ${n.read ? 'opacity-70' : ''}">
      <div class="w-8 h-8 rounded-full ${colorMap[n.color] || 'bg-charcoal-100 text-charcoal-600'} flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2"><p class="text-xs font-medium text-charcoal-900">${n.title}${!n.read ? '<span class="w-2 h-2 rounded-full bg-brand-500 inline-block ml-1.5"></span>' : ''}</p><span class="text-[9px] text-charcoal-400 whitespace-nowrap">${n.date}</span></div>
        <p class="text-[10px] text-charcoal-600 mt-0.5">${n.description}</p>
        <div class="flex items-center gap-2 mt-1"><span class="badge badge-gray text-[9px]">${n.category}</span>${n.link ? `<button onclick="navigateTo('${n.link}')" class="text-[9px] text-brand-600 font-semibold hover:underline">Open →</button>` : ''}</div>
      </div>
    </div>`).join('')}</div>`;
  } else {
    body = `<div class="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">${MOCK.announcements.map(a => `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between"><p class="text-xs font-semibold text-charcoal-900">${a.title}</p>${statusBadge(a.status)}</div>
      <div class="flex items-center gap-3 mt-1.5 text-[10px] text-charcoal-500">
        <span><svg class="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>${a.audience}</span>
        <span>${formatDate(a.sentDate)}</span>
        <span class="ml-auto">Read rate: <strong class="text-charcoal-800">${a.readRate}%</strong></span>
      </div>
      <div class="w-full h-1.5 bg-charcoal-100 rounded-full mt-2"><div class="h-full bg-brand-500 rounded-full" style="width:${a.readRate}%"></div></div>
    </div>`).join('')}</div>
    ${canManage ? `<button onclick="openComposeAnnouncement()" class="btn btn-sm btn-primary w-full mt-2"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>Compose Announcement</button>` : ''}`;
  }

  const tabs = [
    { id: 'notifications', label: 'Notifications', count: unread },
    { id: 'announcements', label: 'Announcements', count: MOCK.announcements.length },
  ];

  return `<div class="flex flex-col h-full min-h-0 gap-2">
    <div><h1 class="text-base font-bold text-charcoal-900">Notifications & Announcements</h1><p class="text-xs text-charcoal-500 mt-0.5">System notifications and company announcements</p></div>
    <div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200">${tabs.map(t => `<button onclick="_notifTab='${t.id}';renderAll()" class="tab-btn ${_notifTab === t.id ? 'active' : ''}">${t.label}${t.count ? ` <span class="badge badge-red text-[9px] ml-0.5">${t.count}</span>` : ''}</button>`).join('')}</div>
    ${body}
    ${!canManage ? `<p class="text-[10px] text-charcoal-400 text-center">Composing announcements requires <code>announcements.manage</code> (HR Manager).</p>` : ''}
  </div>`;
}

function openComposeAnnouncement() {
  openModal('Compose Announcement', `<form onsubmit="event.preventDefault();showToast('Announcement sent');closeModal();" class="space-y-3">
    <div><label class="form-label">Title</label><input class="form-input" placeholder="Announcement title" required></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Audience</label><select class="form-select"><option>All Employees</option><option>Nasr City</option><option>Heliopolis</option><option>6th October</option><option>Trainers only</option></select></div>
      <div><label class="form-label">Type</label><select class="form-select"><option>Policy Update</option><option>Event</option><option>Reminder</option><option>Recognition</option></select></div>
    </div>
    <div><label class="form-label">Message</label><textarea class="form-input" rows="3" placeholder="Message..." required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Send Announcement</button></div>
  </form>`);
}

// ==================== ACTIVITY / AUDIT LOG ====================
function renderAuditLog() {
  const canView = DEMO.showAll || hasPermission('audit.view');
  if (!canView) return `<div class="space-y-3"><h1 class="text-base font-bold text-charcoal-900">Activity / Audit Log</h1><div class="bg-white rounded-xl border border-charcoal-200 p-6 text-center"><p class="text-xs text-charcoal-500">You do not have permission to view the audit log (<code>audit.view</code>).</p></div></div>`;
  return `<div class="space-y-2.5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div><h1 class="text-base font-bold text-charcoal-900">Activity / Audit Log</h1><p class="text-xs text-charcoal-500 mt-0.5">${MOCK.auditLog.length} recorded events · HR Manager only</p></div>
      <div class="flex items-center gap-1.5">
        <select class="form-select w-auto" style="font-size:0.75rem"><option>All Actions</option><option>Employee</option><option>Payroll</option><option>Recruitment</option><option>Bulk Import</option></select>
        <select class="form-select w-auto" style="font-size:0.75rem"><option>All Gyms</option><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select>
      </div>
    </div>
    <div class="bg-white rounded-xl border border-charcoal-200 divide-y divide-charcoal-50 overflow-hidden">
      ${MOCK.auditLog.map(a => `<div class="p-2.5 flex items-start gap-2.5">
        <div class="w-8 h-8 rounded-full bg-charcoal-50 text-charcoal-400 flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2"><p class="text-xs font-medium text-charcoal-900">${a.action}<span class="text-charcoal-400 font-normal"> — ${a.target}</span></p><span class="text-[9px] text-charcoal-400 whitespace-nowrap">${a.timestamp}</span></div>
          <p class="text-[10px] text-charcoal-600 mt-0.5">${a.detail}</p>
          <div class="flex gap-2 mt-1 text-[9px] text-charcoal-400"><span>By: ${a.user}</span><span>·</span><span>${a.gym}</span></div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}


// ==================== EMPLOYEE ACTION REQUEST — REVIEW (Approve / Reject) ====================
// Whoever holds the permission the request escalates to (typically the HR Manager)
// reviews it. Approve auto-executes the action using proposedDetails — same effect as
// performing it directly (mutates MOCK + writes the normal audit-log entry). Reject
// closes the request with a comment and changes nothing on the employee record.
function _findActionRequest(id) {
  return (MOCK.actionRequests || []).find(x => x.id === id);
}

function _canReviewAction(a) {
  const meta = ACTION_TYPES[a.actionType];
  return !!meta && (DEMO.showAll || hasPermission(meta.perm));
}

function approveActionRequest(id) {
  const a = _findActionRequest(id);
  if (!a) return;
  const meta = ACTION_TYPES[a.actionType];
  if (!_canReviewAction(a)) { showToast(`Approving requires ${meta ? meta.perm : 'permission'}`, 'error'); return; }
  if (a.status !== 'Pending') return;

  executeActionRequest(a);
  a.status = 'Approved';
  a.reviewedBy = MOCK.currentUser.fullName;
  a.reviewedDate = '2026-09-09';
  showToast(`${meta.label} approved for ${a.employee}${a.actionType === 'Offboard' ? ' — offboarding checklist created' : ''}`);
  renderAll();
}

function executeActionRequest(a) {
  const d = a.proposedDetails || {};
  const emp = a.employeeId ? MOCK.employees.find(e => e.id === a.employeeId) : null;
  MOCK.auditLog = MOCK.auditLog || [];
  const audit = (action, detail, gym) => MOCK.auditLog.unshift({
    id: 'al-' + Date.now(), action, user: MOCK.currentUser.fullName,
    target: a.employee, detail, timestamp: '2026-09-09', gym: gym || (emp ? emp.gym : 'All')
  });

  if (a.actionType === 'Transfer' && emp) {
    emp.gym = d.toGym;
    audit('Gym Transfer Executed', `${d.fromGym} → ${d.toGym} (Effective ${formatDate(d.effectiveDate)}). Approved request from ${a.requestedBy}.`, d.toGym);
    MOCK.events = (MOCK.events || []).filter(ev => !(ev.type === 'TransferRequest' && ev.title.includes(emp.name)));
  } else if (a.actionType === 'CompensationChange' && emp) {
    const from = emp.salary;
    emp.salary = d.newSalary;
    audit('Compensation Updated', `Salary EGP ${Number(from).toLocaleString()} → EGP ${Number(d.newSalary).toLocaleString()} (Effective ${formatDate(d.effectiveDate)}). Approved request from ${a.requestedBy}.`);
  } else if (a.actionType === 'RoleAssign' && emp) {
    emp.systemRole = d.systemRole || 'None (Employee)';
    audit('System Role Assigned', `System role set to ${emp.systemRole}. Approved request from ${a.requestedBy}.`);
  } else if (a.actionType === 'Offboard' && emp) {
    emp.status = 'Notice Period';
    MOCK.separations.unshift({
      id: 'sep-' + Date.now(), employee: emp.name, position: `${emp.position} — ${emp.level}`, gym: emp.gym,
      lastDay: d.lastDay || '2026-09-30', reason: d.reason || 'Resignation',
      requestedBy: a.requestedBy, requestedByUser: a.requestedBy,
      submittedDate: 'Sep 9, 2026', status: 'Notice Period', progress: 0,
      checklist: [['Exit interview scheduled', false], ['Handover completed', false], ['Uniform returned', false], ['Access cards revoked', false], ['Final settlement', false]],
      verdict: null
    });
    audit('Offboarding Initiated', `Approved escalation (Last Day: ${d.lastDay}, Reason: ${d.reason}). Requested by ${a.requestedBy}.`);
  } else if (a.actionType === 'BulkImport') {
    audit('Bulk Import Executed', `${d.source || 'CSV import'}. Approved request from ${a.requestedBy}.`, 'All');
  }
}

function rejectActionRequest(id) {
  const a = _findActionRequest(id);
  if (!a) return;
  const meta = ACTION_TYPES[a.actionType];
  if (!_canReviewAction(a)) { showToast(`Rejecting requires ${meta ? meta.perm : 'permission'}`, 'error'); return; }
  if (a.status !== 'Pending') return;

  openModal(`Reject ${meta.label} Request — ${a.employee}`, `<form onsubmit="event.preventDefault();confirmRejectActionRequest('${a.id}');" class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px]">
      <div class="flex justify-between"><span class="text-charcoal-500">Action</span><span class="font-bold text-charcoal-900">${meta.label}</span></div>
      <div class="flex justify-between mt-1"><span class="text-charcoal-500">Employee</span><span class="font-bold text-charcoal-900">${a.employee}</span></div>
      <div class="flex justify-between mt-1"><span class="text-charcoal-500">Proposed</span><span class="font-semibold text-charcoal-800">${actionSummary(a)}</span></div>
      <div class="flex justify-between mt-1"><span class="text-charcoal-500">Raised by</span><span class="font-semibold text-charcoal-800">${a.requestedBy}</span></div>
    </div>
    <p class="text-[10px] text-charcoal-500">Rejecting closes the request with your comment — nothing changes on the employee record.</p>
    <div><label class="form-label">Comment *</label><textarea id="arj-comment" class="form-input" rows="3" required placeholder="Why is this request rejected?"></textarea></div>
    <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-danger">Reject Request</button>
    </div>
  </form>`, { wide: true });
}

function confirmRejectActionRequest(id) {
  const a = _findActionRequest(id);
  if (!a) return;
  const meta = ACTION_TYPES[a.actionType];
  if (!_canReviewAction(a) || a.status !== 'Pending') { closeModal(); return; }
  const comment = document.getElementById('arj-comment')?.value.trim();
  if (!comment) { showToast('Please provide a comment', 'error'); return; }

  a.status = 'Rejected';
  a.reviewedBy = MOCK.currentUser.fullName;
  a.reviewedDate = '2026-09-09';
  a.reviewComment = comment;

  MOCK.auditLog = MOCK.auditLog || [];
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(), action: `${meta.label} Request Rejected`,
    user: MOCK.currentUser.fullName, target: a.employee,
    detail: `${actionSummary(a)}. Comment: ${comment}`, timestamp: '2026-09-09',
    gym: (MOCK.employees.find(e => e.id === a.employeeId) || {}).gym || 'All'
  });

  closeModal();
  showToast(`${meta.label} request rejected — closed with comment`, 'info');
  renderAll();
}

// ==================== MY ACCESS ====================
function renderMyAccess() {
  const u = MOCK.currentUser;
  const perms = u.permissions || [];
  const showAll = DEMO.showAll;
  const groups = [
    { name: 'Employees', perms: ['employees.view', 'employees.create', 'employees.edit', 'employees.transfer', 'employees.position.change', 'employees.bulk_import', 'employees.offboard', 'employees.contract.manage'] },
    { name: 'Attendance & Schedule', perms: ['attendance.view', 'attendance.edit', 'schedule.view', 'schedule.manage'] },
    { name: 'Recruitment', perms: ['recruitment.view', 'recruitment.candidates.manage', 'recruitment.vacancies.manage', 'recruitment.hire.approve'] },
    { name: 'Payroll', perms: ['payroll.view', 'payroll.edit', 'payroll.approve', 'payroll.export'] },
    { name: 'Evaluations & Reports', perms: ['evaluations.view', 'evaluations.manage', 'reports.view'] },
    { name: 'Administration', perms: ['positions.view', 'positions.manage', 'announcements.view', 'announcements.manage', 'audit.view', 'requests.approve'] },
  ];
  const allPerms = new Set();
  groups.forEach(g => g.perms.forEach(p => allPerms.add(p)));
  const granted = perms.filter(p => allPerms.has(p)).length;

  const showMatrix = showAll || hasPermission('team.manage');
  const roleNames = Object.keys(MOCK.permissionMatrix.roles);
  const depts = MOCK.permissionMatrix.depts;
  const maxPerDept = 9;
  const roleTint = { 'HR Manager': 'bg-brand-600', 'HR Specialist': 'bg-blue-600', 'Branch Manager': 'bg-purple-600' };

  const matrixGrid = `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
    <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
      <p class="bento-label">PERMISSIONS MATRIX — ROLES × MODULES</p>
      <button onclick="showToast('Role management — simulated')" class="btn btn-sm btn-ghost ${showMatrix ? '' : 'hidden'}">Manage Roles</button>
    </div>
    <div class="table-responsive"><table class="data-table"><thead><tr>
      <th>Role</th>${depts.map(d => `<th class="text-center text-[9px]">${d}</th>`).join('')}<th class="text-right">Overall</th>
    </tr></thead>
    <tbody>${MOCK.permissionMatrix.roles.map(r => {
      const total = Object.values(r.perms).reduce((s, v) => s + v, 0);
      const maxTotal = depts.length * maxPerDept;
      return `<tr>
        <td><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ${roleTint[r.name] || 'bg-gray-400'}"></span><span class="text-xs font-medium text-charcoal-900">${r.name}</span></div></td>
        ${depts.map(d => {
          const v = r.perms[d];
          return `<td class="text-center"><span class="badge ${v >= Math.round(maxPerDept * 0.7) ? 'badge-success' : v > 0 ? 'badge-yellow' : 'badge-gray'} text-[9px]">${v}/${maxPerDept}</span></td>`;
        }).join('')}
        <td class="text-right"><span class="text-xs font-bold text-brand-700">${Math.round((total / maxTotal) * 100)}%</span></td>
      </tr>`;
    }).join('')}
    <tr class="bg-white"><td class="text-[10px] text-charcoal-400">You (${u.role})</td>${depts.map(d => {
      const total = u.permissions.filter(p => p.startsWith(d.toLowerCase().replace(' ', '_'))).length;
      return `<td class="text-center"><span class="badge ${total > 0 ? 'badge-brand' : 'badge-gray'} text-[9px]">${total}</span></td>`;
    }).join('')}<td class="text-right"><span class="text-xs font-bold text-brand-700">${granted}/${allPerms.size}</span></td></tr></tbody></table></div>
  </div>`;

  const groupHtml = groups.map(g => {
    const count = g.perms.filter(p => perms.includes(p)).length;
    return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between"><p class="text-xs font-semibold text-charcoal-900">${g.name}</p><span class="badge ${count === g.perms.length ? 'badge-success' : count ? 'badge-yellow' : 'badge-gray'} text-[9px]">${count}/${g.perms.length}</span></div>
      <div class="flex flex-wrap gap-1.5 mt-2">${g.perms.map(p => `<span class="badge ${perms.includes(p) ? 'badge-brand' : 'badge-gray'} text-[9px]">${perms.includes(p) ? '✓ ' : '✗ '}${p}</span>`).join('')}</div>
    </div>`;
  }).join('');

  return `<div class="space-y-2.5">
    <div><h1 class="text-base font-bold text-charcoal-900">My Access</h1><p class="text-xs text-charcoal-500 mt-0.5">Gyms you cover and permissions granted to your ${u.role} role</p></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
      <div class="bg-white rounded-xl border border-brand-200 border-l-4 border-l-brand-500 p-2.5">
        <p class="bento-label text-brand-700 mb-2">ASSIGNED GYMS</p>
        <div class="space-y-1.5">${u.gyms.map(g => `<div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0"></span>
          <div><p class="text-xs font-medium text-charcoal-900">${g.name}</p><p class="text-[10px] text-charcoal-500">${g.branch}</p></div>
        </div>`).join('')}</div>
      </div>
      <div class="lg:col-span-2 bg-white rounded-xl border border-charcoal-200 p-2.5">
        <p class="bento-label text-charcoal-500 mb-2">PERMISSION SUMMARY</p>
        <div class="flex flex-wrap gap-2">
          <span class="badge badge-brand">${granted} granted</span>
          <span class="badge badge-gray">${allPerms.size} tracked</span>
        </div>
        <div class="w-full h-1.5 bg-charcoal-100 rounded-full mt-2.5"><div class="h-full bg-brand-500 rounded-full" style="width:${Math.round((granted / mathMax(allPerms.size, 1)) * 100)}%"></div></div>
        <p class="text-[9px] text-charcoal-400 mt-1">${Math.round((granted / mathMax(allPerms.size, 1)) * 100)}% of HR trackable permissions</p>
      </div>
    </div>
    ${showMatrix ? matrixGrid : ''}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">${groupHtml}</div>
    ${perms.includes('*') ? `<p class="text-[10px] text-charcoal-400 text-center">Wildcard access (`*`) present — all permissions granted.</p>` : ''}
  </div>`;
}
