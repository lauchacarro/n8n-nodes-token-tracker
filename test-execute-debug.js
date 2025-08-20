/**
 * Test script to debug subworkflow execution
 */

const { AITokenTracking } = require('./dist/nodes/AITokenTracking/AiTokenTracking.node');

console.log('=== Testing AITokenTracking with both supplyData and execute ===');

// Mock a complete execution scenario
const mockSupplyDataFunctions = {
	getInputConnectionData: async () => {
		// Mock AI model
		return {
			_llmType: () => 'openai',
			constructor: { name: 'ChatOpenAI' },
			callbacks: []
		};
	},
	getNodeParameter: (name, index, defaultValue) => {
		console.log(`MOCK SUPPLY getNodeParameter called: name=${name}, index=${index}, defaultValue=${defaultValue}`);
		if (name === 'subWorkflowId') {
			// Simulate the N8N workflowSelector object structure
			return {
				__rl: true,
				value: 'test-subworkflow-123',
				mode: 'list',
				cachedResultName: 'Test Subworkflow'
			};
		}
		return defaultValue;
	},
	getWorkflowDataProxy: () => ({
		$workflow: { id: 'test-workflow-456' },
		$execution: { id: 'test-execution-789' }
	}),
	getNode: () => ({ name: 'AI Token Tracking Test' }),
	logAiEvent: (event, data) => console.log('Mock logAiEvent:', event),
	logger: { debug: console.log }
};

const mockExecuteFunctions = {
	getInputData: () => [{ json: { test: 'data' } }],
	getNodeParameter: (name, index, defaultValue) => {
		console.log(`MOCK EXECUTE getNodeParameter called: name=${name}, index=${index}, defaultValue=${defaultValue}`);
		if (name === 'subWorkflowId') {
			// Simulate the N8N workflowSelector object structure
			return {
				__rl: true,
				value: 'test-subworkflow-123',
				mode: 'list',
				cachedResultName: 'Test Subworkflow'
			};
		}
		return defaultValue;
	},
	getInputConnectionData: async () => {
		// Mock AI model
		return {
			_llmType: () => 'openai',
			constructor: { name: 'ChatOpenAI' }
		};
	},
	getWorkflowDataProxy: (index) => ({
		$workflow: { id: 'test-workflow-456' },
		$execution: { id: 'test-execution-789' }
	}),
	getNode: () => ({ name: 'AI Token Tracking Test' }),
	continueOnFail: () => false,
	// Add the SubworkflowExecutor methods
	executeWorkflow: async (workflowInfo, data, options, config) => {
		console.log('MOCK executeWorkflow called with:', { workflowInfo, data });
		return { executionId: 'mock-execution-999', data: [] };
	}
};

async function testFullFlow() {
	try {
		const node = new AITokenTracking();

		console.log('1. Creating node instance...');

		console.log('2. Calling supplyData method first...');
		const supplyResult = await node.supplyData.call(mockSupplyDataFunctions, 0);
		console.log('2.1. SupplyData result type:', typeof supplyResult);

		// Simulate some token usage
		console.log('3. Simulating token usage...');
		const wrappedModel = supplyResult.response;

		// Simulate actual LLM execution that would trigger the callbacks
		console.log('3.1. Simulating LLM callback execution...');
		const modelInterceptor = wrappedModel;

		// Access the token callback directly and simulate its execution
		// (In real usage, this would happen automatically when the AI model is used)
		if (modelInterceptor.callbacks && modelInterceptor.callbacks.length > 0) {
			const tokenCallback = modelInterceptor.callbacks.find(cb => cb.name === 'TokenTrackingCallback');
			if (tokenCallback) {
				console.log('3.2. Found TokenTrackingCallback, simulating handleLLMEnd...');

				// Simulate LLM result with token usage
				const mockLLMResult = {
					generations: [['Test response']],
					llmOutput: {
						tokenUsage: {
							promptTokens: 50,
							completionTokens: 10,
							totalTokens: 60
						}
					}
				};

				// This should trigger our onTokensTracked callback and update the store
				await tokenCallback.handleLLMEnd(mockLLMResult, 'test-run-123');
				console.log('3.3. Callback executed');
			} else {
				console.log('3.2. TokenTrackingCallback not found in callbacks');
			}
		}

		console.log('4. Now calling execute method...');
		const executeResult = await node.execute.call(mockExecuteFunctions);

		console.log('5. Execute result:', executeResult);
		console.log('=== Test completed ===');

	} catch (error) {
		console.error('Test failed:', error);
	}
}

testFullFlow();
