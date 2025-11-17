import { deepgram } from "@ai-sdk/deepgram";
import { openai } from "@ai-sdk/openai";
import { experimental_transcribe as transcribe } from "ai";
import { NextResponse } from "next/server";

const DEFAULT_DEEPGRAM_MODEL = "nova-2";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini-transcribe";

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const provider = (process.env.EXCELLA_TRANSCRIPTION_PROVIDER ?? "deepgram")
      .toLowerCase()
      .trim();
    const modelId = process.env.EXCELLA_TRANSCRIPTION_MODEL;

    const model =
      provider === "openai"
        ? openai.transcription(modelId || DEFAULT_OPENAI_MODEL)
        : deepgram.transcription(modelId || DEFAULT_DEEPGRAM_MODEL);

    const result = await transcribe({ model, audio: audioBuffer });

    return NextResponse.json({ transcription: result.text });
  } catch (error) {
    console.error("Transcription error:", error);

    const isNoTranscriptError =
      error instanceof Error && error.name === "AI_NoTranscriptGeneratedError";

    if (isNoTranscriptError) {
      return NextResponse.json(
        {
          error:
            "We couldn't generate a transcription for this audio. Please try again with clearer audio, speaking closer to the mic, or a slightly longer recording.",
        },
        { status: 422 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Transcription failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
