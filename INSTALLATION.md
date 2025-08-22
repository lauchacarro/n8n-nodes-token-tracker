# Installation & Usage Guide

## 📦 Installation Steps

### 1. Install Dependencies
```bash
cd new-ai-token-tracking
npm install
```

### 2. Install Peer Dependencies
Since this node depends on N8N and LangChain, you'll need these in your N8N installation:
```bash
# These are typically already available in N8N environments
npm install n8n-workflow @langchain/core
```

### 3. Build the Node
```bash
npm run build
```

### 4. Link for Local Testing
```bash
# Link the package for local development
npm link

# In your N8N directory
npm link n8n-nodes-ai-token-tracking
```

### 5. Install in N8N
For production use, you can install directly:
```bash
npm install n8n-nodes-ai-token-tracking
```

## 🚀 Quick Start Example

### 1. Basic Token Tracking Workflow

```json
{
  "name": "Simple AI Token Tracking",
  "active": false,
  "nodes": [
    {
      "parameters": {},
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [220, 300],
      "typeVersion": 1
    },
    {
      "name": "AI Token Tracking",
      "type": "aiTokenTracking",
      "position": [420, 300],
      "typeVersion": 1
    },
    {
      "parameters": {
        "model": "gpt-3.5-turbo",
        "prompt": "Analyze this text: {{ $json.text }}"
      },
      "name": "OpenAI GPT",
      "type": "n8n-nodes-langchain.lmOpenAi",
      "position": [620, 300],
      "typeVersion": 1
    }
  ],
  "connections": {
    "Manual Trigger": {
      "main": [
        [
          {
            "node": "AI Token Tracking",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "AI Token Tracking": {
      "main": [
        [
          {
            "node": "OpenAI GPT",
            "type": "main",
            "index": 0
          }
        ]
      ],
      "ai_languageModel": [
        [
          {
            "node": "OpenAI GPT",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

### 2. Advanced Setup with Sub-Workflow

```json
{
  "name": "Advanced AI Token Tracking with Sub-Workflow",
  "active": false,
  "nodes": [
    {
      "parameters": {},
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [220, 300],
      "typeVersion": 1
    },
    {
      "parameters": {
        "subWorkflowConfig": {
          "enabled": true,
          "trigger": "threshold",
          "thresholdTokens": 500,
          "workflowId": "sub-workflow-123",
          "mode": "once",
          "waitForCompletion": false
        }
      },
      "name": "AI Token Tracking",
      "type": "aiTokenTracking",
      "position": [420, 300],
      "typeVersion": 1
    },
    {
      "parameters": {
        "model": "gpt-4",
        "prompt": "{{ $json.prompt }}"
      },
      "name": "OpenAI GPT-4",
      "type": "n8n-nodes-langchain.lmOpenAi",
      "position": [620, 300],
      "typeVersion": 1
    }
  ]
}
```

## ⚙️ Configuration Options

### Tracking Configuration
- `enableInputTokens`: Track input tokens (default: true)
- `enableOutputTokens`: Track output tokens (default: true)
- `pricePerInputToken`: Cost per input token (default: 0.0015)
- `pricePerOutputToken`: Cost per output token (default: 0.002)
- `currency`: Currency code (default: "USD")

### Sub-Workflow Configuration
- `enabled`: Enable sub-workflow execution (default: false)
- `workflowId`: Target workflow ID to execute
- `trigger`: When to trigger ("always", "threshold", "interval")
- `thresholdTokens`: Token count threshold (for threshold trigger)
- `intervalMinutes`: Time interval in minutes (for interval trigger)
- `mode`: Execution mode ("once", "each")
- `waitForCompletion`: Wait for sub-workflow completion (default: true)

### Storage Configuration
- `storageMode`: Storage method ("memory", "workflow-data")
- `maxHistoryItems`: Maximum history items to keep (default: 100)

## 📊 Understanding Output Data

The node adds tracking metadata to your data:

```json
{
  "originalField1": "original value",
  "originalField2": "another value",
  "_aiTokenTracking": {
    "sessionId": "workflow-123-node-456-1703097600000-abc123",
    "nodeId": "AI Token Tracking",
    "workflowId": "workflow-123",
    "trackingEnabled": true,
    "config": {
      "subWorkflowEnabled": false
    },
    "timestamp": "2024-12-20T16:00:00.000Z"
  }
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "No AI model connected" Error
**Solution**: Ensure you have connected an AI Language Model to the second input of the AI Token Tracking node.

#### 2. Module Resolution Errors
**Solution**: Make sure peer dependencies are installed:
```bash
npm install n8n-workflow @langchain/core
```

#### 3. TypeScript Compilation Errors
**Solution**: Check your TypeScript configuration and ensure all types are properly imported.

#### 4. Sub-workflow Not Executing
**Solution**: 
- Verify the workflow ID is correct
- Check that the target workflow exists
- Ensure proper trigger conditions are met

### Debugging Tips

#### Enable Detailed Logging
Add logging to track token usage:
```javascript
// In your workflow, you can access tracking data
const trackingData = $node["AI Token Tracking"].json._aiTokenTracking;
console.log('Token Usage:', trackingData);
```

#### Test with Simple Configuration
Start with basic tracking enabled and no sub-workflows:
```json
{
  "subWorkflowConfig": {
    "enabled": false
  }
}
```

## 🧪 Testing Your Installation

### 1. Unit Tests
```bash
npm test
```

### 2. Integration Test
Create a simple workflow in N8N:
1. Add Manual Trigger
2. Add AI Token Tracking node
3. Connect an AI model (like OpenAI)
4. Execute and check output for `_aiTokenTracking` metadata

### 3. Performance Test
Monitor execution times:
```bash
# Run with timing
npm run test:performance
```

## 📈 Best Practices

### 1. Token Price Configuration
- Use accurate pricing from your AI provider
- Update prices regularly as they change
- Consider different pricing tiers

### 2. Sub-Workflow Design
- Keep sub-workflows lightweight
- Use async execution for non-critical tracking
- Handle errors gracefully

### 3. Storage Management
- Set appropriate history limits
- Use memory storage for temporary tracking
- Use workflow-data storage for persistent tracking

### 4. Performance Optimization
- Avoid excessive sub-workflow executions
- Use threshold triggers appropriately
- Monitor tracking overhead

## 🔒 Security Considerations

### 1. API Keys
- Never log API keys in tracking data
- Use N8N credential system properly
- Rotate keys regularly

### 2. Data Privacy
- Be mindful of what data is passed to sub-workflows
- Consider data retention policies
- Implement proper access controls

### 3. Cost Control
- Set reasonable token thresholds
- Monitor costs regularly
- Implement budget alerts via sub-workflows

## 📞 Support

If you encounter issues:

1. Check the [troubleshooting guide](#troubleshooting)
2. Review the [test cases](nodes/AITokenTracking/test/)
3. Open an issue on GitHub with:
   - Your N8N version
   - Node configuration
   - Error messages
   - Steps to reproduce
