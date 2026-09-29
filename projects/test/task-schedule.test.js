import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTaskSchedule } from '../shared/taskSchedule.js';
test('full day is nine hours and clears timed fields',()=>{
  assert.deepEqual(normalizeTaskSchedule({allDay:true,startTime:'08:00',endTime:'10:00',durationHours:2}),{allDay:true,startTime:null,endTime:null,durationHours:9});
});
test('timed tasks derive hours, allow clearing times and reject reversed same-day ranges',()=>{
  assert.equal(normalizeTaskSchedule({startTime:'08:30',endTime:'11:00',startDate:'2026-09-29',dueDate:'2026-09-29'}).durationHours,2.5);
  assert.equal(normalizeTaskSchedule({startTime:'',endTime:'',durationHours:4},{start_time:'08:00',end_time:'10:00'}).startTime,null);
  assert.equal(normalizeTaskSchedule({startTime:null,endTime:null},{start_time:'08:00',end_time:'10:00'}).startTime,null);
  assert.throws(()=>normalizeTaskSchedule({startTime:'11:00',endTime:'10:00',startDate:'2026-09-29',dueDate:'2026-09-29'}),/סיום/);
  assert.throws(()=>normalizeTaskSchedule({durationHours:-1}),/שעות/);
  assert.throws(()=>normalizeTaskSchedule({startTime:'26:00'}),/שעה/);
});
test('partial status edits retain configured report hours',()=>{
  assert.equal(normalizeTaskSchedule({status:'done'},{duration_hours:4,start_time:'08:00',end_time:'10:00'}).durationHours,4);
  assert.equal(normalizeTaskSchedule({status:'done'},{duration_hours:0,estimated_hours:3}).durationHours,3);
});
