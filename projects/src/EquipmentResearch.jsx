export const equipmentCategories=[['switches','מפסקים ובקרי KNX'],['speakers','רמקולים ואודיו'],['alarm','מערכות אזעקה'],['smart','בית חכם'],['multimedia','מולטימדיה'],['cameras','מצלמות'],['network','תקשורת ונתונים']];
const safeUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}};
const Link=({url,children,...props})=>safeUrl(url)?<a href={safeUrl(url)} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>:<span>{children}</span>;

function linkedText(text) {
  text=text.replace(/\uE200cite\uE202[^\uE201]*\uE201/g,'');
  const parts=[];let start=0;
  for(const match of text.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)){parts.push(text.slice(start,match.index));parts.push(<Link key={match.index} url={match[2]}>{match[1]}</Link>);start=match.index+match[0].length;}
  parts.push(text.slice(start));return parts;
}
export function ResearchText({text,research}) {
  if(!research?.citations?.length)return <p>{research?linkedText(text):text}</p>;
  const parts=[];let start=0;
  for(const citation of [...research.citations].sort((a,b)=>a.end-b.end)) {
    if(citation.end<start||citation.end>text.length)continue;
    parts.push(...linkedText(text.slice(start,citation.end)));start=citation.end;
    const source=research.sources?.[citation.source];
    if(source)parts.push(<sup key={`${citation.end}-${citation.source}`}><Link url={source.url} title={source.title}>[{citation.source+1}]</Link></sup>);
  }
  parts.push(...linkedText(text.slice(start)));return <p>{parts}</p>;
}

export function ResearchResults({research,busy,onProduct,onProject}) {
  if(!research)return null;
  return <section className="equipment-results" aria-label="מידע טכני לציוד">
    {research.project&&<strong className="equipment-project">ציוד בפרויקט {research.project.name}</strong>}
    {research.cached&&<small className="equipment-cache">תשובה שמורה · ללא טוקנים נוספים</small>}
    {research.projects?.length>0&&<label>בחירת פרויקט<select defaultValue="" disabled={busy} onChange={e=>onProject(e.target.value)}><option value="" disabled>בחרו פרויקט</option>{research.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {research.products?.map((p,i)=><div className="equipment-product" key={`${p.id||p.model}-${i}`}>
      <strong>{p.name}</strong><span dir="auto">{[p.manufacturer,p.model].filter(Boolean).join(' · ')||'יצרן ודגם לא הוגדרו'}</span>
      <nav>{p.links?.map(link=><Link key={link.url} url={link.url}>{link.title} ↗</Link>)}</nav>
      {!research.sources?.length&&<button type="button" disabled={busy} onClick={()=>onProduct(p)}>{p.manufacturer&&p.model?'חיפוש AI עם מקורות':'השלמת יצרן ודגם'}</button>}
    </div>)}
    {research.sources?.length>0&&<div className="equipment-sources"><strong>מקורות ונתוני יצרן</strong>{research.sources.map((source,i)=>{
      const preview=research.previews?.find(p=>p.url===source.url);
      return <div className="equipment-source" key={source.url}>
        {preview?.image&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(preview.image)&&<Link url={source.url}><img src={preview.image} alt={`תמונה מהמקור: ${source.title}`} loading="lazy"/></Link>}
        <Link url={source.url}>[{i+1}] {source.title} {preview?.document?'· PDF':'↗'}</Link>
        {preview?.documents?.map(d=><Link key={d.url} url={d.url}>{d.title} · PDF ↗</Link>)}
      </div>;
    })}</div>}
    {research.suggestions&&<iframe title="הצעות חיפוש Google" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${research.suggestions}`}/>}
  </section>;
}
