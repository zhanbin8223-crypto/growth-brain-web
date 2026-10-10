import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={GROWTH_BRAIN_ADAPTER:{}};
vm.runInNewContext(readFileSync(new URL('../event-lab.js',import.meta.url),'utf8'),{window,URL,console});
const {validFunnel,safeUrl}=window.GROWTH_BRAIN_LAB;
const fixture=kind=>({goal:'完成一個可檢查成果',boundaries:['只處理目前這一步'],key_hub:'先找驗收證據',dependencies:['現有資料'],unknowns:['實測結果'],failure_points:['沒有結果就放大'],required_evidence:['可重現操作紀錄'],minimum_artifact:'一個小成果',bottleneck:'還沒驗證',primary_route:{kind,key:'',reason:'先完成最小測試'},next_step:'記錄一次真實測試結果'});
for(const kind of ['capability','research','employee','tool','current_artifact','system_work_package'])test(`接受 ${kind} 的完整拆解`,()=>assert.ok(validFunnel(fixture(kind))));
test('缺少目標、證據、下一步或未知主路時不可送入流程',()=>{
  for(const key of ['goal','key_hub','minimum_artifact','bottleneck','next_step','required_evidence']){
    const o=fixture('research');delete o[key];assert.ok(!validFunnel(o),key);
  }
  const o=fixture('research');o.required_evidence=[];assert.ok(!validFunnel(o));o.primary_route.kind='publish';assert.ok(!validFunnel(o));
});
test('AI 補上的真實能力旗標不影響候選契約',()=>{
  const o=fixture('employee');o.skills_verified=true;o.artifact_completed=true;assert.ok(validFunnel(o));
  const src=readFileSync(new URL('../event-lab.js',import.meta.url),'utf8');
  assert.ok(!/completePersonalArtifact|recordPersonalArtifactEvidence|decidePersonalOutcomeCandidate/.test(src));
});
test('參考來源只允許 http 與 https，不執行 javascript/data/file',()=>{
  assert.equal(safeUrl('https://supabase.com/docs'),'https://supabase.com/docs');
  for(const u of ['javascript:alert(1)','data:text/html,<script>','file:///etc/passwd','bad url'])assert.equal(safeUrl(u),null);
});
test('維持五區（ADR-0002）、齒輪系統入口與全域收集入口',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/class="nav-item/g)||[]).length,5);assert.match(html,/id="gearBtn"/);
  assert.match(html,/id="captureBtn"/);assert.match(html,/src="event-lab\.js(?:\?[^\"]*)?"/);
});
