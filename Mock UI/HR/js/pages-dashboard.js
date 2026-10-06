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
  updateGymChip();
  renderAll();
  showToast(id==='all' ? 'Showing all branches' : 'Branch filter applied', 'info');
}

// ==================== FAST ACTION: CREATE NEW ACCOUNT MODAL ====================
function nextEmpCode() {
  let max = 123;
  MOCK.employees.forEach(e => { const m = /RV-(\d+)/.exec(e.id || ''); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return 'RV-' + String(max + 1).padStart(5, '0');
}

function openCreateAccountModal() {
  const branches = [...new Set((MOCK.gymList || MOCK.currentUser.gyms).map(g => g.branch))];
  const today = new Date().toISOString().slice(0, 10);
  // System roles: base roles + every role/template created in HR Team Management
  const baseRoles = ['Emp', 'Team Leader', 'Branch Manager', 'HR'];
  const roleOpts = [...new Set([...baseRoles, ...(MOCK.roleTemplates || []).map(t => t.name)])];
  openModal('Create New Employee Account', `
    <div class="space-y-4">
      <div class="bg-charcoal-50 p-3 rounded-xl border border-charcoal-200 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-bold text-charcoal-700 uppercase tracking-wide">New Employee Profile</p>
          <span class="text-[11px] font-mono text-charcoal-500">Code <input type="text" id="acc-code" readonly value="${nextEmpCode()}" class="inline w-[80px] bg-transparent border-0 p-0 font-mono font-bold text-charcoal-800 focus:ring-0" /></span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-semibold text-charcoal-700 mb-1">Full Name *</label>
            <input type="text" id="acc-name" oninput="suggestAccEmail()" class="form-input w-full text-xs" placeholder="e.g. Mariam Adel" />
          </div>
          <div>
            <label class="block font-semibold text-charcoal-700 mb-1">Position *</label>
            <input type="text" id="acc-position" class="form-input w-full text-xs" placeholder="Type the position freely" value="Trainer" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-semibold text-charcoal-700 mb-1">Level</label>
            <select id="acc-level" class="form-select w-full text-xs">
              <option>Junior</option><option>Mid</option><option>Senior</option><option>Manager</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-charcoal-700 mb-1">Phone</label>
            <input type="tel" id="acc-phone" class="form-input w-full text-xs" placeholder="+20 1XX XXX XXXX" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-semibold text-charcoal-700 mb-1">Work Email *</label>
            <input type="email" id="acc-email" class="form-input w-full text-xs" placeholder="name@revive.com" />
          </div>
          <div>
            <label class="block font-semibold text-charcoal-700 mb-1">Hire Date</label>
            <input type="date" id="acc-hire" value="${today}" class="form-input w-full text-xs" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-semibold text-charcoal-700 mb-1">Base Salary (EGP)</label>
            <input type="number" id="acc-salary" class="form-input w-full text-xs" placeholder="e.g. 9000" min="0" />
          </div>
          <div>
            <label class="block font-semibold text-charcoal-700 mb-1">System Role</label>
            <select id="acc-role" class="form-select w-full text-xs">
              ${roleOpts.map(r => `<option value="${r}" ${r === 'Emp' ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="p-3 rounded-xl border border-charcoal-200 space-y-2">
        <p class="text-[11px] font-bold text-charcoal-700 uppercase tracking-wide">Gym / Branch Assignment <span class="font-normal normal-case text-charcoal-400">(more than one allowed)</span></p>
        <div class="grid grid-cols-2 gap-2 text-xs" id="acc-branches">
          ${branches.map(b => `
            <label class="flex items-center gap-2 p-2 bg-charcoal-50 rounded-lg cursor-pointer hover:bg-charcoal-100/60">
              <input type="checkbox" class="acc-branch-cb form-checkbox text-brand-600 rounded" value="${b}" />
              <span>${b}</span>
            </label>`).join('')}
          <label class="flex items-center gap-2 p-2 bg-brand-50 border border-brand-200 rounded-lg cursor-pointer hover:bg-brand-100/60 col-span-2">
            <input type="checkbox" class="acc-branch-cb form-checkbox text-brand-600 rounded" value="all" onchange="if (this.checked) document.querySelectorAll('.acc-branch-cb').forEach(c => { if (c.value !== 'all') c.checked = false; });" />
            <span class="font-semibold text-brand-800">All Branches</span>
          </label>
        </div>
      </div>

      <div class="p-3 rounded-xl border border-charcoal-200 space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-bold text-charcoal-700 uppercase tracking-wide">Face-ID for Attendance</p>
          <span id="acc-face-status" class="text-[10px] font-semibold text-charcoal-400">No photo yet</span>
        </div>
        <div class="relative bg-charcoal-900 rounded-lg overflow-hidden h-72 flex items-center justify-center">
          <video id="acc-face-video" autoplay playsinline muted class="hidden w-full h-full object-cover"></video>
          <img id="acc-face-photo" class="hidden h-72 w-72 object-cover rounded-lg" alt="captured face" />
          <div id="acc-face-placeholder" class="text-white/50 text-[11px] flex flex-col items-center gap-1 px-6 text-center">
            <span class="material-icons text-[28px]">face</span>
            Take a clear front-facing photo — the employee checks in automatically at the Attendance Station
          </div>
        </div>
        <div class="flex gap-2">
          <button type="button" id="acc-face-start" onclick="startFaceCamera()" class="btn btn-secondary text-xs flex-1"><span class="material-icons text-[15px] align-middle">photo_camera</span> Start Camera</button>
          <button type="button" id="acc-face-capture" onclick="captureFacePhoto()" class="btn btn-primary text-xs flex-1 hidden">Capture Photo</button>
          <button type="button" id="acc-face-retake" onclick="retakeFacePhoto()" class="btn btn-secondary text-xs flex-1 hidden">Retake</button>
        </div>
        <input type="hidden" id="acc-face" value="" />
      </div>

      <div class="text-xs">
        <label class="block font-semibold text-charcoal-700 mb-1">Initial Password</label>
        <div class="flex gap-1.5">
          <input type="text" id="acc-pass" class="form-input w-full text-xs font-mono" value="Revive@2026" />
          <button type="button" onclick="document.getElementById('acc-pass').value='Revive#'+Math.floor(1000+Math.random()*9000)" class="btn btn-secondary text-xs px-2" title="Generate Random">↺</button>
        </div>
      </div>
    </div>
  `, {
    wide: true,
    footer: `
      <button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="submitNewAccount()" class="btn btn-sm btn-primary">Create Employee & Account</button>
    `
  });
}

function suggestAccEmail() {
  const name = (document.getElementById('acc-name')?.value || '').trim();
  const email = document.getElementById('acc-email');
  if (!email || !name) return;
  email.value = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '') + '@revive.com';
}

let _accStream = null, _accCamWatch = null;

async function startFaceCamera() {
  try {
    _accStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
    const v = document.getElementById('acc-face-video');
    if (!v) { stopFaceCamera(); return; }
    v.srcObject = _accStream;
    v.classList.remove('hidden');
    document.getElementById('acc-face-placeholder').classList.add('hidden');
    document.getElementById('acc-face-start').classList.add('hidden');
    document.getElementById('acc-face-capture').classList.remove('hidden');
    clearInterval(_accCamWatch);
    _accCamWatch = setInterval(() => { if (!document.getElementById('acc-face-video')) stopFaceCamera(); }, 600);
  } catch (err) {
    showToast('Camera unavailable (' + (err && err.name ? err.name : 'error') + ') - you can still create the account without a photo', 'warning');
  }
}

function stopFaceCamera() {
  clearInterval(_accCamWatch); _accCamWatch = null;
  if (_accStream) { _accStream.getTracks().forEach(t => t.stop()); _accStream = null; }
}

function captureFacePhoto() {
  const v = document.getElementById('acc-face-video');
  if (!v || !v.videoWidth) { showToast('Camera is not ready yet', 'warning'); return; }
  const side = Math.min(v.videoWidth, v.videoHeight);
  const c = document.createElement('canvas');
  c.width = 320; c.height = 320;
  c.getContext('2d').drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 320, 320);
  const dataUrl = c.toDataURL('image/jpeg', 0.85);
  document.getElementById('acc-face').value = dataUrl;
  const img = document.getElementById('acc-face-photo');
  img.src = dataUrl; img.classList.remove('hidden');
  v.classList.add('hidden');
  document.getElementById('acc-face-capture').classList.add('hidden');
  document.getElementById('acc-face-retake').classList.remove('hidden');
  const st = document.getElementById('acc-face-status');
  st.textContent = 'Photo captured ✓';
  st.className = 'text-[10px] font-bold text-brand-600';
  stopFaceCamera();
}

function retakeFacePhoto() {
  document.getElementById('acc-face').value = '';
  document.getElementById('acc-face-photo').classList.add('hidden');
  document.getElementById('acc-face-retake').classList.add('hidden');
  const st = document.getElementById('acc-face-status');
  st.textContent = 'No photo yet';
  st.className = 'text-[10px] font-semibold text-charcoal-400';
  startFaceCamera();
}

function submitNewAccount() {
  const name = (document.getElementById('acc-name')?.value || '').trim();
  const code = (document.getElementById('acc-code')?.value || '').trim();
  const position = (document.getElementById('acc-position')?.value || '').trim();
  const level = document.getElementById('acc-level')?.value || 'Junior';
  const phone = (document.getElementById('acc-phone')?.value || '').trim();
  const email = (document.getElementById('acc-email')?.value || '').trim();
  const hireDate = document.getElementById('acc-hire')?.value || new Date().toISOString().slice(0, 10);
  const salary = Number(document.getElementById('acc-salary')?.value || 0);
  const role = document.getElementById('acc-role')?.value || 'Emp';
  const pass = document.getElementById('acc-pass')?.value || '';
  const facePhoto = document.getElementById('acc-face')?.value || '';
  const branches = [...document.querySelectorAll('.acc-branch-cb:checked')].map(c => c.value);

  if (!name) { showToast('Please enter the employee full name', 'warning'); return; }
  if (!position) { showToast('Please enter the position', 'warning'); return; }
  if (!email || !/.+@.+\..+/.test(email)) { showToast('Please enter a valid work email', 'warning'); return; }
  if (!branches.length) { showToast('Select at least one gym / branch', 'warning'); return; }
  if (!pass) { showToast('Set an initial password', 'warning'); return; }

  const primaryGym = branches.includes('all') ? 'All' : branches[0];
  const emp = {
    id: code, name, position, level, gym: primaryGym, status: 'Active',
    initials: name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(),
    hireDate, salary, phone, email,
    branches: branches.includes('all') ? ['all'] : branches,
    role, facePhoto: facePhoto || null,
  };
  MOCK.employees.push(emp);
  stopFaceCamera();
  closeModal();

  const gymText = branches.includes('all') ? 'all branches' : branches.join(' + ');
  const faceText = facePhoto ? 'Face-ID photo saved for attendance' : 'no Face-ID photo yet';
  showToast(`New employee ${name} (${code}) created - ${gymText} - ${role} - ${faceText}.`, 'success');
  if (typeof renderAll === 'function') renderAll();
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
          <label class="block font-semibold text-charcoal-700 mb-1">Routed To (Evaluators)</label>
          <select id="ef-evaluator" class="form-select w-full text-xs">
            ${(() => {
              // Permission-derived preview: whoever holds an eval-execution permission
              // receives the form — evaluated employees are subjects, never recipients.
              const evals = typeof evaluatorCandidates === 'function' ? evaluatorCandidates() : [];
              if (!evals.length) return '<option value="">No users hold an evaluation permission</option>';
              return evals.map(u => `<option value="${u.email}">${u.fullName} — ${u.position}</option>`).join('');
            })()}
          </select>
          <p class="text-[10px] text-charcoal-500 mt-1">Routes only to users with an evaluation permission — employees are evaluated as subjects, not recipients.</p>
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
  openModal('All Gym Branches Overview &amp; Required Actions', `
    <div class="space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        ${MOCK.gymList.map(g => {
          const openVac = (MOCK.vacancies || []).filter(v => v.gym === g.branch && v.status === 'Open').length;
          const act = typeof getGymRequiredActions === 'function' ? getGymRequiredActions(g.branch) : { total: 0, summaryText: 'All clear' };
          return `
            <div class="bg-white border ${act.total > 0 ? 'border-amber-200 ring-1 ring-amber-100' : 'border-charcoal-200'} rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="badge badge-brand text-[9px]">${g.name}</span>
                  ${act.total > 0 
                    ? `<span class="badge bg-amber-100 text-amber-800 text-[9px] font-bold">${act.total} Action${act.total > 1 ? 's' : ''} Needed</span>` 
                    : `<span class="badge bg-emerald-50 text-emerald-700 text-[9px]">All clear</span>`
                  }
                </div>
                <h4 class="text-sm font-bold text-charcoal-900">${g.branch} Branch</h4>
                
                <div class="mt-2.5 space-y-1.5 text-xs text-charcoal-600">
                  <p class="flex items-center justify-between"><span>Total Staff:</span> <b class="text-charcoal-900">${g.employees} Employees</b></p>
                  <p class="flex items-center justify-between"><span>Open Vacancies:</span> <b class="text-charcoal-900">${openVac}</b></p>
                  <p class="flex items-center justify-between"><span>Pending Requests:</span> <b class="${act.requestsCount > 0 ? 'text-amber-600 font-bold' : 'text-charcoal-900'}">${act.requestsCount || 0}</b></p>
                  <p class="flex items-center justify-between"><span>Urgent / Expiry:</span> <b class="${act.contractsCount > 0 ? 'text-orange-600 font-bold' : 'text-charcoal-900'}">${act.contractsCount || 0}</b></p>
                </div>

                <!-- Required Actions Box -->
                <div class="mt-3 p-2.5 rounded-lg ${act.total > 0 ? 'bg-amber-50/80 border border-amber-200' : 'bg-charcoal-50 border border-charcoal-150'} text-xs">
                  <div class="flex items-center justify-between">
                    <span class="font-bold ${act.total > 0 ? 'text-amber-900' : 'text-charcoal-700'}">Required Actions</span>
                    <span class="font-extrabold ${act.total > 0 ? 'text-amber-700 text-xs' : 'text-charcoal-500'}">${act.total}</span>
                  </div>
                  <p class="text-[10px] mt-1 ${act.total > 0 ? 'text-amber-800' : 'text-charcoal-500'}">${act.summaryText}</p>
                </div>
              </div>
              <button onclick="closeModal();setGymFilter('${g.id}')" class="btn btn-sm btn-secondary w-full mt-3 text-xs flex items-center justify-center gap-1 font-semibold">
                <span>Filter Dashboard to ${g.branch}</span>
                <span class="text-brand-600">→</span>
              </button>
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
  vr.decidedBy = MOCK.currentUser.fullName;
  // Write the decision back to the Branch Manager portal (no-op for HR-native requests).
  if (typeof VacancyBridge !== 'undefined') VacancyBridge.decide(vr.id, 'Approved', MOCK.currentUser.fullName, '');
  MOCK.vacancies.unshift({
    id: 'v-' + Date.now(),
    position: vr.position,
    gym: vr.gym,
    headcount: vr.headcount || 1,
    candidates: 0,
    urgency: vr.urgency || 'Normal',
    salary: vr.salary || null,
    shift: vr.shift || 'Morning',
    requestedBy: vr.submittedBy,
    createdDate: '2026-09-09',
    applied: 0,
    status: 'Open',
    postedDate: '2026-09-09',
    branchRef: vr.source === 'branch' ? vr.id : null
  });
  renderAll();
  showToast(`Vacancy approved for ${vr.position} at ${vr.gym}!`, 'success');
}

function rejectVacancyRequest(vrId) {
  const vr = MOCK.vacancyRequests.find(x => x.id === vrId);
  if (!vr) return;
  vr.status = 'Rejected';
  vr.decidedBy = MOCK.currentUser.fullName;
  // Write the decision back to the Branch Manager portal (no-op for HR-native requests).
  if (typeof VacancyBridge !== 'undefined') VacancyBridge.decide(vr.id, 'Rejected', MOCK.currentUser.fullName, '');
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

  // Permission-gated dashboard visibility (never hard-code a role name)
  const canApproveVacancies = DEMO.showAll || hasPermission('recruitment.vacancy_request.approve');
  const canApprovePayroll = DEMO.showAll || hasPermission('payroll.approve');
  const canManageTeam = DEMO.showAll || hasPermission('team.manage');

  const pendingVacancies = canApproveVacancies
    ? MOCK.vacancyRequests.filter(r => r.status === 'Pending' && (!gymBranch || r.gym === gymBranch))
    : [];

  // Permission-visible events (both presets see expiries; approval items need their permission)
  const visibleEvents = (MOCK.events || []).filter(e => !e.permission || DEMO.showAll || hasPermission(e.permission));
  const expiringContracts = visibleEvents.filter(e => e.type === 'Contract Expiry' || e.type === 'Document Expiry');
  const payrollApprovals = canApprovePayroll
    ? visibleEvents.filter(e => e.type === 'PayrollApproval' && (!gymBranch || (e.title || '').includes(gymBranch)))
    : [];
  // Escalated EmployeeActionRequests awaiting a permission this user holds (HR Manager queue)
  const pendingActionRequests = (MOCK.actionRequests || []).filter(a => {
    if (a.status !== 'Pending') return false;
    const meta = ACTION_TYPES[a.actionType];
    if (!meta || !(DEMO.showAll || hasPermission(meta.perm))) return false;
    if (!gymBranch) return true;
    const empGym = a.employeeId ? (MOCK.employees.find(x => x.id === a.employeeId) || {}).gym : null;
    return !empGym || empGym === gymBranch;
  });

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

  // 4. Employee action requests raised by HR — whoever holds the permission reviews these
  pendingActionRequests.forEach(a => {
    const meta = ACTION_TYPES[a.actionType];
    actionItems.push({
      id: a.id,
      type: 'action',
      badge: meta.label,
      badgeClass: 'badge-blue',
      title: a.employee,
      subtitle: actionSummary(a),
      detail: `Raised by: ${a.requestedBy} (HR) · ${a.justification}`,
      onApprove: `approveActionRequest('${a.id}')`,
      onReject: `rejectActionRequest('${a.id}')`,
      onReview: `navigateTo('events')`
    });
  });

  // 5. Payroll runs awaiting HR Manager approval
  payrollApprovals.forEach(e => {
    actionItems.push({
      id: e.id,
      type: 'payroll',
      badge: 'Payroll Approval',
      badgeClass: 'badge-purple',
      title: e.title,
      subtitle: `Due: ${e.date}`,
      detail: e.detail,
      onApprove: `navigateTo('payroll')`,
      onReject: `showToast('Payroll approval deferred', 'info')`,
      onReview: `navigateTo('payroll')`
    });
  });

  // 6. HR team attendance oversight — HR Manager only
  if (canManageTeam) {
    actionItems.push({
      id: 'hr-team-att',
      type: 'team',
      badge: 'HR Team',
      badgeClass: 'badge-green',
      title: 'HR Team Attendance Review',
      subtitle: 'Attendance of HR users under you',
      detail: 'Two HR users reported lateness this week. Review before payroll cut-off.',
      onApprove: `navigateTo('attendance')`,
      onReject: `navigateTo('attendance')`,
      onReview: `navigateTo('attendance')`
    });
  }

  // 7. Branch Manager submissions — deductions / warnings / bonuses sent
  //    from the Branch portal, waiting on an HR decision (shared queue).
  const pendingBranchItems = (typeof branchQueuePending === 'function') ? branchQueuePending() : [];
  pendingBranchItems.forEach(b => {
    actionItems.push({
      id: b.id, type: 'branch',
      badge: b.kind,
      badgeClass: b.kind === 'Deduction' ? 'badge-yellow' : b.kind === 'Bonus' ? 'badge-green' : 'badge-red',
      title: b.employee,
      subtitle: `${b.kind} sent by ${b.issuedBy || 'Branch Manager'} · ${b.gym || 'Branch'}`,
      detail: `${b.title || ''}${b.amount ? ' · EGP ' + b.amount : ''} · ${formatDate(b.date)}`,
      onApprove: `approveBranchItem('${b.id}')`,
      onReject: `declineBranchItem('${b.id}')`,
      onReview: `navigateTo('requests')`
    });
  });

  // Filter actions if user selected a category tab
  let filteredActions = actionItems;
  if (_dashSectionFilter === 'requests') filteredActions = actionItems.filter(a => a.type === 'request');
  else if (_dashSectionFilter === 'vacancies') filteredActions = actionItems.filter(a => a.type === 'vacancy');
  else if (_dashSectionFilter === 'branch') filteredActions = actionItems.filter(a => a.type === 'branch');
  else if (_dashSectionFilter === 'contracts') filteredActions = actionItems.filter(a => a.type === 'contract');

  return `
  <div class="h-full flex flex-col gap-2.5 overflow-hidden font-sans text-charcoal-800">

    <!-- TOP ROW: Compact Header -->
    <div class="flex items-center justify-between flex-shrink-0 pt-0.5">
      <div class="flex items-center gap-2.5">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base font-bold text-charcoal-900 tracking-tight">Good morning, ${u.firstName}</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">${u.role}</span>
          </div>
          <p class="text-[11px] text-charcoal-400 mt-0.5">Multi-Branch Operational View · ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="exportMonthlyHRReport()" class="btn btn-sm btn-secondary text-xs h-7 px-2.5 flex items-center gap-1.5">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export
        </button>
        ${renderGymSelector()}
      </div>
    </div>

    <!-- KPI STRIP: 4 compact tiles, fixed height -->
    <div class="grid grid-cols-4 gap-2 flex-shrink-0">

      <div onclick="openGymsOverviewModal()" class="bg-white rounded-lg border border-charcoal-200 px-3 py-2.5 hover:border-brand-400 hover:shadow-xs transition-all cursor-pointer group flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
        </div>
        <div class="min-w-0">
          <p class="text-xl font-extrabold text-charcoal-900 leading-none">${totalGyms}</p>
          <p class="text-[10px] text-charcoal-500 font-semibold uppercase tracking-wide mt-0.5">Gym Branches</p>
        </div>
      </div>

      <div onclick="navigateTo('employees')" class="bg-white rounded-lg border border-charcoal-200 px-3 py-2.5 hover:border-brand-400 hover:shadow-xs transition-all cursor-pointer group flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        </div>
        <div class="min-w-0">
          <p class="text-xl font-extrabold text-charcoal-900 leading-none">${totalStaff}</p>
          <p class="text-[10px] text-charcoal-500 font-semibold uppercase tracking-wide mt-0.5">Total Staff</p>
        </div>
      </div>

      <div onclick="navigateTo('requests')" class="bg-white rounded-lg border border-charcoal-200 px-3 py-2.5 hover:border-brand-400 hover:shadow-xs transition-all cursor-pointer group flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center text-charcoal-600 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <div class="min-w-0">
          <p class="text-xl font-extrabold text-charcoal-900 leading-none">${totalPendingRequests}</p>
          <p class="text-[10px] text-charcoal-500 font-semibold uppercase tracking-wide mt-0.5">Pending Requests</p>
        </div>
      </div>

      <div onclick="_dashSectionFilter='all';renderAll()" class="bg-amber-50 rounded-lg border border-amber-200 px-3 py-2.5 hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer group flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        </div>
        <div class="min-w-0">
          <p class="text-xl font-extrabold text-amber-700 leading-none">${actionItems.length}</p>
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
            <button onclick="_dashSectionFilter='all';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='all'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">All (${actionItems.length})</button>
            <button onclick="_dashSectionFilter='requests';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='requests'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">Requests (${pendingReqs.length})</button>
            <button onclick="_dashSectionFilter='vacancies';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='vacancies'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">Vacancies (${pendingVacancies.length})</button>
            <button onclick="_dashSectionFilter='branch';renderAll()" class="px-2 py-0.5 rounded-md font-medium transition-all ${_dashSectionFilter==='branch'?'bg-white text-charcoal-900 shadow-2xs font-bold':'text-charcoal-600'}">Branch (${pendingBranchItems.length})</button>
          </div>
        </div>

        <!-- Scrollable action items - only this part scrolls -->
        <div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
          ${filteredActions.length === 0 ? `
            <div class="py-10 text-center text-xs text-charcoal-400">
              <svg class="w-8 h-8 mx-auto mb-2 text-charcoal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              All clear — no urgent actions right now.
            </div>
          ` : filteredActions.map(a => `
            <div class="bg-charcoal-50/60 hover:bg-white p-2.5 rounded-lg border border-charcoal-150 hover:border-charcoal-300 transition-all flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="badge ${a.badgeClass} text-[9px] font-semibold">${a.badge}</span>
                  <h3 class="text-xs font-bold text-charcoal-900 truncate">${a.title}</h3>
                </div>
                <p class="text-[11px] text-charcoal-600">${a.subtitle}</p>
                <p class="text-[10px] text-charcoal-400 truncate">${a.detail}</p>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button onclick="${a.onApprove}" class="btn btn-sm btn-success text-[11px] h-7 px-2.5">Approve</button>
                <button onclick="${a.onReject}" class="btn btn-sm btn-secondary text-[11px] h-7 px-2 text-charcoal-500 hover:text-red-600">Decline</button>
                <button onclick="${a.onReview}" class="btn btn-sm btn-secondary text-[11px] h-7 px-2">Review</button>
              </div>
            </div>
          `).join('')}
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
                ${totalPendingRequests > 0 ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">' + totalPendingRequests + '</span>' : ''}
              </div>
              <p class="text-[10px] font-semibold text-charcoal-800 group-hover:text-brand-800 leading-tight">See Requests</p>
            </button>

            <button onclick="typeof openComposeAnnouncement === 'function' ? openComposeAnnouncement() : navigateTo('notifications')" class="p-2.5 rounded-lg border border-charcoal-200 bg-charcoal-50/50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center group flex flex-col items-center gap-1.5">
              <div class="w-7 h-7 rounded-lg bg-white border border-charcoal-200 flex items-center justify-center text-charcoal-600 group-hover:text-brand-600 group-hover:border-brand-300 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
              </div>
              <p class="text-[10px] font-semibold text-charcoal-800 group-hover:text-brand-800 leading-tight">Announcement</p>
            </button>

          </div>
        </div>

        <!-- BRANCHES OVERVIEW: flex-1 fills leftover height, inner scroll if overflow -->
        <div class="bg-white rounded-xl border border-charcoal-200 p-3 shadow-2xs flex flex-col flex-1 min-h-0 overflow-hidden">
          <div class="flex items-center justify-between mb-2 flex-shrink-0">
            <div>
              <h3 class="text-[11px] font-bold text-charcoal-900 uppercase tracking-wide">Branches Overview</h3>
              <p class="text-[10px] text-charcoal-400">Headcount &amp; required actions · click to filter</p>
            </div>
            <button onclick="openGymsOverviewModal()" class="text-[11px] text-brand-600 hover:text-brand-800 font-semibold">Details →</button>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto space-y-1.5">
            ${MOCK.gymList.map(g => {
              const act = typeof getGymRequiredActions === 'function' ? getGymRequiredActions(g.branch) : { total: 0, summaryText: 'All clear' };
              const isSelected = u.selectedGym === g.id;
              return `
              <div onclick="setGymFilter('${g.id}')" class="px-2.5 py-2 rounded-lg transition-all flex items-center justify-between cursor-pointer border ${
                isSelected ? 'bg-brand-50/70 border-brand-300 ring-1 ring-brand-300' : 'bg-charcoal-50 hover:bg-charcoal-100 border-charcoal-100 hover:border-charcoal-200'
              }">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-2.5 h-2.5 rounded-full ${act.total > 0 ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-emerald-500'} flex-shrink-0"></div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <p class="text-xs font-bold text-charcoal-900 truncate">${g.branch}</p>
                      ${act.total > 0 
                        ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">${act.total} action${act.total > 1 ? 's' : ''}</span>` 
                        : `<span class="px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 flex-shrink-0">Clear</span>`
                      }
                    </div>
                    <p class="text-[10px] text-charcoal-400 truncate">${act.total > 0 ? act.summaryText : `${g.name} · All clear`}</p>
                  </div>
                </div>
                <div class="text-right flex-shrink-0 ml-2">
                  <span class="text-xs font-bold text-charcoal-900">${g.employees}</span>
                  <span class="text-[10px] text-charcoal-400 ml-0.5">staff</span>
                </div>
              </div>
            `;}).join('')}
          </div>
        </div>

      </div>

    </div>

  </div>
  `;
}