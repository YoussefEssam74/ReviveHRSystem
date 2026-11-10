/**
 * App shell, shared UI primitives, auth and attendance (kiosk, station code,
 * enrollment, HR attendance logs). English copy is the i18next key; this file
 * only maps it to Arabic.
 */
export const shellUi: Record<string, string> = {
  // Shared UI primitives
  Showing: 'عرض',
  results: 'نتائج',
  records: 'سجلات',
  'Dismiss notification': 'إغلاق الإشعار',

  // Attendance status vocabulary (StatusBadge / kiosk roster)
  // Late / Absent / Present / Off already live in common.ts.
  'Missing Checkout': 'بصمة خروج مفقودة',
  'On Time': 'في الوقت',
  'Early Checkout': 'انصراف مبكر',
  'Covering (Extra Shift)': 'تغطية (وردية إضافية)',
  Left: 'انصرف',
  'Not in yet': 'لم يسجّل الحضور بعد',

  // App shell
  'Station code': 'رمز المحطة',
  'Attendance & workforce management': 'إدارة الحضور والقوى العاملة',
  'Notifications ({{count}} unread)': 'الإشعارات ({{count}} غير مقروء)',

  // Sidebar badge labels
  pending: 'قيد الانتظار',
  'this month to review': 'هذا الشهر للمراجعة',
  'awaiting your decision': 'بانتظار قرارك',
  'absent today': 'غائب اليوم',
  'today to follow up': 'اليوم للمتابعة',
  '{{count}} waiting for your decision': '{{count}} بانتظار قرارك',
  '{{count}} leaving case in progress': '{{count}} حالة إنهاء خدمة قيد التنفيذ',
  '{{count}} leaving cases in progress': '{{count}} حالات إنهاء خدمة قيد التنفيذ',
  'pending vacancy requests': 'طلبات شواغر قيد الانتظار',
  'not fully scheduled yet': 'لم يُجدول بالكامل بعد',

  // Sign-in
  'Sign in to Revive HR': 'تسجيل الدخول إلى Revive HR',
  'Choose your gym': 'اختر صالتك',
  'Your account works at more than one gym. Pick where you are working today.':
    'حسابك يعمل في أكثر من صالة. اختر الصالة التي تعمل بها اليوم.',
  'Use your Revive HR account to continue to your workspace.':
    'استخدم حسابك في Revive HR للمتابعة إلى مساحة عملك.',
  'Your account is assigned to gyms that are not available. Contact your administrator.':
    'حسابك مرتبط بصالات غير متاحة. يُرجى التواصل مع المسؤول.',
  'Continue to this gym': 'المتابعة إلى هذه الصالة',
  'Use a different account': 'استخدام حساب آخر',
  'Access is managed by your HR administrator.': 'يُدار الوصول بواسطة مسؤول الموارد البشرية لديك.',
  'Show password': 'إظهار كلمة المرور',
  'Hide password': 'إخفاء كلمة المرور',
  'Email is required': 'البريد الإلكتروني مطلوب',
  'Enter a valid email address': 'أدخل بريدًا إلكترونيًا صالحًا',
  'Password is required': 'كلمة المرور مطلوبة',

  // Face enrollment
  'Face enrollment': 'تسجيل الوجه',
  "Register an employee's face for Face-ID attendance check-in.":
    'سجّل وجه الموظف لتسجيل الحضور بالتعرف على الوجه.',
  'Enroll a face': 'تسجيل وجه',
  'Enter the employee number, start the camera, then capture while they face it.':
    'أدخل رقم الموظف، وشغّل الكاميرا، ثم التقط الصورة وهو ينظر إليها.',
  'Employee number': 'رقم الموظف',
  'Employee number is required': 'رقم الموظف مطلوب',
  'Start the camera first, then capture.': 'شغّل الكاميرا أولًا ثم التقط الصورة.',
  'Camera is off': 'الكاميرا متوقفة',
  'Face enrolled': 'تم تسجيل الوجه',
  'Start camera': 'تشغيل الكاميرا',
  'Stop camera': 'إيقاف الكاميرا',
  'Capture & enroll': 'التقاط وتسجيل',

  // Station code
  'Authorize attendance kiosk': 'تفويض محطة الحضور',
  'Pair an attendance station to a gym branch with a one-time code.':
    'اقترن محطة حضور بفرع صالة باستخدام رمز لمرة واحدة.',
  'No gym assigned': 'لا توجد صالة مرتبطة',
  'Your account is not linked to a gym, so there is no station code to show.':
    'حسابك غير مرتبط بأي صالة، لذا لا يوجد رمز محطة لعرضه.',
  'this gym': 'هذه الصالة',
  'Generate a six-digit code for a gym branch. The terminal computer at the gym enters this code on the Attendance Station page, which binds it to that branch.':
    'أنشئ رمزًا مكوّنًا من ستة أرقام لفرع الصالة. يُدخل جهاز الحضور في الصالة هذا الرمز في صفحة محطة الحضور، فيرتبطه بذلك الفرع.',
  'Authorize attendance kiosk terminal': 'تفويض جهاز الحضور',
  'Generate a secure 6-digit code for a gym branch. The terminal computer at the gym will enter this code on the Attendance Station page to bind itself strictly to that gym branch.':
    'أنشئ رمزًا آمنًا مكوّنًا من 6 أرقام لفرع الصالة. سيُدخل جهاز الحضور في الصالة هذا الرمز في صفحة محطة الحضور ليرتبط حصريًا بذلك الفرع.',
  'Target gym branch': 'فرع الصالة المستهدف',
  '{{gym}} (Branch ID: {{id}})': '{{gym}} (معرّف الفرع: {{id}})',
  'Generate 6-digit pairing code': 'إنشاء رمز اقتران من 6 أرقام',
  'Generate a new station code? Any previous code stops working immediately.':
    'إنشاء رمز محطة جديد؟ سيتوقف أي رمز سابق عن العمل فورًا.',
  Expired: 'منتهي الصلاحية',
  'Valid for {{duration}}': 'صالح لمدة {{duration}}',
  '5 minutes': '5 دقائق',
  'Station code {{code}}': 'رمز المحطة {{code}}',
  Copied: 'تم النسخ',
  'Copy code': 'نسخ الرمز',
  'Open attendance station': 'فتح محطة الحضور',
  'Branch geofence security rules:': 'قواعد أمان النطاق الجغرافي للفرع:',
  'Once connected, the station only shows employees assigned to this gym.':
    'بعد الاتصال، تعرض المحطة فقط الموظفين المعيّنين لهذه الصالة.',
  'Employees from another branch are refused at the terminal.':
    'يُرفض الموظفون من فرع آخر على هذا الطرف.',
  'If the computer breaks down, generate a new code here and pair the replacement PC.':
    'إذا تعطّل الجهاز، فأنشئ رمزًا جديدًا هنا واقترن الجهاز البديل.',
  'Disconnected {{count}} station session at {{gym}}.':
    'تم فصل جلسة محطة واحدة عند {{gym}}.',
  'Disconnected {{count}} station sessions at {{gym}}.':
    'تم فصل {{count}} جلسات محطات عند {{gym}}.',
  'Disconnect every station currently enrolled with {{gym}} only? Other branches are unaffected, and these stations will have to enter a new code.':
    'فصل كل محطة مرتبطة بـ {{gym}} فقط؟ لن تتأثر الفروع الأخرى، وستحتاج هذه المحطات إلى إدخال رمز جديد.',
  'Disconnect stations at {{gym}}': 'فصل المحطات عند {{gym}}',

  // Attendance station (kiosk)
  'Attendance Station': 'محطة الحضور',
  Kiosk: 'كشك',
  'Not connected': 'غير متصل',
  Authorized: 'مُفوَّض',
  'Awaiting code': 'بانتظار الرمز',
  'Unknown gym': 'صالة غير معروفة',
  'Restoring station session...': 'جارٍ استعادة جلسة المحطة...',
  'The station session ended. Enter a fresh code to reconnect.':
    'انتهت جلسة المحطة. أدخل رمزًا جديدًا لإعادة الاتصال.',
  'Station session ended': 'انتهت جلسة المحطة',
  'employees present now': 'الموظفون الحاضرون الآن',
  'of scheduled today': 'من المجدولين اليوم',
  'Gym staff & roster': 'موظفو الصالة وقائمة المناوبين',
  'Disconnect this station': 'فصل هذه المحطة',
  Disconnect: 'فصل',
  "Loading today's roster...": 'جارٍ تحميل قائمة اليوم...',
  'No staff scheduled at this gym today.': 'لا يوجد موظفون مجدولون في هذه الصالة اليوم.',
  'Terminal offline - enter the HR enrollment code to connect':
    'الطرف غير متصل - أدخل رمز التسجيل من الموارد البشرية للاتصال',
  'Connect Attendance Station': 'ربط محطة الحضور',
  'Generate a 6-digit code in the': 'أنشئ رمزًا مكوّنًا من 6 أرقام في',
  'Revive HR portal': 'بوابة Revive HR',
  ', enter it below, and this terminal locks to that gym branch. The code expires 5 minutes after generation.':
    '، ثم أدخله أدناه، وسيُربط هذا الطرف بذلك الفرع. تنتهي صلاحية الرمز بعد 5 دقائق من إنشائه.',
  'Enter 6-digit code': 'أدخل الرمز المكوّن من 6 أرقام',
  'Connect & lock to gym': 'الاتصال والربط بالصالة',
  '1. HR generates code': '1. الموارد البشرية تُنشئ الرمز',
  'HR opens the portal, selects the branch, and generates a code.':
    'تفتح الموارد البشرية البوابة، وتختار الفرع، وتُنشئ رمزًا.',
  '2. Terminal enters code': '2. الطرف يُدخل الرمز',
  'This station redeems the code once for a gym-bound session.':
    'تستخدم هذه المحطة الرمز مرة واحدة للحصول على جلسة مرتبطة بالصالة.',
  '3. Locked to branch': '3. الربط بالفرع',
  'Only staff assigned to this gym can check in at this terminal.':
    'لا يمكن تسجيل الحضور على هذا الطرف إلا لموظفي هذه الصالة.',

  // Face scanner (viewfinder + hook status)
  'Starting camera': 'جارٍ تشغيل الكاميرا',
  'Starting camera...': 'جارٍ تشغيل الكاميرا...',
  'Looking for a face': 'جارٍ البحث عن وجه',
  'Stand in front of the camera': 'قف أمام الكاميرا',
  Recognized: 'تم التعرف',
  'Face detected': 'تم اكتشاف وجه',
  'Anti-spoofing and face identification run continuously':
    'يعمل فحص التزييف والتعرف على الوجه باستمرار',
  'YuNet detection - Silent-Face anti-spoofing - SFace 1-to-N':
    'كشف YuNet - مكافحة التزييف Silent-Face - مطابقة SFace 1 إلى N',
  'Liveness clears the attendance gate': 'درجة الحيوية تتجاوز حد التسجيل',
  'Liveness below the attendance gate': 'درجة الحيوية أقل من حد التسجيل',
  'Toggle sound alerts': 'تبديل تنبيهات الصوت',
  'Audio: ON': 'الصوت: مفعّل',
  'Audio: OFF': 'الصوت: متوقف',
  'Automatically record attendance when a face is recognized':
    'تسجيل الحضور تلقائيًا عند التعرف على الوجه',
  'Auto-scan: ON': 'المسح التلقائي: مفعّل',
  'Auto-scan: OFF': 'المسح التلقائي: متوقف',
  'LIVE VISION ACTIVE': 'الرؤية المباشرة تعمل',
  'Camera unavailable': 'الكاميرا غير متاحة',
  'Try camera again': 'إعادة محاولة الكاميرا',
  'Scan now': 'امسح الآن',
  STARTING: 'جارٍ البدء',
  SCANNING: 'جارٍ المسح',
  MATCHED: 'مطابق',
  IDLE: 'متوقف',
  'Thanks — you are recorded. Please step away.': 'شكرًا — تم تسجيلك. يُرجى الابتعاد.',
  'Attendance rejected.': 'تم رفض الحضور.',
  'Server busy - retrying': 'الخادم مشغول - إعادة المحاولة',
  'Connection problem - retrying': 'مشكلة في الاتصال - إعادة المحاولة',

  // Attendance result cards
  'Attendance recorded': 'تم تسجيل الحضور',
  'Attendance rejected': 'تم رفض الحضور',
  'Check-in recorded': 'تم تسجيل الحضور',
  'Check-out recorded': 'تم تسجيل الانصراف',
  Employee: 'الموظف',
  'Face match': 'مطابقة الوجه',
  Record: 'السجل',
  'Unscheduled / off day': 'غير مجدول / يوم راحة',
  'No shift was scheduled for today — a request was sent to the branch manager and HR for cover/extra-day approval (1 or 2 days).':
    'لم تُجدول وردية لهذا اليوم — أُرسل طلب إلى مدير الفرع والموارد البشرية للموافقة على تغطية/يوم إضافي (يوم أو يومان).',
  '{{similarity}}% - liveness {{liveness}}%': '{{similarity}}% - حيوية {{liveness}}%',
  Dismiss: 'إغلاق',
  'Confirm check-out': 'تأكيد الانصراف',
  'Check out now?': 'تسجيل الانصراف الآن؟',
  'This employee': 'هذا الموظف',
  'You are checked in for today. Confirming records your check-out with the current time.':
    'حضورك مسجّل اليوم. التأكيد يسجّل انصرافك بالوقت الحالي.',
  'Check out now': 'تسجيل الانصراف الآن',
  'Not yet': 'ليس الآن',
  'Check in': 'تسجيل الحضور',
  'Check out': 'تسجيل الانصراف',

  // Kiosk roster
  manual: 'يدوي',
  Shift: 'الوردية',
  In: 'دخول',
  Out: 'خروج',
  'Late {{minutes}}m': 'تأخير {{minutes}} د',
  'Left early {{minutes}}m': 'انصراف مبكر {{minutes}} د',

  // HR attendance logs
  'Daily records for {{gym}}': 'السجلات اليومية لـ {{gym}}',
  'Attendance logs': 'سجلات الحضور',
  'Filter by status': 'التصفية حسب الحالة',
  'All statuses': 'كل الحالات',
  'Pair kiosk': 'اقتران الكشك',
  'Loading attendance…': 'جارٍ تحميل الحضور…',
  'No records': 'لا توجد سجلات',
  'No attendance was recorded for this day.': 'لم يُسجَّل أي حضور في هذا اليوم.',
  Source: 'المصدر',
  Action: 'الإجراء',
  Corrected: 'مُصحّح',
  Correct: 'تصحيح',
  'Correct record': 'تصحيح السجل',
  'Save correction': 'حفظ التصحيح',
  'Reason (required)': 'السبب (مطلوب)',
  'Why is this record being corrected?': 'لماذا يُصحّح هذا السجل؟',
}
