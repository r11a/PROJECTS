import { localDateValue } from '../../dateTime.js';
export const createTaskDraft=()=>({projectId:'',title:'',startDate:localDateValue(),dueDate:'',startTime:'',endTime:'',allDay:false,durationHours:'',status:'open',priority:'normal',assigneeProfessionalId:'',assigneeProfessionalIds:[],ownerProfessionalId:'',parentTaskId:'',taskType:'task',estimatedHours:'',description:''});
export const createMilestoneDraft=()=>({projectId:'',title:'',dueDate:'',status:'planned',progress:0,ownerProfessionalId:'',description:''});
