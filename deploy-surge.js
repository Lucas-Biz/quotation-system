// Deploy to Surge.sh using surge-stream directly
const surgeStream = require('surge-stream');

const projectDir = 'C:/ProgramData/WorkBuddy/chromium-env/135wr8d/WorkBuddy/2026-06-08-15-20-15/quotation-system';
const domain = 'cwvqt.surge.sh';

const TOKEN = 'e0ea5a2d01cdcc45959dc5e284c595a7';
console.log('Deploying to', domain, 'using token...');

// Create stream instance
const stream = surgeStream({ endpoint: 'https://surge.surge.sh' });

// Publish returns an EventEmitter
var pub = stream.publish(projectDir, domain, { user: 'token', pass: TOKEN });

var success = false;

pub.on('data', function(d) {
  console.log('📢', JSON.stringify(d));
  if (d.type === 'success' || d.type === 'info') success = true;
});

pub.on('success', function() {
  success = true;
  console.log('✅ Published successfully!');
  process.exit(0);
});

pub.on('fail', function() {
  if (!success) {
    console.error('❌ Publish failed');
    process.exit(1);
  }
});

pub.on('error', function(err) {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});

pub.on('end', function() {
  console.log('🏁 Stream ended');
  if (success) {
    process.exit(0);
  }
});

// Timeout
setTimeout(function() {
  if (success) { process.exit(0); }
  else { console.log('⏱ Timeout'); process.exit(1); }
}, 45000);
