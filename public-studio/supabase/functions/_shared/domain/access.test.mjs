import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,mutate,normalize} from './workflow.mjs';
import {visibleState,canViewProject,isAdmin,canManageProject} from './access.mjs';
const admin='admin@school.edu',alice='alice@school.edu',bob='bob@school.edu',worker='worker@school.edu',staff='creator@school.edu';
const act=(s,email,a)=>mutate(structuredClone(s),email,a);
function setup(){
 let s=initial(admin);
 for(const email of [alice,bob,worker,staff])s=act(s,admin,{type:'member',email,role:email===worker?'student':'staff'});
 s=act(s,alice,{type:'group',name:'Design team'});const ga=s.groups.at(-1).id;
 s=act(s,bob,{type:'group',name:'PRIVATE_B_GROUP'});const gb=s.groups.at(-1).id;
 s=act(s,alice,{type:'groupMember',group:ga,email:worker,role:'member'});
 s=act(s,alice,{type:'groupMember',group:ga,email:staff,role:'member'});
 s=act(s,alice,{type:'create',group:ga,title:'Alice project',category:'general',newCourse:'Alice course'});const pa=s.projects[0].id;
 s=act(s,bob,{type:'create',group:gb,title:'PRIVATE_B_PROJECT',category:'general',newCourse:'PRIVATE_B_COURSE'});const pb=s.projects[0].id;
 s=act(s,bob,{type:'addTask',project:pb,title:'PRIVATE_B_TASK',assignee:bob});const tb=s.projects[0].tasks[0].id;
 s=act(s,bob,{type:'task',project:pb,task:tb,comment:'PRIVATE_B_COMMENT',link:'https://school.edu/PRIVATE_B_LINK'});
 s=act(s,bob,{type:'issue',project:pb,description:'PRIVATE_B_ISSUE'});
 s=act(s,bob,{type:'reset',project:pb});
 // Simulate an old notification delivered broadly before access controls existed.
 s.notifications.push({id:'old',email:alice,project:pb,text:'PRIVATE_B_OLD_NOTIFICATION'});
 return {s,ga,gb,pa,pb,tb};
}
test('server projection excludes other groups, projects, courses, tasks, links, findings, archives and history',()=>{
 const {s,pa,pb}=setup(),view=visibleState(s,alice),serialized=JSON.stringify(view);
 assert.deepEqual(view.projects.map(p=>p.id),[pa]);assert.ok(!serialized.includes('PRIVATE_B_'));assert.ok(!serialized.includes(bob));assert.ok(!('owner' in view));assert.ok(!canViewProject(s,alice,s.projects.find(p=>p.id===pb)));assert.equal(visibleState(s,admin).projects.length,2);
});
test('staff and membership alone confer no access to another project in the same group',()=>{
 let {s,pa,ga}=setup();assert.equal(visibleState(s,staff).projects.length,0);assert.throws(()=>act(s,staff,{type:'settings',project:pa,title:'Intrusion'}),/access denied/);
 s=act(s,staff,{type:'create',group:ga,title:'My own project',category:'general',newCourse:'My course'});assert.equal(visibleState(s,staff).projects.length,1);assert.ok(!visibleState(s,staff).projects.some(p=>p.id===pa));
 s=act(s,alice,{type:'projectMembers',project:pa,members:[staff]});assert.ok(visibleState(s,staff).projects.some(p=>p.id===pa));assert.ok(!canManageProject(s,staff,s.projects.find(p=>p.id===pa)));assert.throws(()=>act(s,staff,{type:'reset',project:pa}),/organizer/);
 s=act(s,alice,{type:'projectMembers',project:pa,members:[]});assert.ok(!visibleState(s,staff).projects.some(p=>p.id===pa));
});
test('assignment grants project access but not unrelated project management',()=>{
 let {s,pa}=setup();assert.equal(visibleState(s,worker).projects.length,0);
 s=act(s,alice,{type:'addTask',project:pa,title:'Assigned work',assignee:worker});const t=s.projects.find(p=>p.id===pa).tasks[0];
 assert.equal(visibleState(s,worker).projects.length,1);s=act(s,worker,{type:'task',project:pa,task:t.id,status:'In progress'});
 assert.throws(()=>act(s,worker,{type:'projectMembers',project:pa,members:[staff]}),/organizer/);
 assert.throws(()=>act(s,worker,{type:'task',project:pa,task:t.id,organizer:worker}),/organizer/);
});
test('forged project IDs, cross-group assignments, course selection and self-promotion are rejected',()=>{
 const {s,pa,pb,gb}=setup();
 for(const action of [{type:'settings',project:pb,title:'X'},{type:'addTask',project:pb,title:'X'},{type:'reset',project:pb},{type:'issue',project:pb,description:'X'},{type:'projectMembers',project:pb,members:[alice]}])assert.throws(()=>act(s,alice,action),/access denied/);
 assert.throws(()=>act(s,alice,{type:'addTask',project:pa,title:'X',assignee:bob}),/group/);
 assert.throws(()=>act(s,alice,{type:'projectMembers',project:pa,members:[bob]}),/group/);
 assert.throws(()=>act(s,alice,{type:'settings',project:pa,organizer:bob}),/group/);
 assert.throws(()=>act(s,alice,{type:'create',group:gb,title:'X',category:'general',newCourse:'X'}),/cannot create/);
 assert.throws(()=>act(s,alice,{type:'course',course:s.projects.find(p=>p.id===pb).courseId,name:'X'}),/cannot create/);
 assert.throws(()=>act(s,alice,{type:'member',email:alice,role:'admin'}),/administrator/);
 assert.throws(()=>act(s,worker,{type:'groupMember',group:gb,email:worker,role:'manager'}),/manager/);
});
test('notifications never broadcast another group’s work to non-admin staff',()=>{
 const {s,pb}=setup();assert.ok(!s.notifications.some(n=>n.email===staff&&n.project===pb));assert.ok(!visibleState(s,alice).notifications.some(n=>n.project===pb));assert.ok(s.notifications.some(n=>n.email===admin&&n.project===pb));
});
test('revoking group membership removes project data even when historical assignments remain',()=>{
 let {s,ga,pa}=setup();s=act(s,alice,{type:'addTask',project:pa,title:'Work',organizer:worker,assignee:worker});let t=s.projects.find(p=>p.id===pa).tasks[0];
 s=act(s,worker,{type:'task',project:pa,task:t.id,status:'Complete'});assert.ok(visibleState(s,worker).projects.length);
 s=act(s,alice,{type:'groupMember',group:ga,email:worker,remove:true});
 assert.equal(visibleState(s,worker).projects.length,0);assert.equal(visibleState(s,worker).groups.length,0);assert.equal(visibleState(s,worker).notifications.length,0);assert.equal(visibleState(s,worker).history.length,0);assert.throws(()=>act(s,worker,{type:'task',project:pa,task:t.id,comment:'Denied'}),/access denied/);
});
test('manager removal transfers organizer duties and clears unfinished assignments',()=>{
 let {s,ga,pa}=setup();s=act(s,alice,{type:'groupMember',group:ga,email:staff,role:'manager'});s=act(s,alice,{type:'addTask',project:pa,title:'Draft',organizer:alice,assignee:alice});
 s=act(s,staff,{type:'groupMember',group:ga,email:alice,remove:true});const p=s.projects.find(p=>p.id===pa);assert.equal(p.organizer,staff);assert.equal(p.tasks[0].organizer,staff);assert.equal(p.tasks[0].assignee,'');assert.equal(visibleState(s,alice).projects.length,0);
});
test('last administrator and last group manager cannot be removed; self-demotion narrows access',()=>{
 let {s,ga}=setup();assert.throws(()=>act(s,admin,{type:'member',email:admin,role:'staff'}),/last administrator/);assert.throws(()=>act(s,alice,{type:'groupMember',group:ga,email:alice,role:'member'}),/last manager/);
 s=act(s,admin,{type:'member',email:bob,role:'admin'});s=act(s,admin,{type:'member',email:admin,role:'staff'});assert.ok(!isAdmin(s,admin));assert.equal(visibleState(s,admin).projects.length,0);assert.equal(visibleState(s,bob).projects.length,2);
});
test('legacy migration preserves work and existing access without making all staff administrators',()=>{
 let {s}=setup();delete s.accessVersion;delete s.groups;for(const m of s.members)delete m.admin;for(const c of s.courses)delete c.groupId;for(const p of s.projects){delete p.groupId;delete p.members;}
 const before=structuredClone(s.projects);normalize(s);assert.equal(s.groups[0].name,'Existing projects');assert.ok(isAdmin(s,admin));assert.ok(!isAdmin(s,alice));assert.equal(visibleState(s,worker).projects.length,2);assert.deepEqual(s.projects[0].archives,before[0].archives);let snapshot=JSON.stringify(s);normalize(s);assert.equal(JSON.stringify(s),snapshot);
});

test('workspace removal revokes all access while preserving completed work and comments',()=>{
 let {s,ga,pa}=setup();s=act(s,alice,{type:'addTask',project:pa,title:'Completed contribution',assignee:worker,organizer:worker});let t=s.projects.find(p=>p.id===pa).tasks[0];
 s=act(s,worker,{type:'task',project:pa,task:t.id,comment:'Keep my contribution',status:'Complete'});
 s=act(s,alice,{type:'addTask',project:pa,title:'Unfinished contribution',assignee:worker,organizer:worker});
 assert.throws(()=>act(s,alice,{type:'removeMember',email:worker}),/administrator/);
 s=act(s,admin,{type:'removeMember',email:worker});const p=s.projects.find(p=>p.id===pa);
 assert.equal(s.members.find(m=>m.email===worker).active,false);assert.ok(!s.groups.some(g=>g.members.some(m=>m.email===worker)));
 assert.equal(p.tasks[0].status,'Complete');assert.equal(p.tasks[0].assignee,worker);assert.equal(p.tasks[0].comments[0].text,'Keep my contribution');assert.equal(p.tasks[0].organizer,alice);
 assert.equal(p.tasks[1].assignee,'');assert.equal(p.tasks[1].status,'Not started');assert.equal(visibleState(s,worker).projects.length,0);
 assert.throws(()=>act(s,worker,{type:'group',name:'Bypass'}),/not a member/);
 assert.throws(()=>act(s,alice,{type:'groupMember',group:ga,email:worker,role:'member'}),/administrator to restore/);
 s=act(s,admin,{type:'restoreMember',email:worker});assert.equal(s.members.find(m=>m.email===worker).active,true);assert.equal(visibleState(s,worker).projects.length,0);assert.ok(!isAdmin(s,worker));
 s=act(s,alice,{type:'groupMember',group:ga,email:worker,role:'member'});assert.equal(s.members.filter(m=>m.email===worker).length,1);
});
test('workspace removal protects the final administrator and sole group managers',()=>{
 const {s}=setup();assert.throws(()=>act(s,admin,{type:'removeMember',email:admin}),/last administrator/);assert.throws(()=>act(s,admin,{type:'removeMember',email:alice}),/another group manager/);
});
test('a member with replacements may remove their own access without becoming an implicit owner administrator',()=>{
 let {s}=setup();s=act(s,admin,{type:'member',email:bob,role:'admin'});s=act(s,admin,{type:'groupMember',group:'main-group',email:bob,role:'manager'});s=act(s,admin,{type:'removeMember',email:admin});
 assert.ok(!isAdmin(s,admin));normalize(s);assert.ok(!isAdmin(s,admin));assert.equal(visibleState(s,admin).groups.length,0);assert.throws(()=>act(s,admin,{type:'restoreMember',email:admin}),/not a member/);
});
