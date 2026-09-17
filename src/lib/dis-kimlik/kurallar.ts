import type { DisKullaniciTuru, RolKodu } from "@/generated/prisma/enums";

/**
 * EBA dışı giriş kuralları — mezun ve paydaş temsilcisi.
 *
 * Bu dosya veritabanına BAKMAZ ve "şimdi"yi parametre olarak alır; kararlar saf
 * tutulur ki birim testle eksiksiz kapsanabilsinler (aynı yaklaşım
 * lib/paydas/kurallar.ts ve lib/kvkk/kurallar.ts'de).
 *
 * BURADAKİ KURALLAR EBA'YA UYGULANMAZ. EBA/mock kimlikli kullanıcıların şifresi
 * yoktur; şifre, kilit ve sıfırlama yalnızca bu iki grubun sorunudur.
 */

export const TUR_ETIKETLERI: Record<DisKullaniciTuru, string> = {
  MEZUN: "Mezun",
  PAYDAS: "Paydaş temsilcisi",
  MENTOR: "Mentör",
};

/**
 * Şifre sormadan, listeden kimlik seçerek giriş yapılabilir mi?
 *
 * YALNIZCA MOCK SAĞLAYICIDA (10 Ağustos 2026). Gerçek e-Devlet/EBA
 * entegrasyonu gelene kadar geliştirme ve gösterim bu kapıdan yapılıyor;
 * `AUTH_PROVIDER="eba"` olan bir kurulumda kapı kapalıdır.
 *
 * KARAR BURADA, ortam.ts'i okumayan saf bir fonksiyonda: şifresiz oturum açan
 * bir kapının açık/kapalı ölçütü, birim testle sınanabilecek tek bir yerde
 * durmalı. Çağıranlar (ekran ve sunucu eylemi) bu fonksiyonu AYRI AYRI sorar —
 * ekranı gizlemek eylemi korumaz.
 */
export function kimlikSecerekGirisAcikMi(
  authSaglayici: "mock" | "eba" | "kayit",
): boolean {
  return authSaglayici === "mock";
}

/**
 * Başvuru formundaki "kim olarak başvuruyorsunuz" seçenekleri (7 Ağustos 2026).
 *
 * ÜÇÜ TEK FORMDA (istek: "Paydaş/Mentör başvurusu tek bir formdan yapılacak",
 * "mezunlar da paydaştan girsin"). Ayrı formlar, aynı doğrulama ve aynı KVKK
 * metnini üç kez yazdırırdı.
 */
export const DIS_TURLERI: DisKullaniciTuru[] = ["MEZUN", "PAYDAS", "MENTOR"];

export const TUR_ACIKLAMALARI: Record<DisKullaniciTuru, string> = {
  MEZUN:
    "GençTek'te öğrenci olarak yer aldınız ve mezun oldunuz. Okulunuzu ve mezuniyet yılınızı yazarsınız.",
  PAYDAS:
    "Bir kurumu temsilen katkı vermek istiyorsunuz. Kurumunuzu envanterden seçer, görev unvanınızı yazarsınız.",
  MENTOR:
    "Bildiğiniz konularda öğrencilere yol göstermek istiyorsunuz. Çalışma gruplarını ve konularınızı seçersiniz.",
};

/**
 * Başvuru türünün karşılığı olan rol.
 *
 * Eşleme TEK YERDE durur: onay akışı, yetki kontrolleri ve ekranlar bu
 * fonksiyondan geçer. İki ayrı yerde yazılsaydı biri güncellenmeyi kaçırır ve
 * onaylanan paydaş yanlış rolle sisteme girerdi.
 */
export function turunRolu(tur: DisKullaniciTuru): RolKodu {
  /*
   * MENTOR'ün AYRI BİR ROLÜ YOK ve bu bilinçli (7 Ağustos 2026).
   *
   * Rol, kapsam filtrelerinin okuduğu şeydir: "bu kişi hangi kayıtları
   * görebilir". Mentörün kapsamı paydaş temsilcisininkiyle birebir aynı —
   * ikisi de öğrenci/öğretmen kişisel verisine erişemez, etkinlik takvimini
   * ve panoyu görür. Ayrı bir rol açmak, her kapsam filtresine hiçbir şey
   * değiştirmeyen ikinci bir dal eklemek olurdu.
   *
   * Mentörlüğün KENDİSİ ayrı bir kayıtta tutuluyor (model Mentorluk) ve
   * "bu kişi mentör mü" sorusu oradan cevaplanıyor.
   */
  return tur === "MEZUN" ? "MEZUN" : "PAYDAS_TEMSILCISI";
}

export function disTuruMu(deger: string): deger is DisKullaniciTuru {
  return (DIS_TURLERI as string[]).includes(deger);
}

// ---------------------------------------------------------------------------
// E-posta ve şifre
// ---------------------------------------------------------------------------

/** RFC'ye tam uyum aranmaz; amaç yazım hatasını yakalamak (bkz. paydas/kurallar.ts). */
const EPOSTA_BICIMI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EPOSTA_UST_SINIRI = 150;

/**
 * E-postayı giriş adı olarak kullanılabilir hâle getirir.
 *
 * Küçük harfe indirgeme TÜRKÇE KURALLA YAPILMAZ: `toLocaleLowerCase("tr")`
 * "I" harfini "ı"ya çevirir ve "ALI@x.com" ile "ali@x.com" iki ayrı hesap
 * olurdu. E-posta adresi bir dil metni değil, teknik bir tanımlayıcıdır.
 */
export function epostaNormalle(deger: string): string {
  return deger.trim().toLowerCase();
}

export function epostaGecerliMi(deger: string): boolean {
  return deger.length <= EPOSTA_UST_SINIRI && EPOSTA_BICIMI.test(deger);
}

/**
 * Şifre alt sınırı.
 *
 * 10 karakter, "8 karakter + büyük harf + rakam + simge" gibi bir maskeye
 * yeğlendi: karmaşıklık maskeleri kullanıcıyı `Sifre123!` gibi tahmin
 * edilebilir kalıplara iter, uzunluk ise doğrudan arama uzayını büyütür.
 * Yine de tek karakterden ibaret ("aaaaaaaaaa") ya da kişinin adından türeyen
 * şifreler ayrıca eleniyor.
 */
export const SIFRE_ALT_SINIRI = 10;
export const SIFRE_UST_SINIRI = 200;

/** Şifrede aranmaması gereken, kişiden türeyen parçalar. */
export interface SifreBaglami {
  ad: string;
  soyad: string;
  eposta: string;
}

export type SifreKarari = { olurMu: true } | { olurMu: false; neden: string };

export function sifreKarariniVer(
  sifre: string,
  baglam: SifreBaglami,
): SifreKarari {
  if (sifre.length < SIFRE_ALT_SINIRI) {
    return {
      olurMu: false,
      neden: `Şifre en az ${SIFRE_ALT_SINIRI} karakter olmalı.`,
    };
  }
  if (sifre.length > SIFRE_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Şifre en fazla ${SIFRE_UST_SINIRI} karakter olabilir.`,
    };
  }

  const benzersizKarakter = new Set(sifre).size;
  if (benzersizKarakter < 4) {
    return {
      olurMu: false,
      neden: "Şifre en az dört farklı karakter içermeli.",
    };
  }

  /*
   * Kişisel parçalar aranırken küçük harfe indirgeme yine Türkçe kuralsız:
   * karşılaştırılan şey ad değil, şifrenin içindeki dizgidir.
   */
  const kucuk = sifre.toLowerCase();
  const parcalar = [
    baglam.ad.trim().toLowerCase(),
    baglam.soyad.trim().toLowerCase(),
    epostaNormalle(baglam.eposta).split("@")[0] ?? "",
  ].filter((parca) => parca.length >= 4);

  if (parcalar.some((parca) => kucuk.includes(parca))) {
    return {
      olurMu: false,
      // Kayıt formunda e-posta sorulmuyor (kayit/kurallar.ts); mesaj
      // olmayan bir alanı anmasın.
      neden: baglam.eposta
        ? "Şifre adınızı, soyadınızı ya da e-posta adınızı içeremez."
        : "Şifre adınızı ya da soyadınızı içeremez.",
    };
  }

  return { olurMu: true };
}

// ---------------------------------------------------------------------------
// Kaba kuvvet koruması
// ---------------------------------------------------------------------------

/**
 * Kaç başarısız denemeden sonra hesap geçici olarak kilitlenir.
 *
 * KİLİT KALICI DEĞİL: kalıcı kilit, saldırganın başkasının hesabını kasten
 * kilitlemesine (hizmet dışı bırakma) izin verirdi. Süreli kilit denemeyi
 * pahalılaştırır, kurbanı dışarıda bırakmaz.
 */
export const BASARISIZ_DENEME_SINIRI = 5;
export const KILIT_SURESI_DAKIKA = 15;

export interface KilitDurumu {
  basarisizDeneme: number;
  kilitBitisTarihi: Date | null;
}

export function kilitliMi(durum: KilitDurumu, simdi: Date): boolean {
  return durum.kilitBitisTarihi !== null && durum.kilitBitisTarihi > simdi;
}

/** Kilidin bitmesine kalan dakika (yukarı yuvarlanır); kilitli değilse 0. */
export function kilitKalanDakika(durum: KilitDurumu, simdi: Date): number {
  if (!kilitliMi(durum, simdi)) return 0;
  const kalanMs = (durum.kilitBitisTarihi as Date).getTime() - simdi.getTime();
  return Math.max(1, Math.ceil(kalanMs / 60000));
}

/**
 * Başarısız denemeden sonraki yeni durum.
 *
 * Sayaç kilitlenince SIFIRLANIR: kilidi biten kişi tek bir hatalı denemeyle
 * yeniden kilitlenmemeli, ona da tam bir hak seti verilir.
 */
export function basarisizDenemeSonucu(
  durum: KilitDurumu,
  simdi: Date,
): KilitDurumu {
  const yeniDeneme = durum.basarisizDeneme + 1;
  if (yeniDeneme < BASARISIZ_DENEME_SINIRI) {
    return { basarisizDeneme: yeniDeneme, kilitBitisTarihi: null };
  }
  return {
    basarisizDeneme: 0,
    kilitBitisTarihi: new Date(simdi.getTime() + KILIT_SURESI_DAKIKA * 60000),
  };
}

/** Parola sıfırlama bağlantısının ömrü. */
export const SIFIRLAMA_GECERLILIK_DAKIKA = 60;

export function sifirlamaGecerliMi(
  sonGecerlilik: Date | null,
  simdi: Date,
): boolean {
  return sonGecerlilik !== null && sonGecerlilik > simdi;
}

/**
 * Aynı adrese iki sıfırlama bağlantısı arasında beklenmesi gereken süre.
 *
 * NİYE VAR: sıfırlama ucu oturum ARAMAZ ve her istek bir jeton özeti üretir;
 * özetleme scrypt'tir (N=16384, 64 MB, ~100 ms · bkz. dis-kimlik/sifre.ts).
 * Sınırsız bırakıldığında kimliği doğrulanmamış tek bir POST akışı hem
 * kurbanın posta kutusunu doldurur hem de sunucunun çekirdeğini ve belleğini
 * yer — giriş ekranındaki kilit sayaçları bu yola hiç uğramıyor.
 *
 * KISA TUTULDU: bağlantısı spam klasörüne düşen kişi birkaç dakika içinde
 * yeniden isteyebilmeli. Amaç kişiyi yavaşlatmak değil, saniyede yüzlerce
 * isteği anlamsız kılmak.
 */
export const SIFIRLAMA_BEKLEME_DAKIKA = 2;

/**
 * Yeni bir sıfırlama bağlantısı üretilsin mi?
 *
 * Elde hâlâ geçerli ve YENİ verilmiş bir jeton varsa hayır. Jetonun verilme
 * anı ayrı bir sütunda tutulmuyor; son geçerlilik tarihinden ömrü çıkarılarak
 * bulunur, böylece şemaya kolon eklemeye gerek kalmıyor.
 *
 * `SIFIRLAMA_GECERLILIK_DAKIKA` ileride KISALTILIRSA eski kayıtlar için
 * hesaplanan verilme anı geleceğe düşer; o durumda fonksiyon "az önce
 * verilmiş" sayıp bekletir — jeton kendi süresi dolunca çözülür, yanlış
 * tarafa düşmüş olmaz.
 */
export function sifirlamaYenidenIstenebilirMi(
  sonGecerlilik: Date | null,
  simdi: Date,
): boolean {
  if (!sifirlamaGecerliMi(sonGecerlilik, simdi)) return true;
  const verilme =
    (sonGecerlilik as Date).getTime() - SIFIRLAMA_GECERLILIK_DAKIKA * 60000;
  return simdi.getTime() - verilme >= SIFIRLAMA_BEKLEME_DAKIKA * 60000;
}

// ---------------------------------------------------------------------------
// Başvuru girdisi
// ---------------------------------------------------------------------------

/** Ekrandan gelen ham başvuru girdisi. */
export interface DisBasvuruGirdisi {
  tur: string;
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
  ilKodu: string;
  sifre: string;
  sifreTekrar: string;
  /** MEZUN: okul kodu (isteğe bağlı) ve mezuniyet yılı. */
  mezunKurumKodu: string;
  mezuniyetYili: string;
  /** PAYDAS: envanterdeki kurum kaydı ve kişinin oradaki görevi. */
  paydasId: string;
  gorevUnvani: string;
  beyan: string;
  /**
   * MENTÖRLÜK (7 Ağustos 2026 · "Paydaş/Mentör başvurusu tek bir formdan
   * yapılacak"). tur=MENTOR olduğunda zorunlu olarak true gelir; mezun ve
   * paydaş da işaretleyebilir.
   */
  mentorlukIstiyor: boolean;
  mentorlukKonulari: string;
  mentorlukGrupIdleri: readonly unknown[];
}

/** Veritabanına yazılabilir hâle gelmiş başvuru (şifre henüz özetlenmemiş). */
export interface DisBasvuruKaydi {
  tur: DisKullaniciTuru;
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string | null;
  ilKodu: string;
  sifre: string;
  mezunKurumKodu: number | null;
  mezuniyetYili: number | null;
  paydasId: number | null;
  gorevUnvani: string | null;
  beyan: string;
  mentorlukIstiyor: boolean;
  mentorlukKonulari: string | null;
  mentorlukGrupIdleri: number[];
}

export type DisBasvuruKarari =
  | { olurMu: true; kayit: DisBasvuruKaydi }
  | { olurMu: false; neden: string };

const AD_UST_SINIRI = 100;
const UNVAN_UST_SINIRI = 150;
const BEYAN_ALT_SINIRI = 20;
const BEYAN_UST_SINIRI = 2000;
/** `mentorluk.konular` ile aynı sınır (lib/mentor/kurallar.ts). */
const MENTORLUK_KONULARI_UST_SINIRI = 500;

/** Telefon biçimi paydaş envanteriyle aynı gevşeklikte tutuldu. */
const TELEFON_BICIMI = /^[0-9+()\s./-]{7,20}$/;

/**
 * En eski kabul edilen mezuniyet yılı.
 *
 * GençTek ekosistemi yeni olduğu için "mezun" kavramı son yıllarla sınırlı;
 * yine de sınır geniş tutuldu, çünkü daraltmak gerçek başvuruyu reddetmenin
 * bedeliyle gelir. Alan yalnızca yazım hatasını (1099, 20255) yakalar.
 */
const EN_ESKI_MEZUNIYET_YILI = 1970;

function bosVeyaMetin(deger: string): string | null {
  const kirpilmis = deger.trim();
  return kirpilmis ? kirpilmis : null;
}

/**
 * Başvuru girdisini doğrular.
 *
 * TÜRE GÖRE AYRIŞAN ALANLAR: mezunda mezuniyet yılı, paydaşta kurum kaydı ve
 * görev unvanı zorunludur. Paydaş temsilcisi kurum adını SERBEST METİN
 * YAZAMAZ — envanterdeki kayıttan seçer; aksi hâlde aynı üniversite onlarca
 * yazımla sisteme girer ve il koordinatörlerinin yönettiği envanter
 * kullanılamaz hâle gelirdi (aynı gerekçe: paydasEkleyebilirMi).
 */
export function disBasvuruGirdisiniCoz(
  girdi: DisBasvuruGirdisi,
  simdi: Date,
): DisBasvuruKarari {
  if (!disTuruMu(girdi.tur)) {
    return { olurMu: false, neden: "Başvuru türü seçilmelidir." };
  }
  const tur = girdi.tur;

  const ad = girdi.ad.trim();
  const soyad = girdi.soyad.trim();
  if (!ad || !soyad) {
    return { olurMu: false, neden: "Ad ve soyad zorunludur." };
  }
  if (ad.length > AD_UST_SINIRI || soyad.length > AD_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Ad ve soyad en fazla ${AD_UST_SINIRI} karakter olabilir.`,
    };
  }

  const eposta = epostaNormalle(girdi.eposta);
  if (!epostaGecerliMi(eposta)) {
    return { olurMu: false, neden: "Geçerli bir e-posta adresi girin." };
  }

  const telefon = bosVeyaMetin(girdi.telefon);
  if (telefon && !TELEFON_BICIMI.test(telefon)) {
    return { olurMu: false, neden: "Telefon numarası geçerli değil." };
  }

  const ilKodu = girdi.ilKodu.trim();
  if (!/^\d{2}$/.test(ilKodu)) {
    return { olurMu: false, neden: "İl seçilmelidir." };
  }

  if (girdi.sifre !== girdi.sifreTekrar) {
    return { olurMu: false, neden: "Şifre ile tekrarı aynı değil." };
  }
  const sifreKarari = sifreKarariniVer(girdi.sifre, { ad, soyad, eposta });
  if (!sifreKarari.olurMu) {
    return { olurMu: false, neden: sifreKarari.neden };
  }

  const beyan = girdi.beyan.trim();
  if (beyan.length < BEYAN_ALT_SINIRI) {
    return {
      olurMu: false,
      neden:
        "Ekosisteme nasıl katkı vermek istediğinizi birkaç cümleyle yazın; başvurunuz buna göre değerlendirilecek.",
    };
  }
  if (beyan.length > BEYAN_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Açıklama en fazla ${BEYAN_UST_SINIRI} karakter olabilir.`,
    };
  }

  /*
   * AYDINLATMA ONAYI ŞARTI KALKTI (21 Ağustos 2026 · istek: "kvkk olmayacak
   * yani sadece çerez politikası"). Formdaki kutu da kalktı; şart burada
   * kalsaydı hiçbir başvuru kabul edilmezdi.
   */

  let mezunKurumKodu: number | null = null;
  let mezuniyetYili: number | null = null;
  let paydasId: number | null = null;
  let gorevUnvani: string | null = null;

  if (tur === "MEZUN") {
    const yilMetni = girdi.mezuniyetYili.trim();
    const yil = Number(yilMetni);
    if (
      !/^\d{4}$/.test(yilMetni) ||
      yil < EN_ESKI_MEZUNIYET_YILI ||
      yil > simdi.getFullYear()
    ) {
      return { olurMu: false, neden: "Geçerli bir mezuniyet yılı girin." };
    }
    mezuniyetYili = yil;

    // Okul İSTEĞE BAĞLI: kapanmış ya da referans tablosunda bulunmayan bir
    // okuldan mezun olan kişi başvuramaz hâle gelmemeli.
    const kurumMetni = girdi.mezunKurumKodu.trim();
    if (kurumMetni) {
      const kurumKodu = Number(kurumMetni);
      if (!Number.isInteger(kurumKodu) || kurumKodu <= 0) {
        return { olurMu: false, neden: "Mezun olunan okul geçerli değil." };
      }
      mezunKurumKodu = kurumKodu;
    }
  } else if (tur === "PAYDAS") {
    const paydasMetni = girdi.paydasId.trim();
    const secilen = Number(paydasMetni);
    if (!paydasMetni || !Number.isInteger(secilen) || secilen <= 0) {
      return {
        olurMu: false,
        neden: "Temsil ettiğiniz paydaş kurumu listeden seçin.",
      };
    }
    paydasId = secilen;

    gorevUnvani = bosVeyaMetin(girdi.gorevUnvani);
    if (!gorevUnvani) {
      return {
        olurMu: false,
        neden: "Kurumdaki görev/unvanınızı yazın.",
      };
    }
    if (gorevUnvani.length > UNVAN_UST_SINIRI) {
      return {
        olurMu: false,
        neden: `Görev/unvan en fazla ${UNVAN_UST_SINIRI} karakter olabilir.`,
      };
    }
  }

  /*
   * MENTÖRLÜK ALANLARI.
   *
   * tur=MENTOR ise işaret ZORUNLU: o türü seçen kişi mentörlük istiyor
   * demektir ve işaretsiz gelen bir MENTOR başvurusu, onaylayan için ne
   * yapacağı belirsiz bir kayıt olurdu.
   *
   * Mentörlük isteniyorsa EN AZ BİR ALAN dolu olmalı — grup ya da konu.
   * İkisi de boşsa öğrenci bu kişiye hangi konuda başvuracağını bilemez.
   *
   * Grup kimlikleri BURADA listeye karşı doğrulanmaz: seçilebilir grupların
   * listesi veritabanındadır ve bu fonksiyon saf. Doğrulama onay anında
   * yapılıyor (bkz. lib/mentor/veri.ts · disBasvurudanMentorlukAc) — o an
   * bir grup pasife alınmış da olabilir.
   */
  const mentorlukIstiyor = tur === "MENTOR" ? true : girdi.mentorlukIstiyor;

  const mentorlukGrupIdleri = mentorlukIstiyor
    ? [
        ...new Set(
          girdi.mentorlukGrupIdleri
            .map((ham) => Number.parseInt(String(ham), 10))
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      ]
    : [];

  const mentorlukKonulariMetni = girdi.mentorlukKonulari.trim();
  if (mentorlukKonulariMetni.length > MENTORLUK_KONULARI_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Mentörlük konuları en fazla ${MENTORLUK_KONULARI_UST_SINIRI} karakter olabilir.`,
    };
  }

  if (
    mentorlukIstiyor &&
    mentorlukGrupIdleri.length === 0 &&
    !mentorlukKonulariMetni
  ) {
    return {
      olurMu: false,
      neden:
        "Mentörlük için en az bir çalışma grubu seçin ya da mentörlük yapabileceğiniz konuları yazın.",
    };
  }

  const mentorlukKonulari = mentorlukIstiyor
    ? mentorlukKonulariMetni || null
    : null;

  return {
    olurMu: true,
    kayit: {
      tur,
      ad,
      soyad,
      eposta,
      telefon,
      ilKodu,
      sifre: girdi.sifre,
      mezunKurumKodu,
      mezuniyetYili,
      paydasId,
      gorevUnvani,
      beyan,
      mentorlukIstiyor,
      mentorlukKonulari,
      mentorlukGrupIdleri,
    },
  };
}

// ---------------------------------------------------------------------------
// Karar
// ---------------------------------------------------------------------------

const RET_GEREKCESI_ALT_SINIRI = 10;
const RET_GEREKCESI_UST_SINIRI = 1000;

/**
 * Ret gerekçesi ZORUNLUDUR.
 *
 * Tekrar başvuru serbest olduğu için gerekçesiz ret, kişiyi aynı başvuruyu
 * aynı eksikle tekrar göndermeye iter — ne başvuran ne onaylayan kazanır.
 */
export function retGerekcesiniCoz(
  gerekce: string,
): { olurMu: true; gerekce: string } | { olurMu: false; neden: string } {
  const kirpilmis = gerekce.trim();
  if (kirpilmis.length < RET_GEREKCESI_ALT_SINIRI) {
    return {
      olurMu: false,
      neden:
        "Ret gerekçesi yazın: kişi tekrar başvurabiliyor, neyi düzelteceğini bilmeli.",
    };
  }
  if (kirpilmis.length > RET_GEREKCESI_UST_SINIRI) {
    return {
      olurMu: false,
      neden: `Ret gerekçesi en fazla ${RET_GEREKCESI_UST_SINIRI} karakter olabilir.`,
    };
  }
  return { olurMu: true, gerekce: kirpilmis };
}
