'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');

test('distribution builds as one self-contained HTML with parseable inline data and code',()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'threat-hunt-build-'));
  try {
    execFileSync(process.execPath,[path.resolve(__dirname,'../build.cjs')],{env:{...process.env,TH_OUTPUT_DIR:out}});
    assert.deepEqual(fs.readdirSync(out),['index.html']);
    const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
    assert.ok(html.includes("connect-src 'none'"));
    const staticBody=html.split('<script')[0];
    assert.match(staticBody,/<main id="main"[^>]*>[\s\S]*<h1>ThreatHunting-room<\/h1>/);
    assert.match(staticBody,/操作チュートリアル：5〜8分/);
    assert.match(staticBody,/38 lessons/);
    const noScriptBody=staticBody.split('<body>')[1].match(/<noscript>([\s\S]*?)<\/noscript>/)[1];
    assert.ok(noScriptBody.includes('<a href="https://retiacole.github.io/threathunting-room/threathunting-room.html" download="threathunting-room.html">'));
    for(const property of ['og:title','og:description','og:type','og:url','og:image']) {
      assert.ok(html.includes('property="'+property+'" content="'), 'Missing preview metadata: '+property);
    }
    assert.doesNotMatch(html,/<(?:script|link|img|iframe)\b[^>]*(?:src|href)\s*=/i);
    assert.doesNotMatch(html,/\/\* (?:STYLES|DATA|ENGINE|APP|TRANSLATIONS|I18N) \*\//);
    const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    const jsonScripts=scripts.filter(script=>/type="application\/json"/.test(script[1]));
    const codeScripts=scripts.filter(script=>!/type="application\/json"/.test(script[1]));
    assert.equal(jsonScripts.length,2);
    assert.equal(codeScripts.length,3);
    const bundle=JSON.parse(jsonScripts.find(script=>/id="task-data"/.test(script[1]))[2]);
    const dictionary=JSON.parse(jsonScripts.find(script=>/id="translation-data"/.test(script[1]))[2]);
    assert.equal(dictionary['保存'],'Save');
    assert.ok(Object.keys(dictionary).length>1000);
    assert.match(html,/data-language/);
    assert.equal(bundle.tasks.length,40);
    assert.equal(bundle.releaseVersion,require('../package.json').version);
    assert.equal(bundle.tasks.filter(t=>t.part===2).length,23);
    assert.ok(bundle.tasks.filter(t=>t.part===2).every(t=>!t.logs&&t.logIds.length));
    assert.equal(Object.values(bundle.environments)[0].assets.length,20);
    for(const script of codeScripts) {
      assert.doesNotThrow(()=>new vm.Script(script[2]));
      assert.doesNotMatch(script[2],/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\(/);
    }
  } finally { fs.rmSync(out,{recursive:true,force:true}); }
});
