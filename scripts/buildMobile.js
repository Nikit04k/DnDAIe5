const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'app', 'api');
const tempApiDir = path.join(rootDir, 'app', '_api_temp_backup');

console.log('🚀 [Mobile Build] Starting standalone static export for Android...');

let movedApi = false;
try {
  // 1. Temporarily rename app/api so Next.js static export succeeds without Node.js API routes
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, tempApiDir);
    movedApi = true;
    console.log('📦 [Mobile Build] API routes backed up.');
  }

  // 2. Run Next.js static export
  console.log('⚡ [Mobile Build] Running Next.js static export into out/...');
  execSync('npx cross-env NEXT_PUBLIC_EXPORT=true next build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_EXPORT: 'true' },
  });

  console.log('✅ [Mobile Build] Static export successfully created in out/!');
} catch (err) {
  console.error('❌ [Mobile Build Error]:', err.message);
  process.exitCode = 1;
} finally {
  // 3. Always restore app/api
  if (movedApi && fs.existsSync(tempApiDir)) {
    if (fs.existsSync(apiDir)) {
      fs.rmSync(apiDir, { recursive: true, force: true });
    }
    fs.renameSync(tempApiDir, apiDir);
    console.log('🔄 [Mobile Build] API routes restored.');
  }
}
