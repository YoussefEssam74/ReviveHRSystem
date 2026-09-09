// ==================== REPORTS & ANALYTICS ====================
let _repPeriod = '30d';

function renderReports() {
  const canView = DEMO.showAll || hasPermission('reports.view');
  if (!canView) return `<div class="space-y-3"><h1 class="text-xl font-bold text-charcoal-900">Reports & Analytics</h1><div class="bg-white rounded-xl border border-charcoal-200 p-10 text-center"><p class="text-xs text-charcoal-500">You do not have permission to view reports (<code>reports.view</code>).</p></div></div>`;

  const headcount = MOCK.gymList.reduce((s, g) => s + g.employees, 0);
  const activeEmps = MOCK.employees.filter(e => e.status === 'Active').length;
  const onTime = MOCK.attendanceRecords.filter(r => r.status === 'On Time').length;
  const late = MOCK.attendanceRecords.filter(r => r.status === 'Late').length;
  const absorbed = onTime + late;
  const attRate = Math.round((absorbed / mathMax(MOCK.attendanceRecords.length, 1)) * 100);
  const turnover = 4;
  const avgTenureMonths = 14;

  const headcountTrend = [128, 131, 134, 137, 139, 141, headcount];
  const attTrend = [88, 91, 84, 93, 76, 89, attRate];
  const reqs = MOCK.requests;
  const reqTypes = ['Day Off', 'Leave Early', 'Late Arrival', 'Shift Swap'].map(t => ({ label: t, val: reqs.filter(r => r.type === t).length }));

  const deptDist = [
    { label: 'Training', val: 58, color: '#006c49' },
    { label: 'Front Desk', val: 24, color: '#2563eb' },
    { label: 'Facilities', val: 22, color: '#d97706' },
    { label: 'Management', val: 4, color: '#7c3aed' },
  ];
  const deptTotal = deptDist.reduce((s, d) => s + d.val, 0);
  let acc = 0;
  const donutSegs = deptDist.map(d => { const o = `${acc} ${acc + (d.val / deptTotal) * 100}%`; acc += (d.val / deptTotal) * 100; return { ...d, seg: o }; }).join(',');

  const funnel = [
    ['Applied', MOCK.candidates.length],
    ['Screening', MOCK.candidates.filter(c => ['Screening','Interview','Offer','Hired'].includes(c.stage)).length],
    ['Interview', MOCK.candidates.filter(c => ['Interview','Offer','Hired'].includes(c.stage)).length],
    ['Offer', MOCK.candidates.filter(c => ['Offer','Hired'].includes(c.stage)).length],
    ['Hired', MOCK.candidates.filter(c => c.stage === 'Hired').length],
  ];
  const funnelMax = Math.max(...funnel.map(f => f[1]), 1);
  const topGyms = [...MOCK.gymList].sort((a, b) => b.employees - a.employees);
  const topTeams = [
    { name: 'Training — Nasr City', kpi: '92% attendance', score: 92, color: 'bg-brand-500' },
    { name: 'Front Desk — Heliopolis', kpi: '88% attendance', score: 88, color: 'bg-blue-500' },
    { name: 'Facilities — 6th October', kpi: '85% attendance', score: 85, color: 'bg-purple-500' },
  ];

  const kpis = [
    ['Headcount', headcount, 'brand', 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', '+13 this year'],
    ['Active', activeEmps, 'green', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', `${Math.round((activeEmps/headcount)*100)}% of posts`],
    ['Attendance', attRate + '%', 'blue', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', '7-day avg'],
    ['Turnover (YTD)', turnover + '%', 'red', 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z', 'vs 5% LY'],
    ['Avg Tenure', avgTenureMonths + ' mo', 'yellow', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'steady'],
  ];
  const kpiColors = { brand:['bg-brand-100','text-brand-600'], green:['bg-green-100','text-green-600'], blue:['bg-blue-100','text-blue-600'], red:['bg-red-100','text-red-600'], yellow:['bg-yellow-100','text-yellow-600'] };

  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Reports & Analytics</h1><p class="text-xs text-charcoal-500 mt-0.5">Headcount, attendance, recruiting & request analytics</p></div>
      <div class="flex items-center gap-1.5">
        <select class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.8125rem"><option>Last 30 days</option><option>This quarter</option><option>This year</option></select>
        <button onclick="showToast('Report exported')" class="btn btn-sm btn-secondary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Export</button>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-2">
      ${kpis.map(([label, val, color, icon, sub], i) => `<div class="bg-white rounded-xl border border-charcoal-200 p-3 ${i === 0 ? 'border-l-4 border-l-brand-500' : ''}">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-lg ${kpiColors[color][0]} flex items-center justify-center flex-shrink-0"><svg class="w-4.5 h-4.5 ${kpiColors[color][1]}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/></svg></div>
          <div><p class="text-xl font-bold text-charcoal-900">${val}</p><p class="text-[10px] text-charcoal-500">${label}</p></div>
        </div>
        <p class="text-[9px] text-charcoal-400 mt-1.5">${sub}</p>
      </div>`).join('')}
    </div>

    <!-- Headcount + Attendance + Donut -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden lg:col-span-1">
        <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">HEADCOUNT BY GYM</p></div>
        <div class="p-3 space-y-2.5">
          ${topGyms.map(g => `<div>
            <div class="flex items-center justify-between text-[11px]"><span class="text-charcoal-700 font-medium">${g.branch}</span><span class="text-charcoal-500">${g.employees}</span></div>
            <div class="w-full h-1.5 bg-charcoal-100 rounded-full mt-1"><div class="h-full bg-brand-500 rounded-full" style="width:${Math.round((g.employees / mathMax(headcount, 1)) * 100)}%"></div></div>
          </div>`).join('')}
          <div class="border-t border-charcoal-100 pt-2 flex items-center justify-between text-[11px]"><span class="font-semibold text-charcoal-900">Total</span><span class="font-bold text-brand-700">${headcount}</span></div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden lg:col-span-1">
        <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/50"><p class="bento-label">ATTENDANCE TREND</p><span class="badge badge-brand text-[9px]">${attRate}% avg</span></div>
        <div class="p-3 flex items-end gap-2 h-40">
          ${attTrend.map((pct, i) => `<div class="flex-1 flex flex-col items-center gap-1 justify-end h-full">
            <span class="text-[8px] text-charcoal-400">${pct}%</span>
            <div class="w-full rounded-t-md ${i === attTrend.length - 1 ? 'bg-brand-500' : 'bg-brand-200'}" style="height:${pct}%"></div>
            <span class="text-[8px] text-charcoal-400">${['W1','W2','W3','W4','W5','W6','Now'][i]}</span>
          </div>`).join('')}
        </div>
      </div>

      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden lg:col-span-1">
        <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">HEADCOUNT TREND</p></div>
        <div class="p-3 flex items-end gap-2 h-40">
          ${headcountTrend.map((hc, i) => `<div class="flex-1 flex flex-col items-center gap-1 justify-end h-full">
            <span class="text-[8px] text-charcoal-400">${hc}</span>
            <div class="w-full rounded-t-md bg-blue-400" style="height:${Math.round((hc / 150) * 100)}%"></div>
            <span class="text-[8px] text-charcoal-400">${['Mar','Apr','May','Jun','Jul','Aug','Now'][i]}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <!-- Department donut -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">DEPARTMENT MIX</p></div>
        <div class="p-3 flex items-center gap-4">
          <div class="w-28 h-28 rounded-full flex-shrink-0" style="background:conic-gradient(${donutSegs})"></div>
          <div class="space-y-1.5 flex-1">${deptDist.map(d => `<div class="flex items-center gap-1.5 text-[10px]"><span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${d.color}"></span><span class="text-charcoal-600 flex-1">${d.label}</span><span class="font-bold text-charcoal-900">${d.val}</span></div>`).join('')}</div>
        </div>
      </div>

      <!-- Recruitment funnel -->
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">RECRUITMENT FUNNEL</p></div>
        <div class="p-3 space-y-2">
          ${funnel.map(([stage, n]) => `<div>
            <div class="flex items-center justify-between text-[11px]"><span class="text-charcoal-700 font-medium">${stage}</span><span class="text-charcoal-500">${n}</span></div>
            <div class="w-full h-1.5 bg-charcoal-100 rounded-full mt-1"><div class="h-full bg-purple-400 rounded-full" style="width:${Math.max(6, Math.round((n / funnelMax) * 100))}%"></div></div>
          </div>`).join('')}
          <p class="text-[9px] text-charcoal-400 pt-1">Convert to hire: ${MOCK.candidates.length ? Math.round((MOCK.candidates.filter(c => c.stage === 'Hired').length / MOCK.candidates.length) * 100) : 0}%</p>
        </div>
      </div>

      <!-- Top teams + request volume -->
      <div class="space-y-3">
        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
          <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">TOP TEAMS</p></div>
          <div class="p-3 space-y-2.5">
            ${topTeams.map(t => `<div>
              <div class="flex items-center justify-between text-[11px]"><span class="text-charcoal-700 font-medium">${t.name}</span><span class="text-charcoal-500">${t.kpi}</span></div>
              <div class="w-full h-1.5 bg-charcoal-100 rounded-full mt-1"><div class="h-full ${t.color} rounded-full" style="width:${t.score}%"></div></div>
            </div>`).join('')}
          </div>
        </div>
        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
          <div class="px-4 py-2.5 border-b border-charcoal-100 bg-charcoal-50/50"><p class="bento-label">REQUEST VOLUME (SEPT)</p></div>
          <div class="p-3">
            <div class="flex justify-around text-center py-2">
              ${reqTypes.map(t => `<div><p class="text-lg font-bold text-brand-600">${t.val}</p><p class="text-[9px] text-charcoal-500">${t.label}</p></div>`).join('')}
            </div>
            <div class="flex justify-between text-[10px] text-charcoal-500 border-t border-charcoal-100 pt-2">
              <span>Pending HR: <strong class="text-charcoal-800">${reqs.filter(r => r.status === 'Pending HR Review').length}</strong></span>
              <span>Approved: <strong class="text-charcoal-800">${reqs.filter(r => r.status === 'Approved').length}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ==================== POSITIONS & LEVELS ====================
function renderPositions() {
  const canManage = DEMO.showAll || hasPermission('positions.manage');
  const positions = MOCK.positions;
  const totalOpen = positions.reduce((s, p) => s + Math.max(0, p.headcount - p.active), 0);
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Positions & Levels</h1><p class="text-xs text-charcoal-500 mt-0.5">${positions.length} positions · ${positions.reduce((s, p) => s + p.headcount, 0)} headcount slots · ${totalOpen} currently open</p></div>
      ${canManage ? `<button onclick="showToast('Position creation — simulated')" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Position</button>` : ''}
    </div>
    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden hidden lg:block">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Position</th><th>Department</th><th>Levels</th><th>Created</th><th>Filled</th><th>Open</th><th>Fill rate</th><th></th></tr></thead>
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
      }).join('')}</tbody></table></div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:hidden">
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
    ${!canManage ? `<p class="text-[10px] text-charcoal-400 text-center">Position management requires <code>positions.manage</code> (HR Manager). View-only.</p>` : ''}
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
    <div class="space-y-1.5">${notifs.map(n => `<div class="bg-white rounded-xl border border-charcoal-200 p-3 flex items-start gap-3 ${n.read ? 'opacity-70' : ''}">
      <div class="w-8 h-8 rounded-full ${colorMap[n.color] || 'bg-charcoal-100 text-charcoal-600'} flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2"><p class="text-xs font-medium text-charcoal-900">${n.title}${!n.read ? '<span class="w-2 h-2 rounded-full bg-brand-500 inline-block ml-1.5"></span>' : ''}</p><span class="text-[9px] text-charcoal-400 whitespace-nowrap">${n.date}</span></div>
        <p class="text-[10px] text-charcoal-600 mt-0.5">${n.description}</p>
        <div class="flex items-center gap-2 mt-1"><span class="badge badge-gray text-[9px]">${n.category}</span>${n.link ? `<button onclick="navigateTo('${n.link}')" class="text-[9px] text-brand-600 font-semibold hover:underline">Open →</button>` : ''}</div>
      </div>
    </div>`).join('')}</div>`;
  } else {
    body = `<div class="space-y-1.5">${MOCK.announcements.map(a => `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
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

  return `<div class="space-y-3">
    <div><h1 class="text-xl font-bold text-charcoal-900">Notifications & Announcements</h1><p class="text-xs text-charcoal-500 mt-0.5">System notifications and company announcements</p></div>
    <div class="flex border-b border-charcoal-100">${tabs.map(t => `<button onclick="_notifTab='${t.id}';renderAll()" class="tab-btn ${_notifTab === t.id ? 'active' : ''}">${t.label}${t.count ? ` <span class="badge badge-red text-[9px] ml-0.5">${t.count}</span>` : ''}</button>`).join('')}</div>
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
  if (!canView) return `<div class="space-y-3"><h1 class="text-xl font-bold text-charcoal-900">Activity / Audit Log</h1><div class="bg-white rounded-xl border border-charcoal-200 p-10 text-center"><p class="text-xs text-charcoal-500">You do not have permission to view the audit log (<code>audit.view</code>).</p></div></div>`;
  return `<div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h1 class="text-xl font-bold text-charcoal-900">Activity / Audit Log</h1><p class="text-xs text-charcoal-500 mt-0.5">${MOCK.auditLog.length} recorded events · HR Manager only</p></div>
      <div class="flex items-center gap-1.5">
        <select class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.75rem"><option>All Actions</option><option>Employee</option><option>Payroll</option><option>Recruitment</option><option>Bulk Import</option></select>
        <select class="form-select w-auto" style="padding:0.375rem 2rem 0.375rem 0.625rem;font-size:0.75rem"><option>All Gyms</option><option>Nasr City</option><option>Heliopolis</option><option>6th October</option></select>
      </div>
    </div>
    <div class="bg-white rounded-xl border border-charcoal-200 divide-y divide-charcoal-50">
      ${MOCK.auditLog.map(a => `<div class="p-3 flex items-start gap-3">
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

// ==================== EVENTS ====================
function renderEvents() {
  const urgMap = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
  const sorted = [...MOCK.events].sort((a, b) => (a.date > b.date ? 1 : -1));
  return `<div class="space-y-3">
    <div><h1 class="text-xl font-bold text-charcoal-900">Events</h1><p class="text-xs text-charcoal-500 mt-0.5">Upcoming HR events and expiry tracking</p></div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-red-500"><p class="text-lg font-bold text-red-600">${MOCK.events.filter(e => e.urgency === 'high').length}</p><p class="text-[10px] text-charcoal-500">High urgency</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-yellow-600">${MOCK.events.filter(e => e.urgency === 'medium').length}</p><p class="text-[10px] text-charcoal-500">Upcoming</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-charcoal-900">${MOCK.events.filter(e => e.type === 'Document Expiry' || e.type === 'Contract Expiry').length}</p><p class="text-[10px] text-charcoal-500">Expiries</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-purple-600">${MOCK.events.filter(e => e.type === 'Resignation').length}</p><p class="text-[10px] text-charcoal-500">Resignations</p></div>
    </div>
    <div class="space-y-1.5">${sorted.map(e => `<div class="bg-white rounded-xl border border-charcoal-200 p-3 flex items-start gap-3 border-l-4 ${e.urgency === 'high' ? 'border-l-red-500' : e.urgency === 'medium' ? 'border-l-yellow-400' : 'border-l-gray-300'}">
      <div class="w-9 h-9 rounded-lg bg-charcoal-50 flex items-center justify-center flex-shrink-0"><svg class="w-4 h-4 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2 flex-wrap"><p class="text-xs font-medium text-charcoal-900">${e.title}</p><span class="badge ${urgMap[e.urgency] || 'badge-gray'} text-[9px]">${e.type}</span></div>
        <p class="text-[10px] text-charcoal-600 mt-0.5">${e.detail}</p>
        <p class="text-[9px] text-charcoal-400 mt-1">${formatDate(e.date)}</p>
      </div>
    </div>`).join('')}</div>
  </div>`;
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

  return `<div class="space-y-3">
    <div><h1 class="text-xl font-bold text-charcoal-900">My Access</h1><p class="text-xs text-charcoal-500 mt-0.5">Gyms you cover and permissions granted to your ${u.role} role</p></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="bg-white rounded-xl border border-brand-200 border-l-4 border-l-brand-500 p-3">
        <p class="bento-label text-brand-700 mb-2">ASSIGNED GYMS</p>
        <div class="space-y-2">${u.gyms.map(g => `<div class="flex items-center gap-2.5">
          <span class="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0"></span>
          <div><p class="text-xs font-medium text-charcoal-900">${g.name}</p><p class="text-[10px] text-charcoal-500">${g.branch}</p></div>
        </div>`).join('')}</div>
      </div>
      <div class="lg:col-span-2 bg-white rounded-xl border border-charcoal-200 p-3">
        <p class="bento-label text-charcoal-500 mb-2">PERMISSION SUMMARY</p>
        <div class="flex flex-wrap gap-2">
          <span class="badge badge-brand">${granted} granted</span>
          <span class="badge badge-gray">${allPerms.size} tracked</span>
        </div>
        <div class="w-full h-2 bg-charcoal-100 rounded-full mt-3"><div class="h-full bg-brand-500 rounded-full" style="width:${Math.round((granted / mathMax(allPerms.size, 1)) * 100)}%"></div></div>
        <p class="text-[9px] text-charcoal-400 mt-1">${Math.round((granted / mathMax(allPerms.size, 1)) * 100)}% of HR trackable permissions</p>
      </div>
    </div>
    ${showMatrix ? matrixGrid : ''}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">${groupHtml}</div>
    ${perms.includes('*') ? `<p class="text-[10px] text-charcoal-400 text-center">Wildcard access (`*`) present — all permissions granted.</p>` : ''}
  </div>`;
}