// ==================== SHIFTS & SCHEDULE ====================
let _schedCycle = 'c4';
let _selectedDay = 1; // 0=Mon..6=Sun, default today (Tue)

function renderSchedule() {
  const showAll = DEMO.showAll;
  const canEdit = showAll || hasPermission('schedule.manage');
  const cm = MOCK.scheduleCycles.find(c => c.id === _schedCycle) || MOCK.scheduleCycles[0];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayDates = ['Sep 3', 'Sep 4', 'Sep 5', 'Sep 6', 'Sep 7', 'Sep 8', 'Sep 9'];
  const todayIdx = 1;
  const tmplById = {};
  MOCK.shiftTemplates.forEach(t => { tmplById[t.id] = t; });

  // --- Build per-day summary data ---
  const daySummaries = days.map((d, di) => {
    const onShift = MOCK.teamMembers.filter(tm => {
      const tmpl = MOCK.teamSchedule[tm.id] || [];
      const t = tmplById[tmpl[di]];
      return t && !t.isOff;
    });
    const offDay = MOCK.teamMembers.filter(tm => {
      const tmpl = MOCK.teamSchedule[tm.id] || [];
      const t = tmplById[tmpl[di]];
      return t && t.isOff;
    });
    const dayReqs = MOCK.requests.filter(r => {
      const rDate = r.requestedDate || '';
      return rDate.includes(dayDates[di].replace('Sep ', 'Sep '));
    });
    const morning = onShift.filter(tm => { const t = tmplById[(MOCK.teamSchedule[tm.id]||[])[di]]; return t && t.name === 'Morning'; });
    const evening = onShift.filter(tm => { const t = tmplById[(MOCK.teamSchedule[tm.id]||[])[di]]; return t && t.name === 'Evening'; });
    const night = onShift.filter(tm => { const t = tmplById[(MOCK.teamSchedule[tm.id]||[])[di]]; return t && t.name === 'Night'; });
    return { day: d, date: dayDates[di], di, onShift, offDay, dayReqs, morning, evening, night, total: onShift.length, off: offDay.length };
  });

  // --- Compact calendar day cards ---
  const calendarCards = daySummaries.map((ds, di) => {
    const isSelected = di === _selectedDay;
    const isToday = di === todayIdx;
    const hasReqs = ds.dayReqs.length > 0;
    return `<div class="sched-day-card ${isSelected ? 'sched-day-selected' : ''} ${isToday ? 'sched-day-today' : ''}" onclick="_selectedDay=${di};renderAll();">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[10px] font-semibold ${isToday ? 'text-brand-600' : 'text-charcoal-700'}">${ds.day}</span>
        ${isToday ? '<span class="text-[7px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full font-semibold">TODAY</span>' : ''}
      </div>
      <p class="text-[9px] text-charcoal-400 mb-2">${ds.date}</p>
      <div class="space-y-1 mb-2">
        ${ds.morning.length > 0 ? `<div class="flex items-center gap-1"><span class="sched-dot" style="background:#2563eb"></span><span class="text-[9px] text-charcoal-600">Morning <span class="font-medium text-charcoal-800">${ds.morning.length}</span></span></div>` : ''}
        ${ds.evening.length > 0 ? `<div class="flex items-center gap-1"><span class="sched-dot" style="background:#006c49"></span><span class="text-[9px] text-charcoal-600">Evening <span class="font-medium text-charcoal-800">${ds.evening.length}</span></span></div>` : ''}
        ${ds.night.length > 0 ? `<div class="flex items-center gap-1"><span class="sched-dot" style="background:#7c3aed"></span><span class="text-[9px] text-charcoal-600">Night <span class="font-medium text-charcoal-800">${ds.night.length}</span></span></div>` : ''}
      </div>
      <div class="flex items-center justify-between pt-1.5 border-t border-charcoal-100">
        <span class="text-[8px] text-charcoal-400">${ds.total} on · ${ds.off} off</span>
        ${hasReqs ? `<span class="text-[8px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">${ds.dayReqs.length} req</span>` : ''}
      </div>
    </div>`;
  }).join('');

  // --- Detail panel (left side) ---
  const ds = daySummaries[_selectedDay];
  const detailPanel = `<div class="sched-detail-panel">
    <div class="mb-3">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-sm font-bold text-charcoal-900">${ds.day} <span class="font-normal text-charcoal-400">${ds.date}</span></h3>
        ${_selectedDay === todayIdx ? '<span class="text-[9px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">Today</span>' : ''}
      </div>
      <p class="text-[10px] text-charcoal-500">${ds.total} employees on shift · ${ds.off} off</p>
    </div>

    <!-- Shift breakdown -->
    ${ds.morning.length > 0 ? `<div class="mb-3">
      <div class="flex items-center gap-1.5 mb-1.5"><span class="w-2 h-2 rounded-full" style="background:#2563eb"></span><p class="text-[10px] font-semibold text-charcoal-700 uppercase tracking-wide">Morning Shift · 08:00 – 16:00</p></div>
      <div class="space-y-1">${ds.morning.map(tm => {
        const att = MOCK.attendanceRecords.find(a => a.name === tm.name);
        return `<div class="sched-detail-row">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[8px] font-semibold flex-shrink-0">${tm.initials || tm.name.split(' ').map(w=>w[0]).join('')}</div>
            <div class="min-w-0"><p class="text-[11px] font-medium text-charcoal-900 truncate">${tm.name}</p><p class="text-[9px] text-charcoal-400">${tm.position} · ${tm.gym}</p></div>
          </div>
          <div class="text-right flex-shrink-0">
            ${att ? `<p class="text-[10px] text-charcoal-600">In: <span class="font-medium ${att.status==='Late'?'text-yellow-600':'text-charcoal-800'}">${att.checkIn || '—'}</span></p>
            <p class="text-[10px] text-charcoal-600">Out: <span class="font-medium">${att.checkOut || '—'}</span></p>` : '<p class="text-[9px] text-charcoal-400">No record</p>'}
          </div>
        </div>`;
      }).join('')}</div>
    </div>` : ''}

    ${ds.evening.length > 0 ? `<div class="mb-3">
      <div class="flex items-center gap-1.5 mb-1.5"><span class="w-2 h-2 rounded-full" style="background:#006c49"></span><p class="text-[10px] font-semibold text-charcoal-700 uppercase tracking-wide">Evening Shift · 16:00 – 00:00</p></div>
      <div class="space-y-1">${ds.evening.map(tm => {
        const att = MOCK.attendanceRecords.find(a => a.name === tm.name);
        return `<div class="sched-detail-row">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[8px] font-semibold flex-shrink-0">${tm.initials || tm.name.split(' ').map(w=>w[0]).join('')}</div>
            <div class="min-w-0"><p class="text-[11px] font-medium text-charcoal-900 truncate">${tm.name}</p><p class="text-[9px] text-charcoal-400">${tm.position} · ${tm.gym}</p></div>
          </div>
          <div class="text-right flex-shrink-0">
            ${att ? `<p class="text-[10px] text-charcoal-600">In: <span class="font-medium ${att.status==='Late'?'text-yellow-600':'text-charcoal-800'}">${att.checkIn || '—'}</span></p>
            <p class="text-[10px] text-charcoal-600">Out: <span class="font-medium">${att.checkOut || '—'}</span></p>` : '<p class="text-[9px] text-charcoal-400">No record</p>'}
          </div>
        </div>`;
      }).join('')}</div>
    </div>` : ''}

    ${ds.night.length > 0 ? `<div class="mb-3">
      <div class="flex items-center gap-1.5 mb-1.5"><span class="w-2 h-2 rounded-full" style="background:#7c3aed"></span><p class="text-[10px] font-semibold text-charcoal-700 uppercase tracking-wide">Night Shift · 00:00 – 08:00</p></div>
      <div class="space-y-1">${ds.night.map(tm => `<div class="sched-detail-row">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[8px] font-semibold flex-shrink-0">${tm.initials || tm.name.split(' ').map(w=>w[0]).join('')}</div>
          <div class="min-w-0"><p class="text-[11px] font-medium text-charcoal-900 truncate">${tm.name}</p><p class="text-[9px] text-charcoal-400">${tm.position} · ${tm.gym}</p></div>
        </div>
      </div>`).join('')}</div>
    </div>` : ''}

    ${ds.offDay.length > 0 ? `<div class="mb-3">
      <div class="flex items-center gap-1.5 mb-1.5"><span class="w-2 h-2 rounded-full" style="background:#6b7280"></span><p class="text-[10px] font-semibold text-charcoal-700 uppercase tracking-wide">Off Day</p></div>
      <div class="flex flex-wrap gap-1">${ds.offDay.map(tm => `<span class="text-[9px] bg-charcoal-50 text-charcoal-600 px-2 py-0.5 rounded-full">${tm.name.split(' ')[0]}</span>`).join('')}</div>
    </div>` : ''}

    <!-- Requests for this day -->
    <div class="mb-2">
      <div class="flex items-center gap-1.5 mb-1.5">
        <svg class="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <p class="text-[10px] font-semibold text-charcoal-700 uppercase tracking-wide">Requests</p>
      </div>
      ${ds.dayReqs.length > 0 ? `<div class="space-y-1">${ds.dayReqs.map(r => `<div class="bg-orange-50 border border-orange-100 rounded-lg p-2">
        <div class="flex items-center justify-between mb-0.5">
          <p class="text-[10px] font-medium text-charcoal-900">${r.employee}</p>
          <span class="text-[8px] px-1.5 py-0.5 rounded-full ${r.status.includes('Pending') ? 'bg-yellow-100 text-yellow-700' : r.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${r.status}</span>
        </div>
        <p class="text-[9px] text-charcoal-500">${r.type} · ${r.reason}</p>
      </div>`).join('')}</div>` : '<p class="text-[10px] text-charcoal-400 italic">No requests for this day</p>'}
    </div>
  </div>`;

  const legend = MOCK.shiftTemplates.map(t => `<span class="inline-flex items-center gap-1 text-[9px] text-charcoal-600"><span class="w-2.5 h-2.5 rounded" style="background:${t.isOff?'#f1f3f5':t.bgColor};border:${t.isOff?'1px solid #e9ecef':'1px solid '+t.color+'33'}"></span> ${t.name}</span>`).join('');

  return `<div class="flex flex-col h-full min-h-0 gap-1.5">
    <!-- Header: Title + Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 flex-shrink-0">
      <div>
        <h1 class="text-sm font-bold text-charcoal-900 leading-tight">Shifts & Schedule</h1>
        <p class="text-[10px] text-charcoal-500">Cycle ${cm.label} · <span class="font-medium text-brand-700">${cm.status}</span> · Click any day</p>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${canEdit ? `<button onclick="openNewCycle()" class="btn btn-sm btn-primary h-7 text-[10px] px-2.5">New Cycle</button><button onclick="copyPreviousCycle()" class="btn btn-sm btn-secondary h-7 text-[10px] px-2.5">Copy Previous</button>` : ''}
        <button onclick="publishSchedule()" class="btn btn-sm ${cm.status === 'Published' ? 'btn-disabled' : (canEdit ? 'btn-success' : 'btn-disabled')} h-7 text-[10px] px-2.5" ${!canEdit || cm.status === 'Published' ? 'disabled' : ''}>${cm.status === 'Published' ? 'Published' : 'Publish'}</button>
      </div>
    </div>

    <!-- Integrated Toolbar: Cycle Selector + Coverage Stats + Conflict Pill -->
    <div class="bg-white rounded-lg border border-charcoal-200 px-2 py-1 flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
      <div class="flex items-center gap-1 overflow-x-auto py-0.5">
        ${MOCK.scheduleCycles.map(c => `<button onclick="_schedCycle='${c.id}';renderAll()" class="px-2 py-0.5 rounded border text-[9px] font-medium whitespace-nowrap ${c.id === _schedCycle ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-charcoal-200 text-charcoal-500'}">${c.label}</button>`).join('')}
      </div>

      <div class="flex items-center gap-2 text-[10px]">
        <span class="stat-pill"><span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span><strong class="text-brand-700">10/10</strong> Scheduled</span>
        <span class="stat-pill"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span><strong class="text-red-700">2</strong> Conflicts</span>
        <span class="badge badge-red text-[8px]">Overlapping shifts flagged</span>
      </div>
    </div>

    <!-- Main layout: Day Detail Panel + Calendar & Roster (fills 100% of viewport) -->
    <div class="flex flex-col lg:flex-row gap-1.5 flex-1 min-h-0">
      <!-- Left: Day detail panel -->
      ${detailPanel}

      <!-- Right: Compact weekly calendar + Team Roster -->
      <div class="flex-1 min-w-0 flex flex-col min-h-0 gap-1.5">
        <!-- Calendar cards -->
        <div class="bg-white rounded-lg border border-charcoal-200 overflow-hidden flex-shrink-0">
          <div class="px-3 py-1 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50">
            <p class="bento-label text-charcoal-500">WEEKLY OVERVIEW</p>
            <div class="flex items-center gap-2">
              <select class="form-select w-auto h-6 text-[9px] py-0"><option>All Gyms</option><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select>
            </div>
          </div>
          <div class="p-1.5 grid grid-cols-7 gap-1">${calendarCards}</div>
          <div class="px-2.5 py-1 border-t border-charcoal-100 flex flex-wrap gap-2 text-[8px]">${legend}</div>
        </div>

        <!-- Employee roster (fills remaining space) -->
        <div class="bg-white rounded-lg border border-charcoal-200 overflow-hidden hidden lg:flex flex-col flex-1 min-h-0">
          <div class="px-3 py-1 border-b border-charcoal-100 bg-charcoal-50/50 flex items-center justify-between flex-shrink-0">
            <p class="bento-label text-charcoal-500">TEAM ROSTER — ALL SHIFTS</p>
            <span class="text-[9px] text-charcoal-400">${ds.day}</span>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto">
            <table class="data-table">
              <thead class="sticky top-0 z-10 bg-[#f9f9ff]"><tr><th>Employee</th><th>Position</th><th>Gym</th><th>Shift</th><th>Hours</th></tr></thead>
              <tbody>
                ${MOCK.teamMembers.map(tm => {
                  const tmpl = MOCK.teamSchedule[tm.id] || [];
                  const t = tmplById[tmpl[_selectedDay]] || MOCK.shiftTemplates[3];
                  return `<tr>
                    <td><div class="flex items-center gap-1.5"><div class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[9px] font-semibold">${tm.initials || tm.name.split(' ').map(w=>w[0]).join('')}</div><span class="text-[11px] font-medium text-charcoal-900">${tm.name}</span></div></td>
                    <td class="text-[10px] text-charcoal-600">${tm.position}</td>
                    <td class="text-[10px] text-charcoal-600">${tm.gym}</td>
                    <td><span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-medium" style="background:${t.isOff?'#f1f3f5':t.bgColor};color:${t.isOff?'#6c7a71':t.textColor};border:1px solid ${t.isOff?'#e9ecef':t.color+'33'}">${t.isOff ? 'Off Day' : t.name} ${!t.isOff ? `<span class="opacity-60">${t.start}–${t.end}</span>` : ''}</span></td>
                    <td class="text-[10px] ${t.isOff?'text-charcoal-400':'text-charcoal-600'}">${t.isOff ? '—' : `${t.start} – ${t.end}`}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    ${!canEdit ? `<p class="text-[9px] text-charcoal-400 text-center flex-shrink-0">Cycle editing / publish is hidden — view-only.</p>` : ''}
  </div>`;
}

function copyPreviousCycle() {
  openModal('Copy Previous Cycle', `<div class="space-y-3">
    <div class="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3m5-8a2 2 0 00-2-2h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2V7z"/></svg>
      <p class="text-xs text-brand-800">Copy assignments from <strong>Sep 3 – Sep 12 (previous cycle)</strong> into the current cycle as a starting draft. Conflicts will be flagged for manual review.</p>
    </div>
    <div class="flex items-center justify-between bg-charcoal-50 rounded-lg p-2.5">
      <p class="text-xs text-charcoal-700 font-medium">Copy ${MOCK.teamMembers.length} employee assignments?</p>
      <div class="flex gap-1.5"><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="showToast('Previous cycle copied as draft');closeModal();" class="btn btn-sm btn-primary">Copy</button></div>
    </div>
  </div>`);
}

function publishSchedule() {
  openModal('Publish Schedule', `<div class="space-y-3">
    <div class="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="text-xs text-brand-800">Publishing this cycle notifies all ${MOCK.teamMembers.length} employees of their shifts for the week. Employees can then confirm availability.</p>
    </div>
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-[11px] text-yellow-800"><strong>2</strong> conflict(s) remain unresolved. Publishing will push the schedule with flagged conflicts still visible to employees.</div>
    <div class="flex justify-end gap-2 pt-1"><button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="showToast('Schedule published & notifications sent');closeModal();" class="btn btn-sm btn-success">Publish Now</button></div>
  </div>`);
}

function openNewCycle() {
  openModal('New Schedule Cycle', `<form onsubmit="event.preventDefault();showToast('Cycle created as draft');closeModal();" class="space-y-3">
    <div><label class="form-label">Cycle Label</label><input class="form-input" value="Sep 13 – Sep 22"></div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Start</label><input type="date" class="form-input" value="2026-09-13"></div>
      <div><label class="form-label">End</label><input type="date" class="form-input" value="2026-09-22"></div>
    </div>
    <div><label class="form-label">Gym</label><select class="form-select"><option>All Gyms</option><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Create Draft Cycle</button></div>
  </form>`);
}

function editShift(empId, day) {
  const tm = MOCK.teamMembers.find(x => x.id === empId); if (!tm) return;
  const tmpl = MOCK.teamSchedule[tm.id] || [];
  const current = MOCK.shiftTemplates.find(t => t.id === (tmpl[day])) || MOCK.shiftTemplates[0];
  const options = MOCK.shiftTemplates.map(t => `<option ${t.id === current.id ? 'selected' : ''}>${t.name}</option>`).join('');
  openModal(`Edit Shift — ${tm.name}`, `<form onsubmit="event.preventDefault();showToast('Shift updated');closeModal();" class="space-y-3">
    <div class="bg-charcoal-50 rounded-lg p-2.5 text-xs text-charcoal-600">Day <strong>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][day]}</strong> · Current: <strong>${current.name}</strong></div>
    <div><label class="form-label">Shift</label><select id="shSel" class="form-select">${options}</select></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save</button></div>
  </form>`);
}