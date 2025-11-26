import {createClient} from '@supabase/supabase-js';

const BUCKET = 'main-bucket';

function getSupabase(env: Env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_KEY;

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

  const {data, error} = await supabase.storage.from(BUCKET).upload(objectName, image, {
    cacheControl: '3600',
  });

  if (error || !data) {
    throw new Error(`Image upload failed: ${error?.message ?? 'unknown error'}`);
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
