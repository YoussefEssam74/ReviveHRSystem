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
function renderTeamRequests() {
  const pending = MOCK.teamRequests.filter(r=>r.status==='Pending');
  const approved = MOCK.teamRequests.filter(r=>r.status==='Approved');
  const rejected = MOCK.teamRequests.filter(r=>r.status==='Rejected');
  const canApprove = hasPermission('requests.approve.team');

  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Team Requests</h1><p class="text-xs text-charcoal-500 mt-0.5">${pending.length} pending ${canApprove?'approval':'review'}</p></div>
    </div>

    <!-- Pending Approval -->
    ${pending.length>0?`<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-yellow-50/50">
        <p class="bento-label flex items-center gap-1.5 text-yellow-700"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>PENDING ${canApprove?'APPROVAL':'REVIEW'} (${pending.length})</p>
      </div>
      <div class="divide-y divide-charcoal-50">${pending.map(r=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${r.employee.split(' ').map(w=>w[0]).join('')}</div>
            <div>
              <p class="text-xs font-semibold text-charcoal-900">${r.employee}</p>
              <p class="text-[10px] text-charcoal-500">${r.type} · ${r.date} · Submitted ${r.submitted}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            ${canApprove?`<button onclick="event.stopPropagation();approveRequest('${r.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Approve</button>
            <button onclick="event.stopPropagation();rejectRequest('${r.id}')" class="btn btn-sm btn-danger-outline"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>Reject</button>`:`<button onclick="event.stopPropagation();viewRequest('${r.id}')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>View</button>`}
          </div>
        </div>
      </div>`).join('')}</div>
    </div>`:''}

    <!-- Recent Activity -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50">
        <p class="bento-label">RECENT ACTIVITY</p>
      </div>
      <div class="divide-y divide-charcoal-50">${MOCK.teamRequests.map(r=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${r.employee.split(' ').map(w=>w[0]).join('')}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${r.employee}</p><p class="text-[10px] text-charcoal-500">${r.type} · ${r.date}</p></div>
        </div>
        <div class="flex items-center gap-2">${statusBadge(r.status)}</div>
      </div>`).join('')}</div>
    </div>
  </div>`;
}

// ==================== TEAM ATTENDANCE (merged into My Team) ====================
// Kept as an alias so old links to team-attendance still work.
function renderTeamAttendance() { return renderTeam(); }

// ==================== TEAM MEMBER DETAIL & ACTIONS ====================
// Clicking a team member opens a detail view with context-aware actions based
// on their attendance status: Absent → Mark Present / Remind / Follow Up,
// Late → Remind / Follow Up / History, Present → Evaluate / History / Message.
function openTeamMember(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  const shift = getTeamMemberTodayShift(m);
  const checkOut = (m.status==='Present'||m.status==='Late') ? '16:02' : '—';
  const isAbsent = m.status==='Absent';
  const isLate = m.status==='Late';
  let actions = '';
  if (isAbsent) {
    actions = `<button onclick="markPresent('${m.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Mark Present</button>
      <button onclick="sendReminder('${m.id}')" class="btn btn-sm btn-secondary">Send Reminder</button>
      <button onclick="addTeamFollowUp('${m.id}')" class="btn btn-sm btn-secondary">Follow Up</button>`;
  } else if (isLate) {
    actions = `<button onclick="sendReminder('${m.id}')" class="btn btn-sm btn-secondary">Send Reminder</button>
      <button onclick="addTeamFollowUp('${m.id}')" class="btn btn-sm btn-secondary">Follow Up</button>
      <button onclick="openMemberAttendance('${m.id}')" class="btn btn-sm btn-secondary">History</button>`;
  } else {
    actions = `<button onclick="openEvaluateMember('${m.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>Evaluate</button>
      <button onclick="openMemberAttendance('${m.id}')" class="btn btn-sm btn-secondary">History</button>
      <button onclick="sendMessage('${m.id}')" class="btn btn-sm btn-secondary">Message</button>`;
  }
  openModal(m.name, `<div class="space-y-3">
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">${m.initials}</div>
      <div class="flex-1"><p class="text-sm font-bold text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.position} · ${m.id.toUpperCase()}</p></div>
      ${statusBadge(m.status)}
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">SCHEDULED TODAY</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${shiftLabel(shift)}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">CHECK IN</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${m.checkIn||'—'}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">CHECK OUT</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${checkOut}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">SOURCE</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">Biometric Device</p></div>
    </div>
    <div>
      <p class="bento-label text-charcoal-500 mb-1.5">ACTIONS</p>
      <div class="flex flex-wrap gap-1.5">${actions}</div>
    </div>
    <div>
      <p class="bento-label text-charcoal-500 mb-1.5">QUICK LINKS</p>
      <div class="flex flex-wrap gap-1.5">
        <button onclick="openEvaluateMember('${m.id}')" class="btn btn-sm btn-secondary">Evaluate</button>
        <button onclick="openMemberAttendance('${m.id}')" class="btn btn-sm btn-secondary">Attendance History</button>
        <button onclick="openMemberRequests('${m.id}')" class="btn btn-sm btn-secondary">Requests</button>
        <button onclick="openMemberSchedule('${m.id}')" class="btn btn-sm btn-secondary">Schedule</button>
      </div>
    </div>
  </div>`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
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
    <div><label class="form-label">Action</label><select id="fu-action" class="form-select"><option>Send reminder</option><option>Schedule a meeting</option><option>Escalate to manager</option><option>Mark as resolved</option></select></div>
    <div><label class="form-label">Note</label><textarea id="fu-note" class="form-input" rows="2" placeholder="Add a note..."></textarea></div>
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
  closeModal(); renderAll(); showToast(`${action} for ${m.name}`);
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
function openMemberAttendance(id) {
  const m = MOCK.teamMembers.find(x=>x.id===id); if(!m) return;
  const rows = [
    { date:'Aug 26', shift: shiftLabel(getTeamMemberTodayShift(m)), checkIn: m.checkIn||'—', checkOut: (m.status==='Present'||m.status==='Late')?'16:02':'—', status: m.status },
    { date:'Aug 25', shift:'Evening · 16:00–00:00', checkIn:'16:05', checkOut:'00:01', status:'Late' },
    { date:'Aug 24', shift:'Off', checkIn:'—', checkOut:'—', status:'Off' },
    { date:'Aug 23', shift:'Morning · 08:00–16:00', checkIn:'07:58', checkOut:'16:03', status:'On Time' },
    { date:'Aug 22', shift:'Morning · 08:00–16:00', checkIn:'08:00', checkOut:'15:30', status:'Early Checkout' },
  ];
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
function schMonthWindow(nBack) {
  // nBack = how many PAST months to offer beyond the current one.
  const cur = schCurMonth(), yr = schAnchorYear();
  const arr = [];
  for (let k = nBack; k >= 0; k--) {
    const mm = cur - k;
    arr.push({ ym: `${yr}-${String(mm).padStart(2,'0')}`, year: yr, month: mm });
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
  return Object.keys(buckets).sort().map(key => {
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
  return schLockState(tsSelMonth()) === 'current';
}

// --- Render ------------------------------------------------------------------
function renderTeamSchedule() {
  const win = schMonthWindow(3);                 // current + 3 past months
  const selMo = tsSelMonth();
  const [,selMm] = selMo.split('-');
  const periods = schPeriodsFor(+schAnchorYear(), +selMm);
  const selPer = tsSelPeriod();
  const period = periods.find(p => p.id === selPer) || periods[periods.length-1];
  const lock = schLockState(selMo);
  const canEdit = lock === 'current';
  const isEditMode = !!state.tsEditing && canEdit;
  const teamRows = MOCK.teamMembers.slice(0, 8);

  // header meta
  const histDesc = lock === 'current'
    ? 'Live month — pick a period below to view or assign shifts.'
    : lock === 'past'
      ? 'Historical month — viewing archived schedules (read-only).'
      : 'Future month — drafts are locked until publication.';

  return `<div class="space-y-3">
    <!-- Heading -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-charcoal-900">Team Schedule</h1>
        <p class="text-xs text-charcoal-500 mt-0.5">${histDesc}</p>
      </div>
      <div class="flex gap-1.5">
        ${canEdit ? `
        <button onclick="state.tsEditing=${isEditMode?'false':'true'};renderAll()" class="btn btn-sm ${isEditMode?'btn-primary':'btn-secondary'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          ${isEditMode?'Finish Editing':'Assign Shifts'}
        </button>
        <button onclick="confirmTsPublish(${(period?`'${period.id}'`: '""')})" class="btn btn-sm btn-primary" ${isEditMode?'':'disabled'}>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 1212l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Publish
        </button>` : ``}
        <button onclick="navigateTo('shift-management')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Advanced Editor</button>
      </div>
    </div>

    <!-- Step 1 :: CHOOSE THE MONTH -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <p class="bento-label text-charcoal-500 mb-2">STEP 1 — CHOOSE MONTH</p>
      <div class="flex items-center gap-2 flex-wrap">
        ${win.map(m => {
          const ym = m.ym;
          const st = schLockState(ym);
          const active = ym === selMo;
          const chipCol = active ? 'bg-brand-600 text-white border-brand-600'
                        : st === 'current' ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-white text-charcoal-700 border-charcoal-200 hover:bg-charcoal-50';
          const tag = st === 'current' ? '<span class="ml-1 text-[9px] uppercase tracking-wide opacity-80">● Live</span>'
                     : st === 'past' ? ''
                     : '<span class="ml-1 text-[9px] uppercase tracking-wide opacity-60">planned</span>';
          return `<button onclick="selectTsMonth('${ym}')" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${chipCol}">
            ${schMonthLabel(m.year, m.month)}${tag}
          </button>`;
        }).join('')}
      </div>
    </div>

    <!-- Step 2 :: CHOOSE THE PERIOD (history of schedules in this month) -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between mb-2">
        <p class="bento-label text-charcoal-500">STEP 2 — SCHEDULE PERIODS OF THIS MONTH</p>
        ${lock === 'current' ? `<span class="text-[10px] text-brand-600 font-semibold">Tap a period to view • tap “Assign” to edit it</span>` : `<span class="text-[10px] text-charcoal-400 font-semibold">Archive — read only</span>`}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        ${periods.map(p => {
          const active = p.id === selPer;
          const pub = schPubFlag(p.id);
          return `<button onclick="selectTsPeriod('${p.id}')" class="text-left rounded-xl border p-3 transition-colors ${active?'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500':'border-charcoal-200 hover:border-charcoal-300 hover:bg-charcoal-50/50'}">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-charcoal-900">${p.label}</p>
              ${pub ? `<span class="badge badge-blue">Published</span>` : lock==='current' ? `<span class="badge badge-yellow">Draft</span>` : `<span class="badge badge-gray">Closed</span>`}
            </div>
            <p class="text-[10px] text-charcoal-500 mt-1">${p.days.length} days · ${teamRows.length} employees</p>
            ${active && canEdit ? `<p class="text-[10px] text-brand-600 font-semibold mt-1.5">${isEditMode?'✎ Editing…':'· Tap “Assign Shifts” to edit'}</p>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>

    ${period ? `
    <!-- Step 3 :: VIEW / ASSIGN THE CHOSEN PERIOD'S ROSTER -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p class="bento-label text-charcoal-500">PERIOD ROSTER — ${period.label}</p>
          <p class="text-[10px] text-charcoal-400 mt-0.5">${canEdit?(isEditMode?'Editing enabled — click a shift cell to rotate it.':'Preview mode — read only.'):'Archived — read only.'}</p>
        </div>
        ${canEdit ? `<button onclick="resetTsPeriod('${period.id}')" class="btn btn-sm btn-secondary" ${isEditMode?'':'style=\"visibility:hidden\"'}>Reset period</button>` : ''}
      </div>

      <!-- legend -->
      <div class="flex items-center gap-4 text-[10px] text-charcoal-500 px-4 pb-2 flex-wrap">
        ${MOCK.shiftTemplates.filter(t => !t.isOff).map(t => `
          <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded inline-block border" style="background:${t.bgColor};border-color:${t.color}40"></span>${t.name} (${t.start}–${t.end})</span>
        `).join('')}
        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded inline-block border border-charcoal-200 bg-charcoal-100"></span>Off</span>
      </div>

      <!-- desktop table -->
      <div class="table-responsive hidden lg:block">
        <table class="data-table">
          <thead><tr><th class="sticky left-0 bg-charcoal-50 z-10">Employee</th>${period.days.map(d=>`<th class="text-center">${d.num}<br/><span class="text-[9px] font-normal text-charcoal-400">${d.dow}</span></th>`).join('')}</tr></thead>
          <tbody>${teamRows.map(m => {
            const roster = schRoster(m.id, period.id, period.days.length);
            return `<tr><td class="sticky left-0 bg-white z-10"><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.position}</p></div></div></td>${
              roster.map((sid,i)=>{
                const t=getShiftTemplate(sid); const c=getShiftColor(t);
                if(isEditMode){
                  return `<td class="text-center"><button onclick="rotateTsShift(this,'${m.id}','${period.id}',${i})" class="schedule-shift-badge cursor-pointer hover:opacity-80 text-[10px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40" data-sid="${sid}">${t.isOff?'OFF':t.start+'–'+t.end}</button></td>`;
                }
                return `<td class="text-center"><span class="schedule-shift-badge text-[10px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40">${t.isOff?'OFF':t.start}</span></td>`;
              }).join('')
            }</tr>`;
          }).join('')}</tbody>
        </table>
      </div>

      <!-- mobile cards -->
      <div class="space-y-1.5 p-3 lg:hidden">${teamRows.map(m => {
        const roster = schRoster(m.id, period.id, period.days.length);
        return `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
          <div class="flex items-center gap-2 mb-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><span class="text-xs font-medium text-charcoal-900">${m.name}</span></div>
          <div class="flex gap-1 flex-wrap">${roster.map((sid,i)=>{
            const t=getShiftTemplate(sid); const c=getShiftColor(t);
            return `<span class="schedule-shift-badge text-[9px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40">${period.days[i].num}/${period.days[i].dow}: ${t.isOff?'OFF':t.start+'–'+t.end}</span>`;
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

// --- Interactions -------------------------------------------------------------
function selectTsMonth(ym){ state.tsMonth = ym; delete state.tsPeriod; state.tsEditing = false; renderAll(); }
function selectTsPeriod(pid){ state.tsPeriod = pid; state.tsEditing = false; renderAll(); }
function confirmTsPublish(pid){
  if(!pid) return;
  schPubFlags()[pid] = true;
  state.tsEditing = false;
  renderAll();
  showToast(`Schedule for ${pid} published 🎉`);
}
function resetTsPeriod(pid){
  const membs = MOCK.teamMembers.slice(0,8);
  membs.forEach(m => { delete schOverrideStore()[`${m.id}|${pid}`]; });
  renderAll();
  showToast(`Period ${pid} reset to automatic draft`,'info');
}
function rotateTsShift(btn, empId, periodId, dayIdx){
  const templates = MOCK.shiftTemplates;
  const ids = templates.map(t => t.id);
  const cur = btn.getAttribute('data-sid');
  const ni = (ids.indexOf(cur)+1)%ids.length;
  const nsid = ids[ni];
  // Resolve the clicked period's day-count so the rotated roster aligns.
  const [,moStr] = tsSelMonth().split('-');
  const pers = schPeriodsFor(+schAnchorYear(), +moStr);
  const pp = pers.find(p=>p.id===periodId);
  const len = pp ? pp.days.length : 7;
  const fresh = schRoster(empId, periodId, len);
  fresh[dayIdx] = nsid;
  schPersist(empId, periodId, fresh);
  const t = getShiftTemplate(nsid); const c = getShiftColor(t);
  btn.setAttribute('data-sid', nsid);
  btn.style.background=c.bg; btn.style.color=c.text; btn.style.borderColor=c.border+'40';
  btn.textContent = t.isOff?'OFF':t.start+'–'+t.end;
  showToast(`${nsid.startsWith('st-off')?'Off day':t.name+' ('+(t.start??'')+'–'+(t.end??'')+')'} assigned to ${empId}`);
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

  // Calculate stats
  let totalHours = 0, morningCount = 0, eveningCount = 0, offCount = 0;
  const shiftCounts = {};
  templates.forEach(t => shiftCounts[t.id] = 0);

  teamData.forEach(m => {
    m.scheduleIds.forEach(sid => {
      const t = getShiftTemplate(sid);
      const h = getShiftHours(t);
      totalHours += h;
      if (t.isOff) offCount++;
      else shiftCounts[t.id] = (shiftCounts[t.id] || 0) + 1;
    });
  });

  const maxHours = teamData.length * days.length * 8;
  const utilization = maxHours > 0 ? Math.round((totalHours / maxHours) * 100) : 0;
  morningCount = shiftCounts['st-morning'] || 0;
  eveningCount = shiftCounts['st-evening'] || 0;

  // Filter team by role
  const filteredTeam = _saFilterRole === 'all' ? teamData : teamData.filter(m => m.position === _saFilterRole);
  const roles = [...new Set(teamData.map(m => m.position))];

  // Selected template indicator
  const selTpl = _saSelectedTemplate ? getShiftTemplate(_saSelectedTemplate) : null;

  return `<div class="space-y-3">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-charcoal-900">Shift Management</h1>
        <p class="text-xs text-charcoal-500 mt-0.5">Cycle: Aug 25 – Aug 31, 2026 &middot; ${filteredTeam.length} employees</p>
      </div>
      <div class="flex gap-1.5">
        <button onclick="showToast('Schedule published!')" class="btn btn-sm btn-primary">
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

// ==================== TEAM UPDATES ====================
function renderTeamUpdates() {
  const sevColor = {high:'badge-red',medium:'badge-yellow',low:'badge-blue'};
  const sevBorder = {high:'border-l-red-400',medium:'border-l-yellow-400',low:'border-l-blue-400'};
  const sevBg = {high:'bg-red-50/50',medium:'bg-yellow-50/50',low:'bg-blue-50/50'};
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Team Updates</h1><p class="text-xs text-charcoal-500 mt-0.5">${MOCK.followUpItems.length} items requiring attention</p></div>
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
function renderRecruitment() {
  const reqs = MOCK.recruitmentRequests;
  const submitted = reqs.filter(r=>r.status==='Submitted').length;
  const pending = reqs.filter(r=>r.status==='Pending').length;
  const approved = reqs.filter(r=>r.status==='Approved').length;
  const openPositions = reqs.reduce((s,r)=>s+r.count,0);
  const urgencyBadge = { High:'badge-red', Medium:'badge-yellow', Low:'badge-blue' };
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Recruitment</h1><p class="text-xs text-charcoal-500 mt-0.5">${openPositions} open positions · ${reqs.length} requests</p></div>
      <button onclick="openNewRecruitment()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Request</button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg></div><p class="text-lg font-bold text-brand-600">${openPositions}</p><p class="text-[10px] text-charcoal-500">Open Positions</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><p class="text-lg font-bold text-purple-600">${submitted}</p><p class="text-[10px] text-charcoal-500">Submitted</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-yellow-600">${pending}</p><p class="text-[10px] text-charcoal-500">Pending</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-green-600">${approved}</p><p class="text-[10px] text-charcoal-500">Approved</p></div>
    </div>

    <!-- Pipeline -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <p class="bento-label text-charcoal-500 mb-2">PIPELINE</p>
      <div class="flex items-center gap-1.5">
        <div class="flex-1 text-center rounded-lg bg-purple-50 py-2.5"><p class="text-lg font-bold text-purple-700">${submitted}</p><p class="text-[10px] text-charcoal-500">Submitted</p></div>
        <svg class="w-4 h-4 text-charcoal-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        <div class="flex-1 text-center rounded-lg bg-yellow-50 py-2.5"><p class="text-lg font-bold text-yellow-700">${pending}</p><p class="text-[10px] text-charcoal-500">Pending</p></div>
        <svg class="w-4 h-4 text-charcoal-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        <div class="flex-1 text-center rounded-lg bg-green-50 py-2.5"><p class="text-lg font-bold text-green-700">${approved}</p><p class="text-[10px] text-charcoal-500">Approved</p></div>
      </div>
    </div>

    <!-- Request Cards -->
    <div class="space-y-1.5">${reqs.map(r=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openRecruitmentDetail('${r.id}')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 text-charcoal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg></div>
          <div>
            <p class="text-xs font-semibold text-charcoal-900">${r.position} <span class="text-charcoal-500 font-normal">x${r.count}</span></p>
            <p class="text-[10px] text-charcoal-500">${r.department} · ${r.requestedBy} · ${r.date}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="badge ${urgencyBadge[r.urgency]} text-[9px]">${r.urgency}</span>
          ${statusBadge(r.status)}
        </div>
      </div>
      <p class="text-[10px] text-charcoal-600 mt-2">${r.reason}</p>
    </div>`).join('')}</div>
  </div>`;
}
function openRecruitmentDetail(id) {
  const r = MOCK.recruitmentRequests.find(x=>x.id===id);
  if(!r) return;
  const urgencyBadge = { High:'badge-red', Medium:'badge-yellow', Low:'badge-blue' };
  openModal(`${r.position}`, `<div class="space-y-3">
    <div class="flex items-center gap-2">
      <span class="badge ${urgencyBadge[r.urgency]} text-[9px]">${r.urgency} urgency</span>
      ${statusBadge(r.status)}
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Positions</p><p class="text-xs font-semibold text-charcoal-900">${r.count}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Department</p><p class="text-xs font-semibold text-charcoal-900">${r.department}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Requested By</p><p class="text-xs font-semibold text-charcoal-900">${r.requestedBy}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Requested On</p><p class="text-xs font-semibold text-charcoal-900">${r.date}</p></div>
    </div>
    <div><p class="form-label">Reason</p><p class="text-xs text-charcoal-600">${r.reason}</p></div>
    <div><p class="form-label">Timeline</p><p class="text-xs text-charcoal-600">${r.timeline}</p></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button></div>
  </div>`);
}
function openNewRecruitment() {
  openModal('New Recruitment Request',`<form onsubmit="event.preventDefault();saveNewRecruitment()" class="space-y-3">
    <div><label class="form-label">Position</label><input id="rec-position" type="text" class="form-input" placeholder="e.g. Senior Trainer" required></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Count</label><input id="rec-count" type="number" class="form-input" min="1" value="1" required></div>
      <div><label class="form-label">Urgency</label><select id="rec-urgency" class="form-select"><option>Low</option><option>Medium</option><option>High</option></select></div>
    </div>
    <div><label class="form-label">Department</label><select id="rec-dept" class="form-select"><option>Training</option><option>Front Desk</option><option>Facilities</option><option>Maintenance</option></select></div>
    <div><label class="form-label">Reason</label><textarea id="rec-reason" class="form-input" rows="2" placeholder="Why is this position needed?" required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Submit Request</button></div>
  </form>`);
}
function saveNewRecruitment() {
  const position = document.getElementById('rec-position').value.trim();
  if(!position) return;
  const count = parseInt(document.getElementById('rec-count').value)||1;
  const urgency = document.getElementById('rec-urgency').value;
  const department = document.getElementById('rec-dept').value;
  const reason = document.getElementById('rec-reason').value.trim();
  MOCK.recruitmentRequests.unshift({ id:'rr'+Date.now().toString(36), position, count, urgency, status:'Submitted', date:'Sep 6, 2026', requestedBy: MOCK.currentUser.fullName, department, reason, timeline:'Submitted today · In review', candidates:0 });
  closeModal(); renderAll(); showToast(`${position} request submitted`);
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
        <button onclick="navigateTo('shift-management')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Assign Shifts</button>
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
// Shift comes from the Shift Management assignments (MOCK.teamSchedule + shiftTemplates)
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
function renderEmployees() {
  const emps = MOCK.branchEmployees.map(e => ({ e, ...getEmployeeShiftStatus(e) }));
  const onShift = emps.filter(x=>x.status==='On Shift').length;
  const upcoming = emps.filter(x=>x.status==='Upcoming').length;
  const off = emps.filter(x=>['Off','On Leave','Suspended','Terminated'].includes(x.status)).length;
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Employees</h1><p class="text-xs text-charcoal-500 mt-0.5">${emps.length} employees · Revive Gym — Nasr City · Now ${MOCK.now}</p></div>
      <div class="flex gap-1.5">
        <button onclick="openNewEmployee()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Employee</button>
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
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Position</th><th>Shift (Today)</th><th>Status</th><th></th></tr></thead>
      <tbody>${emps.map(x=>`<tr class="cursor-pointer hover:bg-charcoal-50/50" onclick="showToast('Opening ${x.e.name}...','info')"><td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${x.e.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${x.e.name}</p><p class="text-[10px] text-charcoal-500">${x.e.id}</p></div></div></td><td class="text-xs">${x.e.position}</td><td class="text-xs">${shiftLabel(x.shift)}</td><td><span class="badge ${x.badge}">${x.status}</span></td><td><div class="flex items-center gap-1"><button onclick="event.stopPropagation();openEditEmployee('${x.e.id}')" class="btn btn-sm btn-secondary" title="Edit employee"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button><button onclick="event.stopPropagation();openChangeStatus('${x.e.id}')" class="btn btn-sm btn-secondary" title="Change employment status"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg></button></div></td></tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${emps.map(x=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="showToast('Opening ${x.e.name}...','info')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${x.e.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${x.e.name}</p><p class="text-[10px] text-charcoal-500">${x.e.position} · ${shiftLabel(x.shift)}</p></div>
        </div>
        <span class="badge ${x.badge}">${x.status}</span>
      </div>
    </div>`).join('')}</div>
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
      <div class="divide-y divide-charcoal-50">${late.map(m=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${m.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.position} · Checked in ${m.checkIn}</p></div>
        </div>
        <button onclick="showToast('Follow up with ${m.name}','info')" class="btn btn-sm btn-secondary">Follow Up</button>
      </div>`).join('')}</div>
    </div>

    <!-- Absent -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-red-50/50">
        <p class="bento-label flex items-center gap-1.5 text-red-700"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>ABSENT (${absent.length})</p>
      </div>
      <div class="divide-y divide-charcoal-50">${absent.map(m=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${m.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.position} · No check-in</p></div>
        </div>
        <button onclick="showToast('Mark ${m.name} absent','info')" class="btn btn-sm btn-danger-outline">Mark Absent</button>
      </div>`).join('')}</div>
    </div>
  </div>`;
}

// ==================== REQUESTS MANAGEMENT (Branch) ====================
function renderRequestsManagement() {
  const pending = MOCK.teamRequests.filter(r=>r.status==='Pending');
  const all = MOCK.teamRequests;
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Requests Management</h1><p class="text-xs text-charcoal-500 mt-0.5">${pending.length} pending · ${all.length} total this month</p></div>
      <div class="flex gap-1.5">
        <button onclick="showToast('Filtering by status','info')" class="btn btn-sm btn-secondary">Status</button>
        <button onclick="showToast('Filtering by type','info')" class="btn btn-sm btn-secondary">Type</button>
      </div>
    </div>

    <!-- Pending Queue -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-yellow-50/50">
        <p class="bento-label flex items-center gap-1.5 text-yellow-700"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>PENDING APPROVAL (${pending.length})</p>
      </div>
      <div class="divide-y divide-charcoal-50">${pending.map(r=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${r.employee.split(' ').map(w=>w[0]).join('')}</div>
            <div><p class="text-xs font-semibold text-charcoal-900">${r.employee}</p><p class="text-[10px] text-charcoal-500">${r.type} · ${r.date} · Submitted ${r.submitted}</p></div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="event.stopPropagation();approveRequest('${r.id}')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Approve</button>
            <button onclick="event.stopPropagation();rejectRequest('${r.id}')" class="btn btn-sm btn-danger-outline"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>Reject</button>
            <button onclick="event.stopPropagation();openRequestComment('${r.id}')" class="btn btn-sm btn-secondary" title="Add comment"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg></button>
          </div>
        </div>
      </div>`).join('')}</div>
    </div>

    <!-- All Requests -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50">
        <p class="bento-label">ALL REQUESTS</p>
      </div>
      <div class="divide-y divide-charcoal-50">${all.map(r=>`<div class="p-3 hover:bg-charcoal-50/50 transition-colors flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${r.employee.split(' ').map(w=>w[0]).join('')}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${r.employee}</p><p class="text-[10px] text-charcoal-500">${r.type} · ${r.date}</p></div>
        </div>
        <div class="flex items-center gap-2">${statusBadge(r.status)}</div>
      </div>`).join('')}</div>
    </div>
  </div>`;
}

// ==================== REQUEST ACTIONS ====================
function approveRequest(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  r.status = 'Approved';
  renderAll(); showToast(`${r.employee}'s ${r.type} request approved`);
}
function rejectRequest(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  r.status = 'Rejected';
  renderAll(); showToast(`${r.employee}'s ${r.type} request rejected`, 'error');
}
function viewRequest(id) {
  const r = MOCK.teamRequests.find(x=>x.id===id);
  if(!r) return;
  openModal(`${r.type} Request`, `<div class="space-y-3">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">${r.employee.split(' ').map(w=>w[0]).join('')}</div>
      <div><p class="text-sm font-semibold text-charcoal-900">${r.employee}</p><p class="text-[10px] text-charcoal-500">${r.type} · ${r.date}</p></div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Submitted</p><p class="text-xs font-semibold text-charcoal-900">${r.submitted}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5"><p class="text-[10px] text-charcoal-500">Status</p><div>${statusBadge(r.status)}</div></div>
    </div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button></div>
  </div>`);
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
function openNewEmployee() {
  openModal('New Employee', `<form onsubmit="event.preventDefault();saveNewEmployee()" class="space-y-3">
    <div><label class="form-label">Full Name</label><input id="emp-new-name" type="text" class="form-input" placeholder="e.g. Mohamed Ali" required></div>
    <div><label class="form-label">Position</label><select id="emp-new-position" class="form-select"><option>Trainer</option><option>Receptionist</option><option>Cleaner</option><option>Maintenance</option></select></div>
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-500">Their shift will be assigned from <b>Shift Management</b>.</div>
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
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-[10px] text-charcoal-500">Shift is assigned from <b>Shift Management</b> — edit it there.</div>
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
