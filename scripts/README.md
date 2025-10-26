# DevYntra GitHub Secrets Auto-Injection

This tool automatically injects all required secrets into GitHub repositories for DevYntra deployment.

## Features

- 🔐 **Automatic Secrets Injection**: Automatically sets up all required GitHub secrets
- 🔒 **Secure Encryption**: Uses GitHub's public key encryption for all secrets
- ✅ **Validation**: Validates GitHub token and repository access before injection
- 📋 **Comprehensive**: Sets up all necessary secrets for Firebase, Google Cloud, and DevYntra
- 🚀 **Easy to Use**: Simple CLI interface or API integration

## Required Secrets

The tool automatically injects the following secrets:

### Firebase/Google Cloud
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `GCP_SA_KEY` - Google Cloud Service Account key (JSON)
- `GCP_PROJECT_ID` - Google Cloud project ID

### DevYntra Specific
- `DEVYNTRA_WEBHOOK_URL` - Webhook URL for DevYntra notifications
- `DEVYNTRA_PROJECT_ID` - DevYntra project ID

### GitHub Actions
- `GITHUB_TOKEN` - GitHub token for Actions
- `NODE_ENV` - Node.js environment
- `DEPLOYMENT_ENV` - Deployment environment

## Installation

1. Navigate to the scripts directory:
```bash
cd scripts
```

2. Install dependencies:
```bash
npm install
```

## Usage

### CLI Mode (Interactive)

Run the script without arguments for interactive mode:

```bash
node inject-secrets-cli.js
```

The script will prompt you for:
- GitHub Personal Access Token
- Repository owner (username or organization)
- Repository name

### CLI Mode (Command Line Arguments)

Run the script with arguments:

```bash
node inject-secrets-cli.js <github-token> <repo-owner> <repo-name>
```

Example:
```bash
node inject-secrets-cli.js ghp_xxxxxxxxxxxx username my-repo
```

### API Integration

You can also use the functions directly in your code:

```javascript
const { autoInjectSecrets } = require('./auto-inject-secrets');

const result = await autoInjectSecrets(
  'your-github-token',
  'repo-owner',
  'repo-name',
  'firebase-project-id',
  'webhook-url'
);

if (result.success) {
  console.log('Secrets injected successfully!');
} else {
  console.error('Failed to inject secrets:', result.error);
}
```

## Prerequisites

### GitHub Token Requirements

Your GitHub Personal Access Token must have the following permissions:

- `repo` (Full control of private repositories)
- `workflow` (Update GitHub Action workflows)
- `write:packages` (Write packages to GitHub Package Registry)
- `admin:org` (if repository belongs to an organization)

### Repository Requirements

- The repository must exist and be accessible
- GitHub Actions must be enabled
- The token must have admin access to the repository

## Environment Variables

The following environment variables must be set:

- `GCP_SA_KEY` - Google Cloud Service Account key (JSON string)
- `GITHUB_TOKEN` - GitHub token for Actions (optional, will use provided token)

## Error Handling

The tool provides comprehensive error handling:

- **Token Validation**: Checks if the GitHub token is valid
- **Repository Access**: Verifies access to the target repository
- **Permissions Check**: Ensures the token has sufficient permissions
- **Secrets Validation**: Validates each secret before injection
- **Detailed Logging**: Provides detailed logs for debugging

## Troubleshooting

### Common Issues

1. **"Repository not found or access denied"**
   - Check if the repository exists
   - Verify the repository owner and name are correct
   - Ensure the GitHub token has access to the repository

2. **"Insufficient permissions"**
   - The GitHub token needs admin access to the repository
   - For organization repositories, ensure the token has organization access

3. **"GitHub Actions may not be enabled"**
   - Enable GitHub Actions in the repository settings
   - This is a warning and won't prevent secrets injection

4. **"GCP_SA_KEY environment variable not set"**
   - Set the `GCP_SA_KEY` environment variable with your service account key
   - The key should be a JSON string

### Debug Mode

Enable debug logging by setting the `DEBUG` environment variable:

```bash
DEBUG=* node inject-secrets-cli.js
```

## Security Notes

- All secrets are encrypted using GitHub's public key encryption
- The service account key is stored securely in GitHub secrets
- No secrets are logged or stored in plain text
- The tool only requires the GitHub token during execution

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the error messages and logs
3. Ensure all prerequisites are met
4. Contact DevYntra support if issues persist

## License

MIT License - see LICENSE file for details.
