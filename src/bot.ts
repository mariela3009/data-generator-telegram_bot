import { Telegraf, Context, Markup } from 'telegraf';
import LocalSession from 'telegraf-session-local';
import * as dotenv from 'dotenv';
import { ConnectorFactory } from './core/connectors/ConnectorFactory';
import { DataGenerator } from './core/generators/dataGenerator';
import { generateSqlScript } from './core/utils/sqlExporter';
import { DatabaseSchema, TableGenerationConfig } from './core/schemas';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface SessionData {
  geminiApiKey?: string;
  dbUri?: string;
  schema?: DatabaseSchema;
  configs?: TableGenerationConfig[];
  awaitingInput?: 'API_KEY' | 'DB_URI' | 'ROWS_COUNT';
  selectedTableForRows?: string;
}

interface MyContext extends Context {
  session: SessionData;
}

const bot = new Telegraf<MyContext>(process.env.TELEGRAM_BOT_TOKEN || '');

bot.use((new LocalSession({ database: 'session_db.json' })).middleware());

bot.start((ctx) => {
  ctx.session = {}; // reset session
  ctx.reply(
    `🤖 ¡Hola! Soy el Bot de Data Generator.\n\n` +
    `Puedo analizar tu base de datos y generar datos sintéticos realistas usando Inteligencia Artificial (Google Gemini).\n\n` +
    `👉 Para empezar, por favor envíame tu clave de API de Google Gemini (API Key) para poder conectarme a la IA.`
  );
  ctx.session.awaitingInput = 'API_KEY';
});

bot.command('menu', (ctx) => {
  showMainMenu(ctx);
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const session = ctx.session;

  if (session.awaitingInput === 'API_KEY') {
    session.geminiApiKey = text;
    session.awaitingInput = 'DB_URI';
    return ctx.reply('✅ API Key guardada en esta sesión.\n\nAhora, por favor envíame la cadena de conexión de tu base de datos (ej. postgres://usuario:pass@host/db o mysql://usuario:pass@host/db)');
  }

  if (session.awaitingInput === 'DB_URI') {
    if (!text.startsWith('postgres://') && !text.startsWith('postgresql://') && !text.startsWith('mysql://')) {
      return ctx.reply('⚠️ Formato inválido. Debe empezar con postgres:// o mysql://');
    }
    
    const statusMsg = await ctx.reply('🔍 Conectando y analizando la base de datos...');
    
    try {
      const connector = ConnectorFactory.getConnector(text);
      await connector.connect();
      const schema = await connector.getSchema();
      await connector.disconnect();

      session.dbUri = text;
      session.schema = schema;
      session.configs = schema.tables.map(t => ({
        tableName: t.name,
        recordCount: 10,
        selected: true
      }));
      session.awaitingInput = undefined;

      await ctx.telegram.editMessageText(
        ctx.chat!.id, 
        statusMsg.message_id, 
        undefined, 
        `✅ ¡Conexión exitosa!\n\nEncontré ${schema.tables.length} tablas.\nPor defecto, generaremos 10 registros por tabla.`
      );
      
      showMainMenu(ctx);

    } catch (error: any) {
      ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, `❌ Error al conectar: ${error.message}`);
    }
    return;
  }

  if (session.awaitingInput === 'ROWS_COUNT' && session.selectedTableForRows) {
    const count = parseInt(text);
    if (isNaN(count) || count < 0) {
      return ctx.reply('⚠️ Por favor envía un número válido mayor o igual a 0.');
    }
    const config = session.configs?.find(c => c.tableName === session.selectedTableForRows);
    if (config) {
      config.recordCount = count;
      ctx.reply(`✅ Tabla ${session.selectedTableForRows} configurada a ${count} registros.`);
    }
    session.awaitingInput = undefined;
    session.selectedTableForRows = undefined;
    showMainMenu(ctx);
    return;
  }
});

bot.action('config_rows', (ctx) => {
  if (!ctx.session.configs) return ctx.answerCbQuery('Primero conecta tu base de datos.');
  
  const buttons = ctx.session.configs.map(c => [
    Markup.button.callback(`✏️ ${c.tableName} (${c.recordCount} filas)`, `set_rows_${c.tableName}`)
  ]);
  
  buttons.push([Markup.button.callback('⬅️ Volver al menú', 'show_menu')]);
  
  ctx.editMessageText('Selecciona una tabla para cambiar la cantidad de registros a generar:', Markup.inlineKeyboard(buttons));
  ctx.answerCbQuery();
});

bot.action(/set_rows_(.+)/, (ctx) => {
  const tableName = ctx.match[1];
  ctx.session.awaitingInput = 'ROWS_COUNT';
  ctx.session.selectedTableForRows = tableName;
  ctx.reply(`¿Cuántos registros quieres generar para la tabla "${tableName}"?\n(Envía un número por chat)`);
  ctx.answerCbQuery();
});

bot.action('show_menu', (ctx) => {
  ctx.deleteMessage().catch(() => {});
  showMainMenu(ctx);
  ctx.answerCbQuery();
});

bot.action('generate_sql', (ctx) => {
  handleGeneration(ctx, 'sql');
});

bot.action('generate_direct', (ctx) => {
  handleGeneration(ctx, 'direct');
});

function showMainMenu(ctx: MyContext) {
  if (!ctx.session.dbUri || !ctx.session.schema) {
    return ctx.reply('⚠️ Aún no has configurado una base de datos. Usa /start para comenzar.');
  }

  const msg = `📊 **Menú Principal**\n` + 
              `Tablas encontradas: ${ctx.session.schema.tables.length}\n` +
              `Total de registros a generar: ${ctx.session.configs?.reduce((acc, c) => acc + c.recordCount, 0)}\n\n` +
              `¿Qué deseas hacer?`;

  ctx.reply(msg, Markup.inlineKeyboard([
    [Markup.button.callback('⚙️ Configurar cantidad por tabla', 'config_rows')],
    [Markup.button.callback('📄 Generar Archivo .SQL', 'generate_sql')],
    [Markup.button.callback('⚡ Insertar Directamente en BD', 'generate_direct')]
  ]));
}

async function handleGeneration(ctx: MyContext, mode: 'sql' | 'direct') {
  const session = ctx.session;
  if (!session.schema || !session.configs || !session.dbUri || !session.geminiApiKey) {
    return ctx.answerCbQuery('Faltan configuraciones.');
  }

  const statusMsg = await ctx.reply('⏳ Iniciando generador híbrido con Gemini IA...');
  ctx.answerCbQuery();

  try {
    process.env.GEMINI_API_KEY = session.geminiApiKey; // Inject for the core logic

    const generator = new DataGenerator('es_ES');
    const generatedData = await generator.generate(session.schema, session.configs, true, "");

    if (mode === 'sql') {
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, '📝 Creando archivo SQL...');
      const sqlString = generateSqlScript(generatedData, session.dbUri.split('://')[0]);
      
      const fileName = `synthetic_data_${Date.now()}.sql`;
      const filePath = path.join(__dirname, '..', fileName);
      fs.writeFileSync(filePath, sqlString);

      await ctx.replyWithDocument({ source: filePath, filename: fileName }, { caption: '✅ Aquí tienes tu archivo SQL con los datos sintéticos.' });
      fs.unlinkSync(filePath); // Cleanup
      ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
    } 
    else if (mode === 'direct') {
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, '⚡ Conectando a la base de datos para insertar...');
      const connector = ConnectorFactory.getConnector(session.dbUri);
      await connector.connect();
      
      // We need to implement a batch insert in the connector, but for simplicity, if the connector has insertData we use it.
      const sortedTables = Object.keys(generatedData);
      await connector.insertData(generatedData, sortedTables);
      
      const totalInserted = Object.values(generatedData).reduce((acc, curr) => acc + curr.rows.length, 0);
      
      await connector.disconnect();
      await ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, `✅ ¡Inyección Directa Completada!\n\nSe insertaron ${totalInserted} registros en tu base de datos.`);
    }

  } catch (error: any) {
    ctx.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, `❌ Error durante la generación:\n${error.message}`);
  }
}

// Global error handler
bot.catch((err, ctx) => {
  console.log(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

bot.launch().then(() => {
  console.log('🤖 Telegram Bot is running...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Dummy HTTP Server for Render Healthcheck
import * as http from 'http';
const server = http.createServer((req: any, res: any) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running and healthy!');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Healthcheck server is listening on port ${PORT}`);
});
