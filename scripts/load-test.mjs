// ===================================================
// IPL Dhaba — Automated Performance & Load Test Suite
// Simulates 500 Virtual Users hitting API endpoints
// ===================================================

import http from 'http';

const TARGET_HOST = 'localhost';
const TARGET_PORT = 3001;
const CONCURRENT_USERS = 500;
const DURATION_SECONDS = 10;

console.log(`🚀 Starting IPL Dhaba Load Test Suite...`);
console.log(`👥 Simulating ${CONCURRENT_USERS} Virtual Users over ${DURATION_SECONDS} seconds against http://${TARGET_HOST}:${TARGET_PORT}\n`);

let totalRequests = 0;
let successRequests = 0;
let failedRequests = 0;
const latencies = [];

const makeRequest = (path, method = 'GET', body = null) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock_jwt_token_loadtest',
        'X-Request-ID': `loadtest_${Math.random().toString(36).substring(2, 9)}`,
      },
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const latency = Date.now() - startTime;
        latencies.push(latency);
        totalRequests++;

        if (res.statusCode >= 200 && res.statusCode < 400) {
          successRequests++;
        } else {
          failedRequests++;
        }
        resolve();
      });
    });

    req.on('error', () => {
      totalRequests++;
      failedRequests++;
      resolve();
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

const runBenchmark = async () => {
  const endTime = Date.now() + DURATION_SECONDS * 1000;
  const workerTasks = [];

  for (let i = 0; i < CONCURRENT_USERS; i++) {
    workerTasks.push((async () => {
      while (Date.now() < endTime) {
        // 1. Query Menu
        await makeRequest('/api/v1/menu');
        // 2. Query Turfs
        await makeRequest('/api/v1/bookings');
        // 3. Submit Order
        await makeRequest('/api/v1/orders', 'POST', {
          items: [{ menuItem: { id: 'b1', price: 280, nameEn: 'Biryani' }, quantity: 2 }],
          deliveryType: 'turf_slot',
          deliveryTarget: 'Singarayakonda Turf - Cage 1',
          paymentMethod: 'wallet',
        });
      }
    })());
  }

  await Promise.all(workerTasks);

  latencies.sort((a, b) => a - b);
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length || 0);
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log(`\n===================================================`);
  console.log(`📊 LOAD TEST BENCHMARK RESULTS`);
  console.log(`===================================================`);
  console.log(`Total Requests Sent : ${totalRequests}`);
  console.log(`Successful Requests : ${successRequests} (${((successRequests / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Failed Requests     : ${failedRequests}`);
  console.log(`Average Latency     : ${avgLatency} ms`);
  console.log(`95th Percentile (p95): ${p95Latency} ms`);
  console.log(`99th Percentile (p99): ${p99Latency} ms`);
  console.log(`Requests/Sec (RPS)  : ${(totalRequests / DURATION_SECONDS).toFixed(1)} req/s`);
  console.log(`===================================================\n`);
};

runBenchmark();
