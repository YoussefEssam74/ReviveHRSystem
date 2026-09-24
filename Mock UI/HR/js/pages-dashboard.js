// ==================== HR COMMAND CENTER DASHBOARD ====================
let _dashSectionFilter = 'all';

function renderGymSelector() {
  const u = MOCK.currentUser;
  return `<div class="relative">
    <select onchange="setGymFilter(this.value)" class="form-select w-auto bg-white border border-charcoal-200 rounded-lg text-xs py-1.5 px-3 font-semibold text-charcoal-800 shadow-2xs hover:border-charcoal-300 transition-colors">
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

// ==================== FAST ACTION: CREATE NEW ACCOUNT MODAL ====================
function openCreateAccountModal() {
  const staff = MOCK.employees;
  openModal('Create New Employee Account', `
    <div class="space-y-4">
      <div class="bg-charcoal-50 p-3 rounded-xl border border-charcoal-200">
        <label class="block text-xs font-bold text-charcoal-700 mb-1">Select Employee</label>
        <select id="acc-emp-select" onchange="autoFillAccountDetails(this.value)" class="form-select w-full text-xs">
          <option value="">-- Choose Employee --</option>
          ${staff.map(e => `<option value="${e.id}">${e.name} (${e.position} · ${e.gym})</option>`).join('')}
        </select>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Username / Work Email</label>
          <input type="email" id="acc-email" class="form-input w-full text-xs" placeholder="name@revive.com" />
        </div>
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Initial Password</label>
          <div class="flex gap-1.5">
            <input type="text" id="acc-pass" class="form-input w-full text-xs font-mono" value="Revive@2026" />
            <button type="button" onclick="document.getElementById('acc-pass').value='Revive#'+Math.floor(1000+Math.random()*9000)" class="btn btn-secondary text-xs px-2" title="Generate Random">↺</button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">System Role</label>
          <select id="acc-role" class="form-select w-full text-xs">
            <option value="Staff">Staff / Trainer</option>
            <option value="Receptionist">Receptionist / Front Desk</option>
            <option value="Branch Manager">Branch Manager</option>
            <option value="HR Specialist">HR Specialist</option>
            <option value="HR Manager">HR Manager</option>
          </select>
        </div>
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Branch Scope</label>
          <select id="acc-branch" class="form-select w-full text-xs">
            <option value="all">All Branches</option>
            <option value="Nasr City">Nasr City</option>
            <option value="Heliopolis">Heliopolis</option>
            <option value="6th October">6th October</option>
          </select>
        </div>
      </div>

      <div class="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-[11px] text-emerald-800">
        Account credentials will be logged and an activation SMS/Email sent to the employee.
      </div>
    </div>
  `, {
    wide: false,
    footer: `
      <button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="submitNewAccount()" class="btn btn-sm btn-primary">Create Account</button>
    `
  });
}

function autoFillAccountDetails(empId) {
  const emp = MOCK.employees.find(e => e.id === empId);
  if (!emp) return;
  const emailInput = document.getElementById('acc-email');
  const roleSelect = document.getElementById('acc-role');
  const branchSelect = document.getElementById('acc-branch');

  if (emailInput) emailInput.value = emp.email || `${emp.name.toLowerCase().replace(/\s+/g, '.')}@revive.com`;
  if (roleSelect) {
    if (emp.position.includes('Manager')) roleSelect.value = 'Branch Manager';
    else if (emp.position.includes('Reception')) roleSelect.value = 'Receptionist';
    else roleSelect.value = 'Staff';
  }
  if (branchSelect) branchSelect.value = emp.gym || 'all';
}

function submitNewAccount() {
  const empId = document.getElementById('acc-emp-select')?.value;
  const email = document.getElementById('acc-email')?.value;
  const role = document.getElementById('acc-role')?.value;
  if (!empId) {
    showToast('Please select an employee first', 'warning');
    return;
  }
  const emp = MOCK.employees.find(e => e.id === empId);
  closeModal();
  showToast(`Account created for ${emp ? emp.name : 'Employee'} (${role})! Credentials dispatched.`, 'success');
}

// ==================== FAST ACTION: CHANGE PASSWORD & ACCESS MODAL ====================
function openChangePasswordAccessModal(empId) {
  const staff = MOCK.employees;
  const target = (empId ? staff.find(e => e.id === empId) : null) || staff[0];

  openModal('Change Password & System Access', `
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-bold text-charcoal-700 mb-1">Select Employee</label>
        <select id="pwd-emp-select" class="form-select w-full text-xs" onchange="openChangePasswordAccessModal(this.value)">
          ${staff.map(e => `<option value="${e.id}" ${e.id===target.id?'selected':''}>${e.name} — ${e.position} (${e.gym})</option>`).join('')}
        </select>
      </div>

      <div class="p-3 bg-charcoal-50 rounded-xl border border-charcoal-200 flex items-center justify-between text-xs">
        <div>
          <p class="font-bold text-charcoal-900">${target.name}</p>
          <p class="text-charcoal-500 text-[11px]">${target.email || target.name.toLowerCase().replace(/\s+/g,'.')+'@revive.com'} · ${target.gym}</p>
        </div>
        <span class="badge ${target.status==='Active'?'badge-green':'badge-gray'} text-[10px]">${target.status}</span>
      </div>

      <div class="space-y-1.5">
        <label class="block text-xs font-semibold text-charcoal-700">Set New Password</label>
        <div class="flex gap-2">
          <input type="text" id="pwd-new-pass" class="form-input flex-1 text-xs font-mono" placeholder="Enter new password" value="Temp#${Math.floor(1000+Math.random()*9000)}" />
          <button type="button" onclick="document.getElementById('pwd-new-pass').value='Pass#'+Math.floor(10000+Math.random()*90000)" class="btn btn-secondary text-xs px-2.5">Generate</button>
        </div>
      </div>

      <div class="space-y-1.5 pt-1">
        <label class="block text-xs font-semibold text-charcoal-700">Access Permissions</label>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg cursor-pointer hover:bg-charcoal-100/60">
            <input type="checkbox" checked class="form-checkbox text-brand-600 rounded">
            <span>Portal Login Access</span>
          </label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg cursor-pointer hover:bg-charcoal-100/60">
            <input type="checkbox" checked class="form-checkbox text-brand-600 rounded">
            <span>Submit Requests</span>
          </label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg cursor-pointer hover:bg-charcoal-100/60">
            <input type="checkbox" ${target.position.includes('Manager')?'checked':''} class="form-checkbox text-brand-600 rounded">
            <span>Approve Team Requests</span>
          </label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg cursor-pointer hover:bg-charcoal-100/60">
            <input type="checkbox" ${target.position.includes('Manager')?'checked':''} class="form-checkbox text-brand-600 rounded">
            <span>View Attendance Logs</span>
          </label>
        </div>
      </div>
    </div>
  `, {
    wide: false,
    footer: `
      <button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="submitPasswordChange('${target.id}')" class="btn btn-sm btn-primary">Update Password & Access</button>
    `
  });
}

function submitPasswordChange(empId) {
  const emp = MOCK.employees.find(e => e.id === empId);
  closeModal();
  showToast(`Password & permissions updated for ${emp ? emp.name : 'Employee'}!`, 'success');
}

// ==================== FAST ACTION: CREATE HIRING FORM MODAL ====================
function openCreateHiringFormModal() {
  openModal('Create New Hiring / Application Form', `
    <div class="space-y-3.5">
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Position Title</label>
          <input type="text" id="hf-title" class="form-input w-full text-xs" placeholder="e.g. Senior Fitness Coach" value="Fitness Coach" />
        </div>
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Target Gym Branch</label>
          <select id="hf-gym" class="form-select w-full text-xs">
            <option value="All Branches">All Branches</option>
            <option value="Nasr City">Nasr City</option>
            <option value="Heliopolis">Heliopolis</option>
            <option value="6th October">6th October</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Employment Type</label>
          <select id="hf-type" class="form-select w-full text-xs">
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract / Freelance">Contract / Freelance</option>
          </select>
        </div>
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Target Headcount</label>
          <input type="number" id="hf-headcount" class="form-input w-full text-xs" value="2" min="1" />
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-charcoal-700 mb-1.5">Required Application Fields</label>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked disabled class="form-checkbox text-brand-600"><span>Full Name & Phone</span></label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>CV / Resume Upload</span></label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>Years of Experience</span></label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>Expected Salary</span></label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>Fitness Certifications</span></label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>Shift Availability</span></label>
        </div>
      </div>
    </div>
  `, {
    wide: false,
    footer: `
      <button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="submitHiringForm()" class="btn btn-sm btn-primary">Publish Hiring Form</button>
    `
  });
}

function submitHiringForm() {
  const title = document.getElementById('hf-title')?.value || 'New Position';
  const gym = document.getElementById('hf-gym')?.value || 'All Branches';
  closeModal();
  showToast(`Hiring form published for "${title}" (${gym})! Application link generated.`, 'success');
}

// ==================== FAST ACTION: CREATE EVALUATION FORM MODAL ====================
function openCreateEvaluationFormModal() {
  openModal('Create New Evaluation Form', `
    <div class="space-y-3.5">
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Evaluation Title</label>
          <input type="text" id="ef-title" class="form-input w-full text-xs" placeholder="e.g. Q3 Performance Review" value="Quarterly Performance Review" />
        </div>
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Evaluation Cycle</label>
          <select id="ef-cycle" class="form-select w-full text-xs">
            <option value="Q3 2026">Q3 2026 Periodic Review</option>
            <option value="90-Day Probation">90-Day Probation Review</option>
            <option value="Annual Appraisal">Annual Appraisal</option>
            <option value="Monthly KPI">Monthly KPI Review</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Target Department / Role</label>
          <select id="ef-role" class="form-select w-full text-xs">
            <option value="All Roles">All Roles</option>
            <option value="Trainers">Fitness Trainers & Coaches</option>
            <option value="Reception">Front Desk & Reception</option>
            <option value="Maintenance">Maintenance & Operations</option>
            <option value="Branch Managers">Branch Managers</option>
          </select>
        </div>
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Evaluating Manager</label>
          <select id="ef-evaluator" class="form-select w-full text-xs">
            <option value="Branch Manager + HR">Branch Manager + HR Manager</option>
            <option value="HR Only">HR Department Only</option>
            <option value="Self + Manager">Self-Assessment + Manager</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-charcoal-700 mb-1.5">Evaluation Competencies</label>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>Attendance & Punctuality</span></label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>Job Knowledge & Skills</span></label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>Member Satisfaction & Service</span></label>
          <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg"><input type="checkbox" checked class="form-checkbox text-brand-600"><span>Teamwork & Initiative</span></label>
        </div>
      </div>
    </div>
  `, {
    wide: false,
    footer: `
      <button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="submitEvaluationForm()" class="btn btn-sm btn-primary">Create & Assign Form</button>
    `
  });
}

function submitEvaluationForm() {
  const title = document.getElementById('ef-title')?.value || 'Evaluation Form';
  closeModal();
  showToast(`Evaluation form "${title}" created and scheduled for assignment!`, 'success');
}

// ==================== GYMS OVERVIEW MODAL ====================
function openGymsOverviewModal() {
  openModal('All Gym Branches Overview', `
    <div class="space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        ${MOCK.gymList.map(g => {
          const openVac = MOCK.vacancies.filter(v => v.gym === g.branch && v.status === 'Open').length;
          const pending = MOCK.requests.filter(r => r.gym === g.branch && r.status === 'Pending HR Review').length;
          return `
            <div class="bg-charcoal-50 border border-charcoal-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <span class="badge badge-brand text-[9px] mb-1 inline-block">${g.name}</span>
                <h4 class="text-sm font-bold text-charcoal-900">${g.branch} Branch</h4>
                <div class="mt-2.5 space-y-1 text-xs text-charcoal-600">
                  <p class="flex items-center justify-between"><span>Employees:</span> <b class="text-charcoal-900">${g.employees} Staff</b></p>
                  <p class="flex items-center justify-between"><span>Open Vacancies:</span> <b class="text-charcoal-900">${openVac}</b></p>
                  <p class="flex items-center justify-between"><span>Pending Requests:</span> <b class="${pending>0?'text-amber-600 font-bold':'text-charcoal-900'}">${pending}</b></p>
                </div>
              </div>
              <button onclick="closeModal();setGymFilter('${g.id}')" class="btn btn-sm btn-secondary w-full mt-3 text-xs">Filter to ${g.branch}</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `, { wide: true, footer: '<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>' });
}

// ==================== QUICK DECISION SHORTCUTS ====================
function quickApproveRequest(reqId) {
  applyRequestDecision(reqId, 'approve', 'Approved via HR Manager Dashboard');
}

function quickRejectRequest(reqId) {
  applyRequestDecision(reqId, 'reject', 'Declined via HR Manager Dashboard');
}

function quickApproveVacancy(vrId) {
  approveVacancyRequest(vrId);
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

  const stars = (n) => '★'.repeat(Math.max(0, Math.min(5, n || 0))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, n || 0)));
  const stages = ['Applied', 'Screening', 'First Interview', 'Second Interview', 'Accepted', 'Hired'];
  const curIdx = stages.indexOf(c.stage);
  const nextStage = curIdx >= 0 && curIdx < stages.length - 1 ? stages[curIdx + 1] : null;

  const content = `
    <div class="space-y-4">
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
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="bg-white border border-charcoal-200 rounded-xl p-3 space-y-2.5">
          <p class="text-[10px] font-bold text-charcoal-500 uppercase tracking-wider">Qualifications & Expectations</p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-charcoal-50 p-2 rounded-lg">
              <span class="text-charcoal-400 block text-[9px] uppercase">Experience</span>
              <span class="font-semibold text-charcoal-800">${f.expYears ? `${f.expYears} Years` : '—'}</span>
            </div>
            <div class="bg-charcoal-50 p-2 rounded-lg">
              <span class="text-charcoal-400 block text-[9px] uppercase">Expected Salary</span>
              <span class="font-semibold text-brand-700">${f.salaryExp ? `EGP ${f.salaryExp.toLocaleString()}` : 'Negotiable'}</span>
            </div>
          </div>
          <div>
            <span class="text-[9px] font-bold text-charcoal-400 uppercase tracking-wider block mb-1">Skills</span>
            <div class="flex flex-wrap gap-1">
              ${(f.skills || ['Fitness Assessment', 'Customer Service']).map(s => `<span class="badge badge-brand text-[9px]">${s}</span>`).join('')}
            </div>
          </div>
        </div>

        <div class="bg-white border border-charcoal-200 rounded-xl p-3 space-y-2.5">
          <p class="text-[10px] font-bold text-charcoal-500 uppercase tracking-wider">Evaluation History</p>
          <div class="bg-charcoal-50 p-2.5 rounded-lg text-xs space-y-0.5 border border-charcoal-100">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-charcoal-800">Technical Interview</span>
              <span class="badge ${c.iv1?.verdict==='Pass'?'badge-green':c.iv1?.verdict==='Fail'?'badge-red':'badge-blue'} text-[8px]">${c.iv1?.verdict || matchingIv?.status || 'Scheduled'}</span>
            </div>
            <p class="text-charcoal-600 text-[11px] mt-0.5">${c.iv1?.notes || (matchingIv ? `Scheduled on ${matchingIv.date} at ${matchingIv.time} (${matchingIv.type}) with ${matchingIv.interviewer}.` : 'Pending session review.')}</p>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2 border-t border-charcoal-150">
        <button onclick="closeModal()" class="btn btn-sm btn-secondary text-xs">Close</button>
        ${nextStage ? `
          <button onclick="advanceCandidateStage('${c.id}', '${nextStage}')" class="btn btn-sm btn-primary text-xs">
            Pass to ${nextStage} →
          </button>
        ` : ''}
        ${c.stage !== 'Hired' ? `
          <button onclick="hireCandidateDirectly('${c.id}')" class="btn btn-sm btn-success text-xs">
            Make Job Offer & Hire
          </button>
        ` : ''}
      </div>
    </div>
  `;

  openModal(`Candidate Evaluation: ${c.name}`, content, { wide: true });
}

function advanceCandidateStage(cid, nextStage) {
  const c = MOCK.candidates.find(x => x.id === cid);
  if (!c) return;
  c.stage = nextStage;
  closeModal();
  renderAll();
  showToast(`Candidate ${c.name} advanced to ${nextStage}!`, 'success');
}

function hireCandidateDirectly(cid) {
  const c = MOCK.candidates.find(x => x.id === cid);
  if (!c) return;
  c.stage = 'Hired';
  const newEmp = {
    id: 'RV-00' + (140 + MOCK.employees.length),
    name: c.name,
    position: c.position,
    level: 'Junior',
    gym: c.form?.gymPref || 'Nasr City',
    status: 'Active',
    initials: c.name.split(' ').map(w => w[0]).join(''),
    hireDate: '2026-09-09',
    salary: c.form?.salaryExp || 9000,
    phone: c.phone || '+20 100 000 0000',
    email: c.form?.email || `${c.name.toLowerCase().replace(/\s+/g, '.')}@revive.com`
  };
  MOCK.employees.unshift(newEmp);
  closeModal();
  renderAll();
  showToast(`${c.name} hired and added to ${newEmp.gym} staff list!`, 'success');
}

// ==================== VACANCY REQUEST MODAL ====================
function openVacancyRequestModal(vrId) {
  const vr = MOCK.vacancyRequests.find(x => x.id === vrId);
  if (!vr) return;

  const content = `
    <div class="space-y-4">
      <div class="bg-charcoal-50 p-3.5 rounded-xl border border-charcoal-200">
        <div class="flex items-center justify-between">
          <div>
            <span class="badge badge-purple text-[9px] mb-1 inline-block">${vr.gym} Branch</span>
            <h3 class="text-sm font-bold text-charcoal-900">${vr.position} (Headcount: ${vr.headcount})</h3>
          </div>
          <span class="badge ${vr.urgency==='High'?'badge-red':'badge-yellow'} text-xs font-semibold">${vr.urgency} Urgency</span>
        </div>
        <p class="text-xs text-charcoal-600 mt-2">Requested by: <b>${vr.submittedBy}</b> (Branch Manager) on ${vr.submittedDate}</p>
        <p class="text-xs text-charcoal-500 mt-1">Reason: ${vr.reason || 'Operational staffing need'}</p>
      </div>
    </div>
  `;

  openModal('Review Vacancy Request', content, {
    wide: false,
    footer: `
      <button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="closeModal();rejectVacancyRequest('${vr.id}')" class="btn btn-sm btn-danger">Decline</button>
      <button onclick="closeModal();approveVacancyRequest('${vr.id}')" class="btn btn-sm btn-primary">Approve & Open Vacancy</button>
    `
  });
}

function approveVacancyRequest(vrId) {
  const vr = MOCK.vacancyRequests.find(x => x.id === vrId);
  if (!vr) return;
  vr.status = 'Approved';
  MOCK.vacancies.unshift({
    id: 'v-' + Date.now(),
    position: vr.position,
    gym: vr.gym,
    headcount: vr.headcount,
    applied: 0,
    status: 'Open',
    postedDate: '2026-09-09'
  });
  renderAll();
  showToast(`Vacancy approved for ${vr.position} at ${vr.gym}!`, 'success');
}

function rejectVacancyRequest(vrId) {
  const vr = MOCK.vacancyRequests.find(x => x.id === vrId);
  if (!vr) return;
  vr.status = 'Rejected';
  renderAll();
  showToast(`Vacancy request for ${vr.position} declined`, 'info');
}

// ==================== CONTRACT RENEWAL MODAL ====================
function openContractRenewalModal() {
  const staff = MOCK.employees;
  openModal('Contract & Level Adjustment', `
    <form onsubmit="event.preventDefault();applyContractRenewal();" class="space-y-3">
      <div>
        <label class="block text-xs font-semibold text-charcoal-700 mb-1">Select Employee</label>
        <select id="cr-emp-select" class="form-select w-full text-xs">
          ${staff.map(e => `<option value="${e.id}">${e.name} (${e.position} · ${e.level} · ${e.gym})</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">New Level / Title</label>
          <select id="cr-new-level" class="form-select w-full text-xs">
            <option value="Junior">Junior</option>
            <option value="Mid">Mid</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead / Supervisor</option>
            <option value="Manager">Manager</option>
          </select>
        </div>
        <div>
          <label class="block font-semibold text-charcoal-700 mb-1">Adjusted Basic Salary (EGP)</label>
          <input type="number" id="cr-new-salary" class="form-input w-full text-xs" placeholder="e.g. 14000" />
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-sm btn-primary">Save Changes</button>
      </div>
    </form>
  `, { wide: false });
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
    ...MOCK.candidates.filter(c => ['Accepted', 'First Interview', 'Second Interview'].includes(c.stage)).map(c => ['Candidate', c.name, c.form?.gymPref || 'All', c.stage, c.appliedDate]),
  ];
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${(cell||'').replace(/"/g, '""')}"`).join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ReviveHR_Executive_Summary_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Executive HR Summary exported as CSV!', 'success');
}

// ====================================================================================
// ==================== REDESIGNED DASHBOARD: FOCUSED FOR HR MANAGER ====================
// ====================================================================================
function renderDashboard() {
  const u = MOCK.currentUser;

  // Selected gym filter context
  const selectedGymObj = u.selectedGym !== 'all' ? u.gyms.find(g => g.id === u.selectedGym) : null;
  const gymBranch = selectedGymObj ? selectedGymObj.branch : null;

  // Datasets filtered by selected branch
  const pendingReqs = MOCK.requests.filter(r => r.status === 'Pending HR Review' && (!gymBranch || r.gym === gymBranch));
  const pendingVacancies = MOCK.vacancyRequests.filter(r => r.status === 'Pending' && (!gymBranch || r.gym === gymBranch));
  const expiringContracts = MOCK.events.filter(e => e.type === 'Contract Expiry');

  // Breakdown counts
  const totalGyms = MOCK.gymList.length;
  const totalStaff = MOCK.employees.length;
  const totalPendingRequests = pendingReqs.length;

  // Actions Needed items list (Decision Cards)
  const actionItems = [];

  // 1. Pending Employee Requests awaiting HR
  pendingReqs.forEach(r => {
    actionItems.push({
      id: r.id,
      type: 'request',
      badge: r.type,
      badgeClass: r.type === 'Day Off' ? 'badge-blue' : r.type === 'Resignation' ? 'badge-red' : 'badge-yellow',
      title: r.employee,
      subtitle: `${r.type} · ${r.gym}`,
      detail: `Date: ${r.requestedDate} · ${r.reason || 'Personal'} (BM: ${r.bmDecision || 'Approved'})`,
      onApprove: `quickApproveRequest('${r.id}')`,
      onReject: `quickRejectRequest('${r.id}')`,
      onReview: `openRequestDecision('${r.id}')`
    });
  });

  // 2. Pending Branch Vacancies awaiting HR approval
  pendingVacancies.forEach(v => {
    actionItems.push({
      id: v.id,
      type: 'vacancy',
      badge: 'Vacancy Request',
      badgeClass: 'badge-purple',
      title: `${v.position} (${v.headcount} needed)`,
      subtitle: `${v.gym} Branch · Urgency: ${v.urgency}`,
      detail: `Submitted by: ${v.submittedBy} (Branch Manager) · Reason: ${v.reason || 'Replacement'}`,
      onApprove: `quickApproveVacancy('${v.id}')`,
      onReject: `rejectVacancyRequest('${v.id}')`,
      onReview: `openVacancyRequestModal('${v.id}')`
    });
  });

  // 3. Expiring contracts
  expiringContracts.forEach(e => {
    actionItems.push({
      id: e.id,
      type: 'contract',
      badge: 'Contract Expiry',
      badgeClass: 'badge-orange',
      title: e.title,
      subtitle: `${e.branch} Branch · Due: ${e.date}`,
      detail: `Action required: Review performance and issue renewal or separation.`,
      onApprove: `openContractRenewalModal()`,
      onReject: `showToast('Contract flagged for offboarding', 'info')`,
      onReview: `openContractRenewalModal()`
    });
  });

  // Filter actions if user selected a category tab
  let filteredActions = actionItems;
  if (_dashSectionFilter === 'requests') filteredActions = actionItems.filter(a => a.type === 'request');
  else if (_dashSectionFilter === 'vacancies') filteredActions = actionItems.filter(a => a.type === 'vacancy');
  else if (_dashSectionFilter === 'contracts') filteredActions = actionItems.filter(a => a.type === 'contract');

  return `
  <div class="flex flex-col h-full min-h-0 gap-3 font-sans overflow-hidden">

    <!-- TOP ROW: HR Manager Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-bold text-charcoal-900 tracking-tight">Good morning, ${u.firstName}</h1>
          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
            HR Manager Dashboard
          </span>
        </div>
        <p class="text-xs text-charcoal-500 mt-0.5">Corporate HR Overview & Multi-Branch Operational Control</p>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="exportMonthlyHRReport()" class="btn btn-sm btn-secondary text-xs h-8 px-2.5 flex items-center gap-1.5 shadow-2xs">
          <svg class="w-3.5 h-3.5 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export Summary
        </button>
        ${renderGymSelector()}
      </div>
    </div>

    <!-- 4 CORE KPI TILES: CLEAR, GLANCEABLE, NO CLUTTER -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-shrink-0">
      
      <!-- 1. How Many Gyms -->
      <div onclick="openGymsOverviewModal()" class="bg-white rounded-xl border border-charcoal-200 p-3.5 hover:border-brand-500 hover:shadow-xs transition-all cursor-pointer group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Gym Branches</span>
          <div class="w-7 h-7 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
        </div>
        <div class="mt-2">
          <p class="text-2xl font-extrabold text-charcoal-900 leading-none">${totalGyms}</p>
          <p class="text-[11px] text-charcoal-500 mt-1 font-medium truncate">Nasr City · Heliopolis · 6th Oct</p>
        </div>
      </div>

      <!-- 2. How Many Employees -->
      <div onclick="navigateTo('employees')" class="bg-white rounded-xl border border-charcoal-200 p-3.5 hover:border-brand-500 hover:shadow-xs transition-all cursor-pointer group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Total Employees</span>
          <div class="w-7 h-7 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </div>
        </div>
        <div class="mt-2">
          <p class="text-2xl font-extrabold text-charcoal-900 leading-none">${totalStaff}</p>
          <p class="text-[11px] text-charcoal-500 mt-1 font-medium">128 Active · 14 On Probation</p>
        </div>
      </div>

      <!-- 3. Pending Requests -->
      <div onclick="navigateTo('requests')" class="bg-white rounded-xl border border-charcoal-200 p-3.5 hover:border-brand-500 hover:shadow-xs transition-all cursor-pointer group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Pending Requests</span>
          <div class="w-7 h-7 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
        </div>
        <div class="mt-2">
          <p class="text-2xl font-extrabold text-charcoal-900 leading-none">${totalPendingRequests}</p>
          <p class="text-[11px] text-charcoal-500 mt-1 font-medium">Day-off & leave approvals</p>
        </div>
      </div>

      <!-- 4. Actions He Need To Take -->
      <div onclick="_dashSectionFilter='all';renderAll()" class="bg-white rounded-xl border border-charcoal-200 p-3.5 hover:border-amber-500 hover:shadow-xs transition-all cursor-pointer group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Actions Needed</span>
          <div class="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          </div>
        </div>
        <div class="mt-2">
          <p class="text-2xl font-extrabold text-amber-600 leading-none">${actionItems.length}</p>
          <p class="text-[11px] text-charcoal-500 mt-1 font-medium">Urgent sign-offs & approvals</p>
        </div>
      </div>

    </div>

    <!-- MAIN OPERATIONAL WORKSPACE: 2 BALANCED COLUMNS -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">

      <!-- ================= LEFT (60% / 7 COLS): ACTIONS YOU NEED TO TAKE ================= -->
      <div class="lg:col-span-7 bg-white rounded-xl border border-charcoal-200 flex flex-col min-h-0 shadow-2xs overflow-hidden">
        
        <!-- Header & Segmented Category Pills -->
        <div class="p-3 border-b border-charcoal-150 flex items-center justify-between bg-charcoal-50/60 flex-shrink-0">
          <div>
            <h2 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Actions You Need To Take</h2>
            <p class="text-[11px] text-charcoal-400">Decide, approve, or sign off</p>
          </div>

          <!-- Filter Pills -->
          <div class="flex items-center bg-charcoal-200/70 p-0.5 rounded-lg text-[10px]">
            <button onclick="_dashSectionFilter='all';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='all'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">All (${actionItems.length})</button>
            <button onclick="_dashSectionFilter='requests';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='requests'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">Requests (${pendingReqs.length})</button>
            <button onclick="_dashSectionFilter='vacancies';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='vacancies'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">Vacancies (${pendingVacancies.length})</button>
          </div>
        </div>

        <!-- Action Items List (Clear, spacious, low text density) -->
        <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-charcoal-100 p-2 space-y-2">
          ${filteredActions.length === 0 ? `
            <div class="py-12 text-center text-xs text-charcoal-400">
              <svg class="w-8 h-8 mx-auto mb-2 text-charcoal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              All clear! No urgent actions requiring HR sign-off.
            </div>
          ` : filteredActions.map(a => `
            <div class="bg-charcoal-50/50 hover:bg-charcoal-50 p-3 rounded-xl border border-charcoal-150 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="badge ${a.badgeClass} text-[9px] font-semibold">${a.badge}</span>
                  <h3 class="text-xs font-bold text-charcoal-900 truncate">${a.title}</h3>
                </div>
                <p class="text-[11px] font-medium text-charcoal-700 mt-1">${a.subtitle}</p>
                <p class="text-[10px] text-charcoal-400 mt-0.5 truncate">${a.detail}</p>
              </div>

              <!-- Action Buttons Directly On Card -->
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button onclick="${a.onApprove}" class="btn btn-sm btn-success text-xs h-7 px-2.5 shadow-2xs">
                  Approve
                </button>
                <button onclick="${a.onReject}" class="btn btn-sm btn-secondary text-xs h-7 px-2 text-charcoal-500 hover:text-red-600">
                  Decline
                </button>
                <button onclick="${a.onReview}" class="btn btn-sm btn-secondary text-xs h-7 px-2">
                  Review
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="p-2 bg-charcoal-50/60 border-t border-charcoal-150 flex items-center justify-between text-[11px] text-charcoal-400 flex-shrink-0">
          <span>Click Approve to execute sign-off immediately</span>
          <button onclick="navigateTo('requests')" class="text-brand-600 hover:text-brand-800 font-semibold">View Full Requests Queue →</button>
        </div>
      </div>

      <!-- ================= RIGHT (40% / 5 COLS): FAST ACTIONS FOR HR MANAGER ================= -->
      <div class="lg:col-span-5 flex flex-col gap-3 min-h-0">

        <!-- FAST ACTIONS CONTAINER -->
        <div class="bg-white rounded-xl border border-charcoal-200 p-3.5 shadow-2xs flex-shrink-0">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h2 class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Fast Actions</h2>
              <p class="text-[11px] text-charcoal-400">High-frequency HR operations</p>
            </div>
            <span class="badge badge-brand text-[9px]">HR Tools</span>
          </div>

          <!-- 6 Action Tiles -->
          <div class="grid grid-cols-2 gap-2.5">

            <!-- 1. Create New Account -->
            <button onclick="openCreateAccountModal()" class="p-3 rounded-xl border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50/60 hover:border-brand-300 transition-all text-left flex flex-col justify-between group">
              <div class="w-8 h-8 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-700 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              </div>
              <div class="mt-2">
                <p class="text-xs font-bold text-charcoal-900 group-hover:text-brand-800">Create Account</p>
                <p class="text-[10px] text-charcoal-500 mt-0.5">Setup employee login</p>
              </div>
            </button>

            <!-- 2. Change Password & Give Access -->
            <button onclick="openChangePasswordAccessModal()" class="p-3 rounded-xl border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50/60 hover:border-brand-300 transition-all text-left flex flex-col justify-between group">
              <div class="w-8 h-8 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-700 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
              </div>
              <div class="mt-2">
                <p class="text-xs font-bold text-charcoal-900 group-hover:text-brand-800">Change Password</p>
                <p class="text-[10px] text-charcoal-500 mt-0.5">Reset pass & permissions</p>
              </div>
            </button>

            <!-- 3. Create Hiring Form -->
            <button onclick="openCreateHiringFormModal()" class="p-3 rounded-xl border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50/60 hover:border-brand-300 transition-all text-left flex flex-col justify-between group">
              <div class="w-8 h-8 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-700 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <div class="mt-2">
                <p class="text-xs font-bold text-charcoal-900 group-hover:text-brand-800">Hiring Form</p>
                <p class="text-[10px] text-charcoal-500 mt-0.5">Build job application</p>
              </div>
            </button>

            <!-- 4. Create Evaluation Form -->
            <button onclick="openCreateEvaluationFormModal()" class="p-3 rounded-xl border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50/60 hover:border-brand-300 transition-all text-left flex flex-col justify-between group">
              <div class="w-8 h-8 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-700 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
              </div>
              <div class="mt-2">
                <p class="text-xs font-bold text-charcoal-900 group-hover:text-brand-800">Evaluation Form</p>
                <p class="text-[10px] text-charcoal-500 mt-0.5">Appraisal & criteria</p>
              </div>
            </button>

            <!-- 5. See Requests -->
            <button onclick="navigateTo('requests')" class="p-3 rounded-xl border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50/60 hover:border-brand-300 transition-all text-left flex flex-col justify-between group">
              <div class="w-8 h-8 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-700 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              </div>
              <div class="mt-2">
                <p class="text-xs font-bold text-charcoal-900 group-hover:text-brand-800">See Requests</p>
                <p class="text-[10px] text-charcoal-500 mt-0.5">${totalPendingRequests} waiting review</p>
              </div>
            </button>

            <!-- 6. Add Employee -->
            <button onclick="openAddEmployee()" class="p-3 rounded-xl border border-brand-300 bg-brand-50/50 hover:bg-brand-100/60 transition-all text-left flex flex-col justify-between group">
              <div class="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-xs">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              </div>
              <div class="mt-2">
                <p class="text-xs font-bold text-brand-900">+ Add Employee</p>
                <p class="text-[10px] text-brand-700 mt-0.5">Onboard staff member</p>
              </div>
            </button>

          </div>
        </div>

        <!-- GYM BRANCHES QUICK OVERSIGHT CARD -->
        <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs flex-1 min-h-0 flex flex-col justify-between">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-charcoal-900 uppercase tracking-wide">Branches Oversight</span>
            <button onclick="openGymsOverviewModal()" class="text-[10px] text-brand-600 hover:text-brand-800 font-semibold">View All →</button>
          </div>

          <div class="space-y-1.5 flex-1 overflow-y-auto">
            ${MOCK.gymList.map(g => `
              <div onclick="setGymFilter('${g.id}')" class="p-2 rounded-lg bg-charcoal-50/60 hover:bg-charcoal-100/60 transition-colors flex items-center justify-between cursor-pointer text-xs">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <div>
                    <p class="font-bold text-charcoal-800 text-[11px]">${g.branch}</p>
                    <p class="text-[10px] text-charcoal-400">${g.name}</p>
                  </div>
                </div>
                <div class="text-right">
                  <span class="font-bold text-charcoal-800 text-[11px]">${g.employees}</span>
                  <span class="text-[10px] text-charcoal-400 block">staff</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

    </div>

  </div>
  `;
}