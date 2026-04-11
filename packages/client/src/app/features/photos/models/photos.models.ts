export interface PhotoFolder {
    id: string;
    displayName: string;
}

export interface Photo {
    id: string;
    name: string;
    downloadUrl: string;
    mimeType: string;
}
