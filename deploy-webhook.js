#!/usr/bin/env node

/**
 * KMSG Backend Auto-Deploy Webhook
 * This script handles automatic deployment when code is pushed to main branch
 */

const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3001;
const SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key-change-this';

// Get the directory where this script is located
const SCRIPT_DIR = __dirname;

// Middleware
app.use(express.json());

// Webhook endpoint
app.post('/deploy', (req, res) => {
  const { ref, secret } = req.body;
  
  // Verify secret
  if (secret !== SECRET) {
    console.log('❌ Invalid webhook secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check if it's main branch
  if (ref !== 'refs/heads/main') {
    console.log(`⏭️  Ignoring push to ${ref}`);
    return res.status(200).json({ message: 'Not main branch, ignoring' });
  }
  
  console.log('🚀 Main branch push detected, starting deployment...');
  
  // Run deployment (only for buyer-service)
  const deployCommand = `cd ${SCRIPT_DIR} && ./auto-deploy.sh`;
  
  exec(deployCommand, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Deployment failed:', error);
      return res.status(500).json({ error: 'Deployment failed', details: error.message });
    }
    
    console.log('✅ Deployment completed successfully');
    console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);
    
    res.json({ 
      success: true, 
      message: 'Deployment completed',
      output: stdout 
    });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kmsg-deploy-webhook' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎣 KMSG Buyer-Service Deploy webhook listening on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://your-ec2-ip:${PORT}/deploy`);
  console.log(`🔑 Secret: ${SECRET}`);
  console.log(`📁 Working directory: ${SCRIPT_DIR}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down webhook server...');
  process.exit(0);
});
