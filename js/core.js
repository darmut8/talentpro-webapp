/* ═══════════════════════════════════════════════════════════════
   TalentPro mini-casino — ядро.
   Экономика бонуса, звук, оверлеи и хаб выбора игры живут здесь.
   Игры (slot.js / thimbles.js / chests.js) регистрируются через TP.game()
   и получают раунд + сумму от движка — сами денег не назначают.
   ═══════════════════════════════════════════════════════════════ */
(function(){
"use strict";

const tg = window.Telegram.WebApp;
tg.ready(); tg.expand();
try{ tg.setHeaderColor("#000000"); tg.setBackgroundColor("#000000"); }catch(e){}

/* ─────────── Экономика ───────────
   Финальный раунд — взвешенная лотерея: почти все получают 1000-1500 ₽,
   крупные суммы редки. Средняя выплата ≈1425 ₽, но «сорвал 3000» остаётся
   реальной возможностью, а не обещанием каждому.
   Полосы первых раундов не пересекаются с джекпотом — лестница не ломается. */
const JACKPOT_TIERS=[[1000,34],[1300,26],[1500,20],[2000,12],[2500,6],[3000,2]];
const BANDS=[[200,500],[600,900]];      // ₽: раунд 1 и раунд 2
const ROUNDS=3;
const MAX_PRIZE=3000;

function weightedPick(tiers){
  const total=tiers.reduce((s,[,w])=>s+w,0);
  let r=Math.random()*total;
  for(const [val,w] of tiers){ if((r-=w)<=0) return val; }
  return tiers[0][0];
}
function round50(n){ return Math.round(n/50)*50; }
function amountFor(i){
  if(i===ROUNDS-1) return weightedPick(JACKPOT_TIERS);
  const [lo,hi]=BANDS[i];
  return round50(lo+Math.random()*(hi-lo));
}
// Приманки для соседних напёрстков/сундуков: рядом всегда «почти твои» деньги.
function decoyBigger(amount){ return Math.min(MAX_PRIZE, round50(amount+300+Math.random()*500)); }
function decoySmaller(amount){ return Math.max(100, round50(amount-150-Math.random()*350)); }

/* ─────────── Звук (Web Audio) ─────────── */
let AC=null;
function ac(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } return AC; }
function resume(){ ac(); if(AC&&AC.state==="suspended") AC.resume(); }
function tone(freq,dur,type="sine",vol=.2,delay=0){
  const c=ac(); if(!c) return;
  const o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.value=freq; o.connect(g); g.connect(c.destination);
  const t=c.currentTime+delay;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.01);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur); o.start(t); o.stop(t+dur);
}
function sfxSpin(){
  const c=ac(); if(!c) return;
  const o=c.createOscillator(), g=c.createGain(); o.type="sawtooth";
  o.frequency.setValueAtTime(120,c.currentTime);
  o.frequency.exponentialRampToValueAtTime(440,c.currentTime+1.8);
  g.gain.setValueAtTime(.07,c.currentTime); g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+2.2);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+2.2);
}
function sfxStop(){ tone(320,.08,"square",.15); }
// Ползущий вверх гул + учащающиеся «тики»: растянутое ожидание держит сильнее развязки.
function sfxTension(ms){
  const c=ac(); if(!c) return;
  const o=c.createOscillator(), g=c.createGain(); o.type="sawtooth";
  const t=c.currentTime, d=ms/1000;
  o.frequency.setValueAtTime(180,t); o.frequency.linearRampToValueAtTime(760,t+d);
  g.gain.setValueAtTime(.03,t); g.gain.linearRampToValueAtTime(.11,t+d*.85);
  g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+d);
  for(let i=0,p=0;p<d-.1;i++){ p+=Math.max(.07,.34-i*.02); tone(1180,.03,"square",.07,p); }
}
function sfxNearMiss(){ tone(300,.16,"sawtooth",.14); tone(190,.3,"sawtooth",.12,.12); }
function sfxWin(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,.35,"triangle",.22,i*.1)); }
function sfxCoin(){ tone(880,.06,"sine",.12); tone(1320,.08,"sine",.1,.05); }
function sfxSwap(){ tone(520,.05,"square",.06); }
function haptic(t){ try{ tg.HapticFeedback.impactOccurred(t); }catch(e){} }
function notify(t){ try{ tg.HapticFeedback.notificationOccurred(t); }catch(e){} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ─────────── DOM ─────────── */
const $=id=>document.getElementById(id);
const els={};
["bal","hub","game","games","stage","winbar","hint","actionBtn","actionSub","claimBtn",
 "backBtn","gameName","roundLabel","overlay","prize","bigwinTitle"].forEach(id=>els[id]=$(id));

/* ─────────── Состояние ─────────── */
const GAMES=[];
let current=null, roundIdx=0, pending=0, wonAmount=0, busy=false, finished=false;

function countUp(el,to,suffix=" ₽"){
  const dur=1000, start=performance.now();
  function step(now){
    const p=Math.min(1,(now-start)/dur);
    const val=Math.round(to*(1-Math.pow(1-p,3)));
    el.innerHTML=val.toLocaleString("ru-RU")+suffix;
    if(p<1){ if(val%500<40) sfxCoin(); requestAnimationFrame(step); }
    else el.innerHTML=to.toLocaleString("ru-RU")+suffix;
  }
  requestAnimationFrame(step);
}
function coinShower(isLast){
  const icons = isLast ? ["💰","💵","💎","⭐"] : ["💵","💎","⭐","✨"];
  for(let i=0;i<44;i++){
    const c=document.createElement("div"); c.className="coin";
    c.textContent=icons[Math.floor(Math.random()*icons.length)];
    c.style.left=Math.random()*100+"vw"; c.style.fontSize=(16+Math.random()*20)+"px";
    document.body.appendChild(c);
    const dur=1200+Math.random()*1400, drift=(Math.random()-.5)*160;
    c.animate([{transform:"translate(0,-40px) rotate(0)",opacity:1},
      {transform:`translate(${drift}px,105vh) rotate(${Math.random()*720}deg)`,opacity:.15}],
      {duration:dur,easing:"cubic-bezier(.3,.1,.6,1)"}).onfinish=()=>c.remove();
  }
}
function showBigWin(amount,isLast){
  els.bigwinTitle.textContent = isLast ? "Джекпот" : "Выигрыш";
  els.overlay.classList.add("on"); countUp(els.prize,amount,"<span>₽</span>");
  setTimeout(()=>els.overlay.classList.remove("on"),2200);
}
function updateRoundLabel(){
  const txt = roundIdx<ROUNDS ? `Раунд ${roundIdx+1}/${ROUNDS}` : "Финал";
  els.roundLabel.textContent=txt; els.actionSub.textContent=txt;
}

/* ─────────── API для игр ─────────── */
// begin() выдаёт раунд и сумму; complete() закрывает раунд и показывает выигрыш.
const api={
  ROUNDS, sleep, tone, haptic, notify, sfxStop, sfxSpin, sfxTension, sfxNearMiss, sfxSwap, resume,
  decoyBigger, decoySmaller,
  round:()=>roundIdx,
  isLast:()=>roundIdx===ROUNDS-1,
  amount:()=>pending,          // сумма текущего раунда, выданная begin()
  status:t=>{ els.winbar.innerHTML=t; },
  hint:t=>{ els.hint.innerHTML=t; },
  // Кнопка внизу: игры с тапом по столу её прячут, слот — использует.
  action:(label,onClick)=>{
    const btn=els.actionBtn;
    if(!label){ btn.style.display="none"; return; }
    btn.style.display="";
    btn.querySelector("span").firstChild.textContent=label;
    btn.onclick=onClick;
  },
  enable:on=>{ els.actionBtn.disabled=!on; },
  begin(){
    if(busy||finished||roundIdx>=ROUNDS) return null;
    busy=true; resume(); els.backBtn.disabled=true; els.actionBtn.disabled=true;
    pending=amountFor(roundIdx);
    return {round:roundIdx, isLast:roundIdx===ROUNDS-1, amount:pending};
  },
  complete(){
    const isLast=roundIdx===ROUNDS-1;
    wonAmount=pending; roundIdx++; updateRoundLabel();
    sfxWin(); notify("success"); coinShower(isLast);
    els.winbar.innerHTML="🎉 Выигрыш: <b>"+wonAmount.toLocaleString("ru-RU")+" ₽</b>";
    countUp(els.bal,wonAmount); showBigWin(wonAmount,isLast);
    busy=false;
    if(isLast){
      // Пик достигнут → CTA + микро-ургентность (loss aversion).
      // Возврат в хаб закрыт: иначе бонус можно было бы перекручивать до 3000 ₽.
      els.actionBtn.style.display="none";
      els.backBtn.disabled=true;
      els.hint.innerHTML="⏳ Бонус активен ограниченное время — забери!";
      els.claimBtn.style.display="block";
    }else{
      els.actionBtn.disabled=false;
      els.backBtn.disabled=false;
    }
    return isLast;
  }
};

/* ─────────── Хаб и навигация ─────────── */
function buildHub(){
  els.games.innerHTML="";
  GAMES.forEach(g=>{
    const b=document.createElement("button");
    b.className="gcard";
    b.innerHTML=`<span class="ic">${g.icon}</span>
      <span class="txt"><span class="gt">${g.name}</span><span class="gd">${g.desc}</span></span>
      <span class="go">до ${MAX_PRIZE.toLocaleString("ru-RU")} ₽</span>`;
    b.onclick=()=>startGame(g);
    els.games.appendChild(b);
  });
}
function startGame(g){
  current=g; roundIdx=0; wonAmount=0; pending=0; busy=false; finished=false;
  els.bal.textContent="0 ₽";
  els.gameName.textContent=g.name;
  els.claimBtn.style.display="none";
  els.actionBtn.style.display=""; els.actionBtn.disabled=false;
  els.backBtn.disabled=false;
  els.stage.innerHTML="";
  updateRoundLabel();
  resume(); haptic("light");
  els.hub.classList.remove("on"); els.game.classList.add("on");
  g.mount(els.stage,api);
}
function toHub(){
  if(busy||finished) return;
  current=null;
  els.game.classList.remove("on"); els.hub.classList.add("on");
  els.stage.innerHTML=""; els.bal.textContent="0 ₽";
  els.overlay.classList.remove("on");
}

window.TP={
  game:g=>GAMES.push(g),
  init(){
    buildHub();
    els.backBtn.onclick=toHub;
    els.claimBtn.onclick=()=>{
      if(finished||!wonAmount) return;
      finished=true; haptic("medium");
      tg.sendData(JSON.stringify({bonus:wonAmount, game:current?current.id:"unknown"}));
      tg.close();
    };
  }
};
})();
