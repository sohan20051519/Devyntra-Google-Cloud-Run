#!/usr/bin/env node

/**
 * Test script for DevYntra GitHub Secrets Auto-Injection
 * 
 * This script demonstrates how to use the automatic secrets injection
 * through the Firebase API function.
 */

const axios = require('axios');

// Configuration
const API_URL = 'https://api-mcwd6yzjia-uc.a.run.app';
const TEST_CONFIG = {
  // Replace with your actual values for testing
  githubToken: 'your-github-token-here',
  repoOwner: 'your-username',
  repoName: 'your-repo-name',
  firebaseToken: 'your-firebase-auth-token'
};

/**
 * Test the secrets injection API
 */
async function testSecretsInjection() {
  console.log('🧪 Testing DevYntra GitHub Secrets Auto-Injection');
  console.log('================================================\n');

  try {
    // Test 1: Inject secrets only
    console.log('Test 1: Injecting secrets only...');
    const injectResponse = await axios.post(`${API_URL}`, {
      action: 'inject_secrets',
      repoOwner: TEST_CONFIG.repoOwner,
      repoName: TEST_CONFIG.repoName,
      githubToken: TEST_CONFIG.githubToken
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.firebaseToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Secrets injection response:', injectResponse.data);

    // Test 2: Deploy with automatic secrets injection
    console.log('\nTest 2: Deploying with automatic secrets injection...');
    const deployResponse = await axios.post(`${API_URL}`, {
      action: 'deploy',
      repoId: 'test-repo-id',
      repoOwner: TEST_CONFIG.repoOwner,
      repoName: TEST_CONFIG.repoName,
      githubToken: TEST_CONFIG.githubToken
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.firebaseToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Deploy response:', deployResponse.data);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

/**
 * Test the CLI script
 */
async function testCLIScript() {
  console.log('\n🖥️  Testing CLI Script');
  console.log('=====================\n');

  console.log('To test the CLI script, run:');
  console.log('cd scripts');
  console.log('npm install');
  console.log('node inject-secrets-cli.js');
  console.log('\nOr with arguments:');
  console.log('node inject-secrets-cli.js <github-token> <repo-owner> <repo-name>');
}

/**
 * Show usage examples
 */
function showUsageExamples() {
  console.log('\n📚 Usage Examples');
  console.log('=================\n');

  console.log('1. Using the API directly:');
  console.log(`
const response = await fetch('${API_URL}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_FIREBASE_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'inject_secrets',
    repoOwner: 'username',
    repoName: 'repository-name',
    githubToken: 'ghp_xxxxxxxxxxxx'
  })
});

const result = await response.json();
console.log(result);
`);

  console.log('2. Using the CLI script:');
  console.log(`
# Interactive mode
cd scripts
node inject-secrets-cli.js

# Command line arguments
node inject-secrets-cli.js ghp_xxxxxxxxxxxx username repo-name
`);

  console.log('3. Required GitHub Token Permissions:');
  console.log(`
- repo (Full control of private repositories)
- workflow (Update GitHub Action workflows)
- write:packages (Write packages to GitHub Package Registry)
- admin:org (if repository belongs to an organization)
`);
}

// Main execution
if (require.main === module) {
  console.log('🔐 DevYntra GitHub Secrets Auto-Injection Test');
  console.log('==============================================\n');

  // Check if test configuration is provided
  if (TEST_CONFIG.githubToken === 'your-github-token-here') {
    console.log('⚠️  Please update the TEST_CONFIG in this file with your actual values:');
    console.log('- githubToken: Your GitHub Personal Access Token');
    console.log('- repoOwner: Repository owner (username or org)');
    console.log('- repoName: Repository name');
    console.log('- firebaseToken: Your Firebase authentication token\n');
    
    showUsageExamples();
    testCLIScript();
  } else {
    testSecretsInjection();
  }
}

module.exports = {
  testSecretsInjection,
  testCLIScript,
  showUsageExamples
};
