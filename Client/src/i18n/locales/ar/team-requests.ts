/** Portal — Team Requests (manager/HR requests desk). */
export const teamRequests: Record<string, string> = {
  // Desk / HR tab bar
  'NEED ACTION': 'بحاجة إلى إجراء',
  'PENDING HR': 'بانتظار الموارد البشرية',
  'With HR': 'لدى الموارد البشرية',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  'Waiting for your decision': 'بانتظار قرارك',
  'Approved to HR, awaiting sign-off': 'تمت الموافقة وإحالتها للموارد البشرية بانتظار الاعتماد',
  'Signed off end-to-end': 'معتمد نهائيًا',
  'Rejected at the desk or by HR': 'مرفوض من المكتب أو الموارد البشرية',
  'Waiting for HR sign-off': 'بانتظار اعتماد الموارد البشرية',
  'Rejected by HR': 'رفضتها الموارد البشرية',
  '{{count}} {{label}}': '{{count}} {{label}}',
  'Loading desk…': 'جارٍ تحميل المكتب…',
  'Loading HR inbox…': 'جارٍ تحميل صندوق الموارد البشرية…',

  // Guards / empty states
  'Requests desk is for managers and HR': 'مكتب الطلبات مخصّص للمديرين والموارد البشرية',
  'Stage-1 decisions run through the team-leader / branch-manager desk; HR gives the final sign-off here.':
    'تُتخذ قرارات المرحلة الأولى عبر مكتب قائد الفريق / مدير الفرع؛ وتمنح الموارد البشرية الاعتماد النهائي هنا.',
  'HR rows appear as soon as branch managers approve requests to review.':
    'تظهر صفوف الموارد البشرية بمجرد أن يعتمد مديرو الفروع الطلبات للمراجعة.',
  'Desk rows appear as soon as team members submit requests.': 'تظهر صفوف المكتب بمجرد أن يقدّم أعضاء الفريق طلباتهم.',
  'Nothing here': 'لا يوجد شيء هنا',

  // Pagination
  'Page {{page}} of {{totalPages}} · {{total}} total': 'صفحة {{page}} من {{totalPages}} · {{total}} إجمالاً',

  // Row summaries
  '{{type}} · {{range}} · Submitted {{date}}': '{{type}} · {{range}} · قُدِّم {{date}}',
  'Gym · {{gym}}': 'الصالة · {{gym}}',
  'Gym: {{gym}}': 'الصالة: {{gym}}',
  'Payment: {{payment}}': 'الدفع: {{payment}}',
  '{{name}} — {{type}}': '{{name}} — {{type}}',

  // Decisions / toasts
  'Request #{{id}} approved.': 'تمت الموافقة على الطلب #{{id}}.',
  'Request #{{id}} rejected.': 'تم رفض الطلب #{{id}}.',
  'Request #{{id}} approved to HR review.': 'تمت الموافقة على الطلب #{{id}} وإحالته لمراجعة الموارد البشرية.',
  'Approve request #{{id}}': 'الموافقة على الطلب #{{id}}',
  'Reject request #{{id}}': 'رفض الطلب #{{id}}',
  'HR approve request #{{id}}': 'موافقة الموارد البشرية على الطلب #{{id}}',
  'HR reject request #{{id}}': 'رفض الموارد البشرية للطلب #{{id}}',
  'HR Approve': 'موافقة الموارد البشرية',
  'HR Reject': 'رفض الموارد البشرية',
  'Final HR sign-off — the employee is notified.': 'اعتماد الموارد البشرية النهائي — يُبلَّغ الموظف بذلك.',
  'Rejection of an unscheduled day keeps the punch as present with no cover day.':
    'رفض يوم غير مجدول يُبقي البصمة حاضرًا دون يوم تغطية.',
  'Rejection keeps the punch as present with no cover day.': 'الرفض يُبقي البصمة حاضرًا دون يوم تغطية.',

  // Decision modal fields
  'Submitted at': 'وقت التقديم',
  '{{date}} (submitted)': '{{date}} (مُقدَّم)',
  Payment: 'الدفع',
  'Checking salary…': 'جارٍ التحقق من الراتب…',
  'No salary on file — the cover pay cannot be priced yet.': 'لا يوجد راتب مسجّل — لا يمكن تسعير أجر التغطية بعد.',
  "This is an extra/cover-day value and does not reduce the employee's monthly day-off balance.":
    'هذه قيمة يوم إضافي/تغطية ولا تُخصم من رصيد أيام الراحة الشهرية للموظف.',
  'Reason (required for rejection)': 'السبب (مطلوب عند الرفض)',
  'Comment (optional)': 'تعليق (اختياري)',

  // Detail drawers
  'Request #{{id}}': 'الطلب #{{id}}',
  'Submitted on': 'تاريخ التقديم',
  'Requested for': 'الفترة المطلوبة',
  'Sick leave limit': 'حد الإجازة المرضية',
  'Annual leave limit': 'حد الإجازة السنوية',
  '{{used}} / {{total}} days used · {{remaining}} left':
    '{{used}} / {{total}} أيام مستخدمة · {{remaining}} متبقية',
  'Desk decision': 'قرار المكتب',
  'Desk comment': 'تعليق المكتب',
  'HR decision': 'قرار الموارد البشرية',
  'HR comment': 'تعليق الموارد البشرية',
  'No reason provided.': 'لا يوجد سبب مُدخل.',
  TIMELINE: 'المسار الزمني',
  Unavailable: 'غير متاح',

  // Attachments
  'Medical certificate': 'شهادة طبية',
  'Attached document': 'مستند مرفق',
  'Uploaded with this request': 'مرفوع مع هذا الطلب',
  '{{document}} full view': 'عرض {{document}} بالحجم الكامل',
  'Close document': 'إغلاق المستند',
  'Loading document…': 'جارٍ تحميل المستند…',
  'Preview not available': 'المعاينة غير متاحة',
  "This file type can't be displayed in the browser. Download it to open it.":
    'لا يمكن عرض هذا النوع من الملفات في المتصفح. نزّله لفتحه.',
  'No document uploaded': 'لم يتم رفع أي مستند',
  'Not allowed to open this document': 'لا يُسمح بفتح هذا المستند',
  "Couldn't load the document": 'تعذّر تحميل المستند',
  'This request is marked as having an attachment, but no file is stored for it.':
    'هذا الطلب مُعلَّم بأن له مرفقًا، لكن لا يوجد ملف محفوظ له.',
  '{{message}} Check your connection and try again.': '{{message}} تحقق من اتصالك وحاول مرة أخرى.',
  '{{message}} The server failed to return the file — try again in a moment.':
    '{{message}} فشل الخادم في إرجاع الملف — حاول مرة أخرى بعد قليل.',
}
