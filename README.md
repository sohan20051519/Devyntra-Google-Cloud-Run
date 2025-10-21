# Devyntra Firebase Backend

A comprehensive Firebase Cloud Functions backend for Devyntra, providing GitHub App authentication, automated code fixes with Jules API, CI/CD orchestration, and Google Cloud Run deployment management.

## 🏗️ Architecture

The backend is built with Firebase Cloud Functions using TypeScript and provides the following core functionality:

### Authentication & GitHub Integration
- Firebase Auth with GitHub OAuth provider
- GitHub App installation token management
- Automatic token refresh and validation

### Repository Management
- Fetch user's GitHub repositories
- Detect programming languages and frameworks
- Cache repository metadata in Firestore

### CI/CD Orchestration
- Trigger GitHub Actions workflows
- Monitor workflow execution status
- Automated PR creation and merging

### Jules API Integration
- Create AI-powered code analysis sessions
- Monitor session progress in real-time
- Handle PR creation and auto-merge

### Cloud Run Deployment
- Deploy applications to Google Cloud Run
- Manage environment variables and scaling
- Monitor deployment health and logs

### Admin & Monitoring
- System cleanup and maintenance
- Error monitoring and auto-remediation
- Performance metrics and analytics

## 📁 Project Structure

```
firebase-backend/
├── functions/
│   ├── src/
│   │   ├── auth/              # GitHub authentication
│   │   ├── repos/             # Repository management
│   │   ├── ci/                # GitHub Actions & PR management
│   │   ├── jules/             # Jules API integration
│   │   ├── deployment/        # Cloud Run deployment
│   │   ├── admin/             # Admin functions
│   │   ├── utils/             # Utilities & monitoring
│   │   ├── config/            # Configuration management
│   │   ├── middleware/        # Middleware functions
│   │   └── index.ts           # Function exports
│   ├── package.json
│   ├── tsconfig.json
│   └── env.example
├── firebase.json              # Firebase configuration
├── .firebaserc               # Project aliases
├── firestore.rules           # Security rules
├── firestore.indexes.json    # Database indexes
├── deploy.sh                 # Deployment script
└── README.md
```

## 🚀 Quick Start

### Prerequisites

1. **Firebase CLI**: `npm install -g firebase-tools`
2. **Node.js**: Version 18 or higher
3. **Google Cloud Project**: `devyntra-500e4`
4. **GitHub App**: Configured with provided credentials
5. **Jules API Key**: For AI-powered code fixes

### Installation

1. **Clone and navigate to the backend directory**:
   ```bash
   cd firebase-backend
   ```

2. **Install dependencies**:
   ```bash
   cd functions
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your credentials
   ```

4. **Set up Firebase secrets**:
   ```bash
   firebase functions:secrets:set GITHUB_PRIVATE_KEY
   firebase functions:secrets:set GITHUB_CLIENT_SECRET
   firebase functions:secrets:set JULES_API_KEY
   ```

5. **Deploy**:
   ```bash
   ./deploy.sh
   ```

## 🔧 Configuration

### Firebase Configuration

The project is configured for Firebase project `devyntra-500e4` with the following settings:

```json
{
  "apiKey": "AIzaSyDYfGFH5-tMEGVoPsTqBgHYX4qcZbY8WkE",
  "authDomain": "devyntra-500e4.firebaseapp.com",
  "projectId": "devyntra-500e4",
  "storageBucket": "devyntra-500e4.firebasestorage.app",
  "messagingSenderId": "583516794481",
  "appId": "1:583516794481:web:ffd1dcc966bb04f27275d0",
  "measurementId": "G-SWF3LQFBR0"
}
```

### Required Secrets

Configure these secrets using Firebase CLI:

- `GITHUB_APP_ID`: GitHub App ID
- `GITHUB_CLIENT_ID`: GitHub App client ID
- `GITHUB_CLIENT_SECRET`: GitHub App client secret
- `GITHUB_PRIVATE_KEY`: GitHub App private key (PEM format)
- `JULES_API_KEY`: Jules API key for AI code fixes

### Google Cloud Configuration

- **Project ID**: `devyntra-500e4`
- **Project Number**: `583516794481`
- **Default Region**: `us-central1`

## 📚 API Reference

### Authentication Functions

- `completeGitHubAuth(code)`: Complete GitHub OAuth flow
- `getGitHubProfile()`: Get user's GitHub profile
- `refreshGitHubToken()`: Refresh expired GitHub token

### Repository Functions

- `fetchUserRepos()`: Fetch user's GitHub repositories
- `detectRepoLanguage(repoId)`: Detect repository language/framework
- `getRepoDetails(repoId)`: Get detailed repository information

### CI/CD Functions

- `triggerGitHubWorkflow(repoId, workflowName)`: Trigger GitHub Actions workflow
- `getWorkflowRunStatus(deploymentId)`: Get workflow execution status
- `enablePRAutoMerge(prNodeId)`: Enable auto-merge for pull request

### Jules Integration

- `createJulesSession(repoId, prompt)`: Create AI code analysis session
- `getJulesSessionStatus(sessionId)`: Get session status and progress
- `cancelJulesSession(sessionId)`: Cancel active session

### Deployment Functions

- `deployToCloudRun(repoId, imageUrl, serviceName)`: Deploy to Cloud Run
- `getDeploymentStatus(deploymentId)`: Get deployment status
- `updateEnvironmentVars(deploymentId, envVars)`: Update environment variables
- `rollbackDeployment(deploymentId, revisionId)`: Rollback deployment
- `deleteDeployment(deploymentId)`: Delete deployment

### Admin Functions

- `cleanupDeployments()`: Clean up all deployments (admin only)
- `getSystemStatus()`: Get system statistics (admin only)
- `getErrorStatistics()`: Get error logs and statistics

## 🔒 Security

### Firestore Security Rules

The backend implements comprehensive security rules:

- Users can only access their own data
- Admin functions require admin privileges
- All writes are validated with schema rules
- Sensitive operations require authentication

### Authentication Flow

1. User authenticates with Firebase Auth using GitHub provider
2. Backend exchanges OAuth code for GitHub App installation token
3. Token is stored securely in Firestore with encryption
4. All API calls use the installation token for GitHub API access

### Rate Limiting

- Built-in rate limiting for all functions
- Exponential backoff for failed requests
- Per-user request tracking and limits

## 📊 Monitoring & Analytics

### Error Monitoring

- Comprehensive error logging to Firestore
- Automatic error categorization and tracking
- Auto-remediation for common issues (token refresh, IAM permissions)
- Error statistics and reporting

### Performance Monitoring

- Function execution time tracking
- Performance metrics collection
- System health monitoring
- Real-time status updates

### System Metrics

- Active users and deployments tracking
- Resource usage monitoring
- Service health checks
- Automated cleanup and maintenance

## 🛠️ Development

### Local Development

1. **Start Firebase emulators**:
   ```bash
   firebase emulators:start
   ```

2. **Run functions locally**:
   ```bash
   cd functions
   npm run serve
   ```

3. **Test with Firebase emulator UI**: http://localhost:4000

### Testing

- Unit tests for individual functions
- Integration tests for API endpoints
- End-to-end tests for complete workflows

### Debugging

- Comprehensive logging throughout the application
- Error tracking and resolution system
- Performance monitoring and profiling
- Health check endpoints

## 🚀 Deployment

### Production Deployment

1. **Build and deploy**:
   ```bash
   ./deploy.sh
   ```

2. **Verify deployment**:
   ```bash
   firebase functions:log
   ```

3. **Test endpoints**:
   ```bash
   # Test health check
   curl https://us-central1-devyntra-500e4.cloudfunctions.net/healthCheck
   ```

### Environment Management

- Separate configurations for development/staging/production
- Environment-specific secrets and variables
- Automated deployment pipelines

## 📞 Support

For issues and questions:

1. Check the error logs: `firebase functions:log`
2. Review the system status: Call `getSystemStatus()` function
3. Check health status: Call `healthCheck()` function
4. Review error statistics: Call `getErrorStatistics()` function

## 📄 License

This project is part of the Devyntra platform and is proprietary software.
