// One-time seed for the `folders` table. Runs only when the table is empty —
// safe to leave in place indefinitely as a no-op on populated databases.
// After the table is populated, folders are managed through the admin UI and
// can be exported/imported as JSON.

interface FolderSeed {
    slug: string;
    displayName: string;
    sharingUrl: string;
    folderPath: string;
    sortOrder: number;
}

export const FOLDER_SEED: FolderSeed[] = [
    {
        slug: 'album-01',
        displayName: "Dorothy's Album 1",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNG8QAAAAAAckrlV1mwpRVcC6A3bwl_j8?e=XQAiBz',
        folderPath: "Dorothy's Albums/album01",
        sortOrder: 10,
    },
    {
        slug: 'album-02',
        displayName: "Dorothy's Album 2",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNIcUAAAAAAXpZ5SuhGmmJLGmpzuEybPg?e=Yl5AMv',
        folderPath: "Dorothy's Albums/album02",
        sortOrder: 20,
    },
    {
        slug: 'album-03',
        displayName: "Dorothy's Album 3",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNkMYAAAAAAerOixR7J15hI0hZrdb1TBA?e=PXf6X1',
        folderPath: "Dorothy's Albums/album03",
        sortOrder: 30,
    },
    {
        slug: 'album-04-portraits',
        displayName: "Dorothy's Album 4 - portraits",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNKMcAAAAAAUz47gWGAnFK-SH5WOlO--0?e=kntTDM',
        folderPath: "Dorothy's Albums/album04",
        sortOrder: 40,
    },
    {
        slug: 'album-05',
        displayName: "Dorothy's Album 5",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNkMkAAAAAAeli_7XFHQ4XoUEpoaWnjKw?e=9DPvue',
        folderPath: "Dorothy's Albums/album05",
        sortOrder: 50,
    },
    {
        slug: 'album-06',
        displayName: "Dorothy's Album 6",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNB8oAAAAAAfiBa961yAxlHpDlR0ymBtE?e=QPYdNy',
        folderPath: "Dorothy's Albums/album06",
        sortOrder: 60,
    },
    {
        slug: 'album-07',
        displayName: "Dorothy's Album 7",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNvcoAAAAAAfusRmkBUNjIuDra6lc3UKo?e=oCzqDo',
        folderPath: "Dorothy's Albums/album07",
        sortOrder: 70,
    },
    {
        slug: 'album-08',
        displayName: "Dorothy's Album 8",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNY8sAAAAAAaM5yYf20W-t6JVklCra_Bc?e=of4Z8U',
        folderPath: "Dorothy's Albums/album08",
        sortOrder: 80,
    },
    {
        slug: 'album-09-sonny-shirley-wedding',
        displayName: "Dorothy's Album 9 - Sonny and Shirley wedding",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNScwAAAAAAeUT6kHhNNGpFg3uiuWhxBA?e=w6FNWt',
        folderPath: "Dorothy's Albums/album09 - Sonny and Shirley wedding",
        sortOrder: 90,
    },
    {
        slug: 'album-12',
        displayName: "Dorothy's Album 12",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNRs0AAAAAAZruHVb-ZuJDI85UrYgyB1c?e=IIeDd4',
        folderPath: "Dorothy's Albums/album12",
        sortOrder: 120,
    },
    {
        slug: 'album-13',
        displayName: "Dorothy's Album 13",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNDdQAAAAAATKTw7UflXgL-1rTzuQ2E2o?e=r8FTHB',
        folderPath: "Dorothy's Albums/album13 - Grandma's 1925 and on",
        sortOrder: 130,
    },
    {
        slug: 'album-14',
        displayName: "Dorothy's Album 14",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAAf9dQKwwsIIDNp9QAAAAAAT4xEhyLVGq4Oci6varEdtw?e=91oxbC',
        folderPath: "Dorothy's Albums/album14",
        sortOrder: 140,
    },
    {
        slug: 'album-16-urban',
        displayName: "Dorothy's Album 16 - Urban",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgCudtpmePAiQIe-iCyUNeyzAb0nrogAGnVcjPLnA2GN7mI?e=N3fU6y',
        folderPath: "Dorothy's Albums/album16 - Urban",
        sortOrder: 160,
    },
    {
        slug: 'album-17-barta-kosh',
        displayName: "Dorothy's Album 17 - Barta Kosh",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgAzyriHGDWuRJdWqb5Z9v4FAf2FQ8XvQeVmlq-QN_EjoHQ?e=Zm7oS6',
        folderPath: "Dorothy's Albums/album17 - Barta Kosh",
        sortOrder: 170,
    },
    {
        slug: 'album-18',
        displayName: "Dorothy's Album 18",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgDZENnCM1DcRoNsk2srqPSTAX-DOKfeaxklZdwo1H6Ufho?e=ijc6pT',
        folderPath: "Dorothy's Albums/album18",
        sortOrder: 180,
    },
    {
        slug: 'album-19',
        displayName: "Dorothy's Album 19",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgBL_Pru5G-FSZq9Up3yK5HmAYhLzXwJ3UVG59n1rklQSn8?e=xJhSC2',
        folderPath: "Dorothy's Albums/album19",
        sortOrder: 190,
    },
    {
        slug: 'album-20',
        displayName: "Dorothy's Album 20",
        sharingUrl: 'https://1drv.ms/f/c/cd2c0c2b50d77f00/IgCdo455lzC5QaHJiEGK8502AdYtzS3IoBU3eY1TECAGYsc?e=R7QcB0',
        folderPath: "Dorothy's Albums/album20",
        sortOrder: 200,
    },
];
