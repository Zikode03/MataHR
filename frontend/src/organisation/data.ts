export type Branch={id:string;name:string;address:string};
export type Department={id:string;name:string;branch:string};
export type Position={id:string;name:string;department:string};
export type Assignment={employee:string;position:string;manager:string};
export type ChartPoint={x:number;y:number};
export type ChartArrangement={positions:Record<string,ChartPoint>;company:ChartPoint;routes?:Record<string,{manager:string;point:ChartPoint}>};
export type Org={branches:Branch[];departments:Department[];positions:Position[];assignments:Assignment[];chartLayout?:ChartArrangement};
export const initialOrg:Org={branches:[{id:'b1',name:'Durban',address:'Sample office'}],departments:[{id:'d1',name:'Technology',branch:'b1'},{id:'d2',name:'People & Culture',branch:'b1'},{id:'d3',name:'Operations',branch:'b1'},{id:'d4',name:'Finance',branch:'b1'}],positions:[{id:'p1',name:'Developer',department:'d1'},{id:'p2',name:'HR Manager',department:'d2'},{id:'p3',name:'Product Designer',department:'d1'},{id:'p4',name:'Project Coordinator',department:'d3'},{id:'p5',name:'Accountant',department:'d4'},{id:'p6',name:'Client Services Lead',department:'d3'},{id:'p7',name:'Quality Analyst',department:'d1'},{id:'p8',name:'Finance Assistant',department:'d4'}],assignments:Array.from({length:8},(_,i)=>({employee:'employees-'+(i+1),position:'p'+(i+1),manager:i===1?'':'employees-2'}))};
