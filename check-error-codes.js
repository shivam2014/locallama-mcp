import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

console.log('Available ErrorCode values:');
for (const code in ErrorCode) {
  console.log(`- ${code}`);
}