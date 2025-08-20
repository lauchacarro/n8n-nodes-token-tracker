// Quick test script to verify callback execution
const { ModelInterceptor, TokenTrackingCallback, N8nLoggingCallback } = require('./dist/nodes/AITokenTracking/helpers/ModelInterceptor.js');

console.log('=== Testing Callback Execution ===');

// Mock AI model
const mockModel = {
    callbacks: [],
    constructor: { name: 'MockOpenAI' },
    modelName: 'gpt-3.5-turbo',
    _llmType: 'openai'
};

// Mock execution functions
const mockExecutionFunctions = {
    addInputData: (connectionType, data, index) => {
        console.log('Mock addInputData called:', { connectionType, data, index });
        return { index: 0 };
    },
    addOutputData: (connectionType, index, data, metadata) => {
        console.log('Mock addOutputData called:', { connectionType, index, data, metadata });
    },
    logAiEvent: (event, data) => {
        console.log('Mock logAiEvent called:', { event, data });
    },
    logger: {
        debug: (message) => console.log('Mock logger debug:', message)
    },
    getNode: () => ({ name: 'Test Node' })
};

// Token tracking callback
const tokenCallback = (usage) => {
    console.log('Token usage callback received:', usage);
};

console.log('\n1. Testing TokenTrackingCallback only...');
const interceptor1 = new ModelInterceptor(mockModel, tokenCallback);
console.log('Created TokenTrackingCallback-only interceptor');

console.log('\n2. Testing Combined callbacks...');
const interceptor2 = new ModelInterceptor(
    mockModel,
    tokenCallback,
    mockExecutionFunctions,
    { enableN8nLogging: true }
);
console.log('Created Combined interceptor');

// Test callback execution manually
console.log('\n3. Testing manual callback execution...');
const tokenCb = interceptor2.getTokenCallback();
const n8nCb = interceptor2.getN8nCallback();

console.log('Token callback exists:', !!tokenCb);
console.log('N8N callback exists:', !!n8nCb);

if (tokenCb) {
    console.log('\nTesting TokenTrackingCallback...');
    tokenCb.handleLLMStart({}, ['Test prompt'], 'test-run-1');
    tokenCb.handleLLMEnd({
        generations: [[{ text: 'Test response' }]],
        llmOutput: { tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }}
    }, 'test-run-1');
}

if (n8nCb) {
    console.log('\nTesting N8nLoggingCallback...');
    n8nCb.handleLLMStart({ type: 'constructor', kwargs: { model: 'gpt-3.5' }}, ['Test prompt'], 'test-run-2');
    n8nCb.handleLLMEnd({
        generations: [[{ text: 'Test response' }]],
        llmOutput: { tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }}
    }, 'test-run-2');
}

console.log('\n=== Test Complete ===');
