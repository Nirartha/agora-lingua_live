// Build a deterministic public-source copy, never a copy of the whole workspace.
import { readdir, readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const output = path.join(root, '.release', 'lingua-live');
const roots = ['.gitignore','.nvmrc','.env.example','AGENTS.md','LICENSE','README.md','README.en.md','package.json','package-lock.json','tsconfig.json','next.config.ts'];
const documents = ['architecture.md','deployment.zh-TW.md','deployment.en.md','sources.md','validation.md'];
const scripts = ['smoke-live.mjs','viewer-gateway.mjs','prepare-public.mjs'];
async function walk(directory) {
  const files=[];
  for(const item of await readdir(path.join(root,directory),{withFileTypes:true})) {
    const relative=path.join(directory,item.name);
    if(item.isSymbolicLink())throw new Error(`Symlink is not allowed: ${relative}`);
    if(item.isDirectory())files.push(...await walk(relative));else files.push(relative);
  }
  return files.sort();
}
const files=[...roots,...documents.map(name=>`docs/${name}`),...scripts.map(name=>`scripts/${name}`),...await walk('src'),...await walk('tests'),...(await readdir(path.join(root,'docs')).then(items=>items.includes('images')?walk('docs/images'):[]))].sort();
// Compare with local values without logging them. Missing local settings are fine
// in another developer's fresh clone; generic patterns still run below.
let settings='';try{settings=await readFile(path.join(root,'.env.local'),'utf8');}catch{}
const secrets=[...settings.matchAll(/^([A-Z_]+)=(.*)$/gm)].filter(([,key,value])=>/SECRET|TOKEN|CERT|PASSWORD|ACCESS_CODE|AGORA_APP_ID|AGORA_CUSTOMER_ID|TOKEN_BUILDER_URL/.test(key)&&value.trim().length>=12).map(([,key,value])=>({key,value:value.trim().replace(/^["']|["']$/g,'')}));
async function publicBytes(relative) {
  const bytes=await readFile(path.join(root,relative));
  if(relative!=='tsconfig.json')return bytes;
  const config=JSON.parse(bytes.toString('utf8'));
  config.include=config.include.filter(value=>!value.startsWith('.next-'));
  return Buffer.from(JSON.stringify(config,null,2)+'\n');
}
const findings=[];const manifest=[];
for(const relative of files) {
  if(/(^|\/)(?:\.env(?!\.example$)|\.data|\.tools|\.next[^/]*|node_modules|local|qa-[^/]+)(\/|$)/.test(relative))throw new Error(`Private path in allowlist: ${relative}`);
  const location=path.join(root,relative),stat=await lstat(location);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error(`Not a regular file: ${relative}`);
  const bytes=await publicBytes(relative);manifest.push({path:relative.replaceAll(path.sep,'/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  if(/\.(png|jpg|jpeg)$/.test(relative))continue; // Only reviewed synthetic artwork is allowlisted.
  const text=bytes.toString('utf8');
  for(const secret of secrets)if(text.includes(secret.value))findings.push(`${relative}: local ${secret.key} value`);
  if(relative!=='scripts/prepare-public.mjs'){
    if(/https?:\/\/[^\s"')]*agoralab\.co|\/Users\//i.test(text))findings.push(`${relative}: private/local endpoint or workstation path`);
    if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{20,}|007[A-Za-z0-9+/=]{180,}/.test(text))findings.push(`${relative}: credential-like literal`);
  }
}
if(findings.length){console.error('Public preparation blocked (values hidden):\n'+findings.join('\n'));process.exitCode=1;}
else {
  console.log(`PASS: ${files.length} allowlisted files; local credential values/private paths not found.`);
  if(!process.argv.includes('--check')){
    // Never overwrite a published checkout or silently mix old files into a release.
    await mkdir(path.dirname(output),{recursive:true});await mkdir(output);
    for(const relative of files){const dest=path.join(output,relative);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,await publicBytes(relative));}
    await writeFile(path.join(root,'.release','manifest.json'),JSON.stringify({files:manifest},null,2)+'\n');
    console.log('Prepared .release/lingua-live and .release/manifest.json. No GitHub push or deployment performed.');
  }
}
