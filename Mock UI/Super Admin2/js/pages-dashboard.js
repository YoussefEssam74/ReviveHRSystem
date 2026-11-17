// ==================== PAGE: DASHBOARD ====================
// Deliberately narrow: only what a platform owner must know on entering the console —
// the size of the business, and what needs a decision today.
function renderDashboard() {
  const t = platformTotals();
  const r = revenueTotals();
  const growth = USER_GROWTH[USER_GROWTH.length - 1].users - USER_GROWTH[USER_GROWTH.length - 2].users;
  const seatPct = t.seatCapacity ? Math.round((t.seatsOnLimitedPlans / t.seatCapacity) * 100) : 0;

  return `
  ${pageHeader(
    'Platform overview',
    `${t.totalGyms} gym accounts · ${formatNumber(t.totalUsers)} users · ${formatMoney(r.mrr)} monthly recurring`,
    `<button onclick="startGymWizard()" class="btn btn-primary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      Create gym account
    </button>
    <button onclick="openCreateHRManager()" class="btn btn-secondary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
      Create HR manager
    </button>`
  )}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${kpiTile('Gym accounts', formatNumber(t.totalGyms), gymSummaryLine(t), 'building')}
    ${kpiTile('Total users', formatNumber(t.totalUsers), `+${growth} this month · ${t.hrManagers} HR managers`, 'users')}
    ${kpiTile('Monthly revenue', formatMoney(r.mrr), r.overdue ? `${formatMoney(r.overdue)} overdue` : 'all invoices settled', 'card')}
    ${kpiTile('Seat utilisation', `${seatPct}%`, `${formatNumber(t.seatsOnLimitedPlans)} of ${formatNumber(t.seatCapacity)} capped seats`, 'chart')}
  </div>

  <div class="grid grid-cols-1 xl:grid-cols-3 xl:grid-rows-1 gap-3 grow min-h-0">
    <div class="xl:col-span-2 min-h-0 flex flex-col">${dashboardGymsTable()}</div>
    <div class="min-h-0 flex flex-col">${dashboardAttentionCard()}</div>
  </div>`;
}

function gymSummaryLine(t) {
  const parts = [`${t.activeGyms} active`];
  if (t.trialGyms) parts.push(`${t.trialGyms} trial`);
  if (t.overdueGyms) parts.push(`${t.overdueGyms} overdue`);
  if (t.suspendedGyms) parts.push(`${t.suspendedGyms} suspended`);
  return parts.join(' · ');
}

function dashboardGymsTable() {
  const rows = GYMS.map((gym) => `<tr class="is-clickable" onclick="navigateTo('gym-detail',{gymId:'${gym.id}'})">
      <td>
        <div class="flex items-center gap-2 min-w-0">
          ${gymLogo(gym, 36)}
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-xs font-semibold text-charcoal-800 truncate leading-tight">${esc(gym.name)}</p>
              ${planBadge(gym.planId)}
            </div>
            <p class="text-[10px] text-charcoal-500 truncate leading-tight">${esc(gym.location)} · ${esc(gym.code)}</p>
          </div>
        </div>
      </td>
      <td class="text-right whitespace-nowrap">
        <span class="text-xs font-semibold text-charcoal-800">${formatNumber(gym.userCounts.total)}</span>
        ${gym.seatLimit ? `<span class="text-[10px] text-charcoal-400">/${gym.seatLimit}</span>` : ''}
      </td>
      <td class="text-right whitespace-nowrap">
        ${gym.mrr ? `<span class="text-xs font-semibold text-charcoal-800">${formatMoney(gym.mrr)}</span>` : '<span class="text-[10px] text-blue-600 font-medium">Trial</span>'}
      </td>
      <td class="whitespace-nowrap">
        <span class="text-[11px] text-charcoal-600">${formatDate(gym.renewsOn)}</span>
        <p class="text-[9px] text-charcoal-400">in ${Math.max(0, daysBetween(PLATFORM.today, gym.renewsOn))} days</p>
      </td>
      <td>${statusBadge(gym.status)}</td>
    </tr>`).join('');

  return `<div class="card card-grow">
    <div class="card-head">
      <p class="bento-label flex-1">Gym accounts</p>
      <button onclick="navigateTo('gyms')" class="btn btn-sm btn-ghost text-brand-700">Manage accounts →</button>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Gym account</th>
          <th class="text-right">Users</th>
          <th class="text-right">MRR</th>
          <th>Renews</th>
          <th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function dashboardAttentionCard() {
  const alerts = activeAlerts();
  const rows = alerts.map((a) => {
    const target = a.page === 'gym-detail' ? `navigateTo('gym-detail',{gymId:'${a.gymId}'})` : `navigateTo('${a.page}')`;
    return `<button onclick="${target}" class="w-full text-left px-3 py-2.5 hover:bg-charcoal-50 flex items-start gap-2 border-b border-charcoal-100 last:border-0">
      <span class="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${a.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[11px] font-semibold text-charcoal-800 leading-tight">${esc(a.title)}</span>
        <span class="block text-[10px] text-charcoal-500 leading-snug mt-0.5">${esc(a.detail)}</span>
        <span class="inline-block text-[10px] font-semibold text-brand-700 mt-1">${esc(a.action)} →</span>
      </span>
    </button>`;
  }).join('');

  return `<div class="card card-grow">
    <div class="card-head">
      <p class="bento-label flex-1">Needs your attention</p>
      <span class="badge badge-red">${alerts.length}</span>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto">${rows}</div>
    <div class="px-3 py-2 border-t border-charcoal-100">
      <button onclick="navigateTo('audit')" class="btn btn-sm btn-ghost text-brand-700 w-full">Open the audit log →</button>
    </div>
  </div>`;
}
