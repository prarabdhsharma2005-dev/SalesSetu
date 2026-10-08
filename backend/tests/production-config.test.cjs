const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { validateProductionConfig, requireAppAccess, acquireStoreLock } = require('../dist/services/runtime-config.service')
test('production fails closed without PostgreSQL, access credentials and real provider configuration',()=>{
  assert.throws(()=>validateProductionConfig({NODE_ENV:'production'}))
  const env={NODE_ENV:'production',APP_ACCESS_USER:'test',APP_ACCESS_PASSWORD:'test-only-password-long-enough',GEMINI_API_KEY:'test-only',TAVILY_API_KEY:'test-only',DATABASE_URL:'postgresql://isolated:isolated@localhost/isolated',FRONTEND_URL:'https://frontend.example.com',FOLLOW_UP_SCHEDULER_ENABLED:'false'}
  assert.doesNotThrow(()=>validateProductionConfig(env))
  assert.throws(()=>validateProductionConfig({...env,DATABASE_URL:''}),/DATABASE_URL/)
  assert.throws(()=>validateProductionConfig({...env,FRONTEND_URL:'http://localhost:3000'}),/HTTPS/)
  assert.throws(()=>validateProductionConfig({...env,FOLLOW_UP_SCHEDULER_ENABLED:'true'}),/CRON_SECRET/)
})
test('API access requires authentication, rejects cross-origin writes, and allows an authenticated operator',()=>{
  const saved={...process.env}
  Object.assign(process.env,{NODE_ENV:'production',APP_ACCESS_USER:'test',APP_ACCESS_PASSWORD:'test-only-password-long-enough',FRONTEND_URL:'https://frontend.example.com'})
  const run=(authorization,origin)=>{let status=200,called=false;const res={status(v){status=v;return this},set(){return this},json(){return this}};requireAppAccess({method:'POST',headers:{authorization,origin}},res,()=>{called=true});return {status,called}}
  try {
    assert.equal(run().status,401)
    const auth=`Basic ${Buffer.from('test:test-only-password-long-enough').toString('base64')}`
    assert.equal(run(auth,'https://evil.example').status,403)
    assert.equal(run(auth,'https://frontend.example.com').called,true)
  } finally { for(const key of Object.keys(process.env)) if(!(key in saved)) delete process.env[key]; Object.assign(process.env,saved) }
})
test('single-process lock rejects another owner; JSON changes survive a new process without touching runtime data',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'salessetu-isolated-'))
  try {
    const release=acquireStoreLock(directory)
    assert.throws(()=>acquireStoreLock(directory),/Another process/)
    release(); const releaseAgain=acquireStoreLock(directory); releaseAgain()
    const storeFile=path.join(directory,'sheets_store.json')
    fs.writeFileSync(storeFile,JSON.stringify({leads:[],outreach:[],meetings:[],deals:[],followUpSequences:[{id:'s1',updatedAt:'2026-01-01T00:00:00.000Z',status:'ACTIVE',steps:[]}]}))
    const modulePath=path.resolve(__dirname,'../dist/services/sheets.service.js')
    const env={...process.env,DATA_DIR:directory,NODE_ENV:'test',GOOGLE_SHEETS_WEBHOOK_URL:'',GOOGLE_SHEET_ID:''}
    execFileSync(process.execPath,['-e',`const {GoogleSheetsService:s}=require(${JSON.stringify(modulePath)});s.updateSequence('s1',{status:'PAUSED'}).then(()=>{});`],{env})
    const result=execFileSync(process.execPath,['-e',`const {GoogleSheetsService:s}=require(${JSON.stringify(modulePath)});s.getSequences().then(x=>process.stdout.write(x[0].status));`],{env,encoding:'utf8'})
    assert.equal(result,'PAUSED')
    assert.equal(fs.readdirSync(directory).some(name=>name.endsWith('.tmp')),false)
  } finally { fs.rmSync(directory,{recursive:true,force:true}) }
})
