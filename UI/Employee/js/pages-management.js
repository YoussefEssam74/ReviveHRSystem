// ==================== MY TEAM ====================
function renderTeam() {
  const s=MOCK.teamStats;
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">My Team</h1><p class="text-xs text-charcoal-500 mt-0.5">${s.total} members · ${s.present} present today</p></div>
      <div class="relative">
        <svg class="w-4 h-4 text-charcoal-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" class="form-input" placeholder="Search team..." style="padding:0.375rem 0.625rem 0.375rem 2rem;font-size:0.8125rem;width:200px">
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

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Position</th><th>Check In</th><th>Status</th><th></th></tr></thead>
      <tbody>${MOCK.teamMembers.map(m=>`<tr class="cursor-pointer hover:bg-charcoal-50/50" onclick="showToast('Opening ${m.name}...','info')"><td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.id}</p></div></div></td><td class="text-xs">${m.position}</td><td class="text-xs">${m.checkIn||'—'}</td><td>${statusBadge(m.status)}</td><td><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td></tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${MOCK.teamMembers.map(m=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="showToast('Opening ${m.name}...','info')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div>
          <div>
            <p class="text-xs font-medium text-charcoal-900">${m.name}</p>
            <p class="text-[10px] text-charcoal-500">${m.position}</p>
          </div>
        </div>
        ${statusBadge(m.status)}
      </div>
      <div class="flex gap-4 mt-2 text-[10px] text-charcoal-500">
        <span class="flex items-center gap-1"><svg class="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>In: ${m.checkIn||'—'}</span>
      </div>
    </div>`).join('')}</div>
  </div>`;
}

// ==================== TEAM REQUESTS ====================
function renderTeamRequests() {
  const pending = MOCK.teamRequests.filter(r=>r.status==='Pending');
  const approved = MOCK.teamRequests.filter(r=>r.status==='Approved');
  const rejected = MOCK.teamRequests.filter(r=>r.status==='Rejected');

  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Team Requests</h1><p class="text-xs text-charcoal-500 mt-0.5">${pending.length} pending approval</p></div>
    </div>

    <!-- Pending Approval -->
    ${pending.length>0?`<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 bg-yellow-50/50">
        <p class="bento-label flex items-center gap-1.5 text-yellow-700"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>PENDING APPROVAL (${pending.length})</p>
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
            <button onclick="event.stopPropagation();showToast('${r.employee} approved')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Approve</button>
            <button onclick="event.stopPropagation();showToast('${r.employee} rejected','error')" class="btn btn-sm btn-danger-outline"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>Reject</button>
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

// ==================== TEAM ATTENDANCE ====================
function renderTeamAttendance() {
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Team Attendance</h1><p class="text-xs text-charcoal-500 mt-0.5">August 2026 · Today's overview</p></div>
      <select class="form-select w-32" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>August 2026</option></select>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-brand-600">${MOCK.teamStats.present}</p><p class="text-[10px] text-charcoal-500">Present</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-yellow-600">${MOCK.teamStats.late}</p><p class="text-[10px] text-charcoal-500">Late</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></div><p class="text-lg font-bold text-red-600">${MOCK.teamStats.absent}</p><p class="text-[10px] text-charcoal-500">Absent</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-blue-600">1</p><p class="text-[10px] text-charcoal-500">Missing</p></div>
    </div>

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Scheduled</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead>
      <tbody>${MOCK.teamMembers.map(m=>`<tr><td><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><span class="text-xs font-medium text-charcoal-900">${m.name}</span></div></td><td class="text-xs">08:00–16:00</td><td class="text-xs">${m.checkIn||'—'}</td><td class="text-xs">${m.status==='Present'||m.status==='Late'?'16:02':'—'}</td><td>${statusBadge(m.status)}</td></tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${MOCK.teamMembers.map(m=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div>
          <div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">08:00–16:00</p></div>
        </div>
        ${statusBadge(m.status)}
      </div>
      <div class="flex gap-4 mt-2 text-[10px] text-charcoal-500">
        <span class="flex items-center gap-1"><svg class="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>In: ${m.checkIn||'—'}</span>
        <span class="flex items-center gap-1"><svg class="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Out: ${m.status==='Present'||m.status==='Late'?'16:02':'—'}</span>
      </div>
    </div>`).join('')}</div>
  </div>`;
}

// ==================== TEAM SCHEDULE ====================
function renderTeamSchedule() {
  const days = ['Mon 25','Tue 26','Wed 27','Thu 28','Fri 29','Sat 30','Sun 31'];
  const teamData = MOCK.teamMembers.slice(0,8).map(m => {
    const schedIds = MOCK.teamSchedule[m.id] || days.map(() => 'st-off');
    return { ...m, scheduleIds: schedIds };
  });
  const isEdit = state.teamScheduleEdit || false;

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Team Schedule</h1><p class="text-xs text-charcoal-500 mt-0.5">Cycle: Aug 24 – Sep 2 · ${teamData.length} employees</p></div>
      <div class="flex gap-1.5">
        <button onclick="state.teamScheduleEdit=!state.teamScheduleEdit;renderAll()" class="btn btn-sm ${isEdit?'btn-primary':'btn-secondary'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          ${isEdit?'Done':'Edit Schedule'}
        </button>
        <button onclick="navigateTo('shift-assignment')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Assign Shifts</button>
      </div>
    </div>

    <!-- Legend (dynamic from templates) -->
    <div class="flex items-center gap-4 text-[10px] text-charcoal-500 px-1 flex-wrap">
      ${MOCK.shiftTemplates.filter(t => !t.isOff).map(t => `
        <span class="inline-flex items-center gap-1">
          <span class="w-3 h-3 rounded inline-block border" style="background:${t.bgColor};border-color:${t.color}40"></span>
          ${t.name} (${t.start}–${t.end})
        </span>
      `).join('')}
      <span class="inline-flex items-center gap-1">
        <span class="w-3 h-3 rounded inline-block border border-charcoal-200 bg-charcoal-100"></span>Off
      </span>
    </div>

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th class="sticky left-0 bg-charcoal-50 z-10">Employee</th>${days.map(d=>`<th class="text-center">${d}</th>`).join('')}</tr></thead>
      <tbody>${teamData.map(m => `<tr><td class="sticky left-0 bg-white z-10"><div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><div><p class="text-xs font-medium text-charcoal-900">${m.name}</p><p class="text-[10px] text-charcoal-500">${m.position}</p></div></div></td>${m.scheduleIds.map((sid,i) => {
        const t = getShiftTemplate(sid);
        const c = getShiftColor(t);
        if (isEdit) {
          return `<td class="text-center"><button onclick="cycleTeamScheduleShift(this,'${m.id}',${i})" class="schedule-shift-badge cursor-pointer hover:opacity-80 text-[10px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40" data-template="${sid}">${t.isOff ? 'OFF' : t.start + '–' + t.end}</button></td>`;
        }
        return `<td class="text-center"><span class="schedule-shift-badge text-[10px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40">${t.isOff ? 'OFF' : t.start}</span></td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${teamData.map(m => `<div class="bg-white rounded-xl border border-charcoal-200 p-3"><div class="flex items-center gap-2 mb-2"><div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${m.initials}</div><span class="text-xs font-medium text-charcoal-900">${m.name}</span></div><div class="flex gap-1 flex-wrap">${m.scheduleIds.map((sid,i) => {
      const t = getShiftTemplate(sid);
      const c = getShiftColor(t);
      return `<span class="schedule-shift-badge text-[9px] border" style="background:${c.bg};color:${c.text};border-color:${c.border}40">${days[i].split(' ')[0]}: ${t.isOff ? 'OFF' : t.start + '–' + t.end}</span>`;
    }).join('')}</div></div>`).join('')}</div>
  </div>`;
}
function cycleTeamScheduleShift(btn, empId, dayIdx) {
  const templates = MOCK.shiftTemplates;
  const ids = templates.map(t => t.id);
  const currentSid = btn.getAttribute('data-template');
  const ci = ids.indexOf(currentSid);
  const newSid = ids[(ci + 1) % ids.length];
  if (!MOCK.teamSchedule[empId]) MOCK.teamSchedule[empId] = ids.map(() => 'st-off');
  MOCK.teamSchedule[empId][dayIdx] = newSid;
  const t = getShiftTemplate(newSid);
  const c = getShiftColor(t);
  btn.setAttribute('data-template', newSid);
  btn.style.background = c.bg;
  btn.style.color = c.text;
  btn.style.borderColor = c.border + '40';
  btn.textContent = t.isOff ? 'OFF' : t.start + '–' + t.end;
  showToast(`Shift → ${t.name} (${t.isOff ? 'Off' : t.start + '–' + t.end})`);
}

// ==================== SHIFT ASSIGNMENT ====================
let _saSelectedTemplate = null; // currently selected palette template for painting
let _saFilterRole = 'all';

function renderShiftAssignment() {
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
        <h1 class="text-xl font-bold text-charcoal-900">Shift Assignment & Definition</h1>
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

// ==================== TEAM FOLLOW-UP ====================
function renderTeamFollowup() {
  const sevColor = {high:'badge-red',medium:'badge-yellow',low:'badge-blue'};
  const sevBorder = {high:'border-l-red-400',medium:'border-l-yellow-400',low:'border-l-blue-400'};
  const sevBg = {high:'bg-red-50/50',medium:'bg-yellow-50/50',low:'bg-blue-50/50'};
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Team Follow-up</h1><p class="text-xs text-charcoal-500 mt-0.5">${MOCK.followUpItems.length} items requiring attention</p></div>
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
          <button onclick="showToast('Action taken')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Action</button>
        </div>
      </div>
    </div>`).join('')}</div>
  </div>`;
}

// ==================== RECRUITMENT REQUESTS ====================
function renderRecruitment() {
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-bold text-charcoal-900">Recruitment</h1><p class="text-xs text-charcoal-500 mt-0.5">${MOCK.recruitmentRequests.length} requests</p></div>
      <button onclick="openNewRecruitment()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Request</button>
    </div>
    <div class="space-y-1.5">${MOCK.recruitmentRequests.map(r=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-charcoal-100 flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 text-charcoal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg></div>
          <div>
            <p class="text-xs font-semibold text-charcoal-900">${r.position} <span class="text-charcoal-500 font-normal">x${r.count}</span></p>
            <p class="text-[10px] text-charcoal-500">${r.date}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="badge ${r.urgency==='High'?'badge-red':r.urgency==='Medium'?'badge-yellow':'badge-blue'} text-[9px]">${r.urgency}</span>
          ${statusBadge(r.status)}
        </div>
      </div>
    </div>`).join('')}</div>
  </div>`;
}
function openNewRecruitment() {
  openModal('New Recruitment Request',`<form onsubmit="event.preventDefault();closeModal();showToast('Submitted');" class="space-y-3">
    <div><label class="form-label">Position</label><input type="text" class="form-input" placeholder="e.g. Senior Trainer" required></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="form-label">Count</label><input type="number" class="form-input" min="1" value="1" required></div><div><label class="form-label">Urgency</label><select class="form-select" required><option>Low</option><option>Medium</option><option>High</option></select></div></div>
    <div><label class="form-label">Reason</label><textarea class="form-input" rows="2" placeholder="Why is this position needed?" required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Submit Request</button></div>
  </form>`);
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
          <button onclick="navigateTo('team-followup')" class="text-[10px] text-brand-600 font-semibold hover:underline">View All</button>
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
        <button onclick="navigateTo('shift-assignment')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Assign Shifts</button>
        <button onclick="navigateTo('team-attendance')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>Attendance</button>
        <button onclick="openNewRecruitment()" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>Recruit</button>
        <button onclick="navigateTo('team-schedule')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Schedule</button>
      </div>
    </div>
  </div>`;
}
