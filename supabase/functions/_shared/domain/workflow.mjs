import {isAdmin,groupOf,inGroup,managesGroup,canCreateInGroup,canViewProject,canManageProject,migrateAccess} from './access.mjs';
import {stages,guidance,labels,projectSteps,hasSteps,correctionIndex,isReviewStep,issuesMustClose,validateSteps,makeStepTasks} from './steps.mjs';
export {stages,guidance,projectSteps,hasSteps} from './steps.mjs';
export const categories=[
 {id:'course-design',name:'Course design and development',icon:'◇',description:'Plan, design and develop course materials.'},
 {id:'traditional-recording',name:'Traditional recording projects',icon:'▷',description:'Coordinate recordings, editing and delivery.'},
 {id:'digital-twin',name:'Digital twin media production',icon:'◈',description:'Produce media with the eight-step review workflow.'},
 {id:'general',name:'Customize Projects',icon:'✓',description:'Organize other course and team work.'}
];
const id=()=>crypto.randomUUID();
const memberExists=(s,email)=>s.members.some(m=>m.email===email&&m.active!==false);
const requireMember=(s,email)=>{if(!email||!memberExists(s,email))throw Error('Select a team member.');};
export const isTwin=p=>p.category==='digital-twin';
export function projectStatus(p){
 if(hasSteps(p))return p.stage>=projectSteps(p).length?'Complete':'In progress';
 if(p.tasks.length&&p.tasks.every(t=>t.assignee&&t.status==='Complete')&&!p.issues.some(i=>i.status!=='Closed'))return 'Complete';
 if(p.tasks.some(t=>t.status==='Blocked'))return 'Blocked';
 if(p.tasks.some(t=>t.status!=='Not started')||p.issues.length)return 'In progress';
 return 'Not started';
}
export function tasks(organizer=''){return labels.flatMap((a,stage)=>a.map((title,index)=>({id:id(),stage,title,organizer,assignee:'',status:'Not started',comments:[],links:[],...(stage===2?{independentReview:index}:{} )})));}
export function initial(email){return {owner:email,accessVersion:1,members:[{email,name:email.split('@')[0],role:'staff',admin:true}],groups:[{id:'main-group',name:'Main group',members:[{email,role:'manager'}]}],courses:[],projects:[],notifications:[],history:[]};}
export function normalize(s){
 s.courses??=[];s.workflowTemplates??=[];
 for(const template of s.workflowTemplates)template.name??=(categories.find(c=>c.id===template.category)?.name||'Category')+' workflow';
 for(const p of s.projects){
  p.category??='digital-twin';
  if(!p.courseId){if(!s.courses.some(c=>c.id==='unassigned-course'))s.courses.push({id:'unassigned-course',name:'Unassigned course'});p.courseId='unassigned-course';}
  for(const t of p.tasks){t.organizer??=p.organizer;if(p.category==='digital-twin'&&projectSteps(p)[t.stage]?.id==='twin-review'&&t.independentReview===undefined){if(t.title==='Independent review A')t.independentReview=0;if(t.title==='Independent review B')t.independentReview=1;}}
 }
 return migrateAccess(s);
}
export function mutate(s,actor,a){
 normalize(s);
 const member=s.members.find(m=>m.email===actor&&m.active!==false);if(!member)throw Error('You are not a member of this workflow.');
 const admin=isAdmin(s,actor);const needAdmin=()=>{if(!admin)throw Error('Workspace administrator access required.');};
 const requireGroupPerson=(group,email)=>{requireMember(s,email);if(!inGroup(s,email,group))throw Error('Select a member of this project’s group.');};
 const requireCreate=group=>{if(!canCreateInGroup(s,actor,group))throw Error('You cannot create or edit courses and projects in this group.');};
 const log=(text,p,group)=>s.history.unshift({id:id(),at:new Date().toISOString(),actor,text,...(p?{project:p.id,group:p.groupId}:group?{group}: {})});
 const notify=(p,text,extra=[])=>{const recipients=new Set([p.organizer,...extra,...s.members.filter(m=>(m.admin||managesGroup(s,m.email,p.groupId))&&m.notify!==false).map(m=>m.email)]);for(const email of recipients)if(email&&canViewProject(s,email,p))s.notifications.unshift({id:id(),email,text,project:p.id,at:new Date().toISOString(),read:false});};
 const courseFor=(courseId,newCourse,group)=>{
  if(!groupOf(s,group))throw Error('Choose a group.');
  const name=String(newCourse||'').trim();
  if(name){let c=s.courses.find(c=>c.groupId===group&&c.name.toLowerCase()===name.toLowerCase());if(!c){c={id:id(),name,groupId:group};s.courses.push(c);}return c.id;}
  if(courseId){let c=s.courses.find(c=>c.id===courseId&&c.groupId===group);if(!c)throw Error('Select a course in this group.');return c.id;}
  let c=s.courses.find(c=>c.groupId===group&&c.name==='Unassigned course');if(!c){c={id:s.courses.some(c=>c.id==='unassigned-course')?id():'unassigned-course',name:'Unassigned course',groupId:group};s.courses.push(c);}return c.id;
 };
 const removeFromGroup=(g,email)=>{
  g.members=g.members.filter(m=>m.email!==email);const fallback=g.members.find(m=>m.role==='manager')?.email;
  for(const p of s.projects.filter(p=>p.groupId===g.id)){p.members=p.members.filter(e=>e!==email);if(p.organizer===email)p.organizer=fallback;
   for(const t of p.tasks){if(t.organizer===email)t.organizer=p.organizer;if(t.assignee===email&&t.status!=='Complete'){t.assignee='';t.status='Not started';}}
   for(const i of p.issues)if(i.assignee===email&&i.status!=='Closed')i.assignee='';
  }
 };
 if(a.type==='removeMember'){
  needAdmin();const email=String(a.email||'').trim().toLowerCase();const target=s.members.find(m=>m.email===email&&m.active!==false);if(!target)throw Error('Active member not found.');
  if(target.admin&&s.members.filter(m=>m.admin&&m.active!==false).length===1)throw Error('Assign another workspace administrator before removing the last administrator.');
  const soleManaged=s.groups.find(g=>g.members.some(m=>m.email===email&&m.role==='manager')&&g.members.filter(m=>m.role==='manager').length===1);
  if(soleManaged)throw Error('Assign another group manager for “'+soleManaged.name+'” before removing this member.');
  for(const g of s.groups)if(g.members.some(m=>m.email===email))removeFromGroup(g,email);
  target.active=false;target.admin=false;target.removedAt=new Date().toISOString();target.removedBy=actor;
  log('Removed workspace member: '+email);return s;
 }
 if(a.type==='restoreMember'){
  needAdmin();const target=s.members.find(m=>m.email===a.email&&m.active===false);if(!target)throw Error('Removed member not found.');
  target.active=true;target.admin=false;target.role='student';delete target.removedAt;delete target.removedBy;
  log('Restored workspace member without group access: '+target.email);return s;
 }
 if(a.type==='member'){
  needAdmin();const email=String(a.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email.');
  if(!['admin','staff','student'].includes(a.role))throw Error('Choose a valid workspace role.');
  let m=s.members.find(m=>m.email===email);const nextAdmin=a.role==='admin';
  if(m?.admin&&!nextAdmin&&s.members.filter(m=>m.admin&&m.active!==false).length===1)throw Error('Assign another workspace administrator before removing the last administrator.');
  if(m){m.name=String(a.name||email);m.role=a.role==='student'?'student':'staff';m.admin=nextAdmin;m.active=true;delete m.removedAt;delete m.removedBy;}
  else s.members.push({email,name:String(a.name||email),role:a.role==='student'?'student':'staff',admin:nextAdmin});
  if(a.group){const g=groupOf(s,a.group);if(!g)throw Error('Group not found.');if(!g.members.some(m=>m.email===email))g.members.push({email,role:'member'});}
  log('Updated workspace role: '+email);return s;
 }
 if(a.type==='group'){
  let g=a.group?groupOf(s,a.group):null;const name=String(a.name||'').trim();if(!name)throw Error('Enter a group name.');
  if(a.group){if(!g||!managesGroup(s,actor,g.id))throw Error('Group manager access required.');g.name=name;}
  else{g={id:id(),name,members:[{email:actor,role:'manager'}]};s.groups.push(g);}
  log('Saved group: '+name,undefined,g.id);return s;
 }
 if(a.type==='groupMember'){
  const g=groupOf(s,a.group);if(!g||!managesGroup(s,actor,g.id))throw Error('Group manager access required.');
  const email=String(a.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email.');
  const existing=g.members.find(m=>m.email===email);
  if(existing?.role==='manager'&&(a.remove||a.role!=='manager')&&g.members.filter(m=>m.role==='manager').length===1)throw Error('Assign another group manager before removing the last manager.');
  if(a.remove){
   removeFromGroup(g,email);
  }else{
   if(!['manager','member'].includes(a.role))throw Error('Choose a group role.');
   if(s.members.some(m=>m.email===email&&m.active===false))throw Error('This member was removed from the workspace. Ask an administrator to restore access.');
   if(!memberExists(s,email))s.members.push({email,name:String(a.name||email),role:'student',admin:false});
   if(existing)existing.role=a.role;else g.members.push({email,role:a.role});
  }
  log((a.remove?'Removed group member: ':'Updated group member: ')+email,undefined,g.id);return s;
 }
 if(a.type==='preference'){member.notify=!!a.notify;return s;}
 if(a.type==='read'){s.notifications.filter(n=>n.email===actor).forEach(n=>n.read=true);return s;}
 if(a.type==='course'){
  const existing=a.course?s.courses.find(c=>c.id===a.course):null;
  if(a.course&&!existing)throw Error('Course not found or access denied.');
  const group=existing?.groupId||a.group;requireCreate(group);const name=String(a.name||'').trim();if(!name)throw Error('Enter a course name.');
  if(existing){if(s.courses.some(c=>c.groupId===group&&c.id!==existing.id&&c.name.toLowerCase()===name.toLowerCase()))throw Error('A course with this name already exists in this group.');existing.name=name;}
  else courseFor('',name,group);
  log('Saved course: '+name,undefined,group);return s;
 }
 if(a.type==='workflowTemplate'){
  if(!groupOf(s,a.group)||!managesGroup(s,actor,a.group))throw Error('Group manager access required to save category workflows.');
  if(!categories.some(c=>c.id===a.category))throw Error('Select a project category.');
  const existing=a.templateId?s.workflowTemplates.find(t=>t.id===a.templateId&&t.groupId===a.group&&t.category===a.category):a.name===undefined?s.workflowTemplates.find(t=>t.groupId===a.group&&t.category===a.category):null;
  if(a.templateId&&!existing)throw Error('Workflow template not found or access denied.');
  const name=String(a.name??existing?.name??(categories.find(c=>c.id===a.category).name+' workflow')).trim();
  if(!name||name.length>120)throw Error('Enter a template name of 1–120 characters.');
  if(s.workflowTemplates.some(t=>t.groupId===a.group&&t.category===a.category&&t.id!==existing?.id&&t.name.toLowerCase()===name.toLowerCase()))throw Error('A template with this name already exists in this category.');
  const steps=validateSteps(a.steps,a.category),values={name,steps,updatedBy:actor,updatedAt:new Date().toISOString()};
  if(existing)Object.assign(existing,values);else s.workflowTemplates.push({id:id(),groupId:a.group,category:a.category,...values});
  log('Saved workflow template: '+name,undefined,a.group);return s;
 }
 if(a.type==='create'){

  if(!String(a.title||'').trim())throw Error('Enter a project name.');
  let category=a.category||'digital-twin';if(!categories.some(c=>c.id===category))throw Error('Select a project category.');
  if(a.category&&!a.course&&!String(a.newCourse||'').trim())throw Error('Choose a course or enter a new course name.');
  const group=a.group||s.courses.find(c=>c.id===a.course)?.groupId||s.groups.find(g=>canCreateInGroup(s,actor,g.id))?.id;requireCreate(group);
  let organizer=a.organizer||actor;requireGroupPerson(group,organizer);
  let p={id:id(),title:String(a.title).trim(),category,groupId:group,members:[...new Set([actor,organizer])].filter(e=>inGroup(s,e,group)),courseId:courseFor(a.course,a.newCourse,group),organizer,stage:0,cycle:1,tasks:category==='digital-twin'?tasks(organizer):[],issues:[],archives:[],created:new Date().toISOString()};
  const template=Object.hasOwn(a,'templateId')?(a.templateId?s.workflowTemplates.find(t=>t.id===a.templateId&&t.groupId===group&&t.category===category):null):a.useTemplate!==false&&s.workflowTemplates.find(t=>t.groupId===group&&t.category===category);
  if(a.templateId&&!template)throw Error('Workflow template not found for this group and category.');
  if(template){p.templateId=template.id;p.templateName=template.name;p.workflow=structuredClone(template.steps);p.tasks=makeStepTasks(p.workflow,organizer,category);}
  s.projects.unshift(p);log('Created project: '+p.title,p);notify(p,'New project: '+p.title);return s;
 }
 let p=s.projects.find(p=>p.id===a.project);if(!p||!canViewProject(s,actor,p))throw Error('Project not found or access denied.');
 const twin=isTwin(p),stepped=hasSteps(p),steps=projectSteps(p),canManage=canManageProject(s,actor,p);
 const needManager=()=>{if(!canManage)throw Error('Staff with group management access or the current project organizer is required.');};
 const before=projectStatus(p);
 const archive=()=>p.archives.push({at:new Date().toISOString(),cycle:p.cycle,stage:p.stage,tasks:structuredClone(p.tasks),issues:structuredClone(p.issues),workflow:structuredClone(projectSteps(p))});
 if(a.type==='workflow'){
  needManager();const next=validateSteps(a.steps,p.category),previous=projectSteps(p),structural=JSON.stringify(previous.map(s=>s.id))!==JSON.stringify(next.map(s=>s.id));
  const nextIds=new Set(next.map(s=>s.id));
  if(previous.some((step,index)=>!nextIds.has(step.id)&&p.tasks.some(t=>t.stage===index)))throw Error('Steps containing tasks cannot be removed. Rename or reorder them instead.');
  if(structural&&(p.stage>0||p.tasks.some(t=>t.status!=='Not started'))&&!a.confirmRestart)throw Error('Confirm restarting progress before changing the step sequence.');
  if(structural){if(previous.length||p.tasks.length||p.issues.length){archive();p.cycle++;}for(const task of p.tasks){const oldId=previous[task.stage]?.id;task.stage=oldId?next.findIndex(step=>step.id===oldId):0;task.status='Not started';}p.stage=0;}
  const previousIds=new Set(previous.map(s=>s.id));
  for(const task of makeStepTasks(next,p.organizer,p.category))if(!previousIds.has(next[task.stage].id))p.tasks.push(task);
  p.workflow=next;log(structural?'Updated workflow sequence; progress restarted':'Updated step names and instructions',p);notify(p,'Project workflow updated: '+p.title);return s;
 }
 if(a.type==='returnToStep'){
  needManager();const target=Number(a.stage);if(!stepped||!Number.isInteger(target)||target<0||target>=steps.length||target>p.stage)throw Error('Choose a current or earlier step.');
  archive();p.cycle++;p.stage=target;for(const t of p.tasks)if(t.stage>=target)t.status='Not started';log('Returned to '+steps[target].title,p);notify(p,'Returned to '+steps[target].title+': '+p.title);return s;
 }
 if(a.type==='completeStep'){
  needManager();if(!stepped||p.stage>=steps.length)throw Error('No active workflow step.');
  if(p.tasks.some(t=>t.stage===p.stage))throw Error('Complete the assigned tasks to finish this step.');
  if(issuesMustClose(p,p.stage)&&p.issues.some(i=>i.status!=='Closed'))throw Error('Resolve and verify all open issues before finishing this step.');
  log('Approved empty step: '+steps[p.stage].title,p);p.stage++;notify(p,p.stage===steps.length?'Project complete: '+p.title:'Step complete. Now '+steps[p.stage].title+': '+p.title);return s;
 }
 if(a.type==='projectMembers'){

  needManager();if(!Array.isArray(a.members))throw Error('Select project members.');
  for(const email of a.members)requireGroupPerson(p.groupId,email);
  p.members=[...new Set([...a.members,p.organizer])];log('Updated project membership',p);
 }
 else if(a.type==='settings'){
  needManager();
  if(a.organizer!==undefined){requireGroupPerson(p.groupId,a.organizer);p.organizer=a.organizer;notify(p,'Project organizer changed: '+p.title);}
  if(a.title!==undefined){if(!String(a.title).trim())throw Error('Enter a project name.');p.title=String(a.title).trim();}
  if(a.course!==undefined||a.newCourse)p.courseId=courseFor(a.course,a.newCourse,p.groupId);
  log('Updated project settings: '+p.title,p);
 }
 else if(a.type==='restart'||a.type==='reset'){
  needManager();if(a.type==='restart'&&(!twin||correctionIndex(p)<0))throw Error('Correction cycles apply to digital twin projects with a Resolve step.');archive();p.cycle++;
  const start=a.type==='reset'?0:correctionIndex(p);p.stage=start;
  for(let t of p.tasks)if(t.stage>=start){t.status='Not started';if(a.clearAssignments)t.assignee='';}
  if(a.type==='reset')p.issues=[];
  log(a.type==='reset'?'Reset project tasks':'Restarted correction cycle at Resolve',p);notify(p,'Workflow restarted: '+p.title);
 }
 else if(a.type==='addTask'){
  needManager();let stage=stepped?Number(a.stage):0;if(!Number.isInteger(stage)||stage<0||stage>=(stepped?steps.length:1)||!String(a.title||'').trim())throw Error('Enter a task title and valid step.');
  if(stepped&&stage<p.stage)throw Error('Restart the workflow before adding tasks to completed steps.');
  const organizer=a.organizer||p.organizer;requireGroupPerson(p.groupId,organizer);if(a.assignee)requireGroupPerson(p.groupId,a.assignee);
  p.tasks.push({id:id(),stage,title:String(a.title).trim(),organizer,status:'Not started',assignee:a.assignee||'',comments:[],links:[]});log('Added subtask: '+String(a.title).trim(),p);
 }
 else if(a.type==='task'){
  let t=p.tasks.find(t=>t.id===a.task);if(!t)throw Error('Task not found.');
  const managesTask=canManage||t.organizer===actor;
  if(a.assignee!==undefined||a.organizer!==undefined||a.title!==undefined){
   if(!managesTask)throw Error('Only the project or task organizer, or staff, may manage this task.');
   if(a.organizer!==undefined){requireGroupPerson(p.groupId,a.organizer);t.organizer=a.organizer;notify(p,'Task organizer changed: '+t.title,[t.organizer]);}
   if(a.title!==undefined){if(!String(a.title).trim())throw Error('Enter a task title.');t.title=String(a.title).trim();}
   if(a.assignee!==undefined){
    if(a.assignee)requireGroupPerson(p.groupId,a.assignee);
    if(twin&&t.independentReview!==undefined&&a.assignee&&p.tasks.some(x=>x.id!==t.id&&x.independentReview!==undefined&&x.assignee===a.assignee))throw Error('Independent reviews need different reviewers.');
    if(stepped&&t.stage<p.stage&&a.assignee!==t.assignee)throw Error('Restart the workflow to change completed-step assignments.');
    if(t.status==='Complete'&&a.assignee!==t.assignee){t.status='Not started';log('Reopened task after reassignment: '+t.title,p);}
    t.assignee=a.assignee;
   }
   log('Updated task ownership: '+t.title,p);
  }
  if(a.status!==undefined||a.comment||a.link){
   if(!managesTask&&t.assignee!==actor)throw Error('Only your assigned tasks or tasks you organize can be updated.');
   if(a.status!==undefined){
    if(stepped&&t.stage!==p.stage)throw Error('Only tasks in the active step can change status.');
    if(!t.assignee)throw Error('Assign this task before changing its status.');
    if(!['Not started','In progress','Blocked','Complete'].includes(a.status))throw Error('Invalid status.');
    t.status=a.status;log(t.title+': '+a.status,p);
    if(a.status==='Blocked'||a.status==='Complete')notify(p,'Task '+a.status.toLowerCase()+': '+t.title,[t.organizer]);
   }
   if(a.comment)t.comments.push({by:actor,text:String(a.comment),at:new Date().toISOString()});
   if(a.link){let url=new URL(a.link);if(!['https:','http:'].includes(url.protocol))throw Error('Use an http or https link.');t.links.push({url:url.href,by:actor});}
  }
 }
 else if(a.type==='issue'){
  let issue=p.issues.find(i=>i.id===a.issue);
  if(issue){
   if(!canManage&&issue.assignee!==actor)throw Error('Only the organizer, staff or assigned worker may update this issue.');
   if(a.status==='Closed'&&!canManage)throw Error('The project organizer or staff must verify and close issues.');
   if(!['Open','In progress','Ready for verification','Closed'].includes(a.status))throw Error('Invalid issue status.');
   if(a.status==='Closed'&&!String(a.correction||issue.correction||'').trim())throw Error('Record the correction before verification.');
   issue.status=a.status;issue.correction=String(a.correction??issue.correction??'');
   if(a.assignee!==undefined){needManager();if(a.assignee)requireGroupPerson(p.groupId,a.assignee);issue.assignee=a.assignee;}
   if(a.status==='Closed'){issue.verifiedBy=actor;issue.verifiedAt=new Date().toISOString();}else{delete issue.verifiedBy;delete issue.verifiedAt;}
   log('Updated issue: '+issue.description,p);
   if(stepped&&issue.status!=='Closed'&&(p.stage>=steps.length||isReviewStep(p,p.stage))){archive();p.cycle++;p.stage=correctionIndex(p)>=0?correctionIndex(p):steps.length-1;p.tasks.filter(t=>t.stage>=p.stage).forEach(t=>t.status='Not started');notify(p,'Issue reopened; returned to '+steps[p.stage].title+': '+p.title);}
  }else{
   if(stepped&&p.stage>=steps.length)throw Error('Restart the workflow to report a new issue.');
   if(!canManage&&!p.tasks.some(t=>(!stepped||t.stage===p.stage)&&(t.assignee===actor||t.organizer===actor)))throw Error('You must be assigned to or organize this work.');
   if(!String(a.description||'').trim())throw Error('Describe the issue.');
   p.issues.push({id:id(),slide:String(a.slide||''),description:String(a.description),reportedBy:actor,status:'Open',assignee:'',correction:'',at:new Date().toISOString()});log('Reported issue: '+a.description,p);notify(p,'Issue reported in '+p.title);
   if(isReviewStep(p,p.stage)&&correctionIndex(p)>=0){archive();p.stage=correctionIndex(p);p.cycle++;p.tasks.filter(t=>t.stage>=p.stage).forEach(t=>t.status='Not started');notify(p,'Review found issues; returned to '+steps[p.stage].title+': '+p.title);}
  }
 }
 else throw Error('Unknown action.');
 if(stepped){
  const active=p.tasks.filter(t=>t.stage===p.stage);
  if(active.length&&active.every(t=>t.assignee&&t.status==='Complete')){
   if(issuesMustClose(p,p.stage)&&p.issues.some(i=>i.status!=='Closed'))throw Error('Resolve and verify all open issues before finishing this step.');
   p.stage++;log(p.stage===steps.length?'Project workflow complete':'Advanced to '+steps[p.stage].title,p);notify(p,p.stage===steps.length?'Project complete: '+p.title:'Step complete. Now '+steps[p.stage].title+': '+p.title);
  }
 }else if(before!==projectStatus(p)){
  log('Project status: '+projectStatus(p),p);notify(p,'Project '+projectStatus(p).toLowerCase()+': '+p.title);
 }
 s.history=s.history.slice(0,2000);s.notifications=s.notifications.slice(0,1000);return s;
}
