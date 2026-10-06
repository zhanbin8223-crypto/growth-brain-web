import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../event-lab.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('研究來源顯示實際查證狀態，不一律標待查核',()=>{
  assert.match(src,/s\?\.verified/);
  assert.match(src,/checked_at/);
});

test('研究候選仍可展開詳細執行計畫',()=>{
  for(const key of ['steps','prerequisites','resource_refs','memory_refs','minimum_artifact','estimated_effort','plan_provenance'])assert.match(src,new RegExp('x\\.'+key));
  assert.match(src,/success_evidence/);
  assert.match(css,/\.research-plan-step/);
});

test('研究室保留資料庫 Context，但收進次要區',()=>{
  assert.match(src,/snapshot\?\.context/);
  assert.match(src,/memory\.sources/);
  assert.match(src,/ctx\.tools/);
  assert.match(src,/research-context-compact/);
  assert.match(css,/\.research-context/);
});

test('研究室第一層是可讀 stream，不是三欄卡片牆',()=>{
  assert.match(src,/research-stream/);
  assert.match(src,/research-stream-item/);
  assert.match(src,/research-state-tabs/);
  assert.doesNotMatch(src,/research-card-grid/);
  assert.match(css,/\.research-stream-item/);
  assert.match(css,/\.research-stream-finding/);
});
