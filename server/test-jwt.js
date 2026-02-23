import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

console.log('=== JWT SECRET TEST ===');
console.log('JWT_SECRET:', JWT_SECRET);
console.log('Length:', JWT_SECRET.length);

// Create a test token
const testPayload = {
  id: 'test-id',
  profileId: 'test-profile-id',
  email: 'test@example.com',
  role: 'admin',
};

console.log('\n=== CREATING TOKEN ===');
const token = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '7d' });
console.log('Token created:', token.substring(0, 50) + '...');

console.log('\n=== VERIFYING TOKEN ===');
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ Token verified successfully!');
  console.log('Decoded:', decoded);
} catch (error) {
  console.log('❌ Token verification failed:', error.message);
}

console.log('\n=== TEST WITH WRONG SECRET ===');
try {
  const decoded = jwt.verify(token, 'wrong-secret');
  console.log('Should not reach here');
} catch (error) {
  console.log('❌ Expected error:', error.message);
}
