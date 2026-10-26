"""Build the portable runtime from the explicit, shared runtime-files contract.

This never copies profile, state, logs, evidence, backups, machine.json or .env
files. Source integrity and runtime integrity deliberately have different scopes.
"""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import os
import subprocess
import time
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
output = (args.output_dir or root / 'dist' / 'releases').resolve()
output.mkdir(parents=True, exist_ok=True)
read_json = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
digest = lambda b: hashlib.sha256(b).hexdigest()
config = read_json(root / 'package.json')
catalog = read_json(root / 'catalog.json')
contract = read_json(root / 'integration/runtime-files.json')
version = config['version']
if catalog['version'] != version or catalog['defaultId'] != 'columbina':
    raise RuntimeError('Build the current version before packaging; default must be Columbina')
archive = output / f'CodexUI-Integrated-{version}-Windows-x64.zip'
excluded = {'profile', 'codex-home', 'state', 'logs', 'evidence', 'backups', '.git', '.codex', '__pycache__', '.build-deps', 'node_modules', 'tests', 'dist', '.local-evidence', 'coverage'}
files = {}

def add(name, source):
    rel = PurePosixPath(name)
    if rel.is_absolute() or '..' in rel.parts or set(rel.parts) & excluded or any(p.startswith('.env') for p in rel.parts) or rel.name == 'machine.json':
        raise RuntimeError(f'Forbidden release input: {name}')
    if isinstance(source, Path):
        if not source.resolve().is_relative_to(root) or source.is_symlink() or not source.is_file():
            raise RuntimeError(f'Invalid release input: {name}')
    if name in files:
        raise RuntimeError(f'Duplicate release input: {name}')
    files[name] = source

for name in contract['rootFiles']:
    add(name, root / name)
for prefix in contract['treeRoots']:
    directory = root / prefix
    if not directory.is_dir():
        raise RuntimeError(f'Missing runtime tree: {prefix}')
    for source in sorted(directory.rglob('*')):
        if source.is_symlink():
            raise RuntimeError(f'Links cannot be shared: {source}')
        if source.is_file() and source.relative_to(root).as_posix() not in {'engine/renderer.mjs', 'engine/native-ui.css'}:
            add(source.relative_to(root).as_posix(), source)
for name in contract['integrationFiles']:
    add('integration/' + name, root / 'integration' / name)
allowed = set(contract['packFiles'] + contract['optionalPackFiles'])
default_manifest = None
for entry in catalog['characters']:
    pack = root / entry['path']
    manifest_bytes = (pack / 'active-files.json').read_bytes()
    if digest(manifest_bytes) != entry['manifestSha256']:
        raise RuntimeError(f'Stale character manifest: {entry["id"]}')
    manifest = json.loads(manifest_bytes)
    if manifest['id'] != entry['id'] or not set(contract['packFiles']).issubset(manifest['files']) or not set(manifest['files']).issubset(allowed):
        raise RuntimeError(f'Character violates the runtime contract: {entry["id"]}')
    add(entry['path'] + '/active-files.json', manifest_bytes)
    add(entry['path'] + '/presentation.json', pack / 'presentation.json')
    for name, expected in manifest['files'].items():
        source = pack / name
        if digest(source.read_bytes()) != expected:
            raise RuntimeError(f'Character file changed after build: {entry["id"]}/{name}')
        add(entry['path'] + '/' + name, source)
    if entry['id'] == catalog['defaultId']:
        default_manifest = manifest
if default_manifest is None:
    raise RuntimeError('Default character is missing')
# Override ZIP entries only: the local active character and managed client are untouched.
default_pack = root / 'characters' / catalog['defaultId']
for name in default_manifest['files']:
    add(name, default_pack / name)

def bytes_of(source):
    return source if isinstance(source, bytes) else source.read_bytes()

# Generate a fresh runtime-only base. Never copy the full development snapshot.
base = {name: digest(bytes_of(source)) for name, source in sorted(files.items()) if name not in default_manifest['files']}
base_bytes = (json.dumps(base, indent=2) + '\n').encode('utf-8')
add('integration/integrity-base.json', base_bytes)
integrity = {**base, **default_manifest['files'], 'integration/integrity-base.json': digest(base_bytes)}
add('integrity.json', (json.dumps(integrity, indent=2) + '\n').encode('utf-8'))
# A fixed timestamp keeps repackaging identical inputs stable.
try:
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    epoch = int(os.environ.get('SOURCE_DATE_EPOCH') or subprocess.check_output(['git', 'show', '-s', '--format=%ct', 'HEAD'], cwd=root, text=True).strip())
except (OSError, ValueError, subprocess.CalledProcessError):
    commit, epoch = None, 315532800
stamp = time.gmtime(max(315532800, epoch))[:6]
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    for name, source in sorted(files.items()):
        info = zipfile.ZipInfo('Windows-Portable/' + name, date_time=stamp)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        bundle.writestr(info, bytes_of(source), compresslevel=6)
with zipfile.ZipFile(archive) as bundle:
    if bundle.testzip() is not None:
        raise RuntimeError('Archive CRC failure')
    actual = {name.removeprefix('Windows-Portable/') for name in bundle.namelist()}
    if actual != set(files) or set(integrity) != actual - {'integrity.json'}:
        raise RuntimeError('Runtime integrity must cover exactly the packaged files')
    for name, expected in integrity.items():
        if digest(bundle.read('Windows-Portable/' + name)) != expected:
            raise RuntimeError(f'Archive integrity failed: {name}')
metadata = {
    'schemaVersion': 1, 'version': version, 'file': archive.name, 'files': len(files),
    'uncompressedBytes': sum(len(bytes_of(f)) for f in files.values()),
    'bytes': archive.stat().st_size, 'sha256': digest(archive.read_bytes()),
    'characterCount': len(catalog['characters']), 'defaultId': catalog['defaultId'],
    'personalStateIncluded': False, 'packageKind': 'windows-x64-portable-runtime',
    'integrityScope': 'every bundled file except integrity.json itself',
    'excludedDevelopmentInputs': ['embedded previews', 'source artwork', 'authoring tools', 'tests', 'dependencies'],
    'metadataSource': {'version': 'package.json', 'commit': commit, 'catalogSha256': digest((root / 'catalog.json').read_bytes()), 'runtimeContractSha256': digest((root / 'integration/runtime-files.json').read_bytes())}
}
metadata_path = output / 'RELEASE.json'
metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(output / 'SHA256SUMS.txt').write_text(f'{metadata["sha256"]}  {archive.name}\n{digest(metadata_path.read_bytes())}  RELEASE.json\n', encoding='ascii')
print(json.dumps(metadata, ensure_ascii=False))
