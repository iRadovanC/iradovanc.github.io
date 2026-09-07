/* Canvas illustration and procedural textures. The static landscape is cached. */
(() => {
  "use strict";
  const TAU = Math.PI * 2, INK = "#303c2d";
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function poly(g, pts, fill, stroke = INK, line = 2) { g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.closePath(); if(fill){g.fillStyle=fill;g.fill();} if(stroke){g.strokeStyle=stroke;g.lineWidth=line;g.stroke();} }
  function box(g,x,y,w,h,fill,stroke=INK,r=3) { g.beginPath(); g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.lineWidth=2;g.strokeStyle=stroke;g.stroke();} }
  function oval(g,x,y,rx,ry,fill,stroke=null) { g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();} }
  function line(g,pts,color=INK,width=2) { g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.stroke(); }
  function label(g,text,x,y,size=12,color="#efe1b4",align="center",font="monospace") { g.fillStyle=color;g.font=`bold ${size}px ${font}`;g.textAlign=align;g.fillText(text,x,y); }
  function star(g,x,y,r,color="#efd477",rotation=0) { const pts=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2+rotation;pts.push([x+Math.cos(a)*r*(i%2?.43:1),y+Math.sin(a)*r*(i%2?.43:1)]);}poly(g,pts,color,null); }
  class FieldRenderer {
    constructor(canvas) { this.canvas=canvas;this.g=canvas.getContext("2d",{alpha:false});this.cache=document.createElement("canvas");this.patterns={};this.makeTextures(); }
    makeTextures() {
      for(const [kind,base,colors] of [["sand","#a89c69",["#d2bd84","#6f7750","#bfa973"]],["wood","#7c8050",["#b0a66b","#535f3d","#959359"]],["cloth","#737c4d",["#444f35","#a39c62","#80824b"]],["metal","#56665a",["#839183","#34453e","#a4a685"]]]) {
        const c=document.createElement("canvas");c.width=c.height=128;const g=c.getContext("2d"),random=rng(241);
        g.fillStyle=base;g.fillRect(0,0,128,128);
        for(let i=0;i<560;i++){g.fillStyle=colors[i%colors.length];g.globalAlpha=.15+random()*.35;const x=random()*128,y=random()*128;g.fillRect(x,y,kind==="wood"?12+random()*40:1+random()*3,kind==="cloth"?1:random()*2+1);}
        if(kind==="cloth"){g.globalAlpha=.08;g.fillStyle="#fff3bc";for(let i=0;i<128;i+=4){g.fillRect(i,0,1,128);g.fillRect(0,i,128,1);}}
        g.globalAlpha=1;this.patterns[kind]=this.g.createPattern(c,"repeat");
      }
    }
    resize(w,h,dpr) {
      this.w=w;this.h=h;this.u=clamp(Math.min(w/1440,h/900),.52,1.5);this.dpr=dpr;
      this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.g.setTransform(dpr,0,0,dpr,0,0);
      this.cache.width=this.canvas.width;this.cache.height=this.canvas.height;
      const g=this.cache.getContext("2d");g.setTransform(dpr*w/1440,0,0,dpr*h/900,0,0);this.background(g);
      const layout=w<600?[[.22,.49,.85],[.75,.51,.85],[.25,.69,1.1],[.77,.70,1.1]]:[[.16,.49,.8],[.43,.50,.78],[.74,.49,.83],[.13,.67,1.14],[.36,.65,1.07],[.65,.66,1.12],[.87,.65,1.05]];
      this.slots=layout.map(([x,y,s],i)=>({x:x*w,y:y*h,scale:s*this.u,kind:i%3===1?"crate":"bags",i}));
      this.barrels=w<600?[{x:w*.5,y:h*.60,scale:this.u*.9}]:[{x:w*.265,y:h*.575,scale:this.u},{x:w*.77,y:h*.60,scale:this.u*1.1}];
    }
    background(g) {
      const random=rng(843); const sky=g.createLinearGradient(0,0,0,460);sky.addColorStop(0,"#829e8d");sky.addColorStop(.65,"#d8c993");sky.addColorStop(1,"#edd09a");g.fillStyle=sky;g.fillRect(0,0,1440,900);
      const sun=g.createRadialGradient(1070,173,10,1070,173,200);sun.addColorStop(0,"#fff0b593");sun.addColorStop(1,"#ffdc9000");g.fillStyle=sun;g.fillRect(800,0,500,430);oval(g,1070,173,55,55,"#f5de9d");
      for(let i=0;i<15;i++){const x=random()*1580-70,y=75+random()*185;oval(g,x,y,65+random()*90,8+random()*17,"#eee0b347");}
      poly(g,[[0,380],[0,289],[90,249],[168,268],[320,174],[365,190],[483,285],[560,246],[689,304],[806,211],[866,196],[985,300],[1086,271],[1203,220],[1290,271],[1440,226],[1440,425]],"#829786",null);
      poly(g,[[0,397],[0,327],[170,282],[318,336],[462,306],[587,368],[760,288],[901,349],[1070,291],[1240,347],[1440,291],[1440,450]],"#6d846d",null);
      for(let i=0;i<80;i++){const x=i*21+random()*12,y=375+random()*26,h=20+random()*45;poly(g,[[x-15,y],[x,y-h],[x+17,y]],i%2?"#627958":"#718263",null);}
      const ground=g.createLinearGradient(0,390,0,900);ground.addColorStop(0,"#9a9b6d");ground.addColorStop(.55,"#8b8956");ground.addColorStop(1,"#656d45");g.fillStyle=ground;g.fillRect(0,390,1440,510);
      poly(g,[[630,390],[755,390],[1180,900],[365,900]],"#b8a373",null);poly(g,[[700,414],[750,414],[1070,900],[931,900]],"#c1aa782c",null);
      for(let i=0;i<1700;i++){const y=400+random()*500,x=random()*1440,p=(y-380)/520;g.fillStyle=["#ded09430","#495c3433","#5a643940","#debf8120"][i%4];g.fillRect(x,y,1+p*random()*13,1+p*2);}
      // Wheel tracks, low grass and distant barbed wire establish depth without a grid.
      for(let j=0;j<2;j++)for(let i=0;i<24;i++){const y=480+i*19,p=(y-390)/510,x=735+(j?180:-40)*p;line(g,[[x,y],[x+18*p,y+4]],"#746f4e55",3*p);}
      line(g,[[0,414],[1440,414]],"#687154",2);line(g,[[0,404],[1440,404]],"#7a805b",1);
      for(let x=0;x<1440;x+=58){line(g,[[x,430],[x,388]],"#697454",3);line(g,[[x-4,400],[x+4,409]],"#697454",1);}
      this.tower(g,1175,391,.94);this.tent(g,375,447,1.14);this.barrack(g,945,454,.84);
      // Laundry: even a war has a wash day.
      line(g,[[570,334],[600,394]],"#544f39",4);line(g,[[783,329],[789,408]],"#544f39",4);
      g.beginPath();g.moveTo(570,341);g.quadraticCurveTo(672,376,784,338);g.strokeStyle="#e1d1a0";g.lineWidth=2;g.stroke();
      poly(g,[[618,353],[632,355],[638,368],[631,371],[630,389],[610,386],[613,367],[607,364]],"#dfdbb6");
      poly(g,[[679,357],[707,355],[710,389],[698,390],[693,369],[690,390],[678,389]],"#727e54");
      poly(g,[[738,347],[760,343],[763,354],[754,363],[747,356],[740,360]],"#d7bf83");
      this.tank(g,1315,509,.93);
      this.sign(g,95,509,-.10,"POZOR!","I NA VLASTNÍ",.87);
      this.sign(g,832,481,.08,"VELITELSTVÍ","← ASI TUDY",.66);
      // A field latrine, complete with an optimistic vacancy sign.
      g.save();g.translate(44,365);g.rotate(-.045);box(g,0,0,86,135,this.patterns.wood);poly(g,[[-8,0],[43,-24],[94,0]],"#586446");box(g,12,14,61,111,"#797c4c");label(g,"WC",42,50,20);oval(g,45,74,8,11,"#293f31");box(g,13,96,60,14,"#d2bc79");label(g,"VELITEL",43,106,8,INK);g.restore();
      for(let i=0;i<65;i++){const x=random()*1440,y=490+random()*370;const s=.4+(y-490)/400;line(g,[[x-3*s,y],[x-7*s,y-9*s],[x,y],[x+3*s,y-13*s],[x+2*s,y]],"#566b3b",1.6*s);}
      // Printed-paper grain baked into the scenery once, never regenerated per frame.
      for(let i=0;i<8000;i++){g.fillStyle=i%2?"#fff2bb0b":"#293a250c";g.fillRect(random()*1440,random()*900,1+random()*2,1+random()*2);}
    }
    tent(g,x,y,s) {
      g.save();g.translate(x,y);g.scale(s,s);oval(g,15,10,168,15,"#465d383b");
      poly(g,[[-155,0],[-105,-115],[63,-124],[148,-3]],this.patterns.cloth);poly(g,[[-155,0],[-105,-115],[-19,-3]],"#879061");
      poly(g,[[-135,0],[-104,-90],[-46,0]],"#344f38");poly(g,[[-131,-1],[-104,-90],[-107,-1]],"#596d46");
      line(g,[[-104,-115],[64,-124],[146,-3]],"#c1bc82",3);for(let i=0;i<5;i++)line(g,[[-63+i*34,-110],[2+i*29,-4]],"#4c623a60",2);
      line(g,[[-105,-110],[-192,9]],"#d4c58b",1.5);line(g,[[62,-120],[189,13]],"#d4c58b",1.5);
      box(g,8,-73,105,24,"#d0bd7c");label(g,"POLNÍ KUCHYNĚ",60,-57,10,INK);label(g,"DNES: PŘEKVAPENÍ",53,-31,7,"#dfd5ab");g.restore();
    }
    barrack(g,x,y,s) {
      g.save();g.translate(x,y);g.scale(s,s);poly(g,[[-154,0],[-154,-107],[142,-107],[142,0]],this.patterns.wood);
      for(let i=0;i<6;i++)line(g,[[-153,-90+i*16],[140,-90+i*16]],"#424f3b88",1);
      poly(g,[[-174,-100],[-151,-143],[124,-143],[163,-100]],"#596b55");for(let i=0;i<13;i++)line(g,[[-148+i*23,-140],[-164+i*26,-101]],"#89968170",2);
      box(g,-117,-77,54,41,"#35483a");line(g,[[-90,-77],[-90,-36]],"#b0a474",4);line(g,[[-115,-56],[-65,-56]],"#b0a474",3);
      box(g,72,-77,44,41,"#35483a");box(g,-28,-78,58,78,"#465a3f");oval(g,17,-36,3,3,"#d6b866");
      box(g,-91,-131,168,22,"#d4c18a");label(g,"TÁBOR ŠLENDRIÁN",-7,-116,13,INK);label(g,"VÍTÁME POSILY. I TEBE.",0,-7,8);g.restore();
    }
    tower(g,x,y,s) {
      g.save();g.translate(x,y);g.scale(s,s);line(g,[[-44,0],[-31,-160]],"#586849",9);line(g,[[49,0],[31,-160]],"#586849",9);
      line(g,[[-40,-9],[37,-116],[-37,-116],[44,-10]],"#61704d",4);box(g,-53,-205,109,65,this.patterns.wood);box(g,-45,-193,94,32,"#354e3b");line(g,[[0,-194],[0,-158]],"#98a276",5);
      poly(g,[[-66,-203],[-44,-225],[45,-225],[70,-203]],"#4e654d");line(g,[[39,-225],[40,-297]],"#4c6349",3);g.restore();
    }
    tank(g,x,y,s) {
      g.save();g.translate(x,y);g.scale(s,s);oval(g,0,4,114,17,"#40513644");box(g,-109,-37,218,47,"#3c4d38",INK,22);
      for(let x=-81;x<=89;x+=34){oval(g,x,-12,16,16,"#66734d",INK);oval(g,x,-12,6,6,"#3d5138");}
      poly(g,[[-101,-40],[-69,-72],[58,-72],[97,-37]],this.patterns.cloth);box(g,-35,-110,92,42,this.patterns.metal,INK,13);
      // A bent barrel: a small visual joke in the scenery.
      line(g,[[-35,-91],[-89,-91],[-103,-114],[-123,-103],[-117,-82],[-142,-78]],"#354939",13);line(g,[[-36,-94],[-87,-94],[-101,-118]],"#92a17a",3);
      star(g,23,-88,12,"#d6c98f");box(g,15,-123,28,13,"#667653");label(g,"PORUCHA",0,-47,12,"#e5d29a");g.restore();
    }
    sign(g,x,y,angle,a,b,s=1) {g.save();g.translate(x,y);g.scale(s,s);g.rotate(angle);box(g,-5,-85,10,103,"#75754a");box(g,-69,-100,138,53,"#b6a46a");line(g,[[-64,-94],[60,-94]],"#d2c38c",2);label(g,a,0,-79,16,INK);label(g,b,0,-60,9,INK);g.restore();}
    cover(g,slot) {
      g.save();g.translate(slot.x,slot.y);g.scale(slot.scale,slot.scale);oval(g,0,29,100,13,"#354d383f");
      if(slot.kind==="crate") {
        box(g,-77,-9,154,61,this.patterns.wood);for(let x=-56;x<72;x+=34)line(g,[[x,-7],[x,50]],"#4c593888",2);
        poly(g,[[-76,-8],[-67,-14],[82,-14],[77,-8]],"#aca36c");box(g,-73,-4,145,8,"#989963");box(g,-73,37,145,9,"#97945e");
        line(g,[[-63,2],[63,40]],"#a5a16c",9);for(const x of [-64,64])for(const y of [0,41])oval(g,x,y,2,2,"#3e513b");label(g,slot.i%2?"MUNICE?":"NEKLOPIT",0,28,12,"#d6d1a4");
      } else {
        for(let row=0;row<2;row++)for(let col=0;col<3;col++){const x=-90+col*61+(row?8:-3),y=-8+row*24;g.save();g.translate(x,y);g.rotate((col-1)*.03);box(g,0,0,65,30,this.patterns.sand,INK,12);line(g,[[8,7],[55,7]],"#d3bf8680",1.5);line(g,[[7,23],[57,23]],"#747849",1);for(let i=0;i<5;i++)line(g,[[6,8+i*3],[8,9+i*3]],"#717147",1);g.restore();}
      }g.restore();
    }
    barrel(g,b,spent,time) {
      g.save();g.translate(b.x,b.y);g.scale(b.scale,b.scale);oval(g,0,7,37,9,"#3a4e3447");
      if(spent){box(g,-29,-21,58,25,"#675e3e");poly(g,[[-29,-21],[-23,-35],[-11,-20],[-2,-30],[9,-20],[20,-33],[29,-21]],"#675e3e");g.restore();return;}
      const gradient=g.createLinearGradient(-30,0,30,0);gradient.addColorStop(0,"#874d35");gradient.addColorStop(.4,"#b87648");gradient.addColorStop(1,"#785036");box(g,-28,-75,56,78,gradient);oval(g,0,-75,28,8,"#b98b57",INK);
      box(g,-30,-59,60,6,"#6f6944");box(g,-30,-15,60,6,"#6f6944");box(g,-23,-49,46,27,"#ddc680");label(g,"GULÁŠ",0,-37,9,INK);label(g,"VÝBUŠNÝ",0,-27,6,INK);star(g,0,-66,5,"#e7c369");
      if(time%3<1.5){label(g,"!",0,-90,20,"#f3d16a");}g.restore();
    }
    helmet(g,kind="soldier") {
      if(kind==="pot"){box(g,-26,-20,52,28,"#869990",INK,5);box(g,-34,-17,9,7,"#85948a");box(g,25,-17,9,7,"#85948a");line(g,[[-20,-15],[17,-15]],"#c9d1b6",3);}
      else {g.beginPath();g.ellipse(0,0,28,24,0,Math.PI,TAU);g.closePath();g.fillStyle=this.patterns.cloth;g.fill();g.strokeStyle=INK;g.lineWidth=2.5;g.stroke();box(g,-32,-1,64,8,"#626e43",INK,4);poly(g,[[-19,-14],[-7,-20],[0,-13],[-5,-4],[-22,-7]],"#475e3c",null);poly(g,[[12,-20],[21,-13],[24,-5],[12,-8]],"#a0a166",null);star(g,5,-10,6,"#dcca82");}
    }
    soldier(g,e,time,preview=false) {
      const age=time-e.born,death=e.dead?clamp((time-e.deadAt)/.7,0,1):0,rise=preview?1:clamp(age/.32,0,1);
      const bob=Math.sin(time*4+e.seed)*1.4,foot=e.y+(1-rise)*125*e.scale;
      g.save();if(!e.free){g.beginPath();g.rect(e.x-125*e.scale,0,250*e.scale,e.y+10*e.scale);g.clip();}
      g.translate(e.x,foot+bob*e.scale+death*95*e.scale);g.scale(e.scale,e.scale);g.rotate(e.dead?death*(e.seed%2?.9:-.9):Math.sin(time*2+e.seed)*.025);g.globalAlpha=1-death;
      const cook=e.kind==="cook",officer=e.kind==="officer",salute=e.saluteUntil>time&&!e.dead;
      oval(g,0,8,46,9,"#3b4a313d");
      const walk=e.free?Math.sin(time*10)*9:0;
      line(g,[[-14,-35],[-18-walk,-2]],"#4a5738",17);line(g,[[14,-35],[21+walk,-2]],"#4a5738",17);box(g,-33-walk,-4,26,13,"#364431");box(g,9+walk,-4,28,13,"#364431");
      poly(g,[[-29,-99],[-40,-72],[-33,-30],[34,-30],[40,-72],[26,-99]],cook?"#e1dfbc":this.patterns.cloth);
      poly(g,[[-28,-94],[-6,-86],[-14,-66],[-29,-69]],cook?"#f0e5c5":"#a0a16e",null);poly(g,[[27,-94],[7,-86],[14,-67],[30,-70]],cook?"#f0e5c5":"#a0a16e",null);
      if(cook){box(g,-23,-73,47,42,"#ede5c4",INK,1);line(g,[[-24,-71],[24,-32]],"#b0af89",1);label(g,"OBĚD",0,-46,9,"#7b8054");}
      else {box(g,-29,-73,24,22,"#849064");box(g,8,-73,24,22,"#849064");line(g,[[-27,-67],[-7,-67]],"#b4b481",2);line(g,[[10,-67],[30,-67]],"#b4b481",2);box(g,-34,-37,68,9,"#51583a");box(g,-5,-39,13,11,"#c2b571");poly(g,[[-25,-97],[-15,-99],[29,-34],[20,-31]],"#544f36",null);}
      line(g,[[-31,-87],[-46,-61],[-14,-57]],cook?"#dddcc0":"#667644",17);line(g,salute?[[31,-86],[58,-112],[29,-141]]:[[31,-86],[48,-63],[22,-57]],cook?"#dddcc0":"#667644",17);
      oval(g,-11,-58,10,9,"#d7ad78",INK);oval(g,salute?29:23,salute?-141:-59,10,9,"#d7ad78",INK);
      if(cook){line(g,[[27,-60],[59,-91]],"#8f7850",5);oval(g,62,-94,10,15,"#a4aa94",INK);}
      else {box(g,-18,-67,69,10,"#384a40");box(g,-26,-63,26,12,"#8b6d43");box(g,48,-66,25,6,"#34483e");poly(g,[[15,-58],[26,-58],[29,-41],[18,-43]],"#3e5045");line(g,[[1,-66],[42,-66]],"#a1ac8c",2);}
      oval(g,0,-108,12,11,"#ba9463",INK);oval(g,-27,-120,7,10,"#d2a775",INK);oval(g,27,-120,7,10,"#d2a775",INK);
      oval(g,0,-122,29,31,"#dfb782",INK);oval(g,7,-121,23,26,"#e8c28a");oval(g,-18,-115,8,5,"#d59369");oval(g,21,-115,7,5,"#d59369");
      // Oversized eyes, nose and moustache keep the combat deliberately cartoonish.
      oval(g,-10,-129,8,9,"#f3ebcf",INK);oval(g,11,-129,8,9,"#f3ebcf",INK);
      if(e.dead){line(g,[[-14,-134],[-6,-125]],INK,2);line(g,[[-6,-134],[-14,-125]],INK,2);line(g,[[7,-134],[15,-125]],INK,2);line(g,[[15,-134],[7,-125]],INK,2);}
      else {oval(g,-8,-128,2.5,4,INK);oval(g,9,-128,2.5,4,INK);}
      oval(g,2,-117,10,9,"#db9d6a",INK);oval(g,-7,-106,12,5,"#514832");oval(g,12,-106,12,5,"#514832");
      if(e.jammed || e.dead)oval(g,2,-98,5,4,"#694a33");else line(g,[[-4,-98],[6,-97]],"#885c3d",2);
      if(cook){box(g,-24,-160,49,20,"#f2ebcf");oval(g,-22,-163,15,15,"#eee6c7",INK);oval(g,0,-170,21,19,"#f7efd7",INK);oval(g,23,-162,15,15,"#eee6c7",INK);box(g,-25,-152,51,10,"#dfd9b8");}
      else if(officer){poly(g,[[-30,-148],[-27,-169],[25,-169],[32,-148]],"#7c8b55");box(g,-31,-149,64,8,"#c5b36a");poly(g,[[-32,-141],[30,-141],[20,-134],[-22,-134]],"#3c4c37");star(g,0,-157,8,"#ead17f");}
      else if(!e.dead){g.save();g.translate(0,-147+(e.jammed?6:0));g.rotate(e.jammed?.15:0);this.helmet(g,e.kind);g.restore();}
      if(cook&&!e.dead){box(g,-51,-218,102,23,"#c9ddad",INK,4);label(g,"NÁŠ KUCHAŘ",0,-202,10,"#354d32");}
      if(!preview&&!e.dead&&!cook){const progress=clamp(age/e.life,0,1);box(g,-28,-188,56,5,"#334632",null,2);box(g,-28,-188,Math.max(1,56*progress),5,e.jammed?"#d9c778":progress>.72?"#ed8960":"#c3cc8d",null,2);if(progress>.72||e.jammed){label(g,e.jammed?"CVAK?!":"!",0,-197,20,e.jammed?"#f1df9e":"#ffdc92");}}
      g.restore();
    }
    supply(g,s,time) {
      g.save();g.translate(s.x,s.y);g.scale(this.u,this.u);g.rotate(Math.sin(time*2)*.12);
      line(g,[[-46,-69],[-18,0]],"#ded7b6",1.5);line(g,[[46,-69],[18,0]],"#ded7b6",1.5);
      g.beginPath();g.arc(0,-67,58,Math.PI,TAU);g.closePath();g.fillStyle="#cfaf58";g.fill();g.strokeStyle=INK;g.lineWidth=2;g.stroke();
      poly(g,[[0,-125],[-19,-68],[18,-68]],"#ece0a3",null);line(g,[[0,-69],[0,-29],[7,-25],[13,-32]],"#695e3b",3);
      box(g,-24,-7,48,39,this.patterns.wood);box(g,-6,-7,12,39,"#d6bb78");label(g,"+",0,21,25,"#f8edc8");label(g,"ZÁSOBY",0,52,10,"#f5e3ae");g.restore();
    }
    ambient(g,time) {
      const w=this.w,h=this.h,u=this.u;
      // Waving flag mounted on the distant watchtower.
      g.save();g.translate(w* .842,h*.09);g.scale(w/1440,h/900);poly(g,[[0,0],[45,5+Math.sin(time*2)*4],[39,21+Math.sin(time*2+1)*5],[0,18]],"#d0af5f",null);g.restore();
      for(let i=0;i<5;i++){const p=(time*.13+i*.2)%1;oval(g,w*.906+Math.sin(p*4+i)*10*u,h*.444-p*55*u,(8+p*19)*u,(5+p*13)*u,`rgba(65,78,56,${(1-p)*.16})`);}
      for(let i=0;i<12;i++){const x=((i*139+time*7)%(w+50))-25,y=h*.46+Math.sin(i*13+time*.5)*h*.17;oval(g,x,y,1.3*u,1*u,"#f1d59b65");}
      // The camp chicken strolls behind the player's sandbags.
      const x=w*(.76+Math.sin(time*.09)*.11),y=h*.81;
      g.save();g.translate(x,y);g.scale(u*(Math.cos(time*.09)<0?-1:1),u);line(g,[[-7,10],[-9+Math.sin(time*9)*3,23]],"#b48e4e",3);line(g,[[6,10],[9-Math.sin(time*9)*3,23]],"#b48e4e",3);oval(g,0,0,17,12,"#e4d8ae",INK);oval(g,13,-13,9,12,"#e7dcba",INK);poly(g,[[20,-15],[30,-10],[20,-7]],"#d7ac59");oval(g,16,-15,2,2,INK);oval(g,12,-27,4,5,"#b76242");poly(g,[[-13,-2],[-25,-15],[-24,5]],"#d1c594");g.restore();
    }
    foreground(g) {
      const w=this.w,h=this.h,u=this.u;
      g.save();g.translate(0,h);g.scale(u,u);
      for(let i=0;i<5;i++){box(g,i*84-25,-42+(i%2)*7,99,55,this.patterns.sand,INK,17);line(g,[[i*84-10,-29],[i*84+56,-27]],"#c8b98088",2);}g.restore();
      g.save();g.translate(w,h);g.scale(u,u);for(let i=0;i<4;i++)box(g,-i*87-45,-40+(i%2)*9,97,54,this.patterns.sand,INK,17);g.restore();
    }
    weapon(g,state) {
      const u=this.u*1.16,w=this.w,h=this.h,reload=state.reload>0?Math.sin((1-state.reload/state.reloadDuration)*Math.PI):0;
      const x=w*.53+(state.aim.x-w/2)*.026,y=h+30*u+state.recoil*19*u+reload*160*u;
      g.save();g.translate(x,y);g.scale(u,u);g.rotate(-.075-reload*.32);
      poly(g,[[97,28],[42,-93],[78,-132],[111,-121],[218,25]],this.patterns.cloth);poly(g,[[-213,27],[-128,-124],[-79,-147],[-35,-107],[-54,21]],this.patterns.cloth);
      poly(g,[[-182,-22],[-136,-91],[-114,-64],[-128,-19]],"#4d653e",null);poly(g,[[145,-27],[97,-98],[92,-54],[110,-22]],"#3e553b",null);
      line(g,[[-168,-54],[-127,-30]],"#c3bb7d70",2);box(g,-141,-76,31,18,"#aa9e62");label(g,"07",-126,-63,11,"#e8dcb1");
      g.save();g.translate(-65-reload*55,-116+reload*80);g.rotate(-.3);oval(g,0,0,29,40,"#b39d68",INK);for(let i=0;i<4;i++)box(g,-20+i*11,-27,10,27,"#baa573",INK,5);line(g,[[-18,15],[17,16]],"#655d3e",3);g.restore();
      oval(g,68,-102,27,40,"#ae9b6b",INK);for(let i=0;i<3;i++)line(g,[[47,-119+i*12],[76,-114+i*12]],"#736b49",2);
      // Perspective receiver, ribbed handguard and iron sights.
      poly(g,[[-73,28],[-48,-156],[20,-161],[96,10]],"#534c32");poly(g,[[-65,15],[-39,-145],[14,-150],[71,4]],"#8e7043");
      for(let i=0;i<9;i++)line(g,[[-45+i*7,-2],[-33+i*4,-101]],"#b993563a",2);
      poly(g,[[-45,-78],[-28,-229],[23,-231],[53,-82]],this.patterns.metal);poly(g,[[-27,-228],[-17,-282],[14,-284],[24,-230]],"#405348");
      box(g,-12,-332,24,61,"#33473e");box(g,-9,-337,18,17,"#6e7f6b");box(g,-4,-352,8,21,"#2d443a");line(g,[[-8,-326],[-8,-283]],"#a2b19a",2);
      for(let i=0;i<8;i++)box(g,-26-i*.4,-221+i*9,51+i,4,i%2?"#2b4037":"#819078",null,1);
      poly(g,[[-43,-160],[-37,-180],[31,-180],[42,-162]],"#798675");box(g,-16,-185,30,24,"#2b4238");box(g,-9,-179,16,12,"#b8bc94");box(g,-3,-179,5,15,"#314a3b",null,0);
      line(g,[[-38,-152],[-34,-89]],"#aeb597",2);box(g,31,-136,19,8,"#9caa91");oval(g,53,-132,7,6,"#3c5144",INK);
      // Inventory repair: the receiver is held together with tape.
      poly(g,[[-44,-92],[46,-102],[53,-73],[-47,-65]],"#b5ac76");for(let i=0;i<4;i++)line(g,[[-42,-88+i*6],[44,-97+i*6]],"#d3c89755",1);
      box(g,-29,-59,57,27,"#e5cf8e");label(g,"NEKLEPAT",0,-41,8,"#4a5136");line(g,[[-20,-125],[-5,-130]],"#b7b89c",1);line(g,[[2,-140],[15,-144]],"#a3ad91",1);
      // A dangling lucky duck, because procurement had a spare one.
      line(g,[[35,-74],[72+Math.sin(state.visualTime*5)*5,-51]],"#b3af7b",1.5);oval(g,78+Math.sin(state.visualTime*5)*5,-43,12,9,"#e8c15c",INK);oval(g,83+Math.sin(state.visualTime*5)*5,-54,7,8,"#efcc6a",INK);oval(g,85+Math.sin(state.visualTime*5)*5,-56,1.4,1.4,INK);
      if(state.muzzle>0){g.globalAlpha=state.muzzle;const pts=[];for(let i=0;i<14;i++){const a=i/14*TAU,r=i%2?19:62;pts.push([Math.cos(a)*r,-361+Math.sin(a)*r]);}poly(g,pts,"#f5bb50",null);star(g,0,-361,35,"#fff3b7");}
      g.restore();
    }
    effects(g,state) {
      for(const p of state.particles){g.save();g.translate(p.x,p.y);g.rotate(p.angle);g.globalAlpha=clamp(p.life/p.max,0,1);if(p.kind==="helmet"){g.scale(p.size,p.size);this.helmet(g,p.variant);}else if(p.kind==="star")star(g,0,0,p.size,p.color,p.angle);else if(p.kind==="smoke")oval(g,0,0,p.size,p.size*.75,p.color);else{g.fillStyle=p.color;g.fillRect(-p.size/2,-p.size/2,p.size,p.kind==="casing"?p.size*2.4:p.size*.65);}g.restore();}
      for(const f of state.floaters){g.save();g.translate(f.x,f.y);g.rotate(f.angle);g.globalAlpha=clamp(f.life/.3,0,1);g.font=`900 ${f.size}px Impact, Arial Narrow, sans-serif`;g.textAlign="center";g.lineJoin="round";g.strokeStyle="#303e2c";g.lineWidth=4;g.strokeText(f.text,0,0);g.fillStyle=f.color;g.fillText(f.text,0,0);g.restore();}
    }
    crosshair(g,state) {
      const {x,y}=state.aim,spread=8+state.recoil*7;g.save();g.translate(x,y);g.strokeStyle="#253c2bb0";g.lineWidth=4;
      const parts=[[[-spread-8,0],[-spread,0]],[[spread,0],[spread+8,0]],[[0,-spread-8],[0,-spread]],[[0,spread],[0,spread+8]]];
      for(const p of parts)line(g,p,"#203525b0",4);for(const p of parts)line(g,p,"#f6edc5",1.6);oval(g,0,0,2,2,"#f5cf68");
      if(state.hitMarker>0){for(let i=0;i<4;i++){g.rotate(Math.PI/2);line(g,[[6,6],[11,11]],"#f1d170",2.5);}}g.restore();
    }
    render(state) {
      const g=this.g,time=state.visualTime;g.save();g.drawImage(this.cache,0,0,this.w,this.h);
      // Aim changes only the weapon. The player's world position remains fixed.
      if(state.shake>0&&!state.reducedMotion)g.translate(Math.sin(time*83)*state.shake,Math.cos(time*71)*state.shake*.6);
      this.ambient(g,time);
      const drawables=[];
      for(const slot of this.slots){drawables.push({y:slot.y,draw:()=>{const e=state.enemies.find(e=>e.slot===slot.i);if(e)this.soldier(g,e,state.time);this.cover(g,slot);}});}
      for(const [i,b] of this.barrels.entries())drawables.push({y:b.y,draw:()=>this.barrel(g,b,state.barrelTimers[i]>0,time)});
      for(const e of state.enemies.filter(e=>e.free))drawables.push({y:e.y,draw:()=>this.soldier(g,e,state.time)});
      if(state.mode==="menu"){for(const [i,x] of [[0,.66],[1,.88]])drawables.push({y:this.h*.59,draw:()=>this.soldier(g,{x:this.w*x,y:this.h*.60,scale:this.u*1.15,seed:i+1,kind:i?"pot":"officer",born:0,free:true},time,true)});}
      drawables.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
      if(state.supply)this.supply(g,state.supply,time);
      this.foreground(g);this.effects(g,state);this.weapon(g,state);
      if(state.mode==="playing")this.crosshair(g,state);g.restore();
      if(state.damageFlash>0){const v=g.createRadialGradient(this.w/2,this.h/2,this.h*.15,this.w/2,this.h/2,this.h*.8);v.addColorStop(0,"#d54d2c00");v.addColorStop(1,`rgba(192,70,37,${state.damageFlash*.65})`);g.fillStyle=v;g.fillRect(0,0,this.w,this.h);}
    }
  }
  window.FieldRenderer=FieldRenderer;
})();
