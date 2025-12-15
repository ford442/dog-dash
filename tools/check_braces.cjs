#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function checkFile(p) {
  const s = fs.readFileSync(p, 'utf8');
  let line = 1, i = 0;
  let inSingle=false, inDouble=false, inBack=false, inComment=false, inLineComment=false;
  const stack = [];
  while (i < s.length) {
    const c = s[i];
    if (c === '\n') { line++; inLineComment=false; i++; continue; }
    if (!inSingle && !inDouble && !inBack && !inLineComment && s.substr(i,2) === '/*') { inComment=true; i+=2; continue; }
    if (inComment && s.substr(i,2) === '*/') { inComment=false; i+=2; continue; }
    if (inComment) { i++; continue; }
    if (!inSingle && !inDouble && !inBack && s.substr(i,2) === '//') { inLineComment=true; i+=2; continue; }
    if (inLineComment) { i++; continue; }
    if (c === "'" && !inDouble && !inBack) { inSingle = !inSingle; i++; continue; }
    if (c === '"' && !inSingle && !inBack) { inDouble = !inDouble; i++; continue; }
    if (c === '`' && !inSingle && !inDouble) { inBack = !inBack; i++; continue; }
    if (inSingle || inDouble || inBack) { if (c === '\\') { i+=2; continue; } i++; continue; }
    if (c === '{') stack.push(line);
    if (c === '}') {
      if (stack.length) stack.pop(); else return {ok:false, reason:`Extra closing brace at ${p}:${line}`};
    }
    i++;
  }
  if (stack.length) return {ok:false, reason:`Unmatched opening brace at ${p}:${stack[stack.length-1]}`};
  return {ok:true};
}

function walk(dir) {
  const out = [];
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git') continue;
    const full = path.join(dir,f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.js') || full.endsWith('.ts') || full.endsWith('.cjs')) out.push(full);
  }
  return out;
}

const root = process.cwd();
const files = walk(root);
let ok=true;
for (const f of files) {
  const res = checkFile(f);
  if (!res.ok) {
    console.error('Syntax check failed:', res.reason);
    ok=false;
  }
}
if (!ok) process.exit(1);
console.log('Syntax check passed: brace balance OK');
