#!/bin/bash

# Production startup script for Swap Sage Frontend
echo "🚀 Starting Swap Sage Frontend in Production Mode..."

# Set production environment
export NODE_ENV=production

# Start the Next.js application in production mode
echo "📡 Starting server on port 3000..."
npm start 