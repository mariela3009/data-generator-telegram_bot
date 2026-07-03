import { GoogleGenerativeAI } from '@google/generative-ai';
import { DatabaseSchema, TableSchema } from '../schemas';

let aiClient: GoogleGenerativeAI | null = null;

export function getAiClient(apiKey?: string): GoogleGenerativeAI | null {
  if (aiClient) return aiClient;

  // Read API Key from process.env (injected by bot.ts)
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }

  if (!apiKey) {
    return null;
  }

  try {
    aiClient = new GoogleGenerativeAI(apiKey);
    return aiClient;
  } catch (error) {
    console.warn("Failed to initialize Google Gen AI Client", error);
    return null;
  }
}

export async function generateSeedDataForDatabase(
  schema: DatabaseSchema,
  tableNames: string[],
  prompt?: string,
  apiKey?: string,
  seedSize: number = 8
): Promise<Record<string, any[]> | null> {
  const client = getAiClient(apiKey);
  if (!client) {
    throw new Error("Gemini API Key is missing. Please set it in your environment or session.");
  }

  const selectedTables = schema.tables.filter(t => tableNames.includes(t.name));
  if (selectedTables.length === 0) {
    throw new Error("No tables selected to generate.");
  }

  const tablesDescription = selectedTables.map(table => {
    const columnsInfo = table.columns.map(col => {
      let info = `    - ${col.name}: ${col.dataType}`;
      const constraints: string[] = [];
      if (!col.isNullable) constraints.push("NOT NULL");
      if (col.isPrimaryKey) constraints.push("PRIMARY KEY");
      if (col.isUnique) constraints.push("UNIQUE");
      if (col.foreignKey) constraints.push(`FOREIGN KEY -> ${col.foreignKey.table}.${col.foreignKey.column}`);
      if (col.maxLength) constraints.push(`MAX LENGTH = ${col.maxLength}`);
      if (col.maxId !== undefined) constraints.push(`MAX ID ACTUAL = ${col.maxId}`);
      
      if (constraints.length > 0) {
        info += ` (${constraints.join(", ")})`;
      }
      return info;
    });
    return `  TABLA: ${table.name}\n${columnsInfo.join("\n")}`;
  });

  const fullSchemaStr = tablesDescription.join("\n\n");

  let systemInstruction = `Actúa como un generador experto de datos de prueba (mock data) de alta calidad y realismo.\n` +
    `Tu tarea es generar EXACTAMENTE ${seedSize} registros para CADA una de las tablas de la siguiente base de datos.\n\n` +
    `**BASE DE DATOS: ${schema.databaseName} (Motor: ${schema.motor})**\n\n` +
    `**ESQUEMA COMPLETO:**\n${fullSchemaStr}\n\n` +
    `**REGLAS CRÍTICAS:**\n` +
    `1. Devuelve UN SOLO objeto JSON válido donde cada clave es el nombre EXACTO de una tabla y su valor es un arreglo de ${seedSize} objetos.\n` +
    `2. Formato exacto: { "tabla1": [{...}, ...], "tabla2": [{...}, ...] }\n` +
    `3. Respeta estrictamente los tipos de datos (números SIN comillas, booleanos como true/false).\n` +
    `4. ANALIZA LOS NOMBRES de las tablas y columnas para inferir QUÉ tipo de datos deberían contener.\n` +
    `5. NO uses textos genéricos tipo 'Lorem Ipsum'.\n` +
    `6. Los datos entre tablas deben ser COHERENTES.\n` +
    `7. Para PKs numéricas usa valores consecutivos EMPEZANDO estrictamente desde el (MAX ID ACTUAL + 1) si se proporciona, de lo contrario empieza en 1. EXCEPTO si el tipo de dato es 'uuid', en cuyo caso genera UUIDs reales.\n` +
    `8. NO incluyas markdown (como \`\`\`json) en tu respuesta, SOLO el JSON puro.\n`;

  if (prompt) {
    systemInstruction += `\n**CONTEXTO ESPECÍFICO DEL USUARIO:**\n${prompt}\n`;
  }

  try {
    const model = client.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction,
      generationConfig: { temperature: 0.7 }
    });
    
    const response = await model.generateContent("Genera el objeto JSON con los datos realistas para todas las tablas. Recuerda: analiza el nombre de cada columna para generar datos apropiados.");
    let resultText = response.response.text().trim() || "";
    if (resultText.startsWith("```json")) resultText = resultText.substring(7);
    if (resultText.startsWith("```")) resultText = resultText.substring(3);
    if (resultText.endsWith("```")) resultText = resultText.slice(0, -3);
    resultText = resultText.trim();

    const data = JSON.parse(resultText);
    
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error("Invalid response structure");
    }

    const result: Record<string, any[]> = {};
    for (const tableName of tableNames) {
      if (data[tableName] && Array.isArray(data[tableName])) {
        result[tableName] = data[tableName];
      }
    }
    return result;

  } catch (error: any) {
    throw new Error(`Fallo en la generación de IA: ${error.message}`);
  }
}
