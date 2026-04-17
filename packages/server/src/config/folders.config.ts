export interface FolderConfig {
  displayName: string;
  sharingUrl: string; // e.g. 'https://1drv.ms/f/s!...'
  /**
   * Path relative to the scan root, matching the `folderName` recorded by
   * scan-local.ts. Use forward slashes. Example: "Dorothy's Album 18" or
   * "Family/2024".
   */
  folderPath: string;
}

// ADD YOUR ONEDRIVE SHARING URLS HERE
export const FOLDERS: FolderConfig[] = [
  {
    displayName: "Dorothy's Album 18",
    sharingUrl:
      "https://1drv.ms/f/c/cd2c0c2b50d77f00/IgDZENnCM1DcRoNsk2srqPSTAX-DOKfeaxklZdwo1H6Ufho?e=ijc6pT",
    folderPath: "Dorothy's Albums/album18",
  },
];
