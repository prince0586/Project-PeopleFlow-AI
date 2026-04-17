import { GoogleGenerativeAI, SchemaType, GenerativeModel, FunctionDeclaration } from "@google/generative-ai";
import { executeWithFirestoreFallback } from '../db';
import { VenueService } from './venueService';
import { ChatContext, ChatHistoryItem } from '../../src/types';

/**
 * AIService
 * 
 * Orchestrates interactions with Google Gemini 1.5 Flash.
 * Handles tool definitions, function calling logic, and context-aware chat processing.
 * 
 * @category Services
 */
export class AIService {
  private static genAI: GoogleGenerativeAI;

  /**
   * Initializes the Gemini AI SDK with the provided API key.
   * 
   * @param apiKey - The Google AI API key from environment variables.
   * @throws Error if the API key is missing or invalid.
   */
  public static init(apiKey: string): void {
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("[AIService] Warning: GEMINI_API_KEY is not configured correctly.");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Tool Declaration: getQueueStatus
   * Allows the model to retrieve real-time queue information for a specific user.
   */
  private static readonly getQueueStatusTool: FunctionDeclaration = {
    name: "getQueueStatus",
    description: "Get the current status and estimated wait time for the user's active queue tokens.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userId: { type: SchemaType.STRING, description: "The unique ID of the user." }
      },
      required: ["userId"]
    }
  };

  /**
   * Tool Declaration: getVenueCongestion
   * Allows the model to retrieve real-time congestion data for the venue.
   */
  private static readonly getVenueCongestionTool: FunctionDeclaration = {
    name: "getVenueCongestion",
    description: "Get the current congestion level and gate status for the venue.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        venueId: { type: SchemaType.STRING, description: "The unique ID of the venue." }
      },
      required: ["venueId"]
    }
  };

  /**
   * Processes a user's chat message using Gemini 1.5 Flash.
   * Supports multi-turn conversations and function calling for real-time data access.
   * 
   * @param message - The user's input message string.
   * @param context - Additional context (e.g., current venue, user preferences).
   * @param userId - The ID of the authenticated user for personalization.
   * @param history - Optional chat history for multi-turn conversation.
   * @returns A Promise resolving to the AI's response text.
   * @throws Error if the AI service is uninitialized or processing fails.
   */
  public static async processChat(
    message: string, 
    context: ChatContext, 
    userId?: string,
    history: ChatHistoryItem[] = []
  ): Promise<string> {
    if (!this.genAI) {
      throw new Error("[AIService] Service not initialized. Call init() first.");
    }

    try {
      const model: GenerativeModel = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: this.getSystemInstruction(context, userId),
      });

      // Log interaction to Firestore for future personalization
      if (userId) {
        this.logInteraction(userId, message);
      }

      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        })),
        tools: [{ functionDeclarations: [this.getQueueStatusTool, this.getVenueCongestionTool] } as any],
      });

      const result = await chat.sendMessage(message);
      const response = result.response;
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        return await this.handleFunctionCalls(model, message, response, functionCalls, history);
      }

      return response.text();
    } catch (error: any) {
      console.error("[AIService] Processing Error:", error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Logs a user interaction to Firestore for personalization.
   */
  private static async logInteraction(userId: string, message: string): Promise<void> {
    const logData = {
      userId,
      message,
      timestamp: new Date().toISOString()
    };

    try {
      await executeWithFirestoreFallback(async (db) => {
        await db.collection('user_interactions').add(logData);
      });
    } catch (err: any) {
      console.error("[AIService] Failed to log interaction:", err.message || err);
    }
  }

  /**
   * Generates the system instruction string based on the provided context.
   * 
   * @param context - The application context.
   * @param userId - Optional user ID for personalization.
   * @returns A formatted system instruction string.
   */
  private static getSystemInstruction(context: ChatContext, userId?: string): string {
    const venueDetails = `
      Venue: Global Arena (stadium_01)
      Capacity: 55,000
      Facilities: 
        - North Gate (Accessible, High Capacity)
        - South Gate (Standard)
        - East Gate (VIP & Premium)
        - West Gate (Accessible, Express)
      Amenities: 12 Concession stands, 8 Restroom blocks (all ADA compliant), 4 First Aid stations.
      Safety: Emergency exits are clearly marked in green. In case of emergency, follow staff instructions.
    `;

    return `You are the FanFlow AI Venue Concierge. 
    ${venueDetails}
    Current Context: ${JSON.stringify(context)}
    User ID: ${userId || 'Guest'}
    
    Instructions: 
    1. Provide concise, helpful guidance for fans at the venue.
    2. Use tools to check real-time queue status or venue congestion if asked.
    3. If the user has active queue tokens, acknowledge them.
    4. Be proactive: if congestion is high, suggest alternative gates.
    5. Tone: Professional, helpful, and proactive.
    6. Personalization: If you know the user's name or past interactions (from context), use them to be more helpful.`;
  }

  /**
   * Handles the execution of function calls requested by the AI model.
   * 
   * @param model - The generative model instance.
   * @param originalMessage - The user's original input.
   * @param initialResponse - The initial response from the model containing function calls.
   * @param functionCalls - The list of function calls to execute.
   * @returns A Promise resolving to the final AI response text.
   */
  private static async handleFunctionCalls(
    model: GenerativeModel,
    originalMessage: string,
    initialResponse: unknown,
    functionCalls: any[], // FunctionCall is a complex type from library, keep for now or use casting
    history: ChatHistoryItem[] = []
  ): Promise<string> {
    const toolResults = [];

    for (const call of functionCalls) {
      let toolResponse;
      
      if (call.name === "getQueueStatus") {
        const args = call.args as { userId: string };
        const { userId: targetUid } = args;
        try {
          toolResponse = await executeWithFirestoreFallback(async (db) => {
            const snapshot = await db.collection('queues')
              .where('userId', '==', targetUid)
              .where('status', '==', 'waiting')
              .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          });
        } catch (err: unknown) {
          toolResponse = [];
        }
      } else if (call.name === "getVenueCongestion") {
        const args = (call.args as { venueId?: string }) || {};
        const venueId = args.venueId || 'stadium_01';
        const venue = await VenueService.getVenueData(venueId);
        toolResponse = { 
          congestion: venue.congestionLevel, 
          status: venue.congestionLevel > 0.7 ? "High" : "Normal", 
          gates: venue.gates.map(g => g.name) 
        };
      }

      toolResults.push({
        functionResponse: { name: call.name, response: { result: toolResponse } }
      });
    }

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      })),
      tools: [{ functionDeclarations: [this.getQueueStatusTool, this.getVenueCongestionTool] } as any],
    });

    // We need to send the function response back to the chat
    const secondResult = await chat.sendMessage(toolResults as any);

    return secondResult.response.text();
  }
}
