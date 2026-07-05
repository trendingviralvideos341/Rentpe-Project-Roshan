import * as fs from 'fs';

const filePath = 'c:/Antigravity/ANTIGRATIVITY project/rentpe/src/app/dashboard/student/page.tsx';
const content = fs.readFileSync(filePath, 'utf8');

let hasHighChars = false;
const highChars: { char: string; code: number; index: number }[] = [];

for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    if (code > 255) {
        hasHighChars = true;
        highChars.push({ char: content[i], code, index: i });
    }
}

console.log(`Has characters > 255: ${hasHighChars}`);
console.log(`Count of characters > 255: ${highChars.length}`);
if (highChars.length > 0) {
    console.log('Sample high characters:');
    console.log(highChars.slice(0, 20));
}
