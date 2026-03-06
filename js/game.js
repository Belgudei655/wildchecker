'use strict';

// ================================================================
// AMBIENT BG
// ================================================================
(function(){
  const c=document.getElementById('bgCanvas'),ctx=c.getContext('2d');
  let W,H,stars=[];
  function resize(){W=c.width=window.innerWidth;H=c.height=window.innerHeight;stars=[];for(let i=0;i<140;i++)stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.5,sp:0.08+Math.random()*0.22,op:Math.random(),ph:Math.random()*Math.PI*2,col:Math.random()<0.5?'255,45,85':'0,212,255'});}
  resize();window.addEventListener('resize',resize);
  let t=0;(function f(){ctx.clearRect(0,0,W,H);t+=0.004;for(const s of stars){s.op=0.12+0.52*Math.abs(Math.sin(t*s.sp+s.ph));ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle=`rgba(${s.col},${s.op})`;ctx.fill();}requestAnimationFrame(f);})();
})();

// ================================================================
// GAME ENGINE
// ================================================================
const EMPTY=0,RED=1,BLUE=2,RK=3,BK=4,BOARD=10;
let G={board:[],cur:RED,sel:null,valid:[],chain:null,turn:1,caps:[0,0],over:false,timeLeft:[300,300],totalTime:300,timerInt:null,settings:{time:5,n1:'Player 1',n2:'Player 2',av1:'🦁',av2:'🐺',coins:[1000,1000]},killCount:0,netLocalSeq:1,netRemoteSeq:1};
let BC,FC,bCtx,fCtx,CELL,BPX,fxP=[],fxFr=null,movPiece=null;

function initCanvas(){
  BC=document.getElementById('boardCanvas');FC=document.getElementById('fxCanvas');
  bCtx=BC.getContext('2d');fCtx=FC.getContext('2d');
  const sz=BC.offsetWidth;BC.width=BC.height=FC.width=FC.height=sz;
  BPX=sz;CELL=sz/BOARD;
  BC.removeEventListener('click',onBoardClick);BC.addEventListener('click',onBoardClick);
  drawBoard();
}

function shouldFlipBoardForViewer(){
  return onlineMode&&myColor===BLUE;
}

function toViewCell(modelR,modelC){
  if(!shouldFlipBoardForViewer())return {r:modelR,c:modelC};
  return {r:BOARD-1-modelR,c:BOARD-1-modelC};
}

function toModelCell(viewR,viewC){
  if(!shouldFlipBoardForViewer())return {r:viewR,c:viewC};
  return {r:BOARD-1-viewR,c:BOARD-1-viewC};
}

function modelCellCenter(modelR,modelC){
  const cell=toViewCell(modelR,modelC);
  return {x:cell.c*CELL+CELL/2,y:cell.r*CELL+CELL/2};
}

function drawBoard(){
  if(!bCtx)return;
  for(let r=0;r<BOARD;r++)for(let c=0;c<BOARD;c++){bCtx.fillStyle=(r+c)%2===0?'#181828':'#0e0e1c';bCtx.fillRect(c*CELL,r*CELL,CELL,CELL);}
  bCtx.strokeStyle='rgba(255,255,255,0.02)';bCtx.lineWidth=0.5;
  for(let i=0;i<=BOARD;i++){bCtx.beginPath();bCtx.moveTo(i*CELL,0);bCtx.lineTo(i*CELL,BPX);bCtx.stroke();bCtx.beginPath();bCtx.moveTo(0,i*CELL);bCtx.lineTo(BPX,i*CELL);bCtx.stroke();}
  for(const mv of G.valid){
    const cell=toViewCell(mv.toR,mv.toC);
    const x=cell.c*CELL,y=cell.r*CELL;
    bCtx.fillStyle='rgba(57,255,20,0.1)';bCtx.fillRect(x,y,CELL,CELL);
    bCtx.strokeStyle='rgba(57,255,20,0.48)';bCtx.lineWidth=2;bCtx.strokeRect(x+1,y+1,CELL-2,CELL-2);
    bCtx.beginPath();bCtx.arc(x+CELL/2,y+CELL/2,CELL*.1,0,Math.PI*2);bCtx.fillStyle='rgba(57,255,20,0.42)';bCtx.fill();
  }
  for(let r=0;r<BOARD;r++)for(let c=0;c<BOARD;c++){
    const p=G.board[r][c];
    if(p&&(!movPiece||(r!==movPiece.fR||c!==movPiece.fC))){
      const cell=toViewCell(r,c);
      drawPiece(bCtx,cell.c*CELL+CELL/2,cell.r*CELL+CELL/2,CELL*.38,p);
    }
  }
  if(G.sel){
    const cell=toViewCell(G.sel.r,G.sel.c);
    bCtx.save();bCtx.strokeStyle='rgba(255,215,0,0.88)';bCtx.lineWidth=3;bCtx.shadowColor='rgba(255,215,0,0.7)';bCtx.shadowBlur=8;bCtx.strokeRect(cell.c*CELL+2,cell.r*CELL+2,CELL-4,CELL-4);bCtx.restore();bCtx.fillStyle='rgba(255,215,0,0.05)';bCtx.fillRect(cell.c*CELL,cell.r*CELL,CELL,CELL);
  }
}

function drawPiece(ctx,x,y,radius,type,alpha=1){
  const iR=type===RED||type===RK,iK=type===RK||type===BK;
  ctx.save();ctx.globalAlpha=alpha;
  ctx.beginPath();ctx.arc(x+2,y+3,radius,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,0.48)';ctx.fill();
  const g=ctx.createRadialGradient(x-radius*.3,y-radius*.3,radius*.08,x,y,radius);
  if(iR){g.addColorStop(0,'#ff7070');g.addColorStop(.5,'#ff2d55');g.addColorStop(1,'#6b001e');}
  else{g.addColorStop(0,'#70e8ff');g.addColorStop(.5,'#00d4ff');g.addColorStop(1,'#004060');}
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.strokeStyle=iR?'rgba(255,110,110,0.6)':'rgba(110,228,255,0.6)';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,radius+3.5,0,Math.PI*2);ctx.strokeStyle=iR?'rgba(255,45,85,0.16)':'rgba(0,212,255,0.16)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.beginPath();ctx.arc(x-radius*.27,y-radius*.27,radius*.27,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.19)';ctx.fill();
  if(iK){ctx.font=`bold ${radius*.88}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=8;ctx.fillText('♔',x,y+1);ctx.shadowBlur=0;}
  ctx.restore();
}

// FX
function fxLoop(){
  fCtx.clearRect(0,0,BPX,BPX);fxP=fxP.filter(p=>p.life>0);
  for(const p of fxP){
    if(p.ring){fCtx.save();fCtx.beginPath();fCtx.arc(p.x,p.y,p.r,0,Math.PI*2);fCtx.strokeStyle=p.color+Math.floor(p.life*255).toString(16).padStart(2,'0');fCtx.lineWidth=p.lw*p.life;if(p.glow){fCtx.shadowColor=p.color;fCtx.shadowBlur=9*p.life;}fCtx.stroke();fCtx.restore();p.r+=(p.maxR-p.r)*.17;p.life-=p.decay;}
    else if(p.spark){fCtx.save();fCtx.beginPath();fCtx.moveTo(p.x,p.y);fCtx.lineTo(p.x+p.vx*3,p.y+p.vy*3);fCtx.strokeStyle=p.color+Math.floor(p.life*255).toString(16).padStart(2,'0');fCtx.lineWidth=p.w*p.life;fCtx.shadowColor=p.color;fCtx.shadowBlur=5*p.life;fCtx.stroke();fCtx.restore();p.x+=p.vx;p.y+=p.vy;p.vx*=0.9;p.vy*=0.9;p.life-=p.decay;}
    else{fCtx.save();fCtx.beginPath();fCtx.arc(p.x,p.y,Math.max(0.1,p.size*p.life),0,Math.PI*2);fCtx.fillStyle=p.color+Math.floor(p.life*205).toString(16).padStart(2,'0');if(p.glow){fCtx.shadowColor=p.color;fCtx.shadowBlur=6*p.life;}fCtx.fill();fCtx.restore();p.x+=p.vx;p.y+=p.vy;p.vx*=0.88;p.vy*=0.88;p.life-=p.decay;}
  }
  if(movPiece){
    const mp=movPiece;mp.t+=mp.spd;
    if(mp.t>=1){mp.t=1;drawPiece(fCtx,mp.tx,mp.ty,CELL*.38,mp.piece);spawnArrival(mp.tx,mp.ty,mp.piece);movPiece=null;finishMove(mp);}
    else{
      const e=easeOutBack(mp.t),cx=(mp.fx+mp.tx)/2,cy=(mp.fy+mp.ty)/2-(CELL*.72*Math.sin(Math.PI*mp.t));
      const bx=lerp(lerp(mp.fx,cx,e),lerp(cx,mp.tx,e),e),by=lerp(lerp(mp.fy,cy,e),lerp(cy,mp.ty,e),e);
      if(mp.t>0.06)fxP.push({x:bx,y:by,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,size:CELL*.065,color:mp.piece===RED||mp.piece===RK?'#ff2d55':'#00d4ff',life:0.5,decay:0.052,glow:true});
      drawPiece(fCtx,bx,by,CELL*.38,mp.piece);
    }
  }
  if(fxP.length>0||movPiece)fxFr=requestAnimationFrame(fxLoop);
  else{fxFr=null;fCtx.clearRect(0,0,BPX,BPX);}
}
function lerp(a,b,t){return a+(b-a)*t;}
function easeOutBack(t){const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);}
function ensureFx(){if(!fxFr)fxFr=requestAnimationFrame(fxLoop);}

function spawnCapFx(r,c){
  const ctr=modelCellCenter(r,c),cx=ctr.x,cy=ctr.y;const cols=['#ff2d55','#ff7043','#ffd700','#ff00bb','#fff'];
  for(let i=0;i<22;i++){const a=Math.PI*2*i/22+Math.random()*.2,sp=2.5+Math.random()*5;fxP.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,size:CELL*.1+Math.random()*CELL*.08,color:cols[i%5],life:1,decay:.032+Math.random()*.02,glow:true});}
  for(let i=0;i<15;i++){const a=Math.PI*2*i/15,sp=3+Math.random()*5.5;fxP.push({spark:true,x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,w:2+Math.random()*2,color:cols[i%5],life:1,decay:.046});}
  fxP.push({ring:true,x:cx,y:cy,r:5,maxR:CELL*.8,life:1,decay:.053,color:'#ffd700',lw:4,glow:true});
  fxP.push({ring:true,x:cx,y:cy,r:CELL*.18,maxR:CELL*.46,life:0.65,decay:.072,color:'#ff2d55',lw:2,glow:false});
  ensureFx();
}
function spawnArrival(x,y,piece){
  const col=piece===RED||piece===RK?'#ff2d55':'#00d4ff';
  fxP.push({ring:true,x,y,r:2,maxR:CELL*.52,life:0.72,decay:.082,color:col,lw:2.5,glow:true});
  for(let i=0;i<7;i++){const a=Math.PI*2*i/7;fxP.push({spark:true,x,y,vx:Math.cos(a)*1.8,vy:Math.sin(a)*1.8,w:1.3,color:col,life:0.62,decay:.073});}
  ensureFx();
}
function spawnKingFx(r,c){
  const ctr=modelCellCenter(r,c),cx=ctr.x,cy=ctr.y;const cols=['#ffd700','#fff','#ff2d55'];
  for(let i=0;i<28;i++){const a=Math.PI*2*i/28+Math.random()*.18,sp=1.5+Math.random()*3.8;fxP.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,size:CELL*.065+Math.random()*CELL*.09,color:cols[i%3],life:1,decay:.023,glow:true});}
  for(let i=0;i<3;i++)fxP.push({ring:true,x:cx,y:cy,r:5+i*CELL*.08,maxR:CELL*(.86+i*.17),life:0.75+i*.1,decay:.046,color:'#ffd700',lw:3-i,glow:true});
  ensureFx();
}

function flashScreen(col){const el=document.getElementById('flashOverlay');el.style.background=col;el.style.animation='none';el.offsetHeight;el.style.animation='xfade 0.3s ease-out forwards';}
const _xf=document.createElement('style');_xf.textContent='@keyframes xfade{from{opacity:0.4}to{opacity:0}}';document.head.appendChild(_xf);
function shakeBoard(n=6){const el=document.getElementById('boardOuter');el.style.animation='none';el.offsetHeight;el.style.setProperty('--si',n+'px');el.style.animation='bshake 0.33s ease-out';}
const _sh=document.createElement('style');_sh.textContent='@keyframes bshake{0%,100%{transform:none}15%{transform:translateX(calc(-1*var(--si)))}30%{transform:translateX(var(--si))}45%{transform:translateX(calc(-.6*var(--si)))}60%{transform:translateX(calc(.4*var(--si)))}80%{transform:translateX(calc(-.2*var(--si)))}}';document.head.appendChild(_sh);
function hudFlash(player){const el=document.getElementById(player===RED?'hud2':'hud1');el.classList.remove('fr','fb');el.offsetHeight;el.classList.add(player===RED?'fr':'fb');setTimeout(()=>el.classList.remove('fr','fb'),300);}

function animMove(fR,fC,tR,tC,piece,done){
  const from=modelCellCenter(fR,fC),to=modelCellCenter(tR,tC);
  movPiece={fR,fC,toR:tR,toC:tC,fx:from.x,fy:from.y,tx:to.x,ty:to.y,piece,t:0,spd:0.075,onDone:done};
  ensureFx();
}
function finishMove(mp){if(mp.onDone)mp.onDone();drawBoard();}

// GAME LOGIC
function initBoard(){
  const b=Array.from({length:BOARD},()=>Array(BOARD).fill(EMPTY));
  for(let r=0;r<4;r++)for(let c=0;c<BOARD;c++)if((r+c)%2===1)b[r][c]=BLUE;
  for(let r=6;r<BOARD;r++)for(let c=0;c<BOARD;c++)if((r+c)%2===1)b[r][c]=RED;
  return b;
}
function getCaps(board,r,c){
  const p=board[r][c],iR=p===RED||p===RK,iK=p===RK||p===BK;
  const en=iR?[BLUE,BK]:[RED,RK];const caps=[];
  // International draughts: ALL pieces can capture backward too
  const dirs=[[-1,-1],[-1,1],[1,-1],[1,1]];
  for(const[dr,dc]of dirs){
    if(iK){let d=1,foe=null,fp=null;while(true){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=BOARD||nc<0||nc>=BOARD)break;const cell=board[nr][nc];if(!foe){if(en.includes(cell)){foe=cell;fp={r:nr,c:nc};}else if(cell!==EMPTY)break;}else{if(cell===EMPTY)caps.push({toR:nr,toC:nc,capR:fp.r,capC:fp.c});else break;}d++;}}
    else{const mr=r+dr,mc=c+dc,lr=r+dr*2,lc=c+dc*2;if(lr>=0&&lr<BOARD&&lc>=0&&lc<BOARD&&en.includes(board[mr][mc])&&board[lr][lc]===EMPTY)caps.push({toR:lr,toC:lc,capR:mr,capC:mc});}
  }
  return caps;
}
function getMoves(board,r,c){
  const p=board[r][c],iR=p===RED||p===RK,iK=p===RK||p===BK;const moves=[];
  const dirs=iK?[[-1,-1],[-1,1],[1,-1],[1,1]]:iR?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];
  for(const[dr,dc]of dirs){
    if(iK){let d=1;while(true){const nr=r+dr*d,nc=c+dc*d;if(nr<0||nr>=BOARD||nc<0||nc>=BOARD||board[nr][nc]!==EMPTY)break;moves.push({toR:nr,toC:nc,capR:null,capC:null});d++;}}
    else{const nr=r+dr,nc=c+dc;if(nr>=0&&nr<BOARD&&nc>=0&&nc<BOARD&&board[nr][nc]===EMPTY)moves.push({toR:nr,toC:nc,capR:null,capC:null});}
  }
  return moves;
}
function getAllCaps(board,player){
  const all=[];for(let r=0;r<BOARD;r++)for(let c=0;c<BOARD;c++){const p=board[r][c];if(p===player||p===player+2)for(const mv of getCaps(board,r,c))all.push({fromR:r,fromC:c,...mv});}
  return all;
}
function getAllMoves(board,player){
  const caps=getAllCaps(board,player);if(caps.length)return caps;
  const moves=[];for(let r=0;r<BOARD;r++)for(let c=0;c<BOARD;c++){const p=board[r][c];if(p===player||p===player+2)for(const mv of getMoves(board,r,c))moves.push({fromR:r,fromC:c,...mv});}
  return moves;
}

function onBoardClick(e){
  if(G.over||movPiece)return;
  if(onlineMode&&G.cur!==myColor)return;
  const rect=BC.getBoundingClientRect(),sx=BC.width/rect.width,sy=BC.height/rect.height;
  const x=(e.clientX-rect.left)*sx,y=(e.clientY-rect.top)*sy;
  const viewC=Math.floor(x/CELL),viewR=Math.floor(y/CELL);
  if(viewR>=0&&viewR<BOARD&&viewC>=0&&viewC<BOARD){
    const model=toModelCell(viewR,viewC);
    clickCell(model.r,model.c);
  }
}

function clickCell(r,c){
  const player=G.cur,board=G.board,p=board[r][c];const own=p===player||p===player+2;
  if(G.chain){const{r:cr,c:cc}=G.chain;const mv=G.valid.find(m=>m.toR===r&&m.toC===c);if(mv){execMove(mv,cr,cc);return;}return;}
  if(own){
    const ac=getAllCaps(board,player);
    if(ac.length){const pc=ac.filter(m=>m.fromR===r&&m.fromC===c);if(!pc.length){setStatus('⚠️ Must capture!');return;}G.sel={r,c};G.valid=pc;}
    else{G.sel={r,c};G.valid=getMoves(board,r,c).map(m=>({fromR:r,fromC:c,...m}));}
    sndSelect();drawBoard();return;
  }
  if(G.sel){const mv=G.valid.find(m=>m.toR===r&&m.toC===c);if(mv){execMove(mv,G.sel.r,G.sel.c);return;}}
  G.sel=null;G.valid=[];drawBoard();
}

function execMove(mv,fR,fC,fromNetwork=false){
  if(movPiece)return;
  const board=G.board,piece=board[fR][fC],isCap=mv.capR!==null;
  board[mv.toR][mv.toC]=piece;board[fR][fC]=EMPTY;
  if(isCap)board[mv.capR][mv.capC]=EMPTY;
  if(onlineMode&&!fromNetwork){
    sendNet({type:'move',seq:G.netLocalSeq,turn:G.turn,player:G.cur,fR,fC,tR:mv.toR,tC:mv.toC,cR:mv.capR??null,cC:mv.capC??null});
    G.netLocalSeq++;
  }
  sndMove();
  animMove(fR,fC,mv.toR,mv.toC,piece,()=>afterAnim(mv,fR,fC,piece,isCap));
  drawBoard();
}

function afterAnim(mv,fR,fC,piece,isCap){
  const board=G.board;
  if(isCap){
    const pi=G.cur===RED?0:1;G.caps[pi]++;G.killCount++;
    spawnCapFx(mv.capR,mv.capC);flashScreen(G.cur===RED?'rgba(255,45,85,0.26)':'rgba(0,212,255,0.26)');
    shakeBoard(G.killCount>=4?9:5);hudFlash(G.cur);showKillBadge(G.killCount);
    let promo=false;
    if(piece===RED&&mv.toR===0){board[mv.toR][mv.toC]=RK;sndKingPromo();spawnKingFx(mv.toR,mv.toC);promo=true;}
    if(piece===BLUE&&mv.toR===9){board[mv.toR][mv.toC]=BK;sndKingPromo();spawnKingFx(mv.toR,mv.toC);promo=true;}
    if(!promo){
      const fc=getCaps(board,mv.toR,mv.toC);
      if(fc.length){
        G.chain={r:mv.toR,c:mv.toC};G.sel={r:mv.toR,c:mv.toC};G.valid=fc;updateHUD();drawBoard();
        if(typeof flushNetMoveQueue==='function')flushNetMoveQueue();
        return;
      }
    }
  }
  if(!isCap){
    if(piece===RED&&mv.toR===0){board[mv.toR][mv.toC]=RK;sndKingPromo();spawnKingFx(mv.toR,mv.toC);}
    if(piece===BLUE&&mv.toR===9){board[mv.toR][mv.toC]=BK;sndKingPromo();spawnKingFx(mv.toR,mv.toC);}
  }
  G.killCount=0;G.sel=null;G.valid=[];G.chain=null;
  G.cur=G.cur===RED?BLUE:RED;G.turn++;
  updateHUD();checkEnd();drawBoard();
  if(typeof flushNetMoveQueue==='function')flushNetMoveQueue();
}

const BADGES=[
  null,
  {t:'💥 KILL',      sub:'FIRST BLOOD',        c:'k1'},
  {t:'⚡ DOUBLE',    sub:'DOUBLE KILL',         c:'k2'},
  {t:'🔥 TRIPLE',    sub:'TRIPLE KILL',         c:'k3'},
  {t:'💀 RAMPAGE',   sub:'IS ON A RAMPAGE',     c:'k4'},
  {t:'👁 DOMINATING',sub:'CANNOT BE STOPPED',   c:'k5'},
];
function showKillBadge(n){
  if(n===1)sndCapture();else if(n===2)sndDoubleKill();else if(n===3)sndTripleKill();else if(n===4)sndRampage();else sndLegendary();
  const feed=document.getElementById('killFeed');
  const bd=BADGES[Math.min(n,5)]||{t:'⭐ LEGENDARY',sub:'UNSTOPPABLE FORCE',c:'k6'};
  // clear old
  feed.innerHTML='';
  const wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px;';
  const el=document.createElement('div');el.className=`k-badge ${bd.c}`;el.textContent=bd.t;
  const sub=document.createElement('div');sub.className='k-sub';sub.textContent=bd.sub;
  wrap.appendChild(el);wrap.appendChild(sub);feed.appendChild(wrap);
  setTimeout(()=>feed.innerHTML='',n>=6?3000:2100);
  if(n>=2){const cm=document.getElementById('combo');cm.textContent=`🔥 COMBO x${n}`;cm.classList.add('show');clearTimeout(cm._t);cm._t=setTimeout(()=>cm.classList.remove('show'),2200);}
}

function startTimer(){
  clearInterval(G.timerInt);
  G.timerInt=setInterval(()=>{
    if(G.over){clearInterval(G.timerInt);return;}
    const idx=G.cur===RED?0:1;G.timeLeft[idx]--;updateTimerUI();
    if(G.timeLeft[idx]<=10)G.timeLeft[idx]%2===0?sndCritTick():sndTick();
    if(G.timeLeft[idx]<=0){clearInterval(G.timerInt);sndTimeout();endGame(G.cur===RED?BLUE:RED,'timeout');}
  },1000);
}

function updateTimerUI(){
  for(let i=0;i<2;i++){
    const t=G.timeLeft[i],m=Math.floor(t/60),s=t%60;
    document.getElementById(`time${i+1}`).textContent=`${m}:${s.toString().padStart(2,'0')}`;
    const pct=t/G.totalTime,circ=2*Math.PI*21;
    document.getElementById(`ring${i+1}`).style.strokeDashoffset=circ*(1-pct);
    document.getElementById(`ring${i+1}`).style.stroke=pct<0.25?'#ff2d55':pct<0.55?'#ffd700':'#39ff14';
  }
}

function updateHUD(){
  let r=0,b=0;for(let row=0;row<BOARD;row++)for(let col=0;col<BOARD;col++){const p=G.board[row][col];if(p===RED||p===RK)r++;if(p===BLUE||p===BK)b++;}
  document.getElementById('pc1').textContent=r;document.getElementById('pc2').textContent=b;
  document.getElementById('cap1').textContent=G.caps[0];document.getElementById('cap2').textContent=G.caps[1];
  document.getElementById('turnNum').textContent=G.turn;
  document.getElementById('hud1').classList.toggle('act',G.cur===RED);document.getElementById('hud2').classList.toggle('act',G.cur===BLUE);
  if(onlineMode){setStatus(G.cur===myColor?'🎮 Your turn':'⏳ Opponent\'s turn...');return;}
  const am=getAllMoves(G.board,G.cur),hc=am.some(m=>m.capR!==null),pn=G.cur===RED?G.settings.n1:G.settings.n2;
  if(G.chain)setStatus(`⚡ ${pn}: Continue!`);else if(hc)setStatus(`🎯 ${pn}: Must capture!`);else setStatus(`🎮 ${pn}'s turn`);
}
function setStatus(m){document.getElementById('statusMsg').textContent=m;}

function checkEnd(){
  const moves=getAllMoves(G.board,G.cur);if(!moves.length){endGame(G.cur===RED?BLUE:RED,'nomoves');return;}
  let r=0,b=0;for(let row=0;row<BOARD;row++)for(let col=0;col<BOARD;col++){const p=G.board[row][col];if(p===RED||p===RK)r++;if(p===BLUE||p===BK)b++;}
  if(!r)endGame(BLUE,'captured');else if(!b)endGame(RED,'captured');
}

function endGame(winner,reason){
  G.over=true;clearInterval(G.timerInt);
  const wi=winner===RED?0:1,li=1-wi;
  G.settings.coins[wi]+=200;G.settings.coins[li]=Math.max(0,G.settings.coins[li]-200);
  persistSettings();
  sndVictory();setTimeout(spawnVictParts,300);setTimeout(()=>showResult(winner,reason),750);
}

function spawnVictParts(){
  const cols=['#ffd700','#ff2d55','#00d4ff','#39ff14','#ff7043','#fff'];
  for(let i=0;i<65;i++){const el=document.createElement('div');const sz=5+Math.random()*11,dur=1+Math.random()*1.4;const tx=(Math.random()-.5)*380,ty=-110-Math.random()*340;el.style.cssText=`position:fixed;border-radius:50%;pointer-events:none;z-index:9990;width:${sz}px;height:${sz}px;background:${cols[Math.floor(Math.random()*cols.length)]};left:${10+Math.random()*80}vw;top:50vh;--tx:${tx}px;--ty:${ty}px;--dur:${dur}s;animation:vp ${dur}s ease-out forwards;`;document.body.appendChild(el);setTimeout(()=>el.remove(),dur*1000+100);}
}
const _vp=document.createElement('style');_vp.textContent='@keyframes vp{0%{transform:translate(0,0) scale(1);opacity:1;}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0;}}';document.head.appendChild(_vp);

function showResult(winner,reason){
  const gs=G.settings,wn=winner===RED?gs.n1:gs.n2,wc=winner===RED?'#ff2d55':'#00d4ff',wi=winner===RED?0:1;
  const why={timeout:'⏰ Time Out',captured:'💀 All captured',nomoves:'🚫 No moves',forfeit:'🏳 Forfeit',forfeit_opp:'🏳 Opp. Forfeit'}[reason]||reason;
  document.getElementById('resTitle').textContent='🏆 VICTORY!';document.getElementById('resTitle').style.cssText=`color:${wc};text-shadow:0 0 48px ${wc};`;
  document.getElementById('resWinner').textContent=wn;document.getElementById('resWinner').style.color=wc;
  document.getElementById('resStats').innerHTML=`<div class="res-stat"><div class="rs-lbl">Turns</div><div class="rs-val" style="color:var(--blue)">${G.turn}</div></div><div class="res-stat"><div class="rs-lbl">Reason</div><div class="rs-val" style="font-size:12px;color:var(--gold)">${why}</div></div><div class="res-stat"><div class="rs-lbl">${gs.n1} Caps</div><div class="rs-val" style="color:var(--red)">${G.caps[0]}</div></div><div class="res-stat"><div class="rs-lbl">${gs.n2} Caps</div><div class="rs-val" style="color:var(--blue)">${G.caps[1]}</div></div>`;
  document.getElementById('coinChg').innerHTML=`<div class="cc-lbl">💰 COIN REWARD</div><div class="cc-val">+200 coins</div><div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:5px">${wn} now has ${gs.coins[wi]} coins</div>`;
  showScreen('resultScreen');
}

// MENU
const AVS=['🦁','🐺','🐯','🦊','🐲','💀','🔥','⚡'];
const SETTINGS_KEY='wildchecker.settings.v1';
let onlineAv='🦁';
let selectedTime=5;

function readPersistedSettings(){
  try{
    const raw=window.localStorage.getItem(SETTINGS_KEY);
    return raw?JSON.parse(raw):null;
  }catch(_){
    return null;
  }
}

function normalizeCoins(raw){
  if(!Array.isArray(raw)||raw.length!==2)return [1000,1000];
  const c1=Number.isFinite(raw[0])?Math.max(0,Math.floor(raw[0])):1000;
  const c2=Number.isFinite(raw[1])?Math.max(0,Math.floor(raw[1])):1000;
  return [c1,c2];
}

function syncMenuCoins(){
  document.getElementById('coins1').textContent=G.settings.coins[0];
  document.getElementById('coins2').textContent=G.settings.coins[1];
}

function persistSettings(){
  const name1El=document.getElementById('name1');
  const name2El=document.getElementById('name2');
  const onlineNameEl=document.getElementById('nameOnline');
  G.settings.n1=(name1El&&name1El.value.trim())||G.settings.n1||'Player 1';
  G.settings.n2=(name2El&&name2El.value.trim())||G.settings.n2||'Player 2';
  const payload={
    n1:G.settings.n1.slice(0,14),
    n2:G.settings.n2.slice(0,14),
    onlineName:((onlineNameEl&&onlineNameEl.value.trim())||'Player').slice(0,14),
    av1:AVS.includes(G.settings.av1)?G.settings.av1:'🦁',
    av2:AVS.includes(G.settings.av2)?G.settings.av2:'🐺',
    onlineAv:AVS.includes(onlineAv)?onlineAv:'🦁',
    time:selectedTime,
    coins:normalizeCoins(G.settings.coins)
  };
  G.settings.coins=payload.coins;
  try{window.localStorage.setItem(SETTINGS_KEY,JSON.stringify(payload));}catch(_){/* noop */}
}

function loadPersistedSettings(){
  const saved=readPersistedSettings();
  const name1El=document.getElementById('name1');
  const name2El=document.getElementById('name2');
  const onlineNameEl=document.getElementById('nameOnline');
  if(saved&&typeof saved==='object'){
    if(typeof saved.n1==='string'&&saved.n1.trim())name1El.value=saved.n1.slice(0,14);
    if(typeof saved.n2==='string'&&saved.n2.trim())name2El.value=saved.n2.slice(0,14);
    if(typeof saved.onlineName==='string'&&saved.onlineName.trim())onlineNameEl.value=saved.onlineName.slice(0,14);
    if(typeof saved.av1==='string'&&AVS.includes(saved.av1))G.settings.av1=saved.av1;
    if(typeof saved.av2==='string'&&AVS.includes(saved.av2))G.settings.av2=saved.av2;
    if(typeof saved.onlineAv==='string'&&AVS.includes(saved.onlineAv))onlineAv=saved.onlineAv;
    if(Number.isInteger(saved.time)&&saved.time>=1&&saved.time<=60)selectedTime=saved.time;
    G.settings.coins=normalizeCoins(saved.coins);
  }
  G.settings.n1=(name1El.value.trim()||'Player 1').slice(0,14);
  G.settings.n2=(name2El.value.trim()||'Player 2').slice(0,14);
  syncMenuCoins();
}

function bindSettingInputPersistence(){
  const ids=['name1','name2','nameOnline'];
  for(const id of ids){
    const el=document.getElementById(id);
    if(el)el.addEventListener('input',()=>persistSettings());
  }
}

function buildAvatars(){
  ['avRow1','avRow2'].forEach((id,pi)=>{
    const row=document.getElementById(id);
    const def=pi===0?(G.settings.av1||'🦁'):(G.settings.av2||'🐺');
    row.innerHTML='';
    AVS.forEach(av=>{
      const btn=document.createElement('button');
      btn.className='av-btn'+(av===def?' sel':'');
      btn.textContent=av;
      btn.onclick=()=>{
        row.querySelectorAll('.av-btn').forEach(b=>b.classList.remove('sel'));
        btn.classList.add('sel');
        if(pi===0)G.settings.av1=av;else G.settings.av2=av;
        sndSelect();
        persistSettings();
      };
      row.appendChild(btn);
    });
  });
  const oRow=document.getElementById('avRowOnline');
  oRow.innerHTML='';
  AVS.forEach(av=>{
    const btn=document.createElement('button');
    btn.className='av-btn'+(av===onlineAv?' sel':'');
    btn.textContent=av;
    btn.onclick=()=>{
      oRow.querySelectorAll('.av-btn').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
      onlineAv=av;
      sndSelect();
      persistSettings();
    };
    oRow.appendChild(btn);
  });
}

function selTime(t,silent=false){
  selectedTime=t;
  document.querySelectorAll('.t-btn').forEach(b=>b.classList.toggle('sel',b.textContent===`${t} MIN`));
  if(!silent)sndSelect();
  persistSettings();
}

function showLocalSetup(){
  getAC();
  document.querySelector('.mode-select').style.display='none';
  document.getElementById('localSetup').style.display='block';
  document.getElementById('timeSection').style.display='block';
  document.getElementById('playBtn').style.display='block';
}

function showOnlineLobby(){
  getAC();
  showScreen('lobbyScreen');
  switchTab('create');
  setJS('','');
  createRoom();
}

function switchTab(tab){
  document.getElementById('tabCreate').classList.toggle('active',tab==='create');
  document.getElementById('tabJoin').classList.toggle('active',tab==='join');
  document.getElementById('secCreate').style.display=tab==='create'?'block':'none';
  document.getElementById('secJoin').style.display=tab==='join'?'block':'none';
}

function startGame(){
  getAC();
  const gs=G.settings;
  gs.n1=document.getElementById('name1').value||'Player 1';
  gs.n2=document.getElementById('name2').value||'Player 2';
  gs.time=selectedTime;
  persistSettings();
  startWithSettings(gs);
}

function startWithSettings(settings){
  getAC();
  const total=settings.time*60;
  G.board=initBoard();G.cur=RED;G.sel=null;G.valid=[];G.chain=null;G.turn=1;G.caps=[0,0];G.over=false;
  G.timeLeft=[total,total];G.totalTime=total;G.killCount=0;G.settings=Object.assign({},settings);
  G.netLocalSeq=1;G.netRemoteSeq=1;
  fxP=[];movPiece=null;
  document.getElementById('hname1').textContent=settings.n1;document.getElementById('hname2').textContent=settings.n2;
  document.getElementById('av1').textContent=settings.av1||'🦁';document.getElementById('av2').textContent=settings.av2||'🐺';
  showScreen('gameScreen');
  setTimeout(()=>{initCanvas();updateHUD();updateTimerUI();startTimer();},60);
}

function forfeit(){if(G.over)return;if(!confirm('Forfeit this match?'))return;if(onlineMode)sendNet({type:'forfeit'});sndTimeout();endGame(G.cur===RED?BLUE:RED,'forfeit');}
function rematch(){
  if(onlineMode){sendNet({type:'rematch_req'});}
  else{doRematch();}
}
function doRematch(){
  const s=Object.assign({},G.settings);
  startWithSettings(s);
}
function backToMenu(){
  teardownNetworking();
  showScreen('menuScreen');clearInterval(G.timerInt);onlineMode=false;
  document.querySelector('.mode-select').style.display='flex';
  document.getElementById('localSetup').style.display='none';
  document.getElementById('timeSection').style.display='none';
  document.getElementById('playBtn').style.display='none';
  syncMenuCoins();
  persistSettings();
}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}

window.addEventListener('resize',()=>{if(document.getElementById('gameScreen').classList.contains('active')&&BC){const sz=BC.offsetWidth;BC.width=BC.height=FC.width=FC.height=sz;BPX=sz;CELL=sz/BOARD;drawBoard();}});
window.addEventListener('beforeunload',()=>teardownNetworking());
document.getElementById('joinInput').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});

bindSettingInputPersistence();
loadPersistedSettings();
buildAvatars();
selTime(selectedTime,true);
persistSettings();
