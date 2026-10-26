"""Build restrained local illustration animations; never regenerate character RGB.

No camera pan/zoom, no model-generated video. A static source is sampled through
small, continuous local cloth/hair/breathing displacement fields. Faces, hands
and visible structural joints are hard-protected from deformation and FX.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
for candidate in [HERE/'.build-deps', HERE.parents[1]/'.build-deps/python', *([Path(os.environ['CODEXUI_PYTHON_DEPS'])] if os.environ.get('CODEXUI_PYTHON_DEPS') else [])]:
    if candidate.is_dir():sys.path.insert(0,str(candidate))
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SPEC_ROOT = Path(os.environ.get('CHARACTER_DESIGN_ROOT',r'G:\sandrone\design-review\2026-10-25\full-scene-v7'))
FFMPEG = Path(os.environ.get('FFMPEG_EXE',r'C:\Users\admin\miniconda3\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'))
OUT = HERE / 'output'
EVIDENCE = HERE.parents[1] / 'evidence' / 'motion'
WIDTH, HEIGHT, FPS, SECONDS = 1920, 1080, 30, 9
FRAMES = FPS * SECONDS
MOTION_REVISION = 'scene-motion-v2'

# Ellipse centres/radii are in normalized source-image space. No segmentation
# guesses or generated body replacements are involved.
CONFIG = {
 'columbina': {
  'guards': [('face','face',.748,.350,.090,.116),('left-hand','hand',.490,.865,.066,.085),('right-hand','hand',.684,.868,.076,.078),('neck','joint',.731,.456,.055,.054)],
  'regions': [('breathing','breathing',.726,.640,.120,.185,1.55,2),('left-hair','hair-sway',.480,.689,.155,.190,4.8,1),('right-hair','hair-sway',.896,.690,.107,.175,3.9,1),('sleeve','cloth-sway',.861,.676,.115,.165,3.2,2)],
  'effects':['falling-moonlit-feathers','horizontal-water-glints','sparse-silver-motes'], 'color':(166,201,250), 'stars':(.04,.03,.62,.78),
 },
 'ayaka': {
  'guards':[('face','face',.731,.310,.077,.110),('raised-hand','hand',.822,.060,.055,.078),('lower-hand','hand',.534,.605,.060,.055),('neck','joint',.730,.400,.050,.048),('lower-elbow','joint',.595,.535,.050,.055)],
  'regions':[('breathing','breathing',.737,.535,.102,.145,1.5,2),('ponytail-tip','hair-sway',.930,.325,.115,.180,4.8,1),('left-sleeve','cloth-sway',.597,.477,.090,.140,3.0,1),('skirt-edge','cloth-sway',.835,.832,.130,.125,4.2,2)],
  'effects':['falling-sakura-petals','fan-rim-frost','sparse-frost-motes'], 'color':(187,218,251), 'stars':(.08,.05,.68,.84),
 },
 'hutao': {
  'guards':[('face','face',.703,.325,.104,.142),('raised-hand','hand',.717,.454,.055,.090),('neck','joint',.737,.495,.048,.048)],
  'regions':[('breathing','breathing',.749,.643,.110,.160,1.6,2),('left-hair','hair-sway',.434,.665,.170,.175,4.6,1),('right-hair','hair-sway',.918,.613,.110,.215,4.8,1),('coat-edge','cloth-sway',.684,.887,.155,.100,3.0,2)],
  'effects':['single-open-path-fire-butterfly','localized-lantern-warmth','rising-lantern-embers'], 'color':(244,168,76), 'stars':(.03,.05,.58,.80),
 },
 'nahida': {
  'guards':[('face','face',.748,.337,.073,.104),('high-hand','hand',.818,.296,.050,.060),('low-hand','hand',.637,.558,.045,.055),('neck','joint',.741,.425,.043,.045),('left-ankle','joint',.746,.836,.040,.060),('right-ankle','joint',.811,.792,.042,.065)],
  'regions':[('breathing','breathing',.751,.500,.085,.105,1.35,2),('ponytail','hair-sway',.824,.374,.077,.110,3.8,1),('leaf-cape','cloth-sway',.854,.574,.120,.160,4.8,1),('dress-edge','cloth-sway',.738,.623,.090,.078,3.2,2)],
  'effects':['anchored-leaf-sway','growing-leaf-veins','forest-fireflies'], 'color':(183,224,141), 'stars':(.08,.03,.59,.85),
 },
 'furina': {
  'guards':[('face','face',.734,.292,.093,.125),('chest-hand','hand',.612,.431,.065,.067),('outer-hand','hand',.866,.555,.080,.105),('neck','joint',.729,.415,.053,.049)],
  'regions':[('breathing','breathing',.727,.576,.115,.145,1.45,2),('hair-tip','hair-sway',.886,.393,.085,.130,3.8,1),('coat-tail','cloth-sway',.862,.820,.145,.160,4.7,1),('left-cuff','cloth-sway',.563,.575,.077,.100,2.6,2)],
  'effects':['short-open-water-filaments','falling-water-droplets','rising-bubbles','ground-water-reflections'], 'color':(153,202,255), 'stars':(.04,.04,.59,.83),
 },
 'citlali': {
  'guards':[('face','face',.720,.274,.068,.108),('plush-hands','hand',.653,.455,.055,.062),('neck','joint',.712,.367,.043,.046),('front-knee','joint',.588,.653,.040,.052),('front-ankle','joint',.615,.907,.035,.048),('rear-foot','joint',.661,.836,.042,.052)],
  'regions':[('breathing','breathing',.699,.433,.090,.120,1.25,2),('hair-tail','hair-sway',.811,.494,.107,.180,4.7,1),('left-hair','hair-sway',.594,.337,.090,.090,3.6,1),('woven-tassels','cloth-sway',.871,.835,.100,.105,3.6,2),('hanging-crystal','pendant-sway',.560,.105,.035,.075,2.1,1)],
  'effects':['sparse-amethyst-starlight','pendant-crystal-glints'], 'color':(200,170,246), 'stars':(.09,.025,.57,.46),
 },
 'mitya': {
  'guards':[('face','face',.700,.221,.069,.099),('near-hand','hand',.618,.494,.043,.048),('far-hand','hand',.600,.481,.035,.044),('neck','joint',.698,.306,.043,.043),('left-knee','joint',.553,.556,.055,.055),('right-knee','joint',.641,.573,.052,.055),('left-ankle','joint',.524,.773,.042,.060),('right-ankle','joint',.600,.826,.042,.059)],
  'regions':[('quiet-breathing','breathing',.703,.414,.082,.110,1.1,2),('resting-scarf','cloth-sway',.857,.571,.097,.065,2.5,1),('hanging-coat','cloth-sway',.773,.741,.068,.138,2.2,1),('hair-tips','hair-sway',.748,.249,.034,.065,1.8,1)],
  'effects':['sparse-snow-beyond-window','soft-lamplight'], 'color':(150,164,193), 'stars':(.15,.08,.46,.58),
 },
 'istaroth': {
  'guards':[('face','face',.792,.378,.091,.130),('near-hand','hand',.842,.585,.074,.074),('low-hand','hand',.949,.900,.055,.070),('neck','joint',.790,.508,.055,.046)],
  'regions':[('breathing','breathing',.788,.690,.110,.148,1.15,2),('long-hair','hair-sway',.559,.745,.190,.210,4.6,1),('robe-tail','cloth-sway',.903,.830,.075,.120,3.2,1),('left-hair','hair-sway',.635,.507,.092,.150,3.3,2)],
  'effects':['time-ring-glints','golden-sand-motes'], 'color':(230,194,126), 'stars':(.05,.04,.57,.85),
 }
}

def sha(file: Path) -> str:
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def command(args):
    result = subprocess.run([str(FFMPEG), '-hide_banner', '-loglevel', 'error', '-y', *map(str,args)], capture_output=True, text=True, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])

def source_for(identifier):
    spec=json.loads((SPEC_ROOT/'design-spec.json').read_text(encoding='utf-8'))
    c=next(c for c in spec['characters'] if c['id']==identifier)
    if identifier=='mitya':return HERE.parent/'art-revisions/v14/mitya-opening-quiet.png', c
    return SPEC_ROOT/c['opening'], c

def load_source(file):
    image=Image.open(file).convert('RGB')
    # One static cover-fit; there is deliberately no time-varying camera transform.
    s=max(WIDTH/image.width, HEIGHT/image.height)
    image=image.resize((round(image.width*s),round(image.height*s)),Image.Resampling.LANCZOS)
    left=(image.width-WIDTH)//2; top=(image.height-HEIGHT)//2
    return np.array(image.crop((left,top,left+WIDTH,top+HEIGHT)))

def gaussian(x,y,cx,cy,rx,ry):
    d=((x-cx)/rx)**2+((y-cy)/ry)**2
    return (np.exp(-2*d)*np.clip((2.25-d)/.30,0,1)).astype(np.float32)

class Animator:
    def __init__(self, identifier, source):
        self.identifier=identifier;self.config=CONFIG[identifier];self.base=source
        cv2.setNumThreads(2)
        yy,xx=np.mgrid[0:HEIGHT,0:WIDTH]
        self.xx=xx.astype(np.float32);self.yy=yy.astype(np.float32)
        self.x=self.xx/WIDTH;self.y=self.yy/HEIGHT
        self.protect=np.zeros((HEIGHT,WIDTH),np.float32)
        self.face=np.zeros((HEIGHT,WIDTH),bool)
        for name,kind,cx,cy,rx,ry in self.config['guards']:
            d=np.sqrt(((self.x-cx)/rx)**2+((self.y-cy)/ry)**2)
            mask=np.clip((1.35-d)/.35,0,1)
            mask[d<=1]=1
            self.protect=np.maximum(self.protect,mask)
            if kind=='face':self.face |= d<=.88
        self.free=(1-self.protect).astype(np.float32)
        self.free[self.protect>=.99999]=0
        self.regions=[]
        for name,kind,cx,cy,rx,ry,amp,cycles in self.config['regions']:
            g=gaussian(self.x,self.y,cx,cy,rx,ry)*self.free
            self.regions.append((name,kind,cx,cy,rx,ry,amp,cycles,g))
        seed=sum(ord(c) for c in identifier)*347
        self.random=np.random.default_rng(seed)
        self.sparkles=self.random.random((24,5))
        self.person_free=np.clip(1-self.protect,0,1)[:,:,None]
        self.lantern_light=gaussian(self.x,self.y,.945,.855,.125,.145)[:,:,None]
        self.max_observed_displacement=0.
    def warp(self,p):
        angle=2*math.pi*p
        dx=np.zeros((HEIGHT,WIDTH),np.float32);dy=np.zeros_like(dx)
        for i,(name,kind,cx,cy,rx,ry,amp,cycles,g) in enumerate(self.regions):
            wave=math.sin(cycles*angle)
            if kind=='breathing':
                dy-=amp*wave*g
                dx+=((self.xx-cx*WIDTH)*.0045*wave*g)
            else:
                wave=math.sin(cycles*angle)+.22*math.sin(2*cycles*angle)
                dx+=amp*wave*g
                dy+=amp*.28*math.sin(cycles*angle)*g
        maximum=float(np.max(np.sqrt(dx*dx+dy*dy)))
        self.max_observed_displacement=max(self.max_observed_displacement,maximum)
        frame=cv2.remap(self.base,self.xx+dx,self.yy+dy,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101)
        return frame,dx,dy
    def line(self,effect,points,color,width=1):
        cv2.polylines(effect,[np.array(points,np.int32)],False,color,width,cv2.LINE_AA)
    def star(self,effect,x,y,r,color):
        x,y=int(x),int(y)
        cv2.line(effect,(x-int(r),y),(x+int(r),y),color,1,cv2.LINE_AA)
        cv2.line(effect,(x,y-int(r)),(x,y+int(r)),color,1,cv2.LINE_AA)
        cv2.circle(effect,(x,y),1,color,-1,cv2.LINE_AA)
    def effects(self,p):
        angle=2*math.pi*p
        effect=np.zeros_like(self.base)
        cfg=self.config;color=np.array(cfg['color'],np.float32)
        if self.identifier=='mitya':
            # Quiet study: no magic rings, palm glow, ribbons or starbursts.
            for i,(a,b,c,d,k) in enumerate(self.sparkles[:10]):
                x=(.15+.31*a+.002*math.sin(angle+6*c))*WIDTH
                y=(.08+.48*((b+p*.12)%1))*HEIGHT
                cv2.circle(effect,(int(x),int(y)),1,(17,20,25),-1,cv2.LINE_AA)
            yy,xx=np.mgrid[:HEIGHT,:WIDTH].astype(np.float32)
            lamp=np.exp(-(((xx/WIDTH-.975)/.045)**2+((yy/HEIGHT-.285)/.12)**2)*2)
            warmth=2.5+1.5*math.sin(angle*2)
            effect=np.clip(effect.astype(np.float32)+lamp[:,:,None]*np.array([warmth,warmth*.62,warmth*.25]),0,255)
            return effect*self.person_free
        x0,y0,x1,y1=cfg['stars']
        count={'columbina':7,'ayaka':7,'hutao':8,'nahida':10,'furina':5,'citlali':12}.get(self.identifier,24)
        for i,(a,b,c,d,k) in enumerate(self.sparkles[:count]):
            # Fixed starlight or a short open drift; no shared circular orbit.
            x=(x0+(x1-x0)*a)*WIDTH
            y=(y0+(y1-y0)*b)*HEIGHT
            if self.identifier=='hutao':y-=p*(10+12*c)
            elif self.identifier=='nahida':x+=4*math.sin(math.pi*p+4*c);y-=p*5
            strength=.16+.68*(.5+.5*math.sin(angle*(1+(i%2))+6*k))**2
            col=tuple(map(int,color*strength))
            if i%4==0:self.star(effect,x,y,2+2*c,col)
            else:cv2.circle(effect,(int(x),int(y)),1+(i%5==0),col,-1,cv2.LINE_AA)
        identifier=self.identifier
        if identifier=='ayaka':
            for i in range(9):
                # Petals fall through an open vertical path, rather than orbiting.
                q=angle+i*.71;fall=(i*.137+p*.23)%1
                x=(.58+i*.043+.017*math.sin(math.pi*p*1.5+i))*WIDTH;y=(.04+.91*fall)*HEIGHT
                rot=.32*math.sin(q*.6)+i*.4;u=np.array([math.cos(rot),math.sin(rot)]);v=np.array([-u[1],u[0]])
                points=[np.array([x,y])+u*8,np.array([x,y])+v*3-u*2,np.array([x,y])-u*7,np.array([x,y])-v*3-u*2]
                cv2.fillConvexPoly(effect,np.array(points,np.int32),(190,126,164),cv2.LINE_AA)
            # Short frost accents follow the raised fan rim, not a body ring.
            for j,(cx,cy) in enumerate([(.798,.031),(.820,.023),(.843,.029)]):
                strength=.18+.25*(.5+.5*math.sin(angle+j*1.4))
                self.star(effect,cx*WIDTH,cy*HEIGHT,2,tuple(map(int,color*strength)))
        elif identifier=='hutao':
            # One butterfly rises irregularly from the actual lantern side.
            # Its path has different endpoints and never circles the person.
            x=(.866+.038*math.sin(math.pi*p)+.022*p)*WIDTH
            y=(.81-.40*p+.013*math.sin(3*math.pi*p))*HEIGHT
            flap=.23+.77*abs(math.sin(5.7*angle));rw=max(2,int(12*flap))
            for sign in [-1,1]:
                cv2.ellipse(effect,(int(x+sign*rw*.7),int(y-4)),(rw,7),sign*24,0,360,(216,122,32),-1,cv2.LINE_AA)
                cv2.ellipse(effect,(int(x+sign*rw*.5),int(y+5)),(max(2,int(rw*.75)),5),-sign*20,0,360,(166,75,25),-1,cv2.LINE_AA)
            cv2.line(effect,(int(x),int(y-7)),(int(x),int(y+9)),(239,183,87),1,cv2.LINE_AA)
            warmth=2.8+1.0*math.sin(2*angle)+.35*math.sin(5*angle+.4)
            effect=np.clip(effect.astype(np.float32)+self.lantern_light*np.array([warmth,warmth*.55,warmth*.15]),0,255)
        elif identifier=='nahida':
            for i in range(7):
                q=angle+i*.8;x=(.61+i*.047)*WIDTH;y=(.20+(i%4)*.18)*HEIGHT
                # A leaf sways about its own stem; it does not travel on a ring.
                turn=.38*math.sin(q)+i*.28
                u=np.array([math.cos(turn),math.sin(turn)]);v=np.array([-u[1],u[0]]);center=np.array([x,y])
                points=[center-u*9,center+v*4,center+u*10,center-v*4]
                cv2.fillConvexPoly(effect,np.array(points,np.int32),(119,178,73),cv2.LINE_AA)
                self.line(effect,[center-u*7,center+u*8],(190,211,119),1)
            for j,(cx,cy) in enumerate([(.638,.771),(.895,.688),(.595,.848)]):
                growth=.28+.72*(.5-.5*math.cos(angle+j*.7))
                points=[((cx+t*.019)*WIDTH,(cy-t*.028+.004*math.sin(t*math.pi))*HEIGHT) for t in np.linspace(0,growth,18)]
                self.line(effect,points,(38,73,23),1)
        elif identifier=='furina':
            # Short open filaments, vertical droplets and rising bubbles replace
            # the previous rotating four-point elliptical orbit.
            for j,(cx,cy) in enumerate([(.478,.565),(.885,.665),(.535,.854)]):
                points=[((cx+t*.065)*WIDTH,(cy+.010*math.sin(t*math.pi*1.2-angle*.5+j))*HEIGHT) for t in np.linspace(0,1,32)]
                self.line(effect,points,tuple(map(int,color*.21)),1)
            for i in range(7):
                fall=(p*.32+i*.137)%1
                x=(.50+i*.063+.003*math.sin(math.pi*p+i))*WIDTH
                y=(.42+.45*fall)*HEIGHT
                cv2.ellipse(effect,(int(x),int(y)),(1,3),(i%3-1)*7,0,360,(79,137,199),-1,cv2.LINE_AA)
            for i in range(5):
                rise=(p*.16+i*.177)%1
                x=(.48+i*.083+.004*math.sin(math.pi*p+i))*WIDTH;y=(.86-.39*rise)*HEIGHT
                cv2.circle(effect,(int(x),int(y)),2+(i%3),(58,111,164),1,cv2.LINE_AA)
            for j in range(3):
                points=[(x*WIDTH,(.88+j*.030+.002*math.sin(x*22-angle))*HEIGHT) for x in np.linspace(.08,.48,55)]
                self.line(effect,points,(13,25,44),1)
        elif identifier=='istaroth':
            # The time device is the one intentionally retained circular motion.
            cx,cy,rx,ry,tilt=.825,.095,.202,.094,-.16
            for j in range(4):
                theta=angle+j*math.pi/2
                points=[]
                for a in np.linspace(theta-.09,theta+.09,22):
                    x=rx*math.cos(a);y=ry*math.sin(a)
                    points.append(((cx+x*math.cos(tilt)-y*math.sin(tilt))*WIDTH,(cy+x*math.sin(tilt)+y*math.cos(tilt))*HEIGHT))
                self.line(effect,points,tuple(map(int,color*.55)),2)
                self.star(effect,*points[-1],3,tuple(map(int,color*.85)))
        elif identifier=='citlali':
            for i,(cx,cy) in enumerate([(.559,.105),(.628,.169),(.532,.289)]):
                strength=.25+.50*(.5+.5*math.sin(2*angle+i*1.7))
                sway=2.1*math.sin(angle) if i==0 else 0
                self.star(effect,cx*WIDTH-sway,cy*HEIGHT,3+i,tuple(map(int,color*strength)))
        elif identifier=='columbina':
            for i in range(5):
                q=math.pi*p+i;x=(.25+i*.11+.010*math.sin(q))*WIDTH;y=(.56+(i%3)*.08+.13*p)*HEIGHT
                cv2.ellipse(effect,(int(x),int(y)),(2,7),18*math.sin(q),0,360,(101,130,168),-1,cv2.LINE_AA)
            for j in range(4):
                points=[(x*WIDTH,(.86+j*.027+.003*math.sin(x*25-angle))*HEIGHT) for x in np.linspace(.05,.59,80)]
                self.line(effect,points,(19,35,59),1)
        glow=cv2.GaussianBlur(effect,(0,0),4.8)
        combined=(effect.astype(np.float32)*.72+glow.astype(np.float32)*1.25)*self.person_free
        return combined
    def frame(self,p,with_fx=True):
        warped,dx,dy=self.warp(p)
        if with_fx:
            frame=np.clip(warped.astype(np.float32)+self.effects(p),0,255).astype(np.uint8)
        else:frame=warped
        return frame,dx,dy

def region_manifest(cfg):
    motions=[]
    for name,kind,cx,cy,rx,ry,amp,cycles in cfg['regions']:
        motions.append({'name':name,'kind':kind,'centerNorm':[cx,cy],'radiusNorm':[rx,ry],'requestedDisplacementPx':amp,'cyclesPerClip':cycles})
    guards=[]
    for name,kind,cx,cy,rx,ry in cfg['guards']:
        guards.append({'name':name,'kind':kind,'centerNorm':[cx,cy],'radiusNorm':[rx,ry]})
    return motions,guards

def contact_sheet(identifier,frames,file):
    font_path=Path(r'C:\Windows\Fonts\msyh.ttc')
    font=ImageFont.truetype(str(font_path),18) if font_path.exists() else ImageFont.load_default()
    sheet=Image.new('RGB',(960,2*292),(12,19,31));draw=ImageDraw.Draw(sheet)
    times=['0.00 s','2.25 s','4.50 s','6.75 s']
    for i,frame in enumerate(frames):
        x=(i%2)*480;y=(i//2)*292
        image=Image.fromarray(frame).resize((480,270),Image.Resampling.LANCZOS)
        sheet.paste(image,(x,y));draw.text((x+10,y+270),identifier+'  '+times[i],font=font,fill=(206,220,243))
    sheet.save(file)

def roi_rectangle(cx,cy,rx,ry,pad=1.15):
    x=max(0,int((cx-rx*pad)*WIDTH));y=max(0,int((cy-ry*pad)*HEIGHT));x2=min(WIDTH,int((cx+rx*pad)*WIDTH));y2=min(HEIGHT,int((cy+ry*pad)*HEIGHT))
    return x,y,x2,y2

def render_one(identifier,preview=False,reuse=False):
    began=time.monotonic();source,c=source_for(identifier);folder=OUT/identifier;folder.mkdir(parents=True,exist_ok=True);EVIDENCE.mkdir(parents=True,exist_ok=True)
    if identifier=='sandrone':return retain_sandrone(folder)
    if reuse and not preview and (folder/'derived.json').exists() and (folder/'metrics.json').exists():
        old=json.loads((folder/'derived.json').read_text(encoding='utf-8'))
        if old.get('motionRevision')==MOTION_REVISION and old.get('builderSha256')==sha(HERE/'build_motion.py') and old['sourceSha256']==sha(source) and old['sha256']==sha(folder/old['file']):
            return json.loads((folder/'metrics.json').read_text(encoding='utf-8'))
    base=load_source(source);a=Animator(identifier,base)
    sample_phases=[0,.25,.50,.75]
    sampled=[a.frame(p)[0] for p in sample_phases]
    contact_sheet(identifier,sampled,EVIDENCE/(identifier+'-contact.png'))
    raw_face_mad=0.;raw_protected_map=0.;local_warp_mad=0.;local_changed=0;raw_fx_face_mad=0.;raw_fx_protected_mad=0.
    first_warp=a.frame(0,False)[0]
    # Use nonzero phases; .25 is a zero of breathing's two-cycle wave.
    for p in [.125,.333,.625,.875]:
        frame,dx,dy=a.frame(p,False)
        raw_face_mad=max(raw_face_mad,float(np.mean(np.abs(frame[a.face].astype(np.int16)-base[a.face].astype(np.int16)))))
        core=a.protect>=.99999
        raw_protected_map=max(raw_protected_map,float(np.max(np.abs(dx[core]))),float(np.max(np.abs(dy[core]))))
        diff=np.abs(frame.astype(np.int16)-first_warp.astype(np.int16))
        active=np.sqrt(dx*dx+dy*dy)>.25
        if active.any():local_warp_mad=max(local_warp_mad,float(diff[active].mean()));local_changed=max(local_changed,int(np.sum(np.max(diff,axis=2)>2)))
        with_fx=a.frame(p,True)[0]
        raw_fx_face_mad=max(raw_fx_face_mad,float(np.mean(np.abs(with_fx[a.face].astype(np.int16)-base[a.face].astype(np.int16)))))
        raw_fx_protected_mad=max(raw_fx_protected_mad,float(np.mean(np.abs(with_fx[core].astype(np.int16)-base[core].astype(np.int16)))))
    if raw_face_mad!=0 or raw_protected_map>1e-5 or raw_fx_face_mad!=0 or raw_fx_protected_mad!=0:raise RuntimeError(identifier+' protected face/joint pixels changed')
    # A split-view crop proves actual no-FX source-art displacement, distinct
    # from star/lighting changes. Face is intentionally not animated.
    reg=max(a.config['regions'],key=lambda x:x[6]);x,y,x2,y2=roi_rectangle(*reg[2:6])
    neutral=a.frame(0,False)[0][y:y2,x:x2];moving=a.frame(.19,False)[0][y:y2,x:x2]
    roi=Image.new('RGB',(800,340),(10,16,27));d=ImageDraw.Draw(roi)
    for j,img in enumerate([neutral,moving]):
        im=Image.fromarray(img);im.thumbnail((395,310),Image.Resampling.LANCZOS);roi.paste(im,(j*400,25));d.text((j*400+8,8),'No FX - '+('frame 0' if j==0 else 'local motion frame'),fill=(220,231,246))
    roi.save(EVIDENCE/(identifier+'-local-motion-no-fx.png'))
    metrics={'id':identifier,'rawFaceMAD':raw_face_mad,'rawProtectedMapMaxPx':raw_protected_map,'rawFaceWithFxMAD':raw_fx_face_mad,'rawProtectedWithFxMAD':raw_fx_protected_mad,'localWarpPixelMAD':local_warp_mad,'localWarpChangedPixels':local_changed,'maximumMeshDisplacementPx':a.max_observed_displacement,'globalCameraMotion':False,'frameCount':FRAMES,'width':WIDTH,'height':HEIGHT,'fps':FPS,'seconds':SECONDS,'motionRevision':MOTION_REVISION,'closedOrbitEffect':identifier=='istaroth','method':'Parametric local mesh animation of the approved illustration, face/hand/joint protected, plus character-specific environment FX. Not generated video.'}
    if preview:
        (folder/'preview-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8');return metrics
    video=folder/'sandrone-loop-1080p.mp4'
    args=[str(FFMPEG),'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{WIDTH}x{HEIGHT}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-maxrate','9000k','-bufsize','18000k','-g','60','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart',str(video)]
    process=subprocess.Popen(args,stdin=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        for frame_no in range(FRAMES):
            frame,_,_=a.frame(frame_no/FRAMES)
            process.stdin.write(frame.tobytes())
        process.stdin.close();stderr=process.stderr.read().decode('utf-8','replace');code=process.wait()
        if code:raise RuntimeError(stderr[-3000:])
    except Exception:
        process.kill();process.wait();raise
    if video.stat().st_size>12*1024*1024:raise RuntimeError(identifier+' exceeds 12 MiB')
    poster=folder/'sandrone-first-frame.jpg';command(['-i',video,'-frames:v','1','-q:v','2',poster])
    decoded=[];capture=cv2.VideoCapture(str(video))
    for t in [0,2.25,4.50,6.75,8.9666667]:
        capture.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=capture.read()
        if not ok:raise RuntimeError(identifier+' MP4 frame decode failed at '+str(t))
        decoded.append(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB))
    capture.release()
    reference=decoded[0].astype(np.int16)
    metrics['decodedFrameMAD']=max(float(np.mean(np.abs(f.astype(np.int16)-reference))) for f in decoded[1:])
    metrics['encodedFaceMAD']=max(float(np.mean(np.abs(f[a.face].astype(np.int16)-decoded[0][a.face].astype(np.int16)))) for f in decoded[1:])
    metrics['loopEndpointMAD']=float(np.mean(np.abs(decoded[-1].astype(np.int16)-reference)))
    metrics['bytes']=video.stat().st_size;metrics['renderSeconds']=round(time.monotonic()-began,2)
    motions,guards=region_manifest(a.config)
    ledger={'file':video.name,'source':str(source),'sourceSha256':sha(source),'sha256':sha(video),'bytes':video.stat().st_size,'seconds':SECONDS,'width':WIDTH,'height':HEIGHT,'fps':FPS,'frames':FRAMES,'posterFile':poster.name,'posterSha256':sha(poster),'animationKind':'illustrated-local-motion','motionRevision':MOTION_REVISION,'builderSha256':sha(HERE/'build_motion.py'),'closedOrbitEffect':identifier=='istaroth','globalCameraMotion':False,'faceProtected':True,'handJointProtected':True,'motionRegions':motions,'protectionRegions':guards,'environmentEffects':a.config['effects'],'metricsFile':'metrics.json','fullScene':True,'note':'Parameterized illustration animation: original painted RGB and anatomy retained, local breathing/cloth/hair movement, distinct scene effects and protected faces/hands/joints. Static curved bands already present in the illustration are retained; only Istaroth uses a revolving environment effect. Not model-generated video.'}
    (folder/'derived.json').write_text(json.dumps(ledger,indent=2),encoding='utf-8')
    (folder/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
    contact_sheet(identifier,decoded[:4],EVIDENCE/(identifier+'-decoded-contact.png'))
    print(json.dumps({'id':identifier,'bytes':metrics['bytes'],'seconds':metrics['renderSeconds'],'localWarpMAD':local_warp_mad,'faceMAD':metrics['encodedFaceMAD']}),flush=True)
    return metrics

def retain_sandrone(folder):
    source=Path(r'G:\sandrone\SandroneCodex-0.6.1\Windows-Portable\assets\motion')
    for name in ['sandrone-loop-1080p.mp4','sandrone-first-frame.jpg']:
        shutil.copyfile(source/name,folder/name)
    video=folder/'sandrone-loop-1080p.mp4';poster=folder/'sandrone-first-frame.jpg'
    ledger={'file':video.name,'source':str(source/video.name),'sourceSha256':sha(source/video.name),'sha256':sha(video),'bytes':video.stat().st_size,'seconds':9,'width':1920,'height':1080,'fps':30,'posterFile':poster.name,'posterSha256':sha(poster),'animationKind':'original-supplied-motion','globalCameraMotion':None,'faceProtected':None,'motionRegions':[],'fullScene':True,'note':'Original Sandrone supplied animation preserved byte-for-byte.'}
    (folder/'derived.json').write_text(json.dumps(ledger,indent=2),encoding='utf-8')
    return {'id':'sandrone','originalPreserved':True,'bytes':video.stat().st_size}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--only',default='');parser.add_argument('--preview',action='store_true');parser.add_argument('--reuse-existing',action='store_true');parser.add_argument('--workers',type=int,default=2);args=parser.parse_args()
    ids=args.only.split(',') if args.only else [*CONFIG,'sandrone']
    if any(i not in [*CONFIG,'sandrone'] for i in ids):raise SystemExit('Unknown character')
    OUT.mkdir(parents=True,exist_ok=True);EVIDENCE.mkdir(parents=True,exist_ok=True)
    records=[]
    with ProcessPoolExecutor(max_workers=max(1,min(args.workers,2))) as pool:
        tasks={pool.submit(render_one,i,args.preview,args.reuse_existing):i for i in ids}
        for future in as_completed(tasks):records.append(future.result())
    summary={'schemaVersion':1,'date':'2026-10-25','method':'Eight parameterized local illustration animations plus original Sandrone motion','aiVideoGenerated':False,'cameraPanZoomUsed':False,'characters':records,'outputRoot':str(OUT),'evidenceRoot':str(EVIDENCE),'buildDependency':'.build-deps contains temporary OpenCV build dependency; exclude it from redistributable package.'}
    (HERE/('preview-summary.json' if args.preview else 'motion-summary.json')).write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps({'complete':len(records),'preview':args.preview,'output':str(OUT)}),flush=True)

if __name__=='__main__':main()
