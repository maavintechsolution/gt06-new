const net = require('net');

const HOST = '3.109.56.93';
const PORT = 5023;

// Sample GT06 packets (hex strings)
const packets = [
  // Login
  '78780D010391608033600100018CDD0D0A',
  // GPS (example, not real data)
  '7878222219070f0a3538c703120628084d939c00140001940a0212004e4e010000007375250d0a',
  
];

function sendPacket(hex) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(PORT, HOST, () => {
      const buf = Buffer.from(hex, 'hex');
      client.write(buf);
    });
    client.on('data', data => {
      console.log('Response:', data.toString('hex'));
      client.destroy();
      resolve();
    });
    client.on('error', err => {
      console.error('Simulator error:', err);
      reject(err);
    });
  });
}

(async () => {
  for (const pkt of packets) {
    console.log('Sending:', pkt);
    await sendPacket(pkt);
  }
  console.log('All packets sent.');
})();
