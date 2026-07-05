import * as fs from 'fs';

const filePath = 'c:/Antigravity/ANTIGRATIVITY project/rentpe/src/app/dashboard/student/page.tsx';
const content = fs.readFileSync(filePath, 'utf8');

// Mapping of CP1252 Unicode characters back to their raw byte values
const cp1252ToByte: Record<number, number> = {
    8364: 0x80, // €
    8218: 0x82, // ‚
    402:  0x83, // ƒ
    8222: 0x84, // „
    8230: 0x85, // …
    8224: 0x86, // †
    8225: 0x87, // ‡
    710:  0x88, // ˆ
    8240: 0x89, // ‰
    352:  0x8A, // Š
    8249: 0x8B, // ‹
    338:  0x8C, // Œ
    381:  0x8E, // Ž
    8216: 0x91, // ‘
    8217: 0x92, // ’
    8220: 0x93, // “
    8221: 0x94, // ”
    8226: 0x95, // •
    8211: 0x96, // –
    8212: 0x97, // —
    732:  0x98, // ˜
    8482: 0x99, // ™
    353:  0x9A, // š
    8250: 0x9B, // ›
    339:  0x9C, // œ
    382:  0x9E, // ž
    376:  0x9F  // Ÿ
};

const bytes: number[] = [];

for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    if (code in cp1252ToByte) {
        bytes.push(cp1252ToByte[code]);
    } else if (code < 256) {
        bytes.push(code);
    } else {
        // If there's any character > 255 that is not in CP1252 (e.g. if we wrote actual correct non-CP1252 characters),
        // we'll convert it to UTF-8 bytes and push them.
        const buf = Buffer.from(content[i], 'utf8');
        for (let j = 0; j < buf.length; j++) {
            bytes.push(buf[j]);
        }
    }
}

const buffer = Buffer.from(bytes);
const decoded = buffer.toString('utf8');

fs.writeFileSync(filePath, decoded, 'utf8');
console.log('Successfully repaired file encoding and restored emojis!');
