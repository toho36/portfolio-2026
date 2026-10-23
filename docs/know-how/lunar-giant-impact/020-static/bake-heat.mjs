import {writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {crustRelief,HEAT_SIZE,HEAT_MIN,HEAT_SPAN} from './crust.js'

const [width,height,depth]=HEAT_SIZE,data=new Uint8Array(width*height*depth)
for(let z=0;z<depth;z++)for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const point=[x,y,z].map((value,i)=>HEAT_MIN[i]+HEAT_SPAN[i]*(value+.5)/HEAT_SIZE[i])
  data[(z*height+y)*width+x]=Math.round(crustRelief(...point).heat*255)
}
writeFileSync(new URL('./assets/crust-heat.bin',import.meta.url),data)
console.log(JSON.stringify({bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),size:HEAT_SIZE,min:HEAT_MIN,span:HEAT_SPAN}))
