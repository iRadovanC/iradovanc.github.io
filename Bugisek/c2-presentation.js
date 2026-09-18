/* Shared presentation helpers; independent of the DOM for layout regression checks. */
(function(root){
  'use strict';
  const SYMBOLS = {
    infantry:'<path d="M8 16 56 48M8 48 56 16"/>',
    armor:'<ellipse cx="32" cy="32" rx="18" ry="10"/>',
    artillery:'<circle cx="32" cy="32" r="5" fill="currentColor" stroke="none"/>',
    reconnaissance:'<path d="M8 48 56 16"/>',
    engineer:'<path d="M18 40V25h28v15M26 25v12M38 25v12"/>',
    signal:'<path d="m37 19-14 14h17L27 45"/>'
  };
  function symbol(unit){
    return `<svg class="app6-symbol" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="miter"><g fill="currentColor" stroke="none"><circle cx="25" cy="7" r="2"/><circle cx="32" cy="7" r="2"/><circle cx="39" cy="7" r="2"/></g><path fill="#a8d8ef" d="M8 16h48v32H8z"/>${SYMBOLS[unit.symbol]||SYMBOLS.infantry}</g></svg>`;
  }
  const COMIC_POSES=['facepalm','shock','despair'];
  // Rotate the combination without repeating a pose for the same soldier.
  function reactionPoses(emotion,serial){
    const offset=((serial%3)+3)%3;
    if(emotion==='happy')return ['approval','neutral','approval'].map((_,i)=>['approval','neutral','approval'][(i+offset)%3]);
    return [0,1,2].map(i=>COMIC_POSES[(i+offset)%3]);
  }
  function layoutMarkers(points,width,height,markerWidth,markerHeight){
    const left=44+markerWidth/2,right=width-markerWidth/2-3;
    const top=36+markerHeight/2,bottom=height-markerHeight/2-20;
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const desired=points.map(p=>({x:clamp(p.x,left,right),y:clamp(p.y,top,bottom)}));
    const columns=Math.max(1,Math.floor((right-left)/(markerWidth+2))+1);
    const rows=Math.max(1,Math.floor((bottom-top)/(markerHeight+2))+1);
    const grid=[];
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)grid.push({x:columns===1?(left+right)/2:left+x*(right-left)/(columns-1),y:rows===1?(top+bottom)/2:top+y*(bottom-top)/(rows-1)});
    const overlaps=(a,b)=>Math.abs(a.x-b.x)<markerWidth+1&&Math.abs(a.y-b.y)<markerHeight+1;
    const nearest=(candidates,p)=>candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    let placed=[];
    for(const p of desired){
      const candidate=nearest([p,...grid].filter(c=>!placed.some(other=>overlaps(c,other))),p)[0];
      if(!candidate){placed=[];break;}placed.push(candidate);
    }
    // A regular lattice guarantees a complete packing on the smallest supported map.
    if(placed.length!==points.length){const available=[...grid];placed=desired.map(p=>{const best=nearest(available,p).shift();return best||p;});}
    return placed;
  }
  const api={symbol,reactionPoses,COMIC_POSES,layoutMarkers};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.C2Presentation=api;
})(typeof window!=='undefined'?window:globalThis);
