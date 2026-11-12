/**
 * Team / Branch Schedule page: roster grid, paint palette, "Create New
 * Schedule" modal and the shift-template manager. Keys that the shared
 * dictionaries (common / shell / portal / gaps) already translate are reused
 * from there and intentionally not repeated here.
 */
export const teamSchedule: Record<string, string> = {
  // Weekday names (grid headers, day-fill tooltips, conflict rows).
  // Short names (Sun…Sat) already live in workflows.ts.
  Monday: 'الاثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
  Saturday: 'السبت',
  Sunday: 'الأحد',

  // Toolbar / roster grid
  '{{count}} weekday not assigned': '{{count}} يوم غير مُسنَد',
  '{{count}} weekdays not assigned': '{{count}} أيام غير مُسنَدة',
  '{{count}} weekday not assigned yet': '{{count}} يوم غير مُسنَد بعد',
  '{{count}} weekdays not assigned yet': '{{count}} أيام غير مُسنَدة بعد',
  '{{count}} not assigned': '{{count}} غير مُسنَدة',
  // Column header: weekdays still without a shift (not the attendance "Missing" status).
  Missing: 'الناقص',
  Complete: 'مكتمل',
  'Every weekday is assigned or marked Off': 'كل يوم مُسنَد أو مُسجَّل كراحة',
  'not assigned': 'غير مُسنَد',
  off: 'راحة',
  shift: 'وردية',
  'Weekdays this employee has not been assigned yet': 'أيام الأسبوع التي لم يُسنَد لها هذا الموظف بعد',
  'Apply the selected shift to everyone on {{weekday}} {{date}}': 'تطبيق الوردية المحددة على الجميع يوم {{weekday}} {{date}}',
  'Fill the visible days for this employee': 'تعبئة الأيام الظاهرة لهذا الموظف',
  'Fill the visible days for {{name}}': 'تعبئة الأيام الظاهرة لـ {{name}}',
  '{{name}}, {{weekday}} {{date}}: {{status}}': '{{name}}، {{weekday}} {{date}}: {{status}}',
  'Tap a day to paint the selected shift.': 'اضغط على يوم لتلوين الوردية المحددة.',
  'Read-only preview — press “Assign Shifts” to edit.': 'معاينة للقراءة فقط — اضغط «إسناد الورديات» للتعديل.',
  'This row is your own employee record — a Branch Manager is staff of their branch too.':
    'هذا الصف هو سجل موظفك الخاص — مدير الفرع أيضًا من موظفي فرعه.',
  You: 'أنت',
  'You (Branch Manager)': 'أنت (مدير فرع)',

  // Create schedule modal
  'Create Schedule': 'إنشاء جدول',
  'Choose a date range within the month. A draft cycle is created and shifts can be assigned right away.':
    'اختر نطاقًا زمنيًا داخل الشهر. تُنشأ دورة مسودة ويمكن إسناد الورديات فورًا.',
  'Start Date': 'تاريخ البداية',
  'End Date': 'تاريخ النهاية',
  'Start date must be on or before the end date.': 'يجب أن يكون تاريخ البداية في تاريخ النهاية أو قبله.',
  'A schedule already covers these dates ({{schedules}}). Delete it from the period strip first, or pick a different range.':
    'يوجد جدول يغطي هذه التواريخ بالفعل ({{schedules}}). احذفه من شريط الفترات أولًا، أو اختر نطاقًا مختلفًا.',
  'Ranges longer than a week open in a 7-day view where every shift repeats on the same weekday of the following weeks — the “Show 30 days” button reveals the full range. A cycle already covering these dates will be rejected by the server.':
    'النطاقات الأطول من أسبوع تُفتح في عرض 7 أيام تتكرر فيه كل وردية في نفس يوم الأسبوع من الأسابيع التالية — زر «عرض 30 يومًا» يكشف النطاق الكامل. وأي دورة تغطي هذه التواريخ بالفعل سيرفضها الخادم.',

  // Shift template manager
  'Shift Templates': 'قوالب الورديات',
  'Edit Shift Template — {{name}}': 'تعديل قالب الوردية — {{name}}',
  'Templates appear in the paint palette and the schedule legend; pick a color so each shift is easy to tell apart.':
    'تظهر القوالب في لوحة التلوين ومفتاح الجدول؛ اختر لونًا ليسهل تمييز كل وردية.',
  'Editing template': 'تعديل القالب',
  'Create new template': 'إنشاء قالب جديد',
  'Template Name': 'اسم القالب',
  'e.g. Early Morning, Split, Part-time': 'مثال: صباحي مبكر، مقسّم، دوام جزئي',
  'Start Time': 'وقت البداية',
  'End Time': 'وقت النهاية',
  'Shift Color': 'لون الوردية',
  'Use color {{color}}': 'استخدام اللون {{color}}',
  'Pick a custom color': 'اختر لونًا مخصصًا',
  'Duration: {{duration}}': 'المدة: {{duration}}',
  'set start and end times': 'حدّد وقتَي البداية والنهاية',
  '{{count}} hours': '{{count}} ساعة',
  '— overnight shift, ends the next day.': '— وردية ليلية تنتهي في اليوم التالي.',
  '— start and end times must differ.': '— يجب أن يختلف وقت البداية عن وقت النهاية.',
  'Cancel edit': 'إلغاء التعديل',
  'Save Changes': 'حفظ التغييرات',
  'Create Template': 'إنشاء قالب',
  'Existing templates': 'القوالب الحالية',
  'No templates yet — create the first one above.': 'لا توجد قوالب بعد — أنشئ الأول أعلاه.',
  '(+1 day)': '(+ يوم واحد)',
  'Delete Shift Template': 'حذف قالب الوردية',
  'Delete this template? Schedule cells that reference it flip to OFF. This cannot be undone.':
    'حذف هذا القالب؟ ستتحول خلايا الجدول التي تشير إليه إلى OFF. لا يمكن التراجع عن ذلك.',
  'Delete Template': 'حذف القالب',
  'Template “{{name}}” created — it is in the paint palette now.':
    'تم إنشاء القالب «{{name}}» — وهو الآن في لوحة التلوين.',
  'Template “{{name}}” updated.': 'تم تحديث القالب «{{name}}».',
  'Template deleted — cells that used it now show OFF.': 'تم حذف القالب — الخلايا التي كانت تستخدمه تظهر الآن OFF.',

  // Compact meridiem markers in the mobile grid ("7a–3p")
  AM: 'ص',
  PM: 'م',
}
