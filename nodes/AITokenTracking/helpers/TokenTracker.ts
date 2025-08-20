import type {
	TokenUsage,
	TokenTrackingData,
	TokenTrackingConfig
} from '../types';

export class TokenTracker {
	private config: TokenTrackingConfig;
	private sessionData: Map<string, TokenTrackingData>;
	private workflowId: string;
	private nodeId: string;

	constructor(config: TokenTrackingConfig, workflowId: string, nodeId: string) {
		this.config = config;
		this.sessionData = new Map();
		this.workflowId = workflowId;
		this.nodeId = nodeId;
	}

	/**
	 * Initializes a new tracking session
	 */
	initializeSession(sessionId: string): TokenTrackingData {
		const initialData: TokenTrackingData = {
			sessionId,
			workflowId: this.workflowId,
			nodeId: this.nodeId,
			usage: [],
			totalUsage: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
			},
			metadata: {
				startTime: new Date(),
				lastUpdate: new Date(),
				executionCount: 0,
			},
		};

		this.sessionData.set(sessionId, initialData);
		return initialData;
	}

	/**
	 * Records token usage for a session
	 */
	recordUsage(sessionId: string, usage: TokenUsage): TokenTrackingData {
		let sessionData = this.sessionData.get(sessionId);

		if (!sessionData) {
			sessionData = this.initializeSession(sessionId);
		}

		// Calculate cost if enabled and not already calculated
		let processedUsage = usage;

		// Add usage to history
		sessionData.usage.push(processedUsage);

		// Update totals
		sessionData.totalUsage.inputTokens += processedUsage.inputTokens;
		sessionData.totalUsage.outputTokens += processedUsage.outputTokens;
		sessionData.totalUsage.totalTokens += processedUsage.totalTokens;


		// Update metadata
		sessionData.metadata.lastUpdate = new Date();
		sessionData.metadata.executionCount++;

		// Manage history size
		if (sessionData.usage.length > this.config.storage.maxHistoryItems) {
			sessionData.usage = sessionData.usage.slice(-this.config.storage.maxHistoryItems);
		}

		this.sessionData.set(sessionId, sessionData);
		return sessionData;
	}

	/**
	 * Gets tracking data for a session
	 */
	getSessionData(sessionId: string): TokenTrackingData | undefined {
		return this.sessionData.get(sessionId);
	}

	/**
	 * Gets all session data
	 */
	getAllSessionData(): TokenTrackingData[] {
		return Array.from(this.sessionData.values());
	}

	/**
	 * Clears session data
	 */
	clearSession(sessionId: string): boolean {
		return this.sessionData.delete(sessionId);
	}

	/**
	 * Clears all session data
	 */
	clearAllSessions(): void {
		this.sessionData.clear();
	}

	/**
	 * Gets usage summary across all sessions
	 */
	getOverallSummary(): {
		totalSessions: number;
		totalInputTokens: number;
		totalOutputTokens: number;
		totalTokens: number;
	} {
		const sessions = this.getAllSessionData();

		const totals = sessions.reduce(
			(acc, session) => ({
				inputTokens: acc.inputTokens + session.totalUsage.inputTokens,
				outputTokens: acc.outputTokens + session.totalUsage.outputTokens,
				totalTokens: acc.totalTokens + session.totalUsage.totalTokens,

			}),
			{ inputTokens: 0, outputTokens: 0, totalTokens: 0}
		);

		return {
			totalSessions: sessions.length,
			totalInputTokens: totals.inputTokens,
			totalOutputTokens: totals.outputTokens,
			totalTokens: totals.totalTokens,
		};
	}

	/**
	 * Exports session data for persistence or reporting
	 */
	exportSessionData(sessionId?: string): TokenTrackingData[] {
		if (sessionId) {
			const sessionData = this.getSessionData(sessionId);
			return sessionData ? [sessionData] : [];
		}

		return this.getAllSessionData();
	}

	/**
	 * Imports session data from external source
	 */
	importSessionData(data: TokenTrackingData[]): void {
		for (const sessionData of data) {
			this.sessionData.set(sessionData.sessionId, sessionData);
		}
	}

	/**
	 * Generates unique session ID
	 */
	/**
	 * Generates a session ID for this tracker instance
	 */
	generateSessionId(executionId?: string): string {
		return TokenTracker.generateSessionId(this.workflowId, this.nodeId, executionId);
	}

	static generateSessionId(workflowId: string, nodeId: string, executionId?: string): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(7);
		const base = `${workflowId}-${nodeId}-${timestamp}-${random}`;

		if (executionId) {
			return `${base}-${executionId}`;
		}

		return base;
	}

	/**
	 * Validates token usage data
	 */
	static validateUsage(usage: TokenUsage): boolean {
		return (
			typeof usage.inputTokens === 'number' &&
			typeof usage.outputTokens === 'number' &&
			typeof usage.totalTokens === 'number' &&
			usage.inputTokens >= 0 &&
			usage.outputTokens >= 0 &&
			usage.totalTokens >= 0 &&
			usage.timestamp instanceof Date
		);
	}

	/**
	 * Creates a usage report for a session
	 */
	generateUsageReport(sessionId: string): {
		session: TokenTrackingData | null;
		summary: {
			executionCount: number;
			avgInputTokens: number;
			avgOutputTokens: number;
			avgTotalTokens: number;
			totalDuration: number;
		};
	} | null {
		const sessionData = this.getSessionData(sessionId);

		if (!sessionData) {
			return null;
		}

		const usageCount = sessionData.usage.length;
		const summary = {
			executionCount: usageCount,
			avgInputTokens: usageCount > 0 ? sessionData.totalUsage.inputTokens / usageCount : 0,
			avgOutputTokens: usageCount > 0 ? sessionData.totalUsage.outputTokens / usageCount : 0,
			avgTotalTokens: usageCount > 0 ? sessionData.totalUsage.totalTokens / usageCount : 0,
			totalDuration: sessionData.metadata.lastUpdate.getTime() - sessionData.metadata.startTime.getTime(),
		};


		return {
			session: sessionData,
			summary
		};
	}
}
