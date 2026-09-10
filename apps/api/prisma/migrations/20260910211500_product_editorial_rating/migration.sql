-- ATHR editorial product rating.
-- This is a store-curated score and remains separate from customer ratingAverage/reviewCount.

ALTER TABLE "Product"
  ADD COLUMN "editorialRating" DECIMAL(3,2) NOT NULL DEFAULT 4.80;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
  FROM "Product"
)
UPDATE "Product" AS p
SET "editorialRating" =
  CASE ((ranked.rn - 1) % 4)
    WHEN 0 THEN 4.60
    WHEN 1 THEN 4.70
    WHEN 2 THEN 4.80
    ELSE 4.90
  END
FROM ranked
WHERE ranked.id = p.id;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_editorialRating_range"
  CHECK ("editorialRating" >= 4.60 AND "editorialRating" <= 5.00);
