import { execSync } from 'child_process';

let commitSha = 'dev';
try {
  commitSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  // ignore
}

export default {
  base: '/coupang_margin_finder/',
  define: {
    'import.meta.env.VITE_BUILD_SHA': JSON.stringify(commitSha)
  }
};
