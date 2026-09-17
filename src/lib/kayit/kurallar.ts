import { egitimOgretimYili } from "../ogretmen/gorev-yillari";
import { sifreKarariniVer } from "../dis-kimlik/kurallar";

/**
 * Kayıtla giriş kuralları — EBA SSO gelene kadar (17 Eylül 2026 · istek:
 * "login ekranında kayıt olacak kullanıcı ve sonra giriş yapacak").
 *
 * Öğrenci ve öğretmen kendi kaydını açar; sonraki girişler T.C. kimlik no +
 * şifreyle yapılır. Şifre alt sınırı, kilit ve özetleme dış kullanıcı
 * girişiyle AYNI kurallardan geçer (dis-kimlik/kurallar.ts, sifre.ts): iki
 * ayrı şifre politikası tutmanın bir kazancı yok.
 *
 * Bu dosya veritabanına bakmaz; kararlar birim testle sınanır. Okulun
 * gerçekten o ilde olup olmadığı veritabanı gerektirdiği için kayit/kayit.ts'te
 * denetlenir.
 */

export type KayitTipi = "OGRENCI" | "OGRETMEN";

export const KAYIT_TIPLERI: { kod: KayitTipi; etiket: string }[] = [
  { kod: "OGRENCI", etiket: "Öğrenci" },
  { kod: "OGRETMEN", etiket: "Öğretmen" },
];

export function kayitTipiMi(deger: string): deger is KayitTipi {
  return deger === "OGRENCI" || deger === "OGRETMEN";
}

/** Lise seviyeleri; GençTek lise öğrencilerine açık. */
export const SINIF_SEVIYELERI = ["9", "10", "11", "12"] as const;

/**
 * T.C. kimlik numarası biçim ve sağlama kontrolü.
 *
 * NÜFUS KAYDINA SORMAZ — MERNİS erişimi yok. Yakaladığı şey yazım hatasıdır:
 * 11 hane, ilk hane 0 değil, 10. ve 11. haneler resmî sağlama kuralına uyar.
 * Uydurma ama kurala uyan bir numara geçer; pilotun "belli kişilerle"
 * yapılması bu boşluğun kabul edilme sebebi.
 */
export function tcKimlikNoGecerliMi(deger: string): boolean {
  if (!/^[1-9][0-9]{10}$/.test(deger)) return false;
  const h = [...deger].map(Number);
  const tekler = h[0] + h[2] + h[4] + h[6] + h[8];
  const ciftler = h[1] + h[3] + h[5] + h[7];
  const onuncu = (((tekler * 7 - ciftler) % 10) + 10) % 10;
  if (onuncu !== h[9]) return false;
  const ilkOnToplam = h.slice(0, 10).reduce((a, b) => a + b, 0);
  return ilkOnToplam % 10 === h[10];
}

/** Boşlukları atar; kişi numarayı "123 456 789 01" diye yazabilir. */
export function tcKimlikNoNormalle(deger: string): string {
  return deger.replace(/\s+/g, "");
}

/** Ekrandan gelen ham kayıt girdisi. */
export interface KayitGirdisi {
  tip: string;
  tcKimlikNo: string;
  ad: string;
  soyad: string;
  cinsiyet: string;
  ilKodu: string;
  kurumKodu: string;
  sinifSeviyesi: string;
  sube: string;
  brans: string;
  sifre: string;
  sifreTekrar: string;
}

/** Doğrulanmış kayıt; şifre henüz özetlenmemiş. */
export interface KayitKaydi {
  tip: KayitTipi;
  tcKimlikNo: string;
  ad: string;
  soyad: string;
  cinsiyet: "E" | "K";
  ilKodu: string;
  kurumKodu: number;
  sinif: string | null;
  brans: string | null;
  egitimOgretimYili: string;
  sifre: string;
}

export type KayitKarari =
  | { olurMu: true; kayit: KayitKaydi }
  | { olurMu: false; neden: string };

const AD_UST_SINIRI = 100;
const BRANS_UST_SINIRI = 100;

/**
 * Ad ve soyad, e-Okul'daki yazıma yakın dursun diye Türkçe büyük harfe
 * çevrilmez; yalnızca fazla boşluk atılır. Kişinin yazdığı biçim korunur.
 */
function adNormalle(deger: string): string {
  return deger.trim().replace(/\s+/g, " ");
}

export function kayitGirdisiniCoz(
  girdi: KayitGirdisi,
  simdi: Date,
): KayitKarari {
  if (!kayitTipiMi(girdi.tip)) {
    return { olurMu: false, neden: "Öğrenci mi öğretmen mi olduğunuzu seçin." };
  }
  const tip = girdi.tip;

  const tcKimlikNo = tcKimlikNoNormalle(girdi.tcKimlikNo);
  if (!tcKimlikNoGecerliMi(tcKimlikNo)) {
    return { olurMu: false, neden: "T.C. kimlik numarası geçerli değil." };
  }

  const ad = adNormalle(girdi.ad);
  const soyad = adNormalle(girdi.soyad);
  if (!ad || !soyad) {
    return { olurMu: false, neden: "Ad ve soyad zorunludur." };
  }
  if (ad.length > AD_UST_SINIRI || soyad.length > AD_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Ad ve soyad en fazla ${AD_UST_SINIRI} karakter olabilir.`,
    };
  }

  if (girdi.cinsiyet !== "E" && girdi.cinsiyet !== "K") {
    return { olurMu: false, neden: "Cinsiyet seçilmelidir." };
  }

  const ilKodu = girdi.ilKodu.trim();
  if (!/^\d{2}$/.test(ilKodu)) {
    return { olurMu: false, neden: "İl seçilmelidir." };
  }

  const kurumMetni = girdi.kurumKodu.trim();
  const kurumKodu = Number(kurumMetni);
  if (!/^[1-9][0-9]*$/.test(kurumMetni) || !Number.isSafeInteger(kurumKodu)) {
    return { olurMu: false, neden: "Okulunuzu listeden seçin." };
  }

  let sinif: string | null = null;
  let brans: string | null = null;

  if (tip === "OGRENCI") {
    if (!(SINIF_SEVIYELERI as readonly string[]).includes(girdi.sinifSeviyesi)) {
      return { olurMu: false, neden: "Sınıfınızı seçin." };
    }
    /*
     * Şube İSTEĞE BAĞLI: bazı okullarda şube yok ya da öğrenci bilmiyor.
     * `kullanici.sinif` 10 karakter; "12-A" biçimi e-Okul'dakiyle aynı.
     */
    const sube = girdi.sube.trim().toLocaleUpperCase("tr-TR");
    if (sube && !/^[A-ZÇĞİÖŞÜ]{1,2}$/.test(sube)) {
      return { olurMu: false, neden: "Şube bir ya da iki harf olmalı (ör. A)." };
    }
    sinif = sube ? `${girdi.sinifSeviyesi}-${sube}` : girdi.sinifSeviyesi;
  } else {
    brans = adNormalle(girdi.brans);
    if (!brans) {
      return { olurMu: false, neden: "Branşınızı yazın." };
    }
    if (brans.length > BRANS_UST_SINIRI) {
      return {
        olurMu: false,
        neden: `Branş en fazla ${BRANS_UST_SINIRI} karakter olabilir.`,
      };
    }
  }

  if (girdi.sifre !== girdi.sifreTekrar) {
    return { olurMu: false, neden: "Şifre ile tekrarı aynı değil." };
  }
  const sifreKarari = sifreKarariniVer(girdi.sifre, { ad, soyad, eposta: "" });
  if (!sifreKarari.olurMu) {
    return { olurMu: false, neden: sifreKarari.neden };
  }
  // Şifre kimlik numarasını içeremez: numarayı bilen kişi sayısı az değil.
  if (girdi.sifre.includes(tcKimlikNo)) {
    return {
      olurMu: false,
      neden: "Şifre T.C. kimlik numaranızı içeremez.",
    };
  }

  return {
    olurMu: true,
    kayit: {
      tip,
      tcKimlikNo,
      ad,
      soyad,
      cinsiyet: girdi.cinsiyet,
      ilKodu,
      kurumKodu,
      sinif,
      brans,
      egitimOgretimYili: egitimOgretimYili(simdi),
      sifre: girdi.sifre,
    },
  };
}
