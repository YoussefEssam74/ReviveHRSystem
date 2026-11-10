/**
 * Branch Actions palette + its raise-action modals (deduction, warning, bonus,
 * report, quick vacancy request). Keys are the English source copy.
 */
export const branchActions: Record<string, string> = {
  // Palette
  'Everything you can do for the active gym — raise actions go to HR.':
    'كل ما يمكنك فعله للصالة النشطة — الإجراءات المرفوعة تُحال إلى الموارد البشرية.',
  'Awaiting HR ({{count}})': 'بانتظار الموارد البشرية ({{count}})',
  'Issue Deduction': 'إصدار خصم',
  'Deduct an amount (absence, late, damage) — sent to HR for approval':
    'خصم مبلغ (غياب، تأخير، تلف) — يُحال إلى الموارد البشرية للاعتماد',
  'Issue Warning Notice': 'إصدار إنذار',
  'Formal written warning — HR files it to the employee record':
    'إنذار رسمي مكتوب — تُدرجه الموارد البشرية في سجل الموظف',
  'Propose Bonus': 'اقتراح مكافأة',
  'Recommend a bonus/overtime payout — HR adds it to payroll':
    'توصية بصرف مكافأة/أجر إضافي — تضيفها الموارد البشرية إلى الرواتب',
  'Review Team Requests': 'مراجعة طلبات الفريق',
  'Stage-1 approve/reject — HR gives the final decision':
    'موافقة/رفض المرحلة الأولى — القرار النهائي للموارد البشرية',
  'Correct Attendance': 'تصحيح الحضور',
  'Fix missing check-ins/outs and flag absences': 'معالجة الحضور/الانصراف المفقود وتسجيل الغياب',
  'Request Vacancy': 'طلب وظيفة شاغرة',
  'Ask HR to open a new position for the gym': 'اطلب من الموارد البشرية فتح منصب جديد للصالة',
  'Publish Shift Schedule': 'نشر جدول الورديات',
  'Assign shifts for the next cycle and publish': 'تعيين الورديات للدورة القادمة ونشرها',
  'Change Employment Status': 'تغيير حالة العمل',
  'Active / On Leave / Suspended / Terminated — on an employee profile':
    'نشط / في إجازة / موقوف / منتهي الخدمة — من ملف الموظف',
  'Offboard Employee': 'إنهاء خدمة موظف',
  'Start the leaving flow for a branch employee': 'بدء إجراءات ترك العمل لموظف في الفرع',
  'Send Report to HR': 'إرسال تقرير إلى الموارد البشرية',
  'Monthly branch summary: attendance, requests, incidents': 'ملخص شهري للفرع: الحضور والطلبات والحوادث',

  // Shared vocabulary (labels are translated at render; the codes stay English)
  'Unapproved absence': 'غياب غير معتمد',
  'Late arrival (30+ min)': 'تأخر في الحضور (أكثر من 30 دقيقة)',
  'Early checkout without approval': 'انصراف مبكر دون موافقة',
  'Damaged equipment / property': 'تلف معدات / ممتلكات',
  'Policy violation': 'مخالفة السياسات',
  'Other (see note)': 'أخرى (راجع الملاحظة)',
  Conduct: 'السلوك',
  Performance: 'الأداء',
  Safety: 'السلامة',
  'Performance Bonus': 'مكافأة أداء',
  'Overtime Pay': 'أجر إضافي',
  'Attendance Reward': 'مكافأة حضور',
  'Referral Bonus': 'مكافأة ترشيح',
  Other: 'أخرى',
  'Monthly branch summary': 'ملخص شهري للفرع',
  'Attendance exceptions': 'استثناءات الحضور',
  'Incident report': 'تقرير حادث',
  'Request escalations': 'تصعيدات الطلبات',

  // Shared modal copy
  'Send to HR': 'إرسال إلى الموارد البشرية',
  'Select an employee': 'اختر موظفاً',
  'Enter a valid amount': 'أدخل مبلغاً صالحاً',
  'Pending HR': 'بانتظار الموارد البشرية',
  'with status': 'بالحالة',

  // Issue Deduction
  'Issue Deduction → Send to HR': 'إصدار خصم ← إرسال إلى الموارد البشرية',
  'Deduction of {{amount}} for {{employee}} sent to HR for approval':
    'أُرسل خصم بقيمة {{amount}} للموظف {{employee}} إلى الموارد البشرية للاعتماد',
  'The deduction is created as a': 'يُنشأ الخصم بصفته',
  'Deduction Candidate': 'مرشّح خصم',
  "HR reviews and approves it before it appears in payroll or on the employee's payslip.":
    'تراجعه الموارد البشرية وتعتمده قبل أن يظهر في مسيّر الرواتب أو في قسيمة راتب الموظف.',
  'One deduction per employee per day. A rejected day cannot be re-issued.':
    'خصم واحد لكل موظف في اليوم. لا يمكن إعادة إصدار خصم ليوم مرفوض.',
  'e.g. 150': 'مثال: 150',
  'Suggested: 1 day ≈ {{amount}} (based on basic salary).':
    'المقترح: يوم واحد ≈ {{amount}} (على أساس الراتب الأساسي).',
  'Use suggested': 'استخدام المقترح',
  'Note for HR (optional)': 'ملاحظة للموارد البشرية (اختياري)',
  'Context that helps HR review it faster...': 'سياق يساعد الموارد البشرية على المراجعة بسرعة...',
  '"Other" requires the note for HR to understand the case.':
    'تتطلب "أخرى" كتابة الملاحظة لتتمكن الموارد البشرية من فهم الحالة.',

  // Issue Warning
  'Issue Warning Notice → Send to HR': 'إصدار إنذار ← إرسال إلى الموارد البشرية',
  'Warning notice for {{employee}} sent to HR for review':
    'أُرسل إنذار للموظف {{employee}} إلى الموارد البشرية للمراجعة',
  'Enter a reason for the warning': 'أدخل سبب الإنذار',
  'The notice is saved with status': 'يُحفظ الإنذار بالحالة',
  "HR reviews it and files it to the employee's record — disciplinary action is HR-owned, the Branch Manager only proposes it.":
    'تراجعه الموارد البشرية وتُدرجه في سجل الموظف — الإجراء التأديبي من اختصاص الموارد البشرية، ومدير الفرع يقترحه فقط.',
  'What was said to the employee': 'ما قيل للموظف',
  'e.g. 3rd late arrival within one month': 'مثال: ثالث تأخر خلال شهر واحد',
  'e.g. Verbal warning issued on site; agreed on 08:00 start':
    'مثال: صدر تنبيه شفهي في الموقع؛ وتم الاتفاق على بدء العمل الساعة 08:00',
  'The employee does': 'الموظف',
  not: 'لا',
  'see this until HR approves and files it.': 'يرى هذا حتى تعتمده الموارد البشرية وتُدرجه.',

  // Propose Bonus
  'Propose Bonus → Send to HR': 'اقتراح مكافأة ← إرسال إلى الموارد البشرية',
  'Bonus proposal of {{amount}} for {{employee}} sent to HR':
    'أُرسل اقتراح مكافأة بقيمة {{amount}} للموظف {{employee}} إلى الموارد البشرية',
  'Add a justification for HR': 'أضف مبرراً للموارد البشرية',
  'HR owns payroll edits': 'تعديلات الرواتب من صلاحية الموارد البشرية',
  'your proposal lands as': 'يصل اقتراحك بحالة',
  'and is only added to the payroll run once HR approves it.':
    'ولا يُضاف إلى مسيّر الرواتب إلا بعد اعتماد الموارد البشرية له.',
  Justification: 'المبرر',
  'Why does this employee deserve it?': 'لماذا يستحق هذا الموظف هذه المكافأة؟',
  'e.g. 500': 'مثال: 500',
  'Supporting note (optional)': 'ملاحظة داعمة (اختياري)',
  'Numbers that back it up — revenue, coverage, KPIs...':
    'أرقام تدعم الطلب — الإيرادات والتغطية ومؤشرات الأداء...',

  // Send Report
  'Report sent to HR': 'أُرسل التقرير إلى الموارد البشرية',
  'Add the report message': 'أضف نص التقرير',
  'Report period': 'فترة التقرير',
  'Report type': 'نوع التقرير',
  'Anything HR should know...': 'أي شيء يجب أن تعرفه الموارد البشرية...',

  // Quick vacancy request
  '{{position}} request submitted · awaiting HR': 'تم تقديم طلب {{position}} · بانتظار الموارد البشرية',
  'Tell HR exactly what you need — shift and expected salary drive the match.':
    'أخبر الموارد البشرية بما تحتاجه بالضبط — الوردية والراتب المتوقع هما أساس المطابقة.',
  'Position is required': 'المنصب مطلوب',
  'Add the reason for the request': 'أضف سبب الطلب',
  'Expected salary (EGP)': 'الراتب المتوقع (ج.م)',
}
