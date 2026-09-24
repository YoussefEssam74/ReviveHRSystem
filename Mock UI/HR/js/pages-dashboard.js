// ==================== HR COMMAND CENTER DASHBOARD ====================
let _dashAlertFilter = 'all';
let _dashMiddleTab = 'interviews';
let _dashRightTab = 'todos';

// Daily interactive HR agenda tasks (stored in session memory)
let _hrDailyTodos = [
  { id: 'todo-1', title: 'Review & approve August payroll deduction adjustments', category: 'Payroll', done: false, type: 'action', cta: 'Review', action: 'navigateTo("payroll")' },
  { id: 'todo-2', title: 'Sign off Ahmed Zaki resignation notice & handover plan', category: 'Requests', done: false, type: 'action', cta: 'Decide', action: 'openRequestDecision("r7")' },
  { id: 'todo-3', title: 'Interview & evaluate Mohamed Salah (Senior Trainer)', category: 'Recruitment', done: false, type: 'action', cta: 'Evaluate', action: 'openCandidateInterviewDossier("c1")' },
  { id: 'todo-4', title: 'Send First Aid certification expiry notice to Ahmed Mohamed', category: 'Compliance', done: false, type: 'action', cta: 'Resolve', action: 'openComplianceModal("ev1")' },
  { id: 'todo-5', title: 'Verify Nourhan Ali uniform & ID onboarding milestone', category: 'Onboarding', done: false, type: 'action', cta: 'Checklist', action: 'openNewcomerChecklistModal("nc2")' },
  { id: 'todo-6', title: 'Approve BM vacancy request: Senior Trainer (Nasr City)', category: 'Recruitment', done: true, type: 'action', cta: 'Decide', action: 'openVacancyRequestModal("vr1")' },
];

function toggleHrDailyTodo(id) {
  const t = _hrDailyTodos.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  renderAll();
  showToast(t.done ? `Completed: ${t.title}` : `Marked pending: ${t.title}`, 'info');
}

function openAddDailyTodoModal() {
  openModal('Add HR Daily Task', `<form onsubmit="event.preventDefault();saveNewDailyTodo()" class="space-y-3">
    <div>
      <label class="form-label">Task Description</label>
      <input id="todo-new-title" type="text" class="form-input" placeholder="e.g. Audit probation reviews for Q3 hires" required>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="form-label">Category</label>
        <select id="todo-new-cat" class="form-select">
          <option value="General">General HR</option>
          <option value="Recruitment">Recruitment</option>
          <option value="Requests">Requests & Approvals</option>
          <option value="Compliance">Compliance & Contracts</option>
          <option value="Payroll">Payroll</option>
          <option value="Onboarding">Onboarding</option>
        </select>
      </div>
      <div>
        <label class="form-label">Priority</label>
        <select id="todo-new-priority" class="form-select">
          <option value="High">High Priority</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
    </div>
    <div class="flex justify-end gap-2 pt-2">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Add Task</button>
    </div>
  </form>`);
}

function saveNewDailyTodo() {
  const title = (document.getElementById('todo-new-title').value || '').trim();
  const cat = document.getElementById('todo-new-cat').value;
  if (!title) return;
  _hrDailyTodos.unshift({
    id: 'todo-' + Date.now(),
    title: title,
    category: cat,
    done: false,
    type: 'custom',
    cta: 'View',
    action: `showToast("Task: ${title.replace(/"/g, '')}", "info")`
  });
  closeModal();
  renderAll();
  showToast('Task added to daily agenda');
}

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
      <!-- Candidate Quick Header -->
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

// ==================== NEWCOMER ONBOARDING MODAL ====================
function openNewcomerChecklistModal(ncId) {
  const nc = MOCK.newComers.find(x => x.id === ncId);
  if (!nc) return;

  const checklistHtml = nc.checklist.map(([label, done], idx) => `
    <div class="flex items-center justify-between p-2 rounded ${done?'bg-emerald-50/60 text-emerald-900 border border-emerald-100':'bg-charcoal-50 text-charcoal-800 border border-charcoal-100'}">
      <label class="flex items-center gap-2 text-xs font-medium cursor-pointer flex-1">
        <input type="checkbox" ${done?'checked':''} onchange="toggleNewcomerStep('${nc.id}', ${idx})" class="w-4 h-4 rounded text-brand-600 border-charcoal-300">
        <span class="${done?'line-through opacity-80':''}">${label}</span>
      </label>
      <span class="badge ${done?'badge-green':'badge-gray'} text-[8px]">${done?'Completed':'Pending'}</span>
    </div>
  `).join('');

  openModal(`Onboarding Checklist — ${nc.name}`, `
    <div class="space-y-3">
      <div class="flex items-center justify-between bg-charcoal-50 p-2.5 rounded-lg border border-charcoal-200">
        <div>
          <h3 class="text-sm font-bold text-charcoal-900">${nc.name}</h3>
          <p class="text-[10px] text-charcoal-500">${nc.position} · Start Date: ${nc.startDate}</p>
        </div>
        <div class="text-right">
          <span class="text-sm font-bold text-brand-600">${nc.progress}%</span>
          <p class="text-[8px] text-charcoal-400 uppercase">Completed</p>
        </div>
      </div>

      <div class="w-full bg-charcoal-100 h-2 rounded-full overflow-hidden">
        <div class="h-full bg-brand-600 rounded-full transition-all" style="width: ${nc.progress}%"></div>
      </div>

      <div>
        <p class="bento-label text-charcoal-600 mb-1.5">30-DAY ONBOARDING MILESTONES</p>
        <div class="space-y-1.5">${checklistHtml}</div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
        <button onclick="closeModal()" class="btn btn-sm btn-primary text-xs">Done</button>
      </div>
    </div>
  `);
}

function toggleNewcomerStep(ncId, stepIdx) {
  const nc = MOCK.newComers.find(x => x.id === ncId);
  if (!nc || !nc.checklist[stepIdx]) return;
  nc.checklist[stepIdx][1] = !nc.checklist[stepIdx][1];
  const doneCount = nc.checklist.filter(c => c[1]).length;
  nc.progress = Math.round((doneCount / nc.checklist.length) * 100);
  openNewcomerChecklistModal(ncId);
  renderAll();
  showToast(`Onboarding progress updated: ${nc.progress}% complete`);
}

// ==================== SEPARATION / EXIT MODAL ====================
function openSeparationExitModal(sepId) {
  const sep = MOCK.separations.find(x => x.id === sepId);
  if (!sep) return;

  const checklistHtml = sep.checklist.map(([label, done], idx) => `
    <div class="flex items-center justify-between p-2 rounded ${done?'bg-emerald-50/60 text-emerald-900 border border-emerald-100':'bg-charcoal-50 text-charcoal-800 border border-charcoal-100'}">
      <label class="flex items-center gap-2 text-xs font-medium cursor-pointer flex-1">
        <input type="checkbox" ${done?'checked':''} onchange="toggleSeparationStep('${sep.id}', ${idx})" class="w-4 h-4 rounded text-brand-600 border-charcoal-300">
        <span class="${done?'line-through opacity-80':''}">${label}</span>
      </label>
      <span class="badge ${done?'badge-green':'badge-gray'} text-[8px]">${done?'Cleared':'Pending'}</span>
    </div>
  `).join('');

  openModal(`Offboarding Clearance — ${sep.employee}`, `
    <div class="space-y-3">
      <div class="bg-charcoal-50 p-2.5 rounded-lg border border-charcoal-200">
        <div class="flex items-center justify-between mb-1">
          <span class="badge badge-purple text-[9px]">${sep.gym}</span>
          <span class="badge badge-yellow text-[9px]">${sep.status}</span>
        </div>
        <h3 class="text-sm font-bold text-charcoal-900">${sep.employee}</h3>
        <p class="text-xs text-charcoal-600">${sep.position} · Last Working Day: <b>${sep.lastDay}</b></p>
        <p class="text-[10px] text-charcoal-500 mt-1">Reason: ${sep.reason}</p>
      </div>

      <div>
        <p class="bento-label text-charcoal-600 mb-1.5">EXIT CLEARANCE CHECKLIST</p>
        <div class="space-y-1.5">${checklistHtml}</div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-charcoal-100">
        <button onclick="closeModal();navigateTo('terminations')" class="btn btn-sm btn-secondary text-xs">Full Exit File</button>
        <div class="flex items-center gap-2">
          <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">Close</button>
          <button onclick="finalizeSeparationSignOff('${sep.id}')" class="btn btn-sm btn-primary text-xs">Final HR Sign-Off</button>
        </div>
      </div>
    </div>
  `, { wide: true });
}

function toggleSeparationStep(sepId, stepIdx) {
  const sep = MOCK.separations.find(x => x.id === sepId);
  if (!sep || !sep.checklist[stepIdx]) return;
  sep.checklist[stepIdx][1] = !sep.checklist[stepIdx][1];
  const doneCount = sep.checklist.filter(c => c[1]).length;
  sep.progress = Math.round((doneCount / sep.checklist.length) * 100);
  openSeparationExitModal(sepId);
  renderAll();
  showToast(`Exit clearance updated: ${sep.progress}% complete`);
}

function finalizeSeparationSignOff(sepId) {
  const sep = MOCK.separations.find(x => x.id === sepId);
  if (!sep) return;
  sep.status = 'Completed';
  sep.progress = 100;
  closeModal();
  renderAll();
  showToast(`Final exit sign-off completed for ${sep.employee}`, 'success');
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

// ==================== MAIN DASHBOARD RENDERER ====================
function renderDashboard() {
  const u = MOCK.currentUser;

  // Selected gym filter context
  const selectedGymObj = u.selectedGym !== 'all' ? u.gyms.find(g => g.id === u.selectedGym) : null;
  const gymBranch = selectedGymObj ? selectedGymObj.branch : null;

  // Datasets filtered by selected branch
  const allEmps = gymBranch ? MOCK.employees.filter(e => e.gym === gymBranch) : MOCK.employees;
  const pendingReqs = MOCK.requests.filter(r => r.status === 'Pending HR Review' && (!gymBranch || r.gym === gymBranch));
  const openVacancies = MOCK.vacancies.filter(v => v.status === 'Open' && (!gymBranch || v.gym === gymBranch));
  const pendingVacancies = MOCK.vacancyRequests.filter(r => r.status === 'Pending' && (!gymBranch || r.gym === gymBranch));
  const candInPipeline = MOCK.candidates.filter(c => c.stage !== 'Rejected' && c.stage !== 'Hired').length;
  const expiringEvents = MOCK.events.filter(e => e.type === 'Document Expiry' || e.type === 'Contract Expiry');
  const activeNewComers = MOCK.newComers.filter(n => n.progress < 100);
  const activeSeparations = MOCK.separations.filter(s => s.status !== 'Completed' && (!gymBranch || s.gym === gymBranch));

  // Payroll health & pending adjustments
  const pendingDeductions = [];
  MOCK.payrollItems.forEach(p => {
    (p.deductionLines || []).forEach(d => {
      if (d.status === 'Pending' && (!gymBranch || p.gym === gymBranch)) {
        pendingDeductions.push({ ...d, employeeName: p.name, employeeId: p.employeeId, gym: p.gym });
      }
    });
  });

  // Today's & this week's scheduled interviews
  const interviewsList = MOCK.interviews.filter(iv => !gymBranch || iv.gym === gymBranch);
  const candidatesAwaitingDecision = MOCK.candidates.filter(c => ['Second Interview', 'First Interview'].includes(c.stage) && (!gymBranch || c.form?.gymPref === gymBranch));

  // HR Priority Approvals Queue aggregation
  const actionQueue = [
    ...pendingReqs.map(r => ({
      id: r.id,
      category: 'request',
      title: `${r.employee} — ${r.type}`,
      badge: r.type,
      badgeColor: r.type === 'Resignation' ? 'badge-red' : r.type === 'Leave Early' ? 'badge-orange' : 'badge-yellow',
      desc: `${r.gym} · BM Decision: ${r.bmDecision} (${r.bmComment || 'Reviewed'}) · For: ${r.requestedDate}`,
      urgency: r.type === 'Resignation' || r.type === 'Leave Early' ? 'high' : 'normal',
      actionLabel: 'Decide',
      actionClick: `openRequestDecision('${r.id}')`
    })),
    ...pendingVacancies.map(v => ({
      id: v.id,
      category: 'vacancy',
      title: `Headcount Request: ${v.position}`,
      badge: 'BM Request',
      badgeColor: 'badge-purple',
      desc: `${v.gym} · Submitted by ${v.submittedBy} · Reason: ${v.reason || 'Expansion'}`,
      urgency: 'high',
      actionLabel: 'Review',
      actionClick: `openVacancyRequestModal('${v.id}')`
    })),
    ...expiringEvents.map(e => ({
      id: e.id,
      category: 'compliance',
      title: e.title,
      badge: e.type === 'Document Expiry' ? 'Cert Expiry' : 'Contract Ending',
      badgeColor: 'badge-red',
      desc: `${e.date} · ${e.detail}`,
      urgency: 'high',
      actionLabel: 'Resolve',
      actionClick: `openComplianceModal('${e.id}')`
    })),
    ...pendingDeductions.slice(0, 2).map(d => ({
      id: d.id,
      category: 'payroll',
      title: `Payroll Deduction: ${d.employeeName}`,
      badge: 'EGP ' + d.amount,
      badgeColor: 'badge-yellow',
      desc: `${d.gym} · ${d.label} — ${d.reason}`,
      urgency: 'normal',
      actionLabel: 'Adjust',
      actionClick: `openPayrollDeductionModal('${d.employeeId}', '${d.id}')`
    }))
  ];

  const filteredQueue = actionQueue.filter(item => {
    if (_dashAlertFilter === 'all') return true;
    return item.category === _dashAlertFilter;
  });

  // Daily agenda counts
  const totalAgenda = _hrDailyTodos.length;
  const doneAgenda = _hrDailyTodos.filter(t => t.done).length;

  // 6 Executive HR Metric Cards
  const kpis = [
    { label: 'Pending HR Approvals', val: pendingReqs.length + pendingVacancies.length, sub: `${pendingReqs.length} reqs · ${pendingVacancies.length} vacancies`, color: pendingReqs.length ? 'red' : 'green', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', click: `_dashAlertFilter='all';renderAll()` },
    { label: 'Interviews & Pipeline', val: interviewsList.length, sub: `${candInPipeline} active in pipeline`, color: 'blue', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', click: `_dashMiddleTab='interviews';renderAll()` },
    { label: 'Urgent Compliance', val: expiringEvents.length, sub: 'contracts & certs due', color: expiringEvents.length ? 'orange' : 'green', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z', click: `_dashAlertFilter='compliance';renderAll()` },
    { label: 'Active Onboarding', val: activeNewComers.length, sub: 'in 30-day checklist', color: 'green', icon: 'M13 7l5 5-5 5M7 7l5 5-5 5', click: `_dashRightTab='onboarding';renderAll()` },
    { label: 'Pending Offboardings', val: activeSeparations.length, sub: 'exit clearances pending', color: 'purple', icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', click: `_dashRightTab='exits';renderAll()` },
    { label: 'Payroll Adjustments', val: pendingDeductions.length, sub: 'August cycle review', color: pendingDeductions.length ? 'yellow' : 'brand', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', click: `navigateTo('payroll')` },
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

    <!-- Row 0: HR Manager Operational Header & Agenda Progress -->
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
        <!-- Daily HR Agenda Tracker -->
        <div class="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] cursor-pointer hover:bg-emerald-100/70 transition-colors" onclick="_dashRightTab='todos';renderAll()" title="View today's HR tasks">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span class="font-semibold text-emerald-900">Today's Agenda:</span>
          <span class="text-emerald-700 font-bold">${doneAgenda}/${totalAgenda} done</span>
        </div>
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

    <!-- Row 2: 3-Column Zero-Scroll Viewport Command Center (fills remaining height) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 min-h-0">

      <!-- ================= COLUMN 1 (4 cols / ~33%): HR Approvals & Decisions Queue ================= -->
      <div class="lg:col-span-4 bg-white rounded-lg border border-charcoal-200 overflow-hidden flex flex-col min-h-0 shadow-sm">
        <div class="px-2.5 py-1.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/70 flex-shrink-0">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <p class="bento-label text-charcoal-800">DECISIONS & APPROVALS</p>
            <span class="badge badge-red text-[8px] px-1 py-0">${actionQueue.length}</span>
          </div>
          <!-- Queue Filters -->
          <div class="flex items-center gap-1 text-[9px]">
            <button onclick="_dashAlertFilter='all';renderAll()" class="px-1.5 py-0.5 rounded ${_dashAlertFilter==='all'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">All</button>
            <button onclick="_dashAlertFilter='request';renderAll()" class="px-1.5 py-0.5 rounded ${_dashAlertFilter==='request'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">Reqs (${pendingReqs.length})</button>
            <button onclick="_dashAlertFilter='vacancy';renderAll()" class="px-1.5 py-0.5 rounded ${_dashAlertFilter==='vacancy'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">Vac (${pendingVacancies.length})</button>
            <button onclick="_dashAlertFilter='compliance';renderAll()" class="px-1.5 py-0.5 rounded ${_dashAlertFilter==='compliance'?'bg-charcoal-800 text-white font-semibold':'text-charcoal-500 hover:bg-charcoal-100'}">Certs (${expiringEvents.length})</button>
          </div>
        </div>

        <div class="divide-y divide-charcoal-50 flex-1 min-h-0 overflow-y-auto">
          ${filteredQueue.map(item => `
            <div class="p-2 flex items-center justify-between gap-1.5 hover:bg-charcoal-50/80 transition-colors cursor-pointer group" onclick="${item.actionClick}">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="badge ${item.badgeColor} text-[8px] flex-shrink-0">${item.badge}</span>
                  <p class="text-[10px] font-semibold text-charcoal-900 truncate leading-tight group-hover:text-brand-700 transition-colors">${item.title}</p>
                </div>
                <p class="text-[9px] text-charcoal-500 truncate leading-tight mt-0.5">${item.desc}</p>
              </div>
              <button onclick="event.stopPropagation();${item.actionClick}" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                ${item.actionLabel}
              </button>
            </div>
          `).join('')}

          ${filteredQueue.length === 0 ? `
            <div class="p-6 text-center flex flex-col items-center justify-center h-full">
              <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>
              <p class="text-xs font-semibold text-charcoal-800">Clear queue!</p>
              <p class="text-[9px] text-charcoal-400 mt-0.5">No pending approvals matching this filter.</p>
            </div>
          ` : ''}
        </div>

        <div class="px-2.5 py-1 bg-charcoal-50/70 border-t border-charcoal-100 flex items-center justify-between text-[9px] text-charcoal-500 flex-shrink-0">
          <span>${pendingReqs.length} escalated requests awaiting HR final decision</span>
          <button onclick="navigateTo('requests')" class="text-brand-600 font-semibold hover:underline">Requests Module →</button>
        </div>
      </div>

      <!-- ================= COLUMN 2 (5 cols / ~42%): Candidate Interviews & Hiring Decision Hub ================= -->
      <div class="lg:col-span-5 bg-white rounded-lg border border-charcoal-200 overflow-hidden flex flex-col min-h-0 shadow-sm">
        <!-- Sub-Tabs Header -->
        <div class="px-2.5 pt-1.5 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/70 flex-shrink-0">
          <div class="flex items-center gap-1">
            <button onclick="_dashMiddleTab='interviews';renderAll()" class="px-2 py-1 rounded-t text-[10px] font-semibold border-b-2 transition-colors ${_dashMiddleTab==='interviews'?'border-brand-600 text-brand-700 bg-white':'border-transparent text-charcoal-500 hover:text-charcoal-800'}">
              Interviews (${interviewsList.length})
            </button>
            <button onclick="_dashMiddleTab='decisions';renderAll()" class="px-2 py-1 rounded-t text-[10px] font-semibold border-b-2 transition-colors ${_dashMiddleTab==='decisions'?'border-brand-600 text-brand-700 bg-white':'border-transparent text-charcoal-500 hover:text-charcoal-800'}">
              Awaiting Verdict (${candidatesAwaitingDecision.length})
            </button>
            <button onclick="_dashMiddleTab='waiting';renderAll()" class="px-2 py-1 rounded-t text-[10px] font-semibold border-b-2 transition-colors ${_dashMiddleTab==='waiting'?'border-brand-600 text-brand-700 bg-white':'border-transparent text-charcoal-500 hover:text-charcoal-800'}">
              Waiting Pool (${MOCK.waitingList.length})
            </button>
          </div>
          <button onclick="openNewInterview()" class="btn btn-sm btn-secondary text-[9px] h-5 px-1.5" title="Schedule an interview">
            + Schedule
          </button>
        </div>

        <div class="divide-y divide-charcoal-50 flex-1 min-h-0 overflow-y-auto">
          <!-- Sub-Tab 1: Scheduled Interviews -->
          ${_dashMiddleTab === 'interviews' ? interviewsList.map(iv => {
            const cand = MOCK.candidates.find(c => c.name === iv.candidate);
            const stars = cand?.rating ? '★'.repeat(cand.rating) + '☆'.repeat(Math.max(0, 5 - cand.rating)) : '—';
            return `
              <div class="p-2 hover:bg-charcoal-50/80 transition-colors cursor-pointer group" onclick="openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')">
                <div class="flex items-start justify-between gap-1.5">
                  <div class="flex items-start gap-2 min-w-0">
                    <div class="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      ${iv.candidate.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <p class="text-[10px] font-bold text-charcoal-900 truncate group-hover:text-brand-700">${iv.candidate}</p>
                        <span class="badge ${iv.type==='Video'?'badge-blue':'badge-purple'} text-[7px]">${iv.type}</span>
                        <span class="text-[9px] text-amber-500">${stars}</span>
                      </div>
                      <p class="text-[9px] text-charcoal-600 mt-0.5 truncate">${iv.position} · ${iv.gym}</p>
                      <p class="text-[8px] text-charcoal-400 mt-0.5">
                        <span class="font-semibold text-charcoal-700">${iv.date} at ${iv.time}</span> · Interviewer: ${iv.interviewer}
                      </p>
                    </div>
                  </div>
                  <button onclick="event.stopPropagation();openCandidateInterviewDossier('${cand?.id || ''}', '${iv.id}')" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                    Review & Decide
                  </button>
                </div>
              </div>
            `;
          }).join('') : ''}

          <!-- Sub-Tab 2: Candidates Awaiting HR Verdict -->
          ${_dashMiddleTab === 'decisions' ? candidatesAwaitingDecision.map(c => `
            <div class="p-2 hover:bg-charcoal-50/80 transition-colors cursor-pointer group" onclick="openCandidateInterviewDossier('${c.id}')">
              <div class="flex items-start justify-between gap-1.5">
                <div class="flex items-start gap-2 min-w-0">
                  <div class="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    ${c.name.split(' ').map(w => w[0]).join('')}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <p class="text-[10px] font-bold text-charcoal-900 truncate group-hover:text-brand-700">${c.name}</p>
                      <span class="badge badge-purple text-[7px]">${c.stage}</span>
                      <span class="text-[9px] text-amber-500 font-semibold">${c.rating}/5 ★</span>
                    </div>
                    <p class="text-[9px] text-charcoal-600 mt-0.5 truncate">${c.position} · Exp: ${c.form?.expYears || 3} yrs · Exp. Sal: EGP ${(c.form?.salaryExp || 10000).toLocaleString()}</p>
                    <p class="text-[8px] text-charcoal-400 mt-0.5 truncate">Notes: ${c.screen?.notes || 'Screening passed'}</p>
                  </div>
                </div>
                <button onclick="event.stopPropagation();openCandidateInterviewDossier('${c.id}')" class="btn btn-sm btn-primary text-[9px] h-6 px-2 flex-shrink-0">
                  Evaluate & Decide
                </button>
              </div>
            </div>
          `).join('') : ''}

          <!-- Sub-Tab 3: Talent Waiting List -->
          ${_dashMiddleTab === 'waiting' ? MOCK.waitingList.map(w => `
            <div class="p-2 hover:bg-charcoal-50/80 transition-colors flex items-center justify-between gap-1.5">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-[10px] font-bold text-charcoal-900">${w.name}</p>
                  <span class="badge badge-brand text-[7px]">${w.position}</span>
                </div>
                <p class="text-[9px] text-charcoal-500 truncate mt-0.5">${w.note}</p>
                <div class="flex gap-1 mt-1">${(w.skills || []).map(s => `<span class="badge badge-gray text-[7px]">${s}</span>`).join('')}</div>
              </div>
              <button onclick="assignWaitingToGym('${w.id}')" class="btn btn-sm btn-secondary text-[9px] h-6 px-2 flex-shrink-0">
                Assign Gym
              </button>
            </div>
          `).join('') : ''}

          ${(_dashMiddleTab === 'interviews' && interviewsList.length === 0) ? `
            <div class="p-6 text-center text-xs text-charcoal-400">No interviews scheduled for this branch.</div>
          ` : ''}
        </div>

        <div class="px-2.5 py-1 bg-charcoal-50/70 border-t border-charcoal-100 flex items-center justify-between text-[9px] text-charcoal-500 flex-shrink-0">
          <span>Click any candidate to open full profile, interview scores & decision tools</span>
          <button onclick="navigateTo('recruitment')" class="text-brand-600 font-semibold hover:underline">Recruitment Funnel →</button>
        </div>
      </div>

      <!-- ================= COLUMN 3 (3 cols / ~25%): Employee Lifecycle & Daily HR Agenda ================= -->
      <div class="lg:col-span-3 flex flex-col gap-2 min-h-0">

        <!-- Top Panel: Agenda / Onboarding / Exits Tabs -->
        <div class="bg-white rounded-lg border border-charcoal-200 overflow-hidden flex flex-col flex-1 min-h-0 shadow-sm">
          <div class="px-2 pt-1 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-50/70 flex-shrink-0">
            <div class="flex items-center gap-1">
              <button onclick="_dashRightTab='todos';renderAll()" class="px-1.5 py-1 rounded-t text-[10px] font-semibold border-b-2 transition-colors ${_dashRightTab==='todos'?'border-brand-600 text-brand-700 bg-white':'border-transparent text-charcoal-500 hover:text-charcoal-800'}">
                Daily Agenda (${doneAgenda}/${totalAgenda})
              </button>
              <button onclick="_dashRightTab='onboarding';renderAll()" class="px-1.5 py-1 rounded-t text-[10px] font-semibold border-b-2 transition-colors ${_dashRightTab==='onboarding'?'border-brand-600 text-brand-700 bg-white':'border-transparent text-charcoal-500 hover:text-charcoal-800'}">
                Onboard (${activeNewComers.length})
              </button>
              <button onclick="_dashRightTab='exits';renderAll()" class="px-1.5 py-1 rounded-t text-[10px] font-semibold border-b-2 transition-colors ${_dashRightTab==='exits'?'border-brand-600 text-brand-700 bg-white':'border-transparent text-charcoal-500 hover:text-charcoal-800'}">
                Exits (${activeSeparations.length})
              </button>
            </div>
            ${_dashRightTab === 'todos' ? `
              <button onclick="openAddDailyTodoModal()" class="text-brand-600 hover:text-brand-800 text-[9px] font-semibold px-1" title="Add quick task">
                + Add
              </button>
            ` : ''}
          </div>

          <div class="divide-y divide-charcoal-50 flex-1 min-h-0 overflow-y-auto">
            <!-- Sub-tab 1: Interactive Daily Agenda Checklist -->
            ${_dashRightTab === 'todos' ? _hrDailyTodos.map(todo => `
              <div class="p-2 flex items-start justify-between gap-1.5 hover:bg-charcoal-50/70 transition-colors">
                <label class="flex items-start gap-1.5 cursor-pointer min-w-0 flex-1">
                  <input type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleHrDailyTodo('${todo.id}')" class="mt-0.5 w-3.5 h-3.5 text-brand-600 rounded border-charcoal-300">
                  <div class="min-w-0">
                    <p class="text-[10px] font-medium leading-tight ${todo.done ? 'line-through text-charcoal-400' : 'text-charcoal-800'}">${todo.title}</p>
                    <span class="inline-block mt-0.5 text-[8px] font-semibold text-charcoal-400 uppercase tracking-wider">${todo.category}</span>
                  </div>
                </label>
                ${todo.action ? `
                  <button onclick="${todo.action}" class="btn btn-sm btn-secondary text-[8px] h-5 px-1.5 flex-shrink-0">
                    ${todo.cta || 'Open'}
                  </button>
                ` : ''}
              </div>
            `).join('') : ''}

            <!-- Sub-tab 2: Onboarding (Newcomers 30-day checklist) -->
            ${_dashRightTab === 'onboarding' ? activeNewComers.map(nc => `
              <div class="p-2 hover:bg-charcoal-50/80 transition-colors cursor-pointer" onclick="openNewcomerChecklistModal('${nc.id}')">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[10px] font-bold text-charcoal-900 truncate">${nc.name}</span>
                  <span class="text-[9px] font-bold text-brand-600">${nc.progress}%</span>
                </div>
                <div class="w-full bg-charcoal-100 h-1 rounded-full overflow-hidden mb-1">
                  <div class="h-full bg-brand-600 rounded-full" style="width: ${nc.progress}%"></div>
                </div>
                <div class="flex items-center justify-between text-[8px] text-charcoal-400">
                  <span>${nc.position}</span>
                  <span class="text-brand-700 font-medium">Checklist →</span>
                </div>
              </div>
            `).join('') : ''}

            <!-- Sub-tab 3: Offboarding & Separations -->
            ${_dashRightTab === 'exits' ? activeSeparations.map(sep => `
              <div class="p-2 hover:bg-charcoal-50/80 transition-colors cursor-pointer" onclick="openSeparationExitModal('${sep.id}')">
                <div class="flex items-center justify-between mb-0.5">
                  <span class="text-[10px] font-bold text-charcoal-900 truncate">${sep.employee}</span>
                  <span class="badge ${sep.status==='Completed'?'badge-green':'badge-yellow'} text-[7px]">${sep.status}</span>
                </div>
                <p class="text-[9px] text-charcoal-500 truncate">${sep.gym} · Last day: ${sep.lastDay}</p>
                <div class="flex items-center justify-between text-[8px] text-charcoal-400 mt-1">
                  <span>${sep.reason}</span>
                  <span class="text-purple-700 font-medium">Sign-off →</span>
                </div>
              </div>
            `).join('') : ''}
          </div>
        </div>

        <!-- Bottom Panel: HR Quick Workflows Launchpad (Compact enterprise 2x3 grid) -->
        <div class="bg-white rounded-lg border border-charcoal-200 p-2 flex-shrink-0 shadow-sm">
          <div class="flex items-center justify-between mb-1.5">
            <p class="bento-label text-charcoal-700">HR QUICK WORKFLOWS</p>
            <span class="text-[8px] text-charcoal-400">Direct tools</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <button onclick="openAddEmployee()" class="btn btn-sm btn-primary justify-start text-[9px] h-6 px-1.5">
              <svg class="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              <span class="truncate">+ Add Employee</span>
            </button>
            <button onclick="openNewVacancy()" class="btn btn-sm btn-secondary justify-start text-[9px] h-6 px-1.5">
              <svg class="w-3 h-3 text-brand-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <span class="truncate">+ Post Vacancy</span>
            </button>
            <button onclick="openNewRequest()" class="btn btn-sm btn-secondary justify-start text-[9px] h-6 px-1.5">
              <svg class="w-3 h-3 text-blue-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span class="truncate">+ New Request</span>
            </button>
            <button onclick="openNewInterview()" class="btn btn-sm btn-secondary justify-start text-[9px] h-6 px-1.5">
              <svg class="w-3 h-3 text-purple-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span class="truncate">Schedule IV</span>
            </button>
            <button onclick="openComposeAnnouncement()" class="btn btn-sm btn-secondary justify-start text-[9px] h-6 px-1.5">
              <svg class="w-3 h-3 text-orange-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
              <span class="truncate">Announcement</span>
            </button>
            <button onclick="openBulkImport()" class="btn btn-sm btn-secondary justify-start text-[9px] h-6 px-1.5">
              <svg class="w-3 h-3 text-emerald-600 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span class="truncate">Bulk Import</span>
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