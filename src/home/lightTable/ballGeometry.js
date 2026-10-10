// Same cube-face-to-sphere panel construction as the existing GameOnVB ball.
export function panelGeometry(face,band,resolution=18) {
  const positions=[],normals=[],uvs=[],indices=[]
  for(let row=0;row<=resolution;row++)for(let col=0;col<=resolution;col++){
    const u=-1+band*2/3+.009+(2/3-.018)*col/resolution,v=-.991+1.982*row/resolution
    const p=[[1,u,v],[-1,v,u],[v,1,u],[u,-1,v],[u,v,1],[v,u,-1]][face]
    const length=Math.hypot(...p),n=p.map(x=>x/length)
    positions.push(...n);normals.push(...n);uvs.push(col/resolution,row/resolution)
    if(row<resolution&&col<resolution){const a=row*(resolution+1)+col,b=a+resolution+1;indices.push(a,b,a+1,b,b+1,a+1)}
  }
  for(let i=0;i<indices.length;i+=3){
    const a=positions.slice(indices[i]*3,indices[i]*3+3),b=positions.slice(indices[i+1]*3,indices[i+1]*3+3),c=positions.slice(indices[i+2]*3,indices[i+2]*3+3)
    const u=b.map((x,j)=>x-a[j]),v=c.map((x,j)=>x-a[j])
    const dot=(u[1]*v[2]-u[2]*v[1])*a[0]+(u[2]*v[0]-u[0]*v[2])*a[1]+(u[0]*v[1]-u[1]*v[0])*a[2]
    if(dot<0)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]]
  }
  return {positions,normals,uvs,indices}
}
