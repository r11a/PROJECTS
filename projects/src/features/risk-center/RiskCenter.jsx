import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, CircleAlert } from "lucide-react";
import "./risk-center.css";

export function RiskCenter({api,projects,openProject}){
  const [risks,setRisks]=useState([]);const [category,setCategory]=useState('all');const [expanded,setExpanded]=useState(false);
  const load=()=>api('/risk-center').then((result)=>setRisks(result.projects||[])).catch(()=>{});
  useEffect(()=>{load();const refresh=()=>load();window.addEventListener('projects:live-change',refresh);return()=>window.removeEventListener('projects:live-change',refresh)},[]);
  const visible=useMemo(()=>risks.filter((risk)=>category==='all'||(category==='smart_home'?risk.project_category!=='other':risk.project_category==='other')),[risks,category]);
  const openRisk=(risk,project)=>{const taskId=risk.reasons.find((reason)=>reason.entityId)?.entityId;if(taskId){const url=new URL(window.location.href);url.searchParams.set('project',risk.id);url.searchParams.set('task',taskId);window.location.assign(url.toString());return;}if(project)openProject(project)};
  if(!visible.length)return null;
  return <section className="panel risk-center"><header><div><h3>מרכז סיכונים</h3><p>שלושת הפרויקטים הדחופים ביותר לפי נתוני הביצוע</p></div><div className="risk-header-actions"><span>{visible.length} דורשים תשומת לב</span>{visible.length>3&&<button className="risk-expand" onClick={()=>setExpanded((value)=>!value)}>{expanded?'צמצם':'הרחב'}</button>}</div></header><nav className="project-category-filter"><button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>הכל</button><button className={category==='smart_home'?'active':''} onClick={()=>setCategory('smart_home')}>בית חכם</button><button className={category==='other'?'active':''} onClick={()=>setCategory('other')}>אחרים</button></nav>{visible.slice(0,expanded?visible.length:3).map((risk)=>{const project=projects.find((item)=>String(item.id)===String(risk.id));const categoryName=risk.project_category==='other'?(risk.project_category_custom||'אחר'):'בית חכם';return <button key={risk.id} onClick={()=>openRisk(risk,project)}><span className={`health-score ${risk.tone}`}>{risk.score}</span><div><strong>{risk.name}<small> · {categoryName}</small></strong><ul>{risk.reasons.slice(0,3).map((reason,index)=><li key={`${reason.kind}-${index}`}><CircleAlert size={13}/>{reason.label}<b>-{reason.points}</b></li>)}</ul></div><ChevronLeft/></button>})}</section>;
}
