import { useEffect, useMemo, useState } from "react";
import { CircleMarker, LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Building2, Crosshair, ExternalLink, FolderKanban, LocateFixed, MapPinned, Navigation, Search } from "lucide-react";
import "./gis-workspace.css";

const israelCenter=[31.7683,35.2137];
const validPosition=(project)=>Number.isFinite(Number(project?.lat))&&Number.isFinite(Number(project?.lng));

function MapFocus({project,userPosition}){
  const map=useMap();
  useEffect(()=>{if(validPosition(project))map.flyTo([Number(project.lat),Number(project.lng)],18,{duration:.8});else if(userPosition)map.flyTo(userPosition,16,{duration:.7})},[project?.id,userPosition?.[0],userPosition?.[1]]);
  return null;
}

function MapResize(){
  const map=useMap();
  useEffect(()=>{const container=map.getContainer();const observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(container);map.invalidateSize({pan:false});return()=>observer.disconnect()},[map]);
  return null;
}

function projectIcon(project){return L.divIcon({className:"gis-marker-wrap",html:`<div class="gis-project-marker"><span>${String(project?.name||'P').slice(0,2)}</span><i></i></div>`,iconSize:[48,58],iconAnchor:[24,54],popupAnchor:[0,-48]})}

export function GisWorkspace({projects,openProject,setNotice}){
  const available=useMemo(()=>projects.filter(validPosition),[projects]);
  const [selectedId,setSelectedId]=useState(()=>String(available[0]?.id||""));
  const [query,setQuery]=useState("");
  const [userPosition,setUserPosition]=useState(null);
  const selected=projects.find(project=>String(project.id)===selectedId)||available[0]||null;
  useEffect(()=>{if(!selectedId&&available[0])setSelectedId(String(available[0].id))},[available.length]);
  const filtered=projects.filter(project=>`${project.name} ${project.client||''} ${project.address||''} ${project.location||''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const locate=()=>{if(!navigator.geolocation)return setNotice("שירותי מיקום אינם זמינים במכשיר");navigator.geolocation.getCurrentPosition(({coords})=>setUserPosition([coords.latitude,coords.longitude]),error=>setNotice(error.message||"לא ניתן לקבל מיקום נוכחי"),{enableHighAccuracy:true,timeout:12000,maximumAge:30000})};
  const navigate=()=>{if(!selected)return;const destination=validPosition(selected)?`${selected.lat},${selected.lng}`:encodeURIComponent(selected.address||selected.location||'');window.open(`https://www.waze.com/ul?ll=${destination}&navigate=yes`,'_blank','noopener,noreferrer')};
  return <div className="gis-workspace-page section-page">
    <header className="gis-hero"><div><span><MapPinned size={17}/>GIS לפרויקטים</span><h2>מפת אתר מדויקת ואיכותית</h2><p>בחרו פרויקט וצפו בכתובת, בתצלום לוויין או במפת רחובות — עם התאמה מלאה לטלפון.</p></div><strong>{available.length}<small>פרויקטים ממוקמים</small></strong></header>
    <section className="gis-shell panel">
      <aside className="gis-project-panel">
        <label className="gis-project-select"><span>בחירת פרויקט</span><select value={selectedId} onChange={event=>setSelectedId(event.target.value)}><option value="">בחירת פרויקט ממוקם</option>{available.map(project=><option key={project.id} value={project.id}>{project.name} · {project.address||project.location}</option>)}</select></label>
        <label className="gis-search"><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="חיפוש פרויקט או כתובת"/></label>
        <div className="gis-project-list">{filtered.map(project=><button type="button" key={project.id} className={String(project.id)===String(selected?.id)?"active":""} onClick={()=>setSelectedId(String(project.id))}><span><Building2 size={17}/></span><div><strong>{project.name}</strong><small>{project.address||project.location||"כתובת טרם הוגדרה"}</small></div>{validPosition(project)?<LocateFixed size={15}/>:<i title="ללא קואורדינטות"/>}</button>)}</div>
      </aside>
      <main className="gis-map-stage">
        <MapContainer center={validPosition(selected)?[Number(selected.lat),Number(selected.lng)]:israelCenter} zoom={validPosition(selected)?18:8} zoomControl scrollWheelZoom>
          <LayersControl position="topleft">
            <LayersControl.BaseLayer name="מפת רחובות"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={20}/></LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="תצלום לוויין"><TileLayer attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={20}/></LayersControl.BaseLayer>
          </LayersControl>
          <MapResize/>
          <MapFocus project={selected} userPosition={userPosition}/>
          {selected&&validPosition(selected)&&<Marker position={[Number(selected.lat),Number(selected.lng)]} icon={projectIcon(selected)}><Popup><div className="gis-popup" dir="rtl"><strong>{selected.name}</strong><span>{selected.address||selected.location}</span><small>{Number(selected.lat).toFixed(6)}, {Number(selected.lng).toFixed(6)}</small></div></Popup></Marker>}
          {userPosition&&<CircleMarker center={userPosition} radius={9} pathOptions={{color:'#fff',weight:3,fillColor:'#287de0',fillOpacity:1}}/>}
        </MapContainer>
        <div className="gis-map-tools"><button type="button" onClick={locate}><Crosshair size={18}/><span>המיקום שלי</span></button></div>
        {selected?<article className="gis-selected-card"><div><span>{selected.id}</span><strong>{selected.name}</strong><small>{selected.address||selected.location||"כתובת טרם הוגדרה"}</small></div><div className="gis-coordinate"><LocateFixed size={15}/>{validPosition(selected)?`${Number(selected.lat).toFixed(6)}, ${Number(selected.lng).toFixed(6)}`:'נדרשת השלמת כתובת מדויקת'}</div><footer><button type="button" onClick={()=>openProject(selected)}><FolderKanban size={16}/>פתיחת הפרויקט</button><button type="button" onClick={navigate} disabled={!validPosition(selected)&&!selected.address}><Navigation size={16}/>ניווט</button><a href={`https://www.google.com/maps/search/?api=1&query=${validPosition(selected)?`${selected.lat},${selected.lng}`:encodeURIComponent(selected.address||'')}`} target="_blank" rel="noreferrer"><ExternalLink size={16}/>מפה חיצונית</a></footer></article>:<div className="gis-empty"><MapPinned size={28}/><strong>בחרו פרויקט כדי לפתוח את מפת ה־GIS שלו</strong></div>}
      </main>
    </section>
  </div>;
}
