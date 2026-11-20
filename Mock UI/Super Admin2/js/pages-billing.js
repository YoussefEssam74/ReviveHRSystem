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

// Short date for dense tables: "5 Nov", plus the year only when it is not this year,
// or when the caller needs it spelled out every time.
function shortDate(iso, alwaysYear) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const sameYear = d.getUTCFullYear() === Number(PLATFORM.today.slice(0, 4));
  return sameYear && !alwaysYear ? base : `${base} ${String(d.getUTCFullYear()).slice(-2)}`;
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

  const statusOptions = ['all', 'Paid', 'Overdue', 'Trial'].map((s) => {
    const count = s === 'all' ? INVOICES.length : INVOICES.filter((i) => i.status === s).length;
    return `<option value="${s}"${f.status === s ? ' selected' : ''}>${esc(s === 'all' ? 'All statuses' : s)} (${count})</option>`;
  }).join('');

  const gymOptions = GYMS.map((g) => `<option value="${g.id}"${f.gym === g.id ? ' selected' : ''}>${esc(g.name)} — ${esc(g.location)}</option>`).join('');

  const invoiceRows = visible.map((inv) => {
    const gym = getGym(inv.gymId);
    const plan = gym ? PLANS.find((p) => p.id === gym.planId) : null;
    const overdueDays = invoiceDaysOverdue(inv);
    const termStart = gym ? shortDate(gym.subscribedOn, true) : null;
    const termEnd = gym ? shortDate(gym.renewsOn, true) : null;
    return `<tr>
      <td class="whitespace-nowrap"><span class="text-[11px] font-semibold text-charcoal-800 font-mono">${esc(inv.id)}</span></td>
      <td>
        <button onclick="navigateTo('gym-detail',{gymId:'${inv.gymId}'})" class="text-left group block max-w-[96px]">
          <span class="block text-[11px] font-medium text-charcoal-700 group-hover:text-brand-700 leading-tight truncate">${esc(gym ? gym.name : inv.gymId)}</span>
          <span class="block text-[9px] text-charcoal-400 leading-tight truncate">${esc(gym ? gym.location : '')}</span>
        </button>
      </td>
      <td class="whitespace-nowrap text-[11px] text-charcoal-600">${esc(inv.period)}</td>
      <td class="whitespace-nowrap">
        <p class="text-[11px] text-charcoal-700 leading-tight">${esc(plan ? plan.name : '—')}</p>
        <p class="text-[9px] text-charcoal-400 leading-tight">${esc(plan ? planCycleName(plan) : '')}</p>
      </td>
      <td class="text-right whitespace-nowrap"><span class="text-xs font-semibold text-charcoal-800">${inv.amount ? formatMoney(inv.amount) : '—'}</span></td>
      <td class="whitespace-nowrap">
        <span class="badge ${INVOICE_TONE[inv.status] || 'badge-gray'}">${esc(inv.status)}</span>
        ${overdueDays ? `<p class="text-[9px] text-red-600 font-semibold mt-0.5">${overdueDays}d late</p>` : ''}
      </td>
      <td class="whitespace-nowrap text-[10px] text-charcoal-500 font-mono">${termStart || '—'}</td>
      <td class="whitespace-nowrap text-[10px] text-charcoal-500 font-mono">${termEnd || '—'}</td>
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
    `${PLANS.length} subscription plans · ${GYMS.length} gym accounts · invoices, collections and subscription terms`,
    `<button onclick="navigateTo('revenue')" class="btn btn-secondary btn-sm">Revenue analyzes →</button>
    <button onclick="toast('Statement for November 2026 queued — prototype only','info')" class="btn btn-secondary btn-sm">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
      Statement
    </button>`
  )}

  ${billingSummaryStrip(r)}

  <div class="grid grid-cols-1 xl:grid-cols-4 xl:grid-rows-1 gap-3 grow min-h-0">
    <div class="xl:col-span-3 min-h-0 flex flex-col">
      <div class="card card-grow">
        <div class="card-head">
          <div class="flex-1 min-w-0">
            <p class="bento-label">Invoices</p>
            <p class="text-[10px] text-charcoal-500 mt-0.5 truncate">${visible.length} of ${INVOICES.length} shown · ${formatMoney(r.billed)} billed in November · ${formatMoney(r.overdue)} overdue</p>
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
          <table class="data-table" style="--table-cell-px:0.4rem">
            <thead><tr>
              <th>Invoice</th><th>Gym account</th><th>Period</th><th>Plan</th><th class="text-right">Amount</th><th>Status</th>
              <th title="Subscription start">Start</th><th title="Subscription end / renewal">End</th><th></th>
            </tr></thead>
            <tbody>${invoiceRows || `<tr><td colspan="9">${emptyState('No invoices match these filters')}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex flex-col">${plansRail()}</div>
  </div>`;
}

// ==================== PLANS ====================
function trialLabel(plan) {
  if (plan.trial === 'trial') return '<span class="badge badge-blue">Trial plan</span>';
  if (plan.trial === 'days') return `${plan.trialDays || 14}-day free trial`;
  return '<span class="text-charcoal-400">None</span>';
}

// One quiet strip instead of four competing cards. The revenue analysis lives on its
// own page — this page only tracks what is billed, collected, owed and consumed.
function billingSummaryStrip(r) {
  const openInvoices = INVOICES.filter((i) => i.status !== 'Paid' && i.status !== 'Trial').length;

  const item = (label, value, sub, tone) => `<div class="summary-item">
    <p class="stat-label">${esc(label)}</p>
    <p class="stat-value ${tone || ''} mt-0.5">${value}</p>
    <p class="text-[9px] text-charcoal-400 leading-tight mt-0.5">${sub}</p>
  </div>`;

  return `<div class="summary-strip mb-3">
    ${item('Billed · November', formatMoney(r.billed), `${INVOICES.filter((i) => i.period === 'Nov 2026').length} invoices raised`)}
    ${item('Collected', formatMoney(r.collected), `${r.billed ? Math.round((r.collected / r.billed) * 100) : 100}% cleared`, 'text-brand-700')}
    ${item('Still owed', formatMoney(r.overdue), openInvoices ? `${openInvoices} invoice open` : 'nothing outstanding', r.overdue ? 'text-red-600' : '')}
  </div>`;
}

// The plan catalogue lives beside the ledger rather than on top of it: it is the thing
// you sell, so it stays visible without pushing the invoices down the page.
function plansRail() {
  const total = GYMS.reduce((s, g) => s + g.mrr, 0);

  const trialText = (plan) => plan.trial === 'trial' ? 'trial plan'
    : plan.trial === 'none' ? 'no trial'
    : `${plan.trialDays}-day trial`;

  const rows = PLANS.map((plan) => {
    const gymsOn = GYMS.filter((g) => g.planId === plan.id);
    const mrr = gymsOn.reduce((s, g) => s + g.mrr, 0);
    const share = total ? Math.round((mrr / total) * 100) : 0;
    return `<div class="px-3 py-2 border-b border-charcoal-100 last:border-0">
      <div class="flex items-center gap-1.5">
        <p class="text-[11px] font-semibold text-charcoal-800 truncate flex-1">${esc(plan.name)}</p>
        ${plan.highlighted ? '<span class="badge badge-brand">Popular</span>' : ''}
        <p class="text-[11px] font-semibold text-charcoal-800 tabular-nums">${formatMoney(plan.price)}</p>
        <button onclick="openPlanEditor('${plan.id}')" class="btn btn-sm btn-ghost text-brand-700 px-1.5">Edit</button>
      </div>
      <p class="text-[9px] text-charcoal-400 truncate mt-0.5">${esc(planCycleName(plan))} · ${plan.seatLimit ? plan.seatLimit + ' seats' : 'unlimited'} · ${trialText(plan)}${plan.addons && plan.addons.length ? ` · ${plan.addons.length} add-on${plan.addons.length === 1 ? '' : 's'}` : ''}</p>
      <div class="flex items-center gap-1.5 mt-1">
        <span class="text-[9px] text-charcoal-500 flex-shrink-0">${gymsOn.length} gym${gymsOn.length === 1 ? '' : 's'}</span>
        <div class="meter flex-1"><div class="meter-fill" style="width:${share}%"></div></div>
        <span class="text-[9px] uppercase tracking-wider text-charcoal-400 flex-shrink-0">MRR</span>
        <span class="text-[9px] font-semibold text-charcoal-700 tabular-nums whitespace-nowrap text-right">${mrr ? formatMoney(mrr) : '—'}</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="card card-grow">
    <div class="card-head">
      <div class="flex-1 min-w-0">
        <p class="bento-label">Subscription plans</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5 truncate">${PLANS.length} plans · ${formatMoney(total)} MRR</p>
      </div>
      <button onclick="openPlanEditor()" class="btn btn-primary btn-sm">+ New</button>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto">${rows}</div>
    <div class="px-3 py-1.5 border-t border-charcoal-100">
      <button onclick="navigateTo('revenue')" class="btn btn-sm btn-ghost text-brand-700 w-full">Plan performance →</button>
    </div>
  </div>`;
}


function openPlanEditor(planId, duplicateFromId) {
  const plan = planId ? PLANS.find((p) => p.id === planId) : duplicateFromId ? PLANS.find((p) => p.id === duplicateFromId) : null;
  const isEdit = !!planId;
  const cycle = planCycleParts(plan);
  const trial = plan ? (plan.trial || 'none') : 'none';
  const features = plan ? plan.features.slice() : [];
  // A fresh plan already shows one priced extra so the pattern is obvious.
  const addons = plan && plan.addons ? plan.addons.slice() : [{ name: 'Extra employees', qty: 5, price: 100 }];

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
        <div><label class="form-label">Price (EGP <span id="plan-price-unit">${cycleLabel(cycle)}</span>) <span class="text-red-500">*</span></label>
          <input class="form-input" id="plan-price" type="number" min="0" value="${plan ? plan.price : ''}" placeholder="0"></div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div><label class="form-label">Billed every</label>
          <div class="flex items-center gap-1.5">
            <input class="form-input w-14" id="plan-cycle-count" type="number" min="1" max="60" value="${cycle.count}" oninput="planUpdatePriceUnit()" aria-label="Billing cycle length">
            <select class="form-select flex-1" id="plan-cycle-unit" onchange="planUpdatePriceUnit()" aria-label="Billing cycle unit">
              <option value="months"${cycle.unit === 'months' ? ' selected' : ''}>month(s)</option>
              <option value="years"${cycle.unit === 'years' ? ' selected' : ''}>year(s)</option>
            </select>
          </div></div>
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
        <div id="plan-feature-list" class="border border-charcoal-200 rounded-lg px-2.5 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 max-h-[22vh] overflow-y-auto">
          ${featureList}
        </div>
        <div class="flex items-center gap-1.5 mt-1.5">
          <input class="form-input form-input-sm flex-1" id="plan-feature-input" placeholder="Add another feature…" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomFeature();}">
          <button type="button" onclick="addCustomFeature()" class="btn btn-sm btn-secondary flex-shrink-0">Add</button>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="form-label mb-0">Add-ons &amp; overage</label>
          <button type="button" onclick="addPlanAddon()" class="btn btn-sm btn-secondary">+ Add line</button>
        </div>
        <div id="plan-addon-list" class="space-y-1.5">
          ${addons.map((a) => planAddonRow(a)).join('')}
        </div>
        <p class="text-[10px] text-charcoal-400 mt-1">Charge for going past the allowance — e.g. <strong class="text-charcoal-600">extra 5 employees for EGP 100</strong>. Leave the list empty for a fixed plan.</p>
      </div>

      <label class="form-check"><input type="checkbox" id="plan-highlighted" ${plan && plan.highlighted ? 'checked' : ''}> Mark as the recommended plan</label>
      <p class="text-[10px] text-charcoal-400">Leave a limit empty for unlimited. Existing gyms are re-seated only when you change their plan.</p>
    </div>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      ${isEdit ? `<button onclick="openPlanEditor(null,'${planId}')" class="btn btn-sm btn-secondary">Duplicate</button>` : ''}
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

// One priced extra: "Extra employees · per 5 · EGP 100".
function planAddonRow(addon) {
  const a = addon || { name: '', qty: 1, price: 0 };
  return `<div class="plan-addon flex items-center gap-1.5">
    <input class="form-input form-input-sm flex-1 min-w-0" data-addon="name" placeholder="e.g. Extra employees" value="${esc(a.name)}" aria-label="Add-on name">
    <span class="text-[10px] text-charcoal-400 flex-shrink-0">per</span>
    <input class="form-input form-input-sm w-14 flex-shrink-0" data-addon="qty" type="number" min="1" value="${a.qty || 1}" aria-label="Add-on size">
    <span class="text-[10px] text-charcoal-400 flex-shrink-0">EGP</span>
    <input class="form-input form-input-sm w-20 flex-shrink-0" data-addon="price" type="number" min="0" value="${a.price || 0}" aria-label="Add-on price">
    <button type="button" onclick="this.closest('.plan-addon').remove()" class="btn btn-sm btn-ghost text-red-600 px-1.5 flex-shrink-0" aria-label="Remove add-on">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  </div>`;
}

function addPlanAddon() {
  const list = document.getElementById('plan-addon-list');
  if (!list) return;
  list.insertAdjacentHTML('beforeend', planAddonRow());
  const inputs = list.querySelectorAll('.plan-addon:last-child input');
  if (inputs[0]) inputs[0].focus();
}

function planAddons() {
  return Array.from(document.querySelectorAll('#plan-addon-list .plan-addon')).map((row) => ({
    name: (row.querySelector('[data-addon="name"]') || {}).value ? row.querySelector('[data-addon="name"]').value.trim() : '',
    qty: Number((row.querySelector('[data-addon="qty"]') || {}).value || 1),
    price: Number((row.querySelector('[data-addon="price"]') || {}).value || 0),
  })).filter((a) => a.name && a.price > 0);
}

function planUpdatePriceUnit() {
  const el = document.getElementById('plan-price-unit');
  if (!el) return;
  const count = Number((document.getElementById('plan-cycle-count') || {}).value || 1);
  const unit = (document.getElementById('plan-cycle-unit') || {}).value || 'months';
  el.textContent = cycleLabel({ cycleCount: count, cycleUnit: unit });
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
  const cycleCount = Math.max(1, Number((document.getElementById('plan-cycle-count') || {}).value || 1));
  const cycleUnit = (document.getElementById('plan-cycle-unit') || {}).value === 'years' ? 'years' : 'months';
  const trial = (document.getElementById('plan-trial') || {}).value || 'none';
  const trialDays = trial === 'days' ? Number((document.getElementById('plan-trial-days') || {}).value || 14) : 0;
  const seatsRaw = (document.getElementById('plan-seats') || {}).value;
  const branchesRaw = (document.getElementById('plan-branches') || {}).value;
  const features = planFeatureBoxes().filter((b) => b.checked).map((b) => b.value);
  const highlighted = !!(document.getElementById('plan-highlighted') || {}).checked;
  const addons = planAddons();
  const seatLimit = seatsRaw ? Number(seatsRaw) : null;
  const branchLimit = branchesRaw ? Number(branchesRaw) : null;

  if (!price) { toast('Set a price for this plan', 'error'); return; }
  if (!features.length) { toast('Select at least one feature', 'error'); return; }

  if (highlighted) PLANS.forEach((p) => { p.highlighted = false; });

  const cycleName = planCycleName({ cycleCount, cycleUnit });
  const trialName = trial === 'trial' ? 'trial plan, never billed' : trial === 'days' ? `${trialDays}-day free trial` : 'no trial';
  const addonName = addons.length ? ` · ${addons.length} add-on${addons.length === 1 ? '' : 's'}` : '';

  if (planId) {
    const plan = PLANS.find((p) => p.id === planId);
    plan.name = name;
    plan.price = price;
    plan.cycleCount = cycleCount;
    plan.cycleUnit = cycleUnit;
    delete plan.cycle;
    plan.trial = trial;
    plan.trialDays = trialDays;
    plan.features = features;
    plan.addons = addons;
    plan.seatLimit = seatLimit;
    plan.branchLimit = branchLimit;
    plan.highlighted = highlighted;
    logAudit({
      category: 'Settings', severity: 'warning', action: 'Updated subscription plan',
      target: `${plan.name} · ${formatMoney(plan.price)} ${cycleName.toLowerCase()}${addonName}`,
      detail: `Seats ${seatLimit || 'unlimited'} · branches ${branchLimit || 'unlimited'} · ${trialName} · ${features.length} features · ${addons.length} add-ons.`,
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
    cycleCount,
    cycleUnit,
    trial,
    trialDays,
    tagline: `${cycleName} · ${trialName}`,
    features,
    addons,
    seatLimit,
    branchLimit,
    highlighted,
  };
  PLANS.push(plan);
  logAudit({
    category: 'Settings', severity: 'info', action: 'Created subscription plan',
    target: `${plan.name} · ${formatMoney(plan.price)} ${cycleName.toLowerCase()}${addonName}`,
    detail: `Seats ${seatLimit || 'unlimited'} · branches ${branchLimit || 'unlimited'} · ${trialName} · ${addons.length} add-ons.${duplicateFromId ? ' Duplicated from ' + (PLANS.find((p) => p.id === duplicateFromId) || {}).name + '.' : ''}`,
  });
  closeModal();
  renderAll();
  toast(`${plan.name} created`, 'success');
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
