# 30-Second Database Setup

## Step 1: Open Supabase SQL Editor
Click this link:
https://supabase.com/dashboard/project/xheaeamycsqdwdezrixr/sql/new

## Step 2: Copy & Paste
Paste this entire SQL block into the SQL Editor:

```sql
ALTER TABLE IF EXISTS public.shops
ADD COLUMN IF NOT EXISTS shop_name TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS registered_on TEXT;
```

## Step 3: Click "RUN" button

Done! Then come back and let me test everything.

---

**If you get a login prompt:**
You're already logged in, the page will show the SQL editor after loading.

**If the query succeeds:**
You'll see the columns have been added.

**If you get an error:**
That's OK - it might mean columns already exist. Just confirm and move on.

---

After Step 3, tell me you're done and I'll:
1. Reload the app
2. Test shop registration (should persist)
3. Test inventory deduction
4. Test refund restoration
5. Verify all payment modes tracked in drawer
6. Verify multi-shop isolation
