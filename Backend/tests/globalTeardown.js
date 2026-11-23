const fs = require('fs');
const os = require('os');
const path = require('path');

/** Removes the throwaway upload folders created by the test run. */
module.exports = async () => {
  for (const name of fs.readdirSync(os.tmpdir())) {
    if (name.startsWith('sesame-test-uploads-')) fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true });
  }
};
