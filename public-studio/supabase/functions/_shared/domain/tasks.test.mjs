import {test} from 'node:test';import assert from 'node:assert/strict';
import {initial,mutate} from './workflow.mjs';import {personalTasks,personalTaskCounts} from './tasks.mjs';
const admin='admin@school.edu',person='person@school.edu',other='other@school.edu';
test('personal totals count assigned or organized tasks once, exclude unrelated private work, and update on status changes',()=>{
 const s=initial(admin);mutate(s,admin,{type:'member',email:person,role:'staff',group:'main-group'});mutate(s,admin,{type:'member',email:other,role:'staff'});
 mutate(s,admin,{type:'create',title:'Work',category:'general',newCourse:'Course'});let p=s.projects[0];
 mutate(s,admin,{type:'addTask',project:p.id,title:'Both assigned and organized',organizer:person,assignee:person});
 mutate(s,admin,{type:'addTask',project:p.id,title:'Assigned only',assignee:person});
 mutate(s,admin,{type:'addTask',project:p.id,title:'Organized only',organizer:person,assignee:admin});
 mutate(s,admin,{type:'addTask',project:p.id,title:'Not my task',assignee:admin});
 mutate(s,other,{type:'group',name:'Other private group'});let group=s.groups.at(-1).id;mutate(s,other,{type:'create',group,title:'Private',category:'general',newCourse:'Private course'});mutate(s,other,{type:'addTask',project:s.projects[0].id,title:'Private task',assignee:other});
 let tasks=personalTasks(s,person);assert.equal(tasks.length,3);assert.deepEqual(personalTaskCounts(tasks),{total:3,open:3,complete:0});
 mutate(s,person,{type:'task',project:p.id,task:p.tasks[0].id,status:'Complete'});tasks=personalTasks(s,person);assert.deepEqual(personalTaskCounts(tasks),{total:3,open:2,complete:1});
 mutate(s,person,{type:'task',project:p.id,task:p.tasks[0].id,status:'In progress'});assert.equal(personalTaskCounts(personalTasks(s,person)).open,3);
 mutate(s,admin,{type:'removeMember',email:person});assert.deepEqual(personalTaskCounts(personalTasks(s,person)),{total:0,open:0,complete:0});
});
test('task totals handle an empty or loading workspace',()=>{assert.deepEqual(personalTaskCounts(personalTasks(null,person)),{total:0,open:0,complete:0});});
