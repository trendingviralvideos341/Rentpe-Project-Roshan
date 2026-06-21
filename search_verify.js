const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);
files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.toLowerCase().includes('verify documents') || content.toLowerCase().includes('verifydocument')) {
      console.log(`Found in: ${file}`);
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes('verify documents') || line.toLowerCase().includes('verifydocument')) {
          console.log(`  Line ${index + 1}: ${line.trim()}`);
        }
      });
    }
  } catch (err) {}
});
console.log('Search finished.');
