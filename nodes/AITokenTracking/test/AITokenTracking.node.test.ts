import type { ISupplyDataFunctions, INode, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { mock } from 'jest-mock-extended';

import { AiTokenTracking } from '../AiTokenTracking.node';

// Mock the dependencies
jest.mock('@langchain/core/language_models/chat_models', () => ({
	BaseChatModel: jest.fn(),
}));

jest.mock('../helpers/ModelInterceptor', () => ({
	ModelInterceptor: jest.fn().mockImplementation(() => ({
		getWrappedModel: jest.fn().mockReturnValue({ mocked: 'model' }),
	})),
}));

jest.mock('../helpers/TokenTracker', () => ({
	TokenTracker: jest.fn().mockImplementation(() => ({
		recordUsage: jest.fn(),
	})),
}));

describe('AiTokenTracking Node', () => {
	let node: AiTokenTracking;
	let mockSupplyDataFunctions: jest.Mocked<ISupplyDataFunctions>;
	let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;

	beforeEach(() => {
		node = new AiTokenTracking();
		mockSupplyDataFunctions = mock<ISupplyDataFunctions>();
		mockExecuteFunctions = mock<IExecuteFunctions>();

		mockSupplyDataFunctions.getNode.mockReturnValue({
			name: 'AI Token Tracking',
			typeVersion: 1,
			parameters: {},
		} as INode);

		mockExecuteFunctions.getNode.mockReturnValue({
			name: 'AI Token Tracking',
			typeVersion: 1,
			parameters: {},
		} as INode);

		jest.clearAllMocks();
	});

	describe('description', () => {
		it('should have the expected properties', () => {
			expect(node.description).toBeDefined();
			expect(node.description.name).toBe('aiTokenTracking');
			expect(node.description.displayName).toBe('AI Token Tracking');
			expect(node.description.version).toBe(1);
			expect(node.description.group).toEqual(['transform']);
			expect(node.description.inputs).toHaveLength(1);
			expect(node.description.outputs).toHaveLength(1);
		});

		it('should have the correct properties defined', () => {
			// Now the node has 1 property: subWorkflowId for optional sub-workflow execution
			expect(node.description.properties).toHaveLength(1);
			expect(node.description.properties[0].name).toBe('subWorkflowId');
			expect(node.description.properties[0].type).toBe('workflowSelector');
		});
	});

	describe('supplyData', () => {
		const mockModel = {
			_llmType: () => 'test-model',
			callbacks: [],
		};

		beforeEach(() => {
			mockSupplyDataFunctions.getInputConnectionData.mockResolvedValue(mockModel);
			mockSupplyDataFunctions.getWorkflowDataProxy.mockReturnValue({
				$workflow: { id: 'test-workflow' },
				$execution: { id: 'test-execution' },
			} as any);
			mockSupplyDataFunctions.getNodeParameter.mockReturnValue({});
		});

		it('should throw error when no AI model is connected', async () => {
			mockSupplyDataFunctions.getInputConnectionData.mockResolvedValue(null);

			await expect(node.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should return wrapped model when AI model is connected', async () => {
			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result.response).toBeDefined();
			expect(mockSupplyDataFunctions.getInputConnectionData).toHaveBeenCalledWith(
				'ai_languageModel' as any,
				0,
			);
		});

		// Configuration test removed as the node now uses simplified internal configuration
	});

	describe('execute', () => {
		const mockInputData = [
			{ json: { test: 'data' } },
			{ json: { test: 'data2' } },
		];

		beforeEach(() => {
			mockExecuteFunctions.getInputData.mockReturnValue(mockInputData);
			mockExecuteFunctions.getInputConnectionData.mockResolvedValue({
				_llmType: () => 'test-model',
			});
			mockExecuteFunctions.getWorkflowDataProxy.mockReturnValue({
				$workflow: { id: 'test-workflow' },
				$execution: { id: 'test-execution' },
			} as any);
			mockExecuteFunctions.getNodeParameter.mockImplementation((parameterName: string) => {
				// Node no longer uses any parameters - simplified configuration
				return {};
			});
			mockExecuteFunctions.continueOnFail.mockReturnValue(false);
		});

		it('should process all input items', async () => {
			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toHaveLength(1); // One output array
			expect(result[0]).toHaveLength(2); // Two processed items
		});

		it('should add tracking metadata to output items', async () => {
			const result = await node.execute.call(mockExecuteFunctions);

			expect((result[0][0].json as any)._aiTokenTracking).toBeDefined();
			expect((result[0][0].json as any)._aiTokenTracking.trackingEnabled).toBe(true);
			expect((result[0][0].json as any)._aiTokenTracking.sessionId).toBeDefined();
			expect((result[0][0].json as any)._aiTokenTracking.timestamp).toBeDefined();
		});

		it('should handle errors gracefully when continueOnFail is true', async () => {
			mockExecuteFunctions.getInputConnectionData.mockRejectedValue(new Error('Test error'));
			mockExecuteFunctions.continueOnFail.mockReturnValue(true);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result[0][0].json.error).toBe('Test error');
			expect((result[0][0].json as any)._aiTokenTracking.error).toBe('Token tracking failed');
		});

		it('should throw error when continueOnFail is false', async () => {
			mockExecuteFunctions.getInputConnectionData.mockRejectedValue(new Error('Test error'));
			mockExecuteFunctions.continueOnFail.mockReturnValue(false);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow('Test error');
		});
	});
});
