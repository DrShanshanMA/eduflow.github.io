import {initial,mutate} from './workflow.mjs';
export const demoEmail='alex@example.test';
export function demoState(){
 const s=initial(demoEmail);s.members[0].name='Alex Morgan';s.groups[0].name='Creative team';
 for(const [email,name] of [['sam@example.test','Sam Rivera'],['riley@example.test','Riley Chen']])mutate(s,demoEmail,{type:'member',email,name,role:'student',group:'main-group'});
 mutate(s,demoEmail,{type:'workflowTemplate',group:'main-group',category:'course-design',name:'Learning guide',steps:[{id:'plan',title:'Plan',instructions:['Agree on the audience and outcomes.'],taskTitles:['Outline learning outcomes']},{id:'build',title:'Develop',instructions:['Create the first draft.'],taskTitles:['Draft the guide']},{id:'review',title:'Review',instructions:['Check clarity and accessibility.'],taskTitles:['Review the draft']}]});
 mutate(s,demoEmail,{type:'workflowTemplate',group:'main-group',category:'general',name:'Team launch checklist',steps:[{id:'prepare',title:'Prepare',instructions:['Confirm the plan with the team.'],taskTitles:['Write a launch brief']},{id:'deliver',title:'Deliver',instructions:['Share the finished work.'],taskTitles:['Publish the final materials']}]});
 for(const [title,category] of [['First-week learning guide','course-design'],['Welcome video','digital-twin'],['Launch checklist','general']]){
  const template=s.workflowTemplates?.find(t=>t.category===category);
  mutate(s,demoEmail,{type:'create',title,category,newCourse:'Product onboarding',group:'main-group',templateId:template?.id||''});
  const p=s.projects[0];for(const t of p.tasks.filter(t=>t.stage===0))mutate(s,demoEmail,{type:'task',project:p.id,task:t.id,assignee:demoEmail});
 }
 s.history=[];s.notifications=[];return s;
}
