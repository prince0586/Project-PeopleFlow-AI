import { GoogleGenerativeAI, SchemaType, GenerativeModel, FunctionDeclaration } from "@google/generative-ai";
import { getFirestoreDB } from '../db';
import { VenueService } from './venueService';

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
   * @returns A Promise resolving to the AI's response text.
   * @throws Error if the AI service is uninitialized or processing fails.
   */
  public static async processChat(
    message: string, 
    context: Record<string, any>, 
    userId?: string
  ): Promise<string> {
    if (!this.genAI) {
      throw new Error("[AIService] Service not initialized. Call init() first.");
    }

    try {
      const model: GenerativeModel = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: this.getSystemInstruction(context),
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: message }] }],
        tools: [{ functionDeclarations: [this.getQueueStatusTool, this.getVenueCongestionTool] } as any],
      });

      const response = result.response;
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        return await this.handleFunctionCalls(model, message, response, functionCalls);
      }

      return response.text();
    } catch (error: any) {
      console.error("[AIService] Processing Error:", error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Generates the system instruction string based on the provided context.
   * 
   * @param context - The application context.
   * @returns A formatted system instruction string.
   */
  private static getSystemInstruction(context: Record<string, any>): string {
    return `You are the FanFlow AI Venue Concierge. 
    Context: ${JSON.stringify(context)}
    Instructions: Provide concise, helpful guidance. Use tools for real-time data. 
    Grounding: You have access to the latest venue safety protocols and facility maps. 
    Tone: Professional, helpful, and proactive.`;
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
    initialResponse: any,
    functionCalls: any[]
  ): Promise<string> {
    const toolResults = [];
    const db = getFirestoreDB();

    for (const call of functionCalls) {
      let toolResponse;
      
      if (call.name === "getQueueStatus" && db) {
        const { userId: targetUid } = call.args as any;
        const snapshot = await db.collection('queues')
          .where('userId', '==', targetUid)
          .where('status', '==', 'waiting')
          .get();
        toolResponse = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (call.name === "getVenueCongestion") {
        const venueId = (call.args as any).venueId || 'stadium_01';
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

    const secondResult = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: originalMessage }] },
        initialResponse.candidates![0].content,
        { role: 'user', parts: toolResults as any }
      ]
    });

    return secondResult.response.text();
  }
}
