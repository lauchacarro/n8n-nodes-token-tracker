import type {
	IExecuteFunctions,
	IExecuteWorkflowInfo,
	INodeExecutionData,
} from 'n8n-workflow';
import type { TokenUsage } from '../types';

/**
 * Minimal subworkflow executor for sending token tracking data
 * Based on ExecuteWorkflow but simplified for our specific use case
 */
export class SubworkflowExecutor {
	constructor(
		private executeFunctions: IExecuteFunctions,
		private subWorkflowId: string
	) {}

	/**
	 * Send token tracking data to sub-workflow
	 * Fire-and-forget approach - don't wait for completion to avoid blocking main flow
	 */
	async sendTokenData(usage: TokenUsage): Promise<void> {
		try {
			if (!this.subWorkflowId) {
				return; // No sub-workflow configured, skip silently
			}

			// Prepare workflow info
			const workflowInfo: IExecuteWorkflowInfo = {
				id: this.subWorkflowId,
			};

			// Prepare data to send - convert TokenUsage to N8N format
			const tokenData: INodeExecutionData = {
				json: {
					// Main token tracking data
					inputTokens: usage.inputTokens,
					outputTokens: usage.outputTokens,
					totalTokens: usage.totalTokens,

					// Model information
					modelName: usage.modelName,
					provider: usage.provider,

					// Metadata
					timestamp: usage.timestamp,

					// Additional context
					_source: 'ai-token-tracking',
					_nodeType: 'AITokenTracking',
				}
			};

			// Get workflow execution context for parent tracking
			const workflowProxy = this.executeFunctions.getWorkflowDataProxy(0);

			// Execute sub-workflow asynchronously (fire-and-forget)
			//const executionResult: ExecuteWorkflowData =
			await this.executeFunctions.executeWorkflow(
				workflowInfo,
				[tokenData], // Send as array of items
				undefined,
				{
					doNotWaitToFinish: true, // Fire-and-forget - don't block main workflow
					parentExecution: {
						executionId: workflowProxy.$execution.id,
						workflowId: workflowProxy.$workflow.id,
					},
				}
			);


		} catch (error) {
			// Log error but don't throw - we don't want to break the main workflow
			console.error(`[SubworkflowExecutor] Failed to send token data to sub-workflow ${this.subWorkflowId}:`, error.message);
		}
	}
}
