try {
  console.log('Resolving tailwindcss...');
  console.log(require.resolve('tailwindcss'));
} catch (e) {
  console.error('Failed to resolve tailwindcss:', e.message);
}

try {
  console.log('Resolving @tailwindcss/postcss...');
  console.log(require.resolve('@tailwindcss/postcss'));
} catch (e) {
  console.error('Failed to resolve @tailwindcss/postcss:', e.message);
}
