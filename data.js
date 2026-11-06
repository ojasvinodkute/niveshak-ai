// DEMO DATA: simulated prices (seeded random walks). Replace with real NSE data; see README.
const RAW=[
["RELIANCE","Reliance Industries","Energy & retail",1400,.14,.24],
["TCS","Tata Consultancy Services","IT services",3300,.06,.22],
["HDFCBANK","HDFC Bank","Banking",1000,.16,.20],
["INFY","Infosys","IT services",1500,.09,.25],
["ITC","ITC Ltd","FMCG & hotels",420,.12,.19],
["LT","Larsen & Toubro","Infrastructure",3600,.22,.27],
["BHARTIARTL","Bharti Airtel","Telecom",1900,.26,.23],
["SBIN","State Bank of India","Banking",850,.18,.30],
["SUNPHARMA","Sun Pharma","Pharma",1700,.15,.26],
["MARUTI","Maruti Suzuki","Automobiles",12500,.05,.28],
["TITAN","Titan Company","Consumer",3500,.20,.31],
["TATAMOTORS","Tata Motors","Automobiles",700,-.06,.38]];
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const STOCKS=RAW.map(([sym,name,sector,last,mu,vol],i)=>{
  const r=rng(i*977+13),N=520,p=[100];
  for(let d=1;d<N;d++){const z=Math.sqrt(-2*Math.log(r()+1e-9))*Math.cos(6.2832*r());
    p.push(p[d-1]*Math.exp(mu/252-vol*vol/504+vol/Math.sqrt(252)*z));}
  const k=last/p[N-1];return{sym,name,sector,prices:p.map(x=>x*k)};});
