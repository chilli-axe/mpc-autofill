import { extractLanguage } from "@/common/processing";
import { Tag } from "@/common/schema_types";
import {
  LocalDirectoryHandleParams,
  RemoteFileHandleParams,
} from "@/common/types";
import { extractNameAndTags } from "@/features/clientSearch/tags";

export class Folder {
  constructor(
    public readonly params: LocalDirectoryHandleParams | RemoteFileHandleParams,
    public readonly name: string,
    public readonly parent: Folder | undefined
  ) {}

  unpackName(tags: Map<string, Tag>): {
    language: string | undefined;
    name: string;
    tags: Set<string>;
  } {
    const [language, name] = extractLanguage(this.name);
    const [nameWithNoTags, extractedTags] = extractNameAndTags(name, tags);
    return {
      language,
      name: nameWithNoTags,
      tags: extractedTags,
    };
  }

  getLanguage(tags: Map<string, Tag>): string | undefined {
    const { language } = this.unpackName(tags);
    if (this.parent === undefined) {
      return language;
    }
    return language ?? this.parent.getLanguage(tags);
  }

  getTags(tags: Map<string, Tag>): Set<string> {
    const { tags: extractedTags } = this.unpackName(tags);
    if (this.parent === undefined) {
      return extractedTags;
    }
    return extractedTags.union(this.parent.getTags(tags));
  }

  getFullPath(tags: Map<string, Tag>): Array<string> {
    const { name } = this.unpackName(tags);
    if (this.parent === undefined) {
      return [name];
    }
    return [...this.parent.getFullPath(tags), name];
  }
}
