#!/bin/bash

# Devyntra Firebase Backend Deployment Script
# This script deploys the Firebase Cloud Functions backend

set -e

echo "🚀 Starting Devyntra Firebase Backend Deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please log in first:"
    echo "firebase login"
    exit 1
fi

# Navigate to functions directory
cd functions

echo "📦 Installing dependencies..."
npm install

echo "🔧 Building TypeScript..."
npm run build

# Navigate back to root
cd ..

echo "🔐 Setting up secrets..."
echo "Please ensure the following secrets are configured:"
echo "- GITHUB_APP_ID"
echo "- GITHUB_CLIENT_ID" 
echo "- GITHUB_CLIENT_SECRET"
echo "- GITHUB_PRIVATE_KEY"
echo "- JULES_API_KEY"

# Set secrets (uncomment and configure as needed)
# firebase functions:secrets:set GITHUB_PRIVATE_KEY
# firebase functions:secrets:set GITHUB_CLIENT_SECRET
# firebase functions:secrets:set JULES_API_KEY

echo "🚀 Deploying Firebase Functions..."
firebase deploy --only functions

echo "🗄️ Deploying Firestore rules and indexes..."
firebase deploy --only firestore

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure GitHub webhooks to point to your Cloud Functions"
echo "2. Set up GitHub App with the provided credentials"
echo "3. Test the authentication flow"
echo "4. Configure Jules API integration"
echo ""
echo "🔗 Useful URLs:"
echo "- Firebase Console: https://console.firebase.google.com/project/devyntra-500e4"
echo "- Functions Logs: firebase functions:log"
echo "- Firestore Console: https://console.firebase.google.com/project/devyntra-500e4/firestore"
