async function verifyDemo() {
  console.log('====================================================');
  console.log('🚀 NestJS Phase 1 Foundation Verification Demo');
  console.log('====================================================\n');

  // 1. GET /health/live
  const live = await (await fetch('http://localhost:3001/health/live')).json();
  console.log('🔹 1. GET /health/live');
  console.log(JSON.stringify(live, null, 2), '\n');

  // 2. GET /health/ready
  const ready = await (await fetch('http://localhost:3001/health/ready')).json();
  console.log('🔹 2. GET /health/ready');
  console.log(JSON.stringify(ready, null, 2), '\n');

  // 3. POST /api/v1/auth/request-otp
  const otpReq = await (await fetch('http://localhost:3001/api/v1/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876543210' }),
  })).json();
  console.log('🔹 3. POST /api/v1/auth/request-otp');
  console.log(JSON.stringify(otpReq, null, 2), '\n');

  // 4. POST /api/v1/auth/verify-otp
  const otpVer = await (await fetch('http://localhost:3001/api/v1/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876543210', otp: '123456' }),
  })).json();
  console.log('🔹 4. POST /api/v1/auth/verify-otp (Issued Working JWT)');
  console.log(JSON.stringify(otpVer, null, 2), '\n');

  // 5. GET /api/v1/auth/me (Protected using Issued Access Token)
  const me = await (await fetch('http://localhost:3001/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${otpVer.accessToken}` },
  })).json();
  console.log('🔹 5. GET /api/v1/auth/me (Protected Route with JWT)');
  console.log(JSON.stringify(me, null, 2), '\n');

  // 6. POST /api/v1/auth/request-otp (Bad Phone format -> 400 Bad Request)
  const badReq = await (await fetch('http://localhost:3001/api/v1/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: 'invalid-phone-string' }),
  })).json();
  console.log('🔹 6. Class-Validator Rejection (400 Bad Request on Invalid Phone Payload)');
  console.log(JSON.stringify(badReq, null, 2), '\n');
}

verifyDemo();
