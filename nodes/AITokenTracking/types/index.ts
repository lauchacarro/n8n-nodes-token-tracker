export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	modelName?: string;
	provider?: string;
	timestamp: Date;
}

// Simplified configuration - minimal config needed internally
export interface TokenTrackingConfig {
	tracking: {
		enableInputTokens: boolean;
		enableOutputTokens: boolean;
	};
	storage: {
		storageMode: 'memory' | 'workflow-data';
		maxHistoryItems: number;
	};
}

export interface TokenTrackingData {
	sessionId: string;
	workflowId: string;
	nodeId: string;
	usage: TokenUsage[];
	totalUsage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
	metadata: {
		startTime: Date;
		lastUpdate: Date;
		executionCount: number;
	};
}

export interface AIModelResponse {
	response: any;
	usage?: TokenUsage;
	metadata?: {
		modelName?: string;
		provider?: string;
		executionTime?: number;
	};
}

export type StorageMode = 'memory' | 'workflow-data';
