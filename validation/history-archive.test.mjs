import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('歷程首頁預設是版本檔案館，不是流水 log',()=>{
  assert.match(app,/async function renderHistory\(active='system'\)/);
  assert.match(app,/\['system','版本檔案館'\]/);
  for(const label of ['V3','互動式 Growth Brain 網站','V2','Worker \/ 事件漏斗','V1.5','作品、能力、員工','V1','資料庫與基本網站']){
    assert.ok(app.includes(label),label);
  }
});

test('版本敘事與正式資料庫更新紀錄分開',()=>{
  assert.ok(app.includes('版本區只描述產品階段'));
  assert.ok(app.includes('正式更新紀錄'));
  assert.ok(app.includes('只列資料庫已保存的系統執行／部署紀錄'));
  assert.match(css,/\.version-archive/);
  assert.match(css,/\.history-evidence-log/);
});
