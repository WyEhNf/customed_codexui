"""Extract restrained, source-aligned scene/person contours for the opening.

This is a technical edge export. Source RGB is never repainted, deformed or
replaced. Hand-authored polygons only SELECT existing image edges; they are
never drawn as silhouettes. Re-run after a movie poster is regenerated.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
for candidate in [ROOT/'integration/motion/.build-deps', ROOT/'.build-deps/python', *([Path(os.environ['CODEXUI_PYTHON_DEPS'])] if os.environ.get('CODEXUI_PYTHON_DEPS') else [])]:
    if candidate.is_dir():sys.path.insert(0,str(candidate))
import cv2
import numpy as np
from PIL import Image,ImageDraw

W,H=1920,1080
SCALE=2/3
CONFIG={
 'columbina':{
  'kind':'moon-water','color':(184,209,239),'center':(.735,.57),
  'anchors':{'moon':[.815,.11],'water':[.28,.82],'feather':[.50,.25]},
  'person':[(.58,.21),(.62,.13),(.68,.19),(.73,.125),(.80,.18),(.86,.20),(.87,.36),(.91,.43),(.985,.64),(.998,.87),(.87,.94),(.72,.935),(.60,.958),(.44,.952),(.414,.887),(.35,.85),(.365,.75),(.42,.66),(.53,.48),(.55,.31)],
  'details':[(.661,.24,.165,.185),(.437,.80,.104,.14),(.624,.79,.13,.15)],
  'focal':[(.74,.0,.18,.20),(.0,.72,.57,.28),(.87,.25,.13,.50)],
 },
 'hutao':{
  'kind':'lantern-butterfly','color':(246,188,114),'center':(.733,.55),
  'anchors':{'lantern':[.91,.91],'butterfly':[.49,.45]},
  'person':[(.574,.0),(.812,.0),(.843,.16),(.811,.267),(.916,.32),(.999,.321),(.999,.787),(.924,.85),(.876,1),(.59,1),(.586,.89),(.414,.844),(.294,.80),(.287,.687),(.392,.598),(.541,.51),(.591,.36),(.605,.26),(.58,.15)],
  'details':[(.625,.22,.17,.20),(.66,.368,.095,.155)],
  'focal':[(.82,.69,.18,.31),(.40,.34,.14,.20),(.04,.08,.35,.78)],
 },
 'mitya':{
  'kind':'quiet-lamplight','color':(190,195,221),'center':(.699,.52),
  'anchors':{'lamp':[.96,.38],'window':[.28,.30],'book':[.64,.51]},
  'person':[(.675,.095),(.733,.095),(.773,.19),(.753,.291),(.793,.331),(.819,.44),(.879,.507),(.917,.535),(.902,.63),(.847,.68),(.829,.88),(.771,.902),(.73,.836),(.672,.787),(.655,.899),(.53,.915),(.433,.883),(.452,.79),(.504,.725),(.51,.586),(.548,.526),(.583,.47),(.583,.429),(.629,.419),(.65,.342),(.661,.3),(.641,.245),(.651,.155)],
  'details':[(.654,.14,.10,.145),(.579,.436,.108,.088)],
  'focal':[(.919,.17,.081,.31),(.10,.08,.45,.58),(.58,.44,.12,.12)],
 },
 'ayaka':{
  'kind':'frost-petals','color':(190,218,245),'center':(.743,.57),
  'anchors':{'fan':[.82,.07],'petal':[.85,.22],'frost':[.86,.48]},
  'person':[(.70,.145),(.768,.13),(.791,.187),(.804,.15),(.812,.047),(.862,.07),(.847,.19),(.844,.235),(.898,.24),(.989,.298),(.995,.484),(.938,.5),(.916,.65),(.989,.93),(.959,1),(.578,1),(.574,.888),(.584,.761),(.517,.728),(.494,.641),(.517,.573),(.57,.527),(.607,.436),(.66,.39),(.66,.254)],
  'details':[(.685,.25,.112,.132),(.79,.046,.052,.117),(.513,.563,.079,.079)],
  'focal':[(.77,.0,.12,.12),(.865,.06,.135,.37),(.02,.39,.48,.47)],
 },
 'nahida':{
  'kind':'leaf-growth','color':(195,230,160),'center':(.757,.56),
  'anchors':{'leaf':[.75,.59],'firefly':[.53,.63]},
  'person':[(.698,.19),(.773,.17),(.821,.239),(.808,.294),(.836,.254),(.86,.297),(.831,.372),(.876,.435),(.923,.52),(.909,.604),(.84,.642),(.844,.777),(.833,.869),(.778,.87),(.745,.923),(.701,.858),(.715,.748),(.679,.696),(.681,.633),(.617,.623),(.59,.557),(.632,.506),(.674,.457),(.689,.385),(.669,.306)],
  'details':[(.704,.265,.104,.115),(.808,.241,.055,.074),(.615,.50,.061,.075),(.71,.798,.073,.097),(.792,.734,.057,.113)],
  'focal':[(.56,.18,.40,.45),(.47,.60,.27,.33),(.55,.0,.45,.23)],
 },
 'furina':{
  'kind':'water-stage','color':(175,213,250),'center':(.732,.58),
  'anchors':{'hand':[.86,.56],'bubble':[.72,.72],'curtain':[.50,.20]},
  'person':[(.755,.0),(.848,.0),(.894,.055),(.882,.181),(.872,.249),(.885,.344),(.871,.429),(.889,.466),(.927,.499),(.92,.58),(.869,.611),(.86,.69),(.968,.844),(.999,.902),(.999,1),(.56,1),(.558,.894),(.594,.751),(.562,.633),(.551,.562),(.569,.48),(.567,.405),(.627,.385),(.665,.37),(.646,.256),(.659,.135),(.731,.067)],
  'details':[(.674,.199,.119,.147),(.566,.374,.115,.084),(.812,.456,.12,.14)],
  'focal':[(.02,.24,.48,.76),(.87,.22,.13,.35),(.43,.0,.15,.40)],
 },
 'citlali':{
  'kind':'crystal-starlight','color':(216,188,244),'center':(.699,.57),
  'anchors':{'crystal':[.61,.20],'tassel':[.83,.90]},
  'person':[(.686,.141),(.765,.14),(.787,.236),(.81,.304),(.865,.427),(.844,.555),(.795,.597),(.777,.725),(.744,.816),(.704,.936),(.654,.999),(.617,.995),(.591,.965),(.589,.915),(.601,.814),(.541,.72),(.516,.652),(.539,.565),(.579,.514),(.576,.398),(.609,.327),(.659,.307),(.661,.228)],
  'details':[(.681,.212,.087,.128),(.624,.403,.08,.101),(.574,.624,.078,.084),(.591,.854,.07,.118)],
  'focal':[(.553,.06,.075,.275),(.93,.09,.07,.30),(.085,.02,.49,.44)],
 },
 'istaroth':{
  'kind':'time-sand','color':(235,209,161),'center':(.79,.61),
  'anchors':{'ring':[.79,.12],'sand':[.94,.45]},
  'person':[(.779,.166),(.858,.169),(.894,.25),(.882,.392),(.89,.466),(.94,.483),(.975,.584),(.994,.696),(.993,1),(.436,1),(.441,.926),(.499,.817),(.576,.736),(.594,.63),(.642,.552),(.688,.505),(.716,.408),(.713,.307),(.746,.226)],
  'details':[(.756,.303,.132,.144),(.783,.507,.117,.106),(.92,.84,.08,.13)],
  'focal':[(.57,.0,.43,.25),(.87,.24,.13,.58),(.24,.70,.39,.30)],
 },
}

def digest(data):return hashlib.sha256(data).hexdigest()

def polygon_mask(points,shape):
    h,w=shape
    mask=np.zeros(shape,np.uint8)
    coords=np.array([(round(x*(w-1)),round(y*(h-1))) for x,y in points],np.int32)
    cv2.fillPoly(mask,[coords],255)
    return mask

def boxes_mask(boxes,shape):
    h,w=shape;mask=np.zeros(shape,np.uint8)
    for x,y,bw,bh in boxes:
        cv2.rectangle(mask,(round(x*w),round(y*h)),(min(w-1,round((x+bw)*w)),min(h-1,round((y+bh)*h))),255,-1)
    return mask

def path_records(edges,mask,minimum,limit,focal=None):
    selected=cv2.bitwise_and(edges,mask)
    contours,_=cv2.findContours(selected,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    records=[]
    for contour in contours:
        length=cv2.arcLength(contour,False)
        if length<minimum:continue
        x,y,w,h=cv2.boundingRect(contour)
        if max(w,h)<minimum*.22:continue
        # Existing edges alone define geometry. Polyline simplification remains
        # within 1.1 working pixels (~1.65 full-image pixels) of its source edge.
        points=cv2.approxPolyDP(contour,1.1,False).reshape(-1,2)
        if len(points)<3:continue
        if len(points)>180:
            points=cv2.approxPolyDP(contour,1.7,False).reshape(-1,2)
        if len(points)>230:continue
        coords=[(min(W,round(float(a)/SCALE,1)),min(H,round(float(b)/SCALE,1))) for a,b in points]
        d='M'+' L'.join(f'{a:g},{b:g}' for a,b in coords)
        if len(d)>6000:continue
        focal_factor=1
        if focal is not None and focal[min(focal.shape[0]-1,y+h//2),min(focal.shape[1]-1,x+w//2)]>0:focal_factor=1.8
        records.append({'d':d,'length':length,'rank':length*focal_factor,'center':((x+w/2)/mask.shape[1],(y+h/2)/mask.shape[0]),'points':coords})
    records.sort(key=lambda r:r['rank'],reverse=True)
    # Keep wide spatial coverage: a textile patch cannot consume all line slots.
    accepted=[];cells={}
    for r in records:
        cx,cy=r['center'];cell=(int(cx*12),int(cy*8))
        if cells.get(cell,0)>=5:continue
        accepted.append(r);cells[cell]=cells.get(cell,0)+1
        if len(accepted)>=limit:break
    return accepted

def timed(records,group,config):
    if group=='environment':
        # Focal scene edges establish the setting before the person appears.
        records.sort(key=lambda r:-r['rank'])
        start,spread,duration=0,420,900
    elif group=='character':
        records.sort(key=lambda r:(r['center'][1]*.7+r['center'][0]*.18,-r['length']))
        start,spread,duration=540,540,950
    else:
        records.sort(key=lambda r:(r['center'][1],-r['length']))
        start,spread,duration=720,390,830
    result=[]
    for i,r in enumerate(records):
        result.append({'d':r['d'],'delayMs':round(start+spread*i/max(1,len(records)-1)),'durationMs':duration+(i%3)*60})
    return result

def draw_group(draw,items,when,color,width):
    for item in items:
        progress=max(0,min(1,(when-item['delayMs'])/item['durationMs']))
        if progress<=0:continue
        coords=[tuple(map(float,p.split(','))) for p in item['d'].replace('M','').split(' L')]
        lengths=[((b[0]-a[0])**2+(b[1]-a[1])**2)**.5 for a,b in zip(coords,coords[1:])]
        budget=sum(lengths)*progress
        for (a,b),length in zip(zip(coords,coords[1:]),lengths):
            if budget<=0:break
            q=min(1,budget/max(length,.0001));end=(a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q)
            draw.line([a,end],fill=color,width=width);budget-=length

def preview(identifier,source,value,evidence):
    cfg=CONFIG[identifier]
    images=[]
    for when in [600,1500,2100]:
        image=Image.new('RGB',(W,H),(8,13,23));draw=ImageDraw.Draw(image)
        draw_group(draw,value['environment'],when,tuple(int(c*.34) for c in cfg['color']),1)
        draw_group(draw,value['character'],when,cfg['color'],2)
        draw_group(draw,value['details'],when,tuple(min(255,c+12) for c in cfg['color']),2)
        image.save(evidence/f'{identifier}-{when}ms-lines.png')
        image.thumbnail((640,360));images.append(image)
    full=Image.fromarray(source);full.thumbnail((640,360));images.append(full)
    sheet=Image.new('RGB',(1280,770),(8,13,23));d=ImageDraw.Draw(sheet)
    for index,(im,label) in enumerate(zip(images,['0.6s scene edges','1.5s source person contour','2.1s contour complete','Exact poster source'])):
        x=(index%2)*640;y=(index//2)*385
        sheet.paste(im,(x,y+25));d.text((x+12,y+7),identifier+' / '+label,fill=(213,224,239))
    sheet.save(evidence/f'{identifier}-storyboard.png')

def build(identifier,root,evidence):
    cfg=CONFIG[identifier];folder=root/'characters'/identifier/'assets/motion';poster=folder/'sandrone-first-frame.jpg';raw=poster.read_bytes()
    source=np.array(Image.open(poster).convert('RGB'))
    if source.shape!=(H,W,3):raise ValueError('Intro source must be exact shipped 1920x1080 poster')
    working=cv2.resize(source,(round(W*SCALE),round(H*SCALE)),interpolation=cv2.INTER_AREA)
    gray=cv2.cvtColor(working,cv2.COLOR_RGB2GRAY)
    shape=gray.shape;person=polygon_mask(cfg['person'],shape);detail=boxes_mask(cfg['details'],shape)
    # Separation buffers prevent selection boundaries and adjacent scene edges
    # from being mistaken for character details or environmental silhouettes.
    person_inner=cv2.bitwise_and(person,cv2.bitwise_not(cv2.dilate(detail,np.ones((5,5),np.uint8))))
    outside=cv2.bitwise_not(cv2.dilate(person,np.ones((15,15),np.uint8)))
    focal=boxes_mask(cfg['focal'],shape)
    person_edges=cv2.Canny(cv2.GaussianBlur(gray,(3,3),.7),65,145)
    env_edges=cv2.Canny(cv2.GaussianBlur(gray,(5,5),1.35),70,165)
    detail_edges=cv2.Canny(cv2.GaussianBlur(gray,(3,3),.55),52,125)
    environment=path_records(env_edges,outside,90,54,focal)
    character=path_records(person_edges,person_inner,35,92)
    details=path_records(detail_edges,cv2.bitwise_and(person,detail),14,36)
    anchors={**cfg['anchors'],'person':list(cfg['center'])}
    value={'schemaVersion':1,'id':identifier,'width':W,'height':H,'posterSha256':digest(raw),'origin':'source-pixel-contours','environment':timed(environment,'environment',cfg),'character':timed(character,'character',cfg),'details':timed(details,'details',cfg),'scene':{'kind':cfg['kind'],'anchors':anchors}}
    output=json.dumps(value,separators=(',',':'),ensure_ascii=False).encode('utf-8')+b'\n'
    if len(output)>512*1024:raise ValueError('Intro over512KB')
    for group in ['environment','character','details']:
        if not 1<=len(value[group])<=128:raise ValueError('Invalid contourgroup size')
    if sum(len(value[g]) for g in ['environment','character','details'])>240:raise ValueError('Too many paths')
    (folder/'scene-intro.json').write_bytes(output)
    preview(identifier,source,value,evidence)
    # Every exported vertex is tested against an actual selected edge pixel.
    # Numerical geometry never uses a body replacement or an invented pose.
    misses=0;total=0
    for records,edges in [(environment,env_edges),(character,person_edges),(details,detail_edges)]:
        for r in records:
            for x,y in r['points']:
                px,py=round(x*SCALE),round(y*SCALE);total+=1
                if not edges[max(0,py-2):min(edges.shape[0],py+3),max(0,px-2):min(edges.shape[1],px+3)].any():misses+=1
    if misses:raise ValueError('A generated vertex is not source-aligned')
    return {'id':identifier,'posterSha256':value['posterSha256'],'counts':{g:len(value[g]) for g in ['environment','character','details']},'bytes':len(output),'sourceAlignedVertices':total,'unmatchedVertices':misses,'sourceRGBChanged':False,'personRedrawn':False,'scene':value['scene']}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--only',default='');parser.add_argument('--root',type=Path,default=ROOT);args=parser.parse_args()
    ids=args.only.split(',') if args.only else list(CONFIG)
    if any(x not in CONFIG for x in ids):raise ValueError('Unknown role')
    cv2.setNumThreads(2)
    evidence=args.root/'evidence/scene-intro';evidence.mkdir(parents=True,exist_ok=True)
    reports=[build(identifier,args.root,evidence) for identifier in ids]
    (evidence/'contour-verification.json').write_text(json.dumps({'pass':True,'method':'Exact shipped-poster Canny edges selected by bounded scene/person masks; no RGB edits','characters':reports},indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'pass':True,'characters':reports}),flush=True)

if __name__=='__main__':main()
