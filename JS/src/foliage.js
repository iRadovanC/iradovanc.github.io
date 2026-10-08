import * as THREE from 'three';
// Alpha-tested needle clusters keep the forest detailed while all trees share
// one draw call and one local texture. No transparent-sorting artifacts.
export function pineTexture(random){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;
  const ctx=canvas.getContext('2d');
  ctx.strokeStyle='#5c5940';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(257,970);ctx.lineTo(256,20);ctx.stroke();
  for(let tier=33;tier>=0;tier--){
    const y=42+tier*24,span=12+tier*5.6;
    for(const side of [-1,1]){
      const endX=256+side*span*(.85+random()*.25),endY=y+14+random()*22;
      ctx.strokeStyle='#494b35';ctx.lineWidth=1+tier*.04;ctx.beginPath();ctx.moveTo(256,y-8);ctx.quadraticCurveTo(256+side*span*.7,y+22,endX,endY);ctx.stroke();
      for(let cluster=0;cluster<17;cluster++){
        const t=cluster/17,cx=256+(endX-256)*t,cy=y+20*t+random()*9;
        const twigLength=(9+random()*14)*(1-t*.5),dx=side*(5+random()*7),dy=-twigLength;
        for(let j=0;j<24;j++){
          const f=random(),nx=cx+dx*f+(random()-.5)*12,ny=cy+dy*f+(random()-.5)*5;
          const green=35+Math.floor(random()*31)+(tier%3)*4;
          ctx.strokeStyle=`rgb(${Math.round(green*.88)},${green+11},${Math.round(green*.67)})`;
          ctx.lineWidth=.8+random();ctx.beginPath();ctx.moveTo(nx,ny);ctx.lineTo(nx+side*(3+random()*6),ny-4-random()*7);ctx.stroke();
        }
      }
    }
  }
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
