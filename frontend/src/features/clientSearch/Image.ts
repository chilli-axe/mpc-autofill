import { Unknown } from "@/common/constants";
import { extractLanguage, toSearchable } from "@/common/processing";
import {
  CardType as CardTypeSchema,
  SourceType,
  Tag,
} from "@/common/schema_types";
import {
  CardType,
  LocalFileHandleParams,
  OramaCardDocument,
  RemoteFileHandleParams,
} from "@/common/types";
import { Folder } from "@/features/clientSearch/Folder";
import { extractNameAndTags } from "@/features/clientSearch/tags";

export class Image {
  constructor(
    public readonly params: LocalFileHandleParams | RemoteFileHandleParams,
    public readonly name: string,
    public readonly extension: string,
    public readonly size: number,
    public readonly modifiedTime: Date,
    public readonly height: number,
    public readonly folder: Folder
  ) {}

  unpackName(tags: Map<string, Tag>): {
    language: string | undefined;
    name: string;
    tags: Set<string>;
  } {
    const [language, name] = extractLanguage(this.name);
    const [nameWithNoTags, extractedTags] = extractNameAndTags(name, tags);
    return {
      language: language ?? this.folder.getLanguage(tags),
      name: nameWithNoTags,
      tags: extractedTags.union(this.folder.getTags(tags)),
    };
  }

  getCardType(): CardType {
    return this.folder.name.toLowerCase().includes("cardback")
      ? CardTypeSchema.Cardback
      : this.folder.name.toLowerCase().includes("token")
      ? CardTypeSchema.Token
      : CardTypeSchema.Card;
  }

  getFullPath(tags: Map<string, Tag>): Array<string> | null {
    return [
      ...this.folder.getFullPath(tags),
      this.params.sourceType === SourceType.LocalFile
        ? this.params.fileHandle.name
        : this.params.identifier,
    ];
  }

  getImageId(tags: Map<string, Tag>): string {
    if (this.params.sourceType === SourceType.LocalFile) {
      const resolvedPath = this.getFullPath(tags);
      // fall back on setting filepath to random string if unable to resolve. realistically this should never happen.
      const filePath = resolvedPath
        ? `./${resolvedPath.slice(1).join("/")}`
        : Math.random().toString();
      return filePath;
    }
    if (this.params.sourceType === SourceType.GoogleDrive) {
      return this.params.identifier;
    }
    throw new Error("getImageId not implemented yet for other source types");
  }

  getOramaCardDocument(tags: Map<string, Tag>): OramaCardDocument {
    const { language, name, tags: extractedTags } = this.unpackName(tags);
    const imageId = this.getImageId(tags);
    return {
      id: imageId,
      cardType: this.getCardType(),
      name: name,
      searchq: toSearchable(this.name),
      source: this.folder.name, // TODO: verbose naming?
      sourceId: -1,
      sourceVerbose: this.folder.getFullPath(tags).join(" / "),
      dpi: 10 * Math.round((this.height * 300) / 1110 / 10), // TODO: NaN?
      extension: this.extension,
      size: this.size,
      params: this.params,
      language: language ?? "English", // TODO: data type
      tags: Array.from(extractedTags),
      lastModified: this.modifiedTime,
      lastModifiedNumber: this.modifiedTime.valueOf(),
      created: this.modifiedTime, // TODO: wire up properly
      createdNumber: this.modifiedTime.valueOf(), // TODO: wire up properly
      expansionCode: Unknown,
      collectorNumber: Unknown,
      artist: Unknown,
    };
  }
}
