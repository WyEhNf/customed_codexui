"""Read-only MP4 decode/guard verification for revised per-character scenes."""
from pathlib import Path
import hashlib
import json
import os
import sys

HERE=Path(__file__).resolve().parent
for candidate in [HERE/'.build-deps', HERE.parents[1]/'.build-deps/python', *([Path(os.environ['CODEXUI_PYTHON_DEPS'])] if os.environ.get('CODEXUI_PYTHON_DEPS') else [])]:
    if candidate.is_dir():sys.path.insert(0,str(candidate))
import cv2
import numpy as np

ROOT=HERE.parents[1]
CHANGED=['columbina','hutao','ayaka','nahida','furina','citlali']
RETAINED=['mitya','istaroth','sandrone']
report={'pass':False,'changed':[],'retained':[],'sourcePeopleRedrawn':False}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
baseline_file=ROOT/'evidence/motion/retained-before-recovery.json'
baseline=json.loads(baseline_file.read_text(encoding='utf-8')) if baseline_file.exists() else {}
for identifier in CHANGED:
    folder=ROOT/'characters'/identifier/'assets/motion'
    ledger=json.loads((folder/'derived.json').read_text(encoding='utf-8'))
    metrics=json.loads((folder/'metrics.json').read_text(encoding='utf-8'))
    video=folder/ledger['file'];poster=folder/ledger['posterFile']
    assert sha(video)==ledger['sha256']
    assert sha(poster)==ledger['posterSha256']
    assert ledger['motionRevision']=='scene-motion-v2'
    assert ledger['closedOrbitEffect'] is False
    assert video.stat().st_size<12*1024*1024
    assert metrics['rawFaceMAD']==metrics['rawProtectedMapMaxPx']==0
    assert metrics['rawFaceWithFxMAD']==metrics['rawProtectedWithFxMAD']==0
    assert metrics['localWarpPixelMAD']>0
    capture=cv2.VideoCapture(str(video))
    assert int(capture.get(cv2.CAP_PROP_FRAME_COUNT))==270
    assert int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))==1920
    assert int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))==1080
    frames=[]
    for seconds in [0,2.25,4.5,6.75,8.96]:
        capture.set(cv2.CAP_PROP_POS_MSEC,seconds*1000)
        okay,frame=capture.read();assert okay,(identifier,seconds)
        frames.append(cv2.resize(frame,(160,90),interpolation=cv2.INTER_AREA).astype(np.int16))
    capture.release()
    delta=max(float(np.abs(frame-frames[0]).mean()) for frame in frames[1:])
    assert delta>.01,(identifier,'movie is static')
    report['changed'].append({'id':identifier,'bytes':video.stat().st_size,'posterSha256':ledger['posterSha256'],'decodedFrameMAD':delta,'fx':ledger['environmentEffects'],'rawProtectedWithFxMAD':0})
for identifier in RETAINED:
    folder=ROOT/'characters'/identifier/'assets/motion'
    ledger=json.loads((folder/'derived.json').read_text(encoding='utf-8'))
    assert sha(folder/ledger['file'])==ledger['sha256']
    if identifier in baseline:assert sha(folder/ledger['file'])==baseline[identifier],(identifier,'retained clip changed')
    report['retained'].append({'id':identifier,'sha256':ledger['sha256'],'bytes':(folder/ledger['file']).stat().st_size,'byteIdenticalToBeforeRecovery':identifier in baseline})
report['pass']=True
evidence=ROOT/'evidence/motion';evidence.mkdir(parents=True,exist_ok=True)
(evidence/'scene-motion-v2-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'pass':True,'changed':len(CHANGED),'retained':len(RETAINED),'realMp4Decoded':True,'protectedRgbUnchanged':True}))
