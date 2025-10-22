
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

// IMPORTANT: Do not expose this key publicly. In a real app, this should be on a server.
// For this project, it's assumed to be in the environment variables.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY environment variable not set. Using mock responses.");
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const getDevAIChatResponse = async (history: ChatMessage[], newMessage: string): Promise<string> => {
  if (!ai) {
    // Mock response if API key is not available
    return new Promise(resolve => {
        setTimeout(() => {
            resolve("This is a mock response from DevAI. To use the real Gemini API, please set your API_KEY environment variable.");
        }, 1000);
    });
  }

  try {
    const chat = ai.chats.create({ model: 'gemini-2.5-pro' });
    const result = await chat.sendMessage({ message: newMessage });
    return result.text;
  } catch (error) {
    console.error("Error fetching from Gemini API:", error);
    return "Sorry, I encountered an error. Please try again later.";
  }
};
