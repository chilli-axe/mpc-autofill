export class LocalFilesService {
  directoryHandle: FileSystemDirectoryHandle | undefined;

  constructor() {
    this.directoryHandle = undefined;
  }

  getDirectoryHandle(): FileSystemDirectoryHandle | undefined {
    return this.directoryHandle;
  }

  setDirectoryHandle(directoryHandle: FileSystemDirectoryHandle | undefined) {
    this.directoryHandle = directoryHandle;
  }
}

export const localFilesService = new LocalFilesService();
