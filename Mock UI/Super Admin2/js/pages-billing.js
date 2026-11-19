// ==================== PAGE: BILLING & QUOTAS ====================
// Platform-side revenue: the plans you sell, what every gym owes, what has cleared,
// and how much of each seat quota is consumed.
const INVOICE_TONE = { Paid: 'badge-green', Overdue: 'badge-red', Trial: 'badge-blue', Due: 'badge-amber' };

function billingFilters() {
  return state.billingFilters || { status: 'all', gym: 'all', q: '' };
}

function setBillingFilter(key, value) {
  state.billingFilters = Object.assign({}, billingFilters(), { [key]: value });
  const main = document.getElementById('main-content');
  const scroll = main ? main.scrollTop : 0;
  renderAll();
  if (main) main.scrollTop = scroll;
  if (key === 'q') {
    const input = main ? main.querySelector('input[placeholder="Search invoice…"]') : null;
    if (input) { input.focus(); input.setSelectionRange(value.length, value.length); }
  }
}

function resetBillingFilters() {
  state.billingFilters = { status: 'all', gym: 'all', q: '' };
  renderAll();
}

// One column instead of two: the invoice's life from issue date to payment date.
function invoiceDateRange(inv) {
  const issued = new Date(inv.issued);
  const currentYear = Number(PLATFORM.today.slice(0, 4));
  const short = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const withYear = (d) => (d.getUTCFullYear() === currentYear ? short(d) : `${short(d)} ${d.getUTCFullYear()}`);
  if (!inv.paid) return `${withYear(issued)} → —`;
  return `${withYear(issued)} → ${withYear(new Date(inv.paid))}`;
}

function invoiceDaysOverdue(inv) {
  if (inv.status !== 'Overdue') return 0;
  return Math.max(0, daysBetween(inv.issued, PLATFORM.today.slice(0, 10)));
}

function renderBilling() {
  const r = revenueTotals();
  const f = billingFilters();
  const q = f.q.toLowerCase();

  const visible = INVOICES.filter((inv) => {
    if (f.status !== 'all' && inv.status !== f.status) return false;
    if (f.gym !== 'all' && inv.gymId !== f.gym) return false;
    if (q && !(inv.id + ' ' + inv.period).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => new Date(b.issued) - new Date(a.issued));

  const overdueList = INVOICES.filter((i) => i.status === 'Overdue');
  const aging = overdueList.reduce((acc, inv) => {
    const d = invoiceDaysOverdue(inv);
    if (d <= 30) acc.current30 += inv.amount; else acc.over30 += inv.amount;
    return acc;
  }, { current30: 0, over30: 0 });

  const statusOptions = ['all', 'Paid', 'Overdue', 'Trial'].map((s) => {
    const count = s === 'all' ? INVOICES.length : INVOICES.filter((i) => i.status === s).length;
    return `<option value="${s}"${f.status === s ? ' selected' : ''}>${esc(s === 'all' ? 'All statuses' : s)} (${count})</option>`;
  }).join('');

  const gymOptions = GYMS.map((g) => `<option value="${g.id}"${f.gym === g.id ? ' selected' : ''}>${esc(g.name)} — ${esc(g.location)}</option>`).join('');

  const invoiceRows = visible.map((inv) => {
    const gym = getGym(inv.gymId);
    const overdueDays = invoiceDaysOverdue(inv);
    return `<tr>
      <td class="whitespace-nowrap"><span class="text-[11px] font-semibold text-charcoal-800 font-mono">${esc(inv.id)}</span></td>
      <td>
        <button onclick="navigateTo('gym-detail',{gymId:'${inv.gymId}'})" class="text-left group block max-w-[110px]">
          <span class="block text-[11px] font-medium text-charcoal-700 group-hover:text-brand-700 leading-tight truncate">${esc(gym ? gym.name : inv.gymId)}</span>
          <span class="block text-[9px] text-charcoal-400 leading-tight truncate">${esc(gym ? gym.location : '')}</span>
        </button>
      </td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-600">${esc(inv.period)}</td>
      <td class="text-right whitespace-nowrap"><span class="text-xs font-semibold text-charcoal-800">${inv.amount ? formatMoney(inv.amount) : '—'}</span></td>
      <td>
        <span class="badge ${INVOICE_TONE[inv.status] || 'badge-gray'}">${esc(inv.status)}</span>
        ${overdueDays ? `<p class="text-[9px] text-red-600 font-semibold mt-0.5">${overdueDays}d late</p>` : ''}
      </td>
      <td class="whitespace-nowrap text-[10px] text-charcoal-500 font-mono">${invoiceDateRange(inv)}</td>
      <td class="text-right whitespace-nowrap">
        ${inv.status === 'Overdue'
          ? `<button onclick="sendInvoiceReminder('${inv.id}')" class="btn btn-sm btn-ghost">Remind</button>
             <button onclick="recordPayment('${inv.id}')" class="btn btn-sm btn-primary">Record</button>`
          : inv.status === 'Trial'
            ? `<button onclick="toast('Trial conversion starts from the gym account','info')" class="btn btn-sm btn-secondary">Convert</button>`
            : `<button onclick="downloadInvoice('${inv.id}')" class="btn btn-sm btn-ghost text-brand-700">Receipt</button>`}
      </td>
    </tr>`;
  }).join('');

  return `
  ${pageHeader(
    'Billing & quotas',
    `${formatMoney(r.mrr)} monthly recurring · ${formatMoney(r.collected)} collected in November · ${overdueList.length} invoice overdue`,
    `<button onclick="toast('Statement for November 2026 queued — prototype only','info')" class="btn btn-secondary">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
      Download statement
    </button>`
  )}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
    ${kpiTile('Monthly recurring', formatMoney(r.mrr), `${GYMS.filter((g) => g.mrr).length} paying gyms`, 'coins')}
    ${kpiTile('Annual run rate', formatMoney(r.arr), 'MRR × 12', 'chart')}
    ${kpiTile('Collected · November', formatMoney(r.collected), `of ${formatMoney(r.billed)} billed`, 'check')}
    ${kpiTile('Overdue', formatMoney(r.overdue), overdueList.length ? `${overdueList.length} invoice past due` : 'nothing outstanding', 'alert', r.overdue ? 'red' : '')}
  </div>

  ${plansCard()}

  <div class="grid grid-cols-1 xl:grid-cols-3 xl:grid-rows-1 gap-3 grow min-h-0">
    <div class="xl:col-span-2 min-h-0 flex flex-col">
      <div class="card card-grow">
        <div class="card-head">
          <div class="flex-1 min-w-0">
            <p class="bento-label">Invoices</p>
            <p class="text-[10px] text-charcoal-500 mt-0.5">
              ${visible.length} shown of ${INVOICES.length} · ${formatMoney(r.billed)} billed in November
              <span class="text-charcoal-300 mx-1">|</span>
              current <span class="font-semibold text-charcoal-700">${formatMoney(Math.max(0, r.billed - r.collected - aging.current30 - aging.over30))}</span>
              · 1–30d late <span class="font-semibold ${aging.current30 ? 'text-amber-600' : 'text-charcoal-700'}">${formatMoney(aging.current30)}</span>
              · 30d+ late <span class="font-semibold ${aging.over30 ? 'text-red-600' : 'text-charcoal-700'}">${formatMoney(aging.over30)}</span>
            </p>
          </div>
          ${overdueList.length ? `<button onclick="remindAllOverdue()" class="btn btn-sm btn-secondary">Remind all overdue</button>` : ''}
        </div>

        <div class="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-charcoal-100">
          <select class="form-select form-input-sm w-auto" onchange="setBillingFilter('status',this.value)" aria-label="Filter by invoice status">
            ${statusOptions}
          </select>
          <select class="form-select form-input-sm w-auto" onchange="setBillingFilter('gym',this.value)">
            <option value="all"${f.gym === 'all' ? ' selected' : ''}>All gyms</option>
            ${gymOptions}
          </select>
          <div class="relative ml-auto">
            <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-charcoal-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input class="form-input form-input-sm pl-6 w-40" placeholder="Search invoice…" value="${esc(f.q)}" oninput="setBillingFilter('q',this.value)" aria-label="Search invoices">
          </div>
          ${(f.status !== 'all' || f.gym !== 'all' || f.q) ? '<button onclick="resetBillingFilters()" class="btn btn-sm btn-ghost text-charcoal-500">Clear</button>' : ''}
        </div>

        <div class="data-table-wrap flex-1">
          <table class="data-table">
            <thead><tr>
              <th>Invoice</th><th>Gym account</th><th>Period</th><th class="text-right">Amount</th><th>Status</th><th>Issued → paid</th><th></th>
            </tr></thead>
            <tbody>${invoiceRows || `<tr><td colspan="7">${emptyState('No invoices match these filters')}</td></tr>`}</tbody>
          </table>
        </div>
        <div class="px-3 py-2 border-t border-charcoal-100 flex items-center justify-between gap-2 flex-wrap">
          <p class="text-[10px] text-charcoal-500">Card ${esc(PLATFORM_BILLING.card.brand)} ···· ${esc(PLATFORM_BILLING.card.last4)} · expires ${esc(PLATFORM_BILLING.card.expiry)}</p>
          <button onclick="toast('Payment method editor is outside this prototype','info')" class="btn btn-sm btn-ghost text-brand-700">Update payment method</button>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex flex-col">${seatQuotasCard()}</div>
  </div>`;
}

// ==================== PLANS ====================
function cycleLabel(plan) {
  const cycle = BILLING_CYCLES.find((c) => c.id === (plan.cycle || 'monthly')) || BILLING_CYCLES[0];
  return cycle.short;
}

function trialLabel(plan) {
  if (plan.trial === 'trial') return '<span class="badge badge-blue">Trial plan</span>';
  if (plan.trial === 'days') return `${plan.trialDays || 14}-day free trial`;
  return '<span class="text-charcoal-400">None</span>';
}

function plansCard() {
  const rows = PLANS.map((plan) => {
    const gymsOn = GYMS.filter((g) => g.planId === plan.id);
    const mrr = gymsOn.reduce((s, g) => s + g.mrr, 0);
    return `<tr>
      <td>
        <div class="flex items-center gap-1.5 min-w-0">
          <p class="text-xs font-semibold text-charcoal-800 truncate leading-tight">${esc(plan.name)}</p>
          ${plan.highlighted ? '<span class="badge badge-brand">Popular</span>' : ''}
        </div>
      </td>
      <td class="text-right whitespace-nowrap">
        <span class="text-xs font-semibold text-charcoal-800">${formatMoney(plan.price)}</span><span class="text-[9px] text-charcoal-400">${cycleLabel(plan)}</span>
      </td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-600">${trialLabel(plan)}</td>
      <td class="text-center whitespace-nowrap text-[11px] text-charcoal-600">${plan.seatLimit ? plan.seatLimit + ' seats' : 'Unlimited'}</td>
      <td class="text-center whitespace-nowrap text-[11px] text-charcoal-600">${plan.branchLimit || 'Unlimited'}</td>
      <td class="text-center whitespace-nowrap"><span class="text-xs font-semibold text-charcoal-700">${gymsOn.length}</span></td>
      <td class="text-right whitespace-nowrap"><span class="text-xs font-semibold text-charcoal-800">${mrr ? formatMoney(mrr) : '—'}</span></td>
      <td class="text-right whitespace-nowrap">
        <button onclick="openPlanEditor('${plan.id}')" class="btn btn-sm btn-secondary">Edit plan</button>
        <button onclick="openPlanEditor(null,'${plan.id}')" class="btn btn-sm btn-ghost text-charcoal-600">Duplicate</button>
      </td>
    </tr>`;
  }).join('');

  return `<div class="card mb-3">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Subscription plans</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">${PLANS.length} plans · ${GYMS.length} gym accounts · ${formatMoney(revenueTotals().mrr)} in MRR</p>
      </div>
      <button onclick="openPlanEditor()" class="btn btn-primary btn-sm">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Create plan
      </button>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Plan</th><th class="text-right">Price</th><th>Trial</th><th class="text-center">Seats</th><th class="text-center">Branches</th><th class="text-center">Gyms</th><th class="text-right">MRR</th><th class="text-right">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function openPlanEditor(planId, duplicateFromId) {
  const plan = planId ? PLANS.find((p) => p.id === planId) : duplicateFromId ? PLANS.find((p) => p.id === duplicateFromId) : null;
  const isEdit = !!planId;
  const cycle = plan ? (plan.cycle || 'monthly') : 'monthly';
  const trial = plan ? (plan.trial || 'none') : 'none';
  const features = plan ? plan.features.slice() : [];

  const cycleOptions = BILLING_CYCLES.map((c) => `<option value="${c.id}"${cycle === c.id ? ' selected' : ''}>${esc(c.label)}</option>`).join('');
  const trialOptions = TRIAL_MODES.map((t) => `<option value="${t.id}"${trial === t.id ? ' selected' : ''}>${esc(t.label)}</option>`).join('');

  const catalogRow = (label, checked) => `<label class="form-check">
      <input type="checkbox" value="${esc(label)}" ${checked ? 'checked' : ''} onchange="planUpdateCount()">
      <span class="text-[10px] leading-snug">${esc(label)}</span>
    </label>`;

  const featureList = FEATURE_CATALOG.map((f) => catalogRow(f, features.includes(f))).join('')
    + features.filter((f) => !FEATURE_CATALOG.includes(f)).map((f) => catalogRow(f, true)).join('');

  openModal({
    title: isEdit ? `Edit ${plan.name}` : duplicateFromId ? `Duplicate ${plan.name}` : 'Create plan',
    subtitle: isEdit ? 'Changes apply to new sign-ups; existing gyms keep their terms until renewal' : 'Define the commercial terms of a subscription tier',
    width: 'max-w-2xl',
    body: `<div class="space-y-2.5">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div class="sm:col-span-2"><label class="form-label">Plan name <span class="text-red-500">*</span></label>
          <input class="form-input" id="plan-name" placeholder="e.g. Scale" value="${esc(plan ? (isEdit ? plan.name : plan.name + ' copy') : '')}"></div>
        <div><label class="form-label">Price (EGP <span id="plan-price-unit">${cycleLabel({ cycle })}</span>) <span class="text-red-500">*</span></label>
          <input class="form-input" id="plan-price" type="number" min="0" value="${plan ? plan.price : ''}" placeholder="0"></div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div><label class="form-label">Billing cycle</label>
          <select class="form-select" id="plan-cycle" onchange="planUpdatePriceUnit(this.value)">${cycleOptions}</select></div>
        <div class="sm:col-span-2"><label class="form-label">Trial</label>
          <div class="flex items-center gap-2">
            <select class="form-select" id="plan-trial" onchange="planToggleTrialDays(this.value)">${trialOptions}</select>
            <div id="plan-trial-days-wrap" class="flex items-center gap-1.5 flex-shrink-0" style="${trial === 'days' ? '' : 'display:none'}">
              <input class="form-input w-16" id="plan-trial-days" type="number" min="1" value="${plan && plan.trialDays ? plan.trialDays : 14}">
              <span class="text-[10px] text-charcoal-500 whitespace-nowrap">days</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div><label class="form-label">Seat limit</label>
          <input class="form-input" id="plan-seats" type="number" min="1" placeholder="Unlimited" value="${plan && plan.seatLimit ? plan.seatLimit : ''}"></div>
        <div><label class="form-label">Branch limit</label>
          <input class="form-input" id="plan-branches" type="number" min="1" placeholder="Unlimited" value="${plan && plan.branchLimit ? plan.branchLimit : ''}"></div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="form-label mb-0">Included features</label>
          <span class="text-[10px] text-charcoal-500"><strong id="plan-feature-count" class="text-charcoal-800 font-semibold">${features.length}</strong> selected</span>
        </div>
        <div id="plan-feature-list" class="border border-charcoal-200 rounded-lg px-2.5 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 max-h-[26vh] overflow-y-auto">
          ${featureList}
        </div>
        <div class="flex items-center gap-1.5 mt-1.5">
          <input class="form-input form-input-sm flex-1" id="plan-feature-input" placeholder="Add another feature…" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomFeature();}">
          <button type="button" onclick="addCustomFeature()" class="btn btn-sm btn-secondary flex-shrink-0">Add</button>
        </div>
      </div>

      <label class="form-check"><input type="checkbox" id="plan-highlighted" ${plan && plan.highlighted ? 'checked' : ''}> Mark as the recommended plan</label>
      <p class="text-[10px] text-charcoal-400">Leave a limit empty for unlimited. Existing gyms are re-seated only when you change their plan.</p>
    </div>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="savePlan('${planId || ''}','${duplicateFromId || ''}')" class="btn btn-sm btn-primary">${isEdit ? 'Save plan' : 'Create plan'}</button>`,
  });

  planUpdateCount();
}

function planFeatureBoxes() {
  return Array.from(document.querySelectorAll('#plan-feature-list input[type="checkbox"]'));
}

function planUpdateCount() {
  const el = document.getElementById('plan-feature-count');
  if (el) el.textContent = planFeatureBoxes().filter((b) => b.checked).length;
}

function planToggleTrialDays(mode) {
  const wrap = document.getElementById('plan-trial-days-wrap');
  if (wrap) wrap.style.display = mode === 'days' ? '' : 'none';
}

function planUpdatePriceUnit(cycleId) {
  const opt = document.getElementById('plan-price-unit');
  if (opt) opt.textContent = cycleLabel({ cycle: cycleId });
}

function addCustomFeature() {
  const input = document.getElementById('plan-feature-input');
  if (!input) return;
  const value = (input.value || '').trim();
  if (!value) return;
  const list = document.getElementById('plan-feature-list');
  if (!list) return;
  if (planFeatureBoxes().some((b) => b.value.toLowerCase() === value.toLowerCase())) {
    toast('That feature is already in the list', 'info');
    input.value = '';
    return;
  }
  const label = document.createElement('label');
  label.className = 'form-check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.value = value;
  box.checked = true;
  box.addEventListener('change', planUpdateCount);
  const span = document.createElement('span');
  span.className = 'text-[10px] leading-snug';
  span.textContent = value;
  label.appendChild(box);
  label.appendChild(span);
  list.appendChild(label);
  input.value = '';
  input.focus();
  planUpdateCount();
}

function savePlan(planId, duplicateFromId) {
  const name = ((document.getElementById('plan-name') || {}).value || '').trim();
  if (!name) { toast('Plan name is required', 'error'); return; }
  if (PLANS.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== planId)) { toast('A plan with that name already exists', 'error'); return; }

  const price = Number((document.getElementById('plan-price') || {}).value || 0);
  const cycle = (document.getElementById('plan-cycle') || {}).value || 'monthly';
  const trial = (document.getElementById('plan-trial') || {}).value || 'none';
  const trialDays = trial === 'days' ? Number((document.getElementById('plan-trial-days') || {}).value || 14) : 0;
  const seatsRaw = (document.getElementById('plan-seats') || {}).value;
  const branchesRaw = (document.getElementById('plan-branches') || {}).value;
  const features = planFeatureBoxes().filter((b) => b.checked).map((b) => b.value);
  const highlighted = !!(document.getElementById('plan-highlighted') || {}).checked;
  const seatLimit = seatsRaw ? Number(seatsRaw) : null;
  const branchLimit = branchesRaw ? Number(branchesRaw) : null;

  if (!price) { toast('Set a price for this plan', 'error'); return; }
  if (!features.length) { toast('Select at least one feature', 'error'); return; }

  if (highlighted) PLANS.forEach((p) => { p.highlighted = false; });

  const cycleName = (BILLING_CYCLES.find((c) => c.id === cycle) || BILLING_CYCLES[0]).label;
  const trialName = trial === 'trial' ? 'trial plan, never billed' : trial === 'days' ? `${trialDays}-day free trial` : 'no trial';

  if (planId) {
    const plan = PLANS.find((p) => p.id === planId);
    plan.name = name;
    plan.price = price;
    plan.cycle = cycle;
    plan.trial = trial;
    plan.trialDays = trialDays;
    plan.features = features;
    plan.seatLimit = seatLimit;
    plan.branchLimit = branchLimit;
    plan.highlighted = highlighted;
    logAudit({
      category: 'Settings', severity: 'warning', action: 'Updated subscription plan',
      target: `${plan.name} · ${formatMoney(plan.price)} ${cycleName.toLowerCase()}`,
      detail: `Seats ${seatLimit || 'unlimited'} · branches ${branchLimit || 'unlimited'} · ${trialName} · ${features.length} features.`,
    });
    closeModal();
    renderAll();
    toast(`${plan.name} updated`, 'success');
    return;
  }

  const plan = {
    id: 'plan-' + (PLANS.length + 1) + '-' + Date.now().toString().slice(-4),
    name,
    price,
    cycle,
    trial,
    trialDays,
    tagline: `${cycleName} · ${trialName}`,
    features,
    seatLimit,
    branchLimit,
    highlighted,
  };
  PLANS.push(plan);
  logAudit({
    category: 'Settings', severity: 'info', action: 'Created subscription plan',
    target: `${plan.name} · ${formatMoney(plan.price)} ${cycleName.toLowerCase()}`,
    detail: `Seats ${seatLimit || 'unlimited'} · branches ${branchLimit || 'unlimited'} · ${trialName}.${duplicateFromId ? ' Duplicated from ' + (PLANS.find((p) => p.id === duplicateFromId) || {}).name + '.' : ''}`,
  });
  closeModal();
  renderAll();
  toast(`${plan.name} created`, 'success');
}

function seatQuotasCard() {
  const rows = GYMS.map((gym) => {
    const used = gym.userCounts.total;
    const pct = gym.seatLimit ? Math.round((used / gym.seatLimit) * 100) : 0;
    const tone = gym.seatLimit && used >= gym.seatLimit ? 'red' : gym.seatLimit && pct >= 90 ? 'amber' : '';
    return `<div class="px-3 py-2 border-b border-charcoal-100 last:border-0">
      <div class="flex items-center gap-2 mb-1">
        ${gymLogo(gym, 36)}
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-semibold text-charcoal-800 truncate leading-tight">${esc(gym.name)}</p>
          <p class="text-[10px] text-charcoal-400 truncate leading-tight">${esc(gym.location)} · ${gym.branches} branch${gym.branches === 1 ? '' : 'es'}</p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-[11px] font-semibold text-charcoal-800 leading-tight">${formatNumber(used)}${gym.seatLimit ? ' / ' + gym.seatLimit : ''}</p>
          <p class="text-[9px] ${tone === 'red' ? 'text-red-600 font-semibold' : tone === 'amber' ? 'text-amber-600 font-semibold' : 'text-charcoal-400'} leading-tight">${gym.seatLimit ? pct + '% used' : ''}</p>
        </div>
      </div>
      ${gym.seatLimit ? meterHtml(used, gym.seatLimit, tone || (gym.status === 'Trial' ? 'blue' : '')) : `<p class="text-[9px] text-purple-600 font-medium">Unlimited plan — no seat quota</p>`}
    </div>`;
  }).join('');

  return `<div class="card card-grow">
    <div class="card-head">
      <p class="bento-label flex-1">Seat quotas</p>
      <span class="badge badge-gray">${formatNumber(platformTotals().totalUsers)} in use</span>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto">${rows}</div>
    <div class="px-3 py-2 border-t border-charcoal-100">
      <button onclick="navigateTo('gyms')" class="btn btn-sm btn-ghost text-brand-700 w-full">Manage plans &amp; seats →</button>
    </div>
  </div>`;
}

// ==================== BILLING ACTIONS ====================
function recordPayment(invoiceId) {
  const inv = INVOICES.find((i) => i.id === invoiceId);
  if (!inv) return;
  const gym = getGym(inv.gymId);
  openModal({
    title: 'Record payment',
    subtitle: `${inv.id} · ${gym ? gym.name + ' — ' + gym.location : ''}`,
    width: 'max-w-md',
    body: `<dl class="text-[11px] divide-soft">
        ${[
          ['Invoice', inv.id],
          ['Period', inv.period],
          ['Amount', formatMoney(inv.amount)],
          ['Issued', formatDate(inv.issued)],
          ['Status', inv.status],
        ].map(([k, v]) => `<div class="flex justify-between gap-3 py-1.5">
          <dt class="text-charcoal-500">${esc(k)}</dt>
          <dd class="font-semibold text-charcoal-800 text-right">${esc(v)}</dd></div>`).join('')}
      </dl>
      <div class="mt-2.5"><label class="form-label">Payment reference</label>
        <input class="form-input" placeholder="Bank transfer reference" value="BT-${inv.id.replace('INV-', '')}"></div>
      <p class="text-[10px] text-charcoal-400 mt-2">Marking this paid clears the overdue flag and restores payroll access for the gym.</p>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="confirmRecordPayment('${inv.id}')" class="btn btn-sm btn-primary">Mark as paid</button>`,
  });
}

function confirmRecordPayment(invoiceId) {
  const inv = INVOICES.find((i) => i.id === invoiceId);
  if (!inv) return;
  const gym = getGym(inv.gymId);
  inv.status = 'Paid';
  inv.paid = PLATFORM.today.slice(0, 10);
  if (gym && gym.status === 'Payment overdue') gym.status = 'Active';

  logAudit({
    gymId: inv.gymId, category: 'Billing', severity: 'info', action: 'Recorded payment',
    target: `${inv.id} · ${formatMoney(inv.amount)}`,
    detail: `Payment recorded for ${inv.period}. ${gym && gym.status === 'Active' ? 'Gym account returned to Active and payroll access restored.' : 'Invoice settled.'}`,
  });
  closeModal();
  renderAll();
  toast(`${inv.id} marked as paid`, 'success');
}

function sendInvoiceReminder(invoiceId) {
  const inv = INVOICES.find((i) => i.id === invoiceId);
  if (!inv) return;
  const gym = getGym(inv.gymId);
  logAudit({
    gymId: inv.gymId, category: 'Billing', severity: 'warning', action: 'Sent payment reminder',
    target: `${inv.id} · ${gym ? gym.name : inv.gymId}`,
    detail: `Reminder emailed to ${gym ? gym.contact.email : 'the billing contact'} for ${formatMoney(inv.amount)}.`,
  });
  renderAll();
  toast(`Reminder sent to ${gym ? gym.contact.email : 'the billing contact'}`, 'info');
}

function remindAllOverdue() {
  const overdue = INVOICES.filter((i) => i.status === 'Overdue');
  if (!overdue.length) return;
  overdue.forEach((inv) => {
    const gym = getGym(inv.gymId);
    logAudit({
      gymId: inv.gymId, category: 'Billing', severity: 'warning', action: 'Sent payment reminder',
      target: `${inv.id} · ${gym ? gym.name : inv.gymId}`,
      detail: `Bulk reminder for ${formatMoney(inv.amount)}.`,
    });
  });
  renderAll();
  toast(`Reminders sent for ${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`, 'info');
}

function downloadInvoice(invoiceId) {
  toast(`Receipt for ${invoiceId} queued — prototype only`, 'info');
}
