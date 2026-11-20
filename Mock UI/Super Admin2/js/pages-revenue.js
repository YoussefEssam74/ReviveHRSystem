// ==================== PAGE: REVENUE ANALYSES ====================
// The overview answers "how are we doing?" in four numbers and one trend line.
// Everything that would bloat it lives one click away: each headline card opens its
// own breakdown page, so the summary stays scannable and the detail stays complete.

// ---------- derived data ----------

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Billing periods present in the ledger, newest first.
function invoiceMonths() {
  const seen = [...new Set(INVOICES.map((i) => i.period))];
  return seen.sort((a, b) => {
    const [ma, ya] = a.split(' ');
    const [mb, yb] = b.split(' ');
    return (Number(yb) - Number(ya)) || (MONTH_ORDER.indexOf(mb) - MONTH_ORDER.indexOf(ma));
  });
}

function currentRevenuePeriod() {
  const months = invoiceMonths();
  return state.revenuePeriod && months.includes(state.revenuePeriod) ? state.revenuePeriod : (months[0] || 'Nov 2026');
}

function previousPeriodOf(period) {
  const months = invoiceMonths();
  const idx = months.indexOf(period);
  return idx >= 0 ? (months[idx + 1] || null) : null;
}

function totalMrr() {
  return GYMS.reduce((s, g) => s + g.mrr, 0);
}

function revenueForPeriod(period) {
  const rows = INVOICES.filter((inv) => inv.period === period);
  const billed = rows.reduce((s, inv) => s + inv.amount, 0);
  const collected = rows.filter((inv) => inv.status === 'Paid').reduce((s, inv) => s + inv.amount, 0);
  const outstanding = rows.filter((inv) => inv.status !== 'Paid').reduce((s, inv) => s + inv.amount, 0);
  return { billed, collected, outstanding, count: rows.length, mrr: totalMrr() };
}

function revenuePerGym(period) {
  return GYMS.map((gym) => {
    const rows = INVOICES.filter((inv) => inv.gymId === gym.id && inv.period === period);
    return {
      gym,
      plan: PLANS.find((p) => p.id === gym.planId),
      mrr: gym.mrr,
      billed: rows.reduce((s, inv) => s + inv.amount, 0),
      collected: rows.filter((inv) => inv.status === 'Paid').reduce((s, inv) => s + inv.amount, 0),
      outstanding: rows.filter((inv) => inv.status !== 'Paid').reduce((s, inv) => s + inv.amount, 0),
      overdue: rows.some((inv) => inv.status === 'Overdue'),
      trial: rows.some((inv) => inv.status === 'Trial'),
    };
  }).sort((a, b) => b.mrr - a.mrr);
}

function planMix() {
  return PLANS.map((plan) => {
    const gyms = GYMS.filter((g) => g.planId === plan.id);
    return { plan, gyms: gyms.length, mrr: gyms.reduce((s, g) => s + g.mrr, 0) };
  }).filter((row) => row.gyms > 0).sort((a, b) => b.mrr - a.mrr);
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function invoiceDaysLate(inv) {
  if (inv.status === 'Paid') return 0;
  return Math.max(0, daysBetween(inv.issued, PLATFORM.today.slice(0, 10)));
}

function daysToPay(inv) {
  if (!inv.paid) return null;
  return Math.max(0, daysBetween(inv.issued, inv.paid));
}

// ---------- small pieces ----------

function deltaChip(change) {
  const rounded = Math.round(change * 10) / 10;
  if (!rounded) return '<span class="badge badge-gray">0.0%</span>';
  const up = rounded > 0;
  return `<span class="badge ${up ? 'badge-green' : 'badge-red'}">
    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="${up ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}"/></svg>
    ${up ? '+' : ''}${rounded.toFixed(1)}%</span>`;
}

const METRICS = {
  mrr: { title: 'Monthly recurring revenue', label: 'Monthly revenue · MRR', icon: 'coins' },
  gross: { title: 'Revenue gross', label: 'Revenue gross', icon: 'chart' },
  collected: { title: 'Collected revenue', label: 'Collected', icon: 'check' },
  outstanding: { title: 'Outstanding revenue', label: 'Outstanding', icon: 'alert' },
};

// A headline number that behaves like a door, not a dead end.
function metricCard(metric, value, subHtml, tone) {
  const meta = METRICS[metric];
  return `<button type="button" class="stat-card" onclick="navigateTo('revenue-detail',{metric:'${metric}'})">
    <span class="stat-card-head">
      <svg class="stat-card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="${KPI_ICONS[meta.icon]}"/></svg>
      <span class="stat-label">${esc(meta.label)}</span>
      <svg class="stat-card-chev" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 5l7 7-7 7"/></svg>
    </span>
    <span class="stat-value ${tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : ''}">${value}</span>
    <span class="stat-sub">${subHtml}</span>
  </button>`;
}

function revenueBreadcrumb(metric) {
  return `<div class="flex items-center gap-1.5 text-[10px] mb-1">
    <button onclick="navigateTo('revenue')" class="text-charcoal-400 font-medium hover:text-brand-700 transition-colors">Revenue analyzes</button>
    <svg class="w-2.5 h-2.5 text-charcoal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
    <span class="text-charcoal-600 font-semibold">${esc(METRICS[metric].title)}</span>
  </div>`;
}

function periodSelect(current, onchange) {
  return `<select class="form-select form-input-sm w-auto" onchange="${onchange}" aria-label="Reporting period">
    ${invoiceMonths().map((p) => `<option value="${p}"${p === current ? ' selected' : ''}>${p}</option>`).join('')}
  </select>`;
}

// A labelled stat used on the breakdown pages.
function detailStat(label, value, tone) {
  return `<div class="card px-3 py-2.5">
    <p class="stat-label">${esc(label)}</p>
    <p class="stat-value ${tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : tone === 'brand' ? 'text-brand-700' : ''} mt-0.5">${value}</p>
  </div>`;
}

function detailHeader(metric, subtitle, period, extraActions) {
  return pageHeader(METRICS[metric].title, subtitle, `${periodSelect(period, 'setRevenuePeriod(this.value)')}${extraActions || ''}`);
}

function barRow(label, value, max, tone) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return `<div class="bar-row">
    <span class="bar-label">${esc(label)}</span>
    <div class="meter flex-1"><div class="meter-fill${tone ? ' ' + tone : ''}" style="width:${pct}%"></div></div>
    <span class="bar-value">${formatMoneyShort(value)}</span>
  </div>`;
}

// ---------- overview ----------

function renderRevenue() {
  const period = currentRevenuePeriod();
  const previousPeriod = previousPeriodOf(period);
  const current = revenueForPeriod(period);
  const previous = previousPeriod ? revenueForPeriod(previousPeriod) : null;
  const payingGyms = GYMS.filter((g) => g.mrr > 0).length;
  const share = current.billed ? Math.round((current.collected / current.billed) * 100) : 100;

  return `
  ${pageHeader(
    'Revenue analyzes',
    `${formatMoney(current.mrr)} recurring · ${formatMoney(current.billed)} billed in ${period}`,
    `${periodSelect(period, 'setRevenuePeriod(this.value)')}
    <button onclick="toast('Revenue report queued as CSV — prototype only','info')" class="btn btn-secondary btn-sm">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
      Export
    </button>`
  )}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${metricCard('mrr', formatMoney(current.mrr),
      `${payingGyms} paying of ${GYMS.length} gyms${previous ? ` · ${deltaChip(pctChange(current.mrr, previous.mrr))} vs ${esc(previousPeriod)}` : ''}`)}
    ${metricCard('gross', formatMoney(current.billed),
      previous ? `${deltaChip(pctChange(current.billed, previous.billed))} vs ${esc(previousPeriod)}` : `${current.count} invoices raised`)}
    ${metricCard('collected', formatMoney(current.collected),
      previous ? `${deltaChip(pctChange(current.collected, previous.collected))} vs ${esc(previousPeriod)}` : `${share}% of billed`,
      current.collected < current.billed ? 'amber' : '')}
    ${metricCard('outstanding', formatMoney(current.outstanding),
      current.outstanding ? `${100 - share}% of ${esc(period)} still unpaid` : 'fully settled',
      current.outstanding ? 'red' : '')}
  </div>

  ${revenueTrendCard()}

  <div class="card card-grow">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Revenue per gym</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${esc(period)} · sorted by recurring revenue</p>
      </div>
      <span class="badge badge-gray">${GYMS.length} accounts</span>
    </div>
    ${revenuePerGymTable(period)}
  </div>`;
}

function revenueTrendCard() {
  const series = REVENUE_HISTORY.map((m) => ({ label: m.label, mrr: m.mrr }));
  const first = series[0].mrr;
  const last = series[series.length - 1].mrr;

  return `<div class="card mb-3">
    <div class="flex items-center justify-between gap-2 px-3 pt-2">
      <p class="bento-label">Recurring revenue · last 12 months</p>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        ${deltaChip(pctChange(last, first))}
        <span class="text-[10px] text-charcoal-400">since ${series[0].label}</span>
      </div>
    </div>
    <div class="px-3 pt-1 pb-1">
      ${areaChart(series, { key: 'mrr', height: 92, step: 25000, color: '#006c49', label: 'Monthly recurring revenue trend', format: (v) => formatMoneyShort(v) })}
    </div>
  </div>`;
}

function revenuePerGymTable(period) {
  const total = totalMrr();
  const rows = revenuePerGym(period);
  if (!rows.length) return `<div>${emptyState('No gym accounts yet')}</div>`;

  let sumCollected = 0, sumOutstanding = 0;
  const body = rows.map((r) => {
    const share = total ? Math.round((r.mrr / total) * 100) : 0;
    sumCollected += r.collected;
    sumOutstanding += r.outstanding;
    const status = r.trial
      ? '<span class="badge badge-blue">Trial</span>'
      : r.overdue
        ? '<span class="badge badge-red">Overdue</span>'
        : r.outstanding > 0
          ? '<span class="badge badge-amber">Part paid</span>'
          : '<span class="badge badge-green">Settled</span>';
    return `<tr class="is-clickable" onclick="navigateTo('gym-detail',{gymId:'${r.gym.id}'})">
      <td>
        <div class="flex items-center gap-2 min-w-0">
          ${gymLogo(r.gym, 24)}
          <div class="min-w-0">
            <p class="text-[11px] font-semibold text-charcoal-800 truncate leading-tight">${esc(r.gym.name)}</p>
            <p class="text-[9px] text-charcoal-400 truncate leading-tight">${esc(r.gym.location)} · ${esc(r.gym.code)}</p>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap">
        <p class="text-[11px] text-charcoal-700 leading-tight">${esc(r.plan ? r.plan.name : '—')}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight">${esc(r.plan ? planCycleName(r.plan) : '')}</p>
      </td>
      <td class="text-right whitespace-nowrap">
        <span class="text-xs font-semibold text-charcoal-800 tabular-nums">${formatMoney(r.mrr)}</span>
      </td>
      <td class="w-32">
        <div class="flex items-center gap-1.5">
          <div class="meter flex-1"><div class="meter-fill" style="width:${share}%"></div></div>
          <span class="text-[9px] text-charcoal-500 w-7 text-right tabular-nums">${share}%</span>
        </div>
      </td>
      <td class="text-right whitespace-nowrap">
        <span class="text-[11px] font-semibold ${r.collected ? 'text-brand-700' : 'text-charcoal-400'} tabular-nums">${r.collected ? formatMoney(r.collected) : '—'}</span>
      </td>
      <td class="text-right whitespace-nowrap">
        <span class="text-[11px] font-semibold ${r.outstanding ? 'text-red-600' : 'text-charcoal-400'} tabular-nums">${r.outstanding ? formatMoney(r.outstanding) : '—'}</span>
      </td>
      <td class="whitespace-nowrap">
        <p class="text-[10px] text-charcoal-600 leading-tight">${formatDate(r.gym.renewsOn)}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight">${esc(r.gym.billingCycle || '')}</p>
      </td>
      <td class="whitespace-nowrap">${status}</td>
    </tr>`;
  }).join('');

  return `<div class="data-table-wrap flex-1">
    <table class="data-table">
      <thead><tr>
        <th>Gym account</th><th>Plan</th><th class="text-right">MRR</th><th>Share of MRR</th>
        <th class="text-right">Collected</th><th class="text-right">Outstanding</th><th>Renews</th><th>Status</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function setRevenuePeriod(value) {
  state.revenuePeriod = value;
  const main = document.getElementById('main-content');
  const scroll = main ? main.scrollTop : 0;
  renderAll();
  if (main) main.scrollTop = scroll;
}

// ==================== BREAKDOWN PAGES ====================
function renderRevenueDetail() {
  const metric = METRICS[state.revenueMetric] ? state.revenueMetric : 'mrr';
  const period = currentRevenuePeriod();
  const build = { mrr: mrrDetail, gross: grossDetail, collected: collectedDetail, outstanding: outstandingDetail }[metric];
  return `${revenueBreadcrumb(metric)}${build(period)}`;
}

// ---- MRR: what the recurring revenue is made of ----
function mrrDetail(period) {
  const mrr = totalMrr();
  const paying = GYMS.filter((g) => g.mrr > 0);
  const mix = planMix();
  const rows = revenuePerGym(period).filter((r) => r.mrr > 0);
  const peak = Math.max(...mix.map((m) => m.mrr), 1);

  const body = rows.map((r) => {
    const perSeat = r.gym.seatLimit ? Math.round(r.mrr / r.gym.seatLimit) : null;
    const share = mrr ? Math.round((r.mrr / mrr) * 100) : 0;
    return `<tr class="is-clickable" onclick="navigateTo('gym-detail',{gymId:'${r.gym.id}'})">
      <td>
        <div class="flex items-center gap-2 min-w-0">
          ${gymLogo(r.gym, 24)}
          <div class="min-w-0">
            <p class="text-[11px] font-semibold text-charcoal-800 truncate leading-tight">${esc(r.gym.name)}</p>
            <p class="text-[9px] text-charcoal-400 truncate leading-tight">${esc(r.gym.location)}</p>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap"><span class="text-[11px] text-charcoal-600">${esc(r.plan ? r.plan.name : '—')}</span></td>
      <td class="whitespace-nowrap"><span class="text-[10px] text-charcoal-500">${esc(r.plan ? planCycleName(r.plan) : '')}</span></td>
      <td class="text-right whitespace-nowrap"><span class="text-[11px] text-charcoal-600">${r.gym.userCounts.total} / ${r.gym.seatLimit || '∞'}</span></td>
      <td class="text-right whitespace-nowrap"><span class="text-[11px] text-charcoal-500">${perSeat ? formatMoney(perSeat) : '—'}</span></td>
      <td class="text-right whitespace-nowrap"><span class="text-xs font-semibold text-charcoal-800">${formatMoney(r.mrr)}</span></td>
      <td class="w-28">
        <div class="flex items-center gap-1.5">
          <div class="meter flex-1"><div class="meter-fill" style="width:${share}%"></div></div>
          <span class="text-[9px] text-charcoal-500 w-7 text-right">${share}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
  ${detailHeader('mrr', `Contracted subscription revenue across ${paying.length} paying gym accounts`, period)}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${detailStat('MRR', formatMoney(mrr))}
    ${detailStat('Annual run rate', formatMoney(mrr * 12))}
    ${detailStat('Paying gyms', `${paying.length} <span class="text-[10px] font-normal text-charcoal-400">of ${GYMS.length}</span>`)}
    ${detailStat('Average per gym', formatMoney(Math.round(mrr / (paying.length || 1))))}
  </div>

  <div class="card mb-3">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Split by subscription plan</p>
      </div>
      <button onclick="navigateTo('billing')" class="btn btn-sm btn-ghost text-brand-700">Manage plans →</button>
    </div>
    <div class="px-3 py-2.5 space-y-2">
      ${mix.map((m) => barRow(`${m.plan.name} · ${m.gyms} gym${m.gyms === 1 ? '' : 's'}`, m.mrr, peak)).join('')}
    </div>
  </div>

  <div class="card card-grow">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Gym by gym</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Commitment and revenue per licensed seat</p>
      </div>
    </div>
    <div class="data-table-wrap flex-1">
      <table class="data-table">
        <thead><tr>
          <th>Gym account</th><th>Plan</th><th>Billing</th><th class="text-right">Seats used</th>
          <th class="text-right">Revenue / seat</th><th class="text-right">MRR</th><th>Share</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}

// ---- Gross: what we billed, how it moved, and which plan produced it ----
function grossDetail(period) {
  const current = revenueForPeriod(period);
  const previousPeriod = previousPeriodOf(period);
  const previous = previousPeriod ? revenueForPeriod(previousPeriod) : null;
  const change = previous ? pctChange(current.billed, previous.billed) : 0;
  const invoices = INVOICES.filter((inv) => inv.period === period);
  const avg = invoices.length ? Math.round(current.billed / invoices.length) : 0;

  const months = invoiceMonths().slice().reverse();
  const peak = Math.max(...months.map((m) => revenueForPeriod(m).billed), 1);
  const diff = previous ? current.billed - previous.billed : 0;

  return `
  ${detailHeader('gross', `Everything invoiced in ${period}${previousPeriod ? ` · compared with ${previousPeriod}` : ''}`, period)}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${detailStat('Gross revenue', formatMoney(current.billed))}
    ${detailStat('Previous month', previous ? formatMoney(previous.billed) : '—')}
    ${detailStat('Change', `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${formatMoney(Math.abs(diff))} <span class="align-middle ml-0.5">${deltaChip(change)}</span>`, diff > 0 ? 'brand' : diff < 0 ? 'red' : '')}
    ${detailStat('Average invoice', formatMoney(avg))}
  </div>

  <div class="card mb-3">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Billed per month</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${months.length} billing months on record</p>
      </div>
    </div>
    <div class="px-3 py-2.5 space-y-2">
      ${months.map((m) => barRow(m, revenueForPeriod(m).billed, peak, m === period ? '' : 'tone-soft')).join('')}
    </div>
  </div>

  <div class="card card-grow">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Gross revenue by plan · ${esc(period)}</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${invoices.length} invoices across ${PLANS.length} plans · compared with ${esc(previousPeriod || 'the month before')}</p>
      </div>
    </div>
    ${planRevenueTable(period)}
  </div>`;
}

// Which plan actually produced this month's billings — and how each one is moving.
function planRevenueFor(period) {
  return PLANS.map((plan) => {
    const ids = GYMS.filter((g) => g.planId === plan.id).map((g) => g.id);
    const bills = period ? INVOICES.filter((inv) => inv.period === period && ids.includes(inv.gymId)) : [];
    return {
      plan,
      gyms: ids.length,
      billed: bills.reduce((s, inv) => s + inv.amount, 0),
      collected: bills.filter((inv) => inv.status === 'Paid').reduce((s, inv) => s + inv.amount, 0),
      outstanding: bills.filter((inv) => inv.status !== 'Paid').reduce((s, inv) => s + inv.amount, 0),
      invoices: bills.length,
    };
  });
}

function planRevenueTable(period) {
  const previousPeriod = previousPeriodOf(period);
  const rows = planRevenueFor(period).sort((a, b) => b.billed - a.billed);
  const prevByPlan = new Map(planRevenueFor(previousPeriod).map((r) => [r.plan.id, r.billed]));

  const total = rows.reduce((s, r) => s + r.billed, 0);
  const sum = (key) => rows.reduce((s, r) => s + r[key], 0);
  const prevTotal = previousPeriod ? [...prevByPlan.values()].reduce((s, v) => s + v, 0) : null;
  const enriched = rows.map((r) => {
    const prev = previousPeriod ? (prevByPlan.get(r.plan.id) || 0) : null;
    return Object.assign({}, r, {
      prev,
      delta: prev === null ? 0 : r.billed - prev,
      pct: prev === null ? 0 : pctChange(r.billed, prev),
      // gyms on this plan that actually settled their invoice this period
      paidGyms: GYMS.filter((g) => g.planId === r.plan.id
        && INVOICES.some((inv) => inv.period === period && inv.gymId === g.id && inv.status === 'Paid')).length,
    });
  });
  const topGrowth = Math.max(...enriched.map((r) => (r.prev !== null && r.delta > 0 ? r.pct : -Infinity)));

  const withRates = enriched.map((r) => Object.assign({}, r, {
    perGym: r.gyms ? Math.round(r.billed / r.gyms) : 0,
    rate: r.billed ? Math.round((r.collected / r.billed) * 100) : 100,
  }));
  const bestPerGym = withRates.slice().sort((a, b) => b.perGym - a.perGym)[0] || { plan: { name: '—' }, perGym: 0 };
  const worstCollection = withRates.slice().sort((a, b) => a.rate - b.rate)[0] || { plan: { name: '—' }, rate: 100 };

  const body = enriched.map((r) => {
    const share = total ? Math.round((r.billed / total) * 100) : 0;
    const rate = r.billed ? Math.round((r.collected / r.billed) * 100) : 100;
    const perGym = r.gyms ? Math.round(r.billed / r.gyms) : 0;
    const unpaidGyms = GYMS.filter((g) => g.planId === r.plan.id)
      .filter((g) => !INVOICES.some((inv) => inv.period === period && inv.gymId === g.id && inv.status === 'Paid'))
      .map((g) => {
        const inv = INVOICES.find((i) => i.period === period && i.gymId === g.id);
        return `${g.name} — ${inv ? inv.status.toLowerCase() : 'not invoiced'}`;
      });

    let changeCell;
    if (r.prev === null) {
      changeCell = '<span class="text-[10px] text-charcoal-400">—</span>';
    } else if (r.prev === 0 && r.billed > 0) {
      changeCell = '<span class="badge badge-green">new</span>';
    } else if (!r.delta) {
      changeCell = '<span class="badge badge-gray">no change</span>';
    } else {
      changeCell = `<div class="flex items-center gap-1.5">
          ${deltaChip(r.pct)}
          <span class="text-[10px] font-semibold ${r.delta > 0 ? 'text-brand-700' : 'text-red-600'} tabular-nums whitespace-nowrap">${r.delta > 0 ? '+' : '−'}${formatMoney(Math.abs(r.delta))}</span>
        </div>
        <p class="text-[9px] text-charcoal-400 leading-tight mt-0.5">was ${formatMoney(r.prev)}</p>`;
    }

    return `<tr class="is-clickable" onclick="openPlanEditor('${r.plan.id}')">
      <td>
        <div class="flex items-center gap-1.5 min-w-0">
          <p class="text-[11px] font-semibold text-charcoal-800 truncate leading-tight">${esc(r.plan.name)}</p>
          ${r.plan.highlighted ? '<span class="badge badge-brand">Popular</span>' : ''}
          ${r.plan.trial === 'trial' ? '<span class="badge badge-blue">Trial plan</span>' : ''}
          ${r.prev !== null && r.delta > 0 && r.pct === topGrowth ? '<span class="badge badge-green">Top growth</span>' : ''}
        </div>
        <p class="text-[9px] text-charcoal-400 leading-tight mt-0.5">${esc(planCycleName(r.plan))} · ${formatMoney(r.plan.price)}</p>
      </td>
      <td class="whitespace-nowrap">
        <p class="text-[11px] text-charcoal-700 leading-tight">${r.gyms} gym${r.gyms === 1 ? '' : 's'}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight">${r.invoices} invoice${r.invoices === 1 ? '' : 's'}</p>
      </td>
      <td class="text-right whitespace-nowrap">
        <p class="text-xs font-semibold text-charcoal-800 tabular-nums leading-tight">${r.billed ? formatMoney(r.billed) : '—'}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight">${share}% of gross</p>
      </td>
      <td class="whitespace-nowrap">${changeCell}</td>
      <td class="text-right whitespace-nowrap">
        <p class="text-[11px] font-semibold ${r.collected ? 'text-brand-700' : 'text-charcoal-400'} tabular-nums leading-tight">${r.collected ? formatMoney(r.collected) : '—'}</p>
        <p class="text-[9px] leading-tight ${rate < 100 ? 'text-red-600 font-semibold' : 'text-charcoal-400'}">${rate}% of invoiced</p>
      </td>
      <td class="text-right whitespace-nowrap">
        <p class="text-[11px] font-semibold text-charcoal-700 tabular-nums leading-tight">${perGym ? formatMoney(perGym) : '—'}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight"${unpaidGyms.length ? ` title="${esc(unpaidGyms.join(' · '))}"` : ''}>${r.paidGyms} of ${r.gyms} paid</p>
      </td>
    </tr>`;
  }).join('');

  return `<div class="data-table-wrap flex-1">
    <table class="data-table">
      <thead><tr>
        <th>Plan</th><th>Gyms billed</th><th class="text-right">Invoiced</th>
        <th>Growth vs last month</th>
        <th class="text-right">Collected</th><th class="text-right">Revenue / gym</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

// ---- Collected: the cash that actually arrived ----
function collectedDetail(period) {
  const current = revenueForPeriod(period);
  const previousPeriod = previousPeriodOf(period);
  const previous = previousPeriod ? revenueForPeriod(previousPeriod) : null;
  const rate = current.billed ? Math.round((current.collected / current.billed) * 100) : 100;
  const paid = INVOICES.filter((inv) => inv.period === period && inv.status === 'Paid');
  const payDays = paid.map(daysToPay).filter((d) => d !== null);
  const avgDays = payDays.length ? Math.round(payDays.reduce((s, d) => s + d, 0) / payDays.length) : 0;

  const body = paid.slice().sort((a, b) => new Date(b.paid) - new Date(a.paid)).map((inv) => {
    const gym = getGym(inv.gymId);
    const days = daysToPay(inv);
    return `<tr class="is-clickable" onclick="navigateTo('gym-detail',{gymId:'${inv.gymId}'})">
      <td>
        <div class="flex items-center gap-2 min-w-0">
          ${gym ? gymLogo(gym, 24) : ''}
          <div class="min-w-0">
            <p class="text-[11px] font-semibold text-charcoal-800 truncate leading-tight">${esc(gym ? gym.name : inv.gymId)}</p>
            <p class="text-[9px] text-charcoal-400 truncate leading-tight">${esc(gym ? gym.location : '')}</p>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap"><span class="text-[11px] font-mono text-charcoal-600">${esc(inv.id)}</span></td>
      <td class="text-right whitespace-nowrap"><span class="text-xs font-semibold text-brand-700">${formatMoney(inv.amount)}</span></td>
      <td class="whitespace-nowrap text-[10px] text-charcoal-500">${formatDate(inv.issued)}</td>
      <td class="whitespace-nowrap text-[10px] text-charcoal-500">${formatDate(inv.paid)}</td>
      <td class="text-right whitespace-nowrap">
        <span class="badge ${days <= 5 ? 'badge-green' : days <= 10 ? 'badge-amber' : 'badge-gray'}">${days}d</span>
      </td>
    </tr>`;
  }).join('');

  return `
  ${detailHeader('collected', `Cash received against ${period} invoices`, period)}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${detailStat('Collected', formatMoney(current.collected), 'brand')}
    ${detailStat('Collection rate', `${rate}%`)}
    ${detailStat('Invoices paid', `${paid.length} <span class="text-[10px] font-normal text-charcoal-400">of ${current.count}</span>`)}
    ${detailStat('Average time to pay', `${avgDays} days`)}
  </div>

  <div class="card card-grow">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Payments received</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${previous ? `${deltaChip(pctChange(current.collected, previous.collected))} vs ${previousPeriod}` : 'cleared invoices'} · ${formatMoney(current.outstanding)} still unpaid</p>
      </div>
      <button onclick="navigateTo('revenue-detail',{metric:'outstanding'})" class="btn btn-sm btn-secondary">View outstanding →</button>
    </div>
    <div class="data-table-wrap flex-1">
      <table class="data-table">
        <thead><tr>
          <th>Gym account</th><th>Invoice</th><th class="text-right">Amount</th><th>Issued</th><th>Paid</th><th class="text-right">Time to pay</th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="6">${emptyState('Nothing collected in this period')}</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

// ---- Outstanding: the money still owed, and what to do about it ----
function outstandingDetail(period) {
  const current = revenueForPeriod(period);
  // A trial invoice is not a debt — it carries no amount and no due date.
  const unpaid = INVOICES.filter((inv) => inv.period === period && inv.status !== 'Paid' && inv.status !== 'Trial')
    .sort((a, b) => invoiceDaysLate(b) - invoiceDaysLate(a));
  const overdueTotal = unpaid.filter((i) => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0);  const oldest = unpaid.length ? Math.max(...unpaid.map(invoiceDaysLate)) : 0;
  const rate = current.billed ? Math.round((current.outstanding / current.billed) * 100) : 0;

  const buckets = [
    ['Current', unpaid.filter((i) => invoiceDaysLate(i) <= 0), 'tone-amber'],
    ['1–30 days late', unpaid.filter((i) => invoiceDaysLate(i) > 0 && invoiceDaysLate(i) <= 30), 'tone-red'],
    ['30+ days late', unpaid.filter((i) => invoiceDaysLate(i) > 30), 'tone-red'],
  ];
  const bucketMax = Math.max(...buckets.map(([, list]) => list.reduce((s, i) => s + i.amount, 0)), 1);

  const body = unpaid.map((inv) => {
    const gym = getGym(inv.gymId);
    const plan = gym ? PLANS.find((p) => p.id === gym.planId) : null;
    const late = invoiceDaysLate(inv);
    const due = new Date(inv.issued);
    due.setUTCDate(due.getUTCDate() + 30);
    return `<tr>
      <td>
        <div class="flex items-center gap-2 min-w-0">
          ${gym ? gymLogo(gym, 24) : ''}
          <div class="min-w-0">
            <p class="text-[11px] font-semibold text-charcoal-800 truncate leading-tight">${esc(gym ? gym.name : inv.gymId)}</p>
            <p class="text-[9px] text-charcoal-400 truncate leading-tight">${esc(gym ? gym.location : '')}</p>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap"><span class="text-[11px] font-mono text-charcoal-600">${esc(inv.id)}</span></td>
      <td class="whitespace-nowrap">
        <p class="text-[11px] text-charcoal-700 leading-tight">${esc(plan ? plan.name : '—')}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight">${esc(plan ? planCycleName(plan) : '')}</p>
      </td>
      <td class="text-right whitespace-nowrap"><span class="text-xs font-semibold text-red-600 tabular-nums">${formatMoney(inv.amount)}</span></td>
      <td class="whitespace-nowrap"><span class="text-[10px] text-charcoal-500 font-mono">${shortDate(inv.issued) || '—'}</span></td>
      <td class="whitespace-nowrap"><span class="text-[10px] text-charcoal-500 font-mono">${shortDate(due.toISOString().slice(0, 10)) || '—'}</span></td>
      <td class="whitespace-nowrap">
        <span class="text-[11px] font-semibold ${late > 0 ? 'text-red-600' : 'text-charcoal-500'}">${late > 0 ? late + ' days' : 'not due yet'}</span>
      </td>
      <td class="whitespace-nowrap"><span class="badge ${INVOICE_TONE[inv.status] || 'badge-gray'}">${esc(inv.status)}</span></td>
      <td class="text-right whitespace-nowrap">
        ${inv.status === 'Overdue'
          ? `<button onclick="sendInvoiceReminder('${inv.id}')" class="btn btn-sm btn-ghost">Remind</button>
             <button onclick="recordPayment('${inv.id}')" class="btn btn-sm btn-primary">Record</button>`
          : `<button onclick="navigateTo('billing')" class="btn btn-sm btn-secondary">Convert</button>`}
      </td>
    </tr>`;
  }).join('');

  return `
  ${detailHeader('outstanding', `Invoices raised in ${period} that have not been paid yet`, period)}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${detailStat('Outstanding', formatMoney(current.outstanding), 'red')}
    ${detailStat('Share of billings', `${rate}%`)}
    ${detailStat('Overdue', formatMoney(overdueTotal), overdueTotal ? 'red' : '')}
    ${detailStat('Oldest invoice', oldest ? `${oldest} days overdue` : 'none overdue')}
  </div>

  <div class="card mb-3">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Ageing</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">How long the unpaid money has been sitting</p>
      </div>
    </div>
    <div class="px-3 py-2.5 space-y-2">
      ${buckets.map(([label, list, tone]) => barRow(label, list.reduce((s, i) => s + i.amount, 0), bucketMax, tone)).join('')}
    </div>
  </div>

  <div class="card card-grow">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Unpaid invoices</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${unpaid.length} invoice${unpaid.length === 1 ? '' : 's'} · chase or record a payment without leaving the page</p>
      </div>
      ${unpaid.length ? '<button onclick="remindAllOverdue()" class="btn btn-sm btn-secondary">Remind all overdue</button>' : ''}
    </div>
    <div class="data-table-wrap flex-1">
      <table class="data-table">
        <thead><tr>
          <th>Gym account</th><th>Invoice</th><th>Plan</th><th class="text-right">Amount</th>
          <th>Issued</th><th>Due</th><th>Days overdue</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="9">${emptyState('Every invoice for this period is settled')}</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}
