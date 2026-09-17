import { prisma } from "../db";
import {
  basarisizDenemeSonucu,
  type KilitDurumu,
  kilitKalanDakika,
  kilitliMi,
} from "../dis-kimlik/kurallar";
import { sifreDogrula } from "../dis-kimlik/sifre";
import { type GirisSonucu, girisYap } from "../kullanici/giris-akisi";
import { kimlikDogrulamaLogla } from "../yetki/log";
import { tcKimlikNoNormalle } from "./kurallar";

/**
 * T.C. kimlik no + şifreyle giriş (17 Eylül 2026).
 *
 * Şifre ve kilit burada; doğrulanan kişi OLAĞAN GİRİŞ AKIŞINA verilir
 * (kullanici/giris-akisi.ts): danışman ataması, günlük ve oturum açma
 * mock/EBA ile aynı yoldan geçer.
 *
 * Kilit ve sayaç dış kullanıcı girişiyle aynı kurallarla, aynı gerekçelerle
 * işler (bkz. dis-kimlik/giris.ts · basarisizDenemeyiIsle): sayaç satır
 * kilitli bir işlemde artar, yoksa paralel denemeler sınırı aşardı.
 */

const GENEL_HATA = "T.C. kimlik numarası veya şifre hatalı.";
const SAGLAYICI = "kayıt";

async function basarisizDenemeyiIsle(
  kullaniciId: number,
  simdi: Date,
): Promise<KilitDurumu> {
  return prisma.$transaction(async (tx) => {
    const satirlar = await tx.$queryRaw<
      { basarisiz_deneme: number; kilit_bitis_tarihi: Date | null }[]
    >`SELECT basarisiz_deneme, kilit_bitis_tarihi
        FROM kayit_kimlik
       WHERE kullanici_id = ${kullaniciId}
         FOR UPDATE`;

    const satir = satirlar[0];
    if (!satir) return { basarisizDeneme: 0, kilitBitisTarihi: null };

    const taze: KilitDurumu = {
      basarisizDeneme: satir.basarisiz_deneme,
      kilitBitisTarihi: satir.kilit_bitis_tarihi,
    };
    if (kilitliMi(taze, simdi)) return taze;

    const yeniDurum = basarisizDenemeSonucu(taze, simdi);
    await tx.kayitKimlik.update({
      where: { kullaniciId },
      data: {
        basarisizDeneme: yeniDurum.basarisizDeneme,
        kilitBitisTarihi: yeniDurum.kilitBitisTarihi,
      },
    });
    return yeniDurum;
  });
}

function kilitMesaji(durum: KilitDurumu, simdi: Date): GirisSonucu {
  return {
    durum: "BASARISIZ",
    mesaj: `Çok fazla hatalı deneme yapıldı. ${kilitKalanDakika(durum, simdi)} dakika sonra tekrar deneyin.`,
  };
}

export async function kayitliGirisYap(
  tcGirdisi: string,
  sifre: string,
  simdi: Date = new Date(),
): Promise<GirisSonucu> {
  // Yönetici kullanıcı adı da bu alandan gelir ("Admin" yazılabilir);
  // küçük harfe indirmek T.C. numarasını etkilemez.
  const tcKimlikNo = tcKimlikNoNormalle(tcGirdisi).toLowerCase();

  const kayit =
    tcKimlikNo && sifre
      ? await prisma.kayitKimlik.findFirst({
          where: { kullanici: { authProviderId: tcKimlikNo } },
          select: {
            kullaniciId: true,
            sifreOzeti: true,
            basarisizDeneme: true,
            kilitBitisTarihi: true,
            kullanici: { select: { aktif: true } },
          },
        })
      : null;

  // "Böyle bir kayıt yok" ile "şifre yanlış" ayrılmaz (bkz. dis-kimlik/giris.ts).
  if (!kayit) {
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kimlikBilgisi: tcKimlikNo || null,
      saglayici: SAGLAYICI,
      neden: "kimlik doğrulanamadı",
    });
    return { durum: "BASARISIZ", mesaj: GENEL_HATA };
  }

  if (kilitliMi(kayit, simdi)) {
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kullaniciId: kayit.kullaniciId,
      saglayici: SAGLAYICI,
      neden: "hesap kilitli",
    });
    return kilitMesaji(kayit, simdi);
  }

  if (!(await sifreDogrula(sifre, kayit.sifreOzeti))) {
    const yeniDurum = await basarisizDenemeyiIsle(kayit.kullaniciId, simdi);
    const kilitlendi = yeniDurum.kilitBitisTarihi !== null;
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kullaniciId: kayit.kullaniciId,
      saglayici: SAGLAYICI,
      neden: kilitlendi ? "hatalı parola; hesap kilitlendi" : "kimlik doğrulanamadı",
    });
    return kilitlendi
      ? kilitMesaji(yeniDurum, simdi)
      : { durum: "BASARISIZ", mesaj: GENEL_HATA };
  }

  if (!kayit.kullanici.aktif) {
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      kullaniciId: kayit.kullaniciId,
      saglayici: SAGLAYICI,
      neden: "pasif hesap",
    });
    return { durum: "BASARISIZ", mesaj: GENEL_HATA };
  }

  await prisma.kayitKimlik.update({
    where: { kullaniciId: kayit.kullaniciId },
    data: { basarisizDeneme: 0, kilitBitisTarihi: null, sonGirisTarihi: simdi },
  });

  return girisYap(tcKimlikNo);
}
