import { bootstrapApplication } from '@angular/platform-browser';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

const groups = [
 {title:'Overview',items:[['dashboard','Dashboard','▦']]},
 {title:'People',items:[['employees','Employees','♙'],['organisation','Organisation','◇'],['recruitment','Recruitment','＋'],['onboarding','Onboarding & offboarding','☷']]},
 {title:'Workforce',items:[['register','Digital register','◷'],['attendance','Time & attendance','◴'],['leave','Leave management','□'],['payroll','Payroll & benefits','▤']]},
 {title:'Talent',items:[['performance','Performance','◎'],['learning','Learning & development','☆'],['skills','Skills passport','◇'],['tenders','Workforce & tenders','▣']]},
 {title:'HR operations',items:[['compliance','Compliance & governance','✓'],['relations','Employee relations','♧'],['assets','Asset management','▧'],['engagement','Employee engagement','♡']]},
 {title:'Intelligence',items:[['analytics','HR analytics','▥'],['assistant','AI HR assistant','✧']]},
 {title:'Administration',items:[['self-service','Employee self-service','♙'],['settings','Settings','⚙']]}
];
const demoEmployees = [
 {id:'EMP001',name:'Alex Morgan',department:'Technology',role:'Software developer',status:'Active'},
 {id:'EMP002',name:'Sam Taylor',department:'Operations',role:'Business analyst',status:'Active'},
 {id:'EMP003',name:'Jamie Patel',department:'Finance',role:'Finance officer',status:'On leave'},
 {id:'EMP004',name:'Casey Smith',department:'Technology',role:'Systems engineer',status:'Active'}
];
@Component({standalone:true,imports:[RouterLink],template:`
<div class="eyebrow">PEOPLE OPERATIONS / OVERVIEW</div>
<div class="page-head"><div><h1>HR overview</h1><p>Manage your people, workforce and daily HR operations.</p></div><a class="primary" routerLink="/employees">View employees →</a></div>
<div class="notice">Design preview · Fictional sample data. No live employee records.</div>
<div class="metrics">@for(m of metrics;track m.label){<article class="card metric"><span>{{m.label}}</span><strong>{{m.value}}</strong><small>{{m.detail}}</small></article>}</div>
<div class="dashboard-grid">
<section class="card"><div class="section-head"><h2>Today's attendance</h2><a routerLink="/register">Open register →</a></div><p class="muted">Sample workforce distribution</p>
@for(a of attendance;track a.label){<div class="bar-row"><div><span>{{a.label}}</span><b>{{a.count}}</b></div><div class="track"><div [style.width.%]="a.count*2" [style.background]="a.colour"></div></div></div>}
</section>
<section class="card"><h2>Quick actions</h2><p class="muted">Access your daily HR tasks.</p><div class="actions">@for(a of actions;track a.path){<a [routerLink]="a.path"><span>{{a.label}}</span><span>→</span></a>}</div></section>
</div>
<section class="card"><div class="section-head"><h2>People directory</h2><a routerLink="/employees">View all →</a></div><div class="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Position</th><th>Status</th></tr></thead><tbody>@for(e of employees;track e.id){<tr><td><b>{{e.name}}</b><small>{{e.id}}</small></td><td>{{e.department}}</td><td>{{e.role}}</td><td><span class="status">{{e.status}}</span></td></tr>}</tbody></table></div></section>
`})
class Dashboard {
 employees=demoEmployees;
 metrics=[{label:'Total employees',value:'50',detail:'Sample headcount'},{label:'Present today',value:'32',detail:'Sample office attendance'},{label:'Pending requests',value:'8',detail:'Awaiting review'},{label:'Open vacancies',value:'3',detail:'Recruitment pipeline'}];
 attendance=[{label:'Office',count:32,colour:'#a32f31'},{label:'Remote',count:5,colour:'#535d77'},{label:'Client site',count:4,colour:'#929bb0'},{label:'On leave',count:3,colour:'#b6a089'},{label:'Not recorded / exceptions',count:6,colour:'#c8cbd2'}];
 actions=[{label:'Open digital register',path:'/register'},{label:'Review leave requests',path:'/leave'},{label:'View skills passport',path:'/skills'},{label:'Workforce & tender readiness',path:'/tenders'}];
}
@Component({standalone:true,imports:[FormsModule],template:`
<div class="eyebrow">PEOPLE / EMPLOYEES</div><div class="page-head"><div><h1>Employees</h1><p>Browse the employee directory.</p></div></div>
<div class="notice">Fictional sample records · Read-only preview</div>
<section class="card"><label for="search">Search employees</label><input id="search" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Name, employee number or department"><div class="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Position</th><th>Status</th></tr></thead><tbody>@for(e of filtered();track e.id){<tr><td><b>{{e.name}}</b><small>{{e.id}}</small></td><td>{{e.department}}</td><td>{{e.role}}</td><td>{{e.status}}</td></tr>}@empty{<tr><td colspan="4">No matching employees.</td></tr>}</tbody></table></div></section>
`})
class Employees {
 query=signal('');
 filtered=computed(()=>demoEmployees.filter(e=>Object.values(e).join(' ').toLowerCase().includes(this.query().toLowerCase())));
}
@Component({standalone:true,template:`
<div class="eyebrow">WORKFORCE / ATTENDANCE</div><div class="page-head"><div><h1>Digital register</h1><p>Record attendance against your assigned working arrangement.</p></div></div>
<div class="notice">Simulation only · No location, network or identity verification is performed.</div>
<section class="card register"><h2>Attendance preview</h2><label for="arrangement">Work arrangement</label><select id="arrangement" [disabled]="active()" (change)="arrangement.set($any($event.target).value)"><option>Office</option><option>Remote</option><option>Client site</option></select><p class="muted">Production clock-in requires server-side workplace checks or an approved remote arrangement.</p><button class="primary" (click)="toggle()">{{active()?'End demo session':'Start demo session'}}</button><p role="status">{{message()}}</p></section>
`})
class Register {
 arrangement=signal('Office');active=signal(false);message=signal('No demo session started.');
 toggle(){this.active.update(v=>!v);this.message.set(this.active()?'Simulated session started: '+this.arrangement()+'. Attendance is not verified.':'Simulated session ended. No attendance record was saved.');}
}
@Component({standalone:true,template:`<div class="eyebrow">MATAHR / MODULES</div><h1>{{title()}}</h1><p class="muted">This module is part of the planned HR scope.</p><section class="card"><h2>Requirements review</h2><p>The workflow, permissions and data fields will be refined before implementation. This page is a navigation placeholder, not a working module.</p></section>`})
class ModulePage {
 title=toSignal(this.route.data.pipe(map(d=>String(d['title']??'Module'))),{initialValue:'Module'});
 constructor(private route:ActivatedRoute){}
}
@Component({selector:'app-root',standalone:true,imports:[RouterLink,RouterLinkActive,RouterOutlet],template:`
<div class="shell"><aside [class.open]="menu()"><a class="brand" routerLink="/dashboard"><span class="brand-mark">M</span><span><b>MATAHR</b><small>Matateni Technologies</small></span></a><div class="workspace">MATATENI · HR WORKSPACE</div><nav aria-label="Main navigation">@for(g of groups;track g.title){<div class="nav-label">{{g.title}}</div>@for(i of g.items;track i[0]){<a [routerLink]="['/',i[0]]" routerLinkActive="selected" (click)="menu.set(false)"><span class="nav-icon" aria-hidden="true">{{i[2]}}</span>{{i[1]}}</a>}}</nav></aside><div class="content"><header><button class="menu-toggle" aria-label="Toggle navigation" [attr.aria-expanded]="menu()" (click)="menu.update(v=>!v)">☰</button><span>Human Capital Management</span><span class="header-right">Design preview <span class="avatar">HR</span></span></header><main><router-outlet/></main><footer>MataHR · Matateni Technologies · Frontend prototype</footer></div></div>
`})
class App {groups=groups;menu=signal(false);}
const special=['dashboard','employees','register'];
bootstrapApplication(App,{providers:[provideRouter([{path:'',pathMatch:'full',redirectTo:'dashboard'},{path:'dashboard',component:Dashboard},{path:'employees',component:Employees},{path:'register',component:Register},...groups.flatMap(g=>g.items).filter(i=>!special.includes(i[0])).map(i=>({path:i[0],component:ModulePage,data:{title:i[1]}})),{path:'**',redirectTo:'dashboard'}])]}).catch(console.error);
