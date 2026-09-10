/**
 * NeuroScan AI - Enterprise Test Suite Runner
 * Designed for Clean ES-Module testing without external runtime conflicts
 */
import mongoose from 'mongoose';

// ANSI Color Helpers
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

let totalSuites = 0;
let passedSuites = 0;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Test context globals
const suites = [];
let currentSuite = null;

global.describe = (name, fn) => {
  const suite = {
    name,
    fn,
    tests: [],
    beforeAllFns: [],
    afterAllFns: []
  };
  suites.push(suite);
};

global.beforeAll = (fn) => {
  if (currentSuite) {
    currentSuite.beforeAllFns.push(fn);
  }
};

global.afterAll = (fn) => {
  if (currentSuite) {
    currentSuite.afterAllFns.push(fn);
  }
};

global.test = global.it = (name, fn) => {
  if (currentSuite) {
    currentSuite.tests.push({ name, fn });
  }
};

global.expect = (actual) => {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toEqual: (expected) => {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(`Expected deep equality: ${b} !== ${a}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined, but got undefined`);
      }
    },
    toBeNull: () => {
      if (actual !== null) {
        throw new Error(`Expected null, but got ${actual}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual: (expected) => {
      if (!(actual >= expected)) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected truthy, but got ${actual}`);
      }
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error(`Expected falsy, but got ${actual}`);
      }
    },
    toThrow: (expectedMsg) => {
      let threw = false;
      let errObj = null;
      try {
        if (typeof actual === 'function') {
          actual();
        }
      } catch (err) {
        threw = true;
        errObj = err;
      }
      if (!threw) {
        throw new Error(`Expected function to throw, but it did not`);
      }
      if (expectedMsg && !errObj.message.includes(expectedMsg)) {
        throw new Error(`Expected error message to include "${expectedMsg}", but got "${errObj.message}"`);
      }
    },
    rejects: {
      toThrow: async (expectedMsg) => {
        let threw = false;
        let errObj = null;
        try {
          await actual;
        } catch (err) {
          threw = true;
          errObj = err;
        }
        if (!threw) {
          throw new Error(`Expected async operation to reject, but it resolved`);
        }
        if (expectedMsg && !errObj.message.includes(expectedMsg)) {
          throw new Error(`Expected rejection message to include "${expectedMsg}", but got "${errObj.message}"`);
        }
      }
    }
  };
};

// Main Runner Execution
async function runAllTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   NEUROSCAN AI: AUTOMATED CLINICAL WORKFLOW & SERVICE TEST SUITE     ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  const testFiles = [
    '../services/__tests__/visit.service.test.js',
    '../services/__tests__/hospitalBed.service.test.js',
    '../services/__tests__/imaging.service.test.js',
    './tenancy_and_transaction.test.js',
    './clinical_workflow_e2e.test.js'
  ];

  const startTime = Date.now();

  for (const file of testFiles) {
    // Reset per-file suites collection
    suites.length = 0;
    
    // Import file to trigger describe blocks
    await import(file);

    for (const suite of suites) {
      totalSuites++;
      currentSuite = suite;
      console.log(`\n${colors.bold}RUNNING SUITE:${colors.reset} ${suite.name}`);

      // Run suite registration
      await suite.fn();

      // Execute beforeAll
      for (const beforeFn of suite.beforeAllFns) {
        await beforeFn();
      }

      let suitePassed = true;

      for (const t of suite.tests) {
        totalTests++;
        const testStart = Date.now();
        try {
          await t.fn();
          const duration = Date.now() - testStart;
          console.log(`  ${colors.green}✔ PASS${colors.reset} ${t.name} ${colors.dim}(${duration}ms)${colors.reset}`);
          passedTests++;
        } catch (err) {
          suitePassed = false;
          failedTests++;
          console.log(`  ${colors.red}✖ FAIL${colors.reset} ${t.name}`);
          console.log(`    ${colors.red}Error:${colors.reset} ${err.message}`);
          if (err.stack) {
            console.log(`    ${colors.dim}${err.stack.split('\n').slice(1, 4).join('\n    ')}${colors.reset}`);
          }
        }
      }

      // Execute afterAll
      for (const afterFn of suite.afterAllFns) {
        try {
          await afterFn();
        } catch (err) {
          console.error("Error in afterAll:", err.message);
        }
      }

      if (suitePassed) {
        passedSuites++;
      }
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}SUMMARY REPORT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`Suites: ${passedSuites === totalSuites ? colors.green : colors.yellow}${passedSuites}/${totalSuites} passed${colors.reset}`);
  console.log(`Tests:  ${failedTests === 0 ? colors.green : colors.red}${passedTests}/${totalTests} passed${colors.reset} ${failedTests > 0 ? `(${failedTests} failed)` : ''}`);
  console.log(`Duration: ${totalDuration}s`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error("FATAL RUNNER ERROR:", err);
  process.exit(1);
});
