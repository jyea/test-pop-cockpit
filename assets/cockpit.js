'use strict';
const D = window.POP_DATA;
const {years, provinces} = D.meta;
const $ = id => document.getElementById(id);
const blue = '#71c7f5', red = '#ff847d', muted = '#a0b4bf', gridLine = '#29404d';
const ramp = ['#22435c', '#316e99', '#4d9dcd', blue];
const labels = {pop: ['常住人口', '万人'], net: ['净流入', '万人'], density: ['人口密度', '人/km²']};
const latest = years[years.length - 1];
const span = years[0] + '–' + latest;
const fmt = n => Number.isFinite(n) ? n.toLocaleString('zh-CN', {maximumFractionDigits:2}) : '暂无数据';
const short = n => n.replace(/(维吾尔自治区|壮族自治区|回族自治区|自治区|省|市)$/, '');
const sum = values => values.reduce((s, n) => s + n, 0);
const totals = years.map((_, i) => {
  const values = provinces.map(p => D.panel[p][i]).filter(Number.isFinite);
  return values.length ? sum(values) : null;
});
const leader = Object.keys(D.net).sort((a,b) => D.net[b] - D.net[a])[0];
const totalFlow = sum(D.od.map(row => row[2]));
const state = {page:'overview', selected:null, flow:leader, year:latest};
const charts = new Map();
echarts.registerMap('china', window.CHINA_GEO);
function chart(id, option) {
  if (!charts.has(id)) charts.set(id, echarts.init($(id), null, {renderer:'svg'}));
  const c = charts.get(id);
  c.setOption({
    animation:false, color:[blue, red], textStyle:{color:muted, fontFamily:'Microsoft YaHei, sans-serif'},
    tooltip:{trigger:'item', confine:true, backgroundColor:'#102332', borderColor:gridLine, textStyle:{color:'#eef6fa'}},
    ...option
  }, true);
  return c;
}
function heading(id, title, meta) {
  const h = $(id).previousElementSibling;
  h.textContent = title;
  const sub = document.createElement('span');
  sub.className = 'subhead';
  sub.textContent = meta;
  h.append(sub);
}
function card(id, title, value, unit, note) {
  const n = $(id), box = n.closest('article');
  box.querySelector('h2').textContent = title;
  n.textContent = value;
  n.nextElementSibling.textContent = unit;
  box.querySelector('.note').textContent = note;
}
function flows(p, incoming) {
  return D.od.filter(row => row[incoming ? 1 : 0] === p).sort((a,b) => b[2] - a[2]);
}
function cards(i) {
  const p = state.selected;
  const note = (p || '全国') + ' · ';
  const coverage = provinces.filter(name => Number.isFinite(D.panel[name][i])).length;
  card('population', p ? '常住人口' : '常住人口合计', fmt(p ? D.panel[p][i] : totals[i]), '万人',
       note + years[i] + ' 年' + (p ? '' : ' · ' + coverage + ' 省有值'));
  if (p) {
    card('provinces','人口密度',fmt(D.density[p]),'人/km²',note + '2020 年');
    card('migrants','跨省迁入人口',fmt(sum(flows(p,true).map(r=>r[2]))/10000),'万人',note + '2020 年七普');
  } else {
    card('provinces','覆盖省级行政区',provinces.length,'个',span + ' 年人口面板');
    card('migrants','跨省流动人口',fmt(totalFlow/10000),'万人','2020 年七普 · ' + D.od.length + ' 条流向');
  }
  const net = D.net[p || leader];
  card('leaderNet',p ? '净流入人口' : '净流入最多的省份',(net > 0 ? '+' : '') + fmt(net),'万人',(p || leader) + ' · 2020 年七普');
}
const baseMap = {
  map:'china', roam:false, layoutCenter:['50%','47%'], layoutSize:'96%',
  itemStyle:{areaColor:'#26343f',borderColor:'#0d2232',borderWidth:1},
  emphasis:{label:{show:false},itemStyle:{borderColor:'#fff',borderWidth:2}}
};
function mapClicks(c, onSelect, onBlank) {
  c.off('click');
  c.on('click', e => { if (provinces.includes(e.name)) onSelect(e.name); });
  const zr = c.getZr();
  if (c.blankHandler) zr.off('click', c.blankHandler);
  c.blankHandler = e => { if (!e.target) onBlank(); };
  zr.on('click', c.blankHandler);
}
function overviewMap(rows, metric, unit) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  const abs = Math.max(...values.map(Math.abs), 1);
  const diverges = metric === 'net';
  const c = chart('map', {
    visualMap:{type:'continuous',min:diverges ? -abs : Math.min(...values), max:diverges ? abs : Math.max(...values),
      orient:'horizontal', left:'center',bottom:24,itemWidth:16,itemHeight:220,precision:1,
      text:diverges ? ['流入','流出'] : ['高','低'], textStyle:{color:muted},
      inRange:{color:diverges ? [blue,'#304052',red] : ramp}},
    tooltip:{formatter:e=>e.name + '　' + (Number.isFinite(e.value) ? fmt(e.value)+' '+unit : '暂无数据')},
    series:[{...baseMap,type:'map',data:rows.map(r=>({...r,value:r.value ?? NaN,
      ...(r.name===state.selected ? {itemStyle:{borderColor:'#fff',borderWidth:3},label:{show:true,color:'#fff',backgroundColor:'#152a38',padding:3}} : {})}))}]
  });
  mapClicks(c, p=>{state.selected=p;render();}, ()=>{state.selected=null;render();});
}
const axisStyle = {axisLine:{lineStyle:{color:gridLine}},axisLabel:{color:muted},axisTick:{show:false}};
const valueAxis = {type:'value',...axisStyle,splitLine:{lineStyle:{color:gridLine,type:'dashed'}}};
function bars(id, rows, unit, formatLabel) {
  chart(id,{
    grid:{left:13,right:20,top:20,bottom:16,containLabel:true},
    tooltip:{formatter:e=>e.name+'　'+fmt(e.value)+' '+unit},
    xAxis:{...valueAxis,splitNumber:3},yAxis:{type:'category',inverse:true,...axisStyle,
      axisLabel:{color:muted,fontSize:14,interval:0,formatter:formatLabel},data:rows.map(r=>r.name)},
    series:[{type:'bar',barMaxWidth:18,data:rows.map(r=>({value:r.value,itemStyle:{
      color:r.color || blue,borderColor:r.active?'#fff':undefined,borderWidth:r.active?2:0}}))}]
  });
}
function trend(id, values, kind) {
  chart(id,{grid:{left:12,right:18,top:16,bottom:6,containLabel:true},
    tooltip:{trigger:'axis',valueFormatter:v=>fmt(v)+' 万人'},
    xAxis:{type:'category',...axisStyle,data:years,boundaryGap:kind==='bar'},
    yAxis:{...valueAxis,scale:true,splitNumber:3},
    series:[{type:kind,data:values,showSymbol:false,itemStyle:{color:blue},
      ...(kind==='line'?{areaStyle:{opacity:.12}}:{})}]
  });
}
function overview() {
  const metric = $('metric').value;
  const [label,unit] = labels[metric];
  const i = years.indexOf(Number($('year').value));
  const p = state.selected, scope = p || '全国';
  const rows = provinces.map(name=>({name,value:metric==='pop'? D.panel[name][i] : D[metric][name]}));
  cards(i);
  heading('map','中国人口版图',years[i]+' 年 · '+label+'（'+unit+'）');
  overviewMap(rows,metric,unit);
  const sorted = rows.filter(r=>Number.isFinite(r.value)).sort((a,b)=>b.value-a.value);
  const ranking = sorted.map((r,index)=>({...r,rank:index+1})).filter(r=>r.rank<=10 || r.rank>sorted.length-5 || r.name===p);
  const ranked = new Map(ranking.map(r=>[r.name,r.rank]));
  const extra = ranking.length>15 ? ' · 含选中省' : '';
  heading('rank',label+'排行',years[i]+' 年 · '+unit+' · 前 10 / 后 5'+extra+(p && !ranked.has(p)?' · '+short(p)+'缺数':''));
  bars('rank',ranking.map(r=>({...r,active:r.name===p,color:r.name===p?red:blue})),unit,n=>(n===p?'◆ ':'')+ranked.get(n)+'  '+short(n));
  const values = p ? D.panel[p] : totals;
  heading('line',scope+'常住人口',span+' 年 · 万人');
  trend('line',values,'line');
  heading('growth',scope+'人口年度增量',span+' 年 · 万人');
  trend('growth',values.map((v,j)=>Number.isFinite(v)&&Number.isFinite(values[j-1])?v-values[j-1]:null),'bar');
  const parts = provinces.map(name=>({name,value:D.panel[name][i]})).filter(r=>Number.isFinite(r.value)).sort((a,b)=>b.value-a.value);
  const slices = p ? parts.filter(r=>r.name===p) : parts.slice(0,3);
  const rest = sum(parts.map(r=>r.value))-sum(slices.map(r=>r.value));
  heading('share','人口占全国比重',years[i]+' 年 · %'+(p && !slices.length?' · '+short(p)+'缺数':''));
  chart('share',{color:[blue,'#4489b1','#316484','#263c4a'],tooltip:{formatter:'{b}　{d}%'},
    series:[{type:'pie',radius:['32%','57%'],label:{color:muted,formatter:'{b}\n{d}%'},data:[...slices.map(r=>({...r,name:short(r.name)})),{name:'其余省份',value:rest}]}]});
}

function metricContext() {
  const metric = $('metric').value;
  const [label, unit] = labels[metric];
  const i = years.indexOf(state.year);
  return {
    metric, label, unit, year:metric === 'pop' ? state.year : 2020,
    population:p => D.panel[p][i],
    value:p => metric === 'pop' ? D.panel[p][i] : D[metric][p]
  };
}
function quantity(value, unit) {
  return Number.isFinite(value) ? fmt(value) + ' ' + unit : '暂无数据';
}
function flowPage() {
  const p = state.flow;
  const inbound = flows(p,true), outbound = flows(p,false);
  const meta = '2020 年七普 · 人';
  const context = metricContext();
  const details = [state.year + ' 年常住人口 ' + quantity(context.population(p), '万人')];
  if (context.metric !== 'pop') {
    details.push(context.year + ' 年' + context.label + ' ' + quantity(context.value(p), context.unit));
  }
  heading('flowTotals',short(p)+'跨省流动规模',[meta,...details].join(' · '));
  bars('flowTotals',[{name:'迁入',value:sum(inbound.map(r=>r[2])),color:red},{name:'迁出',value:sum(outbound.map(r=>r[2]))}], '人',n=>n);
  heading('flowRank',short(p)+'迁入来源前十',meta);
  const sources = inbound.slice(0,10).map(([name,,value])=>({name,value}));
  // 来源地同时列出人数，便于逐条核对飞线。
  const list = $('flowRank');
  list.replaceChildren();
  sources.forEach(({name,value},i)=>{
    const row=document.createElement('div');
    row.className='sourceRow';
    for (const text of [String(i+1).padStart(2,'0'),name,fmt(value)]) {
      const cell=document.createElement('span'); cell.textContent=text; row.append(cell);
    }
    list.append(row);
  });
  heading('flowMap',short(p)+'省际流向',meta+' · 迁入 / 迁出各前 10 · 点击省份切换');
  const series = [inbound,outbound].map((rows,j)=>({
    name:j?'迁出':'迁入', type:'lines',coordinateSystem:'geo',silent:true,z:3,
    symbol:['none','arrow'],symbolSize:7,lineStyle:{color:j?blue:red,curveness:.22,opacity:.8,width:1.6},
    effect:{show:true,symbol:'arrow',symbolSize:5,period:5,trailLength:0},
    data:rows.slice(0,10).map(([o,d,n])=>({name:o+' → '+d,value:n,coords:[D.center[o],D.center[d]]}))
  }));
  const c=chart('flowMap',{color:[red,blue],legend:{data:['迁入','迁出'],bottom:24,textStyle:{color:muted}},
    tooltip:{formatter:e=>e.seriesType==='lines'?e.name+'　'+fmt(e.value)+' 人':e.name},
    geo:{...baseMap,regions:[{name:p,itemStyle:{areaColor:'#487b96'},label:{show:true,color:'#fff'}}]},series});
  mapClicks(c,name=>{state.flow=name;flowPage();},()=>{});
}
function clusterPage() {
  const names=[...new Set(Object.values(D.cluster))].sort();
  const context = metricContext();
  heading('clusterMap','省份分型','2010–2020 年增长与 2020 年截面 · 类别');
  chart('clusterMap',{visualMap:{type:'piecewise',left:20,bottom:20,textStyle:{color:muted},
    pieces:names.map((label,i)=>({value:i,label,color:[red,...ramp.slice(1)][i]}))},
    tooltip:{formatter:e=>provinces.includes(e.name)
      ? [e.name + '　' + D.cluster[e.name], context.year + ' 年' + context.label + '　' + quantity(context.value(e.name), context.unit)].join('<br>')
      : e.name + '　暂无数据'},
    series:[{...baseMap,type:'map',data:provinces.map(name=>({name,value:names.indexOf(D.cluster[name])}))}]});
  heading('clusterMembers','各类成员省份',context.year + ' 年 · 按' + context.label + '降序（' + context.unit + '）');
  const list=$('clusterMembers');list.replaceChildren();
  names.forEach(name=>{
    const members=provinces.filter(p=>D.cluster[p]===name)
      .sort((a,b)=>(context.value(b) ?? -Infinity) - (context.value(a) ?? -Infinity));
    const populations = members.map(context.population).filter(Number.isFinite);
    const group=document.createElement('div'),detail=document.createElement('p');
    group.className='group';group.textContent=name+' · '+members.length+' 个';
    const summary=document.createElement('p');
    summary.textContent=state.year+' 年常住人口合计 '+quantity(populations.length ? sum(populations) : null,'万人')
      +(populations.length < members.length ? '（'+populations.length+' 省有值）' : '');
    detail.textContent=members.map(short).join('、');group.append(summary,detail);list.append(group);
  });
}
function render() {
  const overviewActive=state.page==='overview';
  $('year').disabled=overviewActive && $('metric').value!=='pop';
  $('year').value=$('year').disabled?2020:state.year;
  if(overviewActive) overview();
  else if(state.page==='flow') flowPage();
  else clusterPage();
}
function showPage(id) {
  state.page=id;
  document.querySelectorAll('.page').forEach(s=>{s.hidden=s.id!==id;});
  document.querySelectorAll('nav button').forEach(b=>{
    if(b.dataset.page===id)b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
  render();
}
function fit() {
  const scale=Math.min(innerWidth/1920,innerHeight/1080);
  $('stage').style.transform='translate(-50%, -50%) scale('+scale+')';
}
years.slice().reverse().forEach(y=>$('year').add(new Option(y,y)));
$('source').textContent='数据来源　'+D.meta['数据来源'];
$('year').onchange=()=>{state.year=Number($('year').value);render();};
$('metric').onchange=render;
document.querySelectorAll('nav button').forEach(b=>{b.onclick=()=>showPage(b.dataset.page);});
$('reset').onclick=()=>{Object.assign(state,{selected:null,flow:leader,year:latest});$('metric').value='pop';showPage('overview');};
window.addEventListener('resize',fit);
fit();
render();

