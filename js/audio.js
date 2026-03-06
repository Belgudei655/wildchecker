'use strict';
// ================================================================
// MUSIC ENGINE — Procedural savage tribal/industrial beat
// ================================================================
let AC=null,musicOn=false,schedHandle=null,nextBeat=0,beatIdx=0;
const BPM=140,BEAT=60/BPM;

function getAC(){
  if(!AC){AC=new(window.AudioContext||window.webkitAudioContext)();}
  if(AC.state==='suspended')AC.resume();
  return AC;
}

let masterGain=null;
function getMaster(){
  if(masterGain)return masterGain;
  const ac=getAC();
  const comp=ac.createDynamicsCompressor();
  comp.threshold.value=-14;comp.ratio.value=5;comp.attack.value=0.003;comp.release.value=0.12;
  masterGain=ac.createGain();masterGain.gain.value=0.5;
  masterGain.connect(comp);comp.connect(ac.destination);
  return masterGain;
}

function distCurve(amt=50){
  const n=512,c=new Float32Array(n);
  for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=(Math.PI+amt)*x/(Math.PI+amt*Math.abs(x));}
  return c;
}

// DRUM hits
function kick(t){
  const ac=getAC(),m=getMaster();
  const o=ac.createOscillator(),ws=ac.createWaveShaper(),e=ac.createGain();
  ws.curve=distCurve(90);
  o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(38,t+0.08);
  e.gain.setValueAtTime(1.2,t);e.gain.exponentialRampToValueAtTime(0.001,t+0.38);
  o.connect(ws);ws.connect(e);e.connect(m);o.start(t);o.stop(t+0.4);
  // sub
  const s=ac.createOscillator(),se=ac.createGain();s.type='sine';
  s.frequency.setValueAtTime(65,t);s.frequency.exponentialRampToValueAtTime(28,t+0.18);
  se.gain.setValueAtTime(0.9,t);se.gain.exponentialRampToValueAtTime(0.001,t+0.42);
  s.connect(se);se.connect(m);s.start(t);s.stop(t+0.44);
}

function snare(t){
  const ac=getAC(),m=getMaster();
  const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.22),ac.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const src=ac.createBufferSource();src.buffer=buf;
  const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=2200;f.Q.value=0.5;
  const e=ac.createGain();e.gain.setValueAtTime(0.85,t);e.gain.exponentialRampToValueAtTime(0.001,t+0.2);
  src.connect(f);f.connect(e);e.connect(m);src.start(t);
  const o=ac.createOscillator(),oe=ac.createGain();o.type='triangle';
  o.frequency.setValueAtTime(260,t);o.frequency.exponentialRampToValueAtTime(110,t+0.07);
  oe.gain.setValueAtTime(0.6,t);oe.gain.exponentialRampToValueAtTime(0.001,t+0.12);
  o.connect(oe);oe.connect(m);o.start(t);o.stop(t+0.13);
}

function hihat(t,open){
  const ac=getAC(),m=getMaster();
  const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.09),ac.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const src=ac.createBufferSource();src.buffer=buf;
  const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=9000;
  const e=ac.createGain();const dur=open?0.22:0.05;
  e.gain.setValueAtTime(0.28,t);e.gain.exponentialRampToValueAtTime(0.001,t+dur);
  src.connect(f);f.connect(e);e.connect(m);src.start(t);
}

function clap(t){
  const ac=getAC(),m=getMaster();
  for(let i=0;i<3;i++){
    const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*0.04),ac.sampleRate);
    const d=buf.getChannelData(0);for(let j=0;j<d.length;j++)d[j]=Math.random()*2-1;
    const src=ac.createBufferSource();src.buffer=buf;
    const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=1400+i*300;
    const e=ac.createGain();const dt=t+i*0.012;
    e.gain.setValueAtTime(0.5-i*0.1,dt);e.gain.exponentialRampToValueAtTime(0.001,dt+0.06);
    src.connect(f);f.connect(e);e.connect(m);src.start(dt);
  }
}

// BASS synth
function bass(t,midi){
  const ac=getAC(),m=getMaster();
  const hz=440*Math.pow(2,(midi-69)/12)*0.5;
  const o1=ac.createOscillator(),o2=ac.createOscillator();
  const ws=ac.createWaveShaper();ws.curve=distCurve(30);
  const e=ac.createGain();
  o1.type='sawtooth';o1.frequency.value=hz;o1.detune.value=-6;
  o2.type='square';o2.frequency.value=hz;o2.detune.value=6;
  e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(0.38,t+0.01);
  e.gain.exponentialRampToValueAtTime(0.001,t+0.28);
  o1.connect(ws);o2.connect(ws);ws.connect(e);e.connect(m);
  o1.start(t);o1.stop(t+0.3);o2.start(t);o2.stop(t+0.3);
}

// LEAD synth
function lead(t,midi,dur){
  const ac=getAC(),m=getMaster();
  const hz=440*Math.pow(2,(midi-69)/12);
  const o=ac.createOscillator(),o2=ac.createOscillator();
  const flt=ac.createBiquadFilter();flt.type='lowpass';flt.Q.value=4;
  flt.frequency.setValueAtTime(2200,t);flt.frequency.exponentialRampToValueAtTime(700,t+dur+0.08);
  const e=ac.createGain();
  o.type='sawtooth';o.frequency.value=hz;o.detune.value=-4;
  o2.type='sawtooth';o2.frequency.value=hz;o2.detune.value=4;
  e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(0.2,t+0.018);
  e.gain.setValueAtTime(0.2,t+dur);e.gain.exponentialRampToValueAtTime(0.001,t+dur+0.09);
  o.connect(flt);o2.connect(flt);flt.connect(e);e.connect(m);
  o.start(t);o.stop(t+dur+0.1);o2.start(t);o2.stop(t+dur+0.1);
}

// PAD chord
function pad(t){
  const ac=getAC(),m=getMaster();
  const notes=[43,50,55,58]; // G-D-G-Bb minor feel
  for(const n of notes){
    const o=ac.createOscillator(),e=ac.createGain();
    o.type='sine';o.frequency.value=440*Math.pow(2,(n-69)/12);
    o.detune.value=(Math.random()-0.5)*10;
    e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(0.035,t+0.6);
    e.gain.setValueAtTime(0.035,t+6.5);e.gain.linearRampToValueAtTime(0,t+7.5);
    o.connect(e);e.connect(m);o.start(t);o.stop(t+7.6);
  }
}

// RISER tension
function riser(t){
  const ac=getAC(),m=getMaster();
  const o=ac.createOscillator(),e=ac.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(80,t);o.frequency.exponentialRampToValueAtTime(600,t+1.8);
  e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(0.15,t+1.5);e.gain.exponentialRampToValueAtTime(0.001,t+1.9);
  o.connect(e);e.connect(m);o.start(t);o.stop(t+2);
}

// DRUM PATTERN (16 steps, 1=kick 2=snare 3=hh 4=open-hh 5=clap)
// 16 steps per bar
const DRUM_PAT = [
  1,3,0,3,  2,3,1,3,  1,3,5,3,  2,3,1,4
];
// BASS LINE (16 steps, midi note or 0)
const BASS_PAT = [
  43,0,43,0,  46,0,0,43,  41,0,41,0,  43,0,46,0
];
// LEAD MELODY every 4 bars (64 steps), events: [step, midi, durBeats]
const LEAD_MEL = [
  [0,67,1],[2,67,0.5],[3,69,1.5],[6,71,1],[8,67,2],
  [12,65,1],[14,63,0.5],[15,65,1.5],[18,67,2],[22,69,1],
  [24,71,2],[28,67,1],[30,65,0.5],[31,63,2],[36,60,1.5],[38,62,1],[40,63,2]
];

let stepCount=0;

function scheduleStep(t){
  const s=stepCount%16;
  const bar=Math.floor(stepCount/16);
  const bigBar=Math.floor(stepCount/64);
  const d=DRUM_PAT[s];
  if(d===1)kick(t);
  else if(d===2){snare(t);}
  else if(d===3)hihat(t,false);
  else if(d===4)hihat(t,true);
  else if(d===5)clap(t);
  // extra kick on step 8 sometimes
  if(s===8&&bar%2===0)kick(t);
  // bass
  const bn=BASS_PAT[s];if(bn)bass(t,bn);
  // lead every 4 bars
  const stepIn64=stepCount%64;
  for(const [ls,lm,ld] of LEAD_MEL){if(ls*4===stepIn64)lead(t,lm,ld*BEAT*4);}
  // pad every 8 bars (128 steps)
  if(stepCount%128===0)pad(t);
  // riser before every 4 bars
  if(stepCount%64===60)riser(t);
  stepCount++;
}

function runScheduler(){
  if(!musicOn)return;
  const ac=getAC();
  while(nextBeat<ac.currentTime+0.15){scheduleStep(nextBeat);nextBeat+=BEAT/4;}
  schedHandle=setTimeout(runScheduler,50);
}

function startMusic(){
  if(musicOn)return;musicOn=true;
  const ac=getAC();nextBeat=ac.currentTime+0.1;stepCount=0;
  runScheduler();
  document.getElementById('musicCtrl').classList.add('on');
  document.getElementById('musicLbl').textContent='MUSIC ON';
}
function stopMusic(){
  musicOn=false;clearTimeout(schedHandle);
  document.getElementById('musicCtrl').classList.remove('on');
  document.getElementById('musicLbl').textContent='MUSIC OFF';
}
function toggleMusic(){
  getAC();
  musicOn?stopMusic():startMusic();
  if(typeof persistSettings==='function')persistSettings();
}

// ================================================================
// SOUND FX
// ================================================================
function playTone(o){
  const ac=getAC();const{type='sine',freq=440,freq2,duration=0.12,gain=0.25,attack=0.005,decay=0.08,distort=false,detune=0}=o;
  const osc=ac.createOscillator(),env=ac.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,ac.currentTime);
  if(freq2)osc.frequency.exponentialRampToValueAtTime(freq2,ac.currentTime+duration);
  osc.detune.value=detune;
  if(distort){const ws=ac.createWaveShaper();ws.curve=distCurve(60);osc.connect(ws);ws.connect(env);}
  else osc.connect(env);
  env.connect(getMaster());
  env.gain.setValueAtTime(0,ac.currentTime);env.gain.linearRampToValueAtTime(gain,ac.currentTime+attack);
  env.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+decay+duration);
  osc.start(ac.currentTime);osc.stop(ac.currentTime+duration+decay+0.05);
}
function playNoise(o){
  const ac=getAC();const{duration=0.1,gain=0.18,filterFreq=2000,filterType='bandpass',decay=0.08}=o;
  const buf=ac.createBuffer(1,ac.sampleRate*duration,ac.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const src=ac.createBufferSource();src.buffer=buf;
  const flt=ac.createBiquadFilter();flt.type=filterType;flt.frequency.value=filterFreq;
  const env=ac.createGain();src.connect(flt);flt.connect(env);env.connect(getMaster());
  env.gain.setValueAtTime(0,ac.currentTime);env.gain.linearRampToValueAtTime(gain,ac.currentTime+0.002);
  env.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+decay);src.start(ac.currentTime);
}
function sndSelect(){playTone({type:'sine',freq:700,freq2:1000,duration:0.04,gain:0.14,decay:0.05});}
function sndMove(){playTone({type:'triangle',freq:320,freq2:520,duration:0.06,gain:0.19,decay:0.05});playNoise({duration:0.03,gain:0.04,filterFreq:3000,decay:0.03});}
function sndCapture(){playNoise({duration:0.14,gain:0.42,filterFreq:700,filterType:'lowpass',decay:0.16});playTone({type:'sawtooth',freq:110,freq2:35,duration:0.14,gain:0.28,decay:0.18,distort:true});}
function sndDoubleKill(){playNoise({duration:0.18,gain:0.52,filterFreq:550,filterType:'lowpass',decay:0.22});playTone({type:'sawtooth',freq:150,freq2:55,duration:0.18,gain:0.34,decay:0.22,distort:true});setTimeout(()=>playTone({type:'square',freq:440,freq2:880,duration:0.09,gain:0.26,decay:0.13}),75);}
function sndTripleKill(){sndDoubleKill();setTimeout(()=>{playTone({type:'sawtooth',freq:280,freq2:560,duration:0.13,gain:0.3,decay:0.16,distort:true});playNoise({duration:0.13,gain:0.36,filterFreq:1100,filterType:'bandpass',decay:0.18});},110);}
function sndRampage(){for(let i=0;i<4;i++)setTimeout(()=>{playNoise({duration:0.11,gain:0.48,filterFreq:440+i*170,filterType:'lowpass',decay:0.13});playTone({type:'sawtooth',freq:90+i*26,freq2:44,duration:0.11,gain:0.3,decay:0.13,distort:true});},i*55);}
function sndLegendary(){for(let i=0;i<6;i++)setTimeout(()=>{playNoise({duration:0.09,gain:0.42,filterFreq:360+i*130,filterType:'lowpass',decay:0.11});playTone({type:'sawtooth',freq:72+i*20,freq2:36,duration:0.09,gain:0.25,decay:0.11,distort:true});},i*44);setTimeout(()=>playTone({type:'sine',freq:880,freq2:440,duration:0.28,gain:0.2,decay:0.28}),320);}
function sndKingPromo(){playTone({type:'sine',freq:440,freq2:880,duration:0.11,gain:0.2,decay:0.09});playTone({type:'sine',freq:554,freq2:1108,duration:0.11,gain:0.16,decay:0.09,detune:7});setTimeout(()=>playTone({type:'triangle',freq:1320,freq2:1760,duration:0.18,gain:0.24,decay:0.22}),90);playNoise({duration:0.07,gain:0.1,filterFreq:4000,filterType:'highpass',decay:0.09});}
function sndTimeout(){for(let i=0;i<3;i++)setTimeout(()=>playTone({type:'square',freq:190-i*38,duration:0.16,gain:0.34,decay:0.18}),i*190);}
function sndVictory(){const ns=[523,659,784,1047];ns.forEach((n,i)=>setTimeout(()=>{playTone({type:'sine',freq:n,duration:0.16,gain:0.25,decay:0.18});playTone({type:'triangle',freq:n*1.5,duration:0.09,gain:0.1,decay:0.13});},i*110));setTimeout(()=>playNoise({duration:0.28,gain:0.25,filterFreq:1800,filterType:'bandpass',decay:0.38}),440);}
function sndTick(){playTone({type:'square',freq:750,duration:0.018,gain:0.06,decay:0.025});}
function sndCritTick(){playTone({type:'square',freq:1100,duration:0.025,gain:0.12,decay:0.035});playNoise({duration:0.018,gain:0.04,filterFreq:3800,decay:0.018});}
