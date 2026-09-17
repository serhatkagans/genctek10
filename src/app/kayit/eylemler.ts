"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { basliklardanAnahtar, paylasilanHizSiniri } from "@/lib/hiz-siniri";
import { kayitOl } from "@/lib/kayit/kayit";
import { kayitGirdisiniCoz } from "@/lib/kayit/kurallar";
import { ortam } from "@/lib/ortam";

/**
 * Kayıt hız sınırı. Kapı kimlik istemiyor ve "bu numarayla hesap var" cevabı
 * veriyor; hacimli deneme hem sahte hesap hem numara keşfi demek. Okul/sınıf
 * toplu kaydında aynı NAT arkasından çok kişi gelebileceği için sayı
 * başvuru formundakinden bol tutuldu.
 */
const PENCERE_DAKIKA = 10;
const kayitSiniri = paylasilanHizSiniri({
  kova: "kayit",
  pencereMs: PENCERE_DAKIKA * 60_000,
  sinir: 30,
});

/**
 * Kayıt formu eylemi.
 *
 * Hata dönüşünde yalnızca il ve tip adres çubuğuna taşınır: şifre, T.C.
 * kimlik numarası ve ad tarayıcı geçmişine düşmemeli. Kişi formu yeniden
 * doldurur.
 */
export async function kayitEylemi(veri: FormData): Promise<void> {
  const metin = (alan: string) => String(veri.get(alan) ?? "");

  const girdi = {
    tip: metin("tip"),
    tcKimlikNo: metin("tcKimlikNo"),
    ad: metin("ad"),
    soyad: metin("soyad"),
    cinsiyet: metin("cinsiyet"),
    ilKodu: metin("ilKodu"),
    kurumKodu: metin("kurumKodu"),
    sinifSeviyesi: metin("sinifSeviyesi"),
    sube: metin("sube"),
    brans: metin("brans"),
    sifre: metin("sifre"),
    sifreTekrar: metin("sifreTekrar"),
  };

  const temelYol = `/kayit?tip=${encodeURIComponent(girdi.tip)}&il=${encodeURIComponent(girdi.ilKodu)}`;
  const hataYolu = (mesaj: string) =>
    `${temelYol}&hata=${encodeURIComponent(mesaj)}`;

  if (ortam.AUTH_PROVIDER !== "kayit") {
    redirect(`/giris?hata=${encodeURIComponent("Kayıt kapalı.")}`);
  }

  if (
    await kayitSiniri.takildiMi(
      basliklardanAnahtar(await headers(), ortam.GUVENILEN_VEKIL_SAYISI),
    )
  ) {
    redirect(
      hataYolu(
        `Kısa sürede çok fazla kayıt denemesi yapıldı. ${PENCERE_DAKIKA} dakika sonra tekrar deneyin.`,
      ),
    );
  }

  const karar = kayitGirdisiniCoz(girdi, new Date());
  if (!karar.olurMu) {
    redirect(hataYolu(karar.neden));
  }

  const sonuc = await kayitOl(karar.kayit);
  if (sonuc.durum === "BASARISIZ") {
    redirect(hataYolu(sonuc.mesaj));
  }

  redirect("/giris?kayit=tamam");
}
