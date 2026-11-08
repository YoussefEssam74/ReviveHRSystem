// ==================== ATTENDANCE (Roster-first redesign) ====================
// Layout: full roster table on the left (employee · shift · in/out · request · actions),
// month calendar on the right. Row actions live in a floating menu opened by the ⋯ button.

// ---------------- mock "today" + view state ----------------
const ATT_TODAY = '2026-09-09';
let _attMonth = 8;                 // 0-11 — September 2026
let _attYear = 2026;
let _attDay = ATT_TODAY;           // selected ISO date
let _attGym = 'all';
let _attQuery = '';
let _attRowFilter = 'all';         // all | exceptions | requests
let _attDayCache = {};
let _attMenu = null;               // employeeId whose row-actions menu is open
let _attMenuPos = null;            // { top, right } coords relative to the hosting container

const ATT_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ATT_DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ---------------- date helpers ----------------
function mathMax(a, b) { return (a > b ? a : b); }
function attPad(n) { return String(n).padStart(2, '0'); }
function attISO(d) { return d.getFullYear() + '-' + attPad(d.getMonth() + 1) + '-' + attPad(d.getDate()); }
function attFromISO(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function attAddDays(iso, n) { const d = attFromISO(iso); d.setDate(d.getDate() + n); return attISO(d); }
function attDow(iso) { return attFromISO(iso).getDay(); }               // 0=Sun
function attDowIdx(iso) { return (attDow(iso) + 6) % 7; }               // 0=Mon (schedule index)
function attMinutes(hhmm) { if (!hhmm) return null; const p = String(hhmm).split(':'); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); }
function attHm(mins) { mins = ((mins % 1440) + 1440) % 1440; return attPad(Math.floor(mins / 60)) + ':' + attPad(mins % 60); }
function attLongDate(iso) { return attFromISO(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function attShortDate(iso) { return attFromISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function attEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ---------------- deterministic pseudo-random (stable per employee+date) ----------------
function attHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function attRnd(seed) {
  let s = attHash(String(seed));
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- roster ----------------
function attRoster() {
  return (MOCK.teamMembers || []).map(tm => {
    const emp = (MOCK.employees || []).find(e => e.name === tm.name) || {};
    return {
      id: tm.id,
      empId: emp.id || tm.id,
      name: tm.name,
      initials: tm.initials || tm.name.split(' ').map(w => w[0]).join(''),
      position: emp.position || tm.position || 'Staff',
      gym: emp.gym || tm.gym,
      empStatus: emp.status || 'Active'
    };
  });
}
function attGymList() {
  const seen = [];
  attRoster().forEach(r => { if (r.gym && seen.indexOf(r.gym) < 0) seen.push(r.gym); });
  return seen;
}

// ---------------- shifts ----------------
function attShiftOf(entry, iso) {
  const tpls = MOCK.shiftTemplates || [];
  const byId = {}; tpls.forEach(t => { byId[t.id] = t; });
  const sched = (MOCK.teamSchedule || {})[entry.id];
  const idx = attDowIdx(iso);
  if (sched && sched[idx] && byId[sched[idx]]) return byId[sched[idx]];
  const r = attRnd(entry.id + '|shift|' + idx);
  return r() < 0.16 ? (tpls[3] || tpls[0]) : (r() < 0.55 ? (tpls[0] || tpls[0]) : (tpls[1] || tpls[0]));
}
function attShiftLabel(t) { return (!t || t.isOff) ? 'Off' : t.start + '–' + t.end; }
// Scheduled start for a record — prefers the record's own shift string so seeded
// rows keep their real lateness even when the weekly template disagrees.
function attShiftStart(rec, tpl) {
  const s = String((rec && rec.shift) || '');
  const m = s.match(/^(\d{1,2}:\d{2})\s*[–-]\s*\d{1,2}:\d{2}$/);
  if (m) return attMinutes(m[1]);
  if (tpl && !tpl.isOff) return attMinutes(tpl.start);
  return null;
}

// ---------------- requests ----------------
function attReqISO(r) {
  const s = String((r && r.requestedDate) || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : attISO(d);
}
function attRequestsOn(iso) {
  return (MOCK.requests || []).filter(r => attReqISO(r) === iso);
}

// ---------------- attendance record resolution ----------------
function attRealIndex() {
  const idx = {};
  (MOCK.attendanceRecords || []).forEach(r => { idx[r.employeeId + '|' + r.date] = r; });
  return idx;
}
function attGenerate(entry, iso, reqs) {
  const rnd = attRnd(entry.empId + '|' + iso);
  const tpl = attShiftOf(entry, iso);
  const today = iso === ATT_TODAY;
  const past = iso < ATT_TODAY;

  const approvedDayOff = reqs.some(r => r.status === 'Approved' && r.type === 'Day Off');
  const pendingDayOff = reqs.some(r => r.status !== 'Approved' && r.type === 'Day Off');
  const approvedLate = reqs.some(r => r.status === 'Approved' && r.type === 'Late Arrival');
  const approvedEarly = reqs.some(r => r.status === 'Approved' && r.type === 'Leave Early');

  const rec = { employeeId: entry.empId, name: entry.name, gym: entry.gym, date: iso, shift: attShiftLabel(tpl), checkIn: null, checkOut: null, status: 'Off', source: '', notes: '' };

  // Scheduled off, or the day is covered by an approved day-off request.
  if (tpl.isOff) { rec.status = 'Off'; rec.notes = 'Scheduled off'; if (approvedDayOff) rec.notes = 'On approved leave'; return rec; }
  if (approvedDayOff) { rec.status = 'Off'; rec.notes = 'Day Off approved'; return rec; }
  if (entry.empStatus === 'Suspended') { rec.status = 'Absent'; rec.notes = 'Suspended employee'; return rec; }

  // A day that has not happened yet: show the rostered shift, never invent punches.
  if (!past && !today) {
    rec.status = 'Scheduled';
    rec.notes = pendingDayOff ? 'Day Off request pending' : 'Upcoming shift';
    return rec;
  }

  // Roll the punch outcome.
  const roll = rnd();
  if (pendingDayOff) {
    // The request is not approved yet — the gym is short-handed, so the employee was expected.
    rec.status = roll < 0.12 ? 'Absent' : (roll < 0.32 ? 'Late' : 'On Time');
    rec.notes = 'Day Off request still pending';
  } else if (roll < 0.07) {
    rec.status = 'Absent'; rec.notes = 'No punch recorded';
  } else if (roll < 0.26) {
    rec.status = 'Late';
  } else {
    rec.status = 'On Time';
  }

  if (rec.status === 'Absent') {
    if (entry.empStatus === 'On Leave') rec.notes = 'On leave';
    return rec;
  }

  const start = attMinutes(tpl.start);
  let inOffset;
  if (rec.status === 'Late') inOffset = 8 + Math.floor(rnd() * 38);
  else inOffset = -6 + Math.floor(rnd() * 7);
  if (approvedLate) inOffset = 10 + Math.floor(rnd() * 45);
  rec.checkIn = attHm(start + inOffset);
  rec.source = rnd() < 0.06 ? 'Manual' : 'Biometric';

  if (rec.status === 'Late' && approvedLate) rec.notes = 'Late arrival approved';
  if (rec.status === 'Late' && entry.empStatus === 'On Leave') rec.notes = 'On leave';

  // Check-out only once the shift window has actually closed.
  const end = attMinutes(tpl.end);
  const shiftDone = today ? attMinutes('16:00') > end : past;
  if (shiftDone) {
    let outOffset = -8 + Math.floor(rnd() * 24);
    if (approvedEarly) outOffset = -95 - Math.floor(rnd() * 80);
    rec.checkOut = attHm(end + outOffset);
  }
  return rec;
}

// ---------------- per-day aggregation (cached per render) ----------------
function attResetCache() { _attDayCache = {}; }

function attDay(iso) {
  const key = _attGym + '|' + iso;
  if (_attDayCache[key]) return _attDayCache[key];

  const showAll = DEMO.showAll;
  const canEdit = showAll || hasPermission('attendance.edit');
  const real = attRealIndex();
  const dayReqs = attRequestsOn(iso);
  const roster = attRoster().filter(r => _attGym === 'all' || r.gym === _attGym);

  const rows = roster.map(entry => {
    const reqs = dayReqs.filter(q => q.employee === entry.name);
    const tpl = attShiftOf(entry, iso);
    const seeded = real[entry.empId + '|' + iso];
    const rec = seeded ? Object.assign({}, seeded, { shift: seeded.shift || attShiftLabel(tpl) }) : attGenerate(entry, iso, reqs);

    // Derived metrics
    const sMin = attShiftStart(rec, tpl);
    const inMin = attMinutes(rec.checkIn);
    rec._lateBy = (sMin != null && inMin != null) ? inMin - sMin : null;
    const oMin = attMinutes(rec.checkOut);
    rec._worked = (inMin != null && oMin != null) ? (oMin >= inMin ? oMin - inMin : oMin + 1440 - inMin) : null;

    // Conflict detection between the request and what actually happened
    const flags = [];
    reqs.forEach(q => {
      if (q.type === 'Day Off' && q.status === 'Approved' && rec.checkIn) flags.push({ tone: 'red', text: 'Punched in on an approved day off' });
      if (q.type === 'Day Off' && q.status !== 'Approved' && rec.status === 'Absent') flags.push({ tone: 'amber', text: 'Absent — day-off request not approved' });
      if (q.type === 'Day Off' && q.status === 'Rejected' && rec.status === 'Off') flags.push({ tone: 'red', text: 'Off on a rejected request' });
      if (q.type === 'Late Arrival' && q.status === 'Approved' && rec.status === 'On Time') flags.push({ tone: 'brand', text: 'Approved lateness — arrived on time' });
      if (q.type === 'Late Arrival' && q.status !== 'Approved' && rec.status === 'Late') flags.push({ tone: 'amber', text: 'Late without an approved request' });
      if (q.type === 'Leave Early' && q.status === 'Pending HR Review' && rec.checkIn && !rec.checkOut) flags.push({ tone: 'amber', text: 'Leave Early pending — still on the clock' });
      if (q.type === 'Leave Early' && q.status === 'Approved' && rec.checkIn && rec.checkOut) flags.push({ tone: 'brand', text: 'Left early as approved' });
      if (q.type !== 'Day Off' && rec.status === 'Off' && rec.notes === 'Scheduled off') flags.push({ tone: 'amber', text: q.type + ' requested on a scheduled day off' });
    });

    return { entry, rec, tpl, reqs, flags, canEdit };
  });

  const stats = { total: rows.length, onTime: 0, late: 0, absent: 0, off: 0, scheduled: 0, present: 0, hours: 0, exceptions: 0 };
  rows.forEach(r => {
    const s = r.rec.status;
    if (s === 'On Time') stats.onTime++;
    else if (s === 'Late') stats.late++;
    else if (s === 'Absent') stats.absent++;
    else if (s === 'Scheduled') stats.scheduled++;
    else stats.off++;
    if (r.rec._worked) stats.hours += r.rec._worked;
  });
  stats.present = stats.onTime + stats.late;
  stats.exceptions = stats.late + stats.absent;
  const scheduled = mathMax(stats.total - stats.off, 1);
  stats.rate = stats.present === 0 ? null : Math.round((stats.present / scheduled) * 100);
  stats.punctuality = stats.present ? Math.round((stats.onTime / stats.present) * 100) : null;
  stats.avgHours = stats.present ? (stats.hours / stats.present) : 0;

  const out = { iso, rows, stats, requests: dayReqs, dow: attDow(iso), isWeekend: attDow(iso) === 5 || attDow(iso) === 6, isToday: iso === ATT_TODAY, isFuture: iso > ATT_TODAY };
  _attDayCache[key] = out;
  return out;
}

// ---------------- month aggregation ----------------
function attMonthShape() {
  const first = new Date(_attYear, _attMonth, 1);
  const lead = (first.getDay() + 6) % 7;                                   // pad so the grid starts Monday
  const days = new Date(_attYear, _attMonth + 1, 0).getDate();
  return { lead, days, weeks: Math.ceil((lead + days) / 7) };
}
function attMonthCells() {
  const { lead, weeks } = attMonthShape();
  const start = attISO(new Date(_attYear, _attMonth, 1 - lead));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) cells.push(attAddDays(start, i));
  return cells;
}
function attMonthStats() {
  const last = new Date(_attYear, _attMonth + 1, 0).getDate();
  const per = {};   // empId -> counters
  let t = { onTime: 0, late: 0, absent: 0, off: 0, present: 0, hours: 0, reqs: 0, pending: 0 };
  for (let d = 1; d <= last; d++) {
    const iso = _attYear + '-' + attPad(_attMonth + 1) + '-' + attPad(d);
    const day = attDay(iso);
    t.onTime += day.stats.onTime; t.late += day.stats.late; t.absent += day.stats.absent;
    t.off += day.stats.off; t.present += day.stats.present; t.hours += day.stats.hours;
    t.reqs += day.requests.length;
    t.pending += day.requests.filter(r => r.status === 'Pending HR Review').length;
    day.rows.forEach(r => {
      const p = per[r.entry.empId] || (per[r.entry.empId] = { entry: r.entry, late: 0, absent: 0, onTime: 0, off: 0, present: 0 });
      if (r.rec.status === 'Late') p.late++;
      else if (r.rec.status === 'Absent') p.absent++;
      else if (r.rec.status === 'On Time') { p.onTime++; p.present++; }
      else p.off++;
    });
  }
  const sched = mathMax(t.present + t.absent, 1);
  t.rate = Math.round((t.present / sched) * 100);
  t.avgHours = t.present ? t.hours / t.present : 0;
  const repeated = Object.keys(per).map(k => per[k])
    .filter(p => (p.late + p.absent) >= 3)
    .sort((a, b) => (b.late + b.absent) - (a.late + a.absent));
  return { totals: t, repeated, per };
}

// Collect the viewed month's late/absent records (optionally for one employee),
// each with its date + punch details, ordered by date.
function attIssueRecords(kind, empId) {
  const out = [];
  const last = new Date(_attYear, _attMonth + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const iso = _attYear + '-' + attPad(_attMonth + 1) + '-' + attPad(d);
    const day = attDay(iso);
    for (const r of day.rows) {
      if (empId && r.entry.empId !== empId) continue;
      const isLate = r.rec.status === 'Late', isAbsent = r.rec.status === 'Absent';
      if (kind === 'late' && !isLate) continue;
      if (kind === 'absent' && !isAbsent) continue;
      if (kind === 'all' && !isLate && !isAbsent) continue;
      out.push({ iso, r });
    }
  }
  return out;
}

// Drill-down modal: every late/absent date this month — team-wide or for one
// employee — with shift, punches and request context. Click a row to jump to that day.
function openAttIssues(kind, empId) {
  const recs = attIssueRecords(kind, empId);
  const emp = empId ? (attRoster().find(e => e.empId === empId) || null) : null;
  const label = kind === 'late' ? 'Late' : kind === 'absent' ? 'Absent' : 'Late & absent';
  const title = (emp ? emp.name + ' — ' : '') + label + ' days · ' + ATT_MONTHS[_attMonth] + ' ' + _attYear;
  const rows = recs.map(({ iso, r }) => {
    const lateBy = r.rec._lateBy;
    const jump = `closeModal();attPick('${iso}')${emp ? `;attShowEmployee('${emp.empId}')` : ''}`;
    const req = r.reqs[0];
    const reqCls = req ? (req.status === 'Approved' ? 'badge-green' : (req.status === 'Rejected' ? 'badge-red' : 'badge-yellow')) : '';
    const detail = r.rec.status === 'Late'
      ? `In <b>${r.rec.checkIn || '—'}</b> <i class="is-late">${lateBy != null && lateBy > 0 ? '+' + lateBy + 'm late' : 'late'}</i>${r.rec.checkOut ? ' · Out <b>' + r.rec.checkOut + '</b>' : ''}`
      : `${attEsc(r.rec.notes || 'No check-in recorded')}${r.rec.checkOut ? ' · Out <b>' + r.rec.checkOut + '</b>' : ''}`;
    return `<button class="att-issue" onclick="${jump}" title="Open ${attLongDate(iso)}">
      <span class="att-issue-date">${attFromISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
      ${emp ? '' : `<span class="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[8px] font-semibold flex-shrink-0">${attEsc(r.entry.initials)}</span><span class="att-issue-name">${attEsc(r.entry.name)}</span>`}
      <span class="att-shift${r.rec.status === 'Off' ? ' is-off' : ''}">${attEsc(r.rec.shift)}</span>
      <span class="att-issue-detail">${detail}</span>
      ${req ? `<span class="badge ${reqCls} text-[8px] flex-shrink-0" title="${attEsc(req.type + ' — ' + req.status)}">${attEsc(req.type)}</span>` : ''}
      <span class="att-issue-go">→</span>
    </button>`;
  }).join('');
  openModal(title, recs.length
    ? `<div class="flex flex-col gap-1">${rows}</div><p class="text-[9px] text-charcoal-400 mt-2 text-right">Click a day to open it in the roster.</p>`
    : `<p class="text-[10px] text-charcoal-400 py-4 text-center">No ${label.toLowerCase()} days in ${ATT_MONTHS[_attMonth]} ${_attYear}.</p>`,
    { wide: true });
}

// ---------------- employee drill-down: schedule · attendance history · request history ----------------
// Clicking a roster row opens the employee's full file in a modal with three tabs.
let _ehEmp = null;                 // empId open in the employee drill-down modal
let _ehTab = 'schedule';           // schedule | attendance | requests
let _ehWeek = null;                // ISO Monday of the displayed schedule week (null = week of the open roster day)
let _ehOlder = false;              // older-schedules list expanded?
let _ehAttFilter = 'all';          // all | present | late | absent | off

function openEmpHistory(ev, empId) {
  const t = ev && ev.target;
  if (t && t.closest && t.closest('button, a, input, select, label')) return; // inner controls keep their own actions
  if (!empId) return;
  _ehEmp = empId;
  _ehTab = 'schedule';
  _ehWeek = null;
  _ehOlder = false;
  _ehAttFilter = 'all';
  renderEmpHistory();
}
function empHistTab(tab) { _ehTab = tab; renderEmpHistory(); }
function empHistWeekShift(delta) {
  const base = _ehWeek || attAddDays(_attDay, -attDowIdx(_attDay));
  _ehWeek = attAddDays(base, delta * 7);
  renderEmpHistory();
}
function empHistWeekGoto(monday) { _ehWeek = monday; renderEmpHistory(); }
function empHistOlderToggle() { _ehOlder = !_ehOlder; renderEmpHistory(); }
function empHistAttFilter(f) { _ehAttFilter = _ehAttFilter === f ? 'all' : f; renderEmpHistory(); }

// One week of the pattern: 7 dated day cells + shift-kind counts (teamSchedule is Mon-first).
function empHistWeekData(entry, monday) {
  const tpls = {}; (MOCK.shiftTemplates || []).forEach(t => { tpls[t.id] = t; });
  const week = (MOCK.teamSchedule || {})[entry.id] || [];
  const counts = {};
  const days = [];
  for (let i = 0; i < 7; i++) {
    const iso = attAddDays(monday, i);
    const tpl = tpls[week[attDowIdx(iso)]] || null;
    const kind = tpl && !tpl.isOff ? (tpl.name || 'Shift') : 'Off';
    counts[kind] = (counts[kind] || 0) + 1;
    days.push({ iso, tpl, label: attShiftLabel(tpl), kind });
  }
  return { days, counts };
}
function empHistWeekSummary(counts) {
  return Object.keys(counts).map(k => counts[k] + ' ' + k.toLowerCase()).join(' · ');
}

// Weekly pattern with week navigation (‹ ›) and an expandable "older schedules" list.
function empHistScheduleHtml(entry) {
  const curMon = attAddDays(_attDay, -attDowIdx(_attDay));
  const monday = _ehWeek || curMon;
  const isCurrent = monday === curMon;
  const { days, counts } = empHistWeekData(entry, monday);
  const cells = days.map(d => {
    const sel = d.iso === _attDay;
    return `
      <div class="rounded-lg border ${sel ? 'border-brand-500 bg-brand-50' : 'border-charcoal-200'} p-1.5 text-center min-w-0">
        <p class="text-[9px] font-semibold ${sel ? 'text-brand-700' : 'text-charcoal-500'}">${ATT_DOW_SHORT[attDow(d.iso)]} ${attFromISO(d.iso).getDate()}</p>
        <span class="att-shift${!d.tpl || d.tpl.isOff ? ' is-off' : ''} mt-1 inline-block max-w-full" title="Scheduled shift ${attEsc(d.label)}">${attEsc(d.label)}</span>
        <p class="text-[8px] text-charcoal-400 mt-0.5 truncate">${attEsc(d.kind)}</p>
      </div>`;
  }).join('');
  // Older schedules: up to 4 weeks before the displayed one, as compact dated rows.
  const older = [];
  if (_ehOlder) {
    for (let k = 1; k <= 4; k++) {
      const wk = attAddDays(monday, -7 * k);
      const w = empHistWeekData(entry, wk);
      const minis = w.days.map(d => {
        const on = d.tpl && !d.tpl.isOff;
        return `<span class="rounded border ${on ? 'border-charcoal-200 bg-white text-charcoal-600' : 'border-charcoal-100 bg-charcoal-50 text-charcoal-400'} px-1 py-0.5 text-[8px] whitespace-nowrap" title="${ATT_DOW_SHORT[attDow(d.iso)]} ${attShortDate(d.iso)} · ${attEsc(d.label)}">${ATT_DOW_SHORT[attDow(d.iso)].slice(0, 2)} ${attEsc(d.label)}</span>`;
      }).join('');
      older.push(`
        <div class="flex flex-wrap items-center gap-2 py-1.5 border-b border-charcoal-100 last:border-b-0">
          <span class="text-[9px] font-semibold text-charcoal-700 w-24 flex-shrink-0">${attFromISO(wk).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${attFromISO(attAddDays(wk, 6)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <div class="flex items-center gap-1 flex-wrap min-w-0 flex-1">${minis}</div>
          <span class="text-[8px] text-charcoal-400 flex-shrink-0">${empHistWeekSummary(w.counts)}</span>
          <button type="button" class="att-mini" onclick="empHistWeekGoto('${wk}')" title="Show this week in the grid above">View</button>
        </div>`);
    }
  }
  const chevron = d => `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d < 0 ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}"/>`;
  return `
    <div class="flex items-center gap-1.5 mb-1.5">
      <p class="bento-label flex-1 min-w-0 truncate">Weekly pattern · ${attFromISO(monday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${attFromISO(attAddDays(monday, 6)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      <button type="button" class="btn btn-icon" style="width:22px;height:22px" onclick="empHistWeekShift(-1)" title="Previous week" aria-label="Previous week"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">${chevron(-1)}</svg></button>
      ${!isCurrent ? `<button type="button" class="btn btn-sm btn-ghost" style="height:22px;padding:0 .4rem;font-size:9px" onclick="empHistWeekGoto('${curMon}')">This week</button>` : ''}
      <button type="button" class="btn btn-icon" style="width:22px;height:22px" onclick="empHistWeekShift(1)" title="Next week" aria-label="Next week"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">${chevron(1)}</svg></button>
    </div>
    <div class="grid grid-cols-7 gap-1">${cells}</div>
    <p class="text-[9px] text-charcoal-500 mt-1.5">${empHistWeekSummary(counts)} — this pattern repeats weekly.${isCurrent ? ' The highlighted day is the day currently open in the roster.' : ''}</p>
    <div class="flex items-center gap-2 mt-2.5">
      <button type="button" class="btn btn-sm btn-secondary" style="height:24px;font-size:10px" onclick="empHistOlderToggle()" aria-expanded="${_ehOlder}">${_ehOlder ? 'Hide older schedules ↑' : 'Show older schedules ↓'}</button>
      ${_ehOlder ? '<span class="text-[9px] text-charcoal-400">The 4 weeks before the week above — click View to open one.</span>' : ''}
    </div>
    ${_ehOlder ? `<div class="mt-1.5">${older.join('')}</div>` : ''}`;
}

// Day-by-day attendance history for the viewed month (past + today), newest first,
// with All/Present/Late/Absent/Off filter tabs and hours worked vs scheduled hours.
function empHistAttMatch(rec) {
  if (_ehAttFilter === 'all') return true;
  if (_ehAttFilter === 'present') return rec.status === 'On Time' || rec.status === 'Late' || rec.status === 'Early Checkout';
  if (_ehAttFilter === 'late') return rec.status === 'Late';
  if (_ehAttFilter === 'absent') return rec.status === 'Absent';
  if (_ehAttFilter === 'off') return rec.status === 'Off';
  return true;
}
function empHistAttHtml(entry) {
  const last = new Date(_attYear, _attMonth + 1, 0).getDate();
  const st = { total: 0, present: 0, late: 0, absent: 0, off: 0, hours: 0, expected: 0 };
  const list = [];
  for (let d = last; d >= 1; d--) {
    const iso = _attYear + '-' + attPad(_attMonth + 1) + '-' + attPad(d);
    const day = attDay(iso);
    if (day.isFuture) continue;                    // history = past + today
    const r = day.rows.find(x => x.entry.empId === entry.empId);
    if (!r) continue;
    const rec = r.rec;
    st.total++;
    if (rec.status === 'On Time' || rec.status === 'Late' || rec.status === 'Early Checkout') st.present++;
    if (rec.status === 'Late') st.late++;
    if (rec.status === 'Absent') st.absent++;
    if (rec.status === 'Off') st.off++;
    let worked = rec._worked;
    if (worked == null && rec.checkIn && rec.checkOut) worked = Math.max(0, attMinutes(rec.checkOut) - attMinutes(rec.checkIn));
    if (worked) st.hours += worked;
    // Scheduled hours for the day (from the shift string, overnight-safe) — the "out of" total.
    const m = String(rec.shift || '').match(/^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/);
    if (m) {
      let dur = attMinutes(m[2]) - attMinutes(m[1]);
      if (dur <= 0) dur += 1440;
      st.expected += dur;
    }
    if (!empHistAttMatch(rec)) continue;
    const lateBy = rec._lateBy;
    const detail = rec.status === 'Off'
      ? attEsc(rec.notes || 'Scheduled off')
      : rec.status === 'Absent'
        ? attEsc(rec.notes || 'No check-in recorded')
        : `In <b>${rec.checkIn || '—'}</b>${lateBy != null && lateBy > 0 ? ` <i class="is-late">+${lateBy}m late</i>` : ''}${rec.checkOut ? ' · Out <b>' + rec.checkOut + '</b>' : ''}${worked ? ' · ' + attPad(Math.floor(worked / 60)) + 'h ' + attPad(worked % 60) + 'm' : ''}`;
    list.push(`<button class="att-issue" onclick="closeModal();attPick('${iso}')" title="Open ${attLongDate(iso)} in the roster">
      <span class="att-issue-date">${attFromISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
      ${statusBadge(rec.status)}
      <span class="att-shift${rec.status === 'Off' ? ' is-off' : ''}">${attEsc(rec.shift)}</span>
      <span class="att-issue-detail">${detail}</span>
      <span class="att-issue-go">→</span>
    </button>`);
  }
  const tab = (id, label, n) => `<button type="button" class="tab-btn ${_ehAttFilter === id ? 'active' : ''}" onclick="empHistAttFilter('${id}')" aria-pressed="${_ehAttFilter === id}" title="Show ${label.toLowerCase()} days only">${label} (${n})</button>`;
  const hours = (st.hours / 60).toFixed(1);
  const expected = (st.expected / 60).toFixed(1);
  const head = `
    <div class="flex flex-wrap items-center gap-1.5 mb-2">
      <div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200">
        ${tab('all', 'All', st.total)}${tab('present', 'Present', st.present)}${tab('late', 'Late', st.late)}${tab('absent', 'Absent', st.absent)}${tab('off', 'Off', st.off)}
      </div>
      <span class="badge badge-blue ml-auto" title="Hours worked out of the ${expected}h scheduled this month">${Number(hours)}h / ${Number(expected)}h worked</span>
    </div>`;
  const fname = { present: 'present', late: 'late', absent: 'absent', off: 'off' }[_ehAttFilter];
  return head + (list.length
    ? `<div class="flex flex-col gap-1">${list.join('')}</div><p class="text-[9px] text-charcoal-400 mt-2 text-right">Click a day to open it in the roster. · ${ATT_MONTHS[_attMonth]} ${_attYear}</p>`
    : `<p class="text-[10px] text-charcoal-400 py-4 text-center">${fname ? 'No ' + fname + ' days' : 'No attendance history'} in ${ATT_MONTHS[_attMonth]} ${_attYear}.</p>`);
}

// Every request this employee ever submitted, with status and a shortcut to the full timeline.
function empHistReqHtml(entry) {
  const reqs = (MOCK.requests || []).filter(r => r.employee === entry.name);
  if (!reqs.length) return `<p class="text-[10px] text-charcoal-400 py-4 text-center">${attEsc(entry.name)} has not submitted any requests.</p>`;
  const n = s => reqs.filter(r => r.status === s).length;
  const rows = reqs.map(r => `
    <div class="att-issue" style="cursor:default">
      <span class="att-issue-date">${attEsc(String(r.requestedDate || '').replace(/\s*\d{4}$/, ''))}</span>
      <span class="badge badge-gray text-[8px]">${attEsc(r.type)}</span>
      ${statusBadge(r.status)}
      <span class="att-issue-detail">${attEsc(r.reason || 'No reason given')}${r.bmComment ? ' · BM: ' + attEsc(r.bmComment) : ''}</span>
      <button type="button" class="att-mini" onclick="openRequestDetail('${r.id}')" title="Open full request details">Details</button>
    </div>`).join('');
  return `
    <div class="flex flex-wrap items-center gap-1.5 mb-2">
      <span class="badge badge-gray">${reqs.length} total</span>
      <span class="badge badge-yellow">${n('Pending HR Review')} pending</span>
      <span class="badge badge-green">${n('Approved')} approved</span>
      <span class="badge badge-red">${n('Rejected')} rejected</span>
    </div>
    <div class="flex flex-col gap-1">${rows}</div>
    <p class="text-[9px] text-charcoal-400 mt-2 text-right">Details opens the full request timeline.</p>`;
}

function renderEmpHistory() {
  const entry = attRoster().find(e => e.empId === _ehEmp);
  if (!entry) return;
  const tabs = [['schedule', 'Schedule'], ['attendance', 'Attendance'], ['requests', 'Requests']];
  const body = _ehTab === 'schedule' ? empHistScheduleHtml(entry)
    : _ehTab === 'attendance' ? empHistAttHtml(entry)
      : empHistReqHtml(entry);
  const reqCount = (MOCK.requests || []).filter(r => r.employee === entry.name).length;
  openModal(`${attEsc(entry.name)} — employee file`, `
    <div class="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-charcoal-100">
      <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">${attEsc(entry.initials)}</div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-bold text-charcoal-900 truncate">${attEsc(entry.name)}</p>
        <p class="text-[10px] text-charcoal-500 truncate">${attEsc(entry.position)} · ${attEsc(entry.gym)} · ${attEsc(entry.empId)}</p>
      </div>
      ${statusBadge(entry.empStatus)}
    </div>
    <div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200 mb-2.5">${tabs.map(t => `<button onclick="empHistTab('${t[0]}')" class="tab-btn ${_ehTab === t[0] ? 'active' : ''}">${t[1]}${t[0] === 'requests' && reqCount ? ' (' + reqCount + ')' : ''}</button>`).join('')}</div>
    ${body}
  `, { full: true, footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>` });
}

// ---------------- view actions ----------------
function attPick(iso) {
  if (!iso) return;
  _attDay = iso;
  _attMenu = null;
  const d = attFromISO(iso);
  _attYear = d.getFullYear(); _attMonth = d.getMonth();
  attResetCache();
  renderAll();
}
function attGotoToday() { attPick(ATT_TODAY); }
function attShiftMonth(delta) {
  let m = _attMonth + delta, y = _attYear;
  while (m < 0) { m += 12; y--; }
  while (m > 11) { m -= 12; y++; }
  const curDay = attFromISO(_attDay).getDate();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const d = new Date(y, m, Math.min(curDay, lastDay));
  _attYear = y; _attMonth = m; _attDay = attISO(d);
  _attMenu = null;
  attResetCache();
  renderAll();
}
function attStepDay(n) { attPick(attAddDays(_attDay, n)); }
function attSetGym(v) { _attGym = v; _attMenu = null; attResetCache(); renderAll(); }
function attSetFilter(v) { _attRowFilter = v; _attMenu = null; renderAll(); }
function attOnSearch(v) {
  _attQuery = v;
  renderAll();
  document.querySelectorAll('.att-search').forEach(el => { el.focus(); try { el.setSelectionRange(v.length, v.length); } catch (e) { } });
}
function attResetFilters() { _attQuery = ''; _attRowFilter = 'all'; _attMenu = null; renderAll(); }

document.addEventListener('keydown', e => {
  if (state.currentPage !== 'attendance') return;
  if (e.key === 'Escape' && _attMenu) { e.preventDefault(); _attMenu = null; renderAll(); return; }
  const t = e.target.tagName;
  if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
  const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (map[e.key] !== undefined) { e.preventDefault(); attStepDay(map[e.key]); }
  else if (e.key === 't' || e.key === 'T') { e.preventDefault(); attGotoToday(); }
  else if (e.key === '/') { e.preventDefault(); const el = document.querySelector('.att-search'); if (el) el.focus(); }
});

function attExportDay() {
  const day = attDay(_attDay);
  const head = ['Employee ID','Name','Position','Gym','Shift','Check In','Check Out','Hours','Status','Source','Request'];
  const lines = [head];
  day.rows.forEach(r => {
    lines.push([
      r.entry.empId, r.entry.name, r.entry.position, r.entry.gym, r.rec.shift,
      r.rec.checkIn || '', r.rec.checkOut || '',
      r.rec._worked != null ? (r.rec._worked / 60).toFixed(2) : '',
      r.rec.status, r.rec.source || '',
      r.reqs.map(q => q.type + ' [' + q.status + ']').join(' | ')
    ]);
  });
  const csv = lines.map(l => l.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'attendance-' + _attDay + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast('Exported ' + day.rows.length + ' records for ' + attShortDate(_attDay));
}

// ==================== RENDER ====================
function renderAttendance() {
  const showAll = DEMO.showAll;
  const canEdit = showAll || hasPermission('attendance.edit');
  const canManual = showAll || hasPermission('attendance.manual_entry');
  const canDecide = showAll || hasPermission('requests.approve');

  attResetCache();
  const day = attDay(_attDay);
  const s = day.stats;
  const month = attMonthStats();
  const gyms = attGymList();
  const prevDay = attDay(attAddDays(_attDay, -1));

  // ---- KPI strip (selected day) ----
  const kpis = `
    <div class="stat-tile py-1 px-2.5 flex flex-row items-center justify-between border-l-2 border-l-brand-500">
      <span class="stat-label">Present</span><span class="stat-value text-xs text-brand-600">${s.present}<span class="text-charcoal-400 font-normal">/${s.total}</span></span>
    </div>
    <div class="stat-tile py-1 px-2.5 flex flex-row items-center justify-between">
      <span class="stat-label">On Time</span><span class="stat-value text-xs text-charcoal-900">${s.onTime}</span>
    </div>
    <div class="stat-tile py-1 px-2.5 flex flex-row items-center justify-between" style="cursor:pointer" onclick="attSetFilter('exceptions')" title="Show exceptions — late, absent or conflicting records">
      <span class="stat-label">Late</span><span class="stat-value text-xs text-yellow-600">${s.late}</span>
    </div>
    <div class="stat-tile py-1 px-2.5 flex flex-row items-center justify-between" style="cursor:pointer" onclick="attSetFilter('exceptions')" title="Show exceptions — late, absent or conflicting records">
      <span class="stat-label">Absent</span><span class="stat-value text-xs text-red-600">${s.absent}</span>
    </div>
    <div class="stat-tile py-1 px-2.5 flex flex-row items-center justify-between">
      <span class="stat-label">Off Day</span><span class="stat-value text-xs text-blue-600">${s.off}</span>
    </div>
    <div class="stat-tile py-1 px-2.5 flex flex-row items-center justify-between" style="cursor:pointer" onclick="attSetFilter('requests')" title="Show employees with a request on this day${day.requests.filter(r => r.status === 'Pending HR Review').length ? ' — ' + day.requests.filter(r => r.status === 'Pending HR Review').length + ' pending HR review' : ''}">
      <span class="stat-label">Requests</span><span class="stat-value text-xs ${day.requests.length ? 'text-orange-600' : 'text-charcoal-400'}">${day.requests.length}</span>
    </div>
    <div class="stat-tile py-1 px-2.5 flex flex-row items-center justify-between">
      <span class="stat-label">Rate</span>
      <span class="stat-value text-xs text-charcoal-900">${s.rate == null ? '<span class="text-charcoal-400 font-normal">—</span>' : s.rate + '%'}${s.rate != null && prevDay.stats.rate != null ? `<span class="text-[9px] font-normal ${s.rate >= prevDay.stats.rate ? 'text-brand-600' : 'text-red-500'}">${s.rate >= prevDay.stats.rate ? '▲' : '▼'}${Math.abs(s.rate - prevDay.stats.rate)}</span>` : ''}</span>
    </div>`;

  // ---- day panel rows ----
  const q = _attQuery.trim().toLowerCase();
  let visible = day.rows.filter(r => {
    if (q && (r.entry.name + ' ' + r.entry.position + ' ' + r.entry.gym).toLowerCase().indexOf(q) < 0) return false;
    if (_attRowFilter === 'exceptions') return r.rec.status === 'Late' || r.rec.status === 'Absent' || r.flags.length > 0;
    if (_attRowFilter === 'requests') return r.reqs.length > 0;
    return true;
  });
  const rank = { 'Late': 0, 'Absent': 1, 'Early Checkout': 2, 'On Time': 3, 'Off': 4, 'Scheduled': 5 };
  visible = visible.slice().sort((a, b) => (rank[a.rec.status] || 0) - (rank[b.rec.status] || 0) || a.entry.name.localeCompare(b.entry.name));

  const excCount = day.rows.filter(r => r.rec.status === 'Late' || r.rec.status === 'Absent' || r.flags.length > 0).length;
  const reqEmpCount = day.rows.filter(r => r.reqs.length > 0).length;

  // (request chips now render inline in the Request column — see attReqCell)

  const employeeRow = r => {
    const lateBy = r.rec._lateBy;
    const delta = lateBy != null && lateBy > 0
      ? `<span class="att-delta is-late">+${lateBy}m late</span>`
      : (lateBy != null ? `<span class="att-delta is-ok">on time</span>` : '');
    const worked = r.rec._worked != null ? attPad(Math.floor(r.rec._worked / 60)) + 'h ' + attPad(r.rec._worked % 60) + 'm' : '—';
    const isOff = r.rec.status === 'Off' || r.rec.status === 'Scheduled';
    return `<tr class="att-rrow" data-att-emp="${r.entry.empId}" onclick="openEmpHistory(event,'${r.entry.empId}')" title="Open ${attEsc(r.entry.name)}'s schedule & history">
      <td>
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[9px] font-semibold flex-shrink-0">${attEsc(r.entry.initials)}</div>
          <div class="min-w-0">
            <p class="att-emp-name" title="${attEsc(r.entry.name)}">${attEsc(r.entry.name)}</p>
            <p class="att-emp-sub" title="${attEsc(r.entry.position + ' · ' + r.entry.gym)}">${attEsc(r.entry.position)} · ${attEsc(r.entry.gym)}</p>
          </div>
        </div>
      </td>
      <td><span class="att-shift${isOff ? ' is-off' : ''}" title="Scheduled shift ${attEsc(r.rec.shift)}">${attEsc(r.rec.shift)}</span></td>
      <td>
        ${statusBadge(r.rec.status)}
        ${r.rec.notes ? `<p class="att-notes" title="${attEsc(r.rec.notes)}">${attEsc(r.rec.notes)}</p>` : ''}
      </td>
      <td class="att-num"><b>${r.rec.checkIn || '—'}</b>${delta}</td>
      <td class="att-num"><b>${r.rec.checkOut || '—'}</b></td>
      <td class="att-num"><div>${worked}</div>${r.rec.source ? `<span class="att-src" title="Punch source">${attEsc(r.rec.source)}</span>` : ''}</td>
      <td>${attReqCell(r, canDecide)}</td>
      <td class="att-c-act">
        <button type="button" data-att-menu onclick="attToggleMenu(event,'${r.entry.empId}')" class="att-menu-btn ${_attMenu === r.entry.empId ? 'is-open' : ''}" title="More actions for ${attEsc(r.entry.name)}" aria-label="Actions for ${attEsc(r.entry.name)}" aria-haspopup="menu">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </td>
    </tr>`;
  };

  const dayPanel = `
    <section class="att-daypanel">
      <div class="att-daypanel-head">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex items-baseline gap-1.5">
            <h2 class="text-xs font-bold text-charcoal-900 leading-tight truncate">${attLongDate(day.iso)}</h2>
            <p class="text-[9px] text-charcoal-500 truncate">${s.total} sched · ${s.present} present · ${s.avgHours ? attPad(Math.floor(s.avgHours / 60)) + 'h ' + attPad(Math.round(s.avgHours % 60)) + 'm' : '—'} avg</p>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            ${day.isToday ? '<span class="badge badge-brand text-[8px]">TODAY</span>' : ''}
            <button onclick="attStepDay(-1)" class="btn btn-icon" style="width:22px;height:22px" title="Previous day (←)" aria-label="Previous day">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onclick="attStepDay(1)" class="btn btn-icon" style="width:22px;height:22px" title="Next day (→)" aria-label="Next day">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>

        ${day.requests.length ? `<div class="att-req-banner">
          <div class="flex items-center gap-1.5 min-w-0">
            <svg class="w-3 h-3 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            <span class="text-[9px] font-semibold text-charcoal-900 flex-shrink-0">${day.requests.length} request${day.requests.length > 1 ? 's' : ''} on this day</span>
            <span class="text-[9px] text-charcoal-500 truncate">· across ${reqEmpCount} employee${reqEmpCount > 1 ? 's' : ''}</span>
          </div>
          <button onclick="navigateTo('requests')" class="text-[9px] font-semibold text-orange-700 hover:text-orange-800 flex-shrink-0">Inbox →</button>
        </div>` : ''}

        <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <div class="att-seg" role="tablist">
            <button onclick="attSetFilter('all')" class="att-seg-btn ${_attRowFilter === 'all' ? 'is-active' : ''}" role="tab" aria-selected="${_attRowFilter === 'all'}">All <span class="att-seg-n">${day.rows.length}</span></button>
            <button onclick="attSetFilter('exceptions')" class="att-seg-btn ${_attRowFilter === 'exceptions' ? 'is-active' : ''}" role="tab" aria-selected="${_attRowFilter === 'exceptions'}">Exceptions <span class="att-seg-n">${excCount}</span></button>
            <button onclick="attSetFilter('requests')" class="att-seg-btn ${_attRowFilter === 'requests' ? 'is-active' : ''}" role="tab" aria-selected="${_attRowFilter === 'requests'}">With request <span class="att-seg-n">${reqEmpCount}</span></button>
          </div>
          <div class="relative flex-1 min-w-0" style="min-width:8.5rem">
            <svg class="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-charcoal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
            <input type="search" class="form-input att-search" style="height:24px;font-size:10px;padding-left:1.4rem" placeholder="Search employee…  ( / )" value="${attEsc(_attQuery)}" oninput="attOnSearch(this.value)" aria-label="Search employees in this day">
          </div>
          ${(_attQuery || _attRowFilter !== 'all') ? `<button onclick="attResetFilters()" class="btn btn-sm btn-ghost flex-shrink-0" style="height:24px;padding:0 .4rem;font-size:9px" title="Clear filters">Clear</button>` : ''}
        </div>
      </div>

      <div class="att-daypanel-body">
        <table class="att-rtable">
          <colgroup>
            <col><col style="width:5.25rem"><col style="width:6rem"><col style="width:4.25rem"><col style="width:4rem"><col style="width:5rem"><col style="width:9.5rem"><col style="width:2rem">
          </colgroup>
          <thead>
            <tr>
              <th>Employee</th><th>Shift</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Request</th><th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
        ${visible.length ? visible.map(employeeRow).join('') : `
            <tr><td colspan="8">
              <div class="empty-state py-6 text-center">
                <svg class="w-6 h-6 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <p class="text-[10px] text-charcoal-500">No employees match this filter.</p>
                <button onclick="attResetFilters()" class="btn btn-sm btn-ghost mt-1.5" style="height:24px;font-size:9px">Reset filters</button>
              </div>
            </td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="att-daypanel-foot">
        <span class="text-[9px] text-charcoal-500">Punctuality <b class="text-charcoal-800">${s.punctuality == null ? '—' : s.punctuality + '%'}</b></span>
        <span class="text-[9px] text-charcoal-500">Hours logged <b class="text-charcoal-800">${s.hours ? (s.hours / 60).toFixed(1) + 'h' : (day.isFuture ? '—' : 'in progress')}</b></span>
        <span class="text-[9px] text-charcoal-500">Biometric <b class="text-charcoal-800">${Math.round(day.rows.filter(r => r.rec.source === 'Biometric').length / mathMax(s.total, 1) * 100)}%</b></span>
      </div>
    </section>`;

  // ---- calendar cells ----
  const weeks = attMonthShape().weeks;
  const cells = attMonthCells().map(iso => {
    const d = attFromISO(iso);
    const inMonth = d.getMonth() === _attMonth && d.getFullYear() === _attYear;
    const dd = attDay(iso);
    const st = dd.stats;
    const pct = n => (n / mathMax(st.total, 1) * 100).toFixed(2);
    const reqN = dd.requests.length;
    const excN = st.late + st.absent;

    const cls = ['att-cell'];
    if (iso === _attDay) cls.push('is-selected');
    if (dd.isToday) cls.push('is-today');
    if (dd.isWeekend) cls.push('is-weekend');
    if (!inMonth) cls.push('is-out');
    if (dd.isFuture) cls.push('is-future');

    return `<button type="button" onclick="attPick('${iso}')" class="${cls.join(' ')}" style="--abs:${(st.absent / mathMax(st.total, 1) * 0.16).toFixed(3)}"
      aria-current="${dd.isToday ? 'date' : 'false'}" aria-pressed="${iso === _attDay}"
      title="${attLongDate(iso)} — ${dd.isFuture ? st.scheduled + ' scheduled, ' + st.off + ' off' : st.present + '/' + st.total + ' present, ' + st.late + ' late, ' + st.absent + ' absent'}${reqN ? ', ' + reqN + ' request(s)' : ''}">
      <span class="att-cell-top">
        <span class="att-cell-num">${d.getDate()}</span>
        ${reqN ? `<span class="att-req-dot" title="${reqN} request(s)">${reqN}</span>` : ''}
      </span>
      ${inMonth && !dd.isFuture ? `
        <span class="att-bar" aria-hidden="true">
          <i class="bg-brand-500" style="width:${pct(st.onTime)}%"></i>
          <i class="bg-yellow-400" style="width:${pct(st.late)}%"></i>
          <i class="bg-red-500" style="width:${pct(st.absent)}%"></i>
          <i class="bg-charcoal-200" style="width:${pct(st.off)}%"></i>
        </span>
        <span class="att-cell-meta">
          <span class="text-brand-700 font-semibold">${st.present}</span><span class="text-charcoal-300">/</span><span class="text-charcoal-500">${st.total}</span>
          ${excN ? `<span class="att-exc" title="${st.late} late · ${st.absent} absent">${excN}</span>` : ''}
        </span>` : inMonth ? `<span class="att-cell-future">Upcoming</span>` : ''}
    </button>`;
  }).join('');

  const monthRepeated = month.repeated.length ? month.repeated.slice(0, 4).map(p => `
    <button onclick="openAttIssues('all','${p.entry.empId}')" class="att-flag" title="Show every late/absent date for ${attEsc(p.entry.name)} in ${ATT_MONTHS[_attMonth]}">
      <span class="w-5 h-5 rounded-full bg-charcoal-100 text-charcoal-700 flex items-center justify-center text-[8px] font-bold flex-shrink-0">${attEsc(p.entry.initials)}</span>
      <span class="min-w-0 flex-1 text-left truncate">${attEsc(p.entry.name)}</span>
      <span class="flex items-center gap-1 flex-shrink-0">
        ${p.late ? `<span class="badge badge-yellow text-[8px]">${p.late} late</span>` : ''}
        ${p.absent ? `<span class="badge badge-red text-[8px]">${p.absent} absent</span>` : ''}
        <span class="text-charcoal-300 flex-shrink-0">›</span>
      </span>
    </button>`).join('') : `<p class="text-[9px] text-charcoal-400">No repeated issues this month.</p>`;

  const legend = `
    <span class="att-lg"><i class="bg-brand-500"></i>On time</span>
    <span class="att-lg"><i class="bg-yellow-400"></i>Late</span>
    <span class="att-lg"><i class="bg-red-500"></i>Absent</span>
    <span class="att-lg"><i class="bg-charcoal-200"></i>Off</span>
    <span class="att-lg"><i class="bg-orange-500"></i>Request</span>`;

  // ---- assemble ----
  return `<div class="att-shell">
    <!-- Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 flex-shrink-0">
      <div class="min-w-0">
        <h1 class="text-sm font-bold text-charcoal-900 leading-tight">Attendance</h1>
        <p class="text-[10px] text-charcoal-500">${month.totals.present} present-days · ${month.totals.rate}% rate · ${month.totals.reqs} request${month.totals.reqs === 1 ? '' : 's'} in ${ATT_MONTHS[_attMonth]}</p>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <div class="att-monthnav">
          <button onclick="attShiftMonth(-1)" class="btn btn-icon" style="width:24px;height:24px" title="Previous month" aria-label="Previous month">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="att-monthlabel">${ATT_MONTHS[_attMonth]} ${_attYear}</span>
          <button onclick="attShiftMonth(1)" class="btn btn-icon" style="width:24px;height:24px" title="Next month" aria-label="Next month">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        ${_attDay !== ATT_TODAY ? `<button onclick="attGotoToday()" class="btn btn-sm btn-secondary" style="height:24px;font-size:10px">Today</button>` : ''}
        <select onchange="attSetGym(this.value)" class="form-select w-auto" style="height:24px;font-size:10px" aria-label="Filter by gym">
          <option value="all" ${_attGym === 'all' ? 'selected' : ''}>All Gyms</option>
          ${gyms.map(g => `<option value="${attEsc(g)}" ${_attGym === g ? 'selected' : ''}>${attEsc(g)}</option>`).join('')}
        </select>
        <button onclick="attExportDay()" class="btn btn-sm btn-secondary" style="height:24px;font-size:10px" title="Export the selected day as CSV">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
          Export
        </button>
        <button onclick="openPairStationModal()" class="btn btn-sm btn-secondary flex items-center gap-1" style="height:24px;font-size:10px" title="Generate 6-digit code to pair attendance kiosk">
          <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          Pair Kiosk
        </button>
        ${canManual ? `<button onclick="openManualEntry('${_attDay}')" class="btn btn-sm btn-primary" style="height:24px;font-size:10px">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Manual Entry
        </button>` : ''}
      </div>
    </div>

    <!-- Day KPIs -->
    <div class="grid grid-cols-3 sm:grid-cols-7 gap-1.5 flex-shrink-0">${kpis}</div>

    <!-- Main: day panel (left) + calendar (right) -->
    <div class="flex flex-col lg:flex-row gap-1.5 flex-1 min-h-0">
      ${dayPanel}

      <section class="att-cal">
        <div class="att-cal-head">
          <div class="att-dow">
            ${ATT_DOW_SHORT.slice(1).concat(ATT_DOW_SHORT[0]).map((d, i) => `<span class="att-dow-cell ${i > 4 ? 'is-weekend' : ''}">${d}</span>`).join('')}
          </div>
          <div class="att-cal-legend">${legend}</div>
        </div>
        <div class="att-grid" style="grid-template-rows:repeat(${weeks},minmax(0,1fr))" role="grid" aria-label="Attendance calendar for ${ATT_MONTHS[_attMonth]} ${_attYear}">${cells}</div>
        <div class="att-cal-foot">
          <div class="min-w-0">
            <p class="bento-label text-orange-700">Repeated issues · ${ATT_MONTHS[_attMonth]}</p>
            <div class="flex flex-col gap-0.5 mt-1">${monthRepeated}</div>
          </div>
          <div class="flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
            <p class="bento-label">Month</p>
            <p class="text-[9px] text-charcoal-500">Rate <b class="text-charcoal-800">${month.totals.rate}%</b> · Punctual <b class="text-charcoal-800">${month.totals.onTime}</b></p>
            <p class="text-[9px] text-charcoal-500">
              <button class="att-statlink" onclick="openAttIssues('late')" title="Show every late day in ${ATT_MONTHS[_attMonth]} with check-in details"><b class="text-red-600">${month.totals.late}</b> late</button>
              ·
              <button class="att-statlink" onclick="openAttIssues('absent')" title="Show every absent day in ${ATT_MONTHS[_attMonth]}"><b class="text-red-600">${month.totals.absent}</b> absent</button>
            </p>
            <p class="text-[9px] text-charcoal-500"><button class="att-statlink" onclick="navigateTo('requests')" title="Open the requests inbox"><b class="text-orange-600">${month.totals.pending}</b> request${month.totals.pending === 1 ? '' : 's'} pending</button></p>
            ${month.totals.avgHours ? `<p class="text-[9px] text-charcoal-500">Avg <b class="text-charcoal-800">${(month.totals.avgHours / 60).toFixed(1)}h</b> / day</p>` : ''}
          </div>
        </div>
      </section>
    </div>

    ${!canEdit ? `<p class="text-[10px] text-charcoal-400 text-center flex-shrink-0">Manual correction is hidden — you do not have <code>attendance.edit</code>.</p>` : ''}
    ${attMenuHtml(day, visible, canEdit, canDecide)}
  </div>`;
}

// ==================== ROW ACTIONS (request cell, floating menu, quick marks) ====================
function attReqStatusShort(s) { return s === 'Pending HR Review' ? 'Pending' : s; }

// Request cell: type + status + reason, with inline Approve/Reject for pending requests.
function attReqCell(r, canDecide) {
  if (!r.reqs.length) return r.flags.length ? '' : '<span class="att-none">—</span>';
  const chips = r.reqs.map(q => {
    const pending = q.status === 'Pending HR Review';
    const cls = q.status === 'Approved' ? 'badge-green' : (q.status === 'Rejected' ? 'badge-red' : 'badge-yellow');
    return `<div class="att-req-cell">
      <div class="flex items-center gap-1 flex-wrap">
        <span class="att-req-type">${attEsc(q.type)}</span>
        <span class="badge ${cls} text-[8px]" title="${attEsc(q.status)}">${attEsc(attReqStatusShort(q.status))}</span>
      </div>
      ${q.reason ? `<p class="att-req-why" title="${attEsc(q.reason)}">${attEsc(q.reason)}</p>` : ''}
      <div class="flex items-center gap-1 mt-1 flex-wrap">
        ${pending && canDecide ? `<button type="button" onclick="attDecide('${q.id}','approve')" class="att-mini is-ok" title="Approve ${attEsc(q.type)}">✓ Approve</button>
        <button type="button" onclick="attDecide('${q.id}','reject')" class="att-mini is-no" title="Reject ${attEsc(q.type)}">✕</button>` : ''}
        <button type="button" onclick="openRequestDetail('${q.id}')" class="att-mini" title="Open full request details">Details</button>
      </div>
    </div>`;
  }).join('');
  const flags = r.flags.map(f => `<span class="att-flagtag is-${f.tone}" title="${attEsc(f.text)}">${f.tone === 'brand' ? '✓' : '⚠'} ${attEsc(f.tone === 'red' ? 'Conflict' : (f.tone === 'amber' ? 'Unapproved' : 'Excused'))}</span>`).join('');
  return chips + flags;
}

function attDecide(reqId, mode) {
  const canDecide = DEMO.showAll || hasPermission('requests.approve');
  if (!canDecide) { _attMenu = null; renderAll(); showToast('You do not have requests.approve', 'error'); return; }
  applyRequestDecision(reqId, mode, mode === 'approve' ? 'Approved inline from Attendance' : 'Rejected inline from Attendance');
}

function attCloseMenu() { if (_attMenu) { _attMenu = null; renderAll(); } }

function attToggleMenu(ev, empId) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (_attMenu === empId) { _attMenu = null; renderAll(); return; }
  const btn = ev && ev.currentTarget ? ev.currentTarget : null;
  const rect = btn ? btn.getBoundingClientRect() : null;
  const host = btn ? (btn.closest('#main-content') || btn.closest('#mobile-content')) : null;
  const hostRect = host ? host.getBoundingClientRect() : null;
  const estH = 210; // rough menu height for the flip decision
  if (rect && hostRect) {
    const below = rect.bottom + estH <= window.innerHeight;
    _attMenuPos = {
      top: Math.max(4, (below ? rect.bottom + 4 : rect.top - estH - 4) - hostRect.top),
      right: Math.max(4, hostRect.right - rect.right)
    };
  } else {
    _attMenuPos = { top: 96, right: 48 };
  }
  _attMenu = empId;
  renderAll();
}

// Close the floating menu on any outside click or scroll (the menu is position:fixed
// inside #main-content, which uses contain:layout as its containing block).
document.addEventListener('click', e => {
  if (!_attMenu) return;
  const t = e.target;
  if (t && t.closest && (t.closest('.att-menu') || t.closest('[data-att-menu]'))) return;
  _attMenu = null;
  renderAll();
});
document.addEventListener('scroll', () => { if (_attMenu) { _attMenu = null; renderAll(); } }, true);
window.addEventListener('resize', () => { if (_attMenu) { _attMenu = null; renderAll(); } });

function attMenuHtml(day, visible, canEdit, canDecide) {
  if (!_attMenu || !_attMenuPos) return '';
  const r = visible.find(x => x.entry.empId === _attMenu);
  if (!r) { _attMenu = null; return ''; }
  const items = [];
  items.push(`<div class="att-menu-head"><b>${attEsc(r.entry.name)}</b><span>${attEsc(r.rec.shift)} · ${attEsc(r.rec.status)}${r.rec.checkIn ? ' · in ' + r.rec.checkIn : ''}</span></div>`);
  if (canEdit) {
    items.push(`<button type="button" onclick="attCloseMenu();openAttendanceCorrection('${r.entry.empId}','${day.iso}')"><span class="att-menu-icon">✎</span>Correct record…</button>`);
    if (!day.isFuture) {
      if (!r.rec.checkIn && r.rec.status !== 'Off') items.push(`<button type="button" class="is-ok" onclick="attCloseMenu();attQuickMark('${r.entry.empId}','present')"><span class="att-menu-icon">✓</span>Mark present</button>`);
      if (r.rec.status !== 'Absent' && r.rec.status !== 'Off') items.push(`<button type="button" class="is-danger" onclick="attCloseMenu();attQuickMark('${r.entry.empId}','absent')"><span class="att-menu-icon">✗</span>Mark absent</button>`);
      if (r.rec.checkIn && !r.rec.checkOut) items.push(`<button type="button" onclick="attCloseMenu();attQuickMark('${r.entry.empId}','checkout')"><span class="att-menu-icon">⤴</span>Check out now</button>`);
    }
  }
  const pendingReq = r.reqs.find(q => q.status === 'Pending HR Review');
  if (pendingReq && canDecide) {
    items.push(`<div class="att-menu-sep"></div><div class="att-menu-label">${attEsc(pendingReq.type)} request</div>`);
    items.push(`<button type="button" class="is-ok" onclick="attCloseMenu();attDecide('${pendingReq.id}','approve')"><span class="att-menu-icon">✓</span>Approve request</button>`);
    items.push(`<button type="button" class="is-danger" onclick="attCloseMenu();attDecide('${pendingReq.id}','reject')"><span class="att-menu-icon">✗</span>Reject request</button>`);
  }
  if (r.reqs.length) items.push(`<button type="button" onclick="attCloseMenu();openRequestDetail('${r.reqs[0].id}')"><span class="att-menu-icon">≣</span>Open request details…</button>`);
  if (!canEdit && !r.reqs.length) items.push(`<div class="att-menu-label">View only — no actions</div>`);
  return `<div class="att-menu" role="menu" style="top:${_attMenuPos.top}px;right:${_attMenuPos.right}px">${items.join('')}</div>`;
}

// Persist a manual change to MOCK.attendanceRecords (always audit-logged).
function attWriteRecord(entry, iso, patch, auditAction, auditDetail) {
  const day = attDay(iso);
  const row = day.rows.find(r => r.entry.empId === entry.empId);
  const base = row ? Object.assign({}, row.rec) : {};
  delete base._lateBy; delete base._worked;
  const rec = Object.assign({
    employeeId: entry.empId, name: entry.name, gym: entry.gym, date: iso,
    shift: row ? row.rec.shift : attShiftLabel(attShiftOf(entry, iso)),
    checkIn: null, checkOut: null, status: 'Off', source: 'Manual', notes: ''
  }, base, patch);
  rec.source = 'Manual';
  const list = MOCK.attendanceRecords;
  const i = list.findIndex(x => x.employeeId === entry.empId && x.date === iso);
  if (i >= 0) list[i] = rec; else list.push(rec);
  (MOCK.auditLog || []).unshift({
    id: 'al-' + Date.now(), action: auditAction, user: MOCK.currentUser.fullName,
    target: entry.name, detail: auditDetail, timestamp: ATT_TODAY, gym: entry.gym
  });
  attResetCache();
}

// Quick actions from the row menu: mark present / mark absent / check out.
function attQuickMark(empId, act) {
  _attMenu = null;
  const canEdit = DEMO.showAll || hasPermission('attendance.edit');
  if (!canEdit) { renderAll(); showToast('Requires attendance.edit', 'error'); return; }
  const entry = attRoster().find(x => x.empId === empId);
  if (!entry) return;
  const iso = _attDay;
  const day = attDay(iso);
  if (day.isFuture) { renderAll(); showToast("This day hasn't happened yet", 'error'); return; }
  const row = day.rows.find(r => r.entry.empId === empId);
  const rec = row ? row.rec : null;
  const tpl = row ? row.tpl : attShiftOf(entry, iso);
  if (act === 'present') {
    if (rec && rec.checkIn) { renderAll(); showToast(`${entry.name} already checked in at ${rec.checkIn}`, 'info'); return; }
    const start = tpl && !tpl.isOff ? tpl.start : '08:00';
    attWriteRecord(entry, iso, { checkIn: start, status: 'On Time', notes: 'Marked present manually' },
      'Attendance — Present Marked', `Present at ${start} on ${attShortDate(iso)} (quick action)`);
    renderAll();
    showToast(`${entry.name} marked present · ${start}`);
  } else if (act === 'absent') {
    if (rec && rec.status === 'Absent') { renderAll(); showToast(`${entry.name} is already absent`, 'info'); return; }
    attWriteRecord(entry, iso, { checkIn: null, checkOut: null, status: 'Absent', notes: 'Marked absent manually' },
      'Attendance — Absent Marked', `Marked absent on ${attShortDate(iso)} (quick action)`);
    renderAll();
    showToast(`${entry.name} marked absent`, 'error');
  } else if (act === 'checkout') {
    if (!rec || !rec.checkIn) { renderAll(); showToast('No check-in recorded yet', 'error'); return; }
    if (rec.checkOut) { renderAll(); showToast(`${entry.name} already checked out at ${rec.checkOut}`, 'info'); return; }
    const end = tpl && !tpl.isOff ? tpl.end : '16:00';
    attWriteRecord(entry, iso, { checkOut: end, notes: 'Check-out recorded manually' },
      'Attendance — Check-out Recorded', `Check-out ${end} on ${attShortDate(iso)} (quick action)`);
    renderAll();
    showToast(`${entry.name} checked out · ${end}`);
  }
}

function attShowEmployee(empId) {
  const row = document.querySelector('[data-att-emp="' + empId + '"]');
  if (!row) { showToast('No records for this employee in the selected day', 'info'); return; }
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.add('is-flash');
  setTimeout(() => row.classList.remove('is-flash'), 1200);
}

// ==================== MODALS ====================
function openAttendanceCorrection(id, iso) {
  const date = iso || _attDay;
  const roster = attRoster();
  const entry = roster.find(x => x.empId === id) || roster.find(x => x.id === id);
  if (!entry) { showToast('Employee not found', 'error'); return; }

  const canEdit = DEMO.showAll || hasPermission('attendance.edit');
  if (!canEdit) { showToast('Requires attendance.edit', 'error'); return; }

  const day = attDay(date);
  const row = day.rows.find(r => r.entry.empId === entry.empId);
  const rec = row ? row.rec : { shift: '—', checkIn: null, checkOut: null, status: 'Absent', source: '' };
  const reqNote = row && row.reqs.length
    ? `<div class="bg-orange-50 border border-orange-200 rounded-lg p-2.5">
        <p class="text-[9px] uppercase tracking-wide text-orange-700 font-semibold mb-1">Request on file for this day</p>
        ${row.reqs.map(q => `<p class="text-[11px] text-charcoal-800">• <b>${attEsc(q.type)}</b> — ${attEsc(q.status)}${q.reason ? ' · ' + attEsc(q.reason) : ''}</p>`).join('')}
      </div>`
    : '';

  openModal(`Attendance Correction — ${entry.name}`, `<form onsubmit="event.preventDefault();saveAttendanceCorrection('${entry.empId}','${date}',this);" class="space-y-3">
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 flex items-start gap-2">
      <svg class="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      <p class="text-[11px] text-yellow-800">Correcting attendance is audit-logged under <strong>${attEsc(MOCK.currentUser.fullName)}</strong>. Date <strong>${attShortDate(date)}</strong>, shift <strong>${attEsc(rec.shift)}</strong>.</p>
    </div>
    ${reqNote}
    <div class="grid grid-cols-2 gap-3">
      <div><label class="form-label" for="ac-in">Check In</label><input id="ac-in" type="time" class="form-input" value="${rec.checkIn || '08:00'}"></div>
      <div><label class="form-label" for="ac-out">Check Out</label><input id="ac-out" type="time" class="form-input" value="${rec.checkOut || '16:00'}"></div>
    </div>
    <div><label class="form-label" for="ac-status">Status</label>
      <select id="ac-status" class="form-select">
        ${['On Time', 'Late', 'Absent', 'Early Checkout', 'Off'].map(v => `<option ${v === rec.status ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <div><label class="form-label" for="ac-reason">Reason (required)</label><textarea id="ac-reason" class="form-input" rows="2" placeholder="Why is this record being corrected?" required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Correction</button></div>
  </form>`);
}

function saveAttendanceCorrection(empId, iso, form) {
  const entry = attRoster().find(x => x.empId === empId);
  if (!entry) { showToast('Employee not found', 'error'); return; }
  const reason = (form.querySelector('#ac-reason').value || '').trim();
  if (!reason) { showToast('A reason is required for every correction', 'error'); return; }

  const day = attDay(iso);
  const row = day.rows.find(r => r.entry.empId === empId);
  const rec = {
    employeeId: empId,
    name: entry.name,
    gym: entry.gym,
    date: iso,
    shift: row ? row.rec.shift : '—',
    checkIn: form.querySelector('#ac-in').value || null,
    checkOut: form.querySelector('#ac-out').value || null,
    status: form.querySelector('#ac-status').value,
    source: 'Manual',
    notes: 'Corrected: ' + reason,
    correctedBy: MOCK.currentUser.fullName,
    correctedAt: ATT_TODAY
  };

  const list = MOCK.attendanceRecords;
  const i = list.findIndex(r => r.employeeId === empId && r.date === iso);
  if (i >= 0) list[i] = rec; else list.push(rec);

  (MOCK.auditLog || []).unshift({
    id: 'al-' + Date.now(),
    action: 'Attendance Corrected',
    user: MOCK.currentUser.fullName,
    target: entry.name,
    detail: rec.status + ' on ' + attShortDate(iso) + ' — ' + reason,
    timestamp: ATT_TODAY,
    gym: entry.gym
  });

  attResetCache();
  closeModal();
  renderAll();
  showToast('Correction saved for ' + entry.name + ' · audit-logged');
}

function openManualEntry(dateISO) {
  const canManual = DEMO.showAll || hasPermission('attendance.manual_entry');
  if (!canManual) { showToast('Requires attendance.manual_entry', 'error'); return; }

  const date = dateISO || _attDay;
  const empOpts = attRoster().map(e => `<option value="${e.empId}">${attEsc(e.name)} — ${attEsc(e.gym)}</option>`).join('');
  openModal('Manual Attendance Entry', `<form onsubmit="event.preventDefault();saveManualEntry(this);" class="space-y-3">
    <div class="bg-brand-50 border border-brand-200 rounded-lg p-2.5 flex items-start gap-2">
      <svg class="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="text-[11px] text-brand-800">Record attendance by hand when the biometric terminal fails. Logged under <strong>${attEsc(MOCK.currentUser.fullName)}</strong>.</p>
    </div>
    <div><label class="form-label" for="me-emp">Employee</label><select id="me-emp" class="form-select">${empOpts}</select></div>
    <div class="grid grid-cols-3 gap-3">
      <div><label class="form-label" for="me-date">Date</label><input id="me-date" type="date" class="form-input" value="${date}"></div>
      <div><label class="form-label" for="me-in">Check In</label><input id="me-in" type="time" class="form-input" value="08:00"></div>
      <div><label class="form-label" for="me-out">Check Out</label><input id="me-out" type="time" class="form-input" value="16:00"></div>
    </div>
    <div><label class="form-label" for="me-status">Status</label><select id="me-status" class="form-select">${['On Time', 'Late', 'Absent', 'Early Checkout', 'Off'].map(v => `<option>${v}</option>`).join('')}</select></div>
    <div><label class="form-label" for="me-reason">Reason for manual entry</label><textarea id="me-reason" class="form-input" rows="2" placeholder="e.g. Biometric terminal out of service" required></textarea></div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Record Entry</button></div>
  </form>`);
}

function saveManualEntry(form) {
  const canManual = DEMO.showAll || hasPermission('attendance.manual_entry');
  if (!canManual) { showToast('Requires attendance.manual_entry', 'error'); return; }

  const empId = form.querySelector('#me-emp').value;
  const iso = form.querySelector('#me-date').value || _attDay;
  const reason = (form.querySelector('#me-reason').value || '').trim();
  const entry = attRoster().find(x => x.empId === empId);
  if (!entry) { showToast('Employee not found', 'error'); return; }

  const day = attDay(iso);
  const row = day.rows.find(r => r.entry.empId === empId);
  const rec = {
    employeeId: empId,
    name: entry.name,
    gym: entry.gym,
    date: iso,
    shift: row ? row.rec.shift : '—',
    checkIn: form.querySelector('#me-in').value || null,
    checkOut: form.querySelector('#me-out').value || null,
    status: form.querySelector('#me-status').value,
    source: 'Manual',
    notes: 'Manual entry: ' + reason,
    correctedBy: MOCK.currentUser.fullName,
    correctedAt: ATT_TODAY
  };

  const list = MOCK.attendanceRecords;
  const i = list.findIndex(r => r.employeeId === empId && r.date === iso);
  if (i >= 0) list[i] = rec; else list.push(rec);

  (MOCK.auditLog || []).unshift({
    id: 'al-' + Date.now(),
    action: 'Manual Attendance Entry',
    user: MOCK.currentUser.fullName,
    target: entry.name,
    detail: rec.status + ' on ' + attShortDate(iso) + ' — ' + reason,
    timestamp: ATT_TODAY,
    gym: entry.gym
  });

  attResetCache();
  closeModal();
  attPick(iso);
  showToast('Manual entry recorded for ' + entry.name);
}

// ==================== 6-DIGIT STATION PAIRING (HR PORTAL) ====================
function openPairStationModal() {
  const pendingRaw = localStorage.getItem('revive_pending_pairing');
  let pending = null;
  try {
    if (pendingRaw) pending = JSON.parse(pendingRaw);
  } catch (_) {}

  // Check if existing pending code is still valid (within 10 minutes)
  const isStillValid = pending && pending.expiresAt && pending.expiresAt > Date.now();
  const activeGym = typeof _attGym !== 'undefined' && _attGym !== 'all' ? _attGym : 'Downtown Gym';

  const modalHtml = `
    <div class="space-y-4">
      <div class="p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-charcoal-700 flex items-start gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        </div>
        <div>
          <p class="font-bold text-charcoal-900">Authorize Attendance Kiosk Terminal</p>
          <p class="text-[11px] text-charcoal-600 mt-0.5 leading-relaxed">
            Generate a secure 6-digit code for a gym branch. The terminal computer at the gym will enter this code on the Attendance Station page to bind itself strictly to that gym branch.
          </p>
        </div>
      </div>

      <!-- Gym Selection Form -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="form-label font-bold text-xs" for="pair-gym-select">Target Gym Branch <span class="text-red-500">*</span></label>
          <select id="pair-gym-select" class="form-select w-full text-xs font-semibold" onchange="updatePairingGymPreview(this.value)">
            <option value="2" data-name="Downtown Gym" data-code="DTN" ${activeGym.includes('Downtown') ? 'selected' : ''}>Downtown Gym (Branch ID: 2)</option>
            <option value="3" data-name="Zamalek Gym" data-code="ZMK" ${activeGym.includes('Zamalek') ? 'selected' : ''}>Zamalek Gym (Branch ID: 3)</option>
            <option value="4" data-name="New Cairo Gym" data-code="NCG" ${activeGym.includes('Cairo') ? 'selected' : ''}>New Cairo Gym (Branch ID: 4)</option>
          </select>
        </div>
        <div>
          <label class="form-label font-bold text-xs" for="pair-terminal-name">Terminal Label</label>
          <input type="text" id="pair-terminal-name" class="form-input text-xs font-mono" value="Front Entrance Kiosk #1" placeholder="e.g. Front Turnstile PC">
        </div>
      </div>

      <!-- Action: Generate Code Button -->
      <div>
        <button type="button" onclick="generateStationPairingCode()" class="btn btn-primary w-full py-2 flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>Generate 6-Digit Pairing Code</span>
        </button>
      </div>

      <!-- Active Code Display Card -->
      <div id="pair-code-display-card" class="${isStillValid ? '' : 'hidden'} p-4 rounded-2xl bg-charcoal-900 text-white text-center relative overflow-hidden border border-charcoal-700 shadow-xl">
        <div class="flex items-center justify-between text-[11px] text-charcoal-400 mb-2">
          <span class="flex items-center gap-1 font-semibold text-brand-400">
            <span class="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
            <span id="pair-card-branch-label">${isStillValid ? attEsc(pending.gymName) : 'Downtown Gym'}</span>
          </span>
          <span id="pair-timer-badge" class="font-mono text-charcoal-400">Valid for 10 min</span>
        </div>

        <div class="my-3 flex items-center justify-center gap-2">
          <span id="pair-code-text" class="text-3xl sm:text-4xl font-mono font-extrabold tracking-widest text-white px-4 py-2 rounded-xl bg-charcoal-800 border border-charcoal-600 shadow-inner">
            ${isStillValid ? pending.code.slice(0, 3) + ' ' + pending.code.slice(3) : '--- ---'}
          </span>
        </div>

        <p class="text-[11px] text-charcoal-300 max-w-sm mx-auto leading-relaxed">
          Open the Attendance Station on the branch computer and enter this code to bind it specifically to <strong id="pair-card-branch-sub" class="text-white">${isStillValid ? attEsc(pending.gymName) : 'Downtown Gym'}</strong>.
        </p>

        <div class="mt-4 pt-3 border-t border-charcoal-800 flex items-center justify-center gap-2 flex-wrap">
          <button type="button" onclick="copyStationPairingCode()" class="btn btn-sm btn-secondary text-xs flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <span>Copy Code</span>
          </button>
          <a href="../Attendance%20Station/" target="_blank" class="btn btn-sm btn-primary text-xs flex items-center gap-1">
            <span>Open Attendance Station</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
        </div>
      </div>

      <!-- Security details -->
      <div class="p-3 bg-charcoal-50 border border-charcoal-200 rounded-xl text-[11px] text-charcoal-600 space-y-1">
        <p class="font-bold text-charcoal-800">Branch Geofence Security Rules:</p>
        <ul class="list-disc list-inside space-y-0.5 text-charcoal-600">
          <li>Once connected, the station will strictly display only employees assigned to this gym.</li>
          <li>Staff from other branches attempting to check in will be blocked with HTTP 403.</li>
          <li>If the computer breaks down, simply generate a new code here and pair the replacement PC.</li>
        </ul>
      </div>
    </div>
  `;

  openModal('Pair Attendance Station (6-Digit Code)', modalHtml, { width: 'max-w-lg' });
}

function updatePairingGymPreview(gymId) {
  const sel = document.getElementById('pair-gym-select');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const name = opt ? opt.getAttribute('data-name') : 'Selected Gym';
  const sub = document.getElementById('pair-card-branch-sub');
  const lbl = document.getElementById('pair-card-branch-label');
  if (sub) sub.textContent = name;
  if (lbl) lbl.textContent = name;
}

function generateStationPairingCode() {
  const sel = document.getElementById('pair-gym-select');
  const opt = sel ? sel.options[sel.selectedIndex] : null;
  const gymId = Number(sel ? sel.value : 2);
  const gymName = opt ? opt.getAttribute('data-name') : 'Downtown Gym';
  const gymCode = opt ? opt.getAttribute('data-code') : 'DTN';
  const labelInput = document.getElementById('pair-terminal-name');
  const label = labelInput ? labelInput.value.trim() : 'Front Kiosk';

  // Generate 6 random digits
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  const pairingData = {
    code,
    gymId,
    gymName,
    gymCode,
    stationLabel: label,
    generatedAt: Date.now(),
    expiresAt
  };

  localStorage.setItem('revive_pending_pairing', JSON.stringify(pairingData));

  // Update UI card
  const card = document.getElementById('pair-code-display-card');
  if (card) card.classList.remove('hidden');
  const textEl = document.getElementById('pair-code-text');
  if (textEl) textEl.textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
  const sub = document.getElementById('pair-card-branch-sub');
  if (sub) sub.textContent = gymName;
  const lbl = document.getElementById('pair-card-branch-label');
  if (lbl) lbl.textContent = gymName;
  const timerBadge = document.getElementById('pair-timer-badge');
  if (timerBadge) timerBadge.textContent = 'Expires in 10:00';

  showToast(`6-Digit Pairing Code ${code.slice(0, 3)}-${code.slice(3)} generated for ${gymName}!`);
}

function copyStationPairingCode() {
  const raw = localStorage.getItem('revive_pending_pairing');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    navigator.clipboard.writeText(data.code).then(() => {
      showToast(`Copied code ${data.code} to clipboard`);
    }).catch(() => {
      showToast(`Code: ${data.code}`);
    });
  } catch (_) {}
}
