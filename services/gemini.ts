
import { ChatMessage } from "../types";

// IMPORTANT: Do not expose this key publicly. In a real app, this should be on a server.
// For this project, it's assumed to be in the environment variables.
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.warn("API_KEY environment variable not set. Using mock responses.");
}

/**
 * getDevAIChatResponse
 * - Uses dynamic import of `@google/genai` only when running server-side and an API key
 *   is available. This prevents bundling server-only code into the browser, which can
 *   cause a blank white page due to runtime errors.
 * - If no API key is present or code runs in the browser, a mocked response is returned.
 */
export const getDevAIChatResponse = async (history: ChatMessage[], newMessage: string): Promise<string> => {
  // If there's no API key or we're in the browser, return a mock response.
  if (!apiKey || typeof window !== 'undefined') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          "This is a mock response from DevAI. To use the real Gemini API, run this code server-side with the GEMINI_API_KEY set."
        );
      }, 700);
    });
  }

  try {
    // Dynamically import the server-only SDK so bundlers don't include it in client output.
    const mod = await import('@google/genai');
    const { GoogleGenAI } = mod as any;
    const ai = new GoogleGenAI({ apiKey });

    const chat = ai.chats.create({ model: 'gemini-2.5-pro' });
    const result = await chat.sendMessage({ message: newMessage });
    return result?.text ?? '';
  } catch (error) {
    console.error('Error fetching from Gemini API:', error);
    return 'Sorry, I encountered an error. Please try again later.';
  }
};
