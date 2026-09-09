// ==================== SHIFTS & SCHEDULE ====================
let _schedCycle = 'c4';

function renderSchedule() {
  const showAll = DEMO.showAll;
  const canEdit = showAll || hasPermission('schedule.edit');
  const cm = MOCK.scheduleCycles.find(c => c.id === _schedCycle) || MOCK.scheduleCycles[0];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIdx = 1;

  const cols = days.map((d, di) => `<th class="p-2 text-left text-[9px] uppercase tracking-wide text-charcoal-500 whitespace-nowrap">${d}<p class="text-[8px] text-charcoal-400">${di < 5 ? `Sep ${3 + di}` : `Sep ${8 + di - 5}`}</p>${di === todayIdx ? ' <span class="text-brand-600">●</span>' : ''}</th>`).join('');

  const tmplById = {};
  MOCK.shiftTemplates.forEach(t => { tmplById[t.id] = t; });
  const shiftShort = { 'Morning': 'M', 'Evening': 'E', 'Night': 'N', 'Off Day': '—' };
  const shortMap = MOCK.shiftTemplates.reduce((m, t) => { m[t.name] = t.isOff ? '—' : t.name[0]; return m; }, {});

  const rows = MOCK.teamMembers.map(tm => {
    const tmpl = MOCK.teamSchedule[tm.id] || [];
    const cell = (tid) => {
      const t = tmplById[tid] || MOCK.shiftTemplates[3];
      const txt = t.isOff ? '—' : t.name[0];
      return `<div class="rounded-lg border px-1 py-1.5 text-center text-[9px] font-medium ${canEdit?'cursor-pointer':''}" style="background:${t.isOff?'#f1f3f5':t.bgColor};color:${t.isOff?'#6c7a71':t.textColor};border-color:${t.isOff?'#e9ecef':t.color}33" ${canEdit?`onclick="editShift('${tm.id}',${tmpl.indexOf(tid)})"`:''}>${txt}${t.isOff?'':` <span class="opacity-60">${t.start ? t.start.slice(0,2) : ''}</span>`}</div>`;
    };
    return `<tr>
      <td class="p-2"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${tm.initials || tm.name.split(' ').map(w => w[0]).join('')}</div><div><p class="text-[11px] font-medium text-charcoal-900 whitespace-nowrap">${tm.name}</p><p class="text-[9px] text-charcoal-500 whitespace-nowrap">${tm.position} · ${tm.gym}</p></div></div></td>
      ${days.map((d, di) => `<td class="p-1">${cell(tmpl[di])}</td>`).join('')}
    </tr>`;
  }).join('');

  const legend = MOCK.shiftTemplates.map(t => `<span class="inline-flex items-center gap-1 text-[9px] text-charcoal-600"><span class="w-2.5 h-2.5 rounded" style="background:${t.isOff?'#f1f3f5':t.bgColor};border:${t.isOff?'1px solid #e9ecef':'1px solid '+t.color+'33'}"></span> ${t.name}</span>`).join('');

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Shifts & Schedule</h1><p class="text-xs text-charcoal-500 mt-0.5">Cycle ${cm.label} · ${cm.status}</p></div>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${canEdit ? `<button onclick="openNewCycle()" class="btn btn-sm btn-primary">New Cycle</button><button onclick="copyPreviousCycle()" class="btn btn-sm btn-secondary">Copy Previous</button>` : ''}
        <button onclick="publishSchedule()" class="btn btn-sm ${cm.status === 'Published' ? 'btn-disabled' : (canEdit ? 'btn-success' : 'btn-disabled')}" ${!canEdit || cm.status === 'Published' ? 'disabled' : ''}>${cm.status === 'Published' ? 'Published' : 'Publish'}</button>
      </div>
    </div>

    <!-- Cycle selector -->
    <div class="flex items-center gap-2 overflow-x-auto py-0.5">
      ${MOCK.scheduleCycles.map(c => `<button onclick="_schedCycle='${c.id}';renderAll()" class="px-3 py-1.5 rounded-lg border text-[10px] font-medium whitespace-nowrap ${c.id === _schedCycle ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-charcoal-200 text-charcoal-500'}">${c.label} · ${c.status}</button>`).join('')}
    </div>

    <!-- Coverage KPIs -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><p class="text-lg font-bold text-brand-600">10<span class="text-[10px] font-normal text-charcoal-400">/10</span></p><p class="text-[10px] text-charcoal-500">Employees Scheduled</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-red-600">2</p><p class="text-[10px] text-charcoal-500">Conflicts</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-green-600">${MOCK.scheduleCycles.filter(c=>c.status==='Published').length}</p><p class="text-[10px] text-charcoal-500">Published Cycles</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-charcoal-900">0</p><p class="text-[10px] text-charcoal-500">Unconfirmed Shifts</p></div>
    </div>

    <!-- Conflict warnings -->
    <div class="bg-white rounded-xl border border-red-200 border-l-4 border-l-red-500 p-3">
      <p class="bento-label text-red-600 mb-1">CONFLICT WARNING</p>
      <p class="text-[11px] text-charcoal-600">2 employees have overlapping shifts in this cycle. Review <strong>Karim Hassan</strong> (Evening/Night) and <strong>Sara Ali</strong> (Morning/Evening on Tue).</p>
    </div>

    <!-- Weekly grid -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between">
        <p class="bento-label text-charcoal-500">WEEKLY ASSIGNMENTS</p>
        <select class="form-select w-auto" style="padding:0.25rem 2rem 0.25rem 0.5rem;font-size:0.75rem"><option>All Gyms</option><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select>
      </div>
      <div class="table-responsive"><table class="data-table"><thead><tr><th class="p-2 text-left text-[9px] uppercase tracking-wide text-charcoal-500">Employee</th>${cols}</tr></thead><tbody>${rows}<tr class="bg-charcoal-50/70 border-t border-charcoal-100">
        <td class="p-2"><p class="text-[10px] font-semibold text-charcoal-700">SHIFT COVERAGE</p></td>
        ${days.map((d, di) => {
          const counts = MOCK.shiftTemplates.filter(t=>!t.isOff).map(t => ({
            n: MOCK.teamMembers.filter(tm => (MOCK.teamSchedule[tm.id]||[])[di] === t.id).length,
            name: t.name[0]
          }));
          return `<td class="p-2"><div class="flex justify-center gap-1">${counts.map(c=>`<span class="text-[9px] px-1 py-0.5 rounded bg-white border border-charcoal-100 ${c.n===0?'text-charcoal-300':''}">${c.name} ${c.n}</span>`).join('')}</div></td>`;
        }).join('')}
      </tr></tbody></table></div>
      <div class="px-4 py-2 border-t border-charcoal-100 flex flex-wrap gap-2">${legend}</div>
    </div>

    ${!canEdit ? `<p class="text-[10px] text-charcoal-400 text-center">Cycle editing / publish is hidden — you do not have <code>schedule.edit</code>. View-only.</p>` : ''}
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