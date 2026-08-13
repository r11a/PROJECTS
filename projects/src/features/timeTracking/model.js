export const timeActivityLabels={planning:'תכנון',supervision:'פיקוח',technician:'זמן טכנאים',installation:'התקנה',threading:'השחלות',programming:'תכנות',training:'הדרכה'};
export const summarizeTimeEntries=(entries=[])=>Object.entries(timeActivityLabels).map(([key,label])=>({key,label,hours:entries.filter(item=>item.activity_type===key).reduce((sum,item)=>sum+Number(item.hours||0),0)}));
