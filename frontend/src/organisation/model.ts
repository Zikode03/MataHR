import type {ChartPoint,ChartArrangement} from './data';
import type {Org} from '../Organisation';
import type {RecordRow} from '../data';
import {today} from '../operations/model';
export type ChartPerson={id:string;name:string;number:string;title:string;department:string;departmentId:string;branch:string;branchId:string;manager:string;context:boolean;needsManager:boolean;reports:number};
export type ChartNode=ChartPerson&{x:number;y:number};
export type ChartEdge={from:string;to:string;path:string;bend:ChartPoint};
export const CARD_WIDTH=236,CARD_HEIGHT=158,COMPANY_WIDTH=280,COMPANY_HEIGHT=84;
const GAP_X=30,GAP_Y=68,PADDING=36;
export function currentPeople(employees:RecordRow[]){return employees.filter(e=>e.status!=='Exited'&&(!e.values[5]||e.values[5]<=today()));}
export function descendants(assignments:Org['assignments'],employee:string){const result=new Set<string>(),queue=[employee];while(queue.length){const manager=queue.shift()!;for(const row of assignments)if(row.manager===manager&&row.employee!==employee&&!result.has(row.employee)){result.add(row.employee);queue.push(row.employee);}}return result;}
export function assignPerson(org:Org,employees:RecordRow[],employee:string,position:string,manager:string):Org{
 const people=currentPeople(employees),person=people.find(e=>e.id===employee),role=org.positions.find(p=>p.id===position);
 if(!person||!role||!org.departments.some(d=>d.id===role.department))throw new Error('Choose a current employee and a position linked to a department.');
 if(manager===employee||descendants(org.assignments,employee).has(manager))throw new Error('An employee cannot report to themselves or to someone in their own team.');
 if(manager&&(!people.some(e=>e.id===manager)||!org.assignments.some(a=>a.employee===manager&&org.positions.some(p=>p.id===a.position&&org.departments.some(d=>d.id===p.department)))))throw new Error('Place the reporting manager on the chart first, or choose top level.');
 const seen=new Set<string>();let cursor=manager;while(cursor){if(cursor===employee||seen.has(cursor))throw new Error('This reporting line would create a cycle.');seen.add(cursor);cursor=org.assignments.find(a=>a.employee===cursor)?.manager??'';}
 const existing=org.assignments.filter(a=>a.employee===employee);if(existing.length===1&&existing[0].position===position&&existing[0].manager===manager)return org;
 return {...org,assignments:[...org.assignments.filter(a=>a.employee!==employee),{employee,position,manager}]};
}
export function removePerson(org:Org,employees:RecordRow[],employee:string,replacement:string):Org{
 if(!org.assignments.some(a=>a.employee===employee))throw new Error('This employee is not on the chart.');
 if(replacement===employee||descendants(org.assignments,employee).has(replacement))throw new Error('Choose a replacement manager outside the employee’s team.');
 if(replacement&&(!currentPeople(employees).some(e=>e.id===replacement)||!org.assignments.some(a=>a.employee===replacement&&org.positions.some(p=>p.id===a.position&&org.departments.some(d=>d.id===p.department)))))throw new Error('Choose a manager already placed on the chart.');
 return {...org,assignments:org.assignments.filter(a=>a.employee!==employee).map(a=>a.manager===employee?{...a,manager:replacement}:a)};
}
export function createChartPosition(org:Org,name:string,department:string){const clean=name.trim();if(!clean||!org.departments.some(d=>d.id===department))throw new Error('Enter a job title and choose its department.');if(org.positions.some(p=>p.department===department&&p.name.toLowerCase()===clean.toLowerCase()))throw new Error('This position already exists in the department.');const role={id:crypto.randomUUID(),name:clean,department};return {org:{...org,positions:[...org.positions,role]},position:role};}
export function connectorPath(parent:{x:number;y:number;width:number;height:number},child:{x:number;y:number;width:number;height:number}){
 if(child.y>=parent.y+parent.height+12){const x1=parent.x+parent.width/2,y1=parent.y+parent.height,x2=child.x+child.width/2,y2=child.y,middle=(y1+y2)/2;return `M ${x1} ${y1} V ${middle} H ${x2} V ${y2}`;}
 if(parent.y>=child.y+child.height+12){const x1=parent.x+parent.width/2,y1=parent.y,x2=child.x+child.width/2,y2=child.y+child.height,middle=(y1+y2)/2;return `M ${x1} ${y1} V ${middle} H ${x2} V ${y2}`;}
 const right=child.x+child.width/2>=parent.x+parent.width/2,x1=right?parent.x+parent.width:parent.x,y1=parent.y+parent.height/2,x2=right?child.x:child.x+child.width,y2=child.y+child.height/2,middle=(x1+x2)/2;return `M ${x1} ${y1} H ${middle} V ${y2} H ${x2}`;
}
export type ChartOptions={query?:string;department?:string;branch?:string;focus?:string;collapsed?:Set<string>};
export function chartLayout(org:Org,employees:RecordRow[],options:ChartOptions={}){
 const people=currentPeople(employees),issues:string[]=[],assigned=new Map<string,Org['assignments'][number]>();
 for(const row of org.assignments){if(!people.some(e=>e.id===row.employee))continue;if(assigned.has(row.employee)){issues.push('Duplicate reporting assignments need review.');continue;}if(!org.positions.some(p=>p.id===row.position&&org.departments.some(d=>d.id===p.department))){issues.push('An employee has an unavailable position or department and needs placing again.');continue;}assigned.set(row.employee,row);}
 const nodes:ChartPerson[]=[...assigned.values()].map(a=>{const employee=people.find(e=>e.id===a.employee)!,position=org.positions.find(p=>p.id===a.position)!,department=org.departments.find(d=>d.id===position.department),branch=org.branches.find(b=>b.id===department?.branch);const validManager=!a.manager||assigned.has(a.manager);if(!validManager)issues.push(`${employee.values[1]} has a manager who is not on the current chart.`);return {id:employee.id,name:employee.values[1],number:employee.values[0],title:position.name,department:department?.name??'Department unavailable',departmentId:department?.id??'',branch:branch?.name??'Branch unavailable',branchId:branch?.id??'',manager:validManager?a.manager:'',context:false,needsManager:!validManager,reports:0};});
 const byId=new Map(nodes.map(n=>[n.id,n]));
 // Cut one edge of each invalid imported cycle so the chart stays inspectable.
 for(const node of nodes){const path:string[]=[],seen=new Set<string>();let cursor:ChartPerson|undefined=node;while(cursor){if(seen.has(cursor.id)){const cycle=path.slice(path.indexOf(cursor.id)).sort(),cut=byId.get(cycle[0])!;cut.manager='';cut.needsManager=true;issues.push('A circular reporting line was found. Edit the marked employee to repair it.');break;}seen.add(cursor.id);path.push(cursor.id);cursor=byId.get(cursor.manager);}}
 for(const node of nodes)node.reports=nodes.filter(n=>n.manager===node.id).length;
 const filtered=Boolean(options.query?.trim()||options.department||options.branch),focusIds=options.focus?new Set([options.focus,...descendants(nodes.map(n=>({employee:n.id,position:'',manager:n.manager})),options.focus)]):null;
 const matches=nodes.filter(n=>(!options.department||n.departmentId===options.department)&&(!options.branch||n.branchId===options.branch)&&(!options.query?.trim()||[n.name,n.title,n.number,n.department].join(' ').toLowerCase().includes(options.query.trim().toLowerCase()))&&(!focusIds||focusIds.has(n.id)));
 const included=new Set<string>();for(const node of matches){let cursor:ChartPerson|undefined=node;while(cursor&&!included.has(cursor.id)){included.add(cursor.id);cursor=byId.get(cursor.manager);}}
 const matchedIds=new Set(matches.map(n=>n.id));
 let visible=nodes.filter(n=>included.has(n.id)).map(n=>({...n,context:!matchedIds.has(n.id)}));
 if(!filtered&&options.collapsed?.size)visible=visible.filter(n=>{let parent=byId.get(n.manager);while(parent){if(options.collapsed!.has(parent.id))return false;parent=byId.get(parent.manager);}return true;});
 const sort=(a:ChartPerson,b:ChartPerson)=>org.departments.findIndex(d=>d.id===a.departmentId)-org.departments.findIndex(d=>d.id===b.departmentId)||a.name.localeCompare(b.name);
 const children=(id:string)=>visible.filter(n=>n.manager===id).sort(sort);
 const roots=visible.filter(n=>!visible.some(p=>p.id===n.manager)).sort(sort),widths=new Map<string,number>();
 function measure(node:ChartPerson):number{const reports=children(node.id),width=Math.max(CARD_WIDTH,reports.reduce((total,n)=>total+measure(n),0)+Math.max(0,reports.length-1)*GAP_X);widths.set(node.id,width);return width;}
 const contentWidth=roots.reduce((total,n)=>total+measure(n),0)+Math.max(0,roots.length-1)*GAP_X,width=Math.max(COMPANY_WIDTH,contentWidth)+PADDING*2;
 const positioned:ChartNode[]=[];function place(node:ChartPerson,left:number,depth:number){const subtree=widths.get(node.id)!;positioned.push({...node,x:left+subtree/2-CARD_WIDTH/2,y:PADDING+COMPANY_HEIGHT+GAP_Y+depth*(CARD_HEIGHT+GAP_Y)});const reports=children(node.id),groupWidth=reports.reduce((sum,n)=>sum+widths.get(n.id)!,0)+Math.max(0,reports.length-1)*GAP_X;let x=left+(subtree-groupWidth)/2;for(const child of reports){place(child,x,depth+1);x+=widths.get(child.id)!+GAP_X;}}
 let left=(width-contentWidth)/2;for(const root of roots){place(root,left,0);left+=widths.get(root.id)!+GAP_X;}
 const company={x:org.chartLayout?.company.x??(width-COMPANY_WIDTH)/2,y:org.chartLayout?.company.y??PADDING,width:COMPANY_WIDTH,height:COMPANY_HEIGHT};
 for(const node of positioned){const custom=org.chartLayout?.positions[node.id];if(custom&&Number.isFinite(custom.x)&&Number.isFinite(custom.y)){node.x=Math.max(0,custom.x);node.y=Math.max(0,custom.y);}}
 const edges:ChartEdge[]=positioned.map(node=>{const parent=positioned.find(p=>p.id===node.manager),from=parent?.id??'company',a=parent?{x:parent.x,y:parent.y,width:CARD_WIDTH,height:CARD_HEIGHT}:company,b={x:node.x,y:node.y,width:CARD_WIDTH,height:CARD_HEIGHT},saved=org.chartLayout?.routes?.[node.id],custom=saved?.manager===from&&Number.isFinite(saved.point.x)&&Number.isFinite(saved.point.y)?saved.point:null,bend=custom??connectorBend(connectorPath(a,b));return {from,to:node.id,bend,path:custom?`M ${a.x+a.width/2} ${a.y+a.height} V ${bend.y} H ${bend.x} V ${b.y-20} H ${b.x+b.width/2} V ${b.y}`:connectorPath(a,b)};});
 return {nodes:positioned,edges,company,width:Math.max(width,company.x+COMPANY_WIDTH+PADDING,...edges.map(e=>e.bend.x+PADDING),...positioned.map(n=>n.x+CARD_WIDTH+PADDING)),height:Math.max(300,company.y+COMPANY_HEIGHT+PADDING,...edges.map(e=>e.bend.y+PADDING),...positioned.map(n=>n.y+CARD_HEIGHT+PADDING)),roots:roots.map(n=>n.id),total:nodes.length,matching:matches.length,filtered,unassigned:people.filter(e=>!assigned.has(e.id)),issues:[...new Set(issues)]};
}
function escapeXml(value:string){return value.replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!));}
export function chartSvg(layout:ReturnType<typeof chartLayout>,companyName:string){const esc=escapeXml,short=(text:string,max=33)=>esc(text.length>max?text.slice(0,max-1)+'…':text);return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height+36}" viewBox="0 0 ${layout.width} ${layout.height+36}"><title>${esc(companyName)} organisation chart</title><rect width="100%" height="100%" fill="#f8f9fb"/><g fill="none" stroke="#bfc8d5" stroke-width="2">${layout.edges.map(e=>`<path d="${e.path}"/>`).join('')}</g><g font-family="Segoe UI,Arial,sans-serif"><rect x="${layout.company.x}" y="${layout.company.y}" width="${COMPANY_WIDTH}" height="${COMPANY_HEIGHT}" rx="12" fill="#22273a"/><text x="${layout.company.x+COMPANY_WIDTH/2}" y="${layout.company.y+35}" text-anchor="middle" font-size="16" font-weight="600" fill="white">${short(companyName,30)}</text><text x="${layout.company.x+COMPANY_WIDTH/2}" y="${layout.company.y+59}" text-anchor="middle" font-size="11" fill="#c9cfdc">Organisational structure</text>${layout.nodes.map(n=>`<g><title>${esc(n.name+' · '+n.title+' · '+n.department)}</title><rect x="${n.x}" y="${n.y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="10" fill="white" stroke="${n.context?'#d2d8e3':'#ac6870'}"/><rect x="${n.x+1}" y="${n.y+1}" width="${CARD_WIDTH-2}" height="4" rx="2" fill="#a32f31"/><text x="${n.x+16}" y="${n.y+35}" font-size="13" font-weight="600" fill="#263046">${short(n.name,28)}</text><text x="${n.x+16}" y="${n.y+62}" font-size="12" fill="#5f6d82">${short(n.title)}</text><text x="${n.x+16}" y="${n.y+86}" font-size="11" fill="#8f4d58">${short(n.department)}</text><text x="${n.x+16}" y="${n.y+111}" font-size="10" fill="#7a8799">${short(n.branch+' · '+n.number)}</text><text x="${n.x+16}" y="${n.y+139}" font-size="10" fill="#6b788c">${n.reports} direct report${n.reports===1?'':'s'}${n.context?' · Management context':''}</text></g>`).join('')}<text x="36" y="${layout.height+17}" font-size="10" fill="#7a8799">Visible chart · ${esc(today())} · ${layout.nodes.length} employees</text></g></svg>`;}


export function arrangementSnapshot(org:Org,employees:RecordRow[],visible?:ReturnType<typeof chartLayout>):ChartArrangement{
 const full=chartLayout(org,employees);
 return {routes:org.chartLayout?.routes,positions:Object.fromEntries([...full.nodes,...(visible?.nodes??[])].map(node=>[node.id,{x:node.x,y:node.y}])),company:{x:(visible??full).company.x,y:(visible??full).company.y}};
}
export function pointerToChart(client:ChartPoint,frame:{left:number;top:number;scrollLeft:number;scrollTop:number},zoom:number):ChartPoint{
 if(!Number.isFinite(zoom)||zoom<=0)throw new Error('Invalid chart zoom.');
 return {x:(client.x-frame.left+frame.scrollLeft)/zoom,y:(client.y-frame.top+frame.scrollTop)/zoom};
}
export function moveChartPerson(org:Org,employees:RecordRow[],employee:string,target:ChartPoint,moveTeam=false,snap=0):Org{
 if(!Number.isFinite(target.x)||!Number.isFinite(target.y))throw new Error('Choose a valid canvas position.');
 const layout=chartLayout(org,employees),source=layout.nodes.find(n=>n.id===employee);if(!source)throw new Error('Place this employee on the chart first.');
 const arrangement=arrangementSnapshot(org,employees),ids=new Set([employee,...(moveTeam?[...descendants(org.assignments,employee)]:[])]),group=layout.nodes.filter(n=>ids.has(n.id));
 const x=snap>0?Math.round(target.x/snap)*snap:target.x,y=snap>0?Math.round(target.y/snap)*snap:target.y;
 const dx=Math.max(x-source.x,16-Math.min(...group.map(n=>n.x))),dy=Math.max(y-source.y,16-Math.min(...group.map(n=>n.y)));
 for(const node of group)arrangement.positions[node.id]={x:node.x+dx,y:node.y+dy};
 return {...org,chartLayout:arrangement};
}
export function chartDropTarget(layout:ReturnType<typeof chartLayout>,point:ChartPoint,source=''):string|null{
 const hit=(x:number,y:number,width:number,height:number)=>point.x>=x&&point.x<=x+width&&point.y>=y&&point.y<=y+height;
 for(const node of layout.nodes.slice().reverse())if(node.id!==source&&hit(node.x,node.y,CARD_WIDTH,CARD_HEIGHT))return node.id;
 if(hit(layout.company.x,layout.company.y,COMPANY_WIDTH,COMPANY_HEIGHT))return 'company';return null;
}
export function inferChartPosition(org:Org,employees:RecordRow[],employee:string){const person=employees.find(e=>e.id===employee);if(!person)return '';return org.positions.find(p=>p.name.toLowerCase()===person.values[3].toLowerCase()&&org.departments.find(d=>d.id===p.department)?.name.toLowerCase()===person.values[2].toLowerCase())?.id??'';}
export function placeUnderManager(org:Org,employees:RecordRow[],employee:string,position:string,manager:string):Org{
 const next=assignPerson(org,employees,employee,position,manager),layout=chartLayout(next,employees),source=layout.nodes.find(n=>n.id===employee)!;
 const groupIds=new Set([employee,...descendants(next.assignments,employee)]),group=layout.nodes.filter(n=>groupIds.has(n.id)),others=layout.nodes.filter(n=>!groupIds.has(n.id));
 const parent=layout.nodes.find(n=>n.id===manager),root=layout.company;
 let point={x:parent?parent.x:root.x+(COMPANY_WIDTH-CARD_WIDTH)/2,y:(parent?parent.y+CARD_HEIGHT:root.y+COMPANY_HEIGHT)+GAP_Y};
 const minX=Math.min(...group.map(n=>n.x)),minY=Math.min(...group.map(n=>n.y));const collides=(candidate:ChartPoint)=>group.some(node=>{const x=node.x+Math.max(candidate.x-source.x,16-minX),y=node.y+Math.max(candidate.y-source.y,16-minY);return others.some(other=>x<other.x+CARD_WIDTH+16&&x+CARD_WIDTH+16>other.x&&y<other.y+CARD_HEIGHT+16&&y+CARD_HEIGHT+16>other.y);});
 let tries=0;while(collides(point)&&tries++<Math.max(20,others.length*3))point={...point,x:point.x+CARD_WIDTH+GAP_X};
 return moveChartPerson(next,employees,employee,point,true);
}
export type ChartUndo={assignments:Org['assignments'];chartLayout:Org['chartLayout']};
export function chartUndoSnapshot(org:Org):ChartUndo{return {assignments:org.assignments.map(a=>({...a})),chartLayout:org.chartLayout?{routes:org.chartLayout.routes?Object.fromEntries(Object.entries(org.chartLayout.routes).map(([id,r])=>[id,{manager:r.manager,point:{...r.point}}])):undefined,company:{...org.chartLayout.company},positions:Object.fromEntries(Object.entries(org.chartLayout.positions).map(([id,p])=>[id,{...p}]))}:undefined};}
export function restoreChartEdit(org:Org,previous:ChartUndo):Org{return {...org,assignments:previous.assignments.map(a=>({...a})),chartLayout:previous.chartLayout};}

export function connectChartPeople(org:Org,employees:RecordRow[],manager:string,employee:string):Org{
 const position=org.assignments.find(a=>a.employee===employee)?.position;if(!position)throw new Error('Place this employee on the chart first.');
 return assignPerson({...org,chartLayout:arrangementSnapshot(org,employees)},employees,employee,position,manager==='company'?'':manager);
}
export function routeChartLine(org:Org,employees:RecordRow[],employee:string,point:ChartPoint|null):Org{
 const layout=chartLayout(org,employees),edge=layout.edges.find(e=>e.to===employee);if(!edge)throw new Error('Choose an existing reporting line.');
 const arrangement=arrangementSnapshot(org,employees),routes={...arrangement.routes};
 if(point){if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw new Error('Choose a valid line position.');routes[employee]={manager:edge.from,point:{x:Math.max(8,point.x),y:Math.max(8,point.y)}};}else delete routes[employee];
 return {...org,chartLayout:{...arrangement,routes}};
}

function connectorBend(path:string):ChartPoint{const numbers=path.match(/-?[\d.]+/g)!.map(Number);return path.split(' ')[3]==='V'?{x:(numbers[0]+numbers[3])/2,y:numbers[2]}:{x:numbers[2],y:(numbers[1]+numbers[3])/2};}
