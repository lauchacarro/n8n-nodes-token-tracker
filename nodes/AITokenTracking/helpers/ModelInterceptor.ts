import type { BaseCallbackHandler, CallbackHandlerMethods } from '@langchain/core/callbacks/base';
import { BaseCallbackHandler as CallbackHandler } from '@langchain/core/callbacks/base';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { LLMResult } from '@langchain/core/outputs';
import type { Serialized } from '@langchain/core/load/serializable';
import type { BaseMessage } from '@langchain/core/messages';

import type { TokenUsage } from '../types';
import { BaseLanguageModel } from '@langchain/core/dist/language_models/base';
import pick from 'lodash/pick';
import type { AiEvent, IDataObject, ISupplyDataFunctions, JsonObject } from 'n8n-workflow';
import { jsonStringify, NodeConnectionType, NodeError, NodeOperationError } from 'n8n-workflow';

export interface ModelInfo {
	provider: string;
	modelName: string;
	modelVersion?: string;
	modelId?: string;
}

/**
 * Type for tracking LLM run details in N8N logging
 */
type RunDetail = {
	index: number;
	messages: BaseMessage[] | string[] | string;
	options: any;
};

/**
 * Utility function to log AI events in N8N
 */
function logAiEvent(
	executeFunctions: ISupplyDataFunctions,
	event: AiEvent,
	data?: IDataObject,
) {
	try {
		executeFunctions.logAiEvent(event, data ? jsonStringify(data) : undefined);
	} catch (error) {
		executeFunctions.logger.debug(`Error logging AI event: ${event}`);
	}
}

/**
 * Callback handler for tracking token usage in LangChain models
 */
export class TokenTrackingCallback extends CallbackHandler {
	name = 'TokenTrackingCallback';

	private onTokensTracked: (usage: TokenUsage) => void;
	private modelInfo: ModelInfo;

	constructor(
		onTokensTracked: (usage: TokenUsage) => void,
		modelInfo: ModelInfo
	) {
		super();
		this.onTokensTracked = onTokensTracked;
		this.modelInfo = modelInfo;
	}

	handleLLMStart(
		_llm: any,
		prompts: string[],
		_runId: string,
		_parentRunId?: string,
		_extraParams?: Record<string, unknown>,
	): void {

		// Only log the start, don't track preliminary usage
		// Real usage will be tracked in handleLLMEnd with actual provider data
	}

	handleLLMEnd(result: LLMResult, _runId: string, _parentRunId?: string): void {

		// Extract token usage from LLM result (real data from provider)
		const llmUsage = result.llmOutput?.tokenUsage;

		const inputTokens = llmUsage?.promptTokens || 0;
		const outputTokens = llmUsage?.completionTokens || 0;
		const totalTokens = llmUsage?.totalTokens || inputTokens + outputTokens;

		const usage: TokenUsage = {
			inputTokens,
			outputTokens,
			totalTokens,
			modelName: this.modelInfo.modelName,
			provider: this.modelInfo.provider,
			timestamp: new Date(), // Current timestamp when we receive real data
		};


		this.onTokensTracked(usage);
	}

	handleLLMError(_error: Error, _runId: string, _parentRunId?: string): void {
		// Track error but still record any partial usage
		const errorUsage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			modelName: this.modelInfo.modelName,
			provider: this.modelInfo.provider,
			timestamp: new Date(),
		};

		this.onTokensTracked(errorUsage);
	}
}

/**
 * Callback handler for N8N logging (replicated from N8nNonEstimatingTracing)
 * Logs input and output of AI models in N8N for visibility
 */
export class N8nLoggingCallback extends CallbackHandler {
	name = 'N8nLoggingCallback';
	awaitHandlers = true;
	connectionType = NodeConnectionType.AiLanguageModel;

	private runsMap: Record<string, RunDetail> = {};
	private executionFunctions: ISupplyDataFunctions;
	private options: {
		errorDescriptionMapper?: (error: NodeError) => string;
	};

	constructor(
		executionFunctions: ISupplyDataFunctions,
		options?: {
			errorDescriptionMapper?: (error: NodeError) => string;
		}
	) {
		super();
		this.executionFunctions = executionFunctions;
		this.options = {
			errorDescriptionMapper: (error: NodeError) => error.description || error.message || 'Unknown error',
			...options,
		};
	}

	async handleLLMStart(llm: Serialized, prompts: string[], runId: string): Promise<void> {
		const runDetails = this.runsMap[runId] ?? { index: Object.keys(this.runsMap).length };

		// Estimate tokens from prompts (same logic as TokenTrackingCallback)
		const estimatedTokens = this.estimateTokensFromPrompts(prompts);
		const options = llm.type === 'constructor' ? llm.kwargs : llm;


		const { index } = this.executionFunctions.addInputData(
			this.connectionType,
			[
				[
					{
						json: {
							messages: prompts,
							estimatedTokens,
							options,
						},
					},
				],
			],
			runDetails.index,
		);

		// Save the run details for later use when processing handleLLMEnd event
		this.runsMap[runId] = {
			index,
			options,
			messages: prompts,
		};

	}

	async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
		// The fallback should never happen since handleLLMStart should always set the run details
		const runDetails = this.runsMap[runId] ?? { index: Object.keys(this.runsMap).length };

		// Clean the output to avoid sensitive data
		output.generations = output.generations.map((gen) =>
			gen.map((g) => pick(g, ['text', 'generationInfo'])),
		);

		// Extract real token usage from LLM result instead of hardcoding zeros
		const llmUsage = output.llmOutput?.tokenUsage;
		const tokenUsageEstimate = {
			completionTokens: llmUsage?.completionTokens || 0,
			promptTokens: llmUsage?.promptTokens || 0,
			totalTokens: llmUsage?.totalTokens || (llmUsage?.completionTokens || 0) + (llmUsage?.promptTokens || 0),
		};


		const response: {
			response: { generations: LLMResult['generations'] };
			tokenUsageEstimate?: typeof tokenUsageEstimate;
		} = {
			response: { generations: output.generations },
		};

		response.tokenUsageEstimate = tokenUsageEstimate;

		const parsedMessages =
			typeof runDetails.messages === 'string'
				? runDetails.messages
				: runDetails.messages.map((message) => {
						if (typeof message === 'string') return message;
						if (typeof message?.toJSON === 'function') return message.toJSON();
						return message;
					});

		this.executionFunctions.addOutputData(
			this.connectionType,
			runDetails.index,
			[[{ json: { ...response } }]],
			undefined,
		);

		logAiEvent(this.executionFunctions, 'ai-llm-generated-output', {
			messages: parsedMessages,
			options: runDetails.options,
			response,
		});
	}

	async handleLLMError(error: IDataObject | Error, runId: string, parentRunId?: string): Promise<void> {
		const runDetails = this.runsMap[runId] ?? { index: Object.keys(this.runsMap).length };

		// Filter out non-x- headers to avoid leaking sensitive information in logs
		if (typeof error === 'object' && error?.hasOwnProperty('headers')) {
			const errorWithHeaders = error as { headers: Record<string, unknown> };

			Object.keys(errorWithHeaders.headers).forEach((key) => {
				if (!key.startsWith('x-')) {
					delete errorWithHeaders.headers[key];
				}
			});
		}

		if (error instanceof NodeError) {
			if (this.options.errorDescriptionMapper) {
				error.description = this.options.errorDescriptionMapper(error);
			}

			this.executionFunctions.addOutputData(this.connectionType, runDetails.index, error);
		} else {
			// If the error is not a NodeError, we wrap it in a NodeOperationError
			this.executionFunctions.addOutputData(
				this.connectionType,
				runDetails.index,
				new NodeOperationError(this.executionFunctions.getNode(), error as JsonObject, {
					functionality: 'configuration-node',
				}),
			);
		}

		logAiEvent(this.executionFunctions, 'ai-llm-errored', {
			error: Object.keys(error).length === 0 ? error.toString() : error,
			runId,
			parentRunId,
		});
	}

	/**
	 * Estimates token count from prompts (same logic as TokenTrackingCallback)
	 */
	private estimateTokensFromPrompts(prompts: string[]): number {
		let totalTokens = 0;

		for (const prompt of prompts) {
			// Rough estimation: ~4 characters per token for English text
			totalTokens += Math.ceil(prompt.length / 4);
		}

		return totalTokens;
	}
}

/**
 * Combined callback handler for both token tracking and N8N logging
 * This class combines both functionalities in a scalable and maintainable way
 */
export class CombinedTrackingCallback extends CallbackHandler {
	name = 'CombinedTrackingCallback';
	awaitHandlers = true;

	private tokenCallback: TokenTrackingCallback;
	private n8nCallback: N8nLoggingCallback;

	constructor(
		onTokensTracked: (usage: TokenUsage) => void,
		modelInfo: ModelInfo,
		executionFunctions: ISupplyDataFunctions,
		options?: {
			errorDescriptionMapper?: (error: NodeError) => string;
		}
	) {
		super();

		// Initialize both callback handlers
		this.tokenCallback = new TokenTrackingCallback(onTokensTracked, modelInfo);
		this.n8nCallback = new N8nLoggingCallback(executionFunctions, options);
	}

	async handleLLMStart(
		llm: Serialized,
		prompts: string[],
		runId: string,
		parentRunId?: string,
		extraParams?: Record<string, unknown>
	): Promise<void> {
		// Execute both tracking mechanisms
		await Promise.all([
			// TokenTrackingCallback expects different parameters, so we need to adapt
			Promise.resolve(this.tokenCallback.handleLLMStart(llm as any, prompts, runId, parentRunId, extraParams)),
			this.n8nCallback.handleLLMStart(llm, prompts, runId)
		]);
	}

	async handleLLMEnd(
		result: LLMResult,
		runId: string,
		parentRunId?: string
	): Promise<void> {
		// Execute both tracking mechanisms
		await Promise.all([
			Promise.resolve(this.tokenCallback.handleLLMEnd(result, runId, parentRunId)),
			this.n8nCallback.handleLLMEnd(result, runId)
		]);
	}

	async handleLLMError(
		error: Error,
		runId: string,
		parentRunId?: string
	): Promise<void> {
		// Execute both tracking mechanisms
		await Promise.all([
			Promise.resolve(this.tokenCallback.handleLLMError(error, runId, parentRunId)),
			this.n8nCallback.handleLLMError(error, runId, parentRunId)
		]);
	}

	/**
	 * Get access to the underlying token callback for advanced usage
	 */
	getTokenCallback(): TokenTrackingCallback {
		return this.tokenCallback;
	}

	/**
	 * Get access to the underlying N8N callback for advanced usage
	 */
	getN8nCallback(): N8nLoggingCallback {
		return this.n8nCallback;
	}
}

/**
 * Wraps an AI model with token tracking capabilities and optional N8N logging
 */
export class ModelInterceptor {
	private originalModel: BaseChatModel;
	private tokenCallback: TokenTrackingCallback;
	private n8nCallback?: N8nLoggingCallback;
	private useN8nLogging: boolean;

	constructor(
		model: BaseChatModel,
		onTokensTracked: (usage: TokenUsage) => void,
		executionFunctions?: ISupplyDataFunctions,
		options?: {
			enableN8nLogging?: boolean;
			errorDescriptionMapper?: (error: NodeError) => string;
		}
	) {
		this.originalModel = model;
		this.useN8nLogging = options?.enableN8nLogging || false;

		// Get model info from the model
		const modelInfo = this.extractModelInfo(model);

		// Always create token tracking callback
		this.tokenCallback = new TokenTrackingCallback(onTokensTracked, modelInfo);

		// Create N8N logging callback if enabled and executionFunctions available
		if (this.useN8nLogging && executionFunctions) {
			this.n8nCallback = new N8nLoggingCallback(executionFunctions, {
				errorDescriptionMapper: options?.errorDescriptionMapper
			});
		}

		// Add callbacks directly to the model
		this.addTrackingCallbacks();
	}

	/**
	 * Returns the wrapped model with tracking capabilities
	 */
	getWrappedModel(): BaseChatModel {
		return this.originalModel;
	}

	/**
	 * Get access to the token callback (works with both callback types)
	 */
	getTokenCallback(): TokenTrackingCallback {
		return this.tokenCallback;
	}

	/**
	 * Get access to the N8N logging callback (only available when N8N logging is enabled)
	 */
	getN8nCallback(): N8nLoggingCallback | null {
		return this.n8nCallback || null;
	}

	/**
	 * Check if N8N logging is enabled
	 */
	isN8nLoggingEnabled(): boolean {
		return this.useN8nLogging && !!this.n8nCallback;
	}

	/**
	 * Adds the tracking callbacks directly to the model's callback list
	 */
	private addTrackingCallbacks(): void {
		const existingCallbacks = this.getCallbacksArray(this.originalModel.callbacks);

		// Add token tracking callback
		const newCallbacks = [...existingCallbacks, this.tokenCallback];

		// Add N8N logging callback if enabled
		if (this.n8nCallback) {
			newCallbacks.push(this.n8nCallback);
		}

		this.originalModel.callbacks = newCallbacks;
	}

	/**
	 * Extracts model name from the model instance
	 */
	private extractModelInfo(languageModel: BaseLanguageModel): ModelInfo {
		const modelInfo: ModelInfo = {
			provider: 'unknown',
			modelName: 'unknown',
		};
		try {
			// Method 1: _llmType property (most reliable) - call it if it's a function
			if ('_llmType' in languageModel) {
				const llmType = (languageModel as any)._llmType;
				if (typeof llmType === 'function') {
					modelInfo.provider = llmType();
				} else {
					modelInfo.provider = llmType;
				}
			}

			// Method 2: Constructor name analysis (fallback)
			if (!modelInfo.provider || modelInfo.provider === 'unknown') {
				const constructorName = languageModel.constructor.name.toLowerCase();

				if (constructorName.includes('openai')) {
					modelInfo.provider = 'openai';
				} else if (constructorName.includes('anthropic')) {
					modelInfo.provider = 'anthropic';
				} else if (constructorName.includes('azure')) {
					modelInfo.provider = 'azure_openai';
				} else if (constructorName.includes('cohere')) {
					modelInfo.provider = 'cohere';
				} else if (constructorName.includes('bedrock')) {
					modelInfo.provider = 'bedrock';
				} else if (constructorName.includes('ollama')) {
					modelInfo.provider = 'ollama';
				} else if (constructorName.includes('openrouter')) {
					modelInfo.provider = 'openrouter';
				} else if (constructorName.includes('router')) {
					modelInfo.provider = 'openrouter';
				}
			}

			// Extract model name from various possible properties
			// Special handling for Azure models - prioritize deployment name
			if (
				modelInfo.provider === 'azure_openai' &&
				'azureOpenAIApiDeploymentName' in languageModel
			) {
				modelInfo.modelName = (languageModel as any).azureOpenAIApiDeploymentName;
			} else if ('modelName' in languageModel) {
				modelInfo.modelName = (languageModel as any).modelName;
			} else if ('model' in languageModel) {
				modelInfo.modelName = (languageModel as any).model;
			} else if ('deploymentName' in languageModel) {
				modelInfo.modelName = (languageModel as any).deploymentName;
			} // Extract additional version information if available
			if ('modelVersion' in languageModel) {
				modelInfo.modelVersion = (languageModel as any).modelVersion;
			}

			// Create full model ID if possible
			if (modelInfo.modelName !== 'unknown') {
				modelInfo.modelId = modelInfo.modelVersion
					? `${modelInfo.modelName}-${modelInfo.modelVersion}`
					: modelInfo.modelName;
			}
		} catch (error) {
			console.warn('Could not extract complete model info:', error);
		}

		return modelInfo;
	}
	/**
	 * Converts callbacks to array format
	 */
	private getCallbacksArray(
		callbacks: Callbacks | undefined,
	): Array<BaseCallbackHandler | CallbackHandlerMethods> {
		if (!callbacks) return [];

		if (Array.isArray(callbacks)) {
			return callbacks;
		}

		// If it's a CallbackManager, extract its handlers
		return callbacks.handlers || [];
	}
}
