/**
 * Test script to verify SubworkflowExecutor functionality
 */

const { SubworkflowExecutor } = require('./dist/nodes/AITokenTracking/helpers/SubworkflowExecutor');

console.log('=== Testing SubworkflowExecutor ===');

// Mock IExecuteFunctions for testing
const mockExecuteFunctions = {
	getWorkflowDataProxy: () => ({
		$workflow: { id: 'test-workflow-123' },
		$execution: { id: 'test-execution-456' }
	}),
	executeWorkflow: async (workflowInfo, data, options, config) => {
		console.log('Mock executeWorkflow called with:');
		console.log('- Workflow ID:', workflowInfo.id);
		console.log('- Data:', JSON.stringify(data, null, 2));
		console.log('- Config:', JSON.stringify(config, null, 2));

		return {
			executionId: 'mock-execution-789',
			data: []
		};
	}
};

// Mock token usage data
const mockTokenUsage = {
	inputTokens: 388,
	outputTokens: 11,
	totalTokens: 399,
	modelName: 'gpt-4o-mini',
	provider: 'azure_openai',
	timestamp: new Date()
};

async function testSubworkflowExecutor() {
	try {
		console.log('\n1. Creating SubworkflowExecutor...');
		const executor = new SubworkflowExecutor(mockExecuteFunctions, 'test-subworkflow-id');

		console.log('\n2. Sending token data to sub-workflow...');
		await executor.sendTokenData(mockTokenUsage);

		console.log('\n3. Testing with empty subworkflow ID (should skip silently)...');
		const executorEmpty = new SubworkflowExecutor(mockExecuteFunctions, '');
		await executorEmpty.sendTokenData(mockTokenUsage);

		console.log('\n=== SubworkflowExecutor test completed successfully ===');

	} catch (error) {
		console.error('SubworkflowExecutor test failed:', error);
	}
}

testSubworkflowExecutor();
