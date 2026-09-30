import {useEffect,useRef,useState} from 'react';
import {FileText,Upload} from 'lucide-react';

export function FileUpload({label='בחירת קבצים',onChange,...props}) {
  const [files,setFiles]=useState([]);
  const previews=useRef([]);
  useEffect(()=>()=>previews.current.forEach(url=>URL.revokeObjectURL(url)),[]);
  const change=event=>{
    previews.current.forEach(url=>URL.revokeObjectURL(url));
    previews.current=[];
    setFiles([...event.target.files].map(file=>{
      const url=/^image\/(jpeg|png|webp|gif)$/.test(file.type)?URL.createObjectURL(file):null;
      if(url)previews.current.push(url);
      return {name:file.name,size:file.size,url};
    }));
    onChange?.(event);
  };
  return <div className="file-upload">
    <label className="file-upload-control"><Upload size={20}/><span><strong>{label}</strong><small>{files.length?`${files.length} קבצים נבחרו`:'לחצו לבחירה מהמכשיר'}</small></span><input {...props} type="file" aria-label={props['aria-label']||label} onChange={change}/></label>
    {!!files.length&&<ul className="file-upload-preview" aria-label="קבצים שנבחרו">{files.map((file,index)=><li key={`${file.name}-${index}`}>{file.url?<img src={file.url} alt=""/>:<FileText size={22}/>}<span>{file.name}<small>{(file.size/1024/1024).toFixed(1)} MB</small></span></li>)}</ul>}
  </div>;
}
