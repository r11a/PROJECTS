import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppModal } from './AppModal';
import { formatDateIL, localDateValue } from './dateTime';
import './date-input.css';

const FIRST_YEAR=2023;
const LAST_YEAR=2040;

export function DateInput(props) {
  return ['date','datetime-local'].includes(props.type) ? <DateField {...props}/> : <input {...props}/>;
}

function DateField({type='date',value,defaultValue='',onChange,onBlur,name,min,max,required,disabled,className='',...props}) {
  const rangeMin=min&&min>`${FIRST_YEAR}-01-01`?min:(type==='datetime-local'?`${FIRST_YEAR}-01-01T00:00`:`${FIRST_YEAR}-01-01`);
  const rangeMax=max&&max<`${LAST_YEAR}-12-31${type==='datetime-local'?'T23:59':''}`?max:(type==='datetime-local'?`${LAST_YEAR}-12-31T23:59`:`${LAST_YEAR}-12-31`);
  const [internal,setInternal]=useState(defaultValue);
  const current=String(value===undefined?internal:value||'');
  const display=(iso)=>iso ? `${formatDateIL(iso)}${type==='datetime-local'?' '+(iso.slice(11,16)||'00:00'):''}` : '';
  const [text,setText]=useState(()=>display(current));
  const [open,setOpen]=useState(false);
  const [month,setMonth]=useState(()=>new Date(`${current.slice(0,10)||localDateValue()}T12:00:00`));
  const inputRef=useRef(null);
  const calendarRef=useRef(null);
  const [focusDay,setFocusDay]=useState('');
  useEffect(()=>{if(open&&focusDay)calendarRef.current?.querySelector(`[data-date="${focusDay}"]`)?.focus();},[month,open,focusDay]);
  useEffect(()=>{setText(display(current));},[current]);
  const parse=(input)=>{
    const match=input.trim().match(type==='datetime-local'?/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/:/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!match)return '';
    const [,day,mon,year,hour='00',minute='00']=match;
    const iso=`${year}-${mon}-${day}`,date=new Date(`${iso}T12:00:00`);
    if(localDateValue(date)!==iso||+hour>23||+minute>59)return '';
    return iso+(type==='datetime-local'?`T${hour}:${minute}`:'');
  };
  const valid=(iso)=>Boolean(iso)&&iso>=rangeMin&&iso<=rangeMax;
  useEffect(()=>{
    inputRef.current?.setCustomValidity(text&&!valid(parse(text))?'יש להזין תאריך תקין בטווח המותר בפורמט DD/MM/YYYY'+(type==='datetime-local'?' HH:MM':''):'');
  },[text,rangeMin,rangeMax,type]);
  const emit=(iso)=>{if(iso!==current)inputRef.current?.dispatchEvent(new Event('projects:form-changed',{bubbles:true}));setInternal(iso);onChange?.({target:{value:iso,name},currentTarget:{value:iso,name}});};
  const choose=(iso)=>{setText(display(iso));emit(iso);setOpen(false);};
  const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const offset=new Date(month.getFullYear(),month.getMonth(),1).getDay();
  const years=Array.from({length:LAST_YEAR-FIRST_YEAR+1},(_,i)=>FIRST_YEAR+i);
  const firstMonth=month.getFullYear()===FIRST_YEAR&&month.getMonth()===0;
  const lastMonth=month.getFullYear()===LAST_YEAR&&month.getMonth()===11;
  const weekdays=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  return <span className={`he-date-input ${className}`}>
    <input {...props} ref={inputRef} type="text" dir="ltr" lang="he" value={text} required={required} disabled={disabled} placeholder={type==='datetime-local'?'DD/MM/YYYY HH:MM':'DD/MM/YYYY'} onChange={event=>{const next=event.target.value;setText(next);const iso=parse(next);if(valid(iso)||!next)emit(iso);}} onBlur={()=>onBlur?.({target:{value:parse(text),name}})}/>
    <input type="hidden" name={name} value={current} disabled={disabled}/>
    <button type="button" disabled={disabled} aria-label="פתיחת לוח תאריכים" onClick={()=>{const selected=current.slice(0,10)||localDateValue(),bounded=selected<`${FIRST_YEAR}-01-01`?`${FIRST_YEAR}-01-01`:selected>`${LAST_YEAR}-12-31`?`${LAST_YEAR}-12-31`:selected;setMonth(new Date(`${bounded}T12:00:00`));setOpen(true);}}><CalendarDays size={17}/></button>
    {open&&<AppModal title="בחירת תאריך" className="he-date-modal" onClose={()=>setOpen(false)}>
      <div className="he-calendar" dir="rtl" lang="he">
        <div className="he-calendar-navigation">
          <button type="button" aria-label="החודש הקודם" disabled={firstMonth} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronRight size={18}/></button>
          <select aria-label="חודש" value={month.getMonth()} onChange={e=>setMonth(new Date(month.getFullYear(),+e.target.value,1))}>{Array.from({length:12},(_,i)=><option key={i} value={i}>{new Date(2026,i,1).toLocaleDateString('he-IL',{month:'long'})}</option>)}</select>
          <select aria-label="שנה" value={month.getFullYear()} onChange={e=>setMonth(new Date(+e.target.value,month.getMonth(),1))}>{years.map(year=><option key={year}>{year}</option>)}</select>
          <button type="button" aria-label="החודש הבא" disabled={lastMonth} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronLeft size={18}/></button>
        </div>
        <div className="he-calendar-grid" ref={calendarRef} onKeyDown={event=>{
          const iso=event.target.dataset.date;
          if(!iso)return;
          const date=new Date(`${iso}T12:00:00`);
          const delta={ArrowLeft:1,ArrowRight:-1,ArrowUp:-7,ArrowDown:7,Home:-date.getDay(),End:6-date.getDay()}[event.key];
          if(delta===undefined)return;
          event.preventDefault();date.setDate(date.getDate()+delta);
          const next=localDateValue(date),full=next+(type==='datetime-local'?`T${current.slice(11,16)||'09:00'}`:'');
          if(!valid(full))return;
          if(date.getMonth()!==month.getMonth()||date.getFullYear()!==month.getFullYear())setMonth(new Date(date.getFullYear(),date.getMonth(),1));
          setFocusDay(next);
        }}>
          {weekdays.map(day=><small key={day}>{day}</small>)}
          {Array.from({length:offset},(_,i)=><span key={`empty-${i}`}/>)}
          {Array.from({length:days},(_,i)=>{const iso=localDateValue(new Date(month.getFullYear(),month.getMonth(),i+1)),next=iso+(type==='datetime-local'?`T${current.slice(11,16)||'09:00'}`:'');return <button type="button" key={iso} data-date={iso} aria-label={formatDateIL(iso)} aria-pressed={iso===current.slice(0,10)} disabled={!valid(next)} onClick={()=>choose(next)}>{i+1}</button>;})}
        </div>
        <button type="button" className="he-calendar-today" disabled={!valid(localDateValue()+(type==='datetime-local'?`T${current.slice(11,16)||'09:00'}`:''))} onClick={()=>choose(localDateValue()+(type==='datetime-local'?`T${current.slice(11,16)||'09:00'}`:''))}>היום</button>
        {type==='datetime-local'&&<small>אפשר לערוך את השעה בשדה התאריך והשעה.</small>}
      </div>
    </AppModal>}
  </span>;
}
