// Direct translation of BOMB.EXE file 0x82bc..0x8442 (VGA256 BGI driver).
// Integer input coordinates; emit inclusive endpoints, preserve input direction.
export function bgiLine(x0,y0,x1,y1,plot){
  const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x1>=x0?1:-1,sy=y1>=y0?1:-1;
  const horizontal=dx>dy,major=horizontal?dx:dy,minor=horizontal?dy:dx;
  let error=major>>1;
  plot(x0,y0);
  for(let i=0;i<major;i++){
    if(horizontal)x0+=sx;else y0+=sy;
    error+=minor;
    if(error>=major){if(horizontal)y0+=sy;else x0+=sx;error-=major;}
    plot(x0,y0);
  }
}
