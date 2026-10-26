"""Package the built integration, excluding all local session/account state."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
version = catalog['version']
archive = root.parent / f'CodexUI-Integrated-{version}-Windows-x64.zip'
excluded = {'profile', 'state', 'logs', 'evidence', 'backups', '.git', '.codex', '__pycache__', '.build-deps'}
files = {}
for source in sorted(root.rglob('*')):
    rel = source.relative_to(root)
    if rel.as_posix().startswith(('integration/motion/output/', 'integration/materials/output/')):
        continue
    if set(rel.parts) & excluded or source.name == 'machine.json' or any(p.startswith('.env') for p in rel.parts):
        continue
    if source.is_symlink():
        raise RuntimeError(f'Links cannot be shared: {rel}')
    if source.is_file():
        if rel.parts[0] in {'assets', 'themes'} or rel.as_posix() in {'engine/renderer.mjs', 'engine/native-ui.css', 'integrity.json'}:
            continue
        files[rel.as_posix()] = source
# A share package always starts in its declared default, independently of the
# user's current live selection. Override only ZIP entries; do not switch them.
default_pack = root / 'characters' / catalog['defaultId']
manifest = json.loads((default_pack / 'active-files.json').read_text(encoding='utf-8'))
for name, expected in manifest['files'].items():
    source = default_pack / name
    assert source.resolve().is_relative_to(default_pack.resolve())
    assert hashlib.file_digest(source.open('rb'), 'sha256').hexdigest() == expected
    files[name] = source
base_bytes = (root / 'integration/integrity-base.json').read_bytes()
integrity = {**json.loads(base_bytes), **manifest['files'], 'integration/integrity-base.json': hashlib.sha256(base_bytes).hexdigest()}
files['integrity.json'] = (json.dumps(integrity, indent=2) + '\n').encode('utf-8')
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    for name, source in sorted(files.items()):
        target = 'Windows-Portable/' + name
        if isinstance(source, bytes):
            bundle.writestr(target, source)
        else:
            bundle.write(source, target)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for name in bundle.namelist():
        assert not set(Path(name).parts) & excluded
        assert not name.endswith('/machine.json')
        assert 'durin' not in name.lower()
    for name, expected in integrity.items():
        assert hashlib.sha256(bundle.read('Windows-Portable/' + name)).hexdigest() == expected, name
metadata = {
    'version': version, 'file': archive.name, 'files': len(files),
    'uncompressedBytes': sum(len(f) if isinstance(f, bytes) else f.stat().st_size for f in files.values()),
    'bytes': archive.stat().st_size,
    'sha256': hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest(),
    'characterCount': 9, 'requestedCharacters': 8, 'retainedOriginal': 'sandrone',
    'excludedCharacter': 'durin', 'personalStateIncluded': False,
    'switcher': 'embedded-in-every-theme', 'defaultId': catalog['defaultId'],
    'approvedImages': {'mitya': 'M1', 'hutao': 'H4'}, 'iconRolesPerCharacter': 19,
    'desktopShortcuts': 'C:/Users/admin/Desktop/codexui'
    ,'userAvatarFrame': True, 'settingsSidebarIcons': True,
    'openingArtLettering': True, 'completeSubtleWorkspaceFrame': True,
    'frameScope': 'native-main-excluding-sidebar',
    'adaptiveManagedPort': True,
    'characterEntrance': 'source-scene-contours-to-color',
    'mityaOpening': 'independent-quiet-winter-study'
}
(root.parent / 'RELEASE.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(metadata, ensure_ascii=False))
