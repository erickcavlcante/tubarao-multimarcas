-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "defaultWeightGrams" INTEGER;

-- AlterTable
ALTER TABLE "ProductVariation" ADD COLUMN     "weightGrams" INTEGER NOT NULL DEFAULT 300;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "defaultWeightGrams" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "originZipCode" TEXT,
ADD COLUMN     "packageHeightCm" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "packageLengthCm" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "packageWidthCm" INTEGER NOT NULL DEFAULT 30;
