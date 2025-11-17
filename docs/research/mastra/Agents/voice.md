# Adding Voice to Agents | Agents

Mastra agents can be enhanced with voice capabilities, allowing them to speak responses and listen to user input. You can configure an agent to use either a single voice provider or combine multiple providers for different operations.

Source: https://mastra.ai/docs/agents/adding-voice

---

# Adding Voice to Agents

Mastra agents can be enhanced with voice capabilities, allowing them to speak responses and listen to user input. You can configure an agent to use either a single voice provider or combine multiple providers for different operations. 

## Basic usage​

The simplest way to add voice to an agent is to use a single provider for both speaking and listening: 

```
import { createReadStream } from "fs";import path from "path";import { Agent } from "@mastra/core/agent";import { OpenAIVoice } from "@mastra/voice-openai";import { openai } from "@ai-sdk/openai";// Initialize the voice provider with default settingsconst voice = new OpenAIVoice();// Create an agent with voice capabilitiesexport const agent = new Agent({  name: "Agent",  instructions: `You are a helpful assistant with both STT and TTS capabilities.`,  model: openai("gpt-4o"),  voice,});// The agent can now use voice for interactionconst audioStream = await agent.voice.speak("Hello, I'm your AI assistant!", {  filetype: "m4a",});playAudio(audioStream!);try {  const transcription = await agent.voice.listen(audioStream);  console.log(transcription);} catch (error) {  console.error("Error transcribing audio:", error);}
```

## Working with Audio Streams​

The `speak()`and `listen()`methods work with Node.js streams. Here's how to save and load audio files: 

### Saving Speech Output​

The `speak`method returns a stream that you can pipe to a file or speaker. 

```
import { createWriteStream } from "fs";import path from "path";// Generate speech and save to fileconst audio = await agent.voice.speak("Hello, World!");const filePath = path.join(process.cwd(), "agent.mp3");const writer = createWriteStream(filePath);audio.pipe(writer);await new Promise<void>((resolve, reject) => {  writer.on("finish", () => resolve());  writer.on("error", reject);});
```

### Transcribing Audio Input​

The `listen`method expects a stream of audio data from a microphone or file. 

```
import { createReadStream } from "fs";import path from "path";// Read audio file and transcribeconst audioFilePath = path.join(process.cwd(), "/agent.m4a");const audioStream = createReadStream(audioFilePath);try {  console.log("Transcribing audio file...");  const transcription = await agent.voice.listen(audioStream, {    filetype: "m4a",  });  console.log("Transcription:", transcription);} catch (error) {  console.error("Error transcribing audio:", error);}
```

## Speech-to-Speech Voice Interactions​

For more dynamic and interactive voice experiences, you can use real-time voice providers that support speech-to-speech capabilities: 

```
import { Agent } from "@mastra/core/agent";import { getMicrophoneStream } from "@mastra/node-audio";import { OpenAIRealtimeVoice } from "@mastra/voice-openai-realtime";import { search, calculate } from "../tools";// Initialize the realtime voice providerconst voice = new OpenAIRealtimeVoice({  apiKey: process.env.OPENAI_API_KEY,  model: "gpt-4o-mini-realtime",  speaker: "alloy",});// Create an agent with speech-to-speech voice capabilitiesexport const agent = new Agent({  name: "Agent",  instructions: `You are a helpful assistant with speech-to-speech capabilities.`,  model: openai("gpt-4o"),  tools: {    // Tools configured on Agent are passed to voice provider    search,    calculate,  },  voice,});// Establish a WebSocket connectionawait agent.voice.connect();// Start a conversationagent.voice.speak("Hello, I'm your AI assistant!");// Stream audio from a microphoneconst microphoneStream = getMicrophoneStream();agent.voice.send(microphoneStream);// When done with the conversationagent.voice.close();
```

### Event System​

The realtime voice provider emits several events you can listen for: 

```
// Listen for speech audio data sent from voice provideragent.voice.on("speaking", ({ audio }) => {  // audio contains ReadableStream or Int16Array audio data});// Listen for transcribed text sent from both voice provider and useragent.voice.on("writing", ({ text, role }) => {  console.log(`${role} said: ${text}`);});// Listen for errorsagent.voice.on("error", (error) => {  console.error("Voice error:", error);});
```

## Examples​

### End-to-end voice interaction​

This example demonstrates a voice interaction between two agents. The hybrid voice agent, which uses multiple providers, speaks a question, which is saved as an audio file. The unified voice agent listens to that file, processes the question, generates a response, and speaks it back. Both audio outputs are saved to the `audio`directory. 

The following files are created: 

- hybrid-question.mp3 – Hybrid agent's spoken question.
- unified-response.mp3 – Unified agent's spoken response.

src/test-voice-agents.ts 
```
import "dotenv/config";import path from "path";import { createReadStream } from "fs";import { Agent } from "@mastra/core/agent";import { CompositeVoice } from "@mastra/core/voice";import { OpenAIVoice } from "@mastra/voice-openai";import { Mastra } from "@mastra/core/mastra";import { openai } from "@ai-sdk/openai";// Saves an audio stream to a file in the audio directory, creating the directory if it doesn't exist.export const saveAudioToFile = async (  audio: NodeJS.ReadableStream,  filename: string,): Promise<void> => {  const audioDir = path.join(process.cwd(), "audio");  const filePath = path.join(audioDir, filename);  await fs.promises.mkdir(audioDir, { recursive: true });  const writer = createWriteStream(filePath);  audio.pipe(writer);  return new Promise((resolve, reject) => {    writer.on("finish", resolve);    writer.on("error", reject);  });};// Saves an audio stream to a file in the audio directory, creating the directory if it doesn't exist.export const convertToText = async (  input: string | NodeJS.ReadableStream,): Promise<string> => {  if (typeof input === "string") {    return input;  }  const chunks: Buffer[] = [];  return new Promise((resolve, reject) => {    input.on("data", (chunk) => chunks.push(Buffer.from(chunk)));    input.on("error", reject);    input.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));  });};export const hybridVoiceAgent = new Agent({  name: "hybrid-voice-agent",  model: openai("gpt-4o"),  instructions: "You can speak and listen using different providers.",  voice: new CompositeVoice({    input: new OpenAIVoice(),    output: new OpenAIVoice(),  }),});export const unifiedVoiceAgent = new Agent({  name: "unified-voice-agent",  instructions: "You are an agent with both STT and TTS capabilities.",  model: openai("gpt-4o"),  voice: new OpenAIVoice(),});export const mastra = new Mastra({  // ...  agents: { hybridVoiceAgent, unifiedVoiceAgent },});const hybridVoiceAgent = mastra.getAgent("hybridVoiceAgent");const unifiedVoiceAgent = mastra.getAgent("unifiedVoiceAgent");const question = "What is the meaning of life in one sentence?";const hybridSpoken = await hybridVoiceAgent.voice.speak(question);await saveAudioToFile(hybridSpoken!, "hybrid-question.mp3");const audioStream = createReadStream(  path.join(process.cwd(), "audio", "hybrid-question.mp3"),);const unifiedHeard = await unifiedVoiceAgent.voice.listen(audioStream);const inputText = await convertToText(unifiedHeard!);const unifiedResponse = await unifiedVoiceAgent.generate(inputText);const unifiedSpoken = await unifiedVoiceAgent.voice.speak(unifiedResponse.text);await saveAudioToFile(unifiedSpoken!, "unified-response.mp3");
```

### Using Multiple Providers​

For more flexibility, you can use different providers for speaking and listening using the CompositeVoice class: 

```
import { Agent } from "@mastra/core/agent";import { CompositeVoice } from "@mastra/core/voice";import { OpenAIVoice } from "@mastra/voice-openai";import { PlayAIVoice } from "@mastra/voice-playai";import { openai } from "@ai-sdk/openai";export const agent = new Agent({  name: "Agent",  instructions: `You are a helpful assistant with both STT and TTS capabilities.`,  model: openai("gpt-4o"),  // Create a composite voice using OpenAI for listening and PlayAI for speaking  voice: new CompositeVoice({    input: new OpenAIVoice(),    output: new PlayAIVoice(),  }),});
```

## Supported Voice Providers​

Mastra supports multiple voice providers for text-to-speech (TTS) and speech-to-text (STT) capabilities: 

ProviderPackageFeaturesReferenceOpenAI@mastra/voice-openaiTTS, STTDocumentationOpenAI Realtime@mastra/voice-openai-realtimeRealtime speech-to-speechDocumentationElevenLabs@mastra/voice-elevenlabsHigh-quality TTSDocumentationPlayAI@mastra/voice-playaiTTSDocumentationGoogle@mastra/voice-googleTTS, STTDocumentationDeepgram@mastra/voice-deepgramSTTDocumentationMurf@mastra/voice-murfTTSDocumentationSpeechify@mastra/voice-speechifyTTSDocumentationSarvam@mastra/voice-sarvamTTS, STTDocumentationAzure@mastra/voice-azureTTS, STTDocumentationCloudflare@mastra/voice-cloudflareTTSDocumentation

For more details on voice capabilities, see the [Voice API Reference](/reference/voice/mastra-voice).