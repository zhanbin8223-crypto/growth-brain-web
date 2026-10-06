import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../event-lab.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('研究來源顯示實際查證狀態，不再一律標待查核',()=>{
  assert.match(src,/s\?\.verified/);
  assert.match(src,/checked_at/);
  assert.doesNotMatch(src,/return '<li><a[^\n]+AI 提供・待查核<\/small><\/li>'/);
});

test('研究候選會展開詳細執行計畫',()=>{
  for(const key of ['steps','prerequisites','resource_refs','memory_refs','minimum_artifact','estimated_effort','plan_provenance']){
    assert.match(src,new RegExp('x\\.'+key.replace('_','_')));
  }
  assert.match(src,/success_evidence/);
  assert.match(css,/\.research-plan-step/);
});

test('研究室顯示資料庫記憶與可用資源摘要',()=>{
  assert.match(src,/snapshot\?\.context/);
  assert.match(src,/memory\.sources/);
  assert.match(src,/memory\.concepts/);
  assert.match(src,/ctx\.tools/);
  assert.match(src,/ctx\.capability_cells/);
  assert.match(src,/ctx\.playbooks/);
  assert.match(css,/\.research-context/);
});
