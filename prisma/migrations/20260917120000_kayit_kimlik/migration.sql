-- KAYITLA GİRİŞ: EBA SSO GELENE KADAR ÖĞRENCİ VE ÖĞRETMEN HESABI
--
-- EBA SSO bir süre gelmeyecek. Sistem belli kişilerle denenecek ve bu
-- kişiler giriş ekranından kendi kaydını açıyor: T.C. kimlik no, ad, soyad,
-- il, okul, tip (öğrenci/öğretmen), cinsiyet, sınıf/branş ve şifre. Sonraki
-- girişler T.C. kimlik no + şifreyle yapılır.
--
-- Kimlik alanları "kullanici" satırına her zamanki gibi yazılır;
-- auth_provider_id T.C. kimlik numarasıdır. Bu tablo yalnızca şifreyi ve kilit
-- durumunu tutar. dis_kimlik'ten ayrı olmasının sebebi schema.prisma'daki
-- model açıklamasında.
--
-- ON DELETE CASCADE: kullanıcı satırı silindiğinde şifresinin ortada kalması
-- için hiçbir sebep yok.

CREATE TABLE "kayit_kimlik" (
  "kullanici_id"       INTEGER NOT NULL,
  "sifre_ozeti"        VARCHAR(200) NOT NULL,
  "basarisiz_deneme"   INTEGER NOT NULL DEFAULT 0,
  "kilit_bitis_tarihi" TIMESTAMPTZ(6),
  "son_giris_tarihi"   TIMESTAMPTZ(6),
  "olusturma_tarihi"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "guncelleme_tarihi"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kayit_kimlik_pkey" PRIMARY KEY ("kullanici_id"),
  CONSTRAINT "kayit_kimlik_kullanici_id_fkey"
    FOREIGN KEY ("kullanici_id") REFERENCES "kullanici"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
