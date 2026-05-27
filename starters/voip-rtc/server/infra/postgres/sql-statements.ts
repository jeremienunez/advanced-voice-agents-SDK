export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const previous = sql[index - 1];
    if ((char === "'" || char === "\"") && previous !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === ";" && !quote) {
      const statement = compactSql(current);
      if (statement) statements.push(statement);
      current = "";
      continue;
    }
    current += char;
  }

  const tail = compactSql(current);
  if (tail) statements.push(tail);
  return statements;
}

export function compactSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}
