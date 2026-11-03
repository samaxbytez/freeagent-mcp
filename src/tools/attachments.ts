import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FreeAgentClient, REQUEST_TIMEOUT_MS } from "../client.js";
import { jsonResponse, errorResponse, logToolCall, safeId } from "../utils.js";
import { downloadTarget, saveAttachment, mb, MAX_DOWNLOAD_BYTES } from "../attachment.js";

/**
 * Total bytes one server process will download. Nothing leaves the machine, but a
 * prompt-injected loop could otherwise fill the attachment folder 25MB at a time.
 */
export const MAX_SESSION_DOWNLOAD_BYTES = 250 * 1024 * 1024;

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
 *
 * @param limit Most bytes to accept; anything larger is refused before it is kept.
 */
async function fetchPresigned(link: string, limit: number): Promise<Uint8Array> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new Error("FreeAgent returned an attachment link that is not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("FreeAgent returned an attachment link that is not https");
  }

  // redirect: "error" so an https link cannot bounce the download to plain http or
  // somewhere else. The timeout covers reading the body as well as the headers.
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Attachment download failed (timed out, redirected or unreachable)");
  }
  if (!response.ok) {
    throw new Error(`Attachment download failed with HTTP ${response.status}`);
  }
  const tooLarge = () => new Error(`Attachment is larger than ${mb(limit)} and was not downloaded`);
  if (Number(response.headers.get("content-length") ?? "0") > limit) throw tooLarge();

  // Read with a running cap so a missing or lying content-length cannot exhaust memory.
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Attachment download returned no body");
  for (;;) {
    const { done, value } = await reader.read().catch(() => {
      throw new Error("Attachment download failed (timed out or interrupted)");
    });
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export function registerAttachmentTools(
  server: McpServer,
  client: FreeAgentClient,
  sessionLimit = MAX_SESSION_DOWNLOAD_BYTES
): void {
  let downloaded = 0;

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
        const remaining = sessionLimit - downloaded;
        if (remaining <= 0) {
          throw new Error(
            `This session has already downloaded ${mb(sessionLimit)} of attachments. Restart the server to download more.`
          );
        }
        const record = (await client.get(`/attachments/${attachment_id}`)) as AttachmentRecord;
        const att = record?.attachment;
        if (!att || typeof att.content_src !== "string" || typeof att.file_name !== "string") {
          throw new Error("FreeAgent did not return a downloadable attachment");
        }
        const target = await downloadTarget(att.file_name);
        const bytes = await fetchPresigned(att.content_src, Math.min(MAX_DOWNLOAD_BYTES, remaining));
        const saved = await saveAttachment(target, bytes);
        downloaded += bytes.length;
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
