// Fix vvcc.json — removes trailing garbage bytes
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'decrypted_assets', 'vvcc.json');
const outPath = path.resolve(__dirname, '..', 'decrypted_assets', 'vvcc_fixed.json');

let content = fs.readFileSync(filePath, 'utf8');
let lastBrace = content.lastIndexOf('}');
if (lastBrace > 0) content = content.substring(0, lastBrace + 1);
fs.writeFileSync(outPath, content);

// Parse and analyze
const vvcc = JSON.parse(content);
const keys = Object.keys(vvcc);
console.log('Total mappings:', keys.length);
console.log('First 5 keys:');
keys.slice(0, 5).forEach(k => console.log('  ', k, '->', vvcc[k]));

// Find login-related
const loginKeys = keys.filter(k => k.toLowerCase().includes('login') || k.toLowerCase().includes('denglu'));
console.log('\nLogin-related mappings:', loginKeys.length);
loginKeys.forEach(k => console.log('  ', k, '\n     ->', vvcc[k]));

// Find properties
const propKeys = keys.filter(k => k.includes('properties') || k.includes('clientversion') || k.includes('serversetting'));
console.log('\nProperties mappings:', propKeys.length);
propKeys.forEach(k => console.log('  ', k, '->', vvcc[k]));
