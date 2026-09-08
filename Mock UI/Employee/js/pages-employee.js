// ==================== DASHBOARD ====================
function renderDashboard() {
  const u=MOCK.currentUser, sh=MOCK.todayShift, at=MOCK.todayAttendance;
  const unread=MOCK.notifications.filter(n=>!n.read).length, pending=MOCK.requests.filter(r=>r.status==='Pending').length;
  const sched=MOCK.scheduleData['c3'];
  const todayIdx=sched.findIndex(d=>d.isToday);
  const upcoming=sched.slice(todayIdx, todayIdx+5);
  const notifs=MOCK.notifications.slice(0,3);
  const pendingReqs=MOCK.requests.filter(r=>r.status==='Pending');
  const isProcessing=MOCK.payroll[0]?.status==='Processing';

  return `<div class="space-y-3">
    <!-- Welcome Header -->
    <div class="mb-1">
      <h2 class="text-xl font-bold text-charcoal-900">${getGreeting()}, ${u.firstName} &#x1F44B;</h2>
      <p class="text-xs text-charcoal-500 mt-0.5 flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        ${u.position} &middot; ${u.gym.name}
      </p>
    </div>

    <!-- Bento Grid: 12-col, 8+4 -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-3">

      <!-- LEFT COLUMN: 8 cols -->
      <div class="md:col-span-8 flex flex-col gap-3">

        <!-- Shift & Attendance Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Shift Card -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3 cursor-pointer hover:shadow-md transition-shadow" onclick="navigateTo('schedule')">
            <p class="bento-label mb-2">TODAY'S SHIFT</p>
            <div class="flex items-start justify-between">
              <div>
                <p class="text-base font-bold text-charcoal-900">${sh.startTime} &mdash; ${sh.endTime}</p>
                <p class="text-xs text-charcoal-500 mt-0.5">${sh.shiftName} Shift</p>
              </div>
              <span class="bg-brand-50 text-brand-700 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                ${sh.status}
              </span>
            </div>
          </div>
          <!-- Attendance Card -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3 cursor-pointer hover:shadow-md transition-shadow" onclick="navigateTo('attendance')">
            <p class="bento-label mb-2">TODAY'S ATTENDANCE</p>
            <div class="flex items-start justify-between">
              <div>
                <p class="text-base font-bold text-charcoal-900">${at.checkedIn?at.checkIn+' AM':'—'}</p>
                <p class="text-xs text-charcoal-500 mt-0.5">${at.checkedIn?'Checked In':'Not Checked In'}</p>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${at.status==='On Time'||at.status==='Present'?'bg-blue-50 text-blue-700':at.status==='Late'?'bg-yellow-50 text-yellow-700':'bg-charcoal-50 text-charcoal-600'}">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                ${at.status}
              </span>
            </div>
          </div>
        </div>

        <!-- Upcoming Schedule (Horizontal Scroll) -->
        <div class="bg-white rounded-xl border border-charcoal-200 p-3">
          <div class="flex justify-between items-center mb-3">
            <p class="bento-label">UPCOMING SCHEDULE</p>
            <button onclick="navigateTo('schedule')" class="text-[11px] text-brand-600 font-semibold flex items-center hover:underline">
              Full Schedule <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          <div class="schedule-scroll">
            ${upcoming.map(d=>{
              const isOff=d.isOff;
              const dayLabel=d.day.toUpperCase()+' '+d.dayNum+(d.isToday?' (TODAY)':'');
              return `<div class="schedule-day-card ${d.isToday?'is-today':''} ${isOff?'is-off':''}">
                <p class="bento-label ${d.isToday?'!text-brand-600':''} mb-1">${dayLabel}</p>
                ${isOff
                  ?`<p class="text-xs font-semibold text-charcoal-500 flex items-center gap-1 mt-2"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg> OFF</p>`
                  :`<p class="text-xs font-bold text-charcoal-900 mt-1">${d.start}</p><p class="text-xs text-charcoal-500">${d.end}</p>`
                }
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Actions & Payroll Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Pending Requests -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3 cursor-pointer hover:shadow-md transition-shadow" onclick="navigateTo('requests')">
            <p class="bento-label mb-2 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              PENDING REQUESTS
            </p>
            <p class="text-2xl font-bold text-charcoal-900 leading-none">${pending}</p>
            <p class="text-xs text-charcoal-500 mt-2">${pending===0?'All caught up!':pending+' awaiting review'}</p>
          </div>
          <!-- Latest Payroll -->
          <div class="bg-white rounded-xl border border-charcoal-200 p-3 relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onclick="navigateTo('payroll')">
            <div class="absolute top-0 right-0 w-24 h-24 bg-brand-500 rounded-bl-full opacity-[0.07]"></div>
            <p class="bento-label mb-2 flex items-center gap-1.5 relative z-10">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              LATEST PAYROLL
            </p>
            <div class="relative z-10">
              <p class="text-base font-bold text-charcoal-900">${MOCK.payroll[0]?.period||'August 2026'}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="bg-brand-50 text-brand-700 px-2 py-0.5 rounded text-[10px] font-semibold">${MOCK.payroll[0]?.status||'Processing'}</span>
                <button onclick="event.stopPropagation();navigateTo('payroll')" class="text-[11px] text-brand-600 font-semibold hover:underline">View Slip</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: 4 cols -->
      <div class="md:col-span-4 flex flex-col gap-3">
        <!-- Action Required -->
        <div class="action-alert bg-red-50 border border-red-200">
          <p class="bento-label mb-3 flex items-center gap-1.5 font-bold text-red-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            ACTION REQUIRED
          </p>
          <div class="space-y-0">
            <div class="action-alert-item cursor-pointer" onclick="navigateTo('events')">
              <svg class="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <div>
                <p class="text-xs font-semibold text-charcoal-900">Document expiring soon</p>
                <p class="text-[10px] text-charcoal-500">First Aid Certification expires in 14 days.</p>
              </div>
            </div>
            <div class="action-alert-item cursor-pointer" onclick="navigateTo('schedule')">
              <svg class="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <div>
                <p class="text-xs font-semibold text-charcoal-900">New schedule published</p>
                <p class="text-[10px] text-charcoal-500">Please acknowledge your new shifts.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Notifications -->
        <div class="bg-white rounded-xl border border-charcoal-200 p-3 flex-1">
          <div class="flex justify-between items-center mb-3 pb-2 border-b border-charcoal-100">
            <p class="bento-label">RECENT NOTIFICATIONS</p>
          </div>
          <div class="space-y-0">
            ${notifs.map(n=>`<div class="notif-item cursor-pointer group" onclick="${n.link?`navigateTo('${n.link}')`:''}">
              <div class="notif-icon">${catIcon(n.category)}</div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-charcoal-900 group-hover:text-brand-600">${n.title}</p>
                <p class="text-[10px] text-charcoal-500 truncate">${n.description}</p>
                <p class="bento-label mt-1 !text-[9px]">${n.date.split(' ')[0].toUpperCase()}</p>
              </div>
            </div>`).join('')}
          </div>
          <button onclick="navigateTo('notifications')" class="w-full mt-3 text-brand-600 text-xs font-semibold py-2 hover:bg-charcoal-50 rounded-lg transition-colors">
            View All
          </button>
        </div>
      </div>
    </div>

    ${hasMgmt()?`<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between mb-2">
        <p class="bento-label">${hasPermission('employees.view') ? 'BRANCH OVERVIEW' : 'TEAM OVERVIEW'}</p>
        <button onclick="navigateTo('${hasPermission('employees.view') ? 'employees' : 'team'}')" class="text-[11px] text-brand-600 font-semibold hover:underline">${hasPermission('employees.view') ? 'View Employees' : 'View Team'}</button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div class="text-center p-2 rounded-lg bg-charcoal-50"><p class="text-lg font-bold text-charcoal-900">${hasPermission('employees.view') ? MOCK.branchEmployees.length : MOCK.teamStats.total}</p><p class="text-[10px] text-charcoal-500">${hasPermission('employees.view') ? 'Employees' : 'Team Members'}</p></div>
        <div class="text-center p-2 rounded-lg bg-brand-50"><p class="text-lg font-bold text-brand-600">${MOCK.teamStats.present}</p><p class="text-[10px] text-charcoal-500">Present Today</p></div>
        <div class="text-center p-2 rounded-lg bg-yellow-50"><p class="text-lg font-bold text-yellow-600">${MOCK.teamStats.pendingRequests}</p><p class="text-[10px] text-charcoal-500">Pending Requests</p></div>
        <div class="text-center p-2 rounded-lg bg-red-50"><p class="text-lg font-bold text-red-600">${MOCK.teamStats.absent}</p><p class="text-[10px] text-charcoal-500">Absent</p></div>
      </div>
    </div>`:''}
  </div>`;
}

// ==================== PROFILE ====================
function renderProfile() {
  const u=MOCK.currentUser;
  return `<div class="space-y-3">
    <!-- Profile Header Card -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-4 flex flex-col sm:flex-row items-center sm:items-start gap-4">
      <div class="relative w-20 h-20 shrink-0">
        <div class="w-20 h-20 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-2xl font-bold border-4 border-white shadow-sm">${u.initials}</div>
        <button class="absolute bottom-0 right-0 bg-white border border-charcoal-200 p-1.5 rounded-full shadow-sm text-charcoal-500 hover:text-brand-600 hover:border-brand-300 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
      </div>
      <div class="flex-1 text-center sm:text-left">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-charcoal-900">${u.fullName}</h2>
            <p class="text-xs text-charcoal-500 mt-0.5">${u.position} &middot; ${u.gym.name} ${u.gym.branch}</p>
          </div>
          <div class="flex items-center justify-center sm:justify-end gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold">
              <span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              ${u.status}
            </span>
            <span class="text-[10px] text-charcoal-500 border border-charcoal-200 px-2 py-0.5 rounded-full">${u.id}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bento Grid: 3-col, 2+1 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <!-- Left Column: 2 cols (Editable Info) -->
      <div class="lg:col-span-2 space-y-3">
        <!-- Personal Info -->
        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
          <div class="px-4 py-2.5 border-b border-charcoal-100 flex justify-between items-center bg-charcoal-50/50">
            <div>
              <p class="bento-label">PROFILE DETAILS</p>
              <h3 class="text-sm font-bold text-charcoal-900 mt-0.5">Personal Info</h3>
            </div>
            <button onclick="showToast('Profile editing is managed by HR','info')" class="text-brand-600 hover:text-brand-700 text-[10px] font-semibold flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              Edit
            </button>
          </div>
          <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label class="bento-label text-charcoal-500">Full Name</label><p class="text-xs text-charcoal-900 mt-0.5">${u.fullName}</p></div>
            <div><label class="bento-label text-charcoal-500">Date of Birth</label><p class="text-xs text-charcoal-900 mt-0.5">${formatDate(u.dateOfBirth)}</p></div>
            <div><label class="bento-label text-charcoal-500">National ID</label><p class="text-xs text-charcoal-900 mt-0.5">${u.nationalId}</p></div>
            <div><label class="bento-label text-charcoal-500">Gender</label><p class="text-xs text-charcoal-900 mt-0.5">${u.gender}</p></div>
          </div>
        </div>

        <!-- Contact Info -->
        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
          <div class="px-4 py-2.5 border-b border-charcoal-100 flex justify-between items-center bg-charcoal-50/50">
            <div>
              <p class="bento-label">COMMUNICATION</p>
              <h3 class="text-sm font-bold text-charcoal-900 mt-0.5">Contact Info</h3>
            </div>
            <button onclick="openEditContact()" class="text-brand-600 hover:text-brand-700 text-[10px] font-semibold flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              Edit
            </button>
          </div>
          <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label class="bento-label text-charcoal-500">Mobile Number</label><p class="text-xs text-charcoal-900 mt-0.5">${u.phone}</p></div>
            <div><label class="bento-label text-charcoal-500">Personal Email</label><p class="text-xs text-charcoal-900 mt-0.5">${u.email}</p></div>
            <div class="sm:col-span-2"><label class="bento-label text-charcoal-500">Residential Address</label><p class="text-xs text-charcoal-900 mt-0.5">${u.address}</p></div>
          </div>
        </div>

        <!-- Emergency Contact -->
        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
          <div class="px-4 py-2.5 border-b border-charcoal-100 flex justify-between items-center bg-charcoal-50/50">
            <div>
              <p class="bento-label">IN CASE OF EMERGENCY</p>
              <h3 class="text-sm font-bold text-charcoal-900 mt-0.5">Emergency Contact</h3>
            </div>
            <button onclick="showToast('Emergency contact updated','info')" class="text-brand-600 hover:text-brand-700 text-[10px] font-semibold flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              Edit
            </button>
          </div>
          <div class="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label class="bento-label text-charcoal-500">Contact Name</label><p class="text-xs text-charcoal-900 mt-0.5">${u.emergencyContact.name}</p></div>
            <div><label class="bento-label text-charcoal-500">Relationship</label><p class="text-xs text-charcoal-900 mt-0.5">${u.emergencyContact.relationship}</p></div>
            <div><label class="bento-label text-charcoal-500">Phone Number</label><p class="text-xs text-charcoal-900 mt-0.5">${u.emergencyContact.phone}</p></div>
          </div>
        </div>
      </div>

      <!-- Right Column: 1 col (HR Controlled) -->
      <div class="space-y-3">
        <div class="bg-charcoal-50 rounded-xl border border-charcoal-200 overflow-hidden relative">
          <div class="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] pointer-events-none"></div>
          <div class="px-4 py-2.5 border-b border-charcoal-200 flex justify-between items-center bg-charcoal-100/50 relative z-10">
            <div>
              <p class="bento-label flex items-center gap-1 text-charcoal-600">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                HR CONTROLLED
              </p>
              <h3 class="text-sm font-bold text-charcoal-900 mt-0.5">Employment Info</h3>
            </div>
          </div>
          <div class="p-4 space-y-3 relative z-10">
            <div class="flex justify-between items-end border-b border-charcoal-200 pb-2.5">
              <div><p class="bento-label text-charcoal-500">Employee ID</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${u.id}</p></div>
            </div>
            <div class="flex justify-between items-end border-b border-charcoal-200 pb-2.5">
              <div><p class="bento-label text-charcoal-500">Primary Location</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${u.gym.name} ${u.gym.branch}</p></div>
              <svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </div>
            <div class="flex justify-between items-end border-b border-charcoal-200 pb-2.5">
              <div><p class="bento-label text-charcoal-500">Job Title / Position</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${u.position}</p></div>
              <svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <div class="flex justify-between items-end border-b border-charcoal-200 pb-2.5">
              <div><p class="bento-label text-charcoal-500">Employment Level</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${u.level}</p></div>
            </div>
            <div class="flex justify-between items-end border-b border-charcoal-200 pb-2.5">
              <div><p class="bento-label text-charcoal-500">Hire Date</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5">${formatDate(u.hireDate)}</p></div>
              <svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <div class="flex justify-between items-end">
              <div><p class="bento-label text-charcoal-500">Current Status</p><p class="text-xs font-semibold text-charcoal-900 mt-0.5 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-brand-500"></span> Active ${u.employmentType}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function openEditContact() {
  openModal('Edit Contact Information',`<form onsubmit="event.preventDefault();closeModal();showToast('Contact information updated successfully');" class="space-y-3"><div><label class="form-label">Mobile Number</label><input type="tel" class="form-input" value="${MOCK.currentUser.phone}" required></div><div><label class="form-label">Personal Email</label><input type="email" class="form-input" value="${MOCK.currentUser.email}" required></div><div><label class="form-label">Address</label><textarea class="form-input" rows="2" required>${MOCK.currentUser.address}</textarea></div><div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save</button></div></form>`,{wide:true});
}

// ==================== DOCUMENTS ====================
// Employee uploads their required documents. HR-uploaded company documents are
// view/download only. Expiring-document alerts live on the Events page.
function renderDocuments() {
  const doneCount = MOCK.requiredDocs.filter(r=>r.docId).length;
  const pendingDocs = MOCK.requiredDocs.filter(r=>!r.docId);
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">My Documents</h1><p class="text-xs text-charcoal-500 mt-0.5">${doneCount} of ${MOCK.requiredDocs.length} required documents uploaded</p></div>
      <button onclick="openUploadModal('')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Upload</button>
    </div>

    <!-- Required Documents -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between">
        <p class="bento-label">REQUIRED DOCUMENTS · EMPLOYEE UPLOADS</p>
        <span class="text-[10px] text-charcoal-400">${doneCount}/${MOCK.requiredDocs.length} complete</span>
      </div>
      <div class="divide-y divide-charcoal-50">
        ${MOCK.requiredDocs.map(r=>{
          const d = r.docId ? MOCK.documents.find(x=>x.id===r.docId) : null;
          const icon = r.key==='national-id'?'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'
            : r.key==='contract'?'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            : r.key==='certificates'||r.key==='graduation'?'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
            : r.key==='bank'?'M3 6h18M3 6v12a2 2 0 002 2h14a2 2 0 002-2V6m-9 3a3 3 0 100 6 3 3 0 000-6z'
            : 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z';
          return `<div class="px-4 py-3 flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg ${d?'bg-brand-100 text-brand-600':'bg-charcoal-100 text-charcoal-400'} flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg></div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-charcoal-900">${r.label}</p>
              <p class="text-[10px] text-charcoal-500">${d?'Uploaded '+formatDate(d.uploadDate):'Not uploaded yet'}</p>
            </div>
            ${d
              ?`<div class="flex items-center gap-1.5 flex-shrink-0"><button onclick="openDocDetail('${d.id}')" class="btn btn-sm btn-secondary">${statusBadge(d.status)}</button><button onclick="showToast('Downloading ${d.name}...','info')" class="p-1.5 rounded-lg hover:bg-charcoal-100 transition-colors"><svg class="w-3.5 h-3.5 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button></div>`
              :`<button onclick="openUploadModal('${r.key}')" class="btn btn-sm btn-secondary flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Upload</button>`
            }
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- HR Uploaded Documents -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between">
        <p class="bento-label">HR UPLOADED · OFFICIAL COMPANY DOCUMENTS</p>
        <span class="inline-flex items-center gap-1 text-[10px] text-charcoal-400"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>View / Download only</span>
      </div>
      <div class="divide-y divide-charcoal-50">
        ${MOCK.hrDocuments.map(h=>`<div class="px-4 py-3 flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-charcoal-100 text-charcoal-500 flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg></div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-charcoal-900">${h.name}</p>
            <p class="text-[10px] text-charcoal-500">${h.category} · Added ${formatDate(h.addedDate)} · ${h.size}</p>
          </div>
          <button onclick="showToast('Downloading ${h.name}...','info')" class="btn btn-sm btn-secondary flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Download</button>
        </div>`).join('')}
      </div>
    </div>

    <!-- All On-File Documents -->
    <div class="flex items-center justify-between">
      <p class="text-sm font-bold text-charcoal-900">All On-File Documents</p>
      <span class="text-[10px] text-charcoal-400">${MOCK.documents.length} documents</span>
    </div>

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Document</th><th>Category</th><th>Uploaded</th><th>Expires</th><th>Status</th><th></th></tr></thead>
      <tbody>${MOCK.documents.map(d=>`<tr class="cursor-pointer" onclick="openDocDetail('${d.id}')"><td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg ${d.status==='Expiring Soon'?'bg-orange-100 text-orange-600':'bg-charcoal-100 text-charcoal-600'} flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><span class="text-xs font-medium text-charcoal-900">${d.name}</span></div></td><td class="text-xs">${d.category}</td><td class="text-xs">${formatDate(d.uploadDate)}</td><td class="text-xs ${d.expiryDate&&d.status==='Expiring Soon'?'text-orange-600 font-medium':''}">${d.expiryDate?formatDate(d.expiryDate):'—'}</td><td>${statusBadge(d.status)}</td><td><button onclick="event.stopPropagation();showToast('Downloading ${d.name}...','info')" class="p-1.5 rounded-lg hover:bg-charcoal-100 transition-colors"><svg class="w-3.5 h-3.5 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button></td></tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${MOCK.documents.map(d=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openDocDetail('${d.id}')">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg ${d.status==='Expiring Soon'?'bg-orange-100 text-orange-600':'bg-charcoal-100 text-charcoal-600'} flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-charcoal-900 truncate">${d.name}</p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[10px] text-charcoal-500">${d.category}</span>
            ${d.expiryDate?`<span class="text-[10px] ${d.status==='Expiring Soon'?'text-orange-600 font-medium':'text-charcoal-400'}">Exp: ${formatDate(d.expiryDate)}</span>`:''}
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${statusBadge(d.status)}
          <button onclick="event.stopPropagation();showToast('Downloading...','info')" class="p-1.5 rounded-lg hover:bg-charcoal-100 transition-colors"><svg class="w-3.5 h-3.5 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
        </div>
      </div>
    </div>`).join('')}</div>
  </div>`;
}
function openDocDetail(id) {
  const d=MOCK.documents.find(x=>x.id===id); if(!d)return;
  openModal(d.name,`<div class="space-y-3">
    <div class="flex items-center justify-between"><span class="badge badge-gray">${d.category}</span>${statusBadge(d.status)}</div>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-charcoal-50 rounded-lg p-2.5 text-center"><p class="bento-label text-charcoal-500 mb-0.5">UPLOADED</p><p class="text-xs font-semibold text-charcoal-900">${formatDate(d.uploadDate)}</p></div>
      <div class="bg-charcoal-50 rounded-lg p-2.5 text-center"><p class="bento-label text-charcoal-500 mb-0.5">EXPIRES</p><p class="text-xs font-semibold ${d.status==='Expiring Soon'?'text-orange-600':'text-charcoal-900'}">${d.expiryDate?formatDate(d.expiryDate):'N/A'}</p></div>
    </div>
    <div class="bg-charcoal-50 rounded-lg p-6 text-center"><svg class="w-10 h-10 text-charcoal-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p class="text-xs text-charcoal-500">Document preview</p></div>
  </div>`,{footer:`<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>${d.canDownload?`<button onclick="showToast('Downloading...','info');closeModal();" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Download</button>`:''}`});
}
function openUploadModal(key) {
  const tgt = MOCK.requiredDocs.find(r=>r.key===key);
  openModal('Upload Document',`<form onsubmit="event.preventDefault();closeModal();showToast('Document uploaded for HR review');" class="space-y-3"><div><label class="form-label">Document Type</label><select class="form-select" required><option value="">Select...</option>${MOCK.requiredDocs.map(r=>`<option ${tgt&&tgt.key===r.key?'selected':''}>${r.label}</option>`).join('')}</select></div><div><label class="form-label">Document Name</label><input type="text" class="form-input" placeholder="e.g. Updated Certification" required></div><div><label class="form-label">File</label><div class="border-2 border-dashed border-charcoal-200 rounded-lg p-6 text-center hover:border-brand-400 cursor-pointer transition-colors"><svg class="w-6 h-6 text-charcoal-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg><p class="text-xs text-charcoal-500">Click to upload or drag & drop</p><p class="text-[10px] text-charcoal-400 mt-0.5">PDF, JPG, PNG up to 10MB</p></div></div><div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Upload</button></div></form>`,{wide:true});
}

// ==================== EVENTS ====================
// HR-side published events replace the expiring-document notification:
// compliance deadlines, training and company events.
function renderEvents() {
  const events = MOCK.events;
  const groups = ['Compliance','Benefits','Onboarding','Training','Company Event'];
  const iconFor = t => t==='Document Expiry'?'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    : t==='Contract'?'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
    : t==='Benefits'?'M3 6h18M3 6v12a2 2 0 002 2h14a2 2 0 002-2V6m-9 3a3 3 0 100 6 3 3 0 000-6z'
    : t==='Onboarding'?'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    : t==='Training'?'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
    : 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
  const colorFor = t => t==='Document Expiry'||t==='Onboarding'?'bg-orange-100 text-orange-600'
    : t==='Contract'?'bg-blue-100 text-blue-600'
    : t==='Benefits'?'bg-green-100 text-green-600'
    : t==='Training'?'bg-purple-100 text-purple-600'
    : 'bg-charcoal-100 text-charcoal-600';
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Events</h1><p class="text-xs text-charcoal-500 mt-0.5">Compliance deadlines, training and company events from HR</p></div>
      <span class="inline-flex items-center gap-1 text-[10px] text-charcoal-400"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>${events.length} upcoming events</span>
    </div>
    ${groups.map(g=>{
      const list = events.filter(e=>e.category===g);
      if(!list.length) return '';
      return `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between">
          <p class="bento-label">${g.toUpperCase()}</p>
          <span class="text-[10px] text-charcoal-400">${list.length} event${list.length>1?'s':''}</span>
        </div>
        <div class="divide-y divide-charcoal-50">
          ${list.map(e=>`<div class="px-4 py-3 flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg ${colorFor(e.type)} flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconFor(e.type)}"/></svg></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-xs font-semibold text-charcoal-900">${e.title}</p>
                ${e.urgent?'<span class="px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[9px] font-bold uppercase">Due soon</span>':''}
              </div>
              <p class="text-[10px] text-charcoal-500 mt-0.5">${e.detail}</p>
            </div>
            <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span class="text-[10px] font-medium text-charcoal-600">${formatDate(e.date)}</span>
              ${e.action?`<button onclick="${e.link?`navigateTo('${e.link}')`:`showToast('${e.action}')`}" class="btn btn-sm btn-secondary"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>${e.action}</button>`:''}
            </div>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ==================== EMPLOYMENT HISTORY ====================
function renderHistory() {
  return `<div class="space-y-3 max-w-2xl"><h1 class="text-xl font-bold text-charcoal-900">Employment History</h1>
    <div class="relative"><div class="timeline-line"></div><div class="space-y-5">${MOCK.employmentHistory.map(m=>`<div><p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wider mb-2 pl-8">${m.month}</p>${m.events.map(e=>`<div class="flex gap-3 mb-4"><div class="flex flex-col items-center flex-shrink-0"><div class="timeline-dot"></div></div><div class="card p-3 flex-1"><div class="flex items-center gap-1.5 mb-1"><svg class="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${e.icon==='briefcase'?'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z':e.icon==='building'?'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4':e.icon==='shield'?'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z':'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'}"/></svg><h3 class="text-xs font-semibold text-charcoal-900">${e.type}</h3></div>${e.from&&e.to?`<div class="flex items-center gap-1 text-xs mb-1"><span class="text-charcoal-500">${e.from}</span><svg class="w-3 h-3 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg><span class="font-medium text-charcoal-900">${e.to}</span></div>`:''}<p class="text-[10px] text-charcoal-500 mb-1">${e.effective}</p><p class="text-xs text-charcoal-600">${e.detail}</p>${e.extra?`<div class="flex flex-wrap gap-3 mt-2 text-xs">${e.extra.map(x=>`<span class="text-charcoal-500">${x.label}: <span class="font-medium text-charcoal-900">${x.value}</span></span>`).join('')}</div>`:''}</div></div>`).join('')}</div>`).join('')}</div></div>
  </div>`;
}

// ==================== ATTENDANCE & SCHEDULE ====================
// Combines the employee's daily attendance with the assigned shift.
// Today's view is read-only (immutable) — future changes go through the
// Employee -> Branch Manager -> HR (if required) -> Final status workflow.

// Persisted future-request state for the My Attendance page.
let futureRequests = [
  { id: 'RQ-1035', type: 'Shift Swap', date: '2026-09-03', status: 'Pending BM', requiresHR: false, reason: "Swap evening shift with Karim on Sep 3", submitted: 'Aug 24, 2026' },
  { id: 'RQ-1036', type: 'Leave Request', date: '2026-09-07', status: 'Pending HR', requiresHR: true, reason: "Family event — out of town", submitted: 'Aug 25, 2026' },
  { id: 'RQ-1037', type: 'Permission Request', date: '2026-09-01', status: 'Approved', requiresHR: false, reason: "Medical appointment in the morning", submitted: 'Aug 22, 2026' },
  { id: 'RQ-1038', type: 'Schedule Change', date: '2026-09-10', status: 'Rejected', requiresHR: true, reason: "Requesting off-day swap", submitted: 'Aug 20, 2026' },
];
let futureReqSeq = 1039;
let attType = 'Leave Request';
let attDate = '2026-08-27';
let attReason = '';

const TODAY_ISO = '2026-08-26'; // matches the mock "today" in MOCK data

function attWorkMinutes(checkIn, checkOut) {
  if (!checkIn) return null;
  const end = checkOut || MOCK.now || '14:30';
  const [hi, mi] = checkIn.split(':').map(Number);
  const [he, me] = end.split(':').map(Number);
  let mins = (he * 60 + me) - (hi * 60 + mi);
  if (mins < 0) mins += 24 * 60;
  return mins;
}
function attFormatMins(m) {
  if (m == null) return '—';
  return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
}

function renderAttendance() {
  const s = MOCK.attendanceSummary;
  const ts = MOCK.todayShift, ta = MOCK.todayAttendance;
  const checkIn = ta.checkIn, checkOut = ta.checkOut, status = ta.status;
  const wm = attWorkMinutes(checkIn, checkOut);
  const shortcuts = [
    { id: 'attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', active: true },
    { id: 'schedule', label: 'Schedule', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', active: false },
    { id: 'requests', label: 'Requests', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', active: false },
  ];

  return `<div class="space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Attendance &amp; Schedule</h1><p class="text-xs text-charcoal-500 mt-0.5">Daily attendance and assigned shift in one place · ${s.rate}% attendance rate</p></div>
      <select class="form-select w-36" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>August 2026</option><option>July 2026</option></select>
    </div>

    <!-- Quick Shortcuts -->
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[10px] font-bold uppercase tracking-wider text-charcoal-400 mr-1">Quick</span>
      ${shortcuts.map(x=>`<button onclick="navigateTo('${x.id}')" class="btn btn-sm ${x.active?'btn-primary':'btn-secondary'}"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${x.icon}"/></svg>${x.label}</button>`).join('')}
    </div>

    <!-- Today's View (Read-Only) -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal-100 px-4 py-3">
        <div>
          <p class="text-sm font-bold text-charcoal-900">Today's View</p>
          <p class="text-[10px] text-charcoal-500">Tuesday, Aug 26, 2026 · <span class="font-medium text-charcoal-700">${ts.gym}</span></p>
        </div>
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-charcoal-100 text-charcoal-600 text-[10px] font-semibold"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>Read-only · today is final</span>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-charcoal-100">
        <div class="p-4">
          <p class="bento-label text-charcoal-400 mb-1">ASSIGNED SHIFT</p>
          <p class="text-sm font-bold text-charcoal-900">${ts.shiftName}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${ts.startTime} – ${ts.endTime}</p>
        </div>
        <div class="p-4">
          <p class="bento-label text-charcoal-400 mb-1">CHECK-IN</p>
          <p class="text-sm font-bold ${checkIn?'text-brand-600':'text-charcoal-400'}">${checkIn||'—'}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${checkIn?ts.gym:'not checked in'}</p>
        </div>
        <div class="p-4">
          <p class="bento-label text-charcoal-400 mb-1">CHECK-OUT</p>
          <p class="text-sm font-bold ${checkOut?'text-charcoal-900':'text-charcoal-400'}">${checkOut||'—'}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${checkOut?'completed':'in progress'}</p>
        </div>
        <div class="p-4">
          <p class="bento-label text-charcoal-400 mb-1">WORKING HOURS</p>
          <p class="text-sm font-bold text-charcoal-900">${attFormatMins(wm)}</p>
          <p class="text-[10px] text-charcoal-500 mt-0.5">${checkOut?'of '+attFormatMins(attWorkMinutes(ts.startTime,ts.endTime))+' scheduled':'updating live'}</p>
        </div>
        <div class="p-4">
          <p class="bento-label text-charcoal-400 mb-1">ATTENDANCE STATUS</p>
          <div class="mt-0.5">${statusBadge(status)}</div>
          <p class="text-[10px] text-charcoal-500 mt-1">${ta.source||'No action needed'}</p>
        </div>
      </div>
      <div class="px-4 py-2.5 bg-brand-50 border-t border-brand-100 flex items-start gap-2">
        <svg class="w-3.5 h-3.5 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="text-[11px] text-charcoal-600">Today's attendance and shift are locked. No modifications or requests can be made for today. Plan any changes for future dates below.</p>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><p class="text-xl font-bold text-brand-700">${s.rate}%</p><p class="text-[10px] text-charcoal-500 mt-0.5">Attendance Rate</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-brand-600">${s.present}</p><p class="text-[10px] text-charcoal-500">Present</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-yellow-600">${s.late}</p><p class="text-[10px] text-charcoal-500">Late</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg></div><p class="text-lg font-bold text-red-600">${s.absent}</p><p class="text-[10px] text-charcoal-500">Absent</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg></div><p class="text-lg font-bold text-blue-600">${s.earlyCheckout}</p><p class="text-[10px] text-charcoal-500">Early Out</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><div class="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center mx-auto mb-1"><svg class="w-4 h-4 text-charcoal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-lg font-bold text-charcoal-600">${s.missingCheckout}</p><p class="text-[10px] text-charcoal-500">Missing Out</p></div>
    </div>

    <!-- Plan Ahead: Future Requests -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-3">
      <div class="bg-white rounded-xl border border-charcoal-200 p-4 lg:col-span-2">
        <div class="flex items-center justify-between mb-1">
          <p class="text-sm font-bold text-charcoal-900">Plan Ahead</p>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold uppercase"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-4 8v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Future only</span>
        </div>
        <p class="text-[10px] text-charcoal-500 mb-3">Submit a request for a future date. Today cannot be requested.</p>
        <div class="space-y-3">
          <div>
            <label class="form-label">Request Type</label>
            <select class="form-select" onchange="attType=this.value">
              <option ${attType==='Leave Request'?'selected':''}>Leave Request</option>
              <option ${attType==='Schedule Change'?'selected':''}>Schedule Change</option>
              <option ${attType==='Shift Swap'?'selected':''}>Shift Swap</option>
              <option ${attType==='Permission Request'?'selected':''}>Permission Request</option>
            </select>
          </div>
          <div>
            <label class="form-label">Date (future only)</label>
            <input type="date" class="form-input" value="${attDate}" min="2026-08-27" onchange="attDate=this.value">
            <p class="text-[9px] text-charcoal-400 mt-1 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Earliest selectable date is tomorrow (Aug 27).</p>
          </div>
          <div>
            <label class="form-label">Reason / Details</label>
            <textarea class="form-input" rows="3" placeholder="Tell us why..." oninput="attReason=this.value">${attReason}</textarea>
          </div>
          <button onclick="submitFutureRequest()" class="btn btn-sm btn-primary w-full justify-center"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>Submit Request</button>
        </div>
      </div>

      <div class="lg:col-span-3 flex flex-col gap-3">
        <div class="bg-white rounded-xl border border-charcoal-200 p-4">
          <p class="text-sm font-bold text-charcoal-900 mb-2">Approval Workflow</p>
          <div class="flex items-center gap-1.5 flex-wrap">
            ${[['You','person','bg-brand-600 text-white'],['Branch Manager','clipboard-check','bg-charcoal-800 text-white'],['HR Approval','shield-check','bg-purple-600 text-white'],['Final Status','flag','bg-charcoal-100 text-charcoal-600']].map((w,ix)=>`
              <span class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${w[2]} text-[10px] font-semibold" style="${ix===2?'opacity:0.75':''}"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${ix===0?'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z':ix===1?'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z':ix===2?'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z':'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9'}"/></svg>${w[0]}</span>
              ${ix<3?'<svg class="w-3.5 h-3.5 text-charcoal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>':''}
            `).join('')}
          </div>
          <p class="text-[10px] text-charcoal-500 mt-2">Leave requests and schedule changes require HR approval after your Branch Manager signs off. Other request types stop after the manager's decision.</p>
        </div>

        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-charcoal-100">
            <p class="text-sm font-bold text-charcoal-900">My Upcoming Requests</p>
            <span class="text-[10px] text-charcoal-400">${futureRequests.length} upcoming</span>
          </div>
          ${futureRequests.length===0?'<div class="p-6 text-center"><p class="text-xs text-charcoal-400">No upcoming requests yet.</p></div>':futureRequests.map(r=>{
            const totalSteps = r.requiresHR ? 4 : 3; // You -> BM -> HR? -> Final
            const stepLabels = r.requiresHR ? ['Submitted','Branch Manager','HR Approval','Final'] : ['Submitted','Branch Manager','Final'];
            const progress = r.status==='Approved' ? totalSteps : r.status==='Pending HR' ? 2 : r.status==='Pending BM' ? 1 : r.status==='Rejected' ? 0 : 1;
            return `<div class="p-3 border-b border-charcoal-50 last:border-0">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-lg ${r.status==='Approved'?'bg-brand-100 text-brand-600':r.status==='Rejected'?'bg-red-100 text-red-600':r.status==='Pending'?'bg-yellow-100 text-yellow-600':'bg-blue-100 text-blue-600'} flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-4 8v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold text-charcoal-900">${r.type}</p>
                    <p class="text-[10px] text-charcoal-500">${formatDate(r.date)} · ${r.id} ${r.requiresHR?'· HR required':''}</p>
                    <p class="text-[10px] text-charcoal-500 truncate">${r.reason}</p>
                  </div>
                </div>
                ${statusBadge(r.status.replace(/Pending (BM|HR)/,'Pending'))}
              </div>
              <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                ${stepLabels.map((sl,i)=>`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${i<progress?'bg-brand-100 text-brand-700':r.status==='Rejected'&&i===0?'bg-red-100 text-red-600':i===progress&&r.status!=='Rejected'?'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200':'bg-charcoal-100 text-charcoal-400'}">${i<progress?'<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>':''}${sl}</span>${i<stepLabels.length-1?'<svg class="w-3 h-3 text-charcoal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>':''}`).join('')}
              </div>
              ${r.status==='Rejected'?'<p class="mt-1.5 text-[10px] text-red-600 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Not enough staff coverage on the requested day — please pick another date.</p>':''}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- My Attendance History -->
    <div class="flex items-center justify-between">
      <p class="text-sm font-bold text-charcoal-900">Attendance History</p>
      <span class="text-[10px] text-charcoal-400">Tap a row for details</span>
    </div>

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block"><div class="table-responsive"><table class="data-table"><thead><tr><th>Date</th><th>Shift</th><th>Check In</th><th>Check Out</th><th>Status</th><th></th></tr></thead><tbody>${MOCK.attendanceRecords.map(r=>`<tr class="cursor-pointer ${r.date===MOCK.attendanceRecords[0]?.date?'bg-brand-50/50':''}" onclick="openAttDetail('${r.date}')"><td class="text-xs font-medium">${formatDate(r.date)}</td><td class="text-xs">${r.shift}</td><td class="text-xs">${r.checkIn||'—'}</td><td class="text-xs">${r.checkOut||'—'}</td><td>${statusBadge(r.status)}</td><td><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td></tr>`).join('')}</tbody></table></div></div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${MOCK.attendanceRecords.map(r=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openAttDetail('${r.date}')"><div class="flex items-center justify-between"><div><p class="text-xs font-medium text-charcoal-900">${formatDate(r.date)}</p><p class="text-[10px] text-charcoal-500">${r.shift}</p></div>${statusBadge(r.status)}</div><div class="flex gap-4 mt-1.5 text-[10px] text-charcoal-500"><span class="flex items-center gap-1"><svg class="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>In: ${r.checkIn||'—'}</span><span class="flex items-center gap-1"><svg class="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Out: ${r.checkOut||'—'}</span></div></div>`).join('')}</div>
  </div>`;
}
function submitFutureRequest() {
  if(!attType){showToast('Please choose a request type','error');return;}
  if(!attDate){showToast('Please pick a date','error');return;}
  if(attDate <= TODAY_ISO){showToast('Today and past dates are locked — choose a future date','error');return;}
  if(!attReason.trim()){showToast('Please add a reason for your request','error');return;}
  const requiresHR = (attType==='Leave Request' || attType==='Schedule Change');
  futureRequests.unshift({
    id:'RQ-'+futureReqSeq++,
    type:attType,
    date:attDate,
    status:'Pending BM',
    requiresHR,
    reason:attReason.trim(),
    submitted:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
  });
  attDate = new Date(Date.parse('2026-08-27') + futureRequests.length*24*60*60*1000).toISOString().slice(0,10);
  attReason = '';
  renderAll();
  showToast('Submitted for Branch Manager approval');
}
function openAttDetail(date) {
  const r=MOCK.attendanceRecords.find(a=>a.date===date); if(!r)return;
  const statusColor = {OnTime:'text-brand-600', Late:'text-yellow-600', Absent:'text-red-600', Off:'text-charcoal-500', 'Early Checkout':'text-blue-600'}[r.status]||'text-charcoal-600';
  openDrawer('Attendance Details',`<div class="space-y-4">
    <div class="text-center py-2 border-b border-charcoal-100">
      <p class="text-sm font-bold text-charcoal-900">${formatDate(r.date)}</p>
      <div class="mt-1">${statusBadge(r.status)}</div>
    </div>
    <div class="space-y-2">
      <div class="flex justify-between items-center py-1.5 border-b border-charcoal-100 text-xs"><span class="text-charcoal-500 flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Scheduled Shift</span><span class="font-medium text-charcoal-900">${r.shift}</span></div>
      <div class="flex justify-between items-center py-1.5 border-b border-charcoal-100 text-xs"><span class="text-charcoal-500 flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Shift Name</span><span class="font-medium text-charcoal-900">${r.shiftName}</span></div>
      <div class="flex justify-between items-center py-1.5 border-b border-charcoal-100 text-xs"><span class="text-charcoal-500 flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>Check In</span><span class="font-bold ${r.checkIn?'text-brand-600':'text-charcoal-400'}">${r.checkIn||'—'}</span></div>
      <div class="flex justify-between items-center py-1.5 border-b border-charcoal-100 text-xs"><span class="text-charcoal-500 flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Check Out</span><span class="font-bold ${r.checkOut?'text-charcoal-900':'text-charcoal-400'}">${r.checkOut||'—'}</span></div>
      ${r.source?`<div class="flex justify-between items-center py-1.5 border-b border-charcoal-100 text-xs"><span class="text-charcoal-500 flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>Source</span><span class="font-medium text-charcoal-900">${r.source}</span></div>`:''}
      ${r.notes?`<div class="py-1.5 text-xs"><span class="text-charcoal-500 flex items-center gap-1.5 mb-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>Notes</span><p class="text-charcoal-700 bg-charcoal-50 rounded-lg p-2.5">${r.notes}</p></div>`:''}
    </div>
    ${r.status!=='Off'?`<button onclick="closeModal();navigateTo('requests');showToast('Redirecting to request form...','info')" class="w-full btn btn-sm btn-primary justify-center"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Request Correction</button>`:''}
  </div>`);
}

// ==================== SCHEDULE ====================
function renderSchedule() {
  const ci=state.currentCycleIndex, cycle=MOCK.scheduleCycles[ci], days=MOCK.scheduleData[cycle.id]||[], today=days.find(d=>d.isToday);
  const shiftCellClass = (d) => {
    if(d.isOff) return 'schedule-shift-off';
    if(d.shiftName==='Morning') return 'schedule-shift-morning';
    if(d.shiftName==='Evening') return 'schedule-shift-evening';
    return 'schedule-shift-off';
  };
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">My Schedule</h1><p class="text-xs text-charcoal-500 mt-0.5">View your assigned shifts and cycles</p></div>
      <div class="flex items-center gap-2">${statusBadge(cycle.status)}</div>
    </div>

    <!-- Cycle Navigator -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between">
        <button onclick="navigateCycle(-1)" ${ci===0?'disabled class="opacity-40 cursor-not-allowed p-1.5 rounded-lg"':'class="hover:bg-charcoal-50 rounded-lg p-1.5 transition-colors"'}><svg class="w-5 h-5 text-charcoal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>
        <div class="text-center flex-1">
          <p class="text-sm font-bold text-charcoal-900">${cycle.label}</p>
          <p class="text-[10px] text-charcoal-500">${cycle.status} · ${days.length} days</p>
        </div>
        <button onclick="navigateCycle(1)" ${ci===MOCK.scheduleCycles.length-1?'disabled class="opacity-40 cursor-not-allowed p-1.5 rounded-lg"':'class="hover:bg-charcoal-50 rounded-lg p-1.5 transition-colors"'}><svg class="w-5 h-5 text-charcoal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <div class="flex items-center justify-center gap-1.5 mt-2">
        ${MOCK.scheduleCycles.map((c,i)=>`<button onclick="state.currentCycleIndex=${i};renderAll()" class="w-2 h-2 rounded-full ${i===ci?'bg-brand-600':'bg-charcoal-300 hover:bg-charcoal-400'} transition-colors"></button>`).join('')}
      </div>
    </div>

    ${today?`<div class="bg-white rounded-xl border border-charcoal-200 p-3 border-l-4 border-l-brand-500">
      <div class="flex items-center gap-2 mb-1">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>TODAY</span>
        <span class="text-[10px] text-charcoal-500">${new Date(today.date).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</span>
      </div>
      <p class="text-lg font-bold text-charcoal-900 mt-1">${today.isOff?'OFF DAY':today.start+' AM – '+today.end.replace(/:.*/,'')+' PM'}</p>
      ${!today.isOff?`<div class="flex items-center gap-2 mt-1.5">
        <span class="inline-flex items-center gap-1 text-xs text-charcoal-600"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>${MOCK.currentUser.gym.name}</span>
        <span class="w-1 h-1 bg-charcoal-300 rounded-full"></span>
        <span class="inline-flex items-center gap-1 text-xs text-charcoal-600"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${today.shiftName}</span>
      </div>`:''}
    </div>`:''}

    <!-- Legend -->
    <div class="flex items-center gap-4 text-[10px] text-charcoal-500 px-1">
      <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded schedule-shift-morning inline-block border border-blue-200"></span>Morning</span>
      <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded schedule-shift-evening inline-block border border-green-200"></span>Evening</span>
      <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded schedule-shift-off inline-block border border-charcoal-200"></span>Off</span>
    </div>

    <!-- Desktop Grid -->
    <div class="hidden lg:grid grid-cols-5 gap-2">${days.map(d=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center ${d.isToday?'ring-2 ring-brand-500 border-brand-300':'hover:shadow-md'} transition-all">
      <p class="text-[9px] font-bold text-charcoal-400 uppercase tracking-wider">${d.day}</p>
      <p class="text-xl font-bold ${d.isToday?'text-brand-600':'text-charcoal-900'} mt-0.5">${d.dayNum}</p>
      <div class="mt-2">
        ${d.isOff
          ?`<div class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-charcoal-50 text-charcoal-500"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg><span class="text-[10px] font-semibold">OFF</span></div>`
          :`<div class="inline-flex flex-col items-center px-2.5 py-1.5 rounded-lg ${shiftCellClass(d)}">
              <span class="text-[10px] font-bold">${d.start} – ${d.end}</span>
              <span class="text-[9px] opacity-70">${d.shiftName}</span>
            </div>`
        }
      </div>
      ${d.isToday?'<span class="inline-block mt-2 text-[9px] font-bold text-brand-600 uppercase">Today</span>':''}
    </div>`).join('')}</div>

    <!-- Mobile List -->
    <div class="space-y-1.5 lg:hidden">${days.map(d=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 flex items-center gap-3 ${d.isToday?'ring-2 ring-brand-500 border-brand-300':''}">
      <div class="text-center w-12 shrink-0">
        <p class="text-[9px] font-bold text-charcoal-400 uppercase">${d.day}</p>
        <p class="text-lg font-bold ${d.isToday?'text-brand-600':'text-charcoal-900'}">${d.dayNum}</p>
      </div>
      <div class="w-px h-8 bg-charcoal-200"></div>
      <div class="flex-1">
        ${d.isOff
          ?`<p class="text-xs font-medium text-charcoal-400">OFF DAY</p>`
          :`<p class="text-xs font-semibold text-charcoal-900">${d.shiftName} Shift</p><p class="text-[10px] text-charcoal-500">${d.start} – ${d.end}</p>`
        }
      </div>
      <div>
        ${d.isOff
          ?`<span class="inline-flex w-8 h-8 rounded-lg items-center justify-center schedule-shift-off"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg></span>`
          :`<span class="inline-flex w-8 h-8 rounded-lg items-center justify-center ${shiftCellClass(d)}"><span class="text-[10px] font-bold">${d.shiftName[0]}</span></span>`
        }
      </div>
      ${d.isToday?'<span class="text-[9px] font-bold text-brand-600 uppercase">Now</span>':''}
    </div>`).join('')}</div>
  </div>`;
}
function navigateCycle(dir) { const n=state.currentCycleIndex+dir; if(n>=0&&n<MOCK.scheduleCycles.length){state.currentCycleIndex=n;renderAll();} }
