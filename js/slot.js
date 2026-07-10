/* Игра 1: слот-автомат.
   Раунд 1 — три разных символа, раунд 2 — near-miss (два совпали, третий мимо),
   раунд 3 — 💰💰💰. Последний барабан всегда «дожимается» дольше,
   на остановке барабан слегка проседает и отыгрывает назад (settle). */
(function(){
"use strict";
const JACKPOT="💰";
const PLAIN=["🍒","🍋","🔔","⭐","💎","7️⃣","💵"];   // 💰 приберегаем для финала
const SYM_H=88, VISIBLE=3, REEL_LEN=40;

const ICON=`<svg viewBox="0 0 48 48">
  <rect x="4" y="8" width="40" height="32" rx="4" fill="url(#gCupDark)" stroke="#B4FF00" stroke-width="1.5"/>
  <rect x="8" y="13" width="9" height="22" rx="2" fill="#040a02"/>
  <rect x="19.5" y="13" width="9" height="22" rx="2" fill="#040a02"/>
  <rect x="31" y="13" width="9" height="22" rx="2" fill="#040a02"/>
  <circle cx="12.5" cy="24" r="3" fill="#B4FF00"/><circle cx="24" cy="24" r="3" fill="#E6FF7A"/>
  <circle cx="35.5" cy="24" r="3" fill="#A855F7"/>
  <rect x="4" y="20" width="40" height="1" fill="#B4FF00" opacity=".5"/>
</svg>`;

const rnd=()=>PLAIN[Math.floor(Math.random()*PLAIN.length)];

function symbolsFor(i,rounds){
  if(i===rounds-1) return [JACKPOT,JACKPOT,JACKPOT];
  const p=PLAIN.slice();
  for(let k=p.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[p[k],p[j]]=[p[j],p[k]];}
  return i===1 ? [p[0],p[0],p[1]] : p.slice(0,3);   // раунд 2 — near-miss
}
function buildStrip(el,centerSym){
  el.style.transition="none"; el.style.transform="translateY(0)"; el.innerHTML="";
  const arr=[]; for(let i=0;i<REEL_LEN;i++) arr.push(rnd());
  const target=REEL_LEN-2;
  arr[target]=centerSym; arr[target-1]=Math.random()<.5?centerSym:rnd();
  arr.forEach(s=>{const d=document.createElement("div");d.className="sym";d.textContent=s;el.appendChild(d);});
  return target;
}
function spinReel(api,el,centerSym,duration,anticipate){
  return new Promise(resolve=>{
    const target=buildStrip(el,centerSym);
    const finalY=-(target-1)*SYM_H, reel=el.parentElement;
    reel.classList.remove("settle");
    reel.classList.add("blur"); el.style.transform="translateY(0)"; void el.offsetHeight;
    if(anticipate){ reel.classList.add("anticipate"); api.sfxTension(duration); }
    const ease=anticipate ? "cubic-bezier(.1,.75,.05,1)" : "cubic-bezier(.15,.85,.25,1.05)";
    el.style.transition=`transform ${duration}ms ${ease}`;
    el.style.transform=`translateY(${finalY}px)`;
    const done=()=>{
      el.removeEventListener("transitionend",done);
      reel.classList.remove("blur","anticipate");
      // Отскок: барабан «доседает» на пружине, а не замирает мёртво.
      el.style.setProperty("--fy",finalY+"px");
      reel.classList.add("settle");
      api.sfxStop(); api.haptic("light"); resolve();
    };
    el.addEventListener("transitionend",done);
  });
}

TP.game({
  id:"slot", icon:ICON, name:"Слот", desc:"Три барабана · джекпот в финале",
  mount(stage,api){
    stage.innerHTML=`<div class="window">
        <div class="payline" id="payline"></div>
        <div class="reel"><div class="strip"></div></div>
        <div class="reel"><div class="strip"></div></div>
        <div class="reel"><div class="strip"></div></div>
      </div>`;
    const strips=[...stage.querySelectorAll(".strip")];
    const payline=stage.querySelector("#payline");
    strips.forEach(el=>{
      el.innerHTML="";
      for(let i=0;i<VISIBLE+1;i++){const d=document.createElement("div");d.className="sym";d.textContent=rnd();el.appendChild(d);}
    });
    api.status("Крути барабан — деньги ждут");
    api.hint("Нажми на кнопку");
    api.action("Крутить",spin);

    async function spin(){
      const r=api.begin(); if(!r) return;
      api.hint("Крутим... удача рядом"); api.status("🎰 Вращение...");
      api.sfxSpin(); api.haptic("medium");
      const syms=symbolsFor(r.round,api.ROUNDS);
      const nearMiss=syms[0]===syms[1]&&syms[1]!==syms[2];
      await spinReel(api,strips[0],syms[0],1200,false);
      await spinReel(api,strips[1],syms[1],1700,false);
      api.status((r.isLast||nearMiss) ? "😮 Два совпало... третий решает" : "Крутим...");
      await spinReel(api,strips[2],syms[2],r.isLast?3400:(nearMiss?3000:2200),r.isLast||nearMiss);
      if(nearMiss){
        const reel=strips[2].parentElement;
        reel.classList.remove("nearmiss"); void reel.offsetWidth; reel.classList.add("nearmiss");
        api.sfxNearMiss(); api.notify("warning");
        api.status("😖 Мимо на один символ!");
        await api.sleep(850);
      }
      payline.classList.remove("on"); void payline.offsetWidth; payline.classList.add("on");
      const isLast=api.complete();
      if(!isLast){
        api.hint(r.round===0 ? "🔥 Отличный старт! Крути ещё — суммы растут"
                             : "😤 Джекпот был в одном символе! Финальный спин — до 3 000 ₽");
        api.action("Крутить ещё",spin);
      }
    }
  }
});
})();
