import "dotenv/config";
import { prisma } from "@/lib/db";
import { sifreOzetle } from "@/lib/dis-kimlik/sifre";
import { sifreKarariniVer } from "@/lib/dis-kimlik/kurallar";
import { tcKimlikNoGecerliMi } from "@/lib/kayit/kurallar";
import { kullaniciSagla } from "@/lib/kullanici/sagla";
import { egitimOgretimYili } from "@/lib/ogretmen/gorev-yillari";

/**
 * Kayıt kipinde proje yöneticisi hesabı (17 Eylül 2026).
 *
 * NİYE BETİK: kayıt formu yalnızca öğrenci ve öğretmen açar, PROJE_YONETICISI
 * rolü hiçbir ekrandan kendiliğinden verilmez (kullanici/sagla.ts). Kullanıcı
 * verileri silindiğinde seed'in mock yöneticileri de gidiyor ve şifreleri
 * olmadığı için kayıt kipinde giremiyorlar. İlk yönetici bu betikle açılır;
 * sonrakileri de o atayabilir.
 *
 * İKİ KULLANIM:
 *   1) Yeni personel hesabı (okulsuz) açıp yönetici yap:
 *        YONETICI_SIFRE='...' npm run kullanici:yonetici -- --tc 1234... --ad Ayşe --soyad Kaya --cinsiyet K
 *   2) Kayıt formuyla zaten açılmış bir hesabı yönetici yap:
 *        npm run kullanici:yonetici -- --tc 1234...
 *
 * ŞİFRE KOMUT SATIRINDA DEĞİL ORTAM DEĞİŞKENİNDE: argüman olarak verilseydi
 * kabuk geçmişine ve süreç listesine düşerdi.
 */

function arguman(ad: string): string {
  const sira = process.argv.indexOf(`--${ad}`);
  return sira >= 0 ? (process.argv[sira + 1] ?? "").trim() : "";
}

async function main() {
  const tc = arguman("tc").replace(/\s+/g, "");
  if (!tcKimlikNoGecerliMi(tc)) {
    throw new Error("--tc geçerli bir T.C. kimlik numarası olmalı.");
  }

  let kullanici = await prisma.kullanici.findUnique({
    where: { authProviderId: tc },
    select: { id: true, ad: true, soyad: true, kayitKimlik: { select: { kullaniciId: true } } },
  });

  if (kullanici && !kullanici.kayitKimlik) {
    throw new Error(
      "Bu numarayla şifresi olmayan bir kayıt var; betik ona şifre bağlamaz.",
    );
  }

  if (!kullanici) {
    const ad = arguman("ad");
    const soyad = arguman("soyad");
    const cinsiyet = arguman("cinsiyet");
    const sifre = process.env.YONETICI_SIFRE ?? "";
    if (!ad || !soyad || (cinsiyet !== "E" && cinsiyet !== "K")) {
      throw new Error(
        "Hesap yok: yeni hesap için --ad, --soyad ve --cinsiyet (E/K) gerekli.",
      );
    }
    const karar = sifreKarariniVer(sifre, { ad, soyad, eposta: "" });
    if (!karar.olurMu) {
      throw new Error(`YONETICI_SIFRE: ${karar.neden}`);
    }

    const sifreOzeti = await sifreOzetle(sifre);
    const { kullaniciId } = await kullaniciSagla({
      authProviderId: tc,
      tip: "PERSONEL",
      ad,
      soyad,
      cinsiyet,
      kurumKodu: null,
      ilKodu: null,
      ilceKodu: null,
      sinif: null,
      brans: null,
      egitimOgretimYili: egitimOgretimYili(new Date()),
    });
    await prisma.kayitKimlik.create({ data: { kullaniciId, sifreOzeti } });
    kullanici = { id: kullaniciId, ad, soyad, kayitKimlik: { kullaniciId } };
    console.log(`Hesap açıldı: ${ad} ${soyad}`);
  }

  const mevcutRol = await prisma.kullaniciRol.findFirst({
    where: {
      kullaniciId: kullanici.id,
      rolKodu: "PROJE_YONETICISI",
      bitisTarihi: null,
    },
    select: { id: true },
  });
  if (mevcutRol) {
    console.log(`${kullanici.ad} ${kullanici.soyad} zaten proje yöneticisi.`);
    return;
  }

  await prisma.kullaniciRol.create({
    data: { kullaniciId: kullanici.id, rolKodu: "PROJE_YONETICISI" },
  });
  console.log(`${kullanici.ad} ${kullanici.soyad} proje yöneticisi yapıldı.`);
}

main()
  .catch((hata) => {
    console.error(hata instanceof Error ? hata.message : hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
