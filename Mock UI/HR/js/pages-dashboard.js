// ==================== HR COMMAND CENTER DASHBOARD ====================
let _dashSectionFilter = 'all';
let _recSectionFilter = 'all';

function renderGymSelector() {
  const u = MOCK.currentUser;
  return `<div class="relative">
    <select onchange="setGymFilter(this.value)" class="form-select w-auto" style="padding:0.25rem 1.75rem 0.25rem 0.5rem;font-size:0.75rem">
      <option value="all">All Gym Branches (${u.gyms.length})</option>
      ${u.gyms.map(g => `<option value="${g.id}" ${u.selectedGym===g.id?'selected':''}>${g.name} — ${g.branch}</option>`).join('')}
    </select>
  </div>`;
}

function setGymFilter(id) {
  const u = MOCK.currentUser;
  u.selectedGym = id;
  renderAll();
  showToast(id==='all' ? 'Showing all assigned gyms' : 'Gym branch filter applied', 'info');
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
    <div class="space-y-3">
      <!-- Candidate Header -->
      <div class="flex items-start justify-between bg-charcoal-50 p-3 rounded-lg border border-charcoal-200">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
            ${c.name.split(' ').map(w => w[0]).join('')}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-sm font-bold text-charcoal-900">${c.name}</h2>
              <span class="badge ${c.stage==='Accepted'||c.stage==='Hired'?'badge-green':c.stage==='Rejected'?'badge-red':'badge-blue'} text-[9px]">${c.stage}</span>
              <span class="text-[10px] text-amber-500 font-semibold">${stars(c.rating)} (${c.rating}/5)</span>
            </div>
            <p class="text-xs text-charcoal-600 mt-0.5">Applied for <b>${c.position}</b> · Preferred Gym: <b>${f.gymPref || 'Nasr City'}</b></p>
            <p class="text-[10px] text-charcoal-400 mt-0.5">Phone: ${c.phone || '—'} · Email: ${f.email || '—'}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="text-[9px] uppercase tracking-wider text-charcoal-400 font-semibold">Applied Date</span>
          <p class="text-xs font-semibold text-charcoal-800">${c.appliedDate || '—'}</p>
          <span class="inline-block mt-1 badge ${c.stage==='Rejected'?'badge-red':'badge-brand'} text-[8px]">${f.source || 'Direct Application'}</span>
        </div>
      </div>

      <!-- 2-Column Evaluation Summary -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <!-- Column A: Qualifications & Background -->
        <div class="bg-white border border-charcoal-200 rounded-lg p-2.5 space-y-2">
          <p class="bento-label text-charcoal-700">QUALIFICATIONS & EXPECTATIONS</p>
          <div class="grid grid-cols-2 gap-1.5 text-[10px]">
            <div class="bg-charcoal-50 p-1.5 rounded">
              <span class="text-charcoal-400 block text-[8px] uppercase">Experience</span>
              <span class="font-semibold text-charcoal-800">${f.expYears ? `${f.expYears} Years` : '—'}</span>
            </div>
            <div class="bg-charcoal-50 p-1.5 rounded">
              <span class="text-charcoal-400 block text-[8px] uppercase">Education</span>
              <span class="font-semibold text-charcoal-800 truncate block" title="${f.education||'—'}">${f.education || '—'}</span>
            </div>
            <div class="bg-charcoal-50 p-1.5 rounded">
              <span class="text-charcoal-400 block text-[8px] uppercase">Expected Salary</span>
              <span class="font-semibold text-brand-700">${f.salaryExp ? `EGP ${f.salaryExp.toLocaleString()}` : 'Negotiable'}</span>
            </div>
            <div class="bg-charcoal-50 p-1.5 rounded">
              <span class="text-charcoal-400 block text-[8px] uppercase">Availability</span>
              <span class="font-semibold text-charcoal-800">${f.availability || 'Immediate'}</span>
            </div>
            <div class="bg-charcoal-50 p-1.5 rounded col-span-2">
              <span class="text-charcoal-400 block text-[8px] uppercase">Shift Preference</span>
              <span class="font-semibold text-charcoal-800">${f.shift || 'Flexible'}</span>
            </div>
          </div>

          <div>
            <span class="text-[9px] font-semibold text-charcoal-500 uppercase tracking-wide block mb-1">Core Competencies & Skills</span>
            <div class="flex flex-wrap gap-1">
              ${(f.skills || ['Fitness Assessment', 'Customer Service']).map(s => `<span class="badge badge-brand text-[8px]">${s}</span>`).join('')}
              ${(f.languages || ['Arabic', 'English']).map(l => `<span class="badge badge-gray text-[8px]">${l}</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- Column B: Interview Evaluation History & Notes -->
        <div class="bg-white border border-charcoal-200 rounded-lg p-2.5 space-y-2">
          <p class="bento-label text-charcoal-700">EVALUATION & INTERVIEW NOTES</p>

          <!-- Screening Notes -->
          <div class="bg-charcoal-50 p-2 rounded text-[10px] space-y-0.5 border border-charcoal-100">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-charcoal-800">1. Phone Screening</span>
              <span class="badge ${c.screen?.verdict==='Pass'?'badge-green':'badge-yellow'} text-[7px]">${c.screen?.verdict || 'Completed'}</span>
            </div>
            <p class="text-charcoal-600 text-[9px]">${c.screen?.notes || 'Good communication skills and cultural fit.'}</p>
            <p class="text-charcoal-400 text-[8px]">Screened by: ${c.screen?.by || 'HR Team'} · Date: ${c.screen?.date || c.appliedDate}</p>
          </div>

          <!-- Interview 1 Notes / Trial Session -->
          <div class="bg-charcoal-50 p-2 rounded text-[10px] space-y-0.5 border border-charcoal-100">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-charcoal-800">2. Technical / 1st Interview</span>
              <span class="badge ${c.iv1?.verdict==='Pass'?'badge-green':c.iv1?.verdict==='Fail'?'badge-red':'badge-blue'} text-[7px]">${c.iv1?.verdict || matchingIv?.status || 'Scheduled'}</span>
            </div>
            <p class="text-charcoal-600 text-[9px]">${c.iv1?.notes || (matchingIv ? `Scheduled on ${matchingIv.date} at ${matchingIv.time} (${matchingIv.type}) with ${matchingIv.interviewer}.` : 'Pending session review.')}</p>
            <p class="text-charcoal-400 text-[8px]">Interviewer: ${c.iv1?.by || matchingIv?.interviewer || 'Youssef Kamal'}</p>
          </div>

          <!-- Interview 2 / Panel Decision (if present) -->
          ${c.iv2 ? `
          <div class="bg-purple-50/70 p-2 rounded text-[10px] space-y-0.5 border border-purple-100">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-purple-900">3. Final Panel / 2nd Interview</span>
              <span class="badge ${c.iv2.verdict==='Pass'?'badge-green':'badge-yellow'} text-[7px]">${c.iv2.verdict}</span>
            </div>
            <p class="text-purple-800 text-[9px]">${c.iv2.notes || 'Panel approval completed.'}</p>
            <p class="text-purple-600 text-[8px]">Conducted by: ${c.iv2.by} · ${c.iv2.date}</p>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Decision Rationale Prompt & Actions -->
      <div class="bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-[10px]">
        <p class="font-semibold text-brand-900 mb-1">HR Decision Rationale</p>
        <p class="text-brand-800 leading-relaxed mb-2">As HR Manager, your decision directly advances this candidate's application or closes the recruitment loop. You can advance them to the next pipeline stage, make a direct offer, or reject with a formal reason.</p>
        <textarea id="cand-decision-note" class="form-input text-xs w-full" rows="2" placeholder="Add evaluation note or feedback (optional)..."></textarea>
      </div>

      <!-- Action Buttons Row -->
      <div class="flex items-center justify-between gap-2 pt-1 border-t border-charcoal-100 flex-wrap">
        <div class="flex items-center gap-1.5">
          <button onclick="closeModal();rejectCandidatePrompt('${c.id}')" class="btn btn-sm btn-danger-outline text-xs">
            <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            Reject Candidate
          </button>
          <button onclick="closeModal();openNewInterview()" class="btn btn-sm btn-secondary text-xs">
            Reschedule
          </button>
        </div>

        <div class="flex items-center gap-1.5 ml-auto">
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
  showToast(`${c.name} has been advanced to ${stageName}!`, 'success');
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

  // Create new candidate record directly in Accepted stage for that vacancy
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

  // Decrement headcount
  v.headcount = Math.max(0, v.headcount - 1);
  if (v.headcount === 0) v.status = 'Closed';

  // Remove from waiting pool
  MOCK.waitingList = MOCK.waitingList.filter(x => x.id !== wId);

  renderAll();
  showToast(`Assigned ${w.name} to open ${v.position} vacancy at ${v.gym}!`, 'success');
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

// ==================== MAIN DASHBOARD RENDERER ====================
function renderDashboard() {
  const u = MOCK.currentUser;

  // Selected gym filter context
  const selectedGymObj = u.selectedGym !== 'all' ? u.gyms.find(g => g.id === u.selectedGym) : null;
  const gymBranch = selectedGymObj ? selectedGymObj.branch : null;

  // Filtered operational datasets
  const pendingReqs = MOCK.requests.filter(r => r.status === 'Pending HR Review' && (!gymBranch || r.gym === gymBranch));
  const openVacancies = MOCK.vacancies.filter(v => v.status === 'Open' && (!gymBranch || v.gym === gymBranch));
  const pendingVacancies = MOCK.vacancyRequests.filter(r => r.status === 'Pending' && (!gymBranch || r.gym === gymBranch));
  const candInPipeline = MOCK.candidates.filter(c => c.stage !== 'Rejected' && c.stage !== 'Hired').length;
  const expiringEvents = MOCK.events.filter(e => (e.type === 'Document Expiry' || e.type === 'Contract Expiry'));

  // Section 5 items (Categorized Decisions & Approvals)
  const dayOffReqs = pendingReqs.filter(r => r.type === 'Day Off');
  const leaveEarlyReqs = pendingReqs.filter(r => r.type === 'Leave Early' || r.type === 'Late Arrival');
  const resignationReqs = pendingReqs.filter(r => r.type === 'Resignation');

  // Pending payroll deductions
  const pendingDeductions = [];
  MOCK.payrollItems.forEach(p => {
    (p.deductionLines || []).forEach(d => {
      if (d.status === 'Pending' && (!gymBranch || p.gym === gymBranch)) {
        pendingDeductions.push({ ...d, employeeName: p.name, employeeId: p.employeeId, gym: p.gym });
      }
    });
  });

  // Section 4 items (Categorized Recruitment & Interviews)
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

  // 6 Executive Top Metrics
  const kpis = [
    { label: 'Day Off & Leave Requests', val: dayOffReqs.length + leaveEarlyReqs.length, sub: `${dayOffReqs.length} day-off · ${leaveEarlyReqs.length} shift`, color: (dayOffReqs.length + leaveEarlyReqs.length) ? 'yellow' : 'brand', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', click: `_dashSectionFilter='requests';renderAll()` },
    { label: 'Resignations & Notices', val: resignationReqs.length, sub: 'awaiting HR sign-off', color: resignationReqs.length ? 'red' : 'green', icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', click: `_dashSectionFilter='resignation';renderAll()` },
    { label: 'Headcount Requests', val: pendingVacancies.length, sub: 'BM requests pending', color: pendingVacancies.length ? 'purple' : 'brand', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', click: `_dashSectionFilter='vacancy';renderAll()` },
    { label: 'Scheduled Interviews', val: allScheduledIvs.length, sub: `${iv1List.length} 1st · ${iv2List.length} 2nd round`, color: 'blue', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', click: `_recSectionFilter='all';renderAll()` },
    { label: 'Urgent Expiries', val: expiringEvents.length, sub: 'contracts & certs due', color: expiringEvents.length ? 'orange' : 'green', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z', click: `_dashSectionFilter='compliance';renderAll()` },
    { label: 'Payroll Adjustments', val: pendingDeductions.length, sub: 'unapproved deductions', color: pendingDeductions.length ? 'yellow' : 'brand', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', click: `_dashSectionFilter='payroll';renderAll()` },
  ];

  const kpiColors = {
    brand: ['bg-brand-50 text-brand-600 border-l-brand-600', 'text-brand-700'],
    yellow: ['bg-yellow-50 text-yellow-600 border-l-yellow-500', 'text-yellow-700'],
    blue: ['bg-blue-50 text-blue-600 border-l-blue-500', 'text-blue-700'],
    purple: ['bg-purple-50 text-purple-600 border-l-purple-500', 'text-purple-700'],
    green: ['bg-emerald-50 text-emerald-600 border-l-emerald-500', 'text-emerald-700'],
    red: ['bg-red-50 text-red-600 border-l-red-500', 'text-red-700'],
    orange: ['bg-orange-50 text-orange-600 border-l-orange-500', 'text-orange-700'],
  };

  return `<div class="flex flex-col h-full min-h-0 gap-2">

    <!-- Row 0: HR Manager Operational Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 flex-shrink-0">
      <div class="flex items-center gap-2">
        <h1 class="text-sm font-bold text-charcoal-900 leading-tight">${getGreeting()}, ${u.firstName} 👋</h1>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-brand-50 text-brand-800 border border-brand-200">
          <svg class="w-3 h-3 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          HR Command Center · Mona El-Sayed
        </span>
        <span class="text-[11px] text-charcoal-400 hidden md:inline">Wednesday, Sep 9, 2026</span>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="exportMonthlyHRReport()" class="btn btn-sm btn-secondary text-[10px] h-6 px-2 flex items-center gap-1">
          <svg class="w-3 h-3 text-charcoal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export HR Report
        </button>
        ${renderGymSelector()}
      </div>
    </div>

    <!-- Row 1: High-Density HR Executive KPI Strip (height ~52px) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 flex-shrink-0">
      ${kpis.map(k => {
        const theme = kpiColors[k.color] || kpiColors.brand;
        return `<div onclick="${k.click}" class="stat-tile py-1 px-2.5 min-h-0 border-l-2 ${theme[0]} cursor-pointer hover:shadow-sm transition-all group">
          <div class="flex items-center justify-between">
            <span class="stat-label truncate text-[10px] text-charcoal-500 font-medium">${k.label}</span>
            <svg class="w-3 h-3 text-charcoal-400 group-hover:${theme[1]} transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${k.icon}"/></svg>
          </div>
          <div class="flex items-baseline justify-between mt-0.5">
            <p class="stat-value text-sm font-bold text-charcoal-900 leading-none">${k.val}</p>
            <span class="text-[9px] text-charcoal-400 truncate ml-1">${k.sub}</span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Row 2: 2-Column High-Efficiency Workstation Layout (fills remaining height) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 min-h-0">

      <!-- ================= COLUMN 5 (6 cols / 50%): Categorized HR Decisions & Approvals ================= -->
      <div class="lg:col-span-6 bg-white rounded-lg border border-charcoal-200 overflow-hidden flex flex-col min-h-0 shadow-sm">
        <!-- Header with Jump Chips -->
        <div class="px-3 py-1.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/70 flex-shrink-0">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <p class="bento-label text-charcoal-800">HR DECISIONS & APPROVALS (BY CATEGORY)</p>
            <span class="badge badge-red text-[8px] px-1 py-0">${pendingReqs.length + pendingVacancies.length + expiringEvents.length + pendingDeductions.length}</span>
          </div>
          <!-- Filter chips -->
          <div class="flex items-center gap-1 text-[9px]">
            <button onclick="_dashSectionFilter='all';renderAll()" class="px-1.5 py-0.5 rounded ${_dashSectionFilter==='all'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">All</button>
            <button onclick="_dashSectionFilter='dayoff';renderAll()" class="px-1.5 py-0.5 rounded ${_dashSectionFilter==='dayoff'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">Day Off (${dayOffReqs.length})</button>
            <button onclick="_dashSectionFilter='leave';renderAll()" class="px-1.5 py-0.5 rounded ${_dashSectionFilter==='leave'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">Shift (${leaveEarlyReqs.length})</button>
            <button onclick="_dashSectionFilter='resignation';renderAll()" class="px-1.5 py-0.5 rounded ${_dashSectionFilter==='resignation'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">Resign (${resignationReqs.length})</button>
            <button onclick="_dashSectionFilter='vacancy';renderAll()" class="px-1.5 py-0.5 rounded ${_dashSectionFilter==='vacancy'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">Vac (${pendingVacancies.length})</button>
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-charcoal-100">

          <!-- Section 1: Day Off Requests -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'dayoff') ? `
            <div class="p-2 bg-charcoal-50/40">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                  Day Off Requests (${dayOffReqs.length})
                </span>
                <span class="text-[8px] text-charcoal-400">Escalated by Branch Managers</span>
              </div>
              <div class="space-y-1.5">
                ${dayOffReqs.map(r => `
                  <div class="bg-white p-2 rounded border border-charcoal-150 hover:border-brand-300 transition-all flex items-center justify-between gap-2 shadow-2xs">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="badge badge-yellow text-[8px]">Day Off</span>
                        <p class="text-[10px] font-bold text-charcoal-900 truncate">${r.employee}</p>
                        <span class="text-[9px] text-charcoal-500">· ${r.gym}</span>
                      </div>
                      <p class="text-[9px] text-charcoal-600 mt-0.5">Requested Date: <b>${r.requestedDate}</b> · Reason: ${r.reason || 'Personal'}</p>
                      <p class="text-[8px] text-charcoal-400 mt-0.5">BM Decision: <span class="${r.bmDecision==='Approved'?'text-emerald-700 font-semibold':'text-red-700 font-semibold'}">${r.bmDecision}</span> (${r.bmComment || 'Reviewed'})</p>
                    </div>
                    <button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                      Decide
                    </button>
                  </div>
                `).join('')}
                ${dayOffReqs.length === 0 ? `<p class="text-[9px] text-charcoal-400 py-1 italic">No pending Day Off requests.</p>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Section 2: Leave Early & Late Arrival Requests -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'leave') ? `
            <div class="p-2 bg-charcoal-50/40">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  Leave Early & Late Arrival (${leaveEarlyReqs.length})
                </span>
                <span class="text-[8px] text-charcoal-400">Shift Coverage Approvals</span>
              </div>
              <div class="space-y-1.5">
                ${leaveEarlyReqs.map(r => `
                  <div class="bg-white p-2 rounded border border-charcoal-150 hover:border-brand-300 transition-all flex items-center justify-between gap-2 shadow-2xs">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="badge badge-orange text-[8px]">${r.type}</span>
                        <p class="text-[10px] font-bold text-charcoal-900 truncate">${r.employee}</p>
                        <span class="text-[9px] text-charcoal-500">· ${r.gym}</span>
                      </div>
                      <p class="text-[9px] text-charcoal-600 mt-0.5">For: <b>${r.requestedDate}</b> · Reason: ${r.reason || 'Medical'}</p>
                      <p class="text-[8px] text-charcoal-400 mt-0.5">BM Decision: <span class="text-emerald-700 font-semibold">${r.bmDecision}</span> (${r.bmComment || 'Shift covered'})</p>
                    </div>
                    <button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                      Decide
                    </button>
                  </div>
                `).join('')}
                ${leaveEarlyReqs.length === 0 ? `<p class="text-[9px] text-charcoal-400 py-1 italic">No pending Leave Early requests.</p>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Section 3: Resignation & Notice Periods -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'resignation') ? `
            <div class="p-2 bg-charcoal-50/40">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Resignations & Notice Periods (${resignationReqs.length})
                </span>
                <span class="text-[8px] text-charcoal-400">Critical Staff Separations</span>
              </div>
              <div class="space-y-1.5">
                ${resignationReqs.map(r => `
                  <div class="bg-red-50/50 p-2 rounded border border-red-200 hover:border-red-400 transition-all flex items-center justify-between gap-2 shadow-2xs">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="badge badge-red text-[8px]">Resignation</span>
                        <p class="text-[10px] font-bold text-charcoal-900 truncate">${r.employee}</p>
                        <span class="text-[9px] text-charcoal-500">· ${r.gym}</span>
                      </div>
                      <p class="text-[9px] text-charcoal-700 mt-0.5">Last Working Day: <b>${r.requestedDate}</b> · Reason: ${r.reason}</p>
                      <p class="text-[8px] text-charcoal-500 mt-0.5">BM Decision: <span class="text-emerald-700 font-semibold">${r.bmDecision}</span> (${r.bmComment || 'Handover prepared'})</p>
                    </div>
                    <button onclick="openRequestDecision('${r.id}')" class="btn btn-sm btn-danger text-[9px] h-6 px-2 flex-shrink-0">
                      Sign-Off
                    </button>
                  </div>
                `).join('')}
                ${resignationReqs.length === 0 ? `<p class="text-[9px] text-charcoal-400 py-1 italic">No pending resignation notices.</p>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Section 4: Branch Vacancy Headcount Requests -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'vacancy') ? `
            <div class="p-2 bg-charcoal-50/40">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  Branch Headcount Requests (${pendingVacancies.length})
                </span>
                <span class="text-[8px] text-charcoal-400">BM Recruitment Authorizations</span>
              </div>
              <div class="space-y-1.5">
                ${pendingVacancies.map(v => `
                  <div class="bg-white p-2 rounded border border-charcoal-150 hover:border-purple-300 transition-all flex items-center justify-between gap-2 shadow-2xs">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="badge badge-purple text-[8px]">${v.gym}</span>
                        <p class="text-[10px] font-bold text-charcoal-900 truncate">${v.position}</p>
                        <span class="badge ${v.urgency==='High'?'badge-red':'badge-yellow'} text-[7px]">${v.urgency}</span>
                      </div>
                      <p class="text-[9px] text-charcoal-600 mt-0.5">Requested by: <b>${v.submittedBy}</b> · Reason: ${v.reason || 'Replacement'}</p>
                    </div>
                    <button onclick="openVacancyRequestModal('${v.id}')" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                      Review
                    </button>
                  </div>
                `).join('')}
                ${pendingVacancies.length === 0 ? `<p class="text-[9px] text-charcoal-400 py-1 italic">No pending headcount requests.</p>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Section 5: Compliance & Expiries -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'compliance') ? `
            <div class="p-2 bg-charcoal-50/40">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                  Contracts & Certifications Expiring (${expiringEvents.length})
                </span>
                <span class="text-[8px] text-charcoal-400">Action Required ≤30 Days</span>
              </div>
              <div class="space-y-1.5">
                ${expiringEvents.map(e => `
                  <div class="bg-orange-50/40 p-2 rounded border border-orange-200 hover:border-orange-400 transition-all flex items-center justify-between gap-2 shadow-2xs">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="badge badge-orange text-[8px]">${e.type}</span>
                        <p class="text-[10px] font-bold text-charcoal-900 truncate">${e.title}</p>
                      </div>
                      <p class="text-[9px] text-charcoal-600 mt-0.5">Expiry Date: <b>${e.date}</b> · ${e.detail}</p>
                    </div>
                    <button onclick="openComplianceModal('${e.id}')" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                      Resolve
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Section 6: Payroll Deductions Pending Review -->
          ${(_dashSectionFilter === 'all' || _dashSectionFilter === 'payroll') ? `
            <div class="p-2 bg-charcoal-50/40">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  Payroll Adjustments Pending Approval (${pendingDeductions.length})
                </span>
                <span class="text-[8px] text-charcoal-400">August Cycle Cutoff</span>
              </div>
              <div class="space-y-1.5">
                ${pendingDeductions.map(d => `
                  <div class="bg-white p-2 rounded border border-charcoal-150 hover:border-brand-300 transition-all flex items-center justify-between gap-2 shadow-2xs">
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="badge badge-yellow text-[8px]">- EGP ${d.amount}</span>
                        <p class="text-[10px] font-bold text-charcoal-900 truncate">${d.employeeName}</p>
                        <span class="text-[9px] text-charcoal-500">· ${d.gym}</span>
                      </div>
                      <p class="text-[9px] text-charcoal-600 mt-0.5">${d.label} — ${d.reason}</p>
                    </div>
                    <button onclick="openPayrollDeductionModal('${d.employeeId}', '${d.id}')" class="btn btn-sm btn-secondary text-[9px] h-6 px-2 flex-shrink-0">
                      Adjust
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

        </div>

        <div class="px-3 py-1 bg-charcoal-50/80 border-t border-charcoal-100 flex items-center justify-between text-[9px] text-charcoal-500 flex-shrink-0">
          <span>${pendingReqs.length} pending requests · ${pendingVacancies.length} headcount sign-offs</span>
          <button onclick="navigateTo('requests')" class="text-brand-600 font-semibold hover:underline">Requests Inbox →</button>
        </div>
      </div>

      <!-- ================= COLUMN 4 & 6 (6 cols / 50%): Recruitment Pipeline & Essential Workflows ================= -->
      <div class="lg:col-span-6 flex flex-col gap-2 min-h-0">

        <!-- Top Box (4): Categorized Recruitment & Candidate Evaluation Hub -->
        <div class="bg-white rounded-lg border border-charcoal-200 overflow-hidden flex flex-col flex-1 min-h-0 shadow-sm">
          <!-- Sub-Tabs / Filters -->
          <div class="px-3 py-1.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/70 flex-shrink-0">
            <div class="flex items-center gap-1">
              <span class="bento-label text-charcoal-800 mr-1">INTERVIEWS & CANDIDATES:</span>
              <button onclick="_recSectionFilter='all';renderAll()" class="px-1.5 py-0.5 rounded ${_recSectionFilter==='all'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'} text-[9px]">All</button>
              <button onclick="_recSectionFilter='iv1';renderAll()" class="px-1.5 py-0.5 rounded ${_recSectionFilter==='iv1'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'} text-[9px]">1st Round (${iv1List.length})</button>
              <button onclick="_recSectionFilter='iv2';renderAll()" class="px-1.5 py-0.5 rounded ${_recSectionFilter==='iv2'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'} text-[9px]">2nd Round (${iv2List.length})</button>
              <button onclick="_recSectionFilter='waiting';renderAll()" class="px-1.5 py-0.5 rounded ${_recSectionFilter==='waiting'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'} text-[9px]">Waiting Pool (${MOCK.waitingList.length})</button>
            </div>
            <button onclick="openNewInterview()" class="btn btn-sm btn-secondary text-[9px] h-5 px-1.5">
              + Schedule
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-charcoal-100">

            <!-- Section 4.1: First Interview Round -->
            ${(_recSectionFilter === 'all' || _recSectionFilter === 'iv1') ? `
              <div class="p-2 bg-charcoal-50/40">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    First Round Interviews (${iv1List.length})
                  </span>
                  <span class="text-[8px] text-charcoal-400">Technical & Practical Trials</span>
                </div>
                <div class="space-y-1.5">
                  ${iv1List.map(iv => {
                    const cand = MOCK.candidates.find(c => c.name === iv.candidate);
                    const stars = cand?.rating ? '★'.repeat(cand.rating) + '☆'.repeat(Math.max(0, 5 - cand.rating)) : '—';
                    return `
                      <div class="bg-white p-2 rounded border border-charcoal-150 hover:border-brand-300 transition-all flex items-center justify-between gap-2 shadow-2xs cursor-pointer group" onclick="openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')">
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="badge ${iv.type==='Video'?'badge-blue':'badge-purple'} text-[7px]">${iv.type}</span>
                            <p class="text-[10px] font-bold text-charcoal-900 truncate group-hover:text-brand-700">${iv.candidate}</p>
                            <span class="text-[9px] text-amber-500">${stars}</span>
                          </div>
                          <p class="text-[9px] text-charcoal-600 mt-0.5 truncate">${iv.position} · ${iv.gym}</p>
                          <p class="text-[8px] text-charcoal-400 mt-0.5">Scheduled: <b>${iv.date} at ${iv.time}</b> · Interviewer: ${iv.interviewer}</p>
                        </div>
                        <button onclick="event.stopPropagation();openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                          Review & Decide
                        </button>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Section 4.2: Second Interview / Final Panel Round -->
            ${(_recSectionFilter === 'all' || _recSectionFilter === 'iv2') ? `
              <div class="p-2 bg-charcoal-50/40">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    Second Interview / Panel Round (${iv2List.length})
                  </span>
                  <span class="text-[8px] text-charcoal-400">Final Panel Evaluation</span>
                </div>
                <div class="space-y-1.5">
                  ${iv2List.map(iv => {
                    const cand = MOCK.candidates.find(c => c.name === iv.candidate);
                    return `
                      <div class="bg-white p-2 rounded border border-charcoal-150 hover:border-purple-300 transition-all flex items-center justify-between gap-2 shadow-2xs cursor-pointer group" onclick="openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')">
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="badge badge-purple text-[7px]">Panel 2nd Round</span>
                            <p class="text-[10px] font-bold text-charcoal-900 truncate group-hover:text-brand-700">${iv.candidate}</p>
                            <span class="text-[9px] text-amber-500 font-semibold">${cand?.rating || 4}/5 ★</span>
                          </div>
                          <p class="text-[9px] text-charcoal-600 mt-0.5 truncate">${iv.position} · ${iv.gym}</p>
                          <p class="text-[8px] text-charcoal-400 mt-0.5">Session: <b>${iv.date} at ${iv.time}</b> · Panelist: ${iv.interviewer}</p>
                        </div>
                        <button onclick="event.stopPropagation();openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                          Evaluate & Decide
                        </button>
                      </div>
                    `;
                  }).join('')}
                  ${iv2List.length === 0 ? `<p class="text-[9px] text-charcoal-400 py-1 italic">No second-round interviews scheduled right now.</p>` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Section 4.3: Final Verdict & Offer Stage -->
            ${(_recSectionFilter === 'all' || _recSectionFilter === 'offers') ? `
              <div class="p-2 bg-charcoal-50/40">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Approved For Offer (${acceptedList.length})
                  </span>
                  <span class="text-[8px] text-charcoal-400">Ready for Contract Signing</span>
                </div>
                <div class="space-y-1.5">
                  ${acceptedList.map(c => `
                    <div class="bg-emerald-50/50 p-2 rounded border border-emerald-200 hover:border-emerald-400 transition-all flex items-center justify-between gap-2 shadow-2xs cursor-pointer group" onclick="openCandidateInterviewDossier('${c.id}')">
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span class="badge badge-green text-[7px]">Offer Ready</span>
                          <p class="text-[10px] font-bold text-charcoal-900 truncate">${c.name}</p>
                          <span class="text-[9px] text-emerald-800 font-semibold">EGP ${(c.form?.salaryExp || 14000).toLocaleString()}</span>
                        </div>
                        <p class="text-[9px] text-charcoal-600 mt-0.5 truncate">${c.position} · Exp: ${c.form?.expYears || 8} yrs · Availability: ${c.form?.availability || 'Immediate'}</p>
                      </div>
                      <button onclick="event.stopPropagation();hireCandidateDirectly('${c.id}')" class="btn btn-sm btn-success text-[9px] h-6 px-2 flex-shrink-0">
                        Make Offer
                      </button>
                    </div>
                  `).join('')}
                  ${acceptedList.length === 0 ? `<p class="text-[9px] text-charcoal-400 py-1 italic">No candidates awaiting offer sign-off.</p>` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Section 4.4: Talent Waiting Pool (With Strict Open Vacancy Validation) -->
            ${(_recSectionFilter === 'all' || _recSectionFilter === 'waiting') ? `
              <div class="p-2 bg-charcoal-50/40">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[10px] font-bold text-charcoal-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-charcoal-600"></span>
                    Talent Waiting Pool (${MOCK.waitingList.length})
                  </span>
                  <span class="text-[8px] text-charcoal-500 font-medium">Auto-Validates Against Open Vacancies</span>
                </div>
                <div class="space-y-1.5">
                  ${MOCK.waitingList.map(w => {
                    // Check if there is an open vacancy matching this candidate's target position
                    const matchingVacancy = openVacancies.find(v => 
                      v.position.toLowerCase() === w.position.toLowerCase() || 
                      (w.position.toLowerCase().includes('trainer') && v.position.toLowerCase().includes('trainer'))
                    );
                    const hasOpenSlot = !!matchingVacancy && matchingVacancy.headcount > 0;

                    return `
                      <div class="bg-white p-2 rounded border ${hasOpenSlot ? 'border-emerald-300 bg-emerald-50/20' : 'border-charcoal-200'} transition-all flex items-center justify-between gap-2 shadow-2xs">
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <p class="text-[10px] font-bold text-charcoal-900">${w.name}</p>
                            <span class="badge badge-gray text-[7px]">${w.position}</span>
                            ${hasOpenSlot ? `
                              <span class="badge badge-green text-[7px] font-bold">✓ Vacancy Open: ${matchingVacancy.position} (${matchingVacancy.gym})</span>
                            ` : `
                              <span class="badge badge-red text-[7px]">✕ No Open Vacancy for ${w.position}</span>
                            `}
                          </div>
                          <p class="text-[9px] text-charcoal-500 truncate mt-0.5">${w.note}</p>
                          <div class="flex gap-1 mt-1">${(w.skills || []).map(s => `<span class="badge badge-gray text-[7px]">${s}</span>`).join('')}</div>
                        </div>

                        ${hasOpenSlot ? `
                          <button onclick="assignWaitingToOpenVacancy('${w.id}', '${matchingVacancy.id}')" class="btn btn-sm btn-success text-[9px] h-6 px-2 flex-shrink-0" title="Assign to open vacancy at ${matchingVacancy.gym}">
                            Assign to ${matchingVacancy.gym}
                          </button>
                        ` : `
                          <button disabled class="btn btn-sm btn-secondary opacity-50 cursor-not-allowed text-[9px] h-6 px-2 flex-shrink-0 text-charcoal-400" title="Cannot assign: no open vacancy exists for ${w.position}">
                            Unavailable
                          </button>
                        `}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

          </div>
        </div>

        <!-- Bottom Box (6): Essential HR Workflows Launchpad (8 High-Impact Actions) -->
        <div class="bg-white rounded-lg border border-charcoal-200 p-2 flex-shrink-0 shadow-sm">
          <div class="flex items-center justify-between mb-1.5">
            <p class="bento-label text-charcoal-800">ESSENTIAL HR WORKFLOWS</p>
            <span class="text-[8px] text-charcoal-400 font-semibold">1-Click Operations</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <!-- 1. Post Vacancy -->
            <button onclick="openNewVacancy()" class="btn btn-sm btn-secondary justify-start text-[9px] h-7 px-2 hover:border-brand-500 hover:text-brand-700 transition-colors">
              <svg class="w-3.5 h-3.5 text-brand-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <span class="truncate">+ Post Vacancy</span>
            </button>

            <!-- 2. Onboard Employee -->
            <button onclick="openAddEmployee()" class="btn btn-sm btn-primary justify-start text-[9px] h-7 px-2">
              <svg class="w-3.5 h-3.5 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              <span class="truncate">+ Add Employee</span>
            </button>

            <!-- 3. Schedule Interview -->
            <button onclick="openNewInterview()" class="btn btn-sm btn-secondary justify-start text-[9px] h-7 px-2 hover:border-blue-500 hover:text-blue-700 transition-colors">
              <svg class="w-3.5 h-3.5 text-blue-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span class="truncate">Schedule IV</span>
            </button>

            <!-- 4. Contract & Level Review -->
            <button onclick="openContractRenewalModal()" class="btn btn-sm btn-secondary justify-start text-[9px] h-7 px-2 hover:border-purple-500 hover:text-purple-700 transition-colors">
              <svg class="w-3.5 h-3.5 text-purple-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span class="truncate">Contract & Level</span>
            </button>

            <!-- 5. Announcement -->
            <button onclick="openComposeAnnouncement()" class="btn btn-sm btn-secondary justify-start text-[9px] h-7 px-2 hover:border-orange-500 hover:text-orange-700 transition-colors">
              <svg class="w-3.5 h-3.5 text-orange-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
              <span class="truncate">Announcement</span>
            </button>

            <!-- 6. Review Payroll -->
            <button onclick="navigateTo('payroll')" class="btn btn-sm btn-secondary justify-start text-[9px] h-7 px-2 hover:border-emerald-500 hover:text-emerald-700 transition-colors">
              <svg class="w-3.5 h-3.5 text-emerald-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <span class="truncate">Review Payroll</span>
            </button>

            <!-- 7. Bulk Import Staff -->
            <button onclick="openBulkImport()" class="btn btn-sm btn-secondary justify-start text-[9px] h-7 px-2">
              <svg class="w-3.5 h-3.5 text-charcoal-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span class="truncate">Bulk Import</span>
            </button>

            <!-- 8. Export HR Summary Report -->
            <button onclick="exportMonthlyHRReport()" class="btn btn-sm btn-secondary justify-start text-[9px] h-7 px-2 text-brand-700 font-semibold hover:bg-brand-50">
              <svg class="w-3.5 h-3.5 text-brand-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span class="truncate">Export Report</span>
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