// All authorization is based on the complete stored workspace, never client state.
export const isAdmin=(s,email)=>s.members.some(m=>m.email===email&&m.active!==false&&m.admin===true);
export const groupOf=(s,id)=>s.groups?.find(g=>g.id===id);
export const inGroup=(s,email,id)=>s.members.some(m=>m.email===email&&m.active!==false)&&!!groupOf(s,id)?.members.some(m=>m.email===email);
export const managesGroup=(s,email,id)=>isAdmin(s,email)||(inGroup(s,email,id)&&!!groupOf(s,id)?.members.some(m=>m.email===email&&m.role==='manager'));
export const canCreateInGroup=(s,email,id)=>!!groupOf(s,id)&&(isAdmin(s,email)||managesGroup(s,email,id)||(inGroup(s,email,id)&&s.members.some(m=>m.email===email&&m.role==='staff')));
export const groupPeople=(s,id)=>s.members.filter(m=>m.active!==false&&inGroup(s,m.email,id));
export function canViewProject(s,email,p){
 if(!s.members.some(m=>m.email===email&&m.active!==false))return false;
 if(isAdmin(s,email))return true;
 if(!inGroup(s,email,p.groupId))return false;
 return managesGroup(s,email,p.groupId)||p.organizer===email||p.members?.includes(email)||p.tasks.some(t=>t.organizer===email||t.assignee===email)||p.issues.some(i=>i.assignee===email);
}
export const canManageProject=(s,email,p)=>canViewProject(s,email,p)&&(managesGroup(s,email,p.groupId)||p.organizer===email);
export function migrateAccess(s){
 const legacy=!s.accessVersion;
 if(legacy){
  s.groups=[{id:'existing-projects',name:'Existing projects',members:s.members.map(m=>({email:m.email,role:m.role==='staff'?'manager':'member'}))}];
  for(const m of s.members)m.admin=m.email===s.owner;
  const g=s.groups[0];if(!g.members.some(m=>m.role==='manager')&&g.members.length)g.members[0].role='manager';
  s.accessVersion=1;
 }
 s.groups??=[];
 for(const c of s.courses)c.groupId??=s.groups[0]?.id;
 for(const p of s.projects){p.groupId??=s.courses.find(c=>c.id===p.courseId)?.groupId||s.groups[0]?.id;p.members??=groupOf(s,p.groupId)?.members.map(m=>m.email)||[];}
 return s;
}
export function visibleState(s,email){
 if(!s.members.some(m=>m.email===email&&m.active!==false))return {accessVersion:s.accessVersion,members:[],groups:[],courses:[],projects:[],workflowTemplates:[],notifications:[],history:[]};
 const admin=isAdmin(s,email),projects=s.projects.filter(p=>canViewProject(s,email,p));
 const projectIds=new Set(projects.map(p=>p.id)),groups=s.groups.filter(g=>admin||inGroup(s,email,g.id));
 const groupIds=new Set(groups.map(g=>g.id)),courseIds=new Set(projects.map(p=>p.courseId));
 const people=new Set([email]);for(const g of groups)for(const m of g.members)people.add(m.email);
 // Historical participants remain identifiable only inside projects the viewer may see.
 for(const p of projects){people.add(p.organizer);for(const t of p.tasks){people.add(t.organizer);people.add(t.assignee);for(const c of t.comments)people.add(c.by);}for(const i of p.issues){people.add(i.reportedBy);people.add(i.assignee);people.add(i.verifiedBy);}}
 const members=s.members.filter(m=>admin||people.has(m.email)).map(m=>({email:m.email,name:m.name,role:m.role,admin:!!m.admin,active:m.active!==false,...(admin&&m.active===false?{removedAt:m.removedAt}:{}),...(m.email===email?{notify:m.notify}: {})}));
 return {accessVersion:s.accessVersion,...(admin?{owner:s.owner}:{}),members,groups,workflowTemplates:(s.workflowTemplates||[]).filter(t=>groupIds.has(t.groupId)),courses:s.courses.filter(c=>admin||courseIds.has(c.id)||(groupIds.has(c.groupId)&&canCreateInGroup(s,email,c.groupId))),projects,
  notifications:s.notifications.filter(n=>n.email===email&&(!n.project||projectIds.has(n.project))),
  history:s.history.filter(h=>admin||(h.project?projectIds.has(h.project):h.group?groupIds.has(h.group):false))};
}
