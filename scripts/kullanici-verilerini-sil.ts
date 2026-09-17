import "dotenv/config";
import { prisma } from "@/lib/db";

/**
 * Tüm kullanıcıları ve onlara bağlı kayıtları siler (17 Eylül 2026 · istek:
 * "veri tabanındaki kullanıcı bilgilerini de silelim" — kayıtla girişe
 * geçerken isim seçerek girilen test kullanıcıları temizleniyor).
 *
 * NE SİLİNİR: `kullanici` tablosu ve ona yabancı anahtarla (doğrudan ya da
 * zincirle) bağlı HER tablo — roller, profiller, danışman atamaları,
 * etkinlikler ve başvuruları, mesajlar, talepler, paydaş envanteri, erişim
 * günlükleri, dış kullanıcı başvuruları. Liste koddan değil veritabanının
 * kendi kısıt kataloğundan çıkarılır; şemaya yeni tablo eklendiğinde betik
 * onu da görür.
 *
 * NE KALIR: il, ilçe, okul, çalışma grupları, sistem ayarları, bildirim
 * şablonları, etkinlik programları — kullanıcıya bağlı olmayan referans veri.
 * Depolama dizinindeki dosyalar (fotoğraf, ek) diskten SİLİNMEZ.
 *
 * KİMLİK SAYAÇLARI SIFIRLANMAZ (RESTART IDENTITY YOK). Oturum çerezi
 * `kullanici.id` taşıyor; sayaç sıfırlansaydı silinmiş bir kişinin tarayıcıda
 * kalan çerezi, aynı numarayı alan YENİ kayda denk gelir ve o kişinin
 * oturumu olarak kabul edilirdi (oturum sürümü ikisinde de 0).
 *
 * Kullanım:
 *   npx tsx scripts/kullanici-verilerini-sil.ts          yalnızca sayar (prova)
 *   npx tsx scripts/kullanici-verilerini-sil.ts --evet   siler
 */

async function bagliTablolar(): Promise<string[]> {
  const satirlar = await prisma.$queryRaw<{ tablo: string }[]>`
    WITH RECURSIVE bagli(oid) AS (
      SELECT 'kullanici'::regclass::oid
      UNION
      SELECT c.conrelid
        FROM pg_constraint c
        JOIN bagli b ON c.confrelid = b.oid
       WHERE c.contype = 'f'
    )
    SELECT oid::regclass::text AS tablo FROM bagli ORDER BY 1`;
  return satirlar.map((satir) => satir.tablo);
}

async function main() {
  const silecek = process.argv.includes("--evet");
  const tablolar = await bagliTablolar();

  let toplam = 0;
  for (const tablo of tablolar) {
    // Tablo adı kataloğun kendisinden geliyor; kullanıcı girdisi değil.
    const [{ sayi }] = await prisma.$queryRawUnsafe<{ sayi: bigint }[]>(
      `SELECT count(*) AS sayi FROM ${tablo}`,
    );
    toplam += Number(sayi);
    console.log(`  ${tablo.padEnd(34)} ${sayi}`);
  }
  console.log(`${tablolar.length} tablo, ${toplam} satır.`);

  if (!silecek) {
    console.log("Prova: hiçbir şey silinmedi. Silmek için --evet ekleyin.");
    return;
  }

  await prisma.$executeRawUnsafe(`TRUNCATE ${tablolar.join(", ")} CASCADE`);
  const kalan = await prisma.kullanici.count();
  console.log(`Silindi. Kalan kullanıcı: ${kalan}`);
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
