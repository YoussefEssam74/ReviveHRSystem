// ==================== SUPER ADMIN — CORE RUNTIME ====================
const state = {
  currentPage: 'dashboard',
  activeGymId: null,
  gymTab: 'overview',
  userFilters: { gym: 'all', role: 'all', status: 'all', q: '' },
  gymFilters: { status: 'all', plan: 'all', q: '' },
  revenuePeriod: 'Nov 2026',
  revenueMetric: 'mrr',
  modal: null,
  wizard: null,
  notifOpen: false,
  userMenuOpen: false,
  sidebarOpen: false,
};

const NAV = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    ],
  },
  {
    section: 'Platform',
    items: [
      { id: 'gyms', label: 'Gym accounts', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', badge: 'gyms' },
      { id: 'users', label: 'Users', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { id: 'hr-managers', label: 'HR managers', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    ],
  },
  {
    section: 'Revenue',
    items: [
      { id: 'billing', label: 'Billing & quotas', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', badge: 'billing', children: [
        { id: 'revenue', label: 'Revenue analyzes', also: ['revenue-detail'], icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      ] },
    ],
  },
  {
    section: 'Governance',
    items: [
      { id: 'access', label: 'Roles & permissions', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
    ],
  },
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  gyms: 'Gym accounts',
  'gym-detail': 'Gym account',
  users: 'Users',
  'user-detail': 'User profile',
  'hr-managers': 'HR managers',
  billing: 'Billing & quotas',
  revenue: 'Revenue analyzes',
  'revenue-detail': 'Revenue breakdown',
  access: 'Roles & permissions',
};

// ==================== FORMAT HELPERS ====================
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function initialsOf(name) {
  return String(name || '').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

// Billing cadence is free-form: every N months or every N years.
function planCycleParts(plan) {
  if (plan && plan.cycleCount) return { count: Math.max(1, Number(plan.cycleCount) || 1), unit: plan.cycleUnit === 'years' ? 'years' : 'months' };
  if (plan && plan.cycle === 'yearly') return { count: 1, unit: 'years' };
  if (plan && plan.cycle === 'quarterly') return { count: 3, unit: 'months' };
  return { count: 1, unit: 'months' };
}

// Human billing cycle for a plan ("Monthly", "Every 3 months", "Every 2 years").
function planCycleName(plan) {
  const { count, unit } = planCycleParts(plan);
  if (unit === 'years') return count === 1 ? 'Yearly' : `Every ${count} years`;
  return count === 1 ? 'Monthly' : `Every ${count} months`;
}

// Compact suffix next to a price: "/mo", "/3 mo", "/yr", "/2 yr".
function cycleLabel(plan) {
  const { count, unit } = planCycleParts(plan);
  if (unit === 'years') return count === 1 ? '/yr' : `/${count} yr`;
  return count === 1 ? '/mo' : `/${count} mo`;
}

function formatMoney(n) {
  return 'EGP ' + Number(n || 0).toLocaleString('en-US');
}

// Compact axis labels: 95000 -> "95k", 1250000 -> "1.25m".
function formatMoneyShort(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000000) {
    const m = v / 1000000;
    return (Number.isInteger(m) ? m : m.toFixed(2)) + 'm';
  }
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return (Number.isInteger(k) ? k : k.toFixed(1)) + 'k';
  }
  return String(v);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${h}:${m} ${ampm}`;
}

function relativeTime(iso) {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  const now = new Date(PLATFORM.today).getTime();
  const mins = Math.round((now - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function daysBetween(fromIso, toIso) {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000);
}

// ==================== DERIVED DATA ====================
function getGym(id) { return GYMS.find((g) => g.id === id) || null; }
function getPlan(planId) { return PLANS.find((p) => p.id === planId) || PLANS[0]; }
function gymLabel(gym) { return gym ? `${gym.name} — ${gym.location}` : 'Platform'; }
function getGymUsers(gymId) { return USERS.filter((u) => u.gymId === gymId); }
// HR staff are granted access per gym and may hold several gyms at once.
function getGymHrStaff(gymId) { return USERS.filter((u) => u.role === 'HR' && (u.gymIds || []).includes(gymId)); }
function gymsForUser(user) {
  const ids = user.gymIds || (user.gymId ? [user.gymId] : []);
  return ids.map((id) => getGym(id)).filter(Boolean);
}
function getHRManagers() { return USERS.filter((u) => u.role === 'HR Manager'); }
function getInvoices(gymId) { return INVOICES.filter((i) => i.gymId === gymId); }
function getGymAudit(gymId) { return AUDIT.filter((a) => a.gymId === gymId); }
function getUser(id) { return USERS.find((u) => u.id === id) || null; }
function getRoles() { return ROLES; }
function roleMemberCount(roleName) { return USERS.filter((u) => u.role === roleName).length; }
function getBranchStaff(gymId, branchName) { return USERS.filter((u) => u.gymId === gymId && u.branch === branchName); }

function roleCounts(users) {
  return {
    hrManager: users.filter((u) => u.role === 'HR Manager').length,
    hr: users.filter((u) => u.role === 'HR').length,
    branchManager: users.filter((u) => u.role === 'Branch Manager').length,
    teamLeader: users.filter((u) => u.role === 'Team Leader').length,
    employee: users.filter((u) => u.role === 'Employee').length,
    total: users.length,
  };
}

// Alerts are derived from live state so resolving the underlying issue clears them.
function activeAlerts() {
  return ALERTS.filter((a) => {
    const gym = a.gymId ? getGym(a.gymId) : null;
    switch (a.id) {
      case 'a1': return INVOICES.some((i) => i.status === 'Overdue');
      case 'a3': return !!gym && gym.status === 'Trial';
      case 'a4': return !!gym && !!gym.seatLimit && gym.userCounts.total / gym.seatLimit >= 0.75;
      case 'a5': return !!gym && /pending approval/i.test(gym.payrollStatus);
      default: return true;
    }
  });
}

function platformTotals() {
  const alerts = activeAlerts();
  const totalUsers = USERS.length;
  const gymMembers = USERS.filter((u) => !!u.gymId).length;
  const activeGyms = GYMS.filter((g) => g.status === 'Active').length;
  const trialGyms = GYMS.filter((g) => g.status === 'Trial').length;
  const overdueGyms = GYMS.filter((g) => g.status === 'Payment overdue').length;
  const suspendedGyms = GYMS.filter((g) => g.status === 'Suspended').length;
  const mrr = GYMS.reduce((s, g) => s + g.mrr, 0);
  const limits = GYMS.filter((g) => g.seatLimit != null);
  const seatCapacity = limits.reduce((s, g) => s + g.seatLimit, 0);
  const seatsOnLimitedPlans = limits.reduce((s, g) => s + g.userCounts.total, 0);
  const hrManagers = getHRManagers().length;
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
  return {
    totalUsers, gymMembers, activeGyms, trialGyms, overdueGyms, suspendedGyms,
    totalGyms: GYMS.length, mrr, seatCapacity, seatsOnLimitedPlans,
    hrManagers, criticalAlerts, alerts: alerts.length,
    atRisk: GYMS.filter((g) => g.status === 'Payment overdue').reduce((s, g) => s + g.mrr, 0),
  };
}

function revenueTotals() {
  const month = 'Nov 2026';
  const thisMonth = INVOICES.filter((i) => i.period === month && i.status !== 'Trial');
  const collected = thisMonth.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const billed = thisMonth.reduce((s, i) => s + i.amount, 0);
  const overdue = INVOICES.filter((i) => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0);
  const mrr = GYMS.reduce((s, g) => s + g.mrr, 0);
  return { mrr, arr: mrr * 12, collected, billed, overdue, outstanding: Math.max(0, billed - collected) };
}

// Column sorting shared by the table views.
function sortIndicator(activeKey, key, dir) {
  if (activeKey !== key) return '<span class="sort-mark">↕</span>';
  return `<span class="sort-mark active">${dir === 'asc' ? '↑' : '↓'}</span>`;
}

// ==================== BADGES & SMALL COMPONENTS ====================
const STATUS_TONE = {
  Active: 'badge-green',
  Trial: 'badge-blue',
  'Payment overdue': 'badge-amber',
  Suspended: 'badge-red',
  Invited: 'badge-gray',
  'On leave': 'badge-yellow',
};

function statusBadge(status) {
  return `<span class="badge ${STATUS_TONE[status] || 'badge-gray'}">${esc(status)}</span>`;
}

const SEVERITY_TONE = { critical: 'badge-red', warning: 'badge-amber', info: 'badge-gray' };

function severityBadge(sev) {
  return `<span class="badge ${SEVERITY_TONE[sev] || 'badge-gray'}">${esc(sev)}</span>`;
}

function planBadge(planId) {
  const plan = getPlan(planId);
  const tone = planId === 'enterprise' ? 'badge-purple' : planId === 'growth' ? 'badge-brand' : 'badge-gray';
  return `<span class="badge ${tone}">${esc(plan.name)}</span>`;
}

function avatarHtml(user, size) {
  const cls = `avatar avatar-${size || 28} ${user.avatar || ''}`;
  return `<span class="${cls}">${esc(user.initials || initialsOf(user.name))}</span>`;
}

function gymLogo(gym, size) {
  const cls = `gym-logo gym-logo-${size || 36}`;
  if (gym.logoUrl) {
    return `<span class="${cls}" style="background-image:url('${gym.logoUrl}');background-size:cover;background-position:center;color:transparent">.</span>`;
  }
  return `<span class="${cls}">${esc(gym.logo)}</span>`;
}

function meterHtml(value, max, tone) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return `<div class="meter"><div class="meter-fill ${tone ? 'tone-' + tone : ''}" style="width:${pct}%"></div></div>`;
}

// Seat usage is meaningless on an uncapped plan, so unlimited tenants get a badge
// instead of a bar that would always read as "full".
function seatUsageHtml(gym, tone) {  const used = gym.userCounts.total;
  if (!gym.seatLimit) {
    return `<div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-charcoal-800">${formatNumber(used)}</span>
        <span class="badge badge-purple">Unlimited</span>
      </div>
      <p class="text-[9px] text-charcoal-400 mt-0.5">No seat cap on Enterprise</p>`;
  }
  const pct = Math.round((used / gym.seatLimit) * 100);
  return `<div class="flex items-center justify-between gap-2 mb-1">
      <span class="text-xs font-semibold text-charcoal-800">${formatNumber(used)}</span>
      <span class="text-[9px] ${pct >= 90 ? 'text-amber-600 font-semibold' : 'text-charcoal-400'}">${pct}% of ${gym.seatLimit}</span>
    </div>
    ${meterHtml(used, gym.seatLimit, tone || (pct >= 90 ? 'amber' : ''))}`;
}

function statTile(opts) {
  return `<div class="stat-tile ${opts.accent ? 'stat-tile-accent' : ''}">
    <p class="stat-label">${esc(opts.label)}</p>
    <p class="stat-value ${opts.tone === 'red' ? 'text-red-600' : opts.tone === 'amber' ? 'text-amber-600' : ''}">${opts.value}</p>
    ${opts.sub ? `<p class="stat-sub">${esc(opts.sub)}</p>` : ''}
  </div>`;
}

// Shared KPI tile used by the dashboard and list pages.
const KPI_ICONS = {
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  card: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  alert: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  coins: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
};

function kpiTile(label, value, sub, icon, tone, subHtml) {
  const toneClass = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : '';
  const iconWrap = tone === 'red'
    ? 'bg-red-50 text-red-600'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-600'
      : 'bg-charcoal-100 text-charcoal-500';
  return `<div class="card px-3 py-2">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="stat-label">${esc(label)}</p>
        <p class="stat-value ${toneClass} mt-0.5">${value}</p>
      </div>
      <span class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconWrap}">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="${KPI_ICONS[icon] || KPI_ICONS.shield}"/></svg>
      </span>
    </div>
    <p class="stat-sub mt-1">${subHtml === undefined ? esc(sub) : subHtml}</p>
  </div>`;
}

function emptyState(text, hint) {  return `<div class="empty-state">
    <svg class="w-6 h-6 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
    <p class="font-medium text-charcoal-500">${esc(text)}</p>
    ${hint ? `<p class="text-[10px] mt-0.5">${esc(hint)}</p>` : ''}
  </div>`;
}

function pageHeader(title, subtitle, actionsHtml) {
  return `<div class="flex items-start justify-between gap-3 flex-wrap mb-2">
    <div class="min-w-0">
      <h2 class="font-bold text-charcoal-800" style="font-size:var(--font-page-title)">${title}</h2>
      ${subtitle ? `<p class="text-charcoal-500 mt-0.5" style="font-size:var(--font-2xs)">${subtitle}</p>` : ''}
    </div>
    ${actionsHtml ? `<div class="flex items-center gap-1.5 flex-wrap">${actionsHtml}</div>` : ''}
  </div>`;
}

// ==================== CHARTS (inline SVG, no dependencies) ====================
function sparkline(values, tone) {
  if (!values || !values.length) return '';
  const w = 72, h = 22;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / range) * (h - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const color = tone === 'red' ? '#dc2626' : tone === 'amber' ? '#d97706' : '#006c49';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" aria-hidden="true"><path d="${d}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// A trend chart that never distorts. Only the geometry lives in the SVG (it is
// stretched to whatever width the card has); every label and dot is HTML, so text
// stays crisp and dots stay round no matter how wide the container gets.
function areaChart(series, opts) {
  opts = opts || {};
  const key = opts.key || 'users';
  const step = opts.step || 50;
  const h = opts.height || 150;
  const fmt = opts.format || ((v) => String(v));
  const color = opts.color || '#006c49';
  const values = series.map((s) => s[key]);
  const max = Math.ceil(Math.max(...values) / step) * step || 1;
  const TOP = 12, BOTTOM = 88;
  const xPct = (i) => (series.length === 1 ? 0 : (i / (series.length - 1)) * 100);
  const yPct = (v) => BOTTOM - (v / max) * (BOTTOM - TOP);
  const pts = series.map((s, i) => [xPct(i), yPct(s[key])]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const area = `${line} L100 100 L0 100 Z`;

  const grid = [TOP, (TOP + BOTTOM) / 2, BOTTOM].map((gy) =>
    `<line x1="0" y1="${gy}" x2="100" y2="${gy}" stroke="#f1f3f5" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');

  const yLabels = [max, max / 2, 0].map((v, i) =>
    `<span class="trend-ylabel" style="top:${[TOP, (TOP + BOTTOM) / 2, BOTTOM][i]}%">${fmt(v)}</span>`).join('');

  const dots = series.map((s, i) => {
    const dx = i === 0 ? '0' : i === series.length - 1 ? '-100%' : '-50%';
    return `<span class="trend-dot" style="left:${pts[i][0].toFixed(2)}%;top:${pts[i][1].toFixed(2)}%;--dx:${dx};border-color:${color}" title="${esc(s.label)}: ${fmt(s[key])}"></span>`;
  }).join('');

  const xLabels = series.map((s, i) => {
    const shift = i === 0 ? '0' : i === series.length - 1 ? '-100%' : '-50%';
    return `<span class="trend-xlabel" style="left:${pts[i][0].toFixed(2)}%;transform:translateX(${shift})">${esc(s.label)}</span>`;
  }).join('');

  return `<div class="trend" role="img" aria-label="${esc(opts.label || 'Trend')}">
    <div class="trend-plot" style="height:${h}px">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient></defs>
        ${grid}
        <path d="${area}" fill="url(#trendFill)"/>
        <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>
      ${yLabels}${dots}
    </div>
    <div class="trend-x">${xLabels}</div>
  </div>`;
}

// ==================== TOASTS ====================
const TOAST_ICONS = {
  success: '<svg class="toast-icon text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  error: '<svg class="toast-icon text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  info: '<svg class="toast-icon text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
};

function toast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${TOAST_ICONS[type || 'success']}<div class="flex-1">${esc(message)}</div>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

// ==================== MODAL ====================
function modalInnerHtml(opts) {
  return `<div class="flex items-start gap-2 px-4 py-3 border-b border-charcoal-100 flex-shrink-0">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-charcoal-900 leading-tight">${opts.title || ''}</p>
        ${opts.subtitle ? `<p class="text-[10px] text-charcoal-500 mt-0.5 leading-snug">${opts.subtitle}</p>` : ''}
      </div>
      <button onclick="closeModal()" class="p-1 rounded hover:bg-charcoal-100 text-charcoal-400 hover:text-charcoal-600 flex-shrink-0" aria-label="Close">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="px-4 py-3 overflow-y-auto flex-1">${opts.body || ''}</div>
    ${opts.footer ? `<div class="px-4 py-2.5 border-t border-charcoal-100 flex items-center justify-end gap-1.5 flex-shrink-0">${opts.footer}</div>` : ''}`;
}

function openModal(opts) {
  const container = document.getElementById('modal-container');
  if (!container) return;
  const width = opts.width || 'max-w-lg';
  container.innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
    <div class="modal-content ${width}" role="dialog" aria-modal="true">${modalInnerHtml(opts)}</div>
  </div>`;
  document.removeEventListener('keydown', escCloseHandler);
  document.addEventListener('keydown', escCloseHandler);
  state.modal = opts;
}

// Swaps a modal's contents in place — used by multi-step flows so the backdrop
// and its entrance animation do not replay on every step.
function updateModal(opts) {
  const container = document.getElementById('modal-container');
  const content = container ? container.querySelector('.modal-content') : null;
  if (!content) return openModal(opts);
  content.className = 'modal-content ' + (opts.width || 'max-w-lg');
  content.innerHTML = modalInnerHtml(opts);
  state.modal = opts;
}

function escCloseHandler(e) { if (e.key === 'Escape') closeModal(); }

function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) container.innerHTML = '';
  document.removeEventListener('keydown', escCloseHandler);
  state.modal = null;
  state.wizard = null;
}

// ==================== AUDIT WRITES ====================
function logAudit(entry) {
  // Derive from the highest existing id so ids stay unique no matter how many were seeded.
  const maxId = AUDIT.reduce((max, a) => {
    const n = parseInt(String(a.id).replace('AL-', ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 10291);
  const id = 'AL-' + (maxId + 1);
  AUDIT.unshift(Object.assign({
    id,
    ts: new Date().toISOString(),
    actor: CURRENT_ADMIN.name,
    actorRole: 'Super Admin',
    initials: CURRENT_ADMIN.initials,
    gymId: null,
    category: 'Settings',
    severity: 'info',
    ip: '156.204.11.8',
  }, entry));
}

// ==================== NAVIGATION ====================
function navigateTo(page, opts) {
  opts = opts || {};
  if (page === 'gym-detail') {
    if (opts.gymId) state.activeGymId = opts.gymId;
    if (opts.tab) state.gymTab = opts.tab;
    if (!state.activeGymId) { page = 'gyms'; }
  }
  if (page === 'user-detail') {
    if (opts.userId) state.activeUserId = opts.userId;
    if (!state.activeUserId) { page = 'users'; }
  }
  if (page === 'revenue-detail' && opts.metric) state.revenueMetric = opts.metric;
  if (opts.resetFilters) {
    state.userFilters = { gym: 'all', role: 'all', status: 'all', q: '' };
    state.gymFilters = { status: 'all', plan: 'all', q: '' };
  }
  if (opts.userFilter) state.userFilters = Object.assign({}, state.userFilters, opts.userFilter);
  if (opts.gymFilter) state.gymFilters = Object.assign({}, state.gymFilters, opts.gymFilter);
  state.currentPage = page;
  renderAll();
  closeSidebar();
  closeUserMenu();
  closeNotifDd();
  const main = document.getElementById('main-content');
  if (main) main.scrollTop = 0;
}

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (!s || !o) return;
  if (state.sidebarOpen) { s.classList.remove('-translate-x-full'); o.classList.remove('hidden'); }
  else { s.classList.add('-translate-x-full'); o.classList.add('hidden'); }
}

function closeSidebar() {
  state.sidebarOpen = false;
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.add('-translate-x-full');
  if (o) o.classList.add('hidden');
}

function toggleUserMenu() {
  state.userMenuOpen = !state.userMenuOpen;
  const d = document.getElementById('user-menu-dropdown');
  if (!d) return;
  d.classList.toggle('hidden', !state.userMenuOpen);
}

function closeUserMenu() {
  state.userMenuOpen = false;
  const d = document.getElementById('user-menu-dropdown');
  if (d) d.classList.add('hidden');
}

function toggleNotifDd(event) {
  if (event) event.stopPropagation();
  state.notifOpen = !state.notifOpen;
  const d = document.getElementById('header-notif-dd');
  if (!d) return;
  if (state.notifOpen) { d.innerHTML = renderAlertsDropdown(); d.classList.remove('hidden'); }
  else d.classList.add('hidden');
}

function closeNotifDd() {
  state.notifOpen = false;
  const d = document.getElementById('header-notif-dd');
  if (d) d.classList.add('hidden');
}

function handleLogout() {
  openModal({
    title: 'Sign out of the platform console?',
    body: '<p class="text-xs text-charcoal-600">Any gym workspace session you opened will be closed and recorded on the audit trail.</p>',
    footer: '<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="closeModal();toast(\'Signed out of the prototype\',\'info\')" class="btn btn-sm btn-danger">Sign out</button>',
  });
}

function runGlobalSearch(query) {
  const q = String(query || '').trim();
  if (!q) return;
  const gymHit = GYMS.find((g) => (g.name + ' ' + g.location + ' ' + g.code).toLowerCase().includes(q.toLowerCase()));
  const userHit = USERS.find((u) => (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase()));
  if (gymHit) { navigateTo('gym-detail', { gymId: gymHit.id }); toast(`Opened ${gymHit.name} — ${gymHit.location}`, 'info'); return; }
  if (userHit) { navigateTo('users', { userFilter: { q } }); toast(`Filtered users by “${q}”`, 'info'); return; }
  navigateTo('gyms', { gymFilter: { q } });
  toast(`No gym or user matched “${q}” — filtered gym accounts instead`, 'info');
}

// ==================== NAV RENDERING ====================
function navBadgeHtml(kind) {
  if (kind === 'gyms') {
    const t = platformTotals();
    const n = t.overdueGyms + t.trialGyms;
    return n ? `<span class="nav-badge nav-badge-amber">${n}</span>` : '';
  }
  if (kind === 'billing') {
    const n = INVOICES.filter((i) => i.status === 'Overdue').length;
    return n ? `<span class="nav-badge nav-badge-red">${n}</span>` : '';
  }
  return '';
}

function renderNav() {
  const container = document.getElementById('sidebar-nav');
  if (!container) return;
  const itemHtml = (item, isChild) => {
    const kids = item.children || [];
    const selfActive = state.currentPage === item.id
      || (state.currentPage === 'gym-detail' && item.id === 'gyms')
      || (item.also || []).includes(state.currentPage);
    const activeChild = kids.some((c) => c.id === state.currentPage || (c.also || []).includes(state.currentPage));
    const childHtml = kids.map((c) => itemHtml(c, true)).join('');
    return `<button class="nav-item${isChild ? ' nav-child' : ''}${selfActive ? ' active' : ''}${activeChild ? ' active-parent' : ''}"
        onclick="navigateTo('${item.id}')" aria-current="${state.currentPage === item.id ? 'page' : 'false'}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="${item.icon}"/></svg>
        <span class="nav-label">${esc(item.label)}</span>
        ${item.badge ? navBadgeHtml(item.badge) : ''}
      </button>${childHtml}`;
  };
  container.innerHTML = NAV.map((group) => {
    const items = group.items.map((item) => itemHtml(item, false)).join('');
    return `<p class="nav-section-title">${esc(group.section)}</p>${items}`;
  }).join('');
}

function renderAlertsDropdown() {
  const alerts = activeAlerts();
  const rows = alerts.map((a) => `
    <button onclick="closeNotifDd();${a.page === 'gym-detail' ? `navigateTo('gym-detail',{gymId:'${a.gymId}'})` : `navigateTo('${a.page}')`}"
      class="w-full text-left px-3 py-2 hover:bg-charcoal-50 flex items-start gap-2 border-b border-charcoal-100 last:border-0">
      <span class="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}"></span>
      <span class="min-w-0">
        <span class="block text-[11px] font-semibold text-charcoal-800 leading-tight">${esc(a.title)}</span>
        <span class="block text-[10px] text-charcoal-500 leading-snug mt-0.5">${esc(a.detail)}</span>
      </span>
    </button>`).join('');
  return `<div class="px-3 py-2 border-b border-charcoal-100 flex items-center justify-between">
      <p class="text-[10px] font-bold uppercase tracking-wider text-charcoal-500">Needs attention</p>
      <span class="badge badge-red">${alerts.length}</span>
    </div>
    <div class="max-h-72 overflow-y-auto">${rows}</div>`;
}

function updateHeaderState() {
  const dot = document.getElementById('header-alert-dot');
  if (dot) {
    const n = activeAlerts().length;
    dot.textContent = n;
    dot.classList.toggle('hidden', n === 0);
    dot.classList.toggle('flex', n > 0);
  }
  const title = document.getElementById('mobile-page-title');
  if (title) {
    if (state.currentPage === 'gym-detail') {
      const gym = getGym(state.activeGymId);
      title.textContent = gym ? gym.name : 'Gym account';
    } else if (state.currentPage === 'user-detail') {
      const user = getUser(state.activeUserId);
      title.textContent = user ? user.name : 'User profile';
    } else {
      title.textContent = PAGE_TITLES[state.currentPage] || 'Dashboard';
    }
  }
}

// ==================== RENDER ====================
const RENDERERS = {
  dashboard: () => renderDashboard(),
  gyms: () => renderGyms(),
  'gym-detail': () => renderGymDetail(),
  users: () => renderUsers(),
  'user-detail': () => renderUserProfile(),
  'hr-managers': () => renderHRManagers(),
  billing: () => renderBilling(),
  revenue: () => renderRevenue(),
  'revenue-detail': () => renderRevenueDetail(),
  access: () => renderRoles(),
};

function renderAll() {
  const renderer = RENDERERS[state.currentPage] || RENDERERS.dashboard;
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = `<div class="page-fit">${renderer()}</div>`;
  renderNav();
  updateHeaderState();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#user-menu-container')) closeUserMenu();
  if (!e.target.closest('#header-notif-dd') && !e.target.closest('[aria-label="Alerts"]')) closeNotifDd();
});

// ==================== WORKSPACE HANDOFF ====================
function openWorkspace(gymId, roleLabel) {
  const gym = getGym(gymId);
  if (!gym) return;
  openModal({
    title: 'Enter gym workspace',
    subtitle: `${esc(gym.name)} — ${esc(gym.location)} · ${esc(roleLabel || 'HR Manager')} view`,
    width: 'max-w-md',
    body: `<div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-3">
        <p class="text-[11px] font-semibold text-amber-800">This session is audited</p>
        <p class="text-[10px] text-amber-700 mt-0.5 leading-relaxed">Every action you take inside the gym workspace is written to the platform audit trail with your Super Admin identity attached.</p>
      </div>
      <dl class="text-[11px] space-y-1.5">
        <div class="flex justify-between gap-3"><dt class="text-charcoal-500">Inherited role</dt><dd class="font-semibold text-charcoal-800">${esc(roleLabel || 'HR Manager')}</dd></div>
        <div class="flex justify-between gap-3"><dt class="text-charcoal-500">Gym scope</dt><dd class="font-semibold text-charcoal-800">${esc(gym.name)} — ${esc(gym.location)}</dd></div>
        <div class="flex justify-between gap-3"><dt class="text-charcoal-500">Permissions</dt><dd class="font-semibold text-charcoal-800">Full HR Manager access</dd></div>
        <div class="flex justify-between gap-3"><dt class="text-charcoal-500">Session logging</dt><dd class="font-semibold text-charcoal-800">Audit trail · Access</dd></div>
      </dl>
      <p class="text-[10px] text-charcoal-400 mt-3">The prototype opens the HR portal in a new tab with the selected role preset.</p>`,
    footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="confirmOpenWorkspace('${gym.id}','${esc(roleLabel || 'HR Manager')}')" class="btn btn-sm btn-primary">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        Enter workspace
      </button>`,
  });
}

function confirmOpenWorkspace(gymId, roleLabel) {
  const gym = getGym(gymId);
  logAudit({
    gymId,
    category: 'Access',
    severity: 'info',
    action: 'Entered gym workspace',
    target: gymLabel(gym),
    detail: `Impersonated the ${roleLabel} preset for ${gymLabel(gym)}. Session opened from the Super Admin console.`,
  });
  closeModal();
  renderAll();
  window.open('../HR/index.html', '_blank', 'noopener');
  toast(`Opened ${gym.name} — ${gym.location} workspace · access logged`, 'success');
}
