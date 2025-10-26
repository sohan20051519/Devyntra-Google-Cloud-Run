const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');
const sodium = require('tweetnacl');

/**
 * Automatically injects all required secrets into a GitHub repository
 * @param {string} githubToken - User's GitHub personal access token
 * @param {string} repoOwner - Repository owner (username or org)
 * @param {string} repoName - Repository name
 * @param {string} projectId - Firebase project ID
 * @param {string} webhookUrl - DevYntra webhook URL
 * @returns {Promise<Object>} - Result of secrets injection
 */
async function autoInjectSecrets(githubToken, repoOwner, repoName, projectId, webhookUrl) {
  const octokit = new Octokit({ auth: githubToken });
  
  try {
    console.log(`Starting automatic secrets injection for ${repoOwner}/${repoName}`);
    
    // Validate GitHub token and repository access
    await validateAccess(octokit, repoOwner, repoName);
    
    // Get repository public key for encryption
    const publicKey = await getRepositoryPublicKey(octokit, repoOwner, repoName);
    
    // Prepare all required secrets
    const secrets = await prepareSecrets(projectId, webhookUrl);
    
    // Inject all secrets
    const results = await injectSecrets(octokit, repoOwner, repoName, publicKey, secrets);
    
    console.log('All secrets injected successfully:', results);
    return {
      success: true,
      message: 'All required secrets have been automatically injected',
      injectedSecrets: Object.keys(results),
      results
    };
    
  } catch (error) {
    console.error('Error injecting secrets:', error);
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
}

/**
 * Validates GitHub token and repository access
 */
async function validateAccess(octokit, repoOwner, repoName) {
  try {
    // Test GitHub token
    await octokit.users.getAuthenticated();
    console.log('GitHub token validated successfully');
    
    // Test repository access
    const repo = await octokit.repos.get({
      owner: repoOwner,
      repo: repoName
    });
    console.log(`Repository access confirmed: ${repo.data.full_name}`);
    
    // Check if Actions are enabled
    try {
      await octokit.rest.actions.getRepoAccess({
        owner: repoOwner,
        repo: repoName
      });
      console.log('GitHub Actions access confirmed');
    } catch (actionsError) {
      console.warn('GitHub Actions may not be disabled:', actionsError.message);
      // Don't fail here, we'll try to set secrets anyway
    }
    
  } catch (error) {
    if (error.status === 404) {
      throw new Error('Repository not found or access denied');
    } else if (error.status === 403) {
      throw new Error('Insufficient permissions. Please ensure the token has admin access to the repository.');
    } else {
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }
}

/**
 * Gets the repository's public key for encryption
 */
async function getRepositoryPublicKey(octokit, repoOwner, repoName) {
  try {
    const response = await octokit.rest.actions.getRepoPublicKey({
      owner: repoOwner,
      repo: repoName,
    });
    
    console.log('Repository public key obtained:', response.data.key_id);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get repository public key: ${error.message}`);
  }
}

/**
 * Prepares all required secrets with proper values
 */
async function prepareSecrets(projectId, webhookUrl) {
  // Get Firebase service account key from environment
  const serviceAccountKey = process.env.GCP_SA_KEY ? JSON.parse(process.env.GCP_SA_KEY) : null;
  
  if (!serviceAccountKey) {
    throw new Error('GCP_SA_KEY environment variable not set');
  }
  
  return {
    // Firebase/Google Cloud secrets
    FIREBASE_PROJECT_ID: projectId,
    GCP_SA_KEY: JSON.stringify(serviceAccountKey),
    GCP_PROJECT_ID: projectId,
    
    // DevYntra specific secrets
    DEVYNTRA_WEBHOOK_URL: webhookUrl,
    DEVYNTRA_PROJECT_ID: projectId,
    
    // GitHub Actions secrets
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || 'auto-generated',
    
    // Additional useful secrets
    NODE_ENV: 'production',
    DEPLOYMENT_ENV: 'production'
  };
}

/**
 * Encrypts and injects all secrets into the repository
 */
async function injectSecrets(octokit, repoOwner, repoName, publicKey, secrets) {
  const results = {};
  const key = Buffer.from(publicKey.key, 'base64');
  
  for (const [secretName, secretValue] of Object.entries(secrets)) {
    try {
      console.log(`Encrypting and setting secret: ${secretName}`);
      
      // Encrypt the secret value
      const encryptedValue = encryptSecret(secretValue, key);
      
      // Set the secret
      await octokit.rest.actions.createOrUpdateRepoSecret({
        owner: repoOwner,
        repo: repoName,
        secret_name: secretName,
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id,
      });
      
      results[secretName] = 'success';
      console.log(`✅ Secret ${secretName} set successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to set secret ${secretName}:`, error.message);
      results[secretName] = `failed: ${error.message}`;
    }
  }
  
  return results;
}

/**
 * Encrypts a secret value using the repository's public key
 */
function encryptSecret(value, key) {
  const valueBuffer = Buffer.from(value, 'utf8');
  const nonce = crypto.randomBytes(24);
  const encrypted = sodium.secretbox(valueBuffer, nonce, key);
  return Buffer.concat([nonce, encrypted]).toString('base64');
}

/**
 * Checks which secrets are already set in the repository
 */
async function checkExistingSecrets(octokit, repoOwner, repoName) {
  try {
    const response = await octokit.rest.actions.listRepoSecrets({
      owner: repoOwner,
      repo: repoName,
    });
    
    return response.data.secrets.map(secret => secret.name);
  } catch (error) {
    console.warn('Could not check existing secrets:', error.message);
    return [];
  }
}

/**
 * Updates existing secrets or creates new ones
 */
async function updateOrCreateSecrets(octokit, repoOwner, repoName, publicKey, secrets) {
  const existingSecrets = await checkExistingSecrets(octokit, repoOwner, repoName);
  const results = {};
  
  for (const [secretName, secretValue] of Object.entries(secrets)) {
    try {
      const isUpdate = existingSecrets.includes(secretName);
      console.log(`${isUpdate ? 'Updating' : 'Creating'} secret: ${secretName}`);
      
      const encryptedValue = encryptSecret(secretValue, key);
      
      await octokit.rest.actions.createOrUpdateRepoSecret({
        owner: repoOwner,
        repo: repoName,
        secret_name: secretName,
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id,
      });
      
      results[secretName] = isUpdate ? 'updated' : 'created';
      console.log(`✅ Secret ${secretName} ${isUpdate ? 'updated' : 'created'} successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to ${isUpdate ? 'update' : 'create'} secret ${secretName}:`, error.message);
      results[secretName] = `failed: ${error.message}`;
    }
  }
  
  return results;
}

module.exports = {
  autoInjectSecrets,
  validateAccess,
  getRepositoryPublicKey,
  prepareSecrets,
  injectSecrets,
  checkExistingSecrets,
  updateOrCreateSecrets
};
