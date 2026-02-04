import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    delay, 
    AnyMessageContent, 
    makeInMemoryStore,
    proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

// الإعدادات العامة (مستوحاة من ملفاتك)
const OWNER_ID = '212715104027@s.whatsapp.net'; //
const ALLOWED_USER = '212621957775@s.whatsapp.net'; //
const LECTURES_DIR = './lectures/'; //
const METADATA_PATH = './lectures/metadata.json'; //
const SIGNATURE = "\n\n👨‍💻 *تطوير: IRIZI 😊*"; //

// إنشاء المجلدات إذا لم تكن موجودة
if (!fs.existsSync(LECTURES_DIR)) fs.mkdirSync(LECTURES_DIR);
if (!fs.existsSync(METADATA_PATH)) fs.writeFileSync(METADATA_PATH, JSON.stringify({}));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    // حفظ الجلسة
    sock.ev.on('creds.update', saveCreds);

    // إدارة الاتصال
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ البوت جاهز للعمل باستخدام Baileys!');
        }
    });

    // معالجة الرسائل
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const isGroup = jid.endsWith('@g.us');
        const sender = msg.key.participant || jid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const command = text.trim().toLowerCase();

        // منطق الأوامر الإدارية (فتح/إغلاق المجموعة)
        if (sender === ALLOWED_USER || sender === OWNER_ID) {
            if (command === 'إغلاق المجموعة') {
                await sock.groupSettingUpdate(jid, 'announcement');
                await sock.sendMessage(jid, { text: `🚫 تم إغلاق المجموعة.` + SIGNATURE });
            }
            if (command === 'فتح المجموعة') {
                await sock.groupSettingUpdate(jid, 'not_announcement');
                await sock.sendMessage(jid, { text: `✅ تم فتح المجموعة.` + SIGNATURE });
            }
        }

        // أمر المساعدة
        if (command === 'الأوامر' || command === '!help') {
            const helpText = `
📋 *قائمة الأوامر:*
- *عرض المحاضرات*: لعرض ملفات PDF.
- *إضافة محاضرة*: لبدء إضافة ملف جديد.
- *البحث عن محاضرة*: للبحث بالاسم.
${SIGNATURE}`;
            await sock.sendMessage(jid, { text: helpText });
        }

        // عرض المحاضرات (منطق مبسط)
        if (command === 'عرض المحاضرات' || command === 'pdf') {
            const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
            const files = Object.keys(metadata);
            if (files.length === 0) {
                return await sock.sendMessage(jid, { text: "📂 لا توجد محاضرات حالياً." + SIGNATURE });
            }
            let list = "📚 *قائمة المحاضرات:*\n";
            files.forEach((f, i) => list += `${i + 1}. ${metadata[f].name}\n`);
            await sock.sendMessage(jid, { text: list + SIGNATURE });
        }
    });
}

startBot();
