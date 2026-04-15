import { GoogleGenerativeAI, SchemaType, GenerativeModel } from "@google/generative-ai";
import { getFirestoreDB } from '../db';
import { VenueService } from './venueService';

/**
 * AIService
 * 
 * Orchestrates interactions with Google Gemini 1.5 Flash.
 * Handles tool definitions, function calling logic, and context-aware chat processing.
 */
export class AIService {
  private static genAI: GoogleGenerativeAI;

  /**
   * Initializes the Gemini AI SDK with the provided API key.
   * @param apiKey - The Google AI API key.
   */
  static init(apiKey: string): void {
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("AIService: GEMINI_API_KEY is not configured correctly.");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * AI Tool Declaration: getQueueStatus
   * Allows the model to retrieve real-time queue information for a specific user.
   */
  private static getQueueStatusTool = {
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
   * AI Tool Declaration: getVenueCongestion
   * Allows the model to retrieve real-time congestion data for the venue.
   */
  private static getVenueCongestionTool = {
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
   * @param message - The user's input message.
   * @param context - Additional context (e.g., current venue, user preferences).
   * @param userId - The ID of the authenticated user.
   * @returns The AI's response text.
   */
  static async processChat(message: string, context: Record<string, any>, userId?: string): Promise<string> {
    if (!this.genAI) {
      throw new Error("AIService: Service not initialized. Call init() first.");
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: `You are the FanFlow AI Venue Concierge. 
        Context: ${JSON.stringify(context)}
        Instructions: Provide concise, helpful guidance. Use tools for real-time data. 
        Grounding: You have access to the latest venue safety protocols and facility maps.`,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: message }] }],
        tools: [{ functionDeclarations: [this.getQueueStatusTool, this.getVenueCongestionTool] } as any],
      });

      const response = result.response;
      const functionCalls = response.functionCalls();

      // Handle Function Calling
      if (functionCalls && functionCalls.length > 0) {
        const toolResults = [];
        const db = getFirestoreDB();

        for (const call of functionCalls) {
          let toolResponse;
          
          if (call.name === "getQueueStatus" && db) {
            const { userId: uid } = call.args as any;
            const snapshot = await db.collection('queues')
              .where('userId', '==', uid)
              .where('status', '==', 'waiting')
              .get();
            toolResponse = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          } else if (call.name === "getVenueCongestion") {
            const venue = await VenueService.getVenueData((call.args as any).venueId || 'stadium_01');
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

        // Generate final response with tool outputs
        const secondResult = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: message }] },
            response.candidates![0].content,
            { role: 'user', parts: toolResults as any }
          ]
        });

        return secondResult.response.text();
      }

      return response.text();
    } catch (error: any) {
      console.error("AIService Error:", error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }
}
