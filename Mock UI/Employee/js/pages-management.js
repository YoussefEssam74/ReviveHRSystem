// ==================== MY TEAM (Team Overview + Attendance) ====================
// Combines the team directory with today's attendance. Clicking a member opens
// context-aware actions (Mark Present / Remind / Follow Up / Evaluate / History).
function getTeamMemberTodayShift(m) {
  const schedIds = MOCK.teamSchedule[m.id] || [];
  const shiftId = schedIds[MOCK.todayIndex] || 'st-off';
  return getShiftTemplate(shiftId);
}
// Explains WHY a member is flagged in the Needs Attention box.
function attentionInfo(m, shift) {
  if (m.status === 'Absent') {
    return { badge:'<span class="badge badge-red">Absent</span>', reason:'No check-in today', detail:`Scheduled ${shiftLabel(shift)} · Absent without prior notice` };
  }
  let late = '';
  if (shift && shift.start && m.checkIn) {
    const [ch,cm] = m.checkIn.split(':').map(Number);
    const [sh,sm] = shift.start.split(':').map(Number);
    const mins = (ch*60+cm)-(sh*60+sm);
    if (mins > 0) late = ` · ${mins} min late`;
  }
  return { badge:'<span class="badge badge-yellow">Late</span>', reason:`Checked in ${m.checkIn||'—'}${late}`, detail:`Scheduled ${shiftLabel(shift)}` };
}
function renderTeam() {
  const s=MOCK.teamStats;
  const members = MOCK.teamMembers.map(m => {
    const shift = getTeamMemberTodayShift(m);
    const checkOut = (m.status==='Present'||m.status==='Late') ? '16:02' : '—';
    return { ...m, shift, checkOut };
  });
  const needsAttention = members.filter(m=>m.status==='Absent'||m.status==='Late');
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">My Team</h1><p class="text-xs text-charcoal-500 mt-0.5">${s.total} members · ${s.present} present today · Now ${MOCK.now}</p></div>
      <div class="flex items-center gap-2">
        <div class="relative">
          <svg class="w-4 h-4 text-charcoal-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" class="form-input" placeholder="Search team..." style="padding:0.375rem 0.625rem 0.375rem 2rem;font-size:0.8125rem;width:200px">
        </div>
        <select class="form-select w-32" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>August 2026</option></select>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><p class="text-xl font-bold text-brand-700">${s.total}</p><p class="text-[10px] text-charcoal-500">Total</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-brand-600">${s.present}</p><p class="text-[10px] text-charcoal-500">Present</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-yellow-600">${s.late}</p><p class="text-[10px] text-charcoal-500">Late</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></div><p class="text-lg font-bold text-red-600">${s.absent}</p><p class="text-[10px] text-charcoal-500">Absent</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg></div><p class="text-lg font-bold text-blue-600">${s.pendingRequests}</p><p class="text-[10px] text-charcoal-500">Pending</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><p class="text-lg font-bold text-orange-600">${s.upcomingIssues}</p><p class="text-[10px] text-charcoal-500">Issues</p></div>
    </div>

    <!-- Needs Attention -->
    ${needsAttention.length?`<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-red-50/50">
        <p class="bento-label flex items-center gap-1.5 text-red-700"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>NEEDS ATTENTION (${needsAttention.length})</p>
      </div>
      <div class="divide-y divide-charcoal-50">${needsAttention.map(m=>{const a=attentionInfo(m,m.shift);return `<div class="p-3 flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${m.initials}</div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5"><p class="text-xs font-semibold text-charcoal-900">${m.name}</p>${a.badge}</div>
            <p class="text-[10px] text-charcoal-500 truncate">${m.position} · ${a.reason}</p>
            <p class="text-[10px] text-charcoal-400 truncate">${a.detail}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${m.status==='Absent'?`<button onclick="event.stopPropagation();markPresent('${m.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Mark Present</button>`:''}
          <button onclick="event.stopPropagation();sendReminder('${m.id}')" class="btn btn-sm btn-secondary">Remind</button>
          <button onclick="event.stopPropagation();openTeamMember('${m.id}')" class="btn btn-sm btn-secondary">View</button>
        </div>
      </div>`;}).join('')}</div>
    </div>`:''}

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Position</th><th>Scheduled</th><th>Check In</th><th>Check Out</th><th>Status</th><th></th></tr></thead>
      <tbody>${members.map(m=>`<tr class="cursor-pointer hover:bg-charcoal-50/50" onclick="openTeamMember('${m.id}')"><td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.id.toUpperCase()}</p></div></div></td><td class="text-xs">${m.position}</td><td class="text-xs">${shiftLabel(m.shift)}</td><td class="text-xs">${m.checkIn||'—'}</td><td class="text-xs">${m.checkOut}</td><td>${statusBadge(m.status)}</td><td><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td></tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${members.map(m=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openTeamMember('${m.id}')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div>
          <div>
            <p class="text-xs font-medium text-charcoal-900">${m.name}</p>
            <p class="text-[10px] text-charcoal-500">${m.position} · ${shiftLabel(m.shift)}</p>
          </div>
        </div>
        ${statusBadge(m.status)}
      </div>
      <div class="flex gap-4 mt-2 text-[10px] text-charcoal-500">
        <span class="flex items-center gap-1"><svg class="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>In: ${m.checkIn||'—'}</span>
        <span class="flex items-center gap-1"><svg class="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Out: ${m.checkOut}</span>
      </div>
    </div>`).join('')}</div>
  </div>`;
}

// ==================== TEAM REQUESTS ====================
function setTeamRequestsTab(tab) { state.teamRequestsTab = tab; renderAll(); }

function renderTeamRequests() {
  const needAction = MOCK.teamRequests.filter(r=>r.status==='Pending');
  const pendingHR = MOCK.teamRequests.filter(r=>r.status==='Pending HR' || r.status==='Rejected Pending HR');
  const approved = MOCK.teamRequests.filter(r=>r.status==='Approved');
  const rejected = MOCK.teamRequests.filter(r=>r.status==='Rejected');
  const canApprove = hasPermission('requests.approve.team');
  const active = state.teamRequestsTab || 'needAction';

  const rejectNote = (r) => {
    if (r.status==='Rejected Pending HR') return `<p class="text-[10px] text-red-500 mt-0.5">Rejected by ${r.teamRejectedBy||'Team Leader'} — awaiting HR confirmation</p>`;
    if (r.status==='Rejected') {
      if (r.rejectionType==='expired') return `<p class="text-[10px] text-red-500 mt-0.5">Rejected — time passed (${r.rejectionReason||'no response in time'})</p>`;
      if (r.teamRejectedBy && r.hrRejectedBy) return `<p class="text-[10px] text-red-500 mt-0.5">Rejected by both Team Leader & HR</p>`;
      if (r.teamRejectedBy) return `<p class="text-[10px] text-red-500 mt-0.5">Rejected by Team Leader (${r.teamRejectedBy})</p>`;
      if (r.hrRejectedBy) return `<p class="text-[10px] text-red-500 mt-0.5">Rejected by HR (${r.hrRejectedBy})</p>`;
    }
    return '';
  };

  const row = (r, actions) => `<div class="p-3 hover:bg-charcoal-50/50 transition-colors">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${r.employee.split(' ').map(w=>w[0]).join('')}</div>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-charcoal-900">${r.employee}</p>
          <p class="text-[10px] text-charcoal-500">${r.type} · ${r.date} · Submitted ${r.submitted}${r.teamApprovedBy?' · Team Leader: '+r.teamApprovedBy:''}</p>
          ${r.reason?`<p class="text-[10px] text-charcoal-400 mt-0.5">${r.reason}</p>`:''}
          ${rejectNote(r)}
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">${actions}</div>
    </div>
  </div>`;

  const tabBtn = (key, label, count, color) => `<button onclick="setTeamRequestsTab('${key}')" class="flex-1 min-w-0 px-2 py-2 rounded-lg text-[11px] font-semibold transition-colors ${active===key?color.active:color.idle}">
    <span class="block truncate">${label}</span><span class="block text-[10px] font-bold mt-0.5">${count}</span>
  </button>`;

  const tabs = `<div class="bg-white rounded-xl border border-charcoal-200 p-1.5 flex gap-1.5">
    ${tabBtn('needAction','NEED ACTION',needAction.length,{active:'bg-yellow-100 text-yellow-800',idle:'text-charcoal-500 hover:bg-charcoal-50'})}
    ${tabBtn('pendingHR','PENDING HR',pendingHR.length,{active:'bg-purple-100 text-purple-800',idle:'text-charcoal-500 hover:bg-charcoal-50'})}
    ${tabBtn('approved','APPROVED',approved.length,{active:'bg-green-100 text-green-800',idle:'text-charcoal-500 hover:bg-charcoal-50'})}
    ${tabBtn('rejected','REJECTED',rejected.length,{active:'bg-red-100 text-red-800',idle:'text-charcoal-500 hover:bg-charcoal-50'})}
  </div>`;

  const list = (items, actionsFn, emptyMsg) => `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
    <div class="divide-y divide-charcoal-50">${items.length?items.map(r=>row(r, actionsFn(r))).join(''):`<div class="p-6 text-center"><p class="text-xs text-charcoal-500">${emptyMsg}</p></div>`}</div>
  </div>`;

  const viewBtn = (id) => `<button onclick="event.stopPropagation();viewRequest('${id}')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>View</button>`;
  const approveBtn = (id) => `<button onclick="event.stopPropagation();approveRequest('${id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Approve</button>`;
  const rejectBtn = (id) => `<button onclick="event.stopPropagation();rejectRequest('${id}')" class="btn btn-sm btn-danger-outline"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>Reject</button>`;
  const editBtn = (id) => `<button onclick="event.stopPropagation();editTeamRequest('${id}')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Edit</button>`;

  let body = '';
  if (active==='needAction') {
    body = list(needAction,
      r=>canApprove?approveBtn(r.id)+rejectBtn(r.id):viewBtn(r.id),
      'No requests waiting for action');
  } else if (active==='pendingHR') {
    body = list(pendingHR,
      r=>{
        if (r.status==='Rejected Pending HR') return canApprove?approveBtn(r.id)+viewBtn(r.id):viewBtn(r.id);
        return canApprove?editBtn(r.id)+rejectBtn(r.id):viewBtn(r.id);
      },
      'No requests awaiting HR review');
  } else if (active==='approved') {
    body = list(approved,
      r=>canApprove?editBtn(r.id)+rejectBtn(r.id):viewBtn(r.id),
      'No approved requests');
  } else {
    body = list(rejected,
      r=>canApprove?approveBtn(r.id)+viewBtn(r.id):viewBtn(r.id),
      'No rejected requests');
  }

  return `<div class="space-y-3">
    <div>
      <h1 class="text-xl font-bold text-charcoal-900">Team Requests</h1>
      <p class="text-xs text-charcoal-500 mt-0.5">${needAction.length} need action · ${pendingHR.length} pending HR review · ${approved.length} approved · ${rejected.length} rejected</p>
    </div>
    ${tabs}
    ${body}
  </div>`;
}

// ==================== TEAM ATTENDANCE (merged into My Team) ====================
// Kept as an alias so old links to team-attendance still work.
function renderTeamAttendance() { return renderTeam(); }

// ==================== TEAM MEMBER DETAIL & ACTIONS ====================
// Clicking a team member opens their full profile page with all their data.
function openTeamMember(id) {
  navigateTo('team-member-profile', { id });
}

// ==================== TEAM MEMBER FULL PROFILE ====================
// Full profile page for a team member: personal info, contact, employment,
// today's attendance, weekly schedule, requests and evaluations.
function renderTeamMemberProfile() {
  const id = (state.pageParams && state.pageParams.id) || 't1';
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return '<div class="text-center py-20"><p class="text-charcoal-500">Employee not found</p></div>';
  const p = MOCK.teamProfiles[id] || {};
  const shift = getTeamMemberTodayShift(m);
  const checkOut = (m.status==='Present'||m.status==='Late') ? '16:02' : '—';
  const isAbsent = m.status==='Absent';
  const isLate = m.status==='Late';
  const reqs = MOCK.teamRequests.filter(r=>r.employee===m.name);
  const evals = MOCK.teamEvaluations.filter(e=>e.employee===m.name);
  const canApprove = hasPermission('requests.approve.team') || hasPermission('requests.approve');
  const canEditEval = hasPermission('evaluations.manage') || hasPermission('evaluations.view.team') || hasPermission('team.manage');
  const days = ['Mon 25','Tue 26','Wed 27','Thu 28','Fri 29','Sat 30','Sun 31'];
  const schedIds = MOCK.teamSchedule[m.id] || days.map(()=>'st-off');

  const infoCard = (label, value) => `<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">${label}</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${value||'—'}</p></div>`;

  return `<div class="space-y-3">
    <!-- Back -->
    <button onclick="navigateTo('team')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>Back to My Team</button>

    <!-- Header -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-base font-semibold flex-shrink-0">${m.initials}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap"><h1 class="text-lg font-bold text-charcoal-900">${m.name}</h1>${statusBadge(m.status)}</div>
          <p class="text-xs text-charcoal-500 mt-0.5">${m.position} · ${m.id.toUpperCase()} · ${p.gym||'Revive Gym — Nasr City'}</p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button onclick="sendMessage('${m.id}')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>Message</button>
          <button onclick="openEvaluateMember('${m.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>Evaluate</button>
          ${isAbsent?`<button onclick="markPresent('${m.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Mark Present</button>`:''}
          ${isAbsent||isLate?`<button onclick="sendReminder('${m.id}')" class="btn btn-sm btn-secondary">Remind</button>`:''}
        </div>
      </div>
    </div>

    <!-- Today's Attendance -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <p class="bento-label mb-2">TODAY'S ATTENDANCE</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${infoCard('SCHEDULED TODAY', shiftLabel(shift))}
        ${infoCard('CHECK IN', m.checkIn||'—')}
        ${infoCard('CHECK OUT', checkOut)}
        ${infoCard('SOURCE', 'Biometric Device')}
      </div>
    </div>

    <!-- Personal & Contact -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="bg-white rounded-xl border border-charcoal-200 p-4">
        <p class="bento-label mb-2">PERSONAL INFO</p>
        <div class="grid grid-cols-2 gap-2">
          ${infoCard('Date of Birth', p.dateOfBirth)}
          ${infoCard('Gender', p.gender)}
          ${infoCard('National ID', p.nationalId)}
          ${infoCard('Address', p.address)}
        </div>
      </div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-4">
        <p class="bento-label mb-2">CONTACT & EMERGENCY</p>
        <div class="grid grid-cols-2 gap-2">
          ${infoCard('Email', p.email)}
          ${infoCard('Phone', p.phone)}
          ${infoCard('Emergency Contact', p.emergencyContact?p.emergencyContact.name:'—')}
          ${infoCard('Relationship', p.emergencyContact?p.emergencyContact.relationship:'—')}
          ${infoCard('Emergency Phone', p.emergencyContact?p.emergencyContact.phone:'—')}
        </div>
      </div>
    </div>

    <!-- Employment -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <p class="bento-label mb-2">EMPLOYMENT</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${infoCard('Hire Date', p.hireDate)}
        ${infoCard('Employment Type', p.employmentType)}
        ${infoCard('Level', p.level)}
        ${infoCard('Base Salary', p.baseSalary?('EGP '+p.baseSalary.toLocaleString()):'—')}
      </div>
    </div>

    <!-- Weekly Schedule -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <p class="bento-label mb-2">WEEKLY SCHEDULE</p>
      <div class="space-y-1.5">${schedIds.map((sid,i)=>{const t=getShiftTemplate(sid);const c=getShiftColor(t);const isToday=i===MOCK.todayIndex;return `<div class="flex items-center justify-between rounded-lg p-2.5 ${isToday?'ring-1 ring-brand-500 bg-brand-50/50':'bg-charcoal-50'}">
        <div class="flex items-center gap-2"><p class="text-xs font-semibold text-charcoal-900 w-14">${days[i]}</p>${isToday?'<span class="badge badge-green">Today</span>':''}</div>
        <span class="schedule-shift-badge text-[10px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40">${t.isOff?'OFF':t.start+'–'+t.end}</span>
      </div>`;}).join('')}</div>
    </div>

    <!-- Requests -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50">
        <p class="bento-label">REQUESTS (${reqs.length})</p>
      </div>
      <div class="divide-y divide-charcoal-50">${reqs.length?reqs.map(r=>`<div class="p-3 flex items-center justify-between gap-2">
        <div class="min-w-0"><p class="text-xs font-medium text-charcoal-900">${r.type}</p><p class="text-[10px] text-charcoal-500">${r.date} · Submitted ${r.submitted}${r.teamApprovedBy?' · Team Leader: '+r.teamApprovedBy:''}</p>${r.reason?`<p class="text-[10px] text-charcoal-400 mt-0.5">${r.reason}</p>`:''}</div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${statusBadge(r.status)}
          ${canApprove&&r.status==='Pending'?`<button onclick="approveRequest('${r.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Approve</button>
          <button onclick="rejectRequest('${r.id}')" class="btn btn-sm btn-danger-outline"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>Reject</button>`:''}
          ${canApprove&&r.status==='Pending HR'?`<button onclick="editTeamRequest('${r.id}')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Edit</button>`:''}
        </div>
      </div>`).join(''):`<div class="p-4 text-center"><p class="text-xs text-charcoal-500">No requests found</p></div>`}</div>
    </div>

    <!-- Evaluations -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50">
        <p class="bento-label">EVALUATIONS (${evals.length})</p>
      </div>
      <div class="divide-y divide-charcoal-50">${evals.length?evals.map(e=>`<div class="p-3 flex items-center justify-between gap-2">
        <div class="min-w-0"><p class="text-xs font-medium text-charcoal-900">${e.period}</p><p class="text-[10px] text-charcoal-500">Score ${e.score}/5 · ${e.result}</p></div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${statusBadge(e.status)}
          ${canEditEval?`<button onclick="openEditTeamEvaluation('${e.id}')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Edit</button>`:''}
        </div>
      </div>`).join(''):`<div class="p-4 text-center"><p class="text-xs text-charcoal-500">No evaluations yet</p></div>`}</div>
    </div>
  </div>`;
}
function markPresent(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  m.status='Present'; m.checkIn = m.checkIn || MOCK.now;
  closeModal(); renderAll(); showToast(`${m.name} marked present (${m.checkIn})`);
}
function sendReminder(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  showToast(`Reminder sent to ${m.name}`,'info');
}
function addTeamFollowUp(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  const type = m.status==='Absent' ? 'Absent' : 'Late Pattern';
  const desc = m.status==='Absent' ? 'Absent today without prior notice' : 'Late arrival today';
  openModal(`Follow Up — ${m.name}`, `<div class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-3">
      <div class="flex items-center justify-between"><p class="text-xs font-semibold text-charcoal-900">${type}</p>${statusBadge(m.status)}</div>
      <p class="text-[10px] text-charcoal-500 mt-0.5">${desc} · ${m.position}</p>
    </div>
    <div><label class="form-label">Action</label><select id="fu-action" class="form-select"><option>Send reminder</option><option>Schedule a meeting</option><option>Escalate to manager</option><option value="Issue deduction to HR">Issue deduction &rarr; send to HR</option><option>Mark as resolved</option></select></div>
    <div><label class="form-label">Deduction amount (EGP) — optional</label><input id="fu-ded-amount" type="number" min="1" step="1" class="form-input" placeholder="e.g. 150"></div>
    <div><label class="form-label">Deduction reason</label><select id="fu-ded-reason" class="form-select">${['Unapproved absence','Late arrival (30+ min)','Early checkout without approval','Damaged equipment / property','Policy violation','Other (see note)'].map(r=>`<option>${r}</option>`).join('')}</select></div>
    <div><label class="form-label">Note</label><textarea id="fu-note" class="form-input" rows="2" placeholder="Add a note..."></textarea></div>
    <div class="bg-purple-50 border border-purple-100 rounded-lg p-2.5 text-[10px] text-purple-800 leading-relaxed">
      An amount sent here becomes a <b>Deduction Candidate</b> with status <b>Pending HR</b> — HR approves it before it touches payroll (features.md §10).
    </div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="saveTeamFollowUp('${id}')" class="btn btn-sm btn-primary">Save Action</button></div>
  </div>`);
}
function saveTeamFollowUp(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  const action = document.getElementById('fu-action').value;
  const note = document.getElementById('fu-note').value.trim();
  let f = MOCK.followUpItems.find(x=>x.employee===m.name);
  if (!f) {
    f = { id:'f'+Date.now().toString(36), employee:m.name, type: m.status==='Absent'?'Absent':'Late Pattern', description: m.status==='Absent'?'Absent today without prior notice':'Late arrival today', severity: m.status==='Absent'?'high':'medium' };
    MOCK.followUpItems.unshift(f);
  }
  f.lastAction = action;
  if (note) f.note = note;
  // An amount entered with the action raises a deduction candidate for HR.
  const amount = parseFloat((document.getElementById('fu-ded-amount') || {}).value || '0');
  closeModal(); renderAll();
  if (amount > 0) {
    MOCK.deductionCandidates.unshift({
      id:'dc'+Date.now(), employee:m.name, amount,
      reason:(document.getElementById('fu-ded-reason') || {}).value || 'Other (see note)',
      date:TODAY_ISO, note: note || action, issuedBy: MOCK.currentUser.fullName, status:'Pending HR',
    });
    if (typeof branchQueueExport === 'function') branchQueueExport();
    showToast(`${action} for ${m.name} · EGP ${amount} deduction sent to HR for approval`);
    renderAll();
    return;
  }
  showToast(`${action} for ${m.name}`);
}
function openMemberRequests(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  const reqs = MOCK.teamRequests.filter(r=>r.employee===m.name);
  const body = reqs.length ? `<div class="space-y-2">${reqs.map(r=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
    <div><p class="text-xs font-medium text-charcoal-900">${r.type}</p><p class="text-[10px] text-charcoal-500">${r.date} · Submitted ${r.submitted}</p></div>
    ${statusBadge(r.status)}
  </div>`).join('')}</div>` : `<div class="bg-charcoal-50 rounded-lg p-4 text-center"><p class="text-xs text-charcoal-500">No requests found for ${m.name}</p></div>`;
  openModal(`${m.name} — Requests`, body, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}
function openMemberSchedule(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  const days = ['Mon 25','Tue 26','Wed 27','Thu 28','Fri 29','Sat 30','Sun 31'];
  const schedIds = MOCK.teamSchedule[m.id] || days.map(()=>'st-off');
  const body = `<div class="space-y-1.5">${schedIds.map((sid,i)=>{const t=getShiftTemplate(sid);const c=getShiftColor(t);const isToday=i===MOCK.todayIndex;return `<div class="flex items-center justify-between rounded-lg p-2.5 ${isToday?'ring-1 ring-brand-500 bg-brand-50/50':'bg-charcoal-50'}">
    <div class="flex items-center gap-2"><p class="text-xs font-semibold text-charcoal-900 w-14">${days[i]}</p>${isToday?'<span class="badge badge-green">Today</span>':''}</div>
    <span class="schedule-shift-badge text-[10px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40">${t.isOff?'OFF':t.start+'–'+t.end}</span>
  </div>`;}).join('')}</div>`;
  openModal(`${m.name} — Schedule`, body, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}
function sendMessage(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  showToast(`Message sent to ${m.name}`,'info');
}
// Shared with the Employees Performance page — the week-row sample for a team member.
function memberAttendanceRows(m) {
  return [
    { date:'Aug 26', shift: shiftLabel(getTeamMemberTodayShift(m)), checkIn: m.checkIn||'—', checkOut: (m.status==='Present'||m.status==='Late')?'16:02':'—', status: m.status },
    { date:'Aug 25', shift:'Evening · 16:00–00:00', checkIn:'16:05', checkOut:'00:01', status:'Late' },
    { date:'Aug 24', shift:'Off', checkIn:'—', checkOut:'—', status:'Off' },
    { date:'Aug 23', shift:'Morning · 08:00–16:00', checkIn:'07:58', checkOut:'16:03', status:'On Time' },
    { date:'Aug 22', shift:'Morning · 08:00–16:00', checkIn:'08:00', checkOut:'15:30', status:'Early Checkout' },
  ];
}
function openMemberAttendance(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  const rows = memberAttendanceRows(m);
  openModal(`${m.name} — Attendance`, `<div class="space-y-2">${rows.map(r=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
    <div><p class="text-xs font-medium text-charcoal-900">${r.date}</p><p class="text-[10px] text-charcoal-500">${r.shift}</p></div>
    <div class="text-right"><p class="text-[10px] text-charcoal-500">In ${r.checkIn} · Out ${r.checkOut}</p>${statusBadge(r.status)}</div>
  </div>`).join('')}</div>`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}
function openEvaluateMember(id) { openNewTeamEvaluation(id); }

// ==================== TEAM SCHEDULE (Month-Centric) ====================
//
// Flow: pick a MONTH → see that month's schedule PERIODS (dated ranges /
// history) → drill into a period to view the roster. Only the CURRENT month
// is editable: you can switch a period into EDIT mode and assign shifts to
// individuals for that specific period. Past/Future months are read-only.
//

// --- Scheduling calendar ---------------------------------------------------
// Anchored to the current month (mock clock lives in 2026). We expose a rolling
// window of months ending at the current one so there is always a browsable
// HISTORY behind the live month.
function schAnchorYear()   { return 2026; }
function schCurMonth()     { return 9; /* September 2026 */ }
function schMonthWindow(nBack, nFwd) {
  // nBack = how many PAST months to offer, nFwd = how many FUTURE months.
  const cur = schCurMonth(), yr = schAnchorYear();
  const arr = [];
  for (let k = nBack; k >= -nFwd; k--) {
    let mm = cur - k, y = yr;
    if (mm < 1) { mm += 12; y -= 1; }
    if (mm > 12) { mm -= 12; y += 1; }
    arr.push({ ym: `${y}-${String(mm).padStart(2,'0')}`, year: y, month: mm });
  }
  return arr.reverse();
}
function schLockState(ym) {

  const curYm = `${schAnchorYear()}-${String(schCurMonth()).padStart(2,'0')}`;
  if (ym < curYm) return 'past';      // history — read only
  if (ym === curYm) return 'current'; // live — editable
  return 'future';                    // planned — read only
}
function schMonthLabel(year, month) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function schMonday(dateObj) {
  const d = new Date(dateObj);
  const dow = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setDate(d.getDate() - dow);
  return d;
}
// Split a month into contiguous Monday->Sunday WEEKS (partial edges trimmed to
// the month bounds). Each yields a labelled period descriptor.
function schPeriodsFor(y, mo) {
  const dim = new Date(Date.UTC(y, mo, 0)).getDate();
  // Iterate every day of the month, bucket by ISO week (weeks start Monday).
  const buckets = {};
  for (let dd = 1; dd <= dim; dd++) {
    const dt = new Date(Date.UTC(y, mo - 1, dd));
    const mon = schMonday(dt);
    const key = mon.toISOString().slice(0, 10);
    (buckets[key] = buckets[key] || []).push({
      iso: dt.toISOString().slice(0, 10),
      num: dd,
      dow: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }
  const auto = Object.keys(buckets).sort().map(key => {
    const ds = buckets[key];
    const fmt = o => new Date(o.iso+'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      id: key.replace(/-/g, ''),
      start: ds[0].iso,
      end: ds[ds.length - 1].iso,
      label: `${fmt(ds[0])} – ${fmt(ds[ds.length-1])}`,
      days: ds,
    };
  });
  // Merge custom periods for this month
  const ym = `${y}-${String(mo).padStart(2,'0')}`;
  const custom = (schCustomPeriods()[ym] || []);
  return [...auto, ...custom];
}
function schDefaultYM() {
  return `${schAnchorYear()}-${String(schCurMonth()).padStart(2,'0')}`;
}
// Deterministic per-(member,period) roster seed so history stays stable until
// someone edits it. Overrides are stored separately.
function schSeedArray(memberId, periodId, len) {
  const tmps = MOCK.shiftTemplates;
  const actives = tmps.filter(t => !t.isOff);
  const pool = [tmps.find(t => t.isOff)].concat(actives); // OFF weighted lightly
  let acc = 2166136261 >>> 0;
  const str = memberId + '#' + periodId;
  for (let i = 0; i < str.length; i++) { acc ^= str.charCodeAt(i); acc = Math.imul(acc, 16777619) >>> 0; }
  const rnd = () => { acc ^= acc << 13; acc ^= acc >>> 17; acc ^= acc << 5; return (acc >>> 0) / 4294967296; }; // xorshift32
  const out = [];
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(rnd() * pool.length); // spread
    out.push(pool[idx]?.id || 'st-off');
  }
  return out;
}
function schOverrideStore() {
  if (!MOCK.__rosterOverrides) MOCK.__rosterOverrides = {};
  return MOCK.__rosterOverrides;
}
function schRoster(memberId, periodId, len) {
  const ov = schOverrideStore()[`${memberId}|${periodId}`];
  return Array.from({length:len}, (_,i)=>ov&&ov[i]!=null?ov[i]:undefined).map(
    (v,i)=>{ if(v!=null) return v; const seed=schSeedArray(memberId,periodId,len); return seed[i]; });
}
function schPersist(memberId, periodId, sidArr) {
  schOverrideStore()[`${memberId}|${periodId}`] = sidArr.slice();
}

// --- Page state ------------------------------------------------------------
// Persisted on `state` so switching tabs retains the picked month/period.
function tsSelMonth(){ return state.tsMonth || schDefaultYM(); }
function tsSelPeriod(){
  const [,moStr] = tsSelMonth().split('-');
  const pers = schPeriodsFor(+schAnchorYear(), +moStr);
  return state.tsPeriod || (pers[pers.length-1] ? pers[pers.length-1].id : null);
}
function tsCanEdit(){
  return true; // all months are editable in this prototype
}

// --- View range: 7 days vs whole range ("30 days") --------------------------
// Ranges longer than a week (custom periods from "Create New Schedule") open
// in a 7-day view. Shifts painted there repeat on the same weekday of every
// following week inside that period; "Show 30 days" expands the grid to the
// whole range (up to a full month) so the repetition can be reviewed.
function tsViewIsMonth(){ return state.tsView === 'month'; }
function toggleTsView(){
  state.tsView = tsViewIsMonth() ? 'week' : 'month';
  renderAll();
  showToast(tsViewIsMonth() ? 'Showing the whole month (up to 30 days)' : 'Showing 7 days — shifts repeat weekly', 'info');
}
function tsCurrentPeriod(){
  const [,moStr] = tsSelMonth().split('-');
  const pers = schPeriodsFor(+schAnchorYear(), +moStr);
  return pers.find(p => p.id === tsSelPeriod()) || pers[pers.length-1] || null;
}
function tsPeriodDays(periodId){
  const [,moStr] = tsSelMonth().split('-');
  const pers = schPeriodsFor(+schAnchorYear(), +moStr);
  const pp = pers.find(p => p.id === periodId);
  return pp ? pp.days : [];
}
// Day columns of the current view. Every column carries the period that owns
// it (pid) and that period's day index (idx) — in the month view one screen
// can span several periods.
//   week  → the selected period, capped at 7 days when the range is longer
//   month → every day of the selected month ("Show 30 days" button)
function tsViewCols(period){
  if (tsViewIsMonth()) {
    const [y, mo] = tsSelMonth().split('-').map(Number);
    const periods = schPeriodsFor(y, mo);
    const dim = new Date(Date.UTC(y, mo, 0)).getDate();
    const cols = [];
    for (let dd = 1; dd <= dim; dd++) {
      const iso = `${y}-${String(mo).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
      const owners = periods.filter(p => p.days.some(x => x.iso === iso));
      if (!owners.length) continue;
      // Selected period wins, then custom (month-long) schedules, then the week.
      const per = owners.find(p => period && p.id === period.id)
        || owners.find(p => p.custom) || owners[0];
      const idx = per.days.findIndex(x => x.iso === iso);
      const d = per.days[idx];
      cols.push({ num: d.num, dow: d.dow, iso: d.iso, pid: per.id, idx });
    }
    return cols;
  }
  if (!period || !period.days) return [];
  const days = period.days.length > 7 ? period.days.slice(0, 7) : period.days;
  return days.map((d, i) => ({ num: d.num, dow: d.dow, iso: d.iso, pid: period.id, idx: i }));
}
// Shift id of every visible cell for one employee (rosters cached per period).
function tsRowCells(empId, cols){
  const cache = {};
  return cols.map(c => {
    if (!cache[c.pid]) cache[c.pid] = schRoster(empId, c.pid, tsPeriodLen(c.pid));
    return cache[c.pid][c.idx];
  });
}
// Same-weekday indices inside a period: this day plus every +7 days after it.
// Periods of a week or less have nothing to repeat, so they return just [day].
function tsRepeatIdx(dayIdx, len){
  const out = [];
  for(let i = dayIdx; i < len; i += 7) out.push(i);
  return out.length ? out : [Math.min(dayIdx, len - 1)];
}

// --- Render ------------------------------------------------------------------
function renderTeamSchedule() {
  const win = schMonthWindow(8, 3);              // all 12 months of the year (Jan–Dec)
  const selMo = tsSelMonth();
  const [,selMm] = selMo.split('-');
  const periods = schPeriodsFor(+schAnchorYear(), +selMm);
  const selPer = tsSelPeriod();
  const period = periods.find(p => p.id === selPer) || periods[periods.length-1];
  // Day columns actually rendered — 7 days by default for ranges longer than a
  // week; the always-visible "Show 30 days" button switches to the whole month.
  const viewCols = tsViewCols(period);
  const lock = schLockState(selMo);
  const canEdit = true; // allow assigning/editing in every month
  const isEditMode = !!state.tsEditing && canEdit;
  const isDeleting = !!state.tsDeleting && isEditMode;
  const teamRows = MOCK.teamMembers.slice(0, 8);
  // Same page, renamed for the Branch Manager / Team Leader preview (both get
  // the BM's page set — see navPools() in core.js).
  const schedTitle = (MOCK.currentUser.role === 'Branch Manager' || MOCK.currentUser.role === 'Team Leader') ? 'Branch Schedule' : 'Team Schedule';

  // header meta
  const histDesc = lock === 'current'
    ? 'Live month — pick a period below to view or assign shifts.'
    : lock === 'past'
      ? 'Past month — archived schedules, still editable.'
      : 'Future month — plan ahead and assign shifts.';

  // stats for the visible days (7-day view or whole month)
  const assignedCount = teamRows.reduce((acc, m) =>
    acc + tsRowCells(m.id, viewCols).filter(sid => !getShiftTemplate(sid).isOff).length, 0);
  const legend = MOCK.shiftTemplates.filter(t => !t.isOff).map(t => `
    <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded inline-block border" style="background:${t.bgColor};border-color:${t.color}40"></span>${t.name}</span>
  `).join('') + `<span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded inline-block border border-charcoal-200 bg-charcoal-100"></span>Off</span>`;
  const monthLabel = schMonthLabel(+selMo.split('-')[0], +selMo.split('-')[1]);

  return `<div class="min-h-full flex flex-col gap-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-charcoal-900">${schedTitle}</h1>
          <p class="text-xs text-charcoal-500 mt-0.5">${histDesc}</p>
        </div>
      </div>
      <div class="flex gap-1.5 flex-wrap">
        ${canEdit ? `
        <button onclick="openCreateScheduleModal()" class="btn btn-sm btn-primary">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Create New Schedule
        </button>
        <button onclick="state.tsEditing=${isEditMode?'false':'true'};renderAll()" class="btn btn-sm ${isEditMode?'btn-primary':'btn-secondary'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          ${isEditMode?'Finish Editing':'Assign Shifts'}
        </button>
        ${isEditMode ? `<button onclick="confirmTsPublish(${(period?`'${period.id}'`: '""')})" class="btn btn-sm btn-primary">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Publish
        </button>` : ''}` : ``}
        <button onclick="openShiftTemplateModal()" class="btn btn-sm btn-secondary" title="Create a shift template — it appears in the paint palette and the schedule legend"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Template</button>
      </div>
    </div>

    <!-- Combined: Month + Periods + Actions -->
    <div class="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <!-- Month dropdown + Live badge + Actions -->
      <div class="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap">
        <label class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wide shrink-0">Month</label>
        <select onchange="selectTsMonth(this.value)" class="flex-1 max-w-[220px] rounded-lg border border-charcoal-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-charcoal-800 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer">
          ${win.map(m => {
            const ym = m.ym;
            const st = schLockState(ym);
            return `<option value="${ym}" ${ym===selMo?'selected':''}>${schMonthLabel(m.year, m.month)}</option>`;
          }).join('')}
        </select>
        <span class="flex items-center gap-1 text-[10px] font-semibold ${lock==='current'?'text-brand-600':lock==='past'?'text-charcoal-400':'text-charcoal-400'} shrink-0">
          <span class="inline-block w-1.5 h-1.5 rounded-full ${lock==='current'?'bg-brand-500':lock==='past'?'bg-charcoal-300':'bg-charcoal-300'}"></span>
          ${lock==='current'?'Live':lock==='past'?'Past':'Planned'}
        </span>
        <div class="ml-auto flex gap-1.5 shrink-0">
          ${canEdit ? `
          <button onclick="fillTsAll()" class="btn btn-sm btn-secondary" ${isEditMode?'':'style=\"visibility:hidden\"'}>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            Fill All
          </button>
          <button onclick="resetTsPeriod('${period.id}')" class="btn btn-sm btn-secondary" ${isEditMode?'':'style=\"visibility:hidden\"'}>Reset</button>
          <button onclick="deleteTsSchedule('${period.id}')" class="btn btn-sm btn-danger-outline" title="Set every shift in this period back to Off">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Delete Schedule
          </button>` : ''}
          <button onclick="toggleTsView()" class="btn btn-sm ${tsViewIsMonth()?'btn-primary':'btn-secondary'}" title="${tsViewIsMonth()?'Back to the 7-day view — shifts repeat weekly':'Show the whole month (up to 30 days)'}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            ${tsViewIsMonth() ? 'Show 7 days' : 'Show 30 days'}
          </button>
        </div>
      </div>
      <!-- Period strip -->
      <div class="px-4 pb-3 flex gap-1.5 overflow-x-auto">
        ${periods.map(p => {
          const active = p.id === selPer;
          const pub = schPubFlag(p.id);
          const badge = p.custom ? '<span class="badge badge-purple">Custom</span>' : pub ? '<span class="badge badge-blue">Published</span>' : '<span class="badge badge-yellow">Draft</span>';
          return `<button onclick="selectTsPeriod('${p.id}')" class="shrink-0 text-left rounded-lg border px-2.5 py-1.5 transition-all ${active?'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 shadow-sm':'border-charcoal-200 hover:border-charcoal-300 hover:bg-charcoal-50/60'}">
            <div class="flex items-center gap-2">
              <p class="text-[11px] font-bold text-charcoal-900 whitespace-nowrap">${p.label}</p>
              ${badge}
            </div>
            <p class="text-[9px] text-charcoal-500 mt-0.5 whitespace-nowrap">${p.days.length} days · ${teamRows.length} employees</p>
          </button>`;
        }).join('')}
      </div>
      ${period ? `
      <!-- Period hint -->
      <div class="px-4 py-2 border-t border-charcoal-100">
        <p class="text-[10px] text-charcoal-400">${canEdit?(isEditMode?'Editing enabled — pick a shift below, then click or drag across the grid to paint it. Row ➤ and day ⬇ buttons fill in one click.':'Preview — read only.')+(tsViewIsMonth()?' Whole month visible — shifts painted on a weekday repeat on the same weekday of every following week.':'')+(!tsViewIsMonth()&&period&&period.days.length>7?' This range shows 7 days at a time — every shift repeats on the same weekday of the following weeks. Use “Show 30 days” for the whole month.':''):''}</p>
      </div>
      ${isEditMode ? `
      <!-- Paint palette -->
      <div class="px-4 py-2 border-t border-charcoal-100 bg-brand-50/40 flex items-center gap-1.5 flex-wrap">
        <span class="text-[10px] font-semibold text-charcoal-600 mr-1 shrink-0">Paint shift:</span>
        ${MOCK.shiftTemplates.map(tp => {
          const sel = tsPaintSid() === tp.id;
          return `<button onclick="setTsPaint('${tp.id}')" class="shrink-0 flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-[10px] font-semibold transition-all ${sel?'border-brand-500 ring-2 ring-brand-400 shadow-sm':'border-charcoal-200 hover:border-charcoal-300'}">
            <span class="w-2.5 h-2.5 rounded border" style="background:${tp.bgColor};border-color:${tp.color}40"></span>${tp.name}${tp.isOff?'':`<span class="font-normal text-charcoal-400">${tp.start}–${tp.end}</span>`}
          </button>`;
        }).join('')}
        <span class="text-[10px] text-charcoal-400 ml-auto hidden sm:inline">Click a cell or drag across the grid to paint it.</span>
      </div>` : ''}
      <!-- stats + legend -->
      <div class="flex items-center gap-4 px-4 py-2 border-b border-charcoal-100 bg-charcoal-50/40 text-[10px] text-charcoal-500 flex-wrap">
        <span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>${tsViewIsMonth() ? viewCols.length+' days · whole '+monthLabel : (viewCols.length < period.days.length ? viewCols.length+' of '+period.days.length+' days (weekly repeat)' : period.days.length+' days')}</span>
        <span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>${teamRows.length} employees</span>
        <span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${assignedCount} shifts assigned</span>
        <span class="ml-auto inline-flex items-center gap-3 flex-wrap">${legend}</span>
      </div>

      <!-- desktop table -->
      <div class="table-responsive hidden lg:flex flex-1 min-h-0 overflow-y-auto">
        <table class="data-table" style="flex:1 1 auto">
          <thead><tr><th class="sticky left-0 bg-charcoal-50 z-10">Employee</th>${viewCols.map(col=>`<th class="text-center">${col.num}<br/><span class="text-[9px] font-normal text-charcoal-400">${col.dow}</span>${isEditMode?`<button onclick="fillTsDay('${col.pid}',${col.idx})" title="Apply the selected shift to everyone on ${col.dow} ${col.num}${tsPeriodLen(col.pid)>7?' — and on this weekday of every following week':''}" class="block mx-auto mt-0.5 p-0.5 rounded hover:bg-brand-100 text-charcoal-400 hover:text-brand-600"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M19 12l-7 7-7-7"/></svg></button>`:''}</th>`).join('')}</tr></thead>
          <tbody>${teamRows.map(m => {
            const cells = tsRowCells(m.id, viewCols);
            return `<tr><td class="sticky left-0 bg-white z-10"><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.position}</p></div>${isEditMode?`<button onclick="fillTsRow('${m.id}')" title="Fill every visible day for ${m.name} with the selected shift" class="ml-auto shrink-0 p-1 rounded hover:bg-brand-100 text-charcoal-400 hover:text-brand-600"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12h16m0 0l-6-6m6 6l-6 6"/></svg></button>`:''}</div></td>${
              cells.map((sid,vi)=>{
                const col = viewCols[vi];
                const t=getShiftTemplate(sid); const c=getShiftColor(t);
                if(isEditMode){
                  return `<td class="text-center"><button onmousedown="tsPaintDown(event);paintTsCell(this,'${m.id}','${col.pid}',${col.idx})" onmouseenter="tsPaintOver(this,'${m.id}','${col.pid}',${col.idx})" class="schedule-shift-badge cursor-pointer hover:opacity-90 hover:ring-1 hover:ring-brand-400 text-[10px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40" data-iso="${col.iso}" data-sid="${sid}">${t.isOff?'OFF':t.start+'–'+t.end}</button></td>`;
                }
                return `<td class="text-center"><span class="schedule-shift-badge text-[10px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40">${t.isOff?'OFF':t.start}</span></td>`;
              }).join('')
            }</tr>`;
          }).join('')}</tbody>
        </table>
      </div>

      <!-- mobile cards -->
      <div class="space-y-1.5 p-3 lg:hidden">${teamRows.map(m => {
        const cells = tsRowCells(m.id, viewCols);
        return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
          <div class="flex items-center gap-2 mb-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><span class="text-xs font-medium text-charcoal-900">${m.name}</span></div>
          <div class="flex gap-1 flex-wrap">${cells.map((sid,vi)=>{
            const col = viewCols[vi];
            const t=getShiftTemplate(sid); const c=getShiftColor(t);
            return `<span class="schedule-shift-badge text-[9px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40">${col.num}/${col.dow}: ${t.isOff?'OFF':t.start+'–'+t.end}</span>`;
          }).join('')}</div>
        </div>`;
      }).join('')}</div>
    </div>
    ` : `<div class="bg-white rounded-xl border border-charcoal-200 p-6 text-center"><p class="text-xs text-charcoal-500">Pick a period above to view its roster.</p></div>`}
  </div>`;
}

// Publication bookkeeping (prototype-grade: tracked in-memory per period).
function schPubFlags(){ if(!MOCK.__pub){MOCK.__pub={};} return MOCK.__pub; }
function schPubFlag(pid){ return !!schPubFlags()[pid]; }
function schCustomPeriods(){ if(!MOCK.__customPeriods) MOCK.__customPeriods={}; return MOCK.__customPeriods; }

// --- Interactions -------------------------------------------------------------
function selectTsMonth(ym){ state.tsMonth = ym; delete state.tsPeriod; state.tsEditing = false; state.tsDeleting = false; renderAll(); }
function selectTsPeriod(pid){ state.tsPeriod = pid; state.tsEditing = false; state.tsDeleting = false; renderAll(); }
function confirmTsPublish(pid){
  if(!pid) return;
  schPubFlags()[pid] = true;
  state.tsEditing = false;
  state.tsDeleting = false;
  renderAll();
  showToast(`Schedule for ${pid} published 🎉`);
}
function resetTsPeriod(pid){
  const membs = MOCK.teamMembers.slice(0,8);
  membs.forEach(m => { delete schOverrideStore()[`${m.id}|${pid}`]; });
  renderAll();
  showToast(`Period ${pid} reset to automatic draft`,'info');
}
function openCreateScheduleModal(){
  const ym = tsSelMonth();
  const [yr, mo] = ym.split('-').map(Number);
  const dim = new Date(Date.UTC(yr, mo, 0)).getDate();
  const monthLabel = schMonthLabel(yr, mo);
  const content = `
    <div class="space-y-4">
      <div>
        <label class="block text-[11px] font-medium text-charcoal-700 mb-1">Month</label>
        <input type="text" value="${monthLabel}" readonly class="w-full px-3 py-2 rounded-lg border border-charcoal-200 bg-charcoal-50 text-xs text-charcoal-700 cursor-not-allowed">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-medium text-charcoal-700 mb-1">Start Date</label>
          <input type="date" id="cs-start" value="${ym}-01" min="${ym}-01" max="${ym}-${String(dim).padStart(2,'0')}" class="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
        </div>
        <div>
          <label class="block text-[11px] font-medium text-charcoal-700 mb-1">End Date</label>
          <input type="date" id="cs-end" value="${ym}-${String(dim).padStart(2,'0')}" min="${ym}-01" max="${ym}-${String(dim).padStart(2,'0')}" class="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500">
        </div>
      </div>
      <p class="text-[10px] text-charcoal-400">Choose a date range within ${monthLabel}. A new schedule period will be created and you can start assigning shifts immediately. Ranges longer than a week open in a 7-day view where every shift repeats on the same weekday of the following weeks — the “Show 30 days” button reveals the full range (up to the whole month).</p>
    </div>`;
  openModal('Create New Schedule', content, {
    wide: true,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
             <button onclick="confirmCreateSchedule()" class="btn btn-sm btn-primary">Create Schedule</button>`
  });
}
function confirmCreateSchedule(){
  const startEl = document.getElementById('cs-start');
  const endEl = document.getElementById('cs-end');
  if(!startEl||!endEl) return;
  const startIso = startEl.value;
  const endIso = endEl.value;
  if(!startIso || !endIso){ showToast('Please select both dates','error'); return; }
  if(startIso > endIso){ showToast('Start date must be before end date','error'); return; }
  // Generate days array
  const days = [];
  const d = new Date(startIso+'T00:00:00Z');
  const end = new Date(endIso+'T00:00:00Z');
  while(d <= end){
    days.push({
      iso: d.toISOString().slice(0,10),
      num: d.getUTCDate(),
      dow: d.toLocaleDateString('en-US',{weekday:'short'}),
    });
    d.setUTCDate(d.getUTCDate()+1);
  }
  if(days.length === 0){ showToast('Date range is empty','error'); return; }
  const fmt = o => new Date(o.iso+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const ym = startIso.slice(0,7);
  const periodId = 'custom-'+startIso.replace(/-/g,'')+'-'+endIso.replace(/-/g,'');
  const period = {
    id: periodId,
    start: startIso,
    end: endIso,
    label: `${fmt(days[0])} – ${fmt(days[days.length-1])}`,
    days: days,
    custom: true,
  };
  // Store
  if(!schCustomPeriods()[ym]) schCustomPeriods()[ym] = [];
  // Remove existing custom with same id (re-create)
  schCustomPeriods()[ym] = schCustomPeriods()[ym].filter(p => p.id !== periodId);
  schCustomPeriods()[ym].push(period);
  // Select and enter edit mode (new ranges open in the 7-day view)
  state.tsMonth = ym;
  state.tsPeriod = periodId;
  state.tsEditing = true;
  state.tsView = 'week';
  closeModal();
  renderAll();
  showToast(`Custom schedule created: ${period.label}`);
}
// --- Fast painting (palette + drag + row/day fills) ---------------------------
// Replaces the old one-click-per-day rotation: pick a shift once, then click
// or drag across the grid to stamp it. Row/day/all fills cover bulk edits.
let _tsPainting = false;
function tsPaintSid() {
  return state.tsPaint || (MOCK.shiftTemplates.find(t => !t.isOff) || MOCK.shiftTemplates[0]).id;
}
function setTsPaint(sid) { state.tsPaint = sid; renderAll(); }
function tsPeriodLen(periodId) {
  const [, moStr] = tsSelMonth().split('-');
  const pers = schPeriodsFor(+schAnchorYear(), +moStr);
  const pp = pers.find(p => p.id === periodId);
  return pp ? pp.days.length : 7;
}
function styleTsCell(btn, sid) {
  const t = getShiftTemplate(sid); const c = getShiftColor(t);
  btn.setAttribute('data-sid', sid);
  btn.style.background = c.bg; btn.style.color = c.text; btn.style.borderColor = c.border + '40';
  btn.textContent = t.isOff ? 'OFF' : t.start + '–' + t.end;
}
function paintTsCell(btn, empId, periodId, dayIdx) {
  const sid = tsPaintSid();
  const len = tsPeriodLen(periodId);
  const roster = schRoster(empId, periodId, len);
  // Ranges longer than a week: the painted shift also lands on the same
  // weekday of every following week inside the period (weekly repeat).
  // tsRepeatIdx() returns just [dayIdx] for periods of 7 days or less.
  const idxs = tsRepeatIdx(dayIdx, len);
  if (idxs.every(i => roster[i] === sid)) return;
  idxs.forEach(i => { roster[i] = sid; });
  schPersist(empId, periodId, roster);
  styleTsCell(btn, sid);
  // Keep the same-weekday cells of this row in sync (Show 30 days view).
  const days = tsPeriodDays(periodId);
  const isos = idxs.map(i => days[i] ? days[i].iso : null).filter(Boolean);
  const row = btn.closest('tr');
  if (row) row.querySelectorAll('button[data-iso]').forEach(b => {
    if (isos.includes(b.getAttribute('data-iso'))) styleTsCell(b, sid);
  });
}
function tsPaintDown(ev) { if (ev) ev.preventDefault(); _tsPainting = true; }
function tsPaintOver(btn, empId, periodId, dayIdx) { if (_tsPainting) paintTsCell(btn, empId, periodId, dayIdx); }
document.addEventListener('mouseup', () => { _tsPainting = false; });
// Row ➤ — fill the whole visible schedule of one employee. In the 7-day view
// that is the selected period; in the "Show 30 days" view it is every period
// the month is made of (each week / custom range owns its own days).
function fillTsRow(empId) {
  const sid = tsPaintSid();
  const pids = [...new Set(tsViewCols(tsCurrentPeriod()).map(c => c.pid))];
  if (!pids.length) return;
  pids.forEach(pid => schPersist(empId, pid, Array(tsPeriodLen(pid)).fill(sid)));
  renderAll();
  showToast(`Whole visible schedule set to ${getShiftTemplate(sid).name}`);
}
function fillTsDay(periodId, dayIdx) {
  const len = tsPeriodLen(periodId); const sid = tsPaintSid();
  const idxs = tsRepeatIdx(dayIdx, len);
  MOCK.teamMembers.slice(0, 8).forEach(m => {
    const r = schRoster(m.id, periodId, len);
    idxs.forEach(i => { r[i] = sid; });
    schPersist(m.id, periodId, r);
  });
  renderAll();
  showToast(`Day ${dayIdx + 1} set to ${getShiftTemplate(sid).name} for everyone${idxs.length > 1 ? ' — repeated on the same weekday of the following weeks' : ''}`);
}
// Toolbar Fill All — same as the row fill, but for every employee.
function fillTsAll() {
  const sid = tsPaintSid();
  const pids = [...new Set(tsViewCols(tsCurrentPeriod()).map(c => c.pid))];
  if (!pids.length) return;
  if (!confirm(`Set every employee's visible schedule to ${getShiftTemplate(sid).name}?`)) return;
  MOCK.teamMembers.forEach(m => pids.forEach(pid => schPersist(m.id, pid, Array(tsPeriodLen(pid)).fill(sid))));
  renderAll();
  showToast(`Entire visible schedule filled with ${getShiftTemplate(sid).name}`);
}

function deleteTsSchedule(periodId){
  if(!confirm('Delete all shifts in this period? This cannot be undone.')) return;
  const [,moStr] = tsSelMonth().split('-');
  const pers = schPeriodsFor(+schAnchorYear(), +moStr);
  const pp = pers.find(p=>p.id===periodId);
  const len = pp ? pp.days.length : 7;
  MOCK.teamMembers.forEach(m => {
    schPersist(m.id, periodId, Array(len).fill('st-off'));
  });
  showToast('Schedule deleted — all shifts set to OFF');
  renderAll();
}

// ==================== SHIFT MANAGEMENT ====================
let _saSelectedTemplate = null; // currently selected palette template for painting
let _saFilterRole = 'all';

function renderShiftManagement() {
  const days = ['Mon 25','Tue 26','Wed 27','Thu 28','Fri 29','Sat 30','Sun 31'];
  const templates = MOCK.shiftTemplates;
  const activeTemplates = templates.filter(t => !t.isOff);
  const offTemplate = templates.find(t => t.isOff);

  // Build team schedule from data (each employee mapped to template IDs)
  const teamData = MOCK.teamMembers.slice(0, 10).map(m => {
    const schedIds = MOCK.teamSchedule[m.id] || days.map(() => 'st-off');
    return { ...m, scheduleIds: schedIds };
  });

  // Filter team by role
  const roles = [...new Set(teamData.map(m => m.position))];
  // Drop a stale selection if the filtered role no longer exists
  if (_saFilterRole !== 'all' && !roles.includes(_saFilterRole)) _saFilterRole = 'all';
  const filteredTeam = _saFilterRole === 'all' ? teamData : teamData.filter(m => m.position === _saFilterRole);

  // Calculate stats — over the FILTERED team, so the summary always matches
  // the grid underneath it instead of reporting the whole branch.
  let totalHours = 0, morningCount = 0, eveningCount = 0, offCount = 0;
  const shiftCounts = {};
  templates.forEach(t => shiftCounts[t.id] = 0);

  filteredTeam.forEach(m => {
    m.scheduleIds.forEach(sid => {
      const t = getShiftTemplate(sid);
      const h = getShiftHours(t);
      totalHours += h;
      if (t.isOff) offCount++;
      else shiftCounts[t.id] = (shiftCounts[t.id] || 0) + 1;
    });
  });

  const maxHours = filteredTeam.length * days.length * 8;
  const utilization = maxHours > 0 ? Math.round((totalHours / maxHours) * 100) : 0;
  morningCount = shiftCounts['st-morning'] || 0;
  eveningCount = shiftCounts['st-evening'] || 0;

  // Selected template indicator
  const selTpl = _saSelectedTemplate ? getShiftTemplate(_saSelectedTemplate) : null;

  return `<div class="space-y-3">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-charcoal-900">Shift Management</h1>
        <p class="text-xs text-charcoal-500 mt-0.5">Cycle: Aug 25 – Aug 31, 2026 &middot; ${filteredTeam.length} employees</p>
      </div>
      <div class="flex gap-1.5 flex-wrap">
        <button onclick="state.tsEditing=true;navigateTo('team-schedule')" class="btn btn-sm btn-secondary">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          Assign Shifts
        </button>
        <button onclick="confirmTsPublish(tsSelPeriod())" class="btn btn-sm btn-primary">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Publish
        </button>
        <button onclick="showToast('Draft saved')" class="btn btn-sm btn-secondary">Save Draft</button>
      </div>
    </div>

    <!-- Stats Summary -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="grid grid-cols-2 sm:grid-cols-${Math.min(3 + activeTemplates.length, 6)} gap-3">
        <div class="sm:col-span-2">
          <p class="bento-label text-charcoal-500 mb-1">CYCLE UTILIZATION</p>
          <div class="flex items-end gap-2">
            <p class="text-2xl font-bold text-charcoal-900">${utilization}%</p>
            <p class="text-[10px] text-charcoal-500 mb-1">${totalHours}h scheduled</p>
          </div>
          <div class="w-full h-2 bg-charcoal-100 rounded-full mt-2 overflow-hidden">
            <div class="h-full bg-brand-500 rounded-full transition-all" style="width:${utilization}%"></div>
          </div>
        </div>
        ${activeTemplates.map(t => {
          const count = shiftCounts[t.id] || 0;
          return `<div class="text-center p-2 rounded-lg" style="background:${t.bgColor}20">
            <p class="text-lg font-bold" style="color:${t.color}">${count}</p>
            <p class="text-[10px] text-charcoal-500">${t.name} Shifts</p>
          </div>`;
        }).join('')}
        <div class="text-center p-2 rounded-lg bg-charcoal-50">
          <p class="text-lg font-bold text-charcoal-600">${offCount}</p>
          <p class="text-[10px] text-charcoal-500">Off Days</p>
        </div>
      </div>
    </div>

    <!-- Shift Templates Palette -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between mb-2">
        <p class="bento-label text-charcoal-500">SHIFT TEMPLATES (PALETTE)</p>
        <button onclick="openShiftTemplateModal()" class="text-[11px] text-brand-600 font-semibold flex items-center hover:underline">
          <svg class="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> New Template
        </button>
      </div>
      <p class="text-[11px] text-charcoal-400 mb-2.5">Select a template, then click grid cells to paint shifts. Click a cell without a selection to cycle.</p>
      <div class="flex items-center gap-2 flex-wrap" id="shift-palette">
        ${templates.map(t => `
          <button onclick="selectShiftTemplate('${t.id}')" class="shift-palette-btn ${_saSelectedTemplate === t.id ? 'ring-2 ring-offset-1' : ''}"
            style="background:${t.bgColor};color:${t.textColor};${_saSelectedTemplate === t.id ? 'ring-color:' + t.color : ''}">
            ${t.isOff
              ? `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>`
              : `<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${t.color}"></span>`
            }
            <span class="font-semibold text-[11px]">${t.name}</span>
            ${!t.isOff ? `<span class="text-[10px] opacity-70">${t.start}–${t.end}</span>` : ''}
          </button>
        `).join('')}
        ${selTpl ? `<button onclick="deselectShiftTemplate()" class="shift-palette-btn bg-red-50 text-red-600 border border-red-200">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          <span class="font-semibold text-[11px]">Clear Selection</span>
        </button>` : ''}
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white rounded-xl border border-charcoal-200 px-3 py-2 flex items-center gap-3">
      <span class="text-[11px] font-semibold text-charcoal-500">Filter:</span>
      <select onchange="_saFilterRole=this.value;renderAll()" class="text-[11px] bg-charcoal-50 border border-charcoal-200 rounded px-2 py-1 outline-none focus:border-brand-500">
        <option value="all" ${_saFilterRole==='all'?'selected':''}>All Roles</option>
        ${roles.map(r => `<option value="${r}" ${_saFilterRole===r?'selected':''}>${r}</option>`).join('')}
      </select>
      <div class="flex-1"></div>
      <span class="text-[10px] text-charcoal-400">${filteredTeam.length} employees</span>
    </div>

    <!-- Scheduling Grid (Desktop) -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th class="sticky left-0 bg-charcoal-50 z-10 min-w-[180px]">Employee / Role</th>
              <th class="text-center min-w-[50px]">Total</th>
              ${days.map(d => `<th class="text-center min-w-[100px]">${d}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredTeam.map(m => {
              let empHours = 0;
              const cells = m.scheduleIds.map((sid, i) => {
                const t = getShiftTemplate(sid);
                const h = getShiftHours(t);
                empHours += h;
                const c = getShiftColor(t);
                const isOff = t.isOff;
                return `<td class="text-center p-1.5">
                  <button onclick="paintShift(this,'${m.id}',${i})"
                    class="sa-cell-btn w-full rounded-lg text-[10px] font-semibold transition-all hover:scale-105 cursor-pointer border"
                    style="background:${c.bg};color:${c.text};border-color:${c.border}40"
                    data-template="${sid}" data-emp="${m.id}" data-day="${i}">
                    ${isOff
                      ? '<span class="opacity-60">OFF</span>'
                      : `<div class="leading-tight">${t.name}<br><span class="text-[9px] font-normal opacity-75">${t.start}–${t.end}</span></div>`
                    }
                  </button>
                </td>`;
              }).join('');
              const empPct = maxHours > 0 ? Math.round((empHours / (days.length * 8)) * 100) : 0;
              return `<tr>
                <td class="sticky left-0 bg-white z-10">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${m.initials}</div>
                    <div class="min-w-0">
                      <p class="text-xs font-medium text-charcoal-900 truncate">${m.name}</p>
                      <p class="text-[10px] text-charcoal-500">${m.position}</p>
                    </div>
                  </div>
                </td>
                <td class="text-center">
                  <div class="flex flex-col items-center gap-0.5">
                    <span class="text-[11px] font-bold text-charcoal-900">${empHours}h</span>
                    <div class="w-10 h-1.5 bg-charcoal-100 rounded-full overflow-hidden">
                      <div class="h-full ${empPct >= 75 ? 'bg-brand-500' : empPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'} rounded-full" style="width:${empPct}%"></div>
                    </div>
                  </div>
                </td>
                ${cells}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-2 lg:hidden">
      ${filteredTeam.map(m => {
        let empHours = 0;
        const badges = m.scheduleIds.map((sid, i) => {
          const t = getShiftTemplate(sid);
          const h = getShiftHours(t);
          empHours += h;
          const c = getShiftColor(t);
          return `<button onclick="paintShift(this,'${m.id}',${i})"
            class="sa-mobile-badge rounded px-1.5 py-0.5 text-[9px] font-semibold cursor-pointer border"
            style="background:${c.bg};color:${c.text};border-color:${c.border}40"
            data-template="${sid}" data-emp="${m.id}" data-day="${i}">
            ${days[i].split(' ')[0]}: ${t.isOff ? 'OFF' : t.start + '–' + t.end}
          </button>`;
        }).join('');
        return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-charcoal-900 truncate">${m.name}</p>
              <p class="text-[10px] text-charcoal-500">${empHours}h this cycle &middot; ${m.position}</p>
            </div>
          </div>
          <div class="flex gap-1 flex-wrap">${badges}</div>
        </div>`;
      }).join('')}
    </div>

    <!-- Quick Actions -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
      <div>
        <p class="text-xs font-semibold text-charcoal-900">Quick Actions</p>
        <p class="text-[10px] text-charcoal-500">Apply pattern to multiple employees</p>
      </div>
      <div class="flex gap-1.5">
        <button onclick="showToast('Previous cycle applied')" class="btn btn-sm btn-secondary">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>Copy Previous
        </button>
        <button onclick="showToast('Bulk assign...','info')" class="btn btn-sm btn-secondary">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"/></svg>Bulk Assign
        </button>
      </div>
    </div>
  </div>`;
}

// ===== SHIFT TEMPLATE PALETTE SELECTION =====
function selectShiftTemplate(id) {
  _saSelectedTemplate = (_saSelectedTemplate === id) ? null : id;
  renderAll();
}
function deselectShiftTemplate() {
  _saSelectedTemplate = null;
  renderAll();
}

// ===== PAINT / CYCLE SHIFT ON GRID CELL =====
function paintShift(btn, empId, dayIdx) {
  const templates = MOCK.shiftTemplates;
  const currentSid = btn.getAttribute('data-template');

  let newSid;
  if (_saSelectedTemplate) {
    // Paint the selected template
    newSid = _saSelectedTemplate;
  } else {
    // Cycle through all templates
    const ids = templates.map(t => t.id);
    const ci = ids.indexOf(currentSid);
    newSid = ids[(ci + 1) % ids.length];
  }

  // Update data model
  if (!MOCK.teamSchedule[empId]) MOCK.teamSchedule[empId] = templates.map(() => 'st-off');
  MOCK.teamSchedule[empId][dayIdx] = newSid;

  // Update the cell visually
  const t = getShiftTemplate(newSid);
  const c = getShiftColor(t);
  btn.setAttribute('data-template', newSid);
  btn.style.background = c.bg;
  btn.style.color = c.text;
  btn.style.borderColor = c.border + '40';
  btn.innerHTML = t.isOff
    ? '<span class="opacity-60">OFF</span>'
    : `<div class="leading-tight">${t.name}<br><span class="text-[9px] font-normal opacity-75">${t.start}–${t.end}</span></div>`;

  showToast(`Shift → ${t.name} (${t.isOff ? 'Off' : t.start + '–' + t.end})`);
}

// ===== SHIFT TEMPLATE MANAGEMENT MODAL =====
function openShiftTemplateModal(editId) {
  const editTpl = editId ? getShiftTemplate(editId) : null;
  const isEdit = !!editTpl;
  const title = isEdit ? 'Edit Shift Template' : 'Create Shift Template';
  const colors = SHIFT_PALETTE;

  const content = `
    <form onsubmit="event.preventDefault();saveShiftTemplate(${isEdit ? "'" + editId + "'" : 'null'})" class="space-y-4">
      <div>
        <label class="form-label">Template Name</label>
        <input type="text" id="tpl-name" class="form-input" value="${isEdit ? editTpl.name : ''}" placeholder="e.g. Early Morning, Split, Part-time" required>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Start Time</label>
          <input type="time" id="tpl-start" class="form-input" value="${isEdit && editTpl.start ? editTpl.start : '08:00'}" ${!isEdit || !editTpl.isOff ? 'required' : ''}>
        </div>
        <div>
          <label class="form-label">End Time</label>
          <input type="time" id="tpl-end" class="form-input" value="${isEdit && editTpl.end ? editTpl.end : '16:00'}" ${!isEdit || !editTpl.isOff ? 'required' : ''}>
        </div>
      </div>
      <div id="tpl-duration-preview" class="text-[11px] text-charcoal-500 bg-charcoal-50 rounded-lg px-3 py-2">
        ${isEdit && !editTpl.isOff ? 'Duration: ' + getShiftHours(editTpl) + ' hours' : 'Duration: 8.0 hours'}
      </div>
      <div>
        <label class="form-label">Off Day?</label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="tpl-isOff" class="rounded" ${isEdit && editTpl.isOff ? 'checked' : ''} onchange="toggleOffDayFields()">
          <span class="text-xs text-charcoal-600">Mark as Off Day (no hours)</span>
        </label>
      </div>
      <div>
        <label class="form-label">Color</label>
        <div class="flex flex-wrap gap-2" id="tpl-colors">
          ${colors.map((c, i) => {
            const selected = isEdit ? (editTpl.color === c) : (i === 0);
            return `<button type="button" onclick="selectTemplateColor('${c}')" class="w-7 h-7 rounded-full border-2 transition-all ${selected ? 'border-charcoal-800 scale-110' : 'border-transparent hover:scale-110'}" style="background:${c}" data-color="${c}"></button>`;
          }).join('')}
        </div>
        <input type="hidden" id="tpl-color" value="${isEdit ? editTpl.color : colors[0]}">
      </div>
      <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
        <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
        ${isEdit ? `<button type="button" onclick="deleteShiftTemplate('${editId}')" class="btn btn-sm btn-danger-outline mr-auto">Delete</button>` : ''}
        <button type="submit" class="btn btn-sm btn-primary">${isEdit ? 'Save Changes' : 'Create Template'}</button>
      </div>
    </form>`;

  openModal(title, content, { wide: true });

  // Wire up duration preview
  setTimeout(() => {
    const startEl = document.getElementById('tpl-start');
    const endEl = document.getElementById('tpl-end');
    const previewEl = document.getElementById('tpl-duration-preview');
    const offEl = document.getElementById('tpl-isOff');
    const updatePreview = () => {
      if (offEl.checked) { previewEl.textContent = 'Off Day — 0 hours'; return; }
      const s = startEl.value, e = endEl.value;
      if (!s || !e) { previewEl.textContent = 'Set start and end times'; return; }
      let [sh, sm] = s.split(':').map(Number), [eh, em] = e.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 1440;
      previewEl.textContent = 'Duration: ' + (Math.round((mins / 60) * 10) / 10) + ' hours';
    };
    if (startEl) startEl.addEventListener('change', updatePreview);
    if (endEl) endEl.addEventListener('change', updatePreview);
    if (offEl) offEl.addEventListener('change', updatePreview);
  }, 50);
}

function toggleOffDayFields() {
  const isOff = document.getElementById('tpl-isOff').checked;
  document.getElementById('tpl-start').disabled = isOff;
  document.getElementById('tpl-end').disabled = isOff;
  document.getElementById('tpl-start').required = !isOff;
  document.getElementById('tpl-end').required = !isOff;
  document.getElementById('tpl-duration-preview').textContent = isOff ? 'Off Day — 0 hours' : 'Set start and end times';
}

function selectTemplateColor(color) {
  document.getElementById('tpl-color').value = color;
  document.querySelectorAll('#tpl-colors button').forEach(b => {
    if (b.getAttribute('data-color') === color) {
      b.classList.add('border-charcoal-800', 'scale-110');
      b.classList.remove('border-transparent');
    } else {
      b.classList.remove('border-charcoal-800', 'scale-110');
      b.classList.add('border-transparent');
    }
  });
}

function saveShiftTemplate(editId) {
  const name = document.getElementById('tpl-name').value.trim();
  const start = document.getElementById('tpl-start').value || null;
  const end = document.getElementById('tpl-end').value || null;
  const color = document.getElementById('tpl-color').value;
  const isOff = document.getElementById('tpl-isOff').checked;

  if (!name) { showToast('Please enter a template name', 'error'); return; }

  // Generate complementary colors
  const bg = hexToRGBA(color, 0.12);
  const textColor = isLightColor(color) ? darkenHex(color, 40) : lightenHex(color, 40);

  if (editId) {
    // Update existing
    const tpl = getShiftTemplate(editId);
    Object.assign(tpl, { name, start: isOff ? null : start, end: isOff ? null : end, color, bgColor: bg, textColor, isOff });
    showToast(`"${name}" template updated`);
  } else {
    // Create new
    MOCK.shiftTemplates.splice(MOCK.shiftTemplates.length - 1, 0, { // insert before Off Day
      id: generateShiftId(), name, start: isOff ? null : start, end: isOff ? null : end,
      color, bgColor: bg, textColor, isOff
    });
    showToast(`"${name}" template created`);
  }

  closeModal();
  renderAll();
}

function deleteShiftTemplate(id) {
  const tpl = getShiftTemplate(id);
  if (!tpl) return;
  openModal('Delete Template', `
    <p class="text-xs text-charcoal-600 mb-3">Are you sure you want to delete <strong>"${tpl.name}"</strong>? All cells using this shift will be set to Off Day.</p>
    <div class="flex justify-end gap-2">
      <button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="confirmDeleteShiftTemplate('${id}')" class="btn btn-sm btn-danger">Delete</button>
    </div>
  `);
}

function confirmDeleteShiftTemplate(id) {
  // Reassign any cells using this template to off
  const offId = MOCK.shiftTemplates.find(t => t.isOff)?.id || 'st-off';
  Object.values(MOCK.teamSchedule).forEach(sched => {
    sched.forEach((sid, i) => { if (sid === id) sched[i] = offId; });
  });
  // Remove template
  MOCK.shiftTemplates = MOCK.shiftTemplates.filter(t => t.id !== id);
  if (_saSelectedTemplate === id) _saSelectedTemplate = null;
  closeModal();
  showToast('Template deleted');
  renderAll();
}

// ===== COLOR UTILITIES =====
function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function isLightColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
function darkenHex(hex, amount) {
  let r = Math.max(0, parseInt(hex.slice(1,3),16) - amount);
  let g = Math.max(0, parseInt(hex.slice(3,5),16) - amount);
  let b = Math.max(0, parseInt(hex.slice(5,7),16) - amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function lightenHex(hex, amount) {
  let r = Math.min(255, parseInt(hex.slice(1,3),16) + amount);
  let g = Math.min(255, parseInt(hex.slice(3,5),16) + amount);
  let b = Math.min(255, parseInt(hex.slice(5,7),16) + amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ==================== TEAM ACTIONS ====================
function renderTeamUpdates() {
  const sevColor = {high:'badge-red',medium:'badge-yellow',low:'badge-blue'};
  const sevBorder = {high:'border-l-red-400',medium:'border-l-yellow-400',low:'border-l-blue-400'};
  const sevBg = {high:'bg-red-50/50',medium:'bg-yellow-50/50',low:'bg-blue-50/50'};
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Team Actions</h1><p class="text-xs text-charcoal-500 mt-0.5">${MOCK.followUpItems.length} items requiring attention</p></div>
      <button onclick="openBranchActions()" class="btn btn-sm btn-primary flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Take Action</button>
    </div>
    <div class="space-y-1.5">${MOCK.followUpItems.map(f=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 border-l-4 ${sevBorder[f.severity]} ${sevBg[f.severity]}">
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${f.employee.split(' ').map(w=>w[0]).join('')}</div>
          <div>
            <p class="text-xs font-semibold text-charcoal-900">${f.employee}</p>
            <p class="text-[10px] text-charcoal-500">${f.type}</p>
            <p class="text-xs text-charcoal-600 mt-1">${f.description}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span class="badge ${sevColor[f.severity]}">${f.severity}</span>
          <button onclick="openFollowUp('${f.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Action</button>
        </div>
      </div>
    </div>`).join('')}</div>
  </div>`;
}

// ==================== RECRUITMENT REQUESTS ====================
// ==================== RECRUITMENT (Branch) ====================
// Pipeline: BM requests a position with the shift + salary he needs -> HR
// approves/rejects -> approved requests wait until HR sends a candidate from the
// waiting list -> the BM calls the candidate, schedules and holds the 2nd
// interview -> Accepted (HR creates the account) or Rejected (back to waiting).
// The visible stage is derived from who owns which field, so the branch and HR
// portals never fight over a stored status.
const REC_STAGES = [
  { id:'hrReview',     label:'HR review',           bg:'bg-purple-50', text:'text-purple-700' },
  { id:'waitingMatch', label:'Waiting for a match', bg:'bg-yellow-50', text:'text-yellow-700' },
  { id:'matched',      label:'Candidate matched',   bg:'bg-blue-50',   text:'text-blue-700' },
  { id:'iv2',          label:'2nd interview',       bg:'bg-brand-50',  text:'text-brand-700' },
  { id:'offerOut',     label:'Hired · account',     bg:'bg-green-50',  text:'text-green-700' },
];
const REC_STAGE_REJECTED = { id:'rejected', label:'Rejected by HR', bg:'bg-red-50', text:'text-red-700' };

function recStageOf(r) {
  if (r.status === 'Rejected') return 'rejected';
  if (r.match) {
    if (r.iv2 && r.iv2.verdict === 'Accept') return 'offerOut';
    if (r.iv2 && r.iv2.verdict === 'Reject') return 'waitingMatch';
    if (r.iv2) return 'iv2';
    return 'matched';
  }
  return r.status === 'Approved' ? 'waitingMatch' : 'hrReview';
}
function recStageMeta(id) {
  return id === 'rejected' ? REC_STAGE_REJECTED : (REC_STAGES.find(s => s.id === id) || REC_STAGES[0]);
}
function recChip(text, cls) {
  return `<span class="inline-flex items-center gap-1 ${cls} rounded-full px-2 py-0.5 text-[9px] font-semibold">${text}</span>`;
}

let _recTab = 'open';
// The tab bar stays short on purpose: the two HR stages share one tab, and the
// two interview stages share another — the card chips still show the exact step.
const REC_TABS = [
  { id:'open',      label:'Open Positions' },
  { id:'hr',        label:'Hr Accepted' },
  { id:'interview', label:'To call & interview' },
  { id:'hired',     label:'Hired' },
  { id:'rejected',  label:'Rejected' },
];
function recMatchesTab(r, tab) {
  const s = recStageOf(r);
  if (tab === 'open') return s !== 'rejected';
  if (tab === 'hr') return s === 'hrReview' || s === 'waitingMatch';
  if (tab === 'interview') return s === 'matched' || s === 'iv2';
  if (tab === 'hired') return s === 'offerOut';
  return s === 'rejected';
}
function recSetTab(id){ _recTab = id; renderAll(); }

function renderRecruitment() {
  const reqs = MOCK.recruitmentRequests;
  const urgencyBadge = { High:'badge-red', Medium:'badge-yellow', Low:'badge-blue' };
  const openPositions = reqs.reduce((s,r)=>s+r.count,0);
  const shown = reqs.filter(r => recMatchesTab(r, _recTab));

  const tabs = REC_TABS.map(t => {
    const n = reqs.filter(r => recMatchesTab(r, t.id)).length;
    const on = _recTab === t.id;
    return `<button onclick="recSetTab('${t.id}')" class="tab-btn ${on?'active':''}">${t.label}
      <span class="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${on ? 'bg-brand-100 text-brand-700' : n ? 'bg-charcoal-100 text-charcoal-600' : 'bg-charcoal-50 text-charcoal-400'}">${n}</span></button>`;
  }).join('');

  const cards = shown.map(r=>{
    const meta = recStageMeta(recStageOf(r));
    return `<div class="bg-white rounded-xl border ${recStageOf(r)==='matched' ? 'border-brand-300 ring-1 ring-brand-200' : 'border-charcoal-200'} p-3 card-interactive" onclick="openRecruitmentDetail('${r.id}')">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4 ${meta.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 118 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg></div>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-charcoal-900 truncate">${r.position}${r.count > 1 ? ` <span class="text-charcoal-500 font-normal">x${r.count}</span>` : ''}</p>
            <p class="text-[10px] text-charcoal-500 truncate">${r.department ? r.department + ' · ' : ''}${r.requestedBy} · ${r.date}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class="badge ${urgencyBadge[r.urgency]} text-[9px]">${r.urgency}</span>
          ${recChip(meta.label, meta.bg + ' ' + meta.text)}
        </div>
      </div>
      <p class="text-[10px] text-charcoal-600 mt-2">${r.reason}</p>
      <div class="flex items-center gap-1.5 mt-2 flex-wrap">
        ${recChip('Wants ' + (r.shift || 'any shift'), 'bg-charcoal-50 text-charcoal-600')}
        ${recChip('EGP ' + (r.expectedSalary ? r.expectedSalary.toLocaleString() : '—'), 'bg-charcoal-50 text-charcoal-600')}
        ${r.match ? recChip('Match: ' + r.match.name + (r.iv2 && r.iv2.verdict === 'Accept' ? ' · accepted' : r.iv2 && r.iv2.verdict === 'Reject' ? ' · rejected' : r.iv2 ? ' · interview scheduled' : ' · call him'), r.iv2 && r.iv2.verdict === 'Reject' ? 'bg-charcoal-50 text-charcoal-500' : 'bg-blue-50 text-blue-700') : ''}
      </div>
    </div>`;}).join('');

  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Recruitment</h1><p class="text-xs text-charcoal-500 mt-0.5">${openPositions} open positions · ${reqs.length} requests</p></div>
      <button onclick="openNewRecruitment()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Request</button>
    </div>

    <!-- Stage tabs -->
    <div class="bg-white rounded-xl border border-charcoal-200 px-1.5 flex overflow-x-auto">${tabs}</div>

    <!-- Request Cards -->
    ${shown.length ? `<div class="space-y-1.5">${cards}</div>`
      : `<div class="bg-white rounded-xl border border-charcoal-200 p-8 text-center"><p class="text-xs text-charcoal-500">No requests here right now.</p></div>`}
  </div>`;
}

function openRecruitmentDetail(id) {
  const r = MOCK.recruitmentRequests.find(x=>x.id===id);
  if(!r) return;
  const urgencyBadge = { High:'badge-red', Medium:'badge-yellow', Low:'badge-blue' };
  const stage = recStageOf(r);
  const meta = recStageMeta(stage);

  // --- matching criteria the BM asked for ---
  const criteria = `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
    <div class="px-3 py-2 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">WHAT YOU ASKED FOR</p></div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
      <div><p class="bento-label text-charcoal-500">Position</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${r.position}${r.count>1?' x'+r.count:''}</p></div>
      <div><p class="bento-label text-charcoal-500">Shift</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${r.shift || 'Any'}</p></div>
      <div><p class="bento-label text-charcoal-500">Expected salary</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">EGP ${r.expectedSalary ? r.expectedSalary.toLocaleString() : '—'}</p></div>
      <div><p class="bento-label text-charcoal-500">Requested by</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${r.requestedBy}</p></div>
    </div>
  </div>`;

  // --- what happens next, per stage ---
  let nextHtml = '';
  if (stage === 'hrReview') {
    nextHtml = `<div class="bg-purple-50 border border-purple-100 rounded-xl p-3">
      <p class="text-xs font-bold text-purple-800 mb-0.5">With HR — awaiting decision</p>
      <p class="text-[11px] text-purple-700 leading-snug">HR reviews the position, shift and salary. You can't do anything here yet; you'll be notified either way.</p>
    </div>`;
  } else if (stage === 'waitingMatch') {
    nextHtml = `<div class="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
      <p class="text-xs font-bold text-yellow-800 mb-0.5">Approved — waiting for a match</p>
      <p class="text-[11px] text-yellow-700 leading-snug">HR approved the request and is looking for someone who can cover the <b>${r.shift || 'shift'}</b> shift. Nothing to do until HR sends you a candidate.</p>
    </div>`;
  } else if (stage === 'rejected') {
    nextHtml = `<div class="bg-red-50 border border-red-200 rounded-xl p-3">
      <p class="text-xs font-bold text-red-800 mb-1">HR rejected this request</p>
      <p class="text-[11px] text-red-700 leading-snug">${(r.hrDecision && r.hrDecision.note) || 'No reason given.'}</p>
      <p class="text-[10px] text-red-500 mt-1.5">${r.hrDecision ? r.hrDecision.by + ' · ' + r.hrDecision.date : ''}</p>
      <div class="mt-2"><button onclick="closeModal();openNewRecruitment()" class="btn btn-sm btn-primary">Raise a new request</button></div>
    </div>`;
  } else if (r.match && stage === 'matched') {
    // HR sent a candidate — the BM calls the number, then schedules the 2nd interview
    nextHtml = `<div class="bg-blue-50 border border-blue-200 rounded-xl p-3">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div>
          <p class="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Candidate sent by HR</p>
          <p class="text-base font-bold text-charcoal-900">${r.match.name}</p>
        </div>
        <a href="tel:${r.match.phone}" onclick="event.stopPropagation()" class="btn btn-sm btn-primary flex-shrink-0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          Call ${r.match.phone}
        </a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <div><p class="bento-label text-blue-600">Phone</p><p class="text-xs font-semibold text-charcoal-900">${r.match.phone}</p></div>
        <div><p class="bento-label text-blue-600">Shift</p><p class="text-xs font-semibold text-charcoal-900">${r.match.shift || '—'}</p></div>
        <div><p class="bento-label text-blue-600">Salary expectation</p><p class="text-xs font-semibold text-charcoal-900">${r.match.salaryExp ? 'EGP ' + r.match.salaryExp.toLocaleString() : '—'}</p></div>
        <div><p class="bento-label text-blue-600">Source</p><p class="text-xs font-semibold text-charcoal-900">${r.match.source || '—'}</p></div>
      </div>
      ${r.match.skills && r.match.skills.length ? `<div class="flex flex-wrap gap-1 mb-2">${r.match.skills.map(s=>recChip(s,'bg-white text-charcoal-700')).join('')}</div>` : ''}
      ${r.match.note ? `<p class="text-[11px] text-blue-800 leading-snug mb-2"><b>HR note:</b> ${r.match.note}</p>` : ''}
      <form onsubmit="event.preventDefault();saveIv2('${r.id}')" class="bg-white rounded-xl border border-blue-200 p-3 space-y-2">
        <p class="bento-label text-blue-700">Call him, then schedule the second interview</p>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="form-label">Date</label><input id="iv2-date" type="date" class="form-input" value="2026-09-15" required></div>
          <div><label class="form-label">Time</label><input id="iv2-time" type="time" class="form-input" value="13:00" required></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="form-label">Type</label><select id="iv2-type" class="form-select"><option>On-site</option><option>Phone</option><option>Video</option></select></div>
          <div><label class="form-label">Interviewed by</label><input id="iv2-by" type="text" class="form-input" value="${MOCK.currentUser.fullName}"></div>
        </div>
        <div><label class="form-label">Note</label><textarea id="iv2-note" class="form-input" rows="2" placeholder="What you agreed on the call..."></textarea></div>
        <div class="flex justify-end"><button type="submit" class="btn btn-sm btn-primary">Schedule interview</button></div>
      </form>
    </div>`;
  } else if (r.match && stage === 'iv2') {
    nextHtml = `<div class="bg-brand-50 border border-brand-200 rounded-xl p-3">
      <p class="text-xs font-bold text-brand-800 mb-1">2nd interview scheduled</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <div><p class="bento-label text-brand-600">Candidate</p><p class="text-xs font-semibold text-charcoal-900">${r.match.name}</p></div>
        <div><p class="bento-label text-brand-600">Phone</p><p class="text-xs font-semibold text-charcoal-900">${r.match.phone}</p></div>
        <div><p class="bento-label text-brand-600">When</p><p class="text-xs font-semibold text-charcoal-900">${r.iv2.date} · ${r.iv2.time}</p></div>
        <div><p class="bento-label text-brand-600">Type</p><p class="text-xs font-semibold text-charcoal-900">${r.iv2.type}${r.iv2.by ? ' · ' + r.iv2.by : ''}</p></div>
      </div>
      ${r.iv2.notes ? `<p class="text-[11px] text-brand-800 leading-snug mb-2"><b>Notes:</b> ${r.iv2.notes}</p>` : ''}
      <div class="bg-white rounded-xl border border-brand-200 p-3">
        <p class="bento-label text-brand-700 mb-1.5">Interview done? Record the result</p>
        <div class="flex flex-wrap gap-1.5">
          <button onclick="recordIv2Result('${r.id}','Accept')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Accept — send to HR</button>
          <button onclick="recordIv2Result('${r.id}','Reject')" class="btn btn-sm btn-danger-outline"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>Reject — keep looking</button>
        </div>
      </div>
    </div>`;
  } else if (stage === 'offerOut') {
    nextHtml = `<div class="bg-green-50 border border-green-200 rounded-xl p-3">
      <p class="text-xs font-bold text-green-800 mb-0.5">Accepted — HR is hiring</p>
      <p class="text-[11px] text-green-700 leading-snug">You accepted ${r.match.name} after the second interview. HR has been notified and is creating the account and the contract.</p>
    </div>`;
  }

  // --- timeline ---
  const history = r.history || [];
  const timeline = history.length ? `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
    <div class="px-3 py-2 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">TIMELINE</p></div>
    <div class="p-3 space-y-0">${history.map((h,i)=>`<div class="flex gap-2.5">
      <div class="flex flex-col items-center">
        <div class="w-2.5 h-2.5 rounded-full ${i===history.length-1?'bg-brand-500 ring-2 ring-brand-100':'bg-charcoal-300'} flex-shrink-0 mt-1"></div>
        ${i<history.length-1?'<div class="w-0.5 flex-1 bg-charcoal-200 my-1"></div>':''}
      </div>
      <div class="pb-3 min-w-0">
        <p class="text-xs font-medium text-charcoal-900">${h.step}</p>
        <p class="text-[10px] text-charcoal-500">${h.by || ''} · ${h.date || ''}</p>
        ${h.note ? `<p class="text-[10px] text-charcoal-600 mt-0.5 leading-snug">${h.note}</p>` : ''}
      </div>
    </div>`).join('')}</div>
  </div>` : '';

  openModal(r.position, `<div class="space-y-3">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="badge ${urgencyBadge[r.urgency]} text-[9px]">${r.urgency} urgency</span>
      ${recChip(meta.label, meta.bg + ' ' + meta.text)}
      <span class="text-[10px] text-charcoal-400">${r.timeline || ''}</span>
    </div>
    <div class="grid ${r.department ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Positions</p><p class="text-xs font-semibold text-charcoal-900">${r.count}</p></div>
      ${r.department ? `<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Department</p><p class="text-xs font-semibold text-charcoal-900">${r.department}</p></div>` : ''}
    </div>
    <div><p class="form-label">Reason</p><p class="text-xs text-charcoal-600">${r.reason}</p></div>
    ${criteria}
    ${nextHtml}
    ${timeline}
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button></div>
  </div>`);
}
function saveIv2(id) {
  const r = MOCK.recruitmentRequests.find(x=>x.id===id);
  if(!r || !r.match) return;
  const date = (document.getElementById('iv2-date') || {}).value;
  const time = (document.getElementById('iv2-time') || {}).value;
  if(!date || !time){ showToast('Pick a date and time for the interview','error'); return; }
  r.iv2 = {
    date, time,
    type: (document.getElementById('iv2-type') || {}).value || 'On-site',
    by: (document.getElementById('iv2-by') || {}).value || MOCK.currentUser.fullName,
    verdict: null,
    notes: (document.getElementById('iv2-note') || {}).value.trim(),
  };
  r.history = r.history || [];
  r.history.push({ step:'2nd interview scheduled', date:formatDate(TODAY_ISO), by:MOCK.currentUser.fullName,
    note:`${r.iv2.type} · ${time} on ${formatDate(date)} — called ${r.match.name} on ${r.match.phone} to agree the slot.` });
  if (typeof vacancyQueueExport === 'function') vacancyQueueExport();
  closeModal(); renderAll();
  showToast(`2nd interview with ${r.match.name} scheduled for ${formatDate(date)} at ${time}`);
  openRecruitmentDetail(id);
}
function recordIv2Result(id, verdict) {
  const r = MOCK.recruitmentRequests.find(x=>x.id===id);
  if(!r || !r.match || !r.iv2) return;
  r.iv2.verdict = verdict;
  r.history = r.history || [];
  if (verdict === 'Accept') {
    r.history.push({ step:'2nd interview accepted', date:formatDate(TODAY_ISO), by:MOCK.currentUser.fullName,
      note:`${r.match.name} accepted after the second interview — sent to HR to create the account.` });
  } else {
    r.history.push({ step:'2nd interview rejected', date:formatDate(TODAY_ISO), by:MOCK.currentUser.fullName,
      note:`${r.match.name} did not fit — back to waiting for another match on the ${r.shift || ''} shift.` });
  }
  if (typeof vacancyQueueExport === 'function') vacancyQueueExport();
  renderAll();
  showToast(verdict === 'Accept' ? `${r.match.name} accepted — HR notified to create the account`
    : `${r.match.name} rejected — HR is looking for another candidate on the ${r.shift || ''} shift`, verdict === 'Accept' ? 'success' : 'error');
  openRecruitmentDetail(id);
}

function openNewRecruitment() {
  openModal('New Recruitment Request',`<form onsubmit="event.preventDefault();saveNewRecruitment()" class="space-y-3">
    <div class="bg-brand-50 border border-brand-100 rounded-lg p-2.5 text-[10px] text-brand-800 leading-relaxed">
      Tell HR exactly what you need — the <b>shift</b> and the <b>expected salary</b> are what HR matches candidates against.
    </div>
    <div><label class="form-label">Position</label><input id="rec-position" type="text" class="form-input" placeholder="e.g. Senior Trainer" required></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Count</label><input id="rec-count" type="number" class="form-input" min="1" value="1" required></div>
      <div><label class="form-label">Urgency</label><select id="rec-urgency" class="form-select"><option>Low</option><option>Medium</option><option>High</option></select></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Shift you want</label>
        <select id="rec-shift" class="form-select"><option>Morning</option><option>Evening</option><option>Night</option><option>Flexible</option></select></div>
      <div><label class="form-label">Expected salary (EGP)</label><input id="rec-salary" type="number" class="form-input" min="0" step="500" placeholder="e.g. 12000" required></div>
    </div>
    <div><label class="form-label">Reason</label><textarea id="rec-reason" class="form-input" rows="2" placeholder="Why is this position needed?" required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Submit Request</button></div>
  </form>`);
}
function saveNewRecruitment() {
  const position = document.getElementById('rec-position').value.trim();
  if(!position) return;
  const count = parseInt(document.getElementById('rec-count').value)||1;
  const urgency = document.getElementById('rec-urgency').value;
  const shift = document.getElementById('rec-shift').value;
  const expectedSalary = parseFloat(document.getElementById('rec-salary').value)||0;
  const reason = document.getElementById('rec-reason').value.trim();
  const by = MOCK.currentUser.fullName;
  MOCK.recruitmentRequests.unshift({ id:'rr'+Date.now().toString(36), position, count, urgency, shift, expectedSalary,
    status:'Submitted', date:formatDate(TODAY_ISO), requestedBy:by, department:'', reason,
    timeline:'Submitted today · In review', candidates:0,
    match:null, iv2:null, hrDecision:null,
    history:[{ step:'Requested', date:formatDate(TODAY_ISO), by, note:`${position}${count>1?' x'+count:''} · ${shift} shift · EGP ${expectedSalary.toLocaleString()} expected` }] });
  // Send it to HR's pending vacancy queue (same transport as branch actions).
  if (typeof vacancyQueueExport === 'function') vacancyQueueExport();
  closeModal(); renderAll(); showToast(`${position} request submitted · awaiting HR`);
}

// ==================== EMPLOYEE LEAVING ====================
function renderLeaving() {
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Employee Leaving</h1><p class="text-xs text-charcoal-500 mt-0.5">${MOCK.employeeLeaving.length} active processes</p></div>
      <button onclick="openNewLeaving()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Initiate</button>
    </div>
    ${MOCK.employeeLeaving.length===0?'<div class="bg-white rounded-xl border border-charcoal-200 p-8 text-center"><svg class="w-10 h-10 text-charcoal-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p class="text-xs text-charcoal-500">No active leaving processes</p></div>':''}
    <div class="space-y-1.5">${MOCK.employeeLeaving.map(el=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${el.employee.split(' ').map(w=>w[0]).join('')}</div>
          <div>
            <p class="text-xs font-semibold text-charcoal-900">${el.employee}</p>
            <p class="text-[10px] text-charcoal-500">${el.position} · Last Day: ${el.lastDay} · ${el.reason}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">${statusBadge(el.status)}</div>
      </div>
    </div>`).join('')}</div>
  </div>`;
}
function openNewLeaving() {
  openModal('Initiate Employee Leaving',`<form onsubmit="event.preventDefault();closeModal();showToast('Leaving process initiated');" class="space-y-3">
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2"><svg class="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg><p class="text-xs text-yellow-800">This will initiate the offboarding process for the selected employee.</p></div>
    <div><label class="form-label">Employee</label><select class="form-select" required><option value="">Select employee...</option>${MOCK.teamMembers.map(m=>`<option>${m.name}</option>`).join('')}</select></div>
    <div><label class="form-label">Last Working Day</label><input type="date" class="form-input" required></div>
    <div><label class="form-label">Reason</label><textarea class="form-input" rows="2" placeholder="Reason for leaving..." required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-danger">Initiate Leaving</button></div>
  </form>`);
}

// ==================== TEAM OVERVIEW ====================
function renderTeamOverview() {
  const s=MOCK.teamStats;
  return `<div class="space-y-3">
    <div><h1 class="text-xl font-bold text-charcoal-900">Team Overview</h1><p class="text-xs text-charcoal-500 mt-0.5">Branch Manager Dashboard · Revive Gym — Nasr City</p></div>

    <!-- Stats Row -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 border-l-4 border-l-brand-500"><div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div><div><p class="text-xl font-bold text-charcoal-900">${s.total}</p><p class="text-[10px] text-charcoal-500">Total Staff</p></div></div></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3"><div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><p class="text-xl font-bold text-green-600">${Math.round((s.present/s.total)*100)}%</p><p class="text-[10px] text-charcoal-500">Attendance</p></div></div></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3"><div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><p class="text-xl font-bold text-yellow-600">${s.late}</p><p class="text-[10px] text-charcoal-500">Late Today</p></div></div></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3"><div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><p class="text-xl font-bold text-red-600">${s.absent}</p><p class="text-[10px] text-charcoal-500">Absent</p></div></div></div>
    </div>

    <!-- Two Column Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <!-- Request Pipeline -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
          <p class="bento-label">REQUEST PIPELINE</p>
          <button onclick="navigateTo('team-requests')" class="text-[10px] text-brand-600 font-semibold hover:underline">View All</button>
        </div>
        <div class="divide-y divide-charcoal-50">${MOCK.teamRequests.filter(r=>r.status==='Pending').slice(0,4).map(r=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[9px] font-semibold">${r.employee.split(' ').map(w=>w[0]).join('')}</div>
            <div><p class="text-[11px] font-medium text-charcoal-900">${r.employee}</p><p class="text-[9px] text-charcoal-500">${r.type}</p></div>
          </div>
          <div class="flex gap-1"><button onclick="event.stopPropagation();showToast('${r.employee} approved')" class="btn btn-sm btn-primary text-[10px]">Approve</button><button onclick="event.stopPropagation();showToast('${r.employee} rejected','error')" class="btn btn-sm btn-danger-outline text-[10px]">Reject</button></div>
        </div>`).join('')}</div>
      </div>

      <!-- Follow-up Alerts -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
          <p class="bento-label">FOLLOW-UP ALERTS</p>
          <button onclick="navigateTo('team-updates')" class="text-[10px] text-brand-600 font-semibold hover:underline">View All</button>
        </div>
        <div class="divide-y divide-charcoal-50">${MOCK.followUpItems.slice(0,4).map(f=>{
          const c={high:'border-l-red-400 bg-red-50/50',medium:'border-l-yellow-400 bg-yellow-50/50',low:'border-l-blue-400 bg-blue-50/50'};
          return `<div class="p-3 hover:bg-charcoal-50/50 transition-colors border-l-4 ${c[f.severity]}">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0"><p class="text-[11px] font-medium text-charcoal-900">${f.employee} — ${f.type}</p><p class="text-[10px] text-charcoal-600 mt-0.5">${f.description}</p></div>
              <span class="badge ${f.severity==='high'?'badge-red':f.severity==='medium'?'badge-yellow':'badge-blue'} text-[9px] flex-shrink-0 ml-2">${f.severity}</span>
            </div>
          </div>`;
        }).join('')}</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <p class="bento-label text-charcoal-500 mb-2">QUICK ACTIONS</p>
      <div class="flex flex-wrap gap-1.5">
        <button onclick="state.tsEditing=true;navigateTo('team-schedule')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Assign Shifts</button>
        <button onclick="navigateTo('team')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>Attendance</button>
        <button onclick="openNewRecruitment()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>Recruit</button>
        <button onclick="navigateTo('team-schedule')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Schedule</button>
      </div>
    </div>
  </div>`;
}

// ==================== TEAM PERFORMANCE (Evaluations) ====================
// View, create, and edit team member evaluations. Clicking a row opens the
// full criteria breakdown; the header button starts a new evaluation.
function renderTeamPerformance() {
  const evals = MOCK.teamEvaluations;
  const avg = evals.length ? (evals.reduce((s,e)=>s+e.score,0)/evals.length).toFixed(1) : '—';
  const exceeds = evals.filter(e=>e.result==='Exceeds').length;
  const meets = evals.filter(e=>e.result==='Meets').length;
  const below = evals.filter(e=>e.result==='Below').length;
  const resultBadge = { 'Exceeds':'badge-green','Meets':'badge-blue','Below':'badge-red' };
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Team Performance</h1><p class="text-xs text-charcoal-500 mt-0.5">Q2 2026 · ${evals.length} team members evaluated</p></div>
      <div class="flex items-center gap-2">
        <select class="form-select w-36" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>Q2 2026</option><option>Q1 2026</option></select>
        <button onclick="openNewTeamEvaluation()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Evaluation</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg></div><p class="text-lg font-bold text-brand-600">${avg}</p><p class="text-[10px] text-charcoal-500">Avg Score</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-green-600">${exceeds}</p><p class="text-[10px] text-charcoal-500">Exceeds</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-blue-600">${meets}</p><p class="text-[10px] text-charcoal-500">Meets</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><p class="text-lg font-bold text-red-600">${below}</p><p class="text-[10px] text-charcoal-500">Below</p></div>
    </div>

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Period</th><th>Score</th><th>Result</th><th>Status</th><th></th></tr></thead>
      <tbody>${evals.map(e=>`<tr class="cursor-pointer hover:bg-charcoal-50/50" onclick="openTeamEvalDetail('${e.id}')"><td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${e.employee.split(' ').map(w=>w[0]).join('')}</div><div><p class="text-xs font-medium text-charcoal-900">${e.employee}</p><p class="text-[10px] text-charcoal-500">${e.position}</p></div></div></td><td class="text-xs">${e.period}</td><td class="text-xs font-semibold">${e.score.toFixed(1)} <span class="text-charcoal-400 font-normal">/ 5</span></td><td><span class="badge ${resultBadge[e.result]}">${e.result}</span></td><td>${statusBadge(e.status)}</td><td><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td></tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${evals.map(e=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openTeamEvalDetail('${e.id}')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${e.employee.split(' ').map(w=>w[0]).join('')}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${e.employee}</p><p class="text-[10px] text-charcoal-500">${e.position} · ${e.period}</p></div>
        </div>
        <span class="badge ${resultBadge[e.result]}">${e.result}</span>
      </div>
      <div class="flex items-center justify-between mt-2">
        <div class="flex items-center gap-1">${[1,2,3,4,5].map(n=>`<svg class="w-3.5 h-3.5 ${n<=Math.round(e.score)?'text-yellow-400':'text-charcoal-200'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`).join('')}</div>
        <span class="text-xs font-bold text-charcoal-900">${e.score.toFixed(1)}</span>
      </div>
    </div>`).join('')}</div>
  </div>`;
}

// ==================== EVALUATION ACTIONS ====================
const EVAL_CRITERIA = ['Customer Service','Team Collaboration','Punctuality & Attendance','Technical Skills','Initiative'];
function openNewTeamEvaluation(empId) {
  const emp = empId ? MOCK.teamMembers.find(x=>x.id===empId) : null;
  openModal('New Evaluation', `<form onsubmit="event.preventDefault();saveTeamEvaluation()" class="space-y-3">
    <div><label class="form-label">Employee</label><select id="eval-emp" class="form-select">${MOCK.teamMembers.map(m=>`<option value="${m.id}" ${emp&&emp.id===m.id?'selected':''}>${m.name} — ${m.position}</option>`).join('')}</select></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Period</label><select id="eval-period" class="form-select"><option>Q3 2026</option><option>Q2 2026</option><option>Q1 2026</option></select></div>
      <div><label class="form-label">Overall Score</label><input id="eval-score" type="number" min="1" max="5" step="0.1" value="3.5" class="form-input" required></div>
    </div>
    <div class="space-y-2">${EVAL_CRITERIA.map((c,i)=>`
      <div class="bg-charcoal-50 rounded-lg p-2.5">
        <div class="flex items-center justify-between mb-1"><span class="text-xs font-medium text-charcoal-900">${c}</span><input type="number" min="1" max="5" step="0.5" value="3.5" class="form-input w-16 text-center" style="padding:0.25rem" id="eval-crit-${i}"></div>
        <input type="text" class="form-input" placeholder="Comment..." style="font-size:0.75rem" id="eval-crit-comment-${i}">
      </div>`).join('')}</div>
    <div><label class="form-label">Overall Comment</label><textarea id="eval-comment" class="form-input" rows="2" placeholder="Summary of performance..."></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Evaluation</button></div>
  </form>`, { wide:true });
}
function saveTeamEvaluation() {
  const empId = document.getElementById('eval-emp').value;
  const m = MOCK.teamMembers.find(x=>x.id===empId); if(!m) return;
  const score = parseFloat(document.getElementById('eval-score').value) || 3.5;
  const period = document.getElementById('eval-period').value;
  const criteria = EVAL_CRITERIA.map((name,i)=>({
    name, score: parseFloat(document.getElementById('eval-crit-'+i).value) || 3.5,
    comment: document.getElementById('eval-crit-comment-'+i).value.trim() || 'No comment'
  }));
  const result = score>=4?'Exceeds':score>=3?'Meets':'Below';
  MOCK.teamEvaluations.unshift({ id:'te'+Date.now().toString(36), employee:m.name, position:m.position, period, score, result, status:'Completed', criteria, overallComment: document.getElementById('eval-comment').value.trim() || 'No overall comment' });
  closeModal(); renderAll(); showToast(`Evaluation saved for ${m.name}`);
}
function openTeamEvalDetail(id) {
  const ev = MOCK.teamEvaluations.find(e=>e.id===id); if(!ev) return;
  const pct = Math.round((ev.score/5)*100);
  openModal(`${ev.employee} — ${ev.period}`, `<div class="space-y-3">
    <div class="flex items-center gap-3 pb-2 border-b border-charcoal-100">
      <div class="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">${ev.employee.split(' ').map(w=>w[0]).join('')}</div>
      <div class="flex-1"><p class="text-sm font-bold text-charcoal-900">${ev.employee}</p><p class="text-[10px] text-charcoal-500">${ev.position} · ${ev.period}</p></div>
      <div class="text-center"><p class="text-xl font-bold text-brand-700">${ev.score.toFixed(1)}</p><p class="text-[10px] text-charcoal-500">/ 5</p></div>
    </div>
    <div class="space-y-2.5">${(ev.criteria||EVAL_CRITERIA.map((n,i)=>({name:n,score:ev.score,comment:'—'}))).map(c=>{
      const cpct = Math.round((c.score/5)*100);
      return `<div><div class="flex items-center justify-between mb-1"><span class="text-xs font-medium text-charcoal-900">${c.name}</span><span class="text-[11px] font-semibold ${cpct>=80?'text-brand-600':cpct>=60?'text-yellow-600':'text-red-600'}">${c.score.toFixed(1)}/5</span></div><div class="w-full h-2 bg-charcoal-100 rounded-full overflow-hidden"><div class="h-full ${cpct>=80?'bg-brand-500':cpct>=60?'bg-yellow-500':'bg-red-500'} rounded-full transition-all" style="width:${cpct}%"></div></div><p class="text-[10px] text-charcoal-500 mt-1">${c.comment}</p></div>`;
    }).join('')}</div>
    <div class="bg-charcoal-50 rounded-lg p-3"><p class="bento-label text-charcoal-500 mb-1">OVERALL COMMENT</p><p class="text-xs text-charcoal-700">${ev.overallComment||'No comment'}</p></div>
  </div>`, { wide:true, footer:`<button onclick="openEditTeamEvaluation('${id}')" class="btn btn-sm btn-secondary">Edit</button><button onclick="closeModal()" class="btn btn-sm btn-primary">Close</button>` });
}
function openEditTeamEvaluation(id) {
  const ev = MOCK.teamEvaluations.find(e=>e.id===id); if(!ev) return;
  const emp = MOCK.teamMembers.find(x=>x.name===ev.employee);
  openModal(`Edit Evaluation — ${ev.employee}`, `<form onsubmit="event.preventDefault();saveTeamEvaluationEdit('${id}')" class="space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Period</label><select id="eval-edit-period" class="form-select">${['Q3 2026','Q2 2026','Q1 2026'].map(p=>`<option ${p===ev.period?'selected':''}>${p}</option>`).join('')}</select></div>
      <div><label class="form-label">Overall Score</label><input id="eval-edit-score" type="number" min="1" max="5" step="0.1" value="${ev.score}" class="form-input" required></div>
    </div>
    <div class="space-y-2">${(ev.criteria||EVAL_CRITERIA.map((n,i)=>({name:n,score:ev.score,comment:''}))).map((c,i)=>`
      <div class="bg-charcoal-50 rounded-lg p-2.5">
        <div class="flex items-center justify-between mb-1"><span class="text-xs font-medium text-charcoal-900">${c.name}</span><input type="number" min="1" max="5" step="0.5" value="${c.score}" class="form-input w-16 text-center" style="padding:0.25rem" id="eval-edit-crit-${i}"></div>
        <input type="text" class="form-input" placeholder="Comment..." value="${(c.comment||'').replace(/"/g,'&quot;')}" style="font-size:0.75rem" id="eval-edit-crit-comment-${i}">
      </div>`).join('')}</div>
    <div><label class="form-label">Overall Comment</label><textarea id="eval-edit-comment" class="form-input" rows="2">${(ev.overallComment||'').replace(/"/g,'&quot;')}</textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Changes</button></div>
  </form>`, { wide:true });
}
function saveTeamEvaluationEdit(id) {
  const ev = MOCK.teamEvaluations.find(e=>e.id===id); if(!ev) return;
  ev.period = document.getElementById('eval-edit-period').value;
  ev.score = parseFloat(document.getElementById('eval-edit-score').value) || ev.score;
  ev.criteria = EVAL_CRITERIA.map((name,i)=>({
    name, score: parseFloat(document.getElementById('eval-edit-crit-'+i).value) || 3.5,
    comment: document.getElementById('eval-edit-crit-comment-'+i).value.trim() || 'No comment'
  }));
  ev.overallComment = document.getElementById('eval-edit-comment').value.trim() || 'No overall comment';
  ev.result = ev.score>=4?'Exceeds':ev.score>=3?'Meets':'Below';
  closeModal(); renderAll(); showToast(`Evaluation updated for ${ev.employee}`);
}

// ==================== EMPLOYEES (Branch Directory) ====================
// Shift comes from the schedule assignments (MOCK.teamSchedule + shiftTemplates)
// for today. Status is auto-derived from the shift timing vs MOCK.now (employment status
// like On Leave / Suspended overrides the shift status).
function timeToMin(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function getEmployeeTodayShift(e) {
  const tm = MOCK.teamMembers.find(x => x.name === e.name);
  if (tm) {
    const schedIds = MOCK.teamSchedule[tm.id] || [];
    const shiftId = schedIds[MOCK.todayIndex] || 'st-off';
    return getShiftTemplate(shiftId);
  }
  // Fallback: the current user's own today shift (e.g. the Branch Manager)
  if (MOCK.currentUser && e.id === MOCK.currentUser.id && MOCK.todayShift) {
    return { id:'st-today', name: MOCK.todayShift.shiftName, start: MOCK.todayShift.startTime, end: MOCK.todayShift.endTime, isOff:false };
  }
  return getShiftTemplate('st-off');
}
function getEmployeeShiftStatus(e) {
  const shift = getEmployeeTodayShift(e);
  // Employment status overrides the auto shift status
  if (e.status === 'On Leave') return { shift, status: 'On Leave', badge: 'badge-yellow' };
  if (e.status === 'Suspended') return { shift, status: 'Suspended', badge: 'badge-red' };
  if (e.status === 'Terminated') return { shift, status: 'Terminated', badge: 'badge-gray' };
  if (!shift || shift.isOff) return { shift, status: 'Off', badge: 'badge-gray' };
  const now = timeToMin(MOCK.now);
  const start = timeToMin(shift.start);
  let end = timeToMin(shift.end);
  if (end === 0 && start > 0) end = 1440; // shift wraps past midnight (e.g. 16:00–00:00)
  if (now < start) return { shift, status: 'Upcoming', badge: 'badge-blue' };
  if (now >= end) return { shift, status: 'Shift Ended', badge: 'badge-gray' };
  return { shift, status: 'On Shift', badge: 'badge-green' };
}
function shiftLabel(shift) {
  if (!shift || shift.isOff) return 'Off';
  return `${shift.name} · ${shift.start}–${shift.end}`;
}
// Create a request on behalf of one of the branch's employees — it lands in their
// request history and goes to HR for the final decision.
function openNewEmployeeRequest() {
  const opts = MOCK.branchEmployees.filter(e => e.status !== 'Terminated');
  openModal('Create Request for an Employee', `<form onsubmit="event.preventDefault();saveEmployeeRequest()" class="space-y-3">
    <div><label class="form-label">Employee</label>
      <select id="er-emp" class="form-select">${opts.map(e=>`<option value="${e.id}">${e.name} — ${e.position}</option>`).join('')}</select></div>
    <div><label class="form-label">Request Type</label>
      <select id="er-type" class="form-select">${['Annual Leave','Sick Leave','Late Attendance','Early Leave','Shift Swap','Paid Holiday'].map(t=>`<option>${t}</option>`).join('')}</select></div>
    <div><label class="form-label">Requested Date</label><input id="er-date" type="date" class="form-input" value="${TODAY_ISO}" required></div>
    <div><label class="form-label">Reason</label><textarea id="er-reason" class="form-input" rows="2" placeholder="Why is this request being filed for them?" required></textarea></div>
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-500">Filed on the employee's own record and routed to HR for the final decision.</div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Submit Request</button></div>
  </form>`);
}
function saveEmployeeRequest() {
  const e = MOCK.branchEmployees.find(x=>x.id===document.getElementById('er-emp').value); if(!e) return;
  const type = document.getElementById('er-type').value;
  const date = document.getElementById('er-date').value;
  const reason = document.getElementById('er-reason').value.trim();
  if(!reason){ showToast('Please add a reason for the request','error'); return; }
  MOCK.teamRequests.unshift({
    id:'tr'+Date.now().toString(36), employee:e.name, position:e.position, type,
    date:date?formatDate(date):'—', submitted:formatDate(TODAY_ISO),
    status:'Pending', reason, raisedBy:MOCK.currentUser.fullName,
  });
  closeModal(); renderAll(); showToast(`${type} request created for ${e.name} — pending HR`);
}

function renderEmployees() {
  const emps = MOCK.branchEmployees.map(e => ({ e, tm: MOCK.teamMembers.find(x=>x.name===e.name), ...getEmployeeShiftStatus(e) }));
  const onShift = emps.filter(x=>x.status==='On Shift').length;
  const upcoming = emps.filter(x=>x.status==='Upcoming').length;
  const off = emps.filter(x=>['Off','On Leave','Suspended','Terminated'].includes(x.status)).length;
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Employees</h1><p class="text-xs text-charcoal-500 mt-0.5">${emps.length} employees · Revive Gym — Nasr City · Now ${MOCK.now}</p></div>
      <div class="flex gap-1.5">
        <button onclick="openBranchActions()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Actions</button>
        <button onclick="openNewEmployeeRequest()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Create request for employee</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><p class="text-xl font-bold text-brand-700">${emps.length}</p><p class="text-[10px] text-charcoal-500">Total</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-brand-600">${onShift}</p><p class="text-[10px] text-charcoal-500">On Shift</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-blue-600">${upcoming}</p><p class="text-[10px] text-charcoal-500">Upcoming</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></div><p class="text-lg font-bold text-charcoal-600">${off}</p><p class="text-[10px] text-charcoal-500">Off / Away</p></div>
    </div>

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Position</th><th>Shift (Today)</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead>
      <tbody>${emps.map(x=>{
        const checkIn = x.tm && x.tm.checkIn ? x.tm.checkIn : (x.status==='Off' ? '—' : 'No record');
        const checkOut = x.tm && (x.tm.status==='Present'||x.tm.status==='Late') ? '16:02' : '—';
        return `<tr class="cursor-pointer hover:bg-charcoal-50/50" onclick="openEmployeeProfile('${x.e.id}')"><td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${x.e.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${x.e.name}</p><p class="text-[10px] text-charcoal-500">${x.e.id}</p></div></div></td><td class="text-xs">${x.e.position}</td><td class="text-xs">${shiftLabel(x.shift)}</td><td class="text-xs ${x.tm && x.tm.checkIn ? 'font-semibold text-charcoal-900' : 'text-charcoal-400'}">${checkIn}</td><td class="text-xs ${checkOut!=='—' ? 'font-semibold text-charcoal-900' : 'text-charcoal-400'}">${checkOut}</td><td><span class="badge ${x.badge}">${x.status}</span></td></tr>`;
      }).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${emps.map(x=>{
      const checkIn = x.tm && x.tm.checkIn ? x.tm.checkIn : (x.status==='Off' ? '—' : 'No record');
      const checkOut = x.tm && (x.tm.status==='Present'||x.tm.status==='Late') ? '16:02' : '—';
      return `<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openEmployeeProfile('${x.e.id}')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${x.e.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${x.e.name}</p><p class="text-[10px] text-charcoal-500">${x.e.position} · ${shiftLabel(x.shift)}</p></div>
        </div>
        <span class="badge ${x.badge}">${x.status}</span>
      </div>
      <div class="flex gap-4 mt-2 text-[10px] text-charcoal-500">
        <span class="flex items-center gap-1"><svg class="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>In: ${checkIn}</span>
        <span class="flex items-center gap-1"><svg class="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Out: ${checkOut}</span>
      </div>
    </div>`;}).join('')}</div>
  </div>`;
}

// ==================== EMPLOYEES PERFORMANCE (Branch Manager) ====================
// One page with every employee's performance history: requests, payroll
// deductions, evaluations, bonuses, warnings and attendance — in tabs, each
// filterable by month. The signed-in employee's own record (PERF_SELF_ID)
// additionally merges the personal mocks (MOCK.requests / MOCK.evaluations /
// MOCK.payroll / MOCK.attendanceRecords) so their history is complete.
const PERF_SELF_ID = 'RV-00124';
const PERF_MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Normalize any date shape in MOCK into ['YYYY-MM', ...]:
//   '2026-08-19'   -> ['2026-08']                      (ISO)
//   'Aug 30, 2026' -> ['2026-08']                      (month + day + year)
//   'Aug 25'       -> ['2026-08']                      (month + day, default year = mock clock)
//   'Aug 29-30'    -> ['2026-08']                      (range -> start month)
//   'August 2026'  -> ['2026-08']                      (payroll period, no day)
//   'Q2 2026'      -> ['2026-04','2026-05','2026-06']  (quarter -> its three months)
function perfYmKeys(str) {
  if (!str) return [];
  const s = String(str).trim();
  const q = /^Q([1-4])[\s-]+(20\d{2})$/i.exec(s);                 // quarter
  if (q) {
    const start = (Number(q[1]) - 1) * 3 + 1;
    return [start, start + 1, start + 2].map(m => q[2] + '-' + String(m).padStart(2, '0'));
  }
  const iso = /^(20\d{2})-(\d{2})/.exec(s);                        // ISO
  if (iso) return [iso[1] + '-' + iso[2]];
  const mon = /^([A-Za-z]{3,9})\.?\s/.exec(s);                     // month-name forms
  if (mon) {
    const mi = PERF_MONTH_FULL.findIndex(n => n.toLowerCase().startsWith(mon[1].toLowerCase().slice(0, 3)));
    if (mi >= 0) {
      const y = /(\d{4})/.exec(s);
      return [(y ? y[1] : TODAY_ISO.slice(0, 4)) + '-' + String(mi + 1).padStart(2, '0')];
    }
  }
  return [];
}
// 'YYYY-MM-DD' for sorting; day defaults to 01 for month/quarter-only strings.
function perfSortKey(str) {
  const ym = perfYmKeys(str)[0];
  if (!ym) return '';
  const s = String(str).trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  if (/^[A-Za-z]{3,9}\.?\s+20\d{2}$/.test(s)) return ym + '-01';   // 'August 2026'
  const d = /^[A-Za-z]{3,9}\.?\s+(\d{1,2})/.exec(s);               // 'Aug 30, 2026' | 'Aug 25' | 'Aug 29-30'
  return ym + '-' + (d ? String(d[1]).padStart(2, '0') : '01');
}
function perfMonthLabel(ym) {
  const p = String(ym).split('-');
  return (PERF_MONTH_FULL[Number(p[1]) - 1] || ym) + ' ' + p[0];
}
// Union of every month any record touches — one stable dropdown across
// employee switches. Sorted newest-first.
function perfAllMonths() {
  const set = new Set();
  const add = v => perfYmKeys(v).forEach(k => set.add(k));
  MOCK.teamRequests.forEach(r => { add(r.date); add(r.submitted); });
  MOCK.requests.forEach(r => { add(r.requestedDate); add(r.submittedDate); });
  MOCK.deductionCandidates.forEach(d => add(d.date));
  MOCK.warningNotices.forEach(w => add(w.date));
  MOCK.bonusProposals.forEach(b => add(b.date));
  MOCK.teamEvaluations.forEach(e => add(e.period));
  MOCK.evaluations.forEach(e => { add(e.period); add(e.date); });
  MOCK.attendanceRecords.forEach(a => add(a.date));
  MOCK.payroll.forEach(p => add(p.period));
  return [...set].sort().reverse();
}
// Everything the branch holds on one employee, normalized: each record carries
// yms[] (months it belongs to) for the filter and a sort key (newest first).
function perfData(e) {
  const isSelf = e.id === PERF_SELF_ID;
  const name = e.name;
  const ymsOf = (...vals) => [...new Set(vals.flatMap(v => perfYmKeys(v)))];
  const bySortDesc = (a, b) => (b.sort || '').localeCompare(a.sort || '');

  // Requests — branch-filed (teamRequests) + own record's requests when self.
  const requests = [];
  MOCK.teamRequests.filter(r => r.employee === name).forEach(r => requests.push({
    src: 'team', id: r.id, type: r.type, when: r.date, submitted: r.submitted,
    status: r.status, reason: r.reason, yms: ymsOf(r.date, r.submitted), sort: perfSortKey(r.date),
  }));
  if (isSelf) MOCK.requests.forEach(r => requests.push({
    src: 'self', id: r.id, type: r.type, when: r.requestedDate, submitted: r.submittedDate,
    status: r.status, reason: r.reason, yms: ymsOf(r.requestedDate, r.submittedDate), sort: perfSortKey(r.requestedDate),
  }));
  requests.sort(bySortDesc);

  // Deductions — manager-issued candidates + (self) payslip deduction items,
  // groups expanded to their sub-items.
  const deductions = [];
  MOCK.deductionCandidates.filter(d => d.employee === name).forEach(d => deductions.push({
    src: 'branch', title: d.reason, amount: d.amount, when: formatDate(d.date), note: d.note,
    by: d.issuedBy, status: d.status, yms: ymsOf(d.date), sort: perfSortKey(d.date),
  }));
  if (isSelf) MOCK.payroll.forEach(p => (p.items || []).filter(i => i.type === 'deduction').forEach(i => {
    if (i.isGroup && i.subItems) i.subItems.forEach(s => deductions.push({
      src: 'payroll', title: i.label + ' — ' + s.label, amount: Math.abs(s.amount), when: formatDate(s.date),
      note: s.detail, by: p.period, status: p.status, yms: ymsOf(s.date, p.period), sort: perfSortKey(s.date),
    }));
    else deductions.push({
      src: 'payroll', title: i.label, amount: Math.abs(i.amount), when: p.period, note: '',
      by: p.period, status: p.status, yms: ymsOf(p.period), sort: perfSortKey(p.period),
    });
  }));
  deductions.sort(bySortDesc);

  // Bonuses — branch proposals + (self) bonus earnings inside payslips.
  const bonuses = [];
  MOCK.bonusProposals.filter(b => b.employee === name).forEach(b => bonuses.push({
    src: 'branch', title: b.type, amount: b.amount, when: formatDate(b.date), note: b.reason,
    detail: b.note, by: b.issuedBy, status: b.status, yms: ymsOf(b.date), sort: perfSortKey(b.date),
  }));
  if (isSelf) MOCK.payroll.forEach(p => (p.items || [])
    .filter(i => i.type === 'earning' && /bonus/i.test(i.label))
    .forEach(i => bonuses.push({
      src: 'payroll', title: i.label, amount: i.amount, when: p.period, note: 'Included in the payslip',
      detail: '', by: p.period, status: p.status, yms: ymsOf(p.period), sort: perfSortKey(p.period),
    })));
  bonuses.sort(bySortDesc);

  // Warnings.
  const warnings = MOCK.warningNotices.filter(w => w.employee === name).map(w => ({
    title: w.type, when: formatDate(w.date), reason: w.reason, detail: w.note,
    by: w.issuedBy, status: w.status, yms: ymsOf(w.date), sort: perfSortKey(w.date),
  })).sort(bySortDesc);

  // Evaluations — team evals (quarter-keyed) + (self) personal evaluations.
  const evaluations = [];
  MOCK.teamEvaluations.filter(v => v.employee === name).forEach(v => evaluations.push({
    src: 'team', id: v.id, period: v.period, score: v.score, maxScore: 5, result: v.result,
    status: v.status, yms: ymsOf(v.period), sort: perfSortKey(v.period),
  }));
  if (isSelf) MOCK.evaluations.forEach(v => evaluations.push({
    src: 'self', id: v.id, period: v.period, score: v.score, maxScore: v.maxScore || 5,
    result: v.score >= 4 ? 'Exceeds' : v.score >= 3 ? 'Meets' : 'Below',
    status: v.status, yms: ymsOf(v.period, v.date), sort: perfSortKey(v.date) || perfSortKey(v.period),
  }));
  evaluations.sort(bySortDesc);

  // Attendance — full day records for self, else the member's week sample.
  let attendance = [];
  if (isSelf) attendance = MOCK.attendanceRecords.map(a => ({
    dateLabel: formatDate(a.date),
    shift: a.shiftName === 'Off' ? 'Off' : `${a.shiftName} · ${a.shift}`,
    checkIn: a.checkIn || '—', checkOut: a.checkOut || '—', status: a.status, notes: a.notes,
    yms: ymsOf(a.date), sort: perfSortKey(a.date),
  }));
  else {
    const tm = MOCK.teamMembers.find(m => m.name === name);
    if (tm) attendance = memberAttendanceRows(tm).map(r => ({
      dateLabel: r.date, shift: r.shift, checkIn: r.checkIn, checkOut: r.checkOut,
      status: r.status, notes: '', yms: ymsOf(r.date), sort: perfSortKey(r.date),
    }));
  }
  attendance.sort(bySortDesc);

  // Open attention items + leaving notice (undated — always shown).
  const followUps = MOCK.followUpItems.filter(f => f.employee === name);
  const leaving = MOCK.employeeLeaving.find(l => l.employee === name) || null;

  return { requests, deductions, bonuses, warnings, evaluations, attendance, followUps, leaving };
}
function setPerfEmp(id) { state.perfEmp = id; renderAll(); }
function setPerfTab(t) { state.perfTab = t; renderAll(); }
function setPerfMonth(m) { state.perfMonth = m; renderAll(); }

function renderEmployeesPerformance() {
  const emps = MOCK.branchEmployees;
  const month = state.perfMonth || 'all';
  const months = perfAllMonths();
  const monthName = month === 'all' ? null : perfMonthLabel(month);
  const inMonth = r => month === 'all' || r.yms.includes(month);

  const emptyState = msg => `<div class="bg-charcoal-50 rounded-lg p-6 text-center"><p class="text-xs text-charcoal-500">${msg}</p></div>`;
  const resultBadge = r => `<span class="badge ${r === 'Exceeds' ? 'badge-green' : r === 'Meets' ? 'badge-blue' : 'badge-red'}">${r}</span>`;
  const empStatusBadge = s => ({ 'Active': 'badge-green', 'On Leave': 'badge-yellow', 'Suspended': 'badge-red', 'Terminated': 'badge-gray' }[s] || 'badge-gray');

  // --- Header: month filter at the right, same line as the title ---
  const monthSel = `<select class="form-select w-40" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem" onchange="setPerfMonth(this.value)" aria-label="Filter by month">
    <option value="all"${month === 'all' ? ' selected' : ''}>All months</option>
    ${months.map(m => `<option value="${m}"${month === m ? ' selected' : ''}>${perfMonthLabel(m)}</option>`).join('')}
  </select>`;
  const header = sub => `<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Employees Performance</h1><p class="text-xs text-charcoal-500 mt-0.5">${sub}</p></div>
      <div class="flex items-center gap-2">${monthSel}</div>
    </div>`;

  // ==================== VIEW 1: ALL EMPLOYEES ====================
  // No employee selected -> show the whole branch; clicking a row drills into
  // that employee's performance history (the tabs below).
  const emp = state.perfEmp ? emps.find(x => x.id === state.perfEmp) : null;
  if (!emp) {
    const rows = emps.map(e => {
      const d = perfData(e);
      const reqs = d.requests.filter(inMonth), deds = d.deductions.filter(inMonth),
        evals = d.evaluations.filter(inMonth), bons = d.bonuses.filter(inMonth),
        warns = d.warnings.filter(inMonth);
      return {
        e, attn: d.followUps.length + (d.leaving ? 1 : 0),
        reqs: reqs.length, pending: reqs.filter(r => r.status === 'Pending').length,
        ded: deds.reduce((s, x) => s + x.amount, 0),
        bon: bons.reduce((s, x) => s + x.amount, 0),
        avg: evals.length ? (evals.reduce((s, x) => s + x.score, 0) / evals.length) : null,
        latest: evals[0] || null,
        warns: warns.length,
      };
    });
    const totReqs = rows.reduce((s, r) => s + r.reqs, 0);
    const totDed = rows.reduce((s, r) => s + r.ded, 0);
    const totAttn = rows.filter(r => r.attn).length;
    const stats = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><p class="text-xl font-bold text-brand-700">${emps.length}</p><p class="text-[10px] text-charcoal-500">Employees</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-xl font-bold text-charcoal-900">${totReqs}</p><p class="text-[10px] text-charcoal-500">Requests${monthName ? ' · ' + monthName : ''}</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-xl font-bold text-red-600">EGP ${totDed.toLocaleString('en-US')}</p><p class="text-[10px] text-charcoal-500">Deductions${monthName ? ' · ' + monthName : ''}</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-xl font-bold ${totAttn ? 'text-orange-600' : 'text-charcoal-900'}">${totAttn}</p><p class="text-[10px] text-charcoal-500">Need review</p></div>
    </div>`;

    const desktop = `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table">
      <thead><tr><th>Employee</th><th>Position</th><th>Status</th><th class="text-right">Requests</th><th class="text-right">Deductions</th><th class="text-right">Bonuses</th><th class="text-right">Evaluations</th><th class="text-right">Warnings</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="cursor-pointer hover:bg-charcoal-50/50" onclick="setPerfEmp('${r.e.id}')">
        <td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${r.e.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${r.e.name}${r.attn ? ` <span class="inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle" title="Needs review"></span>` : ''}</p><p class="text-[10px] text-charcoal-500">${r.e.id}</p></div></div></td>
        <td class="text-xs">${r.e.position}</td>
        <td><span class="badge ${empStatusBadge(r.e.status)}">${r.e.status}</span></td>
        <td class="text-right text-xs">${r.reqs}${r.pending ? `<span class="block text-[10px] text-yellow-600">${r.pending} pending</span>` : ''}</td>
        <td class="text-right text-xs font-semibold ${r.ded ? 'text-red-600' : 'text-charcoal-400'}">EGP ${r.ded.toLocaleString('en-US')}</td>
        <td class="text-right text-xs font-semibold ${r.bon ? 'text-green-600' : 'text-charcoal-400'}">EGP ${r.bon.toLocaleString('en-US')}</td>
        <td class="text-right text-xs">${r.avg !== null ? `${r.avg.toFixed(1)} / 5` : '<span class="text-charcoal-400">—</span>'}${r.latest ? `<span class="block mt-0.5">${resultBadge(r.latest.result)}</span>` : ''}</td>
        <td class="text-right text-xs font-semibold ${r.warns ? 'text-orange-600' : 'text-charcoal-400'}">${r.warns}</td>
      </tr>`).join('')}</tbody></table></div>
    </div>`;

    const mobile = `<div class="space-y-1.5 lg:hidden">${rows.map(r => `<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="setPerfEmp('${r.e.id}')">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${r.e.initials}</div>
          <div class="min-w-0"><p class="text-xs font-medium text-charcoal-900 truncate">${r.e.name}${r.attn ? ` <span class="inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle"></span>` : ''}</p><p class="text-[10px] text-charcoal-500 truncate">${r.e.position} · ${r.e.id}</p></div>
        </div>
        <span class="badge flex-shrink-0 ${empStatusBadge(r.e.status)}">${r.e.status}</span>
      </div>
      <div class="grid grid-cols-4 gap-1 mt-2 text-center">
        <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-xs font-bold text-charcoal-900">${r.reqs}</p><p class="text-[9px] text-charcoal-500">Requests</p></div>
        <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-xs font-bold ${r.ded ? 'text-red-600' : 'text-charcoal-900'}">${r.ded.toLocaleString('en-US')}</p><p class="text-[9px] text-charcoal-500">Ded. EGP</p></div>
        <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-xs font-bold text-charcoal-900">${r.avg !== null ? r.avg.toFixed(1) : '—'}</p><p class="text-[9px] text-charcoal-500">Eval /5</p></div>
        <div class="bg-charcoal-50 rounded-lg py-1.5"><p class="text-xs font-bold ${r.warns ? 'text-orange-600' : 'text-charcoal-900'}">${r.warns}</p><p class="text-[9px] text-charcoal-500">Warnings</p></div>
      </div>
    </div>`).join('')}</div>`;

    return `<div class="space-y-3">
      ${header(`${emps.length} employees · Click an employee to open their full performance history · Revive Gym — Nasr City`)}
      ${stats}
      ${desktop}
      ${mobile}
    </div>`;
  }

  // ==================== VIEW 2: ONE EMPLOYEE (drill-in) ====================
  const tab = state.perfTab || 'overview';
  const d = perfData(emp);

  // Month-filtered slices (follow-ups are undated -> always shown).
  const reqsF = d.requests.filter(inMonth);
  const dedsF = d.deductions.filter(inMonth);
  const evalsF = d.evaluations.filter(inMonth);
  const bonsF = d.bonuses.filter(inMonth);
  const warnsF = d.warnings.filter(inMonth);
  const attF = d.attendance.filter(inMonth);

  // --- Selected employee summary card ---
  const st = getEmployeeShiftStatus(emp);
  const summaryCard = `<div class="bg-white rounded-xl border border-charcoal-200 p-3 flex items-center gap-3">
    <div class="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">${emp.initials}</div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 flex-wrap">
        <p class="text-sm font-bold text-charcoal-900">${emp.name}</p>
        <span class="badge ${empStatusBadge(emp.status)}">${emp.status}</span>
        ${st.status !== emp.status ? `<span class="badge ${st.badge}">${st.status}</span>` : ''}
        ${d.leaving ? `<span class="badge badge-yellow">Leaving · ${d.leaving.lastDay}</span>` : ''}
      </div>
      <p class="text-[11px] text-charcoal-500 mt-0.5">${emp.position} · ${emp.id} · ${emp.shift} shift · Today: ${shiftLabel(st.shift)}</p>
    </div>
    <button onclick="openEmployeeProfile('${emp.id}')" class="btn btn-sm btn-secondary flex-shrink-0">Open profile</button>
  </div>`;

  // --- Tabs with counts ---
  const counts = {
    overview: null,
    requests: reqsF.length, deductions: dedsF.length, evaluations: evalsF.length,
    bonuses: bonsF.length, warnings: warnsF.length, attendance: attF.length,
  };
  const tabs = [
    { id: 'overview', label: 'Overview' }, { id: 'requests', label: 'Requests' },
    { id: 'deductions', label: 'Deductions' }, { id: 'evaluations', label: 'Evaluations' },
    { id: 'bonuses', label: 'Bonuses' }, { id: 'warnings', label: 'Warnings' },
    { id: 'attendance', label: 'Attendance' },
  ];
  const tabBar = `<div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200">
    ${tabs.map(t => {
      const n = counts[t.id];
      const on = tab === t.id;
      return `<button onclick="setPerfTab('${t.id}')" class="tab-btn ${on ? 'active' : ''}">${t.label}${n !== null ? `<span class="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${on ? 'bg-brand-100 text-brand-700' : n ? 'bg-charcoal-100 text-charcoal-600' : 'bg-charcoal-50 text-charcoal-400'}">${n}</span>` : ''}</button>`;
    }).join('')}
  </div>`;

  // --- Tab bodies ---
  let tabBody = '';

  if (tab === 'overview') {
    const dedTotal = dedsF.reduce((s, x) => s + x.amount, 0);
    const bonTotal = bonsF.reduce((s, x) => s + x.amount, 0);
    const pendingReqs = reqsF.filter(r => r.status === 'Pending').length;
    const avgScore = evalsF.length ? (evalsF.reduce((s, e) => s + e.score, 0) / evalsF.length) : null;
    const attWorked = attF.filter(a => a.status !== 'Off').length;
    const attOk = attF.filter(a => a.status === 'On Time' || a.status === 'Present').length;
    const kpi = (v, label, cls) => `<div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold ${cls}">${v}</p><p class="text-[10px] text-charcoal-500">${label}</p></div>`;
    const kpis = `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      ${kpi(reqsF.length, `Requests${pendingReqs ? ` · ${pendingReqs} pending` : ''}`, 'text-charcoal-900')}
      ${kpi(`EGP ${dedTotal.toLocaleString('en-US')}`, `Deductions${dedsF.length ? ` · ${dedsF.length}` : ''}`, 'text-red-600')}
      ${kpi(avgScore !== null ? `${avgScore.toFixed(1)} / 5` : '—', evalsF.length ? `Evaluations · ${evalsF[0].result}` : 'Evaluations', 'text-charcoal-900')}
      ${kpi(`EGP ${bonTotal.toLocaleString('en-US')}`, `Bonuses${bonsF.length ? ` · ${bonsF.length}` : ''}`, 'text-green-600')}
      ${kpi(warnsF.length, 'Warnings', warnsF.length ? 'text-orange-600' : 'text-charcoal-900')}
      ${kpi(attWorked ? `${attOk}/${attWorked}` : '—', 'Attendance on time', 'text-charcoal-900')}
    </div>`;

    // Open attention items + leaving notice.
    const attention = `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <p class="bento-label text-charcoal-500">NEEDS ATTENTION</p>
      ${d.followUps.length || d.leaving ? `<div class="space-y-1.5 mt-2">
        ${d.followUps.map(f => {
          const sev = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-blue' }[f.severity] || 'badge-gray';
          return `<div class="flex items-start justify-between gap-2 bg-charcoal-50 rounded-lg p-2.5">
            <div class="min-w-0"><p class="text-xs font-semibold text-charcoal-900">${f.type}</p><p class="text-[10px] text-charcoal-500 mt-0.5">${f.description}</p></div>
            <span class="badge ${sev} flex-shrink-0">${f.severity}</span>
          </div>`;
        }).join('')}
        ${d.leaving ? `<div class="flex items-start justify-between gap-2 bg-charcoal-50 rounded-lg p-2.5">
          <div class="min-w-0"><p class="text-xs font-semibold text-charcoal-900">Leaving — ${d.leaving.position}</p><p class="text-[10px] text-charcoal-500 mt-0.5">Last day ${d.leaving.lastDay} · ${d.leaving.reason}</p></div>
          ${statusBadge(d.leaving.status)}
        </div>` : ''}
      </div>` : `<p class="text-xs text-charcoal-500 mt-2">Nothing needs attention right now.</p>`}
    </div>`;

    // Recent activity across all categories, newest first.
    const feed = [
      ...reqsF.map(r => ({ sort: r.sort, title: `${r.type} request`, sub: `${r.when} · submitted ${r.submitted}`, status: r.status, go: r.src === 'team' ? `viewRequest('${r.id}')` : `openReqDetail('${r.id}')` })),
      ...dedsF.map(x => ({ sort: x.sort, title: `Deduction — ${x.title}`, sub: `${x.when} · EGP ${x.amount.toLocaleString('en-US')}`, status: x.status })),
      ...bonsF.map(x => ({ sort: x.sort, title: `Bonus — ${x.title}`, sub: `${x.when} · EGP ${x.amount.toLocaleString('en-US')}`, status: x.status })),
      ...warnsF.map(x => ({ sort: x.sort, title: `Warning — ${x.title}`, sub: x.when, status: x.status })),
      ...evalsF.map(x => ({ sort: x.sort, title: `Evaluation ${x.period}`, sub: `Score ${x.score}/${x.maxScore} · ${x.result}`, status: x.status, go: x.src === 'team' ? `openTeamEvalDetail('${x.id}')` : `openEvalDetail('${x.id}')` })),
    ].sort((a, b) => (b.sort || '').localeCompare(a.sort || '')).slice(0, 6);
    const recent = `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <p class="bento-label text-charcoal-500">RECENT ACTIVITY${monthName ? ` · ${monthName.toUpperCase()}` : ''}</p>
      <div class="mt-1">${feed.length ? feed.map(f => `<div class="flex items-center justify-between gap-2 py-1.5 border-b border-charcoal-100 last:border-0 ${f.go ? 'cursor-pointer hover:bg-charcoal-50/50' : ''}"${f.go ? ` onclick="${f.go}"` : ''}>
        <div class="min-w-0"><p class="text-xs text-charcoal-900 truncate">${f.title}</p><p class="text-[10px] text-charcoal-500">${f.sub}</p></div>
        ${statusBadge(f.status)}
      </div>`).join('') : emptyState(`No activity${monthName ? ` in ${monthName}` : ''}.`)}</div>
    </div>`;

    tabBody = `<div class="space-y-2">${kpis}${attention}${recent}</div>`;
  }

  else if (tab === 'requests') {
    tabBody = reqsF.length ? `<div class="space-y-1.5">${reqsF.map(r => `<div class="bg-charcoal-50 rounded-lg p-2.5 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold text-charcoal-900">${r.type}${r.src === 'self' ? ' <span class="text-[10px] text-charcoal-400 font-normal">(own record)</span>' : ''}</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${r.when} · Submitted ${r.submitted}</p>
        ${r.reason ? `<p class="text-[10px] text-charcoal-400 mt-0.5">${r.reason}</p>` : ''}
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">${statusBadge(r.status)}<button onclick="${r.src === 'team' ? `viewRequest('${r.id}')` : `openReqDetail('${r.id}')`}" class="btn btn-sm btn-secondary">View</button></div>
    </div>`).join('')}</div>` : emptyState(`No requests${monthName ? ` in ${monthName}` : ' on record'}.`);
  }

  else if (tab === 'deductions') {
    const total = dedsF.reduce((s, x) => s + x.amount, 0);
    tabBody = dedsF.length ? `<div class="space-y-1.5">
      <div class="flex items-center justify-between bg-white border border-charcoal-200 rounded-lg px-3 py-2">
        <p class="text-[11px] text-charcoal-500">${dedsF.length} deduction${dedsF.length === 1 ? '' : 's'}${monthName ? ` in ${monthName}` : ''}</p>
        <p class="text-xs font-bold text-red-600">Total EGP ${total.toLocaleString('en-US')}</p>
      </div>
      ${dedsF.map(x => `<div class="bg-charcoal-50 rounded-lg p-2.5 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold text-charcoal-900">${x.title}${x.src === 'payroll' ? ' <span class="text-[10px] text-charcoal-400 font-normal">(payslip)</span>' : ''}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${x.when}${x.by ? ` · ${x.by}` : ''}</p>
          ${x.note ? `<p class="text-[10px] text-charcoal-400 mt-0.5">${x.note}</p>` : ''}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0"><p class="text-xs font-bold text-red-600">EGP ${x.amount.toLocaleString('en-US')}</p>${statusBadge(x.status)}</div>
      </div>`).join('')}
    </div>` : emptyState(`No deductions${monthName ? ` in ${monthName}` : ' on record'}.`);
  }

  else if (tab === 'evaluations') {
    tabBody = evalsF.length ? `<div class="space-y-1.5">${evalsF.map(v => `<div class="bg-charcoal-50 rounded-lg p-2.5 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap"><p class="text-xs font-semibold text-charcoal-900">${v.period}</p>${resultBadge(v.result)}${statusBadge(v.status)}</div>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Score ${v.score} / ${v.maxScore}${v.src === 'self' ? ' · Personal record' : ' · Team evaluation'}</p>
      </div>
      <button onclick="${v.src === 'team' ? `openTeamEvalDetail('${v.id}')` : `openEvalDetail('${v.id}')`}" class="btn btn-sm btn-secondary flex-shrink-0">Details</button>
    </div>`).join('')}</div>` : emptyState(`No evaluations${monthName ? ` in ${monthName}` : ' on record'}.`);
  }

  else if (tab === 'bonuses') {
    const total = bonsF.reduce((s, x) => s + x.amount, 0);
    tabBody = bonsF.length ? `<div class="space-y-1.5">
      <div class="flex items-center justify-between bg-white border border-charcoal-200 rounded-lg px-3 py-2">
        <p class="text-[11px] text-charcoal-500">${bonsF.length} bonus${bonsF.length === 1 ? '' : 'es'}${monthName ? ` in ${monthName}` : ''}</p>
        <p class="text-xs font-bold text-green-600">Total EGP ${total.toLocaleString('en-US')}</p>
      </div>
      ${bonsF.map(x => `<div class="bg-charcoal-50 rounded-lg p-2.5 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold text-charcoal-900">${x.title}${x.src === 'payroll' ? ' <span class="text-[10px] text-charcoal-400 font-normal">(payslip)</span>' : ''}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${x.when}${x.by ? ` · ${x.by}` : ''}</p>
          ${x.note ? `<p class="text-[10px] text-charcoal-400 mt-0.5">${x.note}${x.detail ? ` — ${x.detail}` : ''}</p>` : ''}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0"><p class="text-xs font-bold text-green-600">EGP ${x.amount.toLocaleString('en-US')}</p>${statusBadge(x.status)}</div>
      </div>`).join('')}
    </div>` : emptyState(`No bonuses${monthName ? ` in ${monthName}` : ' on record'}.`);
  }

  else if (tab === 'warnings') {
    tabBody = warnsF.length ? `<div class="space-y-1.5">${warnsF.map(x => `<div class="bg-charcoal-50 rounded-lg p-2.5 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold text-charcoal-900">${x.title}</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${x.when}${x.by ? ` · ${x.by}` : ''}</p>
        <p class="text-[10px] text-charcoal-400 mt-0.5">${x.reason}${x.detail ? ` — ${x.detail}` : ''}</p>
      </div>
      ${statusBadge(x.status)}
    </div>`).join('')}</div>` : emptyState(`No warnings${monthName ? ` in ${monthName}` : ' on record'}.`);
  }

  else { // attendance
    const attOk = attF.filter(a => a.status === 'On Time' || a.status === 'Present').length;
    const attLate = attF.filter(a => a.status === 'Late').length;
    const attAbsent = attF.filter(a => a.status === 'Absent').length;
    tabBody = attF.length ? `<div class="space-y-1.5">
      <div class="flex flex-wrap gap-1.5">
        <span class="badge badge-green">${attOk} on time</span>
        <span class="badge badge-yellow">${attLate} late</span>
        <span class="badge badge-red">${attAbsent} absent</span>
        <span class="badge badge-blue">${attF.filter(a => a.status === 'Early Checkout').length} early</span>
      </div>
      ${attF.map(a => `<div class="bg-charcoal-50 rounded-lg p-2.5 flex items-center justify-between gap-3">
        <div class="min-w-0"><p class="text-xs font-medium text-charcoal-900">${a.dateLabel}</p><p class="text-[10px] text-charcoal-500 mt-0.5">${a.shift}${a.notes ? ` · ${a.notes}` : ''}</p></div>
        <div class="text-right flex-shrink-0"><p class="text-[10px] text-charcoal-500">In ${a.checkIn} · Out ${a.checkOut}</p>${statusBadge(a.status)}</div>
      </div>`).join('')}
    </div>` : emptyState(d.attendance.length ? `No attendance records${monthName ? ` in ${monthName}` : ''}.` : 'No attendance records on file for this employee.');
  }

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <button onclick="setPerfEmp(null)" class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 mb-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>All employees</button>
        <h1 class="text-xl font-bold text-charcoal-900">${emp.name} — Performance</h1>
        <p class="text-xs text-charcoal-500 mt-0.5">${emp.position} · ${emp.id} · ${monthName || 'All months'} · Revive Gym — Nasr City</p>
      </div>
      <div class="flex items-center gap-2">${monthSel}</div>
    </div>
    ${summaryCard}
    ${tabBar}
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">${tabBody}</div>
  </div>`;
}

// ==================== ATTENDANCE MANAGEMENT (Branch) ====================
function renderAttendanceManagement() {
  const late = MOCK.teamMembers.filter(m=>m.status==='Late');
  const absent = MOCK.teamMembers.filter(m=>m.status==='Absent');
  const present = MOCK.teamMembers.filter(m=>m.status==='Present').length;
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Attendance Management</h1><p class="text-xs text-charcoal-500 mt-0.5">Today's branch attendance · Revive Gym — Nasr City</p></div>
      <select class="form-select w-32" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>Today</option><option>This Week</option><option>This Month</option></select>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-brand-600">${present}</p><p class="text-[10px] text-charcoal-500">Present</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-yellow-600">${late.length}</p><p class="text-[10px] text-charcoal-500">Late</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></div><p class="text-lg font-bold text-red-600">${absent.length}</p><p class="text-[10px] text-charcoal-500">Absent</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-blue-600">1</p><p class="text-[10px] text-charcoal-500">Missing Checkout</p></div>
    </div>

    <!-- Late Check-ins -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-yellow-50/50">
        <p class="bento-label flex items-center gap-1.5 text-yellow-700"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>LATE CHECK-INS (${late.length})</p>
      </div>
      <div class="divide-y divide-charcoal-50">${late.map(m=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${m.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.position} · Checked in ${m.checkIn}</p></div>
        </div>
        ${attRowActions(m)}
      </div>`).join('')}</div>
    </div>

    <!-- Absent -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-red-50/50">
        <p class="bento-label flex items-center gap-1.5 text-red-700"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>ABSENT (${absent.length})</p>
      </div>
      <div class="divide-y divide-charcoal-50">${absent.map(m=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${m.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.position} · No check-in</p></div>
        </div>
        ${attRowActions(m)}
      </div>`).join('')}</div>
    </div>
  </div>`;
}

// "View" on an Attendance Management row — today's record plus whether this
// person has been late or absent before.
function openAttDetail(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  const be = MOCK.branchEmployees.find(x=>x.name===m.name);
  const e = be || { id:m.id, name:m.name, position:m.position, initials:m.initials, status:'Active' };
  const shift = getEmployeeTodayShift(e);
  const checkOut = (m.status==='Present'||m.status==='Late') ? '16:02' : '—';

  // Late / absent history from the branch's own follow-ups and pending
  // deductions — attendance issues only, not document or performance notes.
  const isAttIssue = t => /late|absent|unapproved|no ?show|missing/i.test(t || '');
  const events = [
    ...MOCK.followUpItems.filter(f=>f.employee===m.name && isAttIssue(f.type)).map(f=>({ label:f.type, detail:f.description, tone:f.severity==='high'?'red':'yellow', when:'Open follow-up' })),
    ...MOCK.deductionCandidates.filter(d=>d.employee===m.name && isAttIssue(d.reason)).map(d=>({ label:d.reason, detail:`EGP ${d.amount} deduction · ${d.status} by ${d.issuedBy}`, tone:/late/i.test(d.reason)?'yellow':'red', when:formatDate(d.date) })),
  ];
  const lateBefore = events.filter(x=>/late/i.test(x.label)).length;
  const absentBefore = events.length - lateBefore;
  const reqs = MOCK.teamRequests.filter(r=>r.employee===m.name);

  const tone = { red:'bg-red-50 text-red-700', yellow:'bg-yellow-50 text-yellow-700' };
  openModal(`${m.name} — today's attendance`, `<div class="space-y-3">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">${m.initials}</div>
      <div class="min-w-0">
        <p class="text-sm font-bold text-charcoal-900">${m.name} ${statusBadge(m.status)}</p>
        <p class="text-[10px] text-charcoal-500">${m.position} · ${e.id}</p>
      </div>
      <div class="ml-auto text-right flex-shrink-0">
        <p class="text-[10px] text-charcoal-400">Scheduled today</p>
        <p class="text-xs font-semibold text-charcoal-900">${shiftLabel(shift)}</p>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 text-center">
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="bento-label text-charcoal-500">Check in</p><p class="text-sm font-bold ${m.checkIn?'text-charcoal-900':'text-charcoal-400'} mt-0.5">${m.checkIn || '—'}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="bento-label text-charcoal-500">Check out</p><p class="text-sm font-bold ${checkOut!=='—'?'text-charcoal-900':'text-charcoal-400'} mt-0.5">${checkOut}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2"><p class="bento-label text-charcoal-500">Today</p><p class="text-sm font-bold ${m.status==='Late'?'text-yellow-600':m.status==='Absent'?'text-red-600':'text-brand-700'} mt-0.5">${m.status}</p></div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-3 py-2 border-b border-charcoal-100 bg-charcoal-50/50 flex items-center justify-between">
        <p class="bento-label">LATE / ABSENT HISTORY</p>
        <div class="flex items-center gap-1.5">
          <span class="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 rounded-full px-2 py-0.5 text-[9px] font-semibold">${lateBefore} late</span>
          <span class="inline-flex items-center gap-1 bg-red-50 text-red-700 rounded-full px-2 py-0.5 text-[9px] font-semibold">${absentBefore} absent</span>
        </div>
      </div>
      <div class="divide-y divide-charcoal-50">
        ${events.length ? events.map(x=>`<div class="px-3 py-2 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs font-medium text-charcoal-900 truncate">${x.label}</p>
            <p class="text-[10px] text-charcoal-500 truncate">${x.detail}</p>
          </div>
          <span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold flex-shrink-0 ${tone[x.tone]||tone.red}">${x.when}</span>
        </div>`).join('')
        : `<div class="px-3 py-4 text-center"><p class="text-xs text-charcoal-500">No late arrivals or absences on record</p></div>`}
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-3 py-2 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">REQUESTS (${reqs.length})</p></div>
      <div class="divide-y divide-charcoal-50">
        ${reqs.length ? reqs.map(r=>`<div class="px-3 py-2 flex items-center justify-between gap-2">
          <div class="min-w-0"><p class="text-xs font-medium text-charcoal-900 truncate">${r.type}</p><p class="text-[10px] text-charcoal-500 truncate">${r.date} · submitted ${r.submitted}</p></div>
          ${statusBadge(r.status)}
        </div>`).join('') : `<div class="px-3 py-4 text-center"><p class="text-xs text-charcoal-500">No requests on record</p></div>`}
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <button onclick="sendMessage('${m.id}')" class="btn btn-sm btn-secondary">Message</button>
      <button onclick="sendReminder('${m.id}')" class="btn btn-sm btn-secondary">Remind</button>
      <button onclick="addTeamFollowUp('${m.id}')" class="btn btn-sm btn-secondary">Take action</button>
      <button onclick="closeModal();openEmployeeProfile('${e.id}')" class="btn btn-sm btn-primary">Full profile</button>
    </div>
  </div>`, { wide:true });
}

// The three actions available on every Attendance Management row.
function attRowActions(m) {
  const be = MOCK.branchEmployees.find(x=>x.name===m.name);
  return `<div class="flex items-center gap-1.5 flex-shrink-0">
    <button onclick="addTeamFollowUp('${m.id}')" class="btn btn-sm btn-secondary">Take action</button>
    <button onclick="sendReminder('${m.id}')" class="btn btn-sm btn-secondary">Reminder</button>
    <button onclick="openAttDetail('${m.id}')" class="btn btn-sm btn-secondary">View</button>
    ${m.status==='Absent' ? `<button onclick="markPresent('${m.id}')" class="btn btn-sm btn-primary">Mark Present</button>` : ''}
  </div>`;
}

// ==================== REQUESTS MANAGEMENT (merged into Team Requests) ====================
// Kept as an alias so old links render the Team Requests design — the branch
// request flow for the BM lives on the Team Requests page now.
function renderRequestsManagement() { return renderTeamRequests(); }

// ==================== REQUEST ACTIONS ====================
// Team leader approves → request moves to "Pending HR" (still needs HR approval).
// The team leader can edit a team-approved request before HR signs off.
function approveRequest(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  r.status = 'Pending HR';
  r.teamApproved = true;
  r.teamApprovedBy = MOCK.currentUser.fullName;
  r.teamRejectedBy = undefined; r.teamRejectedDate = undefined;
  r.hrRejectedBy = undefined; r.hrRejectedDate = undefined;
  r.rejectionReason = undefined; r.rejectionType = undefined;
  renderAll(); showToast(`${r.employee}'s ${r.type} request approved by Team Leader — awaiting HR`);
}
function rejectRequest(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  openModal(`Reject Request — ${r.employee}`, `<form onsubmit="event.preventDefault();confirmRejectRequest('${id}')" class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-3">
      <div class="flex items-center justify-between"><p class="text-xs font-semibold text-charcoal-900">${r.type} · ${r.date}</p>${statusBadge(r.status)}</div>
      <p class="text-[10px] text-charcoal-500 mt-0.5">Submitted ${r.submitted}${r.teamApprovedBy?' · Team Leader approved by '+r.teamApprovedBy:''}</p>
    </div>
    <div><label class="form-label">Rejection reason (optional)</label><textarea id="reject-reason" class="form-input" rows="2" placeholder="Why are you rejecting this request?"></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-danger">Reject Request</button></div>
  </form>`);
}
function confirmRejectRequest(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  const reason = (document.getElementById('reject-reason')||{}).value || '';
  r.status = 'Rejected Pending HR';
  r.teamRejectedBy = MOCK.currentUser.fullName;
  r.teamRejectedDate = 'Sep 10';
  if (reason) r.rejectionReason = reason;
  closeModal(); renderAll(); showToast(`${r.employee}'s ${r.type} request rejected by Team Leader — awaiting HR confirmation`, 'error');
}
function editTeamRequest(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  openModal(`Edit Request — ${r.employee}`, `<form onsubmit="event.preventDefault();saveTeamRequestEdit('${id}')" class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-3">
      <div class="flex items-center justify-between"><p class="text-xs font-semibold text-charcoal-900">${r.type} · ${r.date}</p>${statusBadge(r.status)}</div>
      <p class="text-[10px] text-charcoal-500 mt-0.5">Submitted ${r.submitted} · ${r.teamApprovedBy?'Approved by '+r.teamApprovedBy:'Team Leader approved'}</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Type</label><select id="req-edit-type" class="form-select">${['Annual Leave','Sick Leave','Late Attendance','Early Leave','Shift Swap','Weekly Off Swap','Check-in Correction','Salary Advance','Paid Holiday'].map(t=>`<option ${t===r.type?'selected':''}>${t}</option>`).join('')}</select></div>
      <div><label class="form-label">Date</label><input id="req-edit-date" type="text" class="form-input" value="${r.date}" required></div>
    </div>
    <div><label class="form-label">Reason / Note</label><textarea id="req-edit-reason" class="form-input" rows="2" placeholder="Add a note...">${r.reason||''}</textarea></div>
    <div class="bg-blue-50 rounded-lg p-2.5 text-[10px] text-blue-700">This request was team-approved. Edits will still need <b>HR approval</b> before it is final.</div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Changes</button></div>
  </form>`, { wide:true });
}
function saveTeamRequestEdit(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  r.type = document.getElementById('req-edit-type').value;
  r.date = document.getElementById('req-edit-date').value.trim();
  r.reason = document.getElementById('req-edit-reason').value.trim();
  closeModal(); renderAll(); showToast(`${r.employee}'s ${r.type} request updated — still needs HR approval`);
}
function viewRequest(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  const initials = r.employee.split(' ').map(w=>w[0]).join('');
  const rejectedByTeam = !!r.teamRejectedBy;
  const rejectedByHR = !!r.hrRejectedBy;

  // Build approval timeline
  const steps = [];
  steps.push({ label:'Submitted', by:r.employee, date:r.submitted, ok:null });
  if (r.teamApprovedBy) steps.push({ label:'Team Leader Approved', by:r.teamApprovedBy, date:r.teamApprovedDate||'—', ok:true });
  if (r.teamRejectedBy) steps.push({ label:'Team Leader Rejected', by:r.teamRejectedBy, date:r.teamRejectedDate||'—', ok:false });
  if (r.hrApprovedBy) steps.push({ label:'HR Approved', by:r.hrApprovedBy, date:r.hrApprovedDate||'—', ok:true });
  if (r.hrRejectedBy) steps.push({ label:'HR Rejected', by:r.hrRejectedBy, date:r.hrRejectedDate||'—', ok:false });
  if (r.rejectionType==='expired') steps.push({ label:'Rejected — time passed', by:'Time passed', date:r.hrRejectedDate||r.teamRejectedDate||'—', ok:false });
  if (r.status==='Pending') steps.push({ label:'Team Leader Review', by:'Awaiting Team Leader approval', date:'', ok:'pending' });
  if (r.status==='Pending HR') steps.push({ label:'HR Review', by:'Awaiting HR approval', date:'', ok:'pending' });
  if (r.status==='Rejected Pending HR') steps.push({ label:'HR Rejection Review', by:'Awaiting HR confirmation', date:'', ok:'pending' });

  const stepRow = (s,i) => `<div class="flex gap-3">
    <div class="flex flex-col items-center">
      <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.ok===true?'bg-green-100 text-green-700':s.ok===false?'bg-red-100 text-red-700':s.ok==='pending'?'bg-charcoal-100 text-charcoal-400':'bg-brand-100 text-brand-700'}">
        ${s.ok===true?'<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>':s.ok===false?'<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>':s.ok==='pending'?'<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>':'<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>'}
      </div>
      ${i<steps.length-1?'<div class="w-px flex-1 bg-charcoal-100 my-0.5"></div>':''}
    </div>
    <div class="pb-4 min-w-0">
      <p class="text-xs font-semibold text-charcoal-900">${s.label}</p>
      <p class="text-[10px] text-charcoal-500">${s.by}${s.date?' · '+s.date:''}</p>
    </div>
  </div>`;

  const rejectionBanner = (r.status==='Rejected'||r.status==='Rejected Pending HR') ? `<div class="bg-red-50 border border-red-100 rounded-lg p-3">
    <p class="text-xs font-semibold text-red-700 flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>${r.status==='Rejected Pending HR'?'Rejected by Team Leader — awaiting HR confirmation':r.rejectionType==='expired'?'Rejected — time passed':rejectedByTeam&&rejectedByHR?'Rejected by both Team Leader & HR':rejectedByTeam?'Rejected by Team Leader':rejectedByHR?'Rejected by HR':'Rejected'}</p>
    ${r.rejectionReason?`<p class="text-[10px] text-red-600 mt-1">${r.rejectionReason}</p>`:''}
  </div>` : '';

  openModal(`Request Review — ${r.employee}`, `<div class="space-y-3">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${initials}</div>
      <div class="flex-1 min-w-0"><p class="text-sm font-semibold text-charcoal-900">${r.employee}</p><p class="text-[10px] text-charcoal-500">${r.type} · ${r.date}</p></div>
      ${statusBadge(r.status)}
    </div>
    ${rejectionBanner}
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Request Type</p><p class="text-xs font-semibold text-charcoal-900">${r.type}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Date</p><p class="text-xs font-semibold text-charcoal-900">${r.date}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Submitted</p><p class="text-xs font-semibold text-charcoal-900">${r.submitted}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Status</p><div>${statusBadge(r.status)}</div></div>
    </div>
    ${r.reason?`<div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Reason / Note</p><p class="text-xs text-charcoal-800 mt-0.5">${r.reason}</p></div>`:''}
    <div>
      <p class="bento-label mb-2">APPROVAL TIMELINE</p>
      <div>${steps.map(stepRow).join('')}</div>
    </div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button></div>
  </div>`, { wide:true });
}
function openRequestComment(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  openModal(`Comment — ${r.employee}`, `<div class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-3">
      <p class="text-xs font-semibold text-charcoal-900">${r.type} · ${r.date}</p>
      <p class="text-[10px] text-charcoal-500 mt-0.5">Submitted ${r.submitted} · ${r.status}</p>
    </div>
    <div><label class="form-label">Comment</label><textarea id="req-comment" class="form-input" rows="3" placeholder="Add a comment for ${r.employee}..."></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="saveRequestComment('${id}')" class="btn btn-sm btn-primary">Post Comment</button></div>
  </div>`);
}
function saveRequestComment(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  const c = document.getElementById('req-comment').value.trim();
  closeModal(); showToast(c ? `Comment added to ${r.employee}'s request` : 'No comment entered', c ? 'success' : 'info');
}

// ==================== FOLLOW-UP ACTIONS ====================
function openFollowUp(id) {
  const f = MOCK.followUpItems.find(x=>x.id===id);
  if(!f) return;
  openModal(`Follow Up — ${f.employee}`, `<div class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-3">
      <p class="text-xs font-semibold text-charcoal-900">${f.type}</p>
      <p class="text-[10px] text-charcoal-500 mt-0.5">${f.description}</p>
    </div>
    <div><label class="form-label">Action</label><select id="fu-action" class="form-select"><option>Send reminder</option><option>Schedule a meeting</option><option>Escalate to manager</option><option>Mark as resolved</option></select></div>
    <div><label class="form-label">Note</label><textarea id="fu-note" class="form-input" rows="2" placeholder="Add a note..."></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="saveFollowUp('${id}')" class="btn btn-sm btn-primary">Save Action</button></div>
  </div>`);
}
function saveFollowUp(id) {
  const f = MOCK.followUpItems.find(x=>x.id===id);
  if(!f) return;
  const action = document.getElementById('fu-action').value;
  closeModal(); showToast(`${action} for ${f.employee}`);
}

// ==================== EMPLOYEE ACTIONS ====================
// Open a branch employee's full profile. Branch employees use RV-XXXX ids,
// so map to the matching team member (by name) for the profile page.
// ==================== EMPLOYEE PROFILE (same page HR sees) ====================
// Clicking an employee on the Employees page opens the identical tabbed profile
// page HR gets — same header, same nine tabs, same data blocks — but bound to this
// branch's own data (teamProfiles / teamRequests / teamEvaluations / teamSchedule).
function empResolve(id) {
  const be = MOCK.branchEmployees.find(x=>x.id===id);
  if (be) {
    const tm = MOCK.teamMembers.find(x=>x.name===be.name);
    return { be, tm, p: (tm && MOCK.teamProfiles[tm.id]) || (be.name===MOCK.currentUser.fullName ? MOCK.currentUser : {}) };
  }
  const tm = MOCK.teamMembers.find(x=>x.id===id);
  if (!tm) return null;
  const match = MOCK.branchEmployees.find(x=>x.name===tm.name);
  return { be: match || { id: tm.id.toUpperCase(), name: tm.name, position: tm.position, status: tm.status, initials: tm.initials }, tm, p: MOCK.teamProfiles[tm.id] || {} };
}

// Contact details a Branch Manager may correct for their own branch's people.
// Seeded lazily from the employee's profile so the data is never duplicated.
function empContact(be, p) {
  if (!MOCK.memberContacts) MOCK.memberContacts = {};
  if (!MOCK.memberContacts[be.id]) {
    MOCK.memberContacts[be.id] = { phone: p.phone || '', email: p.email || '', address: p.address || '' };
  }
  return MOCK.memberContacts[be.id];
}

function openEditMemberContact(id) {
  const r = empResolve(id); if (!r) return;
  const c = empContact(r.be, r.p);
  openModal('Edit Contact Information', `<form onsubmit="event.preventDefault();saveMemberContact('${id}')" class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-500">Editing the contact details of <b>${r.be.name}</b> (${r.be.id}). Personal information above is read-only and stays with HR.</div>
    <div><label class="form-label">Mobile Number</label><input id="mc-phone" type="tel" class="form-input" value="${c.phone}" required></div>
    <div><label class="form-label">Personal Email</label><input id="mc-email" type="email" class="form-input" value="${c.email}" required></div>
    <div><label class="form-label">Address</label><textarea id="mc-address" class="form-input" rows="2" required>${c.address}</textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save</button></div>
  </form>`, { wide:true });
}

function saveMemberContact(id) {
  const r = empResolve(id); if (!r) return;
  const c = empContact(r.be, r.p);
  c.phone = (document.getElementById('mc-phone') || {}).value.trim() || c.phone;
  c.email = (document.getElementById('mc-email') || {}).value.trim() || c.email;
  c.address = (document.getElementById('mc-address') || {}).value.trim() || c.address;
  closeModal(); renderAll(); showToast(`${r.be.name}'s contact information updated`);
}

function openEmployeeProfile(id) {
  const r = empResolve(id);
  if (!r) { showToast('Employee not found','error'); return; }
  state.empTab = 'personal';
  navigateTo('employee-profile', { id: r.be.id });
}

function renderEmployeeProfile() {
  const r = empResolve((state.pageParams && state.pageParams.id) || '');
  if (!r) return '<div class="text-center py-20"><p class="text-charcoal-500">Employee not found</p></div>';
  const e = r.be, m = r.tm, p = r.p || {};
  const tab = state.empTab || 'personal';

  const gym = (p.gym && p.gym.name) ? (p.gym.name + ' — ' + p.gym.branch) : (p.gym || 'Revive Gym — Nasr City');
  const salary = p.baseSalary || MOCK.currentUser.baseSalary;
  const level = p.level || 'Mid';
  const hireDate = p.hireDate ? formatDate(p.hireDate) : '—';
  const reqs = m ? MOCK.teamRequests.filter(x=>x.employee===m.name) : [];
  const evals = m ? MOCK.teamEvaluations.filter(x=>x.employee===m.name) : [];
  const days = ['Mon 25','Tue 26','Wed 27','Thu 28','Fri 29','Sat 30','Sun 31'];
  const schedIds = m ? (MOCK.teamSchedule[m.id] || []) : [];
  const shift = m ? getTeamMemberTodayShift(m) : null;
  const isAbsent = !!m && m.status === 'Absent';
  const isLate = !!m && m.status === 'Late';
  // Live status on the header — the same one the Employees list shows, falling
  // back to the employment status when they are away (on leave / suspended).
  const statusText = (e.status && e.status !== 'Active') ? e.status : (m ? m.status : e.status);
  const canApprove = hasPermission('requests.approve.team') || hasPermission('requests.approve');
  const canLeaveManage = hasPermission('employees.leave_balance.manage');
  const contact = empContact(e, p);

  const tabs = [
    {id:'personal',label:'Personal Info'}, {id:'documents',label:'Documents'},
    {id:'employment',label:'Employment History'}, {id:'attendance',label:'Attendance Summary'},
    {id:'shift',label:'Current Shift'}, {id:'requests',label:'Requests History'},
    {id:'leave',label:'Leave Balance'}, {id:'eval',label:'Evaluations History'}, {id:'payroll',label:'Payroll Snapshot'},
  ];

  // Actions a Branch Manager holds on their own branch's people.
  let lifecycleActions = '';
  if (m) lifecycleActions += `<button onclick="sendMessage('${m.id}')" class="btn btn-sm btn-secondary">Message</button>`;
  if (m) lifecycleActions += `<button onclick="openEvaluateMember('${m.id}')" class="btn btn-sm btn-secondary">Evaluate</button>`;
  if (isAbsent && m) lifecycleActions += `<button onclick="markPresent('${m.id}')" class="btn btn-sm btn-primary">Mark Present</button>`;
  if ((isAbsent || isLate) && m) lifecycleActions += `<button onclick="sendReminder('${m.id}')" class="btn btn-sm btn-secondary">Remind</button>`;
  lifecycleActions += `<button onclick="openChangeStatus('${e.id}')" class="btn btn-sm btn-secondary">Change Status</button>`;
  if (hasPermission('employees.offboard')) lifecycleActions += `<button onclick="navigateTo('leaving')" class="btn btn-sm btn-danger-outline">Offboard</button>`;

  const tabContent = {
    // Personal Info — same layout as the "My Profile" page (bento: 2 editable
    // cols + 1 HR-controlled col), minus the Emergency Contact block.
    personal: `<div class="grid grid-cols-1 lg:grid-cols-3 gap-2">
      <div class="lg:col-span-2 space-y-2">
        <!-- Personal Info — read-only for a Branch Manager -->
        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
          <div class="px-3 py-2 border-b border-charcoal-100 flex justify-between items-center bg-charcoal-50/50">
            <div>
              <p class="bento-label">PROFILE DETAILS</p>
              <h3 class="text-sm font-bold text-charcoal-900 mt-0.5">Personal Info</h3>
            </div>
            <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-charcoal-400">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              Read-only
            </span>
          </div>
          <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label class="bento-label text-charcoal-500">Full Name</label><p class="text-xs text-charcoal-900 mt-0.5">${e.name}</p></div>
            <div><label class="bento-label text-charcoal-500">Date of Birth</label><p class="text-xs text-charcoal-900 mt-0.5">${p.dateOfBirth ? formatDate(p.dateOfBirth) : '—'}</p></div>
            <div><label class="bento-label text-charcoal-500">National ID</label><p class="text-xs text-charcoal-900 mt-0.5">${p.nationalId || '—'}</p></div>
            <div><label class="bento-label text-charcoal-500">Gender</label><p class="text-xs text-charcoal-900 mt-0.5">${p.gender || '—'}</p></div>
          </div>
        </div>

        <!-- Contact Info — the only thing a Branch Manager may correct -->
        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
          <div class="px-3 py-2 border-b border-charcoal-100 flex justify-between items-center bg-charcoal-50/50">
            <div>
              <p class="bento-label">COMMUNICATION</p>
              <h3 class="text-sm font-bold text-charcoal-900 mt-0.5">Contact Info</h3>
            </div>
            <button onclick="openEditMemberContact('${e.id}')" class="text-brand-600 hover:text-brand-700 text-[10px] font-semibold flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              Edit
            </button>
          </div>
          <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label class="bento-label text-charcoal-500">Mobile Number</label><p class="text-xs text-charcoal-900 mt-0.5">${contact.phone || '—'}</p></div>
            <div><label class="bento-label text-charcoal-500">Personal Email</label><p class="text-xs text-charcoal-900 mt-0.5">${contact.email || '—'}</p></div>
            <div class="sm:col-span-2"><label class="bento-label text-charcoal-500">Residential Address</label><p class="text-xs text-charcoal-900 mt-0.5">${contact.address || '—'}</p></div>
          </div>
        </div>
      </div>

      <!-- Employment Info — HR controlled, mirrors the My Profile right column -->
      <div class="space-y-2">
        <div class="bg-charcoal-50 rounded-xl border border-charcoal-200 overflow-hidden relative">
          <div class="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] pointer-events-none"></div>
          <div class="px-3 py-2 border-b border-charcoal-200 flex justify-between items-center bg-charcoal-100/50 relative z-10">
            <div>
              <p class="bento-label flex items-center gap-1 text-charcoal-600">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                HR CONTROLLED
              </p>
              <h3 class="text-sm font-bold text-charcoal-900 mt-0.5">Employment Info</h3>
            </div>
          </div>
          <div class="p-3 space-y-2 relative z-10">
            ${[
              ['Employee ID', e.id, 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0'],
              ['Primary Location', gym, 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'],
              ['Job Title / Position', e.position, 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'],
              ['Employment Level', level, null],
              ['Hire Date', hireDate, 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'],
            ].map(([k,v,icon])=>`<div class="flex justify-between items-end border-b border-charcoal-200 pb-2">
              <div><p class="bento-label text-charcoal-500">${k}</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${v || '—'}</p></div>
              ${icon ? `<svg class="w-3.5 h-3.5 text-charcoal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg>` : ''}
            </div>`).join('')}
            <div class="flex justify-between items-end">
              <div><p class="bento-label text-charcoal-500">Current Status</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full ${statusText==='Active'||m ? 'bg-brand-500' : 'bg-charcoal-400'}"></span>${statusText}${p.employmentType ? ' · ' + p.employmentType : ''}</p></div>
            </div>
          </div>
        </div>
      </div>
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
    </div>`,
    employment: `<div class="space-y-2">
      ${[
        {type:'Position Changed',from:'Junior Trainer',to:e.position,date:'01 Aug 2026',detail:'Promoted based on the Q2 2026 evaluation.'},
        {type:'Gym Transfer',from:'Heliopolis',to:gym,date:'01 May 2026',detail:'Requested transfer approved by HR.'},
        {type:'Joined Revive',from:null,to:null,date:hireDate,detail:'Initial hire.'},
      ].map(h=>`<div class="flex items-start gap-3 bg-charcoal-50 rounded-lg p-2.5">
        <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${h.type.split(' ').map(w=>w[0]).join('')}</div>
        <div><p class="text-xs font-medium text-charcoal-900">${h.type}</p><p class="text-[10px] text-charcoal-500">${h.date}${h.from?` · ${h.from} → ${h.to}`:''}</p><p class="text-[10px] text-charcoal-600 mt-0.5">${h.detail}</p></div>
      </div>`).join('')}
    </div>`,
    attendance: `<div class="bg-charcoal-50 rounded-lg p-3 text-center mb-2"><p class="text-2xl font-bold text-brand-600">${m && isAbsent ? '96.2%' : '96.4%'}</p><p class="text-[10px] text-charcoal-500">Attendance Rate</p></div>
    <div class="grid grid-cols-3 gap-2 mb-2">
      ${[['Present', m && isAbsent ? 24 : 25, 'text-green-600'],['Late', m && isLate ? 3 : 2, 'text-yellow-600'],['Absent', m && isAbsent ? 2 : 1, 'text-red-600']].map(([k,v,c])=>`<div class="bg-white rounded-lg border border-charcoal-200 p-2 text-center"><p class="text-base font-bold ${c}">${v}</p><p class="text-[10px] text-charcoal-500">${k}</p></div>`).join('')}
    </div>
    <div class="space-y-1.5">${[
      ['Aug 26', m ? (m.checkIn || '—') : '—', m && (m.status==='Present'||m.status==='Late') ? '16:02' : '—', m ? m.status : 'On Time'],
      ['Aug 25','16:08','00:01','Late'],
      ['Aug 24','—','—','Off'],
      ['Aug 23','07:58','16:03','On Time'],
    ].map(([d,ci,co,st])=>`<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2">
      <p class="text-xs text-charcoal-700">${d}</p><p class="text-[10px] text-charcoal-500">${ci} → ${co}</p>${statusBadge(st)}
    </div>`).join('')}</div>`,
    shift: `<div class="bg-charcoal-50 rounded-lg p-3 text-center"><p class="text-base font-bold text-charcoal-900">${shift ? shiftLabel(shift) : (e.shift || 'Morning') + ' · assigned this week'}</p><p class="text-[10px] text-charcoal-500 mt-1">Current Week · Sep 7 – 13</p></div>
    <div class="grid grid-cols-7 gap-1 mt-3">${['M','T','W','T','F','S','S'].map((d,i)=>{
      const sid = schedIds[i];
      const t = sid ? getShiftTemplate(sid) : null;
      const c = t ? getShiftColor(t) : null;
      return `<div class="rounded-lg border p-2 text-center ${i===1?'border-brand-500 bg-brand-50':''}"><p class="text-[9px] text-charcoal-400 font-semibold">${d}</p><p class="text-[10px] mt-1 ${c?'font-medium':'text-charcoal-300'}" ${c?`style="color:${c.text}"`:''}>${t ? (t.isOff ? 'OFF' : t.start) : (i===1 && m ? (m.checkIn ? m.checkIn : '08:00') : '08:00')}</p></div>`;
    }).join('')}</div>`,
    requests: `<div class="space-y-1.5">${reqs.map(r=>`<div class="flex items-center justify-between gap-2 bg-charcoal-50 rounded-lg p-2.5">
      <div class="min-w-0"><p class="text-xs font-medium text-charcoal-900">${r.type}</p><p class="text-[10px] text-charcoal-500">${r.date} · Submitted ${r.submitted}${r.teamApprovedBy?' · Approved by '+r.teamApprovedBy:''}${r.hrApprovedBy?' · HR: '+r.hrApprovedBy:''}</p>${r.reason?`<p class="text-[10px] text-charcoal-400 mt-0.5">${r.reason}</p>`:''}</div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        ${statusBadge(r.status)}
        ${canApprove && r.status==='Pending' ? `<button onclick="approveRequest('${r.id}')" class="btn btn-sm btn-primary">Approve</button><button onclick="rejectRequest('${r.id}')" class="btn btn-sm btn-danger-outline">Reject</button>` : ''}
      </div>
    </div>`).join('') || `<div class="bg-charcoal-50 rounded-lg p-4 text-center"><p class="text-xs text-charcoal-500">No requests found</p></div>`}</div>`,
    leave: `${canLeaveManage?`<div class="flex justify-end mb-2"><button onclick="showToast('Edit leave balance — simulated')" class="btn btn-sm btn-primary">Edit Balance</button></div>`:''}
    <div class="border${canLeaveManage?'':'-2 border-dashed border-charcoal-200 rounded-xl'} space-y-2 ${canLeaveManage?'':'p-3'}">
      ${[['Annual Leave','10','of 21 days'],['Sick Leave','3','of 10 days'],['Unpaid Leave','0','of 5 days']].map(([k,v,t])=>`<div class="bg-charcoal-50 rounded-lg p-2.5"><div class="flex items-center justify-between"><p class="text-xs font-medium text-charcoal-900">${k}</p><p class="text-xs font-bold text-brand-600">${v} <span class="text-charcoal-400 font-normal">${t}</span></p></div><div class="w-full h-1.5 bg-charcoal-200 rounded-full mt-1.5 overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:${Math.min(100,parseInt(v)*10)}%"></div></div></div>`).join('')}
    </div>
    ${!canLeaveManage?`<p class="text-[10px] text-charcoal-400 mt-2 text-center">Leave balance is <strong>view-only</strong> — you do not have <code>employees.leave_balance.manage</code>.</p>`:''}`,
    eval: `<div class="space-y-1.5">${(evals.length ? evals : [['Q2 2026','4.2','Exceeds'],['Q1 2026','3.8','Meets']]).map(v=>{
      const isObj = typeof v === 'object';
      const period = isObj ? v.period : v[0], score = isObj ? v.score : v[1], result = isObj ? v.result : v[2];
      return `<div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
        <div><p class="text-xs font-medium text-charcoal-900">${period}</p><p class="text-[10px] text-charcoal-500">Score: ${score}/5</p></div>${statusBadge(result)}
      </div>`;
    }).join('')}</div>`,
    payroll: `<div class="bg-charcoal-50 rounded-lg p-3 flex items-center justify-between">
        <div><p class="text-[10px] text-charcoal-500">LATEST PAYSLIP</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">July 2026 · Paid Aug 5</p></div>
        <p class="text-sm font-bold text-charcoal-900">EGP ${salary.toLocaleString()}</p>
      </div>
      <p class="text-[10px] text-charcoal-400 text-center mt-2">Full payslips live in HR payroll — the Branch Manager sees the net figure only.</p>`,
  }[tab];

  return `<div class="space-y-3">
    <div class="flex items-center gap-2">
      <button onclick="navigateTo('employees')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>Employees</button>
      <span class="text-charcoal-300">/</span>
      <p class="text-xs text-charcoal-500">${e.name}</p>
    </div>

    <!-- Profile Header -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-semibold flex-shrink-0">${e.initials}</div>
          <div class="min-w-0">
            <p class="text-base font-bold text-charcoal-900">${e.name} ${statusBadge(statusText)}</p>
            <p class="text-xs text-charcoal-500 mt-0.5">${e.position} · ${level} · ${gym}${hireDate!=='—' ? ' · ' + hireDate : ''}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${lifecycleActions ? lifecycleActions : '<p class="text-[10px] text-charcoal-400">No lifecycle actions granted for your role.</p>'}
        </div>
      </div>
      <div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200 mt-3">
        ${tabs.map(t=>`<button onclick="state.empTab='${t.id}';renderAll()" class="tab-btn ${state.empTab===t.id?'active':''}">${t.label}</button>`).join('')}
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 p-4">${tabContent}</div>
  </div>`;
}

function openNewEmployee() {
  openModal('New Employee', `<form onsubmit="event.preventDefault();saveNewEmployee()" class="space-y-3">
    <div><label class="form-label">Full Name</label><input id="emp-new-name" type="text" class="form-input" placeholder="e.g. Mohamed Ali" required></div>
    <div><label class="form-label">Position</label><select id="emp-new-position" class="form-select"><option>Trainer</option><option>Receptionist</option><option>Cleaner</option><option>Maintenance</option></select></div>
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-500">Their shift will be assigned from the <b>${MOCK.currentUser.role === 'Branch Manager' ? 'Branch Schedule' : 'Team Schedule'}</b>.</div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Add Employee</button></div>
  </form>`);
}
function saveNewEmployee() {
  const name = document.getElementById('emp-new-name').value.trim();
  if(!name) return;
  const id = 'RV-00' + (136 + MOCK.branchEmployees.length);
  MOCK.branchEmployees.push({ id, name, position: document.getElementById('emp-new-position').value, status: 'Active', initials: name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() });
  closeModal(); renderAll(); showToast(`${name} added to employees`);
}
function openEditEmployee(id) {
  const e = MOCK.branchEmployees.find(x=>x.id===id);
  if(!e) return;
  openModal(`Edit ${e.name}`, `<form onsubmit="event.preventDefault();saveEmployee('${id}')" class="space-y-3">
    <div><label class="form-label">Full Name</label><input id="emp-name" type="text" class="form-input" value="${e.name}" required></div>
    <div><label class="form-label">Position</label><select id="emp-position" class="form-select">${['Trainer','Receptionist','Cleaner','Maintenance'].map(p=>`<option ${p===e.position?'selected':''}>${p}</option>`).join('')}</select></div>
    <div><label class="form-label">Employment Status</label><select id="emp-status" class="form-select">${['Active','On Leave','Suspended','Terminated'].map(s=>`<option ${s===e.status?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-500">Shift is assigned from the <b>${MOCK.currentUser.role === 'Branch Manager' ? 'Branch Schedule' : 'Team Schedule'}</b> — edit it there.</div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Changes</button></div>
  </form>`);
}
function saveEmployee(id) {
  const e = MOCK.branchEmployees.find(x=>x.id===id);
  if(!e) return;
  e.name = document.getElementById('emp-name').value.trim();
  e.position = document.getElementById('emp-position').value;
  e.status = document.getElementById('emp-status').value;
  e.initials = e.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  closeModal(); renderAll(); showToast(`${e.name} updated`);
}
function openChangeStatus(id) {
  const e = MOCK.branchEmployees.find(x=>x.id===id);
  if(!e) return;
  openModal(`Employment Status — ${e.name}`, `<form onsubmit="event.preventDefault();saveEmployeeStatus('${id}')" class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-3 flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${e.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${e.name}</p><p class="text-[10px] text-charcoal-500">${e.position} · ${shiftLabel(getEmployeeTodayShift(e))}</p></div></div>
    <div><label class="form-label">Employment Status</label><select id="emp-status-new" class="form-select">${['Active','On Leave','Suspended','Terminated'].map(s=>`<option ${s===e.status?'selected':''}>${s}</option>`).join('')}</select></div>
    <div><label class="form-label">Note (optional)</label><textarea id="emp-status-note" class="form-input" rows="2" placeholder="Reason for status change..."></textarea></div>
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-500">On Leave / Suspended / Terminated override the auto shift status. Otherwise the status is derived from today's assigned shift.</div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Update Status</button></div>
  </form>`);
}
function saveEmployeeStatus(id) {
  const e = MOCK.branchEmployees.find(x=>x.id===id);
  if(!e) return;
  e.status = document.getElementById('emp-status-new').value;
  closeModal(); renderAll(); showToast(`${e.name} status changed to ${e.status}`);
}

// ==================== BRANCH ACTIONS (Branch Manager palette) ====================
// Quick-action launcher in the sidebar under the "Branch" section.
// Every action below is something a Branch Manager can do in their own gym —
// items marked "→ HR" create something HR must review/approve afterwards
// (two-stage approval, features.md §9/§10).
const BRANCH_ACTIONS = [
  { id:'deduction', label:'Issue Deduction', desc:'Deduct an amount (absence, late, damage) — sent to HR for approval', icon:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2-1.343-2-3-2zM3 12c0 4.418 4.03 8 9 8s9-3.582 9-8-4.03-8-9-8-9 3.582-9 8z', perm:'attendance.edit', toHR:true, run:'openIssueDeduction()' },
  { id:'warning', label:'Issue Warning Notice', desc:'Formal written warning — HR files it to the employee record', icon:'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.668 1.732-3L13.732 4c-.77-1.332-2.694-1.332-3.464 0L3.34 16c-.77 1.332.192 3 1.732 3z', perm:'employees.edit', toHR:true, run:'openIssueWarning()' },
  { id:'bonus', label:'Propose Bonus', desc:'Recommend a bonus/overtime payout — HR adds it to payroll', icon:'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', perm:'employees.edit', toHR:true, run:'openProposeBonus()' },
  { id:'requests', label:'Review Team Requests', desc:'Stage-1 approve/reject — HR gives the final decision', icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', perm:'requests.view', toHR:true, run:"navigateTo('team-requests')" },
  { id:'attendance', label:'Correct Attendance', desc:'Fix missing check-ins/outs and flag absences', icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', perm:'attendance.edit', run:"navigateTo('attendance-management')" },
  { id:'vacancy', label:'Request Vacancy', desc:'Ask HR to open a new position for the gym', icon:'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', perm:'recruitment.vacancy_request.create', toHR:true, run:"navigateTo('recruitment')" },
  { id:'shifts', label:'Publish Shift Schedule', desc:'Assign shifts for the next cycle and publish', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', perm:'schedule.manage', run:"state.tsEditing=true;navigateTo('team-schedule')" },
  { id:'status', label:'Change Employment Status', desc:'Active / On Leave / Suspended / Terminated', icon:'M10 14l2-2m0 0l2-2m-2 2l2-2m-2 2l-2-2M21 12a9 9 0 11-18 0 9 9 0 0118 0z', perm:'employees.status.change', run:"navigateTo('employees')" },
  { id:'offboard', label:'Offboard Employee', desc:'Start the leaving flow for a subordinate', icon:'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', perm:'employees.offboard', toHR:true, run:"navigateTo('leaving')" },
  { id:'report', label:'Send Report to HR', desc:'Monthly branch summary: attendance, requests, incidents', icon:'M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', perm:null, toHR:true, run:'openSendReportToHR()' },
];

function openBranchActions() {
  const showAll = DEMO.showAll;
  const can = p => showAll || !p || hasPermission(p);
  // Opened from the branch Employees page ("Actions"). Both the Branch Manager
  // and the Team Leader (who now gets the BM's branch-wide pages) act on the
  // whole branch roster, so brand it for the branch and name the acting role.
  const roleName = MOCK.currentUser.role;
  const modalTitle = 'Branch Actions';
  const hrTag = '<span class="text-[9px] font-bold uppercase bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200 px-1 py-0.5 rounded">&rarr; HR</span>';
  const intro = `Actions you can take as ${roleName} for <b>Revive Gym — Nasr City</b>. Items tagged ${hrTag} are sent to HR for final approval.`;
  const acts = BRANCH_ACTIONS.filter(a => can(a.perm));
  const pend = branchHrQueue().filter(d=>d.status==='Pending HR');
  const cards = acts.map(a => `
    <button onclick="closeModal();${a.run}" class="text-left flex items-start gap-2.5 p-3 rounded-lg border border-charcoal-200 hover:border-brand-300 hover:bg-brand-50/60 transition-colors group">
      <span class="w-8 h-8 flex-shrink-0 rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 flex items-center justify-center">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${a.icon}"/></svg>
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs font-semibold text-charcoal-900">${a.label}</span>
          ${a.toHR?'<span class="text-[9px] font-bold uppercase tracking-wide bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200 px-1.5 py-0.5 rounded">&rarr; HR</span>':''}
        </span>
        <span class="block text-[10px] text-charcoal-500 mt-0.5 leading-snug">${a.desc}</span>
      </span>
    </button>`).join('');
  const pendHtml = pend.length ? `
    <div class="mt-3 bg-charcoal-50 rounded-lg p-2.5">
      <p class="bento-label mb-1.5">Awaiting HR (${pend.length})</p>
      ${pend.map(d=>`<div class="flex items-center justify-between py-1 border-b border-charcoal-100 last:border-0">
        <div class="min-w-0"><p class="text-[11px] font-medium text-charcoal-800 truncate">${d.employee} — ${d.detail}</p>
        <p class="text-[10px] text-charcoal-500 truncate">${d.kind} · ${formatDate(d.date)}</p></div>
        ${statusBadge(d.status)}
      </div>`).join('')}
    </div>` : '';
  openModal(modalTitle, `
    <p class="text-[11px] text-charcoal-500 mb-2.5">${intro}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${cards}</div>
    ${pendHtml}`);
}

// --- Issue Deduction → HR -----------------------------------------------------
function openIssueDeduction() {
  const emps = MOCK.branchEmployees.filter(e=>e.status!=='Terminated');
  openModal('Issue Deduction &rarr; Send to HR', `<form onsubmit="event.preventDefault();submitDeduction()" class="space-y-3">
    <div class="bg-purple-50 border border-purple-100 rounded-lg p-2.5 text-[10px] text-purple-800 leading-relaxed">
      The deduction is created as a <b>Deduction Candidate</b> with status <b>Pending HR</b>. HR reviews and approves it before it appears in payroll or on the employee's payslip (features.md §10).
    </div>
    <div><label class="form-label">Employee</label><select id="ded-employee" class="form-select" required><option value="">Select employee...</option>${emps.map(e=>`<option>${e.name}</option>`).join('')}</select></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Amount (EGP)</label><input id="ded-amount" type="number" min="1" step="1" class="form-input" placeholder="e.g. 150" required></div>
      <div><label class="form-label">Date</label><input id="ded-date" type="date" class="form-input" value="2026-08-26" required></div>
    </div>
    <div><label class="form-label">Reason</label><select id="ded-reason" class="form-select" required>${['Unapproved absence','Late arrival (30+ min)','Early checkout without approval','Damaged equipment / property','Policy violation','Other (see note)'].map(r=>`<option>${r}</option>`).join('')}</select></div>
    <div><label class="form-label">Note for HR (optional)</label><textarea id="ded-note" class="form-input" rows="2" placeholder="Context that helps HR review it faster..."></textarea></div>
    <div class="flex justify-end gap-2 pt-1">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Send to HR</button>
    </div>
  </form>`);
}
function submitDeduction() {
  const name = document.getElementById('ded-employee').value;
  const amount = parseFloat(document.getElementById('ded-amount').value);
  if(!name){ showToast('Select an employee','error'); return; }
  if(!(amount>0)){ showToast('Enter a valid amount','error'); return; }
  MOCK.deductionCandidates.unshift({
    id:'dc'+Date.now(), employee:name, amount,
    reason:document.getElementById('ded-reason').value,
    date:document.getElementById('ded-date').value,
    note:document.getElementById('ded-note').value.trim(),
    issuedBy: MOCK.currentUser.fullName, status:'Pending HR'
  });
  if (typeof branchQueueExport === 'function') branchQueueExport(); // -> shared HR pending queue
  closeModal(); renderAll();
  showToast(`Deduction of EGP ${amount} for ${name} sent to HR for approval`);
}

// --- Issue Warning Notice → HR ------------------------------------------------
function openIssueWarning() {
  const emps = MOCK.branchEmployees.filter(e=>e.status!=='Terminated');
  openModal('Issue Warning Notice &rarr; Send to HR', `<form onsubmit="event.preventDefault();submitWarning()" class="space-y-3">
    <div class="bg-purple-50 border border-purple-100 rounded-lg p-2.5 text-[10px] text-purple-800 leading-relaxed">
      The notice is saved with status <b>Pending HR</b>. HR reviews it and files it to the employee's record — disciplinary action is HR-owned, the Branch Manager only proposes it.
    </div>
    <div><label class="form-label">Employee</label><select id="warn-employee" class="form-select" required><option value="">Select employee...</option>${emps.map(e=>`<option>${e.name}</option>`).join('')}</select></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Category</label><select id="warn-type" class="form-select" required>${['Attendance','Conduct','Performance','Safety','Policy violation'].map(r=>`<option>${r}</option>`).join('')}</select></div>
      <div><label class="form-label">Date</label><input id="warn-date" type="date" class="form-input" value="2026-08-26" required></div>
    </div>
    <div><label class="form-label">Reason</label><input id="warn-reason" class="form-input" placeholder="e.g. 3rd late arrival within one month" required></div>
    <div><label class="form-label">What was said to the employee</label><textarea id="warn-note" class="form-input" rows="2" placeholder="e.g. Verbal warning issued on site; agreed on 08:00 start"></textarea></div>
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-500">The employee does <b>not</b> see this until HR approves and files it.</div>
    <div class="flex justify-end gap-2 pt-1">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Send to HR</button>
    </div>
  </form>`);
}
function submitWarning() {
  const name = document.getElementById('warn-employee').value;
  const reason = document.getElementById('warn-reason').value.trim();
  if(!name){ showToast('Select an employee','error'); return; }
  if(!reason){ showToast('Enter a reason for the warning','error'); return; }
  MOCK.warningNotices.unshift({
    id:'wn'+Date.now(), employee:name,
    type:document.getElementById('warn-type').value,
    date:document.getElementById('warn-date').value,
    reason,
    note:document.getElementById('warn-note').value.trim(),
    issuedBy: MOCK.currentUser.fullName, status:'Pending HR'
  });
  if (typeof branchQueueExport === 'function') branchQueueExport(); // -> shared HR pending queue
  closeModal(); renderAll();
  showToast(`Warning notice for ${name} sent to HR for review`);
}

// --- Propose Bonus → HR -------------------------------------------------------
function openProposeBonus() {
  const emps = MOCK.branchEmployees.filter(e=>e.status==='Active');
  openModal('Propose Bonus &rarr; Send to HR', `<form onsubmit="event.preventDefault();submitBonus()" class="space-y-3">
    <div class="bg-purple-50 border border-purple-100 rounded-lg p-2.5 text-[10px] text-purple-800 leading-relaxed">
      HR owns payroll edits (<code>payroll.edit</code>) — your proposal lands as <b>Pending HR</b> and is only added to the payroll run once HR approves it (features.md §10).
    </div>
    <div><label class="form-label">Employee</label><select id="bonus-employee" class="form-select" required><option value="">Select employee...</option>${emps.map(e=>`<option>${e.name}</option>`).join('')}</select></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Type</label><select id="bonus-type" class="form-select" required>${['Performance Bonus','Overtime Pay','Attendance Reward','Referral Bonus','Other'].map(r=>`<option>${r}</option>`).join('')}</select></div>
      <div><label class="form-label">Amount (EGP)</label><input id="bonus-amount" type="number" min="1" step="1" class="form-input" placeholder="e.g. 500" required></div>
    </div>
    <div><label class="form-label">Date</label><input id="bonus-date" type="date" class="form-input" value="2026-08-26" required></div>
    <div><label class="form-label">Justification</label><textarea id="bonus-reason" class="form-input" rows="2" placeholder="Why does this employee deserve it?" required></textarea></div>
    <div><label class="form-label">Supporting note (optional)</label><textarea id="bonus-note" class="form-input" rows="2" placeholder="Numbers that back it up — revenue, coverage, KPIs..."></textarea></div>
    <div class="flex justify-end gap-2 pt-1">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Send to HR</button>
    </div>
  </form>`);
}
function submitBonus() {
  const name = document.getElementById('bonus-employee').value;
  const amount = parseFloat(document.getElementById('bonus-amount').value);
  const reason = document.getElementById('bonus-reason').value.trim();
  if(!name){ showToast('Select an employee','error'); return; }
  if(!(amount>0)){ showToast('Enter a valid amount','error'); return; }
  if(!reason){ showToast('Add a justification for HR','error'); return; }
  MOCK.bonusProposals.unshift({
    id:'bp'+Date.now(), employee:name,
    type:document.getElementById('bonus-type').value,
    amount,
    date:document.getElementById('bonus-date').value,
    reason,
    note:document.getElementById('bonus-note').value.trim(),
    issuedBy: MOCK.currentUser.fullName, status:'Pending HR'
  });
  if (typeof branchQueueExport === 'function') branchQueueExport(); // -> shared HR pending queue
  closeModal(); renderAll();
  showToast(`Bonus proposal of EGP ${amount} for ${name} sent to HR`);
}

// --- Send report to HR --------------------------------------------------------
function openSendReportToHR() {
  openModal('Send Report to HR', `<form onsubmit="event.preventDefault();closeModal();showToast('Report sent to HR');" class="space-y-3">
    <div><label class="form-label">Report period</label><select class="form-select"><option>August 2026</option><option>July 2026</option></select></div>
    <div><label class="form-label">Report type</label><select class="form-select"><option>Monthly branch summary</option><option>Attendance exceptions</option><option>Incident report</option><option>Request escalations</option></select></div>
    <div><label class="form-label">Message</label><textarea class="form-input" rows="4" placeholder="Anything HR should know..."></textarea></div>
    <div class="flex justify-end gap-2 pt-1">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Send to HR</button>
    </div>
  </form>`);
}
