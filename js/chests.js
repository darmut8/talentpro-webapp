/* Игра 3: сундуки.
   Без тасования — напряжение строится на очереди вскрытия: сначала медленно
   открываются чужие сундуки, свой уходит на десерт. В раунде 2 в чужом сундуке
   лежит сумма крупнее (near-miss). Выбранный сундук всегда с деньгами.
   Крышка откидывается 3D-поворотом (rotateX), а не подменой картинки. */
(function(){
"use strict";
// Старая закешированная оболочка идёт без SVG-спрайта — тогда рисуем emoji.
const SPRITE=!!document.getElementById("chestBody");
const CHEST=SPRITE?`<span class="chest">
    <span class="lid"><svg viewBox="0 0 110 30" preserveAspectRatio="none"><use href="#chestLid"/></svg></span>
    <span class="body"><svg viewBox="0 0 110 60" preserveAspectRatio="none"><use href="#chestBody"/></svg></span>
  </span>`:`<span class="chest emo">📦</span>`;
// У <use> на symbol размеры задаём явно — иначе символ растянется на весь viewBox.
const ICON=SPRITE?`<svg viewBox="0 0 110 88">
    <use href="#chestLid" x="0" y="0" width="110" height="30"/>
    <use href="#chestBody" x="0" y="29" width="110" height="59"/>
  </svg>`:`<span class="emo">📦</span>`;
const COIN=SPRITE?`<svg viewBox="0 0 40 40" style="width:22px;height:22px;vertical-align:-4px"><use href="#coin"/></svg>`:"💰";

TP.game({
  id:"chests", icon:ICON, name:"Сундуки", desc:"Три коробки · выбери свою",
  mount(stage,api){
    stage.innerHTML=`<div class="table" id="tbl">
        <div class="tapme" id="tapme">Нажми «Открыть раунд»</div>
        ${[0,1,2].map(()=>`<div class="slotpos chestwrap">
            <span class="cup">${CHEST}</span><span class="under"></span>
          </div>`).join("")}
        <div class="felt"></div>
      </div>`;
    const tbl=stage.querySelector("#tbl"), tapme=stage.querySelector("#tapme");
    const boxes=[...stage.querySelectorAll(".slotpos")];
    let armed=false;

    const place=()=>{
      const step=tbl.clientWidth/3;
      boxes.forEach((b,i)=>b.style.transform=`translateX(${i*step + step*0.5 - b.clientWidth/2}px)`);
    };
    place();
    window.addEventListener("resize",place);

    api.status("Деньги в одном из сундуков");
    api.hint("Нажми, чтобы начать раунд");
    api.action("Открыть раунд",play);

    function reset(){
      boxes.forEach(b=>{
        b.classList.remove("lift","reveal","dim","picked");
        b.querySelector(".chest").classList.remove("open");
        const u=b.querySelector(".under"); u.className="under"; u.innerHTML="";
      });
    }

    function play(){
      const r=api.begin(); if(!r) return;
      reset(); armed=true;
      tapme.textContent="Тапни по сундуку";
      api.status(r.isLast?"🔥 Финальный сундук — тут максимум":"👆 Выбирай сундук");
      api.hint("Твой выбор решает сумму");
      api.haptic("light");
    }

    boxes.forEach(box=>box.addEventListener("click",()=>{
      if(!armed) return;
      armed=false;
      open(box,{round:api.round(), isLast:api.isLast()});
    }));

    async function open(box,r){
      tapme.textContent="";
      box.classList.add("picked");
      api.haptic("medium");
      const amount=api.amount();
      const others=boxes.filter(b=>b!==box);

      api.status("Вскрываем остальные...");
      await api.sleep(500);

      // Чужие сундуки — по одному, с паузой: каждая пауза работает на ожидание.
      for(let i=0;i<others.length;i++){
        const c=others[i], u=c.querySelector(".under");
        const sting = r.round===1 && i===0;     // раунд 2: в первом чужом — больше денег
        c.classList.add("reveal");
        c.querySelector(".chest").classList.add("open");
        api.sfxLid();
        if(sting){
          u.className="under bigger"; u.textContent=api.decoyBigger(amount).toLocaleString("ru-RU")+" ₽";
          api.sfxNearMiss(); api.notify("warning");
          api.status("😖 Не тот сундук!");
          tbl.classList.remove("nearmiss"); void tbl.offsetWidth; tbl.classList.add("nearmiss");
        }else{
          c.classList.add("dim");
          u.className="under miss"; u.textContent="Пусто";
        }
        await api.sleep(sting?1100:650);
      }

      // Свой — последним, с растянутой паузой на финале.
      api.status(r.isLast?"😮 Твой сундук...":"Открываем твой...");
      if(r.isLast){ api.sfxTension(1500); await api.sleep(1500); } else await api.sleep(600);

      box.classList.add("reveal");
      box.querySelector(".chest").classList.add("open");
      api.sfxLid();
      const mine=box.querySelector(".under");
      mine.className="under"; mine.innerHTML=COIN+" "+amount.toLocaleString("ru-RU")+" ₽";
      tbl.classList.remove("nearmiss");

      const isLast=api.complete();
      if(!isLast){
        api.hint(r.round===0 ? "🔥 Отлично! Дальше суммы крупнее"
                             : "😤 Рядом лежало больше! Финал — до 3 000 ₽");
        api.action("Ещё раунд",play);
      }
    }
  }
});
})();
