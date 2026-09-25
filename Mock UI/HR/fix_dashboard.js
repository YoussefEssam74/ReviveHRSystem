const fs = require('fs');
const file = 'js/pages-dashboard.js';
let content = fs.readFileSync(file, 'utf8');

// Find the start of the return statement (line 677)
// We'll find the function end marker after line 677
const FUNC_END = '\n}';

// Find "  return `" inside renderDashboard by finding it after line 676 comment marker
const RETURN_MARKER = '  return `\n  <div class="space-y-4 font-sans text-charcoal-800 pb-16">';

const startIdx = content.indexOf(RETURN_MARKER);
if (startIdx === -1) {
  console.error('ERROR: Could not find return marker. Dumping area around line 677...');
  // Find approximate position - count lines
  const lines = content.split('\n');
  console.log('Lines 675-680:');
  for (let i = 674; i < 681 && i < lines.length; i++) {
    console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
  }
  process.exit(1);
}

// Find the closing of the function - "  `;\n}" after the return template
// The template ends with "  `;\n}" 
const END_MARKER = "\n  `;\n}";
const endIdx = content.indexOf(END_MARKER, startIdx);
if (endIdx === -1) {
  console.error('ERROR: Could not find end marker');
  process.exit(1);
}

console.log(`Found return at index ${startIdx}, end at ${endIdx}`);
console.log(`Replacing ${endIdx - startIdx + END_MARKER.length} chars`);

const NEW_RETURN = `  return \`
  <div class="h-full flex flex-col gap-2.5 overflow-hidden font-sans text-charcoal-800">

    <!-- TOP ROW: Compact Header -->
    <div class="flex items-center justify-between flex-shrink-0 pt-0.5">
      <div class="flex items-center gap-2.5">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base font-bold text-charcoal-900 tracking-tight">Good morning, \${u.firstName}</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">HR Manager</span>
          </div>
          <p class="text-[11px] text-charcoal-400 mt-0.5">Multi-Branch Operational View · \${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="exportMonthlyHRReport()" class="btn btn-sm btn-secondary text-xs h-7 px-2.5 flex items-center gap-1.5">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export
        </button>
        \${renderGymSelector()}
      </div>
    </div>

    <!-- KPI STRIP: 4 compact tiles, fixed height -->
    <div class="grid grid-cols-4 gap-2 flex-shrink-0">

      <div onclick="openGymsOverviewModal()" class="bg-white rounded-lg border border-charcoal-200 px-3 py-2.5 hover:border-brand-400 hover:shadow-xs transition-all cursor-pointer group flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
        </div>
        <div class="min-w-0">
          <p class="text-xl font-extrabold text-charcoal-900 leading-none">\${totalGyms}</p>
          <p class="text-[10px] text-charcoal-500 font-semibold uppercase tracking-wide mt-0.5">Gym Branches</p>
        </div>
      </div>

      <div onclick="navigateTo('employees')" class="bg-white rounded-lg border border-charcoal-200 px-3 py-2.5 hover:border-brand-400 hover:shadow-xs transition-all cursor-pointer group flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        </div>
        <div class="min-w-0">
          <p class="text-xl font-extrabold text-charcoal-900 leading-none">\${totalStaff}</p>
          <p class="text-[10px] text-charcoal-500 font-semibold uppercase tracking-wide mt-0.5">Total Staff</p>
        </div>
      </div>

      <div onclick="navigateTo('requests')" class="bg-white rounded-lg border border-charcoal-200 px-3 py-2.5 hover:border-brand-400 hover:shadow-xs transition-all cursor-pointer group flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <div class="min-w-0">
          <p class="text-xl font-extrabold text-charcoal-900 leading-none">\${totalPendingRequests}</p>
          <p class="text-[10px] text-charcoal-500 font-semibold uppercase tracking-wide mt-0.5">Pending Requests</p>
        </div>
      </div>

      <div onclick="_dashSectionFilter='all';renderAll()" class="bg-amber-50 rounded-lg border border-amber-200 px-3 py-2.5 hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer group flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        </div>
        <div class="min-w-0">
          <p class="text-xl font-extrabold text-amber-700 leading-none">\${actionItems.length}</p>
          <p class="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mt-0.5">Actions Needed</p>
        </div>
      </div>

    </div>

    <!-- MAIN WORKSPACE: flex-1 fills remaining height, no outer scroll -->
    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-hidden">

      <!-- LEFT (7 cols): ACTIONS PANEL with inner scroll only -->
      <div class="lg:col-span-7 bg-white rounded-xl border border-charcoal-200 shadow-2xs overflow-hidden flex flex-col min-h-0">

        <!-- Panel header -->
        <div class="px-3 py-2 border-b border-charcoal-150 flex items-center justify-between bg-charcoal-50/60 flex-shrink-0">
          <div>
            <h2 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">Actions You Need To Take</h2>
            <p class="text-[10px] text-charcoal-400">Decide, approve, or sign off on these items</p>
          </div>
          <div class="flex items-center bg-charcoal-200/70 p-0.5 rounded-lg text-[10px]">
            <button onclick="_dashSectionFilter='all';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all \${_dashSectionFilter==='all'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">All (\${actionItems.length})</button>
            <button onclick="_dashSectionFilter='requests';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all \${_dashSectionFilter==='requests'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">Requests (\${pendingReqs.length})</button>
            <button onclick="_dashSectionFilter='vacancies';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all \${_dashSectionFilter==='vacancies'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">Vacancies (\${pendingVacancies.length})</button>
          </div>
        </div>

        <!-- Scrollable action items - only this part scrolls -->
        <div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
          \${filteredActions.length === 0 ? \`
            <div class="py-10 text-center text-xs text-charcoal-400">
              <svg class="w-8 h-8 mx-auto mb-2 text-charcoal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              All clear — no urgent actions right now.
            </div>
          \` : filteredActions.map(a => \`
            <div class="bg-charcoal-50/60 hover:bg-white p-2.5 rounded-lg border border-charcoal-150 hover:border-charcoal-300 transition-all flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="badge \${a.badgeClass} text-[9px] font-semibold">\${a.badge}</span>
                  <h3 class="text-xs font-bold text-charcoal-900 truncate">\${a.title}</h3>
                </div>
                <p class="text-[11px] text-charcoal-600">\${a.subtitle}</p>
                <p class="text-[10px] text-charcoal-400 truncate">\${a.detail}</p>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button onclick="\${a.onApprove}" class="btn btn-sm btn-success text-[11px] h-7 px-2.5">Approve</button>
                <button onclick="\${a.onReject}" class="btn btn-sm btn-secondary text-[11px] h-7 px-2 text-charcoal-500 hover:text-red-600">Decline</button>
                <button onclick="\${a.onReview}" class="btn btn-sm btn-secondary text-[11px] h-7 px-2">Review</button>
              </div>
            </div>
          \`).join('')}
        </div>

        <!-- Panel footer -->
        <div class="px-3 py-1.5 bg-charcoal-50/60 border-t border-charcoal-150 flex items-center justify-between text-[10px] text-charcoal-400 flex-shrink-0">
          <span>Approve executes sign-off immediately</span>
          <button onclick="navigateTo('requests')" class="text-brand-600 hover:text-brand-800 font-semibold">Full Requests Queue →</button>
        </div>
      </div>

      <!-- RIGHT (5 cols): Fast Actions + Branches Oversight -->
      <div class="lg:col-span-5 flex flex-col gap-2.5 min-h-0 overflow-hidden">

        <!-- FAST ACTIONS (fixed height, no scroll needed) -->
        <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs flex-shrink-0">
          <div class="flex items-center justify-between mb-2.5">
            <h2 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">Fast Actions</h2>
            <span class="badge badge-brand text-[9px]">HR Tools</span>
          </div>
          <div class="grid grid-cols-3 gap-2">

            <button onclick="openCreateAccountModal()" class="p-2.5 rounded-lg border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center group flex flex-col items-center gap-1.5">
              <div class="w-7 h-7 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-600 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              </div>
              <p class="text-[10px] font-semibold text-charcoal-800 group-hover:text-brand-800 leading-tight">Create Account</p>
            </button>

            <button onclick="openChangePasswordAccessModal()" class="p-2.5 rounded-lg border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center group flex flex-col items-center gap-1.5">
              <div class="w-7 h-7 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-600 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
              </div>
              <p class="text-[10px] font-semibold text-charcoal-800 group-hover:text-brand-800 leading-tight">Change Password</p>
            </button>

            <button onclick="openCreateHiringFormModal()" class="p-2.5 rounded-lg border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center group flex flex-col items-center gap-1.5">
              <div class="w-7 h-7 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-600 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <p class="text-[10px] font-semibold text-charcoal-800 group-hover:text-brand-800 leading-tight">Hiring Form</p>
            </button>

            <button onclick="openCreateEvaluationFormModal()" class="p-2.5 rounded-lg border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center group flex flex-col items-center gap-1.5">
              <div class="w-7 h-7 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-600 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
              </div>
              <p class="text-[10px] font-semibold text-charcoal-800 group-hover:text-brand-800 leading-tight">Evaluation Form</p>
            </button>

            <button onclick="navigateTo('requests')" class="p-2.5 rounded-lg border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center group flex flex-col items-center gap-1.5 relative">
              <div class="w-7 h-7 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-600 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors relative">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                \${totalPendingRequests > 0 ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">' + totalPendingRequests + '</span>' : ''}
              </div>
              <p class="text-[10px] font-semibold text-charcoal-800 group-hover:text-brand-800 leading-tight">See Requests</p>
            </button>

            <button onclick="typeof openAddEmployee === 'function' ? openAddEmployee() : navigateTo('employees')" class="p-2.5 rounded-lg border border-brand-300 bg-brand-50/60 hover:bg-brand-100 transition-all text-center group flex flex-col items-center gap-1.5">
              <div class="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              </div>
              <p class="text-[10px] font-bold text-brand-800 leading-tight">Add Employee</p>
            </button>

          </div>
        </div>

        <!-- BRANCHES OVERVIEW: flex-1 fills leftover height, inner scroll if overflow -->
        <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs flex flex-col flex-1 min-h-0 overflow-hidden">
          <div class="flex items-center justify-between mb-2 flex-shrink-0">
            <div>
              <h3 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">Branches Overview</h3>
              <p class="text-[10px] text-charcoal-400">Headcount per branch · click to filter</p>
            </div>
            <button onclick="openGymsOverviewModal()" class="text-[11px] text-brand-600 hover:text-brand-800 font-semibold">Details →</button>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto space-y-1.5">
            \${MOCK.gymList.map(g => \`
              <div onclick="setGymFilter('\${g.id}')" class="px-2.5 py-2 rounded-lg bg-charcoal-50 hover:bg-charcoal-100 transition-colors flex items-center justify-between cursor-pointer border border-charcoal-100 hover:border-charcoal-200">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                  <div>
                    <p class="text-xs font-bold text-charcoal-900">\${g.branch}</p>
                    <p class="text-[10px] text-charcoal-400">\${g.name}</p>
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <span class="text-xs font-bold text-charcoal-900">\${g.employees}</span>
                  <span class="text-[10px] text-charcoal-400 ml-0.5">staff</span>
                </div>
              </div>
            \`).join('')}
          </div>
        </div>

      </div>

    </div>

  </div>
  \`;
}`;

const newContent = content.substring(0, startIdx) + NEW_RETURN;
fs.writeFileSync(file, newContent, 'utf8');
console.log('SUCCESS: Dashboard template replaced');
console.log('New file length:', newContent.length, 'chars');
