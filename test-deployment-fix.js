#!/usr/bin/env node

/**
 * Test script to verify the deployment fix
 * 
 * This script tests the updated deployment endpoint to ensure
 * the frontend can successfully call the new deploy function.
 */

const axios = require('axios');

// Configuration
const DEPLOY_URL = 'https://us-central1-devyntra-500e4.cloudfunctions.net/deploy';

const TEST_CONFIG = {
  // Replace with your actual values for testing
  firebaseToken: 'your-firebase-auth-token',
  githubToken: 'your-github-token-here',
  repoOwner: 'your-username',
  repoName: 'your-repo-name',
  repoId: 'test-repo-id'
};

/**
 * Test the deployment endpoint
 */
async function testDeploymentEndpoint() {
  console.log('🧪 Testing Updated Deployment Endpoint');
  console.log('=====================================\n');

  try {
    console.log('Testing deployment endpoint...');
    console.log('URL:', DEPLOY_URL);
    console.log('Method: POST');
    console.log('Headers:');
    console.log('  Authorization: Bearer <firebase-token>');
    console.log('  Content-Type: application/json');
    console.log('Body:');
    console.log('  {');
    console.log('    "repoId": "test-repo-id",');
    console.log('    "repoOwner": "username",');
    console.log('    "repoName": "repo-name",');
    console.log('    "githubToken": "ghp_xxxxxxxxxxxx"');
    console.log('  }\n');

    // Test with actual values if provided
    if (TEST_CONFIG.firebaseToken !== 'your-firebase-auth-token') {
      console.log('Running actual test...');
      
      const response = await axios.post(DEPLOY_URL, {
        repoId: TEST_CONFIG.repoId,
        repoOwner: TEST_CONFIG.repoOwner,
        repoName: TEST_CONFIG.repoName,
        githubToken: TEST_CONFIG.githubToken
      }, {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.firebaseToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Deployment test successful!');
      console.log('Response:', response.data);
    } else {
      console.log('⚠️  Please update TEST_CONFIG with your actual values to run the test.');
      console.log('Required values:');
      console.log('- firebaseToken: Your Firebase authentication token');
      console.log('- githubToken: Your GitHub Personal Access Token');
      console.log('- repoOwner: Repository owner (username or org)');
      console.log('- repoName: Repository name');
      console.log('- repoId: Repository ID');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 This might be an authentication issue. Make sure:');
      console.log('1. Your Firebase token is valid');
      console.log('2. You are logged in to the application');
      console.log('3. Your GitHub token has the required permissions');
    } else if (error.response?.status === 400) {
      console.log('\n💡 This might be a parameter issue. Make sure:');
      console.log('1. All required parameters are provided');
      console.log('2. The repository exists and is accessible');
      console.log('3. The GitHub token is valid');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('\n💡 This might be a network issue. Make sure:');
      console.log('1. You have internet connectivity');
      console.log('2. The Firebase function URL is correct');
      console.log('3. The Firebase function is deployed and running');
    }
  }
}

/**
 * Show the complete workflow
 */
function showCompleteWorkflow() {
  console.log('\n📊 Complete Deployment Workflow');
  console.log('===============================\n');
  
  console.log('1. 🔐 Inject Secrets');
  console.log('   - FIREBASE_PROJECT_ID');
  console.log('   - GCP_SA_KEY');
  console.log('   - DEVYNTRA_WEBHOOK_URL');
  console.log('   - GITHUB_TOKEN');
  console.log('   - NODE_ENV');
  console.log('   - DEPLOYMENT_ENV');
  console.log('');
  
  console.log('2. 🔍 Detect Language & Framework');
  console.log('   - Analyze repository languages');
  console.log('   - Detect framework from config files');
  console.log('   - Support: JavaScript, Python, Go, Java, Rust');
  console.log('   - Frameworks: React, Next.js, Vue, Angular, Django, Flask, etc.');
  console.log('');
  
  console.log('3. 🔬 Analyze Codebase');
  console.log('   - Run language-specific analysis tools');
  console.log('   - ESLint, TypeScript, Pylint, Go vet, etc.');
  console.log('   - Generate analysis report');
  console.log('');
  
  console.log('4. 🤖 Fix Errors (if needed)');
  console.log('   - Send to Jules AI for automatic fixing');
  console.log('   - Create pull request with fixes');
  console.log('   - Auto-merge changes to main branch');
  console.log('   - Skip if no errors found');
  console.log('');
  
  console.log('5. ⚙️ Setup CI/CD Pipeline');
  console.log('   - Create GitHub Actions workflow');
  console.log('   - Authenticate with Google Cloud');
  console.log('   - Install dependencies');
  console.log('   - Create Docker image');
  console.log('   - Deploy to Google Cloud Run');
  console.log('');
  
  console.log('6. 🚀 Deploy to Google Cloud Run');
  console.log('   - Build and push Docker image');
  console.log('   - Deploy to Cloud Run');
  console.log('   - Provide deployment URL');
  console.log('');
}

/**
 * Show troubleshooting tips
 */
function showTroubleshootingTips() {
  console.log('\n🔧 Troubleshooting Tips');
  console.log('=======================\n');
  
  console.log('Common Issues and Solutions:');
  console.log('');
  console.log('1. CORS Error:');
  console.log('   - Make sure you are calling the correct endpoint');
  console.log('   - Check that the Firebase function is deployed');
  console.log('   - Verify the function URL is correct');
  console.log('');
  
  console.log('2. Authentication Error (401):');
  console.log('   - Ensure you are logged in to the application');
  console.log('   - Check that your Firebase token is valid');
  console.log('   - Try logging out and logging back in');
  console.log('');
  
  console.log('3. GitHub Token Error:');
  console.log('   - Make sure you have connected your GitHub account');
  console.log('   - Check that your GitHub token has the required permissions');
  console.log('   - Try re-authenticating with GitHub');
  console.log('');
  
  console.log('4. Repository Access Error:');
  console.log('   - Ensure the repository exists and is accessible');
  console.log('   - Check that you have admin access to the repository');
  console.log('   - Verify the repository owner and name are correct');
  console.log('');
  
  console.log('5. Deployment Status Issues:');
  console.log('   - Check the Firebase Console for function logs');
  console.log('   - Monitor the deployment status in real-time');
  console.log('   - Check GitHub Actions for workflow status');
  console.log('');
}

// Main execution
if (require.main === module) {
  console.log('🔐 DevYntra Deployment Fix Test');
  console.log('===============================\n');

  testDeploymentEndpoint();
  showCompleteWorkflow();
  showTroubleshootingTips();
}

module.exports = {
  testDeploymentEndpoint,
  showCompleteWorkflow,
  showTroubleshootingTips
};
