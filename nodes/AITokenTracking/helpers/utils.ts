/**
 * Utility functions for AI Token Tracking
 */

/**
 * Generates a unique session ID
 */
export function generateSessionId(workflowId: string, nodeId: string, executionId?: string): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(7);
	const base = `${workflowId}-${nodeId}-${timestamp}-${random}`;

	if (executionId) {
		return `${base}-${executionId}`;
	}

	return base;
}
