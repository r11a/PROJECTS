import { test, expect } from '@playwright/test';

// Route fixtures must remain owned by Playwright, including after navigation.
// The real add-on critical paths retain the production service worker.
test.use({serviceWorkers:'block'});

// Isolated UI fixtures: these tests never write to a real project or account.
const projects = [
  {id:'PRJ-101',name:'וילה בקיסריה',client:'משפחת כהן',location:'קיסריה',stage:'installation_a',progress:68,manager:'רונן',ownerInitials:'רל',value:385000,paid:268000,health:76,tasksDone:34,tasksTotal:48,systems:['KNX','Audio'],flag:'ממתין לחשמלאי',nextMilestone:'התקנת לוחות ובקרים',priority:'high'},
  {id:'PRJ-102',name:'פנטהאוז בתל אביב',client:'משפחת ברק',location:'תל אביב',stage:'activation_programming',progress:82,manager:'דניאל',ownerInitials:'דג',value:268000,paid:214000,health:92,tasksDone:41,tasksTotal:50,systems:['Control4'],flag:'',nextMilestone:'בדיקות משתמש',priority:'normal'},
  {id:'PRJ-103',name:'בית בהרצליה',client:'משפחת אלון',location:'הרצליה',stage:'infrastructure',progress:41,manager:'רונן',ownerInitials:'רל',value:312000,paid:124800,health:64,tasksDone:20,tasksTotal:49,systems:['KNX'],flag:'',nextMilestone:'סיום התשתיות',priority:'normal'},
];
const task = {id:41,version:3,title:'תיאום התקנה ובדיקת ציוד',project_id:'PRJ-101',project_name:'וילה בקיסריה',status:'open',priority:'high',critical:true,start_date:'2026-09-08',due_date:'2026-09-09',assignees:[],relevance:'manager',duration_hours:2};

async function mockApi(page, {theme='light', failReference=false, conflict=false}={}) {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split('/api')[1];
    if(path==='/live') return route.fulfill({contentType:'text/event-stream',body:': connected\n\n'});
    if(path==='/equipment-catalog' && failReference) return route.fulfill({status:500,json:{error:'Unavailable'}});
    if(path==='/operations/tasks/41' && request.method()==='PATCH') {
      expect(request.postDataJSON().expectedVersion).toBe(3);
      return route.fulfill(conflict ? {status:409,json:{code:'EDIT_CONFLICT',error:'המשימה עודכנה על ידי משתמש אחר'}} : {json:{task:{...task,version:4}}});
    }
    const data = {
      '/auth/me':{user:{id:1,username:'ronen',displayName:'רונן',role:'admin',appearanceTheme:theme,financeAccess:true}},
      '/projects':{projects}, '/settings':{company:{name:'STUDIO SMART'},settings:{},catalogs:[],customFields:[]},
      '/team':{users:[]}, '/clients':{clients:[]}, '/professionals':{professionals:[]}, '/equipment-catalog':{items:[]}, '/project-templates':{templates:[]},
      '/operations/tasks/count':{count:8}, '/messages':{messages:[],unread:0},
      '/ai/insights':{alerts:[{key:'test-alert',title:'בדיקת חריגה',projectId:'PRJ-101'}],stats:{overdue:3,open:8},insights:[]},
      '/risk-center':{projects:[]}, '/my-work':{sections:{overdue:[],today:[task],upcoming:[]},stats:{total:1,today:1,overdue:0},messages:[],attention:[],followUps:[]},
      '/saved-views':{views:[]}, '/operations/tasks':{tasks:[task]}, '/operations/milestones':{milestones:[]},
      '/projects/PRJ-101/workspace':{tasks:[task],milestones:[],payments:[],team:[],equipment:[],forms:[],files:[],updates:[],activity:[],reviews:[],meetings:[],timeEntries:[],priorityOrders:[],systemColumns:[],systemFieldSettings:[]},
      '/projects/PRJ-101/bom':{items:[]}, '/mention-users':{users:[]},
    };
    return route.fulfill({json:data[path] || {items:[],users:[],projects:[],tasks:[],records:[]}});
  });
}

for(const theme of ['light','dark']) {
  test(`dashboard and personal workspace render on desktop and mobile in ${theme}`, async ({page}, testInfo) => {
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await mockApi(page,{theme});
    await page.setViewportSize({width:1440,height:1100});
    await page.goto('/');
    await expect(page.locator('.command-overview')).toBeVisible();
    await expect(page.locator('.alert-backdrop')).toHaveCount(0);
    await expect(page.locator('.welcome-accent')).toHaveText('תמונה אחת ברורה.');
    await page.screenshot({path:testInfo.outputPath(`dashboard-${theme}.png`),fullPage:true});
    await page.locator('.command-card').first().click();
    await expect(page.locator('.next-action-card')).toBeVisible();
    await expect(page).toHaveURL(/page=my-work/);
    await page.screenshot({path:testInfo.outputPath(`my-work-${theme}.png`),fullPage:true});
    await page.goBack(); await expect(page.locator('.command-overview')).toBeVisible();
    await page.goForward(); await expect(page.locator('.next-action-card')).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    await expect.poll(() => page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().left >= window.innerWidth)).toBeTruthy();
    await page.screenshot({path:testInfo.outputPath(`mobile-${theme}.png`),fullPage:true,animations:'disabled'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.setViewportSize({width:1440,height:1100});
    await page.goto('/?page=project&project=PRJ-101');
    await expect(page.locator('.project-breadcrumb')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({path:testInfo.outputPath(`project-${theme}.png`),fullPage:true,animations:'disabled'});
    await page.locator('.detail-tabs button').filter({hasText:'שעות עבודה'}).click();
    await expect(page).toHaveURL(/tab=hours/);
    await page.reload();
    await expect(page.locator('.detail-tabs button.active')).toHaveText('שעות עבודה');
    expect(errors).toEqual([]);
  });
}

test('reference failure is isolated, and failed edits retain the form and keyboard focus', async ({page}) => {
  await mockApi(page,{failReference:true,conflict:true});
  await page.goto('/?page=my-work');
  await expect(page.locator('.reference-warning')).toBeVisible();
  await page.locator('.next-action-card button').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const title=dialog.locator('input').first();
  await title.fill('טיוטה שצריכה להישמר');
  await dialog.locator('button[type=submit]').click();
  await expect(dialog).toBeVisible();
  await expect(title).toHaveValue('טיוטה שצריכה להישמר');
  for(let i=0;i<30;i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.next-action-card button')).toBeFocused();
});


test('Hebrew dates, visible mobile attachments and review save close the form',async({page},testInfo)=>{
  await mockApi(page);
  await page.route('**/api/projects/PRJ-101/site-reviews',route=>{expect(route.request().postDataJSON().planUpdateRequired).toBe(true);return route.fulfill({json:{review:{id:77}}});});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?page=project&project=PRJ-101&tab=reviews');
  await page.getByRole('button',{name:'ביקורת',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await dialog.locator('textarea[name=summary]').fill('נדרש שינוי תכנית לאחר ביקורת');
  await dialog.locator('input[name=planUpdateRequired]').check();
  await dialog.getByRole('button',{name:'פתיחת לוח תאריכים'}).click();
  const calendar=page.getByRole('dialog',{name:'בחירת תאריך'});
  await expect(calendar.getByText('ראשון',{exact:true})).toBeVisible();
  await calendar.getByRole('combobox',{name:'חודש',exact:true}).selectOption('8');
  await calendar.getByRole('combobox',{name:'שנה',exact:true}).selectOption('2026');
  await calendar.getByRole('button',{name:'15/09/2026',exact:true}).click();
  await expect(dialog.locator('input[type=text]').first()).toHaveValue('15/09/2026');
  await expect(dialog.locator('input[name=reviewDate]')).toHaveValue('2026-09-15');
  const file=dialog.locator('input[type=file][name=attachments]');await file.scrollIntoViewIfNeeded();
  expect(await file.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('review-mobile.png')});
  await dialog.getByRole('button',{name:'שמירת ביקורת',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'פגישה',exact:true}).click();
  dialog=page.getByRole('dialog');
  const meetingFile=dialog.locator('input[name=attachments]');await meetingFile.scrollIntoViewIfNeeded();
  expect(await meetingFile.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('meeting-mobile.png')});
});

test('meeting mail draft includes edited Hebrew text and selected recipients without waiting for audit',async({page})=>{
  await mockApi(page);
  await page.route('**/api/projects/PRJ-101/email-recipients',route=>route.fulfill({json:{recipients:[{id:'contact-1',name:'לקוח',email:'client@example.com'},{id:'professional-2',name:'מנהל',email:'manager@example.com'}]}}));
  await page.route('**/api/ai/meeting-actions',route=>route.fulfill({json:{tasks:[],email:{subject:'סיכום & החלטות',body:'שלום,\nעדכון תכנית'}}}));
  await page.goto('/?page=project&project=PRJ-101&tab=reviews');
  await page.getByRole('button',{name:'פגישה',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.locator('textarea[name=summary]').fill('יש לעדכן את התכנית');
  await dialog.getByRole('button',{name:'הצע משימות וטיוטת מייל',exact:true}).click();
  await dialog.getByRole('group',{name:'נמענים',exact:true}).getByRole('checkbox').first().check();
  await dialog.getByRole('group',{name:'עותק (CC)',exact:true}).getByRole('checkbox').nth(1).check();
  const link=dialog.getByRole('link',{name:'פתח טיוטה ב־Outlook'}),href=await link.getAttribute('href');
  const url=new URL(href);expect(decodeURIComponent(url.pathname)).toBe('client@example.com');expect(url.searchParams.get('cc')).toBe('manager@example.com');expect(url.searchParams.get('subject')).toBe('סיכום & החלטות');expect(url.searchParams.get('body')).toBe('שלום,\nעדכון תכנית');
});


test('calendar controls align and show task performers; catalog search and manual entry work',async({page},testInfo)=>{
  await mockApi(page);
  await page.route('**/api/calendar?**',route=>route.fulfill({json:{projects,events:[{id:'task-41',type:'task',title:'בדיקת תכנית',startAt:new Date().toISOString(),endAt:new Date().toISOString(),assigneeName:'רונן ודניאל',allDay:true,color:'#6957df'}]}}));
  await page.goto('/?page=calendar');
  await expect(page.locator('.calendar-grid')).toBeVisible();await expect(page.locator('.calendar-event-text small').first()).toHaveText('רונן ודניאל');
  const heights=await page.locator('.calendar-navigation>button,.calendar-view-picker,.calendar-date-picker').evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().height)));
  expect(new Set(heights).size).toBe(1);
  expect(await page.locator('.calendar-event-text small').first().evaluate(el=>el.getBoundingClientRect().bottom<=el.parentElement.parentElement.getBoundingClientRect().bottom)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('calendar-desktop.png'),animations:'disabled'});
  const equipment=[{id:5,name:'בקר ראשי',itemType:'component',active:true,parentId:8},{id:8,name:'בית חכם',itemType:'system',active:true}];
  await page.route('**/api/equipment-catalog',route=>route.fulfill({json:{items:equipment}}));
  await page.route('**/api/projects/PRJ-101/workspace',route=>route.fulfill({json:{tasks:[],milestones:[],payments:[],team:[],equipment:[{id:1,catalog_item_id:5,name:'בקר ראשי',system_id:8,system_name:'בית חכם',system_type_name:'מערכות',quantity:1}],forms:[],files:[],updates:[],activity:[],reviews:[],meetings:[],timeEntries:[],priorityOrders:[],systemColumns:[],systemFieldSettings:[]}}));
  await page.route('**/api/projects/PRJ-101/system-board/8',route=>{expect(route.request().postDataJSON().categoryName).toBe('קטגוריה חדשה');return route.fulfill({json:{system:{}}});});
  await page.goto('/?page=project&project=PRJ-101&tab=systems');
  await page.getByRole('button',{name:'עריכת ITEM',exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.getByLabel('שם קטגוריה').fill('קטגוריה חדשה');await dialog.getByRole('button',{name:'שמירה',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'הוספת ITEM',exact:true}).click();dialog=page.getByRole('dialog');
  await dialog.getByLabel('חיפוש פריט קטלוג').fill('בקר');await expect(dialog.locator('select[name=catalogItemId] option')).toHaveCount(2);
  await dialog.getByRole('checkbox').check();await dialog.getByLabel('שם הפריט').fill('ציוד ידני');await dialog.locator('select[name=projectSystemId]').selectOption('8');
  await page.route('**/api/projects/PRJ-101/equipment',route=>{expect(route.request().postDataJSON().manualName).toBe('ציוד ידני');return route.fulfill({json:{equipment:{id:2}}});});
  await dialog.getByRole('button',{name:'הוספה לפרויקט',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
