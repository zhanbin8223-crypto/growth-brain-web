create or replace function growth_control.work_skill_proposal_v1(p_person_id uuid, p_artifact_id uuid)
returns jsonb language plpgsql stable set search_path to '' as $f$
declare v_a growth_control.personal_artifacts%rowtype; v_skills jsonb; v_existing int;
begin
  select * into v_a from growth_control.personal_artifacts where id=p_artifact_id and person_id=p_person_id and project_key='growth-brain';
  if not found then return jsonb_build_object('accepted',false,'reason','artifact_not_found'); end if;
  select count(*) into v_existing from growth_control.artifact_skill_targets where artifact_id=p_artifact_id and person_id=p_person_id;
  with crit as (
    select ordinality::int n, value c from jsonb_array_elements_text(coalesce(v_a.done_evidence,'[]'::jsonb)) with ordinality
  ), tpl(key,name_zh,kind,why,pat,ord) as (values
    ('selection','選品判斷','core','找到值得推、分潤合理、說得出優點的商品，並寫下篩選理由','商品|選品|貨源',1),
    ('affiliate-link','聯盟平台與分潤連結操作','tool','申請分潤帳號、看懂分潤規則、產生推廣連結','聯盟|分潤.*(帳號|連結|設定)|推廣連結',2),
    ('persona-planning','人設與內容企劃','core','定出是誰、對誰說話，並挑能持續產出的主題','人設|主題|定位|受眾',3),
    ('ig-account','IG 帳號設定與經營','tool','建立帳號、專業帳號設定、簡介與連結、基本互動','Instagram|IG|社群帳號',4),
    ('ai-media','AI 圖像／影片生成','tool','用 AI 做出風格一致的圖片或短影片，並注意素材版權','AI.*(圖|影片|生成)|數字人.*(圖|影片)',5),
    ('persuasive-content','寫出讓人想點的內容','core','用幾句話讓對的人想點：誰需要、解決什麼、為什麼現在','文案|推廣內容|頁面|貼文',6),
    ('publish-rules','內容發布與平台規則','tool','把內容發到平台上，固定節奏並避開違規與揭露規定','發布|公開|上線',7),
    ('data-reading','看懂成效數據','core','看懂點擊、瀏覽、互動與追蹤變化，判斷哪裡有訊號','點擊|瀏覽|數據|流量|互動|成效|觀看',8),
    ('monetization','變現模式判斷','core','比較分潤、業配、自有產品等方式，選一個最值得先試的','變現|收入|賺',9),
    ('next-step-decision','成果紀錄與下一步決策','core','把結果寫成可追溯紀錄，決定繼續、調整或停止','分潤結果|下一步|未成交|成果紀錄',10)
  ), hits as (
    select t.key,t.name_zh,t.kind,t.why,t.ord,array_agg(c.n order by c.n) ns,min(c.c) sample
    from tpl t join crit c on c.c ~ t.pat group by t.key,t.name_zh,t.kind,t.why,t.ord
  ), uncovered as (
    select c.n,c.c from crit c where not exists(select 1 from tpl t where c.c ~ t.pat)
  )
  select coalesce(jsonb_agg(x order by o),'[]'::jsonb) into v_skills from (
    select jsonb_build_object('skill_key',key,'name_zh',name_zh,'skill_kind',kind,'why',why,'criteria',to_jsonb(ns),
      'minimum_needed_now','條件 '||array_to_string(ns,'、')) x, ord o from hits
    union all
    select jsonb_build_object('skill_key','criterion-'||n,'name_zh',left('完成「'||c||'」需要的能力',40),'skill_kind','core','why','系統找不到對應的能力範本，請改成你自己的說法','criteria',jsonb_build_array(n),'minimum_needed_now','條件 '||n), 100+n from uncovered
  ) s;
  return jsonb_build_object('accepted',true,'artifact_id',p_artifact_id,'artifact_title',v_a.title,'method','rule_template_v1','llm_used',false,
    'existing_count',v_existing,'existing_skills',(select coalesce(jsonb_agg(jsonb_build_object('skill_key',t.skill_key,'name_zh',t.name_zh,'skill_kind',t.skill_kind,'why',t.why,'minimum_needed_now',t.minimum_needed_now) order by t.created_at,t.skill_key),'[]'::jsonb) from growth_control.artifact_skill_targets t where t.artifact_id=p_artifact_id and t.person_id=p_person_id),'skills',v_skills,
    'note','依完成條件的關鍵字對應能力範本產生；需要你確認或修改後才會儲存。');
end $f$;

