import express from 'express';
import webpush from 'web-push';

const CATEGORIES = ['tasks','finance','projects','messages','insights','system'];
const DEFAULT_CATEGORIES = Object.fromEntries(CATEGORIES.map((key)=>[key,true]));
const DEFAULT_POLICY = { enabled:true, categories:DEFAULT_CATEGORIES, smart:{overdueTasks:true,paymentDue:true,projectRisk:true} };
const cleanText=(value,max)=>String(value||'').trim().slice(0,max);
const validCategory=(value)=>CATEGORIES.includes(value)?value:'system';

export async function createPushService({pool,authenticate,requireRoles,audit}) {
  let keySetting=await pool.query("SELECT value FROM app_settings WHERE key='pushVapid'");
  let keys=keySetting.rows[0]?.value;
  if(!keys?.publicKey||!keys?.privateKey){
    keys=webpush.generateVAPIDKeys();
    await pool.query("INSERT INTO app_settings(key,value) VALUES('pushVapid',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[JSON.stringify(keys)]);
  }
  webpush.setVapidDetails('mailto:admin@projects.local',keys.publicKey,keys.privateKey);

  const policy=async()=>{
    const row=await pool.query("SELECT value FROM app_settings WHERE key='pushNotifications'");
    return {...DEFAULT_POLICY,...(row.rows[0]?.value||{}),categories:{...DEFAULT_CATEGORIES,...(row.rows[0]?.value?.categories||{})},smart:{...DEFAULT_POLICY.smart,...(row.rows[0]?.value?.smart||{})}};
  };
  const resolveUsers=async(audienceType,audience={})=>{
    if(audienceType==='selected')return [...new Set((audience.userIds||[]).map(Number).filter(Number.isInteger))];
    if(audienceType==='list'){
      const result=await pool.query('SELECT user_id FROM notification_list_members WHERE list_id=$1',[Number(audience.listId)||0]);return result.rows.map(row=>Number(row.user_id));
    }
    if(audienceType==='relevant'){
      const projectId=Number(audience.projectId)||0;if(!projectId)return [];
      const result=await pool.query(`SELECT DISTINCT linked_user_id user_id FROM professionals WHERE id IN (SELECT manager_professional_id FROM projects WHERE id=$1) AND linked_user_id IS NOT NULL
        UNION SELECT DISTINCT p.linked_user_id FROM tasks t JOIN task_assignees ta ON ta.task_id=t.id JOIN professionals p ON p.id=ta.professional_id WHERE t.project_id=$1 AND p.linked_user_id IS NOT NULL`,[projectId]);return result.rows.map(row=>Number(row.user_id));
    }
    const result=await pool.query('SELECT id FROM users WHERE active=TRUE AND merged_into_user_id IS NULL');return result.rows.map(row=>Number(row.id));
  };
  const sendToUsers=async(userIds,payload,{category='system',campaignId=null,dedupeKey=''}={})=>{
    const currentPolicy=await policy();category=validCategory(category);
    if(!currentPolicy.enabled||currentPolicy.categories[category]===false||!userIds.length)return {sent:0,failed:0,skipped:userIds.length};
    const subscriptions=await pool.query(`SELECT s.*,u.display_name,COALESCE(p.enabled,TRUE) preference_enabled,COALESCE(p.categories,'{}'::jsonb) preference_categories
      FROM push_subscriptions s JOIN users u ON u.id=s.user_id LEFT JOIN user_push_preferences p ON p.user_id=s.user_id
      WHERE s.active=TRUE AND s.user_id=ANY($1::bigint[])
        AND ($2<>'finance' OR (u.finance_access=TRUE AND (u.role IN ('admin','manager','finance') OR COALESCE(u.permissions->>'finance','none')<>'none')))`,[userIds,category]);
    let sent=0,failed=0,skipped=0;
    for(const item of subscriptions.rows){
      if(!item.preference_enabled||item.preference_categories?.[category]===false){skipped++;continue;}
      if(dedupeKey){const duplicate=await pool.query('SELECT 1 FROM notification_deliveries WHERE user_id=$1 AND subscription_id=$2 AND dedupe_key=$3',[item.user_id,item.id,dedupeKey]);if(duplicate.rowCount){skipped++;continue;}}
      try{
        const firstName=String(item.display_name||'').trim().split(/\s+/)[0];
        const personalized={...payload,title:String(payload.title||'התראה').replace(/\{\{?שם\}?\}/g,firstName),body:String(payload.body||'').replace(/\{\{?שם\}?\}/g,firstName)};
        if(firstName&&!/\{\{?שם\}?\}/.test(String(payload.body||''))&&payload.personalize!==false)personalized.body=`${firstName}, ${personalized.body}`;
        delete personalized.personalize;
        await webpush.sendNotification({endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},JSON.stringify({...personalized,category}),{TTL:86400,urgency:category==='messages'?'high':'normal'});
        sent++;await pool.query('UPDATE push_subscriptions SET last_success_at=NOW(),last_error=\'\',updated_at=NOW() WHERE id=$1',[item.id]);
        await pool.query('INSERT INTO notification_deliveries(campaign_id,user_id,subscription_id,category,dedupe_key,status) VALUES($1,$2,$3,$4,$5,\'sent\')',[campaignId,item.user_id,item.id,category,dedupeKey]);
      }catch(error){
        failed++;const expired=[404,410].includes(error.statusCode);await pool.query('UPDATE push_subscriptions SET active=CASE WHEN $2 THEN FALSE ELSE active END,last_error=$3,updated_at=NOW() WHERE id=$1',[item.id,expired,cleanText(error.message,500)]);
        await pool.query('INSERT INTO notification_deliveries(campaign_id,user_id,subscription_id,category,dedupe_key,status,error) VALUES($1,$2,$3,$4,$5,\'failed\',$6) ON CONFLICT DO NOTHING',[campaignId,item.user_id,item.id,category,dedupeKey,cleanText(error.message,500)]);
      }
    }
    return {sent,failed,skipped};
  };
  const processCampaigns=async()=>{
    const due=await pool.query("UPDATE notification_campaigns SET status='sending' WHERE id IN (SELECT id FROM notification_campaigns WHERE status='scheduled' AND scheduled_at<=NOW() ORDER BY scheduled_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *");
    for(const campaign of due.rows){
      try{const users=await resolveUsers(campaign.audience_type,campaign.audience);const result=await sendToUsers(users,{title:campaign.title,body:campaign.body,url:campaign.target_url,tag:`campaign-${campaign.id}`},{category:campaign.category,campaignId:campaign.id});await pool.query("UPDATE notification_campaigns SET status='sent',sent_at=NOW(),sent_count=$2,failure_count=$3 WHERE id=$1",[campaign.id,result.sent,result.failed]);}
      catch(error){await pool.query("UPDATE notification_campaigns SET status='failed',error=$2 WHERE id=$1",[campaign.id,cleanText(error.message,500)]);}
    }
  };
  const processSmart=async()=>{
    const current=await policy();if(!current.enabled)return;
    if(current.smart.overdueTasks){
      const tasks=await pool.query(`SELECT t.id,t.title,t.due_date,p.name project_name,ARRAY_REMOVE(ARRAY_AGG(DISTINCT pro.linked_user_id),NULL) user_ids FROM tasks t JOIN projects p ON p.id=t.project_id LEFT JOIN task_assignees ta ON ta.task_id=t.id LEFT JOIN professionals pro ON pro.id=ta.professional_id WHERE t.status NOT IN ('done','completed','cancelled') AND t.due_date<CURRENT_DATE GROUP BY t.id,p.name LIMIT 100`);
      for(const task of tasks.rows)await sendToUsers(task.user_ids||[],{title:'משימה באיחור',body:`${task.project_name} — ${task.title}`,url:`?page=tasks&task=${task.id}`,tag:`overdue-task-${task.id}`},{category:'tasks',dedupeKey:`task-overdue:${task.id}:${task.due_date}`});
    }
    if(current.smart.paymentDue){
      const payments=await pool.query(`SELECT pay.id,pay.title,pay.due_date,pay.amount,pr.id project_id,pr.name project_name,ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.id),NULL) user_ids
        FROM project_payments pay JOIN projects pr ON pr.id=pay.project_id LEFT JOIN professionals manager ON manager.id=pr.manager_professional_id LEFT JOIN users u ON (u.id=manager.linked_user_id OR u.role IN ('admin','finance')) AND u.active=TRUE
        WHERE pay.status='pending' AND pay.due_date<=CURRENT_DATE GROUP BY pay.id,pr.id,pr.name LIMIT 100`);
      for(const payment of payments.rows)await sendToUsers(payment.user_ids||[],{title:'תשלום דורש טיפול',body:`${payment.project_name} — ${payment.title}, ₪${Number(payment.amount).toLocaleString('he-IL')}`,url:'?page=finance',tag:`payment-due-${payment.id}`},{category:'finance',dedupeKey:`payment-due:${payment.id}:${payment.due_date}`});
    }
    if(current.smart.projectRisk){
      const risks=await pool.query(`SELECT pr.id,pr.name,pr.health,ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.id),NULL) user_ids FROM projects pr LEFT JOIN professionals manager ON manager.id=pr.manager_professional_id LEFT JOIN users u ON (u.id=manager.linked_user_id OR u.role='admin') AND u.active=TRUE WHERE pr.archived_at IS NULL AND COALESCE(pr.health,100)<70 GROUP BY pr.id,pr.name,pr.health LIMIT 50`);
      for(const project of risks.rows)await sendToUsers(project.user_ids||[],{title:'פרויקט דורש תשומת לב',body:`${project.name} — ציון בריאות ${project.health}`,url:`?page=project&id=${project.id}`,tag:`project-risk-${project.id}`},{category:'projects',dedupeKey:`project-risk:${project.id}:${project.health}:${new Date().toISOString().slice(0,10)}`});
    }
  };
  const router=express.Router();
  router.use(authenticate);
  router.use(['/push/admin','/push/lists','/push/campaigns'],requireRoles('admin'));
  router.get('/push/config',async(request,response)=>{const [pref,subscriptions]=await Promise.all([pool.query('SELECT enabled,categories FROM user_push_preferences WHERE user_id=$1',[request.user.id]),pool.query('SELECT id,device_label,user_agent,last_success_at,created_at FROM push_subscriptions WHERE user_id=$1 AND active=TRUE ORDER BY created_at DESC',[request.user.id])]);response.json({supported:true,publicKey:keys.publicKey,preferences:{enabled:pref.rows[0]?.enabled??true,categories:{...DEFAULT_CATEGORIES,...(pref.rows[0]?.categories||{})}},devices:subscriptions.rows});});
  router.post('/push/subscriptions',async(request,response)=>{const sub=request.body?.subscription;if(!sub?.endpoint||!sub?.keys?.p256dh||!sub?.keys?.auth)return response.status(400).json({error:'מנוי ההתראות אינו תקין'});const result=await pool.query(`INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,device_label,user_agent) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,device_label=EXCLUDED.device_label,user_agent=EXCLUDED.user_agent,active=TRUE,updated_at=NOW() RETURNING id`,[request.user.id,sub.endpoint,sub.keys.p256dh,sub.keys.auth,cleanText(request.body.deviceLabel,100),cleanText(request.headers['user-agent'],500)]);await audit(request,'subscribe','push_device',String(result.rows[0].id));response.status(201).json({id:result.rows[0].id});});
  router.delete('/push/subscriptions',async(request,response)=>{await pool.query('UPDATE push_subscriptions SET active=FALSE,updated_at=NOW() WHERE user_id=$1 AND endpoint=$2',[request.user.id,request.body?.endpoint||'']);await audit(request,'unsubscribe','push_device',String(request.user.id));response.status(204).end();});
  router.patch('/push/preferences',async(request,response)=>{const categories=Object.fromEntries(CATEGORIES.map(key=>[key,request.body?.categories?.[key]!==false]));const enabled=request.body?.enabled!==false;await pool.query(`INSERT INTO user_push_preferences(user_id,enabled,categories) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET enabled=EXCLUDED.enabled,categories=EXCLUDED.categories,updated_at=NOW()`,[request.user.id,enabled,JSON.stringify(categories)]);response.json({enabled,categories});});
  router.get('/push/admin',async(_request,response)=>{const [policyRow,users,lists,campaigns]=await Promise.all([policy(),pool.query('SELECT id,display_name,role,active FROM users WHERE merged_into_user_id IS NULL ORDER BY display_name'),pool.query(`SELECT l.*,COALESCE(JSON_AGG(m.user_id) FILTER(WHERE m.user_id IS NOT NULL),'[]') members FROM notification_lists l LEFT JOIN notification_list_members m ON m.list_id=l.id GROUP BY l.id ORDER BY l.name`),pool.query('SELECT * FROM notification_campaigns ORDER BY created_at DESC LIMIT 50')]);response.json({policy:policyRow,users:users.rows,lists:lists.rows,campaigns:campaigns.rows});});
  router.patch('/push/admin/policy',async(request,response)=>{const next={...DEFAULT_POLICY,...request.body,categories:{...DEFAULT_CATEGORIES,...request.body?.categories},smart:{...DEFAULT_POLICY.smart,...request.body?.smart}};await pool.query("UPDATE app_settings SET value=$1,updated_by=$2,updated_at=NOW() WHERE key='pushNotifications'",[JSON.stringify(next),request.user.id]);await audit(request,'update','push_policy','global',next);response.json({policy:next});});
  router.post('/push/lists',async(request,response)=>{const name=cleanText(request.body?.name,100);const memberIds=[...new Set((request.body?.userIds||[]).map(Number).filter(Number.isInteger))];if(!name)return response.status(400).json({error:'יש להזין שם לרשימת התפוצה'});const client=await pool.connect();try{await client.query('BEGIN');const list=await client.query('INSERT INTO notification_lists(name,created_by) VALUES($1,$2) RETURNING *',[name,request.user.id]);if(memberIds.length)await client.query('INSERT INTO notification_list_members(list_id,user_id) SELECT $1,unnest($2::bigint[])',[list.rows[0].id,memberIds]);await client.query('COMMIT');response.status(201).json({list:list.rows[0]});}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}});
  router.delete('/push/lists/:id',async(request,response)=>{await pool.query('DELETE FROM notification_lists WHERE id=$1',[request.params.id]);response.status(204).end();});
  router.post('/push/campaigns',async(request,response)=>{const title=cleanText(request.body?.title,160),body=cleanText(request.body?.body,1000);if(!title||!body)return response.status(400).json({error:'יש להזין כותרת ותוכן'});const scheduledAt=request.body?.scheduledAt?new Date(request.body.scheduledAt):new Date();if(Number.isNaN(scheduledAt.getTime()))return response.status(400).json({error:'מועד השליחה אינו תקין'});const audienceType=['all','selected','list','relevant'].includes(request.body?.audienceType)?request.body.audienceType:'all';const result=await pool.query(`INSERT INTO notification_campaigns(title,body,category,target_url,audience_type,audience,scheduled_at,smart,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[title,body,validCategory(request.body?.category),cleanText(request.body?.targetUrl,500),audienceType,JSON.stringify(request.body?.audience||{}),scheduledAt,Boolean(request.body?.smart),request.user.id]);await audit(request,'create','push_campaign',String(result.rows[0].id),{audienceType,scheduledAt});setTimeout(()=>processCampaigns().catch(console.error),0);response.status(201).json({campaign:result.rows[0]});});
  router.post('/push/campaigns/:id/cancel',async(request,response)=>{const result=await pool.query("UPDATE notification_campaigns SET status='cancelled' WHERE id=$1 AND status='scheduled' RETURNING id",[request.params.id]);if(!result.rowCount)return response.status(409).json({error:'לא ניתן לבטל הודעה שכבר נשלחה'});response.json({cancelled:true});});
  return {router,publicKey:keys.publicKey,sendToUsers,processCampaigns,processSmart};
}

export function startPushScheduler(service){let busy=false;const run=async()=>{if(busy)return;busy=true;try{await service.processCampaigns();await service.processSmart();}catch(error){console.error('Push scheduler failed',error.message)}finally{busy=false;}};run();const timer=setInterval(run,60000);timer.unref?.();return timer;}
