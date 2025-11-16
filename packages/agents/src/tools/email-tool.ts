import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const hasResendKey = (): boolean => !!process.env.RESEND_API_KEY;

const getResendClient = async () => {
  const { Resend } = await import("resend");
  return new Resend(process.env.RESEND_API_KEY);
};

const proposedEmailSchema = z.object({
  emailHandle: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
});

type ProposedEmail = z.infer<typeof proposedEmailSchema>;

type ToolResultContent = {
  type?: string;
  toolName?: string;
  output?: { value?: unknown } | Record<string, unknown>;
  [key: string]: unknown;
};

type ModelMessage = {
  content?: ToolResultContent[];
  [key: string]: unknown;
};

const tryParseProposedEmail = (
  content: ToolResultContent,
  handle: string
): ProposedEmail | undefined => {
  if (
    content?.type !== "tool-result" ||
    !(
      content.toolName === "propose-email" ||
      content.toolName === "proposeEmailTool"
    ) ||
    !content.output ||
    typeof content.output !== "object"
  ) {
    return;
  }

  const output = content.output as { value?: unknown };
  if (!("value" in output) || output.value === undefined) {
    return;
  }

  try {
    const parsed = proposedEmailSchema.parse(output.value);
    if (parsed.emailHandle === handle) {
      return parsed;
    }
  } catch {
    // Ignore parse failures and keep searching
  }

  return;
};

const extractProposedEmailFromMessage = (
  message: ModelMessage,
  handle: string
): ProposedEmail | undefined => {
  const contents = Array.isArray(message.content)
    ? (message.content as ToolResultContent[])
    : [];

  for (const content of contents) {
    const parsed = tryParseProposedEmail(content, handle);
    if (parsed) {
      return parsed;
    }
  }

  return;
};

const findProposedEmail = (
  messages: ModelMessage[] | undefined,
  handle: string
): ProposedEmail | undefined => {
  if (!messages) {
    return;
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const parsed = extractProposedEmailFromMessage(messages[i], handle);
    if (parsed) {
      return parsed;
    }
  }

  return;
};

const toHtml = (body: string): string => {
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  return escapeHtml(body).replace(/\n/g, "<br />");
};

export const sendEmailTool = createTool({
  id: "send-email",
  description:
    "Execute the delivery of a previously approved message or communication using the handle provided by the approval tool.",
  inputSchema: z.object({
    emailHandle: z
      .string()
      .describe(
        "Handle received from the propose-email tool after the user approves the draft"
      ),
  }),
  outputSchema: z.object({
    response: z.string(),
  }),
  execute: async ({ context: { emailHandle } }, options) => {
    if (!hasResendKey()) {
      throw new Error(
        "Email sending is not configured. Please inform the user that they need to add a RESEND_API_KEY to their .env file to enable email functionality. They can get an API key at https://resend.com/api-keys"
      );
    }

    const messages = options?.messages as ModelMessage[] | undefined;
    const proposedEmail = findProposedEmail(messages, emailHandle);

    if (!proposedEmail) {
      throw new Error(
        "Invalid or expired email handle. Please propose the email again and request user approval before sending."
      );
    }

    const { to, subject, body } = proposedEmail;

    const resend = await getResendClient();
    await resend.emails.send({
      from: "Assistant UI <onboarding@resend.dev>",
      to: [to],
      subject: subject || "Welcome to Assistant UI",
      text: body,
      html: toHtml(body),
    });

    return {
      response: "Email sent successfully",
    };
  },
});
