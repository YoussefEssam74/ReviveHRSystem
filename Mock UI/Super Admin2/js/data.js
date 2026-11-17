// ==================== SUPER ADMIN — MOCK PLATFORM DATA ====================
// One tenant = one gym account the Super Admin provisioned. Seat counts are
// authoritative; the user records below are generated to match them so that every
// "users per gym" number on screen reconciles with the rows in the tables.

const PLATFORM = {
  name: 'ReviveHR',
  planYear: '2026',
  today: '2026-11-17T16:15:00',
};

const CURRENT_ADMIN = {
  id: 'SA-00001',
  name: 'Youssef Essam',
  initials: 'YE',
  email: 'youssef.essam@revivehr.com',
  phone: '+20 100 555 0100',
  role: 'Super Admin',
  title: 'Platform Owner',
  lastLogin: '2026-11-17T08:04:00',
};

// ==================== SUBSCRIPTION PLANS ====================
const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 8500, seatLimit: 50, branchLimit: 1,
    cycle: 'monthly', trial: 'none', trialDays: 0,
    tagline: 'Single-site gyms finding their footing',
    features: [
      'Employee records & document vault',
      'Biometric attendance kiosk',
      'Leave, shift & deduction requests',
      'Payslip generation',
      'Employee self-service portal',
    ],
  },
  {
    id: 'growth', name: 'Growth', price: 18000, seatLimit: 100, branchLimit: 3,
    cycle: 'monthly', trial: 'days', trialDays: 14,
    tagline: 'Multi-branch fitness clubs',
    features: [
      'Everything in Starter',
      'Multi-branch scoping & transfers',
      'Recruitment & hiring pipeline',
      'Payroll approval and locking',
      'Performance evaluation cycles',
      'Reports & analytics',
    ],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 42000, seatLimit: null, branchLimit: null,
    cycle: 'yearly', trial: 'none', trialDays: 0,
    tagline: 'National gym chains with compliance needs',
    features: [
      'Everything in Growth',
      'Unlimited seats & branches',
      'Platform audit export',
      'SSO & SCIM provisioning',
      'Dedicated success manager',
      '99.9% uptime SLA',
    ],
  },
];

// Pickable features when building a plan.
const FEATURE_CATALOG = [
  'Employee records & document vault',
  'Biometric attendance kiosk',
  'Leave, shift & deduction requests',
  'Payslip generation',
  'Employee self-service portal',
  'Multi-branch scoping & transfers',
  'Recruitment & hiring pipeline',
  'Payroll approval and locking',
  'Performance evaluation cycles',
  'Reports & analytics',
  'Gym audit trail',
  'API access',
  'SSO & SCIM provisioning',
  'Dedicated success manager',
  '99.9% uptime SLA',
];

const BILLING_CYCLES = [
  { id: 'monthly', label: 'Monthly', short: '/mo', months: 1 },
  { id: 'quarterly', label: 'Every 3 months', short: '/3 mo', months: 3 },
  { id: 'yearly', label: 'Yearly', short: '/yr', months: 12 },
];

const TRIAL_MODES = [
  { id: 'none', label: 'No trial — paid from day one' },
  { id: 'days', label: 'Free trial before billing starts' },
  { id: 'trial', label: 'This is a trial plan (never billed)' },
];

// ==================== GYM ACCOUNTS (TENANTS) ====================
// userCounts.hrManager + hr + branchManager + teamLeader + employee === userCounts.total
const GYMS = [
  {
    id: 'gym-1', code: 'RV-NC', name: 'Revive Gym', location: 'Nasr City', city: 'Cairo',
    logo: 'RG', domain: 'revivegym.com', status: 'Active', planId: 'growth',
    seatLimit: 100, branches: 2,
    subscribedOn: '2024-01-15', renewsOn: '2027-01-14', billingCycle: 'Annual',
    mrr: 18000,
    contact: { name: 'Youssef Essam', email: 'ops@revivegym.com', phone: '+20 100 111 2233' },
    health: 94, attendanceRate: 92, payrollStatus: 'Locked · Nov 2026',
    lastActivity: '2026-11-17T14:22:00',
    userCounts: { total: 58, hrManager: 1, hr: 1, branchManager: 1, teamLeader: 3, employee: 52 },
    activity: [22, 28, 24, 31, 26, 34, 29, 36, 33, 38, 35, 41, 37, 44],
  },
  {
    id: 'gym-2', code: 'RV-HP', name: 'Revive Gym', location: 'Heliopolis', city: 'Cairo',
    logo: 'RH', domain: 'revivegym.com', status: 'Active', planId: 'growth',
    seatLimit: 100, branches: 1,
    subscribedOn: '2024-08-02', renewsOn: '2027-01-14', billingCycle: 'Annual',
    mrr: 18000,
    contact: { name: 'Youssef Essam', email: 'ops@revivegym.com', phone: '+20 100 111 2233' },
    health: 88, attendanceRate: 89, payrollStatus: 'Locked · Nov 2026',
    lastActivity: '2026-11-17T13:05:00',
    userCounts: { total: 45, hrManager: 1, hr: 1, branchManager: 1, teamLeader: 2, employee: 40 },
    activity: [18, 21, 19, 24, 22, 27, 25, 29, 26, 31, 28, 33, 30, 35],
  },
  {
    id: 'gym-3', code: 'RV-6O', name: 'Revive Fitness', location: '6th October', city: 'Giza',
    logo: 'RF', domain: 'revivefitness.com', status: 'Active', planId: 'starter',
    seatLimit: 50, branches: 1,
    subscribedOn: '2025-02-11', renewsOn: '2027-02-10', billingCycle: 'Monthly',
    mrr: 8500,
    contact: { name: 'Mona Khalil', email: 'front@revivefitness.com', phone: '+20 101 222 3344' },
    health: 81, attendanceRate: 84, payrollStatus: 'Pending approval · Nov 2026',
    lastActivity: '2026-11-17T12:40:00',
    userCounts: { total: 39, hrManager: 1, hr: 1, branchManager: 1, teamLeader: 2, employee: 34 },
    activity: [14, 17, 15, 19, 16, 21, 18, 22, 20, 24, 21, 25, 23, 27],
  },
  {
    id: 'gym-4', code: 'IH-AL', name: 'Iron House Gym', location: 'Alexandria', city: 'Alexandria',
    logo: 'IH', domain: 'ironhouse.com', status: 'Active', planId: 'enterprise',
    seatLimit: null, branches: 4,
    subscribedOn: '2023-11-04', renewsOn: '2026-12-03', billingCycle: 'Monthly',
    mrr: 42000,
    contact: { name: 'Hany Darwish', email: 'admin@ironhouse.com', phone: '+20 102 333 4455' },
    health: 97, attendanceRate: 95, payrollStatus: 'Locked · Nov 2026',
    lastActivity: '2026-11-17T15:48:00',
    userCounts: { total: 96, hrManager: 1, hr: 2, branchManager: 3, teamLeader: 6, employee: 84 },
    activity: [38, 44, 41, 49, 45, 53, 48, 57, 52, 61, 56, 64, 59, 68],
  },
  {
    id: 'gym-5', code: 'PP-GZ', name: 'Peak Performance', location: 'Sheikh Zayed', city: 'Giza',
    logo: 'PP', domain: 'peakperformance.com', status: 'Trial', planId: 'growth',
    seatLimit: 100, branches: 1,
    subscribedOn: '2026-10-28', renewsOn: '2026-11-27', billingCycle: 'Trial · 30 days',
    mrr: 0,
    contact: { name: 'Nour Shehata', email: 'hello@peakperformance.com', phone: '+20 103 444 5566' },
    health: 72, attendanceRate: 68, payrollStatus: 'Not started',
    lastActivity: '2026-11-17T10:12:00',
    userCounts: { total: 31, hrManager: 1, hr: 0, branchManager: 1, teamLeader: 2, employee: 27 },
    activity: [9, 12, 10, 14, 11, 16, 13, 18, 15, 19, 17, 21, 18, 23],
  },
  {
    id: 'gym-6', code: 'FF-MA', name: 'Flex Factory', location: 'Mansoura', city: 'Dakahlia',
    logo: 'FF', domain: 'flexfactory.com', status: 'Payment overdue', planId: 'starter',
    seatLimit: 50, branches: 1,
    subscribedOn: '2025-06-19', renewsOn: '2026-12-19', billingCycle: 'Monthly',
    mrr: 8500,
    contact: { name: 'Ashraf Selim', email: 'accounts@flexfactory.com', phone: '+20 104 555 6677' },
    health: 54, attendanceRate: 61, payrollStatus: 'Blocked · invoice overdue',
    lastActivity: '2026-11-15T09:30:00',
    userCounts: { total: 24, hrManager: 1, hr: 1, branchManager: 1, teamLeader: 1, employee: 20 },
    activity: [11, 13, 12, 15, 10, 14, 9, 12, 8, 11, 7, 10, 6, 9],
  },
];

// ==================== BRANCH SITES ====================
// Each gym account owns one or more physical branches; staff belong to a branch.
const GYM_BRANCHES = {
  'gym-1': [
    { code: 'RV-NC-1', name: 'Nasr City — Main Club', area: 'Abbas El-Akkad', address: '22 Abbas El-Akkad St, Nasr City', phone: '+20 100 111 2201', manager: 'Youssef Kamal' },
    { code: 'RV-NC-2', name: 'Nasr City — Studios', area: 'Makram Ebeid', address: '14 Makram Ebeid St, Nasr City', phone: '+20 100 111 2202', manager: 'Hana Mostafa' },
  ],
  'gym-2': [
    { code: 'RV-HP-1', name: 'Heliopolis Club', area: 'Korba', address: '9 Baghdad St, Korba, Heliopolis', phone: '+20 100 111 3301', manager: 'Omar Youssef' },
  ],
  'gym-3': [
    { code: 'RV-6O-1', name: '6th October Club', area: 'Central District', address: '5 El-Hosary St, 6th October', phone: '+20 100 111 4401', manager: 'Tarek Nabil' },
  ],
  'gym-4': [
    { code: 'IH-AL-1', name: 'Smouha', area: 'Smouha', address: '18 Victor Emanuel St, Smouha', phone: '+20 102 333 4401', manager: 'Hany Darwish' },
    { code: 'IH-AL-2', name: 'Sidi Gaber', area: 'Sidi Gaber', address: '3 El-Geish Rd, Sidi Gaber', phone: '+20 102 333 4402', manager: 'Mona Said' },
    { code: 'IH-AL-3', name: 'San Stefano', area: 'San Stefano', address: '11 El-Fardous St, San Stefano', phone: '+20 102 333 4403', manager: 'Karim Hassan' },
    { code: 'IH-AL-4', name: 'Gleem', area: 'Gleem', address: '27 El-Nasr St, Gleem', phone: '+20 102 333 4404', manager: 'Nour Ibrahim' },
  ],
  'gym-5': [
    { code: 'PP-GZ-1', name: 'Sheikh Zayed Club', area: 'Beverly Hills', address: '7 Beverly Hills Gate 2, Sheikh Zayed', phone: '+20 103 444 5501', manager: 'Nour Shehata' },
  ],
  'gym-6': [
    { code: 'FF-MA-1', name: 'Mansoura Club', area: 'El-Mashaya', address: '12 El-Mashaya St, Mansoura', phone: '+20 104 555 6601', manager: 'Ashraf Selim' },
  ],
};

GYMS.forEach((gym) => {
  gym.branchList = GYM_BRANCHES[gym.id] || [];
  gym.branches = gym.branchList.length;
});

// ==================== USER GENERATION ====================
// Seeded so the prototype renders identical data on every load.
const FIRST_NAMES = ['Ahmed', 'Mohamed', 'Sara', 'Omar', 'Nour', 'Yasmin', 'Tarek', 'Mona', 'Hassan', 'Fatma', 'Karim', 'Laila', 'Youssef', 'Hana', 'Khalid', 'Dina', 'Rania', 'Mostafa', 'Aya', 'Sherif', 'Nada', 'Islam', 'Heba', 'Amr', 'Mariam', 'Salma', 'Ziad', 'Rana', 'Ashraf', 'Mai', 'Bassem', 'Reem'];
const LAST_NAMES = ['Mohamed', 'Hassan', 'Ali', 'Youssef', 'Ibrahim', 'Adel', 'Nabil', 'Said', 'Mahmoud', 'Zaki', 'Mostafa', 'Kamal', 'El-Sayed', 'Fahmy', 'Mansour', 'Fouad', 'Samir', 'Tawfik', 'Rashad', 'Gaber', 'Helal', 'Nassar', 'Shaheen', 'Farid'];

// One hand-written HR Manager per gym — the accounts the Super Admin provisions.
const HR_MANAGER_SEED = {
  'gym-1': { name: 'Mona El-Sayed', email: 'mona.elsayed@revivegym.com', phone: '+20 103 456 7890', status: 'Active', preset: 'HR Manager — Full', lastLogin: '2026-11-17T08:12:00', createdAt: '2024-01-15' },
  'gym-2': { name: 'Rania Adel', email: 'rania.adel@revivegym.com', phone: '+20 109 876 5432', status: 'Active', preset: 'HR Manager — Full', lastLogin: '2026-11-17T09:40:00', createdAt: '2024-08-02' },
  'gym-3': { name: 'Khalid Mansour', email: 'khalid.mansour@revivefitness.com', phone: '+20 111 222 3333', status: 'Active', preset: 'HR Manager — Standard', lastLogin: '2026-11-16T17:22:00', createdAt: '2025-02-11' },
  'gym-4': { name: 'Hoda Kamel', email: 'hoda.kamel@ironhouse.com', phone: '+20 112 777 8899', status: 'Active', preset: 'HR Manager — Full', lastLogin: '2026-11-17T07:55:00', createdAt: '2023-11-04' },
  'gym-5': { name: 'Sherif Nabil', email: 'sherif.nabil@peakperformance.com', phone: '+20 115 111 2244', status: 'Active', preset: 'HR Manager — Trial', lastLogin: '2026-11-17T10:02:00', createdAt: '2026-10-28' },
  'gym-6': { name: 'Dina Fahmy', email: 'dina.fahmy@flexfactory.com', phone: '+20 116 999 0011', status: 'Suspended', preset: 'HR Manager — Standard', lastLogin: '2026-10-30T14:00:00', createdAt: '2025-06-19' },
};

const ROLE_SPECS = [
  { key: 'hrManager', role: 'HR Manager', avatar: 'avatar-purple' },
  { key: 'hr', role: 'HR', avatar: 'avatar-blue' },
  { key: 'branchManager', role: 'Branch Manager', avatar: 'avatar-amber' },
  { key: 'teamLeader', role: 'Team Leader', avatar: 'avatar-brand' },
  { key: 'employee', role: 'Employee', avatar: '' },
];

function buildUsers() {
  const users = [];
  const usedEmails = new Set();
  let seq = 100;

  GYMS.forEach((gym, gymIndex) => {
    let seed = gymIndex * 137 + 11;

    ROLE_SPECS.forEach((spec) => {
      const count = gym.userCounts[spec.key] || 0;
      for (let n = 0; n < count; n++) {
        seed += 7;
        const isHRManager = spec.key === 'hrManager';
        const identity = isHRManager ? HR_MANAGER_SEED[gym.id] : null;

        const name = identity ? identity.name : `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[(seed * 3 + n) % LAST_NAMES.length]}`;
        const local = name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.');
        let email = identity ? identity.email : `${local}@${gym.domain}`;
        let suffix = 1;
        while (usedEmails.has(email)) { email = `${local}${++suffix}@${gym.domain}`; }
        usedEmails.add(email);

        let status = 'Active';
        if (isHRManager) status = identity.status;
        else if (seed % 29 === 0) status = 'Suspended';
        else if (seed % 19 === 0) status = 'On leave';
        else if (seed % 23 === 0) status = 'Invited';

        const daysAgo = seed % 15;
        const lastLogin = status === 'Invited' ? null : new Date(Date.UTC(2026, 10, 17 - daysAgo, 7 + (seed % 10), (seed * 5) % 60)).toISOString();
        const joinedDaysAgo = 30 + ((seed * 13) % 900);
        const branch = gym.branchList.length ? gym.branchList[seed % gym.branchList.length] : null;

        users.push({
          id: `RV-${String(++seq).padStart(5, '0')}`,
          name,
          initials: name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
          email,
          phone: identity ? identity.phone : `+20 1${(seed % 9) + 1} ${String(100 + (seed % 899)).slice(0, 3)} ${String(1000 + (seed % 8999))}`,
          role: spec.role,
          avatar: spec.avatar,
          gymId: gym.id,
          gymName: `${gym.name} — ${gym.location}`,
          branch: branch ? branch.name : gym.location,
          branchCode: branch ? branch.code : gym.code,
          status,
          lastLogin,
          createdAt: isHRManager ? identity.createdAt : new Date(Date.UTC(2026, 10, 17) - joinedDaysAgo * 86400000).toISOString().slice(0, 10),
          preset: isHRManager ? identity.preset : null,
          source: isHRManager ? 'Super Admin' : 'HR Manager',
        });
      }
    });
  });

  return users;
}

const USERS = buildUsers();

// ==================== AUDIT TRAIL ====================
const AUDIT = [
  { id: 'AL-10291', ts: '2026-11-17T15:48:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-4', category: 'Access', severity: 'info', action: 'Entered gym workspace', target: 'Iron House Gym — Alexandria', ip: '156.204.11.8', detail: 'Impersonated HR Manager session, read-only browse of payroll register. Session closed after 14 minutes.' },
  { id: 'AL-10290', ts: '2026-11-17T14:22:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-1', category: 'Access', severity: 'info', action: 'Entered gym workspace', target: 'Revive Gym — Nasr City', ip: '156.204.11.8', detail: 'Impersonated HR Manager session to review November payroll lock status.' },
  { id: 'AL-10289', ts: '2026-11-17T13:58:00', actor: 'Hoda Kamel', actorRole: 'HR Manager', initials: 'HK', gymId: 'gym-4', category: 'Payroll', severity: 'info', action: 'Locked payroll run', target: 'November 2026 · 96 employees', ip: '41.33.190.7', detail: 'Net payout EGP 1,284,500. Locked after 3 approvals; no further edits permitted.' },
  { id: 'AL-10288', ts: '2026-11-17T12:40:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-6', category: 'Billing', severity: 'critical', action: 'Suspended payroll access', target: 'Flex Factory — Mansoura', ip: '156.204.11.8', detail: 'Invoice INV-2026-0418 is 12 days overdue (EGP 8,500). Payroll module blocked until payment clears.' },
  { id: 'AL-10287', ts: '2026-11-17T11:15:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: null, category: 'Security', severity: 'critical', action: 'Blocked sign-in attempt', target: 'dina.fahmy@flexfactory.com', ip: '185.220.101.44', detail: '5 failed attempts from an unrecognised device in 4 minutes. Account locked and HR Manager notified.' },
  { id: 'AL-10286', ts: '2026-11-17T10:12:00', actor: 'Sherif Nabil', actorRole: 'HR Manager', initials: 'SN', gymId: 'gym-5', category: 'User', severity: 'info', action: 'Invited employees', target: '6 employee accounts · Peak Performance', ip: '197.44.82.19', detail: 'Bulk invitation sent during trial onboarding. 4 accepted, 2 pending.' },
  { id: 'AL-10285', ts: '2026-11-17T09:40:00', actor: 'Rania Adel', actorRole: 'HR Manager', initials: 'RA', gymId: 'gym-2', category: 'User', severity: 'warning', action: 'Changed a user role', target: 'Omar Youssef · Team Leader → Branch Manager', ip: '41.32.155.22', detail: 'Role change grants attendance override for the Heliopolis branch.' },
  { id: 'AL-10284', ts: '2026-11-17T08:12:00', actor: 'Mona El-Sayed', actorRole: 'HR Manager', initials: 'ME', gymId: 'gym-1', category: 'Access', severity: 'info', action: 'Signed in', target: 'Revive Gym — Nasr City', ip: '41.33.210.5',   detail: 'Password verified at sign-in.' },
  { id: 'AL-10283', ts: '2026-11-16T18:30:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: null, category: 'Gym', severity: 'info', action: 'Created gym account', target: 'Peak Performance — Sheikh Zayed', ip: '156.204.11.8', detail: 'Provisioned on Growth trial for 30 days. HR Manager account invited and accepted.' },
  { id: 'AL-10282', ts: '2026-11-16T17:22:00', actor: 'Khalid Mansour', actorRole: 'HR Manager', initials: 'KM', gymId: 'gym-3', category: 'Data', severity: 'warning', action: 'Exported employee data', target: '39 employee records · CSV', ip: '197.55.10.88', detail: 'Full directory export including salaries. Export is retained for 90 days.' },
  { id: 'AL-10281', ts: '2026-11-16T16:05:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-4', category: 'Gym', severity: 'warning', action: 'Raised seat limit', target: 'Iron House Gym · 100 → 120 seats', ip: '156.204.11.8', detail: 'Gym is at 96 of 100 seats. Limit raised to avoid blocking onboarding next month.' },
  { id: 'AL-10280', ts: '2026-11-16T14:48:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: null, category: 'User', severity: 'info', action: 'Created HR Manager account', target: 'Hoda Kamel · Iron House Gym', ip: '156.204.11.8',   detail: 'Provisioned with the HR Manager — Full preset.' },
  { id: 'AL-10279', ts: '2026-11-16T11:20:00', actor: 'Mona El-Sayed', actorRole: 'HR Manager', initials: 'ME', gymId: 'gym-1', category: 'Data', severity: 'info', action: 'Bulk imported employees', target: '18 records · Nasr City', ip: '41.33.210.5', detail: 'Import validated with 0 errors across 18 rows.' },
  { id: 'AL-10278', ts: '2026-11-15T19:02:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-6', category: 'Billing', severity: 'warning', action: 'Sent payment reminder', target: 'Invoice INV-2026-0418 · Flex Factory', ip: '156.204.11.8', detail: 'Second reminder sent to accounts@flexfactory.com.' },
  { id: 'AL-10277', ts: '2026-11-15T09:30:00', actor: 'Dina Fahmy', actorRole: 'HR Manager', initials: 'DF', gymId: 'gym-6', category: 'Access', severity: 'warning', action: 'Failed sign-in', target: 'Flex Factory — Mansoura', ip: '185.220.101.44',   detail: 'Unknown device. Credentials rejected.' },
  { id: 'AL-10276', ts: '2026-11-14T16:44:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-5', category: 'Gym', severity: 'info', action: 'Extended trial', target: 'Peak Performance · +14 days', ip: '156.204.11.8', detail: 'Trial now ends 2026-11-27. Reason logged: onboarding delay on kiosk hardware.' },
  { id: 'AL-10275', ts: '2026-11-14T13:10:00', actor: 'Rania Adel', actorRole: 'HR Manager', initials: 'RA', gymId: 'gym-2', category: 'Recruitment', severity: 'info', action: 'Approved a hire', target: 'Yasmin Adel · Trainer', ip: '41.32.155.22', detail: 'Offer approved and employee record created in Heliopolis.' },
  { id: 'AL-10274', ts: '2026-11-13T15:35:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: null, category: 'Settings', severity: 'info', action: 'Updated security policy', target: 'Password rotation · 90 → 60 days', ip: '156.204.11.8', detail: 'Policy applies to all tenants. 74 accounts will be prompted at next sign-in.' },
  { id: 'AL-10273', ts: '2026-11-13T10:08:00', actor: 'Hoda Kamel', actorRole: 'HR Manager', initials: 'HK', gymId: 'gym-4', category: 'Attendance', severity: 'info', action: 'Corrected attendance records', target: '7 records · Alexandria', ip: '41.33.190.7', detail: 'Kiosk outage on 2026-11-12 backfilled manually with manager approval.' },
  { id: 'AL-10272', ts: '2026-11-12T18:22:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-3', category: 'Billing', severity: 'info', action: 'Recorded payment', target: 'INV-2026-0402 · EGP 8,500', ip: '156.204.11.8', detail: 'Monthly subscription settled by bank transfer.' },
  { id: 'AL-10271', ts: '2026-11-12T11:47:00', actor: 'Mona El-Sayed', actorRole: 'HR Manager', initials: 'ME', gymId: 'gym-1', category: 'Payroll', severity: 'info', action: 'Submitted payroll for approval', target: 'November 2026 · 58 employees', ip: '41.33.210.5', detail: 'Net payout EGP 642,300. Awaiting Super Admin approval.' },
  { id: 'AL-10270', ts: '2026-11-11T14:15:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-2', category: 'Access', severity: 'info', action: 'Reset user password', target: 'Tarek Nabil · Heliopolis', ip: '156.204.11.8', detail: 'Temporary password issued; forced change at next sign-in.' },
  { id: 'AL-10269', ts: '2026-11-11T09:05:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: null, category: 'Settings', severity: 'info', action: 'Enabled feature flag', target: 'Biometric kiosk · Face ID v2', ip: '156.204.11.8', detail: 'Flag enabled for Growth and Enterprise tenants only.' },
  { id: 'AL-10268', ts: '2026-11-10T17:40:00', actor: 'Sherif Nabil', actorRole: 'HR Manager', initials: 'SN', gymId: 'gym-5', category: 'Data', severity: 'warning', action: 'Imported payroll opening balances', target: '31 records · Peak Performance', ip: '197.44.82.19', detail: '3 rows skipped for missing national ID. HR Manager notified.' },
  { id: 'AL-10267', ts: '2026-11-10T12:12:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-6', category: 'Gym', severity: 'warning', action: 'Changed subscription plan', target: 'Flex Factory · Growth → Starter', ip: '156.204.11.8', detail: 'Downgrade requested by the customer to reduce monthly cost.' },
  { id: 'AL-10266', ts: '2026-11-09T15:30:00', actor: 'Khalid Mansour', actorRole: 'HR Manager', initials: 'KM', gymId: 'gym-3', category: 'Recruitment', severity: 'info', action: 'Published a vacancy', target: 'Receptionist · 6th October', ip: '197.55.10.88', detail: 'Vacancy published to the branch queue and careers page.' },
  { id: 'AL-10265', ts: '2026-11-09T10:18:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: null, category: 'User', severity: 'info', action: 'Revoked a session', target: 'Rania Adel · Heliopolis', ip: '156.204.11.8', detail: 'Session revoked at the customer\'s request after a lost device report.' },
  { id: 'AL-10264', ts: '2026-11-08T16:55:00', actor: 'Mona El-Sayed', actorRole: 'HR Manager', initials: 'ME', gymId: 'gym-1', category: 'User', severity: 'info', action: 'Deactivated a user', target: 'Laila Mostafa · 6th October', ip: '41.33.210.5', detail: 'Employee offboarded; access revoked immediately.' },
  { id: 'AL-10263', ts: '2026-11-08T09:42:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-4', category: 'Access', severity: 'info', action: 'Entered gym workspace', target: 'Iron House Gym — Alexandria', ip: '156.204.11.8', detail: 'Reviewed attendance exceptions escalated by the branch manager.' },
  { id: 'AL-10262', ts: '2026-11-07T14:20:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: null, category: 'Gym', severity: 'info', action: 'Created gym account', target: 'Flex Factory — Mansoura', ip: '156.204.11.8', detail: 'Provisioned on Starter. HR Manager account created and invite accepted.' },
  { id: 'AL-10261', ts: '2026-11-06T11:08:00', actor: 'Rania Adel', actorRole: 'HR Manager', initials: 'RA', gymId: 'gym-2', category: 'Attendance', severity: 'warning', action: 'Overrode an attendance record', target: 'Mona Said · 2026-11-05', ip: '41.32.155.22', detail: 'Marked present after biometric failure. Reason: kiosk camera fault.' },
  { id: 'AL-10260', ts: '2026-11-05T13:26:00', actor: 'Youssef Essam', actorRole: 'Super Admin', initials: 'YE', gymId: 'gym-5', category: 'Billing', severity: 'info', action: 'Issued trial invoice preview', target: 'Peak Performance · Growth', ip: '156.204.11.8', detail: 'Preview shared with the customer ahead of trial conversion.' },
];

// ==================== SUBSCRIPTION INVOICES ====================
const INVOICES = [
  { id: 'INV-2026-0421', gymId: 'gym-1', period: 'Nov 2026', amount: 18000, status: 'Paid', issued: '2026-11-01', paid: '2026-11-03' },
  { id: 'INV-2026-0420', gymId: 'gym-2', period: 'Nov 2026', amount: 18000, status: 'Paid', issued: '2026-11-01', paid: '2026-11-04' },
  { id: 'INV-2026-0419', gymId: 'gym-3', period: 'Nov 2026', amount: 8500, status: 'Paid', issued: '2026-11-01', paid: '2026-11-12' },
  { id: 'INV-2026-0418', gymId: 'gym-6', period: 'Nov 2026', amount: 8500, status: 'Overdue', issued: '2026-11-05', paid: null },
  { id: 'INV-2026-0417', gymId: 'gym-4', period: 'Nov 2026', amount: 42000, status: 'Paid', issued: '2026-11-01', paid: '2026-11-02' },
  { id: 'INV-2026-0416', gymId: 'gym-5', period: 'Nov 2026', amount: 0, status: 'Trial', issued: '2026-10-28', paid: null },
  { id: 'INV-2026-0415', gymId: 'gym-1', period: 'Oct 2026', amount: 18000, status: 'Paid', issued: '2026-10-01', paid: '2026-10-02' },
  { id: 'INV-2026-0414', gymId: 'gym-2', period: 'Oct 2026', amount: 18000, status: 'Paid', issued: '2026-10-01', paid: '2026-10-03' },
  { id: 'INV-2026-0413', gymId: 'gym-3', period: 'Oct 2026', amount: 8500, status: 'Paid', issued: '2026-10-01', paid: '2026-10-12' },
  { id: 'INV-2026-0412', gymId: 'gym-4', period: 'Oct 2026', amount: 42000, status: 'Paid', issued: '2026-10-01', paid: '2026-10-02' },
  { id: 'INV-2026-0411', gymId: 'gym-6', period: 'Oct 2026', amount: 8500, status: 'Paid', issued: '2026-10-05', paid: '2026-10-09' },
  { id: 'INV-2026-0410', gymId: 'gym-1', period: 'Sep 2026', amount: 18000, status: 'Paid', issued: '2026-09-01', paid: '2026-09-02' },
  { id: 'INV-2026-0409', gymId: 'gym-2', period: 'Sep 2026', amount: 18000, status: 'Paid', issued: '2026-09-01', paid: '2026-09-05' },
  { id: 'INV-2026-0408', gymId: 'gym-3', period: 'Sep 2026', amount: 8500, status: 'Paid', issued: '2026-09-01', paid: '2026-09-11' },
  { id: 'INV-2026-0407', gymId: 'gym-4', period: 'Sep 2026', amount: 42000, status: 'Paid', issued: '2026-09-01', paid: '2026-09-03' },
  { id: 'INV-2026-0406', gymId: 'gym-6', period: 'Sep 2026', amount: 8500, status: 'Paid', issued: '2026-09-05', paid: '2026-09-08' },
  { id: 'INV-2026-0405', gymId: 'gym-1', period: 'Aug 2026', amount: 18000, status: 'Paid', issued: '2026-08-01', paid: '2026-08-02' },
  { id: 'INV-2026-0404', gymId: 'gym-4', period: 'Aug 2026', amount: 42000, status: 'Paid', issued: '2026-08-01', paid: '2026-08-04' },
];

// Platform revenue trend — MRR per month as gyms signed up.
const REVENUE_HISTORY = [
  { label: 'Dec', mrr: 34500 }, { label: 'Jan', mrr: 42000 }, { label: 'Feb', mrr: 51500 },
  { label: 'Mar', mrr: 51500 }, { label: 'Apr', mrr: 60000 }, { label: 'May', mrr: 69500 },
  { label: 'Jun', mrr: 77000 }, { label: 'Jul', mrr: 77000 }, { label: 'Aug', mrr: 86500 },
  { label: 'Sep', mrr: 86500 }, { label: 'Oct', mrr: 95000 }, { label: 'Nov', mrr: 95000 },
];

const PLATFORM_BILLING = {
  legalName: 'ReviveHR Technologies Ltd.',
  billingContact: 'Youssef Essam',
  billingEmail: 'billing@revivehr.com',
  taxRegistration: 'EG-492-819-204',
  card: { brand: 'VISA', last4: '4242', expiry: '12/2027' },
  currency: 'EGP',
};

// ==================== USER GROWTH (12 MONTHS) ====================
const USER_GROWTH = [
  { label: 'Dec', users: 168 }, { label: 'Jan', users: 182 }, { label: 'Feb', users: 197 },
  { label: 'Mar', users: 214 }, { label: 'Apr', users: 226 }, { label: 'May', users: 238 },
  { label: 'Jun', users: 249 }, { label: 'Jul', users: 262 }, { label: 'Aug', users: 271 },
  { label: 'Sep', users: 279 }, { label: 'Oct', users: 286 }, { label: 'Nov', users: 293 },
];

// ==================== ACCESS MATRIX ====================
// full = unrestricted · limited = scoped (own team / own profile) · false = no access
const ACCESS_COLUMNS = [
  { key: 'sa', label: 'Super Admin', short: 'SA' },
  { key: 'hrm', label: 'HR Manager', short: 'HRM' },
  { key: 'hr', label: 'HR', short: 'HR' },
  { key: 'bm', label: 'Branch Manager', short: 'BM' },
  { key: 'tl', label: 'Team Leader', short: 'TL' },
  { key: 'emp', label: 'Employee', short: 'EMP' },
];

const ACCESS_MATRIX = [
  {
    group: 'Employee records',
    rows: [
      { key: 'employees.view', label: 'View employee directory', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: 'full', emp: 'limited', note: 'Employees only see their own profile.' },
      { key: 'employees.create', label: 'Create employee records', sa: 'full', hrm: 'full', hr: 'full', bm: false, tl: false, emp: false },
      { key: 'employees.edit', label: 'Edit employee records', sa: 'full', hrm: 'full', hr: 'full', bm: 'limited', tl: false, emp: false, note: 'Branch managers are limited to their own branch.' },
      { key: 'employees.transfer', label: 'Transfer between branches', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
      { key: 'employees.compensation', label: 'Change compensation', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
      { key: 'employees.offboard', label: 'Offboard / terminate', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
      { key: 'employees.documents', label: 'Manage documents', sa: 'full', hrm: 'full', hr: 'full', bm: false, tl: false, emp: 'limited', note: 'Employees upload their own documents.' },
      { key: 'employees.bulk_import', label: 'Bulk import records', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
    ],
  },
  {
    group: 'Attendance & scheduling',
    rows: [
      { key: 'attendance.view', label: 'View attendance', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: 'limited', emp: 'limited' },
      { key: 'attendance.edit', label: 'Edit attendance', sa: 'full', hrm: 'full', hr: 'full', bm: 'limited', tl: false, emp: false },
      { key: 'attendance.manual_entry', label: 'Manual attendance entry', sa: 'full', hrm: 'full', hr: 'full', bm: false, tl: false, emp: false },
      { key: 'biometric.devices', label: 'Pair & manage kiosks', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
      { key: 'schedule.view', label: 'View schedules', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: 'full', emp: 'limited' },
      { key: 'schedule.manage', label: 'Build & publish schedules', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: 'limited', emp: false },
    ],
  },
  {
    group: 'Requests & approvals',
    rows: [
      { key: 'requests.view', label: 'View requests', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: 'full', emp: 'limited' },
      { key: 'requests.approve', label: 'Approve requests', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: 'limited', emp: false },
      { key: 'requests.salary_certificate', label: 'Issue salary certificates', sa: 'full', hrm: 'full', hr: 'full', bm: false, tl: false, emp: false },
    ],
  },
  {
    group: 'Recruitment & hiring',
    rows: [
      { key: 'recruitment.view', label: 'View pipeline', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: false, emp: false },
      { key: 'recruitment.vacancies', label: 'Manage vacancies', sa: 'full', hrm: 'full', hr: 'limited', bm: 'limited', tl: false, emp: false },
      { key: 'recruitment.candidates', label: 'Manage candidates', sa: 'full', hrm: 'full', hr: 'full', bm: 'limited', tl: false, emp: false },
      { key: 'recruitment.hire_approve', label: 'Approve hires', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
    ],
  },
  {
    group: 'Payroll',
    rows: [
      { key: 'payroll.view', label: 'View payroll', sa: 'full', hrm: 'full', hr: 'full', bm: false, tl: false, emp: 'limited', note: 'Employees only see their own payslip.' },
      { key: 'payroll.edit', label: 'Edit payroll lines', sa: 'full', hrm: 'full', hr: 'full', bm: false, tl: false, emp: false },
      { key: 'payroll.approve', label: 'Approve payroll', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
      { key: 'payroll.lock', label: 'Lock & publish payroll', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
    ],
  },
  {
    group: 'Performance & evaluations',
    rows: [
      { key: 'evaluations.view', label: 'View evaluations', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: 'full', emp: 'limited' },
      { key: 'evaluations.manage', label: 'Run evaluations', sa: 'full', hrm: 'full', hr: 'full', bm: 'full', tl: 'limited', emp: false },
      { key: 'evaluations.forms', label: 'Build evaluation forms', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
      { key: 'evaluations.cycles', label: 'Launch performance cycles', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
    ],
  },
  {
    group: 'Reports & gym audit',
    rows: [
      { key: 'reports.view', label: 'View gym reports', sa: 'full', hrm: 'full', hr: false, bm: 'limited', tl: false, emp: false },
      { key: 'audit.view', label: 'View gym audit trail', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
      { key: 'audit.export', label: 'Export gym audit data', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
    ],
  },
  {
    group: 'HR team administration',
    rows: [
      { key: 'team.view', label: 'View HR team', sa: 'full', hrm: 'full', hr: 'full', bm: false, tl: false, emp: false },
      { key: 'team.manage', label: 'Manage HR team members', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
      { key: 'roles.assign', label: 'Assign permission presets', sa: 'full', hrm: 'full', hr: false, bm: false, tl: false, emp: false },
    ],
  },
  {
    group: 'Platform administration — Super Admin only',
    platformOnly: true,
    rows: [
      { key: 'platform.gym.create', label: 'Create gym accounts', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.gym.suspend', label: 'Suspend or restore a gym', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.gym.delete', label: 'Close a gym account', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.subscription', label: 'Manage plans & seats', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.billing', label: 'View billing & invoices', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.hr_manager.create', label: 'Create HR Manager accounts', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.impersonate', label: 'Enter any gym workspace', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.audit', label: 'Platform-wide audit trail', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.security', label: 'Security & access policies', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
      { key: 'platform.feature_flags', label: 'Feature flags per plan', sa: 'full', hrm: false, hr: false, bm: false, tl: false, emp: false },
    ],
  },
];

// ==================== PLATFORM-ONLY CAPABILITIES ====================
const PLATFORM_CAPABILITIES = [
  { title: 'Provision gym accounts', desc: 'Create a tenant, assign a plan and seat limit, and hand over the workspace in one flow.', icon: 'building', audit: 'Logged as a Gym event' },
  { title: 'Own every subscription', desc: 'Upgrade, downgrade, extend trials, raise seat limits and stop a tenant when payment fails.', icon: 'card', audit: 'Logged as a Billing event' },
  { title: 'Create HR Manager accounts', desc: 'The only role that can mint an HR Manager. Every account is bound to one gym and one preset.', icon: 'shield', audit: 'Logged as a User event' },
  { title: 'Enter any gym workspace', desc: 'Inherit every HR Manager capability inside a gym, with the session recorded on the audit trail.', icon: 'login', audit: 'Logged as an Access event' },
  { title: 'Audit the whole platform', desc: 'One trail across every tenant: who did what, in which gym, from which IP address.', icon: 'clipboard', audit: 'Read-only, always available' },
  { title: 'Suspend or restore a tenant', desc: 'Block sign-in and payroll for a gym without deleting a single record.', icon: 'pause', audit: 'Logged as a Gym event' },
  { title: 'Set security policy', desc: 'Password rotation and session lifetime applied platform-wide.', icon: 'lock', audit: 'Logged as a Settings event' },
  { title: 'Control feature flags', desc: 'Roll a module out to Enterprise first, or hold it back from a plan while it stabilises.', icon: 'toggle', audit: 'Logged as a Settings event' },
];

// ==================== ROLES ====================
// The permission matrix doubles as the catalog of assignable permissions.
const PERMISSION_CATALOG = ACCESS_MATRIX.reduce((all, group) => all.concat(group.rows.map((row) => ({
  group: group.group.replace(' — Super Admin only', ''),
  key: row.key,
  label: row.label,
  platformOnly: !!group.platformOnly,
}))), []);

function permissionKeysFor(roleKey) {
  return ACCESS_MATRIX.reduce((all, group) => all.concat(
    group.rows.filter((r) => r[roleKey] === 'full' || r[roleKey] === 'limited').map((r) => r.key)
  ), []);
}

const ROLES = [
  { id: 'role-sa', name: 'Super Admin', type: 'System', scope: 'Platform', description: 'Platform owner — every gym permission plus platform administration.', permissions: PERMISSION_CATALOG.map((p) => p.key) },
  { id: 'role-hrm', name: 'HR Manager', type: 'System', scope: 'One gym', description: 'Owns a single gym: approvals, payroll lock and audit review.', permissions: permissionKeysFor('hrm') },
  { id: 'role-hr', name: 'HR', type: 'System', scope: 'One gym', description: 'Operational HR. Escalates lifecycle actions to the HR Manager.', permissions: permissionKeysFor('hr') },
  { id: 'role-bm', name: 'Branch Manager', type: 'System', scope: 'One branch', description: 'Runs a branch: attendance, schedules and team evaluations.', permissions: permissionKeysFor('bm') },
  { id: 'role-tl', name: 'Team Leader', type: 'System', scope: 'One team', description: 'Team-scoped evaluator and schedule viewer.', permissions: permissionKeysFor('tl') },
  { id: 'role-emp', name: 'Employee', type: 'System', scope: 'Own profile', description: 'Self-service: own profile, payslips, requests and evaluations.', permissions: permissionKeysFor('emp') },
  { id: 'role-auditor', name: 'Payroll Auditor', type: 'Custom', scope: 'One gym', description: 'Read-only payroll and audit access for finance reviews.', permissions: ['employees.view', 'payroll.view', 'audit.view', 'audit.export', 'reports.view'] },
  { id: 'role-recruiter', name: 'Recruiter', type: 'Custom', scope: 'One gym', description: 'Runs the hiring pipeline without payroll or evaluation access.', permissions: ['employees.view', 'recruitment.view', 'recruitment.vacancies', 'recruitment.candidates', 'schedule.view', 'requests.view'] },
];

// ==================== ATTENTION QUEUE ====================
const ALERTS = [
  { id: 'a1', severity: 'critical', title: 'Flex Factory invoice overdue', detail: 'EGP 8,500 due 12 days ago · payroll blocked', page: 'gym-detail', gymId: 'gym-6', action: 'Review gym' },
  { id: 'a2', severity: 'critical', title: 'Blocked sign-in attempts', detail: 'dina.fahmy@flexfactory.com · 5 failures from 185.220.101.44', page: 'audit', gymId: null, action: 'Open audit log' },
  { id: 'a3', severity: 'warning', title: 'Peak Performance trial ends in 10 days', detail: 'Growth trial · 31 of 100 seats used', page: 'gym-detail', gymId: 'gym-5', action: 'Review gym' },
  { id: 'a4', severity: 'warning', title: 'Revive Fitness at 78% of its seat quota', detail: '39 of 50 Starter seats used · 11 left', page: 'gym-detail', gymId: 'gym-3', action: 'Review seats' },
  { id: 'a5', severity: 'warning', title: 'Revive Fitness payroll awaiting approval', detail: 'November run · 39 employees · submitted 5 days ago', page: 'gym-detail', gymId: 'gym-3', action: 'Review payroll' },
];
