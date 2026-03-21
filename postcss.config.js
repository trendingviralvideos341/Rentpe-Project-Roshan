const path = require('path');

module.exports = {
  plugins: {
    '@tailwindcss/postcss': {
      // Anchoring the resolution to this project root to prevent 
      // parent-directory resolution errors like "Can't resolve 'tailwindcss' in '...'"
      base: __dirname,
    },
    autoprefixer: {}, // explicitly add autoprefixer just in case
  },
};

// Diagnostic check to catch errors before they cause the Next.js process to hang or crash
try {
  require.resolve('tailwindcss', { paths: [__dirname] });
} catch (e) {
  process.stdout.write(`\n--- TAILWIND RESOLUTION DIAGNOSTIC ---\nLocal Root: ${__dirname}\nResolution Failed: check node_modules/tailwindcss existence.\n---------------------------------------\n`);
}