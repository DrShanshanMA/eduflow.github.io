import {test} from 'node:test';import assert from 'node:assert/strict';import {initial,mutate} from './workflow.mjs';
const owner='staff@school.edu',a='a@school.edu',b='b@school.edu';
function setup(){let s=initial(owner);mutate(s,owner,{type:'member',email:a,role:'student',group:'main-group'});mutate(s,owner,{type:'member',email:b,role:'student',group:'main-group'});mutate(s,owner,{type:'create',title:'Lecture'});return s;}
function apply(s,actor,action){return mutate(structuredClone(s),actor,action)}
function finish(s){let p=s.projects[0],stage=p.stage;for(let [i,t] of p.tasks.filter(t=>t.stage===stage).entries()){s=apply(s,owner,{type:'task',project:p.id,task:t.id,assignee:stage===2?(i===0?a:b):owner});s=apply(s,stage===2?(i===0?a:b):owner,{type:'task',project:p.id,task:t.id,status:'Complete'});}return s;}
test('advances only after all assigned tasks complete; blocks unassigned completion',()=>{let s=setup(),p=s.projects[0];assert.throws(()=>apply(s,owner,{type:'task',project:p.id,task:p.tasks[0].id,status:'Complete'}),/Assign/);s=finish(s);assert.equal(s.projects[0].stage,1);assert.ok(s.notifications.length)});
test('separate reviewers and student authorization enforced',()=>{let s=setup(),p=s.projects[0],reviews=p.tasks.filter(t=>t.stage===2);s=apply(s,owner,{type:'task',project:p.id,task:reviews[0].id,assignee:a});assert.throws(()=>apply(s,owner,{type:'task',project:p.id,task:reviews[1].id,assignee:a}),/different reviewers/);assert.throws(()=>apply(s,a,{type:'reset',project:p.id}),/(Staff|access denied)/);assert.throws(()=>apply(s,a,{type:'task',project:p.id,task:p.tasks[0].id,status:'Complete'}),/(Only your|access denied)/);assert.throws(()=>apply(s,'stranger@school.edu',{type:'create',title:'X'}),/not a member/)});
test('preview failures reopen correction tasks; final failures require regeneration',()=>{for(let failAt of [5,7]){let s=setup();while(s.projects[0].stage<failAt)s=finish(s);let p=s.projects[0];s=apply(s,owner,{type:'issue',project:p.id,slide:'3',description:'Hidden label'});p=s.projects[0];assert.equal(p.stage,3);assert.equal(p.cycle,2);assert.ok(p.archives.length);assert.ok(p.tasks.filter(t=>t.stage>=3).every(t=>t.status==='Not started'));s=apply(s,owner,{type:'task',project:p.id,task:p.tasks.find(t=>t.stage===3).id,assignee:owner});assert.throws(()=>finish(s),/Resolve and verify/);let issue=p.issues[0];assert.throws(()=>apply(s,owner,{type:'issue',project:p.id,issue:issue.id,status:'Closed'}),/Record the correction/);s=apply(s,owner,{type:'issue',project:p.id,issue:issue.id,status:'Closed',correction:'Moved label'});while(s.projects[0].stage<8)s=finish(s);assert.equal(s.projects[0].stage,8)}});
test('reset archives findings and retains links and assignments',()=>{let s=setup();s=finish(s);let p=s.projects[0],t=p.tasks[0];s=apply(s,owner,{type:'task',project:p.id,task:t.id,link:'https://school.edu/slides',comment:'Approved'});s=apply(s,owner,{type:'reset',project:p.id});p=s.projects[0];assert.equal(p.stage,0);assert.equal(p.tasks[0].assignee,owner);assert.equal(p.tasks[0].links.length,1);assert.equal(p.archives[0].tasks[0].status,'Complete');assert.throws(()=>apply(s,owner,{type:'task',project:p.id,task:t.id,link:'javascript:alert(1)'}),/http/)});

test('four project categories share courses and flexible projects begin without template tasks',()=>{
 let s=setup();for(let category of ['course-design','traditional-recording','digital-twin','general']){
  s=apply(s,owner,{type:'create',title:category,category,newCourse:'EDUC 510',organizer:a});let p=s.projects[0];
  assert.equal(p.category,category);assert.equal(p.organizer,a);assert.equal(p.tasks.length,category==='digital-twin'?15:0);
 }
 assert.equal(s.courses.filter(c=>c.name==='EDUC 510').length,1);assert.equal(new Set(s.projects.slice(0,4).map(p=>p.courseId)).size,1);
 assert.throws(()=>apply(s,owner,{type:'create',title:'Bad',category:'unknown',newCourse:'C'}),/category/);
 assert.throws(()=>apply(s,owner,{type:'create',title:'Bad',category:'general'}),/Choose a course/);
});
test('flexible subtasks complete a project, and new or reopened work reopens it',()=>{
 let s=setup();s=apply(s,owner,{type:'create',title:'Syllabus',category:'course-design',newCourse:'Design',organizer:a});let p=s.projects[0];
 assert.equal(p.tasks.length,0);assert.throws(()=>apply(s,b,{type:'addTask',project:p.id,title:'Unauthorized'}),/(organizer|access denied)/);
 s=apply(s,a,{type:'addTask',project:p.id,title:'Draft learning outcomes',organizer:b,assignee:a});let t=s.projects[0].tasks[0];
 assert.equal(t.organizer,b);s=apply(s,a,{type:'task',project:p.id,task:t.id,status:'Complete'});
 assert.ok(s.notifications.some(n=>n.email===b&&n.text.includes('Task complete')));
 s=apply(s,a,{type:'addTask',project:p.id,title:'Map assessments',organizer:a,assignee:b});
 assert.equal(s.projects[0].tasks.length,2);s=apply(s,b,{type:'task',project:p.id,task:s.projects[0].tasks[1].id,status:'Complete'});
 assert.ok(s.notifications.some(n=>n.text==='Project complete: Syllabus'));
 s=apply(s,b,{type:'task',project:p.id,task:t.id,status:'In progress'});
 assert.ok(s.notifications.some(n=>n.text==='Project in progress: Syllabus'));
});
test('project and task organizer transfers are independent and server-authorized',()=>{
 let s=setup();s=apply(s,owner,{type:'create',title:'Recording',category:'traditional-recording',newCourse:'Media',organizer:a});let p=s.projects[0];
 s=apply(s,a,{type:'addTask',project:p.id,title:'Edit audio',organizer:a,assignee:a});let t=s.projects[0].tasks[0];
 s=apply(s,a,{type:'settings',project:p.id,organizer:b});assert.equal(s.projects[0].tasks[0].organizer,a);
 assert.throws(()=>apply(s,a,{type:'settings',project:p.id,title:'No longer managed'}),/organizer/);
 s=apply(s,a,{type:'task',project:p.id,task:t.id,organizer:b});
 assert.throws(()=>apply(s,a,{type:'task',project:p.id,task:t.id,assignee:b}),/organizer/);
 s=apply(s,b,{type:'task',project:p.id,task:t.id,assignee:b});s=apply(s,b,{type:'settings',project:p.id,title:'Renamed',newCourse:'New course'});
 assert.equal(s.projects[0].title,'Renamed');assert.equal(s.courses.find(c=>c.id===s.projects[0].courseId).name,'New course');
});
test('general projects do not use digital-twin review stages and empty lists do not complete',()=>{
 let s=setup();s=apply(s,owner,{type:'create',title:'Meetings',category:'general',newCourse:'General team work'});let p=s.projects[0];
 s=apply(s,owner,{type:'addTask',project:p.id,title:'Schedule meeting',assignee:a});
 s=apply(s,owner,{type:'issue',project:p.id,description:'Confirm room'});assert.equal(s.projects[0].stage,0);assert.equal(s.projects[0].archives.length,0);
 s=apply(s,a,{type:'task',project:p.id,task:s.projects[0].tasks[0].id,status:'Complete'});assert.equal(s.projects[0].stage,0);
 assert.throws(()=>apply(s,owner,{type:'restart',project:p.id}),/digital twin/);
});
test('legacy projects preserve their work while gaining course grouping and task organizers',async()=>{
 const {normalize,projectStatus}=await import('./workflow.mjs');let s=setup(),p=s.projects[0];delete s.courses;delete p.courseId;delete p.category;
 for(let t of p.tasks){delete t.organizer;delete t.independentReview;}p.tasks[0].comments.push({by:owner,text:'Keep this review note'});p.tasks[0].links.push({url:'https://school.edu/slides'});let oldTasks=structuredClone(p.tasks);
 normalize(s);assert.equal(p.category,'digital-twin');assert.equal(p.courseId,'unassigned-course');assert.equal(p.tasks[0].organizer,owner);assert.deepEqual(p.tasks[0].comments,oldTasks[0].comments);assert.deepEqual(p.tasks[0].links,oldTasks[0].links);assert.equal(p.tasks[0].id,oldTasks[0].id);assert.equal(p.tasks.find(t=>t.title==='Independent review A').independentReview,0);
 let again=JSON.stringify(s);normalize(s);assert.equal(JSON.stringify(s),again);assert.equal(projectStatus(p),'In progress');
});
