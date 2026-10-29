// src/services/gemini.js
import { GoogleGenAI } from '@google/genai';

// Initialize with your Vite environment variable
const ai = new GoogleGenAI({ 
  apiKey: import.meta.env.VITE_GEMINI_API_KEY 
});

// Function to start a conversational chat session
export function createChatSession() {
  return ai.chats.create({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: "You are an empathetic, insightful health and meal assistant.",
    }
  });
}