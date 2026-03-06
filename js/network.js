'use strict';

// PEERJS MULTIPLAYER — жинхэнэ интернэт P2P
// ================================================================
let myPeer=null,myConn=null,rtcRole=null,myColor=null,roomCode=null,onlineMode=false;
let lobbyCreateRetries=0,lobbyCreateOpenTimer=null,lobbyCreateRetryTimer=null,lobbyJoinTimer=null;
let netMoveQueue=[];
const PEER_OPTS={
  debug:0,
  config:{
    iceServers:[
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'},
      {urls:'stun:stun2.l.google.com:19302'}
    ]
  }
};
const CREATE_OPEN_TIMEOUT_MS=12000;
const JOIN_OPEN_TIMEOUT_MS=15000;
const MAX_CREATE_RETRIES=4;

function genCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r='';for(let i=0;i<6;i++)r+=chars[Math.floor(Math.random()*chars.length)];
  return r;
}

function clearLobbyTimers(){
  clearTimeout(lobbyCreateOpenTimer);lobbyCreateOpenTimer=null;
  clearTimeout(lobbyCreateRetryTimer);lobbyCreateRetryTimer=null;
  clearTimeout(lobbyJoinTimer);lobbyJoinTimer=null;
}

function setCreateStatus(cls,txt){
  const el=document.getElementById('createStatus');
  if(!el)return;
  el.textContent=txt;
  el.className='lobby-status'+(cls?' '+cls:'');
}

function teardownNetworking({keepRole=false}={}){
  clearLobbyTimers();
  netMoveQueue=[];
  const oldConn=myConn;myConn=null;
  if(oldConn){try{oldConn.close();}catch(_){/* noop */}}
  const oldPeer=myPeer;myPeer=null;
  if(oldPeer&&!oldPeer.destroyed){try{oldPeer.destroy();}catch(_){/* noop */}}
  onlineMode=false;
  if(!keepRole){rtcRole=null;myColor=null;roomCode=null;}
}

function queueCreateRetry(reason){
  if(lobbyCreateRetries>=MAX_CREATE_RETRIES){
    setCreateStatus('err','⚠️ Холболт тогтворгүй байна. Дахин оролдоорой.');
    document.getElementById('roomCodeEl').textContent='------';
    document.getElementById('waitBtn').disabled=true;
    document.getElementById('waitBtn').textContent='⏳ Холболт амжилтгүй';
    return;
  }
  lobbyCreateRetries++;
  setCreateStatus('wait',`${reason} (${lobbyCreateRetries}/${MAX_CREATE_RETRIES})`);
  document.getElementById('roomCodeEl').textContent='...';
  document.getElementById('waitBtn').disabled=true;
  document.getElementById('waitBtn').textContent='⏳ Room дахин үүсгэж байна...';
  clearLobbyTimers();
  lobbyCreateRetryTimer=setTimeout(()=>createRoom(true),700+lobbyCreateRetries*300);
}

function bindPeerLifecycle(peer,mode){
  peer.on('disconnected',()=>{
    if(peer!==myPeer||peer.destroyed)return;
    if(mode==='create')setCreateStatus('wait','Серверээс тасарлаа, дахин холбогдож байна...');
    else setJS('wait','Сервертэй дахин холбогдож байна...');
    try{peer.reconnect();}catch(_){/* noop */}
  });

  peer.on('close',()=>{
    if(peer!==myPeer||onlineMode)return;
    if(mode==='create')queueCreateRetry('Холболт хаагдлаа, room дахин үүсгэж байна...');
    else setJS('err','Peer session дууслаа, дахин JOIN хийнэ үү');
  });
}

function createRoom(isRetry=false){
  teardownNetworking({keepRole:true});
  rtcRole='host';myColor=1;
  if(!isRetry)lobbyCreateRetries=0;
  roomCode=genCode();
  document.getElementById('roomCodeEl').textContent='...';
  document.getElementById('waitBtn').disabled=true;
  document.getElementById('waitBtn').textContent='⏳ Room бэлтгэж байна...';
  setCreateStatus('wait','Сервэртэй холбогдож байна...');

  const peer=new Peer(roomCode,PEER_OPTS);
  myPeer=peer;
  bindPeerLifecycle(peer,'create');

  lobbyCreateOpenTimer=setTimeout(()=>{
    if(peer!==myPeer||onlineMode)return;
    queueCreateRetry('Сервер удаан хариулж байна, дахин оролдож байна...');
  },CREATE_OPEN_TIMEOUT_MS);

  peer.on('open',id=>{
    if(peer!==myPeer)return;
    clearLobbyTimers();
    lobbyCreateRetries=0;
    roomCode=id;
    document.getElementById('roomCodeEl').textContent=id;
    setCreateStatus('ok','✅ Room бэлэн! Найздаа code илгээгээрэй');
    document.getElementById('waitBtn').disabled=false;
    document.getElementById('waitBtn').textContent='⏳ Opponent хүлээж байна...';
  });

  peer.on('connection',conn=>{
    if(peer!==myPeer)return;
    if(myConn&&myConn!==conn){
      conn.on('open',()=>conn.send({type:'room_busy'}));
      setTimeout(()=>{try{conn.close();}catch(_){/* noop */}},150);
      return;
    }
    myConn=conn;
    setupConn(conn);
    document.getElementById('waitBtn').textContent='✅ Тоглогч холбогдлоо!';
    setCreateStatus('ok','✅ Холбогдлоо!');
  });

  peer.on('error',e=>{
    if(peer!==myPeer)return;
    if(onlineMode){console.warn('peer err during game',e);return;}
    if(e.type==='unavailable-id'){queueCreateRetry('Code давхцлаа, шинэ code үүсгэж байна...');return;}
    if(['network','socket-error','server-error','disconnected'].includes(e.type)){
      queueCreateRetry('Сүлжээний алдаа, дахин оролдож байна...');
      return;
    }
    setCreateStatus('err','⚠️ '+e.type);
  });
}

function joinRoom(){
  const input=document.getElementById('joinInput');
  const code=input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  input.value=code;
  if(!code||code.length<4){setJS('err','Code оруулна уу');return;}
  teardownNetworking({keepRole:true});
  setJS('wait','Холбогдож байна...');
  rtcRole='guest';myColor=2;roomCode=code;

  const peer=new Peer(undefined,PEER_OPTS);
  myPeer=peer;
  bindPeerLifecycle(peer,'join');
  lobbyJoinTimer=setTimeout(()=>{
    if(peer!==myPeer||onlineMode)return;
    setJS('err','Хугацаа дууслаа. Дахин JOIN оролдоорой');
    teardownNetworking({keepRole:true});
  },JOIN_OPEN_TIMEOUT_MS);

  peer.on('open',()=>{
    if(peer!==myPeer)return;
    myConn=peer.connect(code,{reliable:true,serialization:'json'});
    setupConn(myConn);
  });

  peer.on('error',e=>{
    if(peer!==myPeer)return;
    clearLobbyTimers();
    if(e.type==='peer-unavailable')setJS('err','Room олдсонгүй — code шалгаарай');
    else if(['network','socket-error','server-error'].includes(e.type))setJS('err','Сүлжээний алдаа. Дахин оролдоорой');
    else setJS('err','Алдаа: '+e.type);
  });
}

function setupConn(conn){
  conn.on('open',()=>{
    if(conn!==myConn)return;
    clearLobbyTimers();
    netMoveQueue=[];
    onlineMode=true;
    if(rtcRole==='guest'){
      setJS('ok','✅ Холбогдлоо! Тоглоом эхлэх хүлээж байна...');
      const n=document.getElementById('nameOnline').value||'Player';
      conn.send({type:'hello',name:n,av:onlineAv||'⚡',time:selectedTime});
    }
    else setCreateStatus('ok','✅ Холбогдлоо! Тоглоом эхлэхэд бэлэн');
  });

  conn.on('data',msg=>{if(conn===myConn)handleNet(msg);});

  conn.on('close',()=>{
    if(conn!==myConn)return;
    myConn=null;
    netMoveQueue=[];
    onlineMode=false;
    if(rtcRole==='guest')setJS('err','⚠️ Холболт тасарлаа. Дахин JOIN хийнэ үү');
    if(rtcRole==='host'){
      document.getElementById('waitBtn').textContent='⏳ Opponent хүлээж байна...';
      setCreateStatus('wait','⚠️ Тоглогч гарлаа, дахин хүлээж байна...');
    }
    if(!G||!G.over)setStatus('⚠️ Холболт тасарлаа');
  });

  conn.on('error',e=>{
    if(conn!==myConn)return;
    onlineMode=false;
    if(rtcRole==='guest')setJS('err','⚠️ Холболтын алдаа');
    else setCreateStatus('err','⚠️ Холболтын алдаа');
    console.warn('conn err',e);
  });
}

function sendNet(obj){
  if(!myConn||!myConn.open)return;
  try{myConn.send(obj);}catch(_){/* noop */}
}

function isBoardCoord(v){
  return Number.isInteger(v)&&v>=0&&v<BOARD;
}

function normalizeMovePacket(msg){
  const seq=Number(msg.seq);
  const turn=Number(msg.turn);
  const player=Number(msg.player);
  const fR=Number(msg.fR),fC=Number(msg.fC),tR=Number(msg.tR),tC=Number(msg.tC);
  const capR=(msg.cR===null||msg.cR===undefined)?null:Number(msg.cR);
  const capC=(msg.cC===null||msg.cC===undefined)?null:Number(msg.cC);
  if(!Number.isInteger(seq)||seq<1)return null;
  if(!Number.isInteger(turn)||turn<1)return null;
  if(!Number.isInteger(player)||![RED,BLUE].includes(player))return null;
  if(!isBoardCoord(fR)||!isBoardCoord(fC)||!isBoardCoord(tR)||!isBoardCoord(tC))return null;
  if((capR===null)!==(capC===null))return null;
  if(capR!==null&&(!isBoardCoord(capR)||!isBoardCoord(capC)))return null;
  return {seq,turn,player,fR,fC,tR,tC,capR,capC};
}

function legalMovesForCurrentTurn(){
  if(G.chain){
    const {r,c}=G.chain;
    return getCaps(G.board,r,c).map(m=>({fromR:r,fromC:c,...m}));
  }
  const caps=getAllCaps(G.board,G.cur);
  return caps.length?caps:getAllMoves(G.board,G.cur);
}

function matchLegalMove(packet){
  const legal=legalMovesForCurrentTurn();
  return legal.find(m=>
    m.fromR===packet.fR&&
    m.fromC===packet.fC&&
    m.toR===packet.tR&&
    m.toC===packet.tC&&
    (m.capR??null)===(packet.capR??null)&&
    (m.capC??null)===(packet.capC??null)
  )||null;
}

function validateNetMove(msg){
  if(!G||G.over)return {ok:false,reason:'game_inactive'};
  const packet=normalizeMovePacket(msg);
  if(!packet)return {ok:false,reason:'bad_payload'};
  if(packet.seq<G.netRemoteSeq)return {ok:false,reason:'stale',stale:true,packet};
  if(packet.seq>G.netRemoteSeq)return {ok:false,reason:'seq_gap',packet};
  if(packet.turn!==G.turn)return {ok:false,reason:'turn_mismatch',packet};
  if(packet.player!==G.cur)return {ok:false,reason:'player_mismatch',packet};
  if(G.chain&&(packet.fR!==G.chain.r||packet.fC!==G.chain.c))return {ok:false,reason:'chain_mismatch',packet};
  const piece=G.board[packet.fR][packet.fC];
  if(!(piece===G.cur||piece===G.cur+2))return {ok:false,reason:'piece_mismatch',packet};
  const move=matchLegalMove(packet);
  if(!move)return {ok:false,reason:'illegal_move',packet};
  return {ok:true,packet,move};
}

function flushNetMoveQueue(){
  if(movPiece||!netMoveQueue.length)return;
  const msg=netMoveQueue.shift();
  applyNetMove(msg);
  if(!movPiece&&netMoveQueue.length)setTimeout(flushNetMoveQueue,0);
}

function handleNet(msg){
  if(!msg||!msg.type)return;
  if(msg.type==='hello'){
    const hostN=document.getElementById('nameOnline').value||'Player';
    const s={
      n1:hostN, n2:msg.name,
      av1:onlineAv||'🦁', av2:msg.av,
      time:msg.time||selectedTime,
      coins:[1000,1000], online:true
    };
    sendNet({type:'start',settings:s});
    setTimeout(()=>launchOnline(s),400);
  }
  else if(msg.type==='start'){launchOnline(msg.settings);}
  else if(msg.type==='move'){
    netMoveQueue.push(msg);
    flushNetMoveQueue();
  }
  else if(msg.type==='forfeit'){endGame(myColor,'forfeit_opp');}
  else if(msg.type==='room_busy'){
    setJS('err','Room аль хэдийн тоглогчтой байна');
    teardownNetworking({keepRole:true});
  }
  else if(msg.type==='rematch_req'){
    sendNet({type:'rematch_ok'});
    doRematch();
  }
  else if(msg.type==='rematch_ok'){doRematch();}
  else if(msg.type==='desync'){
    setStatus('⚠️ Sync issue detected. Please rematch.');
    console.warn('desync notice',msg);
  }
}

function launchOnline(settings){
  netMoveQueue=[];
  G.settings=Object.assign({},settings);
  startWithSettings(settings);
}

function applyNetMove(msg){
  const checked=validateNetMove(msg);
  if(!checked.ok){
    if(checked.stale)return;
    console.warn('Rejected net move',checked.reason,msg);
    setStatus('⚠️ Network move rejected ('+checked.reason+')');
    sendNet({type:'desync',reason:checked.reason,expectedSeq:G.netRemoteSeq,receivedSeq:checked.packet?checked.packet.seq:null});
    return;
  }
  G.netRemoteSeq++;
  G.sel={r:checked.move.fromR,c:checked.move.fromC};
  G.valid=[checked.move];
  execMove(checked.move,checked.move.fromR,checked.move.fromC,true);
}

function setJS(cls,txt){
  const el=document.getElementById('joinStatus');
  el.textContent=txt;el.className='lobby-status'+(cls?' '+cls:'');
}

function copyCode(){
  if(!roomCode)return;
  const txt=roomCode;
  navigator.clipboard.writeText(txt).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=txt;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
  });
  const el=document.getElementById('roomCodeEl');
  el.textContent='COPIED! ✅';
  setTimeout(()=>el.textContent=txt,1300);
}
