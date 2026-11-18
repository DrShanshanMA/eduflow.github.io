import {canViewProject} from './access.mjs';
export function personalTasks(s,email){
 if(!s)return [];
 const result=new Map();
 for(const project of s.projects)if(canViewProject(s,email,project))for(const task of project.tasks)if(task.assignee===email||task.organizer===email)result.set(task.id,{project,task});
 return [...result.values()];
}
export function personalTaskCounts(tasks){
 const complete=tasks.filter(({task})=>task.status==='Complete').length;
 return {total:tasks.length,open:tasks.length-complete,complete};
}
