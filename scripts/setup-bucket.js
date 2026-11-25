import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Checking Supabase Storage buckets...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Error listing buckets:', listError.message);
    process.exit(1);
  }

  const existing = buckets.find(b => b.name === 'revati-media');
  if (existing) {
    console.log('Bucket "revati-media" already exists! Public status:', existing.public);
    if (!existing.public) {
      console.log('Updating "revati-media" to public...');
      await supabase.storage.updateBucket('revati-media', { public: true });
      console.log('Bucket updated to public.');
    }
  } else {
    console.log('Creating public bucket "revati-media"...');
    const { data, error: createError } = await supabase.storage.createBucket('revati-media', {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024 // 10 MB max (preset will enforce tighter limits)
    });
    if (createError) {
      console.error('Failed to create bucket:', createError.message);
      process.exit(1);
    }
    console.log('Public bucket "revati-media" created successfully!');
  }
}

run();
