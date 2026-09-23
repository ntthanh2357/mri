import { validatePathConfig, getStateFromPath, getPathFromState } from '@react-navigation/core';
import { linkingConfig } from '../navigation/linking.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('======================================================================');
console.log('   NEUROSCAN AI: BROWSER HISTORY & NAVIGATION LINKING TEST SUITE      ');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${message}`);
  } else {
    console.error(`  ✘ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// SUITE 1: Validation of Path Configuration
console.log('SUITE 1: Validation of Linking Configuration Structure');
try {
  validatePathConfig(linkingConfig.config);
  assert(true, 'linkingConfig schema passes @react-navigation/core validatePathConfig');
} catch (err) {
  assert(false, `validatePathConfig threw error: ${err.message}`);
}

assert(Array.isArray(linkingConfig.prefixes) && linkingConfig.prefixes.includes('/'), 'linkingConfig includes "/" in prefixes');
assert(typeof linkingConfig.config.screens === 'object', 'linkingConfig defines screens mapping object');

// SUITE 2: Verification with AppNavigator Screens
console.log('\nSUITE 2: Synchronization with AppNavigator.js Screens');
const appNavPath = path.resolve(__dirname, '../navigation/AppNavigator.js');
const appNavContent = fs.readFileSync(appNavPath, 'utf8');

// Extract all <Stack.Screen name="..." matches
const screenRegex = /<Stack\.Screen\s+name=["']([^"']+)["']/g;
const foundScreens = [];
let match;
while ((match = screenRegex.exec(appNavContent)) !== null) {
  foundScreens.push(match[1]);
}

assert(foundScreens.length >= 25, `Extracted ${foundScreens.length} screens from AppNavigator.js`);

foundScreens.forEach(screenName => {
  const isDefined = Object.prototype.hasOwnProperty.call(linkingConfig.config.screens, screenName);
  assert(isDefined, `Screen "${screenName}" is mapped in linkingConfig.config.screens`);
});

// SUITE 3: URL Serialization & Deserialization (Bidirectional Navigation)
console.log('\nSUITE 3: Bidirectional URL and Route State Conversion');

// Welcome screen should map to root /
const welcomePath = getPathFromState({ routes: [{ name: 'Welcome' }] }, linkingConfig.config);
assert(welcomePath === '/', `Welcome screen serializes to "/" (got: "${welcomePath}")`);
const welcomeState = getStateFromPath('/', linkingConfig.config);
assert(welcomeState?.routes[0]?.name === 'Welcome', 'Root path "/" deserializes to Welcome route');

// ClinicDashboard screen
const clinicPath = getPathFromState({ routes: [{ name: 'ClinicDashboard' }] }, linkingConfig.config);
assert(clinicPath === '/clinic-dashboard', `ClinicDashboard serializes to "/clinic-dashboard" (got: "${clinicPath}")`);
const clinicState = getStateFromPath('/clinic-dashboard', linkingConfig.config);
assert(clinicState?.routes[0]?.name === 'ClinicDashboard', '"/clinic-dashboard" deserializes to ClinicDashboard route');

// CreateImagingResult screen
const createImgPath = getPathFromState({ routes: [{ name: 'CreateImagingResult' }] }, linkingConfig.config);
assert(createImgPath === '/create-imaging-result', `CreateImagingResult serializes to "/create-imaging-result" (got: "${createImgPath}")`);
const createImgState = getStateFromPath('/create-imaging-result', linkingConfig.config);
assert(createImgState?.routes[0]?.name === 'CreateImagingResult', '"/create-imaging-result" deserializes to CreateImagingResult route');

// Stack depth serialization for browser history back navigation
const stackedState = {
  index: 1,
  routes: [
    { name: 'ClinicDashboard' },
    { name: 'CreateImagingResult' }
  ]
};
const stackedPath = getPathFromState(stackedState, linkingConfig.config);
assert(stackedPath === '/create-imaging-result', `Active stacked route index 1 serializes to active screen path: "${stackedPath}"`);

// Param preservation for screens with query params (e.g., DoctorWorkQueue?tab=mriQueue)
const queueState = {
  routes: [{ name: 'DoctorWorkQueue', params: { tab: 'mriQueue' } }]
};
const queuePath = getPathFromState(queueState, linkingConfig.config);
assert(queuePath === '/doctor-work-queue?tab=mriQueue', `Params serialize to query string: "${queuePath}"`);
const parsedQueue = getStateFromPath(queuePath, linkingConfig.config);
assert(parsedQueue?.routes[0]?.params?.tab === 'mriQueue', 'Query string parses back into route params accurately');

console.log('\n======================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('======================================================================\n');
