export function normalizeTaskSchedule(body = {}, current = {}) {
  const allDay = Boolean(body.allDay ?? current.all_day ?? false);
  const time = value => {
    if (value === '' || value == null) return null;
    const text = String(value).slice(0, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error('יש לבחור שעה תקינה');
    return text;
  };
  if (allDay) return {allDay:true,startTime:null,endTime:null,durationHours:9};
  const startTime = time(Object.hasOwn(body,'startTime') ? body.startTime : current.start_time);
  const endTime = time(Object.hasOwn(body,'endTime') ? body.endTime : current.end_time);
  const savedHours=Number(current.duration_hours)>0?current.duration_hours:current.estimated_hours??current.duration_hours??0;
  let durationHours = Number(body.durationHours ?? body.estimatedHours ?? savedHours);
  const sameDay = String(body.startDate ?? current.start_date ?? '').slice(0,10) === String(body.dueDate ?? current.due_date ?? '').slice(0,10);
  if (startTime && endTime && sameDay) {
    const minutes = value => Number(value.slice(0,2))*60+Number(value.slice(3));
    if (minutes(endTime) <= minutes(startTime)) throw new Error('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
    if (body.durationHours === undefined && body.estimatedHours === undefined && ('startTime' in body || 'endTime' in body)) durationHours = (minutes(endTime)-minutes(startTime))/60;
  }
  if (!Number.isFinite(durationHours) || durationHours < 0 || durationHours > 9999) throw new Error('מספר השעות אינו תקין');
  return {allDay:false,startTime,endTime,durationHours:Math.round(durationHours*100)/100};
}
