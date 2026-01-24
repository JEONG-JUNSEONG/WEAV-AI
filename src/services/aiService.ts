import { GoogleGenAI } from "@google/genai";
import { AIModel, Message } from "../types";
import { VideoOptions } from "../components/chat/VideoOptions";

// 백엔드 API 클라이언트 사용
import { apiClient } from './apiClient';

// --- Configuration & Helpers ---
const requireEnv = (key: string, name: string): string => {
  // Vite uses import.meta.env
  const env = (import.meta as any).env;
  const value = env ? env[key] : undefined;
  if (!value) {
    console.warn(`[WEAV AI] Warning: ${name} (${key}) is missing.`);
    return "";
  }
  return value;
};

// --- Google GenAI Client ---
const getGoogleClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- OpenAI Helpers ---
const getOpenAIKey = () => {
  const key = requireEnv('VITE_OPENAI_API_KEY', 'OpenAI API Key');
  if (!key) throw new Error("OpenAI API Key (VITE_OPENAI_API_KEY)가 설정되지 않았습니다. .env 파일을 확인해주세요.");
  return key;
};

// OpenAI Streaming Helper
async function* streamOpenAI(modelName: string, prompt: string, history: Message[], systemInstruction?: string, signal?: AbortSignal) {
  try {
    const apiKey = getOpenAIKey();

    // Default System Prompt
    let finalSystemPrompt = systemInstruction || "You are a helpful assistant. Respond in Korean unless asked otherwise.";

    // Custom Persona Logic for GPT-5-mini (Instant)
    if (!systemInstruction && modelName === 'gpt-5-mini') {
      finalSystemPrompt = `당신은 OpenAI의 초고속 AI 모델인 ChatGPT-5.2 Instant입니다.
(이하 생략 - 기본 페르소나 유지)...`;
    }

    const messages = [
      { role: "system", content: finalSystemPrompt },
      ...history
        .filter(msg => msg.type === 'text' && !msg.isStreaming && msg.content.trim() !== '')
        .map(msg => ({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content })),
      { role: "user", content: prompt }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        stream: true
      }),
      signal // Pass AbortSignal
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${err}`);
    }
    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Ignore parsing errors for partial chunks
          }
        }
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('OpenAI Stream Aborted');
      return;
    }
    console.error("OpenAI Stream Error:", error);
    yield `\n[오류 발생: ${error.message}]`;
  }
}

// OpenAI Image Helper
async function generateOpenAIImage(modelName: string, prompt: string, signal?: AbortSignal): Promise<string | null> {
  const apiKey = getOpenAIKey();

  // DALL-E 3에서는 response_format이 지원됨
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json" // DALL-E 3에서는 지원됨
    }),
    signal
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Image Error: ${err}`);
  }

  const data = await response.json();

  // DALL-E 3에서는 b64_json이 지원됨
  const b64 = data.data?.[0]?.b64_json;
  if (b64) {
    return `data:image/png;base64,${b64}`;
  }

  // fallback: URL 방식 (CORS 문제가 있음)
  const imageUrl = data.data?.[0]?.url;
  if (imageUrl) {
    console.warn("Falling back to URL method due to CORS restrictions");
    return imageUrl; // URL을 그대로 반환 (표시는 되지만 다운로드는 안됨)
  }

  throw new Error("No image data received from OpenAI");
}

// OpenAI Video Helper (SORA)
async function generateOpenAIVideo(modelName: string, prompt: string, signal?: AbortSignal): Promise<string | null> {
  // ... (Legacy code, seemingly unused or for simple video calls)
  // We use generateVideo router instead.
  return null;
}

/**
 * Sanitize history for Gemini API.
 */
function sanitizeHistory(messages: Message[]) {
  const validMessages = messages.filter(
    msg => msg.type === 'text' && !msg.isStreaming && msg.content.trim() !== ''
  );

  const sanitized: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of validMessages) {
    const role = msg.role;
    const text = msg.content;

    if (sanitized.length === 0) {
      if (role === 'model') {
        sanitized.push({ role: 'user', parts: [{ text: "[이전 대화 내역 연동]" }] });
        sanitized.push({ role: 'model', parts: [{ text: text }] });
      } else {
        sanitized.push({ role, parts: [{ text }] });
      }
    } else {
      const lastMsg = sanitized[sanitized.length - 1];
      if (lastMsg.role === role) {
        lastMsg.parts[0].text += `\n\n${text}`;
      } else {
        sanitized.push({ role, parts: [{ text }] });
      }
    }
  }
  return sanitized;
}


// --- Access Control ---
const checkAccess = (modelId: string, user: any) => {
  // Guest User Constraints
  if (!user) {
    // Free Model for Guests
    if (modelId === 'gpt-5.2-instant') {
      return true;
    }
    throw new Error("Standard Membership Required");
  }
  // Logged-in users have full access (for now, based on instructions)
  return true;
};

// --- Main Service Export ---
export const aiService = {
  /**
   * Plan Project Structure based on User Goal
   */
  planProjectStructure: async (userGoal: string, user: any): Promise<{ projectName: string; steps: { title: string; modelId: string; systemInstruction: string }[] }> => {
    try {
      if (!user) throw new Error("로그인이 필요한 기능입니다.");

      const ai = getGoogleClient();
      const model = "gemini-3-pro-preview";

      const prompt = `
        You are an expert AI Project Manager. The user wants to achieve the following goal: "${userGoal}".
        
        Please design a project structure.
        
        **CRITICAL RULES:**
        1.  **Strict Model Selection:** You MUST ONLY use the Model IDs listed below. Do NOT invent new model IDs.
            - 'gpt-5.2-instant' (For brainstorming, simple text)
            - 'gemini-3-flash' (For general fast chat)
            - 'gpt-image-1.5' (For high-quality DALL-E 3 images)
            - 'nano-banana' (For fast illustrations/logos)
            - 'sora' (For video generation)
            
        2.  **Language:** The 'projectName' and 'title' (step names) MUST be in **Korean (한국어)**. The 'systemInstruction' should also be in Korean.
        
        3.  **Efficiency:** Create only the necessary steps to achieve the goal (Minimum 2, Maximum 5). Do NOT arbitrarily create 4 steps if 2 are enough. For simple requests (e.g., "Write a blog post"), 2 steps (Outline -> Writing) might be enough.

        Return ONLY raw JSON in the following format:
        {
          "projectName": "프로젝트 이름 (Korean)",
          "steps": [
            {
              "title": "단계 1: [작업명] (Korean)",
              "modelId": "[Exact Model ID from list above]",
              "systemInstruction": "[Persona and detailed instruction in Korean]"
            }
          ]
        }
        `;

      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json"
        }
      });

      let text = response.text || "";
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      if (!text) throw new Error("Empty response from AI Planner");

      return JSON.parse(text);
    } catch (error) {
      console.error("Project Planning Error:", error);
      throw error; // Rethrow to handle in UI
    }
  },

  /**
   * Generate Video (백엔드 Jobs API — 비동기, 폴링)
   */
  generateVideo: async (model: AIModel, prompt: string, videoOptions: VideoOptions, user: any, signal?: AbortSignal): Promise<string | null> => {
    const jobData = {
      provider: model.provider || 'openai',
      model_id: model.id,
      arguments: {
        prompt,
        duration: videoOptions.duration,
        resolution: videoOptions.resolution,
        aspect_ratio: videoOptions.aspectRatio,
        style: videoOptions.style
      },
      store_result: true
    };

    const createRes = (await apiClient.post('/api/v1/jobs/', jobData)) as { id?: string };
    const jobId = createRes.id;
    if (!jobId) throw new Error('작업 ID를 받지 못했습니다.');

    const poll = async (): Promise<string | null> => {
      if (signal?.aborted) throw new Error('비디오 생성이 중단되었습니다.');
      const detail = (await apiClient.get(`/api/v1/jobs/${jobId}/`)) as { status: string; result?: { url?: string; text?: string }; error?: string };
      if (detail.status === 'COMPLETED') {
        if (detail.result?.url) return detail.result.url;
        throw new Error('비디오 생성 결과를 받지 못했습니다.');
      }
      if (detail.status === 'FAILED') {
        throw new Error(detail.error || '비디오 생성에 실패했습니다.');
      }
      await new Promise(r => setTimeout(r, 2000));
      return poll();
    };

    return poll();
  },

  // --- Helper Functions ---

  // Sora 2 API Implementation
  generateSora2Video: async (prompt: string, options: VideoOptions, signal?: AbortSignal): Promise<string | null> => {
    const apiKey = getOpenAIKey();

    // 1. Parse Options
    const rawSeconds = parseInt(options.duration.replace(/[^0-9]/g, '')) || 8;

    // Sora 2 only supports 4, 8, 12 seconds
    let seconds = "8";
    if (rawSeconds <= 6) seconds = "4";
    else if (rawSeconds <= 10) seconds = "8";
    else seconds = "12";

    // Resolution & Aspect Ratio Logic
    // Supported: '720x1280', '1280x720', '1024x1792', '1792x1024'
    const isPortrait = options.aspectRatio === '9:16' || options.aspectRatio === '3:4';
    let size = '1280x720'; // Default Landscape

    if (options.resolution === '1080p') {
      // High Quality
      size = isPortrait ? '1024x1792' : '1792x1024';
    } else {
      // Standard (720p or default)
      size = isPortrait ? '720x1280' : '1280x720';
    }

    // 2. Start Render Job
    const createRes = await fetch("/api/openai/v1/videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "sora-2",
        prompt: prompt,
        size: size,
        seconds: seconds
      }),
      signal
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Sora 2 Creation Error (${createRes.status}): ${err}`);
    }

    const job = await createRes.json();
    const videoId = job.id;

    // 3. Poll for Completion
    let status = job.status;
    let attempts = 0;
    const maxAttempts = 120; // ~4 minutes (2s interval)
    let curPollData = job;

    // If completed immediately
    if (status === 'completed') {
      // proceed
    } else {
      while (status === 'queued' || status === 'in_progress') {
        if (signal?.aborted) throw new Error("Video generation aborted by user.");
        if (attempts++ > maxAttempts) throw new Error("Video generation timed out.");

        await new Promise(r => setTimeout(r, 2000));

        const pollRes = await fetch(`/api/openai/v1/videos/${videoId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
          signal
        });

        if (!pollRes.ok) {
          throw new Error(`Polling Error (${pollRes.status})`);
        }

        curPollData = await pollRes.json();
        status = curPollData.status;
      }
    }

    if (status === 'failed') {
      const errorMsg = curPollData.error?.message || JSON.stringify(curPollData.error) || "Unknown Error";
      throw new Error(`Sora 2 Generation Failed: ${errorMsg}`);
    }

    // 4. Fetch Content (Authorization required, so we fetch Blob)
    const contentRes = await fetch(`/api/openai/v1/videos/${videoId}/content`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal
    });

    if (!contentRes.ok) {
      throw new Error(`Failed to download video content (${contentRes.status})`);
    }

    const blob = await contentRes.blob();
    return URL.createObjectURL(blob);
  },


  /**
   * Generate Image (백엔드 Jobs API — 비동기, 폴링)
   */
  generateImage: async (model: AIModel, prompt: string, user: any, signal?: AbortSignal): Promise<string | null> => {
    const jobData = {
      provider: model.provider || 'openai',
      model_id: model.id,
      arguments: { prompt },
      store_result: true
    };

    const createRes = (await apiClient.post('/api/v1/jobs/', jobData)) as { id?: string };
    const jobId = createRes.id;
    if (!jobId) throw new Error('작업 ID를 받지 못했습니다.');

    const poll = async (): Promise<string | null> => {
      if (signal?.aborted) throw new Error('이미지 생성이 중단되었습니다.');
      const detail = (await apiClient.get(`/api/v1/jobs/${jobId}/`)) as { status: string; result?: { url?: string; text?: string }; error?: string };
      if (detail.status === 'COMPLETED') {
        if (detail.result?.url) return detail.result.url;
        throw new Error('이미지 생성 결과를 받지 못했습니다.');
      }
      if (detail.status === 'FAILED') {
        throw new Error(detail.error || '이미지 생성에 실패했습니다.');
      }
      await new Promise(r => setTimeout(r, 1500));
      return poll();
    };

    return poll();
  },

  /**
   * Generate Text Stream (Routes to Google or OpenAI)
   */
  generateTextStream: async function* (model: AIModel, prompt: string, history: Message[] = [], systemInstruction?: string, user?: any, signal?: AbortSignal) {
    try {
      checkAccess(model.id, user);
    } catch (e: any) {
      yield `\n[오류: ${e.message}]`;
      return;
    }

    // 백엔드 API를 통한 스트리밍은 아직 미구현이므로, 
    // 임시로 기존 직접 호출 방식 유지 (추후 백엔드 스트리밍 지원 시 변경)
    // TODO: 백엔드에서 Server-Sent Events (SSE) 또는 WebSocket 지원 시 변경

    if (model.category === 'GPT') {
      yield* streamOpenAI(model.apiModelName, prompt, history, systemInstruction, signal);
      return;
    }

    try {
      const ai = getGoogleClient();

      let finalSystemInstruction = systemInstruction || "You are a helpful and intelligent AI assistant. Unless requested otherwise, please respond in Korean.";

      if (!systemInstruction && model.apiModelName === 'gemini-2.5-flash-lite') {
        finalSystemInstruction = `당신은 Google의 최신 AI 모델인 Gemini 3 Flash Preview입니다... (이하 생략)`;
      }

      const sdkHistory = sanitizeHistory(history);

      const chat = ai.chats.create({
        model: model.apiModelName,
        history: sdkHistory,
        config: {
          systemInstruction: finalSystemInstruction,
        }
      });

      const result = await chat.sendMessageStream({ message: prompt });

      for await (const chunk of result) {
        if (signal?.aborted) {
          break;
        }
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (error: any) {
      if (signal?.aborted) return;
      console.error("Text Generation Error (Gemini):", error);
      yield `\n[오류 발생: ${error.message || "Gemini API Error"}]`;
    }
  }
};