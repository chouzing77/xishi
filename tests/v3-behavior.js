const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../src/index.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const fields={};let serial=0;
const c={Date,console,state:{tasks:{},cats:[{id:'work'}],cfg:{}},$:id=>fields[id],key:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,parseKey:s=>new Date(s+'T00:00:00'),cursor:new Date(),timeToMinutes:s=>s.split(':').reduce((h,m)=>Number(h)*60+Number(m)),uid:()=>String(++serial),mCat:'work',mDoneValue:false,mEditing:null,mKind:'range',save(){},render(){},closeModal(){},playCompleteSound(){},toast(){},isDesktop:true,notifications:[],catById:()=>({name:'工作'}),localStorage:{setItem(){}}};
c.window={mochi:{notify:(...a)=>c.notifications.push(a)}};
vm.createContext(c);
vm.runInContext(html.slice(html.indexOf('function addTask(){'),html.indexOf('function deleteEditing(){')),c);
vm.runInContext(html.slice(html.indexOf('function checkRemind(){'),html.indexOf('let audioCtx=null')),c);
function fill(mode,endDate){for(const [id,value] of Object.entries({mTitle:'测试',mDate:'2026-09-22',mTime:'23:00',mEnd:'23:30',mSchedule:mode,mUntil:endDate,mReminder:'15',mReminderMinutes:'15'}))fields[id]={value};}
fill('daily','2026-09-24');c.addTask();assert.equal(Object.keys(c.state.tasks).length,3);c.state.tasks['2026-09-22'][0].done=true;assert.equal(c.state.tasks['2026-09-23'][0].done,false);
c.state.tasks={};fill('span','2026-09-23');fields.mEnd.value='01:00';c.addTask();assert.equal(c.state.tasks['2026-09-22'][0].end,'23:59');assert.equal(c.state.tasks['2026-09-23'][0].time,'00:00');assert.equal(c.state.tasks['2026-09-23'][0].end,'01:00');assert.equal(c.state.tasks['2026-09-23'][0].reminderMinutes,null);
c.state.tasks={};fill('daily','2026-09-21');c.addTask();assert.equal(Object.keys(c.state.tasks).length,0);
const now=new Date('2026-09-22T23:55:00');c.Date=class extends Date{constructor(...a){super(...(a.length?a:[now.getTime()]));}static now(){return now.getTime();}};
c.state.tasks={'2026-09-23':[{id:'r',title:'跨午夜提前提醒',time:'00:10',reminderMinutes:15}]};c.lastReminderCheck=now.getTime()-60000;c.reminded={};c.checkRemind();assert.equal(c.notifications.length,1);c.checkRemind();assert.equal(c.notifications.length,1);
console.log('PASS: 每日生成、独立完成、跨午夜分段、非法日期拒绝、跨日期提前提醒及防重复');
