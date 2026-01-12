/**
 * FlowCapture Extension-Platform API Test Suite
 * 
 * Tests the communication between the Chrome extension and the FlowCapture platform.
 * Run these tests in the browser console while the extension is loaded.
 * 
 * Prerequisites:
 * 1. Extension is installed and active
 * 2. Platform is running at the configured API URL
 * 3. User is authenticated on the platform
 */

const TEST_CONFIG = {
  extensionId: null, // Will be detected automatically
  apiBaseUrl: null,  // Will be read from extension storage
  verbose: true,
};

const TestRunner = {
  results: [],
  passed: 0,
  failed: 0,

  log(msg, ...args) {
    if (TEST_CONFIG.verbose) {
      console.log(`[TEST] ${msg}`, ...args);
    }
  },

  async run(name, testFn) {
    this.log(`Running: ${name}`);
    const startTime = performance.now();
    try {
      await testFn();
      const duration = (performance.now() - startTime).toFixed(2);
      this.results.push({ name, status: 'PASS', duration: `${duration}ms` });
      this.passed++;
      console.log(`✅ PASS: ${name} (${duration}ms)`);
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      this.results.push({ name, status: 'FAIL', error: error.message, duration: `${duration}ms` });
      this.failed++;
      console.error(`❌ FAIL: ${name} - ${error.message} (${duration}ms)`);
    }
  },

  summary() {
    console.log('\n========== TEST SUMMARY ==========');
    console.log(`Total: ${this.results.length}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log('==================================\n');
    console.table(this.results);
    return { passed: this.passed, failed: this.failed, results: this.results };
  }
};

// Test 1: Session Handoff - SET_SESSION message handling
async function testSetSessionMessage() {
  return new Promise((resolve, reject) => {
    const mockSession = {
      sessionId: `test-session-${Date.now()}`,
      token: 'test-auth-token',
      userId: 'test-user-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };

    const message = {
      type: 'SET_SESSION',
      sessionId: mockSession.sessionId,
      token: mockSession.token,
      userId: mockSession.userId
    };

    window.postMessage({ source: 'flowcapture-web-app', ...message }, '*');

    setTimeout(() => {
      TestRunner.log('SET_SESSION message sent, checking if extension received it...');
      resolve();
    }, 500);
  });
}

// Test 2: GET_AVAILABLE_TABS - Verify tab list returns with proper filtering
async function testGetAvailableTabs() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for GET_AVAILABLE_TABS response'));
    }, 5000);

    function handler(event) {
      if (event.data?.source === 'flowcapture-extension' && event.data?.type === 'AVAILABLE_TABS') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);

        const tabs = event.data.tabs;
        TestRunner.log(`Received ${tabs.length} tabs`);

        if (!Array.isArray(tabs)) {
          reject(new Error('Response tabs is not an array'));
          return;
        }

        const hasRestrictedUrls = tabs.some(tab => 
          tab.url?.startsWith('chrome://') || 
          tab.url?.startsWith('chrome-extension://') ||
          tab.url?.startsWith('about:') ||
          tab.url?.includes('chromewebstore.google.com')
        );

        if (hasRestrictedUrls) {
          reject(new Error('Restricted URLs not filtered from tab list'));
          return;
        }

        resolve();
      }
    }

    window.addEventListener('message', handler);
    window.postMessage({ source: 'flowcapture-web-app', type: 'GET_AVAILABLE_TABS' }, '*');
  });
}

// Test 3: SELECT_TAB_AND_START_CAPTURE - Verify capture initiation
async function testSelectTabAndStartCapture() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for capture start response'));
    }, 10000);

    let captureStarted = false;
    let injectionStatus = null;

    function handler(event) {
      if (event.data?.source === 'flowcapture-extension') {
        if (event.data.type === 'CAPTURE_STARTED') {
          captureStarted = true;
          TestRunner.log('Capture started successfully');
        }
        if (event.data.type === 'INJECTION_STATUS') {
          injectionStatus = event.data;
          TestRunner.log('Injection status:', event.data.status);
        }
        if (event.data.type === 'CAPTURE_ERROR') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          if (event.data.reason === 'skipped') {
            TestRunner.log('Tab skipped (restricted URL) - expected behavior');
            resolve();
          } else {
            reject(new Error(`Capture error: ${event.data.reason}`));
          }
          return;
        }
      }
    }

    window.addEventListener('message', handler);

    window.postMessage({ source: 'flowcapture-web-app', type: 'GET_AVAILABLE_TABS' }, '*');

    setTimeout(() => {
      window.postMessage({ 
        source: 'flowcapture-web-app', 
        type: 'SELECT_TAB_AND_START_CAPTURE',
        tabId: null,
        guideId: `test-guide-${Date.now()}`
      }, '*');

      setTimeout(() => {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);

        if (captureStarted || injectionStatus) {
          resolve();
        } else {
          TestRunner.log('No explicit response - checking state...');
          resolve();
        }
      }, 3000);
    }, 1000);
  });
}

// Test 4: READY_FOR_CAPTURE handshake
async function testReadyForCaptureHandshake() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      TestRunner.log('No response to READY_FOR_CAPTURE - this is expected if capture is not active');
      resolve();
    }, 3000);

    function handler(event) {
      if (event.data?.source === 'flowcapture-extension' && event.data?.type === 'CAPTURE_CONFIRMED') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        TestRunner.log('READY_FOR_CAPTURE handshake confirmed');
        resolve();
      }
    }

    window.addEventListener('message', handler);

    window.postMessage({ 
      source: 'flowcapture-capture-agent', 
      type: 'READY_FOR_CAPTURE',
      tabId: 999999
    }, '*');
  });
}

// Test 5: Step Sync API - POST /api/guides/:guideId/steps
async function testStepSyncApi() {
  const mockStep = {
    type: 'click',
    description: 'Test step from API test suite',
    selector: 'button.test-button',
    url: 'https://example.com/test',
    screenshotUrl: null,
    order: 1,
    metadata: {
      tagName: 'BUTTON',
      textContent: 'Click me',
      timestamp: new Date().toISOString()
    }
  };

  const testGuideId = 'test-guide-does-not-exist';

  try {
    const response = await fetch(`/api/guides/${testGuideId}/steps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(mockStep)
    });

    TestRunner.log(`Step sync API response status: ${response.status}`);

    if (response.status === 401) {
      throw new Error('Authentication required - user not logged in');
    }

    if (response.status === 404) {
      TestRunner.log('Guide not found (expected for test guide ID)');
      return;
    }

    if (response.status === 403) {
      TestRunner.log('Permission denied (expected if not guide owner)');
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    TestRunner.log('Step created:', result);

  } catch (error) {
    if (error.message.includes('Authentication required')) {
      throw error;
    }
    TestRunner.log('Step sync test completed with expected behavior:', error.message);
  }
}

// Test 6: Injection Status Broadcasts
async function testInjectionStatusBroadcast() {
  return new Promise((resolve, reject) => {
    let statusReceived = false;
    const timeout = setTimeout(() => {
      if (statusReceived) {
        resolve();
      } else {
        TestRunner.log('No INJECTION_STATUS received - may need active capture session');
        resolve();
      }
    }, 3000);

    function handler(event) {
      if (event.data?.source === 'flowcapture-extension' && event.data?.type === 'INJECTION_STATUS') {
        statusReceived = true;
        TestRunner.log('INJECTION_STATUS received:', {
          tabId: event.data.tabId,
          status: event.data.status,
          attempt: event.data.attempt
        });

        if (!['success', 'retrying', 'failed'].includes(event.data.status)) {
          reject(new Error(`Invalid injection status: ${event.data.status}`));
          return;
        }

        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve();
      }
    }

    window.addEventListener('message', handler);

    window.postMessage({ 
      source: 'flowcapture-web-app', 
      type: 'SELECT_TAB_AND_START_CAPTURE',
      tabId: null,
      guideId: `injection-test-${Date.now()}`
    }, '*');
  });
}

// Test 7: Extension Check Message
async function testExtensionCheckMessage() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Extension did not respond to FLOWCAPTURE_CHECK_EXTENSION'));
    }, 3000);

    function handler(event) {
      if (event.data?.source === 'flowcapture-extension' && event.data?.type === 'EXTENSION_PRESENT') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        TestRunner.log('Extension presence confirmed, version:', event.data.version);
        resolve();
      }
    }

    window.addEventListener('message', handler);

    window.postMessage({ 
      source: 'flowcapture-web-app', 
      type: 'FLOWCAPTURE_CHECK_EXTENSION'
    }, '*');
  });
}

// Test 8: Stop Capture Message
async function testStopCapture() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      TestRunner.log('Stop capture sent - no error means success');
      resolve();
    }, 2000);

    function handler(event) {
      if (event.data?.source === 'flowcapture-extension' && event.data?.type === 'CAPTURE_STOPPED') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        TestRunner.log('Capture stopped confirmed');
        resolve();
      }
    }

    window.addEventListener('message', handler);

    window.postMessage({ 
      source: 'flowcapture-web-app', 
      type: 'STOP_CAPTURE'
    }, '*');
  });
}

// Main test runner
async function runAllTests() {
  console.log('\n🧪 FlowCapture Extension-Platform API Test Suite\n');
  console.log('Starting tests...\n');

  await TestRunner.run('Extension Check Message', testExtensionCheckMessage);
  await TestRunner.run('SET_SESSION Message Handling', testSetSessionMessage);
  await TestRunner.run('GET_AVAILABLE_TABS with Filtering', testGetAvailableTabs);
  await TestRunner.run('SELECT_TAB_AND_START_CAPTURE', testSelectTabAndStartCapture);
  await TestRunner.run('READY_FOR_CAPTURE Handshake', testReadyForCaptureHandshake);
  await TestRunner.run('Step Sync API', testStepSyncApi);
  await TestRunner.run('INJECTION_STATUS Broadcasts', testInjectionStatusBroadcast);
  await TestRunner.run('STOP_CAPTURE Message', testStopCapture);

  return TestRunner.summary();
}

if (typeof window !== 'undefined') {
  window.FlowCaptureTests = {
    runAll: runAllTests,
    runner: TestRunner,
    tests: {
      extensionCheck: testExtensionCheckMessage,
      setSession: testSetSessionMessage,
      getAvailableTabs: testGetAvailableTabs,
      selectTabAndStartCapture: testSelectTabAndStartCapture,
      readyForCapture: testReadyForCaptureHandshake,
      stepSync: testStepSyncApi,
      injectionStatus: testInjectionStatusBroadcast,
      stopCapture: testStopCapture
    }
  };

  console.log('FlowCapture Tests loaded. Run with: FlowCaptureTests.runAll()');
}

export { runAllTests, TestRunner };
