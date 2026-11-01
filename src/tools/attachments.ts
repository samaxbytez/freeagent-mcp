import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FreeAgentClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, safeId } from "../utils.js";
import { saveAttachment, MAX_DOWNLOAD_BYTES } from "../attachment.js";

interface AttachmentRecord {
  attachment?: {
    content_src?: unknown;
    file_name?: unknown;
    content_type?: unknown;
  };
}

/**
 * Fetch the pre-signed link server-side. The link never reaches the model (tool
 * output strips content_src*), and the bearer token is never sent with it: the link
 * is self-authorising and points at storage outside the API origin.
 */
async function fetchPresigned(link: string): Promise<Uint8Array> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new Error("FreeAgent returned an attachment link that is not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("FreeAgent returned an attachment link that is not https");
  }

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Attachment download failed with HTTP ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Attachment is larger than ${MAX_DOWNLOAD_BYTES / 1024 / 1024}MB and was not downloaded`);
  }

  // Read with a running cap so a missing or lying content-length cannot exhaust memory.
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Attachment download returned no body");
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_DOWNLOAD_BYTES) {
      await reader.cancel();
      throw new Error(`Attachment is larger than ${MAX_DOWNLOAD_BYTES / 1024 / 1024}MB and was not downloaded`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function registerAttachmentTools(server: McpServer, client: FreeAgentClient): void {
  server.tool(
    "freeagent_download_attachment",
    "Download a FreeAgent attachment (e.g. an expense or bill receipt) into FREEAGENT_ATTACHMENTS_DIR. " +
      "Takes the attachment ID from an attachment URL such as https://api.freeagent.com/v2/attachments/123. " +
      "Never overwrites: a clashing name gets a ' (n)' suffix. Returns the saved path, not the download link.",
    {
      attachment_id: safeId.describe("The ID of the attachment to download"),
    },
    async ({ attachment_id }) => {
      logToolCall("freeagent_download_attachment", { attachment_id });
      try {
        const record = (await client.get(`/attachments/${attachment_id}`)) as AttachmentRecord;
        const att = record?.attachment;
        if (!att || typeof att.content_src !== "string" || typeof att.file_name !== "string") {
          throw new Error("FreeAgent did not return a downloadable attachment");
        }
        const bytes = await fetchPresigned(att.content_src);
        const saved = await saveAttachment(att.file_name, bytes);
        return jsonResponse({
          saved_to: saved,
          file_name: att.file_name,
          content_type: typeof att.content_type === "string" ? att.content_type : undefined,
          size_bytes: bytes.length,
        });
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
