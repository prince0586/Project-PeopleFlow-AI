import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- Function Declarations ---

const getQueueStatus: FunctionDeclaration = {
  name: "getQueueStatus",
  description: "Get the current status and estimated wait time for the user's active queue tokens.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: { type: Type.STRING, description: "The unique ID of the user." }
    },
    required: ["userId"]
  }
};

const getVenueCongestion: FunctionDeclaration = {
  name: "getVenueCongestion",
  description: "Get the current congestion level and gate status for the venue.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      venueId: { type: Type.STRING, description: "The unique ID of the venue." }
    },
    required: ["venueId"]
  }
};

export async function getVenueGuidance(userMessage: string, context: any, tools_execution_map: Record<string, Function>) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction: `You are the FanFlow AI Venue Concierge for a large sporting stadium. 
        Your goal is to provide real-time guidance to attendees.
        Current Context: ${JSON.stringify(context)}
        Be helpful, concise, and professional. Use the provided tools to fetch real-time data if the user asks about their queue or venue status.`,
        temperature: 0.7,
        tools: [{ functionDeclarations: [getQueueStatus, getVenueCongestion] }]
      },
    });

    const functionCalls = response.functionCalls;
    if (functionCalls) {
      const toolResults = [];
      for (const call of functionCalls) {
        const fn = tools_execution_map[call.name];
        if (fn) {
          const result = await fn(call.args);
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { result },
              id: call.id
            }
          });
        }
      }

      // Second call to Gemini with tool results
      const secondResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: userMessage }] },
          response.candidates[0].content,
          { role: 'user', parts: toolResults as any }
        ],
        config: {
          systemInstruction: `You are the FanFlow AI Venue Concierge. Use the tool results to answer the user's question accurately.`,
        }
      });

      return secondResponse.text;
    }

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm sorry, I'm having trouble connecting to my knowledge base. Please try again later.";
  }
}
