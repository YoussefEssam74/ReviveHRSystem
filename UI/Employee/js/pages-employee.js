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
            <div class="action-alert-item cursor-pointer" onclick="navigateTo('documents')">
              <svg class="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
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

    ${hasMgmt?`<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between mb-2">
        <p class="bento-label">MANAGEMENT OVERVIEW</p>
        <button onclick="navigateTo('team-overview')" class="text-[11px] text-brand-600 font-semibold hover:underline">View Team</button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div class="text-center p-2 rounded-lg bg-charcoal-50"><p class="text-lg font-bold text-charcoal-900">${MOCK.teamStats.total}</p><p class="text-[10px] text-charcoal-500">Team Members</p></div>
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
function renderDocuments() {
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">My Documents</h1><p class="text-xs text-charcoal-500 mt-0.5">${MOCK.documents.length} documents on file</p></div>
      <button onclick="openUploadModal()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Upload</button>
    </div>

    <!-- Search & Filters -->
    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex flex-col sm:flex-row gap-2">
        <div class="flex-1 relative">
          <svg class="w-4 h-4 text-charcoal-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" class="form-input" placeholder="Search documents..." style="padding:0.375rem 0.625rem 0.375rem 2rem;font-size:0.8125rem">
        </div>
        <select class="form-select w-full sm:w-36" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>All Categories</option></select>
        <select class="form-select w-full sm:w-32" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>All Status</option></select>
      </div>
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
function openUploadModal() {
  openModal('Upload Document',`<form onsubmit="event.preventDefault();closeModal();showToast('Document uploaded successfully');" class="space-y-3"><div><label class="form-label">Document Type</label><select class="form-select" required><option value="">Select...</option><option>Employment</option><option>Identification</option><option>Certification</option><option>Medical</option><option>Education</option></select></div><div><label class="form-label">Document Name</label><input type="text" class="form-input" placeholder="e.g. Updated Certification" required></div><div><label class="form-label">File</label><div class="border-2 border-dashed border-charcoal-200 rounded-lg p-6 text-center hover:border-brand-400 cursor-pointer transition-colors"><svg class="w-6 h-6 text-charcoal-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg><p class="text-xs text-charcoal-500">Click to upload or drag & drop</p><p class="text-[10px] text-charcoal-400 mt-0.5">PDF, JPG, PNG up to 10MB</p></div></div><div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Upload</button></div></form>`,{wide:true});
}

// ==================== EMPLOYMENT HISTORY ====================
function renderHistory() {
  return `<div class="space-y-3 max-w-2xl"><h1 class="text-xl font-bold text-charcoal-900">Employment History</h1>
    <div class="relative"><div class="timeline-line"></div><div class="space-y-5">${MOCK.employmentHistory.map(m=>`<div><p class="text-[10px] font-semibold text-charcoal-400 uppercase tracking-wider mb-2 pl-8">${m.month}</p>${m.events.map(e=>`<div class="flex gap-3 mb-4"><div class="flex flex-col items-center flex-shrink-0"><div class="timeline-dot"></div></div><div class="card p-3 flex-1"><div class="flex items-center gap-1.5 mb-1"><svg class="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${e.icon==='briefcase'?'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z':e.icon==='building'?'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4':e.icon==='shield'?'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z':'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'}"/></svg><h3 class="text-xs font-semibold text-charcoal-900">${e.type}</h3></div>${e.from&&e.to?`<div class="flex items-center gap-1 text-xs mb-1"><span class="text-charcoal-500">${e.from}</span><svg class="w-3 h-3 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg><span class="font-medium text-charcoal-900">${e.to}</span></div>`:''}<p class="text-[10px] text-charcoal-500 mb-1">${e.effective}</p><p class="text-xs text-charcoal-600">${e.detail}</p>${e.extra?`<div class="flex flex-wrap gap-3 mt-2 text-xs">${e.extra.map(x=>`<span class="text-charcoal-500">${x.label}: <span class="font-medium text-charcoal-900">${x.value}</span></span>`).join('')}</div>`:''}</div></div>`).join('')}</div>`).join('')}</div></div>
  </div>`;
}

// ==================== ATTENDANCE ====================
function renderAttendance() {
  const s=MOCK.attendanceSummary;
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">My Attendance</h1><p class="text-xs text-charcoal-500 mt-0.5">August 2026 · ${s.rate}% attendance rate</p></div>
      <select class="form-select w-36" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>August 2026</option><option>July 2026</option></select>
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

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block"><div class="table-responsive"><table class="data-table"><thead><tr><th>Date</th><th>Shift</th><th>Check In</th><th>Check Out</th><th>Status</th><th></th></tr></thead><tbody>${MOCK.attendanceRecords.map(r=>`<tr class="cursor-pointer ${r.date===MOCK.attendanceRecords[0]?.date?'bg-brand-50/50':''}" onclick="openAttDetail('${r.date}')"><td class="text-xs font-medium">${formatDate(r.date)}</td><td class="text-xs">${r.shift}</td><td class="text-xs">${r.checkIn||'—'}</td><td class="text-xs">${r.checkOut||'—'}</td><td>${statusBadge(r.status)}</td><td><svg class="w-3.5 h-3.5 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td></tr>`).join('')}</tbody></table></div></div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${MOCK.attendanceRecords.map(r=>`<div class="bg-white rounded-xl border border-charcoal-200 p-3 card-interactive" onclick="openAttDetail('${r.date}')"><div class="flex items-center justify-between"><div><p class="text-xs font-medium text-charcoal-900">${formatDate(r.date)}</p><p class="text-[10px] text-charcoal-500">${r.shift}</p></div>${statusBadge(r.status)}</div><div class="flex gap-4 mt-1.5 text-[10px] text-charcoal-500"><span class="flex items-center gap-1"><svg class="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>In: ${r.checkIn||'—'}</span><span class="flex items-center gap-1"><svg class="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Out: ${r.checkOut||'—'}</span></div></div>`).join('')}</div>
  </div>`;
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
