import { Faker } from '@faker-js/faker';

// Static catalogs
export const PRODUCT_NAMES = [
  "Laptop HP Pavilion 15", "Monitor LG UltraWide 34\"", "Teclado Mecánico Logitech G Pro",
  "Mouse Inalámbrico Logitech MX Master 3", "Auriculares Sony WH-1000XM5",
  "Cámara Canon EOS R5", "Tablet Samsung Galaxy Tab S9", "Impresora Epson EcoTank L3250",
  "SSD Samsung 970 EVO 1TB", "Router TP-Link Archer AX73", "Webcam Logitech C920",
  "Disco Duro Externo WD 2TB", "Parlante JBL Flip 6", "Smartwatch Apple Watch SE",
  "Cargador USB-C Anker 65W", "Cable HDMI 2.1 4K", "Memoria RAM Kingston 16GB DDR5",
  "Procesador AMD Ryzen 7 7800X3D", "Tarjeta Gráfica NVIDIA RTX 4070",
  "Fuente de Poder Corsair 750W", "Silla Gamer Cougar Armor One", "Mochila para Laptop 15.6\"",
  "Hub USB-C 7 en 1", "Micrófono Blue Yeti", "Soporte para Monitor Ergonómico",
  "Alfombrilla de Mouse XL", "Cooler para Laptop", "UPS APC 1500VA",
  "Proyector Epson PowerLite", "Lector de Tarjetas SD USB 3.0",
];

export const CATEGORIES = [
  "Electrónica", "Hogar", "Deportes", "Ropa", "Tecnología", "Juguetes", "Libros",
  "Cocina", "Jardín", "Mascotas", "Salud", "Belleza", "Automotriz", "Oficina",
  "Música", "Fotografía", "Gaming", "Accesorios", "Herramientas", "Iluminación",
  "Audio", "Video", "Computación", "Celulares", "Tablets", "Almacenamiento",
  "Redes", "Software", "Periféricos", "Mobiliario",
];

export const PROJECT_NAMES = [
  "Portal Web Corporativo", "App de Inventario", "Sistema de Facturación",
  "Dashboard Analytics", "API de Pagos", "Módulo de Reportes",
  "Plataforma E-commerce", "Sistema CRM", "App de Gestión de Tareas",
  "Migración de Base de Datos", "Chatbot de Soporte", "Panel de Administración",
  "Sistema de Reservas", "App de Seguimiento GPS", "Plataforma de Capacitación",
];

export const TITLES = [
  "Guía de Instalación", "Manual de Usuario", "Reporte Mensual", "Plan de Proyecto",
  "Especificación Técnica", "Acta de Reunión", "Propuesta Comercial",
  "Análisis de Requerimientos", "Documento de Diseño", "Informe de Pruebas",
];

export const ROLES = ["admin", "editor", "viewer", "moderator", "owner", "member", "guest", "contributor"];
export const STATUSES = ["activo", "inactivo", "pendiente", "completado", "cancelado", "en_progreso", "archivado"];

// Tables that do not contain people
const NON_PERSON_TABLES = new Set([
  "producto", "productos", "product", "products",
  "item", "items", "articulo", "articulos",
  "project", "projects", "proyecto", "proyectos",
  "categoria", "categorias", "category", "categories",
  "servicio", "servicios", "service", "services",
  "documento", "documentos", "document", "documents",
  "curso", "cursos", "course", "courses",
  "evento", "eventos", "event", "events",
  "diagrama", "diagramas", "diagram", "diagrams",
  "tarea", "tareas", "task", "tasks",
  "ticket", "tickets",
  "empresa", "empresas",
  "tienda", "tiendas", "store", "stores",
]);

export function detectNombreContext(tableName: string): string {
  const t = tableName.toLowerCase().trim();
  if (["producto", "productos", "product", "products", "item", "items", "articulo", "articulos"].includes(t)) {
    return "product";
  }
  if (["project", "projects", "proyecto", "proyectos"].includes(t)) {
    return "project";
  }
  if (["categoria", "categorias", "category", "categories"].includes(t)) {
    return "category";
  }
  if (["servicio", "servicios", "service", "services", "curso", "cursos", "course", "courses", "evento", "eventos", "event", "events"].includes(t)) {
    return "generic";
  }
  if (["usuario", "usuarios", "user", "users", "persona", "personas", "empleado", "empleados", "cliente", "clientes", "customer", "customers", "contacto", "contactos", "collaborator", "collaborators", "colaborador", "colaboradores", "member", "members"].includes(t)) {
    return "person";
  }
  if (NON_PERSON_TABLES.has(t)) {
    return "generic";
  }
  return "person";
}

const NAME_MAPPINGS: Array<[RegExp, string]> = [
  [/email|correo/i, "internet.email"],
  [/^first_name$|^primer_nombre$/i, "person.firstName"],
  [/^last_name$|^apellido$/i, "person.lastName"],
  [/full_name|nombre_completo/i, "person.fullName"],
  [/phone|telefono|tel\b/i, "phone.number"],
  [/address|direccion/i, "location.streetAddress"],
  [/city|ciudad/i, "location.city"],
  [/country|pais/i, "location.country"],
  [/zip|postal|cp/i, "location.zipCode"],
  [/company|empresa/i, "company.name"],
  [/job|profesion|puesto/i, "person.jobTitle"],
  [/date_of_birth|dob|fecha_nacimiento/i, "date.birthdate"],
  [/date|fecha/i, "date.recent"],
  [/uuid|guid/i, "string.uuid"],
  [/password|clave|pwd/i, "internet.password"],
  [/url|website|web/i, "internet.url"],
  [/ip|ip_address/i, "internet.ipv4"],
  [/color/i, "color.human"],
  [/iban/i, "finance.iban"],
  [/credit_card|tarjeta/i, "finance.creditCardNumber"],
  [/price|precio|amount|monto|total|costo|cost|valor|value/i, "finance.amount"],
  [/quantity|cantidad|qty|stock|inventory|inventario/i, "number.int"],
  [/description|descripcion|bio|notes|notas/i, "lorem.sentence"],
  [/status|estado/i, "_status"],
  [/role?$|rol$/i, "_role"],
  [/categor/i, "_category"],
  [/titulo|title/i, "_title"],
];

const TYPE_MAPPINGS: Record<string, string> = {
  "VARCHAR": "lorem.word",
  "CHARACTER VARYING": "lorem.word",
  "CHAR": "string.alpha",
  "TEXT": "lorem.sentence",
  "INT": "number.int",
  "INTEGER": "number.int",
  "BIGINT": "number.bigInt",
  "SMALLINT": "number.int",
  "TINYINT": "datatype.boolean",
  "FLOAT": "number.float",
  "DOUBLE": "number.float",
  "DOUBLE PRECISION": "number.float",
  "REAL": "number.float",
  "DECIMAL": "number.float",
  "NUMERIC": "number.float",
  "DATE": "date.recent",
  "DATETIME": "date.recent",
  "TIMESTAMP": "date.recent",
  "TIMESTAMP WITH TIME ZONE": "date.recent",
  "TIMESTAMP WITHOUT TIME ZONE": "date.recent",
  "TIMESTAMPTZ": "date.recent",
  "TIME": "date.recent",
  "BOOLEAN": "datatype.boolean",
  "BOOL": "datatype.boolean",
  "UUID": "string.uuid",
};

export function getFakerMethodForColumn(fake: Faker, columnName: string, dataType: string, tableName: string = ""): () => any {
  const isArray = dataType.toUpperCase().includes('ARRAY') || dataType.includes('[]');
  const baseDataType = dataType.replace(/ARRAY|\[|\]/ig, '').trim() || 'VARCHAR';
  
  const generator = _getGenerator(fake, columnName, baseDataType, tableName);
  
  if (isArray) {
    return () => {
      const count = fake.number.int({ min: 1, max: 4 });
      const arr = [];
      for (let i=0; i<count; i++) {
        arr.push(generator());
      }
      return arr;
    };
  }
  return generator;
}

function _getGenerator(fake: Faker, columnName: string, dataType: string, tableName: string): () => any {
  const colLower = columnName.toLowerCase().trim();
  const tableLower = tableName.toLowerCase().trim();

  // SPECIAL CASE: Name depends on table
  if (["nombre", "name", "nombre_producto", "product_name"].includes(colLower)) {
    const context = detectNombreContext(tableLower);
    if (context === "product") return () => fake.helpers.arrayElement(PRODUCT_NAMES);
    if (context === "project") return () => fake.helpers.arrayElement(PROJECT_NAMES);
    if (context === "category") return () => fake.helpers.arrayElement(CATEGORIES);
    if (context === "person") return () => fake.person.fullName();
    return () => fake.company.catchPhrase();
  }

  // Regex-based mappings
  for (const [pattern, methodPath] of NAME_MAPPINGS) {
    if (pattern.test(columnName)) {
      if (methodPath === "finance.amount") return () => parseFloat(fake.finance.amount({ min: 0.01, max: 9999.99, dec: 2 }));
      if (methodPath === "number.int") return () => fake.number.int({ min: 0, max: 1000 });
      if (methodPath === "_category") return () => fake.helpers.arrayElement(CATEGORIES);
      if (methodPath === "_status") return () => fake.helpers.arrayElement(STATUSES);
      if (methodPath === "_role") return () => fake.helpers.arrayElement(ROLES);
      if (methodPath === "_title") return () => fake.helpers.arrayElement(TITLES);
      if (methodPath === "lorem.sentence") return () => fake.lorem.sentence(8);
      
      const [module, method] = methodPath.split(".");
      if ((fake as any)[module] && (fake as any)[module][method]) {
        return () => (fake as any)[module][method]();
      }
    }
  }

  // Generic Type based mappings
  const baseType = dataType.split('(')[0].toUpperCase().trim();
  const methodPath = TYPE_MAPPINGS[baseType];
  
  if (methodPath) {
    if (methodPath === "lorem.sentence") return () => fake.lorem.sentence(8);
    if (methodPath === "number.int") return () => fake.number.int({ min: 1, max: 10000 });
    if (methodPath === "number.float") return () => parseFloat(fake.finance.amount({ min: 1, max: 1000, dec: 2 }));
    
    const [module, method] = methodPath.split(".");
    if ((fake as any)[module] && (fake as any)[module][method]) {
      return () => (fake as any)[module][method]();
    }
  }

  // Fallback
  if (["INT", "NUM", "SERIAL", "REAL", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC"].some(t => baseType.includes(t))) {
    return () => parseFloat(fake.finance.amount({ min: 1, max: 1000, dec: 2 }));
  }
  return () => fake.lorem.word();
}
