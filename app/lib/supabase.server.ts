import {createClient} from '@supabase/supabase-js';

const BUCKET = 'main-bucket';

function getSupabase(env: Env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_KEY;

  // Because the Max storage limit is 1 GB, we need to have Several supabase buckets ready, for when this limit is reached, so that we switch to a new bucket so ppl can still upload images.

  // Can we have it automatically upload to bucket 2 if bucket 1 fails? This could be a try catch or an if statement conditional deciding to attempt upload to bucket 2 if bucket 1 fails. And so on. Attempt to upload to bucket 3 if bucket 1 and bucket 2 fails. Like a waterfall effect.

  // I also need to be able to keep the original bucket images live, while allowing new uploads to occur on bucket 2

  // I also need to be notified when storage limit is reached. Supabase may or may not do this.

  // also set a 20mb file size limit on uploads from add review and edit review or review form or wherever

  if (!url || !key) {
    throw new Error('Supabase credentials are not configured');
  }

  return createClient(url, key, {
    // Auth is not needed for simple storage uploads in this flow.
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const uploadImage = async (env: Env, image: File) => {
  const supabase = getSupabase(env);
  const objectName = `${Date.now()}-${image.name}`;

  const {data, error} = await supabase.storage
    .from(BUCKET)
    .upload(objectName, image, {
      cacheControl: '3600',
    });

  if (error || !data) {
    throw new Error(
      `Image upload failed: ${error?.message ?? 'unknown error'}`,
    );
  }

  return supabase.storage.from(BUCKET).getPublicUrl(objectName).data.publicUrl;
};

export const deleteImage = (env: Env, url: string) => {
  const supabase = getSupabase(env);
  const imageName = url.split('/').pop();

  if (!imageName) {
    throw new Error('Invalid URL');
  }

  return supabase.storage.from(BUCKET).remove([imageName]);
};
