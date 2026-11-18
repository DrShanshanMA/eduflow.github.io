import {test} from 'node:test';import assert from 'node:assert/strict';
import {initial,mutate,projectStatus} from './workflow.mjs';
import {defaultSteps,projectSteps,hasSteps,validateSteps} from './steps.mjs';
import {visibleState} from './access.mjs';
const owner='owner@school.edu',a='a@school.edu',b='b@school.edu',other='other@school.edu';
const act=(s,email,x)=>mutate(structuredClone(s),email,x);
const step=(id,title,taskTitles=[])=>({id,title,instructions:['Check '+title],taskTitles});
function setup(){let s=initial(owner);for(const email of [a,b])s=act(s,owner,{type:'member',email,role:'student',group:'main-group'});s=act(s,owner,{type:'member',email:other,role:'staff'});return s;}
function create(s,category='general',organizer=owner){return act(s,owner,{type:'create',group:'main-group',title:'Project',category,newCourse:'Course',organizer});}
function finish(s){let p=s.projects[0];for(const [i,t] of p.tasks.filter(t=>t.stage===p.stage).entries()){let assignee=t.independentReview===undefined?owner:[a,b][i];s=act(s,owner,{type:'task',project:p.id,task:t.id,assignee});s=act(s,assignee,{type:'task',project:p.id,task:t.id,status:'Complete'});}return s;}
test('category templates create independent workflow snapshots and scoped default tasks for every category',()=>{
 let s=setup();for(const category of ['course-design','traditional-recording','digital-twin','general']){
  s=act(s,owner,{type:'workflowTemplate',group:'main-group',category,steps:[step('plan','Plan',['Draft']),step('review','Review',['Review output'])]});
  s=create(s,category);let p=s.projects[0];assert.equal(projectSteps(p).length,2);assert.equal(p.tasks.length,2);assert.equal(p.tasks[1].stage,1);
  s=act(s,owner,{type:'workflowTemplate',group:'main-group',category,steps:[step('deliver','Deliver')]});assert.equal(projectSteps(s.projects[0])[0].title,'Plan');
 }
 s=act(s,owner,{type:'create',title:'Opt out',group:'main-group',category:'general',course:s.courses[0].id,useTemplate:false});assert.ok(!hasSteps(s.projects[0]));
});
test('custom workflows advance beyond eight steps and do not skip unassigned tasks',()=>{
 let s=setup();const steps=Array.from({length:10},(_,i)=>step('s'+i,'Phase '+(i+1),['Task '+i]));s=act(s,owner,{type:'workflowTemplate',group:'main-group',category:'course-design',steps});s=create(s,'course-design');let p=s.projects[0];assert.equal(projectSteps(p).length,10);
 assert.throws(()=>act(s,owner,{type:'task',project:p.id,task:p.tasks[0].id,status:'Complete'}),/Assign/);
 while(s.projects[0].stage<10)s=finish(s);assert.equal(projectStatus(s.projects[0]),'Complete');assert.ok(s.notifications.some(n=>n.text==='Project complete: Project'));
});
test('empty steps require organizer approval and cannot bypass unfinished tasks or final issues',()=>{
 let s=setup();s=act(s,owner,{type:'workflowTemplate',group:'main-group',category:'general',steps:[step('plan','Plan'),step('review','Review',['Review task']),step('deliver','Deliver')]});s=create(s);let p=s.projects[0];assert.equal(p.stage,0);
 s=act(s,owner,{type:'projectMembers',project:p.id,members:[a]});assert.throws(()=>act(s,a,{type:'completeStep',project:p.id}),/organizer/);
 s=act(s,owner,{type:'completeStep',project:p.id});assert.equal(s.projects[0].stage,1);assert.throws(()=>act(s,owner,{type:'completeStep',project:p.id}),/assigned tasks/);
 s=finish(s);assert.equal(s.projects[0].stage,2);s=act(s,owner,{type:'issue',project:p.id,description:'Needs correction'});assert.throws(()=>act(s,owner,{type:'completeStep',project:p.id}),/Resolve and verify/);
 s=act(s,owner,{type:'issue',project:p.id,issue:s.projects[0].issues[0].id,status:'Closed',correction:'Corrected'});s=act(s,owner,{type:'completeStep',project:p.id});assert.equal(s.projects[0].stage,3);
 s=act(s,owner,{type:'issue',project:p.id,issue:s.projects[0].issues[0].id,status:'Open'});assert.equal(s.projects[0].stage,2);assert.equal(projectStatus(s.projects[0]),'In progress');
});
test('renaming steps preserves progress; sequence changes archive and remap task records',()=>{
 let s=setup();s=act(s,owner,{type:'workflowTemplate',group:'main-group',category:'general',steps:[step('one','One',['First']),step('two','Two',['Second'])]});s=create(s);let p=s.projects[0],first=p.tasks[0];s=act(s,owner,{type:'task',project:p.id,task:first.id,assignee:a});s=act(s,a,{type:'task',project:p.id,task:first.id,status:'Complete',comment:'Keep this',link:'https://school.edu/resource'});
 let renamed=structuredClone(s.projects[0].workflow);renamed[0].title='Planning';renamed[0].instructions=['Updated instructions'];s=act(s,owner,{type:'workflow',project:p.id,steps:renamed});assert.equal(s.projects[0].stage,1);assert.equal(s.projects[0].tasks[0].status,'Complete');
 const reordered=[renamed[1],renamed[0]];assert.throws(()=>act(s,owner,{type:'workflow',project:p.id,steps:reordered}),/Confirm restarting/);
 s=act(s,owner,{type:'workflow',project:p.id,steps:reordered,confirmRestart:true});p=s.projects[0];assert.equal(p.stage,0);assert.equal(p.tasks[0].stage,1);assert.equal(p.tasks[0].assignee,a);assert.equal(p.tasks[0].status,'Not started');assert.equal(p.tasks[0].comments[0].text,'Keep this');assert.equal(p.archives[0].tasks[0].status,'Complete');
 assert.throws(()=>act(s,owner,{type:'workflow',project:p.id,steps:[reordered[0]]}),/cannot be removed/);
});
test('project organizers may configure their project but cannot edit group category templates',()=>{
 let s=create(setup(),'general',a),p=s.projects[0];s=act(s,a,{type:'workflow',project:p.id,steps:[step('start','Start')]});assert.equal(projectSteps(s.projects[0]).length,1);
 assert.throws(()=>act(s,a,{type:'workflowTemplate',group:'main-group',category:'general',steps:[step('start','Start')]}),/Group manager/);
 assert.throws(()=>act(s,b,{type:'workflow',project:p.id,steps:[step('x','X')]}),/access denied/);
 s=act(s,other,{type:'group',name:'PRIVATE_GROUP'});const group=s.groups.at(-1).id;s=act(s,other,{type:'workflowTemplate',group,category:'general',steps:[step('private','PRIVATE_STEP')]});assert.ok(!JSON.stringify(visibleState(s,a)).includes('PRIVATE_STEP'));
});
test('flat projects gain steps without losing existing tasks; return-to-step reopens downstream work only',()=>{
 let s=create(setup()),p=s.projects[0];s=act(s,owner,{type:'addTask',project:p.id,title:'Existing work',assignee:a});let old=s.projects[0].tasks[0];s=act(s,owner,{type:'workflow',project:p.id,steps:[step('one','Plan'),step('two','Review',['Review'])]});assert.equal(s.projects[0].tasks[0].id,old.id);assert.equal(s.projects[0].tasks[0].stage,0);
 s=finish(s);s=finish(s);assert.equal(s.projects[0].stage,2);s=act(s,owner,{type:'returnToStep',project:p.id,stage:1});assert.equal(s.projects[0].stage,1);assert.equal(s.projects[0].tasks[0].status,'Complete');assert.equal(s.projects[0].tasks[1].status,'Not started');
 s=act(s,owner,{type:'returnToStep',project:p.id,stage:0});assert.throws(()=>act(s,owner,{type:'returnToStep',project:p.id,stage:1}),/earlier step/);
});
test('digital twin review loops follow stable step identity after an inserted step',()=>{
 let s=create(setup(),'digital-twin'),p=s.projects[0];const steps=[step('kickoff','Kickoff',['Kickoff task']),...structuredClone(defaultSteps)];steps.find(s=>s.id==='twin-resolve').title='Correct findings';
 s=act(s,owner,{type:'workflow',project:p.id,steps});assert.equal(s.projects[0].tasks.length,16);
 while(s.projects[0].stage<6)s=finish(s);s=act(s,owner,{type:'issue',project:p.id,description:'Preview glitch'});assert.equal(s.projects[0].stage,4);assert.equal(projectSteps(s.projects[0])[4].title,'Correct findings');assert.ok(s.notifications.some(n=>n.text.includes('returned to Correct findings')));
});
test('workflow validation rejects invalid lengths, duplicate identifiers, names and broken digital twin review policy',()=>{
 for(const input of [[],[step('x','')],[step('x','X'),step('x','Y')],Array.from({length:33},(_,i)=>step('s'+i,'Step'))])assert.throws(()=>validateSteps(input,'general'));
 let broken=structuredClone(defaultSteps);broken.find(s=>s.id==='twin-review').taskTitles=[];assert.throws(()=>validateSteps(broken,'digital-twin'),/two independent/);assert.throws(()=>validateSteps(defaultSteps.filter(s=>s.id!=='twin-resolve'),'digital-twin'),/Keep Resolve/);
});
