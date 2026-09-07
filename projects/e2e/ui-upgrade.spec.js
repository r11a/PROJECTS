import { test, expect } from '@playwright/test';

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
