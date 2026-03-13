import { sanitiseWhitespace } from "@/common/processing";
import { Tag } from "@/common/schema_types";

export const extractNameAndTags = (
  name: string | null | undefined,
  tags: Map<string, Tag>
): [string, Set<string>] => {
  /**
   * This function unpacks a folder or image name which contains a name component and some number of tags
   * into its constituents.
   * Tags are wrapped in either [square brackets] or (parentheses), and any combination of [] and () can be used
   * within a single name.
   */

  if (!name) {
    return ["", new Set()];
  }

  const tagSet: Set<string> = new Set();

  // Get content of () and []
  const tagPartsRegex = /\(([^\(\)]+)\)|\[([^\[\]]+)\]/g;
  const tagParts: RegExpMatchArray[] = Array.from(name.matchAll(tagPartsRegex));

  const cleanedParts = tagParts.map((match) =>
    match[1] !== undefined ? match[1] : match[2]
  );

  let nameWithNoTags = name; // tags will be removed from this name below

  for (const tagPart of cleanedParts) {
    const rawTags = tagPart.split(",").map((x) => x.trim());

    for (const rawTag of rawTags) {
      const lowercaseTag = rawTag.toLowerCase();

      // identify if this is a valid tag. if it is, add the tag's name to the set
      let tagObject: Tag | null = null;

      if (tags.has(lowercaseTag)) {
        tagObject = tags.get(lowercaseTag)!;
      } else {
        for (const tag of tags.values()) {
          if (
            tag.aliases
              ?.map((alias) => alias.toLowerCase())
              .includes(lowercaseTag)
          ) {
            tagObject = tag;
            break;
          }
        }
      }

      if (tagObject === null) {
        continue;
      }

      tagSet.add(tagObject.name);

      // `tagObject` also implies all of its parents
      let currentTag = tagObject;
      while (currentTag.parent !== null) {
        tagSet.add(currentTag.parent);
        const parent = tags.get(currentTag.parent);
        if (parent) {
          currentTag = parent;
        } else {
          break;
        }
      }

      // this is a little ugly. remove all instances of `rawTag` inside () or [] in the name.
      const escapedRawTag = rawTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      while (true) {
        const matchRegex = new RegExp(
          `\\(.*?(${escapedRawTag},? *).*?\\)|\\[.*?(${escapedRawTag},? *).*?\\]`
        );
        const match = nameWithNoTags.match(matchRegex);

        if (!match) {
          break;
        }

        // Find which capture group matched
        for (let i = 1; i < match.length; i++) {
          if (match[i] !== undefined) {
            const fullMatch = match[0];
            const groupMatch = match[i];
            const start = match.index! + fullMatch.indexOf(groupMatch);
            const end = start + groupMatch.length;

            nameWithNoTags =
              nameWithNoTags.slice(0, start) + nameWithNoTags.slice(end);
            break;
          }
        }
      }
    }
  }

  // remove these extra bits from the name
  const artifacts: [string, string][] = [
    ["( )", ""],
    ["()", ""],
    ["[ ]", ""],
    ["[]", ""],
    ["[, ", "["],
    [", ]", "]"],
    ["(, ", "("],
    [", )", ")"],
  ];

  for (const [artifact, replacement] of artifacts) {
    nameWithNoTags = nameWithNoTags.replaceAll(artifact, replacement);
  }

  return [sanitiseWhitespace(nameWithNoTags), tagSet];
};
