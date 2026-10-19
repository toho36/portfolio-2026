"""CPU-only parent compositor, no Blender/encoding/server invocation.

python3 -B compose_arena_hold.py --inputs /.../inputs.json \
  --desktop-loop /.../desktop-native --mobile-loop /.../mobile-native \
  --out /.../FRESH-preview/assets

Parent copies arena-hold-preview.html and existing style.css beside assets/.
After real compositing, parent encodes each camera (commands are also in manifest):
ffmpeg -framerate 24 -start_number 84 -i NATIVE/frame-%04d.png -frames:v 48
  -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart assets/CAMERA/loop.mp4
ffmpeg -framerate 24 -start_number 85 -i assets/CAMERA/travel/frame-%04d.png
  -frames:v 84 -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart assets/CAMERA/travel.mp4

Only a complete, SHA-checked native receipt is accepted. Existing arena PNGs are
derived pixels, never additional native frames. PNG168 and landing retain actual
Lab228 file bytes. All other pixels outside the physical screen remain untouched.

Final CPU admission: add --final --approval /.../final/OWNER-APPROVAL.json.
The preview registry stays byte-identical; only completed, approval-bound final
native receipts (48 frames/camera, 32spp, 1600x900/900x1600) are accepted.
Encoding commands are proposals for the parent; measured byte caps still apply.
"""
import argparse
import json
from pathlib import Path
import shutil
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'blender'))
import arena_hold as hold

FINAL_SIZE = {'desktop': (1600,900), 'mobile': (900,1600)}
PREVIEW_INPUTS_SHA256 = '4855f6cee23d503f2cb99fee08af474923fa9e9ded13dd669ffa06fbc36c2e3c'
FINAL_APPROVAL_SHA256 = '5ea91917ea4a5982e189892586afec122872936ffa9b3b67007e83b7ed1c3a44'


def parse_args(argv=None):
    parser=argparse.ArgumentParser(description=__doc__,allow_abbrev=False)
    for key in ('inputs','desktop-loop','mobile-loop','out'):
        parser.add_argument('--'+key,type=Path,required=True)
    parser.add_argument('--final',action='store_true')
    parser.add_argument('--approval',type=Path)
    args=parser.parse_args(argv)
    if args.final != (args.approval is not None):
        parser.error('--final and --approval must be supplied together')
    return args


def final_approval(inputs_path, approval_path):
    approval=Path(approval_path).resolve(strict=True)
    if (approval.name!='OWNER-APPROVAL.json' or approval.parent.name!='final'
        or hold.sha256(approval)!=FINAL_APPROVAL_SHA256
        or hold.sha256(inputs_path)!=PREVIEW_INPUTS_SHA256):
        raise ValueError('final requires exact owner approval and unchanged preview input registry')
    return FINAL_APPROVAL_SHA256


def verify_loop(root, camera, variant, inputs_path, approval_sha256=None):
    final=approval_sha256 is not None
    sizes=FINAL_SIZE if final else hold.SIZE
    root=Path(root).resolve(strict=True)
    receipt=json.loads((root/'native-manifest.json').read_text())
    if (receipt['kind']!=('gameon-hold-native-final' if final else 'gameon-hold-native-preview') or receipt['camera']!=camera
        or receipt['source_sha256']!=variant['native_source_sha256']
        or receipt['inputs_sha256']!=hold.sha256(inputs_path)
        or receipt['frames']!=list(hold.FRAMES) or receipt['size']!=list(sizes[camera])
        or receipt['fps']!=24 or receipt['samples']!=(32 if final else 8) or receipt['prepare_only']
        or receipt['rebaked'] or receipt['handlers']):
        raise ValueError('loop receipt is not the approved completed final' if final else 'loop receipt is not the approved completed preview')
    if final and (approval_sha256!=FINAL_APPROVAL_SHA256
                  or receipt.get('owner_approval_sha256')!=approval_sha256
                  or receipt.get('closure_key_not_rendered')!=132):
        raise ValueError('final receipt lacks exact owner approval/closure evidence')
    rows=receipt['rendered']
    if [row['frame'] for row in rows]!=list(hold.FRAMES):
        raise ValueError('exactly 48 actual native frame hashes required')
    if sorted(p.name for p in root.glob('frame-*.png'))!=[f'frame-{f:04d}.png' for f in hold.FRAMES]:
        raise ValueError('native folder contains missing or excess frames')
    for row in rows:
        expected=f"frame-{row['frame']:04d}.png"
        if row['file']!=expected:
            raise ValueError('unexpected native frame path')
        file=root/expected
        if hold.png_size(file)!=sizes[camera] or hold.sha256(file)!=row['sha256']:
            raise ValueError(f'actual native frame differs: {file}')
    return root,receipt


def inverse(h):
    a,b,c,d,e,f,g,i,j=h
    result=(e*j-f*i,c*i-b*j,b*f-c*e,f*g-d*j,a*j-c*g,c*d-a*f,d*i-e*g,b*g-a*i,a*e-b*d)
    if abs(result[8])<1e-12:
        raise ValueError('noninvertible pixel mapping')
    return tuple(v/result[8] for v in result)


def warp(image, mapping, destination_size, Image):
    # Pillow requires output-pixel -> input-pixel mapping, not CSS forward mapping.
    dw,dh=destination_size; sw,sh=image.size
    inv=inverse(mapping)
    pixel=(sw*inv[0]/dw,sw*inv[1]/dh,sw*inv[2],
           sh*inv[3]/dw,sh*inv[4]/dh,sh*inv[5],inv[6]/dw,inv[7]/dh)
    return image.transform(destination_size,Image.Transform.PERSPECTIVE,pixel,
                           resample=Image.Resampling.BICUBIC,fillcolor=0)


def padding_color(photo):
    # Source-matched quiet padding from actual photo corners, never generated art.
    samples=[photo.getpixel(p) for p in ((0,0),(photo.width-1,0),(0,photo.height-1),(photo.width-1,photo.height-1))]
    return tuple(round(sum(c[i] for c in samples)/len(samples)) for i in range(3))


def atlas_image(photo, roi, Image):
    _,(x,y,w,h)=hold.roi_fit(photo.size,roi)
    atlas=Image.new('RGB',hold.ATLAS,padding_color(photo))
    crop=photo.crop(tuple(roi)).resize((round(w),round(h)),Image.Resampling.LANCZOS)
    atlas.paste(crop,(round(x),round(y)))
    return atlas


def composite(arena, photo, row, roi, Image, ImageDraw):
    quad=hold.screen_quad(row)
    mapping,progress=hold.entry_mapping(row,photo.size,roi)
    if row['frame']==168:
        if not hold.encloses_viewport(quad) or progress!=1:
            raise ValueError('exact landing would spill outside real screen')
        return photo.copy()
    w,h=arena.size
    physical=Image.new('L',arena.size,0)
    ImageDraw.Draw(physical).polygon([(x*w,y*h) for x,y in quad],fill=255)
    # Expanding the SAME source crop keeps a single robot image throughout entry.
    sw,sh=photo.size
    full=(0,0,sw,sh)
    crop=tuple((1-progress)*a+progress*b for a,b in zip(roi,full))
    crop_mask=Image.new('L',photo.size,0)
    ImageDraw.Draw(crop_mask).rectangle(crop,fill=255)
    mapped_mask=warp(crop_mask,mapping,arena.size,Image)
    from PIL import ImageChops
    mask=ImageChops.multiply(physical,mapped_mask)
    background=Image.new('RGB',arena.size,padding_color(photo))
    result=Image.composite(background,arena,physical)
    return Image.composite(warp(photo,mapping,arena.size,Image),result,mask)


def main(argv=None):
    args=parse_args(argv)
    approval_sha256=final_approval(args.inputs,args.approval) if args.final else None
    data=hold.load_inputs(args.inputs)
    roots={}; receipts={}
    for camera,variant in data['variants'].items():
        if args.final:
            hold.validate_source(variant['native_source'],variant)
        roots[camera],receipts[camera]=verify_loop(getattr(args,camera+'_loop'),camera,variant,args.inputs,approval_sha256)
        for key in ('accepted_frame84','lab_frame228'):
            if hold.sha256(variant[key])!=variant[key+'_sha256']:
                raise ValueError(f'{camera} approved image changed: {key}')
        size=hold.png_size(variant['lab_frame228'])
        if args.final and size!=FINAL_SIZE[camera]:
            raise ValueError('final source photo dimensions differ from approved camera')
        if hold.png_size(variant['accepted_frame84'])!=size:
            raise ValueError('photo/camera source dimensions differ')
        for row in variant['native_projection_table']:
            mapping,_=hold.entry_mapping(row,size,variant['lab_roi'])
            hold.validate_mapping(mapping,hold.UNIT)
        for frame in range(85,169):
            if hold.png_size(Path(variant['arena_frames_root'])/f'frame-{frame:04d}.png')!=size:
                raise ValueError('old arena travel frame dimensions differ')
    protected=hold.protected_inputs(data,args.inputs)+list(roots.values())
    if args.final:
        protected.append(args.approval)
    out=hold.fresh_output(args.out,protected)
    # Imported lazily; never install Pillow or execute native code here.
    from PIL import Image, ImageDraw, ImageChops
    out.mkdir(parents=True,exist_ok=False)
    manifest={'kind':'gameon-hold-derived-final' if args.final else 'gameon-hold-derived-preview','native_frames_total':96,
        'native_inputs_sha256':hold.sha256(args.inputs),'new_native_frames':0,
        'encoded':False,'variants':{},'encoding':{}}
    if args.final:
        manifest['owner_approval_sha256']=approval_sha256
        manifest['encoding_limits_bytes']={'loop':600000,'travel':1200000,'peek':120000}
    for camera,variant in data['variants'].items():
        dest=out/camera; dest.mkdir(); (dest/'travel').mkdir()
        photo=Image.open(variant['lab_frame228']).convert('RGB')
        peek_name='gameon-peek.png' if args.final else 'lab-peek.png'
        atlas_image(photo,variant['lab_roi'],Image).save(dest/peek_name)
        shutil.copyfile(roots[camera]/'frame-0084.png',dest/'poster.png')
        shutil.copyfile(variant['lab_frame228'],dest/'lab-228.png')
        derived=[]
        for row in variant['native_projection_table'][1:]:
            frame=row['frame']; source=Path(variant['arena_frames_root'])/f'frame-{frame:04d}.png'
            arena=Image.open(source).convert('RGB')
            result=composite(arena,photo,row,variant['lab_roi'],Image,ImageDraw)
            file=dest/'travel'/f'frame-{frame:04d}.png'
            if frame==168:
                shutil.copyfile(variant['lab_frame228'],file)
            else:
                # Check physical clipping against the ORIGINAL source pixels.
                outside=Image.new('L',arena.size,255)
                ImageDraw.Draw(outside).polygon([(x*arena.width,y*arena.height) for x,y in hold.screen_quad(row)],fill=0)
                difference=ImageChops.difference(arena,result)
                if ImageChops.multiply(difference,Image.merge('RGB',(outside,)*3)).getbbox():
                    raise ValueError('composite changed pixels outside the physical screen')
                result.save(file)
            derived.append({'frame':frame,'sha256':hold.sha256(file),'source_sha256':hold.sha256(source)})
        paths={key:f'./assets/{camera}/{name}' for key,name in (
            ('poster','poster.png'),('peek','lab-peek.png'),('landing','lab-228.png'),('loop','loop.mp4'),('travel','travel.mp4'))}
        if args.final:
            paths.update(poster=f'./media/{camera}/stop-1.webp',peek=f'./media/{camera}/gameon-peek.webp',
                         loop=f'./media/{camera}/gameon-hold.mp4',travel=f'./media/{camera}/segB.mp4',
                         landing=f'./media/{camera}/stop-2.webp')
        manifest['variants'][camera]={**paths,'size':list((FINAL_SIZE if args.final else hold.SIZE)[camera]),
            'photo_size':list(photo.size),'atlas_size':list(hold.ATLAS),'roi':variant['lab_roi'],
            'hold_homography':hold.homography(hold.UNIT,hold.screen_quad(variant['native_projection_table'][0])),
            'native_manifest_sha256':hold.sha256(roots[camera]/'native-manifest.json'),
            'native_rendered_frames':48,'travel_frames':84,'fps':24,'travel_seconds':3.5,
            'landing_sha256':hold.sha256(dest/'lab-228.png'),'derived':derived}
        manifest['encoding'][camera]=[
            ['ffmpeg','-n','-framerate','24','-start_number','84','-i',str(roots[camera]/'frame-%04d.png'),'-frames:v','48','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest/'loop.mp4')],
            ['ffmpeg','-n','-framerate','24','-start_number','85','-i',str(dest/'travel'/'frame-%04d.png'),'-frames:v','84','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest/'travel.mp4')]]
        if args.final:
            manifest['encoding'][camera]=[]
            for frames,start,count,name in ((roots[camera],84,48,'gameon-hold.mp4'),(dest/'travel',85,84,'segB.mp4')):
                last=str(count-1)
                manifest['encoding'][camera].append([
                    'ffmpeg','-n','-hide_banner','-loglevel','error','-framerate','24','-start_number',str(start),
                    '-i',str(frames/'frame-%04d.png'),'-frames:v',str(count),'-an','-c:v','libx264','-preset','slow',
                    '-crf','25','-maxrate','2200k','-bufsize','2200k','-pix_fmt','yuv420p','-g',last,'-keyint_min',last,
                    '-sc_threshold','0','-force_key_frames',f'expr:eq(n,0)+eq(n,{last})','-movflags','+faststart',str(dest/name)])
            manifest['encoding'][camera].append(['cwebp','-quiet','-q','80',str(dest/peek_name),'-o',str(dest/'gameon-peek.webp')])
    receipt=out/'manifest.json'
    receipt.write_text(json.dumps(manifest,indent=2))
    print(json.dumps({'derived_manifest':str(receipt),'encoded':False,'new_native_frames':0}))


if __name__=='__main__':
    main()
