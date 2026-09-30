// ==================== EVALUATIONS ====================
let _evalTab = 'forms';
let _evalRunEmp = null;
let _evalRunFormId = null;
let _evalScores = {};
let _evalAnswers = {};   // typed answers per question: string (text/choose) or array (checkbox)

// Normalizes questions to { type, text, options } objects. Legacy forms store plain
// strings (or none at all) — those are treated as open (text) questions.
function getFormQuestions(form) {
  const raw = (form && form.questionList && form.questionList.length) ? form.questionList : [
    'Punctuality, shift attendance & reliable scheduling',
    'Core job execution & task quality',
    'Customer service & member engagement standards',
    'Team collaboration, respect & gym rules adherence',
    'Hygiene, safety protocols & equipment care'
  ];
  return raw.map(q => (typeof q === 'string'
    ? { type: 'text', text: q, options: [] }
    : { type: q.type || 'text', text: q.text || '', options: q.options || [] }));
}

// ==================== ONE PAGE: Evaluations + Form Builder merged ====================
// In-page states: main (header + current running forms + old forms) → form detail →
// editor → run view → history. The standalone "Form Builder" page was folded in here.
function renderEvaluations() {
  if (_fbEditing && _fbDraft) return fbEditorPage();
  if (_evalTab === 'run') {
    if (!canRunEvaluations()) _evalTab = 'forms';
    else return evalRunPage();
  }
  if (_evalTab === 'history') {
    const canRun = canRunEvaluations();
    const history = MOCK.evaluationHistory;
    let body = '';
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
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center border-l-4 border-l-brand-500"><p class="text-base font-bold text-brand-600">${overallAvg}%</p><p class="text-[10px] text-charcoal-500">Avg Score</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-base font-bold text-charcoal-900">${done}</p><p class="text-[10px] text-charcoal-500">Completed</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-base font-bold text-blue-600">${inProgress}</p><p class="text-[10px] text-charcoal-500">In Progress</p></div>
      <div class="bg-white rounded-xl border border-charcoal-200 p-3 text-center"><p class="text-base font-bold text-charcoal-900">${history.filter(h=>h.score<60).length}</p><p class="text-[10px] text-charcoal-500">Below Target</p></div>
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
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between"><p class="bento-label text-charcoal-500">EVALUATION HISTORY</p>${canRun ? `<button onclick="_evalTab='run';renderAll()" class="btn btn-sm btn-primary">Run New Evaluation</button>` : ''}</div>
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

    return `<div class="space-y-2.5">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 class="text-base font-bold text-charcoal-900">History &amp; Trends</h1>
          <p class="text-xs text-charcoal-500 mt-0.5">Performance cycles, average scores by form &amp; completed evaluations</p>
        </div>
        <button onclick="_fbDetailId=null;_evalTab='forms';renderAll()" class="btn btn-sm btn-ghost">← All Forms</button>
      </div>
      ${body}
    </div>`;
  }
  if (_fbDetailId) {
    const f = fbFind(_fbDetailId);
    if (f) return fbDetailPage(f);
    _fbDetailId = null; // form was deleted
  }
  return evalMainPage();
}

function evalRunPage() {
  return `<div class="space-y-2.5">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <h1 class="text-base font-bold text-charcoal-900">Run Evaluation</h1>
        <p class="text-xs text-charcoal-500 mt-0.5">Pick an employee, score each criterion live and type answers — the submission lands in the form's responses</p>
      </div>
      <button onclick="_evalTab='forms';renderAll()" class="btn btn-sm btn-ghost">← All Forms</button>
    </div>
    ${renderEvaluationRunView()}
  </div>`;
}

// ---- merged main page: header (Create New Form top-right) + running forms + old forms ----
function evalMainPage() {
  const canBuild = canBuildEvalForms();
  const canRun = canRunEvaluations();
  const running = MOCK.evaluationForms.filter(f => f.status === 'Active');
  const runningIds = running.map(f => f.id);

  const head = `<div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-base font-bold text-charcoal-900">Form Builder</h1>
        <p class="text-xs text-charcoal-500 mt-0.5">Create evaluation &amp; hiring forms, run them, and review every response — all in one place</p>
      </div>
      ${canBuild ? `<button onclick="fbNew()" class="btn btn-primary"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Create New Form</button>` : ''}
    </div>
    ${canBuild ? '' : `<p class="text-[10px] text-charcoal-400">View-only access — creating &amp; editing forms requires <code>evaluations.forms.manage</code> (HR Manager).</p>`}`;

  const tabs = `<div class="inline-flex flex-wrap items-center gap-1 bg-charcoal-100 rounded-xl p-1 border border-charcoal-200">
      <button onclick="_fbFilter='evaluation';renderAll()" class="tab-btn ${_fbFilter !== 'hiring' ? 'active' : ''}">Evaluation <span class="badge badge-brand text-[9px] ml-0.5">${MOCK.evaluationForms.length}</span></button>
      <button onclick="_fbFilter='hiring';renderAll()" class="tab-btn ${_fbFilter === 'hiring' ? 'active' : ''}">Hiring <span class="badge badge-blue text-[9px] ml-0.5">${MOCK.hiringForms.length}</span></button>
    </div>`;

  const runningSection = `<div>
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div class="flex items-center gap-2">
          <p class="bento-label text-charcoal-500">CURRENT RUNNING FORM${running.length === 1 ? '' : 'S'}</p>
          ${running.length ? `<span class="badge badge-brand text-[9px]">${running.length}</span>` : ''}
        </div>
        ${canRun && running.length ? `<button onclick="_evalTab='run';renderAll()" class="btn btn-sm btn-primary">Run Evaluation</button>` : ''}
      </div>
      ${running.length
        ? `<div class="grid grid-cols-1 lg:grid-cols-2 gap-3">${running.map(f => evalRunningCard(f, canBuild, canRun)).join('')}</div>`
        : fbEmpty('No form is running right now', canBuild ? 'Click "Create New Form" to build one, then keep its status Active.' : 'No active evaluation forms are available.')}
    </div>`;

  const evalItems = MOCK.evaluationForms.filter(f => !runningIds.includes(f.id));

  const oldSection = `<div>
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="bento-label text-charcoal-500">OLD FORMS</p>
          <span class="text-[10px] text-charcoal-400">Click a form to see who completed it &amp; their answers</span>
        </div>
        <button onclick="_evalTab='history';renderAll()" class="btn btn-sm btn-ghost">History &amp; Trends →</button>
      </div>
      ${evalItems.length
        ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${evalItems.map(f => fbCardHtml(f, 'evaluation')).join('')}</div>`
        : fbEmpty('No forms here', canBuild ? 'Click "Create New Form" to create your first form.' : 'No forms have been created yet.')}
    </div>`;

  const hiringSection = `<div>
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="bento-label text-charcoal-500">HIRING FORMS</p>
          ${MOCK.hiringForms.length ? `<span class="badge badge-blue text-[9px]">${MOCK.hiringForms.length}</span>` : ''}
          <span class="text-[10px] text-charcoal-400">Click a form to see who applied &amp; their answers</span>
        </div>
      </div>
      ${MOCK.hiringForms.length
        ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${MOCK.hiringForms.map(f => fbCardHtml(f, 'hiring')).join('')}</div>`
        : fbEmpty('No hiring forms yet', canBuild ? 'Click "Create New Form" to create your first one.' : 'No hiring forms have been created yet.')}
    </div>`;

  const body = _fbFilter === 'hiring' ? hiringSection : `${runningSection}${oldSection}`;
  return `<div class="space-y-4">${head}${tabs}${body}</div>`;
}

function evalRunningCard(f, canBuild, canRun) {
  const qs = getFormQuestions(f);
  const subs = fbSubmissionsFor(f);
  const inProg = subs.filter(s => s.status === 'In Progress').length;
  return `<div class="bg-white rounded-xl border border-charcoal-200 border-l-4 border-l-brand-500 px-3 py-2.5">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="badge badge-success text-[9px]">Active</span>
        <span class="badge badge-brand text-[9px]">Evaluation</span>
        ${inProg ? `<span class="badge badge-blue text-[9px]">${inProg} in progress</span>` : ''}
      </div>
      <div class="flex items-center gap-1.5">
        ${canRun ? `<button onclick="startEvaluationWithForm('${f.id}')" class="btn btn-sm btn-primary">Run Now</button>` : ''}
        ${canBuild ? `<button onclick="fbEdit('evaluation','${f.id}')" class="btn btn-sm btn-secondary">Edit</button>` : ''}
      </div>
    </div>
    <p class="text-xs font-bold text-charcoal-900 mt-1.5">${fbEsc(f.name)}</p>
    <p class="text-[10px] text-charcoal-500 mt-0.5">${qs.length} questions · Target: <span class="font-medium text-charcoal-700">${fbEsc(f.position || f.target || 'All Staff')}</span> · ${f.gym === 'All' ? 'All branches' : fbEsc(f.gym)}${f.createdDate ? ` · Created ${f.createdDate}` : ''}</p>
    ${qs.length ? `<p class="text-[10px] text-charcoal-400 truncate mt-1" title="${fbEsc(qs[0].text)}">• ${fbEsc(qs[0].text)}${qs.length > 1 ? ` +${qs.length - 1} more…` : ''}</p>` : ''}
    <div class="flex items-center justify-between mt-1.5 pt-1.5 border-t border-charcoal-100">
      <p class="text-[10px] text-charcoal-500">${subs.length} submission${subs.length === 1 ? '' : 's'}${inProg ? ` · ${inProg} in progress` : ''}</p>
      <button onclick="fbOpenDetail('${f.id}')" class="text-[10px] font-semibold text-brand-600 hover:underline">View Responses →</button>
    </div>
  </div>`;
}

function evalStatusBadge(s) { return `<span class="badge ${s === 'Completed' ? 'badge-success' : s === 'In Progress' ? 'badge-blue' : 'badge-gray'} text-[9px]">${s}</span>`; }

// ==================== FORM BUILDER ====================
function canBuildEvalForms() { return DEMO.showAll || hasPermission('evaluations.forms.manage'); }
function canRunEvaluations() { return DEMO.showAll || hasPermission('evaluations.manage'); }


// Form building lives on this same page (js/pages-forms.js → fbNew / fbEdit).


// ==================== RUN EVALUATION ====================
function startEvaluationWithForm(formId) {
  _evalTab = 'run';
  _fbDetailId = null; // run view is entered from the merged page — Back returns to it
  _evalRunFormId = formId;
  _evalScores = {};
  _evalAnswers = {};
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

    // Typed answer input: open question → textarea, choose → single-select buttons,
    // checkbox → multi-select checkboxes. Scoring stays on the 1–5 rating row.
    let inputHtml = '';
    if (q.type === 'choose') {
      inputHtml = `<div class="flex flex-wrap gap-1.5 mt-2">${q.options.map((o, oi) => {
        const sel = _evalAnswers[qi] === o;
        return `<button type="button" onclick="evalPickChoice(${qi},${oi})" class="px-2.5 py-1 text-xs rounded-lg border transition-all ${sel ? 'bg-brand-50 text-brand-700 border-brand-500 font-semibold' : 'bg-white text-charcoal-700 border-charcoal-200 hover:bg-charcoal-50'}">${fbEsc(o)}</button>`;
      }).join('')}</div>`;
    } else if (q.type === 'checkbox') {
      const cur = Array.isArray(_evalAnswers[qi]) ? _evalAnswers[qi] : [];
      inputHtml = `<div class="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">${q.options.map((o, oi) => {
        const on = cur.includes(o);
        return `<label class="flex items-center gap-1.5 text-xs text-charcoal-700 cursor-pointer"><input type="checkbox" ${on ? 'checked' : ''} onchange="evalToggleCheck(${qi},${oi})"> ${fbEsc(o)}</label>`;
      }).join('')}</div>`;
    } else {
      inputHtml = `<textarea rows="2" class="form-input text-xs mt-2" placeholder="Write your answer..." oninput="_evalAnswers[${qi}]=this.value">${fbEsc(_evalAnswers[qi] || '')}</textarea>`;
    }

    return `<div class="bg-white rounded-xl border border-charcoal-200 p-3 mb-2.5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p class="text-xs font-semibold text-charcoal-900 leading-snug min-w-0"><span class="text-brand-600 font-bold mr-1.5">${qi + 1}.</span>${fbEsc(q.text)} <span class="badge badge-brand text-[8px] align-middle">${fbTypeLabel(q.type)}</span></p>
        <div class="flex items-center gap-1 flex-shrink-0">
          ${[1, 2, 3, 4, 5].map(rating => {
            const isSel = currentScore === rating;
            const labels = ['', 'Poor (1)', 'Fair (2)', 'Good (3)', 'Very Good (4)', 'Excellent (5)'];
            return `<button type="button" onclick="setEvalScore(${qi}, ${rating})" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${isSel ? 'bg-brand-500 text-white border-brand-500 shadow-sm' : 'bg-charcoal-50 text-charcoal-700 border-charcoal-200 hover:bg-charcoal-100'}" title="${labels[rating]}">${rating}</button>`;
          }).join('')}
        </div>
      </div>
      ${inputHtml}
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
            <select class="form-select" onchange="_evalRunFormId=this.value;_evalScores={};_evalAnswers={};renderAll()">
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

// Form currently loaded in the run view (used by the typed-answer handlers).
function currentEvalForm() {
  const activeForms = MOCK.evaluationForms.filter(f => f.status === 'Active');
  return activeForms.find(f => f.id === _evalRunFormId) || activeForms[0] || MOCK.evaluationForms[0];
}
function evalPickChoice(qi, oi) {
  const qs = getFormQuestions(currentEvalForm());
  if (!qs[qi]) return;
  _evalAnswers[qi] = qs[qi].options[oi] || '';
  renderAll();
}
function evalToggleCheck(qi, oi) {
  const qs = getFormQuestions(currentEvalForm());
  const opts = qs[qi] ? qs[qi].options : [];
  const val = opts[oi];
  if (val === undefined) return;
  const cur = Array.isArray(_evalAnswers[qi]) ? _evalAnswers[qi] : [];
  _evalAnswers[qi] = cur.includes(val) ? cur.filter(v => v !== val) : cur.concat([val]);
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

  // Capture the typed answer for every question so the submission can be reviewed later.
  const answers = questions.map((q, qi) => ({
    question: q.text,
    type: q.type,
    answer: _evalAnswers[qi] !== undefined ? _evalAnswers[qi] : (q.type === 'checkbox' ? [] : '')
  }));

  const newEntry = {
    id: 'eh-' + Date.now(),
    employee: empName,
    form: formName || 'Performance Review',
    formId: form ? form.id : null,
    period: period,
    score: scorePercent,
    status: 'Completed',
    notes: notes,
    reviewedBy: MOCK.currentUser.fullName,
    reviewedDate: '2026-09-09',
    answers: answers,
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
  _evalScores = {};
  _evalAnswers = {};
  _fbDetailId = null; // always land on History & Trends after submitting
  _evalTab = 'history';
  renderAll();
}

function launchBatchCycle(formName) {
  const count = 4;
  MOCK.evaluationHistory.unshift({
    id: 'eh-' + Date.now(),
    employee: 'Ahmed Zaki',
    form: formName,
    formId: (MOCK.evaluationForms.find(f => f.name === formName) || {}).id || null,
    period: 'Q3 2026',
    score: 0,
    status: 'In Progress',
    notes: 'Periodic evaluation round launched.'
  });
  showToast(`Evaluation round launched for ${count} staff members`);
  _evalTab = 'history';
  renderAll();
}