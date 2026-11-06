const $=id=>document.getElementById(id),inr=n=>"₹"+Math.round(n).toLocaleString("en-IN");
const sma=(a,n)=>a.slice(-n).reduce((s,x)=>s+x,0)/Math.min(n,a.length);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const phi=x=>{const t=1/(1+.2316419*Math.abs(x)),d=.3989423*Math.exp(-x*x/2),p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p};
function rsi(a,n=14){let g=0,l=0;for(let i=a.length-n;i<a.length;i++){const d=a[i]-a[i-1];d>0?g+=d:l-=d}return l===0?100:100-100/(1+g/l)}
function analyse(s){
  const a=s.prices,L=a.at(-1),m50=sma(a,50),m200=sma(a,200),r=rsi(a);
  const lr=a.slice(1).map((x,i)=>Math.log(x/a[i])),mean=lr.reduce((x,y)=>x+y,0)/lr.length;
  const vol=Math.sqrt(lr.reduce((x,y)=>x+(y-mean)**2,0)/lr.length)*Math.sqrt(252);
  let pk=0,dd=0;a.forEach(x=>{pk=Math.max(pk,x);dd=Math.max(dd,1-x/pk)});
  const r6=L/a.at(-127)-1,r1=L/a.at(-253)-1;
  const trend=(L>m50?15:0)+(m50>m200?15:0),mom=clamp((r6+.1)/.4,0,1)*25;
  const rs=r<30?15:r<=65?20:r<=75?10:3,stab=clamp(1-(vol-.15)/.3,0,1)*15+clamp(1-(dd-.1)/.35,0,1)*10;
  const score=Math.round(trend+mom+rs+stab);
  const R=[];
  R.push(L>m50&&m50>m200?["","Uptrend: price is above both its 50-day and 200-day averages. Buyers have been in control."]:
    L<m50&&m50<m200?["b","Downtrend: price sits below both averages. Sellers have been in control."]:["w","Trend is mixed: price and averages disagree, so direction is unclear."]);
  R.push(r6>.1?["",`Gained ${(r6*100).toFixed(0)}% in the last 6 months, which shows strong momentum.`]:r6>0?["w",`Up only ${(r6*100).toFixed(0)}% in 6 months: slow progress.`]:["b",`Lost ${Math.abs(r6*100).toFixed(0)}% in 6 months.`]);
  R.push(r>75?["b",`RSI is ${r.toFixed(0)}: it has run up very fast and may cool off soon.`]:r>65?["w",`RSI is ${r.toFixed(0)}: getting expensive in the short term.`]:r<30?["w",`RSI is ${r.toFixed(0)}: fell sharply. It could bounce, or keep falling.`]:["",`RSI is ${r.toFixed(0)}: not overheated, which is healthy.`]);
  R.push(vol<.22?["",`Calm mover: typical yearly swing about ±${(vol*100).toFixed(0)}%.`]:vol<.3?["w",`Moderate swings: about ±${(vol*100).toFixed(0)}% a year. Expect bumpy months.`]:["b",`Wild swings: about ±${(vol*100).toFixed(0)}% a year. Only for a strong stomach.`]);
  R.push(dd<.2?["",`Worst fall in 2 years was ${(dd*100).toFixed(0)}%, which is mild.`]:["w",`Worst fall in 2 years was ${(dd*100).toFixed(0)}%. Could you sit through that?`]);
  return{...s,L,vol,dd,r1,score,R,m50,m200,
    label:score>=70?["strong","Looks strong"]:score>=50?["mixed","Mixed signals"]:["weak","Looks weak"]};}
const A=STOCKS.map(analyse);let risk="low",cur=null;
document.querySelectorAll("#risk button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#risk button").forEach(x=>x.classList.remove("on"));b.classList.add("on");risk=b.dataset.r});
$("go").onclick=()=>{
  const amt=+$("amt").value;if(!(amt>=1000)){$("amt").focus();return}
  const cap={low:.24,med:.31,high:9}[risk];
  const list=A.filter(s=>s.vol<cap).sort((a,b)=>b.score-a.score);
  const top=list.slice(0,4),tot=top.reduce((s,x)=>s+x.score,0),cols=["#0F766E","#14213D","#E07A1F","#6B5B95"];
  $("amtShow").textContent=inr(amt);
  $("split").innerHTML=top.map((s,i)=>`<div style="width:${s.score/tot*100}%;background:${cols[i]}">${s.sym}</div>`).join("");
  $("split").insertAdjacentHTML("afterend",`<div class="splitlist" id="sl"></div>`);
  document.querySelectorAll("#sl").forEach((e,i,all)=>{if(i<all.length-1)e.remove()});
  $("sl").innerHTML=top.map(s=>`<span>${s.sym}: <b>${inr(amt*s.score/tot)}</b></span>`).join("")+
   `<span class="note">Tip: many first-time investors put a large share in a Nifty 50 index fund and use stock picks for the rest.</span>`;
  $("cards").innerHTML=list.map((s,i)=>`<button class="card" data-i="${A.indexOf(s)}"><span class="rank">${i+1}</span>
   <span><b>${s.name}</b><small>${s.sym} · ${s.sector} · ${inr(s.L)}</small></span><span class="pill ${s.label[0]}">${s.label[1]} (${s.score}/100)</span></button>`).join("");
  document.querySelectorAll(".card").forEach(c=>c.onclick=()=>open(A[c.dataset.i],amt/Math.max(top.length,1)));
  $("results").hidden=false;$("detail").hidden=true;$("results").scrollIntoView();};
function open(s,def){cur=s;$("results").hidden=true;$("detail").hidden=false;
  $("dName").textContent=`${s.name} (${s.sym})`;$("dScore").style.width=s.score+"%";
  $("dVerdict").textContent=`AI score ${s.score}/100: ${s.label[1].toLowerCase()}.`;
  $("reasons").innerHTML=s.R.map(([c,t])=>`<li class="${c}">${t}</li>`).join("");
  $("cAmt").value=Math.round(def/1000)*1000||10000;draw(s);proj();$("detail").scrollIntoView();}
$("back").onclick=()=>{$("detail").hidden=true;$("results").hidden=false};
$("cAmt").oninput=$("cYrs").oninput=proj;
function proj(){if(!cur)return;const amt=+$("cAmt").value||0,t=+$("cYrs").value;$("yrs").textContent=t;
  const mu=.06+cur.score/100*.08,sg=cur.vol,m=(mu-sg*sg/2)*t,sd=sg*Math.sqrt(t);
  const lo=amt*Math.exp(m-sd),mid=amt*Math.exp(m),hi=amt*Math.exp(m+sd),pl=phi(-m/sd);
  const f=(x,c)=>`<b style="color:${c}">${inr(x)}</b><small>${x>=amt?"+":"−"}${inr(Math.abs(x-amt))}</small>`;
  $("proj").innerHTML=`<div><small>Bad luck (1 in 6 chance of worse)</small>${f(lo,"#C2410C")}</div><div><small>Most likely</small>${f(mid,"#14213D")}</div><div><small>Good luck (1 in 6 chance of better)</small>${f(hi,"#1B7F4B")}</div>`;
  $("projNote").textContent=`Chance of ending below what you put in: about ${(pl*100).toFixed(0)}%. Assumes about ${(mu*100).toFixed(1)}% average yearly growth (higher AI score gives a slightly higher assumption) and this stock's past swings. These are rough ranges, not promises. Gains from shares held over a year are taxed differently from shorter holds, so check current tax rules.`;}
function draw(s){const c=$("chart"),W=c.width=c.clientWidth*devicePixelRatio,H=c.height=280*devicePixelRatio,g=c.getContext("2d");
  const a=s.prices,mx=Math.max(...a),mn=Math.min(...a),X=i=>i/(a.length-1)*(W-20*devicePixelRatio)+10*devicePixelRatio,Y=v=>H-20*devicePixelRatio-(v-mn)/(mx-mn)*(H-40*devicePixelRatio);
  const line=(arr,col,w)=>{g.beginPath();arr.forEach((v,i)=>v==null?0:g[g._s?"lineTo":"moveTo"](X(i),Y(v))||(g._s=1));g._s=0;g.strokeStyle=col;g.lineWidth=w*devicePixelRatio;g.stroke()};
  const ma=n=>a.map((_,i)=>i<n-1?null:a.slice(i-n+1,i+1).reduce((x,y)=>x+y,0)/n);
  const draw1=(arr,col,w)=>{g.beginPath();let st=false;arr.forEach((v,i)=>{if(v==null)return;st?g.lineTo(X(i),Y(v)):(g.moveTo(X(i),Y(v)),st=true)});g.strokeStyle=col;g.lineWidth=w*devicePixelRatio;g.stroke()};
  g.clearRect(0,0,W,H);draw1(ma(200),"#0F766E",2);draw1(ma(50),"#E07A1F",2);draw1(a,"#14213D",2.5);
  g.fillStyle="#5B6478";g.font=`${12*devicePixelRatio}px sans-serif`;g.fillText(inr(mx),12*devicePixelRatio,14*devicePixelRatio);g.fillText(inr(mn),12*devicePixelRatio,H-4*devicePixelRatio);}
addEventListener("resize",()=>cur&&!$("detail").hidden&&draw(cur));
