/* META RAYON v0.44 bridge: preserve original tools, add startup choice and fixed floor transfer. */
(function(){
"use strict";
var STORE="meta-rayon-last-project-v044",ARCHIVE="meta-rayon-previous-project-archive-v044",TRANSFER="meta-floor-transfer-v1";
var active=false,queued=null,saveTimer=null,lastSaveError=false;
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function r(n){return Math.round((Number(n)||0)*100)/100;}
function stored(){try{var d=JSON.parse(localStorage.getItem(STORE)||"null");if(d&&Array.isArray(d.objects))return d;}catch(e){}try{var records=readSc();if(records.length&&Array.isArray(records[records.length-1].data.objects))return records[records.length-1].data;}catch(e){}return null;}
function store(){if(!active)return;try{localStorage.setItem(STORE,JSON.stringify(serialize()));lastSaveError=false;}catch(e){if(!lastSaveError){console.warn("Автосохранение недоступно: сохраните проект кнопкой JSON.",e);lastSaveError=true;}}}
function later(){if(!active)return;clearTimeout(saveTimer);saveTimer=setTimeout(store,1200);}
var previousSync=syncBlockMetrics;
syncBlockMetrics=function(o){
 if(o&&o.metaFixed&&o.metaFloor){
  var f=o.metaFloor;
  o.saleFloor=Number(f.saleArea_m2)||0;
  o.grossFloor=Number(f.grossArea_m2)||0;
  o.kep=Number(f.kep)||(o.grossFloor>0?o.saleFloor/o.grossFloor:0);
  o.avgApt=f.apartmentsPerFloor>0?o.saleFloor/f.apartmentsPerFloor:50;
  o.label="СЕКЦИЯ · КОНФИГУРАТОР";
  o.blockCalc={comboKey:o.comboKey||"T3L",avgApt:o.avgApt,kep:o.kep,footprint:o.w*o.h,saleFloor:o.saleFloor,nKv:Number(f.apartmentsPerFloor)||0,nChel:(Number(f.apartmentsPerFloor)||0)*2};
  return;
 }
 return previousSync(o);
};
var previousResizable=isResizable;
isResizable=function(o){return !(o&&o.metaFixed)&&previousResizable(o);};
var previousInspector=renderInspector;
renderInspector=function(){
 var o=selected();
 if(!o||!o.metaFixed){previousInspector();return;}
 var f=o.metaFloor||{},root=document.getElementById("inspector");
 root.innerHTML='<div class="inspectorTitle" id="fixedTitle"></div>'+
 '<div class="statusline"><b>Геометрия и ТЭП закреплены Конфигуратором.</b><br>Разрешены только этажность, перемещение и поворот для посадки на участке.</div>'+
 '<div class="frow"><label>Габарит, X × Y</label><b>'+r(o.w)+' × '+r(o.h)+' м</b></div>'+
 '<div class="frow"><label>Квартир / этаж</label><b>'+r(f.apartmentsPerFloor)+'</b></div>'+
 '<div class="frow"><label>S квартир / этаж</label><b>'+r(f.saleArea_m2)+' м²</b></div>'+
 '<div class="frow"><label>S МОП / этаж</label><b>'+r(f.mopArea_m2)+' м²</b></div>'+
 '<div class="frow"><label>S строительная / этаж</label><b>'+r(f.grossArea_m2)+' м²</b></div>'+
 '<div class="frow"><label>КЭП</label><b>'+r(f.kep)+'</b></div>'+
 '<div class="frow"><label>Этажность</label><input id="metaFixedFloors" type="number" min="1" max="100" step="1" value="'+o.floors+'"></div>'+
 '<div class="statusline"><b>На здание:</b><br>Квартир: '+r((Number(f.apartmentsPerFloor)||0)*o.floors)+
 '<br>S квартир: '+r((Number(f.saleArea_m2)||0)*o.floors)+' м²</div>';
 root.querySelector("#fixedTitle").textContent=o.label+" · "+o.id;
 root.querySelector("#metaFixedFloors").onchange=function(){var v=Number(this.value);if(!Number.isInteger(v)||v<1||v>100){this.value=o.floors;return;}checkpoint();o.floors=v;renderAll();later();};
};
var previousRenderObj=renderObj;
renderObj=function(o){
 previousRenderObj(o);
 if(!o||!o.metaFixed||!Array.isArray(o.metaParts)||!o.metaParts.length)return;
 var g=Array.from(objLayer.querySelectorAll("g.obj")).find(function(el){return el.dataset.id===o.id;});
 if(!g)return;
 var anchor=g.querySelector("text");
 for(var i=0;i<o.metaParts.length;i++){
  var part=o.metaParts[i];if(!Array.isArray(part.points)||part.points.length<3)continue;
  var p=document.createElementNS("http://www.w3.org/2000/svg","polygon");
  p.setAttribute("points",part.points.map(function(q){return r(q[0])+","+r(q[1]);}).join(" "));
  p.setAttribute("fill",part.kind==="mop"?"#d5dfe2":/^(1С|1К\/2С)/.test(part.name)?"#cee5f9":/3С/.test(part.name)?"#cde8d8":"#efdac2");
  p.setAttribute("stroke","#557080");p.setAttribute("stroke-width","0.16");p.setAttribute("pointer-events","none");
  if(anchor)g.insertBefore(p,anchor);else g.appendChild(p);
 }
};
function importKey(p){var b=p.bounds||{};return String(p.meta&&p.meta.created||"")+"|"+r(b.width_m)+"|"+r(b.depth_m);}
function importSection(p){
 if(!active){queued=p;return;}
 if(!p||!p.bounds||!p.floor||!Array.isArray(p.parts))throw Error("Неверный формат секции из Конфигуратора");
 var b=p.bounds,w=Number(b.width_m),h=Number(b.depth_m),f=p.floor,key=importKey(p);
 if(!(w>0&&h>0&&w<1000&&h<1000)||!Number.isFinite(Number(f.saleArea_m2)))throw Error("Некорректные габариты или ТЭП");
 if(state.objects.some(function(o){return o.metaFixed&&o.metaImportKey===key;})){
  localStorage.removeItem(TRANSFER);return;
 }
 var minX=Number(b.minX_m)||0,minY=Number(b.minY_m)||0;
 var parts=p.parts.map(function(q){return{kind:String(q.kind||""),name:String(q.name||""),points:(q.points_m||[]).map(function(x){return [r(Number(x[0])-minX-w/2),r(Number(x[1])-minY-h/2)];})};}).filter(function(q){return q.points.length>=3;});
 checkpoint();
 var maxX=0,maxY=0;
 for(var i=0;i<state.objects.length;i++){var o=state.objects[i];if(o.kind==="building"){maxX=Math.max(maxX,o.x+o.w/2);maxY=Math.max(maxY,o.y+o.h/2);}}
 var x=state.objects.length?maxX+w/2+10:state.siteW*.45,y=state.objects.length?maxY+20:state.siteH*.40;
 var obj=add("BLOK",x,y,{w:r(w),h:r(h),shape:"straight",comboKey:"T3L",avgApt:50,
  floors:Math.max(1,Math.min(100,Math.floor(Number(f.floors)||18))),groundFloorUse:"residential",metaFixed:true,
  metaImportKey:key,metaFloor:{apartmentsPerFloor:Number(f.apartmentsPerFloor)||0,
  saleArea_m2:Number(f.saleArea_m2)||0,mopArea_m2:Number(f.mopArea_m2)||0,grossArea_m2:Number(f.grossArea_m2)||0,kep:Number(f.kep)||0},
  metaParts:parts,status:"RESOLVED"});
 syncBlockMetrics(obj);
 state.armed=null;state.selected=obj.id;
 localStorage.removeItem(TRANSFER);
 renderAll();later();
 if(parent!==window)parent.postMessage({type:"META_MASSING_IMPORTED"},location.origin);
}
function applySaved(data){
 var input=document.getElementById("importFile");
 if(!input)throw Error("Не найден штатный загрузчик сценария.");
 var file=new File([JSON.stringify(data)],"META_previous_project.json",{type:"application/json"}),dt=new DataTransfer();
 dt.items.add(file);input.files=dt.files;
 input.dispatchEvent(new Event("change",{bubbles:true}));
}
var css=document.createElement("style");
css.textContent="#metaStartOverlay{position:fixed;inset:0;z-index:999999;background:rgba(12,27,39,.8);display:flex;align-items:center;justify-content:center;padding:18px}"+
 "#metaStartCard{max-width:530px;width:100%;background:#fff;border-radius:14px;padding:26px;box-shadow:0 20px 65px #0005;color:#203247}"+
 "#metaStartCard h2{font-size:21px;margin:0 0 9px}#metaStartCard p{font-size:13px;line-height:1.5;color:#667988}"+
 ".meta-start-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}.meta-start-buttons button{padding:15px;min-height:95px;text-align:left;border:1px solid #cbd6dd;background:#fff;border-radius:9px;cursor:pointer;font-weight:700}"+
 ".meta-start-buttons button:first-child{background:#1768d4;border-color:#1768d4;color:#fff}"+
 ".meta-start-buttons button:disabled{opacity:.4;cursor:not-allowed}.meta-start-buttons small{display:block;font-weight:400;font-size:11px;margin-top:8px;line-height:1.4}";
document.head.appendChild(css);
var overlay=document.createElement("div");overlay.id="metaStartOverlay";
overlay.innerHTML='<div id="metaStartCard" role="dialog" aria-modal="true" aria-labelledby="metaStartTitle">'+
 '<h2 id="metaStartTitle">МЕТАМАССИНГ · открыть проект</h2>'+
 '<p>Выберите, начать с чистого рабочего поля или восстановить предыдущий проект. Все инструменты версии 0.44 сохранены.</p>'+
 '<div class="meta-start-buttons"><button type="button" id="metaNew">＋ Новый проект<small>Пустое рабочее поле</small></button>'+
 '<button type="button" id="metaPrev">↩ Предыдущий проект<small>Восстановить автосохранение или последний сценарий</small></button></div></div>';
document.body.appendChild(overlay);
var snapshot=stored();
overlay.querySelector("#metaPrev").disabled=!snapshot;
function activate(usePrevious){
 overlay.remove();active=true;
 if(usePrevious&&snapshot){
  try{applySaved(snapshot);}catch(e){console.warn("Не удалось восстановить проект",e);alert("Не удалось восстановить автоматически. Загрузите прежний JSON через кнопку «Загрузить».");}
 }else if(snapshot){try{localStorage.setItem(ARCHIVE,JSON.stringify(snapshot));}catch(e){}}
 if(queued){var p=queued;queued=null;setTimeout(function(){try{importSection(p);}catch(e){alert("Ошибка передачи секции: "+e.message);}},usePrevious?250:25);}
}
overlay.querySelector("#metaNew").onclick=function(){activate(false);};
overlay.querySelector("#metaPrev").onclick=function(){activate(true);};
window.addEventListener("message",function(e){if(e.origin!==location.origin||!e.data||e.data.type!=="META_FLOOR_IMPORT")return;try{importSection(e.data.payload);}catch(err){alert("Ошибка импорта: "+err.message);}});
try{var data=JSON.parse(localStorage.getItem(TRANSFER)||"null");if(data&&data.meta&&data.meta.purpose==="META_MASSING_PLAN_IMPORT"){var t=Date.parse(data.meta.created||"");if(!t||Date.now()-t<30*60*1000)queued=data;}}catch(e){}
document.addEventListener("pointerup",later,true);
document.addEventListener("change",later,true);
document.addEventListener("click",later,true);
window.addEventListener("pagehide",store);
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")store();});
if(parent!==window)parent.postMessage({type:"META_MASSING_READY"},location.origin);
})();