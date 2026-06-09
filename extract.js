const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\sbhrn\\.gemini\\antigravity\\brain\\61565a22-3599-4864-868d-7de40d60d67a\\.system_generated\\steps\\2005\\content.md', 'utf8');

let matches = content.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
if (matches) {
  let texts = matches
    .map(m => m.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"'))
    .filter(t => t.length > 200 && !t.includes('gstatic') && !t.includes('googlesyndication') && !t.includes('can list'));
    
  texts = [...new Set(texts)];
  
  texts.slice(0, 10).forEach(t => {
    console.log("----");
    console.log(t.substring(0, 500));
  });
}
