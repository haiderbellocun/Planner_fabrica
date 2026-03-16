import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'taskflow-avatars';
const bucket = storage.bucket(BUCKET_NAME);

export async function uploadAvatarToGCS(
  fileBuffer: Buffer,
  mimeType: string,
  profileId: string
): Promise<string> {
  const ext =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : 'jpg';

  const filename = `avatars/${profileId}.${ext}`;
  const file = bucket.file(filename);

  await file.save(fileBuffer, {
    metadata: { contentType: mimeType },
    resumable: false,
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;
}

