export const stageMeta = {
  waiting: { label: 'בהמתנה', color: '#7B8497', soft: '#f0f1f3' }, mobilization: { label: 'בהנעה', color: '#6D4DE3', soft: '#eeeaff' },
  infrastructure: { label: 'תשתיות', color: '#D18B24', soft: '#fff3de' }, threading: { label: 'השחלות', color: '#E05A33', soft: '#fff0df' },
  threading_done: { label: 'בוצעו השחלות', color: '#A93BB8', soft: '#f0ebff' },
  installation_a: { label: 'התקנות שלב א׳', color: '#3676E0', soft: '#e7f3ff' }, installation_b: { label: 'התקנות שלב ב׳', color: '#00A0B5', soft: '#e3f0fc' },
  installation_c: { label: 'התקנות שלב ג׳', color: '#0E7C66', soft: '#e0edf8' }, activation_programming: { label: 'הפעלות ותכנות', color: '#18A558', soft: '#dcf8f3' },
  finishes: { label: 'פינישים', color: '#D33F75', soft: '#ffe8f0' }, post_delivery: { label: 'מוכן למסירה', color: '#2F855A', soft: '#e2f7ed' },
};

export const seedProjects = [
  {
    id: 'PRJ-1048', name: 'וילה משפחת כהן', client: 'עדי ויונתן כהן', location: 'קיסריה',
    address: 'רחוב האקוודוקט 18, קיסריה', lat: 32.506, lng: 34.905, stage: 'installation',
    progress: 68, manager: 'רונן לוי', ownerInitials: 'רל', value: 385000, paid: 268000,
    due: '18.08.2026', priority: 'high', flag: 'ממתין לחשמלאי', systems: ['KNX', 'Lutron', 'CCTV', 'Audio'],
    nextMilestone: 'התקנת לוחות ובקרים', phone: '052-846-1093', email: 'adi@cohen-home.co.il',
    health: 76, tasksDone: 34, tasksTotal: 48,
  },
  {
    id: 'PRJ-1043', name: 'פנטהאוז משפחת ברק', client: 'מיכל ברק', location: 'תל אביב',
    address: 'פארק צמרת 7, תל אביב', lat: 32.095, lng: 34.796, stage: 'programming',
    progress: 82, manager: 'דניאל גולן', ownerInitials: 'דג', value: 268000, paid: 214000,
    due: '22.08.2026', priority: 'normal', flag: '', systems: ['Control4', 'Lutron', 'Audio'],
    nextMilestone: 'תרחישים ובדיקות משתמש', phone: '054-991-6421', email: 'michal.barak@email.com',
    health: 92, tasksDone: 41, tasksTotal: 50,
  },
  {
    id: 'PRJ-1039', name: 'בית משפחת אלון', client: 'נועה וטל אלון', location: 'הרצליה',
    address: 'הגלים 12, הרצליה פיתוח', lat: 32.176, lng: 34.806, stage: 'infrastructure',
    progress: 41, manager: 'רונן לוי', ownerInitials: 'רל', value: 312000, paid: 124800,
    due: '03.09.2026', priority: 'high', flag: 'חריגה בלו״ז', systems: ['KNX', 'Network', 'Intercom'],
    nextMilestone: 'אישור תוכנית נקודות', phone: '050-771-2288', email: 'tal@alon.co.il',
    health: 58, tasksDone: 19, tasksTotal: 46,
  },
  {
    id: 'PRJ-1052', name: 'משרדי NOVA', client: 'NOVA Labs בע״מ', location: 'פתח תקווה',
    address: 'שחם 8, פתח תקווה', lat: 32.092, lng: 34.859, stage: 'planning',
    progress: 24, manager: 'דניאל גולן', ownerInitials: 'דג', value: 198000, paid: 39600,
    due: '15.10.2026', priority: 'normal', flag: '', systems: ['Crestron', 'Access', 'Network'],
    nextMilestone: 'ישיבת תכנון עם האדריכלית', phone: '03-918-4432', email: 'office@nova-labs.co.il',
    health: 88, tasksDone: 8, tasksTotal: 33,
  },
  {
    id: 'PRJ-1027', name: 'וילה משפחת רז', client: 'איתי רז', location: 'רמת השרון',
    address: 'החורש 4, רמת השרון', lat: 32.143, lng: 34.835, stage: 'handover',
    progress: 94, manager: 'אורי קדם', ownerInitials: 'אק', value: 425000, paid: 340000,
    due: '14.08.2026', priority: 'high', flag: 'תשלום באיחור', systems: ['KNX', 'Home Assistant', 'CCTV', 'Audio'],
    nextMilestone: 'מסירה והדרכת לקוח', phone: '052-337-9001', email: 'itay@raz.co.il',
    health: 71, tasksDone: 61, tasksTotal: 65,
  },
  {
    id: 'PRJ-1016', name: 'דירת משפחת לביא', client: 'שירה לביא', location: 'גבעתיים',
    address: 'בורוכוב 21, גבעתיים', lat: 32.071, lng: 34.812, stage: 'completed',
    progress: 100, manager: 'אורי קדם', ownerInitials: 'אק', value: 146000, paid: 146000,
    due: '02.08.2026', priority: 'normal', flag: '', systems: ['Control4', 'Network'],
    nextMilestone: 'ביקורת אחריות בעוד 3 חודשים', phone: '054-223-1090', email: 'shira.lavi@email.com',
    health: 100, tasksDone: 38, tasksTotal: 38,
  },
];

export const clients = [
  { name: 'עדי ויונתן כהן', type: 'לקוח פרטי', projects: 1, total: 385000, contact: 'עדי כהן', phone: '052-846-1093', city: 'קיסריה' },
  { name: 'מיכל ברק', type: 'לקוח פרטי', projects: 1, total: 268000, contact: 'מיכל ברק', phone: '054-991-6421', city: 'תל אביב' },
  { name: 'NOVA Labs בע״מ', type: 'לקוח עסקי', projects: 2, total: 328000, contact: 'אלון שחר', phone: '03-918-4432', city: 'פתח תקווה' },
  { name: 'נועה וטל אלון', type: 'לקוח פרטי', projects: 1, total: 312000, contact: 'טל אלון', phone: '050-771-2288', city: 'הרצליה' },
  { name: 'איתי רז', type: 'לקוח פרטי', projects: 1, total: 425000, contact: 'איתי רז', phone: '052-337-9001', city: 'רמת השרון' },
];

export const activity = [
  { initials: 'דג', color: '#e8e4ff', text: 'דניאל עדכן את שלב הפרויקט', subject: 'פנטהאוז משפחת ברק', time: 'לפני 18 דקות' },
  { initials: 'רל', color: '#dff7f1', text: 'רונן העלה תוכנית חשמל מעודכנת', subject: 'בית משפחת אלון', time: 'לפני 42 דקות' },
  { initials: 'כס', color: '#ffedd5', text: 'נקלט תשלום על סך ₪38,500', subject: 'וילה משפחת כהן', time: 'לפני שעה' },
  { initials: 'אק', color: '#e4f0ff', text: 'אורי השלים בדיקת מסירה', subject: 'וילה משפחת רז', time: 'לפני שעתיים' },
];

export const milestones = [
  { title: 'התקנת לוחות ובקרים', project: 'וילה משפחת כהן', date: '14 באוג׳', state: 'today' },
  { title: 'מסירה והדרכת לקוח', project: 'וילה משפחת רז', date: '16 באוג׳', state: 'soon' },
  { title: 'אישור תוכנית נקודות', project: 'בית משפחת אלון', date: '18 באוג׳', state: 'risk' },
  { title: 'ישיבת תכנון אדריכלית', project: 'משרדי NOVA', date: '21 באוג׳', state: 'soon' },
];
