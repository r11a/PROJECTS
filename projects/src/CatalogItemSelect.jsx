import { useId, useState } from 'react';

export function CatalogItemSelect({items}) {
  const listId=useId();
  const [text,setText]=useState('');
  const options=items.filter(item=>item.active).map(item=>({id:item.id,label:`${item.name} · ${item.code||item.id}${item.manufacturer?' · '+item.manufacturer:''}${item.model?' · '+item.model:''}`}));
  const selected=options.find(item=>item.label===text);
  return <label className="wide">פריט קטלוג
    <input role="combobox" aria-autocomplete="list" aria-expanded="false" list={listId} value={text} required placeholder="הקלדה או בחירה מהרשימה" onChange={event=>{setText(event.target.value);event.target.setCustomValidity(options.some(item=>item.label===event.target.value)?'':'יש לבחור פריט מהרשימה');}}/>
    <datalist id={listId}>{options.map(item=><option key={item.id} value={item.label}/>)}</datalist>
    <input type="hidden" name="catalogItemId" value={selected?.id||''}/>
  </label>;
}
