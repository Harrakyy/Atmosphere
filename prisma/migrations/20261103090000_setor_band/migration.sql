-- Protokol Setor §1/§5: rentang 3 digit terakhir nominal bayar dipilih pemilik di app Setor (bawaan 100–499)
ALTER TABLE "Setting" ADD COLUMN "bandMin" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "bandMax" INTEGER NOT NULL DEFAULT 499;
