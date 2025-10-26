#!/usr/bin/env node

const { autoInjectSecrets } = require('./auto-inject-secrets');
const readline = require('readline');

// Configuration
const CONFIG = {
  projectId: 'devyntra-500e4',
  webhookUrl: 'https://api-mcwd6yzjia-uc.a.run.app/webhook'
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Main function
async function main() {
  console.log('🔐 DevYntra GitHub Secrets Auto-Injection Tool');
  console.log('===============================================\n');
  
  try {
    // Get user input
    const githubToken = await askQuestion('Enter your GitHub Personal Access Token: ');
    const repoOwner = await askQuestion('Enter repository owner (username or org): ');
    const repoName = await askQuestion('Enter repository name: ');
    
    if (!githubToken || !repoOwner || !repoName) {
      console.error('❌ All fields are required!');
      process.exit(1);
    }
    
    console.log('\n🚀 Starting automatic secrets injection...\n');
    
    // Inject secrets
    const result = await autoInjectSecrets(
      githubToken,
      repoOwner,
      repoName,
      CONFIG.projectId,
      CONFIG.webhookUrl
    );
    
    if (result.success) {
      console.log('\n✅ SUCCESS! All secrets have been injected successfully.');
      console.log('\n📋 Injected Secrets:');
      Object.entries(result.results).forEach(([name, status]) => {
        const icon = status === 'success' ? '✅' : '❌';
        console.log(`  ${icon} ${name}: ${status}`);
      });
      
      console.log('\n🎉 Your repository is now ready for DevYntra deployment!');
      console.log('\nNext steps:');
      console.log('1. Push your code to trigger the GitHub Actions workflow');
      console.log('2. Monitor the deployment progress in your repository\'s Actions tab');
      console.log('3. Check the DevYntra dashboard for deployment status');
      
    } else {
      console.error('\n❌ FAILED to inject secrets!');
      console.error('Error:', result.error);
      console.error('Details:', result.details);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ An error occurred:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle command line arguments
if (process.argv.length >= 5) {
  const [, , githubToken, repoOwner, repoName] = process.argv;
  
  console.log('🔐 DevYntra GitHub Secrets Auto-Injection Tool');
  console.log('===============================================\n');
  console.log(`Repository: ${repoOwner}/${repoName}\n`);
  
  autoInjectSecrets(githubToken, repoOwner, repoName, CONFIG.projectId, CONFIG.webhookUrl)
    .then(result => {
      if (result.success) {
        console.log('✅ SUCCESS! All secrets have been injected successfully.');
        console.log('\n📋 Injected Secrets:');
        Object.entries(result.results).forEach(([name, status]) => {
          const icon = status === 'success' ? '✅' : '❌';
          console.log(`  ${icon} ${name}: ${status}`);
        });
      } else {
        console.error('❌ FAILED to inject secrets!');
        console.error('Error:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ An error occurred:', error.message);
      process.exit(1);
    });
} else {
  // Interactive mode
  main().catch(error => {
    console.error('❌ An error occurred:', error.message);
    process.exit(1);
  });
}
