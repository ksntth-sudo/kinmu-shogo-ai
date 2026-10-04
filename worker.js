
const APP_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#123d63">
<title>勤務照合 AI版</title>
<style>
:root{--navy:#123d63;--blue:#0b5b91;--bg:#f3f6fa;--line:#d7e0eb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;color:#172033}
header{background:linear-gradient(135deg,#0f3556,#145784);color:#fff;padding:16px}header h1{font-size:20px;margin:0 0 3px}header p{font-size:12px;margin:0;opacity:.9}
main{max-width:1050px;margin:auto;padding:12px}.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
h2{font-size:16px;margin:0 0 10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:760px){.grid{grid-template-columns:1fr}}
label{font-size:12px;font-weight:800;display:block;margin:5px 0}input,button{font:inherit}input{width:100%;padding:10px;border:1px solid #bac6d6;border-radius:9px;background:#fff}
button{border:0;border-radius:9px;padding:12px 14px;font-weight:800;cursor:pointer}.primary{background:var(--blue);color:#fff}
.small{font-size:12px;color:#667085}.notice{padding:10px;border-left:4px solid #6a88a7;background:#f2f6fb;border-radius:8px;font-size:13px;line-height:1.6}
.preview{width:100%;max-height:330px;object-fit:contain;border:1px dashed #bcc7d5;border-radius:10px;background:#fafcff}.tablewrap{overflow:auto;border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;min-width:760px}th,td{font-size:13px;padding:8px;border-bottom:1px solid #e6ebf1;text-align:left;vertical-align:top}th{background:#eef4fa}
.badge{display:inline-block;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800}.ok{background:#dcfae6;color:#05603a}.warn{background:#fff3d8;color:#8a4b00}.ng{background:#fee4e2;color:#912018}
.loading{display:none;padding:12px;border-radius:10px;background:#eef5fb;margin-top:10px;font-weight:700}.kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.kpi div{border:1px solid #d9e1ec;border-radius:10px;padding:10px;text-align:center}.kpi strong{font-size:22px;display:block}
</style>
</head>
<body>
<header><h1>勤務出方・時間外命令簿 照合</h1><p>AI画像解析版</p></header>
<main>
<section class="card">
<h2>① 画像を選択</h2>
<div class="grid">
<div><label>勤務表・実態把握表</label><input id="roster" type="file" accept="image/*" capture="environment"><div id="rp" style="margin-top:8px"></div></div>
<div><label>時間外勤務等命令簿</label><input id="orders" type="file" accept="image/*" multiple capture="environment"><div id="op" style="margin-top:8px"></div></div>
</div>
<p class="small">命令簿は複数枚選択できます。</p>
<button id="analyze" class="primary">AIで読み取り・照合</button>
<div id="loading" class="loading">AIが帳票を確認しています…</div>
</section>

<section class="card">
<h2>② 結果</h2>
<div class="kpi">
<div><span class="small">正常</span><strong id="okc">0</strong></div>
<div><span class="small">要確認</span><strong id="wc">0</strong></div>
<div><span class="small">不一致</span><strong id="ngc">0</strong></div>
</div>
<div id="summary" class="notice">まだ照合していません。</div>
<div class="tablewrap" style="margin-top:10px">
<table><thead><tr><th>氏名</th><th>勤務表</th><th>命令簿右端</th><th>開始</th><th>判定</th><th>理由</th></tr></thead><tbody id="tb"></tbody></table>
</div>
</section>
<section class="card"><div class="notice"><b>判定基準</b><br>A出方（1A・2A・基地A・P1・P3）は原則08:15～。B出方（1B・2B・基地B・P2・P4）は原則10:15～。深夜帯など別枠の時間外勤務は「要確認」とします。</div></section>
</main>
<script>
const roster=document.getElementById("roster"),orders=document.getElementById("orders");
function preview(input,boxId){input.addEventListener("change",()=>{const box=document.getElementById(boxId);box.innerHTML="";[...(input.files||[])].forEach(f=>{const img=document.createElement("img");img.className="preview";img.src=URL.createObjectURL(f);box.appendChild(img);});});}
preview(roster,"rp");preview(orders,"op");
async function toDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
function esc(s){return String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
document.getElementById("analyze").onclick=async()=>{if(!roster.files[0]||!orders.files.length){alert("勤務表と命令簿の画像を選択してください。");return;}loading.style.display="block";analyze.disabled=true;try{const payload={roster:await toDataURL(roster.files[0]),orders:await Promise.all([...orders.files].map(toDataURL))};const res=await fetch("/api/analyze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||"解析に失敗しました");render(data);}catch(e){summary.textContent="エラー："+e.message;}finally{loading.style.display="none";analyze.disabled=false;}};
function render(data){const rows=data.rows||[],tb=document.getElementById("tb");tb.innerHTML="";let ok=0,w=0,ng=0;rows.forEach(r=>{const j=r.judgement||"要確認";if(j==="正常")ok++;else if(j==="不一致")ng++;else w++;const cls=j==="正常"?"ok":j==="不一致"?"ng":"warn";const tr=document.createElement("tr");["name","roster_shift","order_shift","start_time"].forEach(k=>{
  const td=document.createElement("td");
  td.textContent=r[k]||"";
  tr.appendChild(td);
});
const tdJudge=document.createElement("td");
const span=document.createElement("span");
span.className="badge "+cls;
span.textContent=j;
tdJudge.appendChild(span);
tr.appendChild(tdJudge);
const tdReason=document.createElement("td");
tdReason.textContent=r.reason||"";
tr.appendChild(tdReason);tb.appendChild(tr);});okc.textContent=ok;wc.textContent=w;ngc.textContent=ng;summary.textContent=data.summary||("正常 "+ok+"件／要確認 "+w+"件／不一致 "+ng+"件");}
</script>
</body></html>`;

const SYSTEM_PROMPT = `
あなたは日本の勤務帳票を照合する慎重な文書解析担当者です。
勤務表・実態把握表と時間外勤務等命令簿の画像を読み取り、各人について照合してください。
ルール:
- A出方: 1A, 2A, 基地A, P1, P3。勤務終了後の時間外勤務開始は原則08:15。
- B出方: 1B, 2B, 基地B, P2, P4。勤務終了後の時間外勤務開始は原則10:15。
- 略記: 基A=基地A、基B=基地B、代=地域代理、P1=パトカー1A、P2=パトカー2B、P3=パトカー3A、P4=パトカー4B。
- 命令簿右端の鉛筆書きを丁寧に読む。判別不能なら推測せず「不明」。
- 深夜帯など通常勤務終了後とは別枠と考えられる時間外勤務は「要確認」。
- 氏名や数字を画像にない形で補完しない。
- 確信が低いものは「要確認」。
- 出方が一致し通常の開始時刻も基準どおりなら「正常」。
- 明確な出方相違、または通常枠の開始時刻が基準と明確に違う場合は「不一致」。
必ずJSONだけを返す:
{"summary":"短い総括","rows":[{"name":"氏名","roster_shift":"勤務表の出方","order_shift":"命令簿右端","start_time":"HH:MM","judgement":"正常|要確認|不一致","reason":"簡潔な理由"}]}
`;

function extractText(data){if(typeof data.output_text==="string"&&data.output_text)return data.output_text;for(const item of(data.output||[])){for(const c of(item.content||[])){if(c.type==="output_text"&&c.text)return c.text;}}return "";}
function parseJSONLoose(text){try{return JSON.parse(text);}catch{}const m=text.match(/\{[\s\S]*\}/);if(!m)throw new Error("AI結果をJSON解析できません");return JSON.parse(m[0]);}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(request.method==="GET") return new Response(APP_HTML,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
    if(request.method==="POST" && url.pathname==="/api/analyze"){
      try{
        if(!env.OPENAI_API_KEY) return Response.json({error:"OPENAI_API_KEY が未設定です。"}, {status:500});
        const body=await request.json();
        if(!body.roster||!Array.isArray(body.orders)||!body.orders.length) return Response.json({error:"画像が不足しています。"}, {status:400});
        const content=[{type:"input_text",text:SYSTEM_PROMPT+"\n最初の画像が勤務表、その後の画像が時間外勤務等命令簿です。"}];
        content.push({type:"input_image",image_url:body.roster,detail:"high"});
        for(const img of body.orders.slice(0,8)) content.push({type:"input_image",image_url:img,detail:"high"});
        const api=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"authorization":`Bearer ${env.OPENAI_API_KEY}`,"content-type":"application/json"},body:JSON.stringify({model:"gpt-6.1-sol",store:false,input:[{role:"user",content}],max_output_tokens:5000})});
        const data=await api.json();
        if(!api.ok) return Response.json({error:data?.error?.message||"OpenAI APIエラー"}, {status:502});
        const parsed=parseJSONLoose(extractText(data));
        return Response.json(parsed,{headers:{"cache-control":"no-store"}});
      }catch(e){return Response.json({error:String(e.message||e)}, {status:500});}
    }
    return new Response("Not found",{status:404});
  }
};
