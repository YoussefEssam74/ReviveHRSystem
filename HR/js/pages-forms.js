// ==================== FORMS (merged into the Evaluations page) ====================
// In-page builder for Evaluation + Hiring forms (typed questions: text / checkbox / choose).
// renderEvaluations (js/pages-evaluations.js) hosts everything: Create New Form → editor,
// current running form → run/edit, old forms → detail (who completed + answers). This
// file only holds the form primitives; the legacy 'form-builder' route aliases Evaluations.
let _fbMode = 'evaluation';   // 'evaluation' | 'hiring' — kind being created/edited
let _fbEditing = false;
let _fbId = null;             // id of the form being edited (null = new)
let _fbDraft = null;          // { name, position, gym, status, questionList: [{type,text,options}] }
let _fbFilter = 'evaluation'; // active page tab: 'evaluation' | 'hiring' (fbNew picks kind from it)
let _fbDetailId = null;       // id of the form opened in detail view (null = list)
let _fbQsOpen = false;        // detail-view QUESTIONS panel: collapsed by default (button toggles)

function fbEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fbTypeLabel(t) { return t === 'checkbox' ? 'Checkboxes' : t === 'choose' ? 'Choose Option' : 'Open Question'; }
function fbKindOf(id) { return String(id || '').startsWith('hf') ? 'hiring' : 'evaluation'; }
function fbFind(id) {
  const arr = fbKindOf(id) === 'hiring' ? MOCK.hiringForms : MOCK.evaluationForms;
  return arr.find(f => f.id === id) || null;
}
function fbEmpty(title, sub) {
  return `<div class="bg-white rounded-xl border border-dashed border-charcoal-300 p-8 text-center"><p class="text-sm font-semibold text-charcoal-700">${title}</p><p class="text-xs text-charcoal-500 mt-1">${sub}</p></div>`;
}

// ==================== FORM BUILDER (now folded into the Evaluations page) ====================
// The legacy 'form-builder' route renders the same merged Evaluations page so any
// stale link or button still lands somewhere useful.
function renderFormBuilder() { return renderEvaluations(); }

function fbEditorPage() {
  return `<div class="space-y-2.5">
    <div>
      <h1 class="text-base font-bold text-charcoal-900">Form Builder</h1>
      <p class="text-xs text-charcoal-500 mt-0.5">${_fbId ? 'Editing form' : 'Creating a new form'} — each question can be an open question, checkboxes, or a choose option</p>
    </div>
    ${fbEditorHtml()}
  </div>`;
}

function fbCardHtml(f, kind) {
  const isEval = kind === 'evaluation';
  const qs = isEval ? getFormQuestions(f) : (f.questionList || []);
  const subs = isEval ? fbSubmissionsFor(f).length : 0;
  const apps = isEval ? [] : MOCK.hiringApplicants.filter(a => a.formId === f.id);
  const openApps = apps.filter(a => ['New', 'In Review', 'Shortlisted'].includes(a.status)).length;
  const statusOk = isEval ? f.status === 'Active' : f.status === 'Open';
  return `<div class="bg-white rounded-xl border border-charcoal-200 p-3.5 flex flex-col justify-between hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer" onclick="fbOpenDetail('${f.id}')">
    <div>
      <div class="flex items-center justify-between gap-2">
        <span class="badge ${isEval ? 'badge-brand' : 'badge-blue'} text-[9px]">${isEval ? 'Evaluation' : 'Hiring'}</span>
        ${statusOk ? `<span class="badge badge-success text-[9px]">${f.status}</span>` : `<span class="badge badge-gray text-[9px]">${f.status}</span>`}
      </div>
      <p class="text-xs font-bold text-charcoal-900 mt-1.5">${fbEsc(f.name)}</p>
      <p class="text-[10px] text-charcoal-500 mt-0.5">${qs.length} questions · ${fbEsc(f.position || 'All')} · ${f.gym === 'All' ? 'All branches' : fbEsc(f.gym)}</p>
      <div class="mt-2.5 space-y-1 bg-charcoal-50 rounded-lg p-2 border border-charcoal-100">
        <p class="text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold mb-1">Questions</p>
        ${qs.slice(0, 3).map(q => `<p class="text-[10px] text-charcoal-600 truncate">• ${fbEsc(q.text)}${q.type !== 'text' ? ` <span class="badge badge-brand text-[8px]">${fbTypeLabel(q.type)}</span>` : ''}</p>`).join('')}
        ${qs.length > 3 ? `<p class="text-[9px] text-charcoal-400">+${qs.length - 3} more…</p>` : ''}
      </div>
    </div>
    <div class="flex items-center justify-between mt-3 pt-2 border-t border-charcoal-100">
      <p class="text-[10px] text-charcoal-500">${isEval ? `${subs} submission${subs === 1 ? '' : 's'}` : `${apps.length} applicant${apps.length === 1 ? '' : 's'}${openApps ? ` · ${openApps} open` : ''}`}</p>
      <p class="text-[10px] font-semibold text-brand-600">Open →</p>
    </div>
  </div>`;
}

function fbOpenDetail(id) { _fbDetailId = id; _fbEditing = false; _fbMode = fbKindOf(id); _fbQsOpen = false; renderAll(); }
function fbCloseDetail() { _fbDetailId = null; _fbQsOpen = false; renderAll(); }
function fbToggleQs() { _fbQsOpen = !_fbQsOpen; renderAll(); }
function fbSubmissionsFor(f) {
  return MOCK.evaluationHistory.filter(h => h.formId === f.id || (!h.formId && h.form === f.name));
}

function fbDetailPage(f) {
  const kind = fbKindOf(f.id);
  const isEval = kind === 'evaluation';
  const canBuild = canBuildEvalForms();
  const canRun = canRunEvaluations();
  const qs = isEval ? getFormQuestions(f) : (f.questionList || []);
  const subs = isEval ? fbSubmissionsFor(f) : [];
  const apps = isEval ? [] : MOCK.hiringApplicants.filter(a => a.formId === f.id);

  const actions = [
    canRun && isEval && f.status === 'Active' ? `<button onclick="fbRunFromBuilder('${f.id}')" class="btn btn-sm btn-primary">Run Now</button>` : '',
    !isEval ? `<button onclick="openHiringFormPreview('${f.id}')" class="btn btn-sm btn-secondary">Preview &amp; Apply</button>` : '',
    canBuild ? `<button onclick="fbEdit('${kind}','${f.id}')" class="btn btn-sm btn-secondary">Edit</button>` : '',
    canBuild ? `<button onclick="fbDelete('${kind}','${f.id}')" class="btn btn-sm btn-danger-outline">Delete</button>` : '',
  ].join('');

  const questionsHtml = qs.map((q, i) => `<div class="flex items-start gap-2.5 bg-charcoal-50 rounded-lg border border-charcoal-200 p-2.5">
      <span class="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">${i + 1}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <p class="text-xs font-semibold text-charcoal-800">${fbEsc(q.text)}</p>
          <span class="badge badge-brand text-[8px] flex-shrink-0">${fbTypeLabel(q.type)}</span>
        </div>
        ${q.options && q.options.length ? `<div class="flex flex-wrap gap-1 mt-1.5">${q.options.map(o => `<span class="text-[9px] bg-white border border-charcoal-200 rounded px-1.5 py-0.5 text-charcoal-600">${fbEsc(o)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`).join('');

  return `<div class="space-y-2.5">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <button onclick="fbCloseDetail()" class="btn btn-sm btn-ghost">← All Forms</button>
      <div class="flex items-center gap-1.5 flex-wrap">${actions}</div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="badge ${isEval ? 'badge-brand' : 'badge-blue'} text-[9px]">${isEval ? 'Evaluation Form' : 'Hiring Form'}</span>
        <p class="text-sm font-bold text-charcoal-900">${fbEsc(f.name)}</p>
        ${f.status === 'Active' || f.status === 'Open' ? `<span class="badge badge-success text-[9px]">${f.status}</span>` : `<span class="badge badge-gray text-[9px]">${f.status}</span>`}
      </div>
      <div class="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2 text-[10px] text-charcoal-500">
        <span>Target: <span class="font-semibold text-charcoal-700">${fbEsc(f.position || (isEval ? 'All Staff' : 'All Positions'))}</span></span>
        <span>Branches: <span class="font-semibold text-charcoal-700">${f.gym === 'All' ? 'All' : fbEsc(f.gym)}</span></span>
        <span>Questions: <span class="font-semibold text-charcoal-700">${qs.length}</span></span>
        ${f.createdDate ? `<span>Created: <span class="font-semibold text-charcoal-700">${f.createdDate}</span></span>` : ''}
        <span>${isEval ? 'Submissions' : 'Applicants'}: <span class="font-semibold text-charcoal-700">${isEval ? subs.length : apps.length}</span></span>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="bento-label text-charcoal-500">QUESTIONS (${qs.length})</p>
        <button onclick="fbToggleQs()" class="btn btn-sm btn-secondary">${_fbQsOpen ? 'Hide Questions ▴' : 'Show Questions ▾'}</button>
      </div>
      ${_fbQsOpen ? `<div class="space-y-2 max-h-[35vh] overflow-y-auto pr-1 mt-2.5">${questionsHtml || '<p class="text-xs text-charcoal-400">No questions yet.</p>'}</div>` : ''}
    </div>

    ${isEval ? fbDetailSubmissionsHtml(subs) : fbDetailApplicantsHtml(apps)}
  </div>`;
}

function fbDetailSubmissionsHtml(subs) {
  const head = `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
    <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between flex-wrap gap-2">
      <p class="bento-label text-charcoal-500">WHO COMPLETED THIS FORM</p>
      <p class="text-[10px] text-charcoal-400">Click an employee to see their answers</p>
    </div>`;
  if (!subs.length) return head + `<div class="p-4">${fbEmpty('No submissions yet', 'Run this form from the Evaluations page to see completions here.')}</div></div>`;
  return head + `<div class="divide-y divide-charcoal-50">
    ${subs.map(h => `<div class="p-3 flex items-center justify-between gap-3 flex-wrap cursor-pointer hover:bg-charcoal-50" onclick="openEvalSubmission('${h.id}')">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">${h.employee.split(' ').map(w => w[0]).join('')}</div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-charcoal-900 truncate">${fbEsc(h.employee)}</p>
          <p class="text-[10px] text-charcoal-400 truncate">${h.period}${h.reviewedBy ? ` · Reviewed by ${fbEsc(h.reviewedBy)}` : ''}${h.reviewedDate ? ` · ${h.reviewedDate}` : ''}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <p class="text-sm font-bold ${h.score >= 75 ? 'text-green-600' : h.score >= 60 ? 'text-yellow-600' : 'text-red-600'}">${h.score}%</p>
          <p class="text-[9px] text-charcoal-400">${h.status}</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();openEvalSubmission('${h.id}')">View Answers</button>
      </div>
    </div>`).join('')}
  </div></div>`;
}

function fbDetailApplicantsHtml(apps) {
  const openCount = apps.filter(a => ['New', 'In Review', 'Shortlisted'].includes(a.status)).length;
  const head = `<div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
    <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <p class="bento-label text-charcoal-500">WHO APPLIED</p>
        ${openCount ? `<span class="badge badge-brand text-[9px]">${openCount} open</span>` : ''}
      </div>
      <p class="text-[10px] text-charcoal-400">Review answers, add to the pipeline, or reject</p>
    </div>`;
  if (!apps.length) return head + `<div class="p-4">${fbEmpty('No applications yet', 'Use "Preview & Apply" to submit a test application — it will appear here.')}</div></div>`;
  return head + `<div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
    ${apps.map(a => {
      const isOpen = ['New', 'In Review', 'Shortlisted'].includes(a.status);
      return `<div class="bg-charcoal-50 rounded-xl border border-charcoal-200 p-3 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[11px] font-semibold flex-shrink-0">${a.name.split(' ').map(w => w[0]).join('')}</div>
              <div class="min-w-0">
                <p class="text-xs font-bold text-charcoal-900 truncate">${fbEsc(a.name)}</p>
                <p class="text-[10px] text-charcoal-400 truncate">${a.position} · ${a.gym}</p>
              </div>
            </div>
            ${frStatusBadge(a.status)}
          </div>
          <p class="text-[10px] text-charcoal-500 mt-2">Applied ${a.appliedDate} · ${(a.answers || []).length} answers · ${fbEsc(a.phone)}</p>
        </div>
        <div class="flex gap-1.5 mt-3 pt-2 border-t border-charcoal-200">
          <button class="btn btn-sm btn-secondary flex-1" onclick="viewApplicant('${a.id}')">View Answers</button>
          ${isOpen ? `<button class="btn btn-sm btn-primary flex-1" onclick="moveApplicantToPipeline('${a.id}')">Add to Pipeline</button>
          <button class="btn btn-sm btn-danger-outline flex-1" onclick="rejectApplicant('${a.id}')">Reject</button>` : ''}
          ${a.status === 'Moved to Pipeline' ? `<button class="btn btn-sm btn-ghost flex-1" onclick="_recTab='candidates';navigateTo('recruitment')">In Pipeline →</button>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div></div>`;
}

function fbEditorHtml() {
  const d = _fbDraft;
  const isEval = _fbMode === 'evaluation';
  const positions = ['Trainer', 'Receptionist', 'Cleaner', 'Maintenance', 'Branch Manager', 'All'];
  const statuses = isEval ? ['Active', 'Completed', 'Inactive'] : ['Open', 'Closed'];

  return `<div class="space-y-3 mt-3">
    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p class="bento-label text-charcoal-500">${_fbId ? 'EDIT' : 'NEW'} ${isEval ? 'EVALUATION' : 'HIRING'} FORM</p>
        <button onclick="fbCancel()" class="btn btn-sm btn-ghost">← Back</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div class="sm:col-span-2">
          <label class="form-label">Form Title *</label>
          <input class="form-input" value="${fbEsc(d.name)}" oninput="_fbDraft.name=this.value" placeholder="e.g. ${isEval ? 'Trainer Evaluation Q4 2026' : 'Front Desk Application Form'}">
        </div>
        <div>
          <label class="form-label">Form Type</label>
          <select class="form-select" onchange="fbSetFormType(this.value)" ${_fbId ? 'disabled' : ''}>
            <option value="evaluation" ${isEval ? 'selected' : ''}>Evaluation</option>
            <option value="hiring" ${!isEval ? 'selected' : ''}>Hiring</option>
          </select>
        </div>
        <div>
          <label class="form-label">${isEval ? 'Target Role' : 'Position'}</label>
          <select class="form-select" onchange="_fbDraft.position=this.value">
            ${positions.map(p => `<option value="${p}" ${d.position === p ? 'selected' : ''}>${p === 'All' ? (isEval ? 'All Staff' : 'All Positions') : p}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Gym Scope</label>
          <select class="form-select" onchange="_fbDraft.gym=this.value">
            <option value="All" ${d.gym === 'All' ? 'selected' : ''}>All</option>
            ${MOCK.gymList.map(g => `<option ${d.gym === g.branch ? 'selected' : ''}>${g.branch}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Status</label>
          <select class="form-select" onchange="_fbDraft.status=this.value">
            ${statuses.map(s => `<option ${d.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 p-4">
      <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
        <p class="bento-label text-charcoal-500">QUESTIONS (${d.questionList.length})</p>
        <button onclick="fbAddQ()" class="btn btn-sm btn-ghost text-brand-600 text-xs font-semibold">+ Add Question</button>
      </div>
      <p class="text-[10px] text-charcoal-400 mb-3">Each question can be an <strong>open question</strong> (free text), <strong>checkboxes</strong> (pick multiple), or a <strong>choose option</strong> (pick one).</p>
      <div class="space-y-3">
        ${d.questionList.map((q, i) => fbQuestionCard(q, i, d.questionList.length)).join('')}
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <button onclick="fbCancel()" class="btn btn-sm btn-secondary">Cancel</button>
      <button onclick="fbSave()" class="btn btn-sm btn-primary">Save Form</button>
    </div>
  </div>`;
}

function fbQuestionCard(q, i, n) {
  const types = [['text', 'Open Question — free text answer'], ['checkbox', 'Checkboxes — pick multiple answers'], ['choose', 'Choose Option — pick one answer']];
  return `<div class="bg-charcoal-50 rounded-xl border border-charcoal-200 p-3">
    <div class="flex items-start gap-2.5">
      <span class="w-6 h-6 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-1">${i + 1}</span>
      <div class="flex-1 space-y-2 min-w-0">
        <input type="text" class="form-input text-xs" value="${fbEsc(q.text)}" oninput="_fbDraft.questionList[${i}].text=this.value" placeholder="Type your question...">
        <div class="flex items-center gap-2 flex-wrap">
          <select class="form-select text-xs" onchange="fbSetType(${i},this.value)" style="width:auto;padding-top:.3rem;padding-bottom:.3rem;">
            ${types.map(t => `<option value="${t[0]}" ${q.type === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}
          </select>
          ${i > 0 ? `<button onclick="fbMoveQ(${i},-1)" class="btn btn-sm btn-ghost p-1" title="Move up">↑</button>` : ''}
          ${i < n - 1 ? `<button onclick="fbMoveQ(${i},1)" class="btn btn-sm btn-ghost p-1" title="Move down">↓</button>` : ''}
          <button onclick="fbRemoveQ(${i})" class="text-charcoal-300 hover:text-red-500 p-1" title="Remove question"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </div>
        ${q.type !== 'text' ? `<div class="bg-white rounded-lg border border-charcoal-200 p-2.5 space-y-1.5">
          <div class="flex items-center justify-between">
            <p class="text-[9px] uppercase tracking-wide text-charcoal-400 font-semibold">Answer Options (${q.options.length})</p>
            <button onclick="fbAddOpt(${i})" class="text-[10px] font-semibold text-brand-600 hover:underline">+ Add Option</button>
          </div>
          ${q.options.map((o, oi) => `<div class="flex items-center gap-2">
            <span class="text-charcoal-400 text-xs flex-shrink-0">${q.type === 'checkbox' ? '☐' : '○'}</span>
            <input type="text" class="form-input text-xs" value="${fbEsc(o)}" oninput="_fbDraft.questionList[${i}].options[${oi}]=this.value" placeholder="Option text">
            <button onclick="fbRemoveOpt(${i},${oi})" class="text-charcoal-300 hover:text-red-500 flex-shrink-0" title="Remove option">✕</button>
          </div>`).join('')}
          ${q.options.length < 2 ? `<p class="text-[9px] text-red-500">Needs at least 2 options to save.</p>` : ''}
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

// ---- builder state helpers ----
function fbBlankDraft() {
  return {
    name: '',
    position: 'All',
    gym: 'All',
    status: _fbMode === 'evaluation' ? 'Active' : 'Open',
    questionList: [{ type: 'text', text: '', options: [] }],
  };
}
function fbLoadDraft(f, kind) {
  const raw = (f.questionList && f.questionList.length)
    ? f.questionList
    : (kind === 'hiring' ? [{ type: 'text', text: '', options: [] }] : getFormQuestions(f));
  return {
    name: f.name || '',
    position: f.position || f.target || 'All',
    gym: f.gym || 'All',
    status: f.status || (kind === 'hiring' ? 'Open' : 'Active'),
    questionList: raw.map(q => ({ type: q.type || 'text', text: q.text || '', options: (q.options || []).slice() })),
  };
}
function fbNew() {
  if (!canBuildEvalForms()) { showToast('Creating forms requires evaluations.forms.manage (HR Manager)', 'error'); return; }
  _fbMode = _fbFilter === 'hiring' ? 'hiring' : 'evaluation';
  _fbId = null; _fbDraft = fbBlankDraft(); _fbEditing = true; renderAll();
}
function fbEdit(kind, id) {
  if (!canBuildEvalForms()) { showToast('Editing forms requires evaluations.forms.manage (HR Manager)', 'error'); return; }
  _fbMode = kind;
  const arr = kind === 'evaluation' ? MOCK.evaluationForms : MOCK.hiringForms;
  const f = arr.find(x => x.id === id);
  if (!f) return;
  _fbId = id; _fbDraft = fbLoadDraft(f, kind); _fbEditing = true; renderAll();
}
function fbCancel() { _fbEditing = false; _fbId = null; _fbDraft = null; renderAll(); }
function fbSetFormType(v) {
  if (v !== 'evaluation' && v !== 'hiring') return;
  _fbMode = v;
  if (_fbDraft) _fbDraft.status = v === 'evaluation' ? 'Active' : 'Open';
  renderAll();
}

// ---- builder question ops ----
function fbAddQ() { _fbDraft.questionList.push({ type: 'text', text: '', options: [] }); renderAll(); }
function fbRemoveQ(i) {
  if (_fbDraft.questionList.length <= 1) { showToast('A form must have at least one question', 'error'); return; }
  _fbDraft.questionList.splice(i, 1); renderAll();
}
function fbMoveQ(i, dir) {
  const list = _fbDraft.questionList, t = i + dir;
  if (t < 0 || t >= list.length) return;
  const tmp = list[i]; list[i] = list[t]; list[t] = tmp; renderAll();
}
function fbSetType(i, type) {
  const q = _fbDraft.questionList[i]; if (!q) return;
  q.type = type;
  if (type === 'text') { q.options = []; }
  else if (!q.options || q.options.length < 2) { q.options = type === 'choose' ? ['Option A', 'Option B'] : ['Option 1', 'Option 2']; }
  renderAll();
}
function fbAddOpt(i) { const q = _fbDraft.questionList[i]; q.options.push('Option ' + (q.options.length + 1)); renderAll(); }
function fbRemoveOpt(i, oi) { _fbDraft.questionList[i].options.splice(oi, 1); renderAll(); }

// ---- builder save / delete / run ----
function fbSave() {
  if (!canBuildEvalForms()) { showToast('Form Builder requires evaluations.forms.manage (HR Manager)', 'error'); return; }
  const d = _fbDraft;
  if (!d) return;
  const name = (d.name || '').trim();
  if (!name) { showToast('Form title is required', 'error'); return; }

  const clean = [];
  for (const q of d.questionList) {
    const text = (q.text || '').trim();
    if (!text) continue;
    const type = q.type || 'text';
    if (type === 'text') { clean.push({ type, text, options: [] }); continue; }
    const opts = (q.options || []).map(o => String(o).trim()).filter(Boolean);
    if (opts.length < 2) { showToast(`"${text}" needs at least 2 answer options`, 'error'); return; }
    clean.push({ type, text, options: opts });
  }
  if (!clean.length) { showToast('Add at least one question', 'error'); return; }

  const isEval = _fbMode === 'evaluation';
  const arr = isEval ? MOCK.evaluationForms : MOCK.hiringForms;
  const pos = (d.position || 'All');
  const today = new Date().toISOString().slice(0, 10);
  const isNew = !_fbId;

  if (!isNew) {
    const f = arr.find(x => x.id === _fbId);
    if (f) {
      f.name = name; f.position = pos; f.target = pos;
      f.gym = d.gym; f.status = d.status;
      f.questionList = clean; f.questions = clean.length;
    }
  } else {
    const nf = {
      id: (isEval ? 'ef-' : 'hf-') + Date.now(),
      name, position: pos, target: pos, gym: d.gym, status: d.status,
      questionList: clean, questions: clean.length, createdDate: today,
    };
    if (isEval) nf.lastUsed = 'Never';
    arr.unshift(nf);
    _fbId = nf.id;
  }

  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: isEval ? (isNew ? 'Evaluation Form Created' : 'Evaluation Form Updated') : (isNew ? 'Hiring Form Created' : 'Hiring Form Updated'),
    user: MOCK.currentUser.fullName,
    target: name,
    detail: `Saved with ${clean.length} question${clean.length === 1 ? '' : 's'} (${isEval ? 'evaluation' : 'hiring'} form · status: ${d.status})`,
    timestamp: '2026-09-09',
    gym: d.gym
  });

  showToast(`Form "${name}" saved`);
  const backTo = isNew ? _fbId : _fbDetailId; // new form → open it; edit → return where you came from
  _fbEditing = false; _fbId = null; _fbDraft = null;
  _fbDetailId = backTo;
  renderAll();
}

function fbDelete(kind, id) {
  if (!canBuildEvalForms()) { showToast('Form Builder requires evaluations.forms.manage (HR Manager)', 'error'); return; }
  const arr = kind === 'evaluation' ? MOCK.evaluationForms : MOCK.hiringForms;
  const f = arr.find(x => x.id === id);
  if (!f) return;
  const linked = kind === 'hiring' ? MOCK.hiringApplicants.filter(a => a.formId === id).length : 0;
  openModal('Delete Form',
    `<div class="space-y-2">
      <p class="text-sm text-charcoal-700">Delete <strong>"${fbEsc(f.name)}"</strong>? This cannot be undone.</p>
      ${linked ? `<p class="text-xs text-charcoal-500">${linked} existing applicant${linked === 1 ? '' : 's'} will remain in the system — they just won't be tied to a live form anymore.</p>` : ''}
    </div>`,
    { footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="fbDoDelete('${kind}','${id}')" class="btn btn-sm btn-danger">Delete Form</button>` });
}
function fbDoDelete(kind, id) {
  const arr = kind === 'evaluation' ? MOCK.evaluationForms : MOCK.hiringForms;
  const i = arr.findIndex(x => x.id === id);
  if (i < 0) { closeModal(); return; }
  const name = arr[i].name;
  arr.splice(i, 1);
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: kind === 'evaluation' ? 'Evaluation Form Deleted' : 'Hiring Form Deleted',
    user: MOCK.currentUser.fullName, target: name,
    detail: `Deleted form "${name}"`, timestamp: '2026-09-09', gym: 'All'
  });
  if (_fbId === id) { _fbEditing = false; _fbId = null; _fbDraft = null; }
  if (_fbDetailId === id) _fbDetailId = null;
  closeModal(); showToast(`Form "${name}" deleted`); renderAll();
}
function fbRunFromBuilder(formId) { startEvaluationWithForm(formId); navigateTo('evaluations'); }

// ==================== (Form Responses folded into fbDetailPage on the Evaluations page) ====================
function frAnswerHtml(a) {
  if (a.type === 'checkbox') {
    const v = Array.isArray(a.answer) ? a.answer : [];
    return v.length ? v.map(x => `<span class="badge badge-blue text-[9px] mr-1">${fbEsc(x)}</span>`).join('') : '<span class="text-xs text-charcoal-400">—</span>';
  }
  if (a.type === 'choose') {
    return a.answer ? `<span class="badge badge-brand text-[9px]">${fbEsc(a.answer)}</span>` : '<span class="text-xs text-charcoal-400">—</span>';
  }
  return a.answer ? `<p class="text-xs text-charcoal-700 leading-relaxed">${fbEsc(a.answer)}</p>` : '<span class="text-xs text-charcoal-400">—</span>';
}

function openEvalSubmission(id) {
  const h = MOCK.evaluationHistory.find(x => x.id === id);
  if (!h) return;
  const answers = Array.isArray(h.answers) ? h.answers : [];
  const answersHtml = answers.length
    ? answers.map((a, i) => `<div class="bg-charcoal-50 rounded-lg p-2.5 border border-charcoal-200">
        <div class="flex items-start justify-between gap-2 mb-1">
          <p class="text-[11px] font-semibold text-charcoal-700">${i + 1}. ${fbEsc(a.question)}</p>
          <span class="badge badge-brand text-[8px] flex-shrink-0">${fbTypeLabel(a.type)}</span>
        </div>
        ${frAnswerHtml(a)}
      </div>`).join('')
    : `<p class="text-xs text-charcoal-400">No itemized answers recorded for this entry — only the aggregate score and feedback are available.</p>`;

  openModal(`${fbEsc(h.employee)} — Evaluation Submission`, `
    <div class="space-y-3">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div class="bg-charcoal-50 rounded-lg border border-charcoal-200 p-2.5 text-center"><p class="text-lg font-bold ${h.score >= 75 ? 'text-green-600' : h.score >= 60 ? 'text-yellow-600' : 'text-red-600'}">${h.score}%</p><p class="text-[9px] text-charcoal-400">Score</p></div>
        <div class="bg-charcoal-50 rounded-lg border border-charcoal-200 p-2.5 text-center"><p class="text-[11px] font-semibold text-charcoal-800 mt-1">${h.status}</p><p class="text-[9px] text-charcoal-400">Status</p></div>
        <div class="bg-charcoal-50 rounded-lg border border-charcoal-200 p-2.5 text-center"><p class="text-[11px] font-semibold text-charcoal-800 mt-1">${h.period}</p><p class="text-[9px] text-charcoal-400">Period</p></div>
        <div class="bg-charcoal-50 rounded-lg border border-charcoal-200 p-2.5 text-center"><p class="text-[11px] font-semibold text-charcoal-800 mt-1 truncate">${h.reviewedBy ? fbEsc(h.reviewedBy) : '—'}</p><p class="text-[9px] text-charcoal-400">Reviewed By</p></div>
      </div>
      <div>
        <p class="bento-label text-charcoal-500 mb-1.5">FORM ANSWERS (${answers.length})</p>
        <div class="space-y-2 max-h-[45vh] overflow-y-auto pr-1">${answersHtml}</div>
      </div>
      ${h.notes ? `<div class="bg-brand-50 border border-brand-100 rounded-lg p-2.5"><p class="text-[9px] uppercase font-bold text-brand-700 tracking-wide mb-0.5">Manager Feedback</p><p class="text-xs text-charcoal-700">${fbEsc(h.notes)}</p></div>` : ''}
    </div>`,
    { wide: true, footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>` });
}

// ---- hiring applicants ----
function frStatusBadge(s) {
  const cls = s === 'New' ? 'badge-blue' : s === 'In Review' ? 'badge-gray' : s === 'Shortlisted' ? 'badge-success' : s === 'Moved to Pipeline' ? 'badge-brand' : 'badge-red';
  return `<span class="badge ${cls} text-[9px]">${s}</span>`;
}
function viewApplicant(id) {
  const a = MOCK.hiringApplicants.find(x => x.id === id);
  if (!a) return;
  const isOpen = ['New', 'In Review', 'Shortlisted'].includes(a.status);
  const answersHtml = (a.answers || []).map((ans, i) => `<div class="bg-charcoal-50 rounded-lg p-2.5 border border-charcoal-200">
      <div class="flex items-start justify-between gap-2 mb-1">
        <p class="text-[11px] font-semibold text-charcoal-700">${i + 1}. ${fbEsc(ans.question)}</p>
        <span class="badge badge-brand text-[8px] flex-shrink-0">${fbTypeLabel(ans.type)}</span>
      </div>${frAnswerHtml(ans)}
    </div>`).join('') || '<p class="text-xs text-charcoal-400">No answers recorded.</p>';

  openModal(`${fbEsc(a.name)} — Application`, `
    <div class="space-y-3">
      <div class="bg-charcoal-50 rounded-lg border border-charcoal-200 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div><p class="text-[9px] uppercase text-charcoal-400 font-semibold">Position</p><p class="text-xs text-charcoal-800 font-medium">${a.position}</p></div>
        <div><p class="text-[9px] uppercase text-charcoal-400 font-semibold">Preferred Branch</p><p class="text-xs text-charcoal-800 font-medium">${a.gym}</p></div>
        <div><p class="text-[9px] uppercase text-charcoal-400 font-semibold">Status</p>${frStatusBadge(a.status)}</div>
        <div><p class="text-[9px] uppercase text-charcoal-400 font-semibold">Email</p><p class="text-xs text-charcoal-800 font-medium truncate">${fbEsc(a.email)}</p></div>
        <div><p class="text-[9px] uppercase text-charcoal-400 font-semibold">Phone</p><p class="text-xs text-charcoal-800 font-medium">${fbEsc(a.phone)}</p></div>
        <div><p class="text-[9px] uppercase text-charcoal-400 font-semibold">Applied</p><p class="text-xs text-charcoal-800 font-medium">${a.appliedDate}</p></div>
      </div>
      <div>
        <p class="bento-label text-charcoal-500 mb-1.5">APPLICATION ANSWERS</p>
        <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">${answersHtml}</div>
      </div>
    </div>`,
    {
      wide: true, footer: isOpen
        ? `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>
           <button onclick="closeModal();rejectApplicant('${a.id}')" class="btn btn-sm btn-danger-outline">Reject</button>
           <button onclick="moveApplicantToPipeline('${a.id}')" class="btn btn-sm btn-primary">Add to Pipeline</button>`
        : `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Close</button>`
    });
}

function moveApplicantToPipeline(id) {
  const a = MOCK.hiringApplicants.find(x => x.id === id);
  if (!a) return;
  if (a.status === 'Moved to Pipeline') { showToast(`${a.name} is already in the candidate pipeline`, 'info'); return; }
  if (a.status === 'Rejected') { showToast('Rejected applications cannot be moved to the pipeline', 'error'); return; }
  if (!(DEMO.showAll || hasPermission('recruitment.candidates.manage'))) { showToast('Adding to the pipeline requires recruitment.candidates.manage', 'error'); return; }

  MOCK.candidates.unshift({
    id: 'c' + Date.now(),
    name: a.name, position: a.position, stage: 'Applied', appliedDate: a.appliedDate,
    phone: a.phone, rating: 0,
    form: {
      email: a.email, source: 'Hiring Form — ' + a.formName, gymPref: a.gym,
      expYears: 0, education: '', skills: [], languages: [], shift: 'Any', salaryExp: 0, availability: 'Immediate'
    },
    screen: null, iv1: null, iv2: null, decision: null,
  });
  a.status = 'Moved to Pipeline';
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Candidate Added',
    user: MOCK.currentUser.fullName,
    target: a.name,
    detail: `Moved from hiring form "${a.formName}" into the candidate pipeline (stage: Applied)`,
    timestamp: '2026-09-09',
    gym: a.gym
  });
  closeModal(); showToast(`${a.name} added to the candidate pipeline`); renderAll();
}

function rejectApplicant(id) {
  const a = MOCK.hiringApplicants.find(x => x.id === id);
  if (!a) return;
  if (a.status === 'Rejected') { showToast('This application is already rejected', 'info'); return; }
  if (a.status === 'Moved to Pipeline') { showToast('This applicant is already in the pipeline', 'error'); return; }
  if (!(DEMO.showAll || hasPermission('recruitment.candidates.manage'))) { showToast('Rejecting requires recruitment.candidates.manage', 'error'); return; }
  a.status = 'Rejected';
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Hiring Application Rejected',
    user: MOCK.currentUser.fullName,
    target: a.name,
    detail: `Application via "${a.formName}" rejected`,
    timestamp: '2026-09-09',
    gym: a.gym
  });
  closeModal(); showToast(`${a.name}'s application rejected`); renderAll();
}

// ---- public-style application form (preview / test apply) ----
function openHiringFormPreview(formId) {
  const hf = MOCK.hiringForms.find(f => f.id === formId) || MOCK.hiringForms[0];
  if (!hf) { showToast('Create a hiring form first', 'error'); return; }
  const qs = hf.questionList || [];
  const qHtml = qs.map((q, i) => {
    const label = `<p class="text-xs font-semibold text-charcoal-800 mb-1.5">${i + 1}. ${fbEsc(q.text)} <span class="text-charcoal-400 font-normal">(${fbTypeLabel(q.type)})</span></p>`;
    if (q.type === 'checkbox') {
      return `<div class="bg-charcoal-50 rounded-lg border border-charcoal-200 p-3">${label}<div class="flex flex-wrap gap-x-4 gap-y-1.5">${(q.options || []).map(o => `<label class="flex items-center gap-1.5 text-xs text-charcoal-700"><input type="checkbox" name="hfcb${i}" value="${fbEsc(o)}"> ${fbEsc(o)}</label>`).join('')}</div></div>`;
    }
    if (q.type === 'choose') {
      return `<div class="bg-charcoal-50 rounded-lg border border-charcoal-200 p-3">${label}<div class="flex flex-wrap gap-x-4 gap-y-1.5">${(q.options || []).map(o => `<label class="flex items-center gap-1.5 text-xs text-charcoal-700"><input type="radio" name="hfq${i}" value="${fbEsc(o)}"> ${fbEsc(o)}</label>`).join('')}</div></div>`;
    }
    return `<div class="bg-charcoal-50 rounded-lg border border-charcoal-200 p-3">${label}<textarea id="hfat${i}" class="form-input text-xs" rows="2" placeholder="Type your answer..."></textarea></div>`;
  }).join('');

  openModal(`${fbEsc(hf.name)} — Apply`, `
    <div class="space-y-3">
      <p class="text-[10px] text-charcoal-400">Public application form preview — submitting creates a test applicant you can review in this form's "Who Applied" list.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="form-label">Full Name *</label><input id="hf-name" class="form-input" placeholder="Applicant full name"></div>
        <div><label class="form-label">Email</label><input id="hf-email" class="form-input" placeholder="name@mail.com"></div>
        <div><label class="form-label">Phone</label><input id="hf-phone" class="form-input" placeholder="+20 1xx xxx xxxx"></div>
        <div><label class="form-label">Preferred Branch</label><select id="hf-gym" class="form-select">${MOCK.gymList.map(g => `<option>${g.branch}</option>`).join('')}</select></div>
      </div>
      ${qHtml}
    </div>`,
    { wide: true, footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button onclick="submitHiringApplication('${hf.id}')" class="btn btn-sm btn-primary">Submit Application</button>` });
}

function submitHiringApplication(formId) {
  const hf = MOCK.hiringForms.find(f => f.id === formId);
  if (!hf) return;
  const name = (document.getElementById('hf-name')?.value || '').trim();
  if (!name) { showToast('Full name is required', 'error'); return; }
  const email = (document.getElementById('hf-email')?.value || '').trim();
  const phone = (document.getElementById('hf-phone')?.value || '').trim();
  const gym = document.getElementById('hf-gym')?.value || 'Nasr City';

  const answers = (hf.questionList || []).map((q, i) => {
    if (q.type === 'checkbox') {
      const picked = Array.from(document.querySelectorAll(`input[name="hfcb${i}"]:checked`)).map(el => el.value);
      return { question: q.text, type: 'checkbox', answer: picked };
    }
    if (q.type === 'choose') {
      const r = document.querySelector(`input[name="hfq${i}"]:checked`);
      return { question: q.text, type: 'choose', answer: r ? r.value : '' };
    }
    return { question: q.text, type: 'text', answer: (document.getElementById(`hfat${i}`)?.value || '').trim() };
  });

  const appliedDate = new Date().toISOString().slice(0, 10);
  MOCK.hiringApplicants.unshift({
    id: 'ha-' + Date.now(),
    name, email: email || '—', phone: phone || '—', gym,
    formId: hf.id, formName: hf.name, position: hf.position || 'All',
    appliedDate, status: 'New', answers,
  });
  MOCK.auditLog.unshift({
    id: 'al-' + Date.now(),
    action: 'Hiring Application Received',
    user: name, target: name,
    detail: `Applied via "${hf.name}" (${answers.length} answers)`,
    timestamp: '2026-09-09',
    gym
  });

  closeModal();
  _fbEditing = false; _fbId = null; _fbDraft = null;
  _fbMode = 'hiring';
  _fbDetailId = hf.id;
  showToast(`Application submitted — ${name} added to hiring applicants`);
  navigateTo('evaluations');
}
