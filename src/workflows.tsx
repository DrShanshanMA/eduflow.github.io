'use client';
import {useState} from 'react';
import {categories,projectSteps} from '../lib/workflow.mjs';
import {defaultSteps} from '../lib/steps.mjs';
import {managesGroup} from '../lib/access.mjs';
type Action=(action:any)=>Promise<boolean>;
export function WorkflowEditor({s,p,group,category,act,busy,close}:{s:any,p?:any,group?:string,category?:string,act:Action,busy:boolean,close:()=>void}){
 const project=!!p,targetGroup=p?.groupId||group,targetCategory=p?.category||category;
 const previous=p?projectSteps(p):[];
 const template=s.workflowTemplates?.find((t:any)=>t.groupId===targetGroup&&t.category===targetCategory);
 const initial=previous.length?previous:template?.steps||(targetCategory==='digital-twin'?defaultSteps:[{id:crypto.randomUUID(),title:'',instructions:[],taskTitles:[]}]);
 const [steps,setSteps]=useState<any[]>(()=>structuredClone(initial)),[confirmRestart,setConfirmRestart]=useState(false);
 const structural=project&&JSON.stringify(previous.map((x:any)=>x.id))!==JSON.stringify(steps.map(x=>x.id));
 const restart=structural&&(p.stage>0||p.tasks.some((t:any)=>t.status!=='Not started'));
 function update(index:number,key:string,value:any){setSteps(steps.map((step,i)=>i===index?{...step,[key]:value}:step))}
 function move(index:number,offset:number){const next=[...steps];[next[index],next[index+offset]]=[next[index+offset],next[index]];setSteps(next)}
 return <form className="stack projectform" onSubmit={async e=>{e.preventDefault();if(await act(project?{type:'workflow',project:p.id,steps,confirmRestart}:{type:'workflowTemplate',group:targetGroup,category:targetCategory,steps}))close()}}>
 <p className="muted">{project?'Customize the sequence for this project. Renaming steps and editing instructions preserves progress. Changing the sequence archives progress and restarts the tasks; comments, links and assignments stay.':'Save a reusable workflow for this category in this group. New projects can use it; existing projects keep their own steps.'}</p>
 <p className="hint">{s.groups.find((g:any)=>g.id===targetGroup)?.name} · {categories.find(c=>c.id===targetCategory)?.name}{p?" · "+p.title:""}</p>
 <div className="workflowpreview" aria-label="Workflow preview">{steps.map((step,i)=><span key={step.id}>{i+1}. {step.title||'Untitled step'}{i<steps.length-1?' →':''}</span>)}</div>
 {steps.map((step,index)=>{const oldIndex=previous.findIndex((x:any)=>x.id===step.id),existing=project&&oldIndex>=0,populated=existing&&p.tasks.some((t:any)=>t.stage===oldIndex);return <section className="stepedit" key={step.id}><div className="sectionhead"><h3>Step {index+1}</h3><div className="stepbuttons"><button type="button" aria-label={'Move step '+(index+1)+' up'} disabled={index===0} onClick={()=>move(index,-1)}>↑</button><button type="button" aria-label={'Move step '+(index+1)+' down'} disabled={index===steps.length-1} onClick={()=>move(index,1)}>↓</button><button type="button" aria-label={'Remove step '+(index+1)} disabled={steps.length===1||populated} onClick={()=>setSteps(steps.filter((_,i)=>i!==index))}>Remove</button></div></div>
 <label>Step name<input aria-label={'Step '+(index+1)+' name'} value={step.title} onChange={e=>update(index,'title',e.target.value)} required maxLength={120} placeholder="e.g., Plan, Develop, Review, Deliver"/></label>
 <label>Instructions / checklist · one item per line<textarea aria-label={'Step '+(index+1)+' instructions'} value={step.instructions.join('\n')} onChange={e=>update(index,'instructions',e.target.value.split('\n'))} placeholder="What should the team check or accomplish?"/></label>
 {!existing&&<label>Default subtasks · one per line (optional)<textarea aria-label={'Step '+(index+1)+' default tasks'} value={step.taskTitles.join('\n')} onChange={e=>update(index,'taskTitles',e.target.value.split('\n'))} placeholder="Tasks to create when this step is added"/></label>}
 {populated&&<p className="hint">This step contains tasks and cannot be removed. Rename or reorder it; existing task records are retained.</p>}</section>})}
 <button type="button" onClick={()=>setSteps([...steps,{id:crypto.randomUUID(),title:'',instructions:[],taskTitles:[]}])} disabled={steps.length>=32}>＋ Add step</button>
 <p className="hint">Steps advance when every assigned subtask in the active step is complete. An empty step requires approval from a manager or organizer. Use “Return to step” for corrections.</p>
 {restart&&<label className="restartconsent"><input type="checkbox" checked={confirmRestart} onChange={e=>setConfirmRestart(e.target.checked)} required/> I understand that changing the sequence will archive current progress and reset task statuses to Step 1.</label>}
 <div className="modalactions"><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={busy}>{project?'Save project steps':'Save category workflow'}</button></div>
 </form>
}
export function WorkflowTemplates({s,email,open}:{s:any,email:string,open:(modal:any)=>void}){
 const [group,setGroup]=useState(s.groups[0]?.id||'');const manager=!!group&&managesGroup(s,email,group);
 return <><section className="panel"><h2>Category workflows</h2><p className="muted">Create a reusable set of steps for each project category in your private group. Project organizers can customize their project separately.</p><label>Group<select aria-label="Workflow template group" value={group} onChange={e=>setGroup(e.target.value)}>{s.groups.map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>{!s.groups.length&&<p className="muted">Join or create a group before configuring category workflows.</p>}</section>
 <div className="templategrid">{categories.map(category=>{const saved=s.workflowTemplates?.find((t:any)=>t.groupId===group&&t.category===category.id),steps=saved?.steps||(category.id==='digital-twin'?defaultSteps:[]);return <section className="panel" key={category.id}><h2>{category.name}</h2><p className="muted">{saved?'Saved group workflow':steps.length?'Built-in workflow':'No category workflow yet'}</p>{steps.length?<ol className="templatesteps">{steps.map((step:any)=><li key={step.id}>{step.title}</li>)}</ol>:<p className="muted">Projects start with a task list until steps are configured.</p>}{manager&&<button onClick={()=>open({type:'workflowTemplate',group,category:category.id})}>{saved?'Edit category workflow':'Configure category workflow'}</button>}</section>})}</div></>
}
