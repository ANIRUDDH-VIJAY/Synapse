import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define our model fallback chain, from best quality to highest availability
const MODELS_TO_TRY = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
];

/**
 * Transforms an OpenAI-formatted message array into a Gemini-formatted history array.
 * @param {Array<Object>} messages - The array of messages from the database.
 * @returns {Array<Object>} A Gemini-compatible history array.
 */
function buildGeminiHistory(messages) {
    // We must ensure that the roles alternate (user, model, user, model...)
    // and that the history doesn't start with a 'model' role.
    
    // Filter out any "empty" messages and find the first user message
    const validMessages = messages.filter(m => m.content);
    const firstUserIndex = validMessages.findIndex(m => m.role === 'user');
    
    if (firstUserIndex === -1) {
        // No user messages found, return an empty history
        return [];
    }

    // Start the history from the first user message
    // THIS IS THE CORRECTED LINE 32:
    const roleAlternatingHistory = validMessages.slice(firstUserIndex);

    let lastRole = null;
    const filteredHistory = [];

    // THIS IS THE CORRECTED LINE 39 (approx):
    for (const msg of roleAlternatingHistory) {
        const currentRole = msg.role === "assistant" ? "model" : "user";
        
        // Skip if the role is the same as the last one
        if (currentRole === lastRole) {
            continue;
        }

        filteredHistory.push({
            role: currentRole,
            parts: [{ text: msg.content }],
        });
        lastRole = currentRole;
    }

    return filteredHistory;
}

/**
 * Gets a stateful, conversational response from the Gemini API,
 * with automatic fallback logic.
 * @param {Array<Object>} messages - The *entire* message history from the DB.
 */
async function getGeminiAPIResponse(messages) {
    // The *last* message in the array is the new user prompt.
    const newPromptMsg = messages[messages.length - 1];

    // The *rest* of the messages are the conversation history.
    const historyMsgs = messages.slice(0, -1);
    
    // Transform the history messages into Gemini's format.
    const geminiHistory = buildGeminiHistory(historyMsgs);

    let lastKnownError = null;

    // Loop through our model list
    for (const modelName of MODELS_TO_TRY) {
        console.log(`Attempting to use model: ${modelName}`);
        try {
            // Get the model
            const model = genAI.getGenerativeModel({ model: modelName });
            
            // Start a new chat session with the transformed history
            const chat = model.startChat({
                history: geminiHistory,
            });

            // Send the new prompt
            const result = await chat.sendMessage(newPromptMsg.content);
            const response = await result.response;
            const text = response.text();
            
            console.log(`Success with model: ${modelName}`);
            return text; // Success! Return the text.

        } catch (err) {
            console.warn(`Model ${modelName} failed. Checking error...`);
            lastKnownError = err;

            // Check if the error is a rate limit error (HTTP 429)
            // If it is, we'll let the loop continue to the next model.
            if (err.message && err.message.includes("429")) {
                console.log(`Rate limit hit for ${modelName}. Trying next model...`);
                continue; 
            } else {
                // This is a different, more serious error (e.g., auth, safety, bad input)
                // We should stop and throw this error immediately.
                console.error("A non-recoverable error occurred:", err);
                throw err;
            }
        }
    }

    // If the loop finishes, it means all models failed (likely all rate limited)
    console.error("All models failed. Throwing last known error.");
    throw new Error(`All Gemini models are unavailable. Last error: ${lastKnownError.message}`);
}

export default getGeminiAPIResponse;