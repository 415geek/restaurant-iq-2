#!/bin/sh
# Runs TasteFront for every store of a brand (live Qloo, cached 6 h). Usage: sh scripts/front-run-all.sh <brand-slug-prefix> [qloo|both] [--publish]
cd "$(dirname "$0")/.." || exit 1
prefix="$1"; variant="${2:-qloo}"; pub="$3"
for slug in $(bun --env-file=.env.local -e "const {createClient}=require('@supabase/supabase-js');const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);db.from('front_stores').select('slug').like('slug','$prefix%').order('slug').then(({data})=>console.log(data.map(x=>x.slug).join('\n')))"); do
  echo "== $slug"; bun --conditions=react-server --env-file=.env.local scripts/front-run.ts "$slug" "$variant" $pub 2>&1 | grep -E "^\[|tags:|caveats|✓|⚠|✗" | tail -12
done
