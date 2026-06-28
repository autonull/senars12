import http from 'http';

function post(path: string, body: any) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function get(path: string) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('Testing test control API...');
  
  // Test reset
  console.log('1. Reset:', await post('/test/reset', {}));
  
  // Test seed graph
  console.log('2. Seed graph:', await post('/test/seed-graph', {
    concepts: [{ term: 'test', f: 0.9, c: 0.8 }]
  }));
  
  // Test get state
  console.log('3. Get state:', await get('/test/state'));
  
  // Test inject chat
  console.log('4. Inject chat:', await post('/test/inject-chat', {
    stream: 'Test stream ',
    complete: 'Test complete'
  }));
  
  // Test inject derivation
  console.log('5. Inject derivation:', await post('/test/inject-derivation', {
    conclusion: 'derived-concept',
    priority: 0.9
  }));
  
  // Test get state again
  console.log('6. Get state:', await get('/test/state'));
  
  console.log('All tests passed!');
}

runTests().catch(console.error);