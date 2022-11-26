export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

export function imageSizeToMBString(
  size: number,
  numDecimalPlaces: number
): string {
  const roundFactor = 10 ** numDecimalPlaces;
  let sizeMB = size / 1000000;
  sizeMB = Math.round(sizeMB * roundFactor) / roundFactor;
  return `${sizeMB} MB`;
}

export function bracket(projectSize: number): number {
  // small helper function to calculate the MPC bracket the current order lands in
  const brackets = [
    18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612,
  ];
  for (let i = 0; i < brackets.length; i++) {
    if (brackets[i] >= projectSize) {
      return brackets[i];
    }
  }
  return brackets[brackets.length - 1];
}

export function processLine(line: string): [string, number] | null {
  const trimmedLine = line.replace(/\s+/g, " ").trim();
  if (trimmedLine.length == 0) {
    return null;
  }
  const re = /^([0-9]*)?x?\s?(.*)$/; // extract quantity and card name from input text
  const results = re.exec(trimmedLine);
  return [results[2].toLowerCase(), parseInt(results[1] ?? "1")];
}
