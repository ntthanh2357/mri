/**
 * NeuroScan AI - Master Test Suite Runner
 * Executes both Clinical Workflow E2E / Service Unit Tests AND OWASP Security Audit Suite
 * Provides unified exit code and telemetry for CI/CD and c8 coverage measurement.
 */

console.log("\n======================================================================");
console.log("   NEUROSCAN AI: EXECUTING COMPREHENSIVE AUTOMATED TEST SUITE        ");
console.log("======================================================================\n");

async function runAll() {
  const startTime = Date.now();
  let hasFailure = false;

  try {
    console.log(">> STEP 1/2: Running Clinical Workflow & Service Unit Tests...");
    await import('./test_runner.js');
  } catch (err) {
    console.error("Clinical test suite failed to execute:", err);
    hasFailure = true;
  }

  try {
    console.log("\n>> STEP 2/2: Running OWASP Top 10 Security Audit & Penetration Suite...");
    await import('./security_audit.test.js');
  } catch (err) {
    console.error("Security audit suite failed to execute:", err);
    hasFailure = true;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n>> All automated suites finished in ${elapsed}s.`);

  if (hasFailure) {
    process.exit(1);
  }
}

runAll();
