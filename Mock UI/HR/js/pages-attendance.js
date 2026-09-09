// ==================== ATTENDANCE ====================
function renderAttendance() {
  const showAll = DEMO.showAll;
  const canEdit = showAll || hasPermission('attendance.edit');
  const canManual = showAll || hasPermission('attendance.manual_entry');
  const records = MOCK.attendanceRecords;
  const onTime = records.filter(r => r.status === 'On Time').length;
  const late = records.filter(r => r.status === 'Late').length;
  const absent = records.filter(r => r.status === 'Absent').length;
  const off = records.filter(r => r.status === 'Off').length;
  const total = records.length;
  const present = onTime + late;
  const attRate = Math.round((present / mathMax(total, 1)) * 100);

  const weekTrend = [88, 91, 84, 93, 76, 89, attRate];
  const weekLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'Now'];
  const lateEmp = MOCK.teamMembers.filter(t => t.status === 'Late');

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Attendance</h1><p class="text-xs text-charcoal-500 mt-0.5">Sep 9, 2026 · ${total} records · ${present} present</p></div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <select class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>All Gyms</option><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select>
        <input type="date" class="form-input" style="padding:0.375rem 0.625rem;font-size:0.8125rem;width:auto" value="2026-09-09">
        ${canManual ? `<button onclick="openManualEntry()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Manual Entry</button>` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 border-l-4 border-l-brand-500"><p class="text-lg font-bold text-brand-600">${onTime}</p><p class="text-[10px] text-charcoal-500">On Time</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3"><p class="text-lg font-bold text-yellow-600">${late}</p><p class="text-[10px] text-charcoal-500">Late</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3"><p class="text-lg font-bold text-red-600">${absent}</p><p class="text-[10px] text-charcoal-500">Absent</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3"><p class="text-lg font-bold text-blue-600">${off}</p><p class="text-[10px] text-charcoal-500">Off Day</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3"><p class="text-lg font-bold text-charcoal-900">${attRate}%</p><p class="text-[10px] text-charcoal-500">Attendance Rate</p></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <!-- Trend chart -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden lg:col-span-2">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50"><p class="bento-label">ATTENDANCE RATE — WEEKLY</p><span class="badge badge-brand text-[9px]">${attRate}% today</span></div>
        <div class="p-3 flex items-end gap-2 h-40">
          ${weekTrend.map((pct, i) => `<div class="flex-1 flex flex-col items-center gap-1 justify-end h-full">
            <span class="text-[8px] text-charcoal-400">${pct}%</span>
            <div class="w-full rounded-t-md ${i === weekTrend.length - 1 ? 'bg-gradient-to-t from-brand-500 to-brand-300' : 'bg-brand-200'}" style="height:${pct}%"></div>
            <span class="text-[8px] text-charcoal-400">${weekLabels[i]}</span>
          </div>`).join('')}
        </div>
      </div>

      <!-- Repeated-issue flagging -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden border-l-4 border-l-orange-400">
        <div class="px-4 py-2.5 border-b border-charcoal-100 bg-orange-50/40"><p class="bento-label text-orange-700">REPEATED-ISSUE FLAGGING</p></div>
        <div class="divide-y divide-charcoal-50">
          <div class="p-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">OY</div>
              <div><p class="text-xs font-medium text-charcoal-900">Omar Youssef</p><p class="text-[10px] text-charcoal-500">3rd late arrival this month</p></div>
            </div>
            <span class="badge badge-orange">3x</span>
          </div>
          <div class="p-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">YA</div>
              <div><p class="text-xs font-medium text-charcoal-900">Yasmin Adel</p><p class="text-[10px] text-charcoal-500">Absent without notification</p></div>
            </div>
            <span class="badge badge-red">Attention</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop Table -->
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Gym</th><th>Shift</th><th>Check In</th><th>Check Out</th><th>Source</th><th>Status</th><th></th></tr></thead>
      <tbody>${records.map(r => `<tr>
        <td><div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${r.name.split(' ').map(w => w[0]).join('')}</div><div><p class="text-xs font-medium text-charcoal-900">${r.name}</p><p class="text-[10px] text-charcoal-500">${r.employeeId}</p></div></div></td>
        <td class="text-xs">${r.gym}</td>
        <td class="text-xs">${r.shift}</td>
        <td class="text-xs">${r.checkIn || '—'}</td>
        <td class="text-xs">${r.checkOut || '—'}</td>
        <td class="text-xs">${r.source}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${canEdit ? `<button onclick="openAttendanceCorrection('${r.employeeId}')" class="btn btn-sm btn-ghost"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Correct</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>
    </div>

    <!-- Mobile Cards -->
    <div class="space-y-1.5 lg:hidden">${records.map(r => `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5"><div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${r.name.split(' ').map(w => w[0]).join('')}</div><div><p class="text-xs font-medium text-charcoal-900">${r.name}</p><p class="text-[10px] text-charcoal-500">${r.gym} · ${r.shift}</p></div></div>
        ${statusBadge(r.status)}
      </div>
      <div class="flex justify-between mt-2 text-[10px] text-charcoal-500"><span>In: ${r.checkIn || '—'}</span><span>Out: ${r.checkOut || '—'}</span>${canEdit ? `<button onclick="openAttendanceCorrection('${r.employeeId}')" class="btn btn-sm btn-ghost text-[9px] p-0.5">Correct</button>` : ''}</div>
    </div>`).join('')}</div>

    ${!canEdit ? `<p class="text-[10px] text-charcoal-400 text-center">Manual correction is hidden — you do not have <code>attendance.edit</code>.</p>` : ''}
  </div>`;
}
function mathMax(a, b) { return (a > b ? a : b); }

function openAttendanceCorrection(id) {
  const r = MOCK.attendanceRecords.find(x => x.employeeId === id);
  if (!r) return;
  openModal(`Attendance Correction — ${r.name}`, `<form onsubmit="event.preventDefault();showToast('Correction saved (audit-logged)');closeModal();" class="space-y-3">
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      <p class="text-xs text-yellow-800">Correcting attendance is tracked in the audit log. Current check-in: <strong>${r.checkIn || '—'}</strong>, status: <strong>${r.status}</strong>.</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label">Check In</label><input type="time" class="form-input" value="${r.checkIn || '08:00'}"></div>
      <div><label class="form-label">Check Out</label><input type="time" class="form-input" value="${r.checkOut || '16:00'}"></div>
    </div>
    <div><label class="form-label">Status</label><select class="form-select"><option>On Time</option><option>Late</option><option>Absent</option><option>Early Checkout</option></select></div>
    <div><label class="form-label">Reason (required)</label><textarea class="form-input" rows="2" placeholder="Reason for the correction..." required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Correction</button></div>
  </form>`);
}

function openManualEntry() {
  const empOpts = MOCK.employees.filter(e => e.status === 'Active').map(e => `<option>${e.name}</option>`).join('');
  openModal('Manual Attendance Entry', `<form onsubmit="event.preventDefault();showToast('Manual entry recorded & audit-logged');closeModal();" class="space-y-3">
    <div class="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="text-xs text-brand-800">Manually record attendance when the biometric terminal fails. This action is audit-logged with your name.</p>
    </div>
    <div><label class="form-label">Employee</label><select class="form-select">${empOpts}</select></div>
    <div class="grid grid-cols-3 gap-3">
      <div><label class="form-label">Date</label><input type="date" class="form-input" value="2026-09-09"></div>
      <div><label class="form-label">Check In</label><input type="time" class="form-input" value="08:00"></div>
      <div><label class="form-label">Check Out</label><input type="time" class="form-input" value="16:00"></div>
    </div>
    <div><label class="form-label">Reason for manual entry</label><textarea class="form-input" rows="2" placeholder="e.g. Biometric terminal out of service" required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Record Entry</button></div>
  </form>`);
}