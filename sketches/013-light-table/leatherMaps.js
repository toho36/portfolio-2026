export function leatherMaps(T,document,own) {
  const height=document.createElement('canvas');height.width=height.height=1024
  const ctx=height.getContext('2d');if(!ctx)throw new Error('Leather material unavailable')
  ctx.fillStyle='#474747';ctx.fillRect(0,0,1024,1024)
  let seed=91
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let row=-1;row<59;row++)for(let col=-1;col<59;col++){
    const x=col*18+(row%2)*9+(random()-.5)*6,y=row*18+(random()-.5)*6,r=6.9+random()*2.1
    const shade=ctx.createRadialGradient(x-.6,y-.6,.1,x,y,r)
    shade.addColorStop(0,'#ededed');shade.addColorStop(.55,'#bababa');shade.addColorStop(1,'#595959')
    ctx.fillStyle=shade;ctx.beginPath();ctx.ellipse(x,y,r,r*(.72+random()*.2),random()*Math.PI,0,Math.PI*2);ctx.fill()
  }
  const bump=own(new T.CanvasTexture(height));bump.anisotropy=4
  const albedo=document.createElement('canvas');albedo.width=albedo.height=1024
  const a=albedo.getContext('2d');if(!a)throw new Error('Leather albedo unavailable')
  a.fillStyle='#f5f5f5';a.fillRect(0,0,1024,1024);a.globalAlpha=.09;a.drawImage(height,0,0)
  const color=own(new T.CanvasTexture(albedo));color.colorSpace=T.SRGBColorSpace;color.anisotropy=4
  return {bump,color}
}
