let _payPeriod = 'August 2026';
let _payStep = 1;
let _payrollView = 'overview';
let _payrollGym = 'Nasr City';
let _payrollLanguage = 'en';
let _payrollPayslipOpen = false;
let _payrollEmployeeIdValue = '';
let _payrollDraftSavedAt = null;

const PAYROLL_GYMS = ['Nasr City', 'Heliopolis', '6th October'];
const PAYROLL_COPY = {
  en: {
    pageTitle: 'Payroll', pageSubtitle: 'Review, reconcile, and publish payroll with confidence.', employeeReview: 'Employee payroll review', employeeReviewSubtitle: 'Review source records, resolve deductions, and confirm net pay.', gym: 'Gym', payPeriod: 'Pay period', language: 'Language', english: 'English', arabic: 'Arabic', saveDraft: 'Save Draft', saveDraftHint: 'Keep this payroll run as a draft and return later.', publishPayroll: 'Publish Payroll', publishReady: 'All employees are reviewed and ready to publish.', publishProgress: '{reviewed} of {total} employees reviewed', reviewRequired: '{remaining} employee(s) still need attention before publishing.', allReviewed: 'All employees reviewed', published: 'Published & Locked', publishedLocked: 'This period is published. Payroll details are read-only.', periodOpen: 'Open period', periodPartiallyPublished: 'Partially published', periodPublished: 'Published', totalEmployees: 'Total employees', reviewed: 'Reviewed', pending: 'Pending review', needsAttention: 'Needs attention', employeeList: 'Employee payroll', employeeListHint: 'Select an employee to review source records and deductions.', employee: 'Employee', position: 'Position', baseSalary: 'Base salary', totalDeductions: 'Total deductions', bonuses: 'Bonuses', netPay: 'Net pay', status: 'Status', pendingReview: 'Pending Review', reviewedStatus: 'Reviewed', needsAttentionStatus: 'Needs Attention', openEmployee: 'Open payroll for {name}', backToOverview: 'Back to payroll overview', employmentStatus: 'Employment status', readOnly: 'Read-only', editable: 'Editable', liveCalculation: 'Live calculation', biometricDeductions: 'Biometric-based deductions', biometricHint: 'Generated from attendance and biometric source records.', managerDeductions: 'Manager-issued deductions', managerHint: 'Manually issued lines require a reason and review decision.', date: 'Date', reason: 'Reason', amount: 'Amount', linkedAttendance: 'Linked attendance record', viewAttendance: 'View attendance reference', approve: 'Approve', reject: 'Reject', pendingDecision: 'Decision pending', accepted: 'Accepted', rejected: 'Rejected', addDeduction: 'Add deduction', addDeductionHint: 'New lines are created as pending review items.', source: 'Source', biometric: 'Biometric', manager: 'Manager', attendanceReference: 'Attendance reference', relatedRequests: 'Related requests', relatedRequestsHint: 'Request records linked to this employee or deduction line.', openRequest: 'Open request', noRelatedRequests: 'No related requests are linked to this payroll record.', payslipPreview: 'Payslip preview', showPayslip: 'Show payslip', hidePayslip: 'Hide payslip', saveContinue: 'Save & Continue Later', acceptReviewed: 'Accept & Mark Reviewed', markedReviewed: 'Marked Reviewed', acceptBlocked: 'Resolve every pending deduction before accepting this employee.', draftSaved: 'Payroll draft saved', confirmPublishTitle: 'Publish payroll?', confirmPublishText: 'Publishing {period} for {gym} will lock these {count} employee records and prevent further changes.', confirmPublish: 'Publish and lock', cancel: 'Cancel', attendanceReferenceToast: 'Attendance record {ref} is available in the attendance module.', periodLockedToast: 'This payroll period is published and read-only.', permissionToast: 'You do not have permission to perform this payroll action.', noEmployees: 'No payroll employees are available for this gym.', bonusSaved: 'Bonus updated. Net pay recalculated.', deductionUpdated: 'Deduction amount updated. Net pay recalculated.', deductionAdded: 'Deduction added for {name}. It is pending review.', acceptedToast: '{name} marked Reviewed.', emptyRequests: 'No linked records.', sourceRecord: 'Source record'
  },
  ar: {
    pageTitle: 'الرواتب', pageSubtitle: 'راجع الرواتب وطابقها وانشرها بثقة.', employeeReview: 'مراجعة رواتب الموظف', employeeReviewSubtitle: 'راجع السجلات المصدرية وحل الخصومات وأكّد صافي الراتب.', gym: 'النادي', payPeriod: 'فترة الدفع', language: 'اللغة', english: 'الإنجليزية', arabic: 'العربية', saveDraft: 'حفظ المسودة', saveDraftHint: 'احتفظ بهذه الدورة كمسودة وعد لاحقًا.', publishPayroll: 'نشر الرواتب', publishReady: 'تمت مراجعة جميع الموظفين والرواتب جاهزة للنشر.', publishProgress: 'تمت مراجعة {reviewed} من {total} موظفين', reviewRequired: 'لا يزال هناك {remaining} موظف يحتاجون إلى متابعة قبل النشر.', allReviewed: 'تمت مراجعة جميع الموظفين', published: 'منشورة ومقفلة', publishedLocked: 'تم نشر هذه الفترة. تفاصيل الرواتب للقراءة فقط.', periodOpen: 'فترة مفتوحة', periodPartiallyPublished: 'تم النشر جزئيًا', periodPublished: 'منشورة', totalEmployees: 'إجمالي الموظفين', reviewed: 'تمت المراجعة', pending: 'بانتظار المراجعة', needsAttention: 'يحتاج إلى متابعة', employeeList: 'رواتب الموظفين', employeeListHint: 'اختر موظفًا لمراجعة السجلات المصدرية والخصومات.', employee: 'الموظف', position: 'الوظيفة', baseSalary: 'الراتب الأساسي', totalDeductions: 'إجمالي الخصومات', bonuses: 'المكافآت', netPay: 'صافي الراتب', status: 'الحالة', pendingReview: 'بانتظار المراجعة', reviewedStatus: 'تمت المراجعة', needsAttentionStatus: 'يحتاج إلى متابعة', openEmployee: 'فتح رواتب {name}', backToOverview: 'العودة إلى نظرة عامة الرواتب', employmentStatus: 'حالة التوظيف', readOnly: 'للقراءة فقط', editable: 'قابل للتعديل', liveCalculation: 'حساب مباشر', biometricDeductions: 'الخصومات المستندة إلى البصمة', biometricHint: 'مولدة من سجلات الحضور والبصمة.', managerDeductions: 'الخصومات الصادرة من المدير', managerHint: 'البنود الصادرة يدويًا تتطلب سببًا وقرار مراجعة.', date: 'التاريخ', reason: 'السبب', amount: 'المبلغ', linkedAttendance: 'سجل الحضور المرتبط', viewAttendance: 'عرض مرجع الحضور', approve: 'الموافقة', reject: 'الرفض', pendingDecision: 'القرار مطلوب', accepted: 'مقبول', rejected: 'مرفوض', addDeduction: 'إضافة خصم', addDeductionHint: 'تُنشأ البنود الجديدة كبنود بانتظار المراجعة.', source: 'المصدر', biometric: 'البصمة', manager: 'المدير', attendanceReference: 'مرجع الحضور', relatedRequests: 'الطلبات المرتبطة', relatedRequestsHint: 'سجلات الطلبات المرتبطة بهذا الموظف أو بند الخصم.', openRequest: 'فتح الطلب', noRelatedRequests: 'لا توجد طلبات مرتبطة بسجل الرواتب هذا.', payslipPreview: 'معاينة قسيمة الراتب', showPayslip: 'عرض القسيمة', hidePayslip: 'إخفاء القسيمة', saveContinue: 'حفظ والمتابعة لاحقًا', acceptReviewed: 'قبول ووضع علامة تمت المراجعة', markedReviewed: 'تم وضع علامة تمت المراجعة', acceptBlocked: 'عالج كل خصم بانتظار القرار قبل قبول الموظف.', draftSaved: 'تم حفظ مسودة الرواتب', confirmPublishTitle: 'نشر الرواتب؟', confirmPublishText: 'سيؤدي نشر {period} لـ {gym} إلى إغلاق سجلات {count} من الموظفين ومنع أي تعديلات إضافية.', confirmPublish: 'نشر وقفل', cancel: 'إلغاء', attendanceReferenceToast: 'سجل الحضور {ref} متاح في وحدة الحضور.', periodLockedToast: 'فترة الرواتب هذه منشورة وهي للقراءة فقط.', permissionToast: 'ليس لديك صلاحية تنفيذ هذا الإجراء.', noEmployees: 'لا يوجد موظفو رواتب لهذا النادي.', bonusSaved: 'تم تحديث المكافأة وإعادة حساب صافي الراتب.', deductionUpdated: 'تم تحديث مبلغ الخصم وإعادة حساب صافي الراتب.', deductionAdded: 'تمت إضافة خصم لـ {name} وهو بانتظار المراجعة.', acceptedToast: 'تم وضع علامة تمت المراجعة لـ {name}.', emptyRequests: 'لا توجد سجلات مرتبطة.', sourceRecord: 'السجل المصدر'
  }
};

const PAYROLL_STATUS_KEYS = { 'Pending Review': 'pendingReview', Reviewed: 'reviewedStatus', 'Needs Attention': 'needsAttentionStatus', Draft: 'pendingReview', Processing: 'pendingReview', Approved: 'reviewedStatus', Locked: 'reviewedStatus', Accepted: 'accepted', Rejected: 'rejected', Pending: 'pendingDecision' };

function payrollT(key, vars) {
  const table = PAYROLL_COPY[_payrollLanguage] || PAYROLL_COPY.en;
  const value = table[key] || PAYROLL_COPY.en[key] || key;
  return String(value).replace(/\{(\w+)\}/g, (match, name) => vars && vars[name] !== undefined ? String(vars[name]) : match);
}

function payrollEscape(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function payrollInitials(name, initials) {
  return initials || String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '—';
}

function payrollDate(value) {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00` : value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(_payrollLanguage === 'ar' ? 'ar-EG' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function payrollMoney(value) {
  return Number(value || 0).toLocaleString(_payrollLanguage === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 0 });
}

function payrollAmount(value) {
  return `${_payrollLanguage === 'ar' ? 'ج.م' : 'EGP'} ${payrollMoney(value)}`;
}

function payrollGymDisplay(gym) {
  const values = { 'Nasr City': { en: 'Nasr City', ar: 'مدينة نصر' }, Heliopolis: { en: 'Heliopolis', ar: 'مصر الجديدة' }, '6th October': { en: '6th October', ar: 'السادس من أكتوبر' } };
  return values[gym] ? values[gym][_payrollLanguage] || values[gym].en : gym;
}

function payrollPeriodDisplay(period) {
  const values = { 'August 2026': { en: 'August 2026', ar: 'أغسطس 2026' }, 'July 2026': { en: 'July 2026', ar: 'يوليو 2026' }, 'June 2026': { en: 'June 2026', ar: 'يونيو 2026' } };
  return values[period] ? values[period][_payrollLanguage] || values[period].en : period;
}

function payrollPeriodRecord() {
  return (MOCK.payroll || []).find(record => record.period === _payPeriod) || { period: _payPeriod, status: 'Open', locked: false, publishedGyms: [] };
}

function payrollPeriodLocked(gym) {
  const record = payrollPeriodRecord();
  return !!record.locked || (record.publishedGyms || []).includes(gym || _payrollGym);
}

function payrollItemsForGym(gym) {
  return (MOCK.payrollItems || []).filter(item => item.gym === (gym || _payrollGym));
}

function baseSalaryOf(item) { return Number(item.baseSalary !== undefined ? item.baseSalary : item.gross || 0); }
function bonusOf(item) { return Number(item.bonus || 0); }
function grossOf(item) { return baseSalaryOf(item) + bonusOf(item); }
function dedTotal(item) { return (item.deductionLines || []).filter(line => line.status !== 'Rejected').reduce((sum, line) => sum + (Number(line.amount) || 0), 0); }
function netOf(item) { return grossOf(item) - dedTotal(item); }
function pendingOf(item) { return (item.deductionLines || []).filter(line => line.status === 'Pending').length; }
function payrollSyncTotals(item) { item.gross = grossOf(item); item.deductions = dedTotal(item); item.net = netOf(item); }

function payrollStatus(item) {
  if (payrollPeriodLocked(item && item.gym)) return 'Reviewed';
  const status = item && item.status ? item.status : 'Pending Review';
  if (status === 'Draft' || status === 'Processing') return pendingOf(item) > 0 ? 'Needs Attention' : 'Pending Review';
  if (status === 'Approved' || status === 'Locked') return pendingOf(item) > 0 ? 'Needs Attention' : 'Reviewed';
  return status;
}

function payrollIsReviewed(item) { return payrollStatus(item) === 'Reviewed' || !!(item && item.reviewed && pendingOf(item) === 0); }
function payrollNeedsAttention(item) { return payrollStatus(item) === 'Needs Attention'; }
function payrollAllReviewed(items) { return items.length > 0 && items.every(payrollIsReviewed); }
function payrollCanEdit() { return !payrollPeriodLocked() && (DEMO.showAll || hasPermission('payroll.edit')); }
function payrollCanApprove() { return !payrollPeriodLocked() && (DEMO.showAll || hasPermission('payroll.approve')); }
function payrollStatusText(status) { return payrollT(PAYROLL_STATUS_KEYS[status] || 'status'); }
function payrollStatusClass(status) { if (['Reviewed', 'Accepted', 'Approved', 'Locked'].includes(status)) return 'reviewed'; if (['Needs Attention', 'Rejected'].includes(status)) return 'attention'; return 'pending'; }
function payrollStatusBadge(status) { return `<span class="payroll-status payroll-status-${payrollStatusClass(status)}"><span class="payroll-status-dot" aria-hidden="true"></span>${payrollEscape(payrollStatusText(status))}</span>`; }
function payslipStatusBadge(status) { return payrollStatusBadge(status); }
function payrollLineSource(line) { return line && line.source ? line.source : line && line.attendanceRef ? 'biometric' : 'manager'; }
function payrollLineDate(line) { return payrollDate(line && line.date); }
function payrollRequestsFor(item) {
  const ids = new Set(item.relatedRequestIds || []);
  (item.deductionLines || []).forEach(line => { if (line.requestId) ids.add(line.requestId); });
  return (MOCK.requests || []).filter(request => ids.has(request.id) || request.employee === item.name);
}

function setPayrollDocumentLanguage() {
  if (typeof document === 'undefined') return;
  const direction = _payrollLanguage === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('lang', _payrollLanguage);
  document.documentElement.setAttribute('dir', direction);
}

function renderPayroll() {
  setPayrollDocumentLanguage();
  const direction = _payrollLanguage === 'ar' ? 'rtl' : 'ltr';
  return `<section class="payroll-shell" lang="${_payrollLanguage}" dir="${direction}">${_payrollView === 'detail' ? renderPayrollDetail() : renderPayrollOverview()}</section>`;
}

function renderPayrollPageHeader(detail, locked) {
  const title = detail ? payrollT('employeeReview') : payrollT('pageTitle');
  const subtitle = detail ? payrollT('employeeReviewSubtitle') : payrollT('pageSubtitle');
  const back = detail ? `<button type="button" class="payroll-back-button" onclick="closePayrollDetail()"><span aria-hidden="true">←</span>${payrollT('backToOverview')}</button>` : '';
  return `<header class="payroll-page-header"><div class="payroll-heading-block">${back}<p class="payroll-eyebrow">${payrollT('sourceRecord')}</p><h1>${title}</h1><p class="payroll-page-subtitle">${subtitle}</p></div><div class="payroll-header-controls"><div class="payroll-selector-fields"><label class="payroll-field"><span>${payrollT('gym')}</span><select class="form-select payroll-control" onchange="setPayrollGym(this.value)" aria-label="${payrollEscape(payrollT('gym'))}">${PAYROLL_GYMS.map(gym => `<option value="${payrollEscape(gym)}" ${gym === _payrollGym ? 'selected' : ''}>${payrollEscape(payrollGymDisplay(gym))}</option>`).join('')}</select></label><label class="payroll-field"><span>${payrollT('payPeriod')}</span><select class="form-select payroll-control" onchange="setPayrollPeriod(this.value)" aria-label="${payrollEscape(payrollT('payPeriod'))}">${['August 2026', 'July 2026', 'June 2026'].map(period => `<option value="${period}" ${period === _payPeriod ? 'selected' : ''}>${payrollEscape(payrollPeriodDisplay(period))}</option>`).join('')}</select></label></div><div class="payroll-language-wrap"><span class="payroll-language-label">${payrollT('language')}</span><div class="payroll-language-switch" role="group" aria-label="${payrollEscape(payrollT('language'))}"><button type="button" class="payroll-language-button ${_payrollLanguage === 'en' ? 'is-active' : ''}" aria-pressed="${_payrollLanguage === 'en'}" onclick="togglePayrollLanguage()">EN</button><button type="button" class="payroll-language-button ${_payrollLanguage === 'ar' ? 'is-active' : ''}" aria-pressed="${_payrollLanguage === 'ar'}" onclick="togglePayrollLanguage()">ع</button></div></div>${locked ? `<span class="payroll-locked-pill">${payrollT('published')}</span>` : ''}</div></header>`;
}

function renderPayrollOverview() {
  const items = payrollItemsForGym();
  const locked = payrollPeriodLocked();
  return `${renderPayrollPageHeader(false, locked)}${locked ? renderPayrollLockedBanner() : ''}${renderPayrollPublishPanel(items, locked)}${renderPayrollStatusStrip(items)}<section class="payroll-list-section" aria-labelledby="payroll-employee-list-title"><div class="payroll-section-heading"><div><h2 id="payroll-employee-list-title">${payrollT('employeeList')}</h2><p>${payrollT('employeeListHint')}</p></div><span class="payroll-record-count">${items.length} ${payrollT('totalEmployees').toLowerCase()}</span></div>${items.length ? `${renderPayrollTable(items)}${renderPayrollCards(items)}` : `<div class="payroll-empty-state">${payrollT('noEmployees')}</div>`}</section>`;
}

function renderPayrollLockedBanner() {
  return `<div class="payroll-locked-banner" role="status"><span class="payroll-lock-icon" aria-hidden="true">▣</span><div><strong>${payrollT('publishedLocked')}</strong><p>${payrollT('published')} · ${payrollT('periodPublished')}</p></div></div>`;
}

function renderPayrollPublishPanel(items, locked) {
  const total = items.length;
  const reviewed = items.filter(payrollIsReviewed).length;
  const allReviewed = payrollAllReviewed(items);
  const remaining = total - reviewed;
  const progress = total ? Math.round((reviewed / total) * 100) : 0;
  const canPublish = !locked && allReviewed && payrollCanApprove();
  const canSave = !locked && payrollCanEdit();
  const progressText = allReviewed ? payrollT('publishReady') : payrollT('reviewRequired', { remaining });
  return `<section class="payroll-publish-panel" aria-labelledby="payroll-publish-title"><div class="payroll-publish-copy"><div class="payroll-publish-icon" aria-hidden="true">${locked ? '▣' : '✓'}</div><div><p class="payroll-eyebrow">${locked ? payrollT('periodPublished') : payrollT('periodOpen')}</p><h2 id="payroll-publish-title">${locked ? payrollT('published') : payrollT('publishPayroll')}</h2><p class="payroll-publish-progress">${payrollT('publishProgress', { reviewed, total })} · ${progressText}</p></div></div><div class="payroll-publish-progress-wrap"><div class="payroll-progress-track" role="progressbar" aria-label="${payrollEscape(payrollT('publishProgress', { reviewed, total }))}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${reviewed}"><span style="width:${progress}%"></span></div><div class="payroll-progress-meta"><span>${payrollT('reviewed')}</span><strong>${reviewed} / ${total}</strong><span>${remaining ? `${remaining} ${payrollT('pending').toLowerCase()}` : payrollT('allReviewed')}</span></div></div><div class="payroll-publish-actions"><button type="button" class="btn btn-secondary payroll-control-button" onclick="savePayrollDraft()" ${canSave ? '' : 'disabled'}>${payrollT('saveDraft')}</button><button type="button" class="btn btn-primary payroll-publish-button" onclick="publishPayroll()" ${canPublish ? '' : 'disabled'}>${locked ? payrollT('published') : payrollT('publishPayroll')}</button></div></section>`;
}

function renderPayrollStatusStrip(items) {
  const total = items.length;
  const reviewed = items.filter(payrollIsReviewed).length;
  const pending = items.filter(item => payrollStatus(item) === 'Pending Review').length;
  const attention = items.filter(payrollNeedsAttention).length;
  return `<section class="payroll-status-strip" role="list" aria-label="${payrollEscape(payrollT('employeeList'))}"><div class="payroll-status-summary payroll-summary-total" role="listitem"><span>${payrollT('totalEmployees')}</span><strong>${total}</strong><small>${payrollGymDisplay(_payrollGym)}</small></div><div class="payroll-status-summary payroll-summary-reviewed" role="listitem"><span>${payrollT('reviewed')}</span><strong>${reviewed}</strong><small>${total ? Math.round((reviewed / total) * 100) : 0}% complete</small></div><div class="payroll-status-summary payroll-summary-pending" role="listitem"><span>${payrollT('pending')}</span><strong>${pending}</strong><small>${payrollT('pendingReview')}</small></div><div class="payroll-status-summary payroll-summary-attention" role="listitem"><span>${payrollT('needsAttention')}</span><strong>${attention}</strong><small>${payrollT('needsAttentionStatus')}</small></div></section>`;
}

function renderPayrollTable(items) {
  return `<div class="payroll-table-region"><div class="payroll-table-scroll" role="region" aria-label="${payrollEscape(payrollT('employeeList'))}" tabindex="0"><table class="payroll-table"><caption class="payroll-sr-only">${payrollT('employeeList')}</caption><thead><tr><th scope="col">${payrollT('employee')}</th><th scope="col">${payrollT('position')}</th><th scope="col">${payrollT('baseSalary')}</th><th scope="col">${payrollT('totalDeductions')}</th><th scope="col">${payrollT('bonuses')}</th><th scope="col">${payrollT('netPay')}</th><th scope="col">${payrollT('status')}</th></tr></thead><tbody>${items.map(renderPayrollTableRow).join('')}</tbody></table></div></div>`;
}

function renderPayrollTableRow(item) {
  const openLabel = payrollEscape(payrollT('openEmployee', { name: item.name }));
  return `<tr class="payroll-table-row" onclick="openPayrollDetail('${payrollEscape(item.employeeId)}')"><td><button type="button" class="payroll-row-open" onclick="event.stopPropagation();openPayrollDetail('${payrollEscape(item.employeeId)}')" aria-label="${openLabel}"><span class="payroll-avatar payroll-avatar-small" aria-hidden="true">${payrollEscape(payrollInitials(item.name, item.initials))}</span><span class="payroll-row-person"><strong>${payrollEscape(item.name)}</strong><span>${payrollEscape(item.position || '—')} · ${payrollEscape(item.employeeId)}</span></span></button></td><td>${payrollEscape(item.position || '—')}</td><td class="payroll-money-cell">${payrollAmount(baseSalaryOf(item))}</td><td class="payroll-money-cell payroll-deduction-value">− ${payrollAmount(dedTotal(item))}</td><td class="payroll-money-cell">${payrollAmount(bonusOf(item))}</td><td class="payroll-money-cell payroll-net-value" data-payroll-net="${payrollEscape(item.employeeId)}">${payrollAmount(netOf(item))}</td><td>${payrollStatusBadge(payrollStatus(item))}</td></tr>`;
}

function renderPayrollCards(items) { return `<div class="payroll-card-region">${items.map(renderPayrollEmployeeCard).join('')}</div>`; }

function renderPayrollEmployeeCard(item) {
  return `<button type="button" class="payroll-employee-card" aria-label="${payrollEscape(payrollT('openEmployee', { name: item.name }))}" onclick="openPayrollDetail('${payrollEscape(item.employeeId)}')"><span class="payroll-card-top"><span class="payroll-person-cell"><span class="payroll-avatar payroll-avatar-small" aria-hidden="true">${payrollEscape(payrollInitials(item.name, item.initials))}</span><span class="payroll-row-person"><strong>${payrollEscape(item.name)}</strong><span>${payrollEscape(item.position || '—')} · ${payrollEscape(item.employeeId)}</span></span></span>${payrollStatusBadge(payrollStatus(item))}</span><span class="payroll-card-metrics"><span><span>${payrollT('baseSalary')}</span><strong>${payrollAmount(baseSalaryOf(item))}</strong></span><span><span>${payrollT('totalDeductions')}</span><strong>− ${payrollAmount(dedTotal(item))}</strong></span><span><span>${payrollT('bonuses')}</span><strong>${payrollAmount(bonusOf(item))}</strong></span><span class="payroll-card-net"><span>${payrollT('netPay')}</span><strong data-payroll-net="${payrollEscape(item.employeeId)}">${payrollAmount(netOf(item))}</strong></span></span><span class="payroll-card-open">${payrollT('openEmployee', { name: item.name })} <span aria-hidden="true">→</span></span></button>`;
}

function renderPayrollDetail() {
  const item = (MOCK.payrollItems || []).find(payrollItem => payrollItem.employeeId === _payrollEmployeeIdValue);
  if (!item) { _payrollView = 'overview'; return renderPayrollOverview(); }
  const locked = payrollPeriodLocked(item.gym);
  const canEdit = payrollCanEdit();
  const canApprove = payrollCanApprove();
  return `${renderPayrollPageHeader(true, locked)}${locked ? renderPayrollLockedBanner() : ''}<div class="payroll-detail-content">${renderPayrollEmployeeHero(item)}${renderPayrollMoneySummary(item, canEdit)}${renderPayrollDeductionSections(item, canEdit, locked)}${renderPayrollRequestsPanel(item)}${renderPayrollPayslipSection(item)}${renderPayrollActionBar(item, canEdit, canApprove, locked)}</div>`;
}

function renderPayrollEmployeeHero(item) {
  const employee = (MOCK.employees || []).find(candidate => candidate.id === item.employeeId);
  const employmentStatus = item.employmentStatus || (employee && employee.status) || 'Active';
  return `<section class="payroll-employee-hero" aria-labelledby="payroll-employee-name"><div class="payroll-hero-avatar-wrap"><div class="payroll-avatar payroll-avatar-large" aria-label="${payrollEscape(payrollT('employee'))}">${payrollEscape(payrollInitials(item.name, item.initials))}</div><span class="payroll-avatar-photo-label">${payrollEscape(item.employeeId)}</span></div><div class="payroll-hero-copy"><div class="payroll-hero-kicker"><span>${payrollEscape(item.employeeId)}</span>${payrollStatusBadge(payrollStatus(item))}</div><h2 id="payroll-employee-name">${payrollEscape(item.name)}</h2><p>${payrollEscape(item.position || '—')} <span aria-hidden="true">·</span> ${payrollEscape(payrollGymDisplay(item.gym))}</p><div class="payroll-employment"><span>${payrollT('employmentStatus')}</span>${statusBadge(employmentStatus)}</div></div><div class="payroll-hero-summary"><span>${payrollT('baseSalary')}</span><strong>${payrollAmount(baseSalaryOf(item))}</strong><small>${payrollT('readOnly')}</small></div></section>`;
}

function renderPayrollMoneySummary(item, canEdit) {
  const payslipVisible = _payrollPayslipOpen;
  return `<section class="payroll-money-summary-wrap" aria-label="${payrollEscape(payrollT('netPay'))}"><div class="payroll-money-summary-toolbar"><p class="payroll-eyebrow">${payrollT('liveCalculation')}</p><button type="button" class="payroll-payslip-toggle" aria-expanded="${payslipVisible}" aria-controls="payroll-payslip-preview" onclick="togglePayrollPayslip()"><span aria-hidden="true">${payslipVisible ? '▾' : '▸'}</span>${payslipVisible ? payrollT('hidePayslip') : payrollT('showPayslip')}</button></div><div class="payroll-money-summary"><div class="payroll-money-cell-panel"><span>${payrollT('baseSalary')}</span><strong>${payrollAmount(baseSalaryOf(item))}</strong><small>${payrollT('readOnly')}</small></div><label class="payroll-money-cell-panel payroll-bonus-panel"><span>${payrollT('bonuses')}</span><input class="form-input payroll-control payroll-money-input" type="number" min="0" step="50" value="${bonusOf(item)}" data-payroll-bonus="${payrollEscape(item.employeeId)}" oninput="updatePayrollBonus('${payrollEscape(item.employeeId)}', this.value)" onchange="commitPayrollBonus('${payrollEscape(item.employeeId)}', this.value)" ${canEdit ? '' : 'disabled'} aria-label="${payrollEscape(payrollT('bonuses'))}"><small>${payrollT('editable')}</small></label><div class="payroll-money-cell-panel payroll-net-panel"><span>${payrollT('netPay')}</span><strong data-payroll-net="${payrollEscape(item.employeeId)}">${payrollAmount(netOf(item))}</strong><small>${payrollT('liveCalculation')}</small></div></div></section>`;
}

function renderPayrollDeductionSections(item, canEdit, locked) {
  const biometric = (item.deductionLines || []).filter(line => payrollLineSource(line) === 'biometric');
  const manager = (item.deductionLines || []).filter(line => payrollLineSource(line) === 'manager');
  return `<div class="payroll-deduction-grid"><section class="payroll-deduction-section payroll-biometric-section" aria-labelledby="payroll-biometric-title"><div class="payroll-deduction-heading"><div><p class="payroll-eyebrow">${payrollT('source')}</p><h2 id="payroll-biometric-title">${payrollT('biometricDeductions')}</h2><p>${payrollT('biometricHint')}</p></div><span class="payroll-section-count">${biometric.length}</span></div><div class="payroll-deduction-lines">${biometric.length ? biometric.map(line => renderPayrollDeductionLine(item, line, canEdit, locked)).join('') : `<div class="payroll-line-empty">${payrollT('emptyRequests')}</div>`}</div></section><section class="payroll-deduction-section payroll-manager-section" aria-labelledby="payroll-manager-title"><div class="payroll-deduction-heading"><div><p class="payroll-eyebrow">${payrollT('source')}</p><h2 id="payroll-manager-title">${payrollT('managerDeductions')}</h2><p>${payrollT('managerHint')}</p></div><span class="payroll-section-count">${manager.length}</span></div><div class="payroll-deduction-lines">${manager.length ? manager.map(line => renderPayrollDeductionLine(item, line, canEdit, locked)).join('') : `<div class="payroll-line-empty">${payrollT('emptyRequests')}</div>`}</div>${renderPayrollAddDeduction(item, canEdit, locked)}</section></div>`;
}

function renderPayrollDeductionLine(item, line, canEdit, locked) {
  const source = payrollLineSource(line);
  const canDecide = canEdit && !locked && line.status === 'Pending';
  const isManager = source === 'manager';
  const attendanceRef = line.attendanceRef || '';
  return `<article class="payroll-deduction-line"><div class="payroll-line-main"><div class="payroll-line-title"><span class="payroll-source-tag payroll-source-${source}">${payrollT(source)}</span><strong>${payrollEscape(line.label || line.reason || '—')}</strong></div><p class="payroll-line-reason">${payrollEscape(line.reason || '—')}</p><div class="payroll-line-meta"><span><b>${payrollT('date')}</b> ${payrollEscape(payrollLineDate(line))}</span>${isManager ? '' : `<span class="payroll-attendance-ref"><b>${payrollT('linkedAttendance')}</b> ${attendanceRef ? `<button type="button" class="payroll-attendance-link" onclick="openPayrollAttendanceRef('${payrollEscape(attendanceRef)}')">${payrollEscape(attendanceRef)}</button>` : '—'}</span>`}</div></div><div class="payroll-line-side">${isManager ? `<label class="payroll-line-amount"><span>${payrollT('amount')}</span><input class="form-input payroll-control payroll-amount-input" type="number" min="0" step="50" value="${Number(line.amount) || 0}" onchange="updatePayrollDeduction('${payrollEscape(item.employeeId)}','${payrollEscape(line.id)}',this.value)" ${canEdit ? '' : 'disabled'} aria-label="${payrollEscape(payrollT('amount'))}"></label>` : `<div class="payroll-line-amount payroll-line-amount-readonly"><span>${payrollT('amount')}</span><strong>− ${payrollAmount(line.amount)}</strong></div>`}<div class="payroll-line-status">${payrollStatusBadge(line.status)}${canDecide ? `<div class="payroll-line-actions"><button type="button" class="btn btn-sm btn-success payroll-line-action" onclick="decidePayrollDeduction('${payrollEscape(item.employeeId)}','${payrollEscape(line.id)}',true)">${payrollT('approve')}</button><button type="button" class="btn btn-sm btn-danger-outline payroll-line-action" onclick="decidePayrollDeduction('${payrollEscape(item.employeeId)}','${payrollEscape(line.id)}',false)">${payrollT('reject')}</button></div>` : line.status === 'Pending' ? `<span class="payroll-pending-note">${payrollT('pendingDecision')}</span>` : ''}</div></div></article>`;
}

function renderPayrollAddDeduction(item, canEdit, locked) {
  const disabled = !canEdit || locked;
  return `<form class="payroll-add-deduction" onsubmit="event.preventDefault();savePayrollDeductionInline(event,'${payrollEscape(item.employeeId)}')"><div class="payroll-add-heading"><div><strong>${payrollT('addDeduction')}</strong><span>${payrollT('addDeductionHint')}</span></div><button type="submit" class="btn btn-secondary payroll-add-button" ${disabled ? 'disabled' : ''}>+ ${payrollT('addDeduction')}</button></div><fieldset class="payroll-add-fields" ${disabled ? 'disabled' : ''}><label class="payroll-field"><span>${payrollT('source')}</span><select name="source" class="form-select payroll-control"><option value="manager">${payrollT('manager')}</option><option value="biometric">${payrollT('biometric')}</option></select></label><label class="payroll-field"><span>${payrollT('reason')}</span><input name="reason" class="form-input payroll-control" required placeholder="${payrollEscape(payrollT('reason'))}"></label><label class="payroll-field"><span>${payrollT('date')}</span><input name="date" type="date" class="form-input payroll-control" value="2026-08-31" required></label><label class="payroll-field"><span>${payrollT('amount')}</span><input name="amount" type="number" min="0" step="50" class="form-input payroll-control" required placeholder="0"></label><label class="payroll-field payroll-attendance-field"><span>${payrollT('attendanceReference')}</span><input name="attendanceRef" class="form-input payroll-control" placeholder="ATT-2026-08-31-01"></label></fieldset></form>`;
}

function renderPayrollRequestsPanel(item) {
  const requests = payrollRequestsFor(item);
  return `<section class="payroll-requests-panel" aria-labelledby="payroll-requests-title"><div class="payroll-panel-heading"><div><p class="payroll-eyebrow">${payrollT('sourceRecord')}</p><h2 id="payroll-requests-title">${payrollT('relatedRequests')}</h2><p>${payrollT('relatedRequestsHint')}</p></div><span class="payroll-section-count">${requests.length}</span></div>${requests.length ? `<div class="payroll-request-list">${requests.map(request => `<div class="payroll-request-row"><div class="payroll-request-copy"><strong>${payrollEscape(request.type)}</strong><span>${payrollEscape(request.requestedDate || request.submittedDate || '—')}</span><small>${payrollEscape(request.reason || '')}</small></div><div class="payroll-request-actions">${statusBadge(request.status)}<button type="button" class="btn btn-sm btn-secondary payroll-request-button" onclick="openRequestDetail('${payrollEscape(request.id)}')">${payrollT('openRequest')}</button></div></div>`).join('')}</div>` : `<div class="payroll-panel-empty">${payrollT('noRelatedRequests')}</div>`}</section>`;
}

function renderPayrollPayslipSection(item) {
  const lines = item.deductionLines || [];
  return `<section id="payroll-payslip-preview" class="payroll-payslip-section"${_payrollPayslipOpen ? '' : ' hidden'} aria-labelledby="payroll-payslip-title"><div class="payroll-panel-heading"><div><p class="payroll-eyebrow">${payrollT('payslipPreview')}</p><h2 id="payroll-payslip-title">${payrollT('payslipPreview')}</h2><p>${payrollT('netPay')} · ${payrollEscape(payrollPeriodDisplay(_payPeriod))}</p></div><button type="button" class="payroll-icon-button" onclick="togglePayrollPayslip()" aria-label="${payrollEscape(payrollT('hidePayslip'))}">×</button></div><div class="payroll-payslip-grid"><div><span>${payrollT('baseSalary')}</span><strong>${payrollAmount(baseSalaryOf(item))}</strong></div><div><span>${payrollT('bonuses')}</span><strong>${payrollAmount(bonusOf(item))}</strong></div><div><span>${payrollT('totalDeductions')}</span><strong>− ${payrollAmount(dedTotal(item))}</strong></div><div class="payroll-payslip-total"><span>${payrollT('netPay')}</span><strong data-payroll-net="${payrollEscape(item.employeeId)}">${payrollAmount(netOf(item))}</strong></div></div><div class="payroll-payslip-lines">${lines.length ? lines.map(line => `<div class="payroll-payslip-line"><span>${payrollEscape(line.label || line.reason || '—')}</span><span>− ${payrollAmount(line.amount)}</span>${payrollStatusBadge(line.status)}</div>`).join('') : `<div class="payroll-panel-empty">${payrollT('emptyRequests')}</div>`}</div></section>`;
}

function renderPayrollActionBar(item, canEdit, canApprove, locked) {
  const pending = pendingOf(item);
  const alreadyReviewed = payrollStatus(item) === 'Reviewed';
  const canSave = canEdit && !locked;
  const canAccept = canApprove && !locked && !pending && !alreadyReviewed;
  return `<footer class="payroll-sticky-actions"><div class="payroll-action-message">${locked ? `<span class="payroll-action-lock">${payrollT('publishedLocked')}</span>` : pending ? `<span class="payroll-action-warning">${payrollT('acceptBlocked')}</span>` : `<span>${alreadyReviewed ? payrollT('markedReviewed') : payrollT('saveDraftHint')}</span>`}</div><div class="payroll-action-buttons"><button type="button" class="btn btn-secondary payroll-action-button" onclick="savePayrollDraft('${payrollEscape(item.employeeId)}')" ${canSave ? '' : 'disabled'}>${payrollT('saveContinue')}</button><button type="button" class="btn btn-primary payroll-action-button" onclick="acceptPayrollEmployee('${payrollEscape(item.employeeId)}')" ${canAccept ? '' : 'disabled'}>${alreadyReviewed ? payrollT('markedReviewed') : payrollT('acceptReviewed')}</button></div></footer>`;
}

function setPayrollGym(gym) {
  if (PAYROLL_GYMS.indexOf(gym) === -1) return;
  _payrollGym = gym;
  _payrollView = 'overview';
  _payrollPayslipOpen = false;
  renderAll();
}

function setPayrollPeriod(period) {
  if (['August 2026', 'July 2026', 'June 2026'].indexOf(period) === -1) return;
  _payPeriod = period;
  _payrollView = 'overview';
  _payrollPayslipOpen = false;
  renderAll();
}

function togglePayrollLanguage() {
  _payrollLanguage = _payrollLanguage === 'en' ? 'ar' : 'en';
  renderAll();
}

function openPayrollDetail(id) {
  const item = (MOCK.payrollItems || []).find(payrollItem => payrollItem.employeeId === id);
  if (!item) return;
  _payrollEmployeeIdValue = id;
  _payrollView = 'detail';
  _payrollPayslipOpen = false;
  renderAll();
  const main = document.getElementById('main-content');
  if (main) main.scrollTop = 0;
  const mobile = document.getElementById('mobile-content');
  if (mobile) mobile.scrollTop = 0;
}

function closePayrollDetail() { _payrollView = 'overview'; _payrollPayslipOpen = false; renderAll(); }
function togglePayrollPayslip() { _payrollPayslipOpen = !_payrollPayslipOpen; renderAll(); }

function savePayrollDraft(id) {
  if (payrollPeriodLocked()) { showToast(payrollT('periodLockedToast'), 'error'); return; }
  const items = id ? (MOCK.payrollItems || []).filter(item => item.employeeId === id) : payrollItemsForGym();
  if (!items.length) return;
  if (!payrollCanEdit()) { showToast(payrollT('permissionToast'), 'error'); return; }
  _payrollDraftSavedAt = new Date().toISOString();
  items.forEach(item => { item.draftSavedAt = _payrollDraftSavedAt; payrollSyncTotals(item); });
  showToast(payrollT('draftSaved'));
  if (id) closePayrollDetail(); else renderAll();
}

function updatePayrollBonus(id, rawValue) {
  const item = (MOCK.payrollItems || []).find(payrollItem => payrollItem.employeeId === id);
  if (!item || !payrollCanEdit()) return;
  item.bonus = Math.max(0, Number(rawValue) || 0);
  payrollSyncTotals(item);
  document.querySelectorAll(`[data-payroll-net="${id}"]`).forEach(element => { element.textContent = payrollAmount(netOf(item)); });
  document.querySelectorAll(`[data-payroll-bonus="${id}"]`).forEach(element => { if (document.activeElement !== element) element.value = bonusOf(item); });
}

function commitPayrollBonus(id, rawValue) { updatePayrollBonus(id, rawValue); showToast(payrollT('bonusSaved')); }

function updatePayrollDeduction(id, lineId, rawValue) {
  const item = (MOCK.payrollItems || []).find(payrollItem => payrollItem.employeeId === id);
  const line = item && (item.deductionLines || []).find(candidate => candidate.id === lineId);
  if (!line || !payrollCanEdit()) return;
  line.amount = Math.max(0, Number(rawValue) || 0);
  payrollSyncTotals(item);
  showToast(payrollT('deductionUpdated'));
  renderAll();
}

function decidePayrollDeduction(id, lineId, accept) {
  if (payrollPeriodLocked()) { showToast(payrollT('periodLockedToast'), 'error'); return; }
  const item = (MOCK.payrollItems || []).find(payrollItem => payrollItem.employeeId === id);
  const line = item && (item.deductionLines || []).find(candidate => candidate.id === lineId);
  if (!line) return;
  if (!payrollCanApprove()) { showToast(payrollT('permissionToast'), 'error'); return; }
  if (line.status !== 'Pending') return;
  line.status = accept ? 'Accepted' : 'Rejected';
  line.decidedAt = new Date().toISOString();
  payrollSyncTotals(item);
  renderAll();
  if (accept) showToast(payrollT('accepted'));
}

function savePayrollDeductionInline(event, id) {
  if (payrollPeriodLocked()) { showToast(payrollT('periodLockedToast'), 'error'); return; }
  const item = (MOCK.payrollItems || []).find(payrollItem => payrollItem.employeeId === id);
  if (!item) return;
  if (!payrollCanEdit()) { showToast(payrollT('permissionToast'), 'error'); return; }
  const form = event && event.currentTarget ? event.currentTarget : event && event.target ? event.target.closest('form') : null;
  if (!form) return;
  const data = new FormData(form);
  const amount = Math.max(0, Number(data.get('amount')) || 0);
  const reason = String(data.get('reason') || '').trim();
  if (!reason || !amount) return;
  const source = data.get('source') === 'biometric' ? 'biometric' : 'manager';
  const line = {
    id: `dn-${item.employeeId}-${Date.now()}`,
    label: reason,
    reason,
    source,
    date: String(data.get('date') || ''),
    amount,
    status: 'Pending',
    attendanceRef: source === 'biometric' ? String(data.get('attendanceRef') || '').trim() : ''
  };
  item.deductionLines = item.deductionLines || [];
  item.deductionLines.push(line);
  item.status = 'Needs Attention';
  payrollSyncTotals(item);
  showToast(payrollT('deductionAdded', { name: item.name }));
  renderAll();
}

function acceptPayrollEmployee(id) {
  if (payrollPeriodLocked()) { showToast(payrollT('periodLockedToast'), 'error'); return; }
  const item = (MOCK.payrollItems || []).find(payrollItem => payrollItem.employeeId === id);
  if (!item) return;
  if (!payrollCanApprove()) { showToast(payrollT('permissionToast'), 'error'); return; }
  if (pendingOf(item) > 0) { showToast(payrollT('acceptBlocked'), 'error'); return; }
  item.status = 'Reviewed';
  item.reviewed = true;
  item.reviewedAt = new Date().toISOString();
  payrollSyncTotals(item);
  showToast(payrollT('acceptedToast', { name: item.name }));
  closePayrollDetail();
}

function publishPayroll() {
  if (payrollPeriodLocked()) { showToast(payrollT('periodLockedToast'), 'error'); return; }
  const items = payrollItemsForGym();
  if (!items.length) { showToast(payrollT('noEmployees'), 'error'); return; }
  if (!payrollCanApprove()) { showToast(payrollT('permissionToast'), 'error'); return; }
  if (!payrollAllReviewed(items)) { showToast(payrollT('reviewRequired', { remaining: items.length - items.filter(payrollIsReviewed).length }), 'error'); return; }
  openModal(payrollT('confirmPublishTitle'), `<p class="payroll-confirm-text">${payrollEscape(payrollT('confirmPublishText', { period: payrollPeriodDisplay(_payPeriod), gym: payrollGymDisplay(_payrollGym), count: items.length }))}</p>`, { footer: `<button onclick="closeModal()" class="btn btn-sm btn-secondary">${payrollEscape(payrollT('cancel'))}</button><button onclick="confirmPublishPayroll()" class="btn btn-sm btn-primary">${payrollEscape(payrollT('confirmPublish'))}</button>` });
}

function confirmPublishPayroll() {
  const items = payrollItemsForGym();
  if (!items.length || !payrollAllReviewed(items)) { closeModal(); return; }
  let record = (MOCK.payroll || []).find(candidate => candidate.period === _payPeriod);
  if (!record) { record = { period: _payPeriod, status: 'Open', locked: false, publishedGyms: [] }; MOCK.payroll.push(record); }
  record.publishedGyms = record.publishedGyms || [];
  if (record.publishedGyms.indexOf(_payrollGym) === -1) record.publishedGyms.push(_payrollGym);
  const gyms = PAYROLL_GYMS.filter(gym => (MOCK.payrollItems || []).some(item => item.gym === gym));
  record.status = gyms.every(gym => (record.publishedGyms || []).includes(gym)) ? 'Published' : 'Partially Published';
  record.locked = gyms.every(gym => (record.publishedGyms || []).includes(gym));
  record.publishedAt = new Date().toISOString();
  items.forEach(item => { item.status = 'Locked'; item.reviewed = true; item.publishedAt = record.publishedAt; });
  closeModal();
  renderAll();
  showToast(payrollT('published'));
}

function openPayrollAttendanceRef(ref) { showToast(payrollT('attendanceReferenceToast', { ref })); }

function currentPayPeriod() { return _payPeriod; }
function payStepText() { return ['Import', 'Review', 'Approve', 'Publish'][_payStep] || 'Review'; }
function getPayStep() { return _payStep; }
function setPayStep(step) { _payStep = Number(step) || 1; renderAll(); }
function periodKey() { return _payPeriod; }
function togglePayslip() { togglePayrollPayslip(); }
function acceptItem(id) { acceptPayrollEmployee(id); }
function decideLine(itemId, lineId, decision) { decidePayrollDeduction(itemId, lineId, decision === true || decision === 'accept' || decision === 'Approved'); }
function netPayOf(item) { return netOf(item); }
function isPeriodLocked() { return payrollPeriodLocked(); }
function gymOptions() { return PAYROLL_GYMS; }
function renderPayrollItemCards() { return renderPayrollCards(payrollItemsForGym()); }
function renderPayrollItemTable() { return renderPayrollTable(payrollItemsForGym()); }
function renderPayrollOverviewSection() { return renderPayrollOverview(); }
function renderPayrollDetailSection() { return renderPayrollDetail(); }
function statusText(status) { return payrollStatusText(status); }
function currentEmployee() { return (MOCK.payrollItems || []).find(item => item.employeeId === _payrollEmployeeIdValue) || null; }
function currentEmployeeId() { return _payrollEmployeeIdValue; }
function getPayrollItems() { return MOCK.payrollItems || []; }
function gymIdOf(item) { return item && item.gym; }
function esc(value) { return payrollEscape(value); }
function getPayPeriod() { return _payPeriod; }

