import { test, expect } from '@playwright/test';

// Route fixtures must remain owned by Playwright, including after navigation.
// The real add-on critical paths retain the production service worker.
test.use({serviceWorkers:'block'});

test('dynamic import highlights a detected project, maps multiple sheets, edits groups and requires final approval',async({page},testInfo)=>{
  await mockApi(page);await page.setViewportSize({width:390,height:844});let commits=0,plans=0;
  const tables=[{index:0,name:'Floor 0',enabled:true,kind:'equipment',headerRow:0,mapping:{id:0,name:1,type:2},rows:[['id','name','type'],['C1','Camera','Dome'],['C2','Camera','Dome']],systemName:'מצלמות'},{index:1,name:'Floor 1',enabled:true,kind:'equipment',headerRow:0,mapping:{id:0,name:1,type:2},rows:[['id','name','type'],['C3','Camera','Dome']],systemName:'מצלמות'}];
  await page.route('**/api/table-import/inspect',route=>route.fulfill({json:{previewId:'preview',tables,projects,systems:[],fields:{id:'מזהה קבוע',name:'שם רכיב / עבודה',type:'סוג ציוד'},states:{},warnings:[],detection:{suggested:'PRJ-102',matches:[projects[1]]}}}));
  await page.route('**/api/table-import/plan',route=>{
    const body=route.request().postDataJSON();plans++;expect(body.projectId).toBe('PRJ-102');expect(body.configs).toHaveLength(2);
    const plan=['C1','C2','C3'].map((id,i)=>({key:id.toLowerCase(),id,name:body.choices[id.toLowerCase()]?.edits?.name||'Camera',manufacturer:body.choices[id.toLowerCase()]?.edits?.manufacturer||'',model:body.choices[id.toLowerCase()]?.edits?.model||'',type:'Dome',floor:i===2?'Floor 1':'Floor 0',sheet:i===2?'Floor 1':'Floor 0',row:i+2,kind:'equipment',systemName:'מצלמות',status:'new',quantity:1,values:{quantity_installed:0},changes:[],conflicts:[]}));
    return route.fulfill({json:{plan,planId:`plan-${plans}`,existingEquipment:[],existingTasks:[]}});
  });
  await page.route('**/api/table-import/commit',route=>{commits++;const body=route.request().postDataJSON();expect(body.confirm).toBe(true);expect(body.planId).toBe('plan-2');return route.fulfill({json:{projectId:'PRJ-102',summary:{created:3,updated:0,unchanged:0,skipped:0}}});});
  await page.goto('/?page=project&project=PRJ-101&tab=systems');await page.getByRole('button',{name:'ייבוא טבלה וקובץ לפרויקט',exact:true}).click();
  await page.getByLabel('קובץ לייבוא',{exact:true}).setInputFiles({name:'install.csv',mimeType:'text/csv',buffer:Buffer.from('id,name\nC1,Camera')});await page.getByRole('button',{name:'בדיקה והצעת מיפוי',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.locator('.table-import-project.detected')).toBeVisible();await expect(page.getByLabel('פרויקט יעד לייבוא')).toHaveValue('PRJ-102');
  await page.getByLabel('פרויקט יעד לייבוא').selectOption('PRJ-101');await expect(dialog.locator('.table-import-project.detected')).toHaveCount(0);await page.getByLabel('פרויקט יעד לייבוא').selectOption('PRJ-102');
  await expect(dialog.locator('.table-import-mapping>details')).toHaveCount(2);expect(commits).toBe(0);
  await page.getByRole('button',{name:'הצגת השינויים לפני אישור',exact:true}).click();
  await page.getByLabel('סיכום רכיבים זהים לפי קומה').check();await expect(dialog.locator('.equipment-floor-groups summary')).toHaveCount(2);await expect(dialog.locator('.equipment-floor-groups summary').first()).toContainText('כמות 2');
  await dialog.locator('.table-import-bulk').getByLabel('יצרן',{exact:true}).fill('Maker');await page.getByLabel('קבוצת עריכה').selectOption('Dome');await page.getByRole('button',{name:'החל על הקבוצה בתצוגה',exact:true}).click();
  await page.getByLabel('C1 דגם',{exact:true}).fill('M1');await expect(page.getByRole('button',{name:'אישור וייבוא לפרויקט',exact:true})).toBeDisabled();expect(commits).toBe(0);
  await page.getByRole('button',{name:'השווה מחדש',exact:true}).click();await expect(page.getByLabel('C2 יצרן',{exact:true})).toHaveValue('Maker');
  await page.screenshot({path:testInfo.outputPath('dynamic-import-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'אישור וייבוא לפרויקט',exact:true}).click();await expect(dialog.getByText('הייבוא הושלם והקובץ צורף לפרויקט')).toBeVisible();expect(commits).toBe(1);
});

test('equipment chat supports project questions, free links, model selection and cited research on mobile',async({page},testInfo)=>{
  await mockApi(page);await page.setViewportSize({width:390,height:844});
  const product={name:'מפסק חדר',manufacturer:'Maker',model:'M1',links:[{title:'דף נתונים PDF',url:'https://maker.example.com/M1.pdf'}]};
  let calls=0;
  await page.route('**/api/ai/chat/stream',route=>{
    const body=route.request().postDataJSON();calls++;
    expect(body.question).toContain('מידות');
    if(calls===1){expect(body.freeSearch).toBe(true);return route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify({type:'answer',answer:'נמצא הדגם בפרויקט לוי',providerName:'PROJECTS',model:'ללא טוקנים',research:{project:{id:'p1',name:'לוי'},products:[product]}})}\n\n`});}
    expect(body.manufacturer).toBe('Maker');expect(body.model).toBe('M1');expect(body.history).toBeUndefined();expect(body.freeSearch).toBe(false);
    return route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify({type:'answer',answer:'רוחב 80 מ״מ',providerName:'Test provider',model:'test',generatedAt:'2026-09-08T10:00:00Z',research:{products:[product],sources:[{url:'https://maker.example.com/M1.pdf',title:'Maker datasheet'}],citations:[{end:11,source:0}],previews:[{url:'https://maker.example.com/M1.pdf',document:true,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD3sAAAAASUVORK5CYII='}],suggestions:'<script>parent.hacked=true</script><div>Google Search</div>'}})}\n\n`});
  });
  await page.goto('/');await page.getByRole('button',{name:'הסוכן החכם',exact:true}).click();
  await page.getByLabel('אופן החיפוש').selectOption('free');
  await page.locator('.ai-chat textarea').fill('מה המידות של המפסקים בפרויקט של לוי?');
  await page.locator('.ai-chat textarea').press('Enter');
  await expect(page.locator('.equipment-project')).toHaveText('ציוד בפרויקט לוי');
  await page.getByRole('button',{name:'חיפוש AI עם מקורות',exact:true}).click();
  await expect(page.locator('.ai-chat-thread sup a')).toHaveAttribute('href','https://maker.example.com/M1.pdf');
  await expect(page.locator('.equipment-source img')).toBeVisible();
  expect(await page.evaluate(()=>window.hacked)).toBeUndefined();
  const send=page.locator('.ai-chat-send');expect(await send.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBeTruthy();
  expect(await page.locator('.ai-chat').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('equipment-research-mobile.png')});
});

test('ITEM deletion reports failure and removes the group after a successful retry',async({page})=>{
  await mockApi(page);let deleted=false,calls=0;
  await page.route('**/api/projects/PRJ-101/workspace',route=>route.fulfill({json:{tasks:[],milestones:[],payments:[],team:[],equipment:deleted?[]:[{id:1,name:'מפסק',system_id:8,system_name:'מערכת בדיקה',system_type_name:'בית חכם',quantity:1}],forms:[],files:[],updates:[],activity:[],reviews:[],meetings:[],timeEntries:[],priorityOrders:[],systemColumns:[],systemFieldSettings:[]}}));
  await page.route('**/api/projects/PRJ-101/system-board/8',route=>{expect(route.request().method()).toBe('DELETE');calls++;if(calls===1)return route.fulfill({status:500,json:{error:'מחיקה נכשלה לבדיקה'}});deleted=true;return route.fulfill({status:204});});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/?page=project&project=PRJ-101&tab=systems');await page.getByRole('button',{name:'עריכת ITEM',exact:true}).click();
  await page.getByRole('button',{name:'מחיקת ITEM והרכיבים',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('מחיקה נכשלה לבדיקה');
  await page.getByRole('button',{name:'מחיקת ITEM והרכיבים',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.project-system-item')).toHaveCount(0);
});

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
    await page.locator('.stage-chart-wrap .recharts-surface').click({position:{x:105,y:180}});
    expect(await page.locator('.stage-chart-wrap').evaluate(el=>{const active=document.activeElement;return !el.contains(active)||getComputedStyle(active).outlineStyle==='none'})).toBeTruthy();
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
  await expect(dialog.getByLabel('חיפוש פריט קטלוג')).toHaveCount(0);await dialog.getByRole('combobox',{name:'פריט קטלוג',exact:true}).fill('בקר ראשי · 5');await expect(dialog.locator('input[name=catalogItemId]')).toHaveValue('5');
  await dialog.getByRole('checkbox').check();await dialog.getByLabel('שם הפריט').fill('ציוד ידני');await dialog.locator('select[name=projectSystemId]').selectOption('8');
  await page.route('**/api/projects/PRJ-101/equipment',route=>{expect(route.request().postDataJSON().manualName).toBe('ציוד ידני');return route.fulfill({json:{equipment:{id:2}}});});
  await dialog.getByRole('button',{name:'הוספה לפרויקט',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});


test('project hours include drawing and record uploads show a foreground status with resized images',async({page})=>{
  await mockApi(page);
  await page.goto('/?page=project&project=PRJ-101&tab=hours');
  await page.getByRole('button',{name:'דיווח שעות',exact:true}).click();
  await expect(page.locator('select[name=activityType] option[value=drawing]')).toHaveText('שרטוט תכניות');
  await page.getByRole('dialog').getByRole('button',{name:'ביטול',exact:true}).click();
  const original=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2800;c.height=1800;const ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);for(let i=0;i<pixels.data.length;i+=4){const n=(i*17)%251;pixels.data[i]=n;pixels.data[i+1]=(i/4)%255;pixels.data[i+2]=100;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);return c.toDataURL('image/png').split(',')[1];}),'base64');
  expect(original.length).toBeGreaterThan(250*1024);
  await page.route('**/api/projects/PRJ-101/site-reviews',route=>route.fulfill({json:{review:{id:77}}}));
  let releaseUpload;let uploaded;const uploadHeld=new Promise(resolve=>releaseUpload=resolve);
  await page.route('**/api/documents',async route=>{const body=route.request().postDataBuffer(),header=body.indexOf('name="file"'),start=body.indexOf('\r\n\r\n',header)+4,end=body.lastIndexOf('\r\n--');uploaded=body.subarray(start,end);await uploadHeld;await route.fulfill({json:{document:{id:9}}});});
  await page.goto('/?page=project&project=PRJ-101&tab=reviews');await page.getByRole('button',{name:'ביקורת',exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.locator('textarea[name=summary]').fill('תיעוד תמונה');await dialog.locator('input[name=attachments]').setInputFiles({name:'site.png',mimeType:'image/png',buffer:original});
  await dialog.getByRole('button',{name:'שמירת ביקורת',exact:true}).click();
  await expect(page.locator('.record-upload-shield')).toBeVisible();await expect.poll(()=>uploaded?.length||0).toBeGreaterThan(0);
  expect(await page.locator('.record-upload-overlay').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBeTruthy();
  expect(uploaded.length).toBeLessThan(original.length);
  const dimensions=await page.evaluate(async base64=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),image=await createImageBitmap(new Blob([bytes]));const result=[image.width,image.height];image.close();return result;},uploaded.toString('base64'));
  expect(Math.max(...dimensions)).toBe(2048);expect(dimensions[0]/dimensions[1]).toBeCloseTo(2800/1800,2);
  releaseUpload();await expect(page.locator('.record-upload-shield')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
});
