import * as functions from "firebase-functions";
import axios from "axios";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const getChatbotResponse = functions.https.onCall(async (data, context) => {
    const { message } = data;

    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated.");
    }

    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            "contents": [{
                "parts": [{
                    "text": message
                }]
            }]
        });

        return { response: response.data.candidates[0].content.parts[0].text };

    } catch (error) {
        functions.logger.error(error);
        throw new functions.https.HttpsError("internal", "Failed to get chatbot response.");
    }
});
