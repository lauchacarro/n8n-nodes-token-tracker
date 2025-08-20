import {
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	type INodeParameterResourceLocator,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import type { TokenTrackingConfig, TokenUsage } from './types';
import { ModelInterceptor } from './helpers/ModelInterceptor';
import { TokenTracker } from './helpers/TokenTracker';
import { generateSessionId } from './helpers/utils';
import { SubworkflowExecutor } from './helpers/SubworkflowExecutor';

// Static map to store token tracking data across method calls
// This is necessary because supplyData and execute run in different contexts
const tokenTrackingDataStore = new Map<string, {
	subWorkflowId: string;
	latestUsage: TokenUsage | null;
}>();

/**
 * Helper function to extract workflow ID from N8N parameter
 * Handles both string and INodeParameterResourceLocator formats
 */
function extractWorkflowId(param: string | INodeParameterResourceLocator): string {
	if (typeof param === 'object' && param?.value) {
		return param.value as string;
	}
	return param as string;
}

export class AITokenTracking implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Token Tracking',
		name: 'aiTokenTracking',
		icon: 'fa:chart-bar',
		iconColor: 'blue',
		group: ['transform'],
		version: 1,
		defaults: {
			name: 'AI Token Tracking',
		},
		description: 'Track AI token usage for monitoring and analysis',
		inputs: [
			{
				type: 'ai_languageModel' as NodeConnectionType,
				displayName: 'AI Model',
				maxConnections: 1,
				required: true,
			},
		],
		outputs: [
			{
				type: 'ai_languageModel' as NodeConnectionType,
				displayName: 'AI Model (Passthrough)',
			},
		],
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Monitoring'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.custom-ai.com/ai-token-tracking',
					},
				],
			},
		},
		properties: [
			// Node is now ultra-simplified - automatically tracks both input and output tokens
			// No configuration needed as we track everything by default
			{
				displayName: 'Sub-Workflow (Optional)',
				name: 'subWorkflowId',
				type: 'workflowSelector',
				default: '',
				description: 'Optional: Send token tracking data to a sub-workflow for processing',
				hint: 'If specified, token tracking data will be sent to this sub-workflow automatically',
			},
		],
	};

	/**
	 * Private static method to send token data to configured subworkflow
	 */
	private static async sendTokenDataToSubworkflow(
		context: ISupplyDataFunctions | IExecuteFunctions,
		usage: TokenUsage,
		subWorkflowId: string,
		storeKey: string
	): Promise<void> {
		try {
			const subworkflowExecutor = new SubworkflowExecutor(context as IExecuteFunctions, subWorkflowId);
			await subworkflowExecutor.sendTokenData(usage);
		} catch (error) {
			console.error(`[AI Token Tracking] ❌ Failed to send data to subworkflow:`, error.message);
			// Don't throw - we don't want to break the main workflow
		}

		// Clean up store entry after successful execution
		tokenTrackingDataStore.delete(storeKey);
	}

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Get the connected AI model
		const model = (await this.getInputConnectionData(
			'ai_languageModel' as any, // AI Language Model connection index
			itemIndex,
		)) as BaseChatModel;


		if (!model) {
			throw new NodeOperationError(this.getNode(), 'No AI model connected', {
				itemIndex,
				description: 'Please connect an AI Language Model to the second input',
			});
		}

		// Configuration is now simplified - always track everything with sensible defaults
		// No user configuration needed as we track both input and output tokens by default
		const workflowProxy = this.getWorkflowDataProxy(itemIndex);
		const workflowId = workflowProxy.$workflow.id as string;
		const nodeId = this.getNode().name;

		const config: TokenTrackingConfig = {
			tracking: {
				enableInputTokens: true,  // Always track input tokens
				enableOutputTokens: true, // Always track output tokens
			},
			storage: {
				storageMode: 'memory',    // Simple memory storage
				maxHistoryItems: 100,     // Keep last 100 items
			},
		};

		const tokenTracker = new TokenTracker(config, workflowId, nodeId);

		// Create a unique key for this node instance
		const storeKey = `${workflowId}-${nodeId}-${workflowProxy.$execution.id}`;

		// Store latest token usage for potential sub-workflow execution
		let latestTokenUsage: TokenUsage | null = null;

		// Get sub-workflow ID if specified
		const subWorkflowParam = this.getNodeParameter('subWorkflowId', itemIndex, '') as string | INodeParameterResourceLocator;
		const subWorkflowId = extractWorkflowId(subWorkflowParam);

		// Initialize store entry
		tokenTrackingDataStore.set(storeKey, {
			subWorkflowId,
			latestUsage: null
		});

		// Store reference to this for callback access
		const nodeInstance = this;

		// Create token tracking callback with immediate subworkflow execution
		const onTokensTracked = async (usage: TokenUsage) => {
			const sessionId = generateSessionId(workflowId, nodeId);
			tokenTracker.recordUsage(sessionId, usage);

			// Store the latest usage in both local variable and global store
			latestTokenUsage = usage;
			const storeEntry = tokenTrackingDataStore.get(storeKey);
			if (storeEntry) {
				storeEntry.latestUsage = usage;
				tokenTrackingDataStore.set(storeKey, storeEntry);
			}

			// If sub-workflow is configured, send data immediately
			if (subWorkflowId) {
				await AITokenTracking.sendTokenDataToSubworkflow(nodeInstance, usage, subWorkflowId, storeKey);
			}
		};

		// Store references for use in execute method (keeping for backward compatibility)
		(this as any)._tokenTrackingData = {
			subWorkflowId,
			getLatestUsage: () => latestTokenUsage,
			storeKey, // Add store key for execute method
		};		// Wrap the model with token tracking AND N8N logging
		const modelInterceptor = new ModelInterceptor(
			model,
			onTokensTracked,
			this, // Pass execution functions for N8N logging
			{
				enableN8nLogging: true, // Enable N8N logging functionality
			}
		);


		return {
			response: modelInterceptor.getWrappedModel(),
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const item = items[itemIndex];

				// Get the AI model from supply data (already wrapped with tracking)
				const model = (await this.getInputConnectionData(
					'ai_languageModel' as any, // AI Language Model connection index
					itemIndex,
				)) as BaseChatModel;

				if (!model) {
					throw new NodeOperationError(this.getNode(), 'No AI model connected', {
						itemIndex,
						description: 'Please connect an AI Language Model',
					});
				}

				const workflowProxy = this.getWorkflowDataProxy(itemIndex);
				const workflowId = workflowProxy.$workflow.id as string;
				const nodeId = this.getNode().name;

				// Generate session ID using utility function
				const sessionId = generateSessionId(workflowId, nodeId, workflowProxy.$execution.id as string);

				// Add simplified tracking metadata to the output
				const outputItem: INodeExecutionData = {
					json: {
						...item.json,
						_aiTokenTracking: {
							sessionId,
							nodeId,
							workflowId,
							trackingEnabled: true,
							timestamp: new Date().toISOString(),
						},
					},
					pairedItem: { item: itemIndex },
				};

				returnData.push(outputItem);

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							_aiTokenTracking: {
								error: 'Token tracking failed',
								timestamp: new Date().toISOString(),
							},
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw error;
			}
		}

		// Note: Subworkflow execution is now handled directly in the onTokensTracked callback
		// This provides immediate processing when token data becomes available

		return [returnData];
	}
}
