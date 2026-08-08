async function testPhase1() {
  console.log('🧪 Testing NestJS Backend Phase 1 Endpoints...\n');

  // 1. Health Liveness
  const liveRes = await fetch('http://localhost:3001/health/live');
  const liveData = await liveRes.json();
  console.log('1. GET /health/live:', JSON.stringify(liveData, null, 2));

  // 2. Health Readiness
  const readyRes = await fetch('http://localhost:3001/health/ready');
  const readyData = await readyRes.json();
  console.log('2. GET /health/ready:', JSON.stringify(readyData, null, 2));

  // 3. Request OTP
  const reqOtpRes = await fetch('http://localhost:3001/api/v1/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876543210' }),
  });
  const reqOtpData = await reqOtpRes.json();
  console.log('3. POST /api/v1/auth/request-otp:', JSON.stringify(reqOtpData, null, 2));

  // 4. Verify OTP & Issue JWT
  const verOtpRes = await fetch('http://localhost:3001/api/v1/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876543210', otp: '123456' }),
  });
  const verOtpData = await verOtpRes.json();
  console.log('4. POST /api/v1/auth/verify-otp:', JSON.stringify(verOtpData, null, 2));

  // 5. Test Authenticated Route /auth/me
  if (verOtpData.accessToken) {
    const meRes = await fetch('http://localhost:3001/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${verOtpData.accessToken}` },
    });
    const meData = await meRes.json();
    console.log('5. GET /api/v1/auth/me (Protected):', JSON.stringify(meData, null, 2));
  }

  // 6. Test Class Validator Rejection (Non-Whitelisted Property)
  const badReqRes = await fetch('http://localhost:3001/api/v1/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876543210', maliciousField: 'hack' }),
  });
  const badReqData = await badReqRes.json();
  console.log('6. ValidationPipe Rejection (400 Bad Request):', JSON.stringify(badReqData, null, 2));
}

testPhase1();
