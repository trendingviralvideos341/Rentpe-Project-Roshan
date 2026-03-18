const path = require('path');

module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

// Ensure resolution is anchored to this directory
try {
  require.resolve('tailwindcss', { paths: [__dirname] });
} catch (e) {
  console.error('Tailwind v4 resolution failed at local root:', __dirname);
}