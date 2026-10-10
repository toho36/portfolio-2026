// Isolated copy of only staircaseView's three blocks, stone and thin trims.
// Production geometry/material/camera remain read-only; no second ball or drag UI.
export function createBallSteps(T,document,own){
  const group=new T.Group(),canvas=document.createElement('canvas');canvas.width=canvas.height=512
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Stone texture unavailable')
  let seed=91;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  ctx.fillStyle='#343630';ctx.fillRect(0,0,512,512)
  for(let i=0;i<17000;i++){const value=40+Math.floor(random()*36);ctx.fillStyle=`rgba(${value},${value},${value},.24)`;ctx.fillRect(random()*512,random()*512,2,2)}
  for(let line=0;line<15;line++){let x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);for(let i=0;i<10;i++){x+=random()*75-20;y+=random()*65-24;ctx.lineTo(x,y)}ctx.strokeStyle='rgba(164,147,110,.16)';ctx.lineWidth=random()*1.5+.3;ctx.stroke()}
  const texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping
  const stone=own(new T.MeshStandardMaterial({color:'#a0a394',map:texture,bumpMap:texture,bumpScale:.025,roughness:.72,metalness:.08,transparent:true,opacity:0}))
  const trim=own(new T.MeshStandardMaterial({color:'#957846',emissive:'#e59c38',emissiveIntensity:.04,roughness:.42,metalness:.3,transparent:true,opacity:0}))
  function mesh(g,m){const object=new T.Mesh(own(g),m);group.add(object);return object}
  for(const [left,right,y] of [[-4.8,-1.6,1.7],[-1.6,1.6,0],[1.6,4.8,-1.7]]){
    const height=y+5.2,block=mesh(new T.BoxGeometry(right-left,height,11),stone);block.position.set((left+right)/2,y-height/2,-3.8);block.receiveShadow=true
    mesh(new T.BoxGeometry(3.2,.018,.018),trim).position.set((left+right)/2,y+.012,1.7)
    mesh(new T.BoxGeometry(.018,.018,11),trim).position.set(right-.008,y+.012,-3.8)
  }
  return {group,reveal(p){group.visible=p>0;stone.opacity=trim.opacity=p;stone.depthWrite=trim.depthWrite=p>.98}}
}

// CPU projection of the same blocks/camera for reduced/no-GPU mode. Only the
// stone polygons are SVG; the volleyball always uses its native same-model PNG.
export function staticLanding(aspect,screenWidth=aspect*1000){
  const normalize=v=>{const n=Math.hypot(...v);return v.map(x=>x/n)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0)
  const z=normalize([7,7.4,15]),x=normalize(cross([0,1,0],z)),y=cross(z,x),span=Math.max(8.2,9.4/aspect)
  const target=screenWidth>760?[.4,.55]:[.5,.57]
  const project=p=>{const v=p.map((n,i)=>n-[-3.45,2.62,0][i]);return [target[0]+dot(v,x)/(span*aspect),target[1]-dot(v,y)/span]}
  const blocks=[[-4.8,-1.6,1.7],[-1.6,1.6,0],[1.6,4.8,-1.7]].map(([left,right,top])=>[
    [[left,top,1.7],[right,top,1.7],[right,top,-9.3],[left,top,-9.3]],
    [[left,top,1.7],[left,-5.2,1.7],[right,-5.2,1.7],[right,top,1.7]],
    [[right,top,1.7],[right,-5.2,1.7],[right,-5.2,-9.3],[right,top,-9.3]],
  ].map(face=>face.map(project)))
  const [bx,by]=project([-3.45,2.62,0])
  return {blocks,ball:{x:bx,y:by,diameter:1.84/span}}
}
export function staticStepImage(pose){
  const polygon=(face,i)=>`<polygon points="${face.map(([x,y])=>`${x*1000},${y*1000}`).join(' ')}" fill="${['#343630','#23241e','#0e1113'][i]}"/>`
  const trims=pose.blocks.map(block=>`<polyline points="${[block[0][0],block[0][1],block[0][2]].map(([x,y])=>`${x*1000},${y*1000}`).join(' ')}" fill="none" stroke="#957846" stroke-width="1.4"/>`).join('')
  return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">${pose.blocks.map(block=>block.map(polygon).join('')).join('')}${trims}</svg>`)
}
