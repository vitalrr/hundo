export type CrowdQuestion={number:number;text:string;options:readonly string[];counts:readonly number[];myChoice?:number|null};
export function crowdResult(q:CrowdQuestion){
 const total=q.counts.reduce((a,b)=>a+b,0);const max=Math.max(0,...q.counts);
 const leaders=total>0?q.options.flatMap((option,i)=>q.counts[i]===max?[option]:[]):[];
 const percent=total?Math.round(max/total*100):0;
 return {leaders,percent,text:!leaders.length?'No votes in the room.':leaders.length>1?`The crowd tied: ${leaders.map(s=>`“${s}”`).join(' / ')} — ${percent}% each.`:`Most said “${leaders[0]}” — ${percent}%.`};
}
export function personalCrowdResult(q:CrowdQuestion){
 const yours=q.myChoice==null?'You did not answer in time.':`You said “${q.options[q.myChoice]}”.`;
 return `${crowdResult(q).text} ${yours}`;
}
