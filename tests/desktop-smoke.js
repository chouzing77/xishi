// Isolated Electron smoke test: never opens the real user's task storage.
const {app,BrowserWindow,ipcMain,Notification}=require('electron');
const fs=require('fs'),os=require('os'),path=require('path');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'xishi-v31-test-')));
app.setAppUserModelId('com.zhouzhou.mochiboard');
ipcMain.on('win-get-top',e=>e.returnValue=false);
ipcMain.handle('win-info',()=>({desktop:true,platform:'win32'}));
ipcMain.handle('win-get-autolaunch',()=>false);
ipcMain.handle('backup-save',()=>({ok:true}));
ipcMain.handle('notify',()=>({ok:true}));
app.whenReady().then(async()=>{
 const w=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'../src/preload.js'),contextIsolation:true,sandbox:false}});
 const errors=[];w.webContents.on('console-message',(_e,level,message)=>{if(level===3)errors.push(message);});
 await w.loadFile(path.join(__dirname,'../src/index.html'));
 const result=await w.webContents.executeJavaScript(`(()=>{
   const opts=Array.from(document.querySelector('#mSchedule').options).map(x=>x.value);
   if(!['weekly','biweekly','monthly','bimonthly'].every(x=>opts.includes(x)))throw Error('Missing repeat UI');
   return {repeatOptions:opts,bridge:typeof window.mochi.notify};
 })()`);
 console.log('RENDERER',JSON.stringify(result),'ERRORS',JSON.stringify(errors));
 const status=await new Promise(resolve=>{
  if(!Notification.isSupported())return resolve('unsupported');
  const n=new Notification({title:'夕拾 V3.1 验收测试',body:'这是打包前的系统通知测试。实际定时提醒请按验收说明检查。'});
  const timer=setTimeout(()=>resolve('timeout'),8000);
  n.on('show',()=>{clearTimeout(timer);resolve('show');});n.on('failed',(_e,error)=>{clearTimeout(timer);resolve('failed: '+error);});n.show();
 });
 fs.writeFileSync(path.join(__dirname,'desktop-result.json'),JSON.stringify({result,errors,notification:status},null,2));
 console.log('WINDOWS_NOTIFICATION',status);app.exit(errors.length?1:0);
}).catch(e=>{fs.writeFileSync(path.join(__dirname,'desktop-result.json'),JSON.stringify({error:String(e)}));console.error(e);app.exit(1);});
