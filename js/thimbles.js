/* Игра 2: напёрстки.
   Шарик показывают, чашки тасуются, игрок тыкает. Под выбранной чашкой
   приз есть всегда — проиграть нельзя, но раунд 2 подсовывает под соседней
   чашкой сумму крупнее: «отследил не ту» жжётся сильнее пустоты.
   Число перемешиваний растёт от раунда к раунду — ожидание удлиняется. */
(function(){
"use strict";
const SHUFFLES=[5,8,12];          // по раундам
const SWAP_MS=[300,240,190];      // и всё быстрее

TP.game({
  id:"thimbles", icon:"🥤", name:"Напёрстки", desc:"Следи за шариком · угадай чашку",
  mount(stage,api){
    stage.innerHTML=`<div class="table" id="tbl">
        <div class="tapme" id="tapme">Смотри внимательно</div>
        ${[0,1,2].map(i=>`<div class="slotpos" data-i="${i}">
            <span class="cup">🥤</span><span class="under"></span>
          </div>`).join("")}
        <div class="felt"></div>
      </div>`;
    const tbl=stage.querySelector("#tbl"), tapme=stage.querySelector("#tapme");
    const cups=[...stage.querySelectorAll(".slotpos")];
    let pos=[0,1,2];              // pos[cupIndex] = слот на столе
    let armed=false;

    const stepX=()=>tbl.clientWidth/3;
    const place=(instant)=>{
      cups.forEach((c,i)=>{
        c.style.transition = instant ? "none" : "";
        c.style.transform=`translateX(${pos[i]*stepX() + stepX()*0.5 - c.clientWidth/2}px)`;
      });
      if(instant){ void tbl.offsetWidth; cups.forEach(c=>c.style.transition=""); }
    };
    place(true);
    window.addEventListener("resize",()=>place(true));

    api.status("Три чашки — один шарик");
    api.hint("Нажми, чтобы начать раунд");
    api.action("Начать раунд",play);

    const reset=()=>cups.forEach(c=>{
      c.classList.remove("lift","reveal","dim","picked");
      c.querySelector(".under").className="under";
      c.querySelector(".under").textContent="";
    });

    async function shuffle(times,ms){
      tbl.classList.add("shuffling");
      cups.forEach(c=>c.style.transitionDuration=ms+"ms");
      for(let k=0;k<times;k++){
        const a=Math.floor(Math.random()*3);
        let b=Math.floor(Math.random()*3); while(b===a) b=Math.floor(Math.random()*3);
        [pos[a],pos[b]]=[pos[b],pos[a]];
        place(false); api.sfxSwap();
        await api.sleep(ms);
      }
      cups.forEach(c=>c.style.transitionDuration="");
      tbl.classList.remove("shuffling");
    }

    async function play(){
      const r=api.begin(); if(!r) return;
      reset(); armed=false;
      api.hint("Следи за шариком...");
      api.status("👀 Шарик под этой чашкой");
      // Показываем шарик под случайной чашкой — иллюзия честной слежки.
      const shown=Math.floor(Math.random()*3);
      cups[shown].classList.add("lift","reveal");
      cups[shown].querySelector(".under").textContent="💰";
      api.haptic("light");
      await api.sleep(1100);
      cups[shown].classList.remove("lift","reveal");
      cups[shown].querySelector(".under").textContent="";
      await api.sleep(350);

      api.status("🔀 Перемешиваем...");
      await shuffle(SHUFFLES[r.round],SWAP_MS[r.round]);

      api.status("👆 Где шарик? Выбирай");
      api.hint(r.isLast?"Финальный выбор — тут максимум":"Тыкни в чашку");
      tapme.textContent="Тапни по чашке";
      armed=true;
    }

    cups.forEach(cup=>cup.addEventListener("click",()=>{
      if(!armed) return;
      armed=false;
      pick(cup,{round:api.round(), isLast:api.isLast()});
    }));

    // Раскрытие: выбранная чашка всегда с призом, соседние — приманки.
    async function pick(cup,r){
      tapme.textContent="";
      cup.classList.add("picked");
      api.haptic("medium");
      const others=cups.filter(c=>c!==cup);
      const amount=api.amount();

      // Финал — сначала тянем паузу, потом джекпот.
      if(r.isLast){ api.status("😮 Поднимаем..."); api.sfxTension(1400); await api.sleep(1400); }
      else { api.status("Поднимаем..."); await api.sleep(600); }

      if(r.round===1){
        // Near-miss: одна из соседних чашек прячет сумму крупнее.
        const sting=others[Math.floor(Math.random()*others.length)];
        const other=others.find(c=>c!==sting);
        sting.classList.add("lift","reveal");
        const u=sting.querySelector(".under");
        u.className="under bigger"; u.textContent=api.decoyBigger(amount).toLocaleString("ru-RU")+" ₽";
        api.sfxNearMiss(); api.notify("warning");
        api.status("😖 Под соседней было больше!");
        tbl.classList.remove("nearmiss"); void tbl.offsetWidth; tbl.classList.add("nearmiss");
        await api.sleep(1000);
        other.classList.add("lift","reveal","dim");
        other.querySelector(".under").className="under miss";
        other.querySelector(".under").textContent="Пусто";
        await api.sleep(400);
      }else{
        others.forEach(c=>{
          c.classList.add("lift","reveal","dim");
          const u=c.querySelector(".under");
          u.className="under miss"; u.textContent="Пусто";
        });
        await api.sleep(500);
      }

      cup.classList.add("lift","reveal");
      const mine=cup.querySelector(".under");
      mine.className="under"; mine.textContent="💰 "+amount.toLocaleString("ru-RU")+" ₽";
      tbl.classList.remove("nearmiss");

      const isLast=api.complete();
      if(!isLast){
        api.hint(r.round===0 ? "🔥 Есть! Следующий раунд — сумма выше"
                             : "😤 Почти взял крупную! Финал — до 3 000 ₽");
        api.action("Ещё раунд",play);
      }
    }
  }
});
})();
