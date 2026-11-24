export const stages=['Prepare','Upload & scripts','Check & document','Resolve issues','Apply & adjust','Preview & review','Generate','Final output review'];
export const guidance=[['Follow school templates, branding and formatting policies.','Obtain instructor approval of slides before upload.','Obtain instructor scripts; proofread spelling, punctuation and clarity.','Confirm meaning-changing edits with the instructor; match scripts to slides.'],['Upload approved slides to HeyGen.','Use slide speaker notes before upload or paste into HeyGen script areas.','Verify every slide, script and their sequence.'],['Two workers review the same slides independently and record separate findings.','Check layout, readability, missing or hidden information.','Check script alignment, missing or duplicated text, typos and unintended word or sentence breaks.','Record slide numbers, descriptions and proposed corrections.'],['Reconcile findings while preserving separate reviewer records.','Correct all documented and newly identified issues.','Confirm instructional changes with the instructor.','Record corrections and verify every issue before closing it.'],['Apply agreed production strategies.','Select appropriate voice, avatar and engines.','Adjust pronunciation, pacing, pauses, volume and placement.','Keep instructional content visible and settings consistent.'],['Preview the full lecture and every transition.','Check visual settings, layout, visibility and avatar placement.','Check pronunciation, pauses, sentence breaks, glitches and volume.','Verify narration matches slides. Return to Resolve if issues remain.'],['Verify all known issues are resolved.','Record team consensus that the video is ready.','Generate using the agreed settings; attach the output link.'],['Watch each generated video in full.','Check visuals, narration, pacing, synchronization and generation glitches.','Document issues and restart at Resolve if needed.','Confirm final approval before delivery or publication.']];
export const labels=[['Prepare school-compliant slides','Record instructor slide approval','Proofread and align instructor scripts'],['Upload slides and add scripts','Verify slide and script sequence'],['Independent review A','Independent review B'],['Reconcile and correct findings','Verify all corrections'],['Apply voice, avatar and production settings'],['Review full lecture preview'],['Record team readiness consensus','Generate video and attach output'],['Review generated video in full','Approve final output']];

const ids=['twin-prepare','twin-upload','twin-review','twin-resolve','twin-adjust','twin-preview','twin-generate','twin-final'];
export const defaultSteps=stages.map((title,index)=>({id:ids[index],title,instructions:guidance[index],taskTitles:labels[index]}));
export const projectSteps=p=>p.workflow??(p.category==='digital-twin'?defaultSteps:[]);
export const hasSteps=p=>projectSteps(p).length>0;
export const correctionIndex=p=>p.category==='digital-twin'?projectSteps(p).findIndex(s=>s.id==='twin-resolve'):-1;
export const isReviewStep=(p,index)=>p.category==='digital-twin'&&['twin-preview','twin-final'].includes(projectSteps(p)[index]?.id);
export const issuesMustClose=(p,index)=>index>=(correctionIndex(p)>=0?correctionIndex(p):projectSteps(p).length-1);
export function validateSteps(input,category){
 if(!Array.isArray(input)||input.length<1||input.length>32)throw Error('Use between 1 and 32 steps.');
 const result=input.map(step=>{
  if(!step||typeof step!=='object'||typeof step.id!=='string'||!step.id.trim()||step.id.length>100)throw Error('Each step needs a unique identifier.');
  const title=String(step.title||'').trim();if(!title||title.length>120)throw Error('Give every step a name of 1–120 characters.');
  const list=(value,max)=>{if(value===undefined)return [];if(!Array.isArray(value)||value.length>100||value.some(v=>typeof v!=='string'||v.length>max))throw Error('Step details are too long or invalid.');return value.map(v=>v.trim()).filter(Boolean);};
  return {id:step.id.trim(),title,instructions:list(step.instructions,2000),taskTitles:list(step.taskTitles,200)};
 });
 if(new Set(result.map(s=>s.id)).size!==result.length)throw Error('Step identifiers must be unique.');
 if(category==='digital-twin'){
  if(result.some(step=>step.id==='twin-review'&&step.taskTitles.length<2))throw Error('Keep at least two independent review tasks in the digital twin review step.');
  const at=id=>result.findIndex(s=>s.id===id),resolve=at('twin-resolve');
  for(const review of ['twin-preview','twin-final'])if(at(review)>=0&&(resolve<0||resolve>=at(review)))throw Error('Keep Resolve issues before preview and final review.');
  for(const [before,after] of [['twin-review','twin-resolve'],['twin-preview','twin-generate'],['twin-generate','twin-final']])if(at(before)>=0&&at(after)>=0&&at(before)>=at(after))throw Error('Keep the digital twin review and generation steps in their original order.');
 }
 return result;
}
export function makeStepTasks(steps,organizer,category){return steps.flatMap((step,stage)=>step.taskTitles.map((title,index)=>({id:crypto.randomUUID(),stage,title,organizer,assignee:'',status:'Not started',comments:[],links:[],...(category==='digital-twin'&&step.id==='twin-review'&&index<2?{independentReview:index}: {})})));}
