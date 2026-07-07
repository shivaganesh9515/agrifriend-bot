import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  isJidGroup,
  jidNormalizedUser,
  proto,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { config } from "../config";

export type MessageHandler = (
  socket: WASocket,
  msg: proto.IWebMessageInfo,
  isGroup: boolean,
  senderJid: string,
  groupName?: string
) => Promise<void>;

let socket: WASocket;

export async function connectWhatsApp(
  onMessage: MessageHandler
): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

  socket = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: config.logLevel as any }),
    browser: ["AgriFriend Bot", "Chrome", "1.0.0"],
    generateHighQualityLinkPreview: false,
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 Scan this QR code with WhatsApp:\n");
      qrcode.generate(qr, { small: true });
      console.log("\nOpen WhatsApp → Settings → Linked Devices → Link a Device\n");
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        `Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`
      );

      if (shouldReconnect) {
        connectWhatsApp(onMessage);
      } else {
        console.log("Logged out. Delete auth_info/ and scan QR again.");
        process.exit(1);
      }
    }

    if (connection === "open") {
      console.log("✅ AgriFriend is connected to WhatsApp!");
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe === true) continue;

      const isGroup = isJidGroup(msg.key.remoteJid!) as boolean;
      const senderJid = jidNormalizedUser(
        isGroup ? msg.key.participant! : msg.key.remoteJid!
      );

      let groupName: string | undefined;
      if (isGroup) {
        try {
          const metadata = await socket.groupMetadata(msg.key.remoteJid!);
          groupName = metadata.subject;
        } catch {
          groupName = undefined;
        }
      }

      await onMessage(socket, msg, isGroup, senderJid, groupName);
    }
  });

  return socket;
}

export function getSocket(): WASocket {
  return socket;
}
