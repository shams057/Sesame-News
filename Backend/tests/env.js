// Loaded before every test file.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-for-validation-0123456789';
// The assistant stays on its placeholders unless a test file overrides them.
process.env.LLM_MODEL = 'YOUR_MODEL_NAME';
process.env.LLM_API_KEY = 'YOUR_API_KEY';
// Test uploads go to a throwaway folder, never into Backend/uploads.
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), `sesame-test-uploads-${process.pid}`);
