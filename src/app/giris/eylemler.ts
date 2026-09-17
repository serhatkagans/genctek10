"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { guvenliDonusYolu } from "@/lib/auth/donus-yolu";
import { oturumKapat, oturumKullanicisi } from "@/lib/auth/oturum";
import { disKimlikliMi } from "@/lib/dis-kimlik/giris";
import { basliklardanAnahtar, paylasilanHizSiniri } from "@/lib/hiz-siniri";
import { kayitliGirisYap } from "@/lib/kayit/giris";
import { girisYap } from "@/lib/kullanici/giris-akisi";
import { ortam } from "@/lib/ortam";
import { kimlikDogrulamaLogla } from "@/lib/yetki/log";

/**
 * Şifreli giriş hız sınırı — gerekçesi app/dis-giris/eylemler.ts'teki ile
 * aynı (şifre püskürtmesi hesap başına kilide görünmez, her deneme scrypt
 * çalıştırır). Sayaç veritabanında, kopyalar arasında ortak.
 */
const GIRIS_PENCERE_DAKIKA = 10;
const girisSiniri = paylasilanHizSiniri({
  kova: "kayitli-giris",
  pencereMs: GIRIS_PENCERE_DAKIKA * 60_000,
  sinir: 20,
});

/** Hata dönüşünde dönüş yolunu koruyan sorgu parçası. */
function nereyeParcasi(nereye: string | null): string {
  return nereye ? `&nereye=${encodeURIComponent(nereye)}` : "";
}

/**
 * T.C. kimlik no + şifreyle giriş (17 Eylül 2026 · AUTH_PROVIDER="kayit").
 *
 * Şifre adres çubuğuna HİÇBİR KOŞULDA yazılmaz; hata dönüşünde T.C. numarası
 * da taşınmaz — tarayıcı geçmişine ve ters vekil günlüğüne düşerdi.
 */
export async function sifreliGirisEylemi(veri: FormData): Promise<void> {
  const nereye = guvenliDonusYolu(String(veri.get("nereye") ?? ""));

  if (ortam.AUTH_PROVIDER !== "kayit") {
    redirect(`/giris?hata=${encodeURIComponent("Bu giriş yolu kapalı.")}`);
  }

  if (
    await girisSiniri.takildiMi(
      basliklardanAnahtar(await headers(), ortam.GUVENILEN_VEKIL_SAYISI),
    )
  ) {
    redirect(
      `/giris?hata=${encodeURIComponent(
        `Kısa sürede çok fazla giriş denemesi yapıldı. ${GIRIS_PENCERE_DAKIKA} dakika sonra tekrar deneyin.`,
      )}${nereyeParcasi(nereye)}`,
    );
  }

  const sonuc = await kayitliGirisYap(
    String(veri.get("tcKimlikNo") ?? ""),
    String(veri.get("sifre") ?? ""),
  );

  if (sonuc.durum === "BASARISIZ") {
    redirect(
      `/giris?hata=${encodeURIComponent(sonuc.mesaj)}${nereyeParcasi(nereye)}`,
    );
  }

  redirect(girisSonrasiYol(sonuc, nereye));
}

export async function girisEylemi(veri: FormData): Promise<void> {
  /*
   * KİMLİK SEÇEREK GİRİŞ YALNIZCA MOCK KİPTE. Kayıt kipinde sağlayıcının
   * `girisYap`'ı T.C. numarasını şifresiz kabul ediyor (şifre
   * sifreliGirisEylemi'nde doğrulanıyor); bu eylem açık kalsaydı numarayı
   * gönderen herkes girerdi. Sunucu eylemi doğrudan çağrılabildiği için
   * ekrandan kaldırmak yetmez.
   */
  if (ortam.AUTH_PROVIDER !== "mock") {
    redirect(`/giris?hata=${encodeURIComponent("Bu giriş yolu kapalı.")}`);
  }

  const kimlikBilgisi = String(veri.get("kimlikBilgisi") ?? "");
  /*
   * Dönüş yolu, giriş ekranına portaldan gelen kişinin tıkladığı sayfadır
   * (bkz. lib/auth/donus-yolu.ts). Değer adres çubuğundan geldiği için ASLA
   * doğrudan kullanılmaz; `guvenliDonusYolu` uygulama dışına çıkan her şeyi
   * eler ve elenirse akış olağan yoluna (panel) döner.
   */
  const nereye = guvenliDonusYolu(String(veri.get("nereye") ?? ""));
  // Hata dönüşünde de korunur: kişi kimlik seçemediğinde nereden geldiğini
  // unutan bir ekrana düşerse, portaldan gelen bağlantı ilk hatada kaybolurdu.
  const nereyeSorgusu = nereye
    ? `&nereye=${encodeURIComponent(nereye)}`
    : "";

  if (!kimlikBilgisi) {
    await kimlikDogrulamaLogla({
      islem: "GIRIS",
      basarili: false,
      saglayici: "EBA",
      neden: "kimlik seçilmedi",
    });
    redirect(`/giris?hata=Kimlik+se%C3%A7ilmedi${nereyeSorgusu}`);
  }

  const sonuc = await girisYap(kimlikBilgisi);

  if (sonuc.durum === "BASARISIZ") {
    redirect(
      `/giris?hata=${encodeURIComponent(sonuc.mesaj)}${nereyeSorgusu}`,
    );
  }

  redirect(girisSonrasiYol(sonuc, nereye));
}

/**
 * Giriş sonrası açılacak ekran.
 *
 * HERKES PROFİLLE KARŞILANIR (7 Ağustos 2026 · istek: "tüm kullanıcı grupları
 * için ilk açılınca profil sekmesi ile başlasın, panel ile değil").
 *
 * Önceden yalnızca öğrenci profile düşüyordu (C3 · 5 Ağustos); öğretmen,
 * koordinatör ve merkez panele giriyordu. Kural artık rolden bağımsız —
 * profil, kişinin kendini gördüğü ve tanıttığı yer ve menüde de ilk sekme.
 * Rol ayrımı, aynı soruya iki cevap vermek olurdu.
 *
 * DANIŞMAN SEÇİMİ HÂLÂ ÖNCELİKLİDİR: danışmansız öğrenci "boşta" kalamaz
 * (SKILL.md · Değişmezler 2), o yüzden seçim ekranı bir kapıdır ve profilin
 * önüne geçer. Seçimini yapan öğrenci sonraki girişinde profile düşer.
 *
 * `ogrenciMi` artık kullanılmıyor ama imzada DURUYOR: çağıran `girisYap`
 * sonucunu olduğu gibi geçiriyor ve alanı ayıklamak, ileride rol bazlı bir
 * kapı gerektiğinde geri eklenecek bir bilgiyi bugünden atmak olurdu.
 */
function girisSonrasiYol(
  sonuc: { danismanSecimiGerekli: boolean },
  nereye: string | null,
): string {
  /*
   * DANIŞMAN SEÇİMİ DÖNÜŞ YOLUNU DA YENER: danışmansız öğrenci "boşta"
   * kalamaz (SKILL.md · Değişmezler 2) ve seçim ekranı bir kapıdır. Portaldan
   * gelen öğrenci önce danışmanını seçer; etkinliği sonra açar.
   */
  if (sonuc.danismanSecimiGerekli) return "/panel/danisman-secim";
  if (nereye) return nereye;
  return "/panel";
}

/**
 * Çıkış, KİŞİYİ GİRDİĞİ KAPIYA bırakır (11 Ağustos 2026 · istek: "e-Devlet
 * girişiyle giren, çıkınca EBA girişindeki kullanıcılara düşüyor").
 *
 * Mezun, paydaş temsilcisi ve mentör /dis-giris'ten gelir; onları /giris'e
 * bırakmak, hiç giremeyecekleri bir listenin önünde bırakmak olurdu. Ölçüt
 * `dis_kimlik` satırıdır, rol değil (bkz. lib/dis-kimlik/giris.ts).
 *
 * Sorgu OTURUM KAPANMADAN ÖNCE yapılır: çerez silindikten sonra kimin çıktığı
 * bilinemez.
 */
export async function cikisEylemi(): Promise<void> {
  const kullanici = await oturumKullanicisi();
  const disKullanici = kullanici
    ? await disKimlikliMi(kullanici.id)
    : false;

  if (kullanici) {
    await kimlikDogrulamaLogla({
      islem: "CIKIS",
      basarili: true,
      kullaniciId: kullanici.id,
      saglayici: disKullanici
        ? "dış kimlik"
        : ortam.AUTH_PROVIDER === "kayit"
          ? "kayıt"
          : "EBA",
    });
  }
  await oturumKapat();
  redirect(disKullanici ? "/dis-giris" : "/giris");
}
