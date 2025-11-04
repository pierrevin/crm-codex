-- Backfill Tag/.Company join from existing Company.tags (text[]), then drop the array column

-- Ensure Tag table exists (idempotent when applied after previous migration)
CREATE TABLE IF NOT EXISTS "Tag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_slug_key" ON "Tag"("slug") WHERE "slug" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "_CompanyToTag" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "_CompanyToTag_AB_unique" ON "_CompanyToTag"("A", "B");
CREATE INDEX IF NOT EXISTS "_CompanyToTag_B_index" ON "_CompanyToTag"("B");
ALTER TABLE "_CompanyToTag"
  ADD CONSTRAINT IF NOT EXISTS "_CompanyToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CompanyToTag"
  ADD CONSTRAINT IF NOT EXISTS "_CompanyToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Helper: generate deterministic tag id from name (fallback) if needed
-- We will insert Tag rows using ON CONFLICT (name) DO NOTHING and then fetch ids

WITH company_tags AS (
  SELECT c.id AS company_id, trim(t) AS tag_name
  FROM "Company" c
  CROSS JOIN LATERAL unnest(COALESCE(c.tags, ARRAY[]::text[])) AS t
  WHERE trim(t) <> ''
),
ins_tags AS (
  INSERT INTO "Tag" ("id", "name")
  SELECT md5(lower(tag_name))::text AS id, tag_name
  FROM (
    SELECT DISTINCT lower(tag_name) AS tag_name
    FROM company_tags
  ) s
  ON CONFLICT ("name") DO NOTHING
  RETURNING "id", "name"
)
INSERT INTO "_CompanyToTag" ("A", "B")
SELECT ct.company_id, t.id
FROM company_tags ct
JOIN "Tag" t ON lower(t."name") = lower(ct.tag_name)
ON CONFLICT DO NOTHING;

-- Finally, drop the old array column
ALTER TABLE "Company" DROP COLUMN IF EXISTS "tags";


