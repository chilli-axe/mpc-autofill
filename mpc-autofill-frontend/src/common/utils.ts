import { Brackets } from "./constants";

export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

export function imageSizeToMBString(
  size: number,
  numDecimalPlaces: number
): string {
  /**
   * Format `size` (a size in bytes) as a string in megabytes.
   */

  const roundFactor = 10 ** numDecimalPlaces;
  let sizeMB = size / 1000000;
  sizeMB = Math.round(sizeMB * roundFactor) / roundFactor;
  return `${sizeMB} MB`;
}

export function bracket(projectSize: number): number {
  /**
   * Calculate the MPC bracket that `projectSize` falls into.
   */

  for (const bracket of Brackets) {
    if (bracket >= projectSize) {
      return bracket;
    }
  }
  return Brackets[Brackets.length - 1];
}

export function downloadImage(imageURL: string, new_tab = true) {
  /**
   * Download an image with the given download link.
   * Note that this only works when `imageURL` has the same origin as where the link was opened from.
   */

  const element = document.createElement("a");
  element.href = imageURL;
  element.setAttribute("download", "deez.png"); // TODO: can we affect file name?
  if (new_tab) element.target = "_blank";

  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export function downloadText(filename: string, text: string) {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}
