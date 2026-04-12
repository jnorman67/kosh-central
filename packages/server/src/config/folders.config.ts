export interface FolderConfig {
    displayName: string;
    sharingUrl: string; // e.g. 'https://1drv.ms/f/s!...'
    localPath?: string; // local filesystem path for scanning (e.g. OneDrive sync folder)
}

// ADD YOUR ONEDRIVE SHARING URLS HERE
export const FOLDERS: FolderConfig[] = [
    {
        displayName: "Dorothy's Album 18",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgDZENnCM1DcRoNsk2srqPSTAX-DOKfeaxklZdwo1H6Ufho?e=ijc6pT',
        // localPath: '/home/jim/OneDrive/...',
    },
];
