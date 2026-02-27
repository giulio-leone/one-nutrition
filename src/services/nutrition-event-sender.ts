/**
 * NutritionEventSender
 *
 * Formats and sends Server-Sent Events (SSE) for nutrition generation streaming.
 * Encapsulates the SSE protocol so the agent logic stays clean.
 */

// --- Port (Interface) ---

export interface NutritionEventSender {
  sendAgentStart(agentId: string, message: string): void;
  sendAgentProgress(agentId: string, progress: number, message: string): void;
  sendAgentError(
    agentId: string,
    error: { message: string },
    fatal: boolean,
  ): void;
  sendComplete(
    result: Record<string, unknown>,
    metadata: {
      duration: number;
      model: string;
      tokensUsed: number;
      summary: string;
      warnings: string[];
      recommendations: string[];
    },
  ): void;
}

// --- Adapter (Implementation) ---

function sendSSE(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: string,
  data: unknown,
): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  try {
    controller.enqueue(encoder.encode(payload));
  } catch {
    // Stream may already be closed — ignore
  }
}

/**
 * Factory: create an event sender bound to a ReadableStream controller.
 */
export function createNutritionEventSender(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
): NutritionEventSender {
  return {
    sendAgentStart(agentId, message) {
      sendSSE(controller, encoder, 'agent_start', {
        agentId,
        message,
        timestamp: new Date().toISOString(),
      });
    },

    sendAgentProgress(agentId, progress, message) {
      sendSSE(controller, encoder, 'agent_progress', {
        agentId,
        progress,
        message,
        timestamp: new Date().toISOString(),
      });
    },

    sendAgentError(agentId, error, fatal) {
      sendSSE(controller, encoder, 'agent_error', {
        agentId,
        error,
        fatal,
        timestamp: new Date().toISOString(),
      });
    },

    sendComplete(result, metadata) {
      sendSSE(controller, encoder, 'complete', {
        result,
        metadata,
        timestamp: new Date().toISOString(),
      });
    },
  };
}
