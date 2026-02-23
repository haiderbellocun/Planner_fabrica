import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZlNmQ3NWI4LTE2MWUtNDlkYy1hZTVjLWMxMWRiMTg2N2NmMiIsInByb2ZpbGVJZCI6Ijg1ZTRkMDVhLWQ2NTEtNDU0MC04MzZiLTA5ZDdjZmZjY2MzMiIsImVtYWlsIjoiaGFpZGVyX2JlbGxvQGN1bi5lZHUuY28iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzA2NzM1MTIsImV4cCI6MTc3MTI3ODMxMn0.wEsZi-rDEbO08Rv8rfKBZCqChzUxY150MuxsiqkL5Wo';

console.log('JWT_SECRET from .env:', JWT_SECRET);
console.log('\n=== Verifying token ===');

try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ Token is VALID!');
  console.log('Decoded:', JSON.stringify(decoded, null, 2));
} catch (error) {
  console.log('❌ Token verification FAILED');
  console.log('Error:', error.message);

  console.log('\n=== Testing with different secrets ===');

  // Try with default secret
  try {
    const decoded = jwt.verify(token, 'default-secret');
    console.log('✅ Token works with "default-secret"!');
    console.log('>>> THE TOKEN WAS CREATED WITH THE DEFAULT SECRET <<<');
  } catch (err) {
    console.log('❌ Not the default secret');
  }

  // Try decoding without verification
  console.log('\n=== Decoded (without verification) ===');
  const decoded = jwt.decode(token);
  console.log(JSON.stringify(decoded, null, 2));
}
