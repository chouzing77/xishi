const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const fields={};let serial=0,notifies=0,success=true;
const now=new Date('2026-10-18T10:00:00');
class Clock extends Date {constructor(...args){super(...(args.length?args:[now.getTime()]));}static now(){return now.getTime();}}
const c={Date:Clock,console,Set,Promise,state:{tasks:{},cats:[{id:'work'}],cfg:{}},$:id=>fields[id],key:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,parseKey:s=>new Date(s+'T00:00:00'),cursor:now,timeToMinutes:s=>s.split(':').reduce((h,m)=>Number(h)*60+Number(m)),uid:()=>String(++serial),mCat:'work',mDoneValue:false,mEditing:null,mKind:'point',save(){},render(){},closeModal(){},playCompleteSound(){},toast(){},isDesktop:true,catById:()=>({name:'工作'}),localStorage:{setItem(){},getItem(){return '{}';}},window:{mochi:{notify:async()=>{notifies++;return {ok:success};}}}};
vm.createContext(c);
vm.runInContext(html.slice(html.indexOf('function addTask(){'),html.indexOf('function deleteEditing(){')),c);
vm.runInContext(html.slice(html.indexOf('let lastReminderCheck'),html.indexOf('let audioCtx=null')),c);
function create(mode,start,end){c.state.tasks={};for(const [id,value] of Object.entries({mTitle:'测试',mDate:start,mTime:'10:00',mEnd:'11:00',mSchedule:mode,mUntil:end,mReminder:'0',mReminderMinutes:'0'}))fields[id]={value};c.addTask();return Object.keys(c.state.tasks);}
assert.deepEqual(create('weekly','2026-10-18','2026-11-01'),['2026-10-18','2026-10-25','2026-11-01']);
assert.deepEqual(create('biweekly','2026-10-18','2026-11-15'),['2026-10-18','2026-11-01','2026-11-15']);
assert.deepEqual(create('monthly','2026-01-31','2026-04-30'),['2026-01-31','2026-02-28','2026-03-31','2026-04-30']);
assert.deepEqual(create('monthly','2028-01-31','2028-03-31'),['2028-01-31','2028-02-29','2028-03-31']);
assert.deepEqual(create('bimonthly','2026-12-31','2027-04-30'),['2026-12-31','2027-02-28','2027-04-30']);
assert.equal(create('daily','2026-01-01','2027-12-31').length,0);
assert.equal(create('daily','2026-10-18','2026-10-20').length,3);
assert.equal(create('weekly','2026-10-18','2026-10-17').length,0);
c.mKind='range';assert.equal(create('span','2026-10-18','2026-10-20').length,3);assert.equal(c.state.tasks['2026-10-19'][0].reminderMinutes,null);
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 c.state.tasks={'2026-10-18':[{id:'a',title:'过去5分钟',time:'09:55',reminderMinutes:0}]};
 success=false;c.checkRemind();await flush();assert.equal(notifies,1);
 success=true;c.checkRemind();c.checkRemind();await flush();assert.equal(notifies,2);
 c.checkRemind();await flush();assert.equal(notifies,2);
 for(const lead of [0,5,15,60]){
  const due=new Date(now.getTime()+lead*60000),time=due.toTimeString().slice(0,5);
  c.state.tasks={'2026-10-18':[{id:'lead'+lead,title:'提前',time,reminderMinutes:lead}]};c.checkRemind();await flush();
 }assert.equal(notifies,6);
 c.state.tasks={'2026-10-18':[{id:'all',title:'全天',time:'',reminderMinutes:0}]};c.checkRemind();await flush();assert.equal(notifies,7);
 c.state.tasks={'2026-10-18':[{id:'done',done:true,time:'10:00',reminderMinutes:0},{id:'off',time:'10:00',reminderMinutes:null},{id:'future',time:'10:01',reminderMinutes:0}],'2026-10-16':[{id:'old',time:'10:00',reminderMinutes:0}]};c.checkRemind();await flush();assert.equal(notifies,7);
 c.state.cfg.remind=false;c.state.tasks={'2026-10-18':[{id:'global',time:'10:00',reminderMinutes:0}]};c.checkRemind();await flush();assert.equal(notifies,7);
 console.log('PASS: 周/双周/月/双月、闰年月末跨年、上限、旧跨天、提前提醒、全天、24小时补发、失败重试、并发防重、完成与关闭过滤');
})().catch(e=>{console.error(e);process.exitCode=1;});
