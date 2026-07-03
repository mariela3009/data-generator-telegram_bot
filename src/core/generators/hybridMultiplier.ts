import { Faker } from '@faker-js/faker';
import { TableSchema, ColumnSchema } from '../schemas';

export function multiplyData(
  seedRows: Record<string, any>[],
  targetCount: number,
  tableSchema: TableSchema,
  fakeInstance: Faker
): any[][] {
  if (!seedRows || seedRows.length === 0) {
    return [];
  }

  // Extract pools of values per column from the seed
  const pools: Record<string, any[]> = {};
  for (const col of tableSchema.columns) {
    pools[col.name] = [];
  }

  for (const row of seedRows) {
    for (const [colName, val] of Object.entries(row)) {
      if (pools[colName]) {
        pools[colName].push(val);
      }
    }
  }

  const fakerOverrides: Record<string, () => any> = {};
  const colStrategies: Record<string, string> = {};

  for (const col of tableSchema.columns) {
    let isFakerFriendly = false;
    
    // Simplistic check for emails, uuids, etc to force faker
    if (/email|correo/i.test(col.name)) {
      isFakerFriendly = true;
      fakerOverrides[col.name] = () => fakeInstance.internet.email();
    } else if (/uuid|guid/i.test(col.name)) {
      isFakerFriendly = true;
      fakerOverrides[col.name] = () => fakeInstance.string.uuid();
    }

    if (isFakerFriendly) {
      colStrategies[col.name] = "faker";
    } else if (["INT", "SERIAL", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC"].some(t => col.dataType.toUpperCase().includes(t))) {
      colStrategies[col.name] = "number_jitter";
    } else {
      colStrategies[col.name] = "seed_permutation";
    }
  }

  const multipliedRows: any[][] = [];
  const columnsOrder = tableSchema.columns.map(c => c.name);

  for (let i = 0; i < targetCount; i++) {
    const row: any[] = [];
    if (i < seedRows.length) {
      // Use exact seed row
      for (const colName of columnsOrder) {
        row.push(seedRows[i][colName] ?? null);
      }
    } else {
      // Mutate
      for (const col of tableSchema.columns) {
        const colName = col.name;
        const strategy = colStrategies[colName];
        const pool = pools[colName];

        if (strategy === "faker" && fakerOverrides[colName]) {
          row.push(fakerOverrides[colName]());
        } else if (strategy === "number_jitter" && pool && pool.length > 0) {
          const baseVal = pool[Math.floor(Math.random() * pool.length)];
          if (baseVal !== null && baseVal !== undefined) {
            const num = Number(baseVal);
            if (!isNaN(num)) {
              const jitter = num * (Math.random() * 0.3 - 0.15); // +/- 15%
              const newVal = num + jitter;
              if (["INT", "SERIAL"].some(t => col.dataType.toUpperCase().includes(t))) {
                row.push(Math.round(newVal));
              } else {
                row.push(parseFloat(newVal.toFixed(2)));
              }
            } else {
              row.push(baseVal);
            }
          } else {
            row.push(null);
          }
        } else if (strategy === "seed_permutation" && pool && pool.length > 0) {
          let val = pool[Math.floor(Math.random() * pool.length)];
          if (typeof val === 'string' && val.split(' ').length > 1 && Math.random() < 0.2) {
            const otherVal = pool[Math.floor(Math.random() * pool.length)];
            if (typeof otherVal === 'string' && otherVal.split(' ').length > 1) {
              const parts1 = val.split(' ');
              const parts2 = otherVal.split(' ');
              val = `${parts1[0]} ${parts2[parts2.length - 1]}`;
            }
          }
          row.push(val);
        } else {
          row.push(null);
        }
      }
    }
    multipliedRows.push(row);
  }

  return multipliedRows;
}
