// ==================== EVALUATIONS ====================
let _evalTab = 'forms';

function renderEvaluations() {
  const showAll = DEMO.showAll;
  const canEdit = showAll || hasPermission('evaluations.manage');
  const forms = MOCK.evaluationForms;
  const history = MOCK.evaluationHistory;

  let body = '';
  if (_evalTab === 'forms') {
    body = `<div class="flex items-center justify-between mb-3">
      <p class="bento-label text-charcoal-500">FORM BUILDER</p>
      ${canEdit ? `<button onclick="openFormBuilder()" class="btn btn-sm btn-primary"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>New Form</button>` : ''}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      ${forms.map(f => `<div class="bg-white rounded-xl border border-charcoal-200 p-3 flex flex-col ${canEdit ? 'cursor-pointer' : ''}" ${canEdit ? `onclick="openFormBuilder('${f.id}')"` : ''}>
        <div class="flex items-center justify-between"><p class="text-xs font-semibold text-charcoal-900">${f.name}</p>${f.active ? `<span class="badge badge-success text-[9px]">Active</span>` : `<span class="badge badge-gray text-[9px]">Inactive</span>`}</div>
        <p class="text-[10px] text-charcoal-500 mt-1">${f.questions} questions · ${f.target}</p>
        <p class="text-[9px] text-charcoal-400 mt-2">Last used ${f.lastUsed}</p>
        <div class="flex gap-1.5 mt-2">${canEdit ? `<button class="btn btn-sm btn-ghost flex-1 text-[10px]" onclick="event.stopPropagation();showToast('Form edited')">Edit</button>` : ''}<button class="btn btn-sm btn-secondary flex-1 text-[10px]" onclick="event.stopPropagation();_evalTab='history';renderAll()">Results</button></div>
      </div>`).join('')}
    </div>
    ${!canEdit ? `<p class="text-[10px] text-charcoal-400 text-center">Form Builder is hidden — you do not have <code>evaluations.manage</code>. HR can view forms and results only.</p>` : ''}`;
  }
  else if (_evalTab === 'run') {
    if (!canEdit) { _evalTab = 'history'; return renderEvaluations(); }
    body = `<div class="bg-white rounded-xl border border-charcoal-200 p-5 text-center">
      <svg class="w-10 h-10 text-brand-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
      <p class="text-sm font-semibold text-charcoal-900">Run Periodic Evaluation</p>
      <p class="text-xs text-charcoal-500 mt-1">Trigger a new evaluation round for a department or gym.</p>
      <div class="max-w-sm mx-auto mt-4 space-y-3 text-left">
        <div><label class="form-label">Form</label><select class="form-select"><option>Trainer Evaluation Q3 2026</option><option>Receptionist Evaluation Q2 2026</option><option>Probation Review</option></select></div>
        <div><label class="form-label">Target</label><select class="form-select"><option>All Trainers</option><option>All Receptionists</option><option>Gym — Nasr City</option></select></div>
        <div><label class="form-label">Deadline</label><input type="date" class="form-input" value="2026-10-10"></div>
        <button onclick="showToast('Evaluation round launched')" class="btn btn-primary w-full">Launch Evaluation</button>
      </div>
    </div>`;
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
        <div class="px-3 py-2.5 border-b border-charcoal-100 flex items-center justify-between"><p class="bento-label text-charcoal-500">GOALS & OKRs</p><button onclick="showToast('New goal — simulated')" class="btn btn-sm btn-ghost text-[10px]">+ Add</button></div>
        <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">${goalsHtml}</div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-charcoal-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b border-charcoal-100 flex items-center justify-between"><p class="bento-label text-charcoal-500">EVALUATION HISTORY</p>${canEdit ? `<button onclick="_evalTab='run';renderAll()" class="btn btn-sm btn-primary">Run New</button>` : ''}</div>
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
    <div><h1 class="text-xl font-bold text-charcoal-900">Evaluations</h1><p class="text-xs text-charcoal-500 mt-0.5">Build forms, run evaluation rounds, track performance</p></div>
    <div class="flex border-b border-charcoal-100">${tabs.map(t => `<button onclick="_evalTab='${t.id}';renderAll()" class="tab-btn ${_evalTab === t.id ? 'active' : ''}">${t.label}</button>`).join('')}</div>
    ${body}
  </div>`;
}

function evalStatusBadge(s) { return `<span class="badge ${s === 'Completed' ? 'badge-success' : s === 'In Progress' ? 'badge-blue' : 'badge-gray'} text-[9px]">${s}</span>`; }

function openFormBuilder(id) {
  const f = id ? MOCK.evaluationForms.find(x => x.id === id) : null;
  const q = f ? f.questions : 0;
  const defaults = ['Punctuality and attendance', 'Task completion quality', 'Team collaboration', 'Customer service'];
  const qQty = Math.max(q, defaults.length);
  const qHtml = defaults.slice(0, qQty).map((q, i) => `<div class="bg-charcoal-50 rounded-lg p-2.5 border border-charcoal-100 flex items-center justify-between"><div class="flex items-center gap-2"><span class="w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] flex items-center justify-center">${i + 1}</span><p class="text-[11px] text-charcoal-700">${q}</p></div><button type="button" onclick="showToast('Question removed')" class="text-charcoal-300 hover:text-red-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div>`).join('');
  openModal(`${f ? 'Edit' : 'Create'} Evaluation Form`, `<form onsubmit="event.preventDefault();showToast('Form saved');closeModal();" class="space-y-3">
    <div><label class="form-label">Form Name</label><input class="form-input" value="${f ? f.name : 'Performance Review'}" required></div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label class="form-label">Target</label><select class="form-select"><option>All Trainers</option><option>All Receptionists</option><option>All Staff</option></select></div>
      <div><label class="form-label">Active</label><select class="form-select"><option>Yes</option><option>No</option></select></div>
    </div>
    <div><label class="form-label">Questions</label>
      <div class="space-y-2">${qHtml}</div>
      <button type="button" onclick="showToast('Question input added — simulated')" class="btn btn-sm btn-ghost mt-2 text-brand-600"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Add Question</button>
    </div>
    <div class="flex justify-end gap-2 pt-1"><button type="button" onclick="closeModal()" class="btn btn-sm btn-secondary">Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save Form</button></div>
  </form>`, { wide: true });
}