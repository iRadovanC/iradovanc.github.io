/* Fictional training terrain. No external map service. */
(function(){
  'use strict';
  const routes=[
    [[260,360],[420,290],[550,370],[700,455],[815,545],[690,635],[520,650],[355,575],[260,360]],
    [[720,220],[930,245],[1130,365],[1240,525],[1080,635],[900,580],[815,420],[720,220]],
    [[300,705],[440,620],[580,560],[745,590],[880,710],[690,795],[500,770],[300,705]],
    [[340,220],[505,190],[665,265],[745,405],[610,470],[450,405],[340,220]],
    [[965,770],[1090,685],[1230,580],[1210,395],[1080,315],[960,440],[1010,615],[965,770]],
    [[590,790],[770,740],[940,630],[1005,490],[900,345],[740,370],[660,520],[590,790]]
  ];
  const routeLengths=routes.map(points=>{let total=0;const parts=[];for(let i=1;i<points.length;i++){const length=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);parts.push({from:points[i-1],to:points[i],start:total,length});total+=length;}return {parts,total};});
  function draw(){
    const c=document.getElementById('city-map').getContext('2d');if(!c)return;
    let seed=74261;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
    const path=points=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));};
    const label=(text,x,y,size=17,color='#6d7956')=>{c.font=`${size}px Segoe UI, sans-serif`;c.fillStyle=color;c.textAlign='center';c.fillText(text,x,y);};
    c.fillStyle='#e6e4c7';c.fillRect(0,0,1500,1000);
    for(const [points,color] of [
      [[[0,0],[670,0],[620,170],[430,255],[350,430],[150,490],[0,375]],'#c4d0a1'],
      [[[1030,0],[1500,0],[1500,400],[1330,360],[1190,220],[1030,160]],'#bdcb98'],
      [[[0,735],[185,655],[370,760],[610,845],[780,1000],[0,1000]],'#c2ce9c'],
      [[[1060,690],[1250,595],[1500,645],[1500,1000],[980,1000]],'#c3cf9f'],
      [[[615,80],[870,40],[1000,210],[875,325],[695,280]],'#dedcba'],
      [[[420,500],[720,490],[860,645],[735,810],[505,710]],'#e0deb9']
    ]){path(points);c.closePath();c.fillStyle=color;c.fill();}
    for(const [cx,cy,rx,ry] of [[445,300,390,230],[1120,810,380,255],[1190,120,280,185],[220,900,350,200]]){
      for(let ring=1;ring<10;ring++){c.beginPath();for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,r=ring/10,wobble=1+.08*Math.sin(a*3)+.05*Math.cos(a*5+ring*.3);const x=cx+Math.cos(a)*rx*r*wobble,y=cy+Math.sin(a)*ry*r*wobble;i?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle=ring%3?'#a99e7246':'#a0956a80';c.lineWidth=ring%3?1.3:2;c.stroke();}
    }
    c.beginPath();c.moveTo(930,-30);c.bezierCurveTo(1000,220,1210,310,1120,465);c.bezierCurveTo(1010,635,1020,760,870,1050);c.strokeStyle='#98b9ae';c.lineWidth=12;c.stroke();c.strokeStyle='#c2d6c7';c.lineWidth=6;c.stroke();
    const trails=[[[100,680],[280,560],[460,490],[660,525],[815,420],[1020,370],[1210,395],[1430,520]],[[440,90],[505,190],[550,370],[580,560],[690,795],[820,970]],[[110,815],[300,705],[500,770],[690,795],[965,770],[1230,580],[1400,180]]];
    trails.forEach(points=>{path(points);c.lineWidth=13;c.strokeStyle='#b9aa80';c.stroke();c.lineWidth=8;c.strokeStyle='#f4edce';c.stroke();c.lineWidth=1.5;c.strokeStyle='#baa982';c.setLineDash([8,7]);c.stroke();c.setLineDash([]);});
    for(let i=0;i<700;i++){const x=random()*1500,y=random()*1000;if(!((x<370&&y<430)||(x>1240&&y<320)||(y>850&&x<530)||(x>1180&&y>720)))continue;const r=5+random()*7;c.fillStyle='#6c885b27';c.beginPath();c.arc(x+3,y+3,r,0,Math.PI*2);c.fill();c.fillStyle=['#90a66e','#9daf7b','#a2b482'][Math.floor(random()*3)];c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
    c.lineWidth=1;c.strokeStyle='#697f5d24';for(let x=0;x<=1500;x+=150){path([[x,0],[x,1000]]);c.stroke();}for(let y=0;y<=1000;y+=125){path([[0,y],[1500,y]]);c.stroke();}
    for(let i=1;i<10;i++)label(String(40+i),i*150+8,28,12,'#879071');
    label('C V I Č N Ý   P R O S T O R   B U G O V I C E',735,910,22,'#889273');
    label('BOROVÝ HŘBET',285,125,19);label('LOUKA U RESETU',730,610,18);label('LES ZÁLOH',1310,845,17);label('ÚDOLÍ SPOJENÍ',1195,270,17);label('potok Chybka',1040,890,14,'#699b93');
    [[435,288,'▲ 512'],[1115,812,'▲ 486'],[1210,130,'▲ 438']].forEach(([x,y,text])=>label(text,x,y,14,'#8b805f'));
    c.strokeStyle='#657959';c.lineWidth=3;path([[160,580],[185,550],[210,580],[160,580]]);c.stroke();label('VELITELSKÉ STANOVIŠTĚ',220,615,13);
    c.fillStyle='#748267';c.font='bold 22px Segoe UI';c.textAlign='center';c.fillText('N',1430,78);path([[1430,95],[1430,160],[1420,115],[1430,95],[1440,115]]);c.stroke();
    c.globalAlpha=.065;for(let i=0;i<10000;i++){c.fillStyle=random()>.5?'#fff':'#72744a';c.fillRect(random()*1500,random()*1000,1,1);}c.globalAlpha=1;
  }
  window.BugMap={draw,routes,routeLengths};
})();
