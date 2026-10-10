import subprocess,json,time
from pathlib import Path
b=Path(__file__).resolve().parent;a=json.loads((b/'argv.json').read_text());start=time.time()
with (b/'PROMPT.md').open() as inp,(b/'stdout.txt').open('w') as out,(b/'stderr.txt').open('w') as err:
 try:r=subprocess.run(a,stdin=inp,stdout=out,stderr=err,timeout=900);code=r.returncode
 except subprocess.TimeoutExpired:code=124
(b/'receipt.json').write_text(json.dumps({'exit_code':code,'seconds':time.time()-start,'model':'gpt-6-astra','sandbox':'read-only'},indent=2));raise SystemExit(code)
