import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';
const SIZE = 512;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Each user's photo lives at `<auth user id>/avatar.jpg`; storage rules only allow writing there. */
function pathFor(authUserId: string) {
  return `${authUserId}/avatar.jpg`;
}

/**
 * Lets the user pick a photo, crops it square, shrinks it to 512 px and
 * uploads it. Returns the public URL to save on the profile, or null if they
 * cancelled. The URL changes on every upload so cached copies refresh.
 */
export async function pickAndUploadAvatar(authUserId: string): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];

  // Centre-crop to a square when the picker didn't (it can't on web)
  const side = Math.min(asset.width || SIZE, asset.height || SIZE);
  const actions = [
    ...(asset.width && asset.height && asset.width !== asset.height
      ? [{ crop: { originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side } }]
      : []),
    { resize: { width: SIZE, height: SIZE } },
  ];
  const image = await manipulateAsync(asset.uri, actions, { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!image.base64) throw new Error('Could not read that photo.');

  const path = pathFor(authUserId);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(image.base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Deletes the uploaded photo. Best effort: the profile no longer points at it either way. */
export async function removeAvatarFile(authUserId: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([pathFor(authUserId)]);
}
