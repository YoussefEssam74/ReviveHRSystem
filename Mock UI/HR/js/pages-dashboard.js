// ==================== HR COMMAND CENTER DASHBOARD ====================
let _dashSectionFilter = 'all';
let _recSectionFilter = 'iv1';

function renderGymSelector() {
  const u = MOCK.currentUser;
  return `<div class="relative">
    <select onchange="setGymFilter(this.value)" class="form-select w-auto bg-white border border-charcoal-200 rounded-lg text-xs py-1.5 px-3 font-medium text-charcoal-800 shadow-2xs hover:border-charcoal-300 transition-colors">
      <option value="all">All Branches (${u.gyms.length})</option>
      ${u.gyms.map(g => `<option value="${g.id}" ${u.selectedGym===g.id?'selected':''}>${g.name} — ${g.branch}</option>`).join('')}
    </select>
  </div>`;
}

function setGymFilter(id) {
  const u = MOCK.currentUser;
  u.selectedGym = id;
  renderAll();
  showToast(id==='all' ? 'Showing all branches' : 'Branch filter applied', 'info');
}

// ==================== CANDIDATE INTERVIEW & STAGE DOSSIER MODAL ====================
function openCandidateInterviewDossier(cid, ivId) {
  let c = MOCK.candidates.find(x => x.id === cid);
  if (!c && ivId) {
    const iv = MOCK.interviews.find(x => x.id === ivId);
    if (iv) c = MOCK.candidates.find(x => x.name === iv.candidate);
  }
  if (!c) {
    showToast('Candidate record not found', 'error');
    return;
  }

  const f = c.form || {};
  const matchingIv = ivId ? MOCK.interviews.find(x => x.id === ivId) : MOCK.interviews.find(x => x.candidate === c.name);

  // Star rating helper
  const stars = (n) => '★'.repeat(Math.max(0, Math.min(5, n || 0))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, n || 0)));

  // Pipeline progression order
  const stages = ['Applied', 'Screening', 'First Interview', 'Second Interview', 'Accepted', 'Hired'];
  const curIdx = stages.indexOf(c.stage);
  const nextStage = curIdx >= 0 && curIdx < stages.length - 1 ? stages[curIdx + 1] : null;

  const content = `
    <div class="space-y-4">
      <!-- Candidate Profile Header -->
      <div class="flex items-start justify-between bg-charcoal-50/70 p-3.5 rounded-xl border border-charcoal-150">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
            ${c.name.split(' ').map(w => w[0]).join('')}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-sm font-bold text-charcoal-900">${c.name}</h2>
              <span class="badge ${c.stage==='Accepted'||c.stage==='Hired'?'badge-green':c.stage==='Rejected'?'badge-red':'badge-blue'} text-[10px] font-medium">${c.stage}</span>
              <span class="text-xs text-amber-500 font-semibold">${stars(c.rating)} (${c.rating}/5)</span>
            </div>
            <p class="text-xs text-charcoal-600 mt-0.5">Applied for <b class="text-charcoal-900">${c.position}</b> · Preferred Branch: <b>${f.gymPref || 'Nasr City'}</b></p>
            <p class="text-[11px] text-charcoal-400 mt-0.5">Phone: ${c.phone || '—'} · Email: ${f.email || '—'}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="text-[9px] uppercase tracking-wider text-charcoal-400 font-semibold">Applied</span>
          <p class="text-xs font-semibold text-charcoal-800">${c.appliedDate || '—'}</p>
          <span class="inline-block mt-1 badge badge-gray text-[9px]">${f.source || 'Direct'}</span>
        </div>
      </div>

      <!-- 2-Column Information & Evaluation -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <!-- Column A: Background & Expectations -->
        <div class="bg-white border border-charcoal-200 rounded-xl p-3 space-y-2.5">
          <p class="text-[10px] font-bold text-charcoal-500 uppercase tracking-wider">Qualifications & Expectations</p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-charcoal-50 p-2 rounded-lg">
              <span class="text-charcoal-400 block text-[9px] uppercase">Experience</span>
              <span class="font-semibold text-charcoal-800">${f.expYears ? `${f.expYears} Years` : '—'}</span>
            </div>
            <div class="bg-charcoal-50 p-2 rounded-lg">
              <span class="text-charcoal-400 block text-[9px] uppercase">Education</span>
              <span class="font-semibold text-charcoal-800 truncate block" title="${f.education||'—'}">${f.education || '—'}</span>
            </div>
            <div class="bg-charcoal-50 p-2 rounded-lg">
              <span class="text-charcoal-400 block text-[9px] uppercase">Expected Salary</span>
              <span class="font-semibold text-brand-700">${f.salaryExp ? `EGP ${f.salaryExp.toLocaleString()}` : 'Negotiable'}</span>
            </div>
            <div class="bg-charcoal-50 p-2 rounded-lg">
              <span class="text-charcoal-400 block text-[9px] uppercase">Availability</span>
              <span class="font-semibold text-charcoal-800">${f.availability || 'Immediate'}</span>
            </div>
            <div class="bg-charcoal-50 p-2 rounded-lg col-span-2">
              <span class="text-charcoal-400 block text-[9px] uppercase">Shift Preference</span>
              <span class="font-semibold text-charcoal-800">${f.shift || 'Flexible'}</span>
            </div>
          </div>

          <div>
            <span class="text-[9px] font-bold text-charcoal-400 uppercase tracking-wider block mb-1">Skills & Competencies</span>
            <div class="flex flex-wrap gap-1">
              ${(f.skills || ['Fitness Assessment', 'Customer Service']).map(s => `<span class="badge badge-brand text-[9px]">${s}</span>`).join('')}
              ${(f.languages || ['Arabic', 'English']).map(l => `<span class="badge badge-gray text-[9px]">${l}</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- Column B: Interview Evaluation & Session Notes -->
        <div class="bg-white border border-charcoal-200 rounded-xl p-3 space-y-2.5">
          <p class="text-[10px] font-bold text-charcoal-500 uppercase tracking-wider">Evaluation History</p>

          <!-- Screening Notes -->
          <div class="bg-charcoal-50 p-2.5 rounded-lg text-xs space-y-0.5 border border-charcoal-100">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-charcoal-800">1. Phone Screening</span>
              <span class="badge ${c.screen?.verdict==='Pass'?'badge-green':'badge-yellow'} text-[8px]">${c.screen?.verdict || 'Completed'}</span>
            </div>
            <p class="text-charcoal-600 text-[11px] mt-0.5">${c.screen?.notes || 'Good communication skills and cultural fit.'}</p>
            <p class="text-charcoal-400 text-[9px]">Screened by: ${c.screen?.by || 'HR Team'} · Date: ${c.screen?.date || c.appliedDate}</p>
          </div>

          <!-- Interview 1 Notes / Practical Trial -->
          <div class="bg-charcoal-50 p-2.5 rounded-lg text-xs space-y-0.5 border border-charcoal-100">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-charcoal-800">2. Technical / 1st Interview</span>
              <span class="badge ${c.iv1?.verdict==='Pass'?'badge-green':c.iv1?.verdict==='Fail'?'badge-red':'badge-blue'} text-[8px]">${c.iv1?.verdict || matchingIv?.status || 'Scheduled'}</span>
            </div>
            <p class="text-charcoal-600 text-[11px] mt-0.5">${c.iv1?.notes || (matchingIv ? `Scheduled on ${matchingIv.date} at ${matchingIv.time} (${matchingIv.type}) with ${matchingIv.interviewer}.` : 'Pending session review.')}</p>
            <p class="text-charcoal-400 text-[9px]">Interviewer: ${c.iv1?.by || matchingIv?.interviewer || 'Youssef Kamal'}</p>
          </div>

          <!-- Interview 2 / Panel Round (if present) -->
          ${c.iv2 ? `
          <div class="bg-purple-50/50 p-2.5 rounded-lg text-xs space-y-0.5 border border-purple-100">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-purple-900">3. Final Panel Round</span>
              <span class="badge ${c.iv2.verdict==='Pass'?'badge-green':'badge-yellow'} text-[8px]">${c.iv2.verdict}</span>
            </div>
            <p class="text-purple-800 text-[11px] mt-0.5">${c.iv2.notes || 'Panel approval completed.'}</p>
            <p class="text-purple-600 text-[9px]">Conducted by: ${c.iv2.by} · ${c.iv2.date}</p>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Decision Rationale Input -->
      <div class="bg-brand-50/60 border border-brand-200/80 rounded-xl p-3 text-xs">
        <p class="font-semibold text-brand-900 mb-1">HR Decision Rationale</p>
        <p class="text-brand-800 text-[11px] leading-relaxed mb-2">As HR Manager, your decision directly advances this candidate's application or closes the recruitment loop. You can advance them to the next pipeline stage, make a direct offer, or reject with a formal reason.</p>
        <textarea id="cand-decision-note" class="form-input text-xs w-full bg-white" rows="2" placeholder="Add evaluation note or feedback (optional)..."></textarea>
      </div>

      <!-- Action Buttons Row -->
      <div class="flex items-center justify-between gap-2 pt-2 border-t border-charcoal-150 flex-wrap">
        <div class="flex items-center gap-2">
          <button onclick="closeModal();rejectCandidatePrompt('${c.id}')" class="btn btn-sm btn-danger-outline text-xs">
            <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            Reject Candidate
          </button>
          <button onclick="closeModal();openNewInterview()" class="btn btn-sm btn-secondary text-xs">
            Reschedule
          </button>
        </div>

        <div class="flex items-center gap-2 ml-auto">
          <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">Close</button>
          ${nextStage ? `
            <button onclick="advanceCandidateDirectly('${c.id}', '${nextStage}')" class="btn btn-sm btn-primary text-xs">
              <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              Pass to ${nextStage}
            </button>
          ` : ''}
          ${c.stage !== 'Hired' ? `
            <button onclick="hireCandidateDirectly('${c.id}')" class="btn btn-sm btn-success text-xs">
              <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Make Job Offer & Hire
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  openModal(`Candidate Evaluation Dossier — ${c.name}`, content, { wide: true });
}

function advanceCandidateDirectly(cid, stageName) {
  const c = MOCK.candidates.find(x => x.id === cid);
  if (!c) return;
  const noteEl = document.getElementById('cand-decision-note');
  const note = noteEl ? noteEl.value.trim() : '';

  c.stage = stageName;
  if (stageName === 'Accepted') {
    c.decision = { by: MOCK.currentUser.fullName, date: '2026-09-09', verdict: 'Accepted', note: note || 'Approved by HR Manager' };
  } else if (stageName === 'Second Interview' && !c.iv1) {
    c.iv1 = { date: '2026-09-09', by: MOCK.currentUser.fullName, type: 'Technical', verdict: 'Pass', eval: 4, notes: note || 'Passed 1st round' };
  }

  closeModal();
  renderAll();
  showToast(`${c.name} advanced to ${stageName}!`, 'success');
}

function hireCandidateDirectly(cid) {
  const c = MOCK.candidates.find(x => x.id === cid);
  if (!c) return;
  c.stage = 'Accepted';
  closeModal();
  openHireWizard(cid);
}

function rejectCandidatePrompt(cid) {
  const c = MOCK.candidates.find(x => x.id === cid);
  if (!c) return;

  openModal(`Reject Candidate — ${c.name}`, `
    <div class="space-y-3">
      <div class="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-800">
        You are rejecting <b>${c.name}</b> for the position of <b>${c.position}</b>. A standardized notification email will be prepared for the candidate.
      </div>
      <div>
        <label class="form-label">Rejection Reason</label>
        <select id="reject-reason-select" class="form-select text-xs">
          <option value="Coaching / technical trial below required standard">Coaching / technical trial below standard</option>
          <option value="Salary expectation exceeds approved department band">Salary expectation exceeds approved band</option>
          <option value="Shift availability does not match gym branch needs">Shift availability mismatch</option>
          <option value="Candidate lacks required certifications">Lacks required certifications</option>
          <option value="Other / Overqualified for Junior role">Other / Overqualified</option>
        </select>
      </div>
      <div>
        <label class="form-label">Internal HR Note (Optional)</label>
        <textarea id="reject-internal-note" class="form-input text-xs" rows="2" placeholder="Internal context for HR archive..."></textarea>
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">Cancel</button>
        <button type="button" onclick="executeCandidateRejection('${c.id}')" class="btn btn-sm btn-danger text-xs">Confirm Rejection</button>
      </div>
    </div>
  `);
}

function executeCandidateRejection(cid) {
  const c = MOCK.candidates.find(x => x.id === cid);
  if (!c) return;
  const reason = document.getElementById('reject-reason-select').value;
  const note = document.getElementById('reject-internal-note').value;

  c.stage = 'Rejected';
  c.rejectedDate = '2026-09-09';
  c.rejectedBy = MOCK.currentUser.fullName;
  c.rejectReason = reason + (note ? ` (${note})` : '');
  c.decision = { by: MOCK.currentUser.fullName, date: '2026-09-09', verdict: 'Rejected', note: c.rejectReason };

  closeModal();
  renderAll();
  showToast(`${c.name} has been rejected and archived`, 'info');
}

// ==================== WAITING LIST VACANCY ASSIGNMENT ====================
function assignWaitingToOpenVacancy(wId, vId) {
  const w = MOCK.waitingList.find(x => x.id === wId);
  const v = MOCK.vacancies.find(x => x.id === vId);
  if (!w || !v) return;

  MOCK.candidates.unshift({
    id: 'c' + Date.now(),
    name: w.name,
    position: v.position,
    stage: 'Accepted',
    appliedDate: '2026-09-09',
    phone: '+20 120 999 8888',
    rating: 5,
    form: {
      email: `${w.name.toLowerCase().replace(/\s+/g, '.')}@mail.com`,
      source: 'Waiting Pool',
      gymPref: v.gym,
      expYears: 4,
      education: 'Certified Professional',
      skills: w.skills || [],
      salaryExp: 10000,
      availability: 'Immediate'
    },
    decision: { by: MOCK.currentUser.fullName, date: '2026-09-09', verdict: 'Accepted', note: `Assigned from waiting pool to open vacancy at ${v.gym}` }
  });

  v.headcount = Math.max(0, v.headcount - 1);
  if (v.headcount === 0) v.status = 'Closed';

  MOCK.waitingList = MOCK.waitingList.filter(x => x.id !== wId);

  renderAll();
  showToast(`Assigned ${w.name} to ${v.position} at ${v.gym}!`, 'success');
}

// ==================== VACANCY REQUEST MODAL ====================
function openVacancyRequestModal(vrId) {
  const vr = MOCK.vacancyRequests.find(x => x.id === vrId);
  if (!vr) return;

  openModal(`Branch Vacancy Request — ${vr.position}`, `
    <div class="space-y-3">
      <div class="bg-charcoal-50 p-3 rounded-lg border border-charcoal-200">
        <div class="flex items-center justify-between mb-2">
          <span class="badge badge-purple text-[10px] font-semibold">${vr.gym}</span>
          <span class="badge ${vr.urgency==='High'?'badge-red':'badge-yellow'} text-[9px]">${vr.urgency} Urgency</span>
        </div>
        <p class="text-sm font-bold text-charcoal-900">${vr.position}</p>
        <p class="text-xs text-charcoal-600 mt-0.5">Requested by: <b>${vr.submittedBy}</b> (Branch Manager) · Date: ${vr.submittedDate}</p>
        <div class="bg-white p-2 rounded border border-charcoal-100 mt-2 text-xs text-charcoal-700">
          <span class="font-semibold text-charcoal-500 block text-[9px] uppercase">Manager Justification</span>
          ${vr.reason || 'Operational replacement needed due to staff departures.'}
        </div>
      </div>

      <div class="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
        Approving this request immediately opens a new vacancy in the recruitment module and notifies recruiters to begin candidate sourcing.
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-charcoal-100">
        <button onclick="rejectVacancyRequest('${vr.id}')" class="btn btn-sm btn-danger-outline text-xs">Reject Request</button>
        <div class="flex items-center gap-2">
          <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">Close</button>
          <button onclick="approveVacancyRequest('${vr.id}')" class="btn btn-sm btn-primary text-xs">Approve & Open Vacancy</button>
        </div>
      </div>
    </div>
  `, { wide: true });
}

function approveVacancyRequest(vrId) {
  const vr = MOCK.vacancyRequests.find(x => x.id === vrId);
  if (!vr) return;
  vr.status = 'Approved';
  MOCK.vacancies.unshift({
    id: 'v' + Date.now(),
    position: vr.position,
    gym: vr.gym,
    headcount: 1,
    urgency: vr.urgency,
    status: 'Open',
    createdDate: '2026-09-09',
    candidates: 0
  });
  closeModal();
  renderAll();
  showToast(`Vacancy request approved. Open recruitment post created for ${vr.position}!`, 'success');
}

function rejectVacancyRequest(vrId) {
  const vr = MOCK.vacancyRequests.find(x => x.id === vrId);
  if (!vr) return;
  vr.status = 'Rejected';
  closeModal();
  renderAll();
  showToast(`Vacancy request for ${vr.position} rejected`, 'info');
}

// ==================== COMPLIANCE & EXPIRY MODAL ====================
function openComplianceModal(evId) {
  const ev = MOCK.events.find(x => x.id === evId);
  if (!ev) return;

  openModal(`Compliance Action — ${ev.title}`, `
    <div class="space-y-3">
      <div class="bg-orange-50 border border-orange-200 p-3 rounded-lg text-xs">
        <div class="flex items-center justify-between mb-1">
          <span class="badge badge-orange font-bold text-[9px] uppercase">${ev.type}</span>
          <span class="text-orange-800 font-semibold">Deadline: ${ev.date}</span>
        </div>
        <p class="font-bold text-orange-950 text-sm">${ev.title}</p>
        <p class="text-orange-900 mt-1">${ev.detail}</p>
      </div>

      <div class="space-y-1.5 text-xs text-charcoal-700">
        <label class="form-label">HR Action to Take</label>
        <div class="space-y-1">
          <label class="flex items-center gap-2 p-2 rounded bg-charcoal-50 border border-charcoal-100 cursor-pointer hover:bg-charcoal-100/60">
            <input type="radio" name="comp-action" value="renew" checked class="text-brand-600">
            <span>Mark Certificate / Contract as Renewed (Upload Document)</span>
          </label>
          <label class="flex items-center gap-2 p-2 rounded bg-charcoal-50 border border-charcoal-100 cursor-pointer hover:bg-charcoal-100/60">
            <input type="radio" name="comp-action" value="notice" class="text-brand-600">
            <span>Send Formal Expiry Warning Notice to Employee</span>
          </label>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
        <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">Cancel</button>
        <button onclick="executeComplianceAction('${ev.id}')" class="btn btn-sm btn-primary text-xs">Apply Action</button>
      </div>
    </div>
  `);
}

function executeComplianceAction(evId) {
  const evIndex = MOCK.events.findIndex(x => x.id === evId);
  if (evIndex >= 0) {
    MOCK.events.splice(evIndex, 1);
  }
  closeModal();
  renderAll();
  showToast('Compliance action recorded. Expiry cleared from urgent queue.', 'success');
}

// ==================== PAYROLL DEDUCTION MODAL ====================
function openPayrollDeductionModal(empId, dedId) {
  const pItem = MOCK.payrollItems.find(x => x.employeeId === empId);
  if (!pItem) return;
  const line = pItem.deductionLines.find(x => x.id === dedId);
  if (!line) return;

  openModal(`Payroll Adjustment — ${pItem.name}`, `
    <div class="space-y-3">
      <div class="bg-charcoal-50 p-3 rounded-lg border border-charcoal-200">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-charcoal-500">${pItem.gym} · ${pItem.position}</span>
          <span class="badge ${line.status==='Accepted'?'badge-green':'badge-yellow'} text-[9px]">${line.status}</span>
        </div>
        <p class="text-sm font-bold text-charcoal-900">${line.label}</p>
        <p class="text-sm font-bold text-red-600 mt-0.5">- EGP ${line.amount}</p>
        <p class="text-xs text-charcoal-600 mt-1">Reason: ${line.reason}</p>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-charcoal-100">
        <button onclick="disputeDeduction('${pItem.employeeId}', '${line.id}')" class="btn btn-sm btn-danger-outline text-xs">Dispute / Remove</button>
        <div class="flex items-center gap-2">
          <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">Close</button>
          <button onclick="approveDeduction('${pItem.employeeId}', '${line.id}')" class="btn btn-sm btn-primary text-xs">Confirm Adjustment</button>
        </div>
      </div>
    </div>
  `);
}

function approveDeduction(empId, dedId) {
  const pItem = MOCK.payrollItems.find(x => x.employeeId === empId);
  if (!pItem) return;
  const line = pItem.deductionLines.find(x => x.id === dedId);
  if (!line) return;
  line.status = 'Accepted';
  closeModal();
  renderAll();
  showToast(`Adjustment of EGP ${line.amount} approved for ${pItem.name}`, 'success');
}

function disputeDeduction(empId, dedId) {
  const pItem = MOCK.payrollItems.find(x => x.employeeId === empId);
  if (!pItem) return;
  pItem.deductionLines = pItem.deductionLines.filter(x => x.id !== dedId);
  pItem.deductions = pItem.deductionLines.reduce((acc, l) => acc + l.amount, 0);
  pItem.net = pItem.gross - pItem.deductions;
  closeModal();
  renderAll();
  showToast(`Adjustment removed from ${pItem.name}'s payroll line`, 'info');
}

// ==================== CONTRACT RENEWAL & LEVEL ADJUSTMENT ====================
function openContractRenewalModal() {
  openModal('Contract Renewal & Level Adjustment', `
    <form onsubmit="event.preventDefault();applyContractRenewal();" class="space-y-3">
      <div>
        <label class="form-label">Select Employee</label>
        <select id="cr-emp-select" class="form-select text-xs">
          ${MOCK.employees.map(e => `<option value="${e.id}">${e.name} — ${e.position} (${e.gym}) [Level: ${e.level}]</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label class="form-label">Job Level</label>
          <select id="cr-new-level" class="form-select text-xs">
            <option value="Junior">Junior</option>
            <option value="Mid">Mid-Level</option>
            <option value="Senior" selected>Senior</option>
            <option value="Manager">Manager</option>
          </select>
        </div>
        <div>
          <label class="form-label">New Gross Salary (EGP)</label>
          <input id="cr-new-salary" type="number" class="form-input text-xs" value="12000" step="500">
        </div>
      </div>
      <div>
        <label class="form-label">Contract Extension Term</label>
        <select id="cr-term" class="form-select text-xs">
          <option value="12">1 Year Extension (Standard)</option>
          <option value="24">2 Years Extension</option>
          <option value="6">6 Months Probation Extension</option>
        </select>
      </div>
      <div>
        <label class="form-label">HR Adjustment Reason</label>
        <textarea id="cr-notes" class="form-input text-xs" rows="2" placeholder="e.g. Annual contract renewal with performance upgrade based on Q2 evaluation..."></textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
        <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">Cancel</button>
        <button type="submit" class="btn btn-sm btn-primary text-xs">Confirm & Update Contract</button>
      </div>
    </form>
  `, { wide: true });
}

function applyContractRenewal() {
  const empId = document.getElementById('cr-emp-select').value;
  const level = document.getElementById('cr-new-level').value;
  const salary = parseFloat(document.getElementById('cr-new-salary').value) || 0;
  const emp = MOCK.employees.find(e => e.id === empId);
  if (emp) {
    emp.level = level;
    if (salary > 0) emp.salary = salary;
  }
  closeModal();
  renderAll();
  showToast(`Contract & level updated for ${emp ? emp.name : 'employee'}!`, 'success');
}

// ==================== CSV REPORT EXPORT ====================
function exportMonthlyHRReport() {
  const rows = [
    ['Category', 'Item / Name', 'Branch', 'Status / Stage', 'Date / Deadline'],
    ...MOCK.requests.filter(r => r.status === 'Pending HR Review').map(r => ['Pending Request', `${r.employee} (${r.type})`, r.gym, r.status, r.requestedDate]),
    ...MOCK.vacancyRequests.filter(v => v.status === 'Pending').map(v => ['Vacancy Request', v.position, v.gym, v.status, v.submittedDate]),
    ...MOCK.interviews.map(iv => ['Interview', `${iv.candidate} (${iv.position})`, iv.gym, iv.status, `${iv.date} ${iv.time}`]),
    ...MOCK.candidates.filter(c => ['Accepted', 'First Interview', 'Second Interview'].includes(c.stage)).map(c => ['Candidate', c.name, c.form?.gymPref || 'All', c.stage, c.appliedDate]),
  ];
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${(cell||'').replace(/"/g, '""')}"`).join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ReviveHR_Monthly_Report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Monthly HR Summary report exported as CSV!', 'success');
}

// ==================== REDESIGNED DASHBOARD RENDERER ====================
function renderDashboard() {
  const u = MOCK.currentUser;

  // Selected gym filter context
  const selectedGymObj = u.selectedGym !== 'all' ? u.gyms.find(g => g.id === u.selectedGym) : null;
  const gymBranch = selectedGymObj ? selectedGymObj.branch : null;

  // Datasets filtered by selected branch
  const pendingReqs = MOCK.requests.filter(r => r.status === 'Pending HR Review' && (!gymBranch || r.gym === gymBranch));
  const openVacancies = MOCK.vacancies.filter(v => v.status === 'Open' && (!gymBranch || v.gym === gymBranch));
  const pendingVacancies = MOCK.vacancyRequests.filter(r => r.status === 'Pending' && (!gymBranch || r.gym === gymBranch));
  const expiringEvents = MOCK.events.filter(e => (e.type === 'Document Expiry' || e.type === 'Contract Expiry'));

  // Approvals categorized
  const dayOffReqs = pendingReqs.filter(r => r.type === 'Day Off');
  const leaveEarlyReqs = pendingReqs.filter(r => r.type === 'Leave Early' || r.type === 'Late Arrival');
  const resignationReqs = pendingReqs.filter(r => r.type === 'Resignation');

  // Pending payroll adjustments
  const pendingDeductions = [];
  MOCK.payrollItems.forEach(p => {
    (p.deductionLines || []).forEach(d => {
      if (d.status === 'Pending' && (!gymBranch || p.gym === gymBranch)) {
        pendingDeductions.push({ ...d, employeeName: p.name, employeeId: p.employeeId, gym: p.gym });
      }
    });
  });

  // Recruitment categorized
  const allScheduledIvs = MOCK.interviews.filter(iv => !gymBranch || iv.gym === gymBranch);
  const iv1List = allScheduledIvs.filter(iv => {
    const cand = MOCK.candidates.find(c => c.name === iv.candidate);
    return !cand || cand.stage === 'First Interview' || cand.stage === 'Screening' || cand.stage === 'Applied';
  });
  const iv2List = allScheduledIvs.filter(iv => {
    const cand = MOCK.candidates.find(c => c.name === iv.candidate);
    return cand && cand.stage === 'Second Interview';
  });
  const acceptedList = MOCK.candidates.filter(c => c.stage === 'Accepted' && (!gymBranch || c.form?.gymPref === gymBranch));

  // Items for Left Column based on selected tab
  const leftTabCounts = {
    all: pendingReqs.length + pendingVacancies.length + expiringEvents.length + pendingDeductions.length,
    dayoff: dayOffReqs.length,
    leave: leaveEarlyReqs.length,
    resignation: resignationReqs.length,
    vacancy: pendingVacancies.length,
    compliance: expiringEvents.length,
    payroll: pendingDeductions.length
  };

  // 5 Calm, Executive Metric Cards (Balanced, neutral borders, no rainbow fatigue)
  const topMetrics = [
    { label: 'Pending Approvals', val: pendingReqs.length + pendingVacancies.length, sub: `${pendingReqs.length} reqs · ${pendingVacancies.length} vacancies`, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', click: `_dashSectionFilter='all';renderAll()` },
    { label: 'Interviews Scheduled', val: allScheduledIvs.length, sub: `${iv1List.length} 1st · ${iv2List.length} 2nd round`, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', click: `_recSectionFilter='iv1';renderAll()` },
    { label: 'Open Vacancies', val: openVacancies.length, sub: `${pendingVacancies.length} approval requests`, icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', click: `navigateTo('recruitment')` },
    { label: 'Upcoming Expiries', val: expiringEvents.length, sub: 'due in ≤30 days', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z', click: `_dashSectionFilter='compliance';renderAll()` },
    { label: 'August Payroll', val: 'EGP 1.27M', sub: 'Cutoff Sep 25 · 1 draft', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', click: `navigateTo('payroll')` },
  ];

  return `<div class="flex flex-col h-full min-h-0 gap-2.5 font-sans">

    <!-- Row 0: Clean Executive Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-base font-bold text-charcoal-900 tracking-tight">Good morning, ${u.firstName}</h1>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-charcoal-100 text-charcoal-700">
            HR Command Center
          </span>
        </div>
        <p class="text-xs text-charcoal-400 mt-0.5">Wednesday, Sep 9, 2026 · Overview across all assigned operations</p>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="exportMonthlyHRReport()" class="btn btn-sm btn-secondary text-xs h-8 px-2.5 flex items-center gap-1.5 shadow-2xs">
          <svg class="w-3.5 h-3.5 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export Summary
        </button>
        ${renderGymSelector()}
      </div>
    </div>

    <!-- Row 1: 5 Clean, Balanced Metric Cards (Zero rainbow clutter) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 flex-shrink-0">
      ${topMetrics.map(m => `
        <div onclick="${m.click}" class="bg-white rounded-xl border border-charcoal-200 p-3 hover:border-charcoal-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-medium text-charcoal-500 tracking-wide">${m.label}</span>
            <div class="w-7 h-7 rounded-lg bg-charcoal-50 flex items-center justify-center text-charcoal-400 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${m.icon}"/></svg>
            </div>
          </div>
          <div class="mt-2">
            <p class="text-xl font-bold text-charcoal-900 leading-tight tracking-tight">${m.val}</p>
            <p class="text-[10px] text-charcoal-400 mt-0.5 truncate">${m.sub}</p>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Row 2: 2-Column Workstation (Calm, Segmented Tabs, Zero Clutter) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">

      <!-- ================= LEFT COLUMN (6 cols / 50%): Approvals & Decisions ================= -->
      <div class="lg:col-span-6 bg-white rounded-xl border border-charcoal-200 overflow-hidden flex flex-col min-h-0 shadow-2xs">
        
        <!-- Segmented Header Navigation -->
        <div class="px-3 py-2 border-b border-charcoal-150 flex items-center justify-between bg-charcoal-50/50 flex-shrink-0">
          <div class="flex items-center gap-1.5">
            <h2 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Pending Approvals</h2>
            <span class="badge badge-gray text-[10px] px-1.5 font-semibold">${leftTabCounts[_dashSectionFilter] || leftTabCounts.all}</span>
          </div>

          <!-- Sleek Segmented Control Pills -->
          <div class="flex items-center bg-charcoal-150/80 p-0.5 rounded-lg text-[10px]">
            <button onclick="_dashSectionFilter='all';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='all'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">All (${leftTabCounts.all})</button>
            <button onclick="_dashSectionFilter='dayoff';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='dayoff'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">Day Off (${dayOffReqs.length})</button>
            <button onclick="_dashSectionFilter='leave';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='leave'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">Leaves (${leaveEarlyReqs.length})</button>
            <button onclick="_dashSectionFilter='resignation';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='resignation'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">Exits (${resignationReqs.length})</button>
            <button onclick="_dashSectionFilter='vacancy';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='vacancy'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">Vacancies (${pendingVacancies.length})</button>
          </div>
        </div>

        <!-- Clean, Consistent Request List -->
        <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-charcoal-100">

          <!-- Day Off Requests -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'dayoff') ? dayOffReqs.map(r => `
            <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="badge badge-gray text-[9px]">Day Off</span>
                  <p class="text-xs font-bold text-charcoal-900 truncate">${r.employee}</p>
                  <span class="text-[11px] text-charcoal-400">· ${r.gym}</span>
                </div>
                <p class="text-[11px] text-charcoal-600 mt-1 truncate">Requested: <b class="text-charcoal-800">${r.requestedDate}</b> · Reason: ${r.reason || 'Personal'}</p>
                <div class="flex items-center gap-1.5 mt-1 text-[10px]">
                  <span class="badge ${r.bmDecision==='Approved'?'badge-green':'badge-red'} text-[8px]">${r.bmDecision}</span>
                  <span class="text-charcoal-400 truncate">${r.bmComment || 'Reviewed by Branch Manager'}</span>
                </div>
              </div>
              <button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-primary text-xs h-7 px-3 flex-shrink-0">
                Review & Decide
              </button>
            </div>
          `).join('') : ''}

          <!-- Leave Early / Late Arrival Requests -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'leave') ? leaveEarlyReqs.map(r => `
            <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="badge badge-yellow text-[9px]">${r.type}</span>
                  <p class="text-xs font-bold text-charcoal-900 truncate">${r.employee}</p>
                  <span class="text-[11px] text-charcoal-400">· ${r.gym}</span>
                </div>
                <p class="text-[11px] text-charcoal-600 mt-1 truncate">Date: <b class="text-charcoal-800">${r.requestedDate}</b> · Reason: ${r.reason || 'Personal'}</p>
                <div class="flex items-center gap-1.5 mt-1 text-[10px]">
                  <span class="badge badge-green text-[8px]">${r.bmDecision}</span>
                  <span class="text-charcoal-400 truncate">${r.bmComment || 'Shift covered'}</span>
                </div>
              </div>
              <button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-primary text-xs h-7 px-3 flex-shrink-0">
                Review & Decide
              </button>
            </div>
          `).join('') : ''}

          <!-- Resignation Notices -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'resignation') ? resignationReqs.map(r => `
            <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group bg-rose-50/30">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="badge badge-red text-[9px]">Resignation</span>
                  <p class="text-xs font-bold text-charcoal-900 truncate">${r.employee}</p>
                  <span class="text-[11px] text-charcoal-400">· ${r.gym}</span>
                </div>
                <p class="text-[11px] text-charcoal-700 mt-1 truncate">Last Working Day: <b class="text-rose-900">${r.requestedDate}</b> · Notice Period: 30 Days</p>
                <p class="text-[10px] text-charcoal-500 mt-1 truncate">Reason: ${r.reason} · Handover plan prepared</p>
              </div>
              <button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-danger text-xs h-7 px-3 flex-shrink-0">
                Sign-Off Exit
              </button>
            </div>
          `).join('') : ''}

          <!-- Branch Vacancy Requests -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'vacancy') ? pendingVacancies.map(v => `
            <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="badge badge-purple text-[9px]">${v.gym}</span>
                  <p class="text-xs font-bold text-charcoal-900 truncate">${v.position}</p>
                  <span class="badge ${v.urgency==='High'?'badge-red':'badge-yellow'} text-[8px]">${v.urgency}</span>
                </div>
                <p class="text-[11px] text-charcoal-600 mt-1 truncate">Requested by: <b>${v.submittedBy}</b> (Branch Manager)</p>
                <p class="text-[10px] text-charcoal-400 mt-0.5 truncate">Justification: ${v.reason || 'Operational replacement'}</p>
              </div>
              <button onclick="openVacancyRequestModal('${v.id}')" class="btn btn-sm btn-primary text-xs h-7 px-3 flex-shrink-0">
                Review & Open
              </button>
            </div>
          `).join('') : ''}

          <!-- Compliance & Expiries -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'compliance') ? expiringEvents.map(e => `
            <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="badge badge-orange text-[9px]">${e.type}</span>
                  <p class="text-xs font-bold text-charcoal-900 truncate">${e.title}</p>
                </div>
                <p class="text-[11px] text-charcoal-600 mt-1">Due Date: <b class="text-charcoal-800">${e.date}</b> · ${e.detail}</p>
              </div>
              <button onclick="openComplianceModal('${e.id}')" class="btn btn-sm btn-secondary text-xs h-7 px-3 flex-shrink-0">
                Resolve
              </button>
            </div>
          `).join('') : ''}

          <!-- Pending Deductions -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'payroll') ? pendingDeductions.map(d => `
            <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="badge badge-gray text-[9px]">Deduction</span>
                  <p class="text-xs font-bold text-charcoal-900 truncate">${d.employeeName}</p>
                  <span class="text-[11px] text-rose-600 font-semibold">- EGP ${d.amount}</span>
                </div>
                <p class="text-[11px] text-charcoal-500 mt-1 truncate">${d.gym} · ${d.label} (${d.reason})</p>
              </div>
              <button onclick="openPayrollDeductionModal('${d.employeeId}', '${d.id}')" class="btn btn-sm btn-secondary text-xs h-7 px-3 flex-shrink-0">
                Adjust
              </button>
            </div>
          `).join('') : ''}

          ${(leftTabCounts[_dashSectionFilter] === 0) ? `
            <div class="p-10 text-center flex flex-col items-center justify-center">
              <div class="w-8 h-8 rounded-full bg-charcoal-100 flex items-center justify-center text-charcoal-500 mb-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              </div>
              <p class="text-xs font-semibold text-charcoal-700">No items pending</p>
              <p class="text-[11px] text-charcoal-400 mt-0.5">All requests in this category have been resolved.</p>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="px-3 py-1.5 bg-charcoal-50/50 border-t border-charcoal-150 flex items-center justify-between text-[11px] text-charcoal-400 flex-shrink-0">
          <span>Click any request to view details and decide</span>
          <button onclick="navigateTo('requests')" class="text-brand-600 hover:text-brand-800 font-semibold">View All Requests →</button>
        </div>
      </div>

      <!-- ================= RIGHT COLUMN (6 cols / 50%): Recruitment & Quick Tools ================= -->
      <div class="lg:col-span-6 flex flex-col gap-2.5 min-h-0">

        <!-- Top Panel: Recruitment & Interview Hub -->
        <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden flex flex-col flex-1 min-h-0 shadow-2xs">
          
          <!-- Segmented Navigation Header -->
          <div class="px-3 py-2 border-b border-charcoal-150 flex items-center justify-between bg-charcoal-50/50 flex-shrink-0">
            <div class="flex items-center gap-1.5">
              <h2 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Recruitment Pipeline</h2>
            </div>

            <div class="flex items-center gap-2">
              <div class="flex items-center bg-charcoal-150/80 p-0.5 rounded-lg text-[10px]">
                <button onclick="_recSectionFilter='iv1';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_recSectionFilter==='iv1'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">1st Round (${iv1List.length})</button>
                <button onclick="_recSectionFilter='iv2';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_recSectionFilter==='iv2'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">2nd Round (${iv2List.length})</button>
                <button onclick="_recSectionFilter='offers';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_recSectionFilter==='offers'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">Offers (${acceptedList.length})</button>
                <button onclick="_recSectionFilter='waiting';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_recSectionFilter==='waiting'?'bg-white text-charcoal-900 shadow-2xs font-semibold':'text-charcoal-600 hover:text-charcoal-900'}">Waiting (${MOCK.waitingList.length})</button>
              </div>

              <button onclick="openNewInterview()" class="btn btn-sm btn-secondary text-xs h-6 px-2 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                Schedule
              </button>
            </div>
          </div>

          <!-- Candidates List -->
          <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-charcoal-100">

            <!-- 1st Round Interviews -->
            ${_recSectionFilter === 'iv1' ? iv1List.map(iv => {
              const cand = MOCK.candidates.find(c => c.name === iv.candidate);
              const stars = cand?.rating ? '★'.repeat(cand.rating) + '☆'.repeat(Math.max(0, 5 - cand.rating)) : '—';
              return `
                <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer" onclick="openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-full bg-charcoal-100 text-charcoal-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      ${iv.candidate.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-xs font-bold text-charcoal-900 truncate group-hover:text-brand-700 transition-colors">${iv.candidate}</p>
                        <span class="badge ${iv.type==='Video'?'badge-blue':'badge-gray'} text-[8px]">${iv.type}</span>
                        <span class="text-xs text-amber-500 font-medium">${stars}</span>
                      </div>
                      <p class="text-[11px] text-charcoal-600 mt-0.5 truncate">${iv.position} · ${iv.gym}</p>
                      <p class="text-[10px] text-charcoal-400 mt-0.5">Session: <b class="text-charcoal-700">${iv.date} at ${iv.time}</b> · Interviewer: ${iv.interviewer}</p>
                    </div>
                  </div>
                  <button onclick="event.stopPropagation();openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')" class="btn btn-sm btn-primary text-xs h-7 px-3 flex-shrink-0">
                    Evaluate
                  </button>
                </div>
              `;
            }).join('') : ''}

            <!-- 2nd Round Interviews -->
            ${_recSectionFilter === 'iv2' ? iv2List.map(iv => {
              const cand = MOCK.candidates.find(c => c.name === iv.candidate);
              return `
                <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer" onclick="openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      ${iv.candidate.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-xs font-bold text-charcoal-900 truncate group-hover:text-brand-700 transition-colors">${iv.candidate}</p>
                        <span class="badge badge-purple text-[8px]">Panel Round</span>
                        <span class="text-xs text-amber-500 font-semibold">${cand?.rating || 4}/5 ★</span>
                      </div>
                      <p class="text-[11px] text-charcoal-600 mt-0.5 truncate">${iv.position} · ${iv.gym}</p>
                      <p class="text-[10px] text-charcoal-400 mt-0.5">Panel: <b class="text-charcoal-700">${iv.date} at ${iv.time}</b> · Lead: ${iv.interviewer}</p>
                    </div>
                  </div>
                  <button onclick="event.stopPropagation();openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')" class="btn btn-sm btn-primary text-xs h-7 px-3 flex-shrink-0">
                    Evaluate
                  </button>
                </div>
              `;
            }).join('') : ''}

            <!-- Offer Ready Candidates -->
            ${_recSectionFilter === 'offers' ? acceptedList.map(c => `
              <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3 group cursor-pointer" onclick="openCandidateInterviewDossier('${c.id}')">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    ${c.name.split(' ').map(w => w[0]).join('')}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="text-xs font-bold text-charcoal-900 truncate">${c.name}</p>
                      <span class="badge badge-green text-[8px]">Offer Ready</span>
                      <span class="text-xs text-emerald-800 font-bold">EGP ${(c.form?.salaryExp || 14000).toLocaleString()}</span>
                    </div>
                    <p class="text-[11px] text-charcoal-600 mt-0.5 truncate">${c.position} · Exp: ${c.form?.expYears || 8} yrs · Availability: ${c.form?.availability || 'Immediate'}</p>
                  </div>
                </div>
                <button onclick="event.stopPropagation();hireCandidateDirectly('${c.id}')" class="btn btn-sm btn-success text-xs h-7 px-3 flex-shrink-0">
                  Make Offer
                </button>
              </div>
            `).join('') : ''}

            <!-- Waiting Pool (Auto-validates against open vacancies) -->
            ${_recSectionFilter === 'waiting' ? MOCK.waitingList.map(w => {
              const matchingVacancy = openVacancies.find(v => 
                v.position.toLowerCase() === w.position.toLowerCase() || 
                (w.position.toLowerCase().includes('trainer') && v.position.toLowerCase().includes('trainer'))
              );
              const hasOpenSlot = !!matchingVacancy && matchingVacancy.headcount > 0;

              return `
                <div class="p-3 hover:bg-charcoal-50/60 transition-colors flex items-center justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="text-xs font-bold text-charcoal-900">${w.name}</p>
                      <span class="badge badge-gray text-[8px]">${w.position}</span>
                      ${hasOpenSlot ? `
                        <span class="badge badge-green text-[8px] font-semibold">✓ Open Vacancy at ${matchingVacancy.gym}</span>
                      ` : `
                        <span class="badge badge-gray text-[8px] text-charcoal-400">✕ No open vacancy</span>
                      `}
                    </div>
                    <p class="text-[11px] text-charcoal-500 mt-1 truncate">${w.note}</p>
                    <div class="flex gap-1 mt-1">${(w.skills || []).map(s => `<span class="badge badge-gray text-[8px]">${s}</span>`).join('')}</div>
                  </div>

                  ${hasOpenSlot ? `
                    <button onclick="assignWaitingToOpenVacancy('${w.id}', '${matchingVacancy.id}')" class="btn btn-sm btn-success text-xs h-7 px-3 flex-shrink-0">
                      Assign to ${matchingVacancy.gym}
                    </button>
                  ` : `
                    <button disabled class="btn btn-sm btn-secondary opacity-40 cursor-not-allowed text-xs h-7 px-3 flex-shrink-0 text-charcoal-400">
                      Unavailable
                    </button>
                  `}
                </div>
              `;
            }).join('') : ''}

            ${(_recSectionFilter === 'iv2' && iv2List.length === 0) ? `
              <div class="p-8 text-center text-xs text-charcoal-400">No candidates currently scheduled for 2nd round.</div>
            ` : ''}
            ${(_recSectionFilter === 'offers' && acceptedList.length === 0) ? `
              <div class="p-8 text-center text-xs text-charcoal-400">No candidates awaiting final offer sign-off.</div>
            ` : ''}

          </div>

          <!-- Footer -->
          <div class="px-3 py-1.5 bg-charcoal-50/50 border-t border-charcoal-150 flex items-center justify-between text-[11px] text-charcoal-400 flex-shrink-0">
            <span>Select candidate to review dossier and advance pipeline</span>
            <button onclick="navigateTo('recruitment')" class="text-brand-600 hover:text-brand-800 font-semibold">Recruitment Funnel →</button>
          </div>
        </div>

        <!-- Bottom Panel: Clean, Unified Quick Actions (Calm, Professional Styling) -->
        <div class="bg-white rounded-xl border border-charcoal-200 p-2.5 flex-shrink-0 shadow-2xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold text-charcoal-500 uppercase tracking-wider">Quick Actions</span>
            <span class="text-[10px] text-charcoal-400">Frequently used tools</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <!-- 1. Post Vacancy -->
            <button onclick="openNewVacancy()" class="btn btn-sm btn-secondary justify-start text-xs h-8 px-2.5 hover:border-charcoal-300">
              <svg class="w-3.5 h-3.5 text-charcoal-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <span class="truncate font-medium text-charcoal-800">+ Post Vacancy</span>
            </button>

            <!-- 2. Onboard Employee (Primary Action) -->
            <button onclick="openAddEmployee()" class="btn btn-sm btn-primary justify-start text-xs h-8 px-2.5">
              <svg class="w-3.5 h-3.5 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              <span class="truncate font-semibold">+ Add Employee</span>
            </button>

            <!-- 3. Schedule Interview -->
            <button onclick="openNewInterview()" class="btn btn-sm btn-secondary justify-start text-xs h-8 px-2.5 hover:border-charcoal-300">
              <svg class="w-3.5 h-3.5 text-charcoal-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span class="truncate font-medium text-charcoal-800">Schedule IV</span>
            </button>

            <!-- 4. Contract & Level Review -->
            <button onclick="openContractRenewalModal()" class="btn btn-sm btn-secondary justify-start text-xs h-8 px-2.5 hover:border-charcoal-300">
              <svg class="w-3.5 h-3.5 text-charcoal-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span class="truncate font-medium text-charcoal-800">Contract & Level</span>
            </button>

            <!-- 5. Announcement -->
            <button onclick="openComposeAnnouncement()" class="btn btn-sm btn-secondary justify-start text-xs h-8 px-2.5 hover:border-charcoal-300">
              <svg class="w-3.5 h-3.5 text-charcoal-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
              <span class="truncate font-medium text-charcoal-800">Announcement</span>
            </button>

            <!-- 6. Review Payroll -->
            <button onclick="navigateTo('payroll')" class="btn btn-sm btn-secondary justify-start text-xs h-8 px-2.5 hover:border-charcoal-300">
              <svg class="w-3.5 h-3.5 text-charcoal-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <span class="truncate font-medium text-charcoal-800">Payroll Run</span>
            </button>

            <!-- 7. Bulk Import Staff -->
            <button onclick="openBulkImport()" class="btn btn-sm btn-secondary justify-start text-xs h-8 px-2.5 hover:border-charcoal-300">
              <svg class="w-3.5 h-3.5 text-charcoal-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span class="truncate font-medium text-charcoal-800">Bulk Import</span>
            </button>

            <!-- 8. Export HR Summary Report -->
            <button onclick="exportMonthlyHRReport()" class="btn btn-sm btn-secondary justify-start text-xs h-8 px-2.5 hover:border-charcoal-300">
              <svg class="w-3.5 h-3.5 text-charcoal-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span class="truncate font-medium text-charcoal-800">Export Report</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  </div>`;
}

function openBulkImport() {
  openModal('Bulk Import Employees', `<div class="space-y-3">
    <div class="bg-brand-50 border border-brand-200 rounded-lg p-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="text-xs text-brand-800">Import employees in bulk from a CSV file. Required columns: First Name, Last Name, Email, Position, Level, Gym, Start Date. <strong>HR Manager</strong> access only.</p>
    </div>
    <div class="border-2 border-dashed border-charcoal-300 rounded-xl p-6 text-center">
      <svg class="w-8 h-8 text-charcoal-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
      <p class="text-xs text-charcoal-600">Drag & drop your CSV file here, or</p>
      <button type="button" onclick="showToast('File import simulated')" class="btn btn-sm btn-primary mt-2">Browse Files</button>
      <p class="text-[10px] text-charcoal-400 mt-2">Download template CSV</p>
    </div>
  </div>`, { wide:true, footer:'<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="showToast(\'Import queued — 14 records\');closeModal();" class="btn btn-sm btn-primary">Start Import</button>' });
}