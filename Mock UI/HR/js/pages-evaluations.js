// ==================== EVALUATIONS ====================
let _evalTab = 'forms';
let _builderQuestions = [];
let _builderFormId = null;
let _evalRunEmp = null;
let _evalRunFormId = null;
let _evalScores = {};

function getFormQuestions(form) {
  if (form && form.questionList && form.questionList.length) {
    return form.questionList;
  }
  return [
    'Punctuality, shift attendance & reliable scheduling',
    'Core job execution & task quality',
    'Customer service & member engagement standards',
    'Team collaboration, respect & gym rules adherence',
    'Hygiene, safety protocols & equipment care'
  ];
}

function renderEvaluations() {
  const showAll = DEMO.showAll;
  const canEdit = showAll || hasPermission('evaluations.manage');
  const forms = MOCK.evaluationForms;
  const history = MOCK.evaluationHistory;

  let body = '';
  if (_evalTab === 'forms') {
    body = `<div class="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div>
        <p class="bento-label text-charcoal-500">FORM BUILDER & TEMPLATES</p>
        <p class="text-xs text-charcoal-500 mt-0.5">${forms.length} evaluation forms available</p>
      </div>
      ${canEdit ? `<button onclick="openFormBuilder()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Evaluation Form</button>` : ''}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${forms.map(f => {
        const qList = getFormQuestions(f);
        const isActive = f.status === 'Active';
        return `<div class="bg-white rounded-xl border border-charcoal-200 p-3.5 flex flex-col justify-between hover:border-brand-300 transition-colors">
          <div>
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-bold text-charcoal-900">${f.name}</p>
              ${isActive ? `<span class="badge badge-success text-[9px]">Active</span>` : `<span class="badge badge-gray text-[9px]">Inactive</span>`}
            </div>
            <p class="text-[10px] text-charcoal-500 mt-1">${qList.length} criteria · Target: <span class="font-medium text-charcoal-700">${f.position || f.target || 'All'}</span></p>
            <div class="mt-2.5 space-y-1 bg-charcoal-50 rounded-lg p-2 border border-charcoal-100">
              <p class="text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold mb-1">Criteria preview</p>
              ${qList.slice(0, 3).map((q, qi) => `<p class="text-[10px] text-charcoal-600 truncate">• ${q}</p>`).join('')}
              ${qList.length > 3 ? `<p class="text-[9px] text-charcoal-400">+${qList.length - 3} more criteria...</p>` : ''}
            </div>
          </div>
          <div class="flex gap-1.5 mt-3 pt-2 border-t border-charcoal-100">
            ${canEdit ? `<button class="btn btn-sm btn-secondary flex-1" onclick="openFormBuilder('${f.id}')">Edit Form</button>` : ''}
            ${canEdit && isActive ? `<button class="btn btn-sm btn-primary flex-1" onclick="startEvaluationWithForm('${f.id}')">Run Now</button>` : ''}
            <button class="btn btn-sm btn-ghost flex-1" onclick="_evalTab='history';renderAll()">View Results</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${!canEdit ? `<p class="text-[10px] text-charcoal-400 text-center mt-3">Form Builder is restricted — you do not have <code>evaluations.manage</code>. You can view forms and completed results only.</p>` : ''}`;
  }
  else if (_evalTab === 'run') {
    if (!canEdit) { _evalTab = 'history'; return renderEvaluations(); }
    body = renderEvaluationRunView();
  }
  else {
    const overallAvg = Math.round(history.reduce((s, h) => s + h.score, 0) / mathMax(history.length, 1));
    const done = history.filter(h => h.status === 'Completed').length;
    const inProgress = history.filter(h => h.status === 'In Progress').length;
    const avgByForm = {};
    history.forEach(h => { avgByForm[h.form] = avgByForm[h.form] || { sum: 0, n: 0 }; avgByForm[h.form].sum += h.score; avgByForm[h.form].n++; });
    const formBars = Object.entries(avgByForm).map(([form, v]) => {
      const avg = Math.round(v.sum / v.n);
      return `<div class="flex items-center gap-2">
        <p class="text-[10px] text-charcoal-600 w-44 truncate flex-shrink-0">${form}</p>
        <div class="flex-1 h-1.5 bg-charcoal-100 rounded-full overflow-hidden"><div class="h-full ${avg>=75?'bg-green-500':avg>=60?'bg-yellow-500':'bg-red-500'} rounded-full" style="width:${avg}%"></div></div>
        <p class="text-[10px] font-semibold text-charcoal-800 w-8 text-right">${avg}%</p>
      </div>`;
    }).join('');
    const goalTone = s => s === 'On Track' ? 'text-green-600' : s === 'At Risk' ? 'text-yellow-600' : 'text-red-600';
    const goalsHtml = MOCK.goals.map(g => `<div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between gap-2 flex-wrap"><p class="text-[11px] font-medium text-charcoal-800 leading-snug">${g.title}</p><span class="text-[9px] font-semibold ${goalTone(g.status)}">${g.status}</span></div>
      <p class="text-[9px] text-charcoal-400 mt-0.5">${g.employee} · ${g.owner} · Due ${g.due}</p>
      <div class="w-full h-1.5 bg-charcoal-100 rounded-full mt-2 overflow-hidden"><div class="h-full ${g.status==='On Track'?'bg-green-500':g.status==='At Risk'?'bg-yellow-500':'bg-red-500'} rounded-full" style="width:${g.progress}%"></div></div>
      <p class="text-[9px] text-charcoal-500 mt-1">${g.progress}% complete</p>
    </div>`).join('');
    const cycleChips = MOCK.performanceCycles.map(c => `<span class="px-2.5 py-1.5 rounded-lg border text-[10px] font-medium ${c.status==='Upcoming'?'border-charcoal-200 text-charcoal-500':c.status==='In Progress'?'border-brand-300 bg-brand-50 text-brand-700':'bg-charcoal-50 text-charcoal-500'}">${c.name} · ${c.status}</span>`).join('');
    body = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><p class="text-lg font-bold text-brand-600">${overallAvg}%</p><p class="text-[10px] text-charcoal-500">Avg Score</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-charcoal-900">${done}</p><p class="text-[10px] text-charcoal-500">Completed</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-blue-600">${inProgress}</p><p class="text-[10px] text-charcoal-500">In Progress</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-lg font-bold text-charcoal-900">${history.filter(h=>h.score<60).length}</p><p class="text-[10px] text-charcoal-500">Below Target</p></div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2"><p class="bento-label text-charcoal-500">PERFORMANCE CYCLES</p><span class="text-[10px] text-charcoal-500">Next: Q3 2026 opens Oct 1</span></div>
      <div class="flex flex-wrap gap-1.5">${cycleChips}</div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <p class="bento-label text-charcoal-500 mb-2.5">AVG SCORE BY FORM</p>
        <div class="space-y-2">${formBars}</div>
      </div>
      <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
        <div class="px-3 py-2.5 border-b border-charcoal-100 flex items-center justify-between"><p class="bento-label text-charcoal-500">GOALS & OKRs</p><button onclick="showToast('New goal created')" class="btn btn-sm btn-ghost">+ Add</button></div>
        <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">${goalsHtml}</div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between"><p class="bento-label text-charcoal-500">EVALUATION HISTORY</p>${canEdit ? `<button onclick="_evalTab='run';renderAll()" class="btn btn-sm btn-primary">Run New Evaluation</button>` : ''}</div>
      <div class="divide-y divide-charcoal-50">${history.map(h => `<div class="p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">${h.employee.split(' ').map(w => w[0]).join('')}</div>
            <div><p class="text-xs font-medium text-charcoal-900">${h.employee}</p><p class="text-[9px] text-charcoal-400">${h.form} · ${h.period}</p></div>
          </div>
          <div class="text-right"><p class="text-sm font-bold ${h.score>=75?'text-green-600':h.score>=60?'text-yellow-600':'text-red-600'}">${h.score}%</p><p class="text-[9px] text-charcoal-400">${evalStatusBadge(h.status)}</p></div>
        </div>
        ${h.notes ? `<div class="mt-2 bg-charcoal-50 rounded-lg p-2 text-[10px] text-charcoal-600"><strong>Manager note:</strong> ${h.notes}</div>` : ''}
      </div>`).join('')}</div>
    </div>`;
  }

  const tabs = [{ id: 'forms', label: 'Evaluation Forms' }, { id: 'run', label: 'Run Evaluation' }, { id: 'history', label: 'History & Trends' }];

  return `<div class="space-y-3">
    <div><h1 class="text-xl font-bold text-charcoal-900">Evaluations</h1><p class="text-xs text-charcoal-500 mt-0.5">Build custom review criteria, run evaluations with live scoring, track performance trends</p></div>
    <div class="flex border-b border-charcoal-100">${tabs.map(t => `<button onclick="_evalTab='${t.id}';renderAll()" class="tab-btn ${_evalTab === t.id ? 'active' : ''}">${t.label}</button>`).join('')}</div>
    ${body}
  </div>`;
}

function evalStatusBadge(s) { return `<span class="badge ${s === 'Completed' ? 'badge-success' : s === 'In Progress' ? 'badge-blue' : 'badge-gray'} text-[9px]">${s}</span>`; }

// ==================== FORM BUILDER ====================
function openFormBuilder(id) {
  _builderFormId = id || null;
  const f = id ? MOCK.evaluationForms.find(x => x.id === id) : null;
  _builderQuestions = f ? [...getFormQuestions(f)] : [
    'Punctuality & adherence to shift schedule',
    'Quality of assigned tasks & execution speed',
    'Customer interaction & satisfaction',
    'Teamwork and gym cleanliness protocols'
  ];
  renderFormBuilderModal();
}

function renderFormBuilderModal() {
  const f = _builderFormId ? MOCK.evaluationForms.find(x => x.id === _builderFormId) : null;
  const qList = _builderQuestions;

  const qHtml = qList.map((q, i) => `<div class="bg-charcoal-50 rounded-xl p-3 border border-charcoal-200 flex items-start gap-2.5">
    <span class="w-6 h-6 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-1">${i + 1}</span>
    <div class="flex-1">
      <input type="text" class="form-input text-xs" value="${q.replace(/"/g, '&quot;')}" oninput="_builderQuestions[${i}]=this.value" placeholder="Enter review criterion or question...">
    </div>
    <div class="flex items-center gap-1">
      ${i > 0 ? `<button type="button" onclick="moveBuilderQuestion(${i},-1)" class="btn btn-sm btn-ghost p-1.5" title="Move up">↑</button>` : ''}
      ${i < qList.length - 1 ? `<button type="button" onclick="moveBuilderQuestion(${i},1)" class="btn btn-sm btn-ghost p-1.5" title="Move down">↓</button>` : ''}
      <button type="button" onclick="removeBuilderQuestion(${i})" class="text-charcoal-300 hover:text-red-500 p-1.5" title="Remove"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
    </div>
  </div>`).join('');

  openModal(`${f ? 'Edit' : 'Create'} Evaluation Form`, `<form onsubmit="event.preventDefault();saveFormBuilder();" class="space-y-3">
    <div><label class="form-label">Form Title *</label><input id="builder-name" class="form-input" value="${f ? f.name : 'Staff Quarterly Evaluation'}" required></div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label class="form-label">Target Role</label>
        <select id="builder-target" class="form-select">
          <option ${f && (f.position==='Trainer'||f.target==='Trainer')?'selected':''}>Trainer</option>
          <option ${f && (f.position==='Receptionist'||f.target==='Receptionist')?'selected':''}>Receptionist</option>
          <option ${f && (f.position==='Cleaner'||f.target==='Cleaner')?'selected':''}>Cleaner</option>
          <option ${f && (f.position==='Maintenance'||f.target==='Maintenance')?'selected':''}>Maintenance</option>
          <option ${f && (f.position==='All'||f.target==='All Staff'||!f)?'selected':''}>All Staff</option>
        </select>
      </div>
      <div>
        <label class="form-label">Gym Scope</label>
        <select id="builder-gym" class="form-select">
          <option>All</option>
          ${MOCK.gymList.map(g => `<option ${f && f.gym===g.branch?'selected':''}>${g.branch}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label">Status</label>
        <select id="builder-status" class="form-select">
          <option ${!f || f.status==='Active'?'selected':''}>Active</option>
          <option ${f && f.status==='Completed'?'selected':''}>Completed</option>
          <option ${f && f.status==='Inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
    </div>
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label class="form-label mb-0">Evaluation Criteria (${qList.length})</label>
        <button type="button" onclick="addBuilderQuestion()" class="btn btn-sm btn-ghost text-brand-600 text-xs font-semibold">+ Add Question</button>
      </div>
      <div class="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
        ${qHtml}
      </div>
    </div>
    <div class="flex justify-end gap-2 pt-2 border-t border-charcoal-100">
      <button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="submit" class="btn btn-sm btn-primary">Save Form</button>
    </div>
  </form>`, { wide: true });
}

function addBuilderQuestion() {
  _builderQuestions.push('New evaluation criterion');
  renderFormBuilderModal();
}

function removeBuilderQuestion(idx) {
  if (_builderQuestions.length <= 1) {
    showToast('A form must have at least one question', 'error');
    return;
  }
  _builderQuestions.splice(idx, 1);
  renderFormBuilderModal();
}

function moveBuilderQuestion(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= _builderQuestions.length) return;
  const temp = _builderQuestions[idx];
  _builderQuestions[idx] = _builderQuestions[target];
  _builderQuestions[target] = temp;
  renderFormBuilderModal();
}

function saveFormBuilder() {
  const name = document.getElementById('builder-name')?.value.trim();
  const target = document.getElementById('builder-target')?.value;
  const gym = document.getElementById('builder-gym')?.value || 'All';
  const status = document.getElementById('builder-status')?.value || 'Active';
  if (!name) { showToast('Form title is required', 'error'); return; }

  const cleanQuestions = _builderQuestions.map(q => q.trim()).filter(Boolean);
  if (!cleanQuestions.length) { showToast('Add at least one criterion', 'error'); return; }

  if (_builderFormId) {
    const f = MOCK.evaluationForms.find(x => x.id === _builderFormId);
    if (f) {
      f.name = name;
      f.target = target;
      f.position = target;
      f.gym = gym;
      f.status = status;
      f.questionList = cleanQuestions;
      f.questions = cleanQuestions.length;
      showToast(`Evaluation form "${name}" updated`);
    }
  } else {
    const newForm = {
      id: 'ef-' + Date.now(),
      name,
      target,
      position: target,
      gym,
      status,
      questionList: cleanQuestions,
      questions: cleanQuestions.length,
      createdDate: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never'
    };
    MOCK.evaluationForms.unshift(newForm);
    MOCK.auditLog.unshift({
      id: 'al-' + Date.now(),
      action: 'Evaluation Form Created',
      user: MOCK.currentUser.fullName,
      target: name,
      detail: `Created evaluation form with ${cleanQuestions.length} criteria for ${target}`,
      timestamp: '2026-09-09',
      gym: gym
    });
    showToast(`New form "${name}" created`);
  }
  closeModal();
  renderAll();
}

// ==================== RUN EVALUATION ====================
function startEvaluationWithForm(formId) {
  _evalTab = 'run';
  _evalRunFormId = formId;
  _evalScores = {};
  renderAll();
}

function renderEvaluationRunView() {
  const activeForms = MOCK.evaluationForms.filter(f => f.status === 'Active');
  const selectedForm = (activeForms.find(f => f.id === _evalRunFormId) || activeForms[0] || MOCK.evaluationForms[0]);
  if (!_evalRunFormId && selectedForm) _evalRunFormId = selectedForm.id;

  const eligibleEmployees = MOCK.employees.filter(e => {
    if (e.status !== 'Active') return false;
    if (selectedForm && selectedForm.position && selectedForm.position !== 'All' && selectedForm.position !== 'All Staff') {
      return e.position === selectedForm.position;
    }
    return true;
  });

  const selectedEmp = _evalRunEmp ? MOCK.employees.find(e => e.name === _evalRunEmp) : eligibleEmployees[0];
  if (!_evalRunEmp && selectedEmp) _evalRunEmp = selectedEmp.name;

  const questions = getFormQuestions(selectedForm);

  // Initialize scores default to 4 if not set
  questions.forEach((_, qi) => {
    if (_evalScores[qi] === undefined) _evalScores[qi] = 4;
  });

  const totalPoints = Object.values(_evalScores).reduce((a, b) => a + b, 0);
  const maxPoints = questions.length * 5;
  const percentScore = Math.round((totalPoints / maxPoints) * 100);

  const questionRows = questions.map((q, qi) => {
    const currentScore = _evalScores[qi] || 4;
    return `<div class="bg-white rounded-xl border border-charcoal-200 p-3 mb-2.5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p class="text-xs font-semibold text-charcoal-900 leading-snug"><span class="text-brand-600 font-bold mr-1.5">${qi + 1}.</span>${q}</p>
        <div class="flex items-center gap-1 flex-shrink-0">
          ${[1, 2, 3, 4, 5].map(rating => {
            const isSel = currentScore === rating;
            const labels = ['', 'Poor (1)', 'Fair (2)', 'Good (3)', 'Very Good (4)', 'Excellent (5)'];
            return `<button type="button" onclick="setEvalScore(${qi}, ${rating})" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${isSel ? 'bg-brand-500 text-white border-brand-500 shadow-sm' : 'bg-charcoal-50 text-charcoal-700 border-charcoal-200 hover:bg-charcoal-100'}" title="${labels[rating]}">${rating}</button>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <!-- Left Column: Setup & Score Preview -->
    <div class="space-y-3">
      <div class="bg-white rounded-xl border border-charcoal-200 p-4">
        <p class="bento-label text-charcoal-500 mb-3">SELECT EMPLOYEE & FORM</p>
        <div class="space-y-3">
          <div>
            <label class="form-label">Evaluation Form</label>
            <select class="form-select" onchange="_evalRunFormId=this.value;_evalScores={};renderAll()">
              ${activeForms.map(f => `<option value="${f.id}" ${f.id===selectedForm?.id?'selected':''}>${f.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Employee to Review</label>
            <select class="form-select" onchange="_evalRunEmp=this.value;renderAll()">
              ${eligibleEmployees.map(e => `<option value="${e.name}" ${e.name===selectedEmp?.name?'selected':''}>${e.name} (${e.position} · ${e.gym})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Review Period</label>
            <select id="eval-period" class="form-select">
              <option>Q3 2026</option>
              <option>Mid-Year Review 2026</option>
              <option>Probation Review</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Live Score Badge -->
      <div class="bg-white rounded-xl border border-brand-200 border-l-4 border-l-brand-500 p-4 text-center">
        <p class="text-[10px] uppercase font-bold text-charcoal-400 tracking-wider">LIVE CALCULATED SCORE</p>
        <p class="text-3xl font-extrabold ${percentScore>=75?'text-green-600':percentScore>=60?'text-yellow-600':'text-red-600'} mt-1">${percentScore}%</p>
        <p class="text-xs font-semibold text-charcoal-700 mt-1">${percentScore>=85?'Outstanding':percentScore>=75?'Exceeds Expectations':percentScore>=60?'Meets Expectations':'Needs Improvement'}</p>
        <div class="w-full h-2 bg-charcoal-100 rounded-full mt-2.5 overflow-hidden">
          <div class="h-full ${percentScore>=75?'bg-green-500':percentScore>=60?'bg-yellow-500':'bg-red-500'} rounded-full transition-all" style="width:${percentScore}%"></div>
        </div>
        <p class="text-[10px] text-charcoal-400 mt-1">${totalPoints} / ${maxPoints} points across ${questions.length} criteria</p>
      </div>

      <!-- Quick Batch Launch -->
      <div class="bg-charcoal-50 rounded-xl p-3 border border-charcoal-200">
        <p class="text-xs font-semibold text-charcoal-800">Launch Bulk Cycle</p>
        <p class="text-[10px] text-charcoal-500 mt-0.5">Need to assign evaluations to all gym staff at once?</p>
        <button onclick="launchBatchCycle('${selectedForm?.name || 'Evaluation'}')" class="btn btn-sm btn-secondary w-full mt-2">Launch Cycle for All Eligible (${eligibleEmployees.length})</button>
      </div>
    </div>

    <!-- Right Column: Interactive Evaluation Form -->
    <div class="lg:col-span-2 space-y-3">
      <div class="bg-charcoal-50 rounded-xl p-3 border border-charcoal-200 flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-charcoal-900">${selectedEmp ? selectedEmp.name : 'Select Employee'} — ${selectedForm ? selectedForm.name : ''}</p>
          <p class="text-[10px] text-charcoal-500">${selectedEmp ? `${selectedEmp.position} · ${selectedEmp.level} · ${selectedEmp.gym}` : ''}</p>
        </div>
        <span class="badge badge-brand text-[10px]">1 = Poor, 5 = Excellent</span>
      </div>

      <div class="space-y-0 max-h-[52vh] overflow-y-auto pr-1">
        ${questionRows}
      </div>

      <div class="bg-white rounded-xl border border-charcoal-200 p-3">
        <label class="form-label">Manager Feedback & Development Plan</label>
        <textarea id="eval-notes" class="form-input" rows="2" placeholder="Highlight key achievements, areas for coaching, and recommended training..."></textarea>
        <div class="flex justify-between items-center mt-3 pt-2 border-t border-charcoal-100">
          <button onclick="_evalTab='forms';renderAll()" class="btn btn-sm btn-secondary">Cancel</button>
          <button onclick="submitEvaluation('${selectedEmp?.name}','${selectedForm?.name}')" class="btn btn-sm btn-primary">Submit Evaluation (${percentScore}%) ✓</button>
        </div>
      </div>
    </div>
  </div>`;
}

function setEvalScore(questionIdx, score) {
  _evalScores[questionIdx] = score;
  renderAll();
}

function submitEvaluation(empName, formName) {
  if (!empName) { showToast('Please select an employee', 'error'); return; }
  const period = document.getElementById('eval-period')?.value || 'Q3 2026';
  const notes = document.getElementById('eval-notes')?.value.trim() || 'Evaluation completed with standard scoring.';

  const form = MOCK.evaluationForms.find(f => f.name === formName);
  const questions = getFormQuestions(form);
  const totalPoints = Object.values(_evalScores).reduce((a, b) => a + b, 0);
  const maxPoints = questions.length * 5;
  const scorePercent = Math.round((totalPoints / maxPoints) * 100);

  const emp = MOCK.employees.find(e => e.name === empName);

  const newEntry = {
    id: 'eh-' + Date.now(),
    employee: empName,
    form: formName || 'Performance Review',
    period: period,
    score: scorePercent,
    status: 'Completed',
    notes: notes,
    gym: emp ? emp.gym : 'Nasr City'
  };

  MOCK.evaluationHistory.unshift(newEntry);
  if (MOCK.dashboardStats && MOCK.dashboardStats.overdueEvaluations > 0) {
    MOCK.dashboardStats.overdueEvaluations--;
  }

  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Evaluation Completed',
    user: MOCK.currentUser.fullName,
    target: empName,
    detail: `${formName} completed — Score: ${scorePercent}% (${period})`,
    timestamp: '2026-09-09',
    gym: emp ? emp.gym : 'Nasr City'
  });

  showToast(`Evaluation submitted for ${empName} (${scorePercent}%)`);
  _evalTab = 'history';
  renderAll();
}

function launchBatchCycle(formName) {
  const count = 4;
  MOCK.evaluationHistory.unshift({
    id: 'eh-' + Date.now(),
    employee: 'Ahmed Zaki',
    form: formName,
    period: 'Q3 2026',
    score: 0,
    status: 'In Progress',
    notes: 'Periodic evaluation round launched.'
  });
  showToast(`Evaluation round launched for ${count} staff members`);
  _evalTab = 'history';
  renderAll();
}