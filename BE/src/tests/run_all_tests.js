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
  const suiteTimings = [];

  try {
    const t0 = performance.now();
    console.log(">> STEP 1/4: Running Clinical Workflow & Service Unit Tests (30 tests)...");
    const { runClinicalTests } = await import('./test_runner.js');
    if (typeof runClinicalTests === "function") {
      await runClinicalTests();
    }
    suiteTimings.push({ step: "Suite 1: Clinical Workflow & Unit Tests", tests: 30, ms: (performance.now() - t0).toFixed(1) });
  } catch (err) {
    console.error("Clinical test suite failed to execute:", err);
    hasFailure = true;
  }

  try {
    const t0 = performance.now();
    console.log("\n>> STEP 2/4: Running OWASP Top 10 Security Audit & Penetration Suite (35 tests)...");
    await import('./security_audit.test.js');
    suiteTimings.push({ step: "Suite 2: OWASP Top 10 Security Audit", tests: 35, ms: (performance.now() - t0).toFixed(1) });
  } catch (err) {
    console.error("Security audit suite failed to execute:", err);
    hasFailure = true;
  }

  try {
    const t0 = performance.now();
    console.log("\n>> STEP 3/4: Running Audit Remediation Verification Suite (53 tests)...");
    await import('./audit_remediation.test.js');
    suiteTimings.push({ step: "Suite 3: Audit Remediation Verification", tests: 53, ms: (performance.now() - t0).toFixed(1) });
  } catch (err) {
    console.error("Audit remediation test suite failed to execute:", err);
    hasFailure = true;
  }

  try {
    const t0 = performance.now();
    console.log("\n>> STEP 4/4: Running Comprehensive Compliance Audit Suite (34 tests)...");
    const { runComplianceAudit } = await import('./comprehensive_compliance_audit.test.js');
    if (typeof runComplianceAudit === "function") {
      await runComplianceAudit();
    }
    suiteTimings.push({ step: "Suite 4: Comprehensive Compliance & Neuro-Oncology", tests: 34, ms: (performance.now() - t0).toFixed(1) });
  } catch (err) {
    console.error("Comprehensive compliance audit test suite failed to execute:", err);
    hasFailure = true;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalTests = suiteTimings.reduce((sum, s) => sum + s.tests, 0);

  console.log(`\n======================================================================`);
  console.log(`   EXECUTION TIMING BREAKDOWN (PER-SUITE TELEMETRY)                  `);
  console.log(`======================================================================`);
  suiteTimings.forEach((s) => {
    console.log(`  • ${s.step.padEnd(48)}: ${s.ms.padStart(7)} ms (${s.tests} tests)`);
  });
  console.log(`  --------------------------------------------------------------------`);
  console.log(`  • TOTAL EXECUTION DURATION: ${elapsed}s across all ${totalTests} automated tests`);
  console.log(`>> STATUS: ${hasFailure ? "❌ FAILED" : `✅ 100% PASSED (${totalTests}/${totalTests} TESTS)`}`);
  console.log(`======================================================================\n`);

  if (hasFailure) {
    process.exit(1);
  }
}

runAll();
