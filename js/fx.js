/* Слой эффектов на canvas: фоновая пыль + взрыв монет на выигрыше.
   Один RAF-цикл на всё; при prefers-reduced-motion пыль отключается,
   а взрыв остаётся коротким. Частицы жёстко ограничены — телефон не должен греться. */
(function(){
"use strict";
const cv=document.getElementById("fx"), ctx=cv.getContext("2d");
const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let W=0,H=0,DPR=1;

function resize(){
  DPR=Math.min(window.devicePixelRatio||1, 2);
  W=cv.clientWidth; H=cv.clientHeight;
  cv.width=W*DPR; cv.height=H*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize",resize);

/* ── Фоновая пыль: медленные светящиеся точки, дают глубину ── */
const DUST = reduce ? 0 : 34;
const dust=[];
function seedDust(){
  dust.length=0;
  for(let i=0;i<DUST;i++) dust.push({
    x:Math.random()*W, y:Math.random()*H,
    r:.6+Math.random()*1.6, a:.06+Math.random()*.22,
    vy:-.05-Math.random()*.16, vx:(Math.random()-.5)*.06,
    hue:Math.random()<.72?"180,255,0":"168,85,247"
  });
}

/* ── Взрыв монет: физика с гравитацией и отскоком масштаба ── */
const parts=[];
const MAX=180;
function burst(opts){
  const n=Math.min(opts.count||70, MAX-parts.length);
  const cx=W/2, cy=H*.42;
  for(let i=0;i<n;i++){
    const ang=-Math.PI/2 + (Math.random()-.5)*Math.PI*1.15;
    const sp=(opts.power||1)*(3.2+Math.random()*6.4);
    parts.push({
      x:cx+(Math.random()-.5)*80, y:cy+(Math.random()-.5)*40,
      vx:Math.cos(ang)*sp*1.5, vy:Math.sin(ang)*sp,
      g:.16+Math.random()*.1, life:1,
      fade:.006+Math.random()*.006,
      size:5+Math.random()*9, spin:(Math.random()-.5)*.34, rot:Math.random()*6.3,
      gold:opts.gold!==false && Math.random()<.75
    });
  }
}

function drawCoin(p){
  const w=Math.abs(Math.cos(p.rot))*p.size+1.5;   // «монета» вращается вокруг оси
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.globalAlpha=Math.max(0,Math.min(1,p.life));
  const g=ctx.createLinearGradient(0,-p.size,0,p.size);
  if(p.gold){ g.addColorStop(0,"#fffbe6"); g.addColorStop(.5,"#ffd84d"); g.addColorStop(1,"#a97708"); }
  else { g.addColorStop(0,"#e8ffb0"); g.addColorStop(.5,"#B4FF00"); g.addColorStop(1,"#4d7300"); }
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(0,0,w/2,p.size/2,0,0,6.283); ctx.fill();
  ctx.globalAlpha*=.5; ctx.fillStyle="rgba(255,255,255,.7)";
  ctx.beginPath(); ctx.ellipse(-w/6,-p.size/6,w/8,p.size/7,0,0,6.283); ctx.fill();
  ctx.restore();
}

let running=false;
function loop(){
  ctx.clearRect(0,0,W,H);

  if(DUST){
    ctx.globalCompositeOperation="lighter";
    for(const d of dust){
      d.x+=d.vx; d.y+=d.vy;
      if(d.y<-4){ d.y=H+4; d.x=Math.random()*W; }
      ctx.fillStyle=`rgba(${d.hue},${d.a})`;
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,6.283); ctx.fill();
    }
    ctx.globalCompositeOperation="source-over";
  }

  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];
    p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.spin; p.life-=p.fade;
    if(p.life<=0 || p.y>H+40){ parts.splice(i,1); continue; }
    drawCoin(p);
  }
  running=true;
  requestAnimationFrame(loop);
}

function init(){
  resize(); seedDust();
  if(!running) requestAnimationFrame(loop);
}
window.addEventListener("resize",()=>{ resize(); seedDust(); });

window.FX={ init, burst, reduce };
})();
