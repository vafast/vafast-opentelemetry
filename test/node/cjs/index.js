if ('Bun' in globalThis) {
    throw new Error('❌ Use Node.js to run this test!')
}

const { opentelemetry } = require('../../../dist/cjs/index.js')

if (typeof opentelemetry !== 'function') {
    throw new Error('❌ CommonJS Node.js failed')
}

console.log('✅ CommonJS Node.js works!')
