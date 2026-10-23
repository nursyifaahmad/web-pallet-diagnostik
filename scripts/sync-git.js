const { execSync } = require('child_process');

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    return execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Error executing: ${cmd}`);
  }
}

console.log('=== PALLET Git Auto-Push Runner ===');
const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

run('git add .');
try {
  run(`git commit -m "Auto-update: ${timestamp}"`);
} catch (e) {
  console.log('No new changes to commit.');
}
run('git push origin main');
console.log('=== Push completed successfully! ===');
