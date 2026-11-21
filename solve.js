// Exact csv-reader 1.0.0 behavior, with fields sliced from the input when possible.
export function run(input) {
  const text = String(input.text);
  const n = text.length;
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  function error(code) { errors.push({ code, line: recordLine, row: recordRow }); }
  function unquoted(value, start) {
    let i = pos;
    let added = 0;
    for (; i < n; i++) {
      const c = text.charCodeAt(i);
      if (c === 44) {
        const add = i === start ? '' : text.slice(start, i);
        pos = i + 1;
        return [value + add, 1, added + i - start];
      }
      if (c === 10) {
        const add = i === start ? '' : text.slice(start, i);
        pos = i + 1; line++;
        return [value + add, 2, added + i - start];
      }
      if (c === 13) {
        const add = i === start ? '' : text.slice(start, i);
        if (i + 1 < n && text.charCodeAt(i + 1) === 10) {
          pos = i + 2; line++;
          return [value + add, 2, added + i - start];
        }
        if (i !== start) value += add;
        added += i - start;
        error('stray_cr');
        start = i + 1;
      }
    }
    pos = n;
    return [value + (n === start ? '' : text.slice(start)), 3, added + n - start];
  }
  function quoted() {
    const open = pos;
    const openLine = line;
    let i = ++pos;
    let value = '';
    let start = i;
    for (; i < n; i++) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        if (i + 1 < n && text.charCodeAt(i + 1) === 34) {
          value += (i === start ? '' : text.slice(start, i)) + '"';
          i++; start = i + 1;
          continue;
        }
        value += i === start ? '' : text.slice(start, i);
        pos = i + 1;
        if (pos >= n) return [value, 3];
        const next = text.charCodeAt(pos);
        if (next === 44) { pos++; return [value, 1]; }
        if (next === 10) { pos++; line++; return [value, 2]; }
        if (next === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; return [value, 2]; }
        const junk = unquoted(value, pos);
        if (junk[2] > 0) error('quote_junk');
        return junk;
      }
      if (c === 13) {
        value += (i === start ? '' : text.slice(start, i)) + '\n';
        line++;
        if (i + 1 < n && text.charCodeAt(i + 1) === 10) i++;
        start = i + 1;
      } else if (c === 10) line++;
    }
    pos = open + 1;
    line = openLine;
    error('unterminated_quote');
    return unquoted('"', pos);
  }

  while (true) {
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos++; line++; }
      else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= n) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let wasQuoted;
    do {
      wasQuoted = text.charCodeAt(pos) === 34;
      field = wasQuoted ? quoted() : unquoted('', pos);
      fields.push(field[0]);
    } while (field[1] === 1);
    if (fields.length === 1 && fields[0] === '' && !wasQuoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
