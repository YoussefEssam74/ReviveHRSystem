/**
 * Copy that surfaced after the first translation pass (long helper sentences,
 * UPPERCASE section labels and interpolated toasts). Kept separate so the
 * per-feature dictionaries stay readable.
 */
export const gaps: Record<string, string> = {
  // ---- interpolated ----
  '{{count}} conflict': '{{count}} تعارض',
  '{{count}} days · whole {{month}}': '{{count}} أيام · كامل {{month}}',
  '{{count}} shifts assigned': 'تم إسناد {{count}} وردية',
  '{{count}} with missing days': '{{count}} لديهم أيام ناقصة',
  '{{date}} · Submitted {{submitted}}': '{{date}} · أُرسل {{submitted}}',
  '{{document}} full view': 'عرض {{document}} كاملًا',
  '{{message}} Check your connection and try again.': '{{message}} تحقق من اتصالك وحاول مرة أخرى.',
  '{{message}} The server failed to return the file — try again in a moment.':
    '{{message}} فشل الخادم في إرجاع الملف — حاول مرة أخرى بعد قليل.',
  '{{remaining}} of {{cap}} h left': 'متبقي {{remaining}} من {{cap}} ساعة',
  '{{shown}} of {{total}} days (weekly repeat)': '{{shown}} من {{total}} يومًا (تكرار أسبوعي)',
  '{{type}} · {{range}} · Submitted {{date}}': '{{type}} · {{range}} · أُرسل {{date}}',
  '{{used}} / {{total}} days used · {{remaining}} left': 'استُخدم {{used}} / {{total}} يومًا · متبقي {{remaining}}',
  'Page {{page}} of {{totalPages}} · {{total}} total': 'صفحة {{page}} من {{totalPages}} · {{total}} إجمالًا',
  'Save {{count}} cell': 'حفظ {{count}} خلية',
  'Save {{count}} cells': 'حفظ {{count}} خلية',
  'Approve request #{{id}}': 'الموافقة على الطلب #{{id}}',
  'Reject request #{{id}}': 'رفض الطلب #{{id}}',
  'Request #{{id}}': 'الطلب #{{id}}',
  'Request #{{id}} approved.': 'تمت الموافقة على الطلب #{{id}}.',
  'Request #{{id}} rejected.': 'تم رفض الطلب #{{id}}.',
  'Request #{{id}} filed for {{name}} — pending HR review': 'تم تسجيل الطلب #{{id}} لـ {{name}} — في انتظار مراجعة الموارد البشرية',
  "Close {{name}}'s leaving process? The person stays employed and a new process can be initiated later.":
    'إغلاق عملية إنهاء خدمة {{name}}؟ يبقى الموظف على رأس العمل ويمكن بدء عملية جديدة لاحقًا.',
  "Move the last working day of {{name}}'s leaving process.": 'تغيير آخر يوم عمل في عملية إنهاء خدمة {{name}}.',
  "Update {{name}}'s working status. This is recorded in their history.": 'تحديث حالة عمل {{name}}. يُسجَّل ذلك في سجله.',
  'No schedule covers {{month}}': 'لا يوجد جدول يغطي {{month}}',
  'Expires {{date}}': 'ينتهي {{date}}',
  'Gym · {{gym}}': 'الصالة · {{gym}}',
  'Payment: {{payment}}': 'الدفع: {{payment}}',
  'submitted {{date}}': 'أُرسل {{date}}',
  "Today's attendance columns are unavailable: {{error}}": 'أعمدة حضور اليوم غير متاحة: {{error}}',
  "Today's branch attendance · {{gym}} · {{date}}": 'حضور الفرع اليوم · {{gym}} · {{date}}',
  "You've used all {{count}} annual leave days. Day-off requests are blocked until next year.":
    'لقد استخدمت كل أيام الإجازة السنوية ({{count}}). طلبات أيام الراحة محظورة حتى العام القادم.',

  // ---- payroll summary ----
  'PAYROLL SUMMARY': 'ملخص الرواتب',
  'YEAR TO DATE': 'من بداية العام',
  '{{count}} months paid': '{{count}} أشهر مدفوعة',
  Earned: 'المكتسب',
  'Avg / Month': 'المتوسط / شهر',
  'SALARY & SCHEDULE': 'الراتب والجدول',
  'Contractual Salary / month': 'الراتب التعاقدي / شهر',
  'Scheduled Work Days': 'أيام العمل المجدولة',
  'Weekly Days': 'أيام الأسبوع',
  'Attendance · {{percent}}%': 'الحضور · {{percent}}%',
  Overtime: 'العمل الإضافي',
  'ANNUAL LEAVE': 'الإجازة السنوية',
  'Accrues / month': 'يُستحق / شهر',
  'Used this year': 'المستخدم هذا العام',
  'Days left': 'الأيام المتبقية',
  'Annual leave accrues monthly against your {{total}}-day allowance — you have {{remaining}} of {{total}} days left this year.':
    'تُستحق الإجازة السنوية شهريًا من رصيدك البالغ {{total}} يومًا — لديك {{remaining}} من {{total}} يومًا متبقية هذا العام.',
  'Current Period': 'الفترة الحالية',
  '· Payout pending': '· الدفع معلّق',
  'Being processed…': 'جارٍ المعالجة…',
  'This period is still open — its payout is not visible yet.': 'هذه الفترة لا تزال مفتوحة — لم يظهر مستحقاتها بعد.',
  'ATTENDANCE & LEAVE': 'الحضور والإجازات',
  '{{worked}}/{{total}} days': '{{worked}}/{{total}} يومًا',
  '{{count}} worked': '{{count}} يوم عمل',
  '{{count}} not worked': '{{count}} يوم بدون عمل',
  '{{count}}h overtime': '{{count}} ساعة عمل إضافي',
  '{{count}} paid leave': '{{count}} إجازة مدفوعة',
  '{{count}} unpaid': '{{count}} بدون أجر',
  'Early Leave': 'انصراف مبكر',
  'Sick Leave': 'إجازة مرضية',
  'Annual Leave': 'إجازة سنوية',
  'Salary Advance': 'سلفة راتب',
  'Leave deduction': 'خصم الإجازة',
  'Net Salary': 'صافي الراتب',
  'Net Pay': 'صافي الأجر',

  // ---- UPPERCASE section labels ----
  ABSENT: 'غائب',
  ATTENDANCE: 'الحضور',
  'ASSIGNED SHIFT': 'الوردية المسندة',
  'CONFLICTS ({{count}})': 'التعارضات ({{count}})',
  'CURRENT WEEK': 'الأسبوع الحالي',
  DEDUCTIONS: 'الخصومات',
  EXPIRES: 'ينتهي',
  'LATEST PAYSLIP': 'أحدث قسيمة راتب',
  'NEW REQUEST': 'طلب جديد',
  NOTIFICATIONS: 'الإشعارات',
  'PENDING REQUESTS': 'الطلبات المعلّقة',
  REASON: 'السبب',
  SUBMITTED: 'أُرسل',
  TIMELINE: 'المخطط الزمني',
  "TODAY'S ATTENDANCE": 'حضور اليوم',
  "TODAY'S SHIFT": 'وردية اليوم',
  TYPE: 'النوع',
  UPLOADED: 'تاريخ الرفع',
  'WARNINGS & DEDUCTIONS': 'الإنذارات والخصومات',
  late: 'متأخر',
  present: 'حاضر',
  absent: 'غائب',
  'New request': 'طلب جديد',

  // ---- schedule / shift planner ----
  'Assign Shifts': 'إسناد الورديات',
  'Assigning shifts needs a manager role in the active gym.': 'يتطلب إسناد الورديات دور مدير في الصالة النشطة.',
  "Assignments appear for the gym's employees; either no workers belong here yet, or none are scheduled.":
    'تظهر الإسنادات لموظفي الصالة؛ إما أنه لا يوجد موظفون هنا بعد، أو لا أحد مجدول.',
  'Back to the 7-day view — shifts repeat weekly': 'العودة إلى عرض 7 أيام — تتكرر الورديات أسبوعيًا',
  'Click a cell or drag across the grid to paint it.': 'انقر على خلية أو اسحب عبر الشبكة لتلوينها.',
  'Copy Previous': 'نسخ السابق',
  'Create New Schedule': 'إنشاء جدول جديد',
  'Create a schedule whose dates overlap this month, or pick another month.':
    'أنشئ جدولًا تتقاطع تواريخه مع هذا الشهر، أو اختر شهرًا آخر.',
  'Delete Schedule': 'حذف الجدول',
  'Delete this schedule cycle? Its assignments are removed with it — employees lose the shifts of this period. This cannot be undone.':
    'حذف دورة الجدول هذه؟ ستُحذف إسناداتها معها — سيفقد الموظفون ورديات هذه الفترة. لا يمكن التراجع عن ذلك.',
  'Draft schedule.': 'جدول مسودة.',
  'Editing enabled — pick a shift below, then click or drag across the grid to paint it. “Off” books an explicit rest day; days left untouched stay “Not assigned”. Row ➤ and day ⬇ buttons fill in one click. Remember to Publish — draft shifts stay invisible to employees until then.':
    'التعديل مُفعّل — اختر وردية أدناه، ثم انقر أو اسحب عبر الشبكة لتلوينها. «راحة» يحجز يوم راحة صريحًا؛ والأيام التي تُركت دون تغيير تبقى «غير مسندة». أزرار ➤ للصف و⬇ لليوم تملأ بنقرة واحدة. تذكّر النشر — تبقى ورديات المسودة غير مرئية للموظفين حتى ذلك الحين.',
  'Editing enabled — pick a shift below, then click or drag across the grid to paint it. “Off” books an explicit rest day; days left untouched stay “Not assigned”. Row ➤ and day ⬇ buttons fill in one click. This schedule is already Published — saved edits reach employees immediately; no re-publish is needed.':
    'التعديل مُفعّل — اختر وردية أدناه، ثم انقر أو اسحب عبر الشبكة لتلوينها. «راحة» يحجز يوم راحة صريحًا؛ والأيام التي تُركت دون تغيير تبقى «غير مسندة». أزرار ➤ للصف و⬇ لليوم تملأ بنقرة واحدة. هذا الجدول منشور بالفعل — تصل التعديلات المحفوظة إلى الموظفين فورًا؛ ولا حاجة لإعادة النشر.',
  'Employees (and their profile Shift tab) can only see published schedules — paint the week, save, then press':
    'لا يرى الموظفون (وتبويب الورديات في ملفهم) إلا الجداول المنشورة — لوّن الأسبوع، واحفظ، ثم اضغط',
  'Employees who still have weekdays marked Not assigned': 'الموظفون الذين لا تزال أيام الأسبوع لديهم غير مسندة',
  'Future month — plan ahead and assign shifts.': 'شهر قادم — خطّط مسبقًا وأسند الورديات.',
  'Live month — pick a period below to view or assign shifts.': 'الشهر الحالي — اختر فترة أدناه لعرض الورديات أو إسنادها.',
  "No employees in this cycle's roster": 'لا يوجد موظفون في جدول هذه الدورة',
  'Paint shift:': 'تلوين الوردية:',
  'Paint shifts in the grid below — pick a shift in the palette, then click or drag across cells.':
    'لوّن الورديات في الشبكة أدناه — اختر وردية من اللوحة، ثم انقر أو اسحب عبر الخلايا.',
  'Past month — published and draft schedules of that month.': 'شهر سابق — الجداول المنشورة والمسودات لذلك الشهر.',
  'Pick a gym branch to view its shift cycles.': 'اختر فرعًا لعرض دورات وردياته.',
  'Preview — read only. Press “Assign Shifts” above to adjust shifts on this published schedule.':
    'معاينة — للقراءة فقط. اضغط «إسناد الورديات» أعلاه لتعديل الورديات في هذا الجدول المنشور.',
  'Preview — read only. Press “Assign Shifts” above to paint shifts onto this draft.':
    'معاينة — للقراءة فقط. اضغط «إسناد الورديات» أعلاه لتلوين الورديات في هذه المسودة.',
  'Preview not available': 'المعاينة غير متاحة',
  "Publish makes this schedule visible in every employee's Shift tab":
    'النشر يجعل هذا الجدول مرئيًا في تبويب الورديات لكل موظف',
  'Publish Shift': 'نشر الورديات',
  'Schedule created — assign shifts on the draft.': 'تم إنشاء الجدول — أسند الورديات في المسودة.',
  'Schedule deleted — the cycle and its assignments were removed.': 'تم حذف الجدول — أُزيلت الدورة وإسناداتها.',
  'Schedule pages are for managers': 'صفحات الجدول مخصصة للمديرين',
  'Schedule published.': 'تم نشر الجدول.',
  'Shift assignments saved.': 'تم حفظ إسنادات الورديات.',
  'Show 30 days': 'عرض 30 يومًا',
  'Show 7 days': 'عرض 7 أيام',
  'Show every day of the month (up to 31 days)': 'عرض كل أيام الشهر (حتى 31 يومًا)',
  'The Missing column counts weekdays that still need a shift or an Off day.':
    'يحسب عمود الناقص أيام الأسبوع التي لا تزال بحاجة إلى وردية أو يوم راحة.',
  "This schedule is a Draft — press “Publish Shift” to make it visible in employees' Shift tabs.":
    'هذا الجدول مسودة — اضغط «نشر الورديات» لجعله مرئيًا في تبويبات ورديات الموظفين.',
  'Whole month visible — a painted weekday repeats every following week inside the cycle.':
    'الشهر كامل ظاهر — يتكرر يوم الأسبوع الملوّن كل أسبوع لاحق داخل الدورة.',
  'above to make these shifts visible.': 'أعلاه لجعل هذه الورديات مرئية.',
  'Month': 'الشهر',
  'Live': 'حالي',
  'Planned': 'مخطط',
  'Past': 'سابق',
  'Unavailable': 'غير متاح',

  // ---- attendance / documents / desk ----
  'Attached document': 'المستند المرفق',
  'Checking salary…': 'جارٍ التحقق من الراتب…',
  'Close document': 'إغلاق المستند',
  "Couldn't load the document": 'تعذّر تحميل المستند',
  'Desk comment': 'تعليق المكتب',
  'Desk decision': 'قرار المكتب',
  'Final HR sign-off — the employee is notified.': 'الاعتماد النهائي من الموارد البشرية — يُخطَر الموظف.',
  'HR comment': 'تعليق الموارد البشرية',
  'HR decision': 'قرار الموارد البشرية',
  'HR rows appear as soon as branch managers approve requests to review.':
    'تظهر صفوف الموارد البشرية بمجرد أن يعتمد مديرو الفروع الطلبات للمراجعة.',
  'Loading desk…': 'جارٍ تحميل المكتب…',
  'Loading document…': 'جارٍ تحميل المستند…',
  'Loading documents…': 'جارٍ تحميل المستندات…',
  'Loading HR inbox…': 'جارٍ تحميل صندوق الموارد البشرية…',
  "Loading today's roster...": 'جارٍ تحميل جدول اليوم...',
  'Medical certificate': 'شهادة طبية',
  'New amount (EGP)': 'المبلغ الجديد (جنيه)',
  'New Template': 'قالب جديد',
  'No document uploaded': 'لم يتم رفع أي مستند',
  'No evaluations yet.': 'لا توجد تقييمات بعد.',
  'No reason provided.': 'لم يُذكر سبب.',
  'No salary on file — the cover pay cannot be priced yet.': 'لا يوجد راتب مسجل — لا يمكن تسعير أجر التغطية بعد.',
  'Not allowed to open this document': 'غير مسموح بفتح هذا المستند',
  'Not paid yet': 'لم يُدفع بعد',
  "One-to-one message; it shows up in the member's notifications.": 'رسالة فردية؛ تظهر في إشعارات العضو.',
  'Payment': 'الدفع',
  'Reason (required for rejection)': 'السبب (مطلوب للرفض)',
  "Recorded automatically at the attendance station — you can't cancel it, but agreeing doesn't change your monthly day-off balance.":
    'يُسجَّل تلقائيًا في محطة الحضور — لا يمكنك إلغاؤه، لكن الموافقة لا تغيّر رصيد أيام الراحة الشهرية.',
  "Register an employee's face for Face-ID attendance check-in.": 'سجّل وجه الموظف لتسجيل الحضور بالتعرف على الوجه.',
  'Rejection of an unscheduled day keeps the punch as present with no cover day.':
    'رفض يوم غير مجدول يُبقي البصمة حاضرًا دون يوم تغطية.',
  'Requested for': 'مطلوب لـ',
  'Requests desk is for managers and HR': 'مكتب الطلبات مخصص للمديرين والموارد البشرية',
  'Sends a reminder notification for this item.': 'يرسل إشعار تذكير لهذا العنصر.',
  "Sends a reminder notification for today's shift.": 'يرسل إشعار تذكير بوردية اليوم.',
  'Select type...': 'اختر النوع...',
  'Submitted on': 'أُرسل في',
  'The employee\'s standing does not change until the case is completed.': 'لا يتغيّر موقف الموظف حتى تُكتمل الحالة.',
  'This account is not linked to an employee profile, so it has no attendance to show.':
    'هذا الحساب غير مرتبط بملف موظف، لذا لا يوجد حضور لعرضه.',
  'This account is not linked to an employee profile, so it has no schedule to show.':
    'هذا الحساب غير مرتبط بملف موظف، لذا لا يوجد جدول لعرضه.',
  "This file type can't be displayed in the browser. Download it to open it.":
    'لا يمكن عرض هذا النوع من الملفات في المتصفح. نزّله لفتحه.',
  "This is an extra/cover-day value and does not reduce the employee's monthly day-off balance.":
    'هذه قيمة يوم إضافي/تغطية ولا تُنقص رصيد أيام الراحة الشهرية للموظف.',
  'This request is marked as having an attachment, but no file is stored for it.':
    'هذا الطلب مُعلَّم بأنه يحتوي على مرفق، لكن لا يوجد ملف مخزّن له.',
  "Today's View": 'عرض اليوم',
  'Uploaded with this request': 'مرفق مع هذا الطلب',
  "Upserts today's attendance record.": 'يُنشئ أو يحدّث سجل حضور اليوم.',
  "Upserts today's attendance record. Punch times use the shift defaults.":
    'يُنشئ أو يحدّث سجل حضور اليوم. تُستخدم أوقات البصمة الافتراضية للوردية.',
  'Why is this request being filed for them?': 'لماذا يُسجَّل هذا الطلب نيابةً عنه؟',

  // ---- permissions / access messages ----
  "You don't have access to reports": 'ليس لديك صلاحية الوصول إلى التقارير',
  "You don't have access to the audit log": 'ليس لديك صلاحية الوصول إلى سجل التدقيق',
  "You don't have access to the HR Team": 'ليس لديك صلاحية الوصول إلى فريق الموارد البشرية',
  "You don't have permission to view evaluations for this gym. Ask an administrator for the evaluations feature.":
    'ليس لديك صلاحية عرض تقييمات هذه الصالة. اطلب من المسؤول تفعيل ميزة التقييمات.',
  "You don't have permission to view payroll for this gym. Ask an administrator for the payroll feature.":
    'ليس لديك صلاحية عرض رواتب هذه الصالة. اطلب من المسؤول تفعيل ميزة الرواتب.',
  "Your employee self-service portal is coming soon. For now you can clock in at the gym terminal with your branch's station code.":
    'بوابة الخدمة الذاتية للموظف قادمة قريبًا. حاليًا يمكنك تسجيل الحضور من محطة الصالة باستخدام رمز محطة فرعك.',
  "You're all caught up.": 'لا توجد إشعارات جديدة.',
  "Here's what needs your attention today.": 'إليك ما يحتاج انتباهك اليوم.',
  "Routes this form to every eligible evaluator in scope. Subjects are matched to the form's gym and target position; assignments already routed are skipped.":
    'يوجّه هذا النموذج إلى كل مُقيّم مؤهل في النطاق. يُطابَق الخاضعون للتقييم مع صالة النموذج والمنصب المستهدف؛ وتُتجاهل الإسنادات الموجّهة مسبقًا.',
  "Stage-1 decisions run through the team-leader / branch-manager desk; HR gives the final sign-off here.":
    'تُتخذ قرارات المرحلة الأولى عبر مكتب قائد الفريق / مدير الفرع؛ وتمنح الموارد البشرية الاعتماد النهائي هنا.',
  "Team rows appear once evaluations are submitted for the team's members.":
    'تظهر صفوف الفريق بمجرد إرسال التقييمات لأعضاء الفريق.',
  "Filed on the employee's own record and routed to HR for the final decision.":
    'يُسجَّل في ملف الموظف نفسه ويُحال إلى الموارد البشرية للقرار النهائي.',
  "HR reviews and approves it before it appears in payroll or on the employee's payslip.":
    'تراجعها الموارد البشرية وتعتمدها قبل ظهورها في الرواتب أو في قسيمة راتب الموظف.',
  "HR reviews it and files it to the employee's record — disciplinary action is HR-owned, the Branch Manager only proposes it.":
    'تراجعها الموارد البشرية وتضيفها إلى ملف الموظف — الإجراء التأديبي من اختصاص الموارد البشرية، ومدير الفرع يقترحه فقط.',
  "HR reviews the position, shift and salary. You can't do anything here yet; you'll be notified either way.":
    'تراجع الموارد البشرية المنصب والوردية والراتب. لا يمكنك فعل أي شيء هنا بعد؛ وسيتم إخطارك في كل الأحوال.',
}
